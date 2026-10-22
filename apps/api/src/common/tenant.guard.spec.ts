import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantGuard, TenantRequest } from './tenant.guard';

const TENANT_ID = '3f1c2b9e-8a4d-4c6e-9b7a-1d2e3f4a5b6c';

const setup = (tenant: unknown) => {
  const findOneBy = jest.fn().mockResolvedValue(tenant);
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

describe('TenantGuard', () => {
  it('rejeita header ausente ou que não é uuid sem consultar o banco', async () => {
    const { guard, findOneBy } = setup(undefined);
    for (const headers of [{}, { 'x-tenant-id': 'abc' }]) {
      await expect(
        guard.canActivate(contextFor(headers).context),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(findOneBy).not.toHaveBeenCalled();
  });

  it('rejeita tenant inexistente ou inativo', async () => {
    for (const tenant of [null, { id: TENANT_ID, isActive: false }]) {
      const { guard } = setup(tenant);
      await expect(
        guard.canActivate(contextFor({ 'x-tenant-id': TENANT_ID }).context),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it('anexa o tenant ativo à requisição', async () => {
    const tenant = { id: TENANT_ID, isActive: true };
    const { guard, findOneBy } = setup(tenant);
    const { request, context } = contextFor({ 'x-tenant-id': [TENANT_ID] });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findOneBy).toHaveBeenCalledWith({ id: TENANT_ID });
    expect(request.tenant).toBe(tenant);
  });
});
