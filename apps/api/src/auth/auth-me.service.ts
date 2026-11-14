import { Injectable } from '@nestjs/common';
import type { MeResponse } from '@at-field/dto';
import { DataSource } from 'typeorm';
import { Membership } from '../memberships/entities/membership.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthMeService {
  constructor(private readonly dataSource: DataSource) {}

  // Vínculos em todos os status; contas excluídas ficam de fora (o find
  // ignora soft delete na relação). Sem CPF nem firebaseUid na resposta.
  async describe(user: User): Promise<MeResponse> {
    const memberships = await this.dataSource.getRepository(Membership).find({
      where: { userId: user.id },
      relations: { tenant: true, role: true },
      order: { createdAt: 'ASC' },
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      cityId: user.cityId,
      memberships: memberships
        .filter((membership) => membership.tenant)
        .map((membership) => ({
          tenant: {
            id: membership.tenant.id,
            name: membership.tenant.name,
            documentType: membership.tenant.documentType,
          },
          status: membership.status,
          role: { id: membership.role.id, name: membership.role.name },
        })),
    };
  }
}
