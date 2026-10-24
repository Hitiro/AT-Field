import { describe, expect, it } from 'vitest'

import {
  type CenarioSimulacao,
  compararCenarios,
  simular,
  validarCenario,
} from './simulador'

// Base: custo/km 100, meta 3000/h, alimentação 3000, R$ 0,80/km, pedágio 2600 pago.
const cenarioA = (p: Partial<CenarioSimulacao> = {}): CenarioSimulacao => ({
  nome: 'A Maringá',
  cobranca: {
    forma: 'chamado',
    valorCentavos: 10000,
    percalMin: 240,
    horaAdicionalCentavos: 2500,
  },
  distanciaIdaKm: 100,
  tempoIdaMin: 60,
  tempoAtendimentoMin: 60,
  deslocamento: { centavosPorKm: 80 },
  pedagio: { valorTotalCentavos: 2600, pagoPelaEmpresa: true },
  custoPorKmCentavos: 100,
  despesasPrevistas: [{ descricao: 'Alimentação', valorCentavos: 3000 }],
  valorHoraMinimoCentavos: 3000,
  ...p,
})

const cenarioB = (p: Partial<CenarioSimulacao> = {}): CenarioSimulacao => ({
  nome: 'B Londrina',
  cobranca: { forma: 'chamado', valorCentavos: 20000 },
  distanciaIdaKm: 15,
  tempoIdaMin: 20,
  tempoAtendimentoMin: 120,
  deslocamento: { centavosPorKm: 0 },
  pedagio: { valorTotalCentavos: 0, pagoPelaEmpresa: false },
  custoPorKmCentavos: 100,
  despesasPrevistas: [],
  valorHoraMinimoCentavos: 3000,
  ...p,
})

const cenarioAEF = (p: Partial<CenarioSimulacao> = {}): CenarioSimulacao =>
  cenarioB({
    nome: 'AEF por hora',
    cobranca: { forma: 'hora', valorHoraCentavos: 10000 },
    tempoAtendimentoMin: 180,
    ...p,
  })

describe('simular', () => {
  it('GWT 4 (TEC-48): ida 60 min, atendimento 60, custo 0 → 180 min, 3333/h', () => {
    const r = simular({
      nome: 'Maringá',
      cobranca: { forma: 'chamado', valorCentavos: 10000 },
      distanciaIdaKm: 100,
      tempoIdaMin: 60,
      tempoAtendimentoMin: 60,
      deslocamento: { centavosPorKm: 0 },
      pedagio: { valorTotalCentavos: 0, pagoPelaEmpresa: false },
      custoPorKmCentavos: 0,
      despesasPrevistas: [],
    })
    expect(r.minutosTotais).toBe(180)
    expect(r.ganhoPorHoraCentavos).toBe(3333)
    expect(r.veredito).toBe('compensa')
    expect(r.precoMinimo).toBeNull()
  })

  it('GWT 5: cenário A (exato)', () => {
    const r = simular(cenarioA())
    expect(r.kmRodados).toBe(200)
    expect(r.kmPagos).toBe(200)
    expect(r.receitas).toEqual({
      servico: 10000,
      deslocamento: 16000,
      reembolsoPedagio: 2600,
      horaAdicional: 0,
      total: 28600,
    })
    expect(r.custos).toEqual({
      veiculo: 20000,
      pedagio: 2600,
      despesas: 3000,
      total: 25600,
    })
    expect(r.sobraCentavos).toBe(3000)
    expect(r.ganhoPorHoraCentavos).toBe(1000)
    expect(r.saldoDeslocamentoCentavos).toBe(-7000)
    expect(r.deslocamentoCobre).toBe(false)
    expect(r.veredito).toBe('nao_compensa')
    expect(r.motivo).toBe('abaixo_valor_hora')
    expect(r.precoMinimo).toEqual({ forma: 'chamado', valorCentavos: 16000 })
    expect(r.valorHoraPercalCentavos).toBe(2500)
    expect(r.seImprodutiva).toBeNull()
  })

  it('GWT 5b: distância 110 com km médio 100', () => {
    const r = simular(
      cenarioA({
        distanciaIdaKm: 110,
        deslocamento: { centavosPorKm: 80, kmIdaPago: 100 },
      }),
    )
    expect(r.kmRodados).toBe(220)
    expect(r.kmPagos).toBe(200)
    expect(r.receitas.deslocamento).toBe(16000)
    expect(r.custos.veiculo).toBe(22000)
    expect(r.custos.total).toBe(27600)
    expect(r.sobraCentavos).toBe(1000)
    expect(r.ganhoPorHoraCentavos).toBe(333)
    expect(r.saldoDeslocamentoCentavos).toBe(-9000)
  })

  it('GWT 5c: distância 110 exata', () => {
    const r = simular(cenarioA({ distanciaIdaKm: 110 }))
    expect(r.kmPagos).toBe(220)
    expect(r.receitas.deslocamento).toBe(17600)
    expect(r.receitas.total).toBe(30200)
    expect(r.sobraCentavos).toBe(2600)
    expect(r.ganhoPorHoraCentavos).toBe(867)
    expect(r.saldoDeslocamentoCentavos).toBe(-7400)
  })

  it('GWT 5d: percal estourado gera hora adicional', () => {
    const r = simular(cenarioA({ tempoAtendimentoMin: 300 }))
    expect(r.minutosExcedentesPercal).toBe(60)
    expect(r.receitas.horaAdicional).toBe(2500)
    expect(r.receitas.total).toBe(31100)
    expect(r.sobraCentavos).toBe(5500)
    expect(r.minutosTotais).toBe(420)
    expect(r.ganhoPorHoraCentavos).toBe(786)
    expect(r.precoMinimo).toEqual({ forma: 'chamado', valorCentavos: 25500 })
  })

  it('GWT 5e: sem hora adicional paga', () => {
    const r = simular(
      cenarioA({
        tempoAtendimentoMin: 300,
        cobranca: { forma: 'chamado', valorCentavos: 10000, percalMin: 240 },
      }),
    )
    expect(r.receitas.horaAdicional).toBe(0)
    expect(r.sobraCentavos).toBe(3000)
    expect(r.ganhoPorHoraCentavos).toBe(429)
  })

  it('GWT 5f: percal 120 → valor/hora do percal 5000', () => {
    const r = simular(
      cenarioA({
        cobranca: { forma: 'chamado', valorCentavos: 10000, percalMin: 120 },
      }),
    )
    expect(r.valorHoraPercalCentavos).toBe(5000)
  })

  it('GWT 6: cenário B (2 chamados em Londrina)', () => {
    const r = simular(cenarioB())
    expect(r.custos.total).toBe(3000)
    expect(r.sobraCentavos).toBe(17000)
    expect(r.ganhoPorHoraCentavos).toBe(6375)
    expect(r.deslocamentoCobre).toBeNull()
    expect(r.veredito).toBe('compensa')
    expect(r.motivo).toBeNull()
    expect(r.precoMinimo).toEqual({ forma: 'chamado', valorCentavos: 11000 })
    expect(r.valorHoraPercalCentavos).toBeNull()
  })

  it('GWT 8: serviço 0 com custos → prejuízo', () => {
    const r = simular(
      cenarioA({ cobranca: { forma: 'chamado', valorCentavos: 0 } }),
    )
    expect(r.veredito).toBe('nao_compensa')
    expect(r.motivo).toBe('prejuizo')
  })

  it('GWT 9: pedágio não pago pela empresa fica no custo e não na receita', () => {
    const r = simular(
      cenarioA({
        pedagio: { valorTotalCentavos: 2600, pagoPelaEmpresa: false },
      }),
    )
    expect(r.receitas.reembolsoPedagio).toBe(0)
    expect(r.custos.pedagio).toBe(2600)
    expect(r.sobraCentavos).toBe(400)
  })

  it('sem meta: compensa com sobra positiva e sem preço mínimo', () => {
    const r = simular(cenarioA({ valorHoraMinimoCentavos: undefined }))
    expect(r.veredito).toBe('compensa')
    expect(r.precoMinimo).toBeNull()
  })

  it('tempo total 0 → ganho/h e preço mínimo nulos', () => {
    const r = simular(cenarioB({ tempoIdaMin: 0, tempoAtendimentoMin: 0 }))
    expect(r.ganhoPorHoraCentavos).toBeNull()
    expect(r.precoMinimo).toBeNull()
  })

  it('preço mínimo nunca negativo', () => {
    const r = simular(
      cenarioA({
        deslocamento: { centavosPorKm: 500 },
        valorHoraMinimoCentavos: 0,
      }),
    )
    expect(r.precoMinimo).toEqual({ forma: 'chamado', valorCentavos: 0 })
  })

  describe('formas de cobrança (Parte D)', () => {
    it('GWT 46: por hora (AEF)', () => {
      const r = simular(cenarioAEF())
      expect(r.receitas.servico).toBe(30000)
      expect(r.custos.total).toBe(3000)
      expect(r.sobraCentavos).toBe(27000)
      expect(r.minutosTotais).toBe(220)
      expect(r.ganhoPorHoraCentavos).toBe(7364)
      expect(r.precoMinimo).toEqual({ forma: 'hora', valorCentavos: 4667 })
      expect(r.valorHoraPercalCentavos).toBeNull()
      expect(r.veredito).toBe('compensa')
    })

    it('por hora sem tempo no local → preço mínimo nulo', () => {
      const r = simular(cenarioAEF({ tempoAtendimentoMin: 0 }))
      expect(r.precoMinimo).toBeNull()
    })

    it('GWT 47: pacote com material como despesa prevista', () => {
      const r = simular(
        cenarioB({
          cobranca: { forma: 'pacote', valorCentavos: 150000 },
          despesasPrevistas: [{ descricao: 'Material', valorCentavos: 60000 }],
        }),
      )
      expect(r.receitas.servico).toBe(150000)
      expect(r.custos.total).toBe(63000)
      expect(r.sobraCentavos).toBe(87000)
      expect(r.precoMinimo?.forma).toBe('pacote')
    })

    it('GWT 48: diária 2 × 40000', () => {
      const r = simular(
        cenarioB({
          cobranca: { forma: 'diaria', valorDiariaCentavos: 40000, diarias: 2 },
        }),
      )
      expect(r.receitas.servico).toBe(80000)
      // total mínimo = 3000·160/60 + 3000 = 11000 → ÷ 2
      expect(r.precoMinimo).toEqual({ forma: 'diaria', valorCentavos: 5500 })
    })

    it('GWT 49/62: regressão dos cenários 5–7 e 46 sem espera', () => {
      expect(simular(cenarioA()).sobraCentavos).toBe(3000)
      expect(simular(cenarioB()).ganhoPorHoraCentavos).toBe(6375)
      expect(simular(cenarioAEF()).ganhoPorHoraCentavos).toBe(7364)
      expect(simular(cenarioA({ esperaPrevistaMin: 0 }))).toEqual(
        simular(cenarioA()),
      )
    })
  })

  describe('espera prevista (Parte E)', () => {
    it('GWT 58: percal 120 + espera 120 → excedente 60', () => {
      const r = simular(
        cenarioA({
          cobranca: {
            forma: 'chamado',
            valorCentavos: 10000,
            percalMin: 120,
            horaAdicionalCentavos: 2500,
          },
          esperaPrevistaMin: 120,
        }),
      )
      expect(r.minutosNoLocal).toBe(180)
      expect(r.minutosExcedentesPercal).toBe(60)
      expect(r.receitas.horaAdicional).toBe(2500)
      expect(r.minutosTotais).toBe(300)
      expect(r.sobraCentavos).toBe(5500)
      expect(r.ganhoPorHoraCentavos).toBe(1100)
    })

    it('GWT 58b: percal 240 + espera 60 → sem excedente', () => {
      const r = simular(cenarioA({ esperaPrevistaMin: 60 }))
      expect(r.minutosExcedentesPercal).toBe(0)
      expect(r.minutosTotais).toBe(240)
      expect(r.sobraCentavos).toBe(3000)
      expect(r.ganhoPorHoraCentavos).toBe(750)
    })

    it('GWT 59: por hora com espera 60', () => {
      const r = simular(cenarioAEF({ esperaPrevistaMin: 60 }))
      expect(r.receitas.servico).toBe(40000)
      expect(r.minutosTotais).toBe(280)
      expect(r.sobraCentavos).toBe(37000)
      expect(r.ganhoPorHoraCentavos).toBe(7929)
      // total mínimo = 3000·280/60 + 3000 = 17000 → ceil(17000·60/240)
      expect(r.precoMinimo).toEqual({ forma: 'hora', valorCentavos: 4250 })
    })
  })

  describe('se for improdutiva (Parte F)', () => {
    it('GWT 70: Sozic { 50, true }', () => {
      const r = simular(
        cenarioA({ improdutiva: { percentual: 50, pagaDeslocamento: true } }),
      )
      expect(r.seImprodutiva).toEqual({
        receitaCentavos: 23600,
        sobraCentavos: -2000,
        ganhoPorHoraCentavos: -1000,
      })
      expect(r.sobraCentavos).toBe(3000)
    })

    it('GWT 70b: Protege { 0, false }', () => {
      const r = simular(
        cenarioA({ improdutiva: { percentual: 0, pagaDeslocamento: false } }),
      )
      expect(r.seImprodutiva).toEqual({
        receitaCentavos: 0,
        sobraCentavos: -25600,
        ganhoPorHoraCentavos: -12800,
      })
    })

    it('GWT 70c: Central { 100, true }; números principais inalterados', () => {
      const com = simular(
        cenarioA({ improdutiva: { percentual: 100, pagaDeslocamento: true } }),
      )
      expect(com.seImprodutiva).toEqual({
        receitaCentavos: 28600,
        sobraCentavos: 3000,
        ganhoPorHoraCentavos: 1500,
      })
      const { seImprodutiva: _x, ...principais } = com
      const { seImprodutiva: _y, ...semPolitica } = simular(cenarioA())
      expect(principais).toEqual(semPolitica)
    })

    it('por hora: base da improdutiva é a espera prevista; sem minutos → ganho nulo', () => {
      const r = simular(
        cenarioAEF({
          esperaPrevistaMin: 60,
          improdutiva: { percentual: 50, pagaDeslocamento: false },
        }),
      )
      expect(r.seImprodutiva?.receitaCentavos).toBe(5000)
      const zero = simular(
        cenarioAEF({
          tempoIdaMin: 0,
          improdutiva: { percentual: 50, pagaDeslocamento: false },
        }),
      )
      expect(zero.seImprodutiva?.ganhoPorHoraCentavos).toBeNull()
    })
  })
})

describe('compararCenarios', () => {
  it('GWT 7: A × B → B melhor', () => {
    const c = compararCenarios(cenarioA(), cenarioB())
    expect(c.melhor).toBe('b')
    expect(c.diferencaSobraCentavos).toBe(14000)
    expect(c.diferencaGanhoPorHoraCentavos).toBe(5375)
  })

  it('igual → empate; invertido → a', () => {
    expect(compararCenarios(cenarioA(), cenarioA()).melhor).toBe('empate')
    expect(compararCenarios(cenarioB(), cenarioA()).melhor).toBe('a')
  })

  it('ganho/h nulo em um dos lados → diferença nula', () => {
    const c = compararCenarios(
      cenarioB({ tempoIdaMin: 0, tempoAtendimentoMin: 0 }),
      cenarioB(),
    )
    expect(c.diferencaGanhoPorHoraCentavos).toBeNull()
  })
})

describe('validarCenario', () => {
  const campos = (c: CenarioSimulacao) => validarCenario(c).map(e => e.campo)

  it('cenário válido não tem erros', () => {
    expect(validarCenario(cenarioA())).toEqual([])
  })

  it('GWT 11: kmIdaPago −1 ou percal 0 → erro; simular lança RangeError', () => {
    const km = cenarioA({ deslocamento: { centavosPorKm: 80, kmIdaPago: -1 } })
    expect(campos(km)).toEqual(['deslocamento.kmIdaPago'])
    expect(() => simular(km)).toThrow(RangeError)
    const percal = cenarioA({
      cobranca: { forma: 'chamado', valorCentavos: 10000, percalMin: 0 },
    })
    expect(campos(percal)).toEqual(['cobranca.percalMin'])
    expect(() => simular(percal)).toThrow(RangeError)
  })

  it('acusa nome vazio, negativos, não finitos e limites', () => {
    expect(
      campos(
        cenarioA({
          nome: ' ',
          distanciaIdaKm: 2001,
          tempoIdaMin: 1441,
          tempoAtendimentoMin: Number.NaN,
          custoPorKmCentavos: -1,
          valorHoraMinimoCentavos: Number.POSITIVE_INFINITY,
          despesasPrevistas: [{ descricao: 'x', valorCentavos: -5 }],
          pedagio: { valorTotalCentavos: -1, pagoPelaEmpresa: true },
        }),
      ),
    ).toEqual([
      'nome',
      'distanciaIdaKm',
      'tempoIdaMin',
      'tempoAtendimentoMin',
      'pedagio.valorTotalCentavos',
      'custoPorKmCentavos',
      'valorHoraMinimoCentavos',
      'despesasPrevistas.0.valorCentavos',
    ])
  })

  it('GWT 60: espera prevista −1 ou > 1440 → erro', () => {
    expect(campos(cenarioA({ esperaPrevistaMin: -1 }))).toEqual([
      'esperaPrevistaMin',
    ])
    expect(campos(cenarioA({ esperaPrevistaMin: 1441 }))).toEqual([
      'esperaPrevistaMin',
    ])
  })

  it('acusa hora adicional negativa, diárias ≤ 0, valores por forma e política', () => {
    expect(
      campos(
        cenarioA({
          cobranca: {
            forma: 'chamado',
            valorCentavos: -1,
            horaAdicionalCentavos: -1,
          },
        }),
      ),
    ).toEqual(['cobranca.valorCentavos', 'cobranca.horaAdicionalCentavos'])
    expect(
      campos(
        cenarioB({
          cobranca: { forma: 'diaria', valorDiariaCentavos: -1, diarias: 0 },
        }),
      ),
    ).toEqual(['cobranca.valorDiariaCentavos', 'cobranca.diarias'])
    expect(
      campos(cenarioB({ cobranca: { forma: 'hora', valorHoraCentavos: -1 } })),
    ).toEqual(['cobranca.valorHoraCentavos'])
    expect(
      campos(cenarioB({ cobranca: { forma: 'pacote', valorCentavos: -1 } })),
    ).toEqual(['cobranca.valorCentavos'])
    expect(
      campos(
        cenarioA({ improdutiva: { percentual: 101, pagaDeslocamento: false } }),
      ),
    ).toEqual(['improdutiva.percentual'])
    expect(campos(cenarioA({ deslocamento: { centavosPorKm: -1 } }))).toEqual([
      'deslocamento.centavosPorKm',
    ])
  })
})
