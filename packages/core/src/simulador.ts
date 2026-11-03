// TEC-48/49 (+ TEC-23a, 26, 27, 28, 29): simulador "compensa ou não compensa".
import type { FormaCobranca } from './cobranca'
import type { ErroCampo } from './erros'
import {
  type PoliticaImprodutiva,
  validarPoliticaImprodutiva,
} from './improdutiva'

export type CobrancaCenario =
  | {
      forma: 'chamado'
      valorCentavos: number
      percalMin?: number
      /** Ausente = a empresa não paga hora adicional. */
      horaAdicionalCentavos?: number
    }
  | { forma: 'hora'; valorHoraCentavos: number }
  | { forma: 'diaria'; valorDiariaCentavos: number; diarias: number }
  | { forma: 'pacote'; valorCentavos: number }

export type CenarioSimulacao = {
  nome: string
  cobranca: CobrancaCenario
  /** Distância exata da ida (rota); rodada sempre ida e volta. */
  distanciaIdaKm: number
  /** Estrada num sentido (conta 2×). */
  tempoIdaMin: number
  tempoAtendimentoMin: number
  /** Espera prevista no local (TEC-28); padrão 0. */
  esperaPrevistaMin?: number
  /** kmIdaPago = média combinada; ausente = exato (TEC-23a). */
  deslocamento: { centavosPorKm: number; kmIdaPago?: number }
  pedagio: { valorTotalCentavos: number; pagoPelaEmpresa: boolean }
  custoPorKmCentavos: number
  despesasPrevistas: { descricao: string; valorCentavos: number }[]
  /** Meta do técnico (R$/h). */
  valorHoraMinimoCentavos?: number
  /** Política para a linha "se for improdutiva" (TEC-29). */
  improdutiva?: PoliticaImprodutiva
}

export type ResultadoSimulacao = {
  kmRodados: number
  kmPagos: number
  minutosEstrada: number
  minutosNoLocal: number
  minutosTotais: number
  receitas: {
    servico: number
    deslocamento: number
    reembolsoPedagio: number
    horaAdicional: number
    total: number
  }
  custos: { veiculo: number; pedagio: number; despesas: number; total: number }
  sobraCentavos: number
  ganhoPorHoraCentavos: number | null
  saldoDeslocamentoCentavos: number
  deslocamentoCobre: boolean | null
  veredito: 'compensa' | 'nao_compensa'
  motivo: 'prejuizo' | 'abaixo_valor_hora' | null
  precoMinimo: { forma: FormaCobranca; valorCentavos: number } | null
  minutosExcedentesPercal: number
  valorHoraPercalCentavos: number | null
  seImprodutiva: {
    receitaCentavos: number
    sobraCentavos: number
    ganhoPorHoraCentavos: number | null
  } | null
}

const MAX_KM = 2000
const MAX_MIN = 1440

export function validarCenario(c: CenarioSimulacao): ErroCampo[] {
  const erros: ErroCampo[] = []
  const numero = (campo: string, v: number | undefined, max?: number) => {
    if (v === undefined) return
    if (!Number.isFinite(v) || v < 0) {
      erros.push({ campo, mensagem: 'Informe um número válido' })
    } else if (max !== undefined && v > max) {
      erros.push({ campo, mensagem: `Máximo ${max}` })
    }
  }

  if (!c.nome.trim()) erros.push({ campo: 'nome', mensagem: 'Informe o nome' })

  const cob = c.cobranca
  switch (cob.forma) {
    case 'chamado':
      numero('cobranca.valorCentavos', cob.valorCentavos)
      if (cob.percalMin !== undefined && !(cob.percalMin > 0)) {
        erros.push({
          campo: 'cobranca.percalMin',
          mensagem: 'Percal deve ser maior que zero',
        })
      } else {
        numero('cobranca.percalMin', cob.percalMin, MAX_MIN)
      }
      numero('cobranca.horaAdicionalCentavos', cob.horaAdicionalCentavos)
      break
    case 'hora':
      numero('cobranca.valorHoraCentavos', cob.valorHoraCentavos)
      break
    case 'diaria':
      numero('cobranca.valorDiariaCentavos', cob.valorDiariaCentavos)
      if (!Number.isFinite(cob.diarias) || !(cob.diarias > 0)) {
        erros.push({
          campo: 'cobranca.diarias',
          mensagem: 'Diárias devem ser maior que zero',
        })
      }
      break
    case 'pacote':
      numero('cobranca.valorCentavos', cob.valorCentavos)
      break
  }

  numero('distanciaIdaKm', c.distanciaIdaKm, MAX_KM)
  numero('tempoIdaMin', c.tempoIdaMin, MAX_MIN)
  numero('tempoAtendimentoMin', c.tempoAtendimentoMin, MAX_MIN)
  numero('esperaPrevistaMin', c.esperaPrevistaMin, MAX_MIN)
  numero('deslocamento.centavosPorKm', c.deslocamento.centavosPorKm)
  numero('deslocamento.kmIdaPago', c.deslocamento.kmIdaPago, MAX_KM)
  numero('pedagio.valorTotalCentavos', c.pedagio.valorTotalCentavos)
  numero('custoPorKmCentavos', c.custoPorKmCentavos)
  numero('valorHoraMinimoCentavos', c.valorHoraMinimoCentavos)
  c.despesasPrevistas.forEach((d, i) =>
    numero(`despesasPrevistas.${i}.valorCentavos`, d.valorCentavos),
  )
  if (c.improdutiva) {
    for (const e of validarPoliticaImprodutiva(c.improdutiva)) {
      erros.push({ campo: `improdutiva.${e.campo}`, mensagem: e.mensagem })
    }
  }
  return erros
}

function ganhoPorHora(sobra: number, minutos: number): number | null {
  return minutos > 0 ? Math.round((sobra * 60) / minutos) : null
}

/** Receita de serviço sem hora adicional, para um tempo no local. */
function servicoBase(cob: CobrancaCenario, noLocalMin: number): number {
  switch (cob.forma) {
    case 'chamado':
    case 'pacote':
      return cob.valorCentavos
    case 'hora':
      return Math.round((cob.valorHoraCentavos * noLocalMin) / 60)
    case 'diaria':
      return cob.valorDiariaCentavos * cob.diarias
  }
}

export function simular(c: CenarioSimulacao): ResultadoSimulacao {
  const erros = validarCenario(c)
  if (erros.length) {
    throw new RangeError(
      `Cenário inválido: ${erros.map(e => e.campo).join(', ')}`,
    )
  }
  const cob = c.cobranca
  const espera = c.esperaPrevistaMin ?? 0
  const kmRodados = 2 * c.distanciaIdaKm
  const kmPagos = 2 * (c.deslocamento.kmIdaPago ?? c.distanciaIdaKm)
  const minutosEstrada = 2 * c.tempoIdaMin
  const minutosNoLocal = c.tempoAtendimentoMin + espera
  const minutosTotais = minutosEstrada + minutosNoLocal

  const percal = cob.forma === 'chamado' ? cob.percalMin : undefined
  const minutosExcedentesPercal =
    percal !== undefined ? Math.max(0, minutosNoLocal - percal) : 0
  const horaAdicional =
    cob.forma === 'chamado' && cob.horaAdicionalCentavos
      ? Math.round((minutosExcedentesPercal * cob.horaAdicionalCentavos) / 60)
      : 0

  const servico = servicoBase(cob, minutosNoLocal)
  const deslocamento = Math.round(kmPagos * c.deslocamento.centavosPorKm)
  const reembolsoPedagio = c.pedagio.pagoPelaEmpresa
    ? c.pedagio.valorTotalCentavos
    : 0
  const receitaTotal = servico + deslocamento + reembolsoPedagio + horaAdicional

  const veiculo = Math.round(kmRodados * c.custoPorKmCentavos)
  const pedagio = c.pedagio.valorTotalCentavos
  const despesas = c.despesasPrevistas.reduce((t, d) => t + d.valorCentavos, 0)
  const custoTotal = veiculo + pedagio + despesas

  const sobraCentavos = receitaTotal - custoTotal
  const ganhoPorHoraCentavos = ganhoPorHora(sobraCentavos, minutosTotais)
  const saldoDeslocamentoCentavos = deslocamento + reembolsoPedagio - custoTotal
  const deslocamentoCobre =
    c.deslocamento.centavosPorKm === 0 && !c.pedagio.pagoPelaEmpresa
      ? null
      : saldoDeslocamentoCentavos >= 0

  const meta = c.valorHoraMinimoCentavos
  let veredito: ResultadoSimulacao['veredito'] = 'compensa'
  let motivo: ResultadoSimulacao['motivo'] = null
  if (sobraCentavos <= 0) {
    veredito = 'nao_compensa'
    motivo = 'prejuizo'
  } else if (
    meta !== undefined &&
    ganhoPorHoraCentavos !== null &&
    ganhoPorHoraCentavos < meta
  ) {
    veredito = 'nao_compensa'
    motivo = 'abaixo_valor_hora'
  }

  let precoMinimo: ResultadoSimulacao['precoMinimo'] = null
  if (meta !== undefined && minutosTotais > 0) {
    const total = Math.max(
      0,
      Math.ceil(
        (meta * minutosTotais) / 60 +
          custoTotal -
          deslocamento -
          reembolsoPedagio -
          horaAdicional,
      ),
    )
    if (cob.forma === 'hora') {
      precoMinimo =
        minutosNoLocal > 0
          ? {
              forma: 'hora',
              valorCentavos: Math.ceil((total * 60) / minutosNoLocal),
            }
          : null
    } else if (cob.forma === 'diaria') {
      precoMinimo = {
        forma: 'diaria',
        valorCentavos: Math.ceil(total / cob.diarias),
      }
    } else {
      precoMinimo = { forma: cob.forma, valorCentavos: total }
    }
  }

  let seImprodutiva: ResultadoSimulacao['seImprodutiva'] = null
  if (c.improdutiva) {
    const { percentual, pagaDeslocamento } = c.improdutiva
    const receitaCentavos =
      Math.round((servicoBase(cob, espera) * percentual) / 100) +
      (pagaDeslocamento ? deslocamento + reembolsoPedagio : 0)
    const sobra = receitaCentavos - custoTotal
    seImprodutiva = {
      receitaCentavos,
      sobraCentavos: sobra,
      ganhoPorHoraCentavos: ganhoPorHora(sobra, minutosEstrada + espera),
    }
  }

  return {
    kmRodados,
    kmPagos,
    minutosEstrada,
    minutosNoLocal,
    minutosTotais,
    receitas: {
      servico,
      deslocamento,
      reembolsoPedagio,
      horaAdicional,
      total: receitaTotal,
    },
    custos: { veiculo, pedagio, despesas, total: custoTotal },
    sobraCentavos,
    ganhoPorHoraCentavos,
    saldoDeslocamentoCentavos,
    deslocamentoCobre,
    veredito,
    motivo,
    precoMinimo,
    minutosExcedentesPercal,
    valorHoraPercalCentavos:
      cob.forma === 'chamado' && cob.percalMin !== undefined
        ? Math.round((cob.valorCentavos * 60) / cob.percalMin)
        : null,
    seImprodutiva,
  }
}

export type ComparacaoCenarios = {
  a: ResultadoSimulacao
  b: ResultadoSimulacao
  /** b − a. */
  diferencaSobraCentavos: number
  diferencaGanhoPorHoraCentavos: number | null
  melhor: 'a' | 'b' | 'empate'
}

export function compararCenarios(
  a: CenarioSimulacao,
  b: CenarioSimulacao,
): ComparacaoCenarios {
  const ra = simular(a)
  const rb = simular(b)
  const diferencaSobraCentavos = rb.sobraCentavos - ra.sobraCentavos
  return {
    a: ra,
    b: rb,
    diferencaSobraCentavos,
    diferencaGanhoPorHoraCentavos:
      ra.ganhoPorHoraCentavos !== null && rb.ganhoPorHoraCentavos !== null
        ? rb.ganhoPorHoraCentavos - ra.ganhoPorHoraCentavos
        : null,
    melhor:
      diferencaSobraCentavos > 0
        ? 'b'
        : diferencaSobraCentavos < 0
          ? 'a'
          : 'empate',
  }
}
