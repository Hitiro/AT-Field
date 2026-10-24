# 002 — Modelo multi-tenant, usuários e RBAC (especificação)

Status: **especificação aprovada**; schema no [passo 003](003-base-typeorm-e-entidades.md), CRUD no [passo 004](004-crud-contas-usuarios-papeis.md); autenticação pendente.

## Objetivo

Definir como contas (CPF/CNPJ), usuários, vínculos, papéis e permissões se relacionam, antes de criar entidades e migrations.

## Regras de negócio

- Um **tenant** é uma conta contratante, identificada por **CPF (autônomo) ou CNPJ (empresa)**.
- Um **usuário** é sempre uma pessoa física (CPF). Um CNPJ cadastra CPFs para operar por ele; um CPF autônomo cadastra quem atende por ele.
- Uma pessoa pode atuar em **mais de um tenant** (vínculo N:N via `memberships`), com papel diferente em cada um.
- O **primeiro tenant nasce por auto-cadastro público**: cria o tenant, o usuário (ou reaproveita o existente) e um vínculo com o papel `owner`.
- **Permissões são globais** (seed definido em código); **papéis são por tenant**: cada novo tenant recebe papéis padrão (`owner`, `admin`, `technician`) e pode criar/editar os seus.
- Cidade do usuário vem da **base do IBGE** (tabelas `states` e `cities`), não do ViaCEP. Endereço completo não é armazenado; a cidade é usada depois para "cidades de atuação".

## Modelo de dados

| Tabela | Campos principais |
| --- | --- |
| `tenants` | `id` (uuid), `documentType` (`CPF`\|`CNPJ`), `document` (único), `name`, `isActive`, timestamps, `deletedAt` |
| `users` | `id`, `firebaseUid` (único, nulo até o passo de Firebase), `cpf` (único), `name`, `email` (único), `phone`, `cityId` → `cities`, `isActive`, timestamps, `deletedAt` |
| `memberships` | `id`, `userId`, `tenantId`, `roleId`, `status` (`invited`\|`active`\|`suspended`), timestamps; único (`userId`, `tenantId`) |
| `roles` | `id`, `tenantId`, `name`, `isSystem`; único (`tenantId`, `name`) |
| `permissions` | `id`, `key` único no formato `módulo:ação` (ex.: `clients:read`), `description` |
| `role_permissions` | `roleId`, `permissionId` |
| `states` | `ibgeCode`, `uf`, `name` |
| `cities` | `ibgeCode` (7 dígitos), `stateId`, `name` |

`cpf`, `email` e `firebaseUid` são únicos **globalmente** (identidade da pessoa). Todas as tabelas de negócio futuras (clientes, tipos de serviço, chamados) terão `tenantId`.

## Contexto de requisição

1. O Bearer Token (Firebase) identifica o **usuário**.
2. O tenant ativo vem do header `X-Tenant-Id`, validado contra um `membership` ativo do usuário.
3. O guard resolve `membership → role → permissions` e aplica `@RequirePermissions`.
4. Todo acesso a dados de negócio é filtrado por `tenantId` (escopo de tenant na API). Row Level Security do Postgres fica como segunda barreira, em passo futuro.

## Edge cases

- CPF/CNPJ inválido (dígitos verificadores) → 400, validado no schema Zod.
- Convidar um CPF/e-mail que já existe → reaproveita o `user` e cria só o `membership` (nunca duplica a pessoa); fica `invited` até aceite.
- CPF existente com e-mail diferente do informado → 409, sem criar nada.
- Não é permitido remover, suspender ou rebaixar o **último `owner`** do tenant.
- Papel `isSystem` não pode ser excluído; permissões de papel de sistema não são editáveis.
- Usuário desativado ou com `deletedAt` não autentica em nenhum tenant.
- Header `X-Tenant-Id` ausente ou sem vínculo ativo → 403.
- Cidade inexistente → 400.

## Cenários (Given/When/Then)

- Dado um CNPJ novo, quando faz o auto-cadastro, então cria tenant, usuário e `membership` com papel `owner`.
- Dado um usuário `admin` do tenant A, quando cadastra um CPF que já é usuário do tenant B, então só o vínculo com A é criado.
- Dado um técnico do tenant A, quando chama `GET /users` com `X-Tenant-Id` do tenant B sem vínculo, então recebe 403.
- Dado um tenant com um único `owner`, quando tenta se suspender, então recebe 409.

## Plano de passos

- 003: entidades, migrations e CRUD de tenants/users/memberships/roles (sem Firebase; `firebaseUid` nulo).
- 004: `states` e `cities` com seed do IBGE.
- 005: Firebase Auth (guard, criação do usuário no Firebase) e `X-Tenant-Id`.
- Antes de tudo: ligar `strict` no tsconfig da API, instalar TypeORM/`nestjs-zod`/`pg`, remover `LoginDTO` (username/password) de `packages/dto`.

## Pendências e riscos

- **Asaas por tenant:** cada tenant provavelmente precisará da própria conta/chave Asaas (cobra os clientes dele). Decidir antes do módulo de faturamento.
- Fluxo de convite (e-mail, aceite) fica para depois do CRUD.
