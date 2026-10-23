import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/current-tenant.decorator.js';
import { TenantGuard } from '../common/tenant.guard.js';
import { Tenant } from '../tenants/entities/tenant.entity.js';
import { CreateRoleDto, UpdateRoleDto } from './dto.js';
import { RolesService } from './roles.service.js';

@ApiTags('roles')
@ApiHeader({ name: 'X-Tenant-Id', required: true })
@UseGuards(TenantGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  list(@CurrentTenant() tenant: Tenant) {
    return this.roles.list(tenant.id);
  }

  @Get(':id')
  findOne(
    @CurrentTenant() tenant: Tenant,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.roles.findOne(tenant.id, id);
  }

  @Post()
  create(@CurrentTenant() tenant: Tenant, @Body() dto: CreateRoleDto) {
    return this.roles.create(tenant.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenant: Tenant,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.roles.update(tenant.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentTenant() tenant: Tenant,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.roles.remove(tenant.id, id);
  }
}
