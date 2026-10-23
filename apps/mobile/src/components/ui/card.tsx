import type { ReactNode } from 'react'
import { View, type ViewStyle } from 'react-native'

import { sombraCard } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

import { AppText } from './text'

export function Card({
  children,
  titulo,
  style,
  testID,
}: {
  children?: ReactNode
  titulo?: string
  style?: ViewStyle
  testID?: string
}) {
  const { cores, esquema, espaco, raio } = useTheme()
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: cores.surface,
          borderRadius: raio.lg,
          borderWidth: 1,
          borderColor: cores.border,
          padding: espaco[4],
          gap: espaco[3],
        },
        sombraCard(esquema),
        style,
      ]}
    >
      {titulo ? (
        <AppText variante="h4" accessibilityRole="header">
          {titulo}
        </AppText>
      ) : null}
      {children}
    </View>
  )
}
