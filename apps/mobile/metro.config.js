// apps/mobile/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Encontra a raiz do projeto do monorepo
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Ensina o Metro a "assistir" toda a estrutura do monorepo
config.watchFolders = [workspaceRoot];

// 2. Ajuda o Metro a resolver os pacotes a partir da node_modules da raiz
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Garante que não haja conflitos de dependência (ex: duas versões do React)
config.resolver.disableHierarchicalLookup = true;

module.exports = config;