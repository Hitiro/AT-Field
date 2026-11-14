import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import type { VerifiedIdentity } from '../auth/auth-provider';
import { AllowUnregistered } from '../auth/allow-unregistered.decorator';
import { CurrentIdentity } from '../auth/current-user.decorator';
import { CurrentTenant } from '../common/current-tenant.decorator';
import { TenantGuard } from '../common/tenant.guard';
import { SignupDto, UpdateTenantDto } from './dto';
import { Tenant } from './entities/tenant.entity';
import { TenantsService } from './tenants.service';

@ApiTags('tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  // Auto-cadastro: cria a conta (CPF ou CNPJ) e o primeiro usuário (owner),
  // ligado à conta de acesso do token. Exige token com e-mail verificado e
  // igual ao do owner; aceita quem ainda não existe no banco.
  @Post()
  @AllowUnregistered()
  signup(
    @Body() dto: SignupDto,
    @CurrentIdentity() identity: VerifiedIdentity,
  ) {
    return this.tenants.signup(dto, identity);
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
