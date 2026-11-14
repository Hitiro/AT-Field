import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export const IS_PUBLIC = 'auth:isPublic';

// Rota sem login (o AuthGuard libera). No OpenAPI vira `security: []`
// (applySecurity remove a extensão `x-public`). Usar só em dado de
// referência sem informação de conta (ex.: base IBGE).
export const Public = () =>
  applyDecorators(SetMetadata(IS_PUBLIC, true), ApiExtension('x-public', true));
