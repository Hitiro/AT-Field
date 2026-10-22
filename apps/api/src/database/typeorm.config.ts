import type { DataSourceOptions } from 'typeorm';
import type { Env } from '../config/env';
import { City } from '../geo/entities/city.entity';
import { State } from '../geo/entities/state.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { Permission } from '../roles/entities/permission.entity';
import { Role } from '../roles/entities/role.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';

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
  migrations: [`${__dirname}/migrations/*.{ts,js}`],
  synchronize: false,
});
