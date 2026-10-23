import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  createTestApp,
  person,
  resetDatabase,
  seedCity,
  signup,
} from './utils';

type Role = { id: string; name: string };
type Member = {
  id: string;
  cityId: number | null;
  membership: { status: string; role: Role };
};

describe('Users (e2e)', () => {
  let app: INestApplication<App>;
  let tenantId: string;
  let ownerId: string;
  let roles: Record<string, string>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    const body = await signup(app, 1);
    tenantId = body.tenant.id;
    ownerId = body.owner.id;
    const response = await http().get('/roles').set('X-Tenant-Id', tenantId);
    roles = Object.fromEntries(
      (response.body as Role[]).map((role) => [role.name, role.id]),
    );
  });

  afterAll(() => app.close());

  const http = () => request(app.getHttpServer());
  const asTenant = (id = tenantId) => ({
    get: (url: string) => http().get(url).set('X-Tenant-Id', id),
    post: (url: string) => http().post(url).set('X-Tenant-Id', id),
    patch: (url: string) => http().patch(url).set('X-Tenant-Id', id),
    delete: (url: string) => http().delete(url).set('X-Tenant-Id', id),
  });

  const addMember = (seed: number, role = 'technician', id = tenantId) =>
    asTenant(id)
      .post('/users')
      .send({ ...person(seed), roleId: roles[role] });

  it('adiciona pessoa nova como convidada e lista', async () => {
    const added = await addMember(2).expect(201);
    expect(added.body.membership).toMatchObject({
      status: 'invited',
      role: { name: 'technician' },
    });

    const list = await asTenant().get('/users').expect(200);
    expect((list.body as Member[]).map((m) => m.id)).toEqual([
      ownerId,
      added.body.id,
    ]);
  });

  it('aceita cidade existente', async () => {
    const cityId = await seedCity(app);
    const added = await asTenant()
      .post('/users')
      .send({ ...person(2), cityId, roleId: roles.technician })
      .expect(201);
    expect((added.body as Member).cityId).toBe(cityId);
  });

  it('vincula pessoa que já atua em outra conta sem duplicar', async () => {
    const other = await signup(app, 2);
    const added = await addMember(2).expect(201);
    expect(added.body.id).toBe(other.owner.id);
  });

  it('não vincula a mesma pessoa duas vezes', async () => {
    await addMember(2).expect(201);
    await addMember(2).expect(409);
  });

  it('rejeita papel de outra conta', async () => {
    const other = await signup(app, 2);
    const otherRoles = await asTenant(other.tenant.id).get('/roles');
    const foreignRole = (otherRoles.body as Role[])[0].id;
    await asTenant()
      .post('/users')
      .send({ ...person(3), roleId: foreignRole })
      .expect(400);
  });

  it('valida payload e parâmetros', async () => {
    await asTenant()
      .post('/users')
      .send({ ...person(2), roleId: 'x' })
      .expect(400);
    await asTenant().get('/users/nao-e-uuid').expect(400);
    await asTenant().patch(`/users/${ownerId}`).send({}).expect(400);
  });

  it('isola usuários entre contas', async () => {
    const other = await signup(app, 2);
    await asTenant().get(`/users/${other.owner.id}`).expect(404);
    await asTenant(other.tenant.id).get(`/users/${ownerId}`).expect(404);
  });

  it('altera papel e status', async () => {
    const added = await addMember(2).expect(201);
    const updated = await asTenant()
      .patch(`/users/${added.body.id}`)
      .send({ status: 'active', roleId: roles.admin })
      .expect(200);
    expect(updated.body.membership).toMatchObject({
      status: 'active',
      role: { name: 'admin' },
    });
  });

  describe('último owner', () => {
    it('não pode ser suspenso, rebaixado ou removido', async () => {
      await asTenant()
        .patch(`/users/${ownerId}`)
        .send({ status: 'suspended' })
        .expect(409);
      await asTenant()
        .patch(`/users/${ownerId}`)
        .send({ roleId: roles.admin })
        .expect(409);
      await asTenant().delete(`/users/${ownerId}`).expect(409);
    });

    it('pode ser rebaixado quando há outro owner ativo', async () => {
      const added = await addMember(2, 'owner').expect(201);
      await asTenant()
        .patch(`/users/${added.body.id}`)
        .send({ status: 'active' })
        .expect(200);
      await asTenant()
        .patch(`/users/${ownerId}`)
        .send({ roleId: roles.admin })
        .expect(200);
    });

    it('owner apenas convidado não conta como owner ativo', async () => {
      await addMember(2, 'owner').expect(201);
      await asTenant().delete(`/users/${ownerId}`).expect(409);
    });
  });

  it('remove o vínculo sem apagar a pessoa das outras contas', async () => {
    const other = await signup(app, 2);
    await addMember(2).expect(201);

    await asTenant().delete(`/users/${other.owner.id}`).expect(204);
    await asTenant().get(`/users/${other.owner.id}`).expect(404);
    await asTenant(other.tenant.id).get(`/users/${other.owner.id}`).expect(200);
  });
});
