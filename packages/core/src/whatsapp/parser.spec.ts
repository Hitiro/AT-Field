import { describe, expect, it } from 'vitest'

import { CIDADES, EMPRESAS } from '../__fixtures__/dados'
import { avisosDaEmpresa } from '../empresas'
import { EXEMPLO_1, EXEMPLO_2, EXEMPLO_3 } from './__fixtures__/exemplos'
import { parseDemandaWhatsApp } from './parser'

const HOJE = '2026-10-22'
const opts = { cidades: CIDADES, empresas: EMPRESAS, hoje: HOJE }
const cidade = (id: string) => {
  const c = CIDADES.find(x => x.id === id)!
  return { id: c.id, nome: c.nome, uf: c.uf }
}

describe('parseDemandaWhatsApp — exemplos reais', () => {
  it('Exemplo 1 (Central Field Service)', () => {
    expect(parseDemandaWhatsApp(EXEMPLO_1, opts)).toEqual({
      textoLimpo: [
        'Me chamo [atendente], falo da empresa Central Field Service, estamos expandindo',
        'nossa rede de parceiros técnicos PJ/MEI na sua região.',
        'Estou com uma demanda em sua região.',
        '',
        'estou com chamado ZARA - 7056 Catuai Shop Londrina - PR',
        '',
        'Motivo:  remanejar tgt e impressora',
        'Ferramentas básicas',
        'Testador e identificador',
      ].join('\n'),
      empresa: {
        nome: 'Central Field Service',
        id: 'central',
        origem: 'texto',
      },
      cliente: 'ZARA',
      codigoChamado: '7056',
      local: 'Catuai Shop',
      cidade: cidade('londrina'),
      motivo: 'remanejar tgt e impressora',
      ferramentas: ['Ferramentas básicas', 'Testador e identificador'],
      pedeIndicacao: false,
      observacoes: [],
    })
  })

  it('Exemplo 2 (IK Solution, empresa no remetente)', () => {
    expect(parseDemandaWhatsApp(EXEMPLO_2, opts)).toEqual({
      textoLimpo: [
        'Tenho uma demanda em Candido Mota para um técnico de campo, indicam alguém, em tempo tudo bem como vocês?',
        'Do lado de lá da divisa',
        'Pagamos o deslocamento',
      ].join('\n'),
      remetente: '[contato] IK Solution',
      recebidaEm: { data: '2026-10-16', hora: '17:16' },
      empresa: { nome: 'IK Solution', id: 'ik', origem: 'remetente' },
      cidade: cidade('candido-mota'),
      ferramentas: [],
      deslocamentoPago: true,
      pedeIndicacao: true,
      observacoes: ['Do lado de lá da divisa'],
    })
  })

  it('Exemplo 3 (AmparoTécnico, data relativa)', () => {
    expect(parseDemandaWhatsApp(EXEMPLO_3, opts)).toEqual({
      textoLimpo:
        'Me chamo [atendente] falo da AmparoTécnico, estou com uma demanda em Cianorte/PR, gostaria de verificar se é possivel realizar o atendimento amanhã as 14h',
      empresa: { nome: 'AmparoTécnico', id: 'amparo', origem: 'texto' },
      cidade: cidade('cianorte'),
      ferramentas: [],
      data: {
        valor: '2026-10-23',
        hora: '14:00',
        relativa: true,
        precisaConfirmar: true,
      },
      pedeIndicacao: false,
      observacoes: [],
    })
  })

  it('GWT 38: Exemplo 3 → AmparoTécnico com aviso "não atendo"', () => {
    const d = parseDemandaWhatsApp(EXEMPLO_3, opts)
    expect(d.empresa?.id).toBe('amparo')
    expect(avisosDaEmpresa(EMPRESAS.find(e => e.id === d.empresa?.id))).toEqual(
      ['nao_atendo'],
    )
  })

  it('sem lista de empresas: nomes sem id', () => {
    const d = parseDemandaWhatsApp(EXEMPLO_2, { cidades: CIDADES, hoje: HOJE })
    expect(d.empresa).toEqual({ nome: 'IK Solution', origem: 'remetente' })
  })
})

describe('parseDemandaWhatsApp — casos de borda', () => {
  it('texto vazio ou só ruído → nada reconhecido, sem lançar', () => {
    const vazio = {
      textoLimpo: '',
      ferramentas: [],
      pedeIndicacao: false,
      observacoes: [],
    }
    expect(parseDemandaWhatsApp('', opts)).toEqual(vazio)
    expect(
      parseDemandaWhatsApp('Bom dia!\n🙂👍\nAlguém disponível?', opts),
    ).toEqual(vazio)
  })

  it('"Toledo" sem UF → 2 candidatas', () => {
    const d = parseDemandaWhatsApp('Chamado em Toledo amanhã', opts)
    expect(d.cidade).toBeUndefined()
    expect(d.cidadeCandidatas?.map(c => c.uf)).toEqual(['PR', 'MG'])
  })

  it('"não pagamos o deslocamento" → false; pedágio pago e não pago', () => {
    expect(
      parseDemandaWhatsApp('Não pagamos o deslocamento', opts).deslocamentoPago,
    ).toBe(false)
    expect(
      parseDemandaWhatsApp('Reembolsamos o pedágio', opts).pedagioPago,
    ).toBe(true)
    expect(parseDemandaWhatsApp('Sem pedágio', opts).pedagioPago).toBe(false)
    expect(
      parseDemandaWhatsApp('deslocamento incluso', opts).deslocamentoPago,
    ).toBe(true)
    expect(parseDemandaWhatsApp('pagamos km', opts).deslocamentoPago).toBe(true)
  })

  it.each([
    ['Não pagamos km', false],
    ['Pagamos km', true],
    ['A empresa não paga quilometragem', false],
    ['A empresa paga quilometragem', true],
    ['Não reembolsamos o deslocamento', false],
    ['Reembolsamos o deslocamento', true],
    ['Sem deslocamento, mas o valor é bom', false],
    ['Nunca pagamos o deslocamento', false],
    ['Não temos pressa, pagamos o deslocamento', true],
  ])('deslocamento: "%s" → %s', (texto, esperado) => {
    expect(parseDemandaWhatsApp(texto, opts).deslocamentoPago).toBe(esperado)
  })

  it.each([
    ['Não reembolsamos o pedágio', false],
    ['Reembolsamos o pedágio', true],
    ['A empresa não paga pedágios', false],
    ['Pedágio incluso', true],
  ])('pedágio: "%s" → %s', (texto, esperado) => {
    expect(parseDemandaWhatsApp(texto, opts).pedagioPago).toBe(esperado)
  })

  it('formato Android', () => {
    const d = parseDemandaWhatsApp(
      '16/10/2026 17:16 - Fulano: Demanda em Maringá segunda às 8h',
      opts,
    )
    expect(d.remetente).toBe('Fulano')
    expect(d.recebidaEm).toEqual({ data: '2026-10-16', hora: '17:16' })
    expect(d.empresa).toEqual({ nome: 'Fulano', origem: 'remetente' })
    expect(d.cidade).toEqual(cidade('maringa'))
    // referência = data do prefixo (sex 16/10) → segunda 19/10
    expect(d.data).toEqual({
      valor: '2026-10-19',
      hora: '08:00',
      relativa: true,
      precisaConfirmar: true,
    })
  })

  it('data absoluta no prefixo não precisa confirmar', () => {
    const d = parseDemandaWhatsApp(
      '[20/10, 10:00] X: pode ser dia 25/10 às 9h?',
      opts,
    )
    expect(d.data).toEqual({
      valor: '2026-10-25',
      hora: '09:00',
      relativa: false,
      precisaConfirmar: false,
    })
  })

  it('prefixo 28/12 com hoje 2026-01-05 → ano 2025', () => {
    const d = parseDemandaWhatsApp('[28/12, 09:00] X: amanhã', {
      ...opts,
      hoje: '2026-01-05',
    })
    expect(d.recebidaEm?.data).toBe('2025-12-28')
    expect(d.data?.valor).toBe('2025-12-29')
  })

  it('prefixos com remetentes diferentes → empresa do 1º', () => {
    const d = parseDemandaWhatsApp(
      '[16/10, 17:16] Sozic Fulana: oi\n[16/10, 17:17] Protege: oi',
      opts,
    )
    expect(d.empresa).toEqual({
      nome: 'Sozic',
      id: 'sozic',
      origem: 'remetente',
    })
  })

  it('cidade fora da base → sem cidade', () => {
    const d = parseDemandaWhatsApp('Demanda em Curitiba - PR', opts)
    expect(d.cidade).toBeUndefined()
    expect(d.cidadeCandidatas).toBeUndefined()
  })

  it('"empresa X" e "Ferramentas: a, b" e motivo por "Serviço:"', () => {
    const d = parseDemandaWhatsApp(
      'Somos a empresa Nova Tec.\nServiço: troca de   switch\nFerramentas: alicate, testador; escada\nnotebook\nValor: a combinar',
      { cidades: CIDADES, hoje: HOJE },
    )
    expect(d.empresa).toEqual({ nome: 'Nova Tec', origem: 'texto' })
    expect(d.motivo).toBe('troca de switch')
    expect(d.ferramentas).toEqual(['alicate', 'testador', 'escada', 'notebook'])
  })

  it('"Ferramentas:" sem itens na linha usa as linhas seguintes até a vazia', () => {
    const d = parseDemandaWhatsApp(
      'Ferramentas:\nalicate\nescada\n\nobrigado',
      opts,
    )
    expect(d.ferramentas).toEqual(['alicate', 'escada'])
  })

  it('pede indicação por "indicação"', () => {
    expect(
      parseDemandaWhatsApp('Aceitamos indicação', opts).pedeIndicacao,
    ).toBe(true)
  })
})

describe('parseDemandaWhatsApp — telefone do remetente (Parte C)', () => {
  const ex2Telefone = EXEMPLO_2.replace(
    /\[contato\] IK Solution/g,
    '+55 43 90000-0001',
  )

  it('GWT 35: remetente telefone vinculado → empresa por telefone', () => {
    const d = parseDemandaWhatsApp(ex2Telefone, opts)
    expect(d.empresa).toEqual({
      nome: 'IK Solution',
      id: 'ik',
      origem: 'telefone',
    })
    expect(d.remetenteTelefone).toBe('43900000001')
    expect(d.remetente).toBeUndefined()
  })

  it('GWT 36: telefone sem vínculo → empresa indefinida, telefone preenchido', () => {
    const semVinculo = EMPRESAS.map(e => ({ ...e, telefones: [] }))
    const d = parseDemandaWhatsApp(ex2Telefone, {
      ...opts,
      empresas: semVinculo,
    })
    expect(d.empresa).toBeUndefined()
    expect(d.remetenteTelefone).toBe('43900000001')
  })

  it('GWT 37: texto nomeia a empresa e o telefone é de outra → texto vence', () => {
    const d = parseDemandaWhatsApp(
      '[16/10, 17:16] +55 43 90000-0001: falo da Central Field Service, tem chamado',
      opts,
    )
    expect(d.empresa).toEqual({
      nome: 'Central Field Service',
      id: 'central',
      origem: 'texto',
    })
  })

  it('remetente telefone inválido não vira empresa nem telefone', () => {
    const d = parseDemandaWhatsApp('[16/10, 17:16] 123: oi pessoal', opts)
    expect(d.empresa).toBeUndefined()
    expect(d.remetenteTelefone).toBeUndefined()
  })
})
