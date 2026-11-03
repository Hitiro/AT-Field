// Normalização de nomes de cidade para busca (coluna cities."searchName").
// Própria da API e determinística; não depende do parser do @at-field/core.
// Regra, nesta ordem:
//   1. apóstrofos tipográficos (’ ‘ ʼ) viram ' (teclados de celular trocam
//      sozinhos o ' por ’);
//   2. decomposição NFD e remoção das marcas diacríticas (á -> a, ç -> c);
//   3. minúsculas;
//   4. espaços em volta removidos e sequências de espaço viram um só.
// Apóstrofo e hífen continuam como o IBGE os traz ("d'oeste", "embu-guaçu"
// -> "embu-guacu").
//
// ATENÇÃO: cities."searchName" é gravado com esta função no seed. Mudar a
// regra exige uma migration que recalcule searchName de todas as cidades
// (ex.: rodar seedIbge de novo com o retrato atual); senão a busca passa a
// comparar termos normalizados de um jeito com dados normalizados de outro.
export function normalizeName(value: string): string {
  return value
    .replace(/[‘’ʼ]/g, "'")
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
