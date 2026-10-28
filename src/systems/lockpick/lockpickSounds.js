// @ts-check
// LOCKPICK (2026-10-26; bible/06-Systems/Lockpicking.md): THE TUMBLERS' EAR - what each press of the lock's window sounds.
// DAGGER.SND has the picked lock's chime (ActivateLockUnlock, which the world still plays as the lock opens) and no
// tumblers, so the seven clips are ours (tools/lockSfx.mjs -> public/sfx/lock-*.wav, provenance in public/sfx/SOURCES.md),
// registered on the bus under string keys the climb's way (player/climb/climbSounds.js) and played flat at the ear - the
// lock is in the player's hands. Off with the port's own sounds (systems/enhancedSounds.js - the enhanced skin's ES1
// switch), the window says DFU's button click where a pin sets and DFU's own sounds where a pick slips or snaps, the
// gathering's classic law (systems/professions/profSounds.js).
import { APP_ROOT } from '../appRoot.js';
import { enhancedSoundsOn } from '../enhancedSounds.js';
import { SOUND } from '../soundClips.js';

/** The sounds, each its clips' keys (a sound of several is never the one just heard). */
export const LOCK_SFX = Object.freeze({
  tick: Object.freeze(['lock:tick-1', 'lock:tick-2']),
  spring: Object.freeze(['lock:spring']),
  set: Object.freeze(['lock:set']),
  false: Object.freeze(['lock:false']),
  slip: Object.freeze(['lock:slip']),
  snap: Object.freeze(['lock:snap']),
});
/** Each key's file under public/sfx (`lock:tick-1` -> lock-tick-1.wav). */
export const LOCK_SFX_FILES = Object.freeze(Object.fromEntries(
  Object.values(LOCK_SFX).flat().map((key) => [key, `${key.replace(':', '-')}.wav`]),
));
/** What each answer of the machine (systems/lockpick/lockpickAct.js press, auto) sounds, at what volume: the lift a tick,
 *  a free pin its spring, a set its click (the last pin's too - the world's chime follows it), a spool its clunk. */
export const LOCK_CUES = Object.freeze({
  lift: Object.freeze(['tick', 0.55]), springy: Object.freeze(['spring', 0.5]), set: Object.freeze(['set', 0.75]),
  open: Object.freeze(['set', 0.8]), 'false-set': Object.freeze(['false', 0.7]), slip: Object.freeze(['slip', 0.6]),
  break: Object.freeze(['snap', 0.85]), already: Object.freeze(['tick', 0.3]),
});
/** The classic skin's: DFU's button click where a pin sets, opens or false-sets - and AUDIT LOCKPICK C13, DFU's own
 *  sounds for what costs: a snapped pick a blade's parry ring, a slip a short blade's scrape. */
export const LOCK_CLASSIC_CUES = Object.freeze({
  set: SOUND.ButtonClick, open: SOUND.ButtonClick, 'false-set': SOUND.ButtonClick, break: SOUND.Parry6, slip: SOUND.EquipShortBlade,
});
/** A clip's pitch moved by up to this either way, so a run of lifts never rings as one sample. */
export const LOCK_PITCH_JITTER = 0.05;

export const lockSfxUrl = (file) => new URL(`sfx/${file}`, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;
let _install = null;
/** Register the seven clips, once. Answers how many took; a clip that will not load is silence, never a stuck lock. */
export function installLockSounds(audio, { fetchBytes = null } = {}) {
  if (!audio?.registerSound) return Promise.resolve(0);
  return (_install ??= (async () => {
    const load = fetchBytes ?? (async (file) => {
      const r = await fetch(lockSfxUrl(file));
      if (!r.ok) throw new Error(`${file}: ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    });
    let n = 0;
    for (const [key, file] of Object.entries(LOCK_SFX_FILES)) {
      try { if (await audio.registerSound(key, await load(file))) n++; } catch { /* the lock is picked in silence */ }
    }
    return n;
  })());
}
/** Test seam. */
export function _resetLockSounds() { _install = null; }

/**
 * THE EAR: `cue(answer)` plays what a press answered. `audio` the bus (systems/audio.js); `on` the port's own sounds
 * (enhancedSoundsOn); `rand` the clip and its pitch.
 * @param {{ audio?: any, on?: () => boolean, rand?: () => number }} [o]
 */
export function createLockEar({ audio = null, on = enhancedSoundsOn, rand = Math.random } = {}) {
  let prev = null;
  if (audio && on()) installLockSounds(audio);
  return {
    /** @param {string|null} answer */
    cue(answer) {
      if (!audio || !answer) return null;
      if (!on()) {
        const clip = LOCK_CLASSIC_CUES[/** @type {keyof typeof LOCK_CLASSIC_CUES} */ (answer)];
        if (clip == null) return null;
        audio.playOneShot?.(clip, 0.6);
        return clip;
      }
      const c = LOCK_CUES[/** @type {keyof typeof LOCK_CUES} */ (answer)];
      if (!c) return null;
      installLockSounds(audio);
      const keys = LOCK_SFX[/** @type {keyof typeof LOCK_SFX} */ (c[0])];
      let key = keys[Math.floor(rand() * keys.length) % keys.length];
      if (keys.length > 1 && key === prev) key = keys[(keys.indexOf(key) + 1) % keys.length];
      prev = key;
      audio.playOneShot?.(key, c[1], 1 + LOCK_PITCH_JITTER * (2 * rand() - 1));
      return key;
    },
  };
}
