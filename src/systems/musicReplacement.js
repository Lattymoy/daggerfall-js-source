// M-EXT: user-supplied music, ported from DFU's asset-injection layer.
//
// SOURCE: Utility/AssetInjection/SoundReplacement.cs. DFU keeps loose
// files in StreamingAssets/Sound and, before a song plays, asks
// TryImportSong(song) for a replacement named after the song with an
// `.ogg` extension - streamed, because a song is long. Nothing is
// bundled with the game; the folder is the user's own.
//
// THE GATE IS DFU'S OWN: Settings.AssetInjection. Both of DFU's
// import paths open with `if (DaggerfallUnity.Settings.AssetInjection)`
// and answer false otherwise, so the whole feature is one boolean away
// from not existing. Ported exactly, including that the built-in song
// still plays when the answer is no - a replacement is an override,
// never a requirement.
//
// TWO RECORDED DEPARTURES. Ledger A carries them as THE MUSIC
// REPLACEMENT FOLDER IS A USER PICK, AND ITS EXTENSIONS ARE A SET
// (AUDIT 58, seams lane) - by name, because a line number rots:
//
// 1. EXTENSIONS. DFU seeks `.ogg` alone. A browser decodes whatever
//    its codec set covers and the packs people actually have are mp3
//    as often as ogg, so this accepts a SET and prefers in a fixed
//    order. Restricting to .ogg would reject most real music packs for
//    no gain: DFU's single extension is a Unity WWW-loader constraint,
//    not a law about the format.
// 2. NO FILESYSTEM. There is no StreamingAssets in a browser. The
//    "folder" is a pick the user makes, stored the way ARENA2 is, and
//    the lookup is over that set rather than over a path. The SHAPE is
//    DFU's - name in, bytes or nothing out - which is what the callers
//    depend on.
//
// The song names here are the port's own: MIDI.BSA record names like
// `GDAY___D.HMI`, because that is what songManager's playlists carry
// and what MusicService.playSong is handed. DFU matches on its
// SongFiles enum instead, which is the same set under different
// spelling.

import { getBool } from './settings.js';

/** Accepted replacement formats, in PREFERENCE order. First match wins
 *  when a folder carries the same song more than once, so the answer is
 *  deterministic rather than dependent on directory order. Ogg leads
 *  because it is what DFU seeks and what the packs are usually cut as;
 *  wav is last because it is the one most likely to be a huge
 *  intermediate rather than the finished track. */
export const MUSIC_EXTENSIONS = Object.freeze(['ogg', 'mp3', 'm4a', 'flac', 'wav']);

/** DFU's gate, verbatim: Settings.AssetInjection. */
export const musicReplacementEnabled = () => getBool('Enhancements', 'AssetInjection');

/**
 * The lookup key for a song. `GDAY___D.HMI` -> `GDAY___D`.
 *
 * Only a trailing `.HMI` is stripped, and only one: a song named
 * `A.HMI.HMI` would be a real record name and dropping both would miss
 * it. Names are uppercased so a folder of lowercase files matches -
 * the archive's own names are uppercase and a user's files are
 * whatever their tools emitted.
 */
export const replacementKey = (songName) =>
  String(songName ?? '').trim().replace(/\.HMI$/i, '').toUpperCase();

/**
 * Split a supplied filename into its key and extension.
 * Returns null for a name this layer will never match, so a folder of
 * cover art and readmes costs nothing.
 */
export function replacementEntry(fileName) {
  const name = String(fileName ?? '').trim();
  // Basename only: a picked directory hands back paths on some
  // browsers and the last segment is the file.
  const base = name.slice(name.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return null;                     // no extension, or a dotfile
  const ext = base.slice(dot + 1).toLowerCase();
  if (!MUSIC_EXTENSIONS.includes(ext)) return null;
  // THE `song_` PREFIX IS DFU'S OWN, and accepting it is what lets an
  // existing music pack drop in unrenamed. SoundReplacement asks for
  // `song.ToString()` where `song` is a SongFiles enum value, and those
  // members are named `song_` + the archive record, lowercased
  // (SongFiles.cs) - so every pack built for Daggerfall Unity is
  // already named correctly and only wears that prefix. Stripping it is
  // unambiguous: swept over the retail archive, NO record name begins
  // with SONG_, so nothing real is shortened by accident.
  return { key: base.slice(0, dot).replace(/^song_/i, '').toUpperCase(), ext };
}

/**
 * Build the name -> filename index a pick produces.
 *
 * PREFERENCE, NOT LAST-WINS: when one song arrives as both .ogg and
 * .mp3 the earlier entry in MUSIC_EXTENSIONS is kept, whatever order
 * the files came in. A pack that ships both formats side by side is
 * ordinary, and "whichever the browser listed last" is not an answer
 * anyone can predict or reproduce.
 */
export function indexReplacements(fileNames) {
  const index = new Map();
  for (const fileName of fileNames ?? []) {
    const entry = replacementEntry(fileName);
    if (!entry) continue;
    const held = index.get(entry.key);
    if (held && MUSIC_EXTENSIONS.indexOf(held.ext) <= MUSIC_EXTENSIONS.indexOf(entry.ext)) continue;
    index.set(entry.key, { ext: entry.ext, fileName });
  }
  return index;
}

/** The replacement filename for a song, or null. The gate is checked
 *  HERE rather than at each call site - DFU asks it inside the import,
 *  and a caller that forgets is a caller that plays a replacement the
 *  player switched off. */
export function replacementFor(songName, index) {
  if (!musicReplacementEnabled()) return null;
  if (!index || index.size === 0) return null;
  return index.get(replacementKey(songName))?.fileName ?? null;
}

// ---- the host seam -------------------------------------------------
//
// One registry, set by whoever ingests the folder, read by
// MusicService. A null source is the DFU default state (no loose
// files) and answers null for everything, so the built-in songs play
// and nothing has to branch on whether the feature is "on".

let _index = new Map();
let _load = null;

/** Register a picked set. `load(fileName)` resolves to bytes. */
export function setMusicReplacements(fileNames, load) {
  _index = indexReplacements(fileNames);
  _load = typeof load === 'function' ? load : null;
  return _index.size;
}

/** How many songs the current pick can replace (0 = none registered). */
export const replacementCount = () => _index.size;

/** Every song name the pick covers - the settings screen lists them. */
export const replacementKeys = () => [..._index.keys()].sort();

/** Is there a replacement for this song? SYNCHRONOUS, and that is the
 *  point: MusicService.playSong has to decide which path it is on
 *  before it can return, while loading and decoding the audio cannot
 *  happen until later. A Map hit behind DFU's gate is the whole cost. */
export const hasReplacement = (songName) => replacementFor(songName, _index) !== null;

export function clearMusicReplacements() {
  _index = new Map();
  _load = null;
}

/**
 * Bytes for a song's replacement, or null.
 *
 * NEVER THROWS. A replacement that will not load is a cosmetic
 * failure and the built-in song is right there - this is the same
 * rule the infection videos and the message-box art follow, and it is
 * why the caller can treat null as "just play the original" without a
 * try/catch of its own.
 */
export async function replacementBytes(songName) {
  const fileName = replacementFor(songName, _index);
  if (!fileName || !_load) return null;
  try {
    const bytes = await _load(fileName);
    return bytes && bytes.byteLength > 0 ? bytes : null;
  } catch (e) {
    console.warn(`[music] replacement ${fileName} would not load:`, e?.message ?? e);
    return null;
  }
}
