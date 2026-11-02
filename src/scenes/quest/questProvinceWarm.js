// @ts-check
// ═══════════════════════════════════════════════════════════════════
// AUDIT RELEASE R2-5d (2026-10-26; the owner: "Take care of exclusions and gaps") - A PROVINCE'S PLACES MADE READY IN IDLE
// TIME, so asking for work past the Bay does not stall the frame.
//
// A quest's remote draw (systems/quest/place.js - DFU's Place.SelectRemoteTownSite darts, NEARBY-QUESTS' pools) reads a
// town by standing it: on the Bay a MAPS.BSA record (cheap, read once), past the Bay a place the build makes - an Arena
// town's clone and its outline, a capital's slice, a lair's plan - some 20 ms each the first time (measured on the
// freeware: an Imperial City slice 14-21 ms, a Skyrim town 19 ms). A draw that tried a hundred of them the first time
// stalled the parse for seconds (a temple's `remote house2` in the Imperial City: 20 s, every pool of slices stood). The
// build keeps a place once stood (its location index), so this warmer stands the questor's province's table in idle time
// while the player is in that province: nearest the player first, at most WARM_PER_TICK places a tick not stood before
// (each some 20 ms - a tick well under the 100 ms a frame may give), until the table is stood; again as the table moves
// (the player's pixel, the registry). The draw itself is untouched - the same table and the same darts, the same site on
// every client; a warm cache only makes it fast.
//
// Not a DFU member: DFU reads MAPS.BSA. Ledger A (R2-5).
// ═══════════════════════════════════════════════════════════════════
import { isProvinceRegion } from '../../formats/mapsTables.js';
import { longitudeLatitudeToMapPixel } from '../../formats/mapsFile.js';

/** How many places of a province's table a tick may stand for the first time (each some 20 ms). */
export const WARM_PER_TICK = 2;
/** How long, ms, between ticks where the host gives no idle callback - and while the player is on the Bay. */
export const WARM_WAIT_MS = 250;
/** The warmer whose loop runs (the last started). */
let liveWarm = 0;

/**
 * The warmer.
 * @param {{ provinces: { getRegion: (r: number) => any, getLocation: (r: number, i: number) => any, sliceIndexAt?: (px: number, py: number) => any },
 *   regionNow: () => number, origin: () => ?{ x: number, y: number },
 *   schedule?: ((tick: () => void) => void) | null }} deps `provinces` the quest layer's (scenes/quest/questProvinceSites.js),
 *   `regionNow` the questor's region, `origin` the questor's pixel, `schedule` the host's idle door (null: ticks are the
 *   caller's - the suite's)
 */
export function createProvinceWarm({ provinces, regionNow, origin, schedule = null }) {
  /** the map ids stood (warmed) - a row stood once costs nothing again */
  const warmed = new Set();
  /** @type {{ region: any, order: number[] } | null} */
  let plan = null;
  let stopped = false;
  /** The rows of `region` nearest the questor first (a tie by row). @param {any} region */
  const orderOf = (region) => {
    const o = origin();
    const at = (/** @type {any} */ row) => {
      const p = longitudeLatitudeToMapPixel(row.longitude, row.latitude);
      return o ? Math.max(Math.abs(p.x - o.x), Math.abs(p.y - o.y)) : 0;
    };
    return region.mapTable
      .map((row, i) => [i, at(row)])
      .sort((a, b) => a[1] - b[1] || a[0] - b[0])
      .map((x) => x[0]);
  };
  /** One tick: up to WARM_PER_TICK rows of the questor's province not stood before, stood. Answers how many it stood. */
  function tick() {
    const r = regionNow();
    if (!isProvinceRegion(r)) return 0;
    const region = provinces.getRegion(r);
    if (!region) return 0;
    if (plan?.region !== region) plan = { region, order: orderOf(region) };
    let stood = 0;
    for (const i of plan.order) {
      const row = region.mapTable[i];
      if (!row || warmed.has(row.mapId)) continue;
      warmed.add(row.mapId);
      provinces.getLocation(r, i);
      provinces.sliceIndexAt?.(row.px, row.py); // R2-5f: a capital slice's sites by kind, read while it is warm
      if (++stood >= WARM_PER_TICK) break;
    }
    return stood;
  }
  /** A tick in the host's next idle period; after one that stood nothing (the Bay, a table all stood) a wait first. A
   *  warmer started after this one (a world booted again) ends this one's loop: one loop a page. */
  let id = 0;
  const loop = () => {
    if (stopped || !schedule || id !== liveWarm) return;
    schedule(() => {
      let n = 0;
      try {
        n = tick();
      } catch (e) {
        console.warn('[quest] province warm:', e);
      }
      if (n > 0) loop();
      else globalThis.setTimeout?.(loop, WARM_WAIT_MS);
    });
  };
  return {
    tick,
    /** Whether every row of the questor's province's table is stood. */
    done() {
      const r = regionNow();
      const region = isProvinceRegion(r) ? provinces.getRegion(r) : null;
      return !region || region.mapTable.every((/** @type {any} */ row) => warmed.has(row.mapId));
    },
    start() {
      stopped = false;
      id = ++liveWarm;
      loop();
    },
    stop() {
      stopped = true;
    },
  };
}

/** The browser's idle door: requestIdleCallback where it is (a tick in an idle period, WARM_WAIT_MS at the latest),
 *  else a timer. @returns {((tick: () => void) => void) | null} */
export function idleSchedule() {
  const g = /** @type {any} */ (globalThis);
  if (typeof g.requestIdleCallback === 'function')
    return (fn) => g.requestIdleCallback(fn, { timeout: WARM_WAIT_MS * 4 });
  if (typeof g.setTimeout === 'function' && typeof g.window !== 'undefined')
    return (fn) => g.setTimeout(fn, WARM_WAIT_MS);
  return null;
}
