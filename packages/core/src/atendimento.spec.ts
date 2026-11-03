import { describe, expect, it } from 'vitest'

import {
  NEG_PROTEGE,
  NEG_SOZIC,
  NEG_SUSTENTO,
  servico,
} from './__fixtures__/dados'
import {
  sugerirAcrescimo,
  tempoDoAtendimento,
  totalDoServico,
} from './atendimento'
import type { LancamentoServico } from './lancamentos'

const chamadoSozic = (p: Partial<LancamentoServico> = {}) =>
  servico({ cobranca: { forma: 'chamado', percalMin: 120 }, ...p })

const acrescimo = (valorCentavos: number) => ({
  id: 'a1',
  motivo: 'Aguardando suporte remoto',
  minutos: 60,
  valorCentavos,
})

describe('totalDoServico', () => {
  it('soma valor base, deslocamento e acréscimos', () => {
    expect(totalDoServico(servico({ acrescimos: [acrescimo(5000)] }))).toBe(
      15000,
    )
    expect(
      totalDoServico(
        servico({
          deslocamento: { valorCentavos: 16000 },
          acrescimos: [acrescimo(2000)],
        }),
      ),
    ).toBe(28000)
  })

  it('sem valor base → undefined mesmo com acréscimo', () => {
    expect(
      totalDoServico(
        servico({ valorCentavos: undefined, acrescimos: [acrescimo(5000)] }),
      ),
    ).toBeUndefined()
  })

  it('GWT 42: pacote 150000 com material + acréscimo manual 10000 → 160000', () => {
    const pacote = servico({
      cobranca: { forma: 'pacote', incluiMaterial: true },
      valorCentavos: 150000,
    })
    expect(totalDoServico(pacote)).toBe(150000)
    expect(totalDoServico({ ...pacote, acrescimos: [acrescimo(10000)] })).toBe(
      160000,
    )
  })

  it('improdutivo sem registro → undefined', () => {
    expect(
      totalDoServico(servico({ resultado: 'improdutivo' })),
    ).toBeUndefined()
  })
})

describe('tempoDoAtendimento', () => {
  it('GWT 26: estimado 120, real 90 → −30, não excedeu', () => {
    const t = tempoDoAtendimento(
      chamadoSozic({ duracaoEstimadaMin: 120, duracaoRealMin: 90 }),
      NEG_SOZIC,
    )
    expect(t.diferencaMin).toBe(-30)
    expect(t.excedeu).toBe(false)
    expect(t.origemPrevisto).toBe('estimada')
  })

  it('GWT 28: valor 10000 + acréscimo 5000, real 180 → ganho/h 5000', () => {
    const s = servico({ acrescimos: [acrescimo(5000)], duracaoRealMin: 180 })
    expect(totalDoServico(s)).toBe(15000)
    expect(tempoDoAtendimento(s).ganhoPorHoraCentavos).toBe(5000)
  })

  it('GWT 56: real 60 + espera 60, previsto 120 → no local 120, ganho/h 5000', () => {
    const t = tempoDoAtendimento(
      chamadoSozic({
        duracaoRealMin: 60,
        espera: { minutos: 60, motivo: 'liberacao_acesso' },
      }),
      NEG_SOZIC,
    )
    expect(t.totalNoLocalMin).toBe(120)
    expect(t.esperaMin).toBe(60)
    expect(t.ganhoPorHoraCentavos).toBe(5000)
    expect(t.diferencaMin).toBe(0)
    expect(t.excedeu).toBe(false)
  })

  it('real ausente → sem diferença nem ganho', () => {
    const t = tempoDoAtendimento(servico())
    expect(t).toEqual({
      previstoMin: 120,
      origemPrevisto: 'padrao',
      esperaMin: 0,
      excedeu: false,
      ganhoPorHoraCentavos: null,
    })
  })

  it('excedeu quando passa do previsto; real 0 → ganho nulo', () => {
    expect(
      tempoDoAtendimento(chamadoSozic({ duracaoRealMin: 180 })).excedeu,
    ).toBe(true)
    expect(
      tempoDoAtendimento(servico({ duracaoRealMin: 0 })).ganhoPorHoraCentavos,
    ).toBeNull()
  })

  it('improdutivo: real ausente vale 0 e o tempo no local é a espera', () => {
    const t = tempoDoAtendimento(
      servico({
        resultado: 'improdutivo',
        improdutiva: {
          motivo: 'entrada_nao_liberada',
          registradaEm: '2026-10-22T09:40:00',
          politica: { percentual: 0, pagaDeslocamento: false },
        },
        espera: { minutos: 60, motivo: 'liberacao_acesso' },
      }),
    )
    expect(t.realMin).toBe(0)
    expect(t.totalNoLocalMin).toBe(60)
    expect(t.ganhoPorHoraCentavos).toBe(0)
  })
})

describe('sugerirAcrescimo', () => {
  it('GWT 26: real 90 ≤ percal → null', () => {
    expect(
      sugerirAcrescimo(chamadoSozic({ duracaoRealMin: 90 }), NEG_SOZIC),
    ).toBeNull()
  })

  it('GWT 27: Sozic, real 180 → 60 min, R$ 50,00; estimativa não entra', () => {
    const esperado = {
      minutos: 60,
      valorCentavos: 5000,
      motivoSugerido: 'Hora adicional',
    }
    expect(
      sugerirAcrescimo(chamadoSozic({ duracaoRealMin: 180 }), NEG_SOZIC),
    ).toEqual(esperado)
    expect(
      sugerirAcrescimo(
        chamadoSozic({ duracaoRealMin: 180, duracaoEstimadaMin: 200 }),
        NEG_SOZIC,
      ),
    ).toEqual(esperado)
  })

  it('GWT 27b: real 150 → 30/2500; real 133 → 13/1083', () => {
    expect(
      sugerirAcrescimo(chamadoSozic({ duracaoRealMin: 150 }), NEG_SOZIC),
    ).toMatchObject({
      minutos: 30,
      valorCentavos: 2500,
    })
    expect(
      sugerirAcrescimo(chamadoSozic({ duracaoRealMin: 133 }), NEG_SOZIC),
    ).toMatchObject({
      minutos: 13,
      valorCentavos: 1083,
    })
  })

  it('GWT 27c: Sustento (não paga) ou Protege (sem percal) → null', () => {
    expect(
      sugerirAcrescimo(
        servico({
          cobranca: { forma: 'chamado', percalMin: 240 },
          duracaoRealMin: 400,
        }),
        NEG_SUSTENTO,
      ),
    ).toBeNull()
    expect(
      sugerirAcrescimo(servico({ duracaoRealMin: 400 }), NEG_PROTEGE),
    ).toBeNull()
  })

  it('sem negociação ou sem real → null', () => {
    expect(sugerirAcrescimo(chamadoSozic({ duracaoRealMin: 180 }))).toBeNull()
    expect(sugerirAcrescimo(chamadoSozic(), NEG_SOZIC)).toBeNull()
  })

  it('GWT 43: vale o percal gravado (120), não o atual da negociação (240)', () => {
    const negAtual = {
      ...NEG_SOZIC,
      tarifas: { chamado: { valorCentavos: 10000, percalMin: 240 } },
    }
    expect(
      sugerirAcrescimo(chamadoSozic({ duracaoRealMin: 180 }), negAtual),
    ).toMatchObject({ minutos: 60, valorCentavos: 5000 })
  })

  it('GWT 44: hora, diária e pacote com real 300 → null', () => {
    for (const cobranca of [
      { forma: 'hora', valorHoraCentavos: 10000 },
      { forma: 'diaria', valorDiariaCentavos: 40000, diarias: 1 },
      { forma: 'pacote', incluiMaterial: false },
    ] as const) {
      expect(
        sugerirAcrescimo(servico({ cobranca, duracaoRealMin: 300 }), NEG_SOZIC),
      ).toBeNull()
    }
  })

  it('GWT 53: real 60 + espera 60 com percal 120 → null', () => {
    expect(
      sugerirAcrescimo(
        chamadoSozic({
          duracaoRealMin: 60,
          espera: { minutos: 60, motivo: 'liberacao_acesso' },
        }),
        NEG_SOZIC,
      ),
    ).toBeNull()
  })

  it('GWT 54: real 120 + espera 60 → motivo de espera', () => {
    expect(
      sugerirAcrescimo(
        chamadoSozic({
          duracaoRealMin: 120,
          espera: { minutos: 60, motivo: 'liberacao_acesso' },
        }),
        NEG_SOZIC,
      ),
    ).toEqual({
      minutos: 60,
      valorCentavos: 5000,
      motivoSugerido: 'Tempo de espera (Liberação de acesso): 60 min',
    })
  })

  it('GWT 55: real 150 sem espera → Hora adicional', () => {
    expect(
      sugerirAcrescimo(chamadoSozic({ duracaoRealMin: 150 }), NEG_SOZIC),
    ).toEqual({
      minutos: 30,
      valorCentavos: 2500,
      motivoSugerido: 'Hora adicional',
    })
  })

  it('GWT 64: improdutivo → null mesmo com excedente', () => {
    expect(
      sugerirAcrescimo(
        chamadoSozic({ duracaoRealMin: 300, resultado: 'improdutivo' }),
        NEG_SOZIC,
      ),
    ).toBeNull()
  })
})
