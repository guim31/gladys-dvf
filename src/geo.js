// -----------------------------------------------------------------------------
// Communes from geo.api.gouv.fr (Etalab, keyless):
//   /communes?lat=…&lon=…   the commune at a point (`[]` at sea or abroad);
//     with type=arrondissement-municipal, the district in Paris, Lyon, Marseille;
//   /communes/<INSEE>       name and department of a commune.
//
// A circle around a house may cross a commune boundary: its communes are the
// one at the centre and those at 12 points of the circle. A commune touched by
// the circle only between two points is missed; at 2 km the gap between two
// points is about 1 km, enough for the communes that matter.
// -----------------------------------------------------------------------------

import { isCityWithDistricts } from './dvf.js';
import { getJson } from './http.js';

export const GEO_BASE = 'https://geo.api.gouv.fr';
const FIELDS = 'code,nom,codeDepartement';
export const CIRCLE_POINTS = 12;

const communeOf = (entry) =>
  entry && typeof entry.code === 'string' && typeof entry.nom === 'string'
    ? { code: entry.code.toUpperCase(), name: entry.nom }
    : null;

/** A point `meters` away from (lat, lon) towards `bearing` radians. */
export function pointAt(latitude, longitude, meters, bearing) {
  const dLat = (meters * Math.cos(bearing)) / 111320;
  const dLon = (meters * Math.sin(bearing)) / (111320 * Math.cos((latitude * Math.PI) / 180));
  return { latitude: latitude + dLat, longitude: longitude + dLon };
}

export class Geo {
  constructor({ fetch: fetchImpl = globalThis.fetch } = {}) {
    this.fetch = fetchImpl;
  }

  /** The commune (or the district, in Paris, Lyon, Marseille) at a point, or null. */
  async communeAt(latitude, longitude) {
    const query = (type) =>
      `${GEO_BASE}/communes?${new URLSearchParams({
        lat: latitude.toFixed(6),
        lon: longitude.toFixed(6),
        ...(type ? { type } : {}),
        fields: FIELDS,
      })}`;
    const body = await getJson(this.fetch, query());
    const commune = communeOf(Array.isArray(body) ? body[0] : null);
    if (!commune || !isCityWithDistricts(commune.code)) {
      return commune;
    }
    const district = await getJson(this.fetch, query('arrondissement-municipal'));
    return communeOf(Array.isArray(district) ? district[0] : null) ?? commune;
  }

  /** The communes a circle touches, the one at its centre first. */
  async communesAround(latitude, longitude, radius) {
    const points = [
      { latitude, longitude },
      ...Array.from({ length: CIRCLE_POINTS }, (_, index) =>
        pointAt(latitude, longitude, radius, (2 * Math.PI * index) / CIRCLE_POINTS),
      ),
    ];
    const found = new Map();
    for (const point of points) {
      const commune = await this.communeAt(point.latitude, point.longitude);
      if (commune && !found.has(commune.code)) {
        found.set(commune.code, commune);
      }
    }
    return [...found.values()];
  }

  /** Name of a commune by its INSEE code, or null when it does not exist. */
  async commune(code) {
    return communeOf(
      await getJson(
        this.fetch,
        `${GEO_BASE}/communes/${encodeURIComponent(code)}?fields=${FIELDS}`,
      ),
    );
  }
}
