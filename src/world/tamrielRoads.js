// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TESA14 (2026-10-24, bible/03-World/Arena-Provinces.md TESA14) - THE ROADS PAST THE BAY, THE BAY'S OWN LAW AT ITS OWN
// SCALE.
//
// The owner, of the land past the Bay: "there's no pathways like daggerfall has" - asked, "Full Daggerfall network".
// TESA4 ran the port's road builder (world/roadNetwork.js buildRoadNetwork, ROADS 1-21) once over Arena's 283 places on
// a window five Bay pixels a cell: a road read the ground once a cell, so it crossed what lay between two cells' centres
// (a lake's edge, a river), and it ran on to a cell's centre past a town that stood off it (a stub into the sea). And the
// countryside TESA7 stands, 226,068 places on the freeware's continent, had no way to it at all.
//
// Here the same builder runs at the Bay's own scale - a pixel a cell - over every place past the Bay, a REGION at a time:
// the continent's frame is cut into cores of REGION_CORE_W x REGION_CORE_H Bay pixels, and a region's grid is its core
// with REGION_APRON round it - the builder's own 1000 x 500. A region's places are everything its grid holds: the
// countryside's and the lairs' (the roll, world/tamrielCountry.js countryStandsAt and world/tamrielDungeons.js
// lairStandsAt), Arena's places past the Bay, the capitals' gates, the crossings' gates onto the Bay's own roads
// (TESA5). Each grades as the Bay's do (roadNetwork.js ROAD_TYPES and TRACK_TYPES: a city and a hamlet a road node, a
// village, an inn, a temple, a manor, a shrine and a coven a track node; a farm, a poor home and every dungeon a place a
// route goes round). A region routes only its OWN edges (buildRoadNetwork `owns`: an edge whose first end is in its
// core, a track whose node is) - every one whole, into its apron if it runs there - so the regions either side of a seam
// route each edge once, and their layers meet. A capital's own pixels are no route's (`obstacles`): a road ends at its
// gate, the pixel outside its span on the side its plan opens (world/tamrielCapitals.js capitalGates), with the step into
// the city on the gate's own byte alone - painted to the city's edge, never across its lake or its harbour.
//
// Pure: the worker (world/tamrielRoadsWorker.js) and node build a region the same way, so every client lays the same
// roads.
// ═══════════════════════════════════════════════════════════════════
import { buildRoadNetwork, MAP_W, MAP_H, DIR_DELTA, ROAD_DIALS, ROAD_TYPES } from './roadNetwork.js';
import { inBay } from './tamrielFrame.js';
import { beyondKey } from './arenaRoads.js';
import { WATER_BYTE } from './roadsProducer.js';
import { GENERATOR_VERSION } from './roadsCache.js';
import { countryStandsAt } from './tamrielCountry.js';
import { lairStandsAt, lairPlanned, lairBlockCount } from './tamrielDungeons.js';

/** The regions' law's version - its cache's key moves with it. */
export const TAMRIEL_ROADS_VERSION = 2;   // TESA15: a region's places in its answer, Arena's dungeons routed round
/** How far, Bay pixels, a region's grid reaches past its core on every side: past the road builder's reach for a road's
 *  neighbours (ROAD_DIALS.roadReach, 70) and a track's (trackLink, 24), so an edge a region owns has both ends in view. */
export const REGION_APRON = 100;
/** A region's core - the builder's grid less its apron. */
export const REGION_CORE_W = MAP_W - 2 * REGION_APRON;
export const REGION_CORE_H = MAP_H - 2 * REGION_APRON;

/**
 * THE LATTICE of regions over the continent's frame (world/tamrielFrame.js tamrielFrameInBay): its north-west Bay pixel
 * and how many cores across and down.
 * @param {{ x0: number, y0: number, w: number, h: number }} frame
 */
export function regionLattice(frame) {
  const x0 = Math.floor(frame.x0), y0 = Math.floor(frame.y0);
  return { x0, y0, cols: Math.ceil((Math.ceil(frame.x0 + frame.w) - x0) / REGION_CORE_W), rows: Math.ceil((Math.ceil(frame.y0 + frame.h) - y0) / REGION_CORE_H) };
}
/** A region: its core's pixels (x0 <= x < x1, y0 <= y < y1) and its grid's north-west pixel (gx, gy). */
export function regionOf(lattice, i, j) {
  const cx = lattice.x0 + i * REGION_CORE_W, cy = lattice.y0 + j * REGION_CORE_H;
  return { i, j, core: { x0: cx, y0: cy, x1: cx + REGION_CORE_W, y1: cy + REGION_CORE_H }, gx: cx - REGION_APRON, gy: cy - REGION_APRON };
}
/** The region whose core holds a pixel, [i, j]. */
export const regionAt = (lattice, x, y) => [Math.floor((x - lattice.x0) / REGION_CORE_W), Math.floor((y - lattice.y0) / REGION_CORE_H)];
/** Does a region's core hold a pixel. */
export const inCore = (region, x, y) => x >= region.core.x0 && x < region.core.x1 && y >= region.core.y0 && y < region.core.y1;

/** How finely a core is looked over for land, Bay pixels. */
export const LAND_LOOK = 8;
/** Does a region's core hold land past the Bay - a pixel every LAND_LOOK over the beach line. */
export function regionHasLand(region, heightAt) {
  const { x0, y0, x1, y1 } = region.core;
  for (let y = y0; y < y1; y += LAND_LOOK) for (let x = x0; x < x1; x += LAND_LOOK) if (!inBay(x, y) && heightAt(x, y) > WATER_BYTE) return true;
  return false;
}
/**
 * The regions to build, nearest a point first (their cores' middles; ties in the lattice's order) - every one with land.
 * @param {ReturnType<typeof regionLattice>} lattice @param {(region: ReturnType<typeof regionOf>) => boolean} hasLand
 * @param {{ x: number, y: number }} from
 */
export function regionsByNearness(lattice, hasLand, from) {
  const out = [];
  for (let j = 0; j < lattice.rows; j++) for (let i = 0; i < lattice.cols; i++) { const r = regionOf(lattice, i, j); if (hasLand(r)) out.push(r); }
  const d = (r) => Math.hypot((r.core.x0 + r.core.x1) / 2 - from.x, (r.core.y0 + r.core.y1) / 2 - from.y);
  return out.sort((a, b) => d(a) - d(b) || a.j - b.j || a.i - b.i);
}

const BIT_OF = new Map(DIR_DELTA.map(([bit, dx, dy]) => [`${dx},${dy}`, bit]));

/**
 * ONE REGION'S ROADS AND TRACKS, as a layer of Bay pixels (world/arenaRoads.js: `beyondKey` to the byte, its compass bits).
 * `places` the rolled places on the grid's pixels; `nodes` Arena's places, the capitals' gates and the crossings' gates;
 * `obstacles` the capitals' own pixels; `gates` each gate's step into its city; `heightAt` the ground's byte
 * (world/tamrielGround.js) - every one in Bay pixels. TESA15: `held` the pixels Arena's places stand (a town's its node
 * too): one that is no node is a place a route goes round (a dungeon's - ROADS 1), and no rolled place stands on it or on
 * a capital's - the world host's own order (scenes/world.js _locationToBuild: a capital, an Arena place, then the
 * countryside and the lairs). Answers too the region's PLACES: the rolled ones its core holds that stand, for the map
 * (world/pastBayPlaces.js).
 * @param {{ region: ReturnType<typeof regionOf>, places: Array<{ x: number, y: number, type: number }>,
 *   nodes: Array<{ x: number, y: number, type: number }>, obstacles: Array<{ x: number, y: number }>,
 *   gates: Array<{ x: number, y: number, into: readonly number[] }>, held?: Array<{ x: number, y: number }>,
 *   heightAt: (x: number, y: number) => number, dials?: object }} o
 * @returns {{ roads: Map<number, number>, tracks: Map<number, number>, places: Array<{ x: number, y: number, type: number }>, stats: object }}
 */
export function buildTamrielRegion({ region, places, nodes, obstacles, gates, held = [], heightAt, dials = {} }) {
  const { gx, gy } = region;
  const inGrid = (x, y) => x >= gx && y >= gy && x < gx + MAP_W && y < gy + MAP_H;
  const heights = new Uint8Array(MAP_W * MAP_H), water = new Uint8Array(MAP_W * MAP_H);
  for (let v = 0; v < MAP_H; v++) {
    for (let u = 0; u < MAP_W; u++) {
      const x = gx + u, y = gy + v, i = v * MAP_W + u;
      if (inBay(x, y)) { water[i] = 1; continue; }   // the Bay's own ground is its own network's
      const h = heightAt(x, y);
      heights[i] = h;
      water[i] = h <= WATER_BYTE ? 1 : 0;
    }
  }
  const taken = new Set(), locations = [], blocked = [];
  // TESA5: a road node takes its pixel before a track node does (a crossing's gate where a village stands); of a grade,
  // the first
  const roadGrade = (o) => /** @type {ReadonlySet<number>} */ (ROAD_TYPES).has(o.type);
  for (const n of [...nodes.filter(roadGrade), ...nodes.filter((o) => !roadGrade(o))]) {
    if (!inGrid(n.x, n.y) || inBay(n.x, n.y) || taken.has(`${n.x},${n.y}`)) continue;
    taken.add(`${n.x},${n.y}`);
    // a node stands on its own pixel's land, whatever its byte reads (a port on the shore, a gate on a bank)
    water[(n.y - gy) * MAP_W + (n.x - gx)] = 0;
    locations.push({ x: n.x - gx, y: n.y - gy, type: n.type });
  }
  const theirs = new Set();   // a capital's pixel or an Arena place's: no rolled place stands there
  for (const o of [...obstacles, ...held]) {
    theirs.add(`${o.x},${o.y}`);
    if (inGrid(o.x, o.y) && !taken.has(`${o.x},${o.y}`)) { taken.add(`${o.x},${o.y}`); blocked.push({ x: o.x - gx, y: o.y - gy }); }
  }
  // the places in one order whatever order they come in (a cache hands them tile by tile, its tiles in the order it was
  // asked): the builder is order-bound - each route merges into the ones before it - and every client lays the same roads
  const ordered = places.filter((p) => inGrid(p.x, p.y) && !inBay(p.x, p.y) && !taken.has(`${p.x},${p.y}`)).sort((a, b) => a.y - b.y || a.x - b.x);
  for (const p of ordered) locations.push({ x: p.x - gx, y: p.y - gy, type: p.type });
  const net = buildRoadNetwork({
    locations, dials, obstacles: blocked,
    heightAt: (u, v) => heights[v * MAP_W + u], isWater: (u, v) => water[v * MAP_W + u] === 1,
    owns: (n) => inCore(region, n.x + gx, n.y + gy),
  });
  const roads = new Map(), tracks = new Map();
  for (let v = 0; v < MAP_H; v++) {
    for (let u = 0; u < MAP_W; u++) {
      const i = v * MAP_W + u;
      if (net.roads[i]) roads.set(beyondKey(gx + u, gy + v), net.roads[i]);
      if (net.tracks[i]) tracks.set(beyondKey(gx + u, gy + v), net.tracks[i]);
    }
  }
  // a capital's gate: the road on it runs on to the city's edge - the step in on the gate's own byte, none on the city's
  let gated = 0;
  for (const g of gates) {
    const k = beyondKey(g.x, g.y);
    if (!inCore(region, g.x, g.y) || !roads.has(k)) continue;
    roads.set(k, /** @type {number} */ (roads.get(k)) | /** @type {number} */ (BIT_OF.get(`${g.into[0]},${g.into[1]}`)));
    gated++;
  }
  const standing = places.filter((p) => inCore(region, p.x, p.y) && !inBay(p.x, p.y) && !theirs.has(`${p.x},${p.y}`)).sort((a, b) => a.y - b.y || a.x - b.x);
  return { roads, tracks, places: standing.map((p) => ({ x: p.x, y: p.y, type: p.type })), stats: { ...net.stats, places: locations.length, obstacles: blocked.length, gated } };
}

// ── THE ROLL, CARRIED ───────────────────────────────────────────

/**
 * THE ROLL'S OWN NUMBERS, as plain data a worker takes: the countryside's rates and how many templates each kind has, the
 * lairs' rates, each template's dungeon type and plan size, and each dungeon type's pool's sizes - all the roll reads of
 * the game's rows (scenes/world.js countryRollAt, lairRollAt, lairBlocksOf), none of the rows themselves.
 * @param {{ countryRates: Map<number, any>, countryTemplates: Map<number, any[]>, lairRates: Map<number, any>,
 *   lairTemplates: Map<number, any[]>, lairPools: Map<number, any> }} o
 */
export function rollSpec({ countryRates, countryTemplates, lairRates, lairTemplates, lairPools }) {
  return {
    country: { rates: [...countryRates], counts: [...countryTemplates].map(([t, list]) => [t, list.length]) },
    lair: {
      rates: [...lairRates],
      templates: [...lairTemplates].map(([t, list]) => [t, list.map((l) => [l.mapTableData?.dungeonType ?? null, lairBlockCount(l)])]),
      pools: [...lairPools].map(([dt, p]) => [dt, [p?.interior?.length ?? 0, p?.start?.length ?? 0, p?.border?.length ?? 0]]),
    },
  };
}
/**
 * WHAT STANDS ON A PIXEL PAST THE BAY by the carried roll - the countryside's place, else a lair with a plan - its location
 * type, or null: the very answers the world host's rolls give (the same kinds at the same indices: a template is a
 * skeleton of its type, its dungeon type and its plan's size).
 * @param {any} spec rollSpec's
 * @param {{ climateAt: (x: number, y: number) => number, heightAt: (x: number, y: number) => number, ground: (x: number, y: number) => boolean }} world
 */
export function rollTypeAt(spec, { climateAt, heightAt, ground }) {
  const country = { rates: new Map(spec.country.rates), templates: new Map(spec.country.counts.map(([t, n]) => [t, new Array(n).fill(null)])), climateAt, heightAt, ground };
  const skeleton = ([dungeonType, count]) => ({ mapTableData: { dungeonType }, dungeon: { blocks: new Array(count).fill(INTERIOR) } });
  const lair = { rates: new Map(spec.lair.rates), templates: new Map(spec.lair.templates.map(([t, list]) => [t, list.map(skeleton)])), climateAt, heightAt, ground };
  const pools = new Map(spec.lair.pools.map(([dt, [a, b, c]]) => [dt, { interior: { length: a }, start: { length: b }, border: { length: c } }]));
  return (x, y) => {
    const c = countryStandsAt(country, x, y);
    if (c) return c.type;
    const l = lairStandsAt(lair, x, y);
    return l && lairPlanned(pools.get(l.pick.template.mapTableData.dungeonType), lairBlockCount(l.pick.template)) ? l.pick.type : null;
  };
}
const INTERIOR = Object.freeze({ blockName: 'N0000000.RDB' });

/**
 * A REGION'S CACHE KEY: everything its layer is made of - the law's version, the builder's and its dials, the region, the
 * height map's bytes (their length and a sum), the fit, the trace's land, the roll's numbers and the nodes, obstacles,
 * gates and held pixels (TESA15) - so a client holds a region it built before only while all of them stand.
 * @param {{ region: { i: number, j: number }, inputs: string }} o the inputs' print (inputsPrint)
 */
export const regionKey = ({ region, inputs }) => `tamriel-roads:v${TAMRIEL_ROADS_VERSION}:g${GENERATOR_VERSION}:${region.i},${region.j}:${inputs}`;
/** The print of a build's inputs - one string, the same on every client that would lay the same roads. */
export function inputsPrint({ woodsBytes, fit, trace, spec, nodes, obstacles, gates, held = [] }) {
  let h = 2166136261 >>> 0;
  const mix = (v) => { h = Math.imul(h ^ (v >>> 0), 16777619) >>> 0; };
  for (let i = 0; i < woodsBytes.length; i += 7) mix(woodsBytes[i] + i);
  if (trace) for (let i = 0; i < trace.land.length; i++) if (trace.land[i]) mix(i * 977 + trace.province[i]);
  const text = JSON.stringify([spec, nodes, obstacles, gates, held, ROAD_DIALS]);
  for (let i = 0; i < text.length; i++) mix(text.charCodeAt(i));
  return `${woodsBytes.length}:${fit ? `${fit.ox},${fit.oy},${fit.ppu}` : 'none'}:${h.toString(36)}`;
}
