import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { TenantRequest } from './tenant.guard.js';

export const CurrentTenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<TenantRequest>().tenant,
);
