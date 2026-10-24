import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from 'vitest';
import type { CitiesBundleView, CityView, StateView } from '@at-field/dto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource, QueryFailedError } from 'typeorm';
import { GeoService } from '../src/geo/geo.service';
import { seedIbge } from '../src/geo/ibge/seed';
import {
  CURRENT_IBGE_SNAPSHOT,
  loadIbgeSnapshot,
} from '../src/geo/ibge/snapshot';
import { CITY_TOLEDO_PR, createTestApp, resetDatabase } from './utils';

const CACHE = 'public, max-age=86400';
const ERROR_CACHE = 'no-store';

// A base IBGE vem da migration (globalSetup) e não é truncada entre testes.
describe('Geo (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(() => app.close());

  const http = () => request(app.getHttpServer());
  const count = async (table: 'states' | 'cities') => {
    const rows: { total: number }[] = await app
      .get(DataSource)
      .query(`SELECT count(*)::int AS total FROM "${table}"`);
    return rows[0].total;
  };
  const search = async (query: Record<string, string | number>) =>
    (await http().get('/cities').query(query).expect(200)).body as CityView[];

  describe('GET /states', () => {
    it('lista as 27 UFs sem X-Tenant-Id, ordenadas pelo nome', async () => {
      const response = await http().get('/states').expect(200);
      const states = response.body as StateView[];
      expect(states).toHaveLength(27);
      expect(states[0]).toEqual({ id: 12, uf: 'AC', name: 'Acre' });
      expect(states.find((s) => s.uf === 'DF')?.id).toBe(53);
      // Acentuados no lugar certo (Ceará antes de Distrito Federal).
      const names = states.map((s) => s.name);
      expect(names.indexOf('Ceará')).toBeLessThan(
        names.indexOf('Distrito Federal'),
      );
      expect(names.at(-1)).toBe('Tocantins');
      expect(response.headers['cache-control']).toBe(CACHE);
    });

    it('continua com 27 UFs depois de limpar os dados de teste', async () => {
      await resetDatabase(app);
      const response = await http().get('/states').expect(200);
      expect(response.body).toHaveLength(27);
    });
  });

  describe('GET /states/:uf/cities', () => {
    it('lista todas as cidades da UF (aceita minúscula)', async () => {
      const response = await http().get('/states/pr/cities').expect(200);
      const cities = response.body as CityView[];
      expect(cities).toHaveLength(399);
      expect(cities.every((c) => c.uf === 'PR')).toBe(true);
      expect(cities).toContainEqual({
        id: CITY_TOLEDO_PR,
        name: 'Toledo',
        uf: 'PR',
      });
      expect(response.headers['cache-control']).toBe(CACHE);
    });

    it('ordena ignorando acentos', async () => {
      const response = await http().get('/states/SP/cities').expect(200);
      const names = (response.body as CityView[]).map((c) => c.name);
      expect(names).toHaveLength(645);
      expect(names[0]).toBe('Adamantina');
      // "Álvares Florence" fica entre os "Al...", não no fim da lista.
      expect(names.indexOf('Álvares Florence')).toBeLessThan(
        names.indexOf('Americana'),
      );
    });

    it('DF tem uma cidade', async () => {
      const response = await http().get('/states/df/cities').expect(200);
      expect(response.body).toEqual([
        { id: 5300108, name: 'Brasília', uf: 'DF' },
      ]);
    });

    it('UF inexistente retorna 404 e formato inválido 400', async () => {
      await http().get('/states/XX/cities').expect(404);
      await http().get('/states/P1/cities').expect(400);
      await http().get('/states/PRR/cities').expect(400);
    });
  });

  describe('GET /cities (busca)', () => {
    it('ignora acento e caixa; exato vem primeiro', async () => {
      for (const q of ['candido mota', 'CÂNDIDO MOTA', '  Cândido   Mota ']) {
        const [first] = await search({ q });
        expect(first).toEqual({ id: 3510005, name: 'Cândido Mota', uf: 'SP' });
      }
    });

    it('prefixo sem acento encontra os "Cândido ..."', async () => {
      const cities = await search({ q: 'CÂNDIDO' });
      const prefix = cities.filter((c) => c.name.startsWith('Cândido'));
      expect(prefix.map((c) => c.id)).toContain(3510005);
      // Os que começam com "Cândido" vêm antes dos que só contêm.
      expect(cities.slice(0, prefix.length)).toEqual(prefix);
    });

    it('homônimos aparecem todos com a UF: exato > contém', async () => {
      const cities = await search({ q: 'toledo' });
      expect(cities.slice(0, 2)).toEqual([
        { id: 3169109, name: 'Toledo', uf: 'MG' },
        { id: CITY_TOLEDO_PR, name: 'Toledo', uf: 'PR' },
      ]);
      const pedro = cities.findIndex((c) => c.name === 'Pedro de Toledo');
      expect(pedro).toBeGreaterThan(1);
      expect(cities[pedro].uf).toBe('SP');
    });

    it('prefixo vem antes de contém', async () => {
      const cities = await search({ q: 'boa esperanca', limit: 50 });
      const firstContains = cities.findIndex(
        (c) => !c.name.startsWith('Boa Esperança'),
      );
      const lastPrefix = cities.findLastIndex((c) =>
        c.name.startsWith('Boa Esperança'),
      );
      expect(cities[0].name).toBe('Boa Esperança');
      if (firstContains >= 0) expect(lastPrefix).toBeLessThan(firstContains);
      expect(cities.map((c) => c.id)).toContain(5101837);
    });

    it('filtra por UF', async () => {
      expect(await search({ q: 'toledo', uf: 'pr' })).toEqual([
        { id: CITY_TOLEDO_PR, name: 'Toledo', uf: 'PR' },
      ]);
    });

    it('aceita apóstrofo reto ou tipográfico', async () => {
      for (const q of ["d'oeste", 'd’oeste']) {
        const cities = await search({ q, uf: 'RO' });
        expect(cities.map((c) => c.id)).toContain(1100015);
      }
    });

    it('respeita limit', async () => {
      expect(await search({ q: 'sao', limit: 1 })).toHaveLength(1);
      expect(await search({ q: 'sao' })).toHaveLength(20);
      expect(await search({ q: 'sao', limit: 50 })).toHaveLength(50);
    });

    it('trata %, _ e \\ como texto', async () => {
      expect(await search({ q: '%%' })).toEqual([]);
      expect(await search({ q: '__' })).toEqual([]);
      expect(await search({ q: '\\\\' })).toEqual([]);
    });

    it('rejeita parâmetros inválidos com 400', async () => {
      for (const query of [
        {},
        { q: 'a' },
        { q: '   a   ' },
        { q: 'to', limit: 0 },
        { q: 'to', limit: 51 },
        { q: 'to', limit: 'x' },
        { q: 'to', uf: 'P1' },
        { q: 'x'.repeat(61) },
      ]) {
        await http().get('/cities').query(query).expect(400);
      }
    });

    it('traz Cache-Control público', async () => {
      const response = await http()
        .get('/cities')
        .query({ q: 'toledo' })
        .expect(200);
      expect(response.headers['cache-control']).toBe(CACHE);
    });
  });

  describe('GET /cities/:id', () => {
    it('devolve a cidade com a UF', async () => {
      const response = await http().get('/cities/5300108').expect(200);
      expect(response.body).toEqual({
        id: 5300108,
        name: 'Brasília',
        uf: 'DF',
      });
      expect(response.headers['cache-control']).toBe(CACHE);
    });

    it('inexistente 404, não numérico 400', async () => {
      await http().get('/cities/9999999').expect(404);
      await http().get('/cities/-1').expect(404);
      await http().get('/cities/99999999999').expect(404);
      await http().get('/cities/abc').expect(400);
    });
  });

  describe('Cache-Control em erros', () => {
    afterEach(() => vi.restoreAllMocks());

    it('404 e 400 saem com no-store, nunca com cache público', async () => {
      for (const url of [
        '/cities/9999999',
        '/cities/abc',
        '/states/XX/cities',
        '/states/P1/cities',
        '/cities?q=a',
      ]) {
        const response = await http().get(url);
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.headers['cache-control']).toBe(ERROR_CACHE);
      }
    });

    it('500 (ex.: Postgres fora do ar) sai com no-store', async () => {
      vi.spyOn(app.get(GeoService), 'findCity').mockRejectedValueOnce(
        new QueryFailedError('SELECT 1', [], new Error('conexão perdida')),
      );
      const response = await http().get('/cities/5300108').expect(500);
      expect(response.headers['cache-control']).toBe(ERROR_CACHE);
    });
  });

  describe('GET /cities/all', () => {
    it('devolve a base completa em formato compacto com ETag', async () => {
      const response = await http().get('/cities/all').expect(200);
      const bundle = response.body as CitiesBundleView;
      expect(bundle.version).toBe('2026-10');
      expect(bundle.states).toHaveLength(27);
      expect(bundle.cities).toHaveLength(5571);
      expect(bundle.states).toContainEqual([41, 'PR', 'Paraná']);
      expect(bundle.cities).toContainEqual([CITY_TOLEDO_PR, 41, 'Toledo']);
      expect(response.headers.etag).toBe('"ibge-2026-10"');
      expect(response.headers['cache-control']).toBe(CACHE);
    });

    it('é consistente com o banco', async () => {
      const bundle = (await http().get('/cities/all').expect(200))
        .body as CitiesBundleView;
      expect(bundle.states).toHaveLength(await count('states'));
      expect(bundle.cities).toHaveLength(await count('cities'));
    });

    it('responde 304 sem corpo quando If-None-Match bate', async () => {
      const response = await http()
        .get('/cities/all')
        .set('If-None-Match', '"ibge-2026-10"')
        .expect(304);
      expect(response.text ?? '').toBe('');
      expect(response.headers.etag).toBe('"ibge-2026-10"');
      expect(response.headers['cache-control']).toBe(CACHE);
    });

    it('responde 200 quando o ETag do app é de outra versão', async () => {
      await http()
        .get('/cities/all')
        .set('If-None-Match', '"ibge-2026-04"')
        .expect(200);
    });
  });

  describe('seed (migration)', () => {
    it('é idempotente e devolve ao IBGE um nome alterado à mão', async () => {
      const dataSource = app.get(DataSource);
      const snapshot = loadIbgeSnapshot(CURRENT_IBGE_SNAPSHOT);
      await dataSource.query(
        `UPDATE cities SET name = 'X', "searchName" = 'x' WHERE id = $1`,
        [CITY_TOLEDO_PR],
      );

      await seedIbge(dataSource, snapshot);

      expect(await count('states')).toBe(27);
      expect(await count('cities')).toBe(5571);
      const response = await http()
        .get(`/cities/${CITY_TOLEDO_PR}`)
        .expect(200);
      expect(response.body.name).toBe('Toledo');
      expect(await search({ q: 'toledo', uf: 'PR' })).toHaveLength(1);
    });
  });
});
