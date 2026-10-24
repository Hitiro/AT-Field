import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OWNER_ROLE } from '@at-field/dto';
import type { Signup, UpdateTenant } from '@at-field/dto';
import { DataSource, Repository } from 'typeorm';
import { Membership } from '../memberships/entities/membership.entity';
import { RolesService } from '../roles/roles.service';
import { toMemberView } from '../users/members.service';
import { resolvePerson } from '../users/people';
import { Tenant } from './entities/tenant.entity';

@Injectable()
export class TenantsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly roles: RolesService,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
  ) {}

  // Auto-cadastro: conta + pessoa (nova ou existente) + vínculo owner ativo.
  signup(input: Signup) {
    return this.dataSource.transaction(async (manager) => {
      const documentTaken = await manager.exists(Tenant, {
        where: { document: input.tenant.document },
        withDeleted: true,
      });
      if (documentTaken) {
        throw new ConflictException('Já existe uma conta com este documento');
      }

      const user = await resolvePerson(manager, input.owner);
      const tenant = await manager.save(manager.create(Tenant, input.tenant));
      const roles = await this.roles.createSystemRoles(manager, tenant.id);

      const membership = await manager.save(
        manager.create(Membership, {
          tenantId: tenant.id,
          userId: user.id,
          roleId: roles[OWNER_ROLE].id,
          status: 'active',
        }),
      );
      membership.user = user;
      membership.role = roles[OWNER_ROLE];

      return { tenant, owner: toMemberView(membership) };
    });
  }

  update(tenant: Tenant, dto: UpdateTenant) {
    tenant.name = dto.name;
    return this.tenants.save(tenant);
  }
}
