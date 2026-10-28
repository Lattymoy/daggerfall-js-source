// @ts-check
// LOCKPICK (2026-10-26, the owner: "I want to build a detailed lock picking minigame and introduce a lockpick item";
// bible/06-Systems/Lockpicking.md): THE LOCKPICK'S ROW, A LEAF - the Weir Key's law (systems/eliteGates/weirKeyRow.js,
// KEY-LAW): the item law (systems/item/itemLaw.js) runs on the account service, which loads none of the game, so a template
// whose home pulls the texture door in is read beside the registry from a leaf (lawTemplate). lockpickItem.js lays its
// name and picture over this row and registers it. It imports nothing.
//
// Not a DFU member: Daggerfall picks a lock with no item (DaggerfallActionDoor.AttemptLockpicking checks no inventory).
// Ledger A (LOCKPICK).

/** Template 584, free beside the Wallet's 580 and the Tavern's cards' 581-583, below the professions' reserved 600. */
export const LOCKPICK_TEMPLATE = 584;
/** Its row, but its name and its picture: a thin steel pick, next to nothing to carry; a modest price, sold on every
 *  General Store's and Pawn Shop's counter (shopStock.js ENDLESS-STOCK); it stacks with its own kind alone and trades
 *  freely. Miscellany (UselessItems2), as Foraging's tools and the Skinning Knife are. Rarity 20: no DFU shelf draw and
 *  no loot table rolls it - its doors are the counter's endless stack, a rogue's pockets and a thief's starting kit. */
export const LOCKPICK_LAW_ROW = Object.freeze({
  index: LOCKPICK_TEMPLATE, baseWeight: 0.05, hitPoints: 100, basePrice: 12, rarity: 20, stackable: true,
});
