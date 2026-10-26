// @ts-check
// ═══════════════════════════════════════════════════════════════════
// VOYAGER-CYRODIIL (2026-10-26, bible/03-World/Roads.md VOYAGER-CYRODIIL) - CYRODIIL'S NAMED ROADS.
//
// KPbICA, on the spec the owner forwarded: "For Cyrodill I would suggest to use this detailed map" - the "Province of
// Cyrodiil, 3E 433" map (Natalia Dravarol, cartographer: another game's published art). It is read as a REFERENCE for
// which road runs between which cities, and nothing else: the image never enters the repository and nothing is traced
// from it. What it gives is the table below - each road's name and the cities it joins, in order, and one point of the
// Yellow Road's course (the Niben's east bank) - written as the port's own data on the port's own geography: the cities
// are TAMRIEL1's (world/tamriel/tamrielGeography.js CITIES, standing where world/arenaPlaces.js stands them), the Imperial
// City is the capital the port builds (world/tamrielCapitals.js), and every road's course on the ground is laid by the
// roads' own law (world/road/roadNetwork.js, VOYAGER1's land) - the map says where a road goes, the land says how.
//
//  - THE RED RING ROAD rings the Imperial City round Lake Rumare: RING_POINTS points on bearings about the city's centre,
//    each RING_GAP pixels past its span - or past the far shore of a lake that lies within RING_REACH of that (the lake
//    the land carries, whatever its shape) - joined point to point; each of the city's gates (capitalGates - the plan's
//    own, never written here) is joined to its nearest point.
//  - THE ROADS OUT start at the ring's point nearest their first city's bearing and run city to city.
//
// A road between two of its points is planned first on a COARSE grid (a cell COARSE pixels a side, the land's law at
// that scale) and cut along that plan into LEGS no longer than LEG_MAX - so each leg's two ends lie in one region's grid
// (world/tamrielRoads.js: a region routes a leg whose first end its core holds, REGION_APRON past it) and the road's
// whole course follows the land (round a lake, through a pass) where a leg-by-leg route would only follow it locally.
// Each leg is routed at full scale by the region that owns it, before any town's road (roadNetwork.js `trunks`).
//
// Pure: the host resolves the cities and the city's ring to pixels (cyrodiilTrunkSpec), the roads' worker plans the legs
// on its own ground (planTrunkLegs) - every client the same legs from the same files.
// ═══════════════════════════════════════════════════════════════════
import { route, ROAD_DIALS, MAP_W, MAP_H } from './roadNetwork.js';
import { landForRoutes, landGrain, VOYAGER_DIALS } from './roadLand.js';

/** THE TABLE (read off the reference map; the port's own words): each road, the cities it joins in order (a name is a
 *  city of TAMRIEL1's; a number pair a point of the course in picture units), and whether it leaves from the ring. */
/** @type {ReadonlyArray<Readonly<{ name: string, ring?: boolean, fromRing?: boolean, stops: ReadonlyArray<string | ReadonlyArray<number>> }>>} */
export const CYRODIIL_ROADS = Object.freeze([
  Object.freeze({ name: 'Red Ring Road', ring: true, stops: Object.freeze([]) }),
  Object.freeze({ name: 'Gold Road', fromRing: true, stops: Object.freeze(['Skingrad', 'Kvatch', 'Anvil']) }),
  Object.freeze({ name: 'Black Road', fromRing: true, stops: Object.freeze(['Chorrol']) }),
  Object.freeze({ name: 'Silver Road', fromRing: true, stops: Object.freeze(['Bruma']) }),
  Object.freeze({ name: 'Orange Road', fromRing: false, stops: Object.freeze(['Chorrol', 'Bruma']) }),   // to the Silver Road below Bruma: routed after it, it takes its last stretch
  Object.freeze({ name: 'Blue Road', fromRing: true, stops: Object.freeze(['Cheydinhal']) }),
  Object.freeze({ name: 'Yellow Road', fromRing: true, stops: Object.freeze([Object.freeze([191, 106]), 'Leyawiin']) }),   // the Niben's east bank
  Object.freeze({ name: 'Green Road', fromRing: true, stops: Object.freeze(['Bravil', 'Leyawiin']) }),
]);
/** The Red Ring Road's points about the city, clockwise from north. */
export const RING_POINTS = 12;
/** How far past the city's span (pixels, from its middle: the span's half and this) the ring runs at the least. */
export const RING_GAP = 3;
/** How far past that a ray from the city looks for a lake's far shore. */
export const RING_REACH = 40;
/** A leg's longest reach, pixels (Chebyshev) - inside a region's apron (world/tamrielRoads.js REGION_APRON, 100). */
export const LEG_MAX = 80;
/** The coarse plan's cell, pixels. */
export const COARSE = 4;
/** How far, pixels, a coarse plan's box reaches past its two ends. */
export const COARSE_MARGIN = 96;
/** How far, pixels, a stop or a waypoint off the land is moved to the nearest land. */
export const SNAP_REACH = 6;

/**
 * THE SPEC A BUILD CARRIES (the host's, on the places that stand): each road's stops as pixels (`cityAt` a city's pixel,
 * `pictureAt` a picture point's - world/tamriel/tamrielFrame.js pictureToBay), and the ring's centre, the city's half
 * span and its gates. A road one of whose cities does not stand is dropped from that city on (none is guessed).
 * @param {{ cityAt: (name: string) => ?number[], pictureAt: (px: number, py: number) => number[],
 *   capital: ?{ centre: number[], half: number, gates: number[][] } }} o
 * @returns {?{ ring: ?{ centre: number[], half: number, gates: number[][] }, roads: Array<{ name: string, fromRing: boolean, ring: boolean, stops: number[][] }> }}
 */
export function cyrodiilTrunkSpec({ cityAt, pictureAt, capital }) {
  const roads = [];
  for (const r of CYRODIIL_ROADS) {
    const stops = [];
    for (const s of r.stops) {
      const at = typeof s === 'string' ? cityAt(s) : pictureAt(s[0] + 0.5, s[1] + 0.5).map(Math.floor);
      if (!at) break;
      stops.push([at[0], at[1]]);
    }
    if (r.ring ? !capital : (r.fromRing && !capital) || stops.length < (r.fromRing ? 1 : 2)) continue;
    roads.push({ name: r.name, fromRing: !!r.fromRing, ring: !!r.ring, stops });
  }
  return roads.length ? { ring: capital ? { centre: [...capital.centre], half: capital.half, gates: capital.gates.map((g) => [g[0], g[1]]) } : null, roads } : null;
}

/** The nearest pixel within SNAP_REACH (ring by ring, in each ring row then column) that `walkable` takes, or null. */
function snap(p, walkable) {
  if (walkable(p[0], p[1])) return p;
  for (let r = 1; r <= SNAP_REACH; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === r && walkable(p[0] + dx, p[1] + dy)) return [p[0] + dx, p[1] + dy];
    }
  }
  return null;
}

/**
 * THE RED RING ROAD'S POINTS: on each of RING_POINTS bearings from the city's centre, where a ray from the span's half
 * and RING_GAP out meets water within RING_REACH, the first land past it (the lake's far shore: the ring runs round
 * Lake Rumare whatever shape the land gives it); where it meets none, the ray's first pixel, snapped to land; a ray
 * whose water runs past its reach none.
 * @param {{ centre: number[], half: number }} ring
 * @param {(x: number, y: number) => boolean} walkable @param {(x: number, y: number) => boolean} wet
 * @returns {Array<?number[]>}
 */
export function ringPoints(ring, walkable, wet) {
  const out = [];
  const r0 = ring.half + RING_GAP;
  for (let k = 0; k < RING_POINTS; k++) {
    // a bearing clockwise from north: east is +x, north is -y
    const [sx, sy] = RING_UNIT[k * (12 / RING_POINTS)];
    const on = (r) => [ring.centre[0] + roundOut(sx * r), ring.centre[1] - roundOut(sy * r)];
    let at = null, water = false;
    for (let r = r0; r <= r0 + RING_REACH; r++) {
      const [x, y] = on(r);
      if (wet(x, y)) { water = true; continue; }
      if (water && walkable(x, y)) { at = [x, y]; break; }
    }
    out.push(water ? at : snap(on(r0), walkable));
  }
  return out;
}
/** Rounded half away from nought - a ring as round on its south and west as on its north and east (Math.round takes -3.5
 *  to -3). */
const roundOut = (v) => (v < 0 ? -Math.round(-v) : Math.round(v));
/** sin and cos of each twelfth of a turn from north, clockwise - as numbers written out, the same on every client. */
const H3 = 0.8660254037844386;
const RING_UNIT = Object.freeze([[0, 1], [0.5, H3], [H3, 0.5], [1, 0], [H3, -0.5], [0.5, -H3], [0, -1], [-0.5, -H3], [-H3, -0.5], [-1, 0], [-H3, 0.5], [-0.5, H3]]);

const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

/**
 * ONE ROAD'S COURSE BETWEEN TWO POINTS, AS LEGS: a leg as it is where the two lie within LEG_MAX; else the coarse plan
 * (route on a grid of COARSE-pixel cells about the two, each cell its centre's height and water, the land's law with the
 * grade read per pixel) cut where it has run LEG_MAX * 3 / 4 from the last cut - each cut its cell's centre, snapped to
 * land. With no coarse way, one leg (a region's route then answers, or says unrouted).
 * @returns {number[][][]} legs, each [a, b]
 */
export function courseLegs(a, b, { heightAt, walkable }) {
  if (cheb(a, b) <= LEG_MAX) return [[a, b]];
  const x0 = Math.min(a[0], b[0]) - COARSE_MARGIN, y0 = Math.min(a[1], b[1]) - COARSE_MARGIN;
  const W = Math.min(MAP_W, Math.ceil((Math.max(a[0], b[0]) + COARSE_MARGIN - x0) / COARSE) + 1);
  const H = Math.min(MAP_H, Math.ceil((Math.max(a[1], b[1]) + COARSE_MARGIN - y0) / COARSE) + 1);
  const cellOf = (p) => ({ x: Math.min(W - 1, Math.floor((p[0] - x0) / COARSE)), y: Math.min(H - 1, Math.floor((p[1] - y0) / COARSE)) });
  const mid = (c) => [x0 + c.x * COARSE + (COARSE >> 1), y0 + c.y * COARSE + (COARSE >> 1)];
  const heights = new Uint8Array(MAP_W * MAP_H), water = new Uint8Array(MAP_W * MAP_H), keep = new Uint8Array(MAP_W * MAP_H);
  for (let v = 0; v < MAP_H; v++) {
    for (let u = 0; u < MAP_W; u++) {
      const i = v * MAP_W + u;
      if (u >= W || v >= H) { water[i] = 1; keep[i] = 1; continue; }
      const [x, y] = mid({ x: u, y: v });
      if (walkable(x, y)) heights[i] = heightAt(x, y); else water[i] = 1;
    }
  }
  const from = cellOf(a), to = cellOf(b);
  water[from.y * MAP_W + from.x] = 0; water[to.y * MAP_W + to.x] = 0;
  // the land's law at the cell's scale: a cell's rise over COARSE pixels, so the grade's price per pixel is its own
  const d = { ...VOYAGER_DIALS, gradeCost: VOYAGER_DIALS.gradeCost / (COARSE * COARSE), smoothR: 1 };
  const land = landForRoutes(heights, water, keep, MAP_W, MAP_H, d, (u, v) => { const [x, y] = mid({ x: u, y: v }); return landGrain(x, y); });
  const path = route(from, to, {
    heightAt: (u, v) => heights[v * MAP_W + u], isWater: (u, v) => water[v * MAP_W + u] === 1 && land.ford[v * MAP_W + u] === 0,
    existing: new Uint8Array(MAP_W * MAP_H), d: ROAD_DIALS, terrain: land,
  });
  if (!path) return [[a, b]];
  const legs = [];
  let last = a;
  for (let k = 1; k < path.length - 1; k++) {
    const p = mid(path[k]);
    if (cheb(last, p) < (LEG_MAX * 3) >> 2) continue;
    const at = snap(p, walkable);
    if (!at) continue;
    legs.push([last, at]);
    last = at;
  }
  legs.push([last, b]);
  return legs;
}

/**
 * VOYAGER-CYRODIIL: EVERY LEG OF THE NAMED ROADS, in the table's order - the Red Ring Road's (point to point round the
 * city, and each gate to its nearest point) first, then each road's from its ring point (the one nearest the bearing of
 * its first stop) or its first city, stop to stop. `walkable` a pixel a road may stand on (the land past the Bay, no
 * capital's pixel), `wet` water. Stops off the land are snapped to it; one with no land in reach ends its road there.
 * @param {ReturnType<typeof cyrodiilTrunkSpec>} spec
 * @param {{ heightAt: (x: number, y: number) => number, walkable: (x: number, y: number) => boolean, wet: (x: number, y: number) => boolean }} ground
 * @returns {number[][][]} legs, each [a, b] in Bay pixels
 */
export function planTrunkLegs(spec, { heightAt, walkable, wet }) {
  if (!spec) return [];
  const legs = [];
  const ring = spec.ring ? ringPoints(spec.ring, walkable, wet) : [];
  const onRing = ring.filter(Boolean);
  for (const road of spec.roads) {
    if (road.ring) {
      for (let k = 0; k < ring.length; k++) {
        const p = ring[k], q = ring[(k + 1) % ring.length];
        if (p && q) legs.push(...courseLegs(p, q, { heightAt, walkable }));
      }
      for (const g of spec.ring?.gates ?? []) {
        const near = onRing.reduce((m, p) => (m && cheb(m, g) <= cheb(p, g) ? m : p), null);
        if (near) legs.push(...courseLegs(g, near, { heightAt, walkable }));
      }
      continue;
    }
    const stops = road.stops.map((s) => snap(s, walkable));
    const cut = stops.indexOf(null);
    const course = cut < 0 ? stops : stops.slice(0, cut);
    if (road.fromRing && course.length) {
      const c = /** @type {any} */ (spec.ring).centre, s = course[0];
      // the ring's point nearest the first stop's bearing: the greatest cosine to it, ties to the first
      let best = null, bc = -Infinity;
      for (const p of onRing) {
        const ax = p[0] - c[0], ay = p[1] - c[1], bx = s[0] - c[0], by = s[1] - c[1];
        const cos = (ax * bx + ay * by) / Math.sqrt((ax * ax + ay * ay) * (bx * bx + by * by) || 1);
        if (cos > bc) { bc = cos; best = p; }
      }
      if (best) course.unshift(best);
    }
    for (let k = 0; k + 1 < course.length; k++) legs.push(...courseLegs(course[k], course[k + 1], { heightAt, walkable }));
  }
  return legs.map(([p, q]) => [[p[0], p[1]], [q[0], q[1]]]);
}
