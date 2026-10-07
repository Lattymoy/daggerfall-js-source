// @ts-check
// SHIP-LIFE (2026-09-30, Mac's item 1 of the six-part sea ask: ships that berth at ports, depart, voyage and keep
// their own errands; `01-Overview/Handoff-Naval-Crew-and-Ship-Life.md` slice E) - A SHIP GOING SOMEWHERE. The port's
// own; pure - the host hands the water, a town's footprint and the ships' clocks, and gets back berths, paths and the
// plan a captain sails by when no fight is hers.
//
// NO DOCK DATA EXISTS. A port town is a flag in its exterior data, so a HARBOUR is found from the terrain
// (`findHarbour`): the town's rect grown HARBOUR_REACH, walked on a SHORE_STEP grid for water beside land; each such
// shore point, stood off the land along the shore's normal by her half width and BERTH_MARGIN, is a berth lying
// parallel to the shore - kept only where her whole footprint (bow to stern, beam to beam) is water (AUDIT GN2-GN1: deep
// enough for the deepest keel that berths), and BERTH_SPACING of her length from every other. The harbour's MOUTH is the first point out from the berths along their mean normal
// with MOUTH_CLEAR of open water all round it: where a ship leaves the harbour for the sea and meets it coming in.
//
// A WAY THROUGH THE WATER (`createWaterGrid`): WATER_CELL cells, a cell open when her hull floats at its centre and at
// eight points WATER_CLEAR of a cell round it (a cell's clearance off the land), met lazily and kept; a bounded A*
// (PATH_NODES expansions at most - a query's cost is fixed, and a way it cannot find in them is none), eight
// neighbours with no corner cut past a closed cell, then the corners straightened wherever the line between stays in
// the water (`clear`). AUDIT NAV2 F22's one detour round a spit is a boarding's; this is a voyage's.
//
// THE ERRANDS (`errandFor`, `stepErrand`) - drawn off her seed on ERRAND_SALT and where she is, so any client that
// takes her over draws the same one again and nothing new rides the word:
//   moored  - at her berth, sails stowed, for a DWELL_S draw; then she departs.
//   depart  - berth to the harbour's mouth; then a voyage (a navy's patrol).
//   voyage  - to another harbour's mouth, then she arrives; or out of the world on a bearing, VOYAGE_DIST away.
//   arrive  - to a berth: through the mouth to her approach, along the shore into it, her sail shortened within
//             ARRIVE_EASE_M; alongside within BERTH_SNAP_M she moors, eased onto her berth over MOOR_EASE_S.
//   patrol  - a navy's loop of PATROL_POINTS round a harbour's approaches, PATROL_S of it, then out on a voyage.
//   lurk    - a pirate off a harbour's approaches, LURK_R from the mouth, where merchantmen pass: a slow ring there.
// A fight comes first (navalAI.js stepCaptain: an enemy, a threat, a prize, the guns heard) - a navy at her berth
// answers a pirate, a merchantman flees one - and the errand is taken up again after it with a way planned anew.
//
// SHIP-WATCH (2026-10-01, Mac: "I also want to keep improving the AI") - THE NIGHT (`ctx.night`, the lanterns' hours):
// a merchantman's dwell spent after dark keeps her at her berth till morning (no master puts out into a night sea
// with a hold to lose), and a pirate's lurk closes on the harbour's mouth to NIGHT_LURK_K of its reach - under cover
// of the dark, where the last ships in of the evening pass.

import { hash32 } from '../../world/spawnedDungeons.js';
import { mulberry32 } from '../../combat/bloodArt.js';
import { hullBuild, MOD_CARRACK_BUILD } from './navalShips.js';

/** How far past the town's rect a berth may lie (m), the shore scan's grid (m), the water kept between a berth's hull
 *  and the shore (m), a berth's spacing (her lengths), and the most berths a harbour holds. */
export const HARBOUR_REACH = 420;
export const SHORE_STEP = 12;
export const BERTH_MARGIN = 4;
export const BERTH_SPACING = 1.25;
export const HARBOUR_BERTHS = 6;
/** The mouth: open water all round it this far (m), sought no farther than MOUTH_REACH out from the berths. */
export const MOUTH_CLEAR = 60;
export const MOUTH_REACH = 900;
/** The hull a harbour's berths are sized for - the longest that berths (a galley rows in and out, never moors). */
export const BERTH_HULL = 4;
/** AUDIT GN2-GN1: the hulls that berth (every one but the galley). A berth is sounded deep enough for the deepest keel
 *  of them (draftOf - Mac's galleon's 4.7 m, the mod's galleon's 3.41 fallen back, past the Carrack's 3.2): sounded for
 *  BERTH_HULL's alone, every berth off a carved shelf was land to hull 2, and each galleon stood at one lay there frozen. */
export const BERTH_HULLS = Object.freeze([0, 1, 2, 4]);
/** A hull's water under her keel (m), rowboat to carrack - how shoal a sea she can sail (world.js navalIsWater). AUDIT
 *  GN-G6: hull 2's is her keel's (the table's 2.2 sailed the new galleon's 4.64 m keel over a 2.3 m floor). AUDIT
 *  GN2-PF6: read off hullBuild as she stands, DRAFT_SPARE under it - the mod's galleon's 3.41 while it stands in for the
 *  new one (AUDIT GN-G4); a frozen 4.7 kept it out of water it sails. */
export const HULL_DRAFT = Object.freeze([0.8, 1.4, null, 2.8, 3.2]);
export const DRAFT_SPARE = 0.06;
export const draftOf = (hull) => {
  const h = Math.min(HULL_DRAFT.length - 1, Math.max(0, hull | 0));
  // SHIPS-2: the new carrack's is her keel's too (4.65 m - the table's 3.2 sailed her 4.59 m keel over a 3.3 m floor),
  // the table's while the mod's own carrack stands in for her; under the galleon's 4.7, so the deepest that berths is the
  // galleon still and no harbour is sounded anew
  if (h === 4 && hullBuild(4) !== MOD_CARRACK_BUILD) return DRAFT_SPARE - hullBuild(4).keel;
  return h === 2 ? DRAFT_SPARE - hullBuild(2).keel : /** @type {number} */ (HULL_DRAFT[h]);
};
/** AUDIT GN2-GN1: the deepest keel of BERTH_HULLS as the hulls stand. */
export const deepestBerther = () => BERTH_HULLS.reduce((a, h) => (draftOf(h) > draftOf(a) ? h : a));
/** The water grid: its cell (m), the clearance round a cell's centre it asks water at (cells), and the most nodes one
 *  way may expand. */
export const WATER_CELL = 20;
export const WATER_CLEAR = 0.6;
export const PATH_NODES = 6000;
/** A straightened leg keeps this much water either side of it (m) - the captains' lookout swings off land nearer than
 *  that - save within LEG_END_M of its own ends (a berth lies by the shore). */
export const LEG_MARGIN = 45;
export const LEG_END_M = 60;
/** A way's point reached within this (m); a berth's approach this many of her lengths astern of it and APPROACH_OUT
 *  (m) out from the shore - open water to come round in, the last leg a slant along the shore into the berth. */
export const REACH_M = 35;
export const APPROACH_LENGTHS = 1.2;
export const APPROACH_OUT = 70;
/** Alongside: within this of her berth (m) and under BERTH_WAY (m/s) she moors; her sail shortened from ARRIVE_EASE_M
 *  out, to ARRIVE_SAILS at the least; eased onto the berth over MOOR_EASE_S. */
export const BERTH_SNAP_M = 18;
export const BERTH_WAY = 3;
export const ARRIVE_EASE_M = 220;
export const ARRIVE_SAILS = 0.18;
export const MOOR_EASE_S = 4;
/** Seconds moored (a draw in the range), a voyage out of the world's distance (m), a patrol's ring (m), points and
 *  length (s), and a lurker's distance off the mouth (m), ring (m) and sail. */
export const DWELL_S = Object.freeze([180, 540]);
export const VOYAGE_DIST = 2600;
export const PATROL_R = 450;
export const PATROL_POINTS = 5;
export const PATROL_S = 420;
export const LURK_R = 650;
export const LURK_RING = 140;
export const LURK_SAILS = 0.5;
/** SHIP-WATCH: by night a pirate's lurking place this share of the way out from the mouth to her day's. */
export const NIGHT_LURK_K = 0.5;
/** A ship making under STALL_WAY (m/s) for STALL_S under sail - a hull dead in her way, a struck sister alongside - takes a
 *  DETOUR_M detour abeam, whichever side the water is open, and plans her way anew past it. */
export const STALL_WAY = 0.5;
export const STALL_S = 15;
export const DETOUR_M = 70;
/** A voyage makes for another harbour only this near (m); farther, she sails out of the world. */
export const VOYAGE_REACH = 6000;
/** The errands' own stream's salt on a ship's seed. */
export const ERRAND_SALT = 0x5b1f;
export const ERRANDS = Object.freeze(['moored', 'depart', 'voyage', 'arrive', 'patrol', 'lurk']);

const TAU = Math.PI * 2;
const wrap = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; else if (a < -Math.PI) a += TAU; return a; };
const heading = (from, to) => Math.atan2(to[0] - from[0], to[1] - from[1]);
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** A ship's plan point [x, z] from her 3D position. */
const flat = (p) => [p[0], p[2]];

/** Her length (m) and half width (m), bow to stern. */
export function hullSize(hull) {
  const b = hullBuild(hull);
  return { length: b.bowZ - b.aftZ, halfWidth: b.halfWidth, bowZ: b.bowZ, aftZ: b.aftZ };
}
/** SHIPS-2: THE SHIP A HARBOUR'S BERTHS ARE SIZED FOR - the mod's own Carrack's footprint (MOD_CARRACK_BUILD: 51.95 m by
 *  8.43 a side), whatever stands as BERTH_HULL. Mac's carrack is 49.45 m by 6.70: sized off her, every port's berths
 *  would stand anew and its quays with them. So a berth is sounded, spaced, approached and quayed for the template, and
 *  a hull lies alongside it by her own half beam against the template's (`alongside`). Any other hull its own size. */
export const BERTH_TEMPLATE = MOD_CARRACK_BUILD;
export function berthSize(hull) {
  if (hull !== BERTH_HULL) return hullSize(hull);
  const b = BERTH_TEMPLATE;
  return { length: b.bowZ - b.aftZ, halfWidth: b.halfWidth, bowZ: b.bowZ, aftZ: b.aftZ };
}

/** QUAYS (systems/naval/quays.js): where a hull lies alongside a berth's quay - the berth is sounded for `harbourHull`
 *  (BERTH_HULL, the Carrack) and its quay stands off that hull's side, so a narrower one lies in toward it by the
 *  difference and a wider one out from it: her side always the quay's gap off its face. `[x, z]`. */
export function alongside(berth, hull, harbourHull = BERTH_HULL) {
  const off = hullSize(hull).halfWidth - berthSize(harbourHull).halfWidth;
  return [berth.pos[0] + berth.normal[0] * off, berth.pos[1] + berth.normal[1] * off];
}

/** Whether her whole footprint at `pos` ([x, z]) heading `yaw` floats: her centreline bow to stern and both sides - a
 *  berth's (BERTH_HULL's) the berths' template's (SHIPS-2: berthSize). */
export function footprintClear(pos, yaw, hull, isWater) {
  const { halfWidth, bowZ, aftZ } = berthSize(hull);
  const fx = Math.sin(yaw), fz = Math.cos(yaw), sx = fz, sz = -fx;
  for (let z = aftZ; z <= bowZ + 1e-6; z += Math.max(4, (bowZ - aftZ) / 8)) {
    for (const s of [-halfWidth, 0, halfWidth]) {
      if (!isWater(pos[0] + fx * z + sx * s, pos[1] + fz * z + sz * s, hull)) return false;
    }
  }
  return true;
}

/**
 * A port town's harbour off the terrain: `rect` the town's footprint in the scene ({ minX, maxX, minZ, maxZ }),
 * `isWater(x, z, hull)`. Answers `{ berths: [{ pos: [x, z], yaw, normal: [x, z], approach: [x, z] }], mouth: [x, z],
 * hull }`, the berths nearest the town first - or null where the town has no shore to berth at or no way out to sea.
 * AUDIT GN2-GN1: sounded for `hull`'s footprint in `deep`'s water too - the deepest keel that berths (BERTH_HULLS).
 */
export function findHarbour({ rect, isWater: own, hull = BERTH_HULL, deep = deepestBerther(), max = HARBOUR_BERTHS }) {
  const { length, halfWidth } = berthSize(hull);   // SHIPS-2: the berths' template's
  const isWater = (x, z, h) => !!own(x, z, h) && (h === deep || !!own(x, z, deep));
  const water = (x, z) => isWater(x, z, hull);
  const cx = (rect.minX + rect.maxX) / 2, cz = (rect.minZ + rect.maxZ) / 2;
  const x0 = rect.minX - HARBOUR_REACH, x1 = rect.maxX + HARBOUR_REACH, z0 = rect.minZ - HARBOUR_REACH, z1 = rect.maxZ + HARBOUR_REACH;
  const cands = [];
  for (let x = x0; x <= x1; x += SHORE_STEP) {
    for (let z = z0; z <= z1; z += SHORE_STEP) {
      if (!water(x, z)) continue;
      // beside the land: a neighbour a step off is land
      if (water(x + SHORE_STEP, z) && water(x - SHORE_STEP, z) && water(x, z + SHORE_STEP) && water(x, z - SHORE_STEP)) continue;
      // the shore's normal: toward the water round her, away from the land
      let nx = 0, nz = 0;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * TAU, dx = Math.sin(a), dz = Math.cos(a);
        if (water(x + dx * SHORE_STEP * 2, z + dz * SHORE_STEP * 2)) { nx += dx; nz += dz; }
      }
      const n = Math.hypot(nx, nz);
      if (n < 1.5) continue;   // a pool, or a sliver of water between two lands
      nx /= n; nz /= n;
      const off = halfWidth + BERTH_MARGIN;
      const pos = [x + nx * off, z + nz * off];
      const dx = Math.max(rect.minX - pos[0], 0, pos[0] - rect.maxX), dz = Math.max(rect.minZ - pos[1], 0, pos[1] - rect.maxZ);
      if (Math.hypot(dx, dz) > HARBOUR_REACH) continue;
      cands.push({ pos, normal: [nx, nz], d: Math.hypot(pos[0] - cx, pos[1] - cz) });
    }
  }
  cands.sort((a, b) => a.d - b.d || a.pos[0] - b.pos[0] || a.pos[1] - b.pos[1]);
  const berths = [];
  for (const c of cands) {
    if (berths.length >= max) break;
    if (berths.some((b) => dist2(b.pos, c.pos) < length * BERTH_SPACING)) continue;
    const along = Math.atan2(c.normal[0], c.normal[1]) + Math.PI / 2;
    // she lies along the shore, whichever way her approach astern of her is open water
    for (const yaw of [wrap(along), wrap(along + Math.PI)]) {
      if (!footprintClear(c.pos, yaw, hull, isWater)) continue;
      const back = length * APPROACH_LENGTHS;
      const approach = [c.pos[0] - Math.sin(yaw) * back + c.normal[0] * APPROACH_OUT, c.pos[1] - Math.cos(yaw) * back + c.normal[1] * APPROACH_OUT];
      if (!footprintClear(approach, yaw, hull, isWater)) continue;
      berths.push({ pos: c.pos, yaw, normal: c.normal, approach });
      break;
    }
  }
  if (!berths.length) return null;
  // the mouth: out along the berths' mean normal to open water all round. AUDIT SHIP-LIFE A5: shores facing apart (a
  // town on an isthmus, a peninsula's tip) cancel that mean out - then the nearest berth's own normal, from her own
  // place; and a berth that cannot reach the mouth through the water is no berth of this harbour
  let mx = 0, mz = 0, px = 0, pz = 0;
  for (const b of berths) { mx += b.normal[0]; mz += b.normal[1]; px += b.pos[0]; pz += b.pos[1]; }
  let m = Math.hypot(mx, mz);
  if (m < berths.length * MOUTH_AGREE) { [mx, mz] = berths[0].normal; [px, pz] = berths[0].pos; m = 1; }
  else { px /= berths.length; pz /= berths.length; }
  mx /= m; mz /= m;
  let mouth = null;
  for (let d = 0; d <= MOUTH_REACH && !mouth; d += SHORE_STEP) {
    const p = [px + mx * d, pz + mz * d];
    if (!water(p[0], p[1])) continue;
    let open = true;
    for (let k = 0; k < 12 && open; k++) { const a = (k / 12) * TAU; open = water(p[0] + Math.sin(a) * MOUTH_CLEAR, p[1] + Math.cos(a) * MOUTH_CLEAR); }
    if (open) mouth = p;
  }
  if (!mouth) return null;
  const grid = createWaterGrid({ isWater, hull });
  const reached = berths.filter((b) => grid.clear(b.approach, mouth) || grid.path(b.approach, mouth) != null);
  return reached.length ? { berths: reached, mouth, hull } : null;
}
/** AUDIT SHIP-LIFE A3: a leg's water sampled every this many cells. */
export const CLEAR_STEP = 0.25;
/** AUDIT SHIP-LIFE A1: the detours a stalled errand is given before it is given up. */
export const DETOUR_GIVEUP = 3;
/** AUDIT SHIP-LIFE A5: the berths' normals must agree this much (the mean's length over their count) for the mouth to
 *  lie along their mean. */
export const MOUTH_AGREE = 0.35;

/**
 * The water's grid for one hull: `path(from, to)` - [x, z] points from `from` to `to` through open water, the corners
 * straightened (a way's first point is `from`, its last `to`) - or null when there is none within PATH_NODES; and
 * `clear(a, b)`, whether the line between floats her.
 */
export function createWaterGrid({ isWater, hull = 0, cell = WATER_CELL, nodeCap = PATH_NODES }) {
  const cache = new Map();
  const key = (i, k) => `${i},${k}`;
  const centre = (i, k) => [(i + 0.5) * cell, (k + 0.5) * cell];
  const water = (x, z) => !!isWater(x, z, hull);
  let expansions = 0;
  function open(i, k) {
    const kk = key(i, k);
    let v = cache.get(kk);
    if (v !== undefined) return v;
    const [x, z] = centre(i, k);
    v = water(x, z);
    for (let a = 0; v && a < 8; a++) { const t = (a / 8) * TAU; v = water(x + Math.sin(t) * cell * WATER_CLEAR, z + Math.cos(t) * cell * WATER_CLEAR); }
    cache.set(kk, v);
    return v;
  }
  function clear(a, b) {
    // AUDIT SHIP-LIFE A3: sampled every quarter cell - at 0.4 a straightened leg clipped a 10 m spit's corner
    const d = dist2(a, b), n = Math.max(1, Math.ceil(d / (cell * CLEAR_STEP)));
    const sx = d > 0 ? (b[1] - a[1]) / d : 0, sz = d > 0 ? -(b[0] - a[0]) / d : 0;
    for (let s = 0; s <= n; s++) {
      const t = s / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      if (!water(x, z)) return false;
      if (Math.min(t, 1 - t) * d > LEG_END_M && !(water(x + sx * LEG_MARGIN, z + sz * LEG_MARGIN) && water(x - sx * LEG_MARGIN, z - sz * LEG_MARGIN))) return false;
    }
    return true;
  }
  /** The water straight between two points, no margin (a way's first and last legs, to and from the grid). */
  function wet(a, b) {
    const d = dist2(a, b), n = Math.max(1, Math.ceil(d / (cell * 0.25)));
    for (let s = 0; s <= n; s++) { const t = s / n; if (!water(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false; }
    return true;
  }
  /** The open cell nearest a point, within three rings, that the water joins to it (AUDIT SHIP-LIFE A3: never a cell
   *  across a spit - the leg to and from the grid is sailed as it lies, and the berthing leg with no swing off the
   *  shore) - null for none. */
  function nearestOpen(p) {
    const i0 = Math.floor(p[0] / cell), k0 = Math.floor(p[1] / cell);
    let best = null, bestD = Infinity;
    for (let r = 0; r <= 3 && !best; r++) {
      for (let i = i0 - r; i <= i0 + r; i++) for (let k = k0 - r; k <= k0 + r; k++) {
        if (Math.max(Math.abs(i - i0), Math.abs(k - k0)) !== r || !open(i, k) || !wet(p, centre(i, k))) continue;
        const d = dist2(centre(i, k), p);
        if (d < bestD) { bestD = d; best = [i, k]; }
      }
    }
    return best;
  }
  function path(from, to) {
    expansions = 0;
    if (clear(from, to)) return [[from[0], from[1]], [to[0], to[1]]];
    const s = nearestOpen(from), g = nearestOpen(to);
    if (!s || !g) return null;
    const gk = key(g[0], g[1]);
    const cost = new Map([[key(s[0], s[1]), 0]]), prev = new Map(), shut = new Set();
    const heap = [[dist2(centre(s[0], s[1]), centre(g[0], g[1])), s[0], s[1]]];
    const push = (e) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    let found = false;
    while (heap.length) {
      const [, i, k] = pop();
      const kk = key(i, k);
      if (shut.has(kk)) continue;
      shut.add(kk);
      if (kk === gk) { found = true; break; }
      if (++expansions > nodeCap) return null;
      const c0 = cost.get(kk);
      for (let di = -1; di <= 1; di++) for (let dk = -1; dk <= 1; dk++) {
        if (!di && !dk) continue;
        const ni = i + di, nk = k + dk, nkey = key(ni, nk);
        if (shut.has(nkey) || !open(ni, nk)) continue;
        if (di && dk && !(open(i + di, k) && open(i, k + dk))) continue;   // no corner cut past a closed cell
        const c = c0 + (di && dk ? Math.SQRT2 : 1) * cell;
        if (c < (cost.get(nkey) ?? Infinity)) { cost.set(nkey, c); prev.set(nkey, kk); push([c + dist2(centre(ni, nk), centre(g[0], g[1])), ni, nk]); }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let kk = gk; kk; kk = prev.get(kk)) { const [i, k] = kk.split(',').map(Number); cells.push(centre(i, k)); }
    cells.reverse();
    const raw = [[from[0], from[1]], ...cells, [to[0], to[1]]];
    // the corners straightened: from each point, the farthest ahead the water between lets her sail straight to
    const out = [raw[0]];
    let at = 0;
    while (at < raw.length - 1) {
      let next = at + 1;
      for (let q = raw.length - 1; q > at + 1; q--) if (clear(raw[at], raw[q])) { next = q; break; }
      out.push(raw[next]);
      at = next;
    }
    return out;
  }
  return { path, clear, open, get expansions() { return expansions; }, cell };
}

/** Her errand's own stream: off her seed, never her captain's. */
export const errandRng = (seed) => mulberry32(hash32(seed >>> 0, ERRAND_SALT));

/** A moored ship's dwell (s) - her stream's draw. */
export const dwellOf = (r) => DWELL_S[0] + r() * (DWELL_S[1] - DWELL_S[0]);

/**
 * The errand a ship keeps - at launch, and drawn again by whoever takes her over (it never rides the word): `harbours`
 * the known ones (`[{ key, harbour, free(i) }]`), `pos` where she is ([x, y, z]). A ship at a berth of a harbour (and
 * lying still) is moored there; else by her trade - a merchantman makes for the nearest harbour with a free berth
 * (else sails out of the world), a navy patrols the nearest harbour's approaches (else sails on), a pirate lurks off
 * them (else keeps her own cruise: null).
 */
export function errandFor({ seed, faction, hull, pos, speed = 0, clock = 0, harbours = [], clear = null }) {
  const r = errandRng(seed);
  const here = flat(pos);
  if (hull !== 3 && speed < BERTH_WAY) {
    for (const h of harbours) {
      const i = h.harbour.berths.findIndex((b) => dist2(b.pos, here) <= BERTH_SNAP_M);
      if (i >= 0) return { kind: 'moored', harbour: h.key, berth: i, until: clock + dwellOf(r), path: null, i: 0 };
    }
  }
  const near = harbours.map((h) => ({ h, d: dist2(h.harbour.mouth, here) })).filter((x) => x.d <= VOYAGE_REACH).sort((a, b) => a.d - b.d);
  if (faction === 'merchant') {
    for (const { h } of near) {
      const berth = hull === 3 ? -1 : h.harbour.berths.findIndex((_, i) => h.free?.(i) ?? true);
      if (berth >= 0) return { kind: 'arrive', harbour: h.key, berth, path: null, i: 0 };
    }
    return outbound(r, here, clear);
  }
  if (faction === 'navy') {
    if (near.length) return { kind: 'patrol', harbour: near[0].h.key, since: clock, path: null, i: 0, spin: r() };
    return outbound(r, here, clear);
  }
  if (faction === 'pirate' && near.length) {
    // AUDIT SHIP-LIFE A4: off the mouth on open water - the first of OUTBOUND_TRIES bearings the water from the mouth
    // reaches (`clear`), else the mouth itself
    const m = near[0].h.harbour.mouth;
    let at = null;
    for (let k = 0; k < OUTBOUND_TRIES && !at; k++) {
      const a = r() * TAU, q = [m[0] + Math.sin(a) * LURK_R, m[1] + Math.cos(a) * LURK_R];
      if (!clear || clear(m, q)) at = q;
    }
    return { kind: 'lurk', harbour: near[0].h.key, at: at ?? [m[0], m[1]], path: null, i: 0, spin: r() };
  }
  return null;
}
/** Out of the world on her stream's bearing - the first of OUTBOUND_TRIES draws with OUTBOUND_OPEN of open water ahead
 *  (`clear`, the grid's own), else the first drawn. */
export const OUTBOUND_TRIES = 12;
export const OUTBOUND_OPEN = 800;
function outbound(r, here, clear = null) {
  let a = r() * TAU;
  for (let k = 0; clear && k < OUTBOUND_TRIES; k++) {
    const b = k ? r() * TAU : a;
    if (clear(here, [here[0] + Math.sin(b) * OUTBOUND_OPEN, here[1] + Math.cos(b) * OUTBOUND_OPEN])) { a = b; break; }
  }
  return { kind: 'voyage', harbour: null, to: [here[0] + Math.sin(a) * VOYAGE_DIST, here[1] + Math.cos(a) * VOYAGE_DIST], path: null, i: 0 };
}

/** Along a way: its next point unreached, advanced past every one within REACH_M. */
function follow(ship, e) {
  const here = flat(ship.pos);
  while (e.i < e.path.length - 1 && dist2(here, e.path[e.i]) <= REACH_M) e.i++;
  return e.path[e.i];
}
/** What remains of a way from here (m). */
function remaining(ship, e) {
  let d = dist2(flat(ship.pos), e.path[e.i]);
  for (let q = e.i; q < e.path.length - 1; q++) d += dist2(e.path[q], e.path[q + 1]);
  return d;
}

/**
 * Her errand stepped: `ctx` - `{ harbour(key) -> harbour | null, grid(hull) -> water grid, free(key, i) -> bool,
 * harbours() -> the known [{ key, harbour, free }] }`. Answers her plan - `{ want, goal: [x, 0, z], sails }`, or
 * `{ hold: { pos: [x, z], yaw } }` while she lies moored - or null when the errand is done with and she keeps her own
 * cruise. `ship.errand` moves on as she does: moored -> depart -> voyage | patrol -> arrive -> moored.
 */
export function stepErrand(ship, dt, ctx) {
  const e = ship.errand;
  if (!e) return null;
  const hb = e.harbour != null ? ctx.harbour(e.harbour) : null;
  const here = flat(ship.pos);
  const plan = (goal, sails = 1) => ({ want: heading(here, goal), goal: [goal[0], 0, goal[1]], sails });
  // a stall: no way under sail for STALL_S - a detour abeam into open water, then her way planned anew past what held her
  if (e.kind !== 'moored') {
    // AUDIT SHIP-LIFE A1: whatever sail she carries - the last of a berthing's way and a captain boxed in by the land
    // both shorten it, and a hulk across either held her there for good
    e.stall = ship.speed < STALL_WAY ? (e.stall ?? 0) + dt : 0;
    if (e.stall >= STALL_S) {
      // held on a detour too: the other side (the first one's abeam lay across what held her)
      e.stall = 0;
      // AUDIT SHIP-LIFE A1: held past DETOUR_GIVEUP detours (a hulk across a berthing's last leg, which her way is
      // planned through again each time) - the errand is given up: an arriving ship makes for another free berth,
      // else out; any other keeps her own cruise
      e.detours = (e.detours ?? 0) + 1;
      if (e.detours > DETOUR_GIVEUP) {
        const other = e.kind === 'arrive' && hb && ship.hull !== 3 ? hb.berths.findIndex((_, i) => i !== e.berth && (ctx.free?.(e.harbour, i) ?? true)) : -1;
        ship.errand = other >= 0 ? { kind: 'arrive', harbour: e.harbour, berth: other, path: null, i: 0 }
          : e.kind === 'arrive' ? outbound(errandRng(ship.seed ^ Math.floor(ship.clock)), here, ctx.grid(ship.hull).clear) : null;
        return stepErrand(ship, dt, ctx);
      }
      const clear = ctx.grid(ship.hull).clear;
      const sides = e.detour ? [-(e.side ?? 1), e.side ?? 1] : [1, -1];
      e.detour = null;
      for (const side of sides) {
        const a = ship.yaw + side * Math.PI / 2, q = [here[0] + Math.sin(a) * DETOUR_M, here[1] + Math.cos(a) * DETOUR_M];
        if (clear(here, q)) { e.detour = q; e.side = side; break; }
      }
    }
    if (e.detour) {
      if (dist2(here, e.detour) > REACH_M) return plan(e.detour, 0.6);
      e.detour = null; e.path = null;
    }
  }
  // AUDIT SHIP-LIFE A2: no way through the water (none within PATH_NODES - a headland too deep, a berth the water does
  // not join) is null - never the straight line over the land it was, sailed at the shore for good; the caller gives
  // the errand up and she keeps her own cruise
  const way = (to, via = null) => {
    if (!e.path) {
      const grid = ctx.grid(ship.hull);
      const a = grid.path(here, via ?? to), b = via ? grid.path(via, to) : null;
      if (!a || (via && !b)) return null;
      e.path = [...a, ...(b ? b.slice(1) : [])].map((q) => [q[0], q[1]]); e.i = 0;   // her own points - never a harbour's, which the origin moves apart
    }
    return follow(ship, e);
  };
  const giveUp = () => { ship.errand = null; return null; };
  switch (e.kind) {
    case 'moored': {
      const b = hb?.berths[e.berth];
      if (!b) { ship.errand = null; return null; }
      if (dist2(here, b.pos) > BERTH_SNAP_M * 2) { ship.errand = { kind: 'arrive', harbour: e.harbour, berth: e.berth, path: null, i: 0 }; return stepErrand(ship, dt, ctx); }   // moved off her berth (a fight): back to it
      if (ship.clock >= e.until && !(ctx.night && ship.cls?.faction === 'merchant')) {   // SHIP-WATCH: a merchantman waits for the morning
        ship.errand = { kind: 'depart', harbour: e.harbour, berth: e.berth, path: null, i: 0 };
        return stepErrand(ship, dt, ctx);
      }
      return { hold: { pos: alongside(b, ship.hull, hb.hull), yaw: b.yaw } };   // QUAYS: her side to its quay
    }
    case 'depart': {
      if (!hb) { ship.errand = null; return null; }
      const b = hb.berths[e.berth];
      const p = way(hb.mouth, b ? [b.pos[0] + b.normal[0] * (hullSize(ship.hull).halfWidth * 3 + 20), b.pos[1] + b.normal[1] * (hullSize(ship.hull).halfWidth * 3 + 20)] : null);
      if (!p) return giveUp();
      if (dist2(here, hb.mouth) <= REACH_M * 1.5) {
        const r = errandRng(ship.seed ^ Math.floor(ship.clock));
        if (ship.cls?.faction === 'navy') ship.errand = { kind: 'patrol', harbour: e.harbour, since: ship.clock, path: null, i: 0, spin: r() };
        else {
          const other = (ctx.harbours?.() ?? []).filter((x) => x.key !== e.harbour && dist2(x.harbour.mouth, here) <= VOYAGE_REACH).sort((a, c) => dist2(a.harbour.mouth, here) - dist2(c.harbour.mouth, here))[0];
          ship.errand = other ? { kind: 'voyage', harbour: other.key, to: null, path: null, i: 0 } : outbound(r, here, ctx.grid(ship.hull).clear);
        }
        return stepErrand(ship, dt, ctx);
      }
      return plan(p, 0.8);
    }
    case 'voyage': {
      const to = hb ? hb.mouth : e.to;
      if (!to) { ship.errand = null; return null; }
      const p = hb ? way(to) : to;   // out of the world: straight, her lookout's own land swing on the way
      if (!p) return giveUp();
      if (dist2(here, to) <= REACH_M * 1.5) {
        if (hb) {
          const berth = hb.berths.findIndex((_, i) => ctx.free?.(e.harbour, i) ?? true);
          ship.errand = berth >= 0 && ship.hull !== 3 ? { kind: 'arrive', harbour: e.harbour, berth, path: null, i: 0 } : outbound(errandRng(ship.seed ^ 0x77), here, ctx.grid(ship.hull).clear);
        } else ship.errand = outbound(errandRng(ship.seed ^ Math.floor(ship.clock)), here, ctx.grid(ship.hull).clear);
        return stepErrand(ship, dt, ctx);
      }
      return plan(p, 1);
    }
    case 'arrive': {
      const b = hb?.berths[e.berth];
      if (!b) { ship.errand = null; return null; }
      // AUDIT HOLDINGS Q5: her berth looked at again on the way in - taken since she chose it (a player's ship made fast
      // there, here or on another player's screen, whose putOff never reaches the ship I stand) - another free berth,
      // else out
      if (ctx.free && !ctx.free(e.harbour, e.berth, ship)) {
        const other = hb.berths.findIndex((_, i) => i !== e.berth && ctx.free(e.harbour, i, ship));
        ship.errand = other >= 0 && ship.hull !== 3 ? { kind: 'arrive', harbour: e.harbour, berth: other, path: null, i: 0 } : outbound(errandRng(ship.seed ^ Math.floor(ship.clock)), here, ctx.grid(ship.hull).clear);
        return stepErrand(ship, dt, ctx);
      }
      const p = way(b.pos, b.approach);
      if (!p) return giveUp();
      const left = remaining(ship, e);
      if (dist2(here, b.pos) <= BERTH_SNAP_M && ship.speed <= BERTH_WAY) {
        ship.errand = { kind: 'moored', harbour: e.harbour, berth: e.berth, until: ship.clock + dwellOf(errandRng(ship.seed ^ Math.floor(ship.clock))), path: null, i: 0 };
        return { hold: { pos: alongside(b, ship.hull, hb.hull), yaw: b.yaw } };   // QUAYS: eased in alongside its quay
      }
      const sails = left >= ARRIVE_EASE_M ? 1 : Math.max(ARRIVE_SAILS, left / ARRIVE_EASE_M);
      // the last leg, into a berth the harbour sounded: no swing off the shore she lies along
      return { ...plan(p, sails), berthing: e.i === e.path.length - 1 };
    }
    case 'patrol': {
      if (!hb) { ship.errand = null; return null; }
      if (ship.clock - e.since >= PATROL_S) { ship.errand = outbound(errandRng(ship.seed ^ Math.floor(ship.clock)), here, ctx.grid(ship.hull).clear); return stepErrand(ship, dt, ctx); }
      if (!e.path) {
        const grid = ctx.grid(ship.hull), ring = [];
        for (let k = 0; k < PATROL_POINTS; k++) {
          const a = (e.spin ?? 0) * TAU + (k / PATROL_POINTS) * TAU;
          const q = [hb.mouth[0] + Math.sin(a) * PATROL_R, hb.mouth[1] + Math.cos(a) * PATROL_R];
          if (grid.clear(hb.mouth, q)) ring.push(q);   // AUDIT SHIP-LIFE A4: a point the water from the mouth reaches
        }
        e.path = ringOver(ring, [hb.mouth[0], hb.mouth[1]], grid.clear); e.i = 0;
      }
      if (dist2(here, e.path[e.i]) <= REACH_M) e.i = (e.i + 1) % e.path.length;
      return plan(e.path[e.i], 0.7);
    }
    case 'lurk': {
      // SHIP-WATCH: by night her lurking place closer in on the mouth (NIGHT_LURK_K) - her ring laid afresh at the turn
      const night = !!ctx.night && !!hb;
      if (e.night !== night) { e.night = night; e.path = null; }
      const at = night ? [hb.mouth[0] + (e.at[0] - hb.mouth[0]) * NIGHT_LURK_K, hb.mouth[1] + (e.at[1] - hb.mouth[1]) * NIGHT_LURK_K] : e.at;
      if (!e.path) {
        const clear = ctx.grid(ship.hull).clear, ring = [];
        for (let k = 0; k < 4; k++) {
          const a = (e.spin ?? 0) * TAU + (k / 4) * TAU, q = [at[0] + Math.sin(a) * LURK_RING, at[1] + Math.cos(a) * LURK_RING];
          if (clear(at, q)) ring.push(q);   // AUDIT SHIP-LIFE A4: as the patrol's
        }
        e.path = ringOver(ring, [at[0], at[1]], clear); e.i = 0;
      }
      if (dist2(here, e.path[e.i]) <= REACH_M) e.i = (e.i + 1) % e.path.length;
      return plan(e.path[e.i], dist2(here, at) > LURK_R * 0.5 ? 1 : LURK_SAILS);
    }
    default:
      ship.errand = null;
      return null;
  }
}

/**
 * AUDIT SHIP-LIFE A4: a ring of points sailed round - each chord the water does not carry her along goes by the hub
 * instead (the mouth, the lurking place), the closing chord too; no point at all is the hub alone.
 */
function ringOver(ring, hub, clear) {
  if (!ring.length) return [hub];
  const out = [];
  for (const q of ring) { if (out.length && !clear(out[out.length - 1], q)) out.push([hub[0], hub[1]]); out.push(q); }
  if (out.length > 1 && !clear(out[out.length - 1], out[0])) out.push([hub[0], hub[1]]);
  return out;
}

/** Every point an errand keeps, moved with the world (the host's floating origin): `o` the shift [x, y, z]. */
export function offsetErrand(e, o) {
  if (!e) return;
  const mv = (p) => { if (p) { p[0] += o[0]; p[1] += o[2]; } };
  mv(e.to); mv(e.at); mv(e.detour);
  for (const p of e.path ?? []) mv(p);
}
/** A harbour moved with the world. */
export function offsetHarbour(h, o) {
  if (!h) return;
  const mv = (p) => { p[0] += o[0]; p[1] += o[2]; };
  mv(h.mouth);
  for (const b of h.berths) { mv(b.pos); mv(b.approach); }
}
