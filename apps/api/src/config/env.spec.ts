import { describe, it, expect } from 'vitest';
import { validateEnv } from './env';

const base = {
  DATABASE_USER: 'postgres',
  DATABASE_PASSWORD: 'secret',
  DATABASE_NAME: 'at_field',
};

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
});
