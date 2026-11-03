import type { ZodError } from 'zod';

export const MAX_VALIDATION_ISSUES = 50;

export type ValidationIssue = { path: string; code: string; message: string };

export type ZodIssues = Pick<ZodError, 'issues'>;

// Detalhes de VAL-001: só caminho, código e mensagem de cada problema. Nunca
// o `input` do Zod, que traz o valor enviado (CPF, e-mail).
export function toValidationDetails(error: ZodIssues): {
  issues: ValidationIssue[];
} {
  return {
    issues: error.issues.slice(0, MAX_VALIDATION_ISSUES).map((issue) => ({
      path: issue.path.map(String).join('.'),
      code: issue.code,
      message: issue.message,
    })),
  };
}
