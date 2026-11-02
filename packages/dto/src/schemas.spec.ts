import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import {
  addMemberSchema,
  createRoleSchema,
  personSchema,
  signupSchema,
  TEXT_LIMITS,
  updateMemberSchema,
  updateRoleSchema,
  updateTenantSchema,
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

// Os limites espelham as colunas varchar (apps/api: entidades/migrations).
describe('limites de tamanho = colunas do banco', () => {
  const DOMAIN = '@teste.com'
  const emailOf = (length: number) =>
    `${'a'.repeat(length - DOMAIN.length)}${DOMAIN}`

  // Caminho do primeiro problema, para conferir que aponta o campo.
  const failedPath = (result: { success: boolean; error?: z.ZodError }) =>
    result.error?.issues.map(issue => issue.path.join('.'))

  it('valores das colunas', () => {
    expect(TEXT_LIMITS).toEqual({
      name: 150,
      email: 255,
      phone: 20,
      roleName: 60,
    })
  })

  it('e-mail: 255 aceito, 256 rejeitado no campo email', () => {
    expect(emailOf(255)).toHaveLength(255)
    expect(personSchema.safeParse({ ...owner, email: emailOf(255) }).success).toBe(true)
    const result = personSchema.safeParse({ ...owner, email: emailOf(256) })
    expect(result.success).toBe(false)
    expect(failedPath(result)).toEqual(['email'])
  })

  it('e-mail: o limite vale depois do trim', () => {
    const padded = `  ${emailOf(255)}  `
    expect(personSchema.parse({ ...owner, email: padded }).email).toHaveLength(255)
  })

  it('e-mail longo no auto-cadastro aponta owner.email', () => {
    const result = signupSchema.safeParse({
      tenant: { documentType: 'CPF', document: '529.982.247-25', name: 'Maria' },
      owner: { ...owner, email: emailOf(256) },
    })
    expect(failedPath(result)).toEqual(['owner.email'])
  })

  it('nome: 150 aceito, 151 rejeitado (pessoa e conta)', () => {
    expect(personSchema.safeParse({ ...owner, name: 'a'.repeat(150) }).success).toBe(true)
    expect(failedPath(personSchema.safeParse({ ...owner, name: 'a'.repeat(151) }))).toEqual(['name'])
    expect(updateTenantSchema.safeParse({ name: 'a'.repeat(150) }).success).toBe(true)
    expect(updateTenantSchema.safeParse({ name: 'a'.repeat(151) }).success).toBe(false)
  })

  it('telefone: 20 aceito, 21 rejeitado', () => {
    expect(personSchema.safeParse({ ...owner, phone: '1'.repeat(20) }).success).toBe(true)
    expect(failedPath(personSchema.safeParse({ ...owner, phone: '1'.repeat(21) }))).toEqual(['phone'])
  })

  it('nome de papel: 60 aceito, 61 rejeitado', () => {
    expect(createRoleSchema.safeParse({ name: 'a'.repeat(60) }).success).toBe(true)
    expect(failedPath(createRoleSchema.safeParse({ name: 'a'.repeat(61) }))).toEqual(['name'])
    expect(updateRoleSchema.safeParse({ name: 'a'.repeat(61) }).success).toBe(false)
  })
})
