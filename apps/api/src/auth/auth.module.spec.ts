import { afterEach, describe, expect, it } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { createAuthProvider } from './auth.module';
import { FirebaseAuthProvider } from './firebase-auth.provider';

const configFor = (nodeEnv: Env['NODE_ENV']) => {
  const values: Partial<Env> = {
    NODE_ENV: nodeEnv,
    FIREBASE_PROJECT_ID: 'at-field-test',
    AUTH_CHECK_REVOKED: false,
  };
  return {
    get: (key: keyof Env) => values[key],
  } as unknown as ConfigService<Env, true>;
};

// Segunda barreira contra o emulador: a factory lê o process.env direto (o
// mesmo que o SDK lê), independentemente do que o envSchema validou.
describe('createAuthProvider', () => {
  const previous = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const created: FirebaseAuthProvider[] = [];

  afterEach(async () => {
    if (previous === undefined) delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    else process.env.FIREBASE_AUTH_EMULATOR_HOST = previous;
    // App nomeado do Firebase: fecha antes do próximo teste criar outro.
    await Promise.all(created.splice(0).map((p) => p.onModuleDestroy()));
  });

  it('production com emulador (mesmo loopback): lança', () => {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    expect(() => createAuthProvider(configFor('production'))).toThrow(
      /FIREBASE_AUTH_EMULATOR_HOST/,
    );
  });

  it('host remoto fora de production: lança', () => {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'emulador.interno:9099';
    expect(() => createAuthProvider(configFor('development'))).toThrow(
      /FIREBASE_AUTH_EMULATOR_HOST/,
    );
  });

  it('loopback em development: cria o provider', () => {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
    const provider = createAuthProvider(configFor('development'));
    created.push(provider);
    expect(provider).toBeInstanceOf(FirebaseAuthProvider);
  });

  it('sem emulador: cria o provider (inclusive em production)', () => {
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    const provider = createAuthProvider(configFor('production'));
    created.push(provider);
    expect(provider).toBeInstanceOf(FirebaseAuthProvider);
  });
});
