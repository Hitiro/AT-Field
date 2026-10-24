import { z } from 'zod'

// Sigla de UF: só o formato. A existência é conferida no banco (base IBGE).
export const ufSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'UF inválida')

// Busca de cidades por nome (ignora acento e caixa no servidor).
export const citySearchSchema = z.object({
  q: z.string().trim().min(2).max(60),
  uf: ufSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type CitySearch = z.output<typeof citySearchSchema>

export type StateView = { id: number; uf: string; name: string }

export type CityView = { id: number; name: string; uf: string }

// Base completa em formato compacto, para o app baixar uma vez e guardar
// offline. `version` é o retrato do IBGE (ex.: '2026-10').
export type CitiesBundleView = {
  version: string
  states: [id: number, uf: string, name: string][]
  cities: [id: number, stateId: number, name: string][]
}
