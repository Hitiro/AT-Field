import { describe, expect, it } from 'vitest';
import { signupSchema } from '@at-field/dto';
import { z } from 'zod';
import {
  MAX_VALIDATION_ISSUES,
  toValidationDetails,
} from './validation-details';

describe('toValidationDetails', () => {
  it('junta o caminho aninhado com ponto e não inclui o valor enviado', () => {
    const result = signupSchema.safeParse({
      tenant: { documentType: 'CPF', document: '529.982.247-25', name: 'Ana' },
      owner: { cpf: '11111111111', name: 'Ana', email: 'ana@teste.com' },
    });
    expect(result.success).toBe(false);
    const details = toValidationDetails(result.error!);
    expect(details.issues).toContainEqual({
      path: 'owner.cpf',
      code: 'custom',
      message: 'CPF inválido',
    });
    expect(JSON.stringify(details)).not.toContain('11111111111');
    for (const issue of details.issues) {
      expect(Object.keys(issue).sort()).toEqual(['code', 'message', 'path']);
    }
  });

  it('usa índice no caminho e string vazia na raiz', () => {
    const error = z
      .object({ permissions: z.array(z.string()) })
      .safeParse({ permissions: [1] }).error!;
    expect(toValidationDetails(error).issues[0].path).toBe('permissions.0');

    const root = z.string().safeParse(1).error!;
    expect(toValidationDetails(root).issues[0].path).toBe('');
  });

  it(`limita a ${MAX_VALIDATION_ISSUES} problemas`, () => {
    const error = z
      .array(z.string())
      .safeParse(Array.from({ length: 80 }, (_, i) => i)).error!;
    expect(error.issues.length).toBe(80);
    expect(toValidationDetails(error).issues).toHaveLength(
      MAX_VALIDATION_ISSUES,
    );
  });
});
