// ═══════════════════════════════════════════════════════════════════
// FORAGE1 (2026-09-28): QUEST ACTIONS EXTENSION'S FOUR ACTIONS - the ones
// Harbinger451's Foraging quests say (bible/06-Systems/Foraging.md 9.2).
// Quest Actions Extension is Jagget's (2.0.0, github.com/Jagget/
// QuestActionsExtension at 56a407e, Actions/*.cs); nothing of it is
// carried - each class here restates one of its actions' behaviour, cited
// to its file, and Jagget is credited on the About screen beside the mod
// that needs it (Mac: "Your lead").
//
//   raise time by H:MM          RaiseTime.cs           WorldTime.Now.RaiseTime(seconds) - a bare clock advance
//                                                      (online, FORAGE4: the host's wait - the clock is shared)
//   reduce player fatigue by N  ReducePlayerFatigue.cs  N percent of the maximum, the floor 1 (raw x64 values)
//   player possesses N items class C subclass S   PlayerPossesses.cs   an always-on trigger, pack and wagon
//   player handsover N items class C subclass S   PlayerHandsover.cs   removes N, pack first then wagon
//
// `update-quest-item _x_ Leveled` matches no action of QAE's in any
// version (its form is `... set-material <material>`), so DFU drops the
// line; the port's parser already keeps an unmatched line inert
// (task.js pendingActionLines). Nothing here answers it.
//
// FORAGE-FIX Q11: QAE's handsover searches the PACK for the wagon's share
// (`WagonItems = player.Items.SearchItems(...)`), so pack items count
// twice and the wagon's are never taken. The port searches the wagon -
// the one departure here, recorded in FORAGE0 12 and the Port-Ledger.
// ═══════════════════════════════════════════════════════════════════

import { ActionTemplate } from './actions.js';
import { ITEM_GROUPS } from '../../characters/equipRules.js';
import { isSummoned } from '../inventory.js';
import { maxFatigue } from '../statMods.js';
import { raiseTimeSeconds, reduceFatigueBy } from '../foraging/foragingLaw.js';

/** ItemGroups' number -> the port's group name. */
const GROUP_NAME_OF = Object.freeze(Object.fromEntries(Object.entries(ITEM_GROUPS).map(([name, n]) => [n, name])));

/**
 * .NET's unanchored Regex.Match over an alternation: at the leftmost position where any alternative matches, the
 * first alternative that matches there. The patterns here are kept as their alternatives, since a JS pattern may
 * not repeat a group name.
 */
function matchAlternatives(alternatives, source) {
  let best = null;
  alternatives.forEach((re, i) => {
    const m = re.exec(source);
    if (m && (!best || m.index < best.m.index)) best = { m, i };
  });
  return best;
}

/** ItemCollection.SearchItems(group, templateIndex), quest items excluded (the actions' FindAll). */
function searchNonQuest(list, itemClass, itemSubClass) {
  const group = GROUP_NAME_OF[itemClass];
  return (list ?? []).filter((it) => it && it.group === group && it.templateIndex === itemSubClass && !it.questItem);
}
/** Helpers.CalculateLengthOrStackCount: a stack counts its size, anything else 1; a summoned item counts nothing. */
export function lengthOrStackCount(items) {
  let count = 0;
  for (const it of items ?? []) if (!isSummoned(it)) count += (it.stackCount ?? 1) > 1 ? it.stackCount : 1;
  return count;
}
/** Helpers.RemoveNFromList: whole items or stacks, then part of a stack, until `amount` are gone. */
function removeNFromList(storage, items, amount) {
  let removed = 0;
  for (const it of items) {
    if (removed >= amount) break;
    const stack = it.stackCount ?? 1;
    if (stack > 1) {
      if (stack <= amount - removed) {
        const at = storage.indexOf(it);
        if (at >= 0) storage.splice(at, 1);
        removed += stack;
      } else {
        it.stackCount = stack - (amount - removed);
        removed = amount;
      }
    } else {
      const at = storage.indexOf(it);
      if (at >= 0) storage.splice(at, 1);
      removed += 1;
    }
  }
}

/** The player's pack and wagon counts of a class and subclass. */
function heldCounts(entity, itemClass, itemSubClass) {
  const pack = searchNonQuest(entity?.items, itemClass, itemSubClass);
  const wagon = searchNonQuest(entity?.wagonItems, itemClass, itemSubClass);
  return { pack, wagon, inPack: lengthOrStackCount(pack), inWagon: lengthOrStackCount(wagon) };
}

const RAISE_TIME = Object.freeze([
  // RaiseTime.cs's Pattern, alternative by alternative: THREE, not four - the file forgot the `|` between its second
  // and third lines, so its second alternative is `raise time to H:MMraise time by H:MM saying N` and neither a bare
  // `raise time to H:MM` nor `raise time by H:MM saying N` exists on its own (the latter matches as the bare `by`, its
  // saying unread).
  /raise time to (?<hoursTo>\d+):(?<minutesTo>\d+) saying (?<sayingID>\d+)/,
  /raise time to (?<hoursTo>\d+):(?<minutesTo>\d+)raise time by (?<hours>\d+):(?<minutes>\d+) saying (?<sayingID>\d+)/,
  /raise time by (?<hours>\d+):(?<minutes>\d+)/,
]);

/** RaiseTime.cs: `raise time by H:MM` (a bare advance) or `raise time to H:MM` (to that hour, today or tomorrow). */
export class RaiseTime extends ActionTemplate {
  static typeName = 'RaiseTime';
  get saveShape() { return [['hours'], ['minutes'], ['hoursTo'], ['minutesTo'], ['sayingID']]; }
  constructor(parentQuest) {
    super(parentQuest);
    this.hours = 0; this.minutes = 0; this.hoursTo = 0; this.minutesTo = 0; this.sayingID = 0;
  }
  get pattern() { return RAISE_TIME[2]; }
  test(source) { return matchAlternatives(RAISE_TIME, source)?.m ?? null; }
  createNew(source, parentQuest) {
    const m = this.test(source);
    if (!m) return null;
    const g = m.groups ?? {};
    const a = new RaiseTime(parentQuest);
    a.hours = g.hours != null ? Math.max(Number(g.hours), 0) : 0;
    a.minutes = g.minutes != null ? Math.max(Number(g.minutes), 0) : 0;
    a.hoursTo = g.hoursTo != null ? Math.min(Math.max(Number(g.hoursTo), 0), 23) : 0;
    a.minutesTo = g.minutesTo != null ? Math.min(Math.max(Number(g.minutesTo), 0), 59) : 0;
    a.sayingID = g.sayingID != null ? Number(g.sayingID) : 0;
    if (a.hours + a.minutes + a.hoursTo + a.minutesTo === 0) return null;   // CreateNew's own refusal: DFU drops the line
    return a;
  }
  update(_caller) {
    const hooks = this.parentQuest?.hooks;
    let seconds = 0;
    if (this.minutes + this.hours > 0) {
      seconds = raiseTimeSeconds(this.hours, this.minutes);
    } else if (this.minutesTo + this.hoursTo > 0) {
      const now = Math.floor(((hooks?.skySeconds ?? hooks?.nowSeconds)?.() ?? 0) / 60);   // classic minutes: midnight on a whole day - TIME3: the time of day is the sky's
      const current = 60 * (now % 60) + 3600 * (Math.floor(now / 60) % 24);
      const desired = 60 * this.minutesTo + 3600 * this.hoursTo;
      seconds = desired >= current ? desired - current : desired - current + 86400;
    }
    // FORAGE4 (the Ledger A FORAGING row's departure 5): online the shared clock is nobody's to move (WORLD5), so the
    // seconds are the host's WAIT (scenes/foragingWait.js, FORAGE0 13.1); offline the clock moves, as QAE's. MERGE 2
    // (main's LIVED1, "your own time"): online they pass on the character's OWN clock too, after the wait page - the
    // host's raiseTime is the character's time in both lanes (the one clock offline)
    if (seconds > 0) {
      if (hooks?.sharedClock?.()) hooks?.waitOnline?.(seconds, this.parentQuest);
      hooks?.raiseTime?.(seconds);
    }
    if (this.sayingID > 0) this.parentQuest.showMessagePopup(this.sayingID);
    this.setComplete();
  }
}

const REDUCE_FATIGUE = Object.freeze([/reduce player fatigue by (?<percent>\d+)/, /reduce player fatigue on (?<amount>\d+)/]);

/** ReducePlayerFatigue.cs: `by N` is N percent of the maximum, `on N` is N raw; never below 1. */
export class ReducePlayerFatigue extends ActionTemplate {
  static typeName = 'ReducePlayerFatigue';
  get saveShape() { return [['percent'], ['amount']]; }
  constructor(parentQuest) { super(parentQuest); this.percent = 0; this.amount = 0; }
  get pattern() { return REDUCE_FATIGUE[0]; }
  test(source) { return matchAlternatives(REDUCE_FATIGUE, source)?.m ?? null; }
  createNew(source, parentQuest) {
    const m = this.test(source);
    if (!m) return null;
    const a = new ReducePlayerFatigue(parentQuest);
    a.percent = m.groups?.percent != null ? Number(m.groups.percent) : 0;
    a.amount = m.groups?.amount != null ? Number(m.groups.amount) : 0;
    return a;
  }
  update(_caller) {
    const e = this.parentQuest?.hooks?.playerEntity?.();
    if (e) {
      const current = e.fatigue ?? 0;
      let fatigue = 0;
      if (this.percent > 0) fatigue = reduceFatigueBy(current, maxFatigue(e), this.percent);
      if (this.amount > 0) fatigue = current - this.amount;
      e.fatigue = Math.min(maxFatigue(e), Math.max(1, fatigue));   // then CurrentFatigue's setter clamps to the maximum
    }
    this.setComplete();
  }
}

const POSSESSES = /player possesses (?<numberOfItems>\d+) items class (?<itemClass>\d+) subclass (?<itemSubClass>\d+)/;
const HANDSOVER = /player handsover (?<numberOfItems>\d+) items class (?<itemClass>\d+) subclass (?<itemSubClass>\d+)/;
const itemFields = (a, m) => {
  a.numberOfItems = Number(m.groups.numberOfItems);
  a.itemClass = Number(m.groups.itemClass);
  a.itemSubClass = Number(m.groups.itemSubClass);
  return a;
};

/** PlayerPossesses.cs: true while the pack and the wagon together hold N (quest items not counted). */
export class PlayerPossesses extends ActionTemplate {
  static typeName = 'PlayerPossesses';
  get saveShape() { return [['numberOfItems'], ['itemClass'], ['itemSubClass']]; }
  constructor(parentQuest) {
    super(parentQuest);
    this.isTriggerCondition = true;
    this.isAlwaysOnTriggerCondition = true;
    this.numberOfItems = 0; this.itemClass = 0; this.itemSubClass = 0;
  }
  get pattern() { return POSSESSES; }
  createNew(source, parentQuest) {
    const m = this.test(source);
    return m ? itemFields(new PlayerPossesses(parentQuest), m) : null;
  }
  checkTrigger(_caller) {
    const e = this.parentQuest?.hooks?.playerEntity?.();
    if (!e) return false;
    const { inPack, inWagon } = heldCounts(e, this.itemClass, this.itemSubClass);
    return inPack + inWagon >= this.numberOfItems;
  }
}

/** PlayerHandsover.cs: takes N from the pack first and the rest from the wagon; nothing unless all N are held. */
export class PlayerHandsover extends ActionTemplate {
  static typeName = 'PlayerHandsover';
  get saveShape() { return [['numberOfItems'], ['itemClass'], ['itemSubClass']]; }
  constructor(parentQuest) { super(parentQuest); this.numberOfItems = 0; this.itemClass = 0; this.itemSubClass = 0; }
  get pattern() { return HANDSOVER; }
  createNew(source, parentQuest) {
    const m = this.test(source);
    return m ? itemFields(new PlayerHandsover(parentQuest), m) : null;
  }
  update(_caller) {
    const e = this.parentQuest?.hooks?.playerEntity?.();
    if (!e) return;
    const { pack, wagon, inPack, inWagon } = heldCounts(e, this.itemClass, this.itemSubClass);   // Q11: the wagon's own
    if (inPack + inWagon < this.numberOfItems) return;
    const fromPack = Math.min(this.numberOfItems, inPack);
    const fromWagon = this.numberOfItems - fromPack;
    if (fromPack > 0) removeNFromList(e.items, pack, fromPack);
    if (fromWagon > 0) removeNFromList(e.wagonItems, wagon, fromWagon);
    this.setComplete();
  }
}

/** The four, for a quest machine to register (the host does, before any save's quests are restored). */
export const questActionsExtensionTemplates = () => [new RaiseTime(null), new ReducePlayerFatigue(null), new PlayerPossesses(null), new PlayerHandsover(null)];
