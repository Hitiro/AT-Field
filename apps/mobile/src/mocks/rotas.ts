// Rotas de exemplo saindo de Londrina (sem API de rota no protótipo: custo R$ 0).
export type RotaMock = {
  id: string
  rotulo: string
  destinoCidadeId: string
  distanciaIdaKm: number
  tempoIdaMin: number
  /** Pedágio total da viagem (ida e volta). */
  pedagioCentavos: number
}

export const ROTAS: RotaMock[] = [
  {
    id: 'maringa',
    rotulo: 'Maringá',
    destinoCidadeId: 'maringa',
    distanciaIdaKm: 100,
    tempoIdaMin: 60,
    pedagioCentavos: 2600,
  },
  {
    id: 'apucarana',
    rotulo: 'Apucarana',
    destinoCidadeId: 'apucarana',
    distanciaIdaKm: 60,
    tempoIdaMin: 45,
    pedagioCentavos: 1300,
  },
  {
    id: 'cianorte',
    rotulo: 'Cianorte',
    destinoCidadeId: 'cianorte',
    distanciaIdaKm: 180,
    tempoIdaMin: 130,
    pedagioCentavos: 5200,
  },
  {
    id: 'candido-mota',
    rotulo: 'Cândido Mota',
    destinoCidadeId: 'candido-mota',
    distanciaIdaKm: 130,
    tempoIdaMin: 100,
    pedagioCentavos: 0,
  },
  {
    id: 'londrina',
    rotulo: 'Londrina (local)',
    destinoCidadeId: 'londrina',
    distanciaIdaKm: 15,
    tempoIdaMin: 20,
    pedagioCentavos: 0,
  },
]
