// @ts-check
// SD6c (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 8): THE ORRERY'S HALL, MADE -
// where its parts stand and the meshes they are, in the realm's frame (net/sdBrain.js) and drawn in the dungeon's.
// Pure: the scene (scenes/sdHall.js) uploads, stands and moves them.
//
//   THE STONES - six on the hall's ring (net/sdBrain.js SD_STONE_POS), each facing the hall's centre: its dial at chest
//     height with a brass notch over its twelfth hour, its sign above, a brass cap, and TWO HANDLES - the right (as you
//     face it) turns it forward, the left back. Each stone's HAND is its own mesh, turned on its dial by a matrix of its
//     own (handMatrix): clockwise as you face it, the twelfth hour straight up. The law's slabs, caps and handles, and
//     the plaques' posts and tablets, are solid (hallSolidTris - AUDIT SD II).
//   THE LEDGER PLAQUES - six on the rim, facing in, numbered by pips - none on the walk in or the way on.
//   THE DIAL'S LIGHT - the six segments the Hour-dial carries lit in the Mantella's green, one for each stone at its true
//     hour (how many, not which), clockwise from the twelfth; and THE FRAY round the rim, a step a turn.
//   THE BRIDGE - from the hall's rim on its way on (+z) to THE FIRST STEP, an island of the Steps (SD7) hanging past it.
//     The step is there from the first; the bridge, and both as floors for the edge, with the Concord.
//
// SD-LOOK S10 (2026-10-09; bible/11-Multiplayer/Super-Dungeons-Look.md section 7): THE HALL REBUILT IN THE DAGGERFALL
// MANNER, INSIDE THE LAW'S SHAPES - every stone's visual within 5 cm of its solids (stoneSolids, the collider's own boxes,
// unchanged; over its crown, within its footprint): a two-step plinth and a chamfered shaft of dressed basalt, its
// kingdom's heraldry in relief, a raised dial in a 16-gon brass BEZEL (its own mesh, so the scene swaps its state by
// texRemap - cold, gold as its gear settles, ember when a turn is refused), the hand a spade, the handles cast levers
// with chevrons; on its crown a 1.2 m brass gear that turns 2:1 with its hand (crownGearMatrix) and only with it; on its back
// a banner in its kingdom's colours frozen mid-ripple (bannerPose - within the 5 cm too: a banner off an arm would hang
// where a body walks through it). The plaques are brass lecterns, each an open bronze ledger at the tablet's own place.
// The dial's floor is geometry: twelve raised numerals (XII toward +z), a rosette, a bezel round the inner ring, the six
// segments sunk bronze plates that RISE 3 cm alight as stones come true (buildLitModel). The fray is tabs that flip up
// (buildFrayModel); the Concord's band runs from the hub to the rim (buildBandModel) and the bridge is twelve plates of
// hard light, each engraved with its hour, that flip into place from the rim out (buildBridgePlateModel, plateMatrix).
// The orrery overhead is world/sdOrreryModel.js.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { SD_ORRERY, SD_STONES, SD_STONE_POS, SD_STONE_BEARINGS, SD_REALM_ORIGIN, realmToDungeon } from '../net/sdBrain.js';
import { faces } from './gateModel.js';
import { realmIsland, packRealmFaces, SD_REALM_ARCHIVE, SD_REALM_FLOOR_RECORD, SD_REALM_BRASS_RECORD, SD_ISLAND_SIDES } from './sdRealm.js';
import { SD_HALL_ATLAS, SD_HALL_ATLAS_RECORD, SD_HALL_GLOW_RECORD, SD_HALL_BAND_RECORD, SD_HALL_BRIDGE_RECORD, SD_HALL_EMBER_DIM_RECORD, SD_HALL_FLASH_RECORD, atlasUv } from './sdHallArt.js';
import { SD_HOUR_NUMERALS } from './sdSkyArt.js';

const deg = (d) => (d * Math.PI) / 180;
/** A stone's slab: across its face, through it, and tall (m). */
export const SD_STONE_SIZE = Object.freeze({ w: 1.6, d: 0.7, h: 2.6 });
/** Its dial: the centre's height on the face, and its radius. */
export const SD_DIAL = Object.freeze({ y: 1.55, r: 0.5 });
/** A hand: from the dial's centre to its point, behind it, its width, the hub's, and how far it stands off the face. */
export const SD_HAND = Object.freeze({ len: 0.42, tail: 0.1, w: 0.06, hub: 0.065, off: 0.03 });
/** The sign above the dial: its centre's height and its half-size. AUDIT SD II (L2 F5): clear of the dial (to 2.05) and
 *  under the cap (from 2.6) - it stood 1.92-2.48, over the dial's twelfth hour, both a hair before the face: they fought. */
export const SD_EMBLEM = Object.freeze({ y: 2.34, half: 0.25 });
/** The handles: their height, how far they stand out from the face, how far in from its edges, and their activation
 *  box's half-size. */
export const SD_HANDLE = Object.freeze({ y: 1.2, out: 0.14, inset: 0.14, reach: 0.25 });
/** The plaques: their ring, size, post, and bearings from +z (degrees) - numbered I to VI by these, clockwise from the
 *  walk in; none on the walk in (180) or the way on (0). */
export const SD_PLAQUE = Object.freeze({ r: 16.4, w: 1.0, h: 0.7, post: 0.95, bearings: Object.freeze([200, 240, 300, 60, 120, 160]) });
/** The dial's six segments (world/sdRealm.js SD_DIAL_INLAY's outlines: half its radius to 0.56 of it, each two hours wide
 *  about an odd hour), lit from the twelfth clockwise - SD-LOOK S10: raised plates inside the outlines (`inset` in from
 *  them), RISING `rise` alight; and the fray's ring just inside the rim, its tabs hinged at r1. */
export const SD_LIT_RING = Object.freeze({ r0: 0.5 * SD_ORRERY.r, r1: 0.56 * SD_ORRERY.r, halfHours: 0.84, y: 0.012, inset: 0.07, rise: 0.03, sunk: 0.007 });
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

/** SD-LOOK S10: THE LAW'S MARGIN - how far a stone's visual may stand past its solids (stoneSolids), metres. */
export const SD_LAW_MARGIN = 0.05;
/** SD-LOOK S10: A STONE'S SHAPE inside its slab (from its mid-plane: `o` toward its face, `r` across, `y` up) - a two-step
 *  plinth (the lower 4.5 cm proud of the slab, the upper flush), a shaft of dressed basalt chamfered at its four edges, a
 *  relief slab for its sign, the dial's disc, its bezel's ring and the notch at XII, the levers' faces, the crown's
 *  cradle and the banner's rod under the cap's back edge. */
export const SD_STONE_SHAPE = Object.freeze({
  plinth0: Object.freeze({ r: 0.845, o: 0.395, y: 0.16 }), plinth1: Object.freeze({ r: 0.8, o: 0.35, y: 0.3 }),
  shaft: Object.freeze({ r: 0.77, o: 0.33, chamfer: 0.06 }),
  relief: 0.365, disc: 0.355,
  lever: Object.freeze({ base: 0.36, front: 0.47, half: 0.05 }),
  rod: Object.freeze({ y: 2.57, o: 0.375 }),
});
/** The dial's bezel: its ring's radii on the face and how far it stands (from the slab's mid-plane). */
export const SD_BEZEL = Object.freeze({ r0: 0.44, r1: 0.52, o0: 0.355, o1: 0.378, sides: 16 });
/** THE CROWN GEAR: its centre over the stone's foot, its tip and root radii, its rim's inner edge, its hub, its teeth and
 *  spokes, its thickness - and its RATIO, the turns it makes for one of its hand's (2: it moves more than the hand). */
export const SD_CROWN_GEAR = Object.freeze({ y: 3.26, tip: 0.6, root: 0.5, rim: 0.4, hub: 0.1, teeth: 12, spokes: 5, t: 0.08, ratio: 2 });
/** THE BANNER: across, from its rod down to its corners, how far it stands behind the slab's mid-plane, how far its
 *  frozen ripple reaches (the law's 5 cm, both ways: never inside the shaft's back), its grid; the Concord's wind (s). */
export const SD_BANNER = Object.freeze({ w: 0.9, top: 2.555, bottom: 0.36, tail: 0.3, o: 0.375, amp: 0.017, ampWind: 0.02, cols: 6, rows: 10, sway: 0.28, wind: 3 });
/** THE DIAL'S FLOOR, as geometry: twelve numerals as tall as a knee (their middle's radius, height, proud), a rosette at
 *  the hub, and a bezel enclosing the inner ring. */
export const SD_NUMERALS = Object.freeze({ r: 13.6, h: 0.6, up: 0.035, stroke: 0.09, letter: 0.44, gap: 0.07 });
export const SD_ROSETTE = Object.freeze({ petal: 1.1, petalW: 0.42, boss: 0.28, ring0: 1.24, ring1: 1.34, up: 0.025 });
export const SD_INNER_BEZEL = Object.freeze({ r0: 10.15, r1: 10.4, up: 0.03 });
/** THE FRAY'S TABS: across (m), how long a lying tab is (its hinge at SD_FRAY_RING.r1), how tall one standing. */
export const SD_FRAY_TAB = Object.freeze({ w: 1.2, len: SD_FRAY_RING.r1 - SD_FRAY_RING.r0, h: 0.35, t: 0.016 });
/** THE CONCORD'S BAND: from past the rosette to the rim's tabs, along +z, its half-width and height. */
export const SD_BAND = Object.freeze({ r0: 1.45, r1: SD_FRAY_RING.r0 - 0.05, halfW: 0.25, y: 0.04 });
/** THE BRIDGE'S PLATES: twelve, the gap between, how thick. */
export const SD_BRIDGE_PLATES = Object.freeze({ n: 12, gap: 0.05, t: 0.06 });

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const UP = [0, 1, 0];

/**
 * A stone's frame in the realm's: its foot's centre `at`, `n` the way its face looks (toward the hall's centre), and `R`
 * the right of one who faces it AS THE SCREEN SHOWS IT - n x up, the game's own camRight (cos yaw, 0, -sin yaw) for an eye
 * looking along -n. AUDIT SD II (L2 F1): it was up x n, render/mat4 lookAt's +x BEFORE the projection's one mirror (mat4's
 * handedness law: lookAt puts world +x on screen-LEFT) - so every hand turned anticlockwise with its third hour at nine
 * o'clock, the forward handle stood on the left, and every sign and plaque read mirrored.
 */
export function stoneFrame(i) {
  const b = SD_STONE_BEARINGS[i], p = SD_STONE_POS[i];
  const n = [-Math.sin(b), 0, -Math.cos(b)];
  return { at: [p.x, 0, p.z], n, R: [-n[2], 0, n[0]] };
}
/** The point on a stone's face (the realm's frame) `right` across, `up` high, `out` before it. */
export function stonePoint(i, right, up, out = 0) {
  const { at, n, R } = stoneFrame(i);
  return add(add(add(at, mul(n, SD_STONE_SIZE.d / 2 + out)), mul(R, right)), [0, up, 0]);
}
/** AUDIT SD II (L2 F2): whether a point of the realm's floor (x, z) stands before stone `i`'s face - past its face's
 *  plane, on the side it looks to: where a hand on its handles stands (the slab is solid now; the handles' boxes still
 *  reach a little past its edges, so the press asks this too). */
export function beforeStone(i, x, z) {
  const { at, n } = stoneFrame(i);
  return (x - at[0]) * n[0] + (z - at[2]) * n[2] > SD_STONE_SIZE.d / 2;
}
/** A plaque's frame: its foot `at` on the rim, `n` facing in, `R` the right of one who faces it (n x up, as the stones'). */
export function plaqueFrame(k) {
  const b = deg(SD_PLAQUE.bearings[k]);
  const n = [-Math.sin(b), 0, -Math.cos(b)];
  return { at: [SD_ORRERY.x + SD_PLAQUE.r * Math.sin(b), 0, SD_ORRERY.z + SD_PLAQUE.r * Math.cos(b)], n, R: [-n[2], 0, n[0]] };
}

/** A face standing up: `c` its bottom middle (the realm's frame), across `R` (left to right as it is seen), out up x R (a
 *  stone's n, for its own R), w by h - its corners in the dungeon's frame, bottom-left, top-left, top-right, bottom-right:
 *  wound to face out (AUDIT SD II, L2 F1: with R the eye's right, its picture's u runs left to right as it is seen). */
function uprightQuad(c, R, w, h) {
  const T = (p) => realmToDungeon(p[0], p[1], p[2]);
  const bl = add(c, mul(R, -w / 2)), br = add(c, mul(R, w / 2));
  return [T(bl), T(add(bl, mul(UP, h))), T(add(br, mul(UP, h))), T(br)];
}
const UPRIGHT_UV = [[0, 0], [0, 1], [1, 1], [1, 0]];
const TOP_UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
/** A box (a slab, a cap, a handle, a post): its bottom middle `c`, its axes `R` and `n`, half-sizes and height - its four
 *  sides and its top as quads (four corners each, the dungeon's frame, wound to face out): AUDIT SD II (L2 F2) ONE
 *  geometry for its draw and its collider, as the arena's pillars are (world/sdRealm.js pillarQuads). AUDIT SD IV (R4):
 *  `under` its underside too, facing down - a box that overhangs over the eye (the cap). */
function boxQuads(c, R, n, hw, hd, h, under = false) {
  const out = [];
  for (const [N, A, half, across] of [[n, R, hd, hw], [mul(n, -1), mul(R, -1), hd, hw], [R, mul(n, -1), hw, hd], [mul(R, -1), n, hw, hd]])
    out.push(uprightQuad(add(c, mul(N, half)), A, across * 2, h));
  const top = add(c, [0, h, 0]);
  const p = (a, b) => realmToDungeon(...add(add(top, mul(R, a * hw)), mul(n, b * hd)));
  out.push([p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)]);
  if (under) { const q = (a, b) => realmToDungeon(...add(add(c, mul(R, a * hw)), mul(n, b * hd))); out.push([q(-1, -1), q(-1, 1), q(1, 1), q(1, -1)]); }
  return out;
}

// ── SD-LOOK S10: the hall's quads, each `[record, corners, uvs]` (the dungeon's frame, wound to face out) ─────────────
/** A quad facing `want`: wound so its face (b - a) x (c - a) looks that way (the renderer draws a face wound so toward
 *  the eye - AUDIT SD II's test), its uvs kept with their corners. */
function facing(out, rec, a, b, c, d, ua, ub, uc, ud, want) {
  if (dot(cross(sub(b, a), sub(c, a)), want) >= 0) out.push([rec, [a, b, c, d], [ua, ub, uc, ud]]);
  else out.push([rec, [d, c, b, a], [ud, uc, ub, ua]]);
}
/** A triangle facing `want` (a fan's). */
function facingTri(out, rec, a, b, c, ua, ub, uc, want) {
  if (dot(cross(sub(b, a), sub(c, a)), want) >= 0) out.push([rec, [a, b, c], [ua, ub, uc]]);
  else out.push([rec, [c, b, a], [uc, ub, ua]]);
}
/** A frame on the floor: `P(r, y, o)` the dungeon's point `r` along `R`, `y` up and `o` along `n` from `at` (realm). */
const frameAt = (at, R, n) => ({ R, n, P: (r, y, o) => realmToDungeon(at[0] + R[0] * r + n[0] * o, y, at[2] + R[2] * r + n[2] * o) });
/** A stone's frame from its slab's mid-plane (`o` toward its face). */
const stoneAt = (i) => { const { at, n, R } = stoneFrame(i); return frameAt(at, R, n); };
/** A tile's uvs for a face `w` by `h` metres (a texture every two metres, the realm's own scale). */
const tile = (w, h) => [[0, 0], [0, h / 2], [w / 2, h / 2], [w / 2, 0]];
/** An atlas cell's uvs, from (s0, t0) to (s1, t1) of it - bottom-left, top-left, top-right, bottom-right. */
const cellUv = (cell, s0 = 0, t0 = 0, s1 = 1, t1 = 1) => [atlasUv(cell, s0, t0), atlasUv(cell, s0, t1), atlasUv(cell, s1, t1), atlasUv(cell, s1, t0)];
/** A box in frame F, from (r0, y0, o0) to (r1, y1, o1): its faces out, `uv(face, w, h)` each one's uvs (the brass tile
 *  by default), `skip` the faces left off ('f' front +o, 'k' back, 'r' +r, 'l' -r, 't' top) and `under` its underside. */
function lbox(out, F, rec, r0, r1, y0, y1, o0, o1, { uv = (_f, w, h) => tile(w, h), skip = '', under = false } = {}) {
  const { P, R, n } = F, nR = mul(R, -1), nn = mul(n, -1);
  const put = (key, a, b, c, d, w, h, want) => { if (!skip.includes(key)) { const u = uv(key, w, h); facing(out, rec, a, b, c, d, u[0], u[1], u[2], u[3], want); } };
  put('f', P(r0, y0, o1), P(r0, y1, o1), P(r1, y1, o1), P(r1, y0, o1), r1 - r0, y1 - y0, n);
  put('k', P(r1, y0, o0), P(r1, y1, o0), P(r0, y1, o0), P(r0, y0, o0), r1 - r0, y1 - y0, nn);
  put('r', P(r1, y0, o1), P(r1, y1, o1), P(r1, y1, o0), P(r1, y0, o0), o1 - o0, y1 - y0, R);
  put('l', P(r0, y0, o0), P(r0, y1, o0), P(r0, y1, o1), P(r0, y0, o1), o1 - o0, y1 - y0, nR);
  put('t', P(r0, y1, o0), P(r0, y1, o1), P(r1, y1, o1), P(r1, y1, o0), r1 - r0, o1 - o0, UP);
  if (under) put('u', P(r0, y0, o0), P(r1, y0, o0), P(r1, y0, o1), P(r0, y0, o1), r1 - r0, o1 - o0, mul(UP, -1));
}
/** A ring of `sides` in a stone's face plane about (0, cy), radii a to b, standing from o0 to o1: its front, its outer and
 *  inner sides (the bezel's shape; brass tile uvs round it). */
function faceRing(out, F, rec, cy, a, b, o0, o1, sides) {
  const { P, n } = F, at = (rad, th, o) => P(rad * Math.sin(th), cy + rad * Math.cos(th), o), C = P(0, cy, o1);
  for (let k = 0; k < sides; k++) {
    const t0 = (k / sides) * Math.PI * 2, t1 = ((k + 1) / sides) * Math.PI * 2, u0 = k / 4, u1 = (k + 1) / 4;
    facing(out, rec, at(a, t0, o1), at(b, t0, o1), at(b, t1, o1), at(a, t1, o1), [u0, 0], [u0, 0.06], [u1, 0.06], [u1, 0], n);
    const mid = at(b, (t0 + t1) / 2, o1);
    facing(out, rec, at(b, t0, o0), at(b, t0, o1), at(b, t1, o1), at(b, t1, o0), [u0, 0], [u0, 0.02], [u1, 0.02], [u1, 0], sub(mid, C));
    facing(out, rec, at(a, t0, o0), at(a, t0, o1), at(a, t1, o1), at(a, t1, o0), [u0, 0], [u0, 0.02], [u1, 0.02], [u1, 0], sub(C, at(a, (t0 + t1) / 2, o1)));
  }
}

/** SD-LOOK S10: STONE `i`'s OWN VISUAL, as quads - plinth, chamfered shaft, relief, dial and its notch, levers, the crown's
 *  cradle and the banner's rod (its cap is its solid's own box, stoneSolids; its bezel, gear, hand and banner their own
 *  meshes). Every corner within SD_LAW_MARGIN of its solids: test/sd25_orrery.test.js holds it there. */
export function stoneQuads(i) {
  const out = [], F = stoneAt(i), { P, R, n } = F, S = SD_STONE_SHAPE, A = SD_HALL_ATLAS, rec = SD_HALL_ATLAS_RECORD;
  // the plinth's two steps, each band of its cell
  const p0 = S.plinth0, p1 = S.plinth1;
  lbox(out, F, rec, -p0.r, p0.r, 0, p0.y, -p0.o, p0.o, { uv: (f) => (f === 't' ? cellUv(A.plinth, 0, 0.4, 1, 0.45) : cellUv(A.plinth, 0, 0, f === 'r' || f === 'l' ? 0.47 : 1, 0.5)) });
  lbox(out, F, rec, -p1.r, p1.r, p0.y, p1.y, -p1.o, p1.o, { uv: (f) => (f === 't' ? cellUv(A.plinth, 0, 0.9, 1, 0.95) : cellUv(A.plinth, 0, 0.5, f === 'r' || f === 'l' ? 0.44 : 1, 1)) });
  // the shaft: an octagon in plan, its faces and chamfers dressed stone - the cell a metre and six across, its height
  const { r: W, o: D, chamfer: c } = S.shaft, y0 = p1.y, y1 = SD_STONE_SIZE.h;
  const ring = [[-(W - c), D], [W - c, D], [W, D - c], [W, -(D - c)], [W - c, -D], [-(W - c), -D], [-W, -(D - c)], [-W, D - c]];
  let along = 0;
  for (let k = 0; k < 8; k++) {
    const [ra, oa] = ring[k], [rb, ob] = ring[(k + 1) % 8], len = Math.hypot(rb - ra, ob - oa);
    const s0 = (along % 1.6) / 1.6, s1 = Math.min(1, s0 + len / 1.6);
    along += len;
    const mid = [(ra + rb) / 2, (oa + ob) / 2], want = add(mul(R, mid[0]), mul(n, mid[1]));
    const u = cellUv(A.stone, s0, 0, s1, 1);
    facing(out, rec, P(ra, y0, oa), P(ra, y1, oa), P(rb, y1, ob), P(rb, y0, ob), u[0], u[1], u[2], u[3], want);
  }
  // the relief: its sign raised on a slab before the shaft, brass at its edges
  const e = SD_EMBLEM;
  lbox(out, F, SD_REALM_BRASS_RECORD, -e.half, e.half, e.y - e.half, e.y + e.half, D, S.relief, { skip: 'fk', under: true });
  lbox(out, F, rec, -e.half, e.half, e.y - e.half, e.y + e.half, D, S.relief, { skip: 'krltu', uv: () => cellUv(A.emblem[i]) });
  // the dial: a disc of sixteen raised before the shaft, its face the dial's picture, its rim brass
  const dy = SD_DIAL.y, dr = SD_DIAL.r, Cd = P(0, dy, S.disc);
  for (let k = 0; k < 16; k++) {
    const t0 = (k / 16) * Math.PI * 2, t1 = ((k + 1) / 16) * Math.PI * 2;
    const a = P(dr * Math.sin(t0), dy + dr * Math.cos(t0), S.disc), b = P(dr * Math.sin(t1), dy + dr * Math.cos(t1), S.disc);
    const uv = (t) => atlasUv(A.dial, 0.5 + 0.5 * Math.sin(t), 0.5 + 0.5 * Math.cos(t));
    facingTri(out, rec, Cd, a, b, atlasUv(A.dial, 0.5, 0.5), uv(t0), uv(t1), n);
    const a0 = P(dr * Math.sin(t0), dy + dr * Math.cos(t0), D), b0 = P(dr * Math.sin(t1), dy + dr * Math.cos(t1), D);
    facing(out, SD_REALM_BRASS_RECORD, a0, a, b, b0, [k / 4, 0], [k / 4, 0.02], [(k + 1) / 4, 0.02], [(k + 1) / 4, 0], sub(a, P(0, dy, S.disc)));
  }
  // the levers: a plate on the shaft, a cast lever standing out of it, its face the chevron - forward on the right
  // (pointing right), back on the left (mirrored, pointing left)
  const L = S.lever;
  for (const side of [1, -1]) {
    const x = side * (SD_STONE_SIZE.w / 2 - SD_HANDLE.inset), hy = SD_HANDLE.y;
    lbox(out, F, SD_REALM_BRASS_RECORD, x - 0.06, x + 0.06, hy - 0.11, hy + 0.11, D, L.base, { skip: 'k', under: true });
    lbox(out, F, SD_REALM_BRASS_RECORD, x - L.half, x + L.half, hy - 0.085, hy + 0.085, L.base, L.front, { skip: 'kf', under: true });
    lbox(out, F, rec, x - L.half, x + L.half, hy - 0.085, hy + 0.085, L.base, L.front, { skip: 'krltu', uv: () => (side > 0 ? cellUv(A.handle) : cellUv(A.handle, 1, 0, 0, 1)) });
  }
  // the crown's cradle: two cheeks on the cap holding the gear's axle
  const G = SD_CROWN_GEAR, top = SD_STONE_SIZE.h + 0.12;
  for (const o of [0.05, -0.09]) lbox(out, F, SD_REALM_BRASS_RECORD, -0.05, 0.05, top, G.y + 0.08, o, o + 0.04);
  lbox(out, F, SD_REALM_BRASS_RECORD, -0.035, 0.035, G.y - 0.035, G.y + 0.035, -0.115, 0.115, { under: true });
  // the banner's rod, under the cap's back edge
  lbox(out, F, SD_REALM_BRASS_RECORD, -SD_BANNER.w / 2 - 0.05, SD_BANNER.w / 2 + 0.05, S.rod.y - 0.015, S.rod.y + 0.015, -S.rod.o - 0.01, -S.rod.o + 0.01, { under: true });
  return out;
}

/** SD-LOOK S10: A LECTERN, plaque `k`'s - a brass foot, an octagonal column, a collar, a ledge and a board holding its open
 *  bronze ledger at the tablet's own place (its pages a shallow V about the spine) - within SD_LAW_MARGIN of its post and
 *  tablet (hallSolidTris). */
export function lecternQuads(k) {
  const out = [], { at, n, R } = plaqueFrame(k), F = frameAt(at, R, n), { P } = F, A = SD_HALL_ATLAS, post = SD_PLAQUE.post;
  lbox(out, F, SD_REALM_BRASS_RECORD, -0.11, 0.11, 0, 0.05, -0.11, 0.11);
  for (let s = 0; s < 8; s++) {
    const a0 = ((s + 0.5) / 8) * Math.PI * 2, a1 = ((s + 1.5) / 8) * Math.PI * 2, rr = 0.055;
    const pa = [rr * Math.sin(a0), rr * Math.cos(a0)], pb = [rr * Math.sin(a1), rr * Math.cos(a1)];
    facing(out, SD_REALM_BRASS_RECORD, P(pa[0], 0.05, pa[1]), P(pa[0], post - 0.05, pa[1]), P(pb[0], post - 0.05, pb[1]), P(pb[0], 0.05, pb[1]), [s / 8, 0], [s / 8, 0.4], [(s + 1) / 8, 0.4], [(s + 1) / 8, 0], add(mul(R, pa[0] + pb[0]), mul(n, pa[1] + pb[1])));
  }
  lbox(out, F, SD_REALM_BRASS_RECORD, -0.08, 0.08, post - 0.07, post, -0.08, 0.08, { under: true });
  lbox(out, F, SD_REALM_BRASS_RECORD, -0.52, 0.52, post - 0.02, post + 0.02, 0.06, 0.115, { under: true });
  lbox(out, F, SD_REALM_BRASS_RECORD, -0.5, 0.5, post, post + SD_PLAQUE.h, 0.055, 0.075, { under: true });
  const y0 = post + 0.02, y1 = post + SD_PLAQUE.h - 0.02, cell = A.ledger[k];
  const left = cellUv(cell, 0, 0, 0.5, 1), right = cellUv(cell, 0.5, 0, 1, 1);
  facing(out, SD_HALL_ATLAS_RECORD, P(-0.48, y0, 0.105), P(-0.48, y1, 0.105), P(0, y1, 0.085), P(0, y0, 0.085), left[0], left[1], left[2], left[3], n);
  facing(out, SD_HALL_ATLAS_RECORD, P(0, y0, 0.085), P(0, y1, 0.085), P(0.48, y1, 0.105), P(0.48, y0, 0.105), right[0], right[1], right[2], right[3], n);
  return out;
}

/** The hall's floor frame at bearing `b` (radians from +z): `P(r, y, o)` - `o` out from the hub, `r` across to the right
 *  of one at the hub looking out. */
const floorAt = (b) => { const d = [Math.sin(b), 0, Math.cos(b)]; return frameAt([SD_ORRERY.x, 0, SD_ORRERY.z], [d[2], 0, -d[0]], d); };
/** A raised stroke of a floor glyph: from (x0, y0) to (x1, y1) of the glyph (x across, y out from the hub), `w` wide -
 *  its top and four sides, `up` proud. */
function stroke(out, F, rec, x0, y0, x1, y1, w, up) {
  const { P } = F, dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * (w / 2), ny = (dx / l) * (w / 2);
  const c = [[x0 - nx, y0 - ny], [x1 - nx, y1 - ny], [x1 + nx, y1 + ny], [x0 + nx, y0 + ny]];
  const T = (p, y) => P(p[0], y, p[1]);
  facing(out, rec, T(c[0], up), T(c[1], up), T(c[2], up), T(c[3], up), [0, 0], [0, l / 2], [w / 2, l / 2], [w / 2, 0], UP);
  const mid = T([(x0 + x1) / 2, (y0 + y1) / 2], 0);
  for (let s = 0; s < 4; s++) { const a = c[s], b = c[(s + 1) % 4]; facing(out, rec, T(a, 0), T(a, up), T(b, up), T(b, 0), [0, 0], [0, 0.02], [0.2, 0.02], [0.2, 0], sub(T([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], 0), mid)); }
}
/** The strokes of a Roman numeral's letters, `h` tall, centred: `[x0, y0, x1, y1]` each (y from the numeral's foot). */
export function numeralStrokes(s, h = SD_NUMERALS.h) {
  const N = SD_NUMERALS, half = (N.letter / 2) * 0.78, widths = [...s].map((ch) => (ch === 'I' ? N.stroke : N.letter));
  let x = -(widths.reduce((a, b) => a + b, 0) + N.gap * (s.length - 1)) / 2;
  const out = [];
  [...s].forEach((ch, k) => {
    const cx = x + widths[k] / 2;
    if (ch === 'I') out.push([cx, 0, cx, h]);
    else if (ch === 'V') out.push([cx - half, h, cx, 0], [cx + half, h, cx, 0]);
    else out.push([cx - half, 0, cx + half, h], [cx + half, 0, cx - half, h]);
    x += widths[k] + N.gap;
  });
  return out;
}
/** SD-LOOK S10: THE DIAL'S FLOOR - its twelve numerals raised in brass (hour h at bearing h x 30 degrees from +z, as the
 *  inlay has it, XII toward the bridge; each upright to one at the hub looking out), the rosette at the hub, the bezel
 *  round the inner ring, and the six segments' plates sunk dark bronze inside their outlines (they rise alight - the
 *  scene's buildLitModel). */
export function dialFloorQuads() {
  const out = [], N = SD_NUMERALS, brass = SD_REALM_BRASS_RECORD;
  for (let h = 0; h < 12; h++) {
    const F = floorAt((h / 12) * Math.PI * 2);
    for (const [x0, y0, x1, y1] of numeralStrokes(SD_HOUR_NUMERALS[h])) stroke(out, F, brass, x0, N.r - N.h / 2 + y0, x1, N.r - N.h / 2 + y1, N.stroke, N.up);
  }
  // the rosette: eight petals about a boss, a ring round them
  const Ro = SD_ROSETTE, F0 = floorAt(0), P0 = (x, y, z) => F0.P(x, y, z);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, pt = (rad, da) => [rad * Math.sin(a + da), rad * Math.cos(a + da)];
    const kite = [pt(0.24, 0), pt(Ro.petalW, -0.24), pt(Ro.petal, 0), pt(Ro.petalW, 0.24)];
    const T = (p, y) => P0(p[0], y, p[1]);
    facing(out, brass, T(kite[0], Ro.up), T(kite[1], Ro.up), T(kite[2], Ro.up), T(kite[3], Ro.up), [0, 0], [0.2, 0], [0.4, 0.4], [0, 0.2], UP);
    for (let s = 0; s < 4; s++) { const p = kite[s], q = kite[(s + 1) % 4]; facing(out, brass, T(p, 0), T(p, Ro.up), T(q, Ro.up), T(q, 0), [0, 0], [0, 0.02], [0.2, 0.02], [0.2, 0], sub(T([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], 0), T([0.5 * Math.sin(a), 0.5 * Math.cos(a)], 0))); }
  }
  floorRing(out, brass, 0, Ro.boss, Ro.up + 0.02, 16);
  floorRing(out, brass, Ro.ring0, Ro.ring1, 0.02, 48);
  floorRing(out, brass, SD_INNER_BEZEL.r0, SD_INNER_BEZEL.r1, SD_INNER_BEZEL.up, 96);
  // the six plates, sunk: dark bronze inside their outlines
  for (let k = 0; k < 6; k++) segmentPlate(out, SD_HALL_ATLAS_RECORD, k, SD_LIT_RING.sunk, false, cellUv(SD_HALL_ATLAS.bronze));
  return out;
}
/** A raised ring on the hall's floor about its hub, radii a to b (a disc from 0), `up` proud: its top and its sides. */
function floorRing(out, rec, a, b, up, steps) {
  const at = (rad, t, y) => realmToDungeon(SD_ORRERY.x + rad * Math.sin(t), y, SD_ORRERY.z + rad * Math.cos(t)), C = realmToDungeon(SD_ORRERY.x, 0, SD_ORRERY.z);
  for (let k = 0; k < steps; k++) {
    const t0 = (k / steps) * Math.PI * 2, t1 = ((k + 1) / steps) * Math.PI * 2, u0 = (k / steps) * 4, u1 = ((k + 1) / steps) * 4;
    if (a > 0) facing(out, rec, at(a, t0, up), at(b, t0, up), at(b, t1, up), at(a, t1, up), [u0, 0], [u0, 0.1], [u1, 0.1], [u1, 0], UP);
    else facingTri(out, rec, at(0, 0, up), at(b, t0, up), at(b, t1, up), [u0, 0], [u0, 0.1], [u1, 0.1], UP);
    facing(out, rec, at(b, t0, 0), at(b, t0, up), at(b, t1, up), at(b, t1, 0), [u0, 0], [u0, 0.02], [u1, 0.02], [u1, 0], sub(at(b, (t0 + t1) / 2, 0), C));
    if (a > 0) facing(out, rec, at(a, t0, 0), at(a, t0, up), at(a, t1, up), at(a, t1, 0), [u0, 0], [u0, 0.02], [u1, 0.02], [u1, 0], sub(C, at(a, (t0 + t1) / 2, 0)));
  }
}
/** Segment `k`'s plate inside its outline (two hours wide about its odd hour, SD_LIT_RING inset), its top `y` high, with
 *  its sides when `sides` (a raised plate) - 8 steps along it. */
function segmentPlate(out, rec, k, y, sides, uv = null) {
  const { r0, r1, halfHours, inset } = SD_LIT_RING;
  const mid = deg((2 * k + 1) * 30), half = deg(halfHours * 30);
  const a = r0 + inset, b = r1 - inset, b0 = mid - half + inset / a, b1 = mid + half - inset / a;
  const at = (rad, t, yy) => realmToDungeon(SD_ORRERY.x + rad * Math.sin(t), yy, SD_ORRERY.z + rad * Math.cos(t)), C = at(0, 0, 0);
  for (let s = 0; s < 8; s++) {
    const t0 = b0 + ((b1 - b0) * s) / 8, t1 = b0 + ((b1 - b0) * (s + 1)) / 8;
    const U = uv ?? [[s / 8, 0], [s / 8, 0.5], [(s + 1) / 8, 0.5], [(s + 1) / 8, 0]];
    facing(out, rec, at(a, t0, y), at(b, t0, y), at(b, t1, y), at(a, t1, y), U[0], U[1], U[2], U[3], UP);
    if (!sides) continue;
    facing(out, rec, at(b, t0, 0), at(b, t0, y), at(b, t1, y), at(b, t1, 0), [0, 0], [0, 0.02], [0.2, 0.02], [0.2, 0], sub(at(b, (t0 + t1) / 2, 0), C));
    facing(out, rec, at(a, t0, 0), at(a, t0, y), at(a, t1, y), at(a, t1, 0), [0, 0], [0, 0.02], [0.2, 0.02], [0.2, 0], sub(C, at(a, (t0 + t1) / 2, 0)));
  }
  if (!sides) return;
  for (const [t, way] of [[b0, -1], [b1, 1]]) facing(out, rec, at(a, t, 0), at(a, t, y), at(b, t, y), at(b, t, 0), [0, 0], [0, 0.02], [0.2, 0.02], [0.2, 0], [way * Math.cos(t), 0, -way * Math.sin(t)]);
}
/** Quads into a faces() build. */
const emit = (f, quads) => { for (const [rec, p, u] of quads) { if (p.length === 3) f.tri(rec, p[0], p[1], p[2], u[0], u[1], u[2]); else f.quad(rec, p[0], p[1], p[2], p[3], u[0], u[1], u[2], u[3]); } };

/**
 * THE HALL'S STANDING PARTS, one mesh (renderer.createMesh's model shape, the dungeon's frame, sub-meshes by record):
 * the six stones - SD-LOOK S10: plinth, shaft, relief, dial, notch, levers, cradle, rod and their caps - the six
 * lecterns, the dial's floor, and the first step.
 */
export function buildHallModel() {
  const f = faces();
  for (let i = 0; i < SD_STONES.length; i++) {
    const { R } = stoneFrame(i);
    emit(f, stoneQuads(i));
    // its brass cap - its solid's own box (stoneSolids, the collider's)
    for (const [rec, quads] of stoneSolids(i).slice(1, 2)) quads.forEach(([a, b, d, e]) => f.quad(rec, a, b, d, e, ...(a[1] === b[1] && b[1] === d[1] ? TOP_UV : UPRIGHT_UV)));   // AUDIT SD IV (R4): a level face (a top, the cap's underside) the top's
    // the notch over its twelfth hour, on the bezel's ring
    const T = (p) => realmToDungeon(p[0], p[1], p[2]);
    const tip = stonePoint(i, 0, SD_DIAL.y + SD_BEZEL.r0 - 0.01, SD_BEZEL.o1 - SD_STONE_SIZE.d / 2 + 0.007);   // SD-LOOK S10: the notch points down at the twelfth hour, proud of the bezel
    f.tri(SD_REALM_BRASS_RECORD, T(tip), T(add(add(tip, [0, 0.12, 0]), mul(R, -0.07))), T(add(add(tip, [0, 0.12, 0]), mul(R, 0.07))), [0.5, 0], [0, 1], [1, 1]);
  }
  for (let k = 0; k < SD_PLAQUE.bearings.length; k++) emit(f, lecternQuads(k));
  emit(f, dialFloorQuads());
  realmIsland(f, SD_FIRST_STEP.x, SD_FIRST_STEP.z, SD_FIRST_STEP.r, SD_REALM_FLOOR_RECORD, { lean: -1 });
  return packRealmFaces(f);
}
/** A plaque's face's bottom middle (the realm's frame): on its post's top, a little before it. */
const plaqueFaceFoot = (k) => { const { at, n } = plaqueFrame(k); return add(at, add(mul(n, 0.09), [0, SD_PLAQUE.post, 0])); };
/** AUDIT SD II (L2 F2): STONE `i`'s SOLIDS - its slab, its brass cap and its two handles, each `[record, quads]` (five
 *  quads a box, boxQuads'; six the cap's, AUDIT SD IV R4) - the collider's geometry (SD-LOOK S10: the cap's draw too; the
 *  slab and the handles are drawn as the shaft and the levers, stoneQuads, within SD_LAW_MARGIN of them).
 * @returns {Array<[number, number[][][]]>} */
export function stoneSolids(i) {
  const { at, n, R } = stoneFrame(i);
  const { w, d, h } = SD_STONE_SIZE;
  return [
    [SD_HALL_ATLAS_RECORD, boxQuads(at, R, n, w / 2, d / 2, h)],
    [SD_REALM_BRASS_RECORD, boxQuads(add(at, [0, h, 0]), R, n, w / 2 + 0.05, d / 2 + 0.05, 0.12, true)],   // AUDIT SD IV (R4): its overhang shut underneath
    [SD_REALM_BRASS_RECORD, [-1, 1].flatMap((side) => boxQuads(handleFoot(i, side), R, n, 0.06, SD_HANDLE.out / 2, 0.22))],
  ];
}
/** AUDIT SD II (L2 F2): THE HALL'S SOLIDS, FOR THE COLLIDER - every stone's slab, cap and handles and every plaque's post
 *  and tablet, from the corners their draw is made of (both faces are one to the collider): a body stops at a stone and a
 *  ray meets it, as the arena's pillars are met (world/sdRealm.js realmPillarTris). They were drawn and never solid - the
 *  player walked through the 1.6 x 0.7 x 2.6 m slabs. */
export function hallSolidTris() {
  const out = [];
  /** @param {number[][]} q */
  const tri2 = (q) => out.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
  for (let i = 0; i < SD_STONES.length; i++) for (const [, quads] of stoneSolids(i)) quads.forEach(tri2);
  for (let k = 0; k < SD_PLAQUE.bearings.length; k++) {
    const { at, n, R } = plaqueFrame(k);
    boxQuads(at, R, n, 0.07, 0.07, SD_PLAQUE.post).forEach(tri2);
    tri2(uprightQuad(plaqueFaceFoot(k), R, SD_PLAQUE.w, SD_PLAQUE.h));
  }
  return new Float32Array(out);
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

/** A HAND, in its own frame: from its hub along +y to its point (the twelfth hour), facing +z; brass alight. SD-LOOK S10:
 *  a SPADE - its blade a pointed head with two lobes, a slender shaft, a counterweight ring behind the hub. */
export function buildHandModel() {
  const f = faces();
  const { len, tail, w, hub } = SD_HAND, rec = SD_HALL_GLOW_RECORD.brass;
  const T = (a, b, c) => f.tri(rec, a, b, c, [0.5, 0.5], [1, 0.5], [1, 1]);
  const q = (a, b, c, d) => { T(a, b, c); T(a, c, d); };
  const s = w * 0.2;   // the shaft's half-width
  q([-s, -tail * 0.4, 0], [s, -tail * 0.4, 0], [s * 0.7, len * 0.62, 0], [-s * 0.7, len * 0.62, 0]);
  // the spade's head: a point, two lobes, a notch over the shaft
  const head = [[0, len], [w * 0.62, len * 0.74], [w * 0.95, len * 0.66], [w * 0.62, len * 0.6], [0, len * 0.64], [-w * 0.62, len * 0.6], [-w * 0.95, len * 0.66], [-w * 0.62, len * 0.74]];
  const c = [0, len * 0.7, 0];
  for (let k = 0; k < head.length; k++) { const a = head[k], b = head[(k + 1) % head.length]; T(c, [b[0], b[1], 0], [a[0], a[1], 0]); }
  // the counterweight: a ring behind the hub
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2, cy = -tail * 0.7, r0 = w * 0.25, r1 = w * 0.55;
    const P = (r, a) => [Math.sin(a) * r, cy + Math.cos(a) * r, 0];
    q(P(r0, a0), P(r0, a1), P(r1, a1), P(r1, a0));
  }
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2;
    f.tri(rec, [0, 0, 0.002], [Math.cos(a0) * hub, Math.sin(a0) * hub, 0.002], [Math.cos(a1) * hub, Math.sin(a1) * hub, 0.002], [0.5, 0.5], [1, 0.5], [1, 1]);
  }
  // every triangle faces +z: wind any that does not
  const g = f.byRec.get(rec);
  for (let k = 0; k < g.p.length; k += 9) {
    if (g.n[k + 2] >= 0) continue;
    for (let j = 0; j < 3; j++) { const t = g.p[k + 3 + j]; g.p[k + 3 + j] = g.p[k + 6 + j]; g.p[k + 6 + j] = t; }
    for (let j = 0; j < 9; j++) g.n[k + j] = -g.n[k + j];
  }
  return packRealmFaces(f);
}
/**
 * A hand's place on stone `i` at `hour` (0 to 12, fractions between): the matrix that stands the hand's own frame on the
 * dial - turned CLOCKWISE as one facing the stone sees it, the twelfth hour straight up and the third toward R, the eye's
 * right (column-major, the dungeon's frame). AUDIT SD II (L2 F1): a proper turn - its own +z the face's n, and its own +x
 * y x n, so x x y = n (with R the eye's right, R and up beside n are a mirror's three).
 */
export function handMatrix(i, hour) {
  const { n, R } = stoneFrame(i);
  const t = ((hour % 12) / 12) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
  const y = [R[0] * s + UP[0] * c, R[1] * s + UP[1] * c, R[2] * s + UP[2] * c];   // its own +y: to its point, turned
  const x = [y[1] * n[2] - y[2] * n[1], y[2] * n[0] - y[0] * n[2], y[0] * n[1] - y[1] * n[0]];   // its own +x: y x n
  const o = realmToDungeon(...stonePoint(i, 0, SD_DIAL.y, SD_HAND.off));
  return new Float32Array([x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, n[0], n[1], n[2], 0, o[0], o[1], o[2], 1]);
}

/** SD-LOOK S10: STONE `i`'s BEZEL, its own mesh (the scene swaps its state by texRemap - the brass record cold, the hands'
 *  glow as its gear settles, its dim as it frees, the fray's ember on a refusal): a ring of sixteen about the dial. */
export function buildBezelModel(i) {
  const out = [], f = faces(), B = SD_BEZEL;
  faceRing(out, stoneAt(i), SD_REALM_BRASS_RECORD, SD_DIAL.y, B.r0, B.r1, B.o0, B.o1, B.sides);
  emit(f, out);
  return packRealmFaces(f);
}
/** SD-LOOK S10: THE CROWN GEAR, in its own frame (its face +z, its axle the z axis, `SD_CROWN_GEAR.t` thick): a toothed
 *  rim, a hub and spokes - brass. One mesh, six draws (crownGearMatrix). */
export function buildCrownGearModel() {
  const out = [], f = faces(), G = SD_CROWN_GEAR, rec = SD_REALM_BRASS_RECORD, z0 = -G.t / 2, z1 = G.t / 2, Z = [0, 0, 1], nZ = [0, 0, -1];
  const P = (r, a, z) => [r * Math.sin(a), r * Math.cos(a), z];
  const both = (a, b, c, d, u) => { facing(out, rec, a(z1), b(z1), c(z1), d(z1), u[0], u[1], u[2], u[3], Z); facing(out, rec, a(z0), b(z0), c(z0), d(z0), u[0], u[1], u[2], u[3], nZ); };
  const side = (p, q, want) => facing(out, rec, p(z0), p(z1), q(z1), q(z0), [0, 0], [0, 0.04], [0.1, 0.04], [0.1, 0], want);
  const pitch = (Math.PI * 2) / G.teeth, rh = pitch * 0.24, th = pitch * 0.15, steps = 2;
  for (let k = 0; k < G.teeth; k++) {
    const a = k * pitch;
    // the tooth
    both((z) => P(G.root, a - rh, z), (z) => P(G.tip, a - th, z), (z) => P(G.tip, a + th, z), (z) => P(G.root, a + rh, z), [[0, 0], [0, 0.05], [0.05, 0.05], [0.05, 0]]);
    side((z) => P(G.root, a - rh, z), (z) => P(G.tip, a - th, z), P(1, a - pitch / 4, 0));
    side((z) => P(G.tip, a - th, z), (z) => P(G.tip, a + th, z), P(1, a, 0));
    side((z) => P(G.tip, a + th, z), (z) => P(G.root, a + rh, z), P(1, a + pitch / 4, 0));
    // the rim between this tooth and the next, and the root's face out
    for (let s = 0; s < steps; s++) {
      const b0 = a + rh + ((pitch - 2 * rh) * s) / steps, b1 = a + rh + ((pitch - 2 * rh) * (s + 1)) / steps;
      both((z) => P(G.rim, b0, z), (z) => P(G.root, b0, z), (z) => P(G.root, b1, z), (z) => P(G.rim, b1, z), [[0, 0], [0, 0.05], [0.05, 0.05], [0.05, 0]]);
      side((z) => P(G.root, b0, z), (z) => P(G.root, b1, z), P(1, (b0 + b1) / 2, 0));
    }
    for (let s = 0; s < 2; s++) {   // the rim behind the tooth
      const b0 = a - rh + (rh * 2 * s) / 2, b1 = a - rh + (rh * 2 * (s + 1)) / 2;
      both((z) => P(G.rim, b0, z), (z) => P(G.root, b0, z), (z) => P(G.root, b1, z), (z) => P(G.rim, b1, z), [[0, 0], [0, 0.05], [0.05, 0.05], [0.05, 0]]);
    }
  }
  const ring = 32;
  for (let s = 0; s < ring; s++) { const b0 = (s / ring) * Math.PI * 2, b1 = ((s + 1) / ring) * Math.PI * 2; side((z) => P(G.rim, b1, z), (z) => P(G.rim, b0, z), P(-1, (b0 + b1) / 2, 0)); }
  // the hub and the spokes
  for (let s = 0; s < 12; s++) {
    const b0 = (s / 12) * Math.PI * 2, b1 = ((s + 1) / 12) * Math.PI * 2;
    facingTri(out, rec, [0, 0, z1 + 0.01], P(G.hub, b0, z1 + 0.01), P(G.hub, b1, z1 + 0.01), [0, 0], [0.05, 0], [0.05, 0.05], Z);
    facingTri(out, rec, [0, 0, z0 - 0.01], P(G.hub, b0, z0 - 0.01), P(G.hub, b1, z0 - 0.01), [0, 0], [0.05, 0], [0.05, 0.05], nZ);
    facing(out, rec, P(G.hub, b0, z0 - 0.01), P(G.hub, b0, z1 + 0.01), P(G.hub, b1, z1 + 0.01), P(G.hub, b1, z0 - 0.01), [0, 0], [0, 0.04], [0.05, 0.04], [0.05, 0], P(1, (b0 + b1) / 2, 0));
  }
  for (let k = 0; k < G.spokes; k++) {
    const a = (k / G.spokes) * Math.PI * 2, w = 0.035, d = [Math.sin(a), Math.cos(a)], nx = [d[1] * w, -d[0] * w];
    const S = (r, sgn) => (z) => [d[0] * r + nx[0] * sgn, d[1] * r + nx[1] * sgn, z];
    both(S(G.hub * 0.9, -1), S(G.rim + 0.01, -1), S(G.rim + 0.01, 1), S(G.hub * 0.9, 1), [[0, 0], [0, 0.15], [0.02, 0.15], [0.02, 0]]);
    side(S(G.hub * 0.9, 1), S(G.rim + 0.01, 1), [nx[0], nx[1], 0]);
    side(S(G.rim + 0.01, -1), S(G.hub * 0.9, -1), [-nx[0], -nx[1], 0]);
  }
  emit(f, out);
  return packRealmFaces(f);
}
/** SD-LOOK S10: THE CROWN GEAR's place on stone `i` while its hand shows `hour`: on its crown, its face toward the hall,
 *  turned SD_CROWN_GEAR.ratio times its hand's turn and against it (a gear the hand drives - it moves exactly when the
 *  hand moves, and more) - a proper turn, never a mirror. Into `out` (column-major, the dungeon's frame). */
export function crownGearMatrix(i, hour, out = new Float32Array(16)) {
  const { n, R } = stoneFrame(i);
  const t = -SD_CROWN_GEAR.ratio * ((hour % 12) / 12) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
  const y0 = R[0] * s, y1 = c, y2 = R[2] * s;
  const x0 = y1 * n[2] - y2 * n[1], x1 = y2 * n[0] - y0 * n[2], x2 = y0 * n[1] - y1 * n[0];
  const p = SD_STONE_POS[i], o = realmToDungeon(p.x, SD_CROWN_GEAR.y, p.z);
  out[0] = x0; out[1] = x1; out[2] = x2; out[3] = 0; out[4] = y0; out[5] = y1; out[6] = y2; out[7] = 0;
  out[8] = n[0]; out[9] = n[1]; out[10] = n[2]; out[11] = 0; out[12] = o[0]; out[13] = o[1]; out[14] = o[2]; out[15] = 1;
  return out;
}

/** SD-LOOK S10: THE BANNERS - six cloths on the stones' backs, each `SD_BANNER.cols` x `rows` (two sides: the kingdom's
 *  face out, its reverse in). Shared vertices (`(cols + 1) x (rows + 1)` a side) so the Concord's wind uploads little:
 *  bannerPose writes their positions and normals at any moment of it. */
const BV = (SD_BANNER.cols + 1) * (SD_BANNER.rows + 1);
export const SD_BANNER_VERTS = SD_STONES.length * 2 * BV;
/** The banners' ripple: each stone's own phase (seeded by its index, never the clock). */
const BANNER_PHASE = Object.freeze([0.4, 2.1, 3.7, 1.3, 5.0, 2.8]);
/** The stones' frames, made once (the wind's pose reads them a frame). */
const STONE_FRAMES = Object.freeze(SD_STONES.map((_, i) => stoneFrame(i)));
/** Every banner's positions and normals (the dungeon's frame) at `age` seconds into the Concord's wind (< 0: none - the
 *  frozen ripple; past SD_BANNER.wind: still again, mid-ripple anew), into `pos` and `nrm` (each SD_BANNER_VERTS x 3) -
 *  the same layout buildBannerModel makes. A vertex at grid (s, t) - s 0..1 across as its face is seen (from behind the
 *  stone: -R), t 0..1 down - stands [r, y, o] in its stone's frame: its ripple through the cloth (pinned at the rod, its
 *  reach the wind's), its sway in the back's own plane (never out of it), its swallowtail foot. All in place, no call
 *  that boxes a number: the Concord's three seconds write it a frame and make nothing. */
export function bannerPose(age, pos, nrm) {
  const Bn = SD_BANNER, C = Bn.cols, Rw = Bn.rows, O = SD_REALM_ORIGIN;
  const w = age >= 0 ? Math.min(age, Bn.wind) : 0, e = Math.sin((Math.PI * w) / Bn.wind);
  const amp = Math.min(Bn.ampWind, Bn.amp + (Bn.ampWind - Bn.amp) * e);
  for (let i = 0; i < SD_STONES.length; i++) {
    const { at, n, R } = STONE_FRAMES[i], base = i * 2 * BV, phase = BANNER_PHASE[i] + 9 * w;
    for (let j = 0; j <= Rw; j++) for (let c = 0; c <= C; c++) {
      const s = c / C, t = j / Rw, hang = Math.min(1, t * 5), bottom = Bn.bottom + Bn.tail * (1 - Math.abs(2 * s - 1));
      const r = Bn.w / 2 - Bn.w * s + (Bn.sway * t * t + 0.04 * hang * Math.sin(14 * w + 6 * t)) * e;
      const y = Bn.top - t * (Bn.top - bottom), o = -Bn.o + amp * hang * Math.sin(Math.PI * 2 * 1.1 * s + 3.4 * t + phase);
      const v = j * (C + 1) + c, q = (base + v) * 3, qb = (base + BV + v) * 3;
      pos[q] = pos[qb] = O[0] + at[0] + R[0] * r + n[0] * o;
      pos[q + 1] = pos[qb + 1] = O[1] + y;
      pos[q + 2] = pos[qb + 2] = O[2] + at[2] + R[2] * r + n[2] * o;
    }
    // normals from the grid's neighbours: across x down faces out (behind the stone, -n), the reverse in
    for (let j = 0; j <= Rw; j++) for (let c = 0; c <= C; c++) {
      const row = base + j * (C + 1), cl = c > 0 ? c - 1 : 0, cr = c < C ? c + 1 : C, ju = (j > 0 ? j - 1 : 0) - j, jd = (j < Rw ? j + 1 : Rw) - j;
      const a = (row + cr) * 3, b = (row + cl) * 3, u = (row + jd * (C + 1) + c) * 3, d = (row + ju * (C + 1) + c) * 3;
      const sx = pos[a] - pos[b], sy = pos[a + 1] - pos[b + 1], sz = pos[a + 2] - pos[b + 2];
      const tx = pos[u] - pos[d], ty = pos[u + 1] - pos[d + 1], tz = pos[u + 2] - pos[d + 2];
      let nx = sy * tz - sz * ty, ny = sz * tx - sx * tz, nz = sx * ty - sy * tx;
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;   // never Math.hypot in a frame: it makes its arguments
      nx /= l; ny /= l; nz /= l;
      if (nx * n[0] + nz * n[2] > 0) { nx = -nx; ny = -ny; nz = -nz; }
      const q = (row + c) * 3, qb = q + BV * 3;
      nrm[q] = nx; nrm[q + 1] = ny; nrm[q + 2] = nz;
      nrm[qb] = -nx; nrm[qb + 1] = -ny; nrm[qb + 2] = -nz;
    }
  }
  return pos;
}
/** THE BANNERS' MESH: frozen mid-ripple (bannerPose at rest), the atlas's banner cells - the face as its kingdom made it,
 *  the reverse mirrored. Indexed, one sub-mesh. */
export function buildBannerModel() {
  const C = SD_BANNER.cols, Rw = SD_BANNER.rows, positions = new Float32Array(SD_BANNER_VERTS * 3), normals = new Float32Array(SD_BANNER_VERTS * 3);
  const uvs = new Float32Array(SD_BANNER_VERTS * 2), idx = [];
  bannerPose(-1, positions, normals);
  for (let i = 0; i < SD_STONES.length; i++) {
    const base = i * 2 * BV, cell = SD_HALL_ATLAS.banner[i];
    for (let j = 0; j <= Rw; j++) for (let c = 0; c <= C; c++) {
      const v = j * (C + 1) + c, [u0, v0] = atlasUv(cell, c / C, 1 - j / Rw), [u1] = atlasUv(cell, 1 - c / C, 1 - j / Rw);
      uvs.set([u0, v0], (base + v) * 2); uvs.set([u1, v0], (base + BV + v) * 2);
    }
    for (let j = 0; j < Rw; j++) for (let c = 0; c < C; c++) {
      const a = base + j * (C + 1) + c, b = a + 1, cc = a + C + 2, d = a + C + 1;
      idx.push(a, b, cc, a, cc, d);   // across then down: facing out, away from the stone (-n)
      idx.push(a + BV, cc + BV, b + BV, a + BV, d + BV, cc + BV);   // the reverse, wound the other way
    }
  }
  const indices = Uint32Array.from(idx);
  return { positions, normals, uvs, indices, subMeshes: [{ textureArchive: SD_REALM_ARCHIVE, textureRecord: SD_HALL_ATLAS_RECORD, startIndex: 0, primitiveCount: indices.length / 3 }] };
}

/** THE DIAL'S LIGHT for `n` stones at their true hours: the first `n` segments, clockwise from the twelfth - or null.
 *  SD-LOOK S10: each a PLATE RISEN SD_LIT_RING.rise from its sunk place, alight (`rec`, the Mantella's green; the flash's
 *  white-green for the whole ring's one flash).
 * @param {number} n
 * @param {number} [rec] */
export function buildLitModel(n, rec = SD_HALL_GLOW_RECORD.mantella) {
  if (!(n > 0)) return null;
  const f = faces(), out = [];
  for (let k = 0; k < Math.min(n, SD_STONES.length); k++) segmentPlate(out, rec, k, SD_LIT_RING.rise, true);
  emit(f, out);
  return packRealmFaces(f);
}
/** Where tab `k` of `count` stands: its bearing (radians from +z, clockwise from the twelfth, half a step in - the hours'
 *  inlay between them). */
export const frayTabBearing = (k, count = SD_FRAY_RING.steps) => ((k + 0.5) / count) * Math.PI * 2;
/** THE FRAY after `fray` turns of a Hollow's `count` (48; the Fraying's 36): SD-LOOK S10 - `count` brass TABS round the
 *  rim, hinged at SD_FRAY_RING.r1, one flipped up a turn clockwise from the twelfth, standing in the fray's ember; the
 *  rest lie flat - in their dim ember (the scene pulses it) once eight or fewer remain. `blaze`: every tab up, white (the
 *  snap). Null with none up and none to warn of. */
export function buildFrayModel(fray, count = SD_FRAY_RING.steps, { blaze = false } = {}) {
  const up = blaze ? count : Math.max(0, Math.min(count, Math.floor(fray)));
  const warn = !blaze && up >= count - 8;
  if (!(up > 0) && !warn) return null;
  const f = faces(), out = [], T = SD_FRAY_TAB, h1 = SD_FRAY_RING.r1;
  for (let k = 0; k < count; k++) {
    const F = floorAt(frayTabBearing(k, count)), hw = T.w / 2;
    if (k < up) lbox(out, F, blaze ? SD_HALL_FLASH_RECORD : SD_HALL_GLOW_RECORD.fray, -hw, hw, SD_FRAY_RING.y, SD_FRAY_RING.y + T.h, h1 - T.t, h1);
    else lbox(out, F, warn ? SD_HALL_EMBER_DIM_RECORD : SD_REALM_BRASS_RECORD, -hw, hw, 0.004, SD_FRAY_RING.y, h1 - T.len, h1);
  }
  emit(f, out);
  return packRealmFaces(f);
}
/** SD-LOOK S10: THE CONCORD'S BAND - from past the rosette to the rim along +z (bearing 0), a strip of light a hand's
 *  breadth proud, the Mantella running into gold (its record's own v from the hub). */
export function buildBandModel() {
  const f = faces(), out = [], B = SD_BAND, F = floorAt(0);
  lbox(out, F, SD_HALL_BAND_RECORD, -B.halfW, B.halfW, 0, B.y, B.r0, B.r1, { skip: 'k', uv: (face) => (face === 't' ? [[0, 0], [0, 1], [1, 1], [1, 0]] : [[0, 0], [0, 0.02], [1, 0.02], [1, 0]]) });
  emit(f, out);
  return packRealmFaces(f);
}
const BAND_Z0 = realmToDungeon(0, 0, SD_ORRERY.z + SD_BAND.r0)[2];
/** The band's matrix `k` (0..1) of the way run out: stretched along its length from the hub. */
export function bandMatrix(k, out = new Float32Array(16)) {
  const e = Math.max(1e-3, 1 - (1 - Math.max(0, Math.min(1, k))) ** 2);
  out.fill(0); out[0] = 1; out[5] = 1; out[10] = e; out[14] = (1 - e) * BAND_Z0; out[15] = 1;
  return out;
}
/** Bridge plate `j` (0 at the hall's rim): its near and far z (the realm's frame). */
export function bridgePlateSpan(j) {
  const { z0, z1 } = SD_BRIDGE, P = SD_BRIDGE_PLATES, len = (z1 - z0) / P.n;
  return [z0 + j * len + P.gap / 2, z0 + (j + 1) * len - P.gap / 2];
}
/** One plate of the bridge into quads: its top engraved with its hour (the bridge record's cell j: u across as one
 *  walking out sees it, its numeral's foot toward the hall), its sides. */
function bridgePlate(out, j) {
  const { x, halfW: hw, y } = SD_BRIDGE, [za, zb] = bridgePlateSpan(j), t = SD_BRIDGE_PLATES.t;
  const F = frameAt([x, 0, 0], [1, 0, 0], [0, 0, 1]);
  const v0 = (j * 16 + 0.5) / 192, v1 = (j * 16 + 15.5) / 192, u0 = 0.5 / 64, u1 = 63.5 / 64;
  lbox(out, F, SD_HALL_BRIDGE_RECORD, -hw, hw, y - t, y, za, zb, { uv: (face) => (face === 't' ? [[u0, v0], [u0, v1], [u1, v1], [u1, v0]] : [[u0, v0], [u0, v0], [u1, v0], [u1, v0]]) });
}
/** THE BRIDGE of hard light, from the hall's rim to the first step - SD-LOOK S10: its twelve plates, laid. */
export function buildBridgeModel() {
  const f = faces(), out = [];
  for (let j = 0; j < SD_BRIDGE_PLATES.n; j++) bridgePlate(out, j);
  emit(f, out);
  return packRealmFaces(f);
}
/** SD-LOOK S10: bridge plate `j` alone (the lay flips each on its own hinge). */
export function buildBridgePlateModel(j) {
  const f = faces(), out = [];
  bridgePlate(out, j);
  emit(f, out);
  return packRealmFaces(f);
}
/** Each plate's hinge, its near edge's z in the dungeon's frame - made once (a frame's flip asks it). */
const PLATE_HINGE_Z = Object.freeze(Array.from({ length: SD_BRIDGE_PLATES.n }, (_, j) => realmToDungeon(0, 0, bridgePlateSpan(j)[0])[2]));
/** SD-LOOK S10: plate `j`'s matrix `k` (0..1) of its flip: standing on its near edge's hinge (folded up), falling out
 *  into place - eased, laid at 1. Into `out` (column-major, the dungeon's frame). */
export function plateMatrix(j, k, out = new Float32Array(16)) {
  const e = 1 - (1 - Math.max(0, Math.min(1, k))) ** 3, th = (1 - e) * (Math.PI / 2), c = Math.cos(th), s = Math.sin(th);
  const yh = SD_REALM_ORIGIN[1] + SD_BRIDGE.y, zh = PLATE_HINGE_Z[j];
  out.fill(0); out[0] = 1; out[5] = c; out[6] = -s; out[9] = s; out[10] = c; out[15] = 1;
  out[13] = yh - c * yh - s * zh; out[14] = zh + s * yh - c * zh;
  return out;
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
