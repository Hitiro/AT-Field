# Regras comuns

## Contas

- **COM-01** — Conta (tenant) é CPF ou CNPJ. Uma pessoa pode atuar em várias contas, com papel diferente em cada uma. Já implementado (ver `docs/passos/002` e `004`).

## Empresas por CNPJ

- **COM-02** — Ao informar um CNPJ (ex.: o técnico registrando um serviço), o sistema procura na base:
  - **já existe** → oferece vincular;
  - **não existe** → oferece buscar os dados básicos do CNPJ (consulta pública) e cadastrar.
- **COM-03** — Uma empresa pode existir na base **sem ter conta** (cadastrada por técnicos). Quando ela criar a conta, assume esse cadastro. **(em aberto)** como validar que quem cria a conta é de fato a empresa.

## Chamado

- **COM-04** — O ciclo de vida do chamado é **configurável**, não fixo: cada tipo de atendimento (empresa contratante, cliente PF local, remoto…) pode ter etapas próprias.

## Estados e cidades

- **COM-05** — Estados e cidades vêm do **IBGE** e são identificados pelo **código IBGE** (UF com 2 dígitos, município com 7). É uma base de referência **global, sem conta**, com **leitura pública**. A busca por nome **ignora acento e caixa**. Cidades homônimas (ex.: Toledo/PR e Toledo/MG) aparecem sempre **com a UF** e **nunca são escolhidas sozinhas**: quem informa decide. A base só muda por **novo retrato do IBGE com migration**, e **nenhum município é apagado**. Implementado no [passo 007](../passos/007-base-ibge-estados-cidades.md).
