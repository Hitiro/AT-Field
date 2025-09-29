// apps/api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { RedocModule, RedocOptions } from 'nestjs-redoc';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuração do Swagger Document
  const config = new DocumentBuilder()
    .setTitle('AT-Field API')
    .setDescription('Documentação da API para o sistema de Field Service')
    .setVersion('1.0')
    .addTag('at-field')
    .build();
  const document = SwaggerModule.createDocument(app, config);

  // Configuração do Redocly
  const redocOptions: RedocOptions = {
    title: 'AT-Field API Docs',
    logo: {
      url: 'https://redocly.github.io/redoc/petstore-logo.png', // Coloque a URL do seu logo aqui
    },
    sortPropsAlphabetically: true,
    hideDownloadButton: false,
    hideHostname: false,
  };

  // Disponibiliza o Redocly na rota /docs
  // O primeiro argumento é o "document" do swagger que geramos acima
  await RedocModule.setup('/api', app, document, redocOptions);

  await app.listen(process.env.PORT || 4000);
}
bootstrap();