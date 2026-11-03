// Catálogo global de permissões (módulo:ação). Fonte da verdade: a API
// sincroniza esta lista com a tabela `permissions` ao subir.
export const PERMISSIONS = {
  'tenants:read': 'Ver dados da conta',
  'tenants:update': 'Editar dados da conta',
  'users:read': 'Listar e ver usuários',
  'users:create': 'Adicionar usuários',
  'users:update': 'Alterar papel e status de usuários',
  'users:delete': 'Remover usuários da conta',
  'roles:read': 'Listar e ver papéis',
  'roles:create': 'Criar papéis',
  'roles:update': 'Editar papéis',
  'roles:delete': 'Excluir papéis',
} as const

export type PermissionKey = keyof typeof PERMISSIONS

export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[]

export const OWNER_ROLE = 'owner'

// Papéis criados em todo tenant novo (isSystem = true, não editáveis).
export const SYSTEM_ROLES: Record<string, readonly PermissionKey[]> = {
  [OWNER_ROLE]: PERMISSION_KEYS,
  admin: PERMISSION_KEYS.filter(key => key !== 'tenants:update'),
  technician: ['users:read'],
}
