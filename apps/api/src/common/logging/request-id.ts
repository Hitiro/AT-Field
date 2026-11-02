import { randomUUID } from 'node:crypto';
import type { LoggerService } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { requestContext, RequestContextStore } from './request-context';

export const REQUEST_ID_HEADER = 'X-Request-Id';

// Aceito do cliente/proxy só se for um id "comportado": sem espaço, vírgula
// (header duplicado) ou caracteres de HTML/log injection.
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,64}$/;

export type RequestWithId = Request & { requestId?: string };

// Erro registrado pelo AllExceptionsFilter para o log de acesso. `db` traz
// só identificadores do Postgres (nunca valores).
export type ResponseErrorInfo = {
  code: string;
  reason?: string;
  db?: {
    pgCode?: string;
    constraint?: string;
    table?: string;
    column?: string;
  };
};

export function resolveRequestId(header: unknown): string {
  return typeof header === 'string' && REQUEST_ID_PATTERN.test(header)
    ? header
    : randomUUID();
}

// Caminho sem query string nem fragmento (podem ter dado pessoal).
export const pathOf = (url: string) => url.split(/[?#]/)[0];

// Middleware Express registrado com app.use() antes do app.init(), para
// ficar à frente dos body-parsers: até erro de JSON malformado sai com id.
// Gera/reaproveita o requestId, devolve no header, abre o contexto (ALS) e
// escreve uma linha de log de acesso por requisição.
export function requestIdMiddleware(logger: LoggerService) {
  return (req: RequestWithId, res: Response, next: NextFunction) => {
    const requestId = resolveRequestId(req.headers['x-request-id']);
    const start = performance.now();
    const store: RequestContextStore = {
      requestId,
      method: req.method,
      path: pathOf(req.originalUrl ?? req.url),
      startedAt: start,
    };
    let logged = false;

    req.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    const writeAccessLog = (aborted: boolean) => {
      if (logged) return;
      logged = true;
      try {
        const status = res.statusCode;
        const url = store.path ?? pathOf(req.originalUrl ?? req.url);
        const error = (res.locals as { error?: ResponseErrorInfo }).error;
        const fields = {
          requestId,
          method: req.method,
          url,
          ...(store.route && { route: store.route }),
          status,
          durationMs: Math.round(performance.now() - start),
          ...(error?.code && { code: error.code }),
          ...(error?.reason && { reason: error.reason }),
          ...error?.db,
          ...(store.tenantId && { tenantId: store.tenantId }),
          ...(store.userId && { userId: store.userId }),
          ...(aborted && { aborted: true }),
        };
        const message = `${req.method} ${url} ${status}`;
        if (status >= 500) logger.error(message, fields, 'HTTP');
        else if (status >= 400) logger.warn(message, fields, 'HTTP');
        else logger.log(message, fields, 'HTTP');
      } catch {
        // O log de acesso nunca derruba a resposta.
      }
    };

    res.on('finish', () => writeAccessLog(false));
    res.on('close', () => {
      if (!res.writableFinished) writeAccessLog(true);
    });

    requestContext.run(store, next);
  };
}
