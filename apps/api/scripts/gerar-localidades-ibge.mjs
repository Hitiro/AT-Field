// Gera o retrato versionado da base de localidades do IBGE (UFs e municípios)
// em src/geo/ibge/data/localidades-AAAA-MM.json. Só roda quando se quer
// atualizar a base; a API nunca chama o IBGE em tempo de execução.
//
// Uso (a partir de apps/api):
//   pnpm geo:snapshot            -> versão = ano-mês de hoje
//   pnpm geo:snapshot 2027-01    -> versão informada
//   --force                      -> sobrescreve um arquivo existente
//
// A versão tem de ser nova: um arquivo já usado por migration aplicada nunca
// deve ser regerado (o banco não o recarrega e o ETag de /cities/all não muda).
// Por isso o script recusa sobrescrever sem --force.
//
// Depois de gerar um arquivo novo, crie uma migration que chame seedIbge com
// ele e atualize CURRENT_IBGE_SNAPSHOT (ver docs/passos/007).
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = 'https://servicodados.ibge.gov.br/api/v1/localidades';
const MIN_CITIES = 5570;
const MAX_NAME = 120;
const TIMEOUT_MS = 60_000;

const args = process.argv.slice(2);
const force = args.includes('--force');
const positional = args.filter((arg) => !arg.startsWith('--'));
const unknown = args.filter((arg) => arg.startsWith('--') && arg !== '--force');
if (unknown.length || positional.length > 1) {
  console.error(`Argumentos inválidos: ${args.join(' ')}`);
  console.error('Uso: geo:snapshot [AAAA-MM] [--force]');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const version = positional[0] ?? today.slice(0, 7);
if (!/^\d{4}-\d{2}$/.test(version)) {
  console.error(`Versão inválida: "${version}" (use AAAA-MM)`);
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const file = join(
  here,
  '..',
  'src',
  'geo',
  'ibge',
  'data',
  `localidades-${version}.json`,
);
if (existsSync(file) && !force) {
  console.error(`${file} já existe; nada foi baixado nem gravado.`);
  console.error(
    'Use uma versão nova (ex.: geo:snapshot 2027-01). Nunca regere um retrato já usado por migration aplicada; --force só para um arquivo ainda não commitado.',
  );
  process.exit(1);
}

async function getJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url} respondeu ${response.status}`);
  return response.json();
}

function validate(states, cities) {
  const errors = [];
  if (states.length !== 27)
    errors.push(`esperadas 27 UFs, vieram ${states.length}`);
  if (new Set(states.map((s) => s[1])).size !== states.length) {
    errors.push('sigla de UF repetida');
  }
  const stateIds = new Set(states.map((s) => s[0]));
  if (cities.length < MIN_CITIES) {
    errors.push(
      `esperados ao menos ${MIN_CITIES} municípios, vieram ${cities.length}`,
    );
  }
  const seen = new Set();
  for (const [id, stateId, name] of cities) {
    if (!Number.isInteger(id) || id < 1000000 || id > 9999999) {
      errors.push(`id inválido: ${id}`);
    }
    if (seen.has(id)) errors.push(`id repetido: ${id}`);
    seen.add(id);
    if (Math.floor(id / 100000) !== stateId) {
      errors.push(`id ${id} não pertence à UF ${stateId}`);
    }
    if (!stateIds.has(stateId))
      errors.push(`UF inexistente ${stateId} (${id})`);
    if (typeof name !== 'string' || !name.trim() || name.length > MAX_NAME) {
      errors.push(`nome inválido no município ${id}`);
    }
  }
  return errors;
}

const rawStates = await getJson(`${SOURCE}/estados`);
const rawCities = await getJson(`${SOURCE}/municipios?view=nivelado`);

const states = rawStates
  .map((s) => [s.id, s.sigla, s.nome])
  .sort((a, b) => a[0] - b[0]);
const cities = rawCities
  .map((c) => [c['municipio-id'], c['UF-id'], c['municipio-nome']])
  .sort((a, b) => a[0] - b[0]);

const errors = validate(states, cities);
if (errors.length) {
  console.error('Retrato do IBGE inválido, nada foi gravado:');
  for (const error of errors.slice(0, 20)) console.error(`- ${error}`);
  process.exit(1);
}

// Uma tupla por linha: diff legível quando o IBGE muda algo.
const line = (tuple) => `    ${JSON.stringify(tuple)}`;
const content = [
  '{',
  `  "source": ${JSON.stringify(SOURCE)},`,
  `  "generatedAt": ${JSON.stringify(today)},`,
  '  "states": [',
  states.map(line).join(',\n'),
  '  ],',
  '  "cities": [',
  cities.map(line).join(',\n'),
  '  ]',
  '}',
  '',
].join('\n');

writeFileSync(file, content, 'utf8');
console.log(
  `${states.length} UFs e ${cities.length} municípios gravados em ${file}`,
);
