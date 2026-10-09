// @ts-check
// SD-LOOK S11 (2026-10-09, the Abyss Dungeon's look; bible/11-Multiplayer/Super-Dungeons-Look.md section 6): THE WORKS -
// the broken clock's own works, turning far below the islands in the haze: four enormous brass gears 40-80 m across,
// 240-280 m down under the course's middle, meshed in two pairs on two layers (the upper pair's driver on the lower
// pair's follower's axle, as a clock's train is built), neighbours turning opposite ways on the escapement's tick
// (world/sdLook.js sdTick), dim glints at their tooth tips (the Works' record lights its tip band alone, the ambient
// rung), black against the furnace glowing at the nadir (render/sdSky.js). You see them between the islands, and you
// see them come up at you as you fall.
//
// And the gear the Hour's works are cut from (`layGear`): a toothed rim, a hub and spokes, laid in any frame - the Works'
// four, and the rims half-buried in the islands' spires (world/sdIslandModel.js).
//
// Pure: renderer.createMesh's model shape, the realm's own archive (world/sdRealm.js packRealmFaces); each gear in its own
// frame (its axle +y, its top face up), stood and turned by `worksMatrix`. Nothing here is law: no gear is a collider,
// every one far below every floor, and each draw `noShadow` (scenes/sdHang.js) - nothing that turns casts.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { faces } from './gateModel.js';
import { packRealmFaces } from './sdRealm.js';
import { SD_REALM_ORIGIN } from '../net/sdBrain.js';

/** SD-LOOK S11: the Works' record (the realm's archive, world/sdHangArt.js): dark brass, its tip band alight. */
export const SD_WORKS_RECORD = 80;
/** The Works' record's tip band (v - the renderer's first rows): a tooth's outer face wears it, and nothing else. */
export const SD_WORKS_TIP_V = Object.freeze([0.02, 0.1]);
/** The Works' record's face (v from here down): one picture over a whole gear's face, below the tip band - so no face but
 *  a tip ever samples the band, and its 4-8 texel features stay metres wide, crisp at 250 m (no mips: a finer grain
 *  shimmers as the gear turns). */
export const SD_WORKS_FACE_V = 0.14;
/** The train's tooth pitch along the pitch circle, metres - every gear's the same, so they mesh. */
export const SD_WORKS_PITCH = 2.6;
/** A gear's pitch radius: `teeth` of SD_WORKS_PITCH round it. */
export const worksPitchR = (teeth) => (SD_WORKS_PITCH * teeth) / (2 * Math.PI);
/** A gear's shape: its tips `out` modules past the pitch circle, its roots `in` short of it (a module is the pitch over
 *  pi); the rim's band `rim` of its radius deep inside the roots; `h` thick (metres); a hub `hub` of its radius standing
 *  `hubProud` over the rim; `spokes` bars `spokeW` of its radius wide; a tooth `tipW` of its pitch across at the tip and
 *  `rootW` at the root. */
/** @typedef {{ out: number, in: number, rim: number, h: number, hub: number, hubProud: number, spokes: number, spokeW: number, tipW: number, rootW: number }} GearShape */
/** @type {Readonly<GearShape>} */
export const SD_WORKS_TOOTH = Object.freeze({ out: 1.1, in: 1.3, rim: 0.16, h: 3.2, hub: 0.17, hubProud: 0.3, spokes: 6, spokeW: 0.07, tipW: 0.3, rootW: 0.52 });
/**
 * THE TRAIN: four gears in the realm's frame - `teeth`, its axle (x, z), its top face's height `y`. Laid by `layTrain`: 0
 * drives 1 on the lower layer (their pitch circles touching at `bearing` degrees from +x toward +z); 2 rides 1's axle on
 * the upper layer and drives 3. Each gets its pitch radius `r`, its turn a tick `w` (radians, signed: +1 takes +x toward
 * +z), its first tooth's bearing `phase` (so meshed teeth interleave) and its place in the dungeon's frame `at`. `lite`
 * the phones' two (section 6: two Works gears).
 */
export const SD_WORKS = layTrain([
  { teeth: 96, x: -42, z: 64, y: -270 },
  { teeth: 48, mesh: 0, bearing: 58, y: -270 },
  { teeth: 72, axle: 1, y: -244, lite: true },
  { teeth: 64, mesh: 2, bearing: 74, y: -244, lite: true },
]);

/** Lay the train. The driver turns one of its teeth a tick; a gear meshed with another turns the other way, its pitch
 *  circle rolling on the other's (so one of its own teeth a tick); a gear on another's axle turns as that one does. A
 *  follower's first tooth is set so its teeth stand in its driver's gaps along the line between their axles - and,
 *  rolling together, they stay there. */
function layTrain(spec) {
  const out = [];
  for (const s of spec) {
    const r = worksPitchR(s.teeth);
    let x = s.x ?? 0, z = s.z ?? 0, w = (2 * Math.PI) / s.teeth, phase = 0;
    if (s.mesh != null) {
      const d = out[s.mesh], b = (s.bearing * Math.PI) / 180;
      x = d.x + Math.cos(b) * (d.r + r); z = d.z + Math.sin(b) * (d.r + r);
      w = (-d.w * d.r) / r;
      phase = b + Math.PI - (d.r * (d.phase - b) + SD_WORKS_PITCH / 2) / r;
    } else if (s.axle != null) {
      const a = out[s.axle];
      x = a.x; z = a.z; w = a.w;
    }
    out.push(Object.freeze({ teeth: s.teeth, r, x, y: s.y, z, w, phase, lite: !!s.lite, at: Object.freeze([SD_REALM_ORIGIN[0] + x, SD_REALM_ORIGIN[1] + s.y, SD_REALM_ORIGIN[2] + z]) }));
  }
  return Object.freeze(out);
}

/** A gear's bearing after `ticks` of the escapement (sdTick's seconds): its first tooth's, plus its turn a tick. */
export const worksAngle = (g, ticks) => g.phase + g.w * ticks;
/** THE HANG'S MOMENT (scenes/sdHang.js): one kept Float64Array a frame - the escapement's ticks, the chains' swing, the far
 *  set's turn - each matrix reading its own from it (AUDIT SD II L2 F9: a number made in a frame and handed to a call that
 *  is not inlined is boxed, 16 bytes a frame; world/sdOrreryModel.js ringPoseInto's way). */
export const SD_HANG_NOW = Object.freeze({ ticks: 0, swing: 1, far: 2 });

/**
 * ONE GEAR laid into `f` (a faces() build) on record `rec`: its pitch radius `r` and `teeth`, in the frame `at(u, w, y)` -
 * the point `u` along the gear's first axis, `w` along its second, `y` along its axle (any handedness: each face is wound
 * to face out of the gear). The rim's band and the teeth (their faces, tips and flanks), the rim's walls, a hub and its
 * spokes; its underside only when `under` (the Works are seen from above alone). Its teeth's tips on the record's tip band
 * `tipV`; its faces' uv `faceUv(u, w, tipR)` (by default the record a repeat each `uvM` metres). Its first tooth at
 * bearing `phase`.
 * @param {any} f
 * @param {number} rec
 * @param {{ r: number, teeth: number, at: (u: number, w: number, y: number) => number[], phase?: number, shape?: Readonly<GearShape>, under?: boolean, tipV?: ReadonlyArray<number>, uvM?: number, faceUv?: ((u: number, w: number, tipR: number) => number[]) | null, spokes?: boolean }} o
 */
export function layGear(f, rec, { r, teeth, at, phase = 0, shape = SD_WORKS_TOOTH, under = false, tipV = SD_WORKS_TIP_V, uvM = 2, faceUv = null, spokes = true }) {
  const S = shape, pitch = (2 * Math.PI) / teeth, mod = (2 * r) / teeth;
  const rt = r + S.out * mod, rr = r - S.in * mod, ri = rr - S.rim * r, rh = S.hub * r, top = S.h / 2, bot = -S.h / 2;
  const hubTop = top * (1 + S.hubProud), hubBot = bot * (1 + S.hubProud);
  const P = (rad, a, y) => at(Math.cos(a) * rad, Math.sin(a) * rad, y);
  const uv = (rad, a) => (faceUv ? faceUv(Math.cos(a) * rad, Math.sin(a) * rad, rt) : [(Math.cos(a) * rad) / uvM, (Math.sin(a) * rad) / uvM]);
  const above = at(0, 0, 1e4), below = at(0, 0, -1e4);
  /** a quad wound to face away from `from` (a point inside the solid it bounds, or far behind a face) */
  const away = (a, b, c, d, ua, ub, uc, ud, from) => {
    const n = cross(sub(b, a), sub(c, a)), m = sub([(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2], from);
    if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] >= 0) f.quad(rec, a, b, c, d, ua, ub, uc, ud);
    else f.quad(rec, d, c, b, a, ud, uc, ub, ua);
  };
  /** a face's heights and the far point each faces away from: its top, and its underside when `under` */
  const sidesOf = (t, b) => (under ? [{ y: t, from: below }, { y: b, from: above }] : [{ y: t, from: below }]);
  const sides = sidesOf(top, bot);
  for (let k = 0; k < teeth; k++) {
    const c = phase + k * pitch, a0 = c - pitch / 2, a1 = c + pitch / 2;
    const t0 = c - (pitch * S.tipW) / 2, t1 = c + (pitch * S.tipW) / 2, q0 = c - (pitch * S.rootW) / 2, q1 = c + (pitch * S.rootW) / 2, next = q0 + pitch;
    const inRim = P((ri + rr) / 2, c, 0), inTooth = P((rr + rt) / 2, c, 0);
    for (const { y, from } of sides) {
      away(P(ri, a0, y), P(ri, a1, y), P(rr, a1, y), P(rr, a0, y), uv(ri, a0), uv(ri, a1), uv(rr, a1), uv(rr, a0), from);   // the rim's band
      away(P(rr, q0, y), P(rr, q1, y), P(rt, t1, y), P(rt, t0, y), uv(rr, q0), uv(rr, q1), uv(rt, t1), uv(rt, t0), from);   // the tooth's face
    }
    away(P(rt, t0, bot), P(rt, t1, bot), P(rt, t1, top), P(rt, t0, top), [0, tipV[0]], [1, tipV[0]], [1, tipV[1]], [0, tipV[1]], inTooth);   // its tip: the glint
    away(P(rr, q0, bot), P(rt, t0, bot), P(rt, t0, top), P(rr, q0, top), [0, 0.2], [0.1, 0.2], [0.1, 0.3], [0, 0.3], inTooth);   // its flanks
    away(P(rr, q1, bot), P(rt, t1, bot), P(rt, t1, top), P(rr, q1, top), [0, 0.2], [0.1, 0.2], [0.1, 0.3], [0, 0.3], inTooth);
    away(P(rr, q1, bot), P(rr, next, bot), P(rr, next, top), P(rr, q1, top), [0, 0.4], [0.2, 0.4], [0.2, 0.5], [0, 0.5], inRim);   // the gap's floor
    away(P(ri, a0, bot), P(ri, a1, bot), P(ri, a1, top), P(ri, a0, top), [0, 0.6], [0.2, 0.6], [0.2, 0.7], [0, 0.7], P(rr, c, 0));   // the rim's inner wall
  }
  // the hub, standing proud of the rim: its face (and under), its wall
  const H = 16, mid = at(0, 0, 0);
  for (let k = 0; k < H; k++) {
    const a0 = (k / H) * 2 * Math.PI, a1 = ((k + 1) / H) * 2 * Math.PI;
    for (const { y, from } of sidesOf(hubTop, hubBot)) {
      const ctr = at(0, 0, y), p0 = P(rh, a0, y), p1 = P(rh, a1, y), n = cross(sub(p0, ctr), sub(p1, ctr)), m = sub(ctr, from);
      if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] >= 0) f.tri(rec, ctr, p0, p1, [0, 0.5], uv(rh, a0), uv(rh, a1));
      else f.tri(rec, ctr, p1, p0, [0, 0.5], uv(rh, a1), uv(rh, a0));
    }
    away(P(rh, a0, hubBot), P(rh, a1, hubBot), P(rh, a1, hubTop), P(rh, a0, hubTop), [0, 0.8], [0.1, 0.8], [0.1, 0.9], [0, 0.9], mid);
  }
  // the spokes, hub to rim between the teeth: a bar each, its face and its two sides
  if (spokes) {
    for (let k = 0; k < S.spokes; k++) {
      const a = phase + (k / S.spokes) * 2 * Math.PI + pitch / 2, hw = S.spokeW * r, ca = Math.cos(a), sa = Math.sin(a);
      const Q = (rad, side, y) => at(ca * rad - sa * side, sa * rad + ca * side, y);
      const ty = top * 0.7, by = bot * 0.7, inside = Q((rh + ri) / 2, 0, 0);
      for (const { y, from } of sidesOf(ty, by)) away(Q(rh, -hw, y), Q(ri, -hw, y), Q(ri, hw, y), Q(rh, hw, y), [0, 0.3], [0.6, 0.3], [0.6, 0.35], [0, 0.35], from);
      for (const sd of [-1, 1]) away(Q(rh, sd * hw, by), Q(ri, sd * hw, by), Q(ri, sd * hw, ty), Q(rh, sd * hw, ty), [0, 0.4], [0.6, 0.4], [0.6, 0.45], [0, 0.45], inside);
    }
  }
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];

/** The Works' face uv: the gear's whole face over the record's face, under its tip band. */
const worksFaceUv = (u, w, tipR) => [0.5 + u / (2 * tipR), SD_WORKS_FACE_V + (1 - SD_WORKS_FACE_V) * (0.5 + w / (2 * tipR))];
/** A gear of the Works in its own frame (its axle +y through the origin, its top face at y 0, its first tooth at bearing 0
 *  - the matrix turns it to its bearing): the model shape. */
export function buildWorksGear(g) {
  const f = faces(), h = SD_WORKS_TOOTH.h / 2;
  layGear(f, SD_WORKS_RECORD, { r: g.r, teeth: g.teeth, at: (u, w, y) => [u, y - h, w], faceUv: worksFaceUv });
  return packRealmFaces(f);
}

/** The matrix that stands gear `g` (one of SD_WORKS) in the dungeon's frame at the moment `now` (SD_HANG_NOW - its ticks of
 *  the escapement): turned about its axle to its bearing (a bearing toward +z from +x - the realm's frame is the dungeon's
 *  shifted, never turned), its top face at its height. Written into `out` (column-major) and returned; makes nothing. */
export function worksMatrix(g, now, out) {
  const a = worksAngle(g, now[SD_HANG_NOW.ticks]), c = Math.cos(a), s = Math.sin(a);
  out[0] = c; out[1] = 0; out[2] = s; out[3] = 0;
  out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
  out[8] = -s; out[9] = 0; out[10] = c; out[11] = 0;
  out[12] = g.at[0]; out[13] = g.at[1]; out[14] = g.at[2]; out[15] = 1;
  return out;
}
