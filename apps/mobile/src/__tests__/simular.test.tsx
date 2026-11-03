import { describe, expect, it, jest } from '@jest/globals'
import { fireEvent, screen } from '@testing-library/react-native'

import Simular from '@/app/simular'

import { VEICULO_100, renderTela } from './utils'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() }),
}))

describe('Simulação rápida (TEC-49)', () => {
  it('cenário A mostra percal "R$ 25,00/h" e "km pagos: 200"', async () => {
    await renderTela(<Simular />)
    expect(screen.getByText(/R\$ 25,00\/h \(/)).toBeOnTheScreen()
    expect(screen.getByText('km pagos: 200 (exato)')).toBeOnTheScreen()
    expect(
      screen.getByText('Não compensa: abaixo do seu valor/hora'),
    ).toBeOnTheScreen()
  })

  it('Comparar mostra B como melhor', async () => {
    await renderTela(<Simular />)
    await fireEvent.press(screen.getByRole('tab', { name: 'Comparar' }))
    expect(screen.getByText(/^Melhor: B/)).toBeOnTheScreen()
  })

  it('campo inválido esconde o resultado e mostra o erro', async () => {
    await renderTela(<Simular />)
    await fireEvent.changeText(
      screen.getByLabelText('Distância da ida (km)'),
      'abc',
    )
    expect(screen.getByText('Informe um número válido')).toBeOnTheScreen()
    expect(screen.getByText('Preencha os campos destacados')).toBeOnTheScreen()
    expect(screen.queryByText('Resultado')).toBeNull()
  })

  it('por hora (AEF) mostra preço mínimo "R$ 46,67/h"', async () => {
    await renderTela(<Simular />, { estadoInicial: { veiculo: VEICULO_100 } })
    await fireEvent.press(screen.getByRole('tab', { name: 'B' }))
    await fireEvent.press(screen.getByRole('button', { name: 'AEF' }))
    expect(screen.getByRole('tab', { name: 'Hora' })).toBeSelected()
    // cenário 46: sem deslocamento pago, 180 min de atendimento
    await fireEvent.changeText(
      screen.getByLabelText('Deslocamento pago (R$/km)'),
      '',
    )
    await fireEvent.changeText(
      screen.getByLabelText('Atendimento (min)'),
      '180',
    )
    expect(screen.getByText('R$ 46,67/h')).toBeOnTheScreen()
  })

  it('chip da Sozic mostra "Se for improdutiva" com -R$ 20,00', async () => {
    await renderTela(<Simular />, { estadoInicial: { veiculo: VEICULO_100 } })
    await fireEvent.press(screen.getByRole('button', { name: 'Sozic' }))
    expect(
      screen.getByText('km pagos: 200 (média combinada)'),
    ).toBeOnTheScreen()
    expect(
      screen.getByText(/^Se for improdutiva: R\$ 236,00 \(sobra -R\$ 20,00\)/),
    ).toBeOnTheScreen()
  })

  it('sem percal → "Pergunte o percal antes de aceitar"', async () => {
    await renderTela(<Simular />)
    await fireEvent.press(screen.getByRole('tab', { name: 'B' }))
    expect(
      screen.getByText('Pergunte o percal antes de aceitar'),
    ).toBeOnTheScreen()
  })
})
