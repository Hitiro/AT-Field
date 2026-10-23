import { describe, expect, it } from 'vitest'
import {
  addMemberSchema,
  createRoleSchema,
  personSchema,
  signupSchema,
  updateMemberSchema,
  updateRoleSchema,
} from './schemas'

const owner = {
  cpf: '529.982.247-25',
  name: 'Maria Silva',
  email: ' Maria@Exemplo.com ',
}

describe('personSchema', () => {
  it('normaliza CPF e e-mail', () => {
    const person = personSchema.parse(owner)
    expect(person.cpf).toBe('52998224725')
    expect(person.email).toBe('maria@exemplo.com')
  })

  it('rejeita CPF inválido e e-mail inválido', () => {
    expect(personSchema.safeParse({ ...owner, cpf: '111.111.111-11' }).success).toBe(false)
    expect(personSchema.safeParse({ ...owner, email: 'maria' }).success).toBe(false)
  })

  it('rejeita nome curto e cidade não positiva', () => {
    expect(personSchema.safeParse({ ...owner, name: 'M' }).success).toBe(false)
    expect(personSchema.safeParse({ ...owner, cityId: 0 }).success).toBe(false)
  })
})

describe('signupSchema', () => {
  it('aceita conta CNPJ e normaliza o documento', () => {
    const result = signupSchema.parse({
      tenant: { documentType: 'CNPJ', document: '11.222.333/0001-81', name: 'Empresa X' },
      owner,
    })
    expect(result.tenant.document).toBe('11222333000181')
  })

  it('aceita conta CPF (autônomo)', () => {
    const result = signupSchema.safeParse({
      tenant: { documentType: 'CPF', document: '529.982.247-25', name: 'Maria Autônoma' },
      owner,
    })
    expect(result.success).toBe(true)
  })

  it('valida o documento conforme o tipo', () => {
    const result = signupSchema.safeParse({
      tenant: { documentType: 'CPF', document: '11.222.333/0001-81', name: 'Errado' },
      owner,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['tenant', 'document'])
  })

  it('rejeita tipo de documento desconhecido', () => {
    const result = signupSchema.safeParse({
      tenant: { documentType: 'RG', document: '123', name: 'Errado' },
      owner,
    })
    expect(result.success).toBe(false)
  })
})

describe('addMemberSchema', () => {
  it('exige roleId uuid', () => {
    expect(addMemberSchema.safeParse({ ...owner, roleId: 'abc' }).success).toBe(false)
    expect(
      addMemberSchema.safeParse({ ...owner, roleId: '3f1c2b9e-8a4d-4c6e-9b7a-1d2e3f4a5b6c' }).success,
    ).toBe(true)
  })
})

describe('updateMemberSchema', () => {
  it('exige roleId ou status', () => {
    expect(updateMemberSchema.safeParse({}).success).toBe(false)
    expect(updateMemberSchema.safeParse({ status: 'suspended' }).success).toBe(true)
  })

  it('rejeita status desconhecido', () => {
    expect(updateMemberSchema.safeParse({ status: 'banned' }).success).toBe(false)
  })
})

describe('role schemas', () => {
  it('createRoleSchema usa lista vazia por padrão', () => {
    expect(createRoleSchema.parse({ name: 'Financeiro' }).permissions).toEqual([])
  })

  it('updateRoleSchema exige name ou permissions', () => {
    expect(updateRoleSchema.safeParse({}).success).toBe(false)
    expect(updateRoleSchema.safeParse({ permissions: [] }).success).toBe(true)
  })
})
