// @ts-check
// NAV-E (2026-09-28) - THE SEA FIGHT'S SOUNDS, at run time: the ten clips tools/navalSfx.mjs synthesises (public/sfx/
// naval-*.wav, provenance in public/sfx/SOURCES.md) registered on the audio bus under string keys - the door a mod's
// WAV already uses (audio.registerSound, MW-D40; the Thunderlock's own loader in systems/thunderlock.js) - and the
// distances every sound the naval host plays is heard over. DAGGER.SND's own (the splashes, the ship's bell that
// rings when a ship strikes her colours, the bubbles of a ship going down, the burning loop) play by their indices.
//
// THE DISTANCES ARE A SEA'S. The bus's default 3D profile (refDistance 1, inverse) is a footstep's: a long gun at
// 300 m would reach the ear at a three-hundredth of its level, and a broadside across the bay - the sound Black Flag's
// open sea is made of - would be silence. Each key here says how far off it still carries (`refDistance`: full level
// inside it, inverse beyond; `maxDistance`: gone past it); the host passes them to audio.play3d.
import { APP_ROOT } from '../appRoot.js';

/** The keys the naval host plays. */
export const NAVAL_SFX = Object.freeze({
  cannon: 'naval:cannon',
  cannonFar: 'naval:cannon-far',
  swivel: 'naval:swivel',
  hit: 'naval:hit',
  blast: 'naval:blast',
  grapple: 'naval:grapple',
  runout: 'naval:runout',
  ready: 'naval:ready',
  sinking: 'naval:sinking',
  whistle: 'naval:whistle',   // COMBAT-FEEL NEAR-MISS: a ball going by close
});
/** Each key's file under public/sfx. */
export const NAVAL_SFX_FILES = Object.freeze({
  [NAVAL_SFX.cannon]: 'naval-cannon.wav',
  [NAVAL_SFX.cannonFar]: 'naval-cannon-far.wav',
  [NAVAL_SFX.swivel]: 'naval-swivel.wav',
  [NAVAL_SFX.hit]: 'naval-hit.wav',
  [NAVAL_SFX.blast]: 'naval-blast.wav',
  [NAVAL_SFX.grapple]: 'naval-grapple.wav',
  [NAVAL_SFX.runout]: 'naval-runout.wav',
  [NAVAL_SFX.ready]: 'naval-ready.wav',
  [NAVAL_SFX.sinking]: 'naval-sinking.wav',
  [NAVAL_SFX.whistle]: 'naval-whistle.wav',
});
/** DAGGER.SND's own, by index (SoundClips): the splashes, the bell, the bubbles, the fire. */
export const NAVAL_CLASSIC = Object.freeze({ splashLarge: 342, splashSmall: 346, bell: 107, bubbles: 114, burning: 420 });

/** How far each is heard (m): full level within `refDistance`, inverse past it, gone past `maxDistance`. */
export const NAVAL_SOUND_RANGE = Object.freeze({
  [NAVAL_SFX.cannon]: Object.freeze({ refDistance: 30, maxDistance: 2400 }),
  [NAVAL_SFX.cannonFar]: Object.freeze({ refDistance: 70, maxDistance: 3000 }),
  [NAVAL_SFX.swivel]: Object.freeze({ refDistance: 14, maxDistance: 1200 }),
  [NAVAL_SFX.hit]: Object.freeze({ refDistance: 16, maxDistance: 1000 }),
  [NAVAL_SFX.blast]: Object.freeze({ refDistance: 26, maxDistance: 1800 }),
  [NAVAL_SFX.grapple]: Object.freeze({ refDistance: 6, maxDistance: 240 }),
  // the run-out is the tell: carried further than a ship's own timbers would, so a helm hears it from across the fight
  [NAVAL_SFX.runout]: Object.freeze({ refDistance: 24, maxDistance: 900 }),
  // AUDIT NAV1 (the presentation): a battery of mine ready - heard at my own helm, a word for the player alone
  [NAVAL_SFX.ready]: Object.freeze({ refDistance: 10, maxDistance: 80 }),
  // COMBAT-FEEL NEAR-MISS: a ball going by - heard where it passed her, at her rail and at her helm, and nowhere else
  [NAVAL_SFX.whistle]: Object.freeze({ refDistance: 8, maxDistance: 90 }),
  [NAVAL_CLASSIC.splashLarge]: Object.freeze({ refDistance: 12, maxDistance: 600 }),
  [NAVAL_CLASSIC.splashSmall]: Object.freeze({ refDistance: 6, maxDistance: 300 }),
  [NAVAL_CLASSIC.bell]: Object.freeze({ refDistance: 20, maxDistance: 900 }),
  [NAVAL_CLASSIC.bubbles]: Object.freeze({ refDistance: 14, maxDistance: 500 }),
});
/** A burning ship's loop: heard close by, linear to silence (a torch's profile, a ship's size). */
export const NAVAL_FIRE_LOOP = Object.freeze({ refDistance: 6, maxDistance: 90, distanceModel: 'linear' });
/** AUDIT NAV1 (the presentation, #15): a ship going down, the loop she groans in until she is gone - a hull's size,
 *  heard across a fight (one gurgle at the start was all, then silence for the rest of her going). */
export const NAVAL_SINK_LOOP = Object.freeze({ refDistance: 18, maxDistance: 420, distanceModel: 'linear' });
/** The range a key is played with - its own, or the bus's default for anything else. */
export const navalSoundRange = (key) => NAVAL_SOUND_RANGE[/** @type {any} */ (key)] ?? null;

export const navalSfxUrl = (file) => new URL(`sfx/${file}`, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;

let _sounds = null;
/** Register the ten clips, once (the first ship seen). Answers how many took; a clip that will not load is silence,
 *  never a stopped fight. */
export function installNavalSounds(audio, { fetchBytes = null } = {}) {
  if (!audio?.registerSound) return Promise.resolve(0);
  return (_sounds ??= (async () => {
    const load = fetchBytes ?? (async (file) => {
      const r = await fetch(navalSfxUrl(file));
      if (!r.ok) throw new Error(`${file}: ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    });
    let n = 0;
    for (const [key, file] of Object.entries(NAVAL_SFX_FILES)) {
      try { if (await audio.registerSound(key, await load(file))) n++; } catch { /* the gun still fires, silently */ }
    }
    return n;
  })());
}
/** Test seam. */
export function _resetNavalSounds() { _sounds = null; }
