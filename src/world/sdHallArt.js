// @ts-check
// SD6c (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 8): THE ORRERY'S ART - what
// the hall's stones, plaques and lights wear (the realm's own pseudo-archive, world/sdRealm.js SD_REALM_ARCHIVE, records
// after the Hour's five), made here in code as the Hour's are (world/sdRealmArt.js): nothing ships, the same pixels every
// boot. Each `{ albedo, emission }` in the renderer's color32 shape - RGBA rows, row 0 the texture's v 0, the BOTTOM of a
// face as world/sdHall.js lays it, so every picture here is drawn with y up.
//
//   face    - a stone's dial: dark stone, a brass ring and twelve equal brass hours (the twelfth is the stone's own notch,
//             built - world/sdHall.js - so no picture can turn it)
//   emblem  - each stone's sign in bright brass on a dark plate: the lion's face, the sun, the ship, the tusk, the crown
//             of bone (pale, bone not brass), the dragon
//   plaque  - a Ledger plaque, bronze with a raised border, numbered in brass pips as a die is (the same however a face
//             is turned: no numeral to read backwards)
//   glow    - a light the hall gives: brass (the hands), the Mantella's pale green (the dial's lit ring, the bridge), the
//             fray's ember red
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).

/** The records, after the Hour's five (world/sdRealm.js): a face, six emblems, six plaques, three glows. */
export const SD_HALL_FACE_RECORD = 5;
export const SD_HALL_EMBLEM_RECORD = 6;     // .. 11, a stone's by its index
export const SD_HALL_PLAQUE_RECORD = 12;    // .. 17, a plaque's by its index
export const SD_HALL_GLOW_RECORD = Object.freeze({ brass: 18, mantella: 19, fray: 20 });
/** The pictures' sides, texels. */
export const SD_HALL_ART_SIZE = 64;
export const SD_EMBLEM_SIZE = 128;
const BRASS = [196, 146, 64], BRASS_BRIGHT = [246, 206, 120], STONE = [34, 30, 28], STONE_DARK = [16, 14, 14];
const BRONZE = [120, 78, 40], BRONZE_DARK = [70, 44, 24], BONE = [232, 222, 196];
export const SD_GLOW_COLORS = Object.freeze({ brass: Object.freeze([255, 214, 130]), mantella: Object.freeze([150, 255, 200]), fray: Object.freeze([255, 96, 40]) });

const image = (S) => ({ width: S, height: S, colors: new Uint8Array(S * S * 4) });
const put = (img, x, y, rgb) => { const i = (y * img.width + x) * 4; img.colors[i] = rgb[0]; img.colors[i + 1] = rgb[1]; img.colors[i + 2] = rgb[2]; img.colors[i + 3] = 255; };
const mix = (a, b, t) => [0, 1, 2].map((k) => Math.round(Math.max(0, Math.min(255, a[k] + (b[k] - a[k]) * t))));
const scale = (c, k) => mix([0, 0, 0], c, k);
/** Every texel of an S-square picture, (u, v) in [-1, 1] with v UP, painted by `paint(u, v)` -> [albedo, emission]. */
function paintAll(S, paint) {
  const albedo = image(S), emission = image(S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const [a, e] = paint(((x + 0.5) / S) * 2 - 1, ((y + 0.5) / S) * 2 - 1);
    put(albedo, x, y, a); put(emission, x, y, e);
  }
  return { albedo, emission };
}

/** A stone's dial: dark stone, a brass ring, twelve equal hours between it and the hub. */
export function hallFaceArt() {
  return paintAll(SD_HALL_ART_SIZE, (u, v) => {
    const r = Math.hypot(u, v), hour = ((Math.atan2(u, v) / (Math.PI * 2)) * 12 + 12) % 12;
    const tick = Math.abs(hour - Math.round(hour)) * (Math.PI / 6) * r;
    if (r > 0.86 && r < 0.95) return [BRASS, scale(BRASS, 0.3)];
    if (r > 0.62 && r < 0.82 && tick < 0.045) return [BRASS_BRIGHT, scale(BRASS, 0.45)];
    return [mix(STONE_DARK, STONE, 0.6 - 0.4 * r), [0, 0, 0]];
  });
}

/** Distance from (px, py) to the segment a-b. */
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
/** Whether (u, v) lies in the triangle a, b, c. */
const inTri = (u, v, a, b, c) => {
  const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const d1 = s([u, v], a, b), d2 = s([u, v], b, c), d3 = s([u, v], c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};

/** The six signs, each a mask over (u, v) - 1 where the sign is, 0.5 for its darker inner marks, 0 elsewhere. */
export const SD_SIGNS = Object.freeze([
  // the lion: a face front on - the mane in ten lobes, the face, two eyes, the nose
  (u, v) => {
    const r = Math.hypot(u, v), a = Math.atan2(u, v);
    if (Math.hypot(u - 0.17, v - 0.1) < 0.06 || Math.hypot(u + 0.17, v - 0.1) < 0.06) return 0.5;
    if (inTri(u, v, [-0.08, -0.04], [0.08, -0.04], [0, -0.16])) return 0.5;
    if (r < 0.4) return 1;
    return r > 0.46 && r < 0.66 + 0.07 * Math.cos(a * 10) ? 1 : 0;
  },
  // the sun: a disc and twelve rays
  (u, v) => {
    const r = Math.hypot(u, v);
    if (r < 0.3) return 1;
    const sector = ((Math.atan2(u, v) / (Math.PI * 2)) * 12 + 12) % 1;
    const half = 0.42 * Math.max(0, (0.8 - r) / 0.44);
    return r > 0.36 && r < 0.8 && Math.abs(sector - 0.5) < half ? 1 : 0;
  },
  // the ship: a hull on the water, its mast and its sail
  (u, v) => {
    if (v > -0.45 && v < -0.2 && Math.abs(u) < 0.45 + (v + 0.45) * 0.8) return 1;
    if (Math.abs(u) < 0.035 && v >= -0.2 && v < 0.62) return 1;
    if (inTri(u, v, [0.07, 0.56], [0.07, -0.12], [0.52, -0.12])) return 1;
    if (inTri(u, v, [-0.06, 0.5], [-0.06, -0.12], [-0.38, -0.12])) return 0.5;
    return Math.abs(v - (-0.58 + 0.03 * Math.sin(u * 14))) < 0.025 && Math.abs(u) < 0.7 ? 1 : 0;
  },
  // the tusk: a horn of ivory curving up from its root to a point
  (u, v) => {
    const cx = 0.55, cy = -0.6, R = 1.0, d = Math.hypot(u - cx, v - cy), a = Math.atan2(v - cy, u - cx);
    const a0 = Math.PI * 0.98, a1 = Math.PI * 0.5, t = (a0 - a) / (a0 - a1);
    if (t < 0 || t > 1) return 0;
    const w = 0.2 * Math.pow(1 - t, 0.8);
    if (Math.abs(d - R) >= w) return 0;
    return t < 0.18 && Math.abs(d - R) < w * 0.35 ? 0.5 : 1;
  },
  // the crown of bone: a band and five points, the middle tallest
  (u, v) => {
    if (v > -0.38 && v < -0.12 && Math.abs(u) < 0.58) return Math.abs(v + 0.25) < 0.035 ? 0.5 : 1;
    const xs = [-0.44, -0.22, 0, 0.22, 0.44], hs = [0.28, 0.4, 0.56, 0.4, 0.28];
    for (let k = 0; k < 5; k++) if (inTri(u, v, [xs[k] - 0.09, -0.12], [xs[k] + 0.09, -0.12], [xs[k], -0.12 + hs[k]])) return 1;
    return 0;
  },
  // the dragon: a wyvern - its body, its neck rising to a horned head, two wings raised, a tail sweeping down
  (u, v) => {
    const tube = (pts, w0, w1) => { for (let k = 0; k < pts.length - 1; k++) { const t = k / (pts.length - 1); if (segDist(u, v, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]) < w0 + (w1 - w0) * t) return true; } return false; };
    if (Math.hypot(u - 0.36, v - 0.33) < 0.035) return 0.5;   // its eye
    if (((u - 0.0) / 0.24) ** 2 + ((v + 0.12) / 0.14) ** 2 < 1) return 1;   // the body
    if (tube([[0.12, -0.06], [0.24, 0.1], [0.3, 0.26]], 0.08, 0.06)) return 1;   // the neck
    if (inTri(u, v, [0.24, 0.22], [0.27, 0.42], [0.58, 0.3]) || inTri(u, v, [0.28, 0.4], [0.35, 0.4], [0.25, 0.56])) return 1;   // the head, its horn
    if (tube([[-0.2, -0.16], [-0.38, -0.3], [-0.5, -0.46], [-0.66, -0.5]], 0.07, 0.015)) return 1;   // the tail
    if (inTri(u, v, [-0.72, -0.5], [-0.62, -0.42], [-0.6, -0.58])) return 1;   // its barb
    if (tube([[-0.08, -0.24], [-0.1, -0.38]], 0.035, 0.03) || tube([[0.1, -0.24], [0.12, -0.38]], 0.035, 0.03)) return 1;   // the legs
    const wing = inTri(u, v, [-0.12, -0.04], [0.1, -0.02], [-0.18, 0.66]) || inTri(u, v, [-0.12, -0.04], [-0.18, 0.66], [-0.6, 0.42]);
    if (wing) return segDist(u, v, -0.18, 0.66, 0.1, -0.02) < 0.035 || segDist(u, v, -0.18, 0.66, -0.6, 0.42) < 0.035 ? 1 : 0.5;
    return 0;
  },
]);

/** A stone's emblem: its sign on a dark plate in a brass rim - the crown of bone in bone, the rest in brass. */
export function hallEmblemArt(i) {
  const sign = SD_SIGNS[i], ink = i === 4 ? BONE : BRASS_BRIGHT;
  return paintAll(SD_EMBLEM_SIZE, (u, v) => {
    const edge = Math.max(Math.abs(u), Math.abs(v));
    if (edge > 0.9) return [BRASS, scale(BRASS, 0.2)];
    const m = sign(u / 0.86, v / 0.86);
    if (m >= 1) return [ink, scale(ink, 0.55)];
    if (m > 0) return [mix(STONE_DARK, ink, 0.35), scale(ink, 0.15)];
    return [mix(STONE_DARK, STONE, 0.5), [0, 0, 0]];
  });
}

/** A die's pips for 1 to 6, in (u, v) - the same however its face is turned. */
export const SD_PIPS = Object.freeze([
  [[0, 0]],
  [[-0.4, -0.4], [0.4, 0.4]],
  [[-0.4, -0.4], [0, 0], [0.4, 0.4]],
  [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]],
  [[-0.4, -0.4], [0.4, -0.4], [0, 0], [-0.4, 0.4], [0.4, 0.4]],
  [[-0.4, -0.45], [0.4, -0.45], [-0.4, 0], [0.4, 0], [-0.4, 0.45], [0.4, 0.45]],
].map((p) => Object.freeze(p.map((q) => Object.freeze(q)))));

/** A Ledger plaque, numbered k + 1 in brass pips. */
export function hallPlaqueArt(k) {
  const pips = SD_PIPS[k];
  return paintAll(SD_HALL_ART_SIZE, (u, v) => {
    const edge = Math.max(Math.abs(u), Math.abs(v));
    if (edge > 0.88) return [BRONZE, scale(BRONZE, 0.1)];
    if (edge > 0.8) return [BRONZE_DARK, [0, 0, 0]];
    if (pips.some(([px, py]) => Math.hypot(u - px * 0.75, v - py * 0.75) < 0.12)) return [BRASS_BRIGHT, scale(BRASS, 0.5)];
    return [mix(BRONZE_DARK, BRONZE, 0.55), [0, 0, 0]];
  });
}

/** A light the hall gives: its colour, and as much again its own light. */
export function hallGlowArt(color) {
  return paintAll(16, () => [[...color], [...color]]);
}

/** Every picture the hall wears, by record: `[record, { albedo, emission }]`.
 * @returns {Array<[number, ReturnType<typeof paintAll>]>} */
export function hallArt() {
  /** @type {Array<[number, ReturnType<typeof paintAll>]>} */
  const out = [[SD_HALL_FACE_RECORD, hallFaceArt()]];
  for (let i = 0; i < SD_SIGNS.length; i++) out.push([SD_HALL_EMBLEM_RECORD + i, hallEmblemArt(i)]);
  for (let k = 0; k < SD_PIPS.length; k++) out.push([SD_HALL_PLAQUE_RECORD + k, hallPlaqueArt(k)]);
  for (const [k, rec] of Object.entries(SD_HALL_GLOW_RECORD)) out.push([rec, hallGlowArt(SD_GLOW_COLORS[k])]);
  return out;
}
