# 007 — Base IBGE de estados e cidades

Carrega na API a base oficial de **27 UFs e 5.571 municípios** do IBGE (retrato de 24/10/2026, versão `2026-10`) e expõe rotas públicas de leitura e busca. Regra de negócio: **COM-05** (`docs/regras/comum.md`).

## Objetivo

- `users.cityId` passa a apontar para cidades reais (antes a tabela estava vazia e os testes inseriam uma cidade à mão).
- Base pronta para o app do técnico: busca por nome sem acento, lista por UF e um pacote completo (`GET /cities/all`) para guardar offline e, no futuro, alimentar a identificação de cidades no texto do WhatsApp (TEC-02f). O mobile continua com o mock neste passo.

## O que mudou

### `@at-field/dto`

- `geo.ts`: `ufSchema` (trim + maiúscula + `^[A-Z]{2}$`; a existência é conferida no banco, sem lista de UFs duplicada), `citySearchSchema` (`q` 2..60 com trim, `uf` opcional, `limit` 1..50 com coerção, padrão 20) e os tipos `StateView`, `CityView`, `CitiesBundleView`.

### API

| Método | Rota | Resposta |
| --- | --- | --- |
| `GET` | `/states` | `StateView[]` (27), ordenado pelo nome sem acento ("Acre" primeiro) |
| `GET` | `/states/:uf/cities` | `CityView[]` de toda a UF (aceita minúscula), sem paginação; 400 formato inválido; 404 UF inexistente |
| `GET` | `/cities?q=&uf=&limit=` | `CityView[]`: exato > começa com > contém, desempate por nome e UF; 400 parâmetro inválido |
| `GET` | `/cities/all` | `CitiesBundleView` = `{ version, states: [id, uf, nome][], cities: [id, stateId, nome][] }`, com `ETag: "ibge-2026-10"`; `If-None-Match` igual → 304 sem corpo |
| `GET` | `/cities/:id` | `CityView`; 400 não numérico; 404 inexistente (inclui negativos e valores fora de `int`) |

Todas são **públicas** (sem `X-Tenant-Id` e, no futuro, sem login). Nenhuma expõe dado de conta. `/cities/all` é declarada antes de `/cities/:id`.

**Cache:** só as respostas de sucesso (2xx e o 304 de `/cities/all`) levam `Cache-Control: public, max-age=86400`. Erros (400, 404 e 500, inclusive o do `PgErrorFilter` com o Postgres fora do ar) saem com `Cache-Control: no-store`, para um proxy/CDN não guardar um erro por 24 h. Quem faz isso é o `GeoCacheInterceptor` (`src/geo/geo-cache.interceptor.ts`), aplicado nos dois controllers: grava `no-store` antes do handler e troca para o público quando o handler termina sem erro (pipes rodam depois dos interceptors, então erro de validação também fica `no-store`). `/cities/all` usa `@Res()` e define o header público ela mesma, no 200 e no 304; o interceptor não mexe em resposta já enviada. (Na primeira versão do passo o `@Header` do Nest punha o cache público também nos erros; corrigido após a revisão.)

Arquivos:

- `src/geo/normalize-name.ts`: normalização própria da API (ver abaixo), usada no seed e na busca.
- `src/geo/ibge/data/localidades-2026-10.json`: retrato do IBGE (~185 KB, uma tupla por linha), gerado pelo script. Copiado para `dist/` pelo `nest-cli.json` (`assets`). Fica fora do Prettier (`.prettierignore` na raiz e em `apps/api`).
- `src/geo/ibge/snapshot.ts`: `loadIbgeSnapshot(arquivo)` lê e valida (Zod, tuplas) o retrato em `src` ou `dist`; a versão sai do nome do arquivo. `toCityRows` gera `searchName`. `CURRENT_IBGE_SNAPSHOT` aponta o retrato atual.
- `src/geo/ibge/seed.ts`: `seedIbge(runner, snapshot)` — upsert das UFs e de todas as cidades num único `INSERT ... SELECT * FROM unnest(...) ON CONFLICT (id) DO UPDATE`. **Nunca apaga** (`users.cityId` referencia `cities`).
- `src/database/migrations/1792854023438-SeedIbgeLocalidades.ts`: adiciona `cities."searchName"` (nulo) → índice em `cities("stateId")` → `seedIbge` com `localidades-2026-10.json` → `searchName = lower(name)` em linhas fora do IBGE (se houver) → `searchName NOT NULL`. O `down` remove índice e coluna e **mantém os dados**.
- `src/geo/entities/city.entity.ts`: `searchName` (`varchar(120)`, `select: false`) e `@Index()` em `stateId` (mesmo nome da migration; `migration:generate` não acusa diferença).
- `src/geo/geo.service.ts`, `geo-cache.interceptor.ts`, `states.controller.ts`, `cities.controller.ts`, `dto.ts`, `geo.module.ts` (registrado no `AppModule`).
- `scripts/gerar-localidades-ibge.mjs` + script `pnpm --filter api geo:snapshot [AAAA-MM] [--force]`.
- `.gitattributes` (raiz): `* text=auto eol=lf` e binários comuns marcados como `binary` (ver "Fim de linha" abaixo).
- `users/people.ts`: sem mudança (continua `existsBy(City)` → 400 "Cidade inexistente"; a FK é a segunda barreira, 23503 → 409).

### Normalização (`normalizeName`)

Nesta ordem: apóstrofos tipográficos (`’ ‘ ʼ`) viram `'`; NFD e remoção das marcas diacríticas (`\p{M}`), o que também tira a cedilha; minúsculas; trim e espaços repetidos viram um só. Apóstrofo e hífen ficam como o IBGE os traz: `Alta Floresta D'Oeste` → `alta floresta d'oeste`, `Embu-Guaçu` → `embu-guacu`. A troca do apóstrofo tipográfico não estava na spec: entrou porque o teclado do celular substitui `'` por `’` sozinho, e sem ela "D’Oeste" não acharia nada.

A busca normaliza `q`; se sobrar menos de 2 caracteres, devolve `[]`. Os curingas do `LIKE` (`\`, `%`, `_`) são escapados (`escapeLike`, `ESCAPE '\'`), então `q=%%` devolve `[]`.

**Mudar `normalizeName` exige migration.** `cities."searchName"` é gravado com essa função no seed; se a regra mudar, crie uma migration que recalcule `searchName` de todas as cidades (por exemplo, rodando `seedIbge` de novo com o retrato atual). Sem isso, a busca compara o termo normalizado pela regra nova com dados normalizados pela antiga. O aviso também está no comentário de `normalize-name.ts`.

### Ordenação

O Postgres do Docker (`postgres:16-alpine`, musl) compara texto por byte, e acentuados iriam para o fim. Listas de cidades ordenam por `searchName`, depois `name`; estados são ordenados em memória pelo nome normalizado.

### `/cities/all` direto da memória

O pacote é montado uma vez, na primeira chamada, a partir do arquivo `CURRENT_IBGE_SNAPSHOT`, sem consultar o banco. Consistência com o banco:

- o teste `snapshot.spec.ts` falha se `CURRENT_IBGE_SNAPSHOT` não for o arquivo usado pela **última** migration que chama `loadIbgeSnapshot`;
- o e2e confere que o pacote tem o mesmo número de UFs e cidades que o banco.

O ETag é forte e baseado só na versão (`"ibge-2026-10"`): o app guarda a base e pergunta com `If-None-Match`; enquanto a versão não mudar, recebe 304.

## Atualizar a base (manual)

Sem lembrete periódico; quando houver município novo ou renomeado:

1. `pnpm --filter api geo:snapshot` (ou `geo:snapshot 2027-01`): baixa do IBGE (timeout de 60 s por requisição), valida (27 UFs com sigla única, ≥ 5.570 cidades, id de 7 dígitos único, prefixo do id = UF, UF existente, nome 1..120) e grava `src/geo/ibge/data/localidades-AAAA-MM.json`. Se a validação falhar, sai com erro e não grava.
   - **A versão tem de ser nova.** Se o arquivo de destino já existir, o script recusa (exit 1, sem baixar nada). Nunca regere um arquivo usado por migration já aplicada: o banco não o recarrega (a migration não roda de novo) e o ETag de `/cities/all` continuaria o mesmo, então o app não baixaria a mudança. `--force` existe só para refazer um arquivo novo que ainda não foi commitado nem aplicado.
2. Confira o diff do JSON (uma linha por município).
3. Crie uma migration nova que só chame `seedIbge(queryRunner, loadIbgeSnapshot('localidades-AAAA-MM.json'))`. Não edite a migration antiga nem apague o arquivo antigo (a migration antiga ainda o lê em bancos novos).
4. Atualize `CURRENT_IBGE_SNAPSHOT` em `snapshot.ts` e os números fixos dos testes, se mudarem.

O upsert atualiza nomes e cria municípios novos; nenhum é apagado (município extinto continua na base).

## Fim de linha (LF)

O Git for Windows vem com `core.autocrlf=true`, que fazia o checkout gravar CRLF, enquanto o Prettier/ESLint exigem LF: depois de um checkout o `pnpm lint` quebrava com "Delete ␍", e depois de um `format` dezenas de arquivos apareciam como modificados sem diferença de conteúdo. O `.gitattributes` da raiz agora fixa `* text=auto eol=lf` (o atributo prevalece sobre o `autocrlf`), e imagens/fontes/PDF/ZIP são `binary`.

- O índice já estava todo em LF (`git ls-files --eol` não mostra nenhum `i/crlf`), então a regra não muda conteúdo de nenhum arquivo versionado.
- Os `M` falsos que já existiam numa cópia de trabalho somem quando o arquivo for adicionado (`git add`), porque o índice ainda guarda o tamanho da versão CRLF antiga e o Git trata tamanho diferente como modificação sem comparar o conteúdo. O blob resultante é idêntico ao do commit; `git add --renormalize .` faz isso de uma vez.
- Regra geral: arquivos de texto do repositório são LF.

## Decisões

Descartadas:

- **Chamar o IBGE em runtime ou dentro da migration**: depende de rede, e a API do IBGE oscila; o retrato no repo é reproduzível.
- **Guardar o JSON "nivelado" inteiro** (2,3 MB): só id, UF e nome interessam (~185 KB).
- **Dados como `.ts`**: o compilador e o lint pesariam sem ganho; JSON validado por Zod basta.
- **Seed em comando separado**: o banco ficaria sem cidades até alguém lembrar de rodar; migration garante a base em todo ambiente (inclusive o e2e).
- **Extensão `unaccent`** e **`pg_trgm`**: coluna `searchName` normalizada no seed resolve a busca sem extensão; o volume (5.571 linhas) não pede índice trigram.
- **Paginação por UF**: a maior UF (MG) tem 853 cidades; cabe numa resposta.
- **`X-Tenant-Id` nas rotas geo**: base global de referência, sem `tenantId`.
- **Lista de UFs duplicada no dto**: o banco é a fonte; o schema só valida o formato.
- **Depender do `@at-field/core`**: decisão do usuário — a busca de cidades não fica acoplada ao parser do WhatsApp, que pode virar um agente de IA. A API tem a própria normalização.

## Testes

- `packages/dto/src/geo.spec.ts` (8): `ufSchema` normaliza e rejeita `P1`, `PRR`, vazio; `citySearchSchema` trim, mínimo 2, máximo 60, coerção e padrão de `limit`, limites 1..50, UF inválida.
- API unitários (novos 25):
  - `normalize-name.spec.ts` (6): acentos, cedilha, caixa, espaços, apóstrofo reto/tipográfico, hífen, vazio, idempotência;
  - `ibge/snapshot.spec.ts` (12): sobre o arquivo commitado — 27 UFs com sigla única, 5.571 ids únicos de 7 dígitos, prefixo = UF existente, nomes 1..120, sem nome normalizado repetido na mesma UF, cidades de referência (5300108, 4127700, 3169109, 3510005, 5101837), arquivo = última migration; `loadIbgeSnapshot` lê válido e rejeita malformado e nome fora do padrão; `toCityRows`;
  - `geo.service.spec.ts` (4): `escapeLike` e `matchesEtag` (igual, fraco, lista, `*`, diferente, ausente);
  - `geo-cache.interceptor.spec.ts` (3): sucesso → cache público; erro → `no-store`; resposta já enviada (rota com `@Res()`) não é alterada.
- API e2e `test/geo.e2e-spec.ts` (25), com a base da migration (não truncada):
  - `/states` sem header: 27, "Acre" primeiro, DF = 53, acentuados no lugar, Cache-Control; continua 27 após `resetDatabase`;
  - `/states/pr/cities` 399 com Toledo; SP 645 ordenada sem acento; DF só Brasília; `XX` 404, `P1`/`PRR` 400;
  - busca: "candido mota"/"CÂNDIDO MOTA" → Cândido Mota/SP primeiro; "CÂNDIDO" com prefixos antes de "contém"; "toledo" → Toledo/MG e Toledo/PR primeiro, Pedro de Toledo/SP depois; `uf=pr`; apóstrofo tipográfico; `limit`; `%%`, `__`, `\\` → `[]`; inválidos → 400; Cache-Control;
  - `/cities/5300108`, 404 para 9999999/-1/99999999999, 400 para `abc`;
  - `/cities/all`: 27/5.571, ETag, Cache-Control, contagens iguais ao banco, 304 com `If-None-Match` igual, 200 com versão diferente; 304 também com cache público;
  - erros sem cache público: 404 (`/cities/9999999`, `/states/XX/cities`) e 400 (`/cities/abc`, `/states/P1/cities`, `/cities?q=a`) com `no-store`; 500 simulado (`QueryFailedError` no `GeoService`, tratado pelo `PgErrorFilter`) com `no-store`;
  - seed rodado de novo: contagens iguais e nome alterado à mão volta a "Toledo".
- `tenants.e2e-spec.ts` e `users.e2e-spec.ts`: auto-cadastro grava `cityId` 4127700; usuário com cidade real → 201; 9999999, 0, -1, 1,5 e string → 400. `test/utils.ts`: `resetDatabase` não trunca mais `states`/`cities`; `seedCity` saiu e entrou a constante `CITY_TOLEDO_PR`.
- O script `.mjs` não tem teste automatizado (depende de rede); as validações dele são repetidas pelo `snapshot.spec.ts` sobre o arquivo gerado. Conferido à mão: recusa arquivo existente (exit 1), argumentos inválidos (exit 1), `--force` regera o mesmo arquivo com md5 idêntico.

## Como validar

```bash
docker compose --env-file apps/api/.env up -d
pnpm --filter api migration:run
pnpm --filter @at-field/dto test
pnpm --filter api test
pnpm --filter api test:e2e
pnpm lint
curl http://localhost:4310/cities?q=toledo
curl -i -H 'If-None-Match: "ibge-2026-10"' http://localhost:4310/cities/all   # 304
```

Observação: o CLI do TypeORM loga as queries da migration, então o `migration:run` desta migration imprime os ~5.571 parâmetros do seed. É só log.

## Pendências

- **Limite de taxa** nas rotas públicas (principalmente `/cities` e `/cities/all`): fica para o passo de deploy.
- Compressão (gzip/brotli) da resposta de `/cities/all` (~170 KB sem compressão): no proxy reverso, no deploy.
- Mobile ainda usa o mock de cidades; trocar pela API e guardar `/cities/all` offline quando o app tiver persistência.
