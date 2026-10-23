import {
  CATEGORIAS_DESPESA,
  type Lancamento,
  type LancamentoServico,
  ROTULOS_CATEGORIA,
  detectarConflitos,
  duracaoPrevista,
  horaValida,
  pendenciasDe,
  podeConfirmar,
} from '@at-field/core'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { AvisosEmpresa } from '@/components/empresa/avisos-empresa'
import {
  CardPrejuizo,
  SecaoAcrescimos,
  SecaoClienteFinal,
  SecaoCobranca,
  SecaoDeslocamento,
  SecaoResultado,
  SecaoTempo,
} from '@/components/lancamento/secoes'
import { Badge } from '@/components/ui/badge'
import { Banner } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chips } from '@/components/ui/chips'
import { MoneyField } from '@/components/ui/money-field'
import { Screen } from '@/components/ui/screen'
import { SwitchRow } from '@/components/ui/switch-row'
import { TextField } from '@/components/ui/text-field'
import { AppText } from '@/components/ui/text'
import {
  useAcoes,
  useEmpresas,
  useHoje,
  useLancamento,
  useLancamentos,
} from '@/state/store'
import { mascararHora } from '@/utils/datas'
import { ROTULOS_PENDENCIA, textoConflito } from '@/utils/rotulos'

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

function CampoData({ l }: { l: Lancamento }) {
  const { atualizar } = useAcoes()
  const [texto, setTexto] = useState(l.data ?? '')
  const valida = DATA_ISO.test(texto) && !Number.isNaN(Date.parse(texto))
  return (
    <TextField
      rotulo="Data"
      value={texto}
      placeholder="AAAA-MM-DD"
      onChangeText={t => {
        setTexto(t)
        if (!t.trim()) atualizar(l.id, { data: undefined })
        else if (DATA_ISO.test(t) && !Number.isNaN(Date.parse(t)))
          atualizar(l.id, { data: t })
      }}
      erro={texto && !valida ? 'Data inválida (AAAA-MM-DD)' : undefined}
    />
  )
}

function CampoHora({ s }: { s: LancamentoServico }) {
  const { atualizar } = useAcoes()
  const [texto, setTexto] = useState(s.hora ?? '')
  return (
    <TextField
      rotulo="Hora"
      value={texto}
      placeholder="14:00"
      keyboardType="number-pad"
      onChangeText={t => {
        const h = mascararHora(t)
        setTexto(h)
        if (!h) atualizar(s.id, { hora: undefined })
        else if (horaValida(h)) atualizar(s.id, { hora: h })
      }}
      erro={texto && !horaValida(texto) ? 'Hora inválida (HH:MM)' : undefined}
    />
  )
}

function Servico({ s }: { s: LancamentoServico }) {
  const empresas = useEmpresas()
  const ls = useLancamentos()
  const hoje = useHoje()
  const { atualizar, marcarRealizado, marcarRecebido, marcarAReceber } =
    useAcoes()
  const empresa = empresas.find(e => e.id === s.empresaId)

  let conflito: string | undefined
  if (s.situacao === 'agendado' && s.data && s.hora) {
    const r = detectarConflitos(
      {
        data: s.data,
        hora: s.hora,
        duracaoMin: duracaoPrevista(s, empresa?.negociacao).minutos,
        excluirId: s.id,
      },
      ls,
      empresas,
    )
    if (r.conflitos.length) conflito = textoConflito(r.conflitos[0], empresas)
  }

  return (
    <>
      <Card titulo="Empresa">
        <Chips
          opcoes={empresas.map(e => ({ valor: e.id, rotulo: e.nome }))}
          selecionado={s.empresaId}
          onChange={id => {
            const e = empresas.find(x => x.id === id)
            atualizar(s.id, { empresaId: e?.id, empresaNome: e?.nome })
          }}
          permiteVazio
        />
        {!empresa && s.empresaNome ? (
          <AppText variante="small">{s.empresaNome} (não cadastrada)</AppText>
        ) : null}
        <AvisosEmpresa
          empresa={empresa}
          nome={s.empresaNome}
          forma={s.cobranca.forma}
        />
      </Card>

      <SecaoCobranca s={s} empresa={empresa} />

      <Card titulo="Atendimento">
        <CampoData l={s} />
        <CampoHora s={s} />
        {s.cidade ? (
          <AppText variante="small" cor="textSecondary">
            {[
              s.local,
              `${s.cidade.nome}${s.cidade.uf ? `/${s.cidade.uf}` : ''}`,
            ]
              .filter(Boolean)
              .join(' • ')}
            {s.codigoChamado ? ` • chamado ${s.codigoChamado}` : ''}
          </AppText>
        ) : null}
        {s.ferramentas?.length ? (
          <AppText variante="small" cor="textSecondary">
            Ferramentas: {s.ferramentas.join('; ')}
          </AppText>
        ) : null}
        {s.descricao ? <AppText variante="small">{s.descricao}</AppText> : null}
        {conflito ? <Banner tom="warning">{conflito}</Banner> : null}
        {s.situacao === 'agendado' ? (
          <>
            <Badge texto="agendado" tom="info" />
            <Button
              titulo="Marcar como realizado"
              variante="primary"
              icone="check"
              onPress={() => marcarRealizado(s.id, s.duracaoRealMin)}
            />
          </>
        ) : null}
      </Card>

      {s.situacao === 'realizado' ? (
        <SecaoResultado s={s} empresa={empresa} />
      ) : null}
      <SecaoDeslocamento s={s} />
      <CardPrejuizo s={s} />
      <SecaoTempo s={s} empresa={empresa} />
      <SecaoAcrescimos s={s} empresa={empresa} />
      <SecaoClienteFinal s={s} />

      {s.situacao === 'realizado' ? (
        <Card titulo="Recebimento">
          <SwitchRow
            rotulo="Recebido"
            valor={s.recebimento.status === 'recebido'}
            dica={
              s.recebimento.status === 'recebido'
                ? `Recebido em ${s.recebimento.recebidoEm}`
                : 'A receber'
            }
            onChange={v =>
              v ? marcarRecebido(s.id, hoje) : marcarAReceber(s.id)
            }
          />
        </Card>
      ) : null}
    </>
  )
}

export default function LancamentoTela() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const l = useLancamento(id)
  const { atualizar, confirmar, remover } = useAcoes()

  if (!l) {
    return (
      <Screen>
        <AppText variante="h3">Lançamento não encontrado</AppText>
        <Button
          titulo="Voltar"
          variante="secondary"
          icone="voltar"
          onPress={() => router.back()}
        />
      </Screen>
    )
  }

  const falta = pendenciasDe(l)
  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <AppText variante="h3" style={{ flex: 1 }}>
          {l.tipo === 'servico' ? 'Serviço' : 'Despesa'}
        </AppText>
        <Badge
          texto={l.status === 'a_revisar' ? 'a revisar' : 'confirmado'}
          tom={l.status === 'a_revisar' ? 'warning' : 'success'}
        />
      </View>

      {l.tipo === 'despesa' ? (
        <Card titulo="Despesa">
          <Chips
            opcoes={CATEGORIAS_DESPESA.map(c => ({
              valor: c,
              rotulo: ROTULOS_CATEGORIA[c],
            }))}
            selecionado={l.categoria}
            onChange={categoria => atualizar(l.id, { categoria })}
          />
          <MoneyField
            rotulo="Valor"
            valor={l.valorCentavos}
            onChange={v => atualizar(l.id, { valorCentavos: v })}
          />
          <CampoData l={l} />
          <TextField
            rotulo="Descrição"
            value={l.descricao ?? ''}
            onChangeText={descricao => atualizar(l.id, { descricao })}
          />
        </Card>
      ) : (
        <Servico s={l} />
      )}

      {l.status === 'a_revisar' ? (
        <Card>
          {falta.length ? (
            <AppText variante="small" cor="warning" testID="falta">
              Falta: {falta.map(p => ROTULOS_PENDENCIA[p]).join(', ')}
            </AppText>
          ) : null}
          <Button
            titulo="Confirmar"
            variante="primary"
            icone="check"
            desabilitado={!podeConfirmar(l)}
            onPress={() => confirmar(l.id)}
          />
        </Card>
      ) : null}
      <Button
        titulo="Excluir lançamento"
        variante="ghost"
        icone="remover"
        onPress={() => {
          remover(l.id)
          router.back()
        }}
      />
    </Screen>
  )
}
