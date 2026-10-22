import { execSync } from 'node:child_process';
import { Client } from 'pg';
import './setup-env';

// Cria o banco de teste se não existir e aplica as migrations.
export default async function globalSetup() {
  const database = process.env.DATABASE_NAME as string;
  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: 'postgres',
  });

  await client.connect();
  const { rowCount } = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [database],
  );
  if (!rowCount) await client.query(`CREATE DATABASE "${database}"`);
  await client.end();

  execSync('pnpm typeorm migration:run', {
    env: process.env,
    stdio: 'ignore',
  });
}
