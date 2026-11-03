import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react'

import type { Esquema } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'

export type ModoTema = 'sistema' | 'claro' | 'escuro'

type ContextoTema = {
  modo: ModoTema
  setModo: (m: ModoTema) => void
  esquema: Esquema
}

const TemaContext = createContext<ContextoTema | null>(null)

export function ThemeProvider({
  children,
  modoInicial = 'sistema',
}: {
  children: ReactNode
  modoInicial?: ModoTema
}) {
  const [modo, setModo] = useState<ModoTema>(modoInicial)
  const sistema = useColorScheme()
  const esquema: Esquema =
    modo === 'sistema' ? (sistema === 'dark' ? 'escuro' : 'claro') : modo
  const valor = useMemo(() => ({ modo, setModo, esquema }), [modo, esquema])
  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>
}

export function useModoTema(): ContextoTema {
  const ctx = useContext(TemaContext)
  if (!ctx) throw new Error('useModoTema fora do ThemeProvider')
  return ctx
}
