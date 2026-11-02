import { describe, expect, it } from 'vitest';
import { HttpException } from '@nestjs/common';
import { ERROR_CODES } from '@at-field/dto';
import { AppException } from './app.exception';

describe('AppException', () => {
  it('usa status e mensagem do catálogo', () => {
    const error = new AppException('USR-003');
    expect(error).toBeInstanceOf(HttpException);
    expect(error.code).toBe('USR-003');
    expect(error.getStatus()).toBe(409);
    expect(error.message).toBe(ERROR_CODES['USR-003'].message);
    expect(error.getResponse()).toEqual({
      code: 'USR-003',
      message: ERROR_CODES['USR-003'].message,
    });
    expect(error.details).toBeUndefined();
  });

  it('guarda details e cause', () => {
    const cause = new Error('origem');
    const error = new AppException(
      'ROL-006',
      { permissions: ['foo:bar'] },
      { cause },
    );
    expect(error.getStatus()).toBe(400);
    expect(error.details).toEqual({ permissions: ['foo:bar'] });
    expect(error.cause).toBe(cause);
  });
});
