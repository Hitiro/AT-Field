import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesModule } from '../roles/roles.module.js';
import { Tenant } from './entities/tenant.entity.js';
import { TenantsController } from './tenants.controller.js';
import { TenantsService } from './tenants.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), RolesModule],
  controllers: [TenantsController],
  providers: [TenantsService],
})
export class TenantsModule {}
