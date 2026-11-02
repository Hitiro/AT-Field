import { describe, expect, it } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { requestContext } from './request-context';
import { RequestContextGuard } from './request-context.guard';

class UsersController {}

// O Nest entrega a função do método; só o `name` importa.
function findOne() {
  return undefined;
}

const contextFor = (type: string, route?: { path?: unknown }) =>
  ({
    getType: () => type,
    getClass: () => UsersController,
    getHandler: () => findOne,
    switchToHttp: () => ({ getRequest: () => ({ route }) }),
  }) as unknown as ExecutionContext;

describe('RequestContextGuard', () => {
  const guard = new RequestContextGuard();

  it('grava rota e handler no contexto e sempre libera', () => {
    const store = requestContext.run({ requestId: 'req-12345678' }, () => {
      expect(
        guard.canActivate(contextFor('http', { path: '/users/:id' })),
      ).toBe(true);
      return requestContext.get();
    });
    expect(store).toMatchObject({
      route: '/users/:id',
      handler: 'UsersController.findOne',
    });
  });

  it('sem req.route grava só o handler', () => {
    const store = requestContext.run({ requestId: 'req-12345678' }, () => {
      guard.canActivate(contextFor('http'));
      return requestContext.get();
    });
    expect(store?.route).toBeUndefined();
    expect(store?.handler).toBe('UsersController.findOne');
  });

  it('fora de HTTP não mexe no contexto', () => {
    const store = requestContext.run({ requestId: 'req-12345678' }, () => {
      expect(guard.canActivate(contextFor('rpc'))).toBe(true);
      return requestContext.get();
    });
    expect(store).toEqual({ requestId: 'req-12345678' });
  });
});
