import { View } from 'react-native'

import type { CoresPapel } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

import { AppText } from './text'

export type TomBadge = 'warning' | 'danger' | 'success' | 'info' | 'neutro'

const COR: Record<TomBadge, keyof CoresPapel> = {
  warning: 'warning',
  danger: 'danger',
  success: 'success',
  info: 'info',
  neutro: 'textSecondary',
}

/** Rótulo curto em caixa alta, com borda na cor do tom. */
export function Badge({
  texto,
  tom = 'neutro',
}: {
  texto: string
  tom?: TomBadge
}) {
  const { cores, raio, espaco } = useTheme()
  const cor = COR[tom]
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: cores[cor],
        borderRadius: raio.full,
        paddingHorizontal: espaco[2],
        paddingVertical: 1,
      }}
    >
      <AppText
        variante="caption"
        cor={cor}
        style={{ textTransform: 'uppercase' }}
      >
        {texto}
      </AppText>
    </View>
  )
}
