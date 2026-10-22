import { $ } from '../lib/dom.js';

/**
 * Botão flutuante: aparece depois da hero e some quando a área de contato
 * ou o rodapé estão visíveis, para nunca cobrir os CTAs principais.
 */
export function initFloatingWhatsapp() {
  const btn = $('.wa-float');
  if (!btn) return;
  const hero = $('#inicio');
  const blockers = [$('#contato'), $('.site-footer'), $('#encontrar')].filter(Boolean);
  let heroVisible = true;
  const blocked = new Set();

  const update = () => btn.classList.toggle('is-visible', !heroVisible && blocked.size === 0);

  if (hero)
    new IntersectionObserver(([e]) => {
      heroVisible = e.isIntersecting;
      update();
    }, { threshold: 0.15 }).observe(hero);

  // Só conta a metade de baixo da tela, onde o botão fica (ignora o trecho atrás do cabeçalho).
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? blocked.add(e.target) : blocked.delete(e.target)));
    update();
  }, { rootMargin: '-50% 0px 0px 0px' });
  blockers.forEach((b) => io.observe(b));
}
