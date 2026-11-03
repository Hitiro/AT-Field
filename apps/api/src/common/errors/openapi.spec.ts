import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@at-field/dto';
import type { OpenAPIObject } from '@nestjs/swagger';
import { addErrorResponses, errorCatalogMarkdown } from './openapi';

const documentWith = (): OpenAPIObject => ({
  openapi: '3.0.0',
  info: { title: 'teste', version: '1' },
  paths: {
    '/users': {
      get: { responses: { '200': { description: 'ok' } } },
      post: {
        responses: {
          '201': { description: 'criado' },
          '4XX': { description: 'já documentado' },
        },
      },
    },
    '/states': { get: { responses: {} } },
  },
});

describe('addErrorResponses', () => {
  it('adiciona o schema ErrorResponse', () => {
    const document = addErrorResponses(documentWith());
    expect(document.components?.schemas?.ErrorResponse).toMatchObject({
      type: 'object',
      required: ['code', 'message', 'requestId'],
    });
  });

  it('adiciona 4XX e 5XX com $ref em toda operação', () => {
    const document = addErrorResponses(documentWith());
    const operations = [
      document.paths['/users'].get,
      document.paths['/users'].post,
      document.paths['/states'].get,
    ];
    for (const operation of operations) {
      expect(operation?.responses['5XX']).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      });
      expect(operation?.responses['4XX']).toBeDefined();
    }
    expect(document.paths['/users'].get?.responses['200']).toEqual({
      description: 'ok',
    });
  });

  it('não sobrescreve resposta já declarada', () => {
    const document = addErrorResponses(documentWith());
    expect(document.paths['/users'].post?.responses['4XX']).toEqual({
      description: 'já documentado',
    });
  });
});

describe('errorCatalogMarkdown', () => {
  it('lista todo código do catálogo numa tabela', () => {
    const markdown = errorCatalogMarkdown();
    expect(markdown.split('\n')[0]).toBe('| Código | HTTP | Mensagem |');
    for (const [code, { status, message }] of Object.entries(ERROR_CODES)) {
      expect(markdown).toContain(`| ${code} | ${status} | ${message} |`);
    }
  });
});
