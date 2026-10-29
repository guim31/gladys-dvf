// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake files.data.gouv.fr and
// a fake geo.api.gouv.fr serving test/fixtures, a manual clock, a temporary
// /data, and the integration wired on top through registerHandlers. Nothing
// touches the network.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { Store } from '../../src/store.js';

process.env.LOG_LEVEL ??= 'silent';
process.env.TZ = 'Europe/Paris';

export const fixtureText = (name) =>
  readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');

// A day of the 2026 autumn: the 2025-12 vintage (published in spring) is the
// latest. The tests never read the real date.
export const START = Date.parse('2026-10-15T08:00:00Z');
export const HOUR = 3600 * 1000;
export const DAY = 24 * HOUR;

export const VINTAGE = '2025-12';
export const NEXT_VINTAGE = '2026-06';
export const TOULOUSE = '31555';
export const VIGOULET = '31578';

// A house on the place du Capitole in Toulouse (a public square), one in
// Vigoulet-Auzil (centre of its recorded sales), one without a location.
export const HOUSE = {
  id: 'house-1',
  name: 'Maison',
  selector: 'maison',
  latitude: 43.6045,
  longitude: 1.444,
};
export const COUNTRY = {
  id: 'house-2',
  name: 'Campagne',
  selector: 'campagne',
  latitude: 43.5092,
  longitude: 1.4513,
};
export const CHALET = {
  id: 'house-3',
  name: 'Chalet',
  selector: 'chalet',
  latitude: null,
  longitude: null,
};

// The answers of geo.api.gouv.fr, as recorded on 29/10/2026 (same fields).
const COMMUNES = {
  31555: { code: '31555', nom: 'Toulouse', codeDepartement: '31' },
  31578: { code: '31578', nom: 'Vigoulet-Auzil', codeDepartement: '31' },
  57463: { code: '57463', nom: 'Metz', codeDepartement: '57' },
  75056: { code: '75056', nom: 'Paris', codeDepartement: '75' },
  75110: { code: '75110', nom: 'Paris 10e Arrondissement', codeDepartement: '75' },
};

/** The commune at a point: rough boxes around the places of the tests. */
function communeAt(lat, lon, type) {
  if (lat > 43.55 && lat < 43.67 && lon > 1.35 && lon < 1.52) {
    return COMMUNES[TOULOUSE];
  }
  if (lat > 43.49 && lat < 43.53 && lon > 1.43 && lon < 1.48) {
    return COMMUNES[VIGOULET];
  }
  if (lat > 49.08 && lat < 49.14 && lon > 6.13 && lon < 6.23) {
    return COMMUNES['57463'];
  }
  if (lat > 48.81 && lat < 48.91 && lon > 2.22 && lon < 2.47) {
    return type === 'arrondissement-municipal' ? COMMUNES['75110'] : COMMUNES['75056'];
  }
  return null;
}

const HEADER = fixtureText('dvf/31578-2024.csv').split('\n')[0];
const COLUMNS = HEADER.split(',');

/** One CSV row of a DVF file, in the shape of the recorded ones. */
export function dvfRow({
  id,
  date,
  price,
  type = 'Appartement',
  surface = 50,
  rooms = 2,
  lat = HOUSE.latitude,
  lon = HOUSE.longitude,
  nature = 'Vente',
  commune = TOULOUSE,
  number = '',
  suffix = '',
  street = '',
}) {
  const values = {
    id_mutation: id,
    date_mutation: date,
    numero_disposition: '000001',
    nature_mutation: nature,
    valeur_fonciere: String(price),
    adresse_numero: number,
    adresse_suffixe: suffix,
    adresse_nom_voie: street,
    code_commune: commune,
    nom_commune: COMMUNES[commune]?.nom ?? '',
    code_departement: commune.slice(0, 2),
    code_type_local: type === 'Maison' ? '1' : '2',
    type_local: type,
    surface_reelle_bati: surface === null ? '' : String(surface),
    nombre_pieces_principales: String(rooms),
    longitude: lon === null ? '' : String(lon),
    latitude: lat === null ? '' : String(lat),
  };
  return COLUMNS.map((column) => values[column] ?? '').join(',');
}

export const dvfFile = (rows) => [HEADER, ...rows].join('\n') + '\n';

/**
 * Fake files.data.gouv.fr and geo.api.gouv.fr. `api.down.dvf` /
 * `api.down.geo`: 'network', a status (503) or false. `api.files` maps
 * `<vintage>/<INSEE>-<year>` to a CSV; the recorded files serve the 2025-12
 * vintage, and the 2026-06 one unless a test overrides them.
 */
export function createApi() {
  const recorded = {};
  for (const code of [TOULOUSE, VIGOULET]) {
    for (const year of [2024, 2025]) {
      recorded[`${code}-${year}`] = fixtureText(`dvf/${code}-${year}.csv`);
    }
  }
  const api = {
    index: fixtureText('dvf/index.html'),
    files: {},
    down: { dvf: false, geo: false },
    requests: [],

    publish(vintage) {
      api.index = api.index.replace('/geo-dvf/2025-12/', `/geo-dvf/${vintage}/`);
    },

    respond(url) {
      const service = url.host === 'geo.api.gouv.fr' ? 'geo' : 'dvf';
      const down = api.down[service];
      if (down === 'network') {
        throw new TypeError('fetch failed');
      }
      if (down) {
        return new Response('down', { status: down });
      }
      if (service === 'geo') {
        if (url.pathname === '/communes') {
          const found = communeAt(
            Number(url.searchParams.get('lat')),
            Number(url.searchParams.get('lon')),
            url.searchParams.get('type'),
          );
          return Response.json(found ? [found] : []);
        }
        const code = url.pathname.split('/').pop();
        return COMMUNES[code] ? Response.json(COMMUNES[code]) : new Response('', { status: 404 });
      }
      if (url.pathname === '/geo-dvf/') {
        return new Response(api.index, { headers: { 'content-type': 'text/html' } });
      }
      const match = url.pathname.match(
        /^\/geo-dvf\/(\d{4}-\d{2})\/csv\/(\d{4})\/communes\/\w+\/(\w+)\.csv$/,
      );
      if (match) {
        const [, vintage, year, code] = match;
        const body = api.files[`${vintage}/${code}-${year}`] ?? recorded[`${code}-${year}`];
        if (body !== undefined && body !== null) {
          return new Response(body, { headers: { 'content-type': 'text/csv' } });
        }
      }
      return new Response('Not Found', { status: 404 });
    },

    fetch: async (input) => {
      const url = new URL(String(input));
      api.requests.push(url);
      return api.respond(url);
    },

    count(predicate) {
      return api.requests.filter(predicate).length;
    },
  };
  return api;
}

/**
 * The integration wired on the fake Gladys. `connect: false` registers the
 * handlers only. `world.tick(hours)` moves the clock and runs one timer tick
 * per hour.
 */
export async function createWorld({
  config = {},
  houses = [HOUSE],
  devices = [],
  api = createApi(),
  dir = mkdtempSync(join(tmpdir(), 'gladys-dvf-')),
  connect = true,
} = {}) {
  const clock = { now: START };
  const gladys = createFakeGladys({
    config: { position: 'house', radius: '1000', language: 'fr', ...config },
    houses,
    devices,
  });
  const app = registerHandlers(gladys, {
    store: new Store(dir),
    fetch: api.fetch,
    timers: false,
    now: () => clock.now,
  });
  const world = {
    gladys,
    fake: gladys.fake,
    app,
    monitor: app.monitor,
    api,
    clock,
    dir,
    async tick(hours = 1) {
      for (let hour = 0; hour < hours; hour += 1) {
        clock.now += HOUR;
        await app.monitor.tick();
      }
    },
    /** Creates the discovered devices in Gladys, as the user would. */
    async createDevices() {
      for (const device of gladys.fake.discoveredDevices) {
        await gladys.fake.deviceCreated(device);
      }
    },
    /** The last state of a feature key of the first device. */
    state(key, index = 0) {
      const device = gladys.fake.discoveredDevices[index];
      return gladys.fake.lastState(`${device.external_id}:${key}`);
    },
  };
  if (connect) {
    await gladys.connect();
    await app.monitor.idle();
  }
  return world;
}

/** Records the log lines written at `level` and above until the test ends. */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
