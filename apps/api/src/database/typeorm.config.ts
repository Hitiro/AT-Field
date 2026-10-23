import type { DataSourceOptions } from 'typeorm';
import type { Env } from '../config/env.js';
import { City } from '../geo/entities/city.entity.js';
import { State } from '../geo/entities/state.entity.js';
import { Membership } from '../memberships/entities/membership.entity.js';
import { Permission } from '../roles/entities/permission.entity.js';
import { Role } from '../roles/entities/role.entity.js';
import { Tenant } from '../tenants/entities/tenant.entity.js';
import { User } from '../users/entities/user.entity.js';

export const entities = [
  Tenant,
  User,
  Membership,
  Role,
  Permission,
  State,
  City,
];

export const buildDataSourceOptions = (env: Env): DataSourceOptions => ({
  type: 'postgres',
  host: env.DATABASE_HOST,
  port: env.DATABASE_PORT,
  username: env.DATABASE_USER,
  password: env.DATABASE_PASSWORD,
  database: env.DATABASE_NAME,
  entities,
  // Migrations rodam a partir do build (dist), pelo CLI do TypeORM.
  migrations: [`${import.meta.dirname}/migrations/*.js`],
  synchronize: false,
});
