import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { fireEvent, screen } from '@testing-library/react-native'

import type { LancamentoDespesa, LancamentoServico } from '@at-field/core'

import LancamentoTela from '@/app/lancamento/[id]'

import { VEICULO_100, espiao, renderTela } from './utils'

let mockParams: Record<string, string> = {}
const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), dismissTo: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}))

const servico = (id: string) => espiao.lancamentos.find(l => l.id === id)!

describe('Lançamento', () => {
  beforeEach(() => {
    mockParams = {}
    mockPush.mockClear()
  })

  it('id inexistente → "Lançamento não encontrado"', async () => {
    mockParams = { id: 'nao-existe' }
    await renderTela(<LancamentoTela />)
    expect(screen.getByText('Lançamento não encontrado')).toBeOnTheScreen()
  })

  it('a revisar sem valor: Confirmar desabilitado com a lista do que falta', async () => {
    mockParams = { id: 'm-s10' }
    await renderTela(<LancamentoTela />)
    expect(screen.getByTestId('falta')).toHaveTextContent('Falta: sem valor')
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
    await fireEvent.changeText(
      screen.getByLabelText('Valor do chamado'),
      '8000',
    )
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeEnabled()
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }))
    expect(servico('m-s10').status).toBe('confirmado')
  })

  it('trocar para Pacote + "Inclui material" mostra o total', async () => {
    mockParams = { id: 'm-s2' }
    await renderTela(<LancamentoTela />)
    await fireEvent.press(screen.getByRole('tab', { name: 'Pacote' }))
    await fireEvent(
      screen.getByLabelText('Inclui material'),
      'valueChange',
      true,
    )
    expect(servico('m-s2')).toMatchObject({
      cobranca: { forma: 'pacote', incluiMaterial: true },
      valorCentavos: 10000,
    })
    expect(screen.getByText('R$ 100,00', { exact: true })).toBeOnTheScreen()
  })

  it('serviço realizado: avaliar cliente final nota 4 + "Local inseguro" mostra o histórico', async () => {
    mockParams = { id: 'm-s4' }
    await renderTela(<LancamentoTela />)
    expect(
      screen.getByText('Não é a nota da empresa contratante. Só você vê.'),
    ).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: '4' }))
    await fireEvent.press(
      screen.getByRole('button', { name: 'Local inseguro' }),
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Salvar avaliação do cliente' }),
    )
    expect(screen.getByTestId('historico-cliente')).toHaveTextContent(
      'Você já atendeu Renner 1× • média 4,0 • Local inseguro',
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Limpar avaliação' }),
    )
    expect(screen.queryByTestId('historico-cliente')).toBeNull()
  })

  it('agendado: a seção Cliente final não aparece', async () => {
    mockParams = { id: 'ag-h1' }
    await renderTela(<LancamentoTela />)
    expect(screen.queryByText('Cliente final')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Marcar como realizado' }),
    ).toBeOnTheScreen()
  })

  it('Protege com espera: "No local 2 h"', async () => {
    mockParams = { id: 'm-s7' }
    await renderTela(<LancamentoTela />)
    expect(
      screen.getByText(
        'Atendimento 1 h • Espera 1 h (Liberação de acesso) • No local 2 h • Previsto 2 h (padrão)',
      ),
    ).toBeOnTheScreen()
  })

  it('espera de 60 min na Sozic (real 120) → sugestão pela negociação e motivo sugerido', async () => {
    mockParams = { id: 'm-s2' }
    await renderTela(<LancamentoTela />)
    expect(
      screen.queryByRole('button', { name: 'Sugerir pela negociação' }),
    ).toBeNull()
    await fireEvent.changeText(screen.getByLabelText('Espera (min)'), '60')
    await fireEvent.press(
      screen.getByRole('button', { name: 'Liberação de acesso' }),
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Registrar espera' }),
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Sugerir pela negociação' }),
    )
    expect(screen.getByLabelText('Motivo do acréscimo')).toHaveDisplayValue(
      'Tempo de espera (Liberação de acesso): 60 min',
    )
    expect(screen.getByLabelText('Valor do acréscimo')).toHaveDisplayValue(
      'R$ 50,00',
    )
    expect(
      screen.getByRole('button', {
        name: 'Acesso difícil / espera para liberar (Sugerido pela espera)',
      }),
    ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar acréscimo' }),
    )
    expect(servico('m-s2')).toMatchObject({
      acrescimos: [
        {
          motivo: 'Tempo de espera (Liberação de acesso): 60 min',
          minutos: 60,
          valorCentavos: 5000,
        },
      ],
    })
  })

  it('improdutiva da Protege: prejuízo com custo/km 100', async () => {
    mockParams = { id: 'm-s8' }
    await renderTela(<LancamentoTela />, {
      estadoInicial: { veiculo: VEICULO_100 },
    })
    expect(screen.getByText(/Deixou de receber R\$ 154,00/)).toBeOnTheScreen()
    expect(
      screen.getByText(
        /Ida e volta custou R\$ 80,00 \(80 km\) • Tempo perdido 2 h 20/,
      ),
    ).toBeOnTheScreen()
    expect(screen.getByText('Resultado -R$ 80,00')).toBeOnTheScreen()
    expect(screen.getByText('Protege: não paga improdutiva')).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Avaliar Protege' }),
    )
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/empresa/[id]',
      params: { id: 'protege', sugerir: 'nao_paga_improdutiva' },
    })
  })

  it('marcar chamado da Sozic como improdutivo: total pela política de 50% e motivo gravado', async () => {
    mockParams = { id: 'm-s2' }
    await renderTela(<LancamentoTela />)
    await fireEvent.press(screen.getByRole('tab', { name: 'Improdutivo' }))
    await fireEvent.press(
      screen.getByRole('button', { name: 'Responsável/gerente ausente' }),
    )
    expect(servico('m-s2')).toMatchObject({
      resultado: 'improdutivo',
      improdutiva: {
        motivo: 'responsavel_ausente',
        politica: { percentual: 50, pagaDeslocamento: true },
      },
    })
    expect(screen.getByText('R$ 50,00', { exact: true })).toBeOnTheScreen()
    expect(
      screen.getByText(/^Registrado: Responsável\/gerente ausente em /),
    ).toBeOnTheScreen()
    expect(screen.getByText('Sozic: paga 50% + deslocamento')).toBeOnTheScreen()
    expect(
      screen.getByText('Acréscimos lançados continuam somando.'),
    ).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('tab', { name: 'Produtivo' }))
    expect(servico('m-s2')).toMatchObject({ resultado: 'produtivo' })
  })

  it('despesa rápida sem categoria: escolher a categoria libera e confirma', async () => {
    const despesa: LancamentoDespesa = {
      id: 'd-rapida',
      tipo: 'despesa',
      status: 'a_revisar',
      origem: 'rapido',
      criadoEm: '2026-10-22T10:00:00',
      data: '2026-10-22',
      valorCentavos: 1500,
    }
    mockParams = { id: 'd-rapida' }
    await renderTela(<LancamentoTela />, {
      estadoInicial: { lancamentos: [despesa] },
    })
    expect(screen.getByTestId('falta')).toHaveTextContent(
      'Falta: sem categoria',
    )
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
    await fireEvent.press(screen.getByRole('button', { name: 'Hospedagem' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }))
    expect(servico('d-rapida')).toMatchObject({
      categoria: 'hospedagem',
      status: 'confirmado',
    })
  })

  it('conflito usa a duração prevista do próprio serviço (09:00 com 1 h × 10:00)', async () => {
    const agendado = (
      p: Partial<LancamentoServico> & { id: string },
    ): LancamentoServico => ({
      tipo: 'servico',
      status: 'confirmado',
      origem: 'completo',
      criadoEm: '2026-10-22T08:00:00',
      situacao: 'agendado',
      acrescimos: [],
      cobranca: { forma: 'chamado' },
      resultado: 'produtivo',
      recebimento: { status: 'a_receber' },
      data: '2026-10-23',
      empresaNome: 'Sozic',
      ...p,
    })
    const lancamentos = [
      agendado({ id: 'cedo', hora: '09:00', duracaoEstimadaMin: 60 }),
      agendado({ id: 'depois', hora: '10:00', duracaoEstimadaMin: 60 }),
    ]
    mockParams = { id: 'cedo' }
    await renderTela(<LancamentoTela />, { estadoInicial: { lancamentos } })
    expect(screen.queryByText(/^Conflita com/)).toBeNull()
    // com 2 h, passa a conflitar
    await fireEvent.changeText(
      screen.getByLabelText('Duração estimada (min)'),
      '120',
    )
    expect(
      screen.getByText('Conflita com Sozic, 10:00–11:00'),
    ).toBeOnTheScreen()
  })

  it('"Registrado em": reflete a digitação, data inválida dá erro e válida grava sem mudar a política', async () => {
    mockParams = { id: 'm-s8' }
    await renderTela(<LancamentoTela />)
    const campo = screen.getByLabelText('Registrado em')
    await fireEvent.changeText(campo, 'ontem')
    expect(screen.getByLabelText('Registrado em')).toHaveDisplayValue('ontem')
    expect(
      screen.getByText('Data e hora inválidas (AAAA-MM-DDTHH:MM)'),
    ).toBeOnTheScreen()
    expect(servico('m-s8')).toMatchObject({
      improdutiva: { registradaEm: '2026-10-22T09:40:00' },
    })
    await fireEvent.changeText(campo, '2026-10-22T10:15')
    expect(servico('m-s8')).toMatchObject({
      improdutiva: {
        motivo: 'entrada_nao_liberada',
        registradaEm: '2026-10-22T10:15',
        politica: { percentual: 0, pagaDeslocamento: false },
      },
    })
  })
})
