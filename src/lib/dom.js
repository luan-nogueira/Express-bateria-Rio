/** Escapa texto para inserção segura em HTML (dados do catálogo nunca viram markup). */
export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const dateBR = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ícone do sprite SVG embutido no index.html. */
export const icon = (name, cls = 'icon') =>
  `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
