/**
 * Animações de interface com a biblioteca Motion (≈ poucos KB, sem framework).
 * Tudo é progressivo: sem JS ou com movimento reduzido, o conteúdo aparece normalmente.
 */
import { animate, inView, stagger } from 'motion';
import { $$ } from '../lib/dom.js';
import { prefersReducedMotion } from '../lib/env.js';

const EASE = [0.22, 1, 0.36, 1];

export function initMotion() {
  if (prefersReducedMotion()) {
    document.documentElement.classList.add('reduced-motion');
    return;
  }
  document.documentElement.classList.add('motion-ready');

  // Entrada da hero: sequência curta, um elemento por vez.
  const heroItems = $$('[data-hero-in]');
  if (heroItems.length) {
    animate(heroItems, { opacity: [0, 1], y: [18, 0] }, { duration: 0.8, delay: stagger(0.09, { startDelay: 0.15 }), ease: EASE });
  }

  // Revelação de seções ao entrar na tela (uma vez).
  inView(
    '[data-reveal]',
    (el) => {
      const kids = el.querySelectorAll(':scope > [data-reveal-item]');
      if (kids.length) {
        animate(el, { opacity: 1 }, { duration: 0.01 });
        animate(kids, { opacity: [0, 1], y: [24, 0] }, { duration: 0.7, delay: stagger(0.08), ease: EASE });
      } else {
        animate(el, { opacity: [0, 1], y: [24, 0] }, { duration: 0.75, ease: EASE });
      }
    },
    { amount: 0.18 },
  );

  // Contadores numéricos (nota e total de avaliações, números de diferenciais).
  inView(
    '[data-count]',
    (el) => {
      const target = Number(el.dataset.count);
      const decimals = Number(el.dataset.decimals || 0);
      animate(0, target, {
        duration: 1.2,
        ease: EASE,
        onUpdate: (v) => (el.textContent = v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })),
      });
    },
    { amount: 0.6 },
  );
}
