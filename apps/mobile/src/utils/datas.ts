// Datas do aparelho (fuso local) no formato do core: YYYY-MM-DD e 'HH:MM'.

const pad = (n: number) => String(n).padStart(2, '0')

export function dataLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function hojeISO(): string {
  return dataLocal(new Date())
}

/** Data-hora local sem fuso, 'YYYY-MM-DDTHH:MM:SS'. */
export function agoraISO(d = new Date()): string {
  return `${dataLocal(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export function nomeDoMes(mes: number): string {
  return MESES[mes - 1]
}

export function mesDe(data: string): { ano: number; mes: number } {
  return { ano: Number(data.slice(0, 4)), mes: Number(data.slice(5, 7)) }
}

/** '2026-10-22' → '22/10'. */
export function diaMes(data: string): string {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`
}

/** 90 → '1 h 30'; 120 → '2 h'; 45 → '45 min'. */
export function formatarDuracao(min: number): string {
  const sinal = min < 0 ? '-' : ''
  const abs = Math.abs(Math.round(min))
  const h = Math.floor(abs / 60)
  const m = abs % 60
  if (h === 0) return `${sinal}${m} min`
  return m ? `${sinal}${h} h ${pad(m)}` : `${sinal}${h} h`
}

/** Máscara de hora enquanto digita: '1400' → '14:00'. */
export function mascararHora(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d
}

/** Inteiro não negativo digitado; vazio → undefined; inválido → NaN. */
export function lerInteiro(texto: string): number | undefined {
  const t = texto.trim()
  if (!t) return undefined
  return /^\d+$/.test(t) ? Number(t) : Number.NaN
}

/** Número com vírgula ou ponto decimal; vazio → undefined; inválido → NaN. */
export function lerNumero(texto: string): number | undefined {
  const t = texto.trim()
  if (!t) return undefined
  return /^\d+([.,]\d+)?$/.test(t) ? Number(t.replace(',', '.')) : Number.NaN
}
