// TEC-70: vínculo privado telefone → empresa.
import type { Empresa } from './empresas'

/**
 * Normaliza para DDD + número (10 ou 11 dígitos): tira o '55' do país e o '0'
 * de operadora/DDD. Inválido → null.
 */
export function normalizarTelefone(s: string): string | null {
  let d = s.replace(/\D/g, '')
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
  if ((d.length === 11 || d.length === 12) && d.startsWith('0')) d = d.slice(1)
  return d.length === 10 || d.length === 11 ? d : null
}

/** Mesmo número, aceitando a falta do nono dígito '9' depois do DDD. */
function mesmoNumero(a: string, b: string): boolean {
  if (a === b) return true
  const [longo, curto] = a.length > b.length ? [a, b] : [b, a]
  return (
    longo.length === 11 &&
    curto.length === 10 &&
    longo[2] === '9' &&
    longo.slice(0, 2) + longo.slice(3) === curto
  )
}

export function empresaPorTelefone(
  telefone: string,
  empresas: Pick<Empresa, 'id' | 'telefones'>[],
): string | undefined {
  const n = normalizarTelefone(telefone)
  if (!n) return undefined
  return empresas.find(e =>
    e.telefones.some(t => {
      const v = normalizarTelefone(t)
      return v !== null && mesmoNumero(n, v)
    }),
  )?.id
}
