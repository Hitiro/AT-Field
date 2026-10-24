export const DOCUMENT_TYPES = ['CPF', 'CNPJ'] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const MEMBERSHIP_STATUSES = ['invited', 'active', 'suspended'] as const
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number]
