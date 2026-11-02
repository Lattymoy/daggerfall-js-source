// COME SAIL AWAY's HULL TABLE - its names, prices, weights and variant names - a LEAF (INT1, 2026-10-09). The item law
// (src/systems/item/itemLaw.js) reads the boats' items through comeSailAwayItems.js, and the account service runs the law: a
// table read through comeSailAwayBoat.js carried the boat's renderer into the Worker with it - comeSailAwayModels.js,
// whose model URLs are made from `import.meta.url` as the module loads, which a Worker need not have. The boat module
// imports these from here and re-exports them, so every reader keeps its import.
export const HULL_NAMES = Object.freeze(['Rowboat', 'Large Boat', 'Small Ship', 'Large Galley', 'Carrack']);
export const HULL_PRICES = Object.freeze([4000, 8000, 100000, 200000, 150000]);
export const HULL_WEIGHTS = Object.freeze([30, 120, 2400, 48000, 240000]);
export const VARIANT_NAMES = Object.freeze(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']);
/** SHIP-PACK (2026-10-01, the review before the merge: "Allow larger ships to be picked up, just like smaller vessels"):
 *  what a hull's parts weigh packed - the table's, and never more than the Large Boat's. The three ships' rows (2,400 to
 *  240,000 kg) were never an item's in the mod, whose ships were never packed: in the pack they would hold the bearer
 *  under the water, sink any boat she sailed ("You're going to need a bigger boat") and take nothing more aboard.
 *  PARTS-WEIGHT (FIELD BUGS 2026-10-18e): and all a packed boat's parts ever weigh - her hold rides them no more. Here in
 *  the leaf so the save's item repair (comeSailAwayItems.js repairPartsWeights) reads it without the boat's renderer. */
export const PACKED_WEIGHT_MAX = HULL_WEIGHTS[1];
export const packedHullWeight = (hull) => Math.min(HULL_WEIGHTS[hull], PACKED_WEIGHT_MAX);
/** GetHullFromMessage: the item's `message` is hull * 10 + variant (its pair, GetVariantFromMessage, comeSailAway.js). */
export const hullFromMessage = (message) => Math.trunc(message / 10) % 10;
