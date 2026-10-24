import { formatarCentavosPorKm } from '@at-field/core'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MoneyField } from '@/components/ui/money-field'
import { Screen } from '@/components/ui/screen'
import { StatRow } from '@/components/ui/stat-row'
import { TextField } from '@/components/ui/text-field'
import { AppText } from '@/components/ui/text'
import { custoDoVeiculo } from '@/mocks/veiculo'
import { useAcoes, useVeiculo } from '@/state/store'
import { lerNumero } from '@/utils/datas'

export default function VeiculoTela() {
  const { veiculo } = useVeiculo()
  const { atualizarVeiculo } = useAcoes()
  const [preco, setPreco] = useState<number | undefined>(
    veiculo.precoLitroCentavos,
  )
  const [consumo, setConsumo] = useState(
    String(veiculo.consumoKmPorLitro).replace('.', ','),
  )
  const [manutencao, setManutencao] = useState<number | undefined>(
    veiculo.manutencaoCentavosPorKm,
  )
  const [salvo, setSalvo] = useState(false)

  const consumoNum = lerNumero(consumo)
  const erroConsumo =
    consumoNum === undefined || Number.isNaN(consumoNum) || consumoNum <= 0
      ? 'Informe o consumo (maior que zero)'
      : undefined
  const erroPreco = preco === undefined ? 'Informe o preço do litro' : undefined
  const valido = !erroConsumo && !erroPreco
  const custo = valido
    ? custoDoVeiculo({
        precoLitroCentavos: preco!,
        consumoKmPorLitro: consumoNum!,
        manutencaoCentavosPorKm: manutencao ?? 0,
      })
    : undefined

  return (
    <Screen>
      <AppText variante="small" cor="textSecondary">
        O carro não custa só combustível: some a manutenção por km (TEC-47).
      </AppText>
      <Card>
        <MoneyField
          rotulo="Preço do litro"
          valor={preco}
          onChange={v => {
            setPreco(v)
            setSalvo(false)
          }}
          erro={erroPreco}
        />
        <TextField
          rotulo="Consumo (km/l)"
          value={consumo}
          onChangeText={t => {
            setConsumo(t)
            setSalvo(false)
          }}
          keyboardType="decimal-pad"
          erro={erroConsumo}
        />
        <MoneyField
          rotulo="Manutenção por km"
          valor={manutencao}
          onChange={v => {
            setManutencao(v)
            setSalvo(false)
          }}
          dica="Óleo, pneu, desgaste. Ex.: R$ 0,30/km"
        />
      </Card>
      {custo ? (
        <Card titulo="Custo por km">
          <Badge texto="Estimativa" tom="info" />
          <StatRow
            rotulo="Combustível"
            valor={formatarCentavosPorKm(custo.combustivelPorKm)}
          />
          <StatRow
            rotulo="Manutenção"
            valor={formatarCentavosPorKm(custo.manutencaoPorKm)}
          />
          <StatRow
            rotulo="Total"
            valor={formatarCentavosPorKm(custo.totalPorKm)}
            destaque
          />
        </Card>
      ) : null}
      <Button
        titulo={salvo ? 'Salvo' : 'Salvar'}
        variante="primary"
        icone="check"
        desabilitado={!valido}
        onPress={() => {
          if (!valido) return
          atualizarVeiculo({
            precoLitroCentavos: preco!,
            consumoKmPorLitro: consumoNum!,
            manutencaoCentavosPorKm: manutencao ?? 0,
          })
          setSalvo(true)
        }}
      />
    </Screen>
  )
}
