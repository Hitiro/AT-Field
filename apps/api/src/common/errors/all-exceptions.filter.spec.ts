import { afterEach, describe, expect, it, vi } from 'vitest';
import * as nestCommon from '@nestjs/common';
import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ERROR_CODES } from '@at-field/dto';
import { ZodValidationException } from 'nestjs-zod';
import { QueryFailedError } from 'typeorm';
import { z } from 'zod';
import {
  AllExceptionsFilter,
  genericCode,
  safeReason,
} from './all-exceptions.filter';
import { AppException } from './app.exception';

const REQUEST_ID = 'req-12345678';

const setup = (
  options: {
    headersSent?: boolean;
    cacheControl?: string;
    requestId?: string;
    databasePort?: number;
  } = {},
) => {
  const headers: Record<string, string> = {};
  if (options.cacheControl) headers['cache-control'] = options.cacheControl;
  const json = vi.fn();
  const res = {
    headersSent: options.headersSent ?? false,
    locals: {} as Record<string, unknown>,
    setHeader: vi.fn((name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    }),
    getHeader: (name: string) => headers[name.toLowerCase()],
    status: vi.fn(() => ({ json })),
  };
  const req: { requestId?: string } = {
    requestId: 'requestId' in options ? options.requestId : REQUEST_ID,
  };
  const host = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ArgumentsHost;
  const run = (exception: unknown) => {
    new AllExceptionsFilter(options.databasePort).catch(exception, host);
    return {
      status: (res.status.mock.calls[0] as unknown[] | undefined)?.[0],
      body: json.mock.calls[0]?.[0] as Record<string, unknown> | undefined,
    };
  };
  return { run, res, req, headers, json };
};

const pgError = (code: string, message = 'falhou') =>
  new QueryFailedError(
    'INSERT INTO users ("cpf") VALUES ($1)',
    ['52998224725'],
    Object.assign(new Error(message), {
      code,
      detail: 'Key (cpf)=(52998224725) already exists.',
    }),
  );

// Toda classe exportada pelo @nestjs/common que estende HttpException.
const nestHttpExceptions = Object.entries(
  nestCommon as Record<string, unknown>,
).filter(
  (entry): entry is [string, new () => HttpException] =>
    typeof entry[1] === 'function' &&
    (entry[1] as { prototype?: unknown }).prototype instanceof HttpException,
);

const spyLogger = () =>
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

const spyWarn = () =>
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

type LoggedFields = Record<string, any> & {
  error: Record<string, any>;
};

// Mensagem e campos (errorLogFields) da primeira chamada de logger.error.
const loggedCall = (log: ReturnType<typeof spyLogger>) => {
  const [message, fields] = log.mock.calls[0] as unknown as [
    string,
    LoggedFields,
  ];
  return { message, fields };
};

describe('AllExceptionsFilter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('AppException: status, código, mensagem do catálogo e details', () => {
    const { run, headers, res } = setup();
    const { status, body } = run(
      new AppException('ROL-006', { permissions: ['foo:bar'] }),
    );
    expect(status).toBe(400);
    expect(body).toEqual({
      code: 'ROL-006',
      message: ERROR_CODES['ROL-006'].message,
      requestId: REQUEST_ID,
      details: { permissions: ['foo:bar'] },
    });
    expect(headers['x-request-id']).toBe(REQUEST_ID);
    expect(headers['cache-control']).toBe('no-store');
    expect(res.locals.error).toEqual({ code: 'ROL-006' });
  });

  it('sem details não inclui a chave', () => {
    const { run } = setup();
    expect(run(new AppException('USR-006')).body).not.toHaveProperty('details');
  });

  it('ZodValidationException vira VAL-001 com os issues', () => {
    const { run } = setup();
    const error = z
      .object({ owner: z.object({ cpf: z.string() }) })
      .safeParse({ owner: { cpf: 1 } }).error;
    const { status, body } = run(new ZodValidationException(error));
    expect(status).toBe(400);
    expect(body).toMatchObject({
      code: 'VAL-001',
      details: { issues: [{ path: 'owner.cpf', code: 'invalid_type' }] },
    });
  });

  it('ZodValidationException sem ZodError (bug no transform) vira 500', () => {
    const log = spyLogger();
    const { run } = setup();
    const { status, body } = run(
      new ZodValidationException(new TypeError('quebrou no transform')),
    );
    expect(status).toBe(500);
    expect(body?.code).toBe('GEN-500');
    const { message, fields } = loggedCall(log);
    expect(message).toBe('Erro inesperado');
    expect(fields).toMatchObject({
      code: 'GEN-500',
      status: 500,
      source: 'ZodValidationPipe',
      error: { name: 'TypeError', message: 'quebrou no transform' },
    });
  });

  it.each([
    ['23505', 409, 'DB-001'],
    ['23503', 409, 'DB-002'],
    ['22P02', 400, 'DB-003'],
    ['23502', 400, 'DB-004'],
    ['22001', 400, 'DB-007'],
    ['22007', 400, 'DB-009'],
    ['40P01', 409, 'DB-010'],
    ['22021', 400, 'DB-013'],
  ])(
    'QueryFailedError %s vira %i %s com log warn (não error)',
    (pgCode, expected, code) => {
      const log = spyLogger();
      const warn = spyWarn();
      const { run, res } = setup();
      const { status, body } = run(pgError(pgCode));
      expect(status).toBe(expected);
      expect(body).toEqual({
        code,
        message: ERROR_CODES[code as keyof typeof ERROR_CODES].message,
        requestId: REQUEST_ID,
      });
      expect(res.locals.error).toEqual({ code, db: { pgCode } });
      expect(log).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(1);
      const [message, fields] = warn.mock.calls[0] as unknown as [
        string,
        LoggedFields,
      ];
      expect(message).toBe('Violação no banco');
      expect(fields).toMatchObject({ code, status: expected, pgCode });
      expect(JSON.stringify(fields)).not.toContain('52998224725');
    },
  );

  it('23502 (NOT NULL): warn com coluna, tabela, query e stack, sem detail', () => {
    const warn = spyWarn();
    const { run, res } = setup();
    const error = new QueryFailedError(
      'INSERT INTO "users"("cpf", "name", "email") VALUES ($1, $2, $3)',
      ['52998224725', 'Ana', 'ana@teste.com'],
      Object.assign(
        new Error(
          'null value in column "name" of relation "users" violates not-null constraint',
        ),
        {
          code: '23502',
          severity: 'ERROR',
          schema: 'public',
          table: 'users',
          column: 'name',
          routine: 'ExecConstraints',
          detail: 'Failing row contains (52998224725, null, ana@teste.com).',
        },
      ),
    );
    expect(run(error)).toMatchObject({ status: 400, body: { code: 'DB-004' } });
    expect(res.locals.error).toEqual({
      code: 'DB-004',
      db: { pgCode: '23502', table: 'users', column: 'name' },
    });
    const [, fields] = warn.mock.calls[0] as unknown as [string, LoggedFields];
    expect(fields).toMatchObject({
      code: 'DB-004',
      status: 400,
      pgCode: '23502',
      table: 'users',
      column: 'name',
      query: 'INSERT INTO "users"("cpf", "name", "email") VALUES ($1, $2, $3)',
      error: {
        name: 'QueryFailedError',
        severity: 'ERROR',
        schema: 'public',
        routine: 'ExecConstraints',
        message:
          'null value in column "***" of relation "***" violates not-null constraint',
      },
    });
    expect(fields.error.stack).toContain('all-exceptions.filter.spec.ts');
    const text = JSON.stringify(fields);
    expect(text).not.toContain('Failing row');
    expect(text).not.toContain('52998224725');
    expect(text).not.toContain('ana@teste.com');
  });

  it('08P01 (protocol_violation) é bug: 500 GEN-500 com log error', () => {
    const log = spyLogger();
    const { run } = setup();
    expect(run(pgError('08P01'))).toMatchObject({
      status: 500,
      body: { code: 'GEN-500' },
    });
    expect(loggedCall(log).fields).toMatchObject({
      code: 'GEN-500',
      pgCode: '08P01',
    });
  });

  it.each([
    ['08006', 'DB-012'],
    ['57P01', 'DB-012'],
    ['53300', 'DB-012'],
    ['57014', 'DB-011'],
    ['55P03', 'DB-011'],
  ])('QueryFailedError %s: 503 %s, logado sem detail', (pgCode, code) => {
    const log = spyLogger();
    const { run } = setup();
    const { status, body } = run(pgError(pgCode));
    expect(status).toBe(503);
    expect(body?.code).toBe(code);
    const { fields } = loggedCall(log);
    expect(fields).toMatchObject({
      code,
      status: 503,
      pgCode,
      query: 'INSERT INTO users ("cpf") VALUES ($1)',
      error: { name: 'QueryFailedError', pgCode },
    });
    expect(JSON.stringify(fields)).not.toContain('52998224725');
  });

  it('mensagem do Postgres com o valor sai cortada no log (message e stack)', () => {
    const log = spyLogger();
    const { run } = setup();
    run(
      pgError(
        'XX000',
        'invalid input syntax for type timestamp: "1990-99-99 ana@teste.com"',
      ),
    );
    const { error } = loggedCall(log).fields;
    expect(error.message).toBe(
      'invalid input syntax for type timestamp: "***"',
    );
    expect(error.stack).toMatch(
      /^QueryFailedError: invalid input syntax for type timestamp: "\*\*\*"\n {4}at .*all-exceptions\.filter\.spec\.ts/,
    );
    expect(JSON.stringify(error)).not.toContain('ana@teste.com');
  });

  it('erro de conexão do pg fora de QueryFailedError: 503 DB-012', () => {
    const log = spyLogger();
    const { run } = setup({ databasePort: 54310 });
    const refused = Object.assign(new Error('connect ECONNREFUSED'), {
      code: 'ECONNREFUSED',
      port: 54310,
    });
    expect(run(refused)).toMatchObject({
      status: 503,
      body: { code: 'DB-012' },
    });
    expect(loggedCall(log).fields).toMatchObject({
      code: 'DB-012',
      status: 503,
      error: { name: 'Error', code: 'ECONNREFUSED', port: 54310 },
    });
  });

  it('pool sem conexão (mensagem do pg-pool): 503 DB-012', () => {
    spyLogger();
    const { run } = setup();
    expect(
      run(new Error('timeout exceeded when trying to connect')),
    ).toMatchObject({ status: 503, body: { code: 'DB-012' } });
  });

  it('erro de rede para outra porta continua GEN-500', () => {
    spyLogger();
    const { run } = setup({ databasePort: 54310 });
    const other = Object.assign(new Error('connect ECONNREFUSED'), {
      code: 'ECONNREFUSED',
      port: 443,
    });
    expect(run(other)).toMatchObject({
      status: 500,
      body: { code: 'GEN-500' },
    });
  });

  it('QueryFailedError desconhecido: 500 e log sem parâmetros nem detail', () => {
    const log = spyLogger();
    const { run } = setup();
    const { status, body } = run(pgError('XX000'));
    expect(status).toBe(500);
    expect(body?.code).toBe('GEN-500');
    expect(JSON.stringify(body)).not.toContain('falhou');

    const { fields } = loggedCall(log);
    expect(fields.error.stack).toContain('all-exceptions.filter.spec.ts');
    expect(fields).toMatchObject({ code: 'GEN-500', pgCode: 'XX000' });
    expect(fields.error).not.toHaveProperty('detail');
    expect(fields.error).not.toHaveProperty('parameters');
    expect(JSON.stringify(fields)).not.toContain('52998224725');
  });

  it.each([
    [
      new BadRequestException('Validation failed (numeric string is expected)'),
      400,
      'GEN-400',
    ],
    [new NotFoundException('Cannot GET /nada'), 404, 'GEN-404'],
    [new PayloadTooLargeException(), 413, 'GEN-413'],
    [new HttpException("I'm a teapot", 418), 418, 'GEN-418'],
    [new HttpException('Too Many Requests', 429), 429, 'GEN-429'],
    // Último recurso: status fora do catálogo mantém o status HTTP.
    [new HttpException('Unavailable For Legal Reasons', 451), 451, 'GEN-400'],
  ])(
    'HttpException %#: mantém o status e usa código genérico',
    (error, expected, code) => {
      const { run, res } = setup();
      const { status, body } = run(error);
      expect(status).toBe(expected);
      expect(body).toEqual({
        code,
        message: ERROR_CODES[code as keyof typeof ERROR_CODES].message,
        requestId: REQUEST_ID,
      });
      expect(res.locals.error).toEqual({ code, reason: error.message });
    },
  );

  it('HttpException 5xx usa GEN-<status> e é logada', () => {
    const log = spyLogger();
    const { run } = setup();
    const { status, body } = run(new HttpException('quebrou', 503));
    expect(status).toBe(503);
    expect(body?.code).toBe('GEN-503');
    expect(JSON.stringify(body)).not.toContain('quebrou');
    expect(log).toHaveBeenCalled();
  });

  it('HttpException 5xx fora do catálogo: GEN-500 mantendo o status', () => {
    spyLogger();
    const { run } = setup();
    expect(run(new HttpException('x', 507))).toMatchObject({
      status: 507,
      body: { code: 'GEN-500' },
    });
    expect(genericCode(599)).toBe('GEN-500');
    expect(genericCode(499)).toBe('GEN-400');
  });

  it('acha as HttpException embutidas do Nest', () => {
    const names = nestHttpExceptions.map(([name]) => name);
    expect(names).toEqual(
      expect.arrayContaining([
        'BadRequestException',
        'UnsupportedMediaTypeException',
        'ImATeapotException',
        'HttpVersionNotSupportedException',
      ]),
    );
    expect(names.length).toBeGreaterThanOrEqual(21);
  });

  it.each(nestHttpExceptions)(
    '%s tem GEN-<status> no catálogo com o mesmo status',
    (_, Exception) => {
      spyLogger();
      const exception = new Exception();
      const httpStatus = exception.getStatus();
      const code = `GEN-${httpStatus}`;
      expect(ERROR_CODES).toHaveProperty([code]);
      expect(ERROR_CODES[code as keyof typeof ERROR_CODES].status).toBe(
        httpStatus,
      );
      const { run } = setup();
      expect(run(exception)).toMatchObject({
        status: httpStatus,
        body: { code },
      });
    },
  );

  it('erro de JSON malformado não leva trecho do corpo para o reason', () => {
    const { run, res } = setup();
    run(
      new BadRequestException(
        'Unexpected token \'x\', "{"cpf":"52998224725"x" is not valid JSON',
      ),
    );
    expect(res.locals.error).toEqual({
      code: 'GEN-400',
      reason: 'JSON malformado',
    });
  });

  it('404 do roteador não leva a query string para o reason', () => {
    const { run, res } = setup();
    run(new NotFoundException('Cannot GET /x?email=a@b.com&cpf=52998224725'));
    expect(res.locals.error).toEqual({
      code: 'GEN-404',
      reason: 'Cannot GET /x',
    });
    expect(JSON.stringify(res.locals)).not.toContain('a@b.com');
  });

  it('safeReason tira query string de qualquer mensagem e corta em 200', () => {
    expect(safeReason('Falhou em /a?x=1 e /b?y=2 fim')).toBe(
      'Falhou em /a e /b fim',
    );
    expect(safeReason('?cpf=52998224725')).toBeUndefined();
    expect(safeReason('x'.repeat(300))).toHaveLength(200);
    expect(safeReason(undefined)).toBeUndefined();
  });

  it('safeReason tira também o fragmento (#)', () => {
    expect(safeReason('Cannot GET /x#email=a@b.com')).toBe('Cannot GET /x');
    expect(safeReason('Cannot GET /x?q=1#frag')).toBe('Cannot GET /x');
  });

  it('reason vazio não aparece em res.locals.error', () => {
    const { run, res } = setup();
    run(new NotFoundException('?cpf=52998224725'));
    expect(res.locals.error).toEqual({ code: 'GEN-404' });
    expect(res.locals.error).not.toHaveProperty('reason');
  });

  it('objeto http-errors 415 (charset do body-parser) vira GEN-415', () => {
    const { run, res } = setup();
    const error = Object.assign(new Error('unsupported charset "LATIN1"'), {
      status: 415,
      statusCode: 415,
      expose: true,
      type: 'charset.unsupported',
    });
    expect(run(error)).toMatchObject({
      status: 415,
      body: { code: 'GEN-415' },
    });
    expect(res.locals.error).toEqual({
      code: 'GEN-415',
      reason: 'unsupported charset "LATIN1"',
    });
  });

  it('objeto http-errors 413 (body-parser) vira GEN-413', () => {
    const { run } = setup();
    const error = Object.assign(new Error('request entity too large'), {
      status: 413,
      statusCode: 413,
      expose: true,
      type: 'entity.too.large',
    });
    const { status, body } = run(error);
    expect(status).toBe(413);
    expect(body?.code).toBe('GEN-413');
  });

  it('Error comum vira 500 sem vazar a mensagem e loga o Error', () => {
    const log = spyLogger();
    const { run } = setup();
    const error = new Error('senha=xyz');
    const { status, body } = run(error);
    expect(status).toBe(500);
    expect(body).toEqual({
      code: 'GEN-500',
      message: ERROR_CODES['GEN-500'].message,
      requestId: REQUEST_ID,
    });
    expect(JSON.stringify(body)).not.toContain('senha');
    const { message, fields } = loggedCall(log);
    expect(message).toBe('Erro inesperado');
    expect(fields).toMatchObject({
      code: 'GEN-500',
      status: 500,
      error: { name: 'Error', message: 'senha=xyz', stack: error.stack },
      app: { version: expect.any(String), hostname: expect.any(String) },
    });
  });

  it('5xx com cadeia de cause: o log traz cada causa', () => {
    const log = spyLogger();
    const { run } = setup();
    const root = new TypeError('raiz');
    run(new Error('topo', { cause: new Error('meio', { cause: root }) }));
    const { error } = loggedCall(log).fields;
    expect(error).toMatchObject({
      message: 'topo',
      cause: { message: 'meio', cause: { name: 'TypeError', message: 'raiz' } },
    });
    expect(error.cause.cause.stack).toBe(root.stack);
  });

  it('valor que não é Error também vira 500', () => {
    spyLogger();
    const { run } = setup();
    expect(run('string lançada').status).toBe(500);
  });

  it('resposta já enviada: só registra o erro', () => {
    const log = spyLogger();
    const { run, res } = setup({ headersSent: true });
    run(new Error('depois do envio'));
    expect(res.status).not.toHaveBeenCalled();
    expect(res.setHeader).not.toHaveBeenCalled();
    const { message, fields } = loggedCall(log);
    expect(message).toBe('Erro depois de a resposta ser enviada');
    expect(fields).toMatchObject({
      code: 'GEN-500',
      headersSent: true,
      error: { message: 'depois do envio' },
    });
  });

  it('resposta já enviada com QueryFailedError: log sem detail', () => {
    const log = spyLogger();
    const { run } = setup({ headersSent: true });
    run(pgError('XX000'));
    const { fields } = loggedCall(log);
    expect(fields.error.stack).toBeDefined();
    expect(JSON.stringify(fields)).not.toContain('52998224725');
  });

  it('preserva Cache-Control já definido pela rota', () => {
    const { run, headers } = setup({ cacheControl: 'private, max-age=0' });
    run(new AppException('GEO-001'));
    expect(headers['cache-control']).toBe('private, max-age=0');
  });

  it('gera requestId quando a requisição não tem um', () => {
    const { run, headers, req } = setup({ requestId: undefined });
    const { body } = run(new AppException('GEO-002'));
    expect(body?.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers['x-request-id']).toBe(body?.requestId);
    expect(req.requestId).toBe(body?.requestId);
  });
});
