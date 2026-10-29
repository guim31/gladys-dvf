// -----------------------------------------------------------------------------
// The `sales` dashboard widget: the median prices of a zone (three tiles) and
// its latest published sales (one status row each: number and street when the
// file gives them, type, rooms, surface, price, date, distance from the house).
// Each block, and the addresses, can be hidden in the widget settings. The
// number of rows is a setting too, capped by the core at 10 rows per list.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { WIDGET_KEY } from './monitor.js';
import { formatDate, formatDistance, formatEuros, formatVintage } from './messages.js';

// The core keeps 10 rows of a status list (MAX_STATUS_ITEMS), and one list per widget.
export const MAX_SALES = 10;
export const DEFAULT_SALES = 10;

/** The `sales_count` setting (a select: 1, 3, 5, 10), clamped to 1…MAX_SALES; default when blank. */
export function salesCount(value) {
  const count = Math.round(Number(value));
  if (value === '' || value === null || value === undefined || !Number.isFinite(count)) {
    return DEFAULT_SALES;
  }
  return Math.min(MAX_SALES, Math.max(1, count));
}

// A status label holds 40 characters.
const LABEL_MAX = 40;

export const TEXT = {
  apartment: { en: 'Flats €/m²', fr: 'Appart. €/m²', de: 'Wohnungen €/m²', es: 'Pisos €/m²' },
  house: { en: 'Houses €/m²', fr: 'Maisons €/m²', de: 'Häuser €/m²', es: 'Casas €/m²' },
  sales: {
    en: 'Sales, 12 months',
    fr: 'Ventes, 12 mois',
    de: 'Verkäufe, 12 Monate',
    es: 'Ventas, 12 meses',
  },
  flat: { en: 'Flat', fr: 'Appartement', de: 'Wohnung', es: 'Piso' },
  home: { en: 'House', fr: 'Maison', de: 'Haus', es: 'Casa' },
  rooms: { en: 'rm', fr: 'p.', de: 'Zi.', es: 'hab.' },
  flatShort: { en: 'Flat', fr: 'Appt', de: 'Whg.', es: 'Piso' },
  until: { en: 'up to', fr: "jusqu'à", de: 'bis', es: 'hasta' },
  noZone: {
    en: 'No zone followed yet: check the configuration of the integration.',
    fr: "Aucune zone suivie pour l'instant : vérifiez la configuration de l'intégration.",
    de: 'Noch keine Zone verfolgt: prüfe die Konfiguration der Integration.',
    es: 'Aún no se sigue ninguna zona: compruebe la configuración de la integración.',
  },
  waiting: {
    en: 'The DVF data are being downloaded: come back in a few minutes.',
    fr: 'Les données DVF sont en cours de téléchargement : revenez dans quelques minutes.',
    de: 'Die DVF-Daten werden geladen: schau in ein paar Minuten wieder vorbei.',
    es: 'Los datos DVF se están descargando: vuelva dentro de unos minutos.',
  },
  noSales: {
    en: 'No sale of a flat or a house published in this zone.',
    fr: "Aucune vente d'appartement ou de maison publiée dans cette zone.",
    de: 'In dieser Zone ist kein Verkauf einer Wohnung oder eines Hauses veröffentlicht.',
    es: 'No hay ninguna venta de piso o casa publicada en esta zona.',
  },
};

const t = (key, lang) => TEXT[key][lang] ?? TEXT[key].fr;
const shown = (value) => value !== false && value !== 'false';

/** The label and value of the status row of a sale. */
export function saleRow({ sale, distance }, lang, { addresses = true } = {}) {
  const [date, kind, surface, rooms, price, , , address] = sale;
  let label;
  if (addresses && address) {
    // The street first, cut to leave room for the type and the surface.
    const what = [t(kind === 'a' ? 'flatShort' : 'home', lang)];
    if (surface) {
      what.push(`${surface} m²`);
    }
    const tail = ` · ${what.join(' ')}`;
    const room = LABEL_MAX - tail.length;
    const street = address.length > room ? `${address.slice(0, room - 1).trimEnd()}…` : address;
    label = `${street}${tail}`;
  } else {
    const parts = [t(kind === 'a' ? 'flat' : 'home', lang)];
    if (rooms) {
      parts.push(`${rooms} ${t('rooms', lang)}`);
    }
    if (surface) {
      parts.push(`${surface} m²`);
    }
    label = parts.join(' · ');
  }
  const value = [formatEuros(price, lang), formatDate(date, lang)];
  if (distance !== null) {
    value.push(formatDistance(distance, lang));
  }
  return { label, value: value.join(' · '), color: WIDGET_COLORS.NEUTRAL };
}

/** The content of the widget, from `monitor.widgetData` (null: no zone). */
export function buildContent(data, settings = {}, lang = 'fr') {
  const ttl_seconds = 3600;
  if (!data) {
    return { ttl_seconds: 300, components: [{ type: 'text', text: t('noZone', lang) }] };
  }
  if (!data.stats) {
    return { ttl_seconds: 300, components: [{ type: 'text', text: t('waiting', lang) }] };
  }
  const { stats, latest, name } = data;
  const components = [];
  if (shown(settings.show_medians)) {
    // The number of sales behind a median follows its label: a small zone gives fragile ones.
    const tile = (key, value, unit, sales = null) => ({
      type: 'value',
      label: value === null || sales === null ? t(key, lang) : `${t(key, lang)} (${sales})`,
      value: value ?? '–',
      ...(value === null || !unit ? {} : { unit }),
      icon: key === 'sales' ? 'hash' : 'home',
    });
    components.push(
      tile('apartment', stats.current.apartment, '€/m²', stats.current.apartmentSales ?? null),
      tile('house', stats.current.house, '€/m²', stats.current.houseSales ?? null),
      tile('sales', stats.current.count, null),
    );
  }
  if (shown(settings.show_sales)) {
    if (latest.length) {
      components.push({
        type: 'status',
        items: latest
          .slice(0, salesCount(settings.sales_count))
          .map((row) => saleRow(row, lang, { addresses: shown(settings.show_addresses) })),
      });
    } else {
      components.push({ type: 'text', text: t('noSales', lang) });
    }
  }
  components.push({
    type: 'text',
    variant: 'caption',
    text: `DVF · ${t('until', lang)} ${formatVintage(stats.vintage, lang)} · ${name}`.slice(0, 80),
  });
  return { ttl_seconds, components };
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    get: (monitor, { settings = {}, language } = {}) =>
      buildContent(
        monitor.widgetData(settings.device || null, MAX_SALES),
        settings,
        language ?? 'fr',
      ),
  },
};
