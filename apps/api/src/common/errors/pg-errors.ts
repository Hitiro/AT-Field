import type { ErrorCode } from '@at-field/dto';

// SQLSTATE do Postgres → código do catálogo. As mensagens do catálogo são
// genéricas e nunca citam o valor. O resto vira GEN-500 com log.
const PG_ERROR_CODES: Record<string, ErrorCode> = {
  '23505': 'DB-001', // unique_violation (ex.: corrida entre duas requisições)
  '23503': 'DB-002', // foreign_key_violation
  '22P02': 'DB-003', // invalid_text_representation
  '23502': 'DB-004', // not_null_violation
  '23514': 'DB-005', // check_violation
  '23P01': 'DB-006', // exclusion_violation
  '22001': 'DB-007', // string_data_right_truncation
  '22003': 'DB-008', // numeric_value_out_of_range
  '22007': 'DB-009', // invalid_datetime_format
  '22008': 'DB-009', // datetime_field_overflow
  '40001': 'DB-010', // serialization_failure
  '40P01': 'DB-010', // deadlock_detected
  '55P03': 'DB-011', // lock_not_available
  '57014': 'DB-011', // query_canceled (statement_timeout)
  '57P01': 'DB-012', // admin_shutdown
  '57P02': 'DB-012', // crash_shutdown
  '57P03': 'DB-012', // cannot_connect_now
  '53300': 'DB-012', // too_many_connections
  '22021': 'DB-013', // character_not_in_repertoire (ex.: \u0000 em texto)
  '22P05': 'DB-013', // untranslatable_character
};

// Classe 08 (connection exception): banco indisponível. Exceto 08P01
// (protocol_violation), que é bug do cliente SQL (ex.: bind com número de
// parâmetros errado) e vira GEN-500 com log error.
const CONNECTION_EXCEPTION_CLASS = '08';
const NOT_CONNECTION_ERRORS = new Set(['08P01']);

// Versão do node-postgres em que as mensagens abaixo foram conferidas no
// código-fonte (pg/lib/client.js e pg-pool/index.js). Ao atualizar `pg` ou
// `pg-pool`, revise PG_DRIVER_MESSAGES e atualize esta constante; o
// pg-errors.spec falha se a versão instalada mudar sem essa revisão.
export const PG_MESSAGES_VERIFIED_FOR = { pg: '8.23', 'pg-pool': '3.14' };

// Erros do node-postgres sem SQLSTATE, por mensagem exata. Durante uma query
// o TypeORM os embrulha em QueryFailedError; na hora de pegar uma conexão do
// pool chegam como Error comum.
const PG_DRIVER_MESSAGES: Record<string, ErrorCode> = {
  'Connection terminated': 'DB-012',
  'Connection terminated unexpectedly': 'DB-012',
  'Connection terminated due to connection timeout': 'DB-012',
  'timeout exceeded when trying to connect': 'DB-012',
  'Client has encountered a connection error and is not queryable': 'DB-012',
  'Client was closed and is not queryable': 'DB-012',
  'Cannot use a pool after calling end on the pool': 'DB-012',
  'Query read timeout': 'DB-011',
};

// Falhas de rede: só valem como "banco indisponível" se vierem do driver
// (QueryFailedError) ou apontarem para a porta do banco.
const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
]);

// O que se usa de um QueryFailedError do TypeORM (o genérico do driverError
// vem como any após o instanceof).
export type QueryError = { driverError?: unknown; query?: string };

// Campos do DatabaseError do node-postgres. `detail`, `where` e
// `internalQuery` ficam de fora do log: podem trazer valores da linha.
type PgDriverError = {
  code?: unknown;
  message?: unknown;
  severity?: unknown;
  constraint?: unknown;
  table?: unknown;
  column?: unknown;
  schema?: unknown;
  dataType?: unknown;
  routine?: unknown;
  file?: unknown;
  line?: unknown;
  position?: unknown;
  hint?: unknown;
};

const driverErrorOf = (error: QueryError) =>
  (error.driverError ?? {}) as PgDriverError;

const asString = (value: unknown) =>
  typeof value === 'string' ? value : undefined;

function codeFromSqlState(sqlState: string): ErrorCode | undefined {
  if (Object.hasOwn(PG_ERROR_CODES, sqlState)) return PG_ERROR_CODES[sqlState];
  if (
    sqlState.startsWith(CONNECTION_EXCEPTION_CLASS) &&
    !NOT_CONNECTION_ERRORS.has(sqlState)
  ) {
    return 'DB-012';
  }
  return undefined;
}

const driverMessageCode = (message: unknown) =>
  typeof message === 'string' && Object.hasOwn(PG_DRIVER_MESSAGES, message)
    ? PG_DRIVER_MESSAGES[message]
    : undefined;

export function mapPgError(error: QueryError): ErrorCode | undefined {
  const { code, message } = driverErrorOf(error);
  if (typeof code === 'string') {
    if (NETWORK_ERROR_CODES.has(code)) return 'DB-012';
    const mapped = codeFromSqlState(code);
    if (mapped) return mapped;
  }
  return driverMessageCode(message);
}

type NetworkError = {
  code?: unknown;
  port?: unknown;
  errors?: unknown;
};

// Porta do erro de rede: no Node 22 o connect com vários endereços
// (localhost → ::1 e 127.0.0.1) gera AggregateError com a porta nos filhos.
function portsOf(error: NetworkError): unknown[] {
  const nested = Array.isArray(error.errors)
    ? (error.errors as NetworkError[]).map((child) => child?.port)
    : [];
  return [error.port, ...nested];
}

// Erro de conexão com o banco que não veio como QueryFailedError (ex.: o
// pool não conseguiu abrir conexão). Reconhecido só com segurança: mensagem
// exata do pg ou erro de rede para a porta do banco.
export function mapDbConnectionError(
  error: unknown,
  databasePort?: number,
): ErrorCode | undefined {
  if (!(error instanceof Error)) return undefined;
  const byMessage = driverMessageCode(error.message);
  if (byMessage) return byMessage;
  const network = error as NetworkError;
  if (
    databasePort !== undefined &&
    typeof network.code === 'string' &&
    NETWORK_ERROR_CODES.has(network.code) &&
    portsOf(network).includes(databasePort)
  ) {
    return 'DB-012';
  }
  return undefined;
}

// O Postgres cita o valor recebido entre aspas (ex.: 22P02, 22007, 22008,
// 22003: `invalid input syntax for type uuid: "abc"`). No log todo trecho
// entre aspas vira "***"; constraint, tabela e coluna seguem em pgLogFields.
export function sanitizePgMessage(message: string): string {
  return message.replace(/"(?:[^"\\]|\\.)*"/g, '"***"');
}

// Campos seguros para o log: sem `parameters` nem `driverError.detail`, que
// trazem valores da linha (CPF, e-mail). A query é o SQL com placeholders
// ($1, $2...); os valores ficam em `parameters`, que nunca é logado.
export function pgLogFields(error: QueryError) {
  const driver = driverErrorOf(error);
  const hint = asString(driver.hint);
  const fields = {
    pgCode: asString(driver.code),
    severity: asString(driver.severity),
    constraint: asString(driver.constraint),
    table: asString(driver.table),
    column: asString(driver.column),
    schema: asString(driver.schema),
    dataType: asString(driver.dataType),
    routine: asString(driver.routine),
    pgFile: asString(driver.file),
    pgLine: asString(driver.line),
    position: asString(driver.position),
    hint: hint && sanitizePgMessage(hint),
    query: error.query,
  };
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as Partial<typeof fields>;
}
