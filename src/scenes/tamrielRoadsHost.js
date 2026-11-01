// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TESA14 (bible/03-World/Arena-Provinces.md TESA14) - THE ROADS PAST THE BAY, IN THE WORLD HOST.
//
// When the places past the Bay stand (the trace and the fit landed: world/arenaPlaces.js arenaPixels) and the Bay's own
// network is known (its crossings ride it, TESA5), the regions' build starts on the roads' workers
// (world/tamrielRoadsClient.js), the regions nearest the player first: the build's inputs are the host's own height
// bytes, the trace and the fit, the roll's numbers (world/tamrielRoads.js rollSpec), Arena's places that stand as towns,
// the capitals' gates and pixels, and the crossings' gates. The crossings' joins go to the terrain client first, with the
// layer reset; then each region's layer as it lands (terrainGenClient.js addArenaRoads: both kernels and this thread's
// verge and ink), and the host paints again the built pixels each one reaches (`onLanded`). A move of the places that
// stand, or the Bay's network landing, starts the build again. The host wires it; nothing of it lives in the host.
// TESA15: the build is handed the pixels Arena's places hold too (routed round, and no rolled place on them), and each
// region's places are kept as it lands (world/pastBayPlaces.js) - the map's marks, the very places the roads serve.
// WW7-9 (bible/03-World/World-Wide.md): and a word of each region landed - its grid told (`onRegion`), and whether every
// region a stretch of the land past the Bay is laid by has landed (`landedIn`) - so the living world wakes a region at a
// time, the land about the player first, where it waited for every region of the build.
// ═══════════════════════════════════════════════════════════════════
import { createTamrielRoadsClient } from '../world/tamrielRoadsClient.js';
import { regionLattice, regionsByNearness, regionWanted, regionAt, inputsPrint, REGION_APRON, GROUND_ROLL_VERSION } from '../world/tamrielRoads.js';
import { keptLandRegions, fnv32 } from '../world/tamriel/tamrielBootCache.js';   // AUDIT RELEASE R4-4: the boot's continent kept
import { BIOMES_VERSION } from '../world/tamriel/tamrielBiomes.js';
import { arenaJoins, joinLayer, joinRunPixels, keepArenaRoadsHost, keptArenaRoadsHost } from '../world/arenaRoads.js';
import { tamrielFrameInBay, tamrielFit, inBay, pictureToBay, BAY_W, BAY_H } from '../world/tamriel/tamrielFrame.js';
import { tamrielTrace } from '../world/tamriel/tamrielLand.js';
import { CAPITALS, capitalGates, capitalSpanPixels, capitalOnPixel, capitalCentrePixel, capitalSpan } from '../world/tamrielCapitals.js';
import { WATER_BYTE } from '../world/roadsProducer.js';
import { LOCATION_TYPES } from '../formats/mapsFile.js';
import { resetPastBayPlaces, addPastBayPlaces } from '../world/pastBayPlaces.js';
import { cyrodiilTrunkSpec, CYRODIIL_ROADS } from '../world/road/cyrodiilRoads.js';   // VOYAGER-CYRODIIL
import { resetExactPieces, addExactPieces, clearExactPieces } from '../systems/travel/landPieces.js';   // EXACT-PIECES: the land's pieces, a region at a time
import { landLayer } from '../world/land/landLayer.js';   // FOUNDATION F4: the land's rows, in the kept set's print
import { gen2Shipped } from '../world/gen2/gen2Ground.js';   // The published regions, posted with the trace

/** VOYAGER-CYRODIIL: THE IMPERIAL CITY'S KEY in the capitals' table - its ring and its gates the plan's own. */
export const CYRODIIL_CAPITAL = 'imperial-city';
/**
 * VOYAGER-CYRODIIL: Cyrodiil's named roads as a build carries them (world/road/cyrodiilRoads.js cyrodiilTrunkSpec) - each
 * city by the pixel its place stands on (`pixels`, world/arenaPlaces.js arenaPixels), the Imperial City by its centre
 * pixel, its span's half (world/tamrielCapitals.js capitalSpan, the plan's `span`) and its gates (capitalGates - the
 * plan's own sides, walked over `walkable`, the host's ground) - none hard-coded here. Null with no places standing.
 * @param {?{ stood: Array<{ name?: string, bx: number, by: number }> }} pixels
 * @param {(x: number, y: number) => boolean} walkable the ground the roads walk, as the gates are walked over it
 */
export function cyrodiilTrunksFor(pixels, walkable) {
  if (!pixels) return null;
  const names = new Set(CYRODIIL_ROADS.flatMap((r) => r.stops.filter((s) => typeof s === 'string')));
  const byName = new Map();
  for (const p of pixels.stood) if (p.name && names.has(p.name) && !byName.has(p.name)) byName.set(p.name, [p.bx, p.by]);
  const k = CAPITALS.findIndex((c) => c.key === CYRODIIL_CAPITAL), centre = k >= 0 ? capitalCentrePixel(k) : null;
  const capital = centre ? { centre: [centre.px, centre.py], half: (capitalSpan(CAPITALS[k]) + 1) >> 1, gates: capitalGates(k, { walkable }).map((g) => [g.x, g.y]) } : null;
  return cyrodiilTrunkSpec({ cityAt: (name) => byName.get(name) ?? null, pictureAt: (px, py) => pictureToBay(px, py), capital });
}

/**
 * `woodsBytes` the height bytes the terrain worker was given; `heightAt` the host's ground; `joinLand` a crossing's land
 * (TESA5); `onLanded` the host's sweep (world.js arenaRoadsLanded). `standing`, what stands now: `pixels` (arenaPixels:
 * null until the trace lands - read every frame, its identity the build's), and, read as a build starts, `towns` the
 * Arena places that stand as towns (`{ x, y, type }`), `spec` the roll's numbers (rollSpec) and `capitals` whether the
 * capitals stand, and (TESA15) `held` the pixels Arena's places stand on (`{ x, y }`, each with its template).
 * @param {{ terrainGen: { addArenaRoads: Function, roads: () => any, hasRoads: boolean }, woodsBytes: Uint8Array,
 *   heightAt: (x: number, y: number) => number, joinLand: (x: number, y: number) => boolean,
 *   onLanded: (epoch: number, layer: any, reset: boolean) => void,
 *   standing: { pixels: () => any, towns: () => Array<{ x: number, y: number, type: number }>, spec: () => any, capitals: () => boolean,
 *     held?: () => Array<{ x: number, y: number }> },
 *   client?: ?ReturnType<typeof createTamrielRoadsClient>, log?: { log: Function, warn: Function } }} o
 */
export function createTamrielRoadsHost({ terrainGen, woodsBytes, heightAt, joinLand, onLanded, standing, client = null, log = console }) {
  let roadsClient = client, forPixels = null, forBay = null, lattice = null, at = null, landed = 0, total = 0;
  // WW7-9: the build's number, its regions with land (each with its grid: the pixels its layer may reach), the ones
  // landed, whether the cache has been asked of all of them (before, nothing is pending yet), and who is told
  let build = 0, asked = false;
  /** @type {Array<{ key: string, x0: number, y0: number, x1: number, y1: number }>} */ let grids = [];
  /** @type {Set<string>} */ let done = new Set();
  /** @type {Array<(grid: { x0: number, y0: number, x1: number, y1: number }, build: number) => void>} */ const told = [];
  const api = {
    /**
     * Each frame, with the player's pixel: a build when what stands moved, the build re-ordered as the player goes.
     * @param {?{ x: number, y: number }} player
     */
    frame(player) {
      const pixels = standing.pixels(), bay = terrainGen.roads();
      if (pixels !== forPixels || bay !== forBay) {
        if (!pixels || (!bay && terrainGen.hasRoads)) return;   // the trace still to land; TESA5: the Bay's network on its way
        forPixels = pixels;
        forBay = bay;
        start(standing.towns(), standing.spec(), standing.capitals(), standing.held?.() ?? [], player);
        return;
      }
      if (lattice && player) {
        const r = regionAt(lattice, player.x, player.y);
        if (!at || r[0] !== at[0] || r[1] !== at[1]) { at = r; roadsClient?.near(player.x, player.y); }
      }
    },
    /** How many regions are still to land. */
    pending: () => roadsClient?.pending() ?? 0,
    /** WW7-9: the build's number - it moves as a build starts (the layer and the places reset), 0 before the first. */
    build: () => build,
    /** WW7-9: whether the land past the Bay on x0 <= x < x1, y0 <= y < y1 is this build's whole - every region with land
     *  whose grid (its core and REGION_APRON about it: the pixels its roads may reach) meets a pixel of it past the Bay
     *  has landed, or the build has nothing left to land (a region that failed is let go). False before a build starts.
     *  @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 */
    landedIn(x0, y0, x1, y1) {
      if (x0 >= 0 && y0 >= 0 && x1 <= BAY_W && y1 <= BAY_H) return true;   // the Bay's own: no region lays a road on it
      if (!build) return false;
      if (asked && (roadsClient?.pending() ?? 0) === 0) return true;
      for (const g of grids) {
        const ax = Math.max(x0, g.x0), ay = Math.max(y0, g.y0), bx = Math.min(x1, g.x1), by = Math.min(y1, g.y1);
        if (ax >= bx || ay >= by || done.has(g.key)) continue;
        if (!(ax >= 0 && ay >= 0 && bx <= BAY_W && by <= BAY_H)) return false;   // a pixel of it past the Bay still to be laid
      }
      return true;
    },
    /** WW7-9: `fn(grid, build)` told as each region lands - its grid, the pixels its layer and its places may move. */
    onRegion(fn) { told.push(fn); },
    dispose() { roadsClient?.dispose(); clearExactPieces(); if (keptArenaRoadsHost() === api) keepArenaRoadsHost(null); },
  };
  keepArenaRoadsHost(api);   // W14: the season's fissures past the Bay keep off these roads once they are laid (scenes/seasonHost.js)
  return api;

  function start(towns, spec, capitals, held, player) {
    roadsClient ??= createTamrielRoadsClient({ log });
    const joins = forBay ? arenaJoins(forBay, joinLand) : [];
    const gates = [], obstacles = [];
    // AUDIT TESA II R2 (lane C's gate walk): a gate is walked out over this host's own ground - the composed one, the
    // Bay's blend in it, as the build reads it - where the capitals' default reads the authored height alone
    const walkable = (x, y) => !inBay(x, y) && heightAt(x, y) > WATER_BYTE && !capitalOnPixel(x, y);
    if (capitals) {
      CAPITALS.forEach((_, k) => {
        obstacles.push(...capitalSpanPixels(k));
        gates.push(...capitalGates(k, { walkable }));
      });
    }
    const nodes = [...towns, ...gates.map((g) => ({ x: g.x, y: g.y, type: LOCATION_TYPES.TownCity })), ...joins.map((j) => ({ x: j.gate[0], y: j.gate[1], type: LOCATION_TYPES.TownCity }))];
    const trunks = capitals ? cyrodiilTrunksFor(forPixels, walkable) : null;   // VOYAGER-CYRODIIL: Cyrodiil's named roads
    lattice = regionLattice(tamrielFrameInBay());
    const from = player ?? { x: 500, y: 250 };
    at = regionAt(lattice, from.x, from.y);
    const trace = tamrielTrace(), fit = tamrielFit();
    // AUDIT RELEASE R4-4: the regions with land a returning boot scanned before, on this very ground, kept (tamrielBootCache.js)
    const ground = `w1|g${GROUND_ROLL_VERSION}|b${BIOMES_VERSION}|${landLayer().stamp ? `l${landLayer().stamp}|` : ''}${fit ? `${fit.ox}:${fit.oy}:${fit.ppu}` : '-'}|${fnv32(woodsBytes ?? []).toString(36)}`;   // w1: the kept set is the regions EXACT-PIECES wants (regionWanted - the Bay's own too), not the regions with land a boot before it kept
    const regions = regionsByNearness(lattice, keptLandRegions({ lattice, scan: (r) => regionWanted(r, heightAt), ground }), from);   // EXACT-PIECES: the Bay's own regions too
    // AUDIT TESA II R9: the crossings' runs past the Bay held as an Arena place's pixel is - no rolled place on the road
    const inputs = { woodsBytes, trace, fit: fit ? { ox: fit.ox, oy: fit.oy, ppu: fit.ppu } : null, wg2: gen2Shipped(), spec, nodes, obstacles, gates, held: [...held, ...joinRunPixels(joins)], lattice, trunks };   // The published regions
    landed = 0;
    total = regions.length;
    build++; asked = false; done = new Set();   // WW7-9: a new build - nothing of it landed
    grids = regions.map((r) => ({ key: `${r.i},${r.j}`, x0: r.gx, y0: r.gy, x1: r.core.x1 + REGION_APRON, y1: r.core.y1 + REGION_APRON }));
    resetPastBayPlaces();   // TESA15: and the map's places
    resetExactPieces(lattice, regions);   // EXACT-PIECES: the land's pieces, none landed
    terrainGen.addArenaRoads(joinLayer(joins), onLanded, { reset: true });   // TESA5: the crossings first, the layer reset
    const t0 = Date.now();
    log.log(`[roads] the roads past the Bay: ${total} regions to lay (${nodes.length} towns and gates, ${joins.length} crossings, ${trunks?.roads.length ?? 0} of Cyrodiil's named roads)`);
    const mine = build;
    Promise.resolve(roadsClient.start({
      inputs, print: inputsPrint(inputs), regions,
      onRegion: (region, layer, stats, places, land) => {
        addPastBayPlaces(places ?? []);   // TESA15: before the roads, so the map's repaint for them has both
        addExactPieces(region, land ?? null);   // EXACT-PIECES: its land's pieces, joined to its landed neighbours'
        terrainGen.addArenaRoads(layer, onLanded);
        landed++;
        log.log(`[roads] region (${region.i}, ${region.j}): ${layer.roads.size} road and ${layer.tracks.size} track pixels, ${places?.length ?? 0} places ${stats.cached ? 'from the cache' : `in ${stats.ms} ms`}; ${landed} of ${total}${landed === total ? `, all in ${((Date.now() - t0) / 1000).toFixed(1)} s` : ''}`);
        const g = grids.find((q) => q.key === `${region.i},${region.j}`);   // WW7-9: its word, the layer and its places in
        if (!g || build !== mine) return;
        done.add(g.key);
        for (const fn of told) fn(g, build);
      },
    })).then(() => { if (build === mine) asked = true; }, () => {});
  }
}
