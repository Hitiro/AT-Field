import { describe, expect, it } from 'vitest'

import { CIDADES, EMPRESAS, servico } from './__fixtures__/dados'
import {
  agendaDosProximosDias,
  detectarConflitos,
  horaValida,
  intervaloDe,
  rotuloDoDia,
  sobrepoe,
  somarDias,
} from './agenda'
import { duracaoPrevista } from './empresas'
import type { LancamentoServico } from './lancamentos'
import { EXEMPLO_3 } from './whatsapp/__fixtures__/exemplos'
import { parseDemandaWhatsApp } from './whatsapp/parser'

const HOJE = '2026-10-22'

const agendado = (p: Partial<LancamentoServico>): LancamentoServico =>
  servico({ situacao: 'agendado', data: HOJE, valorCentavos: undefined, ...p })

/** Mocks da Parte B §4 (relativos a hoje). */
const MOCKS: LancamentoServico[] = [
  agendado({
    id: 'h1',
    empresaId: 'sozic',
    empresaNome: 'Sozic',
    hora: '09:00',
    duracaoEstimadaMin: 120,
  }),
  agendado({
    id: 'h2',
    empresaId: 'sustento',
    empresaNome: 'Sustento',
    hora: '14:00',
    duracaoEstimadaMin: 120,
  }),
  agendado({
    id: 'a1',
    data: '2026-10-23',
    empresaId: 'protege',
    empresaNome: 'Protege',
    hora: '14:00',
    duracaoEstimadaMin: 90,
  }),
  agendado({
    id: 'a2',
    data: '2026-10-23',
    empresaId: 'sozic',
    empresaNome: 'Sozic',
    hora: '10:00',
    status: 'a_revisar',
    cobranca: { forma: 'chamado', percalMin: 120 },
  }),
  agendado({
    id: 'p2',
    data: '2026-10-24',
    empresaId: 'central',
    empresaNome: 'Central Field Service',
    hora: '08:30',
    duracaoEstimadaMin: 180,
  }),
  agendado({
    id: 'p4',
    data: '2026-10-26',
    empresaId: 'ik',
    empresaNome: 'IK Solution',
  }),
  agendado({ id: 'passado', data: '2026-10-21', hora: '09:00' }),
  agendado({ id: 'longe', data: '2026-10-29', hora: '09:00' }),
  servico({ id: 'feito', data: HOJE, hora: '16:00' }),
]

describe('intervalo e sobreposição', () => {
  it('semiaberto: encostar não conflita', () => {
    const a = intervaloDe(HOJE, '14:00', 120)
    expect(sobrepoe(a, intervaloDe(HOJE, '16:00', 60))).toBe(false)
    expect(sobrepoe(a, intervaloDe(HOJE, '15:59', 60))).toBe(true)
  })

  it('horaValida e somarDias', () => {
    expect(horaValida('23:59')).toBe(true)
    expect(horaValida('25:00')).toBe(false)
    expect(horaValida('14:7')).toBe(false)
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('detectarConflitos', () => {
  const base = [agendado({ id: 'x', hora: '14:00', duracaoEstimadaMin: 120 })]

  it('GWT 16: consulta 15:00 → conflito', () => {
    expect(
      detectarConflitos({ data: HOJE, hora: '15:00' }, base).conflitos,
    ).toHaveLength(1)
  })

  it('GWT 17: consulta 16:00 → sem conflito', () => {
    expect(
      detectarConflitos({ data: HOJE, hora: '16:00' }, base).conflitos,
    ).toEqual([])
  })

  it('GWT 18: 13:00 com 60 min → sem conflito (encosta)', () => {
    expect(
      detectarConflitos({ data: HOJE, hora: '13:00', duracaoMin: 60 }, base)
        .conflitos,
    ).toEqual([])
  })

  it('GWT 19: 13:00 com 90 min → conflito', () => {
    expect(
      detectarConflitos({ data: HOJE, hora: '13:00', duracaoMin: 90 }, base)
        .conflitos,
    ).toHaveLength(1)
  })

  it('GWT 20: agendado 23:00/120; consulta no dia seguinte 00:30 → conflito', () => {
    const noite = [
      agendado({ id: 'n', hora: '23:00', duracaoEstimadaMin: 120 }),
    ]
    expect(
      detectarConflitos({ data: '2026-10-23', hora: '00:30' }, noite).conflitos,
    ).toHaveLength(1)
    expect(
      detectarConflitos({ data: '2026-10-23', hora: '01:00' }, noite).conflitos,
    ).toEqual([])
  })

  it('consulta 23:00 + 120 min conflita com agendado do dia seguinte às 00:30', () => {
    const madrugada = [
      agendado({
        id: 'm',
        data: '2026-10-23',
        hora: '00:30',
        duracaoEstimadaMin: 60,
      }),
    ]
    expect(
      detectarConflitos(
        { data: HOJE, hora: '23:00', duracaoMin: 120 },
        madrugada,
      ).conflitos,
    ).toHaveLength(1)
    expect(
      detectarConflitos(
        { data: HOJE, hora: '22:00', duracaoMin: 120 },
        madrugada,
      ).conflitos,
    ).toEqual([])
    // o do dia seguinte não entra em "mesmo dia"
    expect(detectarConflitos({ data: HOJE }, madrugada).mesmoDia).toEqual([])
  })

  it('GWT 21: Sustento sem estimativa usa o percal de 4 h; sem percal usa 2 h', () => {
    const sustento = [
      agendado({ id: 's', empresaId: 'sustento', hora: '14:00' }),
    ]
    expect(
      detectarConflitos({ data: HOJE, hora: '17:00' }, sustento, EMPRESAS)
        .conflitos,
    ).toHaveLength(1)
    const semPercal = [
      agendado({ id: 'p', empresaId: 'protege', hora: '14:00' }),
    ]
    expect(
      detectarConflitos({ data: HOJE, hora: '17:00' }, semPercal, EMPRESAS)
        .conflitos,
    ).toEqual([])
  })

  it('GWT 22: consulta sem hora num dia com 2 agendados', () => {
    const r = detectarConflitos({ data: HOJE }, MOCKS)
    expect(r.conflitos).toEqual([])
    expect(r.mesmoDia.map(s => s.id)).toEqual(['h1', 'h2'])
  })

  it('GWT 23: realizado não conta; excluirId não conta', () => {
    expect(
      detectarConflitos({ data: HOJE, hora: '16:30' }, MOCKS).conflitos,
    ).toEqual([])
    expect(
      detectarConflitos({ data: HOJE, hora: '14:30', excluirId: 'h2' }, MOCKS)
        .conflitos,
    ).toEqual([])
  })

  it('hora inválida na consulta → não checa', () => {
    expect(
      detectarConflitos({ data: HOJE, hora: '25:00' }, MOCKS).conflitos,
    ).toEqual([])
  })

  it('conflitos ordenados por hora', () => {
    const r = detectarConflitos(
      { data: HOJE, hora: '08:00', duracaoMin: 600 },
      MOCKS,
      EMPRESAS,
    )
    expect(r.conflitos.map(s => s.id)).toEqual(['h1', 'h2'])
  })

  it('GWT 25: Exemplo 3 contra os mocks → conflito com Protege 14:00–15:30', () => {
    const d = parseDemandaWhatsApp(EXEMPLO_3, {
      cidades: CIDADES,
      empresas: EMPRESAS,
      hoje: HOJE,
    })
    const amparo = EMPRESAS.find(e => e.id === 'amparo')!
    const r = detectarConflitos(
      {
        data: d.data!.valor,
        hora: d.data!.hora,
        duracaoMin: duracaoPrevista(
          { cobranca: { forma: 'chamado' } },
          amparo.negociacao,
        ).minutos,
      },
      MOCKS,
      EMPRESAS,
    )
    expect(r.conflitos.map(s => s.empresaNome)).toEqual(['Protege'])
  })
})

describe('agendaDosProximosDias', () => {
  it('GWT 24: grupos Hoje, Amanhã, sáb., 24/10 e seg., 26/10', () => {
    const grupos = agendaDosProximosDias(MOCKS, HOJE, 7, EMPRESAS)
    expect(grupos.map(g => g.rotulo)).toEqual([
      'Hoje',
      'Amanhã',
      'sáb., 24/10',
      'seg., 26/10',
    ])
    expect(grupos[0].itens.map(i => i.inicio)).toEqual(['09:00', '14:00'])
    expect(grupos[1].itens.map(i => i.inicio)).toEqual(['10:00', '14:00'])
    expect(grupos[1].itens[0]).toMatchObject({
      fim: '12:00',
      duracaoMin: 120,
      duracaoEstimada: false,
      origemDuracao: 'percal',
    })
    expect(grupos[1].itens[1]).toMatchObject({
      fim: '15:30',
      duracaoEstimada: true,
    })
    expect(grupos[3].itens[0].inicio).toBeUndefined()
    expect(grupos.flatMap(g => g.itens).every(i => !i.emConflito)).toBe(true)
  })

  it('sem hora vai para o fim; conflito no mesmo dia é marcado', () => {
    const ls = [
      agendado({ id: 'semhora' }),
      agendado({ id: 'a', hora: '10:00' }),
      agendado({ id: 'b', hora: '11:00' }),
      agendado({ id: 'c', hora: '23:00', duracaoEstimadaMin: 120 }),
    ]
    const [g] = agendaDosProximosDias(ls, HOJE)
    expect(g.itens.map(i => i.servico.id)).toEqual(['a', 'b', 'c', 'semhora'])
    expect(g.itens.map(i => i.emConflito)).toEqual([true, true, false, false])
    expect(g.itens[2].fim).toBe('01:00')
    expect(g.itens[3].origemDuracao).toBe('padrao')
  })

  it('conflito na virada do dia aparece nos dois dias', () => {
    const ls = [
      agendado({ id: 'noite', hora: '23:00', duracaoEstimadaMin: 120 }),
      agendado({
        id: 'cedo',
        data: '2026-10-23',
        hora: '00:30',
        duracaoEstimadaMin: 60,
      }),
    ]
    const [hoje, amanha] = agendaDosProximosDias(ls, HOJE)
    expect(hoje.itens[0].emConflito).toBe(true)
    expect(amanha.itens[0].emConflito).toBe(true)
  })

  it('sem agendados → lista vazia', () => {
    expect(agendaDosProximosDias([], HOJE)).toEqual([])
  })

  it('rótulos de todos os dias da semana', () => {
    expect(
      [
        '2026-10-25',
        '2026-10-27',
        '2026-10-28',
        '2026-10-29',
        '2026-10-30',
      ].map(d => rotuloDoDia(d, HOJE)),
    ).toEqual([
      'dom., 25/10',
      'ter., 27/10',
      'qua., 28/10',
      'qui., 29/10',
      'sex., 30/10',
    ])
  })
})
