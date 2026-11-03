import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { normalizeName } from '../normalize-name';

// Retrato mais recente da base do IBGE, o mesmo aplicado pela última migration
// de seed (conferido em snapshot.spec.ts). Serve GET /cities/all.
export const CURRENT_IBGE_SNAPSHOT = 'localidades-2026-10.json';

const FILE_PATTERN = /^localidades-(\d{4}-\d{2})\.json$/;

const snapshotSchema = z.object({
  source: z.string(),
  generatedAt: z.string(),
  states: z
    .array(
      z.tuple([
        z.number().int().min(10).max(99),
        z.string().regex(/^[A-Z]{2}$/),
        z.string().min(1).max(60),
      ]),
    )
    .min(1),
  cities: z
    .array(
      z.tuple([
        z.number().int().min(1000000).max(9999999),
        z.number().int().min(10).max(99),
        z.string().min(1).max(120),
      ]),
    )
    .min(1),
});

export type IbgeSnapshot = z.output<typeof snapshotSchema> & {
  // Ano-mês do retrato, tirado do nome do arquivo (ex.: '2026-10').
  version: string;
};

export type CityRow = {
  id: number;
  stateId: number;
  name: string;
  searchName: string;
};

// Lê um retrato de src/geo/ibge/data (ou dist/..., copiado pelo nest-cli).
export function loadIbgeSnapshot(
  fileName: string,
  dir = join(__dirname, 'data'),
): IbgeSnapshot {
  const match = FILE_PATTERN.exec(fileName);
  if (!match) throw new Error(`Nome de retrato IBGE inválido: ${fileName}`);
  const raw: unknown = JSON.parse(readFileSync(join(dir, fileName), 'utf8'));
  return { ...snapshotSchema.parse(raw), version: match[1] };
}

export function toCityRows(snapshot: IbgeSnapshot): CityRow[] {
  return snapshot.cities.map(([id, stateId, name]) => ({
    id,
    stateId,
    name,
    searchName: normalizeName(name),
  }));
}
