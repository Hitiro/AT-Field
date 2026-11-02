import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryFailedError } from 'typeorm';
import { AppLogger } from './app-logger';
import {
  appInfo,
  errorLogFields,
  MAX_CAUSE_DEPTH,
  serializeError,
} from './error-log-fields';
import { requestContext } from './request-context';

const CPF = '52998224725';

// Erro do Postgres como o node-postgres entrega (DatabaseError), embrulhado
// pelo TypeORM.
const pgFailure = (
  message = 'duplicate key value violates unique constraint',
) =>
  new QueryFailedError(
    'INSERT INTO users ("cpf", "email") VALUES ($1, $2)',
    [CPF, 'ana@teste.com'],
    Object.assign(new Error(message), {
      name: 'error',
      severity: 'ERROR',
      code: '23505',
      detail: `Key (cpf)=(${CPF}) already exists.`,
      where: `PL/pgSQL function x() line 3 at ${CPF}`,
      schema: 'public',
      table: 'users',
      column: 'cpf',
      dataType: 'character varying',
      constraint: 'UQ_users_cpf',
      file: 'nbtinsert.c',
      line: '666',
      routine: '_bt_check_unique',
      position: '12',
    }),
  );

describe('serializeError', () => {
  it('traz name, message, stack e propriedades primitivas', () => {
    const error = Object.assign(new Error('falhou'), {
      code: 'E_X',
      attempt: 2,
      retriable: false,
      payload: { nested: true },
    });
    expect(serializeError(error)).toEqual({
      name: 'Error',
      message: 'falhou',
      stack: error.stack,
      code: 'E_X',
      attempt: 2,
      retriable: false,
    });
  });

  it('segue a cadeia de cause recursivamente', () => {
    const root = new RangeError('raiz');
    const error = new Error('topo', {
      cause: new Error('meio', { cause: root }),
    });
    expect(serializeError(error)).toMatchObject({
      message: 'topo',
      cause: {
        message: 'meio',
        stack: expect.stringContaining('meio'),
        cause: { name: 'RangeError', message: 'raiz', stack: root.stack },
      },
    });
  });

  it(`corta a cadeia em ${MAX_CAUSE_DEPTH} níveis e trata ciclo`, () => {
    let error = new Error('nível 0');
    for (let i = 1; i <= 8; i += 1) {
      error = new Error(`nível ${i}`, { cause: error });
    }
    let node = serializeError(error);
    for (let depth = 1; depth < MAX_CAUSE_DEPTH; depth += 1) {
      node = node.cause as Record<string, unknown>;
      expect(node.message).toBe(`nível ${8 - depth}`);
    }
    expect(node.cause).toEqual({ truncated: true });

    const a = new Error('a');
    const b = new Error('b', { cause: a });
    (a as { cause?: unknown }).cause = b;
    expect(serializeError(a)).toMatchObject({
      message: 'a',
      cause: { message: 'b', cause: { name: 'Error', circular: true } },
    });
  });

  it('serializa os errors de um AggregateError', () => {
    const error = new AggregateError(
      [new Error('::1'), new Error('127.0.0.1')],
      'várias',
    );
    expect(serializeError(error).errors).toMatchObject([
      { message: '::1' },
      { message: '127.0.0.1' },
    ]);
  });

  it('valor lançado que não é Error vira só o tipo', () => {
    expect(serializeError(`cpf ${CPF}`)).toEqual({
      name: 'NonError',
      type: 'string',
    });
    expect(serializeError(null)).toEqual({ name: 'NonError', type: 'null' });
  });

  it('nunca leva detail, parameters, where, body nem input', () => {
    const error = Object.assign(new Error('x'), {
      detail: CPF,
      parameters: CPF,
      where: CPF,
      body: `{"cpf":"${CPF}"}`,
      input: CPF,
      internalQuery: CPF,
    });
    expect(JSON.stringify(serializeError(error))).not.toContain(CPF);
  });

  it('erro do Postgres: campos do servidor, query e mensagem saneada', () => {
    const error = pgFailure(`invalid input syntax for type uuid: "${CPF}"`);
    const serialized = serializeError(error);
    expect(serialized).toMatchObject({
      name: 'QueryFailedError',
      message: 'invalid input syntax for type uuid: "***"',
      pgCode: '23505',
      severity: 'ERROR',
      schema: 'public',
      table: 'users',
      column: 'cpf',
      dataType: 'character varying',
      constraint: 'UQ_users_cpf',
      routine: '_bt_check_unique',
      pgFile: 'nbtinsert.c',
      pgLine: '666',
      position: '12',
      query: 'INSERT INTO users ("cpf", "email") VALUES ($1, $2)',
    });
    expect(serialized.stack).toMatch(
      /^QueryFailedError: invalid input syntax for type uuid: "\*\*\*"\n {4}at /,
    );
    const text = JSON.stringify(serialized);
    expect(text).not.toContain(CPF);
    expect(text).not.toContain('ana@teste.com');
  });

  it('erro do Postgres dentro da cadeia de cause também é saneado', () => {
    const error = new Error('falha ao salvar', {
      cause: pgFailure(`value "${CPF}" is out of range`),
    });
    const serialized = serializeError(error);
    expect(serialized.cause).toMatchObject({
      message: 'value "***" is out of range',
      constraint: 'UQ_users_cpf',
    });
    expect(JSON.stringify(serialized)).not.toContain(CPF);
  });
});

describe('errorLogFields', () => {
  it('fora de requisição: erro, extras e processo', () => {
    const fields = errorLogFields(new Error('x'), { code: 'GEN-500' });
    expect(fields).toMatchObject({
      code: 'GEN-500',
      error: { message: 'x' },
      app: {
        version: '0.0.1',
        env: process.env.NODE_ENV,
        hostname: expect.any(String),
      },
    });
    expect(fields).not.toHaveProperty('method');
    expect(appInfo().version).toBe('0.0.1');
  });

  it('dentro da requisição: method, path, rota, handler e duração', () => {
    const fields = requestContext.run(
      {
        requestId: 'req-12345678',
        method: 'GET',
        path: '/users/1',
        route: '/users/:id',
        handler: 'UsersController.findOne',
        startedAt: performance.now() - 5,
      },
      () => errorLogFields(new Error('x'), { status: 500 }),
    );
    expect(fields).toMatchObject({
      method: 'GET',
      path: '/users/1',
      route: '/users/:id',
      handler: 'UsersController.findOne',
      status: 500,
    });
    expect(fields.durationMs).toBeGreaterThanOrEqual(4);
  });

  it('QueryFailedError: campos do Postgres também na raiz', () => {
    const fields = errorLogFields(pgFailure());
    expect(fields).toMatchObject({
      pgCode: '23505',
      constraint: 'UQ_users_cpf',
      table: 'users',
      query: 'INSERT INTO users ("cpf", "email") VALUES ($1, $2)',
    });
    expect(JSON.stringify(fields)).not.toContain(CPF);
  });
});

describe('errorLogFields + AppLogger (JSON)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mascara chave sensível dentro de cause', () => {
    const written: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation(
      (chunk: string | Uint8Array) => {
        written.push(String(chunk));
        return true;
      },
    );
    const cause = Object.assign(new Error('cadastro falhou'), {
      cpf: CPF,
      email: 'ana@teste.com',
      token: 'segredo',
    });
    new AppLogger({ json: true, level: 'log' }).error(
      'Erro inesperado',
      errorLogFields(new Error('topo', { cause })),
      'Teste',
    );
    expect(written).toHaveLength(1);
    const line = JSON.parse(written[0]) as Record<string, any>;
    expect(line.error.cause).toMatchObject({
      message: 'cadastro falhou',
      cpf: '[REDACTED]',
      email: '[REDACTED]',
      token: '[REDACTED]',
    });
    for (const secret of [CPF, 'ana@teste.com', 'segredo']) {
      expect(written[0]).not.toContain(secret);
    }
  });
});
