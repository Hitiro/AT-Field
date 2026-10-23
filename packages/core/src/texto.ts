/**
 * Normaliza texto para comparação: remove acentos, passa para minúsculas,
 * colapsa espaços e tira as pontas. Ex.: '  Cândido   MOTA ' → 'candido mota'.
 */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
