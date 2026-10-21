import { $, $$ } from '../lib/dom.js';

/** Liga cada item da lista técnica à parte correspondente do diagrama. */
export function initTechDiagram() {
  const figure = $('.tech__diagram');
  const items = $$('.tech__list [data-point]');
  if (!figure || !items.length) return;

  const activate = (li) => {
    items.forEach((i) => i.classList.toggle('is-active', i === li));
    if (li) figure.dataset.active = li.dataset.point;
    else delete figure.dataset.active;
  };

  items.forEach((li) => {
    li.addEventListener('pointerenter', () => activate(li));
    li.addEventListener('focus', () => activate(li));
    li.addEventListener('click', () => activate(li));
  });
  $('.tech__list').addEventListener('pointerleave', () => activate(null));
  $('.tech__list').addEventListener('focusout', (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) activate(null);
  });
}
