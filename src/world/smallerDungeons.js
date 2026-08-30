// AUDIT 28 W4 - SMALLER DUNGEONS: MapsFile.UseSmallerDungeon /
// GenerateSmallerDungeon / GenerateRDBBlock / GetRandomBlock (MIT,
// Daggerfall Workshop, MapsFile.cs:766-797, :1366-1444) and the quest
// state that pins a dungeon's size for the life of its quest
// (Quest.cs:284, QuestSmallerDungeonsState). Experimental/SmallerDungeons
// ships False and the port had only the save field, at NotSet.
//
// The law: a dungeon with more than FIVE blocks is regenerated as a
// plus-shape of five - a random interior block in the centre (the
// starting block) and four random border blocks around it - drawn from
// ITS OWN block list with DFRandom seeded on the raw MapId, so the
// small dungeon is the same small dungeon every visit. Main-story
// dungeons never shrink. A dungeon a live quest points at keeps the
// size the quest COMPILED with, whatever the setting says now, because
// marker assignments are not relocated when the setting flips
// (:786-787).
//
// One shape departure, deliberate: DFU regenerates inside
// MapsFile.GetLocation on a struct copy; the port's locations are
// CACHED OBJECTS shared with the exterior layout, so this module never
// mutates - it answers a shallow-cloned location with its own dungeon
// and block array, and the caller hands THAT to the dungeon context.

import { setSeed, randomRange } from '../formats/dfRandom.js';
import { getBool } from '../systems/settings.js';
import { SITE_TYPES } from '../systems/quest/place.js';
import { isMainStoryDungeon } from './dungeonTextures.js';

/** QuestSmallerDungeonsState (DaggerfallUnityEnums.cs). */
export const SMALLER_DUNGEONS_STATE = Object.freeze({ NotSet: 0, Enabled: 1, Disabled: 2 });

/** GenerateSmallerDungeon's threshold (:1369): five blocks or fewer
 *  is already small. */
export const SMALLER_DUNGEON_THRESHOLD = 5;

/** Quest.Start's stamp (Quest.cs:284): the setting AS OF the quest's
 *  start, frozen into the quest. */
export function smallerDungeonsStateNow(enabled = getBool('Experimental', 'SmallerDungeons')) {
  return enabled ? SMALLER_DUNGEONS_STATE.Enabled : SMALLER_DUNGEONS_STATE.Disabled;
}

/**
 * UseSmallerDungeon (:776-797). `questMachine` is the bridge's machine
 * (null when no quest layer is mounted - the dev hosts); a SiteLink on
 * this dungeon defers to ITS quest's frozen state, first link wins.
 */
export function useSmallerDungeon(dfLocation, { questMachine = null,
  setting = getBool('Experimental', 'SmallerDungeons') } = {}) {
  if (!dfLocation?.hasDungeon || isMainStoryDungeon(dfLocation.mapTableData?.mapId)) return false;
  const links = questMachine?.getSiteLinks(SITE_TYPES.Dungeon, dfLocation.mapTableData?.mapId) ?? [];
  if (links.length > 0) {
    const quest = questMachine.getQuest(links[0].questUID);
    if (quest && quest.smallerDungeonsState === SMALLER_DUNGEONS_STATE.Enabled) return true;
    if (quest && quest.smallerDungeonsState === SMALLER_DUNGEONS_STATE.Disabled) return false;
  }
  return setting;
}

/** GetRandomBlock (:1420-1443): border blocks are the ones whose name
 *  starts with "B" (case-insensitive); an empty pool throws, verbatim. */
function getRandomBlock(borderBlock, dfLocation) {
  const filtered = dfLocation.dungeon.blocks.filter((b) => {
    const isBorder = /^b/i.test(b.blockName);
    return borderBlock ? isBorder : !isBorder;
  });
  if (filtered.length === 0) {
    throw new Error(`GetRandomBlock() failed to find a suitable block. borderBlock=${borderBlock}, location=${dfLocation.name}`);
  }
  return filtered[randomRange(0, filtered.length)];
}

/** GenerateRDBBlock (:1410-1418): a random block re-addressed. */
function generateRdbBlock(x, z, borderBlock, startingBlock, dfLocation) {
  return { ...getRandomBlock(borderBlock, dfLocation), x, z, isStartingBlock: startingBlock };
}

/**
 * GenerateSmallerDungeon (:1366-1400), NON-MUTATING: answers a clone of
 * the location whose dungeon is the five-block plus, or the location
 * itself when it is already small. Throws on a main-story dungeon,
 * verbatim (:1372-1373).
 */
export function generateSmallerDungeon(dfLocation) {
  if (isMainStoryDungeon(dfLocation.mapTableData?.mapId)) {
    throw new Error('GenerateSmallerDungeon() must not be called on a main story dungeon.');
  }
  const blocks = dfLocation.dungeon?.blocks;
  if (!blocks || blocks.length <= SMALLER_DUNGEON_THRESHOLD) return dfLocation;
  // DFRandom.Seed = (uint)MapId (:1389) - the same plus every visit.
  setSeed(dfLocation.mapTableData.mapId);
  const layout = [
    generateRdbBlock(0, 0, false, true, dfLocation),    // Central starting block
    generateRdbBlock(0, -1, true, false, dfLocation),   // North border block
    generateRdbBlock(-1, 0, true, false, dfLocation),   // West border block
    generateRdbBlock(1, 0, true, false, dfLocation),    // East border block
    generateRdbBlock(0, 1, true, false, dfLocation),    // South border block
  ];
  return { ...dfLocation, dungeon: { ...dfLocation.dungeon, blocks: layout } };
}

/** The one door the hosts use: the location to BUILD, sized by the law. */
export function dungeonLocationFor(dfLocation, deps = {}) {
  return useSmallerDungeon(dfLocation, deps) ? generateSmallerDungeon(dfLocation) : dfLocation;
}
