// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Battle-Pass.md section 6): A BRASS FISSURE, MADE on the gate's faces under its
// own art, as the fallen star's crater (world/starfall/starModel.js). The land keeps its triangles: the scorch and the
// crack lie draped ON the ground, and the quake reads in what stands on it - slabs heaved up along both lips, and the
// wreckage round it (cogs on their edges, a split pipe, a fallen pillar). Its own frame: x along the crack, z across, y up
// from the heart - the host turns it by its yaw. Every shape is its own rolls (seasonWorld.js fissureRoll): every screen
// makes the same. Pure. Not a DFU member. Ledger A (STOREFRONT).
import { faces } from './gate/gateModel.js';
import { FISSURE_ARCHIVE, FISSURE_REC as REC } from './fissureArt.js';
import { fissureRoll } from '../systems/pass/seasonWorld.js';

/** The crack: its length, its widest, and how far it wanders either side of its axis. */
export const FISSURE_LEN = 13;
export const FISSURE_WIDE = 1.2;
export const FISSURE_WANDER = 0.9;
/** The scorched ground about it: its half-length and half-width (an irregular oval), and the drape's lift. */
export const FISSURE_SCORCH = Object.freeze([9, 6]);
export const FISSURE_LIFT = 0.04;
/** The heaved slabs along the lips, and the wreckage's pieces. */
export const FISSURE_SLABS = 8;
export const FISSURE_COGS = 3;
/** The grass none grows on, metres from the heart. */
export const FISSURE_BARE_R = FISSURE_SCORCH[0] + 1;
/** The wreckage's measures, the model's and its footprints' (fissureSolids): a cog's teeth past its radius and its
 *  thickness; the pipe's radius and its two lengths' ends along its axis; the pillar's shaft, and its capital's end and
 *  half-width. */
const COG_TIP = 1.12, COG_THICK = 0.18;
const PIPE = Object.freeze({ r: 0.32, x0: -2.4, x1: 2.0 });
const PILLAR = Object.freeze({ r: 0.45, x0: -2.2, x1: 2.0, capX: 2.75, capR: 0.62 });
/** AUDIT-STOREFRONT II (lane D 4): how far a body stands clear of a solid piece, metres - a construct (its 0.35 m and a
 *  hand) and the Colossus (half again its size) - and the step its stands are sought by. */
export const FISSURE_STAND_CLEAR = Object.freeze({ foe: 0.6, colossus: 1.0 });
const STAND_STEP = 0.25;
/** The drape's reach (the crater's: each point the highest ground about it). */
const REACH = 0.5;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** A triangle wound so its face looks away from `centre`. */
function outward(f, rec, a, b, c, centre, ua = [0, 0], ub = [1, 0], uc = [0.5, 1]) {
  const mid = [(a[0] + b[0] + c[0]) / 3 - centre[0], (a[1] + b[1] + c[1]) / 3 - centre[1], (a[2] + b[2] + c[2]) / 3 - centre[2]];
  if (dot(cross(sub(b, a), sub(c, a)), mid) >= 0) f.tri(rec, a, b, c, ua, ub, uc);
  else f.tri(rec, a, c, b, ua, uc, ub);
}
/** A triangle wound to face up (a drape's). */
function upward(f, rec, a, b, c, ua, ub, uc) {
  if (cross(sub(b, a), sub(c, a))[1] >= 0) f.tri(rec, a, b, c, ua, ub, uc);
  else f.tri(rec, a, c, b, ua, uc, ub);
}
/** A point turned about y by `a` (radians) and moved to (x, z). */
const turn = (p, a, x, z) => [x + p[0] * Math.cos(a) - p[2] * Math.sin(a), p[1], z + p[0] * Math.sin(a) + p[2] * Math.cos(a)];

/**
 * WHERE ITS PARTS STAND, in the fissure's frame: the crack's spine `{ x, z, w }` (its middle and its width at each step),
 * its branches (spines of their own), the slabs `{ x, z, len, wid, lift, side, a }`, the cogs `{ x, z, r, a, lean }`, the
 * pipe `{ x, z, a, gap }` and the pillar `{ x, z, a }`. Pure: the fissure's own rolls.
 * @param {{ n: number, stage: number, area: number, k: number }} f
 */
export function fissureLayout(f) {
  const u = (j) => fissureRoll(f.n, f.stage, f.area, f.k, 500 + j) / 4294967296;
  const STEPS = 26;
  const spine = [];
  const ph = u(0) * 6.28, ph2 = u(1) * 6.28;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS, x = (t - 0.5) * FISSURE_LEN;
    const z = FISSURE_WANDER * (0.6 * Math.sin(t * 5.1 + ph) + 0.4 * Math.sin(t * 11.3 + ph2));
    const w = FISSURE_WIDE * Math.pow(Math.sin(Math.PI * t), 0.6) * (0.7 + 0.3 * u(10 + i));
    spine.push({ x, z, w });
  }
  const branches = [];
  for (let b = 0; b < 3; b++) {
    const at = spine[6 + Math.floor(u(40 + b) * 14)], side = u(43 + b) < 0.5 ? -1 : 1, a = side * (0.5 + 0.6 * u(46 + b)), len = 2 + 1.6 * u(49 + b);
    const pts = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6, jag = i > 0 && i < 6 ? (u(52 + b * 7 + i) - 0.5) * 0.5 : 0; pts.push({ x: at.x + Math.sin(a) * len * t * 0.5 + jag, z: at.z + side * len * t, w: 0.35 * (1 - t) + 0.02 }); }
    branches.push(pts);
  }
  const slabs = [];
  for (let i = 0; i < FISSURE_SLABS; i++) {
    const side = i % 2 ? 1 : -1, t = 0.12 + 0.76 * ((Math.floor(i / 2) + 0.5 * u(60 + i)) / (FISSURE_SLABS / 2));
    const s = spine[Math.round(t * STEPS)], wid = 0.9 + 0.5 * u(70 + i);
    slabs.push({ x: s.x, z: s.z + side * (s.w / 2 + wid / 2 + 0.05), len: 1.6 + 1.0 * u(80 + i), wid, lift: 0.35 + 0.45 * u(90 + i), side, a: (u(100 + i) - 0.5) * 0.5 });
  }
  // the wreckage each in a sector of its own about the heart (an oval, the crack's way longer), never on the crack nor on
  // another piece: a cog past each end of the crack and one off its south lip, the pipe beside that, the pillar to the north
  const at = (j, mid, spread, r0, r1) => { const a = mid + (u(j) - 0.5) * 2 * spread, r = r0 + (r1 - r0) * u(j + 1); return [Math.cos(a) * r * 1.25, Math.sin(a) * r]; };
  const SECTOR = Object.freeze({ cogs: [[0, 0.2], [Math.PI, 0.2], [-Math.PI / 2 + 0.75, 0.22]], pipe: [-Math.PI / 2 - 0.75, 0.22], pillar: [Math.PI / 2, 0.35] });
  const cogs = [];
  for (let i = 0; i < FISSURE_COGS; i++) { const [mid, spread] = SECTOR.cogs[i], [x, z] = at(120 + i * 2, mid, spread, 6, 7.5); cogs.push({ x, z, r: 0.5 + 0.6 * u(130 + i), a: u(135 + i) * 6.28, lean: (u(140 + i) - 0.5) * 0.7 }); }
  const [px, pz] = at(150, ...SECTOR.pipe, 5, 6.5), [qx, qz] = at(160, ...SECTOR.pillar, 5, 6.5);
  // the pipe and the pillar lie roughly along the crack (within a third of a right angle), so neither reaches into it
  return { spine, branches, slabs, cogs, pipe: { x: px, z: pz, a: (u(152) - 0.5) * 1.0, gap: 0.5 + 0.4 * u(153) }, pillar: { x: qx, z: qz, a: (u(162) - 0.5) * 1.0 } };
}
/** Where its steam rises - three vents along the crack, in the fissure's frame `[x, z]`. */
export function fissureVents(/** @type {{ n: number, stage: number, area: number, k: number }} */ f) {
  const { spine } = fissureLayout(f);
  return [0.3, 0.55, 0.8].map((t) => { const s = spine[Math.round(t * (spine.length - 1))]; return [s.x, s.z]; });
}

/**
 * AUDIT-STOREFRONT II (lane D 4): THE SOLID PIECES' FOOTPRINTS in the fissure's frame, each holding every face the solid
 * model stands there: a box `{ x, z, a, hx, hz }` (a slab, a cog on its edge - half-extents along its own x and z, turned
 * by `a` as `turn` turns) or a rod `{ x0, z0, x1, z1, r }` (the pipe, the pillar with its capital). Pure.
 * @param {ReturnType<typeof fissureLayout>} L
 */
export function fissureSolids(L) {
  const boxes = L.slabs.map((s) => ({ x: s.x, z: s.z, a: s.a, hx: s.len / 2, hz: s.wid / 2 }));
  for (const g of L.cogs) boxes.push({ x: g.x, z: g.z, a: g.a, hx: COG_THICK / 2 + g.r * COG_TIP * Math.abs(Math.sin(g.lean)), hz: g.r * COG_TIP });
  const rod = (o, x0, x1, r) => { const p = turn([x0, 0, 0], o.a, o.x, o.z), q = turn([x1, 0, 0], o.a, o.x, o.z); return { x0: p[0], z0: p[2], x1: q[0], z1: q[2], r }; };
  return { boxes, rods: [rod(L.pipe, PIPE.x0, PIPE.x1, PIPE.r), rod(L.pillar, PILLAR.x0, PILLAR.capX, Math.max(PILLAR.r, PILLAR.capR))] };
}
/** How far the point (x, z) of the frame stands from the nearest solid footprint, metres (0 inside one). Pure. */
export function solidClearance(/** @type {ReturnType<typeof fissureSolids>} */ S, /** @type {number} */ x, /** @type {number} */ z) {
  let best = Infinity;
  for (const b of S.boxes) {
    const dx = x - b.x, dz = z - b.z, c = Math.cos(b.a), s = Math.sin(b.a);
    const u = Math.abs(dx * c + dz * s) - b.hx, v = Math.abs(-dx * s + dz * c) - b.hz;
    best = Math.min(best, Math.hypot(Math.max(u, 0), Math.max(v, 0)));
  }
  for (const r of S.rods) {
    const ex = r.x1 - r.x0, ez = r.z1 - r.z0, t = Math.max(0, Math.min(1, ((x - r.x0) * ex + (z - r.z0) * ez) / (ex * ex + ez * ez || 1)));
    best = Math.min(best, Math.max(0, Math.hypot(x - r.x0 - t * ex, z - r.z0 - t * ez) - r.r));
  }
  return best;
}
/**
 * AUDIT-STOREFRONT II (lane D 4): WHERE THE CAMP STANDS, in the fissure's frame `[x, z]` - `foes`, `n` constructs on the
 * ring's free angles (each the ring's nearest point to the heart FISSURE_STAND_CLEAR.foe clear of every solid piece and of
 * the Colossus), as far apart as those allow; `colossus`, when asked, on the crack's axis past an end, the nearest point
 * FISSURE_STAND_CLEAR.colossus clear. The host had laid its ring in the world's frame, turned twice by the yaw: one
 * construct in eleven, and half the Colossi, stood in the wreckage. Pure.
 * @param {{ n: number, stage: number, area: number, k: number }} f @param {number} n @param {{ ring?: readonly number[], colossus?: boolean }} [o]
 */
export function fissureStands(f, n, { ring = [7, 10], colossus = false } = {}) {
  const L = fissureLayout(f), S = fissureSolids(L), CLEAR = FISSURE_STAND_CLEAR;
  /** @type {number[] | null} */ let col = null;
  const ends = [L.spine[L.spine.length - 1], L.spine[0]];
  for (let d = STAND_STEP; colossus && !col && d <= ring[1] * 2; d += STAND_STEP) {
    for (const e of ends) { const x = e.x + Math.sign(e.x) * d; if (solidClearance(S, x, e.z) >= CLEAR.colossus) { col = [x, e.z]; break; } }
  }
  const free = (x, z) => solidClearance(S, x, z) >= CLEAR.foe && (!col || Math.hypot(x - col[0], z - col[1]) >= CLEAR.colossus + CLEAR.foe + 1);
  const ANGLES = 48, spots = [];
  for (let k = 0; k < ANGLES; k++) {
    const a = (k / ANGLES) * 2 * Math.PI;
    for (let r = ring[0]; r <= ring[1] + 1e-9; r += STAND_STEP) if (free(Math.cos(a) * r, Math.sin(a) * r)) { spots.push({ a, x: Math.cos(a) * r, z: Math.sin(a) * r }); break; }
  }
  const apart = (p, q) => Math.abs(Math.atan2(Math.sin(p.a - q.a), Math.cos(p.a - q.a)));
  const picked = spots.length ? [spots[0]] : [];
  while (picked.length < Math.min(n, spots.length)) {
    let best = null, bd = -1;
    for (const s of spots) { if (picked.includes(s)) continue; const d = Math.min(...picked.map((p) => apart(p, s))); if (d > bd) { bd = d; best = s; } }
    picked.push(/** @type {any} */ (best));
  }
  // a ring with no room (none found so far): the rest past its outer edge, on the angles the room left
  for (let i = picked.length; i < n; i++) { const a = (i / n) * 2 * Math.PI, r = ring[1] + 4; picked.push({ a, x: Math.cos(a) * r, z: Math.sin(a) * r }); }
  return { foes: picked.slice(0, n).map((s) => [s.x, s.z]), colossus: col };
}

/**
 * THE FISSURE'S MODEL: renderer.createMesh's shape, in its frame. `heightAt(x, z)` the ground over the heart's at a point
 * of the frame (0 where nothing answers). `parts`: `ground` the scorch and the crack (drawn pulled toward the eye, the
 * crater's floor's way), `solid` the slabs and the wreckage (the collider's too). Sub-meshes by the archive's records.
 * @param {{ n: number, stage: number, area: number, k: number }} fz
 * @param {(x: number, z: number) => number} [heightAt]
 * @param {{ ground?: boolean, solid?: boolean }} [parts]
 */
export function buildFissureModel(fz, heightAt = () => 0, { ground = true, solid = true } = {}) {
  const h = (x, z) => { const v = heightAt(x, z); return Number.isFinite(v) ? v : 0; };
  const D = REACH * Math.SQRT1_2;
  const ride = (x, z) => Math.max(h(x, z), h(x + REACH, z), h(x - REACH, z), h(x, z + REACH), h(x, z - REACH), h(x + D, z + D), h(x - D, z + D), h(x + D, z - D), h(x - D, z - D));
  const f = faces();
  const L = fissureLayout(fz);
  const u = (j) => fissureRoll(fz.n, fz.stage, fz.area, fz.k, 700 + j) / 4294967296;
  if (ground) {
    // THE SCORCH: an irregular oval in rings out from the heart, each point on the highest ground about it
    const RINGS = 7, SEGS = 36, [A, B] = FISSURE_SCORCH;
    const edge = Array.from({ length: SEGS + 1 }, (_, s) => 0.78 + 0.22 * u(s % SEGS));
    const grid = [];
    for (let ri = 0; ri <= RINGS; ri++) {
      const row = [];
      for (let si = 0; si <= SEGS; si++) {
        const a = (si / SEGS) * 2 * Math.PI, q = (ri / RINGS) * (ri === RINGS ? edge[si] : 1);
        const x = Math.cos(a) * A * q, z = Math.sin(a) * B * q;
        row.push({ p: [x, ride(x, z) + FISSURE_LIFT, z], uv: [x / 4, z / 4] });
      }
      grid.push(row);
    }
    for (let ri = 0; ri < RINGS; ri++) {
      for (let si = 0; si < SEGS; si++) {
        const a = grid[ri][si], b = grid[ri][si + 1], c = grid[ri + 1][si + 1], d = grid[ri + 1][si];
        if (ri > 0) upward(f, REC.earth, a.p, b.p, c.p, a.uv, b.uv, c.uv);
        upward(f, REC.earth, a.p, c.p, d.p, a.uv, c.uv, d.uv);
      }
    }
    // THE CRACK and its branches: a strip along each spine, a hand over the scorch, v across it
    const strip = (pts, lift) => {
      let run = 0;
      for (let i = 0; i + 1 < pts.length; i++) {
        const p = pts[i], q = pts[i + 1], dx = q.x - p.x, dz = q.z - p.z, len = Math.hypot(dx, dz) || 1, nx = -dz / len, nz = dx / len;
        const side = (s, sgn) => { const x = s.x + nx * sgn * s.w / 2, z = s.z + nz * sgn * s.w / 2; return [x, ride(x, z) + lift, z]; };
        const a = side(p, -1), b = side(p, 1), c = side(q, 1), d = side(q, -1), u0 = run / 2, u1 = (run + len) / 2;
        upward(f, REC.crack, a, b, c, [u0, 0], [u0, 1], [u1, 1]);
        upward(f, REC.crack, a, c, d, [u0, 0], [u1, 1], [u1, 0]);
        run += len;
      }
    };
    strip(L.spine, FISSURE_LIFT + 0.03);
    for (const br of L.branches) strip(br, FISSURE_LIFT + 0.02);
  }
  if (solid) {
    // THE SLABS: the earth heaved up along both lips, its crack-side edge lifted, its outer edge sunk
    for (const s of L.slabs) {
      const hw = s.wid / 2, hl = s.len / 2;
      const corner = (cx, cz) => turn([cx, 0, cz], s.a, s.x, s.z);
      const inner = -s.side * hw, outer = s.side * hw;   // the crack is toward -side
      const top = [[-hl, inner], [hl, inner], [hl, outer], [-hl, outer]].map(([cx, cz]) => {
        const p = corner(cx, cz), lift = cz === inner ? s.lift : -0.05;
        return [p[0], ride(p[0], p[2]) + lift, p[2]];
      });
      const bot = top.map((p) => [p[0], h(p[0], p[2]) - 0.6, p[2]]);
      const c = [s.x, (top[0][1] + bot[0][1]) / 2, s.z];
      outward(f, REC.slab, top[0], top[1], top[2], c, [0, 0], [1, 0], [1, 0.45]);
      outward(f, REC.slab, top[0], top[2], top[3], c, [0, 0], [1, 0.45], [0, 0.45]);
      for (let j = 0; j < 4; j++) {
        const j1 = (j + 1) % 4;
        outward(f, REC.slab, top[j], top[j1], bot[j1], c, [0, 0.55], [1, 0.55], [1, 1]);
        outward(f, REC.slab, top[j], bot[j1], bot[j], c, [0, 0.55], [1, 1], [0, 1]);
      }
    }
    // THE COGS: toothed discs on their edges, a third of each in the earth, leaning
    for (const g of L.cogs) {
      const TEETH = 16, N = TEETH * 4, T = COG_THICK, r = g.r;
      const sink = h(g.x, g.z) + r * 0.62, axis = [Math.cos(g.a), 0, Math.sin(g.a)];
      const outline = Array.from({ length: N }, (_, i) => { const q = i % 4, a = (i / N) * 2 * Math.PI, rr = q === 1 || q === 2 ? r * COG_TIP : r; return [Math.cos(a) * rr, Math.sin(a) * rr]; });
      const at = (px, py, side) => {
        // the disc's plane holds the up axis and the horizontal one across `axis`, leaning toward `axis` by `lean`
        const across = [-axis[2], 0, axis[0]], up = [axis[0] * Math.sin(g.lean), Math.cos(g.lean), axis[2] * Math.sin(g.lean)];
        return [g.x + across[0] * px + up[0] * py + axis[0] * side, sink + up[1] * py, g.z + across[2] * px + up[2] * py + axis[2] * side];
      };
      const c = [g.x, sink, g.z];
      for (const side of [-T / 2, T / 2]) {
        const mid = at(0, 0, side);
        for (let i = 0; i < N; i++) {
          const [x0, y0] = outline[i], [x1, y1] = outline[(i + 1) % N];
          outward(f, REC.gear, mid, at(x0, y0, side), at(x1, y1, side), [c[0] - axis[0] * side * 4, c[1], c[2] - axis[2] * side * 4], [0.5, 0.5], [0.5 + x0 / (2.3 * r), 0.5 + y0 / (2.3 * r)], [0.5 + x1 / (2.3 * r), 0.5 + y1 / (2.3 * r)]);
        }
      }
      for (let i = 0; i < N; i++) {
        const [x0, y0] = outline[i], [x1, y1] = outline[(i + 1) % N], v0 = i / N, v1 = (i + 1) / N;
        outward(f, REC.brass, at(x0, y0, -T / 2), at(x1, y1, -T / 2), at(x1, y1, T / 2), c, [v0, 0], [v1, 0], [v1, 0.2]);
        outward(f, REC.brass, at(x0, y0, -T / 2), at(x1, y1, T / 2), at(x0, y0, T / 2), c, [v0, 0], [v1, 0.2], [v0, 0.2]);
      }
    }
    // A COLUMN lying along its own x: `sides` faces about it, its radius, from x0 to x1, sunk into the ground - a piece of
    // pipe (copper) or the pillar's shaft (brass), each end capped
    const column = (o, x0, x1, radius, sides, wall, cap, tilt = 0) => {
      const ring = (x) => Array.from({ length: sides }, (_, j) => { const a = (j / sides) * 2 * Math.PI; return [x, Math.sin(a) * radius + x * tilt, Math.cos(a) * radius]; });
      const place = (p) => { const q = turn(p, o.a, o.x, o.z); return [q[0], q[1] + o.y, q[2]]; };
      const A = ring(x0).map(place), B = ring(x1).map(place), c = place([(x0 + x1) / 2, ((x0 + x1) / 2) * tilt, 0]);
      for (let j = 0; j < sides; j++) {
        const j1 = (j + 1) % sides, v0 = j / sides, v1 = (j + 1) / sides, l = (x1 - x0) / 2;
        outward(f, wall, A[j], A[j1], B[j1], c, [0, v0], [0, v1], [l, v1]);
        outward(f, wall, A[j], B[j1], B[j], c, [0, v0], [l, v1], [l, v0]);
      }
      for (const [R, x] of [[A, x0], [B, x1]]) {
        const m = place([x, x * tilt, 0]);
        for (let j = 0; j < sides; j++) outward(f, cap, m, R[j], R[(j + 1) % sides], c, [0.5, 0.5], [0.5 + 0.5 * Math.sin((j / sides) * 6.28), 0.5 + 0.5 * Math.cos((j / sides) * 6.28)], [0.5 + 0.5 * Math.sin(((j + 1) / sides) * 6.28), 0.5 + 0.5 * Math.cos(((j + 1) / sides) * 6.28)]);
      }
    };
    // THE PIPE, split: two lengths a gap apart, the shorter kicked up at its broken end
    const P = L.pipe, pr = PIPE.r, py = h(P.x, P.z) + pr * 0.55;
    column({ ...P, y: py }, PIPE.x0, -P.gap / 2, pr, 10, REC.copper, REC.brass);
    column({ ...P, y: py }, P.gap / 2, PIPE.x1, pr, 10, REC.copper, REC.brass, 0.12);
    // THE PILLAR: an eight-sided shaft on its side, its capital a block at one end
    const Q = L.pillar, qr = PILLAR.r, qy = h(Q.x, Q.z) + qr * 0.7, X0 = PILLAR.x1, X1 = PILLAR.capX, C = PILLAR.capR;
    column({ ...Q, y: qy }, PILLAR.x0, PILLAR.x1, qr, 8, REC.brass, REC.stone);
    const cap = [[X0, -C, -C], [X1, -C, -C], [X1, C, -C], [X0, C, -C], [X0, -C, C], [X1, -C, C], [X1, C, C], [X0, C, C]]
      .map(([x, y, z]) => { const q = turn([x, 0, z], Q.a, Q.x, Q.z); return [q[0], qy + y, q[2]]; });
    const cc = (() => { const q = turn([(X0 + X1) / 2, 0, 0], Q.a, Q.x, Q.z); return [q[0], qy, q[2]]; })();
    for (const [a, b, c, d] of [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]]) {
      outward(f, REC.stone, cap[a], cap[b], cap[c], cc, [0, 0], [1, 0], [1, 1]);
      outward(f, REC.stone, cap[a], cap[c], cap[d], cc, [0, 0], [1, 1], [0, 1]);
    }
  }
  // assembled as the gate's own (gateModel.js buildGateModel) - the indices 32-bit
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
    subMeshes.push({ textureArchive: FISSURE_ARCHIVE, textureRecord: rec, startIndex: v, primitiveCount: m / 3 });
    v += m;
  }
  return { positions, normals, uvs, indices, subMeshes };
}
