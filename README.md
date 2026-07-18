# Projeto AT-Field

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-blue)

Um sistema completo para gestão de serviços de campo (Field Service), projetado para otimizar o fluxo de trabalho desde a abertura do chamado até o faturamento do cliente.

## 🎯 Objetivo

O AT-Field nasce da necessidade de digitalizar e automatizar o processo de atendimento técnico. A plataforma oferecerá uma visão centralizada para administradores (via web) e uma ferramenta ágil para técnicos em campo (via app mobile).

## ✨ Features Principais

-   **Gestão de Clientes e Serviços:** Base de dados centralizada.
-   **Abertura e Rastreamento de Chamados:** Ciclo de vida completo do atendimento.
-   **Agenda Inteligente:** Alocação e visualização de serviços.
-   **Relatórios de Atendimento Técnico (RATs):** Geração e armazenamento digital.
-   **Módulo de Faturamento:** Automação da cobrança baseada em ciclos de pagamento.

## 🛠️ Stack de Tecnologia

| Categoria                | Tecnologia                                                                        | Descrição                                                                      |
| ------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Frontend (Web)** | ![Next.js](https://img.shields.io/badge/Next-black?style=for-the-badge&logo=next.js)     | Painel administrativo para gestão, dashboards e relatórios.                    |
| **Frontend (Mobile)** | ![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) | App para o técnico em campo (agenda, status do chamado, RAT).                  |
| **Backend (API)** | ![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=for-the-badge&logo=nestjs&logoColor=white) | API central com toda a regra de negócio do sistema.                            |
| **Banco de Dados** | ![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white) | Banco de dados relacional principal para persistência dos dados.               |
| **Serviços de Apoio** | ![Firebase](https://img.shields.io/badge/firebase-%23039BE5.svg?style=for-the-badge&logo=firebase&logoColor=white) | Autenticação, Notificações Push e Armazenamento de Arquivos. |

## 🚀 Ambiente de Desenvolvimento (Plano Inicial)

Esta seção descreve os passos básicos para configurar e rodar o projeto localmente.

### 1. Pré-requisitos
-   **Node.js** (v20 ou superior)
-   **pnpm** (`npm install -g pnpm`)
-   **Git**
-   **PostgreSQL** (Instalado e rodando diretamente na máquina)

### 2. Instalação
```bash
# 1. Clone o repositório
git clone <URL_DO_SEU_REPOSITORIO> at-field
cd at-field

# 2. Instale todas as dependências do monorepo
pnpm install
```

### 3. Executando o Ambiente
```bash
# 1. Certifique-se que seu serviço do PostgreSQL está ativo.
# Lembre-se de criar o banco de dados para o projeto e configurar o arquivo .env em apps/api com suas credenciais locais.

# 2. Rode a API em modo de desenvolvimento (com watch)
pnpm --filter api dev

# 3. Rode o Painel Web (Next.js)
pnpm --filter web dev

# 4. Rode o App Mobile (Expo)
pnpm --filter mobile start
```

## 🗺️ Roadmap de Desenvolvimento

### Fase 0: Configuração do Ambiente e Base
- [ ] Inicialização do monorepo com Turborepo.
- [ ] Criação dos projetos base: Next.js, React Native (Expo) e NestJS.
- [ ] Configuração da conexão com o banco de dados PostgreSQL local.
- [ ] Estruturação inicial do banco de dados (primeiras migrations).

### Fase 1: O Início do Atendimento (MVP Core)
- **Módulo 1: Cadastros Essenciais (Backend)**
    - [ ] Modelagem e `migrations` das tabelas: `clients`, `service_types`, `users`.
    - [ ] Criação dos endpoints CRUD na API NestJS para Clientes e Tipos de Serviço.
    - [ ] Configuração do Firebase Authentication para login de usuários.
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
    - [ ] Integração com Firebase Storage para upload de fotos.
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
- [] ASAAS

---
Feito com ❤️ por **Alberto H Tsugawa**.