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
import type { MeResponse } from '@at-field/dto';
import { INestApplication, LOG_LEVELS } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { applySecurity } from '../src/common/errors/openapi';
import { AppLogger, levelsFrom } from '../src/common/logging/app-logger';
import {
  asUser,
  authHeader,
  createTestApp,
  expectError,
  fakeAuth,
  identityFor,
  makeCpf,
  person,
  resetDatabase,
  signup,
  signupBody,
  tokenFor,
  tokenOf,
  uidFor,
} from './utils';

type LogLine = Record<string, any>;
type Role = { id: string; name: string };

describe('Autenticação Firebase (e2e, passo 009a)', () => {
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
  const db = () => app.get(DataSource);

  const logLines = (): LogLine[] =>
    written
      .flatMap((chunk) => chunk.split('\n'))
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line) as LogLine);

  const linesFor = async (requestId: string) => {
    for (let i = 0; i < 50; i += 1) {
      const lines = logLines().filter((line) => line.requestId === requestId);
      if (lines.some((line) => line.context === 'HTTP')) return lines;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return logLines().filter((line) => line.requestId === requestId);
  };

  const accessLine = async (requestId: string) =>
    (await linesFor(requestId)).find((line) => line.context === 'HTTP');

  const firebaseUidOf = async (cpf: string) => {
    const rows: { firebaseUid: string | null }[] = await db().query(
      'SELECT "firebaseUid" FROM users WHERE cpf = $1',
      [cpf],
    );
    return rows[0]?.firebaseUid;
  };

  const count = async (table: 'tenants' | 'users') => {
    const rows: { total: number }[] = await db().query(
      `SELECT count(*)::int AS total FROM "${table}"`,
    );
    return rows[0].total;
  };

  // Owner da conta 1 convida a pessoa `seed` (sem conta de acesso ainda).
  const invite = async (
    owner: { tenant: { id: string }; token: string },
    seed: number,
  ) => {
    const roles = await asUser(app, owner.token, owner.tenant.id).get('/roles');
    const technician = (roles.body as Role[]).find(
      (role) => role.name === 'technician',
    );
    const response = await asUser(app, owner.token, owner.tenant.id)
      .post('/users')
      .send({ ...person(seed), roleId: technician?.id })
      .expect(201);
    return response.body as { id: string };
  };

  describe('token', () => {
    it('1. rota protegida sem Authorization: 401 AUT-001', async () => {
      expectError(await http().get('/me'), 401, 'AUT-001');
      expectError(
        await http().get('/me').set('Authorization', 'Basic abc'),
        401,
        'AUT-001',
      );
      expectError(
        await http().get('/me').set('Authorization', 'Bearer '),
        401,
        'AUT-001',
      );
    });

    it('sem token e sem X-Tenant-Id: AUT-001 (não TEN-001)', async () => {
      expectError(await http().get('/users'), 401, 'AUT-001');
    });

    it('2. token expirado: 401 AUT-003, reason na linha de acesso, sem token no log', async () => {
      const response = await http()
        .get('/me')
        .set('X-Request-Id', 'teste-aut-003')
        .set(authHeader('expired'));
      expectError(response, 401, 'AUT-003');
      expect(response.text).not.toContain('auth/');
      const access = await accessLine('teste-aut-003');
      expect(access).toMatchObject({
        level: 'warn',
        status: 401,
        code: 'AUT-003',
        reason: 'auth/id-token-expired',
      });
      expect(access).not.toHaveProperty('userId');
      expect(written.join('')).not.toContain('Bearer');
      expect(logLines().filter((line) => line.level === 'error')).toEqual([]);
    });

    it.each([
      ['invalid', 401, 'AUT-002'],
      ['token-desconhecido', 401, 'AUT-002'],
      ['revoked', 401, 'AUT-004'],
      ['disabled', 403, 'AUT-006'],
    ] as const)('token %s: %i %s', async (token, status, code) => {
      expectError(await http().get('/me').set(authHeader(token)), status, code);
    });

    it('esquema Bearer sem diferenciar maiúsculas', async () => {
      const { token } = await signup(app, 1);
      await http()
        .get('/me')
        .set('Authorization', `bearer   ${token}`)
        .expect(200);
    });

    it('13. provedor indisponível: 503 AUT-008, log error sem dado pessoal, nada gravado', async () => {
      const response = await http()
        .post('/tenants')
        .set('X-Request-Id', 'teste-aut-008')
        .set(authHeader('unavailable'))
        .send(signupBody(1));
      expectError(response, 503, 'AUT-008');
      expect(response.headers['cache-control']).toBe('no-store');

      const lines = await linesFor('teste-aut-008');
      const error = lines.find(
        (line) => line.level === 'error' && line.context === 'AuthService',
      );
      expect(error).toMatchObject({
        message: 'Serviço de autenticação indisponível',
        provider: 'firebase',
        route: '/tenants',
        handler: 'TenantsController.signup',
        error: {
          name: 'AuthProviderError',
          kind: 'unavailable',
          providerCode: 'app/network-error',
          stack: expect.any(String),
          cause: { code: 'ENOTFOUND' },
        },
        app: { version: expect.any(String) },
      });
      expect(lines.find((line) => line.context === 'HTTP')).toMatchObject({
        level: 'error',
        status: 503,
        code: 'AUT-008',
        reason: 'app/network-error',
      });
      expect(written.join('')).not.toContain(person(1).email);
      expect(await count('tenants')).toBe(0);
      expect(await count('users')).toBe(0);
    });
  });

  describe('rotas públicas e sem conta', () => {
    it('14. GET /states e GET / sem token: 200', async () => {
      await http().get('/states').expect(200);
      await http().get('/cities?q=toledo').expect(200);
      await http().get('/').expect(200);
    });

    it('GET /permissions: só autenticado, sem X-Tenant-Id', async () => {
      const { token } = await signup(app, 1);
      await asUser(app, token).get('/permissions').expect(200);
    });

    it('OpenAPI: Bearer global e security vazio nas rotas públicas', () => {
      const config = new DocumentBuilder()
        .addBearerAuth()
        .addSecurityRequirements('bearer')
        .build();
      const document = applySecurity(SwaggerModule.createDocument(app, config));
      expect(document.security).toEqual([{ bearer: [] }]);
      expect(document.components?.securitySchemes?.bearer).toMatchObject({
        type: 'http',
        scheme: 'bearer',
      });
      expect(document.paths['/states'].get?.security).toEqual([]);
      expect(document.paths['/cities/{id}'].get?.security).toEqual([]);
      expect(document.paths['/'].get?.security).toEqual([]);
      expect(document.paths['/me'].get?.security).toBeUndefined();
      expect(document.paths['/tenants'].post?.security).toBeUndefined();
      expect(JSON.stringify(document)).not.toContain('x-public');
    });
  });

  describe('GET /me e vínculo no primeiro login', () => {
    it('devolve a pessoa e os vínculos, sem CPF nem firebaseUid', async () => {
      const first = await signup(app, 1);
      const second = await signup(app, 2, person(1), first.token);
      const response = await asUser(app, first.token).get('/me').expect(200);
      const me = response.body as MeResponse;
      expect(me).toEqual({
        id: first.owner.id,
        name: 'Pessoa 1',
        email: 'pessoa1@teste.com',
        phone: null,
        cityId: null,
        memberships: [
          {
            tenant: {
              id: first.tenant.id,
              name: 'Empresa 1',
              documentType: 'CNPJ',
            },
            status: 'active',
            role: { id: expect.any(String), name: 'owner' },
          },
          {
            tenant: {
              id: second.tenant.id,
              name: 'Empresa 2',
              documentType: 'CNPJ',
            },
            status: 'active',
            role: { id: expect.any(String), name: 'owner' },
          },
        ],
      });
      expect(response.text).not.toContain(makeCpf(1));
      expect(response.text).not.toContain(uidFor('pessoa1@teste.com'));
    });

    it('conta excluída (soft delete) não aparece em /me', async () => {
      const first = await signup(app, 1);
      const second = await signup(app, 2, person(1), first.token);
      await db().query('UPDATE tenants SET "deletedAt" = now() WHERE id = $1', [
        second.tenant.id,
      ]);
      const me = (await asUser(app, first.token).get('/me').expect(200))
        .body as MeResponse;
      expect(me.memberships.map((m) => m.tenant.id)).toEqual([first.tenant.id]);
      expectError(
        await asUser(app, first.token, second.tenant.id).get(
          '/tenants/current',
        ),
        403,
        'TEN-002',
      );
    });

    it('3. token verificado de quem não está no banco: 403 AUT-005', async () => {
      expectError(
        await asUser(app, tokenOf('ninguem@teste.com')).get('/me'),
        403,
        'AUT-005',
      );
    });

    it('4. convidado sem firebaseUid + token verificado com o mesmo e-mail: vincula e lista o convite', async () => {
      const owner = await signup(app, 1);
      const invited = await invite(owner, 2);
      expect(await firebaseUidOf(makeCpf(2))).toBeNull();

      const token = tokenOf(person(2).email);
      const response = await http()
        .get('/me')
        .set(authHeader(token))
        .set('X-Request-Id', 'teste-vinculo-01')
        .expect(200);
      const me = response.body as MeResponse;
      expect(me.id).toBe(invited.id);
      expect(me.memberships).toEqual([
        expect.objectContaining({
          tenant: expect.objectContaining({ id: owner.tenant.id }),
          status: 'invited',
          role: expect.objectContaining({ name: 'technician' }),
        }),
      ]);
      expect(await firebaseUidOf(makeCpf(2))).toBe(uidFor(person(2).email));
      expect(await accessLine('teste-vinculo-01')).toMatchObject({
        status: 200,
        userId: invited.id,
      });

      // Convite ainda não aceito: a conta não abre (aceite no 009c).
      expectError(
        await asUser(app, token, owner.tenant.id).get('/tenants/current'),
        403,
        'TEN-002',
      );
    });

    it('5. convidado com e-mail NÃO verificado: 403 AUT-007 e nada gravado', async () => {
      const owner = await signup(app, 1);
      await invite(owner, 2);
      const token = tokenFor(
        identityFor(person(2).email, { emailVerified: false }),
      );
      expectError(await asUser(app, token).get('/me'), 403, 'AUT-007');
      expect(await firebaseUidOf(makeCpf(2))).toBeNull();
    });

    it('e-mail não verificado de quem nem existe: AUT-007 (não revela cadastro)', async () => {
      const token = tokenFor(
        identityFor('ninguem@teste.com', { emailVerified: false }),
      );
      expectError(await asUser(app, token).get('/me'), 403, 'AUT-007');
    });

    it('já vinculado com token sem e-mail verificado: AUT-007 em toda rota', async () => {
      const owner = await signup(app, 1);
      const token = tokenFor(
        identityFor(person(1).email, { emailVerified: false }),
      );
      expectError(await asUser(app, token).get('/me'), 403, 'AUT-007');
      expectError(
        await asUser(app, token, owner.tenant.id).get('/users'),
        403,
        'AUT-007',
      );
    });

    it('primeiras requisições em paralelo do mesmo uid: um vínculo, todas 200', async () => {
      const owner = await signup(app, 1);
      const invited = await invite(owner, 2);
      const token = tokenOf(person(2).email);
      const responses = await Promise.all(
        Array.from({ length: 5 }, () => asUser(app, token).get('/me')),
      );
      expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
      for (const response of responses) {
        expect((response.body as MeResponse).id).toBe(invited.id);
      }
      expect(await firebaseUidOf(makeCpf(2))).toBe(uidFor(person(2).email));
    });

    it('e-mail trocado no Firebase depois do vínculo: segue achando pelo uid', async () => {
      const owner = await signup(app, 1);
      const token = tokenFor(
        identityFor('novo-email@teste.com', {
          uid: uidFor(person(1).email),
        }),
      );
      const me = (await asUser(app, token).get('/me').expect(200))
        .body as MeResponse;
      expect(me.id).toBe(owner.owner.id);
      expect(me.email).toBe(person(1).email);
    });

    it('12. usuário desativado ou excluído: 403 AUT-006 em qualquer rota', async () => {
      const owner = await signup(app, 1);
      await db().query('UPDATE users SET "isActive" = false WHERE id = $1', [
        owner.owner.id,
      ]);
      expectError(await asUser(app, owner.token).get('/me'), 403, 'AUT-006');
      expectError(
        await asUser(app, owner.token, owner.tenant.id).get('/users'),
        403,
        'AUT-006',
      );

      await db().query(
        'UPDATE users SET "isActive" = true, "deletedAt" = now() WHERE id = $1',
        [owner.owner.id],
      );
      expectError(await asUser(app, owner.token).get('/me'), 403, 'AUT-006');
    });

    it('15. identidade Google (email_verified) passa normalmente', async () => {
      const google = tokenFor(
        identityFor('google@gmail.com', { signInProvider: 'google.com' }),
      );
      const owner = { ...person(7), email: 'google@gmail.com' };
      const created = await http()
        .post('/tenants')
        .set(authHeader(google))
        .send(signupBody(7, owner))
        .expect(201);
      const body = created.body as {
        tenant: { id: string };
        owner: { id: string };
      };
      const me = (await asUser(app, google).get('/me').expect(200))
        .body as MeResponse;
      expect(me.id).toBe(body.owner.id);
      await asUser(app, google, body.tenant.id).get('/users').expect(200);
    });
  });

  describe('POST /tenants (auto-cadastro com token)', () => {
    it('6. token novo verificado e owner.email igual: 201 e firebaseUid gravado', async () => {
      const response = await http()
        .post('/tenants')
        .set(authHeader(tokenOf(person(1).email)))
        .set('X-Request-Id', 'teste-signup-01')
        .send(signupBody(1))
        .expect(201);
      expect(await firebaseUidOf(makeCpf(1))).toBe(uidFor(person(1).email));
      // Antes do cadastro a pessoa não existia: a linha de acesso fica sem userId.
      expect(await accessLine('teste-signup-01')).toMatchObject({
        status: 201,
      });
      expect(response.body.owner).not.toHaveProperty('firebaseUid');
    });

    it('e-mail do owner com caixa e espaços diferentes do token: aceita', async () => {
      await http()
        .post('/tenants')
        .set(authHeader(tokenOf('pessoa1@teste.com')))
        .send(signupBody(1, { ...person(1), email: ' PESSOA1@teste.com ' }))
        .expect(201);
    });

    it('6b. token NÃO verificado: 403 AUT-007 e nada criado', async () => {
      const token = tokenFor(
        identityFor(person(1).email, { emailVerified: false }),
      );
      expectError(
        await http()
          .post('/tenants')
          .set(authHeader(token))
          .send(signupBody(1)),
        403,
        'AUT-007',
      );
      expect(await count('tenants')).toBe(0);
      expect(await count('users')).toBe(0);
    });

    it('7. owner.email diferente do token: 403 AUT-009 e nada criado', async () => {
      expectError(
        await http()
          .post('/tenants')
          .set(authHeader(tokenOf('outra@teste.com')))
          .send(signupBody(1)),
        403,
        'AUT-009',
      );
      expect(await count('tenants')).toBe(0);
      expect(await count('users')).toBe(0);
    });

    it('token sem e-mail: 403 AUT-009', async () => {
      const token = tokenFor({
        uid: 'uid-sem-email',
        email: null,
        emailVerified: true,
      });
      expectError(
        await http()
          .post('/tenants')
          .set(authHeader(token))
          .send(signupBody(1)),
        403,
        'AUT-009',
      );
    });

    it('8. owner de A abre conta B com o mesmo CPF e token: reaproveita a pessoa', async () => {
      const first = await signup(app, 1);
      const second = await signup(app, 2, person(1), first.token);
      expect(second.owner.id).toBe(first.owner.id);
    });

    it('9. uid ligado ao CPF X faz cadastro com CPF Y: 409 AUT-010', async () => {
      const first = await signup(app, 1);
      const response = await http()
        .post('/tenants')
        .set(authHeader(first.token))
        .send(signupBody(2, { ...person(2), email: person(1).email }));
      expectError(response, 409, 'AUT-010');
      expect(await count('tenants')).toBe(1);
    });

    it('CPF já ligado a outra conta de acesso: 409 AUT-010', async () => {
      await signup(app, 1);
      // Outro uid com o mesmo e-mail (ex.: conta recriada no Firebase).
      const token = tokenFor(
        identityFor(person(1).email, { uid: 'uid-recriado' }),
      );
      const response = await http()
        .post('/tenants')
        .set(authHeader(token))
        .send(signupBody(2, person(1)));
      // O guard não acha o uid nem vincula (a pessoa já tem uid): segue sem
      // usuário; o cadastro encontra o CPF com outro uid.
      expectError(response, 409, 'AUT-010');
    });

    it('convidado (sem uid) abre a própria conta: vínculo e reaproveitamento', async () => {
      const owner = await signup(app, 1);
      const invited = await invite(owner, 2);
      const created = await signup(app, 3, person(2));
      expect(created.owner.id).toBe(invited.id);
      expect(await firebaseUidOf(makeCpf(2))).toBe(uidFor(person(2).email));
    });

    it('dois cadastros simultâneos do mesmo CPF: um 201 e um 409', async () => {
      const token = tokenOf(person(1).email);
      const responses = await Promise.all([
        http().post('/tenants').set(authHeader(token)).send(signupBody(1)),
        http()
          .post('/tenants')
          .set(authHeader(token))
          .send(signupBody(2, person(1))),
      ]);
      const statuses = responses.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 409]);
      const conflict = responses.find((r) => r.status === 409);
      expect(['DB-001', 'AUT-010']).toContain(conflict?.body.code);
      expect(await count('users')).toBe(1);
    });
  });

  describe('conta ativa (X-Tenant-Id) exige vínculo ativo', () => {
    it('10. usuário de A com X-Tenant-Id de B: TEN-002 igual à conta inexistente', async () => {
      const a = await signup(app, 1);
      const b = await signup(app, 2);
      const foreign = await asUser(app, a.token, b.tenant.id).get('/users');
      const missing = await asUser(
        app,
        a.token,
        '3f1c2b9e-8a4d-4c6e-9b7a-1d2e3f4a5b6c',
      ).get('/users');
      expectError(foreign, 403, 'TEN-002');
      expectError(missing, 403, 'TEN-002');
      // Corpo sem o requestId (único campo que varia por requisição).
      const withoutRequestId = (body: unknown) => {
        const copy = { ...(body as Record<string, unknown>) };
        delete copy.requestId;
        return copy;
      };
      const foreignBody = withoutRequestId(foreign.body);
      expect(foreignBody).toEqual(withoutRequestId(missing.body));
      expect(Object.keys(foreign.headers).sort()).toEqual(
        Object.keys(missing.headers).sort(),
      );
      expect(foreignBody).toEqual({
        code: 'TEN-002',
        message: 'Conta inexistente, inativa ou sem acesso',
      });
    });

    it('11. vínculo convidado ou suspenso: TEN-002; ativo: 200', async () => {
      const owner = await signup(app, 1);
      const invited = await invite(owner, 2);
      const token = tokenOf(person(2).email);
      const asInvited = () => asUser(app, token, owner.tenant.id);

      expectError(await asInvited().get('/users'), 403, 'TEN-002');

      await asUser(app, owner.token, owner.tenant.id)
        .patch(`/users/${invited.id}`)
        .send({ status: 'active' })
        .expect(200);
      await asInvited().get('/users').expect(200);

      // Suspender vale na hora (o guard consulta o banco a cada requisição).
      await asUser(app, owner.token, owner.tenant.id)
        .patch(`/users/${invited.id}`)
        .send({ status: 'suspended' })
        .expect(200);
      expectError(await asInvited().get('/users'), 403, 'TEN-002');
    });

    it('log: linha de acesso com userId e tenantId; nenhuma linha com token, uid ou e-mail', async () => {
      const owner = await signup(app, 1);
      written = [];
      await http()
        .get('/users')
        .set(authHeader(owner.token))
        .set('X-Tenant-Id', owner.tenant.id)
        .set('X-Request-Id', 'teste-log-auth-01')
        .expect(200);
      expect(await accessLine('teste-log-auth-01')).toMatchObject({
        level: 'log',
        status: 200,
        userId: owner.owner.id,
        tenantId: owner.tenant.id,
      });
      const log = written.join('');
      expect(log).not.toContain(owner.token);
      expect(log).not.toContain(uidFor(person(1).email));
      expect(log).not.toContain(person(1).email);
    });
  });

  it('o fake só recebe o token (nunca é o Firebase de verdade)', async () => {
    await http().get('/me').set(authHeader('invalid'));
    expect(fakeAuth.calls).toContain('invalid');
  });
});
