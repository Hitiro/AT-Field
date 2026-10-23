import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { fireEvent, screen } from '@testing-library/react-native'

import Whatsapp from '@/app/whatsapp'
import { EXEMPLOS_WHATSAPP } from '@/mocks/exemplos-whatsapp'

import { espiao, renderTela } from './utils'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), dismissTo: jest.fn() }),
}))

describe('Colar do WhatsApp', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('Exemplo 1: campos extraídos e "Criar lançamento a revisar"', async () => {
    await renderTela(<Whatsapp />)
    await fireEvent.press(screen.getByRole('button', { name: 'Exemplo 1' }))
    expect(screen.getByText(/^Central Field Service/)).toBeOnTheScreen()
    expect(screen.getByLabelText('Cliente final')).toHaveDisplayValue('ZARA')
    expect(screen.getByLabelText('Local')).toHaveDisplayValue('Catuai Shop')
    expect(screen.getByText('Londrina/PR')).toBeOnTheScreen()
    expect(
      screen.getByText('Ferramentas básicas; Testador e identificador'),
    ).toBeOnTheScreen()
    // histórico do cliente final (2 serviços ZARA/Zara avaliados nos mocks)
    expect(screen.getByTestId('historico-cliente')).toHaveTextContent(
      'Você já atendeu ZARA 2× • média 4,0 • Local inseguro',
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Criar lançamento a revisar' }),
    )
    expect(espiao.lancamentos[0]).toMatchObject({
      status: 'a_revisar',
      origem: 'whatsapp',
      situacao: 'agendado',
      empresaId: 'central',
      cliente: 'ZARA',
      codigoChamado: '7056',
    })
    expect(espiao.lancamentos[0].valorCentavos).toBeUndefined()
    expect(mockPush).toHaveBeenCalledWith('/pendencias')
  })

  it('apagar o cliente final tira o cliente do rascunho', async () => {
    await renderTela(<Whatsapp />)
    await fireEvent.press(screen.getByRole('button', { name: 'Exemplo 1' }))
    await fireEvent.changeText(screen.getByLabelText('Cliente final'), '')
    expect(screen.getByLabelText('Cliente final')).toHaveDisplayValue('')
    await fireEvent.press(
      screen.getByRole('button', { name: 'Criar lançamento a revisar' }),
    )
    expect(espiao.lancamentos[0]).toMatchObject({
      origem: 'whatsapp',
      codigoChamado: '7056',
    })
    expect(espiao.lancamentos[0]).not.toHaveProperty('cliente')
  })

  it('Exemplo 2 mostra "Pergunte o percal antes de aceitar."', async () => {
    await renderTela(<Whatsapp />)
    await fireEvent.press(screen.getByRole('button', { name: 'Exemplo 2' }))
    expect(
      screen.getByText('Pergunte o percal antes de aceitar.'),
    ).toBeOnTheScreen()
    expect(screen.getByText('Cândido Mota/SP')).toBeOnTheScreen()
    expect(screen.getByText('Pede indicação de técnico')).toBeOnTheScreen()
  })

  it('Exemplo 3 mostra "não atendo" e o conflito com a Protege', async () => {
    await renderTela(<Whatsapp />)
    await fireEvent.press(screen.getByRole('button', { name: 'Exemplo 3' }))
    expect(
      screen.getByText("Você marcou AmparoTécnico como 'não atendo'."),
    ).toBeOnTheScreen()
    expect(screen.getByText(/^Conflita com Protege/)).toBeOnTheScreen()
    expect(screen.getByText('23/10 às 14:00 (confirme)')).toBeOnTheScreen()
  })

  it('remetente telefone sem vínculo → vincular à IK Solution relê com origem telefone', async () => {
    await renderTela(<Whatsapp />)
    const texto = EXEMPLOS_WHATSAPP[1].replace(
      /\[contato\] IK Solution/g,
      '+55 43 98888-7777',
    )
    await fireEvent.changeText(screen.getByLabelText('Mensagem'), texto)
    await fireEvent.press(screen.getByRole('button', { name: 'Ler mensagem' }))
    expect(screen.getByText('Vincular este número a…')).toBeOnTheScreen()
    expect(screen.getByText('Só você vê')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'IK Solution' }))
    expect(espiao.empresas.find(e => e.id === 'ik')!.telefones).toContain(
      '43988887777',
    )
    expect(screen.getByText('(pelo telefone vinculado)')).toBeOnTheScreen()
    expect(screen.queryByText('Vincular este número a…')).toBeNull()
  })

  it('número já vinculado a outra empresa não é movido em silêncio', async () => {
    await renderTela(<Whatsapp />)
    const texto = '[16/10, 17:16] +55 43 90000-0001: falo da Sozic, tem chamado'
    await fireEvent.changeText(screen.getByLabelText('Mensagem'), texto)
    await fireEvent.press(screen.getByRole('button', { name: 'Ler mensagem' }))
    await fireEvent.press(screen.getAllByRole('button', { name: 'Sozic' })[0])
    expect(
      screen.getByText('Número já vinculado à IK Solution'),
    ).toBeOnTheScreen()
  })

  it('texto só com ruído → "Nada reconhecido", e criar continua disponível', async () => {
    await renderTela(<Whatsapp />)
    await fireEvent.changeText(
      screen.getByLabelText('Mensagem'),
      'Boa noite!\nAlguém?',
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Ler mensagem' }))
    expect(screen.getByText('Nada reconhecido')).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Criar lançamento a revisar' }),
    ).toBeEnabled()
  })

  it('"Toledo" sem UF → chips das candidatas', async () => {
    await renderTela(<Whatsapp />)
    await fireEvent.changeText(
      screen.getByLabelText('Mensagem'),
      'Chamado em Toledo',
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Ler mensagem' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Toledo/MG' }))
    expect(screen.getByText('Toledo/MG')).toBeOnTheScreen()
  })
})
