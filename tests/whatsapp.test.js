import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whatsappUrl, vehicleMessage, contextMessages } from '../src/lib/whatsapp.js';

test('link usa o número comercial correto', () => {
  assert.equal(whatsappUrl(), 'https://wa.me/5521999404005');
});

test('mensagem do veículo segue o modelo do briefing', () => {
  const msg = vehicleMessage({ make: 'Fiat', model: 'Argo', year: 2020, engine: '1.3' });
  assert.equal(
    msg,
    'Olá! Acessei o site da Express Baterias Rio e gostaria de consultar uma bateria para meu veículo. ' +
      'Marca: Fiat. Modelo: Argo. Ano: 2020. Motorização: 1.3. ' +
      'Poderiam verificar a compatibilidade e me enviar um orçamento?',
  );
});

test('campos não informados não aparecem na mensagem', () => {
  const msg = vehicleMessage({ make: 'Jeep', model: 'Compass', year: 2022, engine: 'nao-sei' });
  assert.ok(!msg.includes('Motorização'));
  assert.ok(!msg.includes('undefined'));
});

test('parâmetros são codificados na URL', () => {
  const url = whatsappUrl(vehicleMessage({ make: 'Citroën', model: 'C4 Cactus & Co', year: 2021 }));
  const u = new URL(url);
  assert.equal(u.hostname, 'wa.me');
  assert.ok(!url.includes(' '));
  assert.ok(!url.includes('&Co'));
  assert.ok(u.searchParams.get('text').includes('Marca: Citroën. Modelo: C4 Cactus & Co.'));
});

test('mensagem com bateria escolhida cita o produto', () => {
  const msg = vehicleMessage({ make: 'Fiat', model: 'Argo', year: 2020 }, { manufacturer: 'X', model: 'Y 60' });
  assert.ok(msg.startsWith('Olá! Acessei o site da Express Baterias Rio e tenho interesse na bateria X Y 60.'));
});

test('entrada muito longa é truncada', () => {
  const msg = vehicleMessage({ make: 'A'.repeat(500), model: 'B', year: 2020 });
  assert.ok(msg.length < 400);
});

test('todas as mensagens fixas existem', () => {
  for (const [k, v] of Object.entries(contextMessages)) assert.ok(v.length > 20, k);
});
