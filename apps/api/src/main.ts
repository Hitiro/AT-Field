import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('AT-Field API')
    .setDescription('Documentação da API para o sistema de Field Service')
    .setVersion('1.0')
    .build();
  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));

  // Documentação interativa (Scalar) em /api, com exemplos em cURL, fetch,
  // PowerShell, Python etc. O JSON do OpenAPI fica em /api-json.
  SwaggerModule.setup('api', app, document, { swaggerUiEnabled: false });
  app.use('/api', apiReference({ content: document }));

  await app.listen(process.env.PORT ?? 4310);
}

void bootstrap();
