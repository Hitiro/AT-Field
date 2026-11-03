import { describe, expect, it } from 'vitest'

import { NEG_AEF, NEG_SOZIC, servico } from './__fixtures__/dados'
import {
  minutosCobradosPorHora,
  novaCobranca,
  valorBaseDoServico,
} from './cobranca'
import { pendenciasDe } from './lancamentos'

describe('novaCobranca', () => {
  it('GWT 45: AEF → por hora com R$ 100,00/h; com chamado → sem valor nem percal', () => {
    expect(novaCobranca(NEG_AEF)).toEqual({
      cobranca: { forma: 'hora', valorHoraCentavos: 10000 },
    })
    expect(novaCobranca(NEG_AEF, 'chamado')).toEqual({
      cobranca: { forma: 'chamado' },
    })
  })

  it('chamado usa a tarifa (valor e percal)', () => {
    expect(novaCobranca(NEG_SOZIC)).toEqual({
      cobranca: { forma: 'chamado', percalMin: 120 },
      valorCentavos: 10000,
    })
  })

  it('diária com 1 diária; pacote sem valor; sem negociação → chamado vazio', () => {
    expect(novaCobranca(NEG_AEF, 'diaria')).toEqual({
      cobranca: { forma: 'diaria', valorDiariaCentavos: 60000, diarias: 1 },
    })
    expect(novaCobranca(NEG_SOZIC, 'diaria')).toEqual({
      cobranca: { forma: 'diaria', diarias: 1 },
    })
    expect(novaCobranca(NEG_SOZIC, 'hora')).toEqual({
      cobranca: { forma: 'hora' },
    })
    expect(novaCobranca(NEG_AEF, 'pacote')).toEqual({
      cobranca: { forma: 'pacote', incluiMaterial: false },
    })
    expect(novaCobranca(undefined)).toEqual({ cobranca: { forma: 'chamado' } })
  })

  it('tarifa de chamado sem percal não grava percal', () => {
    expect(
      novaCobranca({
        ...NEG_SOZIC,
        tarifas: { chamado: { valorCentavos: 9000 } },
      }),
    ).toEqual({ cobranca: { forma: 'chamado' }, valorCentavos: 9000 })
  })
})

describe('valorBaseDoServico', () => {
  it('chamado e pacote usam o valor', () => {
    expect(valorBaseDoServico(servico({ valorCentavos: 9000 }))).toBe(9000)
    expect(
      valorBaseDoServico(
        servico({
          cobranca: { forma: 'pacote', incluiMaterial: true },
          valorCentavos: 150000,
        }),
      ),
    ).toBe(150000)
  })

  it('GWT 40: por hora — real 150 → 25000; horas cobradas 180 → 30000; sem os dois → undefined', () => {
    const hora = { forma: 'hora', valorHoraCentavos: 10000 } as const
    expect(
      valorBaseDoServico(servico({ cobranca: hora, duracaoRealMin: 150 })),
    ).toBe(25000)
    expect(
      valorBaseDoServico(
        servico({
          cobranca: { ...hora, horasCobradasMin: 180 },
          duracaoRealMin: 150,
        }),
      ),
    ).toBe(30000)
    const sem = servico({ cobranca: hora, valorCentavos: undefined })
    expect(valorBaseDoServico(sem)).toBeUndefined()
    expect(pendenciasDe(sem)).toEqual(['horas'])
  })

  it('por hora sem valor da hora → undefined e pendência valor_hora', () => {
    const s = servico({ cobranca: { forma: 'hora' }, duracaoRealMin: 60 })
    expect(valorBaseDoServico(s)).toBeUndefined()
    expect(pendenciasDe(s)).toEqual(['valor_hora'])
  })

  it('GWT 41: diária 40000 × 2 → 80000; diárias indefinidas → pendência', () => {
    expect(
      valorBaseDoServico(
        servico({
          cobranca: { forma: 'diaria', valorDiariaCentavos: 40000, diarias: 2 },
        }),
      ),
    ).toBe(80000)
    const sem = servico({
      cobranca: { forma: 'diaria', valorDiariaCentavos: 40000 },
    })
    expect(valorBaseDoServico(sem)).toBeUndefined()
    expect(pendenciasDe(sem)).toEqual(['diarias'])
    const zero = servico({ cobranca: { forma: 'diaria', diarias: 0 } })
    expect(valorBaseDoServico(zero)).toBeUndefined()
    expect(pendenciasDe(zero)).toEqual(['valor_diaria', 'diarias'])
  })

  it('GWT 57: hora 10000/h, real 120 + espera 60 → 30000; horas cobradas 120 → 20000', () => {
    const base = servico({
      cobranca: { forma: 'hora', valorHoraCentavos: 10000 },
      duracaoRealMin: 120,
      espera: { minutos: 60, motivo: 'liberacao_acesso' },
    })
    expect(valorBaseDoServico(base)).toBe(30000)
    expect(
      valorBaseDoServico({
        ...base,
        cobranca: {
          forma: 'hora',
          valorHoraCentavos: 10000,
          horasCobradasMin: 120,
        },
      }),
    ).toBe(20000)
  })

  it('minutosCobradosPorHora: produtivo exige o real; improdutivo usa a espera', () => {
    const espera = { minutos: 60, motivo: 'liberacao_acesso' } as const
    expect(minutosCobradosPorHora(servico({ espera }))).toBeUndefined()
    expect(
      minutosCobradosPorHora(servico({ resultado: 'improdutivo', espera })),
    ).toBe(60)
    expect(
      minutosCobradosPorHora(servico({ resultado: 'improdutivo' })),
    ).toBeUndefined()
    expect(
      minutosCobradosPorHora(
        servico({ resultado: 'improdutivo', duracaoRealMin: 30 }),
      ),
    ).toBe(30)
  })
})
