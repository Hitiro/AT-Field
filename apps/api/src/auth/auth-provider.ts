// Adapter do provedor de identidade (passo 009a). Hoje é o Firebase Auth
// (firebase-auth.provider.ts); trocar de provedor = outra implementação desta
// interface, sem mexer no guard nem nos services.
export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER');

// Identidade conferida pelo provedor. `uid` e `email` são dado sensível:
// nunca vão para o log (o redact cobre `firebaseUid` e `email`, mas a regra é
// não logar). `signInProvider` (ex.: 'password', 'google.com') não é dado
// pessoal.
export type VerifiedIdentity = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  signInProvider?: string;
};

export interface AuthProvider {
  // Lança AuthProviderError quando o token não vale.
  verifyToken(token: string): Promise<VerifiedIdentity>;
}

export type AuthProviderErrorKind =
  'invalid' | 'expired' | 'revoked' | 'disabled' | 'unavailable';

// Erro do provedor já classificado. `providerCode` (ex.:
// 'auth/id-token-expired') é um código fixo do SDK, sem dado pessoal: é o
// único detalhe que vai para a linha de acesso (`reason`).
export class AuthProviderError extends Error {
  constructor(
    readonly kind: AuthProviderErrorKind,
    readonly providerCode?: string,
    options?: { cause?: unknown },
  ) {
    super(`Falha na verificação do token (${kind})`, options);
    this.name = 'AuthProviderError';
  }
}
