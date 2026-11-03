import { formatarMoeda, resumoDoMes } from '@at-field/core'

import { Banner } from '@/components/ui/banner'
import { Card } from '@/components/ui/card'
import { ListItem } from '@/components/ui/list-item'
import { Screen } from '@/components/ui/screen'
import { StatRow } from '@/components/ui/stat-row'
import { AppText } from '@/components/ui/text'
import { useHoje, useLancamentos } from '@/state/store'
import { mesDe, nomeDoMes } from '@/utils/datas'

export default function Resumo() {
  const ls = useLancamentos()
  const mes = mesDe(useHoje())
  const r = resumoDoMes(ls, mes)
  return (
    <Screen>
      <AppText variante="overline">TEC-02a</AppText>
      <AppText variante="h2" accessibilityRole="header">
        {nomeDoMes(mes.mes)} de {mes.ano}
      </AppText>
      <Card>
        <StatRow
          rotulo="Serviço prestado"
          valor={formatarMoeda(r.servicoCentavos)}
        />
        <StatRow rotulo="Custos" valor={formatarMoeda(r.custosCentavos)} />
        <StatRow
          rotulo="Resultado"
          valor={formatarMoeda(r.resultadoCentavos)}
          cor={r.resultadoCentavos < 0 ? 'danger' : 'textHeading'}
          destaque
        />
      </Card>
      {r.incluiNaoRevisados > 0 ? (
        <Banner tom="warning">
          Inclui {r.incluiNaoRevisados} não revisado
          {r.incluiNaoRevisados > 1 ? 's' : ''}.
        </Banner>
      ) : null}
      {r.foraDoTotal > 0 ? (
        <Banner tom="info">
          {r.foraDoTotal} lançamento{r.foraDoTotal > 1 ? 's' : ''} sem valor ou
          sem data fora do total.
        </Banner>
      ) : null}
      {r.improdutivos.quantidade > 0 ? (
        <Banner tom="danger">
          {r.improdutivos.quantidade} improdutiva
          {r.improdutivos.quantidade > 1 ? 's' : ''} • deixou de receber{' '}
          {formatarMoeda(r.improdutivos.deixouDeReceberCentavos)}
        </Banner>
      ) : null}
      <Card titulo="Por empresa">
        {r.porEmpresa.length === 0 ? (
          <AppText variante="small" cor="textSecondary">
            Nenhum serviço realizado no mês.
          </AppText>
        ) : (
          r.porEmpresa.map(e => (
            <ListItem
              key={e.empresaNome}
              titulo={e.empresaNome}
              subtitulo={`${e.quantidade} serviço${e.quantidade > 1 ? 's' : ''}`}
              direita={formatarMoeda(e.totalCentavos)}
            />
          ))
        )}
      </Card>
    </Screen>
  )
}
