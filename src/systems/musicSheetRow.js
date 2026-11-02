// @ts-check
// MUSIC-BOX (bible/06-Systems/Online-Arc.md MUSIC-BOX): THE SHEET MUSIC'S ROW - a leaf, registered at import, so the
// item law (systems/item/itemLaw.js) knows the template headless; its use and its drop are systems/musicBox.js's.
import { registerCustomTemplates } from './item/itemTemplates.js';

/** The sheet's template - free after the port's own (keepsake.js 1800, 1810, 1820). Its picture is DFU's Parchment's. */
export const MUSIC_SHEET_TEMPLATE = 1830;
export const MUSIC_SHEET_GROUP = 'UselessItems2';
export const MUSIC_SHEET_ROW = Object.freeze({
  index: MUSIC_SHEET_TEMPLATE, name: 'Sheet music', baseWeight: 0.1, hitPoints: 100, capacityOrTarget: 0, basePrice: 25,
  enchantmentPoints: 0, rarity: 10, variants: 0, drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false,
  isOneHanded: false, isIngredient: false, worldTextureArchive: 209, worldTextureRecord: 8, playerTextureArchive: 0,
  playerTextureRecord: 0, stackable: false,
});
registerCustomTemplates([MUSIC_SHEET_ROW]);
