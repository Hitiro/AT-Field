// Dados de teste compartilhados pelos specs (espelham os mocks do app).
import type { Empresa, Negociacao } from '../empresas'
import type { LancamentoDespesa, LancamentoServico } from '../lancamentos'
import type { CidadeRef } from '../whatsapp/cidades'

export const CIDADES: CidadeRef[] = [
  { id: 'londrina', nome: 'Londrina', uf: 'PR' },
  { id: 'maringa', nome: 'Maringá', uf: 'PR' },
  { id: 'cianorte', nome: 'Cianorte', uf: 'PR' },
  { id: 'apucarana', nome: 'Apucarana', uf: 'PR' },
  { id: 'candido-mota', nome: 'Cândido Mota', uf: 'SP' },
  { id: 'assis', nome: 'Assis', uf: 'SP' },
  { id: 'ourinhos', nome: 'Ourinhos', uf: 'SP' },
  { id: 'toledo-pr', nome: 'Toledo', uf: 'PR' },
  { id: 'toledo-mg', nome: 'Toledo', uf: 'MG' },
  { id: 'ita', nome: 'Itá', uf: 'SC' },
]

const deslocExato = (centavosPorKm: number): Negociacao['deslocamento'] => ({
  centavosPorKm,
  modoKm: 'exato',
  kmMedioPorDestino: {},
})

export const NEG_SOZIC: Negociacao = {
  formaPadrao: 'chamado',
  tarifas: { chamado: { valorCentavos: 10000, percalMin: 120 } },
  horaAdicional: { paga: true, valorHoraCentavos: 5000 },
  deslocamento: {
    centavosPorKm: 80,
    modoKm: 'media',
    kmMedioPorDestino: { maringa: 100, apucarana: 60 },
  },
  reembolsaPedagio: true,
  improdutiva: { percentual: 50, pagaDeslocamento: true },
}

export const NEG_SUSTENTO: Negociacao = {
  formaPadrao: 'chamado',
  tarifas: { chamado: { valorCentavos: 8000, percalMin: 240 } },
  horaAdicional: { paga: false },
  deslocamento: deslocExato(70),
  reembolsaPedagio: false,
}

export const NEG_PROTEGE: Negociacao = {
  formaPadrao: 'chamado',
  tarifas: { chamado: { valorCentavos: 9000 } },
  horaAdicional: { paga: true, valorHoraCentavos: 4000 },
  deslocamento: deslocExato(80),
  reembolsaPedagio: true,
  improdutiva: { percentual: 0, pagaDeslocamento: false },
}

export const NEG_AEF: Negociacao = {
  formaPadrao: 'hora',
  tarifas: {
    hora: { valorHoraCentavos: 10000 },
    diaria: { valorDiariaCentavos: 60000 },
  },
  horaAdicional: { paga: false },
  deslocamento: deslocExato(80),
  reembolsaPedagio: true,
}

const empresa = (
  id: string,
  nome: string,
  negociacao?: Negociacao,
  extra: Partial<Empresa> = {},
): Empresa => ({
  id,
  nome,
  negociacao,
  naoAtendo: false,
  telefones: [],
  ...extra,
})

export const EMPRESAS: Empresa[] = [
  empresa('sozic', 'Sozic', NEG_SOZIC),
  empresa('sustento', 'Sustento', NEG_SUSTENTO),
  empresa('protege', 'Protege', NEG_PROTEGE),
  empresa('central', 'Central Field Service', {
    formaPadrao: 'chamado',
    tarifas: { chamado: { valorCentavos: 12000, percalMin: 240 } },
    horaAdicional: { paga: true, valorHoraCentavos: 3000 },
    deslocamento: {
      centavosPorKm: 90,
      modoKm: 'media',
      kmMedioPorDestino: { londrina: 0 },
    },
    reembolsaPedagio: false,
    improdutiva: { percentual: 100, pagaDeslocamento: true },
  }),
  empresa(
    'ik',
    'IK Solution',
    {
      formaPadrao: 'chamado',
      tarifas: { chamado: { valorCentavos: 10000 } },
      horaAdicional: { paga: false },
      deslocamento: deslocExato(80),
      reembolsaPedagio: true,
    },
    { telefones: ['43900000001'] },
  ),
  empresa(
    'amparo',
    'AmparoTécnico',
    {
      formaPadrao: 'chamado',
      tarifas: { chamado: { valorCentavos: 9000, percalMin: 120 } },
      horaAdicional: { paga: false },
      deslocamento: deslocExato(60),
      reembolsaPedagio: false,
    },
    { naoAtendo: true },
  ),
  empresa('aef', 'AEF', NEG_AEF),
]

export function servico(p: Partial<LancamentoServico> = {}): LancamentoServico {
  return {
    id: 's1',
    tipo: 'servico',
    status: 'confirmado',
    origem: 'completo',
    criadoEm: '2026-10-01T10:00:00Z',
    situacao: 'realizado',
    acrescimos: [],
    cobranca: { forma: 'chamado' },
    resultado: 'produtivo',
    recebimento: { status: 'a_receber' },
    data: '2026-10-10',
    valorCentavos: 10000,
    empresaNome: 'Sozic',
    empresaId: 'sozic',
    ...p,
  }
}

export function despesa(p: Partial<LancamentoDespesa> = {}): LancamentoDespesa {
  return {
    id: 'd1',
    tipo: 'despesa',
    status: 'confirmado',
    origem: 'completo',
    criadoEm: '2026-10-01T10:00:00Z',
    data: '2026-10-10',
    valorCentavos: 3000,
    categoria: 'alimentacao',
    ...p,
  }
}
