# Regras do técnico

O técnico é o usuário principal (app mobile). Normalmente autônomo/MEI, conta CPF. O primeiro usuário real será o próprio Alberto, técnico MEI.

## Tela inicial do app

**Princípio: simples e rápido.** O técnico está com pressa, no carro ou no cliente; o app não pode exigir parar para mexer. Ao abrir o app, três coisas com acesso imediato:

- **TEC-02a — Resumo do mês (dashboard)**: quanto prestou de serviço e quanto teve de custo no mês, e o resultado.
- **TEC-02b — Lançamento rápido**: registrar um serviço ou uma despesa em poucos toques, com o mínimo de campos. Todo lançamento rápido fica **marcado como "a revisar"** e aparece como pendência até o técnico completar e confirmar. Sem isso o técnico fica só no rápido, os números ficam errados e ele conclui que "o sistema não funciona".
- **TEC-02c — Financeiro**: o que tem a receber (por empresa, por ciclo), o que já recebeu e as despesas lançadas.
- **TEC-02e — Agenda à vista**: ao abrir o app, o técnico vê o que tem agendado (hoje, amanhã e próximos dias), sem caçar no WhatsApp. Cada atendimento aparece com horário de início e **duração estimada**. Ao lançar ou colar uma demanda com data/hora (ex.: "amanhã às 14h"), o app avisa se já há atendimento naquele horário.
- **TEC-02d — Simulação rápida** (TEC-49): origem, destino e quanto a empresa oferece → o app busca rota, distância, tempo e **pedágios** por API, aplica o custo por km do veículo e responde **compensa ou não compensa**.
- **TEC-02f — Colar mensagem do WhatsApp** (EMP-11): o técnico cola a mensagem da empresa e o app extrai empresa (pelo texto, pelo telefone vinculado ou pelo remetente), cliente/código do chamado, local, cidade/UF (sem acento, `Cidade - UF`, `Cidade/UF` ou só a cidade, com escolha entre homônimos), motivo, ferramentas, data/hora relativas ("amanhã às 14h", referência = data da mensagem ou do dia em que colou) e sinais (deslocamento/pedágio pagos, pedido de indicação), mostra avisos da empresa e de conflito de agenda e cria um lançamento **"a revisar"**. O **valor nunca é inventado**: fica para o técnico completar. Extração por regras, no aparelho, sem custo (passo 006).

## Chamados

- **TEC-01** — O técnico vê os chamados que as empresas disponibilizam e **aceita ou recusa livremente**; não há obrigatoriedade.
- **TEC-02** — O técnico registra serviço feito para empresa que não está na plataforma informando o CNPJ (ver [COM-02](comum.md)).
- **TEC-03** — O técnico tem os próprios clientes (assistência): pessoa física local, empresas (ITs) e remotos. Cada tipo pode seguir um processo diferente (ver [COM-04](comum.md)).

## Ajudantes e repasse

- **TEC-10** — O técnico pode ter ajudantes. O ajudante **pode ou não ser cadastrado** na plataforma: o técnico decide (um ajudante não cadastrado é só um nome no cadastro do técnico).
- **TEC-11** — O técnico pode **repassar um chamado** a um ajudante.
- **TEC-12** — Cada ajudante tem um **percentual de repasse padrão** negociado com o técnico (ex.: 5 chamados da Sozic; 1 passado ao Leonardo, 70%; 1 ao Weber, 80%; 3 feitos pelo próprio técnico). O sistema calcula quanto o técnico deve repassar a cada um.
- **TEC-13** — O repasse é **ajustável por chamado**, porque cada repasse é combinado na hora. Dois casos reais:
  - o ajudante compra o material → recebe o percentual **mais o material**;
  - o ajudante pega o material com o técnico → recebe só o percentual.
- **TEC-14** — **Ajudante cadastrado** (login com CPF ou e-mail) vê no app dele os chamados que recebeu de cada técnico e **quanto tem a receber de cada um**. Um ajudante pode receber trabalho de vários técnicos. Ele é um usuário com menos recursos que o técnico principal.

## Valores (quanto o técnico recebe)

**Princípio: cada caso é particular.** Toda negociação acontece entre técnico e empresa (normalmente por WhatsApp) e muda de empresa para empresa. Por isso o valor de cada chamado é composto por **itens** (serviço, deslocamento, adicionais, material, desconto), pré-preenchidos pela negociação com a empresa e **ajustáveis no chamado**, e não calculado por um motor de regras fixo.

- **TEC-20** — Cada empresa contratante tem uma **negociação própria** com o técnico: um valor base por chamado e os adicionais combinados. Serve de padrão para os chamados novos daquela empresa.
- **TEC-21** — A negociação muda com o tempo (ex.: Sozic pagava R$ 70 por chamado; renegociado para R$ 100). Chamados já feitos mantêm o valor da época.
- **TEC-22** — Vários chamados no mesmo local podem ter **desconto** ou não, conforme a empresa. Exemplos reais:
  - Sustento: R$ 80 por chamado, mas 3 no mesmo local valiam R$ 200 no total;
  - Protege: 3 chamados no mesmo local, cada um pago, com um desconto;
  - Santander (5 chamados no mesmo local): cada um pelo seu preço, sem desconto.
- **TEC-23** — **Deslocamento** é item próprio do chamado, com a **localidade**: o técnico vê de cara se aquele chamado paga deslocamento e onde é. Exemplo real: de Londrina a Maringá, 2 atendimentos no Santander pela Sozic e 1 pela Sustento → **2 deslocamentos** (um por empresa).
- **TEC-23a** — Para um destino único, o deslocamento é pago sobre **ida e volta** (para roteiros com várias paradas, ver TEC-46a; para vários chamados num mesmo deslocamento, TEC-46b): km da ida (da casa/base do técnico até o endereço do cliente) **× 2**. Exemplo: Londrina–Maringá ≈ 100 km de ida → 200 km pagos. A quilometragem da ida pode ser, conforme a parceria com cada empresa:
  - **média combinada** (ex.: sempre 100 km para Maringá), ou
  - **exata** da viagem (100, 110, 120 km conforme o endereço).
  O modo (média ou exata) e o km médio por destino fazem parte da negociação com a empresa (TEC-20a).
- **TEC-26** — **Percal** (franquia de horas): o valor base do chamado cobre um número de horas combinado com a empresa. Exemplos reais: R$ 100 com percal de 4 h, ou R$ 100 com percal de 2 h — a mesma tarifa rende metade por hora. Passou do percal, entra a **hora adicional**, também negociada por empresa (pode não existir). Tudo é negociação: o técnico precisa perguntar o percal antes de aceitar; se não perguntar, descobre depois. A negociação com cada empresa (TEC-20) guarda percal e valor da hora adicional, e o app lembra o técnico de perguntar quando faltar.
- **TEC-27** — **Formas de cobrança variam por empresa e até por serviço.** Exemplo real (contrato com a AEF, que atendia a Gmed): alguns serviços por **hora** (R$ 100/h), outros em **pacote fechado** (negociado por causa de material e infraestrutura), outros por **diária**, outros por **período** (percal, TEC-26). A negociação com a empresa define a forma padrão, e cada chamado pode usar outra. Formas: por chamado (com percal), por hora, por diária, pacote fechado (valor fixo, podendo incluir material).
- **TEC-28** — **Tempo de espera** registrado à parte do tempo de atendimento: aguardando liberação de acesso, aguardando o suporte remoto, responsável ausente. Exemplo real: 1 h travado esperando liberação na Protege. Entra no tempo total (derruba o ganho por hora, TEC-48), serve de base para pedir acréscimo quando a empresa paga, e alimenta a avaliação do cliente final (TEC-75). Com o tempo, o app mostra quanto o técnico perde esperando em cada cliente e empresa.
- **TEC-29** — **Improdutiva**: o técnico foi até o local, mas não conseguiu fazer o serviço por motivo fora do controle dele (gerente ausente, entrada não liberada, equipamento indisponível, cliente cancelou na hora). Cada empresa tem uma política, que faz parte da negociação: **não paga**, **paga um percentual** (ex.: 50%) ou **paga integral**, e pode pagar ou não o deslocamento. O técnico marca o atendimento como improdutivo, com o motivo, e o app calcula o que ele tem a receber pela política da empresa e mostra o prejuízo real (deslocamento, tempo perdido, despesas). É fonte frequente de conflito com a empresa: o registro com data, hora e motivo ajuda o técnico a cobrar. Empresas que não pagam improdutiva aparecem na avaliação (motivo "não paga improdutiva", TEC-74).
- **TEC-25** — **Tempo estimado × tempo real.** Todo atendimento agendado tem duração estimada (ex.: 2 h). Depois, o técnico lança o tempo real: fez em 1 h 30, ou demorou mais (ex.: esperando o suporte). Quando demora além do combinado e a empresa paga por isso, o técnico lança um **acréscimo** (hora adicional) como item do chamado, com o motivo. O tempo real alimenta o ganho por hora (TEC-48) e mostra, com o tempo, quanto o técnico erra nas estimativas.
- **TEC-24** — Todos os custos da viagem são **negociados**: adicional noturno, adicional por km, pedágio e outros. Entram como itens do chamado (ou da viagem), conforme combinado com cada empresa.

## Nota fiscal

- **TEC-30** — Controle por **checklist**: cada serviço/período marca se a nota foi emitida ou não.
- **TEC-31** — O técnico pode **anexar o PDF** da nota (opcional), para consultar depois.
- **TEC-32** — Emissão da nota pelo app é um objetivo futuro, a avaliar (limites e regras do MEI).
- **Ideia**: como o técnico típico é MEI, acompanhar o **faturamento do ano contra o limite do MEI** (valor configurável, porque o limite muda por lei).

## Deslocamento e km

- **TEC-40** — O sistema calcula a **distância estimada** do trajeto pela API do Google Maps.
- **TEC-41** — O técnico pode **lançar o km real** (ex.: o Maps estimou 120 km e ele rodou 150, ou fez em 100). O valor lançado prevalece sobre a estimativa nos relatórios.
- **TEC-42** — Relatórios de viagens: para onde foi, km por período e média.
- No começo o lançamento manual tem prioridade; a estimativa automática é apoio.

## Despesas e "valeu a pena?"

- **TEC-45** — O técnico lança **despesas**: combustível, pedágio, alimentação, **estacionamento**, **hospedagem** e outras. Cada uma pode ser reembolsável pela empresa (TEC-46c); várias empresas pagam estacionamento. Pode ser pelo lançamento rápido (TEC-02b).
- **TEC-46** — **Viagem** agrupa os chamados e as despesas de um deslocamento (ex.: ida e volta Londrina–Maringá). O app mostra o **resultado da viagem**: o que recebeu menos o que gastou, para o técnico saber se compensou ir.
- **TEC-46a** — **Viagem com roteiro (várias paradas)**. Caso real: uma semana fora de casa saindo de Londrina sentido Maringá, passando por vários pontos e voltando sentido Ibiporã. Não é ida e volta: a distância é a **soma do trajeto** (origem → parada 1 → … → parada N → retorno), por outro caminho. Para um destino único, vale a regra de ida e volta (TEC-23a); para roteiro, o km pago e o km rodado são os do trajeto completo. Raro, mas acontece.
- **TEC-46b** — **Um deslocamento, vários chamados.** Caso comum: 10 chamados da mesma empresa numa cidade fora. O deslocamento pertence à **viagem**, não a cada chamado: é pago (e custa) uma vez. Para mostrar o resultado por chamado, o custo da viagem é **rateado** entre os chamados dela.
- **TEC-46c** — **Despesas reembolsadas pela empresa.** Em viagens longas a empresa pode pagar todas as despesas (combustível, refeição, hospedagem). O técnico lança cada despesa marcando **"reembolsável por {empresa}"**: ela entra no custo da viagem e também no "a receber" daquela empresa, até ser reembolsada. Assim a despesa não some no fechamento.
- **TEC-47** — **Custo por km do veículo**: o carro não custa só combustível. O custo por km tem duas partes, configuradas por veículo:
  - **combustível** = preço do litro ÷ consumo (km/l). Ex.: R$ 6,70 ÷ 15 km/l = **R$ 0,45/km**;
  - **manutenção/operação** (óleo, pneu, embreagem, desgaste) = valor por km. Pode ser informado direto (ex.: R$ 0,30/km) ou calculado a partir de itens com custo e intervalo (ex.: troca de óleo R$ 200 a cada 3.000 km = R$ 0,07/km).
  O app mostra o custo total por km e a divisão entre as duas partes (ex.: de R$ 1,00/km, R$ 0,70 combustível e R$ 0,30 manutenção). É uma **estimativa**: exatidão é impossível, o objetivo é o técnico enxergar o custo real que hoje ele ignora.
- **TEC-48** — **Tempo conta.** A viagem registra as horas de deslocamento (ida e volta) e de atendimento, e o app mostra **quanto o técnico ganhou por hora**. Exemplo real: 1 h para ir a Maringá, 1 h de serviço e 1 h para voltar = 3 h para ganhar R$ 100 → R$ 33/h, antes de descontar os custos. Entra no MVP.
- **TEC-49** — **Simulador de atendimento.** Antes de aceitar (ou para negociar), o técnico simula se compensa:
  - **entradas**: valor do serviço; o que a empresa paga de deslocamento (ex.: **R$ 0,80/km**); se a empresa **paga o pedágio ou não** (flag) e o valor do pedágio; distância (Google Maps) e tempo de estrada; tempo de atendimento; o custo por km do veículo (TEC-47); despesas previstas (alimentação);
  - **saída**: o que sobra no bolso, se o deslocamento cobre as despesas da viagem e o **ganho por hora**;
  - **comparação de cenários lado a lado**. Exemplo real: ir a Maringá (deslocamento pago a R$ 0,80/km + pedágio, mas 1 h de estrada em cada sentido) contra pegar dois chamados em Londrina (gasto bem menor, R$ 200 no total).
  - **sugestão de preço mínimo**: dado o valor/hora que o técnico quer ganhar, quanto ele precisa cobrar por um chamado àquela distância, como argumento na negociação.
  Objetivo: dar ao técnico a **visão administrativa do próprio negócio**.
  **Critério do veredito** (passo 006): **não compensa** se o que sobra é ≤ 0 (prejuízo) ou se o ganho por hora (estrada ida e volta + atendimento + espera) fica abaixo do valor/hora mínimo do técnico; senão **compensa**. "O deslocamento cobre" compara o que a empresa paga de deslocamento + reembolso de pedágio com veículo + pedágio + despesas previstas (sem deslocamento pago nem reembolso, não se aplica).
  **API de rota e pedágio (a validar pelo arquiteto)**: seguir o princípio de custo baixo da [visão](../VISAO-PRODUTO.md) — avaliar primeiro opções gratuitas/open source para rota e distância (motores sobre OpenStreetMap, como OSRM, Valhalla ou GraphHopper, self-hosted, ou faixas gratuitas de serviços baseados neles), com **cache** de rotas repetidas, e pedágio por API paga só se compensar (ou informado/salvo pelo técnico por trecho). Opção paga mais completa: **Google Routes API** (`computeRoutes` com informação de pedágio; a documentação lista o Brasil com cobertura de pedágio e aceita tags brasileiras como ConectCar), o que unifica distância, tempo e pedágio num provedor só. Alternativas: AILOG (API brasileira de pedágios sobre rotas do Google/TomTom/OSM) e Amazon Location Service. Pontos a confirmar: cobertura real de pedágio no Brasil na API principal (e não só na Routes Preferred), preço por requisição, cache de rotas repetidas, e o que fazer quando o pedágio vier como "valor desconhecido" (o técnico informa manualmente).
- **TEC-20a** — A negociação com cada empresa (TEC-20) inclui o **valor por km do deslocamento** e se a empresa **reembolsa pedágio**. Esses dados alimentam o simulador e preenchem os itens dos chamados daquela empresa.

## Reputação das empresas

**Princípio: a empresa também tem que valorizar o técnico.** O técnico precisa saber, antes de aceitar, com quem está lidando.

- **TEC-70** — **Identificar a empresa** pelo **CNPJ** ou pelo **telefone de quem está chamando**: o técnico vincula números de contato à empresa (ex.: o número da atendente da Central Field Service) e, quando uma mensagem chega desse número (ou o remetente aparece na mensagem colada), o app mostra a empresa e a reputação dela.
- **TEC-71** — **Nota de 0 a 10** que o técnico dá para cada empresa, com motivos opcionais da lista fechada de TEC-74 (atrasa pagamento, valor abaixo do combinado, não paga deslocamento/pedágio, percal não informado, mudança de escopo sem acréscimo).
- **TEC-72** — **Blacklist pessoal**: o técnico marca a empresa como "não atendo". Ao colar uma demanda ou receber chamado dessa empresa, o app avisa.
- **TEC-73** — **Visão da rede**: o técnico vê de forma fácil o que **os outros técnicos** acham da empresa (média das notas, quantidade de avaliações, principais motivos).
- **TEC-74** — **Motivos restritos**: a avaliação usa só **categorias objetivas pré-definidas** (ex.: atrasa pagamento, valor abaixo do combinado, não paga deslocamento/pedágio, percal não informado, mudança de escopo sem acréscimo, não paga improdutiva). **Sem texto livre público**: nada de xingamento ou acusação escrita que vire print e processo. Comentário livre, se existir, é privado do técnico.
- **TEC-75** — **Avaliação do cliente final, por atendimento** (opcional). A empresa contratante não é o único fator: pela Sozic, o técnico atendia Santander, Camicado, Posto Shell, e alguns clientes finais eram ruins de atender sem culpa da Sozic. Em cada atendimento o técnico pode dar uma nota ao **cliente final** (0–10, motivos de lista fechada como em TEC-74) e anotar como foi. Separado da nota da empresa contratante. Privado do técnico no começo; uma visão da rede segue os mesmos cuidados abaixo.
- **Ideia (TEC-76, depois do protótipo)** — **Contatos no cliente final**: o técnico guarda quem facilita a vida em cada local (gerente, portaria, TI do cliente) e dicas de acesso ("chegar pela doca", "falar com o gerente X"). Exemplo real: na Protege, a amizade com o gerente e a portaria acabava com a espera para liberar. Privado do técnico (dado pessoal, LGPD).
- **Cuidados (a validar antes de liberar a visão da rede)**:
  - mostrar média só a partir de um mínimo de avaliações (ex.: 5), para não expor nota de um técnico só nem permitir ataque isolado;
  - avaliações anônimas para as outras partes, critérios objetivos (pagamento em dia, valor, deslocamento, respeito) além da nota livre;
  - termos de uso e cuidado jurídico ao publicar reputação de empresas identificadas (risco de difamação; prever direito de resposta/contestação);
  - telefone de atendente é dado pessoal (LGPD): o vínculo telefone → empresa do técnico é privado dele; compartilhar na rede só números comerciais ou de forma que não exponha a pessoa.

## Fechamento do mês (o motivo do app)

- **TEC-55** — Por empresa e por ciclo (data de corte, TEC-51), o técnico gera o **fechamento**: lista dos chamados com seus itens de valor, total, o que tem nota emitida ou não e quanto repassar aos ajudantes. Substitui a planilha montada de madrugada. Formato de saída a definir (PDF, planilha, texto para WhatsApp).

## Gestão do técnico (relatórios)

- **TEC-50** — Quanto serviço fez para cada CNPJ (quantidade e valor) por período.
- **TEC-51** — **Data de corte** (fechamento) de cada empresa contratante: o que entra em cada ciclo de pagamento.
- **TEC-52** — O que já teve nota emitida e o que não teve (TEC-30).
- **TEC-53** — Quanto repassar a cada ajudante (TEC-12).

## Cobrança (Asaas)

- **TEC-60** — Integração opcional por técnico: ele informa a própria chave/ID do Asaas e o webhook. A chave é segredo do técnico e deve ser guardada cifrada.
