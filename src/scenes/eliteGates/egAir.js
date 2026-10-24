// @ts-check
// EG-ROAR (2026-10-18, Mac: "the music and ambience of the elite breach needs to be insanely better. Its way too tame";
// bible/11-Multiplayer/Elite-Gates.md section 26): THE SPIRE'S AIR - what the Battlespire's torn halls sound like under
// the score and between its songs. The Spire had none of its own: the dungeon's drips, doors and birds (DFU's
// AmbientEffectsPlayer - systems/ambientEffects.js, a crypt's) were all of it, so "silence is scored too" (section 26)
// was a drip over a hall hung in the void. The Shattered Hour has had its air since SD14b (scenes/superDungeon/sdAir.js);
// this is the Spire's, on the same engine and the same laws.
//
// THE BEDS, each MADE at runtime (nothing shipped, nothing of Daggerfall's written into the tree) and each a loop that
// meets itself:
//   THE VOID - the abyss under every hall: a roar of noise swept slowly through a resonant band over a deep brown
//     rumble, breathing - synthesis alone (`buildSpireVoid`);
//   THE SPIRE'S DRONE - the band's own chord held in the stone, tuned to the score's E so it never fights a song
//     (`buildSpireDrone`, every partial whole turns of its loop): the Galleries' open fifths with the academy's ward
//     whining high (E5 against the Kyn's F5); the Cairn's souls' choir (a sung "oh" on E3, G and B under it); the
//     Shade's glass (B4 against C5, the moon's F6 over them) on a sub; the Wellhead's furnace (E1's harmonics darkened,
//     the bellows pulsing);
//   THE BAND'S VOICE - DAGGER.SND's own, laid over itself at a spread of pitches (sdAir.js layBed): the colonnades'
//     wind (AmbientWindBlow1-1b), the souls' moan (AmbientWindMoan, low), the Shade's howl (AmbientWindMoan, high), the
//     forge's fire and grind (Burning, AmbientGrind);
//   THE LORD'S BREATH - while a Court's lord sleeps, the deep moan slowed to a breath that rises and falls.
// THE EVENTS (`egAirEvents`), the Hour's law: each kind in a slot of its own seconds, whole over EG_AIR_PERIOD, a seeded
// share of them sounding, each from a stand-in far off in its own quarter (scenes/deadlandsAir.js airSourceAt), the
// breach's seed and its band choosing them. THE LEGION in every band - its war horn (the call's own, egCall.js
// buildEgHorn, lowered), its drums, a daedra's roar from below - and THE TEAR, the Spire's stone breaking far under the
// halls and its debris falling into the void; and each band its own: the Galleries' cracked bell; the Cairn's wails and
// its toll; the Shade's howls and whispers; the Wellhead's hammers and its forge's blasts.
// THE MIX (`egAirMoment`, EG_AIR_MIX): the air whole where the score is silent (the gather, the arrival, the closing -
// "silence is scored too"), under the war in a trial, hushed to the lord's breath while a Court's lord sleeps, low at a
// Redoubt's rest, falling away at the end and at a fall - eased over EG_AIR_EASE_S, never stepped.
//
// The clock is the breach's (scenes/eliteGates/egClient.js's corrected `now`), so a horn is one moment on every screen of
// a company. A gap between frames longer than AIR_BACKLOG_S plays none of what it passed. The made sounds are built one
// a frame (a build is ~10 ms), each once for the engine. A sound is never the fight: every call is guarded.
// Not a DFU member. Ledger A (ELITE-GATES).
import { audio as defaultAudio } from '../../systems/audio.js';
import { SOUND } from '../../systems/soundClips.js';
import { SAMPLE_RATE as SND_RATE } from '../../formats/sndFile.js';
import { level, lowpassLoop } from '../../systems/arena/arenaSound.js';
import { seededRng } from '../../systems/wind/wind.js';
import { airSourceAt, AIR_BACKLOG_S } from '../deadlandsAir.js';
import { THUNDER_SOURCE_M } from '../../systems/distantStorms.js';
import { layBed } from '../superDungeon/sdAir.js';
import { buildEgHorn, EG_HORN_KEY, EG_HORN_RATE } from './egCall.js';
import { SPIRE_END_MS } from '../../systems/eliteGates/egScore.js';

/** DAGGER.SND's own (systems/ambientEffects.js AMBIENT_SOUNDS, systems/soundClips.js): the grind, the monster's roar, the
 *  ship's bell, the distant howl, the storm's thunder and its roll, the class's drums and the arena's, the spooky three,
 *  the fire's blast, Parry6's clunk. */
export const EG_AIR_CLIPS = Object.freeze({
  grind: 68, roar: 73, bell: 107, howl: 113, thunder: 349, thunderRoll: 350, drums: 374, drumsArena: 28,
  spookyHigh: 0, spookyMid: 1, blast: SOUND.SpellImpactFire, clunk: SOUND.Parry6, moan: SOUND.AmbientWindMoan, moanDeep: SOUND.AmbientWindMoanDeep,
});
/** The made sounds' rate, their loops' lengths (s - none a multiple of another, so no two seams meet), their levels
 *  (RMS) and their keys on the engine. */
export const EG_AIR_RATE = 22050;
/** The void's and the drones' own rate - nothing in them sounds over 2.6 kHz, so half the beds' (half the build). */
export const EG_AIR_LOW_RATE = 11025;
export const EG_AIR_SECONDS = Object.freeze({ void: 29, drone: 12, band: 23, breath: 19 });
const VOID_RMS = 0.06, DRONE_RMS = 0.05, BAND_RMS = 0.05, BREATH_RMS = 0.06;
export const EG_AIR_KEYS = Object.freeze({ void: 'egair:void', drone: 'egair:drone', band: 'egair:band', breath: 'egair:breath' });
/** Each bed's name on the engine (systems/audio.js setBed) and its level at the whole of the mix. */
export const EG_AIR_BEDS = Object.freeze({ void: 'egair:bed:void', drone: 'egair:bed:drone', band: 'egair:bed:band', breath: 'egair:bed:breath' });
export const EG_AIR_LEVEL = Object.freeze({ void: 0.34, drone: 0.26, band: 0.3, breath: 0.36 });
/** THE MIX, by the moment (egAirMoment): each bed's share of its level, and the events'. */
export const EG_AIR_MIX = Object.freeze({
  open: Object.freeze({ void: 1, drone: 1, band: 1, breath: 0, events: 1 }),
  trial: Object.freeze({ void: 0.7, drone: 0.55, band: 0.75, breath: 0, events: 0.8 }),
  sleep: Object.freeze({ void: 0.8, drone: 1.15, band: 0.5, breath: 1, events: 0.5 }),
  rest: Object.freeze({ void: 0.45, drone: 0.4, band: 0.5, breath: 0, events: 0.35 }),
  end: Object.freeze({ void: 0.6, drone: 0.3, band: 0.4, breath: 0, events: 0.3 }),
});
/** How long the mix takes to come to a new moment (s), and the void's and the breath's own breathing (s a turn). */
export const EG_AIR_EASE_S = 1.5;
export const EG_AIR_VOID_BREATH_S = 47;
export const EG_AIR_LORD_BREATH_S = 6.5;
/** The events' period (s) - every kind's slot divides it. */
export const EG_AIR_PERIOD = 720;
/** THE EVENTS: each kind's slot (s), its share sounding, its clip (or clips, one chosen a time), its loudness and pitch
 *  spans, and its stand-in's height over the ear (the legion and the tear below, a bell above). `legion` every band's;
 *  `bands` each band's own. */
export const EG_AIR_EVENTS = Object.freeze({
  legion: Object.freeze({
    horn: Object.freeze({ slot: 45, chance: 0.5, clip: EG_HORN_KEY, volume: [0.35, 0.6], pitch: [0.5, 0.68], lift: -20 }),
    drums: Object.freeze({ slot: 36, chance: 0.45, clip: [EG_AIR_CLIPS.drums, EG_AIR_CLIPS.drumsArena], volume: [0.3, 0.5], pitch: [0.55, 0.75], lift: -25 }),
    roar: Object.freeze({ slot: 40, chance: 0.45, clip: EG_AIR_CLIPS.roar, volume: [0.3, 0.5], pitch: [0.4, 0.6], lift: -30 }),
    tear: Object.freeze({ slot: 30, chance: 0.5, clip: [EG_AIR_CLIPS.thunder, EG_AIR_CLIPS.thunderRoll], volume: [0.35, 0.6], pitch: [0.45, 0.65], lift: -40 }),
    fall: Object.freeze({ slot: 18, chance: 0.5, clip: [EG_AIR_CLIPS.grind, EG_AIR_CLIPS.clunk], volume: [0.2, 0.35], pitch: [0.35, 0.55], lift: -35 }),
  }),
  bands: Object.freeze([
    Object.freeze({ bell: Object.freeze({ slot: 48, chance: 0.5, clip: EG_AIR_CLIPS.bell, volume: [0.25, 0.4], pitch: [0.5, 0.62], lift: 15 }) }),
    Object.freeze({
      wail: Object.freeze({ slot: 20, chance: 0.55, clip: [EG_AIR_CLIPS.moan, EG_AIR_CLIPS.spookyHigh], volume: [0.25, 0.4], pitch: [1.05, 1.35], lift: 5 }),
      toll: Object.freeze({ slot: 60, chance: 0.6, clip: EG_AIR_CLIPS.bell, volume: [0.3, 0.45], pitch: [0.36, 0.42], lift: 10 }),
    }),
    Object.freeze({
      howl: Object.freeze({ slot: 24, chance: 0.5, clip: EG_AIR_CLIPS.howl, volume: [0.25, 0.4], pitch: [0.7, 0.9], lift: 0 }),
      whisper: Object.freeze({ slot: 16, chance: 0.4, clip: [EG_AIR_CLIPS.spookyMid, EG_AIR_CLIPS.spookyHigh], volume: [0.15, 0.25], pitch: [0.8, 1], lift: 0 }),
    }),
    Object.freeze({
      hammer: Object.freeze({ slot: 9, chance: 0.6, clip: EG_AIR_CLIPS.clunk, volume: [0.25, 0.4], pitch: [0.45, 0.6], lift: -10 }),
      blast: Object.freeze({ slot: 30, chance: 0.45, clip: EG_AIR_CLIPS.blast, volume: [0.3, 0.45], pitch: [0.4, 0.55], lift: -20 }),
    }),
  ]),
});
/** THE BANDS' VOICES (DAGGER.SND), each laid `n` times round its loop about `pitch` (`spread` either side), darkened at
 *  `hz`. */
export const EG_AIR_BANDS = Object.freeze([
  Object.freeze({ voices: Object.freeze([SOUND.AmbientWindBlow1, SOUND.AmbientWindBlow1a, SOUND.AmbientWindBlow1b]), pitch: 0.75, spread: 0.15, n: 6, hz: 2200 }),
  Object.freeze({ voices: Object.freeze([SOUND.AmbientWindMoan]), pitch: 0.62, spread: 0.18, n: 10, hz: 1400 }),
  Object.freeze({ voices: Object.freeze([SOUND.AmbientWindMoan]), pitch: 1.3, spread: 0.2, n: 8, hz: 3200 }),
  Object.freeze({ voices: Object.freeze([SOUND.Burning, EG_AIR_CLIPS.grind]), pitch: 0.6, spread: 0.1, n: 7, hz: 1800 }),
]);
/** THE DRONES: each band's partials `[Hz, level, lfo turns a loop, lfo depth, lfo phase]` - snapped to whole turns of the
 *  loop, so it meets itself; a partial written twice a turn or two apart beats. The Cairn's choir and the Wellhead's
 *  furnace are harmonic stacks (`stack`: a fundamental, its harmonics, their weights by a curve).
 *  @type {ReadonlyArray<{ partials: ReadonlyArray<ReadonlyArray<number>>, stack?: { hz: number, n: number, chorus: ReadonlyArray<number>, formants?: ReadonlyArray<ReadonlyArray<number>>, dark?: number, lfo: ReadonlyArray<number> } }>} */
export const EG_AIR_DRONES = Object.freeze([
  Object.freeze({ partials: [[82.41, 1, 1, 0.2, 0], [82.41 + 1 / 12, 0.6, 0, 0, 0], [123.47, 0.7, 2, 0.3, 1], [164.81, 0.5, 0, 0, 0], [246.94, 0.25, 3, 0.5, 2], [659.26, 0.06, 3, 1, 0], [698.46, 0.05, 2, 1, Math.PI]] }),
  Object.freeze({ partials: [[41.2, 0.35, 0, 0, 0], [98, 0.4, 1, 0.3, 0], [123.47, 0.45, 2, 0.3, 2]], stack: Object.freeze({ hz: 164.81, n: 16, chorus: [0, 1, 2], formants: [[450, 120, 1], [800, 160, 0.6], [2600, 300, 0.2]], lfo: [2, 0.4] }) }),
  Object.freeze({ partials: [[41.2, 0.6, 1, 0.3, 0], [82.41, 0.3, 0, 0, 0], [493.88, 0.12, 3, 0.9, 0], [523.25, 0.1, 2, 0.9, Math.PI], [1396.91, 0.03, 5, 1, 1]] }),
  Object.freeze({ partials: [], stack: Object.freeze({ hz: 41.2, n: 24, chorus: [0, 1], dark: 400, lfo: [6, 0.5] }) }),
]);
/** The made sounds' seed. */
export const EG_AIR_SEED = 0x53504952;

/** A small seeded hash, [0, 1). */
const hash01 = (n) => { let x = Math.imul((n | 0) ^ 0x2c1b3c6d, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
/** @param {number[]} r @param {number} u */
const span = (r, u) => r[0] + (r[1] - r[0]) * u;
/** A periodic swell over `n` samples: `turns` a loop, between 1 - depth and 1, from `phase`. */
function lfo(n, turns, depth, phase = 0) {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = 1 - depth * (0.5 - 0.5 * Math.cos((2 * Math.PI * turns * i) / n + phase));
  return a;
}
/** A sine added into `out`, whole over it: `hz` snapped to whole turns of the loop, at `amp`, from `phase`, shaped by
 *  `am` (a periodic swell) when given - the recurrence s[i+1] = 2cos(w)s[i] - s[i-1], two multiplies a sample. */
function addPartial(out, rate, hz, amp, phase = 0, am = null) {
  const n = out.length, turns = Math.max(1, Math.round((hz * n) / rate)), w = (2 * Math.PI * turns) / n, c = 2 * Math.cos(w);
  if (turns >= n / 2) return;
  let s0 = amp * Math.sin(phase - w), s1 = amp * Math.sin(phase);
  if (am) for (let i = 0; i < n; i++) { out[i] += s1 * am[i]; const s2 = c * s1 - s0; s0 = s1; s1 = s2; }
  else for (let i = 0; i < n; i++) { out[i] += s1; const s2 = c * s1 - s0; s0 = s1; s1 = s2; }
}

/**
 * THE VOID: white noise through a resonant band (a state-variable filter) whose centre sweeps 170-520 Hz twice a loop,
 * over brown noise darkened at 90 Hz - the roar and the rumble - breathing twice a loop; its last two seconds laid over
 * its first (an equal-power turn), so the loop meets itself. Pure: the seed chooses the noise.
 */
export function buildSpireVoid({ rate = EG_AIR_LOW_RATE, seconds = EG_AIR_SECONDS.void, seed = EG_AIR_SEED } = {}) {
  const n = Math.round(rate * seconds), x = Math.round(rate * 2), rng = seededRng(seed), raw = new Float32Array(n + x);
  let brown = 0, rumble = 0, low = 0, bandp = 0, f = 0, swell = 1;
  const a90 = 1 - Math.exp((-90 * 2 * Math.PI) / rate);
  for (let i = 0; i < n + x; i++) {
    if (i % 64 === 0) {   // the sweep and the breath move slowly: read each 64 samples (a sine a sample cost the build 60 ms)
      const u = (i % n) / n, fc = 170 + 350 * (0.5 - 0.5 * Math.cos(2 * Math.PI * 2 * u));
      f = 2 * Math.sin((Math.PI * fc) / rate);
      swell = 1 - 0.35 * (0.5 - 0.5 * Math.cos(2 * Math.PI * 2 * u + 1));
    }
    const wn = rng() * 2 - 1;
    brown = brown * 0.998 + wn * 0.06;
    rumble += a90 * (brown - rumble);
    const high = wn - low - 0.3 * bandp;   // Q about 3: the roar's ring
    bandp += f * high; low += f * bandp;
    raw[i] = (bandp * 0.55 + rumble * 2.2) * swell;
  }
  const out = raw.slice(0, n);
  for (let i = 0; i < x; i++) { const t = (i / x) * (Math.PI / 2); out[i] = raw[i] * Math.sin(t) + raw[n + i] * Math.cos(t); }
  return level(out, VOID_RMS);
}

/**
 * THE SPIRE'S DRONE for band `band` (EG_AIR_DRONES): its partials and its stack, each whole over the loop, the stack's
 * harmonics weighted by its formants (a sung vowel) or darkened (`dark` Hz), chorused a turn or two apart, the whole
 * swelling by its lfo. Pure.
 */
export function buildSpireDrone(band, { rate = EG_AIR_LOW_RATE, seconds = EG_AIR_SECONDS.drone } = {}) {
  const D = EG_AIR_DRONES[Math.max(0, Math.min(3, band | 0))], n = Math.round(rate * seconds), out = new Float32Array(n);
  for (const [hz, amp, turns, depth, phase] of D.partials) addPartial(out, rate, hz, amp, phase, depth > 0 ? lfo(n, turns, depth, phase) : null);
  const S = D.stack;
  if (S) {
    const am = lfo(n, S.lfo[0], S.lfo[1]);
    for (let k = 1; k <= S.n; k++) {
      const f = S.hz * k;
      let wgt = 1 / k;
      if (S.formants) { wgt = 0; for (const [fc, bw, g] of S.formants) wgt += g * Math.exp(-(((f - fc) / bw) ** 2)); wgt /= Math.sqrt(k); }
      if (S.dark) wgt *= Math.exp(-f / S.dark);
      if (wgt < 4e-3) continue;
      S.chorus.forEach((c, j) => addPartial(out, rate, f + c / seconds, wgt / S.chorus.length, (k * 1.7 + j * 2.3) % (2 * Math.PI), am));
    }
  }
  return level(out, DRONE_RMS);
}

/**
 * THE BAND'S VOICE for band `band` (EG_AIR_BANDS): each of `voices` (its DAGGER.SND records' samples, in the table's
 * order) laid over itself round the loop (sdAir.js layBed), summed and darkened. Pure; a missing voice is left out.
 * @param {number} band @param {ReadonlyArray<Float32Array | null | undefined>} voices
 */
export function buildSpireBand(band, voices, { srcRate = SND_RATE, rate = EG_AIR_RATE, seconds = EG_AIR_SECONDS.band } = {}) {
  const B = EG_AIR_BANDS[Math.max(0, Math.min(3, band | 0))], out = new Float32Array(Math.round(rate * seconds));
  voices.forEach((v, i) => {
    if (!v?.length) return;
    const lay = layBed(v, { srcRate, rate, seconds, n: B.n, pitch: B.pitch, spread: B.spread, seed: EG_AIR_SEED + band * 31 + i * 7, hz: B.hz });
    for (let j = 0; j < out.length; j++) out[j] += lay[j];
  });
  lowpassLoop(out, rate, B.hz);
  return level(out, BAND_RMS);
}

/** THE LORD'S BREATH: the deep moan laid low and slow round its loop (sdAir.js layBed). Pure. */
export function buildLordBreath(moanDeep, { srcRate = SND_RATE, rate = EG_AIR_RATE, seconds = EG_AIR_SECONDS.breath } = {}) {
  return level(layBed(moanDeep, { srcRate, rate, seconds, n: 6, pitch: 0.36, spread: 0.06, seed: EG_AIR_SEED + 911, hz: 700 }), BREATH_RMS);
}

/** The slots of `slotS` whose event could land in (from, to] on the unwrapped clock, each `[start, index in the period]`. */
function slotsOver(from, to, slotS) {
  const n = Math.round(EG_AIR_PERIOD / slotS), out = [];
  for (let k = Math.floor((from - slotS) / slotS); k <= Math.floor(to / slotS); k++) out.push([k * slotS, ((k % n) + n) % n]);
  return out;
}
/**
 * THE EVENTS in (from, to] on the breach's clock (seconds, unwrapped) for band `band` of a breach of `seed`: the legion's
 * and the band's own, `[{ t, kind, clip, volume, pitch, az, lift }]` in time order. Pure: the same events whoever asks
 * and whenever.
 */
export function egAirEvents(from, to, band = 0, seed = 0) {
  const out = [];
  if (!(to > from) || !Number.isFinite(from) || !Number.isFinite(to)) return out;
  const b = Math.max(0, Math.min(3, band | 0)), kinds = { ...EG_AIR_EVENTS.legion, ...EG_AIR_EVENTS.bands[b] };
  let salt = (seed >>> 0) % 100003;
  for (const [kind, E] of Object.entries(kinds)) {
    salt += 17 + b;
    for (const [base, s] of slotsOver(from, to, E.slot)) {
      const h = (j) => hash01(s * 97 + salt * 13 + j);
      if (h(0) >= E.chance) continue;
      const t = base + h(1) * (E.slot - 2);
      if (!(t > from && t <= to)) continue;
      const clip = Array.isArray(E.clip) ? E.clip[Math.floor(h(5) * E.clip.length)] : E.clip;
      out.push({ t, kind, clip, volume: span(E.volume, h(2)), pitch: span(E.pitch, h(3)), az: (h(4) * 2 - 1) * Math.PI, lift: E.lift });
    }
  }
  return out.sort((a, b2) => a.t - b2.t);
}

/** WHICH MOMENT the air is at for the score's place (scenes/eliteGates/egClient.js scoreView's `place`): null outside the
 *  Spire; `end` at the breach's end and for a fall's own time (SPIREEND's); `rest` at a Redoubt; `sleep` in a Court whose
 *  lord has not woken; `trial` in a hall's fight; `open` everywhere else (the gather, the arrival, the closing). Pure. */
export function egAirMoment(place) {
  if (!place) return null;
  if (place.end || (Number.isFinite(place.sinceFall) && place.sinceFall >= 0 && place.sinceFall < SPIRE_END_MS)) return 'end';
  if (place.sg === 'rest') return 'rest';
  if (place.sg === 'trial') return place.kind === 'court' && place.asleep ? 'sleep' : 'trial';
  return 'open';
}
/** The void's breathing at `seconds` (a share of its level), and the lord's. Pure. */
export const egAirVoidGain = (seconds) => 1 - 0.3 * (0.5 - 0.5 * Math.sin((2 * Math.PI * seconds) / EG_AIR_VOID_BREATH_S));
export const egAirBreathGain = (seconds) => 0.25 + 0.75 * (0.5 - 0.5 * Math.cos((2 * Math.PI * seconds) / EG_AIR_LORD_BREATH_S));

/** The engine whose beds are the Spire's - one at a time (a later boot's silences the old one's, the Deadlands' law). */
let _heard = null;
/** The name the Spire's far events are played under (audio.js fadeFar lets them go with it). */
export const EG_AIR_FAR = 'egAir';

/**
 * The Spire's air on the engine: `frame(place, seconds, ear, seed)` once a frame while I stand in a breach (`place` the
 * score's, `seconds` the breach's clock, `ear` the listener in the scene's frame, `seed` the breach's); `stop()` on every
 * other frame - silent, and nothing left looping.
 */
export function createEgAir(engine = defaultAudio) {
  let last = null, on = false, gains = null, buildsLeft = 0;
  /** The made sounds registered (their keys), and the samples built and not yet taken (no context to make them on). */
  const made = new Set(), built = new Map();
  /** The period's events for a band and a seed, read once each. */
  let periodKey = '', period = [];
  _heard?.stop();
  /** A made sound under `key`, built by `fn` (one a frame) at `rate` and registered once. Answers whether it stands. */
  const want = (key, fn, rate = EG_AIR_RATE) => {
    if (made.has(key)) return true;
    try {
      let s = built.get(key);
      if (!s) { if (buildsLeft <= 0) return false; buildsLeft--; s = fn(); if (!s) return false; built.set(key, s); }
      if (engine.registerSamples?.(key, s, rate)) { made.add(key); built.delete(key); return true; }
    } catch { /* a sound is never the breach */ }
    return false;
  };
  const voicesOf = (rs) => { const v = rs.map((r) => engine.samplesOf?.(r) ?? null); return v.every(Boolean) ? v : null; };
  const api = {
    get on() { return on; },
    /** The mix as it stands (tests). */
    get gains() { return gains; },
    frame(place, seconds, ear, seed = 0) {
      const moment = egAirMoment(place);
      if (!moment || !Number.isFinite(seconds) || !Array.isArray(ear) || ear.length !== 3) { if (!moment) api.stop(); return; }
      const band = Math.max(0, Math.min(3, place.band | 0)), dk = `${EG_AIR_KEYS.drone}:${band}`, bk = `${EG_AIR_KEYS.band}:${band}`;
      const target = EG_AIR_MIX[moment], dt = last != null && seconds > last ? Math.min(1, seconds - last) : 0;
      if (!gains) gains = { ...target };
      else for (const k of Object.keys(target)) gains[k] += (target[k] - gains[k]) * Math.min(1, dt / EG_AIR_EASE_S);
      buildsLeft = 1;
      try {
        if (want(EG_AIR_KEYS.void, () => buildSpireVoid(), EG_AIR_LOW_RATE)) engine.setBed(EG_AIR_BEDS.void, EG_AIR_KEYS.void, { volume: EG_AIR_LEVEL.void * gains.void * egAirVoidGain(seconds) });
        if (want(dk, () => buildSpireDrone(band), EG_AIR_LOW_RATE)) engine.setBed(EG_AIR_BEDS.drone, dk, { volume: EG_AIR_LEVEL.drone * gains.drone });
        if (want(bk, () => { const v = voicesOf(EG_AIR_BANDS[band].voices); return v ? buildSpireBand(band, v) : null; })) engine.setBed(EG_AIR_BEDS.band, bk, { volume: EG_AIR_LEVEL.band * gains.band });
        const breathing = gains.breath > 0.01;
        if (!breathing) engine.setBed(EG_AIR_BEDS.breath, null);
        else if (want(EG_AIR_KEYS.breath, () => { const m = engine.samplesOf?.(EG_AIR_CLIPS.moanDeep); return m ? buildLordBreath(m) : null; })) engine.setBed(EG_AIR_BEDS.breath, EG_AIR_KEYS.breath, { volume: EG_AIR_LEVEL.breath * gains.breath * egAirBreathGain(seconds) });
        want(EG_HORN_KEY, () => buildEgHorn(), EG_HORN_RATE);
        on = true;
        if (last != null && seconds > last && seconds - last <= AIR_BACKLOG_S) {
          const pk = `${band}:${seed >>> 0}`;
          if (pk !== periodKey) { periodKey = pk; period = egAirEvents(0, EG_AIR_PERIOD, band, seed); }
          const P = EG_AIR_PERIOD, from = last - Math.floor(last / P) * P, to = from + (seconds - last);
          for (const e of period) {
            if (!((e.t > from && e.t <= to) || (e.t + P > from && e.t + P <= to))) continue;
            if (typeof e.clip === 'string' && !made.has(e.clip)) continue;
            engine.play3d(e.clip, airSourceAt(ear, e.az, e.lift), e.volume * gains.events, { refDistance: THUNDER_SOURCE_M, pitch: e.pitch, far: EG_AIR_FAR });
          }
        }
      } catch { /* a sound is never the breach */ }
      last = seconds;
    },
    stop() {
      last = null; gains = null;
      if (!on) return;
      on = false;
      try {
        for (const name of Object.values(EG_AIR_BEDS)) engine.setBed(name, null);
        engine.fadeFar?.(EG_AIR_FAR);   // and its events still sounding, with them
      } catch { /* nothing left to stop */ }
    },
  };
  return (_heard = api);
}
