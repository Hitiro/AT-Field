import { describe, expect, it } from 'vitest'

import { extrairDataHora, extrairHora } from './datas'

// 2026-10-22 é quinta-feira; 2026-10-26 é segunda.
const QUI = '2026-10-22'

describe('extrairDataHora', () => {
  it('amanhã às 14h (sem prefixo) → relativa, precisa confirmar', () => {
    expect(extrairDataHora('atendimento amanha as 14h', QUI, false)).toEqual({
      valor: '2026-10-23',
      hora: '14:00',
      relativa: true,
      precisaConfirmar: true,
    })
  })

  it('depois de amanhã é testado antes de amanhã', () => {
    expect(extrairDataHora('depois de amanha', QUI, true)?.valor).toBe(
      '2026-10-24',
    )
  })

  it('hoje = referência', () => {
    expect(extrairDataHora('pode ser hoje?', QUI, true)?.valor).toBe(QUI)
  })

  it('dia da semana: próxima ocorrência estritamente depois', () => {
    expect(extrairDataHora('na sexta', QUI, true)?.valor).toBe('2026-10-23')
    expect(extrairDataHora('quinta-feira', QUI, true)?.valor).toBe('2026-10-29')
    expect(extrairDataHora('segunda', '2026-10-26', true)?.valor).toBe(
      '2026-11-02',
    )
    expect(extrairDataHora('sabado ou domingo', QUI, true)?.valor).toBe(
      '2026-10-24',
    )
    expect(extrairDataHora('terca', QUI, true)?.valor).toBe('2026-10-27')
    expect(extrairDataHora('quarta', QUI, true)?.valor).toBe('2026-10-28')
  })

  it('dia 25/10 absoluta; com prefixo não precisa confirmar', () => {
    expect(extrairDataHora('dia 25/10 as 9h30', QUI, true)).toEqual({
      valor: '2026-10-25',
      hora: '09:30',
      relativa: false,
      precisaConfirmar: false,
    })
    expect(extrairDataHora('dia 25/10', QUI, false)?.precisaConfirmar).toBe(
      true,
    )
  })

  it('absoluta antes da referência → ano seguinte; com ano explícito', () => {
    expect(extrairDataHora('dia 05/01', QUI, true)?.valor).toBe('2027-01-05')
    expect(extrairDataHora('em 10/11/2027', QUI, true)?.valor).toBe(
      '2027-11-10',
    )
    expect(extrairDataHora('em 10/11/27', QUI, true)?.valor).toBe('2027-11-10')
  })

  it('data inválida é ignorada', () => {
    expect(extrairDataHora('dia 31/02', QUI, true)).toBeUndefined()
    expect(extrairDataHora('dia 31/02/2026', QUI, true)).toBeUndefined()
  })

  it('"trocar as 2 impressoras amanhã" não vira hora', () => {
    expect(
      extrairDataHora('trocar as 2 impressoras amanha', QUI, false),
    ).toEqual({
      valor: '2026-10-23',
      relativa: true,
      precisaConfirmar: true,
    })
  })

  it('sem data → undefined mesmo com hora', () => {
    expect(extrairDataHora('as 14h', QUI, true)).toBeUndefined()
  })

  it('às 25h é ignorado (data sem hora)', () => {
    expect(extrairDataHora('amanha as 25h', QUI, true)).toEqual({
      valor: '2026-10-23',
      relativa: true,
      precisaConfirmar: true,
    })
  })
})

describe('extrairHora', () => {
  it.each([
    ['as 14h', '14:00'],
    ['as 14h30', '14:30'],
    ['as 14:30', '14:30'],
    ['a partir das 8h', '08:00'],
    ['amanha 8:00 ate as 18h', '08:00'],
    ['ate as 18h, a partir das 9h', '09:00'],
    ['ate as 18h', '18:00'],
    ['chegar 7:45', '07:45'],
    ['as 25h e depois as 10h', '10:00'],
  ])('%s → %s', (t, h) => {
    expect(extrairHora(t)).toBe(h)
  })

  it.each([
    '14h sem preposição',
    'as 9:75',
    'nada',
    '25:00',
    'trocar as 2 impressoras',
    'a partir das 8',
  ])('%s → undefined', t => {
    expect(extrairHora(t)).toBeUndefined()
  })
})
