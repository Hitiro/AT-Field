import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthRequest } from './auth.types';

// Pessoa autenticada (entidade User). Indefinida só em rota com
// @AllowUnregistered() quando a pessoa ainda não existe.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthRequest>().auth?.user,
);

// Identidade conferida pelo provedor (uid, e-mail, e-mail verificado).
export const CurrentIdentity = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthRequest>().auth?.identity,
);
