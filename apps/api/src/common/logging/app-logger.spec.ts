import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { AppLogger, levelsFrom } from './app-logger';
import { errorLogFields } from './error-log-fields';
import { requestContext } from './request-context';

type Line = Record<string, any>;

let output: { stream: 'stdout' | 'stderr'; text: string }[] = [];

const capture = () => {
  output = [];
  for (const stream of ['stdout', 'stderr'] as const) {
    vi.spyOn(process[stream], 'write').mockImplementation(
      (chunk: string | Uint8Array) => {
        output.push({ stream, text: String(chunk) });
        return true;
      },
    );
  }
};

const lines = (): Line[] =>
  output.map(({ text }) => JSON.parse(text.trim()) as Line);

describe('levelsFrom', () => {
  it('devolve o nível e os mais graves', () => {
    expect(levelsFrom('warn')).toEqual(['warn', 'error', 'fatal']);
    expect(levelsFrom('verbose')).toEqual([
      'verbose',
      'debug',
      'log',
      'warn',
      'error',
      'fatal',
    ]);
    expect(levelsFrom('fatal')).toEqual(['fatal']);
  });
});

describe('AppLogger (json)', () => {
  beforeEach(capture);
  afterEach(() => vi.restoreAllMocks());

  const logger = () => new AppLogger({ json: true, level: 'log' });

  it('inclui requestId e tenantId do contexto e os params na raiz', () => {
    const appLogger = logger();
    requestContext.run({ requestId: 'r-12345678' }, () => {
      requestContext.setTenantId('t-1');
      appLogger.log('x', { a: 1 }, 'Ctx');
    });
    expect(lines()).toEqual([
      expect.objectContaining({
        level: 'log',
        message: 'x',
        context: 'Ctx',
        requestId: 'r-12345678',
        tenantId: 't-1',
        a: 1,
      }),
    ]);
    expect(output[0].stream).toBe('stdout');
    expect(output).toHaveLength(1);
  });

  it('fora de requisição não inventa requestId', () => {
    logger().log('subiu', 'Bootstrap');
    const [line] = lines();
    expect(line.message).toBe('subiu');
    expect(line).not.toHaveProperty('requestId');
  });

  it('erro sai em stderr com error.stack numa linha só', () => {
    const appLogger = logger();
    const error = new Error('quebrou');
    requestContext.run({ requestId: 'r-12345678' }, () => {
      appLogger.error('Erro inesperado', error, { code: 'GEN-500' }, 'Ctx');
    });
    expect(output).toHaveLength(1);
    expect(output[0].stream).toBe('stderr');
    const [line] = lines();
    expect(line).toMatchObject({
      level: 'error',
      message: 'Erro inesperado',
      requestId: 'r-12345678',
      code: 'GEN-500',
      error: { name: 'Error', message: 'quebrou' },
    });
    expect(line.error.stack).toContain('app-logger.spec.ts');
  });

  it('funciona via new Logger(contexto) depois do useLogger', () => {
    const appLogger = logger();
    Logger.overrideLogger(appLogger);
    try {
      requestContext.run({ requestId: 'r-12345678' }, () => {
        new Logger('Servico').warn('atenção', { pedido: 1 });
      });
    } finally {
      Logger.overrideLogger(new ConsoleLogger());
    }
    expect(lines()[0]).toMatchObject({
      level: 'warn',
      context: 'Servico',
      requestId: 'r-12345678',
      pedido: 1,
    });
  });

  it('mascara dados sensíveis e pessoais em qualquer profundidade', () => {
    logger().log('dados', {
      cpf: '52998224725',
      authorization: 'Bearer abc',
      owner: { email: 'ana@teste.com', phone: '45999999999', name: 'Ana' },
      headers: { Cookie: 'sid=1', 'X-Api-Key': 'k' },
      tenant: { document: '11222333000181' },
      password: 'p',
      token: 't',
    });
    const [line] = lines();
    expect(line).toMatchObject({
      cpf: '[REDACTED]',
      authorization: '[REDACTED]',
      owner: { email: '[REDACTED]', phone: '[REDACTED]', name: 'Ana' },
      headers: { Cookie: '[REDACTED]', 'X-Api-Key': '[REDACTED]' },
      tenant: { document: '[REDACTED]' },
      password: '[REDACTED]',
      token: '[REDACTED]',
    });
    for (const secret of [
      '52998224725',
      'ana@teste.com',
      '45999999999',
      'abc',
    ]) {
      expect(output[0].text).not.toContain(secret);
    }
  });

  it('mascara as variantes de chave usadas no projeto (casamento exato)', () => {
    logger().log('variantes', {
      empresa: { cnpj: '11222333000181', telefones: ['4398765432'] },
      mensagem: { remetenteTelefone: '43900000001', telefone: '43911112222' },
      user: { firebaseUid: 'uid-secreto' },
      env: { DATABASE_PASSWORD: 'senha-do-banco' },
      // Chave composta não listada não é pega: precisa entrar na lista.
      ownerEmail: 'naolistado@teste.com',
    });
    const [line] = lines();
    expect(line).toMatchObject({
      empresa: { cnpj: '[REDACTED]', telefones: '[REDACTED]' },
      mensagem: { remetenteTelefone: '[REDACTED]', telefone: '[REDACTED]' },
      user: { firebaseUid: '[REDACTED]' },
      env: { DATABASE_PASSWORD: '[REDACTED]' },
      ownerEmail: 'naolistado@teste.com',
    });
    for (const secret of [
      '11222333000181',
      '4398765432',
      '43900000001',
      '43911112222',
      'uid-secreto',
      'senha-do-banco',
    ]) {
      expect(output[0].text).not.toContain(secret);
    }
  });

  it('não escreve níveis abaixo do configurado', () => {
    const appLogger = new AppLogger({ json: true, level: 'warn' });
    appLogger.log('não sai');
    appLogger.debug('não sai');
    appLogger.warn('sai');
    expect(lines().map((line) => String(line.message))).toEqual(['sai']);
  });
});

describe('AppLogger (pretty)', () => {
  beforeEach(capture);
  afterEach(() => vi.restoreAllMocks());

  it('escreve texto com o requestId do contexto', () => {
    const appLogger = new AppLogger({ json: false, level: 'log' });
    requestContext.run({ requestId: 'r-12345678' }, () => {
      appLogger.log('texto', 'Ctx');
    });
    expect(output).toHaveLength(1);
    expect(output[0].text).toContain('texto');
    expect(output[0].text).toContain('r-12345678');
  });

  it('erro com errorLogFields: stack sai como bloco legível depois da linha', () => {
    const appLogger = new AppLogger({ json: false, level: 'log' });
    const error = new Error('quebrou');
    appLogger.error('Erro inesperado', errorLogFields(error), 'Ctx');
    expect(output).toHaveLength(2);
    expect(output[0].text).toContain('Erro inesperado');
    expect(output[0].text).not.toContain('\\n    at ');
    expect(output[1]).toEqual({ stream: 'stderr', text: `${error.stack}\n` });
  });
});

describe('AppLogger: campos da requisição', () => {
  beforeEach(capture);
  afterEach(() => vi.restoreAllMocks());

  it('toda linha leva só a identidade (requestId/tenantId/userId)', () => {
    requestContext.run(
      {
        requestId: 'r-12345678',
        tenantId: 't-1',
        method: 'GET',
        path: '/users',
        route: '/users',
        handler: 'UsersController.list',
        startedAt: 1,
      },
      () => new AppLogger({ json: true, level: 'log' }).log('x'),
    );
    const [line] = lines();
    expect(line).toMatchObject({ requestId: 'r-12345678', tenantId: 't-1' });
    for (const key of ['method', 'path', 'route', 'handler', 'startedAt']) {
      expect(line).not.toHaveProperty(key);
    }
  });
});
