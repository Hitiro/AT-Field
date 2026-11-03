// TEC-29: atendimento improdutivo e política de improdutiva da empresa.
import type { MotivoClienteFinal } from './cliente-final'
import { valorBaseDoServico } from './cobranca'
import { type ErroCampo, inteiroEntre } from './erros'
import type { LancamentoServico } from './lancamentos'
import type { MotivoAvaliacao } from './reputacao'

export const MOTIVOS_IMPRODUTIVA = [
  'responsavel_ausente',
  'entrada_nao_liberada',
  'equipamento_indisponivel',
  'cliente_cancelou_no_local',
  'outro',
] as const
export type MotivoImprodutiva = (typeof MOTIVOS_IMPRODUTIVA)[number]

export const ROTULOS_IMPRODUTIVA: Record<MotivoImprodutiva, string> = {
  responsavel_ausente: 'Responsável/gerente ausente',
  entrada_nao_liberada: 'Entrada não liberada',
  equipamento_indisponivel: 'Equipamento indisponível',
  cliente_cancelou_no_local: 'Cliente cancelou no local',
  outro: 'Outro',
}

export type PoliticaImprodutiva = {
  /** Inteiro 0–100, sobre o valor base do serviço. */
  percentual: number
  pagaDeslocamento: boolean
}

export type RegistroImprodutiva = {
  motivo: MotivoImprodutiva
  /** Data-hora ISO do registro. */
  registradaEm: string
  /** Cópia da negociação na hora do registro (TEC-21). */
  politica: PoliticaImprodutiva
}

export const POLITICA_NAO_INFORMADA: PoliticaImprodutiva = {
  percentual: 0,
  pagaDeslocamento: false,
}

export function validarPoliticaImprodutiva(
  p: PoliticaImprodutiva,
): ErroCampo[] {
  if (inteiroEntre(p.percentual, 0, 100)) return []
  return [
    {
      campo: 'percentual',
      mensagem: 'Percentual deve ser um inteiro de 0 a 100',
    },
  ]
}

const DATA_HORA_ISO =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/

export function validarRegistroImprodutiva(
  r: RegistroImprodutiva,
): ErroCampo[] {
  const erros: ErroCampo[] = []
  if (!(MOTIVOS_IMPRODUTIVA as readonly string[]).includes(r.motivo)) {
    erros.push({ campo: 'motivo', mensagem: 'Motivo fora da lista' })
  }
  if (
    !DATA_HORA_ISO.test(r.registradaEm) ||
    Number.isNaN(Date.parse(r.registradaEm))
  ) {
    erros.push({ campo: 'registradaEm', mensagem: 'Data e hora inválidas' })
  }
  for (const e of validarPoliticaImprodutiva(r.politica)) {
    erros.push({ campo: `politica.${e.campo}`, mensagem: e.mensagem })
  }
  return erros
}

/** Valor a receber pela improdutiva (sem acréscimos); undefined se produtivo ou sem base. */
export function valorImprodutiva(s: LancamentoServico): number | undefined {
  if (s.resultado !== 'improdutivo' || !s.improdutiva) return undefined
  const base = valorBaseDoServico(s)
  if (base === undefined) return undefined
  const { percentual, pagaDeslocamento } = s.improdutiva.politica
  const deslocamento = pagaDeslocamento
    ? (s.deslocamento?.valorCentavos ?? 0)
    : 0
  return Math.round((base * percentual) / 100) + deslocamento
}

export type PrejuizoImprodutiva = {
  receberiaCentavos?: number
  recebeCentavos?: number
  deixouDeReceberCentavos?: number
  custoIdaCentavos?: number
  tempoPerdidoMin: number
  resultadoLiquidoCentavos?: number
}

/** Prejuízo real da improdutiva: o que deixou de receber, custo da viagem e tempo perdido. */
export function prejuizoImprodutiva(
  s: LancamentoServico,
  custoPorKmCentavos: number,
): PrejuizoImprodutiva {
  if (s.resultado !== 'improdutivo') return { tempoPerdidoMin: 0 }
  const r: PrejuizoImprodutiva = {
    tempoPerdidoMin:
      2 * (s.deslocamento?.tempoIdaMin ?? 0) +
      (s.duracaoRealMin ?? 0) +
      (s.espera?.minutos ?? 0),
  }
  const base = valorBaseDoServico(s)
  const recebe = valorImprodutiva(s)
  if (base !== undefined) {
    r.receberiaCentavos = base + (s.deslocamento?.valorCentavos ?? 0)
  }
  if (recebe !== undefined) r.recebeCentavos = recebe
  if (r.receberiaCentavos !== undefined && recebe !== undefined) {
    r.deixouDeReceberCentavos = r.receberiaCentavos - recebe
  }
  const kmIda = s.deslocamento?.kmIda
  if (kmIda !== undefined) {
    r.custoIdaCentavos = Math.round(2 * kmIda * custoPorKmCentavos)
    if (recebe !== undefined) {
      r.resultadoLiquidoCentavos = recebe - r.custoIdaCentavos
    }
  }
  return r
}

export function motivosClienteSugeridosPelaImprodutiva(
  m: MotivoImprodutiva,
): MotivoClienteFinal[] {
  if (m === 'responsavel_ausente') return ['responsavel_ausente']
  if (m === 'entrada_nao_liberada') return ['acesso_dificil_espera_liberacao']
  return []
}

export function motivosEmpresaSugeridosPelaImprodutiva(
  p: PoliticaImprodutiva,
): MotivoAvaliacao[] {
  return p.percentual === 0 ? ['nao_paga_improdutiva'] : []
}
