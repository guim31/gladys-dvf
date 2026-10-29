// -----------------------------------------------------------------------------
// The suggestions of 1.1: the 100 m and 200 m zones, the number and street of
// the sales (widget and scene summary), the number of sales shown in the
// widget, and the data saved by 1.0 (no address) downloaded again once.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { LANGUAGES, normalizeConfig } from '../src/config.js';
import { parseSales } from '../src/dvf.js';
import { saleRow, salesCount } from '../src/widgets.js';
import {
  HOUSE,
  TOULOUSE,
  VINTAGE,
  createApi,
  createWorld,
  dvfFile,
  dvfRow,
  fixtureText,
} from './helpers/world.js';

const isCsv = (url) => url.pathname.endsWith('.csv');
const ofType = (content, type) => content.components.filter((c) => c.type === type);

const get = async (world, settings = {}, language = 'fr') => {
  const ack = await world.fake.widgetGet('sales', { settings, language });
  assert.equal(ack.success, true, ack.error);
  return ack.data.content ?? ack.data;
};

// Invented addresses, a few metres from the house, newer than the recorded sales.
const ADDRESSED = [
  dvfRow({
    id: 'X1',
    date: '2025-12-31',
    price: 250000,
    surface: 52,
    number: '12',
    suffix: 'B',
    street: 'RUE DE L EXEMPLE',
  }),
  dvfRow({
    id: 'X1',
    date: '2025-12-31',
    price: 250000,
    surface: 52,
    number: '12',
    suffix: 'B',
    street: 'RUE DE L EXEMPLE',
  }),
  dvfRow({
    id: 'X2',
    date: '2025-12-31',
    price: 410000,
    type: 'Maison',
    surface: 95,
    street: 'ALLEE DU TRES LONG NOM DE VOIE INVENTE POUR LE TEST',
    lat: HOUSE.latitude + 0.0005,
  }),
];

/** A world whose 2025 file of Toulouse also holds the sales above. */
async function addressedWorld(config = {}) {
  const api = createApi();
  const key = `${VINTAGE}/${TOULOUSE}-2025`;
  api.files[key] = `${fixtureText(`dvf/${TOULOUSE}-2025.csv`)}${ADDRESSED.join('\n')}\n`;
  return createWorld({ api, config });
}

test('the parser keeps number, suffix and street; none without a street', () => {
  const sales = parseSales(
    dvfFile([...ADDRESSED, dvfRow({ id: 'X3', date: '2025-06-01', price: 100000, number: '4' })]),
  );
  assert.deepEqual(
    sales.map((sale) => sale[7]),
    ['12B RUE DE L EXEMPLE', 'ALLEE DU TRES LONG NOM DE VOIE INVENTE POUR LE TEST', null],
  );
});

test('100 m and 200 m are zones; the medians say how many sales they rest on', async (t) => {
  assert.equal(normalizeConfig({ radius: '100' }).radius, 100);
  assert.equal(normalizeConfig({ radius: '200' }).radius, 200);
  const wide = await createWorld({ config: { radius: '300' } });
  t.after(() => wide.app.stop());
  const narrow = await createWorld({ config: { radius: '100' } });
  t.after(() => narrow.app.stop());
  await wide.createDevices();
  await narrow.createDevices();
  assert.ok(narrow.state('sales') > 0);
  assert.ok(narrow.state('sales') < wide.state('sales'));
  const stats = narrow.monitor.resultOf(narrow.monitor.zones[0]).stats;
  for (const kind of ['apartment', 'house']) {
    // No median under 3 prices, whatever the radius.
    assert.equal(stats.current[kind] === null, stats.current[`${kind}Sales`] < 3, kind);
  }
  const content = await get(wide);
  const [apartment] = ofType(content, 'value');
  const { apartmentSales } = wide.monitor.resultOf(wide.monitor.zones[0]).stats.current;
  assert.equal(apartment.label, `Appart. €/m² (${apartmentSales})`);
});

test('the widget shows the street, cut to fit, and hides it on demand', async (t) => {
  const world = await addressedWorld();
  t.after(() => world.app.stop());
  for (const language of LANGUAGES) {
    const content = await get(world, {}, language);
    assert.doesNotThrow(() => validateWidgetContent(content), language);
    for (const item of ofType(content, 'status')[0].items) {
      assert.ok(item.label.length <= 40, item.label);
    }
  }
  const items = ofType(await get(world), 'status')[0].items;
  const labels = items.slice(0, 2).map((item) => item.label);
  assert.ok(labels.includes('12B RUE DE L EXEMPLE · Appt 52 m²'), labels.join(' | '));
  const long = labels.find((label) => label.startsWith('ALLEE'));
  assert.match(long, /^ALLEE DU TRES LONG NOM.*… · Maison 95 m²$/);
  assert.equal(long.length, 40);
  // A sale without address keeps the 1.0 row.
  assert.match(items[2].label, /^Appartement · \d+ p\. · \d+ m²$/);

  const hidden = ofType(await get(world, { show_addresses: false }), 'status')[0].items;
  assert.ok(hidden.every((item) => !item.label.includes('RUE')));
});

test('the number of sales shown: 10 by default, 1 to 10', async (t) => {
  assert.deepEqual(['', undefined, null, 'abc'].map(salesCount), [10, 10, 10, 10]);
  assert.deepEqual(['1', '3', 5, '10', '50', '0'].map(salesCount), [1, 3, 5, 10, 10, 1]);
  const world = await createWorld();
  t.after(() => world.app.stop());
  assert.equal(ofType(await get(world), 'status')[0].items.length, 10);
  assert.equal(ofType(await get(world, { sales_count: '3' }), 'status')[0].items.length, 3);
  const row = saleRow(
    { sale: ['2025-12-31', 'a', 40, 2, 200000, 0, 0, 'X'], distance: null },
    'fr',
    {
      addresses: false,
    },
  );
  assert.equal(row.label, 'Appartement · 2 p. · 40 m²');
});

test('the scene summary ends with the latest sale and its street', async (t) => {
  const world = await addressedWorld({ language: 'en' });
  t.after(() => world.app.stop());
  const ack = await world.fake.sceneAction('summary', {});
  const { summary } = ack.data.outputs ?? ack.data;
  assert.match(summary, /^Within 1 km of Maison: \d+ sales/);
  assert.match(
    summary,
    / Latest sale: (12B RUE DE L EXEMPLE, flat 52 m², 250,000 €|ALLEE .*, house 95 m², 410,000 €), on 31\/12\/2025\.$/,
  );
  // The "Check now" toast stays short: no latest sale there.
  const read = await world.fake.action('read_now');
  assert.ok(!JSON.stringify(read).includes('RUE DE L EXEMPLE'));
});

test('data saved by 1.0 (no address) are downloaded again once, then kept', async (t) => {
  const first = await createWorld();
  await first.app.stop();
  const path = join(first.dir, 'dvf.json');
  const saved = JSON.parse(readFileSync(path, 'utf8'));
  for (const commune of Object.values(saved.communes)) {
    delete commune.format;
    commune.sales = commune.sales.map((sale) => sale.slice(0, 7));
  }
  writeFileSync(path, JSON.stringify(saved));

  const api = createApi();
  const world = await createWorld({ dir: first.dir, api });
  t.after(() => world.app.stop());
  await world.monitor.idle();
  assert.ok(api.count(isCsv) > 0, 'downloaded again');
  await world.monitor.store.flush();
  const stored = JSON.parse(readFileSync(path, 'utf8'));
  assert.ok(Object.values(stored.communes).every((commune) => commune.format === 2));
  assert.equal(world.fake.sceneEvents.length, 0, 'same vintage: no trigger');
  const before = api.count(isCsv);
  await world.tick(24);
  assert.equal(api.count(isCsv), before, 'nothing more the next day');
});
