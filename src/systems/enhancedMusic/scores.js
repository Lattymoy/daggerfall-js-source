// ENHANCED MUSIC - the scores: Mac's own tracks, by cue. (EM2a, 2026-08-27:
// "This is the main theme that should play on startup.")
//
// A score is a record: the file (his composition, shipped in the repo
// under public/music/enhanced/ with an OURS row on the doctrine
// allow-list), whether it loops, and later the key and tempo the
// composed underscore should follow. Files are MP3: the one format
// every browser on the site's list plays, iOS Safari included; Ogg
// Vorbis is not. Paths are relative to the GAME PAGE (/play/), which is
// one directory under the site root where public/ lands.

/** The front door's theme. Loops until the game's own music takes over,
 *  when the service fades it under. */
export const TITLE_THEME = Object.freeze({
  id: 'title',
  file: '../music/enhanced/main-theme.mp3',
  loop: true,
  gain: 1.0,
});

/** Scores by cue for the places (EM2). Empty until a track exists for a
 *  place; a cue with no score composes alone (EM1). */
export const PLACE_SCORES = Object.freeze({});

export const scoreFor = (environment) => PLACE_SCORES[environment] ?? null;
