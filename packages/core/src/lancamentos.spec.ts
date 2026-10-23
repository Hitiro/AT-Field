import { describe, expect, it } from 'vitest'

import {
  CIDADES,
  EMPRESAS,
  NEG_AEF,
  NEG_SOZIC,
  despesa,
  servico,
} from './__fixtures__/dados'
import { pendenciasDe, podeConfirmar, rascunhoDeDemanda } from './lancamentos'
import { EXEMPLO_1, EXEMPLO_3 } from './whatsapp/__fixtures__/exemplos'
import { parseDemandaWhatsApp } from './whatsapp/parser'

const opts = { cidades: CIDADES, empresas: EMPRESAS, hoje: '2026-10-22' }
const ids = { id: 'w1', agora: '2026-10-22T20:00:00Z' }

describe('pendenciasDe / podeConfirmar', () => {
  it('GWT 13: despesa rápida sem categoria → só categoria', () => {
    const d = despesa({
      status: 'a_revisar',
      origem: 'rapido',
      categoria: undefined,
    })
    expect(pendenciasDe(d)).toEqual(['categoria'])
    expect(podeConfirmar(d)).toBe(false)
  })

  it('despesa sem nada → valor, data, categoria', () => {
    expect(
      pendenciasDe(
        despesa({
          valorCentavos: undefined,
          data: undefined,
          categoria: undefined,
        }),
      ),
    ).toEqual(['valor', 'data', 'categoria'])
  })

  it('serviço completo → sem pendências', () => {
    expect(pendenciasDe(servico())).toEqual([])
    expect(podeConfirmar(servico())).toBe(true)
  })

  it('serviço sem valor, data e empresa', () => {
    expect(
      pendenciasDe(
        servico({
          valorCentavos: undefined,
          data: undefined,
          empresaNome: '  ',
        }),
      ),
    ).toEqual(['valor', 'data', 'empresa'])
  })

  it('GWT 30: acréscimo com motivo vazio → motivo_acrescimo', () => {
    const s = servico({
      acrescimos: [{ id: 'a', motivo: ' ', valorCentavos: 100 }],
    })
    expect(pendenciasDe(s)).toEqual(['motivo_acrescimo'])
    expect(podeConfirmar(s)).toBe(false)
  })

  it('pendências por forma de cobrança', () => {
    expect(
      pendenciasDe(
        servico({
          cobranca: { forma: 'pacote', incluiMaterial: false },
          valorCentavos: undefined,
        }),
      ),
    ).toEqual(['valor'])
    expect(
      pendenciasDe(
        servico({ cobranca: { forma: 'hora' }, valorCentavos: undefined }),
      ),
    ).toEqual(['valor_hora', 'horas'])
    expect(
      pendenciasDe(
        servico({
          cobranca: {
            forma: 'hora',
            valorHoraCentavos: 1,
            horasCobradasMin: 60,
          },
        }),
      ),
    ).toEqual([])
    expect(pendenciasDe(servico({ cobranca: { forma: 'diaria' } }))).toEqual([
      'valor_diaria',
      'diarias',
    ])
  })
})

describe('rascunhoDeDemanda', () => {
  it('Exemplo 3 → agendado amanhã 14:00, a revisar, sem valor', () => {
    const d = parseDemandaWhatsApp(EXEMPLO_3, opts)
    const s = rascunhoDeDemanda(d, ids)
    expect(s).toMatchObject({
      id: 'w1',
      tipo: 'servico',
      status: 'a_revisar',
      origem: 'whatsapp',
      criadoEm: ids.agora,
      situacao: 'agendado',
      data: '2026-10-23',
      hora: '14:00',
      acrescimos: [],
      empresaNome: 'AmparoTécnico',
      empresaId: 'amparo',
      cidade: { nome: 'Cianorte', uf: 'PR' },
      resultado: 'produtivo',
      recebimento: { status: 'a_receber' },
      cobranca: { forma: 'chamado' },
    })
    expect(s.valorCentavos).toBeUndefined()
    expect(s.duracaoEstimadaMin).toBeUndefined()
    expect(s.descricao).toBe(d.textoLimpo.slice(0, 200))
    expect(pendenciasDe(s)).toEqual(['valor'])
  })

  it('Exemplo 1 → motivo vira descrição; cliente, código, local e ferramentas', () => {
    const s = rascunhoDeDemanda(parseDemandaWhatsApp(EXEMPLO_1, opts), ids)
    expect(s).toMatchObject({
      descricao: 'remanejar tgt e impressora',
      cliente: 'ZARA',
      codigoChamado: '7056',
      local: 'Catuai Shop',
      ferramentas: ['Ferramentas básicas', 'Testador e identificador'],
      empresaId: 'central',
    })
    expect(s.data).toBeUndefined()
    expect(pendenciasDe(s)).toEqual(['valor', 'data'])
  })

  it('negociação define a forma, mas nenhum valor monetário é copiado', () => {
    const d = parseDemandaWhatsApp('', opts)
    expect(rascunhoDeDemanda(d, ids, NEG_SOZIC).cobranca).toEqual({
      forma: 'chamado',
      percalMin: 120,
    })
    expect(rascunhoDeDemanda(d, ids, NEG_AEF).cobranca).toEqual({
      forma: 'hora',
    })
    expect(
      rascunhoDeDemanda(d, ids, { ...NEG_AEF, formaPadrao: 'diaria' }).cobranca,
    ).toEqual({ forma: 'diaria', diarias: 1 })
    const vazio = rascunhoDeDemanda(d, ids, NEG_SOZIC)
    expect(vazio.valorCentavos).toBeUndefined()
    expect(vazio.descricao).toBeUndefined()
  })

  it('deslocamento pago e empresa sem id', () => {
    const s = rascunhoDeDemanda(
      parseDemandaWhatsApp('Sou da empresa Nova Tec. Pagamos o deslocamento', {
        cidades: CIDADES,
        hoje: '2026-10-22',
      }),
      ids,
    )
    expect(s.empresaNome).toBe('Nova Tec')
    expect(s.empresaId).toBeUndefined()
    expect(s.deslocamentoPago).toBe(true)
  })
})
