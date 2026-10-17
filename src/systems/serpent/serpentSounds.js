// @ts-check
// SERPENT1 (2026-10-04, Mac: "a large scale sea serpent in the ocean"): SETHRAKUL'S VOICE - DAGGER.SND's own records by
// index, never a new clip (the game data stays the player's - Port-Doctrine): the Dreugh's bark, the Bay's own sea-thing,
// pitched down an octave and more for a beast a hundred and seventy metres long; the Lamia's hiss under it as the venom
// is spat and the coils close; the sea's own splashes and bubbles (systems/naval/navalSounds.js NAVAL_CLASSIC) thrown up
// deep and loud for the breach and the lash. Design: bible/11-Multiplayer/Sea-Serpent.md section 9.
//
// THE DISTANCES ARE A LEVIATHAN'S. A navalSounds.js gun carries 2400 m; the serpent's roar carries further - a ship
// sailing in hears it before she sees it - and its death cry furthest of all. Each cue says its clip, its pitch, its
// loudness and its reach; `playSerpentSound` plays one through the bus's play3d (a sound is never the fight - a bus not
// ready, a record missing, is silence).
//
// Not a DFU member. Ledger A (SERPENT1).
import { ENEMY_BASICS } from '../../characters/enemy/enemyBasics.js';
import { NAVAL_CLASSIC } from '../naval/navalSounds.js';

/** The mobiles whose voices it borrows (enemyBasics.js rows - the Dreugh, the Lamia). */
export const SERPENT_VOICE_ROWS = Object.freeze({ dreugh: 41, lamia: 42 });
const DREUGH = ENEMY_BASICS[SERPENT_VOICE_ROWS.dreugh], LAMIA = ENEMY_BASICS[SERPENT_VOICE_ROWS.lamia];
const cue = (clip, pitch, volume, refDistance, maxDistance) => Object.freeze({ clip, pitch, volume, refDistance, maxDistance });

/** The serpent host's sound keys (scenes/serpentHost.js deps.sound) and what each plays. */
export const SERPENT_SOUNDS = Object.freeze({
  roar: cue(DREUGH.barkSound, 0.42, 2.2, 60, 3200),
  hiss: cue(LAMIA.attackSound, 0.55, 1.6, 30, 1400),
  bubbles: cue(NAVAL_CLASSIC.bubbles, 0.55, 1.8, 30, 1400),
  breach: cue(NAVAL_CLASSIC.splashLarge, 0.48, 2.3, 50, 2400),
  lash: cue(NAVAL_CLASSIC.splashLarge, 0.68, 1.9, 40, 1800),
  splash: cue(NAVAL_CLASSIC.splashSmall, 0.8, 1.3, 14, 700),
  death: cue(DREUGH.barkSound, 0.3, 2.6, 90, 4200),
});

/** Play cue `key` at scene `pos`, `vol` times its own loudness, through `audio.play3d` - silence for a key it has not. */
export function playSerpentSound(audio, key, pos, vol = 1) {
  const c = SERPENT_SOUNDS[/** @type {keyof typeof SERPENT_SOUNDS} */ (key)];
  if (!c || !audio?.play3d || !pos) return false;
  try { audio.play3d(c.clip, pos, c.volume * vol, { refDistance: c.refDistance, maxDistance: c.maxDistance, pitch: c.pitch }); } catch { return false; }
  return true;
}
