import type { Empresa, Lancamento } from '@at-field/core'
import { render } from '@testing-library/react-native'
import { type ReactElement, type ReactNode, useEffect } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import type { Estado } from '@/state/reducer'
import { StoreProvider, useEmpresas, useLancamentos } from '@/state/store'
import { ThemeProvider } from '@/theme/theme-provider'

/** Quinta-feira; os mocks são relativos a esta data. */
export const HOJE = '2026-10-22'

/** Veículo com custo de exatamente R$ 1,00/km (100 centavos). */
export const VEICULO_100 = {
  precoLitroCentavos: 1000,
  consumoKmPorLitro: 10,
  manutencaoCentavosPorKm: 0,
}

/** Último estado visto pelo componente espião. */
export const espiao: { lancamentos: Lancamento[]; empresas: Empresa[] } = {
  lancamentos: [],
  empresas: [],
}

function Espiao() {
  const lancamentos = useLancamentos()
  const empresas = useEmpresas()
  useEffect(() => {
    Object.assign(espiao, { lancamentos, empresas })
  })
  return null
}

const metricas = {
  frame: { x: 0, y: 0, width: 360, height: 800 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
}

/** Renderiza uma tela com tema + store (sem _layout e sem fontes). */
export function renderTela(
  ui: ReactElement,
  opts: { estadoInicial?: Partial<Estado> } = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SafeAreaProvider initialMetrics={metricas}>
        <ThemeProvider modoInicial="claro">
          <StoreProvider hoje={HOJE} estadoInicial={opts.estadoInicial}>
            {children}
            <Espiao />
          </StoreProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    )
  }
  return render(ui, { wrapper: Wrapper })
}
