import {
  type ErroCampo,
  FORMAS_COBRANCA,
  type ResultadoSimulacao,
  compararCenarios,
  formatarCentavosPorKm,
  formatarMoeda,
  simular,
} from '@at-field/core'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { View } from 'react-native'

import { AvisosEmpresa } from '@/components/empresa/avisos-empresa'
import { Banner } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chips } from '@/components/ui/chips'
import { MoneyField } from '@/components/ui/money-field'
import { Screen } from '@/components/ui/screen'
import { Segmented } from '@/components/ui/segmented'
import { StatRow } from '@/components/ui/stat-row'
import { SwitchRow } from '@/components/ui/switch-row'
import { TextField } from '@/components/ui/text-field'
import { AppText } from '@/components/ui/text'
import { ROTAS } from '@/mocks/rotas'
import {
  FORM_A,
  FORM_B,
  type FormCenario,
  aplicarEmpresa,
  aplicarRota,
  cenarioDoForm,
} from '@/state/simulacao'
import { useEmpresas, useVeiculo } from '@/state/store'
import { formatarDuracao } from '@/utils/datas'
import { ROTULOS_FORMA_CURTO } from '@/utils/rotulos'

type Aba = 'a' | 'b' | 'comparar'

const SUFIXO_PRECO: Record<string, string> = { hora: '/h', diaria: '/diária' }

function ganho(r: ResultadoSimulacao) {
  return r.ganhoPorHoraCentavos === null
    ? '—'
    : `${formatarMoeda(r.ganhoPorHoraCentavos)}/h`
}

function Resultado({ r, f }: { r: ResultadoSimulacao; f: FormCenario }) {
  const veredito =
    r.veredito === 'compensa'
      ? 'Compensa'
      : r.motivo === 'prejuizo'
        ? `Não compensa: prejuízo de ${formatarMoeda(-r.sobraCentavos)}`
        : 'Não compensa: abaixo do seu valor/hora'
  const percal = f.forma === 'chamado' ? Number(f.percalMin) : undefined
  return (
    <Card titulo="Resultado">
      <AppText
        variante="h3"
        cor={r.veredito === 'compensa' ? 'success' : 'danger'}
      >
        {veredito}
      </AppText>
      <StatRow
        rotulo="Sobra no bolso"
        valor={formatarMoeda(r.sobraCentavos)}
        cor={r.sobraCentavos < 0 ? 'danger' : 'textHeading'}
        destaque
      />
      <StatRow rotulo="Ganho por hora" valor={ganho(r)} />
      <AppText variante="caption">
        Estrada {formatarDuracao(r.minutosEstrada)} (ida e volta) • no local{' '}
        {formatarDuracao(r.minutosNoLocal)}
        {f.esperaMin ? ` • Espera prevista ${f.esperaMin} min` : ''} • total{' '}
        {formatarDuracao(r.minutosTotais)}
      </AppText>
      <StatRow rotulo="Serviço" valor={formatarMoeda(r.receitas.servico)} />
      <StatRow
        rotulo="Deslocamento pago"
        valor={formatarMoeda(r.receitas.deslocamento)}
      />
      <StatRow
        rotulo="Reembolso de pedágio"
        valor={formatarMoeda(r.receitas.reembolsoPedagio)}
      />
      {r.receitas.horaAdicional > 0 ? (
        <AppText variante="small" cor="success">
          + hora adicional {formatarMoeda(r.receitas.horaAdicional)}
        </AppText>
      ) : null}
      <StatRow
        rotulo="Custo do veículo"
        valor={formatarMoeda(r.custos.veiculo)}
      />
      <StatRow rotulo="Pedágio" valor={formatarMoeda(r.custos.pedagio)} />
      <StatRow
        rotulo="Despesas previstas"
        valor={formatarMoeda(r.custos.despesas)}
      />
      {r.valorHoraPercalCentavos !== null && percal ? (
        <AppText variante="small">
          Percal: {formatarDuracao(percal)} •{' '}
          {formatarMoeda(r.valorHoraPercalCentavos)}/h (
          {formatarMoeda(f.valor ?? 0)} ÷ {formatarDuracao(percal)})
        </AppText>
      ) : null}
      {r.deslocamentoCobre !== null ? (
        <AppText
          variante="small"
          cor={r.deslocamentoCobre ? 'success' : 'warning'}
        >
          {r.deslocamentoCobre
            ? 'O deslocamento pago cobre a viagem'
            : `O deslocamento não cobre a viagem (${formatarMoeda(r.saldoDeslocamentoCentavos)})`}
        </AppText>
      ) : null}
      {r.precoMinimo ? (
        <StatRow
          rotulo="Preço mínimo para sua meta"
          valor={`${formatarMoeda(r.precoMinimo.valorCentavos)}${SUFIXO_PRECO[r.precoMinimo.forma] ?? ''}`}
        />
      ) : null}
      {r.seImprodutiva ? (
        <AppText
          variante="small"
          cor={r.seImprodutiva.sobraCentavos < 0 ? 'danger' : 'textSecondary'}
        >
          Se for improdutiva: {formatarMoeda(r.seImprodutiva.receitaCentavos)}{' '}
          (sobra {formatarMoeda(r.seImprodutiva.sobraCentavos)})
        </AppText>
      ) : null}
    </Card>
  )
}

function FormularioCenario({
  f,
  setF,
  erros,
}: {
  f: FormCenario
  setF: (f: FormCenario) => void
  erros: ErroCampo[]
}) {
  const router = useRouter()
  const empresas = useEmpresas()
  const { custoPorKmCentavos } = useVeiculo()
  const erro = (campo: string) => erros.find(e => e.campo === campo)?.mensagem
  const empresa = empresas.find(e => e.id === f.empresaId)
  const set = (p: Partial<FormCenario>) => setF({ ...f, ...p })
  const mediaSemDestino =
    empresa?.negociacao?.deslocamento.modoKm === 'media' && f.kmIdaPago === ''
  const kmPagos =
    2 * Number((f.kmIdaPago || f.distanciaIdaKm).replace(',', '.'))
  return (
    <>
      <Card titulo="Rota">
        <Chips
          opcoes={ROTAS.map(r => ({ valor: r.id, rotulo: r.rotulo }))}
          selecionado={f.rotaId}
          onChange={id => {
            const r = ROTAS.find(x => x.id === id)
            if (r) setF(aplicarRota(f, r, empresas))
          }}
        />
        <TextField
          rotulo="Distância da ida (km)"
          value={f.distanciaIdaKm}
          onChangeText={distanciaIdaKm => set({ distanciaIdaKm })}
          keyboardType="decimal-pad"
          erro={erro('distanciaIdaKm')}
        />
        {Number.isFinite(kmPagos) ? (
          <AppText variante="caption">
            km pagos: {kmPagos}{' '}
            {f.kmIdaPago
              ? '(média combinada)'
              : mediaSemDestino
                ? '(exato: sem média para este destino)'
                : '(exato)'}
          </AppText>
        ) : null}
        <TextField
          rotulo="Tempo de estrada da ida (min)"
          value={f.tempoIdaMin}
          onChangeText={tempoIdaMin => set({ tempoIdaMin })}
          keyboardType="number-pad"
          erro={erro('tempoIdaMin')}
        />
        <MoneyField
          rotulo="Pedágio (ida e volta)"
          valor={f.pedagio}
          onChange={pedagio => set({ pedagio })}
        />
        <SwitchRow
          rotulo="Empresa reembolsa o pedágio"
          valor={f.pedagioPago}
          onChange={pedagioPago => set({ pedagioPago })}
        />
      </Card>

      <Card titulo="Empresa e cobrança">
        <Chips
          opcoes={empresas.map(e => ({ valor: e.id, rotulo: e.nome }))}
          selecionado={f.empresaId}
          onChange={id => {
            const e = empresas.find(x => x.id === id)
            if (e) setF(aplicarEmpresa(f, e, empresas))
          }}
        />
        {empresa ? <AvisosEmpresa empresa={empresa} forma={f.forma} /> : null}
        {f.forma === 'chamado' && !f.percalMin.trim() && !empresa ? (
          <Banner tom="warning">Pergunte o percal antes de aceitar</Banner>
        ) : null}
        <Segmented
          opcoes={FORMAS_COBRANCA.map(x => ({
            valor: x,
            rotulo: ROTULOS_FORMA_CURTO[x],
          }))}
          valor={f.forma}
          onChange={forma => set({ forma })}
        />
        {f.forma === 'chamado' || f.forma === 'pacote' ? (
          <MoneyField
            rotulo={
              f.forma === 'pacote' ? 'Valor do pacote' : 'Valor do chamado'
            }
            valor={f.valor}
            onChange={valor => set({ valor })}
            erro={erro('cobranca.valorCentavos')}
          />
        ) : null}
        {f.forma === 'chamado' ? (
          <>
            <TextField
              rotulo="Percal (min)"
              value={f.percalMin}
              onChangeText={percalMin => set({ percalMin })}
              keyboardType="number-pad"
              erro={erro('cobranca.percalMin')}
            />
            <MoneyField
              rotulo="Hora adicional (R$/h, vazio = não paga)"
              valor={f.horaAdicional}
              onChange={horaAdicional => set({ horaAdicional })}
            />
          </>
        ) : null}
        {f.forma === 'hora' ? (
          <MoneyField
            rotulo="Valor da hora"
            valor={f.valorHora}
            onChange={valorHora => set({ valorHora })}
            erro={erro('cobranca.valorHoraCentavos')}
          />
        ) : null}
        {f.forma === 'diaria' ? (
          <>
            <MoneyField
              rotulo="Valor da diária"
              valor={f.valorDiaria}
              onChange={valorDiaria => set({ valorDiaria })}
              erro={erro('cobranca.valorDiariaCentavos')}
            />
            <TextField
              rotulo="Nº de diárias"
              value={f.diarias}
              onChangeText={diarias => set({ diarias })}
              keyboardType="number-pad"
              erro={erro('cobranca.diarias')}
            />
          </>
        ) : null}
        {f.forma === 'pacote' ? (
          <MoneyField
            rotulo="Material (custo previsto)"
            valor={f.material}
            onChange={material => set({ material })}
          />
        ) : null}
        <MoneyField
          rotulo="Deslocamento pago (R$/km)"
          valor={f.centavosPorKm}
          onChange={centavosPorKm => set({ centavosPorKm })}
        />
        <TextField
          rotulo="Km da ida pago (média combinada; vazio = exato)"
          value={f.kmIdaPago}
          onChangeText={kmIdaPago => set({ kmIdaPago })}
          keyboardType="decimal-pad"
          erro={erro('deslocamento.kmIdaPago')}
        />
      </Card>

      <Card titulo="Tempo e custos">
        <TextField
          rotulo="Atendimento (min)"
          value={f.atendimentoMin}
          onChangeText={atendimentoMin => set({ atendimentoMin })}
          keyboardType="number-pad"
          erro={erro('tempoAtendimentoMin')}
        />
        <TextField
          rotulo="Espera prevista (min)"
          value={f.esperaMin}
          onChangeText={esperaMin => set({ esperaMin })}
          keyboardType="number-pad"
          placeholder="opcional"
          erro={erro('esperaPrevistaMin')}
        />
        <MoneyField
          rotulo="Alimentação prevista"
          valor={f.alimentacao}
          onChange={alimentacao => set({ alimentacao })}
        />
        <MoneyField
          rotulo="Meu valor/hora mínimo"
          valor={f.meta}
          onChange={meta => set({ meta })}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppText variante="small" cor="textSecondary" style={{ flex: 1 }}>
            Custo do veículo: {formatarCentavosPorKm(custoPorKmCentavos)}{' '}
            (estimativa)
          </AppText>
          <Button
            titulo="Editar veículo"
            variante="ghost"
            pequeno
            onPress={() => router.push('/veiculo')}
          />
        </View>
      </Card>
    </>
  )
}

function Comparacao({ a, b }: { a: FormCenario; b: FormCenario }) {
  const { custoPorKmCentavos } = useVeiculo()
  const ca = cenarioDoForm(a, custoPorKmCentavos).cenario
  const cb = cenarioDoForm(b, custoPorKmCentavos).cenario
  if (!ca || !cb) {
    return (
      <Banner tom="warning">
        Preencha os campos destacados nos cenários A e B.
      </Banner>
    )
  }
  const c = compararCenarios(ca, cb)
  const melhor =
    c.melhor === 'empate'
      ? 'Empate: os dois sobram o mesmo'
      : `Melhor: ${c.melhor === 'a' ? 'A' : 'B'} (sobra ${formatarMoeda(Math.abs(c.diferencaSobraCentavos))} a mais)`
  return (
    <>
      <Banner tom="success">{melhor}</Banner>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {(['a', 'b'] as const).map(k => (
          <View key={k} style={{ flex: 1 }}>
            <Card titulo={k.toUpperCase()}>
              <AppText variante="small">Sobra</AppText>
              <AppText
                variante="h4"
                cor={c[k].sobraCentavos < 0 ? 'danger' : 'textHeading'}
              >
                {formatarMoeda(c[k].sobraCentavos)}
              </AppText>
              <AppText variante="small">Ganho/h</AppText>
              <AppText variante="body">{ganho(c[k])}</AppText>
              <AppText variante="small">
                {c[k].veredito === 'compensa' ? 'Compensa' : 'Não compensa'}
              </AppText>
            </Card>
          </View>
        ))}
      </View>
      {c.diferencaGanhoPorHoraCentavos !== null ? (
        <AppText variante="small" cor="textSecondary">
          Diferença de ganho/h (B − A):{' '}
          {formatarMoeda(c.diferencaGanhoPorHoraCentavos)}
        </AppText>
      ) : null}
    </>
  )
}

export default function Simular() {
  const { custoPorKmCentavos } = useVeiculo()
  const [aba, setAba] = useState<Aba>('a')
  const [a, setA] = useState<FormCenario>(FORM_A)
  const [b, setB] = useState<FormCenario>(FORM_B)
  const f = aba === 'b' ? b : a
  const setF = aba === 'b' ? setB : setA
  const { cenario, erros } = useMemo(
    () => cenarioDoForm(f, custoPorKmCentavos),
    [f, custoPorKmCentavos],
  )
  const resultado = useMemo(
    () => (cenario ? simular(cenario) : undefined),
    [cenario],
  )

  return (
    <Screen>
      <Segmented
        opcoes={[
          { valor: 'a', rotulo: 'A' },
          { valor: 'b', rotulo: 'B' },
          { valor: 'comparar', rotulo: 'Comparar' },
        ]}
        valor={aba}
        onChange={setAba}
      />
      <AppText variante="caption">
        Sem API de rota no protótipo: rotas de exemplo ou distância digitada
        (custo R$ 0).
      </AppText>
      {aba === 'comparar' ? (
        <Comparacao a={a} b={b} />
      ) : (
        <>
          <FormularioCenario key={aba} f={f} setF={setF} erros={erros} />
          {resultado ? (
            <Resultado r={resultado} f={f} />
          ) : (
            <Banner tom="warning">Preencha os campos destacados</Banner>
          )}
        </>
      )}
    </Screen>
  )
}
