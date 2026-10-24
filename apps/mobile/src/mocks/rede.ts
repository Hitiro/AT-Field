import type { AvaliacaoRede, MotivoAvaliacao } from '@at-field/core'

// Avaliações da rede (outros técnicos), mock por empresaId. Sem texto: só nota
// e motivos (TEC-74). Não inclui a nota do próprio técnico.

const av = (nota: number, motivos: MotivoAvaliacao[] = []): AvaliacaoRede => ({
  nota,
  motivos,
})

export const REDE_MOCK: Record<string, AvaliacaoRede[]> = {
  // 12 avaliações, média 7,8
  sozic: [
    av(8, ['percal_nao_informado']),
    av(8),
    av(8, ['atrasa_pagamento']),
    av(8),
    av(8),
    av(8, ['percal_nao_informado']),
    av(8),
    av(8),
    av(8),
    av(8),
    av(7, ['atrasa_pagamento', 'percal_nao_informado']),
    av(7, ['mudanca_escopo_sem_acrescimo']),
  ],
  sustento: [
    av(6, ['valor_abaixo_combinado']),
    av(7),
    av(5, ['valor_abaixo_combinado']),
    av(6, ['nao_paga_deslocamento_pedagio']),
    av(7),
    av(6, ['valor_abaixo_combinado']),
  ],
  protege: [
    av(6, ['nao_paga_improdutiva']),
    av(7),
    av(5, ['nao_paga_improdutiva']),
  ],
  central: [
    av(8),
    av(9),
    av(7, ['percal_nao_informado']),
    av(8),
    av(8),
    av(7),
    av(9),
    av(8, ['mudanca_escopo_sem_acrescimo']),
  ],
  ik: [],
  amparo: [
    av(3, ['atrasa_pagamento']),
    av(2, ['atrasa_pagamento', 'percal_nao_informado']),
    av(4, ['percal_nao_informado']),
    av(3, ['atrasa_pagamento']),
    av(5),
  ],
  aef: [av(8), av(9)],
}
