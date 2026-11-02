import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@at-field/dto';
import { QueryFailedError } from 'typeorm';
import {
  mapDbConnectionError,
  mapPgError,
  PG_MESSAGES_VERIFIED_FOR,
  pgLogFields,
  sanitizePgMessage,
} from './pg-errors';

// major.minor da versão instalada, resolvida como a API resolve em runtime.
// O pg-pool não exporta ./package.json: parte da entrada principal e sobe até
// o package.json do pacote.
const resolveFromApi = createRequire(__filename).resolve;
const installedMinor = (name: 'pg' | 'pg-pool') => {
  let dir = dirname(resolveFromApi(name));
  for (;;) {
    const file = join(dir, 'package.json');
    if (existsSync(file)) {
      const pkg = JSON.parse(readFileSync(file, 'utf8')) as {
        name?: string;
        version: string;
      };
      if (pkg.name === name) {
        return pkg.version.split('.').slice(0, 2).join('.');
      }
    }
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`package.json de ${name} não achado`);
    dir = parent;
  }
};

describe('mensagens do driver conferidas para a versão instalada', () => {
  it.each(['pg', 'pg-pool'] as const)('%s', (name) => {
    expect(
      installedMinor(name),
      `${name} mudou de versão: revise PG_DRIVER_MESSAGES em pg-errors.ts ` +
        `contra o código-fonte do ${name} e atualize PG_MESSAGES_VERIFIED_FOR.`,
    ).toBe(PG_MESSAGES_VERIFIED_FOR[name]);
  });
});

const pgError = (code?: string, extra: Record<string, unknown> = {}) =>
  new QueryFailedError(
    'INSERT INTO users ("cpf") VALUES ($1)',
    ['52998224725'],
    Object.assign(new Error('pg'), { code, ...extra }),
  );

const driverError = (message: string, extra: Record<string, unknown> = {}) =>
  new QueryFailedError(
    'SELECT 1',
    [],
    Object.assign(new Error(message), extra),
  );

describe('mapPgError', () => {
  it.each([
    ['23505', 'DB-001', 409],
    ['23503', 'DB-002', 409],
    ['22P02', 'DB-003', 400],
    ['23502', 'DB-004', 400],
    ['23514', 'DB-005', 400],
    ['23P01', 'DB-006', 409],
    ['22001', 'DB-007', 400],
    ['22003', 'DB-008', 400],
    ['22007', 'DB-009', 400],
    ['22008', 'DB-009', 400],
    ['40001', 'DB-010', 409],
    ['40P01', 'DB-010', 409],
    ['55P03', 'DB-011', 503],
    ['57014', 'DB-011', 503],
    ['08000', 'DB-012', 503],
    ['08001', 'DB-012', 503],
    ['08003', 'DB-012', 503],
    ['08004', 'DB-012', 503],
    ['08006', 'DB-012', 503],
    ['57P01', 'DB-012', 503],
    ['57P02', 'DB-012', 503],
    ['57P03', 'DB-012', 503],
    ['53300', 'DB-012', 503],
    ['22021', 'DB-013', 400],
    ['22P05', 'DB-013', 400],
  ] as const)('traduz %s para %s (%i)', (code, expected, status) => {
    expect(mapPgError(pgError(code))).toBe(expected);
    expect(ERROR_CODES[expected].status).toBe(status);
  });

  it('não mapeia códigos desconhecidos ou ausentes', () => {
    // 08P01 (protocol_violation) é bug do cliente SQL, não banco fora.
    for (const code of [
      'XX000',
      '22012',
      '42P01',
      '08P01',
      'toString',
      undefined,
    ]) {
      expect(mapPgError(pgError(code)), String(code)).toBeUndefined();
    }
  });

  it.each([
    ['Connection terminated unexpectedly', 'DB-012'],
    ['Connection terminated', 'DB-012'],
    [
      'Client has encountered a connection error and is not queryable',
      'DB-012',
    ],
    ['Client was closed and is not queryable', 'DB-012'],
    ['Query read timeout', 'DB-011'],
  ])('erro do driver sem SQLSTATE "%s" vira %s', (message, expected) => {
    expect(mapPgError(driverError(message))).toBe(expected);
  });

  it('erro de rede vindo do driver vira DB-012', () => {
    expect(mapPgError(driverError('x', { code: 'ECONNRESET' }))).toBe('DB-012');
  });

  it('mensagem parecida, mas não exata, não é mapeada', () => {
    expect(mapPgError(driverError('conexão perdida'))).toBeUndefined();
    expect(
      mapPgError(driverError('Connection terminated by user code')),
    ).toBeUndefined();
  });
});

describe('mapDbConnectionError', () => {
  const PORT = 54310;
  const network = (code: string, port: number) =>
    Object.assign(new Error(`connect ${code}`), { code, port });

  it('reconhece as mensagens exatas do pg e do pg-pool', () => {
    for (const message of [
      'Connection terminated unexpectedly',
      'Connection terminated due to connection timeout',
      'timeout exceeded when trying to connect',
      'Cannot use a pool after calling end on the pool',
    ]) {
      expect(mapDbConnectionError(new Error(message), PORT), message).toBe(
        'DB-012',
      );
    }
  });

  it('erro de rede só conta se for para a porta do banco', () => {
    expect(mapDbConnectionError(network('ECONNREFUSED', PORT), PORT)).toBe(
      'DB-012',
    );
    expect(
      mapDbConnectionError(network('ECONNREFUSED', 443), PORT),
    ).toBeUndefined();
    // Sem a porta configurada não arrisca.
    expect(mapDbConnectionError(network('ECONNREFUSED', PORT))).toBeUndefined();
  });

  it('AggregateError do Node 22 (localhost → ::1 e 127.0.0.1)', () => {
    const error = Object.assign(
      new AggregateError(
        [network('ECONNREFUSED', PORT), network('ECONNREFUSED', PORT)],
        '',
      ),
      { code: 'ECONNREFUSED' },
    );
    expect(mapDbConnectionError(error, PORT)).toBe('DB-012');
  });

  it('ignora o que não é Error ou não é do banco', () => {
    expect(mapDbConnectionError('Connection terminated', PORT)).toBeUndefined();
    expect(mapDbConnectionError(new Error('boom'), PORT)).toBeUndefined();
    expect(
      mapDbConnectionError(
        Object.assign(new Error('x'), { code: 'EACCES', port: PORT }),
        PORT,
      ),
    ).toBeUndefined();
  });
});

describe('sanitizePgMessage', () => {
  it.each([
    [
      'invalid input syntax for type uuid: "nao-e-uuid"',
      'invalid input syntax for type uuid: "***"',
    ],
    [
      'invalid input syntax for type timestamp: "2020-99-99 ana@teste.com"',
      'invalid input syntax for type timestamp: "***"',
    ],
    [
      'date/time field value out of range: "2020-13-45"',
      'date/time field value out of range: "***"',
    ],
    [
      'value "99999999999" is out of range for type integer',
      'value "***" is out of range for type integer',
    ],
    [
      'invalid input syntax for type json: "com \\"aspas\\" dentro"',
      'invalid input syntax for type json: "***"',
    ],
    [
      'value too long for type character varying(255)',
      'value too long for type character varying(255)',
    ],
  ])('%s', (message, expected) => {
    expect(sanitizePgMessage(message)).toBe(expected);
  });
});

describe('pgLogFields', () => {
  it('traz código, constraint, tabela, coluna e query, sem parâmetros nem detail', () => {
    const fields = pgLogFields(
      pgError('23505', {
        constraint: 'UQ_users_cpf',
        table: 'users',
        column: 'cpf',
        detail: 'Key (cpf)=(52998224725) already exists.',
      }),
    );
    expect(fields).toEqual({
      pgCode: '23505',
      constraint: 'UQ_users_cpf',
      table: 'users',
      column: 'cpf',
      query: 'INSERT INTO users ("cpf") VALUES ($1)',
    });
    expect(JSON.stringify(fields)).not.toContain('52998224725');
  });
});
