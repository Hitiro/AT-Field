# 003 — Base da API: TypeORM, strict e entidades multi-tenant

Implementa a primeira parte da especificação do [passo 002](002-modelo-multi-tenant.md): infraestrutura e schema. **CRUD ainda não feito.**

## O que mudou

- `pnpm install` e dependências da API: `typeorm`, `@nestjs/typeorm`, `@nestjs/config`, `pg`, `zod`, `nestjs-zod`.
- `strict: true` no `tsconfig` da API (antes `noImplicitAny` e `strictBindCallApply` estavam desligados).
- `pnpm-workspace.yaml`: `onlyBuiltDependencies` para `@nestjs/core`, `@tailwindcss/oxide`, `sharp`, `unrs-resolver`.
- **`@at-field/dto` passou a compilar para `dist/`** (antes apontava para `.ts`, que o Node não executa). Contém enums (`DocumentType`, `MembershipStatus`) e validação de CPF/CNPJ com dígitos verificadores (`isValidCpf`, `isValidCnpj`, `normalizeDocument`). `LoginDTO` removido (login é pelo Firebase).
- `turbo.json`: `dev`, `lint` e `test` dependem de `^build`, para o DTO ser compilado antes dos apps.
- `apps/api/src/config/env.ts`: variáveis de ambiente validadas com Zod (falha ao subir se faltar `DATABASE_*`).
- Entidades: `Tenant`, `User`, `Membership`, `Role`, `Permission` (+ `role_permissions`), `State`, `City`, cada uma na pasta do seu módulo.
- `apps/api/src/database/`: `typeorm.config.ts` (opções compartilhadas), `data-source.ts` (CLI) e a migration `CreateMultiTenantBase`.
- Scripts na API: `migration:generate`, `migration:run`, `migration:revert`.

## Decisões

- `synchronize: false`; schema só por migration.
- IDs `uuid`, exceto `states` e `cities`, que usam o **código IBGE** como chave.
- Enums do Postgres (`document_type`, `membership_status`) a partir dos tipos do `@at-field/dto`.
- `DocumentType`/`MembershipStatus` ficam no DTO compartilhado para web e mobile reutilizarem.
- `users.cityId` opcional; `users.firebaseUid` único e nulo até o passo do Firebase.

## Como validar

```bash
docker compose --env-file apps/api/.env up -d
cd apps/api
pnpm migration:run
pnpm test
pnpm build
```

Testes: `packages/dto` (Jest) com 10 casos de CPF/CNPJ e normalização; `apps/api/src/config/env.spec.ts` com validação do `.env` (padrões, coerção de porta, variáveis ausentes, valores inválidos). Entidades/migration ainda sem teste de integração (pendência).

Resultado verificado: migration aplicada (9 tabelas, incluindo `migrations`), build e teste existente passando, validadores de CPF/CNPJ conferidos com documentos válidos e inválidos.

## Pendências

(Seed de permissões, CRUD, testes de integração e formatação resolvidos no [passo 004](004-crud-contas-usuarios-papeis.md).)

- Seed IBGE de `states`/`cities` (passo 004).
