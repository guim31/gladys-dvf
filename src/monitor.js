// -----------------------------------------------------------------------------
// The monitor: resolves the zones of the configuration, keeps the DVF files of
// their communes in /data for the latest vintage, publishes the states of the
// zone devices and fires the `new_sales` trigger when a vintage brings sales.
//
// Cadence: an hourly timer of its own (the devices are published with
// should_poll: false). Each tick republishes the states (unchanged values
// again after 12 h, the heartbeat Gladys needs), and once a day reads the
// small index of files.data.gouv.fr to see whether a new vintage is out (two a
// year); only then are the files downloaded again, one per commune and year.
// A failed read is retried at the next tick, the last data kept meanwhile.
//
// Zones: around a house of Gladys (its commune, or the communes a circle
// touches, see src/geo.js), every located house when none is chosen, or a
// commune by its INSEE code. The houses are read again once a day; the
// communes of a position are kept in memory only (no position in /data).
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import {
  DVF_BASE,
  fileUrl,
  filesOfCommune,
  hasDvf,
  latestSales,
  latestVintage,
  parseSales,
  salesInZone,
  statsOf,
  yearsOf,
} from './dvf.js';
import { buildDevice, zoneIds } from './devices.js';
import { Geo } from './geo.js';
import { getText } from './http.js';
import { STATUS, formatDate, formatVintage, render, summaries, summary } from './messages.js';

const logger = createLogger({ name: 'dvf-monitor' });

export const TRIGGER_KEY = 'new_sales';
export const WIDGET_KEY = 'sales';
// The compact form of the sales saved in /data: 2 adds the address (1.1).
export const SALES_FORMAT = 2;

const HOUR = 3600 * 1000;
export const DEFAULT_TIMINGS = {
  tickMs: HOUR,
  checkMs: 24 * HOUR,
  locateMs: 24 * HOUR,
  heartbeatMs: 12 * HOUR,
};

const located = (house) => Number.isFinite(house.latitude) && Number.isFinite(house.longitude);

class ZoneProblem extends Error {
  constructor(key, params = {}) {
    super(key);
    this.key = key;
    this.params = params;
  }
}

export class Monitor {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {import('./store.js').Store} options.store
   * @param {Function} [options.fetch]
   * @param {boolean} [options.timers] false in the tests, which call tick()
   * @param {Function} [options.now] clock, ms
   * @param {object} [options.timings]
   */
  constructor({ gladys, store, fetch: fetchImpl, timers = true, now, timings } = {}) {
    this.gladys = gladys;
    this.store = store;
    this.fetch = fetchImpl ?? globalThis.fetch;
    this.geo = new Geo({ fetch: this.fetch });
    this.timers = timers;
    this.now = now ?? (() => Date.now());
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.config = null;
    this.data = { communes: {}, zones: {} };
    this.zones = [];
    this.problems = [];
    this.results = new Map();
    this.circles = new Map();
    this.failures = new Map();
    this.lastLocateAt = null;
    this.lastStatus = null;
    this.queue = Promise.resolve();
    this.timer = null;
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    this.config = config;
    const stored = await this.store.load();
    this.data = {
      vintage: typeof stored.vintage === 'string' ? stored.vintage : null,
      checkedAt: Number.isFinite(stored.checkedAt) ? stored.checkedAt : null,
      communes: stored.communes && typeof stored.communes === 'object' ? stored.communes : {},
      zones: stored.zones && typeof stored.zones === 'object' ? stored.zones : {},
    };
    // Armed first: a failure below still leaves the hourly retries running.
    if (this.timers && !this.timer) {
      this.timer = setInterval(() => {
        this.tick().catch((err) => logger.error('Tick failed', err));
      }, this.timings.tickMs);
    }
    await this.locate();
    await this.publishDiscovered();
    await this.publishStates();
    // The first download may take a while (a big city): never block the start.
    this.run(() => this.check());
  }

  async stop() {
    clearInterval(this.timer);
    this.timer = null;
    await this.queue.catch(() => {});
    await this.store.flush();
  }

  /** One job at a time: the timer, an action and a new configuration never overlap. */
  run(job) {
    const result = this.queue.then(job);
    this.queue = result.catch((err) => logger.error('Background job failed', err));
    return result;
  }

  /** Resolves once the jobs queued so far are done. */
  idle() {
    return this.queue;
  }

  tick() {
    return this.run(async () => {
      if (
        this.lastLocateAt === null ||
        this.now() - this.lastLocateAt >= this.timings.locateMs ||
        this.problems.length
      ) {
        const before = this.zoneSignature();
        await this.locate();
        if (this.zoneSignature() !== before) {
          await this.publishDiscovered();
        }
      }
      await this.check();
    });
  }

  reconfigure(config) {
    return this.run(async () => {
      this.config = config;
      await this.locate();
      await this.publishDiscovered();
      await this.check();
    });
  }

  resync(config) {
    return this.reconfigure(config);
  }

  /** The "Check now" action: zones and vintage read again, the summary of each zone. */
  readNow() {
    return this.run(async () => {
      logger.info('Check requested');
      await this.locate();
      await this.publishDiscovered();
      await this.check({ force: true });
      if (this.zones.length === 0) {
        return this.currentProblem() ?? render(STATUS, 'noHouse');
      }
      const texts = this.zones.map((zone) => summaries(zone, this.resultOf(zone)?.stats ?? null));
      return Object.fromEntries(
        Object.keys(texts[0]).map((lang) => [lang, texts.map((text) => text[lang]).join(' ')]),
      );
    });
  }

  // --- Failures, logged once -------------------------------------------------

  failed(key, message) {
    if (this.failures.has(key)) {
      logger.debug(message);
    } else {
      logger.warn(message);
    }
    this.failures.set(key, message);
  }

  recovered(key, message) {
    if (this.failures.delete(key)) {
      logger.info(message);
    }
  }

  // --- Zones -----------------------------------------------------------------

  zoneSignature() {
    return JSON.stringify(
      this.zones.map((zone) => [zone.platformId, zone.label, zone.communes.map((c) => c.code)]),
    );
  }

  async locate() {
    const zones = [];
    const problems = [];
    try {
      if (this.config.position === 'commune') {
        zones.push(await this.communeZone());
      } else {
        for (const result of await this.houseZones()) {
          if (result instanceof ZoneProblem) {
            problems.push(result);
          } else {
            zones.push(result);
          }
        }
      }
      this.recovered('geo', 'geo.api.gouv.fr can be reached again');
    } catch (err) {
      if (err instanceof ZoneProblem) {
        problems.push(err);
      } else if (err.name === 'HttpError') {
        this.failed('geo', `Cannot resolve the zone: ${err.message}`);
        // Keep the zones known for the same configuration: a short outage changes nothing.
        if (this.zones.length && this.zonesConfig === JSON.stringify(this.config)) {
          this.problems = [];
          return;
        }
        problems.push(new ZoneProblem('geoDown'));
      } else {
        throw err;
      }
    }
    this.lastLocateAt = this.now();
    this.zonesConfig = JSON.stringify(this.config);
    this.zones = zones;
    this.problems = problems;
    await this.updateStatus();
  }

  async communeZone() {
    const { communeCode, communeInvalid } = this.config;
    if (communeInvalid) {
      throw new ZoneProblem('communeInvalid', { value: communeInvalid.slice(0, 20) });
    }
    if (!communeCode) {
      throw new ZoneProblem('noCommune');
    }
    const commune = await this.geo.commune(communeCode);
    if (!commune) {
      throw new ZoneProblem('communeUnknown', { code: communeCode });
    }
    if (!hasDvf(commune.code)) {
      throw new ZoneProblem('noDvf', { name: commune.name });
    }
    return {
      platformId: commune.code,
      label: commune.name,
      center: null,
      radius: null,
      communes: filesOfCommune(commune.code).map((code) => ({ code, name: commune.name })),
    };
  }

  /** One zone per located house (or the chosen one), or a ZoneProblem in its place. */
  async houseZones() {
    let houses;
    try {
      houses = await this.gladys.getHouses();
      this.recovered('houses', 'The houses of Gladys can be read again');
    } catch (err) {
      this.failed('houses', `Cannot read the houses of Gladys: ${err.message}`);
      // The zones known stay only for the configuration they were found with.
      if (this.zones.length && this.zonesConfig === JSON.stringify(this.config)) {
        return this.zones;
      }
      throw new ZoneProblem('noHouse');
    }
    const { houseSelector } = this.config;
    if (houseSelector) {
      const chosen = houses.find((house) => house.selector === houseSelector);
      if (!chosen || !located(chosen)) {
        throw new ZoneProblem('houseNotFound', { name: chosen?.name ?? houseSelector });
      }
      houses = [chosen];
    } else {
      houses = houses.filter(located);
      if (houses.length === 0) {
        throw new ZoneProblem('noHouse');
      }
    }
    const results = [];
    for (const house of houses) {
      const communes = await this.communesOfHouse(house);
      if (communes.length === 0) {
        results.push(new ZoneProblem('outside'));
        continue;
      }
      const withDvf = communes.filter((commune) => hasDvf(commune.code));
      if (withDvf.length === 0) {
        results.push(new ZoneProblem('noDvf', { name: communes[0].name }));
        continue;
      }
      results.push({
        platformId: `house-${house.selector}`,
        label: house.name,
        center: { latitude: house.latitude, longitude: house.longitude },
        radius: this.config.radius,
        communes: withDvf,
      });
    }
    return results;
  }

  async communesOfHouse(house) {
    const { radius } = this.config;
    const key = `${house.latitude.toFixed(6)},${house.longitude.toFixed(6)},${radius ?? 'commune'}`;
    if (!this.circles.has(key)) {
      const communes = radius
        ? await this.geo.communesAround(house.latitude, house.longitude, radius)
        : await this.geo.communeAt(house.latitude, house.longitude).then((c) => (c ? [c] : []));
      this.circles.set(key, communes);
    }
    return this.circles.get(key);
  }

  // --- Status ----------------------------------------------------------------

  currentProblem() {
    const [problem] = this.problems;
    if (problem) {
      return render(STATUS, problem.key, problem.params);
    }
    if (this.failures.has('dvf') && this.zones.some((zone) => !this.resultOf(zone))) {
      return render(STATUS, 'dvfDown');
    }
    return null;
  }

  async updateStatus() {
    const problem = this.currentProblem();
    const key = JSON.stringify(problem);
    if (key === this.lastStatus) {
      return;
    }
    this.lastStatus = key;
    await this.gladys
      .setConnectionStatus(problem === null, problem ?? undefined)
      .catch((err) => logger.debug(`Cannot set the connection status: ${err.message}`));
  }

  // --- DVF files -------------------------------------------------------------

  neededCommunes() {
    return [...new Set(this.zones.flatMap((zone) => zone.communes.map((commune) => commune.code)))];
  }

  async check({ force = false } = {}) {
    const needed = this.neededCommunes();
    // Up to date: the vintage, in the current compact form (1.0 saved no address).
    const upToDate = (code, vintage) =>
      this.data.communes[code]?.vintage === vintage &&
      this.data.communes[code]?.format === SALES_FORMAT;
    const complete = (vintage) => needed.every((code) => upToDate(code, vintage));
    const fresh =
      this.data.checkedAt !== null && this.now() - this.data.checkedAt < this.timings.checkMs;
    if (!force && fresh && this.data.vintage && complete(this.data.vintage)) {
      await this.publishStates();
      // A zone changed with its communes already here: new baseline, new widget.
      if (await this.fireTriggers()) {
        this.save();
      }
      return;
    }
    try {
      const vintage = latestVintage(
        await getText(this.fetch, `${DVF_BASE}/`, { timeoutMs: 20000 }),
      );
      if (!vintage) {
        throw Object.assign(new Error('files.data.gouv.fr: no vintage in the index of geo-dvf'), {
          name: 'HttpError',
        });
      }
      // Every file of the zones is read before anything changes: a failure
      // halfway keeps the previous vintage whole, never a mix of two.
      const staged = {};
      for (const code of needed) {
        if (!upToDate(code, vintage)) {
          staged[code] = {
            vintage,
            format: SALES_FORMAT,
            sales: await this.download(vintage, code),
          };
        }
      }
      if (vintage !== this.data.vintage) {
        logger.info(`DVF data published up to ${vintage}`);
      }
      Object.assign(this.data.communes, staged);
      this.data.vintage = vintage;
      this.data.checkedAt = this.now();
      // Forget the communes no zone needs, unless the zones are unknown for now.
      if (this.zones.length && this.problems.length === 0) {
        for (const code of Object.keys(this.data.communes)) {
          if (!needed.includes(code)) {
            delete this.data.communes[code];
          }
        }
      }
      this.recovered('dvf', 'files.data.gouv.fr can be reached again');
    } catch (err) {
      if (err.name !== 'HttpError') {
        throw err;
      }
      this.failed('dvf', `Cannot read the DVF files: ${err.message}`);
    }
    await this.publishStates();
    await this.fireTriggers();
    this.save();
    await this.updateStatus();
  }

  async download(vintage, code) {
    const sales = [];
    let found = 0;
    for (const year of yearsOf(vintage)) {
      const csv = await getText(this.fetch, fileUrl(vintage, year, code), { accept: 'text/csv' });
      // No file: no sale in this commune that year.
      if (csv !== null) {
        found += 1;
        sales.push(...parseSales(csv));
      }
    }
    // A commune that had sales and now has no file at all: the new vintage is
    // listed before its files are all copied. Retried at the next tick.
    if (found === 0 && this.data.communes[code]?.sales?.length) {
      throw Object.assign(new Error(`files.data.gouv.fr: ${vintage} has no file for ${code} yet`), {
        name: 'HttpError',
      });
    }
    logger.debug(`${code}: ${sales.length} sales downloaded for ${vintage}`);
    return sales;
  }

  save() {
    return this.store.save({
      version: 1,
      vintage: this.data.vintage,
      checkedAt: this.data.checkedAt,
      communes: this.data.communes,
      zones: this.data.zones,
    });
  }

  // --- Results ---------------------------------------------------------------

  /** `{ stats, sales }` of a zone for the vintage on disk, or null while it is missing. */
  resultOf(zone) {
    const { vintage } = this.data;
    if (
      !vintage ||
      zone.communes.some((commune) => this.data.communes[commune.code]?.vintage !== vintage)
    ) {
      return null;
    }
    const key = JSON.stringify([
      vintage,
      zone.communes.map((c) => c.code),
      zone.center,
      zone.radius,
    ]);
    const cached = this.results.get(zone.platformId);
    if (cached?.key === key) {
      return cached;
    }
    const sales = salesInZone(
      zone.communes.map((commune) => this.data.communes[commune.code].sales),
      { center: zone.center, radius: zone.radius },
    );
    const result = { key, stats: statsOf(sales, vintage), sales };
    this.results.set(zone.platformId, result);
    return result;
  }

  zoneOfDevice(externalId) {
    return (
      this.zones.find((zone) => zoneIds(this.gladys, zone.platformId).device === externalId) ?? null
    );
  }

  /** The name the user gave the device in Gladys, else the zone label. */
  nameOf(zone) {
    const id = zoneIds(this.gladys, zone.platformId).device;
    return (
      (this.gladys.devices ?? []).find((device) => device.external_id === id)?.name ?? zone.label
    );
  }

  // --- Gladys ----------------------------------------------------------------

  async publishDiscovered() {
    const devices = this.zones.map((zone) => buildDevice(this.gladys, zone, this.config.language));
    await this.gladys.publishDiscoveredDevices(devices);
  }

  statesOf(zone) {
    const result = this.resultOf(zone);
    if (!result) {
      return [];
    }
    const { stats } = result;
    const ids = zoneIds(this.gladys, zone.platformId);
    const lang = this.config.language;
    const states = [];
    const add = (key, value) => {
      if (typeof value === 'number') {
        states.push({ device_feature_external_id: ids[key], state: value });
      } else if (typeof value === 'string' && value !== '') {
        states.push({ device_feature_external_id: ids[key], text: value });
      }
    };
    add('apartment', stats.current.apartment);
    add('house', stats.current.house);
    add('apartment_previous', stats.previous.apartment);
    add('house_previous', stats.previous.house);
    add('sales', stats.current.count);
    add('sales_previous', stats.previous.count);
    add('last_sale', stats.lastDate ? formatDate(stats.lastDate, lang) : null);
    add('vintage', formatVintage(stats.vintage, lang));
    return states;
  }

  /** States of the zones whose device exists in Gladys (`only`: one device). */
  async publishStates(only = null) {
    const created = new Set((this.gladys.devices ?? []).map((device) => device.external_id));
    if (only) {
      created.add(only);
    }
    const states = this.zones
      .filter((zone) => {
        const id = zoneIds(this.gladys, zone.platformId).device;
        return only ? id === only : created.has(id);
      })
      .flatMap((zone) => this.statesOf(zone));
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeatMs });
      this.recovered('states', 'States published again');
    } catch (err) {
      this.failed('states', `Cannot publish the states: ${err.message}`);
    }
  }

  /**
   * `new_sales`: a zone whose latest sale is newer than at the previous
   * vintage. The first vintage seen for a zone (or after the zone changed)
   * only sets the baseline.
   */
  async fireTriggers() {
    let fired = false;
    let changed = false;
    for (const zone of this.zones) {
      const result = this.resultOf(zone);
      if (!result) {
        continue;
      }
      const { stats, sales } = result;
      const signature = `${zone.communes.map((c) => c.code).join(',')}|${zone.radius ?? 'commune'}`;
      const previous = this.data.zones[zone.platformId];
      if (
        previous?.signature === signature &&
        previous.vintage !== stats.vintage &&
        typeof previous.lastDate === 'string'
      ) {
        const count = sales.filter(({ sale }) => sale[0] > previous.lastDate).length;
        if (count > 0) {
          await this.gladys
            .publishSceneEvent(TRIGGER_KEY, this.eventOf(zone, stats, count))
            .then(() => logger.info(`${count} new sales published in a followed zone`))
            .catch((err) => logger.warn(`Cannot fire ${TRIGGER_KEY}: ${err.message}`));
          fired = true;
        }
      }
      if (previous?.vintage !== stats.vintage || previous?.signature !== signature) {
        changed = true;
        this.data.zones[zone.platformId] = {
          signature,
          vintage: stats.vintage,
          lastDate: stats.lastDate,
        };
      }
    }
    for (const key of Object.keys(this.data.zones)) {
      if (
        this.zones.length &&
        this.problems.length === 0 &&
        !this.zones.some((zone) => zone.platformId === key)
      ) {
        delete this.data.zones[key];
      }
    }
    if (fired || changed) {
      this.refreshWidget();
    }
    return changed;
  }

  eventOf(zone, stats, count) {
    const lang = this.config.language;
    return {
      device: zoneIds(this.gladys, zone.platformId).device,
      count,
      zone: this.nameOf(zone),
      vintage: formatVintage(stats.vintage, lang),
      sales_12_months: stats.current.count,
      apartment_median: stats.current.apartment,
      house_median: stats.current.house,
      summary: summary(zone, stats, lang, this.latestOf(zone)),
    };
  }

  /** Fire-and-forget: the core rate-limits it to one call every 10 s. */
  refreshWidget() {
    Promise.resolve()
      .then(() => this.gladys.requestWidgetRefresh(WIDGET_KEY))
      .catch((err) => logger.debug(`Cannot refresh the widget: ${err.message}`));
  }

  // --- Handlers --------------------------------------------------------------

  // Outside the queue: a long first download must not hold the Discover tab.
  publishDiscoveredNow() {
    return this.publishDiscovered();
  }

  async onDeviceCreated(device) {
    await this.gladys.forgetPublishedStates(device.external_id);
    await this.publishStates(device.external_id);
    this.refreshWidget();
  }

  async onDeviceChanged() {
    this.refreshWidget();
  }

  async poll(device) {
    await this.publishStates(device.external_id);
  }

  /** The scene action: one sentence on the chosen zone (or the first one). */
  sceneSummary(fields = {}) {
    const zone = (fields.device && this.zoneOfDevice(fields.device)) || this.zones[0];
    if (!zone) {
      throw new Error('No zone followed: check the configuration of the integration');
    }
    const stats = this.resultOf(zone)?.stats ?? null;
    const outputs = {
      summary: summary(zone, stats, this.config.language, this.latestOf(zone)),
      sales: stats?.current.count ?? 0,
    };
    if (stats?.current.apartment != null) {
      outputs.apartment_median = stats.current.apartment;
    }
    if (stats?.current.house != null) {
      outputs.house_median = stats.current.house;
    }
    return outputs;
  }

  /** The latest one-dwelling sale of a zone, or null. */
  latestOf(zone) {
    const result = this.resultOf(zone);
    return result ? (latestSales(result.sales, 1)[0] ?? null) : null;
  }

  /** What the widget shows for a device (or the first zone). */
  widgetData(deviceId, limit = 10) {
    const zone = (deviceId && this.zoneOfDevice(deviceId)) || this.zones[0];
    if (!zone) {
      return null;
    }
    const result = this.resultOf(zone);
    return {
      zone,
      name: this.nameOf(zone),
      stats: result?.stats ?? null,
      latest: result ? latestSales(result.sales, limit) : [],
    };
  }
}
