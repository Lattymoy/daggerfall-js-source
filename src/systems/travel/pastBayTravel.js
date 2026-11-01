// @ts-check
// ═══════════════════════════════════════════════════════════════════
// THE JOURNEY'S LAW PAST THE BAY. TRAVEL-EVERYWHERE (2026-10-28, the owner: "Like how it works in the bay should be how
// it works everywhere") retired TESA-NO-FAST (AUDIT TESA II P4), which refused every journey that ended past the Bay. A
// journey there is a Bay journey: the travel map's, a carriage driver's, a party's, a rider's. Only the open zone
// (PVPJOURNEY, WILD3) and the Veil (veilRefused) refuse one.
// Pure. Not a DFU member: DFU's map stops at the Bay.
// ═══════════════════════════════════════════════════════════════════
import { inBay } from '../../world/tamriel/tamrielFrame.js';
import { inEther } from '../../world/ethericSea.js';
import { provinceKeyBeyondBay } from '../../world/tamriel/tamrielLand.js'; // PORTAL-ANYWHERE: the land's own law (SMOOTH-LAND)
import { provinceByKey } from '../../world/tamriel/tamrielGeography.js';

/**
 * A journey's verdict past the Bay: the zone's (`zone` - systems/wild/wildZone.js wildJourney's), as on the Bay.
 * @param {{ x: number, y: number }|null} _from @param {{ x: number, y: number }|null} _to @param {any} _mask
 * @param {{ ok: boolean, text?: string, fee?: number }} zone
 * @returns {{ ok: boolean, text?: string, fee?: number }}
 */
export function pastBayJourney(_from, _to, _mask, zone) {
  return zone;
}

/**
 * PORTAL-BAY (2026-10-26, bible/06-Systems/Portal-Stone.md; the owner: "attempting to teleport anywhere outside the bay
 * with the portal stone leads to a black screen and a prompt telling you cannot travel", and "it wasnt letting the user
 * teleport to a city either"): A TELEPORT IS NO JOURNEY. P4 put pastBayJourney at the gate every journey passes
 * (scenes/world.js wildTravelGate), and the teleports pass it too - the guild's (teleportTo), a Portal Stone's portal
 * (scenes/portalStoneHost.js, which steps into teleportTo) and Recall's - so the road TESA-NO-FAST names past the Bay
 * ("reached through a Portal Stone") was refused as fast travel, after the stone was spent and the screen blacked. A
 * teleport's verdict past the Bay is the zone's alone: its into-and-out-of law is PVPDUNGEONS' (world.js
 * wildTeleportRefused), the Veil's is the Veil's (veilRefused). The journeys keep the zone's journey law (TRAVEL-EVERYWHERE).
 * @param {{ x: number, y: number }|null} _from @param {{ x: number, y: number }|null} _to @param {any} _mask
 * @param {{ ok: boolean, text?: string, fee?: number }} _zone
 * @returns {{ ok: boolean, text?: string, fee?: number }}
 */
export function teleportJourney(_from, _to, _mask, _zone) {
  return { ok: true, fee: 0 }; // WILD-CITY-PORT: nor the zone's journey law (its in and out, its wait, its fare) - a teleport's is world.js wildTeleportRefused's
}

/**
 * PORTAL-ANYWHERE (2026-10-26, bible/06-Systems/Portal-Stone.md; the owner, asked whether the stone should reach any point
 * past the Bay: "Anywhere on land"): A PORTAL STONE'S END ON THE LAND PAST THE BAY - a departure from TESA-NO-FAST for the
 * Portal Stone alone (TESA13 had kept a portal's ends to the cities). A pixel past the Bay (not the Bay's map, not past
 * the Veil) whose centre is land by the land's own law (world/tamriel/tamrielLand.js provinceKeyBeyondBay - the world's
 * ground and the sheet's ink read it) is one, named by the province it is land of, as a peer names a portal's end off its
 * own map (scenes/world.js portalGates' destOf); the sea is none. Where on it the traveller stands is the arrival's
 * (scenes/world.js _teleportToPixel: player/enterExit.js safeGroundAt). Answers `{ pixel, name }`, or null.
 * @param {number} px @param {number} py
 * @returns {{ pixel: { x: number, y: number }, name: string }|null}
 */
export function portalLandAt(px, py) {
  if (!Number.isInteger(px) || !Number.isInteger(py) || inBay(px, py) || inEther(px, py)) return null;
  const province = provinceByKey(provinceKeyBeyondBay(px, py));
  return province ? { pixel: { x: px, y: py }, name: province.name } : null;
}
