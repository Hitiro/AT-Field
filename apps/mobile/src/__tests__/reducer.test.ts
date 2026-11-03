import type { LancamentoDespesa, LancamentoServico } from '@at-field/core'
import { describe, expect, it } from '@jest/globals'

import { type Estado, reducer } from '@/state/reducer'
import { estadoMock } from '@/state/store'

const HOJE = '2026-10-22'
const base = (): Estado => estadoMock(HOJE)
const servico = (e: Estado, id: string) =>
  e.lancamentos.find(l => l.id === id) as LancamentoServico

const despesaRapida: LancamentoDespesa = {
  id: 'novo',
  tipo: 'despesa',
  status: 'confirmado',
  origem: 'rapido',
  criadoEm: '2026-10-22T10:00:00',
  data: HOJE,
  valorCentavos: 3000,
}

describe('reducer — lançamentos', () => {
  it('adicionar força a_revisar quando a origem não é completa', () => {
    const e = reducer(base(), { tipo: 'adicionar', lancamento: despesaRapida })
    expect(e.lancamentos[0]).toMatchObject({ id: 'novo', status: 'a_revisar' })
  })

  it('confirmar sem poder confirmar devolve o mesmo estado (TEC-02b)', () => {
    const e1 = reducer(base(), { tipo: 'adicionar', lancamento: despesaRapida })
    const e2 = reducer(e1, { tipo: 'confirmar', id: 'novo' })
    expect(e2).toBe(e1)
    const e3 = reducer(e1, {
      tipo: 'atualizar',
      id: 'novo',
      patch: { categoria: 'alimentacao' },
    })
    expect(
      reducer(e3, { tipo: 'confirmar', id: 'novo' }).lancamentos[0].status,
    ).toBe('confirmado')
  })

  it('atualizar não muda id, tipo, criadoEm nem status; duração inválida ignorada', () => {
    const e = reducer(base(), {
      tipo: 'atualizar',
      id: 'm-s2',
      patch: {
        id: 'x',
        tipo: 'despesa',
        criadoEm: 'y',
        status: 'a_revisar',
        cliente: 'Camicado',
        duracaoRealMin: 0,
        hora: '25:00',
      } as never,
    })
    const s = servico(e, 'm-s2')
    expect(s).toMatchObject({
      id: 'm-s2',
      tipo: 'servico',
      status: 'confirmado',
      cliente: 'Camicado',
    })
    expect(s.duracaoRealMin).toBe(120)
    expect(s.hora).toBeUndefined()
  })

  it('id inexistente devolve o mesmo estado', () => {
    const e = base()
    expect(reducer(e, { tipo: 'remover', id: 'nao-existe' })).toBe(e)
    expect(reducer(e, { tipo: 'confirmar', id: 'nao-existe' })).toBe(e)
    expect(
      reducer(e, { tipo: 'marcarRecebido', id: 'nao-existe', data: HOJE }),
    ).toBe(e)
  })

  it('remover, marcarRecebido e marcarAReceber', () => {
    let e = reducer(base(), { tipo: 'marcarRecebido', id: 'm-s2', data: HOJE })
    expect(servico(e, 'm-s2').recebimento).toEqual({
      status: 'recebido',
      recebidoEm: HOJE,
    })
    e = reducer(e, { tipo: 'marcarAReceber', id: 'm-s2' })
    expect(servico(e, 'm-s2').recebimento).toEqual({ status: 'a_receber' })
    e = reducer(e, { tipo: 'remover', id: 'm-s2' })
    expect(servico(e, 'm-s2')).toBeUndefined()
  })

  it('marcarRealizado com duração real', () => {
    const e = reducer(base(), {
      tipo: 'marcarRealizado',
      id: 'ag-h1',
      duracaoRealMin: 100,
    })
    expect(servico(e, 'ag-h1')).toMatchObject({
      situacao: 'realizado',
      duracaoRealMin: 100,
    })
  })

  it('acréscimo com valor 0 é rejeitado; remover acréscimo', () => {
    const e = base()
    expect(
      reducer(e, {
        tipo: 'adicionarAcrescimo',
        id: 'm-s2',
        acrescimo: { id: 'a', motivo: 'x', valorCentavos: 0 },
      }),
    ).toBe(e)
    const e2 = reducer(e, {
      tipo: 'adicionarAcrescimo',
      id: 'm-s2',
      acrescimo: { id: 'a', motivo: 'Espera', valorCentavos: 100 },
    })
    expect(servico(e2, 'm-s2').acrescimos).toHaveLength(1)
    const e3 = reducer(e2, {
      tipo: 'removerAcrescimo',
      id: 'm-s2',
      acrescimoId: 'a',
    })
    expect(servico(e3, 'm-s2').acrescimos).toHaveLength(0)
  })

  it('trocarCobranca: chamado ↔ pacote mantém o valor; para hora usa a tarifa', () => {
    let e = reducer(base(), {
      tipo: 'trocarCobranca',
      id: 'm-s2',
      forma: 'pacote',
    })
    expect(servico(e, 'm-s2')).toMatchObject({
      cobranca: { forma: 'pacote', incluiMaterial: false },
      valorCentavos: 10000,
    })
    e = reducer(e, { tipo: 'trocarCobranca', id: 'm-s5', forma: 'diaria' })
    expect(servico(e, 'm-s5').cobranca).toEqual({
      forma: 'diaria',
      valorDiariaCentavos: 60000,
      diarias: 1,
    })
  })

  it('registrarEspera com 0 minutos não muda o estado; válida grava; remover', () => {
    const e = base()
    expect(
      reducer(e, {
        tipo: 'registrarEspera',
        id: 'm-s2',
        espera: { minutos: 0, motivo: 'liberacao_acesso' },
      }),
    ).toBe(e)
    const e2 = reducer(e, {
      tipo: 'registrarEspera',
      id: 'm-s2',
      espera: { minutos: 30, motivo: 'suporte_remoto' },
    })
    expect(servico(e2, 'm-s2').espera).toEqual({
      minutos: 30,
      motivo: 'suporte_remoto',
    })
    expect(
      servico(reducer(e2, { tipo: 'removerEspera', id: 'm-s2' }), 'm-s2')
        .espera,
    ).toBeUndefined()
  })

  it('marcarImprodutivo grava cópia da política e situação realizado; marcarProdutivo remove', () => {
    const e = reducer(base(), {
      tipo: 'marcarImprodutivo',
      id: 'ag-h1',
      motivo: 'responsavel_ausente',
      registradaEm: '2026-10-22T09:10:00',
    })
    const s = servico(e, 'ag-h1')
    expect(s).toMatchObject({
      situacao: 'realizado',
      resultado: 'improdutivo',
      improdutiva: {
        motivo: 'responsavel_ausente',
        politica: { percentual: 50, pagaDeslocamento: true },
      },
    })
    const politicaEmpresa = e.empresas.find(x => x.id === 'sozic')!.negociacao!
      .improdutiva
    expect(s.improdutiva!.politica).not.toBe(politicaEmpresa)
    const p = servico(
      reducer(e, { tipo: 'marcarProdutivo', id: 'ag-h1' }),
      'ag-h1',
    )
    expect(p.resultado).toBe('produtivo')
    expect(p.improdutiva).toBeUndefined()
  })

  it('trocar motivo/data de improdutiva já registrada mantém a política gravada (TEC-21)', () => {
    let e = reducer(base(), {
      tipo: 'marcarImprodutivo',
      id: 'm-s8',
      motivo: 'outro',
      registradaEm: '2026-10-22T10:00:00',
    })
    // a Protege registrou { 0, false }; a negociação muda para 50% depois
    e = {
      ...e,
      empresas: e.empresas.map(x =>
        x.id === 'protege'
          ? {
              ...x,
              negociacao: {
                ...x.negociacao!,
                improdutiva: { percentual: 50, pagaDeslocamento: true },
              },
            }
          : x,
      ),
    }
    e = reducer(e, {
      tipo: 'marcarImprodutivo',
      id: 'm-s8',
      motivo: 'responsavel_ausente',
      registradaEm: '2026-10-22T11:00:00',
    })
    expect(servico(e, 'm-s8').improdutiva).toEqual({
      motivo: 'responsavel_ausente',
      registradaEm: '2026-10-22T11:00:00',
      politica: { percentual: 0, pagaDeslocamento: false },
    })
  })

  it('marcarImprodutivo sem política da empresa usa "não informada"; registro inválido ignorado', () => {
    const e = reducer(base(), {
      tipo: 'marcarImprodutivo',
      id: 'ag-h2',
      motivo: 'outro',
      registradaEm: '2026-10-22T15:00:00',
    })
    expect(servico(e, 'ag-h2').improdutiva!.politica).toEqual({
      percentual: 0,
      pagaDeslocamento: false,
    })
    const e0 = base()
    expect(
      reducer(e0, {
        tipo: 'marcarImprodutivo',
        id: 'ag-h2',
        motivo: 'outro',
        registradaEm: 'x',
      }),
    ).toBe(e0)
  })

  it('avaliar e limpar avaliação do cliente final', () => {
    const av = {
      nota: 4,
      motivos: ['local_inseguro' as const],
      avaliadaEm: HOJE,
    }
    let e = reducer(base(), {
      tipo: 'avaliarClienteFinal',
      id: 'm-s4',
      avaliacao: av,
    })
    expect(servico(e, 'm-s4').avaliacaoClienteFinal).toEqual(av)
    e = reducer(e, { tipo: 'limparAvaliacaoClienteFinal', id: 'm-s4' })
    expect(servico(e, 'm-s4').avaliacaoClienteFinal).toBeUndefined()
    const e0 = base()
    // agendado não pode ser avaliado
    expect(
      reducer(e0, { tipo: 'avaliarClienteFinal', id: 'ag-h1', avaliacao: av }),
    ).toBe(e0)
  })
})

describe('reducer — empresas e veículo', () => {
  it('avaliar inválido não muda o estado; válido grava', () => {
    const e = base()
    const av = {
      empresaId: 'protege',
      nota: 11,
      motivos: [],
      atualizadaEm: HOJE,
    }
    expect(
      reducer(e, { tipo: 'avaliar', empresaId: 'protege', avaliacao: av }),
    ).toBe(e)
    const e2 = reducer(e, {
      tipo: 'avaliar',
      empresaId: 'protege',
      avaliacao: { ...av, nota: 9, motivos: ['atrasa_pagamento'] },
    })
    expect(e2.empresas.find(x => x.id === 'protege')!.avaliacao).toMatchObject({
      nota: 9,
    })
  })

  it('alternarNaoAtendo', () => {
    const e = reducer(base(), { tipo: 'alternarNaoAtendo', empresaId: 'sozic' })
    expect(e.empresas.find(x => x.id === 'sozic')!.naoAtendo).toBe(true)
  })

  it('telefone duplicado em outra empresa ou inválido é rejeitado; vincular e desvincular', () => {
    const e = base()
    expect(
      reducer(e, {
        tipo: 'vincularTelefone',
        empresaId: 'sozic',
        telefone: '+55 43 90000-0001',
      }),
    ).toBe(e)
    expect(
      reducer(e, {
        tipo: 'vincularTelefone',
        empresaId: 'sozic',
        telefone: '123',
      }),
    ).toBe(e)
    const e2 = reducer(e, {
      tipo: 'vincularTelefone',
      empresaId: 'sozic',
      telefone: '(43) 98888-7777',
    })
    expect(e2.empresas.find(x => x.id === 'sozic')!.telefones).toEqual([
      '43988887777',
    ])
    const e3 = reducer(e2, {
      tipo: 'desvincularTelefone',
      empresaId: 'sozic',
      telefone: '43988887777',
    })
    expect(e3.empresas.find(x => x.id === 'sozic')!.telefones).toEqual([])
  })

  it('atualizarNegociacao: percal e hora adicional; percal ≤ 0 ignorado', () => {
    let e = reducer(base(), {
      tipo: 'atualizarNegociacao',
      empresaId: 'protege',
      patch: { percalMin: 180 },
    })
    expect(
      e.empresas.find(x => x.id === 'protege')!.negociacao!.tarifas.chamado,
    ).toEqual({
      valorCentavos: 9000,
      percalMin: 180,
    })
    e = reducer(e, {
      tipo: 'atualizarNegociacao',
      empresaId: 'protege',
      patch: { percalMin: null, horaAdicional: { paga: false } },
    })
    const neg = e.empresas.find(x => x.id === 'protege')!.negociacao!
    expect(neg.tarifas.chamado).toEqual({ valorCentavos: 9000 })
    expect(neg.horaAdicional).toEqual({ paga: false })
    expect(
      reducer(e, {
        tipo: 'atualizarNegociacao',
        empresaId: 'protege',
        patch: { percalMin: 0 },
      }),
    ).toBe(e)
  })

  it('atualizarVeiculo rejeita consumo 0', () => {
    const e = base()
    expect(
      reducer(e, {
        tipo: 'atualizarVeiculo',
        veiculo: {
          precoLitroCentavos: 600,
          consumoKmPorLitro: 0,
          manutencaoCentavosPorKm: 0,
        },
      }),
    ).toBe(e)
  })
})
