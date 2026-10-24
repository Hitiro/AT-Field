import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { fireEvent, screen, within } from '@testing-library/react-native'

import Home from '@/app/index'

import { renderTela } from './utils'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), dismissTo: jest.fn() }),
}))

describe('Home (TEC-02)', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('mostra os 4 acessos, o mês e o badge de dados de exemplo', async () => {
    await renderTela(<Home />)
    for (const t of ['Resumo do mês', 'Lançar', 'Financeiro', 'Simular']) {
      expect(screen.getByRole('button', { name: t })).toBeOnTheScreen()
    }
    expect(screen.getByText('Outubro')).toBeOnTheScreen()
    expect(screen.getByText('Dados de exemplo')).toBeOnTheScreen()
    expect(screen.getByText('Colar do WhatsApp')).toBeOnTheScreen()
  })

  it('faixa "N lançamentos a revisar" leva a Pendências', async () => {
    await renderTela(<Home />)
    const faixa = screen.getByText('3 lançamentos a revisar')
    await fireEvent.press(faixa)
    expect(mockPush).toHaveBeenCalledWith('/pendencias')
  })

  it('tocar em "Lançar" abre o lançamento rápido', async () => {
    await renderTela(<Home />)
    await fireEvent.press(screen.getByRole('button', { name: 'Lançar' }))
    expect(mockPush).toHaveBeenCalledWith('/lancar')
  })

  it('agenda mostra Hoje (09:00 e 14:00) e Amanhã (TEC-02e)', async () => {
    await renderTela(<Home />)
    const agenda = within(screen.getByTestId('agenda-card'))
    expect(agenda.getByText('Hoje')).toBeOnTheScreen()
    expect(agenda.getByText('Amanhã')).toBeOnTheScreen()
    expect(agenda.getByText(/^09:00–11:00 • Sozic/)).toBeOnTheScreen()
    expect(agenda.getByText(/^14:00–16:00 • Sustento/)).toBeOnTheScreen()
    expect(
      agenda.getByText(/^10:00–12:00 • Sozic • Londrina • ~2 h \(percal\)/),
    ).toBeOnTheScreen()
    expect(agenda.getByText(/^14:00–15:30 • Protege/)).toBeOnTheScreen()
    expect(agenda.getAllByText('a revisar')).toHaveLength(1)
  })

  it('sem atendimentos: "Nada agendado para hoje e amanhã"; sem pendências some a faixa', async () => {
    await renderTela(<Home />, { estadoInicial: { lancamentos: [] } })
    expect(
      screen.getByText('Nada agendado para hoje e amanhã'),
    ).toBeOnTheScreen()
    expect(screen.queryByText(/a revisar/)).toBeNull()
  })
})
