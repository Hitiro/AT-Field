import { View } from 'react-native'

import { ItemAgendaLinha, useAgenda } from '@/components/home/agenda-card'
import { Card } from '@/components/ui/card'
import { Screen } from '@/components/ui/screen'
import { AppText } from '@/components/ui/text'

export default function Agenda() {
  const grupos = useAgenda(7)
  return (
    <Screen>
      <AppText variante="small" cor="textSecondary">
        {
          'Próximos 7 dias. Duração com "~" é prevista pelo percal ou pelo padrão de 2 h.'
        }
      </AppText>
      {grupos.length === 0 ? (
        <Card>
          <AppText variante="body">Nada agendado nos próximos 7 dias.</AppText>
        </Card>
      ) : (
        grupos.map(g => (
          <Card key={g.data} titulo={g.rotulo}>
            <View>
              {g.itens.map(i => (
                <ItemAgendaLinha key={i.servico.id} item={i} />
              ))}
            </View>
          </Card>
        ))
      )}
    </Screen>
  )
}
