# Arquitetura do Projeto AT-Field

## Visão Geral

Monorepo gerenciado via Turborepo e pnpm, contendo três aplicações principais:

- `apps/api`: NestJS 12 (Backend), compilado para CommonJS
- `apps/web`: Next.js (Frontend Web)
- `apps/mobile`: Expo (Frontend Mobile)

Pacotes compartilhados:

- `packages/dto` (`@at-field/dto`): contratos — schemas Zod, tipos, validação de CPF/CNPJ.
- `packages/core` (`@at-field/core`): cálculo puro do domínio do técnico (simulador, custo por km, cobrança, agenda, resumo/financeiro, reputação, parser do WhatsApp). Sem dependências, sem I/O, sem relógio (datas entram por parâmetro); dinheiro em centavos inteiros.

## Padrões Técnicos

1. **TypeScript Strict**: Todos os pacotes devem usar `tsconfig.json` estrito.
2. **Shared Types**: Tipagens comuns devem residir em `packages/dto` ou `packages/types`.
3. **Validação**: Zod para validação de payloads. Na API, via `nestjs-zod` (DTOs a partir de schemas Zod, integrado ao Swagger) em vez de `class-validator`.
4. **ORM**: TypeORM (PostgreSQL). Schema evolui apenas via migrations (`synchronize: false`).
5. **Regra D1 (passo 006)**: cálculo puro compartilhado fica em `@at-field/core`; persistência e decisão oficial ficam na API. Web e mobile podem usar o `core` para mostrar números na hora; a API recalcula com o mesmo código ao gravar. O `dto` continua só contrato.

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

## Erros e logs (decidido em 2026-10-24; implementação no passo 008)

Objetivo: todo erro visto pelo usuário leva direto ao ponto do código e ao log da requisição. Um 500 com só "Internal server error" não serve para depurar.

- **Código de erro estável** por situação (ex.: `GEO-001`, `USR-003`), num catálogo único em `packages/dto` com significado de cada código. Toda exceção lançada pela API usa um código do catálogo; buscar o código no repositório leva ao `throw`.
- **`requestId`** por requisição: gerado por middleware (ou reaproveitado do header `X-Request-Id`), devolvido no header da resposta e presente em todas as linhas de log da requisição. Erro inesperado (500) não tem código de negócio, mas sempre tem `requestId` e o stack completo no log.
- **Formato único de erro** na resposta: `{ code, message, requestId }` (mais `details` em erros de validação). Web e mobile exibem algo como "Erro USR-003 (ref. a1b2c3)".
- **Log estruturado em JSON** (open source, ex.: `pino` ou Logger do Nest), filtrável por `requestId`, `code`, `tenantId` e usuário; trocar o destino (arquivo, ferramenta de logs) sem reescrever código. Nunca logar senha, token ou dado sensível.
- Vem antes do Firebase Auth para que os erros de autenticação e permissão já nasçam com código.

## Integrações

- **Asaas**: a criação do cliente no Asaas não ocorre dentro da requisição. O cliente é gravado com status de sincronização pendente e processado por job/fila com retry; `asaasCustomerId` é preenchido ao concluir.

## Gestão de Documentação

Esta pasta (`docs/`) contém o contexto do projeto, padrões e decisões técnicas. Ela é versionada no Git e serve como memória contextual para agentes e desenvolvedores.
