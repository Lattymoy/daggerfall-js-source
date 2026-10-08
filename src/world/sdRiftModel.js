// @ts-check
// SD-LOOK (2026-10-08, bible/11-Multiplayer/Super-Dungeons-Look.md section 1): THE RIFT, BUILT - a brass astrolabe stood
// on its edge in a Daggerfall hall, the escapement of the broken clock torn open. Its parts, each a model in the
// renderer's shape (`packRealmFaces`), made at the ring's own size (`size`, its gear's span - world/sdDungeon.js
// sdRiftPlace) in its own frame: x across its face (the right as one standing before its front sees it), y up, z through
// it - its FRONT faces -z (one standing before it looks toward +z), its foot (the floor under its middle) the origin.
//
//   buildRiftStatic - the crater (the hall's floor heaved up and split about its foot, the splits mended with brass),
//                     the cogged plinth and the two claws gripping the ring's lower rim: what never moves (and so the
//                     one part that casts - nothing that turns rebuilds a shadow's cube)
//   buildRiftGear   - the outer gear: a band and 36 square-cut teeth, ticking a tooth forward a second
//   buildHourRing   - the hour-ring within it: twelve bevelled blocks a numeral each, a hair apart so light leaks through,
//                     ratcheting an hour BACK on each toll of the bell
//   buildRiftStuds  - two studs on each block, lit by how long its Hour stands (how many, never which)
//   irisPositions   - the iris: eight riveted leaves closing from the hour-ring's lip; their APERTURE IS THE RIFT'S STATE
//   buildRiftShard  - a broken piece of ring, three of them orbiting the rim
//   buildReturnModel- the Return: a pale lancet arch banded in silver, the keystone's clock (its hand a second draw)
//
// The rotating parts are built about the ring's centre (`riftCentreY`), so their matrices are the stand's base, up to
// the centre, then turned about z. Pure: no GL. Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { faces } from './gateModel.js';
import { packRealmFaces, SD_REALM_ARCHIVE, SD_REALM_BRASS_RECORD, SD_REALM_COBBLE_RECORD, SD_REALM_EDGE_RECORD } from './sdRealm.js';
import { SD_HALL_GLOW_RECORD } from './sdHallArt.js';
import { SD_RIFT_ATLAS, SD_RIFT_RECORD } from './sdRiftArt.js';

/** The parts' proportions, in the ring's radius R (half its size): the gear's band and teeth, the hour-ring, the iris's
 *  reach, the window's (behind the leaves), the plinth, the crater, the hover (a hand's breadth off the floor). */
export const SD_RIFT_PARTS = Object.freeze({
  gear0: 0.86, gear1: 0.93, tooth1: 0.995, gearZ: 0.045, toothZ: 0.035, teeth: 36,
  ring0: 0.69, ring1: 0.835, ringZ: 0.06, ringGapDeg: 1.6,
  iris1: 0.8, irisZ: 0.012, window: 0.86,
  plinth: 0.36, plinthH: 0.12, crater0: 0.38, crater1: 0.9, slabs: 12,
  hover: 0.06, studR: 0.812, studDeg: 9, stud: 0.018,
  shardOrbit: 1.04,
});
/** The ring's centre's height over its foot, at `size`. */
export const riftCentreY = (size) => size / 2 + SD_RIFT_PARTS.hover * (size / 2);

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** A quad wound to face `want` whichever way its corners were listed. */
function quad(f, rec, a, b, c, d, ua, ub, uc, ud, want) {
  if (dot(cross(sub(b, a), sub(c, a)), want) >= 0) f.quad(rec, a, b, c, d, ua, ub, uc, ud);
  else f.quad(rec, d, c, b, a, ud, uc, ub, ua);
}
function tri(f, rec, a, b, c, ua, ub, uc, want) {
  if (dot(cross(sub(b, a), sub(c, a)), want) >= 0) f.tri(rec, a, b, c, ua, ub, uc);
  else f.tri(rec, c, b, a, uc, ub, ua);
}
/** An atlas cell's uv at (s, t) across it (0..1 each way, t down the cell's rows) - the atlas's cells, world/sdRiftArt.js
 *  SD_RIFT_ATLAS. The renderer reads a picture's first row as its top (v 1 - world/sdHall.js's uprights), so v runs up
 *  from its last. */
const cell = (name, s, t) => { const c = SD_RIFT_ATLAS[name]; return [(c[0] + s * c[2]) / SD_RIFT_ATLAS.size, 1 - (c[1] + t * c[3]) / SD_RIFT_ATLAS.size]; };
/** A point of the ring's plane at radius r, angle a (clockwise from the top as its front sees it), depth z - about the
 *  ring's centre. */
const ringPt = (r, a, z) => [Math.sin(a) * r, Math.cos(a) * r, z];
const FRONT = [0, 0, -1], BACK = [0, 0, 1];
const out2 = (a) => [Math.sin(a), Math.cos(a), 0];

/** An annular piece of the ring's plane from a0 to a1, r0 to r1, its front at -z0 and back at +z0: its two faces, its
 *  outer and inner rims and its two ends, `segs` steps round. `uvOf(face, s, t)`. */
function annulus(f, rec, r0, r1, a0, a1, z0, segs, uvOf) {
  for (let k = 0; k < segs; k++) {
    const b0 = a0 + ((a1 - a0) * k) / segs, b1 = a0 + ((a1 - a0) * (k + 1)) / segs, s0 = k / segs, s1 = (k + 1) / segs;
    for (const [z, want] of [[-z0, FRONT], [z0, BACK]]) quad(f, rec, ringPt(r0, b0, z), ringPt(r0, b1, z), ringPt(r1, b1, z), ringPt(r1, b0, z), uvOf('face', s0, 0), uvOf('face', s1, 0), uvOf('face', s1, 1), uvOf('face', s0, 1), want);
    const bm = (b0 + b1) / 2;
    quad(f, rec, ringPt(r1, b0, -z0), ringPt(r1, b1, -z0), ringPt(r1, b1, z0), ringPt(r1, b0, z0), uvOf('rim', s0, 0), uvOf('rim', s1, 0), uvOf('rim', s1, 1), uvOf('rim', s0, 1), out2(bm));
    quad(f, rec, ringPt(r0, b0, -z0), ringPt(r0, b1, -z0), ringPt(r0, b1, z0), ringPt(r0, b0, z0), uvOf('rim', s0, 0), uvOf('rim', s1, 0), uvOf('rim', s1, 1), uvOf('rim', s0, 1), out2(bm).map((v) => -v));
  }
  const endUv = [uvOf('rim', 0, 0), uvOf('rim', 0.2, 0), uvOf('rim', 0.2, 1), uvOf('rim', 0, 1)];
  for (const [a, side] of [[a0, -1], [a1, 1]]) {
    const n = [Math.cos(a) * side, -Math.sin(a) * side, 0];
    quad(f, rec, ringPt(r0, a, -z0), ringPt(r1, a, -z0), ringPt(r1, a, z0), ringPt(r0, a, z0), ...endUv, n);
  }
}

/** THE OUTER GEAR, about the ring's centre: its band and 36 square-cut teeth. */
export function buildRiftGear(size) {
  const f = faces(), R = size / 2, P = SD_RIFT_PARTS, rec = SD_RIFT_RECORD.lit;
  const uv = (k, s, t) => cell(k === 'face' ? 'brass' : 'brassDark', s, t);
  annulus(f, rec, P.gear0 * R, P.gear1 * R, 0, Math.PI * 2, P.gearZ * R, P.teeth * 2, uv);
  const pitch = (Math.PI * 2) / P.teeth;
  for (let k = 0; k < P.teeth; k++) annulus(f, rec, P.gear1 * R - 0.005 * R, P.tooth1 * R, k * pitch + pitch * 0.25, k * pitch + pitch * 0.75, P.toothZ * R, 1, uv);
  return packRealmFaces(f);
}

/** THE HOUR-RING, about the ring's centre: twelve blocks, block i's middle at i hours clockwise from the top, its front
 *  wearing numeral i (XII first) foot to the hub, a hair apart. */
export function buildHourRing(size) {
  const f = faces(), R = size / 2, P = SD_RIFT_PARTS, gap = (P.ringGapDeg * Math.PI) / 180, rec = SD_RIFT_RECORD.lit;
  for (let i = 0; i < 12; i++) {
    const mid = (i * Math.PI) / 6, a0 = mid - Math.PI / 12 + gap / 2, a1 = mid + Math.PI / 12 - gap / 2;
    // its front and back the numeral's cell - s across the block (left to right as its front sees it), t from the hub out
    annulus(f, rec, P.ring0 * R, P.ring1 * R, a0, a1, P.ringZ * R, 4, (k, s, t) => (k === 'face' ? cell(`n${i}`, s, t) : cell('brassDark', s, t)));
  }
  return packRealmFaces(f);
}

/** THE STUDS: two on each block's front and back - `lit` of the 24 alight (gold), then `ember` of them going (ember),
 *  the rest dark brass - counted from the twelfth clockwise. A count, never which. */
export const SD_RIFT_STUDS = 24;
export function buildRiftStuds(size, lit = SD_RIFT_STUDS, ember = 0) {
  const f = faces(), R = size / 2, P = SD_RIFT_PARTS, w = P.stud * R, z0 = P.ringZ * R, st = (P.studDeg * Math.PI) / 180;
  for (let k = 0; k < SD_RIFT_STUDS; k++) {
    const i = k >> 1, a = (i * Math.PI) / 6 + (k & 1 ? st : -st);
    const rec = k < lit ? SD_REALM_EDGE_RECORD : k < lit + ember ? SD_HALL_GLOW_RECORD.fray : SD_REALM_BRASS_RECORD;
    const c = ringPt(P.studR * R, a, 0), u = [Math.cos(a), -Math.sin(a), 0], v = out2(a);
    const C = (s, t, z) => [c[0] + u[0] * s + v[0] * t, c[1] + u[1] * s + v[1] * t, z];
    for (const side of [-1, 1]) {
      const zf = side * (z0 + w * 0.6), zb = side * z0, want = [0, 0, side];
      quad(f, rec, C(-w, -w, zf), C(w, -w, zf), C(w, w, zf), C(-w, w, zf), [0, 0], [1, 0], [1, 1], [0, 1], want);
      for (const [p, q, n] of [[[-w, -w], [w, -w], [-v[0], -v[1], 0]], [[w, -w], [w, w], u], [[w, w], [-w, w], v], [[-w, w], [-w, -w], [-u[0], -u[1], 0]]]) {
        quad(f, rec, C(p[0], p[1], zb), C(q[0], q[1], zb), C(q[0], q[1], zf), C(p[0], p[1], zf), [0, 0], [1, 0], [1, 0.3], [0, 0.3], n);
      }
    }
  }
  return packRealmFaces(f);
}

/** THE IRIS at `aperture` (0 shut, 1 wide): eight leaves in the ring's plane, each the annular sector from the octagon its
 *  inner edges make (radius `aperture` x the hour-ring's lip) out to SD_RIFT_PARTS.iris1, turned as it closes - its
 *  front a hair before the middle and its back a hair behind (the window, render/sdRiftPass.js, is drawn in the middle:
 *  the leaves shut it from both sides by depth, so leaves and window always agree). Positions and normals for
 *  renderer.updateMeshVertices: the same count at every aperture. The first call (`irisModel`) makes the mesh. */
export const SD_IRIS_LEAVES = 8;
const IRIS_ARC = 6;   // steps along a leaf's outer arc
export function irisPositions(size, aperture) {
  const R = size / 2, P = SD_RIFT_PARTS, a = Math.max(0, Math.min(1, aperture));
  // the octagon's corners never past the leaves' outer arc: wide open, its flat sides stand behind the hour-ring's lip
  const ro = P.iris1 * R, rv = a * ro * 0.97;
  const twist = (1 - a) * (Math.PI / 5), span = (Math.PI * 2) / SD_IRIS_LEAVES, over = span * 0.18;
  const pos = [], nrm = [];
  const push = (p, n) => { pos.push(p[0], p[1], p[2]); nrm.push(n[0], n[1], n[2]); };
  for (let k = 0; k < SD_IRIS_LEAVES; k++) {
    const a0 = k * span + twist, a1 = a0 + span + over;
    const A0 = ringPt(rv, a0, 0), A1 = ringPt(rv, a0 + span, 0);
    const e = sub(A1, A0), el = Math.hypot(e[0], e[1]) || 1;
    const ext = Math.min(over * ro * 0.5, Math.max(0, ro - rv)), A2 = [A1[0] + (e[0] / el) * ext, A1[1] + (e[1] / el) * ext, 0];
    const rim = Array.from({ length: IRIS_ARC + 1 }, (_, j) => ringPt(ro, a1 - ((a1 - a0) * j) / IRIS_ARC, 0));
    const poly = [A0, A1, A2, ...rim];   // inner edge, then the outer arc back
    const c = rim[IRIS_ARC >> 1];        // a fan from the rim's middle (the polygon is convex)
    for (const side of [-1, 1]) {
      const z = side * (P.irisZ * R + k * 0.0012 * R), n = [0, 0, side];
      for (let j = 0; j < poly.length; j++) {
        const t = [[c[0], c[1], z], [poly[j][0], poly[j][1], z], [poly[(j + 1) % poly.length][0], poly[(j + 1) % poly.length][1], z]];
        const order = dot(cross(sub(t[1], t[0]), sub(t[2], t[0])), n) < 0 ? [0, 2, 1] : [0, 1, 2];
        for (const o of order) push(t[o], n);
      }
    }
  }
  return { positions: new Float32Array(pos), normals: new Float32Array(nrm) };
}
/** The iris's mesh at `aperture` - its uvs the leaf cell, laid by the plane's own x and y (riveted brass engraved with
 *  minute ticks: world/sdRiftArt.js). */
export function irisModel(size, aperture) {
  const { positions, normals } = irisPositions(size, aperture), R = size / 2, n = positions.length / 3;
  const uvs = new Float32Array(n * 2), per = n / SD_IRIS_LEAVES, span = (Math.PI * 2) / SD_IRIS_LEAVES, twist = (1 - Math.max(0, Math.min(1, aperture))) * (Math.PI / 5);
  for (let i = 0; i < n; i++) {
    // across the leaf (its angle from its own start) and out from the hub - so its ticks run along its outer edge
    const k = Math.floor(i / per), x = positions[i * 3], y = positions[i * 3 + 1];
    let a = Math.atan2(x, y) - (k * span + twist);
    a -= Math.floor(a / (Math.PI * 2) + 0.25) * Math.PI * 2;
    const c = cell('leaf', Math.max(0, Math.min(1, a / (span * 1.18))), Math.min(1, Math.hypot(x, y) / (SD_RIFT_PARTS.iris1 * R)));
    uvs[i * 2] = c[0]; uvs[i * 2 + 1] = c[1];
  }
  const indices = new Uint32Array(n);
  for (let i = 0; i < n; i++) indices[i] = i;
  return { positions, normals, uvs, indices, subMeshes: [{ textureArchive: SD_REALM_ARCHIVE, textureRecord: SD_RIFT_RECORD.lit, startIndex: 0, primitiveCount: n / 3 }] };
}

/** A BROKEN PIECE OF RING (shard k of three): a span of the gear's band, its ends torn ragged, about its own middle. */
export function buildRiftShard(size, k = 0) {
  const f = faces(), R = size / 2, P = SD_RIFT_PARTS, span = 0.5 + 0.12 * k;
  annulus(f, SD_RIFT_RECORD.lit, P.gear0 * R, P.gear1 * R, -span / 2, span / 2, P.gearZ * R, 4, (kk, s, t) => cell(kk === 'face' ? 'brass' : 'brassDark', s, t));
  const m = packRealmFaces(f), mid = ((P.gear0 + P.gear1) / 2) * R;
  for (let i = 1; i < m.positions.length; i += 3) m.positions[i] -= mid;   // about its own middle
  return m;
}

/** THE STATIC PART, about the foot: the crater - the hall's floor (`floor`: { archive, record } the hall's own, the
 *  realm's cobbles where it cannot be read) in twelve slabs heaved up and split, the splits mended with brass; the cogged
 *  plinth; the two claws reaching from it to grip the gear's lower rim. */
export function buildRiftStatic(size, floor = null) {
  const f = faces(), R = size / 2, P = SD_RIFT_PARTS, cy = riftCentreY(size), UP = [0, 1, 0];
  const fl = floor ?? { archive: SD_REALM_ARCHIVE, record: SD_REALM_COBBLE_RECORD };
  const FLOOR = -1;   // the slabs' record, put to the floor's own after packing
  const tile = 2;     // metres a repeat of the floor's texture
  const n = P.slabs, gap = (2.4 * Math.PI) / 180, r0 = P.crater0 * R, r1 = P.crater1 * R;
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2 + gap / 2, a1 = ((k + 1) / n) * Math.PI * 2 - gap / 2;
    const lift = 0.028 * size * (0.6 + 0.4 * (((k * 7) % 5) / 4)), sink = -0.006 * size;
    const P0 = (r, a, y) => [Math.sin(a) * r, y, Math.cos(a) * r];
    const i0 = P0(r0, a0, sink), i1 = P0(r0, a1, sink), o1 = P0(r1, a1, lift), o0 = P0(r1, a0, lift * 0.7);
    const uv = (p) => [p[0] / tile, p[2] / tile];
    quad(f, FLOOR, i0, i1, o1, o0, uv(i0), uv(i1), uv(o1), uv(o0), UP);
    // its raised outer edge, down to the floor
    const g1 = [o1[0], 0, o1[2]], g0 = [o0[0], 0, o0[2]], am = (a0 + a1) / 2;
    quad(f, FLOOR, g0, g1, o1, o0, [0, 0], [1, 0], [1, 0.1], [0, 0.1], [Math.sin(am), 0, Math.cos(am)]);
    // the split after it, mended with brass: a strip along the gap, a hair under the slabs' edges
    const b0 = (k + 1) / n * Math.PI * 2, w = 0.012 * size;
    const S = (r, side, y) => [Math.sin(b0) * r + Math.cos(b0) * side, y, Math.cos(b0) * r - Math.sin(b0) * side];
    quad(f, SD_REALM_BRASS_RECORD, S(r0, -w, sink + 0.004), S(r0, w, sink + 0.004), S(r1, w, lift * 0.85), S(r1, -w, lift * 0.85), [0, 0], [0.2, 0], [0.2, 1], [0, 1], UP);
  }
  // the plinth: an octagon with sixteen cogs round its top
  const pr = P.plinth * R, ph = P.plinthH * R, oct = (j) => (j / 8) * Math.PI * 2 + Math.PI / 8;
  for (let j = 0; j < 8; j++) {
    const a = oct(j), b = oct(j + 1);
    const p = (r, ang, y) => [Math.sin(ang) * r, y, Math.cos(ang) * r];
    tri(f, SD_RIFT_RECORD.lit, [0, ph, 0], p(pr, a, ph), p(pr, b, ph), cell('plinth', 0.5, 0.5), cell('plinth', 0, 1), cell('plinth', 1, 1), UP);
    const am = (a + b) / 2;
    quad(f, SD_RIFT_RECORD.lit, p(pr, a, -0.05), p(pr, b, -0.05), p(pr, b, ph), p(pr, a, ph), cell('plinth', 0, 0), cell('plinth', 1, 0), cell('plinth', 1, 0.3), cell('plinth', 0, 0.3), [Math.sin(am), 0, Math.cos(am)]);
  }
  for (let j = 0; j < 16; j++) {
    const a = (j / 16) * Math.PI * 2, c = [Math.sin(a) * pr, 0, Math.cos(a) * pr], u = [Math.cos(a), 0, -Math.sin(a)], v = [Math.sin(a), 0, Math.cos(a)];
    const t = 0.05 * R, w = 0.045 * R;
    const C = (s, o, y) => [c[0] + u[0] * s + v[0] * o, y, c[2] + u[2] * s + v[2] * o];
    quad(f, SD_RIFT_RECORD.lit, C(-w, 0, ph), C(w, 0, ph), C(w, t, ph), C(-w, t, ph), cell('brassDark', 0, 0), cell('brassDark', 1, 0), cell('brassDark', 1, 1), cell('brassDark', 0, 1), UP);
    quad(f, SD_RIFT_RECORD.lit, C(-w, t, 0), C(w, t, 0), C(w, t, ph), C(-w, t, ph), cell('brassDark', 0, 0), cell('brassDark', 1, 0), cell('brassDark', 1, 1), cell('brassDark', 0, 1), v);
    for (const s of [-1, 1]) quad(f, SD_RIFT_RECORD.lit, C(s * w, 0, 0), C(s * w, t, 0), C(s * w, t, ph), C(s * w, 0, ph), cell('brassDark', 0, 0), cell('brassDark', 1, 0), cell('brassDark', 1, 1), cell('brassDark', 0, 1), u.map((x) => x * s));
  }
  // the claws: from the plinth's top, up and out, curling over the gear's rim at 142 degrees either side of the top
  for (const side of [-1, 1]) {
    const grip = (142 * Math.PI) / 180 * side, rim = P.tooth1 * R + 0.02 * R;
    const path = [
      [side * pr * 0.7, ph, 0],
      [side * 0.62 * R, ph + 0.22 * R, 0],
      [Math.sin(grip) * rim, cy + Math.cos(grip) * rim, 0],
      [Math.sin(grip) * (P.gear0 * R), cy + Math.cos(grip) * (P.gear0 * R) + 0.02 * R, 0],
    ];
    const widths = [0.11 * R, 0.085 * R, 0.06 * R, 0.035 * R], depth = 0.075 * R;
    for (let s = 0; s + 1 < path.length; s++) {
      const a = path[s], b = path[s + 1], d = sub(b, a), l = Math.hypot(d[0], d[1]) || 1, nrm = [-d[1] / l, d[0] / l, 0];
      const wa = widths[s] / 2, wb = widths[s + 1] / 2;
      const A = (p, w, z) => [p[0] + nrm[0] * w, p[1] + nrm[1] * w, z];
      const v0 = s / 3, v1 = (s + 1) / 3;
      for (const [z, want] of [[-depth, FRONT], [depth, BACK]]) quad(f, SD_RIFT_RECORD.lit, A(a, -wa, z), A(a, wa, z), A(b, wb, z), A(b, -wb, z), cell('claw', 0, v0), cell('claw', 1, v0), cell('claw', 1, v1), cell('claw', 0, v1), want);
      for (const sgn of [-1, 1]) quad(f, SD_RIFT_RECORD.lit, A(a, sgn * wa, -depth), A(b, sgn * wb, -depth), A(b, sgn * wb, depth), A(a, sgn * wa, depth), cell('claw', 0, v0), cell('claw', 0, v1), cell('claw', 0.3, v1), cell('claw', 0.3, v0), nrm.map((x) => x * sgn));
    }
  }
  const m = packRealmFaces(f);
  for (const sm of m.subMeshes) if (sm.textureRecord === FLOOR) { sm.textureArchive = fl.archive; sm.textureRecord = fl.record; }
  return m;
}

/** THE RETURN: a pale lancet arch, `w` x `h`, banded in tarnished silver, its keystone a small silver clock - its front
 *  -z, its foot the origin. Two jambs, the pointed arch in eight segments a side, a sill; its window is the pass's. */
export const SD_RETURN_ARCH = Object.freeze({ jamb: 0.16, depth: 0.22, segs: 8, spring: 0.62 });
export function buildReturnModel(w, h) {
  const f = faces(), A = SD_RETURN_ARCH, hw = w / 2, spring = h * A.spring, d = A.depth, rec = SD_RIFT_RECORD.lit;
  // the opening's edge: up the left jamb, over the lancet, down the right - (x, y) points
  const inner = [], outer = [];
  const lancet = (hwx, top) => {
    const pts = [];
    // the left half from the springing (-hwx, spring) to the apex (0, top), the right its mirror - a pointed arch
    for (let j = 0; j <= A.segs; j++) {
      const t = j / A.segs;
      // left half: from the springing (-hwx, spring) to the apex (0, top)
      pts.push([-hwx + hwx * Math.sin((t * Math.PI) / 2), spring + (top - spring) * (1 - Math.cos((t * Math.PI) / 2)) ** 0.9]);
    }
    for (let j = A.segs - 1; j >= 0; j--) { const p = pts[j]; pts.push([-p[0], p[1]]); }
    return pts;
  };
  const inPts = lancet(hw - A.jamb, h - A.jamb * 1.2), outPts = lancet(hw, h);
  inner.push([-(hw - A.jamb), 0], ...inPts, [hw - A.jamb, 0]);
  outer.push([-hw, 0], ...outPts, [hw, 0]);
  for (let j = 0; j + 1 < inner.length; j++) {
    const a = inner[j], b = inner[j + 1], c = outer[j + 1], e = outer[j];
    const band = j % 3 === 0 ? 'silver' : 'pale', s0 = j / (inner.length - 1), s1 = (j + 1) / (inner.length - 1);
    for (const [z, want] of [[-d, FRONT], [d, BACK]]) quad(f, rec, [a[0], a[1], z], [b[0], b[1], z], [c[0], c[1], z], [e[0], e[1], z], cell(band, s0, 0), cell(band, s1, 0), cell(band, s1, 1), cell(band, s0, 1), want);
    // the reveal, inside the opening, and the outer face
    const n = [b[1] - a[1], -(b[0] - a[0]), 0];
    quad(f, rec, [a[0], a[1], -d], [b[0], b[1], -d], [b[0], b[1], d], [a[0], a[1], d], cell('pale', s0, 0), cell('pale', s1, 0), cell('pale', s1, 0.4), cell('pale', s0, 0.4), n.map((x) => -x));
    const no = [c[1] - e[1], -(c[0] - e[0]), 0];
    quad(f, rec, [e[0], e[1], -d], [c[0], c[1], -d], [c[0], c[1], d], [e[0], e[1], d], cell('pale', s0, 0), cell('pale', s1, 0), cell('pale', s1, 0.4), cell('pale', s0, 0.4), no);
  }
  // the sill
  const sh = 0.08;
  quad(f, rec, [-hw - 0.05, sh, -d - 0.05], [hw + 0.05, sh, -d - 0.05], [hw + 0.05, sh, d + 0.05], [-hw - 0.05, sh, d + 0.05], cell('pale', 0, 0), cell('pale', 1, 0), cell('pale', 1, 0.3), cell('pale', 0, 0.3), [0, 1, 0]);
  quad(f, rec, [-hw - 0.05, 0, -d - 0.05], [hw + 0.05, 0, -d - 0.05], [hw + 0.05, sh, -d - 0.05], [-hw - 0.05, sh, -d - 0.05], cell('pale', 0, 0), cell('pale', 1, 0), cell('pale', 1, 0.2), cell('pale', 0, 0.2), FRONT);
  // the keystone's clock: a silver disc on the front, over the apex
  const kc = [0, h - A.jamb * 0.2, -d - 0.012], kr = 0.13;
  for (let j = 0; j < 12; j++) {
    const a0 = (j / 12) * Math.PI * 2, a1 = ((j + 1) / 12) * Math.PI * 2;
    tri(f, rec, kc, [kc[0] + Math.sin(a0) * kr, kc[1] + Math.cos(a0) * kr, kc[2]], [kc[0] + Math.sin(a1) * kr, kc[1] + Math.cos(a1) * kr, kc[2]], cell('dial', 0.5, 0.5), cell('dial', 0.5 + 0.5 * Math.sin(a0), 0.5 + 0.5 * Math.cos(a0)), cell('dial', 0.5 + 0.5 * Math.sin(a1), 0.5 + 0.5 * Math.cos(a1)), FRONT);
  }
  return packRealmFaces(f);
}
/** The keystone clock's hand, about the dial's centre (its own origin): a sliver of silver pointing up. */
export function buildReturnHand() {
  const f = faces();
  quad(f, SD_RIFT_RECORD.lit, [-0.012, -0.015, 0], [0.012, -0.015, 0], [0.006, 0.11, 0], [-0.006, 0.11, 0], cell('silver', 0, 0), cell('silver', 1, 0), cell('silver', 1, 1), cell('silver', 0, 1), FRONT);
  return packRealmFaces(f);
}
/** Where the keystone's dial stands on the Return of height h (its own frame). */
export const returnDialAt = (h) => [0, h - SD_RETURN_ARCH.jamb * 0.2, -SD_RETURN_ARCH.depth - 0.016];
