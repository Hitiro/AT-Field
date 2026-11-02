import { z } from 'zod'
import { isValidCnpj, isValidCpf, normalizeDocument } from './document'
import { DOCUMENT_TYPES, MEMBERSHIP_STATUSES } from './enums'

// Tamanho máximo de cada texto = tamanho da coluna varchar no banco
// (entidades/migrations da API). Texto maior é barrado aqui (VAL-001 com o
// campo), nunca pelo Postgres (DB-007). Coluna nova ou alterada: atualize.
export const TEXT_LIMITS = {
  name: 150, // tenants.name, users.name
  email: 255, // users.email
  phone: 20, // users.phone
  roleName: 60, // roles.name
} as const

const nameSchema = z.string().trim().min(2).max(TEXT_LIMITS.name)

export const cpfSchema = z
  .string()
  .transform(normalizeDocument)
  .refine(isValidCpf, 'CPF inválido')

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(TEXT_LIMITS.email))

export const personSchema = z.object({
  cpf: cpfSchema,
  name: nameSchema,
  email: emailSchema,
  phone: z.string().trim().min(8).max(TEXT_LIMITS.phone).optional(),
  cityId: z.number().int().positive().optional(),
})

export const tenantSchema = z
  .object({
    documentType: z.enum(DOCUMENT_TYPES),
    document: z.string().transform(normalizeDocument),
    name: nameSchema,
  })
  .superRefine((value, ctx) => {
    const valid =
      value.documentType === 'CPF'
        ? isValidCpf(value.document)
        : isValidCnpj(value.document)
    if (!valid) {
      ctx.addIssue({
        code: 'custom',
        path: ['document'],
        message: `${value.documentType} inválido`,
      })
    }
  })

// Auto-cadastro público: cria a conta e o primeiro usuário (owner).
export const signupSchema = z.object({
  tenant: tenantSchema,
  owner: personSchema,
})

export const updateTenantSchema = z.object({ name: nameSchema })

export const addMemberSchema = personSchema.extend({ roleId: z.uuid() })

export const updateMemberSchema = z
  .object({
    roleId: z.uuid().optional(),
    status: z.enum(MEMBERSHIP_STATUSES).optional(),
  })
  .refine(value => value.roleId || value.status, 'Informe roleId ou status')

const roleNameSchema = z.string().trim().min(2).max(TEXT_LIMITS.roleName)
const permissionListSchema = z.array(z.string()).max(100)

export const createRoleSchema = z.object({
  name: roleNameSchema,
  permissions: permissionListSchema.default([]),
})

export const updateRoleSchema = z
  .object({
    name: roleNameSchema.optional(),
    permissions: permissionListSchema.optional(),
  })
  .refine(
    value => value.name || value.permissions,
    'Informe name ou permissions',
  )

export type SignupInput = z.input<typeof signupSchema>
export type Signup = z.output<typeof signupSchema>
export type Person = z.output<typeof personSchema>
export type UpdateTenant = z.output<typeof updateTenantSchema>
export type AddMember = z.output<typeof addMemberSchema>
export type UpdateMember = z.output<typeof updateMemberSchema>
export type CreateRole = z.output<typeof createRoleSchema>
export type UpdateRole = z.output<typeof updateRoleSchema>
