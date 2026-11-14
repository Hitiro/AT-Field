import { createHash } from 'node:crypto';
import { ERROR_CODES, ErrorCode } from '@at-field/dto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { expect } from 'vitest';
import { AppModule } from '../src/app.module';
import { AUTH_PROVIDER, VerifiedIdentity } from '../src/auth/auth-provider';
import { configureApp } from '../src/common/configure-app';
import { FakeAuthProvider } from './fake-auth.provider';

// Provedor de identidade falso (offline) de todos os e2e deste arquivo de
// teste; cada arquivo roda isolado e tem a própria instância.
export const fakeAuth = new FakeAuthProvider();

// Mesma configuração do main.ts (logger e middleware do requestId), antes do
// init para o middleware ficar à frente dos body-parsers. O Firebase é
// trocado pelo FakeAuthProvider.
export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(AUTH_PROVIDER)
    .useValue(fakeAuth)
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}

// uid estável por e-mail, sem conter o e-mail (cabe nos 128 da coluna e
// permite procurar o uid no log).
export const uidFor = (email: string) =>
  `uid-${createHash('sha256').update(email).digest('hex').slice(0, 24)}`;

// Identidade verificada (login por e-mail e senha) para o e-mail.
export const identityFor = (
  email: string,
  overrides: Partial<VerifiedIdentity> = {},
): VerifiedIdentity => ({
  uid: uidFor(email),
  email,
  emailVerified: true,
  signInProvider: 'password',
  ...overrides,
});

export const tokenFor = (identity: VerifiedIdentity) =>
  fakeAuth.issue(identity);

// Token de quem tem este e-mail (verificado).
export const tokenOf = (email: string) => tokenFor(identityFor(email));

export const authHeader = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

// Requisições como a pessoa do token, opcionalmente numa conta.
export function asUser(
  app: INestApplication<App>,
  token: string,
  tenantId?: string,
) {
  const http = () => request(app.getHttpServer());
  const prepare = (test: request.Test) => {
    test.set(authHeader(token));
    if (tenantId) test.set('X-Tenant-Id', tenantId);
    return test;
  };
  return {
    get: (url: string) => prepare(http().get(url)),
    post: (url: string) => prepare(http().post(url)),
    patch: (url: string) => prepare(http().patch(url)),
    delete: (url: string) => prepare(http().delete(url)),
  };
}

type ErrorResponseLike = {
  status: number;
  body: unknown;
  headers: Record<string, string>;
};

// Confere o formato único de erro: status, código, mensagem do catálogo e
// requestId igual ao header X-Request-Id.
export function expectError(
  res: ErrorResponseLike,
  status: number,
  code: ErrorCode,
) {
  expect(res.status).toBe(status);
  expect(res.body).toMatchObject({
    code,
    message: ERROR_CODES[code].message,
    requestId: res.headers['x-request-id'],
  });
  expect(res.headers['x-request-id']).toBeTruthy();
  return res.body as { details?: Record<string, unknown> };
}

// Limpa os dados entre testes; mantém o catálogo de permissões e a base IBGE
// (states/cities), carregada pela migration no globalSetup.
export async function resetDatabase(app: INestApplication) {
  fakeAuth.reset();
  await app
    .get(DataSource)
    .query(
      'TRUNCATE memberships, role_permissions, roles, users, tenants RESTART IDENTITY CASCADE',
    );
}

// Cidade real da base IBGE (Toledo/PR), presente após as migrations.
export const CITY_TOLEDO_PR = 4127700;

const checkDigit = (digits: number[], firstWeight: number, cycle?: number) => {
  const sum = digits.reduce((acc, digit, index) => {
    const weight = cycle
      ? ((firstWeight - index - 2 + cycle) % cycle) + 2
      : firstWeight - index;
    return acc + digit * weight;
  }, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
};

// Gera CPF/CNPJ válidos e distintos a partir de um número.
export function makeCpf(seed: number) {
  const base = String(100000000 + seed)
    .slice(-9)
    .split('')
    .map(Number);
  const first = checkDigit(base, 10);
  const second = checkDigit([...base, first], 11);
  return [...base, first, second].join('');
}

export function makeCnpj(seed: number) {
  const base = `${String(10000000 + seed).slice(-8)}0001`.split('').map(Number);
  const first = checkDigit(base, 5, 8);
  const second = checkDigit([...base, first], 6, 8);
  return [...base, first, second].join('');
}

export const person = (seed: number) => ({
  cpf: makeCpf(seed),
  name: `Pessoa ${seed}`,
  email: `pessoa${seed}@teste.com`,
});

export const signupBody = (seed: number, owner: object = person(seed)) => ({
  tenant: {
    documentType: 'CNPJ',
    document: makeCnpj(seed),
    name: `Empresa ${seed}`,
  },
  owner,
});

// Auto-cadastro com o token (verificado) do e-mail do owner. Devolve o
// corpo da resposta e o token, para as próximas requisições como o owner.
export async function signup(
  app: INestApplication<App>,
  seed: number,
  owner: { email: string } = person(seed),
  token = tokenOf(owner.email.trim().toLowerCase()),
) {
  const response = await request(app.getHttpServer())
    .post('/tenants')
    .set(authHeader(token))
    .send(signupBody(seed, owner))
    .expect(201);
  return {
    ...(response.body as {
      tenant: { id: string };
      owner: { id: string; membership: { id: string; role: { id: string } } };
    }),
    token,
  };
}
