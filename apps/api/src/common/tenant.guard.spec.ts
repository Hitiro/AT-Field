import { describe, expect, it, vi } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppException } from './errors/app.exception';
import { requestContext } from './logging/request-context';
import { TenantGuard, TenantRequest } from './tenant.guard';

const TENANT_ID = '3f1c2b9e-8a4d-4c6e-9b7a-1d2e3f4a5b6c';

const setup = (tenant: unknown) => {
  const findOneBy = vi.fn().mockResolvedValue(tenant);
  const dataSource = {
    getRepository: () => ({ findOneBy }),
  } as unknown as DataSource;
  return { guard: new TenantGuard(dataSource), findOneBy };
};

const contextFor = (headers: Record<string, string | string[]>) => {
  const request = { headers } as unknown as TenantRequest;
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
};

describe('TenantGuard', () => {
  it('rejeita header ausente ou que não é uuid sem consultar o banco (TEN-001)', async () => {
    const { guard, findOneBy } = setup(undefined);
    const cases: Record<string, string>[] = [{}, { 'x-tenant-id': 'abc' }];
    for (const headers of cases) {
      await expectCode(
        guard.canActivate(contextFor(headers).context),
        'TEN-001',
      );
    }
    expect(findOneBy).not.toHaveBeenCalled();
  });

  it('rejeita tenant inexistente ou inativo (TEN-002)', async () => {
    for (const tenant of [null, { id: TENANT_ID, isActive: false }]) {
      const { guard } = setup(tenant);
      await expectCode(
        guard.canActivate(contextFor({ 'x-tenant-id': TENANT_ID }).context),
        'TEN-002',
      );
    }
  });

  it('anexa o tenant ativo à requisição e ao contexto de log', async () => {
    const tenant = { id: TENANT_ID, isActive: true };
    const { guard, findOneBy } = setup(tenant);
    const { request, context } = contextFor({ 'x-tenant-id': [TENANT_ID] });

    const store = await requestContext.run(
      { requestId: 'req-12345678' },
      async () => {
        await expect(guard.canActivate(context)).resolves.toBe(true);
        return requestContext.get();
      },
    );
    expect(findOneBy).toHaveBeenCalledWith({ id: TENANT_ID });
    expect(request.tenant).toBe(tenant);
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
