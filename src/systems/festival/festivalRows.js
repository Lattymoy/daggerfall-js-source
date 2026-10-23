// @ts-check
// WITCH1 (2026-10-20, bible/06-Systems/Witches-Festival.md): THE WITCHES' FESTIVAL'S ITEM ROWS, A LEAF - the Soul Cake and
// the Hearth Offering, as the item law reads them headless (systems/item/itemLaw.js LAW_ONLY - the account service loads
// none of soulCake.js's home, which lays their names and pictures over these rows and registers them: the Weir Key's
// lesson, KEY-LAW). It imports nothing.
//
// Both BOUND (net/realm/realmTradeLaw.js BOUND_TEMPLATES names them - never sold, traded, dropped or lost to a death:
// the cakes and the bowls are the account's counts, the pack's stacks their faces), stacked, and PACK-ONLY (systems/item/
// itemBound.js isPackOnly, KEY-FACE's law: a face stowed in the wagon or a chest was never restacked, and showed twice).
// The law reads no `packOnly`.

/** Template 2000 and 2001 (net/festivalLaw.js SOUL_CAKE_TEMPLATE, HEARTH_OFFERING_TEMPLATE - pinned equal). */
export const SOUL_CAKE_LAW_ROW = Object.freeze({
  index: 2000, baseWeight: 0.05, hitPoints: 1, basePrice: 0, rarity: 20, bound: true, stackable: true, packOnly: true,
});
export const HEARTH_OFFERING_LAW_ROW = Object.freeze({
  index: 2001, baseWeight: 2, hitPoints: 100, basePrice: 0, rarity: 20, bound: true, stackable: true, packOnly: true,
});
