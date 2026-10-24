import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';

const PG_ERRORS: Record<string, { status: HttpStatus; message: string }> = {
  '23505': { status: HttpStatus.CONFLICT, message: 'Registro duplicado' },
  '23503': {
    status: HttpStatus.CONFLICT,
    message: 'Registro em uso ou referência inexistente',
  },
  '22P02': { status: HttpStatus.BAD_REQUEST, message: 'Valor inválido' },
};

// Traduz violações de constraint do Postgres (ex.: corrida entre duas
// requisições que passaram pela checagem da aplicação) em respostas HTTP.
@Catch(QueryFailedError)
export class PgErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(PgErrorFilter.name);

  catch(error: QueryFailedError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const code = (error.driverError as { code?: string } | undefined)?.code;
    const mapped = code ? PG_ERRORS[code] : undefined;

    if (!mapped) {
      this.logger.error(error.message, error.stack);
      response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ statusCode: 500, message: 'Erro interno' });
      return;
    }

    response
      .status(mapped.status)
      .json({ statusCode: mapped.status, message: mapped.message });
  }
}
