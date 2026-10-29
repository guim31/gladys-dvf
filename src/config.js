// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Where the sales are read: around a house of Gladys, around every house of
// Gladys, or in a commune given by its INSEE code.
//
// `houses` exists because Gladys (5.2.1) refuses to save an emptied
// `source: "houses"` select: once a house is chosen, the House field can no
// longer be set back to empty ("every house").
export const POSITIONS = ['house', 'houses', 'commune'];

// The zone around a house: its whole commune, or a circle (metres).
export const RADII = ['commune', '300', '500', '1000', '2000'];

export const DEFAULT_CONFIG = {
  position: 'house',
  // A `source: "houses"` select takes no default (store rule): empty = every
  // house of Gladys that has a location.
  house: '',
  radius: '1000',
  commune: '',
  language: 'fr',
};

// INSEE code of a commune: 5 digits, or 2A/2B and 3 digits in Corsica.
const COMMUNE_CODE = /^(?:\d{5}|2[AB]\d{3})$/;

export const isCommuneCode = (value) => COMMUNE_CODE.test(String(value ?? '').toUpperCase());

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const commune = text(source.commune).toUpperCase();
  const position = POSITIONS.includes(source.position) ? source.position : DEFAULT_CONFIG.position;
  const radius = RADII.includes(String(source.radius))
    ? String(source.radius)
    : DEFAULT_CONFIG.radius;
  return {
    position: position === 'houses' ? 'house' : position,
    // The selector of the chosen house (source: "houses"), null = every located house.
    houseSelector: position === 'houses' ? null : text(source.house) || null,
    // Metres around the house, null = its whole commune.
    radius: radius === 'commune' ? null : Number(radius),
    communeCode: isCommuneCode(commune) ? commune : null,
    communeInvalid: commune !== '' && !isCommuneCode(commune) ? text(source.commune) : null,
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}
