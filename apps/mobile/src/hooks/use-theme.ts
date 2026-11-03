import { cores, espaco, raio, tipografia } from '@/constants/theme'
import { useModoTema } from '@/theme/theme-provider'

/** Tokens de papel do esquema ativo (claro/escuro) + escalas. */
export function useTheme() {
  const { esquema, modo, setModo } = useModoTema()
  return {
    cores: cores[esquema],
    esquema,
    modo,
    setModo,
    tipografia,
    espaco,
    raio,
  }
}
