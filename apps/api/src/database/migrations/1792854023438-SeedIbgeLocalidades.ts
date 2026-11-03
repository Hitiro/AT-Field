import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedIbge } from '../../geo/ibge/seed';
import { loadIbgeSnapshot } from '../../geo/ibge/snapshot';

// Carrega o retrato do IBGE de 2026-10 (27 UFs, 5.571 municípios) e cria a
// coluna de busca. O arquivo de dados é fixo aqui: atualizar a base é gerar um
// retrato novo e criar outra migration que chame seedIbge com ele.
export class SeedIbgeLocalidades1792854023438 implements MigrationInterface {
  name = 'SeedIbgeLocalidades1792854023438';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cities" ADD "searchName" character varying(120)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ded8a17cd090922d5bac8a2361" ON "cities"  ("stateId") `,
    );
    await seedIbge(queryRunner, loadIbgeSnapshot('localidades-2026-10.json'));
    // Linhas cadastradas à mão fora do IBGE (não deveriam existir).
    await queryRunner.query(
      `UPDATE "cities" SET "searchName" = lower("name") WHERE "searchName" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "cities" ALTER COLUMN "searchName" SET NOT NULL`,
    );
  }

  // Remove só a estrutura; os dados do IBGE ficam (users.cityId os referencia).
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ded8a17cd090922d5bac8a2361"`,
    );
    await queryRunner.query(`ALTER TABLE "cities" DROP COLUMN "searchName"`);
  }
}
