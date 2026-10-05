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
import { isArenaUndercroft } from './arenaCity.js';   // ARENA5: the fighters' hall keeps its blocks
import { isEnhanced } from '../systems/uiSkin.js';   // DSIZE1: the medium size is the enhanced skin's
import { getPref } from '../systems/uiPrefs.js';   // DSIZE1: ...and the player's ask (the `medium-dungeons` row)

/** QuestSmallerDungeonsState (DaggerfallUnityEnums.cs:758-763) -
 *  NotSet, DISABLED, ENABLED, in that order. F-B3 (self-audit 2): the
 *  first cut shipped Enabled=1/Disabled=2, internally consistent and
 *  numerically backwards from DFU; the values are the save format. */
export const SMALLER_DUNGEONS_STATE = Object.freeze({ NotSet: 0, Disabled: 1, Enabled: 2 });

/** GenerateSmallerDungeon's threshold (:1369): five blocks or fewer
 *  is already small. */
export const SMALLER_DUNGEON_THRESHOLD = 5;

/**
 * DSIZE1 (the delve arc, 2026-10-05 - Features-Arc.md's open door on Smaller Dungeons: "a size tier ... would earn the
 * Enhanced label"): THE MEDIUM SIZE. Smaller Dungeons is DFU's all-or-nothing: a dungeon of thirty blocks becomes five.
 * Medium is the step between - a dungeon of more than MEDIUM_DUNGEON_THRESHOLD blocks is regenerated, by
 * GenerateSmallerDungeon's own law (its own block list, DFRandom seeded on its MapId, so the same every visit), as a
 * cross of five interior blocks (the starting block in the middle) ringed by the eight border blocks that close it.
 * Every quest guard Smaller Dungeons keeps, Medium keeps: main story, the arena's undercroft, online and a quest's frozen
 * size. Smaller Dungeons, when it is on, wins. Not a DFU member.
 *
 * The quest freeze and the save stamp carry it as MEDIUM_DUNGEONS_STATE - a value APPENDED past DFU's three
 * (QuestSmallerDungeonsState is NotSet/Disabled/Enabled, verbatim above and untouched): a build that does not know it
 * reads it as neither, and falls back to the setting, which is what an unknown value was always going to mean.
 */
export const MEDIUM_DUNGEON_THRESHOLD = 13;
export const MEDIUM_DUNGEONS_STATE = 3;
/** The prefs key (the `medium-dungeons` Features row). */
export const MEDIUM_DUNGEONS_PREF = 'mediumDungeons';
/** The player's ask, on the enhanced skin. */
export const mediumDungeonsWanted = () => isEnhanced() && getPref(MEDIUM_DUNGEONS_PREF) === true;
/** The cross and its ring: [x, z, border] - the middle first (the starting block), then the four interior arms, then
 *  the eight border blocks round them (N, the two inner corners above, W, E, the two below, S). */
export const MEDIUM_LAYOUT = Object.freeze([
  [0, 0, false], [0, -1, false], [-1, 0, false], [1, 0, false], [0, 1, false],
  [0, -2, true], [-1, -1, true], [1, -1, true], [-2, 0, true], [2, 0, true], [-1, 1, true], [1, 1, true], [0, 2, true],
].map((r) => Object.freeze(r)));

/** Quest.Start's stamp (Quest.cs:284): the setting AS OF the quest's
 *  start, frozen into the quest. DSIZE1: and the medium size, when it is asked for and Smaller Dungeons is not on. */
export function smallerDungeonsStateNow(enabled = getBool('Experimental', 'SmallerDungeons'), medium = mediumDungeonsWanted()) {
  if (enabled) return SMALLER_DUNGEONS_STATE.Enabled;
  return medium ? MEDIUM_DUNGEONS_STATE : SMALLER_DUNGEONS_STATE.Disabled;
}

/**
 * UseSmallerDungeon (:776-797). `questMachine` is the bridge's machine
 * (null when no quest layer is mounted - the dev hosts); a SiteLink on
 * this dungeon defers to ITS quest's frozen state, first link wins.
 */
export function useSmallerDungeon(dfLocation, { questMachine = null,
  setting = getBool('Experimental', 'SmallerDungeons'), online = false } = {}) {
  return dungeonSizeFor(dfLocation, { questMachine, setting, medium: false, online }) === 'small';
}

/**
 * DSIZE1: THE SIZE A DUNGEON IS BUILT AT - 'small', 'medium' or 'full' - by UseSmallerDungeon's law (:776-797), whole,
 * with the medium size beside it: the same guards (no dungeon, main story, the arena's undercroft, online: full), a
 * quest's frozen state first (Enabled small, MEDIUM_DUNGEONS_STATE medium, Disabled full - first link wins), and then
 * the setting (small), else the medium ask, else full.
 */
export function dungeonSizeFor(dfLocation, { questMachine = null,
  setting = getBool('Experimental', 'SmallerDungeons'), medium = mediumDungeonsWanted(), online = false } = {}) {
  if (!dfLocation?.hasDungeon || isMainStoryDungeon(dfLocation.mapTableData?.mapId)) return 'full';
  // ARENA5 (the audit, closing ARENA1's open item "Smaller Dungeons may trim the undercroft"): THE ARENA'S UNDERCROFT
  // NEVER SHRINKS. It is no keep of Daggerfall's but the fighters' hall (world/arenaUndercroft.js): its people, the Pit
  // Master's ring and the Keeper's Hall stand by their distance out from the stair over Kamer's 32 blocks, and a five-
  // block plus of random ones drawn from his list would stand the pit in a cellar and the Hall nowhere. Main story's rule.
  if (isArenaUndercroft(dfLocation)) return 'full';
  // AUDIT WORLD34 B2: ONLINE, THE WHOLE DUNGEON. The room's stream, its acts and its memory address foes, doors and
  // piles by their index in the layout, and the layout was a per-client SETTING (or a quest's frozen copy of one):
  // a five-block client and a full-dungeon client shared one `_locationKey`, accepted each other's frames, and
  // landed them on the wrong markers. Online there is one layout, the dungeon as MAPS.BSA has it.
  if (online) return 'full';
  const links = questMachine?.getSiteLinks(SITE_TYPES.Dungeon, dfLocation.mapTableData?.mapId) ?? [];
  if (links.length > 0) {
    const quest = questMachine.getQuest(links[0].questUID);
    if (quest && quest.smallerDungeonsState === SMALLER_DUNGEONS_STATE.Enabled) return 'small';
    if (quest && quest.smallerDungeonsState === MEDIUM_DUNGEONS_STATE) return 'medium';   // DSIZE1
    if (quest && quest.smallerDungeonsState === SMALLER_DUNGEONS_STATE.Disabled) return 'full';
  }
  return setting ? 'small' : medium ? 'medium' : 'full';
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
  // FT1: the clone SAYS it is small, so the save stamp below can read
  // the build rather than re-deriving it from deps it no longer has.
  return { ...dfLocation, dungeon: { ...dfLocation.dungeon, blocks: layout, smaller: true } };
}

/** Was this location BUILT small - a clone generateSmallerDungeon
 *  answered? False for the source location, for a dungeon already at or
 *  under the threshold, and for anything else. */
export function isSmallerDungeon(dfLocation) {
  return dfLocation?.dungeon?.smaller === true;
}

/**
 * DSIZE1: GenerateSmallerDungeon's law at the medium size, NON-MUTATING - a clone whose dungeon is MEDIUM_LAYOUT drawn
 * from the location's own block list (interior blocks for the cross, border blocks for its ring; GetRandomBlock's pool
 * and its empty-pool throw), DFRandom seeded on the MapId, or the location itself when it is at or under the
 * threshold. Throws on a main-story dungeon, as the small one does.
 */
export function generateMediumDungeon(dfLocation) {
  if (isMainStoryDungeon(dfLocation.mapTableData?.mapId)) {
    throw new Error('generateMediumDungeon() must not be called on a main story dungeon.');
  }
  const blocks = dfLocation.dungeon?.blocks;
  if (!blocks || blocks.length <= MEDIUM_DUNGEON_THRESHOLD) return dfLocation;
  setSeed(dfLocation.mapTableData.mapId);
  const layout = MEDIUM_LAYOUT.map(([x, z, border], i) => generateRdbBlock(x, z, border, i === 0, dfLocation));
  return { ...dfLocation, dungeon: { ...dfLocation.dungeon, blocks: layout, medium: true } };
}

/** DSIZE1: was this location BUILT at the medium size? */
export function isMediumDungeon(dfLocation) {
  return dfLocation?.dungeon?.medium === true;
}

/**
 * The save stamp - PlayerPositionData_v1.smallerDungeonsState
 * (SerializablePlayer.cs:224). DEPARTURE (recorded, Ledger A: THE
 * SMALLER-DUNGEON SAVE STAMP IS THE BUILD): DFU stamps the RAW SETTING
 * as of the save; the port stamps the size ACTUALLY BUILT. They agree
 * wherever DFU can reach - but online the dungeon is always full
 * (AUDIT WORLD34 B2, above) whatever the setting says, and under a
 * quest's frozen state the build and the setting differ too, so a save
 * made online with the setting on and loaded offline stood the player
 * in a block the five-block dungeon does not have, and never warped
 * because the SETTING had not changed. The warp asks about the build;
 * the stamp answers about the build.
 */
export function smallerDungeonsStamp(dfLocation) {
  if (isMediumDungeon(dfLocation)) return MEDIUM_DUNGEONS_STATE;   // DSIZE1: the build, at its own value
  return isSmallerDungeon(dfLocation) ? SMALLER_DUNGEONS_STATE.Enabled : SMALLER_DUNGEONS_STATE.Disabled;
}

/**
 * The load-time warp (SerializablePlayer.cs:462-472): the position was
 * saved in the OTHER layout, so it may sit in blocks this build does
 * not have - warp to the start marker. Never on an old envelope (no
 * field, NotSet), never in a main-story dungeon (:466-468, they never
 * use the setting), never when the layouts agree.
 */
export function needsStartWarp(savedState, dfLocation) {
  if (!savedState) return false;
  if (isMainStoryDungeon(dfLocation?.mapTableData?.mapId)) return false;
  // DSIZE1: three layouts, so the stamp is compared whole - a save made at one size and loaded at another of the three
  // (or at a value this build does not know) stands at the start; the two DFU values compare as they always did
  return savedState !== smallerDungeonsStamp(dfLocation);
}

/** The one door the hosts use: the location to BUILD, sized by the law. DSIZE1: at any of the three sizes. */
export function dungeonLocationFor(dfLocation, deps = {}) {
  const size = dungeonSizeFor(dfLocation, deps);
  if (size === 'small') return generateSmallerDungeon(dfLocation);
  return size === 'medium' ? generateMediumDungeon(dfLocation) : dfLocation;
}
