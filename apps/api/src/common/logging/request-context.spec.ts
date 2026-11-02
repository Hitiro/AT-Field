import { describe, expect, it } from 'vitest';
import { setTimeout as sleep } from 'node:timers/promises';
import { requestContext } from './request-context';

describe('requestContext', () => {
  it('não mistura o contexto de requisições simultâneas', async () => {
    const handle = (requestId: string, tenantId: string, wait: number) =>
      requestContext.run({ requestId }, async () => {
        await sleep(wait);
        requestContext.setTenantId(tenantId);
        await sleep(wait);
        return requestContext.get();
      });

    const [a, b] = await Promise.all([
      handle('req-aaaaaaaa', 'tenant-a', 10),
      handle('req-bbbbbbbb', 'tenant-b', 1),
    ]);
    expect(a).toEqual({ requestId: 'req-aaaaaaaa', tenantId: 'tenant-a' });
    expect(b).toEqual({ requestId: 'req-bbbbbbbb', tenantId: 'tenant-b' });
  });

  it('fora de contexto: get é undefined e os setters não fazem nada', () => {
    expect(requestContext.get()).toBeUndefined();
    expect(() => requestContext.setTenantId('x')).not.toThrow();
    expect(() => requestContext.setHandler('/x', 'A.b')).not.toThrow();
    expect(requestContext.get()).toBeUndefined();
  });

  it('setHandler grava rota e handler', () => {
    const store = requestContext.run({ requestId: 'req-cccccccc' }, () => {
      requestContext.setHandler('/users/:id', 'UsersController.findOne');
      return requestContext.get();
    });
    expect(store).toEqual({
      requestId: 'req-cccccccc',
      route: '/users/:id',
      handler: 'UsersController.findOne',
    });
  });
});
