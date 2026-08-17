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

export const BUILDING_TYPES = Object.freeze({
  None: -1, Alchemist: 0, HouseForSale: 1, Armorer: 2, Bank: 3, Town4: 4,
  Bookseller: 5, ClothingStore: 6, FurnitureStore: 7, GemStore: 8,
  GeneralStore: 9, Library: 10, GuildHall: 11, PawnShop: 12,
  WeaponSmith: 13, Temple: 14, Tavern: 15, Palace: 16,
  House1: 17, House2: 18, House3: 19, House4: 20, House5: 21, House6: 22,
  Town23: 23, Ship: 24,
});

export const NAMED_BUILDING_TYPES = Object.freeze([0, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
export const isNamedBuildingType = (t) => NAMED_BUILDING_TYPES.includes(t);
/** RMBLayout.IsResidence: House1-House4. */
export const isResidence = (t) => t >= 17 && t <= 20;

// DFU Internal_Strings (classic FALL.EXE), verbatim.
export const STORES_A = Object.freeze(["%ef's", "%cn's Best", 'The Essential', "Lord %ef's", "The Adventurer's", 'The Odd', "%ef's Finest", 'Bargain', 'Vintage', "The Emperor's", '%cn', "%ef's General", 'The Superior', "%ef's Quality", 'First Class', "The %rt's", 'The Champion', "Doctor %ef's", "Lady %ef's"]);
export const TAVERNS_A = Object.freeze(["The Queen's", "The King's", 'The Dirty', 'The Black', 'The Mole and', 'The Green', 'The Red', 'The Gold', 'The White', 'The Silver', 'The Crimson', 'The Flying', 'The Dancing', 'The Laughing', 'The Restless', 'The Thirsty', 'The Unfortunate', 'The Lucky', "The Devil's", 'The Rusty', 'The Howling', 'The Screaming', 'The Bat and', 'The Lion and', 'The Lynx and', 'The Dwarf and', 'The Beaver and', 'The Fox and', 'The Mouse and', 'The Pig and', 'The Feather and', 'The Toad and', 'The Rat and', 'The Savage', 'The Knave and', 'The Dead']);
export const TAVERNS_B = Object.freeze(['Chasm', 'Mug', 'Pit', 'Cat', 'Dog', 'Goblin', 'Griffin', 'Dragon', 'Ogre', 'Giant', 'Djinn', 'Wolf', 'Huntsman', 'Dagger', 'Skull', 'Sword', 'Guard', 'Dungeon', 'Helm', 'Castle', 'Jug', 'Bird', 'Gnome', 'Hedgehog', 'Muskrat', 'Woodchuck', 'Scorpion', 'Badger', 'Goat', 'Porcupine', 'Priest', 'Fawn', 'Stag', 'Barbarian', 'Rascal', 'Fairy']);
export const GENERAL_STORES_B = Object.freeze(['Supplies', 'Supply Store', 'Gear', 'Gear Store', 'Equipment', 'Equipment Store', 'Sundries', 'Provisions', 'Merchandise', 'General Store', 'Retail Store', 'Trading Post', 'Market', 'Wares', 'Warehouse']);
export const WEAPON_STORES_B = Object.freeze(['Weapons', 'Weaponry', 'Arms', 'Armaments', 'Arsenal', 'Armsmaker', 'Blades', 'Blacksmith', 'Metalsmith', 'Weaponsmith']);
export const ARMOR_STORES_B = Object.freeze(['Armory', 'Mail', 'Shielding', 'Armor', 'Shields', 'Aegis', 'Metalworks', 'Blacksmith', 'Metalsmith', 'Armorer', 'Smith', 'Smithy']);
export const BOOK_STORES_B = Object.freeze(['Books', 'Bookstore', 'Bookshop', 'Book Dealer', 'Book Center', 'Bookseller', 'Bookstall', 'Incunabula']);
export const CLOTHING_STORES_B = Object.freeze(['Clothing', 'Clothes', 'Garments', 'Apparel', 'Costumes', 'Vestments', 'Attire', 'Fashion', 'Tailoring', 'Outfits', 'Finery']);
export const ALCHEMY_STORES_B = Object.freeze(['Herbs', 'Potherbs', 'Spices', 'Remedies', 'Antidotes', 'Physics', 'Medicines', 'Potions', 'Tinctures', 'Medicaments', 'Elixirs', 'Pharmacy', 'Apothecary', 'Unguents', 'Medicinal Agents', 'Herb Garden', 'Pharmaceuticals', 'Chemistry', 'Chemicals', 'Experimental Products', 'Alchemistry', 'Alchemical Solutions', 'Metallurgy']);
export const GEM_STORES_B = Object.freeze(['Gems', 'Gemstones', 'Jewelry', 'Jewels', 'Precious Stones', 'Bijoutry', 'Jewelers', 'Jewel Box', 'Jewelry Shop', 'Gemcutter']);
export const PAWN_STORES_B = Object.freeze(['Pawnshop', 'Pawnbrokers', 'Used Supplies', 'Used Gear', 'Used Equipment', 'Used Merchandise', 'Hockshop', 'Antiquities']);
export const FURNITURE_STORES_B = Object.freeze(['Furniture', 'Furnishings', 'Interior Design', 'Furniture Shop', 'Decor', 'Carpentry', 'Woodworking', 'Crafts', 'Woodwork']);
export const LIBRARY_STORES_B = Object.freeze(['Library', 'Bookroom', 'Athenaeum', 'Public Library', 'Historians', 'Bookroom', 'Seminary', 'Lyceum']);
export const RULER_TITLES = Object.freeze({ 1: 'King', 2: 'Queen', 3: 'Duke', 4: 'Duchess', 5: 'Marquis', 6: 'Marquise', 7: 'Count', 8: 'Countess', 9: 'Baron', 10: 'Baroness' });
export const rulerTitle = (ruler) => RULER_TITLES[ruler] ?? 'Lord';

const STORE_B = {
  [BUILDING_TYPES.GeneralStore]: GENERAL_STORES_B,
  [BUILDING_TYPES.WeaponSmith]: WEAPON_STORES_B,
  [BUILDING_TYPES.Armorer]: ARMOR_STORES_B,
  [BUILDING_TYPES.Bookseller]: BOOK_STORES_B,
  [BUILDING_TYPES.ClothingStore]: CLOTHING_STORES_B,
  [BUILDING_TYPES.Alchemist]: ALCHEMY_STORES_B,
  [BUILDING_TYPES.GemStore]: GEM_STORES_B,
  [BUILDING_TYPES.PawnShop]: PAWN_STORES_B,
  [BUILDING_TYPES.FurnitureStore]: FURNITURE_STORES_B,
  [BUILDING_TYPES.Library]: LIBRARY_STORES_B,
};

/**
 * GenerateBuildingName, verbatim.
 * @param opts { locationName, regionName, nameBank (the region race
 *   bank for %ef), regentRuler (region faction ruler for %rt),
 *   factionName(id) -> string (guild halls), templeName(id) -> string
 *   (the faction's first child), palaceTextId(locationName) -> string }
 */
export function generateBuildingName(seed, type, opts = {}) {
  const { locationName = '', regionName = '', nameBank = 0, regentRuler = 0, factionId = 0, factionName = null, templeName = null, palaceName = null } = opts;
  let a = '', b = '';
  let singleton = false;
  srand(seed);
  switch (type) {
    case BUILDING_TYPES.HouseForSale:
      return 'House for sale';
    case BUILDING_TYPES.Tavern:
      b = TAVERNS_B[randomRange(0, TAVERNS_B.length)];
      a = TAVERNS_A[randomRange(0, TAVERNS_A.length)];
      break;
    case BUILDING_TYPES.Bank:
      b = regionName;
      a = 'The Bank of';
      break;
    case BUILDING_TYPES.GuildHall:
      a = factionName?.(factionId) ?? '';
      singleton = true;
      break;
    case BUILDING_TYPES.Temple:
      a = templeName?.(factionId) ?? '';
      singleton = true;
      break;
    case BUILDING_TYPES.Palace:
      a = palaceName?.(locationName) ?? 'Palace';
      singleton = true;
      break;
    case BUILDING_TYPES.Town23:
      a = 'City Wall';
      singleton = true;
      break;
    default: {
      const list = STORE_B[type];
      if (!list) return '';   // houses: quest renames pend
      b = list[randomRange(0, list.length)];
      a = STORES_A[randomRange(0, STORES_A.length)];
      break;
    }
  }
  a = a.replaceAll('%cn', locationName);
  if (a.includes('%ef')) {
    rand();   // the classic macro-expansion burn, verbatim
    a = a.replaceAll('%ef', firstName(nameBank, GENDERS.Male));
  }
  if (a.includes('%rt')) a = a.replaceAll('%rt', rulerTitle(regentRuler));
  return singleton ? a : `${a} ${b}`;
}
