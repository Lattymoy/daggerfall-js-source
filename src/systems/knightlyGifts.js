// G6 - THE KNIGHTLY ORDER'S GIFTS: KnightlyOrder.ReceiveArmor and the
// Spymaster's greeting (MIT, Daggerfall Workshop). Two of the four
// remaining FLAGGED service destinations, and the only two that need
// no window of their own.
//
// THE ARMOUR IS ONCE PER RANK, and the bookkeeping is a BITFIELD on
// the membership rather than a counter: `armorMask = ArmorFlagStart
// << rank` with ArmorFlagStart 4, so rank 0 owns bit 2, rank 1 bit 3,
// and so on up to rank 9 at bit 11. Bit 1 (HouseFlagMask 2) is the
// house's. Promoting to a rank you have never claimed at re-opens the
// gift - which is what makes it a mask and not a boolean.
//
// THE MATERIAL IS THE RANK, through INTEGER ARITHMETIC on the enum's
// own values: `ArmorMaterialTypes.Iron + rank`, and Iron is 0x0200
// with Steel, Silver, Elven, Dwarven, Mithril, Adamantium, Ebony,
// Orcish and Daedric filling 0x0201..0x0209. Ten metals, ten ranks,
// exactly. Leather (0x0000), Chain (0x0100) and Chain2 (0x0103) sit
// BELOW Iron and the gift can never reach them.
//
// THE PIECE COUNT IS AN OFF-BY-ONE, the same family as the shop
// shelves': `for (int i = Random.Range(3, 7); i >= 0; i--)` draws
// 3..6 and then runs i + 1 times, so the player is offered FOUR to
// SEVEN pieces - never three.
//
// AND THE GIFT IS CLAIMED BY TAKING, not by asking. DFU hands the
// list to the inventory window in CHOOSE-ONE mode and sets the rank's
// flag from the take callback (:212), so closing the window without
// taking anything leaves the flag clear and the armour claimable
// later. Declining costs nothing.
//
// FLAGGED, not ported: RestoreGuildData's legacy flag migration
// (:288-294) rewrites a pre-DFU-0.11 flag layout on load. This port
// has never written that layout, so there is nothing to migrate and
// the arm would only be able to corrupt a save it invented.

import { ARMOR_MATERIAL } from './armorMaterials.js';
import { ARMOR_ENUM } from '../combat/enemyEquipment.js';

/** KnightlyOrder's two flag constants (:42-43). */
export const HOUSE_FLAG_MASK = 2;
export const ARMOR_FLAG_START = 4;
/** The rank's own bit (:197). */
export const armorMaskForRank = (rank) => ARMOR_FLAG_START << rank;
export const hasClaimedArmor = (membership, rank = membership?.rank ?? 0) =>
  ((membership?.flags ?? 0) & armorMaskForRank(rank)) > 0;

/** The TEXT.RSC records the smith speaks (:36-39). */
export const ARMOR_TEXT_ID = 463;          // "I have a fine piece of armor for you."
export const NO_ARMOR_TEXT_ID = 461;       // "You have already received your armor..."
export const NO_HOUSE_TEXT_ID = 460;       // ReceiveHouse's refusal, kept with its siblings
/** The Spymaster's greeting (DaggerfallGuildServicePopupWindow:433). */
export const SPYMASTER_GREETING_TEXT_ID = 402;

/** The seven body pieces the gift draws from - Range(102, 108 + 1),
 *  INCLUSIVE, which is Cuirass through Boots and no shield. */
export const GIFT_ARMOR_PIECES = Object.freeze([
  ARMOR_ENUM.Cuirass, ARMOR_ENUM.Gauntlets, ARMOR_ENUM.Greaves,
  ARMOR_ENUM.Left_Pauldron, ARMOR_ENUM.Right_Pauldron, ARMOR_ENUM.Helm, ARMOR_ENUM.Boots,
]);

/** `ArmorMaterialTypes.Iron + rank` (:205) - see the header. A rank
 *  past the ninth would walk off the end of the metals, so it clamps
 *  where DFU's ten ranks stop it. */
export const giftArmorMaterial = (rank) =>
  ARMOR_MATERIAL.Iron + Math.max(0, Math.min(9, rank ?? 0));

/**
 * ReceiveArmor's ladder (:195-215). Answers one of
 *   { kind: 'refuse', textId }              - already claimed at this rank
 *   { kind: 'offer', textId, pieces, mask } - the choose-one list
 * `rolls` is the engine PRNG seam (Ledger A); `makeArmor(piece,
 * material)` is the host's minter, so this module never learns what
 * an item record looks like.
 */
export function receiveArmorDecision(membership, { rolls = Math.random, makeArmor = null } = {}) {
  const rank = membership?.rank ?? 0;
  const mask = armorMaskForRank(rank);
  if (hasClaimedArmor(membership, rank)) return { kind: 'refuse', textId: NO_ARMOR_TEXT_ID };
  const material = giftArmorMaterial(rank);
  // Range(3, 7) draws 3..6, and `i >= 0` runs it i + 1 times.
  const count = 3 + Math.floor(rolls() * 4) + 1;
  const pieces = [];
  for (let i = 0; i < count; i++) {
    const piece = GIFT_ARMOR_PIECES[Math.floor(rolls() * GIFT_ARMOR_PIECES.length)];
    pieces.push(makeArmor ? makeArmor(piece, material) : { group: 'Armor', templateIndex: piece, material });
  }
  return { kind: 'offer', textId: ARMOR_TEXT_ID, pieces, mask };
}

/** The take callback (:212) - `flags |= armorMask`, and nothing else.
 *  Returns the new flags so a caller can store them wherever the
 *  membership lives. */
export function claimArmor(membership, mask) {
  if (!membership) return 0;
  membership.flags = (membership.flags ?? 0) | mask;
  return membership.flags;
}
