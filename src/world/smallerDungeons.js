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
import { isOnlinePage } from '../systems/onlineLane.js';   // AUDIT DELVE E4 / SD-ONLINE: online the quest's stamp is the world's sizes
import { seededFirst } from '../systems/wind.js';   // SD-ONLINE: the port's one seeded die - a dungeon's online size, the same on every client
import { dungeonTier } from '../systems/dungeonTier.js';   // AUDIT SD: a Hollow, by the one tier law

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
 * Enhanced label"): THE MEDIUM SIZE. Smaller Dungeons is DFU's all-or-nothing: a dungeon of twelve blocks becomes five.
 * Medium is the step between - a dungeon of more than MEDIUM_DUNGEON_THRESHOLD blocks is regenerated, by
 * GenerateSmallerDungeon's own law (its own block list, DFRandom seeded on its MapId, so the same every visit), as
 * MEDIUM_LAYOUT: two interior blocks side by side (the starting block first; two different ones where its pool holds two -
 * MEDIUM-DISTINCT, distinctInterior) and the six border blocks that close them.
 * Every quest guard Smaller Dungeons keeps, Medium keeps: main story, the arena's undercroft and a quest's frozen size.
 * Smaller Dungeons, when it is on, wins. Not a DFU member.
 *
 * SD-ONLINE (2026-10-05, Mac: "So medium dungeons will be the new by default option thats on (online only)", then "On
 * second thought. Large, medium and small should all play into account online" - and, asked which, "World mixes
 * sizes"; bible/11-Multiplayer/Super-Dungeons.md section 13): ONLINE EVERY DUNGEON HAS ITS OWN SIZE, THE WORLD'S. Not
 * the player's settings, which are each player's own while every peer in a dungeon's room must lay one layout (AUDIT
 * WORLD34 B2, which made it the whole dungeon): online each dungeon the guards let through is built at the size one
 * seeded draw on its map id gives it - small, medium or large, half of them medium (ONLINE_DUNGEON_SIZES,
 * onlineDungeonSize) - the same on every client and every visit, whatever either switch says. A dungeon's room is its
 * layout's (net/online.js roomKeyFor: `dungeon:m<id>.s`, `dungeon:m<id>.m`, or the plain room for the whole dungeon).
 * The quest freeze carries it as ONLINE_DUNGEONS_STATE, so a quest started online builds its dungeons at their online
 * sizes offline too; and offline the `world-dungeon-sizes` row asks for the world's sizes outright.
 *
 * AUDIT DELVE (MAPS.BSA, read whole - bible/01-Overview/Audit-Delve.md): the first cut was a cross of five interior
 * blocks and its eight-block ring over THIRTEEN, and the real data had it backwards. Of the 4,232 dungeons, 159 have
 * more than thirteen blocks, and every one of them is four interior blocks in a ring of ten: the cross made them
 * BIGGER inside (five interior draws from a pool of four) and touched nothing else. The real sizes are 5 (775), 8
 * (1,162), 10-13 (2,127) and 14-22 (167); eight blocks - two interior side by side, six border round them - is the
 * commonest shape a dungeon has, so it is the medium size, and every dungeon of ten blocks or more comes down to it.
 *
 * The quest freeze and the save stamp carry it as MEDIUM_DUNGEONS_STATE - a value APPENDED past DFU's three
 * (QuestSmallerDungeonsState is NotSet/Disabled/Enabled, verbatim above and untouched): a build that does not know it
 * reads it as neither, and falls back to the setting, which is what an unknown value was always going to mean.
 */
export const MEDIUM_DUNGEON_THRESHOLD = 8;
export const MEDIUM_DUNGEONS_STATE = 3;
/** MEDIUM-DISTINCT (2026-10-08): the save stamp of a medium build whose second interior block was taken again
 *  (distinctInterior, below) - its own value past the online sizes' 4, never a quest's frozen size: the layout the
 *  stamp 3 named laid that block twice, so a save made in it stands at the start rather than in a block that moved. */
export const MEDIUM_DISTINCT_STAMP = 5;
/** The prefs key (the `medium-dungeons` Features row). */
export const MEDIUM_DUNGEONS_PREF = 'mediumDungeons';
/** The player's ask, on the enhanced skin. */
export const mediumDungeonsWanted = () => isEnhanced() && getPref(MEDIUM_DUNGEONS_PREF) === true;

/** SD-ONLINE: the quest freeze's value for "each dungeon at the size the online world gives it" (onlineDungeonSize) -
 *  appended past the medium size, as the medium size was past DFU's three, and read by an older build as neither. */
export const ONLINE_DUNGEONS_STATE = 4;
/** SD-ONLINE: the online world's sizes and their weights - small 1, medium 2, large (the whole dungeon) 1. */
export const ONLINE_DUNGEON_SIZES = Object.freeze([['small', 1], ['medium', 2], ['full', 1]].map((r) => Object.freeze(r)));
/** SD-ONLINE: the draw's own salt, so a dungeon's size is not any other roll the port makes on its map id. */
export const ONLINE_DUNGEON_SIZE_SALT = 0x5d1e5a2b;
/** SD-ONLINE: THE SIZE THE ONLINE WORLD GIVES A DUNGEON - one draw of the port's seeded die on its map id and the
 *  salt, weighted by ONLINE_DUNGEON_SIZES: the same on every client, every visit, for good. `^` reads the id as its 32
 *  bits, so a map id read signed is the same dungeon as the unsigned one (AUDIT WORLD34 A1). The guards (the main
 *  story's, the undercroft's) are dungeonSizeFor's, not this: it answers for any map id. */
export function onlineDungeonSize(dfLocation) {
  const id = dfLocation?.mapTableData?.mapId;
  if (!Number.isFinite(id)) return 'full';
  const total = ONLINE_DUNGEON_SIZES.reduce((sum, [, w]) => sum + w, 0);
  let u = seededFirst(id ^ ONLINE_DUNGEON_SIZE_SALT) * total;
  for (const [size, w] of ONLINE_DUNGEON_SIZES) {
    if (u < w) return size;
    u -= w;
  }
  return 'full';
}
/** SD-ONLINE: the prefs key of the `world-dungeon-sizes` Features row - offline, every dungeon at its online size. */
export const WORLD_DUNGEON_SIZES_PREF = 'worldDungeonSizes';
/** SD-ONLINE: the player's ask for the world's sizes, on the enhanced skin (forced on online, where it is the law). */
export const worldDungeonSizesWanted = () => isEnhanced() && getPref(WORLD_DUNGEON_SIZES_PREF) === true;
/** The medium size: [x, z, border] - the two interior blocks first (the starting block, then the one east of it),
 *  then the six border blocks that close them (the two north, west, east, the two south). */
export const MEDIUM_LAYOUT = Object.freeze([
  [0, 0, false], [1, 0, false],
  [0, -1, true], [1, -1, true], [-1, 0, true], [2, 0, true], [0, 1, true], [1, 1, true],
].map((r) => Object.freeze(r)));

/** GenerateSmallerDungeon's plus (:1391-1398), as rows: the central starting block, then the North, West, East and
 *  South border blocks, in DFU's draw order. */
const SMALLER_LAYOUT = Object.freeze([
  [0, 0, false],    // Central starting block
  [0, -1, true],    // North border block
  [-1, 0, true],    // West border block
  [1, 0, true],     // East border block
  [0, 1, true],     // South border block
].map((r) => Object.freeze(r)));

/** Quest.Start's stamp (Quest.cs:284): the setting AS OF the quest's
 *  start, frozen into the quest. DSIZE1: and the medium size, when it is asked for and Smaller Dungeons is not on.
 *  AUDIT DELVE E4: online, the ROOM's sizes - the stamp is the size the quest's markers were chosen on, and online the
 *  room builds every dungeon at its own size whatever the player's settings say (dungeonSizeFor, below), so a copy
 *  taken offline builds the dungeon its markers know. SD-ONLINE: those are the online world's sizes (it was the whole
 *  dungeon), ONLINE_DUNGEONS_STATE - and offline too, when the world's sizes are asked for and Smaller is not on. */
export function smallerDungeonsStateNow(enabled = getBool('Experimental', 'SmallerDungeons'), medium = mediumDungeonsWanted(), online = isOnlinePage(), world = worldDungeonSizesWanted()) {
  if (online) return ONLINE_DUNGEONS_STATE;
  if (enabled) return SMALLER_DUNGEONS_STATE.Enabled;
  if (world) return ONLINE_DUNGEONS_STATE;
  return medium ? MEDIUM_DUNGEONS_STATE : SMALLER_DUNGEONS_STATE.Disabled;
}

/**
 * UseSmallerDungeon (:776-797). `questMachine` is the bridge's machine
 * (null when no quest layer is mounted - the dev hosts); a SiteLink on
 * this dungeon defers to ITS quest's frozen state, first link wins.
 * AUDIT DELVE A6: DFU's member, verbatim - a frozen state it does not name (the medium size's) falls through to the
 * setting, as DFU's own law has it. The size the hosts build at is dungeonSizeFor's, below.
 */
export function useSmallerDungeon(dfLocation, { questMachine = null,
  setting = getBool('Experimental', 'SmallerDungeons'), online = false } = {}) {
  if (!dfLocation?.hasDungeon || isMainStoryDungeon(dfLocation.mapTableData?.mapId)) return false;
  if (isArenaUndercroft(dfLocation)) return false;   // ARENA5: the arena's undercroft never shrinks (dungeonSizeFor, below)
  if (online) return false;   // AUDIT WORLD34 B2: online, not the setting's (dungeonSizeFor, below: SD-ONLINE, the world's sizes)
  const links = questMachine?.getSiteLinks(SITE_TYPES.Dungeon, dfLocation.mapTableData?.mapId) ?? [];
  if (links.length > 0) {
    const quest = questMachine.getQuest(links[0].questUID);
    if (quest && quest.smallerDungeonsState === SMALLER_DUNGEONS_STATE.Enabled) return true;
    if (quest && quest.smallerDungeonsState === SMALLER_DUNGEONS_STATE.Disabled) return false;
  }
  return setting;
}

/**
 * DSIZE1: THE SIZE A DUNGEON IS BUILT AT - 'small', 'medium' or 'full' - by UseSmallerDungeon's law (:776-797), whole,
 * with the medium size beside it: the same guards (no dungeon, main story, the arena's undercroft: full), online the
 * world's size (SD-ONLINE: onlineDungeonSize), a quest's frozen state first (Enabled small, MEDIUM_DUNGEONS_STATE
 * medium, ONLINE_DUNGEONS_STATE the world's, Disabled full - first link wins), and then the setting (small), else the
 * world's sizes asked for, else the medium ask, else full.
 */
export function dungeonSizeFor(dfLocation, { questMachine = null,
  setting = getBool('Experimental', 'SmallerDungeons'), medium = mediumDungeonsWanted(), online = false,
  world = worldDungeonSizesWanted() } = {}) {
  if (!dfLocation?.hasDungeon || isMainStoryDungeon(dfLocation.mapTableData?.mapId)) return 'full';
  // ARENA5 (the audit, closing ARENA1's open item "Smaller Dungeons may trim the undercroft"): THE ARENA'S UNDERCROFT
  // NEVER SHRINKS. It is no keep of Daggerfall's but the fighters' hall (world/arenaUndercroft.js): its people, the Pit
  // Master's ring and the Keeper's Hall stand by their distance out from the stair over Kamer's 32 blocks, and a five-
  // block plus of random ones drawn from his list would stand the pit in a cellar and the Hall nowhere. Main story's rule.
  if (isArenaUndercroft(dfLocation)) return 'full';
  // AUDIT SD (Super-Dungeons.md section 5): A HOLLOW IS LAID WHOLE - its feat is the longest walk its template has, the
  // world's sizes are for the Bay's own dungeons; online, offline, whatever a setting or a quest says.
  if (dungeonTier(dfLocation) === 'super') return 'full';
  // AUDIT WORLD34 B2: ONLINE, ONE LAYOUT. The room's stream, its acts and its memory address foes, doors and piles by
  // their index in the layout, and the layout was a per-client SETTING (or a quest's frozen copy of one): a five-block
  // client and a full-dungeon client shared one `_locationKey`, accepted each other's frames, and landed them on the
  // wrong markers. Online there is one layout, and no setting and no quest's copy reaches it.
  // SD-ONLINE (Super-Dungeons.md section 13): that one layout is the WORLD's size for the dungeon - small, medium or
  // large by one seeded draw on its map id (onlineDungeonSize), the same for every client (it was the dungeon as
  // MAPS.BSA has it) - and since an older page still lays the whole, a re-laid dungeon stands in a room of its own
  // (builtDungeonSize, below; net/online.js roomKeyFor), so two layouts never share a stream or a memory.
  if (online) return onlineDungeonSize(dfLocation);
  const links = questMachine?.getSiteLinks(SITE_TYPES.Dungeon, dfLocation.mapTableData?.mapId) ?? [];
  if (links.length > 0) {
    const quest = questMachine.getQuest(links[0].questUID);
    if (quest && quest.smallerDungeonsState === SMALLER_DUNGEONS_STATE.Enabled) return 'small';
    if (quest && quest.smallerDungeonsState === MEDIUM_DUNGEONS_STATE) return 'medium';   // DSIZE1
    if (quest && quest.smallerDungeonsState === ONLINE_DUNGEONS_STATE) return onlineDungeonSize(dfLocation);   // SD-ONLINE: the world's, as its markers know it
    if (quest && quest.smallerDungeonsState === SMALLER_DUNGEONS_STATE.Disabled) return 'full';
  }
  if (setting) return 'small';
  if (world) return onlineDungeonSize(dfLocation);   // SD-ONLINE: offline, the world's sizes asked for
  return medium ? 'medium' : 'full';
}

/** SD-ONLINE: a frozen state that is one of the port's sizes (DFU's are NotSet, Disabled and Enabled). */
const portSize = (state) => state === MEDIUM_DUNGEONS_STATE || state === ONLINE_DUNGEONS_STATE;

/**
 * AUDIT DELVE E5: THE SIZE A QUEST'S MARKERS WERE CHOSEN ON. A quest's dungeon Place enumerates its markers when the
 * quest is parsed, through the sized location (world.js questWorld), and a link another quest already holds on that
 * dungeon decides that size (first link wins, above) - but Start stamps the settings as of now, so a quest whose
 * markers were chosen on the whole dungeon could stamp the medium size, and once the first quest ended, stand its
 * people in blocks the medium build does not have. Between DFU's two values the stamp is DFU's (Quest.cs:284,
 * untouched); where a port's size is either side - the medium size or SD-ONLINE's world sizes, in the stamp or in the
 * link's frozen state - the quest takes the link's: the size its markers know. Called by the machine's Start
 * (machine.js startQuestImmediate), after the stamp.
 */
export function adoptLinkedDungeonSize(quest, questMachine, online = isOnlinePage()) {
  // AUDIT SD III (D6): online every quest's markers are enumerated on the world's sizes (dungeonSizeFor answers the
  // room's before it reads a link) and Start stamps them so - a link's older stamp (one a load's re-lay could not read)
  // took its place, and offline the copy built a layout its markers do not know
  if (online) return null;
  const known = [SMALLER_DUNGEONS_STATE.Disabled, SMALLER_DUNGEONS_STATE.Enabled, MEDIUM_DUNGEONS_STATE, ONLINE_DUNGEONS_STATE];
  for (const r of quest?.resources?.values?.() ?? []) {
    const sd = r?.isPlace ? r.siteDetails : null;
    if (sd?.siteType !== SITE_TYPES.Dungeon) continue;
    const link = questMachine?.getSiteLinks?.(SITE_TYPES.Dungeon, sd.mapId)?.[0];
    if (!link || link.questUID === quest.uid) continue;
    const held = questMachine.getQuest?.(link.questUID)?.smallerDungeonsState;
    if (!known.includes(held) || held === quest.smallerDungeonsState) continue;
    if (!portSize(held) && !portSize(quest.smallerDungeonsState)) continue;
    quest.smallerDungeonsState = held;
    return held;
  }
  return null;
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
 * MEDIUM-DISTINCT (2026-10-08, Mac: "Medium dungeons just copy and paste 2 layouts together"): NO INTERIOR BLOCK LAID
 * TWICE. GetRandomBlock draws with replacement, and the medium size draws its two interior blocks from a pool of two to
 * four (a dungeon of 10 to 22 blocks; MAPS.BSA repeats names in a list as well), so a quarter to a half of them laid
 * the same block twice side by side - one area and its copy. An interior block that repeats one already laid takes, in
 * its place, the pool's next block round from the repeated one's first place in it that is not laid - no draw of its
 * own, so every later row draws as it did and a layout whose draws never repeated is the layout it always was. A pool
 * with no other block keeps the repeat. Border blocks are left as drawn: they are the ends, and Daggerfall's own
 * dungeons repeat them. The five-block plus lays one interior block, so it never meets this and stays DFU's, draw for
 * draw. Mutates `layout` (the clone's own array); answers whether a block was taken again. Not a DFU member.
 */
function distinctInterior(layout, dfLocation) {
  const pool = dfLocation.dungeon.blocks.filter((b) => !/^b/i.test(b.blockName));
  const laid = new Set();
  let taken = false;
  for (let i = 0; i < layout.length; i++) {
    const b = layout[i];
    if (/^b/i.test(b.blockName)) continue;
    if (laid.has(b.blockName)) {
      const at = pool.findIndex((p) => p.blockName === b.blockName);
      for (let k = 1; k < pool.length; k++) {
        const other = pool[(at + k) % pool.length];
        if (laid.has(other.blockName)) continue;
        layout[i] = { ...other, x: b.x, z: b.z, isStartingBlock: b.isStartingBlock };
        taken = true;
        break;
      }
    }
    laid.add(layout[i].blockName);
  }
  return taken;
}

/**
 * GenerateSmallerDungeon's body (:1366-1400) at a layout, NON-MUTATING: a clone of the location whose dungeon is `rows`
 * ([x, z, border], the first the starting block) drawn in order from its own pools, or the location itself at or under
 * `threshold`. Throws on a main-story dungeon, verbatim (:1372-1373). `mark` is the clone's size (FT1: the clone SAYS
 * its size, so the save stamp below can read the build rather than re-deriving it from deps it no longer has).
 * AUDIT DELVE A4: the one body both sizes draw through. MEDIUM-DISTINCT: no interior block laid twice (distinctInterior),
 * the clone saying so (`distinct`) when one was taken again.
 */
function regenerateDungeon(dfLocation, threshold, rows, mark, member) {
  if (isMainStoryDungeon(dfLocation.mapTableData?.mapId)) {
    throw new Error(`${member}() must not be called on a main story dungeon.`);
  }
  const blocks = dfLocation.dungeon?.blocks;
  if (!blocks || blocks.length <= threshold) return dfLocation;
  // DFRandom.Seed = (uint)MapId (:1389) - the same layout every visit.
  setSeed(dfLocation.mapTableData.mapId);
  const layout = rows.map(([x, z, border], i) => generateRdbBlock(x, z, border, i === 0, dfLocation));
  const distinct = distinctInterior(layout, dfLocation);   // MEDIUM-DISTINCT: never one interior block twice
  return { ...dfLocation, dungeon: { ...dfLocation.dungeon, blocks: layout, [mark]: true, ...(distinct ? { distinct: true } : {}) } };
}

/**
 * GenerateSmallerDungeon (:1366-1400), NON-MUTATING: answers a clone of
 * the location whose dungeon is the five-block plus, or the location
 * itself when it is already small. Throws on a main-story dungeon,
 * verbatim (:1372-1373).
 */
export function generateSmallerDungeon(dfLocation) {
  return regenerateDungeon(dfLocation, SMALLER_DUNGEON_THRESHOLD, SMALLER_LAYOUT, 'smaller', 'GenerateSmallerDungeon');
}

/** Was this location BUILT small - a clone generateSmallerDungeon
 *  answered? False for the source location, for a dungeon already at or
 *  under the threshold, and for anything else. */
export function isSmallerDungeon(dfLocation) {
  return dfLocation?.dungeon?.smaller === true;
}

/**
 * DSIZE1: GenerateSmallerDungeon's law at the medium size, NON-MUTATING - a clone whose dungeon is MEDIUM_LAYOUT drawn
 * from the location's own block list (interior blocks for the two, border blocks for their ring; GetRandomBlock's pool
 * and its empty-pool throw), DFRandom seeded on the MapId, or the location itself when it is at or under the
 * threshold. Throws on a main-story dungeon, as the small one does.
 */
export function generateMediumDungeon(dfLocation) {
  return regenerateDungeon(dfLocation, MEDIUM_DUNGEON_THRESHOLD, MEDIUM_LAYOUT, 'medium', 'generateMediumDungeon');
}

/** DSIZE1: was this location BUILT at the medium size? */
export function isMediumDungeon(dfLocation) {
  return dfLocation?.dungeon?.medium === true;
}

/** SD-ONLINE: the size a location was BUILT at, in dungeonSizeFor's words - read off the build (FT1: the clone says its
 *  size), so a dungeon at or under a size's threshold, which no regeneration touched, is 'full' whatever was asked.
 *  The room's name reads it (net/online.js roomKeyFor): a dungeon's room is its layout's. */
export function builtDungeonSize(dfLocation) {
  if (isMediumDungeon(dfLocation)) return 'medium';
  return isSmallerDungeon(dfLocation) ? 'small' : 'full';
}

/**
 * The save stamp - PlayerPositionData_v1.smallerDungeonsState
 * (SerializablePlayer.cs:224). DEPARTURE (recorded, Ledger A: THE
 * SMALLER-DUNGEON SAVE STAMP IS THE BUILD): DFU stamps the RAW SETTING
 * as of the save; the port stamps the size ACTUALLY BUILT. They agree
 * wherever DFU can reach - but online the dungeon is always the room's
 * (AUDIT WORLD34 B2, above; SD-ONLINE: the world's) whatever the setting says, and under a
 * quest's frozen state the build and the setting differ too, so a save
 * made online with the setting on and loaded offline stood the player
 * in a block the five-block dungeon does not have, and never warped
 * because the SETTING had not changed. The warp asks about the build;
 * the stamp answers about the build.
 */
export function smallerDungeonsStamp(dfLocation) {
  // DSIZE1: the build, at its own value - MEDIUM-DISTINCT: and a medium build whose interior block was taken again, at
  // its own, so a save made in the layout that laid it twice (3) is another layout's
  if (isMediumDungeon(dfLocation)) return dfLocation.dungeon.distinct === true ? MEDIUM_DISTINCT_STAMP : MEDIUM_DUNGEONS_STATE;
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
