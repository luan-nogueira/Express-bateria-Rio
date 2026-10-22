/**
 * Decide entre a cena 3D e a ilustração estática (SVG já presente no HTML).
 *
 * A ilustração é renderizada no HTML e serve de imagem imediata (LCP rápido)
 * e de alternativa permanente quando:
 *  - não há WebGL;
 *  - o usuário economiza dados ou o aparelho é muito limitado;
 *  - a cena falha ao carregar.
 * Com prefers-reduced-motion a cena 3D é exibida parada (um único quadro).
 */
import { prefersReducedMotion, debugFlag } from '../lib/env.js';

function hasWebGL() {
  if (debugFlag('webgl') === '0') return false;
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function isConstrained() {
  if (debugFlag('3d') === '0') return true;
  const nav = navigator;
  if (nav.connection?.saveData) return true;
  if (nav.deviceMemory && nav.deviceMemory <= 2) return true;
  if (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2) return true;
  return false;
}

const idle = (cb) =>
  'requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 1500 }) : setTimeout(cb, 300);

export function initHeroVisual() {
  const stageEl = document.querySelector('[data-hero-stage]');
  if (!stageEl) return;

  if (!hasWebGL() || isConstrained()) {
    stageEl.dataset.mode = 'static';
    return;
  }

  const narrow = matchMedia('(max-width: 760px)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;

  const boot = async () => {
    try {
      const { mountBatteryScene } = await import('../three/batteryScene.js');
      await mountBatteryScene(stageEl.querySelector('[data-hero-canvas]'), {
        reducedMotion: prefersReducedMotion(),
        quality: narrow ? 'low' : 'high',
        interactive: finePointer && !narrow,
        initialYaw: Number(debugFlag('yaw')) || 0,
      });
      stageEl.dataset.mode = '3d';
    } catch (err) {
      console.warn('[hero] cena 3D indisponível, mantendo ilustração estática.', err);
      stageEl.dataset.mode = 'static';
    }
  };

  // Carrega a cena depois que a página estiver pronta para não competir com o conteúdo.
  if (document.readyState === 'complete') idle(boot);
  else window.addEventListener('load', () => idle(boot), { once: true });
}
