// THE QUEST MACHINE (Q2) - QuestMachine.cs, the engine core. Hosts
// the live quest table, the action-template registry (the brute-force
// GetActionTemplate scan), the scheduled-invoke queue, and the tick:
// invoke scheduled quests, update the active ones, tombstone the
// completed, expire tombstones after one in-game week (604800 classic
// seconds). DFU ticks at 10Hz of REAL time while clocks ride WORLD
// time - the host calls tick() on its own cadence (TICKS_PER_SECOND
// is the law to pace by) and injects the world clock as nowSeconds.
//
// deps (all injectable, every one a routed system):
//   nowSeconds()               - classic game seconds (worldClock)
//   getQuestSourceLines(name)  - quest source by name (the vendored
//                                pack through the host's data seam)
//   showPopup(quest, message)  - the parchment popup (Q4 wires the
//                                real message box; tests capture)
//   changeReputation(factionId, amount) - factionRep (Q4 wires)
//
// The 64 global variables (classic SAVEVARS.DAT state) live here and
// reach tasks through quest.hooks.globalVars.

import { Parser } from './parser.js';
import { setActionFactory } from './task.js';
import { DEFAULT_ACTIONS } from './actions.js';

/** QuestMachine.cs:45 - how often DFU ticks quest logic per second
 *  of real time. The host paces tick() by this. */
export const TICKS_PER_SECOND = 10;
/** DaggerfallDateTime: tombstoned quests expire after one week. */
export const SECONDS_PER_WEEK = 7 * 86400;

export class QuestMachine {
  constructor(deps = {}) {
    this.deps = deps;
    this.quests = new Map();          // uid -> Quest
    this.questsToInvoke = [];
    this.actionTemplates = [];
    this.globalVars = new Map();      // link id -> bool
    this.parser = new Parser();
    for (const A of DEFAULT_ACTIONS) this.registerAction(new A(null));
    // Task construction resolves action lines through the machine's
    // registry from now on (the Q1 pendingActionLines seam narrows to
    // genuinely unregistered actions).
    setActionFactory((line, quest) => {
      const template = this.getActionTemplate(line);
      return template ? template.createNew(line, quest) : null;
    });
  }

  registerAction(actionTemplate) { this.actionTemplates.push(actionTemplate); }

  /** The brute-force scan (QuestMachine.cs:751-763). */
  getActionTemplate(source) {
    for (const action of this.actionTemplates) {
      if (action.test(source)) return action;
    }
    return null;
  }

  /** Parse a quest from source lines and schedule it to start on the
   *  next tick (DFU's InstantiateQuest -> ScheduleQuest shape). */
  scheduleQuest(sourceLines, factionId = 0, { rolls } = {}) {
    const quest = this.parser.parse(sourceLines, factionId, { rolls });
    quest.nowSeconds = () => this.deps.nowSeconds?.() ?? 0;
    quest.hooks = {
      showPopup: (q, message) => this.deps.showPopup?.(q, message),
      changeReputation: (fid, amount) => this.deps.changeReputation?.(fid, amount),
      globalVars: this.globalVars,
    };
    this.questsToInvoke.push(quest);
    return quest;
  }

  /** Schedule by quest name through the data seam. */
  scheduleQuestByName(questName, factionId = 0, opts = {}) {
    const lines = this.deps.getQuestSourceLines?.(questName);
    if (!lines) { console.warn(`[quest] no source for quest ${questName}`); return null; }
    return this.scheduleQuest(lines, factionId, opts);
  }

  getQuest(uid) { return this.quests.get(uid) ?? null; }

  /** One machine tick (QuestMachine.cs Tick). */
  tick() {
    // Invoke scheduled quests
    for (const quest of this.questsToInvoke) {
      try {
        quest.start();
        this.quests.set(quest.uid, quest);
      } catch (e) {
        console.warn(`[quest] QuestMachine failed to start quest ${quest.questName}: ${e?.message ?? e}`);
      }
    }
    this.questsToInvoke.length = 0;

    // Update quests; collect completed for tombstoning and expired for removal
    const questsToTombstone = [], questsToRemove = [];
    for (const quest of this.quests.values()) {
      try {
        if (!quest.questComplete) quest.update();
        if (quest.questComplete && !quest.questTombstoned) questsToTombstone.push(quest);
        if (quest.questTombstoned
          && (this.deps.nowSeconds?.() ?? 0) - quest.questTombstoneTime > SECONDS_PER_WEEK) {
          questsToRemove.push(quest);
        }
      } catch (e) {
        console.warn(`[quest] QuestMachine encountered an exception in quest ${quest.questName}: ${e?.message ?? e}`);
      }
    }

    for (const quest of questsToTombstone) this.tombstoneQuest(quest);
    for (const quest of questsToRemove) this.quests.delete(quest.uid);
  }

  /** Dispose actions, mark tombstoned (site-link scrub rides Q3). */
  tombstoneQuest(quest) {
    for (const task of quest.tasks.values()) task.disposeActions();
    for (const resource of quest.resources.values()) resource.dispose();
    quest.tombstone();
  }
}
