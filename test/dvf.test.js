// -----------------------------------------------------------------------------
// The DVF parser and statistics, on the recorded files (Toulouse around the
// Capitole, Vigoulet-Auzil) and on hand-made rows for the edge cases.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fileUrl,
  filesOfCommune,
  hasDvf,
  latestVintage,
  median,
  parseSales,
  pricePerM2,
  salesInZone,
  statsOf,
  windowsOf,
  yearsOf,
} from '../src/dvf.js';
import { HOUSE, dvfFile, dvfRow, fixtureText } from './helpers/world.js';

test('the latest vintage is read from the index of geo-dvf', () => {
  assert.equal(latestVintage(fixtureText('dvf/index.html')), '2025-12');
  assert.equal(
    latestVintage(
      '<a href="/geo-dvf/2025-06/"></a><a href="/geo-dvf/2026-06/"></a><a href="/geo-dvf/latest/">',
    ),
    '2026-06',
  );
  assert.equal(latestVintage('<html>nothing</html>'), null);
});

test('windows: the 12 last published months, the 12 before, the years to download', () => {
  assert.deepEqual(windowsOf('2025-12'), {
    end: '2025-12-31',
    current: ['2024-12-31', '2025-12-31'],
    previous: ['2023-12-31', '2024-12-31'],
  });
  assert.deepEqual(yearsOf('2025-12'), [2024, 2025]);
  assert.deepEqual(yearsOf('2026-06'), [2024, 2025, 2026]);
  assert.equal(windowsOf('2024-02').current[0], '2023-02-29'.replace('29', '28'));
  assert.equal(
    fileUrl('2025-12', 2025, '2A004'),
    'https://files.data.gouv.fr/geo-dvf/2025-12/csv/2025/communes/2A/2A004.csv',
  );
  assert.equal(fileUrl('2025-12', 2025, '97411').split('/').at(-2), '974');
});

test('Paris, Lyon and Marseille are read by district; Alsace-Moselle and Mayotte have no DVF', () => {
  assert.equal(filesOfCommune('75056').length, 20);
  assert.deepEqual(filesOfCommune('69123').slice(0, 2), ['69381', '69382']);
  assert.equal(filesOfCommune('13055').at(-1), '13216');
  assert.deepEqual(filesOfCommune('31555'), ['31555']);
  for (const code of ['57463', '67482', '68224', '97611']) {
    assert.equal(hasDvf(code), false, code);
  }
  for (const code of ['31555', '2A004', '97411']) {
    assert.equal(hasDvf(code), true, code);
  }
});

test('the recorded Toulouse file: one sale per mutation, dwellings only', () => {
  const sales = parseSales(fixtureText('dvf/31555-2025.csv'));
  const csvMutations = new Set(
    fixtureText('dvf/31555-2025.csv')
      .trim()
      .split('\n')
      .slice(1)
      .map((row) => row.split(',')[0]),
  );
  assert.ok(sales.length > 100 && sales.length < csvMutations.size);
  for (const sale of sales) {
    assert.match(sale[0], /^2025-\d{2}-\d{2}$/);
    assert.ok(['a', 'm', 'x'].includes(sale[1]));
    assert.ok(sale[4] > 0);
  }
  // The first mutation of the file: a flat of 35 m² and its outbuilding.
  assert.deepEqual(sales[0], ['2025-01-03', 'a', 35, 1, 120000, 43.6009, 1.4411]);
});

test('edge cases: several dwellings, exchanges, plots, quoted cells, missing columns', () => {
  const csv = dvfFile([
    dvfRow({ id: 'A', date: '2025-03-01', price: 300000, surface: 40 }),
    dvfRow({ id: 'A', date: '2025-03-01', price: 300000, surface: 60 }),
    dvfRow({ id: 'B', date: '2025-03-02', price: 100000, nature: 'Echange' }),
    dvfRow({ id: 'C', date: '2025-03-03', price: 90000, nature: 'Vente terrain à bâtir' }),
    dvfRow({ id: 'D', date: '2025-03-04', price: 200000, type: 'Maison', surface: 100 }),
    // The same local on two parcels: still one house.
    dvfRow({ id: 'E', date: '2025-03-05', price: 400000, type: 'Maison', surface: 120 }),
    dvfRow({ id: 'E', date: '2025-03-05', price: 400000, type: 'Maison', surface: 120 }),
    dvfRow({ id: 'F', date: '2025-03-06', price: 0 }),
  ]);
  const sales = parseSales(csv);
  assert.deepEqual(
    sales.map((sale) => [sale[1], sale[2]]),
    [
      ['x', null],
      ['m', 100],
      ['m', 120],
    ],
  );
  const quoted = csv.replace(',Toulouse,', ',"Toulouse, centre",');
  assert.equal(parseSales(quoted).length, 3);
  assert.throws(() => parseSales('a,b\n1,2\n'), /without the id_mutation column/);
  assert.deepEqual(parseSales(''), []);
});

test('price per m²: plain one-dwelling sales within sane bounds; median of 3 or more', () => {
  assert.equal(pricePerM2(['2025-01-01', 'a', 50, 2, 200000, null, null]), 4000);
  assert.equal(pricePerM2(['2025-01-01', 'x', null, null, 200000, null, null]), null);
  assert.equal(pricePerM2(['2025-01-01', 'a', 50, 2, 1, null, null]), null);
  assert.equal(pricePerM2(['2025-01-01', 'a', 5, 1, 50000, null, null]), null);
  assert.equal(median([1, 2]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 3);
});

test('the zone: radius around the house, distances, windows', () => {
  const sales = [
    ...parseSales(fixtureText('dvf/31555-2024.csv')),
    ...parseSales(fixtureText('dvf/31555-2025.csv')),
  ];
  const center = { latitude: HOUSE.latitude, longitude: HOUSE.longitude };
  const near = salesInZone([sales], { center, radius: 300 });
  assert.ok(near.every(({ distance }) => distance <= 300));
  const all = salesInZone([sales]);
  assert.equal(all.length, sales.length);
  assert.ok(all.every(({ distance }) => distance === null));
  const stats = statsOf(all, '2025-12');
  assert.deepEqual(stats.current, { count: 225, apartment: 4866, house: null });
  assert.deepEqual(stats.previous, { count: 175, apartment: 4702, house: null });
  assert.equal(stats.lastDate, '2025-12-30');
});
