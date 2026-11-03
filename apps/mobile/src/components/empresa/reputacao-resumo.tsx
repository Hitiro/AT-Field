import { type Empresa, ROTULOS_MOTIVO, resumirRede } from '@at-field/core'
import { View } from 'react-native'

import { AppText } from '@/components/ui/text'
import { REDE_MOCK } from '@/mocks/rede'

/** Média com 1 casa e vírgula: 7.8 → '7,8'. */
export function mediaBR(n: number): string {
  return n.toFixed(1).replace('.', ',')
}

/** "Minha nota" + visão da rede (média só com 5+ avaliações). */
export function ReputacaoResumo({
  empresa,
  detalhado = false,
}: {
  empresa: Empresa
  detalhado?: boolean
}) {
  const rede = resumirRede(REDE_MOCK[empresa.id] ?? [])
  const minhaNota = empresa.avaliacao
    ? `Minha nota ${empresa.avaliacao.nota}`
    : 'Sem nota minha'
  const textoRede =
    rede.status === 'ok'
      ? `Rede ${mediaBR(rede.media)} • ${rede.quantidade} avaliações`
      : `Poucas avaliações (${rede.quantidade})`
  return (
    <View style={{ gap: 2 }}>
      <AppText variante="small" cor="textSecondary">
        {minhaNota} • {textoRede}
      </AppText>
      {detalhado && rede.status === 'ok'
        ? rede.motivosMaisCitados.map(m => (
            <AppText key={m.motivo} variante="caption">
              {ROTULOS_MOTIVO[m.motivo]} ({m.quantidade})
            </AppText>
          ))
        : null}
    </View>
  )
}
