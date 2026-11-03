import {
  type GrupoAgenda,
  type ItemAgenda,
  agendaDosProximosDias,
} from '@at-field/core'
import { useRouter } from 'expo-router'
import { Pressable, View } from 'react-native'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AppText } from '@/components/ui/text'
import { useTheme } from '@/hooks/use-theme'
import { useEmpresas, useHoje, useLancamentos } from '@/state/store'
import { rotuloDuracao } from '@/utils/rotulos'

export function useAgenda(dias = 7): GrupoAgenda[] {
  const ls = useLancamentos()
  const empresas = useEmpresas()
  const hoje = useHoje()
  return agendaDosProximosDias(ls, hoje, dias, empresas)
}

/** Linha da agenda: horário • empresa • cidade • duração + badges. */
export function ItemAgendaLinha({ item }: { item: ItemAgenda }) {
  const router = useRouter()
  const empresas = useEmpresas()
  const { espaco, cores } = useTheme()
  const s = item.servico
  const naoAtendo = empresas.find(e => e.id === s.empresaId)?.naoAtendo
  const horario = item.inicio ? `${item.inicio}–${item.fim}` : 'a combinar'
  const partes = [
    s.empresaNome ?? 'Sem empresa',
    s.cidade?.nome,
    rotuloDuracao(item),
  ]
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: '/lancamento/[id]', params: { id: s.id } })
      }
      style={{
        gap: espaco[1],
        paddingVertical: espaco[2],
        borderTopWidth: 1,
        borderTopColor: cores.border,
      }}
    >
      <AppText variante="body" cor="textHeading">
        {horario} • {partes.filter(Boolean).join(' • ')}
      </AppText>
      {s.status === 'a_revisar' || item.emConflito || naoAtendo ? (
        <View
          style={{ flexDirection: 'row', gap: espaco[2], flexWrap: 'wrap' }}
        >
          {s.status === 'a_revisar' ? (
            <Badge texto="a revisar" tom="warning" />
          ) : null}
          {item.emConflito ? <Badge texto="conflito" tom="danger" /> : null}
          {naoAtendo ? <Badge texto="não atendo" tom="danger" /> : null}
        </View>
      ) : null}
    </Pressable>
  )
}

/** Card da Home: Hoje e Amanhã, até 3 itens cada. */
export function AgendaCard() {
  const router = useRouter()
  const grupos = useAgenda(2)
  return (
    <Card titulo="Agenda" testID="agenda-card">
      {grupos.length === 0 ? (
        <AppText variante="small" cor="textSecondary">
          Nada agendado para hoje e amanhã
        </AppText>
      ) : (
        grupos.map(g => (
          <View key={g.data}>
            <AppText variante="overline">{g.rotulo}</AppText>
            {g.itens.slice(0, 3).map(i => (
              <ItemAgendaLinha key={i.servico.id} item={i} />
            ))}
          </View>
        ))
      )}
      <Button
        titulo="Ver agenda"
        variante="ghost"
        icone="agenda"
        onPress={() => router.push('/agenda')}
      />
    </Card>
  )
}
