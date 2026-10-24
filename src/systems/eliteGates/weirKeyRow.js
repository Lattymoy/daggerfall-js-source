// @ts-check
// FIELD BUGS 2026-10-17 KEY-LAW: THE WEIR KEY'S ROW, A LEAF. It was weirKey.js's own, and that module pulls the Spire's
// law, its key's picture and the texture door in; the item law (systems/item/itemLaw.js) runs on the account service,
// which loads none of it, so every Weir Key was a template no honest client mints there - and every realm character
// that held one had its trading frozen, with a strike, the hour the Breach went live. One home, two readers:
// weirKey.js lays its name and picture over this row and registers it, and the law reads it beside the registry (lawTemplate).
// It imports nothing.

/** Template 575, free beside the gate's 570-572 and the Ayleid stones' 573-574 (weirKey.js). */
export const WEIR_KEY_TEMPLATE = 575;
/** Its row, but its name and its picture (net/eliteGates/egLaw.js EG_TEXT.keyName, world/eliteGates/egKeyArt.js - the law
 *  reads neither): bound (net/realm/realmTradeLaw.js BOUND_TEMPLATES names it - never traded, never lost to a death),
 *  stacked, and PACK-ONLY (FIELD BUGS 2026-10-19f KEY-FACE, systems/item/itemBound.js isPackOnly - the Wallet's law): the
 *  stack is the account's balance's FACE, and the restack reads the pack alone (weirKey.js restackWeirKeys), so a face
 *  stowed in the wagon or the player's own storage was never seen - the pack was given a new one, and the stowed ones,
 *  carried back, all turned to rust at the next answer. The law reads no `packOnly`. */
export const WEIR_KEY_LAW_ROW = Object.freeze({
  index: WEIR_KEY_TEMPLATE, baseWeight: 0.25, hitPoints: 1000, basePrice: 500, rarity: 20, bound: true, stackable: true,
  packOnly: true,   // KEY-FACE: the face never leaves the pack
});
