# Arquitetura do Projeto AT-Field

## Visão Geral

Monorepo gerenciado via Turborepo e pnpm, contendo três aplicações principais:

- `apps/api`: NestJS (Backend)
- `apps/web`: Next.js (Frontend Web)
- `apps/mobile`: Expo (Frontend Mobile)

## Padrões Técnicos

1. **TypeScript Strict**: Todos os pacotes devem usar `tsconfig.json` estrito.
2. **Shared Types**: Tipagens comuns devem residir em `packages/dto` ou `packages/types`.
3. **Validação**: Zod para validação de payloads. Na API, via `nestjs-zod` (DTOs a partir de schemas Zod, integrado ao Swagger) em vez de `class-validator`.
4. **ORM**: TypeORM (PostgreSQL). Schema evolui apenas via migrations (`synchronize: false`).

## Infraestrutura Local

- **Banco de Dados**: PostgreSQL via Docker.
- **Storage**: Mount local para arquivos técnicos (RATs).
- **Autenticação**: Firebase Auth com validação de tokens no backend.

## Multi-tenancy

- Plataforma **multi-tenant** com schema único: tabelas de negócio têm `tenantId` e a API filtra por ele automaticamente.
- Tenant = conta CPF ou CNPJ. Usuário = pessoa (CPF) com vínculo N:N com tenants (`memberships`), papel por vínculo.
- Tenant ativo informado em `X-Tenant-Id` e validado contra o vínculo.
- Cidades/estados vêm do IBGE (tabelas `states`/`cities`).
- Modelo completo em `docs/passos/002-modelo-multi-tenant.md`.

## Autenticação e Autorização

Camadas, implementadas nesta ordem:

1. **Usuários internos (web/mobile)**: Firebase Auth. A API valida o Bearer Token em um guard. A tabela `users` guarda `firebaseUid` (único).
2. **RBAC**: tabelas `roles` (por tenant), `permissions` (globais) e `role_permissions`; o papel vive no `membership`.
3. **Integradores externos (API keys)**: só quando surgir o primeiro caso real. OAuth2 próprio fica fora do escopo; se for necessário, o único fluxo previsto é `client_credentials`.

Regras:

- **Permissões** no formato `módulo:ação` (ex.: `clients:read`, `service_calls:write`), exigidas por decorator (`@RequirePermissions(...)`). O mesmo guard atende usuários e API keys; a origem da credencial é detalhe.
- **API keys**: token aleatório e longo, exibido uma única vez, com prefixo visível (ex.: `atf_live_ab12...`). No banco fica apenas o **hash** (SHA-256), nunca o token nem uma versão criptografada. Campos: dono, escopos, `lastUsedAt`, `expiresAt`, `revokedAt`.

## Integrações

- **Asaas**: a criação do cliente no Asaas não ocorre dentro da requisição. O cliente é gravado com status de sincronização pendente e processado por job/fila com retry; `asaasCustomerId` é preenchido ao concluir.

## Gestão de Documentação

Esta pasta (`docs/`) contém o contexto do projeto, padrões e decisões técnicas. Ela é versionada no Git e serve como memória contextual para agentes e desenvolvedores.
