# Regras de negócio

As regras ficam separadas por quem as vive, para facilitar o desenvolvimento: cada funcionalidade nasce olhando o arquivo do lado que ela atende. O agente `arquiteto` lê estes arquivos antes de propor uma solução; regra nova ou alterada é registrada aqui.

| Arquivo | Lado | Prioridade |
| --- | --- | --- |
| [tecnico.md](tecnico.md) | Técnico (app mobile) | Principal |
| [empresa.md](empresa.md) | Empresa contratante / dispatcher (painel web) | Secundária |
| [comum.md](comum.md) | Regras que valem para os dois lados (contas, CNPJ, chamado) | — |

Visão geral do produto: [../VISAO-PRODUTO.md](../VISAO-PRODUTO.md).

Cada regra tem um código (`TEC-01`, `EMP-01`, `COM-01`) para ser citada em specs, testes e `docs/passos`. Itens marcados **(em aberto)** ainda precisam de decisão.
