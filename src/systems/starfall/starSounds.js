// @ts-check
// STAR4 (2026-10-20): THE STARFALL'S SOUNDS - DAGGER.SND's own records, pitched; no new clip (the serpent's law,
// systems/serpent/serpentSounds.js). Design: bible/11-Multiplayer/Starfall.md section 8. The landing's thunder is the
// storms' own (systems/distantStorms.js thunderOf): a clip by its distance, heard its distance late.
//
// A cue with no reach is heard everywhere it is said (the omen's whine, the fall's roar - the sky's); the rest at the
// star, by distance. Not a DFU member. Ledger A (STARFALL).
import { SOUND } from '../soundClips.js';
import { SPEED_OF_SOUND } from '../distantStorms.js';

const cue = (clip, pitch, volume, refDistance = 0, maxDistance = 0) => Object.freeze({ clip, pitch, volume, refDistance, maxDistance });

/** The Starfall host's sound keys (scenes/starfall/starfallHost.js) and what each plays. */
export const STAR_SOUNDS = Object.freeze({
  /** the omen: a new star's thin rising whine over the region */
  omen: cue(SOUND.AmbientWindMoan, 1.7, 0.55),
  /** the fall: the star's roar as it comes down */
  fall: cue(SOUND.Burning, 0.42, 0.9),
  /** the landing, near: the stone striking the earth (the thunder is the storms') */
  impact: cue(SOUND.SpellImpactFire, 0.38, 2.4, 40, 1600),
  /** the star's hum, near it */
  hum: cue(SOUND.AmbientWindMoanDeep, 1.35, 0.35, 6, 40),
  /** a blow landing on the star */
  blow: cue(SOUND.SpellImpactMagic, 1.45, 0.7, 8, 70),
  /** the master's coming */
  master: cue(SOUND.SpookyMid, 0.6, 1.8, 30, 900),
  /** its circle broken */
  circle: cue(SOUND.SpellImpactMagic, 0.75, 1.3, 20, 400),
  /** held: the thread burning away */
  held: cue(SOUND.Burning, 1.25, 1.4, 20, 600),
  /** lost: the light going out */
  dark: cue(SOUND.AmbientWindMoanDeep, 0.5, 1.6, 30, 900),
});

/** AUDIT STARFALL R7: how long after the landing a cue made at the star reaches a player `d` metres off, ms - the
 *  storms' own speed of sound (systems/distantStorms.js thunderOf), so the stone's strike comes with its thunder and
 *  never with its flash. Pure. */
export const starHeardAfterMs = (/** @type {number} */ d) => (Math.max(0, Number.isFinite(d) ? d : 0) / SPEED_OF_SOUND) * 1000;

/** Play cue `key` - at scene `pos` by its reach, or everywhere for a cue with none (or no `pos`) - `vol` times its own
 *  loudness. False for a key it has not, or an audio that would not. */
export function playStarSound(audio, key, pos = null, vol = 1) {
  const c = STAR_SOUNDS[/** @type {keyof typeof STAR_SOUNDS} */ (key)];
  if (!c || !audio) return false;
  try {
    if (!c.maxDistance || !pos) { if (!audio.playOneShot) return false; audio.playOneShot(c.clip, c.volume * vol, c.pitch); }
    else { if (!audio.play3d) return false; audio.play3d(c.clip, pos, c.volume * vol, { refDistance: c.refDistance, maxDistance: c.maxDistance, pitch: c.pitch }); }
  } catch { return false; }
  return true;
}
