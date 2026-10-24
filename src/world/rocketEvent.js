// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ROCKET1 — THE ROCKET: MOUNDS OF POOP, FARTING HORSES AND A DIARRHEA FRENZY OVER DAGGERFALL, FOR A LIVE EVENT.
//
// The ask (2026-10-23, the owner): "when I type /event rocket I want mounds to appear and shoot poop up from the ground
// and a horse to fart across the sky neighing and then smaller horses farting across the sky. At some point the poop
// subsides and daggerfall erupts into a giant diarrhea frenzy".
//
// EVENT1's door, a third word on it. A dev stages it (`/event rocket`, the relay's `stage` frame - net/wire.js
// LIVE_EVENTS), every player online sees it, and it ends when a dev ends it (`/event off`). This file is what it IS -
// its clock, its mounds, its horses, its farts and its words; render/rocketPass.js draws it and scenes/rocketHost.js
// wires it into the streaming world. The relay carries only the word.
//
// ONE CYCLE ON THE SHARED CLOCK (SUNBABY2's law). ROCKET_PHASES is read off the stage's own moment (the hub's `at`), so
// every player online is at the same second of it and a joiner comes in on it:
//   rise   - mounds push up out of the earth round every player
//   erupt  - they shoot poop into the sky; the GREAT HORSE gallops across the sky neighing and farting, then its FOALS
//   lull   - the poop subsides and the sky starts to brown
//   frenzy - Daggerfall erupts: every mound a geyser, a brown sky, poop falling everywhere, horses farting every way
//   ebb    - the frenzy passes and the mounds sink back - and the cycle starts again while the event stands
//
// THE MOUNDS ARE THE WORLD'S. They stand on a grid of the world's own coordinates (ROCKET_MOUND_CELL_M - the host hands
// in where the scene's origin is, so a recentre moves none of them), a cell's mound by its seed: two players standing
// together see the same mounds erupt in the same second.
//
// THE HORSES ARE THE SKY'S. A flight crosses the sky on its own bearings (seeded by the stage's moment and the cycle), at
// ROCKET_SKY_R from the eye - the star's law (render/starfall/starfallPass.js skyClamp): a sky thing goes where the eye
// goes - so every player sees the same horse cross the same quarter of the sky.
//
// DRAWN AND HEARD ONLY. Nothing is applied: no one is hurt, slowed or soiled by an event. The neigh is Daggerfall's own
// (DAGGER.SND AnimalHorse, pitched up for a foal); the farts are MADE (rocketFartSamples - Daggerfall has none), the
// splash a mound throws is DAGGER.SND's SplashLarge, pitched down.
//
// ONLINE ALONE, as the dread and the sun baby: offline there is no hub link, nothing sets the weight, and every path is
// untouched. Not a DFU member - DFU has no live events. Ledger A (ROCKET).
// ═══════════════════════════════════════════════════════════════════

import { seededRng } from '../systems/wind/wind.js';   // the draws (the dread's)
import { slotHash } from './dreadSky.js';   // one slot hash for every seed the shared clock reads
import { t } from '../systems/textManager.js';   // L10N4: every line through the text core

/** The live event this file is (net/wire.js LIVE_EVENTS). */
export const ROCKET_EVENT = 'rocket';
/** Real seconds the whole show takes to come up on a player watching it staged, and to go when it ends. */
export const ROCKET_FADE_S = 4;

// ── The cycle ─────────────────────────────────────────────────────
/** One cycle, from the stage's own moment: each phase and its real seconds. It wraps while the event stands. */
export const ROCKET_PHASES = Object.freeze([
  Object.freeze({ phase: 'rise', s: 6 }),
  Object.freeze({ phase: 'erupt', s: 54 }),
  Object.freeze({ phase: 'lull', s: 12 }),
  Object.freeze({ phase: 'frenzy', s: 45 }),
  Object.freeze({ phase: 'ebb', s: 8 }),
]);
/** A cycle's real seconds. */
export const ROCKET_CYCLE_S = ROCKET_PHASES.reduce((a, p) => a + p.s, 0);
/** Seconds the jets take to come up at the head of the eruption, and to die away at the head of the lull. */
export const ROCKET_JET_RAMP_S = 3;
export const ROCKET_SUBSIDE_S = 6;
/** Seconds before the frenzy the sky starts to brown, and how brown it is by then (the frenzy's weight). */
export const ROCKET_BROWN_S = 4;
export const ROCKET_BROWN_W = 0.3;
/** Seconds the frenzy takes to come whole. */
export const ROCKET_FRENZY_RAMP_S = 2;
/** How many times taller a mound's jet stands in the frenzy. */
export const ROCKET_FRENZY_JET = 2.6;

// ── The mounds ────────────────────────────────────────────────────
/** The world's grid the mounds stand on (metres), the share of its cells that hold one, and how far round the eye they
 *  are stood. */
export const ROCKET_MOUND_CELL_M = 22;
export const ROCKET_MOUND_CHANCE = 0.42;
export const ROCKET_MOUND_REACH_M = 150;
/** A mound's radius and height, metres (each its own, seeded, between these). */
export const ROCKET_MOUND_R_M = Object.freeze([1.6, 3.2]);
export const ROCKET_MOUND_H_M = Object.freeze([1.2, 2.4]);
/** A mound's jet: how high the poop flies at full strength (metres, each its own), and how many seconds one chunk's
 *  flight takes - the shader's fountain (render/rocketPass.js). */
export const ROCKET_JET_H_M = Object.freeze([10, 20]);
export const ROCKET_JET_FLIGHT_S = Object.freeze([2.2, 3.4]);
/** The chunks of poop one mound throws at once. */
export const ROCKET_JET_CHUNKS = 28;

// ── The horses ────────────────────────────────────────────────────
/** How far from the eye a horse flies (inside the far plane, 6000 m), and the sky it crosses: the azimuth's sweep
 *  (radians) and its height (degrees). */
export const ROCKET_SKY_R = 900;
export const ROCKET_HORSE_SWEEP = 2.6;
export const ROCKET_HORSE_ELEV_DEG = Object.freeze([16, 40]);
/** THE GREAT HORSE: when it sets out (seconds into the cycle), how long it takes to cross, and its length (metres at
 *  ROCKET_SKY_R). */
export const ROCKET_GREAT = Object.freeze({ at: 14, s: 16, len: 210 });
/** ITS FOALS: when the first sets out, how many, the seconds between them, a crossing, and a foal's length. */
export const ROCKET_FOALS = Object.freeze({ at: 30, n: 6, every: 2.2, s: 12, len: 75 });
/** THE FRENZY'S HERD: one sets out this often through the frenzy, each crossing in s[0]..s[1] seconds, len[0]..len[1]
 *  long - any bearing. */
export const ROCKET_HERD = Object.freeze({ every: 1.1, s: Object.freeze([8, 13]), len: Object.freeze([60, 180]) });
/** FATASS (the owner, 2026-10-23: "have it make all the horses go into fatass rendering mode"): every horse is drawn
 *  this many times a horse's depth through the barrel, on legs this share of a horse's - render/rocketPass.js. */
export const ROCKET_HORSE_GIRTH = 1.7;
export const ROCKET_HORSE_LEGS = 0.6;
/** Seconds between a horse's farts (the great horse's, a foal's, the herd's), each nudged by up to half again. */
export const ROCKET_FART_EVERY_S = Object.freeze({ great: 0.9, foal: 0.7, herd: 0.6 });
/** Seconds a fart's cloud hangs in the sky, and how many puffs one fart blows. */
export const ROCKET_PUFF_S = 3.5;
export const ROCKET_PUFFS = 3;
/** The horses' coats (bay, chestnut, white, black, palomino, grey) and the mane and tail each wears. */
export const ROCKET_COATS = Object.freeze([
  Object.freeze([0.45, 0.27, 0.13]),
  Object.freeze([0.66, 0.36, 0.16]),
  Object.freeze([0.93, 0.91, 0.87]),
  Object.freeze([0.16, 0.13, 0.11]),
  Object.freeze([0.88, 0.72, 0.42]),
  Object.freeze([0.58, 0.56, 0.54]),
]);
export const ROCKET_MANES = Object.freeze([
  Object.freeze([0.10, 0.07, 0.05]),
  Object.freeze([0.42, 0.20, 0.08]),
  Object.freeze([0.70, 0.66, 0.60]),
  Object.freeze([0.05, 0.04, 0.04]),
  Object.freeze([0.98, 0.94, 0.80]),
  Object.freeze([0.30, 0.29, 0.28]),
]);

// ── The colours (display space, 0..1) ─────────────────────────────
/** The poop: its body, its dark folds, its shine. */
export const ROCKET_POOP = Object.freeze([0.36, 0.22, 0.10]);
export const ROCKET_POOP_DARK = Object.freeze([0.19, 0.11, 0.05]);
export const ROCKET_POOP_SHINE = Object.freeze([0.66, 0.48, 0.30]);
/** A mound: its earth, and the poop crowning it. */
export const ROCKET_MOUND = Object.freeze([0.40, 0.28, 0.16]);
export const ROCKET_MOUND_TOP = Object.freeze([0.29, 0.17, 0.07]);
/** A fart's cloud: its heart, and its edge. */
export const ROCKET_GAS = Object.freeze([0.66, 0.70, 0.32]);
export const ROCKET_GAS_EDGE = Object.freeze([0.52, 0.46, 0.24]);
/** The frenzy's sky: overhead, at the horizon, and its churning swirls. */
export const ROCKET_FRENZY_ZENITH = Object.freeze([0.23, 0.13, 0.05]);
export const ROCKET_FRENZY_HORIZON = Object.freeze([0.56, 0.38, 0.18]);
export const ROCKET_FRENZY_SWIRL = Object.freeze([0.42, 0.26, 0.10]);
/** How much of the frenzy's brown washes over the whole picture at its height. */
export const ROCKET_WASH = 0.12;
/** The frenzy's falling poop: how many chunks round the eye at its height, over how wide a square (metres), from how
 *  high over the eye, and how fast they fall (metres a second). */
export const ROCKET_RAIN_N = 900;
export const ROCKET_RAIN_SPAN_M = 140;
export const ROCKET_RAIN_TOP_M = 60;
export const ROCKET_RAIN_SPEED = Object.freeze([14, 22]);

// ── The words ─────────────────────────────────────────────────────
/** The moments a line is said, seconds into the cycle - each phase's head, and the horses setting out. */
export const ROCKET_CUES = Object.freeze([
  Object.freeze({ cue: 'rise', at: 0 }),
  Object.freeze({ cue: 'erupt', at: 6 }),
  Object.freeze({ cue: 'great', at: ROCKET_GREAT.at }),
  Object.freeze({ cue: 'foals', at: ROCKET_FOALS.at }),
  Object.freeze({ cue: 'lull', at: 60 }),
  Object.freeze({ cue: 'frenzy', at: 72 }),
  Object.freeze({ cue: 'ebb', at: 117 }),
]);
/** What a player watching is told at each (WB13b's rules, World-Bosses.md section 20: the event, and stop; at most one
 *  exclamation). Read when said, so a player's language is the one they chose then. */
export const ROCKET_LINES = Object.freeze({
  rise: () => t('rocket.rise', 'The ground of Daggerfall rumbles. Mounds push up out of the earth.'),
  erupt: () => t('rocket.erupt', 'The mounds erupt and shoot poop into the sky!'),
  great: () => t('rocket.great', 'A great horse gallops across the sky, neighing and farting!'),
  foals: () => t('rocket.foals', 'Little horses follow it, farting all the way!'),
  lull: () => t('rocket.lull', 'The poop subsides. Daggerfall holds its breath.'),
  frenzy: () => t('rocket.frenzy', 'Daggerfall erupts into a giant diarrhea frenzy!'),
  ebb: () => t('rocket.ebb', 'The frenzy passes, and the mounds sink back into the earth.'),
});

const clamp01 = (x) => Math.max(0, Math.min(1, Number(x) || 0));
const smooth = (x) => { const k = clamp01(x); return k * k * (3 - 2 * k); };
const lerp = (a, b, k) => a + (b - a) * k;
/** One seed out of a few integers (slotHash folded over them). */
const seedOf = (...n) => n.reduce((h, v) => slotHash((h ^ (v | 0)) >>> 0), 0x70c4e7) >>> 0;
/** The stage's moment as the seeds read it - whole seconds, so a relay ms either side of a client's agrees. */
const stageSeed = (at) => (Number.isFinite(at) ? Math.floor(at / 1000) : 0);

/**
 * The event's weight on this client, 0..1 - SUNBABY1's createSunbaby, for this word. `set(ev, {live})` takes the hub's
 * word (net/online.js onEvent: `{kind, at}` or null); `tick(dtSeconds)` walks the weight toward it over ROCKET_FADE_S
 * (a welcome is whole at once). `cue(sinceS)` answers the line a player watching is owed at the cycle's second - the
 * newest cue passed since the last frame, or the stage's own when they watched it staged (`live`); a joiner is told
 * nothing of what they never saw.
 */
export function createRocket() {
  let target = 0, weight = 0;
  let at = NaN;   // the stage's moment (the cycle's clock - kept through the end's fade)
  /** @type {number | null} */
  let seen = null;   // the last cue framed while staged - null: nothing seen yet
  let owed = false;   // a live stage: its first frame says the cue it lands on
  return {
    set(ev, { live = false } = {}) {
      target = ev?.kind === ROCKET_EVENT ? 1 : 0;
      if (!live) weight = target;
      if (target) at = Number(ev.at);
      seen = null;
      owed = !!live && target === 1;
    },
    /** The cycle's state at `sharedMs` on the shared clock (rocketPhase, from the stage's moment), and `cue` and `line`
     *  - the cue a player watching is owed and its words (null when none). */
    frame(sharedMs) {
      const p = rocketPhase((sharedMs - at) / 1000);
      const c = rocketCue(p.t);
      const cue = target === 1 && ((seen !== null && c !== seen) || (seen === null && owed)) ? ROCKET_CUES[c].cue : null;
      if (target === 1) { seen = c; owed = false; } else seen = null;
      return { ...p, cue, line: cue ? ROCKET_LINES[cue]() : null, at };
    },
    tick(dt) {
      const step = Math.max(0, dt || 0) / ROCKET_FADE_S;
      weight = weight < target ? Math.min(target, weight + step) : Math.max(target, weight - step);
      return weight;
    },
    get weight() { return weight; },
    get on() { return target === 1; },
    get at() { return at; },
  };
}

/**
 * The cycle `sinceS` real seconds after the stage (ROCKET_PHASES, wrapping): `{ cycle, t, index, phase, rise, jet,
 * frenzy }` - `t` the seconds into this cycle, `rise` how far the mounds stand out of the earth, `jet` their poop's
 * strength, `frenzy` the frenzy's weight (the brown sky, the falling poop, the herd), each 0..1. A time before the
 * stage, or none, is its first moment. Pure.
 * @param {number} sinceS
 */
export function rocketPhase(sinceS) {
  const since = Number.isFinite(sinceS) && sinceS > 0 ? sinceS : 0;
  const cycle = Math.floor(since / ROCKET_CYCLE_S);
  const t = since - cycle * ROCKET_CYCLE_S;
  let start = 0, index = 0;
  while (index < ROCKET_PHASES.length - 1 && t >= start + ROCKET_PHASES[index].s) start += ROCKET_PHASES[index++].s;
  const { phase, s } = ROCKET_PHASES[index];
  const into = t - start;
  let rise = 1, jet = 0, frenzy = 0;
  if (phase === 'rise') rise = smooth(into / s);
  else if (phase === 'erupt') jet = smooth(into / ROCKET_JET_RAMP_S);
  else if (phase === 'lull') { jet = 1 - smooth(into / ROCKET_SUBSIDE_S); frenzy = ROCKET_BROWN_W * smooth((into - (s - ROCKET_BROWN_S)) / ROCKET_BROWN_S); }
  else if (phase === 'frenzy') { jet = 1; frenzy = lerp(ROCKET_BROWN_W, 1, smooth(into / ROCKET_FRENZY_RAMP_S)); }
  else { rise = 1 - smooth(into / s); jet = 1 - smooth(into / ROCKET_JET_RAMP_S); frenzy = 1 - smooth(into / (s * 0.75)); }
  return { cycle, t, index, phase, rise, jet, frenzy };
}

/** The newest cue (ROCKET_CUES' index) at `t` seconds into the cycle. Pure. */
export function rocketCue(t) {
  let c = 0;
  while (c < ROCKET_CUES.length - 1 && t >= ROCKET_CUES[c + 1].at) c++;
  return c;
}

/** How tall a mound's jet stands at the cycle's `jet` and `frenzy` (a share of its own ROCKET_JET_H_M). Pure. */
export const rocketJetScale = (jet, frenzy) => clamp01(jet) * (1 + (ROCKET_FRENZY_JET - 1) * clamp01(frenzy));

/**
 * THE MOUNDS ROUND A POINT of the world's own grid (`ax`, `az` - metres, anchored: the host's scene point plus the
 * scene origin's place in the world): every cell within ROCKET_MOUND_REACH_M whose seed's first draw falls under
 * ROCKET_MOUND_CHANCE holds one - `[{ x, z, r, h, jetH, flight, pulse, seed }]`, `x`/`z` anchored, `r`/`h` its size,
 * `jetH` its jet's height at full strength, `flight` a chunk's seconds, `pulse` its surges' rate. Two players at one
 * place read the same list. Pure.
 * @param {number} ax @param {number} az
 */
export function rocketMounds(ax, az) {
  const out = [];
  if (!Number.isFinite(ax) || !Number.isFinite(az)) return out;
  const C = ROCKET_MOUND_CELL_M, n = Math.ceil(ROCKET_MOUND_REACH_M / C);
  const cx0 = Math.floor(ax / C), cz0 = Math.floor(az / C);
  for (let dz = -n; dz <= n; dz++) {
    for (let dx = -n; dx <= n; dx++) {
      const cx = cx0 + dx, cz = cz0 + dz;
      const seed = seedOf(cx, cz);
      const r = seededRng(seed);
      if (r() >= ROCKET_MOUND_CHANCE) continue;
      const x = (cx + 0.15 + 0.7 * r()) * C, z = (cz + 0.15 + 0.7 * r()) * C;
      if (Math.hypot(x - ax, z - az) > ROCKET_MOUND_REACH_M) continue;
      out.push({
        x, z, seed,
        r: lerp(ROCKET_MOUND_R_M[0], ROCKET_MOUND_R_M[1], r()),
        h: lerp(ROCKET_MOUND_H_M[0], ROCKET_MOUND_H_M[1], r()),
        jetH: lerp(ROCKET_JET_H_M[0], ROCKET_JET_H_M[1], r()),
        flight: lerp(ROCKET_JET_FLIGHT_S[0], ROCKET_JET_FLIGHT_S[1], r()),
        pulse: 0.35 + 0.5 * r(),
      });
    }
  }
  return out;
}

/**
 * THE HORSES OF ONE CYCLE: `[{ kind, start, s, bearing, sweep, elev, len, coat, seed, farts }]` - `start` and `s` its
 * seconds into the cycle and its crossing, `bearing` where it sets out (radians from +z toward +x) and `sweep` the
 * azimuth it crosses (signed), `elev` its height (radians), `len` its length at ROCKET_SKY_R, `coat` its ROCKET_COATS
 * index, `farts` the seconds into its crossing it farts at. The great horse, its foals on its own way across, and the
 * frenzy's herd any way - seeded by the stage's moment and the cycle, so every client reads the same sky. Pure.
 * @param {number} at the stage's moment (ms) @param {number} cycle
 */
export function rocketFlights(at, cycle) {
  const base = seedOf(stageSeed(at), cycle | 0);
  const r = seededRng(base);
  const [e0, e1] = ROCKET_HORSE_ELEV_DEG;
  const elevOf = (k) => (e0 + (e1 - e0) * k) * Math.PI / 180;
  const fartsOf = (s, every, seed) => {
    const f = seededRng(seed), out = [];
    for (let x = every * (0.3 + 0.5 * f()); x < s; x += every * (0.75 + 0.5 * f())) out.push(x);
    return out;
  };
  const flight = (kind, start, s, bearing, sweep, elev, len, coat, seed) => ({ kind, start, s, bearing, sweep, elev, len, coat, seed, farts: fartsOf(s, ROCKET_FART_EVERY_S[kind], seed) });
  const out = [];
  const way = r() * 2 * Math.PI, dir = r() < 0.5 ? -1 : 1, high = r();
  out.push(flight('great', ROCKET_GREAT.at, ROCKET_GREAT.s, way, dir * ROCKET_HORSE_SWEEP, elevOf(0.35 + 0.4 * high), ROCKET_GREAT.len, Math.floor(r() * ROCKET_COATS.length), seedOf(base, 1)));
  for (let i = 0; i < ROCKET_FOALS.n; i++) {
    const seed = seedOf(base, 100 + i), f = seededRng(seed);
    out.push(flight('foal', ROCKET_FOALS.at + i * ROCKET_FOALS.every, ROCKET_FOALS.s, way + (f() - 0.5) * 0.3, dir * ROCKET_HORSE_SWEEP, elevOf(clamp01(0.15 + 0.7 * f())), ROCKET_FOALS.len * (0.85 + 0.3 * f()), Math.floor(f() * ROCKET_COATS.length), seed));
  }
  const frenzyAt = ROCKET_PHASES.slice(0, 3).reduce((a, p) => a + p.s, 0), frenzyS = ROCKET_PHASES[3].s;
  for (let i = 0, start = frenzyAt + 0.5; start < frenzyAt + frenzyS; i++, start += ROCKET_HERD.every) {
    const seed = seedOf(base, 1000 + i), f = seededRng(seed);
    out.push(flight('herd', start, lerp(ROCKET_HERD.s[0], ROCKET_HERD.s[1], f()), f() * 2 * Math.PI, (f() < 0.5 ? -1 : 1) * ROCKET_HORSE_SWEEP * (0.7 + 0.4 * f()), elevOf(f()), lerp(ROCKET_HERD.len[0], ROCKET_HERD.len[1], f()), Math.floor(f() * ROCKET_COATS.length), seed));
  }
  return out;
}

/** A unit direction from the eye at azimuth `a` (radians from +z toward +x) and elevation `e`. */
const skyDir = (a, e) => [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)];

/**
 * WHERE A HORSE IS, `k` 0..1 through its crossing: `dir` the unit way to it from the eye (it flies ROCKET_SKY_R out
 * along it), `forward` the unit way it is going, `rump` the unit way to its tail (where it farts from). It climbs and
 * dips as it gallops, highest at its middle. Pure.
 * @param {{bearing: number, sweep: number, elev: number, len: number, seed: number}} f @param {number} k
 */
export function rocketHorseAt(f, k) {
  const at = (q) => skyDir(f.bearing + f.sweep * q, f.elev + 0.1 * Math.sin(Math.PI * q) + 0.035 * Math.sin(q * 19 + (f.seed % 7)));
  const dir = at(k), a = at(k - 0.004), b = at(k + 0.004);
  const fw = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], fl = Math.hypot(fw[0], fw[1], fw[2]) || 1;
  const forward = [fw[0] / fl, fw[1] / fl, fw[2] / fl];
  const back = (f.len * 0.33) / ROCKET_SKY_R;   // the drawn body's end (render/rocketPass.js: the barrel's 0.58 of a half-length, and its haunch)
  const rp = [dir[0] - forward[0] * back, dir[1] - forward[1] * back, dir[2] - forward[2] * back], rl = Math.hypot(rp[0], rp[1], rp[2]) || 1;
  return { dir, forward, rump: [rp[0] / rl, rp[1] / rl, rp[2] / rl] };
}

/**
 * THE SKY AT `t` SECONDS INTO THE CYCLE, round the eye (a host point): `{ horses, puffs }` - each horse in flight `{ at,
 * forward, len, coat, gallop }` (`at` ROCKET_SKY_R out from `eye`), and each fart's cloud still hanging `{ at, size,
 * fade }`. Pure.
 * @param {ReturnType<typeof rocketFlights>} flights @param {number} t @param {ArrayLike<number>} eye
 */
export function rocketSky(flights, t, eye) {
  const horses = [], puffs = [];
  const R = ROCKET_SKY_R, place = (d) => [eye[0] + d[0] * R, eye[1] + d[1] * R, eye[2] + d[2] * R];
  for (const f of flights) {
    const since = t - f.start;
    if (since < 0 || since > f.s + ROCKET_PUFF_S) continue;
    if (since <= f.s) {
      const h = rocketHorseAt(f, since / f.s);
      horses.push({ at: place(h.dir), forward: h.forward, len: f.len, coat: f.coat, gallop: since * (f.kind === 'great' ? 2.2 : 3.4) + (f.seed % 13) });
    }
    for (const ft of f.farts) {
      const age = since - ft;
      if (age < 0 || age > ROCKET_PUFF_S) continue;
      const h = rocketHorseAt(f, ft / f.s), k = age / ROCKET_PUFF_S;
      for (let i = 0; i < ROCKET_PUFFS; i++) {
        const back = (f.len * (0.12 + 0.22 * i) * (0.4 + k)) / R, rise = (f.len * 0.08 * k * (i + 1)) / R;
        const d = [h.rump[0] - h.forward[0] * back, h.rump[1] - h.forward[1] * back + rise, h.rump[2] - h.forward[2] * back];
        puffs.push({ at: place(d), size: f.len * (0.16 + 0.07 * i) * (0.5 + 1.1 * Math.sqrt(k)), fade: (1 - k) ** 1.4 });
      }
    }
  }
  return { horses, puffs };
}

/** The farts and neighs heard in (fromT, toT] seconds into the cycle: `[{ kind: 'fart' | 'neigh', who, dir, seed }]` -
 *  `who` the horse's kind, `dir` the way to it from the eye. A horse neighs as it sets out (the great horse again at
 *  its middle). Pure. @param {ReturnType<typeof rocketFlights>} flights @param {number} fromT @param {number} toT */
export function rocketSounds(flights, fromT, toT) {
  const out = [];
  if (!(toT > fromT)) return out;
  for (const f of flights) {
    const neighs = f.kind === 'great' ? [0, f.s * 0.5] : [0];
    for (const n of neighs) if (f.start + n > fromT && f.start + n <= toT) out.push({ kind: 'neigh', who: f.kind, dir: rocketHorseAt(f, n / f.s).dir, seed: f.seed });
    for (const ft of f.farts) if (f.start + ft > fromT && f.start + ft <= toT) out.push({ kind: 'fart', who: f.kind, dir: rocketHorseAt(f, ft / f.s).rump, seed: (f.seed + Math.round(ft * 1000)) >>> 0 });
  }
  return out;
}

// ── The fart, made ────────────────────────────────────────────────
/** The made farts' sample rate, and how many there are (each its own seed: a squeak, a rumble, a sputter). */
export const ROCKET_FART_RATE = 22050;
export const ROCKET_FART_VARIANTS = Object.freeze([
  Object.freeze({ s: 0.55, f0: 150, f1: 210, wobble: 0.22, flutter: 26 }),
  Object.freeze({ s: 1.1, f0: 62, f1: 48, wobble: 0.3, flutter: 17 }),
  Object.freeze({ s: 0.8, f0: 95, f1: 75, wobble: 0.45, flutter: 34 }),
]);

/**
 * A FART, MADE: mono samples at ROCKET_FART_RATE for variant `v` (ROCKET_FART_VARIANTS) - a buzzing pulse whose pitch
 * slides from f0 to f1 and wobbles, fluttering on and off as it sputters, darkened by a two-pole low-pass and roughed by
 * a breath of noise, under a quick swell and a long tail. Peaks at 0.9. Pure.
 * @param {number} v
 */
export function rocketFartSamples(v) {
  const i = ((v | 0) % ROCKET_FART_VARIANTS.length + ROCKET_FART_VARIANTS.length) % ROCKET_FART_VARIANTS.length, p = ROCKET_FART_VARIANTS[i];
  const n = Math.round(p.s * ROCKET_FART_RATE), out = new Float32Array(n);
  const r = seededRng(seedOf(0xfa27, i));
  let phase = 0, lp1 = 0, lp2 = 0, jitter = 0, peak = 0;
  const cut = 0.16;
  for (let i = 0; i < n; i++) {
    const k = i / n;
    if (i % 64 === 0) jitter = jitter * 0.6 + (r() - 0.5) * 0.4;
    const f = lerp(p.f0, p.f1, k) * (1 + p.wobble * Math.sin(2 * Math.PI * 7 * k + 4 * k * k) * 0.5 + p.wobble * jitter);
    phase += f / ROCKET_FART_RATE;
    phase -= Math.floor(phase);
    const pulse = phase < 0.32 ? 1 - phase / 0.16 : -0.45;   // a reedy buzz: a short slap, a long rest
    const flutter = 0.55 + 0.45 * Math.sin(2 * Math.PI * p.flutter * k * p.s + 3 * jitter);
    const env = Math.min(1, k / 0.04) * (1 - k) ** 0.8;
    const x = (pulse * flutter + (r() - 0.5) * 0.35) * env;
    lp1 += cut * (x - lp1);
    lp2 += cut * (lp1 - lp2);
    out[i] = lp2;
    peak = Math.max(peak, Math.abs(lp2));
  }
  if (peak > 0) for (let i = 0; i < n; i++) out[i] *= 0.9 / peak;
  return out;
}
