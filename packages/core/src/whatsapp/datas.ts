// Data e hora (absolutas ou relativas) numa mensagem já normalizada.
import { diaDaSemana, somarDias } from '../agenda'

export type DataExtraida = {
  valor: string
  hora?: string
  relativa: boolean
  precisaConfirmar: boolean
}

const DIAS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
}

const pad = (n: number) => String(n).padStart(2, '0')

function dataValida(a: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(a, m - 1, d))
  return (
    dt.getUTCFullYear() === a &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  )
}

function extrairData(
  t: string,
  referencia: string,
): { valor: string; relativa: boolean } | undefined {
  if (/(^|[^a-z])depois de amanha([^a-z]|$)/.test(t)) {
    return { valor: somarDias(referencia, 2), relativa: true }
  }
  if (/(^|[^a-z])amanha([^a-z]|$)/.test(t)) {
    return { valor: somarDias(referencia, 1), relativa: true }
  }
  if (/(^|[^a-z])hoje([^a-z]|$)/.test(t)) {
    return { valor: referencia, relativa: true }
  }
  const sem =
    /(^|[^a-z])(segunda|terca|quarta|quinta|sexta|sabado|domingo)(-feira)?([^a-z]|$)/.exec(
      t,
    )
  if (sem) {
    const alvo = DIAS[sem[2]]
    const atual = diaDaSemana(referencia)
    const delta = (alvo - atual + 7) % 7 || 7
    return { valor: somarDias(referencia, delta), relativa: true }
  }
  const abs = /(?:^|[^\d/])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![\d/])/.exec(
    t,
  )
  if (abs) {
    const d = Number(abs[1])
    const m = Number(abs[2])
    const refAno = Number(referencia.slice(0, 4))
    if (abs[3]) {
      const a = Number(abs[3]) < 100 ? 2000 + Number(abs[3]) : Number(abs[3])
      if (dataValida(a, m, d))
        return { valor: `${a}-${pad(m)}-${pad(d)}`, relativa: false }
    } else if (dataValida(refAno, m, d)) {
      let valor = `${refAno}-${pad(m)}-${pad(d)}`
      if (valor < referencia) valor = `${refAno + 1}-${pad(m)}-${pad(d)}`
      return { valor, relativa: false }
    }
  }
  return undefined
}

/**
 * Hora só com 'h' ou ':' ("às 14h", "às 14h30", "14:30"): "as 2 impressoras" não é
 * hora. Depois de "às/a partir das" ou solta no formato hh:mm. Prefere a hora de
 * início; a de fim ("até as 18h") só vale se não houver outra.
 */
export function extrairHora(t: string): string | undefined {
  const candidatas: { pos: number; hora: string; fim: boolean }[] = []
  const ocupado: [number, number][] = []
  const valida = (h: number, min: number) => h <= 23 && min <= 59
  const formatar = (h: number, min: number) => `${pad(h)}:${pad(min)}`
  const comPreposicao =
    /(?:^|[^a-z])(a partir das|ate as|as)\s+(\d{1,2})(?:\s*h\s*(\d{2})?|:(\d{2}))(?!\d)/g
  for (const m of t.matchAll(comPreposicao)) {
    ocupado.push([m.index, m.index + m[0].length])
    const h = Number(m[2])
    const min = Number(m[3] ?? m[4] ?? 0)
    if (valida(h, min)) {
      candidatas.push({
        pos: m.index,
        hora: formatar(h, min),
        fim: m[1] === 'ate as',
      })
    }
  }
  for (const m of t.matchAll(/(?:^|[^\d:])(\d{1,2}):(\d{2})(?![\d:])/g)) {
    if (ocupado.some(([a, b]) => m.index >= a && m.index < b)) continue
    const h = Number(m[1])
    const min = Number(m[2])
    if (valida(h, min)) {
      candidatas.push({ pos: m.index, hora: formatar(h, min), fim: false })
    }
  }
  candidatas.sort((a, b) => a.pos - b.pos)
  return (candidatas.find(c => !c.fim) ?? candidatas[0])?.hora
}

/**
 * Data/hora de um texto normalizado. `referencia` = data do prefixo da
 * mensagem ou, sem prefixo, a data em que o técnico colou (`hoje`).
 * Sem data → undefined (mesmo com hora).
 */
export function extrairDataHora(
  t: string,
  referencia: string,
  temPrefixo: boolean,
): DataExtraida | undefined {
  const data = extrairData(t, referencia)
  if (!data) return undefined
  const r: DataExtraida = {
    valor: data.valor,
    relativa: data.relativa,
    precisaConfirmar: data.relativa || !temPrefixo,
  }
  const hora = extrairHora(t)
  if (hora) r.hora = hora
  return r
}
