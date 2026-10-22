// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TOWN-ECON (bible/06-Systems/Town-Economy-Arc.md) - THE TOWN ECONOMY AS THE WORLD HOST WIRES IT (HOST-SPLIT: the
// module the host wires, src/scenes/fishHost.js's shape - constructed once, the host's own scope does not grow).
//
// TE1's reading (systems/town/townEcon.js: a town's Prosperity, its counters' factor, its card) and TE2's book
// (net/townEconBook.js: the towns' players' shares read, the Watch's ticks kept at a town's pixel and claimed, the town
// walked into witnessed) - the share the reading's `players`. Online only: offline no book is built and the reading
// answers DFU's counters and no card. SEA-TRADE (section 8): a port town's sea lanes (the reading's `lanesAt`, off the
// map's lane network), its exchange's factors and band for the harbour office, and a captain's dealing there told to
// the book.
// ═══════════════════════════════════════════════════════════════════
import { createTownEcon } from '../systems/town/townEcon.js';
import { createTownEconBook, parseTownCommand, townAuditLines } from '../net/townEconBook.js';   // AUDIT TOWN-ECON 2 SVC-1: a developer's /town
import { dayTurnMs } from '../net/dayTurn.js';   // DAY-TURN: this page's moment in the day's turn
import { isEconTown } from '../net/townEconLaw.js';
import { accountTowns, accountRefusalText } from '../net/accountClient.js';
import { appStorage } from '../systems/appStorage.js';

/** AUDIT TOWN-ECON 2 LIV-8: the market bands kept, a town a living-world day. */
export const MARKET_BANDS_MAX = 4096;

/**
 * @param {{ online: () => boolean, townOf: (mapId: number) => any, seatAt: (mapId: number) => any, seats: () => (any[]|null),
 *   raidedAt: (px: number, py: number) => boolean, nowMs: () => number, locAt?: (x: number, y: number) => any,
 *   portLanes?: () => (ReadonlyArray<{ a: { px: number, py: number }, b: { px: number, py: number } }> | null),
 *   door?: any, storage?: any, chapters?: any, clockHeard?: () => boolean, seatsHeard?: () => boolean, onBandsReady?: () => void,
 *   regionHere?: () => (number|null) }} host
 *   `townOf` a town's row by its map id (`{ name, px, py, region, location, type }`); `nowMs` the relay's clock (a
 *   shared day's, and a tick's life); `locAt` the MAPS location at a map pixel (its `mapTableData`: `mapId`,
 *   `locationType`), or null; `portLanes` the map's sea lanes (systems/naval/seaLanes.js laneNetwork), null until the
 *   map is read - SEA-TRADE; `door` the towns' door
 *   (net/accountClient.js accountTowns - the page's own online, none offline); `chapters` the chapter sheet
 *   (net/chapterSheet.js - TE3: the area's chapters' patrons on the card); AUDIT TOWN-ECON 2: `clockHeard` whether the
 *   relay's clock has been heard (CLI-6: a tick's life is the relay's, never this device's), `seatsHeard` whether the
 *   seat list has answered and `onBandsReady` the trips' memo let go once the band stands on what was read (CLI-1),
 *   `regionHere` the region the player stands in (the `/town audit`)
 */
export function createTownEconHost({ locAt = () => null, portLanes = () => null, storage = appStorage(), door = undefined, chapters = null,
  clockHeard = () => true, seatsHeard = () => true, onBandsReady = () => {}, regionHere = () => null, ...reading }) {
  const towns = door !== undefined ? door : reading.online() ? accountTowns({ fetch: (u, i) => globalThis.fetch(u, i), storage }) : null;
  const book = towns ? createTownEconBook({ door: towns, storage, me: towns.me, isTownPixel: (x, y) => isEconTown(locAt(x, y)?.locationType), relayNowS: () => (clockHeard() ? Math.floor(reading.nowMs() / 1000) : null), turnMs: dayTurnMs() }) : null;   // DAY-TURN
  /** SEA-TRADE: a port's sea lanes by its map pixel, counted once the map's lanes stand (a lane at each of its two ports). */
  let laneCounts = null;
  const lanesAt = (/** @type {number} */ px, /** @type {number} */ py) => {
    if (!laneCounts) {
      let lanes = null;
      try { lanes = portLanes(); } catch { lanes = null; }   // the map unread, or the host's lanes not yet stood
      if (!lanes?.length) return 0;
      laneCounts = new Map();
      for (const l of lanes) for (const p of [l.a, l.b]) { const k = `${p.px},${p.py}`; laneCounts.set(k, (laneCounts.get(k) ?? 0) + 1); }
    }
    return laneCounts.get(`${px},${py}`) ?? 0;
  };
  const econ = createTownEcon({ ...reading, players: (mapId) => book?.shareOf(mapId) ?? 0, patronsIn: (region) => chapters?.patronsIn(region) ?? [], lanesAt });
  /** SEA-TRADE: the town of a port (its map pixel's location), or null - none past the Veil. @param {any} port */
  const portTown = (port) => {
    if (!port || port.ether || !Number.isSafeInteger(port.px) || !Number.isSafeInteger(port.py)) return null;
    const id = locAt(port.px, port.py)?.mapId;
    return id == null ? null : id >>> 0;
  };
  /** @type {Map<string, string|null>} */
  const marketBands = new Map();
  let bandsReady = false;
  /** AUDIT TOWN-ECON 2 CLI-1 (LIV-1, REC-3): whether the band stands on what the page has read - the players' shares'
   *  first answer and the seat list's. Before, a band is the TE1 terms' alone: it is answered, never kept, and once both
   *  have answered the kept bands and the trips planned on them go (`onBandsReady`, after the ask that saw it). */
  const ready = () => {
    if (bandsReady) return true;
    if (!book || !book.heard || !seatsHeard()) return !book;   // offline: no band to wait for
    bandsReady = true;
    marketBands.clear();
    setTimeout(() => { try { onBandsReady(); } catch { /* the trips' memo not yet stood: nothing planned on it */ } }, 0);
    return true;
  };
  return Object.assign(econ, {
    book,
    /** TOWN-ECON TE3: a market town's band on a living-world day (systems/livingWorld/trips.js marketDay), read at its first
     *  asking and kept for that day - a day's market, and the plans made round it, never change under it (two pages
     *  agree for the days both first asked after the same reads: a band's crossing reaches a carter's cycle at its next).
     *  AUDIT TOWN-ECON 2 CLI-1: kept only once the band stands on what was read; LIV-8: the oldest asked let go one by
     *  one past MARKET_BANDS_MAX, never the whole. @param {any} town @param {number} day */
    marketBandOf(town, day) {
      if (!ready()) return econ.bandOf(town?.mapId);
      const k = `${town?.mapId >>> 0}:${day}`;
      if (!marketBands.has(k)) {
        if (marketBands.size >= MARKET_BANDS_MAX) marketBands.delete(/** @type {string} */ (marketBands.keys().next().value));
        marketBands.set(k, econ.bandOf(town?.mapId));
      }
      return marketBands.get(k) ?? null;
    },
    /** AUDIT TOWN-ECON 2 SVC-1: a developer's chat word - `/town audit` (the region's confirmed towns, each set beside the
     *  town this client's map holds at its pixel) or `/town strike <map id>`. NEVER GUARDED HERE (RED1's law): the
     *  service asks whether this player may. Answers whether the line was the word. @param {unknown} text
     *  @param {(line: string) => void} say */
    command(text, say) {
      const cmd = parseTownCommand(text);
      if (!cmd) return false;
      if ('error' in cmd) { say(cmd.error); return true; }
      if (!towns?.strike) { say(accountRefusalText('towns-closed')); return true; }
      if (cmd.op === 'strike') {
        towns.strike(cmd.key).then((r) => say(r?.ok ? `Town ${cmd.key} is struck from the registry (${r.data?.reports ?? 0} reports).` : accountRefusalText(r?.error)), () => say(accountRefusalText('server')));
        return true;
      }
      towns.audit(regionHere()).then((r) => {
        if (!r?.ok) { say(accountRefusalText(r?.error)); return; }
        for (const line of townAuditLines(r.data, (x, y) => locAt(x, y)?.mapId)) say(line);
      }, () => say(accountRefusalText('server')));
      return true;
    },
    /** SEA-TRADE: a port's exchange factors (systems/naval/tradeGoods.js exchangeOf `town`), or null. @param {any} port */
    exchangeAt: (port) => { const id = portTown(port); return id == null ? null : econ.exchangeOf(id); },
    /** SEA-TRADE: a port town's band, for the exchange's lede, or null. @param {any} port */
    bandAt: (port) => { const id = portTown(port); return id == null ? null : econ.bandOf(id); },
    /** SEA-TRADE: a captain's dealing at a port's exchange - the book vouches it with the Watch tick that stood them
     *  there. @param {any} port */
    seaDeal: (port) => (book && portTown(port) != null ? book.seaDeal(port.px, port.py) : false),
    /** The Watch's tick (net/online.js onWatch), kept where it stands in a town. @param {unknown} r */
    keepWatch: (r) => book?.keepWatch(r) ?? false,
    /** The town walked into (its map id), reported to the registry once a day - a town with an economy alone.
     *  @param {unknown} mapId */
    witness(mapId) {
      if (!book || !reading.online() || mapId == null || !Number.isFinite(Number(mapId))) return false;
      const id = Number(mapId) >>> 0;
      const t = reading.townOf(id);
      if (!t || !isEconTown(t.type)) return false;
      book.witness({ map: id, px: t.px, py: t.py, region: t.region, location: t.location });
      return true;
    },
  });
}
