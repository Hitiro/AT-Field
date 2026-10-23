import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SYSTEM_ROLES } from '@at-field/dto';
import type { CreateRole, UpdateRole } from '@at-field/dto';
import { EntityManager, In, Repository } from 'typeorm';
import { Membership } from '../memberships/entities/membership.entity.js';
import { Permission } from './entities/permission.entity.js';
import { Role } from './entities/role.entity.js';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissions: Repository<Permission>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
  ) {}

  async createSystemRoles(
    manager: EntityManager,
    tenantId: string,
  ): Promise<Record<string, Role>> {
    const permissions = await manager.find(Permission);
    const byKey = new Map(permissions.map((p) => [p.key, p]));
    const created: Record<string, Role> = {};

    for (const [name, keys] of Object.entries(SYSTEM_ROLES)) {
      created[name] = await manager.save(
        manager.create(Role, {
          tenantId,
          name,
          isSystem: true,
          permissions: keys
            .map((key) => byKey.get(key))
            .filter((p): p is Permission => p !== undefined),
        }),
      );
    }
    return created;
  }

  listPermissions() {
    return this.permissions.find({ order: { key: 'ASC' } });
  }

  list(tenantId: string) {
    return this.roles.find({
      where: { tenantId },
      relations: { permissions: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const role = await this.roles.findOne({
      where: { id, tenantId },
      relations: { permissions: true },
    });
    if (!role) throw new NotFoundException('Papel não encontrado');
    return role;
  }

  async create(tenantId: string, dto: CreateRole) {
    await this.assertNameAvailable(tenantId, dto.name);
    const permissions = await this.resolvePermissions(dto.permissions);
    return this.roles.save(
      this.roles.create({ tenantId, name: dto.name, permissions }),
    );
  }

  async update(tenantId: string, id: string, dto: UpdateRole) {
    const role = await this.findOne(tenantId, id);
    if (role.isSystem) {
      throw new ConflictException('Papel de sistema não pode ser alterado');
    }
    if (dto.name !== undefined && dto.name !== role.name) {
      await this.assertNameAvailable(tenantId, dto.name);
      role.name = dto.name;
    }
    if (dto.permissions !== undefined) {
      role.permissions = await this.resolvePermissions(dto.permissions);
    }
    return this.roles.save(role);
  }

  async remove(tenantId: string, id: string) {
    const role = await this.findOne(tenantId, id);
    if (role.isSystem) {
      throw new ConflictException('Papel de sistema não pode ser excluído');
    }
    if (await this.memberships.existsBy({ roleId: id })) {
      throw new ConflictException('Papel em uso por usuários da conta');
    }
    await this.roles.remove(role);
  }

  private async assertNameAvailable(tenantId: string, name: string) {
    if (await this.roles.existsBy({ tenantId, name })) {
      throw new ConflictException('Já existe um papel com este nome');
    }
  }

  private async resolvePermissions(keys: string[]) {
    const unique = [...new Set(keys)];
    if (unique.length === 0) return [];
    const found = await this.permissions.findBy({ key: In(unique) });
    if (found.length !== unique.length) {
      const known = new Set(found.map((p) => p.key));
      const invalid = unique.filter((key) => !known.has(key));
      throw new BadRequestException(
        `Permissões inválidas: ${invalid.join(', ')}`,
      );
    }
    return found;
  }
}
