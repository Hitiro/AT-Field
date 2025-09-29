module.exports = {
  extends: ['expo', 'prettier', '@at-field/eslint-preset'],
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    // Adicione aqui apenas regras específicas para o React Native, se precisar
  },
};