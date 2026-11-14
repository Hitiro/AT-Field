import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppException } from '../common/errors/app.exception';
import {
  AuthProvider,
  AuthProviderError,
  AuthProviderErrorKind,
  VerifiedIdentity,
} from './auth-provider';
import { AuthService, extractBearer } from './auth.service';

const identity = (
  overrides: Partial<VerifiedIdentity> = {},
): VerifiedIdentity => ({
  uid: 'uid-ana',
  email: 'Ana@Teste.com ',
  emailVerified: true,
  signInProvider: 'password',
  ...overrides,
});

const user = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1',
  firebaseUid: 'uid-ana',
  email: 'ana@teste.com',
  isActive: true,
  deletedAt: null,
  ...overrides,
});

const setup = (
  options: {
    verify?: AuthProvider['verifyToken'];
    findOne?: ReturnType<typeof vi.fn>;
    query?: ReturnType<typeof vi.fn>;
  } = {},
) => {
  const verifyToken = vi.fn(
    options.verify ?? (() => Promise.resolve(identity())),
  );
  const provider: AuthProvider = { verifyToken };
  const findOne = options.findOne ?? vi.fn().mockResolvedValue(null);
  const query = options.query ?? vi.fn().mockResolvedValue([[], 0]);
  const dataSource = {
    getRepository: () => ({ findOne }),
    query,
  } as unknown as DataSource;
  return {
    service: new AuthService(provider, dataSource),
    verifyToken,
    findOne,
    query,
  };
};

const codeOf = async (promise: Promise<unknown>) => {
  const error: unknown = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AppException);
  return error as AppException;
};

afterEach(() => vi.restoreAllMocks());

describe('extractBearer', () => {
  it.each([
    ['Bearer abc.def', 'abc.def'],
    ['bearer abc', 'abc'],
    ['BEARER abc', 'abc'],
    ['Bearer    abc', 'abc'],
    ['  Bearer abc  ', 'abc'],
  ])('%j → %s', (header, token) => {
    expect(extractBearer(header)).toBe(token);
  });

  it.each([
    undefined,
    '',
    'Bearer',
    'Bearer ',
    'Basic abc',
    'Bearer a b',
    'abc',
    ['Bearer abc'],
    42,
  ])('%j → ausente', (header) => {
    expect(extractBearer(header)).toBeUndefined();
  });
});

describe('AuthService.authenticate', () => {
  it('sem header ou fora do formato: AUT-001 sem chamar o provedor', async () => {
    const { service, verifyToken } = setup();
    for (const header of [undefined, '', 'Basic x', ['Bearer x']]) {
      const error = await codeOf(service.authenticate(header));
      expect(error.code).toBe('AUT-001');
      expect(error.getStatus()).toBe(401);
    }
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('devolve a identidade do provedor', async () => {
    const { service, verifyToken } = setup();
    await expect(service.authenticate('Bearer tok')).resolves.toEqual(
      identity(),
    );
    expect(verifyToken).toHaveBeenCalledWith('tok');
  });

  it.each([
    ['invalid', 'AUT-002', 401],
    ['expired', 'AUT-003', 401],
    ['revoked', 'AUT-004', 401],
    ['disabled', 'AUT-006', 403],
    ['unavailable', 'AUT-008', 503],
  ] as [AuthProviderErrorKind, string, number][])(
    'erro %s do provedor → %s (%i) com o código do provedor só no log',
    async (kind, code, status) => {
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const { service } = setup({
        verify: vi
          .fn()
          .mockRejectedValue(new AuthProviderError(kind, `auth/${kind}`)),
      });
      const error = await codeOf(service.authenticate('Bearer tok'));
      expect(error.code).toBe(code);
      expect(error.getStatus()).toBe(status);
      expect(error.logReason).toBe(`auth/${kind}`);
    },
  );

  it('indisponível: log error com errorLogFields, sem token', async () => {
    const log = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const cause = Object.assign(new Error('getaddrinfo ENOTFOUND'), {
      code: 'ENOTFOUND',
    });
    const { service } = setup({
      verify: vi
        .fn()
        .mockRejectedValue(
          new AuthProviderError('unavailable', 'app/network-error', { cause }),
        ),
    });
    await codeOf(service.authenticate('Bearer token-secreto'));
    expect(log).toHaveBeenCalledTimes(1);
    const [message, fields] = log.mock.calls[0] as unknown as [
      string,
      Record<string, any>,
    ];
    expect(message).toBe('Serviço de autenticação indisponível');
    expect(fields).toMatchObject({
      provider: 'firebase',
      error: {
        name: 'AuthProviderError',
        kind: 'unavailable',
        providerCode: 'app/network-error',
        cause: { code: 'ENOTFOUND' },
      },
      app: expect.any(Object),
    });
    expect(JSON.stringify(fields)).not.toContain('token-secreto');
  });

  it('nos 401 não loga nada (só a linha de acesso)', async () => {
    const log = vi.spyOn(Logger.prototype, 'error');
    const { service } = setup({
      verify: vi.fn().mockRejectedValue(new AuthProviderError('expired')),
    });
    await codeOf(service.authenticate('Bearer tok'));
    expect(log).not.toHaveBeenCalled();
  });

  it('erro que não é do provedor segue adiante (vira GEN-500 no filtro)', async () => {
    const bug = new TypeError('bug');
    const { service } = setup({ verify: vi.fn().mockRejectedValue(bug) });
    await expect(service.authenticate('Bearer tok')).rejects.toBe(bug);
  });
});

describe('AuthService.assertEmailVerified', () => {
  it('e-mail não verificado: AUT-007 (403)', () => {
    const { service } = setup();
    expect(() =>
      service.assertEmailVerified(identity({ emailVerified: false })),
    ).toThrow(expect.objectContaining({ code: 'AUT-007' }));
    expect(() => service.assertEmailVerified(identity())).not.toThrow();
  });
});

describe('AuthService.resolveUser', () => {
  it('acha pelo uid sem tentar vincular', async () => {
    const found = user();
    const { service, findOne, query } = setup({
      findOne: vi.fn().mockResolvedValue(found),
    });
    await expect(service.resolveUser(identity())).resolves.toBe(found);
    expect(findOne).toHaveBeenCalledWith({
      where: { firebaseUid: 'uid-ana' },
      withDeleted: true,
    });
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    ['desativado', { isActive: false }],
    ['excluído', { deletedAt: new Date() }],
  ])('usuário %s: AUT-006', async (_label, overrides) => {
    const { service } = setup({
      findOne: vi.fn().mockResolvedValue(user(overrides)),
    });
    const error = await codeOf(service.resolveUser(identity()));
    expect(error.code).toBe('AUT-006');
    expect(error.getStatus()).toBe(403);
  });

  it('primeiro login: vincula pelo e-mail normalizado (UPDATE atômico)', async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const linked = user();
    const findOne = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(linked);
    const query = vi.fn().mockResolvedValue([[{ id: 'user-1' }], 1]);
    const { service } = setup({ findOne, query });

    await expect(service.resolveUser(identity())).resolves.toBe(linked);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('"firebaseUid" IS NULL');
    expect(sql).toContain('"deletedAt" IS NULL');
    expect(params).toEqual(['uid-ana', 'ana@teste.com']);
  });

  it('corrida: UPDATE com 0 linhas e outra requisição já vinculou → relê pelo uid', async () => {
    const linked = user();
    const findOne = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(linked);
    const { service, query } = setup({ findOne });
    await expect(service.resolveUser(identity())).resolves.toBe(linked);
    expect(query).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledTimes(2);
  });

  it('ninguém com o uid nem com o e-mail: null (o guard decide AUT-005)', async () => {
    const { service } = setup();
    await expect(service.resolveUser(identity())).resolves.toBeNull();
  });

  it('pessoa excluída com o mesmo e-mail: AUT-006', async () => {
    const findOne = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'user-x', deletedAt: new Date() });
    const { service } = setup({ findOne });
    const error = await codeOf(service.resolveUser(identity()));
    expect(error.code).toBe('AUT-006');
  });

  it('não vincula sem e-mail ou com e-mail não verificado', async () => {
    for (const overrides of [{ email: null }, { emailVerified: false }]) {
      const { service, query } = setup();
      await expect(
        service.resolveUser(identity(overrides)),
      ).resolves.toBeNull();
      expect(query).not.toHaveBeenCalled();
    }
  });
});
