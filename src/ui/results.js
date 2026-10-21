/**
 * Renderização dos estados da consulta: carregando, resultados (showroom),
 * motorização necessária, sem aplicação confirmada e erro.
 */
import { esc, brl, dateBR, icon } from '../lib/dom.js';
import { whatsappUrl, vehicleMessage } from '../lib/whatsapp.js';
import { displayablePrice, displayableStock } from '../catalog/catalog.js';
import { business } from '../config/business.js';

const vehicleLabel = (v) =>
  [v.make, v.model, v.year, v.engine && v.engine !== 'nao-sei' ? v.engine : ''].filter(Boolean).map(esc).join(' · ');

const waButton = (href, label, location, variant = 'primary') => `
  <a class="btn btn--${variant}" href="${esc(href)}" target="_blank" rel="noopener"
     data-track="whatsapp_click" data-track-location="${esc(location)}">
    ${icon('whatsapp')}<span>${esc(label)}</span>
  </a>`;

export function renderLoading(el) {
  el.innerHTML = `
    <div class="results-loading" role="status">
      <span class="visually-hidden">Consultando o catálogo…</span>
      ${'<div class="skeleton-card"><span></span><span></span><span></span></div>'.repeat(3)}
    </div>`;
}

export function renderNoMatch(el, vehicle) {
  // Veículo sem aplicação cadastrada: o próximo passo é a confirmação humana (nunca um palpite).
  const car = [vehicle.make, vehicle.model].filter(Boolean).map(esc).join(' ');
  el.innerHTML = `
    <div class="result-panel result-panel--fallback" tabindex="-1">
      <p class="tag tag--signal">${icon('shield')} Próximo passo</p>
      <h3 class="result-panel__title">Vamos confirmar a bateria ideal para o seu ${car}.</h3>
      <p class="result-panel__vehicle">${vehicleLabel(vehicle)}</p>
      <p>Um especialista confere capacidade, tecnologia e polaridade para o seu veículo e envia o orçamento
         pelo WhatsApp. Atendimento 24 horas, com entrega e instalação grátis.</p>
      <div class="result-panel__actions">
        ${waButton(whatsappUrl(vehicleMessage(vehicle)), 'Consultar com um especialista', 'busca-sem-resultado')}
        <a class="btn btn--ghost" href="tel:${business.phone.e164}" data-track="phone_click" data-track-location="busca-sem-resultado">
          ${icon('phone')}<span>Ligar ${esc(business.phone.display)}</span>
        </a>
      </div>
      <p class="result-panel__fine">Os dados do veículo seguem preenchidos na mensagem. Nada é enviado até você tocar em “enviar” no WhatsApp.</p>
    </div>`;
}

export function renderError(el, vehicle, onRetry) {
  el.innerHTML = `
    <div class="result-panel result-panel--error" role="alert" tabindex="-1">
      <p class="tag tag--alert">${icon('alert')} Falha na consulta</p>
      <h3 class="result-panel__title">Não foi possível consultar o catálogo agora.</h3>
      <p>Você pode tentar de novo ou falar diretamente com a equipe — o atendimento é 24 horas.</p>
      <div class="result-panel__actions">
        ${waButton(whatsappUrl(vehicleMessage(vehicle)), 'Falar com um especialista', 'busca-erro')}
        <button type="button" class="btn btn--ghost" data-retry>${icon('refresh')}<span>Tentar novamente</span></button>
      </div>
    </div>`;
  el.querySelector('[data-retry]').addEventListener('click', onRetry);
}

export function renderNeedsEngine(el, vehicle, engines, onPick) {
  el.innerHTML = `
    <div class="result-panel" tabindex="-1">
      <p class="tag">${icon('gauge')} Mais de uma aplicação</p>
      <h3 class="result-panel__title">A bateria varia conforme a motorização.</h3>
      <p class="result-panel__vehicle">${vehicleLabel(vehicle)}</p>
      <p>Escolha a motorização do seu veículo:</p>
      <div class="chip-row">
        ${engines.map((e) => `<button type="button" class="chip" data-engine="${esc(e)}">${esc(e)}</button>`).join('')}
        <button type="button" class="chip chip--muted" data-engine="nao-sei">Não sei</button>
      </div>
    </div>`;
  el.querySelectorAll('[data-engine]').forEach((b) => b.addEventListener('click', () => onPick(b.dataset.engine)));
}

function specRows(b) {
  const rows = [];
  if (b.cca) rows.push(['CCA', `${b.cca} A`]);
  if (b.technology) rows.push(['Tecnologia', b.technology]);
  if (b.polarity) rows.push(['Polo positivo', b.polarity === 'direita' ? 'À direita' : b.polarity === 'esquerda' ? 'À esquerda' : b.polarity]);
  if (b.dimensionsMm) {
    const d = b.dimensionsMm;
    rows.push(['Dimensões', `${d.length} × ${d.width} × ${d.height} mm`]);
  }
  return rows;
}

function cardMedia(b) {
  if (b.image?.src) {
    return `<img src="${esc(b.image.src)}" alt="${esc(b.image.alt || `${b.manufacturer} ${b.model}`)}"
             width="${Number(b.image.width) || 600}" height="${Number(b.image.height) || 600}" loading="lazy" decoding="async">`;
  }
  return `<div class="product-card__noimg" role="img" aria-label="Imagem do produto não cadastrada">${icon('battery', 'icon icon--xl')}<span>Imagem não cadastrada</span></div>`;
}

function commercial(b) {
  const out = [];
  const price = displayablePrice(b);
  if (price !== null) out.push(`<p class="product-card__price">${brl(price)} <small>atualizado em ${esc(dateBR(b.price.updatedAt))}</small></p>`);
  const stock = displayableStock(b);
  if (stock !== null) out.push(`<p class="product-card__stock ${stock ? 'is-in' : 'is-out'}">${stock ? 'Disponível' : 'Indisponível no momento'}</p>`);
  if (b.warrantyMonths) out.push(`<p class="product-card__warranty">${icon('shield')} Garantia de ${b.warrantyMonths} meses</p>`);
  return out.join('');
}

export function renderMatch(el, { vehicle, batteries, notes, catalog, isTest }, openDetail) {
  const count = batteries.length;
  el.innerHTML = `
    ${isTest ? '<p class="test-banner" role="note">DADOS FICTÍCIOS DE TESTE — modo de desenvolvimento</p>' : ''}
    <div class="results-head" tabindex="-1">
      <div>
        <p class="tag tag--ok">${icon('check')} Aplicação cadastrada</p>
        <h3 class="results-head__title">${count} ${count === 1 ? 'opção compatível' : 'opções compatíveis'}</h3>
        <p class="result-panel__vehicle">${vehicleLabel(vehicle)}</p>
      </div>
      ${waButton(whatsappUrl(vehicleMessage(vehicle)), 'Confirmar com especialista', 'resultados', 'ghost')}
    </div>
    ${notes.map((n) => `<p class="note">${icon('alert')} ${esc(n)}</p>`).join('')}
    <ul class="product-grid" role="list">
      ${batteries
        .map(
          (b, i) => `
        <li class="product-card" style="--i:${i}">
          <div class="product-card__media">${cardMedia(b)}</div>
          <div class="product-card__body">
            <p class="product-card__brand">${esc(b.manufacturer)}</p>
            <h4 class="product-card__model">${esc(b.model)}</h4>
            <p class="product-card__ah"><strong>${esc(b.capacityAh)}</strong><span>Ah</span></p>
            <dl class="spec-list">
              ${specRows(b).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
            </dl>
            ${commercial(b)}
            <div class="product-card__actions">
              ${waButton(whatsappUrl(vehicleMessage(vehicle, b)), 'Solicitar orçamento', 'produto-card')}
              <button type="button" class="btn btn--text" data-detail="${esc(b.id)}">Ver detalhes</button>
            </div>
          </div>
        </li>`,
        )
        .join('')}
    </ul>
    <p class="results-source">Fonte: ${esc(catalog.source || 'catálogo da loja')}${catalog.updatedAt ? ` · atualizado em ${esc(dateBR(catalog.updatedAt))}` : ''}.
      Preço e disponibilidade são confirmados no atendimento.</p>`;

  el.querySelectorAll('[data-detail]').forEach((btn) =>
    btn.addEventListener('click', () => openDetail(batteries.find((b) => b.id === btn.dataset.detail), vehicle)),
  );
}

/** Painel de detalhes do produto (elemento <dialog> nativo: foco e Esc acessíveis). */
export function openProductDialog(dialog, battery, vehicle) {
  const rows = [['Capacidade', `${battery.capacityAh} Ah`], ...specRows(battery)];
  if (battery.warrantyMonths) rows.push(['Garantia', `${battery.warrantyMonths} meses`]);
  dialog.querySelector('[data-dialog-body]').innerHTML = `
    <div class="dialog-media">${cardMedia(battery)}</div>
    <div class="dialog-info">
      <p class="product-card__brand">${esc(battery.manufacturer)}</p>
      <h3 id="product-dialog-title" class="dialog-title">${esc(battery.model)}</h3>
      ${battery.applicationNote ? `<p>${esc(battery.applicationNote)}</p>` : ''}
      <dl class="spec-list spec-list--wide">
        ${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
      </dl>
      ${commercial(battery)}
      <p class="results-source">Fonte dos dados técnicos: ${esc(battery.source)}</p>
      ${waButton(whatsappUrl(vehicleMessage(vehicle, battery)), 'Solicitar orçamento desta bateria', 'produto-detalhe')}
    </div>`;
  dialog.showModal();
}
