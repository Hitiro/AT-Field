# 005 — Atualização geral para as últimas versões estáveis

Todo o monorepo foi para a última versão estável de cada dependência. As exceções são as versões que as próprias ferramentas ainda não suportam, listadas em **Exceções**.

## Versões

| Área | Antes | Depois |
| --- | --- | --- |
| NestJS (core, common, testing, platform-express, cli) | 11 | 12.2 |
| `@nestjs/config` / `@nestjs/typeorm` / `@nestjs/swagger` | 4 / 11 / 11 | 12 / 12 / 12 |
| TypeORM | 1.1 | 1.1 (já era a última) |
| TypeScript | 5.9 | 6.0.3 (fixado em `~6.0.3`) |
| Testes | Jest 30 | Vitest 5 (API e `@at-field/dto`) |
| Next.js / React | 15.5 / 19.1 | 16.4 / 19.3 |
| Expo / React Native | SDK 54 / 0.81 | SDK 58 / 0.88 |
| ESLint | 9 | 10 (API, web); 9.39 no mobile |
| Turborepo, Prettier, commitlint, eas-cli | 2.5, 3.6, 20, 16 | 2.11, 3.9, 21, 25 |
| Docs da API | nestjs-redoc | Scalar (`@scalar/nestjs-api-reference`) |

## Exceções (e por quê)

- **TypeScript 7** (última) não foi adotado. O Nest CLI 12 fixa `~6.0.2`, o typescript-eslint aceita `<6.1` e o TS 7 (reescrita nativa) ainda não expõe a API de compilador que essas ferramentas usam.
- **`@types/node` 22**, não 26: os tipos acompanham o Node instalado (22.20). Trocar o Node da máquina é decisão à parte.
- **ESLint 9.39 no mobile**: o `eslint-plugin-react` (usado pelo `eslint-config-expo`) ainda não suporta ESLint 10, nem na última versão (7.37.5).
- **React 19.3.0 no mobile** (web usa 19.3.1): versão homologada pela Expo SDK 58.
- **`nestjs-zod` 5.5.0** ainda não declara suporte ao Nest 12 (aviso de peer), mas funciona: toda a suíte passa.

## Mudanças além do número de versão

### API

- **Nest 12 é distribuído só como ESM.** A API continua compilando para **CommonJS** e carrega esses pacotes pelo `require(esm)` do Node (padrão a partir do 22.12). Assim os imports relativos seguem **sem `.js`** no final. Uma primeira versão migrou a API para ESM, que exige `.js` em todo import relativo, e foi revertida.
- Os pacotes ESM do Nest quebravam o Jest, que tem suporte fraco a ESM. Por isso a troca pelo **Vitest**, que é também o runner do template oficial do Nest 12.
- Entidades: relações tipadas com `Relation<>` do TypeORM, o padrão recomendado contra referências circulares.
- `lint` da API agora roda `tsc --noEmit` antes do ESLint. Erros de tipo nos testes passavam despercebidos porque o Vitest não checa tipos.
- Migrations: o CLI do TypeORM roda sobre o build (`dist`). `migration:run`, `migration:generate` e `migration:revert` compilam antes.
- `nestjs-redoc` estava abandonado desde 2022 (pedia Nest 8). Foi trocado pelo **Scalar** em `/api`, que mostra exemplos em cURL, fetch, PowerShell, Python etc. e tem cliente para testar as rotas. O OpenAPI fica em `/api-json`.

### Web

- ESLint na config flat nativa do Next 16 (`eslint-config-next/core-web-vitals` e `/typescript`), sem `FlatCompat`.
- Turbopack é o padrão no Next 16; a flag `--turbopack` saiu dos scripts.

### Mobile

- Substituído pelo **template oficial da SDK 58**. O app ainda era só o template, mais um exemplo com o `LoginDTO` que já não existia e quebrava a checagem de tipos. O código agora fica em `src/`, com abas do expo-router, React Compiler e rotas tipadas. Preservados: nome, slug, scheme, porta 4312, `@at-field/dto`, ESLint e saída web estática.
- `metro.config.js` removido: o Expo detecta o monorepo sozinho (o override antigo era apontado pelo `expo-doctor`).
- `expo-types.d.ts` versionado, para os tipos de `.css` funcionarem num clone novo (o `expo-env.d.ts` gerado é ignorado pelo Git).
- Dois ajustes no código do próprio template: conversão de tipo no `Pressable` das abas web e o hook `use-color-scheme.web.ts` reescrito com `useSyncExternalStore` (a regra do React Compiler proíbe `setState` em efeito).
- `lint` do mobile agora roda `tsc --noEmit` antes do `expo lint`.

### Raiz

- Removidos o pacote `@at-field/eslint-preset`, as configs Airbnb e os `.eslintrc.js` de API e web. Era config morta: o formato `.eslintrc` é ignorado desde o ESLint 9 e foi removido no 10, e cada app já tinha o seu `eslint.config`.
- `@at-field/dto`: `moduleResolution: nodenext` (o `node` foi descontinuado no TS 6).

## Testes

Nenhum teste novo de regra de negócio. Toda a suíte existente foi migrada e passa:

- `@at-field/dto`: 26 (Vitest)
- API unitários: 15 (Vitest)
- API e2e: 32 (Vitest, contra Postgres real)
- Web: lint e build; Mobile: tipos, lint, bundle web (`expo export`) e `expo-doctor` 20/20

O mobile e o web ainda não têm testes porque não têm código próprio. Os testes entram junto com o primeiro código de front.

## Como validar

```bash
pnpm install
pnpm build
pnpm lint
pnpm test
pnpm --filter api test:e2e
cd apps/mobile && npx expo-doctor
```

## Pendências

- Avaliar atualizar o Node da máquina (24 LTS ou 26) e então o `@types/node`.
- Voltar ao ESLint 10 no mobile quando o `eslint-plugin-react` suportar.
- Adotar TypeScript 7 quando Nest CLI, typescript-eslint e Vitest suportarem.
- Reinstalações com `nodeLinker: hoisted` às vezes deixam atalhos velhos em `node_modules/.bin` (erro "Cannot find module ... bin"). A solução é apagar os `node_modules` e rodar `pnpm install`.
