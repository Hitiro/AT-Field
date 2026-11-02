import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { INestApplication, LOG_LEVELS } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { EntityManager, QueryFailedError } from 'typeorm';
import { AppLogger, levelsFrom } from '../src/common/logging/app-logger';
import { GeoService } from '../src/geo/geo.service';
import { TenantsService } from '../src/tenants/tenants.service';
import {
  createTestApp,
  expectError,
  makeCnpj,
  person,
  resetDatabase,
  signup,
} from './utils';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type LogLine = Record<string, any>;

const pgError = (code: string) =>
  new QueryFailedError(
    'INSERT INTO users ("cpf") VALUES ($1)',
    ['52998224725'],
    Object.assign(new Error('falha no banco'), {
      code,
      detail: 'Key (cpf)=(52998224725) already exists.',
    }),
  );

describe('Erros, requestId e logs (e2e)', () => {
  let app: INestApplication<App>;
  let written: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    written = [];
    for (const stream of ['stdout', 'stderr'] as const) {
      const original = process[stream].write.bind(process[stream]);
      vi.spyOn(process[stream], 'write').mockImplementation(
        (chunk: unknown, ...rest: unknown[]) => {
          const text = String(chunk);
          // Só captura as linhas do AppLogger; o resto segue para o terminal.
          if (text.startsWith('{"level"')) {
            written.push(text);
            return true;
          }
          return (original as (...args: unknown[]) => boolean)(chunk, ...rest);
        },
      );
    }
    app.get(AppLogger).setLogLevels([...LOG_LEVELS]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    app.get(AppLogger).setLogLevels(levelsFrom('error'));
  });

  afterAll(() => app.close());

  const http = () => request(app.getHttpServer());

  const logLines = (): LogLine[] =>
    written
      .flatMap((chunk) => chunk.split('\n'))
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line) as LogLine);

  // A linha de acesso sai no 'finish' da resposta, que pode chegar logo
  // depois de o cliente receber o corpo.
  const linesFor = async (
    requestId: string,
    predicate: (lines: LogLine[]) => boolean = (lines) =>
      lines.some((line) => line.context === 'HTTP'),
  ) => {
    for (let i = 0; i < 50; i += 1) {
      const lines = logLines().filter((line) => line.requestId === requestId);
      if (predicate(lines)) return lines;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return logLines().filter((line) => line.requestId === requestId);
  };

  // Linha warn do filtro para erro 4xx do Postgres.
  const dbWarn = (lines: LogLine[]) =>
    lines.find((line) => line.message === 'Violação no banco');
  const withDbWarn = (lines: LogLine[]) =>
    lines.some((line) => line.context === 'HTTP') &&
    dbWarn(lines) !== undefined;

  describe('X-Request-Id', () => {
    it('gera UUID quando o cliente não manda', async () => {
      const response = await http().get('/states').expect(200);
      expect(response.headers['x-request-id']).toMatch(UUID);
    });

    it('ecoa um id válido do cliente', async () => {
      const response = await http()
        .get('/states')
        .set('X-Request-Id', 'teste-req-0001')
        .expect(200);
      expect(response.headers['x-request-id']).toBe('teste-req-0001');
    });

    it.each(['a'.repeat(65), 'id com espaço'])(
      'troca id inválido por UUID novo (%s)',
      async (invalid) => {
        const response = await http()
          .get('/states')
          .set('X-Request-Id', invalid)
          .expect(200);
        expect(response.headers['x-request-id']).toMatch(UUID);
        expect(response.headers['x-request-id']).not.toBe(invalid);
      },
    );

    it('vem também no 304', async () => {
      const response = await http()
        .get('/cities/all')
        .set('If-None-Match', '"ibge-2026-10"')
        .expect(304);
      expect(response.headers['x-request-id']).toMatch(UUID);
    });

    it('"<script>" não é ecoado nem logado', async () => {
      const response = await http()
        .get('/rota-que-nao-existe')
        .set('X-Request-Id', '<script>');
      const requestId = response.headers['x-request-id'];
      expect(requestId).toMatch(UUID);
      expectError(response, 404, 'GEN-404');
      await linesFor(requestId);
      expect(response.text).not.toContain('<script>');
      expect(written.join('')).not.toContain('<script>');
    });
  });

  describe('formato único de erro', () => {
    it('rota inexistente: 404 GEN-404', async () => {
      const response = await http().get('/nao-existe');
      const body = expectError(response, 404, 'GEN-404');
      expect(Object.keys(body).sort()).toEqual([
        'code',
        'message',
        'requestId',
      ]);
    });

    it('rota inexistente com dado pessoal na query: nada vai para o log', async () => {
      const response = await http()
        .get('/nao-existe?cpf=52998224725&email=fulano@x.com')
        .set('X-Request-Id', 'teste-query-0001');
      expectError(response, 404, 'GEN-404');
      const [access] = await linesFor('teste-query-0001');
      expect(access).toMatchObject({
        url: '/nao-existe',
        code: 'GEN-404',
        reason: 'Cannot GET /nao-existe',
      });
      const log = written.join('');
      expect(log).not.toContain('52998224725');
      expect(log).not.toContain('fulano@x.com');
    });

    it('parâmetro que não é número: 400 GEN-400', async () => {
      expectError(await http().get('/cities/abc'), 400, 'GEN-400');
    });

    it('JSON malformado: 400 GEN-400 com requestId', async () => {
      const response = await http()
        .post('/tenants')
        .set('Content-Type', 'application/json')
        .set('X-Request-Id', 'teste-json-0001')
        .send('{"tenant": {"document": "52998224725"');
      expectError(response, 400, 'GEN-400');
      expect(response.headers['x-request-id']).toBe('teste-json-0001');
      const [access] = await linesFor('teste-json-0001');
      expect(access).toMatchObject({
        status: 400,
        code: 'GEN-400',
        reason: 'JSON malformado',
      });
      expect(written.join('')).not.toContain('52998224725');
    });

    it('corpo grande demais: 413 GEN-413', async () => {
      const response = await http()
        .post('/tenants')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ name: 'x'.repeat(200_000) }));
      expectError(response, 413, 'GEN-413');
    });

    it('payload inválido: 400 VAL-001 com os issues, sem o valor enviado', async () => {
      const response = await http()
        .post('/tenants')
        .send({
          tenant: {
            documentType: 'CNPJ',
            document: makeCnpj(1),
            name: 'Empresa',
          },
          owner: { ...person(1), cpf: '11111111111' },
        });
      const body = expectError(response, 400, 'VAL-001');
      const issues = (body.details as { issues: { path: string }[] }).issues;
      expect(issues.map((issue) => issue.path)).toContain('owner.cpf');
      expect(response.text).not.toContain('11111111111');
    });

    it('parâmetro validado por ZodValidationPipe: 400 VAL-001', async () => {
      expectError(await http().get('/states/P1/cities'), 400, 'VAL-001');
    });

    it('sem X-Tenant-Id: 403 TEN-001', async () => {
      expectError(await http().get('/users'), 403, 'TEN-001');
    });

    it('violação de unique do Postgres: 409 DB-001', async () => {
      vi.spyOn(app.get(TenantsService), 'signup').mockRejectedValueOnce(
        pgError('23505'),
      );
      const response = await http()
        .post('/tenants')
        .send({
          tenant: {
            documentType: 'CNPJ',
            document: makeCnpj(1),
            name: 'Empresa',
          },
          owner: person(1),
        });
      expectError(response, 409, 'DB-001');
      expect(response.text).not.toContain('52998224725');
    });

    // Sem caminho real desde que o Zod passou a ter os limites das colunas:
    // DB-007 fica para coluna nova sem limite no schema (segunda barreira).
    it('texto maior que a coluna (22001, simulado): 400 DB-007 com warn, sem error', async () => {
      vi.spyOn(app.get(TenantsService), 'signup').mockRejectedValueOnce(
        pgError('22001'),
      );
      const response = await http()
        .post('/tenants')
        .set('X-Request-Id', 'teste-22001-01')
        .send({
          tenant: {
            documentType: 'CNPJ',
            document: makeCnpj(1),
            name: 'Empresa',
          },
          owner: person(1),
        });
      expectError(response, 400, 'DB-007');
      const lines = await linesFor('teste-22001-01', withDbWarn);
      expect(lines.filter((line) => line.level === 'error')).toEqual([]);
      expect(lines.find((line) => line.context === 'HTTP')).toMatchObject({
        level: 'warn',
        code: 'DB-007',
        pgCode: '22001',
      });
      expect(dbWarn(lines)).toMatchObject({
        level: 'warn',
        code: 'DB-007',
        pgCode: '22001',
      });
      expect(written.join('')).not.toContain('52998224725');
    });

    it('unique real do Postgres (checagem da aplicação desligada): 409 DB-001 com warn completo', async () => {
      await signup(app, 1);
      // Simula o bug "a aplicação não checou antes": o 1º exists (documento da
      // conta) diz que não existe, e o INSERT bate na constraint de verdade.
      vi.spyOn(EntityManager.prototype, 'exists').mockResolvedValueOnce(false);
      const response = await http()
        .post('/tenants')
        .set('X-Request-Id', 'teste-23505-01')
        .send({
          tenant: {
            documentType: 'CNPJ',
            document: makeCnpj(1),
            name: 'Outra',
          },
          owner: person(2),
        });
      expectError(response, 409, 'DB-001');

      const lines = await linesFor('teste-23505-01', withDbWarn);
      const warn = dbWarn(lines);
      expect(warn).toMatchObject({
        level: 'warn',
        context: 'AllExceptionsFilter',
        requestId: 'teste-23505-01',
        code: 'DB-001',
        status: 409,
        pgCode: '23505',
        table: 'tenants',
        constraint: expect.any(String),
        method: 'POST',
        path: '/tenants',
        route: '/tenants',
        handler: 'TenantsController.signup',
        query: expect.stringContaining('INSERT INTO "tenants"'),
        error: {
          name: 'QueryFailedError',
          severity: 'ERROR',
          schema: 'public',
        },
        app: { version: expect.any(String) },
      });
      expect(warn?.error.stack).toContain('QueryFailedError');
      expect(warn?.error).not.toHaveProperty('detail');
      expect(lines.find((line) => line.context === 'HTTP')).toMatchObject({
        code: 'DB-001',
        pgCode: '23505',
        table: 'tenants',
        constraint: warn?.constraint,
      });
      // O documento repetido está no detail do Postgres, que nunca é logado.
      expect(written.join('')).not.toContain(makeCnpj(1));
      expect(lines.filter((line) => line.level === 'error')).toEqual([]);
    });

    it('charset não suportado (body-parser): 415 GEN-415', async () => {
      const response = await http()
        .post('/tenants')
        .set('Content-Type', 'application/json; charset=latin1')
        .set('X-Request-Id', 'teste-415-0001')
        .send('{}');
      expectError(response, 415, 'GEN-415');
      const [access] = await linesFor('teste-415-0001');
      expect(access).toMatchObject({
        status: 415,
        code: 'GEN-415',
        reason: 'unsupported charset "LATIN1"',
      });
    });
  });

  describe('Postgres de verdade (sem mock)', () => {
    const signupBody = (owner: Record<string, unknown>, name = 'Empresa') => ({
      tenant: { documentType: 'CNPJ', document: makeCnpj(1), name },
      owner: { ...person(1), ...owner },
    });

    // Os limites do Zod espelham as colunas (TEXT_LIMITS no dto): texto longo
    // é barrado antes do banco, com o campo em details.
    const emailOf = (length: number) =>
      `${'a'.repeat(length - '@teste.com'.length)}@teste.com`;

    it('e-mail com 256+ caracteres: 400 VAL-001 apontando owner.email', async () => {
      for (const length of [256, 300]) {
        const email = emailOf(length);
        const response = await http()
          .post('/tenants')
          .set('X-Request-Id', `teste-email-${length}`)
          .send(signupBody({ email }));
        const body = expectError(response, 400, 'VAL-001');
        const issues = (body.details as { issues: { path: string }[] }).issues;
        expect(issues.map((issue) => issue.path)).toEqual(['owner.email']);
        expect(response.text).not.toContain(email);
        await linesFor(`teste-email-${length}`);
        expect(written.join('')).not.toContain(email);
      }
    });

    it('e-mail com exatamente 255 caracteres cabe na coluna (201)', async () => {
      const email = emailOf(255);
      const response = await http()
        .post('/tenants')
        .send(signupBody({ email }))
        .expect(201);
      expect(response.body.owner.email).toBe(email);
    });

    it('caractere nulo no texto (22021): 400 DB-013 com warn (rota, handler, query)', async () => {
      const response = await http()
        .post('/tenants')
        .set('X-Request-Id', 'teste-22021-01')
        .send(signupBody({}, 'Empresa\u0000X'));
      expectError(response, 400, 'DB-013');
      const lines = await linesFor('teste-22021-01', withDbWarn);
      expect(dbWarn(lines)).toMatchObject({
        code: 'DB-013',
        pgCode: '22021',
        route: '/tenants',
        handler: 'TenantsController.signup',
        query: expect.any(String),
        error: { name: 'QueryFailedError', stack: expect.any(String) },
      });
      expect(lines.find((line) => line.context === 'HTTP')).toMatchObject({
        code: 'DB-013',
        pgCode: '22021',
      });
      expect(written.join('')).not.toContain('Empresa\\u0000X');
    });
  });

  describe('erro inesperado (500) e banco indisponível (503)', () => {
    it('500: não vaza a mensagem; log com rota, handler, stack e cause', async () => {
      vi.spyOn(app.get(GeoService), 'findCity').mockRejectedValueOnce(
        new Error('segredo-interno', { cause: new TypeError('causa-raiz') }),
      );
      const response = await http()
        .get('/cities/1?cpf=52998224725')
        .set('X-Request-Id', 'teste-500-0001');
      expectError(response, 500, 'GEN-500');
      expect(response.text).not.toContain('segredo-interno');
      expect(response.headers['cache-control']).toBe('no-store');

      const lines = await linesFor('teste-500-0001');
      const error = lines.find((line) => line.level === 'error' && line.error);
      expect(error).toMatchObject({
        message: 'Erro inesperado',
        context: 'AllExceptionsFilter',
        requestId: 'teste-500-0001',
        code: 'GEN-500',
        status: 500,
        method: 'GET',
        path: '/cities/1',
        route: '/cities/:id',
        handler: 'CitiesController.findOne',
        error: {
          name: 'Error',
          message: 'segredo-interno',
          cause: { name: 'TypeError', message: 'causa-raiz' },
        },
        app: {
          version: expect.any(String),
          env: 'test',
          hostname: expect.any(String),
        },
      });
      expect(typeof error?.durationMs).toBe('number');
      expect(error?.error.stack).toContain('segredo-interno');
      expect(error?.error.stack).toContain('errors.e2e-spec.ts');
      expect(error?.error.cause.stack).toContain('causa-raiz');
      const access = lines.find((line) => line.context === 'HTTP');
      expect(access).toMatchObject({
        level: 'error',
        message: 'GET /cities/1 500',
        route: '/cities/:id',
        status: 500,
        code: 'GEN-500',
      });
      expect(written.join('')).not.toContain('52998224725');
    });

    it('Postgres fora do ar (08006): 503 DB-012, log sem parâmetros nem detail', async () => {
      vi.spyOn(app.get(GeoService), 'findCity').mockRejectedValueOnce(
        pgError('08006'),
      );
      const response = await http()
        .get('/cities/1')
        .set('X-Request-Id', 'teste-pg-0001');
      expectError(response, 503, 'DB-012');
      expect(response.headers['cache-control']).toBe('no-store');

      const lines = await linesFor('teste-pg-0001');
      const error = lines.find((line) => line.level === 'error' && line.error);
      expect(error).toMatchObject({
        code: 'DB-012',
        status: 503,
        pgCode: '08006',
        query: 'INSERT INTO users ("cpf") VALUES ($1)',
        handler: 'CitiesController.findOne',
      });
      expect(error?.error.stack).toBeDefined();
      expect(written.join('')).not.toContain('52998224725');
    });

    it('conexão perdida no driver (sem SQLSTATE): 503 DB-012', async () => {
      vi.spyOn(app.get(GeoService), 'findCity').mockRejectedValueOnce(
        new Error('Connection terminated unexpectedly'),
      );
      expectError(await http().get('/cities/1'), 503, 'DB-012');
    });
  });

  describe('log de acesso', () => {
    it('sucesso: nível log, sem query string, com duração', async () => {
      await http()
        .get('/cities?q=toledo')
        .set('X-Request-Id', 'teste-ok-0001')
        .expect(200);
      const [access] = await linesFor('teste-ok-0001');
      expect(access).toMatchObject({
        level: 'log',
        context: 'HTTP',
        message: 'GET /cities 200',
        method: 'GET',
        url: '/cities',
        status: 200,
      });
      expect(typeof access.durationMs).toBe('number');
      expect(access).not.toHaveProperty('code');
    });

    it('erro de domínio com tenant: code e tenantId, sem e-mail', async () => {
      const first = await signup(app, 1);
      const second = await signup(app, 2);
      const response = await http()
        .post('/users')
        .set('X-Tenant-Id', second.tenant.id)
        .set('X-Request-Id', 'teste-usr-0003')
        .send({
          ...person(3),
          email: 'pessoa1@teste.com',
          roleId: second.owner.membership.role.id,
        });
      expectError(response, 409, 'USR-003');
      expect(first.tenant.id).not.toBe(second.tenant.id);

      const [access] = await linesFor('teste-usr-0003');
      expect(access).toMatchObject({
        level: 'warn',
        message: 'POST /users 409',
        status: 409,
        code: 'USR-003',
        tenantId: second.tenant.id,
      });
      expect(written.join('')).not.toContain('pessoa1@teste.com');
    });
  });
});
