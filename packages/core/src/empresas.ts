// TEC-20/20a/23a/26/27/29/72: empresa contratante e negociação com o técnico.
import type { FormaCobranca } from './cobranca'
import type { PoliticaImprodutiva } from './improdutiva'
import type { LancamentoServico } from './lancamentos'
import type { AvaliacaoEmpresa } from './reputacao'

/** Duração usada quando não há estimativa nem percal (TEC-02e). */
export const DURACAO_PADRAO_MIN = 120

export type Negociacao = {
  formaPadrao: FormaCobranca
  /** Pacote é negociado por serviço, sem tarifa. */
  tarifas: {
    chamado?: { valorCentavos: number; percalMin?: number }
    hora?: { valorHoraCentavos: number }
    diaria?: { valorDiariaCentavos: number }
  }
  horaAdicional: { paga: false } | { paga: true; valorHoraCentavos: number }
  deslocamento: {
    centavosPorKm: number
    modoKm: 'media' | 'exato'
    /** km da ida combinado por destino (chave = id da cidade). */
    kmMedioPorDestino: Record<string, number>
  }
  reembolsaPedagio: boolean
  /** Ausente = não informada. */
  improdutiva?: PoliticaImprodutiva
}

export type Empresa = {
  id: string
  nome: string
  cnpj?: string
  negociacao?: Negociacao
  /** Blacklist pessoal (privado). */
  naoAtendo: boolean
  /** Minha avaliação (privada). */
  avaliacao?: AvaliacaoEmpresa
  /** Telefones vinculados, normalizados (privados). */
  telefones: string[]
}

/** km da ida que a empresa paga: média combinada do destino ou o exato. */
export function kmIdaParaPagamento(
  d: Negociacao['deslocamento'],
  destinoCidadeId: string | undefined,
  kmExato: number,
): number {
  if (d.modoKm === 'media' && destinoCidadeId !== undefined) {
    const media = d.kmMedioPorDestino[destinoCidadeId]
    if (media !== undefined) return media
  }
  return kmExato
}

export type OrigemDuracao = 'estimada' | 'percal' | 'padrao'

/** Duração prevista: estimada → percal (só por chamado) → padrão 2 h. */
export function duracaoPrevista(
  s: Pick<LancamentoServico, 'duracaoEstimadaMin' | 'cobranca'>,
  neg?: Negociacao,
): { minutos: number; origem: OrigemDuracao } {
  if (s.duracaoEstimadaMin !== undefined && s.duracaoEstimadaMin > 0) {
    return { minutos: s.duracaoEstimadaMin, origem: 'estimada' }
  }
  if (s.cobranca.forma === 'chamado') {
    const percal = s.cobranca.percalMin ?? neg?.tarifas.chamado?.percalMin
    if (percal !== undefined && percal > 0) {
      return { minutos: percal, origem: 'percal' }
    }
  }
  return { minutos: DURACAO_PADRAO_MIN, origem: 'padrao' }
}

export type AvisoEmpresa = 'nao_atendo' | 'perguntar_percal'

export const TEXTO_PERGUNTAR_PERCAL = 'Pergunte o percal antes de aceitar.'

export function textoAviso(aviso: AvisoEmpresa, nomeEmpresa: string): string {
  return aviso === 'nao_atendo'
    ? `Você marcou ${nomeEmpresa} como 'não atendo'.`
    : TEXTO_PERGUNTAR_PERCAL
}

/**
 * Avisos antes de aceitar: blacklist e, quando a forma em uso é por chamado,
 * falta de percal na tarifa. Avisam, nunca bloqueiam (TEC-01).
 */
export function avisosDaEmpresa(
  e: Empresa | undefined,
  forma?: FormaCobranca,
): AvisoEmpresa[] {
  const avisos: AvisoEmpresa[] = []
  if (e?.naoAtendo) avisos.push('nao_atendo')
  const emUso = forma ?? e?.negociacao?.formaPadrao ?? 'chamado'
  if (
    emUso === 'chamado' &&
    e?.negociacao?.tarifas.chamado?.percalMin === undefined
  ) {
    avisos.push('perguntar_percal')
  }
  return avisos
}

/** Negociação da empresa do serviço, se cadastrada. */
export function negociacaoDoServico(
  s: Pick<LancamentoServico, 'empresaId'>,
  empresas: Pick<Empresa, 'id' | 'negociacao'>[],
): Negociacao | undefined {
  if (!s.empresaId) return undefined
  return empresas.find(e => e.id === s.empresaId)?.negociacao
}
