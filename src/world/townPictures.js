// WD3 (2026-10-01): THE PICTURES THE STAND-INS WEAR THAT DAGGERFALL HAS NONE OF - drawn by the port, in code.
//
// Daggerfall Expanded Textures hangs tapestries and banners - a region's, a god's, a pattern's - and Rosy's
// Resources lays rugs; Beautiful Villages and Beautiful Cities place them by the hundred, and Detailed Ships flies
// four from its masts and beams. None of it is the port's to carry, and Daggerfall has no woven cloth to derive it
// from (its own paintings it does have, and the painting stand-ins wear THOSE - world/townStandIns.js). So these are
// the port's own drawings: a woven field, a border, a charge or a god's sign, at Daggerfall's own coarse pixel, made
// the same way every time (no file, no randomness at run time - one seed per picture).
//
// One archive, `TOWN_PICTURE_ARCHIVE`, past every classic and mod archive the port knows; each record a picture
// (`TOWN_PICTURES`, by record). The models that wear them name (archive, record) as any model names a classic
// texture, so they upload through the same door (systems/textureReplacement.js, `standIn` entries built here).

import { mulberry32 } from '../render/grassPixelArt.js';

export const TOWN_PICTURE_ARCHIVE = 38202;

// ---- colours ---------------------------------------------------------------------------------------------------
const C = Object.freeze({
  gold: [214, 168, 58], goldDark: [150, 110, 34], silver: [196, 200, 206], white: [228, 224, 210], black: [34, 30, 28],
  red: [150, 34, 30], redDark: [96, 22, 22], blue: [44, 70, 140], blueDark: [26, 40, 86], sky: [98, 140, 196],
  green: [46, 104, 52], greenDark: [28, 66, 34], purple: [92, 44, 108], purpleDark: [58, 26, 70],
  orange: [186, 96, 36], brown: [104, 70, 40], brownDark: [66, 44, 26], pink: [196, 110, 140], grey: [110, 110, 116],
  teal: [40, 108, 112], cream: [214, 196, 152], wine: [110, 30, 52],
});

// ---- a picture, top-down RGBA, opaque (a mesh material draws no cutout) ------------------------------------------
class Canvas {
  constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8Array(w * h * 4); }
  set(x, y, c) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = 255;
  }
  get(x, y) { const i = (y * this.width + x) * 4; return [this.data[i], this.data[i + 1], this.data[i + 2]]; }
  fill(c) { for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) this.set(x, y, c); }
  rect(x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c); }
  /** Every pixel whose centre `inside(u, v)` answers, u and v in -1..1 across the box (x0, y0)-(x1, y1). */
  shape(x0, y0, x1, y1, c, inside) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const u = ((x + 0.5 - x0) / (x1 - x0 + 1)) * 2 - 1, v = ((y + 0.5 - y0) / (y1 - y0 + 1)) * 2 - 1;
      if (inside(u, v)) this.set(x, y, c);
    }
  }
  /** The weave: every pixel darkened or lightened a little, the weft rows a shade deeper - cloth, not paint. */
  weave(seed, amount = 14) {
    const rnd = mulberry32(seed >>> 0);
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const i = (y * this.width + x) * 4;
      const d = Math.round((rnd() - 0.5) * amount) - ((y & 1) ? 6 : 0) + (((x + y) & 3) === 0 ? 3 : 0);
      for (let k = 0; k < 3; k++) this.data[i + k] = Math.max(0, Math.min(255, this.data[i + k] + d));
    }
  }
  picture() { return { width: this.width, height: this.height, data: this.data }; }
}

// ---- the signs - each `(u, v) -> inside`, u right and v DOWN, both -1..1 ------------------------------------------
const STAR = Array.from({ length: 10 }, (_, k) => { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 0.38 : 0.92; return [Math.cos(a) * r, Math.sin(a) * r]; });
/** A five-pointed star, point up: even-odd over its ten corners. */
function starPolygon(u, v) {
  let inside = false;
  for (let i = 0, j = STAR.length - 1; i < STAR.length; j = i++) {
    const [xi, yi] = STAR[i], [xj, yj] = STAR[j];
    if ((yi > v) !== (yj > v) && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const SIGNS = Object.freeze({
  hourglass: (u, v) => Math.abs(u) <= Math.abs(v) * 0.85 + 0.08 && Math.abs(v) < 0.92,                                      // Akatosh: time
  wheel: (u, v) => { const r = Math.hypot(u, v); return (r > 0.62 && r < 0.86) || (r < 0.86 && (Math.abs(u) < 0.1 || Math.abs(v) < 0.1)); },   // Arkay: the cycle
  rose: (u, v) => { const r = Math.hypot(u, v), a = Math.atan2(v, u); return r < 0.32 + 0.38 * Math.abs(Math.cos(a * 2.5)) && r < 0.8; },      // Dibella
  book: (u, v) => Math.abs(v) < 0.55 && Math.abs(u) < 0.9 && Math.abs(u) > 0.07 && v > -0.55 + Math.abs(u) * 0.12,           // Julianos: an open book
  wings: (u, v) => { const a = Math.abs(u); return (a < 0.95 && v > -0.75 + (1 - a) * 0.55 && v < -0.45 + (1 - a) * 0.75) || (a < 0.13 && v > -0.4 && v < 0.55) || (a < 0.3 && v > 0.45 && v < 0.8 && a < (v - 0.45) * 0.9); },   // Kynareth: a bird of the sky, wings spread
  coin: (u, v) => { const r = Math.hypot(u, v); return r < 0.8 && !(r > 0.5 && r < 0.62) && !(Math.abs(u) < 0.12 && Math.abs(v) < 0.3 && r < 0.5); },   // Zenithar
  heart: (u, v) => { const x = u * 1.1, y = -v * 1.1 + 0.25; return (x * x + y * y - 0.5) ** 3 - x * x * y ** 3 < 0; },      // Mara
  shield: (u, v) => { const inShield = Math.abs(u) < 0.75 && v > -0.8 && (v < 0.2 || Math.abs(u) < 0.75 * (1 - (v - 0.2) / 0.7)); return inShield && !(Math.abs(u) < 0.13 || Math.abs(v + 0.25) < 0.12); },   // Stendarr: the shield, its cross cut out
  chevron: (u, v) => Math.abs(v - (0.15 - Math.abs(u) * 0.75)) < 0.24,
  cross: (u, v) => Math.abs(u) < 0.2 || Math.abs(v) < 0.2,
  saltire: (u, v) => Math.abs(u - v) < 0.26 || Math.abs(u + v) < 0.26,
  lozenge: (u, v) => Math.abs(u) + Math.abs(v) < 0.8,
  sun: (u, v) => { const r = Math.hypot(u, v), a = Math.atan2(v, u); return r < 0.42 || (r < 0.88 && Math.cos(a * 8) > 0.55); },
  crescent: (u, v) => Math.hypot(u, v) < 0.8 && Math.hypot(u - 0.32, v + 0.12) > 0.62,
  tower: (u, v) => (Math.abs(u) < 0.46 && v > -0.45 && v < 0.85) || (v > -0.8 && v <= -0.45 && Math.abs(u) < 0.66 && (Math.floor((u + 0.66) / 0.26) % 2 === 0)),
  star: (u, v) => starPolygon(u, v),
  stripes: (u, v) => Math.floor((v + 1) * 3) % 2 === 0,
});

// ---- the pictures --------------------------------------------------------------------------------------------------
/** A tapestry: a woven field, a patterned border, a sign in the middle; `bands` adds the top and bottom bands. */
function tapestry({ w = 32, h = 48, field, border, sign, ink, ink2 = null, pattern = 'dots', seed }) {
  const c = new Canvas(w, h);
  c.fill(field);
  // the border: two pixels of its colour with a running pattern of the field's through it
  c.rect(0, 0, w - 1, 1, border); c.rect(0, h - 2, w - 1, h - 1, border); c.rect(0, 0, 1, h - 1, border); c.rect(w - 2, 0, w - 1, h - 1, border);
  for (let i = 2; i < Math.max(w, h); i += 4) {
    if (pattern === 'dots') { c.set(i, 0, field); c.set(i, h - 1, field); c.set(0, i, field); c.set(w - 1, i, field); }
    else if (pattern === 'teeth') { for (let k = 0; k < 2; k++) { c.set(i + k, 2, border); c.set(i + k, h - 3, border); } }
  }
  c.rect(3, 4, w - 4, 5, border); c.rect(3, h - 6, w - 4, h - 5, border);   // the two bands
  const cx0 = Math.round(w * 0.18), cx1 = Math.round(w * 0.82) - 1, cy0 = Math.round(h * 0.26), cy1 = cy0 + (cx1 - cx0);
  if (ink2) c.shape(cx0 - 1, cy0 - 1, cx1 + 1, cy1 + 1, ink2, SIGNS[sign]);   // a shadow under the sign
  c.shape(cx0, cy0, cx1, cy1, ink, SIGNS[sign]);
  c.weave(seed);
  return c.picture();
}
/** A banner: narrow and long, the sign high on it, the foot cut in a swallow-tail by the model (the picture runs to the tips). */
function banner({ field, border, sign, ink, seed }) {
  const w = 24, h = 64, c = new Canvas(w, h);
  c.fill(field);
  c.rect(0, 0, w - 1, 2, border); c.rect(0, 0, 1, h - 1, border); c.rect(w - 2, 0, w - 1, h - 1, border);
  c.shape(3, 9, w - 4, 9 + (w - 8), ink, SIGNS[sign]);
  c.rect(2, 34, w - 3, 35, border);
  c.shape(5, 40, w - 6, 40 + (w - 12), ink, SIGNS.lozenge);
  c.weave(seed);
  return c.picture();
}
/** A decorative tapestry: an all-over pattern in two colours and a medallion. */
function patterned({ field, a, b, motif, seed, w = 32, h = 48 }) {
  const c = new Canvas(w, h);
  c.fill(field);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const on = motif === 'diamonds' ? ((Math.abs((x % 8) - 3.5) + Math.abs((y % 8) - 3.5)) < 2.6)
      : motif === 'checks' ? (((x >> 2) + (y >> 2)) & 1) === 0
      : motif === 'stripes' ? ((y >> 2) % 3) === 0
      : motif === 'vines' ? (((x + Math.round(Math.sin(y / 2.5) * 2)) % 6) === 0 || (y % 9 === 0 && x % 6 < 3))
      : ((x * 3 + y * 5) % 11) < 2;
    if (on) c.set(x, y, a);
  }
  c.rect(0, 0, w - 1, 1, b); c.rect(0, h - 2, w - 1, h - 1, b); c.rect(0, 0, 1, h - 1, b); c.rect(w - 2, 0, w - 1, h - 1, b);
  c.shape(Math.round(w * 0.25), Math.round(h * 0.3), Math.round(w * 0.75) - 1, Math.round(h * 0.3) + Math.round(w * 0.5) - 1, b, (u, v) => Math.hypot(u, v) < 0.95);
  c.shape(Math.round(w * 0.25), Math.round(h * 0.3), Math.round(w * 0.75) - 1, Math.round(h * 0.3) + Math.round(w * 0.5) - 1, field, (u, v) => Math.hypot(u, v) < 0.7);
  c.shape(Math.round(w * 0.25), Math.round(h * 0.3), Math.round(w * 0.75) - 1, Math.round(h * 0.3) + Math.round(w * 0.5) - 1, a, SIGNS.star);
  c.weave(seed);
  return c.picture();
}
/** A rug: a field, a broad border, a lozenge medallion, fringe rows at the two ends. */
function rug({ field, border, a, seed }) {
  const w = 48, h = 32, c = new Canvas(w, h);
  c.fill(field);
  c.rect(2, 2, w - 3, 4, border); c.rect(2, h - 5, w - 3, h - 3, border); c.rect(2, 2, 4, h - 3, border); c.rect(w - 5, 2, w - 3, h - 3, border);
  for (let x = 6; x < w - 6; x += 3) { c.set(x, 3, a); c.set(x, h - 4, a); }
  c.shape(12, 7, w - 13, h - 8, a, SIGNS.lozenge);
  c.shape(16, 10, w - 17, h - 11, border, SIGNS.lozenge);
  c.shape(20, 12, w - 21, h - 13, field, SIGNS.lozenge);
  for (let y = 0; y < h; y += 2) { c.set(0, y, C.cream); c.set(w - 1, y, C.cream); }   // the fringe
  c.weave(seed, 18);
  return c.picture();
}
/** Leaves - a potted plant's green, mottled. */
function foliage(seed) {
  const c = new Canvas(16, 16), rnd = mulberry32(seed);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const t = rnd();
    c.set(x, y, t < 0.3 ? C.greenDark : t < 0.8 ? C.green : [86, 142, 70]);
  }
  return c.picture();
}

// The regions' colours are the port's own (Daggerfall paints no region a banner): two each, and a charge.
const REGION = Object.freeze({
  Glenpoint: { field: C.green, border: C.gold, sign: 'tower', ink: C.gold },
  Totambu: { field: C.orange, border: C.black, sign: 'sun', ink: C.black },
  Lainlyn: { field: C.blue, border: C.white, sign: 'crescent', ink: C.white },
  Santaki: { field: C.red, border: C.gold, sign: 'saltire', ink: C.gold },
  'Abibon-Gora': { field: C.purple, border: C.silver, sign: 'star', ink: C.silver },
});
// The Eight - each in a field and a sign the port gives them (the faiths' own colours as the temples wear them nowhere in data).
const DIVINE = Object.freeze({
  Akatosh: { field: C.blueDark, border: C.gold, sign: 'hourglass', ink: C.gold },
  Arkay: { field: C.black, border: C.silver, sign: 'wheel', ink: C.white },
  Dibella: { field: C.greenDark, border: C.pink, sign: 'rose', ink: C.pink },
  Julianos: { field: C.purpleDark, border: C.white, sign: 'book', ink: C.white },
  Kynareth: { field: C.sky, border: C.white, sign: 'wings', ink: C.white },
  Zenithar: { field: C.brownDark, border: C.gold, sign: 'coin', ink: C.gold },
  Mara: { field: C.cream, border: C.red, sign: 'heart', ink: C.red },
  Stendarr: { field: C.redDark, border: C.silver, sign: 'shield', ink: C.silver },
});
const DIVINE_ORDER = Object.freeze(['Akatosh', 'Arkay', 'Dibella', 'Julianos', 'Kynareth', 'Zenithar', 'Mara', 'Stendarr']);
const DECOR = Object.freeze([
  { field: C.wine, a: C.gold, b: C.goldDark, motif: 'diamonds' }, { field: C.blueDark, a: C.sky, b: C.silver, motif: 'checks' },
  { field: C.greenDark, a: C.green, b: C.gold, motif: 'vines' }, { field: C.brownDark, a: C.orange, b: C.cream, motif: 'stripes' },
  { field: C.purpleDark, a: C.pink, b: C.gold, motif: 'diamonds' }, { field: C.teal, a: C.cream, b: C.brownDark, motif: 'weave' },
  { field: C.redDark, a: C.orange, b: C.gold, motif: 'vines' }, { field: C.black, a: C.red, b: C.gold, motif: 'checks' },
  { field: C.blue, a: C.white, b: C.gold, motif: 'stripes' }, { field: C.cream, a: C.wine, b: C.brown, motif: 'diamonds' },
  { field: C.grey, a: C.blueDark, b: C.silver, motif: 'weave' }, { field: C.green, a: C.cream, b: C.brownDark, motif: 'checks' },
  { field: C.orange, a: C.brownDark, b: C.redDark, motif: 'vines' }, { field: C.wine, a: C.pink, b: C.cream, motif: 'stripes' },
]);
const RUGS = Object.freeze([
  { field: C.redDark, border: C.blueDark, a: C.gold }, { field: C.blueDark, border: C.wine, a: C.cream },
  { field: C.brown, border: C.cream, a: C.redDark }, { field: C.greenDark, border: C.brownDark, a: C.gold },
]);

/** Every picture of the archive, by record: `{ name, draw() }` - the record numbers are the models' (a fixed table). */
export const TOWN_PICTURES = Object.freeze([
  ...Object.entries(REGION).map(([name, s], k) => ({ name: `tapestry of ${name}`, draw: () => tapestry({ ...s, seed: 101 + k }) })),        // 0-4
  ...Object.entries(REGION).map(([name, s], k) => ({ name: `banner of ${name}`, draw: () => banner({ ...s, seed: 201 + k }) })),            // 5-9
  ...DIVINE_ORDER.map((god, k) => ({ name: `tapestry of ${god}`, draw: () => tapestry({ ...DIVINE[god], ink2: C.black, seed: 301 + k }) })),     // 10-17
  ...DIVINE_ORDER.map((god, k) => ({ name: `banner of ${god}`, draw: () => banner({ ...DIVINE[god], seed: 401 + k }) })),                     // 18-25
  ...DECOR.map((s, k) => ({ name: `decorative tapestry ${k + 1}`, draw: () => patterned({ ...s, seed: 501 + k }) })),                          // 26-39
  ...RUGS.map((s, k) => ({ name: `rug ${k + 1}`, draw: () => rug({ ...s, seed: 601 + k }) })),                                               // 40-43
  { name: 'leaves', draw: () => foliage(701) },                                                                                           // 44
  ...DECOR.slice(0, 3).map((s, k) => ({ name: `small hanging ${k + 1}`, draw: () => patterned({ ...s, w: 16, h: 24, seed: 801 + k }) })),   // 45-47
]);
/** Record numbers by what they are - the models' side of the table above. */
export const PICTURE = Object.freeze({
  regionTapestry: (name) => Object.keys(REGION).indexOf(name),
  regionBanner: (name) => 5 + Object.keys(REGION).indexOf(name),
  divineTapestry: (god) => 10 + DIVINE_ORDER.indexOf(god),
  divineBanner: (god) => 18 + DIVINE_ORDER.indexOf(god),
  decorative: (k) => 26 + (k % DECOR.length),
  rug: (k) => 40 + (k % RUGS.length),
  leaves: 44,
  smallHanging: (k) => 45 + (k % 3),
});

/** The texture door's entries for the whole archive, every one built from the table and behind `gate`. */
export function townPictureEntries(gate) {
  return TOWN_PICTURES.map((p, record) => ({
    archive: TOWN_PICTURE_ARCHIVE, record, fileName: `town-picture-${record}`, standIn: true, gate,
    build: async () => p.draw(),
  }));
}
