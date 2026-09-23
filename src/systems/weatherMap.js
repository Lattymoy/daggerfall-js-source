// @ts-check
// WEATHER3 slice A (2026-09-22, Mac: "imagine a map, one location its
// sunny, one is cloudy, one has a rainstorm, etc" ... "A true overhaul
// within enhanced enviroments"): THE WORLD WEATHER MAP - weather as
// SYSTEMS on the land, the weather at a place a pure function of the
// place and the minute.
//
// DFU's weather is a climate zone's word, rolled once a day
// (weatherSim.js, the classic lane, 1:1). The enhanced lane's world
// instead carries WEATHER SYSTEMS - a thunderstorm, a rain band, a snow
// squall, a sandstorm, a fog bank, an overcast deck, a cloud field -
// each born somewhere at some minute, drifting on the wind, growing,
// holding and dying. Where a system stands, its word is the sky; where
// none does, the air is clear. Nothing is rolled per day or per zone,
// nothing is carried: `weatherAt(x, z, minutes)` answers the same sky
// for the same place and minute on every client, offline and online.
// (The bible's record: bible/07-Rendering/Weather-Arc.md, WEATHER3.)
//
// THE LAW, AND WHY IT IS CALIBRATED BY CONSTRUCTION
//
// Births are a POISSON PROCESS in space and time, one per system type:
// the land is cut into NODES (each type's own `node` a side and long); a
// node draws a Poisson count of candidates per type from a generator
// keyed on (gx, gz, gt, type) and a world constant - never the day - and
// places each uniformly inside its cell and its period. A Poisson count
// per cell with uniform places IS a homogeneous Poisson process. Each
// candidate is then kept with probability (the type's birth weight for
// the CLIMATE under it and the SEASON at its birth, times the hour's
// diurnal factor) / the type's ceiling - Poisson thinning, so the kept
// births are the Poisson process of exactly that intensity.
//
// A system is a disc whose radius swells and shrinks with its envelope,
// cut into BANDS (core, ring, skirt - STRUCTURE below), riding the wind.
// By Campbell's theorem the number of systems whose band b covers a
// fixed point is Poisson with mean = intensity x the band's expected
// space-time volume; by the colouring theorem the counts for different
// bands are INDEPENDENT (a point in one system's core cannot be in the
// same system's ring, and that is all the dependence there is). So the
// chance the worn word - the highest-priority word covering the point -
// is w is (1 - e^-mu_w) x prod(e^-mu_w' for w' above w), and the clear
// share is e^-(sum mu). Read backwards from DFU's own table (the
// Chronicles' odds per climate and season, weatherTable.js), that fixes
// every mu, and the structure's band volumes turn the mus into birth
// weights, solved top priority down (`birthLaw`). The table stays
// the law of HOW MUCH weather a climate gets; the map decides WHERE and
// WHEN. The calibration test samples the map and holds the shares to
// the table.
//
// PURE. Positions are FIELD METRES (weatherField.js's frame: a map
// pixel is TERRAIN_SIZE on a side, x east, z north), time is absolute
// classic minutes (the save's clock offline, the shared clock online).
// `climateAt(px, py)` answers the map's climate index (the hosts pass
// MapsFile's); a pixel off the map is the sea.

import { CLIMATES, MAX_MAP_PIXEL_X, MAX_MAP_PIXEL_Y } from '../formats/mapsFile.js';
import { SEASONS, seasonValue, dateFromClassicMinutes } from './gameDate.js';
import { WEATHER_TABLE, weatherTableFor } from './weatherTable.js';
import { pixelOfField } from './weatherField.js';
import { seededRng, VIOLENCE } from './wind.js';

const WORLD_SEED = 0x57584D50;   // 'WXMP'

/** The priority where systems overlap: the worn word is the first
 *  present (the others still stand in the sky). */
export const PRIORITY = Object.freeze(['thunder', 'rain', 'snow', 'sandstorm', 'fog', 'overcast', 'cloudy']);
const RANK = Object.freeze(Object.fromEntries(PRIORITY.map((w, i) => [w, i])));

/**
 * THE SYSTEM TYPES. Each is a CORE - the type's own word - with RINGS of
 * lower words around it, so a front is SEEN coming: cloud first, then the
 * deck, then the rain. `core` is the core's radius range at full growth
 * (metres); `rings` the words outward, each as its AREA in core areas
 * (`[word, share]` - the ring's outer edge is where the disc's area
 * reaches 1 + the shares so far); `life` the lifetime range (game
 * minutes); `speed` the metres per game minute the type rides the wind
 * at (the wind field's own magnitude is at most 1); `grow` and `decay`
 * the envelope's ramps as shares of the life; `diurnal` the birth rate's
 * swing over the day ([amplitude, peak hour], per season or `other`), a
 * cosine whose day mean is 1; `node` the lattice its births are keyed on
 * ([metres a side, game minutes long], sized to the type, so a search
 * walks a handful of nodes whatever the type's reach).
 *
 * WEATHER3g (Mac: "this needs more clarity"): the weather is REGIONAL. A
 * rain system is a FRONT tens of kilometres across, and a thunderstorm is
 * a CELL of a front (`parent`), riding with it - so a storm reads as a
 * rain front mottled with its cells, not a rash of small storms over the
 * whole bay. A cell has no lattice and no speed of its own: it is found
 * through its front, stands where it was born in the front's frame, and
 * paints only inside its front's core as the core is now (`clip`) - it
 * dies with its front. The speeds keep a system's drift over its life to
 * tens of kilometres: the table is a climate's law, and a front that rode
 * hundreds would carry one climate's weather deep into the next.
 *
 * The ring shares are each type's shape AT MOST: a climate whose table
 * leaves too little of a word for every storm's ring of it (the swamp's
 * spring: a quarter rain and 15% thunder, a tenth cloudy) births its
 * storms with that ring THINNED to fit (`birthLaw`), so the table stays
 * reachable in every climate and season by construction.
 */
export const SYSTEM_TYPES = Object.freeze({
  thunder: Object.freeze({
    parent: 'rain', core: [8000, 16000], rings: [], life: [150, 420], grow: 0.25, decay: 0.35,
    diurnal: { [SEASONS.Summer]: [0.7, 16], other: [0.3, 16] },   // summer storms are born in the afternoon heat
  }),
  rain: Object.freeze({
    core: [40000, 75000], rings: [['overcast', 1], ['cloudy', 1]], life: [720, 1800], speed: 30, grow: 0.2, decay: 0.3,
    node: [160000, 1440], diurnal: { other: [0, 0] },
  }),
  snow: Object.freeze({
    core: [40000, 75000], rings: [['overcast', 1.2]], life: [720, 1800], speed: 25, grow: 0.2, decay: 0.3,
    node: [160000, 1440], diurnal: { other: [0, 0] },
  }),
  sandstorm: Object.freeze({
    core: [15000, 30000], rings: [['cloudy', 1]], life: [240, 600], speed: 40, grow: 0.2, decay: 0.3,
    node: [80000, 720], diurnal: { other: [0.4, 15] },   // the desert wind rises with the day's heat
  }),
  fog: Object.freeze({
    core: [15000, 35000], rings: [], life: [240, 600], speed: 5, grow: 0.25, decay: 0.3,
    node: [80000, 720], diurnal: { other: [0.8, 4] },   // born in the small hours; a bank born at 04:00 is gone by early afternoon
  }),
  overcast: Object.freeze({
    core: [45000, 85000], rings: [['cloudy', 1]], life: [720, 1800], speed: 25, grow: 0.2, decay: 0.25,
    node: [160000, 1440], diurnal: { other: [0, 0] },
  }),
  cloudy: Object.freeze({
    core: [40000, 80000], rings: [], life: [480, 1440], speed: 28, grow: 0.2, decay: 0.25,
    node: [160000, 1440], diurnal: { other: [0.25, 14] },   // clear nights stay clear more often than days
  }),
});
/** Each front type's cell type (`rain` -> `thunder`): the types born
 *  only inside another's core. */
export const CELL_OF = Object.freeze(Object.fromEntries(PRIORITY.filter((t) => SYSTEM_TYPES[t].parent).map((t) => [SYSTEM_TYPES[t].parent, t])));
// the Cox law below holds only while a front's own word and its cell's are painted by nothing but the front's cores
// and the cells: no ring may carry either (a ring-painted rain would be rain with no cells under it)
for (const [front, cell] of Object.entries(CELL_OF)) {
  for (const t of PRIORITY) for (const [word] of SYSTEM_TYPES[t].rings) if (word === front || word === cell) throw new Error(`weatherMap: ${t}'s ring paints ${word}, a front's or a cell's word`);
}
const TYPE_SALT = Object.freeze({ thunder: 1, rain: 2, snow: 3, sandstorm: 4, fog: 5, overcast: 6, cloudy: 7 });

/** A newborn system's size as a share of its full size: it swells from
 *  this to 1 as its envelope rises, and shrinks back as it dies. */
export const BIRTH_RADIUS = 0.35;

/** The Chronicles have no sandstorm - it is the desert's wind: on the
 *  desert table's land this share of the table's CLOUDY is sandstorms
 *  (a sandstorm's own ring is cloud). The calibration counts a sandstorm
 *  as the cloudy it came from. */
export const SAND_SHARE_OF_CLOUDY = 0.25;

// ---- the envelope --------------------------------------------------

/** The envelope at `u` (age over life, 0..1): a trapezoid - it rises
 *  over `grow`, holds, and falls over `decay`. */
export function envelope(spec, u) {
  if (u <= 0 || u >= 1) return 0;
  if (u < spec.grow) return u / spec.grow;
  if (u > 1 - spec.decay) return (1 - u) / spec.decay;
  return 1;
}
/** The size share at envelope `e`. */
const radiusShare = (e) => BIRTH_RADIUS + (1 - BIRTH_RADIUS) * e;
/** The mean over a life of radiusShare(envelope)^2 - closed form: over
 *  a linear ramp the mean of (a + b u)^2 is a^2 + ab + b^2/3. */
export function meanAreaShare(spec) {
  const a = BIRTH_RADIUS, b = 1 - BIRTH_RADIUS;
  const ramp = a * a + a * b + (b * b) / 3;
  return (spec.grow + spec.decay) * ramp + (1 - spec.grow - spec.decay);
}
const meanSq = ([lo, hi]) => (lo * lo + lo * hi + hi * hi) / 3;   // E[R^2] of a uniform range
const mean = ([lo, hi]) => (lo + hi) / 2;
/** The expected space-time volume (m^2 x game minutes) of a type's core
 *  over a whole life; a ring of share s is s of it. */
export function coreVolume(type) {
  const spec = SYSTEM_TYPES[type];
  return Math.PI * meanSq(spec.core) * mean(spec.life) * meanAreaShare(spec);
}

// ---- the calibration: the table's shares to the birth law ------------

/** The table's row (compiled order [Sunny, Cloudy, Overcast, Fog, Rain,
 *  Snow, Thunder], per cent) as the target share of each worn word. */
export function targetShares(table, season) {
  const row = table?.[season];
  if (!row) return null;
  const t = { thunder: row[6] / 100, rain: row[4] / 100, snow: row[5] / 100, sandstorm: 0, fog: row[3] / 100, overcast: row[2] / 100, cloudy: row[1] / 100 };
  if (table === WEATHER_TABLE.desert) { t.sandstorm = t.cloudy * SAND_SHARE_OF_CLOUDY; t.cloudy -= t.sandstorm; }
  return t;
}

/** The covering mean each worn word needs for the target shares: read
 *  the priority down, the share of w is (1 - e^-mu_w) x (what no higher
 *  word took). */
export function coverMeans(targets) {
  const mu = {};
  let free = 1;
  for (const w of PRIORITY) {
    const ratio = Math.min((targets[w] ?? 0) / free, 0.999);
    mu[w] = ratio > 0 ? -Math.log(1 - ratio) : 0;
    free *= 1 - ratio;
  }
  return mu;
}

/** A type's lattice node, in m^2 x game minutes. */
const nodeVolume = (type) => SYSTEM_TYPES[type].node[0] * SYSTEM_TYPES[type].node[0] * SYSTEM_TYPES[type].node[1];

/**
 * A FRONT AND ITS CELLS, as covering means (WEATHER3g). Cells are Poisson
 * inside the fronts' cores, and the fronts are Poisson: with K fronts over
 * a point (K ~ Poisson(nu)) and `c` the cells' covering mean over a point
 * inside one front, the cells over it are Poisson(cK), so the chance of
 * none is E[e^-(1-e^-c)K] = exp(-nu (1 - e^-c)) - the Poisson's
 * generating function. So the cell's word has the covering mean
 * nu (1 - e^-c) and the front's own nu e^-c: together nu, the fronts'.
 */
const cellMean = (nu, c) => nu * (1 - Math.exp(-c));

/** One solve of the law at FLAT exposure (no daily cycle): each word's
 *  covering mean met top priority down. Answers { core, rings } - `core`
 *  the covering mean each type's cores give (a cell type's: over a point
 *  inside one of its fronts), `rings` as below. */
function solveFlat(targets) {
  const mu = coverMeans(targets);
  const painters = Object.fromEntries(PRIORITY.map((word) => [word, []]));   // word -> the rings painting it: { ring, mu (their type's core mean) }
  const core = {}, rings = {};
  for (const type of PRIORITY) {
    if (SYSTEM_TYPES[type].parent) continue;   // a cell type is solved with its front, below
    const painted = painters[type].reduce((sum, p) => sum + p.mu * p.ring[1], 0);
    if (painted > mu[type]) for (const p of painters[type]) p.ring[1] *= mu[type] / painted;
    core[type] = Math.max(0, mu[type] - painted);
    const cell = CELL_OF[type];
    if (cell) {
      // the fronts cover their own word AND their cells': nu is the pair's covering mean, and c inverts cellMean
      const nu = core[type] + mu[cell];
      core[type] = nu;
      core[cell] = nu > 0 ? -Math.log(1 - Math.min(mu[cell] / nu, 0.999)) : 0;
      rings[cell] = [];
    }
    rings[type] = SYSTEM_TYPES[type].rings.map(([word, share]) => [word, share]);
    if (core[type] > 0) for (const ring of rings[type]) painters[ring[0]].push({ ring, mu: core[type] });
  }
  return { core, rings };
}

/** The day, in bins, the calibration averages over. */
const DAY_BINS = 48;
const _exposure = new Map();
/**
 * A type's EXPOSURE over the day: the covering mean at each half hour as
 * a share of the day's mean. A type born more at one hour covers more a
 * little after it - the birth rate's cosine smeared over the ages its
 * systems live to, weighted by their size at each age. Flat (all 1) for
 * a type with no daily swing.
 */
export function exposure(type, season) {
  const key = `${type}:${season}`;
  let m = _exposure.get(key);
  if (m) return m;
  const spec = SYSTEM_TYPES[type];
  const ages = [];
  for (let a = 5; a < spec.life[1]; a += 10) {
    let w = 0;
    for (let k = 0; k < 32; k++) {
      const L = spec.life[0] + ((k + 0.5) / 32) * (spec.life[1] - spec.life[0]);
      if (a < L) w += radiusShare(envelope(spec, a / L)) ** 2;
    }
    ages.push([a, w]);
  }
  const total = ages.reduce((sum, [, w]) => sum + w, 0);
  m = Array.from({ length: DAY_BINS }, (_, i) => {
    const hour = ((i + 0.5) * 24) / DAY_BINS;
    return ages.reduce((sum, [a, w]) => sum + w * diurnal(type, hour - a / 60, season), 0) / total;
  });
  _exposure.set(key, m);
  return m;
}

/** The share of the day each worn word takes under a solved law. */
export function dayShares({ core, rings }, season) {
  const shares = Object.fromEntries(PRIORITY.map((w) => [w, 0]));
  for (let i = 0; i < DAY_BINS; i++) {
    const mu = Object.fromEntries(PRIORITY.map((w) => [w, 0]));
    for (const type of PRIORITY) {
      if (SYSTEM_TYPES[type].parent) continue;
      const m = core[type] * exposure(type, season)[i];
      const cell = CELL_OF[type];
      if (cell) {
        const cells = cellMean(m, core[cell] * exposure(cell, season)[i]);
        mu[cell] += cells; mu[type] += m - cells;
      } else mu[type] += m;
      for (const [word, share] of rings[type]) mu[word] += m * share;
    }
    let free = 1;
    for (const w of PRIORITY) { shares[w] += (free * (1 - Math.exp(-mu[w]))) / DAY_BINS; free *= Math.exp(-mu[w]); }
  }
  return shares;
}

const _laws = new Map();   // table -> season -> law, solved once
/**
 * THE BIRTH LAW for a climate and season: `weight[type]`, the expected
 * births per node of the type's lattice (a cell type's: per m^2 x game
 * minute of its fronts' cores), and `rings[type]`, the type's rings as
 * born there ([word, share], each share at most the type's own).
 *
 * Solved top priority down: every ring carries a LOWER-priority word than
 * its core, so by the time a word is reached every higher type that
 * rings it is already weighed. If those rings already paint more of the
 * word than the table wants, they are thinned together to exactly its
 * share and its own type is born nowhere here; else its type makes up
 * the rest. Then THE DAY: a type born more at some hours covers unevenly
 * over the day, and a share is not linear in its covering mean, so the
 * flat solve's day-averaged shares fall short of the table (a summer
 * storm's afternoon peak costs its climate two points of weather). The
 * solve is re-aimed by the shortfall until the day's shares ARE the
 * table's. A climate with no table (an unknown index) births nothing.
 */
export function birthLaw(climateIndex, season) {
  const table = tableOf(climateIndex);
  if (!table) return null;
  let bySeason = _laws.get(table);
  if (!bySeason) _laws.set(table, bySeason = new Map());
  let law = bySeason.get(season);
  if (law) return law;
  const targets = targetShares(table, season);
  if (!targets) return null;
  const aim = { ...targets };
  let flat = solveFlat(aim);
  for (let k = 0; k < 40; k++) {
    const got = dayShares(flat, season);
    let worst = 0;
    for (const w of PRIORITY) { const err = targets[w] - got[w]; worst = Math.max(worst, Math.abs(err)); aim[w] = Math.max(0, aim[w] + err); }
    if (worst < 1e-6) break;
    flat = solveFlat(aim);
  }
  const weight = Object.fromEntries(PRIORITY.map((t) => [t, flat.core[t] * (SYSTEM_TYPES[t].parent ? 1 : nodeVolume(t)) / coreVolume(t)]));
  const rings = Object.fromEntries(PRIORITY.map((t) => [t, Object.freeze(flat.rings[t].map((r) => Object.freeze(r)))]));
  law = Object.freeze({ weight: Object.freeze(weight), rings: Object.freeze(rings) });
  bySeason.set(season, law);
  return law;
}

/** The climate's table without DFU's unknown-climate warning: the map
 *  asks of every candidate's birthplace, and a climate with no table is
 *  simply no weather born there. */
const KNOWN = new Set(Object.values(CLIMATES));
function tableOf(climateIndex) {
  return KNOWN.has(climateIndex) ? weatherTableFor(climateIndex) : null;
}

/** The diurnal factor for a type at an hour and season (mean 1 over a day). */
export function diurnal(type, hour, season) {
  const d = SYSTEM_TYPES[type].diurnal;
  const [amp, peak] = d[season] ?? d.other;
  return 1 + amp * Math.cos(((hour - peak) / 24) * 2 * Math.PI);
}
const maxDiurnal = (type) => Math.max(...Object.values(SYSTEM_TYPES[type].diurnal).map(([amp]) => 1 + amp));

/** Every type's ceiling: the largest weight any climate and season asks
 *  of it, times its largest diurnal factor - the rate the candidates are
 *  drawn at before thinning. */
let _ceilings = null;
function ceilings() {
  if (_ceilings) return _ceilings;
  const c = Object.fromEntries(PRIORITY.map((t) => [t, 0]));
  for (const climate of KNOWN) {
    for (const season of Object.values(SEASONS)) {
      const law = birthLaw(climate, season);
      if (law) for (const t of PRIORITY) c[t] = Math.max(c[t], law.weight[t]);
    }
  }
  for (const t of PRIORITY) c[t] *= maxDiurnal(t);
  return (_ceilings = Object.freeze(c));
}
/** The widest a type's disc can be at full growth (its rings unthinned). */
export const maxRadius = (type) => SYSTEM_TYPES[type].core[1] * Math.sqrt(1 + SYSTEM_TYPES[type].rings.reduce((s, [, share]) => s + share, 0));

// ---- the wind ------------------------------------------------------

/** The wind's spatial scale: its heading turns over a few hundred km. */
export const WIND_SCALE_M = 240000;
const WIND_TERMS = Object.freeze([
  // [share of the speed, the heading's base (radians), its swing over the land, its turn (radians per game minute)]
  [0.5, 0, 1.2, 0],                                 // the prevailing westerly, bent by the land
  [0.3, 0, Math.PI * 2, (Math.PI * 2) / 7200],      // a backing term (x east, z north: a positive turn is anticlockwise), round every five days
  [0.2, 0, Math.PI * 2, -(Math.PI * 2) / 3312],     // a veering term, round every 2.3 days
]);

/** Smooth value noise over the plane, in [0, 1). */
function valueNoise(x, z, salt) {
  const gx = Math.floor(x), gz = Math.floor(z);
  const fx = x - gx, fz = z - gz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const at = (i, j) => seededRng((Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(salt, 0x9e3779b1) ^ WORLD_SEED) >>> 0)();
  const a = at(gx, gz), b = at(gx + 1, gz), c = at(gx, gz + 1), d = at(gx + 1, gz + 1);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sz;
}
/** The wind terms' headings at a place (radians at minute 0). */
function headings(x, z) {
  const nx = x / WIND_SCALE_M, nz = z / WIND_SCALE_M;
  return WIND_TERMS.map(([, base, swing], i) => base + swing * (valueNoise(nx, nz, 11 + i) - 0.5));
}
/** The wind at a place and minute, [vx, vz] as shares of full speed
 *  (magnitude at most 1). */
export function windAt(x, z, minutes) {
  const h = headings(x, z);
  let vx = 0, vz = 0;
  WIND_TERMS.forEach(([share, , , turn], i) => { const a = h[i] + turn * minutes; vx += share * Math.cos(a); vz += share * Math.sin(a); });
  return [vx, vz];
}
/** How far a system born at (x, z) at minute t0 has ridden by minute t,
 *  in wind shares x minutes - the wind read at its birthplace (it turns
 *  over hundreds of km; a system rides tens), integrated closed form. */
export function windPath(x, z, t0, t) {
  const h = headings(x, z);
  let dx = 0, dz = 0;
  WIND_TERMS.forEach(([share, , , turn], i) => {
    if (turn === 0) { dx += share * Math.cos(h[i]) * (t - t0); dz += share * Math.sin(h[i]) * (t - t0); return; }
    const a0 = h[i] + turn * t0, a1 = h[i] + turn * t;
    dx += (share * (Math.sin(a1) - Math.sin(a0))) / turn;
    dz += (share * (Math.cos(a0) - Math.cos(a1))) / turn;
  });
  return [dx, dz];
}

// ---- the systems ---------------------------------------------------

/** The climate under a field position; off the map, the climate at the
 *  nearest pixel of its edge (WEATHER3g: the map's edge is land to the
 *  north and east, and a system born past it rides tens of kilometres in
 *  - read as the sea, it carried the sea's weather onto the mountains). */
function climateOfField(climateAt, x, z) {
  const p = pixelOfField(x, z);
  return climateAt(Math.min(MAX_MAP_PIXEL_X - 1, Math.max(0, p.x)), Math.min(MAX_MAP_PIXEL_Y - 1, Math.max(0, p.y)));
}

/** A Poisson draw by Knuth's product, a mean over POISSON_CHUNK taken as
 *  a sum of chunks (a sum of Poissons is Poisson; the product's limit
 *  e^-lambda underflows past ~745). */
const POISSON_CHUNK = 30;
function poisson(lambda, r) {
  let k = 0;
  for (; lambda > POISSON_CHUNK; lambda -= POISSON_CHUNK) k += poisson(POISSON_CHUNK, r);
  const limit = Math.exp(-lambda);
  let p = r();
  while (p > limit) { k++; p *= r(); }
  return k;
}

/** The births of `type` in node (gx, gz, gt) of its own lattice: the kept
 * candidates, each { type, id, bornX, bornZ, bornAt, life, core, rings } -
 * `core` its core radius at full growth, `rings` as the birth law made
 * them where and when it was born. Pure over climateAt. */
export function birthsIn(type, gx, gz, gt, climateAt) {
  return memoised(`${type}:${gx}:${gz}:${gt}`, climateAt, () => drawBirths(type, gx, gz, gt, climateAt));
}
/** The cells a front throws over its life (WEATHER3g), each { type, id,
 *  front, ox, oz, bornX, bornZ, bornAt, life, core, rings } - (ox, oz) its
 *  place in the front's frame, where it stays. [] for a type with no
 *  cells. Pure over climateAt. */
export function cellsOf(front, climateAt) {
  if (!CELL_OF[front.type]) return [];
  return memoised(`cells:${front.id}`, climateAt, () => drawCells(front, climateAt));
}
function memoised(key, climateAt, draw) {
  let memo = _births.get(climateAt);
  if (!memo) _births.set(climateAt, memo = new Map());
  let out = memo.get(key);
  if (out) return out;
  // a node's births are a pure function of it, so dropping them costs only the redraw - and the OLDEST quarter goes
  // (insertion order: the nodes the clock has left behind), never the whole cache at once (AUDIT WEATHER3 R2c: a
  // whole-bay read is ~12,500 keys, and a wholesale clear under it cost the next read the bay again, cold)
  if (memo.size >= BIRTHS_MEMO) { let drop = BIRTHS_MEMO >> 2; for (const k of memo.keys()) { memo.delete(k); if (--drop <= 0) break; } }
  memo.set(key, out = Object.freeze(draw()));
  return out;
}
/** The births cache, per climate lookup (a host's lookup is one function
 *  for the session; a test's each its own). */
let _births = new WeakMap();
export const BIRTHS_MEMO = 40000;

function drawBirths(type, gx, gz, gt, climateAt) {
  const ceiling = ceilings()[type];
  if (!(ceiling > 0) || SYSTEM_TYPES[type].parent) return [];   // a cell type is born in its fronts (cellsOf), not on a lattice
  const r = seededRng((Math.imul(gx, 73856093) ^ Math.imul(gz, 19349663) ^ Math.imul(gt, 83492791) ^ Math.imul(TYPE_SALT[type], 2971215073) ^ WORLD_SEED) >>> 0);
  const n = poisson(ceiling, r);
  const spec = SYSTEM_TYPES[type];
  const [nodeM, nodeMinutes] = spec.node;
  const out = [];
  for (let i = 0; i < n; i++) {
    // every draw is taken whether or not the candidate is kept, so one
    // candidate's fate never moves another's
    const bornX = (gx + r()) * nodeM, bornZ = (gz + r()) * nodeM, bornAt = (gt + r()) * nodeMinutes;
    const keep = r(), rc = r(), rl = r();
    const season = seasonValue(dateFromClassicMinutes(bornAt));
    const law = birthLaw(climateOfField(climateAt, bornX, bornZ), season);
    const hour = (((bornAt % 1440) + 1440) % 1440) / 60;
    if (!law || keep * ceiling >= law.weight[type] * diurnal(type, hour, season)) continue;
    out.push(Object.freeze({
      type, id: `${type}:${gx}:${gz}:${gt}:${i}`, bornX, bornZ, bornAt,
      core: spec.core[0] + rc * (spec.core[1] - spec.core[0]),
      life: spec.life[0] + rl * (spec.life[1] - spec.life[0]),
      rings: law.rings[type],
    }));
  }
  return out;
}

/**
 * A front's cells: candidates at the cell type's ceiling rate over the
 * front's core at FULL growth widened by a cell's largest radius, from a
 * cell's longest life BEFORE the front's birth to its death, each kept by
 * the birth law at its own birthplace, season and hour (a front drifting
 * over a desert grows no storms there). A cell paints only inside its
 * front's core as it is now, and only while the front lives - so every
 * point of the core, rim or heart, a newborn front or an old one, has
 * cells over it at the one steady rate: the Cox law's `c`, exactly (a
 * front whose cells only began at its birth would be born with too few).
 * Every draw is taken whether or not a candidate is kept.
 */
function drawCells(front, climateAt) {
  const type = CELL_OF[front.type];
  const ceiling = ceilings()[type];
  if (!(ceiling > 0)) return [];
  const fspec = SYSTEM_TYPES[front.type], spec = SYSTEM_TYPES[type];
  let h = 0x811c9dc5;
  for (let i = 0; i < front.id.length; i++) h = Math.imul(h ^ front.id.charCodeAt(i), 0x01000193);
  const r = seededRng((h ^ Math.imul(TYPE_SALT[type], 2971215073) ^ WORLD_SEED) >>> 0);
  const reach = front.core + spec.core[1], lead = spec.life[1];
  const n = poisson(ceiling * Math.PI * reach * reach * (lead + front.life), r);
  const out = [];
  for (let i = 0; i < n; i++) {
    const bornAt = front.bornAt - lead + r() * (lead + front.life), rad = reach * Math.sqrt(r()), ang = r() * Math.PI * 2;
    const keep = r(), rc = r(), rl = r();
    const ox = rad * Math.cos(ang), oz = rad * Math.sin(ang);
    const [px, pz] = windPath(front.bornX, front.bornZ, front.bornAt, bornAt);
    const bornX = front.bornX + px * fspec.speed + ox, bornZ = front.bornZ + pz * fspec.speed + oz;
    const season = seasonValue(dateFromClassicMinutes(bornAt));
    const law = birthLaw(climateOfField(climateAt, bornX, bornZ), season);
    const hour = (((bornAt % 1440) + 1440) % 1440) / 60;
    if (!law || keep * ceiling >= law.weight[type] * diurnal(type, hour, season)) continue;
    out.push(Object.freeze({
      type, id: `${front.id}/${i}`, front, ox, oz, bornX, bornZ, bornAt,
      core: spec.core[0] + rc * (spec.core[1] - spec.core[0]),
      life: spec.life[0] + rl * (spec.life[1] - spec.life[0]),
      rings: law.rings[type],
    }));
  }
  return out;
}

/** Where a born system stands at `minutes` (alive or not): its birthplace
 *  ridden on the wind - a cell, its front's place plus its own offset. */
function placeAt(b, minutes) {
  const host = b.front ?? b, speed = SYSTEM_TYPES[host.type].speed;
  const [px, pz] = windPath(host.bornX, host.bornZ, host.bornAt, minutes);
  return [host.bornX + px * speed + (b.ox ?? 0), host.bornZ + pz * speed + (b.oz ?? 0)];
}

/** A born system at `minutes`: null before its birth or after its death,
 * else where it stands, its envelope, and its BANDS now - [outer radius,
 * word], core out - with `r` the whole disc's radius, and `clip` (a cell's)
 * the disc [x, z, r] it paints within, else null. */
export function systemAt(b, minutes) {
  const age = minutes - b.bornAt;
  if (age < 0 || age >= b.life) return null;
  const spec = SYSTEM_TYPES[b.type];
  const env = envelope(spec, age / b.life);
  const [x, z] = placeAt(b, minutes);
  const core = b.core * radiusShare(env);
  let clip = null;
  if (b.front) {
    // a cell paints only inside its front's core as the core is now, and dies with its front
    const fAge = minutes - b.front.bornAt;
    if (fAge < 0 || fAge >= b.front.life) return null;
    const [fx, fz] = placeAt(b.front, minutes);
    clip = [fx, fz, b.front.core * radiusShare(envelope(SYSTEM_TYPES[b.front.type], fAge / b.front.life))];
    if (Math.hypot(x - fx, z - fz) >= clip[2] + core) return null;   // wholly outside it: nowhere to paint
  }
  const bands = [[core, b.type]];
  let area = 1;
  for (const [word, share] of b.rings) {
    if (!(share > 0)) continue;
    area += share;
    bands.push([core * Math.sqrt(area), word]);
  }
  return { ...b, age, env, bands, x, z, r: bands[bands.length - 1][0], clip };
}

/** Every system alive at `minutes` whose disc comes within `range` of
 *  (x, z), nearest centre first, each with its distance `d`. */
export function systemsNear(x, z, minutes, climateAt, range = 0) {
  const out = [];
  const take = (b) => {
    const s = systemAt(b, minutes);
    if (!s) return;
    const d = Math.hypot(s.x - x, s.z - z);
    if (d - s.r <= range) out.push({ ...s, d });
  };
  for (const type of PRIORITY) {
    const spec = SYSTEM_TYPES[type];
    if (spec.parent) continue;   // cells are found through their fronts
    const cell = CELL_OF[type] && SYSTEM_TYPES[CELL_OF[type]];
    // a cell lives only while its front does, within the front's core at full growth widened by its own radius
    const lives = spec.life[1];
    const reach = Math.max(maxRadius(type), cell ? spec.core[1] + 2 * cell.core[1] : 0) + spec.speed * lives + range;   // the furthest a birth can sit from a disc that touches the range
    const [nodeM, nodeMinutes] = spec.node;
    const gx0 = Math.floor((x - reach) / nodeM), gx1 = Math.floor((x + reach) / nodeM);
    const gz0 = Math.floor((z - reach) / nodeM), gz1 = Math.floor((z + reach) / nodeM);
    const gt0 = Math.floor((minutes - lives) / nodeMinutes), gt1 = Math.floor(minutes / nodeMinutes);
    for (let gt = gt0; gt <= gt1; gt++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          for (const b of birthsIn(type, gx, gz, gt, climateAt)) {
            take(b);
            if (!cell || minutes < b.bornAt || minutes >= b.bornAt + b.life) continue;
            const [fx, fz] = placeAt(b, minutes);
            if (Math.hypot(fx - x, fz - z) - (b.core + 2 * cell.core[1]) > range) continue;
            for (const c of cellsOf(b, climateAt)) take(c);
          }
        }
      }
    }
  }
  return out.sort((a, b) => a.d - b.d);
}

/** The band of a system over a point `d` from its centre: its word and
 *  its intensity (the envelope, falling from the centre to the disc's
 *  edge), or null outside the disc. */
export function bandAt(s, d) {
  if (!(d < s.r)) return null;
  const band = s.bands.find(([outer]) => d < outer);
  const f = d / s.r;
  return band ? { word: band[1], intensity: s.env * (1 - 0.8 * f * f) } : null;
}

/** Whether (x, z) is within a system's `clip` (a cell's front core now);
 *  always, for a system with none. */
export const insideClip = (s, x, z) => !s.clip || Math.hypot(s.clip[0] - x, s.clip[1] - z) < s.clip[2];

/**
 * THE WORN WORD AMONG SYSTEMS already found (each standing where it is
 * this minute): the highest-priority word any of them paints over (x, z)
 * - 'sunny', clear air, where none does - with the strongest intensity
 * that word has there (0 in clear air) and the system that paints it.
 * `ground(word, x, z)` (optional) is the ground law a word goes through
 * before priority (WEATHER2a: rain over snow ground is snow). One
 * resolution for every reader: `weatherAt` below, and the sim's sample,
 * which finds its systems once a minute and resolves every frame.
 */
export function wornAmong(systems, x, z, ground = null) {
  let best = null;
  for (const s of systems) {
    if (!insideClip(s, x, z)) continue;
    const band = bandAt(s, Math.hypot(s.x - x, s.z - z));
    if (!band) continue;
    const word = ground ? ground(band.word, x, z) : band.word;
    if (!best || RANK[word] < RANK[best.word] || (word === best.word && band.intensity > best.intensity)) best = { word, intensity: band.intensity, system: s };
  }
  return best ?? { word: 'sunny', intensity: 0, system: null };
}

/**
 * THE WEATHER AT A PLACE AND A MINUTE: `wornAmong` over every system
 * standing there. `ground(word, x, z, minutes)` as above.
 */
export function weatherAt(x, z, minutes, climateAt, { ground = null } = {}) {
  return wornAmong(systemsNear(x, z, minutes, climateAt, 0), x, z, ground && ((w, gx, gz) => ground(w, gx, gz, minutes)));
}

// ---- the sky (WEATHER3c) ---------------------------------------------

/** How much each word's cloud matters to the eye, for the few slots the
 *  sky has: a storm's tower first, a fog bank's low smear last but one,
 *  a fair-weather field last. */
export const SKY_WEIGHT = Object.freeze({ thunder: 1, sandstorm: 0.95, rain: 0.9, snow: 0.85, overcast: 0.7, fog: 0.6, cloudy: 0.5 });

/**
 * THE SKY'S CELLS: every system's bands as nested discs - the skirt's
 * disc, the ring's inside it, the core's inside that - each
 * `{ x, z, r, word, imp, rank, id }` in field metres. `imp` is how much
 * it matters from (x, z): its word's weight times the angle it fills (a
 * disc the point is inside counts double, so the sky overhead is never
 * the one dropped); `rank` its word's priority, so the renderer draws
 * the lowest first and the storm's heart last - the overlap blend then
 * agrees with the worn word. `ground(word, cx, cz)` (optional) is the
 * ground law at the CELL (WEATHER2a: a storm over snow ground is a snow
 * cloud there as well as at the player).
 */
export function skyCells(systems, x, z, ground = null) {
  const out = [];
  for (const s of systems) {
    const d = Math.hypot(s.x - x, s.z - z);
    for (const [r, raw] of s.bands) {
      const word = ground ? ground(raw, s.x, s.z) : raw;
      const imp = (SKY_WEIGHT[word] ?? 0.5) * (d <= r ? 2 : r / d);
      out.push({ x: s.x, z: s.z, r, word, imp, rank: RANK[word] ?? PRIORITY.length, id: `${s.id}:${raw}`, d, clip: s.clip ?? null });
    }
  }
  return out;
}

/** How far out a storm's wind is felt ahead of its edge (field metres). */
export const APPROACH_M = 15000;
/**
 * THE WIND OF WHAT IS COMING: the strongest violence (wind.js VIOLENCE,
 * the front's own scale) any system near (x, z) brings - its core
 * type's, at its envelope - falling from its disc's edge to nothing
 * APPROACH_M beyond it. The wind rises as a storm draws near, before a
 * drop falls, and dies as it passes: a continuous term under the fronts,
 * whose rolls stay theirs.
 */
export function approachAt(systems, x, z) {
  let best = 0;
  for (const s of systems) {
    const gap = Math.max(0, Math.hypot(s.x - x, s.z - z) - s.r);
    if (gap >= APPROACH_M) continue;
    const v = (VIOLENCE[s.type] ?? 0) * s.env * (1 - gap / APPROACH_M);
    if (v > best) best = v;
  }
  return best;
}

/**
 * THE FORECAST: the weather at the place every `step` minutes for the
 * next `hours`, and the first minute it becomes something else.
 * Answers { at, now, steps: [{ at, word, intensity }], next: { at, word } | null } - `at` the
 * minute it was read from.
 */
export function forecastAt(x, z, minutes, climateAt, { hours = 12, step = 15, ground = null } = {}) {
  const now = weatherAt(x, z, minutes, climateAt, { ground });
  const steps = [];
  let next = null;
  for (let at = minutes + step; at <= minutes + hours * 60; at += step) {
    const w = weatherAt(x, z, at, climateAt, { ground });
    steps.push({ at, word: w.word, intensity: w.intensity });
    if (!next && w.word !== now.word) next = { at, word: w.word };
  }
  return { at: minutes, now, steps, next };
}

/** Test seam: forget the solved weights and ceilings. */
export function resetWeatherMap() { _laws.clear(); _exposure.clear(); _ceilings = null; _births = new WeakMap(); }
