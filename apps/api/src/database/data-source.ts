import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { validateDatabaseEnv } from '../config/env';
import { buildDataSourceOptions } from './typeorm.config';

// Usado apenas pelo CLI do TypeORM (migrations). Execute a partir de apps/api.
// Valida só as variáveis do banco (o CLI não precisa do Firebase).
if (existsSync('.env')) process.loadEnvFile('.env');

export default new DataSource(
  buildDataSourceOptions(validateDatabaseEnv(process.env)),
);
