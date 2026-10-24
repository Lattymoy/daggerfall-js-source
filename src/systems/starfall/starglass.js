// @ts-check
// STAR7 (2026-10-20): STARFALL GLASS - pale glass from a fallen star that still holds some of its light, one to three pieces
// in every held star's spoils (the Heart-Star's twice that; systems/starfall/starSpoils.js). Template 576 (starglassRow.js -
// the leaf the item law reads headless), miscellany, stacked, traded freely, and a good price at any counter: the star's
// glass is a thing the Mages Guild buys and the covens want back. Design: bible/11-Multiplayer/Starfall.md section 6.
//
// ITS NAME (AUDIT STAR I1): it was "Starglass", the name the Eltheric Ocean's trade good already wore (systems/naval/
// tradeGoods.js, template 1340 - a ship's cargo), and the harbour's exchange counts by template, so a captain carrying the
// star's glass read "have 0" against a good of the same name. The star's is Starfall Glass wherever a player reads it; the
// code keeps its `starglass` names. test/systems/starfall/auditstar.test.js holds every custom row's name its own.
//
// ITS PICTURE is its own (world/starfall/starglassArt.js), put on the texture door at this file's import as its archive's
// stand-in, so every door that draws an item's picture draws it (the Weir Key's law, systems/eliteGates/weirKey.js).
//
// Not a DFU member. Ledger A (STARFALL).
import { registerCustomTemplates, setItemFields, mintCondition } from '../item/itemTemplates.js';
import { t } from '../textManager.js';
import { addVendorTextures } from '../textureReplacement.js';
import { STARGLASS_ART, registerStarglassArt } from '../../world/starfall/starglassArt.js';
import { STARGLASS_TEMPLATE, STARGLASS_LAW_ROW } from './starglassRow.js';
export { STARGLASS_TEMPLATE };

/** Its row: the leaf's with its name and its picture. */
export const STARGLASS_ROW = Object.freeze({
  ...STARGLASS_LAW_ROW, name: 'Starfall Glass', worldTextureArchive: STARGLASS_ART.archive, worldTextureRecord: STARGLASS_ART.record,
});
registerCustomTemplates([STARGLASS_ROW]);
registerStarglassArt(addVendorTextures);   // the import IS the registration
/** Its card's lines: what it is and what it is for - read when the card is shown (the Soul Cake's shape, systems/festival/
 *  soulCake.js SOUL_CAKE_TEXT). AUDIT STAR I2: its card said its name and its weight, and nothing more. */
export const STARGLASS_TEXT = Object.freeze({
  glass: () => [t('starfall.item.glass.what', 'Pale glass from a fallen star, still holding some of its light.'), t('starfall.item.glass.use', 'Any merchant pays well for it.')],
});
/** Whether a record is Starfall Glass - its template and its group, the one spelling every rule reads. */
export const isStarglass = (/** @type {any} */ item) => item?.templateIndex === STARGLASS_TEMPLATE && item?.group === 'UselessItems2';
/** `n` pieces of Starfall Glass (at least one), one stack, minted on their own row. */
export function starglass(n = 1) {
  return Object.assign(mintCondition(setItemFields({ group: 'UselessItems2', templateIndex: STARGLASS_TEMPLATE })), { stackCount: Math.max(1, Math.trunc(Number(n) || 1)) });
}
