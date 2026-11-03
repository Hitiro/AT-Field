import {
  CATEGORIAS_DESPESA,
  type CategoriaDespesa,
  type CobrancaServico,
  FORMAS_COBRANCA,
  type FormaCobranca,
  type Lancamento,
  ROTULOS_CATEGORIA,
  ROTULOS_FORMA,
  detectarConflitos,
  duracaoPrevista,
  horaValida,
  novaCobranca,
  somarDias,
} from '@at-field/core'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { AvisosEmpresa } from '@/components/empresa/avisos-empresa'
import { ReputacaoResumo } from '@/components/empresa/reputacao-resumo'
import { Banner } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chips } from '@/components/ui/chips'
import { MoneyField } from '@/components/ui/money-field'
import { Screen } from '@/components/ui/screen'
import { Segmented } from '@/components/ui/segmented'
import { TextField } from '@/components/ui/text-field'
import { AppText } from '@/components/ui/text'
import {
  useAcoes,
  useAviso,
  useEmpresas,
  useHoje,
  useLancamentos,
  novoId,
} from '@/state/store'
import { agoraISO, lerInteiro, mascararHora } from '@/utils/datas'
import { textoConflito } from '@/utils/rotulos'

type Tipo = 'servico' | 'despesa'
type Situacao = 'realizado' | 'agendado'
type Quando = 'hoje' | 'ontem' | 'amanha'
type Duracao = '60' | '120' | '180' | 'outra'

export default function Lancar() {
  const router = useRouter()
  const params = useLocalSearchParams<{ tipo?: string }>()
  const hoje = useHoje()
  const empresas = useEmpresas()
  const ls = useLancamentos()
  const { adicionar } = useAcoes()
  const { setAviso } = useAviso()

  const [tipo, setTipo] = useState<Tipo>(
    params.tipo === 'despesa' ? 'despesa' : 'servico',
  )
  const [empresaId, setEmpresaId] = useState<string | undefined>()
  const [forma, setForma] = useState<FormaCobranca>('chamado')
  const [valor, setValor] = useState<number | undefined>()
  const [valorHora, setValorHora] = useState<number | undefined>()
  const [valorDiaria, setValorDiaria] = useState<number | undefined>()
  const [situacao, setSituacao] = useState<Situacao>('realizado')
  const [quando, setQuando] = useState<Quando>('hoje')
  const [hora, setHora] = useState('')
  const [duracao, setDuracao] = useState<Duracao | undefined>()
  const [duracaoOutra, setDuracaoOutra] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState<CategoriaDespesa | undefined>()

  const empresa = empresas.find(e => e.id === empresaId)
  const data = somarDias(
    hoje,
    quando === 'ontem' ? -1 : quando === 'amanha' ? 1 : 0,
  )
  const agendando = tipo === 'servico' && situacao === 'agendado'

  const erroHora =
    agendando && hora && !horaValida(hora)
      ? 'Hora inválida (use HH:MM)'
      : undefined
  const duracaoMin =
    duracao === 'outra'
      ? lerInteiro(duracaoOutra)
      : duracao
        ? Number(duracao)
        : undefined
  const erroDuracao =
    duracao === 'outra' &&
    duracaoMin !== undefined &&
    !(duracaoMin > 0 && duracaoMin <= 1440)
      ? 'Duração em minutos (1 a 1440)'
      : undefined

  function escolherEmpresa(id: string | undefined) {
    setEmpresaId(id)
    const neg = empresas.find(e => e.id === id)?.negociacao
    const nova = novaCobranca(neg)
    aplicarCobranca(nova.cobranca, nova.valorCentavos)
  }

  function aplicarCobranca(c: CobrancaServico, v: number | undefined) {
    setForma(c.forma)
    if (c.forma === 'chamado') setValor(v)
    if (c.forma === 'hora') setValorHora(c.valorHoraCentavos)
    if (c.forma === 'diaria') setValorDiaria(c.valorDiariaCentavos)
  }

  function trocarForma(f: FormaCobranca) {
    const nova = novaCobranca(empresa?.negociacao, f)
    setForma(f)
    if (f === 'chamado' && nova.valorCentavos !== undefined)
      setValor(nova.valorCentavos)
    if (f === 'hora')
      setValorHora(
        nova.cobranca.forma === 'hora'
          ? nova.cobranca.valorHoraCentavos
          : undefined,
      )
    if (f === 'diaria')
      setValorDiaria(
        nova.cobranca.forma === 'diaria'
          ? nova.cobranca.valorDiariaCentavos
          : undefined,
      )
  }

  // Aviso de conflito de agenda (não bloqueia)
  let conflito: string | undefined
  if (agendando && hora && horaValida(hora) && !erroDuracao) {
    const dur =
      duracaoMin ??
      duracaoPrevista(
        { cobranca: novaCobranca(empresa?.negociacao, forma).cobranca },
        empresa?.negociacao,
      ).minutos
    const r = detectarConflitos({ data, hora, duracaoMin: dur }, ls, empresas)
    if (r.conflitos.length) conflito = textoConflito(r.conflitos[0], empresas)
  }

  function montarCobranca(): {
    cobranca: CobrancaServico
    valorCentavos?: number
  } {
    const base = novaCobranca(empresa?.negociacao, forma).cobranca
    switch (forma) {
      case 'chamado':
        return { cobranca: base, valorCentavos: valor }
      case 'pacote':
        return {
          cobranca: { forma: 'pacote', incluiMaterial: false },
          valorCentavos: valor,
        }
      case 'hora':
        return {
          cobranca: {
            forma: 'hora',
            ...(valorHora !== undefined
              ? { valorHoraCentavos: valorHora }
              : {}),
          },
        }
      case 'diaria':
        return {
          cobranca: {
            forma: 'diaria',
            diarias: 1,
            ...(valorDiaria !== undefined
              ? { valorDiariaCentavos: valorDiaria }
              : {}),
          },
        }
    }
  }

  function lancar() {
    const comum = {
      id: novoId(),
      status: 'a_revisar' as const,
      origem: 'rapido' as const,
      criadoEm: agoraISO(),
      data,
      ...(descricao.trim() ? { descricao: descricao.trim() } : {}),
    }
    let l: Lancamento
    if (tipo === 'despesa') {
      l = {
        ...comum,
        tipo: 'despesa',
        ...(valor !== undefined ? { valorCentavos: valor } : {}),
        ...(categoria ? { categoria } : {}),
      }
    } else {
      const { cobranca, valorCentavos } = montarCobranca()
      l = {
        ...comum,
        tipo: 'servico',
        situacao,
        acrescimos: [],
        cobranca,
        resultado: 'produtivo',
        recebimento: { status: 'a_receber' },
        ...(valorCentavos !== undefined ? { valorCentavos } : {}),
        ...(empresa
          ? { empresaId: empresa.id, empresaNome: empresa.nome }
          : {}),
        ...(agendando && hora && horaValida(hora) ? { hora } : {}),
        ...(agendando && duracaoMin !== undefined && !erroDuracao
          ? { duracaoEstimadaMin: duracaoMin }
          : {}),
      }
    }
    adicionar(l)
    setAviso('Lançado. Fica em Pendências até você revisar.')
    router.dismissTo('/')
  }

  const opcoesQuando: { valor: Quando; rotulo: string }[] = agendando
    ? [
        { valor: 'hoje', rotulo: 'Hoje' },
        { valor: 'amanha', rotulo: 'Amanhã' },
      ]
    : [
        { valor: 'hoje', rotulo: 'Hoje' },
        { valor: 'ontem', rotulo: 'Ontem' },
      ]

  return (
    <Screen>
      <Segmented
        opcoes={[
          { valor: 'servico', rotulo: 'Serviço' },
          { valor: 'despesa', rotulo: 'Despesa' },
        ]}
        valor={tipo}
        onChange={t => {
          setTipo(t)
          setValor(undefined)
        }}
      />

      {tipo === 'servico' ? (
        <>
          <Card titulo="Empresa">
            <Chips
              opcoes={empresas.map(e => ({ valor: e.id, rotulo: e.nome }))}
              selecionado={empresaId}
              onChange={escolherEmpresa}
              permiteVazio
            />
            {empresa ? (
              <>
                <ReputacaoResumo empresa={empresa} />
                <AvisosEmpresa empresa={empresa} forma={forma} />
              </>
            ) : null}
          </Card>

          <Card titulo="Cobrança">
            <Segmented
              opcoes={FORMAS_COBRANCA.map(f => ({
                valor: f,
                rotulo: ROTULOS_FORMA[f],
              }))}
              valor={forma}
              onChange={trocarForma}
            />
            {forma === 'hora' ? (
              <MoneyField
                rotulo="Valor da hora"
                valor={valorHora}
                onChange={setValorHora}
              />
            ) : forma === 'diaria' ? (
              <MoneyField
                rotulo="Valor da diária"
                valor={valorDiaria}
                onChange={setValorDiaria}
              />
            ) : (
              <MoneyField
                rotulo="Valor (opcional)"
                valor={valor}
                onChange={setValor}
                dica="Sem valor agora? Complete depois em Pendências."
              />
            )}
          </Card>

          <Card titulo="Quando">
            <Segmented
              opcoes={[
                { valor: 'realizado', rotulo: 'Já fiz' },
                { valor: 'agendado', rotulo: 'Agendar' },
              ]}
              valor={situacao}
              onChange={s => {
                setSituacao(s)
                setQuando('hoje')
              }}
            />
            <Chips
              opcoes={opcoesQuando}
              selecionado={quando}
              onChange={q => setQuando(q ?? 'hoje')}
            />
            {agendando ? (
              <>
                <TextField
                  rotulo="Hora"
                  value={hora}
                  onChangeText={t => setHora(mascararHora(t))}
                  placeholder="14:00"
                  keyboardType="number-pad"
                  erro={erroHora}
                />
                <AppText variante="rotulo">Duração estimada</AppText>
                <Chips<Duracao>
                  opcoes={[
                    { valor: '60', rotulo: '1 h' },
                    { valor: '120', rotulo: '2 h' },
                    { valor: '180', rotulo: '3 h' },
                    { valor: 'outra', rotulo: 'outra' },
                  ]}
                  selecionado={duracao}
                  onChange={setDuracao}
                  permiteVazio
                />
                {duracao === 'outra' ? (
                  <TextField
                    rotulo="Duração (min)"
                    value={duracaoOutra}
                    onChangeText={setDuracaoOutra}
                    keyboardType="number-pad"
                    erro={erroDuracao}
                  />
                ) : null}
                {conflito ? <Banner tom="warning">{conflito}</Banner> : null}
              </>
            ) : null}
          </Card>
        </>
      ) : (
        <Card titulo="Despesa">
          <Chips
            opcoes={CATEGORIAS_DESPESA.map(c => ({
              valor: c,
              rotulo: ROTULOS_CATEGORIA[c],
            }))}
            selecionado={categoria}
            onChange={setCategoria}
            permiteVazio
          />
          <MoneyField rotulo="Valor" valor={valor} onChange={setValor} />
          <Chips
            opcoes={opcoesQuando}
            selecionado={quando}
            onChange={q => setQuando(q ?? 'hoje')}
          />
        </Card>
      )}

      <TextField
        rotulo="Descrição (opcional)"
        value={descricao}
        onChangeText={setDescricao}
      />

      <View>
        <Button
          titulo="Lançar"
          variante="cta"
          icone="lancar"
          onPress={lancar}
        />
      </View>
    </Screen>
  )
}
