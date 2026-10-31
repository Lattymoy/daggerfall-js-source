// INT1 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md): DEEP WATERS' FISH ROWS, A LEAF. They were
// deepWatersFishItems.js's own, and that module pulls the sea's textures and the passive fish in; the item law
// (systems/item/itemLaw.js) runs on the account service, which loads none of it, and needs only the rows. One home, two
// readers: deepWatersFishItems.js imports and re-exports every name here and registers the rows as it always did.
// OWN-WORK3 (2026-10-31): the rows and the names are our own, by the rules below. The indices are the ones saves hold.

/** ItemGroups.UselessItems2, as the port names it. */
export const FISH_GROUP = 'UselessItems2';
/** A fish's picture's archive: its own template index (record 0). */
export const fishIconArchive = (templateIndex) => templateIndex;

/** A fish's one name, its item's and its species' (world/passiveFish.js): the mark a fisher sees first, then the kind of
 *  fish it looks like. No name says a place, so each reads right in any province's water. */
export const FISH_NAMES = Object.freeze({
  9001: 'Gold Butterflyfish',
  9002: 'Rusttail Bass',
  9003: 'Ember Rockfish',
  9004: 'Bronze Carp',
  9005: 'Grey Mackerel',
  9006: 'Banded Angelfish',
  9007: 'Pale Grouper',
});

/** [index, kilos, gold]. Kilos: 1 x (drawn height / 0.8 m)^3, so the Grey Mackerel weighs Raw Fish's kilo, rounded to the
 *  nearest of 0.1, 0.25, 0.5, then half kilos. Gold: the meat at Raw Fish's price a kilo, plus 60 over the species'
 *  spawn weight (the rarer, the dearer), rounded. test/systems/item/dwe_fish.test.js recomputes both from the species. */
const ROWS = [
  [9001, 0.25, 7],
  [9002, 3.5, 26],
  [9003, 0.25, 8],
  [9004, 3.5, 21],
  [9005, 1, 7],
  [9006, 0.1, 30],
  [9007, 11.5, 47],
];

/** The rows, each drawn from its own picture (above). Nothing wears a fish (one point of condition, not repaired), and
 *  rarity 20 is the shelf's rarest: a fish is caught, and only the finest shop ever shelves one. */
export const DEEP_WATERS_FISH_TEMPLATES = Object.freeze(
  ROWS.map(([index, baseWeight, basePrice]) =>
    Object.freeze({
      index,
      name: FISH_NAMES[index],
      baseWeight,
      hitPoints: 1,
      basePrice,
      rarity: 20,
      worldTextureArchive: fishIconArchive(index),
      worldTextureRecord: 0,
      isNotRepairable: true,
    }),
  ),
);
