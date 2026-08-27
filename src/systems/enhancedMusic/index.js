// ENHANCED MUSIC - the door. (EM1, 2026-08-27, Mac's call: "for the
// enhanced version I'd like to put my own twists on things -
// implementing a procedural music system in addition to my own custom
// tracks", switched by the enhanced skin toggle.)
//
// DFU's SongManager stays the ONE brain: it decides the cue - the
// environment, the weather, night, the day, the location, the dungeon -
// and when the cue changes. This module answers a different question
// for the same cue: under the enhanced skin, is there something of ours
// to play instead of the classic song? Today: a composed piece when the
// place has a palette. Next: Mac's own track for the place, with the
// composed piece underneath it.
//
// The classic path is untouched by construction: this returns null
// under the classic skin, and the director then does exactly what it
// did before this file existed.

import { isEnhanced } from '../uiSkin.js';
import { paletteFor } from './palettes.js';
import { composeScore } from './composer.js';
import { hashSeed } from './theory.js';

/** The seed for a cue. A dungeon composes on its own key - the header
 *  field DFU seeds its song choice with (SongManager.cs:353-356), so a
 *  dungeon keeps its piece across visits; everywhere else composes on
 *  the place and the day, which is DFU's daily-song law (:367-371). */
export function cueSeed(context) {
  if (context.dungeonKey !== null && context.dungeonKey !== undefined) return hashSeed('dungeon', context.dungeonKey);
  return hashSeed(context.environment, context.locationIndex ?? -1, context.gameDays ?? 0);
}

/** The enhanced side's answer for a cue: a composed song for SongPlayer,
 *  or null to leave the classic song alone (classic skin, or a place
 *  with no palette yet). */
export function enhancedScore(context, { enhanced = isEnhanced() } = {}) {
  if (!enhanced || !context) return null;
  const palette = paletteFor(context.environment);
  if (!palette) return null;
  return composeScore(palette, cueSeed(context));
}
