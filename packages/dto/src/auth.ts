import type { DocumentType, MembershipStatus } from './enums'

// Resposta de GET /me (passo 009a): a pessoa autenticada e os vínculos dela em
// todos os status (o app mostra as contas e os convites pendentes). Sem CPF
// nem firebaseUid.
export type MeMembershipView = {
  tenant: { id: string; name: string; documentType: DocumentType }
  status: MembershipStatus
  role: { id: string; name: string }
}

export type MeResponse = {
  id: string
  name: string
  email: string
  phone: string | null
  cityId: number | null
  memberships: MeMembershipView[]
}
