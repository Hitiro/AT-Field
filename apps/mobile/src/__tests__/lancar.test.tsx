import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { fireEvent, screen } from '@testing-library/react-native'

import Lancar from '@/app/lancar'

import { HOJE, espiao, renderTela } from './utils'

const mockDismissTo = jest.fn()
let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    dismissTo: mockDismissTo,
  }),
  useLocalSearchParams: () => mockParams,
}))

describe('Lançamento rápido (TEC-02b)', () => {
  beforeEach(() => {
    mockDismissTo.mockClear()
    mockParams = {}
  })

  it('despesa de alimentação R$ 30,00 → nasce a revisar e volta à Home', async () => {
    mockParams = { tipo: 'despesa' }
    await renderTela(<Lancar />)
    await fireEvent.press(screen.getByRole('button', { name: 'Alimentação' }))
    await fireEvent.changeText(screen.getByLabelText('Valor'), '3000')
    expect(screen.getByDisplayValue('R$ 30,00')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Lançar' }))
    expect(espiao.lancamentos[0]).toMatchObject({
      tipo: 'despesa',
      status: 'a_revisar',
      origem: 'rapido',
      categoria: 'alimentacao',
      valorCentavos: 3000,
      data: HOJE,
    })
    expect(mockDismissTo).toHaveBeenCalledWith('/')
  })

  it('categorias incluem estacionamento e hospedagem', async () => {
    mockParams = { tipo: 'despesa' }
    await renderTela(<Lancar />)
    expect(
      screen.getByRole('button', { name: 'Estacionamento' }),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Hospedagem' })).toBeOnTheScreen()
  })

  it('escolher AEF seleciona "Por hora" com R$ 100,00/h', async () => {
    await renderTela(<Lancar />)
    await fireEvent.press(screen.getByRole('button', { name: 'AEF' }))
    expect(screen.getByRole('tab', { name: 'Por hora' })).toBeSelected()
    expect(screen.getByLabelText('Valor da hora')).toHaveDisplayValue(
      'R$ 100,00',
    )
  })

  it('serviço sem valor nasce a revisar; padrão "Já fiz" (realizado)', async () => {
    await renderTela(<Lancar />)
    await fireEvent.press(screen.getByRole('button', { name: 'Sozic' }))
    await fireEvent.changeText(screen.getByLabelText('Valor (opcional)'), '')
    await fireEvent.press(screen.getByRole('button', { name: 'Lançar' }))
    expect(espiao.lancamentos[0]).toMatchObject({
      tipo: 'servico',
      status: 'a_revisar',
      situacao: 'realizado',
      empresaId: 'sozic',
      cobranca: { forma: 'chamado', percalMin: 120 },
    })
    expect(espiao.lancamentos[0].valorCentavos).toBeUndefined()
  })

  it('agendar amanhã às 14:00 avisa conflito com a Protege (não bloqueia)', async () => {
    await renderTela(<Lancar />)
    await fireEvent.press(screen.getByRole('tab', { name: 'Agendar' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Amanhã' }))
    await fireEvent.changeText(screen.getByLabelText('Hora'), '1400')
    expect(
      screen.getByText('Conflita com Protege, 14:00–15:30'),
    ).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Lançar' }))
    expect(espiao.lancamentos[0]).toMatchObject({
      situacao: 'agendado',
      data: '2026-10-23',
      hora: '14:00',
    })
  })

  it('hora inválida mostra erro de campo e não checa conflito', async () => {
    await renderTela(<Lancar />)
    await fireEvent.press(screen.getByRole('tab', { name: 'Agendar' }))
    await fireEvent.changeText(screen.getByLabelText('Hora'), '2500')
    expect(screen.getByText('Hora inválida (use HH:MM)')).toBeOnTheScreen()
  })

  it('empresa marcada como "não atendo" mostra aviso, mas deixa lançar', async () => {
    await renderTela(<Lancar />)
    await fireEvent.press(screen.getByRole('button', { name: 'AmparoTécnico' }))
    expect(
      screen.getByText("Você marcou AmparoTécnico como 'não atendo'."),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Lançar' })).toBeEnabled()
  })
})
