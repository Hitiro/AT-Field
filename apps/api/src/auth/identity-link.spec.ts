import { describe, expect, it, vi } from 'vitest';
import { EntityManager } from 'typeorm';
import type { User } from '../users/entities/user.entity';
import type { VerifiedIdentity } from './auth-provider';
import {
  assertSignupIdentity,
  linkFirebaseUid,
  normalizeEmail,
} from './identity-link';

const identity = (
  overrides: Partial<VerifiedIdentity> = {},
): VerifiedIdentity => ({
  uid: 'uid-ana',
  email: 'ana@teste.com',
  emailVerified: true,
  ...overrides,
});

const throwsCode = (callback: () => unknown, code: string) =>
  expect(callback).toThrow(expect.objectContaining({ code }));

describe('normalizeEmail', () => {
  it('tira espaços e passa para minúsculas', () => {
    expect(normalizeEmail('  Ana@Teste.COM ')).toBe('ana@teste.com');
  });
});

describe('assertSignupIdentity', () => {
  it('aceita o mesmo e-mail, sem diferenciar caixa e espaços', () => {
    expect(() =>
      assertSignupIdentity(
        identity({ email: 'ANA@teste.com' }),
        ' ana@teste.com',
      ),
    ).not.toThrow();
  });

  it('e-mail não verificado: AUT-007 (antes de comparar)', () => {
    throwsCode(
      () =>
        assertSignupIdentity(
          identity({ emailVerified: false, email: 'x@y.com' }),
          'ana@teste.com',
        ),
      'AUT-007',
    );
  });

  it('e-mail diferente ou ausente no token: AUT-009', () => {
    throwsCode(
      () => assertSignupIdentity(identity(), 'outra@teste.com'),
      'AUT-009',
    );
    throwsCode(
      () => assertSignupIdentity(identity({ email: null }), 'ana@teste.com'),
      'AUT-009',
    );
  });
});

describe('linkFirebaseUid', () => {
  const managerWith = (
    rows: { id: string }[],
    current: Partial<User> | null = null,
  ) => {
    const query = vi.fn().mockResolvedValue([rows, rows.length]);
    const findOne = vi.fn().mockResolvedValue(current);
    return {
      manager: { query, findOne } as unknown as EntityManager,
      query,
      findOne,
    };
  };

  it('mesmo uid: nada a fazer', async () => {
    const { manager, query } = managerWith([]);
    const user = { id: 'u1', firebaseUid: 'uid-ana' } as User;
    await expect(linkFirebaseUid(manager, user, identity())).resolves.toBe(
      user,
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('pessoa com outro uid: AUT-010', async () => {
    const { manager } = managerWith([]);
    const user = { id: 'u1', firebaseUid: 'uid-outro' } as User;
    await expect(
      linkFirebaseUid(manager, user, identity()),
    ).rejects.toMatchObject({ code: 'AUT-010' });
  });

  it('sem uid: grava de forma atômica', async () => {
    const { manager, query } = managerWith([{ id: 'u1' }]);
    const user = { id: 'u1', firebaseUid: null } as User;
    const linked = await linkFirebaseUid(manager, user, identity());
    expect(linked.firebaseUid).toBe('uid-ana');
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('"firebaseUid" IS NULL');
    expect(params).toEqual(['uid-ana', 'u1']);
  });

  it('corrida: 0 linhas e já vinculada ao mesmo uid → segue', async () => {
    const { manager } = managerWith([], { firebaseUid: 'uid-ana' });
    const user = { id: 'u1', firebaseUid: null } as User;
    await expect(linkFirebaseUid(manager, user, identity())).resolves.toBe(
      user,
    );
  });

  it('corrida: 0 linhas e vinculada a outro uid → AUT-010', async () => {
    const { manager } = managerWith([], { firebaseUid: 'uid-outro' });
    const user = { id: 'u1', firebaseUid: null } as User;
    await expect(
      linkFirebaseUid(manager, user, identity()),
    ).rejects.toMatchObject({ code: 'AUT-010' });
  });
});
