# Exemplos reais de demandas recebidas por WhatsApp

Modelos de como as empresas enviam demandas aos técnicos (ver [EMP-11](empresa.md)). Dados pessoais (nome do atendente, telefone) removidos. Usar como base para o lançamento rápido e para um futuro "colar mensagem do WhatsApp".

## Exemplo 1 — Central Field Service (19/10)

```text
🙂
Me chamo [atendente], falo da empresa Central Field Service, estamos expandindo
nossa rede de parceiros técnicos PJ/MEI na sua região.
Estou com uma demanda em sua região.

estou com chamado ZARA - 7056 Catuai Shop Londrina - PR

Motivo:  remanejar tgt e impressora
Ferramentas básicas
Testador e identificador
```

| Campo | Valor no exemplo | Observação |
| --- | --- | --- |
| Empresa contratante | Central Field Service | Vem no texto de apresentação, não num campo |
| Cliente final / código | ZARA - 7056 | Nome do cliente + código da loja/chamado |
| Local | Catuai Shop, Londrina - PR | Shopping + cidade + UF; sem endereço completo |
| Serviço (motivo) | remanejar tgt e impressora | Texto livre, com jargão ("tgt") |
| Ferramentas exigidas | Ferramentas básicas; testador e identificador | Lista em linhas soltas |
| Valor | — | **Não vem na mensagem**: negociado depois na conversa |
| Data/horário | — | **Não vem na mensagem**: combinado depois |

Leitura (exemplo 1): a primeira mensagem é uma **oferta**; valor, data e aceite acontecem na conversa seguinte. O app precisa capturar a oferta rápido e deixar valor/data para completar depois (lançamento rápido "a revisar", TEC-02b).

## Exemplo 2 — IK Solution (16/10)

Copiado do WhatsApp com o prefixo de data, hora e remetente em cada linha, e quebrado em várias mensagens curtas:

```text
[16/10, 17:16] [contato] IK Solution: Tenho uma demanda em Candido Mota para um técnico de campo, indicam alguém, em tempo tudo bem como vocês?
[16/10, 17:22] [contato] IK Solution: Do lado de lá da divisa
[16/10, 17:22] [contato] IK Solution: Pagamos o deslocamento
```

| Campo | Valor no exemplo | Observação |
| --- | --- | --- |
| Empresa contratante | IK Solution | Vem **no nome do contato** do prefixo, não no texto |
| Local | Candido Mota (cidade) | Sem UF; "do lado de lá da divisa" indica outro estado (Cândido Mota é SP, na divisa com o PR). Nome sem acento: casar com a base IBGE ignorando acentos |
| Serviço | — | Não informado: só "técnico de campo" |
| Deslocamento | Pago pela empresa | "Pagamos o deslocamento" → item de deslocamento previsto |
| Valor / data | — | Não vêm na mensagem |
| Indicação | "indicam alguém" | A empresa pede **indicação** de técnico: o técnico pode repassar a oferta a outro técnico da rede (ligado a ajudantes/rede, TEC-10+) |

Leitura (exemplo 2): o parser precisa (1) remover o prefixo `[dd/mm, hh:mm] Remetente:` de cada linha e juntar as mensagens, (2) tirar a empresa do remetente quando o texto não a nomeia, (3) reconhecer cidade mesmo sem UF e sem acento, (4) detectar sinais como "pagamos o deslocamento" e "pedágio".

## Exemplo 3 — AmparoTécnico

```text
Boa noite, tudo bem?
Me chamo [atendente] falo da AmparoTécnico, estou com uma demanda em Cianorte/PR, gostaria de verificar se é possivel realizar o atendimento amanhã as 14h

Alguém?
```

| Campo | Valor no exemplo | Observação |
| --- | --- | --- |
| Empresa contratante | AmparoTécnico | No texto, padrão "falo da/do &lt;empresa&gt;" (igual ao exemplo 1) |
| Local | Cianorte/PR | Formato `Cidade/UF` (no exemplo 1 era `Cidade - PR`) |
| Data/horário | amanhã às 14h | **Data relativa**: depende de quando a mensagem foi enviada. Sem o prefixo de data do WhatsApp, usar a data em que o técnico colou como referência e deixar para ele confirmar |
| Serviço / valor | — | Não informados |
| Ruído | "Boa noite, tudo bem?", "Alguém?" | Saudação e cobrança de resposta: ignorar |

Leitura (exemplo 3): o parser precisa reconhecer datas e horas relativas ("hoje", "amanhã", "segunda", "às 14h", "14:00") e os dois formatos de cidade/UF (`Cidade/UF`, `Cidade - UF`).

## Padrões observados nos 3 exemplos

- A empresa aparece como "falo da/do X", "empresa X" ou no **nome do remetente**.
- O local aparece como `Cidade - UF`, `Cidade/UF`, nome de shopping/loja + cidade, ou só a cidade.
- **Valor quase nunca vem** na primeira mensagem; data às vezes vem, muitas vezes relativa.
- Sinais úteis espalhados no texto: "pagamos o deslocamento", "pedágio", "ferramentas", código de loja/chamado ("ZARA - 7056").
- Muito ruído: saudações, apresentação da empresa, "alguém?".
