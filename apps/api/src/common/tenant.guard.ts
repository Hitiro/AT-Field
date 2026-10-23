import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { Tenant } from '../tenants/entities/tenant.entity';

export const TENANT_HEADER = 'x-tenant-id';

export type TenantRequest = Request & { tenant: Tenant };

const uuidSchema = z.uuid();

// Resolve o tenant ativo a partir do header X-Tenant-Id.
// A checagem de vínculo do usuário autenticado entra no passo do Firebase.
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    const header = request.headers[TENANT_HEADER];
    const tenantId = Array.isArray(header) ? header[0] : header;

    if (!tenantId || !uuidSchema.safeParse(tenantId).success) {
      throw new ForbiddenException('Header X-Tenant-Id ausente ou inválido');
    }

    const tenant = await this.dataSource
      .getRepository(Tenant)
      .findOneBy({ id: tenantId });
    if (!tenant || !tenant.isActive) {
      throw new ForbiddenException('Conta inexistente ou inativa');
    }

    request.tenant = tenant;
    return true;
  }
}
