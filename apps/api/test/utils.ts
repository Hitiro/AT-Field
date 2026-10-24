import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  await app.init();
  return app;
}

// Limpa os dados entre testes; mantém o catálogo de permissões e a base IBGE
// (states/cities), carregada pela migration no globalSetup.
export async function resetDatabase(app: INestApplication) {
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

export async function signup(
  app: INestApplication<App>,
  seed: number,
  owner = person(seed),
) {
  const response = await request(app.getHttpServer())
    .post('/tenants')
    .send({
      tenant: {
        documentType: 'CNPJ',
        document: makeCnpj(seed),
        name: `Empresa ${seed}`,
      },
      owner,
    })
    .expect(201);
  return response.body as {
    tenant: { id: string };
    owner: { id: string; membership: { id: string; role: { id: string } } };
  };
}
