import type { Person } from '@at-field/dto';
import { EntityManager } from 'typeorm';
import { AppException } from '../common/errors/app.exception';
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
      throw new AppException('USR-001');
    }
    if (byCpf.email !== person.email) throw new AppException('USR-002');
    return byCpf;
  }

  const emailTaken = await manager.exists(User, {
    where: { email: person.email },
    withDeleted: true,
  });
  if (emailTaken) throw new AppException('USR-003');

  if (
    person.cityId !== undefined &&
    !(await manager.existsBy(City, { id: person.cityId }))
  ) {
    throw new AppException('USR-004');
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
