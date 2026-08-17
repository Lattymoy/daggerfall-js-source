// T3c: the Where-is topics (DFU TalkManager + RMBLayout.
// GetCompleteBuildingData, MIT Daggerfall Workshop).
//
// - THE NAMED-BUILDING POOL (verbatim): the location's exterior
//   building list is a pool; scanning blocks y->x and subrecords in
//   order, each NAMED-type block building draws the first unused pool
//   entry OF ITS TYPE and takes its nameSeed/factionId/quality (the
//   block's own values are placeholders). Names then ride
//   generateBuildingName(seed).
// - THE COMPASS HINT (DirectionVector2DirectionHintString, verbatim):
//   the 8-way angle bands over (east, north) = our (dx, dz).
// - THE ANSWER (GetAnswerWhereIs): the 30-record answersToDirections
//   table - 15 "doesn't know" + 15 "knows" by socialGroup x the
//   0/1/2 reaction tier; mobile townsfolk are Commoners (0). The
//   tier (GetReactionToPlayer_0_1_2, NEUTRAL tone - the tone buttons
//   pend): Personality/5 + questionTypeReactionMods[0]=5 vs a
//   0..20 roll; tier 1 band +20 (DFU's lowering of classic's +30,
//   doctrine-kept). FLAGGED LOUD: the NPC knowledge roll
//   (GetNPCKnowledgeAboutItem) pends - every NPC currently KNOWS,
//   so the doesn't-know half of the table is wired but unreached.

import { generateBuildingName, isNamedBuildingType, BUILDING_TYPES } from '../world/buildingNames.js';
import { randomRangeInclusive, srand } from '../formats/dfRandom.js';
import { RMB_SIDE } from '../world/locationLayout.js';

// The classic category captions by building type (the talk window's
// Location list).
export const TOPIC_CATEGORIES = Object.freeze([
  { type: BUILDING_TYPES.Alchemist, caption: 'Alchemists' },
  { type: BUILDING_TYPES.Armorer, caption: 'Armor smiths' },
  { type: BUILDING_TYPES.Bank, caption: 'Banks' },
  { type: BUILDING_TYPES.Bookseller, caption: 'Book stores' },
  { type: BUILDING_TYPES.ClothingStore, caption: 'Clothing stores' },
  { type: BUILDING_TYPES.FurnitureStore, caption: 'Furniture stores' },
  { type: BUILDING_TYPES.GemStore, caption: 'Gem stores' },
  { type: BUILDING_TYPES.GeneralStore, caption: 'General stores' },
  { type: BUILDING_TYPES.GuildHall, caption: 'Guilds' },
  { type: BUILDING_TYPES.Library, caption: 'Libraries' },
  { type: BUILDING_TYPES.PawnShop, caption: 'Pawn shops' },
  { type: BUILDING_TYPES.Temple, caption: 'Temples' },
  { type: BUILDING_TYPES.Tavern, caption: 'Taverns' },
  { type: BUILDING_TYPES.WeaponSmith, caption: 'Weapon smiths' },
  { type: BUILDING_TYPES.Palace, caption: 'Palaces' },
]);

// TalkManager.answersToDirections: 15 doesn't-know + 15 knows,
// 3 reaction tiers x 5 social groups.
export const ANSWERS_TO_DIRECTIONS = Object.freeze([
  7251, 7266, 7281, 7250, 7265, 7280, 7252, 7267, 7282, 7253, 7268, 7283, 7304, 7269, 7284,
  7261, 7276, 7291, 7260, 7275, 7290, 7262, 7277, 7292, 7263, 7278, 7293, 7264, 7279, 7294,
]);

/** GetCompleteBuildingData's pool merge over OUR layout shapes.
 *  @param exteriorBuildings dfLocation.exterior.buildings
 *  @param blocks layoutLocation().blocks (y->x order preserved)
 *  @returns per-block arrays of merged buildingDataList copies */
export function mergeNamedBuildings(exteriorBuildings, blocks) {
  const pool = exteriorBuildings
    .filter((b) => isNamedBuildingType(b.buildingType))
    .map((b) => ({ data: b, used: false }));
  const next = (type) => {
    for (const it of pool) {
      if (!it.used && it.data.buildingType === type) { it.used = true; return it.data; }
    }
    return null;
  };
  const out = new Map();   // block -> merged buildingDataList copy
  for (const b of blocks) {
    const list = b.dfBlock.rmbBlock.fldHeader.buildingDataList.map((d) => ({ ...d }));
    for (let i = 0; i < list.length; i++) {
      if (!isNamedBuildingType(list[i].buildingType)) continue;
      const item = next(list[i].buildingType);
      if (!item) continue;   // end of the city list (DFU logs and keeps block data)
      list[i].nameSeed = item.nameSeed;
      list[i].factionId = item.factionId;
      list[i].sector = item.sector;
      list[i].locationId = item.locationId;
      list[i].quality = item.quality;
    }
    out.set(b, list);
  }
  return out;
}

/** Build the location's named-building directory.
 *  @param doors [{ dfBlock, recordIndex, position: [x,y,z] }] - one
 *         entry per building exterior door (position = the door)
 *  @param nameOpts generateBuildingName opts (location/region/bank/
 *         ruler/faction resolvers) */
export function buildBuildingDirectory(exteriorBuildings, blocks, doors, nameOpts) {
  const merged = mergeNamedBuildings(exteriorBuildings, blocks);
  // Repeated block NAMES share one parsed dfBlock object (our cache;
  // DFU's C# structs copy per instance) - resolve each door to its
  // block INSTANCE by position, dfBlock as the tie filter.
  const blockOf = (d) => {
    const cands = blocks.filter((b) => b.dfBlock === d.dfBlock);
    if (cands.length === 1) return cands[0];
    return cands.find((b) =>
      d.position[0] >= b.originX - 1 && d.position[0] < b.originX + RMB_SIDE + 1 &&
      d.position[2] >= b.originZ - 1 && d.position[2] < b.originZ + RMB_SIDE + 1) ?? cands[0];
  };
  const blockIdx = new Map(blocks.map((b, i) => [b, i]));
  const dirs = [];
  const seen = new Set();
  for (const d of doors) {
    const inst = blockOf(d);
    const list = inst ? merged.get(inst) : null;
    if (!list) continue;
    const data = list[d.recordIndex];
    if (!data || !isNamedBuildingType(data.buildingType)) continue;
    const key = `${blockIdx.get(inst)}_${d.recordIndex}`;
    if (seen.has(key)) continue;   // one entry per building (multi-door)
    seen.add(key);
    const name = generateBuildingName(data.nameSeed, data.buildingType, { ...nameOpts, factionId: data.factionId });
    if (!name) continue;
    dirs.push({ name, buildingType: data.buildingType, factionId: data.factionId, quality: data.quality, position: d.position });
  }
  return dirs;
}

/** DirectionVector2DirectionHintString, verbatim over (east, north). */
export function compassHint(dx, dz) {
  const mag = Math.hypot(dx, dz) || 1e-9;
  let angle = Math.acos(dx / mag) / Math.PI * 180;
  if (dz < 0) angle = 180 + (180 - angle);
  if ((angle >= 0 && angle < 22.5) || (angle >= 337.5 && angle <= 360)) return 'east';
  if (angle < 67.5) return 'northeast';
  if (angle < 112.5) return 'north';
  if (angle < 157.5) return 'northwest';
  if (angle < 202.5) return 'west';
  if (angle < 247.5) return 'southwest';
  if (angle < 292.5) return 'south';
  if (angle < 337.5) return 'southeast';
  return 'east';
}

/** GetReactionToPlayer_0_1_2 at the NEUTRAL tone (the tone buttons
 *  pend): no skill roll, no tone mods; the NPC-stable seed keeps the
 *  roll fixed per conversation partner. */
export function reactionTier(personality, npcSeed) {
  const reaction = Math.trunc(personality / 5) + 5;   // questionTypeReactionMods[WhereIsLocation]
  srand(npcSeed >>> 0);
  const rollToBeat = randomRangeInclusive(0, 20);
  if (reaction < rollToBeat) return 0;
  if (reaction < rollToBeat + 20) return 1;
  return 2;
}

/** GetAnswerWhereIs for a mobile townsperson (Commoners), knows-
 *  always (the knowledge roll FLAGGED). Returns { textId, direction }
 *  - the caller expands the record and replaces %di. */
export function whereIsAnswer(playerPos, building, personality, npcSeed, socialGroup = 0) {
  const tier = reactionTier(personality, npcSeed);
  const textId = ANSWERS_TO_DIRECTIONS[15 + 3 * socialGroup + tier];
  const direction = compassHint(building.position[0] - playerPos[0], building.position[2] - playerPos[2]);
  return { textId, direction, tier };
}
