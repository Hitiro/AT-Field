import { View } from 'react-native'

import type { CoresPapel } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

import { AppText } from './text'

/** Linha "rótulo ........ valor". */
export function StatRow({
  rotulo,
  valor,
  cor,
  destaque = false,
}: {
  rotulo: string
  valor: string
  cor?: keyof CoresPapel
  destaque?: boolean
}) {
  const { espaco } = useTheme()
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: espaco[3],
      }}
    >
      <AppText variante="small" cor="textSecondary" style={{ flexShrink: 1 }}>
        {rotulo}
      </AppText>
      <AppText
        variante={destaque ? 'h4' : 'body'}
        cor={cor ?? 'text'}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {valor}
      </AppText>
    </View>
  )
}
