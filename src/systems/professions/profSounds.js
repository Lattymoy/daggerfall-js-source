// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF-SCENES (2026-10-01, Mac: "all minigames should be overhauled to
// be more detailed and use the enhanced plus UI look"): THE ACTS'
// SOUNDS. Professions-Arc.md's accessibility law - every cue is a shape
// and a sound as well as a colour - had its shapes and colours, and no
// act made a sound. One table of Daggerfall's own clips
// (systems/soundClips.js), one door: an act's face names a CUE, this
// says which clip and how loud. The sink is the audio engine's
// one-shot; the pins swap it.
// ═══════════════════════════════════════════════════════════════════
import { audio } from '../audio.js';
import { SOUND } from '../soundClips.js';

/** DFU's five hit clips, Hit1..Hit5 (DAGGER.SND 108..112) - EnemySounds' own roll. */
const HITS = Object.freeze([0, 1, 2, 3, 4].map((i) => SOUND.Hit1 + i));

/** The cues: a clip or a roll of them, and a volume (0..1, under the player's Sound volume). */
export const PROF_CUES = Object.freeze({
  strike: Object.freeze({ clips: HITS, volume: 0.55 }),                         // a blow off the glint, a chop off the notch
  glint: Object.freeze({ clips: Object.freeze([SOUND.Parry6]), volume: 0.8 }),  // a blow on the glint, the anvil in the band: metal rings
  clean: Object.freeze({ clips: Object.freeze([SOUND.ActivateLockUnlock]), volume: 0.6 }),   // a clean finish
  swing: Object.freeze({ clips: Object.freeze([SOUND.SwingLowPitch]), volume: 0.45 }),       // a stroke that met nothing (a basket's miss, a throw)
  splash: Object.freeze({ clips: Object.freeze([SOUND.SplashLarge]), volume: 0.7 }),         // the net lands
  tug: Object.freeze({ clips: Object.freeze([SOUND.SplashLarge]), volume: 0.35 }),           // the floats dip
  tick: Object.freeze({ clips: Object.freeze([SOUND.ButtonClick]), volume: 0.3 }),           // a find, a point passed, a stitch
  slip: Object.freeze({ clips: Object.freeze([SOUND.SwingHighPitch]), volume: 0.35 }),       // a bruise, a slip, a tear
});

let _sink = (clip, volume) => audio.playOneShot(clip, volume);
let _roll = () => Math.random();

/** Say a cue: its clip (a roll's one) at its volume. Unknown names say nothing. False when nothing played. */
export function profCue(name) {
  const c = PROF_CUES[name];
  if (!c || !c.clips.length) return false;
  const clip = c.clips[Math.min(c.clips.length - 1, Math.floor(_roll() * c.clips.length))];
  try { _sink(clip, c.volume); } catch { return false; }
  return true;
}

/** The pins' door: the sink (clip, volume) and the roll (0..1). Nulls put the engine's back. */
export function setProfCueSink(sink = null, roll = null) {
  _sink = sink ?? ((clip, volume) => audio.playOneShot(clip, volume));
  _roll = roll ?? (() => Math.random());
}
