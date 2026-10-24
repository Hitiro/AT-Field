// TEC-71 a TEC-74: avaliação da empresa pelo técnico e visão da rede.
import { type ErroCampo, inteiroEntre } from './erros'

export const MOTIVOS_AVALIACAO = [
  'atrasa_pagamento',
  'valor_abaixo_combinado',
  'nao_paga_deslocamento_pedagio',
  'percal_nao_informado',
  'mudanca_escopo_sem_acrescimo',
  'nao_paga_improdutiva',
] as const
export type MotivoAvaliacao = (typeof MOTIVOS_AVALIACAO)[number]

export const ROTULOS_MOTIVO: Record<MotivoAvaliacao, string> = {
  atrasa_pagamento: 'Atrasa pagamento',
  valor_abaixo_combinado: 'Valor abaixo do combinado',
  nao_paga_deslocamento_pedagio: 'Não paga deslocamento/pedágio',
  percal_nao_informado: 'Percal não informado',
  mudanca_escopo_sem_acrescimo: 'Mudança de escopo sem acréscimo',
  nao_paga_improdutiva: 'Não paga improdutiva',
}

/** Minha avaliação de uma empresa (privada; o comentário nunca sai do aparelho). */
export type AvaliacaoEmpresa = {
  empresaId: string
  nota: number
  motivos: MotivoAvaliacao[]
  comentarioPrivado?: string
  atualizadaEm: string
}

export const LIMITE_TEXTO_PRIVADO = 500

/**
 * Validação genérica de nota 0–10 inteira, motivos de uma lista fechada sem
 * repetição e texto privado de até 500 caracteres.
 */
export function validarNotaEMotivos<M extends string>(
  a: { nota: number; motivos: readonly string[]; texto?: string },
  lista: readonly M[],
  campoTexto: string,
): ErroCampo[] {
  const erros: ErroCampo[] = []
  if (!inteiroEntre(a.nota, 0, 10)) {
    erros.push({
      campo: 'nota',
      mensagem: 'Nota deve ser um inteiro de 0 a 10',
    })
  }
  if (a.motivos.some(m => !(lista as readonly string[]).includes(m))) {
    erros.push({ campo: 'motivos', mensagem: 'Motivo fora da lista' })
  } else if (new Set(a.motivos).size !== a.motivos.length) {
    erros.push({ campo: 'motivos', mensagem: 'Motivo repetido' })
  }
  if (a.texto !== undefined && a.texto.length > LIMITE_TEXTO_PRIVADO) {
    erros.push({
      campo: campoTexto,
      mensagem: `Máximo de ${LIMITE_TEXTO_PRIVADO} caracteres`,
    })
  }
  return erros
}

export function validarAvaliacao(a: AvaliacaoEmpresa): ErroCampo[] {
  return validarNotaEMotivos(
    { nota: a.nota, motivos: a.motivos, texto: a.comentarioPrivado },
    MOTIVOS_AVALIACAO,
    'comentarioPrivado',
  )
}

export const MINIMO_AVALIACOES_REDE = 5

/** Avaliação vinda da rede: sem texto, só nota e motivos por tipo. */
export type AvaliacaoRede = { nota: number; motivos: MotivoAvaliacao[] }

export type ResumoAvaliacoes<M extends string> =
  | { status: 'poucas_avaliacoes'; quantidade: number }
  | {
      status: 'ok'
      quantidade: number
      media: number
      motivosMaisCitados: { motivo: M; quantidade: number }[]
    }
export type ResumoRede = ResumoAvaliacoes<MotivoAvaliacao>

/**
 * Resume avaliações: descarta notas inválidas; abaixo do mínimo não mostra
 * média nem motivos; média com 1 casa; top 3 motivos (empate pela ordem da lista).
 */
export function resumirAvaliacoes<M extends string>(
  avs: { nota: number; motivos: readonly string[] }[],
  lista: readonly M[],
  minimo: number,
): ResumoAvaliacoes<M> {
  const validas = avs.filter(a => inteiroEntre(a.nota, 0, 10))
  const quantidade = validas.length
  if (quantidade === 0 || quantidade < minimo) {
    return { status: 'poucas_avaliacoes', quantidade }
  }
  const soma = validas.reduce((t, a) => t + a.nota, 0)
  const media = Math.round((soma / quantidade) * 10) / 10
  const contagem = lista.map(motivo => ({
    motivo,
    quantidade: validas.filter(a => a.motivos.includes(motivo)).length,
  }))
  const motivosMaisCitados = contagem
    .filter(c => c.quantidade > 0)
    // sort é estável: empate mantém a ordem da lista
    .sort((x, y) => y.quantidade - x.quantidade)
    .slice(0, 3)
  return { status: 'ok', quantidade, media, motivosMaisCitados }
}

export function resumirRede(
  avs: AvaliacaoRede[],
  minimo = MINIMO_AVALIACOES_REDE,
): ResumoRede {
  return resumirAvaliacoes(avs, MOTIVOS_AVALIACAO, minimo)
}
