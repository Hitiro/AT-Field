import { describe, expect, it } from 'vitest'

import {
  type Espera,
  motivosClienteSugeridosPelaEspera,
  validarEspera,
} from './espera'

describe('validarEspera', () => {
  it('aceita 1 a 1440 minutos com motivo da lista', () => {
    expect(validarEspera({ minutos: 1, motivo: 'outro' })).toEqual([])
    expect(validarEspera({ minutos: 1440, motivo: 'suporte_remoto' })).toEqual(
      [],
    )
  })

  it.each([0, -5, 1441, 30.5])('GWT 60: minutos %d → erro', minutos => {
    expect(validarEspera({ minutos, motivo: 'liberacao_acesso' })).toEqual([
      { campo: 'minutos', mensagem: 'Espera deve ser de 1 a 1440 minutos' },
    ])
  })

  it('GWT 60: motivo fora da lista → erro', () => {
    expect(
      validarEspera({ minutos: 10, motivo: 'almoco' } as unknown as Espera),
    ).toEqual([{ campo: 'motivo', mensagem: 'Motivo fora da lista' }])
  })
})

describe('motivosClienteSugeridosPelaEspera', () => {
  it('GWT 61', () => {
    expect(
      motivosClienteSugeridosPelaEspera({
        minutos: 60,
        motivo: 'liberacao_acesso',
      }),
    ).toEqual(['acesso_dificil_espera_liberacao'])
    expect(
      motivosClienteSugeridosPelaEspera({
        minutos: 60,
        motivo: 'responsavel_ausente',
      }),
    ).toEqual(['responsavel_ausente'])
    expect(
      motivosClienteSugeridosPelaEspera({
        minutos: 60,
        motivo: 'suporte_remoto',
      }),
    ).toEqual([])
    expect(
      motivosClienteSugeridosPelaEspera({ minutos: 60, motivo: 'outro' }),
    ).toEqual([])
    expect(motivosClienteSugeridosPelaEspera()).toEqual([])
  })
})
