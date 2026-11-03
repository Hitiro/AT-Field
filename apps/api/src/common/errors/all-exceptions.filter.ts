import { randomUUID } from 'node:crypto';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import {
  ERROR_CODES,
  ErrorCode,
  ErrorResponse,
  isErrorCode,
} from '@at-field/dto';
import type { Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { QueryFailedError } from 'typeorm';
import { errorLogFields } from '../logging/error-log-fields';
import {
  REQUEST_ID_HEADER,
  RequestWithId,
  ResponseErrorInfo,
} from '../logging/request-id';
import { AppException } from './app.exception';
import {
  mapDbConnectionError,
  mapPgError,
  pgLogFields,
  QueryError,
} from './pg-errors';
import { toValidationDetails, ZodIssues } from './validation-details';

const MAX_REASON_LENGTH = 200;

type Resolved = {
  code: ErrorCode;
  status: number;
  details?: Record<string, unknown>;
  // Mensagem original (Nest/body-parser), só para o log de acesso.
  reason?: string;
  // Todo 5xx vai para o log error com errorLogFields (stack, cause, rota).
  logged?: { error: unknown; extra?: Record<string, unknown> };
  // 4xx do Postgres: em geral é validação da aplicação que deixou passar
  // (bug), então vai para o log warn com errorLogFields completo.
  warned?: { error: unknown };
  // Campos seguros do Postgres para a linha de acesso.
  db?: ResponseErrorInfo['db'];
};

// http-errors (body-parser): status 4xx com expose = true, ex.: 413 e 415.
type HttpErrorLike = { status: number; expose: true; message?: unknown };

const isExposedHttpError = (value: unknown): value is HttpErrorLike => {
  if (typeof value !== 'object' || value === null) return false;
  const { status, expose } = value as { status?: unknown; expose?: unknown };
  return (
    typeof status === 'number' &&
    status >= 400 &&
    status < 500 &&
    expose === true
  );
};

const hasIssues = (value: unknown): value is ZodIssues =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray((value as { issues?: unknown }).issues);

// Mensagem original só para o log de acesso, sem dado do cliente: o erro de
// JSON malformado do body-parser cita trechos do corpo, e o 404 do roteador
// ("Cannot GET /x?cpf=...") traz a URL com query string e fragmento.
export function safeReason(message: unknown): string | undefined {
  if (typeof message !== 'string' || message === '') return undefined;
  if (/JSON/i.test(message)) return 'JSON malformado';
  const reason = message.replace(/[?#]\S*/g, '').trim();
  return reason === '' ? undefined : reason.slice(0, MAX_REASON_LENGTH);
}

// GEN-<status> para todo status do catálogo (cobre todas as HttpException
// embutidas do Nest). Status fora dele, só como último recurso: GEN-400 ou
// GEN-500, mantendo o status HTTP original na resposta.
export function genericCode(status: number): ErrorCode {
  const code = `GEN-${status}`;
  if (isErrorCode(code)) return code;
  return status < 500 ? 'GEN-400' : 'GEN-500';
}

// Só identificadores (código, constraint, tabela, coluna): nunca valores.
function accessDbFields(error: QueryError): ResponseErrorInfo['db'] {
  const { pgCode, constraint, table, column } = pgLogFields(error);
  const db = { pgCode, constraint, table, column };
  const present = Object.entries(db).filter(([, value]) => value !== undefined);
  return present.length > 0 ? Object.fromEntries(present) : undefined;
}

const internal = (
  exception: unknown,
  extra?: Record<string, unknown>,
): Resolved => ({
  code: 'GEN-500',
  status: 500,
  logged: { error: exception, extra },
});

function resolve(exception: unknown, databasePort?: number): Resolved {
  if (exception instanceof AppException) {
    return {
      code: exception.code,
      status: exception.getStatus(),
      details: exception.details,
    };
  }

  if (exception instanceof ZodValidationException) {
    const zodError = exception.getZodError();
    // Exceção dentro de um transform do schema não é ZodError: é bug. O
    // handler e a rota do log apontam qual schema; `source` diz que foi na
    // validação.
    if (!hasIssues(zodError)) {
      return internal(zodError ?? exception, { source: 'ZodValidationPipe' });
    }
    return {
      code: 'VAL-001',
      status: ERROR_CODES['VAL-001'].status,
      details: toValidationDetails(zodError),
    };
  }

  if (exception instanceof QueryFailedError) {
    const code = mapPgError(exception) ?? 'GEN-500';
    const { status } = ERROR_CODES[code];
    const db = accessDbFields(exception);
    // 4xx do Postgres (DB-001..010, DB-013): log warn com tudo para depurar;
    // 5xx (banco ocupado/indisponível ou não mapeado): log error.
    return status < 500
      ? { code, status, db, warned: { error: exception } }
      : { code, status, db, logged: { error: exception } };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const code = genericCode(status);
    return status >= 500
      ? { code, status, logged: { error: exception } }
      : { code, status, reason: safeReason(exception.message) };
  }

  if (isExposedHttpError(exception)) {
    return {
      code: genericCode(exception.status),
      status: exception.status,
      reason: safeReason(exception.message),
    };
  }

  const connection = mapDbConnectionError(exception, databasePort);
  if (connection) {
    return {
      code: connection,
      status: ERROR_CODES[connection].status,
      logged: { error: exception },
    };
  }

  return internal(exception);
}

// Filtro único: toda resposta de erro sai como { code, message, requestId,
// details? } com o header X-Request-Id. 5xx nunca leva a mensagem original;
// o log error leva tudo para depurar (errorLogFields), sem dado pessoal.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  // Porta do Postgres, para reconhecer erro de rede do banco que não chega
  // como QueryFailedError (ex.: ECONNREFUSED ao abrir conexão do pool).
  constructor(private readonly databasePort?: number) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const req = http.getRequest<RequestWithId>();
    const res = http.getResponse<Response>();

    // Rota com @Res() que falhou depois de enviar a resposta.
    if (res.headersSent) {
      this.logger.error(
        'Erro depois de a resposta ser enviada',
        errorLogFields(exception, {
          code: 'GEN-500',
          status: res.statusCode,
          headersSent: true,
        }),
      );
      return;
    }

    const { code, status, details, reason, logged, warned, db } = resolve(
      exception,
      this.databasePort,
    );

    let requestId = req.requestId;
    if (!requestId) {
      requestId = randomUUID();
      req.requestId = requestId;
    }
    res.setHeader(REQUEST_ID_HEADER, requestId);
    if (!res.getHeader('Cache-Control')) {
      res.setHeader('Cache-Control', 'no-store');
    }

    const info: ResponseErrorInfo = {
      code,
      ...(reason && { reason }),
      ...(db && { db }),
    };
    res.locals.error = info;

    if (logged) {
      this.logger.error(
        'Erro inesperado',
        errorLogFields(logged.error, { code, status, ...logged.extra }),
      );
    }
    if (warned) {
      this.logger.warn(
        'Violação no banco',
        errorLogFields(warned.error, { code, status }),
      );
    }

    const body: ErrorResponse = {
      code,
      message: ERROR_CODES[code].message,
      requestId,
      ...(details && { details }),
    };
    res.status(status).json(body);
  }
}
