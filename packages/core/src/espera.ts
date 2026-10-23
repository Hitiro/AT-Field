// TEC-28: tempo de espera no local, separado do atendimento efetivo.
import type { MotivoClienteFinal } from './cliente-final'
import { type ErroCampo, inteiroEntre } from './erros'

export const MOTIVOS_ESPERA = [
  'liberacao_acesso',
  'suporte_remoto',
  'responsavel_ausente',
  'outro',
] as const
export type MotivoEspera = (typeof MOTIVOS_ESPERA)[number]

export const ROTULOS_ESPERA: Record<MotivoEspera, string> = {
  liberacao_acesso: 'Liberação de acesso',
  suporte_remoto: 'Suporte remoto',
  responsavel_ausente: 'Responsável ausente',
  outro: 'Outro',
}

export type Espera = { minutos: number; motivo: MotivoEspera }

export function validarEspera(e: Espera): ErroCampo[] {
  const erros: ErroCampo[] = []
  if (!inteiroEntre(e.minutos, 1, 1440)) {
    erros.push({
      campo: 'minutos',
      mensagem: 'Espera deve ser de 1 a 1440 minutos',
    })
  }
  if (!(MOTIVOS_ESPERA as readonly string[]).includes(e.motivo)) {
    erros.push({ campo: 'motivo', mensagem: 'Motivo fora da lista' })
  }
  return erros
}

export function motivosClienteSugeridosPelaEspera(
  e?: Espera,
): MotivoClienteFinal[] {
  if (e?.motivo === 'liberacao_acesso')
    return ['acesso_dificil_espera_liberacao']
  if (e?.motivo === 'responsavel_ausente') return ['responsavel_ausente']
  return []
}
