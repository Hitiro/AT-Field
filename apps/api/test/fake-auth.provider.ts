import { randomBytes } from 'node:crypto';
import {
  AuthProvider,
  AuthProviderError,
  AuthProviderErrorKind,
  VerifiedIdentity,
} from '../src/auth/auth-provider';

// Provedor falso para os e2e (offline, sem Firebase): substitui o
// AUTH_PROVIDER via overrideProvider. Fica fora de src de propósito: não há
// como ligá-lo por variável de ambiente.
// - issue(identity) devolve um token opaco aleatório para a identidade;
// - os tokens sentinela abaixo disparam o erro correspondente do provedor;
// - token desconhecido → 'invalid'.
const SENTINELS: Record<string, [AuthProviderErrorKind, string]> = {
  expired: ['expired', 'auth/id-token-expired'],
  revoked: ['revoked', 'auth/id-token-revoked'],
  disabled: ['disabled', 'auth/user-disabled'],
  unavailable: ['unavailable', 'app/network-error'],
  invalid: ['invalid', 'auth/argument-error'],
};

export class FakeAuthProvider implements AuthProvider {
  private readonly tokens = new Map<string, VerifiedIdentity>();
  readonly calls: string[] = [];

  issue(identity: VerifiedIdentity): string {
    const token = `fake-${randomBytes(16).toString('hex')}`;
    this.tokens.set(token, { ...identity });
    return token;
  }

  reset() {
    this.tokens.clear();
    this.calls.length = 0;
  }

  verifyToken(token: string): Promise<VerifiedIdentity> {
    this.calls.push(token);
    const sentinel = SENTINELS[token];
    if (sentinel) {
      const [kind, code] = sentinel;
      const cause =
        kind === 'unavailable'
          ? Object.assign(
              new Error('getaddrinfo ENOTFOUND www.googleapis.com'),
              {
                code: 'ENOTFOUND',
              },
            )
          : undefined;
      return Promise.reject(new AuthProviderError(kind, code, { cause }));
    }
    const identity = this.tokens.get(token);
    if (!identity) {
      return Promise.reject(
        new AuthProviderError('invalid', 'auth/argument-error'),
      );
    }
    return Promise.resolve({ ...identity });
  }
}
