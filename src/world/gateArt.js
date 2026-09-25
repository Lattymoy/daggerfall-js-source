// @ts-check
// WB2 (2026-09-25): THE GATE'S OWN ART, MADE AT BOOT - the port draws no Oblivion in ARENA2, so the gate's stone is
// made here from noise the moment a host asks (combat/bloodArt.js's law: an atlas of the port's own under a
// pseudo-archive far above any classic one, no renderer and no GL in this file - pixels and numbers).
//
//   stone  - the horns' basalt: a near-black brown, mottled, split by veins of fire that run the way the horn grows
//            (v runs up a horn), bright at their heart and banked red at their edge. Tileable on both axes.
//   plinth - the slab's carved flags: squared stones on dark mortar with one ring of runes cut round the middle,
//            the runes' strokes glowing a banked red.
//
// Each comes with its EMISSION twin: the same picture's fire alone, on black - so the veins and the runes burn by
// night and the stone around them stays stone (renderer.uploadEmissionTexture, the mesh shader's own mask). Low and
// square-pixelled at 64 on a side, Daggerfall's own texel size: the gate sits in the pixel world, not over it.
//
// Deterministic (its own mulberry32 on fixed seeds): every client's gate is the same stone.
//
// Not a DFU member. Ledger A (WB).
import { GATE_ARCHIVE, GATE_STONE_RECORD, GATE_PLINTH_RECORD } from './gateModel.js';

export { GATE_ARCHIVE, GATE_STONE_RECORD, GATE_PLINTH_RECORD };
/** A texture's side, texels. */
export const GATE_ART_SIZE = 64;
/** The fire's veins down a tile of the horns' stone - few enough that the basalt still reads as stone. */
export const GATE_VEINS = 4;
/** The fire's three colours: its heart, its edge, and the banked red of a rune. */
export const VEIN_HEART = Object.freeze([255, 168, 64]);
export const VEIN_EDGE = Object.freeze([196, 56, 18]);
export const RUNE_GLOW = Object.freeze([176, 40, 16]);

/** mulberry32, the port's seeded rng (systems/wind.js seededRng's own), kept here so the art is the world's alone. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable value noise over an n x n lattice, sampled at (x, y) in texels of an S-texel tile. */
function noiseField(seed, n) {
  const r = rng(seed);
  const lat = Float32Array.from({ length: n * n }, () => r());
  const at = (i, j) => lat[((j % n + n) % n) * n + ((i % n + n) % n)];
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y, S = GATE_ART_SIZE) => {
    const fx = (x / S) * n, fy = (y / S) * n;
    const i = Math.floor(fx), j = Math.floor(fy);
    const tx = smooth(fx - i), ty = smooth(fy - j);
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}

const image = (S = GATE_ART_SIZE) => ({ width: S, height: S, colors: new Uint8Array(S * S * 4) });
/** @param {{width:number, colors:Uint8Array}} img @param {number} x @param {number} y @param {ArrayLike<number>} rgb @param {number} [a] */
const put = (img, x, y, rgb, a = 255) => {
  const S = img.width, i = (((y % S + S) % S) * S + ((x % S + S) % S)) * 4;
  img.colors[i] = rgb[0]; img.colors[i + 1] = rgb[1]; img.colors[i + 2] = rgb[2]; img.colors[i + 3] = a;
};
/** @param {ArrayLike<number>} a @param {ArrayLike<number>} b @param {number} t @returns {number[]} */
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map((v) => Math.round(v));

/**
 * The horns' basalt and its fire: `{ albedo, emission }`, each `{ width, height, colors }` (RGBA, the renderer's
 * color32 shape). The veins are random walks down the tile (wrapping, so it tiles), a few of them branching.
 */
export function gateStoneArt(seed = 0x0b1e) {
  const S = GATE_ART_SIZE;
  const albedo = image(), emission = image();
  const coarse = noiseField(seed, 8), fine = noiseField(seed + 1, 32);
  const DARK = [22, 15, 13], LIGHT = [66, 44, 34];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = 0.65 * coarse(x, y) + 0.35 * fine(x, y);
    put(albedo, x, y, mix(DARK, LIGHT, Math.min(1, Math.max(0, (v - 0.2) / 0.7))));
    put(emission, x, y, [0, 0, 0]);
  }
  const r = rng(seed + 7);
  const heart = new Uint8Array(S * S), edge = new Uint8Array(S * S);
  const walk = (x0, len) => {
    let x = x0, y = Math.floor(r() * S);
    for (let k = 0; k < len; k++) {
      heart[((y + S) % S) * S + ((x + S) % S)] = 1;
      y += 1;
      const turn = r();
      if (turn < 0.28) x -= 1; else if (turn > 0.72) x += 1;
      if (r() < 0.025) walk(x, Math.floor(len * 0.4));   // a branch
    }
  };
  for (let k = 0; k < GATE_VEINS; k++) walk(Math.floor((k + r() * 0.6) * (S / GATE_VEINS)), 28 + Math.floor(r() * 24));
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (!heart[y * S + x]) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i = (((y + dy) + S) % S) * S + (((x + dx) + S) % S);
      if (!heart[i]) edge[i] = 1;
    }
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    if (heart[i]) { put(albedo, x, y, VEIN_HEART); put(emission, x, y, VEIN_HEART); }
    else if (edge[i]) { put(albedo, x, y, VEIN_EDGE); put(emission, x, y, mix([0, 0, 0], VEIN_EDGE, 0.7)); }
  }
  return { albedo, emission };
}

/**
 * The plinth's carved flags: four by four stones on dark mortar, and one ring of runes cut round the tile's middle -
 * the ring spans the whole tile, so the plinth's top (one tile across two metres at its centre - world/gateModel.js)
 * wears it as a sigil under the threshold.
 */
export function gatePlinthArt(seed = 0x0f1a) {
  const S = GATE_ART_SIZE;
  const albedo = image(), emission = image();
  const tone = noiseField(seed, 16);
  const r = rng(seed + 3);
  const stoneShade = Array.from({ length: 16 }, () => 0.75 + r() * 0.35);
  const MORTAR = [14, 10, 9], STONE = [52, 38, 31];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const cell = Math.floor(y / 16) * 4 + Math.floor(x / 16);
    const onMortar = x % 16 === 0 || y % 16 === 0;
    const c = onMortar ? MORTAR : mix(MORTAR, STONE, Math.min(1, stoneShade[cell] * (0.6 + 0.5 * tone(x, y))));
    put(albedo, x, y, c);
    put(emission, x, y, [0, 0, 0]);
  }
  // the rune ring: short strokes set round a circle, each a little glyph of two or three cuts
  const cx = S / 2, cy = S / 2, R = S * 0.36;
  const glyphs = 14;
  for (let g = 0; g < glyphs; g++) {
    const a = (g / glyphs) * Math.PI * 2;
    const gx = cx + Math.cos(a) * R, gy = cy + Math.sin(a) * R;
    const cuts = 2 + Math.floor(r() * 2);
    for (let c = 0; c < cuts; c++) {
      const ang = r() * Math.PI, len = 3 + Math.floor(r() * 3);
      for (let t = -len / 2; t <= len / 2; t += 0.5) {
        const px = Math.round(gx + Math.cos(ang) * t + (c - 1) * 1.5 * Math.cos(a + Math.PI / 2));
        const py = Math.round(gy + Math.sin(ang) * t + (c - 1) * 1.5 * Math.sin(a + Math.PI / 2));
        put(albedo, px, py, RUNE_GLOW); put(emission, px, py, RUNE_GLOW);
      }
    }
  }
  // and the circle the runes ride, cut thin
  for (let k = 0; k < 360; k++) {
    const a = (k / 360) * Math.PI * 2;
    const px = Math.round(cx + Math.cos(a) * (R - 5)), py = Math.round(cy + Math.sin(a) * (R - 5));
    put(albedo, px, py, mix(MORTAR, RUNE_GLOW, 0.6)); put(emission, px, py, mix([0, 0, 0], RUNE_GLOW, 0.5));
  }
  return { albedo, emission };
}

/** Every texture the gate wears, by record: `[record, { albedo, emission }]`.
 *  @returns {Array<[number, ReturnType<typeof gateStoneArt>]>} */
export const gateArt = () => [[GATE_STONE_RECORD, gateStoneArt()], [GATE_PLINTH_RECORD, gatePlinthArt()]];
