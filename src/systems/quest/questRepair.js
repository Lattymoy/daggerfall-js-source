// @ts-check
// QREPAIR (2026-09-24, Mac: "Add a quest refresh option to settings" - asked what it should do, Mac chose "Repair
// active quests: re-places the people, items, foes and map markers of your active quests that went missing, keeping
// your progress"): THE REPAIR, one pass over every quest still running.
//
// WHAT IT PUTS BACK - only what the quest's OWN script placed and a fault took away, derived from the quest's own state:
//   1. A PLACEMENT A MARKER LOST. Every `place npc|item|foe` action that has run names where its resource belongs; a
//      resource no marker of any of the quest's Places holds any more is assigned there again (Place.assignQuestResource,
//      the action's own call - without the action's unhide and without its cull). The fault this answers: a party's
//      shared-quest resync (machine.updateSharedQuest) replaces each Place's siteDetails with the partner's copy, and
//      the targets written here after it are gone while the `place` action, complete, never runs again.
//   2. A SITE LINK THE QUEST NEVER GOT. The placement actions reserve a link only when `hasSiteLink` finds none AT THE
//      SITE - any quest's - so a second quest placing where a first already had leans on the first's link, and when
//      the first ends, the second's people, items and foes stand nowhere. One link per (quest, Place) holding targets.
//   3. THE MAP. Every `reveal` that has run is filed again (discoverLocation is idempotent), and a quest whose talk
//      topics were never added (a received shared quest: receiveSharedQuest adds none) gets them - only then, since
//      adding them again un-discovers the residences a player already learned (topicTree.js undiscoverQuestResidence).
//   4. WHERE THE PLAYER STANDS, NOW: the current interior or dungeon is mounted again, a resource already standing
//      matched by quest and symbol NAME (sceneMount.js byName) - after a load a standing foe holds a restored symbol
//      the identity match misses, and the plain mount would stand it twice.
//
// WHAT IT NEVER TOUCHES: a destroyed person or an individual at home; an item picked up, carried, dropped, made the
// player's own, or given to a foe; a foe all of whose spawns are dead, or one the quest removed; a hidden person stays
// hidden (the placement is not the action's unhide); a resource the quest's placements disagree about (two Places,
// no Person's last-assigned Place to settle it) is left where it is. Clocks, tasks, timers and progress are not read
// for anything but the above, and nothing here writes them.
//
// Not a DFU member: DFU has no such pass (its quest debugger is a developer's console). Ledger A (QREPAIR).
import { MARKER_PREFERENCE, SITE_TYPES } from './place.js';
import { ONLINE_DUNGEONS_STATE, MEDIUM_DUNGEONS_STATE } from '../../world/smallerDungeons.js';   // AUDIT DELVE E1 / SD-ONLINE: the sizes the room builds online; MEDIUM-DISTINCT: the two stamps whose builds are medium

const PLACEMENTS = Object.freeze({ PlaceNpc: 'npcSymbol', PlaceItem: 'itemSymbol', PlaceFoe: 'foeSymbol' });

/** A quest still running: neither complete nor tombstoned. */
export const questRunning = (quest) => !!quest && !quest.questComplete && !quest.questTombstoned;

/** Every resource symbol NAME any marker of the quest's Places holds - the selected marker, the spawn markers and
 *  the item markers alike (a resource an indexed item marker holds is placed, whether or not the mount stands it). */
export function targetedNames(quest) {
  const names = new Set();
  for (const r of quest.resources?.values?.() ?? []) {
    if (!r?.isPlace) continue;
    const sd = r.siteDetails;
    for (const m of [sd?.selectedMarker, ...(sd?.questSpawnMarkers ?? []), ...(sd?.questItemMarkers ?? [])]) {
      for (const t of m?.targetResources ?? []) if (t?.name) names.add(t.name);
    }
  }
  return names;
}

/** Does this Place hold a target the mount would stand (the selected marker or a spawn marker - the two the walk
 *  reads, sceneMount.js addQuestResourceObjects)? */
export function placeHoldsTargets(place) {
  const sd = place?.siteDetails;
  return [sd?.selectedMarker, ...(sd?.questSpawnMarkers ?? [])].some((m) => (m?.targetResources?.length ?? 0) > 0);
}

/** Is this resource gone ON PURPOSE (or out of the world's hands), so that placing it again would undo the quest? */
export function goneOnPurpose(res, quest, { carriesQuestItem = null } = {}) {
  if (res.isPerson) return !!res.isDestroyed || !!(res.isIndividualNPC && res.isIndividualAtHome);
  if (res.isItem) {
    if (res.isHidden || res.madePermanent || res.playerDropped) return true;   // picked up / the player's own / dropped
    if (carriesQuestItem?.(res)) return true;
    const df = res.daggerfallUnityItem ?? null;
    if (df) for (const r of quest.resources?.values?.() ?? []) if (r?.isFoe && r.itemQueue?.includes?.(df)) return true;   // given to a foe
    return false;
  }
  if (res.isFoe) return !!res.isHidden || !((res.killCount ?? 0) < (res.spawnCount ?? 0));
  return true;
}

/** Where each placed resource belongs, by symbol name: the Place (and marker) its completed placement actions name -
 *  a Person's last-assigned Place settling it; two Places and nothing to settle them: ambiguous, left alone. */
export function placementIntents(quest) {
  const out = new Map();
  for (const task of quest.tasks?.values?.() ?? []) {
    for (const a of task.actions ?? []) {
      const field = PLACEMENTS[a?.typeName];
      if (!field || !a.isComplete) continue;
      const res = quest.getResource?.(a[field]);
      const place = quest.getPlace?.(a.placeSymbol);
      if (!res || !place) continue;
      const name = res.symbol?.name;
      const prev = out.get(name);
      const intent = { res, place, marker: Number.isInteger(a.marker) ? a.marker : -1, pref: a.markerPreference ?? MARKER_PREFERENCE.Default, ambiguous: false };
      if (!prev) out.set(name, intent);
      else if (prev.place !== place) prev.ambiguous = true;
    }
  }
  for (const [name, it] of out) {
    if (!it.res.isPerson || !it.res.assignedPlaceSymbol) continue;
    const last = quest.getPlace?.(it.res.assignedPlaceSymbol);
    if (!last) continue;
    if (last !== it.place) out.set(name, { ...it, place: last, marker: -1, pref: MARKER_PREFERENCE.Default, ambiguous: false });
    else it.ambiguous = false;
  }
  return out;
}

/** The pass's first step, for one quest: every placement a marker lost, assigned where its action put it. Counts into
 *  `report` (people, items, foes, failed). */
export function putBackPlacements(quest, env = {}, report = { people: 0, items: 0, foes: 0, failed: 0 }) {
  const held = targetedNames(quest);
  for (const [name, it] of placementIntents(quest)) {
    if (it.ambiguous || held.has(name) || goneOnPurpose(it.res, quest, env)) continue;
    try { it.place.assignQuestResource(it.res.symbol, it.marker, it.pref, false); } catch { report.failed++; continue; }   // a Place with no markers throws: that one is not repairable here
    held.add(name);
    if (it.res.isPerson) report.people++;
    else if (it.res.isItem) report.items++;
    else report.foes++;
  }
  return report;
}

/** A marker list's addresses - block and flat - to compare two enumerations by. */
const markerAddresses = (list) => (list ?? []).map((m) => `${m?.dungeonX},${m?.dungeonZ},${m?.markerID}`).join(';');

/**
 * DSIZE1 (AUDIT DELVE E1): A FROZEN SIZE, CROSSING ONLINE. Online the room builds every dungeon at ITS OWN size,
 * whatever a quest froze (smallerDungeons.js dungeonSizeFor, AUDIT WORLD34 B2) - but a quest started offline chose its
 * markers on the layout ITS stamp names: a marker is a block's (dungeonX, dungeonZ) and a flat in it, and on another layout the
 * same address is another block, or none - the quest item in rock, the foe in the void, and a quest no one in the
 * party can finish. So when a game is loaded online, a running quest stamped at any other size has each dungeon
 * Place's markers enumerated again on the dungeon the room builds (Place's own enumeration, through the quest's own
 * world, which online is the room's build), the pass's first step puts back what its own placements had stood there,
 * and the stamp becomes the room's - the size its markers now know, so a copy taken back offline builds the dungeon
 * they know. A Place whose markers come out the same (a main-story keep, the arena's undercroft, a dungeon no bigger
 * than the size) is left as it is. Answers the count of quests re-laid. Not a DFU member (DFU has no online).
 *
 * SD-ONLINE (Super-Dungeons.md section 13): online every dungeon has the WORLD's size now - small, medium or large by
 * its map id (onlineDungeonSize) - so this turned around: it was relayWholeDungeons, which re-laid the small and medium
 * sizes on the whole dungeon and left the whole alone. Every stamp but ONLINE_DUNGEONS_STATE is read now - the whole
 * dungeon's, the small one's, the medium one's, and DFU's NotSet, which meant "the setting" and so names no layout at
 * all - and each of its dungeons compared with its online build (a dungeon whose online size is the stamp's size
 * agrees, and nothing moves). A quest one of whose dungeons could not be read here (no world, no such location, a
 * throw) keeps its stamp: the size its markers there still know.
 */
export function relayOnlineDungeons(machine, env = {}) {
  let relaid = 0;
  for (const quest of machine?.quests?.values?.() ?? []) {
    if (questRunning(quest) && relayQuestOnline(quest, env)) relaid++;
  }
  return relaid;
}

/** One quest's re-lay (relayOnlineDungeons, above): whether its markers moved. AUDIT SD III (D5): asked of a quest a
 *  party member shares online too (systems/questShare.js receiveSharedQuest) - an older page lays every dungeon whole,
 *  and its copy pointed into blocks this page's world-sized build has not; the load's pass alone re-laid it, the next
 *  time this player loaded online. */
export function relayQuestOnline(quest, env = {}) {
  if (!quest || quest.smallerDungeonsState === ONLINE_DUNGEONS_STATE) return false;
  const { moved, unread } = relayDungeonPlaces(quest);
  if (!unread) quest.smallerDungeonsState = ONLINE_DUNGEONS_STATE;
  if (!moved) return false;
  putBackPlacements(quest, env);
  return true;
}

/** A quest's dungeon Places, each compared with the dungeon its world builds now: a Place whose markers come out
 *  otherwise has them enumerated again there and its targets let go (putBackPlacements stands them again). Answers
 *  whether any moved, and whether a dungeon could not be read (no world, no such location, a throw). The two re-lays'
 *  one body (relayQuestOnline, relayMovedLayouts). */
function relayDungeonPlaces(quest) {
  const world = quest.hooks?.world ?? null;
  let moved = false, unread = false;
  for (const r of quest.resources?.values?.() ?? []) {
    const sd = r?.isPlace ? r.siteDetails : null;
    if (sd?.siteType !== SITE_TYPES.Dungeon) continue;
    const index = world?.maps?.getRegion?.(sd.regionIndex)?.mapNameLookup?.get?.(sd.locationName);
    const location = index == null ? null : world.maps.getLocation(sd.regionIndex, index);
    if (!location?.dungeon?.blocks) { unread = true; continue; }
    let markers;
    try { markers = r._enumerateDungeonQuestMarkers(world, location); } catch { unread = true; continue; }
    if (markerAddresses(markers.questSpawnMarkers) === markerAddresses(sd.questSpawnMarkers)
      && markerAddresses(markers.questItemMarkers) === markerAddresses(sd.questItemMarkers)) continue;
    r.siteDetails = { ...sd, questSpawnMarkers: markers.questSpawnMarkers, questItemMarkers: markers.questItemMarkers, selectedMarker: { targetResources: null } };
    moved = true;
  }
  return { moved, unread };
}

/**
 * MEDIUM-DISTINCT (2026-10-08, Mac: "Medium dungeons just copy and paste 2 layouts together"): A LAYOUT THE LAW MOVED.
 * A medium build no longer lays one interior block twice (world/smallerDungeons.js distinctInterior), so a dungeon whose
 * draws repeated is another layout now, and a running quest that chose its markers on the old one holds a marker in
 * its second interior block that addresses a block no longer there - its item in rock, its foe in the void. At every
 * load, online and off (after relayOnlineDungeons), a running quest stamped at one of the two sizes whose builds are
 * medium - MEDIUM_DUNGEONS_STATE and the world's sizes, ONLINE_DUNGEONS_STATE - has each dungeon Place compared with
 * the dungeon its world builds now and enumerated again where it differs, its placements put back; its stamp is
 * untouched (the size is the same size). DFU's stamps are left alone: neither of their builds moved. Answers the count
 * of quests re-laid. Not a DFU member.
 */
export function relayMovedLayouts(machine, env = {}) {
  let relaid = 0;
  for (const quest of machine?.quests?.values?.() ?? []) {
    if (!questRunning(quest)) continue;
    if (quest.smallerDungeonsState !== MEDIUM_DUNGEONS_STATE && quest.smallerDungeonsState !== ONLINE_DUNGEONS_STATE) continue;
    if (!relayDungeonPlaces(quest).moved) continue;
    putBackPlacements(quest, env);
    relaid++;
  }
  return relaid;
}

/**
 * THE PASS. `machine` the quest machine; `env` the host's seams: `discoverLocation(regionName, locationName)` (true
 * when newly filed; throws on a name it cannot resolve), `hasQuestTopics(quest)` + `addQuestTopics(quest)`,
 * `carriesQuestItem(itemResource)`, `mountCurrentSite()` (the current interior's or dungeon's mount, by name).
 * Answers the counts and the line the player reads.
 */
export function repairActiveQuests(machine, env = {}) {
  const report = { quests: 0, people: 0, items: 0, foes: 0, relinked: 0, revealed: 0, topics: 0, failed: 0 };
  const quests = [...(machine?.quests?.values?.() ?? [])].filter(questRunning);
  report.quests = quests.length;
  const was = !!machine?.mountByName;
  if (machine) machine.mountByName = true;   // every mount the pass runs matches by name (sceneMount.js)
  try {
    for (const quest of quests) {
      try {
        // 1. the placements a marker lost
        putBackPlacements(quest, env, report);
        // 2. one link per (quest, Place) that holds targets
        for (const r of quest.resources?.values?.() ?? []) {
          if (!r?.isPlace || !placeHoldsTargets(r)) continue;
          const linked = (machine.siteLinks ?? []).some((l) => l.questUID === quest.uid && l.placeSymbol?.name === r.symbol?.name);
          if (linked) continue;
          machine.createSiteLink(quest, r.symbol);
          report.relinked++;
        }
        // 3. the map: every reveal that has run, filed again; topics for a quest that never had any
        for (const task of quest.tasks?.values?.() ?? []) {
          for (const a of task.actions ?? []) {
            if (a?.typeName !== 'RevealLocation' || !a.isComplete) continue;
            const place = quest.getPlace?.(a.placeSymbol);
            if (!place?.siteDetails) continue;
            try { if (env.discoverLocation?.(place.siteDetails.regionName, place.siteDetails.locationName) === true) report.revealed++; } catch { report.failed++; }
          }
        }
        if (env.hasQuestTopics && env.addQuestTopics && !env.hasQuestTopics(quest)) { env.addQuestTopics(quest); report.topics++; }
      } catch { report.failed++; }
    }
    // 4. where the player stands, now
    try { env.mountCurrentSite?.(); } catch { report.failed++; }
  } finally {
    if (machine) machine.mountByName = was;
  }
  report.text = questRepairText(report);
  return report;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** The line the player reads after a repair. */
export function questRepairText(r) {
  if (!r || !r.quests) return 'You have no active quests to repair.';
  const put = [r.people ? plural(r.people, 'person', 'people') : null, r.items ? plural(r.items, 'item', 'items') : null, r.foes ? plural(r.foes, 'foe', 'foes') : null].filter(Boolean);
  const parts = [];
  if (put.length) parts.push(`put back ${put.join(', ')}`);
  if (r.relinked) parts.push(`reconnected ${plural(r.relinked, 'place', 'places')}`);
  if (r.revealed) parts.push(`marked ${plural(r.revealed, 'location', 'locations')} on your map`);
  if (r.topics) parts.push(`restored what people know about ${plural(r.topics, 'quest', 'quests')}`);
  const head = parts.length ? `Quests repaired: ${parts.join('; ')}.` : `Nothing was missing from ${r.quests === 1 ? 'your active quest' : `your ${r.quests} active quests`}.`;
  return r.failed ? `${head} ${plural(r.failed, 'part', 'parts')} could not be checked.` : head;
}
