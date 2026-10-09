// @ts-check
// INT9 (2026-10-09, the INTEGRITY arc's lane 2 - bible/06-Systems/Integrity-Arc.md): THE ITEM KINDS A DEATH IN THE ZONE
// READS, A LEAF. The template indices DaggerfallUnityItem's predicates name (ItemEnums.cs) and the two predicates the
// zone's drop law asks (systems/wildDropLaw.js) - their home since INT9, so the account Worker bundles them without the
// use handler's whole graph (systems/useItem.js re-exports every one). Imports nothing.

/** The template indices the predicates name (ItemEnums.cs). */
export const TEMPLATES = Object.freeze({
  Spellbook: 132,          // MiscItems
  Soul_trap: 274,
  Letter_of_credit: 275,
  Potion_recipe: 278,
  House_Deed: 285,
  Ship_Deed: 286,
  Map: 287,                // MiscItems.Map AND Maps.Map (287 both ways)
  Glass_Bottle: 83,        // UselessItems1 - a POTION is a filled bottle
  Torch: 247,              // UselessItems2
  Lantern: 248,
  Bandage: 249,
  Oil: 252,
  Candle: 253,
  Parchment: 279,
  Holy_candle: 269,        // ReligiousItems
  Arrow: 131,              // Weapons (ItemEnums.cs:230 - AUDIT 23: was 130, the Long_Bow)
  Helm: 107,               // Armor (ItemEnums.cs:202 - AUDIT 23: was 103, the Gauntlets)
});

/** IsLightSource (:316-323): Torch, Lantern, Candle - and the Holy
 *  candle, which is in a DIFFERENT group and is easy to miss. */
export const isLightSource = (it) =>
  (it?.group === 'UselessItems2' && (it.templateIndex === TEMPLATES.Torch
    || it.templateIndex === TEMPLATES.Lantern || it.templateIndex === TEMPLATES.Candle))
  || (it?.group === 'ReligiousItems' && it.templateIndex === TEMPLATES.Holy_candle);

/** IsPotion (:352-355). A potion IS a glass bottle - classic decides
 *  by whether the record has a PotionMix sublist, and DFU's comment
 *  says so where it uses this. */
export const isPotion = (it) => it?.group === 'UselessItems1' && it.templateIndex === TEMPLATES.Glass_Bottle;
