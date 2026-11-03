import { describe, expect, it } from 'vitest'
import { OWNER_ROLE, PERMISSION_KEYS, SYSTEM_ROLES } from './permissions'

describe('catálogo de permissões', () => {
  it('usa o formato módulo:ação', () => {
    for (const key of PERMISSION_KEYS) {
      expect(key).toMatch(/^[a-z_]+:[a-z_]+$/)
    }
  })

  it('owner tem todas as permissões', () => {
    expect([...SYSTEM_ROLES[OWNER_ROLE]].sort()).toEqual([...PERMISSION_KEYS].sort())
  })

  it('admin não edita a conta', () => {
    expect(SYSTEM_ROLES.admin).not.toContain('tenants:update')
  })

  it('papéis de sistema só usam permissões do catálogo', () => {
    for (const keys of Object.values(SYSTEM_ROLES)) {
      for (const key of keys) expect(PERMISSION_KEYS).toContain(key)
    }
  })
})
