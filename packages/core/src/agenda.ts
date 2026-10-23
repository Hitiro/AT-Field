// TEC-02e: agenda à vista e aviso de conflito de horário.
import {
  DURACAO_PADRAO_MIN,
  type Empresa,
  type OrigemDuracao,
  duracaoPrevista,
  negociacaoDoServico,
} from './empresas'
import type { Lancamento, LancamentoServico } from './lancamentos'

/** Minutos desde 1970-01-01, calculados por Date.UTC nas partes (sem fuso). */
export type Intervalo = { inicio: number; fim: number }

type EmpresasNeg = Pick<Empresa, 'id' | 'negociacao'>[]

function partesData(data: string): [number, number, number] {
  const [a, m, d] = data.split('-').map(Number)
  return [a, m, d]
}

function minutosDaHora(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

export function intervaloDe(
  data: string,
  hora: string,
  duracaoMin: number,
): Intervalo {
  const [a, m, d] = partesData(data)
  const inicio = Date.UTC(a, m - 1, d) / 60000 + minutosDaHora(hora)
  return { inicio, fim: inicio + duracaoMin }
}

/** Intervalo semiaberto [início, fim): encostar não conflita. */
export function sobrepoe(a: Intervalo, b: Intervalo): boolean {
  return a.inicio < b.fim && b.inicio < a.fim
}

/** 'HH:MM' válido (00:00–23:59, dois dígitos no minuto). */
export function horaValida(hora: string): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hora)
  return !!m && Number(m[1]) <= 23 && Number(m[2]) <= 59
}

/** Soma dias a uma data YYYY-MM-DD. */
export function somarDias(data: string, dias: number): string {
  const [a, m, d] = partesData(data)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

/** 0 = domingo … 6 = sábado. */
export function diaDaSemana(data: string): number {
  const [a, m, d] = partesData(data)
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay()
}

export type ConsultaHorario = {
  data: string
  hora?: string
  duracaoMin?: number
  excluirId?: string
}

function agendadosDoDia(
  data: string,
  ls: Lancamento[],
  excluirId?: string,
): LancamentoServico[] {
  // inclui os dias vizinhos: atendimento ou consulta pode virar a meia-noite
  const anterior = somarDias(data, -1)
  const seguinte = somarDias(data, 1)
  return ls.filter(
    (l): l is LancamentoServico =>
      l.tipo === 'servico' &&
      l.situacao === 'agendado' &&
      l.id !== excluirId &&
      (l.data === data ||
        ((l.data === anterior || l.data === seguinte) && l.hora !== undefined)),
  )
}

function porHora(a: LancamentoServico, b: LancamentoServico): number {
  if (a.hora === b.hora) return 0
  if (a.hora === undefined) return 1
  if (b.hora === undefined) return -1
  return a.hora < b.hora ? -1 : 1
}

/**
 * Conflitos de uma consulta com os serviços agendados (revisados ou não).
 * Sem hora na consulta: só lista os do mesmo dia. Duração ausente usa a
 * prevista (estimada → percal → padrão 2 h).
 */
export function detectarConflitos(
  c: ConsultaHorario,
  ls: Lancamento[],
  empresas: EmpresasNeg = [],
): { conflitos: LancamentoServico[]; mesmoDia: LancamentoServico[] } {
  const candidatos = agendadosDoDia(c.data, ls, c.excluirId)
  const mesmoDia = candidatos.filter(s => s.data === c.data).sort(porHora)
  if (!c.hora || !horaValida(c.hora)) return { conflitos: [], mesmoDia }
  const consulta = intervaloDe(
    c.data,
    c.hora,
    c.duracaoMin ?? DURACAO_PADRAO_MIN,
  )
  const conflitos = candidatos
    .filter(s => s.hora !== undefined && horaValida(s.hora))
    .filter(s => {
      const dur = duracaoPrevista(s, negociacaoDoServico(s, empresas)).minutos
      return sobrepoe(consulta, intervaloDe(s.data!, s.hora!, dur))
    })
    .sort((a, b) => (a.data! + a.hora!).localeCompare(b.data! + b.hora!))
  return { conflitos, mesmoDia }
}

export type ItemAgenda = {
  servico: LancamentoServico
  inicio?: string
  fim?: string
  duracaoMin: number
  /** false = usou percal ou padrão. */
  duracaoEstimada: boolean
  origemDuracao: OrigemDuracao
  emConflito: boolean
}

export type GrupoAgenda = { rotulo: string; data: string; itens: ItemAgenda[] }

const DIAS_ABREV = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.']

/** 'Hoje', 'Amanhã' ou 'sáb., 24/10'. */
export function rotuloDoDia(data: string, hoje: string): string {
  if (data === hoje) return 'Hoje'
  if (data === somarDias(hoje, 1)) return 'Amanhã'
  const [, m, d] = data.split('-')
  return `${DIAS_ABREV[diaDaSemana(data)]}, ${d}/${m}`
}

function horaDeMinutos(total: number): string {
  const doDia = ((total % 1440) + 1440) % 1440
  const h = Math.floor(doDia / 60)
  const m = doDia % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Agendados de hoje até hoje + dias − 1, agrupados por dia e ordenados por hora. */
export function agendaDosProximosDias(
  ls: Lancamento[],
  hoje: string,
  dias = 7,
  empresas: EmpresasNeg = [],
): GrupoAgenda[] {
  const limite = somarDias(hoje, dias)
  const agendados = ls.filter(
    (l): l is LancamentoServico =>
      l.tipo === 'servico' &&
      l.situacao === 'agendado' &&
      !!l.data &&
      l.data >= hoje &&
      l.data < limite,
  )
  const datas = [...new Set(agendados.map(s => s.data!))].sort()
  const grupos = datas.map(data => {
    const doDia = agendados.filter(s => s.data === data).sort(porHora)
    const itens: ItemAgenda[] = doDia.map(servico => {
      const prev = duracaoPrevista(
        servico,
        negociacaoDoServico(servico, empresas),
      )
      const item: ItemAgenda = {
        servico,
        duracaoMin: prev.minutos,
        duracaoEstimada: prev.origem === 'estimada',
        origemDuracao: prev.origem,
        emConflito: false,
      }
      if (servico.hora && horaValida(servico.hora)) {
        const ini = minutosDaHora(servico.hora)
        item.inicio = horaDeMinutos(ini)
        item.fim = horaDeMinutos(ini + prev.minutos)
      }
      return item
    })
    return { rotulo: rotuloDoDia(data, hoje), data, itens }
  })
  // conflito entre quaisquer itens com hora, inclusive na virada do dia
  const comHora = grupos.flatMap(g =>
    g.itens
      .filter(i => i.inicio)
      .map(i => ({
        i,
        intervalo: intervaloDe(g.data, i.inicio!, i.duracaoMin),
      })),
  )
  for (const x of comHora) {
    x.i.emConflito = comHora.some(
      y => y !== x && sobrepoe(x.intervalo, y.intervalo),
    )
  }
  return grupos
}
