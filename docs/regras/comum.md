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
