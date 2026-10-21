// Entrada das páginas simples (privacidade, 404): só estilos e utilidades leves.
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/jetbrains-mono/500.css';
import './styles/main.css';
import './styles/page.css';
import { resetConsent } from './ui/consent.js';

document.documentElement.classList.add('js');
const year = document.querySelector('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());

document.querySelector('[data-reset-consent]')?.addEventListener('click', (e) => {
  resetConsent();
  e.currentTarget.textContent = 'Preferência apagada. O aviso aparecerá na próxima visita à página inicial.';
});
