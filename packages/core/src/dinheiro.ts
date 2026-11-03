// Dinheiro sempre em centavos inteiros. Formatação manual (sem Intl) para ser
// idêntica em Node, Hermes e web.

function agruparMilhar(inteiro: string): string {
  return inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** 123456 → 'R$ 1.234,56'; -7000 → '-R$ 70,00'. */
export function formatarMoeda(centavos: number): string {
  const arredondado = Math.round(centavos)
  const negativo = arredondado < 0
  const abs = Math.abs(arredondado)
  const reais = Math.floor(abs / 100)
  const cent = String(abs % 100).padStart(2, '0')
  return `${negativo ? '-' : ''}R$ ${agruparMilhar(String(reais))},${cent}`
}

/** Taxa em centavos/km (pode ter fração): 44.666 → 'R$ 0,45/km'. */
export function formatarCentavosPorKm(centavosPorKm: number): string {
  return `${formatarMoeda(centavosPorKm)}/km`
}

/**
 * Lê um valor digitado no padrão brasileiro e devolve centavos.
 * Aceita '1.234,56', 'R$ 80', '80,5', '1.234'. Inválido ou negativo → null.
 */
export function parseValorBR(s: string): number | null {
  const limpo = s.replace(/R\$/i, '').replace(/\s+/g, '')
  if (!limpo) return null
  const m = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(limpo)
  if (!m) return null
  const reais = Number(m[1].replace(/\./g, ''))
  const cent = m[2] ? Number(m[2].padEnd(2, '0')) : 0
  return reais * 100 + cent
}
