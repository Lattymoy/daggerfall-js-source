// @ts-check
// WB6b (2026-09-25, Mac: "the arena needs to be an oblivion masterpiece ... Whole thing needs to feel alive"): THE
// DEADLANDS' AIR - what the Burning Court sounds like under its sky. Design: bible/11-Multiplayer/World-Bosses.md
// section 4 ("The Deadlands").
//
// THE BEDS, always under the court: the deep moan of the wind over the fire (a named loop - audio.setLoop, the riding
// loop's shape - its gain breathing on the Deadlands' clock), the sea's roar (the fire's own clip pitched down to a
// rumble), and each brazier burning where it stands (a positional loop with the short linear reach DFU gives a torch).
//
// THE EVENTS, pure of everything but the clock (`deadlandsAirEvents`): the THUNDER of every strike the sky draws - the
// same slot, the same quarter (render/deadlands.js flashOfSlot) - late by its distance at the speed of sound, the crack
// near and the roll far; the ROARS of the Deadlands' beasts, far off in a quarter of their own; and the sea's PLOPS, a
// heavy splash pitched down to fire bursting on the fire. Each plays from a stand-in THUNDER_SOURCE_M from the ear in
// its quarter with `far` (systems/audio.js play3d: its offset from the ear held while it sounds - distantStorms.js's law),
// so it keeps its bearing and its level as the player turns and runs.
//
// The clock is the one the sky keeps (world.js deadlandsSeconds - the relay's), so a strike and its thunder are one
// moment on every screen. A gap between frames longer than AIR_BACKLOG_S (a tab put away) plays none of what it passed.
// The dungeon's own ambience (drips, doors, a bird) is silent in the court (scenes/dungeonContext.js): this is its air.
// Online alone - the court is. A sound is never the fight: every call is guarded.
// Not a DFU member. Ledger A (WB).
import { audio as defaultAudio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { AMBIENT_SOUNDS } from '../systems/ambientEffects.js';
import { SPEED_OF_SOUND, THUNDER_SOURCE_M } from '../systems/distantStorms.js';
import { DEAD_CLOCK_PERIOD, FLASH_SLOT_S, FLASH_DIST, LIFE_BRAZIERS_MAX, deadClock, flashOfSlot } from '../render/deadlands.js';

const [, CLIP_THUNDER, CLIP_ROLL] = AMBIENT_SOUNDS.storm;   // LightningThunder, ThunderRoll (SoundClips)
/** AmbientMonsterRoar (SoundClips.cs) - one of AMBIENT_SOUNDS.dungeon's. */
export const CLIP_ROAR = 73;

/** THE BEDS: the loops' names on the engine, their clips, their levels and pitches. The wind breathes WIND_BREATH_TURNS
 *  times a period (whole, so the clock can wrap) between (1 - depth) and its full gain. */
export const AIR_WIND = Object.freeze({ loop: 'deadlands:wind', clip: SOUND.AmbientWindMoanDeep, volume: 0.3, pitch: 0.74, breathTurns: 20, depth: 0.35 });
export const AIR_SEA = Object.freeze({ loop: 'deadlands:sea', clip: SOUND.Burning, volume: 0.26, pitch: 0.42 });
export const AIR_BRAZIER = Object.freeze({ loop: 'deadlands:brazier:', clip: SOUND.Burning, volume: 0.6, pitch: 0.9, refDistance: 1.5, maxDistance: 12, distanceModel: 'linear' });
/** THE EVENTS: a strike nearer than THUNDER_CRACK_NEAR_M cracks (its thunder clip), a further one rolls; the loudness
 *  runs from the nearest's to the furthest's. */
export const THUNDER_CRACK_NEAR_M = 1100;
export const THUNDER_VOLUME = Object.freeze([1.05, 0.5]);
export const THUNDER_PITCH = 0.86;
/** The roars: a slot of ROAR_SLOT_S (whole over the period), ROAR_CHANCE of them roaring, low and far. */
export const ROAR_SLOT_S = 30;
export const ROAR_CHANCE = 0.55;
/** The sea's plops: a slot of PLOP_SLOT_S (whole over the period), PLOP_CHANCE of them bursting. */
export const PLOP_SLOT_S = 4;
export const PLOP_CHANCE = 0.5;
/** A gap between frames longer than this plays none of what it passed. */
export const AIR_BACKLOG_S = 2;

/** A small seeded hash, [0, 1) - the events' own (the sky's strikes are read from flashOfSlot, never re-rolled here). */
const hash01 = (n) => { let x = Math.imul((n | 0) ^ 0x2545f491, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };

/**
 * The slots of `slotS` seconds whose event, `late` seconds at most after the slot's start, could land in (from, to]
 * on the unwrapped clock - each as `[base, wrapped]`: the slot's start and its index within the period.
 */
function slotsOver(from, to, slotS, late) {
  const n = Math.round(DEAD_CLOCK_PERIOD / slotS);
  const out = [];
  for (let k = Math.floor((from - late) / slotS); k <= Math.floor(to / slotS); k++) out.push([k * slotS, ((k % n) + n) % n]);
  return out;
}

/**
 * THE EVENTS in (from, to] on the Deadlands' clock (seconds, unwrapped - `to - from` a frame's step): `[{ t, kind, clip,
 * volume, pitch, az, lift }]` in time order - `az` the quarter (render/deadlands.js deadAzimuth's sense: 0 toward the
 * boss from the arrival, turning toward +x), `lift` the stand-in's height over the ear. Pure: the same events whoever
 * asks and whenever.
 */
export function deadlandsAirEvents(from, to) {
  const out = [];
  if (!(to > from) || !Number.isFinite(from) || !Number.isFinite(to)) return out;
  const lateMax = FLASH_DIST[1] / SPEED_OF_SOUND + FLASH_SLOT_S;
  for (const [base, s] of slotsOver(from, to, FLASH_SLOT_S, lateMax)) {
    const f = flashOfSlot(s);
    if (!f) continue;
    const t = base + (f.at - s * FLASH_SLOT_S) + f.dist / SPEED_OF_SOUND;
    if (!(t > from && t <= to)) continue;
    const far = (f.dist - FLASH_DIST[0]) / (FLASH_DIST[1] - FLASH_DIST[0]);
    out.push({ t, kind: 'thunder', clip: f.dist < THUNDER_CRACK_NEAR_M ? CLIP_THUNDER : CLIP_ROLL, volume: THUNDER_VOLUME[0] + (THUNDER_VOLUME[1] - THUNDER_VOLUME[0]) * far, pitch: THUNDER_PITCH, az: f.az, lift: 6 });
  }
  for (const [base, s] of slotsOver(from, to, ROAR_SLOT_S, ROAR_SLOT_S)) {
    if (hash01(s * 5 + 1) >= ROAR_CHANCE) continue;
    const t = base + hash01(s * 5 + 2) * (ROAR_SLOT_S - 6);
    if (!(t > from && t <= to)) continue;
    out.push({ t, kind: 'roar', clip: CLIP_ROAR, volume: 0.3 + hash01(s * 5 + 3) * 0.3, pitch: 0.5 + hash01(s * 5 + 4) * 0.22, az: (hash01(s * 5 + 5) * 2 - 1) * Math.PI, lift: 2 });
  }
  for (const [base, s] of slotsOver(from, to, PLOP_SLOT_S, PLOP_SLOT_S)) {
    if (hash01(s * 7 + 11) >= PLOP_CHANCE) continue;
    const t = base + hash01(s * 7 + 12) * PLOP_SLOT_S;
    if (!(t > from && t <= to)) continue;
    out.push({ t, kind: 'plop', clip: SOUND.SplashLarge, volume: 0.1 + hash01(s * 7 + 13) * 0.16, pitch: 0.34 + hash01(s * 7 + 14) * 0.2, az: (hash01(s * 7 + 15) * 2 - 1) * Math.PI, lift: -8 });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Where an event is played from: THUNDER_SOURCE_M out from the ear in its quarter, `lift` over it. Pure. */
export function airSourceAt(ear, az, lift) {
  return [ear[0] + Math.sin(az) * THUNDER_SOURCE_M, ear[1] + lift, ear[2] - Math.cos(az) * THUNDER_SOURCE_M];
}

/** The wind's gain at `seconds`: breathing between (1 - depth) and its full level, whole over the period. Pure. */
export function airWindGain(seconds) {
  const u = (deadClock(seconds) / DEAD_CLOCK_PERIOD) * AIR_WIND.breathTurns * 2 * Math.PI;
  return AIR_WIND.volume * (1 - AIR_WIND.depth * (0.5 - 0.5 * Math.sin(u)));
}

/** The air the engine's loops are the Deadlands' for - one at a time. A later boot's (a load taken from the court's
 *  pause menu starts a new host on the same page, and the old host's loop dies where it stands, never calling stop)
 *  silences the old one's loops as it is made. */
let _heard = null;

/**
 * The court's air on the engine: `frame(seconds, ear, braziers)` once a frame while the court stands under the player
 * (`seconds` the Deadlands' clock, `ear` the listener in the dungeon's frame, `braziers` the fire beds in it);
 * `stop()` on every other frame - silent, and nothing left looping.
 */
export function createDeadlandsAir(engine = defaultAudio) {
  let last = null;
  let on = false;
  let beds = 0;
  _heard?.stop();
  return _heard = {
    get on() { return on; },
    frame(seconds, ear, braziers = []) {
      if (!Number.isFinite(seconds) || !Array.isArray(ear) || ear.length !== 3) return;
      try {
        engine.setLoop(AIR_WIND.loop, AIR_WIND.clip, { volume: airWindGain(seconds), pitch: AIR_WIND.pitch });
        engine.setLoop(AIR_SEA.loop, AIR_SEA.clip, { volume: AIR_SEA.volume, pitch: AIR_SEA.pitch });
        const lit = (Array.isArray(braziers) ? braziers : []).filter((p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)).slice(0, LIFE_BRAZIERS_MAX);
        lit.forEach((p, i) => engine.setLoop3d(AIR_BRAZIER.loop + i, AIR_BRAZIER.clip, p, { volume: AIR_BRAZIER.volume, pitch: AIR_BRAZIER.pitch, refDistance: AIR_BRAZIER.refDistance, maxDistance: AIR_BRAZIER.maxDistance, distanceModel: AIR_BRAZIER.distanceModel }));
        for (let i = lit.length; i < beds; i++) engine.setLoop3d(AIR_BRAZIER.loop + i, null, null);
        beds = lit.length;
        on = true;
        if (last != null && seconds > last && seconds - last <= AIR_BACKLOG_S) {
          for (const e of deadlandsAirEvents(last, seconds)) engine.play3d(e.clip, airSourceAt(ear, e.az, e.lift), e.volume, { refDistance: THUNDER_SOURCE_M, pitch: e.pitch, far: true });
        }
      } catch { /* a sound is never the fight */ }
      last = seconds;
    },
    stop() {
      last = null;
      if (!on) return;
      on = false;
      try {
        engine.setLoop(AIR_WIND.loop, null);
        engine.setLoop(AIR_SEA.loop, null);
        for (let i = 0; i < beds; i++) engine.setLoop3d(AIR_BRAZIER.loop + i, null, null);
      } catch { /* nothing left to stop */ }
      beds = 0;
    },
  };
}

