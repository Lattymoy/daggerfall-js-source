// RR3 - THE MASTER ARMORER QUEST LINE: what RoleplayRealism.cs registers
// for it (:41-53 the two quest tables, :241-256 the list, the factions
// and the merchant service, :259-297 the two PlayerGPS subscribers,
// :300-311 the building key, :414-484 the custom armor service,
// :659-706 the three factions) - Hazelnut, MIT. The quests themselves
// (RRMSTARM0-2 and QuestList-RoleplayRealism.txt) are vendored verbatim
// under vendor/roleplay-realism/Quests/ and ride the quest pack's own
// globs; the fort (locationnew-RRfort01-16, RRFORT01.RMB) and the
// armorer's shop variant (ARMRAM03.RMB-765-building14_master) are the
// world-data half, RR3b.
import { DIRECTION_HINTS } from './talk.js';
import { ARMOR_MATERIAL } from './armorMaterials.js';
import { groupTemplates, setItemFields, mintCondition } from './itemTemplates.js';
import { customItemsForGroup } from './rriItems.js';

/** RoleplayRealismModData.csv - the quest line's own lines. */
export const RR_TEXT = Object.freeze({
  fortVerynear1: 'You see many heavy bootprints in the mud and even spot a discarded shield.',
  fortVerynear2: 'These are definite tracks from of a band of warriors somewhere nearby.',
  fortNear: 'You spot signs of recent activity in the area that seem to lead to the {0}.',
  customArmor: 'Custom Armor',
  dharjenCustomArmor: 'Dharjen Custom Armor',
  notEnoughMaterials: 'Sorry I have not yet sourced enough rare materials to make you armor.',
  lordVerathonName: 'Lord Verathon',
  captainUlthegaName: 'Captain Ulthega',
  orthusDharjenName: 'Orthus Dharjen',
});

// ---- the quest tables (:41-53) -----------------------------------------------
/** placesTable: the rows added into Quests-Places (p1 the location id,
 *  p2 1, p3 -1 - a permanent site). */
export const RR_PLACES_TABLE = Object.freeze([
  'Aldleigh,              0x3181, 1, -1',
  'Northrock_Fort_Ext,    0x73A0, 1, -1',
  'Northrock_Fort,        0x73A1, 1, -1',
]);
/** factionsTable: the rows added into Quests-Factions (p3 the individual's id). */
export const RR_FACTIONS_TABLE = Object.freeze([
  'Lord_Verathon,         0, -1, 1020',
  'Captain_Ulthega,       0, -1, 1021',
  'Orthus_Dharjen,        0, -1, 1022',
]);
export const RR_QUEST_LIST = 'RoleplayRealism';   // RegisterQuestList("RoleplayRealism") (:241)

// ---- the three factions (RegisterFactionIds, :659-706) -----------------------------
export const RR_FACTION_IDS = Object.freeze({ LordVerathon: 1020, CaptainUlthega: 1021, OrthusDharjen: 1022 });
export const RR_CUSTOM_FACTIONS = Object.freeze([
  Object.freeze({ id: 1020, parent: 0, type: 4, name: RR_TEXT.lordVerathonName, summon: -1, region: 16, power: 10, face: 12, race: 2, flat1: (183 << 7) + 20, sgroup: 3, ggroup: 0, children: [1021] }),
  Object.freeze({ id: 1021, parent: 1020, type: 4, name: RR_TEXT.captainUlthegaName, summon: -1, region: 16, power: 2, face: 57, race: 2, flat1: (180 << 7) + 2, sgroup: 4, ggroup: 0, children: null }),
  Object.freeze({ id: 1022, parent: 0, type: 4, name: RR_TEXT.orthusDharjenName, summon: -1, region: 17, power: 2, face: 380, race: 2, flat1: (334 << 7) + 14, sgroup: 1, ggroup: 0, children: null }),
]);

// ---- PlayerGPS_OnMapPixelChanged (:270-297) -------------------------------------
/** The fort's pixel and its eight neighbours: at 938,51 the two "very
 *  near" lines; on a neighbour, "near" with the direction the fort lies
 *  in (TextManager's own compass words). Anywhere else, nothing. */
export const RR_FORT_PIXEL = Object.freeze({ x: 938, y: 51 });
const FORT_NEAR_DIRECTION = Object.freeze({
  '938,50': 'south', '939,50': 'southwest', '939,51': 'west', '939,52': 'northwest',
  '938,52': 'north', '937,52': 'northeast', '937,51': 'east', '937,50': 'southeast',
});
export function rrFortProximityLines(mapPixelX, mapPixelY) {
  if (!(mapPixelX >= 937 && mapPixelX <= 939 && mapPixelY >= 50 && mapPixelY <= 52)) return [];
  if (mapPixelX === 938 && mapPixelY === 51) return [RR_TEXT.fortVerynear1, RR_TEXT.fortVerynear2];
  const dir = FORT_NEAR_DIRECTION[`${mapPixelX},${mapPixelY}`];
  return dir ? [RR_TEXT.fortNear.replace('{0}', DIRECTION_HINTS[dir])] : [];
}

// ---- PlayerGPS_OnEnterLocationRect (:259-267) + GetMasterArmBuildingKey (:300-311) ------
/** The master armorer's shop key by region: Pjiga (52), Penmore (18),
 *  Paponirea (48); anywhere else 0. */
export function rrMasterArmBuildingKey(regionIndex) {
  switch (regionIndex) {
    case 52: return 131342;
    case 18: return 197134;
    case 48: return 131598;
    default: return 0;
  }
}
export const RR_ARMORER_BLOCK = 'ARMRAM03.RMB';
export const RR_ARMORER_RECORD = 14;
/** Entering a location whose ARMRAM03 building 14 carries a variant:
 *  DiscoverBuilding(key, "Dharjen Custom Armor"). `variantOf(regionIndex,
 *  locationIndex, blockName, recordIndex)` is WorldDataVariants.GetBuildingVariant.
 *  Answers { buildingKey, name } or null. */
export function rrMasterArmorerDiscovery(location, variantOf) {
  if (!location) return null;
  if (variantOf(location.regionIndex, location.locationIndex, RR_ARMORER_BLOCK, RR_ARMORER_RECORD) == null) return null;
  return { buildingKey: rrMasterArmBuildingKey(location.regionIndex), name: RR_TEXT.dharjenCustomArmor };
}

// ---- CustomArmorService (:414-484) ------------------------------------------
/** customArmorMaterials, in order. */
export const RR_CUSTOM_ARMOR_MATERIALS = Object.freeze([
  ARMOR_MATERIAL.Mithril, ARMOR_MATERIAL.Adamantium, ARMOR_MATERIAL.Ebony, ARMOR_MATERIAL.Orcish, ARMOR_MATERIAL.Daedric,
]);
/** The service's level gate (:424-428): under 9, the apology and no shelf. */
export const rrCustomArmorOffered = (level) => level >= 9;
/** The material ladder (:431-437): the foreach BREAKS at the first
 *  material the level cannot have - Adamantium+ under 12, Orcish+ under
 *  15, Daedric under 18. */
export function rrCustomArmorMaterials(level) {
  const out = [];
  for (const material of RR_CUSTOM_ARMOR_MATERIALS) {
    if (level < 9
      || (level < 12 && material >= ARMOR_MATERIAL.Adamantium)
      || (level < 15 && material >= ARMOR_MATERIAL.Orcish)
      || (level < 18 && material >= ARMOR_MATERIAL.Daedric)) break;
    out.push(material);
  }
  return out;
}
/** The variant span per armor type (:443-467): cuirass and pauldrons 1-3,
 *  greaves 2-5, gauntlets 1, boots and helm 1..variants-1; a shield
 *  (`default: continue`) is null. `templateIndex` is the Armor enum value. */
export function rrCustomArmorVariants(templateIndex, templateVariants) {
  switch (templateIndex) {
    case 102: case 105: case 106: return [1, 3];   // Cuirass, Left_Pauldron, Right_Pauldron
    case 104: return [2, 5];                        // Greaves
    case 103: return [1, 1];                        // Gauntlets
    case 108: case 107: return [1, templateVariants - 1];   // Boots, Helm
    default: return null;
  }
}
/** The shelf (:430-479): for each material the level allows, every
 *  armor type's variants in its span (CreateArmor - the port's mint with
 *  the variant), then every registered custom armor class at that
 *  material (CreateItem + ApplyArmorSettings - the class's own variant
 *  setter runs in the mint). `mint(fields)` is the test seam. */
export function rrCustomArmorStock(level, { mint = (fields) => mintCondition(setItemFields(fields)), armorTemplates = groupTemplates('Armor'), customTemplates = customItemsForGroup('Armor') } = {}) {
  const items = [];
  for (const material of rrCustomArmorMaterials(level)) {
    for (const t of armorTemplates) {
      const span = rrCustomArmorVariants(t.index, t.variants ?? 0);
      if (!span) continue;
      for (let v = span[0]; v <= span[1]; v++) items.push(mint({ group: 'Armor', templateIndex: t.index, material, variant: v }));
    }
    for (const templateIndex of customTemplates) items.push(mint({ group: 'Armor', templateIndex, material }));
  }
  return items;
}
/** CustomArmorService(window) (:419-484): the level gate's box, else the
 *  Buy trade window over the shelf. `window` is the popup's door -
 *  { messageBox(text), openBuy(items) }; `entity` the player. */
export function rrCustomArmorService(window, entity) {
  const level = entity?.level ?? 1;
  if (!rrCustomArmorOffered(level)) { window.messageBox?.(RR_TEXT.notEnoughMaterials); return false; }
  window.openBuy?.(rrCustomArmorStock(level));
  return true;
}
