import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { requestContext } from './request-context';

// Não autoriza nada: só anota no contexto da requisição o padrão da rota
// (ex.: /users/:id) e o handler (ex.: UsersController.findOne) para os logs
// de erro. É um guard global (APP_GUARD) porque guards globais rodam antes
// dos guards de controller (TenantGuard), dos pipes e dos interceptors, e o
// ArgumentsHost que o Nest entrega ao filtro de exceções não traz classe nem
// handler. Erros antes do roteamento (404, body-parser) ficam sem esses
// campos.
@Injectable()
export class RequestContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest<Request>();
      const route = (request.route as { path?: unknown } | undefined)?.path;
      requestContext.setHandler(
        typeof route === 'string' ? route : undefined,
        `${context.getClass().name}.${context.getHandler().name}`,
      );
    }
    return true;
  }
}
