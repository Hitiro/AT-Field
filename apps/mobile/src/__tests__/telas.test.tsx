import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { fireEvent, screen } from '@testing-library/react-native'

import Agenda from '@/app/agenda'
import Empresas from '@/app/empresas'
import Financeiro from '@/app/financeiro'
import Pendencias from '@/app/pendencias'
import Resumo from '@/app/resumo'
import VeiculoTela from '@/app/veiculo'

import { renderTela } from './utils'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), dismissTo: jest.fn() }),
}))

describe('telas de consulta', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('Resumo do mês: totais, não revisados e improdutivas (TEC-02a)', async () => {
    await renderTela(<Resumo />)
    expect(screen.getByText('Outubro de 2026')).toBeOnTheScreen()
    expect(screen.getByText('Inclui 1 não revisado.')).toBeOnTheScreen()
    expect(
      screen.getByText(/1 lançamento sem valor ou sem data/),
    ).toBeOnTheScreen()
    expect(
      screen.getByText(/1 improdutiva • deixou de receber R\$ 154,00/),
    ).toBeOnTheScreen()
    expect(screen.getByText('AEF')).toBeOnTheScreen()
  })

  it('Financeiro: a receber, recebido e despesas com todas as categorias (TEC-02c)', async () => {
    await renderTela(<Financeiro />)
    for (const c of [
      'Combustível',
      'Pedágio',
      'Estacionamento',
      'Alimentação',
      'Hospedagem',
      'Outros',
    ]) {
      expect(screen.getByText(c)).toBeOnTheScreen()
    }
    expect(screen.getByText('Recebido em outubro')).toBeOnTheScreen()
  })

  it('Pendências lista o que falta e abre o lançamento', async () => {
    await renderTela(<Pendencias />)
    expect(screen.getByText(/Serviço • 20\/10 • sem valor/)).toBeOnTheScreen()
    await fireEvent.press(screen.getByText(/Serviço • 20\/10 • sem valor/))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/lancamento/[id]',
      params: { id: 'm-s10' },
    })
  })

  it('Agenda dos próximos 7 dias com rótulos de dia da semana', async () => {
    await renderTela(<Agenda />)
    for (const r of ['Hoje', 'Amanhã', 'sáb., 24/10', 'seg., 26/10']) {
      expect(screen.getByText(r)).toBeOnTheScreen()
    }
    expect(
      screen.getByText(/^a combinar • IK Solution • Cândido Mota/),
    ).toBeOnTheScreen()
  })

  it('Empresas: badge "não atendo" e rede', async () => {
    await renderTela(<Empresas />)
    expect(screen.getByText('não atendo')).toBeOnTheScreen()
    expect(screen.getByText('minha nota 8 • rede 7,8 (12)')).toBeOnTheScreen()
  })

  it('Veículo: total por km com divisão e "Estimativa"; consumo 0 não salva (TEC-47)', async () => {
    await renderTela(<VeiculoTela />)
    expect(screen.getByText('Estimativa')).toBeOnTheScreen()
    expect(screen.getByText('R$ 0,45/km')).toBeOnTheScreen()
    expect(screen.getByText('R$ 0,30/km')).toBeOnTheScreen()
    expect(screen.getByText('R$ 0,75/km')).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByLabelText('Consumo (km/l)'), '0')
    expect(
      screen.getByText('Informe o consumo (maior que zero)'),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
    await fireEvent.changeText(screen.getByLabelText('Consumo (km/l)'), '10')
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    expect(screen.getByRole('button', { name: 'Salvo' })).toBeOnTheScreen()
  })
})
