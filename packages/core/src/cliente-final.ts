// TEC-75: avaliação do cliente final, por atendimento (privada do técnico).
import type { ErroCampo } from './erros'
import type { Lancamento, LancamentoServico } from './lancamentos'
import { resumirAvaliacoes, validarNotaEMotivos } from './reputacao'
import { normalizar } from './texto'

export const MOTIVOS_CLIENTE_FINAL = [
  'acesso_dificil_espera_liberacao',
  'infraestrutura_inadequada',
  'local_inseguro',
  'responsavel_ausente',
  'retrabalho_por_falha_do_cliente',
] as const
export type MotivoClienteFinal = (typeof MOTIVOS_CLIENTE_FINAL)[number]

export const ROTULOS_CLIENTE_FINAL: Record<MotivoClienteFinal, string> = {
  acesso_dificil_espera_liberacao: 'Acesso difícil / espera para liberar',
  infraestrutura_inadequada: 'Infraestrutura inadequada',
  local_inseguro: 'Local inseguro',
  responsavel_ausente: 'Contato/responsável ausente',
  retrabalho_por_falha_do_cliente: 'Retrabalho por falha do cliente',
}

export type AvaliacaoClienteFinal = {
  nota: number
  motivos: MotivoClienteFinal[]
  anotacaoPrivada?: string
  avaliadaEm: string
}

export function validarAvaliacaoClienteFinal(
  s: LancamentoServico,
  a: AvaliacaoClienteFinal,
): ErroCampo[] {
  const erros = validarNotaEMotivos(
    { nota: a.nota, motivos: a.motivos, texto: a.anotacaoPrivada },
    MOTIVOS_CLIENTE_FINAL,
    'anotacaoPrivada',
  )
  if (!s.cliente?.trim()) {
    erros.push({ campo: 'cliente', mensagem: 'Informe o cliente final' })
  }
  if (s.situacao !== 'realizado') {
    erros.push({
      campo: 'situacao',
      mensagem: 'Só atendimento realizado pode ser avaliado',
    })
  }
  return erros
}

export type HistoricoClienteFinal = {
  quantidade: number
  media?: number
  motivosMaisCitados: { motivo: MotivoClienteFinal; quantidade: number }[]
}

/** Histórico das minhas avaliações de um cliente final (sem mínimo: é privado). */
export function historicoClienteFinal(
  ls: Lancamento[],
  cliente: string,
): HistoricoClienteFinal {
  const alvo = normalizar(cliente)
  const avaliacoes = alvo
    ? ls.flatMap(l =>
        l.tipo === 'servico' &&
        l.avaliacaoClienteFinal &&
        normalizar(l.cliente ?? '') === alvo
          ? [l.avaliacaoClienteFinal]
          : [],
      )
    : []
  const resumo = resumirAvaliacoes(avaliacoes, MOTIVOS_CLIENTE_FINAL, 1)
  if (resumo.status === 'poucas_avaliacoes') {
    return { quantidade: resumo.quantidade, motivosMaisCitados: [] }
  }
  return {
    quantidade: resumo.quantidade,
    media: resumo.media,
    motivosMaisCitados: resumo.motivosMaisCitados,
  }
}
