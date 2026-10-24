import { existsSync } from 'node:fs';

// Os testes e2e usam um banco separado: <DATABASE_NAME>_test.
if (existsSync('.env')) process.loadEnvFile('.env');

process.env.NODE_ENV = 'test';
const database = process.env.DATABASE_NAME ?? 'at_field';
if (!database.endsWith('_test')) {
  process.env.DATABASE_NAME = `${database}_test`;
}
