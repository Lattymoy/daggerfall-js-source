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
import { SD_REMNANT_GOLD_RECORD, SD_REMNANT_SILVER_RECORD } from './sdRemnantArt.js';
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

/** THE REMNANT (or an Echo, in `metal` 'gold' or 'silver'), one mesh in its own frame. */
export function buildRemnantModel(metal = 'brass') {
  const B = SD_REMNANT_BODY, W = SD_REMNANT_WEAR[metal], f = faces();
  // the legs, the hip
  for (const s of [-1, 1]) box(f, W.metal, s * B.legX, 0, 0, B.legW, B.legH, B.legD);
  box(f, W.joint, 0, B.legH, 0, B.hipW, B.hipH, B.hipD);
  // the cage: bars on an ellipse about the heart, from the hip to the shoulders
  const cy0 = B.legH + B.hipH;
  for (let k = 0; k < B.bars; k++) {
    const a = (k / B.bars) * Math.PI * 2;
    box(f, W.metal, Math.cos(a) * B.cageRX, cy0, Math.sin(a) * B.cageRZ, B.bar, B.cageH, B.bar);
  }
  shard(f, SD_REMNANT_HEART_RECORD, 0, 0, B.heartY - B.heartR, B.heartY, B.heartY + B.heartR, B.heartR);
  // the shoulders, the arms hanging from them, the head and its eyes
  const sy = cy0 + B.cageH;
  box(f, W.metal, 0, sy, 0, B.shoulderW, B.shoulderH, B.shoulderD);
  for (const s of [-1, 1]) box(f, W.metal, s * B.armX, B.armBot, 0, B.armW, sy + B.shoulderH - B.armBot, B.armD);
  const hy = sy + B.shoulderH, headH = SD_REM.h - hy;
  box(f, W.joint, 0, hy, 0, B.headW, headH, B.headD);
  for (const s of [-1, 1]) {
    const ex = s * B.eyeX, ey = hy + B.eyeY, ez = B.headD / 2 + 0.01;
    f.quad(SD_REMNANT_EYE_RECORD, [ex - B.eyeW / 2, ey, ez], [ex + B.eyeW / 2, ey, ez], [ex + B.eyeW / 2, ey + B.eyeH, ez], [ex - B.eyeW / 2, ey + B.eyeH, ez], [0, 0], [1, 0], [1, 1], [0, 1]);
  }
  return packRealmFaces(f);
}
/** A HEART of the Reset: a shard of the heart's own light, SD_HEART tall and across, its waist low. */
export function buildHeartModel() {
  const f = faces();
  shard(f, SD_REMNANT_HEART_RECORD, 0, 0, 0, SD_HEART.h * 0.35, SD_HEART.h, SD_HEART.r);
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
