// @ts-check
// WB2 (2026-09-25): THE GATE'S OWN ART, MADE AT BOOT - the port draws no Oblivion in ARENA2, so the gate's stone is
// made here from noise the moment a host asks (combat/bloodArt.js's law: an atlas of the port's own under a
// pseudo-archive far above any classic one, no renderer and no GL in this file - pixels and numbers).
//
//   stone  - the gate's basalt: a near-black brown, mottled, split by veins of fire that run up the stone (v runs up
//            every standing face - world/gateModel.js gateFaceUv), bright at their heart and banked red at their edge.
//            Tileable on both axes.
//   rim    - GATE-FBX: the same basalt seared where it faces the opening - twice the veins, the stone between them
//            banked toward an ember and smouldering faintly, so the fire's frame reads round the portal.
//   spine  - GATE-FBX: the spines' horn, root (v 0) to point (v 1): charred, ringed with growth, its last third
//            heating to the fire at its point.
//   plinth - the carved flags WB2's plinth wore (the Sigil Broker's cage wears them still): squared stones on dark
//            mortar with one ring of runes cut round the middle, the runes' strokes glowing a banked red.
//
// Each comes with its EMISSION twin: the same picture's fire alone, on black - so the veins and the runes burn by
// night and the stone around them stays stone (renderer.uploadEmissionTexture, the mesh shader's own mask). Low and
// square-pixelled at 64 on a side, Daggerfall's own texel size: the gate sits in the pixel world, not over it.
//
// Deterministic (its own mulberry32 on fixed seeds): every client's gate is the same stone.
//
// Not a DFU member. Ledger A (WB).
import { GATE_ARCHIVE, GATE_STONE_RECORD, GATE_PLINTH_RECORD, RITE_SIGIL_RECORD, GATE_SPINE_RECORD, GATE_RIM_RECORD } from './gateModel.js';
import { COURT_ARCHIVE, COURT_FLOOR_RECORD, COURT_RUNE_RECORD, COURT_LAVA_RECORD } from './gateArena.js';   // WB3b: the court's own

export { GATE_ARCHIVE, GATE_STONE_RECORD, GATE_PLINTH_RECORD, RITE_SIGIL_RECORD, GATE_SPINE_RECORD, GATE_RIM_RECORD, COURT_ARCHIVE };
/** A texture's side, texels. */
export const GATE_ART_SIZE = 64;
/** The fire's veins down a tile of the horns' stone - few enough that the basalt still reads as stone. */
export const GATE_VEINS = 4;
/** GATE-FBX: the rim's veins - twice the stone's - and the ember its stone is banked toward, and how far. */
export const RIM_VEINS = 8;
export const RIM_EMBER = Object.freeze([92, 22, 8]);
export const RIM_BANK = 0.3;
/** GATE-FBX: where along a spine (v, root 0 to point 1) its heat begins, and its growth rings' pitch (texels). */
export const SPINE_HEAT_FROM = 0.62;
export const SPINE_RING_TEXELS = 7;
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
 * The gate's basalt and its fire: `{ albedo, emission }`, each `{ width, height, colors }` (RGBA, the renderer's
 * color32 shape). The veins are random walks down the tile (wrapping, so it tiles), a few of them branching.
 */
export function gateStoneArt(seed = 0x0b1e, veins = GATE_VEINS) {
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
  for (let k = 0; k < veins; k++) walk(Math.floor((k + r() * 0.6) * (S / veins)), 28 + Math.floor(r() * 24));
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

/**
 * GATE-FBX: THE RIM - the basalt seared where it faces the opening (world/gateModel.js gateRimFace): RIM_VEINS of fire
 * where the stone has GATE_VEINS, the stone between them banked RIM_BANK toward RIM_EMBER and smouldering at a fifth of
 * that ember, so the frame round the portal glows by night and the gate's outside stays stone.
 */
export function gateRimArt(seed = 0x0b2e) {
  const { albedo, emission } = gateStoneArt(seed, RIM_VEINS);
  for (let i = 0; i < albedo.colors.length; i += 4) {
    if (emission.colors[i] > 0) continue;   // a vein burns as it is
    const c = mix(albedo.colors.subarray(i, i + 3), RIM_EMBER, RIM_BANK);
    albedo.colors.set(c, i);
    emission.colors.set(mix([0, 0, 0], RIM_EMBER, RIM_BANK * 0.2), i);
  }
  return { albedo, emission };
}

/**
 * GATE-FBX: THE SPINE'S HORN - laid root (v 0, the tile's first row) to point (v 1) along each spine
 * (world/gateModel.js buildGateModel): charred and grained, ringed every SPINE_RING_TEXELS rows with growth, and from
 * SPINE_HEAT_FROM on heating through the veins' banked edge to their heart at the point, burning (the emission) as it
 * heats.
 */
export function gateSpineArt(seed = 0x0b3a) {
  const S = GATE_ART_SIZE;
  const albedo = image(), emission = image();
  const grain = noiseField(seed, 16);
  const CHARRED = [20, 13, 11], HORN = [58, 38, 30], RING = [10, 7, 6];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = y / (S - 1);
    let col = y % SPINE_RING_TEXELS === 0 ? RING : mix(CHARRED, HORN, Math.min(1, 0.25 + 0.75 * grain(x, y * 0.25)));
    let glow = [0, 0, 0];
    if (v >= SPINE_HEAT_FROM) {
      const t = (v - SPINE_HEAT_FROM) / (1 - SPINE_HEAT_FROM);
      const heat = t < 0.5 ? mix(col, VEIN_EDGE, t * 2) : mix(VEIN_EDGE, VEIN_HEART, (t - 0.5) * 2);
      col = heat;
      glow = mix([0, 0, 0], heat, Math.min(1, t * 1.4));
    }
    put(albedo, x, y, col);
    put(emission, x, y, glow);
  }
  return { albedo, emission };
}

/** Every texture the gate wears, by record: `[record, { albedo, emission }]` - GATE-FBX: its rim's and its spines'
 *  beside its stone's, and the plinth's flags the Broker's cage wears.
 *  @returns {Array<[number, ReturnType<typeof gateStoneArt>]>} */
export const gateArt = () => [[GATE_STONE_RECORD, gateStoneArt()], [GATE_PLINTH_RECORD, gatePlinthArt()], [GATE_SPINE_RECORD, gateSpineArt()], [GATE_RIM_RECORD, gateRimArt()]];

// ═══ WB12d: THE FAITHFUL'S SIGIL ═════════════════════════════════════════════════════════════════════════════════
/** AUDIT WB12d (G11): the sigil's art, one disc across its whole tile (never a tile repeated - the plinth's flags read
 *  as a paved square), and its fire's colour. */
export const RITE_SIGIL_ART_SIZE = 128;
const CHAR = Object.freeze([40, 31, 25]);
const ASH = Object.freeze([92, 85, 77]);
const BURNT = Object.freeze([10, 7, 6]);

/**
 * AUDIT WB12d (G11): DAGON'S SIGIL BURNED INTO THE EARTH - scorched ground, char and pooled ash, ragged where the burn
 * gave out (alpha 0 there, so the land shows through and no disc's edge is drawn); a double ring cut round it with the
 * faithful's runes between; Dagon's seven-pointed star burned across it, its first point at the top (+v - the circle's
 * model turns it toward the gate); the altar's ring at the heart. Every cut smoulders (the emission), so the sigil glows
 * at night as the braziers do. `{ albedo, emission }`, RITE_SIGIL_ART_SIZE square.
 */
export function riteSigilArt(seed = 0x5161) {
  const S = RITE_SIGIL_ART_SIZE, albedo = image(S), emission = image(S);
  const tone = noiseField(seed, 6), grain = noiseField(seed + 1, 32), edge = noiseField(seed + 2, 10);
  const r = rng(seed + 3);
  const c = (S - 1) / 2;
  const glow = (t) => mix([0, 0, 0], RUNE_GLOW, t);
  // the ground: char, ash pooled toward the heart, the grain of burnt soil - and nothing past the burn's ragged rim
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - c, y - c) / c;
    if (d > 0.9 + 0.16 * (edge(x, y, S) - 0.5)) { put(albedo, x, y, CHAR, 0); put(emission, x, y, [0, 0, 0], 0); continue; }
    const ash = Math.min(1, Math.max(0, tone(x, y, S) - 0.5) * 2.2 * (1.1 - d));
    const g = 0.72 + 0.56 * grain(x, y, S);
    put(albedo, x, y, mix(CHAR, ASH, ash).map((v) => Math.min(255, Math.round(v * g))));
    put(emission, x, y, [0, 0, 0]);
  }
  // a cut: burnt black at its heart, its fire in the emission, a halo of heat about it
  const burn = (x, y) => {
    const px = Math.round(x), py = Math.round(y);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const k = ((py + j) * S + (px + i)) * 4;
      if (i === 0 && j === 0) { put(albedo, px, py, BURNT); put(emission, px, py, glow(1)); }
      else if (albedo.colors[k + 3] && emission.colors[k] < 40) { put(albedo, px + i, py + j, mix(albedo.colors.subarray(k, k + 3), BURNT, 0.5)); put(emission, px + i, py + j, glow(0.3)); }
    }
  };
  const line = (x0, y0, x1, y1) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2); for (let t = 0; t <= n; t++) burn(x0 + ((x1 - x0) * t) / n, y0 + ((y1 - y0) * t) / n); };
  const ring = (R) => { const n = Math.ceil(2 * Math.PI * R * 2); for (let k = 0; k < n; k++) { const a = (k / n) * 2 * Math.PI; burn(c + Math.cos(a) * R, c + Math.sin(a) * R); } };
  // the double ring, and the faithful's runes between its two cuts
  ring(0.8 * c); ring(0.68 * c);
  const glyphs = 21, mid = 0.74 * c;
  for (let g = 0; g < glyphs; g++) {
    const a = (g / glyphs) * 2 * Math.PI, gx = c + Math.cos(a) * mid, gy = c + Math.sin(a) * mid;
    const ta = a + Math.PI / 2, cuts = 2 + Math.floor(r() * 2);
    for (let k = 0; k < cuts; k++) {
      const ang = r() * Math.PI, len = 1.5 + r() * 2.5, off = (k - (cuts - 1) / 2) * 2.2;
      const ox = gx + Math.cos(ta) * off, oy = gy + Math.sin(ta) * off;
      line(ox - Math.cos(ang) * len, oy - Math.sin(ang) * len, ox + Math.cos(ang) * len, oy + Math.sin(ang) * len);
    }
  }
  // Dagon's star, {7/3}: its first point at the top
  const pts = Array.from({ length: 7 }, (_, i) => { const a = Math.PI / 2 + (i / 7) * 2 * Math.PI; return [c + Math.cos(a) * 0.64 * c, c + Math.sin(a) * 0.64 * c]; });
  for (let i = 0; i < 7; i++) line(...pts[i], ...pts[(i + 3) % 7]);
  // and the ring the altar stands in
  ring(0.17 * c);
  return { albedo, emission };
}
/** WB12d: every texture the faithful's circle wears beside the gate's own, by record.
 *  @returns {Array<[number, ReturnType<typeof riteSigilArt>]>} */
export const riteArt = () => [[RITE_SIGIL_RECORD, riteSigilArt()]];

// ═══ WB3b: THE BURNING COURT'S ART ═════════════════════════════════════════════════════════════════════════════════
//
//   floor    - black flagstones, big and uneven, the mortar between them banked red where the fire below shows through
//   rune     - the ring the boss never crosses: a dark band cut with glyphs that burn (it tiles along the ring, u)
//   lava     - the sea of fire under the court and the braziers' beds: a crust of black over bright moving heat
// Each with its emission twin, as the gate's own art. GATE-FBX: the bridge's membrane and its swirl are gone - the court's
// portals are the gate's own fire (render/gatePass.js).

/** The court's floor: flagstones laid by a jittered grid, their mortar glowing where it is deepest. */
export function courtFloorArt(seed = 0x0c07) {
  const S = GATE_ART_SIZE;
  const albedo = image(), emission = image();
  const r = rng(seed);
  const tone = noiseField(seed + 1, 16);
  // four by four stones, each corner jittered - a Voronoi of their centres gives the uneven joints
  const N = 5, cell = S / N;
  const centres = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) centres.push([(i + 0.2 + r() * 0.6) * cell, (j + 0.2 + r() * 0.6) * cell, 0.7 + r() * 0.35]);
  const DARK = [18, 14, 13], STONE = [46, 36, 33], MORTAR = [9, 6, 6], EMBER = [118, 26, 9];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let d1 = Infinity, d2 = Infinity, shade = 1;
    for (const [cx, cy, s] of centres) for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      const d = Math.hypot(x - cx - ox, y - cy - oy);
      if (d < d1) { d2 = d1; d1 = d; shade = s; } else if (d < d2) d2 = d;
    }
    const joint = d2 - d1;
    if (joint < 1.2) {
      const hot = tone(x, y) > 0.7;   // the fire shows through a few joints, not all of them
      put(albedo, x, y, hot ? mix(MORTAR, EMBER, 0.6) : MORTAR);
      put(emission, x, y, hot ? mix([0, 0, 0], EMBER, 0.55) : [0, 0, 0]);
    } else {
      put(albedo, x, y, mix(DARK, STONE, Math.min(1, shade * (0.55 + 0.6 * tone(x * 2, y * 2)))));
      put(emission, x, y, [0, 0, 0]);
    }
  }
  return { albedo, emission };
}

/** The rune ring's band: glyphs of two or three cuts set along u, burning on dark stone; v runs across the band. */
export function courtRuneArt(seed = 0x0c11) {
  const S = GATE_ART_SIZE;
  const albedo = image(), emission = image();
  const r = rng(seed);
  const BAND = [24, 16, 14], EDGE = [70, 22, 10];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const edge = y < 4 || y >= S - 4;
    put(albedo, x, y, edge ? EDGE : BAND);
    put(emission, x, y, edge ? mix([0, 0, 0], EDGE, 0.6) : [0, 0, 0]);
  }
  const glyphs = 4;
  for (let g = 0; g < glyphs; g++) {
    const gx = (g + 0.5) * (S / glyphs), gy = S / 2;
    const cuts = 2 + Math.floor(r() * 2);
    for (let c = 0; c < cuts; c++) {
      const ang = r() * Math.PI, len = 10 + Math.floor(r() * 10);
      for (let t = -len / 2; t <= len / 2; t += 0.5) {
        for (const w of [-0.5, 0, 0.5]) {
          const px = Math.round(gx + Math.cos(ang) * t + (c - 1) * 4 + w), py = Math.round(gy + Math.sin(ang) * t + w);
          if (py < 5 || py >= S - 5) continue;
          put(albedo, px, py, VEIN_HEART); put(emission, px, py, VEIN_HEART);
        }
      }
    }
  }
  return { albedo, emission };
}

/** The sea of fire: bright heat under a broken black crust - nearly all of it burns. */
export function courtLavaArt(seed = 0x0c1a) {
  const S = GATE_ART_SIZE;
  const albedo = image(), emission = image();
  const heat = noiseField(seed, 4), fine = noiseField(seed + 2, 16), crust = noiseField(seed + 1, 8);
  const COOL = [70, 12, 4], HOT = [255, 150, 40], CRUST = [20, 11, 9];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const h = 0.7 * heat(x, y) + 0.3 * fine(x, y), c = crust(x, y);
    const col = mix(COOL, HOT, Math.min(1, Math.max(0, (h - 0.2) / 0.65)));
    const k = Math.min(1, Math.max(0, (c - 0.62) / 0.12));   // the crust floats on it, its edges banked
    put(albedo, x, y, mix(col, CRUST, k)); put(emission, x, y, mix(col, [0, 0, 0], k));
  }
  return { albedo, emission };
}

/** Every texture the court wears, by record: `[record, { albedo, emission }]`.
 *  @returns {Array<[number, ReturnType<typeof gateStoneArt>]>} */
export const courtArt = () => [
  [COURT_FLOOR_RECORD, courtFloorArt()], [COURT_RUNE_RECORD, courtRuneArt()], [COURT_LAVA_RECORD, courtLavaArt()],
];
