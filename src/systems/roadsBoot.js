// ═══════════════════════════════════════════════════════════════════
// R6 — THE SWITCH AND THE CACHE.
//
// R1-R5 can generate a road network, cache it, draw it, route travel
// over it and paint it on the ground. None of that happens until
// something decides to bake and hands the result to the world, which
// is this module.
//
// ── WHY IT IS OFF BY DEFAULT ─────────────────────────────────────
//
// The bake is about twenty-six seconds at full Iliac Bay scale. That
// is a fine price ONCE, for a player who asked for roads; it is not a
// fine price silently, on someone's first boot, for a feature they did
// not know existed. So the preference defaults false and the cost is
// paid on the turn, not on arrival - and after the first time it is
// paid at all, because the artifact is cached.
//
// It lives in systems/uiPrefs.js rather than systems/settings.js for
// that module's own stated reason: the settings store is DFU's
// SettingsManager and holds exactly 171 keys, with a parity pin
// asserting that count. A port-invented preference does not belong in
// a file whose whole point is that it is DFU's.
//
// ── EVERY DEPENDENCY IS INJECTED ─────────────────────────────────
//
// This module reaches for nothing: not the store, not the readers, not
// the clock. That keeps it node-testable without ARENA2 and without a
// browser, and it is the only reason the cache LAW - take a good
// artifact, refuse a torn one, rebake and write back - is pinned at
// all rather than hoped for behind an IndexedDB call.
// ═══════════════════════════════════════════════════════════════════

import { MAP_WIDTH, MAP_HEIGHT } from '../formats/woodsFile.js';
import { isWaterPixel } from '../ui/overworldModel.js';
import { bakeRoads, loadOrBakeRoads, ROADS_V } from './roadBake.js';

/** The cache key. ROADS_V rides IN it as well as inside the envelope:
 *  the envelope refusing a stale version would rebake correctly, but
 *  it would also overwrite the old artifact, so a player switching
 *  between builds would pay the bake every switch. Keyed by version,
 *  each build keeps its own and finds it again. */
export const roadsCacheKey = (v = ROADS_V) => `roads.v${v}`;

/**
 * The bake's inputs, assembled from what the world host already holds.
 *
 * Nothing here is fetched: WoodsFile's heightMapBuffer IS the 1000x500
 * plane, MapsFile.getClimateIndex IS the climate byte, and the world
 * host builds `locationIndex` one-per-map-pixel at boot already. The
 * water law comes from ui/overworldModel - the ONE home of that test,
 * imported here so systems/roads.js never has to (see its header).
 *
 * @param {object} woods - a loaded WoodsFile
 * @param {object} maps - a loaded MapsFile
 * @param {Map<string, object>} locationIndex - "x,y" -> DFLocation
 */
export function bakeInputs(woods, maps, locationIndex) {
  const locations = [];
  for (const [key, loc] of locationIndex) {
    const c = key.indexOf(',');
    locations.push({
      x: +key.slice(0, c),
      y: +key.slice(c + 1),
      locationType: loc?.mapTableData?.locationType ?? 0,
    });
  }
  return {
    heightBytes: woods.heightMapBuffer,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    climateAt: (x, y) => maps.getClimateIndex(x, y),
    isWater: isWaterPixel,
    locations,
  };
}

/**
 * Take the cached network, or bake one and write it back.
 *
 * Answers `null` when roads are switched off - which is what the world
 * host and the map layer both take to mean "no roads exist", the same
 * answer they get before the first bake. There is no third state.
 *
 * A store that THROWS is not a failure worth taking the game down for:
 * roads are a decoration on a game that ran without them for five
 * slices, so a read that throws bakes instead, and a write that throws
 * costs the next boot a rebake and nothing else.
 *
 * @param {object} o
 * @param {boolean} o.enabled - the preference
 * @param {() => Promise<Uint8Array|null>} o.load - store read
 * @param {(bytes: Uint8Array) => Promise<unknown>} o.save - store write
 * @param {() => object} o.inputs - bakeInputs(...), called ONLY on a miss
 * @param {(p: object) => void} [o.onProgress]
 * @returns {Promise<{network: object|null, fromCache: boolean, stats: object|null}>}
 */
export async function roadsForWorld({
  enabled, load, save, inputs, onProgress = null, key = roadsCacheKey(),
}) {
  if (!enabled) return { network: null, fromCache: false, stats: null };

  let cached = null;
  try {
    cached = await load(key);
  } catch (e) {
    console.warn('[roads] cached network unreadable; rebaking', e);
  }

  // inputs() is called lazily and ONLY here, so a cache hit never
  // touches the readers - which is the whole point of the twenty-six
  // seconds being paid once.
  const { network, fromCache, bytes, stats } =
    loadOrBakeRoads(cached, () => bakeRoads({ ...inputs(), onProgress }));

  if (bytes) {
    try {
      await save(key, bytes);
    } catch (e) {
      console.warn('[roads] network could not be cached; it will rebake next boot', e);
    }
  }
  return { network, fromCache, stats };
}
