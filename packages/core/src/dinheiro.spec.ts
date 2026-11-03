import { describe, expect, it } from 'vitest'

import { formatarCentavosPorKm, formatarMoeda, parseValorBR } from './dinheiro'

describe('formatarMoeda', () => {
  it('formata positivo com milhar', () => {
    expect(formatarMoeda(123456)).toBe('R$ 1.234,56')
    expect(formatarMoeda(123456789)).toBe('R$ 1.234.567,89')
  })

  it('formata negativo, zero e centavos', () => {
    expect(formatarMoeda(-7000)).toBe('-R$ 70,00')
    expect(formatarMoeda(0)).toBe('R$ 0,00')
    expect(formatarMoeda(5)).toBe('R$ 0,05')
  })

  it('arredonda frações para o centavo', () => {
    expect(formatarMoeda(44.666)).toBe('R$ 0,45')
  })
})

describe('formatarCentavosPorKm', () => {
  it('GWT 1: 44,666 c/km → R$ 0,45/km', () => {
    expect(formatarCentavosPorKm(44.666)).toBe('R$ 0,45/km')
  })
})

describe('parseValorBR', () => {
  it.each([
    ['1.234,56', 123456],
    ['R$ 80', 8000],
    ['80,5', 8050],
    ['80,05', 8005],
    ['1.234', 123400],
    ['0', 0],
    [' R$ 1.000.000,00 ', 100000000],
  ])('%s → %d', (entrada, esperado) => {
    expect(parseValorBR(entrada)).toBe(esperado)
  })

  it.each(['', 'abc', '1,2,3', '12.34', '-10', '10,123', 'R$'])(
    'inválido: %s → null',
    entrada => {
      expect(parseValorBR(entrada)).toBeNull()
    },
  )
})
