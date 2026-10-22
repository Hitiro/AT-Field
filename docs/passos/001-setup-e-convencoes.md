# 001 — Setup do monorepo, documentação e convenções

## Objetivo

Alinhar documentação e configuração do repositório antes de iniciar o cadastro de usuários (ATF-3), eliminando inconsistências entre README, `docs/` e código.

## O que mudou

- `CLAUDE.md` criado na raiz (estrutura, comandos, regras, convenções).
- `docs/` passou a ser versionada.
- `turbo.json` e scripts `dev`/`build`/`lint`/`test` na raiz; script `dev` na API e no mobile.
- `.husky/commit-msg` (commitlint) e `prepare: husky`; `.gitattributes` forçando LF nos hooks.
- `docker-compose.yml` com PostgreSQL 16 e volume `pgdata`.
- Workflow `bump-develop.yml` sem integração com Jira (apenas gera a tag `vX.Y.Z-develop`).
- `docs/ARCHITECTURE.md`, `AGENTS.md` e `skills.md` atualizados com as decisões abaixo.

## Decisões

- **ORM:** TypeORM, `synchronize: false`, schema só por migrations.
- **Validação:** Zod via `nestjs-zod` (em vez de `class-validator`).
- **Auth:** Firebase Auth (guard de Bearer Token) → RBAC com permissões `módulo:ação` → API keys com escopos só quando houver integrador. Sem OAuth2 próprio.
- **API keys:** guardar hash (SHA-256), nunca o token nem versão criptografada.
- **Storage dos RATs:** local, em volume Docker (não Firebase Storage).
- **Postgres:** via Docker, não instalado na máquina.
- **Asaas:** sincronização por job com retry, não dentro da requisição.
- **Projeto solo, sem Jira:** commits sem chave de issue; branches `feat/`, `fix/`, `docs/`, `chore/`.

## Portas

Bloco 43xx reservado (3000, 3001 e 5432 já estavam em uso na máquina de desenvolvimento): API 4310, Web 4311, Mobile/Metro 4312, PostgreSQL 54310.

## Como validar

```bash
pnpm install
docker compose --env-file apps/api/.env up -d
pnpm dev
```

(Não executado ainda neste passo; validar no primeiro uso.)

## Pendências

- Renomear a branch `ATF-3-...` (local e remota).
- Decidir o destino do `stash@{0}` (contém `OllamaLocal.yaml`).
- Apagar os secrets `JIRA_*` no GitHub.
