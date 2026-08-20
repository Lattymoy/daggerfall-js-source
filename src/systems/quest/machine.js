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
//   onQuestStarted(quest)      - RaiseOnQuestStartedEvent; the
//                                QuestListsManager's one-time
//                                recording listens (Q4 wires)
//
// Q2b-ii, the item tranche's facts and seams (Q4 wires the real
// inventory; tests capture):
//   playerGender()             - 'male' | 'female' (the magic mint)
//   getGuild(factionId)        - { guildGroup, rank, power,
//                                isNonMember } or null (CreateGold)
//   regionPriceAdjustment()    - RegionData[region].PriceAdjustment
//   isPlayerInTown()           - PlayerGPS.IsPlayerInTown(true, true)
//                                (GivePc's notify gate)
//   addGold(amount) / addHUDText(text) - GetItem's gold arm
//   giveItemToPlayer(dfItem, front) - ItemCollection.AddItem
//   removeItemFromPlayer(dfItem)    - ItemCollection.RemoveItem
//   playerHasItem(dfItem)      - Contains(DaggerfallUnityItem)
//   carriesQuestItem(itemResource)  - Contains(Item): uid+symbol
//   releaseQuestItem(questUID, itemResource) - the ReleaseQuestItem-
//                                ForReoffer player-side sweep
//                                (unequip + remove held matches)
//   makeHeldQuestItemsPermanent(questUID, symbol) - MakePermanent's
//                                held-copy sync
//   offerReward(quest, dfItem) - GivePc's QuestComplete loot window
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

  /** The per-quest hook surface over the machine deps. Built BEFORE
   *  the parse since Q2b-ii: the Item mint reads player/guild/region
   *  facts at create time, exactly as DFU parses with the live
   *  world (PlaySound's nowSeconds went through this door first). */
  _buildHooks() {
    return {
      showPopup: (q, message) => this.deps.showPopup?.(q, message),
      showPrompt: (q, message, respond) => this.deps.showPrompt?.(q, message, respond),
      changeReputation: (fid, amount, propagate) => this.deps.changeReputation?.(fid, amount, propagate),
      changeLegalRep: (amount) => this.deps.changeLegalRep?.(amount),
      playerLevel: () => this.deps.playerLevel?.() ?? 0,
      playerGender: () => this.deps.playerGender?.() ?? 'male',
      getGold: () => this.deps.getGold?.() ?? 0,
      deductGold: (amount) => this.deps.deductGold?.(amount),
      addGold: (amount) => this.deps.addGold?.(amount),
      addHUDText: (text) => this.deps.addHUDText?.(text),
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
      // The item-mint facts (Q2b-ii): the guild record for the quest's
      // faction ({ guildGroup, rank, power, isNonMember } or null) and
      // the current region's PriceAdjustment.
      getGuild: (factionId) => this.deps.getGuild?.(factionId) ?? null,
      regionPriceAdjustment: () => this.deps.regionPriceAdjustment?.() ?? 0,
      // The player-inventory seams (Q2b-ii; Q4 wires the real
      // inventory): give/remove take the minted item OBJECT;
      // carriesQuestItem answers ItemCollection.Contains(Item)'s
      // uid+symbol match; playerHasItem answers Contains(dfItem);
      // releaseQuestItem is PlayerEntity.ReleaseQuestItemForReoffer's
      // player-side sweep (unequip + remove every matching held item);
      // makeHeldQuestItemsPermanent syncs MakePermanent over held
      // matches; offerReward opens the QuestComplete loot window.
      giveItemToPlayer: (dfItem, front) => this.deps.giveItemToPlayer?.(dfItem, front),
      removeItemFromPlayer: (dfItem) => this.deps.removeItemFromPlayer?.(dfItem),
      playerHasItem: (dfItem) => this.deps.playerHasItem?.(dfItem) ?? false,
      carriesQuestItem: (itemResource) => this.deps.carriesQuestItem?.(itemResource) ?? false,
      releaseQuestItem: (questUID, itemResource) => this.deps.releaseQuestItem?.(questUID, itemResource),
      makeHeldQuestItemsPermanent: (questUID, symbol) => this.deps.makeHeldQuestItemsPermanent?.(questUID, symbol),
      offerReward: (q, dfItem) => this.deps.offerReward?.(q, dfItem),
      isPlayerInTown: () => this.deps.isPlayerInTown?.() ?? false,
      // StartQuest schedules child quests through the machine's own
      // data seam (QuestListsManager.GetQuest -> ScheduleQuest).
      startQuest: (questName) => this.scheduleQuestByName(questName),
      globalVars: this.globalVars,
    };
  }

  /** Parse a quest from source lines and schedule it to start on the
   *  next tick (DFU's InstantiateQuest -> ScheduleQuest shape).
   *  nowSeconds and hooks ride the PARSE opts - PlaySound's create
   *  stamps the live clock, the Item mint reads the live world. */
  scheduleQuest(sourceLines, factionId = 0, { rolls } = {}) {
    const nowSeconds = () => this.deps.nowSeconds?.() ?? 0;
    const quest = this.parser.parse(sourceLines, factionId,
      { rolls, actionFactory: this._actionFactory, nowSeconds, hooks: this._buildHooks() });
    this.questsToInvoke.push(quest);
    return quest;
  }

  /** Schedule by quest name through the data seam. */
  scheduleQuestByName(questName, factionId = 0, opts = {}) {
    const lines = this.deps.getQuestSourceLines?.(questName);
    if (!lines) { console.warn(`[quest] no source for quest ${questName}`); return null; }
    return this.scheduleQuest(lines, factionId, opts);
  }

  /** ScheduleQuest(quest) - the parsed-quest arm (QuestMachine.cs's
   *  own ScheduleQuest signature): starts on the NEXT tick. The
   *  offer-accept flow schedules here (Q4). */
  scheduleParsedQuest(quest) {
    this.questsToInvoke.push(quest);
    return quest;
  }

  /** StartQuest(quest) (QuestMachine.cs:719-735) - the IMMEDIATE arm:
   *  Start, the talk-topic registration, the live table, then
   *  OnQuestStarted, synchronously; exceptions PROPAGATE to the
   *  caller (the Tick invoke loop wraps its own try). InitAtGameStart
   *  quests come through here, as C#'s do (Q2b-ii VERIFY: the first
   *  draft only scheduled them, so they were absent from the live
   *  table until the next tick). The questor-behaviour relink that
   *  follows in C# is scene work (Q3). */
  startQuestImmediate(quest) {
    quest.start();
    this.deps.addQuestTopics?.(quest);
    this.quests.set(quest.uid, quest);
    this.deps.onQuestStarted?.(quest);
    return quest;
  }

  /** The QuestListsManager's parseQuest dep: parse with THIS
   *  machine's registry, clock and hooks, without scheduling. */
  parseQuestForLists(lines, factionId = 0, { rolls } = {}) {
    const nowSeconds = () => this.deps.nowSeconds?.() ?? 0;
    return this.parser.parse(lines, factionId,
      { rolls, actionFactory: this._actionFactory, nowSeconds, hooks: this._buildHooks() });
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
        this.startQuestImmediate(quest);
        // QUIRK KEPT (QuestMachine.cs:450-451): Tick raises
        // OnQuestStarted AGAIN after StartQuest already raised it -
        // every SCHEDULED quest fires the event twice, and a one-time
        // quest is recorded twice in the lists' accepted array (a
        // Contains gate, so offers are unaffected - but the recorded
        // list is save state). Direct starts raise once.
        this.deps.onQuestStarted?.(quest);
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
