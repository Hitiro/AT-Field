import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../common/errors/app.exception';
import { requestContext } from '../common/logging/request-context';
import { ALLOW_UNREGISTERED } from './allow-unregistered.decorator';
import { AuthService } from './auth.service';
import type { AuthRequest } from './auth.types';
import { IS_PUBLIC } from './public.decorator';

// Guard global (APP_GUARD, registrado depois do RequestContextGuard): toda
// rota exige `Authorization: Bearer <Firebase ID token>`, salvo @Public().
// Ordem: token (AUT-001..004, 006, 008) → e-mail verificado (AUT-007) →
// pessoa no banco (AUT-005/006). Grava request.auth e o userId (uuid interno)
// no contexto de log. A conta (X-Tenant-Id) é do TenantGuard, que roda
// depois, por isso sem token a resposta é AUT-001 mesmo sem o header da conta.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const identity = await this.auth.authenticate(
      request.headers.authorization,
    );
    // Antes de qualquer consulta: sem e-mail verificado a resposta é a mesma
    // para quem existe ou não no banco (não revela cadastro).
    this.auth.assertEmailVerified(identity);

    const user = await this.auth.resolveUser(identity);
    if (!user) {
      const allowUnregistered = this.reflector.getAllAndOverride<boolean>(
        ALLOW_UNREGISTERED,
        targets,
      );
      if (!allowUnregistered) throw new AppException('AUT-005');
      request.auth = { identity };
      return true;
    }

    request.auth = { identity, user };
    requestContext.setUserId(user.id);
    return true;
  }
}
