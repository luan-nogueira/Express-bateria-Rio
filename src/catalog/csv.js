/**
 * Planilhas do catálogo (catalogo/*.csv) ⇄ objetos do site.
 * Módulo puro: usado pelo painel administrativo (navegador), pelo
 * comando `npm run catalogo` (Node) e pelos testes.
 *
 * Formato: CSV com ";" (padrão do Excel em português), UTF-8 com BOM.
 */

export const BATTERY_HEADERS = [
  'id', 'fabricante', 'modelo', 'capacidade_ah', 'cca', 'comprimento_mm', 'largura_mm', 'altura_mm',
  'polo_positivo', 'tecnologia', 'garantia_meses', 'preco', 'preco_atualizado_em', 'imagem', 'observacao', 'fonte',
];
export const APPLICATION_HEADERS = [
  'marca', 'modelo', 'ano_de', 'ano_ate', 'motorizacao', 'start_stop', 'baterias', 'fonte', 'verificado_em',
];
export const TYPE_HEADERS = ['tipo', 'descricao'];

/** Lê CSV com ";", aspas e BOM. Retorna objetos indexados pelo cabeçalho (+ __linha). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = String(text ?? '').replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ';') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [header = [], ...body] = rows.filter((r) => r.some((v) => v.trim() !== ''));
  const keys = header.map((h) => h.trim().toLowerCase());
  return body.map((r, i) => ({ __linha: i + 2, ...Object.fromEntries(keys.map((k, j) => [k, (r[j] ?? '').trim()])) }));
}

const quote = (v) => {
  const s = String(v ?? '');
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Gera CSV (com BOM, para o Excel abrir acentos corretamente). */
export function toCsv(rows, headers) {
  const lines = [headers.join(';'), ...rows.map((r) => headers.map((h) => quote(r[h])).join(';'))];
  return '﻿' + lines.join('\r\n') + '\r\n';
}

const num = (v) => {
  if (!v) return null;
  const n = Number(String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const int = (v) => (v ? Number.parseInt(v, 10) || null : null);

/** Aceita dd/mm/aaaa ou aaaa-mm-dd; devolve aaaa-mm-dd. */
export const isoDate = (v) => {
  if (!v) return null;
  const br = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
};
const simNao = (v) => {
  const s = (v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (s === 'sim') return true;
  if (s === 'nao') return false;
  return null;
};
const polo = (v) => {
  const s = (v || '').toLowerCase();
  if (s.startsWith('dir')) return 'direita';
  if (s.startsWith('esq')) return 'esquerda';
  return null;
};

export function toBattery(r) {
  const dims = [num(r.comprimento_mm), num(r.largura_mm), num(r.altura_mm)];
  const preco = num(r.preco);
  const precoData = isoDate(r.preco_atualizado_em);
  return {
    id: r.id,
    manufacturer: r.fabricante,
    model: r.modelo,
    capacityAh: num(r.capacidade_ah),
    cca: num(r.cca),
    dimensionsMm: dims.every((d) => d) ? { length: dims[0], width: dims[1], height: dims[2] } : null,
    polarity: polo(r.polo_positivo),
    technology: r.tecnologia || null,
    applicationNote: r.observacao || null,
    warrantyMonths: int(r.garantia_meses),
    image: r.imagem ? { src: r.imagem, width: 800, height: 800, alt: `Bateria ${r.fabricante} ${r.modelo}` } : null,
    price: preco !== null && precoData ? { amountBRL: preco, updatedAt: precoData } : null,
    stock: null,
    source: r.fonte,
  };
}

export function toApplication(r) {
  return {
    make: r.marca,
    model: r.modelo,
    yearFrom: int(r.ano_de),
    yearTo: int(r.ano_ate),
    engine: r.motorizacao || null,
    startStop: simNao(r.start_stop),
    batteryIds: (r.baterias || '').split(/[|,]/).map((s) => s.trim()).filter(Boolean),
    source: r.fonte,
    verifiedAt: isoDate(r.verificado_em),
  };
}

/** Monta o objeto do catálogo (formato de public/data/catalog.json) a partir das linhas. */
export function buildCatalog(batteryRows, applicationRows, today = new Date().toISOString().slice(0, 10)) {
  return {
    schemaVersion: 1,
    updatedAt: today,
    source: 'Planilhas de aplicação da Express Baterias Rio (catalogo/*.csv)',
    batteries: batteryRows.map(toBattery),
    applications: applicationRows.map(toApplication),
  };
}

/** Tipos padrão (usados quando ainda não existe catalogo/tipos.csv). */
export const DEFAULT_TYPES = [
  { tipo: 'Convencional', descricao: 'Chumbo-ácido. Para veículos sem sistema start-stop.' },
  { tipo: 'EFB', descricao: 'Enhanced Flooded Battery. Para start-stop básico.' },
  { tipo: 'AGM', descricao: 'Absorbent Glass Mat. Para start-stop com frenagem regenerativa e alta demanda elétrica.' },
];
