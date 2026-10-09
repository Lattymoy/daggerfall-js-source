// @ts-check
// SD-LOOK S10 (2026-10-09, the Abyss Dungeon's look; bible/11-Multiplayer/Super-Dungeons-Look.md section 7): THE ORRERY
// OVERHEAD - six great brass rings nested about an axle that hangs from the dark over the hall's dial, each carrying its
// Ending's medallion, and at the axle's foot, 7 m over the dial's centre, the Mantella soul-gem whose light is the dial's
// count. Pure: the meshes in their own frames and the matrices that hang them (scenes/sdHall.js stands and moves them).
//
// MODE A, the law-safe default (Mac's ruling taken at its default; Super-Dungeons.md section 8: "the gearing is not shown;
// it is learned by turning"): the rings hang still at their own tilts and tick together once every SD_RING_TICK_S as
// decor - they NEVER show a stone's hour and never move on a turn, a partner's or any. Their angle is a function of the
// realm's clock, the fray's share (they shiver past three quarters), the snap (one whole turn back on the toll) and the
// Concord (their tilts eased to nought: one plane) - never of the stones. Mode B (each ring following its stone's shown
// hour) is not built: it waits on Mac's word.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { SD_ORRERY, SD_STONES, realmToDungeon } from '../net/sdBrain.js';
import { faces } from './gateModel.js';
import { packRealmFaces, SD_REALM_BRASS_RECORD } from './sdRealm.js';
import { SD_HALL_ATLAS, SD_HALL_ATLAS_RECORD, SD_HALL_GEM_RECORD, atlasUv } from './sdHallArt.js';
import { SD_TICK_EASE_S } from './sdLook.js';
import { rng } from './sdPixelKit.js';

/** THE RINGS: ring k's radius `r0 + dr k` (m), its band `w` wide and `t` thick, round in `segs`, its medallion and its
 *  pins; hung about the hub `hubY` over the dial, their tilts seeded between `tilt0` and `tilt1` degrees. */
export const SD_ORRERY_RINGS = Object.freeze({ r0: 6, dr: 1.2, w: 0.35, t: 0.12, segs: 48, medallion: 0.9, pin: 0.25, hubY: 12.5, tilt0: 12, tilt1: 40 });
/** THE HUB: an axle of eight from `top` down to the gem, the gem's equator at `gemY` (7 m over the dial's centre), its
 *  half-width and its points over and under. Nothing reaches the floor: the collider is unchanged. */
export const SD_ORRERY_HUB = Object.freeze({ top: 18, axle: 0.12, gemY: 7, gemR: 0.32, gemUp: 0.45, gemDown: 0.6 });
/** MODE A's decor: the rings tick together once every SD_RING_TICK_S, each SD_RING_TICK_DEG on its own way, eased as the
 *  escapement is (world/sdLook.js SD_TICK_EASE_S) and held. Past three quarters of the fray they shiver - SD_RING_SHIVER
 *  degrees at SD_RING_SHIVER_HZ (at or under 2 Hz: motion, never a flash). The snap turns them one whole turn back over
 *  SD_RING_SNAP_S; the Concord eases their tilts to nought over SD_RING_CONCORD_S. */
export const SD_RING_TICK_S = 6;
export const SD_RING_TICK_DEG = 7.5;
export const SD_RING_SHIVER = 1.5;
export const SD_RING_SHIVER_HZ = 1.8;
export const SD_RING_SNAP_S = 0.8;
export const SD_RING_CONCORD_S = 1.2;
/** Whether the rings follow their stones (mode B) - false: mode A ships, and mode B is not built. */
export const SD_ORRERY_MODE_B = false;

/** Ring k's radius. */
export const ringRadius = (k) => SD_ORRERY_RINGS.r0 + SD_ORRERY_RINGS.dr * k;
/** THE RINGS' HANG for slot `s`: each one's tilt (radians, within the seeded span), the bearing of its tilt's axis, and
 *  which way it ticks - drawn from the slot, so every screen hangs a Hollow's orrery alike. */
export function ringHang(s) {
  const r = rng(((s >>> 0) * 0x9e3779b1) ^ 0x0de1a7), R = SD_ORRERY_RINGS, out = [];
  for (let k = 0; k < SD_STONES.length; k++) out.push(Object.freeze({ tilt: ((R.tilt0 + (R.tilt1 - R.tilt0) * r()) * Math.PI) / 180, axis: r() * Math.PI * 2, dir: k % 2 === 0 ? 1 : -1 }));
  return Object.freeze(out);
}
/** The decor's ticks at clock `t` (s): whole at every SD_RING_TICK_S, eased over its first SD_TICK_EASE_S, held. */
export function ringTicks(t) {
  const u = Math.floor(t / SD_RING_TICK_S), e = Math.min(1, Math.max(0, (t - u * SD_RING_TICK_S) / SD_TICK_EASE_S));
  return u + e * e * (3 - 2 * e);
}
const ease = (x) => { const e = Math.max(0, Math.min(1, x)); return e * e * (3 - 2 * e); };
/**
 * MODE A: ring k's spin and tilt - `state` a Float64Array [t, fray, snapAge, concordAge]: the realm's clock (s), the
 * fray's share of its snap (0..1), seconds since the Hour snapped back (< 0 or past: none), seconds since the Concord was
 * heard (Infinity: it held before I came; < 0: none). Into `out` [spin, tilt] (radians; a Float64Array keeps a frame's
 * numbers unboxed). No stone's hour and no turn is read: a ring follows only its own decor.
 */
export function ringPoseInto(k, hang, state, out) {
  const h = hang[k], t = state[0], fray = state[1], snapAge = state[2], concordAge = state[3];
  let spin = h.dir * ringTicks(t) * ((SD_RING_TICK_DEG * Math.PI) / 180);
  if (snapAge >= 0 && snapAge < SD_RING_SNAP_S) spin -= ease(snapAge / SD_RING_SNAP_S) * Math.PI * 2;
  let tilt = h.tilt;
  if (fray > 0.75) tilt += ((SD_RING_SHIVER * Math.PI) / 180) * Math.sin(Math.PI * 2 * SD_RING_SHIVER_HZ * t + k * 1.7);
  if (concordAge >= 0) tilt *= 1 - ease(concordAge / SD_RING_CONCORD_S);
  out[0] = spin; out[1] = tilt;
  return out;
}
const _state = new Float64Array(4);
/** ringPoseInto from plain numbers (tests, the lab): [spin, tilt]. */
export function ringPose(k, hang, t, fray, snapAge, concordAge, out = new Float64Array(2)) {
  _state[0] = t; _state[1] = fray; _state[2] = snapAge; _state[3] = concordAge;
  return ringPoseInto(k, hang, _state, out);
}
const HUB = realmToDungeon(SD_ORRERY.x, 0, SD_ORRERY.z);
/** Ring k's matrix: T(hub) R_tilt(about its axis) R_y(spin) - `pose` [spin, tilt] (ringPoseInto's) - column-major, the
 *  dungeon's frame, into `out`. */
export function ringMatrix(k, hang, pose, out = new Float32Array(16)) {
  const spin = pose[0], tilt = pose[1], a = hang[k].axis, ax = Math.cos(a), az = Math.sin(a), c = Math.cos(tilt), s = Math.sin(tilt), C = 1 - c;
  // R_tilt about the horizontal axis (ax, 0, az) (Rodrigues), rows
  const t00 = c + ax * ax * C, t01 = -az * s, t02 = ax * az * C;
  const t10 = az * s, t11 = c, t12 = -ax * s;
  const t20 = az * ax * C, t21 = ax * s, t22 = c + az * az * C;
  const cy = Math.cos(spin), sy = Math.sin(spin);
  // R_y(spin) columns: (cy, 0, -sy), (0, 1, 0), (sy, 0, cy); the product's columns are R_tilt times them
  out[0] = t00 * cy - t02 * sy; out[1] = t10 * cy - t12 * sy; out[2] = t20 * cy - t22 * sy; out[3] = 0;
  out[4] = t01; out[5] = t11; out[6] = t21; out[7] = 0;
  out[8] = t00 * sy + t02 * cy; out[9] = t10 * sy + t12 * cy; out[10] = t20 * sy + t22 * cy; out[11] = 0;
  out[12] = HUB[0]; out[13] = HUB[1] + SD_ORRERY_RINGS.hubY; out[14] = HUB[2]; out[15] = 1;
  return out;
}
/** The hub's matrix: over the dial's centre, turned `spin` about its axle. */
export function hubMatrix(spin, out = new Float32Array(16)) {
  const c = Math.cos(spin), s = Math.sin(spin);
  out.fill(0); out[0] = c; out[2] = -s; out[5] = 1; out[8] = s; out[10] = c; out[12] = HUB[0]; out[13] = HUB[1]; out[14] = HUB[2]; out[15] = 1;
  return out;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** A quad into `f`, wound to face `want`. */
function quad(f, rec, a, b, c, d, ua, ub, uc, ud, want) {
  if (dot(cross(sub(b, a), sub(c, a)), want) >= 0) f.quad(rec, a, b, c, d, ua, ub, uc, ud);
  else f.quad(rec, d, c, b, a, ud, uc, ub, ua);
}
function tri(f, rec, a, b, c, ua, ub, uc, want) {
  if (dot(cross(sub(b, a), sub(c, a)), want) >= 0) f.tri(rec, a, b, c, ua, ub, uc);
  else f.tri(rec, c, b, a, uc, ub, ua);
}

/**
 * RING k in its own frame (its plane the x-z plane, centred on the origin): a brass band SD_ORRERY_RINGS.w across and t
 * thick round in `segs` (its top, its underside, its outer and inner faces), its Ending's medallion on +x - a disc in its
 * plane, the emblem both ways (the stone's own relief from the atlas) - and two pins out on its z axis.
 * @param {number} k
 * @param {number} [segs]
 */
export function buildOrbitRing(k, segs = SD_ORRERY_RINGS.segs) {
  const f = faces(), R = SD_ORRERY_RINGS, rad = ringRadius(k), a = rad - R.w / 2, b = rad + R.w / 2, h = R.t / 2, rec = SD_REALM_BRASS_RECORD;
  const P = (r, th, y) => [r * Math.cos(th), y, r * Math.sin(th)];
  for (let s = 0; s < segs; s++) {
    const t0 = (s / segs) * Math.PI * 2, t1 = ((s + 1) / segs) * Math.PI * 2, u0 = (s / segs) * rad, u1 = ((s + 1) / segs) * rad;
    const mid = (t0 + t1) / 2, out = [Math.cos(mid), 0, Math.sin(mid)];
    quad(f, rec, P(a, t0, h), P(b, t0, h), P(b, t1, h), P(a, t1, h), [u0, 0], [u0, 0.17], [u1, 0.17], [u1, 0], [0, 1, 0]);
    quad(f, rec, P(a, t0, -h), P(b, t0, -h), P(b, t1, -h), P(a, t1, -h), [u0, 0], [u0, 0.17], [u1, 0.17], [u1, 0], [0, -1, 0]);
    quad(f, rec, P(b, t0, -h), P(b, t0, h), P(b, t1, h), P(b, t1, -h), [u0, 0], [u0, 0.06], [u1, 0.06], [u1, 0], out);
    quad(f, rec, P(a, t0, -h), P(a, t0, h), P(a, t1, h), P(a, t1, -h), [u0, 0], [u0, 0.06], [u1, 0.06], [u1, 0], [-out[0], 0, -out[2]]);
  }
  // the medallion: a disc of sixteen on +x, a hair over and under the band, its emblem read from below and from above
  const cell = SD_HALL_ATLAS.emblem[k], m = R.medallion / 2;
  for (const side of [1, -1]) {
    const y = side * (h + 0.01), C = [rad, y, 0];
    for (let s = 0; s < 16; s++) {
      const t0 = (s / 16) * Math.PI * 2, t1 = ((s + 1) / 16) * Math.PI * 2;
      const pa = [rad + m * Math.cos(t0), y, m * Math.sin(t0)], pb = [rad + m * Math.cos(t1), y, m * Math.sin(t1)];
      // u along -z seen from below (+z from above), v outward: the sign upright to one under the ring looking out
      const uv = (t) => atlasUv(cell, 0.5 - 0.5 * side * Math.sin(t), 0.5 + 0.5 * Math.cos(t));
      tri(f, SD_HALL_ATLAS_RECORD, C, pa, pb, atlasUv(cell, 0.5, 0.5), uv(t0), uv(t1), [0, side, 0]);
    }
  }
  for (let s = 0; s < 16; s++) {   // the medallion's rim
    const t0 = (s / 16) * Math.PI * 2, t1 = ((s + 1) / 16) * Math.PI * 2, y0 = -h - 0.01, y1 = h + 0.01;
    const A = (t, y) => [rad + m * Math.cos(t), y, m * Math.sin(t)];
    quad(f, rec, A(t0, y0), A(t0, y1), A(t1, y1), A(t1, y0), [0, 0], [0, 0.07], [0.1, 0.07], [0.1, 0], [Math.cos((t0 + t1) / 2), 0, Math.sin((t0 + t1) / 2)]);
  }
  // the pins, out from the band on its z axis
  for (const sz of [1, -1]) {
    const z0 = sz * b, z1 = sz * (b + R.pin), w = 0.06;
    const B = (x, y, z) => [x, y, z];
    quad(f, rec, B(-w, w, z0), B(w, w, z0), B(w, w, z1), B(-w, w, z1), [0, 0], [0, 0.1], [0.1, 0.1], [0.1, 0], [0, 1, 0]);
    quad(f, rec, B(-w, -w, z0), B(w, -w, z0), B(w, -w, z1), B(-w, -w, z1), [0, 0], [0, 0.1], [0.1, 0.1], [0.1, 0], [0, -1, 0]);
    quad(f, rec, B(w, -w, z0), B(w, w, z0), B(w, w, z1), B(w, -w, z1), [0, 0], [0, 0.1], [0.1, 0.1], [0.1, 0], [1, 0, 0]);
    quad(f, rec, B(-w, -w, z0), B(-w, w, z0), B(-w, w, z1), B(-w, -w, z1), [0, 0], [0, 0.1], [0.1, 0.1], [0.1, 0], [-1, 0, 0]);
    quad(f, rec, B(-w, -w, z1), B(w, -w, z1), B(w, w, z1), B(-w, w, z1), [0, 0], [0, 0.1], [0.1, 0.1], [0.1, 0], [0, 0, sz]);
  }
  return packRealmFaces(f);
}
/**
 * THE HUB, in its own frame (y over the dial's centre): an axle of eight from SD_ORRERY_HUB.top down to the gem, a collar
 * at its foot, and THE SOUL-GEM - twelve facets about its equator at gemY, in the gem's count-0 record (the scene swaps
 * its count by texRemap: how many, never which).
 */
export function buildOrreryHub() {
  const f = faces(), H = SD_ORRERY_HUB, rec = SD_REALM_BRASS_RECORD, g0 = H.gemY + H.gemUp;
  const P = (r, th, y) => [r * Math.sin(th), y, r * Math.cos(th)];
  for (let s = 0; s < 8; s++) {
    const t0 = (s / 8) * Math.PI * 2, t1 = ((s + 1) / 8) * Math.PI * 2, mid = (t0 + t1) / 2, out = [Math.sin(mid), 0, Math.cos(mid)];
    quad(f, rec, P(H.axle, t0, g0), P(H.axle, t0, H.top), P(H.axle, t1, H.top), P(H.axle, t1, g0), [s / 8, 0], [s / 8, 5], [(s + 1) / 8, 5], [(s + 1) / 8, 0], out);
    quad(f, rec, P(0.2, t0, g0 - 0.05), P(0.2, t0, g0 + 0.12), P(0.2, t1, g0 + 0.12), P(0.2, t1, g0 - 0.05), [0, 0], [0, 0.08], [0.1, 0.08], [0.1, 0], out);
    tri(f, rec, [0, g0 - 0.05, 0], P(0.2, t0, g0 - 0.05), P(0.2, t1, g0 - 0.05), [0, 0], [0.1, 0], [0.1, 0.1], [0, -1, 0]);
    quad(f, rec, P(H.axle, t0, g0 + 0.12), P(0.2, t0, g0 + 0.12), P(0.2, t1, g0 + 0.12), P(H.axle, t1, g0 + 0.12), [0, 0], [0, 0.05], [0.1, 0.05], [0.1, 0], [0, 1, 0]);
  }
  const gem = SD_HALL_GEM_RECORD, top = [0, H.gemY + H.gemUp, 0], bot = [0, H.gemY - H.gemDown, 0];
  for (let s = 0; s < 6; s++) {
    const t0 = (s / 6) * Math.PI * 2, t1 = ((s + 1) / 6) * Math.PI * 2, mid = (t0 + t1) / 2;
    const a = P(H.gemR, t0, H.gemY), b = P(H.gemR, t1, H.gemY);
    tri(f, gem, top, a, b, [0.5, 1], [0, 0.5], [1, 0.5], [Math.sin(mid), 0.6, Math.cos(mid)]);
    tri(f, gem, bot, a, b, [0.5, 0], [0, 0.5], [1, 0.5], [Math.sin(mid), -0.5, Math.cos(mid)]);
  }
  return packRealmFaces(f);
}
/** The gem's centre in the dungeon's frame (where its light and its halo stand). */
export const gemCentre = () => realmToDungeon(SD_ORRERY.x, SD_ORRERY_HUB.gemY, SD_ORRERY.z);
