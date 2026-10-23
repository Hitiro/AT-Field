import { describe, expect, it } from 'vitest'

import {
  type AvaliacaoEmpresa,
  type AvaliacaoRede,
  MOTIVOS_AVALIACAO,
  ROTULOS_MOTIVO,
  resumirRede,
  validarAvaliacao,
} from './reputacao'

const av = (p: Partial<AvaliacaoEmpresa> = {}): AvaliacaoEmpresa => ({
  empresaId: 'sozic',
  nota: 8,
  motivos: [],
  atualizadaEm: '2026-10-22',
  ...p,
})

const rede = (
  nota: number,
  motivos: AvaliacaoRede['motivos'] = [],
): AvaliacaoRede => ({
  nota,
  motivos,
})

describe('MOTIVOS_AVALIACAO', () => {
  it('lista fechada de TEC-74, com "não paga improdutiva" por último', () => {
    expect(MOTIVOS_AVALIACAO).toHaveLength(6)
    expect(MOTIVOS_AVALIACAO[5]).toBe('nao_paga_improdutiva')
    expect(ROTULOS_MOTIVO.nao_paga_improdutiva).toBe('Não paga improdutiva')
    expect(ROTULOS_MOTIVO.nao_paga_deslocamento_pedagio).toBe(
      'Não paga deslocamento/pedágio',
    )
  })
})

describe('validarAvaliacao', () => {
  it('aceita nota 0 e 10, motivos da lista e comentário de 500', () => {
    expect(validarAvaliacao(av({ nota: 0 }))).toEqual([])
    expect(
      validarAvaliacao(
        av({
          nota: 10,
          motivos: ['atrasa_pagamento'],
          comentarioPrivado: 'x'.repeat(500),
        }),
      ),
    ).toEqual([])
  })

  it.each([7.5, -1, 11])('GWT 32: nota %d → erro', nota => {
    expect(validarAvaliacao(av({ nota })).map(e => e.campo)).toEqual(['nota'])
  })

  it('GWT 32: motivo fora da lista, duplicado e comentário com 501', () => {
    expect(
      validarAvaliacao(av({ motivos: ['xingamento' as never] })).map(
        e => e.mensagem,
      ),
    ).toEqual(['Motivo fora da lista'])
    expect(
      validarAvaliacao(
        av({ motivos: ['atrasa_pagamento', 'atrasa_pagamento'] }),
      ).map(e => e.mensagem),
    ).toEqual(['Motivo repetido'])
    expect(
      validarAvaliacao(av({ comentarioPrivado: 'x'.repeat(501) })).map(
        e => e.campo,
      ),
    ).toEqual(['comentarioPrivado'])
  })

  it('GWT 73: aceita nao_paga_improdutiva', () => {
    expect(validarAvaliacao(av({ motivos: ['nao_paga_improdutiva'] }))).toEqual(
      [],
    )
  })
})

describe('resumirRede', () => {
  it('GWT 31: 4 avaliações → poucas (4)', () => {
    expect(resumirRede([rede(8), rede(7), rede(9), rede(6)])).toEqual({
      status: 'poucas_avaliacoes',
      quantidade: 4,
    })
  })

  it('GWT 31: [8,7,9,6,10] → média 8; [7,8,8,9,9] → 8,2', () => {
    expect(resumirRede([8, 7, 9, 6, 10].map(n => rede(n)))).toEqual({
      status: 'ok',
      quantidade: 5,
      media: 8,
      motivosMaisCitados: [],
    })
    const r = resumirRede([7, 8, 8, 9, 9].map(n => rede(n)))
    expect(r.status === 'ok' && r.media).toBe(8.2)
  })

  it('GWT 31: motivos 3/3/1 → top na ordem da lista no empate', () => {
    const r = resumirRede([
      rede(5, ['percal_nao_informado', 'atrasa_pagamento']),
      rede(5, ['percal_nao_informado', 'atrasa_pagamento']),
      rede(5, [
        'percal_nao_informado',
        'atrasa_pagamento',
        'valor_abaixo_combinado',
      ]),
      rede(5),
      rede(5),
    ])
    expect(r).toMatchObject({
      motivosMaisCitados: [
        { motivo: 'atrasa_pagamento', quantidade: 3 },
        { motivo: 'percal_nao_informado', quantidade: 3 },
        { motivo: 'valor_abaixo_combinado', quantidade: 1 },
      ],
    })
  })

  it('top 3 no máximo', () => {
    const todos = [...MOTIVOS_AVALIACAO]
    const r = resumirRede([1, 2, 3, 4, 5].map(n => rede(n, todos)))
    expect(r.status === 'ok' && r.motivosMaisCitados).toHaveLength(3)
  })

  it('GWT 31: nota 11 descartada antes de contar', () => {
    expect(resumirRede([8, 7, 9, 6, 11].map(n => rede(n)))).toEqual({
      status: 'poucas_avaliacoes',
      quantidade: 4,
    })
  })

  it('GWT 73: no empate, nao_paga_improdutiva vem depois dos outros', () => {
    const r = resumirRede(
      [1, 2, 3, 4, 5].map(n =>
        rede(n, ['nao_paga_improdutiva', 'percal_nao_informado']),
      ),
    )
    expect(r).toMatchObject({
      motivosMaisCitados: [
        { motivo: 'percal_nao_informado', quantidade: 5 },
        { motivo: 'nao_paga_improdutiva', quantidade: 5 },
      ],
    })
  })

  it('mínimo configurável; lista vazia → poucas (0)', () => {
    expect(resumirRede([rede(7)], 1)).toMatchObject({ status: 'ok', media: 7 })
    expect(resumirRede([])).toEqual({
      status: 'poucas_avaliacoes',
      quantidade: 0,
    })
  })
})
