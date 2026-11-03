import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Response } from 'express';
import { requestContext } from './request-context';
import {
  pathOf,
  RequestWithId,
  requestIdMiddleware,
  resolveRequestId,
} from './request-id';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('pathOf', () => {
  it.each([
    ['/users?cpf=52998224725', '/users'],
    ['/users#email=a@b.com', '/users'],
    ['/users?q=1#frag', '/users'],
    ['/users/1', '/users/1'],
  ])('%s → %s', (url, expected) => {
    expect(pathOf(url)).toBe(expected);
  });
});

describe('resolveRequestId', () => {
  it.each([
    '3f1c2b9e-8a4d-4c6e-9b7a-1d2e3f4a5b6c',
    'abc12345-req',
    'a'.repeat(8),
    'a'.repeat(64),
    'lb:01.req_ab-9',
  ])('aceita %s', (value) => {
    expect(resolveRequestId(value)).toBe(value);
  });

  it.each([
    ['7 caracteres', 'a'.repeat(7)],
    ['65 caracteres', 'a'.repeat(65)],
    ['espaço', 'id com espaco'],
    ['html', '<script>'],
    ['header duplicado', 'abcdefgh,ijklmnop'],
    ['vazio', ''],
    ['array', ['abcdefgh-1', 'abcdefgh-2']],
    ['ausente', undefined],
  ])('gera UUID novo para %s', (_, value) => {
    const id = resolveRequestId(value);
    expect(id).toMatch(UUID);
    expect(id).not.toBe(value);
  });
});

const setup = (headers: Record<string, string> = {}, url = '/users?q=x') => {
  const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const responseHeaders: Record<string, string> = {};
  const locals: Record<string, unknown> = {};
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200,
    writableFinished: false,
    locals,
    setHeader: (name: string, value: string) => {
      responseHeaders[name] = value;
    },
  });
  const req = {
    method: 'GET',
    originalUrl: url,
    url,
    headers,
  } as unknown as RequestWithId;
  const middleware = requestIdMiddleware(logger);
  return { logger, res, req, middleware, responseHeaders };
};

const runMiddleware = (s: ReturnType<typeof setup>) => {
  let store: ReturnType<typeof requestContext.get>;
  const next: NextFunction = () => {
    store = requestContext.get();
    requestContext.setTenantId('tenant-1');
  };
  s.middleware(s.req, s.res as unknown as Response, next);
  return () => store;
};

describe('requestIdMiddleware', () => {
  it('reaproveita o id válido, devolve no header e roda next no contexto', () => {
    const s = setup({ 'x-request-id': 'abc12345-req' });
    const store = runMiddleware(s);
    expect(s.req.requestId).toBe('abc12345-req');
    expect(s.responseHeaders['X-Request-Id']).toBe('abc12345-req');
    expect(store()).toEqual({
      requestId: 'abc12345-req',
      tenantId: 'tenant-1',
      method: 'GET',
      path: '/users',
      startedAt: expect.any(Number),
    });
  });

  it('gera id para header inválido e não o ecoa', () => {
    const s = setup({ 'x-request-id': '<script>' });
    runMiddleware(s);
    expect(s.req.requestId).toMatch(UUID);
    expect(s.responseHeaders['X-Request-Id']).toBe(s.req.requestId);
    s.res.statusCode = 200;
    s.res.emit('finish');
    expect(JSON.stringify(s.logger.log.mock.calls)).not.toContain('<script>');
  });

  it('escreve uma linha de acesso no finish, sem query string', () => {
    const s = setup({ 'x-request-id': 'abc12345-req' });
    runMiddleware(s);
    s.res.statusCode = 200;
    s.res.emit('finish');
    s.res.writableFinished = true;
    s.res.emit('close');

    expect(s.logger.log).toHaveBeenCalledTimes(1);
    const [message, fields, context] = s.logger.log.mock.calls[0] as [
      string,
      Record<string, unknown>,
      string,
    ];
    expect(message).toBe('GET /users 200');
    expect(context).toBe('HTTP');
    expect(fields).toMatchObject({
      requestId: 'abc12345-req',
      method: 'GET',
      url: '/users',
      status: 200,
      tenantId: 'tenant-1',
    });
    expect(typeof fields.durationMs).toBe('number');
    expect(fields).not.toHaveProperty('code');
    expect(fields).not.toHaveProperty('aborted');
  });

  it.each([
    [404, 'warn'],
    [409, 'warn'],
    [500, 'error'],
    [304, 'log'],
  ] as const)(
    'status %i usa o nível %s com o código do erro',
    (status, level) => {
      const s = setup();
      runMiddleware(s);
      s.res.statusCode = status;
      s.res.locals.error = { code: 'GEN-404', reason: 'Cannot GET /x' };
      s.res.emit('finish');
      expect(s.logger[level]).toHaveBeenCalledTimes(1);
      const fields = s.logger[level].mock.calls[0][1] as Record<
        string,
        unknown
      >;
      expect(fields).toMatchObject({
        status,
        code: 'GEN-404',
        reason: 'Cannot GET /x',
      });
    },
  );

  it('erro do banco: a linha de acesso leva pgCode, tabela e coluna', () => {
    const s = setup();
    runMiddleware(s);
    s.res.statusCode = 400;
    s.res.locals.error = {
      code: 'DB-004',
      db: { pgCode: '23502', table: 'users', column: 'name' },
    };
    s.res.emit('finish');
    expect(s.logger.warn.mock.calls[0][1]).toMatchObject({
      status: 400,
      code: 'DB-004',
      pgCode: '23502',
      table: 'users',
      column: 'name',
    });
  });

  it('marca aborted quando a conexão fecha antes do fim', () => {
    const s = setup();
    runMiddleware(s);
    s.res.emit('close');
    s.res.emit('finish');
    expect(s.logger.log).toHaveBeenCalledTimes(1);
    expect(s.logger.log.mock.calls[0][1]).toMatchObject({ aborted: true });
  });

  it('erro no logger não derruba a resposta', () => {
    const s = setup();
    s.logger.log.mockImplementation(() => {
      throw new Error('disco cheio');
    });
    runMiddleware(s);
    expect(() => s.res.emit('finish')).not.toThrow();
  });
});
