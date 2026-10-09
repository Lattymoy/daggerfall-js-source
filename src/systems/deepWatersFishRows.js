// INT1 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md): DEEP WATERS' FISH ROWS, A LEAF. They were
// deepWatersFishItems.js's own, and that module pulls the sea's textures and the passive fish in; the item law
// (systems/itemLaw.js) runs on the account service, which loads none of it, and needs only the rows. One home, two
// readers: deepWatersFishItems.js imports and re-exports every name here and registers the rows as it always did.

import FISH_TEMPLATES_JSON from '../../vendor/iliac-puddle-no-more/ItemTemplates.json' with { type: 'json' };

/** ItemGroups.UselessItems2, as the port names it. */
export const FISH_GROUP = 'UselessItems2';
/** A fish's picture's archive: its own template index (record 0). */
export const fishIconArchive = (templateIndex) => templateIndex;

/** The mod's rows, each drawn from its own picture (above). */
export const DEEP_WATERS_FISH_TEMPLATES = Object.freeze(FISH_TEMPLATES_JSON.map((t) => Object.freeze({
  ...t, worldTextureArchive: fishIconArchive(t.index), worldTextureRecord: 0,
})));
