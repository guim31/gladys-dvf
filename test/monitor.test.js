// -----------------------------------------------------------------------------
// The monitor end to end, on the fake Gladys and the recorded DVF files: zones,
// states, daily cadence, heartbeat, new vintage and its trigger, failures.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  CHALET,
  COUNTRY,
  DAY,
  HOUR,
  HOUSE,
  NEXT_VINTAGE,
  TOULOUSE,
  VIGOULET,
  createApi,
  captureLogs,
  createWorld,
  dvfFile,
  dvfRow,
  fixtureText,
} from './helpers/world.js';

const isIndex = (url) => url.pathname === '/geo-dvf/';
const isCsv = (url) => url.pathname.endsWith('.csv');

test('a house: one zone of 1 km around it, its states once the device is created', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const [device] = world.fake.discoveredDevices;
  assert.equal(world.fake.discoveredDevices.length, 1);
  assert.equal(device.name, 'Ventes immobilières (Maison)');
  assert.equal(device.external_id, 'ext:test-integration:zone:house-maison');
  assert.deepEqual(device.params, [
    { name: 'COMMUNES', value: TOULOUSE },
    { name: 'RADIUS_M', value: '1000' },
  ]);
  assert.deepEqual(world.fake.connectionStatus, { connected: true });
  // Nothing is published for a device not created yet.
  assert.equal(world.fake.states.length, 0);

  await world.createDevices();
  // The recorded sales are those within 500 m of the Capitole: all within 1 km.
  assert.equal(world.state('sales'), 225);
  assert.equal(world.state('sales_previous'), 175);
  assert.equal(world.state('apartment'), 4844);
  assert.equal(world.state('apartment_previous'), 4686);
  // The hyper-centre sold fewer than 3 houses: no median, no state.
  assert.equal(world.state('house'), undefined);
  assert.equal(world.state('house_previous'), undefined);
  assert.equal(world.state('last_sale'), '30/12/2025');
  assert.equal(world.state('vintage'), 'décembre 2025');
});

test('the radius narrows the zone, "commune" takes all of it', async (t) => {
  const near = await createWorld({ config: { radius: '300' } });
  t.after(() => near.app.stop());
  await near.createDevices();
  const commune = await createWorld({ config: { radius: 'commune' } });
  t.after(() => commune.app.stop());
  await commune.createDevices();
  assert.ok(near.state('sales') < 225, `${near.state('sales')} sales within 300 m`);
  assert.ok(near.state('sales') > 0);
  assert.equal(commune.state('sales'), 225);
  assert.deepEqual(commune.fake.discoveredDevices[0].params, [
    { name: 'COMMUNES', value: TOULOUSE },
  ]);
});

test('every located house is a zone; a chosen house alone', async (t) => {
  const all = await createWorld({ houses: [COUNTRY, CHALET, HOUSE] });
  t.after(() => all.app.stop());
  assert.deepEqual(
    all.fake.discoveredDevices.map((device) => device.name),
    ['Ventes immobilières (Campagne)', 'Ventes immobilières (Maison)'],
  );
  // The circle of 1 km around the country house crosses no other recorded commune.
  assert.equal(all.fake.discoveredDevices[0].params[0].value, VIGOULET);

  const one = await createWorld({ houses: [COUNTRY, HOUSE], config: { house: 'maison' } });
  t.after(() => one.app.stop());
  assert.deepEqual(
    one.fake.discoveredDevices.map((device) => device.name),
    ['Ventes immobilières (Maison)'],
  );
});

test('a small commune by its INSEE code: few sales, no median under 3', async (t) => {
  const world = await createWorld({ config: { position: 'commune', commune: VIGOULET } });
  t.after(() => world.app.stop());
  const [device] = world.fake.discoveredDevices;
  assert.equal(device.name, 'Ventes immobilières (Vigoulet-Auzil)');
  assert.equal(device.external_id, `ext:test-integration:zone:${VIGOULET}`);
  await world.createDevices();
  assert.equal(world.state('sales'), 13);
  assert.equal(world.state('house'), 3756);
  // Two flats sold in 12 months: no median published.
  assert.equal(world.state('apartment'), undefined);
});

test('Paris by its INSEE code reads the files of its 20 districts', async (t) => {
  const world = await createWorld({ config: { position: 'commune', commune: '75056' } });
  t.after(() => world.app.stop());
  const codes = world.fake.discoveredDevices[0].params[0].value.split(',');
  assert.equal(codes.length, 20);
  assert.equal(codes[0], '75101');
  assert.equal(codes[19], '75120');
  // No file recorded for Paris: no sale, but the vintage is known.
  await world.createDevices();
  assert.equal(world.state('sales'), 0);
  assert.equal(world.state('vintage'), 'décembre 2025');
});

test('configuration problems are shown in the four languages', async (t) => {
  const cases = [
    [{ position: 'commune', commune: '57463' }, [HOUSE], /Metz: no DVF data in Alsace-Moselle/],
    [{ position: 'commune', commune: '31000' }, [HOUSE], /not an INSEE code|No commune/],
    [{ position: 'commune', commune: 'Toulouse' }, [HOUSE], /"Toulouse" is not an INSEE code/],
    [{ position: 'commune' }, [HOUSE], /Type the INSEE code/],
    [{}, [CHALET], /No house of Gladys has a location/],
    [{ house: 'chalet' }, [CHALET], /The house "Chalet" no longer exists/],
    [{}, [{ ...HOUSE, latitude: 40.4, longitude: -3.7 }], /not in a French commune/],
  ];
  for (const [config, houses, message] of cases) {
    const world = await createWorld({ config, houses });
    t.after(() => world.app.stop());
    const status = world.fake.connectionStatus;
    assert.equal(status.connected, false, JSON.stringify(config));
    assert.match(status.message.en, message);
    assert.deepEqual(Object.keys(status.message).sort(), ['de', 'en', 'es', 'fr']);
    assert.deepEqual(world.fake.discoveredDevices, []);
  }
});

test('the index is read once a day, the files only for a new vintage', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await world.createDevices();
  assert.equal(world.api.count(isIndex), 1);
  // Two years (2024, 2025) of one commune.
  assert.equal(world.api.count(isCsv), 2);
  await world.tick(23);
  assert.equal(world.api.count(isIndex), 1);
  await world.tick(1);
  assert.equal(world.api.count(isIndex), 2);
  assert.equal(world.api.count(isCsv), 2, 'same vintage: nothing downloaded again');
});

test('the container republishes the states itself, with a heartbeat, without onPoll', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await world.createDevices();
  const count = () => world.fake.states.length;
  const first = count();
  // The SDK dates the published values with the real clock: mock it too.
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
  const hours = async (n) => {
    for (let hour = 0; hour < n; hour += 1) {
      t.mock.timers.tick(HOUR);
      await world.tick(1);
    }
  };
  await hours(6);
  assert.equal(count(), first, 'unchanged values are not published again within 12 h');
  await hours(7);
  assert.equal(count(), first * 2, 'the heartbeat republishes every value after 12 h');
});

test('a new vintage downloads the files again and fires new_sales with the count', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await world.createDevices();
  assert.deepEqual(world.fake.sceneEvents, []);

  const newSales = [
    dvfRow({ id: '2026-1', date: '2026-02-10', price: 250000, surface: 50 }),
    dvfRow({ id: '2026-2', date: '2026-03-05', price: 600000, type: 'Maison', surface: 120 }),
    // 3 km away: outside the 1 km zone.
    dvfRow({ id: '2026-3', date: '2026-04-01', price: 200000, lat: 43.6045, lon: 1.481 }),
  ];
  world.api.files[`${NEXT_VINTAGE}/${TOULOUSE}-2026`] = dvfFile(newSales);
  world.api.publish(NEXT_VINTAGE);
  await world.tick(24);

  // The 2026-06 vintage spans 2024 to 2026.
  assert.equal(world.api.count(isCsv), 5);
  assert.equal(world.fake.sceneEvents.length, 1);
  const [event] = world.fake.sceneEvents;
  assert.equal(event.key, 'new_sales');
  assert.equal(event.data.count, 2);
  assert.equal(event.data.device, world.fake.discoveredDevices[0].external_id);
  assert.equal(event.data.vintage, 'juin 2026');
  assert.match(event.data.summary, /^À 1 km de Maison : \d+ ventes/);
  assert.equal(world.state('vintage'), 'juin 2026');
  assert.equal(world.state('last_sale'), '05/03/2026');

  // The same vintage the next day fires nothing more.
  await world.tick(24);
  assert.equal(world.fake.sceneEvents.length, 1);
});

test('a changed zone takes a new baseline at once; the next vintage counts against it', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await world.fake.configUpdated({ position: 'house', radius: '500', language: 'fr' });
  await world.monitor.idle();
  // The first vintage seen, then a zone changed with its communes already here: no event.
  assert.equal(world.fake.sceneEvents.length, 0);
  world.api.files[`${NEXT_VINTAGE}/${TOULOUSE}-2026`] = dvfFile([
    dvfRow({ id: '2026-1', date: '2026-02-10', price: 250000 }),
    // 800 m away: outside the new 500 m zone.
    dvfRow({ id: '2026-2', date: '2026-02-11', price: 250000, lat: 43.6117 }),
  ]);
  world.api.publish(NEXT_VINTAGE);
  await world.tick(24);
  assert.equal(world.fake.sceneEvents.length, 1);
  assert.equal(world.fake.sceneEvents[0].data.count, 1);
});

test('a new vintage listed before its files: the previous one is kept whole, retried', async (t) => {
  const api = createApi();
  // Two districts of Paris had sales; the new vintage has the file of the first only.
  const sale = (id) => dvfRow({ id, date: '2025-06-01', price: 500000, commune: '75101' });
  api.files['2025-12/75101-2025'] = dvfFile([sale('a'), sale('b'), sale('c')]);
  api.files['2025-12/75102-2025'] = dvfFile([sale('d')]);
  const paris = await createWorld({
    api,
    houses: [],
    config: { position: 'commune', commune: '75056' },
  });
  t.after(() => paris.app.stop());
  await paris.createDevices();
  assert.equal(paris.state('sales'), 4);
  api.publish(NEXT_VINTAGE);
  api.files[`${NEXT_VINTAGE}/75101-2025`] = api.files['2025-12/75101-2025'];
  api.files[`${NEXT_VINTAGE}/75101-2026`] = dvfFile([
    dvfRow({ id: 'e', date: '2026-03-01', price: 500000, commune: '75101' }),
  ]);
  await paris.tick(24);
  assert.equal(paris.state('vintage'), 'décembre 2025', 'not half of 2026-06');
  assert.equal(paris.state('sales'), 4);
  assert.deepEqual(paris.fake.sceneEvents, []);
  // The missing file arrives: the whole vintage is taken, the trigger fires.
  api.files[`${NEXT_VINTAGE}/75102-2025`] = api.files['2025-12/75102-2025'];
  await paris.tick(1);
  assert.equal(paris.state('vintage'), 'juin 2026');
  assert.equal(paris.fake.sceneEvents.length, 1);
  assert.equal(paris.fake.sceneEvents[0].data.count, 1);
});

test('zones unknown for a while: the files and the baselines are kept', async (t) => {
  const api = createApi();
  const world = await createWorld({ api });
  t.after(() => world.app.stop());
  // The house lost its location: no zone, a status, and a full daily check.
  world.fake.houses = [CHALET];
  await world.tick(25);
  assert.equal(world.fake.connectionStatus.connected, false);
  await world.app.stop();
  const saved = JSON.parse(await readFile(join(world.dir, 'dvf.json'), 'utf8'));
  assert.deepEqual(Object.keys(saved.communes), [TOULOUSE]);
  assert.deepEqual(Object.keys(saved.zones), ['house-maison']);
});

test('the store survives a restart: no download again, the trigger baseline kept', async (t) => {
  const api = createApi();
  const first = await createWorld({ api });
  await first.app.stop();
  const saved = JSON.parse(await readFile(join(first.dir, 'dvf.json'), 'utf8'));
  assert.equal(saved.vintage, '2025-12');
  assert.deepEqual(Object.keys(saved.communes), [TOULOUSE]);
  assert.equal(saved.zones['house-maison'].lastDate, '2025-12-30');
  // No position nor address of the house in /data.
  const raw = JSON.stringify(saved);
  assert.ok(!/latitude|center|Maison/.test(raw));

  const second = await createWorld({ api, dir: first.dir });
  t.after(() => second.app.stop());
  assert.equal(api.count(isCsv), 2, 'the files of the vintage are not downloaded again');
});

test('DVF unreachable: the last data are kept, one warning, retried every hour', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await world.createDevices();
  world.api.down.dvf = 'network';
  await world.tick(24);
  assert.equal(world.state('sales'), 225);
  assert.deepEqual(world.fake.connectionStatus, { connected: true }, 'data still there');
  const before = world.api.count(isIndex);
  await world.tick(2);
  assert.equal(world.api.count(isIndex), before + 2);
  world.api.down.dvf = false;
  await world.tick(1);
  assert.equal(world.state('sales'), 225);
});

test('DVF unreachable at the first start: status says so, data come within the hour', async (t) => {
  const api = createApi();
  api.down.dvf = 503;
  const world = await createWorld({ api });
  t.after(() => world.app.stop());
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.match(world.fake.connectionStatus.message.fr, /files\.data\.gouv\.fr est injoignable/);
  api.down.dvf = false;
  await world.tick(1);
  assert.deepEqual(world.fake.connectionStatus, { connected: true });
  await world.createDevices();
  assert.equal(world.state('sales'), 225);
});

test('geo.api.gouv.fr unreachable at the start: status, then resolved within the hour', async (t) => {
  const api = createApi();
  api.down.geo = 'network';
  const world = await createWorld({ api });
  t.after(() => world.app.stop());
  assert.match(world.fake.connectionStatus.message.en, /geo\.api\.gouv\.fr cannot be reached/);
  api.down.geo = false;
  await world.tick(1);
  assert.equal(world.fake.discoveredDevices.length, 1);
  assert.deepEqual(world.fake.connectionStatus, { connected: true });
});

test('read_now answers the summary of every zone in four languages', async (t) => {
  const world = await createWorld({ houses: [COUNTRY, HOUSE] });
  t.after(() => world.app.stop());
  const ack = await world.fake.action('read_now', {});
  assert.equal(ack.success, true);
  const message = ack.data.message ?? ack.data;
  assert.match(message.fr, /À 1 km de Campagne : \d+ ventes .* À 1 km de Maison : 225 ventes/);
  assert.match(
    message.en,
    /Within 1 km of Maison: 225 sales in the 12 months published up to December 2025/,
  );
  assert.match(message.de, /Im Umkreis von 1 km um Maison: 225 Verkäufe/);
  assert.match(message.es, /A 1 km de Maison: 225 ventas/);
});

test('the scene action summarises the chosen zone, the first one by default', async (t) => {
  const world = await createWorld({
    houses: [COUNTRY, HOUSE],
    config: { language: 'en' },
  });
  t.after(() => world.app.stop());
  const maison = world.fake.discoveredDevices[1].external_id;
  const chosen = await world.fake.sceneAction('summary', { device: maison });
  assert.equal(chosen.success, true);
  const outputs = chosen.data.outputs ?? chosen.data;
  assert.equal(outputs.sales, 225);
  assert.equal(outputs.apartment_median, 4844);
  assert.equal(outputs.house_median, undefined, 'no median, no output');
  assert.match(outputs.summary, /^Within 1 km of Maison: 225 sales/);
  assert.ok(outputs.summary.includes('median prices: flats 4,844 €/m².'));

  const first = await world.fake.sceneAction('summary', {});
  assert.match((first.data.outputs ?? first.data).summary, /^Within 1 km of Campagne/);
});

test('a normal cycle writes nothing at the info level, never the position', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await world.createDevices();
  const lines = captureLogs(t, 'info');
  await world.tick(49);
  await world.fake.widgetGet('sales', { settings: {}, language: 'fr' });
  assert.deepEqual(lines, []);
});

test('a failure that repeats is logged once, and once when it is over', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const lines = captureLogs(t, 'debug');
  world.api.down.dvf = 503;
  await world.tick(24 + 5);
  world.api.down.dvf = false;
  await world.tick(1);
  const warnings = lines.filter((line) => line.level === 'warn');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].text, /Cannot read the DVF files: files\.data\.gouv\.fr: HTTP 503/);
  assert.equal(lines.filter((line) => /reached again/.test(line.text)).length, 1);
  const all = lines.map((line) => line.text).join('\n');
  assert.ok(!all.includes(String(HOUSE.latitude)), 'no position in the logs');
});

test('the recorded files are real DVF files, anonymised', () => {
  for (const name of ['31555-2024', '31555-2025', '31578-2024', '31578-2025']) {
    const rows = fixtureText(`dvf/${name}.csv`).trim().split('\n');
    const header = rows[0].split(',');
    const at = (column) => header.indexOf(column);
    for (const row of rows.slice(1)) {
      const cells = row.split(',');
      assert.equal(cells[at('adresse_nom_voie')], '', `${name}: street kept`);
      assert.equal(cells[at('id_parcelle')], '', `${name}: parcel kept`);
    }
  }
  assert.ok(DAY > HOUR);
});

test('the houses unreadable after a new configuration: the old zones are not kept', async (t) => {
  const world = await createWorld({ houses: [COUNTRY, HOUSE] });
  t.after(() => world.app.stop());
  assert.equal(world.fake.discoveredDevices.length, 2);
  t.mock.method(world.gladys, 'getHouses', async () => {
    throw new Error('HTTP 503');
  });
  // Same configuration: a short outage keeps the zones.
  await world.tick(24);
  assert.equal(world.fake.discoveredDevices.length, 2);
  await world.fake.configUpdated({ position: 'house', house: 'maison', radius: '1000' });
  await world.monitor.idle();
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.deepEqual(world.fake.discoveredDevices, []);
});
