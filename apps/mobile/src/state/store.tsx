import {
  type Acrescimo,
  type AvaliacaoClienteFinal,
  type AvaliacaoEmpresa,
  type Espera,
  type FormaCobranca,
  type Lancamento,
  type MotivoImprodutiva,
} from '@at-field/core'
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useReducer,
  useState,
} from 'react'

import { EMPRESAS_MOCK } from '@/mocks/empresas'
import { criarLancamentosMock } from '@/mocks/lancamentos'
import { VEICULO_MOCK, type Veiculo, custoDoVeiculo } from '@/mocks/veiculo'
import { hojeISO } from '@/utils/datas'

import {
  type Acao,
  type Estado,
  type PatchLancamento,
  type PatchNegociacao,
  reducer,
} from './reducer'

let contador = 0
/** Id local sem uuid: tempo em base 36 + contador. */
export function novoId(): string {
  contador += 1
  return `${Date.now().toString(36)}${contador}`
}

export function estadoMock(hoje: string): Estado {
  return {
    lancamentos: criarLancamentosMock(hoje),
    empresas: EMPRESAS_MOCK,
    veiculo: VEICULO_MOCK,
  }
}

type ContextoStore = {
  estado: Estado
  dispatch: (a: Acao) => void
  hoje: string
  /** Mensagem rápida para a próxima tela (ex.: "Lançado."). */
  aviso: string | undefined
  setAviso: (a: string | undefined) => void
}

const StoreContext = createContext<ContextoStore | null>(null)

/** Estado em memória semeado pelos mocks (reiniciar o app volta aos mocks). */
export function StoreProvider({
  children,
  hoje: hojeProp,
  estadoInicial,
}: {
  children: ReactNode
  /** Data de referência (testes); padrão = hoje do aparelho. */
  hoje?: string
  estadoInicial?: Partial<Estado>
}) {
  const [hoje] = useState(() => hojeProp ?? hojeISO())
  const [estado, dispatch] = useReducer(reducer, undefined, () => ({
    ...estadoMock(hoje),
    ...estadoInicial,
  }))
  const [aviso, setAviso] = useState<string | undefined>()
  const valor = useMemo(
    () => ({ estado, dispatch, hoje, aviso, setAviso }),
    [estado, hoje, aviso],
  )
  return <StoreContext.Provider value={valor}>{children}</StoreContext.Provider>
}

function useStore(): ContextoStore {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore fora do StoreProvider')
  return ctx
}

export const useLancamentos = () => useStore().estado.lancamentos
export const useEmpresas = () => useStore().estado.empresas
export const useHoje = () => useStore().hoje

export function useAviso() {
  const { aviso, setAviso } = useStore()
  return { aviso, setAviso }
}

export function useEmpresa(id: string | undefined) {
  const empresas = useEmpresas()
  return id ? empresas.find(e => e.id === id) : undefined
}

export function useLancamento(id: string | undefined): Lancamento | undefined {
  const ls = useLancamentos()
  return id ? ls.find(l => l.id === id) : undefined
}

export function useVeiculo(): { veiculo: Veiculo; custoPorKmCentavos: number } {
  const { veiculo } = useStore().estado
  return useMemo(
    () => ({ veiculo, custoPorKmCentavos: custoDoVeiculo(veiculo).totalPorKm }),
    [veiculo],
  )
}

/** Ações tipadas sobre o store. */
export function useAcoes() {
  const { dispatch } = useStore()
  return useMemo(
    () => ({
      adicionar: (lancamento: Lancamento) =>
        dispatch({ tipo: 'adicionar', lancamento }),
      atualizar: (id: string, patch: PatchLancamento) =>
        dispatch({ tipo: 'atualizar', id, patch }),
      confirmar: (id: string) => dispatch({ tipo: 'confirmar', id }),
      marcarRecebido: (id: string, data: string) =>
        dispatch({ tipo: 'marcarRecebido', id, data }),
      marcarAReceber: (id: string) => dispatch({ tipo: 'marcarAReceber', id }),
      remover: (id: string) => dispatch({ tipo: 'remover', id }),
      marcarRealizado: (id: string, duracaoRealMin?: number) =>
        dispatch({ tipo: 'marcarRealizado', id, duracaoRealMin }),
      adicionarAcrescimo: (id: string, acrescimo: Acrescimo) =>
        dispatch({ tipo: 'adicionarAcrescimo', id, acrescimo }),
      removerAcrescimo: (id: string, acrescimoId: string) =>
        dispatch({ tipo: 'removerAcrescimo', id, acrescimoId }),
      trocarCobranca: (id: string, forma: FormaCobranca) =>
        dispatch({ tipo: 'trocarCobranca', id, forma }),
      avaliarClienteFinal: (id: string, avaliacao: AvaliacaoClienteFinal) =>
        dispatch({ tipo: 'avaliarClienteFinal', id, avaliacao }),
      limparAvaliacaoClienteFinal: (id: string) =>
        dispatch({ tipo: 'limparAvaliacaoClienteFinal', id }),
      registrarEspera: (id: string, espera: Espera) =>
        dispatch({ tipo: 'registrarEspera', id, espera }),
      removerEspera: (id: string) => dispatch({ tipo: 'removerEspera', id }),
      marcarImprodutivo: (
        id: string,
        motivo: MotivoImprodutiva,
        registradaEm: string,
      ) => dispatch({ tipo: 'marcarImprodutivo', id, motivo, registradaEm }),
      marcarProdutivo: (id: string) =>
        dispatch({ tipo: 'marcarProdutivo', id }),
      avaliar: (empresaId: string, avaliacao: AvaliacaoEmpresa) =>
        dispatch({ tipo: 'avaliar', empresaId, avaliacao }),
      alternarNaoAtendo: (empresaId: string) =>
        dispatch({ tipo: 'alternarNaoAtendo', empresaId }),
      vincularTelefone: (empresaId: string, telefone: string) =>
        dispatch({ tipo: 'vincularTelefone', empresaId, telefone }),
      desvincularTelefone: (empresaId: string, telefone: string) =>
        dispatch({ tipo: 'desvincularTelefone', empresaId, telefone }),
      atualizarNegociacao: (empresaId: string, patch: PatchNegociacao) =>
        dispatch({ tipo: 'atualizarNegociacao', empresaId, patch }),
      atualizarVeiculo: (veiculo: Veiculo) =>
        dispatch({ tipo: 'atualizarVeiculo', veiculo }),
    }),
    [dispatch],
  )
}
