// @ts-check
// TESA10 (bible/03-World/Arena-Provinces.md TESA10) - THE CAPITALS' SHAPES: the pictures' pseudo-archive and the shapes
// every capital's landmarks are built of (world/capitalModels.js the Imperial City's, world/capitalSolitude.js
// Solitude's), in metres, y up, on the port's MeshBuilder (world/detStandIns.js). No game data.
import { DOOR_TYPE } from './meshReader.js';   // WW7-4: a castle's door

/** The pictures' pseudo-archive, past every classic one and the port's other art (LeFay's 38211, the galleon's 38131). */
export const CAPITAL_ARCHIVE = 38400;
/** The pictures, by record (world/capitalModels.js capitalArt paints them). */
export const CAPITAL_ART = Object.freeze({
  marble: 0, gold: 1, wallStone: 2, roof: 3, bridgeStone: 4, dark: 5,
  rock: 6, blueSlate: 7, timber: 8, nordStone: 9,
  ochre: 10, bronze: 11, cloth: 12, bark: 14, leaves: 15, sandstone: 16, terracotta: 17, mossStone: 18,   // AUDIT TESA II (lane K's K15): 13, the Crystal Tower's crystal, retired with it - no model wore it
  hide: 19, cane: 20,   // TESA-LORE: Falinesti's hide houses, Torval's sugarcane
});
/** A picture's [archive, record]. */
export const art = (record) => [CAPITAL_ARCHIVE, record];
const STONE = art(CAPITAL_ART.wallStone), ROOF = art(CAPITAL_ART.roof);

/** An n-gon's corner at angle index i, radius r, height y (the first corner at angle `phase`). */
export const corner = (n, i, r, y, phase = 0) => { const a = phase + (i / n) * Math.PI * 2; return [Math.cos(a) * r, y, Math.sin(a) * r]; };
/** Everything `fn` adds to `mb`, moved by (x, y, z). */
export function translated(mb, x, y, z, fn) {
  const before = new Map([...mb.groups].map(([k, g]) => [k, g.positions.length]));
  fn();
  for (const [k, g] of mb.groups) {
    for (let i = before.get(k) ?? 0; i < g.positions.length; i += 3) { g.positions[i] += x; g.positions[i + 1] += y; g.positions[i + 2] += z; }
  }
}
/** The unit normal of the triangle (a, b, c), turned to point away from `from`. */
export function outward(a, b, c, from) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  n = n.map((x) => x / l);
  const m = [(a[0] + b[0] + c[0]) / 3 - from[0], (a[1] + b[1] + c[1]) / 3 - from[1], (a[2] + b[2] + c[2]) / 3 - from[2]];
  return n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0 ? n.map((x) => -x) : n;
}
/** A taper: a frustum of n sides from (r0, y0) to (r1, y1), its sides only; `vRepeat` metres a picture. */
export function taper(mb, tex, n, r0, y0, r1, y1, { phase = 0, vRepeat = 8, uRepeat = 1, skip = null } = {}) {
  for (let i = 0; i < n; i++) {
    if (skip?.(i)) continue;   // AUDIT TESA II C4: a side left open (Falinesti's platforms over the walkway)
    const a = corner(n, i, r0, y0, phase), b = corner(n, i + 1, r0, y0, phase), c = corner(n, i + 1, r1, y1, phase), d = corner(n, i, r1, y1, phase);
    const am = phase + ((i + 0.5) / n) * Math.PI * 2, slope = (r0 - r1) / Math.max(1e-6, y1 - y0);
    const nl = Math.hypot(1, slope), nrm = [Math.cos(am) / nl, slope / nl, Math.sin(am) / nl];
    const v = -(y1 - y0) / vRepeat;
    mb.quad(tex, a, b, c, d, nrm, [[0, 0], [uRepeat, 0], [uRepeat, v], [0, v]]);
  }
}
/** A flat n-gon cap at height y, radius r, facing `up` (1) or down (-1). */
export function cap(mb, tex, n, r, y, up = 1, phase = 0) {
  for (let i = 0; i < n; i++) {
    const a = corner(n, i, r, y, phase), b = corner(n, i + 1, r, y, phase);
    mb.tri(tex, [0, y, 0], a, b, [0, up, 0], [0.5, -0.5], [0.5 + a[0] / (2 * r), -0.5 - a[2] / (2 * r)], [0.5 + b[0] / (2 * r), -0.5 - b[2] / (2 * r)]);
  }
}
/** An annulus at height y between radii rIn and rOut (a ledge's top). */
export function ring(mb, tex, n, rIn, rOut, y, phase = 0, skip = null) {
  for (let i = 0; i < n; i++) if (!skip?.(i)) mb.quad(tex, corner(n, i, rIn, y, phase), corner(n, i + 1, rIn, y, phase), corner(n, i + 1, rOut, y, phase), corner(n, i, rOut, y, phase), [0, 1, 0]);
}
/** A ledge: a short n-gon band between y0 and y1 at radius r, its top a ledge back to rIn; `skip(i)` the sides left open. */
export function ledge(mb, tex, n, r, rIn, y0, y1, phase = 0, skip = null) {
  taper(mb, tex, n, r, y0, r, y1, { phase, vRepeat: Math.max(0.5, y1 - y0), skip });
  ring(mb, tex, n, rIn, r, y1, phase, skip);
  ring(mb, tex, n, rIn, r, y0, phase, skip);
}
/** A straight wall from p to q on the ground (xz), `thick` across and `h` high, its foot sunk `sink` - its two long faces,
 *  its top and its two ends. */
export function wallRun(mb, tex, p, q, thick, h, sink = 3, vRepeat = 6) {
  const dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
  if (len < 1e-3) return;
  const ux = dx / len, uz = dz / len, nx = -uz, nz = ux, t = thick / 2;
  const P = (s, side, y) => [p[0] + ux * s + nx * t * side, y, p[1] + uz * s + nz * t * side];
  const u = len / vRepeat, v = -(h + sink) / vRepeat;
  for (const side of [1, -1]) mb.quad(tex, P(0, side, -sink), P(len, side, -sink), P(len, side, h), P(0, side, h), [nx * side, 0, nz * side], [[0, 0], [u, 0], [u, v], [0, v]]);
  mb.quad(tex, P(0, 1, h), P(len, 1, h), P(len, -1, h), P(0, -1, h), [0, 1, 0], [[0, 0], [u, 0], [u, -thick / vRepeat], [0, -thick / vRepeat]]);
  for (const [s, sign] of [[0, -1], [len, 1]]) mb.quad(tex, P(s, 1, -sink), P(s, -1, -sink), P(s, -1, h), P(s, 1, h), [ux * sign, 0, uz * sign], [[0, 0], [thick / vRepeat, 0], [thick / vRepeat, v], [0, v]]);
}
/** The merlons along a run: blocks `w` wide every `pitch` on its outer edge (the side the normal points). */
export function merlons(mb, tex, p, q, thick, h, w = 1.6, pitch = 3.6, mh = 1.6) {
  const dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
  if (len < pitch) return;
  const ux = dx / len, uz = dz / len, nx = -uz, nz = ux;
  for (let s = pitch / 2; s + w / 2 < len; s += pitch) {
    const cx = p[0] + ux * s + nx * (thick / 2 - 0.4), cz = p[1] + uz * s + nz * (thick / 2 - 0.4);
    mb.box(tex, [cx, h + mh / 2, cz], [Math.abs(ux) * w + Math.abs(nx) * 0.8 + 0.01, mh, Math.abs(uz) * w + Math.abs(nz) * 0.8 + 0.01], 0.4);
  }
}
/** A wall's run with a gap: from p to q, broken `gate` wide about the point `at` metres along it, a lintel over the gap
 *  from `gateH` to the wall's top. */
export function gatedRun(mb, tex, p, q, thick, h, at, gate, gateH) {
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]), ux = (q[0] - p[0]) / len, uz = (q[1] - p[1]) / len;
  const P = (s) => [p[0] + ux * s, p[1] + uz * s];
  const a = P(at - gate / 2), b = P(at + gate / 2);
  wallRun(mb, tex, p, a, thick, h); merlons(mb, tex, p, a, thick, h);
  wallRun(mb, tex, b, q, thick, h); merlons(mb, tex, b, q, thick, h);
  translated(mb, 0, gateH, 0, () => wallRun(mb, tex, a, b, thick, h - gateH, 0));
}
/** A round tower at (x, z): its drum, its crenel band, its conical roof. */
export function roundTower(mb, x, z, r, h, { roofH = r * 1.4, sides = 16, wall = STONE, roof = ROOF, y = 0 } = {}) {
  translated(mb, x, y, z, () => {
    taper(mb, wall, sides, r, -3, r, h, { vRepeat: 6, uRepeat: 2 });
    ledge(mb, wall, sides, r + 0.6, r - 0.2, h, h + 1.8);
    taper(mb, roof, sides, r + 0.4, h + 1.8, 0.01, h + 1.8 + roofH, { vRepeat: 4, uRepeat: 2 });
  });
}
/** A four-sided pyramid over the rectangle centred (cx, cz), `w` across x and `d` across z, its eaves at y0, its apex h
 *  above. */
export function pyramid(mb, tex, cx, cz, w, d, y0, h) {
  const c = [[cx - w / 2, y0, cz - d / 2], [cx + w / 2, y0, cz - d / 2], [cx + w / 2, y0, cz + d / 2], [cx - w / 2, y0, cz + d / 2]], top = [cx, y0 + h, cz];
  for (let i = 0; i < 4; i++) {
    const a = c[i], b = c[(i + 1) % 4], len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    mb.tri(tex, a, b, top, outward(a, b, top, [cx, y0, cz]), [0, 0], [len / 4, 0], [len / 8, -h / 3]);
  }
}
/**
 * A gabled roof over the rectangle centred (cx, cz): `w` along its ridge and `d` across it (the ridge along x, or along z
 * where `alongX` is false), its eaves at y0 and its ridge h above - its two slopes, `over` past either end, and the two
 * gables' triangles of `endTex`.
 */
export function gableRoof(mb, tex, endTex, cx, cz, w, d, y0, h, { alongX = true, over = 0.8 } = {}) {
  const P = (u, y, v) => (alongX ? [cx + u, y, cz + v] : [cx + v, y, cz + u]);
  const W = w / 2 + over, D = d / 2, mid = [cx, y0, cz], slant = Math.hypot(D, h);
  for (const side of [1, -1]) {
    const a = P(-W, y0, side * D), b = P(W, y0, side * D), c = P(W, y0 + h, 0), e = P(-W, y0 + h, 0);
    mb.quad(tex, a, b, c, e, outward(a, b, c, mid), [[0, 0], [w / 4, 0], [w / 4, -slant / 4], [0, -slant / 4]]);
  }
  for (const end of [1, -1]) {
    const a = P(end * w / 2, y0, -D), b = P(end * w / 2, y0, D), top = P(end * w / 2, y0 + h, 0);
    mb.tri(endTex, a, b, top, outward(a, b, top, mid), [0, 0], [d / 6, 0], [d / 12, -h / 6]);
  }
}
/** A block's walls: a box from y0 to y1 over the rectangle centred (cx, cz). */
export const hall = (mb, tex, cx, cz, w, d, y0, y1, uv = 0.25) => mb.box(tex, [cx, (y0 + y1) / 2, cz], [w, y1 - y0, d], uv);
/** Merlons round the top of a rectangle at height y: blocks every `pitch` on its four edges. */
export function crenels(mb, tex, cx, cz, w, d, y, { pitch = 2.6, mw = 1.3, mh = 1.4 } = {}) {
  for (const [len, fixed, alongX, sign] of [[w, d / 2, true, -1], [w, d / 2, true, 1], [d, w / 2, false, -1], [d, w / 2, false, 1]]) {
    for (let s = -len / 2 + pitch / 2; s <= len / 2 - pitch / 2 + 1e-6; s += pitch) {
      const at = alongX ? [cx + s, y + mh / 2, cz + sign * (fixed - 0.3)] : [cx + sign * (fixed - 0.3), y + mh / 2, cz + s];
      mb.box(tex, at, alongX ? [mw, mh, 0.6] : [0.6, mh, mw], 0.4);
    }
  }
}
/** A square tower at (x, z), side `s`: its shaft from below the ground to h, its crenels, and a pyramid roof (none at
 *  roofH 0). */
export function squareTower(mb, x, z, s, h, { roofH = s * 0.9, wall = STONE, roof = ROOF } = {}) {
  hall(mb, wall, x, z, s, s, -3, h);
  crenels(mb, wall, x, z, s, s, h);
  if (roofH > 0) pyramid(mb, roof, x, z, s + 0.8, s + 0.8, h + 1.4, roofH);
}
/** A dark door's face on a wall: `w` wide and `h` high at (x, z) on the plane facing `n` ([nx, nz], an axis), a hair proud. */
export function darkDoor(mb, tex, x, z, w, h, n, y = 0) {
  const [nx, nz] = n, tx = -nz, tz = nx, e = 0.05;
  const P = (s, yy) => [x + nx * e + tx * s, y + yy, z + nz * e + tz * s];
  mb.quad(tex, P(-w / 2, 0), P(w / 2, 0), P(w / 2, h), P(-w / 2, h), [nx, 0, nz]);
}
/**
 * WW7-4: A CASTLE'S DOOR - the dungeon entrance on a dark door's face (darkDoor's own arguments), as a classic model's
 * door is (world/meshReader.js dfMeshToModel: one plane's first three corners, the first and third across it, its
 * normal out of the building - where the way out lands, player/enterExit.js dungeonEntranceLanding). A model drawn as a
 * map reads carries it; world/capitalModels.js northward turns it with the face.
 */
export function entranceDoor(x, z, w, h, n, y = 0) {
  const [nx, nz] = n, tx = -nz, tz = nx, e = 0.05;
  const P = (s, yy) => ({ x: x + nx * e + tx * s, y: y + yy, z: z + nz * e + tz * s });
  return { index: 0, type: DOOR_TYPE.DUNGEON_ENTRANCE, vert0: P(-w / 2, 0), vert1: P(w / 2, 0), vert2: P(w / 2, h), normal: { x: nx, y: 0, z: nz } };
}
/** A hash in [0, 1) of integers - the rock's own jitter, the same on every client. */
export function jitter(...k) {
  let h = 0x9e3779b9;
  for (const v of k) { h = Math.imul(h ^ (v | 0), 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; }
  return (h >>> 0) / 4294967296;
}
/**
 * A rock column at (x, z): `n` sides through `levels` ([y, r] from the foot up), each corner's radius off by up to
 * `rough` metres (`seed` its hash), capped flat at its top in `topTex`.
 */
export function rockColumn(mb, tex, topTex, x, z, n, levels, { rough = 3, seed = 1 } = {}) {
  const pt = (i, l) => { const [y, r] = levels[l], a = ((i % n) / n) * Math.PI * 2, rr = r + (jitter(seed, i % n, l) - 0.5) * 2 * rough; return [x + Math.cos(a) * rr, y, z + Math.sin(a) * rr]; };
  for (let l = 0; l + 1 < levels.length; l++) {
    const yMid = (levels[l][0] + levels[l + 1][0]) / 2;
    for (let i = 0; i < n; i++) {
      const a = pt(i, l), b = pt(i + 1, l), c = pt(i + 1, l + 1), d = pt(i, l + 1), h = levels[l + 1][0] - levels[l][0];
      mb.quad(tex, a, b, c, d, outward(a, b, c, [x, yMid, z]), [[0, 0], [2, 0], [2, -h / 8], [0, -h / 8]]);
    }
  }
  const top = levels.length - 1, ty = levels[top][0];
  for (let i = 0; i < n; i++) {
    const a = pt(i, top), b = pt(i + 1, top);
    mb.tri(topTex, [x, ty, z], a, b, [0, 1, 0], [0, 0], [(a[0] - x) / 8, (a[2] - z) / 8], [(b[0] - x) / 8, (b[2] - z) / 8]);
  }
}
/**
 * A dome at (x, y, z): `n` sides and `rings` bands from its drum's top (radius r) to its crown h above; `onion` swells it
 * past r below its middle and draws it to a point (Mournhold's and Torval's).
 */
export function dome(mb, tex, x, y, z, r, h, { n = 16, rings = 6, onion = 0 } = {}) {
  const prof = (t) => {   // t 0 at the drum, 1 at the crown: [radius, height]
    const a = (t * Math.PI) / 2, swell = onion * Math.sin(t * Math.PI) * (1 - t);
    return [Math.max(0.01, r * Math.cos(a) * (1 + swell)) * (onion ? 1 - t * t * 0.35 : 1), h * Math.sin(a)];
  };
  for (let k = 0; k < rings; k++) {
    const [r0, y0] = prof(k / rings), [r1, y1] = prof((k + 1) / rings);
    translated(mb, x, y, z, () => taper(mb, tex, n, r0, y0, r1, y1, { vRepeat: Math.max(1, h / 3) }));
  }
}
/** A blob at (x, y, z): an `n`-sided ball of `rings` bands, radii (rx, ry, rz), each corner off by up to `rough` of its
 *  radius (`seed` its hash) - a crown of leaves, a boulder. */
export function blob(mb, tex, x, y, z, rx, ry, rz, { n = 10, rings = 6, rough = 0.18, seed = 1 } = {}) {
  const P = (i, k) => {
    const lat = -Math.PI / 2 + (k / rings) * Math.PI, lon = ((i % n) / n) * Math.PI * 2;
    const j = k === 0 || k === rings ? 1 : 1 + (jitter(seed, i % n, k) - 0.5) * 2 * rough;
    return [x + Math.cos(lat) * Math.cos(lon) * rx * j, y + Math.sin(lat) * ry * j, z + Math.cos(lat) * Math.sin(lon) * rz * j];
  };
  for (let k = 0; k < rings; k++) {
    for (let i = 0; i < n; i++) {
      const a = P(i, k), b = P(i + 1, k), c = P(i + 1, k + 1), d = P(i, k + 1);
      if (k === 0) mb.tri(tex, a, c, d, outward(a, c, d, [x, y, z]), [0, 0], [1, -1], [0, -1]);
      else if (k === rings - 1) mb.tri(tex, a, b, c, outward(a, b, c, [x, y, z]), [0, 0], [1, 0], [1, -1]);
      else mb.quad(tex, a, b, c, d, outward(a, b, c, [x, y, z]), [[0, 0], [1, 0], [1, -1], [0, -1]]);
    }
  }
}
/** A limb from p to q: an `n`-sided tube from radius r0 to r1 (a branch, a root, a pole). */
export function limb(mb, tex, p, q, r0, r1, { n = 8, vRepeat = 6 } = {}) {
  const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], len = Math.hypot(...d) || 1, u = d.map((v) => v / len);
  const ref = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let a = [u[1] * ref[2] - u[2] * ref[1], u[2] * ref[0] - u[0] * ref[2], u[0] * ref[1] - u[1] * ref[0]];
  const al = Math.hypot(...a); a = a.map((v) => v / al);
  const b = [u[1] * a[2] - u[2] * a[1], u[2] * a[0] - u[0] * a[2], u[0] * a[1] - u[1] * a[0]];
  const at = (c, r, i) => { const t = (i / n) * Math.PI * 2, cs = Math.cos(t), sn = Math.sin(t); return [c[0] + (a[0] * cs + b[0] * sn) * r, c[1] + (a[1] * cs + b[1] * sn) * r, c[2] + (a[2] * cs + b[2] * sn) * r]; };
  for (let i = 0; i < n; i++) {
    const t = ((i + 0.5) / n) * Math.PI * 2, nrm = [a[0] * Math.cos(t) + b[0] * Math.sin(t), a[1] * Math.cos(t) + b[1] * Math.sin(t), a[2] * Math.cos(t) + b[2] * Math.sin(t)];
    mb.quad(tex, at(p, r0, i), at(p, r0, i + 1), at(q, r1, i + 1), at(q, r1, i), nrm, [[i / n, 0], [(i + 1) / n, 0], [(i + 1) / n, -len / vRepeat], [i / n, -len / vRepeat]]);
  }
}
/** A figure's local frame at (x, z) facing `face` (a unit [x, z]): a point `f` forward, `s` to its right, `y` up. */
export const framed = (x, z, face) => (f, s, y) => [x + face[0] * f - face[1] * s, y, z + face[1] * f + face[0] * s];
/**
 * TESA-LORE: A ROBED FIGURE (a statue's - the Imperial City's Divines, Mournhold's Almalexia), `h` tall from `y`, at (x, z)
 * facing `face` - its robe from its feet to its chest, its shoulders, its head, its arms by its `pose`: 0 its hands before
 * it, 1 its right arm raised, 2 both raised in blessing, 3 a staff in its right hand.
 */
export function robedFigure(mb, tex, x, z, y, h, face, pose) {
  const P = framed(x, z, face), k = h / 6.5;
  translated(mb, x, y, z, () => {
    taper(mb, tex, 10, 1.15 * k, 0, 0.62 * k, 3.9 * k, { vRepeat: 3 });   // the robe
    taper(mb, tex, 10, 0.62 * k, 3.9 * k, 0.78 * k, 4.9 * k, { vRepeat: 2 });   // the chest to the shoulders
    taper(mb, tex, 10, 0.78 * k, 4.9 * k, 0.3 * k, 5.25 * k, { vRepeat: 1 });
  });
  blob(mb, tex, x, y + 5.75 * k, z, 0.42 * k, 0.52 * k, 0.42 * k, { n: 8, rings: 5, rough: 0, seed: 0xd1 + pose });
  const sh = (side) => P(0, side * 0.78 * k, y + 4.75 * k);
  const hand = {
    0: (side) => P(0.75 * k, side * 0.35 * k, y + 3.6 * k),
    1: (side) => (side > 0 ? P(0.2 * k, 1.0 * k, y + 7.4 * k) : P(0.25 * k, -0.9 * k, y + 3.2 * k)),
    2: (side) => P(0.6 * k, side * 1.6 * k, y + 6.6 * k),
    3: (side) => (side > 0 ? P(0.55 * k, 0.95 * k, y + 3.9 * k) : P(0.7 * k, -0.4 * k, y + 3.7 * k)),
  }[pose];
  for (const side of [1, -1]) limb(mb, tex, sh(side), hand(side), 0.26 * k, 0.18 * k, { n: 6 });
  if (pose === 3) limb(mb, tex, P(0.55 * k, 0.95 * k, y), P(0.55 * k, 0.95 * k, y + 7.2 * k), 0.12 * k, 0.12 * k, { n: 6 });   // the staff
}
