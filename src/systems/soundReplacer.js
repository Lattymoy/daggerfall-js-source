// SNDREP1 (2026-09-23): LOOSE SOUND REPLACEMENT - Daggerfall Unity's
// StreamingAssets/Sound/<SoundClips name>.wav, from a pack the PLAYER attaches.
//
// DFU's SoundReader looks for a loose WAV named after the SoundClips entry
// before it reads DAGGER.SND, so a mod that drops `AmbientCrickets.wav` there
// replaces that clip everywhere the game plays it. This is that, for the clips
// listed below: the engine's buffer door (audio.js _buffer) answers the
// replacement for the classic index once it has decoded, and the classic
// DAGGER.SND record until then (or for good, with no pack attached).
//
// NOTHING IS BUNDLED. Sound mods carry their authors' own terms (the one this
// was written for, "Crickets and Howl Replacer", forbids re-uploading its files
// and using its assets without permission), so the WAVs never enter the repo or
// the build: the player attaches the mod's Sound folder from the Replacement
// packs card ("Attach sound pack", scenes/dataSource.js pickSoundFolder) and the
// files stay in their browser, exactly like a music or texture pack.
//
// AND TWO SWITCHES (uiPrefs `nightCrickets`, `distantHowl`): either sound can
// be turned OFF outright - replaced or classic, it simply does not play.

import { getPref } from './uiPrefs.js';

/** Classic sound INDEX (SoundClips) -> the loose file's name, and the pref that silences it. */
export const SOUND_REPLACEMENTS = Object.freeze({
  6: 'AmbientCrickets',       // SoundClips.AmbientCrickets - the night loop (systems/ambientEffects.js AMBIENT_CRICKETS_LOOP)
  113: 'AmbientDistantHowl',  // SoundClips.AmbientDistantHowl - a cemetery's ambient one-shot, and wherever else it plays
});
export const SOUND_SWITCHES = Object.freeze({ 6: 'nightCrickets', 113: 'distantHowl' });

export const soundBufferKey = (name) => `rep:${name}`;   // the engine's buffer key for a replacement (musicReplacement.js has its own replacementKey, a song key)
/** The clip name a supplied file answers for (`AmbientCrickets.wav`, any case), or null. */
export function soundEntry(fileName) {
  const base = String(fileName ?? '').split(/[\\/]/).pop().toLowerCase();
  for (const name of Object.values(SOUND_REPLACEMENTS)) if (base === `${name.toLowerCase()}.wav`) return name;
  return null;
}

let _files = new Map();   // clip name -> stored file name
let _load = null;         // stored file name -> Promise<Uint8Array|null>
let _gen = 0;             // bumps when the pack CHANGES, so the engine re-reads a new or re-attached pack
let _sig = '';            // the registered pack's clip -> file pairs, for telling a change from a repeat

/** The attached pack: the stored names and their loader. Answers how many clips it covers.
 *  AUDIT 68 S20-v-soundrep-regen: every host boot and dungeon entry re-registers the SAME pack (ensureAudio), and
 *  a bump per call re-decoded both clips each time. The generation moves only when the pack does - other names,
 *  another loader, or `reattach` (the player picked a folder again: the same names may hold new bytes). */
export function setSoundReplacements(fileNames, load, { reattach = false } = {}) {
  const files = new Map();
  for (const f of fileNames ?? []) { const n = soundEntry(f); if (n) files.set(n, f); }
  const sig = [...files].map(([n, f]) => `${n}=${f}`).sort().join('|');
  if (reattach || sig !== _sig || (load ?? null) !== _load) _gen++;
  _files = files;
  _sig = sig;
  _load = load ?? null;
  return _files.size;
}
export const soundReplacementCount = () => _files.size;
export const soundReplacementGen = () => _gen;

/** Is this classic index switched OFF by the player? */
export function soundSilenced(index) {
  const k = SOUND_SWITCHES[index];
  if (!k) return false;
  try { return getPref(k) === false; } catch { return false; }
}

/** The supplied file's bytes, or null (no pack, no such file, a failed read). */
export async function fetchReplacement(name) {
  const f = _files.get(name);
  if (!f || !_load) return null;
  try { return (await _load(f)) ?? null; } catch { return null; }
}
