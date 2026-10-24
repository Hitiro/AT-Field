import { describe, expect, it } from 'vitest'

import { CIDADES } from '../__fixtures__/dados'
import { normalizar } from '../texto'
import { ehUF, encontrarCidadeComUF, encontrarCidadeSemUF } from './cidades'

describe('encontrarCidadeComUF', () => {
  it('Cidade - UF, com a posição do nome', () => {
    const linha = 'estou com chamado ZARA - 7056 Catuai Shop Londrina - PR'
    const r = encontrarCidadeComUF(linha, CIDADES)
    expect(r?.cidade.nome).toBe('Londrina')
    expect(linha.slice(r!.inicio)).toBe('Londrina - PR')
  })

  it('Cidade/UF', () => {
    expect(
      encontrarCidadeComUF('uma demanda em Cianorte/PR, gostaria', CIDADES)
        ?.cidade.id,
    ).toBe('cianorte')
  })

  it('sem acento e nome composto (sufixo mais longo)', () => {
    const r = encontrarCidadeComUF('vaga em Candido Mota - SP', CIDADES)
    expect(r?.cidade.nome).toBe('Cândido Mota')
    expect(r?.inicio).toBe(8)
  })

  it('UF que desempata homônimo', () => {
    expect(encontrarCidadeComUF('em Toledo/MG', CIDADES)?.cidade.id).toBe(
      'toledo-mg',
    )
  })

  it('início da linha, UF inexistente, cidade de outra UF e sigla colada', () => {
    expect(encontrarCidadeComUF('Londrina-PR', CIDADES)?.inicio).toBe(0)
    expect(encontrarCidadeComUF('em Londrina - XX', CIDADES)).toBeUndefined()
    expect(encontrarCidadeComUF('em Londrina - SP', CIDADES)).toBeUndefined()
    expect(encontrarCidadeComUF('parceiros PJ/MEI', CIDADES)).toBeUndefined()
  })

  it('segunda ocorrência quando a primeira não casa', () => {
    expect(
      encontrarCidadeComUF('de Curitiba - PR para Maringá - PR', CIDADES)
        ?.cidade.id,
    ).toBe('maringa')
  })
})

describe('encontrarCidadeSemUF', () => {
  it('sem UF e sem acento', () => {
    expect(
      encontrarCidadeSemUF(
        normalizar('demanda em Candido Mota amanhã'),
        CIDADES,
      ),
    ).toEqual({ cidade: CIDADES.find(c => c.id === 'candido-mota') })
  })

  it('homônimo → candidatas', () => {
    expect(encontrarCidadeSemUF('chamado em toledo', CIDADES)).toEqual({
      candidatas: CIDADES.filter(c => c.nome === 'Toledo'),
    })
  })

  it('borda de palavra e nome com menos de 4 letras ignorado', () => {
    expect(encontrarCidadeSemUF('londrinas', CIDADES)).toEqual({})
    expect(encontrarCidadeSemUF('em ita amanha', CIDADES)).toEqual({})
  })

  it('vence o nome mais longo', () => {
    expect(encontrarCidadeSemUF('assis ou ourinhos', CIDADES).cidade?.id).toBe(
      'ourinhos',
    )
  })
})

describe('ehUF', () => {
  it('27 UFs', () => {
    expect(ehUF('PR')).toBe(true)
    expect(ehUF('XX')).toBe(false)
  })
})
