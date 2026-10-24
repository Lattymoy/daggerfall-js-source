// @ts-check
// WORLD-AIR (2026-10-24, the owner: "... and whatever else we could improve"): THE OPEN WORLD'S AIR, past what Daggerfall
// plays. Design: bible/08-Audio/Audio.md SOUNDSCAPE.
//
// DFU's exterior ambience is WeatherManager.SetAmbientEffects' four presets (systems/ambientEffects.js
// presetForExterior): rain, a storm, a sunny day's two birds, a clear night's crickets - the same in the Alik'r as in a
// Wrothgarian pass, on a beach as in a market. That stays exactly as it is, on both skins. This is laid over it on the
// enhanced skin with Enhanced Sounds on, and never instead of it:
//
//   THE SHORE. Where the sea is near (the host finds its nearest edge - systems/soundscape/soundscapeHost.js), the
//     SURF: a bed at the water's edge, louder as it nears, its waves breaking on a breaker's clock - each wave curling
//     up, crashing (a one-shot of the port's own at the edge, near enough) and running back - their period and their
//     weight the sea state's (seaAir.js seaState: the wind and the weather). On a quiet day, close in, a LAP under it.
//   THE WILD, by the climate under the player (CLIMATE.PAK's, formats/mapsTables.js CLIMATES) and the hour: crows by day
//     in the woods and the hills, owls by night, wolves far off in the mountains and the haunted woods, a marsh's
//     insects and its frogs - a chorus at night and in the rain - in the swamps and the rainforest, a far howl over the
//     desert at night (`wildVoicesFor`). Rain quiets the birds and wakes the frogs; a storm leaves only the frogs; the
//     winter has none; inside a town's walls the wild is far and seldom.
//   THE TOWN, inside a location's rect: by day its MURMUR, people about their business (a bed built from Daggerfall's
//     own people - DAGGER.SND AmbientPeople1-10, systems/arena/arenaSound.js synthBed - never shipped), as loud as the
//     town is big and the hour is busy, quiet in the rain; its SMITHIES at their anvils by day (a bout of blows at the
//     door, then a rest); its TAVERNS' noise through the door in the evening.
//
// The laws are pure (the clock, the place and the dice in, levels and events out); the driver keeps the clocks and plays
// them. Behind Enhanced Sounds (ES1) on the enhanced skin. Not a DFU member - Ledger A (SOUNDSCAPE).
import { audio as defaultAudio } from '../audio.js';
import { CLIMATES } from '../../formats/mapsTables.js';
import { ensureBed, ensureMade } from './soundJobs.js';   // AUDIT SOUNDSCAPE W4: made off the main thread
import { TOWN_BED_RATE } from './townBeds.js';
import { SCAPE_SFX } from './soundscapeSfx.js';
import { seaState } from './seaAir.js';
import { PEOPLE_RECORDS } from '../arena/arenaSound.js';

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

// ── the shore ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** THE SURF: heard from SURF_REACH m of the water's edge in, at its whole within SURF_FULL; `max` its loudest. */
export const SURF = Object.freeze({ name: 'shore:surf', bed: 'shore:surf', max: 0.3, reach: 220, full: 8, floor: 0.22 });
/** THE LAP: close in (within LAP_REACH m) on a quiet sea (under LAP_STATE). */
export const LAP = Object.freeze({ name: 'shore:lap', bed: 'shore:lap', max: 0.16, reach: 14, state: 0.45 });
/** A wave's crash one-shot is played from the edge while it is nearer than this. */
export const CRASH_REACH = 90;
/** Where each crash take is loudest, seconds in (its loudest 50 ms - tools/soundscapeSfx.mjs crash's curl): its start is
 *  laid that much before the bed's crash (AUDIT SOUNDSCAPE W5). */
export const CRASH_PEAK_S = Object.freeze([0.83, 1.0]);
/** A breaker's period, seconds: drawn between these for a calm sea, a heavy one's a third shorter. */
export const BREAKER_PERIOD = Object.freeze([7, 11]);
/** A breaker curls for this long before it crashes, then runs back over this share of its period - no shorter than the
 *  latest of the crash takes' loudest (CRASH_PEAK_S), so each can be started to peak on it (at 0.9 the second take,
 *  loudest a second in, could only be a tenth late). */
export const BREAKER_CURL_S = 1.0;
export const BREAKER_RUN = 0.45;

/** How much of the surf reaches an ear `dist` m from the edge: whole within SURF.full, falling away, none past
 *  SURF.reach. Pure. */
export function surfReach(dist) {
  const d = Number(dist);
  if (!Number.isFinite(d) || d >= SURF.reach) return 0;
  if (d <= SURF.full) return 1;
  const fall = 1 / (1 + Math.pow((d - SURF.full) / 25, 1.5));
  return fall * Math.min(1, (SURF.reach - d) / 40);   // the last 40 m eased to nothing, never a step
}

/** A breaker's envelope `u` seconds into a wave of `period`: rising as it curls, all at the crash, running back to the
 *  surf's floor. Pure. */
export function breakerAt(u, period) {
  const t = Math.max(0, Number(u) || 0);
  if (t < BREAKER_CURL_S) return SURF.floor + (1 - SURF.floor) * Math.pow(t / BREAKER_CURL_S, 2);
  const run = Math.max(0.5, period * BREAKER_RUN);
  return SURF.floor + (1 - SURF.floor) * Math.exp(-(t - BREAKER_CURL_S) / (run / 3));
}

/** The surf bed's gain for an ear `dist` m off, a sea of `state`, the breaker's envelope `env` - heard flat, where the
 *  edge's bearing is not known. Pure. */
export const surfGain = (dist, state, env) => SURF.max * surfReach(dist) * (0.4 + 0.6 * clamp01(state)) * clamp01(env);
/** The same played AT the edge (audio.setBed3d, inverse from SURF_REF m): the panner takes the distance - its 12/d
 *  falls a little faster than surfReach (0.6 against 0.75 at 20 m, 0.12 against 0.12 at 100) and keeps the edge's
 *  bearing - so the gain carries the sea and the breaker, and the last 40 m of the reach eased to nothing (the inverse
 *  model stops falling at its max, it never falls silent). Pure. */
export const SURF_REF = 12;
export const surfEdgeGain = (dist, state, env) => (Number(dist) < SURF.reach ? SURF.max * Math.min(1, (SURF.reach - Number(dist)) / 40) * (0.4 + 0.6 * clamp01(state)) * clamp01(env) : 0);
/** The lap's gain: close in on a quiet sea. Pure. */
export const lapGain = (dist, state) => (Number(dist) < LAP.reach && clamp01(state) < LAP.state ? LAP.max * (1 - Number(dist) / LAP.reach) * (1 - clamp01(state) / LAP.state) : 0);

// ── the wild ────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {{ kind: 'crow' | 'owl' | 'howl' | 'jackal' | 'frog', gap: readonly number[], dist: readonly number[], lift: readonly number[], volume: readonly number[], chorus?: number, id?: string }} WildVoice
 */
/** @param {WildVoice['kind']} kind @param {number[]} gap @param {number[]} dist @param {number[]} lift @param {number[]} volume @param {number} [chorus] @returns {WildVoice} */
const voice = (kind, gap, dist, lift, volume, chorus = 0) => Object.freeze({ kind, gap: Object.freeze(gap), dist: Object.freeze(dist), lift: Object.freeze(lift), volume: Object.freeze(volume), ...(chorus ? { chorus } : {}) });
const CROW = voice('crow', [25, 70], [20, 60], [8, 20], [0.3, 0.5]);
const CROW_OFTEN = voice('crow', [14, 40], [18, 55], [8, 20], [0.3, 0.5]);
const OWL = voice('owl', [25, 60], [18, 55], [6, 12], [0.2, 0.32]);   // AUDIT SOUNDSCAPE W12: a pure tone is louder than its peak says - 8 dB over the crow's caw at the same peak, taken back
const OWL_SELDOM = voice('owl', [60, 150], [25, 60], [6, 12], [0.18, 0.28]);
const WOLF = voice('howl', [90, 240], [160, 420], [10, 30], [0.4, 0.6]);
const WOLF_OFTEN = voice('howl', [45, 120], [140, 380], [10, 30], [0.4, 0.65]);
const JACKAL = voice('jackal', [120, 300], [180, 420], [5, 15], [0.3, 0.45]);
const FROG_DAY = voice('frog', [8, 25], [6, 28], [-0.5, 0], [0.3, 0.5], 1);
const FROG_NIGHT = voice('frog', [1.5, 6], [5, 30], [-0.5, 0], [0.3, 0.55], 3);
const FROG_SELDOM = voice('frog', [10, 30], [8, 30], [-0.5, 0], [0.3, 0.45], 2);

/** THE WILD, by climate: the voices by day and by night, and whether its marsh's insects hum under them. */
export const WILD = Object.freeze({
  [CLIMATES.Woodlands]: Object.freeze({ day: [CROW], night: [OWL, WOLF], marsh: false }),
  [CLIMATES.MountainWoods]: Object.freeze({ day: [CROW], night: [OWL, WOLF_OFTEN], marsh: false }),
  [CLIMATES.Mountain]: Object.freeze({ day: [CROW], night: [WOLF_OFTEN, OWL_SELDOM], marsh: false }),
  [CLIMATES.HauntedWoodlands]: Object.freeze({ day: [CROW_OFTEN], night: [OWL, WOLF_OFTEN], marsh: false }),
  [CLIMATES.Swamp]: Object.freeze({ day: [FROG_DAY], night: [FROG_NIGHT, OWL_SELDOM], marsh: true }),
  [CLIMATES.Rainforest]: Object.freeze({ day: [FROG_DAY], night: [FROG_NIGHT, OWL_SELDOM], marsh: true }),
  [CLIMATES.Subtropical]: Object.freeze({ day: [CROW], night: [FROG_SELDOM, OWL_SELDOM], marsh: false }),
  [CLIMATES.Desert]: Object.freeze({ day: [], night: [JACKAL], marsh: false }),
  [CLIMATES.Desert2]: Object.freeze({ day: [], night: [JACKAL], marsh: false }),
});
/** A marsh's insects: the bed's loudest, by day and by night (louder), quieted in a town. */
export const MARSH = Object.freeze({ name: 'wild:marsh', bed: 'wild:marsh', day: 0.08, night: 0.13 });
/** Inside a town's walls the wild is this much further between (a crow's caw, a far wolf alone stays), and this much
 *  further off (AUDIT SOUNDSCAPE W14: "far and seldom" - the first cut made it seldom alone). */
export const TOWN_WILD_GAP = 3;
export const TOWN_WILD_FAR = 1.6;

/**
 * The wild's voices for a climate now: the climate's own for the time of day, as the weather and the season leave them -
 * rain quiets the crows and the owls and makes the frogs croak twice as often; a storm leaves the frogs alone; snow or
 * the winter takes the frogs; inside a town the wolves and the frogs are gone and the rest come TOWN_WILD_FAR times further
 * off and TOWN_WILD_GAP times
 * further between. Each voice's gap as it now stands, and its `id` (the time of day and its place in the row - the
 * clock the driver keeps for it). Pure.
 * @param {number} climate @param {{ night: boolean, weather: string, winter: boolean, inTown: boolean }} now
 * @returns {WildVoice[]}
 */
export function wildVoicesFor(climate, { night, weather, winter, inTown }) {
  const row = /** @type {Record<number, { day: WildVoice[], night: WildVoice[] }>} */ (WILD)[climate];
  if (!row) return [];
  const out = [];
  for (const [i, v] of (night ? row.night : row.day).entries()) {
    const frog = v.kind === 'frog';
    if (frog && (winter || weather === 'snow')) continue;
    if (!frog && (weather === 'rain' || weather === 'thunder') && v.kind !== 'howl') continue;
    if (weather === 'thunder' && !frog) continue;
    if (inTown && (frog || v.kind === 'howl' || v.kind === 'jackal')) continue;
    const k = (frog && (weather === 'rain' || weather === 'thunder') ? 0.5 : 1) * (inTown ? TOWN_WILD_GAP : 1);
    const far = inTown ? TOWN_WILD_FAR : 1;
    out.push({ ...v, gap: [v.gap[0] * k, v.gap[1] * k], dist: [v.dist[0] * far, v.dist[1] * far], id: `${night ? 'night' : 'day'}:${i}` });
  }
  return out;
}
/** The marsh bed's gain for a climate now: a marsh's own by day or by night, none in a town, the winter or snow. Pure. */
export function marshGain(climate, { night, weather, winter, inTown }) {
  const row = /** @type {Record<number, { marsh: boolean }>} */ (WILD)[climate];
  if (!row?.marsh || inTown || winter || weather === 'snow') return 0;
  return (night ? MARSH.night : MARSH.day) * (weather === 'thunder' ? 0.4 : 1);
}

// ── the town ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** THE MURMUR: a town's people about by day, its loudest `max`, from `open` to `close` o'clock (the busiest from
 *  `busy[0]` to `busy[1]`), a town of `blocks` blocks or more at its whole. */
export const MURMUR = Object.freeze({ name: 'town:murmur', key: 'town:murmur', max: 0.22, open: 6.5, close: 21.5, busy: Object.freeze([10, 17]), blocks: 16 });
/** AUDIT SOUNDSCAPE W13: the murmur is ONE bed played as TWO, the second a little lower and so a little longer (8 s
 *  against 8.7 s), each at the whole's power over the root of two - two loops whose seams never meet the same voice twice
 *  in a minute and a half, where one 8 s loop of the same fragments was a loop an ear finds. */
export const MURMUR_TWIN = Object.freeze({ name: 'town:murmur:2', pitch: 0.917 });
/** The weather's share of the street's people: a rain sends most indoors. */
export const MURMUR_WEATHER = Object.freeze({ rain: 0.45, thunder: 0.2, snow: 0.6 });
/** THE SMITHIES: a smith at the anvil within `reach` m of the door, from `open` to `close` o'clock - bouts of `blows`
 *  `beat` s apart, `rest` s between. */
export const SMITHY = Object.freeze({ reach: 45, open: 7, close: 19, blows: Object.freeze([3, 9]), beat: Object.freeze([0.55, 0.8]), rest: Object.freeze([5, 16]) });
/** THE TAVERNS: their noise at the door within `reach` m - `night` from `evening` o'clock to `late`, `day` from `opens`
 *  to the evening, and between `late` and `opens` the hours a tavern sleeps (AUDIT SOUNDSCAPE W13: four in the morning was
 *  as loud as noon), `small`. */
export const TAVERN = Object.freeze({ name: 'town:tavern', key: 'town:tavern', reach: 35, day: 0.18, night: 0.5, small: 0.03, evening: 17, late: 2, opens: 10, ref: 4 });

const inHours = (h, from, to) => (from <= to ? h >= from && h < to : h >= from || h < to);
/** The murmur's gain: the town's size, the hour (rising from `open` to the busy hours, falling to `close`), the
 *  weather. Pure. */
export function murmurGain(hour, blocks, weather) {
  const h = ((Number(hour) % 24) + 24) % 24;
  const { max, open, close, busy } = MURMUR;
  if (h < open || h >= close) return 0;
  const busyness = h < busy[0] ? (h - open) / (busy[0] - open) : h <= busy[1] ? 1 : (close - h) / (close - busy[1]);
  const size = Math.sqrt(clamp01((Number(blocks) || 1) / MURMUR.blocks));
  return max * clamp01(busyness) * size * (MURMUR_WEATHER[/** @type {keyof typeof MURMUR_WEATHER} */ (weather)] ?? 1);
}
/** Whether a smith works at this hour. Pure. */
export const smithAtWork = (hour) => inHours(((Number(hour) % 24) + 24) % 24, SMITHY.open, SMITHY.close);
/** The tavern's level at this hour. Pure. */
export function tavernGain(hour) {
  const h = ((Number(hour) % 24) + 24) % 24;
  if (inHours(h, TAVERN.evening, TAVERN.late)) return TAVERN.night;
  return inHours(h, TAVERN.late, TAVERN.opens) ? TAVERN.small : TAVERN.day;
}

/** The people's samples off the player's own archive (DAGGER.SND AmbientPeople1-10), or null without one. @param {any} engine */
const peopleOf = (engine) => { const v = PEOPLE_RECORDS.map((i) => engine?.samplesOf?.(i)).filter(Boolean); return v.length ? v : null; };
/**
 * The town's two beds (townBeds.js: the murmur, the tavern) made off the main thread and registered (soundJobs.js
 * ensureMade). True once both stand on the engine; false with no archive or no context yet (asked again next frame).
 * @param {any} engine @param {any} [opts]
 */
export function ensureTownBeds(engine, opts) {
  const job = (/** @type {string} */ kind) => () => { const voices = peopleOf(engine); return voices && { kind, voices }; };
  const murmur = ensureMade(engine, MURMUR.key, job('murmur'), TOWN_BED_RATE, opts);
  const tavern = ensureMade(engine, TAVERN.key, job('tavern'), TOWN_BED_RATE, opts);
  return murmur && tavern;
}

// ── the driver ──────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {{ ear: number[], climate: number, night: boolean, hour: number, weather: string, wind: number, winter: boolean,
 *   inTown: boolean, townBlocks: number, shore: { dist: number, dir: number[] | null, at?: number[] } | null, smithies: number[][],
 *   taverns: number[][], paused: boolean }} WorldFrame
 */
/** The name the wild's far shots are played under (audio.js fadeFar). */
export const WORLD_AIR_FAR = 'worldAir';
const WILD_CLIPS = Object.freeze({ crow: SCAPE_SFX.crow, owl: SCAPE_SFX.owl, howl: SCAPE_SFX.howl, jackal: SCAPE_SFX.howl, frog: SCAPE_SFX.frog });
const WILD_PITCH = Object.freeze({ crow: [0.9, 1.1], owl: [0.94, 1.06], howl: [0.9, 1.05], jackal: [1.25, 1.45], frog: [0.85, 1.2] });

/** @param {() => number} rand @param {readonly number[]} r */
const between = (rand, r) => r[0] + (r[1] - r[0]) * rand();
/** @template T @param {() => number} rand @param {ReadonlyArray<T>} list @returns {T} */
const pick = (rand, list) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
const near = (ear, list, reach) => {
  let best = null, bd = reach;
  for (const p of list ?? []) { const d = Math.hypot(p[0] - ear[0], p[2] - ear[2]); if (d < bd) { bd = d; best = p; } }
  return best;
};

/**
 * The open world's air on the engine: `frame(dt, w)` once an exterior frame on land (a WorldFrame: the ear, the
 * climate, night and the hour, the weather's word, the wind 0..1, the winter, whether I stand in a town and its size,
 * the sea's nearest edge, the smithies' and the taverns' doors near, the pause); `stop()` on every other frame.
 * @param {{ engine?: any, rand?: () => number }} [opts]
 */
export function createWorldAir({ engine = defaultAudio, rand = Math.random } = {}) {
  let on = false, waveT = 0, period = BREAKER_PERIOD[0];
  /** @type {Map<string, number>} each voice's time to its next call, by its id */
  let wildIn = new Map();
  let anvil = { blowsLeft: 0, next: 0 };
  /** @type {Array<{ at: number, play: () => void, kind?: string }>} shots due later - a smith's are `kind` 'anvil', let go
   *  the moment the smith stops (the evening, the door out of reach) */
  let due = [];
  let t = 0;
  const play3d = (clip, pos, volume, { pitch = 1, ref = 10, max = 500 } = {}) => {
    try { engine.play3d(clip, pos, volume, { refDistance: ref, maxDistance: max, pitch, far: WORLD_AIR_FAR }); } catch { /* a sound is never the walk */ }
  };
  const bed = (name, clip, volume, pitch = 1) => {
    try { engine.setBed(name, volume > 0.002 ? clip : null, { volume, pitch }); } catch { /* not yet */ }
  };
  const bed3d = (name, clip, pos, volume, ref, max) => {
    try { engine.setBed3d(name, volume > 0.002 && pos ? clip : null, pos, { volume, refDistance: ref, maxDistance: max }); } catch { /* not yet */ }
  };
  return {
    get on() { return on; },
    /** @param {number} dt @param {WorldFrame} w */
    frame(dt, w) {
      if (!w || !Array.isArray(w.ear) || w.ear.length !== 3) return;
      const step = Math.max(0, Math.min(0.25, Number(dt) || 0));
      if (!w.paused) t += step;   // AUDIT SOUNDSCAPE W7: the clock the queued calls keep stands with the game
      on = true;
      const state = seaState(w.wind, w.weather);
      // THE SHORE
      const shore = w.shore && Number.isFinite(w.shore.dist) ? w.shore : null;
      if (shore && surfReach(shore.dist) > 0) {
        if (!w.paused) waveT += step;
        // the edge: the host's own point at the sea's surface, standing while I move (AUDIT SOUNDSCAPE W9, W10); the
        // bearing's off my ear only where the host gave none
        const edge = shore.at ?? (shore.dir ? [w.ear[0] + shore.dir[0] * shore.dist, w.ear[1] - 1, w.ear[2] + shore.dir[1] * shore.dist] : null);
        const dist = shore.at ? Math.hypot(shore.at[0] - w.ear[0], shore.at[2] - w.ear[2]) : shore.dist;
        if (waveT >= period) {
          waveT -= period;
          period = between(rand, BREAKER_PERIOD) * (1 - 0.33 * state);
          // AUDIT SOUNDSCAPE W5: a crash's own curl - its loudest falls CRASH_PEAK_S into it - started so it peaks on the
          // bed's crash, not a second after it; W6: the panner takes the distance, never the gain twice
          if (dist < CRASH_REACH && edge) {
            const k = Math.min(SCAPE_SFX.shoreCrash.length - 1, Math.floor(rand() * SCAPE_SFX.shoreCrash.length)), at = edge;
            due.push({ at: t + Math.max(0, BREAKER_CURL_S - CRASH_PEAK_S[k]), play: () => play3d(SCAPE_SFX.shoreCrash[k], at, 0.35 + 0.5 * state, { pitch: between(rand, [0.94, 1.06]), ref: 12, max: 260 }) });
          }
        }
        if (ensureBed(engine, SURF.bed)) {
          const env = breakerAt(waveT, period);
          // at the edge where its bearing is known (the panner takes the distance), flat where it is not - never both
          bed3d(SURF.name, SURF.bed, edge, edge ? surfEdgeGain(dist, state, env) : 0, SURF_REF, SURF.reach + 60);
          bed(SURF.name, SURF.bed, edge ? 0 : surfGain(dist, state, env));
        }
        if (ensureBed(engine, LAP.bed)) bed(LAP.name, LAP.bed, lapGain(dist, state));
      } else { bed(SURF.name, SURF.bed, 0); bed3d(SURF.name, SURF.bed, null, 0, 1, 1); bed(LAP.name, LAP.bed, 0); }
      // THE WILD
      const now = { night: !!w.night, weather: w.weather, winter: !!w.winter, inTown: !!w.inTown };
      const voices = wildVoicesFor(w.climate, now);
      const keep = new Map();
      for (const v of voices) {
        const id = `${w.climate}|${v.id}`;
        let left = wildIn.get(id) ?? between(rand, [v.gap[0] * 0.3, v.gap[0]]);
        if (!w.paused) left -= step;
        if (left <= 0) {
          const az = between(rand, [-Math.PI, Math.PI]), d = between(rand, v.dist), lift = between(rand, v.lift);
          const pos = [w.ear[0] + Math.sin(az) * d, w.ear[1] + lift, w.ear[2] + Math.cos(az) * d];
          const calls = v.chorus ? 1 + Math.floor(rand() * v.chorus) : 1;
          for (let k = 0; k < calls; k++) {
            const clip = pick(rand, WILD_CLIPS[v.kind]), pitch = between(rand, WILD_PITCH[v.kind]), vol = between(rand, v.volume);
            const p = k === 0 ? pos : [pos[0] + between(rand, [-6, 6]), pos[1], pos[2] + between(rand, [-6, 6])];
            if (k === 0) play3d(clip, p, vol, { pitch, ref: v.kind === 'howl' || v.kind === 'jackal' ? 60 : 10, max: 900 });
            else due.push({ at: t + between(rand, [0.15, 0.9]) * k, play: () => play3d(clip, p, vol * 0.85, { pitch, ref: 10, max: 900 }) });
          }
          left = between(rand, v.gap);
        }
        keep.set(id, left);
      }
      wildIn = keep;
      const marsh = marshGain(w.climate, now);
      if (marsh > 0 ? ensureBed(engine, MARSH.bed) : true) bed(MARSH.name, MARSH.bed, marsh);
      // THE TOWN
      const towned = !!w.inTown && ensureTownBeds(engine);
      const murmur = towned ? murmurGain(w.hour, w.townBlocks, w.weather) * Math.SQRT1_2 : 0;
      bed(MURMUR.name, MURMUR.key, murmur);
      bed(MURMUR_TWIN.name, MURMUR.key, murmur, MURMUR_TWIN.pitch);
      const tavern = towned ? near(w.ear, w.taverns, TAVERN.reach) : null;
      bed3d(TAVERN.name, TAVERN.key, tavern ? [tavern[0], tavern[1] + 1, tavern[2]] : null, tavern ? tavernGain(w.hour) * (w.weather === 'thunder' ? 0.7 : 1) : 0, TAVERN.ref, TAVERN.reach + 15);
      const smithy = w.inTown && smithAtWork(w.hour) ? near(w.ear, w.smithies, SMITHY.reach) : null;
      if (smithy && !w.paused) {
        if ((anvil.next -= step) <= 0) {
          if (anvil.blowsLeft <= 0) anvil.blowsLeft = Math.round(between(rand, SMITHY.blows));
          play3d(SCAPE_SFX.anvil[0], [smithy[0], smithy[1] + 1, smithy[2]], between(rand, [0.45, 0.65]), { pitch: between(rand, [0.96, 1.04]), ref: 6, max: SMITHY.reach + 30 });
          anvil.blowsLeft--;
          anvil.next = anvil.blowsLeft > 0 ? between(rand, SMITHY.beat) : between(rand, SMITHY.rest);
          if (anvil.blowsLeft <= 0 && rand() < 0.25) due.push({ kind: 'anvil', at: t + between(rand, SMITHY.rest) * 0.5, play: () => play3d(SCAPE_SFX.anvil[1], [smithy[0], smithy[1] + 1, smithy[2]], 0.5, { ref: 6, max: SMITHY.reach + 30 }) });
        }
      } else if (!smithy) { anvil = { blowsLeft: 0, next: between(rand, [0.5, 3]) }; if (due.length) due = due.filter((d) => d.kind !== 'anvil'); }
      if (due.length) {
        const ready = due.filter((d) => d.at <= t);
        if (ready.length) { due = due.filter((d) => d.at > t); for (const d of ready) d.play(); }
      }
    },
    stop() {
      wildIn = new Map();
      due = [];
      anvil = { blowsLeft: 0, next: 0 };
      if (!on) return;
      on = false;
      try {
        for (const name of [SURF.name, LAP.name, MARSH.name, MURMUR.name, MURMUR_TWIN.name]) engine.setBed(name, null);
        for (const name of [SURF.name, TAVERN.name]) engine.setBed3d(name, null, null);
        engine.fadeFar?.(WORLD_AIR_FAR);
      } catch { /* nothing left to stop */ }
    },
  };
}
