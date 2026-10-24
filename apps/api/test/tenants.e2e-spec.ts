import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import {
  createTestApp,
  makeCnpj,
  makeCpf,
  person,
  resetDatabase,
  signup,
} from './utils';

describe('Tenants (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => resetDatabase(app));

  afterAll(() => app.close());

  const http = () => request(app.getHttpServer());

  describe('POST /tenants (auto-cadastro)', () => {
    it('cria conta CNPJ, owner ativo e papéis de sistema', async () => {
      const body = await signup(app, 1);
      const tenantId = body.tenant.id;

      expect(body.owner).toMatchObject({
        cpf: makeCpf(1),
        email: 'pessoa1@teste.com',
        membership: { status: 'active', role: { name: 'owner' } },
      });

      const roles = await http()
        .get('/roles')
        .set('X-Tenant-Id', tenantId)
        .expect(200);
      const names = (roles.body as { name: string; isSystem: boolean }[]).map(
        (role) => [role.name, role.isSystem],
      );
      expect(names).toEqual([
        ['admin', true],
        ['owner', true],
        ['technician', true],
      ]);
    });

    it('cria conta CPF (autônomo) com documento mascarado', async () => {
      const response = await http()
        .post('/tenants')
        .send({
          tenant: {
            documentType: 'CPF',
            document: '529.982.247-25',
            name: 'Maria Autônoma',
          },
          owner: {
            cpf: '529.982.247-25',
            name: 'Maria',
            email: 'MARIA@teste.com',
          },
        })
        .expect(201);
      expect(response.body.tenant.document).toBe('52998224725');
      expect(response.body.owner.email).toBe('maria@teste.com');
    });

    it('rejeita documento inválido com 400', async () => {
      await http()
        .post('/tenants')
        .send({
          tenant: {
            documentType: 'CNPJ',
            document: '11222333000182',
            name: 'Empresa X',
          },
          owner: person(1),
        })
        .expect(400);
    });

    it('rejeita documento de conta já cadastrado com 409', async () => {
      await signup(app, 1);
      await http()
        .post('/tenants')
        .send({
          tenant: {
            documentType: 'CNPJ',
            document: makeCnpj(1),
            name: 'Outra',
          },
          owner: person(2),
        })
        .expect(409);
    });

    it('reaproveita a pessoa ao abrir uma segunda conta', async () => {
      const first = await signup(app, 1);
      const second = await signup(app, 2, person(1));
      expect(second.owner.id).toBe(first.owner.id);
    });

    it('CPF existente com outro e-mail retorna 409 e não cria a conta', async () => {
      await signup(app, 1);
      await http()
        .post('/tenants')
        .send({
          tenant: {
            documentType: 'CNPJ',
            document: makeCnpj(2),
            name: 'Empresa X',
          },
          owner: { ...person(1), email: 'outro@teste.com' },
        })
        .expect(409);

      const tenants = await app
        .get(DataSource)
        .query('SELECT count(*)::int AS total FROM tenants');
      expect(tenants[0].total).toBe(1);
    });

    it('e-mail já usado por outro CPF retorna 409', async () => {
      await signup(app, 1);
      await http()
        .post('/tenants')
        .send({
          tenant: {
            documentType: 'CNPJ',
            document: makeCnpj(2),
            name: 'Empresa X',
          },
          owner: { ...person(2), email: 'pessoa1@teste.com' },
        })
        .expect(409);
    });

    it('cidade inexistente retorna 400', async () => {
      await http()
        .post('/tenants')
        .send({
          tenant: {
            documentType: 'CNPJ',
            document: makeCnpj(1),
            name: 'Empresa X',
          },
          owner: { ...person(1), cityId: 9999999 },
        })
        .expect(400);
    });
  });

  describe('/tenants/current', () => {
    it('exige X-Tenant-Id válido', async () => {
      await http().get('/tenants/current').expect(403);
      await http()
        .get('/tenants/current')
        .set('X-Tenant-Id', 'nao-e-uuid')
        .expect(403);
      await http()
        .get('/tenants/current')
        .set('X-Tenant-Id', '3f1c2b9e-8a4d-4c6e-9b7a-1d2e3f4a5b6c')
        .expect(403);
    });

    it('retorna e atualiza a conta', async () => {
      const { tenant } = await signup(app, 1);

      const current = await http()
        .get('/tenants/current')
        .set('X-Tenant-Id', tenant.id)
        .expect(200);
      expect(current.body.name).toBe('Empresa 1');

      const updated = await http()
        .patch('/tenants/current')
        .set('X-Tenant-Id', tenant.id)
        .send({ name: 'Empresa Renomeada' })
        .expect(200);
      expect(updated.body.name).toBe('Empresa Renomeada');
    });

    it('bloqueia conta inativa', async () => {
      const { tenant } = await signup(app, 1);
      await app
        .get(DataSource)
        .query('UPDATE tenants SET "isActive" = false WHERE id = $1', [
          tenant.id,
        ]);
      await http()
        .get('/tenants/current')
        .set('X-Tenant-Id', tenant.id)
        .expect(403);
    });
  });
});
