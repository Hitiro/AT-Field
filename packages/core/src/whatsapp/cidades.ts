// Casamento de cidade/UF no texto, ignorando acentos e caixa.
import { normalizar } from '../texto'

export const UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const
export type UF = (typeof UFS)[number]

/** `id` = código IBGE na API; no app, id do mock. */
export type CidadeRef = { id: string; nome: string; uf: UF }

export function ehUF(s: string): s is UF {
  return (UFS as readonly string[]).includes(s)
}

const CIDADE_COM_UF =
  /[\s,]([A-Za-zÀ-ú' ]+?)\s*(?:-|\/)\s*([A-Z]{2})\b(?![A-Za-z])/g

/**
 * Procura "Cidade - UF" ou "Cidade/UF" numa linha. Testa as até 4 palavras antes
 * do separador, do sufixo mais longo ao mais curto. Devolve a cidade e a
 * posição onde o nome começa na linha.
 */
export function encontrarCidadeComUF(
  linha: string,
  cidades: CidadeRef[],
): { cidade: CidadeRef; inicio: number } | undefined {
  for (const m of ` ${linha}`.matchAll(CIDADE_COM_UF)) {
    const uf = m[2]
    if (!ehUF(uf)) continue
    const daUF = cidades.filter(c => c.uf === uf)
    const trecho = m[1].trimEnd()
    const palavras = trecho.split(/\s+/).filter(Boolean).slice(-4)
    for (let n = palavras.length; n >= 1; n--) {
      const sufixo = palavras.slice(-n).join(' ')
      const alvo = normalizar(sufixo)
      const cidade = daUF.find(c => normalizar(c.nome) === alvo)
      if (cidade) {
        // m.index aponta o separador inicial em ` ${linha}` (deslocado em 1)
        const fimTrecho = m.index + 1 + trecho.length
        const inicio = fimTrecho - sufixo.length - 1
        return { cidade, inicio }
      }
    }
  }
  return undefined
}

function contarLetras(s: string): number {
  return s.replace(/[^a-z]/g, '').length
}

/**
 * Procura nomes de cidade sem UF no texto normalizado (só nomes com 4+ letras,
 * com borda de palavra). Vence o nome mais longo; homônimos viram candidatas.
 */
export function encontrarCidadeSemUF(
  textoNormalizado: string,
  cidades: CidadeRef[],
): { cidade?: CidadeRef; candidatas?: CidadeRef[] } {
  let melhor = ''
  for (const c of cidades) {
    const nome = normalizar(c.nome)
    if (contarLetras(nome) < 4 || nome.length <= melhor.length) continue
    const escapado = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`(^|[^a-z])${escapado}([^a-z]|$)`).test(textoNormalizado)) {
      melhor = nome
    }
  }
  if (!melhor) return {}
  const mesmas = cidades.filter(c => normalizar(c.nome) === melhor)
  return mesmas.length === 1 ? { cidade: mesmas[0] } : { candidatas: mesmas }
}
