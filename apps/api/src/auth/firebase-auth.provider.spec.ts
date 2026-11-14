import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Auth } from 'firebase-admin/auth';
import { FirebaseAuthError } from 'firebase-admin/auth';
import { AuthProviderError } from './auth-provider';
import {
  FIREBASE_ADMIN_VERIFIED_FOR,
  FirebaseAuthProvider,
  toAuthProviderError,
} from './firebase-auth.provider';

const PROJECT_ID = 'at-field-test';

const authWith = (verifyIdToken: ReturnType<typeof vi.fn>) =>
  ({ verifyIdToken }) as unknown as Auth;

// Erro no formato do firebase-admin: `code` = 'auth/...' ou 'app/...'.
const sdkError = (code: string, message = 'falhou') =>
  Object.assign(new Error(message), { code });

const providers: FirebaseAuthProvider[] = [];
const create = (auth?: Auth, checkRevoked = false) => {
  const provider = new FirebaseAuthProvider(
    { projectId: PROJECT_ID, checkRevoked },
    auth,
  );
  providers.push(provider);
  return provider;
};

const rejection = async (promise: Promise<unknown>) => {
  const error: unknown = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AuthProviderError);
  return error as AuthProviderError;
};

afterEach(async () => {
  // App nomeado: precisa sair antes do próximo teste criar outro.
  await Promise.all(providers.splice(0).map((p) => p.onModuleDestroy()));
});

describe('FIREBASE_ADMIN_VERIFIED_FOR', () => {
  it('confere com o firebase-admin instalado (major.minor)', () => {
    const pkg = JSON.parse(
      readFileSync(
        join(require.resolve('firebase-admin'), '..', '..', 'package.json'),
        'utf8',
      ),
    ) as { version: string };
    const installed = pkg.version.split('.').slice(0, 2).join('.');
    expect(
      installed,
      'firebase-admin mudou: revise KIND_BY_CODE e KEY_FETCH_MESSAGES em firebase-auth.provider.ts (lib/auth/token-verifier.js, lib/utils/jwt.js, lib/utils/api-request.js) e atualize FIREBASE_ADMIN_VERIFIED_FOR',
    ).toBe(FIREBASE_ADMIN_VERIFIED_FOR);
  });
});

describe('toAuthProviderError (código do SDK → tipo)', () => {
  it.each([
    ['auth/id-token-expired', 'expired'],
    ['auth/id-token-revoked', 'revoked'],
    ['auth/user-disabled', 'disabled'],
    ['auth/argument-error', 'invalid'],
    ['auth/invalid-id-token', 'invalid'],
    ['auth/invalid-argument', 'invalid'],
    ['auth/user-not-found', 'invalid'],
    ['auth/tenant-id-mismatch', 'invalid'],
    ['auth/internal-error', 'unavailable'],
    ['auth/invalid-credential', 'unavailable'],
    ['app/network-error', 'unavailable'],
    ['app/network-timeout', 'unavailable'],
    ['app/invalid-credential', 'unavailable'],
    ['auth/codigo-novo', 'unavailable'],
  ])('%s → %s', (code, kind) => {
    const error = toAuthProviderError(sdkError(code));
    expect(error.kind).toBe(kind);
    expect(error.providerCode).toBe(code);
  });

  it('falha ao baixar as chaves públicas é indisponibilidade, não token ruim', () => {
    for (const message of [
      'Error fetching public keys for Google certs: server_error',
      'Error while making request: getaddrinfo ENOTFOUND www.googleapis.com. Error code: ENOTFOUND',
      'Error fetching Json Web Keys: timeout',
    ]) {
      const error = toAuthProviderError(
        sdkError('auth/argument-error', message),
      );
      expect(error.kind, message).toBe('unavailable');
    }
  });

  it('erro sem código (ex.: TypeError) é indisponibilidade', () => {
    const error = toAuthProviderError(new TypeError('quebrou'));
    expect(error.kind).toBe('unavailable');
    expect(error.providerCode).toBeUndefined();
    expect(error.cause).toBeInstanceOf(TypeError);
  });

  it('mensagem do erro não cita o token nem o código', () => {
    const error = toAuthProviderError(sdkError('auth/id-token-expired'));
    expect(error.message).toBe('Falha na verificação do token (expired)');
  });
});

describe('FirebaseAuthProvider (Auth simulado)', () => {
  it('devolve a identidade do token decodificado', async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({
      uid: 'uid-1',
      email: 'ana@teste.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    });
    const provider = create(authWith(verifyIdToken));
    await expect(provider.verifyToken('tok')).resolves.toEqual({
      uid: 'uid-1',
      email: 'ana@teste.com',
      emailVerified: true,
      signInProvider: 'google.com',
    });
    expect(verifyIdToken).toHaveBeenCalledWith('tok', false);
  });

  it('sem e-mail ou sem email_verified: email null e não verificado', async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({
      uid: 'uid-2',
      firebase: { sign_in_provider: 'phone' },
    });
    const provider = create(authWith(verifyIdToken));
    await expect(provider.verifyToken('tok')).resolves.toMatchObject({
      email: null,
      emailVerified: false,
    });
  });

  it('repassa checkRevoked=true ao SDK', async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({ uid: 'u', firebase: {} });
    const provider = create(authWith(verifyIdToken), true);
    await provider.verifyToken('tok');
    expect(verifyIdToken).toHaveBeenCalledWith('tok', true);
  });

  it('classifica o erro do SDK', async () => {
    const verifyIdToken = vi
      .fn()
      .mockRejectedValue(sdkError('auth/id-token-revoked'));
    const provider = create(authWith(verifyIdToken));
    const error = await rejection(provider.verifyToken('tok'));
    expect(error.kind).toBe('revoked');
  });
});

// Contrato com o SDK de verdade, offline: no modo emulador o firebase-admin
// aceita token sem assinatura e não baixa chaves, mas confere aud, iss e exp
// (o que interessa aqui). Só no teste; em produção a variável é proibida.
describe('FirebaseAuthProvider (SDK real, modo emulador, offline)', () => {
  const previous = process.env.FIREBASE_AUTH_EMULATOR_HOST;

  afterEach(() => {
    if (previous === undefined) delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    else process.env.FIREBASE_AUTH_EMULATOR_HOST = previous;
  });

  const base64url = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');

  const unsignedToken = (claims: Record<string, unknown>) => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      aud: PROJECT_ID,
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
      sub: 'uid-contrato',
      user_id: 'uid-contrato',
      auth_time: now - 60,
      iat: now - 60,
      exp: now + 3600,
      email: 'contrato@teste.com',
      email_verified: true,
      firebase: { sign_in_provider: 'password', identities: {} },
      ...claims,
    };
    return `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url(payload)}.`;
  };

  const emulatorProvider = () => {
    // 127.0.0.1:9 (discard): nenhuma das verificações abaixo chega à rede.
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9';
    return create();
  };

  it('token de outro projeto (aud/iss) → invalid', async () => {
    const provider = emulatorProvider();
    const error = await rejection(
      provider.verifyToken(
        unsignedToken({
          aud: 'outro-projeto',
          iss: 'https://securetoken.google.com/outro-projeto',
        }),
      ),
    );
    expect(error.kind).toBe('invalid');
    expect(error.providerCode).toBe('auth/argument-error');
    expect(error.cause).toBeInstanceOf(FirebaseAuthError);
  });

  it('iss de outro projeto com aud certo → invalid', async () => {
    const provider = emulatorProvider();
    const error = await rejection(
      provider.verifyToken(
        unsignedToken({ iss: 'https://securetoken.google.com/outro' }),
      ),
    );
    expect(error.kind).toBe('invalid');
  });

  it('exp no passado → expired', async () => {
    const provider = emulatorProvider();
    const now = Math.floor(Date.now() / 1000);
    const error = await rejection(
      provider.verifyToken(unsignedToken({ iat: now - 7200, exp: now - 3600 })),
    );
    expect(error.kind).toBe('expired');
    expect(error.providerCode).toBe('auth/id-token-expired');
  });

  // Registro de comportamento do SDK 14.5: `iat` no futuro NÃO é recusado
  // (nem pelo token-verifier nem pelo jsonwebtoken); o token passa e, no modo
  // emulador, o SDK consulta o usuário no emulador, aqui inacessível. Isso
  // também prova o mapeamento de rede fora → unavailable (503).
  it('iat no futuro passa pela verificação; rede fora → unavailable', async () => {
    const provider = emulatorProvider();
    const now = Math.floor(Date.now() / 1000);
    const error = await rejection(
      provider.verifyToken(unsignedToken({ iat: now + 3000 })),
    );
    expect(error.kind).toBe('unavailable');
    expect(error.providerCode).toBe('app/network-error');
  });

  it('texto que não é JWT → invalid', async () => {
    const provider = emulatorProvider();
    const error = await rejection(provider.verifyToken('nao-e-jwt'));
    expect(error.kind).toBe('invalid');
  });
});
