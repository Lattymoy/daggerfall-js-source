// @ts-check
// TOWN-SIGNS - the town map's second look: a picture for every shop and guild.
// The enhanced town map has two looks, one pref (`townMapMode`, systems/uiPrefs.js) and one button on the map's top bar.
//   'names' - the map as it was: each discovered building lettered, a player's house marked with a house (townSheet.js)
//   'signs' - no lettering and no house marks: each building the map would name is a picture of its trade on its place.
//             The name is the pointer's (hoverLabel). A residence a quest has marked keeps its ring.
// The pictures are drawn in code (ui/ink/inkTown.js paintSign) and read nothing from the player's copy of the game.
// This file only says WHICH picture a building wears: `signKindOf`, pure.
import { BUILDING_TYPES } from '../../world/buildingNames.js';
import { GUILD_FACTION_IDS } from '../../systems/guild/guildFactions.js';

/** The two looks, as the pref spells them. */
export const TOWN_MODES = Object.freeze(['names', 'signs']);
export const nextTownMode = (/** @type {string} */ m) => (m === 'signs' ? 'names' : 'signs');
export const townModeOf = (/** @type {any} */ v) => (v === 'signs' ? 'signs' : 'names');

/** Every picture the map can draw, by the trade it stands for. */
export const SIGN_KINDS = Object.freeze([
  'potion', 'shield', 'coin', 'book', 'shirt', 'chair', 'gem', 'barrel', 'tome', 'balls', 'sword', 'star', 'mug', 'crown',
  'eye', 'swords', 'dagger', 'banner', 'diamond',
]);

const BY_TYPE = Object.freeze({
  [BUILDING_TYPES.Alchemist]: 'potion',
  [BUILDING_TYPES.Armorer]: 'shield',
  [BUILDING_TYPES.Bank]: 'coin',
  [BUILDING_TYPES.Bookseller]: 'book',
  [BUILDING_TYPES.ClothingStore]: 'shirt',
  [BUILDING_TYPES.FurnitureStore]: 'chair',
  [BUILDING_TYPES.GemStore]: 'gem',
  [BUILDING_TYPES.GeneralStore]: 'barrel',
  [BUILDING_TYPES.Library]: 'tome',
  [BUILDING_TYPES.PawnShop]: 'balls',
  [BUILDING_TYPES.WeaponSmith]: 'sword',
  [BUILDING_TYPES.Temple]: 'star',
  [BUILDING_TYPES.Tavern]: 'mug',
  [BUILDING_TYPES.Palace]: 'crown',
});

/**
 * The picture a building wears: its trade's, a guild hall's by WHICH guild (the Mages' eye, the Fighters' crossed swords, a
 * thieves' dagger, any other hall - a knightly order's too - a banner), and a plain diamond for what has no trade - which the map draws only for a quest's named house
 * (townSheet.js signsOnSheet leaves a landmark such as a city wall's gate out). Pure.
 * @param {number|null|undefined} buildingType DFU's BuildingTypes
 * @param {number|null|undefined} [factionId] a guild hall's faction
 */
export function signKindOf(buildingType, factionId = null) {
  if (buildingType === BUILDING_TYPES.GuildHall) {
    if (factionId === GUILD_FACTION_IDS.MagesGuild) return 'eye';
    if (factionId === GUILD_FACTION_IDS.FightersGuild) return 'swords';
    if (factionId === GUILD_FACTION_IDS.ThievesGuild || factionId === GUILD_FACTION_IDS.DarkBrotherhood) return 'dagger';
    return 'banner';   // a knightly order's hall (ORDERS) and any other: its banner
  }
  return (/** @type {Record<number, string>} */ (BY_TYPE))[/** @type {number} */ (buildingType)] ?? 'diamond';
}
