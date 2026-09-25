// ═══════════════════════════════════════════════════════════════════
// DW-A / DW-B — THE DEEP WATERS WORKER. Iliac Puddle No More's two heavy
// halves, off the main thread: the bake's global half (deepWatersBake.js
// - seconds of work on a first boot, then an IndexedDB hit) and every
// streamed pixel's promote (deepWatersPixel.js - a coastal pixel's fine
// masks, floor, cap and surface are tens of milliseconds, which the mod
// pays inside Unity's frame and this port does not). The terrain worker
// answers its jobs in order, so neither rides there: a bake queued behind
// it would hold the first pixels of the world, and a promote queued there
// would hold the next terrain behind the sea.
//
// Messages in:
//   {t: 'build', woodsBytes, rects} - once, first. The WOODS bytes are a
//     COPY (the RA1 law - the main thread's reader keeps its own) carrying
//     the boot's SmoothLocationNeighbourhood (syncHeightMapBytes); `rects`
//     are [pixelId, xMin, xMax, yMin, yMax] rows, SetLocationTiles' answer
//     for every classic location whose pixel the bound cannot settle - the
//     main thread reads MAPS.BSA and BLOCKS.BSA, this thread cannot.
//   {t: 'pixel', id, job, centre?} - a pixel to promote (deepWatersPixel.js
//     buildDeepWatersPixel's job); held until the bake is in. `centre`
//     ([px, py], the player's pixel) bounds this thread's plane caches.
// Messages out:
//   {t: 'built', record} - the bake's global record, arrays copied (this
//     thread keeps its own to answer pixels), or {t: 'error', message};
//   {t: 'pixel', id, result} with the result's arrays transferred, or
//     {t: 'pixel', id, error}.
//
// Pure modules only (no ui/, scenes/, render/) - a worker has no DOM.
// ═══════════════════════════════════════════════════════════════════

import { WoodsFile } from '../formats/woodsFile.js';
import { buildGlobal, DeepWatersBake } from './deepWatersBake.js';
import { cachedBake, bakeCacheKey, fnv1a, rectsFingerprint, rectsLookup } from './deepWatersBakeCache.js';
import { buildDeepWatersPixel, deepWatersPixelTransfers } from './deepWatersPixel.js';

/** How far (Chebyshev pixels) from the player this thread keeps its planes. */
const PLANE_KEEP_RADIUS = 12;

let bake = null;            // this thread's DeepWatersBake, once built
let failed = null;          // the build's error message, when it failed
const waiting = [];         // pixel messages that arrived before the bake

globalThis.onmessage = (ev) => { handle(ev.data ?? {}); };

async function handle(m) {
  if (m.t === 'build') return build(m);
  if (m.t === 'pixel') {
    if (bake) return pixel(m);
    if (failed) return globalThis.postMessage({ t: 'pixel', id: m.id, error: failed });
    waiting.push(m);
  }
}

async function build(m) {
  try {
    const woods = new WoodsFile();
    if (!woods.load(m.woodsBytes)) throw new Error('WOODS.WLD failed to load in the deep waters worker');
    const rows = m.rects ?? [];
    const key = bakeCacheKey({ woodsHash: fnv1a(m.woodsBytes), rectsHash: rectsFingerprint(rows) });
    const locationRectAt = rectsLookup(rows);
    const g = await cachedBake({ key, build: () => buildGlobal(woods, { locationRectAt }) });
    if (!g) throw new Error('deep waters bake produced nothing');
    bake = new DeepWatersBake({ woods, global: g, locationRectAt });
    // the main thread's copy crosses; this thread's arrays stay behind for the pixels
    const record = { state: g.state.slice(), classes: g.classes.slice(), partialIndex: g.partialIndex.slice(), partialBits: g.partialBits.slice(), stats: { ...g.stats, cached: !!g.cached } };
    globalThis.postMessage({ t: 'built', record }, [record.state.buffer, record.classes.buffer, record.partialIndex.buffer, record.partialBits.buffer]);
  } catch (e) {
    failed = e?.message ?? String(e);
    globalThis.postMessage({ t: 'error', message: failed });
  }
  for (const w of waiting.splice(0)) await handle(w);
}

let sinceEvict = 0;
function pixel(m) {
  try {
    if (Array.isArray(m.centre) && ++sinceEvict >= 16) { sinceEvict = 0; bake.evictOutside(m.centre[0], m.centre[1], PLANE_KEEP_RADIUS); }
    const result = buildDeepWatersPixel(m.job, bake);
    globalThis.postMessage({ t: 'pixel', id: m.id, result }, deepWatersPixelTransfers(result));
  } catch (e) {
    globalThis.postMessage({ t: 'pixel', id: m.id, error: e?.message ?? String(e) });
  }
}
