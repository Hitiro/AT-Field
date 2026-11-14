import { describe, expect, it, vi } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../common/errors/app.exception';
import { requestContext } from '../common/logging/request-context';
import { ALLOW_UNREGISTERED } from './allow-unregistered.decorator';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import type { AuthRequest } from './auth.types';
import { IS_PUBLIC } from './public.decorator';

const IDENTITY = {
  uid: 'uid-1',
  email: 'ana@teste.com',
  emailVerified: true,
  signInProvider: 'google.com',
};
const USER = { id: 'user-1', isActive: true, deletedAt: null };

class Handlers {}

// Handlers com os metadados que os decorators gravariam.
const handlers = {
  open: () => undefined,
  closed: () => undefined,
  signup: () => undefined,
};

Reflect.defineMetadata(IS_PUBLIC, true, handlers.open);
Reflect.defineMetadata(ALLOW_UNREGISTERED, true, handlers.signup);

const setup = (overrides: Partial<Record<keyof AuthService, unknown>> = {}) => {
  const auth = {
    authenticate: vi.fn().mockResolvedValue(IDENTITY),
    assertEmailVerified: vi.fn(),
    resolveUser: vi.fn().mockResolvedValue(USER),
    ...overrides,
  };
  const guard = new AuthGuard(new Reflector(), auth as unknown as AuthService);
  return { guard, auth };
};

const contextFor = (
  handler: keyof typeof handlers,
  headers: Record<string, string> = { authorization: 'Bearer tok' },
  type = 'http',
) => {
  const request = { headers } as unknown as AuthRequest;
  const context = {
    getType: () => type,
    getHandler: () => handlers[handler],
    getClass: () => Handlers,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { request, context };
};

const run = <T>(callback: () => Promise<T>) =>
  requestContext.run({ requestId: 'req-12345678' }, async () => {
    const result = await callback().catch((error: unknown) => error);
    return { result, store: requestContext.get() };
  });

describe('AuthGuard', () => {
  it('@Public(): libera sem autenticar', async () => {
    const { guard, auth } = setup();
    await expect(
      guard.canActivate(contextFor('open', {}).context),
    ).resolves.toBe(true);
    expect(auth.authenticate).not.toHaveBeenCalled();
  });

  it('fora de HTTP não faz nada', async () => {
    const { guard, auth } = setup();
    await expect(
      guard.canActivate(contextFor('closed', {}, 'rpc').context),
    ).resolves.toBe(true);
    expect(auth.authenticate).not.toHaveBeenCalled();
  });

  it('autentica, resolve a pessoa e grava request.auth e o userId no contexto', async () => {
    const { guard, auth } = setup();
    const { request, context } = contextFor('closed');
    const { result, store } = await run(() => guard.canActivate(context));
    expect(result).toBe(true);
    expect(auth.authenticate).toHaveBeenCalledWith('Bearer tok');
    expect(auth.assertEmailVerified).toHaveBeenCalledWith(IDENTITY);
    expect(request.auth).toEqual({ identity: IDENTITY, user: USER });
    expect(store).toEqual({ requestId: 'req-12345678', userId: 'user-1' });
  });

  it('erro do token sobe antes de consultar o banco', async () => {
    const { guard, auth } = setup({
      authenticate: vi.fn().mockRejectedValue(new AppException('AUT-001')),
    });
    const { result } = await run(() =>
      guard.canActivate(contextFor('closed', {}).context),
    );
    expect((result as AppException).code).toBe('AUT-001');
    expect(auth.resolveUser).not.toHaveBeenCalled();
  });

  it('e-mail não verificado barra antes de consultar o banco (não revela cadastro)', async () => {
    const { guard, auth } = setup({
      assertEmailVerified: vi.fn(() => {
        throw new AppException('AUT-007');
      }),
    });
    const { result, store } = await run(() =>
      guard.canActivate(contextFor('closed').context),
    );
    expect((result as AppException).code).toBe('AUT-007');
    expect(auth.resolveUser).not.toHaveBeenCalled();
    expect(store?.userId).toBeUndefined();
  });

  it('pessoa não cadastrada: AUT-005', async () => {
    const { guard } = setup({ resolveUser: vi.fn().mockResolvedValue(null) });
    const { result } = await run(() =>
      guard.canActivate(contextFor('closed').context),
    );
    expect(result).toBeInstanceOf(AppException);
    expect((result as AppException).code).toBe('AUT-005');
    expect((result as AppException).getStatus()).toBe(403);
  });

  it('@AllowUnregistered(): segue só com a identidade, sem userId', async () => {
    const { guard } = setup({ resolveUser: vi.fn().mockResolvedValue(null) });
    const { request, context } = contextFor('signup');
    const { result, store } = await run(() => guard.canActivate(context));
    expect(result).toBe(true);
    expect(request.auth).toEqual({ identity: IDENTITY });
    expect(store?.userId).toBeUndefined();
  });

  it('@AllowUnregistered() com pessoa cadastrada: grava a pessoa', async () => {
    const { guard } = setup();
    const { request, context } = contextFor('signup');
    const { store } = await run(() => guard.canActivate(context));
    expect(request.auth?.user).toBe(USER);
    expect(store?.userId).toBe('user-1');
  });
});
