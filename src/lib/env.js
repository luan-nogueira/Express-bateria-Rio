/**
 * Preferências do ambiente.
 *
 * Em desenvolvimento (`npm run dev`) é possível simular condições pela URL:
 *   ?movimento=reduzido   → prefers-reduced-motion
 *   ?webgl=0              → navegador sem WebGL
 *   ?3d=0                 → aparelho limitado (usa a ilustração estática)
 * Esses parâmetros não têm efeito no build de produção.
 */
export function debugFlag(name) {
  if (!import.meta.env.DEV) return null;
  return new URLSearchParams(location.search).get(name);
}

export function prefersReducedMotion() {
  if (debugFlag('movimento') === 'reduzido') return true;
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}
