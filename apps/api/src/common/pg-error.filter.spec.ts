import { describe, expect, it, vi } from 'vitest';
import { ArgumentsHost, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { PgErrorFilter } from './pg-error.filter';

const hostWith = () => {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

const pgError = (code?: string) =>
  new QueryFailedError(
    'SELECT 1',
    [],
    Object.assign(new Error('pg'), { code }),
  );

describe('PgErrorFilter', () => {
  const filter = new PgErrorFilter();

  it.each([
    ['23505', 409],
    ['23503', 409],
    ['22P02', 400],
  ])('traduz código %s para HTTP %i', (code, expected) => {
    const { host, status, json } = hostWith();
    filter.catch(pgError(code), host);
    expect(status).toHaveBeenCalledWith(expected);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: expected }),
    );
  });

  it('responde 500 e registra erros desconhecidos', () => {
    const log = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { host, status } = hostWith();
    filter.catch(pgError('XX000'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
