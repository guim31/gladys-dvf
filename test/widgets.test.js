// -----------------------------------------------------------------------------
// The `sales` widget: valid content for the core (budget, lengths), the name
// given in Gladys, the blocks that can be hidden, the empty states.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from '../src/config.js';
import { COUNTRY, HOUSE, createApi, createWorld } from './helpers/world.js';

const get = async (world, settings = {}, language = 'fr') => {
  const ack = await world.fake.widgetGet('sales', { settings, language });
  assert.equal(ack.success, true, ack.error);
  return ack.data.content ?? ack.data;
};

const ofType = (content, type) => content.components.filter((c) => c.type === type);

test('medians, the 10 latest sales and the source, valid in every language', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  for (const language of LANGUAGES) {
    const content = await get(world, {}, language);
    assert.doesNotThrow(() => validateWidgetContent(content), language);
    assert.ok(content.components.length <= 8);
    assert.ok(ofType(content, 'text').length <= 2);
    assert.equal(ofType(content, 'value').length, 3);
    const [status] = ofType(content, 'status');
    assert.equal(status.items.length, 10);
    for (const item of status.items) {
      assert.ok(item.label.length <= 40, item.label);
      assert.ok(typeof item.value === 'string' && item.value.length <= 40, item.value);
    }
  }
  const content = await get(world);
  const [apartment, house, sales] = ofType(content, 'value');
  assert.deepEqual([apartment.value, apartment.unit], [4866, '€/m²']);
  // No median for the houses of the hyper-centre: a dash, no unit.
  assert.deepEqual([house.value, house.unit], ['–', undefined]);
  assert.equal(sales.value, 225);
  const [first] = ofType(content, 'status')[0].items;
  assert.match(first.label, /^Appartement · \d+ p\. · \d+ m²$/);
  assert.match(first.value, /^[\d ]+ € · 30\/12\/2025 · \d+ m$/);
  const caption = ofType(content, 'text').at(-1);
  assert.equal(caption.text, "DVF · jusqu'à décembre 2025 · Maison");
});

test('the blocks can be hidden; the device setting picks the zone and its name', async (t) => {
  const world = await createWorld({ houses: [COUNTRY, HOUSE] });
  t.after(() => world.app.stop());
  const bare = await get(world, { show_medians: false, show_sales: false });
  assert.deepEqual(
    bare.components.map((c) => c.type),
    ['text'],
  );
  const [, maison] = world.fake.discoveredDevices;
  await world.fake.deviceCreated({ ...maison, name: 'Chez nous' });
  const chosen = await get(world, { device: maison.external_id, show_sales: false });
  assert.equal(ofType(chosen, 'value')[2].value, 225);
  assert.equal(ofType(chosen, 'text').at(-1).text, "DVF · jusqu'à décembre 2025 · Chez nous");
  // The country house: a small commune, few sales, no flat median.
  const first = await get(world);
  assert.equal(ofType(first, 'value')[0].value, '–');
});

test('empty states: no zone, data not downloaded yet', async (t) => {
  const none = await createWorld({ houses: [] });
  t.after(() => none.app.stop());
  const empty = await get(none, {}, 'en');
  assert.match(ofType(empty, 'text')[0].text, /No zone followed yet/);

  const api = createApi();
  api.down.dvf = 503;
  const waiting = await createWorld({ api, houses: [HOUSE] });
  t.after(() => waiting.app.stop());
  const content = await get(waiting, {}, 'en');
  assert.match(ofType(content, 'text')[0].text, /being downloaded/);
  assert.doesNotThrow(() => validateWidgetContent(content));
});

test('a created device asks the widget to refresh', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const before = world.fake.widgetRefreshes.length;
  await world.createDevices();
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(world.fake.widgetRefreshes.length > before);
});
