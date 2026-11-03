import { defineConfig } from 'vitest/config';

// e2e contra Postgres real (banco <DATABASE_NAME>_test). Os arquivos rodam em
// sequência porque compartilham o banco e o truncam entre os testes.
export default defineConfig({
  test: {
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup-env.ts'],
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
