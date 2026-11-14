import { EntityManager } from 'typeorm';
import { AppException } from '../common/errors/app.exception';
import { User } from '../users/entities/user.entity';
import type { VerifiedIdentity } from './auth-provider';

// Regras de vínculo entre a pessoa (users) e a conta de acesso do provedor
// (users.firebaseUid), usadas pelo AuthService (primeiro login) e pelo
// resolvePerson (auto-cadastro). Cada código AUT tem um único throw no código
// (error-codes.usage.spec.ts), por isso as fábricas abaixo.

// E-mail como gravado em users (o schema do dto faz trim + minúsculas).
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

// AUT-006: pessoa excluída ou desativada (também o 'disabled' do provedor).
export const userDisabled = (logReason?: string) =>
  new AppException('AUT-006', undefined, { logReason });

// AUT-010: a conta de acesso (uid) já pertence a outra pessoa, ou a pessoa já
// tem outra conta de acesso.
export const accessLinkedToAnother = () => new AppException('AUT-010');

// AUT-007: decisão do usuário (passo 009a): todo acesso exige e-mail
// verificado, inclusive o auto-cadastro e quem já está vinculado.
export function assertEmailVerified(identity: VerifiedIdentity) {
  if (!identity.emailVerified) throw new AppException('AUT-007');
}

// Auto-cadastro: o token precisa ter e-mail verificado (AUT-007) e o mesmo
// e-mail do owner (AUT-009), comparados sem espaços e em minúsculas.
export function assertSignupIdentity(
  identity: VerifiedIdentity,
  ownerEmail: string,
) {
  assertEmailVerified(identity);
  if (
    !identity.email ||
    normalizeEmail(identity.email) !== normalizeEmail(ownerEmail)
  ) {
    throw new AppException('AUT-009');
  }
}

// Grava o uid na pessoa, de forma atômica (só se ainda não tiver outro).
// Mesmo uid: nada a fazer. Outro uid: AUT-010.
export async function linkFirebaseUid(
  manager: EntityManager,
  user: User,
  identity: VerifiedIdentity,
): Promise<User> {
  if (user.firebaseUid === identity.uid) return user;
  if (user.firebaseUid) throw accessLinkedToAnother();

  // UPDATE no driver do Postgres devolve [linhas do RETURNING, contagem].
  const [rows] = await manager.query<[{ id: string }[], number]>(
    'UPDATE users SET "firebaseUid" = $1, "updatedAt" = now() WHERE id = $2 AND "firebaseUid" IS NULL RETURNING id',
    [identity.uid, user.id],
  );
  if (rows.length === 0) {
    // Outra requisição vinculou a pessoa entre a leitura e o UPDATE: se foi
    // com o mesmo uid (corrida do próprio usuário), segue normalmente.
    const current = await manager.findOne(User, {
      where: { id: user.id },
      withDeleted: true,
    });
    if (current?.firebaseUid !== identity.uid) throw accessLinkedToAnother();
  }

  user.firebaseUid = identity.uid;
  return user;
}
