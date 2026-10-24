import { describe, expect, it } from 'vitest'

import { servico } from './__fixtures__/dados'
import { totalDoServico } from './atendimento'
import {
  type PoliticaImprodutiva,
  type RegistroImprodutiva,
  motivosClienteSugeridosPelaImprodutiva,
  motivosEmpresaSugeridosPelaImprodutiva,
  prejuizoImprodutiva,
  validarPoliticaImprodutiva,
  validarRegistroImprodutiva,
  valorImprodutiva,
} from './improdutiva'
import type { LancamentoServico } from './lancamentos'
import { pendenciasDe } from './lancamentos'

const registro = (politica: PoliticaImprodutiva): RegistroImprodutiva => ({
  motivo: 'entrada_nao_liberada',
  registradaEm: '2026-10-22T09:40:00',
  politica,
})

const improdutivo = (
  politica: PoliticaImprodutiva,
  p: Partial<LancamentoServico> = {},
): LancamentoServico =>
  servico({ resultado: 'improdutivo', improdutiva: registro(politica), ...p })

/** Serviço improdutivo da Protege (mock da Parte F). */
const protege = improdutivo(
  { percentual: 0, pagaDeslocamento: false },
  {
    empresaId: 'protege',
    empresaNome: 'Protege',
    valorCentavos: 9000,
    deslocamento: { kmIda: 40, tempoIdaMin: 40, valorCentavos: 6400 },
    espera: { minutos: 60, motivo: 'liberacao_acesso' },
  },
)

const POLITICA_OK: PoliticaImprodutiva = {
  percentual: 50,
  pagaDeslocamento: true,
}

const acrescimo = { id: 'a', motivo: 'Material', valorCentavos: 2000 }

describe('valor da improdutiva', () => {
  it('GWT 63: { 50, true } → 5000 + 16000 + 2000 = 23000; produtivo → 28000', () => {
    const s = improdutivo(
      { percentual: 50, pagaDeslocamento: true },
      { deslocamento: { valorCentavos: 16000 }, acrescimos: [acrescimo] },
    )
    expect(valorImprodutiva(s)).toBe(21000)
    expect(totalDoServico(s)).toBe(23000)
    expect(
      totalDoServico({ ...s, resultado: 'produtivo', improdutiva: undefined }),
    ).toBe(28000)
  })

  it('GWT 64: { 0, false } → só acréscimos manuais', () => {
    const s = improdutivo(
      { percentual: 0, pagaDeslocamento: false },
      { deslocamento: { valorCentavos: 16000 }, acrescimos: [acrescimo] },
    )
    expect(totalDoServico(s)).toBe(2000)
  })

  it('GWT 65: por hora sem real, espera 60, { 50, false } → 5000; sem espera → undefined', () => {
    const hora = { forma: 'hora', valorHoraCentavos: 10000 } as const
    const s = improdutivo(
      { percentual: 50, pagaDeslocamento: false },
      { cobranca: hora, espera: { minutos: 60, motivo: 'liberacao_acesso' } },
    )
    expect(totalDoServico(s)).toBe(5000)
    const sem = improdutivo(
      { percentual: 50, pagaDeslocamento: false },
      { cobranca: hora },
    )
    expect(totalDoServico(sem)).toBeUndefined()
    expect(pendenciasDe(sem)).toContain('horas')
  })

  it('GWT 66: diária { 100, true } + deslocamento 5000 → 45000; pacote { 50, false } → 75000', () => {
    expect(
      totalDoServico(
        improdutivo(
          { percentual: 100, pagaDeslocamento: true },
          {
            cobranca: {
              forma: 'diaria',
              valorDiariaCentavos: 40000,
              diarias: 1,
            },
            deslocamento: { valorCentavos: 5000 },
          },
        ),
      ),
    ).toBe(45000)
    expect(
      totalDoServico(
        improdutivo(
          { percentual: 50, pagaDeslocamento: false },
          {
            cobranca: { forma: 'pacote', incluiMaterial: true },
            valorCentavos: 150000,
          },
        ),
      ),
    ).toBe(75000)
  })

  it('paga deslocamento sem valor de deslocamento → só o percentual', () => {
    expect(
      valorImprodutiva(improdutivo({ percentual: 50, pagaDeslocamento: true })),
    ).toBe(5000)
  })

  it('produtivo → valorImprodutiva undefined', () => {
    expect(valorImprodutiva(servico())).toBeUndefined()
  })

  it('GWT 68: política da negociação mudar depois não afeta o registro gravado', () => {
    // o registro guarda uma cópia; nada da negociação atual entra no cálculo
    expect(totalDoServico(protege)).toBe(0)
  })
})

describe('prejuizoImprodutiva', () => {
  it('GWT 67: Protege, custo/km 100', () => {
    expect(prejuizoImprodutiva(protege, 100)).toEqual({
      receberiaCentavos: 15400,
      recebeCentavos: 0,
      deixouDeReceberCentavos: 15400,
      custoIdaCentavos: 8000,
      tempoPerdidoMin: 140,
      resultadoLiquidoCentavos: -8000,
    })
  })

  it('GWT 67: custo/km do veículo mock (R$ 6,70 ÷ 15 + R$ 0,30 ≈ 74,67) → 5973', () => {
    expect(prejuizoImprodutiva(protege, 670 / 15 + 30).custoIdaCentavos).toBe(
      5973,
    )
  })

  it('produtivo → só tempo perdido 0', () => {
    expect(prejuizoImprodutiva(servico(), 100)).toEqual({ tempoPerdidoMin: 0 })
  })

  it('sem km nem base → só o que dá para calcular', () => {
    const s = improdutivo(
      { percentual: 0, pagaDeslocamento: false },
      { valorCentavos: undefined, duracaoRealMin: 30 },
    )
    expect(prejuizoImprodutiva(s, 100)).toEqual({ tempoPerdidoMin: 30 })
  })

  it('km sem base → custo da ida sem resultado líquido', () => {
    const s = improdutivo(
      { percentual: 0, pagaDeslocamento: false },
      { valorCentavos: undefined, deslocamento: { kmIda: 10 } },
    )
    expect(prejuizoImprodutiva(s, 100)).toEqual({
      tempoPerdidoMin: 0,
      custoIdaCentavos: 2000,
    })
  })
})

describe('validação', () => {
  it.each([-1, 101, 50.5])('GWT 71: percentual %d → erro', percentual => {
    expect(
      validarPoliticaImprodutiva({ percentual, pagaDeslocamento: false }),
    ).toHaveLength(1)
  })

  it('percentual 0 e 100 valem', () => {
    expect(
      validarPoliticaImprodutiva({ percentual: 0, pagaDeslocamento: false }),
    ).toEqual([])
    expect(
      validarPoliticaImprodutiva({ percentual: 100, pagaDeslocamento: true }),
    ).toEqual([])
  })

  it('GWT 71: motivo fora da lista, data-hora inválida e política inválida', () => {
    expect(validarRegistroImprodutiva(registro(POLITICA_OK))).toEqual([])
    expect(
      validarRegistroImprodutiva({
        motivo: 'chuva' as never,
        registradaEm: 'ontem',
        politica: { percentual: 120, pagaDeslocamento: false },
      }).map(e => e.campo),
    ).toEqual(['motivo', 'registradaEm', 'politica.percentual'])
    expect(
      validarRegistroImprodutiva({
        ...registro(POLITICA_OK),
        registradaEm: '2026-13-40T25:00',
      }).map(e => e.campo),
    ).toEqual(['registradaEm'])
    expect(
      validarRegistroImprodutiva({
        ...registro(POLITICA_OK),
        registradaEm: '2026-10-22T09:40:00.000Z',
      }),
    ).toEqual([])
  })
})

describe('motivos sugeridos', () => {
  it('GWT 72', () => {
    expect(
      motivosClienteSugeridosPelaImprodutiva('entrada_nao_liberada'),
    ).toEqual(['acesso_dificil_espera_liberacao'])
    expect(
      motivosClienteSugeridosPelaImprodutiva('responsavel_ausente'),
    ).toEqual(['responsavel_ausente'])
    expect(motivosClienteSugeridosPelaImprodutiva('outro')).toEqual([])
    expect(
      motivosEmpresaSugeridosPelaImprodutiva({
        percentual: 0,
        pagaDeslocamento: true,
      }),
    ).toEqual(['nao_paga_improdutiva'])
    expect(
      motivosEmpresaSugeridosPelaImprodutiva({
        percentual: 50,
        pagaDeslocamento: false,
      }),
    ).toEqual([])
  })
})
