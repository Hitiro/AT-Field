import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'

import type { CoresPapel } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

import { Icon } from './icon'
import { AppText } from './text'

type Tom = 'warning' | 'danger' | 'success' | 'info'

/** Faixa de aviso (warning/danger/…) com borda lateral; opcionalmente tocável. */
export function Banner({
  tom,
  children,
  onPress,
  testID,
}: {
  tom: Tom
  children: ReactNode
  onPress?: () => void
  testID?: string
}) {
  const { cores, raio, espaco } = useTheme()
  const cor: keyof CoresPapel = tom
  const conteudo = (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: espaco[2],
        backgroundColor: cores.surface,
        borderWidth: 1,
        borderColor: cores[cor],
        borderLeftWidth: 4,
        borderRadius: raio.md,
        padding: espaco[3],
      }}
    >
      <Icon
        nome={tom === 'success' ? 'check' : 'aviso'}
        tamanho={20}
        cor={cor}
      />
      <AppText
        variante="small"
        cor={tom === 'info' ? 'text' : cor}
        style={{ flex: 1 }}
      >
        {children}
      </AppText>
      {onPress ? <Icon nome="avancar" tamanho={20} cor={cor} /> : null}
    </View>
  )
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {conteudo}
    </Pressable>
  ) : (
    conteudo
  )
}
