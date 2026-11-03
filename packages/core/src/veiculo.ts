// TEC-47: custo por km do veículo = combustível + manutenção (centavos/km).

export type ManutencaoInput =
  | { tipo: 'porKm'; centavosPorKm: number }
  | {
      tipo: 'itens'
      itens: { descricao: string; custoCentavos: number; intervaloKm: number }[]
    }

export type CustoVeiculoInput = {
  precoLitroCentavos: number
  consumoKmPorLitro: number
  manutencao: ManutencaoInput
}

/** Valores em centavos/km, sem arredondar. */
export type CustoVeiculo = {
  combustivelPorKm: number
  manutencaoPorKm: number
  totalPorKm: number
}

function exigirNaoNegativo(valor: number, nome: string): void {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new RangeError(`${nome} inválido`)
  }
}

export function calcularCustoPorKm(i: CustoVeiculoInput): CustoVeiculo {
  exigirNaoNegativo(i.precoLitroCentavos, 'preço do litro')
  if (!Number.isFinite(i.consumoKmPorLitro) || i.consumoKmPorLitro <= 0) {
    throw new RangeError('consumo deve ser maior que zero')
  }
  const combustivelPorKm = i.precoLitroCentavos / i.consumoKmPorLitro

  let manutencaoPorKm: number
  if (i.manutencao.tipo === 'porKm') {
    exigirNaoNegativo(i.manutencao.centavosPorKm, 'manutenção')
    manutencaoPorKm = i.manutencao.centavosPorKm
  } else {
    manutencaoPorKm = 0
    for (const item of i.manutencao.itens) {
      exigirNaoNegativo(item.custoCentavos, 'custo do item')
      if (!Number.isFinite(item.intervaloKm) || item.intervaloKm <= 0) {
        throw new RangeError('intervalo deve ser maior que zero')
      }
      manutencaoPorKm += item.custoCentavos / item.intervaloKm
    }
  }

  return {
    combustivelPorKm,
    manutencaoPorKm,
    totalPorKm: combustivelPorKm + manutencaoPorKm,
  }
}
