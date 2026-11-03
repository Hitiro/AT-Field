// TEC-25/26/28/48: total do serviço, tempo previsto × real e acréscimo sugerido.
import { valorBaseDoServico } from './cobranca'
import {
  type Negociacao,
  type OrigemDuracao,
  duracaoPrevista,
} from './empresas'
import { ROTULOS_ESPERA } from './espera'
import { valorImprodutiva } from './improdutiva'
import type { LancamentoServico } from './lancamentos'

function somaAcrescimos(s: LancamentoServico): number {
  return s.acrescimos.reduce((t, a) => t + a.valorCentavos, 0)
}

/**
 * Total a receber: produtivo = base + deslocamento + acréscimos; improdutivo =
 * valor pela política gravada + acréscimos. `undefined` se a base não fecha.
 */
export function totalDoServico(s: LancamentoServico): number | undefined {
  const base = valorBaseDoServico(s)
  if (base === undefined) return undefined
  if (s.resultado === 'improdutivo') {
    const valor = valorImprodutiva(s)
    return valor === undefined ? undefined : valor + somaAcrescimos(s)
  }
  return base + (s.deslocamento?.valorCentavos ?? 0) + somaAcrescimos(s)
}

export type TempoDoAtendimento = {
  previstoMin: number
  origemPrevisto: OrigemDuracao
  realMin?: number
  esperaMin: number
  /** Atendimento + espera; só com o real definido. */
  totalNoLocalMin?: number
  /** totalNoLocal − previsto. */
  diferencaMin?: number
  excedeu: boolean
  ganhoPorHoraCentavos: number | null
}

export function tempoDoAtendimento(
  s: LancamentoServico,
  neg?: Negociacao,
): TempoDoAtendimento {
  const previsto = duracaoPrevista(s, neg)
  const esperaMin = s.espera?.minutos ?? 0
  const realMin =
    s.resultado === 'improdutivo' ? (s.duracaoRealMin ?? 0) : s.duracaoRealMin
  const r: TempoDoAtendimento = {
    previstoMin: previsto.minutos,
    origemPrevisto: previsto.origem,
    esperaMin,
    excedeu: false,
    ganhoPorHoraCentavos: null,
  }
  if (realMin === undefined) return r
  const totalNoLocalMin = realMin + esperaMin
  const total = totalDoServico(s)
  r.realMin = realMin
  r.totalNoLocalMin = totalNoLocalMin
  r.diferencaMin = totalNoLocalMin - previsto.minutos
  r.excedeu = r.diferencaMin > 0
  if (totalNoLocalMin > 0 && total !== undefined) {
    r.ganhoPorHoraCentavos = Math.round((total * 60) / totalNoLocalMin)
  }
  return r
}

export type AcrescimoSugerido = {
  minutos: number
  valorCentavos: number
  motivoSugerido: string
}

/**
 * Acréscimo pelo excedente do percal gravado no serviço (TEC-21/26), contando a
 * espera (TEC-28). Só por chamado, produtivo, com hora adicional paga. Sem
 * tolerância; a estimativa não entra. Só preenche o formulário (editável).
 */
export function sugerirAcrescimo(
  s: LancamentoServico,
  neg?: Negociacao,
): AcrescimoSugerido | null {
  if (s.resultado === 'improdutivo') return null
  if (s.cobranca.forma !== 'chamado') return null
  if (!neg || !neg.horaAdicional.paga) return null
  const percal = s.cobranca.percalMin
  if (percal === undefined || s.duracaoRealMin === undefined) return null
  const esperaMin = s.espera?.minutos ?? 0
  const minutos = s.duracaoRealMin + esperaMin - percal
  if (minutos <= 0) return null
  const valorCentavos = Math.round(
    (minutos * neg.horaAdicional.valorHoraCentavos) / 60,
  )
  const motivoSugerido =
    s.espera && esperaMin > 0
      ? `Tempo de espera (${ROTULOS_ESPERA[s.espera.motivo]}): ${esperaMin} min`
      : 'Hora adicional'
  return { minutos, valorCentavos, motivoSugerido }
}
