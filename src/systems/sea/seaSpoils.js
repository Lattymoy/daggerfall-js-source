// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEA-SET (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected" - the Eltheric
// Ocean's Abyss-only gear; bible/03-World/Eltheric-Ocean.md SEA-SET, bible/11-Multiplayer/Sigil-Sets.md section 6h) - THE
// DEEP'S SPOILS: where a piece of the Eltheric Tidemail is found off a place of the sea. A treasure pile of an isle's
// ruin, and (SEA-VAULTS) of a vault of the deep, rolls the Tidemail LAST - after everything the pile rolled before, so
// every earlier piece stays what it was for its dice (the room's seeded base, online, is every client's alike) - on the
// share of the place's own band (systems/aetheric.js ELTHERIC_CHANCE: a ruin's or a vault's; the Shallows and the Reaches
// none). A legend's piece is the naval host's (scenes/naval/navalHost.js legendTidemail); the fleet's, the fleet's.
// Pure beside the item mint.
// ═══════════════════════════════════════════════════════════════════
import { inEther, etherBandAt } from '../../world/ethericSea.js';
import { rollElthericPiece, elthericChance } from '../aetheric.js';

/** A place of the sea's map pixel and band - its mapTableData's longitude and latitude (MapsFile's own sum, which
 *  round-trips any integer pixel) - or null for a place that is not an isle's, or cannot say where it stands. */
export function seaPlaceBand(loc) {
  const at = loc?.mapTableData;
  if (!loc?.ether || !Number.isFinite(at?.longitude) || !Number.isFinite(at?.latitude)) return null;
  const px = Math.trunc(at.longitude / 128), py = 499 - Math.trunc(at.latitude / 128);
  return inEther(px, py) ? etherBandAt(px).id : null;
}

/** The source a place's pile rolls as: a vault of the deep's (SEA-VAULTS - an isle's place entered as today's vault wears
 *  the hall's ring the door stamps, scenes/worldModes.js `wildRing`) or a ruin's. */
export const seaPileSource = (loc) => (loc?.ether && loc.wildRing > 0 ? 'vault' : 'ruin');

/**
 * THE PILE'S LAST ROLL: a treasure pile of a place of the sea - its band's share of a Tidemail piece, pushed onto the
 * pile's items, on `rolls` (the pile's own dice: the room's seeded base online, Math.random offline). In place; answers
 * the items. A place of the Bay, or a band with no share, rolls nothing at all - its dice untouched.
 */
export function seaPileMore(items, loc, rolls = Math.random) {
  const band = seaPlaceBand(loc);
  const chance = band ? elthericChance(seaPileSource(loc), band) : 0;
  if (!(chance > 0) || !Array.isArray(items)) return items;
  const piece = rollElthericPiece(rolls, chance);
  if (piece) items.push(piece);
  return items;
}
