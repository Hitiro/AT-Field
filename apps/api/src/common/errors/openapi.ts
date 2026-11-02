import { ERROR_CODES, errorResponseSchema } from '@at-field/dto';
import type { OpenAPIObject, SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';

const METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;

const ERROR_SCHEMA_REF = '#/components/schemas/ErrorResponse';

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: ERROR_SCHEMA_REF } } },
});

// Documenta o formato único de erro: schema ErrorResponse e respostas 4XX/5XX
// em toda operação que ainda não as declara.
export function addErrorResponses(document: OpenAPIObject): OpenAPIObject {
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas.ErrorResponse = z.toJSONSchema(
    errorResponseSchema,
    { target: 'openapi-3.0' },
  ) as SchemaObject;

  for (const item of Object.values(document.paths ?? {})) {
    for (const method of METHODS) {
      const operation = item[method];
      if (!operation) continue;
      operation.responses ??= {};
      operation.responses['4XX'] ??= errorResponse(
        'Erro do cliente (código do catálogo em `code`)',
      );
      operation.responses['5XX'] ??= errorResponse(
        'Erro interno (GEN-500); informe o requestId ao suporte',
      );
    }
  }
  return document;
}

// Tabela do catálogo para a descrição da documentação (Scalar).
export function errorCatalogMarkdown(): string {
  const rows = Object.entries(ERROR_CODES).map(
    ([code, { status, message }]) => `| ${code} | ${status} | ${message} |`,
  );
  return ['| Código | HTTP | Mensagem |', '| --- | --- | --- |', ...rows].join(
    '\n',
  );
}
