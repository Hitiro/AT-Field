import { TextInput, type TextInputProps, View } from 'react-native'

import { useTheme } from '@/hooks/use-theme'

import { AppText } from './text'

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  rotulo: string
  erro?: string
  dica?: string
}

/** Campo de texto com rótulo, dica e erro (em `danger`) sob o campo. */
export function TextField({
  rotulo,
  erro,
  dica,
  multiline,
  ...props
}: TextFieldProps) {
  const { cores, raio, espaco, tipografia } = useTheme()
  return (
    <View style={{ gap: espaco[1] }}>
      <AppText variante="rotulo">{rotulo}</AppText>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={cores.textMuted}
        multiline={multiline}
        {...props}
        style={[
          tipografia.body,
          {
            color: cores.text,
            backgroundColor: cores.surface,
            borderWidth: 1,
            borderColor: erro ? cores.danger : cores.borderStrong,
            borderRadius: raio.md,
            paddingHorizontal: espaco[3],
            paddingVertical: espaco[2],
            minHeight: multiline ? 160 : 48,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
      />
      {erro ? (
        <AppText variante="small" cor="danger">
          {erro}
        </AppText>
      ) : dica ? (
        <AppText variante="caption">{dica}</AppText>
      ) : null}
    </View>
  )
}
