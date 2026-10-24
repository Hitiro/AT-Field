import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import {
  GEO_ERROR_CACHE,
  GEO_PUBLIC_CACHE,
  GeoCacheInterceptor,
} from './geo-cache.interceptor';

function setup(headersSent = false) {
  const headers: Record<string, string> = {};
  const res = {
    headersSent,
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
  };
  const context = {
    switchToHttp: () => ({ getResponse: () => res }),
  } as unknown as ExecutionContext;
  return { headers, res, context, interceptor: new GeoCacheInterceptor() };
}

const handler = (result: ReturnType<CallHandler['handle']>): CallHandler => ({
  handle: () => result,
});

describe('GeoCacheInterceptor', () => {
  it('sucesso recebe cache público', async () => {
    const { headers, context, interceptor } = setup();
    await lastValueFrom(interceptor.intercept(context, handler(of([1]))));
    expect(headers['Cache-Control']).toBe(GEO_PUBLIC_CACHE);
  });

  it('erro mantém no-store', async () => {
    const { headers, context, interceptor } = setup();
    const result = interceptor.intercept(
      context,
      handler(throwError(() => new NotFoundException())),
    );
    await expect(lastValueFrom(result)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(headers['Cache-Control']).toBe(GEO_ERROR_CACHE);
  });

  it('não mexe em resposta já enviada (rotas com @Res)', async () => {
    const { headers, res, context, interceptor } = setup();
    const result = interceptor.intercept(context, handler(of(undefined)));
    // O handler com @Res() envia a resposta antes de o observable emitir.
    res.headersSent = true;
    headers['Cache-Control'] = 'definido pela rota';
    await lastValueFrom(result);
    expect(headers['Cache-Control']).toBe('definido pela rota');
  });
});
