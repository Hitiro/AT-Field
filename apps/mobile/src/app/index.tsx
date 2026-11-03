import { formatarMoeda, resumoDoMes } from '@at-field/core'
import { useRouter } from 'expo-router'
import { Image, Pressable, View } from 'react-native'

import { AgendaCard } from '@/components/home/agenda-card'
import { Badge } from '@/components/ui/badge'
import { Banner } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon, type NomeIcone } from '@/components/ui/icon'
import { Screen } from '@/components/ui/screen'
import { StatRow } from '@/components/ui/stat-row'
import { AppText } from '@/components/ui/text'
import { sombraCard } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useAviso, useHoje, useLancamentos } from '@/state/store'
import type { ModoTema } from '@/theme/theme-provider'
import { mesDe, nomeDoMes } from '@/utils/datas'

const PROXIMO_MODO: Record<ModoTema, ModoTema> = {
  sistema: 'claro',
  claro: 'escuro',
  escuro: 'sistema',
}
const ROTULO_MODO: Record<ModoTema, string> = {
  sistema: 'Tema: sistema',
  claro: 'Tema: claro',
  escuro: 'Tema: escuro',
}

const logoClaro = require('@/assets/images/logo-icone.png')
const logoEscuro = require('@/assets/images/logo-icone-branca.png')

function Tile({
  titulo,
  icone,
  onPress,
  cta = false,
}: {
  titulo: string
  icone: NomeIcone
  onPress: () => void
  cta?: boolean
}) {
  const { cores, raio, espaco, esquema } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexBasis: '47%',
          flexGrow: 1,
          minHeight: 104,
          borderRadius: raio.lg,
          padding: espaco[4],
          gap: espaco[2],
          justifyContent: 'space-between',
          backgroundColor: cta ? cores.accent : cores.surface,
          borderWidth: cta ? 0 : 1,
          borderColor: cores.border,
          opacity: pressed ? 0.85 : 1,
        },
        sombraCard(esquema),
      ]}
    >
      <Icon nome={icone} tamanho={24} cor={cta ? 'onAccent' : 'textHeading'} />
      <AppText variante="h4" cor={cta ? 'onAccent' : 'textHeading'}>
        {titulo}
      </AppText>
    </Pressable>
  )
}

export default function Home() {
  const router = useRouter()
  const { esquema, modo, setModo, espaco } = useTheme()
  const ls = useLancamentos()
  const hoje = useHoje()
  const mes = mesDe(hoje)
  const resumo = resumoDoMes(ls, mes)
  const aRevisar = ls.filter(l => l.status === 'a_revisar').length
  const { aviso, setAviso } = useAviso()

  return (
    <Screen topo>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: espaco[3] }}
      >
        <Image
          source={esquema === 'escuro' ? logoEscuro : logoClaro}
          style={{ width: 32, height: 32 }}
          accessibilityIgnoresInvertColors
          accessibilityLabel="AT Solutions"
        />
        <View style={{ flex: 1 }}>
          <AppText variante="overline">AT-FIELD • PROTÓTIPO</AppText>
          <AppText variante="h1" accessibilityRole="header">
            {nomeDoMes(mes.mes)}
          </AppText>
        </View>
        <Button
          titulo={ROTULO_MODO[modo]}
          variante="ghost"
          icone="tema"
          pequeno
          onPress={() => setModo(PROXIMO_MODO[modo])}
        />
      </View>
      <Badge texto="Dados de exemplo" tom="info" />

      {aviso ? (
        <Banner tom="success" onPress={() => setAviso(undefined)}>
          {aviso}
        </Banner>
      ) : null}

      <AgendaCard />

      <Card titulo="Este mês">
        <StatRow
          rotulo="Serviço"
          valor={formatarMoeda(resumo.servicoCentavos)}
        />
        <StatRow rotulo="Custos" valor={formatarMoeda(resumo.custosCentavos)} />
        <StatRow
          rotulo="Resultado"
          valor={formatarMoeda(resumo.resultadoCentavos)}
          cor={resumo.resultadoCentavos < 0 ? 'danger' : 'textHeading'}
          destaque
        />
      </Card>

      {aRevisar > 0 ? (
        <Banner
          tom="warning"
          onPress={() => router.push('/pendencias')}
          testID="faixa-revisar"
        >
          {aRevisar === 1
            ? '1 lançamento a revisar'
            : `${aRevisar} lançamentos a revisar`}
        </Banner>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco[3] }}>
        <Tile
          titulo="Resumo do mês"
          icone="resumo"
          onPress={() => router.push('/resumo')}
        />
        <Tile
          titulo="Lançar"
          icone="lancar"
          cta
          onPress={() => router.push('/lancar')}
        />
        <Tile
          titulo="Financeiro"
          icone="financeiro"
          onPress={() => router.push('/financeiro')}
        />
        <Tile
          titulo="Simular"
          icone="simular"
          onPress={() => router.push('/simular')}
        />
      </View>

      <Button
        titulo="Colar do WhatsApp"
        variante="secondary"
        icone="whatsapp"
        onPress={() => router.push('/whatsapp')}
      />

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: espaco[2],
        }}
      >
        <Button
          titulo="Empresas"
          variante="ghost"
          pequeno
          onPress={() => router.push('/empresas')}
        />
        <AppText
          variante="small"
          cor="textMuted"
          style={{ alignSelf: 'center' }}
        >
          •
        </AppText>
        <Button
          titulo="Veículo"
          variante="ghost"
          pequeno
          onPress={() => router.push('/veiculo')}
        />
      </View>
    </Screen>
  )
}
