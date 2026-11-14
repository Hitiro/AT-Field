import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNREGISTERED = 'auth:allowUnregistered';

// Exige token válido (e e-mail verificado), mas aceita quem ainda não existe
// no banco (ex.: POST /tenants, auto-cadastro). Sem ele, pessoa não
// cadastrada recebe AUT-005.
export const AllowUnregistered = () => SetMetadata(ALLOW_UNREGISTERED, true);
