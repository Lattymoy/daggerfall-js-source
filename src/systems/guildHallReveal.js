// AUDIT 63 F9: RevealGuildHallOnMap - the Thieves Guild's and the Dark
// Brotherhood's own override of Join(), and the only thing that ever
// puts a plate on their hideout.
//
// ThievesGuild.cs:168-173 `Join() { base.Join(); RegisterEvents();
// RevealGuildHallOnMap(); }` and DarkBrotherhood.cs:177-182 are the
// same body. RegisterEvents (:197-206 / :206-215) subscribes
// PlayerGPS.OnEnterLocationRect and StreamingWorld
// .OnAvailableLocationGameObject, and both handlers (:227-234 /
// :236-243) re-run the reveal, so the reveal follows a member into
// every town for as long as the membership lasts; Leave (:175-178 /
// :184-187) is UnregisterEvents alone, and RestoreGuildData (:253-257
// / :262-266) re-registers on load without revealing - the reveal
// follows from the location becoming available right after.
//
// The reveal itself (:241-247 / :250-256):
//
//     foreach (BuildingSummary building in
//              buildingDirectory.GetBuildingsOfFaction(factionId))
//         PlayerGPS.DiscoverBuilding(building.buildingKey, GetGuildName());
//
// - GetBuildingsOfFaction is every building in the CURRENT location
//   whose FactionId matches (BuildingDirectory.cs:147-154), not the
//   doors the talk directory names;
// - the two-argument DiscoverBuilding is the OVERRIDE-NAME form
//   (PlayerGPS.cs:917-973), which is load-bearing: a hideout is an
//   unsigned House2 residence (PlayerActivate.cs:1280-1285, ported at
//   buildingLocks.js), and the town map names a residence only under
//   `!IsResidence || isOverrideName` (ExteriorAutomap.cs:672-680,
//   ported at exteriorAutomapWindow.js:1075). A plain discovery leaves
//   the hall on the map with no plate at all;
// - the name is READ, not a constant: GetGuildName -> GetAffiliation
//   (Guild.cs:165-176) is the FACTION.TXT record's own name for the
//   guild's faction id, with DFU's "unknown-guild" fallback.
//
// The port has no event bus, so the membership book IS the
// registration: a member's book carries the guild's slot, and that is
// exactly the state Join writes and Leave/expulsion drops. The hosts
// call this at the two moments DFU's handlers fire - the join, and
// each entry into a location.

import { GUILDS, hasJoined } from './guilds.js';
import { discoverBuilding } from './discovery.js';

/** The two guilds that override Join with a reveal. Their faction ids
 *  are FactionFile.FactionIDs.The_Thieves_Guild (42) and
 *  .The_Dark_Brotherhood (108) - ThievesGuild.cs:34,
 *  DarkBrotherhood.cs:34 - which the port's records already carry. */
export const REVEALING_GUILDS = Object.freeze([GUILDS.ThievesGuild, GUILDS.DarkBrotherhood]);

/**
 * RevealGuildHallOnMap for whichever of the two the player belongs to.
 *
 * @param memberships the live membership book (the registration)
 * @param locationId  the discovery store's key for this location
 * @param buildings   the location's FULL building set - buildingSummaries'
 *                    rows, each carrying buildingKey and factionId
 * @param factionName (id) => FACTION.TXT's name, GetAffiliation's read
 * @returns how many records the reveal wrote
 */
export function revealGuildHallsOnMap(memberships, locationId, buildings, {
  factionName = null, discover = discoverBuilding,
} = {}) {
  if (!memberships || locationId == null || !buildings?.length) return 0;
  let written = 0;
  for (const guild of REVEALING_GUILDS) {
    // the port's stand-in for "the events are registered": DFU
    // subscribes in Join and unsubscribes in Leave, so a non-member's
    // handlers never run.
    if (!hasJoined(memberships, guild)) continue;
    const name = factionName?.(guild.factionId) || 'unknown-guild';   // Guild.cs:170-176
    for (const b of buildings) {
      if (b?.factionId !== guild.factionId) continue;
      if (discover(locationId, b, name)) written++;
    }
  }
  return written;
}
