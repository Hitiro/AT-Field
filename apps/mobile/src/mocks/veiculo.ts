import { calcularCustoPorKm } from '@at-field/core'

export type Veiculo = {
  precoLitroCentavos: number
  consumoKmPorLitro: number
  manutencaoCentavosPorKm: number
}

/** R$ 6,70 o litro, 15 km/l, manutenção R$ 0,30/km (TEC-47). */
export const VEICULO_MOCK: Veiculo = {
  precoLitroCentavos: 670,
  consumoKmPorLitro: 15,
  manutencaoCentavosPorKm: 30,
}

export function custoDoVeiculo(v: Veiculo) {
  return calcularCustoPorKm({
    precoLitroCentavos: v.precoLitroCentavos,
    consumoKmPorLitro: v.consumoKmPorLitro,
    manutencao: { tipo: 'porKm', centavosPorKm: v.manutencaoCentavosPorKm },
  })
}
