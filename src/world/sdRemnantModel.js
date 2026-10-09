// @ts-check
// SD8c (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10): THE BRASS REMNANT, MADE -
// what the Warp kept of the Numidium, and its Echoes, and the Reset's Hearts: meshes in their OWN frames (feet at the
// origin, facing +z, y up - a facing of 0 is +z, as net/sdRemnant.js's `yw` is), stood on the page by a matrix
// (remnantMatrix) at each body's place, facing and size. Pure: the scene (scenes/sdRemnant.js) uploads and stands them.
//
//   THE REMNANT - a brass colossus four times a man's height: two legs, a hip, a chest that is an open CAGE of brass bars
//     about a heart of shattered soul-gem light (the Mantella's echo, its green), shoulders, two arms and a head with eyes
//     alight. An Echo is the same body in its own metal - GOLD or SILVER (world/sdRemnantArt.js) - at its own height.
//   A HEART - the Reset's crystal: a tall shard of the same green light, its waist low.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { faces } from './gateModel.js';
import { packRealmFaces, SD_REALM_BRASS_RECORD, SD_REALM_ROOT_RECORD } from './sdRealm.js';
import { SD_HALL_GLOW_RECORD } from './sdHallArt.js';
import { SD_REMNANT_GOLD_RECORD, SD_REMNANT_SILVER_RECORD, SD_REMNANT_ENDING_RECORD } from './sdRemnantArt.js';
import { SD_REM, SD_ECHO, SD_HEART } from '../net/sdRemnant.js';

/** Its parts, its own frame, at the Remnant's own height (an Echo is scaled to its own - remnantScale). The joints the rig
 *  turns about are read off these (scenes/sdRemnantRig.js SD_RIG_JOINTS): the hips at legH, the waist over the hip's
 *  band, the neck over the cage and the shoulders. SD-LOOK: what stands between them is the rebuilt body's (section 10). */
export const SD_REMNANT_BODY = Object.freeze({
  legX: 0.85, legW: 0.95, legD: 1.05, legH: 3.0,
  hipH: 0.6, hipW: 2.5, hipD: 1.35,
  cageH: 2.3, cageRX: 1.15, cageRZ: 0.75, bars: 8, bar: 0.13,
  heartY: 4.75, heartR: 0.55,
  shoulderH: 0.6, shoulderW: 3.0, shoulderD: 1.1,
  armX: 1.95, armW: 0.64, armD: 0.64, armBot: 3.1,
  headW: 0.95, headD: 0.95, eyeY: 0.36, eyeX: 0.15, eyeW: 0.18, eyeH: 0.06,
});
/** SD-LOOK: the rebuilt body's pieces (section 10) - the knees' and elbows' gears, the bells, the helm, the crown of seven
 *  broken clock-hands, the Hour-Hand's blade (its tip the hand point - SD_REM_HAND - so the beam and the gears leave from
 *  it), the back's organ-pipe vents. Metres, its own frame. */
export const SD_REMNANT_KIT = Object.freeze({
  sides: 10,
  knee: Object.freeze({ y: 1.6, r: 0.42, root: 0.33, teeth: 10, d: 0.14, out: 0.44 }),
  elbow: Object.freeze({ y: 4.62, r: 0.36, root: 0.28, teeth: 9, d: 0.14, out: 0.36 }),
  bell: Object.freeze({ x: 1.8, top: 6.78, mouth: 5.85, r: 0.6 }),
  helm: Object.freeze({ r: 0.5, top: 7.08 }),
  crown: Object.freeze({ n: 7, base: 0.3, y: 7.0, reach: 0.78, w: 0.07 }),
  blade: Object.freeze({ root: 4.5, w0: 0.36, w1: 0.18, spade: 3.62, spadeW: 0.5, d: 0.12 }),
  pipes: Object.freeze([[-0.52, 5.95], [-0.26, 6.3], [0.26, 6.42], [0.52, 6.1]]),
});
/** What each wears - its metal (the Remnant the Hour's own brass), its joints, its heart and its eyes. */
export const SD_REMNANT_WEAR = Object.freeze({
  brass: Object.freeze({ metal: SD_REALM_BRASS_RECORD, joint: SD_REALM_ROOT_RECORD }),
  gold: Object.freeze({ metal: SD_REMNANT_GOLD_RECORD, joint: SD_REMNANT_GOLD_RECORD }),
  silver: Object.freeze({ metal: SD_REMNANT_SILVER_RECORD, joint: SD_REMNANT_SILVER_RECORD }),
});
export const SD_REMNANT_HEART_RECORD = SD_HALL_GLOW_RECORD.mantella;
export const SD_REMNANT_EYE_RECORD = SD_HALL_GLOW_RECORD.brass;
/** How tall a body stands (the law's) over the model's own height - an Echo smaller. */
export const remnantScale = (echo) => (echo ? SD_ECHO.h / SD_REM.h : 1);

/** A box about (cx, cz) from y0 up h, w across x and d along z - its six faces wound to face out (world/gateModel.js
 *  faces': (b - a) x (c - a) outward). */
function box(f, rec, cx, y0, cz, w, h, d) {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y1 = y0 + h;
  const c = [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]];
  const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
  for (const [a, b, e, g] of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) f.quad(rec, c[a], c[b], c[e], c[g], ...uv);
}
/** A shard: its waist (four points, radius r) at y wy, its tips at y lo and hi - eight faces, wound to face out. */
function shard(f, rec, cx, cz, lo, wy, hi, r) {
  const ring = [[cx + r, wy, cz], [cx, wy, cz + r], [cx - r, wy, cz], [cx, wy, cz - r]];
  const top = [cx, hi, cz], bot = [cx, lo, cz];
  for (let k = 0; k < 4; k++) {
    const a = ring[k], b = ring[(k + 1) % 4];
    f.tri(rec, top, b, a, [0.5, 1], [1, 0], [0, 0]);
    f.tri(rec, bot, a, b, [0.5, 0], [0, 1], [1, 1]);
  }
}

/** SD17: the parts a body is stood as: its pelvis (the hip - never turned, stood where the body stands), then the six
 *  scenes/sdRemnantRig.js SD_RIG_PARTS turns - its right leg (at -x: it faces +z), its left, the torso (the cage, the
 *  heart, the shoulders), the head and its eyes, its right arm, its left. */
export const SD_REMNANT_PARTS = Object.freeze(['pelvis', 'legR', 'legL', 'torso', 'head', 'armR', 'armL']);
/** SD18c: the light a body's heart and eyes burn with - its Hollow's Ending's (world/sdRemnantArt.js), else the Mantella's
 *  green and the brass's gold. */
export const heartRecordOf = (ending) => SD_REMNANT_ENDING_RECORD[ending] ?? SD_REMNANT_HEART_RECORD;
export const eyeRecordOf = (ending) => SD_REMNANT_ENDING_RECORD[ending] ?? SD_REMNANT_EYE_RECORD;
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
/** SD-LOOK: a quad wound to face away from `ref` (a point inside the solid it bounds), its texture a metre a tile along its
 *  own sides - the brass's plate the same size on every piece. */
function plate(f, rec, a, b, c, d, ref) {
  const n = vcross(vsub(b, a), vsub(c, a)), mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
  const u = vlen(vsub(b, a)), v = vlen(vsub(d, a));
  if (vdot(n, vsub(mid, ref)) >= 0) f.quad(rec, a, b, c, d, [0, 0], [u, 0], [u, v], [0, v]);
  else f.quad(rec, d, c, b, a, [0, v], [u, v], [u, 0], [0, 0]);
}
/** The same for a triangle. */
function facet(f, rec, a, b, c, ref) {
  const n = vcross(vsub(b, a), vsub(c, a)), mid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
  if (vdot(n, vsub(mid, ref)) >= 0) f.tri(rec, a, b, c, [0, 0], [1, 0], [0.5, 1]);
  else f.tri(rec, c, b, a, [0.5, 1], [1, 0], [0, 0]);
}
/** A LATHE: `profile` [[r, y], ...] turned `n` times about the vertical through (cx, cz), squashed `sz` along z - a rim
 *  of zero radius closes it. Every facet faces out from the axis. */
function lathe(f, rec, cx, cz, profile, n, sz = 1, sx = 1) {
  const at = (r, y, a) => [cx + Math.cos(a) * r * sx, y, cz + Math.sin(a) * r * sz];
  for (let i = 0; i + 1 < profile.length; i++) {
    const [r0, y0] = profile[i], [r1, y1] = profile[i + 1], ym = (y0 + y1) / 2;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2, ref = [cx, ym, cz];
      if (r0 === 0) facet(f, rec, at(0, y0, a0), at(r1, y1, a0), at(r1, y1, a1), ref);
      else if (r1 === 0) facet(f, rec, at(r0, y0, a0), at(r0, y0, a1), at(0, y1, a0), ref);
      else plate(f, rec, at(r0, y0, a0), at(r0, y0, a1), at(r1, y1, a1), at(r1, y1, a0), ref);
    }
  }
}
/** A ROD from `a` to `b`: an `n`-sided prism, its radius `r0` at a and `r1` at b, capped. */
function rod(f, rec, a, b, r0, n = 6, r1 = r0) {
  const t = vsub(b, a), l = vlen(t), d = [t[0] / l, t[1] / l, t[2] / l];
  const up = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  let e1 = vcross(d, up); const l1 = vlen(e1); e1 = [e1[0] / l1, e1[1] / l1, e1[2] / l1];
  const e2 = vcross(d, e1);
  const ring = (c, r, k) => { const g = (k / n) * Math.PI * 2; return [c[0] + (e1[0] * Math.cos(g) + e2[0] * Math.sin(g)) * r, c[1] + (e1[1] * Math.cos(g) + e2[1] * Math.sin(g)) * r, c[2] + (e1[2] * Math.cos(g) + e2[2] * Math.sin(g)) * r]; };
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  for (let k = 0; k < n; k++) {
    plate(f, rec, ring(a, r0, k), ring(a, r0, k + 1), ring(b, r1, k + 1), ring(b, r1, k), mid);
    facet(f, rec, a, ring(a, r0, k), ring(a, r0, k + 1), mid);
    facet(f, rec, b, ring(b, r1, k + 1), ring(b, r1, k), mid);
  }
}
/** A RIB: a square bar `w` across along the points `path`, every face out from its own line. */
function rib(f, rec, path, w) {
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i], b = path[i + 1], t = vsub(b, a), h = w / 2;
    let n1 = vcross(t, [0, 1, 0]); const l = vlen(n1); n1 = [n1[0] / l * h, n1[1] / l * h, n1[2] / l * h];
    const n2 = [0, h, 0], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const c = (p, s1, s2) => [p[0] + n1[0] * s1 + n2[0] * s2, p[1] + n1[1] * s1 + n2[1] * s2, p[2] + n1[2] * s1 + n2[2] * s2];
    for (const [s1, s2, s3, s4] of [[1, 1, 1, -1], [1, -1, -1, -1], [-1, -1, -1, 1], [-1, 1, 1, 1]]) plate(f, rec, c(a, s1, s2), c(b, s1, s2), c(b, s3, s4), c(a, s3, s4), mid);
    if (i === 0) plate(f, rec, c(a, 1, 1), c(a, 1, -1), c(a, -1, -1), c(a, -1, 1), b);
    if (i + 2 === path.length) plate(f, rec, c(b, 1, 1), c(b, -1, 1), c(b, -1, -1), c(b, 1, -1), a);
  }
}
/** A GEAR about the x axis through `c` (a knee's, an elbow's): `teeth` teeth, its tips at `r`, its roots at `root`, `d`
 *  thick - both sides of every face (it reads from either). */
function gearX(f, rec, c, G) {
  const n = G.teeth * 2, x0 = c[0] - G.d / 2, x1 = c[0] + G.d / 2, hub = G.root * 0.35;
  const p = (a, rr, x) => [x, c[1] + Math.sin(a) * rr, c[2] + Math.cos(a) * rr];
  const both = (a, b, e, g) => { f.quad(rec, a, b, e, g, [0, 0], [1, 0], [1, 1], [0, 1]); f.quad(rec, g, e, b, a, [0, 1], [1, 1], [1, 0], [0, 0]); };
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, r = i % 2 ? G.root : G.r;
    both(p(a0, hub, x1), p(a1, hub, x1), p(a1, r, x1), p(a0, r, x1));
    both(p(a0, r, x0), p(a1, r, x0), p(a1, hub, x0), p(a0, hub, x0));
    both(p(a0, r, x0), p(a0, r, x1), p(a1, r, x1), p(a1, r, x0));
    const r1 = i % 2 ? G.r : G.root;
    both(p(a1, r, x0), p(a1, r1, x0), p(a1, r1, x1), p(a1, r, x1));
  }
}
/** A box as plates (world/gateModel.js box's faces, a metre a tile). */
function slab(f, rec, cx, y0, cz, w, h, d) {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y1 = y0 + h, ref = [cx, y0 + h / 2, cz];
  const c = [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]];
  for (const [a, b, e, g] of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) plate(f, rec, c[a], c[b], c[e], c[g], ref);
}
/** A flat piece cut to the outline `pts` ([z, y] in the plane x = cx, convex), `d` thick along x - the blade's shaft and
 *  its spade. */
function cut(f, rec, cx, pts, d) {
  const x0 = cx - d / 2, x1 = cx + d / 2, m = pts.reduce((o, q) => [o[0] + q[0] / pts.length, o[1] + q[1] / pts.length], [0, 0]), ref = [cx, m[1], m[0]];
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k], b = pts[(k + 1) % pts.length];
    plate(f, rec, [x0, a[1], a[0]], [x0, b[1], b[0]], [x1, b[1], b[0]], [x1, a[1], a[0]], ref);
    facet(f, rec, [x1, m[1], m[0]], [x1, a[1], a[0]], [x1, b[1], b[0]], ref);
    facet(f, rec, [x0, m[1], m[0]], [x0, b[1], b[0]], [x0, a[1], a[0]], ref);
  }
}

/** Every face of a body, each into the collector `into(part)` answers for its part (SD18c: its heart and eyes in `ending`'s
 *  light). SD-LOOK (Super-Dungeons-Look.md section 10): REBUILT - what the Warp kept of the Brass God, in big flat-shaded
 *  plates, on the same seven parts (no forearm of its own: the elbows baked, the arms hanging): sabatons, greaves and
 *  knee gears, thighs under riveted tassets; a girdle; a waist, a spine and back plate, and an open cage of eight curved
 *  ribs about a faceted heart; a gorget and a yoke; organ-pipe vents on its back; a domed helm with a slotted face-plate,
 *  its eye-slits alight, crowned with seven broken clock-hands; bell pauldrons, elbow gears, the left a fist with gear
 *  knuckles and the right forearm THE HOUR-HAND, a clock-hand's blade with a spade at its tip. Within the law: nothing
 *  under 2 m past its radius, its feet and its height the law's. */
function emitRemnant(metal, into, ending = null) {
  const B = SD_REMNANT_BODY, K = SD_REMNANT_KIT, W = SD_REMNANT_WEAR[metal], N = K.sides;
  // AUDIT SD III (V11): its right side at +x - through the camera's one mirror (world/mat4.js) +x is the side a body's own
  // right shows on; at -x it pointed the Hour-Hand with what every screen showed as its left
  for (const s of [-1, 1]) {
    const f = into(s > 0 ? 'legR' : 'legL'), x = s * B.legX;
    slab(f, W.metal, x, 0, 0.16, B.legW, 0.32, 1.45);                                                        // the sabaton
    lathe(f, W.joint, x, 0, [[0.34, 0.32], [0.36, 0.5]], 8);                                                  // the ankle
    lathe(f, W.metal, x, 0.02, [[0.36, 0.5], [0.46, 0.9], [0.5, 1.4], [0.44, 1.48]], N, 0.92);                // the greave
    slab(f, W.joint, x, 1.4, 0.4, 0.58, 0.42, 0.3);                                                           // the poleyn
    gearX(f, W.joint, [x + s * K.knee.out, K.knee.y, 0], K.knee);                                             // the knee's gear
    lathe(f, W.metal, x, 0, [[0.44, 1.48], [0.52, 1.85], [0.58, 2.6], [0.55, B.legH]], N, 0.9);               // the thigh
    for (const [y0, z] of [[2.48, 0.6], [2.1, 0.66]]) slab(f, W.metal, x + s * 0.06, y0, z, 0.86, 0.48, 0.08);   // the tassets
  }
  let f = into('pelvis');
  lathe(f, W.joint, 0, 0, [[0, B.legH], [1.18, B.legH], [1.25, B.legH + 0.12], [1.25, B.legH + B.hipH - 0.12], [1.12, B.legH + B.hipH], [0, B.legH + B.hipH]], 12, 0.62);   // the girdle
  slab(f, W.metal, 0, B.legH + 0.08, 0.76, 0.6, 0.44, 0.08);                                                  // its buckle
  f = into('torso');
  const cy0 = B.legH + B.hipH, sy = cy0 + B.cageH, ny = sy + B.shoulderH;
  lathe(f, W.joint, 0, 0, [[0, cy0], [0.8, cy0], [0.86, cy0 + 0.45], [0, cy0 + 0.45]], N, 0.62);               // the waist
  slab(f, W.metal, 0, cy0 + 0.3, -0.62, 0.38, 2.2, 0.32);                                                     // the spine
  slab(f, W.metal, 0, cy0 + 0.7, -0.8, 1.6, 1.6, 0.12);                                                       // the back plate
  // the cage: four ribs a side from the spine round to the front, falling a little, open over the heart
  for (const s of [-1, 1]) for (let k = 0; k < B.bars / 2; k++) {
    const yr = cy0 + 0.5 + k * 0.4, path = [];
    for (let i = 0; i <= 4; i++) {
      const g = (-80 + (148 * i) / 4) * (Math.PI / 180);
      path.push([s * Math.cos(g) * B.cageRX, yr + 0.08 - 0.23 * (i / 4), Math.sin(g) * B.cageRZ]);
    }
    rib(f, W.metal, path, B.bar);
  }
  // the heart: a faceted soul-gem the size of a man's torso
  const H = B.heartY, R = B.heartR;
  lathe(f, heartRecordOf(ending), 0, 0, [[0, H - R], [R, H + 0.1], [R * 0.68, H + 0.36], [0, H + 0.44]], 8);
  // the gorget and the yoke
  lathe(f, W.joint, 0, 0, [[0, sy - 0.35], [1.0, sy - 0.35], [1.1, sy], [0, sy]], 12, 0.62);
  slab(f, W.metal, 0, sy, 0, B.shoulderW, B.shoulderH - 0.05, B.shoulderD);
  // the vents: organ pipes up its back
  slab(f, W.joint, 0, cy0 + 1.3, -0.95, 1.3, 0.22, 0.22);
  for (const [x, top] of K.pipes) rod(f, W.joint, [x, cy0 + 1.4, -0.98], [x, Math.min(top, ny - 0.05), -0.98], 0.09, 6);
  // the head: a neck, a domed helm, a slotted face-plate, its eyes, its crown of broken hands
  f = into('head');
  lathe(f, W.joint, 0, 0, [[0, ny], [0.3, ny], [0.3, ny + 0.1], [0, ny + 0.1]], 8);
  lathe(f, W.metal, 0, 0, [[0, ny + 0.1], [0.42, ny + 0.1], [K.helm.r, ny + 0.26], [K.helm.r, ny + 0.42], [0.42, ny + 0.52], [0.24, ny + 0.57], [0, K.helm.top]], N);
  slab(f, W.joint, 0, ny + 0.17, 0.48, 0.62, 0.36, 0.08);
  for (const s of [-1, 1]) {
    const ex = s * B.eyeX, ey = ny + B.eyeY, ez = 0.525;
    f.quad(eyeRecordOf(ending), [ex - B.eyeW / 2, ey, ez], [ex + B.eyeW / 2, ey, ez], [ex + B.eyeW / 2, ey + B.eyeH, ez], [ex - B.eyeW / 2, ey + B.eyeH, ez], [0, 0], [1, 0], [1, 1], [0, 1]);
  }
  for (let k = 0; k < K.crown.n; k++) {
    // seven clock-hands round the crown, splayed out and up - every other one broken short; the tallest the law's height
    const g = ((k - (K.crown.n - 1) / 2) / K.crown.n) * Math.PI * 1.5 + Math.PI, out = [Math.sin(g), 0, Math.cos(g)];
    const reach = K.crown.reach * (k % 2 ? 0.55 : 1), tipY = k % 2 ? K.crown.y + 0.12 : SD_REM.h;
    const base = [out[0] * K.crown.base, K.crown.y, out[2] * K.crown.base], tip = [out[0] * (K.crown.base + reach), tipY, out[2] * (K.crown.base + reach)];
    rod(f, W.metal, base, tip, K.crown.w, 4, k % 2 ? K.crown.w : 1e-5);   // the whole ones to a point
  }
  // the arms: a bell at the shoulder, an elbow gear, and below - the left a fist with gear knuckles, the right the blade
  for (const s of [-1, 1]) {
    f = into(s > 0 ? 'armR' : 'armL');
    const x = s * B.armX, top = sy + B.shoulderH;
    lathe(f, W.metal, s * K.bell.x, 0, [[0, K.bell.top], [0.36, K.bell.top - 0.05], [0.5, 6.5], [0.57, 6.12], [K.bell.r, K.bell.mouth], [K.bell.r - 0.06, K.bell.mouth]], N);
    lathe(f, W.joint, x, 0, [[0, top - 0.1], [0.3, top - 0.1], [0.32, K.elbow.y + 0.1], [0, K.elbow.y + 0.1]], 8);   // the upper arm
    gearX(f, W.joint, [x + s * K.elbow.out, K.elbow.y, 0], K.elbow);
    if (s < 0) {
      lathe(f, W.metal, x, 0, [[0, K.elbow.y], [0.3, K.elbow.y], [0.27, B.armBot + 0.62], [0, B.armBot + 0.62]], 8);   // the forearm
      slab(f, W.metal, x, B.armBot, 0.04, B.armW, 0.62, 0.72);                                                         // the fist
      for (let k = 0; k < 4; k++) rod(f, W.joint, [x - 0.27, B.armBot + 0.5 - k * 0.13, 0.42], [x + 0.27, B.armBot + 0.5 - k * 0.13, 0.42], 0.065, 6);   // its gear knuckles
    } else {
      const L = K.blade;
      lathe(f, W.joint, x, 0, [[0, K.elbow.y], [0.22, K.elbow.y], [0.2, L.root], [0, L.root]], 8);   // the wrist's collar
      cut(f, W.metal, x, [[-L.w0 / 2, L.root], [L.w0 / 2, L.root], [L.w1 / 2, L.spade], [-L.w1 / 2, L.spade]], L.d);   // the hand's shaft
      cut(f, W.metal, x, [[0, L.spade + 0.14], [L.spadeW / 2, (L.spade + B.armBot) / 2 + 0.05], [0, B.armBot], [-L.spadeW / 2, (L.spade + B.armBot) / 2 + 0.05]], L.d);   // its spade, its tip the hand point
    }
  }
}
/** THE REMNANT (or an Echo, in `metal` 'gold' or 'silver'), one mesh in its own frame. */
export function buildRemnantModel(metal = 'brass', ending = null) {
  const f = faces();
  emitRemnant(metal, () => f, ending);
  return packRealmFaces(f);
}
/** SD17: THE REMNANT AS ITS PARTS (SD_REMNANT_PARTS' order), each a mesh in the body's own frame - stood whole, they are
 *  buildRemnantModel's faces, every one. */
export function buildRemnantParts(metal = 'brass', ending = null) {
  const fs = Object.fromEntries(SD_REMNANT_PARTS.map((n) => [n, faces()]));
  emitRemnant(metal, (n) => fs[n], ending);
  return SD_REMNANT_PARTS.map((n) => packRealmFaces(fs[n]));
}
/** SD17: A GEAR of the Volley - a brass cog SD_GEAR.r across with SD_GEAR.teeth teeth, SD_GEAR.d thick, its disc in the
 *  x-y plane about its own centre; both sides of every face (it tumbles). */
export const SD_GEAR = Object.freeze({ r: 0.62, root: 0.46, hub: 0.16, teeth: 9, d: 0.2 });
export function buildGearModel() {
  const f = faces(), G = SD_GEAR, n = G.teeth * 2, z0 = -G.d / 2, z1 = G.d / 2, rec = SD_REALM_BRASS_RECORD;
  const ring = Array.from({ length: n }, (_, i) => { const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, r = i % 2 ? G.root : G.r; return [a0, a1, r]; });
  const both = (a, b, c, d) => { f.quad(rec, a, b, c, d, [0, 0], [1, 0], [1, 1], [0, 1]); f.quad(rec, d, c, b, a, [0, 1], [1, 1], [1, 0], [0, 0]); };
  for (const [a0, a1, r] of ring) {
    const p = (a, rr, z) => [Math.cos(a) * rr, Math.sin(a) * rr, z];
    both(p(a0, G.hub, z1), p(a1, G.hub, z1), p(a1, r, z1), p(a0, r, z1));   // its face
    both(p(a0, r, z0), p(a1, r, z0), p(a1, G.hub, z0), p(a0, G.hub, z0));   // its back
    both(p(a0, r, z0), p(a0, r, z1), p(a1, r, z1), p(a1, r, z0));           // its rim
  }
  for (let i = 0; i < n; i++) {   // the teeth's flanks
    const a = ((i + 1) / n) * Math.PI * 2, r0 = i % 2 ? G.root : G.r, r1 = i % 2 ? G.r : G.root, p = (rr, z) => [Math.cos(a) * rr, Math.sin(a) * rr, z];
    both(p(r0, z0), p(r1, z0), p(r1, z1), p(r0, z1));
  }
  return packRealmFaces(f);
}
/** A HEART of the Reset: a shard of the heart's own light, SD_HEART tall and across, its waist low. */
export function buildHeartModel(ending = null) {
  const f = faces();
  shard(f, heartRecordOf(ending), 0, 0, 0, SD_HEART.h * 0.35, SD_HEART.h, SD_HEART.r);   // SD18c: in its Ending's light
  return packRealmFaces(f);
}

/**
 * A body stood at (x, y, z) - the DUNGEON's frame - facing `yw` (0 is +z, a quarter turn +x), at `scale`: the matrix that
 * stands its own frame there (column-major, a proper turn about y), into `out` (fresh by default).
 */
export function remnantMatrix(x, y, z, yw, scale = 1, out = new Float32Array(16)) {
  const c = Math.cos(yw) * scale, s = Math.sin(yw) * scale;
  out[0] = c; out[1] = 0; out[2] = -s; out[3] = 0;
  out[4] = 0; out[5] = scale; out[6] = 0; out[7] = 0;
  out[8] = s; out[9] = 0; out[10] = c; out[11] = 0;
  out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
  return out;
}
