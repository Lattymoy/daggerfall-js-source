// @ts-check
// ARENA5 (2026-10-03): THE HALL OF CHAMPIONS' PLAQUE WALL. Arena.md "1. The building", the undercroft: "it holds ... the
// Hall of Champions - a plaque wall naming every Grand Champion this save (offline) or this realm (online)". ARENA-FIX 4
// stood the Keeper of the Hall and her trophies and let her READ the names (systems/arenaLadder.js hallOfChampions; online
// scenes/arenaGate.js hall); no wall was drawn. This is the wall:
//
// - WHERE. Measured, not written down (systems/crownHall.js crownHallPlan's law): about the Keeper's place
//   (world/arenaUndercroft.js undercroftPopulation `hall`), the nearest wall round her at a plaque's height, looked for
//   eight ways in the dungeon's own collider; along it a row of plaques a pace apart, centred on her, each where that
//   same wall still stands behind it and nothing stands between her and it - so a plaque never hangs in a doorway or
//   round a corner. A hall where no wall stands near her hangs none (said nowhere: the Keeper still reads the names).
// - WHAT. Daggerfall's own pictures on a board the port builds (customModels.js registerCustomModel - the town
//   paintings' law, world/townStandIns.js paintingModel): a board of the dark wood Daggerfall's framed paintings are
//   backed with (TEXTURE.000 record 46, the frame's back), and on a champion's plaque one of Daggerfall's own framed
//   pictures (TEXTURE.048 record 3, the Interior_Paintings set - the likeness the Hall hangs of its champion) set into
//   it. A plaque with no name cut in it yet is the bare board. Daggerfall has no plaque flat or model of its own; a framed
//   picture on dark wood is what its castles hang on a wall to honour someone.
// - WHO. One plaque a Grand Champion, the newest first, up to PLAQUE_MAX (systems/arenaBoard.js hallPlaques - this
//   save's offline, the realm's online), the rest of the row bare; each plaque's press reads its champion (name, banner,
//   season, "Grand Champion" - ARENA_TEXT.undercroft.plaqueLine), a bare one the Keeper's "No name is cut here yet".
//
// Pure (the collider's ray handed in), but the registration. Not a DFU member (Daggerfall has no arena). Ledger A (ARENA).

import { registerCustomModel } from './customModels.js';

/** The plaques' model ids (beside the colosseum's 864102): a champion's, and the bare board. */
export const PLAQUE_MODEL = 864110;
export const PLAQUE_BARE_MODEL = 864111;
/** At most this many plaques hang in a row (the wall's cap - the Keeper reads every name). */
export const PLAQUE_MAX = 10;
/** Every length here, metres: the board (width, height, depth), the picture set into it, the gap between two plaques'
 *  middles, the height of a plaque's middle over the floor, how far round the Keeper a wall is looked for, how far off
 *  the wall a plaque's back hangs, and how far the wall behind a plaque may stand from the row's own line. */
export const PLAQUE_W = 0.8;
export const PLAQUE_H = 0.62;
export const PLAQUE_D = 0.05;
export const PLAQUE_PICTURE = Object.freeze({ archive: 48, record: 3, w: 0.66, h: 0.48 });
export const PLAQUE_GAP_M = 1;
export const PLAQUE_UP_M = 1.65;
export const PLAQUE_LOOK_M = 7;
export const PLAQUE_OFF_M = 0.02;
export const PLAQUE_FLAT_M = 0.2;
/** The board's wood: the back of Daggerfall's framed paintings (world/townStandIns.js FRAME_BACK, #423629). */
export const PLAQUE_WOOD = Object.freeze([0, 46]);
/** Eight ways round, the first the dungeon's +z (crownHall.js's). */
const WAYS = Object.freeze(Array.from({ length: 8 }, (_, i) => Object.freeze([Math.sin((i * Math.PI) / 4), Math.cos((i * Math.PI) / 4)])));

/** A board facing +Z, its back's middle at the origin; `picture` set into its face, or the bare wood. dfMeshToModel's
 *  shape (metres, uv over the named classic textures, v down from 0). Pure. */
export function plaqueModel(picture = true) {
  /** @type {Map<string, { archive: number, record: number, p: number[], n: number[], uv: number[], i: number[] }>} */
  const groups = new Map();
  const quad = (tex, pts, n, uv = [[0, 0], [1, 0], [1, -1], [0, -1]]) => {
    const key = `${tex[0]}_${tex[1]}`;
    if (!groups.has(key)) groups.set(key, { archive: tex[0], record: tex[1], p: [], n: [], uv: [], i: [] });
    const g = /** @type {any} */ (groups.get(key));
    // wound so cross(b - a, c - a) points along the normal (the port's front face - detStandIns.js MeshBuilder's)
    const [a, b, c] = pts;
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const order = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0 ? [0, 3, 2, 0, 2, 1] : [0, 1, 2, 0, 2, 3];
    const base = g.p.length / 3;
    for (let k = 0; k < 4; k++) { g.p.push(...pts[k]); g.n.push(...n); g.uv.push(...uv[k]); }
    for (const k of order) g.i.push(base + k);
  };
  const W = PLAQUE_W / 2, H = PLAQUE_H / 2, D = PLAQUE_D;
  // the board: its face (bare, or framing the picture), its four edges, its back
  const face = [[W, H, D], [-W, H, D], [-W, -H, D], [W, -H, D]];
  const back = face.map(([x, y]) => [x, y, 0]);
  if (picture) {
    const pw = PLAQUE_PICTURE.w / 2, ph = PLAQUE_PICTURE.h / 2, z = D + 0.008;   // proud of the wood by a hair, so the two never fight for the depth
    quad([PLAQUE_PICTURE.archive, PLAQUE_PICTURE.record], [[pw, ph, z], [-pw, ph, z], [-pw, -ph, z], [pw, -ph, z]], [0, 0, 1]);
  }
  quad(PLAQUE_WOOD, face, [0, 0, 1]);
  for (let k = 0; k < 4; k++) {
    const a = face[k], b = face[(k + 1) % 4], c = back[(k + 1) % 4], d = back[k];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, l = Math.hypot(mx, my) || 1;
    quad(PLAQUE_WOOD, [a, b, c, d], [mx / l, my / l, 0]);
  }
  quad(PLAQUE_WOOD, [back[3], back[2], back[1], back[0]], [0, 0, -1]);
  let nv = 0, ni = 0;
  for (const g of groups.values()) { nv += g.p.length / 3; ni += g.i.length; }
  const positions = new Float32Array(nv * 3), normals = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2), indices = new Uint32Array(ni);
  const subMeshes = [];
  let v = 0, i = 0;
  for (const g of groups.values()) {
    positions.set(g.p, v * 3); normals.set(g.n, v * 3); uvs.set(g.uv, v * 2);
    for (let k = 0; k < g.i.length; k++) indices[i + k] = g.i[k] + v;
    subMeshes.push({ textureArchive: g.archive, textureRecord: g.record, startIndex: i, primitiveCount: g.i.length / 3 });
    v += g.p.length / 3; i += g.i.length;
  }
  return { positions, normals, uvs, indices, subMeshes, doors: [] };
}

let _registered = false;
/** Once: the two plaques on the model door (world/arenaCity.js installArena), behind no switch - the arena is the city. */
export function registerArenaPlaques() {
  if (_registered) return;
  _registered = true;
  registerCustomModel(PLAQUE_MODEL, () => plaqueModel(true));
  registerCustomModel(PLAQUE_BARE_MODEL, () => plaqueModel(false));
}
/** Test seam. */
export const _resetArenaPlaques = () => { _registered = false; };

/**
 * THE ROW OF PLAQUES about the Keeper at `at` (`[x, y, z]`, the dungeon's frame - her marker's place, anywhere on her
 * body): `{ floor, wall, plaques: [{ pos, yawDeg, k }] }`, or null where no floor stands under her or no wall near her.
 * `wall` the way to it (`[x, z]`); each plaque's `pos` its back's middle, `yawDeg` its turn (its face out of the wall),
 * `k` its place in the reading order - left to right as one faces the wall, the first a champion's. `ray(origin, dir,
 * max)` the collider's: the distance to the first surface, or Infinity. Pure.
 * @param {number[]|null} at
 * @param {(o: number[], d: number[], max: number) => number} ray
 * @param {{ max?: number }} [o]
 */
export function hallPlaquePlan(at, ray, { max = PLAQUE_MAX } = {}) {
  if (!Array.isArray(at) || !at.slice(0, 3).every(Number.isFinite) || typeof ray !== 'function') return null;
  const drop = ray([at[0], at[1] + 0.5, at[2]], [0, -1, 0], 8);
  if (!Number.isFinite(drop)) return null;
  const floor = at[1] + 0.5 - drop;
  const y = floor + PLAQUE_UP_M;
  // the wall: the nearest surface round her at a plaque's height (the first of the eight on a tie)
  let way = null, dist = Infinity;
  for (const w of WAYS) {
    const d = ray([at[0], y, at[2]], [w[0], 0, w[1]], PLAQUE_LOOK_M);
    if (Number.isFinite(d) && d < dist - 1e-6) { dist = d; way = w; }
  }
  if (!way) return null;
  // along it, the viewer's right as they face the wall (+z ahead has +x on the right - the port's frame)
  const right = [way[1], -way[0]];
  const yawDeg = (Math.atan2(-way[0], -way[1]) * 180) / Math.PI;   // the face, out of the wall
  const spots = [];
  const n = Math.max(0, Math.floor(max));
  // tried out from her middle - 0, +1, -1, +2, -2 ... - so a short wall keeps the row round her
  for (let t = 0; spots.length < n && t < n * 2 + 1; t++) {
    const s = (t % 2 ? 1 : -1) * Math.ceil(t / 2) * PLAQUE_GAP_M;
    const lat = Math.abs(s), dir = [right[0] * Math.sign(s || 1), right[1] * Math.sign(s || 1)];
    if (lat > 0) { const clear = ray([at[0], y, at[2]], [dir[0], 0, dir[1]], lat + PLAQUE_W / 2); if (Number.isFinite(clear) && clear < lat + PLAQUE_W / 2) continue; }
    const x0 = at[0] + right[0] * s, z0 = at[2] + right[1] * s;
    const d = ray([x0, y, z0], [way[0], 0, way[1]], dist + PLAQUE_FLAT_M + 0.5);
    if (!Number.isFinite(d) || Math.abs(d - dist) > PLAQUE_FLAT_M) continue;   // the wall is not this one here (a door, a corner)
    const back = d - PLAQUE_OFF_M;
    spots.push({ s, pos: [x0 + way[0] * back, y, z0 + way[1] * back] });
  }
  spots.sort((a, b) => a.s - b.s);
  return { floor, wall: [way[0], way[1]], plaques: spots.map((p, k) => ({ pos: p.pos, yawDeg, k })) };
}
