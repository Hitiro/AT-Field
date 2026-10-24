import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeName } from '../normalize-name';
import {
  CURRENT_IBGE_SNAPSHOT,
  loadIbgeSnapshot,
  toCityRows,
} from './snapshot';

// Valida o arquivo commitado, não uma cópia: se o retrato for regerado com
// problema, estes testes quebram antes da migration.
describe('retrato IBGE commitado', () => {
  const snapshot = loadIbgeSnapshot(CURRENT_IBGE_SNAPSHOT);
  const stateIds = new Set(snapshot.states.map(([id]) => id));

  it('tem versão tirada do nome do arquivo', () => {
    expect(snapshot.version).toBe('2026-10');
  });

  it('tem 27 UFs com sigla única', () => {
    expect(snapshot.states).toHaveLength(27);
    expect(new Set(snapshot.states.map(([, uf]) => uf)).size).toBe(27);
  });

  it('tem 5.571 municípios com código IBGE único de 7 dígitos', () => {
    const ids = snapshot.cities.map(([id]) => id);
    expect(ids).toHaveLength(5571);
    expect(new Set(ids).size).toBe(5571);
    expect(ids.every((id) => id >= 1000000 && id <= 9999999)).toBe(true);
  });

  it('o prefixo do código é a UF, e a UF existe', () => {
    for (const [id, stateId] of snapshot.cities) {
      expect(Math.floor(id / 100000)).toBe(stateId);
      expect(stateIds.has(stateId)).toBe(true);
    }
  });

  it('nomes têm de 1 a 120 caracteres', () => {
    for (const [, , name] of snapshot.cities) {
      expect(name.trim().length).toBeGreaterThan(0);
      expect(name.length).toBeLessThanOrEqual(120);
    }
  });

  it('não repete nome normalizado dentro da mesma UF', () => {
    const keys = snapshot.cities.map(
      ([, stateId, name]) => `${stateId}:${normalizeName(name)}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('contém os municípios de referência', () => {
    const byId = new Map(snapshot.cities.map((city) => [city[0], city]));
    expect(byId.get(5300108)).toEqual([5300108, 53, 'Brasília']);
    expect(byId.get(4127700)).toEqual([4127700, 41, 'Toledo']);
    expect(byId.get(3169109)).toEqual([3169109, 31, 'Toledo']);
    expect(byId.get(3510005)).toEqual([3510005, 35, 'Cândido Mota']);
    expect(byId.get(5101837)).toEqual([5101837, 51, 'Boa Esperança do Norte']);
  });

  it('é o mesmo arquivo usado pela última migration de seed', () => {
    const dir = join(__dirname, '..', '..', 'database', 'migrations');
    const used = readdirSync(dir)
      .sort()
      .flatMap((file) => {
        const source = readFileSync(join(dir, file), 'utf8');
        const match = /loadIbgeSnapshot\('([^']+)'\)/.exec(source);
        return match ? [match[1]] : [];
      });
    expect(used.at(-1)).toBe(CURRENT_IBGE_SNAPSHOT);
  });
});

describe('loadIbgeSnapshot', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ibge-'));
  const valid = {
    source: 'teste',
    generatedAt: '2026-10-24',
    states: [[41, 'PR', 'Paraná']],
    cities: [[4127700, 41, 'Toledo']],
  };
  const write = (name: string, content: unknown) =>
    writeFileSync(join(dir, name), JSON.stringify(content));

  it('lê um retrato válido', () => {
    write('localidades-2027-01.json', valid);
    expect(loadIbgeSnapshot('localidades-2027-01.json', dir)).toMatchObject({
      version: '2027-01',
      cities: [[4127700, 41, 'Toledo']],
    });
  });

  it('rejeita arquivo malformado', () => {
    write('localidades-2027-02.json', {
      ...valid,
      cities: [[4127700, 'PR', 'Toledo']],
    });
    expect(() => loadIbgeSnapshot('localidades-2027-02.json', dir)).toThrow();

    write('localidades-2027-03.json', { ...valid, cities: [[123, 41, 'X']] });
    expect(() => loadIbgeSnapshot('localidades-2027-03.json', dir)).toThrow();

    write('localidades-2027-04.json', { ...valid, states: [] });
    expect(() => loadIbgeSnapshot('localidades-2027-04.json', dir)).toThrow();

    writeFileSync(join(dir, 'localidades-2027-05.json'), '{ nao é json');
    expect(() => loadIbgeSnapshot('localidades-2027-05.json', dir)).toThrow();
  });

  it('rejeita nome de arquivo fora do padrão', () => {
    write('outro.json', valid);
    expect(() => loadIbgeSnapshot('outro.json', dir)).toThrow(
      /Nome de retrato/,
    );
  });
});

describe('toCityRows', () => {
  it('gera searchName normalizado', () => {
    const rows = toCityRows({
      source: 'teste',
      generatedAt: '2026-10-24',
      version: '2026-10',
      states: [],
      cities: [
        [3510005, 35, 'Cândido Mota'],
        [1100015, 11, "Alta Floresta D'Oeste"],
      ],
    });
    expect(rows).toEqual([
      {
        id: 3510005,
        stateId: 35,
        name: 'Cândido Mota',
        searchName: 'candido mota',
      },
      {
        id: 1100015,
        stateId: 11,
        name: "Alta Floresta D'Oeste",
        searchName: "alta floresta d'oeste",
      },
    ]);
  });
});
