import { pendenciasDe } from '@at-field/core'
import { useRouter } from 'expo-router'

import { Card } from '@/components/ui/card'
import { ListItem } from '@/components/ui/list-item'
import { Screen } from '@/components/ui/screen'
import { AppText } from '@/components/ui/text'
import { useLancamentos } from '@/state/store'
import { diaMes } from '@/utils/datas'
import {
  ROTULOS_PENDENCIA,
  tituloLancamento,
  valorLancamento,
} from '@/utils/rotulos'

export default function Pendencias() {
  const router = useRouter()
  const aRevisar = useLancamentos().filter(l => l.status === 'a_revisar')
  return (
    <Screen>
      <AppText variante="small" cor="textSecondary">
        Lançamentos rápidos ficam aqui até você completar e confirmar.
      </AppText>
      <Card>
        {aRevisar.length === 0 ? (
          <AppText variante="body">Nada a revisar.</AppText>
        ) : (
          aRevisar.map(l => {
            const falta = pendenciasDe(l).map(p => ROTULOS_PENDENCIA[p])
            const tipo = l.tipo === 'servico' ? 'Serviço' : 'Despesa'
            const quando = l.data ? diaMes(l.data) : undefined
            return (
              <ListItem
                key={l.id}
                titulo={tituloLancamento(l)}
                subtitulo={[tipo, quando, ...falta].filter(Boolean).join(' • ')}
                direita={valorLancamento(l)}
                onPress={() =>
                  router.push({
                    pathname: '/lancamento/[id]',
                    params: { id: l.id },
                  })
                }
              />
            )
          })
        )}
      </Card>
    </Screen>
  )
}
