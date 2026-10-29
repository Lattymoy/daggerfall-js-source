// @ts-check
// IC-BACKYARD (2026-10-29, the owner: "not all houses in imperial city are void of yards"; the rule left to us - "Whatever
// works"): AN IMPERIAL CITY HOUSE'S YARD IS THE COURT BEHIND IT. AUDIT TAMRIEL-WIDE A1 left every fabric house yardless
// (a lot grown round its door held its own rooms, its neighbours' and the street), but a ring block's houses back onto a
// court the fabric parts with garden walls (world/imperialFabric.js makeBlock). A house with one street front owns the
// court behind its back wall: its own width, to the first garden wall, shed, well or back range, and to the court's mitre
// with the houses on its other sides - so no two yards meet. A corner house meets the court at a point; a row through a
// narrow block has none. The yard is turned with its house, as the city's streets are. Pure: the same on every client.
import { fabricCell, fabricGroundAt, outwardOf, inQuad, GROUND } from './imperialFabric.js';
import { fabricCellBuildings, subRecordFrame } from './imperialFabricBuildings.js';
import { imperialBlockOf } from './imperialBlocks.js';
import { IMPERIAL_CELLS, pointSeg } from './imperialCity.js';
import { BLOCK_M } from './blockHash.js';
import { GLOBAL_SCALE } from './meshReader.js';
import { RMB_DIMENSION } from '../formats/blocksFile.js';

/** The survey's step and its edges' walk; the gap kept off the party walls and between two yards at a mitre; the gap off
 *  the house's own back wall; a yard's smallest side; how far from its door a yard reaches (metres) - inside the
 *  decorator's leash (scenes/decor/decorTool.js DECOR_FLY_LEASH), its free eye flown from the door over the roof. */
export const BACKYARD = Object.freeze({ step: 0.5, walk: 0.05, side: 0.4, back: 0.3, min: 2, reach: 36 });
const HALF = IMPERIAL_CELLS / 2, B = BLOCK_M;

/** Whether (x, z) stands nearer court Q's edge e than any other of its edges, by BACKYARD.side. */
function nearestEdge(Q, e, x, z) {
  const d = pointSeg(x, z, Q[e], Q[(e + 1) & 3]) + BACKYARD.side;
  for (let k = 0; k < 4; k++) if (k !== e && pointSeg(x, z, Q[k], Q[(k + 1) & 3]) < d) return false;
  return true;
}

/**
 * THE YARD of a fabric building (world/imperialFabricBuildings.js fabricCellBuildings' `b`), from `at` (its record's
 * origin, the city's metres; its door by default): `{ lot, turn }` - `lot` the biggest rectangle of its own court,
 * [x0, z0, x1, z1] on the scene's axes (x east, z north - the city's z turned) turned by `turn` (radians; a frame's point
 * (x, z) stands at (x cos + z sin, z cos - x sin) on them). Null where it has no court of its own.
 * @param {any} b @param {number[]} [at]
 */
export function fabricBackyard(b, at = b?.door?.at) {
  const p = b?.plot, e = b?.door?.edge;
  if (!p || !Array.isArray(at) || !Number.isInteger(e) || (p.out & 15) !== 1 << e) return null;   // a street front, and one
  const { step, side, back, min, reach } = BACKYARD;
  const k = (e + 2) & 3, A = p.q[k], Bq = p.q[(k + 1) & 3], n = outwardOf(p.q, k);
  const len = Math.hypot(Bq[0] - A[0], Bq[1] - A[1]), t = [(Bq[0] - A[0]) / len, (Bq[1] - A[1]) / len];
  if (!(len >= 2 * side + min)) return null;
  // the court its back wall stands on, and that wall's edge of it: of the courts behind it, the one with an edge along the
  // wall (where two neighbourhoods meet, another block's court can lie over its own)
  const wall = [(A[0] + Bq[0]) / 2, (A[1] + Bq[1]) / 2], mid = [wall[0] + n[0] * (back + step), wall[1] + n[1] * (back + step)];
  let Q = null, qe = 0, gap = Infinity;
  for (const q of fabricCell(Math.floor(mid[1] / B + HALF), Math.floor(mid[0] / B + HALF)).courts) {
    if (!inQuad(q, mid[0], mid[1])) continue;
    for (let i = 0; i < 4; i++) { const d = pointSeg(wall[0], wall[1], q[i], q[(i + 1) & 3]); if (d < gap) { Q = q; qe = i; gap = d; } }
  }
  if (!Q) return null;
  /** Whether the point `u` along the wall and `v` out from it is its own open court, within reach of its door. */
  const open = (u, v) => {
    const x = A[0] + t[0] * u + n[0] * v, z = A[1] + t[1] * u + n[1] * v;
    return Math.hypot(x - at[0], z - at[1]) <= reach && fabricGroundAt(x, z) === GROUND.court && nearestEdge(Q, qe, x, z);
  };
  // its depth a step along the wall and at its far end: to the first thing standing in it (and the door farther at every
  // step out from the back wall)
  const cols = Math.ceil((len - 2 * side) / step) + 1, us = [], depth = [];
  for (let m = 0; m < cols; m++) {
    const u = Math.min(side + m * step, len - side);
    let last = 0;
    for (let v = back; open(u, v); v += step) last = v;
    us.push(u);
    depth.push(last);
  }
  // the biggest rectangle over the columns: between two the shallower holds (an oblique wall's depth runs straight)
  let best = null, area = 0;
  for (let i = 0; i < cols; i++) {
    let d = Infinity;
    for (let j = i; j < cols; j++) {
      d = Math.min(d, depth[j]);
      const w = us[j] - us[i], a = w * (d - back);
      if (w >= min && d - back >= min && a > area) { area = a; best = [us[i], us[j], d]; }
    }
  }
  if (!best) return null;
  // the survey read the ground at its points; what stands between them reaches in across an edge alone (nothing standing
  // in a court is narrower than a step - a garden wall's ground is a metre across), so each edge is walked BACKYARD.walk
  // apart and drawn in half a step where it meets anything
  let [u0, u1, v1] = best, v0 = back;
  const clear = (a, b, c, d) => {
    const m = Math.ceil(Math.hypot(c - a, d - b) / BACKYARD.walk);
    for (let i = 0; i <= m; i++) if (!open(a + ((c - a) * i) / m, b + ((d - b) * i) / m)) return false;
    return true;
  };
  for (;;) {
    if (u1 - u0 < min || v1 - v0 < min) return null;
    if (!clear(u0, v1, u1, v1)) v1 -= step / 2;
    else if (!clear(u0, v0, u0, v1)) u0 += step / 2;
    else if (!clear(u1, v0, u1, v1)) u1 -= step / 2;
    else if (!clear(u0, v0, u1, v0)) v0 += step / 2;
    else break;
  }
  // its corners on the scene's axes from `at`, then on the yard's own
  const turn = Math.atan2(-t[1], t[0]), cs = Math.cos(turn), sn = Math.sin(turn);
  const corners = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => {
    const x = A[0] + t[0] * u + n[0] * v - at[0], z = at[1] - (A[1] + t[1] * u + n[1] * v);
    return [x * cs + z * sn, z * cs - x * sn];
  });
  const xs = corners.map((c) => c[0]), zs = corners.map((c) => c[1]);
  return { lot: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)], turn };
}

/** A fabric building's record's origin in the city's metres - its subrecord's place (subRecordFrame, in Daggerfall's
 *  units as world/rmbLayout.js lays it), where its yard's frame stands (scenes/pixelBuild.js homeFrames). */
export function fabricRecordOrigin(r, c, b) {
  const f = subRecordFrame(r, c, b);
  return [(c - HALF) * B + f.xPos * GLOBAL_SCALE, (r + 1 - HALF) * B - (RMB_DIMENSION - f.zPos) * GLOBAL_SCALE];
}

const _yards = new Map();
const KEEP = 512;
/** The yard of record `recordIndex` of the block named `name` - a cell's own block of the Imperial City
 *  (world/imperialBlocks.js imperialOwnName) - in its record's frame (fabricBackyard), or null: another block's, or no
 *  court of its own. Kept (an LRU). */
export function fabricBackyardOf(name, recordIndex) {
  const key = `${name}:${recordIndex}`;
  if (_yards.has(key)) { const y = _yards.get(key); _yards.delete(key); _yards.set(key, y); return y; }
  const cell = imperialBlockOf(name);
  const b = cell?.kind === 'own' && Number.isInteger(recordIndex) ? fabricCellBuildings(cell.r, cell.c)[recordIndex] ?? null : null;
  const y = b ? Object.freeze(fabricBackyard(b, fabricRecordOrigin(cell.r, cell.c, b))) : null;
  _yards.set(key, y);
  if (_yards.size > KEEP) _yards.delete(_yards.keys().next().value);
  return y;
}
