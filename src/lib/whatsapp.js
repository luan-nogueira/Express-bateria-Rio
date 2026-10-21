import { business } from '../config/business.js';

const GREETING = 'Olá! Acessei o site da Express Baterias Rio';

const clean = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 80) : '');

/** Monta o link wa.me com o texto já codificado. */
export function whatsappUrl(text) {
  const base = `https://wa.me/${business.whatsapp.number}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Mensagens fixas por ponto de contato do site. */
export const contextMessages = {
  hero: `${GREETING} e gostaria de falar com um especialista sobre bateria para o meu carro.`,
  emergency: `${GREETING}. Minha bateria arriou e preciso de atendimento.`,
  delivery: `${GREETING} e gostaria de saber sobre a entrega de bateria.`,
  install: `${GREETING} e gostaria de agendar a instalação de uma bateria.`,
  batteries: `${GREETING} e gostaria de ajuda para escolher a bateria certa para o meu veículo.`,
  support24h: `${GREETING} e preciso de atendimento agora.`,
  contact: `${GREETING} e gostaria de mais informações.`,
  floating: `${GREETING} e gostaria de atendimento.`,
};

const START_STOP_LABEL = { sim: 'sim', nao: 'não', 'nao-sei': 'não sei' };

/**
 * Mensagem contextual da consulta de bateria.
 * Só inclui os campos realmente informados pelo visitante.
 */
export function vehicleMessage(vehicle = {}, battery = null) {
  const parts = [];
  const make = clean(vehicle.make);
  const model = clean(vehicle.model);
  const year = clean(String(vehicle.year ?? ''));
  const engine = clean(vehicle.engine);

  if (make) parts.push(`Marca: ${make}.`);
  if (model) parts.push(`Modelo: ${model}.`);
  if (year) parts.push(`Ano: ${year}.`);
  if (engine && engine !== 'nao-sei') parts.push(`Motorização: ${engine}.`);
  if (vehicle.startStop && START_STOP_LABEL[vehicle.startStop]) {
    parts.push(`Start-stop: ${START_STOP_LABEL[vehicle.startStop]}.`);
  }

  if (battery) {
    const b = `${clean(battery.manufacturer)} ${clean(battery.model)}`.trim();
    return [
      `${GREETING} e tenho interesse na bateria ${b}.`,
      ...parts,
      'Poderiam confirmar a compatibilidade e me enviar um orçamento?',
    ].join(' ');
  }

  return [
    `${GREETING} e gostaria de consultar uma bateria para meu veículo.`,
    ...parts,
    'Poderiam verificar a compatibilidade e me enviar um orçamento?',
  ].join(' ');
}
