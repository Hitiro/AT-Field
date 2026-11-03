import { describe, expect, it } from 'vitest'
import { citySearchSchema, ufSchema } from './geo'

describe('ufSchema', () => {
  it('normaliza caixa e espaços', () => {
    expect(ufSchema.parse('pr')).toBe('PR')
    expect(ufSchema.parse(' sp ')).toBe('SP')
  })

  it('rejeita formato inválido', () => {
    for (const uf of ['P1', 'PRR', '', 'P', 'p r']) {
      expect(ufSchema.safeParse(uf).success).toBe(false)
    }
  })
})

describe('citySearchSchema', () => {
  it('aplica trim e limite padrão 20', () => {
    expect(citySearchSchema.parse({ q: '  toledo ' })).toEqual({
      q: 'toledo',
      limit: 20,
    })
  })

  it('converte limit vindo da query string e normaliza a UF', () => {
    expect(citySearchSchema.parse({ q: 'to', limit: '5', uf: 'pr' })).toEqual({
      q: 'to',
      limit: 5,
      uf: 'PR',
    })
  })

  it('aceita limit nas bordas 1 e 50', () => {
    expect(citySearchSchema.parse({ q: 'to', limit: '1' }).limit).toBe(1)
    expect(citySearchSchema.parse({ q: 'to', limit: '50' }).limit).toBe(50)
  })

  it('rejeita q curto, ausente ou longo', () => {
    expect(citySearchSchema.safeParse({ q: 'a' }).success).toBe(false)
    expect(citySearchSchema.safeParse({ q: '  a  ' }).success).toBe(false)
    expect(citySearchSchema.safeParse({}).success).toBe(false)
    expect(citySearchSchema.safeParse({ q: 'a'.repeat(61) }).success).toBe(false)
  })

  it('rejeita limit fora de 1..50 ou não inteiro', () => {
    for (const limit of ['0', '51', '2.5', 'abc']) {
      expect(citySearchSchema.safeParse({ q: 'to', limit }).success).toBe(false)
    }
  })

  it('rejeita UF inválida', () => {
    expect(citySearchSchema.safeParse({ q: 'to', uf: 'P1' }).success).toBe(false)
  })
})
