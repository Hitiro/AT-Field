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
- Cidades/estados vêm do IBGE (tabelas `states`/`cities`): base de **referência global, sem `tenantId`**, só leitura e com rotas públicas. Versionada em arquivo (`apps/api/src/geo/ibge/data/localidades-AAAA-MM.json`, gerado por `pnpm --filter api geo:snapshot`) e carregada por **migration** com upsert, nunca apagando município. Busca pela coluna normalizada `searchName` (normalização própria da API, sem depender do `@at-field/core`). Ver `docs/passos/007-base-ibge-estados-cidades.md` e COM-05.
- Modelo completo em `docs/passos/002-modelo-multi-tenant.md`.

## Autenticação e Autorização

Camadas, implementadas nesta ordem:

1. **Usuários internos (web/mobile)**: Firebase Auth. A API valida o Bearer Token em um guard. A tabela `users` guarda `firebaseUid` (único).
2. **RBAC**: tabelas `roles` (por tenant), `permissions` (globais) e `role_permissions`; o papel vive no `membership`.
3. **Integradores externos (API keys)**: só quando surgir o primeiro caso real. OAuth2 próprio fica fora do escopo; se for necessário, o único fluxo previsto é `client_credentials`.

Regras:

- **Permissões** no formato `módulo:ação` (ex.: `clients:read`, `service_calls:write`), exigidas por decorator (`@RequirePermissions(...)`). O mesmo guard atende usuários e API keys; a origem da credencial é detalhe.
- **API keys**: token aleatório e longo, exibido uma única vez, com prefixo visível (ex.: `atf_live_ab12...`). No banco fica apenas o **hash** (SHA-256), nunca o token nem uma versão criptografada. Campos: dono, escopos, `lastUsedAt`, `expiresAt`, `revokedAt`.

## Erros e logs (implementado no passo 008)

Objetivo: todo erro visto pelo usuário leva direto ao ponto do código e ao log da requisição. Um 500 com só "Internal server error" não serve para depurar. Detalhes em `docs/passos/008-codigos-erro-requestid-logs.md`.

- **Código de erro estável** por situação (ex.: `GEO-001`, `USR-003`), formato `PREFIXO-NNN`, no catálogo único `ERROR_CODES` de `packages/dto/src/errors.ts` (status HTTP e mensagem fixa por código). Exceção de domínio = `throw new AppException(código, details?)` (`apps/api/src/common/errors/app.exception.ts`); não se lança `BadRequestException` & cia. diretamente (um spec varre `src` e barra). Buscar o código no repositório leva a um único `throw`.
- **Novo erro = novo código no catálogo + entrada em `PUBLISHED`** (`packages/dto/src/errors.spec.ts`). Código publicado **nunca é reaproveitado** nem muda de status; ao remover, vai para `RETIRED_ERROR_CODES`. Prefixo = módulo onde está o `throw`; `GEN-NNN` = status HTTP.
- **`requestId`** por requisição: middleware Express registrado antes dos body-parsers (`configureApp`, chamado antes do `init`), reaproveita `X-Request-Id` válido (`^[A-Za-z0-9._:-]{8,64}$`) ou gera UUID, devolve no header e guarda no `AsyncLocalStorage` (`requestContext`). Erro inesperado (500) sai como `GEN-500`, sempre com `requestId` e o stack completo no log.
- **Formato único de erro** na resposta, por um filtro global (`AllExceptionsFilter`): `{ code, message, requestId, details? }`, header `X-Request-Id` e `Cache-Control: no-store` se a rota não definiu outro. Web e mobile exibem "Erro USR-003 (ref. a1b2c3d4)" (COM-06, `formatErrorReference`).
- **Log estruturado**: `AppLogger` (estende o `ConsoleLogger` do Nest 12), JSON de uma linha por evento (`LOG_FORMAT=json`, padrão em production) ou texto colorido (`pretty`, padrão fora), nível por `LOG_LEVEL`; toda linha leva `requestId` e `tenantId` do contexto; uma linha de acesso por requisição (contexto `HTTP`). Trocar o destino = mexer só no `AppLogger`/`LoggingModule`.
- **Nunca logar** headers, corpo, query string nem dado pessoal na mensagem; `redact` mascara senha, tokens, chaves de API, `cpf`, `cnpj`, `document`, `email`, `phone`/`telefone` em qualquer profundidade. O redact casa a **chave exata**: chave nova com dado sensível entra em `DEFAULT_REDACT_KEYS` (`app-logger.ts`). `QueryFailedError` vai para o log sem `parameters` nem `detail`, e a mensagem do Postgres sai com os trechos entre aspas (valores) trocados por `"***"`.
- **Todo status tem código:** `GEN-<status>` para cada `HttpException` embutida do Nest (um teste itera sobre elas), para os erros do body-parser (413, 415) e o 429; erros do Postgres mapeados por SQLSTATE em `DB-0xx` (400/409 para erro de dado, 503 para banco ocupado/indisponível, inclusive erros de conexão do driver sem SQLSTATE; 08P01 e não mapeados = `GEN-500`). Mensagens genéricas, nunca com o valor enviado. **4xx do Postgres gera log `warn` completo** ("Violação no banco", com `errorLogFields`: pgCode, constraint, table, column, query, stack, rota, handler) e os identificadores entram na linha de acesso, porque na prática indicam validação da aplicação que falhou; 5xx gera `error`. As mensagens do driver sem SQLSTATE foram conferidas para `PG_MESSAGES_VERIFIED_FOR` (pg 8.23 / pg-pool 3.14): um teste falha se a versão instalada mudar sem revisão.
- **Limites de texto no Zod = colunas `varchar`:** `TEXT_LIMITS` (`packages/dto/src/schemas.ts`) espelha o tamanho das colunas, para texto longo sair como `VAL-001` apontando o campo, e não como `DB-007` do Postgres. Coluna de texto nova ou alterada: atualizar `TEXT_LIMITS` e o schema.
- **`logger.error`/`fatal` sempre com o helper:** `this.logger.error('Mensagem fixa', errorLogFields(err, extra?))` (`apps/api/src/common/logging/error-log-fields.ts`). Nunca passar o `Error` cru nem interpolar dado pessoal na mensagem. O helper traz `method`, `path`, `route`, `handler` (gravados pelo `RequestContextGuard` global), `durationMs`, o erro serializado (stack, cadeia de `cause`, campos do Postgres saneados) e `app` (versão, env, host), sem `detail`/`parameters`/`where`/`body`/`input`.

## Integrações

- **Asaas**: a criação do cliente no Asaas não ocorre dentro da requisição. O cliente é gravado com status de sincronização pendente e processado por job/fila com retry; `asaasCustomerId` é preenchido ao concluir.

## Gestão de Documentação

Esta pasta (`docs/`) contém o contexto do projeto, padrões e decisões técnicas. Ela é versionada no Git e serve como memória contextual para agentes e desenvolvedores.
