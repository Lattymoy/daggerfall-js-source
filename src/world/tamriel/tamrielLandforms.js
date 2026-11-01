// @ts-check
// ═══════════════════════════════════════════════════════════════════
// BREATHTAKER3 (2026-10-26, bible/03-World/Tamriel.md BREATHTAKER; KPbICA's spec, forwarded by the owner: "Make small
// landscapes that can't be seen on a Tamriel's heightmap more diverse. Now it's just a very monotonous noise.") - THE
// LAND PAST THE BAY BELOW THE HEIGHTMAP'S OWN GRAIN.
//
// The heightmap (TAMRIEL-RELIEF) says how high the land stands to about 6 km; under that the land past the Bay wore the
// Bay's climate hills (world/landforms.js LANDFORM6: one shape a climate - all Cyrodiil's jungle the same knolls, all
// Skyrim's mountains the same ridges) over two lattice hashes (the large map's 273 m egg-crate, world/tamriel/tamrielGround.js
// tamrielLargeMap, and the bytes' 819 m jitter): measured on the freeware's trace, the land's detail under 10 km followed
// the heightmap at a correlation of 0.12 - noise, the same everywhere. Here the land wears LANDFORMS chosen by what the
// land is:
//   - its ZONE (world/tamriel/tamrielBiomes.js, each zone a palette of families - ZONE_LANDS; its climate's else),
//   - its HEIGHT and SLOPE (the macro ground's, the heightmap's own): ridges and valleys running down a range's flanks,
//     foothills under them, plateaus where high ground lies flat, escarpments and terraces across a steady slope, gullies
//     cut down a steep one, outcrops on the uplands,
//   - and a slow VARIETY field, so one zone is not one shape (a dune sea gives way to mesas, rolling country to drumlins).
// Every family is centred on the land (its mean is the macro's own), so the heightmap's shape stands; the mix is blended,
// never switched, so no border is a seam.
//
// THE FAMILIES (the mix's - weights summing to one): rolling hills; ridges and valleys (a ridged field stretched DOWN the
// macro slope - spurs and gullies the way water runs, not crater rims - sharp-crested, with peaks where ridges cross);
// foothills (the same, rounded); mesas and buttes (flat-topped tiers, steep sides); dunes (crests across a wind, a slip face
// to lee); drumlins and moraines (the north's ice-laid hills: whalebacks along the ice's flow, moraine ridges across it,
// kettle holes); karst (cone hills and sinkholes); marsh (hummocks and hollows); broken ground (ravines and crags). THE
// ACCENTS (added over the mix): terraces and escarpments (the land stepped across its own contours - a plateau where the
// step is tall and the ground flat), gullies (narrow cuts down a slope - badlands where it is dry) and outcrops (tors).
//
// ORIENTATION WITHOUT DISTORTION: a ridge or a drumlin runs along the macro slope's direction, which turns from place to
// place. Rotating world coordinates by a turning angle would shear a field by the world's whole extent, so each oriented
// family is read in ORIENT fixed frames (every 30 degrees) and the two nearest the local direction are blended (`orient`).
//
// PURE, AND ONE FLOAT IN EVERY ENGINE (AUDIT LANDFORMS III A8): world position, the bytes and the zones in, a height out -
// no Math.cos, Math.exp or `**` (the frames' cosines are square roots, exact); the slow fields are read on a lattice of
// world positions, so a sample on a pixel's edge is one number from both pixels.
// ═══════════════════════════════════════════════════════════════════
import { perlinNoise } from '../perlin.js';
import { CLIMATES } from '../../formats/mapsTables.js';

const C = CLIMATES;
const smooth01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const signed = (x, y) => 2 * perlinNoise(x, y) - 1;

/** THE FAMILIES' ORDER (the mix's weights and dials below by this index). */
export const FAMILIES = Object.freeze(['roll', 'ridge', 'foot', 'mesa', 'dune', 'drum', 'karst', 'marsh', 'broken']);
const F = Object.freeze(Object.fromEntries(FAMILIES.map((k, i) => [k, i])));
const NF = FAMILIES.length;

/** ALL THE DIALS IN ONE PLACE (LANDFORM_DIALS' rule): heights in kernel units (1.25 m), lengths in samples (6.4 m).
 *  Each family's `low`..`high` its height where the region field lies quiet and where it rolls hardest; `scale` its
 *  wavelength. The accents' `step` the terrace's riser, `depth` a gully's, `high` an outcrop's. `top` the most any of it
 *  stands over (or a dale under) the land - TAMRIEL_TOP, the bound world/landforms.js's ceiling counts. */
export const TAMRIEL_LANDFORM_DIALS = Object.freeze({
  roll: Object.freeze({ low: 34, high: 74 }),
  ridge: Object.freeze({ low: 40, high: 150, across: 300, stretch: 1.7 }),
  foot: Object.freeze({ low: 32, high: 84, across: 360, stretch: 1.5 }),
  mesa: Object.freeze({ low: 32, high: 92 }),
  dune: Object.freeze({ low: 7, high: 22, spacing: 70 }),
  drum: Object.freeze({ low: 12, high: 30, cell: 150 }),
  karst: Object.freeze({ low: 28, high: 76, cell: 120 }),
  marsh: Object.freeze({ low: 4, high: 12 }),
  broken: Object.freeze({ low: 18, high: 42 }),
  terrace: Object.freeze({ low: 30, high: 64, warp: 900, riser: 0.32 }),
  gully: Object.freeze({ low: 5, high: 16, across: 56, stretch: 4.5 }),
  outcrop: Object.freeze({ low: 7, high: 18, cell: 64, fill: 0.2 }),
  // the slow fields: the region (how hard the land rolls), the variety (which of a zone's shapes), their wavelengths
  region: 2100,
  variety: 3400,
  warp: 70,
  warpScale: 480,
  // the macro slope (rise over run, metres) past which a flank is a flank, and its height over the knee at which the
  // upland's families stand whole (kernel units)
  flank: 0.06,
  upland: 900,
  // how far past the Bay's seam (map pixels) the landforms come in from the Bay's own hills
  ramp: 8,
  // the most the landforms stand over (or under) the land: a soft clip past `clip` of it (world/landforms.js counts it)
  top: 260,
  clip: 0.6,
});

/** The tallest the landforms stand over the land (or a dale under it), kernel units - a bound by construction (the mix is
 *  clipped softly to it, `topClip`), the one world/landforms.js counts (groundTopOf, CONTINENT_CEILING). */
export const TAMRIEL_TOP = TAMRIEL_LANDFORM_DIALS.top;
/** The soft clip: itself to `clip` of the top, then easing toward the top (its slope whole at the knee - never a crease),
 *  never past it. Rational, so one float in every engine. */
export function topClip(v) {
  const T = TAMRIEL_TOP,
    k = TAMRIEL_LANDFORM_DIALS.clip * T,
    a = v < 0 ? -v : v;
  if (a <= k) return v;
  const x = (a - k) / (T - k),
    o = k + (T - k) * (x / (1 + x));
  return v < 0 ? -o : o;
}

/** A ZONE'S PALETTE: the families its land wears (weights, normalised), keyed by world/tamriel/tamrielBiomes.js BIOMES'
 *  keys; a zone not named takes its climate's (CLIMATE_LANDS). `dry` tilts its accents to badlands (gullies, mesas'
 *  cuestas); `north` lets the ice's drumlins in on its low ground; `steps` tilts it to terraces and escarpments. */
export const ZONE_LANDS = Object.freeze({
  skyrimFrozenCoast: { ridge: 0.3, drum: 0.7, north: 1 },
  skyrimTundra: { drum: 0.55, roll: 0.25, foot: 0.2, north: 1 },
  skyrimPinewood: { foot: 0.55, roll: 0.25, drum: 0.2, north: 0.6 },
  skyrimReach: { karst: 0.45, ridge: 0.35, broken: 0.2, steps: 0.6 },
  skyrimPeaks: { ridge: 1 },
  highRockWrothgar: { ridge: 0.8, foot: 0.2 },
  highRockBangkorai: { foot: 0.45, mesa: 0.3, roll: 0.25, dry: 0.5, steps: 0.6 },
  highRockRivenspire: { broken: 0.5, roll: 0.3, drum: 0.2, north: 0.8 },
  highRockNorthpoint: { roll: 0.8, foot: 0.2, steps: 0.3 },
  hammerfellAlikr: { dune: 0.65, mesa: 0.35, dry: 1 },
  hammerfellCraglorn: { mesa: 0.6, broken: 0.2, ridge: 0.2, dry: 1, steps: 1 },
  hammerfellCoast: { roll: 0.6, mesa: 0.2, foot: 0.2, dry: 0.4, steps: 0.4 },
  hammerfellDragontail: { ridge: 0.8, mesa: 0.2, dry: 0.6 },
  summersetVineCoast: { roll: 0.65, foot: 0.35, steps: 0.8 },
  summersetAuridon: { roll: 0.7, foot: 0.3, steps: 0.3 },
  summersetEtonNir: { ridge: 0.9, foot: 0.1 },
  valenwoodGrahtwood: { roll: 0.5, karst: 0.3, foot: 0.2 },
  valenwoodMalabal: { karst: 0.55, foot: 0.25, roll: 0.2 },
  valenwoodGreenshade: { marsh: 0.5, roll: 0.3, karst: 0.2 },
  valenwoodReapersMarch: { roll: 0.55, mesa: 0.2, foot: 0.25, dry: 0.3, steps: 0.5 },
  elsweyrAnequina: { mesa: 0.55, broken: 0.15, dune: 0.3, dry: 1, steps: 1 },
  elsweyrPlains: { roll: 0.6, dune: 0.15, mesa: 0.25, dry: 0.6, steps: 0.5 },
  elsweyrPellitine: { roll: 0.75, karst: 0.25 },
  elsweyrTenmar: { karst: 0.5, roll: 0.5 },
  blackMarshHist: { marsh: 1 },
  blackMarshFens: { marsh: 0.8, roll: 0.2 },
  blackMarshMurkmire: { marsh: 0.5, karst: 0.3, roll: 0.2 },
  blackMarshGloomire: { marsh: 0.6, roll: 0.4 },
  morrowindAshlands: { broken: 0.4, ridge: 0.3, mesa: 0.3, dry: 1 },
  morrowindGrazelands: { roll: 0.75, foot: 0.25, steps: 0.4 },
  morrowindRedMountain: { ridge: 0.7, broken: 0.3, dry: 1 },
  morrowindAscadian: { roll: 0.8, foot: 0.2, steps: 0.6 },
  morrowindBitterCoast: { marsh: 0.7, roll: 0.3 },
  morrowindStonefalls: { broken: 0.45, mesa: 0.3, ridge: 0.25, dry: 0.8 },
  morrowindDeshaan: { foot: 0.45, roll: 0.35, mesa: 0.2, steps: 0.6 },
  // Cyrodiil, after KPbICA's reference map of the province: the Jerall north, the Colovian Highlands west, the Great
  // Forest, the Heartlands about Lake Rumare, the West Weald, the Gold Coast, the Nibenay, Blackwood
  cyrodiilNibenayValley: { roll: 0.75, foot: 0.25, steps: 0.7 },
  cyrodiilNibenay: { roll: 0.45, karst: 0.35, foot: 0.2 },
  cyrodiilBlackwood: { marsh: 0.55, roll: 0.45 },
  cyrodiilColovia: { foot: 0.4, roll: 0.25, mesa: 0.2, karst: 0.15, steps: 1 },
  cyrodiilGoldCoast: { roll: 0.6, foot: 0.4, steps: 0.8 },
  cyrodiilJerall: { ridge: 0.55, foot: 0.45, north: 0.4 },
});
/** A climate's palette, for a zone ZONE_LANDS does not name (and the land past the Bay with no zones). */
export const CLIMATE_LANDS = Object.freeze({
  [C.Mountain]: { ridge: 0.85, foot: 0.15 },
  [C.MountainWoods]: { foot: 0.6, roll: 0.25, ridge: 0.15 },
  [C.Woodlands]: { roll: 0.8, foot: 0.2, steps: 0.4 },
  [C.Desert]: { dune: 0.7, mesa: 0.3, dry: 1 },
  [C.Desert2]: { mesa: 0.7, dune: 0.3, dry: 1, steps: 1 },
  [C.Rainforest]: { karst: 0.5, roll: 0.5 },
  [C.Subtropical]: { roll: 0.75, karst: 0.25, steps: 0.4 },
  [C.Swamp]: { marsh: 1 },
  [C.HauntedWoodlands]: { broken: 0.7, roll: 0.3 },
  [C.Ocean]: { roll: 1 },
});

/** A palette as a vector over FAMILIES plus its three tilts (dry, north, steps) - made once a key. */
const PALETTE_SIZE = NF + 3;
const _palettes = new Map();
function paletteOf(key, spec) {
  let v = _palettes.get(key);
  if (v) return v;
  v = new Float64Array(PALETTE_SIZE);
  let sum = 0;
  for (let i = 0; i < NF; i++) sum += v[i] = spec?.[FAMILIES[i]] ?? 0;
  if (!(sum > 0)) {
    v[F.roll] = 1;
    sum = 1;
  }
  for (let i = 0; i < NF; i++) v[i] /= sum;
  v[NF] = spec?.dry ?? 0;
  v[NF + 1] = spec?.north ?? 0;
  v[NF + 2] = spec?.steps ?? 0.3;
  _palettes.set(key, v);
  return v;
}
/** The palette a zone (or none, and its climate) wears. @param {?{key: string, climate: number}} zone @param {number} climate */
export function zonePalette(zone, climate) {
  if (zone && ZONE_LANDS[zone.key]) return paletteOf(zone.key, ZONE_LANDS[zone.key]);
  const c = zone ? zone.climate : climate;
  return paletteOf(`c${c}`, CLIMATE_LANDS[c] ?? CLIMATE_LANDS[C.Woodlands]);
}

// ── THE ORIENTED FRAMES ───────────────────────────────────────────
/** ORIENT fixed frames, every 180 / ORIENT degrees; each frame's cosine and sine of its angle, and of twice it (the
 *  direction's doubled angle, so a slope and its opposite read the same frame) - square roots, exact in every engine. */
const ORIENT = 6;
const R3 = Math.sqrt(3) / 2;
export const FRAME_C = Object.freeze([1, R3, 0.5, 0, -0.5, -R3]); // PEAKS2: exported - the massif's spurs read the same frames (world/peaks/massif.js)
export const FRAME_S = Object.freeze([0, 0.5, R3, 1, R3, 0.5]);
const FRAME_C2 = Object.freeze([1, 0.5, -0.5, -1, -0.5, 0.5]);
const FRAME_S2 = Object.freeze([0, R3, R3, 0, -R3, -R3]);
/** Each frame's own offset into the noise, so no two frames read one field. */
/** The weaker frame's share of a pair under which it is not read (orient). */
const FRAME_QUIET = 0.12;
export const FRAME_OFF = Object.freeze([
  [17.1, 3.9],
  [41.3, 77.2],
  [5.6, 29.4],
  [63.8, 12.7],
  [88.4, 54.1],
  [26.9, 95.3],
]);

/** THE TWO FRAMES NEAREST a direction (its doubled angle's cosine and sine, `c2`, `s2`, unit), and their weights - written
 *  into `out` as [k0, w0, k1, w1]: the frames 30 degrees apart; a direction on a frame is that frame's alone. */
export function orient(c2, s2, out) {
  let best = 0,
    bd = -2;
  for (let k = 0; k < ORIENT; k++) {
    const d = c2 * FRAME_C2[k] + s2 * FRAME_S2[k];
    if (d > bd) {
      bd = d;
      best = k;
    }
  }
  const prev = (best + ORIENT - 1) % ORIENT,
    next = (best + 1) % ORIENT;
  const dp = c2 * FRAME_C2[prev] + s2 * FRAME_S2[prev],
    dn = c2 * FRAME_C2[next] + s2 * FRAME_S2[next];
  const other = dp > dn ? prev : next,
    od = dp > dn ? dp : dn;
  // the doubled angles of neighbouring frames lie 60 degrees apart: a direction on its frame reads it at 1 and the
  // next at 0.5; half-way, both at cos 30
  const a = smooth01((bd - 0.5) / 0.5),
    b = smooth01((od - 0.5) / 0.5);
  const s = a + b > 0 ? a + b : 1;
  // the weaker frame fades out under FRAME_QUIET of the pair (its share rescaled from nothing there - no step), so a
  // sample well on a frame reads that frame's field alone
  const wb = b / s,
    q = wb > FRAME_QUIET ? ((wb - FRAME_QUIET) / (0.5 - FRAME_QUIET)) * 0.5 : 0;
  out[0] = best;
  out[1] = 1 - q;
  out[2] = other;
  out[3] = q;
  return out;
}

// ── THE SHAPES (each about -1..1, centred) ────────────────────────
/** Rolling hills: three octaves. */
function rolling(wx, wy) {
  return (
    (signed(wx / 210 + 11.3, wy / 210 + 47.9) +
      0.4 * signed(wx / 84 + 83.1, wy / 84 + 5.7) +
      0.12 * signed(wx / 33 + 29.5, wy / 33 + 71.3)) /
    1.52
  );
}

/** A ridged octave: 1 at the noise's zero line, falling away squared - a crest. */
const crest = (n, k) => {
  const a = 1 - (n < 0 ? -n : n);
  return a * a * (k ? a : 1);
};

/** |x| with its crease rounded over `k` (world/landforms.js's own softAbs - a crest sharp only where it is meant to be). */
const softAbs = (x, k) => Math.sqrt(x * x + k * k) - k;
/** RIDGES AND VALLEYS in frame `k`: a ridged multifractal `stretch` times longer along the frame's axis (the downhill
 *  direction) than across it - a crest every `across`, spurs off its flanks (the finer octaves riding the coarser's high
 *  ground, so the valleys stay smooth and the ridges branch), rock on the spurs. `round` (foothills): every octave a
 *  smooth swell (1 - n^2), no crest at all. About 0..1.6. */
function ridgeIn(k, wx, wy, across, stretch, round) {
  const c = FRAME_C[k],
    s = FRAME_S[k],
    [ox, oy] = FRAME_OFF[k];
  const u = (wx * c + wy * s) / stretch,
    v = wy * c - wx * s;
  const n1 = signed(u / across + ox, v / across + oy),
    n2 = signed(u / (across * 0.45) + oy, v / (across * 0.45) + ox);
  if (round) return 1 - n1 * n1 + 0.4 * (1 - n1 * n1) * (1 - n2 * n2);
  const a1 = 1 - softAbs(n1, 0.05),
    a = a1 * a1,
    b1 = 1 - softAbs(n2, 0.08),
    b = b1 * b1;
  const n3 = signed(wx / (across * 0.19) + ox * 1.3, wy / (across * 0.19) + oy * 0.7),
    c3 = 1 - softAbs(n3, 0.1);
  return a + 0.5 * a * b + 0.22 * a * b * c3 * c3;
}
/** Drumlins in frame `k`: whalebacks along the ice's flow (the frame's axis) - one to a cell, `cell` long, a third as
 *  broad, each its own place and height; a moraine's low ridge across the flow; kettle holes. About 0..1. */
function drumIn(k, wx, wy, cell) {
  const c = FRAME_C[k],
    s = FRAME_S[k],
    [ox, oy] = FRAME_OFF[k];
  const u = wx * c + wy * s,
    v = wy * c - wx * s;
  const cu = cell,
    cv = cell * 0.42;
  const fu = u / cu,
    fv = v / cv,
    iu = Math.floor(fu),
    iv = Math.floor(fv);
  let best = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const hu = iu + i,
        hv = iv + j;
      if (cellHash(hu, hv, k * 7 + 1) > 0.72) continue;
      const mu = (hu + 0.2 + 0.6 * cellHash(hu, hv, k * 7 + 2)) * cu,
        mv = (hv + 0.25 + 0.5 * cellHash(hu, hv, k * 7 + 3)) * cv;
      const ru = cu * (0.32 + 0.22 * cellHash(hu, hv, k * 7 + 4)),
        rv = ru * 0.34;
      const du = (u - mu) / ru,
        dv = (v - mv) / rv,
        q = du * du + dv * dv;
      if (!(q < 1)) continue;
      const t = 1 - q,
        h = t * t * (0.55 + 0.45 * cellHash(hu, hv, k * 7 + 5));
      if (h > best) best = h;
    }
  }
  const moraine = crest(signed(v / 520 + ox, u / 1900 + oy), false) * 0.35;
  const kettle = signed(wx / 46 + oy, wy / 46 + ox);
  return best + moraine * moraine - (kettle > 0.55 ? (kettle - 0.55) * 1.6 : 0);
}
/** Gullies in frame `k`: narrow cuts down the slope (the axis), round-floored - 0 on the land, -1 at a gully's floor. */
function gullyIn(k, wx, wy, across, stretch) {
  const c = FRAME_C[k],
    s = FRAME_S[k],
    [ox, oy] = FRAME_OFF[k];
  const u = (wx * c + wy * s) / stretch,
    v = wy * c - wx * s;
  const n =
    signed(u / across + oy + 3.3, v / across + ox + 7.7) +
    0.35 * signed(u / (across * 0.5) + 1.1, v / (across * 0.5) + 9.4);
  const q = n / 0.15,
    a = 1 - q * q; // a rounded floor, never a crease (a V's creases met in stars)
  return a > 0 ? -a * a : 0;
}

/** A cell's own numbers, 0..1 (world-placed: one number from every pixel). */
function cellHash(ix, iy, k) {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(k + 0x3c1, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Knobs one to a cell of `cell` samples (a `fill` of the cells), each its own place, girth and height; `edge` how much of
 *  its radius its side takes (small: a tower, a tor); `flat` cuts its top flat (a butte); `rough` frays its outline and
 *  its top (a tor's jointed rock, never a disc). 0..1. */
function knobs(wx, wy, cell, fill, edge, salt, flat = 0, rough = 0) {
  const fx = wx / cell,
    fy = wy / cell,
    cx = Math.floor(fx),
    cy = Math.floor(fy);
  // a knob's centre lies 0.2..0.8 into its cell and its reach is at most 0.38 of a cell (frayed, 1 + rough times that):
  // a neighbouring cell is asked only from the near side of this one
  const reach = 0.38 * (1 + rough) - 0.2,
    i0 = fx - cx < reach ? -1 : 0,
    i1 = fx - cx > 1 - reach ? 1 : 0,
    j0 = fy - cy < reach ? -1 : 0,
    j1 = fy - cy > 1 - reach ? 1 : 0;
  let best = 0;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const ix = cx + i,
        iy = cy + j;
      if (cellHash(ix, iy, salt) >= fill) continue;
      const kx = (ix + 0.2 + 0.6 * cellHash(ix, iy, salt + 1)) * cell,
        ky = (iy + 0.2 + 0.6 * cellHash(ix, iy, salt + 2)) * cell;
      const r = cell * (0.16 + 0.22 * cellHash(ix, iy, salt + 3));
      const dx = wx - kx,
        dy = wy - ky,
        d2 = dx * dx + dy * dy,
        rr = r * (1 + rough);
      if (!(d2 < rr * rr)) continue;
      let q = Math.sqrt(d2) / r;
      if (rough > 0) q *= 1 - rough * signed(wx / (r * 0.45) + ix * 0.71, wy / (r * 0.45) + iy * 0.37);
      if (!(q < 1)) continue;
      let v = smooth01((1 - q) / edge) * (0.5 + 0.5 * cellHash(ix, iy, salt + 4));
      if (rough > 0) v *= 0.8 + 0.2 * signed(wx / (r * 0.2) + 5.1, wy / (r * 0.2) + 9.3);
      if (flat > 0 && v > flat) v = flat + (v - flat) * 0.15;
      if (v > best) best = v;
    }
  }
  return best;
}

/** Mesas and buttes: two flat-topped tiers where a field crosses its levels, and lone buttes on the plain. 0..1. */
function mesas(wx, wy) {
  const n = 0.8 * signed(wx / 230 + 27.3, wy / 230 + 81.1) + 0.2 * signed(wx / 83 + 5.9, wy / 83 + 33.3);
  const tiers = 0.6 * smooth01((n - 0.06) / 0.14) + 0.4 * smooth01((n - 0.3) / 0.12);
  const butte = knobs(wx, wy, 150, 0.35, 0.3, 211, 0.55);
  return tiers > butte ? tiers : butte;
}
/** Dunes across a wind a little south of west: a long windward rise, a short slip face, crests that wander and fork, and
 *  bare pans between trains; draa (the great dunes) under them. 0..1. */
const DUNE_C = 0.9393727128473789,
  DUNE_S = 0.34289780745545134; // the wind's cosine and sine (0.35 rad), written out
function dunes(wx, wy, L) {
  const u = wx * DUNE_C + wy * DUNE_S,
    v = wy * DUNE_C - wx * DUNE_S;
  const phase =
    u / L +
    0.8 * signed(v / (L * 3.1) + 13.7, u / (L * 6.3) + 2.9) +
    0.35 * signed(wx / (L * 1.7) + 37.1, wy / (L * 1.7) + 8.3);
  const f = phase - Math.floor(phase);
  const p = f < 0.72 ? smooth01(f / 0.72) : 1 - smooth01((f - 0.72) / 0.28);
  const draa = 0.5 + 0.5 * signed(u / (L * 7) + 61.1, v / (L * 4) + 3.9);
  return p * smooth01(0.55 + 1.3 * signed(v / (L * 5) + 71.9, u / (L * 5) + 44.1)) * 0.7 + 0.3 * draa;
}
/** KARST: cones packed one to a cell of `cell` samples (most cells hold one), broad enough to meet their neighbours - the
 *  taller where two meet, so the hollows between are closed (cockpits) - and a sinkhole in some hollows. 0..1. */
function cones(wx, wy, cell) {
  const fx = wx / cell,
    fy = wy / cell,
    cx = Math.floor(fx),
    cy = Math.floor(fy);
  let best = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const ix = cx + i,
        iy = cy + j;
      if (cellHash(ix, iy, 401) >= 0.85) continue;
      const kx = (ix + 0.2 + 0.6 * cellHash(ix, iy, 402)) * cell,
        ky = (iy + 0.2 + 0.6 * cellHash(ix, iy, 403)) * cell;
      const r = cell * (0.4 + 0.3 * cellHash(ix, iy, 404)),
        dx = wx - kx,
        dy = wy - ky,
        d2 = dx * dx + dy * dy;
      if (!(d2 < r * r)) continue;
      const t = 1 - Math.sqrt(d2) / r,
        v = (0.45 + 0.55 * cellHash(ix, iy, 405)) * t * (0.6 + 0.4 * t);
      if (v > best) best = v;
    }
  }
  return best;
}
/** A marsh: broad shallow hollows and hummocks. */
function marsh(wx, wy) {
  return (
    0.55 * signed(wx / 380 + 12.1, wy / 380 + 70.3) +
    0.3 * signed(wx / 95 + 93.9, wy / 95 + 41.5) +
    0.15 * signed(wx / 34 + 2.7, wy / 34 + 61.9)
  );
}
/** Broken ground: a roll gashed by ravines and studded with crags. */
function broken(wx, wy) {
  const cut =
    1 - Math.abs(0.75 * signed(wx / 240 + 45.1, wy / 240 + 9.7) + 0.25 * signed(wx / 90 + 77.7, wy / 90 + 58.3)) / 0.33;
  const ravine = cut > 0 ? cut * cut * cut : 0;
  const crag = signed(wx / 60 + 31.3, wy / 60 + 12.9);
  return rolling(wx, wy) - 0.8 * ravine + 0.35 * (crag > 0.2 ? (crag - 0.2) * (crag - 0.2) * 3 : 0);
}

/** TERRACES AND ESCARPMENTS: the land stepped across its own contours - `h` (kernel units) to the next step of `step`, a
 *  tread nearly flat and a riser `riser` of the step wide, wobbled by `wob` - and answered as the offset from `h`, centred
 *  (a step's mean is the land's). */
function terrace(h, step, riser, wob) {
  const x = h / step + wob,
    f = x - Math.floor(x);
  return (smooth01((f - 0.5 + riser / 2) / riser) - f) * step;
}

// ── THE SLOW FIELDS, ON A LATTICE ────────────────────────────────
/** Node spacing, samples (the hills' own - world/landforms.js HILL_NODE). */
export const NODE = 16;
/** A node's values: the mix (NF), the accents (terrace, gully, outcrop), the step, the frame's direction (doubled angle,
 *  c2, s2), the warp (two), the region, the land's height there, the variety. */
const V_ACC = NF,
  V_STEP = NF + 3,
  V_C2 = NF + 4,
  V_S2 = NF + 5,
  V_WX = NF + 6,
  V_WY = NF + 7,
  V_REG = NF + 8,
  V_UP = NF + 9;
const NV = NF + 10;

/**
 * THE GROUND THE LANDFORMS READ: the macro height (kernel units, the bytes' with the lift - `height(x, y)` at Bay pixel
 * (x, y)'s own node, world/landforms.js nodeGround) and the zone (`zoneAt(x, y)`: tamrielBiomes.js tamrielBiomeAt's,
 * and its climate) - the caller's, so this module reads no reader of its own.
 * @typedef {{ height: (x: number, y: number) => number, zoneAt: (x: number, y: number) => ?{key: string, climate: number}, climateAt: (x: number, y: number) => number, mapH: number, knee: number }} LandformGround
 */

/** A byte node's place: the kernel stands pixel (X, Y)'s byte at world sample ((X + 1) * span, (mapH - Y) * span)
 *  (terrainSampler.js kernelTerms: a pixel's samples run from its west neighbour's byte to its own, and from its own row's
 *  to the row north of it). So a world sample (gx, gy) lies between byte nodes X = gx / span - 1 and Y = mapH - gy / span. */
function macroAt(G, gx, gy, span, out) {
  const fx = gx / span - 1,
    fy = G.mapH - gy / span;
  const X = Math.floor(fx),
    Y = Math.floor(fy),
    tx = fx - X,
    ty = fy - Y;
  // the macro at the four nodes, and its gradient there by central differences (smooth across the cells)
  let h = 0,
    gxs = 0,
    gys = 0;
  for (let j = 0; j <= 1; j++) {
    for (let i = 0; i <= 1; i++) {
      const w = (i ? tx : 1 - tx) * (j ? ty : 1 - ty);
      if (!(w > 0)) continue;
      const x = X + i,
        y = Y + j;
      h += w * G.height(x, y);
      gxs += (w * (G.height(x + 1, y) - G.height(x - 1, y))) / 2;
      gys += (w * (G.height(x, y - 1) - G.height(x, y + 1))) / 2; // north is -Y
    }
  }
  out[0] = h;
  out[1] = gxs / span;
  out[2] = gys / span; // kernel units, and units a sample (east, north)
  return out;
}

/** RELIEF-PEAKS: STRUCTURE_REACH - how far (map pixels) about a node the land's structure is summed: its tent's half-width. */
export const STRUCTURE_REACH = 2;
/** RELIEF-PEAKS: THE LAND'S STRUCTURE about a world sample - its byte nodes' central differences, each one's doubled angle
 *  weighted by its gradient's square and a tent of STRUCTURE_REACH pixels (the structure tensor's own law: a ridge's two
 *  flanks fall opposite ways along one line, and read as one), into `out` as the doubled angle at its coherence: [cos,
 *  sin] of length 1 where the land falls one way, 0 where it falls every way - a summit, a saddle, a bowl. */
function structureAt(G, gx, gy, span, out) {
  const fx = gx / span - 1,
    fy = G.mapH - gy / span,
    X = Math.floor(fx),
    Y = Math.floor(fy),
    R = STRUCTURE_REACH;
  let xx = 0,
    yy = 0,
    xy = 0;
  for (let j = 1 - R; j <= R; j++) {
    const wy = 1 - Math.abs(Y + j - fy) / R;
    if (!(wy > 0)) continue;
    for (let i = 1 - R; i <= R; i++) {
      const w = (1 - Math.abs(X + i - fx) / R) * wy;
      if (!(w > 0)) continue;
      const x = X + i,
        y = Y + j,
        ex = (G.height(x + 1, y) - G.height(x - 1, y)) / 2,
        ny = (G.height(x, y - 1) - G.height(x, y + 1)) / 2; // north is -Y
      xx += w * ex * ex;
      yy += w * ny * ny;
      xy += w * ex * ny;
    }
  }
  const e = xx + yy;
  out[0] = e > 1e-9 ? (xx - yy) / e : 0;
  out[1] = e > 1e-9 ? (2 * xy) / e : 0;
  return out;
}
/** RELIEF-PEAKS: the direction's strength (the slow fields' [cos, sin] length) from which the oriented families stand in
 *  their two frames whole; under it they ease into the fixed frame (frame 0), which none of the land's turns can turn. */
export const ORIENT_FULL = 0.5;

const _m = new Float64Array(3),
  _o = new Float64Array(4),
  _pal = new Float64Array(PALETTE_SIZE),
  _st = new Float64Array(2);
/** One node's slow fields into `vals` at `o` - the palettes of the 2x2 pixels about it blended (smoothstep, as the
 *  climates' shares are), the macro's height and slope, and the selector. Pure in its world position. */
function landformNode(G, nx, ny, span, vals, o) {
  const D = TAMRIEL_LANDFORM_DIALS;
  const gx = nx * NODE,
    gy = ny * NODE;
  // the palette: pixel centres at whole numbers (landShares' frame)
  const fx = gx / span - 0.5,
    fy = G.mapH + 0.5 - gy / span,
    ix = Math.floor(fx),
    iy = Math.floor(fy);
  const u = smooth01(fx - ix),
    v = smooth01(fy - iy);
  _pal.fill(0);
  for (let j = 0; j <= 1; j++)
    for (let i = 0; i <= 1; i++) {
      const w = (i ? u : 1 - u) * (j ? v : 1 - v);
      if (!(w > 0)) continue;
      const p = zonePalette(G.zoneAt(ix + i, iy + j), G.climateAt(ix + i, iy + j));
      for (let k = 0; k < PALETTE_SIZE; k++) _pal[k] += w * p[k];
    }
  macroAt(G, gx, gy, span, _m);
  const e = _m[0] - G.knee; // the land over the knee
  const grade = Math.sqrt(_m[1] * _m[1] + _m[2] * _m[2]) * (1.25 / 6.4); // rise over run, metres
  const up = smooth01(e / D.upland); // the upland: 0 on the plain, 1 high
  const flank = smooth01((grade - D.flank * 0.5) / D.flank); // a flank: a range's side
  const variety = signed(gx / D.variety + 3.7, gy / D.variety + 91.3);
  const region = smooth01((perlinNoise(gx / D.region + 31.7, gy / D.region + 57.3) - 0.28) / 0.44);
  const dry = _pal[NF],
    north = _pal[NF + 1],
    steps = _pal[NF + 2];
  // THE MIX: the zone's palette, then the land's own say - a steep high flank is ridges and valleys whatever the zone (but
  // a marsh); a flank lower down foothills; the north's low ground the ice's drumlins; the variety trading a zone's shapes
  for (let k = 0; k < NF; k++) vals[o + k] = _pal[k];
  const wet = vals[o + F.marsh];
  const rugged = flank * up * (1 - wet);
  vals[o + F.ridge] += 0.9 * rugged;
  vals[o + F.foot] += 0.5 * flank * (1 - up) * (1 - wet);
  vals[o + F.drum] += north * (1 - up) * (1 - flank) * smooth01(0.5 + variety);
  vals[o + F.dune] *= 1 - flank; // dunes keep to the flats
  vals[o + F.mesa] += dry * 0.4 * smooth01(variety * 2); // a dune sea gives way to mesas where the variety rises
  vals[o + F.karst] *= 1.4 * smooth01((variety + 0.1) / 0.4); // karst in patches, rolling country between
  vals[o + F.roll] *= 0.7 + 0.6 * smooth01(0.5 - variety);
  let sum = 0;
  for (let k = 0; k < NF; k++) sum += vals[o + k];
  for (let k = 0; k < NF; k++) vals[o + k] /= sum;
  // THE ACCENTS: terraces where a steady slope or a flat height steps (a plateau's rim), more where the zone steps;
  // gullies down a flank, badlands where it is dry; outcrops on the uplands and the ridges
  const plateau = up * (1 - flank) * smooth01((variety + 0.2) / 0.5);
  const slope = smooth01((grade - 0.015) / 0.03) * (1 - smooth01((grade - 0.09) / 0.06)); // a steady slope steps; a steep one does not
  vals[o + V_ACC] = steps * (0.45 * slope * smooth01((0.2 - variety) / 0.5) + 0.8 * plateau) * (1 - wet);
  vals[o + V_ACC + 1] = flank * (0.35 + 0.65 * dry) * smooth01((0.45 - variety) / 0.5) * (1 - wet);
  vals[o + V_ACC + 2] = (0.35 * up + 0.5 * rugged) * (1 - wet) * smooth01((variety + 0.6) / 0.6);
  vals[o + V_STEP] = D.terrace.low + (D.terrace.high - D.terrace.low) * (0.4 * region + 0.6 * plateau);
  // the frames' direction: the macro slope's (its doubled angle), a slow field's where the land lies flat. RELIEF-PEAKS: the
  // slope's is the land's STRUCTURE about the node (structureAt: its gradients' doubled angles summed over two map pixels
  // either way), at its coherence, and the sum is left at its own length - the direction's strength, which
  // tamrielLandformAt fades the frames by. A unit direction at every node turned through a half turn between two nodes
  // where they disagreed (a summit, a saddle, the slow field's own turn), and the frames handed one field to another
  // inside a sample: walls of 80 to 116 m, 85 degrees, 4.8% of the Jerall about Bruma over 37 degrees
  const fc = signed(gx / 5200 + 7.7, gy / 5200 + 1.9),
    fs = signed(gx / 5200 + 41.1, gy / 5200 + 63.5);
  const a = smooth01(grade / 0.02);
  structureAt(G, gx, gy, span, _st);
  vals[o + V_C2] = _st[0] * a + fc * (1 - a);
  vals[o + V_S2] = _st[1] * a + fs * (1 - a);
  vals[o + V_WX] = D.warp * signed(gx / D.warpScale + 5.2, gy / D.warpScale + 1.3);
  vals[o + V_WY] = D.warp * signed(gx / D.warpScale + 9.7, gy / D.warpScale + 3.1);
  vals[o + V_REG] = region;
  vals[o + V_UP] = up;
}

/**
 * THE LATTICE over a box of world samples (a pixel's: made once, as the hills' are) - every node landformNode's, so a box
 * changes no number. @param {LandformGround} G
 */
export function landformLattice(G, x0, y0, size, span) {
  // a node's margin each side beyond the box's own: the read below is Catmull-Rom's, four nodes a way
  const nx0 = Math.floor(x0 / NODE) - 1,
    ny0 = Math.floor(y0 / NODE) - 1,
    side = Math.ceil(size / NODE) + 4;
  // LAZY: a node is made the first time a read needs it (a pixel's ghost rows - the kernel's neighbours, read along one
  // edge - make a row of them, never the whole box)
  const vals = new Float64Array(side * side * NV),
    made = new Uint8Array(side * side);
  const L = { nx0, ny0, side, vals, made, G, span, fine: /** @type {any} */ (null) };
  // THE FINE TABLE: the lattice's read every FINE samples over the box (world-placed - every pixel's origin is on it, so a
  // shared edge reads the same entries from both pixels), a sample reading its four bilinearly: the C1 read's cost once
  // a sixteenth of the samples, its steps (FINE samples apart) under a hill-shade's eye
  const fx0 = Math.floor(x0 / FINE),
    fy0 = Math.floor(y0 / FINE),
    fside = Math.ceil(size / FINE) + 2;
  L.fine = { fx0, fy0, side: fside, vals: new Float64Array(fside * fside * NV), made: new Uint8Array(fside * fside) };
  return L;
}
/** The fine table's spacing, samples. */
const FINE = 4;

const _at = new Float64Array(NV),
  _scratch = new Float64Array(16 * NV),
  _wx = new Float64Array(4),
  _wy = new Float64Array(4);
/** A family's or an accent's weight under this is not asked; over it, it counts from nothing (so the threshold is no step). */
const QUIET = 0.07;
/** Catmull-Rom's four weights at `t` into `w`. */
function crWeights(t, w) {
  const t2 = t * t,
    t3 = t2 * t;
  w[0] = 0.5 * (-t3 + 2 * t2 - t);
  w[1] = 0.5 * (3 * t3 - 5 * t2 + 2);
  w[2] = 0.5 * (-3 * t3 + 4 * t2 + t);
  w[3] = 0.5 * (t3 - t2);
}
/** The slow fields at a world sample: the fine table's four about it, bilinear - the table's own where the sample is on
 *  it, made there and then where it is not (a ghost row a pixel's kernel reads past its box), so a sample's number is one
 *  function of its world position whichever pixel asks. */
const _f4 = new Float64Array(NV),
  _off = new Float64Array(4 * NV);
function fieldsAt(L, gx, gy) {
  const T = L.fine;
  const fx = gx / FINE,
    fy = gy / FINE,
    ix = Math.floor(fx),
    iy = Math.floor(fy),
    li = ix - T.fx0,
    lj = iy - T.fy0;
  const u = fx - ix,
    v = fy - iy,
    a = (1 - u) * (1 - v),
    b = u * (1 - v),
    c = (1 - u) * v,
    d = u * v;
  let V, i00, i10, i01, i11;
  if (li >= 0 && lj >= 0 && li + 1 < T.side && lj + 1 < T.side) {
    V = T.vals;
    const e00 = lj * T.side + li;
    i00 = e00 * NV;
    i10 = i00 + NV;
    i01 = i00 + T.side * NV;
    i11 = i01 + NV;
    for (let q = 0; q < 4; q++) {
      // the table's four entries, each made the first time it is read
      const e = e00 + (q & 1) + (q >> 1) * T.side;
      if (!T.made[e]) {
        T.made[e] = 1;
        V.set(smoothAt(L, (T.fx0 + (e % T.side)) * FINE, (T.fy0 + ((e / T.side) | 0)) * FINE), e * NV);
      }
    }
  } else {
    V = _off;
    i00 = 0;
    i10 = NV;
    i01 = 2 * NV;
    i11 = 3 * NV;
    for (let q = 0; q < 4; q++) V.set(smoothAt(L, (ix + (q & 1)) * FINE, (iy + (q >> 1)) * FINE), q * NV);
  }
  for (let k = 0; k < NV; k++) _f4[k] = V[i00 + k] * a + V[i10 + k] * b + V[i01 + k] * c + V[i11 + k] * d;
  return _f4;
}
/** The slow fields at a world point, Catmull-Rom between the lattice's nodes (C1: a bilinear read's gradient stepped at
 *  every node line, and the hill-shade stood the lattice's cells as tiles); a node off the lattice made where asked. */
function smoothAt(L, gx, gy) {
  const fx = gx / NODE,
    fy = gy / NODE,
    ix = Math.floor(fx),
    iy = Math.floor(fy);
  crWeights(fx - ix, _wx);
  crWeights(fy - iy, _wy);
  const li = ix - 1 - L.nx0,
    lj = iy - 1 - L.ny0;
  const inside = li >= 0 && lj >= 0 && li + 3 < L.side && lj + 3 < L.side;
  _at.fill(0);
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 4; i++) {
      const w = _wx[i] * _wy[j];
      let vals = L.vals,
        o;
      if (inside) {
        const n = (lj + j) * L.side + li + i;
        o = n * NV;
        if (!L.made[n]) {
          L.made[n] = 1;
          landformNode(L.G, L.nx0 + li + i, L.ny0 + lj + j, L.span, vals, o);
        }
      } else {
        vals = _scratch;
        o = 0;
        landformNode(L.G, ix - 1 + i, iy - 1 + j, L.span, vals, 0);
      }
      for (let k = 0; k < NV; k++) _at[k] += vals[o + k] * w;
    }
  }
  return _at;
}

/** Each shape's CENTRE and GAIN: its mean over its own field (measured over 200,000 world points, every frame - the
 *  record's measure, test/world/breathtaker.test.js holds each mean within 0.02 of it), so the mix stands on the land's own
 *  mean and the heightmap's macro is kept; its gain a spread of SPREAD (a family's height its amplitude times about that,
 *  its extremes about one), so the families' amplitudes compare. */
const SPREAD = 0.55;
const CENTRE = Object.freeze({
  ridge: 1.07,
  foot: 1.283,
  mesa: 0.213,
  dune: 0.34,
  drum: 0.148,
  karst: 0.152,
  outcrop: 0.019,
  gully: -0.236,
  rolling: 0.005,
  marsh: -0.004,
  broken: -0.23,
});
const GAIN = Object.freeze({
  ridge: SPREAD / 0.349,
  foot: SPREAD / 0.119,
  mesa: SPREAD / 0.299,
  dune: SPREAD / 0.196,
  drum: SPREAD / 0.189,
  karst: SPREAD / 0.182,
  rolling: SPREAD / 0.18,
  marsh: SPREAD / 0.164,
  broken: SPREAD / 0.304,
});

/**
 * THE LANDFORMS at a world sample (x east, y north, samples), kernel units over (or under) the land: the mix and its
 * accents, centred, eased in over the land's height above the knee as the hills are (a hill never taller than the land
 * under it - world/landforms.js hillsAt), `macro` the land's macro height there (kernel units). `out[0]`, when given,
 * takes the deepest dale the landforms can cut there (the rivers' valley carve, world/tamriel/tamrielWaters.js).
 * @param {ReturnType<typeof landformLattice>} L
 * @param {number} gx @param {number} gy @param {number} macro
 * @param {?Float64Array} [out]
 */
export function tamrielLandformAt(L, gx, gy, macro, out = null) {
  const D = TAMRIEL_LANDFORM_DIALS,
    e = macro - L.G.knee;
  if (out) out[0] = 0;
  if (!(e > 0)) return 0;
  const f = fieldsAt(L, gx, gy);
  const region = f[V_REG],
    up = f[V_UP];
  const wx = gx + f[V_WX],
    wy = gy + f[V_WY];
  // the direction between the nodes, made a unit again: two nodes that disagree average short, and every frame read it
  // as none (the oriented families dropped out cell by cell). RELIEF-PEAKS: its length is its strength (landformNode) -
  // the frames stand whole from ORIENT_FULL and ease into the fixed frame under it, so where the direction turns fast (it
  // is short there) no family hands one field to another inside a sample
  let c2 = f[V_C2],
    s2 = f[V_S2];
  const dl = Math.sqrt(c2 * c2 + s2 * s2),
    strong = smooth01(dl / ORIENT_FULL);
  if (dl > 1e-6) {
    c2 /= dl;
    s2 /= dl;
  } else {
    c2 = 1;
    s2 = 0;
  }
  const o = orient(c2, s2, _o),
    k0 = o[0],
    k1 = o[2];
  let w0 = o[1] * strong,
    w1 = o[3] * strong,
    w2 = 1 - strong; // w2: the fixed frame's (frame 0)
  if (k0 === 0) {
    w0 += w2;
    w2 = 0;
  } else if (k1 === 0) {
    w1 += w2;
    w2 = 0;
  }
  let sum = 0,
    top = 0;
  for (let k = 0; k < NF; k++) {
    const w = f[k] - QUIET; // a family under QUIET is not asked - and fades to nothing at it, never steps
    if (!(w > 0)) continue;
    let s, a;
    switch (k) {
      case F.roll:
        s = (rolling(wx, wy) - CENTRE.rolling) * GAIN.rolling;
        a = (D.roll.low + (D.roll.high - D.roll.low) * region) * (1 + 0.5 * up);
        break;
      case F.ridge: {
        const r =
          (w0 > 0 ? w0 * ridgeIn(k0, wx, wy, D.ridge.across, D.ridge.stretch, false) : 0) +
          (w1 > 0 ? w1 * ridgeIn(k1, wx, wy, D.ridge.across, D.ridge.stretch, false) : 0) +
          (w2 > 0 ? w2 * ridgeIn(0, wx, wy, D.ridge.across, D.ridge.stretch, false) : 0);
        s = (r - CENTRE.ridge) * GAIN.ridge;
        a = (D.ridge.low + (D.ridge.high - D.ridge.low) * region) * (0.45 + 0.55 * up);
        break;
      }
      case F.foot: {
        const r =
          (w0 > 0 ? w0 * ridgeIn(k0, wx, wy, D.foot.across, D.foot.stretch, true) : 0) +
          (w1 > 0 ? w1 * ridgeIn(k1, wx, wy, D.foot.across, D.foot.stretch, true) : 0) +
          (w2 > 0 ? w2 * ridgeIn(0, wx, wy, D.foot.across, D.foot.stretch, true) : 0);
        s = (r - CENTRE.foot) * GAIN.foot;
        a = D.foot.low + (D.foot.high - D.foot.low) * region;
        break;
      }
      case F.mesa:
        s = (mesas(wx, wy) - CENTRE.mesa) * GAIN.mesa;
        a = D.mesa.low + (D.mesa.high - D.mesa.low) * region;
        break;
      case F.dune:
        s = (dunes(gx, gy, D.dune.spacing) - CENTRE.dune) * GAIN.dune;
        a = D.dune.low + (D.dune.high - D.dune.low) * region;
        break;
      case F.drum: {
        const r =
          (w0 > 0 ? w0 * drumIn(k0, gx, gy, D.drum.cell) : 0) +
          (w1 > 0 ? w1 * drumIn(k1, gx, gy, D.drum.cell) : 0) +
          (w2 > 0 ? w2 * drumIn(0, gx, gy, D.drum.cell) : 0);
        s = (r - CENTRE.drum) * GAIN.drum;
        a = D.drum.low + (D.drum.high - D.drum.low) * region;
        break;
      }
      case F.karst:
        s =
          (cones(wx, wy, D.karst.cell) - 0.5 * knobs(wx, wy, D.karst.cell * 0.6, 0.2, 1, 151) - CENTRE.karst) *
          GAIN.karst;
        a = D.karst.low + (D.karst.high - D.karst.low) * region;
        break;
      case F.marsh:
        s = (marsh(wx, wy) - CENTRE.marsh) * GAIN.marsh;
        a = D.marsh.low + (D.marsh.high - D.marsh.low) * region;
        break;
      default:
        s = (broken(wx, wy) - CENTRE.broken) * GAIN.broken;
        a = D.broken.low + (D.broken.high - D.broken.low) * region;
        break;
    }
    sum += w * a * s;
    top += w * a;
  }
  // the accents
  const ta = f[V_ACC] - QUIET,
    ga = f[V_ACC + 1] - QUIET,
    oa = f[V_ACC + 2] - QUIET;
  if (ta > 0) {
    const step = f[V_STEP],
      wob =
        0.6 * signed(gx / D.terrace.warp + 13.1, gy / D.terrace.warp + 7.9) +
        0.15 * signed(gx / 140 + 3.3, gy / 140 + 71.9);
    sum += ta * terrace(macro + sum, step, D.terrace.riser, wob);
    top += (ta * step) / 2;
  }
  if (ga > 0) {
    const g =
      (w0 > 0 ? w0 * gullyIn(k0, wx, wy, D.gully.across, D.gully.stretch) : 0) +
      (w1 > 0 ? w1 * gullyIn(k1, wx, wy, D.gully.across, D.gully.stretch) : 0) +
      (w2 > 0 ? w2 * gullyIn(0, wx, wy, D.gully.across, D.gully.stretch) : 0);
    const a = D.gully.low + (D.gully.high - D.gully.low) * region;
    sum += ga * a * (g - CENTRE.gully);
    top += ga * a;
  }
  if (oa > 0) {
    const a = D.outcrop.low + (D.outcrop.high - D.outcrop.low) * region;
    sum += oa * a * (knobs(gx, gy, D.outcrop.cell, D.outcrop.fill, 0.55, 307, 0, 0.35) - CENTRE.outcrop);
    top += oa * a;
  }
  // the ease over the knee (hillsAt's own law): nothing they touch crosses it
  // the ease is measured by the larger of the amplitudes and the shape's own reach, so the landforms stay under the land's
  // height over the knee wherever they stand (m * smoothstep(e / 1.25m) < e for every m)
  const c = topClip(sum),
    mag = c < 0 ? -c : c;
  let m = top > mag ? top : mag;
  if (m > TAMRIEL_TOP) m = TAMRIEL_TOP;
  const ease = smooth01(e / (1.25 * (m > 1 ? m : 1)));
  if (out) out[0] = m * ease;
  return c * ease;
}

/** The shapes by name, for the pins (test/world/breathtaker.test.js) and the centres' measure - the module's own. */
export const LANDFORM_SHAPES = Object.freeze({
  rolling,
  ridgeIn,
  cones,
  drumIn,
  gullyIn,
  knobs,
  mesas,
  dunes,
  marsh,
  broken,
  terrace,
  orient,
  cellHash,
});
export const LANDFORM_CENTRES = CENTRE;

/** HOW MUCH OF THE LAND IS THE CONTINENT'S at a world sample: 0 on the Bay and in its seam band (SEAM_PX pixels past its
 *  edge - its ground, its climates and its hills the Bay's, to the bit), rising to 1 over `ramp` pixels past that, so
 *  the landforms come in from the Bay's hills across the bytes' own blend. The point's Bay coordinates (pixels, y south):
 *  a pixel (px, py)'s samples span x px..px + 1 and y py + 1 (its south edge, sample y 0) .. py. */
export function continentShare(gx, gy, span, mapH, mapW, seam) {
  const bx = gx / span,
    by = mapH + 1 - gy / span;
  const d = Math.max(0, -bx, bx - mapW, -by, by - mapH); // Chebyshev, continuous, past the rectangle
  return d <= seam ? 0 : smooth01((d - seam) / TAMRIEL_LANDFORM_DIALS.ramp);
}
