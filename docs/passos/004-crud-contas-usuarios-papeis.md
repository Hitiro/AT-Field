# 004 — CRUD de contas, usuários e papéis

Implementa as regras do [passo 002](002-modelo-multi-tenant.md) sobre o schema do [passo 003](003-base-typeorm-e-entidades.md). Ainda **sem autenticação**: a conta ativa vem do header `X-Tenant-Id` (o usuário autenticado e as permissões entram no passo do Firebase).

## O que mudou

### `@at-field/dto` (compartilhado com web/mobile)

- `permissions.ts`: catálogo de permissões (`módulo:ação`) e papéis de sistema (`owner` = tudo, `admin` = tudo menos `tenants:update`, `technician` = `users:read`).
- `schemas.ts`: schemas Zod de entrada — `signupSchema`, `updateTenantSchema`, `addMemberSchema`, `updateMemberSchema`, `createRoleSchema`, `updateRoleSchema`. Normalizam CPF/CNPJ (só dígitos) e e-mail (minúsculo) e validam dígitos verificadores conforme o tipo de documento.

### API

| Método | Rota | Regra |
| --- | --- | --- |
| `POST` | `/tenants` | Público. Cria conta + pessoa (nova ou existente) + papéis de sistema + vínculo `owner` ativo, numa transação |
| `GET`/`PATCH` | `/tenants/current` | Conta ativa (`X-Tenant-Id`) |
| `GET`/`POST` | `/users` | Pessoas vinculadas à conta / adiciona pessoa com status `invited` |
| `GET`/`PATCH`/`DELETE` | `/users/:id` | Vê, altera papel/status, remove o vínculo (a pessoa continua nas outras contas) |
| `GET`/`POST` | `/roles` | Papéis da conta / cria papel customizado |
| `GET`/`PATCH`/`DELETE` | `/roles/:id` | Papéis de sistema não podem ser editados nem excluídos |
| `GET` | `/permissions` | Catálogo |

Estrutura de apoio:

- `common/tenant.guard.ts` + `@CurrentTenant()`: valida `X-Tenant-Id` (uuid, conta existente e ativa) → 403 se falhar.
- `common/pg-error.filter.ts`: traduz violações do Postgres (corridas que passam pela checagem da aplicação) — `23505`/`23503` → 409, `22P02` → 400, resto → 500 com log.
- `roles/permissions-sync.service.ts`: ao subir, faz upsert do catálogo do DTO na tabela `permissions`.
- `users/people.ts`: `resolvePerson` — acha a pessoa pelo CPF ou cria; reaproveitada no auto-cadastro e na adição de usuários.
- `ZodValidationPipe` global; `cleanupOpenApiDoc` no Swagger.

## Decisões

- `/users` trabalha com **vínculos**, não com a pessoa: a conta altera papel e status; dados pessoais (nome, telefone) só serão editáveis pela própria pessoa depois do login.
- Remover usuário apaga só o vínculo.
- Novo vínculo nasce `invited`; o fluxo de convite/aceite fica para depois.
- Versões: `@nestjs/config` 4 e `@nestjs/typeorm` 11 (as versões 12 são ESM e voltadas ao Nest 12, quebravam o Jest). Será revisto na atualização geral de dependências.

## Testes

- `packages/dto` (Jest, 26 testes): CPF/CNPJ, catálogo de permissões e papéis de sistema, todos os schemas (normalização, documento conforme o tipo, campos obrigatórios).
- API unitários (15): `TenantGuard`, `PgErrorFilter`, `validateEnv`.
- API e2e (32), contra Postgres real (`at_field_test`, criado e migrado automaticamente no `globalSetup`, truncado entre testes):
  - auto-cadastro CNPJ e CPF, documento inválido, conta duplicada, reaproveitamento da pessoa, CPF com outro e-mail (sem criar nada), e-mail de outro CPF, cidade inexistente;
  - `X-Tenant-Id` ausente/inválido/inexistente/inativo;
  - adicionar, listar, duplicidade, papel de outra conta, isolamento entre contas, alterar papel/status;
  - último `owner` não pode ser suspenso, rebaixado nem removido; convidado não conta como owner ativo;
  - papéis: catálogo, permissões dos papéis de sistema, criação, nome duplicado, permissão inválida, edição, proteção de papéis de sistema, papel em uso, isolamento.

## Como validar

```bash
docker compose --env-file apps/api/.env up -d
pnpm --filter @at-field/dto test
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter api lint
```

## Pendências

- Autenticação Firebase, checagem de vínculo do usuário e `@RequirePermissions` (hoje qualquer cliente com o `X-Tenant-Id` opera a conta — **não expor em produção**).
- Regra do último owner sob concorrência (duas requisições simultâneas) — usar lock (`SELECT ... FOR UPDATE`).
- ~~Seed IBGE de estados/cidades~~ — resolvido no [passo 007](007-base-ibge-estados-cidades.md).
- Fluxo de convite e aceite do vínculo.
