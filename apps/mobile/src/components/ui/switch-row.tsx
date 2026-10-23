import { Switch, View } from 'react-native'

import { useTheme } from '@/hooks/use-theme'

import { AppText } from './text'

export function SwitchRow({
  rotulo,
  valor,
  onChange,
  dica,
}: {
  rotulo: string
  valor: boolean
  onChange: (v: boolean) => void
  dica?: string
}) {
  const { cores, espaco } = useTheme()
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: espaco[3] }}
    >
      <View style={{ flex: 1 }}>
        <AppText variante="body">{rotulo}</AppText>
        {dica ? <AppText variante="caption">{dica}</AppText> : null}
      </View>
      <Switch
        accessibilityLabel={rotulo}
        value={valor}
        onValueChange={onChange}
        trackColor={{ true: cores.info, false: cores.border }}
        thumbColor={cores.surface}
      />
    </View>
  )
}
