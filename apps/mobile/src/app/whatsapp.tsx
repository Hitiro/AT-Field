import {
  type CidadeRef,
  type DemandaExtraida,
  detectarConflitos,
  duracaoPrevista,
  empresaPorTelefone,
  novaCobranca,
  parseDemandaWhatsApp,
  rascunhoDeDemanda,
} from '@at-field/core'
import { useRouter } from 'expo-router'
import { type ReactNode, useMemo, useState } from 'react'
import { View } from 'react-native'

import { AvisosEmpresa } from '@/components/empresa/avisos-empresa'
import { ReputacaoResumo } from '@/components/empresa/reputacao-resumo'
import { HistoricoCliente } from '@/components/historico-cliente'
import { Badge } from '@/components/ui/badge'
import { Banner } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chips } from '@/components/ui/chips'
import { Screen } from '@/components/ui/screen'
import { TextField } from '@/components/ui/text-field'
import { AppText } from '@/components/ui/text'
import { useTheme } from '@/hooks/use-theme'
import { CIDADES } from '@/mocks/cidades'
import { EXEMPLOS_WHATSAPP } from '@/mocks/exemplos-whatsapp'
import {
  novoId,
  useAcoes,
  useEmpresas,
  useHoje,
  useLancamentos,
} from '@/state/store'
import { agoraISO, diaMes } from '@/utils/datas'
import { textoConflito } from '@/utils/rotulos'

const ORIGEM: Record<
  NonNullable<DemandaExtraida['empresa']>['origem'],
  string
> = {
  texto: 'pelo texto',
  telefone: 'pelo telefone vinculado',
  remetente: 'pelo remetente',
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const { espaco } = useTheme()
  return (
    <View style={{ gap: espaco[1] }}>
      <AppText variante="rotulo">{rotulo}</AppText>
      {children}
    </View>
  )
}

function Valor({ texto }: { texto: string | undefined }) {
  return texto ? (
    <AppText variante="body">{texto}</AppText>
  ) : (
    <AppText variante="small" cor="textMuted">
      não encontrado
    </AppText>
  )
}

const simNao = (v: boolean | undefined) =>
  v === undefined ? undefined : v ? 'Sim' : 'Não'

export default function Whatsapp() {
  const router = useRouter()
  const hoje = useHoje()
  const empresas = useEmpresas()
  const ls = useLancamentos()
  const { adicionar, vincularTelefone } = useAcoes()

  const [texto, setTexto] = useState('')
  const [lido, setLido] = useState<string | undefined>()
  const [cliente, setCliente] = useState<string | undefined>()
  const [local, setLocal] = useState<string | undefined>()
  const [motivo, setMotivo] = useState<string | undefined>()
  const [cidadeEscolhida, setCidadeEscolhida] = useState<
    CidadeRef | undefined
  >()
  const [erroVinculo, setErroVinculo] = useState<string | undefined>()

  // Relê sempre que as empresas mudam (ex.: depois de vincular o número)
  const d = useMemo(
    () =>
      lido === undefined
        ? undefined
        : parseDemandaWhatsApp(lido, { cidades: CIDADES, empresas, hoje }),
    [lido, empresas, hoje],
  )

  function ler(t = texto) {
    setLido(t)
    setCliente(undefined)
    setLocal(undefined)
    setMotivo(undefined)
    setCidadeEscolhida(undefined)
    setErroVinculo(undefined)
  }

  const empresa = d?.empresa?.id
    ? empresas.find(e => e.id === d.empresa!.id)
    : undefined
  const clienteFinal = cliente ?? d?.cliente
  const cidade = cidadeEscolhida ?? d?.cidade

  let conflito: string | undefined
  if (d?.data?.hora) {
    const dur = duracaoPrevista(
      { cobranca: novaCobranca(empresa?.negociacao).cobranca },
      empresa?.negociacao,
    ).minutos
    const r = detectarConflitos(
      { data: d.data.valor, hora: d.data.hora, duracaoMin: dur },
      ls,
      empresas,
    )
    if (r.conflitos.length) conflito = textoConflito(r.conflitos[0], empresas)
  }

  const nadaReconhecido =
    d !== undefined &&
    !d.empresa &&
    !d.cliente &&
    !d.cidade &&
    !d.cidadeCandidatas &&
    !d.motivo &&
    !d.data &&
    d.ferramentas.length === 0 &&
    d.deslocamentoPago === undefined &&
    d.pedagioPago === undefined &&
    !d.pedeIndicacao

  function vincular(empresaId: string | undefined) {
    if (!empresaId || !d?.remetenteTelefone) return
    const dono = empresaPorTelefone(d.remetenteTelefone, empresas)
    if (dono && dono !== empresaId) {
      setErroVinculo(
        `Número já vinculado à ${empresas.find(e => e.id === dono)?.nome}`,
      )
      return
    }
    setErroVinculo(undefined)
    vincularTelefone(empresaId, d.remetenteTelefone)
  }

  function criar() {
    if (!d) return
    const demanda: DemandaExtraida = {
      ...d,
      ...(cliente !== undefined ? { cliente } : {}),
      ...(local !== undefined ? { local } : {}),
      ...(motivo !== undefined ? { motivo } : {}),
      ...(cidade ? { cidade } : {}),
    }
    adicionar(
      rascunhoDeDemanda(
        demanda,
        { id: novoId(), agora: agoraISO() },
        empresa?.negociacao,
      ),
    )
    router.push('/pendencias')
  }

  return (
    <Screen>
      <AppText variante="small" cor="textSecondary">
        Copie a mensagem no WhatsApp (toque longo) e cole aqui. Nada sai do
        aparelho.
      </AppText>
      <TextField
        rotulo="Mensagem"
        value={texto}
        onChangeText={setTexto}
        multiline
        placeholder="Cole a mensagem aqui"
      />
      <AppText variante="caption">Para a demonstração:</AppText>
      <Chips
        opcoes={EXEMPLOS_WHATSAPP.map((_, i) => ({
          valor: String(i),
          rotulo: `Exemplo ${i + 1}`,
        }))}
        selecionado={undefined}
        onChange={v => {
          if (v === undefined) return
          const t = EXEMPLOS_WHATSAPP[Number(v)]
          setTexto(t)
          ler(t)
        }}
      />
      <Button titulo="Ler mensagem" variante="primary" onPress={() => ler()} />

      {d ? (
        <Card titulo="O que encontrei">
          {nadaReconhecido ? (
            <Banner tom="info">Nada reconhecido</Banner>
          ) : null}

          <Campo rotulo="Empresa">
            {d.empresa ? (
              <>
                <AppText variante="body">
                  {d.empresa.nome}{' '}
                  <AppText variante="caption">
                    ({ORIGEM[d.empresa.origem]})
                  </AppText>
                </AppText>
                {empresa ? <ReputacaoResumo empresa={empresa} /> : null}
              </>
            ) : (
              <Valor texto={undefined} />
            )}
            <AvisosEmpresa empresa={empresa} nome={d.empresa?.nome} />
            {d.remetenteTelefone && d.empresa?.origem !== 'telefone' ? (
              <View style={{ gap: 8 }}>
                <View
                  style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}
                >
                  <AppText variante="small">Vincular este número a…</AppText>
                  <Badge texto="Só você vê" />
                </View>
                <Chips
                  opcoes={empresas.map(e => ({ valor: e.id, rotulo: e.nome }))}
                  selecionado={undefined}
                  onChange={vincular}
                />
                {erroVinculo ? (
                  <AppText variante="small" cor="danger">
                    {erroVinculo}
                  </AppText>
                ) : null}
              </View>
            ) : null}
          </Campo>

          <TextField
            rotulo="Cliente final"
            value={clienteFinal ?? ''}
            onChangeText={setCliente}
            placeholder="não encontrado"
          />
          <HistoricoCliente cliente={clienteFinal} />
          <Campo rotulo="Código do chamado">
            <Valor texto={d.codigoChamado} />
          </Campo>
          <TextField
            rotulo="Local"
            value={local ?? d.local ?? ''}
            onChangeText={setLocal}
            placeholder="não encontrado"
          />

          <Campo rotulo="Cidade">
            {cidade ? (
              <AppText variante="body">
                {cidade.nome}/{cidade.uf}
              </AppText>
            ) : d.cidadeCandidatas ? (
              <>
                <AppText variante="small" cor="warning">
                  Mais de uma cidade com esse nome. Qual é?
                </AppText>
                <Chips
                  opcoes={d.cidadeCandidatas.map(c => ({
                    valor: c.id,
                    rotulo: `${c.nome}/${c.uf}`,
                  }))}
                  selecionado={undefined}
                  onChange={id =>
                    setCidadeEscolhida(
                      d.cidadeCandidatas?.find(c => c.id === id),
                    )
                  }
                />
              </>
            ) : (
              <AppText variante="small" cor="warning">
                cidade não reconhecida
              </AppText>
            )}
          </Campo>

          <TextField
            rotulo="Motivo"
            value={motivo ?? d.motivo ?? ''}
            onChangeText={setMotivo}
            placeholder="não encontrado"
          />
          <Campo rotulo="Ferramentas">
            <Valor
              texto={
                d.ferramentas.length ? d.ferramentas.join('; ') : undefined
              }
            />
          </Campo>
          <Campo rotulo="Data e hora">
            <Valor
              texto={
                d.data
                  ? `${diaMes(d.data.valor)}${d.data.hora ? ` às ${d.data.hora}` : ''}${
                      d.data.precisaConfirmar ? ' (confirme)' : ''
                    }`
                  : undefined
              }
            />
          </Campo>
          {conflito ? <Banner tom="warning">{conflito}</Banner> : null}
          <Campo rotulo="Deslocamento pago">
            <Valor texto={simNao(d.deslocamentoPago)} />
          </Campo>
          <Campo rotulo="Pedágio pago">
            <Valor texto={simNao(d.pedagioPago)} />
          </Campo>
          {d.pedeIndicacao ? (
            <Badge texto="Pede indicação de técnico" tom="info" />
          ) : null}
          {d.observacoes.map(o => (
            <AppText key={o} variante="small" cor="textSecondary">
              Obs.: {o}
            </AppText>
          ))}
          <AppText variante="caption">
            Valor nunca é preenchido pela mensagem.
          </AppText>
          <Button
            titulo="Criar lançamento a revisar"
            variante="cta"
            onPress={criar}
          />
        </Card>
      ) : null}
    </Screen>
  )
}
