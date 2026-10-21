/**
 * Eventos de conversão. Só têm efeito se o Google Tag Manager estiver
 * configurado (VITE_GTM_ID) e o visitante tiver aceitado os cookies.
 * Nenhum dado pessoal é enviado: apenas o nome do evento e o ponto do site.
 */
export function track(event, params = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}

/** Delegação: qualquer link com data-track gera um evento ao ser clicado. */
export function initTracking() {
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('[data-track]');
    if (!a) return;
    track(a.dataset.track, { location: a.dataset.trackLocation || 'desconhecido' });
  });
}
