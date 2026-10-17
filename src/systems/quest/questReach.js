// @ts-check
// NEARBY-QUESTS (2026-10-04, Discord: "quests weren't made with this in mind and are randomized ... you can just get
// unlucky and have one sending you far away, screwing you heavily"; "quests of the game you take from guilds and so on
// need to be near you on overworld map"): WHERE A REMOTE QUEST SITE MAY STAND.
//
// DFU picks a remote site (Place.cs SelectRemoteTownSite / SelectRemoteDungeonSite / SelectRemoteLocationExteriorSite)
// uniformly over the player's whole REGION - a region runs to a hundred map pixels and more, a week's walk, and the
// port's harder road (camp encounters, the rest rules) made a level-one character's long trip a lost bedroll and no way
// home. With Nearby quests on, a site is drawn from the ones within the QUEST REACH of the player's map pixel, and the
// reach grows with level, so the early game stays close and by the mid-teens it covers a region (DFU's own draw).
//
// The distance is CHEBYSHEV - max(|dx|, |dy|) in map pixels - because the travel reckoning (systems/travel/travel.js
// calculateTravelTime) walks the longest axis and charges a pixel per step: the reach is a travel time, not a crow's
// line. On foot, cautiously, a pixel is two to four hours by the climate, so ten pixels is a day or two.
//
// Nothing here draws a roll: the callers (systems/quest/place.js) draw from the pools this returns with the quest's
// own injectable roll, so a seeded quest stays seeded. Off, the callers never call in, and every draw is DFU's.

import { getPref } from '../uiPrefs.js';
import { longitudeLatitudeToMapPixel } from '../../formats/mapsFile.js';

/** The pref (systems/features.js, the 'nearby-quests' row). */
export const NEARBY_QUESTS_KEY = 'nearbyQuests';
/** The reach at level 1, in map pixels (a day or two on foot). */
export const QUEST_REACH_BASE = 10;
/** And what each level after the first adds. Level 10: 46 pixels; level 15: 66, about a region. */
export const QUEST_REACH_PER_LEVEL = 4;
/** A pool is never smaller than this while the region has the sites: fewer within reach, the nearest this many stand
 *  in (a remote corner of a region, or the dungeons of one type, may have none within a day). */
export const QUEST_REACH_MIN_CHOICES = 3;
/** The console's comparison door: `__DF_QUEST_REACH.override = true / false / null` (null hands it back to the row). */
export const QUEST_REACH_TUNING = { override: /** @type {boolean|null} */ (null) };
if (typeof window !== 'undefined') /** @type {any} */ (window).__DF_QUEST_REACH = QUEST_REACH_TUNING;

/** Is Nearby quests on. */
export const questReachOn = () => QUEST_REACH_TUNING.override ?? !!getPref(NEARBY_QUESTS_KEY);

/** The reach at `level`, map pixels. A level the host cannot answer (0, NaN) is level 1. */
export function questReachPixels(level) {
  const lv = Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1;
  return QUEST_REACH_BASE + QUEST_REACH_PER_LEVEL * (lv - 1);
}

/** A map-table entry's map pixel (its longitude/latitude, as mapsFile places a location), or null for an entry that
 *  carries no place (a crafted table): a site that cannot be measured leaves the draw DFU's. */
export function mapTablePixel(entry) {
  if (!Number.isFinite(entry?.longitude) || !Number.isFinite(entry?.latitude)) return null;
  return longitudeLatitudeToMapPixel(entry.longitude, entry.latitude);
}

/** The indices of `indices` within `reach` of `origin`, or null when any of them cannot be measured. */
export function indicesWithin(regionData, indices, origin, reach) {
  const out = [];
  for (const i of indices) {
    const px = mapTablePixel(regionData.mapTable[i]);
    if (!px) return null;
    if (mapPixelDistance(px, origin) <= reach) out.push(i);
  }
  return out;
}

/** The travel distance between two map pixels: the longest axis. */
export function mapPixelDistance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** The pool a nearby draw takes from: the `indices` (into regionData.mapTable) within `reach` of `origin`, in their own
 *  order; with fewer than `minChoices` within it, the nearest `minChoices` (ties by index). Every index answered is one
 *  of `indices`, so every filter the caller already ran still holds. */
export function nearbyIndices(regionData, indices, origin, reach, minChoices = QUEST_REACH_MIN_CHOICES) {
  const within = indicesWithin(regionData, indices, origin, reach);
  if (within === null) return indices;   // an unmeasured site: DFU's own pool
  if (within.length >= minChoices || within.length === indices.length) return within;
  const dist = (i) => mapPixelDistance(/** @type {{x:number,y:number}} */ (mapTablePixel(regionData.mapTable[i])), origin);
  return indices.map((i) => [i, dist(i)]).sort((p, q) => p[1] - q[1] || p[0] - q[0]).slice(0, minChoices).map((p) => p[0]);
}
