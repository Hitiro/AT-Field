import { describe, expect, it } from 'vitest'
import {
  ERROR_CODES,
  ERROR_CODE_PATTERN,
  ERROR_PREFIXES,
  RETIRED_ERROR_CODES,
  errorResponseSchema,
  formatErrorReference,
  isErrorCode,
} from './errors'

// Registro permanente dos códigos já publicados e seus status. Só ganha
// entradas: um código daqui nunca muda de status nem some sem ir para
// RETIRED_ERROR_CODES. (Não usar snapshot: `vitest -u` atualizaria calado.)
const PUBLISHED: Record<string, number> = {
  'GEN-400': 400,
  'GEN-401': 401,
  'GEN-403': 403,
  'GEN-404': 404,
  'GEN-413': 413,
  'GEN-500': 500,
  'VAL-001': 400,
  'DB-001': 409,
  'DB-002': 409,
  'DB-003': 400,
  'TEN-001': 403,
  'TEN-002': 403,
  'TEN-003': 409,
  'USR-001': 409,
  'USR-002': 409,
  'USR-003': 409,
  'USR-004': 400,
  'USR-005': 409,
  'USR-006': 404,
  'USR-007': 400,
  'USR-008': 409,
  'ROL-001': 404,
  'ROL-002': 409,
  'ROL-003': 409,
  'ROL-004': 409,
  'ROL-005': 409,
  'ROL-006': 400,
  'GEO-001': 404,
  'GEO-002': 404,
  // Passo 008, rodada 3: todo status emitido pelo Nest/body-parser + 429 e
  // os erros do Postgres mapeados.
  'GEN-405': 405,
  'GEN-406': 406,
  'GEN-408': 408,
  'GEN-409': 409,
  'GEN-410': 410,
  'GEN-412': 412,
  'GEN-415': 415,
  'GEN-418': 418,
  'GEN-421': 421,
  'GEN-422': 422,
  'GEN-429': 429,
  'GEN-501': 501,
  'GEN-502': 502,
  'GEN-503': 503,
  'GEN-504': 504,
  'GEN-505': 505,
  'DB-004': 400,
  'DB-005': 400,
  'DB-006': 409,
  'DB-007': 400,
  'DB-008': 400,
  'DB-009': 400,
  'DB-010': 409,
  'DB-011': 503,
  'DB-012': 503,
  'DB-013': 400,
}

const entries = Object.entries(ERROR_CODES)

describe('catálogo de códigos de erro', () => {
  it('usa o formato PREFIXO-NNN com prefixo conhecido', () => {
    expect(ERROR_CODE_PATTERN.source).toBe(
      '^(GEN|VAL|DB|TEN|USR|ROL|GEO)-\\d{3}$',
    )
    for (const [code] of entries) {
      expect(code).toMatch(ERROR_CODE_PATTERN)
      expect(ERROR_PREFIXES).toContain(code.split('-')[0])
    }
  })

  it('tem status de erro HTTP e mensagem', () => {
    for (const [, definition] of entries) {
      expect(definition.status).toBeGreaterThanOrEqual(400)
      expect(definition.status).toBeLessThanOrEqual(599)
      expect(definition.message.trim()).not.toBe('')
    }
  })

  it('GEN-NNN usa o próprio status HTTP', () => {
    for (const [code, definition] of entries) {
      if (code.startsWith('GEN-')) {
        expect(definition.status).toBe(Number(code.slice(4)))
      }
    }
  })

  it('não reaproveita códigos aposentados', () => {
    for (const code of RETIRED_ERROR_CODES) {
      expect(Object.keys(ERROR_CODES)).not.toContain(code)
    }
  })

  it('mantém todo código publicado com o mesmo status (ou aposentado)', () => {
    for (const [code, status] of Object.entries(PUBLISHED)) {
      if (RETIRED_ERROR_CODES.includes(code)) continue
      expect(isErrorCode(code), code).toBe(true)
      expect(ERROR_CODES[code as keyof typeof ERROR_CODES].status, code).toBe(
        status,
      )
    }
  })

  it('todo código do catálogo está registrado em PUBLISHED', () => {
    for (const [code] of entries) {
      expect(PUBLISHED, `registre ${code} em PUBLISHED`).toHaveProperty([code])
    }
  })

  it('isErrorCode reconhece só códigos do catálogo', () => {
    expect(isErrorCode('USR-003')).toBe(true)
    expect(isErrorCode('USR-999')).toBe(false)
    expect(isErrorCode('toString')).toBe(false)
    expect(isErrorCode(undefined)).toBe(false)
  })
})

describe('errorResponseSchema', () => {
  it('aceita o formato de erro com e sem details', () => {
    const base = {
      code: 'USR-003',
      message: 'E-mail já cadastrado para outro CPF',
      requestId: 'a1b2c3d4-0000-4000-8000-000000000000',
    }
    expect(errorResponseSchema.safeParse(base).success).toBe(true)
    expect(
      errorResponseSchema.safeParse({ ...base, details: { issues: [] } })
        .success,
    ).toBe(true)
  })

  it('rejeita resposta sem requestId', () => {
    expect(
      errorResponseSchema.safeParse({ code: 'GEN-500', message: 'x' }).success,
    ).toBe(false)
  })
})

describe('formatErrorReference (COM-06)', () => {
  it('mostra o código e os 8 primeiros caracteres do requestId', () => {
    expect(
      formatErrorReference('USR-003', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'),
    ).toBe('Erro USR-003 (ref. a1b2c3d4)')
  })

  it('usa o requestId inteiro quando é curto', () => {
    expect(formatErrorReference('GEN-500', 'abc')).toBe(
      'Erro GEN-500 (ref. abc)',
    )
  })
})
