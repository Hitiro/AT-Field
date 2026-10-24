# 006 — Protótipo navegável do app mobile e pacote `@at-field/core`

## Objetivo

Trocar o template do Expo pelas telas do produto (foco no técnico, ver `docs/VISAO-PRODUTO.md`), com dados de exemplo em memória — sem API, sem login, sem persistência — para validar a experiência antes de construir o backend dos lançamentos. Toda a lógica de cálculo ficou num pacote novo, **`@at-field/core`**, puro e testado, que a API vai reutilizar.

Spec do arquiteto em seis partes (A original; B agenda e tempo; C ida e volta, percal e reputação; D formas de cobrança e cliente final; E tempo de espera; F improdutiva) + dois ajustes do coordenador durante o passo: categorias de despesa `estacionamento` e `hospedagem` (TEC-45) e a logo da AT Solutions.

## O que mudou

### `packages/core` (novo, `@at-field/core`)

Mesmo padrão do `packages/dto` (tsc → `dist/` CommonJS, `module: nodenext`, imports relativos sem extensão). **Sem dependências**; devDeps `typescript ~6.0.3`, `vitest ^5.0.5`, `@vitest/coverage-v8 ^5.0.5` (script `test:cov`). Dinheiro sempre em **centavos inteiros**; taxas em centavos/km sem arredondar; datas `YYYY-MM-DD`. Nenhuma função lê o relógio (`hoje` é parâmetro).

| Módulo | Conteúdo | Regras |
| --- | --- | --- |
| `texto.ts`, `dinheiro.ts`, `erros.ts` | `normalizar`, `formatarMoeda` (sem `Intl`), `formatarCentavosPorKm`, `parseValorBR`, `ErroCampo` | — |
| `veiculo.ts` | `calcularCustoPorKm` (combustível + manutenção por km ou por itens) | TEC-47 |
| `cobranca.ts` | formas `chamado`/`hora`/`diaria`/`pacote`, `novaCobranca`, `valorBaseDoServico` | TEC-27, TEC-21 |
| `empresas.ts` | `Negociacao` (tarifas, hora adicional, deslocamento média/exato, pedágio, política de improdutiva), `kmIdaParaPagamento`, `duracaoPrevista`, `avisosDaEmpresa` | TEC-20/20a/23a/26/29/72 |
| `lancamentos.ts` | tipos de serviço/despesa, `pendenciasDe`, `podeConfirmar`, `rascunhoDeDemanda` | TEC-02b, TEC-45 |
| `atendimento.ts` | `totalDoServico`, `tempoDoAtendimento` (previsto × real + espera), `sugerirAcrescimo` | TEC-25/26/28/48 |
| `agenda.ts` | intervalo semiaberto, `detectarConflitos`, `agendaDosProximosDias` | TEC-02e |
| `resumo.ts` | `resumoDoMes` (com improdutivas), `financeiro` | TEC-02a/c |
| `simulador.ts` | `validarCenario`, `simular` (ida e volta, percal, formas, espera, "se for improdutiva"), `compararCenarios` | TEC-48/49 |
| `reputacao.ts`, `cliente-final.ts` | motivos fechados, validação, resumo da rede (mínimo 5), histórico do cliente final | TEC-71 a 75 |
| `espera.ts`, `improdutiva.ts` | motivos, validação, valor e prejuízo da improdutiva | TEC-28, TEC-29 |
| `telefone.ts` | `normalizarTelefone`, `empresaPorTelefone` (aceita a falta do nono dígito) | TEC-70 |
| `whatsapp/*` | `parseDemandaWhatsApp`: prefixos iOS/Android, ruído, empresa (texto → telefone → remetente), cliente/código, local, cidade/UF sem acento e homônimos, motivo, ferramentas, sinais, data/hora relativas | EMP-11, TEC-02f |

### `apps/mobile`

- **Removido** o template: `src/app/explore.tsx`, componentes do template (`animated-icon*`, `app-tabs*`, `external-link`, `hint-row`, `web-badge`, `themed-*`, `ui/collapsible`), `src/global.css`, `scripts/reset-project.js` (e o script), imagens do template (`tabIcons/`, `expo-badge*`, `expo-logo`, `logo-glow`, `react-logo*`, `tutorial-web`) e `assets/expo.icon` (ícone do Expo para o Icon Composer).
- **Tema** (`src/constants/theme.ts`): tokens de papel do design system AT Solutions (claro/escuro), Saira + Inter, escalas de espaço e raio; `src/theme/theme-provider.tsx` (modo sistema/claro/escuro) e `useTheme()`.
- **UI** (`src/components/ui/`): `Screen`, `AppText`, `Card`, `Button` (um único `cta` vermelho por tela), `TextField`, `MoneyField` (dígitos = centavos), `NumberField`, `Chips`/`ChipsMulti`, `Segmented`, `Badge`, `Banner`, `Icon` (expo-symbols, nomes tipados), `StatRow`, `ListItem`, `SwitchRow`.
- **Estado** (`src/state/`): reducer puro (lançamentos, empresas, veículo) + `StoreProvider` semeado pelos mocks; `simulacao.ts` converte o formulário do simulador em `CenarioSimulacao`.
- **Mocks** (`src/mocks/`): empresas (Sozic, Sustento, Protege, Central Field Service, IK Solution, AmparoTécnico, AEF), rede, lançamentos relativos a hoje (serviços do mês, 2 a revisar, agenda, Protege com espera e improdutiva, AEF por hora e pacote, ZARA avaliada), cidades (Toledo PR/MG homônimo), rotas, veículo, os 3 exemplos de WhatsApp.
- **Rotas** (Stack, Home como hub): `/` (agenda, resumo, faixa "a revisar", 4 acessos, colar do WhatsApp, Empresas • Veículo), `/resumo`, `/lancar`, `/whatsapp`, `/pendencias`, `/lancamento/[id]`, `/financeiro`, `/simular` (A | B | Comparar), `/veiculo`, `/agenda`, `/empresas`, `/empresa/[id]`.
- `app.json`: nome `AT-Field`, ícones da marca, splash navy `#0B2545`. Restaurados `owner: "albertotsugawa"` e `extra.eas.projectId` (e `extra.router`), copiados de `git show HEAD:apps/mobile/app.json`: tinham se perdido na troca de template do passo 005.
- Dependências removidas por não terem mais uso: `expo-device`, `expo-web-browser`, `expo-image`, `expo-glass-effect` e `@expo/ui` (conferido com grep; `@expo/ui` é só peer opcional do expo-router; `expo-doctor` 20/20).
- Raiz: `.gitignore` ganhou `coverage/` e `*.tsbuildinfo`; `apps/api/tsconfig.build.tsbuildinfo` saiu do índice (`git rm --cached`).

### Logo (AT Solutions)

- Fonte: `D:\ATSolution\Logo Corel e SVG\Kit v2\` (fora do repo, não alterado). Copiados para `apps/mobile/assets/brand/`: `icone.svg` (`Icone.svg`), `icone-negativa-branca.svg`, `logo-sem-tags.svg`, `logo-sem-tags-negativa-branca.svg`.
- PNGs gerados com `sharp` (já no `node_modules` da raiz) por um script temporário fora do repo, rasterizando o SVG a 600 dpi e reduzindo:
  - `icon.png` 1024×1024: símbolo colorido (~680 px) sobre branco, sem transparência (também usado em `ios.icon`, no lugar do `assets/expo.icon`);
  - `android-icon-foreground.png` 1024×1024: símbolo dentro da zona segura (conteúdo 485×445), fundo transparente; `android-icon-background.png` branco (`adaptiveIcon.backgroundColor: #FFFFFF`, contraste com o símbolo navy/vermelho); `android-icon-monochrome.png`: silhueta da versão negativa;
  - `splash-icon.png` 512×512: símbolo branco (negativa) sobre o splash navy `#0B2545`;
  - `favicon.png`: cópia de `Icone 32px.png` do kit;
  - `logo-icone.png` / `logo-icone-branca.png` 96×96: símbolo na Home (32 px, colorido no claro, branco no escuro), via `<Image>` — sem `react-native-svg`.
- Seguindo o guia: `Icone.svg` para ícone/favicon e usos abaixo de 64 px; nada recriado com fonte.

### Documentação

`CLAUDE.md` e `docs/ARCHITECTURE.md` (pacote `core` e regra D1), `docs/regras/tecnico.md` (TEC-02f e critério do veredito em TEC-49), README.

## Decisões

- **D1 — cálculo puro compartilhado em `@at-field/core`; persistência e decisão oficial na API.** O `dto` continua só contrato. O app usa o core para mostrar números na hora; quando houver API, ela recalcula com o mesmo código.
- Stack com Home como hub (sem abas); estado em memória (`useReducer` + contexto, sem AsyncStorage): reiniciar volta aos mocks (badge "Dados de exemplo").
- Ícones com `expo-symbols` (já instalado), fontes com `@expo-google-fonts` + `useFonts`; sem `expo-clipboard` (o técnico cola com toque longo).
- Parser do WhatsApp por regras (regex + normalização): determinístico, gratuito, sem LLM; valor nunca é preenchido pela mensagem.
- Simulador sem API de rota (rotas de exemplo ou distância digitada): custo R$ 0.
- Testes de tela com `jest-expo` + RNTL 14 (render e eventos assíncronos); Vitest só na lógica pura.

### Desvios e escolhas onde a spec não fechava

- `ErroCampo` mora em `erros.ts` (usado por simulador, reputação, espera e improdutiva) e `DURACAO_PADRAO_MIN` em `empresas.ts`, para evitar import circular `agenda ↔ empresas`. Os dois são exportados pelo índice do pacote.
- `detectarConflitos(c, ls, empresas)` e `agendaDosProximosDias(ls, hoje, dias, empresas)` recebem as empresas para achar o percal da negociação (Parte C); `ItemAgenda` ganhou `origemDuracao` (`estimada`/`percal`/`padrao`).
- `rascunhoDeDemanda(d, ids, neg?)`: a forma de cobrança segue a negociação, mas **nenhum valor monetário é copiado** (só percal e nº de diárias), coerente com "valor nunca é inventado".
- `resumoDoMes.foraDoTotal` conta lançamentos sem data e os do mês sem valor (agendados ficam de fora). Despesa sem categoria entra em "Outros" no financeiro.
- GWT 67 ("custo/km 74,67 → 5973"): só fecha com o custo exato do veículo mock (670 ÷ 15 + 30 = 74,666…); com 74,67 arredondado daria 5974. O teste usa o valor exato.
- `/lancar`: datas "Hoje/Ontem" em "Já fiz" e "Hoje/Amanhã" em "Agendar". Depois de lançar, volta à Home com a mensagem "Lançado. Fica em Pendências até você revisar.".
- `/whatsapp`: no preview são editáveis cliente, local, motivo e a cidade (homônimos); o resto se completa no lançamento criado. O teste do vínculo por telefone usa outro número, porque o `43900000001` já está vinculado à IK Solution nos mocks.
- `/lancamento/[id]`: data digitada como `AAAA-MM-DD` (sem seletor de data no protótipo). A política exibida como "não informada" é inferida pela negociação atual da empresa.
- `/empresa/[id]`: percal editável por chips (1 a 8 h).
- O cenário A do simulador vem com os números do GWT 5 (percal 4 h, hora adicional R$ 25/h), não com a negociação da Sozic.
- Parser, sinais de pagamento: avaliados por oração (pontuação ou quebra de linha); negação ("não", "sem", "nunca") antes do verbo na mesma oração, ou "sem deslocamento/pedágio", dá `false` e vence uma afirmação em outra oração. Verbos: paga/pagamos/pago/pagam, reembolsa/reembolsamos/reembolsam, cobre/cobrimos/cobrem; termos: deslocamento, km, quilometragem / pedágio(s).
- Parser, hora: só com `h` ou `:` ("às 14h", "às 14h30", "14:30"), para "trocar as 2 impressoras" não virar 02:00; a hora de início ("às", "a partir das", `hh:mm`) tem preferência sobre a de fim ("até as 18h"), que só vale sozinha.
- Agenda: a checagem de conflito olha também o dia anterior e o seguinte, então uma consulta 23:00 + 2 h conflita com um agendado às 00:30, e `emConflito` na agenda considera a virada do dia.
- Improdutiva já registrada: trocar motivo ou data mantém a política gravada (TEC-21), não a negociação atual.

## Testes

- **`@at-field/core`**: 19 arquivos, 272 testes (Vitest), com todos os Given/When/Then da spec (1–4, 5–5f, 6–11, 12–15, 16–39, 40–52, 53–62, 63–73) e os 3 exemplos reais do parser comparados com `toEqual` no objeto inteiro. Inclui as frases negativas de pagamento ("Não pagamos km", "A empresa não paga quilometragem", "Não reembolsamos o deslocamento/pedágio") com controles positivos, a hora com `h`/`:` e início × fim, e a virada da meia-noite. Cobertura: 100% das linhas, 98,3% dos ramos.
- **`apps/mobile`**: 8 suítes, 70 testes (jest-expo + RNTL 14): reducer (18), Home (5), lançamento rápido (7), WhatsApp (8), simulador (6), empresa (8), lançamento (12), telas de consulta (6).

## Como validar

```bash
pnpm install
pnpm --filter @at-field/core test        # ou test:cov
pnpm --filter @at-field/core build      # o mobile importa o dist do core
pnpm --filter mobile test                # direto exige o build acima; via `pnpm test` (turbo) o build já acontece
pnpm lint && pnpm build && pnpm test
cd apps/mobile && npx expo-doctor        # 20/20
npx expo export -p web --output-dir <pasta-temporária>
pnpm --filter mobile dev                 # Expo Go ou web; conferir claro/escuro em 360 px
```

## Pendências

- Conferência visual manual no Expo Go/web (claro/escuro, 360 px) — não feita neste passo.
- Persistência, login e API dos lançamentos; a API passa a usar o `@at-field/core`.
- Reembolso de despesa pela empresa (TEC-46c) fica para o próximo passo.
- Seletor de data, múltiplas esperas por serviço, relatório "quanto perco esperando", item de material no serviço.
- Rota/pedágio por API (TEC-40/49) e base de cidades do IBGE no lugar do mock (a API já tem a base e o pacote offline `GET /cities/all` desde o [passo 007](007-base-ibge-estados-cidades.md); falta o app consumir).
- Versão horizontal do logo (ainda não existe no kit).
- `tempoDoAtendimento.ganhoPorHoraCentavos` ("ganho por hora no local") divide o total do serviço, que inclui o valor do deslocamento, só pelo tempo no local, sem contar tempo nem custo de estrada. Decidir depois se o deslocamento sai do numerador ou se a estrada entra no tempo (o ganho/h completo da viagem é o do simulador, TEC-48).
