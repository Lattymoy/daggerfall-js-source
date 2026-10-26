// @ts-check
// ═══════════════════════════════════════════════════════════════════
// RUMARE-WATER (2026-10-26, the owner: "City lake needs to be apart of the overall water structure. Not just a flattened
// land. Make this work and be detailed about it"; bible/03-World/Tamriel.md RUMARE-WATER) - THE IMPERIAL CITY'S LAKE IS
// THE SEA'S. NIBEN-SEA joined Lake Rumare to the Topal Bay down the Niben and cut the Waterfront canal from the city's
// south edge to the river's arm (world/tamriel/tamrielLand.js waterfrontCanal); the city's own lake - IC-GRAND's ring
// between City Isle and its far shore (world/imperialCity.js IMPERIAL.isle, .lake) - was still the location's ground,
// flattened with the city to its centre's height a hundred units over the sea, its water a sheet on that ground and the
// far shore a wall of land between it and the canal. This module is the city's water law where its canal stands:
//   - THE CITY'S SEA (rumareSeaAt): a point of the city's span the plan's own law calls no land (imperialCity.js
//     imperialLand - the lake, and the Waterfront's mouth through the far shore, IMPERIAL.mouth, the canal's own width) -
//     the ground the city stands its water on at the sea's own height (world/terrain/capitalSea.js);
//   - THE CITY'S LAND (rumareLandHeight): the rest a freeboard over it, and past the far shore the ground rising again to
//     the land's own at the span's edge, so the city meets the land round it;
//   - THE BASIN (rumareBasin): the land round the span let down to the shore over RUMARE_BASIN.ramp pixels
//     (world/tamriel/tamrielGround.js tamrielHeightByte), so the far shore's rise is a shore's, never a cliff.
// Pure and worker-safe: the terrain worker, the Deep Waters worker (world/tamrielWatersBake.js) and this thread read the
// same trace and fit, and so the same city.
// ═══════════════════════════════════════════════════════════════════
import { IMPERIAL, IMPERIAL_SPAN, imperialLand } from './imperialCity.js';
import { waterfrontCanal } from './tamriel/tamrielLand.js';

/** Metres a map pixel. */
const PIXEL_M = 819.2;
/** The span's half, map pixels (its centre pixel's either side) and metres (from its centre pixel's middle). */
const R = (IMPERIAL_SPAN - 1) / 2, HALF_M = (IMPERIAL_SPAN * PIXEL_M) / 2;
/** THE BASIN: how many pixels past the span the land eases back to its own (`ramp`), measured from the span's square on a
 *  superellipse of power `p` (straight along its sides, its corners rounded). */
export const RUMARE_BASIN = Object.freeze({ ramp: 10, p: 4 });

/** The city's centre pixel on the live trace and fit, where its canal stands (waterfrontCanal's), or null. */
export function rumareCity() {
  const c = waterfrontCanal();
  return c ? { cx: c.cx, cy: c.cy } : null;
}

/** A Bay point (fractional) in the city's metres (x east, z south of its centre pixel's middle). @param {{ cx: number, cy: number }} c */
const metres = (c, bx, by) => [(bx - c.cx - 0.5) * PIXEL_M, (by - c.cy - 0.5) * PIXEL_M];

/** Is a Bay pixel one of the city's span's, where its canal stands. */
export function rumareSlice(px, py) {
  const c = rumareCity();
  return !!c && Math.abs(px - c.cx) <= R && Math.abs(py - c.cy) <= R;
}

/** THE CITY'S SEA: is a Bay point (fractional; x east, y south) water of the Imperial City's that is the sea's - the plan's
 *  own law there no land (imperialLand: its lake and the Waterfront's mouth) - on its span, where its canal stands. */
export function rumareSeaAt(bx, by) {
  const c = rumareCity();
  if (!c) return false;
  const [x, z] = metres(c, bx, by);
  if (Math.abs(x) > HALF_M || Math.abs(z) > HALF_M) return false;
  return !imperialLand(x, z);
}
/** Is a Bay pixel's middle the city's sea - the sea's ways at the map's scale (the lanes, the voyages, the ports' shore). */
export const rumareSeaPixel = (px, py) => rumareSeaAt(px + 0.5, py + 0.5);

/** smoothstep over 0..1. */
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/**
 * THE CITY'S LAND at a Bay point of its span off its sea: `land` (the freeboard's height, world/terrain/capitalSea.js
 * CAPITAL_LAND) inside the lake's far shore; past it the far shore's ground rising from `land` to `natural` (the land's own
 * height there, the flatten's input) at the span's edge - smoothstepped over the share of the way from the water (the far
 * shore, or the Waterfront's mouth's side) to the edge, so it is `natural` exactly on the span's edge (its neighbours'
 * samples) and never under `land`. Heights in the
 * samples' own units (normalized). Off the span or with no canal: `natural`.
 */
export function rumareLandHeight(bx, by, land, natural) {
  const c = rumareCity();
  if (!c) return natural;
  const [x, z] = metres(c, bx, by), e = HALF_M - Math.max(Math.abs(x), Math.abs(z));
  if (e < 0) return natural;
  const r = Math.hypot(x, z) - IMPERIAL.lake, side = z > 0 ? Math.abs(x) - IMPERIAL.mouth : Infinity;   // from the lake's far shore, or the mouth's side
  const s = Math.min(r, side);
  if (r <= 0 || s <= 0) return land;
  return land + Math.max(0, natural - land) * smooth(s / (s + e));
}

/** THE MOUTH'S PIXELS: the span's south edge where the Waterfront's mouth crosses it (IMPERIAL.mouth either side of its
 *  middle) - water from their middles to the canal's, so their ground is the sea's at the map's scale too
 *  (world/tamriel/tamrielGround.js tamrielHeightByte: the kernel lays the canal's water on into the city, where the land's
 *  bytes about its head had lifted it into a bar across the mouth). */
export function rumareMouthPixel(px, py) {
  const c = rumareCity();
  return !!c && py - c.cy === R && Math.abs(px - c.cx) <= Math.round(IMPERIAL.mouth / PIXEL_M - 0.5);
}

/** THE BASIN: the share (1 on the span, easing to 0 over RUMARE_BASIN.ramp pixels past it) by which a Bay pixel's land is
 *  let down toward the shore - 0 off it and with no canal. */
export function rumareBasin(px, py) {
  const c = rumareCity();
  if (!c) return 0;
  const { ramp, p } = RUMARE_BASIN, ex = Math.max(0, Math.abs(px - c.cx) - R), ey = Math.max(0, Math.abs(py - c.cy) - R);
  if (ex > ramp || ey > ramp) return 0;
  const d = (ex ** p + ey ** p) ** (1 / p);   // past the span's square, its corners rounded
  return d >= ramp ? 0 : 1 - smooth(d / ramp);
}

/** A slice of the span's location rect, tile space, as world/terrain/terrainTiles.js setLocationTiles answers a capital's -
 *  its rim (CAPITAL_RIM_TILES) on the span's outer sides, a town's clearance past the pixel's edge on its inner ones - or
 *  null off the span. @param {number} rim the rim's tiles */
export function rumareSliceRect(px, py, rim) {
  const c = rumareCity();
  if (!c || Math.abs(px - c.cx) > R || Math.abs(py - c.cy) > R) return null;
  const W = px - c.cx === -R, E = px - c.cx === R, N = py - c.cy === -R, S = py - c.cy === R, D = 128, clear = 3;
  return { xMin: W ? rim : -clear, xMax: E ? D - rim : D - 1 + clear, yMin: S ? rim : -clear, yMax: N ? D - rim : D - 1 + clear };
}
