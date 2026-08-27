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

/** Scores by cue for the places (keyed by songManager's MUSIC_ENV
 *  names). A cue with no score composes alone (EM1). */
export const PLACE_SCORES = Object.freeze({
  /** EM2c. 3:09, looped. The key was MEASURED off the file's pitch-class
   *  energy (B 1.00, F# 0.42, D 0.32, C# 0.28, E 0.24 - a B minor triad
   *  with the aeolian second) and is Mac's to confirm; the underscore
   *  composes on it. No tempo named: the piece keeps the palette's own. */
  dungeonInterior: Object.freeze({
    id: 'dungeon',
    file: '../music/enhanced/dungeon.mp3',
    loop: true,
    gain: 1.0,
    root: 47,          // B2
    mode: 'aeolian',
  }),
});

/** Cues beyond DFU's - the enhanced side's own. The records land here
 *  as the tracks arrive (Mac: "I have the danger and death tracks to
 *  follow"); until then the keys are absent, not placeholders. */
export const EXTRA_SCORES = Object.freeze({});

export const scoreFor = (environment) => PLACE_SCORES[environment] ?? null;

/** How far under a track the composed piece sits: the scheduler's master
 *  is trimmed by this while a track plays. Felt more than heard. */
export const UNDERSCORE_TRIM = 0.35;
