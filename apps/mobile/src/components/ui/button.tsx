import { Pressable, View } from 'react-native'

import type { CoresPapel } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

import { Icon, type NomeIcone } from './icon'
import { AppText } from './text'

export type VarianteBotao = 'cta' | 'primary' | 'secondary' | 'ghost'

/** Um único `cta` (vermelho) por tela; o resto primary/secondary/ghost. */
export function Button({
  titulo,
  onPress,
  variante = 'primary',
  icone,
  desabilitado = false,
  testID,
  pequeno = false,
}: {
  titulo: string
  onPress?: () => void
  variante?: VarianteBotao
  icone?: NomeIcone
  desabilitado?: boolean
  testID?: string
  pequeno?: boolean
}) {
  const { cores, raio, espaco } = useTheme()
  const fundo: Record<VarianteBotao, string> = {
    cta: cores.accent,
    primary: cores.primary,
    secondary: 'transparent',
    ghost: 'transparent',
  }
  const texto: Record<VarianteBotao, keyof CoresPapel> = {
    cta: 'onAccent',
    primary: 'onPrimary',
    secondary: 'textHeading',
    ghost: 'textHeading',
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: desabilitado }}
      disabled={desabilitado}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: fundo[variante],
        borderRadius: raio.md,
        borderWidth: variante === 'secondary' ? 1 : 0,
        borderColor: cores.borderStrong,
        paddingVertical: pequeno ? espaco[1] : espaco[3],
        paddingHorizontal: pequeno ? espaco[3] : espaco[4],
        opacity: desabilitado ? 0.45 : pressed ? 0.8 : 1,
        minHeight: pequeno ? 36 : 48,
        justifyContent: 'center',
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: espaco[2],
        }}
      >
        {icone ? (
          <Icon nome={icone} tamanho={20} cor={texto[variante]} />
        ) : null}
        <AppText variante="rotulo" cor={texto[variante]}>
          {titulo}
        </AppText>
      </View>
    </Pressable>
  )
}
