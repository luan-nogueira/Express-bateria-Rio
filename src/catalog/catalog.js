/**
 * Regras do catálogo técnico de baterias (sem acesso a DOM ou rede,
 * para poder ser testado com `node --test`).
 *
 * Princípio: o site só mostra uma bateria como compatível quando existe
 * uma APLICAÇÃO cadastrada (veículo → bateria) com fonte informada.
 * Sem aplicação confirmada, o resultado é "no-match" e o visitante é
 * encaminhado para validação humana. Nada é inferido.
 *
 * Formato do arquivo: ver docs/CATALOGO.md
 */

export const SCHEMA_VERSION = 1;
/** Preço só aparece se tiver sido atualizado há no máximo N dias. */
export const PRICE_MAX_AGE_DAYS = 15;
/** Disponibilidade só aparece se tiver sido atualizada há no máximo N dias. */
export const STOCK_MAX_AGE_DAYS = 2;

export const normalize = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ' ')
    .trim();

const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const optNum = (v) => v === null || v === undefined || isNum(v);

function validateBattery(b, i) {
  const errs = [];
  const at = `batteries[${i}]`;
  if (!isStr(b?.id)) errs.push(`${at}.id obrigatório`);
  if (!isStr(b?.manufacturer)) errs.push(`${at}.manufacturer obrigatório`);
  if (!isStr(b?.model)) errs.push(`${at}.model obrigatório`);
  if (!isNum(b?.capacityAh) || b.capacityAh <= 0) errs.push(`${at}.capacityAh deve ser número > 0`);
  if (!optNum(b?.cca)) errs.push(`${at}.cca deve ser número ou null`);
  if (!optNum(b?.warrantyMonths)) errs.push(`${at}.warrantyMonths deve ser número ou null`);
  if (!isStr(b?.source)) errs.push(`${at}.source obrigatório (de onde vieram os dados técnicos)`);
  if (b?.price && (!isNum(b.price.amountBRL) || !isStr(b.price.updatedAt)))
    errs.push(`${at}.price precisa de amountBRL e updatedAt`);
  if (b?.stock && (typeof b.stock.available !== 'boolean' || !isStr(b.stock.updatedAt)))
    errs.push(`${at}.stock precisa de available e updatedAt`);
  return errs;
}

function validateApplication(a, i, batteryIds) {
  const errs = [];
  const at = `applications[${i}]`;
  if (!isStr(a?.make)) errs.push(`${at}.make obrigatório`);
  if (!isStr(a?.model)) errs.push(`${at}.model obrigatório`);
  if (!isNum(a?.yearFrom) || !isNum(a?.yearTo) || a.yearFrom > a.yearTo)
    errs.push(`${at}.yearFrom/yearTo inválidos`);
  if (!Array.isArray(a?.batteryIds) || a.batteryIds.length === 0)
    errs.push(`${at}.batteryIds deve ter ao menos uma bateria`);
  else
    a.batteryIds.forEach((id) => {
      if (!batteryIds.has(id)) errs.push(`${at} referencia bateria inexistente "${id}"`);
    });
  if (!isStr(a?.source)) errs.push(`${at}.source obrigatório (manual do veículo, fabricante, fornecedor…)`);
  return errs;
}

/**
 * Valida o catálogo. Retorna { ok, errors, catalog }.
 * Itens inválidos são descartados (nunca exibidos), mas o restante continua utilizável.
 */
export function validateCatalog(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['catálogo vazio ou inválido'], catalog: emptyCatalog() };
  if (raw.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion esperado: ${SCHEMA_VERSION}`);

  const batteries = [];
  (Array.isArray(raw.batteries) ? raw.batteries : []).forEach((b, i) => {
    const e = validateBattery(b, i);
    if (e.length) errors.push(...e);
    else batteries.push(b);
  });
  const ids = new Set(batteries.map((b) => b.id));

  const applications = [];
  (Array.isArray(raw.applications) ? raw.applications : []).forEach((a, i) => {
    const e = validateApplication(a, i, ids);
    if (e.length) errors.push(...e);
    else applications.push(a);
  });

  return {
    ok: errors.length === 0,
    errors,
    catalog: { ...raw, batteries, applications },
  };
}

export const emptyCatalog = () => ({ schemaVersion: SCHEMA_VERSION, batteries: [], applications: [] });

const sameVehicle = (a, v) =>
  normalize(a.make) === normalize(v.make) &&
  normalize(a.model) === normalize(v.model) &&
  Number(v.year) >= a.yearFrom &&
  Number(v.year) <= a.yearTo;

/** Motorizações cadastradas para o veículo (para o 4º campo do configurador). */
export function enginesFor(catalog, vehicle) {
  const set = new Map();
  for (const a of catalog.applications) {
    if (sameVehicle(a, vehicle) && isStr(a.engine)) set.set(normalize(a.engine), a.engine);
  }
  return [...set.values()].sort((x, y) => x.localeCompare(y, 'pt-BR'));
}

/** Modelos com aplicação cadastrada para uma marca. */
export function catalogModelsFor(catalog, make) {
  const m = new Map();
  for (const a of catalog.applications) if (normalize(a.make) === normalize(make)) m.set(normalize(a.model), a.model);
  return [...m.values()];
}

/**
 * Consulta as baterias compatíveis.
 * @returns {{ status: 'match'|'no-match'|'needs-engine', batteries: object[], engines: string[], notes: string[] }}
 */
export function findBatteries(catalog, vehicle) {
  const notes = [];
  let apps = catalog.applications.filter((a) => sameVehicle(a, vehicle));
  if (apps.length === 0) return { status: 'no-match', batteries: [], engines: [], notes };

  const engine = vehicle.engine && vehicle.engine !== 'nao-sei' ? normalize(vehicle.engine) : null;
  const engines = enginesFor(catalog, vehicle);
  const specific = apps.filter((a) => isStr(a.engine));

  if (engine) {
    apps = apps.filter((a) => !isStr(a.engine) || normalize(a.engine) === engine);
  } else if (engines.length > 1) {
    // Motorizações diferentes podem usar baterias diferentes: não escolhemos por conta própria.
    return { status: 'needs-engine', batteries: [], engines, notes };
  } else if (specific.length && specific.length < apps.length) {
    notes.push('Confirme a motorização com um especialista antes da compra.');
  }

  // Start-stop: se o cadastro distingue versões com e sem start-stop, respeita a resposta.
  const ss = vehicle.startStop;
  if (apps.some((a) => typeof a.startStop === 'boolean')) {
    if (ss === 'sim' || ss === 'nao') {
      const want = ss === 'sim';
      apps = apps.filter((a) => typeof a.startStop !== 'boolean' || a.startStop === want);
    } else {
      notes.push('Seu veículo pode ter versões com e sem start-stop. Um especialista confirma a tecnologia correta.');
    }
  }

  const byId = new Map(catalog.batteries.map((b) => [b.id, b]));
  const seen = new Set();
  const batteries = [];
  for (const a of apps)
    for (const id of a.batteryIds)
      if (!seen.has(id) && byId.has(id)) {
        seen.add(id);
        batteries.push(byId.get(id));
      }

  if (batteries.length === 0) return { status: 'no-match', batteries: [], engines, notes };
  return { status: 'match', batteries, engines, notes };
}

const ageDays = (iso, now) => (now - new Date(iso).getTime()) / 86_400_000;

/** Preço exibível (ou null) — nunca mostra preço desatualizado. */
export function displayablePrice(battery, now = Date.now()) {
  const p = battery?.price;
  if (!p || !isNum(p.amountBRL) || !isStr(p.updatedAt)) return null;
  const age = ageDays(p.updatedAt, now);
  return age >= 0 && age <= PRICE_MAX_AGE_DAYS ? p.amountBRL : null;
}

/** Disponibilidade exibível (true/false) ou null quando não há dado recente. */
export function displayableStock(battery, now = Date.now()) {
  const s = battery?.stock;
  if (!s || typeof s.available !== 'boolean' || !isStr(s.updatedAt)) return null;
  const age = ageDays(s.updatedAt, now);
  return age >= 0 && age <= STOCK_MAX_AGE_DAYS ? s.available : null;
}
