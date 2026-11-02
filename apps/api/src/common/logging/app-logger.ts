import {
  ConsoleLogger,
  ConsoleLoggerOptions,
  LOG_LEVELS,
  LogLevel,
} from '@nestjs/common';
import { IDENTITY_FIELDS, requestContext } from './request-context';

// Segunda barreira contra vazamento (LGPD): chaves mascaradas em qualquer
// profundidade dos params e de objetos/erros logados. A primeira barreira é
// não logar headers nem corpo, e nunca interpolar dado pessoal na mensagem
// (o redact do Nest não atua em mensagem string nem em stack).
// O redact casa a CHAVE EXATA (sem diferenciar maiúsculas): `ownerEmail` não é
// pego por `email`. Toda chave nova com dado sensível entra nesta lista.
export const DEFAULT_REDACT_KEYS = [
  // credenciais
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'senha',
  'database_password',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'apikey',
  'x-api-key',
  'asaas-access-token',
  'secret',
  'firebaseuid',
  // dados pessoais (LGPD), nomes usados na API, no dto e no core
  'cpf',
  'cnpj',
  'document',
  'email',
  'phone',
  'telefone',
  'telefones',
  'remetentetelefone',
];

// 'warn' → ['warn', 'error', 'fatal'].
export function levelsFrom(threshold: LogLevel): LogLevel[] {
  return LOG_LEVELS.slice(LOG_LEVELS.indexOf(threshold));
}

export type AppLoggerOptions = {
  json: boolean;
  level: LogLevel;
};

// Logger da aplicação (Nest 12 ConsoleLogger): JSON de uma linha por evento
// em produção, texto colorido em dev, sempre com requestId/tenantId do
// contexto da requisição. Trocar o destino do log = mexer só aqui e no
// LoggingModule.
export class AppLogger extends ConsoleLogger {
  constructor({ json, level }: AppLoggerOptions) {
    const options: ConsoleLoggerOptions = {
      json,
      flattenParams: true,
      logLevels: levelsFrom(level),
      redact: DEFAULT_REDACT_KEYS,
    };
    super(options);
  }

  protected printMessages(
    messages: unknown[],
    context?: string,
    logLevel?: LogLevel,
    writeStreamType?: 'stdout' | 'stderr',
    errorStack?: unknown,
    params?: Record<string, any>,
  ): void {
    const merged = withIdentity(params);

    // Modo texto (dev): o stack de errorLogFields sai como bloco legível
    // depois da linha, em vez de uma string com "\n" dentro dos params.
    const error = merged?.error as { stack?: unknown } | undefined;
    if (!this.options.json && typeof error?.stack === 'string') {
      const { stack, ...rest } = error;
      super.printMessages(
        messages,
        context,
        logLevel,
        writeStreamType,
        errorStack,
        {
          ...merged,
          error: rest,
        },
      );
      this.printStackTrace(stack);
      return;
    }

    super.printMessages(
      messages,
      context,
      logLevel,
      writeStreamType,
      errorStack,
      merged,
    );
  }
}

// requestId/tenantId/userId do contexto em toda linha. Método, rota, handler
// e duração ficam só nos logs de erro (errorLogFields).
function withIdentity(params?: Record<string, any>) {
  const store = requestContext.get();
  if (!store) return params;
  const identity = Object.fromEntries(
    IDENTITY_FIELDS.filter((key) => store[key] !== undefined).map((key) => [
      key,
      store[key],
    ]),
  );
  return { ...identity, ...params };
}
