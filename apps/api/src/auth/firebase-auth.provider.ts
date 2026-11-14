import { OnModuleDestroy } from '@nestjs/common';
import {
  App,
  applicationDefault,
  deleteApp,
  initializeApp,
} from 'firebase-admin/app';
import { Auth, getAuth } from 'firebase-admin/auth';
import {
  AuthProvider,
  AuthProviderError,
  AuthProviderErrorKind,
  VerifiedIdentity,
} from './auth-provider';

export const FIREBASE_APP_NAME = 'at-field';

export type FirebaseAuthOptions = {
  projectId: string;
  // Só com AUTH_CHECK_REVOKED=true (consulta o Firebase a cada requisição;
  // exige service account em GOOGLE_APPLICATION_CREDENTIALS).
  checkRevoked: boolean;
};

// Códigos do firebase-admin (lib/utils/error.js, lib/auth/token-verifier.js)
// que indicam token ruim. O resto (rede, app/*, auth/internal-error,
// desconhecido) é indisponibilidade: 503, não 401.
const KIND_BY_CODE: Record<string, AuthProviderErrorKind> = {
  'auth/id-token-expired': 'expired',
  'auth/id-token-revoked': 'revoked',
  'auth/user-disabled': 'disabled',
  'auth/argument-error': 'invalid',
  'auth/invalid-id-token': 'invalid',
  'auth/invalid-argument': 'invalid',
  'auth/user-not-found': 'invalid',
  'auth/tenant-id-mismatch': 'invalid',
};

// Versão do firebase-admin em que o mapa acima e as mensagens abaixo foram
// conferidos no código-fonte. O firebase-auth.provider.spec.ts falha quando o
// major.minor instalado muda: revise o mapa e as mensagens e atualize aqui.
export const FIREBASE_ADMIN_VERIFIED_FOR = '14.5';

// Falha ao baixar as chaves públicas do Google (rede ou resposta de erro)
// chega como 'auth/argument-error', o mesmo código de token malformado: o
// token-verifier.js perde o JwtError original (KEY_FETCH_ERROR) e só guarda a
// mensagem. Essas mensagens (lib/utils/jwt.js e lib/utils/api-request.js)
// são indisponibilidade, não token ruim.
const KEY_FETCH_MESSAGES = [
  'Error fetching public keys',
  'Error fetching Json Web Keys',
  'Error while making request',
];

const codeOf = (error: unknown): string | undefined => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
};

const messageOf = (error: unknown): string => {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : '';
};

// Classifica o erro do SDK. Exportada para teste.
export function toAuthProviderError(error: unknown): AuthProviderError {
  const code = codeOf(error);
  const message = messageOf(error);
  const keyFetch = KEY_FETCH_MESSAGES.some((text) => message.startsWith(text));
  const kind =
    (!keyFetch && code && KIND_BY_CODE[code]) || ('unavailable' as const);
  // providerCode vai para a linha de acesso: só o código fixo do SDK.
  return new AuthProviderError(kind, code?.slice(0, 60), { cause: error });
}

// Adapter do Firebase Auth: só verifyIdToken (assinatura, aud = projeto, iss,
// exp, iat). Não cria nem altera usuários no Firebase.
export class FirebaseAuthProvider implements AuthProvider, OnModuleDestroy {
  private readonly app: App;
  private readonly auth: Auth;

  constructor(
    private readonly options: FirebaseAuthOptions,
    auth?: Auth,
  ) {
    // App nomeado: não disputa o app padrão com outro código do processo.
    // A credencial só é carregada quando é necessária (checkRevoked);
    // verifyIdToken usa apenas as chaves públicas do Google.
    this.app = initializeApp(
      {
        projectId: options.projectId,
        ...(options.checkRevoked && { credential: applicationDefault() }),
      },
      FIREBASE_APP_NAME,
    );
    this.auth = auth ?? getAuth(this.app);
  }

  async verifyToken(token: string): Promise<VerifiedIdentity> {
    try {
      const decoded = await this.auth.verifyIdToken(
        token,
        this.options.checkRevoked,
      );
      return {
        uid: decoded.uid,
        email: decoded.email ?? null,
        emailVerified: decoded.email_verified === true,
        signInProvider: decoded.firebase?.sign_in_provider,
      };
    } catch (error) {
      throw toAuthProviderError(error);
    }
  }

  onModuleDestroy() {
    return deleteApp(this.app);
  }
}
