// @ts-check
// SD6c (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 8): THE ORRERY'S ART - what
// the hall's stones, lecterns and lights wear (the realm's own pseudo-archive, world/sdRealm.js SD_REALM_ARCHIVE, records
// 5 to 20, after the Hour's five), made here in code as the Hour's are (world/sdRealmArt.js): nothing ships, the same
// pixels every boot. Each `{ albedo, emission }` in the renderer's color32 shape - RGBA rows, row 0 the texture's v 0, the
// BOTTOM of a face as world/sdHall.js lays it, so every picture here is drawn with y up.
//
// SD-LOOK S10 (2026-10-09; bible/11-Multiplayer/Super-Dungeons-Look.md section 7): REPAINTED through the Hour's paint box
// (world/sdPixelKit.js) from its ramps (world/sdLook.js SD_RAMP) - and the hall's sixteen pictures are ONE ATLAS now
// (SD_HALL_ATLAS, 256 x 256): the stones' dressed basalt and their plinths, each Ending's heraldry in relief (SD_SIGNS,
// the signs unchanged - brass, the Underking's crown in bone), six banners in their kingdoms' colours, the lecterns' open
// bronze ledgers numbered in pips, the dial's face and the handles' chevrons. Metal and stone do not glow; only the
// rubbed edge of a relief keeps 0.04. The records the atlas freed are the hall's states: the bezel's dim gold, the fray's
// dim ember, the gem's seven counts, the bridge's engraved plates, the Concord's band and its flash.
//
//   atlas   - record 5: stone, plinth, six emblems, six banners, six ledgers, dial, handle, bronze (SD_HALL_ATLAS cells)
//   band    - record 6: the Concord's band along the floor, Mantella running into gold (dithered, never blended)
//   dim     - records 7, 8: the bezel's gold as its stone frees, the fray's ember as its last tabs pulse
//   gem     - records 9 to 15: the soul-gem at a count of 0 to 6 - how many, never which
//   bridge  - record 16: twelve plates of hard light, each engraved with its hour, XII at the hall's rim
//   flash   - record 17: white-green, the moment (a rise of the dial, the gem's flare, the tabs blazing at the snap)
//   glow    - records 18 to 20: brass (the hands, a settling bezel), the Mantella's pale green (the dial's lit plates),
//             the fray's ember (a tab flipped, a refused bezel)
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { SD_RAMP } from './sdLook.js';
import { rng, noiseField, image, blendRgb, scale, ramp, step, bayer, paletteOf, quantize } from './sdPixelKit.js';
import { SD_GLYPHS, SD_HOUR_NUMERALS } from './sdSkyArt.js';   // the hours' glyphs (sdSkyArt reads SD_SIGNS only as it paints: the two may import each other)

/** The records (world/sdRealm.js SD_REALM_ARCHIVE), 5 to 20 - every one this module paints. */
export const SD_HALL_ATLAS_RECORD = 5;
export const SD_HALL_BAND_RECORD = 6;
export const SD_HALL_GOLD_DIM_RECORD = 7;
export const SD_HALL_EMBER_DIM_RECORD = 8;
export const SD_HALL_GEM_RECORD = 9;        // .. 15, the gem at a count of 0 to 6
export const SD_HALL_BRIDGE_RECORD = 16;
export const SD_HALL_FLASH_RECORD = 17;
export const SD_HALL_GLOW_RECORD = Object.freeze({ brass: 18, mantella: 19, fray: 20 });
export const SD_GLOW_COLORS = Object.freeze({ brass: Object.freeze([255, 214, 130]), mantella: Object.freeze([150, 255, 200]), fray: Object.freeze([255, 96, 40]) });
/** The flash's white-green: the moment, in the soul's family (the gem flares white-green, Super-Dungeons-Look.md 7). */
export const SD_FLASH_COLOR = Object.freeze([214, 255, 228]);

/** THE ATLAS (texels, y up): each cell `[x, y, w, h]`. The emblems at 128 texels a metre (a 0.5 m relief), the banners
 *  and the shafts at about 36-56 (a 0.9 x 2.2 m cloth, a 1.6 x 2.3 m face), the read in features 4-8 texels wide. */
export const SD_HALL_ATLAS = Object.freeze({
  size: 256,
  stone: Object.freeze([0, 0, 64, 128]),
  plinth: Object.freeze([0, 128, 64, 16]),
  emblem: Object.freeze([0, 1, 2, 3, 4, 5].map((k) => Object.freeze([64 + 64 * (k % 3), 64 * Math.floor(k / 3), 64, 64]))),
  banner: Object.freeze([0, 1, 2, 3, 4, 5].map((k) => Object.freeze([32 * k, 144, 32, 80]))),
  ledger: Object.freeze([0, 1, 2, 3, 4, 5].map((k) => Object.freeze([40 * k, 226, 40, 28]))),
  dial: Object.freeze([192, 128, 64, 64]),
  handle: Object.freeze([192, 192, 16, 32]),
  bronze: Object.freeze([208, 192, 16, 16]),
});
/** Where (s, t) of a cell (0..1 each, t up) falls in the atlas - texel centres first to last, so NEAREST never reads a
 *  neighbouring cell. */
export const atlasUv = (cell, s, t) => [(cell[0] + 0.5 + s * (cell[2] - 1)) / SD_HALL_ATLAS.size, (cell[1] + 0.5 + t * (cell[3] - 1)) / SD_HALL_ATLAS.size];

/** THE KINGDOMS' CLOTH (sRGB, dark to light, five steps) - matte, below the lights' saturation, and no blue (the Bay's
 *  sky is the Hour's only blue): Daggerfall's oxblood, Sentinel's umber, Wayrest's sea-green, Orsinium's iron, the
 *  Underking's violet-black, the Blades' char. */
export const SD_BANNER_RAMPS = Object.freeze([
  [[34, 12, 12], [56, 20, 18], [82, 30, 26], [110, 44, 36], [138, 62, 50]],
  [[40, 26, 14], [64, 42, 22], [92, 62, 32], [120, 84, 46], [148, 108, 64]],
  [[14, 30, 28], [22, 46, 42], [34, 64, 58], [48, 84, 76], [66, 106, 96]],
  [[24, 24, 22], [40, 38, 34], [58, 55, 50], [80, 76, 68], [104, 98, 88]],
  [[26, 14, 24], [42, 24, 40], [60, 36, 56], [80, 50, 74], [104, 68, 96]],
  [[14, 10, 10], [24, 18, 16], [36, 26, 22], [50, 36, 30], [66, 48, 40]],
].map((r) => Object.freeze(r.map((c) => Object.freeze(c)))));
/** The soul-gem's crystal (sRGB, dark to light) - the Mantella's green in glass. */
export const SD_GEM_RAMP = Object.freeze([[16, 34, 26], [30, 70, 50], [60, 130, 92], [100, 200, 140], [150, 255, 200]].map((c) => Object.freeze(c)));
/** The gem's own light at a count of `n` (0..6): never out, all of it at six, and every count its own - 0.2 + 0.8 n / 6
 *  (the spec's max(0.2, n / 6) read the same at none and at one: "how many" must tell them apart). */
export const gemGlow = (n) => (3 + 2 * Math.min(6, Math.max(0, n))) / 15;
/** The rubbed edge of a relief's own light, of its colour (world/sdRealmArt.js SD_BRASS_EDGE_GLOW's measure). */
export const SD_RELIEF_EDGE_GLOW = 0.04;

const { basalt: B, brass: Br, bronze: Bz, verdigris: Vg, pale: Pa } = SD_RAMP;

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

/** A die's pips for 1 to 6, in (u, v) - the same however its face is turned. */
export const SD_PIPS = Object.freeze([
  [[0, 0]],
  [[-0.4, -0.4], [0.4, 0.4]],
  [[-0.4, -0.4], [0, 0], [0.4, 0.4]],
  [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]],
  [[-0.4, -0.4], [0.4, -0.4], [0, 0], [-0.4, 0.4], [0.4, 0.4]],
  [[-0.4, -0.45], [0.4, -0.45], [-0.4, 0], [0.4, 0], [-0.4, 0.45], [0.4, 0.45]],
].map((p) => Object.freeze(p.map((q) => Object.freeze(q)))));

/** A painter clipped to one cell of `img`: `put(x, y, rgb)` and `at(x, y)` in the cell's own texels (y up). */
function cellOf(img, cell) {
  const [x0, y0, w, h] = cell, W = img.width;
  return {
    w, h,
    put(x, y, rgb) { if (x < 0 || y < 0 || x >= w || y >= h) return; const i = ((y0 + y) * W + x0 + x) * 4; img.colors[i] = rgb[0]; img.colors[i + 1] = rgb[1]; img.colors[i + 2] = rgb[2]; img.colors[i + 3] = 255; },
  };
}

/** The shafts' dressed basalt (64 x 128 for a 1.6 x 2.3 m face): courses of ashlar 14 texels high, blocks 32 long in
 *  running bond, each bevelled from the top-left, its joints dark, a chip here and there - the read in the blocks. */
function paintStone(c, seed) {
  const r = rng(seed), tone = noiseField(seed + 1, 4, c.w, c.h), fine = noiseField(seed + 2, 16, c.w, c.h);
  const C = 14, L = 32, shade = Array.from({ length: 24 }, () => 0.3 + 0.28 * r());
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const row = Math.floor(y / C), xs = x + (row % 2) * (L / 2), bx = xs % L, by = y % C;
    if (bx === 0 || by === 0) { c.put(x, y, step(B, 0)); continue; }
    const t = shade[(row * 3 + Math.floor(xs / L)) % 24] + 0.14 * (tone(x, y) - 0.5) + 0.06 * (fine(x, y) - 0.5);
    let col = ramp(B, t, x, y);
    if (by === C - 1 || bx === 1) col = step(B, 3);   // lit from the top-left
    else if (by === 1 || bx === L - 1) col = step(B, 1);
    c.put(x, y, col);
  }
  for (let n = 0; n < 6; n++) { const x = Math.floor(r() * c.w), y = Math.floor(r() * c.h); c.put(x, y, step(B, 0)); c.put(x + 1, y, step(B, 0)); c.put(x + 1, y - 1, step(B, 1)); }
}
/** The plinth's two steps (64 x 16): each a band of the darker basalt, its top edge rubbed light. */
function paintPlinth(c) {
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const band = y % 8;
    c.put(x, y, band === 7 ? step(B, 3) : band === 0 ? step(B, 0) : x % 16 === 0 ? step(B, 0) : ramp(B, 0.18 + 0.12 * (band / 7), x, y));
  }
}
/** An Ending's heraldry IN RELIEF (64 x 64, a 0.5 m plate): its sign raised in brass - in bone for the Underking - from
 *  a dark basalt plate in a bevelled brass frame. Light from the top-left: a sign's texel whose upper-left neighbour is
 *  plate is rubbed bright, whose lower-right is plate is in shadow, and the plate under the sign's lower-right falls in
 *  its shadow; the inner marks sunk, verdigris in brass's recesses. Only the rubbed edge glows, and barely. */
function paintEmblem(c, e, i) {
  const sign = SD_SIGNS[i], bone = i === 4, ink = bone ? Pa : Br;
  const m = (x, y) => (x < 4 || y < 4 || x >= c.w - 4 || y >= c.h - 4 ? 0 : sign((((x + 0.5) / c.w) * 2 - 1) / 0.8, (((y + 0.5) / c.h) * 2 - 1) / 0.8));
  const tone = noiseField(0x5d6a + i, 8, c.w, c.h);
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const edge = Math.min(x, y, c.w - 1 - x, c.h - 1 - y);
    if (edge < 3) { c.put(x, y, edge === 0 ? step(Br, 0) : (x < c.w / 2 && edge === 1) || y > c.h - 3 ? step(Br, 4) : step(Br, 2)); continue; }
    if (edge === 3) { c.put(x, y, step(B, 0)); continue; }
    const k = m(x, y);
    if (k >= 1) {
      const lit = m(x - 1, y + 1) < 1, shade = m(x + 1, y - 1) < 1;
      const col = lit ? step(ink, 4) : shade ? step(ink, bone ? 1 : 1) : ramp(ink, bone ? 0.62 : 0.5, x, y);
      c.put(x, y, col);
      if (lit && !bone) e.put(x, y, scale(step(Br, 5), SD_RELIEF_EDGE_GLOW));
    } else if (k > 0) c.put(x, y, bone ? step(Pa, 0) : (x + y) % 3 === 0 ? step(Vg, 1) : step(Br, 1));
    else c.put(x, y, m(x - 1, y + 1) >= 1 || m(x - 2, y + 2) >= 1 ? step(B, 0) : ramp(B, 0.22 + 0.16 * tone(x, y), x, y));
  }
}
/** A kingdom's BANNER (32 x 80, a 0.9 x 2.2 m cloth): its field in folds (a dithered rise and fall across it), a border,
 *  the stone's sign worked in thread on its upper half (outlined in the field's darkest), a band across its foot. The
 *  thread is gold-brown, bone for the Underking - cloth, never metal, never light. */
function paintBanner(c, k) {
  const F = SD_BANNER_RAMPS[k], thread = k === 4 ? Pa : Br, sign = SD_SIGNS[k];
  const m = (x, y) => { const u = (x + 0.5 - c.w / 2) / 14, v = (y + 0.5 - 50) / 14; return Math.abs(u) > 1 || Math.abs(v) > 1 ? 0 : sign(u / 0.86, v / 0.86); };
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const fold = 0.45 + 0.22 * Math.sin(((x + 0.5) / 8) * Math.PI * 2);
    let col = ramp(F, fold, x, y);
    if (x < 2 || x >= c.w - 2 || y >= c.h - 3) col = x === 0 || x === c.w - 1 || y === c.h - 1 ? step(F, 0) : step(thread, 2);
    else if (y >= 14 && y < 18) col = y === 14 ? step(F, 0) : step(thread, 2);
    const s = m(x, y);
    if (s >= 1) col = m(x - 1, y + 1) < 1 ? step(thread, 4) : step(thread, 3);
    else if (s > 0) col = step(thread, 1);
    else if (m(x + 1, y) >= 1 || m(x - 1, y) >= 1 || m(x, y + 1) >= 1 || m(x, y - 1) >= 1) col = step(F, 0);
    c.put(x, y, col);
  }
}
/** A lectern's open BRONZE LEDGER (40 x 28 for its 1.0 x 0.7 m rest): dark bronze boards, two pages of light bronze about
 *  a dark spine - the left numbered in brass pips as a die is (the same however a face is turned: no numeral to read
 *  backwards), the right engraved in lines of the Ledger's hand. */
function paintLedger(c, k) {
  const pips = SD_PIPS[k], mid = Math.floor(c.w / 2);
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    let col;
    if (x < 2 || x >= c.w - 2 || y < 2 || y >= c.h - 2) col = x === 0 || y === 0 || x === c.w - 1 || y === c.h - 1 ? step(Bz, 0) : step(Bz, 1);
    else if (x === mid - 1 || x === mid) col = step(Bz, 0);
    else {
      col = ramp(Bz, x < mid ? 0.82 : 0.78, x, y);
      if (y === c.h - 3) col = step(Bz, 4);
      if (x > mid + 1 && x < c.w - 4 && y > 4 && y < c.h - 5 && y % 3 === 0 && (x * 7 + y * 3) % 11 > 1) col = step(Bz, 1);   // its lines
    }
    c.put(x, y, col);
  }
  const cx = (mid - 1) / 2 + 0.5, cy = c.h / 2;
  for (const [px, py] of pips) {
    const x0 = Math.round(cx + px * 11 - 1.5), y0 = Math.round(cy + py * 13 - 1.5);   // a pip three texels across, lit top-left
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) c.put(x0 + dx, y0 + dy, dx === 0 || dy === 2 ? step(Br, 5) : step(Br, 3));
    for (let d = 0; d < 3; d++) { c.put(x0 + 3, y0 + d - 1, step(Bz, 0)); c.put(x0 + d + 1, y0 - 1, step(Bz, 0)); }
  }
}
/** A stone's DIAL FACE (64 x 64 for its 1 m disc): dark basalt, twelve brass hours (the quarters longer), a ring within.
 *  The twelfth's mark is the bezel's built notch (world/sdHall.js), so no picture can turn it; the bezel covers the rim. */
function paintDial(c) {
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const u = ((x + 0.5) / c.w) * 2 - 1, v = ((y + 0.5) / c.h) * 2 - 1, r = Math.hypot(u, v);
    const hour = ((Math.atan2(u, v) / (Math.PI * 2)) * 12 + 12) % 12, off = Math.abs(hour - Math.round(hour)) * (Math.PI / 6) * r;
    const quarter = Math.round(hour) % 3 === 0;
    let col = ramp(B, 0.12 + 0.12 * (1 - r), x, y);
    if (r > (quarter ? 0.5 : 0.6) && r < 0.84 && off < (quarter ? 0.06 : 0.042)) col = off < 0.02 ? step(Br, 4) : step(Br, 2);
    else if (r > 0.28 && r < 0.32) col = step(Br, 1);
    c.put(x, y, col);
  }
}
/** A HANDLE's cast lever face (16 x 32): brass, its chevron raised and pointing to +u (world/sdHall.js lays it forward
 *  on the right handle, mirrored - back - on the left), riveted top and foot. */
function paintHandle(c) {
  const chev = (x, y) => { const d = Math.abs(y - 15.5) * 0.55, xr = c.w - 1 - x; return xr - 4 >= d && xr - 4 < d + 3.2; };   // its point at +u
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    let col = x === 0 || y === 0 ? step(Br, 4) : x === c.w - 1 || y === c.h - 1 ? step(Br, 0) : ramp(Br, 0.35, x, y);
    if (chev(x, y)) col = !chev(x - 1, y + 1) ? step(Br, 5) : !chev(x + 1, y - 1) ? step(Br, 1) : step(Br, 3);
    c.put(x, y, col);
  }
  for (const y of [3, c.h - 4]) { c.put(7, y, step(Br, 4)); c.put(8, y, step(Br, 5)); c.put(8, y - 1, step(Br, 0)); c.put(9, y - 1, step(Br, 0)); }
}
/** Dark bronze (16 x 16): the dial's sunk plates, a ledger's boards - bevelled, quiet. */
function paintBronze(c) {
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) c.put(x, y, x === 0 || y === c.h - 1 ? step(Bz, 3) : x === c.w - 1 || y === 0 ? step(Bz, 0) : ramp(Bz, 0.28, x, y));
}

/** THE HALL'S ATLAS: every cell painted, then every texel forced into the ramps it was painted from. */
export function hallAtlasArt() {
  const S = SD_HALL_ATLAS.size, A = SD_HALL_ATLAS, albedo = image(S), emission = image(S);
  for (let i = 0; i < S * S; i++) albedo.colors[i * 4 + 3] = emission.colors[i * 4 + 3] = 255;
  paintStone(cellOf(albedo, A.stone), 0x5d60);
  paintPlinth(cellOf(albedo, A.plinth));
  for (let i = 0; i < 6; i++) paintEmblem(cellOf(albedo, A.emblem[i]), cellOf(emission, A.emblem[i]), i);
  for (let k = 0; k < 6; k++) paintBanner(cellOf(albedo, A.banner[k]), k);
  for (let k = 0; k < 6; k++) paintLedger(cellOf(albedo, A.ledger[k]), k);
  paintDial(cellOf(albedo, A.dial));
  paintHandle(cellOf(albedo, A.handle));
  paintBronze(cellOf(albedo, A.bronze));
  quantize(albedo, paletteOf(B, Br, Bz, Vg, Pa, ...SD_BANNER_RAMPS));
  return { albedo, emission };
}

/** An S-square light: its colour as albedo and as much again its own light (`k` of it). */
const lightArt = (S, color, k = 1) => {
  const albedo = image(S), emission = image(S);
  for (let i = 0; i < S * S; i++) for (let c = 0; c < 4; c++) { albedo.colors[i * 4 + c] = c < 3 ? color[c] : 255; emission.colors[i * 4 + c] = c < 3 ? Math.round(color[c] * k) : 255; }
  return { albedo, emission };
};
/** A light the hall gives: its colour, and as much again its own light. */
export function hallGlowArt(color) {
  return lightArt(16, color);
}
/** THE CONCORD'S BAND (16 x 64, v from the hub to the rim): the Mantella's green running into gold through the ordered
 *  dither - each texel one or the other, never a blend between. */
export function hallBandArt() {
  const W = 16, H = 64, albedo = image(W, H), emission = image(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = (y + 0.5) / H > bayer(x, y) ? SD_GLOW_COLORS.brass : SD_GLOW_COLORS.mantella, i = (y * W + x) * 4;
    for (let k = 0; k < 3; k++) albedo.colors[i + k] = emission.colors[i + k] = c[k];
    albedo.colors[i + 3] = emission.colors[i + 3] = 255;
  }
  return { albedo, emission };
}
/** THE SOUL-GEM at a count of `n` (16 x 16): its facets in the crystal's ramp (bands across it, lit from the top-left),
 *  its own light gemGlow(n) - how many stand true, never which. */
export function hallGemArt(n) {
  const S = 16, albedo = image(S), emission = image(S), k = gemGlow(n);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const facet = Math.floor((x + y) / 4) % 3, t = (0.35 + 0.2 * facet + (x < 2 || y > S - 3 ? 0.25 : 0)) * (0.55 + 0.45 * k);
    const c = ramp(SD_GEM_RAMP, t, x, y), i = (y * S + x) * 4;
    for (let j = 0; j < 3; j++) { albedo.colors[i + j] = c[j]; emission.colors[i + j] = Math.round(SD_GEM_RAMP[4][j] * k * (0.7 + 0.3 * (t > 0.6 ? 1 : 0))); }
    albedo.colors[i + 3] = emission.colors[i + 3] = 255;
  }
  quantize(albedo, paletteOf(SD_GEM_RAMP));
  return { albedo, emission };
}
/** THE BRIDGE'S PLATES (64 x 192: twelve cells of 64 x 16, plate j from the hall's rim): hard light, a gold rim round
 *  each, its hour ENGRAVED in it - the Hour's own glyphs (world/sdSkyArt.js), two texels a cell, XII at the rim and back
 *  to I at the first step (time runs back inside the Hour). */
export function hallBridgeArt() {
  const W = 64, H = 192, albedo = image(W, H), emission = image(W, H);
  const ENGRAVED = scale(SD_GLOW_COLORS.mantella, 0.45);
  const put = (x, y, c, k = 1) => { const i = (y * W + x) * 4; for (let j = 0; j < 3; j++) { albedo.colors[i + j] = c[j]; emission.colors[i + j] = Math.round(c[j] * k); } albedo.colors[i + 3] = emission.colors[i + 3] = 255; };
  for (let j = 0; j < 12; j++) {
    const s = SD_HOUR_NUMERALS[(12 - j) % 12], y0 = j * 16;
    for (let y = 0; y < 16; y++) for (let x = 0; x < W; x++) put(x, y0 + y, x === 0 || x === W - 1 || y === 0 || y === 15 ? SD_GLOW_COLORS.brass : SD_GLOW_COLORS.mantella, 1);
    // the numeral: its glyphs 5 x 7 cells (I one column), a cell between each, two texels a cell - foot toward the rim
    const cells = [];
    let cx = 0;
    for (const ch of s) { const g = SD_GLYPHS[ch]; for (let gx = 0; gx < g.w; gx++) for (let gy = 0; gy < 7; gy++) if ((g.rows[gy] >> (g.w - 1 - gx)) & 1) cells.push([cx + gx, gy]); cx += g.w + 1; }
    const w = cx - 1, ox = Math.floor((W - w * 2) / 2);
    for (const [gx, gy] of cells) for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) put(ox + gx * 2 + dx, y0 + 1 + (6 - gy) * 2 + dy, ENGRAVED, 0.6);   // cut into the light: darker, and dimmer
  }
  return { albedo, emission };
}

/** Every picture the hall wears, by record: `[record, { albedo, emission }]` - records 5 to 20, each once.
 * @returns {Array<[number, { albedo: import('./sdPixelKit.js').Img, emission: import('./sdPixelKit.js').Img }]>} */
export function hallArt() {
  /** @type {Array<[number, { albedo: import('./sdPixelKit.js').Img, emission: import('./sdPixelKit.js').Img }]>} */
  const out = [[SD_HALL_ATLAS_RECORD, hallAtlasArt()], [SD_HALL_BAND_RECORD, hallBandArt()]];
  out.push([SD_HALL_GOLD_DIM_RECORD, lightArt(16, blendRgb([0, 0, 0], SD_GLOW_COLORS.brass, 0.6), 0.45)]);
  out.push([SD_HALL_EMBER_DIM_RECORD, lightArt(16, blendRgb([0, 0, 0], SD_GLOW_COLORS.fray, 0.55), 0.4)]);
  for (let n = 0; n <= 6; n++) out.push([SD_HALL_GEM_RECORD + n, hallGemArt(n)]);
  out.push([SD_HALL_BRIDGE_RECORD, hallBridgeArt()], [SD_HALL_FLASH_RECORD, lightArt(16, SD_FLASH_COLOR)]);
  for (const [k, rec] of Object.entries(SD_HALL_GLOW_RECORD)) out.push([rec, hallGlowArt(SD_GLOW_COLORS[k])]);
  return out;
}
