import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validateCatalog,
  findBatteries,
  enginesFor,
  displayablePrice,
  displayableStock,
  normalize,
} from '../src/catalog/catalog.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/catalog.test.json', import.meta.url)));
const production = JSON.parse(readFileSync(new URL('../public/data/catalog.json', import.meta.url)));
const { catalog } = validateCatalog(fixture);

test('catálogo de produção é válido e não contém produtos inventados', () => {
  const r = validateCatalog(production);
  assert.equal(r.ok, true, r.errors.join('\n'));
  assert.equal(r.catalog.batteries.length, 0);
  assert.equal(r.catalog.applications.length, 0);
});

test('catálogo vazio: qualquer veículo cai em validação humana', () => {
  const r = findBatteries(validateCatalog(production).catalog, { make: 'Fiat', model: 'Argo', year: 2020 });
  assert.equal(r.status, 'no-match');
  assert.equal(r.batteries.length, 0);
});

test('aplicação com bateria inexistente é descartada na validação', () => {
  const r = validateCatalog(fixture);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('inexistente')));
  assert.equal(r.catalog.applications.length, 3);
  const jeep = findBatteries(r.catalog, { make: 'Jeep', model: 'Renegade', year: 2020 });
  assert.equal(jeep.status, 'no-match');
});

test('bateria sem fonte é rejeitada', () => {
  const r = validateCatalog({
    schemaVersion: 1,
    batteries: [{ id: 'x', manufacturer: 'A', model: 'B', capacityAh: 60 }],
    applications: [],
  });
  assert.equal(r.catalog.batteries.length, 0);
  assert.ok(r.errors.some((e) => e.includes('source')));
});

test('várias motorizações: pede a motorização em vez de escolher', () => {
  const r = findBatteries(catalog, { make: 'Fiat', model: 'Argo', year: 2020 });
  assert.equal(r.status, 'needs-engine');
  assert.deepEqual(r.engines, ['1.0', '1.3']);
});

test('motorização informada retorna a aplicação correta', () => {
  const r = findBatteries(catalog, { make: 'fiat', model: 'ARGO', year: '2020', engine: '1.0' });
  assert.equal(r.status, 'match');
  assert.deepEqual(r.batteries.map((b) => b.id), ['teste-60']);
});

test('start-stop separa as aplicações quando o cadastro distingue', () => {
  const sim = findBatteries(catalog, { make: 'Fiat', model: 'Argo', year: 2020, engine: '1.3', startStop: 'sim' });
  assert.deepEqual(sim.batteries.map((b) => b.id), ['teste-70-efb']);
  const nao = findBatteries(catalog, { make: 'Fiat', model: 'Argo', year: 2020, engine: '1.3', startStop: 'nao' });
  assert.deepEqual(nao.batteries.map((b) => b.id), ['teste-60']);
  const naoSei = findBatteries(catalog, { make: 'Fiat', model: 'Argo', year: 2020, engine: '1.3', startStop: 'nao-sei' });
  assert.equal(naoSei.batteries.length, 2);
  assert.ok(naoSei.notes.some((n) => n.includes('start-stop')));
});

test('ano fora da faixa cadastrada não retorna resultado', () => {
  const r = findBatteries(catalog, { make: 'Fiat', model: 'Argo', year: 2010, engine: '1.0' });
  assert.equal(r.status, 'no-match');
});

test('enginesFor lista motorizações sem duplicar', () => {
  assert.deepEqual(enginesFor(catalog, { make: 'Fiat', model: 'Argo', year: 2018 }), ['1.0', '1.3']);
});

test('preço desatualizado não é exibido', () => {
  const now = new Date('2026-10-21').getTime();
  assert.equal(displayablePrice(catalog.batteries[0], now), 499.9);
  assert.equal(displayablePrice(catalog.batteries[1], now), null);
  assert.equal(displayableStock(catalog.batteries[0], now), null);
});

test('normalize remove acentos e caixa', () => {
  assert.equal(normalize('  Citroën C3 '), 'citroen c3');
});
