# Projeto AT-Field

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-blue) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Um sistema completo para gestão de serviços de campo (Field Service), projetado para otimizar o fluxo de trabalho desde a abertura do chamado até o faturamento do cliente.

## 🎯 Objetivo

O AT-Field nasce da necessidade de digitalizar e automatizar o processo de atendimento técnico. A plataforma oferece uma visão centralizada para administradores (via web) e uma ferramenta ágil para técnicos em campo (via app mobile).

É uma plataforma **multi-tenant**: cada conta é uma empresa (CNPJ) ou um profissional autônomo (CPF), que cadastra as pessoas que operam ou atendem por ela. Uma mesma pessoa pode atuar em mais de uma conta, com um papel diferente em cada uma.

## ✨ Features Principais

-   **Contas, Usuários e Permissões:** auto-cadastro de contas CPF/CNPJ, vínculo de pessoas a contas e papéis configuráveis por conta.
-   **Gestão de Clientes e Serviços:** Base de dados centralizada.
-   **Abertura e Rastreamento de Chamados:** Ciclo de vida completo do atendimento.
-   **Agenda Inteligente:** Alocação e visualização de serviços.
-   **Relatórios de Atendimento Técnico (RATs):** Geração e armazenamento digital.
-   **Módulo de Faturamento:** Automação da cobrança baseada em ciclos de pagamento.

## 🛠️ Stack de Tecnologia

| Categoria                | Tecnologia                                                                        | Descrição                                                                      |
| ------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Frontend (Web)** | ![Next.js](https://img.shields.io/badge/Next-black?style=for-the-badge&logo=next.js)     | Painel administrativo para gestão, dashboards e relatórios.                    |
| **Frontend (Mobile)** | ![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) | App (Expo) para o técnico em campo (agenda, status do chamado, RAT).           |
| **Backend (API)** | ![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=for-the-badge&logo=nestjs&logoColor=white) | API central com toda a regra de negócio. TypeORM, validação com Zod (`nestjs-zod`), documentação interativa com Scalar. |
| **Banco de Dados** | ![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white) | PostgreSQL em Docker; schema evolui só por migrations.                          |
| **Serviços de Apoio** | ![Firebase](https://img.shields.io/badge/firebase-%23039BE5.svg?style=for-the-badge&logo=firebase&logoColor=white) | Autenticação e Notificações Push. Arquivos (RATs) ficam em storage local da API. |
| **Monorepo** | pnpm workspaces + Turborepo | Apps e pacotes compartilhados (`@at-field/dto`: schemas Zod, tipos e validação de CPF/CNPJ; `@at-field/core`: cálculo puro do domínio do técnico, sem dependências, usado pelo app e, em breve, pela API). |

## 📁 Estrutura

```text
apps/
  api/      NestJS (backend)
  web/      Next.js (painel administrativo)
  mobile/   Expo / React Native (app do técnico)
packages/
  dto/      @at-field/dto — schemas, tipos e regras compartilhadas
  core/     @at-field/core — cálculo puro compartilhado (simulador, custo por km, parser do WhatsApp…)
  config/   presets compartilhados (ESLint)
docs/       arquitetura, decisões e registro de cada passo (docs/passos)
```

## 🚀 Ambiente de Desenvolvimento

### 1. Pré-requisitos

-   **Node.js** 22.12 ou superior
-   **pnpm** (via Corepack: `corepack enable`; a versão vem do `package.json`)
-   **Git**
-   **Docker** (para o PostgreSQL via `docker compose`)

### 2. Instalação

```bash
git clone <URL_DO_SEU_REPOSITORIO> at-field
cd at-field
pnpm install
```

### 3. Configuração

```bash
# Copie o exemplo e defina uma senha local para o banco
cp .env.example apps/api/.env

# Suba o PostgreSQL (container com volume persistente)
docker compose --env-file apps/api/.env up -d

# Aplique as migrations
pnpm --filter api migration:run
```

### 4. Executando

```bash
pnpm dev                    # todos os apps via Turborepo
# ou individualmente:
pnpm --filter api dev       # API     → http://localhost:4310 (docs em /api)
pnpm --filter web dev       # Web     → http://localhost:4311
pnpm --filter mobile dev    # Mobile  → Metro na porta 4312
```

### Portas

O projeto usa um bloco próprio (43xx) para não conflitar com outros projetos na mesma máquina:

| Serviço | Porta |
| --- | --- |
| API | 4310 |
| Web | 4311 |
| Mobile (Metro) | 4312 |
| PostgreSQL | 54310 |

### 5. Testes

```bash
pnpm test                       # testes de todos os pacotes (Vitest; jest-expo no mobile)
pnpm --filter api test:e2e      # e2e da API (usa o banco <DATABASE_NAME>_test, criado automaticamente)
pnpm lint                       # checagem de tipos + ESLint em todos os pacotes
```

Todo código novo é entregue com testes.

## 📱 App do técnico (protótipo)

O app mobile já é um **protótipo navegável** com dados de exemplo em memória (sem login nem API): agenda, resumo do mês, lançamento rápido "a revisar", colar mensagem do WhatsApp, financeiro, simulador "compensa ou não compensa", custo do veículo e reputação das empresas. Rode `pnpm --filter mobile dev` e abra no Expo Go ou no navegador. Detalhes em `docs/passos/006-prototipo-mobile.md`.

## 🔌 API (até agora)

Rotas de conta usam o header **`X-Tenant-Id`** para indicar a conta ativa. A autenticação (Firebase) ainda será adicionada.

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/tenants` | Auto-cadastro: cria a conta (CPF/CNPJ), o usuário e o vínculo `owner` |
| `GET` / `PATCH` | `/tenants/current` | Ver / editar a conta ativa |
| `GET` / `POST` | `/users` | Listar / adicionar pessoas à conta |
| `GET` / `PATCH` / `DELETE` | `/users/:id` | Ver, alterar papel/status, remover da conta |
| `GET` / `POST` | `/roles` | Listar / criar papéis |
| `GET` / `PATCH` / `DELETE` | `/roles/:id` | Ver, editar, excluir papel |
| `GET` | `/permissions` | Catálogo de permissões |

Documentação interativa (Scalar, com exemplos em cURL, fetch, PowerShell etc.) em `http://localhost:4310/api`; OpenAPI em `http://localhost:4310/api-json`.

## 🗺️ Roadmap de Desenvolvimento

### Fase 0: Configuração do Ambiente e Base

- [X] Inicialização do monorepo com Turborepo.
- [X] Criação dos projetos base: Next.js, React Native (Expo) e NestJS.
- [X] Configuração da conexão com o banco de dados PostgreSQL local (Docker + TypeORM).
- [X] Estruturação inicial do banco de dados (primeiras migrations).

### Fase 1: O Início do Atendimento (MVP Core)

- **Módulo 1: Cadastros Essenciais (Backend)**
    - [X] Modelo multi-tenant: contas, usuários, vínculos, papéis e permissões.
    - [X] CRUD de contas, usuários e papéis.
    - [ ] Estados e cidades (base do IBGE).
    - [ ] Configuração do Firebase Authentication para login de usuários.
    - [ ] Modelagem e `migrations` das tabelas: `clients`, `service_types`.
    - [ ] Criação dos endpoints CRUD na API NestJS para Clientes e Tipos de Serviço.
- **Módulo 2: Gestão de Chamados (Backend)**
    - [ ] Modelagem e `migrations` da tabela `service_calls`.
    - [ ] Endpoint para abertura de um novo chamado.
- **Painel Web (Next.js)**
    - [ ] Telas de listagem, criação e edição para Clientes e Tipos de Serviço.
    - [ ] Tela para abertura de um novo chamado, associando a um cliente.
    - [ ] Tela de listagem de todos os chamados abertos.

### Fase 2: Execução e Controle

- **Módulo 3: Agendamento (Backend)**
    - [ ] Lógica e endpoints para agendamento na API.
- **Painel Web (Next.js)**
    - [ ] Desenvolvimento da tela de Agenda/Calendário.
- **App Mobile (React Native)**
    - [ ] Telas de Login, lista e detalhes de chamados.
    - [ ] Funcionalidade para alterar o status do chamado.

### Fase 3: Pós-Atendimento e Faturamento

- **Módulo 5: Relatório de Atendimento (RAT)**
    - [ ] Modelagem e endpoints para a RAT.
    - [ ] Upload de fotos na API com storage local (volume mapeado do Docker).
- **App Mobile (React Native)**
    - [ ] Formulário para preenchimento da RAT.
- **Módulo 6: Faturamento**
    - [ ] Lógica no backend e endpoints para gerar faturas.
- **Painel Web (Next.js)**
    - [ ] Tela de Faturamento e visualização de RATs.

### Fase 4: Melhorias e Funcionalidades Avançadas

- [ ] Dashboard com métricas no Painel Web.
- [ ] Notificações Push para o App Mobile.
- [ ] Captura de assinatura digital do cliente no App Mobile.

### Bonus: Integrações

- [ ] Asaas (cobrança)

## 📚 Documentação

- [`CLAUDE.md`](CLAUDE.md) — guia rápido do repositório (estrutura, comandos, convenções)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitetura e decisões técnicas
- [`docs/passos/`](docs/passos/README.md) — registro de cada passo do desenvolvimento

## 📜 Licença

Este projeto está licenciado sob a Licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---
Feito com ❤️ por **Alberto H Tsugawa**.
