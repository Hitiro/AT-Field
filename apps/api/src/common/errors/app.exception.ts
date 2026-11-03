import { HttpException } from '@nestjs/common';
import { ERROR_CODES, ErrorCode } from '@at-field/dto';

// Exceção de domínio: código estável do catálogo (@at-field/dto). A mensagem
// é fixa por código; o que varia vai em `details` (nunca dado pessoal).
// Estende HttpException para interceptors e o restante do Nest a tratarem
// como erro HTTP comum.
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    readonly details?: Record<string, unknown>,
    options?: { cause?: unknown },
  ) {
    const { status, message } = ERROR_CODES[code];
    super({ code, message }, status, { cause: options?.cause });
  }
}
