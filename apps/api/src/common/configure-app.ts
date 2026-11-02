import { INestApplication } from '@nestjs/common';
import { AppLogger } from './logging/app-logger';
import { requestIdMiddleware } from './logging/request-id';

// Configuração comum à API e aos testes e2e. Chamar ANTES de app.init() ou
// app.listen(): os body-parsers são registrados no init, e o middleware do
// requestId precisa ficar antes deles (erro de JSON malformado também sai
// com id e no log de acesso).
export function configureApp(app: INestApplication) {
  const logger = app.get(AppLogger);
  app.useLogger(logger);
  app.use(requestIdMiddleware(logger));
}
