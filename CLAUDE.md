# CLAUDE.md

Guia para o Claude Code neste repositório. Respostas, commits e documentação em **português (pt-BR)**.

## Projeto

AT-Field: sistema de gestão de serviços de campo (Field Service), do chamado ao faturamento. Painel web para administradores, app mobile para técnicos, API central com toda a regra de negócio.

**Visão do produto: `docs/VISAO-PRODUTO.md`** — o foco é o técnico e o app mobile; leia antes de propor qualquer funcionalidade. **Regras de negócio por lado em `docs/regras/`** (técnico, empresa, comum), com códigos `TEC-xx`/`EMP-xx`/`COM-xx`.

Contexto detalhado em `docs/` (ignorado pelo Git, serve de memória para agentes — leia antes de propor estruturas):

- `docs/ARCHITECTURE.md` — padrões técnicos e infraestrutura local
- `docs/AGENTS.md` — perfis (@architect, @business-rule, @coder, @reviewer) e fluxo de trabalho
- `docs/skills.md` — diretrizes de Auth, Storage, Banco e Asaas
- `docs/passos/` — registro numerado de cada passo do desenvolvimento

## Estrutura do monorepo (pnpm workspaces)

| Caminho | Conteúdo |
| --- | --- |
| `apps/api` | NestJS 12 (backend). Docs Scalar em `/api`, OpenAPI em `/api-json`. Porta `4310` |
| `apps/web` | Next.js 16 (painel admin) |
| `apps/mobile` | Expo SDK 58 / React Native 0.88 (app do técnico), código em `src/` |
| `packages/dto` | `@at-field/dto` — DTOs/tipos compartilhados (`src/index.ts`) |
| `packages/core` | `@at-field/core` — cálculo puro compartilhado (simulador, custo por km, parser do WhatsApp, agenda, resumo/financeiro), sem dependências |

Gerenciador: **pnpm 10** (`nodeLinker: hoisted`), Node 22.12+ (a API carrega os pacotes ESM do Nest 12 via `require(esm)`). TypeScript fixado em `~6.0.3`. Tarefas orquestradas pelo **Turborepo** (`turbo.json`: build, dev, lint, test).

## Comandos

```bash
pnpm install
docker compose --env-file apps/api/.env up -d   # PostgreSQL local
pnpm dev                        # todos os apps via turbo (ou use --filter <app> dev)
pnpm --filter api dev           # API com watch
pnpm --filter api migration:run # aplica migrations (TypeORM)
pnpm --filter api geo:snapshot  # regera o retrato do IBGE (só ao atualizar a base; ver docs/passos/007)
pnpm --filter api test          # vitest (unit)
pnpm --filter api test:e2e      # vitest e2e contra Postgres real (banco <DATABASE_NAME>_test, criado no globalSetup)
pnpm lint                       # tsc --noEmit + eslint em todos os pacotes
pnpm --filter web dev
pnpm --filter mobile dev
```

**Portas** (bloco 43xx reservado, para não conflitar com outros projetos locais): API `4310`, Web `4311`, Mobile/Metro `4312`, PostgreSQL `54310`. A da API e a do banco vêm do `.env`.

Variáveis de ambiente: copie `.env.example` para `apps/api/.env` (`NODE_ENV`, `PORT`, `DATABASE_HOST/PORT/USER/PASSWORD/NAME`).

## Arquitetura e regras

- **Custo baixo é requisito:** prefira open source e gratuito; serviço externo pago só com justificativa e atrás de um adapter próprio (trocar de provedor sem reescrever).

- **Cálculo puro compartilhado em `packages/core`; persistência e decisão oficial na API** (regra D1, passo 006). Persistência, integrações e regras com estado ficam só na API; Web e Mobile são camadas de apresentação que consomem a API e podem usar o `@at-field/core` para mostrar cálculos na hora. Nada de I/O, relógio ou dependência no `core`.
- **TypeScript strict** em todos os pacotes. A API compila para CommonJS: imports relativos **sem** extensão `.js`.
- **Tipos/DTOs compartilhados** em `packages/dto` (compila para `dist/`; rode `pnpm --filter @at-field/dto build` se alterar, o Turborepo faz isso em `pnpm dev`). Verifique `packages/` antes de criar estruturas novas; reutilize.
- **Validação** de payloads com **Zod** (na API via `nestjs-zod`, não `class-validator`).
- **ORM:** TypeORM, com `synchronize: false`; schema só via migrations.
- **Banco:** PostgreSQL (via Docker). Toda alteração estrutural via **migrations**. Tabelas do MVP: `clients`, `service_types`, `users`, `service_calls`. `states`/`cities` (IBGE) são referência global sem `tenantId`, carregadas por migration a partir de um retrato versionado (passo 007).
- **Multi-tenant:** tenant = conta CPF/CNPJ; usuários ligados por `memberships` (N:N) com papel por vínculo; `tenantId` em toda tabela de negócio; tenant ativo via `X-Tenant-Id`. Ver `docs/passos/002-modelo-multi-tenant.md`.
- **Auth:** Firebase Authentication; a API valida o Bearer Token nas rotas protegidas (`users.firebaseUid` único). Push via FCM.
- **Autorização:** RBAC (`roles` por tenant, `permissions` globais) com permissões `módulo:ação` via `@RequirePermissions`. API keys para integradores (só quando houver demanda): guardar **hash** (SHA-256), nunca o token. Sem OAuth2 próprio. Detalhes em `docs/ARCHITECTURE.md`.
- **Storage (fotos de RAT):** upload direto para a API, salvo **localmente no servidor** em **volume mapeado do Docker** (decisão atual: não usar Firebase Storage).
- **Asaas (faturamento):** ao criar um `client`, gravar com sincronização pendente e criar no Asaas via job com retry, guardando `asaasCustomerId`; webhooks (`PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`) atualizam o status local; validar sempre o token do Asaas no header do webhook.

## Convenções

- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`), validados por commitlint. Sem Jira/issue keys (projeto solo).
- **Branches:** `feat/<descricao>`, `fix/<descricao>`, `docs/<descricao>`, `chore/<descricao>` a partir de `develop`; PR para `develop`. O merge em `develop` gera a tag `vX.Y.Z-develop` (`.github/workflows/bump-develop.yml`).
- **Formatação (Prettier):** sem ponto e vírgula, aspas simples, `trailingComma: all`, `arrowParens: avoid`, 80 colunas. ESLint base airbnb + prettier. Fim de linha **LF** em todo o repo, garantido pelo `.gitattributes` (`* text=auto eol=lf`), mesmo com `core.autocrlf=true` no Windows (passo 007).
- **Testes (obrigatório):** todo código novo nasce com testes, no mesmo commit ou passo — unitários e, quando tocar banco/HTTP, de integração/e2e. Cobrir caminho feliz e edge cases definidos no `docs/passos`. Sem teste, o passo não está concluído. Vitest na API, em `packages/dto` e em `packages/core`; no mobile, `jest-expo` + `@testing-library/react-native` (testes em `src/__tests__`).
- **Dependências novas e críticas:** justifique antes de adicionar; não altere a estrutura de pastas sem alinhar.

## Estado atual

Fase 0 concluída (Postgres em Docker, TypeORM, migrations). Feito: modelo multi-tenant e CRUD de contas/usuários/papéis (`docs/passos/004`), ainda sem autenticação — conta ativa via `X-Tenant-Id`; protótipo navegável do app do técnico com dados de exemplo em memória e o pacote `@at-field/core` (`docs/passos/006`); base IBGE de estados e cidades com rotas públicas (`docs/passos/007`). Próximo: códigos de erro, `requestId` e log estruturado (passo 008, ver "Erros e logs" em `docs/ARCHITECTURE.md`); depois Firebase Auth.

## Documentação dos passos

A cada passo relevante (módulo, endpoint, migration, decisão), crie ou atualize `docs/passos/NNN-titulo.md` e o índice em `docs/passos/README.md` **no mesmo trabalho**, não depois. Se a decisão mudar uma regra geral, atualize também `docs/ARCHITECTURE.md` e este arquivo.

## Fluxo de trabalho com agentes (obrigatório em toda task de desenvolvimento)

Toda task que mexe em código passa pelos três subagentes de `.claude/agents/`, nesta ordem, antes de qualquer resposta de "pronto" ao usuário:

1. **`arquiteto`** — lê o código e propõe a solução (spec: arquivos, contratos, regras, edge cases, plano de testes). Se a spec trouxer **perguntas em aberto**, pergunte ao usuário antes de seguir.
2. **`codificador`** — implementa a spec com testes e documenta o passo; pesquisa a documentação da linguagem/framework quando precisar. Passe a ele a spec inteira.
3. **`revisor`** — revisa tudo (passe a spec e o relatório do codificador) e dá o veredito.
   - **MUDANÇAS NECESSÁRIAS** → volte ao `codificador` com os apontamentos bloqueantes e depois ao `revisor` de novo. Se após 2 rodadas ainda houver bloqueio, pare e leve ao usuário.
   - **APROVADO** → só então avise o usuário que o código está pronto para ele revisar: o que foi feito, testes e resultados, sugestões não bloqueantes do revisor e o que ficou pendente.

Ninguém commita: o usuário revisa e commita. Perguntas rápidas, explicações e mudanças só de documentação não precisam do fluxo. Detalhes em `docs/AGENTS.md`.
