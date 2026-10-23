import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/current-tenant.decorator.js';
import { TenantGuard } from '../common/tenant.guard.js';
import { SignupDto, UpdateTenantDto } from './dto.js';
import { Tenant } from './entities/tenant.entity.js';
import { TenantsService } from './tenants.service.js';

@ApiTags('tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  // Público: cria a conta (CPF ou CNPJ) e o primeiro usuário (owner).
  @Post()
  signup(@Body() dto: SignupDto) {
    return this.tenants.signup(dto);
  }

  @Get('current')
  @ApiHeader({ name: 'X-Tenant-Id', required: true })
  @UseGuards(TenantGuard)
  current(@CurrentTenant() tenant: Tenant) {
    return tenant;
  }

  @Patch('current')
  @ApiHeader({ name: 'X-Tenant-Id', required: true })
  @UseGuards(TenantGuard)
  update(@CurrentTenant() tenant: Tenant, @Body() dto: UpdateTenantDto) {
    return this.tenants.update(tenant, dto);
  }
}
