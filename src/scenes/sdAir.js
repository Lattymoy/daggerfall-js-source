// @ts-check
// SD14b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 7 and section 16's SD14b;
// Mac: "The detail needs to exceed that of the oblivion gates"): THE HOUR'S AIR - what the Shattered Hour sounds like
// between its blows. The Deadlands have three beds and three kinds of event (scenes/deadlandsAir.js); the Hour had none
// - its dungeon's drips and doors silenced (scenes/dungeonContext.js) and nothing put back but the Rift's bell.
//
// THE BEDS, always under the Hour:
//   THE VOID'S WIND - the deep moan pitched down further, its gain breathing on the Hour's clock;
//   THE HOUR'S WORKS - a clock's escapement heard everywhere and nowhere: a tick and a tock a second, the gears' grind
//     faint under them - MADE at runtime out of the player's own DAGGER.SND (the Orrery's clunk, the gears' grind), as
//     the Rift's bell is (systems/sdRiftSound.js), nothing shipped and nothing of Daggerfall's written into the tree;
//   THE ORRERY'S HUM - a drone where the stones turn, the ship's bell slowed to a hum and its fifth and its octave over
//     it, made the same way, heard in the hall;
//   THE ARENA'S GEARS - the grind, low, turning under the arena's floor where the Remnant waits.
// THE EVENTS, pure of everything but the clock (`sdAirEvents`), each in a slot of its own seconds, whole over the sky's
//   period (render/sdSky.js SD_SKY_PERIOD), a seeded share of them sounding: a BELL tolled far off, a GEAR falling
//   into the void below, the void's MOAN rising from under the Steps, the SHARDS of the endings grinding in the sky
//   overhead - each from a stand-in in its own quarter, far, held at its bearing as the player turns (the Deadlands'
//   law, scenes/deadlandsAir.js airSourceAt).
//
// The clock is the sky's (world.js deadlandsSeconds - the relay's, anchored), so a toll is one moment on every screen.
// A gap between frames longer than AIR_BACKLOG_S plays none of what it passed. A sound is never the fight: every call
// is guarded. Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { audio as defaultAudio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { SAMPLE_RATE as SND_RATE } from '../formats/sndFile.js';
import { addVoice, lowpass, level } from '../systems/arenaSound.js';
import { airSourceAt, AIR_BACKLOG_S } from './deadlandsAir.js';
import { THUNDER_SOURCE_M } from '../systems/distantStorms.js';
import { SD_SKY_PERIOD } from '../render/sdSky.js';
import { SD_ARENA, SD_ORRERY, realmToDungeon } from '../net/sdBrain.js';

/** DAGGER.SND's own: the Orrery's clunk (Parry6), the gears' grind, the ship's bell. */
const CLUNK = 433, GRIND = 68, BELL = 107;
/** THE BEDS: each loop's name on the engine, its clip (or made sound's key), its level and pitch; the wind breathes
 *  `breathTurns` times a period (whole, so the clock can wrap) between (1 - depth) and its full gain. */
export const SD_AIR_VOID = Object.freeze({ loop: 'sdair:void', clip: SOUND.AmbientWindMoanDeep, volume: 0.26, pitch: 0.55, breathTurns: 24, depth: 0.4 });
export const SD_AIR_WORKS = Object.freeze({ loop: 'sdair:works', clip: 'sd:works', volume: 0.2, pitch: 1 });
export const SD_AIR_HUM = Object.freeze({ loop: 'sdair:hum', clip: 'sd:hum', volume: 0.7, pitch: 1, refDistance: 8, maxDistance: 50, distanceModel: 'linear' });
export const SD_AIR_GEARS = Object.freeze({ loop: 'sdair:gears', clip: GRIND, volume: 0.5, pitch: 0.55, refDistance: 12, maxDistance: 70, distanceModel: 'linear' });
/** Where the hum and the gears stand: over the Orrery's centre, under the arena's. */
export const SD_AIR_HUM_AT = Object.freeze(realmToDungeon(SD_ORRERY.x, 3, SD_ORRERY.z));
export const SD_AIR_GEARS_AT = Object.freeze(realmToDungeon(SD_ARENA.x, -1, SD_ARENA.z));
/** THE EVENTS: each kind's slot (s, whole over the period), its share sounding, its clip, its loudness and pitch spans,
 *  and its stand-in's height over the ear (the void below, the shards above). */
export const SD_AIR_EVENTS = Object.freeze({
  toll: Object.freeze({ slot: 24, chance: 0.5, clip: BELL, volume: [0.25, 0.45], pitch: [0.38, 0.5], lift: 20 }),
  gear: Object.freeze({ slot: 12, chance: 0.45, clip: CLUNK, volume: [0.2, 0.35], pitch: [0.55, 0.85], lift: -25 }),
  moan: Object.freeze({ slot: 30, chance: 0.4, clip: SOUND.AmbientWindMoanDeep, volume: [0.2, 0.35], pitch: [0.45, 0.6], lift: -15 }),
  grind: Object.freeze({ slot: 36, chance: 0.5, clip: GRIND, volume: [0.15, 0.3], pitch: [0.3, 0.42], lift: 35 }),
});
/** The made sounds' rate, lengths (s) and levels (RMS). */
export const SD_AIR_RATE = 22050;
export const SD_WORKS_SECONDS = 2;
export const SD_HUM_SECONDS = 8;
const WORKS_RMS = 0.05, HUM_RMS = 0.06;

/** A small seeded hash, [0, 1). */
const hash01 = (n) => { let x = Math.imul((n | 0) ^ 0x51ed270b, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
/** @param {number[]} r @param {number} u */
const span = (r, u) => r[0] + (r[1] - r[0]) * u;

/**
 * THE HOUR'S WORKS: a tick (the clunk, high) on the second's start and a tock (lower, softer) half a loop on, the grind
 * faint and wrapped round the loop, darkened - one periodic loop of SD_WORKS_SECONDS. Pure.
 * @param {Float32Array | null | undefined} clunk
 * @param {Float32Array | null | undefined} grind
 */
export function buildHourWorks(clunk, grind, { srcRate = SND_RATE, rate = SD_AIR_RATE, seconds = SD_WORKS_SECONDS } = {}) {
  const out = new Float32Array(Math.round(rate * seconds));
  if (clunk?.length) {
    addVoice(out, rate, clunk, srcRate, { ratio: 1.6, offset: 0, gain: 1, wrap: true });
    addVoice(out, rate, clunk, srcRate, { ratio: 1.2, offset: seconds / 2, gain: 0.8, wrap: true });
  }
  if (grind?.length) addVoice(out, rate, grind, srcRate, { ratio: 0.5, offset: seconds * 0.3, gain: 0.12, wrap: true });
  lowpass(out, rate, 2500);
  return level(out, WORKS_RMS);
}

/**
 * THE ORRERY'S HUM: the bell slowed to a drone, its fifth and its octave over it at their own offsets, each wrapped round
 * the loop, darkened and swelling slowly - one periodic loop of SD_HUM_SECONDS. Pure.
 * @param {Float32Array | null | undefined} bell
 */
export function buildOrreryHum(bell, { srcRate = SND_RATE, rate = SD_AIR_RATE, seconds = SD_HUM_SECONDS } = {}) {
  const out = new Float32Array(Math.round(rate * seconds));
  if (bell?.length) {
    addVoice(out, rate, bell, srcRate, { ratio: 0.25, offset: 0, gain: 1, wrap: true });
    addVoice(out, rate, bell, srcRate, { ratio: 0.375, offset: seconds * 0.34, gain: 0.6, wrap: true });
    addVoice(out, rate, bell, srcRate, { ratio: 0.5, offset: seconds * 0.64, gain: 0.4, wrap: true });
  }
  lowpass(out, rate, 700);
  for (let i = 0; i < out.length; i++) out[i] *= 1 - 0.25 * (0.5 - 0.5 * Math.cos((2 * Math.PI * 2 * i) / out.length));   // two swells a loop, its end meeting its start
  return level(out, HUM_RMS);
}

/** The slots of `slotS` whose event could land in (from, to] on the unwrapped clock, each `[start, index in the period]`. */
function slotsOver(from, to, slotS) {
  const n = Math.round(SD_SKY_PERIOD / slotS), out = [];
  for (let k = Math.floor((from - slotS) / slotS); k <= Math.floor(to / slotS); k++) out.push([k * slotS, ((k % n) + n) % n]);
  return out;
}

/**
 * THE EVENTS in (from, to] on the Hour's clock (seconds, unwrapped): `[{ t, kind, clip, volume, pitch, az, lift }]` in
 * time order. Pure: the same events whoever asks and whenever.
 */
export function sdAirEvents(from, to) {
  const out = [];
  if (!(to > from) || !Number.isFinite(from) || !Number.isFinite(to)) return out;
  let salt = 0;
  for (const [kind, E] of Object.entries(SD_AIR_EVENTS)) {
    salt += 1;
    for (const [base, s] of slotsOver(from, to, E.slot)) {
      const h = (j) => hash01(s * 97 + salt * 13 + j);
      if (h(0) >= E.chance) continue;
      const t = base + h(1) * (E.slot - 2);
      if (!(t > from && t <= to)) continue;
      out.push({ t, kind, clip: E.clip, volume: span(E.volume, h(2)), pitch: span(E.pitch, h(3)), az: (h(4) * 2 - 1) * Math.PI, lift: E.lift });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/** The void's wind at `seconds`: breathing between (1 - depth) and its full level, whole over the period. Pure. */
export function sdAirWindGain(seconds) {
  const u = ((((seconds % SD_SKY_PERIOD) + SD_SKY_PERIOD) % SD_SKY_PERIOD) / SD_SKY_PERIOD) * SD_AIR_VOID.breathTurns * 2 * Math.PI;
  return SD_AIR_VOID.volume * (1 - SD_AIR_VOID.depth * (0.5 - 0.5 * Math.sin(u)));
}

/** The engine whose loops are the Hour's - one at a time (a later boot's silences the old one's, the Deadlands' law). */
let _heard = null;

/**
 * The Hour's air on the engine: `frame(seconds, ear)` once a frame while I stand in the Hour (`seconds` its clock, `ear`
 * the listener in the dungeon's frame); `stop()` on every other frame - silent, and nothing left looping.
 */
export function createSdAir(engine = defaultAudio) {
  let last = null, on = false, made = false;
  _heard?.stop();
  /** The two made sounds, registered once the archive is read and a context stands (asked again until then). */
  const make = () => {
    if (made || !engine?.registerSamples || !engine?.samplesOf) return made;
    try {
      const clunk = engine.samplesOf(CLUNK), bell = engine.samplesOf(BELL);
      if (!clunk || !bell) return false;
      made = !!engine.registerSamples(SD_AIR_WORKS.clip, buildHourWorks(clunk, engine.samplesOf(GRIND)), SD_AIR_RATE)
        && !!engine.registerSamples(SD_AIR_HUM.clip, buildOrreryHum(bell), SD_AIR_RATE);
    } catch { made = false; }
    return made;
  };
  return _heard = {
    get on() { return on; },
    frame(seconds, ear) {
      if (!Number.isFinite(seconds) || !Array.isArray(ear) || ear.length !== 3) return;
      try {
        engine.setLoop(SD_AIR_VOID.loop, SD_AIR_VOID.clip, { volume: sdAirWindGain(seconds), pitch: SD_AIR_VOID.pitch });
        engine.setLoop3d(SD_AIR_GEARS.loop, SD_AIR_GEARS.clip, SD_AIR_GEARS_AT, { volume: SD_AIR_GEARS.volume, pitch: SD_AIR_GEARS.pitch, refDistance: SD_AIR_GEARS.refDistance, maxDistance: SD_AIR_GEARS.maxDistance, distanceModel: SD_AIR_GEARS.distanceModel });
        if (make()) {
          engine.setLoop(SD_AIR_WORKS.loop, SD_AIR_WORKS.clip, { volume: SD_AIR_WORKS.volume, pitch: SD_AIR_WORKS.pitch });
          engine.setLoop3d(SD_AIR_HUM.loop, SD_AIR_HUM.clip, SD_AIR_HUM_AT, { volume: SD_AIR_HUM.volume, pitch: SD_AIR_HUM.pitch, refDistance: SD_AIR_HUM.refDistance, maxDistance: SD_AIR_HUM.maxDistance, distanceModel: SD_AIR_HUM.distanceModel });
        }
        on = true;
        if (last != null && seconds > last && seconds - last <= AIR_BACKLOG_S) {
          for (const e of sdAirEvents(last, seconds)) engine.play3d(e.clip, airSourceAt(ear, e.az, e.lift), e.volume, { refDistance: THUNDER_SOURCE_M, pitch: e.pitch, far: true });
        }
      } catch { /* a sound is never the fight */ }
      last = seconds;
    },
    stop() {
      last = null;
      if (!on) return;
      on = false;
      try {
        engine.setLoop(SD_AIR_VOID.loop, null);
        engine.setLoop(SD_AIR_WORKS.loop, null);
        engine.setLoop3d(SD_AIR_HUM.loop, null, null);
        engine.setLoop3d(SD_AIR_GEARS.loop, null, null);
      } catch { /* nothing left to stop */ }
    },
  };
}
