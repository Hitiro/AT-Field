import { resumirRede } from '@at-field/core'
import { useRouter } from 'expo-router'
import { View } from 'react-native'

import { mediaBR } from '@/components/empresa/reputacao-resumo'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ListItem } from '@/components/ui/list-item'
import { Screen } from '@/components/ui/screen'
import { AppText } from '@/components/ui/text'
import { REDE_MOCK } from '@/mocks/rede'
import { useEmpresas } from '@/state/store'

export default function Empresas() {
  const router = useRouter()
  const empresas = useEmpresas()
  return (
    <Screen>
      <AppText variante="small" cor="textSecondary">
        Negociação, sua nota (privada) e o que a rede acha de cada empresa.
      </AppText>
      <Card>
        {empresas.map(e => {
          const rede = resumirRede(REDE_MOCK[e.id] ?? [])
          const textoRede =
            rede.status === 'ok'
              ? `rede ${mediaBR(rede.media)} (${rede.quantidade})`
              : `poucas avaliações (${rede.quantidade})`
          const minha = e.avaliacao
            ? `minha nota ${e.avaliacao.nota}`
            : 'sem nota minha'
          return (
            <ListItem
              key={e.id}
              titulo={e.nome}
              subtitulo={`${minha} • ${textoRede}`}
              extra={
                e.naoAtendo ? (
                  <View>
                    <Badge texto="não atendo" tom="danger" />
                  </View>
                ) : undefined
              }
              onPress={() =>
                router.push({ pathname: '/empresa/[id]', params: { id: e.id } })
              }
            />
          )
        })}
      </Card>
    </Screen>
  )
}
