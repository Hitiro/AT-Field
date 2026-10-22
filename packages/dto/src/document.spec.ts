import {
  isValidCnpj,
  isValidCpf,
  normalizeDocument,
} from './document'

describe('normalizeDocument', () => {
  it('remove tudo que não for dígito', () => {
    expect(normalizeDocument('529.982.247-25')).toBe('52998224725')
    expect(normalizeDocument('11.222.333/0001-81')).toBe('11222333000181')
  })
})

describe('isValidCpf', () => {
  it('aceita CPF válido com ou sem máscara', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('52998224725')).toBe(true)
  })

  it('rejeita dígito verificador errado', () => {
    expect(isValidCpf('529.982.247-26')).toBe(false)
  })

  it('rejeita sequências repetidas', () => {
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCpf('00000000000')).toBe(false)
  })

  it('rejeita tamanho inválido e vazio', () => {
    expect(isValidCpf('')).toBe(false)
    expect(isValidCpf('1234567890')).toBe(false)
    expect(isValidCpf('123456789012')).toBe(false)
  })
})

describe('isValidCnpj', () => {
  it('aceita CNPJ válido com ou sem máscara', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
    expect(isValidCnpj('11222333000181')).toBe(true)
  })

  it('rejeita dígito verificador errado', () => {
    expect(isValidCnpj('11.222.333/0001-82')).toBe(false)
  })

  it('rejeita sequências repetidas', () => {
    expect(isValidCnpj('11111111111111')).toBe(false)
  })

  it('rejeita tamanho inválido e vazio', () => {
    expect(isValidCnpj('')).toBe(false)
    expect(isValidCnpj('1122233300018')).toBe(false)
  })

  it('não confunde CPF com CNPJ', () => {
    expect(isValidCnpj('529.982.247-25')).toBe(false)
    expect(isValidCpf('11.222.333/0001-81')).toBe(false)
  })
})
