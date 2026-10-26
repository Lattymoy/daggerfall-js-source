// @ts-check
// INTRO4 (2026-10-26, the owner: "zoom out into the entire map of tamriel"; bible/10-UI/UI-Arc.md INTRO4) - THE
// CONTINENT THE FILM PULLS BACK TO. Data-free, as INTRO2's bay was: the front door runs before the ARENA2 picker, so
// this is the authored Tamriel of world/tamriel/tamrielGeography.js (Daggerfall's own continent, drawn by hand - its
// rings, ranges and rivers) and, inside the Bay's rectangle the geography leaves a hole for, INTRO2's authored Iliac
// Bay (ui/intro/introMap.js seaDistance, Balfiera and all) - never TMAP00I0 or WOODS.WLD.
//
// One field on the picture grid (320 x 200 units, 15.36 km a unit), FIELD_PX texels a unit: the albedo and the height
// (RGBA - a at 0 is the sea), and a mask of the provinces' borders the last frames ink in as a map's. Pure and
// deterministic: the same continent every boot, so a probe can pin it. The renderer (introLandscape.js) uploads it.
import { CITIES, MOUNTAIN_RANGES, PROVINCES, RIVERS, SEAS, landBounds, provinceRings } from '../../world/tamriel/tamrielGeography.js';
import { PICTURE_W, PICTURE_H, KM_PER_PIXEL, PIXELS_PER_PICTURE_UNIT, BAY_ORIGIN } from '../../world/tamriel/tamrielFrame.js';
import { segmentDistance } from '../../world/segment.js';
import { makeNoise, octaveNoise, ridged, seaDistance, INTRO_MAP_SEED } from './introMap.js';

/** Texels a picture unit, and the field's size. */
export const FIELD_PX = 4;
export const FIELD_W = PICTURE_W * FIELD_PX;
export const FIELD_H = PICTURE_H * FIELD_PX;
/** Metres a picture unit (KM_PER_PIXEL Bay pixels of 819.2 m, PIXELS_PER_PICTURE_UNIT of them). */
export const UNIT_M = KM_PER_PIXEL * PIXELS_PER_PICTURE_UNIT * 1000;
/** Metres of height a field byte stands for, before the film's exaggeration (255 is the highest peak, ~7.1 km). */
export const BYTE_M = 28;
/** The lowest land byte - the sea is 0, and the renderer's shore is between. */
export const SHORE = 6;
/** The Imperial City on the picture grid - the Imperial Province's seat, the geography's own point, so the film's city
 *  is where the map's is. */
const IMPERIAL_SEAT = /** @type {{ name: string, at: number[] }} */ (CITIES.find((c) => c.province === 'Imperial' && c.capital));
export const IMPERIAL_CITY_AT = Object.freeze([...IMPERIAL_SEAT.at]);
/** The ground the film's own city stands on is flattened this far round it (units): the local pass's land. */
export const CITY_FLAT_UNITS = 2.4;

/** A picture-grid point in the film's metres: x east, z south, the Imperial City's middle at the origin. */
export const pictureToFilm = (px, py) => [(px - IMPERIAL_CITY_AT[0]) * UNIT_M, (py - IMPERIAL_CITY_AT[1]) * UNIT_M];

/** The Bay's rectangle on the picture grid at the authored fit (BAY_ORIGIN; the live fit is the world host's, and the
 *  front door runs before it): 1000 x 500 Bay pixels from the west coast's notch. */
export const BAY_RECT = Object.freeze({
  x0: BAY_ORIGIN.x / PIXELS_PER_PICTURE_UNIT, y0: BAY_ORIGIN.y / PIXELS_PER_PICTURE_UNIT,
  x1: (BAY_ORIGIN.x + 1000) / PIXELS_PER_PICTURE_UNIT, y1: (BAY_ORIGIN.y + 500) / PIXELS_PER_PICTURE_UNIT,
});
/** INTRO2's bay is drawn in units of its own frame; this many picture units make one (its mean side). */
const BAY_FIELD_UNITS = 38;
/** How far inside the rectangle's edge the bay's own shape takes over from the rings' (units). */
const BAY_BLEND = 3.5;

/** EACH PROVINCE'S LAND, by the lore of Daggerfall's day: its open ground, its woods, its dry country and its uplands
 *  (each an [r, g, b]); `wood` how much of it is forest (the canopy noise's threshold, 0 none to 1 all), `dry` where
 *  its dry country lies - a direction on the picture grid [x, y] and how far it reaches (0 none), and `marsh` its
 *  share of standing water. Hammerfell's Alik'r inland and green by the Bay; Skyrim's tundra and pine; Morrowind's ash,
 *  greener to the south-east; the Imperial Province's Nibenay grass ringed by forest; Black Marsh's fen; Elsweyr's
 *  badlands to the north and jungle to the south; Valenwood's unbroken wood; Sumurset's fields. */
export const PROVINCE_LAND = Object.freeze({
  HighRock: Object.freeze({ open: [92, 116, 62], wood: 0.45, woods: [48, 76, 40], drylands: [116, 112, 74], dry: [0, -1, 0.25], high: [104, 100, 78], marsh: 0 }),
  Hammerfell: Object.freeze({ open: [140, 132, 88], wood: 0.12, woods: [74, 92, 50], drylands: [182, 158, 114], dry: [-0.3, 1, 0.9], high: [156, 120, 84], marsh: 0 }),
  Skyrim: Object.freeze({ open: [110, 116, 96], wood: 0.5, woods: [46, 66, 52], drylands: [150, 150, 140], dry: [0, -1, 0.55], high: [128, 128, 122], marsh: 0 }),
  Morrowind: Object.freeze({ open: [112, 98, 80], wood: 0.25, woods: [74, 84, 56], drylands: [92, 80, 70], dry: [-1, -0.4, 0.7], high: [86, 72, 64], marsh: 0.04 }),
  Imperial: Object.freeze({ open: [96, 132, 64], wood: 0.42, woods: [40, 82, 40], drylands: [128, 132, 78], dry: [-1, 0.2, 0.3], high: [96, 104, 70], marsh: 0.02 }),
  BlackMarsh: Object.freeze({ open: [70, 88, 50], wood: 0.6, woods: [40, 60, 36], drylands: [86, 90, 58], dry: [0, -1, 0.2], high: [74, 82, 56], marsh: 0.2 }),
  Elsweyr: Object.freeze({ open: [150, 138, 88], wood: 0.25, woods: [62, 96, 44], drylands: [170, 128, 86], dry: [0, -1, 0.95], high: [160, 110, 76], marsh: 0 }),
  Valenwood: Object.freeze({ open: [62, 104, 46], wood: 0.82, woods: [30, 70, 30], drylands: [92, 112, 58], dry: [0, 0, 0], high: [70, 96, 54], marsh: 0.03 }),
  Sumurset: Object.freeze({ open: [124, 150, 78], wood: 0.3, woods: [58, 98, 52], drylands: [186, 170, 112], dry: [1, 0, 0.35], high: [190, 188, 176], marsh: 0 }),
});
/** The film widens a range's band by this much for its foothills (the geography's band is the snow's). */
const FOOTHILLS = 1.9;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => { const k = clamp01((v - a) / (b - a)); return k * k * (3 - 2 * k); };

/** Even-odd scanline fill of one ring (picture units) into `out`, `value` where it covers a texel's centre. */
export function fillRing(out, w, h, ring, value, px = FIELD_PX) {
  const xs = [];
  for (let y = 0; y < h; y++) {
    const cy = (y + 0.5) / px;
    xs.length = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a.y > cy) !== (b.y > cy)) xs.push(a.x + ((cy - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.max(0, Math.ceil(xs[k] * px - 0.5)), x1 = Math.min(w - 1, Math.floor(xs[k + 1] * px - 0.5));
      for (let x = x0; x <= x1; x++) out[y * w + x] = value;
    }
  }
}

/** Two-pass chamfer distance (texels, 1 and sqrt 2) from every texel to the nearest `seed` texel, carrying the seed's
 *  index - the nearest land's province for a sea texel the Bay's own shape makes land. */
function chamfer(seed, w, h) {
  const d = new Float32Array(w * h), near = new Int32Array(w * h);
  for (let i = 0; i < d.length; i++) { d[i] = seed[i] ? 0 : 1e9; near[i] = seed[i] ? i : -1; }
  const R = Math.SQRT2;
  const relax = (i, j, c) => { if (d[j] + c < d[i]) { d[i] = d[j] + c; near[i] = near[j]; } };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (x > 0) relax(i, i - 1, 1);
    if (y > 0) { relax(i, i - w, 1); if (x > 0) relax(i, i - w - 1, R); if (x < w - 1) relax(i, i - w + 1, R); }
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (x < w - 1) relax(i, i + 1, 1);
    if (y < h - 1) { relax(i, i + w, 1); if (x < w - 1) relax(i, i + w + 1, R); if (x > 0) relax(i, i + w - 1, R); }
  }
  return { d, near };
}

/** A separable box blur of an RGB field over `mask` texels (land), radius r - the provinces' grounds run into each
 *  other over a few kilometres instead of meeting at a ruled line. */
function blurRgb(rgb, mask, w, h, r) {
  const tmp = new Float32Array(rgb.length), out = new Float32Array(rgb.length);
  const pass = (src, dst, horizontal) => {
    for (let a = 0; a < (horizontal ? h : w); a++) {
      const n = horizontal ? w : h;
      const sum = [0, 0, 0]; let cnt = 0;
      const at = (b) => (horizontal ? a * w + b : b * w + a);
      for (let b = 0; b < Math.min(n, r); b++) { const i = at(b); if (mask[i]) { sum[0] += src[i * 3]; sum[1] += src[i * 3 + 1]; sum[2] += src[i * 3 + 2]; cnt++; } }
      for (let b = 0; b < n; b++) {
        const add = b + r, sub = b - r - 1;
        if (add < n) { const i = at(add); if (mask[i]) { sum[0] += src[i * 3]; sum[1] += src[i * 3 + 1]; sum[2] += src[i * 3 + 2]; cnt++; } }
        if (sub >= 0) { const i = at(sub); if (mask[i]) { sum[0] -= src[i * 3]; sum[1] -= src[i * 3 + 1]; sum[2] -= src[i * 3 + 2]; cnt--; } }
        const i = at(b);
        if (cnt > 0) { dst[i * 3] = sum[0] / cnt; dst[i * 3 + 1] = sum[1] / cnt; dst[i * 3 + 2] = sum[2] / cnt; }
        else { dst[i * 3] = src[i * 3]; dst[i * 3 + 1] = src[i * 3 + 1]; dst[i * 3 + 2] = src[i * 3 + 2]; }
      }
    }
  };
  pass(rgb, tmp, true); pass(tmp, out, false);
  return out;
}

/**
 * THE FIELD. Returns { w, h, rgba, border, province } - `rgba` the albedo with the height in alpha (0 the sea, SHORE and
 * up the land), `border` 0..255 where two provinces meet, `province` each texel's province index + 1 (0 the sea).
 */
export function buildTamrielField({ w = FIELD_W, h = FIELD_H, seed = INTRO_MAP_SEED } = {}) {
  const px = w / PICTURE_W;
  const rings = provinceRings();
  const id = new Uint8Array(w * h);
  rings.forEach((p, k) => { for (const r of p.rings) fillRing(id, w, h, r, k + 1, px); });

  // the rings' signed distance (units, + on land), and the province nearest every sea texel
  const land = new Uint8Array(w * h), sea = new Uint8Array(w * h);
  for (let i = 0; i < id.length; i++) { land[i] = id[i] ? 1 : 0; sea[i] = id[i] ? 0 : 1; }
  const toSea = chamfer(sea, w, h), toLand = chamfer(land, w, h);
  const coastN = makeNoise(seed ^ 0x7a31), hillN = makeNoise(seed ^ 0x9e37), rangeN = makeNoise(seed ^ 0x51ed), tintN = makeNoise(seed ^ 0x2545);
  const sd = new Float32Array(w * h), prov = new Uint8Array(w * h);
  const B = BAY_RECT;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, ux = (x + 0.5) / px, uy = (y + 0.5) / px;
    let s = (id[i] ? toSea.d[i] : -toLand.d[i]) / px;
    prov[i] = id[i] || (toLand.near[i] >= 0 ? id[toLand.near[i]] : 0);
    // inside the Bay's rectangle, INTRO2's bay - eased in from its edges so the two coasts meet
    if (ux > B.x0 && ux < B.x1 && uy > B.y0 && uy < B.y1) {
      const edge = Math.min(ux - B.x0, B.x1 - ux, uy - B.y0, B.y1 - uy);
      const k = smooth(0, BAY_BLEND, edge);
      if (k > 0) s += (seaDistance((ux - B.x0) / (B.x1 - B.x0), (uy - B.y0) / (B.y1 - B.y0)) * BAY_FIELD_UNITS - s) * k;
    }
    // the coast's fret: headlands and coves at three scales, strongest at the shore (none worth a sample far inland)
    if (Math.abs(s) < 10) {
      const near = Math.exp(-Math.abs(s) * 0.55);
      s += (octaveNoise(coastN, ux * 0.09, uy * 0.09, 4) - 0.5) * 3.2 * near
         + (octaveNoise(coastN, ux * 0.42, uy * 0.42, 3) - 0.5) * 1.5 * near
         + (octaveNoise(coastN, ux * 1.6, uy * 1.6, 2) - 0.5) * 0.45 * near;
    }
    sd[i] = s;
  }

  // the ranges, each over its own box: the spine's lift (0..its gain), eased out over the film's wider foothills
  const lift = new Float32Array(w * h);
  for (const rg of MOUNTAIN_RANGES) {
    const band = rg.w * FOOTHILLS;
    const xs = rg.pts.map((q) => q[0]), ys = rg.pts.map((q) => q[1]);
    const x0 = Math.max(0, Math.floor((Math.min(...xs) - band) * px)), x1 = Math.min(w - 1, Math.ceil((Math.max(...xs) + band) * px));
    const y0 = Math.max(0, Math.floor((Math.min(...ys) - band) * px)), y1 = Math.min(h - 1, Math.ceil((Math.max(...ys) + band) * px));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const ux = (x + 0.5) / px, uy = (y + 0.5) / px;
      let d = Infinity;
      for (let k = 0; k + 1 < rg.pts.length; k++) d = Math.min(d, segmentDistance(ux, uy, rg.pts[k][0], rg.pts[k][1], rg.pts[k + 1][0], rg.pts[k + 1][1]));
      if (d < band) { const k = 1 - d / band, v = rg.gain * k * k * (3 - 2 * k); if (v > lift[y * w + x]) lift[y * w + x] = v; }
    }
  }

  // the ground's colour by province - its open land, its woods and its dry country by its own noise - run together at
  // the borders, so a province is a country and not a flat swatch
  const woodN = makeNoise(seed ^ 0x3c6e), dryN = makeNoise(seed ^ 0x1f83), marshN = makeNoise(seed ^ 0x6b21);
  const raw = new Float32Array(w * h * 3), landNow = new Uint8Array(w * h), marsh = new Uint8Array(w * h);
  const bounds = rings.map((p) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of p.rings) for (const q of r) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: (x1 - x0) / 2 || 1, ry: (y1 - y0) / 2 || 1 };
  });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, ux = (x + 0.5) / px, uy = (y + 0.5) / px;
    landNow[i] = sd[i] > 0 ? 1 : 0;
    const k = (prov[i] || 1) - 1, L = PROVINCE_LAND[rings[k].key], bb = bounds[k];
    // the dry country: toward the province's side its `dry` names, broken by noise
    const along = ((ux - bb.cx) / bb.rx) * L.dry[0] + ((uy - bb.cy) / bb.ry) * L.dry[1];
    const dry = L.dry[2] * smooth(-0.4, 0.8, along + (octaveNoise(dryN, ux * 0.12, uy * 0.12, 3) - 0.5) * 1.2);
    const wood = smooth(0.08, 0.0, octaveNoise(woodN, ux * 0.3, uy * 0.3, 4) - (1 - L.wood) * 0.9 - 0.08) * (1 - dry);
    if (L.marsh > 0 && sd[i] > 0.6 && octaveNoise(marshN, ux * 1.4, uy * 1.4, 3) > 1 - L.marsh * 1.6) marsh[i] = 1;
    for (let c = 0; c < 3; c++) raw[i * 3 + c] = L.open[c] + (L.drylands[c] - L.open[c]) * dry + (L.woods[c] - L.open[c]) * wood;
  }
  const ground = blurRgb(raw, landNow, w, h, Math.max(1, Math.round(px * 1.5)));

  const rgba = new Uint8Array(w * h * 4), border = new Uint8Array(w * h);
  const [icx, icy] = IMPERIAL_CITY_AT;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, ux = (x + 0.5) / px, uy = (y + 0.5) / px, s = sd[i];
    if (s <= 0 || marsh[i]) {
      // the sea: shallows over the shelf, the deep beyond; a fen's pools the shallows' own
      const deep = s > 0 ? 0 : clamp01(-s / 4);
      rgba[i * 4] = 18 + (1 - deep) * 34; rgba[i * 4 + 1] = 46 + (1 - deep) * 52; rgba[i * 4 + 2] = 70 + (1 - deep) * 44; rgba[i * 4 + 3] = 0;
      continue;
    }
    const inland = clamp01(s / 7);
    const up = lift[i];
    const hills = octaveNoise(hillN, ux * 0.35, uy * 0.35, 4), uplands = octaveNoise(hillN, ux * 0.06 + 31, uy * 0.06 + 17, 3);
    let z = SHORE + 22 * Math.pow(inland, 0.7) + hills * 26 * (0.25 + 0.75 * inland) + smooth(0.5, 0.8, uplands) * 46 * inland;
    if (up > 0) z += up * (0.55 + 0.45 * ridged(rangeN, ux * 0.45, uy * 0.45, 4)) * 200 * clamp01(s / 2);
    // the film's own city stands on flat ground of its own (the local pass); the continent sinks to meet it
    const dc = Math.hypot(ux - icx, uy - icy);
    z += (SHORE + 2 - z) * (1 - smooth(CITY_FLAT_UNITS * 0.6, CITY_FLAT_UNITS * 1.6, dc));
    const zb = Math.max(SHORE, Math.min(255, Math.round(z)));
    // colour: the province's ground, its uplands, rock, then snow; a strand at the shore; a grain so no band is a contour
    const key = rings[(prov[i] || 1) - 1].key, hi = PROVINCE_LAND[key].high;
    const upl = smooth(44, 112, zb), rock = smooth(110, 170, zb);
    // the snow: Skyrim's and High Rock's lowest and Skyrim's north coast white, Morrowind's only on the Velothi
    const snowLine = key === 'Skyrim' ? 128 - 60 * smooth(40, 18, uy) : key === 'HighRock' ? 150 : key === 'Morrowind' ? 236 : 176;
    const snow = smooth(snowLine, snowLine + 30, zb + (tintN(ux * 3, uy * 3) - 0.5) * 30);
    // the canopy's grain: a forest is a speckle of crowns and clearings, never a flat green
    const tint = (octaveNoise(tintN, ux * 0.6, uy * 0.6, 3) - 0.5) * 0.18 + (tintN(ux * 7.3, uy * 7.3) - 0.5) * 0.12;
    let r = ground[i * 3] + (hi[0] - ground[i * 3]) * upl, g = ground[i * 3 + 1] + (hi[1] - ground[i * 3 + 1]) * upl, b = ground[i * 3 + 2] + (hi[2] - ground[i * 3 + 2]) * upl;
    r += (118 - r) * rock; g += (110 - g) * rock; b += (100 - b) * rock;
    r += (226 - r) * snow; g += (230 - g) * snow; b += (236 - b) * snow;
    const strand = 1 - smooth(0.05, 0.35, s);
    r += (172 - r) * strand * 0.7; g += (158 - g) * strand * 0.7; b += (120 - b) * strand * 0.7;
    rgba[i * 4] = Math.max(0, Math.min(255, Math.round(r * (1 + tint))));
    rgba[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(g * (1 + tint))));
    rgba[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(b * (1 + tint * 0.8))));
    rgba[i * 4 + 3] = zb;
  }
  // the borders: a texel of land whose province differs from a neighbour's on land
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (!landNow[i]) continue;
    const p = prov[i];
    if ((landNow[i + 1] && prov[i + 1] !== p) || (landNow[i + w] && prov[i + w] !== p)) { border[i] = 255; border[i + 1] = Math.max(border[i + 1], 120); border[i + w] = Math.max(border[i + w], 120); }
  }
  for (let i = 0; i < w * h; i++) if (!landNow[i]) prov[i] = 0;
  return { w, h, rgba, border, province: prov };
}

/** The field's albedo at a picture-grid point (nearest texel) - the local pass's far ground fades into it. */
export function fieldColourAt(field, ux, uy) {
  const px = field.w / PICTURE_W;
  const x = Math.max(0, Math.min(field.w - 1, Math.floor(ux * px))), y = Math.max(0, Math.min(field.h - 1, Math.floor(uy * px)));
  const i = (y * field.w + x) * 4;
  return [field.rgba[i], field.rgba[i + 1], field.rgba[i + 2]];
}

/** THE MAP'S WORDS, where they sit: the nine provinces at their labels, the seas, and the Imperial City - every name
 *  the geography's own (no word of the film's), each with the picture point it is drawn over. */
export const INTRO_MAP_LABELS = Object.freeze([
  ...PROVINCES.map((p) => Object.freeze({ kind: 'province', name: p.name, at: Object.freeze([...p.label]) })),
  ...SEAS.map((s) => Object.freeze({ kind: 'sea', name: s.name, at: Object.freeze([...s.at]) })),
  Object.freeze({ kind: 'capital', name: IMPERIAL_SEAT.name, at: IMPERIAL_CITY_AT }),
]);

/** The middle of the authored land, in the film's metres - where the last frame looks. */
export function tamrielCentre() {
  const b = landBounds();
  return pictureToFilm((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
}
/** The authored land's width, metres - the last frame holds all of it. */
export function tamrielSpan() {
  const b = landBounds();
  return [(b.x1 - b.x0) * UNIT_M, (b.y1 - b.y0) * UNIT_M];
}
/** The ranges the geography names (the probe's and the pins' read of where the snow should lie). */
export const INTRO_RANGES = MOUNTAIN_RANGES;
/** The great rivers as segments [ax, ay, bx, by] on the picture grid - the continent's shader draws them, a stroke of
 *  water at any height, where a texel of the field would be a stair of blocks. */
/** The geography's other cities on the picture grid - the continent's shader stands a speck of town on each. */
export const CITY_POINTS = Object.freeze(CITIES.filter((c) => c !== IMPERIAL_SEAT).map((c) => Object.freeze([...c.at])));
export const RIVER_SEGMENTS = Object.freeze(RIVERS.flatMap((rv) => rv.pts.slice(0, -1).map((q, k) => Object.freeze([q[0], q[1], rv.pts[k + 1][0], rv.pts[k + 1][1]]))));
