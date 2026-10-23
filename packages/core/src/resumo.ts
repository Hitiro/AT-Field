// TEC-02a (resumo do mês) e TEC-02c (financeiro).
import { totalDoServico } from './atendimento'
import { prejuizoImprodutiva } from './improdutiva'
import {
  CATEGORIAS_DESPESA,
  type CategoriaDespesa,
  type Lancamento,
  type LancamentoServico,
} from './lancamentos'

export type Mes = { ano: number; mes: number }

export type TotalPorEmpresa = {
  empresaNome: string
  quantidade: number
  totalCentavos: number
}

export const SEM_EMPRESA = 'Sem empresa'

export function noMes(data: string | undefined, { ano, mes }: Mes): boolean {
  return !!data && data.startsWith(`${ano}-${String(mes).padStart(2, '0')}-`)
}

function agruparPorEmpresa(
  itens: { s: LancamentoServico; total: number }[],
): TotalPorEmpresa[] {
  const mapa = new Map<string, TotalPorEmpresa>()
  for (const { s, total } of itens) {
    const nome = s.empresaNome?.trim() || SEM_EMPRESA
    const g = mapa.get(nome) ?? {
      empresaNome: nome,
      quantidade: 0,
      totalCentavos: 0,
    }
    g.quantidade += 1
    g.totalCentavos += total
    mapa.set(nome, g)
  }
  return [...mapa.values()].sort((a, b) => b.totalCentavos - a.totalCentavos)
}

/** Valor do lançamento para somar: total do serviço ou valor da despesa. */
function valorDe(l: Lancamento): number | undefined {
  return l.tipo === 'servico' ? totalDoServico(l) : l.valorCentavos
}

export type ResumoDoMes = {
  servicoCentavos: number
  custosCentavos: number
  resultadoCentavos: number
  porEmpresa: TotalPorEmpresa[]
  /** Quantos "a revisar" entraram no total. */
  incluiNaoRevisados: number
  /** Lançamentos sem valor ou sem data (fora do total). */
  foraDoTotal: number
  improdutivos: { quantidade: number; deixouDeReceberCentavos: number }
}

/**
 * Serviços realizados e despesas do mês, revisados ou não, com valor e data.
 * Agendado não é serviço prestado e fica de fora.
 */
export function resumoDoMes(ls: Lancamento[], mes: Mes): ResumoDoMes {
  let servicoCentavos = 0
  let custosCentavos = 0
  let incluiNaoRevisados = 0
  let foraDoTotal = 0
  const improdutivos = { quantidade: 0, deixouDeReceberCentavos: 0 }
  const servicos: { s: LancamentoServico; total: number }[] = []

  for (const l of ls) {
    if (l.tipo === 'servico' && l.situacao !== 'realizado') continue
    const valor = valorDe(l)
    if (!l.data || (noMes(l.data, mes) && valor === undefined)) {
      foraDoTotal += 1
      continue
    }
    if (!noMes(l.data, mes) || valor === undefined) continue
    if (l.status === 'a_revisar') incluiNaoRevisados += 1
    if (l.tipo === 'servico') {
      servicoCentavos += valor
      servicos.push({ s: l, total: valor })
      if (l.resultado === 'improdutivo') {
        improdutivos.quantidade += 1
        improdutivos.deixouDeReceberCentavos +=
          prejuizoImprodutiva(l, 0).deixouDeReceberCentavos ?? 0
      }
    } else {
      custosCentavos += valor
    }
  }

  return {
    servicoCentavos,
    custosCentavos,
    resultadoCentavos: servicoCentavos - custosCentavos,
    porEmpresa: agruparPorEmpresa(servicos),
    incluiNaoRevisados,
    foraDoTotal,
    improdutivos,
  }
}

export type Financeiro = {
  aReceber: { totalCentavos: number; porEmpresa: TotalPorEmpresa[] }
  recebidoNoMesCentavos: number
  despesasNoMes: {
    totalCentavos: number
    porCategoria: Record<CategoriaDespesa, number>
  }
}

/**
 * A receber: serviços realizados não recebidos, de qualquer mês, com total > 0.
 * Recebido: pela data de recebimento no mês. Despesas: pela data no mês
 * (sem categoria conta em "outros").
 */
export function financeiro(ls: Lancamento[], mes: Mes): Financeiro {
  const aReceber: { s: LancamentoServico; total: number }[] = []
  let recebidoNoMesCentavos = 0
  const porCategoria = Object.fromEntries(
    CATEGORIAS_DESPESA.map(c => [c, 0]),
  ) as Record<CategoriaDespesa, number>
  let totalDespesas = 0

  for (const l of ls) {
    if (l.tipo === 'despesa') {
      if (noMes(l.data, mes) && l.valorCentavos !== undefined) {
        porCategoria[l.categoria ?? 'outros'] += l.valorCentavos
        totalDespesas += l.valorCentavos
      }
      continue
    }
    if (l.situacao !== 'realizado') continue
    const total = totalDoServico(l)
    if (total === undefined) continue
    if (l.recebimento.status === 'a_receber') {
      if (total > 0) aReceber.push({ s: l, total })
    } else if (noMes(l.recebimento.recebidoEm, mes)) {
      recebidoNoMesCentavos += total
    }
  }

  return {
    aReceber: {
      totalCentavos: aReceber.reduce((t, i) => t + i.total, 0),
      porEmpresa: agruparPorEmpresa(aReceber),
    },
    recebidoNoMesCentavos,
    despesasNoMes: { totalCentavos: totalDespesas, porCategoria },
  }
}
