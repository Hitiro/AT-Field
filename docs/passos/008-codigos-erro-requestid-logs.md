# 008 — Códigos de erro, requestId e log estruturado

Todo erro da API passa a ter um **código estável** de um catálogo único, uma **referência** (`requestId`) que também aparece em todas as linhas de log da requisição, e o log sai em **JSON estruturado**. Todo log de nível `error` leva o máximo de informação para depurar sem reproduzir, sem dado pessoal. Regra de negócio: **COM-06** (`docs/regras/comum.md`). Decisão de arquitetura registrada em `docs/ARCHITECTURE.md` ("Erros e logs").

## Objetivo

- Do erro na tela ao ponto do código e ao log: o usuário vê "Erro USR-003 (ref. a1b2c3d4)", o suporte busca `a1b2c3d4` no log e o código leva a um único `throw` no repositório.
- Um 500 nunca mostra detalhe interno ao cliente, mas sempre deixa no log o stack completo, a cadeia de `cause`, a rota e o handler, com o `requestId`.
- Todo status que a API pode emitir tem código: as `HttpException` embutidas do Nest, os erros do body-parser, o 429 do rate limit e os erros do Postgres.
- Feito antes do Firebase Auth para que os erros de autenticação e permissão já nasçam com código (`AUT`, `PRM`).

## O que mudou

### `@at-field/dto` (`src/errors.ts`)

- `ERROR_CODES`: catálogo `{ 'USR-003': { status: 409, message: '...' }, ... }`. A chave é o próprio código (o TypeScript barra chave duplicada). `ErrorCode` = chaves do catálogo. `ErrorStatus` lista os status permitidos (os das `HttpException` do Nest, os do body-parser e o 429).
- `ERROR_PREFIXES` (`GEN`, `VAL`, `DB`, `TEN`, `USR`, `ROL`, `GEO`; previstos `AUT` e `PRM`), `ERROR_CODE_PATTERN` (`^(GEN|VAL|DB|TEN|USR|ROL|GEO)-\d{3}$`), `isErrorCode`.
- `RETIRED_ERROR_CODES`: códigos removidos; nunca voltam ao catálogo.
- `errorResponseSchema` (Zod) e o tipo `ErrorResponse` = `{ code, message, requestId, details? }`.
- `formatErrorReference(code, requestId)` → `"Erro USR-003 (ref. a1b2c3d4)"` (COM-06), para web e mobile usarem quando consumirem a API.
- `schemas.ts`: `TEXT_LIMITS` (`name` 150, `email` 255, `phone` 20, `roleName` 60) espelha o tamanho das colunas `varchar` e é usado nos schemas. Antes, o `emailSchema` não tinha limite: um e-mail de mais de 255 caracteres passava no Zod e estourava `users.email` (`varchar(255)`) no Postgres (22001 → `DB-007`). Agora sai `VAL-001` com `details.issues[].path = 'owner.email'` (ou `email` no `POST /users`). O limite vale depois do `trim`. Conferi todos os textos que vêm de payload: só o e-mail estava fora. `name`, nome de papel e `phone` já batiam com as colunas; `document` e `cpf` são normalizados e validados como CPF/CNPJ (11/14 dígitos); `firebaseUid` e as colunas de `cities`/`states`/`permissions` não vêm de payload, e as chaves de permissão só são comparadas em `WHERE IN`. **Coluna de texto nova ou alterada: atualizar `TEXT_LIMITS`.**

Formato do código: `PREFIXO-NNN`. `GEN-NNN` usa o próprio status HTTP; os de domínio são sequenciais a partir de 001 **pelo módulo onde está o `throw`** (por isso "Cidade inexistente" é `USR-004`/400 em `people.ts` e `GEO-002`/404 em `geo.service.ts`). O catálogo da documentação (Scalar, `/api`) é gerado do próprio `ERROR_CODES`.

**Política de mensagens:** a mensagem é fixa por código e genérica; **nunca cita o valor enviado nem dado da linha**. O que varia vai em `details`, também sem dado pessoal.

#### Genéricos (`GEN`): todo status emitido

| Código | HTTP | Mensagem | Origem |
| --- | --- | --- | --- |
| GEN-400 | 400 | Requisição inválida | `BadRequestException`: pipes (`ParseIntPipe`, `ParseUUIDPipe`), JSON malformado, `URIError`, body-parser 400 |
| GEN-401 | 401 | Não autenticado | `UnauthorizedException` (Firebase) |
| GEN-403 | 403 | Acesso negado | `ForbiddenException` |
| GEN-404 | 404 | Rota não encontrada | `NotFoundException` (404 do roteador) |
| GEN-405 | 405 | Método não permitido | `MethodNotAllowedException` |
| GEN-406 | 406 | Formato de resposta não aceito | `NotAcceptableException` |
| GEN-408 | 408 | Tempo da requisição esgotado | `RequestTimeoutException` |
| GEN-409 | 409 | Conflito com o estado atual | `ConflictException` |
| GEN-410 | 410 | Recurso não está mais disponível | `GoneException` |
| GEN-412 | 412 | Pré-condição não atendida | `PreconditionFailedException` |
| GEN-413 | 413 | Requisição grande demais | `PayloadTooLargeException`, body-parser `entity.too.large` |
| GEN-415 | 415 | Tipo de conteúdo não suportado | `UnsupportedMediaTypeException`, body-parser `charset.unsupported`/`encoding.unsupported` |
| GEN-418 | 418 | Sou um bule de chá | `ImATeapotException` |
| GEN-421 | 421 | Requisição enviada ao servidor errado | `MisdirectedException` |
| GEN-422 | 422 | Dados não processáveis | `UnprocessableEntityException` |
| GEN-429 | 429 | Muitas requisições. Tente novamente em instantes. | reservado para o rate limit do deploy |
| GEN-500 | 500 | Erro interno. Informe a referência ao suporte. | `InternalServerErrorException` e todo erro inesperado |
| GEN-501 | 501 | Funcionalidade não implementada | `NotImplementedException` |
| GEN-502 | 502 | Resposta inválida de um serviço externo | `BadGatewayException` |
| GEN-503 | 503 | Serviço indisponível. Tente novamente em instantes. | `ServiceUnavailableException` |
| GEN-504 | 504 | Tempo esgotado aguardando um serviço externo | `GatewayTimeoutException` |
| GEN-505 | 505 | Versão do HTTP não suportada | `HttpVersionNotSupportedException` |

As 21 `HttpException` embutidas do `@nestjs/common` 12.2 (conferidas em `node_modules/@nestjs/common/exceptions`) têm `GEN-<status>`. Um teste itera sobre as classes exportadas que estendem `HttpException`, instancia cada uma e confere o código e o status, então uma exceção nova do Nest sem código quebra o teste. Status fora do catálogo continua com o fallback (`GEN-400` para 4xx, `GEN-500` para 5xx, mantendo o status HTTP), só como último recurso.

#### Validação e Postgres (`VAL`, `DB`)

| Código | HTTP | Mensagem | Origem (SQLSTATE) |
| --- | --- | --- | --- |
| VAL-001 | 400 | Dados inválidos | `ZodValidationException` (body, query, `ZodValidationPipe(ufSchema)`) |
| DB-001 | 409 | Registro duplicado | 23505 unique_violation |
| DB-002 | 409 | Registro em uso ou referência inexistente | 23503 foreign_key_violation |
| DB-003 | 400 | Valor inválido | 22P02 invalid_text_representation |
| DB-004 | 400 | Campo obrigatório ausente | 23502 not_null_violation |
| DB-005 | 400 | Valor fora das regras permitidas | 23514 check_violation |
| DB-006 | 409 | Conflito com registro existente | 23P01 exclusion_violation |
| DB-007 | 400 | Texto maior que o permitido | 22001 string_data_right_truncation |
| DB-008 | 400 | Número fora do intervalo permitido | 22003 numeric_value_out_of_range |
| DB-009 | 400 | Data ou hora inválida | 22007 invalid_datetime_format, 22008 datetime_field_overflow |
| DB-010 | 409 | Conflito de concorrência, tente novamente | 40001 serialization_failure, 40P01 deadlock_detected |
| DB-011 | 503 | Banco ocupado, tente novamente | 55P03 lock_not_available, 57014 query_canceled (statement timeout), `Query read timeout` do pg |
| DB-012 | 503 | Banco de dados indisponível | classe 08 (08000, 08001, 08003, 08004, 08006...), **exceto 08P01**, 57P01/57P02/57P03, 53300, erros de conexão do driver (ver abaixo) |
| DB-013 | 400 | Texto com caractere inválido | 22021 character_not_in_repertoire (ex.: `\u0000`), 22P05 untranslatable_character |

Escolhas no mapa do Postgres:

- **DB-007 (22001)** fica como segunda barreira: com `TEXT_LIMITS` não há mais caminho real até ele (o e2e o simula com spy). Ele só aparece se uma coluna nova ficar sem limite no schema.
- **DB-013 (22021/22P05)** não estava na proposta. Entrou porque é um erro que o cliente provoca de verdade (o Zod aceita `\u0000` em texto e o Postgres recusa), coberto por um e2e sem mock.
- **22012** (division_by_zero), 42xxx (erro de SQL) e afins ficam em `GEN-500`: são bug do código, não erro do cliente.
- **08P01** (protocol_violation) fica fora da classe 08 e cai em `GEN-500` com log `error` completo: não é banco fora do ar, é bug do cliente SQL (ex.: bind com número de parâmetros errado).
- **Os 4xx do Postgres (DB-001..DB-010, DB-013) geram log `warn` completo.** Na prática quase sempre indicam uma validação da aplicação que deixou passar o dado, ou seja, um bug: um service que esqueceu uma coluna NOT NULL vira 400 `DB-004`. Por isso o filtro emite `logger.warn('Violação no banco', errorLogFields(err, { code, status }))`, com `pgCode`, `constraint`, `table`, `column`, `schema`, `dataType`, `routine`, `query`, stack, `route` e `handler`, sem `detail` nem `parameters` e com a mensagem saneada. Também grava em `res.locals.error.db` os identificadores (`pgCode`, `constraint`, `table`, `column`), que entram na linha de acesso. Fica em `warn`, e não em `error`, porque a resposta é 4xx e o dado veio do cliente; o `error` fica para o que a API não sabe tratar.
- **22004 e 22023** não entraram porque não há caminho na API que os produza hoje.

**Erros de conexão sem SQLSTATE.** O node-postgres (pg 8.23 / pg-pool 3.14) não manda código nesses casos. Durante uma query, o TypeORM os embrulha em `QueryFailedError`; ao pegar conexão do pool, chegam como `Error` comum. Eles viram `DB-012`, ou `DB-011` no caso do read timeout, só quando reconhecidos com segurança:

- **mensagem exata do driver:** `Connection terminated`, `Connection terminated unexpectedly`, `Connection terminated due to connection timeout`, `timeout exceeded when trying to connect`, `Client has encountered a connection error and is not queryable`, `Client was closed and is not queryable`, `Cannot use a pool after calling end on the pool`, `Query read timeout`;
- **erro de rede** (`ECONNREFUSED`, `ECONNRESET`, `ETIMEDOUT`...) que veio do driver dentro de um `QueryFailedError`, ou cuja porta, inclusive nos filhos de um `AggregateError` do Node 22, é a `DATABASE_PORT`. Um `ECONNREFUSED` de outro serviço (ex.: Asaas, futuro) continua `GEN-500`.

**Revisar ao atualizar `pg`/`pg-pool`.** As mensagens exatas foram conferidas no código-fonte do pg 8.23 (`lib/client.js`) e do pg-pool 3.14 (`index.js`). A constante `PG_MESSAGES_VERIFIED_FOR = { pg: '8.23', 'pg-pool': '3.14' }` (`pg-errors.ts`) registra isso. Um teste do `pg-errors.spec.ts` lê a versão instalada de cada pacote e falha, com mensagem dizendo o que revisar, quando o major.minor muda. Ao atualizar o driver:

1. confira as mensagens no código novo;
2. ajuste `PG_DRIVER_MESSAGES`;
3. atualize a constante.

Assim a revisão não depende de memória.

#### Domínio

| Código | HTTP | Mensagem | Origem |
| --- | --- | --- | --- |
| TEN-001 | 403 | Header X-Tenant-Id ausente ou inválido | `common/tenant.guard.ts` |
| TEN-002 | 403 | Conta inexistente ou inativa | `common/tenant.guard.ts` |
| TEN-003 | 409 | Já existe uma conta com este documento | `tenants/tenants.service.ts` |
| USR-001 | 409 | Usuário desativado | `users/people.ts` |
| USR-002 | 409 | CPF já cadastrado com outro e-mail | `users/people.ts` |
| USR-003 | 409 | E-mail já cadastrado para outro CPF | `users/people.ts` |
| USR-004 | 400 | Cidade inexistente | `users/people.ts` |
| USR-005 | 409 | Usuário já vinculado a esta conta | `users/members.service.ts` |
| USR-006 | 404 | Usuário não encontrado nesta conta | `users/members.service.ts` |
| USR-007 | 400 | Papel inválido para esta conta | `users/members.service.ts` |
| USR-008 | 409 | A conta precisa de ao menos um owner ativo | `users/members.service.ts` |
| ROL-001 | 404 | Papel não encontrado | `roles/roles.service.ts` |
| ROL-002 | 409 | Papel de sistema não pode ser alterado | `roles/roles.service.ts` |
| ROL-003 | 409 | Papel de sistema não pode ser excluído | `roles/roles.service.ts` |
| ROL-004 | 409 | Papel em uso por usuários da conta | `roles/roles.service.ts` |
| ROL-005 | 409 | Já existe um papel com este nome | `roles/roles.service.ts` |
| ROL-006 | 400 | Permissões inválidas | `roles/roles.service.ts`, `details: { permissions: [...] }` |
| GEO-001 | 404 | UF inexistente | `geo/geo.service.ts` |
| GEO-002 | 404 | Cidade inexistente | `geo/geo.service.ts` |

#### Mudanças de status em relação a `develop`

- Nenhum erro que já tinha tratamento mudou de status: X-Tenant-Id ausente ou malformado continua 403; 23505, 23503 e 22P02 continuam 409/409/400; as exceções de domínio mantêm os status de antes. A única mudança visível no corpo desses erros é a de `ROL-006`: a lista de permissões inválidas saiu da mensagem e foi para `details.permissions`.
- **Comportamento novo deste card:** erros do Postgres que antes caíam no 500 genérico do `PgErrorFilter` agora têm status próprio:
  - 400: 23502, 23514, 22001, 22003, 22007, 22008, 22021, 22P05;
  - 409: 23P01, 40001, 40P01;
  - **503**: 55P03, 57014, classe 08, 57P0x, 53300 e erros de conexão do driver. É o caso do e2e "Postgres fora do ar", que passou de 500 para 503 `DB-012`.

### API — erros (`src/common/errors/`)

- `app.exception.ts`: `AppException(code, details?, { cause? })` estende `HttpException`; status e mensagem vêm do catálogo. Todos os `throw new XxxException(...)` dos services e do `TenantGuard` viraram `AppException`.
- `all-exceptions.filter.ts`: `@Catch()` único, registrado em `APP_FILTER` por factory (`new AllExceptionsFilter(DATABASE_PORT)`) no lugar do `PgErrorFilter` (removido, com o spec). Ordem de tratamento:
  1. resposta já enviada (`@Res()`): só loga;
  2. `AppException`;
  3. `ZodValidationException`: com `issues` → `VAL-001` + `details`; sem `ZodError` (exceção dentro de um transform) → `GEN-500` com `source: 'ZodValidationPipe'` no log;
  4. `QueryFailedError` → `mapPgError`; 4xx com log `warn` ("Violação no banco", `errorLogFields` completo), 5xx e não mapeado com log `error`; em todos, `pgCode`/`constraint`/`table`/`column` vão para a linha de acesso;
  5. `HttpException` → `GEN-<status>`;
  6. objeto http-errors 4xx com `expose` (413 e 415 do body-parser);
  7. erro de conexão com o banco fora de `QueryFailedError` (`mapDbConnectionError`);
  8. qualquer outra coisa → `GEN-500`.

  Sempre responde `{ code, message, requestId, details? }` em JSON, com `X-Request-Id` e `Cache-Control: no-store` quando a rota ainda não definiu um. Grava `res.locals.error = { code, reason? }` para o log de acesso. Todo 5xx vai para o log `error` com `errorLogFields`; a resposta nunca leva a mensagem original.
- `pg-errors.ts`: `mapPgError`, `mapDbConnectionError`, `sanitizePgMessage` e `pgLogFields` (`pgCode`, `severity`, `constraint`, `table`, `column`, `schema`, `dataType`, `routine`, `pgFile`, `pgLine`, `position`, `hint` saneado, `query`; nunca `parameters`, `detail`, `where` nem `internalQuery`).
- `validation-details.ts`: `toValidationDetails` → `{ issues: [{ path: 'owner.cpf', code, message }] }`, caminho com ponto (`permissions.0`, raiz = `''`), no máximo 50 issues, **nunca** o `input` do Zod.
- `openapi.ts`: `addErrorResponses(document)` põe o schema `ErrorResponse` (`z.toJSONSchema`, alvo `openapi-3.0`) e respostas `4XX`/`5XX` com `$ref` em toda operação que não as declara; `errorCatalogMarkdown()` gera a tabela do catálogo, exibida na descrição do Scalar (`/api`).

### API — requestId e log (`src/common/logging/`)

- `request-context.ts`: `AsyncLocalStorage` com `{ requestId, tenantId?, userId?, method?, path?, route?, handler?, startedAt? }` (`run`, `get`, `setTenantId`, `setHandler`; fora de requisição os setters são no-op). `userId` fica reservado para o Firebase. `IDENTITY_FIELDS` (`requestId`, `tenantId`, `userId`) são os que entram em toda linha.
- `request-id.ts`: `resolveRequestId` aceita `X-Request-Id` que case `^[A-Za-z0-9._:-]{8,64}$`; ausente, array, com vírgula (header duplicado) ou fora do padrão → `crypto.randomUUID()`, e o valor inválido não é ecoado nem logado. `requestIdMiddleware(logger)` grava `req.requestId`, devolve o header, abre o contexto (com `method`, `path` e `startedAt`) e escreve **uma** linha de acesso por requisição no `finish` (ou no `close` sem `writableFinished`, com `aborted: true`), dentro de `try/catch`. `pathOf` tira query string e fragmento (`?`/`#`).
- `request-context.guard.ts`: `RequestContextGuard` global (`APP_GUARD`) que **não autoriza nada**: só grava no contexto o padrão da rota (`req.route.path`, ex.: `/cities/:id`) e o handler (`CitiesController.findOne`). Precisa ser um guard porque o `ArgumentsHost` que o Nest entrega ao filtro é `new ExecutionContextHost([req, res, next])`, sem classe nem handler (conferido em `@nestjs/core/router/router-proxy.js`). Guards globais rodam antes dos guards de controller (`TenantGuard`), dos pipes e dos interceptors. Erros antes do roteamento (404, body-parser) ficam sem `route`/`handler`.
- `error-log-fields.ts`: `errorLogFields(err, extra?)`, o helper de todo log `error`/`fatal` (ver abaixo); `serializeError` e `appInfo`.
- `app-logger.ts`: `AppLogger extends ConsoleLogger` (Nest 12) com `json` conforme `LOG_FORMAT`, `flattenParams: true`, `logLevels: levelsFrom(LOG_LEVEL)` e `redact: DEFAULT_REDACT_KEYS`.
  - Sobrescreve `printMessages` para mesclar em toda linha só a identidade (`requestId`/`tenantId`/`userId`); método, rota e handler ficam para os logs de erro.
  - No modo texto, o `error.stack` do helper sai como bloco legível depois da linha.
  - Os `new Logger(Contexto)` do código delegam a ele via `useLogger`.
- `logging.module.ts` (`@Global`, factory com `ConfigService`) e `common/configure-app.ts`: `configureApp(app)` faz `useLogger(AppLogger)` e `app.use(requestIdMiddleware)`. É chamada **antes** de `app.init()`/`listen`, para o middleware ficar à frente dos body-parsers (registrados no init): JSON malformado, 413 e 415 também saem com `requestId` e linha de acesso.
- `TenantGuard` grava o `tenantId` no contexto depois de validar a conta.
- `main.ts`: `bufferLogs: true`, `configureApp(app)`, `addErrorResponses` e o catálogo no `setDescription`; `bootstrap().catch` loga `fatal` com `errorLogFields(error, { phase: 'bootstrap' })` e sai com 1.
- `config/env.ts`: `LOG_LEVEL` (`fatal|error|warn|log|debug|verbose`, padrão `log`) e `LOG_FORMAT` (`json|pretty`; sem valor → `json` em production, `pretty` fora), resolvido por `resolveLogFormat`. `.env.example` atualizado.
- Comentário do `GeoCacheInterceptor` atualizado (comportamento igual).

Linha de acesso (contexto `HTTP`, mensagem `"GET /users 404"`): `requestId, method, url, route?, status, durationMs, code?, reason?, pgCode?, constraint?, table?, column?, tenantId?, userId?, aborted?`. Os campos do Postgres são só identificadores, nunca valores. `url` é o caminho **sem** query string nem fragmento. Nível `log` abaixo de 400, `warn` em 4xx, `error` em 5xx. Exemplo real:

```json
{"level":"warn","pid":30608,"timestamp":1792866658058,"message":"GET /nao-existe 404","context":"HTTP","requestId":"boot-check-01","method":"GET","url":"/nao-existe","status":404,"durationMs":4,"code":"GEN-404","reason":"Cannot GET /nao-existe"}
```

### Log de erro: máximo de informação, sem dado pessoal

**Regra:** todo `logger.error`/`logger.fatal` recebe uma mensagem fixa (sem dado pessoal interpolado) e `errorLogFields(err, extra?)`:

```ts
this.logger.error('Falha ao sincronizar cliente', errorLogFields(err, { clientId }));
```

Campos da linha (JSON, uma linha):

| Grupo | Campos |
| --- | --- |
| Identidade (toda linha, pelo `AppLogger`) | `requestId`, `tenantId`, `userId` (Firebase) |
| Requisição (do contexto) | `method`, `path` (sem query/`#`), `route` (ex.: `/cities/:id`), `handler` (ex.: `CitiesController.findOne`), `durationMs` até o erro |
| Do chamador (`extra`) | ex.: no filtro, `code`, `status`, `source`, `headersSent`; no bootstrap, `phase` |
| Erro (`error`) | `name`, `message`, `stack` completo, propriedades primitivas próprias (ex.: `code`, `port`), `cause` recursiva (até 5 níveis, com `name`/`message`/`stack` de cada uma, ciclo marcado como `circular`) e `errors` de `AggregateError` (até 10) |
| Postgres (raiz e dentro de `error`) | `pgCode`, `severity`, `constraint`, `table`, `column`, `schema`, `dataType`, `routine`, `pgFile`, `pgLine`, `position`, `hint`, `query` (SQL com placeholders, sem `parameters`) |
| Processo (`app`) | `version` (de `apps/api/package.json`), `env` (`NODE_ENV`), `hostname`; o `pid` o Nest já põe em toda linha |

O processo (`app`) vai **só nas linhas de error/fatal**, não em toda linha nem no log de acesso: são valores iguais em todas as requisições, e repeti-los em cada acesso polui sem ajudar; o coletor de logs costuma anexar o host também.

Exemplo real (e2e, 500 simulado com `cause`; stacks encurtados):

```json
{"level":"error","message":"Erro inesperado","context":"AllExceptionsFilter","requestId":"teste-500-0001","method":"GET","path":"/cities/1","route":"/cities/:id","handler":"CitiesController.findOne","durationMs":3,"code":"GEN-500","status":500,"error":{"name":"Error","message":"segredo-interno","stack":"Error: segredo-interno\n    at ...","cause":{"name":"TypeError","message":"causa-raiz","stack":"TypeError: causa-raiz\n    at ..."}},"app":{"version":"0.0.1","env":"test","hostname":"..."}}
```

### Proteção de dados nos logs (LGPD)

1. **Primeira barreira:** headers, corpo e query string nunca são logados; dado pessoal nunca é interpolado na mensagem do log (o `redact` do Nest não atua em mensagem string nem em stack).
2. **Segunda barreira:** `redact` mascara, em qualquer profundidade de params e objetos logados (inclusive dentro de `error.cause`), as chaves `authorization, cookie, set-cookie, password, senha, database_password, token, accesstoken, refreshtoken, idtoken, apikey, x-api-key, asaas-access-token, secret, firebaseuid, cpf, cnpj, document, email, phone, telefone, telefones, remetentetelefone`. E-mail e telefone entraram por decisão do usuário; `cnpj`, `telefone(s)` e `remetenteTelefone` são os nomes usados no `@at-field/core`, `firebaseUid` na entidade `User`. **O redact do Nest casa a chave exata** (sem diferenciar maiúsculas): `ownerEmail` não é pego por `email`. Toda chave nova com dado sensível ou credencial precisa entrar em `DEFAULT_REDACT_KEYS` (`apps/api/src/common/logging/app-logger.ts`).
3. **Erro do Postgres:**
   - o `QueryFailedError` copia todas as propriedades do erro do driver, e o `serializeError` não as copia: usa só `pgLogFields`;
   - `parameters`, `detail`, `where` e `internalQuery` nunca entram;
   - a mensagem (e a primeira linha do stack) passa por `sanitizePgMessage`, que troca todo trecho entre aspas por `"***"`. O Postgres cita o valor recebido entre aspas (`invalid input syntax for type uuid: "abc"`, `date/time field value out of range: "2020-13-45"`, `value "999" is out of range`); identificadores perdidos assim (constraint, tabela, coluna) seguem nos campos próprios;
   - vale para todo erro do Postgres, mapeado ou não, e também quando ele aparece como `cause` de outro erro.
4. **Outros erros:** `serializeError` descarta as propriedades `detail`, `parameters`, `where`, `internalQuery`, `body` (http-errors do body-parser guarda o corpo inteiro), `input` (Zod), `driverError`, `response` e `config` (clientes HTTP). Valor lançado que não é `Error` vira só `{ name: 'NonError', type }`.
5. **`reason` do log de acesso:** é a mensagem original do Nest para erros 4xx genéricos, tratada por `safeReason`:
   - erro de JSON malformado (a mensagem cita trechos do corpo) vira `"JSON malformado"`;
   - nas demais, toda query string e fragmento (`?...`, `#...`) é removido, porque o 404 do roteador é `Cannot GET <originalUrl>` com a query (ex.: `/x?cpf=...&email=...` vira `Cannot GET /x`);
   - o texto é cortado em 200 caracteres;
   - se não sobrar texto, a chave `reason` não aparece.

### Testes e2e (infra)

- `test/utils.ts`: `createTestApp` chama `configureApp` antes do `init`; `expectError(res, status, code)` confere status, código, mensagem do catálogo e `requestId` = header.
- `test/setup-env.ts`: `LOG_FORMAT ??= 'json'`, `LOG_LEVEL ??= 'error'`.
- `app.e2e-spec.ts` usa `createTestApp` (e passou a fechar a app).

## Decisões

- **`ConsoleLogger` do Nest 12 em vez de `nestjs-pino`:** o 12.2 já tem JSON, redação por chave e params estruturados (`flattenParams`). Zero dependência; se um dia o pino fizer falta, troca-se só `AppLogger`/`LoggingModule`.
- **Serialização própria do erro (`serializeError`)** em vez da do Nest: o `serializeError` do `ConsoleLogger` copia toda propriedade primitiva do erro e das causas, o que levaria `detail`, `where` e o `body` do http-errors para o log. Por isso o helper entrega o erro já serializado e o código **não passa o objeto `Error` cru** ao logger.
- **`RequestContextGuard` (guard que só anota)** em vez de interceptor: o interceptor roda depois dos guards e perderia rota/handler nos erros do `TenantGuard` e dos pipes.
- **`AsyncLocalStorage` próprio em vez de `nestjs-cls`:** são poucas linhas, sem dependência.
- **Middleware por `app.use` antes do `init`** em vez de `MiddlewareConsumer`: o do consumer roda depois dos body-parsers, e erro de JSON malformado sairia sem `requestId`.
- **Mensagem fixa por código + `details`:** a mensagem identifica a situação; o que varia vai em `details`, sem dado pessoal.
- **Registro `PUBLISHED` no spec do dto em vez de snapshot do Vitest:** `vitest -u` atualizaria o snapshot calado. `PUBLISHED` só ganha entradas; código publicado não muda de status nem some sem ir para `RETIRED_ERROR_CODES`.
- **Erro de rede só vira `DB-012` com a porta do banco:** `ECONNREFUSED` sozinho é ambíguo (qualquer serviço externo); dentro de `QueryFailedError` ou com a porta do Postgres não é.
- **4xx do Postgres gera log `warn` completo, não `error`:** esses erros quase sempre denunciam uma validação da aplicação que falhou (bug), então precisam de toda a informação para depurar: helper completo e identificadores na linha de acesso. Mas a resposta é 4xx e o dado veio do cliente, então ficam em `warn`. 5xx do Postgres gera `error`. (Na primeira versão os 4xx não tinham log próprio; a revisão apontou que um 400 `DB-004` ficava só com a linha de acesso, sem coluna nem tabela.)
- `formatErrorReference` entrou no dto (opcional na decisão do usuário): é puro, pequeno e evita que web e mobile formatem a referência cada um de um jeito.
- `resolveLogFormat` em `config/env.ts` para testar a regra "json em production, pretty fora" isoladamente.
- `app.module.ts` passa `LOG_LEVEL`/`LOG_FORMAT` no objeto de `buildDataSourceOptions` porque a assinatura recebe `Env` inteiro.

## Testes

- `@at-field/dto` `errors.spec.ts` (11): formato e prefixo; status 400..599 e mensagem não vazia; `GEN-NNN` = status; aposentados fora do catálogo; registro `PUBLISHED` (todo publicado existe com o mesmo status ou está aposentado; todo código do catálogo está publicado), com as entradas novas acrescentadas no fim; `isErrorCode`; `errorResponseSchema`; `formatErrorReference`.
- `@at-field/dto` `schemas.spec.ts` (+7, limites = colunas): valores de `TEXT_LIMITS`; e-mail com 255 aceito e 256 rejeitado no campo `email`; limite vale depois do `trim`; no auto-cadastro o caminho é `owner.email`; nome 150/151 (pessoa e conta); telefone 20/21; nome de papel 60/61 (criar e editar).
- API unitários (225 no total):
  - `all-exceptions.filter.spec.ts` (68), por grupo:
    - **exceções da aplicação e validação:** `AppException` com e sem `details`; Zod com issues e sem `ZodError` (500 com `source`);
    - **Postgres:**
      - 4xx mapeados com log `warn` "Violação no banco" e sem `error` (23505, 23503, 22P02, 23502, 22001, 22007, 40P01, 22021), com `res.locals.error.db`;
      - 23502 com coluna: `warn` traz `column`, `table`, `schema`, `routine`, `query` e stack, sem `detail`/CPF/e-mail, e a linha de acesso recebe `pgCode`/`table`/`column`;
      - 08P01 → 500 `GEN-500` com log `error`;
      - 503 logados sem `detail` (08006, 57P01, 53300, 57014, 55P03);
      - mensagem com valor saneada no `message` e no stack;
      - desconhecido → 500 sem CPF;
    - **conexão fora de `QueryFailedError`:** porta do banco → 503, mensagem do pg-pool → 503, outra porta → 500;
    - **HttpException:** 400/404/413/418/429; 451 → fallback `GEN-400`; 503 → `GEN-503`; 507 → fallback `GEN-500`; **todas as 21 `HttpException` do Nest** com `GEN-<status>` e mesmo status;
    - **`reason`:** de JSON malformado, sem query e sem `#`; `reason` vazio não aparece;
    - **body-parser:** http-errors 413 e 415;
    - **log do 500:** `Error('senha=xyz')` (corpo limpo, log com `error`, `code`, `status`, `app`); cadeia de `cause`; valor não-Error;
    - **resto:** `headersSent` (inclusive com `QueryFailedError`); `Cache-Control` preservado; `requestId` gerado no filtro.
  - `pg-errors.spec.ts` (46): versão instalada de `pg` e `pg-pool` igual a `PG_MESSAGES_VERIFIED_FOR` (major.minor); cada SQLSTATE mapeado com status; desconhecidos (`XX000`, 22012, 42P01, 08P01) sem mapa; mensagens do driver sem SQLSTATE; erro de rede no driver; mensagem parecida não mapeia; `mapDbConnectionError` (mensagens do pg-pool, porta do banco ou outra, sem porta configurada, `AggregateError`, não-Error); `sanitizePgMessage` (uuid, timestamp com e-mail, data, número, aspas escapadas, mensagem sem aspas intacta); `pgLogFields` sem `parameters`/`detail`.
  - `error-log-fields.spec.ts` (12): serialização com propriedades primitivas; cadeia de `cause`; limite de 5 níveis e ciclo; `AggregateError`; não-Error; nunca `detail`/`parameters`/`where`/`body`/`input`; campos do Postgres com mensagem e stack saneados; Postgres dentro de `cause`; `errorLogFields` fora e dentro da requisição (`method`, `path`, `route`, `handler`, `durationMs`) e com `QueryFailedError`; com o `AppLogger`, chave sensível dentro de `cause` sai `[REDACTED]`.
  - `request-context.guard.spec.ts` (3): grava rota e handler e libera; sem `req.route`; fora de HTTP.
  - `request-id.spec.ts` (27): `pathOf` (query, `#`, ambos); ids aceitos e rejeitados; middleware (header, `req.requestId`, contexto com `method`/`path`/`startedAt`); `<script>` não ecoado nem logado; uma linha de acesso sem query string; nível por status; linha de acesso com `pgCode`/`table`/`column` de erro do banco; `aborted`; erro do logger não derruba a resposta.
  - `app-logger.spec.ts` (11): `levelsFrom`; JSON com identidade e params na raiz; só identidade em toda linha (sem `method`/`route`/`handler`); erro em stderr; via `new Logger(ctx)`; redação (inclui variantes do projeto e prova do casamento exato); nível desabilitado; modo texto com `requestId` e com o stack em bloco.
  - `request-context.spec.ts` (3), `validation-details.spec.ts` (3), `app.exception.spec.ts` (2), `openapi.spec.ts` (4), `tenant.guard.spec.ts` (4), `env.spec.ts` (+4).
  - `error-codes.usage.spec.ts` (5): todo literal `XXX-NNN` existe no catálogo; cada código de domínio em exatamente um `new AppException(`; nenhuma outra exceção instanciada em `src` (regex `new (?!AppException\b)\w*Exception\(`); um teste confere a própria regex.
- e2e: 86 no total. `test/errors.e2e-spec.ts` (26):
  - **`X-Request-Id`:** gerado, ecoado, trocado quando inválido, presente no 304; `<script>` não ecoado nem logado;
  - **formato de erro:**
    - `GEN-404`, inclusive com `?cpf=...&email=...` (log sem CPF nem e-mail);
    - `GEN-400` em `/cities/abc` e em JSON malformado;
    - `GEN-413`; **`GEN-415`** com `Content-Type: application/json; charset=latin1` (body-parser real, `reason: 'unsupported charset "LATIN1"'`);
    - `VAL-001` no body e no `ZodValidationPipe`; `TEN-001`; `DB-001` simulado;
    - `DB-007` simulado com spy (`QueryFailedError` 22001): 400, linha `warn` "Violação no banco" e linha de acesso com `pgCode`, sem linha `error`. Não há mais caminho real até ele porque o Zod tem os limites das colunas;
    - **unique real do Postgres**, sem mock no banco: só o primeiro `EntityManager.exists` (a checagem de documento da aplicação) foi desligado para simular o bug "a aplicação não checou", e o `INSERT` bate na constraint de verdade. Resultado:
      - 409 `DB-001`;
      - linha `warn` com `pgCode: '23505'`, `table: 'tenants'`, `constraint`, `method`, `path`, `route: '/tenants'`, `handler: 'TenantsController.signup'`, `query` (`INSERT INTO "tenants"...`), `error.severity`/`schema`/stack e `app`;
      - linha de acesso com `pgCode`/`table`/`constraint`;
      - o CNPJ (que está no `detail` do Postgres) não aparece em nenhuma linha;
  - **limites de texto e Postgres de verdade, sem mock:**
    - e-mail com 256 e com 300 caracteres: 400 `VAL-001` com `details.issues[].path` = `['owner.email']`, sem o e-mail na resposta nem no log;
    - e-mail com exatamente 255 caracteres: 201, gravado inteiro (cabe na coluna);
    - nome com `\u0000`: 400 `DB-013` (22021 real do Postgres), com linha `warn` (`pgCode`, `route`, `handler`, `query`, stack) e linha de acesso com `pgCode`;
  - **500 simulado com `cause`:** a linha `error` tem `requestId`, `method`, `path`, `route: '/cities/:id'`, `handler: 'CitiesController.findOne'`, `durationMs`, `code`, `status`, `error.stack`, `error.cause` (com stack) e `app`; sem o CPF da query;
  - **503:** Postgres fora (`08006`) responde 503 `DB-012`, com `pgCode`/`query`/`handler` no log e sem CPF; conexão perdida no driver (sem SQLSTATE) responde 503 `DB-012`;
  - **log de acesso:** sucesso; `USR-003` com `code`/`tenantId`.
- e2e existentes: asserções de erro com `expectError` em tenants, users, roles e geo (todo código de domínio tem ao menos um teste); `ROL-006` com `details.permissions`; caso `USR-001`.

## Como validar

```bash
docker compose --env-file apps/api/.env up -d
pnpm --filter @at-field/dto build
pnpm lint
pnpm --filter @at-field/dto test
pnpm --filter api test
pnpm --filter api test:e2e
```

Manual: `LOG_FORMAT=json pnpm --filter api dev`, depois `curl -i http://localhost:4310/nao-existe -H "X-Request-Id: teste-manual-01"` → 404 `{"code":"GEN-404",...,"requestId":"teste-manual-01"}` e uma linha `warn` com o mesmo `requestId` no terminal. O catálogo aparece na descrição do Scalar em `/api`, e `/api-json` tem `components.schemas.ErrorResponse` e respostas `4XX`/`5XX` em toda operação.

Falha no bootstrap (banco fora do ar): o TypeORM tenta reconectar por cerca de 30 s, o Nest despeja os logs do buffer e o erro e o processo sai com código 1 (conferido com `DATABASE_PORT=1`). Nessa fase o `AppLogger` ainda não existe (ele depende da injeção de dependências), então essas linhas saem no formato texto padrão do Nest, não em JSON. Falhas depois do `create` (ex.: porta em uso no `listen`) passam pelo `bootstrap().catch`, com `errorLogFields`.

## Pendências

- **Destino e retenção dos logs em produção:** decidir no passo de deploy. Opções levantadas: stdout do Docker com rotação (`json-file` com `max-size`/`max-file`); Grafana Loki self-hosted; faixa gratuita de um SaaS de logs (atrás do `AppLogger`).
- **CORS:** quando o web consumir a API, configurar `exposedHeaders: ['X-Request-Id']` para o navegador conseguir ler a referência.
- **Web e mobile:** ainda não consomem a API; quando consumirem, exibir os erros conforme COM-06 usando `formatErrorReference`.
- **Firebase Auth:** prefixos `AUT` e `PRM`, `GEN-401` e `userId` no contexto de log.
- **Rate limit (deploy):** usar `GEN-429`, já no catálogo.
- Passos 004 e 007 citam o `PgErrorFilter`, que deixou de existir; ficam como registro histórico.
