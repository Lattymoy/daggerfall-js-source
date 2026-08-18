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
//   tier (GetReactionToPlayer_0_1_2, ALL THREE TONES - T3f):
//   Personality/5 + questionTypeReactionMods[qIndex] + the tone mods
//   (etiquette/streetwise tables + the Dice100 skill roll -10/+5) vs
//   a 0..20 NPC-seeded roll; tier 1 band +20 (DFU's lowering of
//   classic's +30, doctrine-kept); reactions cache per tone per talk
//   session with a first-use skill tally.
// - THE KNOWLEDGE ROLL (GetNPCKnowledgeAboutItem, verbatim): seed =
//   NPC hash + buildingKey (the per-person seed stands in for the
//   hash, Ledger A); rollToBeat = knowledgeModifiers[qIndex*5 +
//   socialGroup] + 10 (local building qIndex 0, Commoners -> 15);
//   random_range_inclusive(1,20) <= rollToBeat KNOWS. Doesn't-know
//   answers draw the FIRST 15 table records. The DFU-only
//   short-circuits (same-building statics, spymaster,
//   NPCsKnowEverything debug) don't apply to street mobiles.

import { generateBuildingName, isNamedBuildingType, BUILDING_TYPES } from '../world/buildingNames.js';
import { randomRangeInclusive, srand } from '../formats/dfRandom.js';
import { RMB_SIDE } from '../world/locationLayout.js';

// TalkManager.knowledgeModifiers (verbatim, 8 question rows x 5
// social groups).
export const KNOWLEDGE_MODIFIERS = Object.freeze([
  5, 7, 0, 0, 4, 1, 2, -2, 3, 7, -3, 0, 7, 2, 4, 4, 3, -2, -4, -3,
  0, 3, 5, 2, 0, -4, -3, -6, -3, 4, -7, -5, 7, 0, 1, -1, 1, 6, 4, 2,
]);

// BuildingDirectory.MakeBuildingKey, verbatim (key 0 maps to the
// 1<<24 sentinel so block 0,0 record 0 stays distinct from "none").
export const BUILDING_KEY_0 = 1 << 24;
export function makeBuildingKey(layoutX, layoutY, recordIndex) {
  const key = (layoutX << 16) + (layoutY << 8) + recordIndex;
  return key === 0 ? BUILDING_KEY_0 : key;
}

/** GetNPCKnowledgeAboutItem's roll, verbatim: seeded by NPC hash +
 *  buildingKey so the SAME NPC always gives the same answer about
 *  the SAME building. questionIndex 0 = Where-is Location. */
export function npcKnowsAboutItem(npcSeed, buildingKey, socialGroup = 0, questionIndex = 0) {
  srand((((npcSeed >>> 0) + (buildingKey >>> 0)) >>> 0));
  const rollToBeat = KNOWLEDGE_MODIFIERS[questionIndex * 5 + socialGroup] + 10;
  return randomRangeInclusive(1, 20) <= rollToBeat;
}

// AUDIT 17e F20 - the Where-is category list, verbatim.
// CheckBuildingTypeInSkipList (TalkManager.cs:2919-2938) drops
// AllValid, FurnitureStore, House1-6, HouseForSale, PALACE, Ship,
// Special1-4, Town23 and Town4 - the port listed Palaces and
// Furniture stores, which classic never offers. The list is built in
// BUILDING_TYPES enum order (DFU walks the enum), and three captions
// were paraphrased rather than taken from DFU's strings.
const SKIPPED_BUILDING_TYPES = new Set([
  BUILDING_TYPES.HouseForSale, BUILDING_TYPES.Town4, BUILDING_TYPES.FurnitureStore,
  BUILDING_TYPES.Palace, BUILDING_TYPES.House1, BUILDING_TYPES.House2,
  BUILDING_TYPES.House3, BUILDING_TYPES.House4, BUILDING_TYPES.House5,
  BUILDING_TYPES.House6, BUILDING_TYPES.Town23, BUILDING_TYPES.Ship,
]);
export const isBuildingTypeSkipped = (t) => SKIPPED_BUILDING_TYPES.has(t);

const CAPTION_BY_TYPE = Object.freeze({
  [BUILDING_TYPES.Alchemist]: 'Alchemists',
  [BUILDING_TYPES.Armorer]: 'Armorers',
  [BUILDING_TYPES.Bank]: 'Banks',
  [BUILDING_TYPES.Bookseller]: 'Bookstores',
  [BUILDING_TYPES.ClothingStore]: 'Clothing stores',
  [BUILDING_TYPES.GemStore]: 'Gem stores',
  [BUILDING_TYPES.GeneralStore]: 'General stores',
  [BUILDING_TYPES.Library]: 'Libraries',
  [BUILDING_TYPES.GuildHall]: 'Guilds',
  [BUILDING_TYPES.PawnShop]: 'Pawn shops',
  [BUILDING_TYPES.WeaponSmith]: 'Weapon smiths',
  [BUILDING_TYPES.Temple]: 'Local temples',
  [BUILDING_TYPES.Tavern]: 'Taverns',
});
export const TOPIC_CATEGORIES = Object.freeze(
  Object.keys(CAPTION_BY_TYPE)
    .map(Number)
    .sort((a, b) => a - b)   // DFU walks the enum in numeric order
    .filter((t) => !isBuildingTypeSkipped(t))
    .map((t) => Object.freeze({ type: t, caption: CAPTION_BY_TYPE[t] })));

// TalkManager.answersToDirections (TalkManager.cs:107-108): 15
// doesn't-know + 15 knows, 3 reaction tiers x 5 social groups.
// AUDIT 17e F5: the KNOWS half was DFU's answersToNonDirections
// table (7261..7294) - EVERY successful Where-is answer drew the
// wrong TEXT.RSC record, and the test pinned the wrong value so it
// certified the bug. The non-directions table is kept as its own
// export for the pending Tell-me-about slice, which is what DFU
// uses it for (TalkManager.cs:109-110).
export const ANSWERS_TO_DIRECTIONS = Object.freeze([
  7251, 7266, 7281, 7250, 7265, 7280, 7252, 7267, 7282, 7253, 7268, 7283, 7304, 7269, 7284,
  7256, 7271, 7286, 7255, 7270, 7285, 7257, 7272, 7287, 7258, 7273, 7288, 7259, 7274, 7289,
]);
export const ANSWERS_TO_NON_DIRECTIONS = Object.freeze([
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
    // AUDIT 2026-08-17c: DFU scans SubRecords.Length entries, NOT the
    // full 32-slot header - garbage entries past the subrecord count
    // must never steal pool draws (they misalign every later name).
    const count = Math.min(list.length, b.dfBlock.rmbBlock.subRecords?.length ?? list.length);
    for (let i = 0; i < count; i++) {
      if (!isNamedBuildingType(list[i].buildingType)) continue;
      const item = next(list[i].buildingType);
      // AUDIT 17e F40: this comment claimed DFU "keeps block data" on
      // pool exhaustion; DFU actually copies a ZEROED pool item. The
      // branch is unreachable on classic data (the pool balances
      // exactly - 39256 draws against 39256 entries across all 15251
      // locations), and DFU only reaches it via WorldDataReplacement,
      // which this port deliberately omits. Doc-corrected, not
      // implemented - implementing it would be untestable dead code.
      if (!item) continue;
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
// Repeated block NAMES share one parsed dfBlock object (our cache;
// DFU's C# structs copy per instance) - resolve a door to its block
// INSTANCE by position, dfBlock as the tie filter.
function blockInstanceOf(blocks, d) {
  const cands = blocks.filter((b) => b.dfBlock === d.dfBlock);
  if (cands.length === 1) return cands[0];
  return cands.find((b) =>
    d.position[0] >= b.originX - 1 && d.position[0] < b.originX + RMB_SIDE + 1 &&
    d.position[2] >= b.originZ - 1 && d.position[2] < b.originZ + RMB_SIDE + 1) ?? cands[0];
}

/** E2: one exterior door -> its MERGED building data + buildingKey
 *  (the interior host's shop identity: type/quality/seed/faction). */
export function buildingDataForDoor(exteriorBuildings, blocks, door) {
  const merged = mergeNamedBuildings(exteriorBuildings, blocks);
  const inst = blockInstanceOf(blocks, door);
  const data = inst ? merged.get(inst)?.[door.recordIndex] : null;
  if (!data) return null;
  return { ...data, buildingKey: makeBuildingKey(inst.x ?? 0, inst.y ?? 0, door.recordIndex) };
}

export function buildBuildingDirectory(exteriorBuildings, blocks, doors, nameOpts) {
  const merged = mergeNamedBuildings(exteriorBuildings, blocks);
  const blockOf = (d) => blockInstanceOf(blocks, d);
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
    dirs.push({
      name, buildingType: data.buildingType, factionId: data.factionId, quality: data.quality, position: d.position,
      buildingKey: makeBuildingKey(inst.x ?? 0, inst.y ?? 0, d.recordIndex),   // the knowledge roll's per-building term
    });
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

// T3f: the tone tables (TalkManager, verbatim; sgroup >= 5 folds to
// Merchants before indexing).
export const QUESTION_TYPE_REACTION_MODS = Object.freeze([5, 0, 0, 0, 5, 0, 0, 0]);
export const ETIQUETTE_REACTION_MODS = Object.freeze([-10, 5, 10, 15, -15]);
export const STREETWISE_REACTION_MODS = Object.freeze([10, 5, -10, -15, 15]);

/** GetReactionToPlayer_0_1_2, verbatim - all three tones.
 *  toneIndex: 0 Polite (Etiquette) / 1 Normal / 2 Blunt (Streetwise).
 *  session is the per-talk-session reaction cache ([0,0,0], DFU's
 *  toneReactionForTalkSession): a tone's reaction value computes ONCE
 *  per session (skill roll included) and re-banding on a revisit uses
 *  the cached value; onTally fires with 'Etiquette'/'Streetwise' on
 *  the FIRST use of that tone this session (the cache-empty gate).
 *  The NPC-seeded 0..20 roll keeps the band stable per partner. */
export function reactionTier012({ personality, npcSeed, socialGroup = 0, questionIndex = 0, toneIndex = 1, skillValue = 0, session = null, rolls = Math.random, onTally = null }) {
  const sg = socialGroup >= 5 ? 1 : socialGroup;   // Merchants fold
  let toneModifier = 0;
  if (toneIndex === 0) {
    toneModifier += ETIQUETTE_REACTION_MODS[sg];
    if (!session || session[0] === 0) onTally?.('Etiquette');
  } else if (toneIndex === 2) {
    toneModifier += STREETWISE_REACTION_MODS[sg];
    if (!session || session[2] === 0) onTally?.('Streetwise');
  }
  if (toneIndex !== 1) toneModifier += Math.floor(rolls() * 100) >= skillValue ? -10 : 5;   // Dice100.FailedRoll
  let reaction = Math.trunc(personality / 5) + QUESTION_TYPE_REACTION_MODS[questionIndex] + toneModifier;
  srand(npcSeed >>> 0);
  const rollToBeat = randomRangeInclusive(0, 20);
  if (session && session[toneIndex] !== 0) reaction = session[toneIndex];
  else if (session) session[toneIndex] = reaction;
  if (reaction < rollToBeat) return 0;
  if (reaction < rollToBeat + 20) return 1;   // DFU's +20 (classic +30), doctrine-kept
  return 2;
}

/** The NEUTRAL-tone tier (the T3c shape, now a thin wrapper). */
export function reactionTier(personality, npcSeed) {
  return reactionTier012({ personality, npcSeed });
}

/** GetAnswerWhereIs for a mobile townsperson (Commoners): the
 *  knowledge roll picks the table half - a doesn't-know NPC draws
 *  the FIRST 15 records, a knowing one the LAST 15 (verbatim).
 *  Returns { textId, direction, tier, knows } - the caller expands
 *  the record and replaces %di/%key. */
export function whereIsAnswer(playerPos, building, personality, npcSeed, socialGroup = 0, opts = {}) {
  const tier = opts.tier ?? reactionTier(personality, npcSeed);   // T3f: the host passes the toned tier
  const knows = npcKnowsAboutItem(npcSeed, building.buildingKey ?? 0, socialGroup, 0);
  const textId = ANSWERS_TO_DIRECTIONS[(knows ? 15 : 0) + 3 * socialGroup + tier];
  const direction = compassHint(building.position[0] - playerPos[0], building.position[2] - playerPos[2]);
  return { textId, direction, tier, knows };
}
