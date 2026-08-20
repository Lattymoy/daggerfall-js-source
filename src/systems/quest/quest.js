// THE QUEST (Q1 structure + Q2 lifecycle) - Quest.cs. Q1: uid, names,
// the three collections with DFU's add semantics (duplicate
// message/resource THROW, duplicate task symbol MERGES actions). Q2:
// the Update loop verbatim - completion wait, ticksToEnd countdown,
// resource Tick, task loop with the questBreak/complete bail and
// pending popups shown between tasks, resource PostTick - plus
// EndQuest's two-tick grace, the 0-9 log steps, ShowMessagePopup's
// oncePerQuest/immediate law, and the tombstone. Q2b grew the click
// lifecycle (ScheduleClickRearm's first-come-first-serve click
// ownership after each task - N0B00Y16), the questor registry
// (AddQuestor/DropQuestor with the Q3-flagged scene-relink halves),
// and the tombstone's talk half (post-quest rumor/questor messages +
// the rumor/topic scrub) through the machine's talk hooks. Popup
// DELIVERY is the machine's showPopup hook (the parchment box wiring
// is Q4) - tokens go to the hook whole, the 22-line chunking belongs
// to that UI. Faction reputation on EndQuest rides the machine's
// changeReputation hook (QuestSuccessRep 5 / QuestFailureRep -2);
// the notebook arm lands with its system (Q4).
//
// `rolls` is the quest's injectable uniform roll (Ledger A engine-
// PRNG rule) - Clock ranges and randompermanent Places draw from it.
// `nowSeconds` is the world-time seam the machine injects (classic
// game seconds) - clocks and log entries read it.

export const QUEST_SUCCESS_REP = 5;     // Quest.cs:36
export const QUEST_FAILURE_REP = -2;    // Quest.cs:37

/** QuestMachine.cs:260-272 - the fixed quest message ids. Defined
 *  here (its only consumer is the tombstone/offer flow) and
 *  re-exported by machine.js under the C# home; importing machine.js
 *  from here would close a machine->parser->quest->machine cycle. */
export const QUEST_MESSAGES = Object.freeze({
  QuestorOffer: 1000,
  RefuseQuest: 1001,
  AcceptQuest: 1002,
  QuestFail: 1003,
  QuestComplete: 1004,
  RumorsDuringQuest: 1005,
  RumorsPostFailure: 1006,
  RumorsPostSuccess: 1007,
  QuestorPostSuccess: 1008,
  QuestorPostFailure: 1009,
});

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
    this.pendingClickRearms = [];            // Quest.cs:48 - resources whose click clears after the current task
    this.questors = new Map();               // Quest.cs:47 - symbol name -> QuestorData { symbol, name }
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
  // Quest.cs GetPerson/GetItem/GetFoe - `as` casts answer null for a
  // wrong-typed resource, so a Foe symbol handed to GetPerson is null.
  getPerson(symbol) { const r = this.getResource(symbol); return r?.isPerson ? r : null; }
  getItem(symbol) { const r = this.getResource(symbol); return r?.isItem ? r : null; }
  getFoe(symbol) { const r = this.getResource(symbol); return r?.isFoe ? r : null; }

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
      // Perform pending click rearms (Quest.cs:330-335): tasks "own" a
      // player click first-come first-serve - N0B00Y16's _merchant_
      // click would otherwise fire a second task in the same tick.
      this._clearPendingClickRearms();
    }

    // Remaining pending messages can survive a task break
    this._showPendingTaskMessages();

    // PostTick resources
    for (const resource of this.resources.values()) resource.postTick(this);
  }

  /** Quest.cs:353-364 - a resource click is consumed by the FIRST
   *  task that handles it; the rearm runs right after that task. */
  scheduleClickRearm(resource) { this.pendingClickRearms.push(resource); }

  _clearPendingClickRearms() {
    for (const resource of this.pendingClickRearms) resource.rearmPlayerClick();
    this.pendingClickRearms.length = 0;
  }

  /** AddQuestor (Quest.cs:450-498): unnamed symbol THROWS, a
   *  duplicate or missing Person warns and returns. The
   *  individual-NPC scene relink half rides Q3 (no scene objects). */
  addQuestor(personSymbol) {
    if (!personSymbol || !personSymbol.name) {
      throw new Error('AddQuestor() must receive a named symbol.');
    }
    if (this.questors.has(personSymbol.name)) {
      console.warn(`[quest] Person ${personSymbol.original} is already a questor for quest ${this.uid} [${this.displayName}]`);
      return;
    }
    const person = this.getPerson(personSymbol);
    if (!person) {
      console.warn(`[quest] Could not find matching Person resource to add questor ${personSymbol.original}`);
      return;
    }
    person.isQuestor = true;
    this.questors.set(personSymbol.name, { symbol: personSymbol.clone(), name: person.displayName });
  }

  /** DropQuestor (Quest.cs:505-524): unnamed symbol THROWS; the
   *  entry is removed but person.isQuestor stays true, as C# leaves
   *  it. The behaviour-destroy half rides Q3. */
  dropQuestor(personSymbol) {
    if (!personSymbol || !personSymbol.name) {
      throw new Error('DropQuestor() must receive a named symbol.');
    }
    this.questors.delete(personSymbol.name);
  }

  /** DropAllQuestors (Quest.cs:529-537), from the tombstone. C#
   *  mints `new Symbol(key)` per key; dropQuestor reads only .name. */
  _dropAllQuestors() {
    for (const key of [...this.questors.keys()]) this.dropQuestor({ name: key });
  }

  endQuest() {
    // Two ticks of grace so tasks started directly before "end quest"
    // still execute (DFU's Sx017 note).
    this.ticksToEnd = 2;
    // Quest.cs:375-379 (Q2b): the quest's PROGRESS rumors and its
    // questor post-quest message leave the talk pool at end - the
    // tombstone later scrubs the "rumor mill" rumors and info topics.
    this.hooks?.removeProgressRumors?.(this.uid);
    this.hooks?.removeQuestorPostMessage?.(this.uid);
    if (this.factionId > 0) {
      const repChange = this.questSuccess ? QUEST_SUCCESS_REP : QUEST_FAILURE_REP;
      this.hooks?.changeReputation?.(this.factionId, repChange);
    }
    // The notebook's finished-quest entry (Quest.cs:388-399) lands
    // with its system (Q4) - routed, not silent.
  }

  tombstone() {
    // Quest.cs TombstoneQuest: tombstoning COMPLETES the quest too, so
    // a directly-tombstoned live quest (error termination) stops
    // updating its disposed actions (AUDIT quest-P4).
    this.questTombstoned = true;
    this.questComplete = true;
    this.questTombstoneTime = this.nowSeconds?.() ?? 0;
    // The talk half (Quest.cs:625-646, Q2b): the post-quest rumor and
    // questor messages by outcome, then this quest's rumors and info
    // topics scrubbed - all through the machine's talk hooks (Q4
    // wires TalkManager; tests capture). Null messages don't post.
    const messageRumors = this.getMessage(this.questSuccess
      ? QUEST_MESSAGES.RumorsPostSuccess : QUEST_MESSAGES.RumorsPostFailure);
    const messageQuestor = this.getMessage(this.questSuccess
      ? QUEST_MESSAGES.QuestorPostSuccess : QUEST_MESSAGES.QuestorPostFailure);
    if (messageRumors) this.hooks?.addProgressRumor?.(this.uid, messageRumors);
    if (messageQuestor) this.hooks?.addQuestorPostMessage?.(this.uid, messageQuestor);
    this.hooks?.removeQuestRumors?.(this.uid);
    this.hooks?.removeQuestInfoTopics?.(this.uid);
    // Q3 FLAG: the quest-residence undiscover sweep (Quest.cs:650-656)
    // rides Place site binding - no Places resolve to buildings yet.
    this._dropAllQuestors();
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
