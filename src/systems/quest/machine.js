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
//   nowSeconds()               - world time in DFU year-zero seconds
//                                (DaggerfallDateTime.ToSeconds - the
//                                host injects CLASSIC_EPOCH_IN_SECONDS
//                                + classicMinutes*60 so DailyFrom's
//                                hour-of-day and PlaySound's cadence
//                                read the SAME calendar as DFU's
//                                WorldTime.Now; clocks use deltas, so
//                                the base change is invisible to them)
//   getQuestSourceLines(name)  - quest source by name (the vendored
//                                pack through the host's data seam;
//                                the QuestListsManager stand-in that
//                                StartQuest schedules through)
//   showPopup(quest, message)  - the parchment popup (Q4 wires the
//                                real message box; tests capture)
//   showPrompt(quest, message, respond) - Prompt's yes/no box (Q4
//                                wires; respond(true) = Yes)
//   changeReputation(factionId, amount, propagate) - factionRep's
//                                ChangeReputation (Q4 wires). The
//                                quest lane passes propagate=TRUE
//                                (Quest.cs:385): allies +amount/2,
//                                enemies -amount/2 and the faction-
//                                tree spread per PersistentFactionData
//                                - factionRep.js carries the same
//                                default-false flag, so dropping the
//                                argument silently loses the spread
//                                (Q2b-VERIFY finding)
//   addQuestTopics(quest)      - TalkManager.AddQuestTopicWithInfoAndRumors,
//                                fired between quest.start() and the
//                                live table (Q4 wires; the tombstone's
//                                removeQuestInfoTopics is its scrub)
//   changeLegalRep(amount)     - LegalRepute: current region's
//                                LegalRep += amount then the clamp
//                                (the G2 court system owns both)
//   playerLevel()              - PlayerEntity.Level (LevelCompleted)
//   getGold() / deductGold(n)  - PlayerEntity.GoldPieces (ClickedNpc)
//   playVideo(name)            - "ANIM0013.VID" (Q4 UI)
//   playSound(soundId)         - one-shot; return truthy if it PLAYED
//                                (C# skips while the source is busy,
//                                and only a real play re-stamps
//                                PlaySound's lastTimePlayed)
//   dialogLink(uid, name, type[, name2, type2]) - TalkManager
//                                DialogLinkForQuestInfoResource
//   addDialog(uid, name, type, isSpecial) - AddDialogForQuestInfoResource
//   addQuestRumor(uid, message)          - AddQuestRumorToRumorMill
//   addProgressRumor(uid, message)       - AddOrReplaceQuestProgressRumor
//   addQuestorPostMessage(uid, message)  - AddQuestorPostQuestMessage
//   removeProgressRumors(uid)  - RemoveQuestProgressRumorsFromRumorMill
//   removeQuestorPostMessage(uid) - RemoveQuestorPostQuestMessage
//   removeQuestRumors(uid)     - RemoveQuestRumorsFromRumorMill
//   removeQuestInfoTopics(uid) - RemoveQuestInfoTopicsForSpecificQuest
//   addFace(resource) / dropFace(resource) - the HUD escorting faces
//                                (AddFace/DropFace; Q4 wires)
//
// The 64 global variables (classic SAVEVARS.DAT state) live here and
// reach tasks through quest.hooks.globalVars.

import { Parser } from './parser.js';
import { defaultActionTemplates } from './actions.js';

export { QUEST_MESSAGES } from './quest.js';   // QuestMachine.cs:260's enum, defined leaf-side

/** QuestMachine.cs:45 - how often DFU ticks quest logic per second
 *  of real time. The host paces tick() by this. */
export const TICKS_PER_SECOND = 10;
/** DaggerfallDateTime: tombstoned quests expire after one week. */
export const SECONDS_PER_WEEK = 7 * 86400;
/** QuestMachine.IsProtectedQuest: the main-quest spine never
 *  error-terminates (case-insensitive, as C#). */
export const PROTECTED_QUESTS = Object.freeze(['S0000999', 'S0000977', '_BRISIEN']);
const isProtectedQuest = (quest) => PROTECTED_QUESTS.some((n) => n.toLowerCase() === (quest.questName ?? '').toLowerCase());

export class QuestMachine {
  constructor(deps = {}) {
    this.deps = deps;
    this.quests = new Map();          // uid -> Quest
    this.questsToInvoke = [];
    this.actionTemplates = [];
    this.globalVars = new Map();      // link id -> bool
    this.parser = new Parser();
    for (const template of defaultActionTemplates()) this.registerAction(template);
    // AUDIT quest-2: the action factory travels PER QUEST (parse opt ->
    // quest.actionFactory -> Task), never a module global - two machines
    // can coexist and a machineless parse still pends every line.
    this._actionFactory = (line, quest) => {
      const template = this.getActionTemplate(line);
      return template ? template.createNew(line, quest) : null;
    };
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
   *  next tick (DFU's InstantiateQuest -> ScheduleQuest shape).
   *  nowSeconds rides the PARSE opts because PlaySound's create
   *  stamps lastTimePlayed from the live clock. */
  scheduleQuest(sourceLines, factionId = 0, { rolls } = {}) {
    const nowSeconds = () => this.deps.nowSeconds?.() ?? 0;
    const quest = this.parser.parse(sourceLines, factionId,
      { rolls, actionFactory: this._actionFactory, nowSeconds });
    quest.hooks = {
      showPopup: (q, message) => this.deps.showPopup?.(q, message),
      showPrompt: (q, message, respond) => this.deps.showPrompt?.(q, message, respond),
      changeReputation: (fid, amount, propagate) => this.deps.changeReputation?.(fid, amount, propagate),
      changeLegalRep: (amount) => this.deps.changeLegalRep?.(amount),
      playerLevel: () => this.deps.playerLevel?.() ?? 0,
      getGold: () => this.deps.getGold?.() ?? 0,
      deductGold: (amount) => this.deps.deductGold?.(amount),
      playVideo: (name) => this.deps.playVideo?.(name),
      playSound: (soundId) => this.deps.playSound?.(soundId),
      dialogLink: (...args) => this.deps.dialogLink?.(...args),
      addDialog: (...args) => this.deps.addDialog?.(...args),
      addQuestRumor: (uid, message) => this.deps.addQuestRumor?.(uid, message),
      addProgressRumor: (uid, message) => this.deps.addProgressRumor?.(uid, message),
      addQuestorPostMessage: (uid, message) => this.deps.addQuestorPostMessage?.(uid, message),
      removeProgressRumors: (uid) => this.deps.removeProgressRumors?.(uid),
      removeQuestorPostMessage: (uid) => this.deps.removeQuestorPostMessage?.(uid),
      removeQuestRumors: (uid) => this.deps.removeQuestRumors?.(uid),
      removeQuestInfoTopics: (uid) => this.deps.removeQuestInfoTopics?.(uid),
      addFace: (resource) => this.deps.addFace?.(resource),
      dropFace: (resource) => this.deps.dropFace?.(resource),
      // StartQuest schedules child quests through the machine's own
      // data seam (QuestListsManager.GetQuest -> ScheduleQuest).
      startQuest: (questName) => this.scheduleQuestByName(questName),
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
    // Invoke scheduled quests (QuestMachine.cs StartQuest:719-725):
    // Start, then the talk-topic registration, then the live table.
    // The questor-behaviour relink that follows in C# is scene work
    // (Q3). Q2b-VERIFY: the addQuestTopics half was silently absent
    // while its tombstone-side removal was wired - the scrub would
    // have deleted topics no one ever added.
    for (const quest of this.questsToInvoke) {
      try {
        quest.start();
        this.deps.addQuestTopics?.(quest);
        this.quests.set(quest.uid, quest);
      } catch (e) {
        console.warn(`[quest] QuestMachine failed to start quest ${quest.questName}: ${e?.message ?? e}`);
      }
    }
    this.questsToInvoke.length = 0;

    // Update quests; collect completed for tombstoning and expired or
    // faulting for removal. AUDIT quest-P3: an exception in a quest's
    // update ERROR-TERMINATES it unless the quest is protected (the
    // main-quest spine) - C# removes faulting quests rather than
    // letting them throw every tick forever. Q2b-VERIFY: the catch
    // only COLLECTS (QuestMachine.cs:486) - the faulting quest is
    // tombstoned by removeQuest AFTER every other quest's update and
    // after the regular tombstone pass, so its tombstone talk hooks
    // fire in C#'s order. The tombstone/expiry checks sit OUTSIDE the
    // try, as in C#.
    const questsToTombstone = [], questsToRemove = [];
    for (const quest of this.quests.values()) {
      try {
        if (!quest.questComplete) quest.update();
      } catch (e) {
        console.warn(`[quest] QuestMachine encountered an exception in quest ${quest.questName}: ${e?.message ?? e}`);
        if (!isProtectedQuest(quest)) questsToRemove.push(quest);
      }
      if (quest.questComplete && !quest.questTombstoned) questsToTombstone.push(quest);
      if (quest.questTombstoned
        && (this.deps.nowSeconds?.() ?? 0) - quest.questTombstoneTime > SECONDS_PER_WEEK) {
        questsToRemove.push(quest);
      }
    }

    for (const quest of questsToTombstone) this.tombstoneQuest(quest);
    for (const quest of questsToRemove) this.removeQuest(quest);
  }

  /** Dispose resources then task actions (Quest.cs Dispose order,
   *  AUDIT quest-P5), mark tombstoned (site-link scrub rides Q3). */
  tombstoneQuest(quest) {
    for (const resource of quest.resources.values()) resource.dispose();
    for (const task of quest.tasks.values()) task.disposeActions();
    quest.tombstone();
  }

  /** RemoveQuest (QuestMachine.cs): tombstones first if the quest is
   *  not already - the error-termination path lands here - then drops
   *  it from the live table. */
  removeQuest(quest) {
    if (!quest) return false;
    if (!quest.questTombstoned) this.tombstoneQuest(quest);
    this.quests.delete(quest.uid);
    return true;
  }
}
