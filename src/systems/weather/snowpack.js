// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PRECIP3 (2026-10-19, the owner: "If its snowing in one area and raining in the next, the transition should be seamless
// both in ground texture and everything else. This needs to be accurate and as detailed as possible") - THE SNOW THE
// GROUND KEEPS: the snowpack's water (SWE, millimetres of water) at every place and height, integrated over the world
// weather map's own history (weatherMap.js) in the air of airTemperature.js. Pure in (place, height, minute): the same
// white on every client, offline and online, as the systems that dropped it are. bible/07-Rendering/Biome-Precipitation.md
// is the record.
//
// DFU's ground wears its climate's winter archive for the whole of Winter and never otherwise (TerrainMaterialProvider,
// climateSwaps.js getTerrainGroundArchive): the snow is the calendar's, every lowland white on the 1st of Evening Star and
// green on the 1st of First Seed, whatever fell. Here the ground's snow is what fell and has not melted:
//
//   every SNOWPACK.stepMinutes of the event clock, at each altitude level of a place,
//     the fall    = the heaviest wet band's rate there (weatherMap.js wornAmong's `fall` - each wet word's strongest)
//     its snow    = the fall x the snow share of the air at that height through the step (airTemperature.js snowShareOf)
//     the melt    = the degree-hours over freezing through the step x SNOWPACK.melt, and the rain's own heat through it
//     SWE         = min(capMm, max(0, SWE + snow - melt))
//
// from the year's MIDSUMMER (the warmest day: airTemperature.js COLDEST_DAY + 180), each place's pack at it the snow that
// outlived the year before's summer there (AUDIT PRECIP PACK-3: on the landforms' ranges a pack does - integrated from
// nothing, a spin of the year before, where the air cannot have melted it all). The steps stand on one grid of the event
// clock (multiples of stepMinutes from minute 0), so a place's history is the same whoever integrates it, from wherever,
// whenever.
//
// MONOTONE IN HEIGHT: at one place and step the air only cools with height (LAPSE_C_PER_M), the fall is the same, the
// snow share only rises and the melt only falls - so a step keeps SWE(h) non-decreasing in h, and so does the history.
// A place's whole pack is therefore its SNOWLINE: the heights at which its cover crosses 10, 50 and 90 % (`snowlineOf`),
// and a fragment of ground anywhere reads its cover off its own height against them (render/snowCoverGlsl.js) - snow
// down to the valley after a cold front, a white peak over a green valley in a thaw, the line wandering with the weather.
import { airParamsAt, airGround, airFallInto, seasonAir, spellAt, snowShareOf, dayOfSky, LAPSE_C_PER_M, FALL, COLDEST_DAY, RAIN_ALL_C, WARMEST_HOUR } from './airTemperature.js';
import { systemsSpanWalk, systemsAmong, fallAmong } from './weatherMap.js';
import { skyMinuteOfEvent, eventMinuteOfSky } from '../skyCalendar.js';
import { TERRAIN_SIZE } from '../../world/terrain/terrainSampler.js';
import { MAX_MAP_PIXEL_Y } from '../../formats/mapsFile.js';

/**
 * THE LAW'S NUMBERS. `stepMinutes` the event clock's step (three hours: a front lives twelve to thirty, a storm cell two
 * and a half to seven) - the year-before spin's too, so the pack a year begins with is the one the year before ends with
 * under the one law;
 * `levels` the altitudes a place's pack is kept at (metres above the sea - the lowest are below it, the air there read on
 * down the lapse, so a pack white to the shore still has a snowline to blend across; the highest over the tallest ground
 * the landforms stand, LANDFORM_CEILING's 3,610 m over the sea); `rate` the fall at a band's full intensity (mm of water
 * an hour - AUDIT PRECIP PACK-2: measured against the map's own wet hours, a sixth of all hours in High Rock, so a year
 * falls 800 to 1,300 mm on its lowlands and ranges, as a temperate maritime land does; the guessed 4 / 10 / 2.5 fell
 * three times that, a boreal pack on lowland woods); `melt` the degree-hour factor (4 mm a degree-day: the textbook's open
 * ground) and `rainMelt` the rain's own heat (a millimetre of rain at T degrees melts T x 4.19 / 334 mm - its heat over
 * the ice's latent); `fullMm` the SWE that hides the ground entirely (about ten centimetres of new snow); `capMm` the
 * most a pack holds (two metres of water: the deepest seasonal packs - past it a summit's snow is ice, and white).
 */
export const SNOWPACK = Object.freeze({
  stepMinutes: 180,
  levels: Object.freeze({ from: -600, step: 200, count: 23 }),
  rate: Object.freeze({ rain: 1.3, thunder: 3.3, snow: 0.8 }),
  melt: 4 / 24,
  rainMelt: 4.19 / 334,
  fullMm: 10,
  capMm: 2000,
});
const MINUTES_PER_YEAR = 360 * 1440;
/** The sky's minute in its year the packs begin: midsummer, the warmest day (COLDEST_DAY + half a year). */
export const MIDSUMMER_MINUTE = ((COLDEST_DAY + 180) % 360) * 1440;
/** The altitude of level `k` (m above the sea). */
export const levelAltitude = (k) => SNOWPACK.levels.from + k * SNOWPACK.levels.step;
/** The index of the level over the first level at or above `h`: the levels to it read every crossing under `h` and the
 *  next over it within a level (snowlineOf - AUDIT PRECIP A-4). */
export const levelIndexAbove = (h) => Math.min(SNOWPACK.levels.count - 1, Math.max(0, Math.ceil((h - SNOWPACK.levels.from) / SNOWPACK.levels.step)) + 1);
/** ...and its altitude. */
export const levelAbove = (h) => levelAltitude(levelIndexAbove(h));

/** The cover a pack of `swe` mm gives the ground: 0 bare, 1 hidden - smooth between (thin snow lies in patches; the
 *  shader's own noise breaks it up, render/snowCoverGlsl.js). Pure. */
export function coverOf(swe) {
  const t = Math.max(0, Math.min(1, swe / SNOWPACK.fullMm));
  return t * t * (3 - 2 * t);
}
/** The SWE whose cover is `c` (0 < c < 1): coverOf's inverse. Pure. */
export function sweOfCover(c) {
  // smoothstep's inverse: t = 0.5 - sin(asin(1 - 2c) / 3)
  const t = 0.5 - Math.sin(Math.asin(1 - 2 * c) / 3);
  return t * SNOWPACK.fullMm;
}
const SWE_10 = sweOfCover(0.1), SWE_50 = sweOfCover(0.5), SWE_90 = sweOfCover(0.9);
/** The heights (m above the sea) where a place's cover crosses 10, 50 and 90 % - its SNOWLINE - off its pack at its held
 *  levels (`swe`'s first `n`, SNOWPACK.levels), each between the two levels about it; below the lowest level a crossing
 *  the pack already passed reads a level under it, and one its held levels never reach a level over the highest held.
 *  SnowpackLattice holds a place's levels to the one over the first at or above its highest ground (levelIndexAbove), so
 *  every crossing under that ground, and the next over it within a level, reads as all the levels would read it. AUDIT
 *  PRECIP A-4: every crossing was clamped to a metre over the place's highest ground, so wherever the line's next
 *  crossing stood over the ground its slope was drawn up to the ground's top - a hill's top in the snowline's band read up
 *  to a third more cover than its pack. The field stays finite, and a blend between two places walks the line through
 *  the land between. `out` [h10, h50, h90]. Pure. */
export function snowlineOf(swe, out = [0, 0, 0], n = swe.length) {
  const { from, step, count } = SNOWPACK.levels;
  const m = Math.min(n, count);
  const cross = (target) => {
    if (swe[0] >= target) return from - step;   // white below the lowest level
    for (let k = 1; k < m; k++) {
      if (swe[k] >= target) {
        const a = swe[k - 1], b = swe[k];
        return from + step * (k - 1 + (target - a) / (b - a));
      }
    }
    return from + step * m;   // never this white up to the highest level held: a level over it
  };
  out[0] = cross(SWE_10); out[1] = cross(SWE_50); out[2] = cross(SWE_90);
  return out;
}
/** A place's cover at altitude `h` off its snowline `[h10, h50, h90]` - piecewise linear through (h10, 0.1), (h50, 0.5),
 *  (h90, 0.9), on out to 0 and 1 at a quarter of the neighbouring span past the ends. The shader's own reading
 *  (render/snowCoverGlsl.js snowAtHeight), term for term. Pure. */
export function coverAtHeight(line, h) {
  const [h10, h50, h90] = line;
  const lo = Math.max(1, h50 - h10), hi = Math.max(1, h90 - h50);
  if (h <= h10) return Math.max(0, 0.1 + 0.1 * (h - h10) / (0.25 * lo));
  if (h <= h50) return 0.1 + 0.4 * (h - h10) / lo;
  if (h <= h90) return 0.5 + 0.4 * (h - h50) / hi;
  return Math.min(1, 0.9 + 0.1 * (h - h90) / (0.25 * hi));
}

/** The fall at a place over a step, mm of water an hour: the heaviest of its wet bands (weatherMap.js wornAmong's
 *  `fall` - each wet word's strongest band there), each at its word's rate. AUDIT PRECIP PACK-10: it was the WORN word's,
 *  and a storm cell's fringe outranked its own front's heart. 0 where nothing falls. Pure. */
export function fallRateOf(fall) {
  if (!fall) return 0;
  const r = SNOWPACK.rate, k = (v) => Math.max(0, Math.min(1, v || 0));
  return Math.max(r.rain * k(fall.rain), r.thunder * k(fall.thunder), r.snow * k(fall.snow));
}

/** ∫ max(0, A + D cos θ) dθ over [a, b] (radians): the degree-time of a day's cosine over a base, in closed form - each
 *  stretch where it stands over freezing (within acos(-A / D) of the warmest hour) taken whole. Pure. */
export function positiveCosIntegral(A, D, a, b) {
  if (!(b > a)) return 0;
  if (!(D > 0)) return A > 0 ? A * (b - a) : 0;
  if (A >= D) return A * (b - a) + D * (Math.sin(b) - Math.sin(a));
  if (A <= -D) return 0;
  const al = Math.acos(-A / D), P = 2 * Math.PI;
  let sum = 0;
  for (let k = Math.ceil((a - al) / P); k * P - al < b; k++) {
    const lo = Math.max(a, k * P - al), hi = Math.min(b, k * P + al);
    if (hi > lo) sum += A * (hi - lo) + D * (Math.sin(hi) - Math.sin(lo));
  }
  return sum;
}
/** The least cos θ over [a, b]. Pure. */
export function cosMinOver(a, b) {
  const P = 2 * Math.PI;
  return Math.ceil((a - Math.PI) / P) * P + Math.PI <= b ? -1 : Math.min(Math.cos(a), Math.cos(b));
}

/**
 * THE AIR THROUGH ONE STEP at field (x, z), its climate's numbers `p` (airParamsAt - fixed for a place), from event
 * minute `t0` to `t1`, under `fall` (wornAmong's - its chill and its cloud: airTemperature.js airFall): `base` the sea's
 * air without the day's swing (the season and the spell at the step's middle, less the fall's chill), `day` the day's
 * half-range under the step's cloud, and the step's SKY interval as hour angles from the warmest hour, `th0` to `th1`
 * (AUDIT PRECIP PACK-8: the day's swing is integrated over the sky's own hours - online the sky runs twice the event
 * clock, and a step read at its instant fell on 03, 09, 15 and 21 alone). airTemperature.js airTemperature's own terms
 * at the sea. Pure.
 */
export function stepAir(p, x, z, t0, t1, fall, out = { base: 0, day: 0, th0: 0, th1: 0 }) {
  const tm = (t0 + t1) / 2;
  const day = dayOfSky(skyMinuteOfEvent(tm));   // OW-HITCH: no pair a step
  const f = airFallInto(fall, _fallAir);
  out.base = seasonAir(p, day) + p.spell * spellAt(x, z, tm) - f.chill;
  out.day = p.day * (1 - (1 - FALL.dayUnderCloud) * f.cover);
  const s0 = skyMinuteOfEvent(t0), s1 = skyMinuteOfEvent(t1);
  out.th0 = 2 * Math.PI * (s0 / 1440 - WARMEST_HOUR / 24);
  out.th1 = out.th0 + 2 * Math.PI * Math.max(0, s1 - s0) / 1440;
  return out;
}

const _fallAir = { wet: 0, snow: 0, cover: 0, chill: 0 };   // OW-HITCH: stepAir's fall terms, read at once
const GL_X = [-0.8611363115940526, -0.3399810435848563, 0.3399810435848563, 0.8611363115940526];
const GL_W = [0.3478548451374538, 0.6521451548625461, 0.6521451548625461, 0.3478548451374538];
const _cos = new Float64Array(256), _w = new Float64Array(256);
/**
 * ONE STEP of a place's pack at its first `n` levels: `swe` (mm) moved on in place by `hours` of the step's air (`air`:
 * stepAir) under a fall of `rate` mm an hour. The snow and the rain's heat through the step are means over its sky hours
 * (four Gauss points a quarter-day), the melt the day's cosine's degree-hours over them in closed form - exact on the
 * offline clock and the online sky's alike. Monotone in height (above). Answers whether any level holds snow after it.
 * Pure.
 */
export function stepPack(swe, air, rate, hours, n = swe.length) {
  const { from, step } = SNOWPACK.levels, cap = SNOWPACK.capMm;
  const span = air.th1 - air.th0;
  let q = 0;
  if (rate > 0) {
    const m = Math.max(1, Math.min(64, Math.ceil(span / (Math.PI / 2))));
    for (let i = 0; i < m; i++) {
      const a = air.th0 + (span * i) / m, h = span / m / 2;
      for (let g = 0; g < 4; g++) { _cos[q] = air.day * Math.cos(a + h + h * GL_X[g]); _w[q] = GL_W[g] / (2 * m); q++; }
    }
  }
  const fallMm = rate * hours;
  let any = false;
  for (let k = 0; k < n; k++) {
    const A = air.base - LAPSE_C_PER_M * (from + k * step);
    let white = 0, heat = 0;
    for (let i = 0; i < q; i++) {
      const T = A + _cos[i], s = snowShareOf(T);
      white += _w[i] * s;
      if (T > 0) heat += _w[i] * (1 - s) * T;
    }
    const degreeHours = span > 0 ? positiveCosIntegral(A, air.day, air.th0, air.th1) * hours / span : Math.max(0, A + air.day * Math.cos(air.th0)) * hours;
    const next = swe[k] + fallMm * white - (SNOWPACK.melt * degreeHours + SNOWPACK.rainMelt * fallMm * heat);
    swe[k] = next > 0 ? (next < cap ? next : cap) : 0;
    if (swe[k] > 0) any = true;
  }
  return any;
}
/** The coldest the air at the sea can be through a step at field (x, z) (`p` its numbers): every fall's chill and the
 *  day's coldest stretch of the step under whichever cloud makes it colder - stepAir's own terms at their least. Pure. */
export function stepAirFloor(p, x, z, t0, t1) {
  const tm = (t0 + t1) / 2;
  const day = dayOfSky(skyMinuteOfEvent(tm));   // OW-HITCH
  const s0 = skyMinuteOfEvent(t0), s1 = skyMinuteOfEvent(t1);
  const th0 = 2 * Math.PI * (s0 / 1440 - WARMEST_HOUR / 24), th1 = th0 + 2 * Math.PI * Math.max(0, s1 - s0) / 1440;
  const c = cosMinOver(th0, th1);
  return seasonAir(p, day) + p.spell * spellAt(x, z, tm) - (FALL.chill + FALL.snowCold) + p.day * c * (c < 0 ? 1 : FALL.dayUnderCloud);
}

/** The first step (an event minute on the step grid) of the snow year holding event minute `t`: the last grid minute
 *  at or before the sky's last midsummer at or before `t` - never after `t` (AUDIT PRECIP PACK-9: it was the first at or
 *  after it, and online, in the minutes after the sky's midsummer, a point's year began in its future). Pure in `t` and
 *  the sky's law. */
export function yearOriginOf(t) {
  const sky = skyMinuteOfEvent(t);
  const since = (((sky - MIDSUMMER_MINUTE) % MINUTES_PER_YEAR) + MINUTES_PER_YEAR) % MINUTES_PER_YEAR;
  // FIELD BUGS 2026-10-21b SNOW-YEAR: the sky's midsummer is a whole minute (MIDSUMMER_MINUTE a year on), and `sky - since`
  // carried a fractional minute's float error onto it - so off the sky calendar, where the event minute IS the sky's, it
  // fell a hair under the grid step it lies on in one minute and on it in the next, and the floor gave the year two
  // origins a step apart (2.7% of fractional minutes). Two askers a minute apart then reset each other's lattice points
  // for good, and a pixel build waiting on the snow (snowCoverHost.js settle) waited forever: the world stopped streaming.
  const midsummer = eventMinuteOfSky(Math.round(sky - since));
  return Math.floor(midsummer / SNOWPACK.stepMinutes) * SNOWPACK.stepMinutes;
}

/** A lattice point's place: field metres of map pixel CORNER (cx, cy) - the north-west corner of pixel (cx, cy), x east,
 *  z north. AUDIT PRECIP HOST-5: the points stand on corners, so every pixel lies inside one lattice cell and the
 *  bilinear of its four corners' lines (the shader's) IS the lattice's (every reader's on the CPU). */
export const cornerField = (cx, cy) => [cx * TERRAIN_SIZE, (MAX_MAP_PIXEL_Y - cy) * TERRAIN_SIZE];

/**
 * THE PACK ON A LATTICE OF PLACES - map pixel corners every `spacing` pixels - each point's history integrated from its
 * snow year's origin, on the step grid, as far as asked. Points are kept by their lattice index, so a point integrated
 * once is never integrated again however the window about the player moves; a step's systems are found ONCE for every
 * point that needs that step (weatherMap.js systemsSpanWalk over their box, the wet types alone - one walk of the map
 * for a day of steps, AUDIT PRECIP DOC-7, each step's own answered from it by systemsAmong) and kept for the points
 * that come later (`_systems`, two places a step - a ride out and back finds its own), so a window's new edge
 * integrates for the cost of its own air alone. The finding is itself a walk taken a lattice node at a time within the
 * frame's budget (AUDIT PRECIP PACK-6): a day the memo has never seen costs frames, never a hitch.
 *
 * Each point holds its pack at its last step and at the step before (AUDIT PRECIP PACK-4/9): the pack now between them
 * is their blend (`packNow`) - continuous, inside its own history, pure in the minute - and a clock set back inside
 * them is answered as it stands.
 *
 * `climateAt(px, py)` the map's climate index (the weather map's births read it).
 */
export class SnowpackLattice {
  /** @param {{ climateAt: (px: number, py: number) => number, spacing?: number }} o */
  constructor({ climateAt, spacing = 2 }) {
    this.climateAt = climateAt;
    this.spacing = spacing;
    /** AUDIT PRECIP HOST-10: the climate read the weather map's births are found under - the lattice's own function, so its
     *  history is drawn into a memo of its own (weatherMap.js keys its births by the read), never the sim's live one; let go
     *  after a long catch-up (`advance`), and its year of nodes with it */
    this._births = (px, py) => climateAt(px, py);
    this._caughtUp = 0;
    /** @type {Map<number, any>} */
    this.points = new Map();
    /** @type {Map<number, Array<{ x: number, z: number, range: number, systems: any[] }>>} the wet systems found at a step, and the discs they cover */
    this._systems = new Map();
    /** the finding under way: { t0, t1, x, z, range, walk } - a span of steps (systemsSpanWalk) */
    this._job = null;
    /** the last span found: { t0, t1, x, z, range, value } - its steps answered from it (systemsAmong) */
    this._span = null;
    this.stepsRun = 0;
    this.stepsSkipped = 0;
    this.spinsRun = 0;
    /** SNOW-BUDGET: the step a call left part-way (`m` a main step, `s` a spin's, and its minute), or null */
    this._partial = null;
    /** OW-HITCH: the points due at a step (advance's), one list for every step */
    this._due = [];
  }
  /** The lattice index of the point nearest map pixel (px, py)'s middle. */
  indexOf(px, py) { return [Math.round((px + 0.5) / this.spacing), Math.round((py + 0.5) / this.spacing)]; }
  /**
   * The point at lattice index (i, j) holding event minute `t`, made when first asked - and made again for a new snow
   * year, or a clock set back behind the earlier of its two packs (AUDIT PRECIP PACK-9: one rule for time behind a
   * point, here). A made point starts at its year's origin with the pack its summer left (`spin`, below).
   */
  point(i, j, t) {
    const key = latticeKey(i, j), S = SNOWPACK.stepMinutes;
    let pt = this.points.get(key);
    const origin = yearOriginOf(t);
    if (pt && pt.origin === origin && !(t < pt.step - S)) return pt;
    const [x, z] = cornerField(i * this.spacing, j * this.spacing);
    const p = pt?.p ?? Object.freeze({ ...airParamsAt(x, z) });
    const ceil = pt?.ceil ?? this.topOf(i, j);
    const top = levelIndexAbove(ceil), n = top + 1;
    pt = { i, j, x, z, p, ceil, top, n, swe: new Float32Array(n), prev: new Float32Array(n), step: origin, origin, empty: true, spin: null };
    const before = yearOriginOf(origin - 1);
    if (!this.meltsOut(pt, before, origin)) pt.spin = { step: before, swe: new Float32Array(n), empty: true };
    this.points.set(key, pt);
    return pt;
  }
  /**
   * AUDIT PRECIP PACK-3: WHETHER NO SNOW CAN OUTLIVE THE SUMMER before `origin` at any of a point's held levels: going back
   * from it a step at a time, the air at each level never cold enough to lay snow (stepAirFloor at or over
   * RAIN_ALL_C) and warm enough over those steps to melt a whole pack (capMm). Where it can, the point's year begins from
   * the year before's survival (`spin`: that year integrated from nothing, as the main steps are) - the snow on a summit
   * the midsummer used to wipe to nought. A bound on the spin's own steps, so it is exact for them.
   */
  meltsOut(pt, before, origin) {
    const steps = this.spinSteps(before, origin), need = SNOWPACK.capMm / SNOWPACK.melt;
    const alt = levelAltitude(pt.n - 1);   // the highest level held decides: every level under it is warmer
    let sum = 0;
    for (let s = steps.length - 1; s > 0; s--) {
      const T = stepAirFloor(pt.p, pt.x, pt.z, steps[s - 1], steps[s]) - LAPSE_C_PER_M * alt;
      if (!(T >= RAIN_ALL_C)) return false;
      sum += T * (steps[s] - steps[s - 1]) / 60;
      if (sum >= need) return true;
    }
    return false;
  }
  /** The spin's steps over the year before `origin` (from `before`, its own origin): the step grid's, to `origin` -
   *  kept for the year. */
  spinSteps(before, origin) {
    if (this._spinSteps?.origin === origin) return this._spinSteps.steps;
    const steps = [];
    for (let s = before; s < origin; s += SNOWPACK.stepMinutes) steps.push(s);
    steps.push(origin);
    this._spinSteps = { origin, steps };
    return steps;
  }
  /** THE HIGHEST GROUND a point's snowline is read on (m above the sea, its `ceil`): the bound of the ground every pixel
   *  its lattice cells cover stands (the air's map, airGround.js topAt - the kernel's terms, the landforms' lift and their
   *  tallest hill: AUDIT PRECIP PACK-1, it was the byte and a 600 m guess, 1,350 m under the landforms' ranges), a pixel
   *  wider for a town's level and a road's bed made of its neighbours' ground. No fragment stands over it, so the levels to
   *  the one over the first at or above it (`n`, levelIndexAbove) read every crossing its ground wears - and the levels
   *  over those are never held. */
  topOf(i, j) {
    const g = airGround(), s = this.spacing, cx = i * s, cy = j * s;
    if (!g?.topAt) return levelAltitude(SNOWPACK.levels.count - 1);
    let top = -Infinity;
    for (let py = cy - s - 1; py <= cy + s; py++) for (let px = cx - s - 1; px <= cx + s; px++) top = Math.max(top, g.topAt(px, py));
    return top;
  }
  /** The wet systems standing at event minute `t` over every point of `pts`: found once for a disc about their box,
   *  widened by REACH_PAD so a window that moves on finds its new edge inside it, and kept for the points after. The
   *  finding walks a node at a time; null when `deadline` (on `now`'s clock) comes first - the next ask goes on with it. */
  systemsFor(t, pts, deadline = Infinity, now = () => performance.now()) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const pt of pts) { x0 = Math.min(x0, pt.x); x1 = Math.max(x1, pt.x); z0 = Math.min(z0, pt.z); z1 = Math.max(z1, pt.z); }
    const covers = (d) => pts.every((pt) => Math.hypot(pt.x - d.x, pt.z - d.z) <= d.range);
    const held = this._systems.get(t);
    if (held) for (const d of held) if (covers(d)) return d.systems;
    // AUDIT PRECIP DOC-7: a span of steps walked once (weatherMap.js systemsSpanWalk - the systems each step's own walk
    // finds, exactly), its disc the one the step's walk took
    const span = this._span;
    if (span && span.t0 <= t && t <= span.t1 && covers(span)) return this._hold(t, span, systemsAmong(span.value, t));
    let job = this._job;
    if (!job || !(job.t0 <= t && t <= job.t1) || !covers(job)) {
      const x = (x0 + x1) / 2, z = (z0 + z1) / 2, range = Math.hypot(x1 - x0, z1 - z0) / 2 + REACH_PAD;
      const t1 = t + (SPAN_STEPS - 1) * SNOWPACK.stepMinutes;
      job = this._job = { t0: t, t1, x, z, range, walk: systemsSpanWalk(x, z, t, t1, this._births, range, WET_TYPES) };
    }
    for (;;) {
      const r = job.walk.next();
      if (r.done) {
        this._job = null;
        this._span = { t0: job.t0, t1: job.t1, x: job.x, z: job.z, range: job.range, value: r.value };
        return this._hold(t, this._span, systemsAmong(r.value, t));
      }
      if (now() > deadline) return null;
    }
  }
  /** A step's systems kept for the points after it, with the disc they cover (DISCS_A_STEP a step, HELD_STEPS steps). */
  _hold(t, disc, systems) {
    const list = this._systems.get(t) ?? [];
    list.push({ x: disc.x, z: disc.z, range: disc.range, systems });
    if (list.length > DISCS_A_STEP) list.shift();
    this._systems.delete(t); this._systems.set(t, list);
    if (this._systems.size > HELD_STEPS) this._systems.delete(this._systems.keys().next().value);
    return systems;
  }
  /**
   * Integrate every point of `pts` to the first step at or after event minute `t` (one ahead: the pack now is the blend
   * of the two about it), its year-before spin first, earliest step first, for at most `budgetMs` of the clock (`now`
   * the clock: performance.now's). Answers true when every point stands there.
   *
   * SNOW-BUDGET (2026-10-20, a player via the owner: "something about our weather system affecting fps"): THE BUDGET IS
   * KEPT. The deadline was read only after a whole step of the window - 121 points' air and pack, ~10 ms - so a 3 ms
   * frame's integration ran a step at the least, and each of a frame's readers ran its own. Now a step's points stop at
   * it (`_step`): the rest carry on in the next call, each point's history its own, so every pack is the one it was. A
   * call still moves at least one point (a build's wait with no slice left goes on), so a spent budget costs a point.
   */
  advance(pts, t, budgetMs = Infinity, now = () => performance.now()) {
    const S = SNOWPACK.stepMinutes, target = Math.ceil(t / S) * S;
    const deadline = now() + budgetMs;
    for (;;) {
      let spin = Infinity;
      for (const pt of pts) if (pt.spin && pt.spin.step < pt.origin && pt.spin.step < spin) spin = pt.spin.step;
      if (spin < Infinity) {
        const due = this._due;   // OW-HITCH: one list a lattice, filled a step (it was a new array a step: a year of them a window's edge)
        due.length = 0;
        for (const pt of pts) if (pt.spin && pt.spin.step === spin) due.push(pt);
        if (!this._step(due, spin, Math.min(due[0].origin, spin + S), deadline, now, true)) return false;
        this._caughtUp++;
        if (now() > deadline) return false;
        continue;
      }
      for (const pt of pts) {
        if (!pt.spin) continue;
        pt.swe.set(pt.spin.swe); pt.prev.set(pt.spin.swe); pt.empty = pt.spin.empty; pt.spin = null;   // the year begins with what the last summer left
      }
      let lo = Infinity;
      for (const pt of pts) if (pt.step < target && pt.step < lo) lo = pt.step;
      if (lo === Infinity) {
        // stood at `t`: a long catch-up's births go with its memo (the steps it found are held by `_systems`)
        if (this._caughtUp > DROP_AFTER_STEPS && !this._job) { this._births = (px, py) => this.climateAt(px, py); this._span = null; }
        this._caughtUp = 0;
        return true;
      }
      const due = this._due;   // OW-HITCH
      due.length = 0;
      for (const pt of pts) if (pt.step === lo) due.push(pt);
      if (!this._step(due, lo, lo + S, deadline, now, false)) return false;
      this._caughtUp++;
      if (now() > deadline) return false;
    }
  }
  /** One step from event minute `t0` to `t1` for `due` (every one standing at `t0`; `spin` their year-before spin's).
   *  A step that cannot lay snow on any of them - each holding none, and its air at its highest level held warmer than
   *  RAIN_ALL_C however cold the fall's chill and the cloud make it - moves nothing, and asks the weather nothing
   *  (`stepsSkipped`): the same packs exactly. False when the step's systems are still being found (`deadline`), and
   *  (SNOW-BUDGET) when the deadline comes between its points: those stepped stand at `t1`, the rest at `t0` for the next
   *  call (`_partial` the step so left) - counted once, by the call that steps its last point. */
  _step(due, t0, t1, deadline, now, spin) {
    // AUDIT SNOW-BUDGET F1: a step the deadline cut part-way was judged for its WHOLE group, and found not quiet - its
    // rest is stepped, never judged again: the points left could all be bare and warm (the snow in the part already
    // stepped), and skipping them kept the `prev` of a point whose snow had melted out the step before - a pack one
    // unbudgeted call never makes (the white the same on every client whatever its machine's speed)
    // OW-HITCH: the step's name is made only where a step stands part-way (it was made at every step)
    let quiet = this._partial === null || this._partial !== `${spin ? 's' : 'm'}${t0}`;
    if (quiet) {
      for (const pt of due) {
        if (!(spin ? pt.spin : pt).empty) { quiet = false; break; }
        if (!(stepAirFloor(pt.p, pt.x, pt.z, t0, t1) - LAPSE_C_PER_M * levelAltitude(pt.top) >= RAIN_ALL_C)) { quiet = false; break; }
      }
    }
    if (quiet) {
      for (const pt of due) (spin ? pt.spin : pt).step = t1;
      this._partial = null;   // AUDIT SNOW-BUDGET F4: no step stands part-way after this one
      this.stepsSkipped++;
      return true;
    }
    const systems = this.systemsFor(t1, due, deadline, now);
    if (systems === null) return false;
    const hours = (t1 - t0) / 60;
    for (let k = 0; k < due.length; k++) {
      if (k > 0 && now() >= deadline) { this._partial = `${spin ? 's' : 'm'}${t0}`; return false; }   // SNOW-BUDGET: the rest the next call's
      const pt = due[k];
      const fall = systems.length ? fallAmong(systems, pt.x, pt.z, _fall) : NO_FALL;   // OW-HITCH: the fall alone (wornAmong's), into one scratch
      const rate = fallRateOf(fall);
      stepAir(pt.p, pt.x, pt.z, t0, t1, fall, _air);
      const st = spin ? pt.spin : pt;
      if (!spin) pt.prev.set(pt.swe);
      st.empty = !stepPack(st.swe, _air, rate, hours, pt.n);
      st.step = t1;
    }
    this._partial = null;
    if (spin) this.spinsRun++; else this.stepsRun++;
    return true;
  }
  /**
   * THE PACK NOW at a point integrated to the first step at or after `t` (`advance`): the blend of its two packs about
   * `t`, by where `t` stands between their steps - continuous in time, monotone in height (a blend of two monotone
   * packs), inside its own history (AUDIT PRECIP PACK-4: it carried the last step on under the fall standing at `t`, and a
   * storm cell passing at that instant laid three hours of snow the next step disowned). Its first `n` levels into `out`.
   * Pure in the point and `t`.
   */
  packNow(pt, t, out = new Float32Array(SNOWPACK.levels.count)) {
    const u = Math.max(0, Math.min(1, 1 - (pt.step - t) / SNOWPACK.stepMinutes));
    for (let k = 0; k < pt.n; k++) out[k] = pt.prev[k] + (pt.swe[k] - pt.prev[k]) * u;
    return out;
  }
  /** Forget every point and every held system (the next ask starts over). */
  reset() { this.points.clear(); this._systems.clear(); this._job = null; this._span = null; }
}
const _air = { base: 0, day: 0, th0: 0, th1: 0 };
const _fall = { intensity: 0, rain: 0, thunder: 0, snow: 0, cover: 0 };   // OW-HITCH: a point's fall at a step, read at once
/** A lattice point's key - an integer (AUDIT PRECIP HOST-9: a template string a read, in the grass's own loop), for the
 *  whole frame the world streams (indices within 8192 of the map's origin either way). */
export const latticeKey = (i, j) => (i + 8192) * 16384 + (j + 8192);
/** The weather map's types that fall (a storm cell is found through its rain front). */
export const WET_TYPES = Object.freeze(['rain', 'snow']);
const NO_FALL = Object.freeze({ intensity: 0, rain: 0, thunder: 0, snow: 0, cover: 0 });
/** How many steps of systems the lattice keeps (a window's new edge integrates against them): a whole snow year's and its
 *  year-before spin's. */
const HELD_STEPS = 2 * 2880;
/** A catch-up longer than this many steps lets its births memo go when it stands (two days: an arrival, a rest, a load). */
const DROP_AFTER_STEPS = 16;
/** How many places a step's systems are kept for (a ride out and back finds its own). */
const DISCS_A_STEP = 2;
/** AUDIT PRECIP DOC-7: the steps one walk of the weather map serves (systemsSpanWalk): a day of them. */
const SPAN_STEPS = 8;
/** How far past a box of points a step's systems are found for (m): a window moving this far finds them held. */
const REACH_PAD = 12000;
