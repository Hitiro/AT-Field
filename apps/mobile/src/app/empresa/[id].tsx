import {
  type Empresa,
  MOTIVOS_AVALIACAO,
  type MotivoAvaliacao,
  ROTULOS_FORMA,
  ROTULOS_MOTIVO,
  empresaPorTelefone,
  formatarCentavosPorKm,
  formatarMoeda,
  normalizarTelefone,
  resumirRede,
  textoAviso,
  validarAvaliacao,
} from '@at-field/core'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { mediaBR } from '@/components/empresa/reputacao-resumo'
import { Badge } from '@/components/ui/badge'
import { Banner } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chips, ChipsMulti } from '@/components/ui/chips'
import { ListItem } from '@/components/ui/list-item'
import { MoneyField } from '@/components/ui/money-field'
import { Screen } from '@/components/ui/screen'
import { StatRow } from '@/components/ui/stat-row'
import { SwitchRow } from '@/components/ui/switch-row'
import { TextField } from '@/components/ui/text-field'
import { AppText } from '@/components/ui/text'
import { CIDADES } from '@/mocks/cidades'
import { REDE_MOCK } from '@/mocks/rede'
import { useAcoes, useEmpresa, useEmpresas, useHoje } from '@/state/store'
import { formatarDuracao } from '@/utils/datas'

const NOTAS = Array.from({ length: 11 }, (_, i) => String(i))
const PERCAIS = [60, 120, 180, 240, 360, 480]

function textoPolitica(e: Empresa): string {
  const p = e.negociacao?.improdutiva
  if (!p) return 'Não informada'
  if (p.percentual === 0)
    return p.pagaDeslocamento ? 'Não paga (só deslocamento)' : 'Não paga'
  return `Paga ${p.percentual}%${p.pagaDeslocamento ? ' + deslocamento' : ''}`
}

function Negociacao({ empresa }: { empresa: Empresa }) {
  const { atualizarNegociacao } = useAcoes()
  const neg = empresa.negociacao
  if (!neg) {
    return (
      <Card titulo="Negociação">
        <AppText variante="small">Sem negociação cadastrada.</AppText>
      </Card>
    )
  }
  const chamado = neg.tarifas.chamado
  const ha = neg.horaAdicional
  const nomeCidade = (id: string) => CIDADES.find(c => c.id === id)?.nome ?? id
  return (
    <Card titulo="Negociação">
      <StatRow rotulo="Forma padrão" valor={ROTULOS_FORMA[neg.formaPadrao]} />
      {chamado ? (
        <StatRow
          rotulo="Valor por chamado"
          valor={formatarMoeda(chamado.valorCentavos)}
        />
      ) : null}
      {neg.tarifas.hora ? (
        <StatRow
          rotulo="Valor da hora"
          valor={formatarMoeda(neg.tarifas.hora.valorHoraCentavos)}
        />
      ) : null}
      {neg.tarifas.diaria ? (
        <StatRow
          rotulo="Valor da diária"
          valor={formatarMoeda(neg.tarifas.diaria.valorDiariaCentavos)}
        />
      ) : null}
      {chamado ? (
        <View style={{ gap: 8 }}>
          <StatRow
            rotulo="Percal"
            valor={
              chamado.percalMin !== undefined
                ? formatarDuracao(chamado.percalMin)
                : 'não informado'
            }
            cor={chamado.percalMin === undefined ? 'warning' : undefined}
          />
          {chamado.percalMin === undefined ? (
            <AppText variante="small" cor="warning">
              Percal: não informado
            </AppText>
          ) : null}
          <Chips
            opcoes={PERCAIS.map(p => ({
              valor: String(p),
              rotulo: formatarDuracao(p),
            }))}
            selecionado={
              chamado.percalMin !== undefined
                ? String(chamado.percalMin)
                : undefined
            }
            onChange={v =>
              atualizarNegociacao(empresa.id, {
                percalMin: v === undefined ? null : Number(v),
              })
            }
            permiteVazio
          />
        </View>
      ) : null}
      <SwitchRow
        rotulo="Paga hora adicional"
        valor={ha.paga}
        onChange={paga =>
          atualizarNegociacao(empresa.id, {
            horaAdicional: paga
              ? { paga: true, valorHoraCentavos: 0 }
              : { paga: false },
          })
        }
      />
      {ha.paga ? (
        <MoneyField
          rotulo="Valor da hora adicional"
          valor={ha.valorHoraCentavos}
          onChange={v =>
            atualizarNegociacao(empresa.id, {
              horaAdicional: { paga: true, valorHoraCentavos: v ?? 0 },
            })
          }
        />
      ) : null}
      <StatRow
        rotulo="Deslocamento"
        valor={formatarCentavosPorKm(neg.deslocamento.centavosPorKm)}
      />
      <StatRow
        rotulo="Km da ida"
        valor={
          neg.deslocamento.modoKm === 'media' ? 'média combinada' : 'exato'
        }
      />
      {Object.entries(neg.deslocamento.kmMedioPorDestino).map(([cid, km]) => (
        <StatRow key={cid} rotulo={`  ${nomeCidade(cid)}`} valor={`${km} km`} />
      ))}
      <StatRow
        rotulo="Pedágio"
        valor={neg.reembolsaPedagio ? 'reembolsa' : 'não reembolsa'}
      />
      <StatRow rotulo="Improdutiva" valor={textoPolitica(empresa)} />
    </Card>
  )
}

function MinhaAvaliacao({
  empresa,
  sugerido,
}: {
  empresa: Empresa
  sugerido?: MotivoAvaliacao
}) {
  const { avaliar } = useAcoes()
  const hoje = useHoje()
  const [nota, setNota] = useState<string | undefined>(
    empresa.avaliacao ? String(empresa.avaliacao.nota) : undefined,
  )
  const [motivos, setMotivos] = useState<MotivoAvaliacao[]>(
    empresa.avaliacao?.motivos ?? [],
  )
  const [comentario, setComentario] = useState(
    empresa.avaliacao?.comentarioPrivado ?? '',
  )
  const [salva, setSalva] = useState(false)
  const avaliacao = {
    empresaId: empresa.id,
    nota: nota === undefined ? Number.NaN : Number(nota),
    motivos,
    ...(comentario.trim() ? { comentarioPrivado: comentario.trim() } : {}),
    atualizadaEm: hoje,
  }
  const erros = validarAvaliacao(avaliacao)
  return (
    <Card titulo="Minha avaliação">
      <AppText variante="caption">Nota de 0 a 10</AppText>
      <Chips
        opcoes={NOTAS.map(n => ({ valor: n, rotulo: n }))}
        selecionado={nota}
        onChange={v => {
          setNota(v)
          setSalva(false)
        }}
      />
      <AppText variante="caption">
        Motivos (lista fechada, sem texto público)
      </AppText>
      <ChipsMulti
        opcoes={MOTIVOS_AVALIACAO.map(m => ({
          valor: m,
          rotulo:
            m === sugerido
              ? `${ROTULOS_MOTIVO[m]} (sugerido)`
              : ROTULOS_MOTIVO[m],
          destaque: m === sugerido,
        }))}
        selecionados={motivos}
        onChange={v => {
          setMotivos(v)
          setSalva(false)
        }}
      />
      <TextField
        rotulo="Comentário privado"
        dica="Só você vê. Nunca sai do aparelho."
        value={comentario}
        onChangeText={t => {
          setComentario(t)
          setSalva(false)
        }}
        maxLength={500}
      />
      <Button
        titulo={salva ? 'Avaliação salva' : 'Salvar avaliação'}
        variante="primary"
        desabilitado={erros.length > 0}
        onPress={() => {
          avaliar(empresa.id, avaliacao)
          setSalva(true)
        }}
      />
    </Card>
  )
}

function Telefones({ empresa }: { empresa: Empresa }) {
  const empresas = useEmpresas()
  const { vincularTelefone, desvincularTelefone } = useAcoes()
  const [tel, setTel] = useState('')
  const [erro, setErro] = useState<string | undefined>()
  function vincular() {
    const n = normalizarTelefone(tel)
    if (!n) return setErro('Número inválido')
    const dono = empresaPorTelefone(n, empresas)
    if (dono) {
      return setErro(
        `Número já vinculado à ${empresas.find(e => e.id === dono)?.nome}`,
      )
    }
    vincularTelefone(empresa.id, n)
    setTel('')
    setErro(undefined)
  }
  return (
    <Card titulo="Telefones vinculados">
      <Badge texto="Só você vê" />
      {empresa.telefones.map(t => (
        <View key={t} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppText variante="body" style={{ flex: 1 }}>
            {t}
          </AppText>
          <Button
            titulo="Remover"
            variante="ghost"
            icone="remover"
            pequeno
            onPress={() => desvincularTelefone(empresa.id, t)}
          />
        </View>
      ))}
      <TextField
        rotulo="Novo número"
        value={tel}
        onChangeText={setTel}
        keyboardType="phone-pad"
        placeholder="(43) 99999-0000"
        erro={erro}
      />
      <Button
        titulo="Vincular número"
        variante="secondary"
        onPress={vincular}
      />
    </Card>
  )
}

export default function EmpresaTela() {
  const { id, sugerir } = useLocalSearchParams<{
    id: string
    sugerir?: string
  }>()
  const router = useRouter()
  const empresa = useEmpresa(id)
  const { alternarNaoAtendo } = useAcoes()
  if (!empresa) {
    return (
      <Screen>
        <AppText variante="h3">Empresa não encontrada</AppText>
        <Button
          titulo="Voltar"
          variante="secondary"
          icone="voltar"
          onPress={() => router.back()}
        />
      </Screen>
    )
  }
  const rede = resumirRede(REDE_MOCK[empresa.id] ?? [])
  const sugerido = (MOTIVOS_AVALIACAO as readonly string[]).includes(
    sugerir ?? '',
  )
    ? (sugerir as MotivoAvaliacao)
    : undefined
  return (
    <Screen>
      <AppText variante="h2" accessibilityRole="header">
        {empresa.nome}
      </AppText>
      {empresa.naoAtendo ? (
        <Banner tom="danger">{textoAviso('nao_atendo', empresa.nome)}</Banner>
      ) : null}
      <Negociacao empresa={empresa} />
      <MinhaAvaliacao empresa={empresa} sugerido={sugerido} />
      <Card titulo="Não atendo">
        <SwitchRow
          rotulo="Não atendo esta empresa"
          dica="Só você vê. O app avisa ao colar ou lançar."
          valor={empresa.naoAtendo}
          onChange={() => alternarNaoAtendo(empresa.id)}
        />
      </Card>
      <Telefones empresa={empresa} />
      <Card titulo="Na rede">
        {rede.status === 'ok' ? (
          <>
            <AppText variante="valor">
              {mediaBR(rede.media)} • {rede.quantidade} avaliações
            </AppText>
            {rede.motivosMaisCitados.map(m => (
              <ListItem
                key={m.motivo}
                titulo={ROTULOS_MOTIVO[m.motivo]}
                direita={String(m.quantidade)}
              />
            ))}
          </>
        ) : (
          <AppText variante="body">
            Poucas avaliações ({rede.quantidade})
          </AppText>
        )}
        <AppText variante="caption">
          Média só a partir de 5 avaliações. Sem texto livre na rede.
        </AppText>
      </Card>
    </Screen>
  )
}
