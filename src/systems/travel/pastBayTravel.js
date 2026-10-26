// @ts-check
// ═══════════════════════════════════════════════════════════════════
// AUDIT TESA II P4 (2026-10-25, bible/03-World/Arena-Provinces.md TESA-NO-FAST) - NO JOURNEY INTO THE LAND PAST THE BAY.
//
// The owner, 2026-10-13: "fast travel shouldnt be a thing since we use portal stones online or the player can traverse
// using the overworld". TESA-NO-FAST kept the travel map's press past the Bay from picking a journey (ui/heldMap.js) -
// one door of several: a party's journey to its leader (PARTY-TRAVEL) and a rider's in its owner's wagon (WAGONS2) set
// out for a pixel past the Bay by the same fast travel, the map never asked. This is the journey's own law, asked by the
// one gate every journey passes (scenes/world.js fastTravelTo's wildTravelGate): a journey whose end lies past the Bay
// - the land TAMRIEL2 streams, its places TESA's - is refused, in words that say the two ways there are. The open
// zone's own journeys (Cyrodiil's, PVPJOURNEY: from inside it to inside it, its fee and its wait) stay its own (the
// zone's verdict decides them first). The Eltheric Ocean's side of the Veil is the Veil's (veilRefused).
//
// Pure: the journey's two ends and the zone's verdict in, a verdict out. Not a DFU member: DFU's map stops at the Bay.
// ═══════════════════════════════════════════════════════════════════
import { inBay } from '../../world/tamriel/tamrielFrame.js';
import { inEther } from '../../world/ethericSea.js';
import { wildInside } from '../wild/wildZone.js';
import { t } from '../textManager.js';

/** What the refusal says (the text core's: L10N4). */
export const PAST_BAY_TRAVEL_TEXT = Object.freeze({
  get refused() { return t('travel.pastBay.refused', 'No road the Bay knows leads there. The land past the Iliac Bay is walked, or reached through a Portal Stone.'); },
});

/**
 * A journey's verdict past the Bay: the zone's own (`zone` - systems/wild/wildZone.js wildJourney's) where it refuses, or
 * where the journey runs inside the open zone from end to end; else a refusal where its end lies past the Bay (not the
 * Bay's map, not past the Veil); else the zone's.
 * @param {{ x: number, y: number }|null} from @param {{ x: number, y: number }|null} to @param {any} mask the open zone's
 *   mask (online; null without it) @param {{ ok: boolean, text?: string, fee?: number }} zone
 * @returns {{ ok: boolean, text?: string, fee?: number }}
 */
export function pastBayJourney(from, to, mask, zone) {
  if (!zone.ok || !to || inBay(to.x, to.y) || inEther(to.x, to.y)) return zone;
  if (mask && from && wildInside(mask, from.x, from.y) && wildInside(mask, to.x, to.y)) return zone;   // PVPJOURNEY: the zone's own
  return { ok: false, text: PAST_BAY_TRAVEL_TEXT.refused };
}

/**
 * PORTAL-BAY (2026-10-26, bible/06-Systems/Portal-Stone.md; the owner: "attempting to teleport anywhere outside the bay
 * with the portal stone leads to a black screen and a prompt telling you cannot travel", and "it wasnt letting the user
 * teleport to a city either"): A TELEPORT IS NO JOURNEY. P4 put pastBayJourney at the gate every journey passes
 * (scenes/world.js wildTravelGate), and the teleports pass it too - the guild's (teleportTo), a Portal Stone's portal
 * (scenes/portalStoneHost.js, which steps into teleportTo) and Recall's - so the road TESA-NO-FAST names past the Bay
 * ("reached through a Portal Stone") was refused as fast travel, after the stone was spent and the screen blacked. A
 * teleport's verdict past the Bay is the zone's alone: its into-and-out-of law is PVPDUNGEONS' (world.js
 * wildTeleportRefused), the Veil's is the Veil's (veilRefused). The journeys keep pastBayJourney's.
 * @param {{ x: number, y: number }|null} _from @param {{ x: number, y: number }|null} _to @param {any} _mask
 * @param {{ ok: boolean, text?: string, fee?: number }} zone
 * @returns {{ ok: boolean, text?: string, fee?: number }}
 */
export function teleportJourney(_from, _to, _mask, zone) {
  return zone;
}
