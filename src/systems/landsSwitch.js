// @ts-check
// TESA-LANDS (bible/03-World/Tamriel-Lands.md): THE LANDS PAST THE BAY'S SWITCH, its own home - the world's hosts read it
// (scenes/shared.js re-exports it for them) and so do the far views (render/farRing.js: the far woods and ground wear a
// zone's own), which import no scene.
import { pageParam } from './pageQuery.js';
import { isOnlinePage, onlineForcedPref } from './online/onlineLane.js';
import { getPref } from './uiPrefs.js';
import { isEnhanced } from './uiSkin.js';

/** THE LANDS PAST THE BAY'S SWITCH - the Features row (`tamrielLands`) on the enhanced skin, and on for everyone online
 *  whatever their skin: a zone's flats are where Logging's trees stand and its landmarks turn the player, and a room
 *  agrees on its ground (realForestsOn's shape). `?lands=off` the kill door, offline. The world host reads it once, at
 *  its mount (a flip reaches the next world). Off - and on the classic skin - every zone wears its climate's ground and
 *  flats, as TESA-BIOME laid them (world/tamriel/tamrielLands.js). */
export function tamrielLandsOn(search) {
  if (pageParam('lands', search) === 'off' && !isOnlinePage(search)) return false;
  const row = onlineForcedPref('tamrielLands', search) ?? getPref('tamrielLands');
  return !!row && (isOnlinePage(search) || isEnhanced(search));
}
