/**
 * Dados do painel: linhas das três planilhas, rascunho local e validação.
 * As linhas são guardadas exatamente como na planilha (texto), para que o
 * que o painel publica seja o mesmo que a loja veria no Excel.
 */
import {
  parseCsv,
  toCsv,
  buildCatalog,
  toBattery,
  BATTERY_HEADERS,
  APPLICATION_HEADERS,
  TYPE_HEADERS,
  DEFAULT_TYPES,
} from '../catalog/csv.js';
import { validateCatalog } from '../catalog/catalog.js';
import { readFile } from './github.js';

const DRAFT_KEY = 'ebr-admin-draft-v1';
export const FILES = {
  batteries: 'catalogo/baterias.csv',
  applications: 'catalogo/aplicacoes.csv',
  types: 'catalogo/tipos.csv',
};

const strip = (rows) => rows.map(({ __linha, ...r }) => r);

export const state = {
  batteries: [],
  applications: [],
  types: [],
  dirty: false,
  origin: 'github', // 'github' | 'rascunho'
};

export function saveDraft() {
  state.dirty = true;
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ batteries: state.batteries, applications: state.applications, types: state.types, savedAt: Date.now() }),
    );
  } catch {
    /* sem armazenamento: as alterações valem até fechar a página */
  }
}

export function clearDraft() {
  state.dirty = false;
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/** Carrega o rascunho local (se houver) ou as planilhas publicadas. */
export async function load({ ignoreDraft = false } = {}) {
  if (!ignoreDraft) {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (draft) {
        Object.assign(state, { batteries: draft.batteries, applications: draft.applications, types: draft.types });
        state.dirty = true;
        state.origin = 'rascunho';
        return;
      }
    } catch {
      /* rascunho corrompido: segue para o GitHub */
    }
  }
  const [b, a, t] = await Promise.all([readFile(FILES.batteries), readFile(FILES.applications), readFile(FILES.types)]);
  state.batteries = strip(parseCsv(b || ''));
  state.applications = strip(parseCsv(a || ''));
  const types = strip(parseCsv(t || ''));
  state.types = types.length ? types : DEFAULT_TYPES.map((x) => ({ ...x }));
  state.dirty = false;
  state.origin = 'github';
}

export function files() {
  return [
    { path: FILES.batteries, content: toCsv(state.batteries, BATTERY_HEADERS) },
    { path: FILES.applications, content: toCsv(state.applications, APPLICATION_HEADERS) },
    { path: FILES.types, content: toCsv(state.types, TYPE_HEADERS) },
  ];
}

/* ---------- Validação (mesmas regras do site + algumas do painel) ---------- */

const FIELD_LABELS = {
  id: 'Código',
  manufacturer: 'Fabricante',
  model: 'Modelo',
  capacityAh: 'Capacidade (Ah)',
  cca: 'CCA',
  warrantyMonths: 'Garantia',
  source: 'Fonte',
  price: 'Preço',
  stock: 'Estoque',
  make: 'Marca',
  'yearFrom/yearTo': 'Anos',
  batteryIds: 'Baterias',
};

const humanize = (msg) =>
  msg
    .replace(/^(batteries|applications)\[\d+\]\.?\s?/, '')
    .replace(/^([a-zA-Z/]+)/, (k) => FIELD_LABELS[k] || k)
    .replace('obrigatório (de onde vieram os dados técnicos)', 'é obrigatória (de onde vieram os dados técnicos)')
    .replace('obrigatório (manual do veículo, fabricante, fornecedor…)', 'é obrigatória (manual do veículo, fabricante, fornecedor…)')
    .replace('deve ser número > 0', 'deve ser um número maior que zero')
    .replace('deve ser número ou null', 'deve ser um número')
    .replace('inválidos', 'inválidos (o ano inicial deve ser menor ou igual ao final)')
    .replace('deve ter ao menos uma bateria', 'precisa de pelo menos uma bateria')
    .replace(/^referencia bateria inexistente/, 'Usa uma bateria que não existe:')
    .replace('precisa de amountBRL e updatedAt', 'precisa do valor e da data de atualização')
    .replace(/^(.+) obrigatório$/, 'Preencha o campo $1.');

export const batteryLabel = (r) => `${r.fabricante || '?'} ${r.modelo || ''}`.trim();
export const applicationLabel = (r) =>
  `${r.marca || '?'} ${r.modelo || ''} ${r.ano_de || '?'}–${r.ano_ate || '?'}${r.motorizacao ? ` ${r.motorizacao}` : ''}`.trim();

/** Erros de uma bateria (linha), considerando códigos duplicados. */
export function batteryErrors(row, index = -1) {
  const { errors } = validateCatalog({ schemaVersion: 1, batteries: [toBattery(row)], applications: [] });
  const out = errors.map(humanize);
  if (row.id && state.batteries.some((b, i) => i !== index && b.id === row.id)) out.push(`Código "${row.id}" já existe em outra bateria.`);
  if (row.preco && !row.preco_atualizado_em) out.push('Informe a data de atualização do preço (sem ela o preço não aparece no site).');
  return out;
}

/** Erros de uma aplicação (linha) usando as baterias atuais. */
export function applicationErrors(row) {
  const { errors } = validateCatalog({
    schemaVersion: 1,
    batteries: state.batteries.map(toBattery),
    applications: [{ ...buildCatalog([], [row]).applications[0] }],
  });
  return errors.filter((e) => e.startsWith('applications')).map(humanize);
}

/** Validação completa antes de publicar. */
export function validateAll() {
  const problems = [];
  state.batteries.forEach((b, i) => batteryErrors(b, i).forEach((e) => problems.push({ where: `Bateria ${batteryLabel(b)}`, tab: 'baterias', e })));
  state.applications.forEach((a) =>
    applicationErrors(a).forEach((e) => problems.push({ where: `Aplicação ${applicationLabel(a)}`, tab: 'aplicacoes', e })),
  );
  return problems;
}

export const slug = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
