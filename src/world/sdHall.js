// @ts-check
// SD6c (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 8): THE ORRERY'S HALL, MADE -
// where its parts stand and the meshes they are, in the realm's frame (net/sdBrain.js) and drawn in the dungeon's.
// Pure: the scene (scenes/sdHall.js) uploads, stands and moves them.
//
//   THE STONES - six slabs on the hall's ring (net/sdBrain.js SD_STONE_POS), each facing the hall's centre: its dial at
//     chest height with a brass notch over its twelfth hour, its sign above, a brass cap, and TWO HANDLES - the right
//     (as you face it) turns it forward, the left back. Each stone's HAND is its own mesh, turned on its dial by a
//     matrix of its own (handMatrix): clockwise as you face it, the twelfth hour straight up.
//   THE LEDGER PLAQUES - six bronze tablets on posts round the rim, facing in, numbered by pips - none on the walk in or
//     the way on.
//   THE DIAL'S LIGHT - the six segments the Hour-dial carries (world/sdRealmArt.js) lit in the Mantella's green, one for
//     each stone at its true hour (how many, not which), clockwise from the twelfth; and THE FRAY, an ember arc just
//     inside the rim growing clockwise a step a turn, all the way round at the snap.
//   THE BRIDGE - a band of light from the hall's rim on its way on (+z) to THE FIRST STEP, an island of the Steps (SD7)
//     hanging past it. The step is there from the first; the bridge, and both as floors for the edge, with the Concord.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { SD_ORRERY, SD_STONES, SD_STONE_POS, SD_STONE_BEARINGS, realmToDungeon } from '../net/sdBrain.js';
import { faces } from './gateModel.js';
import { realmIsland, packRealmFaces, SD_REALM_FLOOR_RECORD, SD_REALM_BRASS_RECORD, SD_REALM_ROOT_RECORD, SD_ISLAND_SIDES } from './sdRealm.js';
import { SD_HALL_FACE_RECORD, SD_HALL_EMBLEM_RECORD, SD_HALL_PLAQUE_RECORD, SD_HALL_GLOW_RECORD } from './sdHallArt.js';

const deg = (d) => (d * Math.PI) / 180;
/** A stone's slab: across its face, through it, and tall (m). */
export const SD_STONE_SIZE = Object.freeze({ w: 1.6, d: 0.7, h: 2.6 });
/** Its dial: the centre's height on the face, and its radius. */
export const SD_DIAL = Object.freeze({ y: 1.55, r: 0.5 });
/** A hand: from the dial's centre to its point, behind it, its width, the hub's, and how far it stands off the face. */
export const SD_HAND = Object.freeze({ len: 0.42, tail: 0.1, w: 0.06, hub: 0.065, off: 0.03 });
/** The sign above the dial: its centre's height and its half-size. */
export const SD_EMBLEM = Object.freeze({ y: 2.2, half: 0.28 });
/** The handles: their height, how far they stand out from the face, how far in from its edges, and their activation
 *  box's half-size. */
export const SD_HANDLE = Object.freeze({ y: 1.2, out: 0.14, inset: 0.14, reach: 0.25 });
/** The plaques: their ring, size, post, and bearings from +z (degrees) - numbered I to VI by these, clockwise from the
 *  walk in; none on the walk in (180) or the way on (0). */
export const SD_PLAQUE = Object.freeze({ r: 16.4, w: 1.0, h: 0.7, post: 0.95, bearings: Object.freeze([200, 240, 300, 60, 120, 160]) });
/** The dial's six segments (world/sdRealmArt.js realmDialArt's ring: half its radius to 0.56 of it, each two hours wide
 *  about an odd hour), lit from the twelfth clockwise; and the fray's ring just inside the rim, 48 steps round. */
export const SD_LIT_RING = Object.freeze({ r0: 0.5 * SD_ORRERY.r, r1: 0.56 * SD_ORRERY.r, halfHours: 0.84, y: 0.012 });
export const SD_FRAY_RING = Object.freeze({ r0: SD_ORRERY.r - 0.75, r1: SD_ORRERY.r - 0.4, steps: 48, gap: deg(0.8), y: 0.012 });
/** THE FIRST STEP - the first island of the Unmoored Steps (SD7's first checkpoint) - and THE BRIDGE the Concord lays to
 *  it from the hall's rim on its way on, a hand's breadth over the floor it crosses. */
export const SD_FIRST_STEP = Object.freeze({ x: 0, z: 72, r: 3 });
export const SD_BRIDGE = Object.freeze({ x: 0, z0: SD_ORRERY.z + SD_ORRERY.r - 0.5, z1: SD_FIRST_STEP.z - SD_FIRST_STEP.r + 0.5, halfW: 1.5, y: 0.02 });
/** The floors the Concord adds to the edge's (world/sdRealm.js realmClamp's shapes). */
export const SD_HALL_FLOORS = Object.freeze([
  Object.freeze({ kind: 'band', x: SD_BRIDGE.x, z0: SD_BRIDGE.z0, z1: SD_BRIDGE.z1, halfW: SD_BRIDGE.halfW }),
  Object.freeze({ kind: 'disc', ...SD_FIRST_STEP }),
]);

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const UP = [0, 1, 0];

/**
 * A stone's frame in the realm's: its foot's centre `at`, `n` the way its face looks (toward the hall's centre), and `R`
 * the right of one who faces it (up x n: the right of a camera looking along -n, render/mat4 lookAt's own).
 */
export function stoneFrame(i) {
  const b = SD_STONE_BEARINGS[i], p = SD_STONE_POS[i];
  const n = [-Math.sin(b), 0, -Math.cos(b)];
  return { at: [p.x, 0, p.z], n, R: [n[2], 0, -n[0]] };
}
/** The point on a stone's face (the realm's frame) `right` across, `up` high, `out` before it. */
export function stonePoint(i, right, up, out = 0) {
  const { at, n, R } = stoneFrame(i);
  return add(add(add(at, mul(n, SD_STONE_SIZE.d / 2 + out)), mul(R, right)), [0, up, 0]);
}
/** A plaque's frame: its foot `at` on the rim, `n` facing in, `R` the right of one who faces it. */
export function plaqueFrame(k) {
  const b = deg(SD_PLAQUE.bearings[k]);
  const n = [-Math.sin(b), 0, -Math.cos(b)];
  return { at: [SD_ORRERY.x + SD_PLAQUE.r * Math.sin(b), 0, SD_ORRERY.z + SD_PLAQUE.r * Math.cos(b)], n, R: [n[2], 0, -n[0]] };
}

/** A face standing up: `c` its bottom middle (the realm's frame), across `R`, out `n` (R x up = n), w by h, `uv` its
 *  texture's corners - wound so it faces `n`. */
function upright(f, rec, c, R, w, h, uv = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
  const T = (p) => realmToDungeon(p[0], p[1], p[2]);
  const bl = add(c, mul(R, -w / 2)), br = add(c, mul(R, w / 2));
  f.quad(rec, T(bl), T(br), T(add(br, mul(UP, h))), T(add(bl, mul(UP, h))), ...uv);
}
/** A box (a cap, a handle, a post): its bottom middle `c`, its axes `R` and `n`, half-sizes, its top a face too. */
function box(f, rec, c, R, n, hw, hd, h) {
  for (const [N, A, half, across] of [[n, R, hd, hw], [mul(n, -1), mul(R, -1), hd, hw], [R, mul(n, -1), hw, hd], [mul(R, -1), n, hw, hd]])
    upright(f, rec, add(c, mul(N, half)), A, across * 2, h);
  const T = (p) => realmToDungeon(p[0], p[1], p[2]);
  const top = add(c, [0, h, 0]);
  const p = (a, b) => T(add(add(top, mul(R, a * hw)), mul(n, b * hd)));
  f.quad(rec, p(-1, 1), p(1, 1), p(1, -1), p(-1, -1), [0, 0], [1, 0], [1, 1], [0, 1]);
}

/**
 * THE HALL'S STANDING PARTS, one mesh (renderer.createMesh's model shape, the dungeon's frame, sub-meshes by record):
 * the six stones - slab, cap, dial, notch, sign and handles - the six plaques on their posts, and the first step.
 */
export function buildHallModel() {
  const f = faces();
  const { w, d, h } = SD_STONE_SIZE;
  for (let i = 0; i < SD_STONES.length; i++) {
    const { at, n, R } = stoneFrame(i);
    // the slab, and its brass cap
    box(f, SD_REALM_ROOT_RECORD, at, R, n, w / 2, d / 2, h);
    box(f, SD_REALM_BRASS_RECORD, add(at, [0, h, 0]), R, n, w / 2 + 0.05, d / 2 + 0.05, 0.12);
    // the dial, a hair before the face; the notch over its twelfth hour; the sign above
    upright(f, SD_HALL_FACE_RECORD, stonePoint(i, 0, SD_DIAL.y - SD_DIAL.r, 0.005), R, SD_DIAL.r * 2, SD_DIAL.r * 2);
    const T = (p) => realmToDungeon(p[0], p[1], p[2]);
    const tip = stonePoint(i, 0, SD_DIAL.y + SD_DIAL.r + 0.01, 0.01);   // the notch points down at the twelfth hour
    f.tri(SD_REALM_BRASS_RECORD, T(tip), T(add(add(tip, [0, 0.12, 0]), mul(R, 0.07))), T(add(add(tip, [0, 0.12, 0]), mul(R, -0.07))), [0.5, 0], [1, 1], [0, 1]);
    upright(f, SD_HALL_EMBLEM_RECORD + i, stonePoint(i, 0, SD_EMBLEM.y - SD_EMBLEM.half, 0.005), R, SD_EMBLEM.half * 2, SD_EMBLEM.half * 2);
    // the two handles, out from the face's edges
    for (const side of [-1, 1]) box(f, SD_REALM_BRASS_RECORD, handleFoot(i, side), R, n, 0.06, SD_HANDLE.out / 2, 0.22);
  }
  for (let k = 0; k < SD_PLAQUE.bearings.length; k++) {
    const { at, n, R } = plaqueFrame(k);
    box(f, SD_REALM_BRASS_RECORD, at, R, n, 0.07, 0.07, SD_PLAQUE.post);
    upright(f, SD_HALL_PLAQUE_RECORD + k, add(at, add(mul(n, 0.09), [0, SD_PLAQUE.post, 0])), R, SD_PLAQUE.w, SD_PLAQUE.h);
    upright(f, SD_REALM_BRASS_RECORD, add(at, add(mul(n, 0.07), [0, SD_PLAQUE.post, 0])), mul(R, -1), SD_PLAQUE.w, SD_PLAQUE.h);
  }
  realmIsland(f, SD_FIRST_STEP.x, SD_FIRST_STEP.z, SD_FIRST_STEP.r, SD_REALM_FLOOR_RECORD, { lean: -1 });
  return packRealmFaces(f);
}
/** A handle's foot (the realm's frame): `side` 1 the right of one facing the stone (forward), -1 the left (back). */
export const handleFoot = (i, side) => stonePoint(i, side * (SD_STONE_SIZE.w / 2 - SD_HANDLE.inset), SD_HANDLE.y - 0.11, SD_HANDLE.out / 2);
/** A handle's activation box, the dungeon's frame. */
export function handleBox(i, side) {
  const c = realmToDungeon(...add(handleFoot(i, side), [0, 0.11, 0]));
  const r = SD_HANDLE.reach;
  return { min: [c[0] - r, c[1] - r, c[2] - r], max: [c[0] + r, c[1] + r, c[2] + r] };
}
/** A plaque's activation box, the dungeon's frame. */
export function plaqueBox(k) {
  const { at, n } = plaqueFrame(k);
  const c = realmToDungeon(...add(at, add(mul(n, 0.09), [0, SD_PLAQUE.post + SD_PLAQUE.h / 2, 0])));
  const r = SD_PLAQUE.w / 2;
  return { min: [c[0] - r, c[1] - SD_PLAQUE.h / 2, c[2] - r], max: [c[0] + r, c[1] + SD_PLAQUE.h / 2, c[2] + r] };
}
/** A dial's centre, the dungeon's frame - where a stone's turn is heard. */
export const dialCentre = (i) => realmToDungeon(...stonePoint(i, 0, SD_DIAL.y, 0));

/** A HAND, in its own frame: from its hub along +y to its point (the twelfth hour), facing +z; brass alight. */
export function buildHandModel() {
  const f = faces();
  const { len, tail, w, hub } = SD_HAND, rec = SD_HALL_GLOW_RECORD.brass;
  f.quad(rec, [-w / 2, -tail, 0], [w / 2, -tail, 0], [w * 0.15, len, 0], [-w * 0.15, len, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2;
    f.tri(rec, [0, 0, 0.002], [Math.cos(a0) * hub, Math.sin(a0) * hub, 0.002], [Math.cos(a1) * hub, Math.sin(a1) * hub, 0.002], [0.5, 0.5], [1, 0.5], [1, 1]);
  }
  return packRealmFaces(f);
}
/**
 * A hand's place on stone `i` at `hour` (0 to 12, fractions between): the matrix that stands the hand's own frame on the
 * dial - turned CLOCKWISE as one facing the stone sees it, the twelfth hour straight up (column-major, the dungeon's
 * frame).
 */
export function handMatrix(i, hour) {
  const { n, R } = stoneFrame(i);
  const t = ((hour % 12) / 12) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
  const x = [R[0] * c - UP[0] * s, R[1] * c - UP[1] * s, R[2] * c - UP[2] * s];   // its own +x: across, turned
  const y = [R[0] * s + UP[0] * c, R[1] * s + UP[1] * c, R[2] * s + UP[2] * c];   // its own +y: to its point, turned
  const o = realmToDungeon(...stonePoint(i, 0, SD_DIAL.y, SD_HAND.off));
  return new Float32Array([x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, n[0], n[1], n[2], 0, o[0], o[1], o[2], 1]);
}

/** A flat ring's arc on the hall's floor, from bearing `b0` to `b1` (radians from +z), wound to face up. */
function arc(f, rec, r0, r1, b0, b1, y, steps) {
  const P = (r, b) => realmToDungeon(SD_ORRERY.x + r * Math.sin(b), y, SD_ORRERY.z + r * Math.cos(b));
  for (let k = 0; k < steps; k++) {
    const a = b0 + ((b1 - b0) * k) / steps, b = b0 + ((b1 - b0) * (k + 1)) / steps;
    // bearings run clockwise seen from above, so outer-a, outer-b, inner-b faces up
    f.quad(rec, P(r1, a), P(r1, b), P(r0, b), P(r0, a), [0, 0], [1, 0], [1, 1], [0, 1]);
  }
}
/** THE DIAL'S LIGHT for `n` stones at their true hours: the first `n` segments, clockwise from the twelfth - or null. */
export function buildLitModel(n) {
  if (!(n > 0)) return null;
  const f = faces(), { r0, r1, halfHours, y } = SD_LIT_RING;
  for (let k = 0; k < Math.min(n, SD_STONES.length); k++) {
    const mid = deg((2 * k + 1) * 30), half = deg(halfHours * 30);
    arc(f, SD_HALL_GLOW_RECORD.mantella, r0, r1, mid - half, mid + half, y, 6);
  }
  return packRealmFaces(f);
}
/** THE FRAY after `fray` turns: that many of its 48 steps, clockwise from the twelfth - or null. */
export function buildFrayModel(fray) {
  if (!(fray > 0)) return null;
  const f = faces(), { r0, r1, steps, gap, y } = SD_FRAY_RING, step = (Math.PI * 2) / steps;
  for (let k = 0; k < Math.min(fray, steps); k++) arc(f, SD_HALL_GLOW_RECORD.fray, r0, r1, k * step + gap / 2, (k + 1) * step - gap / 2, y, 1);
  return packRealmFaces(f);
}
/** THE BRIDGE of light, from the hall's rim to the first step. */
export function buildBridgeModel() {
  const f = faces(), { x, z0, z1, halfW: hw, y } = SD_BRIDGE;
  const T = (xx, zz) => realmToDungeon(xx, y, zz);
  f.quad(SD_HALL_GLOW_RECORD.mantella, T(x - hw, z0), T(x - hw, z1), T(x + hw, z1), T(x + hw, z0), [0, 0], [0, 4], [1, 4], [1, 0]);
  return packRealmFaces(f);
}
/** THE FLOORS THE HALL ADDS, for the collider: the bridge's band and the first step's disc (the dungeon's frame). The edge
 *  keeps a body off them until the Concord (world/sdRealm.js realmClamp; SD_HALL_FLOORS then). */
export function hallFloorTris() {
  const out = [];
  const { x, z0, z1, halfW: hw } = SD_BRIDGE;
  const a = realmToDungeon(x - hw, 0, z0), b = realmToDungeon(x - hw, 0, z1), c = realmToDungeon(x + hw, 0, z1), e = realmToDungeon(x + hw, 0, z0);
  out.push(...a, ...b, ...c, ...a, ...c, ...e);
  const { x: cx, z: cz, r } = SD_FIRST_STEP;
  for (let k = 0; k < SD_ISLAND_SIDES; k++) {
    const a0 = (k / SD_ISLAND_SIDES) * Math.PI * 2, a1 = ((k + 1) / SD_ISLAND_SIDES) * Math.PI * 2;
    out.push(...realmToDungeon(cx, 0, cz), ...realmToDungeon(cx + Math.cos(a1) * r, 0, cz + Math.sin(a1) * r), ...realmToDungeon(cx + Math.cos(a0) * r, 0, cz + Math.sin(a0) * r));
  }
  return new Float32Array(out);
}
