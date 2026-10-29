// -----------------------------------------------------------------------------
// Every text sent from the container, in the four languages of Gladys (en, fr,
// de, es; German says "du", Spanish "usted"), and the formatting of prices,
// distances and dates. A table entry is a string or a function of parameters.
// -----------------------------------------------------------------------------

export const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

/** `{ en, fr, de, es }` of a table entry. */
export function render(table, key, params = {}) {
  return Object.fromEntries(
    Object.entries(table).map(([lang, entries]) => {
      const entry = entries[key];
      return [lang, typeof entry === 'function' ? entry(params) : entry];
    }),
  );
}

// Plain spaces: the narrow no-break space of fr-FR shows as a box in some fonts.
const plain = (text) => text.replace(/[\u202f\u00a0]/g, ' ');

export const formatNumber = (value, lang) =>
  plain(
    new Intl.NumberFormat(LOCALES[lang] ?? LOCALES.fr, { maximumFractionDigits: 0 }).format(value),
  );

export const formatEuros = (value, lang) => `${formatNumber(value, lang)} €`;

export const formatDistance = (meters, lang) =>
  meters < 1000 ? `${formatNumber(meters, lang)} m` : `${formatNumber(meters / 1000, lang)} km`;

const utc = (date) => new Date(`${date}T12:00:00Z`);

/** 'YYYY-MM-DD' as a short local date (31/12/2025, 31.12.2025). */
export const formatDate = (date, lang) =>
  new Intl.DateTimeFormat(LOCALES[lang] ?? LOCALES.fr, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utc(date));

/** A vintage 'YYYY-MM' as a month and a year (décembre 2025). */
export const formatVintage = (vintage, lang) =>
  new Intl.DateTimeFormat(LOCALES[lang] ?? LOCALES.fr, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utc(`${vintage}-15`));

// --- Device and feature names (frozen at creation in Gladys) -----------------

export const NAMES = {
  en: {
    device: 'Property sales',
    apartment: 'Flats, median €/m² (12 months)',
    house: 'Houses, median €/m² (12 months)',
    apartment_previous: 'Flats, median €/m² (year before)',
    house_previous: 'Houses, median €/m² (year before)',
    sales: 'Sales (12 months)',
    sales_previous: 'Sales (year before)',
    last_sale: 'Latest sale published',
    vintage: 'Data published up to',
  },
  fr: {
    device: 'Ventes immobilières',
    apartment: 'Appartements, €/m² médian (12 mois)',
    house: 'Maisons, €/m² médian (12 mois)',
    apartment_previous: "Appartements, €/m² médian (an d'avant)",
    house_previous: "Maisons, €/m² médian (an d'avant)",
    sales: 'Ventes (12 mois)',
    sales_previous: "Ventes (an d'avant)",
    last_sale: 'Dernière vente publiée',
    vintage: "Données publiées jusqu'à",
  },
  de: {
    device: 'Immobilienverkäufe',
    apartment: 'Wohnungen, Median €/m² (12 Monate)',
    house: 'Häuser, Median €/m² (12 Monate)',
    apartment_previous: 'Wohnungen, Median €/m² (Vorjahr)',
    house_previous: 'Häuser, Median €/m² (Vorjahr)',
    sales: 'Verkäufe (12 Monate)',
    sales_previous: 'Verkäufe (Vorjahr)',
    last_sale: 'Letzter veröffentlichter Verkauf',
    vintage: 'Daten veröffentlicht bis',
  },
  es: {
    device: 'Ventas inmobiliarias',
    apartment: 'Pisos, €/m² mediano (12 meses)',
    house: 'Casas, €/m² mediano (12 meses)',
    apartment_previous: 'Pisos, €/m² mediano (año anterior)',
    house_previous: 'Casas, €/m² mediano (año anterior)',
    sales: 'Ventas (12 meses)',
    sales_previous: 'Ventas (año anterior)',
    last_sale: 'Última venta publicada',
    vintage: 'Datos publicados hasta',
  },
};

// --- Connection status of the configuration screen ----------------------------

export const STATUS = {
  en: {
    noHouse:
      'No house of Gladys has a location: set one in Settings → Houses, or choose a commune.',
    houseNotFound: ({ name }) => `The house "${name}" no longer exists or has no location.`,
    outside: 'The location of the house is not in a French commune.',
    noCommune: 'Type the INSEE code of the commune (5 characters, e.g. 31555 for Toulouse).',
    communeInvalid: ({ value }) => `"${value}" is not an INSEE code (5 characters, e.g. 31555).`,
    communeUnknown: ({ code }) => `No commune has the INSEE code ${code}.`,
    noDvf: ({ name }) => `${name}: no DVF data in Alsace-Moselle and Mayotte (own land register).`,
    geoDown: 'geo.api.gouv.fr cannot be reached: the zone will be resolved again within the hour.',
    dvfDown:
      'files.data.gouv.fr cannot be reached: the last data downloaded are kept, retry within the hour.',
    initFailed: 'The integration could not start: see its logs.',
  },
  fr: {
    noHouse:
      "Aucune maison de Gladys n'a de position : renseignez-la dans Paramètres → Maisons, ou choisissez une commune.",
    houseNotFound: ({ name }) => `La maison « ${name} » n'existe plus ou n'a pas de position.`,
    outside: "La position de la maison n'est pas dans une commune française.",
    noCommune: 'Saisissez le code INSEE de la commune (5 caractères, ex. 31555 pour Toulouse).',
    communeInvalid: ({ value }) =>
      `« ${value} » n'est pas un code INSEE (5 caractères, ex. 31555).`,
    communeUnknown: ({ code }) => `Aucune commune n'a le code INSEE ${code}.`,
    noDvf: ({ name }) =>
      `${name} : pas de DVF en Alsace-Moselle ni à Mayotte (livre foncier propre).`,
    geoDown: "geo.api.gouv.fr est injoignable : la zone sera recalculée dans l'heure.",
    dvfDown:
      "files.data.gouv.fr est injoignable : les dernières données téléchargées sont gardées, nouvel essai dans l'heure.",
    initFailed: "L'intégration n'a pas pu démarrer : voir ses journaux.",
  },
  de: {
    noHouse:
      'Kein Haus in Gladys hat einen Standort: lege ihn unter Einstellungen → Häuser fest oder wähle eine Gemeinde.',
    houseNotFound: ({ name }) =>
      `Das Haus „${name}“ existiert nicht mehr oder hat keinen Standort.`,
    outside: 'Der Standort des Hauses liegt in keiner französischen Gemeinde.',
    noCommune: 'Gib den INSEE-Code der Gemeinde ein (5 Zeichen, z. B. 31555 für Toulouse).',
    communeInvalid: ({ value }) => `„${value}“ ist kein INSEE-Code (5 Zeichen, z. B. 31555).`,
    communeUnknown: ({ code }) => `Keine Gemeinde hat den INSEE-Code ${code}.`,
    noDvf: ({ name }) =>
      `${name}: keine DVF-Daten im Elsass, in Lothringen (Moselle) und auf Mayotte.`,
    geoDown:
      'geo.api.gouv.fr ist nicht erreichbar: die Zone wird innerhalb einer Stunde neu bestimmt.',
    dvfDown:
      'files.data.gouv.fr ist nicht erreichbar: die zuletzt geladenen Daten bleiben, neuer Versuch innerhalb einer Stunde.',
    initFailed: 'Die Integration konnte nicht starten: sieh in ihre Protokolle.',
  },
  es: {
    noHouse:
      'Ninguna casa de Gladys tiene ubicación: indíquela en Ajustes → Casas o elija un municipio.',
    houseNotFound: ({ name }) => `La casa «${name}» ya no existe o no tiene ubicación.`,
    outside: 'La ubicación de la casa no está en un municipio francés.',
    noCommune: 'Escriba el código INSEE del municipio (5 caracteres, p. ej. 31555 para Toulouse).',
    communeInvalid: ({ value }) => `«${value}» no es un código INSEE (5 caracteres, p. ej. 31555).`,
    communeUnknown: ({ code }) => `Ningún municipio tiene el código INSEE ${code}.`,
    noDvf: ({ name }) =>
      `${name}: no hay datos DVF en Alsacia-Mosela ni en Mayotte (registro propio).`,
    geoDown: 'geo.api.gouv.fr no responde: la zona se volverá a calcular dentro de una hora.',
    dvfDown:
      'files.data.gouv.fr no responde: se conservan los últimos datos descargados, nuevo intento dentro de una hora.',
    initFailed: 'La integración no pudo iniciarse: consulte sus registros.',
  },
};

// --- Summary sentence (scene action, "Check now" action) -----------------------

const where = {
  en: ({ label, radius }, lang) =>
    radius ? `Within ${formatDistance(radius, lang)} of ${label}` : `In ${label}`,
  fr: ({ label, radius }, lang) =>
    radius ? `À ${formatDistance(radius, lang)} de ${label}` : `À ${label}`,
  de: ({ label, radius }, lang) =>
    radius ? `Im Umkreis von ${formatDistance(radius, lang)} um ${label}` : `In ${label}`,
  es: ({ label, radius }, lang) =>
    radius ? `A ${formatDistance(radius, lang)} de ${label}` : `En ${label}`,
};

const SUMMARY_WORDS = {
  en: {
    sales: (count) => (count === 1 ? '1 sale' : `${formatNumber(count, 'en')} sales`),
    period: (until) => `in the 12 months published up to ${until}`,
    apartment: 'flats',
    house: 'houses',
    medians: 'median prices',
    none: 'too few sales for a median price',
    waiting: 'the DVF data are not downloaded yet.',
    latest: 'latest sale',
    flat: 'flat',
    home: 'house',
    on: (date) => `on ${date}`,
  },
  fr: {
    sales: (count) => (count <= 1 ? `${count} vente` : `${formatNumber(count, 'fr')} ventes`),
    period: (until) => `sur les 12 mois publiés jusqu'à ${until}`,
    apartment: 'appartements',
    house: 'maisons',
    medians: 'prix médians',
    none: 'trop peu de ventes pour un prix médian',
    waiting: 'les données DVF ne sont pas encore téléchargées.',
    latest: 'dernière vente',
    flat: 'appartement',
    home: 'maison',
    on: (date) => `le ${date}`,
  },
  de: {
    sales: (count) => (count === 1 ? '1 Verkauf' : `${formatNumber(count, 'de')} Verkäufe`),
    period: (until) => `in den 12 veröffentlichten Monaten bis ${until}`,
    apartment: 'Wohnungen',
    house: 'Häuser',
    medians: 'Medianpreise',
    none: 'zu wenige Verkäufe für einen Medianpreis',
    waiting: 'die DVF-Daten sind noch nicht geladen.',
    latest: 'letzter Verkauf',
    flat: 'Wohnung',
    home: 'Haus',
    on: (date) => `am ${date}`,
  },
  es: {
    sales: (count) => (count === 1 ? '1 venta' : `${formatNumber(count, 'es')} ventas`),
    period: (until) => `en los 12 meses publicados hasta ${until}`,
    apartment: 'pisos',
    house: 'casas',
    medians: 'precios medianos',
    none: 'muy pocas ventas para un precio mediano',
    waiting: 'los datos DVF aún no se han descargado.',
    latest: 'última venta',
    flat: 'piso',
    home: 'casa',
    on: (date) => `el ${date}`,
  },
};

/**
 * One sentence on a zone: where, how many sales, the median prices.
 * @param {{label: string, radius: number|null}} zone
 * @param {object|null} stats from statsOf, null while nothing is downloaded
 * @param {string} lang
 * @param {{sale: Array, distance: number|null}|null} latest the latest sale (latestSales), with
 *   its address when the file gives one; null leaves it out (the "Check now" toast is short)
 */
export function summary(zone, stats, lang, latest = null) {
  const words = SUMMARY_WORDS[lang] ?? SUMMARY_WORDS.fr;
  const place = (where[lang] ?? where.fr)(zone, lang);
  const colon = lang === 'fr' ? ' :' : ':';
  if (!stats) {
    return `${place}${colon} ${words.waiting}`;
  }
  const { current } = stats;
  const prices = [];
  if (current.apartment !== null) {
    prices.push(`${words.apartment} ${formatEuros(current.apartment, lang)}/m²`);
  }
  if (current.house !== null) {
    prices.push(`${words.house} ${formatEuros(current.house, lang)}/m²`);
  }
  const tail = prices.length ? `${words.medians}${colon} ${prices.join(', ')}` : words.none;
  const semicolon = lang === 'fr' ? ' ;' : ';';
  const text = `${place}${colon} ${words.sales(current.count)} ${words.period(formatVintage(stats.vintage, lang))}${semicolon} ${tail}.`;
  if (!latest) {
    return text;
  }
  const [date, kind, surface, , price, , , address] = latest.sale;
  const what = [kind === 'a' ? words.flat : words.home];
  if (surface) {
    what.push(`${formatNumber(surface, lang)} m²`);
  }
  const parts = [
    ...(address ? [address] : []),
    what.join(' '),
    formatEuros(price, lang),
    words.on(formatDate(date, lang)),
  ];
  const latestText = `${words.latest}${colon} ${parts.join(', ')}.`;
  return `${text} ${latestText[0].toUpperCase()}${latestText.slice(1)}`;
}

/** The summary in the four languages. */
export const summaries = (zone, stats) =>
  Object.fromEntries(Object.keys(SUMMARY_WORDS).map((lang) => [lang, summary(zone, stats, lang)]));
