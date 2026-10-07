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

/** Its parts, its own frame, at the Remnant's own height (an Echo is scaled to its own - remnantScale). */
export const SD_REMNANT_BODY = Object.freeze({
  legX: 0.85, legW: 0.95, legD: 1.05, legH: 3.0,
  hipH: 0.6, hipW: 2.5, hipD: 1.35,
  cageH: 2.3, cageRX: 1.25, cageRZ: 0.85, bars: 8, bar: 0.16,
  heartY: 4.75, heartR: 0.55,
  shoulderH: 0.6, shoulderW: 3.3, shoulderD: 1.25,
  armX: 1.95, armW: 0.72, armD: 0.82, armBot: 3.1,
  headW: 0.95, headD: 0.95, eyeY: 0.45, eyeX: 0.2, eyeW: 0.16, eyeH: 0.08,
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
/** Every face of a body, each into the collector `into(part)` answers for its part (SD18c: its heart and eyes in `ending`'s
 *  light). */
function emitRemnant(metal, into, ending = null) {
  const B = SD_REMNANT_BODY, W = SD_REMNANT_WEAR[metal];
  // the legs, the hip
  for (const s of [-1, 1]) box(into(s < 0 ? 'legR' : 'legL'), W.metal, s * B.legX, 0, 0, B.legW, B.legH, B.legD);
  box(into('pelvis'), W.joint, 0, B.legH, 0, B.hipW, B.hipH, B.hipD);
  let f = into('torso');
  // the cage: bars on an ellipse about the heart, from the hip to the shoulders
  const cy0 = B.legH + B.hipH;
  for (let k = 0; k < B.bars; k++) {
    const a = (k / B.bars) * Math.PI * 2;
    box(f, W.metal, Math.cos(a) * B.cageRX, cy0, Math.sin(a) * B.cageRZ, B.bar, B.cageH, B.bar);
  }
  shard(f, heartRecordOf(ending), 0, 0, B.heartY - B.heartR, B.heartY, B.heartY + B.heartR, B.heartR);
  // the shoulders, the arms hanging from them, the head and its eyes
  const sy = cy0 + B.cageH;
  box(f, W.metal, 0, sy, 0, B.shoulderW, B.shoulderH, B.shoulderD);
  for (const s of [-1, 1]) box(into(s < 0 ? 'armR' : 'armL'), W.metal, s * B.armX, B.armBot, 0, B.armW, sy + B.shoulderH - B.armBot, B.armD);
  const hy = sy + B.shoulderH, headH = SD_REM.h - hy;
  f = into('head');
  box(f, W.joint, 0, hy, 0, B.headW, headH, B.headD);
  for (const s of [-1, 1]) {
    const ex = s * B.eyeX, ey = hy + B.eyeY, ez = B.headD / 2 + 0.01;
    f.quad(eyeRecordOf(ending), [ex - B.eyeW / 2, ey, ez], [ex + B.eyeW / 2, ey, ez], [ex + B.eyeW / 2, ey + B.eyeH, ez], [ex - B.eyeW / 2, ey + B.eyeH, ez], [0, 0], [1, 0], [1, 1], [0, 1]);
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
