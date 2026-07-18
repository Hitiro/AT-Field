# AT-Field - Core Skills & Context

## Skill: Arquitetura e Padrões do Monorepo
- **Contexto:** Projeto estruturado como monorepo (Turborepo) contendo NestJS (`apps/api`), Next.js (`apps/web`) e React Native/Expo (`apps/mobile`).
- **Diretrizes:**
  - Isolamento de escopo: regras de negócio, persistência e integrações ficam estritamente na API.
  - Frontends (Web e Mobile) são camadas de apresentação que consomem a API NestJS.
  - Commits padronizados (ex: `feat:`, `docs:`, `fix:`, `chore:`).

---

## Skill: Autenticação e Notificações (Firebase & Local)
- **Contexto:** Gerenciamento de acessos, notificações e anexos do sistema.
- **Diretrizes:**
  - **Auth:** Utilizar o Firebase Authentication para login. A API NestJS valida o Bearer Token em rotas protegidas.
  - **Push Notifications:** Utilizar o Firebase Cloud Messaging (FCM) para envio ilimitado de notificações para o app mobile.
  - **Storage de Arquivos (RAT):** As fotos dos Relatórios de Atendimento Técnico (RATs) devem ser salvas **localmente no servidor** via upload direto para a API NestJS, sendo obrigatoriamente persistidas em um **Volume Mapeado do Docker**, garantindo a retenção dos dados em ambientes conteinerizados.

---

## Skill: Banco de Dados e Persistência (PostgreSQL)
- **Contexto:** Modelagem relacional e integridade de dados.
- **Diretrizes:**
  - Toda alteração estrutural deve ser feita via `migrations` no NestJS.
  - Tabelas base do MVP Core: `clients`, `service_types`, `users` e `service_calls`.

---

## Skill: Integração Asaas (Módulo de Faturamento)
- **Contexto:** Gerenciamento de clientes, cobranças e assinaturas.
- **Diretrizes:**
  - **Sincronização:** Ao criar um cliente na tabela `clients`, disparar a criação no Asaas e mapear o `asaasCustomerId` gerado.
  - **Webhooks:** Tratar eventos como `PAYMENT_RECEIVED` e `PAYMENT_OVERDUE` para atualizar o status local no Postgres.
  - **Segurança:** Validar obrigatoriamente o token do Asaas no cabeçalho do webhook.