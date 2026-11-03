import { formatarMoeda } from '@at-field/core'

import { TextField } from './text-field'

/** Só dígitos, lidos como centavos ("8000" → R$ 80,00). Vazio = undefined, não 0. */
export function centavosDeDigitos(texto: string): number | undefined {
  const digitos = texto.replace(/\D/g, '')
  return digitos ? Number(digitos) : undefined
}

export function MoneyField({
  rotulo,
  valor,
  onChange,
  erro,
  dica,
  testID,
}: {
  rotulo: string
  valor: number | undefined
  onChange: (centavos: number | undefined) => void
  erro?: string
  dica?: string
  testID?: string
}) {
  return (
    <TextField
      testID={testID}
      rotulo={rotulo}
      value={valor === undefined ? '' : formatarMoeda(valor)}
      onChangeText={t => onChange(centavosDeDigitos(t))}
      keyboardType="number-pad"
      placeholder="R$ 0,00"
      erro={erro}
      dica={dica}
    />
  )
}
