// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TV7 - THE ROAMING BANDS (bible/06-Systems/Travel-View.md, THE OVERHAUL).
//
// Mac (2026-09-28): "think mount and blade and how you can see enemies in the overworld. Like a true overhaul for the
// new overworld"; his calls "Roaming parties" and "Shared per area". Enemy bands roam the wilderness and are seen from
// the Overworld; one that SPOTS the traveller CHASES; one that reaches them stands as the real foes it was.
//
// SHARED WITH NOTHING SENT: a band is BORN of the land and the shared clock - a pure function of (a cell of map pixels,
// a life's bucket of shared milliseconds) and BAND_SEED, as TV4's storms are of the weather's - so every player in an
// area computes the same bands, where they are and where they wander, and nobody tells anybody. What the band IS (its
// members) is Daggerfall's own tables, rolled from the band's own seed by the host (campEncounters rollGroupComposition,
// the climate x day/night table - none in a town's rect by day); where it wanders is a seeded walk that turns back off
// water and out of towns (the host's `ok`). Only a CHASE is one player's (the chased one simulates it).
//
// PURE: the host hands the clock, the land's test and the traveller's feet; everything here is arithmetic.
// ═══════════════════════════════════════════════════════════════════
import { seededRng } from '../wind/wind.js';
import { NATIVE_PER_M } from './travelDungeons.js';   // one home: native units a metre
import { worldPixelOk } from '../../net/wire.js';   // ETHER-OW: a chaser's place is a pixel of the world (TV-BEYOND's law)

/** The band's world: a cell of this many map pixels square has one chance of a band a life. */
export const BAND_CELL_PX = 2;
/** A band's life, real milliseconds on the shared clock - born at its bucket's start, gone at its end. */
export const BAND_LIFE_MS = 12 * 60 * 1000;
/** The chance a cell holds a band in a life (by day, by night). OW6 (2026-09-29, the player: "Enemies should spawn in
 *  varying numbers and roam more often"): half as many again by day, a third more by night - 0.3 and 0.45 left a
 *  league of empty road between most bands. */
export const BAND_CHANCE_DAY = 0.75;   // was 0.45: a band in three cells of four, so the nearest one is about a quarter nearer
export const BAND_CHANCE_NIGHT = 0.9;   // was 0.6
/** A wandering band's pace (m/s) and how long it keeps one heading (ms). OW6: a brisk walk, turning oftener - from the
 *  Overworld's height (150-450 m up) a band at 1.3 m/s on 75 s legs read as one standing still. */
export const BAND_WANDER_MPS = 2;
export const BAND_LEG_MS = 50 * 1000;
/** OW6: HOW MANY a band is - its own roll, sizes 1 to 6 in order by these weights: a lone beast (a solitary kind may be
 *  one - campEncounters rollGroupComposition), most of them three or so, now and then a warband of six. */
export const BAND_SIZE_WEIGHTS = Object.freeze([12, 20, 24, 20, 14, 10]);
/** OW6: online, the level a band's tables are read at - its own (bandLevelOf), 1 to this. */
export const BAND_LEVEL_MAX = 20;
/** How far a band sees a traveller (m), by day and by night. */
export const BAND_SIGHT_DAY_M = 320;
export const BAND_SIGHT_NIGHT_M = 190;
/** A chasing band's pace (m/s): a runner's - a slow walker is caught; a quick one, a runner or a rider gets away. */
export const BAND_CHASE_MPS = 5.2;
/** A chase given up past this far (m), or after this long without closing (ms). */
export const BAND_LEASH_M = 900;
export const BAND_GIVE_UP_MS = 120 * 1000;
/** Contact (m): under the Overworld the band must reach the traveller; with the view down it stands as foes this near. */
export const BAND_CONTACT_M = 30;
export const BAND_STAND_M = 140;
/** AUDIT OW5b B2: the nearest a band's anchor stands to the traveller (m) - its members, a pack's spacing about it, never
 *  on top of them. A band stands where it IS, this or farther. */
export const BAND_STAND_MIN_M = 18;
/** AUDIT OW3 T7-1: a contact whose band finds no ground to stand on (the road, a town's rect, a full foe pool) tries again
 *  this often (ms), this many times, before the band is lost - never spent unstood on the first refusal. */
export const BAND_STAND_RETRY_MS = 1500;
export const BAND_STAND_TRIES = 5;
/** The bands the host is asked about: the cells within this many map pixels of the traveller. */
export const BAND_REACH_PX = 6;
const PIXEL_NATIVE = 32768;
/** The bands' own salt - a band is never a storm. */
const BAND_SEED = 0x42414e44;   // 'BAND'

/** A cell's life's seed. */
const seedOf = (cx, cy, life) => (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ Math.imul(life, 83492791) ^ BAND_SEED) >>> 0;

/**
 * THE BAND a cell holds in a life, or null: `{ id, cx, cy, life, seed, born: {x, z} (native), bornMs }`. `night` is
 * whether the life is a night's (the host's clock, read at the life's middle - AUDIT TIME); `ok(x, z)` the land's test (not water, not a town's rect).
 * @param {{ cx: number, cy: number, life: number, night: boolean, ok: (x: number, z: number) => boolean }} q
 */
export function bandOf({ cx, cy, life, night, ok }) {
  const seed = seedOf(cx, cy, life);
  const r = seededRng(seed);
  if (r() >= (night ? BAND_CHANCE_NIGHT : BAND_CHANCE_DAY)) return null;
  const span = BAND_CELL_PX * PIXEL_NATIVE;
  const x = cx * span + r() * span, z = cy * span + r() * span;
  if (!ok(x, z)) return null;   // born in the water or a town: no band this life
  return { id: `b${cx}.${cy}.${life}`, cx, cy, life, seed, night, born: { x, z }, bornMs: life * BAND_LIFE_MS };
}

/** AUDIT OW3 T7-4: the seed a band's MAKE is rolled from - its own stream, never the birth's (whose first draw is under
 *  the spawn chance by construction, so the table's d100 could never pass 45 and its > 80 picks never came). */
export const bandMakeSeed = (band) => (band.seed ^ 0x4d414b45) >>> 0;   // 'MAKE'

/** OW6: how many a band is (1..BAND_SIZE_WEIGHTS.length), off its own stream - the same number for every player. */
export function bandSizeOf(band) {
  const total = BAND_SIZE_WEIGHTS.reduce((a, w) => a + w, 0);
  let x = seededRng((band.seed ^ 0x53495a45) >>> 0)() * total;   // 'SIZE'
  for (let i = 0; i < BAND_SIZE_WEIGHTS.length; i++) { x -= BAND_SIZE_WEIGHTS[i]; if (x < 0) return i + 1; }
  return BAND_SIZE_WEIGHTS.length;
}

/** OW6 - THE BAND'S OWN LEVEL, online: the level its tables are read at, a function of its seed alone, so every player
 *  sees the same band - the same kind, the same number. It was each viewer's own level, and two players looking at one
 *  band read different creatures over it. Skewed low, 1 + floor(20 u^2): half of all bands level 6 or under, a quarter
 *  12 or over - most a traveller can face, some to run from, and the label says which. (Offline there is one player,
 *  and the band reads theirs.) */
export function bandLevelOf(band) {
  const u = seededRng((band.seed ^ 0x4c45564c) >>> 0)();   // 'LEVL'
  return 1 + Math.floor(BAND_LEVEL_MAX * u * u);
}

/**
 * WHERE A WANDERING BAND IS at shared time `ms` (native `{x, z}`, and its heading): leg by leg from its birth, each leg a
 * seeded heading at BAND_WANDER_MPS; a leg whose end fails `ok` turns back the way it came.
 * @param {any} band
 * @param {number} ms
 * @param {(x: number, z: number) => boolean} ok
 */
export function wanderAt(band, ms, ok) {
  const r = seededRng((band.seed ^ 0x5157) >>> 0);
  let x = band.born.x, z = band.born.z, heading = r() * Math.PI * 2;
  let t = Math.max(0, Math.min(BAND_LIFE_MS, ms - band.bornMs));
  const legNative = (dt) => (BAND_WANDER_MPS * dt / 1000) * NATIVE_PER_M;
  const full = legNative(BAND_LEG_MS);
  while (t > 0) {
    const dt = Math.min(t, BAND_LEG_MS);
    const d = legNative(dt);
    // AUDIT OW3 T7-6: a leg's way is chosen by its WHOLE end, whatever part of it is walked - so a leg part-walked never
    // flips mid-way (a band that jumped eighty metres in a quarter second beside the water)
    let go = ok(x + Math.sin(heading) * full, z + Math.cos(heading) * full);
    if (!go) { heading += Math.PI; go = ok(x + Math.sin(heading) * full, z + Math.cos(heading) * full); }
    if (go) { x += Math.sin(heading) * d; z += Math.cos(heading) * d; }
    t -= dt;
    if (dt === BAND_LEG_MS) heading += (r() - 0.5) * Math.PI;   // the next leg bends up to a quarter turn either way
  }
  return { x, z, heading };
}

/** AUDIT OW4 B1: THE BANDS' PIXEL of a MAP pixel - the bands' cells run on native z (a cell's row is z / 32768 / CELL),
 *  the map's y runs the other way (499 - that; mapsFile worldCoordToMapPixel). The host handed the map's y straight in,
 *  and every band stood at the mirror of its latitude across row 249.5 - two hundred kilometres off, nobody ever met one. */
export const bandPixelOf = (mapPixel) => ({ x: mapPixel.x, y: 499 - mapPixel.y });

/**
 * THE BANDS about the traveller's pixel at shared time `ms` (`at` in the bands' own convention - bandPixelOf): every
 * cell within BAND_REACH_PX, this life's band in it.
 * @param {{ at: {x:number,y:number}, ms: number, night: boolean, ok: (x:number, z:number) => boolean, reach?: number }} q
 */
export function bandsNear({ at, ms, night, ok, reach = BAND_REACH_PX }) {
  const life = Math.floor(ms / BAND_LIFE_MS);
  const c0x = Math.floor((at.x - reach) / BAND_CELL_PX), c1x = Math.floor((at.x + reach) / BAND_CELL_PX);
  const c0y = Math.floor((at.y - reach) / BAND_CELL_PX), c1y = Math.floor((at.y + reach) / BAND_CELL_PX);
  const out = [];
  for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
    const b = bandOf({ cx, cy, life, night, ok });
    if (b) out.push(b);
  }
  return out;
}

/** How far a band sees: shorter by night. */
export const bandSight = (night) => (night ? BAND_SIGHT_NIGHT_M : BAND_SIGHT_DAY_M);

/**
 * ONE STEP OF A CHASE (`dt` real seconds, `scale` the journey's time scale - a band on the map keeps the map's pace):
 * the band closes on the feet at BAND_CHASE_MPS. Returns the new position, its nearest and when it last closed, and what
 * happened: 'contact' (within `contact` metres), 'lost' (past the leash, or BAND_GIVE_UP_MS without closing a metre),
 * or null (still running).
 * AUDIT OW5b B5: it closes to the contact's ring and NO NEARER - where it stands is the side it came from. A step was
 * the whole way when it could be, and a band on the traveller's own feet had no bearing at all: the one read there was
 * float noise (a fast frame head-on, or a band riding along through a won roll's grace), and it stood anywhere.
 * @param {{ pos: {x:number,z:number}, feet: {x:number,z:number}, dt: number, scale?: number, contact: number,
 *   gainAt: number, now: number, best: number }} q  `best` its nearest yet (m), `gainAt` when it last came a metre nearer
 *   (`now` and `gainAt` on the chase's own clock - the host's, which a hold does not run)
 */
export function bandChaseStep({ pos, feet, dt, scale = 1, contact, gainAt, now, best }) {
  const dx = feet.x - pos.x, dz = feet.z - pos.z;
  const dist = Math.hypot(dx, dz) / NATIVE_PER_M;   // metres
  const step = Math.min(Math.max(0, dist - contact), BAND_CHASE_MPS * dt * Math.max(1, scale));
  const k = dist > 1e-6 ? (step / dist) : 0;
  const np = { x: pos.x + dx * k, z: pos.z + dz * k };
  const left = dist - step;
  // AUDIT OW3 T7-3: closing is a METRE nearer than the nearest yet, and the clock runs from the last one - a band gaining
  // a few centimetres a frame closed on nobody (the nearest was the last frame's) and gave every chase up at two minutes
  const gained = left < best - 1;
  const closer = gained ? left : best, at = gained ? now : gainAt;
  if (left <= contact) return { pos: np, dist: left, best: closer, gainAt: at, what: 'contact' };
  if (left > BAND_LEASH_M || now - at > BAND_GIVE_UP_MS) return { pos: np, dist: left, best: closer, gainAt: at, what: 'lost' };
  return { pos: np, dist: left, best: closer, gainAt: at, what: null };
}

/** A band's words over its marker: its kind and its number ("Orc, 4") - OW6: one alone, its kind alone ("Giant"). */
export function bandLabel(kindName, n) {
  const k = String(kindName ?? '').trim();
  if (n === 1) return k || 'A lone foe';
  return k ? `${k}, ${n}` : `A band, ${n}`;
}

// ── TV7b - THE CHASE, SHARED ─────────────────────────────────────────────────────────────────────────────────────────
// A band is the same for everyone without a word; its CHASE is the chased player's. The chaser's client says so in its
// own foes frame under `bd` (as the World of Daggerfall camps' `st`/`sp` ride - validated here, at the reader, never by
// the relay, which reads a frame's record count and nothing else: no relay change): each band it chases with where it
// is, and each band that fought or lost the trail, so every reader shows the chase and none stands that band again.

/** A band's id on the wire: `b<cx>.<cy>.<life>`. */
export const BAND_ID_RE = /^b-?\d{1,4}\.-?\d{1,4}\.\d{1,9}$/;
/** The most bands one frame may name. */
export const BANDS_WIRE_MAX = 8;
/** A chase word heard is believed this long (ms) - a frame every FOES_MS, so a chaser that stopped saying so is gone. */
export const BAND_WORD_MS = 3000;
/** A chaser's place is a point of the world: its pixel (floored - MapsFile's rows counted south, 499 - z's) a pixel the wire
 *  carries (net/wire.js worldPixelOk, TV-BEYOND's law). ETHER-OW (2026-10-13): it was the Bay's 1000 x 500 alone - and
 *  the bands and raiders are born on the Eltheric Ocean's box too (scenes/world.js bandOk, tvRaidOpen), so every chase
 *  said there was thrown out by the peers who heard it. */
const chaserPlaceOk = (x, z) => Number.isInteger(x) && Number.isInteger(z) && worldPixelOk(Math.floor(x / PIXEL_NATIVE)) && worldPixelOk(499 - Math.floor(z / PIXEL_NATIVE));

/**
 * A CHASE WORD - the band word I say, and OW6's raiders' (systems/seaRaiders.js), one law for any chaser: `[[id, x, z,
 * 1], ...]` for each chase of me (the chaser's place, native, whole units), then `[[id, 0, 0, 2], ...]` for each spent
 * here (fought or lost), newest first - at most BANDS_WIRE_MAX in all.
 * @param {Map<string, {pos: {x:number, z:number}}>} chases
 * @param {string[]} spent
 */
export function chaseWordOf(chases, spent) {
  const out = [];
  for (const [id, c] of chases ?? []) { if (out.length >= BANDS_WIRE_MAX) break; out.push([id, Math.round(c.pos.x), Math.round(c.pos.z), 1]); }
  for (const id of spent ?? []) { if (out.length >= BANDS_WIRE_MAX) break; out.push([id, 0, 0, 2]); }
  return out;
}

/** The band word I say (TV7b). */
export const bandWordOf = (chases, spent) => chaseWordOf(chases, spent);

/** A chase word heard, projected: the valid entries - ids of `idRe`'s own kind - each chaser once, at most BANDS_WIRE_MAX.
 * @param {unknown} raw @param {RegExp} idRe */
export function validChaseWord(raw, idRe) {
  if (!Array.isArray(raw)) return [];
  const out = [], seen = new Set();
  for (const e of raw) {
    if (out.length >= BANDS_WIRE_MAX) break;
    if (!Array.isArray(e) || e.length !== 4) continue;
    const [id, x, z, flag] = e;
    if (typeof id !== 'string' || !idRe.test(id) || seen.has(id)) continue;
    if (flag !== 1 && flag !== 2) continue;
    if (flag === 1 && !chaserPlaceOk(x, z)) continue;
    seen.add(id);
    out.push([id, flag === 1 ? x : 0, flag === 1 ? z : 0, flag]);
  }
  return out;
}

/** A band word heard (TV7b), projected: the valid entries, each band once, at most BANDS_WIRE_MAX. */
export const validBandWord = (raw) => validChaseWord(raw, BAND_ID_RE);

/** AUDIT OW3 T7-9: a band id's life, and whether a word naming it can be about a band near me - this life's or the one
 *  just over, a cell within the reach about my pixel. A peer's word naming any other is nobody's band here: never kept,
 *  so what a peer says is bounded by what could be about me (a hostile one grew the tables a hundred ids a second). */
export const bandLifeOf = (id) => Number(String(id).slice(String(id).lastIndexOf('.') + 1));
export function bandNearMe(id, at, life) {
  const m = /^b(-?\d+)\.(-?\d+)\.(\d+)$/.exec(String(id));
  if (!m) return false;
  const l = Number(m[3]);
  if (l !== life && l !== life - 1) return false;
  const reach = BAND_REACH_PX + BAND_CELL_PX;
  return Math.abs(Number(m[1]) * BAND_CELL_PX - at.x) <= reach && Math.abs(Number(m[2]) * BAND_CELL_PX - at.y) <= reach;
}

/** Two players chasing one band (both saw it in the same breath): the lower id keeps it - every client answers alike. */
export const chaseYields = (mine, theirs) => String(theirs) < String(mine);
