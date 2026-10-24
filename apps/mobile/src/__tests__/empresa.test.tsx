import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { fireEvent, screen } from '@testing-library/react-native'

import EmpresaTela from '@/app/empresa/[id]'

import { espiao, renderTela } from './utils'

let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}))

describe('Empresa (TEC-70 a 74)', () => {
  beforeEach(() => {
    mockParams = {}
  })

  it('Protege: poucas avaliações e percal não informado', async () => {
    mockParams = { id: 'protege' }
    await renderTela(<EmpresaTela />)
    expect(screen.getByText('Poucas avaliações (3)')).toBeOnTheScreen()
    expect(screen.getByText('Percal: não informado')).toBeOnTheScreen()
    expect(screen.getByText('Não paga')).toBeOnTheScreen()
  })

  it('Sozic: 7,8 e 12 avaliações na rede', async () => {
    mockParams = { id: 'sozic' }
    await renderTela(<EmpresaTela />)
    expect(screen.getByText('7,8 • 12 avaliações')).toBeOnTheScreen()
    expect(screen.getByText('Paga 50% + deslocamento')).toBeOnTheScreen()
  })

  it('avaliar nota 9 + "Atrasa pagamento" atualiza o store', async () => {
    mockParams = { id: 'protege' }
    await renderTela(<EmpresaTela />)
    await fireEvent.press(screen.getByRole('button', { name: '9' }))
    await fireEvent.press(
      screen.getByRole('button', { name: 'Atrasa pagamento' }),
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Salvar avaliação' }),
    )
    expect(
      espiao.empresas.find(e => e.id === 'protege')!.avaliacao,
    ).toMatchObject({
      nota: 9,
      motivos: ['atrasa_pagamento'],
    })
  })

  it('não existe campo de texto público (só comentário privado, telefone e valores)', async () => {
    mockParams = { id: 'sozic' }
    await renderTela(<EmpresaTela />)
    const campos = screen.container
      .queryAll(n => n.type === 'TextInput')
      .map(n => n.props.accessibilityLabel)
    // campos numéricos da negociação + comentário privado + telefone; nenhum texto público
    expect(campos).toEqual([
      'Valor da hora adicional',
      'Comentário privado',
      'Novo número',
    ])
  })

  it('marcar "não atendo" e editar o percal', async () => {
    mockParams = { id: 'protege' }
    await renderTela(<EmpresaTela />)
    await fireEvent(
      screen.getByLabelText('Não atendo esta empresa'),
      'valueChange',
      true,
    )
    expect(espiao.empresas.find(e => e.id === 'protege')!.naoAtendo).toBe(true)
    await fireEvent.press(screen.getByRole('button', { name: '4 h' }))
    expect(
      espiao.empresas.find(e => e.id === 'protege')!.negociacao!.tarifas
        .chamado!.percalMin,
    ).toBe(240)
  })

  it('vincular número já vinculado a outra empresa mostra erro', async () => {
    mockParams = { id: 'sozic' }
    await renderTela(<EmpresaTela />)
    await fireEvent.changeText(
      screen.getByLabelText('Novo número'),
      '43 90000-0001',
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Vincular número' }),
    )
    expect(
      screen.getByText('Número já vinculado à IK Solution'),
    ).toBeOnTheScreen()
  })

  it('motivo sugerido pela improdutiva aparece destacado', async () => {
    mockParams = { id: 'protege', sugerir: 'nao_paga_improdutiva' }
    await renderTela(<EmpresaTela />)
    expect(
      screen.getByRole('button', { name: 'Não paga improdutiva (sugerido)' }),
    ).toBeOnTheScreen()
  })

  it('id inexistente → "Empresa não encontrada"', async () => {
    mockParams = { id: 'x' }
    await renderTela(<EmpresaTela />)
    expect(screen.getByText('Empresa não encontrada')).toBeOnTheScreen()
  })
})
