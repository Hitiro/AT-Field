import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type {
  CitiesBundleView,
  CitySearch,
  CityView,
  StateView,
} from '@at-field/dto';
import { DataSource } from 'typeorm';
import { City } from './entities/city.entity';
import { State } from './entities/state.entity';
import { CURRENT_IBGE_SNAPSHOT, loadIbgeSnapshot } from './ibge/snapshot';
import { normalizeName } from './normalize-name';

const MAX_INT = 2_147_483_647;

// Escapa os curingas do LIKE (\ % _) para usar com ESCAPE '\'.
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// If-None-Match pode trazer vários ETags, fracos (W/) ou '*'.
export function matchesEtag(header: string | undefined, etag: string) {
  if (!header) return false;
  return header
    .split(',')
    .map((tag) => tag.trim().replace(/^W\//, ''))
    .some((tag) => tag === '*' || tag === etag);
}

export type CitiesBundle = { etag: string; body: CitiesBundleView };

// Base IBGE de estados e cidades: referência global, só leitura, sem tenant.
@Injectable()
export class GeoService {
  private bundle?: CitiesBundle;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async listStates(): Promise<StateView[]> {
    const states = await this.dataSource
      .getRepository(State)
      .find({ select: { id: true, uf: true, name: true } });
    // Ordena pelo nome sem acento: o Postgres (alpine/musl) compara por byte
    // e jogaria nomes acentuados para posições erradas.
    return states
      .map(({ id, uf, name }) => ({ id, uf, name }))
      .sort(
        (a, b) =>
          normalizeName(a.name).localeCompare(normalizeName(b.name)) ||
          a.name.localeCompare(b.name),
      );
  }

  async listCitiesByUf(uf: string): Promise<CityView[]> {
    const state = await this.dataSource.getRepository(State).findOneBy({ uf });
    if (!state) throw new NotFoundException('UF inexistente');
    const cities = await this.dataSource
      .getRepository(City)
      .createQueryBuilder('c')
      .select(['c.id', 'c.name'])
      .where('c.stateId = :stateId', { stateId: state.id })
      .orderBy('c.searchName')
      .addOrderBy('c.name')
      .getMany();
    return cities.map(({ id, name }) => ({ id, name, uf: state.uf }));
  }

  // Exato > começa com > contém; homônimos sempre com a UF, desempate por UF.
  async search({ q, uf, limit }: CitySearch): Promise<CityView[]> {
    const term = normalizeName(q);
    if (term.length < 2) return [];
    const params: unknown[] = [term, escapeLike(term), limit];
    const byUf = uf ? `AND s."uf" = $${params.push(uf)}` : '';
    const rows: CityView[] = await this.dataSource.query(
      `SELECT c."id", c."name", s."uf"
         FROM "cities" c
         JOIN "states" s ON s."id" = c."stateId"
        WHERE c."searchName" LIKE '%' || $2 || '%' ESCAPE '\\' ${byUf}
        ORDER BY (c."searchName" = $1) DESC,
                 (c."searchName" LIKE $2 || '%' ESCAPE '\\') DESC,
                 c."searchName", s."uf"
        LIMIT $3`,
      params,
    );
    return rows.map(({ id, name, uf: cityUf }) => ({ id, name, uf: cityUf }));
  }

  async findCity(id: number): Promise<CityView> {
    // Fora do intervalo de int do Postgres não existe (e não pode virar 500).
    const city =
      id > 0 && id <= MAX_INT
        ? await this.dataSource.getRepository(City).findOne({
            where: { id },
            relations: { state: true },
          })
        : null;
    if (!city) throw new NotFoundException('Cidade inexistente');
    return { id: city.id, name: city.name, uf: city.state.uf };
  }

  // Base completa servida do retrato em memória (o mesmo arquivo aplicado
  // pela última migration de seed), sem consultar o banco.
  getBundle(): CitiesBundle {
    if (!this.bundle) {
      const snapshot = loadIbgeSnapshot(CURRENT_IBGE_SNAPSHOT);
      this.bundle = {
        etag: `"ibge-${snapshot.version}"`,
        body: {
          version: snapshot.version,
          states: snapshot.states,
          cities: snapshot.cities,
        },
      };
    }
    return this.bundle;
  }
}
