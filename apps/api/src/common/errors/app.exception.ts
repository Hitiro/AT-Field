import { HttpException } from '@nestjs/common';
import { ERROR_CODES, ErrorCode } from '@at-field/dto';

export type AppExceptionOptions = {
  cause?: unknown;
  // Texto fixo e curto (ex.: código do provedor 'auth/id-token-expired') só
  // para a linha de acesso (`reason`). Nunca vai para a resposta e nunca
  // leva dado pessoal nem valor enviado.
  logReason?: string;
};

// Exceção de domínio: código estável do catálogo (@at-field/dto). A mensagem
// é fixa por código; o que varia vai em `details` (nunca dado pessoal).
// Estende HttpException para interceptors e o restante do Nest a tratarem
// como erro HTTP comum.
export class AppException extends HttpException {
  readonly logReason?: string;

  constructor(
    readonly code: ErrorCode,
    readonly details?: Record<string, unknown>,
    options?: AppExceptionOptions,
  ) {
    const { status, message } = ERROR_CODES[code];
    super({ code, message }, status, { cause: options?.cause });
    this.logReason = options?.logReason;
  }
}
