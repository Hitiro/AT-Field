import { describe, expect, it, vi } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { ERROR_CODES } from '@at-field/dto';
import { DataSource } from 'typeorm';
import { AppException } from './errors/app.exception';
import { requestContext } from './logging/request-context';
import { TenantGuard, TenantRequest } from './tenant.guard';

const TENANT_ID = '3f1c2b9e-8a4d-4c6e-9b7a-1d2e3f4a5b6c';
const USER_ID = 'user-1';

const tenant = (overrides: Record<string, unknown> = {}) => ({
  id: TENANT_ID,
  isActive: true,
  deletedAt: null,
  ...overrides,
});

const membershipWith = (overrides: Record<string, unknown> = {}) => ({
  id: 'm-1',
  userId: USER_ID,
  tenantId: TENANT_ID,
  status: 'active',
  tenant: tenant(),
  role: { id: 'r-1', name: 'owner' },
  ...overrides,
});

const setup = (membership: unknown) => {
  const findOne = vi.fn().mockResolvedValue(membership);
  const dataSource = {
    getRepository: () => ({ findOne }),
  } as unknown as DataSource;
  return { guard: new TenantGuard(dataSource), findOne };
};

const contextFor = (
  headers: Record<string, string | string[]>,
  userId: string | null = USER_ID,
) => {
  const request = {
    headers,
    auth: {
      identity: { uid: 'uid-1', email: null, emailVerified: true },
      ...(userId && { user: { id: userId } }),
    },
  } as unknown as TenantRequest;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { request, context };
};

const expectCode = async (promise: Promise<unknown>, code: string) => {
  const error: unknown = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AppException);
  expect((error as AppException).code).toBe(code);
  expect((error as AppException).getStatus()).toBe(403);
  return error as AppException;
};

describe('TenantGuard', () => {
  it('rejeita header ausente ou que não é uuid sem consultar o banco (TEN-001)', async () => {
    const { guard, findOne } = setup(undefined);
    const cases: Record<string, string>[] = [{}, { 'x-tenant-id': 'abc' }];
    for (const headers of cases) {
      await expectCode(
        guard.canActivate(contextFor(headers).context),
        'TEN-001',
      );
    }
    expect(findOne).not.toHaveBeenCalled();
  });

  it('consulta o vínculo da pessoa com a conta (uma consulta, com conta e papel)', async () => {
    const { guard, findOne } = setup(membershipWith());
    await guard.canActivate(contextFor({ 'x-tenant-id': TENANT_ID }).context);
    expect(findOne).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledWith({
      where: { userId: USER_ID, tenantId: TENANT_ID },
      relations: { tenant: true, role: true },
      withDeleted: true,
    });
  });

  it.each([
    ['conta inexistente ou sem vínculo', null],
    ['conta inativa', membershipWith({ tenant: tenant({ isActive: false }) })],
    [
      'conta excluída',
      membershipWith({ tenant: tenant({ deletedAt: new Date() }) }),
    ],
    ['vínculo convidado', membershipWith({ status: 'invited' })],
    ['vínculo suspenso', membershipWith({ status: 'suspended' })],
  ])('%s: TEN-002 com a mesma resposta', async (_label, membership) => {
    const { guard } = setup(membership);
    const error = await expectCode(
      guard.canActivate(contextFor({ 'x-tenant-id': TENANT_ID }).context),
      'TEN-002',
    );
    expect(error.getResponse()).toEqual({
      code: 'TEN-002',
      message: ERROR_CODES['TEN-002'].message,
    });
    expect(error.details).toBeUndefined();
  });

  it('sem pessoa autenticada: TEN-002 sem consultar o banco', async () => {
    const { guard, findOne } = setup(membershipWith());
    await expectCode(
      guard.canActivate(contextFor({ 'x-tenant-id': TENANT_ID }, null).context),
      'TEN-002',
    );
    expect(findOne).not.toHaveBeenCalled();
  });

  it('anexa conta e vínculo à requisição e o tenantId ao contexto de log', async () => {
    const membership = membershipWith();
    const { guard } = setup(membership);
    const { request, context } = contextFor({ 'x-tenant-id': [TENANT_ID] });

    const store = await requestContext.run(
      { requestId: 'req-12345678' },
      async () => {
        await expect(guard.canActivate(context)).resolves.toBe(true);
        return requestContext.get();
      },
    );
    expect(request.tenant).toBe(membership.tenant);
    expect(request.membership).toBe(membership);
    expect(store).toEqual({ requestId: 'req-12345678', tenantId: TENANT_ID });
  });

  it('não grava tenantId no contexto quando rejeita', async () => {
    const { guard } = setup(null);
    const store = await requestContext.run(
      { requestId: 'req-12345678' },
      async () => {
        await guard
          .canActivate(contextFor({ 'x-tenant-id': TENANT_ID }).context)
          .catch(() => undefined);
        return requestContext.get();
      },
    );
    expect(store?.tenantId).toBeUndefined();
  });
});
