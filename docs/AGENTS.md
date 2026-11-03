# Agentes de desenvolvimento

Toda task de desenvolvimento do AT-Field passa por três agentes, nesta ordem. Eles são subagentes do Claude Code, definidos em `.claude/agents/`, e a sessão principal os coordena. O usuário só recebe o código depois que os três trabalharam e o revisor aprovou.

## Fluxo

1. **Pedido** — o usuário descreve a task.
2. **`arquiteto`** — propõe a solução. Perguntas em aberto voltam ao usuário antes de codar.
3. **`codificador`** — implementa, testa e documenta.
4. **`revisor`** — revisa e dá o veredito. Com mudanças necessárias, volta ao codificador e é revisado de novo (até 2 rodadas; depois disso, o usuário decide).
5. **Entrega** — "código pronto, revisa": resumo, testes, sugestões e pendências. O usuário revisa e commita.

## Agentes

| Agente | Faz | Não faz | Ferramentas |
| --- | --- | --- | --- |
| `arquiteto` | Lê o código e propõe a spec: arquivos, contratos (rotas, schemas Zod, entidades, migration), regras de negócio, edge cases, cenários Given/When/Then, plano de testes, decisões e perguntas em aberto | Editar arquivos | Leitura, Bash de leitura, pesquisa web |
| `codificador` | Implementa a spec, escreve os testes, roda lint/testes, documenta o passo em `docs/passos`; pesquisa a documentação da linguagem/framework (back, web, mobile) quando precisa | Commit, push, dependência crítica fora da spec | Leitura, escrita, Bash, pesquisa web |
| `revisor` | Revisa o diff real contra a spec: correção, isolamento multi-tenant, segurança, testes, padrões, documentação; roda lint e testes; veredito APROVADO ou MUDANÇAS NECESSÁRIAS com apontamentos bloqueantes e sugestões | Editar arquivos | Leitura, Bash, pesquisa web |

As regras de negócio e edge cases (antigo papel `@business-rule`) fazem parte da spec do arquiteto.

## Política de bibliotecas

- **Stack padrão** (usar livremente): Zod, TypeORM, Vitest, Tailwind e as bibliotecas que o projeto já usa.
- **Dependência nova crítica**: o arquiteto justifica na spec por que é a melhor opção e confirma compatibilidade com as versões do projeto. O revisor confere.

## Stack de referência

- **Monorepo:** pnpm + Turborepo, TypeScript 6
- **Backend:** NestJS 12, TypeORM, PostgreSQL, Zod (`nestjs-zod`), Scalar
- **Web:** Next.js 16, React 19, Tailwind
- **Mobile:** Expo SDK 58, React Native 0.88
- **Testes:** Vitest
