import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/jetbrains-mono/500.css';
import './styles/main.css';

import { initHeader } from './ui/header.js';
import { initMotion } from './ui/motion.js';
import { initHeroVisual } from './hero/heroVisual.js';
import { initConfigurator } from './ui/configurator.js';
import { initFloatingWhatsapp } from './ui/floatingWhatsapp.js';
import { initConsent } from './ui/consent.js';
import { initTracking } from './lib/analytics.js';
import { initTechDiagram } from './ui/techDiagram.js';

document.documentElement.classList.add('js');

initHeader();
initMotion();
initConfigurator();
initTechDiagram();
initFloatingWhatsapp();
initTracking();
initConsent();
initHeroVisual();

const year = document.querySelector('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());
