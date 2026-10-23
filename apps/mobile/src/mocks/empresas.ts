import type { AvaliacaoEmpresa, Empresa, Negociacao } from '@at-field/core'

// Empresas de exemplo (telefones fictícios). Negociação = TEC-20/20a/23a/26/27/29.

const exato = (centavosPorKm: number): Negociacao['deslocamento'] => ({
  centavosPorKm,
  modoKm: 'exato',
  kmMedioPorDestino: {},
})

const minha = (
  empresaId: string,
  nota: number,
  motivos: AvaliacaoEmpresa['motivos'] = [],
): AvaliacaoEmpresa => ({
  empresaId,
  nota,
  motivos,
  atualizadaEm: '2026-10-01',
})

export const EMPRESAS_MOCK: Empresa[] = [
  {
    id: 'sozic',
    nome: 'Sozic',
    naoAtendo: false,
    telefones: [],
    avaliacao: minha('sozic', 8),
    negociacao: {
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
    },
  },
  {
    id: 'sustento',
    nome: 'Sustento',
    naoAtendo: false,
    telefones: [],
    avaliacao: minha('sustento', 6, ['valor_abaixo_combinado']),
    negociacao: {
      formaPadrao: 'chamado',
      tarifas: { chamado: { valorCentavos: 8000, percalMin: 240 } },
      horaAdicional: { paga: false },
      deslocamento: exato(70),
      reembolsaPedagio: false,
    },
  },
  {
    id: 'protege',
    nome: 'Protege',
    naoAtendo: false,
    telefones: [],
    negociacao: {
      formaPadrao: 'chamado',
      tarifas: { chamado: { valorCentavos: 9000 } },
      horaAdicional: { paga: true, valorHoraCentavos: 4000 },
      deslocamento: exato(80),
      reembolsaPedagio: true,
      improdutiva: { percentual: 0, pagaDeslocamento: false },
    },
  },
  {
    id: 'central',
    nome: 'Central Field Service',
    naoAtendo: false,
    telefones: [],
    avaliacao: minha('central', 7),
    negociacao: {
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
    },
  },
  {
    id: 'ik',
    nome: 'IK Solution',
    naoAtendo: false,
    telefones: ['43900000001'],
    negociacao: {
      formaPadrao: 'chamado',
      tarifas: { chamado: { valorCentavos: 10000 } },
      horaAdicional: { paga: false },
      deslocamento: exato(80),
      reembolsaPedagio: true,
    },
  },
  {
    id: 'amparo',
    nome: 'AmparoTécnico',
    naoAtendo: true,
    telefones: [],
    avaliacao: minha('amparo', 2, ['atrasa_pagamento', 'percal_nao_informado']),
    negociacao: {
      formaPadrao: 'chamado',
      tarifas: { chamado: { valorCentavos: 9000, percalMin: 120 } },
      horaAdicional: { paga: false },
      deslocamento: exato(60),
      reembolsaPedagio: false,
    },
  },
  {
    id: 'aef',
    nome: 'AEF',
    naoAtendo: false,
    telefones: [],
    negociacao: {
      formaPadrao: 'hora',
      tarifas: {
        hora: { valorHoraCentavos: 10000 },
        diaria: { valorDiariaCentavos: 60000 },
      },
      horaAdicional: { paga: false },
      deslocamento: exato(80),
      reembolsaPedagio: true,
    },
  },
]
