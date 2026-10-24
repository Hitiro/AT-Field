import { type IbgeSnapshot, toCityRows } from './snapshot';

type Runner = { query(sql: string, params?: unknown[]): Promise<unknown> };

// Carrega (upsert) um retrato do IBGE em states e cities. Idempotente: rodar
// de novo não muda as contagens e devolve ao IBGE um nome alterado à mão.
// Nunca apaga: users.cityId referencia cities.
export async function seedIbge(runner: Runner, snapshot: IbgeSnapshot) {
  for (const [id, uf, name] of snapshot.states) {
    await runner.query(
      `INSERT INTO "states" ("id", "uf", "name") VALUES ($1, $2, $3)
       ON CONFLICT ("id") DO UPDATE SET "uf" = EXCLUDED."uf", "name" = EXCLUDED."name"`,
      [id, uf, name],
    );
  }

  const rows = toCityRows(snapshot);
  await runner.query(
    `INSERT INTO "cities" ("id", "stateId", "name", "searchName")
     SELECT * FROM unnest($1::int[], $2::int[], $3::varchar[], $4::varchar[])
     ON CONFLICT ("id") DO UPDATE SET
       "stateId" = EXCLUDED."stateId",
       "name" = EXCLUDED."name",
       "searchName" = EXCLUDED."searchName"`,
    [
      rows.map((row) => row.id),
      rows.map((row) => row.stateId),
      rows.map((row) => row.name),
      rows.map((row) => row.searchName),
    ],
  );
}
