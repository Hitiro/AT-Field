import { ROTULOS_CLIENTE_FINAL, historicoClienteFinal } from '@at-field/core'

import { AppText } from '@/components/ui/text'
import { useLancamentos } from '@/state/store'

import { mediaBR } from './empresa/reputacao-resumo'

/** "Você já atendeu ZARA 3× • média 4,0 • Local inseguro" (privado). */
export function HistoricoCliente({ cliente }: { cliente: string | undefined }) {
  const ls = useLancamentos()
  if (!cliente?.trim()) return null
  const h = historicoClienteFinal(ls, cliente)
  if (h.quantidade === 0 || h.media === undefined) return null
  const partes = [
    `Você já atendeu ${cliente.trim()} ${h.quantidade}×`,
    `média ${mediaBR(h.media)}`,
    ...h.motivosMaisCitados.map(m => ROTULOS_CLIENTE_FINAL[m.motivo]),
  ]
  return (
    <AppText variante="small" cor="textSecondary" testID="historico-cliente">
      {partes.join(' • ')}
    </AppText>
  )
}
