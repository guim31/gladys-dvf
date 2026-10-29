// -----------------------------------------------------------------------------
// Demandes de valeurs foncières (DVF), geolocated by Etalab: one CSV file per
// commune and per year, on files.data.gouv.fr, keyless.
//
//   https://files.data.gouv.fr/geo-dvf/                 index: one folder per
//                                                       vintage (`2025-12/`) + `latest/`
//   …/geo-dvf/<vintage>/csv/<year>/communes/<dép>/<INSEE>.csv
//
// A vintage is named after the last month it covers; the DGFiP publishes one
// in April and one in October. The files of a year hold one row per
// (disposition, parcel, local): a sale ("mutation", `id_mutation`) spans
// several rows, its price (`valeur_fonciere`) repeated on each.
//
// What is kept of a sale, nothing more (DVF reuse terms: no re-identification,
// so no address, no parcel, no name — there is none in the files anyway):
//   [date 'YYYY-MM-DD', kind, surface m² | null, rooms | null, price €, lat | null, lon | null]
// kind: 'a' one flat, 'm' one house, 'x' several dwellings or several prices
// (counted as a sale, never in a price per m²).
// -----------------------------------------------------------------------------

export const DVF_BASE = 'https://files.data.gouv.fr/geo-dvf';

// No DVF there: Alsace-Moselle keeps its own land register (Livre foncier),
// Mayotte is not covered.
export const NO_DVF_DEPARTMENTS = ['57', '67', '68', '976'];

// The communes of Paris, Lyon and Marseille have their DVF files by
// municipal district only.
const DISTRICTS = {
  75056: { prefix: '751', first: 1, last: 20 },
  69123: { prefix: '6938', first: 1, last: 9 },
  13055: { prefix: '132', first: 1, last: 16 },
};

/** The INSEE codes whose files make up a commune (its districts, or itself). */
export function filesOfCommune(code) {
  const district = DISTRICTS[code];
  if (!district) {
    return [code];
  }
  const width = 5 - district.prefix.length;
  return Array.from(
    { length: district.last - district.first + 1 },
    (_, index) => `${district.prefix}${String(district.first + index).padStart(width, '0')}`,
  );
}

export const isCityWithDistricts = (code) => code in DISTRICTS;

/** The department of an INSEE code: 3 characters overseas, 2 elsewhere. */
export const departmentOf = (code) => (code.startsWith('97') ? code.slice(0, 3) : code.slice(0, 2));

export const hasDvf = (code) => !NO_DVF_DEPARTMENTS.includes(departmentOf(code));

/** The latest vintage listed in the index page (`YYYY-MM`), or null. */
export function latestVintage(html) {
  const found = [
    ...String(html ?? '').matchAll(/href="(?:\/geo-dvf\/)?(\d{4}-(?:0[1-9]|1[0-2]))\/"/g),
  ]
    .map((match) => match[1])
    .sort();
  return found.at(-1) ?? null;
}

/** Last day covered by a vintage, 'YYYY-MM-DD'. */
export function vintageEnd(vintage) {
  const [year, month] = vintage.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0));
  return last.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' shifted by `months` (negative: back), day clamped to the month. */
export function shiftMonths(date, months) {
  const [year, month, day] = date.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/**
 * The two windows of the statistics: the last 12 published months, and the
 * 12 months before them. Bounds are exclusive at the start, inclusive at the end.
 */
export function windowsOf(vintage) {
  const end = vintageEnd(vintage);
  const middle = shiftMonths(end, -12);
  return { end, current: [middle, end], previous: [shiftMonths(end, -24), middle] };
}

/** The years whose files cover both windows. */
export function yearsOf(vintage) {
  const { end, previous } = windowsOf(vintage);
  // The window starts the day after its exclusive bound.
  const start = new Date(Date.parse(`${previous[0]}T00:00:00Z`) + 86400000);
  const first = start.getUTCFullYear();
  const last = Number(end.slice(0, 4));
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

export const fileUrl = (vintage, year, code) =>
  `${DVF_BASE}/${vintage}/csv/${year}/communes/${departmentOf(code)}/${code}.csv`;

// Sales kept: the market transactions. Exchanges, building plots and
// expropriations say nothing of the price of a home.
const NATURES = new Set(['Vente', "Vente en l'état futur d'achèvement", 'Adjudication']);
const DWELLINGS = { Appartement: 'a', Maison: 'm' };

const number = (value) => {
  if (value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// One CSV line. The Etalab files have no quoted field today; quotes are still
// honoured, in case a street name ever carries a comma.
function splitLine(line) {
  if (!line.includes('"')) {
    return line.split(',');
  }
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

/**
 * The residential sales of one CSV file, in the compact form above.
 * @param {string} csv
 * @returns {Array<[string, string, number|null, number|null, number, number|null, number|null]>}
 */
export function parseSales(csv) {
  const lines = String(csv ?? '').split(/\r?\n/);
  if (lines[0].trim() === '') {
    return [];
  }
  const header = splitLine(lines[0] ?? '');
  const column = Object.fromEntries(header.map((name, index) => [name.trim(), index]));
  for (const required of [
    'id_mutation',
    'date_mutation',
    'nature_mutation',
    'valeur_fonciere',
    'type_local',
  ]) {
    if (!(required in column)) {
      throw new Error(`DVF file without the ${required} column`);
    }
  }
  const mutations = new Map();
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === '') {
      continue;
    }
    const cells = splitLine(lines[index]);
    const cell = (name) => cells[column[name]] ?? '';
    if (!NATURES.has(cell('nature_mutation'))) {
      continue;
    }
    const id = cell('id_mutation');
    let mutation = mutations.get(id);
    if (!mutation) {
      mutation = {
        date: cell('date_mutation'),
        prices: new Set(),
        dwellings: new Map(),
        lat: null,
        lon: null,
      };
      mutations.set(id, mutation);
    }
    const price = number(cell('valeur_fonciere'));
    if (price !== null) {
      mutation.prices.add(price);
    }
    if (mutation.lat === null) {
      const lat = number(cell('latitude'));
      const lon = number(cell('longitude'));
      if (lat !== null && lon !== null) {
        mutation.lat = lat;
        mutation.lon = lon;
      }
    }
    const kind = DWELLINGS[cell('type_local')];
    if (kind) {
      const surface = number(cell('surface_reelle_bati'));
      const rooms = number(cell('nombre_pieces_principales'));
      // A local appears once per parcel of the sale: the same one twice is one dwelling.
      mutation.dwellings.set(`${kind}|${surface}|${rooms}`, { kind, surface, rooms });
    }
  }
  const sales = [];
  for (const mutation of mutations.values()) {
    if (
      mutation.dwellings.size === 0 ||
      mutation.prices.size === 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(mutation.date)
    ) {
      continue;
    }
    const price = Math.max(...mutation.prices);
    if (!(price > 0)) {
      continue;
    }
    const single = mutation.dwellings.size === 1 && mutation.prices.size === 1;
    const dwelling = single ? [...mutation.dwellings.values()][0] : null;
    sales.push([
      mutation.date,
      dwelling ? dwelling.kind : 'x',
      dwelling?.surface ?? null,
      dwelling?.rooms ?? null,
      price,
      mutation.lat,
      mutation.lon,
    ]);
  }
  return sales;
}

// A price per m² outside these bounds is a family sale, a symbolic price or a
// surface error, not the market.
export const MIN_PRICE_PER_M2 = 200;
export const MAX_PRICE_PER_M2 = 50000;
// Fewer sales than this make no median worth showing.
export const MIN_SALES_FOR_MEDIAN = 3;

/** Price per m² of a sale, or null when it is not a plain one-dwelling sale. */
export function pricePerM2(sale) {
  const [, kind, surface, , price] = sale;
  if ((kind !== 'a' && kind !== 'm') || !(surface >= 9)) {
    return null;
  }
  const value = price / surface;
  return value >= MIN_PRICE_PER_M2 && value <= MAX_PRICE_PER_M2 ? value : null;
}

export function median(values) {
  if (values.length < MIN_SALES_FOR_MEDIAN) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Math.round(value);
}

/** Great-circle distance in metres. */
export function distance(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

/**
 * The sales of a zone: every sale of its communes, or those within `radius`
 * metres of `center` (a sale without coordinates is then left out). Each
 * gets its distance (null without a center).
 */
export function salesInZone(salesByCommune, { center = null, radius = null } = {}) {
  const found = [];
  for (const sales of salesByCommune) {
    for (const sale of sales) {
      const [, , , , , lat, lon] = sale;
      const away =
        center && lat !== null && lon !== null
          ? distance(center.latitude, center.longitude, lat, lon)
          : null;
      if (radius !== null && (away === null || away > radius)) {
        continue;
      }
      found.push({ sale, distance: away === null ? null : Math.round(away) });
    }
  }
  return found;
}

/**
 * The statistics of a zone for a vintage.
 * @param {Array<{sale: Array}>} zoneSales from salesInZone
 * @param {string} vintage
 */
export function statsOf(zoneSales, vintage) {
  const { current, previous } = windowsOf(vintage);
  const within = ([from, to], date) => date > from && date <= to;
  const window = (bounds) => {
    const sales = zoneSales.filter(({ sale }) => within(bounds, sale[0]));
    const prices = (kind) =>
      sales
        .filter(({ sale }) => sale[1] === kind)
        .map(({ sale }) => pricePerM2(sale))
        .filter((value) => value !== null);
    return { count: sales.length, apartment: median(prices('a')), house: median(prices('m')) };
  };
  const dates = zoneSales.map(({ sale }) => sale[0]).sort();
  return {
    vintage,
    current: window(current),
    previous: window(previous),
    lastDate: dates.at(-1) ?? null,
  };
}

/** The `limit` latest one-dwelling sales of a zone, newest first. */
export function latestSales(zoneSales, limit = 10) {
  return zoneSales
    .filter(({ sale }) => sale[1] === 'a' || sale[1] === 'm')
    .sort((a, b) => (a.sale[0] < b.sale[0] ? 1 : a.sale[0] > b.sale[0] ? -1 : 0))
    .slice(0, limit);
}
