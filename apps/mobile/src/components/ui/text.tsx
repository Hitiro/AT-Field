import { Text, type TextProps } from 'react-native'

import type { CoresPapel, VarianteTexto } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

const COR_PADRAO: Partial<Record<VarianteTexto, keyof CoresPapel>> = {
  display: 'textHeading',
  h1: 'textHeading',
  h2: 'textHeading',
  h3: 'textHeading',
  h4: 'textHeading',
  overline: 'textAccent',
  caption: 'textMuted',
  valor: 'textHeading',
  rotulo: 'textSecondary',
}

export type AppTextProps = TextProps & {
  variante?: VarianteTexto
  cor?: keyof CoresPapel
}

/** Texto com as variantes tipográficas do design system. */
export function AppText({
  variante = 'body',
  cor,
  style,
  ...props
}: AppTextProps) {
  const { cores, tipografia } = useTheme()
  const corFinal = cores[cor ?? COR_PADRAO[variante] ?? 'text']
  return (
    <Text
      {...props}
      style={[tipografia[variante], { color: corFinal }, style]}
    />
  )
}
