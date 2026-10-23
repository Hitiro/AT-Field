import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Person } from '@at-field/dto';
import { EntityManager } from 'typeorm';
import { City } from '../geo/entities/city.entity';
import { User } from './entities/user.entity';

// Encontra a pessoa pelo CPF ou cria uma nova. Uma pessoa existe uma única
// vez no sistema, mesmo atuando em vários tenants.
export async function resolvePerson(
  manager: EntityManager,
  person: Person,
): Promise<User> {
  const byCpf = await manager.findOne(User, {
    where: { cpf: person.cpf },
    withDeleted: true,
  });

  if (byCpf) {
    if (byCpf.deletedAt || !byCpf.isActive) {
      throw new ConflictException('Usuário desativado');
    }
    if (byCpf.email !== person.email) {
      throw new ConflictException('CPF já cadastrado com outro e-mail');
    }
    return byCpf;
  }

  const emailTaken = await manager.exists(User, {
    where: { email: person.email },
    withDeleted: true,
  });
  if (emailTaken) {
    throw new ConflictException('E-mail já cadastrado para outro CPF');
  }

  if (
    person.cityId !== undefined &&
    !(await manager.existsBy(City, { id: person.cityId }))
  ) {
    throw new BadRequestException('Cidade inexistente');
  }

  return manager.save(
    manager.create(User, {
      cpf: person.cpf,
      name: person.name,
      email: person.email,
      phone: person.phone ?? null,
      cityId: person.cityId ?? null,
    }),
  );
}
