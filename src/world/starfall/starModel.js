// @ts-check
// STAR4 (2026-10-20): THE FALLEN STAR, MADE - its crater and its stone, in code, on the gate's own faces
// (world/gate/gateModel.js faces) and under the star's own art (world/starfall/starArt.js). Design:
// bible/11-Multiplayer/Starfall.md section 3.
//
// A CRATER THE LAND KEEPS. The land's own triangles are never cut (a pixel's terrain is every client's same mesh, and
// the port has no hole in it), so the crater is made ON the ground as a burned one reads from a stride away: a scorched
// floor laid on the land's own heights (the rite's sigil's drape - each point the highest ground about it, a hand's
// breadth over), a rim of thrown earth rising round it to a crest and falling away outside, stones thrown onto the rim,
// and at its heart the star: a jagged stone of pale glass, half buried, its shards leaning out of the earth, with the
// coven's black thread wound about it and running straight up into the dark. Held, the thread is gone and the glass
// gold; lost, the glass dark (the host builds it again with the record it wears).
//
// THE STAR'S OWN FRAME: x east and z north from its heart, y up from the ground there - the host stands it at the heart
// unturned. Every shape is the star's own (its rolls, net/starfall/starfallLaw.js starRoll): every screen makes the same
// crater for the same star. Pure.
//
// Not a DFU member. Ledger A (STARFALL).
import { faces } from '../gate/gateModel.js';
import { STAR_ARCHIVE, STAR_EARTH_RECORD, STAR_RIM_RECORD, STAR_GLASS_RECORD, STAR_THREAD_RECORD } from './starArt.js';
import { starRoll } from '../../net/starfall/starfallLaw.js';

/** The crater: its radius to the rim's crest (fourteen metres across), and how far out the rim's thrown earth falls. */
export const STAR_CRATER_R = 7;
export const STAR_RIM_OUT = 2.6;
/** The rim's crest over the ground, and the floor's lift over the land (no fighting its depth). */
export const STAR_RIM_H = 1.1;
export const STAR_FLOOR_LIFT = 0.05;
/** The floor's drape: its rings and segments, and how far about a point the highest ground is read (the rite's law). */
export const STAR_FLOOR_RINGS = 10;
export const STAR_FLOOR_SEGS = 40;
export const STAR_FLOOR_REACH = 0.5;
/** The stone: its tallest shard stands this high out of the earth, and goes this deep into it. */
export const STAR_STONE_H = 2.5;
export const STAR_STONE_SINK = 0.9;
/** The shards round the heart's: how many, and how far out they lean from. */
export const STAR_SHARDS = 6;
export const STAR_SHARD_R = 0.9;
/** The stones thrown onto the rim. */
export const STAR_RIM_STONES = 9;
/** The thread: how many strands, how many turns each takes about the stone, how far up into the dark it runs, and how
 *  thick it is (a cord: a hand could close round it). */
export const STAR_THREADS = 3;
export const STAR_THREAD_TURNS = 1.5;
export const STAR_THREAD_H = 90;
export const STAR_THREAD_W = 0.05;
/** The grass none grows on: the crater and its rim. */
export const STAR_BARE_R = STAR_CRATER_R + STAR_RIM_OUT;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** A triangle wound so its face looks away from `centre` (a shard's, a stone's own middle). */
function outward(f, rec, a, b, c, centre, ua = [0, 0], ub = [1, 0], uc = [0.5, 1]) {
  const mid = [(a[0] + b[0] + c[0]) / 3 - centre[0], (a[1] + b[1] + c[1]) / 3 - centre[1], (a[2] + b[2] + c[2]) / 3 - centre[2]];
  if (dot(cross(sub(b, a), sub(c, a)), mid) >= 0) f.tri(rec, a, b, c, ua, ub, uc);
  else f.tri(rec, a, c, b, ua, uc, ub);
}
/** The star's roll `j` in [0, 1). */
const u = (n, k, j) => starRoll(n, k, 900 + j) / 4294967296;

/**
 * WHERE ITS PARTS STAND, in the star's frame: the shards `{ base: [x, z], lean: [dx, dz], h, w, sides }` (the heart's
 * first, upright and tallest), the rim's stones `{ x, z, s }` and the thread's strands `{ a0 }` (the bearing each starts
 * its turns from). Pure: the star's own rolls.
 * @param {number} n the night @param {number} k the star
 */
export function starLayout(n, k) {
  const shards = [{ base: [0, 0], lean: [0, 0], h: STAR_STONE_H, w: 0.55, sides: 6 }];
  for (let i = 1; i < STAR_SHARDS; i++) {
    const a = ((i - 1) / (STAR_SHARDS - 1)) * 2 * Math.PI + u(n, k, i) * 0.8;
    const r = STAR_SHARD_R * (0.7 + 0.5 * u(n, k, 10 + i));
    const lean = 0.35 + 0.45 * u(n, k, 20 + i);
    shards.push({ base: [Math.sin(a) * r, Math.cos(a) * r], lean: [Math.sin(a) * lean, Math.cos(a) * lean], h: STAR_STONE_H * (0.35 + 0.35 * u(n, k, 30 + i)), w: 0.22 + 0.18 * u(n, k, 40 + i), sides: 5 });
  }
  const stones = [];
  for (let i = 0; i < STAR_RIM_STONES; i++) {
    const a = (i / STAR_RIM_STONES) * 2 * Math.PI + u(n, k, 50 + i) * 0.5;
    const r = STAR_CRATER_R + (u(n, k, 60 + i) - 0.3) * STAR_RIM_OUT;
    stones.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, s: 0.3 + 0.45 * u(n, k, 70 + i) });
  }
  const threads = Array.from({ length: STAR_THREADS }, (_, i) => ({ a0: (i / STAR_THREADS) * 2 * Math.PI + u(n, k, 80 + i) }));
  return { shards, stones, threads };
}

/** The rim's height over the ground at `r` from the heart: none inside its foot, up to its crest at the crater's edge,
 *  down again outside. */
export function rimAt(r) {
  const foot = STAR_CRATER_R * 0.55, out = STAR_CRATER_R + STAR_RIM_OUT;
  if (r <= foot || r >= out) return 0;
  if (r <= STAR_CRATER_R) { const t = (r - foot) / (STAR_CRATER_R - foot); return STAR_RIM_H * t * t * (3 - 2 * t); }
  const t = (out - r) / STAR_RIM_OUT;
  return STAR_RIM_H * t * t;
}

/**
 * THE STAR'S MODEL: renderer.createMesh's shape, in the star's frame. `heightAt(x, z)` is the ground over the heart's at
 * a point of the frame (0 where nothing answers). `parts`: `ground` the floor, the rim and its stones; `stone` the shards;
 * `thread` the coven's thread (gone once the star is held); `glass` the record the shards wear (starArt.js: the glass,
 * held gold, lost dark). Sub-meshes by the star's archive's records.
 * @param {number} n @param {number} k
 * @param {(x: number, z: number) => number} [heightAt]
 * @param {{ ground?: boolean, stone?: boolean, thread?: boolean, glass?: number }} [parts]
 */
export function buildStarModel(n, k, heightAt = () => 0, { ground = true, stone = true, thread = true, glass = STAR_GLASS_RECORD } = {}) {
  const h = (x, z) => { const v = heightAt(x, z); return Number.isFinite(v) ? v : 0; };
  const f = faces();
  const L = starLayout(n, k);
  if (ground) {
    // THE FLOOR AND THE RIM, one drape: rings out from the heart to the rim's outer foot, each point on the highest ground
    // about it, the rim's earth over it - the burned earth's art inside the crest, the thrown earth's past it
    const K = STAR_FLOOR_REACH, D = K * Math.SQRT1_2, OUT = STAR_CRATER_R + STAR_RIM_OUT;
    const ride = (x, z) => Math.max(h(x, z), h(x + K, z), h(x - K, z), h(x, z + K), h(x, z - K), h(x + D, z + D), h(x - D, z + D), h(x + D, z - D), h(x - D, z - D));
    const RINGS = STAR_FLOOR_RINGS + 6, SEGS = STAR_FLOOR_SEGS;
    const radius = (ri) => (ri <= STAR_FLOOR_RINGS ? (ri / STAR_FLOOR_RINGS) * STAR_CRATER_R : STAR_CRATER_R + ((ri - STAR_FLOOR_RINGS) / (RINGS - STAR_FLOOR_RINGS)) * STAR_RIM_OUT);
    const grid = [];
    for (let ri = 0; ri <= RINGS; ri++) {
      const row = [], r = Math.min(OUT, radius(ri));
      for (let si = 0; si <= SEGS; si++) {
        const a = (si / SEGS) * 2 * Math.PI, x = Math.sin(a) * r, z = Math.cos(a) * r;
        row.push({ p: [x, ride(x, z) + STAR_FLOOR_LIFT + rimAt(r), z], uv: [x / 4, z / 4] });
      }
      grid.push(row);
    }
    for (let ri = 0; ri < RINGS; ri++) {
      const rec = radius(ri + 1) <= STAR_CRATER_R * 0.8 ? STAR_EARTH_RECORD : STAR_RIM_RECORD;
      for (let si = 0; si < SEGS; si++) {
        const a = grid[ri][si], b = grid[ri][si + 1], c = grid[ri + 1][si + 1], d = grid[ri + 1][si];
        if (ri === 0) f.tri(rec, a.p, d.p, c.p, a.uv, d.uv, c.uv);
        else f.quad(rec, a.p, d.p, c.p, b.p, a.uv, d.uv, c.uv, b.uv);
      }
    }
    // the stones on the rim: low lumps of the thrown earth's stone, sunk into it - AUDIT STARFALL R6: sunk from the
    // LOWEST of the earth under their base's corners, so a stone on the rim's outer slope never hangs over its foot; its
    // crown over the earth at its middle, as it stood
    for (const s of L.stones) {
      const earth = (x, z) => h(x, z) + rimAt(Math.hypot(x, z));
      const base = Array.from({ length: 5 }, (_, j) => { const a = (j / 5) * 2 * Math.PI + s.s; return [s.x + Math.sin(a) * s.s, s.z + Math.cos(a) * s.s]; });
      const y0 = Math.min(...base.map(([x, z]) => earth(x, z))) - s.s * 0.4;
      const top = [s.x, earth(s.x, s.z) + s.s * 0.7, s.z], c = [s.x, (y0 + top[1]) / 2, s.z];
      const ring = base.map(([x, z]) => [x, y0, z]);
      for (let j = 0; j < 5; j++) outward(f, STAR_RIM_RECORD, ring[j], ring[(j + 1) % 5], top, c);
    }
  }
  if (stone) {
    // THE SHARDS: each a jagged column of the glass from under the earth to its tip, waisted two-thirds up (a break in
    // the crystal), leaning out from the heart
    for (const s of L.shards) {
      const bx = s.base[0], bz = s.base[1], gy = h(bx, bz);
      const bottom = gy - STAR_STONE_SINK, waist = gy + s.h * 0.62, tipY = gy + s.h;
      const at = (t) => [bx + s.lean[0] * t, bz + s.lean[1] * t];
      const ring = (y, t, w, twist) => Array.from({ length: s.sides }, (_, j) => { const a = (j / s.sides) * 2 * Math.PI + twist, [cx, cz] = at(t); return [cx + Math.sin(a) * w, y, cz + Math.cos(a) * w]; });
      const lo = ring(bottom, 0, s.w, 0), mid = ring(waist, 0.62, s.w * 0.78, 0.4);
      const [tx, tz] = at(1), tip = [tx, tipY, tz], centre = [(bx + tx) / 2, (bottom + tipY) / 2, (bz + tz) / 2];
      for (let j = 0; j < s.sides; j++) {
        const j1 = (j + 1) % s.sides, v0 = j / s.sides, v1 = (j + 1) / s.sides;
        outward(f, glass, lo[j], lo[j1], mid[j1], centre, [v0, 0], [v1, 0], [v1, 0.62]);
        outward(f, glass, lo[j], mid[j1], mid[j], centre, [v0, 0], [v1, 0.62], [v0, 0.62]);
        outward(f, glass, mid[j], mid[j1], tip, centre, [v0, 0.62], [v1, 0.62], [(v0 + v1) / 2, 1]);
      }
    }
  }
  if (thread) {
    // THE THREAD: each strand a thin three-sided cord - turns about the stone, climbing it, then straight up into the dark
    const W = STAR_THREAD_W, gy = h(0, 0), STEPS = 24, R0 = 0.75;
    for (const t of L.threads) {
      const pts = [];
      for (let i = 0; i <= STEPS; i++) {
        const q = i / STEPS, a = t.a0 + q * STAR_THREAD_TURNS * 2 * Math.PI, r = R0 * (1 - 0.6 * q);
        pts.push([Math.sin(a) * r, gy + 0.2 + q * STAR_STONE_H * 0.95, Math.cos(a) * r]);
      }
      const last = pts[pts.length - 1];
      pts.push([last[0] * 0.5, gy + STAR_STONE_H + 6, last[2] * 0.5], [0, gy + STAR_THREAD_H, 0]);
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1];
        const cord = (p) => [0, 1, 2].map((j) => { const ang = (j / 3) * 2 * Math.PI; return [p[0] + Math.sin(ang) * W, p[1], p[2] + Math.cos(ang) * W]; });
        const ca = cord(a), cb = cord(b), centre = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
        for (let j = 0; j < 3; j++) {
          const j1 = (j + 1) % 3;
          outward(f, STAR_THREAD_RECORD, ca[j], ca[j1], cb[j1], centre, [0, 0], [1, 0], [1, 1]);
          outward(f, STAR_THREAD_RECORD, ca[j], cb[j1], cb[j], centre, [0, 0], [1, 1], [0, 1]);
        }
      }
    }
  }
  // assembled as the gate's own (gateModel.js buildGateModel) - the indices 32-bit (a Uint16Array under it drew nothing)
  const recs = [...f.byRec.keys()].sort((a, b) => a - b);
  const count = recs.reduce((m, r) => m + f.byRec.get(r).p.length / 3, 0);
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), uvs = new Float32Array(count * 2);
  const indices = new Uint32Array(count);
  const subMeshes = [];
  let v = 0;
  for (const rec of recs) {
    const g = f.byRec.get(rec), m = g.p.length / 3;
    positions.set(g.p, v * 3); normals.set(g.n, v * 3); uvs.set(g.uv, v * 2);
    for (let i = 0; i < m; i++) indices[v + i] = v + i;
    subMeshes.push({ textureArchive: STAR_ARCHIVE, textureRecord: rec, startIndex: v, primitiveCount: m / 3 });
    v += m;
  }
  return { positions, normals, uvs, indices, subMeshes };
}
