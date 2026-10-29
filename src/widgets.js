// -----------------------------------------------------------------------------
// The `sales` dashboard widget: the median prices of a zone (three tiles) and
// its latest published sales (one status row each, 10 at most: type, rooms,
// surface, price, date, distance from the house). Each block can be hidden in
// the widget settings. No address is ever shown (DVF reuse terms).
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { WIDGET_KEY } from './monitor.js';
import { formatDate, formatDistance, formatEuros, formatVintage } from './messages.js';

export const MAX_SALES = 10;

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
export function saleRow({ sale, distance }, lang) {
  const [date, kind, surface, rooms, price] = sale;
  const parts = [t(kind === 'a' ? 'flat' : 'home', lang)];
  if (rooms) {
    parts.push(`${rooms} ${t('rooms', lang)}`);
  }
  if (surface) {
    parts.push(`${surface} m²`);
  }
  const value = [formatEuros(price, lang), formatDate(date, lang)];
  if (distance !== null) {
    value.push(formatDistance(distance, lang));
  }
  return { label: parts.join(' · '), value: value.join(' · '), color: WIDGET_COLORS.NEUTRAL };
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
    const tile = (key, value, unit) => ({
      type: 'value',
      label: t(key, lang),
      value: value ?? '–',
      ...(value === null || !unit ? {} : { unit }),
      icon: key === 'sales' ? 'hash' : 'home',
    });
    components.push(
      tile('apartment', stats.current.apartment, '€/m²'),
      tile('house', stats.current.house, '€/m²'),
      tile('sales', stats.current.count, null),
    );
  }
  if (shown(settings.show_sales)) {
    if (latest.length) {
      components.push({
        type: 'status',
        items: latest.slice(0, MAX_SALES).map((row) => saleRow(row, lang)),
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
