# Passo 009 — Autenticação Firebase e permissões

Data: 2026-11-02. Dividido em três entregas, com PRs separados:

| Parte | Conteúdo | Estado |
| --- | --- | --- |
| **009a** | Firebase Auth na API: Bearer obrigatório, vínculo da pessoa com a conta de acesso, `GET /me`, vínculo ativo para operar uma conta, códigos `AUT-*` | **feito (este documento)** |
| 009b | RBAC: `@RequirePermissions`, `PermissionsGuard`, `syncSystemRoles`, códigos `PRM-*` | planejado |
| 009c | Aceite de convite pelo app | planejado |

> **Atenção: não expor em produção antes do 009b.** No 009a, qualquer membro com vínculo **ativo** opera tudo na própria conta (usuários, papéis, dados da conta): as permissões dos papéis ainda não são conferidas.

## 009a — Autenticação Firebase na API

### Objetivo

Toda rota da API, salvo as públicas (base IBGE e `GET /`), passa a exigir o ID token do Firebase (`Authorization: Bearer <token>`). A pessoa (`users`) fica ligada à conta de acesso do Firebase (`users.firebaseUid`) no auto-cadastro ou no primeiro login, e só opera uma conta (`X-Tenant-Id`) em que tenha vínculo **ativo**. Regra **COM-07**.

### Decisões do usuário

1. **Divisão 009a / 009b / 009c** (acima). Até o 009b, vínculo ativo = acesso total à conta.
2. **E-mail verificado em tudo**: auto-cadastro, vínculo no primeiro login e **toda requisição autenticada**, inclusive de quem já está vinculado. Token sem `email_verified` → `AUT-007` "Confirme seu e-mail para continuar".
3. **Login só por e-mail** (e senha ou Google). Login por CPF fica fora por enquanto: **TEC-14 (ajudante com login por CPF ou e-mail) fica pendente por decisão**; o ajudante entra por e-mail.
4. **Convite (009c)**: a própria pessoa cria o acesso no app pelo SDK cliente do Firebase. A API não cria usuários no Firebase (sem `createUser`, sem service account). Nada disso foi implementado agora.
5. **`TEN-002`** muda só a mensagem: "Conta inexistente, inativa ou sem acesso" (mesmo código, mesmo 403).
6. **Login com Google** também será habilitado no console. A API não muda por isso: o token do Firebase é o mesmo, e o Google já vem com `email_verified: true`. Há teste com identidade Google.

### Biblioteca e custo

- **`firebase-admin` 14.5** (`engines: node >= 22`, CommonJS com `exports`): o SDK oficial; a verificação do ID token (assinatura RS256 com as chaves públicas do Google, `aud` = projeto, `iss`, `exp`, `sub`) não vale a pena reescrever. A API importa só `firebase-admin/app` e `firebase-admin/auth`, atrás do adapter `AuthProvider` (trocar de provedor = outra implementação). Usa apenas `verifyIdToken`, que não precisa de credencial (só do `projectId`).
- **`ignoredOptionalDependencies`** no `pnpm-workspace.yaml` (aceito pelo pnpm 10.17; o lockfile registra a lista): `@google-cloud/firestore` e `@google-cloud/storage`, opcionais do `firebase-admin` que a API não usa, não são instalados. A instalação acrescentou 46 pastas de pacote ao `node_modules` (1406 → 1452 entradas de primeiro nível/escopo), **cerca de 27 MB** (`firebase-admin` 2 MB, `@firebase/*` 12,7 MB, `google-auth-library` 1 MB, resto `jsonwebtoken`, `jwks-rsa`, `jose`, `gaxios` etc.). O tamanho total do `node_modules` não foi medido: o `du` no disco D: (com falha, ver `.local/README.md`) não terminou em 30 min.
- **Preço** (página oficial `firebase.google.com/pricing`, conferida em 2026-11-02): no plano gratuito **Spark**, Authentication sem custo até **50 mil usuários ativos por mês** (e-mail/senha e Google incluídos; SAML/OIDC até 50). **SMS/telefone não existe no Spark** e é cobrado por mensagem no Blaze: fica fora. Custo atual: zero.

### Contratos

Ordem dos guards: `RequestContextGuard` (global, só anota) → **`AuthGuard`** (global) → `TenantGuard` (controller). Sem token e sem `X-Tenant-Id` a resposta é `AUT-001`, não `TEN-001`.

| Rota | Exige |
| --- | --- |
| `GET /`, `GET /states`, `GET /states/:uf/cities`, `GET /cities`, `GET /cities/all`, `GET /cities/:id` | nada (`@Public()`) |
| `/api`, `/api-json` (Scalar/OpenAPI) | nada (middleware Express, fora dos guards) |
| `POST /tenants` | Bearer com e-mail verificado; aceita quem ainda não está no banco (`@AllowUnregistered()`) |
| `GET /me`, `GET /permissions` | Bearer; pessoa cadastrada; sem `X-Tenant-Id` |
| `/users*`, `/roles*`, `/tenants/current` | Bearer + `X-Tenant-Id` com vínculo **ativo** |

**`GET /me`** (200, tipo `MeResponse` do `@at-field/dto`): `{ id, name, email, phone, cityId, memberships: [{ tenant: { id, name, documentType }, status, role: { id, name } }] }`. Vínculos em todos os status (`invited`, `active`, `suspended`), em ordem de criação; contas excluídas (soft delete) ficam de fora. Sem `cpf` nem `firebaseUid`.

**`POST /tenants`** (corpo igual ao de antes, resposta 201 igual), em ordem:

1. `AuthGuard`: token válido; **e-mail não verificado → `AUT-007`** (antes de qualquer consulta); pessoa resolvida pelo uid ou vinculada pelo e-mail (ver abaixo); excluída/desativada → `AUT-006`.
2. Documento da conta já usado → `TEN-003` (**continua a primeira chamada a `EntityManager.exists`**: o e2e do 23505 em `test/errors.e2e-spec.ts` depende disso; comentário no código).
3. `owner.email` diferente do e-mail do token (comparação com `trim` e minúsculas) ou token sem e-mail → `AUT-009`.
4. uid já ligado a uma pessoa: se `owner.cpf` é dela, reaproveita (segunda conta); senão `AUT-010`.
5. uid não ligado e pessoa existente com o CPF: com outro `firebaseUid` → `AUT-010`; sem → vincula (UPDATE atômico `WHERE "firebaseUid" IS NULL`; o e-mail igual já foi garantido pelo `USR-002`).
6. Pessoa nova → criada já com o `firebaseUid`.

**Vínculo no primeiro login** (`AuthService.resolveUser`, chamado pelo `AuthGuard` em toda requisição autenticada):

1. Busca por `firebaseUid` (inclusive excluídos).
2. Não achou e o token tem e-mail verificado → `UPDATE users SET "firebaseUid" = $uid WHERE email = $email AND "firebaseUid" IS NULL AND "deletedAt" IS NULL RETURNING id` (atômico; log `log` "Conta de acesso vinculada no primeiro login" com o `userId`).
3. 0 linhas → relê pelo uid (corrida de duas requisições do mesmo uid: uma vincula, as duas seguem 200). Ainda nada: pessoa excluída com aquele e-mail → `AUT-006`; senão "não cadastrada" (`AUT-005`, ou segue sem pessoa em `@AllowUnregistered()`).
4. Pessoa excluída ou `isActive = false` → `AUT-006` (também o `auth/user-disabled` do Firebase).

**`TenantGuard`**: uma consulta (vínculo + conta + papel, `membership.userId = pessoa AND tenantId = header`). Conta inexistente, inativa, excluída, sem vínculo, vínculo `invited` ou `suspended` → **um único** `TEN-002` (403), com resposta idêntica: conta alheia é indistinguível de conta inexistente. Grava `request.tenant`, `request.membership` e o `tenantId` no contexto de log.

**Desativar a pessoa ou suspender o vínculo vale na hora**: o guard consulta o banco a cada requisição. O token do Firebase vive 1 h; `AUTH_CHECK_REVOKED` (padrão `false`) liga a checagem de revogação no Firebase a cada requisição (custo e latência; exige service account).

### Códigos de erro (`AUT`)

| Código | HTTP | Mensagem | Origem |
| --- | --- | --- | --- |
| AUT-001 | 401 | Token de acesso ausente | `auth.service.ts` (sem header, não-Bearer, token com espaço, header duplicado) |
| AUT-002 | 401 | Token de acesso inválido | provedor `invalid` (assinatura, outro projeto, malformado) |
| AUT-003 | 401 | Sessão expirada. Entre novamente. | provedor `expired` |
| AUT-004 | 401 | Sessão revogada. Entre novamente. | provedor `revoked` (só com `AUTH_CHECK_REVOKED`) |
| AUT-005 | 403 | Usuário não cadastrado | `auth.guard.ts` |
| AUT-006 | 403 | Usuário desativado | `identity-link.ts` (`userDisabled`, usado por `resolveUser` e pelo `disabled` do provedor) |
| AUT-007 | 403 | Confirme seu e-mail para continuar | `identity-link.ts` (`assertEmailVerified`) |
| AUT-008 | 503 | Serviço de autenticação indisponível. Tente novamente em instantes. | provedor `unavailable`; log `error` com `errorLogFields(err, { provider: 'firebase' })` |
| AUT-009 | 403 | E-mail diferente do da conta de acesso | `identity-link.ts` (`assertSignupIdentity`) |
| AUT-010 | 409 | Conta de acesso já vinculada a outro usuário | `identity-link.ts` (`accessLinkedToAnother`, usado por `resolvePerson` e `linkFirebaseUid`) |
| TEN-002 | 403 | Conta inexistente, inativa ou sem acesso (mensagem nova) | `common/tenant.guard.ts` |

Cada código tem um único `new AppException(...)` em `src` (exigência do `error-codes.usage.spec.ts`); onde o mesmo erro sai de dois lugares, há uma fábrica (`userDisabled`, `accessLinkedToAnother`). `PRM` fica reservado (comentário em `errors.ts`) para o 009b.

### Mapeamento dos erros do `firebase-admin`

Conferido no código do 14.5 (`lib/auth/token-verifier.js`, `lib/utils/jwt.js`, `lib/utils/api-request.js`, `lib/auth/error.js`):

| Código do SDK | Tipo | Resposta |
| --- | --- | --- |
| `auth/id-token-expired` | expired | AUT-003 |
| `auth/id-token-revoked` | revoked | AUT-004 |
| `auth/user-disabled` | disabled | AUT-006 |
| `auth/argument-error`, `auth/invalid-id-token`, `auth/invalid-argument`, `auth/user-not-found`, `auth/tenant-id-mismatch` | invalid | AUT-002 |
| `app/*` (rede, timeout, credencial), `auth/internal-error`, `auth/invalid-credential`, sem código, desconhecido | unavailable | AUT-008 |

**Armadilha encontrada:** falha ao baixar as chaves públicas do Google (rede fora ou resposta de erro) chega como `auth/argument-error`, o mesmo código de token malformado, porque o `token-verifier.js` descarta o `JwtError` original (`KEY_FETCH_ERROR`) e guarda só a mensagem. Sem tratamento, o Google fora do ar viraria 401 e o app mandaria o usuário logar de novo. O adapter reconhece essas mensagens (`Error fetching public keys`, `Error fetching Json Web Keys`, `Error while making request`) e as trata como `unavailable` (503). Como depende de texto interno do SDK, `FIREBASE_ADMIN_VERIFIED_FOR = '14.5'` e um teste falham quando o major.minor instalado muda (mesmo esquema do `PG_MESSAGES_VERIFIED_FOR`, ver passo 005).

**`iat` no futuro não é recusado pelo SDK** (a spec supunha que sim): nem o `token-verifier` nem o `jsonwebtoken` conferem `iat`; só `exp`. Um teste registra isso. Não há tolerância própria de relógio na API: o servidor precisa de **NTP** (relógio adiantado faria tokens válidos parecerem expirados; atrasado aceitaria tokens expirados por mais tempo).

### Logs

- `userId` (uuid interno de `users`, nunca o `firebaseUid`) entra no contexto pelo `AuthGuard` e sai em toda linha, inclusive na de acesso.
- Nunca vão para o log: token, `firebaseUid`, e-mail, a mensagem do erro do provedor nos 401. Na linha de acesso dos `AUT-00x` vai só `reason` = código do SDK (ex.: `auth/id-token-expired`), por `AppException(..., { logReason })`, que nunca vai para a resposta.
- `DEFAULT_REDACT_KEYS` ganhou `bearer`, `credential`, `private_key`, `client_email` (`firebaseuid`, `token`, `idtoken`, `authorization` já estavam).

### OpenAPI

`addBearerAuth()` + `addSecurityRequirements('bearer')` no `DocumentBuilder`; `@Public()` marca a operação com a extensão `x-public`, e `applySecurity(document)` troca por `security: []` e remove a extensão. A descrição do Scalar ganhou a seção "Autenticação". CORS segue fora deste passo.

### Configuração

| Variável | Regra |
| --- | --- |
| `FIREBASE_PROJECT_ID` | obrigatória, `^[a-z0-9-]{4,30}$` |
| `GOOGLE_APPLICATION_CREDENTIALS` | opcional (caminho do JSON da service account, lido por `applicationDefault()`); obrigatória com `AUTH_CHECK_REVOKED=true` |
| `AUTH_CHECK_REVOKED` | `z.stringbool()`, padrão `false` |
| `FIREBASE_AUTH_EMULATOR_HOST` | opcional, **só host loopback** (`localhost`, `127.0.0.1` ou `[::1]`, com porta opcional; IPv6 só com colchetes, porque o SDK monta `http://${host}/...` e `http://::1/...` é URL inválida) e **proibida com `NODE_ENV=production`** (mesmo em loopback): com ela o SDK aceita token **sem assinatura**. A regra do loopback não depende de `NODE_ENV` (cujo padrão é `development`): um deploy que esqueça o `NODE_ENV` e aponte a variável para um host remoto também não sobe. O SDK lê `process.env` direto, e a validação olha a mesma variável; a factory do provider (`createAuthProvider`, em `auth.module.ts`) confere de novo (`isLoopbackEmulatorHost`) |

- O CLI de migrations (`data-source.ts`) valida só as variáveis do banco (`validateDatabaseEnv`), para não depender do Firebase; `buildDataSourceOptions` recebe `DatabaseEnv` (só os campos do banco), e o `app.module.ts` não repete mais o `Env` inteiro.
- Dev: projeto Firebase real no plano Spark (Project ID no `apps/api/.env`, anotado em `.local/README.md`), ou o Auth Emulator só com `FIREBASE_AUTH_EMULATOR_HOST`, nunca em produção. Não há provider falso ligável por variável de ambiente.
- e2e offline: `test/setup-env.ts` força `FIREBASE_PROJECT_ID=at-field-test` (sobrescreve o do `.env`), `AUTH_CHECK_REVOKED=false` e apaga `FIREBASE_AUTH_EMULATOR_HOST`/`GOOGLE_APPLICATION_CREDENTIALS`. O `AUTH_PROVIDER` é trocado pelo `FakeAuthProvider` (`test/fake-auth.provider.ts`, fora de `src`).

### O que mudou

`packages/dto/src`:
- `errors.ts`: prefixo `AUT`, `AUT-001..010`, mensagem nova do `TEN-002`; `errors.spec.ts`: entradas no `PUBLISHED` e regex com `AUT`.
- `auth.ts` (novo): `MeResponse`, `MeMembershipView`; exportado no `index.ts`.

`apps/api/src/auth/` (novo módulo):
- `auth-provider.ts`: `AUTH_PROVIDER`, `VerifiedIdentity` (`uid`, `email`, `emailVerified`, `signInProvider?`), `AuthProvider`, `AuthProviderError` (`kind`, `providerCode`).
- `firebase-auth.provider.ts`: app nomeado `at-field` (`initializeApp({ projectId, credential? }, 'at-field')`), `getAuth(app)`, `verifyIdToken(token, checkRevoked)`, `toAuthProviderError`, `deleteApp` no `onModuleDestroy`; credencial só carregada com `checkRevoked`.
- `auth.service.ts`: `extractBearer`, `authenticate`, `assertEmailVerified`, `resolveUser` (vínculo pelo e-mail).
- `identity-link.ts`: `normalizeEmail`, `assertEmailVerified`, `assertSignupIdentity`, `linkFirebaseUid`, fábricas `userDisabled` e `accessLinkedToAnother`. (A spec punha `assertSignupIdentity`/`linkFirebaseUid` no `AuthService`; ficaram em funções puras para `people.ts` e `tenants.service.ts` usarem sem injetar o service.)
- `auth.guard.ts`, `auth.types.ts` (`AuthRequest`), `public.decorator.ts`, `allow-unregistered.decorator.ts`, `current-user.decorator.ts` (`@CurrentUser()`, `@CurrentIdentity()`), `me.controller.ts` + `auth-me.service.ts`, `auth.module.ts`.

Alterações:
- `app.module.ts`: `AuthModule`; `APP_GUARD` `AuthGuard` depois do `RequestContextGuard`.
- `common/tenant.guard.ts`: vínculo ativo, `request.membership`.
- `common/errors/app.exception.ts` (`logReason`), `all-exceptions.filter.ts` (usa como `reason`), `openapi.ts` (`applySecurity`), `main.ts`.
- `common/logging/request-context.ts` (`setUserId`), `app-logger.ts` (redact).
- `config/env.ts`, `database/typeorm.config.ts`, `database/data-source.ts`.
- `tenants/tenants.controller.ts` (`@AllowUnregistered()`, `@CurrentIdentity()`), `tenants.service.ts` (`signup(input, identity)`).
- `users/people.ts`: `resolvePerson(manager, person, identity?)`.
- `geo/*.controller.ts`, `app.controller.ts`: `@Public()`. `roles/permissions.controller.ts`: comentário (só autenticado).
- `pnpm-workspace.yaml` (`ignoredOptionalDependencies`), `apps/api/package.json` (`firebase-admin`), `.env.example`.

### Decisões e desvios da spec

- **`AUT-007` antes de qualquer consulta, no `AuthGuard`**, para toda rota autenticada (inclusive quem já está vinculado e o auto-cadastro). Motivos: decisão 2 do usuário; e evitar enumeração: sem isso, qualquer pessoa criaria uma conta no Firebase com o e-mail de outra (sem verificar) e saberia se ela está no AT-Field pela diferença entre `AUT-007` e `AUT-005`. Consequência: no `POST /tenants`, um token não verificado recebe `AUT-007` **antes** do `TEN-003` (a spec listava o documento primeiro). Para tokens verificados a ordem da spec vale, e a checagem de documento continua a primeira chamada a `exists`.
- **E-mail do token já ligado a outra pessoa com outro uid** (ex.: conta recriada no Firebase): o guard não vincula e responde `AUT-005` em `/me`; no auto-cadastro, o CPF com outro uid dá `AUT-010`. Religar exige ação manual por enquanto (pendência).
- **Pessoa excluída (soft delete) com o e-mail do token e sem uid**: `AUT-006` em vez de `AUT-005` (a pessoa existe, está desativada).
- **`USR-003` não ocorre mais no auto-cadastro**: o e-mail do owner é o do token, e o token desse e-mail ou já está ligado à pessoa dona do e-mail, ou é ligado a ela no guard; com CPF diferente sai `AUT-010`. Continua no `POST /users`. O e2e de tenants foi ajustado; o de `USR-001` no auto-cadastro virou `AUT-006` (o guard barra antes) e ganhou um caso equivalente em `users.e2e-spec.ts` (`POST /users` com pessoa desativada).
- `AUT-005` é lançado no `auth.guard.ts` (a spec indicava `resolveUser`): o service devolve `null` e só o guard sabe se a rota aceita não cadastrados.
- O app do Firebase tem nome fixo `at-field`, como na spec; os testes unitários fecham o app (`onModuleDestroy`) entre um e outro.
- **`AUT-008`: a mensagem de infraestrutura vai para o log de erro de propósito.** O `errorLogFields` leva o `AuthProviderError` com a `cause` do SDK (ex.: `Error while making request: getaddrinfo ENOTFOUND www.googleapis.com`, `code`, stack): é o máximo de informação para depurar uma queda do Google ou da rede, e essas mensagens não têm dado pessoal (nem token, nem uid, nem e-mail). Se `AUTH_CHECK_REVOKED` for ligado, revisar: aí o SDK passa a chamar a API de usuários do Firebase, e as mensagens de erro dessa chamada precisam ser conferidas antes.
- **`POST /tenants`: o vínculo pelo e-mail feito no `AuthGuard` fica gravado mesmo se o cadastro falhar depois** (ex.: `TEN-003`, `AUT-010`, validação). É o mesmo efeito do primeiro login com e-mail verificado em qualquer rota (o e-mail foi comprovado pelo Firebase), então foi aceito; o guard não roda dentro da transação do cadastro.
- **UPDATE de 0 linhas por requisição**: um token verificado de quem não está no banco (ex.: alguém que criou acesso mas ainda não fez o cadastro) dispara, a cada requisição, um `UPDATE ... WHERE email = $1 AND "firebaseUid" IS NULL` que não acha linha (usa o índice único de `email`), mais a releitura pelo uid. Custo baixo; aceito.

### Testes

Totais ao fim do 009a: `@at-field/dto` 52 testes (5 arquivos); API unitários **328** (23 arquivos, 5 novos); API e2e **125** (7 arquivos, 1 novo). Unitários:
- `firebase-auth.provider.spec.ts`: versão instalada = `FIREBASE_ADMIN_VERIFIED_FOR`; mapeamento código → tipo (14 códigos); falha ao baixar chaves → `unavailable`; erro sem código; identidade decodificada (Google, sem e-mail); `checkRevoked` repassado; **contrato offline com o SDK real** em modo emulador (`FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9` só no teste, restaurado depois): `aud`/`iss` de outro projeto → `invalid`, `exp` passado → `expired`, texto que não é JWT → `invalid`, `iat` no futuro passa e a rede fora → `unavailable`.
- `auth.service.spec.ts`: `extractBearer` (minúsculo, vários espaços, espaços nas pontas; vazio, `Basic`, token com espaço, array, número); `authenticate` (AUT-001 sem chamar o provedor; cada tipo → código e `logReason`; log `error` só no indisponível, com `errorLogFields` e sem token; erro que não é do provedor segue para o filtro); `assertEmailVerified`; `resolveUser` (por uid, desativado/excluído, vínculo pelo e-mail normalizado, corrida com UPDATE 0 linhas + releitura, não cadastrado, excluído pelo e-mail, sem e-mail ou não verificado não vincula).
- `auth.guard.spec.ts`: `@Public()`, fora de HTTP, sucesso com `request.auth` e `userId` no contexto, erro do token antes do banco, AUT-007 antes do banco, AUT-005, `@AllowUnregistered()` com e sem pessoa.
- `auth.module.spec.ts` (`createAuthProvider`, segunda barreira lendo o `process.env`, restaurado no `afterEach`): emulador em production (mesmo loopback) lança; host remoto em development lança; loopback em development cria o provider; sem emulador cria (inclusive em production).
- `identity-link.spec.ts`: `normalizeEmail`, `assertSignupIdentity` (caixa/espaços, AUT-007 antes de comparar, AUT-009), `linkFirebaseUid` (mesmo uid, outro uid, UPDATE atômico, corrida com mesmo e com outro uid).
- `tenant.guard.spec.ts` (reescrito): TEN-001 sem banco; uma consulta com vínculo, conta e papel; TEN-002 idêntico para inexistente, inativa, excluída, convidado, suspenso; sem pessoa; grava conta, vínculo e `tenantId`.
- `env.spec.ts`: padrões do Firebase; `FIREBASE_PROJECT_ID` obrigatório e formato; emulador proibido em production (qualquer host, inclusive loopback); fora de production só loopback (`localhost`, `127.0.0.1`, `[::1]`, com ou sem porta); host remoto rejeitado mesmo sem `NODE_ENV` (`10.0.0.5`, `0.0.0.0`, `localhost.evil.com`, `127.0.0.2`, com esquema `http://`, porta não numérica, IPv6 sem colchetes `::1` e `::1:9099`); `isLoopbackEmulatorHost`; `AUTH_CHECK_REVOKED` sem credencial; `stringbool`; `validateDatabaseEnv` sem Firebase.
- `openapi.spec.ts` (`applySecurity`), `app.exception.spec.ts` e `all-exceptions.filter.spec.ts` (`logReason` → `reason` só no acesso), `request-context.spec.ts` (`setUserId`), `app-logger.spec.ts` (redact novo), `errors.spec.ts` do dto (`PUBLISHED`), `error-codes.usage.spec.ts` (um throw por código, sem mudança).

e2e: `test/auth.e2e-spec.ts` (novo) com os cenários 1 a 15 da spec e mais: AUT-001 antes do TEN-001; `invalid`/desconhecido/`revoked`/`disabled`; Bearer minúsculo; OpenAPI (`security: []` nas públicas, Bearer global); `GET /permissions` sem conta; `/me` completo sem CPF/uid; conta excluída fora do `/me`; e-mail não verificado de quem não existe; já vinculado sem e-mail verificado → AUT-007 em toda rota; 5 primeiras requisições paralelas do mesmo uid; e-mail trocado no Firebase; e-mail do owner com caixa/espaços; token sem e-mail; CPF ligado a outro uid; convidado abre a própria conta; dois cadastros simultâneos do mesmo CPF; suspender vale na hora; log com `userId`/`tenantId` e sem token, uid ou e-mail. Os e2e existentes passaram a mandar Bearer (`test/utils.ts`: `fakeAuth`, `createTestApp` com `overrideProvider(AUTH_PROVIDER)`, `uidFor`, `identityFor`, `tokenFor`, `tokenOf`, `authHeader`, `asUser`, `signupBody`; `signup` manda o token e o devolve).

### Como validar

```bash
docker compose --env-file apps/api/.env up -d
pnpm install
pnpm --filter @at-field/dto build
pnpm lint
pnpm --filter @at-field/dto test
pnpm --filter api test
pnpm --filter api test:e2e
```

Manual (com o projeto Firebase configurado): `pnpm --filter api dev`; `curl -i http://localhost:4310/me` → 401 `AUT-001`; `curl http://localhost:4310/states` → 200. Com um ID token real (ex.: do app ou da REST API `accounts:signInWithPassword` com a Web API key): `curl -H "Authorization: Bearer <token>" http://localhost:4310/me`. Em `/api` (Scalar) há o botão de autenticação Bearer.

### Checklist de deploy

- Conferir **`NODE_ENV=production`** no ambiente da API.
- Conferir a **ausência de `FIREBASE_AUTH_EMULATOR_HOST`** (com ela o SDK aceita token sem assinatura; a API recusa subir em production ou com host fora de loopback, mas a conferência é do deploy).
- `FIREBASE_PROJECT_ID` do projeto de produção; servidor com relógio sincronizado por NTP.
- Só depois do 009b (permissões).

### Checklist do console do Firebase (usuário)

1. Projeto criado (plano Spark); Project ID só em `apps/api/.env` (`FIREBASE_PROJECT_ID`) e `.local/README.md`, nunca em arquivo versionado.
2. Authentication → Sign-in method: habilitar **E-mail/senha** e **Google** (definir o e-mail de suporte do projeto exigido pelo Google).
3. Authentication → Templates: revisar o e-mail de **verificação de endereço** (pt-BR); o app deve chamar `sendEmailVerification` após o cadastro, porque a API exige e-mail verificado.
4. Authentication → Settings → Authorized domains: manter `localhost`; incluir o domínio do painel web quando houver.
5. Settings → Usuários e acesso: proteção contra enumeração de e-mail ligada (padrão em projetos novos).
6. Registrar os apps (Web, Android, iOS) só quando web e mobile forem integrar o login (passo futuro).
7. Service account: **não criar agora** (só para `AUTH_CHECK_REVOKED=true` ou Admin SDK). Se criar, o JSON vai para `.local/credenciais/` e o caminho em `GOOGLE_APPLICATION_CREDENTIALS`.
8. Não habilitar login por telefone (SMS é pago e fora do plano Spark).

### Pendências do 009a

- **TEC-14** (login por CPF): pendente por decisão do usuário.
- `users.email` não acompanha a troca de e-mail no Firebase (busca é pelo uid). Sincronizar quando houver fluxo de troca de e-mail.
- Conta de acesso recriada no Firebase (uid novo, mesmo e-mail): religar exige ação manual (limpar `firebaseUid`).
- Web e mobile ainda não fazem login; quando fizerem, tratar `AUT-003`/`AUT-004` (renovar token/entrar de novo), `AUT-007` (tela "confirme seu e-mail") e `AUT-008` (tentar de novo).
- CORS (expor `X-Request-Id`, aceitar `Authorization`) no passo do web.

## 009b — RBAC (planejado)

`@RequirePermissions('módulo:ação')` + `PermissionsGuard` usando o papel do `request.membership` (já gravado pelo `TenantGuard` no 009a); `syncSystemRoles` para manter as permissões dos papéis de sistema; códigos `PRM-*`. As decisões em aberto (técnico com `tenants:read`, escalada de privilégio `PRM-002`) ficam para a spec do 009b. **Só depois dele a API pode ir para produção.**

## 009c — Aceite de convite (planejado)

O admin convida (`POST /users`, vínculo `invited`); a pessoa cria o acesso no app pelo SDK cliente do Firebase com o e-mail do convite, verifica o e-mail e, no primeiro `GET /me`, a API vincula o uid e lista o convite. O aceite passa o vínculo para `active`. Sem `createUser` na API e sem service account.
