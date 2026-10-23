// "Colar mensagem do WhatsApp" (EMP-11 / TEC-02f): extração por regras,
// determinística, sem rede e sem LLM. Nunca lança; nunca inventa valor.
import type { Empresa } from '../empresas'
import { empresaPorTelefone, normalizarTelefone } from '../telefone'
import { normalizar } from '../texto'
import {
  type CidadeRef,
  type UF,
  encontrarCidadeComUF,
  encontrarCidadeSemUF,
} from './cidades'
import { type DataExtraida, extrairDataHora } from './datas'
import { separarMensagens } from './prefixo'

export type DemandaExtraida = {
  /** Sem prefixos e ruído, mensagens unidas por '\n'. */
  textoLimpo: string
  remetente?: string
  /** Remetente que é telefone, normalizado. */
  remetenteTelefone?: string
  /** Do 1º prefixo. */
  recebidaEm?: { data: string; hora: string }
  empresa?: {
    nome: string
    id?: string
    origem: 'texto' | 'telefone' | 'remetente'
  }
  cliente?: string
  codigoChamado?: string
  /** Shopping/loja. */
  local?: string
  cidade?: { id: string; nome: string; uf: UF }
  /** Homônimos sem UF que os desempate. */
  cidadeCandidatas?: CidadeRef[]
  motivo?: string
  ferramentas: string[]
  data?: DataExtraida
  deslocamentoPago?: boolean
  pedagioPago?: boolean
  pedeIndicacao: boolean
  observacoes: string[]
}

export type OpcoesParser = {
  cidades: CidadeRef[]
  empresas?: Pick<Empresa, 'id' | 'nome' | 'telefones'>[]
  /** YYYY-MM-DD: data em que o técnico colou (a função nunca lê o relógio). */
  hoje: string
}

const SAUDACAO =
  /^(oi|ola|bom dia|boa tarde|boa noite)([\s,!.]+(tudo bem|tudo bom|td bem)( com voces?)?)?[\s?!.]*$/
const COBRANCA = /^alguem( disponivel)?[\s?!.]*$/
const ROTULO = /^(motivo|servico|atividade|descricao)\s*:/
const ROTULO_CONHECIDO =
  /^(motivo|servico|atividade|descricao|ferramentas?|local|endereco|cidade|data|horario|hora|valor|cliente|chamado|contato|obs|observacao|observacoes)\s*:/
const TELEFONE = /^[+\d\s()-]+$/
const FIM_EMPRESA = String.raw`(?=\s*[,.;!?\n]|\s+(?:estamos|estou|e\s)|$)`
const EMPRESA_FALO = new RegExp(
  String.raw`\b(?:falo|sou|aqui [eé])\s+d[aoe]\s+(?:empresa\s+)?(.+?)` +
    FIM_EMPRESA,
  'i',
)
const EMPRESA_PALAVRA = new RegExp(
  String.raw`\bempresa\s+([A-ZÀ-Ú].+?)` + FIM_EMPRESA,
)
const CHAMADO = /\bchamado\s+([A-Za-zÀ-ú0-9&.' ]+?)\s*-\s*(\d+)\b/i

/** Linha só com emoji/símbolos (não vazia), saudação ou "alguém?". */
function ehRuido(linha: string): boolean {
  if (!linha.trim()) return false
  const n = normalizar(linha)
  return !/[\p{L}\p{N}]/u.test(n) || SAUDACAO.test(n) || COBRANCA.test(n)
}

/** Remove ruído, apara as pontas e colapsa linhas vazias repetidas. */
function limpar(linhas: string[]): string[] {
  const r: string[] = []
  for (const bruta of linhas) {
    const linha = bruta.replace(/\s+$/, '')
    if (ehRuido(linha)) continue
    if (!linha.trim() && (!r.length || !r[r.length - 1].trim())) continue
    r.push(linha)
  }
  while (r.length && !r[r.length - 1].trim()) r.pop()
  return r
}

const VERBO_PAGAR =
  '(?:pagamos|pagam|paga|pago|reembolsamos|reembolsam|reembolsa|cobrimos|cobrem|cobre)'
const NEGACAO = /(^|[^a-z])(nao|sem|nunca)([^a-z]|$)/

/**
 * Sinal "a empresa paga X" por oração (separada por pontuação ou quebra de
 * linha). Negação ("nao", "sem", "nunca") antes do verbo na mesma oração, ou
 * "sem X", vira false; negação vence afirmação em qualquer oração.
 */
function sinal(texto: string, termo: string): boolean | undefined {
  const sim = new RegExp(
    `(^|[^a-z])${VERBO_PAGAR}( (o|a|os|as))? ${termo}|${termo} (pago|paga|incluso|reembolsado)`,
  )
  const sem = new RegExp(`(^|[^a-z])sem( (o|a|os|as))? ${termo}`)
  let resultado: boolean | undefined
  for (const oracao of texto.split(/[.,;!?\n]+/)) {
    if (sem.test(oracao)) return false
    const m = sim.exec(oracao)
    if (!m) continue
    if (NEGACAO.test(oracao.slice(0, m.index + m[0].length))) return false
    resultado = true
  }
  return resultado
}

function extrairFerramentas(linhas: string[]): string[] {
  const inicio = linhas.findIndex(l => /^ferramentas?\b/.test(normalizar(l)))
  if (inicio < 0) return []
  const itens: string[] = []
  const primeira = linhas[inicio]
  const doisPontos = primeira.indexOf(':')
  if (doisPontos >= 0) {
    itens.push(
      ...primeira
        .slice(doisPontos + 1)
        .split(/[,;]/)
        .map(s => s.trim())
        .filter(Boolean),
    )
  } else {
    itens.push(primeira.trim())
  }
  for (const linha of linhas.slice(inicio + 1)) {
    if (!linha.trim() || ROTULO_CONHECIDO.test(normalizar(linha))) break
    itens.push(linha.trim())
  }
  return itens
}

function resolverEmpresa(
  texto: string,
  remetente: string | undefined,
  telefone: string | undefined,
  empresas: Pick<Empresa, 'id' | 'nome' | 'telefones'>[],
): DemandaExtraida['empresa'] {
  const m = EMPRESA_FALO.exec(texto) ?? EMPRESA_PALAVRA.exec(texto)
  if (m) {
    const nome = m[1].trim()
    const conhecida = empresas.find(
      e => normalizar(e.nome) === normalizar(nome),
    )
    return conhecida
      ? { nome: conhecida.nome, id: conhecida.id, origem: 'texto' }
      : { nome, origem: 'texto' }
  }
  if (telefone) {
    const id = empresaPorTelefone(telefone, empresas)
    const e = empresas.find(x => x.id === id)
    if (e) return { nome: e.nome, id: e.id, origem: 'telefone' }
  }
  if (remetente) {
    const n = normalizar(remetente)
    const e = empresas.find(x => {
      const nome = normalizar(x.nome)
      return nome.length > 0 && n.includes(nome)
    })
    if (e) return { nome: e.nome, id: e.id, origem: 'remetente' }
    const limpo = remetente.replace(/\[[^\]]*\]/g, '').trim()
    if (limpo) return { nome: limpo, origem: 'remetente' }
  }
  return undefined
}

export function parseDemandaWhatsApp(
  texto: string,
  opts: OpcoesParser,
): DemandaExtraida {
  const empresas = opts.empresas ?? []
  const mensagens = separarMensagens(texto ?? '', opts.hoje).map(m => ({
    ...m,
    linhas: limpar(m.linhas),
  }))
  const comTexto = mensagens.filter(m => m.linhas.some(l => l.trim()))
  const linhas = limpar(comTexto.flatMap(m => m.linhas))
  const textoLimpo = linhas.join('\n')
  const normal = normalizar(textoLimpo)

  const r: DemandaExtraida = {
    textoLimpo,
    ferramentas: [],
    pedeIndicacao: false,
    observacoes: [],
  }

  // 1. Remetente e recebimento (1ª mensagem com prefixo)
  const primeira = mensagens.find(m => m.remetente !== undefined)
  let telefone: string | undefined
  let remetenteNome: string | undefined
  if (primeira?.remetente) {
    r.recebidaEm = { data: primeira.data!, hora: primeira.hora! }
    if (TELEFONE.test(primeira.remetente)) {
      telefone = normalizarTelefone(primeira.remetente) ?? undefined
      if (telefone) r.remetenteTelefone = telefone
    } else {
      remetenteNome = primeira.remetente
      r.remetente = primeira.remetente
    }
  }

  // 3. Empresa
  const empresa = resolverEmpresa(textoLimpo, remetenteNome, telefone, empresas)
  if (empresa) r.empresa = empresa

  // 4. Cliente e código do chamado
  const chamado = CHAMADO.exec(textoLimpo)
  if (chamado) {
    r.cliente = chamado[1].trim()
    r.codigoChamado = chamado[2]
  }

  // 5. Cidade: com UF (linha a linha), senão sem UF
  for (const linha of linhas) {
    const achada = encontrarCidadeComUF(linha, opts.cidades)
    if (!achada) continue
    const { id, nome, uf } = achada.cidade
    r.cidade = { id, nome, uf }
    const cod = CHAMADO.exec(linha)
    if (cod) {
      const fimCodigo = cod.index + cod[0].length
      const local = linha.slice(fimCodigo, achada.inicio).trim()
      if (local && achada.inicio > fimCodigo) r.local = local
    }
    break
  }
  if (!r.cidade) {
    const semUF = encontrarCidadeSemUF(normal, opts.cidades)
    if (semUF.cidade) {
      const { id, nome, uf } = semUF.cidade
      r.cidade = { id, nome, uf }
    } else if (semUF.candidatas) {
      r.cidadeCandidatas = semUF.candidatas
    }
  }

  // 6. Motivo
  for (const linha of linhas) {
    if (ROTULO.test(normalizar(linha))) {
      const motivo = linha
        .slice(linha.indexOf(':') + 1)
        .replace(/\s+/g, ' ')
        .trim()
      if (motivo) r.motivo = motivo
      break
    }
  }

  // 7. Ferramentas
  r.ferramentas = extrairFerramentas(linhas)

  // 8. Sinais
  const porLinha = linhas.map(normalizar).join('\n')
  const desl = sinal(porLinha, '(deslocamento|km|quilometragem)')
  if (desl !== undefined) r.deslocamentoPago = desl
  const ped = sinal(porLinha, 'pedagios?')
  if (ped !== undefined) r.pedagioPago = ped
  r.pedeIndicacao = /indica(m|r)? (alguem|algum tecnico)|indicacao/.test(normal)
  r.observacoes = linhas
    .filter(l => normalizar(l).includes('divisa'))
    .map(l => l.trim())

  // 9. Data/hora: referência = data do prefixo da mensagem, senão hoje
  for (const m of comTexto) {
    const d = extrairDataHora(
      normalizar(m.linhas.join('\n')),
      m.data ?? opts.hoje,
      m.data !== undefined,
    )
    if (d) {
      r.data = d
      break
    }
  }

  return r
}
