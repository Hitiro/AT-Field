import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, isErrorCode } from '@at-field/dto';

// Varre o código de produção da API (sem os specs) para garantir que o
// catálogo e os throws andam juntos: buscar um código leva a um único throw.
const SRC = join(__dirname, '..', '..');

const sources = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
  .map((file) => ({
    file: relative(SRC, join(SRC, file)),
    text: readFileSync(join(SRC, file), 'utf8'),
  }));

// Toda exceção instanciada em src passa pelo AppException (código do
// catálogo). Se surgir um uso legítimo de outra, liste-a aqui explicitamente.
const FORBIDDEN_EXCEPTION = /new (?!AppException\b)\w*Exception\(/g;

const DOMAIN_CODES = Object.keys(ERROR_CODES).filter(
  (code) => !/^(GEN|VAL|DB)-/.test(code),
);

describe('uso dos códigos de erro em src', () => {
  it('encontra os arquivos de produção', () => {
    expect(sources.some((s) => s.file.endsWith('app.module.ts'))).toBe(true);
    expect(sources.some((s) => s.file.endsWith('.spec.ts'))).toBe(false);
  });

  it('todo literal de código existe no catálogo', () => {
    const unknown: string[] = [];
    for (const { file, text } of sources) {
      for (const [, code] of text.matchAll(/['"`]([A-Z]{2,3}-\d{3})['"`]/g)) {
        if (!isErrorCode(code)) unknown.push(`${file}: ${code}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it('cada código de domínio é lançado em exatamente um new AppException', () => {
    const counts = new Map<string, string[]>();
    for (const { file, text } of sources) {
      for (const [, code] of text.matchAll(
        /new AppException\(\s*'([A-Z]{2,3}-\d{3})'/g,
      )) {
        counts.set(code, [...(counts.get(code) ?? []), file]);
      }
    }
    for (const code of DOMAIN_CODES) {
      expect(counts.get(code) ?? [], code).toHaveLength(1);
    }
  });

  it('não lança exceções diretamente (use AppException)', () => {
    const offenders = sources.flatMap(({ file, text }) =>
      [...text.matchAll(FORBIDDEN_EXCEPTION)].map(
        ([match]) => `${file}: ${match}`,
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('a regra pega qualquer *Exception do Nest e libera AppException', () => {
    const matches = (text: string) => [...text.matchAll(FORBIDDEN_EXCEPTION)];
    for (const text of [
      'throw new HttpException("x", 418)',
      'throw new PayloadTooLargeException()',
      'throw new UnprocessableEntityException()',
      'throw new BadRequestException("x")',
      'throw new ZodValidationException(error)',
    ]) {
      expect(matches(text), text).toHaveLength(1);
    }
    expect(matches("throw new AppException('USR-001')")).toHaveLength(0);
  });
});
