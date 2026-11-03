import type { CidadeRef } from '@at-field/core'

// Base mock de cidades (na API será a tabela IBGE). Toledo é homônimo PR/MG.
export const CIDADES: CidadeRef[] = [
  { id: 'londrina', nome: 'Londrina', uf: 'PR' },
  { id: 'maringa', nome: 'Maringá', uf: 'PR' },
  { id: 'cianorte', nome: 'Cianorte', uf: 'PR' },
  { id: 'apucarana', nome: 'Apucarana', uf: 'PR' },
  { id: 'candido-mota', nome: 'Cândido Mota', uf: 'SP' },
  { id: 'assis', nome: 'Assis', uf: 'SP' },
  { id: 'ourinhos', nome: 'Ourinhos', uf: 'SP' },
  { id: 'toledo-pr', nome: 'Toledo', uf: 'PR' },
  { id: 'toledo-mg', nome: 'Toledo', uf: 'MG' },
]
