// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF1 (2026-09-28, Mac: "Begin!") - MAPSFILE'S PURE TABLES: the
// region names, the regions' races and the climates, moved out of
// mapsFile.js (which re-exports them) so the account service can read
// them without bundling a BSA reader. The professions' laws need two of
// them on both ends: a pixel's climate chooses its herbs, and its
// region's race chooses an herb's group - DFU's "(northern)" and
// "(southern)" plants (bible/06-Systems/Professions-Arc.md 22).
// Verbatim FALL.EXE / MapsFile.cs tables; nothing here reads a file.
// ═══════════════════════════════════════════════════════════════════

/** The world map's size in map pixels (MapsFile.MaxMapPixelX / Y). */
export const MAX_MAP_PIXEL_X = 1000;
export const MAX_MAP_PIXEL_Y = 500;

/** The Iliac Bay's own regions: MAPS.BSA's, FALL.EXE's tables' (MapsFile.cs - 0..61). */
export const BAY_REGION_COUNT = 62;

/** WW-R (2026-10-24, bible/03-World/World-Wide.md WW-R; the owner: "Separate regions make sense"): THE PROVINCES PAST THE
 *  BAY, each a region of its own after the Bay's 62 - theatre t's (world/worldWide/worldGrid.js, the picker's numbering:
 *  1 High Rock beyond the Bay ... 9 the Imperial Province) region 61 + t. The Bay's regions are what they were
 *  (Daggerfall is High Rock's, Sentinel Hammerfell's); a province's region holds no MAPS.BSA location (its places are the
 *  world's registry's - world/worldWide/worldPlaces.js), so MapsFile.getRegion answers none for it, as for an empty Bay
 *  region. The names are the provinces' as the map names them (tamrielGeography.js PROVINCES - pinned), the Imperial
 *  Province by the owner's word: Cyrodiil. */
export const PROVINCE_REGION_NAMES = Object.freeze([
  'High Rock',
  'Hammerfell',
  'Skyrim',
  'Morrowind',
  'Sumurset Isle',
  'Valenwood',
  'Elsweyr',
  'Black Marsh',
  'Cyrodiil',
]);
/** A province's region by its theatre (1..9), or -1. @param {number} t */
export const regionOfTheatre = (t) =>
  Number.isInteger(t) && t >= 1 && t <= PROVINCE_REGION_NAMES.length ? BAY_REGION_COUNT - 1 + t : -1;
/** The theatre a province's region is (1..9), 0 for a Bay region, -1 for none. @param {number} r */
export const theatreOfRegion = (r) =>
  !Number.isInteger(r) || r < 0
    ? -1
    : r < BAY_REGION_COUNT
      ? 0
      : r < BAY_REGION_COUNT + PROVINCE_REGION_NAMES.length
        ? r - BAY_REGION_COUNT + 1
        : -1;
/** Is region `r` a province's past the Bay? @param {number} r */
export const isProvinceRegion = (r) => theatreOfRegion(r) > 0;
/** Cyrodiil's region (WW-C: the open zone). */
export const CYRODIIL_REGION = BAY_REGION_COUNT + PROVINCE_REGION_NAMES.length - 1;

/** All region names (index = region index): the Bay's 62, then the provinces' (WW-R). */
export const REGION_NAMES = Object.freeze([
  "Alik'r Desert",
  'Dragontail Mountains',
  'Glenpoint Foothills',
  'Daggerfall Bluffs',
  'Yeorth Burrowland',
  'Dwynnen',
  'Ravennian Forest',
  'Devilrock',
  'Malekna Forest',
  'Isle of Balfiera',
  'Bantha',
  "Dak'fron",
  'Islands in the Western Iliac Bay',
  'Tamarilyn Point',
  'Lainlyn Cliffs',
  'Bjoulsae River',
  'Wrothgarian Mountains',
  'Daggerfall',
  'Glenpoint',
  'Betony',
  'Sentinel',
  'Anticlere',
  'Lainlyn',
  'Wayrest',
  'Gen Tem High Rock village',
  'Gen Rai Hammerfell village',
  'Orsinium Area',
  'Skeffington Wood',
  'Hammerfell bay coast',
  'Hammerfell sea coast',
  'High Rock bay coast',
  'High Rock sea coast',
  'Northmoor',
  'Menevia',
  'Alcaire',
  'Koegria',
  'Bhoriane',
  'Kambria',
  'Phrygias',
  'Urvaius',
  'Ykalon',
  'Daenia',
  'Shalgora',
  'Abibon-Gora',
  'Kairou',
  'Pothago',
  'Myrkwasa',
  'Ayasofya',
  'Tigonus',
  'Kozanset',
  'Satakalaam',
  'Totambu',
  'Mournoth',
  'Ephesus',
  'Santaki',
  'Antiphyllos',
  'Bergama',
  'Gavaudon',
  'Tulune',
  'Glenumbra Moors',
  'Ilessan Hills',
  'Cybiades',
  ...PROVINCE_REGION_NAMES,
]);

/** Region races from FALL.EXE (0 = Breton, 1 = Redguard). Used for townsfolk names. The value is DFU's Races less one
 *  (PlayerGPS.GetRaceOfCurrentRegion: `(Races)(race + 1)`) and, for these two, its name bank (MapsFile.GetNameBankOfRegion).
 *  WW-R: a province's people after them - Breton, Redguard, Nord, Dark Elf, High Elf, Wood Elf, Khajiit, Argonian - and
 *  Cyrodiil's Imperials stand as Bretons (Daggerfall has no Imperial body; their names are the Imperial bank's,
 *  REGION_NAME_BANKS). */
export const REGION_RACES = Object.freeze([
  1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 4, 5, 6, 7, 0,
]);
/** WW-R: each region's people's name bank (characters/nameHelper.js BANK_TYPES) - the Bay's its race's (FALL.EXE's,
 *  MapsFile.GetNameBankOfRegion's own), a province's its people's: an Argonian's the Imperial bank (NameHelper.GetNameBank:
 *  "expect Argonian names"), Cyrodiil's the Imperial. */
export const REGION_NAME_BANKS = Object.freeze([...REGION_RACES.slice(0, BAY_REGION_COUNT), 0, 1, 2, 3, 4, 5, 6, 7, 7]);
/** WW-R: each region's people, by race key (systems/races.js) - the Bay's Breton or Redguard, a province's its own. */
export const REGION_PEOPLE = Object.freeze([
  ...REGION_RACES.slice(0, BAY_REGION_COUNT).map((r) => (r === 1 ? 'Redguard' : 'Breton')),
  'Breton',
  'Redguard',
  'Nord',
  'DarkElf',
  'HighElf',
  'WoodElf',
  'Khajiit',
  'Argonian',
  'Imperial',
]);

export const CLIMATES = Object.freeze({
  Ocean: 223,
  Desert: 224,
  Desert2: 225, // seen in Dak'fron
  Mountain: 226,
  Rainforest: 227,
  Swamp: 228,
  Subtropical: 229,
  MountainWoods: 230,
  Woodlands: 231,
  HauntedWoodlands: 232, // not sure where this is?
});
