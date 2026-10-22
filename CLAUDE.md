# CLAUDE.md

Guia para o Claude Code neste repositório. Respostas, commits e documentação em **português (pt-BR)**.

## Projeto

AT-Field: sistema de gestão de serviços de campo (Field Service), do chamado ao faturamento. Painel web para administradores, app mobile para técnicos, API central com toda a regra de negócio.

Contexto detalhado em `docs/` (ignorado pelo Git, serve de memória para agentes — leia antes de propor estruturas):

- `docs/ARCHITECTURE.md` — padrões técnicos e infraestrutura local
- `docs/AGENTS.md` — perfis (@architect, @business-rule, @coder, @reviewer) e fluxo de trabalho
- `docs/skills.md` — diretrizes de Auth, Storage, Banco e Asaas
- `docs/passos/` — registro numerado de cada passo do desenvolvimento

## Estrutura do monorepo (pnpm workspaces)

| Caminho | Conteúdo |
| --- | --- |
| `apps/api` | NestJS 11 (backend, Swagger/Redoc). Porta `3001` |
| `apps/web` | Next.js (painel admin) |
| `apps/mobile` | Expo / React Native (app do técnico) |
| `packages/dto` | `@at-field/dto` — DTOs/tipos compartilhados (`src/index.ts`) |
| `packages/config/eslint-preset` | Preset ESLint compartilhado |

Gerenciador: **pnpm 10** (`nodeLinker: hoisted`), Node 20+. Tarefas orquestradas pelo **Turborepo** (`turbo.json`: build, dev, lint, test).

## Comandos

```bash
pnpm install
docker compose --env-file apps/api/.env up -d   # PostgreSQL local
pnpm dev                        # todos os apps via turbo (ou use --filter <app> dev)
pnpm --filter api dev           # API com watch
pnpm --filter api migration:run # aplica migrations (TypeORM)
pnpm --filter api test          # jest (unit)
pnpm --filter api test:e2e      # e2e contra Postgres real (banco <DATABASE_NAME>_test, criado no globalSetup)
pnpm --filter api lint
pnpm --filter web dev
pnpm --filter mobile dev
```

**Portas** (bloco 43xx reservado, para não conflitar com outros projetos locais): API `4310`, Web `4311`, Mobile/Metro `4312`, PostgreSQL `54310`. A da API e a do banco vêm do `.env`.

Variáveis de ambiente: copie `.env.example` para `apps/api/.env` (`NODE_ENV`, `PORT`, `DATABASE_HOST/PORT/USER/PASSWORD/NAME`).

## Arquitetura e regras

- **Regra de negócio, persistência e integrações ficam só na API.** Web e Mobile são camadas de apresentação que consomem a API.
- **TypeScript strict** em todos os pacotes.
- **Tipos/DTOs compartilhados** em `packages/dto` (compila para `dist/`; rode `pnpm --filter @at-field/dto build` se alterar, o Turborepo faz isso em `pnpm dev`). Verifique `packages/` antes de criar estruturas novas; reutilize.
- **Validação** de payloads com **Zod** (na API via `nestjs-zod`, não `class-validator`).
- **ORM:** TypeORM, com `synchronize: false`; schema só via migrations.
- **Banco:** PostgreSQL (via Docker). Toda alteração estrutural via **migrations**. Tabelas do MVP: `clients`, `service_types`, `users`, `service_calls`.
- **Multi-tenant:** tenant = conta CPF/CNPJ; usuários ligados por `memberships` (N:N) com papel por vínculo; `tenantId` em toda tabela de negócio; tenant ativo via `X-Tenant-Id`. Ver `docs/passos/002-modelo-multi-tenant.md`.
- **Auth:** Firebase Authentication; a API valida o Bearer Token nas rotas protegidas (`users.firebaseUid` único). Push via FCM.
- **Autorização:** RBAC (`roles` por tenant, `permissions` globais) com permissões `módulo:ação` via `@RequirePermissions`. API keys para integradores (só quando houver demanda): guardar **hash** (SHA-256), nunca o token. Sem OAuth2 próprio. Detalhes em `docs/ARCHITECTURE.md`.
- **Storage (fotos de RAT):** upload direto para a API, salvo **localmente no servidor** em **volume mapeado do Docker** (decisão atual: não usar Firebase Storage).
- **Asaas (faturamento):** ao criar um `client`, gravar com sincronização pendente e criar no Asaas via job com retry, guardando `asaasCustomerId`; webhooks (`PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`) atualizam o status local; validar sempre o token do Asaas no header do webhook.

## Convenções

- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`), validados por commitlint. Sem Jira/issue keys (projeto solo).
- **Branches:** `feat/<descricao>`, `fix/<descricao>`, `docs/<descricao>`, `chore/<descricao>` a partir de `develop`; PR para `develop`. O merge em `develop` gera a tag `vX.Y.Z-develop` (`.github/workflows/bump-develop.yml`).
- **Formatação (Prettier):** sem ponto e vírgula, aspas simples, `trailingComma: all`, `arrowParens: avoid`, 80 colunas. ESLint base airbnb + prettier.
- **Testes (obrigatório):** todo código novo nasce com testes, no mesmo commit ou passo — unitários e, quando tocar banco/HTTP, de integração/e2e. Cobrir caminho feliz e edge cases definidos no `docs/passos`. Sem teste, o passo não está concluído. Jest na API e em `packages/dto`.
- **Dependências novas e críticas:** justifique antes de adicionar; não altere a estrutura de pastas sem alinhar.

## Estado atual

Fase 0 concluída (Postgres em Docker, TypeORM, migrations). Feito: modelo multi-tenant e CRUD de contas/usuários/papéis (`docs/passos/004`), ainda sem autenticação — conta ativa via `X-Tenant-Id`. Próximo: seed IBGE e Firebase Auth.

## Documentação dos passos

A cada passo relevante (módulo, endpoint, migration, decisão), crie ou atualize `docs/passos/NNN-titulo.md` e o índice em `docs/passos/README.md` **no mesmo trabalho**, não depois. Se a decisão mudar uma regra geral, atualize também `docs/ARCHITECTURE.md` e este arquivo.

## Fluxo de trabalho esperado

Requisito → desenho (estrutura + regras + edge cases, formato Given/When/Then) → implementação com testes → revisão → aprovação humana. Veja `docs/AGENTS.md`.
