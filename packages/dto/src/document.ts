const onlyDigits = (value: string) => value.replace(/\D/g, '')

const calcDigit = (digits: number[], weights: number[]) => {
  const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0)
  const rest = sum % 11
  return rest < 2 ? 0 : 11 - rest
}

export const normalizeDocument = onlyDigits

export const isValidCpf = (value: string): boolean => {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const d = cpf.split('').map(Number)
  const first = calcDigit(d.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = calcDigit(d.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
  return first === d[9] && second === d[10]
}

export const isValidCnpj = (value: string): boolean => {
  const cnpj = onlyDigits(value)
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false
  const d = cnpj.split('').map(Number)
  const first = calcDigit(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = calcDigit(
    d.slice(0, 13),
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  )
  return first === d[12] && second === d[13]
}
