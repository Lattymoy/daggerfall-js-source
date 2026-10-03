// GUIDE1 - THE QUEST LENS (2026-09-29, Mac: "How can we set the
// foundation and improve the quest system substantially? Like really
// modernize it, make it more accessible"). The foundation of the Quest
// Guide arc (bible/06-Systems/Quest-Guide-Arc.md): every modern quest
// face the arc builds - the tracker, the notices, the map's marks, the
// accessible journal - draws from this, and from nothing else.
//
// WHAT IT IS. One read-only picture of the player's quests: for each,
// its title, its entries in the order they were written with the step
// and the time of each, the latest entry, the place that entry sends
// the player, the clock the journal's "Time remains" counts - and,
// between two looks, what changed. The machine offers none of that. It
// has no "current objective" (PX4: a Daggerfall quest speaks in journal
// entries - the entries ARE the tasks, and a checkbox the machine does
// not track would be a lying UI); it raises no event when the journal
// changes (`log` is a bare addLogStep); and every text read it offers
// moves state.
//
// THREE LAWS, each pinned (test/guide1_questLens.test.js):
//
// THE MACHINE NEVER KNOWS. Nothing here writes quest state - and a read
// of an entry is not free. Message.getTextTokens, the journal's own
// read (DFU's logbook and ours), reveals the talk topics the entry names
// (QuestMacroHelper's reveal arm), latches the quest's
// LastResourceReferenced, LastPlaceReferenced and CurrentLogMessageId,
// re-seeds DFRandom (%n %fn %mn) and draws the quest's own rolls (%god
// %olf). DFU's logbook does all of that each time it is opened; a lens
// that read on every change would do it at moments no player chose,
// and a talk topic would open because a HUD line was drawn. The quiet
// read takes the journal's bracket with the reveal off and puts the
// latches, the seed and the rolls back: a game with the lens and a game
// without it are the same game.
//
// NOTHING THE JOURNAL HAS NOT SAID. Every fact is one the player's own
// journal gives them now: an entry's text; the Place DFU's logbook
// would travel to from it (GetLastPlaceMentionedInMessage - the LAST
// Place any macro in the entry names, never LastPlaceReferenced, which
// DFU's own comment says can point at an unrelated home); and of that
// place only the names the entry says, or that DFU's find-place box
// would say (a place already on the player's map), or the town the
// player is standing in. No task state, no hidden resource, no marker.
//
// ONE WALK. The quests, their messages, their steps and their clock
// come from questBridge.questLog() (MAC-K2's walk, one home); which
// entries count and in what order is questRail.js's law. The lens
// hands that law its own reader and adds the target, the said law and
// the diff. It never walks the machine itself.

import { getMessageResources, getMacro, MACRO_TYPES } from '../systems/quest/questMacros.js';
import { SITE_TYPES } from '../systems/quest/place.js';
import { getSeed, setSeed } from '../formats/dfRandom.js';
import { REGION_NAMES, patchRegionIndex } from '../formats/mapsFile.js';
import { questRail, journalLines, questTitleOf, QUEST_URGENT_SECONDS } from './questRail.js';
import { localizedText, formatText } from '../systems/textManager.js';   // L10N3d: locationInRegionProvince, read in the player's language

/** GetLastPlaceMentionedInMessage (DaggerfallQuestJournalWindow.cs:
 *  470-485): the LAST Place resource any macro in the message names.
 *  Not ParentQuest.LastPlaceReferenced - DFU's own comment says that
 *  sends the player to an unrelated home location for the last NPC
 *  processed - and a message that names no Place at all (the Dark
 *  Brotherhood initiation keeps its entry secret) answers null.
 *
 *  ONE DFU MEMBER, ONE EXPORT: this lived as a private method of the
 *  classic logbook (ui/questJournal.js), which imports it from here now
 *  - the lens and the logbook cannot disagree on where a quest points.
 *  The logbook draws the variant on the engine's roll, as DFU does; the
 *  lens hands the quiet roll, so a look draws nothing from Math.random
 *  either. */
export function lastPlaceMentionedInMessage(message, roll = Math.random) {
  const resources = getMessageResources(message, roll);
  if (!resources || resources.length === 0) return null;
  let lastPlace = null;
  for (const resource of resources) if (resource?.isPlace) lastPlace = resource;
  return lastPlace;
}

// The quiet read's roll: variant 0, and no draw from the quest's own
// stream or the engine's. The corpus's 408 logged messages are all
// single-variant, so it is also the variant the logbook shows. The one
// word it decides is %god's random arm (a region with no temple of its
// own), which answers the first divine: DFU's logbook re-rolls that
// word on every open, so no one value of it is the journal's.
const QUIET_ROLL = () => 0;

const _warned = new Set();
function warnOnce(key, text) {
  if (_warned.has(key)) return;
  _warned.add(key);
  console.warn(text);
}

/**
 * THE QUIET READ: an entry's expanded tokens exactly as the journal
 * would print them now, with nothing moved. The reveal is off
 * (Message.getTextTokens' fourth argument) and the three latches, the
 * DFRandom seed and the quest's rolls are put back however the
 * expansion leaves - including when it throws: DFU's own %di reads
 * LastPlaceReferenced.Scope before its null check, and fifteen corpus
 * messages meet it when no Place has been referenced yet (none of them
 * is ever logged, so no journal entry is one). A read that throws
 * answers null: the lens says nothing rather than take a face down, and
 * says so once.
 */
export function quietTokens(message) {
  if (!message) return null;
  const quest = message.parentQuest ?? null;
  const seed = getSeed();
  const kept = quest ? {
    resource: quest.lastResourceReferenced,
    place: quest.lastPlaceReferenced,
    logId: quest.currentLogMessageId,
    rolls: quest.rolls,
    hooks: quest.hooks,
  } : null;
  if (quest) {
    quest.rolls = QUIET_ROLL;
    // AUDIT GUIDE L3: an entry that names a quest LETTER reads the letter's signoff (Item.expandMacro ->
    // questLetterName -> expandLetterSignoff, DFU's ItemHelper and ExpandLetterSignoff) - and that path reveals its
    // names with no reveal flag at all. The read's own hooks answer nothing; the rest are the quest's.
    if (quest.hooks) quest.hooks = Object.create(quest.hooks, { addDialog: { value: () => {} }, dialogLink: { value: () => {} } });
  }
  // AUDIT GUIDE L3: ...and draws the letter's variant on the ENGINE's roll (questLetterName's Math.random default):
  // for the read, the engine's roll is the quiet one, put back however the read leaves
  const engineRoll = Math.random;
  Math.random = QUIET_ROLL;
  try {
    return message.getTextTokens(-1, QUIET_ROLL, true, false);
  } catch (e) {
    warnOnce(`${quest?.uid}:${message.id}`, `[quest lens] message ${message.id} of ${quest?.questName ?? 'a quest'} does not expand (${e?.message ?? e}); it reads as nothing`);
    return null;
  } finally {
    Math.random = engineRoll;
    setSeed(seed);
    if (quest) {
      quest.lastResourceReferenced = kept.resource;
      quest.lastPlaceReferenced = kept.place;
      quest.currentLogMessageId = kept.logId;
      quest.rolls = kept.rolls;
      quest.hooks = kept.hooks;
    }
  }
}

/** The quiet read through the journal's line law. */
export function quietLines(message) {
  const tokens = quietTokens(message);
  return tokens ? journalLines(tokens) : null;
}

/** SiteTypes as a face names them. */
const SITE_KIND = Object.freeze({ [SITE_TYPES.Town]: 'town', [SITE_TYPES.Dungeon]: 'dungeon', [SITE_TYPES.Building]: 'building' });

/** AUDIT GUIDE H1: the clocks an entry NAMES - its DetailsMacros (`=queston_`, Clock.ExpandMacro's days), read
 *  unexpanded like saidOf, so nothing moves. A clock the journal names is a deadline the quest gave the player; one it
 *  never names is the script's own (a letter's arrival, the hour a quest waits before it closes itself) - DFU's
 *  journal shows no clock, and only HUDQuestDebugger lists those. */
function clocksNamed(message) {
  const named = new Set();
  if (typeof message?.getTextTokens !== 'function') return named;
  for (const token of message.getTextTokens(0, QUIET_ROLL, false)) {
    if (!token.text) continue;
    for (const word of token.text.split(' ')) {
      const macro = getMacro(word);
      if (macro.type === MACRO_TYPES.DetailsMacro && macro.symbol) named.add(macro.symbol);
    }
  }
  return named;
}

/** Which of a place's names an entry SAYS: the name macros (Place.
 *  ExpandMacro - `_p_` the building, `__p_` and `___p_` the location,
 *  `____p_` the region) that name the symbol in the entry's text, read
 *  unexpanded, so nothing moves. Variant 0, the quiet read's. */
function saidOf(message, symbolName) {
  const said = new Set();
  if (!symbolName) return said;
  for (const token of message.getTextTokens(0, QUIET_ROLL, false)) {
    if (!token.text) continue;
    for (const word of token.text.split(' ')) {
      const macro = getMacro(word);
      if (macro.symbol === symbolName && macro.type >= MACRO_TYPES.NameMacro1 && macro.type <= MACRO_TYPES.NameMacro4) said.add(macro.type);
    }
  }
  return said;
}

/**
 * Where an entry sends the player, as plain data - or null when it names
 * no Place with a site (HandleQuestClicks' first gate, :449).
 *
 * `where` is the classic logbook's own two gates, the host's:
 * `canFindPlace(regionName, locationName)` (the travel map's
 * CanFindPlace - is it on the player's map?) and `currentLocationName()`.
 * GUIDE2: `onMap` is null - not false - where the host has no map to ask
 * (the dungeon's own journal, the fixed-town route): a face must not tell
 * the player a place is missing from a map nobody looked at.
 *
 * Each name is there only when the entry says it or DFU would: the
 * location (and its kind) when the entry names it, when the place is on
 * the map (the find-place box names location and region), or when the
 * player stands in it; the region the same, or when the entry names the
 * region; the building ONLY when the entry names the building - "a house
 * in Daggerfall" stays a house in Daggerfall. `find` is what the
 * logbook's Yes hands the travel map (`gotoPlace({ siteDetails: find })`),
 * present exactly when HandleQuestClicks would offer the box: on the
 * map, and not where the player already is.
 */
export function entryTarget(message, where = {}) {
  // A raw token array (a host's filed entry, a test's fixture) has no resources to name: it points nowhere.
  if (typeof message?.getTextTokens !== 'function') return null;
  const place = lastPlaceMentionedInMessage(message, QUIET_ROLL);
  const site = place?.siteDetails ?? null;
  if (!site?.locationName) return null;
  const said = saidOf(message, place.symbol?.name);
  const onMap = where.canFindPlace ? !!where.canFindPlace(site.regionName, site.locationName) : null;
  // HandleQuestClicks' own gate (:450) is the NAME: a place named as the player's location offers no box
  const hereByName = !!where.currentLocationName && site.locationName === where.currentLocationName();
  // AUDIT GUIDE W2: "(you are here)" is a CLAIM, and a player cannot stand in a place their map lacks - a place of the
  // same name elsewhere is not it: never claimed where the map says no (and never lets that name the place)
  const here = hereByName && onMap !== false;
  const named = onMap === true || here || said.has(MACRO_TYPES.NameMacro2) || said.has(MACRO_TYPES.NameMacro3);
  const regionIndex = patchRegionIndex(site.regionIndex ?? 0, site.regionName ?? '');   // :455-456's legacy-save workaround, both sides of the seam
  return {
    symbol: place.symbol?.name ?? null,
    kind: named ? (SITE_KIND[site.siteType] ?? null) : null,
    locationName: named ? site.locationName : null,
    // AUDIT GUIDE W1: the region only where the entry says it or DFU's find-place box would (the place on the map, or
    // the player in it) - the town's own name (`__p_`) never unlocks it
    regionName: onMap === true || here || said.has(MACRO_TYPES.NameMacro4) ? (REGION_NAMES[regionIndex] ?? site.regionName ?? null) : null,
    buildingName: said.has(MACRO_TYPES.NameMacro1) ? (site.buildingName ?? null) : null,
    onMap,
    here,
    find: onMap === true && !hereByName ? { regionIndex: site.regionIndex ?? 0, regionName: site.regionName ?? '', locationName: site.locationName } : null,
  };
}

/** Internal_Strings `locationInRegionProvince`, "{0} in {1} province" -
 *  the find-place box's own entry line (DaggerfallQuestJournalWindow.cs:
 *  459-462; AUDIT GUIDE D4). ONE HOME: the classic logbook's FIND_PLACE_TEXT reads it from
 *  here, and every enhanced face says a target's place in the same words. */
export const locationInRegionText = (locationName, regionName) =>
  formatText(localizedText('locationInRegionProvince', '{0} in {1} province'), locationName, regionName);   // L10N3d: in the player's language

/** GUIDE2: the port's own words around a target - the enhanced faces'
 *  where line, its note and its door. */
export const WHERE_TEXT = Object.freeze({
  somewhere: (regionName) => `Somewhere in ${regionName} province`,
  here: 'you are here',
  offMap: 'Not on your map yet. Ask around for directions.',
  show: 'Show on map',
  showLabel: (place) => `Show on map: ${place}`,   // AUDIT GUIDE U12: its own words first (WCAG 2.5.3 - a speech user says "Show on map")
});

/**
 * GUIDE2 - A TARGET IN WORDS, the same words on every face: `{ where, note,
 * find }`, or null when the target says nothing a player could use.
 *
 *   where  the building the entry names, then the place in DFU's own
 *          phrase ("Llugwych in Wayrest province") - or, with only the
 *          region said, "Somewhere in Devilrock province"; "(you are
 *          here)" when the player stands in it.
 *   note   the place is named and the player's map is KNOWN not to have
 *          it: Daggerfall's answer is to ask - "Where is ...?" in talk,
 *          and an NPC marks it (06-Systems/Talk-Arc.md, THE COMPASS
 *          MARK). Never when the map was not asked (`onMap` null).
 *   find   the target's own - the door's payload, or null.
 */
export function targetWords(target) {
  if (!target) return null;
  const place = target.locationName
    ? (target.regionName ? locationInRegionText(target.locationName, target.regionName) : target.locationName)
    : (target.regionName ? WHERE_TEXT.somewhere(target.regionName) : null);
  if (!place && !target.buildingName) return null;
  const where = [target.buildingName, place].filter(Boolean).join(', ');
  return {
    where: target.here ? `${where} (${WHERE_TEXT.here})` : where,
    note: target.locationName && target.onMap === false ? WHERE_TEXT.offMap : null,   // AUDIT GUIDE W2: a place the map lacks is never here
    find: target.find ?? null,
    town: place,   // AUDIT GUIDE K2: the place without its building - what a map mark two quests share says
  };
}

/** An entry's identity across looks: the quest, the step, the message
 *  and the moment it was written. A step logged again - a new message,
 *  or the same one at a new time - is a new entry. */
function entryKey(row, step, message) {
  return step ? `${row?.id}|${step.stepID}|${step.messageID}|${step.time}` : `${row?.id}|m${message?.id}`;
}

/** AUDIT GUIDE H4: an entry's identity as NEWS - its step and message, not the moment. The same words logged again
 *  (P0B10L07 re-logs its step on every click; a shared quest's resync writes the partner's times) are not news. */
const newsKey = (id, e) => (e.stepID != null ? `${id}|${e.stepID}|${e.messageID}` : `${id}|m${e.messageID}`);

/**
 * THE LENS. One per quest bridge: scenes/questBridge.js makes it over
 * its own walk and resets it when a save is loaded.
 *
 * `look(where)` answers `{ quests, events }`:
 *   quests   - one view per active quest the journal lists, in the
 *              walk's order: `{ key, id, name, title, questName, main,
 *              clockSeconds, urgent, entries, latest, updatedAt,
 *              target, words }` (words: targetWords of the target),
 *              each entry `{ key, stepID, messageID, time,
 *              lines, target }` oldest first, `latest` the last of
 *              them and `target` its target (never an older entry's -
 *              a quest that has moved on points where it points now;
 *              AUDIT GUIDE O3: an older entry's target is null, never
 *              asked). `clockSeconds` is the deadline the quest's own
 *              entries NAME (AUDIT GUIDE H1), null when they name none.
 *              The archive is the journal windows' own read, not the
 *              lens's (AUDIT GUIDE O3).
 *   events   - what changed since the previous look: `started` (a quest
 *              the lens had not seen writes its first entry),
 *              `updated` (a quest writes an entry - a step and message
 *              it had not written; `entries` names them), `urgent`
 *              (its named deadline crosses under
 *              QUEST_URGENT_SECONDS), `completed` / `ended` (it leaves
 *              the journal - the notebook's own two verdicts). Every
 *              event carries `id`, `title` and `main`. The first look,
 *              and the first after reset(), is the BASELINE and says
 *              nothing: a loaded game is not news.
 *
 * Lines are read once per entry and kept; macros that read the world
 * as it is (%di's direction, a countdown's days) go stale in a kept
 * line, so a face that shows text calls rereadText() when it opens -
 * the moment DFU's logbook reads - and the next look reads them again.
 */
export class QuestLens {
  constructor({ questLog = null } = {}) {
    this._questLog = questLog;
    this._text = new Map();    // entry key -> lines (null: the read threw)
    this._named = new Map();   // entry key -> the clocks it names (AUDIT GUIDE H1)
    this._namedBy = new Map();   // quest id -> every clock its entries have named since the baseline (a told deadline stays told)
    this._last = null;         // id -> { title, main, clockSeconds, entryKeys } as of the previous look
    this._known = new Set();   // ids the lens has shown since the baseline
  }

  /** A load replaces the quest set whole: forget it, and let the next
   *  look be a baseline. */
  reset() {
    this._last = null;
    this._known.clear();
    this._text.clear();
    this._named.clear();
    this._namedBy.clear();
  }

  /** Drop the kept lines; the next look reads every entry again. */
  rereadText() { this._text.clear(); }

  look(where = {}) {
    const log = this._questLog?.() ?? { active: [], ended: [] };
    const read = new Set();
    // AUDIT GUIDE O3/L5: the archive is the journal windows' (the pause tab, the chronicle); no face of the lens reads
    // it, so a look parses none of it
    const rail = questRail({ active: log.active ?? [], finished: [] }, (message, step, row) => {
      const key = entryKey(row, step, message);
      read.add(key);
      if (!this._text.has(key)) this._text.set(key, quietLines(message));
      if (!this._named.has(key)) this._named.set(key, clocksNamed(message));
      return this._text.get(key);
    });
    for (const key of this._text.keys()) if (!read.has(key)) { this._text.delete(key); this._named.delete(key); }

    const walk = new Map((log.active ?? []).map((a) => [String(a.id), a]));
    const quests = rail.active.map((r) => {
      const entries = r.written.map((e, i) => ({
        key: entryKey(r, e.step, e.message),
        stepID: e.step?.stepID ?? null,
        messageID: e.step?.messageID ?? e.message?.id ?? null,
        time: e.step?.time ?? null,
        lines: e.lines,
        // AUDIT GUIDE O3/L5: the latest entry's target alone - every face reads that one (the card, the marks, the
        // compass), and each target asks the host's map; an older entry's is the journal windows' to ask on a click
        target: i === r.written.length - 1 ? entryTarget(e.message, where) : null,
      }));
      const latest = entries[entries.length - 1];
      // AUDIT GUIDE H1: the deadline the quest's own journal names - the tightest running counting clock any entry
      // names. A closing clock (_BRISIEN's _oneday_, A0C01Y09's _shortdelay_) or a letter's arrival is the script's,
      // not the player's: no "Under a day left", no gold. The walk's clockSeconds stays the pause tab's (DEAD-CLOCK).
      // A deadline once told stays told: a later entry that replaces the one that named it does not take it back.
      const named = this._namedBy.get(r.id) ?? new Set();
      for (const e of entries) for (const c of this._named.get(e.key) ?? []) named.add(c);
      this._namedBy.set(r.id, named);
      let clockSeconds = null;
      for (const c of walk.get(String(r.id))?.clocks ?? []) {
        if (named.has(c.name) && Number.isFinite(c.seconds)) clockSeconds = clockSeconds == null ? c.seconds : Math.min(clockSeconds, c.seconds);
      }
      return {
        key: r.key,
        id: r.id,
        name: r.name,
        title: questTitleOf(r.name),
        questName: r.questName,
        main: r.main,
        clockSeconds,
        urgent: clockSeconds != null && clockSeconds < QUEST_URGENT_SECONDS,
        entries,
        latest,
        updatedAt: latest.time,
        target: latest.target,
        // GUIDE4: the target's words, said here once a look, so a face the HUD draws (the tracker) reads them off
        // the view and never imports the lens - the HUD's import graph stays off the quest machine (GUIDE3).
        words: targetWords(latest.target),
      };
    });

    const events = this._last ? this._diff(quests, log.ended ?? []) : [];
    for (const q of quests) this._known.add(q.id);
    const live = new Set(quests.map((q) => q.id));
    for (const id of this._namedBy.keys()) if (!live.has(id)) this._namedBy.delete(id);
    this._last = new Map(quests.map((q) => [q.id, { title: q.title, main: q.main, clockSeconds: q.clockSeconds, newsKeys: q.entries.map((e) => newsKey(q.id, e)) }]));
    return { quests, events };
  }

  _diff(quests, ended) {
    const events = [];
    const now = new Set();
    for (const q of quests) {
      now.add(q.id);
      const was = this._last.get(q.id);
      const base = { id: q.id, title: q.title, main: q.main };
      if (!was && !this._known.has(q.id)) {
        events.push({ type: 'started', ...base });
        continue;
      }
      // A quest the lens has shown, back after a look without entries (a
      // `remove log step` took them all), is news, not a new quest.
      const had = new Set(was?.newsKeys ?? []);
      const fresh = q.entries.filter((e) => !had.has(newsKey(q.id, e))).map((e) => e.key);   // AUDIT GUIDE H4
      if (fresh.length) events.push({ type: 'updated', ...base, entries: fresh });
      if (was?.clockSeconds != null && was.clockSeconds >= QUEST_URGENT_SECONDS && q.urgent) {
        events.push({ type: 'urgent', ...base, clockSeconds: q.clockSeconds });
      }
    }
    const verdicts = new Map(ended.map((e) => [e.id, e]));
    for (const [id, was] of this._last) {
      if (now.has(id)) continue;
      const verdict = verdicts.get(id);
      if (!verdict) continue;   // gone without an ending (a repair, a dropped share): nothing to say
      events.push({ type: verdict.success ? 'completed' : 'ended', id, title: was.title, main: was.main });
      this._known.delete(id);
    }
    return events;
  }
}
