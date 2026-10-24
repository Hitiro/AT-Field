import {
  CATEGORIAS_DESPESA,
  ROTULOS_CATEGORIA,
  financeiro,
  formatarMoeda,
} from '@at-field/core'

import { Card } from '@/components/ui/card'
import { ListItem } from '@/components/ui/list-item'
import { Screen } from '@/components/ui/screen'
import { StatRow } from '@/components/ui/stat-row'
import { AppText } from '@/components/ui/text'
import { useHoje, useLancamentos } from '@/state/store'
import { mesDe, nomeDoMes } from '@/utils/datas'

export default function Financeiro() {
  const ls = useLancamentos()
  const mes = mesDe(useHoje())
  const f = financeiro(ls, mes)
  return (
    <Screen>
      <Card titulo="A receber">
        <AppText variante="valor">
          {formatarMoeda(f.aReceber.totalCentavos)}
        </AppText>
        <AppText variante="caption">Saldo aberto de todos os meses</AppText>
        {f.aReceber.porEmpresa.map(e => (
          <ListItem
            key={e.empresaNome}
            titulo={e.empresaNome}
            subtitulo={`${e.quantidade} serviço${e.quantidade > 1 ? 's' : ''}`}
            direita={formatarMoeda(e.totalCentavos)}
          />
        ))}
      </Card>
      <Card titulo={`Recebido em ${nomeDoMes(mes.mes).toLowerCase()}`}>
        <AppText variante="valor" cor="success">
          {formatarMoeda(f.recebidoNoMesCentavos)}
        </AppText>
      </Card>
      <Card titulo="Despesas do mês">
        {CATEGORIAS_DESPESA.map(c => (
          <StatRow
            key={c}
            rotulo={ROTULOS_CATEGORIA[c]}
            valor={formatarMoeda(f.despesasNoMes.porCategoria[c])}
          />
        ))}
        <StatRow
          rotulo="Total"
          valor={formatarMoeda(f.despesasNoMes.totalCentavos)}
          destaque
        />
      </Card>
    </Screen>
  )
}
