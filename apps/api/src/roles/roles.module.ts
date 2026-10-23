import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membership } from '../memberships/entities/membership.entity.js';
import { Permission } from './entities/permission.entity.js';
import { Role } from './entities/role.entity.js';
import { PermissionsController } from './permissions.controller.js';
import { PermissionsSyncService } from './permissions-sync.service.js';
import { RolesController } from './roles.controller.js';
import { RolesService } from './roles.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, Membership])],
  controllers: [RolesController, PermissionsController],
  providers: [RolesService, PermissionsSyncService],
  exports: [RolesService],
})
export class RolesModule {}
