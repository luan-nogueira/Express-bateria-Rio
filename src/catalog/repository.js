/**
 * Carregamento do catálogo e da lista de veículos.
 *
 * Hoje os dados vêm de arquivos estáticos em public/data. Para integrar um sistema
 * de gestão de produtos, defina VITE_CATALOG_URL apontando para um endpoint
 * que devolva o mesmo formato JSON (docs/CATALOGO.md) — nada mais muda.
 */
import { validateCatalog, emptyCatalog } from './catalog.js';

const BASE = import.meta.env.BASE_URL; // '/' no domínio próprio, '/Express-bateria-Rio/' no GitHub Pages
const CATALOG_URL = import.meta.env.VITE_CATALOG_URL || `${BASE}data/catalog.json`;
const VEHICLES_URL = `${BASE}data/vehicles.json`;

let catalogPromise;
let vehiclesPromise;

async function getJson(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function loadTestFixture() {
  // Somente em desenvolvimento (npm run dev) com ?catalogo=teste.
  // No build de produção este bloco é removido — os dados de teste nunca são publicados.
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('catalogo') === 'teste') {
    const mod = await import('../../tests/fixtures/catalog.test.json');
    return { ...mod.default, __test: true };
  }
  return null;
}

/** @returns {Promise<{catalog: object, isTest: boolean}>} — rejeita se o catálogo não puder ser lido. */
export function loadCatalog() {
  catalogPromise ??= (async () => {
    const raw = (await loadTestFixture()) ?? (await getJson(CATALOG_URL));
    const { catalog, errors } = validateCatalog(raw);
    if (errors.length) console.warn('[catálogo] itens ignorados por dados incompletos:', errors);
    return { catalog, isTest: Boolean(raw.__test) };
  })().catch((err) => {
    catalogPromise = undefined; // permite tentar de novo
    throw err;
  });
  return catalogPromise;
}

export function loadVehicles() {
  vehiclesPromise ??= getJson(VEHICLES_URL).catch((err) => {
    vehiclesPromise = undefined;
    throw err;
  });
  return vehiclesPromise;
}

export { emptyCatalog };
