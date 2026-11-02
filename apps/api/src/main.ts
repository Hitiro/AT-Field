import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module';
import { configureApp } from './common/configure-app';
import {
  addErrorResponses,
  errorCatalogMarkdown,
} from './common/errors/openapi';
import { errorLogFields } from './common/logging/error-log-fields';

async function bootstrap() {
  // Logs do bootstrap ficam no buffer até o AppLogger assumir (configureApp).
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApp(app);

  const config = new DocumentBuilder()
    .setTitle('AT-Field API')
    .setDescription(
      [
        'Documentação da API para o sistema de Field Service.',
        '',
        '## Erros',
        '',
        'Toda resposta de erro tem o formato `{ code, message, requestId, details? }` e o header `X-Request-Id`. Informe o código e o `requestId` ao suporte.',
        '',
        errorCatalogMarkdown(),
      ].join('\n'),
    )
    .setVersion('1.0')
    .build();
  const document = addErrorResponses(
    cleanupOpenApiDoc(SwaggerModule.createDocument(app, config)),
  );

  // Documentação interativa (Scalar) em /api, com exemplos em cURL, fetch,
  // PowerShell, Python etc. O JSON do OpenAPI fica em /api-json.
  SwaggerModule.setup('api', app, document, { swaggerUiEnabled: false });
  app.use('/api', apiReference({ content: document }));

  await app.listen(process.env.PORT ?? 4310);
}

bootstrap().catch((error: unknown) => {
  // Falha antes do AppLogger (ex.: banco fora do ar): o Logger padrão escreve
  // o que ficou no buffer e o erro, e o processo sai com código 1.
  Logger.flush();
  new Logger('Bootstrap').fatal(
    'Falha ao iniciar a API',
    errorLogFields(error, { phase: 'bootstrap' }),
  );
  process.exit(1);
});
