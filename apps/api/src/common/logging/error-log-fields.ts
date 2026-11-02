import { readFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { QueryFailedError } from 'typeorm';
import { pgLogFields, sanitizePgMessage } from '../errors/pg-errors';
import { requestContext } from './request-context';

// Campos de todo log de nível error/fatal, para depurar sem reproduzir:
//   this.logger.error('Mensagem fixa, sem dado pessoal', errorLogFields(err, { code }))
// Traz o erro serializado (name, message, stack, cadeia de cause), os campos
// do Postgres, a requisição (method, path, route, handler, durationMs) e o
// processo (app). requestId/tenantId/userId entram pelo AppLogger em toda
// linha. Dado pessoal: `detail`, `parameters`, `where`, `body` e `input` nunca
// entram; a mensagem do Postgres sai sem os trechos entre aspas; o redact do
// AppLogger mascara chaves como cpf/email/phone em qualquer profundidade.

export const MAX_CAUSE_DEPTH = 5;
const MAX_AGGREGATED_ERRORS = 10;
const MAX_PROPERTY_LENGTH = 1000;

// Propriedades de erro que podem carregar valores enviados ou da linha.
const EXCLUDED_ERROR_KEYS = new Set([
  'detail',
  'parameters',
  'where',
  'internalQuery',
  'body',
  'input',
  'driverError',
  'response',
  'config',
]);

const STACK_FRAMES = '\n    at ';

type SerializedError = Record<string, unknown>;

type PgLike = { severity?: unknown; code?: unknown };

// Erro do Postgres: embrulhado pelo TypeORM ou o DatabaseError cru do pg.
const isPgError = (error: Error) => {
  if (error instanceof QueryFailedError) return true;
  const { severity, code } = error as PgLike;
  return (
    typeof severity === 'string' &&
    typeof code === 'string' &&
    /^[0-9A-Z]{5}$/.test(code)
  );
};

// Troca a primeira linha do stack (que repete a mensagem) pela mensagem
// saneada, mantendo os frames.
function stackWithMessage(error: Error, message: string): string | undefined {
  if (typeof error.stack !== 'string') return undefined;
  const frames = error.stack.indexOf(STACK_FRAMES);
  return `${error.name}: ${message}${frames >= 0 ? error.stack.slice(frames) : ''}`;
}

function ownPrimitiveProperties(error: Error): SerializedError {
  const fields: SerializedError = {};
  for (const [key, value] of Object.entries(error)) {
    if (EXCLUDED_ERROR_KEYS.has(key) || key === 'cause' || key === 'errors') {
      continue;
    }
    if (typeof value === 'string') {
      fields[key] = value.slice(0, MAX_PROPERTY_LENGTH);
    } else if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      fields[key] = value;
    }
  }
  return fields;
}

// Serializa o erro e, recursivamente, a cadeia de `cause` e os `errors` de
// um AggregateError (até MAX_CAUSE_DEPTH níveis).
export function serializeError(
  value: unknown,
  depth = 0,
  ancestors: Set<unknown> = new Set(),
): SerializedError {
  if (!(value instanceof Error)) {
    // Valor lançado que não é Error: só o tipo (o conteúdo pode ser dado).
    return { name: 'NonError', type: value === null ? 'null' : typeof value };
  }
  if (ancestors.has(value)) return { name: value.name, circular: true };
  ancestors.add(value);

  const pg = isPgError(value);
  const message = pg ? sanitizePgMessage(value.message) : value.message;
  const serialized: SerializedError = {
    name: value.name,
    message,
    stack: pg ? stackWithMessage(value, message) : value.stack,
    ...(pg
      ? pgLogFields(
          value instanceof QueryFailedError ? value : { driverError: value },
        )
      : ownPrimitiveProperties(value)),
  };

  const nested = (child: unknown) =>
    depth + 1 >= MAX_CAUSE_DEPTH
      ? { truncated: true }
      : serializeError(child, depth + 1, ancestors);

  if (value.cause !== undefined) serialized.cause = nested(value.cause);
  const { errors } = value as { errors?: unknown };
  if (Array.isArray(errors)) {
    serialized.errors = errors.slice(0, MAX_AGGREGATED_ERRORS).map(nested);
  }

  ancestors.delete(value);
  return serialized;
}

let cachedVersion: string | undefined;

// Versão do apps/api/package.json (src/ e dist/ ficam no mesmo nível).
function appVersion(): string {
  if (cachedVersion === undefined) {
    try {
      const raw = readFileSync(
        join(__dirname, '..', '..', '..', 'package.json'),
        'utf8',
      );
      const { version } = JSON.parse(raw) as { version?: unknown };
      cachedVersion = typeof version === 'string' ? version : 'unknown';
    } catch {
      cachedVersion = 'unknown';
    }
  }
  return cachedVersion;
}

// Contexto do processo: só nas linhas de error/fatal (o pid o Nest já põe em
// toda linha). Não vai nas linhas de acesso para não repetir o mesmo valor
// em todo request; quem coleta os logs costuma anexar o host também.
export const appInfo = () => ({
  version: appVersion(),
  env: process.env.NODE_ENV,
  hostname: hostname(),
});

function requestFields() {
  const store = requestContext.get();
  if (!store) return {};
  const fields = {
    method: store.method,
    path: store.path,
    route: store.route,
    handler: store.handler,
    durationMs:
      store.startedAt === undefined
        ? undefined
        : Math.round(performance.now() - store.startedAt),
  };
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
}

export function errorLogFields(
  error: unknown,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...requestFields(),
    ...extra,
    // Campos do Postgres também na raiz, para filtrar por pgCode/constraint.
    ...(error instanceof QueryFailedError ? pgLogFields(error) : {}),
    error: serializeError(error),
    app: appInfo(),
  };
}
