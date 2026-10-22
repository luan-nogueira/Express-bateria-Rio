import { $, $$ } from '../lib/dom.js';

/**
 * Acordeão técnico ligado ao diagrama: o item aberto (ou sob o cursor)
 * acende a parte correspondente da bateria. Só um item fica aberto por vez.
 */
export function initTechDiagram() {
  const figure = $('.tech__diagram');
  const items = $$('.tech__list details[data-point]');
  if (!figure || !items.length) return;

  const highlight = (item) => {
    items.forEach((i) => i.classList.toggle('is-active', i === item));
    if (item) figure.dataset.active = item.dataset.point;
    else delete figure.dataset.active;
  };
  const openItem = () => items.find((i) => i.open) ?? null;

  items.forEach((item) => {
    item.addEventListener('toggle', () => {
      if (item.open) items.forEach((other) => other !== item && (other.open = false));
      highlight(openItem());
    });
    item.addEventListener('pointerenter', () => highlight(item));
  });
  $('.tech__list').addEventListener('pointerleave', () => highlight(openItem()));

  highlight(openItem());
}
