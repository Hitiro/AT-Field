import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { PERMISSION_KEYS } from '@at-field/dto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp, person, resetDatabase, signup } from './utils';

type Role = {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: { key: string }[];
};

describe('Roles (e2e)', () => {
  let app: INestApplication<App>;
  let tenantId: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    tenantId = (await signup(app, 1)).tenant.id;
  });

  afterAll(() => app.close());

  const http = () => request(app.getHttpServer());
  const asTenant = (id = tenantId) => ({
    get: (url: string) => http().get(url).set('X-Tenant-Id', id),
    post: (url: string) => http().post(url).set('X-Tenant-Id', id),
    patch: (url: string) => http().patch(url).set('X-Tenant-Id', id),
    delete: (url: string) => http().delete(url).set('X-Tenant-Id', id),
  });

  const roleByName = async (name: string) => {
    const response = await asTenant().get('/roles');
    return (response.body as Role[]).find((role) => role.name === name)!;
  };

  it('GET /permissions lista o catálogo sincronizado', async () => {
    const response = await http().get('/permissions').expect(200);
    expect((response.body as { key: string }[]).map((p) => p.key)).toEqual(
      [...PERMISSION_KEYS].sort(),
    );
  });

  it('papéis de sistema recebem as permissões do catálogo', async () => {
    const owner = await roleByName('owner');
    const technician = await roleByName('technician');
    expect(owner.permissions).toHaveLength(PERMISSION_KEYS.length);
    expect(technician.permissions.map((p) => p.key)).toEqual(['users:read']);
  });

  it('cria papel customizado', async () => {
    const created = await asTenant()
      .post('/roles')
      .send({ name: 'Financeiro', permissions: ['users:read', 'users:read'] })
      .expect(201);
    expect(created.body).toMatchObject({ name: 'Financeiro', isSystem: false });
    expect(created.body.permissions).toHaveLength(1);
  });

  it('rejeita nome duplicado e permissão inexistente', async () => {
    await asTenant().post('/roles').send({ name: 'admin' }).expect(409);
    const invalid = await asTenant()
      .post('/roles')
      .send({ name: 'Novo', permissions: ['foo:bar'] })
      .expect(400);
    expect(invalid.body.message).toContain('foo:bar');
  });

  it('edita papel customizado', async () => {
    const created = await asTenant()
      .post('/roles')
      .send({ name: 'Financeiro' })
      .expect(201);
    const updated = await asTenant()
      .patch(`/roles/${created.body.id}`)
      .send({ name: 'Faturamento', permissions: ['tenants:read'] })
      .expect(200);
    expect(updated.body.name).toBe('Faturamento');
    expect(updated.body.permissions.map((p: { key: string }) => p.key)).toEqual(
      ['tenants:read'],
    );
  });

  it('protege papéis de sistema', async () => {
    const admin = await roleByName('admin');
    await asTenant()
      .patch(`/roles/${admin.id}`)
      .send({ name: 'Chefe' })
      .expect(409);
    await asTenant().delete(`/roles/${admin.id}`).expect(409);
  });

  it('não exclui papel em uso e exclui papel livre', async () => {
    const created = await asTenant()
      .post('/roles')
      .send({ name: 'Financeiro' })
      .expect(201);
    await asTenant()
      .post('/users')
      .send({ ...person(2), roleId: created.body.id })
      .expect(201);
    await asTenant().delete(`/roles/${created.body.id}`).expect(409);

    const free = await asTenant()
      .post('/roles')
      .send({ name: 'Livre' })
      .expect(201);
    await asTenant().delete(`/roles/${free.body.id}`).expect(204);
    await asTenant().get(`/roles/${free.body.id}`).expect(404);
  });

  it('isola papéis entre contas', async () => {
    const other = await signup(app, 2);
    const admin = await roleByName('admin');
    await asTenant(other.tenant.id).get(`/roles/${admin.id}`).expect(404);
  });
});
