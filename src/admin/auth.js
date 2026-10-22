/**
 * Login do painel. Compara um hash PBKDF2 de e-mail + senha com o gerado
 * por scripts/admin-senha.mjs.
 *
 * Atenção: num site estático esta verificação acontece no navegador. Ela
 * esconde o painel, mas quem protege os dados de verdade é o token do
 * GitHub, exigido para publicar (ver github.js).
 */
import { credentials } from './credentials.js';

const SESSION_KEY = 'ebr-admin-session';
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));

export async function verify(email, password) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`${String(email).trim().toLowerCase()}\n${password}`),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(credentials.salt), iterations: credentials.iterations },
    key,
    256,
  );
  // Comparação em tempo constante.
  const a = hex(bits);
  const b = credentials.hash;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const marker = () => credentials.hash.slice(0, 24);

export function isLogged() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === marker();
  } catch {
    return false;
  }
}

export function setLogged(on) {
  try {
    if (on) sessionStorage.setItem(SESSION_KEY, marker());
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* navegação privada: vale só enquanto a página estiver aberta */
  }
}
