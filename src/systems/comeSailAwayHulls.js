// COME SAIL AWAY's HULL TABLE - its names, prices, weights and variant names - a LEAF (INT1, 2026-10-09). The item law
// (src/systems/itemLaw.js) reads the boats' items through comeSailAwayItems.js, and the account service runs the law: a
// table read through comeSailAwayBoat.js carried the boat's renderer into the Worker with it - comeSailAwayModels.js,
// whose model URLs are made from `import.meta.url` as the module loads, which a Worker need not have. The boat module
// imports these from here and re-exports them, so every reader keeps its import.
export const HULL_NAMES = Object.freeze(['Rowboat', 'Large Boat', 'Small Ship', 'Large Galley', 'Carrack']);
export const HULL_PRICES = Object.freeze([4000, 8000, 100000, 200000, 150000]);
export const HULL_WEIGHTS = Object.freeze([30, 120, 2400, 48000, 240000]);
export const VARIANT_NAMES = Object.freeze(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']);
