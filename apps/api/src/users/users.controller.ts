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
import { AddMemberDto, UpdateMemberDto } from './dto.js';
import { MembersService } from './members.service.js';

@ApiTags('users')
@ApiHeader({ name: 'X-Tenant-Id', required: true })
@UseGuards(TenantGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  list(@CurrentTenant() tenant: Tenant) {
    return this.members.list(tenant.id);
  }

  @Get(':id')
  findOne(
    @CurrentTenant() tenant: Tenant,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.members.findOne(tenant.id, id);
  }

  @Post()
  add(@CurrentTenant() tenant: Tenant, @Body() dto: AddMemberDto) {
    return this.members.add(tenant.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenant: Tenant,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.members.update(tenant.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentTenant() tenant: Tenant,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.members.remove(tenant.id, id);
  }
}
