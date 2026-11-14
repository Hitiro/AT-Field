import { z } from 'zod';

const baseEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4310),
  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.coerce.number().int().positive().default(54310),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  DATABASE_NAME: z.string().min(1),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'log', 'debug', 'verbose'])
    .default('log'),
  // Sem valor: json em production, pretty (texto colorido do Nest) fora.
  LOG_FORMAT: z.enum(['json', 'pretty']).optional(),
  // Firebase Auth (passo 009a). Id do projeto: confere `aud`/`iss` do token.
  FIREBASE_PROJECT_ID: z.string().regex(/^[a-z0-9-]{4,30}$/),
  // Caminho do JSON da service account (lido pelo applicationDefault() do
  // firebase-admin). Só é necessário com AUTH_CHECK_REVOKED=true.
  GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1).optional(),
  // Consulta o Firebase a cada requisição para saber se a sessão foi
  // revogada (custo e latência; desligado por padrão).
  AUTH_CHECK_REVOKED: z.stringbool().default(false),
  // Auth Emulator (só dev/teste). Com ela o firebase-admin aceita token SEM
  // assinatura: proibida em production. O SDK lê process.env direto, e esta
  // validação olha a mesma variável.
  FIREBASE_AUTH_EMULATOR_HOST: z.string().min(1).optional(),
});

// Emulador só na própria máquina: localhost, 127.0.0.1 ou [::1], com porta
// opcional. IPv6 só com colchetes: o SDK monta `http://${host}/...`, e
// `http://::1/...` é URL inválida. Não depende de NODE_ENV, cujo padrão é
// development: um deploy sem NODE_ENV com a variável apontando para um host
// remoto também é recusado.
const LOOPBACK_EMULATOR_HOST =
  /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/;

export const isLoopbackEmulatorHost = (host: string) =>
  LOOPBACK_EMULATOR_HOST.test(host);

export const envSchema = baseEnvSchema.superRefine((env, ctx) => {
  const emulatorHost = env.FIREBASE_AUTH_EMULATOR_HOST;
  if (emulatorHost && env.NODE_ENV === 'production') {
    ctx.addIssue({
      code: 'custom',
      path: ['FIREBASE_AUTH_EMULATOR_HOST'],
      message: 'Proibida com NODE_ENV=production (aceita token sem assinatura)',
    });
  } else if (emulatorHost && !isLoopbackEmulatorHost(emulatorHost)) {
    ctx.addIssue({
      code: 'custom',
      path: ['FIREBASE_AUTH_EMULATOR_HOST'],
      message: 'Só host loopback (localhost, 127.0.0.1 ou [::1])',
    });
  }
  if (env.AUTH_CHECK_REVOKED && !env.GOOGLE_APPLICATION_CREDENTIALS) {
    ctx.addIssue({
      code: 'custom',
      path: ['GOOGLE_APPLICATION_CREDENTIALS'],
      message: 'Obrigatória com AUTH_CHECK_REVOKED=true',
    });
  }
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (config: Record<string, unknown>): Env =>
  envSchema.parse(config);

// Só o que o banco precisa: o CLI do TypeORM (migrations) não depende da
// configuração do Firebase.
export const databaseEnvSchema = baseEnvSchema.pick({
  DATABASE_HOST: true,
  DATABASE_PORT: true,
  DATABASE_USER: true,
  DATABASE_PASSWORD: true,
  DATABASE_NAME: true,
});

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;

export const validateDatabaseEnv = (
  config: Record<string, unknown>,
): DatabaseEnv => databaseEnvSchema.parse(config);

export const resolveLogFormat = (
  nodeEnv: Env['NODE_ENV'],
  logFormat: Env['LOG_FORMAT'],
): 'json' | 'pretty' =>
  logFormat ?? (nodeEnv === 'production' ? 'json' : 'pretty');
