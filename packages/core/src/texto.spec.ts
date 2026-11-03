import { describe, expect, it } from 'vitest'

import { normalizar } from './texto'

describe('normalizar', () => {
  it('remove acentos e passa para minúsculas', () => {
    expect(normalizar('Cândido MOTA')).toBe('candido mota')
    expect(normalizar('Maringá, Pedágio, ação')).toBe('maringa, pedagio, acao')
  })

  it('colapsa espaços e quebras e apara as pontas', () => {
    expect(normalizar('  Boa \n\t noite  ')).toBe('boa noite')
  })

  it('texto vazio continua vazio', () => {
    expect(normalizar('')).toBe('')
  })
})
