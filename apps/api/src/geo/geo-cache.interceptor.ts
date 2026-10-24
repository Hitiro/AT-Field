import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';

// Cache público só para respostas de sucesso da base IBGE (dados que só mudam
// com nova migration).
export const GEO_PUBLIC_CACHE = 'public, max-age=86400';
// Erros (400/404/500) não podem ficar em cache de proxy/CDN.
export const GEO_ERROR_CACHE = 'no-store';

// Começa com no-store e troca para o cache público quando o handler termina
// sem erro. Erros de pipe, do handler ou do PgErrorFilter mantêm no-store.
// Rotas com @Res() (ex.: /cities/all) já enviaram a resposta e definem o
// header por conta própria; aqui não se mexe em resposta já enviada.
@Injectable()
export class GeoCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();
    res.setHeader('Cache-Control', GEO_ERROR_CACHE);
    return next.handle().pipe(
      tap(() => {
        if (!res.headersSent) res.setHeader('Cache-Control', GEO_PUBLIC_CACHE);
      }),
    );
  }
}
