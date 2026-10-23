import { type AndroidSymbol, type SFSymbol, SymbolView } from 'expo-symbols'

import type { CoresPapel } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

type Simbolo = { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol }

// SF Symbols no iOS; Material Symbols (outlined) no Android/web. Os nomes são
// tipados: o tsc acusa nome inexistente.
export const ICONES = {
  resumo: { ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' },
  lancar: { ios: 'plus.circle', android: 'add_circle', web: 'add_circle' },
  financeiro: { ios: 'banknote', android: 'payments', web: 'payments' },
  simular: { ios: 'car', android: 'directions_car', web: 'directions_car' },
  whatsapp: {
    ios: 'doc.on.clipboard',
    android: 'content_paste',
    web: 'content_paste',
  },
  pendencia: {
    ios: 'exclamationmark.circle',
    android: 'error',
    web: 'error',
  },
  agenda: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  empresas: { ios: 'building.2', android: 'domain', web: 'domain' },
  veiculo: {
    ios: 'fuelpump',
    android: 'local_gas_station',
    web: 'local_gas_station',
  },
  tema: { ios: 'circle.lefthalf.filled', android: 'contrast', web: 'contrast' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  editar: { ios: 'pencil', android: 'edit', web: 'edit' },
  voltar: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  avancar: {
    ios: 'chevron.right',
    android: 'chevron_right',
    web: 'chevron_right',
  },
  remover: { ios: 'trash', android: 'delete', web: 'delete' },
  aviso: {
    ios: 'exclamationmark.triangle',
    android: 'warning',
    web: 'warning',
  },
} as const satisfies Record<string, Simbolo>

export type NomeIcone = keyof typeof ICONES

export function Icon({
  nome,
  tamanho = 24,
  cor = 'textHeading',
}: {
  nome: NomeIcone
  tamanho?: number
  cor?: keyof CoresPapel
}) {
  const { cores } = useTheme()
  return (
    <SymbolView
      name={ICONES[nome]}
      size={tamanho}
      tintColor={cores[cor]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  )
}
