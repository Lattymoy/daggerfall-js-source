// @ts-check
// STOREFRONT (2026-10-29, the owner: "Portal effects would influence both companion and portal stone portals";
// bible/06-Systems/Storefront.md section 5): THE PORTAL SKINS - what a portal of a wearer's stands as, painted here in the
// art's own chunky pixels as COMPANION-PORTAL's violet vortex is (scenes/portalFx.js portalFrame): each skin's vortex,
// and the pieces that stand about it - the Daedric Stone's iron arch, the Aetheric Stone's crystals, the Brass Gate's
// cogs - with where each stands as the portal opens, holds and seals. Every frame is RGBA rows from the BOTTOM up (a world
// billboard's color32 order), so an arch's point is at its top. Pure. Not a DFU member.

import { wrapAngle } from '../world/mat4.js';   // ONCRASH1 C2: the one angle wrap

/** The skins (net/effectLaw.js PORTAL_SKINS). */
export const PORTAL_SKIN_KEYS = Object.freeze(['runic', 'daedric', 'aetheric', 'brass']);
const TAU = Math.PI * 2;
const clamp01 = (/** @type {number} */ x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (/** @type {number} */ a, /** @type {number} */ b, /** @type {number} */ x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
/** A hash of two whole numbers and a seed, 0..1 - the same pixel every frame and every machine. */
const hash = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** The skins' runes: five rows of three bits a glyph, top row first - carved round a rim. */
const RUNES = Object.freeze([
  [0b010, 0b111, 0b010, 0b010, 0b010], [0b101, 0b101, 0b111, 0b001, 0b001], [0b111, 0b100, 0b110, 0b100, 0b111], [0b110, 0b101, 0b110, 0b101, 0b110],
  [0b011, 0b100, 0b010, 0b001, 0b110], [0b101, 0b010, 0b101, 0b010, 0b101], [0b111, 0b010, 0b010, 0b010, 0b111], [0b100, 0b110, 0b111, 0b110, 0b100],
  [0b001, 0b011, 0b111, 0b011, 0b001], [0b111, 0b101, 0b101, 0b101, 0b111], [0b010, 0b101, 0b111, 0b101, 0b010], [0b110, 0b011, 0b001, 0b011, 0b110],
]);
/** Whether the rune `g` lights the cell (cx 0..2, cy 0..4 from its top). */
const runeOn = (/** @type {number} */ g, /** @type {number} */ cx, /** @type {number} */ cy) => cx >= 0 && cx < 3 && cy >= 0 && cy < 5 && ((RUNES[g % RUNES.length][cy] >> (2 - cx)) & 1) === 1;
/** A rune band round a rim: lit 0..1 at polar (r, a) - `slots` glyphs between radii r0 and r1, turned by `turn`. */
function runeBand(/** @type {number} */ r, /** @type {number} */ a, /** @type {number} */ r0, /** @type {number} */ r1, /** @type {number} */ slots, /** @type {number} */ turn, /** @type {number} */ seed) {
  if (r < r0 || r > r1) return 0;
  const s = (((a + turn) / TAU) % 1 + 1) % 1 * slots, i = Math.floor(s), f = s - i;
  const cx = Math.floor((f - 0.2) / 0.6 * 3), cy = Math.floor((1 - (r - r0) / (r1 - r0)) * 5);
  return runeOn(i * 7 + seed, cx, cy) ? 1 : 0;
}
const put = (/** @type {Uint8ClampedArray} */ out, /** @type {number} */ o, /** @type {number} */ R, /** @type {number} */ G, /** @type {number} */ B, /** @type {number} */ A) => { out[o] = R; out[o + 1] = G; out[o + 2] = B; out[o + 3] = A; };
/** A frame's canvas: `fn(u, v, x, y)` answers [r, g, b, a] or null (clear) - u, v -1..1, v up. */
function paint(/** @type {number} */ w, /** @type {number} */ h, /** @type {(u: number, v: number, x: number, y: number) => number[]|null} */ fn) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fn(((x + 0.5) / w) * 2 - 1, ((y + 0.5) / h) * 2 - 1, x, y);
    if (c) put(out, (y * w + x) * 4, c[0], c[1], c[2], c[3]);
  }
  return { width: w, height: h, colors: out };
}
const mixC = (/** @type {number[]} */ a, /** @type {number[]} */ b, /** @type {number} */ t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ═══ THE VORTEXES ═══════════════════════════════════════════════════════════════════════════════════════════════════
/** RUNIC STONE: an ice-blue vortex inside a ring of carved stone, its runes glowing as the light turns past them. */
function runic(/** @type {number} */ k, /** @type {number} */ n, /** @type {number} */ w, /** @type {number} */ h) {
  const ph = (k / n) * TAU;
  return paint(w, h, (u, v, x, y) => {
    const r = Math.hypot(u, v);
    if (r > 1) return null;
    const a = Math.atan2(v, u);
    if (r > 0.8) {   // the stone ring, its grain in two-pixel blocks, its runes cut in and lit by the turning light
      const g = 0.75 + 0.25 * hash(x >> 1, y >> 1, 7), edge = 1 - 0.35 * smooth(0.95, 1, r) - 0.25 * (1 - smooth(0.8, 0.84, r));
      const stone = mixC([70, 80, 94], [128, 140, 154], g).map((c) => c * edge);
      const lit = runeBand(r, a, 0.83, 0.97, 12, 0, 3);
      if (lit) { const glow = 0.55 + 0.45 * Math.max(0, Math.cos(a - ph)); return [...mixC([90, 200, 255], [235, 252, 255], glow), 255]; }
      return [...stone, 255];
    }
    const arms = 0.5 + 0.5 * Math.sin(a * 4 + r * 11 - ph * 2), core = clamp01(1 - r / 0.28);
    const swirl = clamp01(arms * (0.3 + 0.7 * r / 0.8));
    let c = mixC([8, 22, 58], [60, 160, 235], swirl);
    c = mixC(c, [205, 246, 255], clamp01((swirl - 0.7) / 0.3));
    c = mixC(c, [4, 10, 26], core * 0.85);
    if (hash(x, y, k) > 0.985 && r > 0.25) c = [235, 250, 255];   // frost glints
    return [...c, 255];
  });
}
/** THE DAEDRIC IRON, its dark and its lit (THE VISUAL PASS): read on a dark ground as the Runic Stone's grey is - at the
 *  near-black it was, its arch vanished at night and its runes showed as stray specks. */
const IRON_DARK = [34, 22, 27], IRON_LIT = [98, 70, 78];
/** DAEDRIC STONE: a crimson vortex with a black heart and jagged arms, inside a band of black iron whose runes crawl. */
function daedric(/** @type {number} */ k, /** @type {number} */ n, /** @type {number} */ w, /** @type {number} */ h) {
  const ph = (k / n) * TAU;
  return paint(w, h, (u, v, x, y) => {
    const r = Math.hypot(u, v);
    if (r > 1) return null;
    const a = Math.atan2(v, u);
    if (r > 0.85) {
      const lit = runeBand(r, a, 0.87, 0.98, 10, -ph / 3, 5);   // the runes crawl round, a slot a frame
      if (lit) return [255, 96 + 60 * (0.5 + 0.5 * Math.sin(a * 3 + ph)), 30, 255];
      const g = 0.7 + 0.3 * hash(x >> 1, y >> 1, 11);
      return [...mixC(IRON_DARK, IRON_LIT, g - 0.4), 255];
    }
    const jag = Math.abs(((a * 3 + r * 8 - ph * 2) / TAU % 1 + 1) % 1 - 0.5) * 2;   // a sawtooth's arms - teeth, not curls
    const arms = clamp01(1 - jag * 1.6), core = clamp01(1 - r / 0.3), flick = 0.85 + 0.15 * Math.sin(a * 7 + ph * 3);
    let c = mixC([22, 2, 4], [150, 16, 10], arms);
    c = mixC(c, [255, 120, 30], clamp01((arms - 0.75) / 0.25) * flick);
    c = mixC(c, [8, 0, 2], core);
    if (core > 0.6) c = mixC(c, [255, 60, 20], (core - 0.6) * 0.8 * flick);   // an ember at the very heart
    return [...c, 255];
  });
}
/** AETHERIC STONE: a pale violet vortex over a field of stars, its rim shifting through the colours of the aether. */
function aetheric(/** @type {number} */ k, /** @type {number} */ n, /** @type {number} */ w, /** @type {number} */ h) {
  const ph = (k / n) * TAU;
  return paint(w, h, (u, v, x, y) => {
    const r = Math.hypot(u, v);
    if (r > 1) return null;
    const a = Math.atan2(v, u);
    if (r > 0.88) {   // the prismatic rim
      const hue = ((a / TAU + k / n) % 1 + 1) % 1;
      const c = [0.5 + 0.5 * Math.cos(TAU * hue), 0.5 + 0.5 * Math.cos(TAU * (hue - 0.33)), 0.5 + 0.5 * Math.cos(TAU * (hue - 0.67))].map((q) => 140 + 115 * q);
      return [...c, 255];
    }
    const arms = 0.5 + 0.5 * Math.sin(a * 2 + r * 7 - ph * 2);
    const swirl = clamp01(arms * (0.25 + 0.75 * r));
    let c = mixC([10, 6, 38], [150, 120, 255], swirl);
    c = mixC(c, [245, 236, 255], clamp01((swirl - 0.75) / 0.25));
    const twinkle = hash(x, y, 31) > 0.965 && hash(x, y, 31 + k) > 0.4;
    if (twinkle && swirl < 0.6) c = [255, 250, 255];   // the stars behind the aether
    return [...c, 255];
  });
}
/** BRASS GATE: an aetherium-blue core crackling with arcs, inside a riveted brass rim. */
function brass(/** @type {number} */ k, /** @type {number} */ n, /** @type {number} */ w, /** @type {number} */ h) {
  const ph = (k / n) * TAU;
  return paint(w, h, (u, v, x, y) => {
    const r = Math.hypot(u, v);
    if (r > 1) return null;
    const a = Math.atan2(v, u);
    if (r > 0.8) {
      const rivet = Math.abs(((a / TAU) * 12 % 1 + 1) % 1 - 0.5) < 0.07 && Math.abs(r - 0.9) < 0.035;
      const groove = Math.abs(r - 0.84) < 0.015;
      const shade = 0.75 + 0.25 * Math.cos(a - 2.2);
      if (rivet) return [255, 226, 150, 255];
      return [...mixC([120, 82, 26], [214, 164, 70], shade * (groove ? 0.55 : 1)), 255];
    }
    const pulse = 0.5 + 0.5 * Math.sin(r * 14 - ph * 3);
    let c = mixC([6, 30, 58], [40, 150, 210], pulse * (1 - r));
    c = mixC(c, [180, 250, 255], clamp01(1 - r / 0.22));
    // the arcs: two crooked lines from the heart, struck anew each frame
    for (let i = 0; i < 2; i++) {
      const base = hash(k, i, 41) * TAU, wob = (hash(Math.floor(r * 12), k * 3 + i, 43) - 0.5) * 0.6;
      if (Math.abs(wrapAngle(a - base - wob)) < 0.07 && r > 0.15) c = [210, 252, 255];
    }
    return [...c, 255];
  });
}

// ═══ WHAT STANDS ABOUT THEM ═════════════════════════════════════════════════════════════════════════════════════════
/** The Daedric arch: black iron in a pointed arch, spikes along its outside, horns at its point, crimson veins pulsing. */
function arch(/** @type {number} */ k, /** @type {number} */ n, /** @type {number} */ w, /** @type {number} */ h) {
  const pulse = 0.5 + 0.5 * Math.sin((k / n) * TAU);
  return paint(w, h, (u, v, x, y) => {
    // the arch's inner line: straight sides up to the spring, a pointed head above it
    const yy = (v + 1) / 2, spring = 0.55, half = 0.62;
    const innerHalf = yy < spring ? half : half * Math.sqrt(Math.max(0, 1 - Math.pow((yy - spring) / (0.97 - spring), 2)));
    const dIn = Math.abs(u) - innerHalf;   // > 0 outside the opening
    const thick = 0.2 + 0.06 * hash(Math.floor(yy * 24), 0, 3);
    const spike = Math.max(0, 1 - Math.abs(((yy * 14) % 1) - 0.5) * 4) * 0.16 * (yy > 0.08 ? 1 : 0);   // teeth up the outside
    const horn = yy > 0.86 && Math.abs(Math.abs(u) - 0.42) < (1 - yy) * 0.9 ? 1 : 0;
    const inIron = (dIn > 0 && dIn < thick + spike && (yy < 0.97 || horn)) || (horn && Math.abs(u) > 0.3);
    if (!inIron || yy > 0.995) return null;
    const vein = Math.abs(dIn - thick * 0.45 - 0.02 * Math.sin(yy * 30)) < 0.022;
    const g = 0.6 + 0.4 * hash(x >> 1, y >> 1, 17);
    if (vein) return [200 + 55 * pulse, 30 + 40 * pulse, 12, 255];
    const lit = 0.55 + 0.45 * clamp01(1 - dIn / (thick + spike));
    return [...mixC(IRON_DARK, IRON_LIT, g * lit), 255];
  });
}
/** An Aetheric crystal: an elongated faceted shard, violet and white, a shimmer running up it. */
function shard(/** @type {number} */ k, /** @type {number} */ n, /** @type {number} */ w, /** @type {number} */ h) {
  const run = (k / n) * 1.6 - 0.3;
  return paint(w, h, (u, v) => {
    const half = 0.95 * (1 - Math.abs(v) ** 1.4);
    if (Math.abs(u) > half) return null;
    const face = u < 0 ? 1 : 0.62, edge = Math.abs(Math.abs(u) - half) < 0.14 || Math.abs(u) < 0.08;
    let c = mixC([110, 80, 220], [220, 200, 255], (v + 1) / 2 * 0.6 + 0.2).map((q) => q * face);
    if (edge) c = mixC(c, [255, 250, 255], 0.7);
    const shimmer = Math.max(0, 1 - Math.abs((v + 1) / 2 - run) * 6);
    c = mixC(c, [255, 255, 255], shimmer * 0.8);
    return [...c, 255];
  });
}
/** A brass cog: eight teeth, a rim, four spokes and a hub, turned a tooth's eighth each frame. */
function cog(/** @type {number} */ k, /** @type {number} */ n, /** @type {number} */ w, /** @type {number} */ h) {
  const turn = (k / n) * (TAU / 8);
  return paint(w, h, (u, v) => {
    const r = Math.hypot(u, v), a = Math.atan2(v, u) - turn;
    const tooth = Math.abs(((a / TAU) * 8 % 1 + 1) % 1 - 0.5) < 0.22;
    if (r > (tooth ? 0.98 : 0.8) || r < 0.16) return null;
    const spoke = Math.abs(((a / TAU) * 4 % 1 + 1) % 1 - 0.5) > 0.38;
    if (r > 0.34 && r < 0.62 && !spoke) return null;   // the windows between the spokes
    const shade = 0.68 + 0.32 * Math.cos(Math.atan2(v, u) - 2.2);
    const rim = Math.abs(r - 0.7) < 0.05 || Math.abs(r - 0.25) < 0.05;
    return [...mixC([110, 74, 24], [226, 176, 80], shade).map((q) => q * (rim ? 1.12 : 1)), 255];
  });
}

/**
 * THE SKINS: each one's vortex (its archive, painter and frames) and the pieces that stand about it - `count` of a
 * piece, its painter, its size (m), its frames and their rate, how it stands (`place`) - the burst it opens in
 * (render/killFx.js's recipe), the breath it gives while it stands (`ambient`, a recipe every `every` s) and its sound
 * (systems/storefrontSounds.js key).
 */
export const PORTAL_SKIN = Object.freeze({
  runic: Object.freeze({ archive: 'fxportal_runic', paint: runic, frames: 12, fps: 14, tex: Object.freeze({ w: 48, h: 72 }), dress: Object.freeze([]), open: 'portal-runic-open', ambient: null, sound: 'storefront:portal-runic' }),
  daedric: Object.freeze({
    archive: 'fxportal_daedric', paint: daedric, frames: 12, fps: 14, tex: Object.freeze({ w: 48, h: 72 }),
    dress: Object.freeze([Object.freeze({ key: 'arch', archive: 'fxportal_daedric_arch', paint: arch, frames: 6, fps: 8, tex: Object.freeze({ w: 64, h: 96 }), size: Object.freeze({ w: 2.35, h: 3.3 }), count: 1, place: 'arch' })]),
    open: 'portal-daedric-open', ambient: Object.freeze({ recipe: 'portal-daedric-embers', every: 0.35 }), sound: 'storefront:portal-daedric',
  }),
  aetheric: Object.freeze({
    archive: 'fxportal_aetheric', paint: aetheric, frames: 12, fps: 14, tex: Object.freeze({ w: 48, h: 72 }),
    dress: Object.freeze([Object.freeze({ key: 'shard', archive: 'fxportal_aetheric_shard', paint: shard, frames: 8, fps: 10, tex: Object.freeze({ w: 14, h: 30 }), size: Object.freeze({ w: 0.26, h: 0.56 }), count: 8, place: 'orbit' })]),
    open: 'portal-aetheric-open', ambient: Object.freeze({ recipe: 'portal-aetheric-motes', every: 0.45 }), sound: 'storefront:portal-aetheric',
  }),
  brass: Object.freeze({
    archive: 'fxportal_brass', paint: brass, frames: 12, fps: 16, tex: Object.freeze({ w: 48, h: 72 }),
    dress: Object.freeze([Object.freeze({ key: 'cog', archive: 'fxportal_brass_cog', paint: cog, frames: 8, fps: 12, tex: Object.freeze({ w: 24, h: 24 }), size: Object.freeze({ w: 0.55, h: 0.55 }), count: 6, place: 'rim' })]),
    open: 'portal-brass-open', ambient: Object.freeze({ recipe: 'portal-brass-steam', every: 0.7 }), sound: 'storefront:portal-brass',
  }),
});
/** A skin's look, or null (the violet vortex of COMPANION-PORTAL). */
export const portalSkinOf = (/** @type {unknown} */ skin) => (typeof skin === 'string' && Object.hasOwn(PORTAL_SKIN, skin) ? PORTAL_SKIN[/** @type {keyof typeof PORTAL_SKIN} */ (skin)] : null);

/**
 * WHERE A PIECE STANDS: piece `i` of a dress at `t` s into the portal's life, `open` how open it stands (0..1+), about
 * the portal's middle `mid` (the scene's), `right` the way across it as the eye sees it (unit, level). Answers its feet
 * (a billboard stands on them), its scale (0 hidden) and its turn (a frame offset), into `out` or a new record.
 * @param {{ place: string, count: number, size: { w: number, h: number } }} d @param {number} i @param {number} t
 * @param {number} open @param {ArrayLike<number>} mid @param {ArrayLike<number>} right @param {boolean} closing
 * @param {{ at: number[], scale: number, spin: number }} [out]
 */
export function dressPlace(d, i, t, open, mid, right, closing, out = { at: [0, 0, 0], scale: 0, spin: 0 }) {
  const k = clamp01(open), at = out.at;
  if (d.place === 'arch') {   // it thrusts up out of the ground as the portal tears open, and sinks as it seals
    const rise = closing ? k : Math.min(1.04, smooth(0, 1, k * 1.2) + 0.04 * Math.sin(k * Math.PI));
    at[0] = mid[0]; at[1] = mid[1] - 1.25 - d.size.h * (1 - rise) * 0.3; at[2] = mid[2];
    out.scale = Math.max(0.02, rise); out.spin = 0;
    return out;
  }
  if (d.place === 'orbit') {   // the shards rise off the ground on a spiral and gather into a turning ring about the gate
    const share = (i + 0.5) / d.count, gather = smooth(0, 1, (k - share * 0.35) / 0.65);
    const ang = TAU * share + t * TAU * 0.16 + (1 - gather) * 2.4;
    const R = 1.15 * (0.4 + 0.6 * gather), y = mid[1] + (-1.4 + 1.4 * gather) * (closing ? 1.3 : 1) + 0.18 * Math.sin(t * 2.1 + i * 1.7) + (share - 0.5) * 1.1 * gather;
    at[0] = mid[0] + Math.cos(ang) * R; at[1] = y - d.size.h * 0.5; at[2] = mid[2] + Math.sin(ang) * R;
    out.scale = closing ? k : Math.max(0.05, gather); out.spin = 0;
    return out;
  }
  // 'rim': the cogs set round the gate's edge in its own plane, each turning, the next the other way
  const ang = TAU * (i / d.count) + 0.4;
  const rx = 0.86 * k, ry = 1.28 * k;
  at[0] = mid[0] + right[0] * Math.cos(ang) * rx; at[1] = mid[1] + Math.sin(ang) * ry - d.size.h * 0.5; at[2] = mid[2] + right[2] * Math.cos(ang) * rx;
  out.scale = k; out.spin = i % 2 ? -1 : 1;
  return out;
}
