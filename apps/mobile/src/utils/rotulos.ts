import type {
  CampoPendente,
  Empresa,
  FormaCobranca,
  ItemAgenda,
  Lancamento,
  LancamentoServico,
} from '@at-field/core'
import {
  ROTULOS_CATEGORIA,
  duracaoPrevista,
  formatarMoeda,
  negociacaoDoServico,
  totalDoServico,
} from '@at-field/core'

import { formatarDuracao } from './datas'

export const ROTULOS_PENDENCIA: Record<CampoPendente, string> = {
  valor: 'sem valor',
  data: 'sem data',
  empresa: 'sem empresa',
  categoria: 'sem categoria',
  motivo_acrescimo: 'acréscimo sem motivo',
  horas: 'sem horas',
  diarias: 'sem nº de diárias',
  valor_hora: 'sem valor da hora',
  valor_diaria: 'sem valor da diária',
}

/** '2 h', '~4 h (percal)' ou '~2 h (padrão)'. */
export function rotuloDuracao(
  item: Pick<ItemAgenda, 'duracaoMin' | 'origemDuracao'>,
): string {
  const d = formatarDuracao(item.duracaoMin)
  if (item.origemDuracao === 'percal') return `~${d} (percal)`
  if (item.origemDuracao === 'padrao') return `~${d} (padrão)`
  return d
}

export function tituloLancamento(l: Lancamento): string {
  if (l.tipo === 'despesa') {
    return l.categoria ? ROTULOS_CATEGORIA[l.categoria] : 'Despesa'
  }
  return l.empresaNome?.trim() || 'Serviço sem empresa'
}

export function valorLancamento(l: Lancamento): string | undefined {
  const v = l.tipo === 'servico' ? totalDoServico(l) : l.valorCentavos
  return v === undefined ? undefined : formatarMoeda(v)
}

/** "Conflita com Sozic, 14:00–16:00". */
export function textoConflito(
  s: LancamentoServico,
  empresas: Empresa[],
): string {
  const dur = duracaoPrevista(s, negociacaoDoServico(s, empresas)).minutos
  const nome = s.empresaNome ?? 'outro atendimento'
  if (!s.hora) return `Conflita com ${nome}`
  const [h, m] = s.hora.split(':').map(Number)
  const fimMin = (h * 60 + m + dur) % 1440
  const fim = `${String(Math.floor(fimMin / 60)).padStart(2, '0')}:${String(fimMin % 60).padStart(2, '0')}`
  return `Conflita com ${nome}, ${s.hora}–${fim}`
}

/** Rótulos curtos para o segmentado de forma de cobrança. */
export const ROTULOS_FORMA_CURTO: Record<FormaCobranca, string> = {
  chamado: 'Chamado',
  hora: 'Hora',
  diaria: 'Diária',
  pacote: 'Pacote',
}
