// -----------------------------------------------------------------------------
// One Gladys device per zone: the sales around a house of Gladys (its commune,
// or a circle of 300 m to 2 km), or in a commune given by its INSEE code.
//
// Features (couples checked against the Gladys front, see
// test/gladys-rules.test.js), all read-only:
//   - apartment, house             currency/decimal (euro): median price per m²
//     apartment_previous,          of the one-dwelling sales, over the last 12
//     house_previous               published months and the 12 months before;
//                                  no value under 3 sales;
//   - sales, sales_previous        counter-sensor/integer: residential sales
//                                  (flats and houses) over the same windows;
//   - last_sale                    text/text: date of the latest sale published;
//   - vintage                      text/text: month the published data reach.
//
// Published with should_poll: false: the container checks the vintage once a
// day and republishes on its own hourly timer (src/monitor.js). The platform
// id is `house-<selector>` around a house, the INSEE code for a commune.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { NAMES } from './messages.js';

export const DEVICE_TYPE = 'zone';
export const FEATURE_KEYS = [
  'apartment',
  'house',
  'apartment_previous',
  'house_previous',
  'sales',
  'sales_previous',
  'last_sale',
  'vintage',
];

// Display bounds: the dearest streets of Paris pass 30,000 €/m².
export const PRICE_MAX = 100000;
export const COUNT_MAX = 100000;

/** External ids of the device of a zone and of its features. */
export function zoneIds(gladys, platformId) {
  const ids = gladys.externalIds(DEVICE_TYPE, platformId);
  return {
    device: ids.device,
    ...Object.fromEntries(FEATURE_KEYS.map((key) => [key, ids.feature(key)])),
  };
}

const feature = (name, externalId, category, type, min, max, extra = {}) => ({
  name,
  external_id: externalId,
  category,
  type,
  read_only: true,
  has_feedback: false,
  keep_history: true,
  min,
  max,
  ...extra,
});

/**
 * The discovery payload of a zone.
 * @param {object} gladys
 * @param {object} zone `{ platformId, label, radius, communes }` (src/monitor.js)
 * @param {string} language language of the names
 */
export function buildDevice(gladys, zone, language = 'fr') {
  const ids = zoneIds(gladys, zone.platformId);
  const names = NAMES[language] ?? NAMES.fr;
  const { CURRENCY, COUNTER_SENSOR, TEXT } = DEVICE_FEATURE_CATEGORIES;
  const price = (key) =>
    feature(names[key], ids[key], CURRENCY, TYPES.CURRENCY.DECIMAL, 0, PRICE_MAX, {
      unit: DEVICE_FEATURE_UNITS.EURO,
    });
  const counter = (key) =>
    feature(names[key], ids[key], COUNTER_SENSOR, TYPES.SENSOR.INTEGER, 0, COUNT_MAX);
  const text = (key) =>
    feature(names[key], ids[key], TEXT, TYPES.TEXT.TEXT, 0, 0, { keep_history: false });
  const params = [{ name: 'COMMUNES', value: zone.communes.map((c) => c.code).join(',') }];
  if (zone.radius) {
    params.push({ name: 'RADIUS_M', value: String(zone.radius) });
  }
  return {
    name: `${names.device} (${zone.label})`,
    external_id: ids.device,
    model: 'DVF',
    should_poll: false,
    params,
    features: [
      price('apartment'),
      price('house'),
      price('apartment_previous'),
      price('house_previous'),
      counter('sales'),
      counter('sales_previous'),
      text('last_sale'),
      text('vintage'),
    ],
  };
}
