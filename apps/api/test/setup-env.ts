import { existsSync } from 'node:fs';

// Os testes e2e usam um banco separado: <DATABASE_NAME>_test.
if (existsSync('.env')) process.loadEnvFile('.env');

process.env.NODE_ENV = 'test';
// Log em JSON (os testes de log parseiam as linhas) e só erros, para não
// poluir a saída; quem testa log liga os níveis com setLogLevels.
process.env.LOG_FORMAT ??= 'json';
process.env.LOG_LEVEL ??= 'error';
const database = process.env.DATABASE_NAME ?? 'at_field';
if (!database.endsWith('_test')) {
  process.env.DATABASE_NAME = `${database}_test`;
}
