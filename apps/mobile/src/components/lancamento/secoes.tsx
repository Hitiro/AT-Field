// Seções da tela /lancamento/[id] para serviços.
import {
  type Empresa,
  FORMAS_COBRANCA,
  MOTIVOS_CLIENTE_FINAL,
  MOTIVOS_ESPERA,
  MOTIVOS_IMPRODUTIVA,
  type MotivoClienteFinal,
  type MotivoEspera,
  type MotivoImprodutiva,
  type LancamentoServico,
  ROTULOS_CLIENTE_FINAL,
  ROTULOS_ESPERA,
  ROTULOS_IMPRODUTIVA,
  formatarMoeda,
  motivosClienteSugeridosPelaEspera,
  motivosClienteSugeridosPelaImprodutiva,
  prejuizoImprodutiva,
  sugerirAcrescimo,
  tempoDoAtendimento,
  totalDoServico,
  validarAvaliacaoClienteFinal,
  validarRegistroImprodutiva,
  POLITICA_NAO_INFORMADA,
} from '@at-field/core'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { HistoricoCliente } from '@/components/historico-cliente'
import { Banner } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chips, ChipsMulti } from '@/components/ui/chips'
import { ListItem } from '@/components/ui/list-item'
import { MoneyField } from '@/components/ui/money-field'
import { NumberField } from '@/components/ui/number-field'
import { Segmented } from '@/components/ui/segmented'
import { StatRow } from '@/components/ui/stat-row'
import { SwitchRow } from '@/components/ui/switch-row'
import { TextField } from '@/components/ui/text-field'
import { AppText } from '@/components/ui/text'
import { novoId, useAcoes, useHoje, useVeiculo } from '@/state/store'
import { agoraISO, formatarDuracao } from '@/utils/datas'
import { ROTULOS_FORMA_CURTO } from '@/utils/rotulos'

/** Mesma checagem de data-hora do registro de improdutiva no core. */
function dataHoraValida(t: string): boolean {
  return !validarRegistroImprodutiva({
    motivo: 'outro',
    registradaEm: t,
    politica: POLITICA_NAO_INFORMADA,
  }).length
}

type Props = { s: LancamentoServico; empresa?: Empresa }

export function SecaoCobranca({ s }: Props) {
  const { atualizar, trocarCobranca } = useAcoes()
  const c = s.cobranca
  const total = totalDoServico(s)
  return (
    <Card titulo="Cobrança">
      <Segmented
        opcoes={FORMAS_COBRANCA.map(f => ({
          valor: f,
          rotulo: ROTULOS_FORMA_CURTO[f],
        }))}
        valor={c.forma}
        onChange={f => trocarCobranca(s.id, f)}
      />
      {c.forma === 'chamado' ? (
        <>
          <MoneyField
            rotulo="Valor do chamado"
            valor={s.valorCentavos}
            onChange={v => atualizar(s.id, { valorCentavos: v })}
          />
          <NumberField
            key={`percal-${c.forma}`}
            rotulo="Percal (min)"
            valor={c.percalMin}
            min={1}
            dica="Franquia de tempo do valor do chamado"
            onChange={v =>
              atualizar(s.id, {
                cobranca:
                  v === undefined
                    ? { forma: 'chamado' }
                    : { forma: 'chamado', percalMin: v },
              })
            }
          />
        </>
      ) : null}
      {c.forma === 'hora' ? (
        <>
          <MoneyField
            rotulo="Valor da hora"
            valor={c.valorHoraCentavos}
            onChange={v =>
              atualizar(s.id, { cobranca: { ...c, valorHoraCentavos: v } })
            }
          />
          <NumberField
            rotulo="Horas cobradas (min)"
            valor={c.horasCobradasMin}
            min={1}
            placeholder="= tempo real"
            onChange={v =>
              atualizar(s.id, { cobranca: { ...c, horasCobradasMin: v } })
            }
          />
        </>
      ) : null}
      {c.forma === 'diaria' ? (
        <>
          <MoneyField
            rotulo="Valor da diária"
            valor={c.valorDiariaCentavos}
            onChange={v =>
              atualizar(s.id, { cobranca: { ...c, valorDiariaCentavos: v } })
            }
          />
          <NumberField
            rotulo="Nº de diárias"
            valor={c.diarias}
            min={1}
            max={365}
            onChange={v => atualizar(s.id, { cobranca: { ...c, diarias: v } })}
          />
        </>
      ) : null}
      {c.forma === 'pacote' ? (
        <>
          <MoneyField
            rotulo="Valor do pacote"
            valor={s.valorCentavos}
            onChange={v => atualizar(s.id, { valorCentavos: v })}
          />
          <SwitchRow
            rotulo="Inclui material"
            valor={c.incluiMaterial}
            onChange={incluiMaterial =>
              atualizar(s.id, { cobranca: { ...c, incluiMaterial } })
            }
          />
        </>
      ) : null}
      <StatRow
        rotulo="Total"
        valor={total === undefined ? 'incompleto' : formatarMoeda(total)}
        destaque
      />
    </Card>
  )
}

export function SecaoResultado({ s, empresa }: Props) {
  const router = useRouter()
  const { marcarImprodutivo, marcarProdutivo } = useAcoes()
  const [registradaEm, setRegistradaEm] = useState(
    () => s.improdutiva?.registradaEm ?? agoraISO(),
  )
  const [improdutivoAberto, setImprodutivoAberto] = useState(
    s.resultado === 'improdutivo',
  )
  const reg = s.improdutiva
  const nome = empresa?.nome ?? s.empresaNome ?? 'Empresa'
  const politica = reg
    ? !empresa?.negociacao?.improdutiva &&
      reg.politica.percentual === 0 &&
      !reg.politica.pagaDeslocamento
      ? 'Política não informada: considerado 0%'
      : reg.politica.percentual === 0
        ? `${nome}: não paga improdutiva`
        : `${nome}: paga ${reg.politica.percentual}%${reg.politica.pagaDeslocamento ? ' + deslocamento' : ''}`
    : undefined
  return (
    <Card titulo="Resultado">
      <Segmented
        opcoes={[
          { valor: 'produtivo', rotulo: 'Produtivo' },
          { valor: 'improdutivo', rotulo: 'Improdutivo' },
        ]}
        valor={improdutivoAberto ? 'improdutivo' : 'produtivo'}
        onChange={v => {
          setImprodutivoAberto(v === 'improdutivo')
          if (v === 'produtivo') marcarProdutivo(s.id)
        }}
      />
      {improdutivoAberto ? (
        <>
          <AppText variante="caption">Motivo (fora do seu controle)</AppText>
          <Chips<MotivoImprodutiva>
            opcoes={MOTIVOS_IMPRODUTIVA.map(m => ({
              valor: m,
              rotulo: ROTULOS_IMPRODUTIVA[m],
            }))}
            selecionado={reg?.motivo}
            onChange={m =>
              m &&
              dataHoraValida(registradaEm) &&
              marcarImprodutivo(s.id, m, registradaEm)
            }
          />
          <TextField
            rotulo="Registrado em"
            value={registradaEm}
            onChangeText={t => {
              setRegistradaEm(t)
              if (reg && dataHoraValida(t))
                marcarImprodutivo(s.id, reg.motivo, t)
            }}
            erro={
              dataHoraValida(registradaEm)
                ? undefined
                : 'Data e hora inválidas (AAAA-MM-DDTHH:MM)'
            }
            dica="Data e hora do registro (AAAA-MM-DDTHH:MM). Ajuda a cobrar."
          />
          {reg ? (
            <>
              <AppText variante="body">
                Registrado: {ROTULOS_IMPRODUTIVA[reg.motivo]} em{' '}
                {reg.registradaEm.replace('T', ' ').slice(0, 16)}
              </AppText>
              <AppText variante="small" cor="textSecondary">
                {politica}
              </AppText>
              <Banner tom="info">Acréscimos lançados continuam somando.</Banner>
              {reg.politica.percentual === 0 && s.empresaId ? (
                <Button
                  titulo={`Avaliar ${nome}`}
                  variante="ghost"
                  onPress={() =>
                    router.push({
                      pathname: '/empresa/[id]',
                      params: {
                        id: s.empresaId!,
                        sugerir: 'nao_paga_improdutiva',
                      },
                    })
                  }
                />
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </Card>
  )
}

export function SecaoDeslocamento({ s }: Props) {
  const { atualizar } = useAcoes()
  const d = s.deslocamento ?? {}
  return (
    <Card titulo="Deslocamento">
      <NumberField
        rotulo="Km da ida"
        valor={d.kmIda}
        max={2000}
        onChange={kmIda => atualizar(s.id, { deslocamento: { ...d, kmIda } })}
      />
      <NumberField
        rotulo="Tempo da ida (min)"
        valor={d.tempoIdaMin}
        onChange={tempoIdaMin =>
          atualizar(s.id, { deslocamento: { ...d, tempoIdaMin } })
        }
      />
      <MoneyField
        rotulo="Valor do deslocamento"
        valor={d.valorCentavos}
        onChange={valorCentavos =>
          atualizar(s.id, { deslocamento: { ...d, valorCentavos } })
        }
      />
    </Card>
  )
}

export function CardPrejuizo({ s }: Props) {
  const { custoPorKmCentavos } = useVeiculo()
  if (s.resultado !== 'improdutivo') return null
  const p = prejuizoImprodutiva(s, custoPorKmCentavos)
  const m = (v: number | undefined) =>
    v === undefined ? '—' : formatarMoeda(v)
  return (
    <Card titulo="Prejuízo">
      <AppText variante="body">
        Receberia {m(p.receberiaCentavos)} • Recebe {m(p.recebeCentavos)} •
        Deixou de receber {m(p.deixouDeReceberCentavos)}
      </AppText>
      <AppText variante="body">
        {p.custoIdaCentavos !== undefined
          ? `Ida e volta custou ${m(p.custoIdaCentavos)} (${2 * (s.deslocamento?.kmIda ?? 0)} km) • `
          : ''}
        Tempo perdido {formatarDuracao(p.tempoPerdidoMin)}
      </AppText>
      {p.resultadoLiquidoCentavos !== undefined ? (
        <AppText
          variante="h4"
          cor={p.resultadoLiquidoCentavos < 0 ? 'danger' : 'textHeading'}
        >
          Resultado {m(p.resultadoLiquidoCentavos)}
        </AppText>
      ) : null}
    </Card>
  )
}

export function SecaoTempo({ s, empresa }: Props) {
  const { atualizar, registrarEspera, removerEspera } = useAcoes()
  const [espMin, setEspMin] = useState<number | undefined>(s.espera?.minutos)
  const [espMotivo, setEspMotivo] = useState<MotivoEspera | undefined>(
    s.espera?.motivo,
  )
  const t = tempoDoAtendimento(s, empresa?.negociacao)
  const previsto = `${formatarDuracao(t.previstoMin)}${
    t.origemPrevisto === 'percal'
      ? ' (percal)'
      : t.origemPrevisto === 'padrao'
        ? ' (padrão)'
        : ''
  }`
  const partes: string[] = []
  if (t.realMin !== undefined)
    partes.push(`Atendimento ${formatarDuracao(t.realMin)}`)
  if (s.espera) {
    partes.push(
      `Espera ${formatarDuracao(s.espera.minutos)} (${ROTULOS_ESPERA[s.espera.motivo]})`,
    )
  }
  if (t.totalNoLocalMin !== undefined)
    partes.push(`No local ${formatarDuracao(t.totalNoLocalMin)}`)
  partes.push(`Previsto ${previsto}`)
  return (
    <Card titulo="Tempo">
      <NumberField
        rotulo="Duração estimada (min)"
        valor={s.duracaoEstimadaMin}
        min={1}
        onChange={v => atualizar(s.id, { duracaoEstimadaMin: v })}
      />
      <NumberField
        rotulo="Atendimento real (min)"
        valor={s.duracaoRealMin}
        min={1}
        dica="Só o atendimento, sem a espera"
        onChange={v => atualizar(s.id, { duracaoRealMin: v })}
      />
      <AppText variante="body">{partes.join(' • ')}</AppText>
      {t.diferencaMin !== undefined && t.diferencaMin !== 0 ? (
        <AppText variante="small" cor={t.excedeu ? 'warning' : 'success'}>
          {t.excedeu ? '+' : ''}
          {formatarDuracao(t.diferencaMin)} em relação ao previsto
        </AppText>
      ) : null}
      {t.ganhoPorHoraCentavos !== null ? (
        <StatRow
          rotulo="Ganho por hora no local"
          valor={formatarMoeda(t.ganhoPorHoraCentavos)}
        />
      ) : null}

      <AppText variante="rotulo">Espera</AppText>
      <NumberField
        rotulo="Espera (min)"
        valor={espMin}
        min={1}
        onChange={setEspMin}
      />
      <Chips<MotivoEspera>
        opcoes={MOTIVOS_ESPERA.map(m => ({
          valor: m,
          rotulo: ROTULOS_ESPERA[m],
        }))}
        selecionado={espMotivo}
        onChange={setEspMotivo}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button
            titulo="Registrar espera"
            variante="secondary"
            pequeno
            desabilitado={espMin === undefined || !espMotivo}
            onPress={() =>
              espMin !== undefined &&
              espMotivo &&
              registrarEspera(s.id, { minutos: espMin, motivo: espMotivo })
            }
          />
        </View>
        {s.espera ? (
          <View style={{ flex: 1 }}>
            <Button
              titulo="Remover espera"
              variante="ghost"
              pequeno
              onPress={() => removerEspera(s.id)}
            />
          </View>
        ) : null}
      </View>
    </Card>
  )
}

export function SecaoAcrescimos({ s, empresa }: Props) {
  const { adicionarAcrescimo, removerAcrescimo } = useAcoes()
  const [motivo, setMotivo] = useState('')
  const [minutos, setMinutos] = useState<number | undefined>()
  const [valor, setValor] = useState<number | undefined>()
  const [versao, setVersao] = useState(0)
  const sugestao = sugerirAcrescimo(s, empresa?.negociacao)
  return (
    <Card titulo="Acréscimos">
      {s.acrescimos.map(a => (
        <ListItem
          key={a.id}
          titulo={a.motivo || '(sem motivo)'}
          subtitulo={a.minutos ? formatarDuracao(a.minutos) : undefined}
          direita={formatarMoeda(a.valorCentavos)}
          extra={
            <Button
              titulo="Remover"
              variante="ghost"
              pequeno
              onPress={() => removerAcrescimo(s.id, a.id)}
            />
          }
        />
      ))}
      {sugestao ? (
        <Button
          titulo="Sugerir pela negociação"
          variante="secondary"
          pequeno
          onPress={() => {
            setMotivo(sugestao.motivoSugerido)
            setMinutos(sugestao.minutos)
            setValor(sugestao.valorCentavos)
            setVersao(v => v + 1)
          }}
        />
      ) : null}
      <TextField
        rotulo="Motivo do acréscimo"
        value={motivo}
        onChangeText={setMotivo}
      />
      <NumberField
        key={`min-${versao}`}
        rotulo="Minutos"
        valor={minutos}
        min={1}
        onChange={setMinutos}
      />
      <MoneyField
        rotulo="Valor do acréscimo"
        valor={valor}
        onChange={setValor}
      />
      <Button
        titulo="Adicionar acréscimo"
        variante="secondary"
        desabilitado={!motivo.trim() || !valor}
        onPress={() => {
          if (!valor) return
          adicionarAcrescimo(s.id, {
            id: novoId(),
            motivo: motivo.trim(),
            ...(minutos ? { minutos } : {}),
            valorCentavos: valor,
          })
          setMotivo('')
          setMinutos(undefined)
          setValor(undefined)
          setVersao(v => v + 1)
        }}
      />
    </Card>
  )
}

const NOTAS = Array.from({ length: 11 }, (_, i) => String(i))

export function SecaoClienteFinal({ s }: Props) {
  const { atualizar, avaliarClienteFinal, limparAvaliacaoClienteFinal } =
    useAcoes()
  const hoje = useHoje()
  const a = s.avaliacaoClienteFinal
  const [nota, setNota] = useState<string | undefined>(
    a ? String(a.nota) : undefined,
  )
  const [motivos, setMotivos] = useState<MotivoClienteFinal[]>(a?.motivos ?? [])
  const [anotacao, setAnotacao] = useState(a?.anotacaoPrivada ?? '')
  if (s.situacao !== 'realizado') return null

  const sugeridos = new Set<MotivoClienteFinal>([
    ...motivosClienteSugeridosPelaEspera(s.espera),
    ...(s.improdutiva
      ? motivosClienteSugeridosPelaImprodutiva(s.improdutiva.motivo)
      : []),
  ])
  const rotuloSugestao = s.improdutiva ? 'Sugerido' : 'Sugerido pela espera'
  const avaliacao = {
    nota: nota === undefined ? Number.NaN : Number(nota),
    motivos,
    ...(anotacao.trim() ? { anotacaoPrivada: anotacao.trim() } : {}),
    avaliadaEm: hoje,
  }
  const erros = validarAvaliacaoClienteFinal(s, avaliacao)
  return (
    <Card titulo="Cliente final">
      <TextField
        rotulo="Cliente"
        value={s.cliente ?? ''}
        onChangeText={cliente => atualizar(s.id, { cliente })}
        erro={
          erros.find(e => e.campo === 'cliente') && nota !== undefined
            ? 'Informe o cliente final'
            : undefined
        }
      />
      <HistoricoCliente cliente={s.cliente} />
      <AppText variante="rotulo">Avaliação do cliente final</AppText>
      <AppText variante="caption">
        Não é a nota da empresa contratante. Só você vê.
      </AppText>
      <Chips
        opcoes={NOTAS.map(n => ({ valor: n, rotulo: n }))}
        selecionado={nota}
        onChange={setNota}
      />
      <ChipsMulti
        opcoes={MOTIVOS_CLIENTE_FINAL.map(m => ({
          valor: m,
          rotulo: sugeridos.has(m)
            ? `${ROTULOS_CLIENTE_FINAL[m]} (${rotuloSugestao})`
            : ROTULOS_CLIENTE_FINAL[m],
          destaque: sugeridos.has(m),
        }))}
        selecionados={motivos}
        onChange={setMotivos}
      />
      <TextField
        rotulo="Anotação privada"
        dica="Só você vê"
        value={anotacao}
        onChangeText={setAnotacao}
        maxLength={500}
      />
      <Button
        titulo="Salvar avaliação do cliente"
        variante="secondary"
        desabilitado={erros.length > 0}
        onPress={() => avaliarClienteFinal(s.id, avaliacao)}
      />
      {a ? (
        <Button
          titulo="Limpar avaliação"
          variante="ghost"
          pequeno
          onPress={() => {
            limparAvaliacaoClienteFinal(s.id)
            setNota(undefined)
            setMotivos([])
            setAnotacao('')
          }}
        />
      ) : null}
    </Card>
  )
}
