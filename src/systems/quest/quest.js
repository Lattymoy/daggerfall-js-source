// THE QUEST (Q1 structure + Q2 lifecycle) - Quest.cs. Q1: uid, names,
// the three collections with DFU's add semantics (duplicate
// message/resource THROW, duplicate task symbol MERGES actions). Q2:
// the Update loop verbatim - completion wait, ticksToEnd countdown,
// resource Tick, task loop with the questBreak/complete bail and
// pending popups shown between tasks, resource PostTick - plus
// EndQuest's two-tick grace, the 0-9 log steps, ShowMessagePopup's
// oncePerQuest/immediate law, and the tombstone. The click-rearm
// scheduling rides Q3 (no clicks exist yet); popup DELIVERY is the
// machine's showPopup hook (the parchment box wiring is Q4) - tokens
// go to the hook whole, the 22-line chunking belongs to that UI.
// Faction reputation on EndQuest rides the machine's changeReputation
// hook (QuestSuccessRep 5 / QuestFailureRep -2); the talk-manager
// rumor scrub and notebook arms land with their systems (Q4).
//
// `rolls` is the quest's injectable uniform roll (Ledger A engine-
// PRNG rule) - Clock ranges and randompermanent Places draw from it.
// `nowSeconds` is the world-time seam the machine injects (classic
// game seconds) - clocks and log entries read it.

export const QUEST_SUCCESS_REP = 5;     // Quest.cs:36
export const QUEST_FAILURE_REP = -2;    // Quest.cs:37

let _uid = 0;
/** DaggerfallUnity.NextUID - the global allocator. */
export function nextUid() { return ++_uid; }
/** Test seam. */
export function resetUid() { _uid = 0; }

export class Quest {
  constructor({ rolls = Math.random, nowSeconds = null, hooks = null, actionFactory = null } = {}) {
    this.uid = nextUid();
    this.questName = '';
    this.displayName = '';
    this.factionId = 0;
    this.messages = new Map();     // id -> Message
    this.tasks = new Map();        // symbol name -> Task
    this.resources = new Map();    // symbol name -> QuestResource
    this.rolls = rolls;
    this.nowSeconds = nowSeconds;  // () => classic game seconds (machine-injected)
    this.hooks = hooks;            // machine hooks: showPopup/changeReputation/log
    this.actionFactory = actionFactory;   // (line, quest) -> action | null (the machine's registry)
    this.travelSeconds = null;     // Q3: Clock flag&16's 2.5x cautious travel time
    this.travelSecondsTo = null;   // Q3: Clock _2place_ one-way trip

    // Q2 lifecycle state
    this.questComplete = false;
    this.questSuccess = false;
    this.questBreak = false;
    this.questTombstoned = false;
    this.questTombstoneTime = 0;
    this.questStartTime = 0;
    this.ticksToEnd = 0;
    this.activeLogMessages = new Map();      // stepID -> { stepID, messageID, time }
    this.oneTimeDisplayedMessages = new Set();
    this.pendingPopups = [];                 // the pendingMessageBoxStack, hook-delivered
  }

  // ---- Q1 structure ----

  addMessage(messageID, message) {
    if (this.messages.has(messageID)) throw new Error(`Duplicate message id: ${messageID}`);   // Dictionary.Add
    this.messages.set(messageID, message);
  }

  addResource(resource) {
    if (!resource.symbol || !resource.symbol.name) {
      throw new Error('QuestResource must have a named symbol.');
    }
    if (this.resources.has(resource.symbol.name)) {
      throw new Error(`Duplicate QuestResource symbol name found: ${resource.symbol.original}`);
    }
    this.resources.set(resource.symbol.name, resource);
  }

  addTask(task) {
    const existing = this.tasks.get(task.symbol.name);
    if (!existing) this.tasks.set(task.symbol.name, task);
    else existing.copyQuestActions(task);   // duplicate symbol: merge actions in
  }

  getMessage(messageID) { return this.messages.get(messageID) ?? null; }
  getTask(symbol) { return (symbol && this.tasks.get(symbol.name)) ?? null; }
  getResource(symbol) { return (symbol && this.resources.get(symbol.name)) ?? null; }
  getClock(symbol) { const r = this.getResource(symbol); return r?.isClock ? r : null; }
  getPlace(symbol) { const r = this.getResource(symbol); return r?.isPlace ? r : null; }

  // ---- Q2 lifecycle (Quest.cs:280-600) ----

  start() {
    this.questStartTime = this.nowSeconds?.() ?? 0;
  }

  update() {
    // Complete: waiting to be tombstoned by the machine
    if (this.questComplete) return;

    // Countdown ticks to end (EndQuest's two-tick grace)
    if (this.ticksToEnd > 0) {
      if (--this.ticksToEnd === 0) this.questComplete = true;
    }

    // Tick resources
    for (const resource of this.resources.values()) resource.tick(this);

    // Update tasks
    for (const task of this.tasks.values()) {
      if (task.dropped) continue;   // hard ignore
      // Handle quest break or completion from previous task
      if (this.questBreak || this.questComplete) {
        this.questBreak = false;
        return;
      }
      task.update();
      this._showPendingTaskMessages();
    }

    // Remaining pending messages can survive a task break
    this._showPendingTaskMessages();

    // PostTick resources
    for (const resource of this.resources.values()) resource.postTick(this);
  }

  endQuest() {
    // Two ticks of grace so tasks started directly before "end quest"
    // still execute (DFU's Sx017 note).
    this.ticksToEnd = 2;
    if (this.factionId > 0) {
      const repChange = this.questSuccess ? QUEST_SUCCESS_REP : QUEST_FAILURE_REP;
      this.hooks?.changeReputation?.(this.factionId, repChange);
    }
    // The talk-manager rumor scrub and the notebook's finished-quest
    // entry land with their systems (Q4) - routed, not silent.
  }

  tombstone() {
    // Quest.cs TombstoneQuest: tombstoning COMPLETES the quest too, so
    // a directly-tombstoned live quest (error termination) stops
    // updating its disposed actions (AUDIT quest-P4).
    this.questTombstoned = true;
    this.questComplete = true;
    this.questTombstoneTime = this.nowSeconds?.() ?? 0;
  }

  startTask(symbol) { this.getTask(symbol)?.start(); }
  clearTask(symbol) { this.getTask(symbol)?.clear(); }

  /** Quests have log steps 0-9; adding an existing step replaces it. */
  addLogStep(stepID, messageID) {
    this.activeLogMessages.set(stepID, { stepID, messageID, time: this.nowSeconds?.() ?? 0 });
  }

  removeLogStep(stepID) { this.activeLogMessages.delete(stepID); }

  /** LogEntry array, or null once the quest completed. */
  getLogMessages() {
    if (this.questComplete) return null;
    return [...this.activeLogMessages.values()];
  }

  /** Queue a message popup; immediate breaks quest execution to show
   *  it now, oncePerQuest suppresses repeats (the Say action opts in). */
  showMessagePopup(id, immediate = false, oncePerQuest = false) {
    const message = this.getMessage(id);
    if (!message) return;
    // C# returns before queueing (and before recording oncePerQuest)
    // when the message has no tokens (AUDIT quest-P8).
    if (!message.variants.some((v) => v.tokens.length)) return;
    if (oncePerQuest && this.oneTimeDisplayedMessages.has(id)) return;
    this.pendingPopups.push(message);
    if (oncePerQuest) this.oneTimeDisplayedMessages.add(id);
    if (immediate) {
      this.questBreak = true;
      this._showPendingTaskMessages();
    }
  }

  _showPendingTaskMessages() {
    while (this.pendingPopups.length) {
      const message = this.pendingPopups.pop();   // a STACK, as DFU pushes/pops
      this.hooks?.showPopup?.(this, message);
    }
  }
}
