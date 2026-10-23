/** Erro de validação de um campo de formulário (mostrado sob o campo). */
export type ErroCampo = { campo: string; mensagem: string }

/** Inteiro dentro do intervalo fechado [min, max]. */
export function inteiroEntre(n: number, min: number, max: number): boolean {
  return Number.isInteger(n) && n >= min && n <= max
}
