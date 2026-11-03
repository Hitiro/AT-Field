import { z } from 'zod';

export const envSchema = z.object({
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
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (config: Record<string, unknown>): Env =>
  envSchema.parse(config);

export const resolveLogFormat = (
  nodeEnv: Env['NODE_ENV'],
  logFormat: Env['LOG_FORMAT'],
): 'json' | 'pretty' =>
  logFormat ?? (nodeEnv === 'production' ? 'json' : 'pretty');
