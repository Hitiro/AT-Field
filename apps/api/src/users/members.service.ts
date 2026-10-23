import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OWNER_ROLE } from '@at-field/dto';
import type { AddMember, UpdateMember } from '@at-field/dto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Membership } from '../memberships/entities/membership.entity.js';
import { Role } from '../roles/entities/role.entity.js';
import { resolvePerson } from './people.js';

const isOwnerRole = (role: Role) => role.isSystem && role.name === OWNER_ROLE;

export const toMemberView = (membership: Membership) => ({
  id: membership.user.id,
  cpf: membership.user.cpf,
  name: membership.user.name,
  email: membership.user.email,
  phone: membership.user.phone,
  cityId: membership.user.cityId,
  isActive: membership.user.isActive,
  membership: {
    id: membership.id,
    status: membership.status,
    role: { id: membership.role.id, name: membership.role.name },
  },
});

// Usuários de um tenant = pessoas com vínculo (membership) nele.
@Injectable()
export class MembersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
  ) {}

  async list(tenantId: string) {
    const memberships = await this.memberships.find({
      where: { tenantId },
      relations: { user: true, role: true },
      order: { createdAt: 'ASC' },
    });
    return memberships.map(toMemberView);
  }

  async findOne(tenantId: string, userId: string) {
    return toMemberView(
      await this.findMembership(this.dataSource.manager, tenantId, userId),
    );
  }

  add(tenantId: string, dto: AddMember) {
    return this.dataSource.transaction(async (manager) => {
      const role = await this.findRole(manager, tenantId, dto.roleId);
      const user = await resolvePerson(manager, dto);

      if (await manager.existsBy(Membership, { tenantId, userId: user.id })) {
        throw new ConflictException('Usuário já vinculado a esta conta');
      }

      const membership = await manager.save(
        manager.create(Membership, {
          tenantId,
          userId: user.id,
          roleId: role.id,
          status: 'invited',
        }),
      );
      membership.user = user;
      membership.role = role;
      return toMemberView(membership);
    });
  }

  update(tenantId: string, userId: string, dto: UpdateMember) {
    return this.dataSource.transaction(async (manager) => {
      const membership = await this.findMembership(manager, tenantId, userId);
      const role = dto.roleId
        ? await this.findRole(manager, tenantId, dto.roleId)
        : membership.role;
      const status = dto.status ?? membership.status;

      const losesOwner =
        isOwnerRole(membership.role) &&
        membership.status === 'active' &&
        (!isOwnerRole(role) || status !== 'active');
      if (losesOwner) await this.assertNotLastOwner(manager, tenantId);

      membership.roleId = role.id;
      membership.role = role;
      membership.status = status;
      await manager.save(membership);
      return toMemberView(membership);
    });
  }

  remove(tenantId: string, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const membership = await this.findMembership(manager, tenantId, userId);
      if (isOwnerRole(membership.role) && membership.status === 'active') {
        await this.assertNotLastOwner(manager, tenantId);
      }
      await manager.delete(Membership, { id: membership.id });
    });
  }

  private async findMembership(
    manager: EntityManager,
    tenantId: string,
    userId: string,
  ) {
    const membership = await manager.findOne(Membership, {
      where: { tenantId, userId },
      relations: { user: true, role: true },
    });
    if (!membership) {
      throw new NotFoundException('Usuário não encontrado nesta conta');
    }
    return membership;
  }

  private async findRole(
    manager: EntityManager,
    tenantId: string,
    roleId: string,
  ) {
    const role = await manager.findOneBy(Role, { id: roleId, tenantId });
    if (!role) throw new BadRequestException('Papel inválido para esta conta');
    return role;
  }

  private async assertNotLastOwner(manager: EntityManager, tenantId: string) {
    const owners = await manager.count(Membership, {
      where: {
        tenantId,
        status: 'active',
        role: { name: OWNER_ROLE, isSystem: true },
      },
    });
    if (owners <= 1) {
      throw new ConflictException('A conta precisa de ao menos um owner ativo');
    }
  }
}
