#!/usr/bin/env node
// FIELD BUGS 2026-10-15f TEMPLE-STEPS: THE SOLIDS THE PORT STANDS IN A TOWN'S BLOCK, SWEPT - against the author's own
// models and against every exterior door's approach. The law test/world/wd3_standins.test.js holds on the player's data.
//
//   ARENA2_PATH=<the player's arena2> node tools/townSolidsSweep.mjs          print every finding over both packs' blocks
//   ARENA2_PATH=<...> node tools/townSolidsSweep.mjs TEMPASF1.RMB ...         only these blocks
//
// Each block of both vendored town packs - each pack's own, rebuilt over the player's BLOCKS.BSA as the world-data door
// rebuilds it and curated for that pack (world/curatedPlacements.js) - is laid out as the streaming host lays it
// (layoutRmbBlock, the enhanced skin), every model the mesh the pipeline builds for it (tools/townQuestMarkers.mjs
// openTownData's getModel: the stand-ins, the alias beds, the rest out of the player's ARCH3D), and its drawn hills and
// HILL-SEAT pads as the host builds them (townStandIns.js blockHillSeat, blockHillPatch over the same meshes). Three laws:
//
//   HELD - no structure the port stands in for the RMB Resource Pack (RMBRP_STRUCTURES: the pieces whose stand-in is the
//     pack's own mesh, box for box) holds a vertex of another model the author placed in the block more than TOUCH_M
//     inside its faces. A structure drawn bigger than its prefab swallows what the author stood against it: the
//     foundation drawn 16 m square buried TEMPASF1's and TEMPASH4's temple stairs and landings. (What the author laid
//     into a structure himself - a landing half under its foundation, a rock against one - the pack's own meshes hold
//     too: the test names each.)
//   PADS - no HILL-SEAT pad stands over a vertex of any model the drawn hills and the plane leave in the open (more than
//     HILL_PATCH_SINK over them): a pad is the port's own, and buries nothing the author left in sight.
//   APPROACH - every exterior door's approach is clear of every solid the port generates there: the door's step and
//     DOOR_APPROACH_M before it (HILL-HOUSE's rule), across the door, from APPROACH_FOOT_M over its foot to
//     APPROACH_HEAD_M - no stand-in holds a point of it (deeper than TOUCH_M), and no drawn hill or pad stands over one
//     (by more than TOUCH_M).
//
// A finding names the pack, the block, the piece and what it holds or stands in. Nothing of ARENA2 or the packs is
// written; the numbers are a measurement of the player's data.
import { join } from 'node:path';
import { isMain } from './lib/isMain.mjs';
import { openTownData, VENDORS } from './townQuestMarkers.mjs';
import { layoutRmbBlock } from '../src/world/rmbLayout.js';
import { RMBRP_HILLS, RMBRP_DOCKS, blockHillSeat, blockHillPatch, drawnHillStandIn, doorApproach, doorApproachPoints, HILL_PATCH_SINK, CITY_WALL_PIECE } from '../src/world/townStandIns.js';
import { hasCustomModel } from '../src/world/customModels.js';
import { blockFromJson } from '../src/formats/worldData/worldDataReplacement.js';
import { curateBlockPlacements } from '../src/world/curatedPlacements.js';

/** "A few centimetres": two classic units (0.05 m - the overlap the author's own models stand in: TEMPASF1's temple floor
 *  two units under its foundations' tops) and a centimetre's slack. A point no deeper than this inside a solid, or
 *  under a drawn surface, only touches it. */
export const TOUCH_M = 0.06;
/** The approach's height over the door's foot: from a hair over the step to a person's head (townQuestMarkers' WALK.head). */
export const APPROACH_FOOT_M = 0.1;
export const APPROACH_HEAD_M = 1.7;
/** The approach's samples: every APPROACH_STEP_M out and across, every twice that up. */
export const APPROACH_STEP_M = 0.25;
/** HELD's holders: the RMB Resource Pack's structures whose stand-in is the pack's own mesh - the temple's platform and the
 *  foundation (townStandIns.js RMBRP_BLOCK_CM), the docks and their two stairs, the three domes, the city-wall piece. */
export const RMBRP_STRUCTURES = Object.freeze([53160, 53170, ...Object.keys(RMBRP_DOCKS).map(Number), 53143, 53144, 53182, 53187, 53194, CITY_WALL_PIECE]);

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const at = (M, x, y, z) => [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];

/** A placed mesh as a solid in the block's frame: its triangles and its box. */
export function placedSolid(mesh, M) {
  const p = mesh.positions, w = [];
  for (let i = 0; i < p.length; i += 3) w.push(at(M, p[i], p[i + 1], p[i + 2]));
  const tris = [];
  for (let t = 0; t + 2 < mesh.indices.length; t += 3) tris.push([w[mesh.indices[t]], w[mesh.indices[t + 1]], w[mesh.indices[t + 2]]]);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const v of w) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); }
  return { tris, lo, hi };
}
/** The generalised winding number of a solid's faces round `q` (Van Oosterom and Strackee's solid angle): +-1 inside a
 *  closed shell, 0 outside it, whichever way its faces wind. */
function winding(s, q) {
  let w = 0;
  for (const [A, B, C] of s.tris) {
    const a = sub(A, q), b = sub(B, q), c = sub(C, q), la = len(a), lb = len(b), lc = len(c);
    w += 2 * Math.atan2(dot(a, cross(b, c)), la * lb * lc + dot(a, b) * lc + dot(a, c) * lb + dot(b, c) * la);
  }
  return w / (4 * Math.PI);
}
/** A point's distance to a triangle (Ericson's closest point, Real-Time Collision Detection 5.1.5). */
function distanceToTriangle(p, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return len(ap);
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return len(bp);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return len(sub(p, [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v])); }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return len(cp);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return len(sub(p, [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w])); }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); return len(sub(p, [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w])); }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return len(sub(p, [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]));
}
/** How far inside the solid `q` stands - its distance to the nearest face - or 0 outside it. */
export function depthInside(s, q) {
  if (q[0] < s.lo[0] || q[1] < s.lo[1] || q[2] < s.lo[2] || q[0] > s.hi[0] || q[1] > s.hi[1] || q[2] > s.hi[2]) return 0;
  if (Math.abs(winding(s, q)) < 0.5) return 0;
  let d = Infinity;
  for (const [a, b, c] of s.tris) d = Math.min(d, distanceToTriangle(q, a, b, c));
  return d;
}

/** A door's approach as the sweep reads it: the ground's points (townStandIns.js doorApproachPoints, HILL-HOUSE's rule), each
 *  from APPROACH_FOOT_M over the door's foot to APPROACH_HEAD_M. */
export function approachPoints(a) {
  const pts = [];
  for (const [x, z, k] of doorApproachPoints(a, APPROACH_STEP_M)) {
    for (let h = APPROACH_FOOT_M; h <= APPROACH_HEAD_M + 1e-9; h += APPROACH_STEP_M * 2) pts.push({ k, p: [x, a.foot[1] + h, z] });
  }
  return pts;
}

/**
 * One block's findings. `models` its layout (layoutRmbBlock's), `getModel(id)` the mesh the pipeline builds for an id;
 * `drawn` the hills' meshes (the stand-ins'), `pads` whether the host's HILL-SEAT pads are laid (they are).
 * @returns {{held: Array<{standIn:number, index:number, other:number, otherIndex:number, vertices:number, depth:number}>, pads: Array<{model:number, index:number, vertices:number, over:number}>, approach: Array<{model:number, index:number, door:number, by:string, k:number, over:number}>, padTriangles:number}}
 */
export function sweepBlock(models, getModel, { drawn = drawnHillStandIn, pads = true } = {}) {
  const placed = models.map((m, index) => ({ index, id: m.modelIdNum, M: m.matrix, mesh: getModel(m.modelIdNum) })).filter((p) => p.mesh?.positions?.length && !RMBRP_HILLS[p.id]);
  const solidOf = new Map();
  const solid = (p) => { if (!solidOf.has(p)) solidOf.set(p, placedSolid(p.mesh, p.M)); return solidOf.get(p); };
  // HELD: a structure holds no other model's vertex past a touch
  const held = [];
  for (const s of placed.filter((p) => RMBRP_STRUCTURES.includes(p.id))) {
    for (const o of placed) {
      if (o === s) continue;
      let vertices = 0, depth = 0;
      const p = o.mesh.positions;
      for (let i = 0; i < p.length; i += 3) {
        const d = depthInside(solid(s), at(o.M, p[i], p[i + 1], p[i + 2]));
        if (d > TOUCH_M) { vertices++; depth = Math.max(depth, d); }
      }
      if (vertices) held.push({ standIn: s.id, index: s.index, other: o.id, otherIndex: o.index, vertices, depth: +depth.toFixed(2) });
    }
  }
  // the drawn hills, and the pads the host lays under what the author stood on them (scenes/world.js: the same meshes)
  const hills = blockHillSeat(models, drawn), seat = blockHillSeat(models, drawn);
  const patch = pads && seat ? blockHillPatch(seat, models, (m) => getModel(m.modelIdNum), drawn) : null;
  const padTop = patch ? blockHillSeat([{ modelIdNum: 1, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }], () => patch) : null;
  // PADS: no pad over what the hills and the plane leave in the open
  const padFindings = [];
  if (padTop) {
    for (const o of placed) {
      let vertices = 0, over = 0;
      const p = o.mesh.positions;
      for (let i = 0; i < p.length; i += 3) {
        const [x, y, z] = at(o.M, p[i], p[i + 1], p[i + 2]);
        if (y <= Math.max(hills.topAt(x, z) ?? 0, 0) + HILL_PATCH_SINK) continue;   // the drawn ground buries it anyway
        const t = padTop.topAt(x, z);
        if (t !== null && t > y - HILL_PATCH_SINK + 1e-4) { vertices++; over = Math.max(over, t - y); }
      }
      if (vertices) padFindings.push({ model: o.id, index: o.index, vertices, over: +over.toFixed(2) });
    }
  }
  // APPROACH: every door's step and the metres before it clear of every solid the port generates there
  const standIns = placed.filter((p) => hasCustomModel(p.id));
  const approach = [];
  for (const o of placed) {
    for (const [door, d] of (o.mesh.doors ?? []).entries()) {
      const worst = new Map();
      const note = (key, k, over) => { const w = worst.get(key); worst.set(key, { by: key, k: Math.min(w?.k ?? Infinity, k), over: Math.max(w?.over ?? 0, over) }); };
      for (const { k, p } of approachPoints(doorApproach(d, o.M))) {
        for (const s of standIns) { const depth = depthInside(solid(s), p); if (depth > TOUCH_M) note(`${s.id}#${s.index}`, k, depth); }
        const hill = hills?.topAt(p[0], p[2]) ?? null, pad = padTop?.topAt(p[0], p[2]) ?? null;
        if (hill !== null && hill - p[1] > TOUCH_M) note('a hill', k, hill - p[1]);
        if (pad !== null && pad - p[1] > TOUCH_M) note('a pad', k, pad - p[1]);
      }
      for (const w of worst.values()) approach.push({ model: o.id, index: o.index, door, by: w.by, k: w.k, over: +w.over.toFixed(2) });
    }
  }
  return { held, pads: padFindings, approach, padTriangles: patch ? patch.indices.length / 3 : 0 };
}

/** Every block of both packs, each pack's own, curated as the door curates it: `each(vendor, name, models)`. */
export function eachPackBlock(data, each, only = null) {
  for (const [vendor] of VENDORS) {
    const p = data.packs[vendor];
    for (const file of p.names()) {
      if (!file.endsWith('.RMB.json')) continue;
      const name = file.slice(0, -5);
      if (only && !only.has(name)) continue;
      const dfBlock = blockFromJson(p.rebuild(file, data.maps), data.blocks.getBlockIndex(name), name);
      curateBlockPlacements(dfBlock, vendor);
      each(vendor, name, layoutRmbBlock(dfBlock, { enhanced: true }).models);
    }
  }
}

/** The sweep over both packs: counts, and each law's findings as lines '<pack> <block>: ...'. */
export function sweepTownPacks(data, { only = null } = {}) {
  const out = { blocks: 0, doors: 0, padded: 0, held: [], pads: [], approach: [] };
  eachPackBlock(data, (vendor, name, models) => {
    const r = sweepBlock(models, data.getModel);
    out.blocks++;
    if (r.padTriangles) out.padded++;
    for (const m of models) out.doors += data.getModel(m.modelIdNum)?.doors?.length ?? 0;
    for (const h of r.held) out.held.push(`${vendor} ${name}: ${h.standIn}#${h.index} holds ${h.other}#${h.otherIndex} (${h.vertices} vertices, ${h.depth} m in)`);
    for (const p of r.pads) out.pads.push(`${vendor} ${name}: a pad over ${p.model}#${p.index} (${p.vertices} vertices, ${p.over} m)`);
    for (const a of r.approach) out.approach.push(`${vendor} ${name}: door ${a.door} of ${a.model}#${a.index} - ${a.by} ${a.over} m into it, ${a.k} m out`);
  }, only);
  return out;
}

if (isMain(import.meta.url)) {
  const arena2 = process.env.ARENA2_PATH;
  if (!arena2) { console.error('ARENA2_PATH not set'); process.exit(2); }
  const quiet = console.log;
  console.log = () => {};
  const data = await openTownData(join(arena2));
  const only = process.argv.length > 2 ? new Set(process.argv.slice(2)) : null;
  const r = sweepTownPacks(data, { only });
  console.log = quiet;
  console.log(`${r.blocks} blocks, ${r.doors} doors, ${r.padded} padded`);
  for (const law of ['held', 'pads', 'approach']) {
    console.log(`${law.toUpperCase()} (${r[law].length}):`);
    for (const l of r[law]) console.log(`  ${l}`);
  }
}
