/**
 * Consentimento de cookies (LGPD) + Google Tag Manager.
 *
 * Só é ativado se VITE_GTM_ID estiver definido no build. Sem ID, nenhum
 * script de terceiros é carregado e o aviso de cookies não aparece.
 * O GTM só é carregado depois que o visitante aceita.
 */
import { $ } from '../lib/dom.js';

const KEY = 'ebr-consent-v1';
const GTM_ID = import.meta.env.VITE_GTM_ID;

const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const write = (v) => {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* navegação privada: vale só para esta visita */
  }
};

function loadGtm() {
  if (!GTM_ID || window.__gtmLoaded) return;
  window.__gtmLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`;
  document.head.appendChild(s);
}

export function initConsent() {
  if (!GTM_ID) return;
  const choice = read();
  if (choice === 'accepted') return loadGtm();
  if (choice === 'declined') return;

  const bar = $('#consent');
  if (!bar) return;
  bar.hidden = false;
  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-consent]');
    if (!btn) return;
    const accepted = btn.dataset.consent === 'accept';
    write(accepted ? 'accepted' : 'declined');
    bar.hidden = true;
    if (accepted) loadGtm();
  });
}

/** Permite rever a escolha (link na política de privacidade). */
export function resetConsent() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
