// Formulário do simulador (texto digitado) → CenarioSimulacao do core.
import {
  type CenarioSimulacao,
  type CobrancaCenario,
  type Empresa,
  type ErroCampo,
  type FormaCobranca,
  type PoliticaImprodutiva,
  kmIdaParaPagamento,
  validarCenario,
} from '@at-field/core'

import type { RotaMock } from '@/mocks/rotas'
import { lerInteiro, lerNumero } from '@/utils/datas'

export type FormCenario = {
  nome: string
  rotaId?: string
  empresaId?: string
  destinoCidadeId?: string
  forma: FormaCobranca
  /** chamado/pacote */
  valor?: number
  valorHora?: number
  valorDiaria?: number
  diarias: string
  percalMin: string
  horaAdicional?: number
  distanciaIdaKm: string
  tempoIdaMin: string
  atendimentoMin: string
  esperaMin: string
  centavosPorKm?: number
  /** km da ida pago (média combinada); vazio = exato */
  kmIdaPago: string
  pedagio?: number
  pedagioPago: boolean
  alimentacao?: number
  material?: number
  meta?: number
  improdutiva?: PoliticaImprodutiva
}

export const META_PADRAO = 3000

/** A: Maringá (exemplo real); B: dois chamados em Londrina (TEC-49). */
export const FORM_A: FormCenario = {
  nome: 'A',
  rotaId: 'maringa',
  destinoCidadeId: 'maringa',
  forma: 'chamado',
  valor: 10000,
  diarias: '1',
  percalMin: '240',
  horaAdicional: 2500,
  distanciaIdaKm: '100',
  tempoIdaMin: '60',
  atendimentoMin: '60',
  esperaMin: '',
  centavosPorKm: 80,
  kmIdaPago: '',
  pedagio: 2600,
  pedagioPago: true,
  alimentacao: 3000,
  meta: META_PADRAO,
}

export const FORM_B: FormCenario = {
  nome: 'B',
  rotaId: 'londrina',
  destinoCidadeId: 'londrina',
  forma: 'chamado',
  valor: 20000,
  diarias: '1',
  percalMin: '',
  distanciaIdaKm: '15',
  tempoIdaMin: '20',
  atendimentoMin: '120',
  esperaMin: '',
  centavosPorKm: 0,
  kmIdaPago: '',
  pedagio: 0,
  pedagioPago: false,
  meta: META_PADRAO,
}

export function aplicarRota(
  f: FormCenario,
  r: RotaMock,
  empresas: Empresa[],
): FormCenario {
  const novo: FormCenario = {
    ...f,
    rotaId: r.id,
    destinoCidadeId: r.destinoCidadeId,
    distanciaIdaKm: String(r.distanciaIdaKm),
    tempoIdaMin: String(r.tempoIdaMin),
    pedagio: r.pedagioCentavos,
  }
  return recalcularKmPago(novo, empresas)
}

function recalcularKmPago(f: FormCenario, empresas: Empresa[]): FormCenario {
  const neg = empresas.find(e => e.id === f.empresaId)?.negociacao
  if (!neg) return f
  // NaN como "exato" marca quando não há média para o destino
  const km = kmIdaParaPagamento(neg.deslocamento, f.destinoCidadeId, Number.NaN)
  return { ...f, kmIdaPago: Number.isNaN(km) ? '' : String(km) }
}

/** Chip de empresa: preenche pela tarifa da forma padrão e pela negociação. */
export function aplicarEmpresa(
  f: FormCenario,
  e: Empresa,
  empresas: Empresa[],
): FormCenario {
  const neg = e.negociacao
  if (!neg) return { ...f, empresaId: e.id }
  const t = neg.tarifas
  const novo: FormCenario = {
    ...f,
    empresaId: e.id,
    forma: neg.formaPadrao,
    centavosPorKm: neg.deslocamento.centavosPorKm,
    pedagioPago: neg.reembolsaPedagio,
    horaAdicional: neg.horaAdicional.paga
      ? neg.horaAdicional.valorHoraCentavos
      : undefined,
    improdutiva: neg.improdutiva,
    percalMin:
      t.chamado?.percalMin !== undefined ? String(t.chamado.percalMin) : '',
  }
  if (neg.formaPadrao === 'chamado') novo.valor = t.chamado?.valorCentavos
  if (t.hora) novo.valorHora = t.hora.valorHoraCentavos
  if (t.diaria) novo.valorDiaria = t.diaria.valorDiariaCentavos
  return recalcularKmPago(novo, empresas)
}

export type ResultadoForm = { cenario?: CenarioSimulacao; erros: ErroCampo[] }

const ERRO_NUMERO = 'Informe um número válido'

/** Converte o formulário; erros de digitação e de `validarCenario` por campo. */
export function cenarioDoForm(
  f: FormCenario,
  custoPorKmCentavos: number,
): ResultadoForm {
  const erros: ErroCampo[] = []
  const num = (
    campo: string,
    texto: string,
    obrigatorio: boolean,
    inteiro = false,
  ) => {
    const v = inteiro ? lerInteiro(texto) : lerNumero(texto)
    if (v === undefined) {
      if (obrigatorio) erros.push({ campo, mensagem: 'Obrigatório' })
      return undefined
    }
    if (Number.isNaN(v)) {
      erros.push({ campo, mensagem: ERRO_NUMERO })
      return undefined
    }
    return v
  }
  const obrigatorioCentavos = (campo: string, v: number | undefined) => {
    if (v === undefined) erros.push({ campo, mensagem: 'Obrigatório' })
    return v ?? 0
  }

  const distancia = num('distanciaIdaKm', f.distanciaIdaKm, true)
  const tempoIda = num('tempoIdaMin', f.tempoIdaMin, true, true)
  const atendimento = num('tempoAtendimentoMin', f.atendimentoMin, true, true)
  const espera = num('esperaPrevistaMin', f.esperaMin, false, true)
  const kmIdaPago = num('deslocamento.kmIdaPago', f.kmIdaPago, false)

  let cobranca: CobrancaCenario
  switch (f.forma) {
    case 'chamado': {
      const percal = num('cobranca.percalMin', f.percalMin, false, true)
      cobranca = {
        forma: 'chamado',
        valorCentavos: obrigatorioCentavos('cobranca.valorCentavos', f.valor),
        ...(percal !== undefined ? { percalMin: percal } : {}),
        ...(percal !== undefined && f.horaAdicional !== undefined
          ? { horaAdicionalCentavos: f.horaAdicional }
          : {}),
      }
      break
    }
    case 'hora':
      cobranca = {
        forma: 'hora',
        valorHoraCentavos: obrigatorioCentavos(
          'cobranca.valorHoraCentavos',
          f.valorHora,
        ),
      }
      break
    case 'diaria':
      cobranca = {
        forma: 'diaria',
        valorDiariaCentavos: obrigatorioCentavos(
          'cobranca.valorDiariaCentavos',
          f.valorDiaria,
        ),
        diarias: num('cobranca.diarias', f.diarias, true, true) ?? 0,
      }
      break
    case 'pacote':
      cobranca = {
        forma: 'pacote',
        valorCentavos: obrigatorioCentavos('cobranca.valorCentavos', f.valor),
      }
      break
  }

  if (erros.length) return { erros }

  const despesasPrevistas = [
    ...(f.alimentacao
      ? [{ descricao: 'Alimentação', valorCentavos: f.alimentacao }]
      : []),
    ...(f.forma === 'pacote' && f.material
      ? [{ descricao: 'Material', valorCentavos: f.material }]
      : []),
  ]
  const cenario: CenarioSimulacao = {
    nome: f.nome,
    cobranca,
    distanciaIdaKm: distancia!,
    tempoIdaMin: tempoIda!,
    tempoAtendimentoMin: atendimento!,
    ...(espera !== undefined ? { esperaPrevistaMin: espera } : {}),
    deslocamento: {
      centavosPorKm: f.centavosPorKm ?? 0,
      ...(kmIdaPago !== undefined ? { kmIdaPago } : {}),
    },
    pedagio: {
      valorTotalCentavos: f.pedagio ?? 0,
      pagoPelaEmpresa: f.pedagioPago,
    },
    custoPorKmCentavos,
    despesasPrevistas,
    ...(f.meta !== undefined ? { valorHoraMinimoCentavos: f.meta } : {}),
    ...(f.improdutiva ? { improdutiva: f.improdutiva } : {}),
  }
  const invalidos = validarCenario(cenario)
  return invalidos.length ? { erros: invalidos } : { cenario, erros: [] }
}
