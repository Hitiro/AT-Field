import { describe, it, expect } from 'vitest';
import {
  isLoopbackEmulatorHost,
  resolveLogFormat,
  validateDatabaseEnv,
  validateEnv,
} from './env';

const base = {
  DATABASE_USER: 'postgres',
  DATABASE_PASSWORD: 'secret',
  DATABASE_NAME: 'at_field',
  FIREBASE_PROJECT_ID: 'at-field-test',
};

const withoutProjectId = () => {
  const rest: Record<string, string> = { ...base };
  delete rest.FIREBASE_PROJECT_ID;
  return rest;
};

describe('validateEnv (Firebase, passo 009a)', () => {
  it('AUTH_CHECK_REVOKED desligado por padrão e opcionais indefinidos', () => {
    const env = validateEnv(base);
    expect(env.FIREBASE_PROJECT_ID).toBe('at-field-test');
    expect(env.AUTH_CHECK_REVOKED).toBe(false);
    expect(env.GOOGLE_APPLICATION_CREDENTIALS).toBeUndefined();
    expect(env.FIREBASE_AUTH_EMULATOR_HOST).toBeUndefined();
  });

  it('FIREBASE_PROJECT_ID obrigatório e no formato do Firebase', () => {
    expect(() => validateEnv(withoutProjectId())).toThrow();
    for (const invalid of ['abc', 'Projeto-X', 'a'.repeat(31), 'proj_x', '']) {
      expect(
        () => validateEnv({ ...base, FIREBASE_PROJECT_ID: invalid }),
        invalid,
      ).toThrow();
    }
    expect(
      validateEnv({ ...base, FIREBASE_PROJECT_ID: 'meu-app-12ab3' })
        .FIREBASE_PROJECT_ID,
    ).toBe('meu-app-12ab3');
  });

  const LOOPBACK_HOSTS = [
    '127.0.0.1:9099',
    'localhost:9099',
    '[::1]:9099',
    '[::1]',
    'localhost',
  ];

  it('emulador proibido em production, mesmo em loopback (o SDK aceitaria token sem assinatura)', () => {
    for (const host of [...LOOPBACK_HOSTS, 'emulador.interno:9099']) {
      expect(
        () =>
          validateEnv({
            ...base,
            NODE_ENV: 'production',
            FIREBASE_AUTH_EMULATOR_HOST: host,
          }),
        host,
      ).toThrow(/FIREBASE_AUTH_EMULATOR_HOST/);
    }
  });

  it('emulador fora de production: só host loopback', () => {
    for (const nodeEnv of ['development', 'test']) {
      for (const host of LOOPBACK_HOSTS) {
        expect(
          validateEnv({
            ...base,
            NODE_ENV: nodeEnv,
            FIREBASE_AUTH_EMULATOR_HOST: host,
          }).FIREBASE_AUTH_EMULATOR_HOST,
        ).toBe(host);
      }
    }
  });

  it('emulador em host remoto: rejeitado mesmo sem NODE_ENV (padrão development)', () => {
    for (const host of [
      '10.0.0.5:9099',
      'emulador.interno:9099',
      '0.0.0.0:9099',
      'localhost.evil.com:9099',
      '127.0.0.1.evil.com',
      '127.0.0.2:9099',
      'localhost:abc',
      'http://localhost:9099',
      // IPv6 sem colchetes: o SDK montaria uma URL inválida.
      '::1',
      '::1:9099',
    ]) {
      expect(
        () => validateEnv({ ...base, FIREBASE_AUTH_EMULATOR_HOST: host }),
        host,
      ).toThrow(/FIREBASE_AUTH_EMULATOR_HOST/);
    }
  });

  it('isLoopbackEmulatorHost', () => {
    expect(isLoopbackEmulatorHost('localhost:9099')).toBe(true);
    expect(isLoopbackEmulatorHost('[::1]:9099')).toBe(true);
    expect(isLoopbackEmulatorHost('192.168.0.10:9099')).toBe(false);
  });

  it('AUTH_CHECK_REVOKED=true exige GOOGLE_APPLICATION_CREDENTIALS', () => {
    expect(() => validateEnv({ ...base, AUTH_CHECK_REVOKED: 'true' })).toThrow(
      /GOOGLE_APPLICATION_CREDENTIALS/,
    );
    const env = validateEnv({
      ...base,
      AUTH_CHECK_REVOKED: 'true',
      GOOGLE_APPLICATION_CREDENTIALS: '/caminho/sa.json',
    });
    expect(env.AUTH_CHECK_REVOKED).toBe(true);
  });

  it('AUTH_CHECK_REVOKED aceita só booleano em texto', () => {
    expect(validateEnv({ ...base, AUTH_CHECK_REVOKED: 'false' })).toMatchObject(
      { AUTH_CHECK_REVOKED: false },
    );
    expect(() =>
      validateEnv({ ...base, AUTH_CHECK_REVOKED: 'talvez' }),
    ).toThrow();
  });

  it('validateDatabaseEnv (CLI de migrations) não exige o Firebase', () => {
    expect(validateDatabaseEnv(withoutProjectId())).toEqual({
      DATABASE_HOST: 'localhost',
      DATABASE_PORT: 54310,
      DATABASE_USER: 'postgres',
      DATABASE_PASSWORD: 'secret',
      DATABASE_NAME: 'at_field',
    });
  });
});

describe('validateEnv', () => {
  it('aplica os padrões (portas do bloco 43xx)', () => {
    const env = validateEnv(base);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4310);
    expect(env.DATABASE_HOST).toBe('localhost');
    expect(env.DATABASE_PORT).toBe(54310);
  });

  it('converte portas em string para número', () => {
    const env = validateEnv({ ...base, PORT: '5000', DATABASE_PORT: '5432' });
    expect(env.PORT).toBe(5000);
    expect(env.DATABASE_PORT).toBe(5432);
  });

  it.each(['DATABASE_USER', 'DATABASE_PASSWORD', 'DATABASE_NAME'])(
    'falha quando %s está ausente',
    (key) => {
      const rest: Record<string, string> = { ...base };
      delete rest[key];
      expect(() => validateEnv(rest)).toThrow();
    },
  );

  it('falha com NODE_ENV inválido', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'staging' })).toThrow();
  });

  it('falha com porta inválida', () => {
    expect(() => validateEnv({ ...base, PORT: 'abc' })).toThrow();
    expect(() => validateEnv({ ...base, PORT: '-1' })).toThrow();
  });

  it('usa LOG_LEVEL=log e deixa LOG_FORMAT indefinido por padrão', () => {
    const env = validateEnv(base);
    expect(env.LOG_LEVEL).toBe('log');
    expect(env.LOG_FORMAT).toBeUndefined();
  });

  it('aceita LOG_LEVEL e LOG_FORMAT válidos', () => {
    const env = validateEnv({ ...base, LOG_LEVEL: 'warn', LOG_FORMAT: 'json' });
    expect(env.LOG_LEVEL).toBe('warn');
    expect(env.LOG_FORMAT).toBe('json');
  });

  it('falha com LOG_LEVEL ou LOG_FORMAT inválido', () => {
    expect(() => validateEnv({ ...base, LOG_LEVEL: 'info' })).toThrow();
    expect(() => validateEnv({ ...base, LOG_FORMAT: 'xml' })).toThrow();
  });

  it('resolve o formato do log: json em production, pretty fora', () => {
    expect(resolveLogFormat('production', undefined)).toBe('json');
    expect(resolveLogFormat('development', undefined)).toBe('pretty');
    expect(resolveLogFormat('test', undefined)).toBe('pretty');
    expect(resolveLogFormat('production', 'pretty')).toBe('pretty');
    expect(resolveLogFormat('development', 'json')).toBe('json');
  });
});
