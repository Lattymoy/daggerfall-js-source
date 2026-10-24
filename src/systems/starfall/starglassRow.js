// @ts-check
// STAR7 (2026-10-20): STARGLASS'S ROW, A LEAF - the Weir Key's law (systems/eliteGates/weirKeyRow.js, KEY-LAW): the item law
// (systems/item/itemLaw.js) runs on the account service, which loads none of the game, so a template whose home pulls the
// texture door in is read beside the registry from a leaf (lawTemplate) - never a template no honest client mints there.
// starglass.js lays its name and picture over this row and registers it. It imports nothing.
//
// Not a DFU member. Ledger A (STARFALL).

/** Template 576, free beside the gate's 570-572, the Ayleid stones' 573-574 and the Weir Key's 575. */
export const STARGLASS_TEMPLATE = 576;
/** Its row, but its name and its picture: a sliver of glass, light; it sells well and it trades (never bound - a held
 *  star's spoils are the holder's to sell or give); it stacks with its own kind alone. Miscellany (UselessItems2), never a
 *  gem: every Gems piece is a crystal a slot takes (systems/gate/gateSpoils.js PORTAL1's lesson). */
export const STARGLASS_LAW_ROW = Object.freeze({
  index: STARGLASS_TEMPLATE, baseWeight: 0.1, hitPoints: 1000, basePrice: 400, rarity: 20, stackable: true,
});
