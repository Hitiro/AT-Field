import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PgErrorFilter } from './common/pg-error.filter';
import { Env, validateEnv } from './config/env';
import { buildDataSourceOptions } from './database/typeorm.config';
import { GeoModule } from './geo/geo.module';
import { RolesModule } from './roles/roles.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        buildDataSourceOptions({
          NODE_ENV: config.get('NODE_ENV'),
          PORT: config.get('PORT'),
          DATABASE_HOST: config.get('DATABASE_HOST'),
          DATABASE_PORT: config.get('DATABASE_PORT'),
          DATABASE_USER: config.get('DATABASE_USER'),
          DATABASE_PASSWORD: config.get('DATABASE_PASSWORD'),
          DATABASE_NAME: config.get('DATABASE_NAME'),
        }),
    }),
    GeoModule,
    RolesModule,
    TenantsModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: PgErrorFilter },
  ],
})
export class AppModule {}
