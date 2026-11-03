import { describe, expect, it } from 'vitest'

import { inferirData, separarMensagens } from './prefixo'

const HOJE = '2026-10-22'

describe('separarMensagens', () => {
  it('remove o prefixo iOS e junta continuações à mensagem anterior', () => {
    const ms = separarMensagens(
      '[16/10, 17:16] [contato] IK Solution: Tenho uma demanda\ncontinuação\n[16/10, 17:22] Outro: Oi',
      HOJE,
    )
    expect(ms).toEqual([
      {
        data: '2026-10-16',
        hora: '17:16',
        remetente: '[contato] IK Solution',
        linhas: ['Tenho uma demanda', 'continuação'],
      },
      { data: '2026-10-16', hora: '17:22', remetente: 'Outro', linhas: ['Oi'] },
    ])
  })

  it('formato Android com ano', () => {
    expect(
      separarMensagens('16/10/2026 17:16 - Fulano: Tem chamado', HOJE),
    ).toEqual([
      {
        data: '2026-10-16',
        hora: '17:16',
        remetente: 'Fulano',
        linhas: ['Tem chamado'],
      },
    ])
  })

  it('iOS com ano de 2 dígitos e segundos; \\r\\n', () => {
    expect(
      separarMensagens(
        '[05/01/26, 08:03:10] +55 43 90000-0001: Bom dia\r\nlinha 2',
        HOJE,
      ),
    ).toEqual([
      {
        data: '2026-01-05',
        hora: '08:03',
        remetente: '+55 43 90000-0001',
        linhas: ['Bom dia', 'linha 2'],
      },
    ])
  })

  it('texto solto antes do primeiro prefixo vira mensagem sem data', () => {
    expect(separarMensagens('solto\n[16/10, 17:16] A: x', HOJE)).toEqual([
      { linhas: ['solto'] },
      { data: '2026-10-16', hora: '17:16', remetente: 'A', linhas: ['x'] },
    ])
  })

  it('prefixo com data impossível é tratado como texto', () => {
    expect(separarMensagens('[40/13, 17:16] A: x', HOJE)).toEqual([
      { linhas: ['[40/13, 17:16] A: x'] },
    ])
  })
})

describe('inferirData', () => {
  it('sem ano: o de hoje; se cair no futuro, ano anterior', () => {
    expect(inferirData(16, 10, undefined, HOJE)).toBe('2026-10-16')
    expect(inferirData(28, 12, undefined, '2026-01-05')).toBe('2025-12-28')
    expect(inferirData(22, 10, undefined, HOJE)).toBe('2026-10-22')
  })

  it('ano do prefixo (2 ou 4 dígitos) prevalece', () => {
    expect(inferirData(1, 2, 25, HOJE)).toBe('2025-02-01')
    expect(inferirData(1, 12, 2026, HOJE)).toBe('2026-12-01')
  })
})
