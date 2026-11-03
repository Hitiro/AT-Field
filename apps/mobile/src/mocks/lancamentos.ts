import {
  type Lancamento,
  type LancamentoDespesa,
  type LancamentoServico,
  somarDias,
} from '@at-field/core'

// Lançamentos de exemplo relativos a `hoje` (mês corrente do aparelho).
// Reiniciar o app volta a estes dados (sem persistência).

const CRIADO = '2026-01-01T08:00:00'

function servico(
  p: Partial<LancamentoServico> & { id: string },
): LancamentoServico {
  return {
    tipo: 'servico',
    status: 'confirmado',
    origem: 'completo',
    criadoEm: CRIADO,
    situacao: 'realizado',
    acrescimos: [],
    cobranca: { forma: 'chamado' },
    resultado: 'produtivo',
    recebimento: { status: 'a_receber' },
    ...p,
  }
}

function despesa(
  p: Partial<LancamentoDespesa> & { id: string },
): LancamentoDespesa {
  return {
    tipo: 'despesa',
    status: 'confirmado',
    origem: 'completo',
    criadoEm: CRIADO,
    ...p,
  }
}

const londrina = { nome: 'Londrina', uf: 'PR' }

export function criarLancamentosMock(hoje: string): Lancamento[] {
  const dia = Number(hoje.slice(8, 10))
  // n dias atrás, sem sair do mês corrente
  const atras = (n: number) => somarDias(hoje, -Math.min(n, dia - 1))
  const mais = (n: number) => somarDias(hoje, n)
  const mesPassado = somarDias(hoje, -dia - 5)

  return [
    // ---- Realizados no mês ----
    servico({
      id: 'm-s1',
      data: atras(12),
      empresaId: 'sozic',
      empresaNome: 'Sozic',
      cliente: 'ZARA',
      cidade: londrina,
      valorCentavos: 10000,
      cobranca: { forma: 'chamado', percalMin: 120 },
      duracaoEstimadaMin: 120,
      duracaoRealMin: 180,
      acrescimos: [
        {
          id: 'ac1',
          motivo: 'Aguardando suporte remoto',
          minutos: 60,
          valorCentavos: 5000,
        },
      ],
      avaliacaoClienteFinal: {
        nota: 3,
        motivos: ['local_inseguro'],
        avaliadaEm: atras(12),
      },
      recebimento: { status: 'recebido', recebidoEm: atras(2) },
    }),
    servico({
      id: 'm-s2',
      data: atras(9),
      empresaId: 'sozic',
      empresaNome: 'Sozic',
      cliente: 'Zara',
      cidade: londrina,
      valorCentavos: 10000,
      cobranca: { forma: 'chamado', percalMin: 120 },
      duracaoRealMin: 120,
      avaliacaoClienteFinal: {
        nota: 5,
        motivos: ['local_inseguro'],
        avaliadaEm: atras(9),
      },
    }),
    servico({
      id: 'm-s3',
      data: atras(8),
      empresaId: 'sustento',
      empresaNome: 'Sustento',
      cidade: londrina,
      valorCentavos: 8000,
      cobranca: { forma: 'chamado', percalMin: 240 },
      duracaoRealMin: 90,
      recebimento: { status: 'recebido', recebidoEm: atras(1) },
    }),
    servico({
      id: 'm-s4',
      data: atras(6),
      empresaId: 'central',
      empresaNome: 'Central Field Service',
      cliente: 'Renner',
      cidade: londrina,
      valorCentavos: 12000,
      cobranca: { forma: 'chamado', percalMin: 240 },
      duracaoRealMin: 150,
    }),
    servico({
      id: 'm-s5',
      data: atras(5),
      empresaId: 'aef',
      empresaNome: 'AEF',
      cliente: 'Gmed',
      descricao: 'Manutenção de rede',
      cobranca: { forma: 'hora', valorHoraCentavos: 10000 },
      duracaoRealMin: 180,
    }),
    servico({
      id: 'm-s6',
      data: atras(4),
      empresaId: 'aef',
      empresaNome: 'AEF',
      cliente: 'Gmed',
      descricao: 'Infra de rede + material',
      valorCentavos: 150000,
      cobranca: { forma: 'pacote', incluiMaterial: true },
      duracaoRealMin: 480,
    }),
    servico({
      id: 'm-s7',
      data: atras(3),
      empresaId: 'protege',
      empresaNome: 'Protege',
      cliente: 'Santander',
      cidade: londrina,
      valorCentavos: 9000,
      duracaoRealMin: 60,
      espera: { minutos: 60, motivo: 'liberacao_acesso' },
    }),
    servico({
      id: 'm-s8',
      data: hoje,
      empresaId: 'protege',
      empresaNome: 'Protege',
      cliente: 'Camicado',
      cidade: { nome: 'Apucarana', uf: 'PR' },
      valorCentavos: 9000,
      deslocamento: { kmIda: 40, tempoIdaMin: 40, valorCentavos: 6400 },
      espera: { minutos: 60, motivo: 'liberacao_acesso' },
      resultado: 'improdutivo',
      improdutiva: {
        motivo: 'entrada_nao_liberada',
        registradaEm: `${hoje}T09:40:00`,
        politica: { percentual: 0, pagaDeslocamento: false },
      },
    }),
    // a revisar: um com valor, um sem
    servico({
      id: 'm-s9',
      data: atras(1),
      status: 'a_revisar',
      origem: 'rapido',
      empresaId: 'sozic',
      empresaNome: 'Sozic',
      valorCentavos: 10000,
      cobranca: { forma: 'chamado', percalMin: 120 },
    }),
    servico({
      id: 'm-s10',
      data: atras(2),
      status: 'a_revisar',
      origem: 'rapido',
      empresaId: 'sustento',
      empresaNome: 'Sustento',
      cobranca: { forma: 'chamado', percalMin: 240 },
    }),
    // a receber do mês passado (entra no Financeiro, não no resumo do mês)
    servico({
      id: 'm-ant',
      data: mesPassado,
      empresaId: 'sozic',
      empresaNome: 'Sozic',
      valorCentavos: 10000,
      cobranca: { forma: 'chamado', percalMin: 120 },
      duracaoRealMin: 100,
    }),

    // ---- Despesas do mês ----
    despesa({
      id: 'm-d1',
      data: atras(10),
      categoria: 'combustivel',
      valorCentavos: 25000,
    }),
    despesa({
      id: 'm-d2',
      data: atras(10),
      categoria: 'pedagio',
      valorCentavos: 2600,
    }),
    despesa({
      id: 'm-d3',
      data: atras(9),
      categoria: 'alimentacao',
      valorCentavos: 3500,
    }),
    despesa({
      id: 'm-d4',
      data: atras(6),
      categoria: 'estacionamento',
      valorCentavos: 1500,
    }),
    despesa({
      id: 'm-d5',
      data: atras(3),
      categoria: 'alimentacao',
      valorCentavos: 3000,
    }),
    despesa({
      id: 'm-d6',
      data: atras(1),
      categoria: 'outros',
      valorCentavos: 1200,
    }),

    // ---- Agenda (TEC-02e) ----
    servico({
      id: 'ag-h1',
      situacao: 'agendado',
      data: hoje,
      hora: '09:00',
      duracaoEstimadaMin: 120,
      empresaId: 'sozic',
      empresaNome: 'Sozic',
      cidade: londrina,
      valorCentavos: 10000,
      cobranca: { forma: 'chamado', percalMin: 120 },
    }),
    servico({
      id: 'ag-h2',
      situacao: 'agendado',
      data: hoje,
      hora: '14:00',
      duracaoEstimadaMin: 120,
      empresaId: 'sustento',
      empresaNome: 'Sustento',
      cidade: londrina,
      valorCentavos: 8000,
      cobranca: { forma: 'chamado', percalMin: 240 },
    }),
    servico({
      id: 'ag-a1',
      situacao: 'agendado',
      data: mais(1),
      hora: '14:00',
      duracaoEstimadaMin: 90,
      empresaId: 'protege',
      empresaNome: 'Protege',
      cidade: { nome: 'Maringá', uf: 'PR' },
      valorCentavos: 9000,
    }),
    servico({
      id: 'ag-a2',
      situacao: 'agendado',
      status: 'a_revisar',
      origem: 'rapido',
      data: mais(1),
      hora: '10:00',
      empresaId: 'sozic',
      empresaNome: 'Sozic',
      cidade: londrina,
      cobranca: { forma: 'chamado', percalMin: 120 },
    }),
    servico({
      id: 'ag-p2',
      situacao: 'agendado',
      data: mais(2),
      hora: '08:30',
      duracaoEstimadaMin: 180,
      empresaId: 'central',
      empresaNome: 'Central Field Service',
      cidade: { nome: 'Apucarana', uf: 'PR' },
      valorCentavos: 12000,
      cobranca: { forma: 'chamado', percalMin: 240 },
    }),
    servico({
      id: 'ag-p4',
      situacao: 'agendado',
      data: mais(4),
      empresaId: 'ik',
      empresaNome: 'IK Solution',
      cidade: { nome: 'Cândido Mota', uf: 'SP' },
      valorCentavos: 10000,
    }),
  ]
}
