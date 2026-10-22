/**
 * Converte as planilhas da loja (catalogo/*.csv) em public/data/catalog.json.
 *
 * Uso:  npm run catalogo
 *
 * As planilhas podem ser editadas no Excel (separador ";", UTF-8) ou pelo
 * painel administrativo (/admin.html). Cada linha é validada pelas mesmas
 * regras do site: linha sem fonte, sem capacidade ou que cita uma bateria
 * inexistente é recusada e listada no terminal.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateCatalog } from '../src/catalog/catalog.js';
import { parseCsv, buildCatalog } from '../src/catalog/csv.js';

export { parseCsv, toBattery, toApplication } from '../src/catalog/csv.js';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));

function main() {
  const baterias = parseCsv(readFileSync(root('catalogo/baterias.csv'), 'utf8'));
  const aplicacoes = parseCsv(readFileSync(root('catalogo/aplicacoes.csv'), 'utf8'));

  const { catalog, errors } = validateCatalog(buildCatalog(baterias, aplicacoes));

  // Traduz o índice do erro para a linha da planilha.
  const linha = (e) =>
    e
      .replace(/batteries\[(\d+)\]/, (_, i) => `baterias.csv linha ${baterias[i].__linha}`)
      .replace(/applications\[(\d+)\]/, (_, i) => `aplicacoes.csv linha ${aplicacoes[i].__linha}`);

  writeFileSync(root('public/data/catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  console.log(`Baterias aceitas: ${catalog.batteries.length} de ${baterias.length}`);
  console.log(`Aplicações aceitas: ${catalog.applications.length} de ${aplicacoes.length}`);
  if (errors.length) {
    console.log('\nLinhas recusadas (corrija e rode de novo):');
    errors.forEach((e) => console.log('  - ' + linha(e)));
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
