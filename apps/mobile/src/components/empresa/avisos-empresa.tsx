import {
  type Empresa,
  type FormaCobranca,
  avisosDaEmpresa,
  textoAviso,
} from '@at-field/core'
import { View } from 'react-native'

import { Banner } from '@/components/ui/banner'

/** Avisos antes de aceitar: "não atendo" (danger) e percal (warning). Não bloqueiam. */
export function AvisosEmpresa({
  empresa,
  nome,
  forma,
}: {
  empresa: Empresa | undefined
  /** Nome quando a empresa não é cadastrada. */
  nome?: string
  forma?: FormaCobranca
}) {
  const avisos = avisosDaEmpresa(empresa, forma)
  if (!avisos.length) return null
  const nomeEmpresa = empresa?.nome ?? nome ?? 'a empresa'
  return (
    <View style={{ gap: 8 }}>
      {avisos.map(a => (
        <Banner key={a} tom={a === 'nao_atendo' ? 'danger' : 'warning'}>
          {textoAviso(a, nomeEmpresa)}
        </Banner>
      ))}
    </View>
  )
}
