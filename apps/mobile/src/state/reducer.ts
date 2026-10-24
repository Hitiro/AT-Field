// Reducer puro do protótipo: lançamentos, empresas e veículo em memória.
import {
  type Acrescimo,
  type AvaliacaoClienteFinal,
  type AvaliacaoEmpresa,
  type CategoriaDespesa,
  type Empresa,
  type Espera,
  type FormaCobranca,
  type Lancamento,
  type LancamentoServico,
  type MotivoImprodutiva,
  type Negociacao,
  POLITICA_NAO_INFORMADA,
  empresaPorTelefone,
  horaValida,
  novaCobranca,
  normalizarTelefone,
  podeConfirmar,
  validarAvaliacao,
  validarAvaliacaoClienteFinal,
  validarEspera,
  validarRegistroImprodutiva,
} from '@at-field/core'

import type { Veiculo } from '@/mocks/veiculo'

export type Estado = {
  lancamentos: Lancamento[]
  empresas: Empresa[]
  veiculo: Veiculo
}

/** Campos editáveis de um lançamento (id, tipo, criadoEm e status ficam de fora). */
export type PatchLancamento = Partial<
  Omit<LancamentoServico, 'id' | 'tipo' | 'criadoEm' | 'status'>
> & { categoria?: CategoriaDespesa }

export type PatchNegociacao = {
  /** null remove o percal (não informado). */
  percalMin?: number | null
  horaAdicional?: Negociacao['horaAdicional']
}

export type Acao =
  | { tipo: 'adicionar'; lancamento: Lancamento }
  | { tipo: 'atualizar'; id: string; patch: PatchLancamento }
  | { tipo: 'confirmar'; id: string }
  | { tipo: 'marcarRecebido'; id: string; data: string }
  | { tipo: 'marcarAReceber'; id: string }
  | { tipo: 'remover'; id: string }
  | { tipo: 'marcarRealizado'; id: string; duracaoRealMin?: number }
  | { tipo: 'adicionarAcrescimo'; id: string; acrescimo: Acrescimo }
  | { tipo: 'removerAcrescimo'; id: string; acrescimoId: string }
  | { tipo: 'trocarCobranca'; id: string; forma: FormaCobranca }
  | {
      tipo: 'avaliarClienteFinal'
      id: string
      avaliacao: AvaliacaoClienteFinal
    }
  | { tipo: 'limparAvaliacaoClienteFinal'; id: string }
  | { tipo: 'registrarEspera'; id: string; espera: Espera }
  | { tipo: 'removerEspera'; id: string }
  | {
      tipo: 'marcarImprodutivo'
      id: string
      motivo: MotivoImprodutiva
      registradaEm: string
    }
  | { tipo: 'marcarProdutivo'; id: string }
  | { tipo: 'avaliar'; empresaId: string; avaliacao: AvaliacaoEmpresa }
  | { tipo: 'alternarNaoAtendo'; empresaId: string }
  | { tipo: 'vincularTelefone'; empresaId: string; telefone: string }
  | { tipo: 'desvincularTelefone'; empresaId: string; telefone: string }
  | { tipo: 'atualizarNegociacao'; empresaId: string; patch: PatchNegociacao }
  | { tipo: 'atualizarVeiculo'; veiculo: Veiculo }

const duracaoValida = (m: number | undefined) =>
  m === undefined || (Number.isFinite(m) && m > 0 && m <= 1440)

/** Aplica `f` ao lançamento `id`; inexistente ou `f` devolvendo o mesmo → mesmo estado. */
function noLancamento(
  estado: Estado,
  id: string,
  f: (l: Lancamento) => Lancamento,
): Estado {
  const i = estado.lancamentos.findIndex(l => l.id === id)
  if (i < 0) return estado
  const novo = f(estado.lancamentos[i])
  if (novo === estado.lancamentos[i]) return estado
  const lancamentos = [...estado.lancamentos]
  lancamentos[i] = novo
  return { ...estado, lancamentos }
}

function noServico(
  estado: Estado,
  id: string,
  f: (s: LancamentoServico) => LancamentoServico,
): Estado {
  return noLancamento(estado, id, l => (l.tipo === 'servico' ? f(l) : l))
}

function naEmpresa(
  estado: Estado,
  empresaId: string,
  f: (e: Empresa) => Empresa,
): Estado {
  const i = estado.empresas.findIndex(e => e.id === empresaId)
  if (i < 0) return estado
  const nova = f(estado.empresas[i])
  if (nova === estado.empresas[i]) return estado
  const empresas = [...estado.empresas]
  empresas[i] = nova
  return { ...estado, empresas }
}

function semChave<T extends object, K extends keyof T>(o: T, k: K): Omit<T, K> {
  const { [k]: _removida, ...resto } = o
  return resto
}

export function reducer(estado: Estado, acao: Acao): Estado {
  switch (acao.tipo) {
    case 'adicionar': {
      const l = acao.lancamento
      const novo: Lancamento =
        l.origem !== 'completo' ? { ...l, status: 'a_revisar' } : l
      return { ...estado, lancamentos: [novo, ...estado.lancamentos] }
    }

    case 'atualizar':
      return noLancamento(estado, acao.id, l => {
        const p: Record<string, unknown> = { ...acao.patch }
        for (const k of ['id', 'tipo', 'criadoEm', 'status']) delete p[k]
        for (const k of ['duracaoEstimadaMin', 'duracaoRealMin'] as const) {
          if (k in p && !duracaoValida(p[k] as number | undefined)) delete p[k]
        }
        if (typeof p.hora === 'string' && !horaValida(p.hora)) delete p.hora
        if (l.tipo === 'despesa') {
          return { ...l, ...(p as Partial<typeof l>) }
        }
        delete p.categoria
        return { ...l, ...(p as Partial<LancamentoServico>) }
      })

    case 'confirmar':
      return noLancamento(estado, acao.id, l =>
        podeConfirmar(l) && l.status !== 'confirmado'
          ? { ...l, status: 'confirmado' }
          : l,
      )

    case 'marcarRecebido':
      return noServico(estado, acao.id, s => ({
        ...s,
        recebimento: { status: 'recebido', recebidoEm: acao.data },
      }))

    case 'marcarAReceber':
      return noServico(estado, acao.id, s => ({
        ...s,
        recebimento: { status: 'a_receber' },
      }))

    case 'remover': {
      const lancamentos = estado.lancamentos.filter(l => l.id !== acao.id)
      return lancamentos.length === estado.lancamentos.length
        ? estado
        : { ...estado, lancamentos }
    }

    case 'marcarRealizado':
      return noServico(estado, acao.id, s => {
        if (!duracaoValida(acao.duracaoRealMin)) return s
        const r: LancamentoServico = { ...s, situacao: 'realizado' }
        if (acao.duracaoRealMin !== undefined)
          r.duracaoRealMin = acao.duracaoRealMin
        return r
      })

    case 'adicionarAcrescimo':
      return noServico(estado, acao.id, s =>
        acao.acrescimo.valorCentavos > 0
          ? { ...s, acrescimos: [...s.acrescimos, acao.acrescimo] }
          : s,
      )

    case 'removerAcrescimo':
      return noServico(estado, acao.id, s => {
        const acrescimos = s.acrescimos.filter(a => a.id !== acao.acrescimoId)
        return acrescimos.length === s.acrescimos.length
          ? s
          : { ...s, acrescimos }
      })

    case 'trocarCobranca':
      return noServico(estado, acao.id, s => {
        if (s.cobranca.forma === acao.forma) return s
        const neg = estado.empresas.find(e => e.id === s.empresaId)?.negociacao
        const { cobranca, valorCentavos } = novaCobranca(neg, acao.forma)
        const valorFixo = (f: FormaCobranca) =>
          f === 'chamado' || f === 'pacote'
        // entre chamado ↔ pacote mantém o valor digitado
        const valor =
          valorFixo(s.cobranca.forma) && valorFixo(acao.forma)
            ? s.valorCentavos
            : valorCentavos
        const r: LancamentoServico = {
          ...semChave(s, 'valorCentavos'),
          cobranca,
        }
        if (valor !== undefined) r.valorCentavos = valor
        return r
      })

    case 'avaliarClienteFinal':
      return noServico(estado, acao.id, s =>
        validarAvaliacaoClienteFinal(s, acao.avaliacao).length
          ? s
          : { ...s, avaliacaoClienteFinal: acao.avaliacao },
      )

    case 'limparAvaliacaoClienteFinal':
      return noServico(estado, acao.id, s =>
        s.avaliacaoClienteFinal ? semChave(s, 'avaliacaoClienteFinal') : s,
      )

    case 'registrarEspera':
      return noServico(estado, acao.id, s =>
        validarEspera(acao.espera).length ? s : { ...s, espera: acao.espera },
      )

    case 'removerEspera':
      return noServico(estado, acao.id, s =>
        s.espera ? semChave(s, 'espera') : s,
      )

    case 'marcarImprodutivo':
      return noServico(estado, acao.id, s => {
        // já registrada: mantém a política gravada (TEC-21); só troca motivo/data
        const politica =
          s.improdutiva?.politica ??
          estado.empresas.find(e => e.id === s.empresaId)?.negociacao
            ?.improdutiva ??
          POLITICA_NAO_INFORMADA
        const registro = {
          motivo: acao.motivo,
          registradaEm: acao.registradaEm,
          politica: { ...politica },
        }
        if (validarRegistroImprodutiva(registro).length) return s
        return {
          ...s,
          situacao: 'realizado',
          resultado: 'improdutivo',
          improdutiva: registro,
        }
      })

    case 'marcarProdutivo':
      return noServico(estado, acao.id, s =>
        s.resultado === 'produtivo'
          ? s
          : { ...semChave(s, 'improdutiva'), resultado: 'produtivo' },
      )

    case 'avaliar':
      return naEmpresa(estado, acao.empresaId, e =>
        validarAvaliacao(acao.avaliacao).length
          ? e
          : { ...e, avaliacao: { ...acao.avaliacao, empresaId: e.id } },
      )

    case 'alternarNaoAtendo':
      return naEmpresa(estado, acao.empresaId, e => ({
        ...e,
        naoAtendo: !e.naoAtendo,
      }))

    case 'vincularTelefone': {
      const tel = normalizarTelefone(acao.telefone)
      if (!tel) return estado
      const dono = empresaPorTelefone(tel, estado.empresas)
      if (dono !== undefined) return estado
      return naEmpresa(estado, acao.empresaId, e => ({
        ...e,
        telefones: [...e.telefones, tel],
      }))
    }

    case 'desvincularTelefone':
      return naEmpresa(estado, acao.empresaId, e => {
        const telefones = e.telefones.filter(t => t !== acao.telefone)
        return telefones.length === e.telefones.length ? e : { ...e, telefones }
      })

    case 'atualizarNegociacao':
      return naEmpresa(estado, acao.empresaId, e => {
        if (!e.negociacao) return e
        const neg: Negociacao = {
          ...e.negociacao,
          tarifas: { ...e.negociacao.tarifas },
        }
        const { percalMin, horaAdicional } = acao.patch
        if (percalMin !== undefined) {
          if (percalMin !== null && !(percalMin > 0)) return e
          const chamado = neg.tarifas.chamado
          if (!chamado) return e
          neg.tarifas.chamado =
            percalMin === null
              ? semChave(chamado, 'percalMin')
              : { ...chamado, percalMin }
        }
        if (horaAdicional) {
          if (horaAdicional.paga && !(horaAdicional.valorHoraCentavos >= 0))
            return e
          neg.horaAdicional = horaAdicional
        }
        return { ...e, negociacao: neg }
      })

    case 'atualizarVeiculo': {
      const v = acao.veiculo
      if (
        !(v.consumoKmPorLitro > 0) ||
        !(v.precoLitroCentavos >= 0) ||
        !(v.manutencaoCentavosPorKm >= 0)
      ) {
        return estado
      }
      return { ...estado, veiculo: v }
    }
  }
}
