module.exports = {
  testEnvironment: 'node',
  transform: { '^.+\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
}
