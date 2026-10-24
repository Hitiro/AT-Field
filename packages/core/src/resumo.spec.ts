import { describe, expect, it } from 'vitest'

import { despesa, servico } from './__fixtures__/dados'
import { financeiro, noMes, resumoDoMes } from './resumo'

const OUT = { ano: 2026, mes: 10 }

describe('noMes', () => {
  it('compara ano e mês com zero à esquerda', () => {
    expect(noMes('2026-10-01', OUT)).toBe(true)
    expect(noMes('2026-01-05', { ano: 2026, mes: 1 })).toBe(true)
    expect(noMes('2026-11-01', OUT)).toBe(false)
    expect(noMes(undefined, OUT)).toBe(false)
  })
})

describe('resumoDoMes (TEC-02a)', () => {
  it('soma serviços realizados e despesas do mês; agrupa por empresa', () => {
    const r = resumoDoMes(
      [
        servico({ id: '1', valorCentavos: 10000 }),
        servico({ id: '2', valorCentavos: 5000, empresaNome: 'Sustento' }),
        servico({ id: '3', valorCentavos: 8000 }),
        servico({ id: '4', valorCentavos: 2000, empresaNome: undefined }),
        despesa({ id: 'd1', valorCentavos: 3000 }),
        despesa({ id: 'd2', valorCentavos: 1000, data: '2026-09-30' }),
      ],
      OUT,
    )
    expect(r.servicoCentavos).toBe(25000)
    expect(r.custosCentavos).toBe(3000)
    expect(r.resultadoCentavos).toBe(22000)
    expect(r.porEmpresa).toEqual([
      { empresaNome: 'Sozic', quantidade: 2, totalCentavos: 18000 },
      { empresaNome: 'Sustento', quantidade: 1, totalCentavos: 5000 },
      { empresaNome: 'Sem empresa', quantidade: 1, totalCentavos: 2000 },
    ])
    expect(r.incluiNaoRevisados).toBe(0)
    expect(r.foraDoTotal).toBe(0)
  })

  it('GWT 14: 1 a revisar com valor no mês + 1 sem valor', () => {
    const r = resumoDoMes(
      [
        servico({ id: '1', status: 'a_revisar', valorCentavos: 7000 }),
        servico({ id: '2', status: 'a_revisar', valorCentavos: undefined }),
      ],
      OUT,
    )
    expect(r.incluiNaoRevisados).toBe(1)
    expect(r.foraDoTotal).toBe(1)
    expect(r.servicoCentavos).toBe(7000)
  })

  it('lançamento sem data fica fora do total (conta em foraDoTotal)', () => {
    const r = resumoDoMes(
      [despesa({ data: undefined }), servico({ data: undefined })],
      OUT,
    )
    expect(r.foraDoTotal).toBe(2)
    expect(r.custosCentavos).toBe(0)
  })

  it('resultado negativo', () => {
    expect(
      resumoDoMes([despesa({ valorCentavos: 7000 })], OUT).resultadoCentavos,
    ).toBe(-7000)
  })

  it('GWT 29: agendado fica fora; realizado entra com acréscimos', () => {
    const r = resumoDoMes(
      [
        servico({ id: 'ag', situacao: 'agendado', valorCentavos: 9000 }),
        servico({
          id: 're',
          acrescimos: [{ id: 'a', motivo: 'Espera', valorCentavos: 5000 }],
        }),
      ],
      OUT,
    )
    expect(r.servicoCentavos).toBe(15000)
    expect(r.porEmpresa).toEqual([
      { empresaNome: 'Sozic', quantidade: 1, totalCentavos: 15000 },
    ])
  })

  it('GWT 69: improdutivo da Protege entra com 0 e soma no "deixou de receber"', () => {
    const protege = servico({
      id: 'imp',
      empresaNome: 'Protege',
      valorCentavos: 9000,
      resultado: 'improdutivo',
      improdutiva: {
        motivo: 'entrada_nao_liberada',
        registradaEm: '2026-10-22T09:40:00',
        politica: { percentual: 0, pagaDeslocamento: false },
      },
      deslocamento: { kmIda: 40, tempoIdaMin: 40, valorCentavos: 6400 },
    })
    const r = resumoDoMes([protege, servico()], OUT)
    expect(r.improdutivos).toEqual({
      quantidade: 1,
      deixouDeReceberCentavos: 15400,
    })
    expect(r.servicoCentavos).toBe(10000)
    expect(financeiro([protege], OUT).aReceber.totalCentavos).toBe(0)
    expect(financeiro([protege], OUT).aReceber.porEmpresa).toEqual([])
  })
})

describe('financeiro (TEC-02c)', () => {
  it('GWT 15: a receber do mês anterior entra; recebido no mês entra em recebido', () => {
    const ls = [
      servico({ id: 'ant', data: '2026-09-20', valorCentavos: 12000 }),
      servico({ id: 'mes', valorCentavos: 8000, empresaNome: 'Sustento' }),
      servico({
        id: 'rec',
        valorCentavos: 10000,
        recebimento: { status: 'recebido', recebidoEm: '2026-10-15' },
      }),
      servico({
        id: 'rec-ant',
        valorCentavos: 4000,
        recebimento: { status: 'recebido', recebidoEm: '2026-09-15' },
      }),
    ]
    const f = financeiro(ls, OUT)
    expect(f.aReceber.totalCentavos).toBe(20000)
    expect(f.aReceber.porEmpresa).toEqual([
      { empresaNome: 'Sozic', quantidade: 1, totalCentavos: 12000 },
      { empresaNome: 'Sustento', quantidade: 1, totalCentavos: 8000 },
    ])
    expect(f.recebidoNoMesCentavos).toBe(10000)
    // o serviço de setembro não entra no resumo de outubro (resumo usa a data do serviço)
    expect(resumoDoMes(ls, OUT).servicoCentavos).toBe(22000)
  })

  it('GWT 29: agendado e sem valor não entram em a receber', () => {
    const f = financeiro(
      [
        servico({ situacao: 'agendado' }),
        servico({ id: 'x', valorCentavos: undefined }),
      ],
      OUT,
    )
    expect(f.aReceber.totalCentavos).toBe(0)
  })

  it('despesas do mês por categoria, com todas as chaves (sem categoria → outros)', () => {
    const f = financeiro(
      [
        despesa({ id: '1', categoria: 'combustivel', valorCentavos: 20000 }),
        despesa({ id: '2', categoria: 'estacionamento', valorCentavos: 1500 }),
        despesa({ id: '3', categoria: 'hospedagem', valorCentavos: 18000 }),
        despesa({ id: '4', categoria: undefined, valorCentavos: 500 }),
        despesa({ id: '5', data: '2026-09-01', valorCentavos: 9999 }),
        despesa({ id: '6', valorCentavos: undefined }),
      ],
      OUT,
    )
    expect(f.despesasNoMes).toEqual({
      totalCentavos: 40000,
      porCategoria: {
        combustivel: 20000,
        pedagio: 0,
        estacionamento: 1500,
        alimentacao: 0,
        hospedagem: 18000,
        outros: 500,
      },
    })
  })
})
