// @ts-check
// SOUNDSCAPE (2026-10-24): THE SEA'S AND THE WILD'S CLIPS, at run time - the ones tools/soundscapeSfx.mjs synthesises
// and the CC0 recordings tools/soundscapeSfxInstall.mjs bakes (public/sfx/{sea,shore,wild,town}-*.wav, provenance in
// public/sfx/SOURCES.md), registered on the audio bus under string keys - the door a mod's WAV already uses
// (audio.registerSound, MW-D40; the naval host's own loader in systems/naval/navalSounds.js). Each group is a set of
// takes the player draws from, so no call is the same twice running. Daggerfall's own (the bell, the lap of water, the
// people) play by their DAGGER.SND indices and are not here.
import { APP_ROOT } from '../appRoot.js';
import { createClipInstaller } from './clipInstall.js';

/** @param {string} stem @param {number} n */
const takes = (stem, n) => Object.freeze(Array.from({ length: n }, (_, i) => `${stem}-${i + 1}`));

/** The keys, by group: each a take's key, which is its file's stem (`sea-slap-1` is public/sfx/sea-slap-1.wav). */
export const SCAPE_SFX = Object.freeze({
  seaSlap: takes('sea-slap', 3),
  seaCreak: takes('sea-creak', 2),
  seaRope: takes('sea-rope', 2),
  seaLuff: takes('sea-luff', 2),
  seaSpray: takes('sea-spray', 2),
  gull: takes('sea-gull', 6),
  shoreCrash: takes('shore-crash', 2),
  owl: takes('wild-owl', 2),
  howl: takes('wild-howl', 2),
  crow: takes('wild-crow', 1),
  frog: takes('wild-frog', 4),
  anvil: takes('town-anvil', 2),
});

/** Every key's file under public/sfx. */
export const SCAPE_SFX_FILES = Object.freeze(Object.fromEntries(Object.values(SCAPE_SFX).flat().map((key) => [key, `${key}.wav`])));

export const scapeSfxUrl = (/** @type {string} */ file) => new URL(`sfx/${file}`, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;

/** The loader (AUDIT SOUNDSCAPE S7: a first load that failed is asked again - clipInstall.js). */
const _installer = createClipInstaller(SCAPE_SFX_FILES, { urlOf: scapeSfxUrl });
/** Register every clip: asked every frame the soundscape is heard; answers the pass in flight, or the last one's count.
 *  A clip that will not load is silence, never a stopped voyage. @param {any} audio */
export const installSoundscapeSounds = (audio) => _installer.install(audio);
/** Whether a clip stands on the bus. */
export const soundscapeSoundReady = (/** @type {string} */ key) => _installer.has(key);
/** Test seam. */
export function _resetSoundscapeSounds() { _installer._reset(); }
