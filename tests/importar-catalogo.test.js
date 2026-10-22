import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toBattery, toApplication } from '../scripts/importar-catalogo.mjs';
import { validateCatalog, findBatteries } from '../src/catalog/catalog.js';

const BATERIAS = `﻿id;fabricante;modelo;capacidade_ah;cca;comprimento_mm;largura_mm;altura_mm;polo_positivo;tecnologia;garantia_meses;preco;preco_atualizado_em;imagem;observacao;fonte
x-60;Fabricante X;X60D;60;480;242;175;175;Direita;Convencional;24;"1.234,50";20/10/2026;;"Obs; com ponto e vírgula";Tabela X 2026
sem-fonte;Fabricante X;X70;70;;;;;;;;;;;;
`;
const APLICACOES = `marca;modelo;ano_de;ano_ate;motorizacao;start_stop;baterias;fonte;verificado_em\r
Fiat;Argo;2017;2024;1.3;Não;x-60;Tabela X p. 12;21/10/2026\r
Fiat;Mobi;2016;2024;;;nao-existe;Tabela X p. 13;\r
`;

test('lê CSV do Excel (BOM, ";", aspas, CRLF)', () => {
  const rows = parseCsv(BATERIAS);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].observacao, 'Obs; com ponto e vírgula');
  assert.equal(rows[0].__linha, 2);
  assert.equal(parseCsv(APLICACOES)[0].motorizacao, '1.3');
});

test('converte números, datas e polaridade no formato brasileiro', () => {
  const b = toBattery(parseCsv(BATERIAS)[0]);
  assert.equal(b.capacityAh, 60);
  assert.deepEqual(b.price, { amountBRL: 1234.5, updatedAt: '2026-10-20' });
  assert.equal(b.polarity, 'direita');
  assert.deepEqual(b.dimensionsMm, { length: 242, width: 175, height: 175 });
  const a = toApplication(parseCsv(APLICACOES)[0]);
  assert.equal(a.startStop, false);
  assert.equal(a.verifiedAt, '2026-10-21');
  assert.deepEqual(a.batteryIds, ['x-60']);
});

test('linhas incompletas são recusadas; as válidas funcionam na consulta', () => {
  const raw = {
    schemaVersion: 1,
    batteries: parseCsv(BATERIAS).map(toBattery),
    applications: parseCsv(APLICACOES).map(toApplication),
  };
  const { catalog, errors } = validateCatalog(raw);
  assert.equal(catalog.batteries.length, 1);
  assert.equal(catalog.applications.length, 1);
  assert.ok(errors.some((e) => e.includes('source')));
  assert.ok(errors.some((e) => e.includes('nao-existe')));
  const r = findBatteries(catalog, { make: 'Fiat', model: 'Argo', year: 2020, engine: '1.3', startStop: 'nao' });
  assert.equal(r.status, 'match');
  assert.equal(r.batteries[0].model, 'X60D');
});

test('ida e volta: o que o painel grava (toCsv) é lido igual (parseCsv)', async () => {
  const { toCsv, BATTERY_HEADERS } = await import('../src/catalog/csv.js');
  const rows = [
    { id: 'a-1', fabricante: 'Fab; "X"', modelo: 'M\nY', capacidade_ah: '60', fonte: 'Fonte, com vírgula' },
    { id: 'b-2', fabricante: 'Ação', modelo: 'Ç', capacidade_ah: '70', fonte: 'f' },
  ];
  const back = parseCsv(toCsv(rows, BATTERY_HEADERS));
  assert.equal(back.length, 2);
  assert.equal(back[0].fabricante, 'Fab; "X"');
  assert.equal(back[0].modelo, 'M\nY');
  assert.equal(back[0].fonte, 'Fonte, com vírgula');
  assert.equal(back[1].fabricante, 'Ação');
  assert.equal(back[1].cca, '');
});
