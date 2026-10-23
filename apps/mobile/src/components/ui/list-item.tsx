import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'

import { useTheme } from '@/hooks/use-theme'

import { Icon } from './icon'
import { AppText } from './text'

export function ListItem({
  titulo,
  subtitulo,
  direita,
  extra,
  onPress,
  testID,
}: {
  titulo: string
  subtitulo?: string
  direita?: string
  extra?: ReactNode
  onPress?: () => void
  testID?: string
}) {
  const { cores, espaco } = useTheme()
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: espaco[3],
        paddingVertical: espaco[3],
        borderBottomWidth: 1,
        borderBottomColor: cores.border,
      }}
    >
      <View style={{ flex: 1, gap: espaco[1] }}>
        <AppText variante="body" cor="textHeading">
          {titulo}
        </AppText>
        {subtitulo ? (
          <AppText variante="small" cor="textSecondary">
            {subtitulo}
          </AppText>
        ) : null}
        {extra}
      </View>
      {direita ? (
        <AppText variante="body" style={{ fontVariant: ['tabular-nums'] }}>
          {direita}
        </AppText>
      ) : null}
      {onPress ? <Icon nome="avancar" tamanho={20} cor="textMuted" /> : null}
    </Pressable>
  )
}
