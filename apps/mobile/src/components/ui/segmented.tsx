import { Pressable, View } from 'react-native'

import { useTheme } from '@/hooks/use-theme'

import { AppText } from './text'

export function Segmented<T extends string>({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: { valor: T; rotulo: string }[]
  valor: T
  onChange: (v: T) => void
}) {
  const { cores, raio, espaco } = useTheme()
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: cores.surfaceAlt,
        borderRadius: raio.md,
        padding: espaco[1],
        gap: espaco[1],
      }}
    >
      {opcoes.map(o => {
        const sel = o.valor === valor
        return (
          <Pressable
            key={o.valor}
            accessibilityRole="tab"
            accessibilityLabel={o.rotulo}
            accessibilityState={{ selected: sel }}
            onPress={() => onChange(o.valor)}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 40,
              borderRadius: raio.sm,
              backgroundColor: sel ? cores.surface : 'transparent',
              borderWidth: sel ? 1 : 0,
              borderColor: cores.border,
            }}
          >
            <AppText
              variante="small"
              cor={sel ? 'textHeading' : 'textSecondary'}
            >
              {o.rotulo}
            </AppText>
          </Pressable>
        )
      })}
    </View>
  )
}
