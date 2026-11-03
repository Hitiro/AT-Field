// TEC-02b / TEC-45: lançamentos (serviços e despesas) e o que falta para confirmar.
import type { AvaliacaoClienteFinal } from './cliente-final'
import {
  type CobrancaServico,
  minutosCobradosPorHora,
  novaCobranca,
} from './cobranca'
import type { Negociacao } from './empresas'
import type { Espera } from './espera'
import type { RegistroImprodutiva } from './improdutiva'
import type { DemandaExtraida } from './whatsapp/parser'

export const CATEGORIAS_DESPESA = [
  'combustivel',
  'pedagio',
  'estacionamento',
  'alimentacao',
  'hospedagem',
  'outros',
] as const
export type CategoriaDespesa = (typeof CATEGORIAS_DESPESA)[number]

export const ROTULOS_CATEGORIA: Record<CategoriaDespesa, string> = {
  combustivel: 'Combustível',
  pedagio: 'Pedágio',
  estacionamento: 'Estacionamento',
  alimentacao: 'Alimentação',
  hospedagem: 'Hospedagem',
  outros: 'Outros',
}

type Base = {
  id: string
  status: 'a_revisar' | 'confirmado'
  /** Dia do lançamento (YYYY-MM-DD). */
  data?: string
  valorCentavos?: number
  descricao?: string
  origem: 'rapido' | 'whatsapp' | 'completo'
  criadoEm: string
}

/** Item do chamado além do valor base (TEC-25), com motivo. */
export type Acrescimo = {
  id: string
  motivo: string
  minutos?: number
  valorCentavos: number
}

export type LancamentoServico = Base & {
  tipo: 'servico'
  situacao: 'agendado' | 'realizado'
  /** Início 'HH:MM'; o dia é `data`. */
  hora?: string
  duracaoEstimadaMin?: number
  /** Só o atendimento efetivo, sem a espera (TEC-28). */
  duracaoRealMin?: number
  acrescimos: Acrescimo[]
  /** Forma de cobrança e valores da época (TEC-21/27). */
  cobranca: CobrancaServico
  espera?: Espera
  resultado: 'produtivo' | 'improdutivo'
  /** Presente se e somente se resultado = 'improdutivo' (TEC-29). */
  improdutiva?: RegistroImprodutiva
  /** Deslocamento como item próprio (TEC-23/41). */
  deslocamento?: {
    kmIda?: number
    tempoIdaMin?: number
    valorCentavos?: number
  }
  empresaId?: string
  empresaNome?: string
  /** Cliente final. */
  cliente?: string
  codigoChamado?: string
  local?: string
  cidade?: { nome: string; uf?: string }
  ferramentas?: string[]
  /** Dica vinda do parser do WhatsApp. */
  deslocamentoPago?: boolean
  avaliacaoClienteFinal?: AvaliacaoClienteFinal
  recebimento: { status: 'a_receber' | 'recebido'; recebidoEm?: string }
}

export type LancamentoDespesa = Base & {
  tipo: 'despesa'
  categoria?: CategoriaDespesa
}

export type Lancamento = LancamentoServico | LancamentoDespesa

export type CampoPendente =
  | 'valor'
  | 'data'
  | 'empresa'
  | 'categoria'
  | 'motivo_acrescimo'
  | 'horas'
  | 'diarias'
  | 'valor_hora'
  | 'valor_diaria'

function pendenciasDoValorDoServico(s: LancamentoServico): CampoPendente[] {
  const c = s.cobranca
  switch (c.forma) {
    case 'chamado':
    case 'pacote':
      return s.valorCentavos === undefined ? ['valor'] : []
    case 'hora': {
      const p: CampoPendente[] = []
      if (c.valorHoraCentavos === undefined) p.push('valor_hora')
      if (minutosCobradosPorHora(s) === undefined) p.push('horas')
      return p
    }
    case 'diaria': {
      const p: CampoPendente[] = []
      if (c.valorDiariaCentavos === undefined) p.push('valor_diaria')
      if (c.diarias === undefined || !(c.diarias > 0)) p.push('diarias')
      return p
    }
  }
}

export function pendenciasDe(l: Lancamento): CampoPendente[] {
  if (l.tipo === 'despesa') {
    const p: CampoPendente[] = []
    if (l.valorCentavos === undefined) p.push('valor')
    if (!l.data) p.push('data')
    if (!l.categoria) p.push('categoria')
    return p
  }
  const p = pendenciasDoValorDoServico(l)
  if (!l.data) p.push('data')
  if (!l.empresaNome?.trim()) p.push('empresa')
  if (l.acrescimos.some(a => !a.motivo.trim())) p.push('motivo_acrescimo')
  return p
}

export function podeConfirmar(l: Lancamento): boolean {
  return pendenciasDe(l).length === 0
}

export const LIMITE_DESCRICAO_RASCUNHO = 200

/**
 * Lançamento "a revisar" criado a partir de uma mensagem colada. A mensagem é
 * uma oferta: nasce agendado, sem valor (nunca inventado). A forma de cobrança
 * segue a negociação da empresa, sem copiar valores monetários (só percal e
 * nº de diárias).
 */
export function rascunhoDeDemanda(
  d: DemandaExtraida,
  ids: { id: string; agora: string },
  neg?: Negociacao,
): LancamentoServico {
  const { cobranca } = novaCobranca(neg)
  const semValores: CobrancaServico =
    cobranca.forma === 'hora'
      ? { forma: 'hora' }
      : cobranca.forma === 'diaria'
        ? { forma: 'diaria', diarias: cobranca.diarias }
        : cobranca
  const descricao = (d.motivo ?? d.textoLimpo).slice(
    0,
    LIMITE_DESCRICAO_RASCUNHO,
  )
  const s: LancamentoServico = {
    id: ids.id,
    tipo: 'servico',
    status: 'a_revisar',
    origem: 'whatsapp',
    criadoEm: ids.agora,
    situacao: 'agendado',
    acrescimos: [],
    cobranca: semValores,
    resultado: 'produtivo',
    recebimento: { status: 'a_receber' },
  }
  if (descricao) s.descricao = descricao
  if (d.data) s.data = d.data.valor
  if (d.data?.hora) s.hora = d.data.hora
  if (d.empresa) {
    s.empresaNome = d.empresa.nome
    if (d.empresa.id) s.empresaId = d.empresa.id
  }
  if (d.cliente) s.cliente = d.cliente
  if (d.codigoChamado) s.codigoChamado = d.codigoChamado
  if (d.local) s.local = d.local
  if (d.cidade) s.cidade = { nome: d.cidade.nome, uf: d.cidade.uf }
  if (d.ferramentas.length) s.ferramentas = [...d.ferramentas]
  if (d.deslocamentoPago !== undefined) s.deslocamentoPago = d.deslocamentoPago
  return s
}
