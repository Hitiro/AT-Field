import { Pressable, View } from 'react-native'

import { useTheme } from '@/hooks/use-theme'

import { AppText } from './text'

export type OpcaoChip<T extends string> = {
  valor: T
  rotulo: string
  destaque?: boolean
}

function Chip({
  rotulo,
  selecionado,
  destaque,
  onPress,
}: {
  rotulo: string
  selecionado: boolean
  destaque?: boolean
  onPress: () => void
}) {
  const { cores, raio, espaco } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ selected: selecionado }}
      onPress={onPress}
      style={{
        borderRadius: raio.full,
        borderWidth: 1,
        borderStyle: destaque && !selecionado ? 'dashed' : 'solid',
        borderColor: selecionado
          ? cores.primary
          : destaque
            ? cores.warning
            : cores.borderStrong,
        backgroundColor: selecionado ? cores.primary : cores.surface,
        paddingHorizontal: espaco[3],
        paddingVertical: espaco[1] + 2,
        minHeight: 36,
        justifyContent: 'center',
      }}
    >
      <AppText variante="small" cor={selecionado ? 'onPrimary' : 'textHeading'}>
        {rotulo}
      </AppText>
    </Pressable>
  )
}

/** Seleção única; tocar no selecionado desmarca se `permiteVazio`. */
export function Chips<T extends string>({
  opcoes,
  selecionado,
  onChange,
  permiteVazio = false,
}: {
  opcoes: OpcaoChip<T>[]
  selecionado: T | undefined
  onChange: (v: T | undefined) => void
  permiteVazio?: boolean
}) {
  const { espaco } = useTheme()
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco[2] }}>
      {opcoes.map(o => (
        <Chip
          key={o.valor}
          rotulo={o.rotulo}
          destaque={o.destaque}
          selecionado={o.valor === selecionado}
          onPress={() =>
            onChange(
              o.valor === selecionado && permiteVazio ? undefined : o.valor,
            )
          }
        />
      ))}
    </View>
  )
}

/** Seleção múltipla (ex.: motivos de avaliação). */
export function ChipsMulti<T extends string>({
  opcoes,
  selecionados,
  onChange,
}: {
  opcoes: OpcaoChip<T>[]
  selecionados: T[]
  onChange: (v: T[]) => void
}) {
  const { espaco } = useTheme()
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco[2] }}>
      {opcoes.map(o => {
        const sel = selecionados.includes(o.valor)
        return (
          <Chip
            key={o.valor}
            rotulo={o.rotulo}
            destaque={o.destaque}
            selecionado={sel}
            onPress={() =>
              onChange(
                sel
                  ? selecionados.filter(s => s !== o.valor)
                  : [...selecionados, o.valor],
              )
            }
          />
        )
      })}
    </View>
  )
}
