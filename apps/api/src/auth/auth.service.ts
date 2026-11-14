import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppException } from '../common/errors/app.exception';
import { errorLogFields } from '../common/logging/error-log-fields';
import { User } from '../users/entities/user.entity';
import {
  AUTH_PROVIDER,
  AuthProviderError,
  type AuthProvider,
  type VerifiedIdentity,
} from './auth-provider';
import {
  assertEmailVerified,
  normalizeEmail,
  userDisabled,
} from './identity-link';

// `Bearer <token>`: esquema sem diferenciar maiúsculas (RFC 7235), espaços
// extras tolerados, token sem espaço no meio.
const BEARER = /^Bearer +(\S+)$/i;

export function extractBearer(header: unknown): string | undefined {
  if (typeof header !== 'string') return undefined;
  return BEARER.exec(header.trim())?.[1];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(AUTH_PROVIDER) private readonly provider: AuthProvider,
    private readonly dataSource: DataSource,
  ) {}

  // Confere o header Authorization com o provedor. Nos 401 a linha de acesso
  // leva só o código do provedor (`reason`); token, uid e e-mail nunca vão
  // para o log.
  async authenticate(header: unknown): Promise<VerifiedIdentity> {
    const token = extractBearer(header);
    if (!token) throw new AppException('AUT-001');

    try {
      return await this.provider.verifyToken(token);
    } catch (error) {
      if (!(error instanceof AuthProviderError)) throw error;
      const logReason = error.providerCode;
      switch (error.kind) {
        case 'expired':
          throw new AppException('AUT-003', undefined, { logReason });
        case 'revoked':
          throw new AppException('AUT-004', undefined, { logReason });
        case 'disabled':
          throw userDisabled(logReason);
        case 'unavailable':
          this.logger.error(
            'Serviço de autenticação indisponível',
            errorLogFields(error, { provider: 'firebase' }),
          );
          throw new AppException('AUT-008', undefined, { logReason });
        default:
          throw new AppException('AUT-002', undefined, { logReason });
      }
    }
  }

  // AUT-007 em toda rota autenticada (decisão do usuário, passo 009a).
  assertEmailVerified(identity: VerifiedIdentity) {
    assertEmailVerified(identity);
  }

  // Pessoa da identidade: pelo uid ou, no primeiro login, pelo e-mail
  // verificado (vínculo atômico). null = não cadastrada. Excluída ou
  // desativada → AUT-006 (o guard consulta o banco a cada requisição, então
  // desativar vale na hora).
  async resolveUser(identity: VerifiedIdentity): Promise<User | null> {
    const user =
      (await this.findByUid(identity.uid)) ??
      (await this.linkByEmail(identity));
    if (!user) return null;
    if (user.deletedAt || !user.isActive) throw userDisabled();
    return user;
  }

  private findByUid(uid: string) {
    return this.dataSource
      .getRepository(User)
      .findOne({ where: { firebaseUid: uid }, withDeleted: true });
  }

  // Primeiro login de quem já foi cadastrado (convite, auto-cadastro antigo):
  // grava o uid na pessoa com o mesmo e-mail, só se ela ainda não tiver um.
  private async linkByEmail(identity: VerifiedIdentity): Promise<User | null> {
    if (!identity.email || !identity.emailVerified) return null;
    const email = normalizeEmail(identity.email);

    // UPDATE no driver do Postgres devolve [linhas do RETURNING, contagem].
    const [rows] = await this.dataSource.query<[{ id: string }[], number]>(
      'UPDATE users SET "firebaseUid" = $1, "updatedAt" = now() WHERE email = $2 AND "firebaseUid" IS NULL AND "deletedAt" IS NULL RETURNING id',
      [identity.uid, email],
    );

    if (rows.length > 0) {
      this.logger.log('Conta de acesso vinculada no primeiro login', {
        userId: rows[0].id,
      });
      return this.findByUid(identity.uid);
    }

    // 0 linhas: outra requisição do mesmo uid pode ter vinculado agora.
    const raced = await this.findByUid(identity.uid);
    if (raced) return raced;

    // Pessoa excluída com este e-mail: desativada, não "não cadastrada".
    const deleted = await this.dataSource.getRepository(User).findOne({
      select: { id: true, deletedAt: true },
      where: { email },
      withDeleted: true,
    });
    if (deleted?.deletedAt) throw userDisabled();
    return null;
  }
}
