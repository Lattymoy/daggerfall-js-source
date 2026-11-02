// @ts-check
// IC-BACKYARD (2026-10-29, the owner: "not all houses in imperial city are void of yards"; the rule left to us - "Whatever
// works"): AN IMPERIAL CITY HOUSE'S YARD IS THE COURT BEHIND IT. AUDIT TAMRIEL-WIDE A1 left every fabric house yardless
// (a lot grown round its door held its own rooms, its neighbours' and the street), but a ring block's houses back onto a
// court the fabric parts with garden walls (world/imperialFabric.js makeBlock). A house with one street front owns the
// court behind its back wall: its own width, to the first garden wall, shed, well or back range, and the ground nearer
// it than any other building reaching into the court - so no two yards meet. A corner house and a row through a narrow
// block have a street behind them. The yard is turned with its house, as the city's streets are. Pure: every client's.
import { fabricCell, fabricGroundAt, outwardOf, inQuad, GROUND, WELL } from './imperialFabric.js';
import { fabricCellBuildings, subRecordFrame } from './imperialFabricBuildings.js';
import { imperialBlockOf } from './imperialBlocks.js';
import { IMPERIAL_CELLS, pointSeg } from './imperialCity.js';
import { BLOCK_M } from './blockHash.js';
import { GLOBAL_SCALE } from './meshReader.js';
import { RMB_DIMENSION } from '../formats/blocksFile.js';

/** The survey's step and its edges' walk; the gap kept off the party walls and between two yards; the gap off the house's
 *  own back wall; a yard's smallest side; how far from its door a yard reaches - inside the decorator's leash
 *  (scenes/decor/decorTool.js DECOR_FLY_LEASH), its free eye flown from the door over the roof; how far before the line
 *  of its back wall another building reaches to bound it - its own side's stand behind it, a curved side's within a metre
 *  (metres). */
export const BACKYARD = Object.freeze({ step: 0.5, walk: 0.05, side: 0.4, back: 0.3, min: 2, reach: 36, front: 1 });
const HALF = IMPERIAL_CELLS / 2,
  B = BLOCK_M;
/** AUDIT IC-BACKYARD P5: a well's roof over the ground about it (world/imperialFabricModels.js buildWell), the ground law's
 *  pad (0.3 m) past it - a walker passes under it, a yard's piece would stand into it. */
const WELL_ROOF = [WELL.r + WELL.eave + 0.3, WELL.ridge + 0.3];
/** A point's distance to a quad - 0 inside it. */
const gapTo = (q, x, z) =>
  inQuad(q, x, z)
    ? 0
    : Math.min(
        pointSeg(x, z, q[0], q[1]),
        pointSeg(x, z, q[1], q[2]),
        pointSeg(x, z, q[2], q[3]),
        pointSeg(x, z, q[3], q[0]),
      );

/**
 * THE YARD of a fabric building (world/imperialFabricBuildings.js fabricCellBuildings' `b`), from `at` (its record's
 * origin, the city's metres; its door by default): `{ lot, turn }` - `lot` the biggest rectangle of its own court,
 * [x0, z0, x1, z1] on the scene's axes (x east, z north - the city's z turned) turned by `turn` (radians; a frame's point
 * (x, z) stands at (x cos + z sin, z cos - x sin) on them). Null where it has no court of its own.
 * @param {any} b @param {number[]} [at]
 */
export function fabricBackyard(b, at = b?.door?.at) {
  const p = b?.plot,
    e = b?.door?.edge;
  if (!p || !Array.isArray(at) || !Number.isInteger(e) || (p.out & 15) !== 1 << e) return null; // a street front, and one
  const { step, side, back, min, reach } = BACKYARD;
  const k = (e + 2) & 3,
    A = p.q[k],
    Bq = p.q[(k + 1) & 3],
    n = outwardOf(p.q, k);
  const len = Math.hypot(Bq[0] - A[0], Bq[1] - A[1]),
    t = [(Bq[0] - A[0]) / len, (Bq[1] - A[1]) / len];
  if (!(len >= 2 * side + min)) return null;
  // AUDIT IC-BACKYARD T1: THE COURT PARTED BETWEEN THE BUILDINGS ROUND IT - every other building that stands before the
  // line of its back wall (the houses across the court and on its other sides; where two neighbourhoods meet, the other's
  // standing in its court), nearest first; never a back range (its ground stops a yard, it claims none). Its own side's
  // stand behind that line, parted from it at the party walls. All within twice the reach of the door (whatever is nearer
  // a point of the yard than its own wall), from the cells about it; and every well's roof there.
  const far = 2 * reach + side,
    rivals = [],
    roofs = [],
    seen = new Set([p]);
  for (let r = Math.floor((at[1] - far) / B + HALF); r <= Math.floor((at[1] + far) / B + HALF); r++) {
    for (let c = Math.floor((at[0] - far) / B + HALF); c <= Math.floor((at[0] + far) / B + HALF); c++) {
      const L = fabricCell(r, c);
      for (const q of L.near) {
        if (seen.has(q)) continue;
        seen.add(q);
        if (q.back || !q.q.some((v) => (v[0] - A[0]) * n[0] + (v[1] - A[1]) * n[1] > BACKYARD.front)) continue;
        const xs = q.q.map((v) => v[0]),
          zs = q.q.map((v) => v[1]),
          box = [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
        const d = Math.hypot(Math.max(box[0] - at[0], 0, at[0] - box[2]), Math.max(box[1] - at[1], 0, at[1] - box[3]));
        if (d <= far) rivals.push({ q: q.q, box, d });
      }
      for (const w of L.ground.wells) if (!roofs.some((o) => o[0] === w[0] && o[1] === w[1])) roofs.push(w);
    }
  }
  rivals.sort((a, b) => a.d - b.d);
  /** Whether the point `u` along the wall and `v` out from it is its own open court, within reach of its door. */
  const open = (u, v) => {
    const x = A[0] + t[0] * u + n[0] * v,
      z = A[1] + t[1] * u + n[1] * v,
      mine = v + side;
    if (!(Math.hypot(x - at[0], z - at[1]) <= reach)) return false;
    if (roofs.some((w) => Math.abs(x - w[0]) < WELL_ROOF[0] && Math.abs(z - w[1]) < WELL_ROOF[1])) return false;
    for (const o of rivals) {
      const b = o.box;
      if (
        Math.hypot(Math.max(b[0] - x, 0, x - b[2]), Math.max(b[1] - z, 0, z - b[3])) < mine &&
        gapTo(o.q, x, z) < mine
      )
        return false;
    }
    return fabricGroundAt(x, z) === GROUND.court;
  };
  // its depth a step along the wall and at its far end: to the first thing standing in it (and the door farther at every
  // step out from the back wall)
  const cols = Math.ceil((len - 2 * side) / step) + 1,
    us = [],
    depth = [];
  for (let m = 0; m < cols; m++) {
    const u = Math.min(side + m * step, len - side);
    let last = 0;
    for (let v = back; open(u, v); v += step) last = v;
    us.push(u);
    depth.push(last);
  }
  // the biggest rectangle over the columns: between two the shallower holds (an oblique wall's depth runs straight)
  let best = null,
    area = 0;
  for (let i = 0; i < cols; i++) {
    let d = Infinity;
    for (let j = i; j < cols; j++) {
      d = Math.min(d, depth[j]);
      const w = us[j] - us[i],
        a = w * (d - back);
      if (w >= min && d - back >= min && a > area) {
        area = a;
        best = [us[i], us[j], d];
      }
    }
  }
  if (!best) return null;
  // the survey read the ground at its points; what stands between them reaches in across an edge alone (nothing standing
  // in a court is narrower than a step - a garden wall's ground is a metre across), so each edge is walked BACKYARD.walk
  // apart and drawn in half a step where it meets anything
  let [u0, u1, v1] = best,
    v0 = back;
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
  const turn = Math.atan2(-t[1], t[0]),
    cs = Math.cos(turn),
    sn = Math.sin(turn);
  const corners = [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ].map(([u, v]) => {
    const x = A[0] + t[0] * u + n[0] * v - at[0],
      z = at[1] - (A[1] + t[1] * u + n[1] * v);
    return [x * cs + z * sn, z * cs - x * sn];
  });
  const xs = corners.map((c) => c[0]),
    zs = corners.map((c) => c[1]);
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
  if (_yards.has(key)) {
    const y = _yards.get(key);
    _yards.delete(key);
    _yards.set(key, y);
    return y;
  }
  const cell = imperialBlockOf(name);
  const b =
    cell?.kind === 'own' && Number.isInteger(recordIndex)
      ? (fabricCellBuildings(cell.r, cell.c)[recordIndex] ?? null)
      : null;
  const y = b ? Object.freeze(fabricBackyard(b, fabricRecordOrigin(cell.r, cell.c, b))) : null;
  _yards.set(key, y);
  if (_yards.size > KEEP) _yards.delete(_yards.keys().next().value);
  return y;
}
