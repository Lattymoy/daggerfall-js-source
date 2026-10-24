// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CART-AWAY (FIELD BUGS 2026-10-15d; Mac, 2026-10-15, asked "If parked outside of the pvp zone in the wrothgarian
// mountains, can it be lost?": "Yeah, if its parked outside the zone nothing should be lost") - THE FALLEN'S WORD THAT
// ITS WAGON IS AWAY (bible/11-Multiplayer/Wild-Zone.md section 4).
//
// A death in the zone drops the bag and the cart (systems/wild/wildDropLaw.js takeWildDeath) - the cart only while the wagon
// is with its owner. Where it stands is the Horse Cart and Cargo record's (horseCartLaw.js newSaveData): parked
// (Deployed, at WorldX/WorldZ), sent to the stable (WithPlayer with WagonStabled), driven or beside its owner on foot
// (WithPlayer), following (FollowingPlayer), or none (None). Whether a parked wagon's map pixel is the zone's is the
// zone's mask (wildZone.js wildMaskOf, off the map files every client holds), which the account service does not have -
// so the fallen's own tab SAYS it (`cart` 0 on /v1/wild/fall, world.js wildTakeDrop), and the service honours the word
// only where the record it keeps agrees by its mode (wildDropLaw.js wildCartMayBeAway): a tab cannot keep a cart its
// own record says it drives, leads or stands beside.
// ═══════════════════════════════════════════════════════════════════
import { wildInside } from './wildZone.js';
import { etherWildRingAt } from './etherWild.js';   // AUDIT SEA VENTURES C4: the open sea's ground is the zone's too
import { worldCoordToMapPixel } from '../../world/streamingWorld.js';   // MapsFile.WorldCoordToMapPixel - the export the HCC runtime's own pixel reads are fed (world.js)
import { WAGON_MODE } from '../horse/horseCartLaw.js';
import { wildCartMayBeAway } from './wildDropLaw.js';

/**
 * IS THE WAGON AWAY FROM A DEATH IN THE ZONE? `rec` the Horse Cart and Cargo record (horseCartLaw.js newSaveData's shape),
 * `mask` the zone's (wildZone.js wildMaskOf). AWAY: no wagon; stabled; parked on a map pixel that is not the zone's - the
 * band about it (`wildNear`, WILD_NEAR_PX) is no part of the zone: no blow lands there and nothing drops there, it is the
 * maps' hiding and the rise's margin - nor the open sea past Veilhaven's peace (AUDIT SEA VENTURES C4: a wagon summoned to an
 * isle of the open sea was "away" by the mountains' mask, and its cargo kept through a death beside it). WITH THEM: driven, beside them on foot (the mod's next door parks it there),
 * following, parked on the zone's own ground - and whatever a record or a mask cannot say.
 * @param {any} rec @param {any} mask @returns {boolean}
 */
export function wildCartAway(rec, mask) {
  if (!wildCartMayBeAway(rec)) return false;
  if (rec.Mode !== WAGON_MODE.Deployed) return true;   // no wagon, or at the stable
  if (!mask) return false;   // no map files, no word
  const p = worldCoordToMapPixel(rec.WorldX, rec.WorldZ);
  return !wildInside(mask, p.x, p.y) && !(etherWildRingAt(p.x, p.y) > 0);
}

/** THE WORD on /v1/wild/fall: `cart` 0, the wagon away - or 1. With the mod off (`on` false) the wagon is Daggerfall's
 *  own, which goes wherever its owner goes: with them.
 *  @param {boolean} on @param {any} rec @param {any} mask */
export const wildCartWord = (on, rec, mask) => ({ cart: on && wildCartAway(rec, mask) ? 0 : 1 });
