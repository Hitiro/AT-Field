import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { validateEnv } from '../config/env';
import { buildDataSourceOptions } from './typeorm.config';

// Usado apenas pelo CLI do TypeORM (migrations). Execute a partir de apps/api.
if (existsSync('.env')) process.loadEnvFile('.env');

export default new DataSource(buildDataSourceOptions(validateEnv(process.env)));
