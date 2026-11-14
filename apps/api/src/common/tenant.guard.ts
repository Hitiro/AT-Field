import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import type { AuthRequest } from '../auth/auth.types';
import { Membership } from '../memberships/entities/membership.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { AppException } from './errors/app.exception';
import { requestContext } from './logging/request-context';

export const TENANT_HEADER = 'x-tenant-id';

export type TenantRequest = AuthRequest & {
  tenant: Tenant;
  membership: Membership;
};

const uuidSchema = z.uuid();

// Resolve a conta ativa a partir do header X-Tenant-Id e exige que a pessoa
// autenticada (AuthGuard, global, roda antes) tenha vínculo ATIVO nela.
// Conta inexistente, inativa, excluída, sem vínculo ou com vínculo convidado
// ou suspenso respondem igual (TEN-002): a resposta não revela que a conta
// existe. Até o passo 009b (permissões), qualquer vínculo ativo opera tudo.
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    const header = request.headers[TENANT_HEADER];
    const tenantId = Array.isArray(header) ? header[0] : header;

    if (!tenantId || !uuidSchema.safeParse(tenantId).success) {
      throw new AppException('TEN-001');
    }

    const userId = request.auth?.user?.id;
    // Uma consulta: vínculo + conta + papel. withDeleted para trazer a conta
    // excluída e recusá-la explicitamente abaixo.
    const membership = userId
      ? await this.dataSource.getRepository(Membership).findOne({
          where: { userId, tenantId },
          relations: { tenant: true, role: true },
          withDeleted: true,
        })
      : null;

    const tenant = membership?.tenant;
    if (
      !membership ||
      membership.status !== 'active' ||
      !tenant ||
      !tenant.isActive ||
      tenant.deletedAt
    ) {
      throw new AppException('TEN-002');
    }

    request.tenant = tenant;
    request.membership = membership;
    // A partir daqui os logs da requisição levam o tenantId.
    requestContext.setTenantId(tenant.id);
    return true;
  }
}
