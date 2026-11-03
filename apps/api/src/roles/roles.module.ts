import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membership } from '../memberships/entities/membership.entity';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { PermissionsController } from './permissions.controller';
import { PermissionsSyncService } from './permissions-sync.service';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, Membership])],
  controllers: [RolesController, PermissionsController],
  providers: [RolesService, PermissionsSyncService],
  exports: [RolesService],
})
export class RolesModule {}
