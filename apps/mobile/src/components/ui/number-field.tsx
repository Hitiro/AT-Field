import { useState } from 'react'

import { lerInteiro } from '@/utils/datas'

import { TextField } from './text-field'

/**
 * Campo de inteiro (minutos, km, diárias). Mantém o texto digitado e só avisa
 * `onChange` com número válido dentro de [min, max] ou `undefined` (vazio).
 */
export function NumberField({
  rotulo,
  valor,
  onChange,
  min = 0,
  max = 1440,
  dica,
  placeholder,
  testID,
}: {
  rotulo: string
  valor: number | undefined
  onChange: (v: number | undefined) => void
  min?: number
  max?: number
  dica?: string
  placeholder?: string
  testID?: string
}) {
  const [texto, setTexto] = useState(valor === undefined ? '' : String(valor))
  const n = lerInteiro(texto)
  const erro =
    n !== undefined && (Number.isNaN(n) || n < min || n > max)
      ? `Informe um número de ${min} a ${max}`
      : undefined
  return (
    <TextField
      testID={testID}
      rotulo={rotulo}
      value={texto}
      onChangeText={t => {
        setTexto(t)
        const v = lerInteiro(t)
        if (v === undefined || (!Number.isNaN(v) && v >= min && v <= max))
          onChange(v)
      }}
      keyboardType="number-pad"
      erro={erro}
      dica={dica}
      placeholder={placeholder}
    />
  )
}
