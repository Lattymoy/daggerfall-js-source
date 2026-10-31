// @ts-check
// WG2 SETTLEMENT 2.0 (bible/03-World/World-2-Canon.md, "Settlements"): WHAT A TOWN MUST BE before it is saved or
// published - every building whole (buildingRecord.js), every door within a step of a street, none floating over its
// ground or buried in it (its pads laid, its plinth, terrace or stilts accounted for) nor its door under the ground the
// stream draws, every street joined to the plaza, no building standing on another or in the water, and all of it within
// the one map pixel the streamed world stands. Answers the problems as words a designer can act on; none for a sound
// town.
import { buildingProblems } from './buildingRecord.js';
import { townRectOf, overlaps, polyDist, spanPoints, doorPoints, TERRACE_M, FLOAT_M, SILL_EPS } from './settlementGen.js';
import { TERRAIN_SIZE as PIXEL_M } from '../../terrain/terrainSampler.js';   // a world pixel's metres
import { padAt, drawnAt } from '../padLaw.js';

/** How far a door may stand from a street's edge (m). */
export const DOOR_REACH = 6;

/** @param {import('../regionSampler.js').RegionSampler} S @param {ReturnType<typeof import('./settlementGen.js').generateSettlement>} t
 *  @param {{ minted?: boolean }} [o] minted: the ids given (mintIds), so each building is checked whole */
export function settlementProblems(S, t, o = {}) {
  const out = [], cx = t.centre.x, cy = t.centre.y, pads = t.terrainOps.filter((op) => op.kind === 'pad');
  const heightAt = (x, y) => { let h = S.heightAt(x, y); for (const p of pads) h = padAt(p, x, y, h); return h; };
  const L = (x, y) => [(x - cx) * PIXEL_M, (y - cy) * PIXEL_M];
  const roads = t.roads.map((r) => ({ ...r, pts: r.pts.map(([x, y]) => L(x, y)) }));
  // the streets join: each road meets the plaza or another road (one network)
  const parent = roads.map((_, i) => i), find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const plazaR = t.plaza.r + 8;
  const hub = roads.findIndex((r) => r.pts.some(([x, y]) => Math.sqrt(x * x + y * y) <= plazaR));
  if (hub < 0 && roads.length) out.push('no road reaches the plaza');
  roads.forEach((r, i) => { if (r.pts.some(([x, y]) => Math.sqrt(x * x + y * y) <= plazaR) && hub >= 0) parent[find(i)] = find(hub); });
  for (let pass = 0; pass < 3; pass++) roads.forEach((a, i) => roads.forEach((b, j) => {
    if (i >= j || find(i) === find(j)) return;
    const [ax, ay] = a.pts[0], [bx, by] = b.pts[0], ae = a.pts[a.pts.length - 1], be = b.pts[b.pts.length - 1];
    const touch = polyDist(b.pts, ax, ay) <= a.width + b.width || polyDist(b.pts, ...ae) <= a.width + b.width || polyDist(a.pts, bx, by) <= a.width + b.width || polyDist(a.pts, ...be) <= a.width + b.width;
    if (touch) parent[find(i)] = find(j);
  }));
  roads.forEach((r, i) => { if (hub >= 0 && find(i) !== find(hub)) out.push(`road ${i} (${r.kind}) is cut off from the plaza`); });
  const rects = [];
  for (const b of t.buildings) {
    const name = `${b.id ?? b.genKey} (${b.role})`;
    if (o.minted) for (const p of buildingProblems(b)) out.push(`${name}: ${p}`);
    const c = L(b.at.x, b.at.y), rect = townRectOf(c, b.at.dir, b.footprint, -0.05), ground = townRectOf(c, b.at.dir, b.footprint, 0);
    if (rects.some((r) => overlaps(r, rect))) out.push(`${name}: stands on another building`);
    rects.push(rect);
    // its ground: nowhere under the floor by more than its plinth may hide, nowhere over it (buried) past a step
    const hs = spanPoints(ground).map(([x, y]) => heightAt(cx + x / PIXEL_M, cy + y / PIXEL_M));
    const level = b.at.z, lo = Math.min(...hs), hi = Math.max(...hs), stilts = b.ground?.kind === 'stilts', terrace = b.ground?.kind === 'terrace';
    if (!stilts && !terrace && level - lo > FLOAT_M) out.push(`${name}: floats ${(level - lo).toFixed(1)} m over its ground`);
    if (!stilts && !terrace && hi - level > 0.3) out.push(`${name}: buried ${(hi - level).toFixed(1)} m`);
    if (terrace && (hi - lo > TERRACE_M * 1.6 + 0.01 || !t.terrainOps.some((op) => op.kind === 'pad' && op.at[0] === b.at.x && op.at[1] === b.at.y))) out.push(`${name}: a terrace without its pad`);
    if (!stilts && b.doors.length) for (const [x, y] of doorPoints(c, b.at.dir, b.footprint)) {
      const over = drawnAt(heightAt, cx + x / PIXEL_M, cy + y / PIXEL_M) - level;
      if (over > SILL_EPS) { out.push(`${name}: its door is buried ${over.toFixed(2)} m in the drawn ground`); break; }
    }
    if (!stilts && rect.corners.some(([x, y]) => S.waterAt(cx + x / PIXEL_M, cy + y / PIXEL_M))) out.push(`${name}: stands in the water`);
    // its door: on the street side, within reach of a street
    for (const d of b.doors) {
      const [dx, dy] = L(d.x, d.y), reach = Math.min(...roads.map((r) => polyDist(r.pts, dx, dy) - r.width / 2));
      if (!(reach <= DOOR_REACH)) out.push(`${name}: its door is ${reach.toFixed(1)} m from a street`);
    }
  }
  // the streamed world stands a town as one map pixel's location: every building and road inside the centre's pixel
  const px = Math.floor(cx), py = Math.floor(cy), inPixel = (x, y) => x >= px && y >= py && x < px + 1 && y < py + 1;
  for (const b of t.buildings) if (!townRectOf(L(b.at.x, b.at.y), b.at.dir, b.footprint, 0).corners.every(([x, y]) => inPixel(cx + x / PIXEL_M, cy + y / PIXEL_M))) out.push(`${b.id ?? b.genKey}: outside the town's pixel`);
  for (const r of t.roads) if (!r.pts.every(([x, y]) => inPixel(x, y))) { out.push(`a ${r.kind} leaves the town's pixel`); break; }
  const roles = new Set(t.buildings.map((b) => b.role));
  for (const f of t.features) if (f.kind === 'well') roles.add('well');
  for (const need of t.services ?? []) if (!roles.has(need === 'store' ? 'shop' : need)) out.push(`no ${need}`);
  if (t.docks?.length === 0 && ['port', 'riverTown', 'stiltVillage'].includes(t.type)) out.push('a water town with no dock');
  return out;
}
