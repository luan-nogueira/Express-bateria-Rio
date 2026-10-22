import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/jetbrains-mono/500.css';
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components.css';
import '../styles/admin.css';

import { esc } from '../lib/dom.js';
import { verify, isLogged, setLogged } from './auth.js';
import { getToken, setToken, testConnection, commitFiles, GitHubError, ACTIONS_URL } from './github.js';
import {
  state,
  load,
  saveDraft,
  clearDraft,
  files,
  batteryErrors,
  applicationErrors,
  validateAll,
  batteryLabel,
  applicationLabel,
  slug,
} from './store.js';
import { BATTERY_HEADERS, APPLICATION_HEADERS, TYPE_HEADERS, toCsv } from '../catalog/csv.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const BASE = import.meta.env.BASE_URL;
const today = () => new Date().toISOString().slice(0, 10);
const icon = (n) => `<svg class="icon" aria-hidden="true"><use href="#i-${n}"></use></svg>`;

let vehicles = [];
let currentTab = 'baterias';
const filters = { baterias: '', aplicacoes: '' };

/* ================= LOGIN ================= */

function showLogin() {
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#login-email').focus();
}

$('#login-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const btn = $('#login-form [type="submit"]');
  const msg = $('#login-msg');
  msg.textContent = '';
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  const ok = await verify($('#login-email').value, $('#login-pass').value);
  btn.disabled = false;
  btn.removeAttribute('aria-busy');
  if (!ok) {
    msg.textContent = 'E-mail ou senha incorretos.';
    $('#login-pass').select();
    return;
  }
  setLogged(true);
  $('#login-pass').value = '';
  start();
});

$('#logout').addEventListener('click', () => {
  setLogged(false);
  showLogin();
});

/* ================= APP ================= */

async function start() {
  $('#login').hidden = true;
  $('#app').hidden = false;
  setStatus('Carregando planilhas…');
  try {
    const [, veh] = await Promise.all([load(), fetch(`${BASE}data/vehicles.json`).then((r) => r.json()).catch(() => ({ makes: [] }))]);
    vehicles = veh.makes || [];
    setStatus(state.origin === 'rascunho' ? 'Rascunho local carregado (ainda não publicado).' : 'Planilhas carregadas do site.');
  } catch (err) {
    setStatus(`Não foi possível carregar as planilhas: ${err.message}`, 'error');
  }
  renderAll();
}

function setStatus(text, kind = 'info') {
  const el = $('#status');
  el.textContent = text;
  el.dataset.kind = kind;
}

function markChanged(text) {
  saveDraft();
  setStatus(text, 'ok');
  renderAll();
}

function renderAll() {
  $('#dirty').hidden = !state.dirty;
  $('#count-baterias').textContent = state.batteries.length;
  $('#count-aplicacoes').textContent = state.applications.length;
  $('#count-tipos').textContent = state.types.length;
  renderDatalists();
  renderBatteries();
  renderApplications();
  renderTypes();
  renderPublish();
}

/* ---------- Abas ---------- */
$$('[role="tab"]').forEach((tab) =>
  tab.addEventListener('click', () => selectTab(tab.dataset.tab)),
);
function selectTab(name) {
  currentTab = name;
  $$('[role="tab"]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  $$('[role="tabpanel"]').forEach((p) => (p.hidden = p.id !== `panel-${name}`));
  if (name === 'publicar') renderPublish();
}

/* ---------- Listas de sugestões ---------- */
function renderDatalists() {
  const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const opts = (arr) => arr.map((v) => `<option value="${esc(v)}"></option>`).join('');
  $('#dl-fabricantes').innerHTML = opts(uniq(['Moura', 'Heliar', 'Zetta', 'Cral', 'Bosch', 'ACDelco', ...state.batteries.map((b) => b.fabricante)]));
  $('#dl-fontes').innerHTML = opts(uniq([...state.batteries.map((b) => b.fonte), ...state.applications.map((a) => a.fonte)]));
  $('#dl-marcas').innerHTML = opts(uniq([...vehicles.map((m) => m.name), ...state.applications.map((a) => a.marca)]));
  $('#dl-motor').innerHTML = opts(['1.0', '1.0 Turbo', '1.3', '1.4', '1.5', '1.6', '1.8', '2.0', '2.0 Turbo', 'Diesel', 'Híbrido', 'Elétrico']);
}
function modelOptionsFor(make) {
  const ref = vehicles.find((m) => m.name.toLowerCase() === String(make).trim().toLowerCase())?.models ?? [];
  const extra = state.applications.filter((a) => a.marca.toLowerCase() === String(make).trim().toLowerCase()).map((a) => a.modelo);
  return [...new Set([...ref, ...extra])].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
}

/* ================= BATERIAS ================= */

const batteryName = (id) => {
  const b = state.batteries.find((x) => x.id === id);
  return b ? batteryLabel(b) : `${id} (não encontrada)`;
};

function renderBatteries() {
  const q = filters.baterias.toLowerCase();
  const rows = state.batteries
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => !q || Object.values(b).join(' ').toLowerCase().includes(q));
  const usage = (id) => state.applications.filter((a) => (a.baterias || '').split(/[|,]/).map((s) => s.trim()).includes(id)).length;
  $('#table-baterias').innerHTML = rows.length
    ? `<table>
        <thead><tr><th>Bateria</th><th>Ah</th><th>CCA</th><th>Tipo</th><th>Polo +</th><th>Garantia</th><th>Preço</th><th>Usada em</th><th><span class="visually-hidden">Ações</span></th></tr></thead>
        <tbody>${rows
          .map(({ b, i }) => {
            const errs = batteryErrors(b, i);
            return `<tr${errs.length ? ' class="has-error"' : ''}>
              <td><strong>${esc(batteryLabel(b))}</strong><small>${esc(b.id)}</small>${errs.length ? `<small class="err">${esc(errs[0])}</small>` : ''}</td>
              <td>${esc(b.capacidade_ah)}</td><td>${esc(b.cca)}</td><td>${esc(b.tecnologia)}</td><td>${esc(b.polo_positivo)}</td>
              <td>${b.garantia_meses ? `${esc(b.garantia_meses)} meses` : ''}</td>
              <td>${b.preco ? `R$ ${esc(b.preco)}` : ''}</td>
              <td>${usage(b.id)} veículo(s)</td>
              <td class="actions">
                <button type="button" class="icon-btn" data-edit-battery="${i}" aria-label="Editar ${esc(batteryLabel(b))}">${icon('edit')}</button>
                <button type="button" class="icon-btn" data-dup-battery="${i}" aria-label="Duplicar ${esc(batteryLabel(b))}">${icon('copy')}</button>
                <button type="button" class="icon-btn icon-btn--danger" data-del-battery="${i}" aria-label="Excluir ${esc(batteryLabel(b))}">${icon('trash')}</button>
              </td></tr>`;
          })
          .join('')}</tbody></table>`
    : `<p class="empty">${q ? 'Nenhuma bateria encontrada para a busca.' : 'Nenhuma bateria cadastrada. Clique em “Nova bateria” para começar.'}</p>`;
}

$('#search-baterias').addEventListener('input', (e) => {
  filters.baterias = e.target.value;
  renderBatteries();
});
$('#new-battery').addEventListener('click', () => openBattery());
$('#table-baterias').addEventListener('click', (e) => {
  const edit = e.target.closest('[data-edit-battery]');
  const dup = e.target.closest('[data-dup-battery]');
  const del = e.target.closest('[data-del-battery]');
  if (edit) openBattery(Number(edit.dataset.editBattery));
  if (dup) {
    const src = state.batteries[Number(dup.dataset.dupBattery)];
    openBattery(-1, { ...src, id: '', modelo: `${src.modelo} (cópia)` });
  }
  if (del) deleteBattery(Number(del.dataset.delBattery));
});

const BATTERY_FIELDS = [
  { k: 'fabricante', label: 'Fabricante', req: true, list: 'dl-fabricantes', span: 2 },
  { k: 'modelo', label: 'Modelo / código do fabricante', req: true, span: 2, hint: 'Ex.: 60GD' },
  { k: 'capacidade_ah', label: 'Capacidade (Ah)', req: true, type: 'number' },
  { k: 'cca', label: 'CCA (A)', type: 'number' },
  { k: 'tecnologia', label: 'Tipo de bateria', type: 'types' },
  { k: 'polo_positivo', label: 'Polo positivo', type: 'select', options: ['', 'Direita', 'Esquerda'] },
  { k: 'comprimento_mm', label: 'Comprimento (mm)', type: 'number' },
  { k: 'largura_mm', label: 'Largura (mm)', type: 'number' },
  { k: 'altura_mm', label: 'Altura (mm)', type: 'number' },
  { k: 'garantia_meses', label: 'Garantia (meses)', type: 'number', hint: 'Só se confirmada' },
  { k: 'preco', label: 'Preço (R$)', hint: 'Use vírgula: 499,90' },
  { k: 'preco_atualizado_em', label: 'Preço atualizado em', type: 'date', hint: 'Some do site após 15 dias' },
  { k: 'imagem', label: 'Imagem (endereço)', span: 2, hint: 'Opcional. Ex.: https://…/foto.webp' },
  { k: 'observacao', label: 'Observação', span: 4, type: 'textarea' },
  { k: 'fonte', label: 'Fonte dos dados técnicos', req: true, list: 'dl-fontes', span: 3, hint: 'Ex.: Tabela de aplicação Moura 2026' },
  { k: 'id', label: 'Código interno', hint: 'Automático', span: 1 },
];

function field(f, value) {
  const id = `f-${f.k}`;
  const req = f.req ? ' required' : '';
  const v = esc(value ?? '');
  let input;
  if (f.type === 'textarea') input = `<textarea id="${id}" name="${f.k}" rows="2">${v}</textarea>`;
  else if (f.type === 'select') input = `<select id="${id}" name="${f.k}">${f.options.map((o) => `<option${o === value ? ' selected' : ''} value="${esc(o)}">${esc(o || '—')}</option>`).join('')}</select>`;
  else if (f.type === 'types') {
    const types = state.types.map((t) => t.tipo);
    if (value && !types.includes(value)) types.push(value);
    input = `<select id="${id}" name="${f.k}"><option value="">—</option>${types.map((t) => `<option${t === value ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  } else {
    const type = f.type === 'number' ? 'text" inputmode="decimal' : f.type || 'text';
    input = `<input id="${id}" name="${f.k}" type="${type}" value="${v}"${f.list ? ` list="${f.list}"` : ''}${req} autocomplete="off">`;
  }
  return `<div class="afield" style="--span:${f.span || 1}">
    <label for="${id}">${esc(f.label)}${f.req ? ' <span class="req">*</span>' : ''}</label>${input}
    ${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</div>`;
}

function readForm(form, keys) {
  const fd = new FormData(form);
  return Object.fromEntries(keys.map((k) => [k, String(fd.get(k) ?? '').trim()]));
}

function openBattery(index = -1, preset = null) {
  const row = preset || (index >= 0 ? state.batteries[index] : {});
  const dlg = $('#editor');
  $('#editor-title').textContent = index >= 0 ? `Editar bateria` : 'Nova bateria';
  $('#editor-fields').innerHTML = `<div class="agrid">${BATTERY_FIELDS.map((f) => field(f, row[f.k])).join('')}</div>`;
  $('#editor-errors').innerHTML = '';
  const form = $('#editor-form');
  const idInput = $('#f-id');
  const autoId = () => {
    if (idInput.dataset.manual) return;
    idInput.value = slug(`${$('#f-fabricante').value}-${$('#f-modelo').value}`);
  };
  idInput.addEventListener('input', () => (idInput.dataset.manual = '1'));
  if (index >= 0 && row.id) idInput.dataset.manual = '1';
  $('#f-fabricante').addEventListener('input', autoId);
  $('#f-modelo').addEventListener('input', autoId);
  form.onsubmit = (ev) => {
    ev.preventDefault();
    const data = readForm(form, BATTERY_HEADERS);
    if (!data.id) data.id = slug(`${data.fabricante}-${data.modelo}`);
    const errs = batteryErrors(data, index);
    if (errs.length) return showFormErrors(errs);
    const oldId = index >= 0 ? state.batteries[index].id : null;
    if (index >= 0) state.batteries[index] = data;
    else state.batteries.push(data);
    // Se o código mudou, atualiza as aplicações que usavam o antigo.
    if (oldId && oldId !== data.id) {
      state.applications.forEach((a) => {
        a.baterias = (a.baterias || '').split(/[|,]/).map((s) => (s.trim() === oldId ? data.id : s.trim())).filter(Boolean).join('|');
      });
    }
    dlg.close();
    markChanged(`Bateria ${batteryLabel(data)} salva no rascunho.`);
  };
  dlg.showModal();
  $('#f-fabricante').focus();
}

function deleteBattery(index) {
  const b = state.batteries[index];
  const users = state.applications.filter((a) => (a.baterias || '').split(/[|,]/).map((s) => s.trim()).includes(b.id));
  const extra = users.length ? `\n\nEla está ligada a ${users.length} aplicação(ões), que perderão essa bateria.` : '';
  if (!confirm(`Excluir a bateria ${batteryLabel(b)}?${extra}`)) return;
  state.batteries.splice(index, 1);
  users.forEach((a) => {
    a.baterias = a.baterias.split(/[|,]/).map((s) => s.trim()).filter((s) => s && s !== b.id).join('|');
  });
  markChanged(`Bateria ${batteryLabel(b)} excluída do rascunho.`);
}

/* ================= APLICAÇÕES ================= */

function renderApplications() {
  const q = filters.aplicacoes.toLowerCase();
  const rows = state.applications
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => !q || Object.values(a).join(' ').toLowerCase().includes(q));
  $('#table-aplicacoes').innerHTML = rows.length
    ? `<table>
        <thead><tr><th>Veículo</th><th>Anos</th><th>Motorização</th><th>Start-stop</th><th>Baterias indicadas</th><th>Fonte</th><th><span class="visually-hidden">Ações</span></th></tr></thead>
        <tbody>${rows
          .map(({ a, i }) => {
            const errs = applicationErrors(a);
            const bats = (a.baterias || '').split(/[|,]/).map((s) => s.trim()).filter(Boolean);
            return `<tr${errs.length ? ' class="has-error"' : ''}>
              <td><strong>${esc(a.marca)} ${esc(a.modelo)}</strong>${errs.length ? `<small class="err">${esc(errs[0])}</small>` : ''}</td>
              <td>${esc(a.ano_de)}–${esc(a.ano_ate)}</td><td>${esc(a.motorizacao || 'Todas')}</td><td>${esc(a.start_stop || '—')}</td>
              <td>${bats.map((id) => `<span class="pill">${esc(batteryName(id))}</span>`).join(' ')}</td>
              <td><small>${esc(a.fonte)}</small></td>
              <td class="actions">
                <button type="button" class="icon-btn" data-edit-app="${i}" aria-label="Editar ${esc(applicationLabel(a))}">${icon('edit')}</button>
                <button type="button" class="icon-btn" data-dup-app="${i}" aria-label="Duplicar ${esc(applicationLabel(a))}">${icon('copy')}</button>
                <button type="button" class="icon-btn icon-btn--danger" data-del-app="${i}" aria-label="Excluir ${esc(applicationLabel(a))}">${icon('trash')}</button>
              </td></tr>`;
          })
          .join('')}</tbody></table>`
    : `<p class="empty">${q ? 'Nenhuma aplicação encontrada para a busca.' : state.batteries.length ? 'Nenhuma aplicação cadastrada. Clique em “Nova aplicação” para ligar um veículo às baterias.' : 'Cadastre primeiro as baterias; depois ligue cada veículo às baterias indicadas aqui.'}</p>`;
}

$('#search-aplicacoes').addEventListener('input', (e) => {
  filters.aplicacoes = e.target.value;
  renderApplications();
});
$('#new-app').addEventListener('click', () => openApplication());
$('#table-aplicacoes').addEventListener('click', (e) => {
  const edit = e.target.closest('[data-edit-app]');
  const dup = e.target.closest('[data-dup-app]');
  const del = e.target.closest('[data-del-app]');
  if (edit) openApplication(Number(edit.dataset.editApp));
  if (dup) openApplication(-1, { ...state.applications[Number(dup.dataset.dupApp)] });
  if (del) {
    const a = state.applications[Number(del.dataset.delApp)];
    if (!confirm(`Excluir a aplicação ${applicationLabel(a)}?`)) return;
    state.applications.splice(Number(del.dataset.delApp), 1);
    markChanged(`Aplicação ${applicationLabel(a)} excluída do rascunho.`);
  }
});

let lastSource = '';
function openApplication(index = -1, preset = null) {
  // A fonte costuma ser a mesma tabela do fornecedor: já vem preenchida com a última usada.
  const defaultSource = lastSource || state.applications.at(-1)?.fonte || state.batteries.at(-1)?.fonte || '';
  const row = preset || (index >= 0 ? state.applications[index] : { verificado_em: today(), fonte: defaultSource });
  const selected = new Set((row.baterias || '').split(/[|,]/).map((s) => s.trim()).filter(Boolean));
  const dlg = $('#editor');
  $('#editor-title').textContent = index >= 0 ? 'Editar aplicação' : 'Nova aplicação';
  const fields = [
    { k: 'marca', label: 'Marca', req: true, list: 'dl-marcas', span: 2 },
    { k: 'modelo', label: 'Modelo', req: true, list: 'dl-modelos', span: 2 },
    { k: 'ano_de', label: 'Ano inicial', req: true, type: 'number' },
    { k: 'ano_ate', label: 'Ano final', req: true, type: 'number' },
    { k: 'motorizacao', label: 'Motorização', list: 'dl-motor', hint: 'Vazio = todas' },
    { k: 'start_stop', label: 'Start-stop', type: 'select', options: ['', 'Sim', 'Não'], hint: '— = indiferente' },
    { k: 'fonte', label: 'Fonte da aplicação', req: true, list: 'dl-fontes', span: 3, hint: 'Ex.: Tabela de aplicação Moura 2026, p. 12' },
    { k: 'verificado_em', label: 'Verificado em', type: 'date' },
  ];
  $('#editor-fields').innerHTML = `<div class="agrid">${fields.map((f) => field(f, row[f.k])).join('')}</div>
    <datalist id="dl-modelos"></datalist>
    <fieldset class="battery-pick">
      <legend>Baterias indicadas <span class="req">*</span></legend>
      ${
        state.batteries.length
          ? `<input type="search" class="pick-search" placeholder="Filtrar baterias…" aria-label="Filtrar baterias">
             <div class="pick-list">${state.batteries
               .map(
                 (b) => `<label class="pick" data-text="${esc(Object.values(b).join(' ').toLowerCase())}">
                   <input type="checkbox" name="pick" value="${esc(b.id)}"${selected.has(b.id) ? ' checked' : ''}>
                   <span><strong>${esc(batteryLabel(b))}</strong> <small>${esc([b.capacidade_ah && `${b.capacidade_ah} Ah`, b.tecnologia, b.polo_positivo && `polo + ${b.polo_positivo.toLowerCase()}`].filter(Boolean).join(' · '))}</small></span>
                 </label>`,
               )
               .join('')}</div>`
          : '<p class="empty">Nenhuma bateria cadastrada ainda. Cadastre as baterias na aba Baterias.</p>'
      }
    </fieldset>`;
  $('#editor-errors').innerHTML = '';
  const syncModels = () => ($('#dl-modelos').innerHTML = modelOptionsFor($('#f-marca').value).map((m) => `<option value="${esc(m)}"></option>`).join(''));
  $('#f-marca').addEventListener('input', syncModels);
  syncModels();
  $('.pick-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    $$('.pick').forEach((p) => (p.hidden = q && !p.dataset.text.includes(q)));
  });
  const form = $('#editor-form');
  form.onsubmit = (ev) => {
    ev.preventDefault();
    const data = readForm(form, APPLICATION_HEADERS);
    data.baterias = $$('input[name="pick"]:checked', form).map((c) => c.value).join('|');
    const errs = applicationErrors(data);
    if (errs.length) return showFormErrors(errs);
    if (index >= 0) state.applications[index] = data;
    else state.applications.push(data);
    lastSource = data.fonte;
    dlg.close();
    markChanged(`Aplicação ${applicationLabel(data)} salva no rascunho.`);
  };
  dlg.showModal();
  $('#f-marca').focus();
}

function showFormErrors(errs) {
  $('#editor-errors').innerHTML = `<div class="form-errors" role="alert"><strong>Corrija antes de salvar:</strong><ul>${errs.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
  $('#editor-errors').scrollIntoView({ block: 'nearest' });
}

$('#editor').addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) $('#editor').close();
});

/* ================= TIPOS ================= */

function renderTypes() {
  const used = (t) => state.batteries.filter((b) => b.tecnologia === t).length;
  $('#table-tipos').innerHTML = state.types.length
    ? `<table><thead><tr><th>Tipo</th><th>Descrição</th><th>Baterias</th><th><span class="visually-hidden">Ações</span></th></tr></thead><tbody>
      ${state.types
        .map(
          (t, i) => `<tr><td><strong>${esc(t.tipo)}</strong></td><td>${esc(t.descricao)}</td><td>${used(t.tipo)}</td>
          <td class="actions">
            <button type="button" class="icon-btn" data-edit-type="${i}" aria-label="Editar ${esc(t.tipo)}">${icon('edit')}</button>
            <button type="button" class="icon-btn icon-btn--danger" data-del-type="${i}" aria-label="Excluir ${esc(t.tipo)}">${icon('trash')}</button>
          </td></tr>`,
        )
        .join('')}</tbody></table>`
    : '<p class="empty">Nenhum tipo cadastrado.</p>';
}

$('#new-type').addEventListener('click', () => openType());
$('#table-tipos').addEventListener('click', (e) => {
  const edit = e.target.closest('[data-edit-type]');
  const del = e.target.closest('[data-del-type]');
  if (edit) openType(Number(edit.dataset.editType));
  if (del) {
    const t = state.types[Number(del.dataset.delType)];
    const n = state.batteries.filter((b) => b.tecnologia === t.tipo).length;
    if (n) return alert(`O tipo ${t.tipo} está em ${n} bateria(s). Mude o tipo dessas baterias antes de excluir.`);
    if (!confirm(`Excluir o tipo ${t.tipo}?`)) return;
    state.types.splice(Number(del.dataset.delType), 1);
    markChanged(`Tipo ${t.tipo} excluído do rascunho.`);
  }
});

function openType(index = -1) {
  const row = index >= 0 ? state.types[index] : {};
  $('#editor-title').textContent = index >= 0 ? 'Editar tipo de bateria' : 'Novo tipo de bateria';
  $('#editor-fields').innerHTML = `<div class="agrid">
    ${field({ k: 'tipo', label: 'Nome do tipo', req: true, span: 2, hint: 'Ex.: EFB, AGM, Convencional, Lítio' }, row.tipo)}
    ${field({ k: 'descricao', label: 'Descrição', type: 'textarea', span: 4 }, row.descricao)}</div>`;
  $('#editor-errors').innerHTML = '';
  const form = $('#editor-form');
  form.onsubmit = (ev) => {
    ev.preventDefault();
    const data = readForm(form, TYPE_HEADERS);
    if (!data.tipo) return showFormErrors(['Informe o nome do tipo.']);
    if (state.types.some((t, i) => i !== index && t.tipo.toLowerCase() === data.tipo.toLowerCase())) return showFormErrors([`O tipo ${data.tipo} já existe.`]);
    const old = index >= 0 ? state.types[index].tipo : null;
    if (index >= 0) state.types[index] = data;
    else state.types.push(data);
    if (old && old !== data.tipo) state.batteries.forEach((b) => b.tecnologia === old && (b.tecnologia = data.tipo));
    $('#editor').close();
    markChanged(`Tipo ${data.tipo} salvo no rascunho.`);
  };
  $('#editor').showModal();
  $('#f-tipo').focus();
}

/* ================= PUBLICAR ================= */

function renderPublish() {
  const problems = validateAll();
  const hasToken = Boolean(getToken());
  $('#pub-summary').innerHTML = `
    <li><strong>${state.batteries.length}</strong> bateria(s)</li>
    <li><strong>${state.applications.length}</strong> aplicação(ões)</li>
    <li><strong>${state.types.length}</strong> tipo(s)</li>
    <li>${state.dirty ? '<span class="badge badge--warn">Alterações não publicadas</span>' : '<span class="badge badge--ok">Igual ao site</span>'}</li>`;
  $('#pub-problems').innerHTML = problems.length
    ? `<div class="form-errors"><strong>${problems.length} problema(s) impedem a publicação:</strong><ul>${problems
        .slice(0, 30)
        .map((p) => `<li><button type="button" class="linklike" data-goto="${p.tab}">${esc(p.where)}</button>: ${esc(p.e)}</li>`)
        .join('')}</ul></div>`
    : '<p class="ok-line">Nenhum problema encontrado. Tudo pronto para publicar.</p>';
  $('#token-state').textContent = hasToken ? 'Token salvo neste navegador.' : 'Nenhum token salvo neste navegador.';
  $('#publish').disabled = problems.length > 0 || !hasToken || !state.dirty;
  $('#publish-hint').textContent = !hasToken
    ? 'Salve o token do GitHub abaixo para habilitar a publicação.'
    : !state.dirty
      ? 'Não há alterações para publicar.'
      : problems.length
        ? 'Corrija os problemas acima para publicar.'
        : 'Publica as três planilhas em um único envio. O site atualiza em cerca de 1 minuto.';
}

$('#pub-problems').addEventListener('click', (e) => {
  const b = e.target.closest('[data-goto]');
  if (b) selectTab(b.dataset.goto);
});

$('#token-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const value = $('#token').value.trim();
  if (!value) return;
  setToken(value);
  $('#token').value = '';
  $('#token-msg').textContent = 'Testando conexão…';
  try {
    const name = await testConnection();
    $('#token-msg').textContent = `Conectado ao repositório ${name}, com permissão de escrita.`;
    $('#token-msg').dataset.kind = 'ok';
  } catch (err) {
    setToken('');
    $('#token-msg').textContent = err.message;
    $('#token-msg').dataset.kind = 'error';
  }
  renderPublish();
});
$('#token-clear').addEventListener('click', () => {
  setToken('');
  $('#token-msg').textContent = 'Token removido deste navegador.';
  $('#token-msg').dataset.kind = 'info';
  renderPublish();
});

$('#publish').addEventListener('click', async () => {
  const btn = $('#publish');
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  setStatus('Publicando…');
  try {
    const url = await commitFiles(
      files(),
      `Catálogo atualizado pelo painel: ${state.batteries.length} baterias, ${state.applications.length} aplicações`,
    );
    clearDraft();
    state.origin = 'github';
    setStatus('Publicado! O site será atualizado em cerca de 1 minuto.', 'ok');
    $('#publish-result').innerHTML = `Publicado. <a href="${esc(url)}" target="_blank" rel="noopener">Ver alteração</a> · <a href="${ACTIONS_URL}" target="_blank" rel="noopener">Acompanhar atualização do site</a>`;
  } catch (err) {
    setStatus(err instanceof GitHubError ? err.message : `Falha ao publicar: ${err.message}`, 'error');
  } finally {
    btn.removeAttribute('aria-busy');
    renderAll();
  }
});

function download(name, content) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#download').addEventListener('click', () => {
  download('baterias.csv', toCsv(state.batteries, BATTERY_HEADERS));
  download('aplicacoes.csv', toCsv(state.applications, APPLICATION_HEADERS));
  download('tipos.csv', toCsv(state.types, TYPE_HEADERS));
});

$('#discard').addEventListener('click', async () => {
  if (state.dirty && !confirm('Descartar todas as alterações não publicadas e recarregar as planilhas do site?')) return;
  clearDraft();
  setStatus('Recarregando planilhas do site…');
  try {
    await load({ ignoreDraft: true });
    setStatus('Planilhas recarregadas do site.', 'ok');
  } catch (err) {
    setStatus(`Não foi possível recarregar: ${err.message}`, 'error');
  }
  renderAll();
});

/* ================= INÍCIO ================= */
if (isLogged()) start();
else showLogin();
