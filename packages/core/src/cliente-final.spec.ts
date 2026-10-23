import { describe, expect, it } from 'vitest'

import { servico } from './__fixtures__/dados'
import {
  type AvaliacaoClienteFinal,
  historicoClienteFinal,
  validarAvaliacaoClienteFinal,
} from './cliente-final'
import { resumirRede } from './reputacao'

const av = (p: Partial<AvaliacaoClienteFinal> = {}): AvaliacaoClienteFinal => ({
  nota: 4,
  motivos: ['local_inseguro'],
  avaliadaEm: '2026-10-22',
  ...p,
})

const realizado = servico({ cliente: 'ZARA' })

describe('validarAvaliacaoClienteFinal', () => {
  it('válida em serviço realizado com cliente', () => {
    expect(validarAvaliacaoClienteFinal(realizado, av())).toEqual([])
  })

  it('GWT 50: nota 7,5 ou 11 → erro', () => {
    expect(
      validarAvaliacaoClienteFinal(realizado, av({ nota: 7.5 })),
    ).toHaveLength(1)
    expect(
      validarAvaliacaoClienteFinal(realizado, av({ nota: 11 })),
    ).toHaveLength(1)
  })

  it('GWT 50: motivo de outra lista, duplicado e anotação 501 → erro', () => {
    const campos = (a: AvaliacaoClienteFinal) =>
      validarAvaliacaoClienteFinal(realizado, a).map(e => e.campo)
    expect(campos(av({ motivos: ['atrasa_pagamento' as never] }))).toEqual([
      'motivos',
    ])
    expect(
      campos(av({ motivos: ['local_inseguro', 'local_inseguro'] })),
    ).toEqual(['motivos'])
    expect(campos(av({ anotacaoPrivada: 'x'.repeat(501) }))).toEqual([
      'anotacaoPrivada',
    ])
  })

  it('GWT 50: serviço agendado → erro; cliente vazio → erro em cliente', () => {
    expect(
      validarAvaliacaoClienteFinal(
        { ...realizado, situacao: 'agendado' },
        av(),
      ).map(e => e.campo),
    ).toEqual(['situacao'])
    expect(
      validarAvaliacaoClienteFinal({ ...realizado, cliente: ' ' }, av()),
    ).toEqual([{ campo: 'cliente', mensagem: 'Informe o cliente final' }])
  })
})

describe('historicoClienteFinal', () => {
  it('GWT 51: ZARA e Zara (3 e 5, local inseguro) + Zara sem avaliação', () => {
    const ls = [
      servico({
        id: '1',
        cliente: 'ZARA',
        avaliacaoClienteFinal: av({ nota: 3 }),
      }),
      servico({
        id: '2',
        cliente: 'Zara',
        avaliacaoClienteFinal: av({ nota: 5 }),
      }),
      servico({ id: '3', cliente: 'Zara' }),
      servico({
        id: '4',
        cliente: 'Camicado',
        avaliacaoClienteFinal: av({ nota: 9 }),
      }),
    ]
    expect(historicoClienteFinal(ls, 'zara')).toEqual({
      quantidade: 2,
      media: 4,
      motivosMaisCitados: [{ motivo: 'local_inseguro', quantidade: 2 }],
    })
  })

  it('GWT 51: sem histórico → quantidade 0, média indefinida', () => {
    expect(historicoClienteFinal([realizado], 'Shell')).toEqual({
      quantidade: 0,
      motivosMaisCitados: [],
    })
    expect(historicoClienteFinal([realizado], '  ')).toEqual({
      quantidade: 0,
      motivosMaisCitados: [],
    })
  })

  it('GWT 52: nota do cliente final não entra na reputação da empresa (e vice-versa)', () => {
    const ls = [
      servico({ cliente: 'ZARA', avaliacaoClienteFinal: av({ nota: 0 }) }),
    ]
    expect(historicoClienteFinal(ls, 'ZARA').media).toBe(0)
    // a rede só recebe AvaliacaoRede (nota da empresa); nada do cliente final
    expect(resumirRede([], 1)).toEqual({
      status: 'poucas_avaliacoes',
      quantidade: 0,
    })
  })
})
