/**
 * Gera as credenciais do painel administrativo (src/admin/credentials.js).
 *
 * Uso:  node scripts/admin-senha.mjs <email> <senha>
 *
 * Grava apenas um hash PBKDF2-SHA256 (com sal aleatório) de e-mail + senha.
 * Nem o e-mail nem a senha ficam no código. Para trocar a senha, rode de novo.
 */
import { webcrypto as crypto } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Uso: node scripts/admin-senha.mjs <email> <senha>');
  process.exit(1);
}

const ITERATIONS = 310_000;
const salt = crypto.getRandomValues(new Uint8Array(16));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

const key = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(`${email.trim().toLowerCase()}\n${password}`),
  'PBKDF2',
  false,
  ['deriveBits'],
);
const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);

const out = `// Gerado por scripts/admin-senha.mjs — não edite à mão.
// Contém só um hash de e-mail + senha (PBKDF2-SHA256); as credenciais em si não ficam no código.
export const credentials = {
  iterations: ${ITERATIONS},
  salt: '${hex(salt)}',
  hash: '${hex(bits)}',
};
`;
writeFileSync(fileURLToPath(new URL('../src/admin/credentials.js', import.meta.url)), out);
console.log('Credenciais do painel atualizadas em src/admin/credentials.js');
