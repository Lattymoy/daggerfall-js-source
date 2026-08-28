// ═══════════════════════════════════════════════════════════════════
// R2 — THE BAKE: what gets cached, and what gets rebuilt.
//
// R1 generates the network; this module decides what survives a page
// reload. Measured at full Iliac Bay scale (1000x500, 15,251 locations
// in Daggerfall's own type proportions, 460 hubs): the whole bake runs
// in about twenty-six seconds - half a minute of a first boot, once,
// behind a progress bar, and never again. That number is why the
// artifact is CACHED rather than shipped: generating it costs the user
// half a minute, and shipping it would cost every user a megabyte AND
// raise the question of whether a table derived from WOODS heights is
// game data. Generated on the player's own machine from the player's
// own ARENA2, it is not distributed at all.
//
// ── WHAT IS CACHED AND WHAT IS NOT ───────────────────────────────
//
// ONLY the two exit planes. They are the complete network - every
// other view is derivable, and cheaply. The `segments` list R1
// accumulates is a build-time byproduct that costs several times more
// to store than the thing it describes, and it does not survive the
// merge honestly: two spurs that join the same track are two segments
// over one road. tracePolylines rebuilds the map layer's lines from
// the exits instead, which produces the CHAINS the drawing wants -
// split at junctions, one line per run - rather than the order the
// builder happened to lay them in.
//
// ── THE CHECKSUM IS NOT CEREMONY ─────────────────────────────────
//
// A half-written IndexedDB record is a real state, and a road network
// that is subtly WRONG rather than absent is the worst outcome
// available: the map draws roads to nowhere, R4 routes travel over
// them, and nothing anywhere throws. The envelope is versioned so a
// format change wipes rather than misreads, and checksummed so a torn
// write is refused rather than believed. Both failures answer null,
// which the caller treats as "no cache" - a cost of one bake, never a
// broken world.
// ═══════════════════════════════════════════════════════════════════

import {
  DIRS, oppositeDir, ROAD_TRUNK, ROAD_TRACK,
  buildCostField, buildRoadNetwork, createNetwork, networkHasAnyRoad,
} from './roads.js';

/** Bumping this WIPES every cached bake. Bump it whenever a change
 *  would make an old artifact wrong rather than merely stale - a new
 *  cost term, a different hub set, a changed exit bit order. A stale
 *  road network is not a cosmetic problem once R4 routes travel over
 *  it. (The MANIFEST_V precedent in scenes/dataSource.js.) */
export const ROADS_V = 1;

const MAGIC = 0x44465244;   // 'DFRD'
const HEADER_BYTES = 20;

/** FNV-1a over a byte range. Not a security property - a torn-write
 *  detector, and it only has to beat "believed silently". The PRIME is
 *  the part that earns its keep: without the multiply this collapses
 *  to a plain XOR, which still catches any single flipped byte but is
 *  ORDER-INDEPENDENT, and a torn interleaved write reorders blocks. */
export function checksumBytes(bytes, from = 0, to = bytes.length) {
  let h = 0x811c9dc5;
  for (let i = from; i < to; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ── SERIALIZATION ────────────────────────────────────────────────

/**
 * The network as one flat buffer: magic, version, dimensions,
 * checksum, then the two exit planes back to back. At the real map
 * that is 20 + 2 x 500,000 bytes.
 */
export function serializeRoads(network) {
  const { width, height, trunkExits, trackExits } = network;
  const plane = width * height;
  const out = new Uint8Array(HEADER_BYTES + plane * 2);
  const view = new DataView(out.buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint16(4, ROADS_V, true);
  view.setUint16(6, width, true);
  view.setUint16(8, height, true);
  view.setUint32(10, plane, true);
  out.set(trunkExits, HEADER_BYTES);
  out.set(trackExits, HEADER_BYTES + plane);
  // checksum LAST, over the payload only - it cannot cover itself
  view.setUint32(14, checksumBytes(out, HEADER_BYTES), true);
  view.setUint16(18, 0, true);   // reserved, keeps the header 4-aligned
  return out;
}

/**
 * The inverse, refusing anything it does not fully recognise.
 * @returns {object|null} - null on wrong magic, wrong version, wrong
 *          length or a failed checksum. Never a partial network.
 */
export function deserializeRoads(bytes) {
  if (!bytes || bytes.length < HEADER_BYTES) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== MAGIC) return null;
  if (view.getUint16(4, true) !== ROADS_V) return null;
  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  const plane = view.getUint32(10, true);
  if (plane !== width * height) return null;
  // An EARLY-OUT, not an independent guard: the checksum below already
  // refuses every wrong-length buffer, because it is taken over the
  // bytes actually present. Kept because it is free and skips a full
  // scan of a buffer that cannot be right, and labelled as subsumed so
  // the next reader does not mistake it for the thing doing the work.
  if (bytes.length !== HEADER_BYTES + plane * 2) return null;
  if (view.getUint32(14, true) !== checksumBytes(bytes, HEADER_BYTES)) return null;

  const network = createNetwork(width, height);
  network.trunkExits.set(bytes.subarray(HEADER_BYTES, HEADER_BYTES + plane));
  network.trackExits.set(bytes.subarray(HEADER_BYTES + plane));
  // segments are NOT restored - they are a build-time byproduct.
  // tracePolylines answers the drawing question instead.
  return network;
}

// ── POLYLINE TRACING ─────────────────────────────────────────────

function popcount8(b) {
  b = b - ((b >> 1) & 0x55);
  b = (b & 0x33) + ((b >> 2) & 0x33);
  return (b + (b >> 4)) & 0x0f;
}

/**
 * Rebuild drawable chains from one exit plane.
 *
 * Every EDGE is walked exactly once. Chains start at junctions and
 * dead ends (degree != 2) so a crossroads becomes several lines
 * meeting rather than one line doubling back through itself; whatever
 * edges remain afterwards are closed rings, which have no such pixel
 * to start from, so they are opened wherever they are first met.
 *
 * Deterministic: pixels in index order, directions in compass order.
 *
 * @returns {{x:number,y:number}[][]}
 */
export function tracePolylines(exits, width, height) {
  const walked = new Uint8Array(width * height);   // one visited bit per direction
  const lines = [];

  const walk = (sx, sy, d0) => {
    const line = [{ x: sx, y: sy }];
    let x = sx, y = sy, d = d0;
    for (;;) {
      const i = y * width + x;
      if (walked[i] & DIRS[d].bit) break;
      // an edge is one thing seen from two ends - burn both, or the
      // return walk draws it again
      walked[i] |= DIRS[d].bit;
      const nx = x + DIRS[d].dx, ny = y + DIRS[d].dy;
      const ni = ny * width + nx;
      walked[ni] |= DIRS[oppositeDir(d)].bit;
      line.push({ x: nx, y: ny });
      x = nx; y = ny;
      // continue only through a pixel that is a pure pass-through
      const bits = exits[ni];
      if (popcount8(bits) !== 2) break;
      const back = DIRS[oppositeDir(d)].bit;
      let next = -1;
      for (let k = 0; k < 8; k++) {
        if (!(bits & DIRS[k].bit) || DIRS[k].bit === back) continue;
        next = k; break;
      }
      if (next === -1 || (walked[ni] & DIRS[next].bit)) break;
      d = next;
    }
    if (line.length > 1) lines.push(line);
  };

  const sweep = (accept) => {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const bits = exits[y * width + x];
        if (!bits || !accept(bits)) continue;
        for (let d = 0; d < 8; d++) {
          if (!(bits & DIRS[d].bit)) continue;
          if (walked[y * width + x] & DIRS[d].bit) continue;
          walk(x, y, d);
        }
      }
    }
  };

  sweep((bits) => popcount8(bits) !== 2);   // junctions and dead ends
  sweep(() => true);                        // whatever is left is a ring
  return lines;
}

/** Both planes traced, in the order the map draws them: track first,
 *  trunk over the top. */
export function traceNetwork(network) {
  return {
    track: tracePolylines(network.trackExits, network.width, network.height),
    trunk: tracePolylines(network.trunkExits, network.width, network.height),
  };
}

// ── THE BAKE ─────────────────────────────────────────────────────

/**
 * Cost field plus network in one call, over the real readers.
 *
 * Every dependency is injected and nothing here reaches for a reader
 * itself, so this module stays node-testable and `systems/` never
 * imports `ui/`. The caller supplies:
 *
 *   heightBytes  - WoodsFile's small heightmap (1000x500)
 *   width/height - MAP_WIDTH / MAP_HEIGHT from formats/woodsFile.js
 *   climateAt    - MapsFile's CLIMATE.PAK byte
 *   isWater      - ui/overworldModel.isWaterPixel, THE one home of
 *                  that law (see roads.js's header)
 *   locations    - [{x, y, locationType}] from the map directory
 *   onProgress   - optional {phase, done, total}
 */
export function bakeRoads({
  heightBytes, width, height, climateAt, isWater, locations,
  onProgress = null, ...opts
} = {}) {
  const field = buildCostField({ heightBytes, width, height, climateAt, isWater, ...opts });
  const { network, stats } = buildRoadNetwork({
    field, heightBytes, locations, onProgress, ...opts,
  });
  return { network, stats, field };
}

/** The cache round trip as one call: hand it the bytes a store gave
 *  back (or null) and a bake function, and it answers a network plus
 *  the bytes to write back when it had to build one. Keeping this here
 *  rather than in the store means the version/checksum law is tested
 *  in node and the browser half stays a get and a put. */
export function loadOrBakeRoads(cachedBytes, bake) {
  const cached = deserializeRoads(cachedBytes);
  if (cached) return { network: cached, fromCache: true, bytes: null, stats: null };
  const { network, stats } = bake();
  return { network, fromCache: false, bytes: serializeRoads(network), stats };
}

/** The same round trip when the bake runs OFF this thread (RA1). The
 *  synchronous form above froze the page for the whole bake - the boot
 *  stall this audit was called on - so the world host now hands a bake
 *  that resolves from a Worker. Two answer shapes, both honest homes:
 *  a same-thread bake answers `{network, stats}` and the bytes are
 *  serialized here; a worker answers `{bytes, stats}` - it serialized
 *  on its own side so ONE flat buffer crosses the thread boundary -
 *  and the network is read back through deserializeRoads, the same
 *  door the cache uses, so a worker cannot hand back a shape the
 *  envelope law never saw. */
export async function loadOrBakeRoadsAsync(cachedBytes, bake) {
  const cached = deserializeRoads(cachedBytes);
  // RB1: an EMPTY cache entry is treated as a miss, not a hit. The
  // envelope is intact and the version matches, so every check below
  // passes it - but a network with no road in it is the one artifact
  // that can never become right on its own, and reading it back
  // forever is how a bad bake becomes permanent. Rebaking costs the
  // half minute once; keeping it costs the feature.
  if (cached && networkHasAnyRoad(cached)) {
    return { network: cached, fromCache: true, bytes: null, stats: null };
  }
  const r = await bake();
  const network = r.network ?? deserializeRoads(r.bytes);
  if (!network) throw new Error('roads: the bake answered neither a network nor readable bytes');
  // ...and the same emptiness is not written in the first place. The
  // network still comes back, so this boot behaves exactly as it would
  // have; only the cache is spared.
  const empty = !networkHasAnyRoad(network);
  return {
    network,
    fromCache: false,
    bytes: empty ? null : (r.bytes ?? serializeRoads(network)),
    stats: r.stats ?? null,
  };
}

export { ROAD_TRUNK, ROAD_TRACK };
