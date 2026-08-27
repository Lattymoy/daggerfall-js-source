// ENHANCED MUSIC - the scores: Mac's own tracks, by cue. (EM2a/EM2c,
// 2026-08-27.)
//
// A score is a record: the file (his composition, shipped in the repo
// under public/music/enhanced/ with an OURS row on the doctrine
// allow-list), whether it loops, its level, and - when known - the KEY
// (root as a MIDI note, mode) and TEMPO the composed underscore should
// follow. Files are MP3: the one format every browser on the site's list
// plays, iOS Safari included; Ogg Vorbis is not. Paths are relative to
// the GAME PAGE (/play/), one directory under the site root where
// public/ lands.
//
// A place with a score and a palette plays the track WITH the composed
// piece underneath it, in the track's key when the record names one;
// a record without a key plays alone rather than clash.

/** The front door's theme. Loops until the game's own music takes over,
 *  when the service fades it under. */
export const TITLE_THEME = Object.freeze({
  id: 'title',
  file: '../music/enhanced/main-theme.mp3',
  loop: true,
  gain: 1.0,
});

/** THE PLACES COMPOSE. On 2026-08-27 Mac retired the imported-track
 *  direction for the places ("forget this entirely and completely focus
 *  on the procedural audio system"): a full track is one long song from
 *  beginning to end, and a place wants a STATE - the same piece, present
 *  the whole time, with more or less of it audible. That is what the
 *  composer's layers and the runtime mix (palettes.layerMix) are. So
 *  these tables are EMPTY by decision, not by absence; the record shape
 *  and the streamed player stay for the one track that is a song and
 *  should be - the door's theme above. */
export const PLACE_SCORES = Object.freeze({});
export const EXTRA_SCORES = Object.freeze({});

export const scoreFor = (environment) => PLACE_SCORES[environment] ?? null;

/** How far under a track the composed piece sits, should a place ever
 *  score one again: the scheduler's master trim while a track plays. */
export const UNDERSCORE_TRIM = 0.35;
