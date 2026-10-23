import { describe, expect, it } from 'vitest'

import { formatarCentavosPorKm } from './dinheiro'
import { calcularCustoPorKm } from './veiculo'

describe('calcularCustoPorKm (TEC-47)', () => {
  it('GWT 1: R$ 6,70 e 15 km/l, manutenção 0 → ≈ 44,667 c/km', () => {
    const r = calcularCustoPorKm({
      precoLitroCentavos: 670,
      consumoKmPorLitro: 15,
      manutencao: { tipo: 'porKm', centavosPorKm: 0 },
    })
    expect(r.combustivelPorKm).toBeCloseTo(44.667, 3)
    expect(r.totalPorKm).toBeCloseTo(44.667, 3)
    expect(formatarCentavosPorKm(r.combustivelPorKm)).toBe('R$ 0,45/km')
  })

  it('GWT 2: R$ 7,00, 10 km/l, manutenção 30 → total 100', () => {
    expect(
      calcularCustoPorKm({
        precoLitroCentavos: 700,
        consumoKmPorLitro: 10,
        manutencao: { tipo: 'porKm', centavosPorKm: 30 },
      }),
    ).toEqual({ combustivelPorKm: 70, manutencaoPorKm: 30, totalPorKm: 100 })
  })

  it('GWT 3: óleo R$ 200 a cada 3.000 km → ≈ 6,667 c/km', () => {
    const r = calcularCustoPorKm({
      precoLitroCentavos: 700,
      consumoKmPorLitro: 10,
      manutencao: {
        tipo: 'itens',
        itens: [{ descricao: 'Óleo', custoCentavos: 20000, intervaloKm: 3000 }],
      },
    })
    expect(r.manutencaoPorKm).toBeCloseTo(6.667, 3)
    expect(formatarCentavosPorKm(r.manutencaoPorKm)).toBe('R$ 0,07/km')
  })

  it('soma vários itens', () => {
    const r = calcularCustoPorKm({
      precoLitroCentavos: 0,
      consumoKmPorLitro: 10,
      manutencao: {
        tipo: 'itens',
        itens: [
          { descricao: 'Óleo', custoCentavos: 20000, intervaloKm: 2000 },
          { descricao: 'Pneu', custoCentavos: 100000, intervaloKm: 50000 },
        ],
      },
    })
    expect(r.manutencaoPorKm).toBe(12)
  })

  it('lança RangeError com consumo ≤ 0, intervalo ≤ 0 ou valor negativo', () => {
    const base = {
      precoLitroCentavos: 670,
      consumoKmPorLitro: 15,
      manutencao: { tipo: 'porKm', centavosPorKm: 0 } as const,
    }
    expect(() => calcularCustoPorKm({ ...base, consumoKmPorLitro: 0 })).toThrow(
      RangeError,
    )
    expect(() =>
      calcularCustoPorKm({ ...base, precoLitroCentavos: -1 }),
    ).toThrow(RangeError)
    expect(() =>
      calcularCustoPorKm({
        ...base,
        manutencao: { tipo: 'porKm', centavosPorKm: -5 },
      }),
    ).toThrow(RangeError)
    expect(() =>
      calcularCustoPorKm({
        ...base,
        manutencao: {
          tipo: 'itens',
          itens: [{ descricao: 'x', custoCentavos: 100, intervaloKm: 0 }],
        },
      }),
    ).toThrow(RangeError)
    expect(() =>
      calcularCustoPorKm({
        ...base,
        manutencao: {
          tipo: 'itens',
          itens: [{ descricao: 'x', custoCentavos: -100, intervaloKm: 10 }],
        },
      }),
    ).toThrow(RangeError)
  })
})
