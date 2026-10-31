// @ts-check
// AUDIT SEA PATHS O4 (2026-10-31, bible/01-Overview/audits/Audit-Sea-Paths.md) - A SAILED LEG ROUND THE KERNEL'S LAND. The
// planner reads one byte a pixel, and the ground the game builds bends a rock's or an isle's land a pixel past its last
// land byte: Eltheric voyages aimed from one leg's mark to the next ran 350 to 1,210 m over it. Each sailed leg whose line
// from the leg before (its window's middle, seaMark.js) crosses the kernel's land (world/water/kernelSea.js) has marks of
// its own put before it, round that land through its pixels' water (seaLanes.js subWay) - each a 'sea' leg aimed at its
// own point (`at`; travelOptions.js aims it so). A crossing with no way round is left as it was: the hand steers.
import { seaLegWindow } from './seaMark.js';
import { MP_WORLD_UNITS } from './travelPaths.js';
import { kernelLine } from '../../world/water/kernelSea.js';
import { subWay } from '../naval/seaLanes.js';

/** How far past the kernel's land along a leg (native) the way round it begins and ends: a pixel. */
export const MEND_PAD = MP_WORLD_UNITS;

/** A leg's aim in native units: its own point, else its window's middle. @param {any} leg */
const aimOf = (leg) => {
  if (leg.at) return leg.at;
  const w = seaLegWindow(leg.x, leg.y);
  return { x: w.x + MP_WORLD_UNITS / 2, z: w.z + MP_WORLD_UNITS / 2 };
};
/** The map pixel a native point stands in. @param {{ x: number, z: number }} p */
const pixelOf = (p) => ({ x: Math.floor(p.x / MP_WORLD_UNITS), y: 499 - Math.floor(p.z / MP_WORLD_UNITS) });

/**
 * The legs with their sailed crossings of the kernel's land mended. `start` the traveller's native point (the first leg's
 * line is from it when she starts afloat), `kernel` the kernel's sea, `waterPx` the planner's water at a map pixel (the
 * sub-pixel way keeps to it). Null kernel: the legs as they were.
 * @param {any[]} legs @param {{ x: number, z: number } | null} start
 * @param {((x: number, z: number) => boolean) | null} kernel @param {(px: number, py: number) => boolean} waterPx
 */
export function mendSeaLegs(legs, start, kernel, waterPx) {
  if (!kernel) return legs;
  const water = (/** @type {number} */ x, /** @type {number} */ z) => { const p = pixelOf({ x, z }); return waterPx(p.x, p.y); };
  const out = [];
  let prev = start, afloat = legs[0]?.kind === 'sea';   // afloat at the start: her first leg sailed from her own point
  for (const leg of legs) {
    const sea = leg.kind === 'sea';
    if (sea && afloat && prev) {
      const aim = aimOf(leg);
      for (const p of roundLand(prev, aim, kernel, water)) out.push({ ...pixelOf(p), kind: 'sea', at: p });
    }
    out.push(leg);
    if (sea || leg.kind === 'embark') { prev = aimOf(leg); afloat = true; } else { prev = leg.at ?? null; afloat = false; }
  }
  return out;
}

/** The points round the kernel's land between `a` and `b` (neither end), or none: the line holds, or no way round. */
function roundLand(a, b, kernel, water) {
  const off = kernelLine(a, b, kernel, true, true);
  if (off === true) return [];
  const back = kernelLine(b, a, kernel, true, true);
  const L = Math.hypot(b.x - a.x, b.z - a.z) || 1, ux = (b.x - a.x) / L, uz = (b.z - a.z) / L;
  const at = (/** @type {{ x: number, z: number }} */ p) => (p.x - a.x) * ux + (p.z - a.z) * uz;
  const s0 = Math.max(0, at(off) - MEND_PAD), s1 = Math.min(L, at(back === true ? off : back) + MEND_PAD);
  const p0 = s0 > 0 ? { x: a.x + ux * s0, z: a.z + uz * s0 } : a, p1 = s1 < L ? { x: a.x + ux * s1, z: a.z + uz * s1 } : b;
  if ((p0 !== a && !kernel(p0.x, p0.z)) || (p1 !== b && !kernel(p1.x, p1.z))) return [];
  const way = subWay(p0, p1, water, kernel);
  if (!way) return [];
  return [...(p0 !== a ? [p0] : []), ...way.slice(1, -1), ...(p1 !== b ? [p1] : [])];
}
