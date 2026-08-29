// ═══════════════════════════════════════════════════════════════════
// R6 — THE SWITCH AND THE CACHE.
//
// R1-R5 can generate a road network, cache it, draw it, route travel
// over it and paint it on the ground. None of that happens until
// something decides to bake and hands the result to the world, which
// is this module.
//
// ── THE SWITCH: OFF AT R6, ON SINCE R7 ───────────────────────────
//
// R6 shipped roads OFF by default, on the argument that a whole-map
// bake was about twenty-six seconds: a fine price ONCE for a player
// who asked, and not a fine price silently on a first boot for a
// feature nobody mentioned. R7 REVERSED IT (Mac) - a player arriving
// at the ENHANCED skin has asked, because that is what the skin is -
// so PREF_DEFAULTS.roads is TRUE. What the reversal owes the player is
// the bake being VISIBLE and PAID ONCE, which is what the progress
// reporting and the cache below are for.
//
// This header said the opposite until 2026-08-29. R7 flipped the value
// and flipped the pin with it, and left the PROSE - so the one file a
// reader opens to learn what the default IS went on telling them the
// retired answer, under a heading explaining why. roadsboot.test.js
// now holds this header against PREF_DEFAULTS itself, both ways: flip
// the preference back and it demands the opposite words, and deleting
// a false sentence without writing the true one fails it too.
//
// The retired words were "the preference defaults false", under a
// heading reading "WHY IT IS OFF BY DEFAULT". They are quoted here per
// IN1 - a correction has to be able to write down what it retired -
// and the pin strips quoted spans with flagSites' own rule rather than
// growing a second copy of it.
//
// AND THE TWENTY-SIX SECONDS IS RETIRED TOO. RA1 took the router's
// per-call allocation out and measured the same scale at 17.2s -> 2.3s;
// re-measured 2026-08-29 on the reference fixture's own shape
// (1000x500, 15,251 locations, 512 hubs) it is 3.2 seconds. R6's
// argument was already being made with a number the port had stopped
// paying.
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
import { bakeRoads, loadOrBakeRoadsAsync, ROADS_V } from './roadBake.js';

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
 * @param {(inputs: object, onProgress: Function|null) => Promise<object>|object} [o.bake]
 *        - RA1: WHERE the bake runs, injected like everything else.
 *        Default is the same-thread bakeRoads; the world host hands
 *        roadBakeClient.bakeRoadsOffThread so the half minute runs in
 *        a Worker and the page keeps painting its progress. Called
 *        ONLY on a miss, with the lazily-assembled inputs.
 * @returns {Promise<{network: object|null, fromCache: boolean, stats: object|null}>}
 */
export async function roadsForWorld({
  enabled, load, save, inputs, onProgress = null, key = roadsCacheKey(), bake = null,
}) {
  if (!enabled) return { network: null, fromCache: false, stats: null };

  let cached = null;
  try {
    cached = await load(key);
  } catch (e) {
    console.warn('[roads] cached network unreadable; rebaking', e);
  }

  // inputs() is called lazily and ONLY here, so a cache hit never
  // touches the readers - which is the whole point of the bake being
  // paid once.
  const runBake = bake ?? ((inp, prog) => bakeRoads({ ...inp, onProgress: prog }));
  const { network, fromCache, bytes, stats } =
    await loadOrBakeRoadsAsync(cached, () => runBake(inputs(), onProgress));

  if (bytes) {
    try {
      await save(key, bytes);
    } catch (e) {
      console.warn('[roads] network could not be cached; it will rebake next boot', e);
    }
  }
  return { network, fromCache, stats };
}
