import { describe, expect, it } from 'vitest'

import {
  EMPRESAS,
  NEG_SOZIC,
  NEG_SUSTENTO,
  servico,
} from './__fixtures__/dados'
import {
  DURACAO_PADRAO_MIN,
  avisosDaEmpresa,
  duracaoPrevista,
  kmIdaParaPagamento,
  negociacaoDoServico,
  textoAviso,
} from './empresas'

const emp = (id: string) => EMPRESAS.find(e => e.id === id)!

describe('kmIdaParaPagamento (TEC-23a)', () => {
  it('GWT 10: Sozic + Maringá → 100; Sozic + Cianorte → exato; Sustento → exato', () => {
    expect(kmIdaParaPagamento(NEG_SOZIC.deslocamento, 'maringa', 110)).toBe(100)
    expect(kmIdaParaPagamento(NEG_SOZIC.deslocamento, 'cianorte', 130)).toBe(
      130,
    )
    expect(kmIdaParaPagamento(NEG_SUSTENTO.deslocamento, 'maringa', 110)).toBe(
      110,
    )
  })

  it('modo média sem destino → exato; média 0 vale', () => {
    expect(kmIdaParaPagamento(NEG_SOZIC.deslocamento, undefined, 90)).toBe(90)
    expect(
      kmIdaParaPagamento(
        emp('central').negociacao!.deslocamento,
        'londrina',
        12,
      ),
    ).toBe(0)
  })
})

describe('duracaoPrevista', () => {
  it('estimada → percal (gravado, senão da negociação) → padrão', () => {
    expect(duracaoPrevista(servico({ duracaoEstimadaMin: 90 }))).toEqual({
      minutos: 90,
      origem: 'estimada',
    })
    expect(
      duracaoPrevista(
        servico({ cobranca: { forma: 'chamado', percalMin: 180 } }),
      ),
    ).toEqual({ minutos: 180, origem: 'percal' })
    expect(duracaoPrevista(servico(), NEG_SUSTENTO)).toEqual({
      minutos: 240,
      origem: 'percal',
    })
    expect(duracaoPrevista(servico())).toEqual({
      minutos: DURACAO_PADRAO_MIN,
      origem: 'padrao',
    })
  })

  it('percal só vale para cobrança por chamado', () => {
    expect(
      duracaoPrevista(servico({ cobranca: { forma: 'hora' } }), NEG_SUSTENTO),
    ).toEqual({ minutos: 120, origem: 'padrao' })
  })
})

describe('avisosDaEmpresa', () => {
  it('GWT 27c/38: Protege → perguntar percal; AmparoTécnico (com percal) → não atendo', () => {
    expect(avisosDaEmpresa(emp('protege'))).toEqual(['perguntar_percal'])
    expect(avisosDaEmpresa(emp('amparo'))).toEqual(['nao_atendo'])
  })

  it('GWT 39: sem empresa → perguntar percal; blacklist sem percal → os dois', () => {
    expect(avisosDaEmpresa(undefined)).toEqual(['perguntar_percal'])
    expect(avisosDaEmpresa({ ...emp('protege'), naoAtendo: true })).toEqual([
      'nao_atendo',
      'perguntar_percal',
    ])
  })

  it('GWT 45: AEF → nenhum; AEF por chamado → perguntar percal', () => {
    expect(avisosDaEmpresa(emp('aef'))).toEqual([])
    expect(avisosDaEmpresa(emp('aef'), 'chamado')).toEqual(['perguntar_percal'])
  })

  it('Sozic → nenhum aviso', () => {
    expect(avisosDaEmpresa(emp('sozic'))).toEqual([])
  })

  it('textos dos avisos', () => {
    expect(textoAviso('nao_atendo', 'AmparoTécnico')).toBe(
      "Você marcou AmparoTécnico como 'não atendo'.",
    )
    expect(textoAviso('perguntar_percal', 'X')).toBe(
      'Pergunte o percal antes de aceitar.',
    )
  })
})

describe('negociacaoDoServico', () => {
  it('acha pela empresaId; sem id ou desconhecida → undefined', () => {
    expect(negociacaoDoServico({ empresaId: 'sozic' }, EMPRESAS)).toBe(
      NEG_SOZIC,
    )
    expect(negociacaoDoServico({}, EMPRESAS)).toBeUndefined()
    expect(negociacaoDoServico({ empresaId: 'x' }, EMPRESAS)).toBeUndefined()
  })
})
