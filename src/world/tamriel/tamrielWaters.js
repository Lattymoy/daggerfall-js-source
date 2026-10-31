// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CYRODIIL-WATERS (2026-10-26, bible/03-World/Tamriel.md CYRODIIL-WATERS; KPbICA's spec, forwarded by the owner: "For
// Cyrodill I would suggest to use this detailed map") - THE RIVERS AND LAKES PAST THE BAY, carved into the land, and THE
// LAW EVERY OTHER SYSTEM ASKS OF THEM.
//
// The trace's water (TAMRIEL3) is the picture's: a sea, Lake Rumare's ring, the Niben - fifteen kilometres a pixel, and
// nothing narrower. The land past the Bay had no river. Cyrodiil's are here: the Corbolo out of Lake Arrius past Cheydinhal
// into Niben Bay with the Reed and Lake Poppad's outflow, the Silverfish out of Lake Canulus, the Panther past Leyawiin
// into the Lower Niben, the Lower Niben from Niben Bay to Topal Bay, the White Rose across the West Weald into Lake
// Rumare, the Larsius into Niben Bay, the Strid and the Brena west to the Abecean.
//
// WHERE THEY RUN - OUR OWN DATA. Each was read off the reference map (WATERS_SOURCE: another game's published art; the
// image never enters the repository and nothing is traced or rendered from it) by eye, as a source, a mouth and the towns
// it passes, laid on our frame by the province's cities, and its course then FOLLOWED DOWN OUR OWN RELIEF'S DRAINAGE (a
// priority flood from the trace's water over the heightmap's ground, the D8 receivers, simplified to picture units) - so
// every river runs down a valley of the heightmap the land stands on, where the reference's courses laid on our trace
// climbed ridges 400-600 m high. Where our relief drains otherwise the relief wins and is recorded: the West Weald and
// Colovia drain east to Lake Rumare (the White Rose), so the Strid and the Brena are the valleys that do run west.
//
// THE LAW (compiled once a trace and a fit - the courses in picture units, laid on the live frame):
//   - a river is a dense centre line (Catmull-Rom through its points, meandering a few widths either side on a wavelength
//     of a dozen), its WIDTH growing from source to mouth, its SURFACE the macro ground along it (the kernel's own two
//     terms and the lift - world/landforms.js) less an incision, never rising downstream (a running minimum from its
//     source; a lake's outflow starts at the lake's level; a tributary eased down to its river's surface where it joins),
//     never under the knee's floor (the beach line - the sea and the trace's lakes are the kernel's own water);
//   - a lake is a ring (an ellipse, its shore wandering a little), level at the lowest of the ground about it;
//   - THE CARVE (`carve`, inside world/landforms.js's shaper past the Bay): the channel's floor level across at the surface,
//     the valley's walls rising to the land over `valley` (the landforms faded into it, so a ridge never stands in a
//     river), a lake flat at its level with a shore rising out of it; never above the land (it only lowers);
//   - THE PAINT (`paintTamrielWaters`, world/terrain/terrainGen.js): the channel's and the lake's corners are water to the
//     tile classifier, so the marching squares lay the shore and the water's sheet draws on the level ground (WATER-NEXT).
//
// FOR THE OTHER SYSTEMS (Bay pixel coordinates, fractional, y south - the frame every place past the Bay stands in;
// lengths in metres): tamrielWaters() the whole compiled law (polylines, widths, levels, lakes' rings) - the far view's
// to draw; waterAt(x, y) the water a point stands in (a river's channel, a lake, the trace's own water); riverAt(x, y) the
// nearest river within its valley; riverCrossings(ax, ay, bx, by) where a straight run crosses a channel - the roads';
// watersIn(box) what reaches a box. Deterministic and pure (the terrain worker holds the same module); cheap (a pixel's
// lookup is one Map read; a point's a few segments).
// ═══════════════════════════════════════════════════════════════════
import { pictureToBay, tamrielFit } from './tamrielFrame.js';
import { tamrielLandVersion, tamrielTrace } from './tamrielLand.js';
import { groundWoods, bayEdgeDistance, SEAM_PX, BLEND_PX } from './tamrielGround.js';
import { WoodsFile, MAP_HEIGHT } from '../../formats/woodsFile.js';
import {
  kernelTerms,
  BASE_HEIGHT_SCALE,
  NOISE_MAP_SCALE,
  SCALED_OCEAN_ELEVATION,
  MAX_TERRAIN_HEIGHT,
  HEIGHTMAP_DIMENSION,
} from '../terrain/terrainSampler.js';
import { reliefLift, continentLift, cosPi, sinPi, LANDFORM_FLOOR } from '../landforms.js'; // called, never read at load (the two modules import each other)
import { perlinNoise } from '../perlin.js';
import { WATER } from '../terrain/terrainTiles.js';
import { DIR } from '../road/roadNetwork.js'; // the roads' compass, for the rivers' pixels

/** Where the courses were read: named in the record, never shipped. */
export const WATERS_SOURCE =
  "KPbICA's reference map of Cyrodiil (\"Province of Cyrodiil, 3E 433, Natalia Dravarol, Cartographer\" - another game's published art, forwarded by the owner 2026-10-26): sources, mouths and the towns passed read off it by eye, laid on our frame by the province's cities, each course followed down our own relief's drainage";

/** Metres a Bay pixel; kernel units a metre. */
const PIXEL_M = 819.2;
const UNIT_M = 1.25;

/** THE LAKES: a centre (picture units), the half-axes (picture units) and the long axis's direction (a unit vector). */
export const LAKES = Object.freeze([
  Object.freeze({
    key: 'arrius',
    name: 'Lake Arrius',
    at: Object.freeze([196.62, 86.2]),
    r: Object.freeze([0.42, 0.26]),
    axis: Object.freeze([0.94, -0.34]),
  }),
  Object.freeze({
    key: 'poppad',
    name: 'Lake Poppad',
    at: Object.freeze([194.62, 97.62]),
    r: Object.freeze([0.34, 0.21]),
    axis: Object.freeze([0.6, 0.8]),
  }),
  Object.freeze({
    key: 'canulus',
    name: 'Lake Canulus',
    at: Object.freeze([211.52, 116.78]),
    r: Object.freeze([0.5, 0.3]),
    axis: Object.freeze([0.98, 0.2]),
  }),
]);

/** THE RIVERS, in the order they are laid (a tributary after its river): `from` a lake's key (its outflow) or null (a
 *  spring); `into` 'water' (the trace's - a sea, Lake Rumare, Niben Bay, Topal Bay) or a river's key; `width` metres at the
 *  source and the mouth; `pts` picture units, source to mouth. A river with no `name` is a stream the reference does not
 *  name (held map: unnamed). */
export const CARVED_RIVERS = Object.freeze(
  [
    {
      key: 'corbolo',
      name: 'Corbolo River',
      from: 'arrius',
      into: 'water',
      width: [24, 130],
      pts: [
        [196.62, 86.2],
        [196.69, 87.15],
        [197.41, 87.94],
        [197.25, 89.29],
        [197.32, 90],
        [196.37, 91.23],
        [195.73, 92.65],
        [195.65, 93.23],
        [195.71, 93.87],
        [196.16, 94.77],
        [196.16, 95.23],
        [196.67, 95.81],
        [196.56, 96.39],
        [196.77, 97.23],
        [197.38, 98.45],
        [196.32, 100.39],
        [195.89, 102.19],
        [195.56, 102.9],
        [195.55, 103.42],
        [194.67, 104.84],
        [194.6, 105.61],
        [194.18, 106.39],
        [193.99, 107.42],
        [193.34, 108.52],
        [193.25, 109.94],
        [192.99, 110.97],
        [192.45, 111.94],
        [192.46, 112.9],
        [192.03, 114],
        [191.2, 115.2],
        [190.0, 115.55],
        [188.94, 116],
      ],
    },
    {
      key: 'silverfish',
      name: 'Silverfish River',
      from: 'canulus',
      into: 'water',
      width: [24, 110],
      pts: [
        [211.52, 116.78],
        [210.35, 117.08],
        [209.06, 116.8],
        [207.58, 117.22],
        [206.94, 117.54],
        [204.42, 117.94],
        [201.84, 119.12],
        [199.58, 119.65],
        [198.42, 119.91],
        [196.9, 118.95],
        [195.6, 119.6],
        [194.4, 119.5],
        [192.94, 119.29],
      ],
    },
    {
      key: 'lowerNiben',
      name: 'Lower Niben',
      from: null,
      into: 'water',
      width: [320, 460],
      pts: [
        [189.45, 132.97],
        [189.66, 133.55],
        [189.28, 135.53],
        [189.58, 135.78],
        [190.29, 135.99],
        [190.78, 138.96],
        [190.88, 140.19],
        [190.76, 140.84],
        [190.94, 141.74],
        [191.81, 143.16],
        [191.91, 144.39],
        [192.23, 145.16],
        [192.23, 146.19],
        [191.58, 147.23],
        [191.48, 149.48],
        [191.58, 150],
      ],
    },
    {
      key: 'whiteRose',
      name: 'White Rose River',
      from: null,
      into: 'water',
      width: [20, 90],
      pts: [
        [140.48, 119.61],
        [142.1, 117.9],
        [143.77, 116.27],
        [144.87, 115.82],
        [147.32, 115.68],
        [149.13, 115.23],
        [152.23, 115.23],
        [153.13, 114.86],
        [153.76, 114.81],
        [154.48, 115.05],
        [155.27, 115.66],
        [155.84, 115.85],
        [156.87, 116.76],
        [157.71, 116.92],
        [158.29, 117.3],
        [159.65, 116.91],
        [160.16, 117.08],
        [160.83, 117.64],
        [161.65, 117.5],
        [162.52, 116.62],
        [163, 115.89],
        [164.53, 114.81],
        [164.8, 114.06],
        [165.46, 113.1],
        [166.97, 111.97],
        [167.5, 111.29],
        [168.33, 110.57],
        [169.07, 109.42],
        [169.69, 108.84],
        [170.04, 108.01],
        [170.38, 107.61],
        [170.1, 106.91],
        [169.45, 106.39],
        [169.52, 105.94],
      ],
    },
    {
      key: 'larsius',
      name: 'Larsius River',
      from: null,
      into: 'water',
      width: [18, 60],
      pts: [
        [176.03, 124],
        [176.04, 123.69],
        [176.9, 122.48],
        [177.41, 122],
        [178.74, 122.04],
        [179.13, 122.2],
        [180.03, 122.26],
        [181.43, 122.18],
        [182.03, 122.52],
      ],
    },
    {
      key: 'strid',
      name: 'Strid River',
      from: null,
      into: 'water',
      width: [28, 150],
      pts: [
        [141.52, 122.52],
        [141.54, 122.9],
        [141.32, 123.68],
        [141.38, 124.45],
        [140.23, 125.65],
        [139.45, 125.74],
        [138.68, 125.54],
        [138.27, 126.19],
        [137.97, 126.4],
        [137.32, 126.08],
        [136.55, 125.93],
        [135.44, 126.85],
        [134.87, 126.91],
        [133.71, 126.75],
        [133.13, 126.37],
        [131.58, 125.81],
        [130.55, 124.93],
        [129.97, 124.84],
        [128.99, 123.87],
        [128.77, 123.35],
        [128.76, 122.8],
        [128.29, 122.56],
        [127.9, 122.53],
        [127.19, 122.89],
        [125.45, 123.25],
        [124.48, 123.27],
        [123.53, 123.05],
        [123.19, 123.42],
        [122.48, 123.63],
        [121.97, 123.48],
      ],
    },
    {
      key: 'brena',
      name: 'Brena River',
      from: null,
      into: 'water',
      width: [24, 120],
      pts: [
        [131, 102.52],
        [130.35, 102.15],
        [129.71, 102.38],
        [128.74, 102.41],
        [128.28, 102.71],
        [126.87, 102.84],
        [126.35, 102.72],
        [126.03, 102.32],
        [125.26, 102.33],
        [124.74, 102.15],
        [123.77, 102.9],
        [122.74, 102.98],
        [121.84, 103.45],
        [121.4, 103.47],
        [121.06, 103.72],
        [119.7, 103.75],
        [118.35, 103.8],
        [117.78, 104.36],
        [117.74, 104.72],
        [116.91, 104.23],
        [116.03, 104.63],
        [115.54, 104.64],
        [115.27, 105.17],
        [114.81, 105.18],
        [112.94, 106.46],
        [111.06, 107.16],
        [109.65, 108.03],
        [109.52, 108.32],
        [109.53, 108.9],
        [109.1, 109.62],
        [108.79, 109.87],
        [108.75, 110.44],
        [108.13, 110.67],
        [107.97, 111.03],
      ],
    },
    {
      key: 'reed',
      name: 'Reed River',
      from: null,
      into: 'corbolo',
      width: [14, 55],
      pts: [
        [209, 94.52],
        [208.81, 94.37],
        [208.42, 94.39],
        [207.84, 94.71],
        [206.83, 94.88],
        [205.73, 95.64],
        [204.68, 95.98],
        [204.23, 95.99],
        [203.06, 96.8],
        [201.9, 97.09],
        [200.37, 97.72],
        [200, 98.13],
        [199.55, 99.09],
        [198.62, 100.13],
        [196.43, 103.35],
        [194.61, 105.16],
      ],
    },
    {
      key: 'poppadOutflow',
      name: null,
      from: 'poppad',
      into: 'corbolo',
      width: [10, 24],
      pts: [
        [194.62, 97.62],
        [194.9, 98.06],
        [194.72, 98.87],
        [195.18, 100.77],
        [194.68, 102.52],
        [194.68, 104.77],
      ],
    },
    {
      key: 'panther',
      name: 'Panther River',
      from: null,
      into: 'lowerNiben',
      width: [20, 110],
      pts: [
        [206.03, 136],
        [206.16, 135.95],
        [206.23, 136.13],
        [205.98, 136.47],
        [205.92, 136.82],
        [205.45, 136.75],
        [204.42, 137.2],
        [203.9, 137.03],
        [203.06, 137.1],
        [200.61, 138.29],
        [200.1, 138.16],
        [199.52, 138.23],
        [198.74, 138.6],
        [197.39, 138.74],
        [196.16, 139.35],
        [194.56, 139.58],
        [193.4, 140.3],
        [192.3, 140.75],
        [191.2, 141.05],
      ],
    },
  ].map((r) =>
    Object.freeze({ ...r, width: Object.freeze(r.width), pts: Object.freeze(r.pts.map((p) => Object.freeze(p))) }),
  ),
);

/** THE TRACE'S OWN WATERS NAMED (picture units: a point inside each) - waterAt's names for the picture's water past the Bay
 *  in Cyrodiil, the nearest within NAME_REACH. */
export const NAMED_WATERS = Object.freeze([
  Object.freeze({ name: 'Lake Rumare', at: Object.freeze([170, 95.4]) }),
  Object.freeze({ name: 'Lake Rumare', at: Object.freeze([168.6, 104.6]) }),
  Object.freeze({ name: 'Upper Niben', at: Object.freeze([179.4, 110]) }),
  Object.freeze({ name: 'Niben Bay', at: Object.freeze([187, 120.5]) }),
  Object.freeze({ name: 'Lower Niben', at: Object.freeze([189.8, 129.5]) }),
  Object.freeze({ name: 'Topal Bay', at: Object.freeze([192, 155]) }),
  Object.freeze({ name: 'Abecean Sea', at: Object.freeze([106, 116]) }),
]);
const NAME_REACH = 9;

/** THE DIALS (metres): a river's incision under the ground along its line (`incise` + `perWidth` of its width); its valley
 *  (the walls' run to the land) `valley` widths, held to `valleyMin`..`valleyMax`; the meanders' swing (`swing` widths,
 *  held to `swingMax`) and wavelength (`wave` widths, held to `waveMin`), and a bend under them three wavelengths long
 *  and twice the swing (held to `bendMax`); the dense line's step (`step` of a width, held
 *  to `stepMin`..`stepMax`), and how far apart its surface is read off the ground (`survey`); a lake's level under its
 *  lowest shore (`lakeIncise`), its shore's run (`shore` + `perRadius` of its mean radius), its ring's points and wander;
 *  the run over which a tributary's surface comes down to its river's where they meet (`joinRun`); how far (Bay pixels) a
 *  river's line runs on past its last point to reach its water (`mouthReach`). */
export const WATER_DIALS = Object.freeze({
  incise: 2.5,
  perWidth: 0.06,
  valley: 9,
  valleyMin: 220,
  valleyMax: 1500,
  swing: 3.5,
  swingMax: 600,
  bendMax: 900,
  wave: 13,
  waveMin: 380,
  step: 1,
  stepMin: 30,
  stepMax: 120,
  lakeIncise: 2,
  shore: 260,
  perRadius: 0.12,
  ring: 72,
  wander: 0.13,
  survey: 90,
  joinRun: 1500,
  mouthReach: 8,
});

const smooth01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const signed = (x, y) => 2 * perlinNoise(x, y) - 1;

// ── THE MACRO GROUND (the carve's reference) ─────────────────────
/** The continent's ground with no Bay in it (world/arenaPlaces.js's own way): past the Bay's seam and blend it is the
 *  ground the world stands, to the byte, on any thread. */
let _continent = null;
const continent = () => {
  if (!_continent) {
    const none = Object.create(WoodsFile.prototype);
    none.getHeightMapValue = () => 0;
    none.getLargeMapData = () => Array.from({ length: 5 }, () => new Uint8Array(5));
    _continent = groundWoods(none);
  }
  return _continent;
};
/** The macro ground at a Bay point, kernel units: the kernel's two terms (no ground noise) with the lift and its
 *  continuation - the land the shaper's samples stand at or over (the ground noise only adds). `terms` a pixel cache. */
function macroAt(terms, bx, by) {
  const span = HEIGHTMAP_DIMENSION - 1,
    px = Math.floor(bx),
    py = Math.floor(by);
  const k = px * 65536 + py;
  let t = terms.get(k);
  if (!t) terms.set(k, (t = kernelTerms(continent(), px, py)));
  const x = (bx - px) * span,
    y = (py + 1 - by) * span; // sample space: x east, y north from the pixel's south edge
  const low = t.base(x, y) * BASE_HEIGHT_SCALE;
  let h = low + t.noise(x, y) * NOISE_MAP_SCALE;
  h = h < SCALED_OCEAN_ELEVATION ? SCALED_OCEAN_ELEVATION : h > MAX_TERRAIN_HEIGHT ? MAX_TERRAIN_HEIGHT : h;
  return h + reliefLift(low) + continentLift(low);
}

// ── THE COMPILE ──────────────────────────────────────────────────
/** Catmull-Rom through `pts` (Bay pixels), a point every `step` pixels near enough. */
function spline(pts, step) {
  const out = [];
  const P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = P(i - 1),
      [x1, y1] = P(i),
      [x2, y2] = P(i + 1),
      [x3, y3] = P(i + 2);
    const n = Math.max(1, Math.ceil(Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)) / step));
    for (let s = 0; s < n; s++) {
      const t = s / n,
        t2 = t * t,
        t3 = t2 * t;
      out.push([
        0.5 * (2 * x1 + (-x0 + x2) * t + (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 + (-x0 + 3 * x1 - 3 * x2 + x3) * t3),
        0.5 * (2 * y1 + (-y0 + y2) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (-y0 + 3 * y1 - 3 * y2 + y3) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

let _law = null,
  _lawLand = -1,
  _lawFit = null;

/**
 * THE COMPILED LAW at the live trace and fit, or null with no trace (the authored continent draws no Cyrodiil of the
 * picture's). Made once a trace and a fit (the terrain worker makes its own the same way).
 * @returns {?{ version: number, rivers: Array<any>, lakes: Array<any>, index: Map<number, number[]>, lakeIndex: Map<number, number[]>, pixels: Map<number, { ri: number, dir: number, width: number, level: number }> }}
 */
export function tamrielWaters() {
  const land = tamrielLandVersion(),
    fit = tamrielFit();
  if (_law && _lawLand === land && _lawFit === fit) return _law;
  _lawLand = land;
  _lawFit = fit;
  _law = tamrielTrace() ? compile(land) : null;
  return _law;
}

function compile(version) {
  const D = WATER_DIALS,
    ppu = tamrielFit().ppu,
    terms = new Map();
  const lakes = LAKES.map((L) => {
    const [cx, cy] = pictureToBay(L.at[0], L.at[1]),
      ra = L.r[0] * ppu,
      rb = L.r[1] * ppu,
      [ax, ay] = L.axis;
    const n = D.ring,
      ring = new Float64Array(2 * n);
    let level = Infinity;
    for (let i = 0; i < n; i++) {
      const t = (2 * i) / n - 1,
        c = cosPi(t),
        s = sinPi(t); // the ring's turn, a half-turn at a time either way
      const w =
        1 + D.wander * (0.6 * signed(c * 1.7 + 11.3, s * 1.7 + 4.1) + 0.4 * signed(c * 4.1 + 7.9, s * 4.1 + 2.3));
      const u = ra * c * w,
        v = rb * s * w;
      const x = cx + u * ax - v * ay,
        y = cy + u * ay + v * ax;
      ring[2 * i] = x;
      ring[2 * i + 1] = y;
      const g = macroAt(terms, x, y);
      if (g < level) level = g;
    }
    level = Math.max(LANDFORM_FLOOR + 1, level - D.lakeIncise / UNIT_M);
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (let i = 0; i < n; i++) {
      x0 = Math.min(x0, ring[2 * i]);
      x1 = Math.max(x1, ring[2 * i]);
      y0 = Math.min(y0, ring[2 * i + 1]);
      y1 = Math.max(y1, ring[2 * i + 1]);
    }
    const shore = (D.shore + D.perRadius * ((ra + rb) / 2) * PIXEL_M) / PIXEL_M;
    return { key: L.key, name: L.name, at: [cx, cy], ring, level, shore, box: [x0, y0, x1, y1] };
  });
  /** @type {Map<string, typeof lakes[number]>} */
  const lakeOf = new Map(lakes.map((l) => [l.key, l]));
  const rivers = [],
    riverOf = new Map();
  for (const R of CARVED_RIVERS) {
    const ctl = R.pts.map(([px, py]) => pictureToBay(px, py));
    const [w0, w1] = R.width;
    const stepPx = Math.min(D.stepMax, Math.max(D.stepMin, (D.step * (w0 + w1)) / 2)) / PIXEL_M;
    // a tributary ends on its river's line: its last point the river's nearest
    const main = R.into !== 'water' ? riverOf.get(R.into) : null;
    if (main) ctl[ctl.length - 1] = nearestOn(main, ...ctl[ctl.length - 1]).at;
    // a river into the trace's water reaches it: where its last point stands on the land (the lakes' smooth shores,
    // world/tamriel/tamrielLand.js SMOOTH-LAND, move a shore a few pixels), its line runs on along its last leg into the water
    else {
      const [lx, ly] = ctl[ctl.length - 1],
        [qx, qy] = ctl[ctl.length - 2],
        dl = Math.sqrt((lx - qx) * (lx - qx) + (ly - qy) * (ly - qy)) || 1;
      const ux = (lx - qx) / dl,
        uy = (ly - qy) / dl;
      for (let t = 0; t <= D.mouthReach; t += 0.25) {
        if (continent().getHeightMapValue(Math.floor(lx + ux * t), Math.floor(ly + uy * t)) !== 0) continue;
        if (t > 0) ctl.push([lx + ux * (t + 0.5), ly + uy * (t + 0.5)]);
        break;
      }
    }
    const base = spline(ctl, stepPx);
    // the arc length, then the meanders: a swing either side on a wavelength of a dozen widths, nothing at either end
    const n = base.length,
      len = new Float64Array(n);
    for (let i = 1; i < n; i++) {
      const dx = base[i][0] - base[i - 1][0],
        dy = base[i][1] - base[i - 1][1];
      len[i] = len[i - 1] + Math.sqrt(dx * dx + dy * dy);
    }
    const total = len[n - 1] || 1;
    const pts = new Float64Array(2 * n),
      width = new Float32Array(n),
      level = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const f = len[i] / total,
        w = w0 + (w1 - w0) * Math.sqrt(f);
      const wave = Math.max(D.waveMin, D.wave * w) / PIXEL_M,
        swing = Math.min(D.swingMax, D.swing * w) / PIXEL_M;
      const ends = smooth01(len[i] / wave) * smooth01((total - len[i]) / wave);
      const a = base[Math.max(0, i - 1)],
        b = base[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0],
        ty = b[1] - a[1];
      const tl = Math.sqrt(tx * tx + ty * ty) || 1;
      tx /= tl;
      ty /= tl;
      // the meanders' own swing and, under it, a bend three times as long and twice as wide (held to bendMax)
      const bend = Math.min(D.bendMax / PIXEL_M, 2 * swing),
        bw = wave * 3,
        bendEnds = smooth01(len[i] / bw) * smooth01((total - len[i]) / bw);
      const m =
        swing *
          ends *
          (0.75 * signed(len[i] / wave + rivers.length * 7.31, 3.7) +
            0.25 * signed(len[i] / (wave * 0.37) + 1.9, rivers.length * 2.17 + 8.3)) +
        bend * bendEnds * signed(len[i] / bw + rivers.length * 3.19, 41.3);
      pts[2 * i] = base[i][0] - ty * m;
      pts[2 * i + 1] = base[i][1] + tx * m;
      width[i] = w;
    }
    // THE SURFACE: the macro ground less the incision, a running minimum from the source - from its lake's level where it
    // flows out of one - never under the knee's floor, and a tributary eased down to its river where it joins
    // (the ground read every `every` points - about SURVEY_M apart - and the level between them straight)
    const from = R.from ? lakeOf.get(R.from) : null,
      every = Math.max(1, Math.round(D.survey / (stepPx * PIXEL_M)));
    let z = from ? from.level : Infinity,
      last = 0;
    for (let i = 0; i < n; i += every) {
      const g = macroAt(terms, pts[2 * i], pts[2 * i + 1]) - (D.incise + D.perWidth * width[i]) / UNIT_M;
      if (g < z) z = g;
      level[i] = z > LANDFORM_FLOOR ? z : LANDFORM_FLOOR;
      for (let j = last + 1; j < i; j++) level[j] = level[last] + (level[i] - level[last]) * ((j - last) / (i - last));
      last = i;
      if (i < n - 1 && i + every > n - 1) i = n - 1 - every; // the mouth is surveyed too
    }
    // a tributary meets its river at its river's surface: never under it, and over its last joinRun eased down to it (both
    // factors never rising downstream, so neither does the product)
    if (main) {
      const j = nearestOn(main, pts[2 * n - 2], pts[2 * n - 1]).level,
        run = D.joinRun / PIXEL_M;
      for (let i = 0; i < n; i++) {
        if (level[i] < j) level[i] = j;
        level[i] = j + (level[i] - j) * smooth01((total - len[i]) / run);
      }
    }
    const r = { key: R.key, name: R.name, into: R.into, from: R.from, pts, width, level, n };
    rivers.push(r);
    riverOf.set(R.key, r);
  }
  // THE INDEX: every Bay pixel a segment's reach (its half width and its valley) touches, the segments that reach it
  const index = new Map(),
    lakeIndex = new Map();
  const add = (map, x0, y0, x1, y1, id) => {
    for (let y = Math.floor(y0); y <= Math.floor(y1); y++)
      for (let x = Math.floor(x0); x <= Math.floor(x1); x++) {
        const k = x * 65536 + y;
        let a = map.get(k);
        if (!a) map.set(k, (a = []));
        if (a[a.length - 1] !== id) a.push(id);
      }
  };
  // (a run of RUN segments at a time - its box and its widest reach - so the index is a fraction of the segments' count;
  // an entry lists every segment of its run)
  rivers.forEach((r, ri) => {
    for (let i0 = 0; i0 < r.n - 1; i0 += RUN) {
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity,
        w = 0;
      for (let i = i0; i <= Math.min(r.n - 1, i0 + RUN); i++) {
        const x = r.pts[2 * i],
          y = r.pts[2 * i + 1];
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        if (r.width[i] > w) w = r.width[i];
      }
      const reach = reachOf(w) / PIXEL_M;
      add(index, x0 - reach, y0 - reach, x1 + reach, y1 + reach, ri * 65536 + i0);
    }
  });
  lakes.forEach((l, li) =>
    add(lakeIndex, l.box[0] - l.shore, l.box[1] - l.shore, l.box[2] + l.shore, l.box[3] + l.shore, li),
  );
  // THE PIXELS (the roads'): every Bay pixel a channel crosses, its flow's compass and the widest of it there
  const pixels = new Map();
  rivers.forEach((r, ri) => {
    for (let i = 0; i < r.n; i++) {
      const x = r.pts[2 * i],
        y = r.pts[2 * i + 1],
        k = Math.floor(x) * 65536 + Math.floor(y);
      const a = Math.max(0, i - 1),
        b = Math.min(r.n - 1, i + 1);
      const dir = compassOf(r.pts[2 * b] - r.pts[2 * a], r.pts[2 * b + 1] - r.pts[2 * a + 1]);
      const had = pixels.get(k);
      if (had && had.width >= r.width[i]) {
        if (had.ri === ri && r.level[i] < had.level) had.level = r.level[i];
        continue;
      }
      pixels.set(k, {
        ri,
        dir,
        width: r.width[i],
        level: had?.ri === ri ? Math.min(had.level, r.level[i]) : r.level[i],
      });
    }
  });
  return { version, rivers, lakes, index, lakeIndex, pixels };
}

/** A direction (Bay pixels, y south) as the roads' compass (world/road/roadNetwork.js DIR: N 128, NE 64, E 32, SE 16, S 8,
 *  SW 4, W 2, NW 1) - the nearest of the eight, by the tangent of 22.5 degrees (no angle asked of the engine). */
const TAN_22 = Math.SQRT2 - 1;
function compassOf(dx, dy) {
  const ax = dx < 0 ? -dx : dx,
    ay = dy < 0 ? -dy : dy;
  if (ay <= TAN_22 * ax) return dx >= 0 ? DIR.E : DIR.W;
  if (ax <= TAN_22 * ay) return dy < 0 ? DIR.N : DIR.S;
  return dy < 0 ? (dx > 0 ? DIR.NE : DIR.NW) : dx > 0 ? DIR.SE : DIR.SW;
}
/** The segments an index entry stands for: its run's. */
const RUN = 8;
/** A river's half width plus its valley's walls, metres - the furthest its carve reaches from its centre line. */
const valleyOf = (w) => Math.min(WATER_DIALS.valleyMax, Math.max(WATER_DIALS.valleyMin, WATER_DIALS.valley * w));
const reachOf = (w) => w / 2 + valleyOf(w);

/** The nearest point of a compiled river to (x, y): its place, its segment, the fraction along it, its distance (Bay
 *  pixels), the width and level there. */
function nearestOn(r, x, y, from = 0, to = r.n - 2) {
  let best = Infinity,
    at = [r.pts[0], r.pts[1]],
    seg = 0,
    frac = 0;
  for (let i = from; i <= to; i++) {
    const ax = r.pts[2 * i],
      ay = r.pts[2 * i + 1],
      vx = r.pts[2 * i + 2] - ax,
      vy = r.pts[2 * i + 3] - ay;
    const l2 = vx * vx + vy * vy;
    let t = l2 > 0 ? ((x - ax) * vx + (y - ay) * vy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + vx * t - x,
      qy = ay + vy * t - y,
      d2 = qx * qx + qy * qy;
    if (d2 < best) {
      best = d2;
      at = [ax + vx * t, ay + vy * t];
      seg = i;
      frac = t;
    }
  }
  return {
    at,
    seg,
    frac,
    d: Math.sqrt(best),
    width: r.width[seg] + (r.width[seg + 1] - r.width[seg]) * frac,
    level: r.level[seg] + (r.level[seg + 1] - r.level[seg]) * frac,
  };
}

/** How far (x, y) stands from a lake's shore, Bay pixels - negative inside its ring (crossings). */
function lakeDistance(l, x, y) {
  const r = l.ring,
    n = r.length / 2;
  let inside = false,
    best = Infinity;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = r[2 * i],
      yi = r[2 * i + 1],
      xj = r[2 * j],
      yj = r[2 * j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    const vx = xi - xj,
      vy = yi - yj,
      l2 = vx * vx + vy * vy;
    let t = l2 > 0 ? ((x - xj) * vx + (y - yj) * vy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = xj + vx * t - x,
      qy = yj + vy * t - y,
      d2 = qx * qx + qy * qy;
    if (d2 < best) best = d2;
  }
  return inside ? -Math.sqrt(best) : Math.sqrt(best);
}

/** The nearest river segment to (x, y) among `ids` (index entries), within its reach - or null; the answer is one object
 *  reused (the carve asks it at every sample of a river's pixels), read before the next ask. */
const _near = { river: /** @type {any} */ (null), d: 0, w: 0, level: 0 };
function nearestRiver(law, ids, x, y) {
  let best = null,
    bd = Infinity;
  for (let k = 0; k < ids.length; k++) {
    const ri = (ids[k] / 65536) | 0,
      i0 = ids[k] - ri * 65536,
      r = law.rivers[ri],
      i1 = Math.min(r.n - 2, i0 + RUN - 1);
    for (let i = i0; i <= i1; i++) {
      const ax = r.pts[2 * i],
        ay = r.pts[2 * i + 1],
        vx = r.pts[2 * i + 2] - ax,
        vy = r.pts[2 * i + 3] - ay;
      const l2 = vx * vx + vy * vy;
      let t = l2 > 0 ? ((x - ax) * vx + (y - ay) * vy) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = ax + vx * t - x,
        qy = ay + vy * t - y,
        d = Math.sqrt(qx * qx + qy * qy) * PIXEL_M;
      const w = r.width[i] + (r.width[i + 1] - r.width[i]) * t;
      if (d > reachOf(w)) continue;
      // the nearest by its own channel's edge, so a narrow stream beside a broad river is not taken for it
      const e = d - w / 2;
      if (e < bd) {
        bd = e;
        best = _near;
        _near.river = r;
        _near.d = d;
        _near.w = w;
        _near.level = r.level[i] + (r.level[i + 1] - r.level[i]) * t;
      }
    }
  }
  return best;
}

// ── THE CARVE (world/landforms.js's shaper) ──────────────────────
/** The ground at a sample by a river or a lake: `base` the land without the landforms (kernel units), `hh` the landforms. */
function carveAt(law, rids, lids, x, y, base, hh) {
  let g = base + hh;
  const r = rids ? nearestRiver(law, rids, x, y) : null;
  if (r) {
    const half = r.w / 2,
      valley = valleyOf(r.w),
      e = r.d - half;
    const landk = base + hh * smooth01(e / (0.8 * valley));
    const z = r.level;
    const out = landk > z ? z + (landk - z) * smooth01(e / valley) : e < 0 ? z : landk;
    if (out < g) g = out;
  }
  if (lids) {
    for (let k = 0; k < lids.length; k++) {
      const l = law.lakes[lids[k]],
        sd = lakeDistance(l, x, y),
        inside = sd < 0;
      const e = inside ? 0 : sd;
      if (!inside && e > l.shore) continue;
      const landk = base + hh * smooth01(e / (0.8 * l.shore));
      const out = inside ? l.level : landk > l.level ? l.level + (landk - l.level) * smooth01(e / l.shore) : landk;
      if (out < g) g = out;
    }
  }
  return g;
}

/**
 * THE SHAPER'S HOOK: for a pixel past the Bay's seam (`px`, `py`; `span` its samples less one), the carve its samples take,
 * or null where no river or lake reaches it (all but a few of the continent's pixels: one Map read). The pixel's segments
 * are sorted into a grid of cells so a sample reads only those that reach its own.
 * @returns {?{ carve: (gx: number, gy: number, base: number, hh: number) => number }}
 */
export function tamrielWatersShaper(px, py, span) {
  const law = tamrielWaters();
  if (!law) return null;
  const k = px * 65536 + py,
    rids = law.index.get(k) ?? null,
    lids = law.lakeIndex.get(k) ?? null;
  if (!rids && !lids) return null;
  // the cells: 8 a side (16 samples), each the segments whose reach meets it
  const C = 8,
    cell = 1 / C,
    cells = new Array(C * C);
  for (let j = 0; j < C; j++) {
    for (let i = 0; i < C; i++) {
      const cx = px + (i + 0.5) * cell,
        cy = py + (j + 0.5) * cell,
        rad = cell * Math.SQRT1_2;
      cells[j * C + i] = rids
        ? rids.filter((id) => {
            const ri = (id / 65536) | 0,
              s0 = id - ri * 65536,
              r = law.rivers[ri];
            for (let s = s0; s <= Math.min(r.n - 2, s0 + RUN - 1); s++) {
              const ax = r.pts[2 * s],
                ay = r.pts[2 * s + 1],
                vx = r.pts[2 * s + 2] - ax,
                vy = r.pts[2 * s + 3] - ay,
                l2 = vx * vx + vy * vy;
              let t = l2 > 0 ? ((cx - ax) * vx + (cy - ay) * vy) / l2 : 0;
              t = t < 0 ? 0 : t > 1 ? 1 : t;
              const qx = ax + vx * t - cx,
                qy = ay + vy * t - cy;
              if (Math.sqrt(qx * qx + qy * qy) <= reachOf(Math.max(r.width[s], r.width[s + 1])) / PIXEL_M + rad)
                return true;
            }
            return false;
          })
        : null;
    }
  }
  const mapH = MAP_HEIGHT;
  return {
    carve: (gx, gy, base, hh) => {
      const x = gx / span,
        y = mapH + 1 - gy / span; // the sample's Bay point (a pixel's samples run y py + 1 .. py)
      let ci = Math.floor((x - px) * C),
        cj = Math.floor((y - py) * C);
      ci = ci < 0 ? 0 : ci >= C ? C - 1 : ci;
      cj = cj < 0 ? 0 : cj >= C ? C - 1 : cj;
      const ids = cells[cj * C + ci];
      return carveAt(law, ids && ids.length ? ids : null, lids, x, y, base, hh);
    },
  };
}

// ── THE PAINT (world/terrain/terrainGen.js) ─────────────────────
/**
 * THE WATER'S CORNERS: the corners of a pixel past the Bay (its 129 x 129 tile data, x east, y north - generateTileData's
 * frame) that stand in a river's channel or a lake are water to the marching squares, so the shore and the water's sheet
 * are laid there. Only where the carve stands (the landforms' row on); never a location's own rect. Answers how many.
 * @param {Uint8Array} tileData @param {number} px @param {number} py
 * @param {?{xMin: number, xMax: number, yMin: number, yMax: number}} [rect]
 * @param {number} [tdDim] @param {?Uint8Array} [paths] RIVER-FORDS: the tiles the road painter wrote (GRASS-PATH1), kept
 */
export function paintTamrielWaters(tileData, px, py, rect = null, tdDim = HEIGHTMAP_DIMENSION, paths = null) {
  if (bayEdgeDistance(px, py) <= SEAM_PX + BLEND_PX) return 0;
  const law = tamrielWaters();
  if (!law) return 0;
  const k = px * 65536 + py,
    rids = law.index.get(k) ?? null,
    lids = law.lakeIndex.get(k) ?? null;
  if (!rids && !lids) return 0;
  const span = tdDim - 1;
  let n = 0;
  for (let y = 0; y < tdDim; y++) {
    for (let x = 0; x < tdDim; x++) {
      if (rect && x > rect.xMin && x < rect.xMax && y > rect.yMin && y < rect.yMax) continue;
      if (paths && onPath(paths, x, y, span)) continue; // RIVER-FORDS: a road's or a track's own tiles keep their ground - the ford
      if (!wetAt(law, rids, lids, px + x / span, py + 1 - y / span)) continue;
      tileData[y * tdDim + x] = WATER;
      n++;
    }
  }
  return n;
}
/** RIVER-FORDS (AUDIT RELEASE R1-3): is a sample a corner of a tile the road painter wrote (`paths`, GRASS-PATH1's record,
 *  `span` tiles a side) - a crossing's road kept a ford, never painted over by the channel. */
function onPath(paths, x, y, span) {
  for (let ty = y - 1; ty <= y; ty++)
    for (let tx = x - 1; tx <= x; tx++)
      if (tx >= 0 && ty >= 0 && tx < span && ty < span && paths[ty * span + tx]) return true;
  return false;
}
/** Is a Bay point in a channel or a lake (the compiled law's own water, not the trace's)? */
function wetAt(law, rids, lids, x, y) {
  if (lids) for (let k = 0; k < lids.length; k++) if (lakeDistance(law.lakes[lids[k]], x, y) < 0) return true;
  if (rids) {
    const r = nearestRiver(law, rids, x, y);
    if (r && r.d < r.w / 2) return true;
  }
  return false;
}

// ── THE QUERIES (the roads, the far view, the held map) ──────────
const pixelIds = (law, x, y) => [
  law.index.get(Math.floor(x) * 65536 + Math.floor(y)) ?? null,
  law.lakeIndex.get(Math.floor(x) * 65536 + Math.floor(y)) ?? null,
];

/**
 * THE WATER A POINT STANDS IN (Bay pixel coordinates): `{ kind: 'river', key, name, level }` in a river's channel,
 * `{ kind: 'lake', key, name, level }` in one of LAKES, `{ kind: 'sea', key: null, name }` on the trace's own water past the
 * Bay (a sea, Lake Rumare, Niben Bay - NAMED_WATERS' name where one is near, else null), or null on dry land and on the
 * Bay (its own water is WOODS.WLD's and Basic Roads'). `level` the water's surface, metres in the terrain's own frame (the
 * sea at 34 m - terrainSampler.js SCALED_OCEAN_ELEVATION at 1.25 m a unit).
 * @param {number} x @param {number} y
 */
export function waterAt(x, y) {
  if (bayEdgeDistance(Math.floor(x), Math.floor(y)) <= SEAM_PX + BLEND_PX) return null;
  const law = tamrielWaters();
  if (!law) return null;
  const [rids, lids] = pixelIds(law, x, y);
  if (lids)
    for (const li of lids) {
      const l = law.lakes[li];
      if (lakeDistance(l, x, y) < 0) return { kind: 'lake', key: l.key, name: l.name, level: l.level * UNIT_M };
    }
  if (rids) {
    const r = nearestRiver(law, rids, x, y);
    if (r && r.d < r.w / 2) return { kind: 'river', key: r.river.key, name: r.river.name, level: r.level * UNIT_M };
  }
  if (continent().getHeightMapValue(Math.floor(x), Math.floor(y)) > 0) return null; // the trace's water is the ground's byte 0
  let name = null,
    bd = NAME_REACH * tamrielFit().ppu;
  for (const w of NAMED_WATERS) {
    const [wx, wy] = pictureToBay(w.at[0], w.at[1]),
      d = Math.sqrt((wx - x) * (wx - x) + (wy - y) * (wy - y));
    if (d < bd) {
      bd = d;
      name = w.name;
    }
  }
  return { kind: 'sea', key: null, name, level: SCALED_OCEAN_ELEVATION * UNIT_M };
}

/**
 * THE NEAREST RIVER to a Bay point within its valley's reach: `{ key, name, distance, half, valley, level }` (metres: from
 * its centre line, its half width, its valley's reach past the channel, its surface in the terrain's frame) or null.
 */
export function riverAt(x, y) {
  const law = tamrielWaters();
  if (!law) return null;
  const [rids] = pixelIds(law, x, y);
  const r = rids ? nearestRiver(law, rids, x, y) : null;
  return r
    ? {
        key: r.river.key,
        name: r.river.name,
        distance: r.d,
        half: r.w / 2,
        valley: valleyOf(r.w),
        level: r.level * UNIT_M,
      }
    : null;
}

/**
 * WHERE A STRAIGHT RUN CROSSES A CHANNEL (Bay pixel coordinates, a to b): every river it crosses, in order along it -
 * `{ key, name, at: [x, y], t, width, level }` (`t` 0..1 along the run, `width` metres). A road's question: bridge it there,
 * or go round. Lakes are not crossings (watersIn names them, waterAt says a point is in one).
 */
export function riverCrossings(ax, ay, bx, by) {
  const law = tamrielWaters();
  if (!law) return [];
  const out = [];
  for (const r of law.rivers) {
    for (let i = 0; i < r.n - 1; i++) {
      const cx = r.pts[2 * i],
        cy = r.pts[2 * i + 1],
        dx = r.pts[2 * i + 2],
        dy = r.pts[2 * i + 3];
      const den = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
      if (den === 0) continue;
      const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / den,
        u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / den;
      // a run through a vertex crosses once: the segment's end is the next one's start (within a rounding either side)
      if (t < 0 || t > 1 || u < -1e-9 || u > 1 || (u >= 1 - 1e-9 && i < r.n - 2)) continue;
      out.push({
        key: r.key,
        name: r.name,
        at: [ax + (bx - ax) * t, ay + (by - ay) * t],
        t,
        width: r.width[i] + (r.width[i + 1] - r.width[i]) * u,
        level: (r.level[i] + (r.level[i + 1] - r.level[i]) * u) * UNIT_M,
      });
    }
  }
  return out.sort((p, q) => p.t - q.t);
}

/**
 * THE RIVERS ON THE MAP'S PIXELS - the roads' question (a router steps a pixel at a time, and a channel is narrower than
 * one): the river whose channel crosses Bay pixel (px, py), `{ key, name, dir, width, level }` - `dir` the way its water
 * runs as the roads' compass (world/road/roadNetwork.js DIR), `width` the widest of it in the pixel (metres), `level` its
 * surface there (metres, the terrain's frame) - or null. Where two meet, the wider's.
 */
export function riverPixel(px, py) {
  const law = tamrielWaters();
  const p = law ? law.pixels.get(px * 65536 + py) : null;
  if (!p) return null;
  const r = law.rivers[p.ri];
  return { key: r.key, name: r.name, dir: p.dir, width: p.width, level: p.level * UNIT_M };
}
/**
 * THE RIVERS' PIXELS OVER A BOX (Bay pixels x0..x0 + w - 1, y0..y0 + h - 1), row-major: `dir` the compass of each pixel a
 * channel crosses (0 where none) and `width` its width (metres, rounded) - a region's raster for the router, one pass.
 */
export function riverRaster(x0, y0, w, h) {
  const dir = new Uint8Array(w * h),
    width = new Uint16Array(w * h),
    law = tamrielWaters();
  if (!law) return { dir, width };
  for (const [k, p] of law.pixels) {
    const x = Math.floor(k / 65536) - x0,
      y = k - Math.floor(k / 65536) * 65536 - y0;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    dir[y * w + x] = p.dir;
    width[y * w + x] = Math.round(p.width);
  }
  return { dir, width };
}

/**
 * ROAD-LOOK (bible/03-World/Roads.md ROAD-LOOK): THE LAKES' PIXELS OVER A BOX (Bay pixels x0..x0 + w - 1, y0..y0 + h - 1),
 * row-major: 1 where the pixel's middle stands in a lake or within `margin` Bay pixels of its water - the roads' question:
 * a lake is carved inside the kernel, narrower than the bytes say, and the router crossed it as dry ground (its water
 * painted round the road's tiles - a dry strip across Lake Arrius and Lake Poppad).
 * @param {number} x0 @param {number} y0 @param {number} w @param {number} h @param {number} [margin]
 */
export function lakeRaster(x0, y0, w, h, margin = 0) {
  const out = new Uint8Array(w * h),
    law = tamrielWaters();
  if (!law) return out;
  for (const l of law.lakes) {
    const u0 = Math.max(0, Math.floor(l.box[0] - margin) - x0),
      u1 = Math.min(w - 1, Math.floor(l.box[2] + margin) - x0);
    const v0 = Math.max(0, Math.floor(l.box[1] - margin) - y0),
      v1 = Math.min(h - 1, Math.floor(l.box[3] + margin) - y0);
    for (let v = v0; v <= v1; v++)
      for (let u = u0; u <= u1; u++) if (lakeDistance(l, x0 + u + 0.5, y0 + v + 0.5) < margin) out[v * w + u] = 1;
  }
  return out;
}

/** WHAT REACHES A BOX (Bay pixel coordinates, x0..x1, y0..y1): the rivers' and lakes' keys whose carve touches it. */
export function watersIn(x0, y0, x1, y1) {
  const law = tamrielWaters();
  const rivers = new Set(),
    lakes = new Set();
  if (!law) return { rivers: [], lakes: [] };
  for (let y = Math.floor(y0); y <= Math.floor(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.floor(x1); x++) {
      for (const id of law.index.get(x * 65536 + y) ?? []) rivers.add(law.rivers[(id / 65536) | 0].key);
      for (const li of law.lakeIndex.get(x * 65536 + y) ?? []) lakes.add(law.lakes[li].key);
    }
  }
  return { rivers: [...rivers], lakes: [...lakes] };
}
