/**
 * Configurador "Encontre a bateria certa".
 * Fluxo: marca → modelo → ano → motorização (opcional) → consulta.
 */
import { $, $$, esc, sleep } from '../lib/dom.js';
import { loadCatalog, loadVehicles } from '../catalog/repository.js';
import { findBatteries, enginesFor, catalogModelsFor, normalize } from '../catalog/catalog.js';
import { renderLoading, renderMatch, renderNoMatch, renderError, renderNeedsEngine, openProductDialog } from './results.js';
import { track } from '../lib/analytics.js';
import { prefersReducedMotion } from '../lib/env.js';

const OTHER = '__outro';
const GENERIC_ENGINES = ['1.0', '1.0 Turbo', '1.3', '1.4', '1.5', '1.6', '1.8', '2.0', '2.0 Turbo', 'Diesel', 'Híbrido', 'Elétrico'];
const FIRST_YEAR = 1990;

export function initConfigurator() {
  const form = $('#finder-form');
  if (!form) return;

  const f = {
    make: $('#f-make', form),
    makeOther: $('#f-make-other', form),
    model: $('#f-model', form),
    modelOther: $('#f-model-other', form),
    year: $('#f-year', form),
    engine: $('#f-engine', form),
    submit: $('[type="submit"]', form),
  };
  const results = $('#finder-results');
  const dialog = $('#product-dialog');
  const steps = $$('[data-step]', form);

  let vehicles = [];
  let catalog = null;

  /* ---------- helpers ---------- */
  const setOptions = (select, items, placeholder) => {
    select.innerHTML =
      `<option value="">${esc(placeholder)}</option>` +
      items.map((it) => (typeof it === 'string' ? `<option>${esc(it)}</option>` : `<option value="${esc(it.value)}">${esc(it.label)}</option>`)).join('');
  };
  const toggleOther = (input, show) => {
    input.closest('.field-other').hidden = !show;
    input.required = show;
    if (!show) input.value = '';
  };
  const currentMake = () => (f.make.value === OTHER ? f.makeOther.value.trim() : f.make.value);
  const currentModel = () => (f.model.value === OTHER || f.make.value === OTHER ? f.modelOther.value.trim() : f.model.value);

  function updateSteps() {
    const done = [Boolean(currentMake()), Boolean(currentModel()), Boolean(f.year.value), Boolean(f.engine.value)];
    let currentSet = false;
    steps.forEach((s, i) => {
      const state = done[i] ? 'done' : !currentSet ? ((currentSet = true), 'current') : 'todo';
      s.dataset.stepState = state;
    });
  }

  function clearError(input) {
    input.removeAttribute('aria-invalid');
    const err = $(`#${input.getAttribute('aria-describedby')?.split(' ').find((id) => id.startsWith('err-'))}`);
    if (err) err.textContent = '';
  }
  function setError(input, msg) {
    input.setAttribute('aria-invalid', 'true');
    const id = input.getAttribute('aria-describedby')?.split(' ').find((x) => x.startsWith('err-'));
    if (id) $(`#${id}`).textContent = msg;
  }

  /* ---------- carregamento ---------- */
  async function boot() {
    f.make.disabled = true;
    setOptions(f.make, [], 'Carregando marcas…');
    const [veh, cat] = await Promise.allSettled([loadVehicles(), loadCatalog()]);
    if (cat.status === 'fulfilled') catalog = cat.value;
    if (veh.status === 'fulfilled') vehicles = veh.value.makes;

    const makes = new Map(vehicles.map((m) => [normalize(m.name), m.name]));
    catalog?.catalog.applications.forEach((a) => makes.set(normalize(a.make), a.make));
    const makeList = [...makes.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    setOptions(f.make, [...makeList, { value: OTHER, label: 'Outra marca' }], 'Selecione a marca');
    f.make.disabled = false;

    const years = [];
    const last = new Date().getFullYear() + 1;
    for (let y = last; y >= FIRST_YEAR; y--) years.push(String(y));
    setOptions(f.year, years, 'Selecione o ano');
    updateSteps();
  }

  /* ---------- dependências entre campos ---------- */
  f.make.addEventListener('change', () => {
    clearError(f.make);
    const isOther = f.make.value === OTHER;
    toggleOther(f.makeOther, isOther);
    toggleOther(f.modelOther, isOther);
    f.model.closest('.field').hidden = isOther;
    if (isOther) {
      f.model.required = false;
      f.makeOther.focus();
    } else {
      f.model.required = true;
      const ref = vehicles.find((m) => normalize(m.name) === normalize(f.make.value))?.models ?? [];
      const fromCatalog = catalog ? catalogModelsFor(catalog.catalog, f.make.value) : [];
      const models = [...new Map([...ref, ...fromCatalog].map((m) => [normalize(m), m])).values()].sort((a, b) =>
        a.localeCompare(b, 'pt-BR', { numeric: true }),
      );
      setOptions(f.model, [...models, { value: OTHER, label: 'Outro modelo' }], f.make.value ? 'Selecione o modelo' : 'Escolha a marca primeiro');
      f.model.disabled = !f.make.value;
    }
    refreshEngines();
    updateSteps();
  });

  f.model.addEventListener('change', () => {
    clearError(f.model);
    toggleOther(f.modelOther, f.model.value === OTHER);
    if (f.model.value === OTHER) f.modelOther.focus();
    refreshEngines();
    updateSteps();
  });

  [f.makeOther, f.modelOther].forEach((i) =>
    i.addEventListener('input', () => {
      clearError(i);
      updateSteps();
    }),
  );

  f.year.addEventListener('change', () => {
    clearError(f.year);
    refreshEngines();
    updateSteps();
  });
  f.engine.addEventListener('change', updateSteps);

  function refreshEngines() {
    const v = { make: currentMake(), model: currentModel(), year: f.year.value };
    const known = catalog && v.make && v.model && v.year ? enginesFor(catalog.catalog, v) : [];
    const prev = f.engine.value;
    const list = known.length ? known : GENERIC_ENGINES;
    setOptions(f.engine, [...list, { value: 'nao-sei', label: 'Não sei' }], known.length ? 'Selecione a motorização' : 'Opcional');
    $('#engine-hint').textContent = known.length
      ? 'Este veículo tem aplicações diferentes por motorização.'
      : 'Se souber, ajuda o especialista a confirmar mais rápido.';
    if ([...f.engine.options].some((o) => o.value === prev)) f.engine.value = prev;
  }

  /* ---------- consulta ---------- */
  function readVehicle() {
    return {
      make: currentMake(),
      model: currentModel(),
      year: f.year.value,
      engine: f.engine.value,
      startStop: form.elements.startStop?.value || '',
    };
  }

  function validate() {
    let first = null;
    const need = (input, ok, msg) => {
      if (!ok) {
        setError(input, msg);
        first ??= input;
      } else clearError(input);
    };
    if (f.make.value === OTHER) need(f.makeOther, f.makeOther.value.trim().length >= 2, 'Informe a marca do veículo.');
    else need(f.make, Boolean(f.make.value), 'Selecione a marca.');
    if (f.make.value === OTHER || f.model.value === OTHER) need(f.modelOther, f.modelOther.value.trim().length >= 1, 'Informe o modelo.');
    else if (f.make.value) need(f.model, Boolean(f.model.value), 'Selecione o modelo.');
    need(f.year, Boolean(f.year.value), 'Selecione o ano.');
    first?.focus();
    return !first;
  }

  async function search() {
    if (!validate()) return;
    const vehicle = readVehicle();
    results.hidden = false;
    renderLoading(results);
    f.submit.disabled = true;
    f.submit.setAttribute('aria-busy', 'true');
    results.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    track('battery_search', { make: vehicle.make, model: vehicle.model, year: vehicle.year });

    try {
      const [data] = await Promise.all([loadCatalog(), sleep(420)]); // pausa mínima evita "piscar"
      catalog = data;
      const r = findBatteries(data.catalog, vehicle);
      if (r.status === 'match') {
        renderMatch(results, { vehicle, ...r, catalog: data.catalog, isTest: data.isTest }, (b, v) => openProductDialog(dialog, b, v));
      } else if (r.status === 'needs-engine') {
        refreshEngines();
        renderNeedsEngine(results, vehicle, r.engines, (engine) => {
          f.engine.value = engine;
          updateSteps();
          search();
        });
      } else {
        renderNoMatch(results, vehicle);
      }
      track('battery_search_result', { status: r.status });
    } catch (err) {
      console.error('[configurador]', err);
      renderError(results, vehicle, search);
    } finally {
      f.submit.disabled = false;
      f.submit.removeAttribute('aria-busy');
      results.querySelector('[tabindex="-1"]')?.focus({ preventScroll: true });
    }
  }

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    search();
  });

  dialog?.addEventListener('click', (ev) => {
    if (ev.target === dialog || ev.target.closest('[data-dialog-close]')) dialog.close();
  });

  boot().catch((err) => console.error('[configurador] falha ao iniciar', err));
}
