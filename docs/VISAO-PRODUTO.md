# Visão do produto

O AT-Field é um produto da AT Solutions. **Foco principal: o técnico de campo e o app mobile.** O caminho é o inverso da maioria dos sistemas de field service, que nascem para a empresa controlar o técnico: aqui começamos por quem mais sofre na operação, o técnico. Para o técnico, o sistema é uma necessidade: é onde ele gerencia o próprio trabalho. Para as empresas que contratam técnicos, é um conforto (um painel web mais simples no começo).

## Por que o app existe

O Alberto trabalhou um ano e meio como técnico de field, entre os que mais faturavam (média de R$ 7–8 mil por mês). Todo mês precisava **fechar empresa por empresa**: separar de madrugada o que tinha feito para cada uma, ver para quem tinha que emitir nota e para quem não, montar planilha. O AT-Field nasce para **automatizar esse fechamento para o técnico**. Quem já esteve no lugar dele sabe a dor.

As empresas (ITs) não são o foco: elas virão atrás da base de técnicos depois e pagarão por ela.

## Missão

**Fazer o técnico ganhar dinheiro de verdade, não só pagar o boleto e a despesa do carro.** O AT-Field dá ao técnico a visão administrativa do próprio negócio para ele decidir sozinho: se consegue atender, se aquela empresa compensa, quanto sobra por hora. Com números reais na mão, ele **negocia** ("nesse valor eu não vou") e escolhe as empresas boas, deixando de lado as que exploram.

A diferença que motivou o produto: com a mesma profissão, um técnico que conhece seus números faturava R$ 8 mil com R$ 1,2–3 mil de despesa; outros faturavam R$ 3 mil com R$ 1 mil de despesa, porque aceitavam o que as empresas ofereciam sem saber quanto realmente sobrava.

Critério de toda decisão de produto: **isso ajuda o técnico a ganhar mais e decidir melhor?**

**Ideia — quais empresas são boas para mim**: comparar as empresas que o técnico atende pelo que realmente rendem (ganho por hora líquido de despesas, deslocamentos pagos ou não, prazo de pagamento, atrasos, tempo extra não pago). Primeiro privado, só para o técnico. Uma visão coletiva (o que a rede de técnicos sabe sobre cada empresa) é um passo posterior e delicado: exige dados agregados e anônimos e cuidado jurídico antes de expor o nome de empresas.

Regras detalhadas, separadas por lado: [regras/](regras/README.md).

## Quem usa

| Perfil | Quem é | O que faz no AT-Field | Prioridade |
| --- | --- | --- | --- |
| **Técnico** | Profissional de campo (normalmente autônomo, conta CPF). Pode ter a própria assistência | Aceita ou recusa chamados oferecidos pelas empresas (sem obrigatoriedade); registra serviços feitos para qualquer empresa ou cliente, mesmo fora da plataforma; gerencia a própria operação e as finanças | **Principal** — app mobile |
| **Empresa contratante (IT / dispatcher)** | Empresa (CNPJ) que terceiriza atendimento técnico | Busca técnicos na base, disponibiliza chamados, acompanha | Secundária — painel web básico |
| **Clientes do técnico** | Pessoas físicas locais, empresas (ITs) e clientes atendidos remotamente | São os clientes da assistência do próprio técnico | Cadastrados pelo técnico |

## O app em uma frase

Abrir o app e ver, em segundos: **quanto ganhei e gastei no mês**, **lançar rápido** o que acabei de fazer (e revisar depois) e **o que tenho a receber**. Detalhes em [regras/tecnico.md](regras/tecnico.md) (TEC-02a/b/c).

## O que o técnico precisa (o centro do produto)

- **Chamados de empresas**: ver o que as empresas disponibilizam e aceitar ou não.
- **Registrar serviço feito para empresa fora da plataforma**: informa o CNPJ; se a empresa já existe na base, o sistema oferece vincular; se não existe, oferece buscar os dados básicos do CNPJ e cadastrar.
- **Seus próprios clientes** (assistência): pessoa física local, empresas (ITs) e remotos, cada um com seu jeito de trabalhar.
- **Gestão do negócio dele**:
  - o que já teve nota emitida e o que não teve;
  - quanto serviço fez para cada CNPJ;
  - data de corte (fechamento) de cada empresa;
  - para onde viajou e quantos km rodou (média, por período).

## Ciclo de vida do chamado

**Não há um fluxo único.** Cada caso é um caso: o atendimento de uma empresa contratante, de um cliente pessoa física local ou de um cliente remoto segue processos diferentes. O ciclo de vida precisa ser **configurável**, não fixo no código.

## Cobrança (Asaas)

Integração **opcional por técnico**: cada técnico informa o próprio ID/chave do Asaas e o webhook, e gerencia suas cobranças por lá. Pode ou não ser usado. Não é a AT Solutions cobrando as contas.

## Custo e sustentabilidade

- **Custo baixo é requisito.** O objetivo é não repassar custo ao técnico, ou repassar o mínimo. Prioridade: **open source e gratuito** (self-hosted ou faixa gratuita) antes de serviço pago.
- Serviço pago só com justificativa (o que resolve que a alternativa gratuita não resolve) e atrás de uma **camada própria** (adapter), para poder trocar de provedor sem reescrever o app.
- Medir consumo desde cedo (servidor, banco, chamadas de API externas) para saber quanto custa cada técnico ativo.
- **Monetização em aberto**: talvez mensalidade para o técnico (valor baixo), talvez as empresas pagando pelo acesso à base de técnicos. Algum custo para o técnico deve existir; o produto precisa se pagar.

## Fora do escopo agora

- Integrações com ERPs/CRMs (IXC, SGP, Clinic etc.): são da AT Solutions, para depois.
- Outros produtos da AT Solutions.

## Impactos no que já existe

- O modelo multi-tenant atual continua válido: o técnico é uma conta CPF; a empresa contratante é uma conta CNPJ; uma pessoa pode ter vínculo com várias contas.
- **Falta um conceito novo**: a relação técnico ↔ empresa contratante não é de vínculo de usuário (o técnico não é funcionário da empresa). É uma relação comercial, e a empresa **pode nem ter conta** na plataforma. Isso pede um cadastro de empresas por CNPJ (preenchido pelo técnico ou por consulta pública ao CNPJ) que uma empresa pode depois "reivindicar" ao criar a conta.
- As "cidades de atuação" (IBGE) servem para as empresas buscarem técnicos por região.
