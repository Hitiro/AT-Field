import { describe, expect, it } from 'vitest'

import { empresaPorTelefone, normalizarTelefone } from './telefone'

describe('normalizarTelefone', () => {
  it.each([
    '+55 (43) 99876-5432',
    '5543998765432',
    '043998765432',
    '43 99876-5432',
  ])('GWT 33: %s → 43998765432', tel => {
    expect(normalizarTelefone(tel)).toBe('43998765432')
  })

  it('fixo de 10 dígitos, com e sem país', () => {
    expect(normalizarTelefone('(43) 3333-4444')).toBe('4333334444')
    expect(normalizarTelefone('+55 43 3333-4444')).toBe('4333334444')
  })

  it.each(['123', '', '9999999999999999'])('GWT 33: %s → null', tel => {
    expect(normalizarTelefone(tel)).toBeNull()
  })
})

describe('empresaPorTelefone', () => {
  const empresas = [
    { id: 'sozic', telefones: ['4398765432'] },
    { id: 'ik', telefones: ['43900000001'] },
    { id: 'lixo', telefones: ['12'] },
  ]

  it('GWT 34: vínculo de 10 dígitos casa com 11 (nono dígito)', () => {
    expect(empresaPorTelefone('+55 43 99876-5432', empresas)).toBe('sozic')
  })

  it('número igual e o inverso do nono dígito', () => {
    expect(empresaPorTelefone('+55 43 90000-0001', empresas)).toBe('ik')
    expect(empresaPorTelefone('4300000001', empresas)).toBe('ik')
  })

  it('sem vínculo, inválido ou diferença que não é o nono dígito → undefined', () => {
    expect(empresaPorTelefone('43 91111-2222', empresas)).toBeUndefined()
    expect(empresaPorTelefone('abc', empresas)).toBeUndefined()
    expect(
      empresaPorTelefone('43 88765-4321', [
        { id: 'x', telefones: ['4398765432'] },
      ]),
    ).toBeUndefined()
  })
})
