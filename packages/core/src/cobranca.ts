// TEC-27: formas de cobrança (por chamado com percal, por hora, diária, pacote).
import type { Negociacao } from './empresas'
import type { LancamentoServico } from './lancamentos'

export const FORMAS_COBRANCA = ['chamado', 'hora', 'diaria', 'pacote'] as const
export type FormaCobranca = (typeof FORMAS_COBRANCA)[number]

export const ROTULOS_FORMA: Record<FormaCobranca, string> = {
  chamado: 'Por chamado',
  hora: 'Por hora',
  diaria: 'Por diária',
  pacote: 'Pacote fechado',
}

/** Forma usada no serviço, com os valores da época (TEC-21). */
export type CobrancaServico =
  | { forma: 'chamado'; percalMin?: number }
  | { forma: 'hora'; valorHoraCentavos?: number; horasCobradasMin?: number }
  | { forma: 'diaria'; valorDiariaCentavos?: number; diarias?: number }
  | { forma: 'pacote'; incluiMaterial: boolean }

/** Cobrança inicial de um serviço a partir das tarifas da negociação. */
export function novaCobranca(
  neg: Negociacao | undefined,
  forma?: FormaCobranca,
): { cobranca: CobrancaServico; valorCentavos?: number } {
  const f = forma ?? neg?.formaPadrao ?? 'chamado'
  const tarifas = neg?.tarifas
  switch (f) {
    case 'chamado': {
      const t = tarifas?.chamado
      const cobranca: CobrancaServico = { forma: 'chamado' }
      if (t?.percalMin !== undefined) cobranca.percalMin = t.percalMin
      return t ? { cobranca, valorCentavos: t.valorCentavos } : { cobranca }
    }
    case 'hora': {
      const cobranca: CobrancaServico = { forma: 'hora' }
      if (tarifas?.hora)
        cobranca.valorHoraCentavos = tarifas.hora.valorHoraCentavos
      return { cobranca }
    }
    case 'diaria': {
      const cobranca: CobrancaServico = { forma: 'diaria', diarias: 1 }
      if (tarifas?.diaria) {
        cobranca.valorDiariaCentavos = tarifas.diaria.valorDiariaCentavos
      }
      return { cobranca }
    }
    case 'pacote':
      return { cobranca: { forma: 'pacote', incluiMaterial: false } }
  }
}

/**
 * Minutos cobrados na forma "por hora": horas cobradas digitadas ou, por
 * padrão, tempo no local (atendimento real + espera, TEC-28). No improdutivo
 * o atendimento ausente vale 0 (TEC-29). `undefined` se não der para calcular.
 */
export function minutosCobradosPorHora(
  s: LancamentoServico,
): number | undefined {
  if (
    s.cobranca.forma === 'hora' &&
    s.cobranca.horasCobradasMin !== undefined
  ) {
    return s.cobranca.horasCobradasMin
  }
  const espera = s.espera?.minutos
  if (s.resultado === 'improdutivo') {
    if (s.duracaoRealMin === undefined && espera === undefined) return undefined
    return (s.duracaoRealMin ?? 0) + (espera ?? 0)
  }
  if (s.duracaoRealMin === undefined) return undefined
  return s.duracaoRealMin + (espera ?? 0)
}

/** Valor base do serviço pela forma de cobrança (sem acréscimos nem deslocamento). */
export function valorBaseDoServico(s: LancamentoServico): number | undefined {
  const c = s.cobranca
  switch (c.forma) {
    case 'chamado':
    case 'pacote':
      return s.valorCentavos
    case 'hora': {
      const minutos = minutosCobradosPorHora(s)
      if (c.valorHoraCentavos === undefined || minutos === undefined) {
        return undefined
      }
      return Math.round((c.valorHoraCentavos * minutos) / 60)
    }
    case 'diaria':
      if (
        c.valorDiariaCentavos === undefined ||
        c.diarias === undefined ||
        !(c.diarias > 0)
      ) {
        return undefined
      }
      return c.valorDiariaCentavos * c.diarias
  }
}
