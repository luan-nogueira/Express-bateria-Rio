import { $, $$ } from '../lib/dom.js';

/** Cabeçalho: estado ao rolar, menu mobile acessível e link ativo por seção. */
export function initHeader() {
  const header = $('.site-header');
  const toggle = $('.nav-toggle');
  const panel = $('#mobile-nav');
  if (!header) return;

  // Fundo sólido após sair do topo (sentinela evita listener de scroll).
  const sentinel = $('#top-sentinel');
  if (sentinel) {
    new IntersectionObserver(([e]) => header.classList.toggle('is-scrolled', !e.isIntersecting)).observe(sentinel);
  }

  // Menu mobile.
  if (toggle && panel) {
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
      panel.hidden = !open;
      document.body.classList.toggle('nav-open', open);
      if (open) panel.querySelector('a')?.focus();
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    panel.addEventListener('click', (e) => {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });
    matchMedia('(min-width: 1024px)').addEventListener('change', (m) => m.matches && setOpen(false));
  }

  // Link ativo conforme a seção visível.
  const links = $$('.nav-desktop a[href^="#"]');
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const sections = [...map.keys()].map((id) => document.getElementById(id)).filter(Boolean);
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.removeAttribute('aria-current'));
        map.get(e.target.id)?.setAttribute('aria-current', 'true');
      });
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  sections.forEach((s) => io.observe(s));
}
