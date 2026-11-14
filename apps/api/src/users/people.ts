import type { Person } from '@at-field/dto';
import { EntityManager } from 'typeorm';
import type { VerifiedIdentity } from '../auth/auth-provider';
import { accessLinkedToAnother, linkFirebaseUid } from '../auth/identity-link';
import { AppException } from '../common/errors/app.exception';
import { City } from '../geo/entities/city.entity';
import { User } from './entities/user.entity';

// Encontra a pessoa pelo CPF ou cria uma nova. Uma pessoa existe uma única
// vez no sistema, mesmo atuando em vários tenants.
// Com `identity` (auto-cadastro, passo 009a), a pessoa fica ligada à conta de
// acesso: criada já com o firebaseUid ou vinculada se ainda não tiver um. O
// e-mail do token já foi conferido com o do owner (assertSignupIdentity).
export async function resolvePerson(
  manager: EntityManager,
  person: Person,
  identity?: VerifiedIdentity,
): Promise<User> {
  if (identity) {
    // A conta de acesso já é de uma pessoa: só serve para o CPF dela.
    const linked = await manager.findOne(User, {
      where: { firebaseUid: identity.uid },
      withDeleted: true,
    });
    if (linked && linked.cpf !== person.cpf) throw accessLinkedToAnother();
  }

  const byCpf = await manager.findOne(User, {
    where: { cpf: person.cpf },
    withDeleted: true,
  });

  if (byCpf) {
    if (byCpf.deletedAt || !byCpf.isActive) {
      throw new AppException('USR-001');
    }
    if (byCpf.email !== person.email) throw new AppException('USR-002');
    return identity ? linkFirebaseUid(manager, byCpf, identity) : byCpf;
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
      firebaseUid: identity?.uid ?? null,
    }),
  );
}
