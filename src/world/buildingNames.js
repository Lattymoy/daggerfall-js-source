// T3c: building names (FormulaHelper.GenerateBuildingName, MIT
// Daggerfall Workshop) - the classic seed-based shop/tavern names.
// Verbatim: DFRandom.srand(seed) then the part draws IN SOURCE ORDER
// (B before A for two-part names); the name lists are DFU's
// Internal_Strings tables committed as data (classic FALL.EXE
// strings). Macros: %cn = location name; %ef burns one rand() (the
// classic macro-expansion burn) then draws a male first name from
// the REGION race bank (DFU's fix of the classic always-Breton
// leftover); %rt = the region ruler's title. Banks are "The Bank of
// <region>"; guild halls take the faction name, temples the
// faction's FIRST CHILD name (the callers pass resolvers); palaces
// are TEXT.RSC 475/476/477 for Daggerfall/Wayrest/Sentinel else
// "Palace"; houses return empty (quest renames pend).

import { srand, rand, randomRange } from '../formats/dfRandom.js';
import { firstName, GENDERS } from '../characters/nameHelper.js';
import { localizedText, localizedTable, localizedTextList } from '../systems/textManager.js';   // L10N3d: DFU's Internal_Strings, read in the player's language
import { getLocalizedFactionName } from '../systems/textManager.js';   // L10N3e: a guild hall's and a temple's faction names, as shown
import { isOnlinePage } from '../systems/onlineLane.js';   // EMPIRE-BANK: online, every bank is the Empire's

/** EMPIRE-BANK (2026-09-27, Discord: "For online mode, the bank of daggerfall becomes the bank of the empire"): what an
 *  online page's banks are "of" - every one of them, whatever region it stands in ("The Bank of the Empire"). A
 *  departure (Port-Ledger A); offline a bank is Daggerfall's "The Bank of <region>". */
export const EMPIRE_BANK_OF = 'the Empire';

export const BUILDING_TYPES = Object.freeze({
  None: -1, Alchemist: 0, HouseForSale: 1, Armorer: 2, Bank: 3, Town4: 4,
  Bookseller: 5, ClothingStore: 6, FurnitureStore: 7, GemStore: 8,
  GeneralStore: 9, Library: 10, GuildHall: 11, PawnShop: 12,
  WeaponSmith: 13, Temple: 14, Tavern: 15, Palace: 16,
  House1: 17, House2: 18, House3: 19, House4: 20, House5: 21, House6: 22,
  Town23: 23, Ship: 24,
  // AUDIT 24 systems: the tail of DFLocation.BuildingTypes
  // (DFLocation.cs:133-139). Special1-4 "never displayed on automap";
  // AnyShop/AnyHouse/AllValid are DaggerfallUnity's own wildcards.
  // TalkManager.CheckBuildingTypeInSkipList names AllValid and
  // Special1-4 by hand, and without them here five of its seventeen
  // entries were `undefined`.
  Special1: 0x74, Special2: 0xdf, Special3: 0xf9, Special4: 0xfa,
  AnyShop: 0xfffd, AnyHouse: 0xfffe, AllValid: 0xffff,
});

export const NAMED_BUILDING_TYPES = Object.freeze([0, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
export const isNamedBuildingType = (t) => NAMED_BUILDING_TYPES.includes(t);
/** RMBLayout.IsResidence (:753-760): only House1-House4 ID as a
 *  "Residence" (TK-ii's quest-residence General section reads it). */
export const isResidence = (t) => t >= BUILDING_TYPES.House1 && t <= BUILDING_TYPES.House4;
/** ROAD-B B4: RMBLayout.IsTavern (:803), the one-line equality beside
 *  its sibling above - `buildingType == DFLocation.BuildingTypes.Tavern`.
 *  Both are read by PlayerActivate.TransitionInterior (:1121-1122) to
 *  latch PlayerEnterExit.IsPlayerInsideTavern / IsPlayerInsideResidence
 *  at the door; the predicate had only ever existed as an inline lambda
 *  at the guild-service seam. */
export const isTavern = (t) => t === BUILDING_TYPES.Tavern;
/** RMBLayout.IsResidence: House1-House4. */

// DFU Internal_Strings (classic FALL.EXE), verbatim - each list read by its
// key where GenerateBuildingName reads it (FormulaHelper.cs:2939-3007), so
// a translation's list (and its length, which the draw ranges over) is the one drawn.
export const storesA = () => localizedTextList('StoresA', ["%ef's", "%cn's Best", 'The Essential', "Lord %ef's", "The Adventurer's", 'The Odd', "%ef's Finest", 'Bargain', 'Vintage', "The Emperor's", '%cn', "%ef's General", 'The Superior', "%ef's Quality", 'First Class', "The %rt's", 'The Champion', "Doctor %ef's", "Lady %ef's"]);
export const tavernsA = () => localizedTextList('TavernsA', ["The Queen's", "The King's", 'The Dirty', 'The Black', 'The Mole and', 'The Green', 'The Red', 'The Gold', 'The White', 'The Silver', 'The Crimson', 'The Flying', 'The Dancing', 'The Laughing', 'The Restless', 'The Thirsty', 'The Unfortunate', 'The Lucky', "The Devil's", 'The Rusty', 'The Howling', 'The Screaming', 'The Bat and', 'The Lion and', 'The Lynx and', 'The Dwarf and', 'The Beaver and', 'The Fox and', 'The Mouse and', 'The Pig and', 'The Feather and', 'The Toad and', 'The Rat and', 'The Savage', 'The Knave and', 'The Dead']);
export const tavernsB = () => localizedTextList('TavernsB', ['Chasm', 'Mug', 'Pit', 'Cat', 'Dog', 'Goblin', 'Griffin', 'Dragon', 'Ogre', 'Giant', 'Djinn', 'Wolf', 'Huntsman', 'Dagger', 'Skull', 'Sword', 'Guard', 'Dungeon', 'Helm', 'Castle', 'Jug', 'Bird', 'Gnome', 'Hedgehog', 'Muskrat', 'Woodchuck', 'Scorpion', 'Badger', 'Goat', 'Porcupine', 'Priest', 'Fawn', 'Stag', 'Barbarian', 'Rascal', 'Fairy']);
export const generalStoresB = () => localizedTextList('GeneralStoresB', ['Supplies', 'Supply Store', 'Gear', 'Gear Store', 'Equipment', 'Equipment Store', 'Sundries', 'Provisions', 'Merchandise', 'General Store', 'Retail Store', 'Trading Post', 'Market', 'Wares', 'Warehouse']);
export const weaponStoresB = () => localizedTextList('WeaponStoresB', ['Weapons', 'Weaponry', 'Arms', 'Armaments', 'Arsenal', 'Armsmaker', 'Blades', 'Blacksmith', 'Metalsmith', 'Weaponsmith']);
export const armorStoresB = () => localizedTextList('ArmorStoresB', ['Armory', 'Mail', 'Shielding', 'Armor', 'Shields', 'Aegis', 'Metalworks', 'Blacksmith', 'Metalsmith', 'Armorer', 'Smith', 'Smithy']);
export const bookStoresB = () => localizedTextList('BookStoresB', ['Books', 'Bookstore', 'Bookshop', 'Book Dealer', 'Book Center', 'Bookseller', 'Bookstall', 'Incunabula']);
export const clothingStoresB = () => localizedTextList('ClothingStoresB', ['Clothing', 'Clothes', 'Garments', 'Apparel', 'Costumes', 'Vestments', 'Attire', 'Fashion', 'Tailoring', 'Outfits', 'Finery']);
export const alchemyStoresB = () => localizedTextList('AlchemyStoresB', ['Herbs', 'Potherbs', 'Spices', 'Remedies', 'Antidotes', 'Physics', 'Medicines', 'Potions', 'Tinctures', 'Medicaments', 'Elixirs', 'Pharmacy', 'Apothecary', 'Unguents', 'Medicinal Agents', 'Herb Garden', 'Pharmaceuticals', 'Chemistry', 'Chemicals', 'Experimental Products', 'Alchemistry', 'Alchemical Solutions', 'Metallurgy']);
export const gemStoresB = () => localizedTextList('GemStoresB', ['Gems', 'Gemstones', 'Jewelry', 'Jewels', 'Precious Stones', 'Bijoutry', 'Jewelers', 'Jewel Box', 'Jewelry Shop', 'Gemcutter']);
export const pawnStoresB = () => localizedTextList('PawnStoresB', ['Pawnshop', 'Pawnbrokers', 'Used Supplies', 'Used Gear', 'Used Equipment', 'Used Merchandise', 'Hockshop', 'Antiquities']);
export const furnitureStoresB = () => localizedTextList('FurnitureStoresB', ['Furniture', 'Furnishings', 'Interior Design', 'Furniture Shop', 'Decor', 'Carpentry', 'Woodworking', 'Crafts', 'Woodwork']);
export const libraryStoresB = () => localizedTextList('LibraryStoresB', ['Library', 'Bookroom', 'Athenaeum', 'Public Library', 'Historians', 'Bookroom', 'Seminary', 'Lyceum']);
// MacroHelper.GetRulerTitle: twelve explicit cases, then `default: "Lord"`.
// 11 is written out even though it equals the default - the table is a
// transcription of the switch, and 'Lady' is reachable only via case 12.
export const RULER_TITLES = localizedTable({ 1: ['King', 'King'], 2: ['Queen', 'Queen'], 3: ['Duke', 'Duke'], 4: ['Duchess', 'Duchess'], 5: ['Marquis', 'Marquis'], 6: ['Marquise', 'Marquise'], 7: ['Count', 'Count'], 8: ['Countess', 'Countess'], 9: ['Baron', 'Baron'], 10: ['Baroness', 'Baroness'], 11: ['Lord', 'Lord'], 12: ['Lady', 'Lady'] });
export const rulerTitle = (ruler) => RULER_TITLES[ruler] ?? localizedText('Lord', 'Lord');

const STORE_B = {
  [BUILDING_TYPES.GeneralStore]: generalStoresB,
  [BUILDING_TYPES.WeaponSmith]: weaponStoresB,
  [BUILDING_TYPES.Armorer]: armorStoresB,
  [BUILDING_TYPES.Bookseller]: bookStoresB,
  [BUILDING_TYPES.ClothingStore]: clothingStoresB,
  [BUILDING_TYPES.Alchemist]: alchemyStoresB,
  [BUILDING_TYPES.GemStore]: gemStoresB,
  [BUILDING_TYPES.PawnShop]: pawnStoresB,
  [BUILDING_TYPES.FurnitureStore]: furnitureStoresB,
  [BUILDING_TYPES.Library]: libraryStoresB,
};

/**
 * GenerateBuildingName, verbatim.
 * @param opts { locationName, regionName, nameBank (the region race
 *   bank for %ef), regentRuler (region faction ruler for %rt),
 *   factionName(id) -> string (guild halls), templeName(id) -> string
 *   (the faction's first child), palaceTextId(locationName) -> string }
 *   L10N3e: and shownLocationName / shownRegionName, the pair as the
 *   player's language shows it (the caller's GetLocalizedLocationName /
 *   GetLocalizedRegionName, TalkManager.cs:2788-2789 and the rest) -
 *   what a shop's %cn and the bank's region print. The canonical
 *   locationName stays the key a palace is chosen by.
 *   L10N3e: and shownFactionName(id) / shownTempleName(id), the two
 *   faction names as the player's language shows them (shownFactionNames
 *   below makes the pair) - what a guild hall and a temple print. One
 *   that answers nothing leaves the canonical resolver's name, so a bag
 *   without them names every building exactly as before.
 */
export function generateBuildingName(seed, type, opts = {}) {
  const { locationName = '', regionName = '', nameBank = 0, regentRuler = 0, factionId = 0, factionName = null, templeName = null, palaceName = null } = opts;
  const { shownFactionName = null, shownTempleName = null } = opts;
  const shownLocationName = opts.shownLocationName ?? locationName, shownRegionName = opts.shownRegionName ?? regionName;
  let a = '', b = '';
  let singleton = false;
  srand(seed);
  switch (type) {
    case BUILDING_TYPES.HouseForSale:
      return localizedText('houseForSale', 'House for sale');
    case BUILDING_TYPES.Tavern: {
      const tavernB = tavernsB(), tavernA = tavernsA();
      b = tavernB[randomRange(0, tavernB.length)];
      a = tavernA[randomRange(0, tavernA.length)];
      break;
    }
    case BUILDING_TYPES.Bank:
      b = isOnlinePage() ? EMPIRE_BANK_OF : shownRegionName;   // EMPIRE-BANK
      a = localizedText('theBankOf', 'The Bank of');
      break;
    case BUILDING_TYPES.GuildHall:
      a = shownFactionName?.(factionId) ?? factionName?.(factionId) ?? '';   // L10N3e: FormulaHelper.cs:3022, as shown
      singleton = true;
      break;
    case BUILDING_TYPES.Temple:
      a = shownTempleName?.(factionId) ?? templeName?.(factionId) ?? '';   // L10N3e: FormulaHelper.cs:3036, as shown
      singleton = true;
      break;
    case BUILDING_TYPES.Palace:
      a = palaceName?.(locationName) ?? localizedText('palace', 'Palace');
      singleton = true;
      break;
    case BUILDING_TYPES.Town23:
      a = localizedText('cityWall', 'City Wall');
      singleton = true;
      break;
    default: {
      const list = STORE_B[type]?.();
      if (!list) return '';   // houses: quest renames pend
      const stores = storesA();
      b = list[randomRange(0, list.length)];
      a = stores[randomRange(0, stores.length)];
      break;
    }
  }
  a = a.replaceAll('%cn', shownLocationName);
  if (a.includes('%ef')) {
    rand();   // the classic macro-expansion burn, verbatim
    a = a.replaceAll('%ef', firstName(nameBank, GENDERS.Male));
  }
  if (a.includes('%rt')) a = a.replaceAll('%rt', rulerTitle(regentRuler));
  return singleton ? a : `${a} ${b}`;
}

/** L10N3e: THE FACTION NAMES A GUILD HALL AND A TEMPLE SHOW, for the
 *  name bag - over the caller's faction store (`getFaction(id)`, a
 *  FACTION.TXT record with its `children`). DFU reads both through
 *  GetFactionData, which hands the record back with its name in the
 *  player's language (PersistentFactionData.cs:176): a hall its own
 *  faction's (FormulaHelper.cs:3020-3022), a temple its first child's
 *  (:3029-3036), or - the name bag's own law for a faction with no
 *  child - the faction's. Each is looked up by the record's own id; a
 *  missing record answers null, and the canonical resolver speaks. */
export function shownFactionNames(getFaction) {
  const shown = (id) => {
    const f = getFaction?.(id);
    return f?.name != null ? getLocalizedFactionName(id, f.name) : null;
  };
  return {
    shownFactionName: (id) => shown(id),
    shownTempleName: (id) => {
      const children = getFaction?.(id)?.children;
      return shown(children?.length ? children[0] : id);
    },
  };
}
