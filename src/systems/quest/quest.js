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

import { travelTimeSeconds } from './clock.js';
import { Message, Formatting } from './message.js';
import { symbolToSaveData, symbolFromSaveData } from './symbol.js';
import { smallerDungeonsStateNow } from '../../world/smallerDungeons.js';   // AUDIT 28 W4: Quest.cs:284's stamp

/** ShowMessagePopup's chunker (Quest.cs:777, 793-819): a message
 *  longer than 22 LINES becomes several click-through boxes. A line
 *  is any token whose formatting is JustifyCenter, JustifyLeft or
 *  Nothing; the counter resets per chunk. C#'s `++lineCount > 22`
 *  means the break lands on the TWENTY-THIRD line, which therefore
 *  opens the next chunk having already been added to the previous one
 *  - so a chunk holds 23 counted lines, not 22. Kept verbatim.
 *  The final chunk is added only when it is non-empty. */
export function chunkMessageTokens(tokens, chunkSize = 22) {
  const chunks = [];
  let currentChunk = [];
  let lineCount = 0;
  for (const token of tokens) {
    currentChunk.push(token);
    // C# also counts JustifyLeft. The port's quest-message layer never
    // mints one - loadMessage produces exactly Nothing / Text /
    // JustifyCenter (message.js:22-26) - and Formatting has no such
    // member, so naming it here would compare against `undefined` and
    // count every token that carries no formatting at all.
    if (token.formatting === Formatting.JustifyCenter
      || token.formatting === Formatting.Nothing) {
      if (++lineCount > chunkSize) {
        chunks.push(currentChunk);
        currentChunk = [];
        lineCount = 0;
      }
    }
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);
  return chunks;
}

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
/** The allocator advances past restored uids (Q4-iv): C# persists
 *  its global NextUID; the port derives it from what it loads. */
export function ensureUidAtLeast(uid) { if (uid > _uid) _uid = uid; }
/** Test seam. */
export function resetUid() { _uid = 0; }

export class Quest {
  constructor({ rolls = Math.random, nowSeconds = null, hooks = null, actionFactory = null } = {}) {
    this.uid = nextUid();
    this.questName = '';
    // AUDIT 24 (wave 26): NULL, because Quest.cs:56 is a bare
    // `string displayName;` with no initialiser and the property at
    // :156-160 is a plain passthrough - so DisplayName is null until
    // Parser.cs:86-89 assigns it, and only a source with a
    // `displayname:` line ever gets one.
    //
    // DFU LEANS ON THAT NULL. DaggerfallGuildServicePopupWindow.cs:640
    // labels each picker row `displayName ?? quest.QuestName`, and
    // Parser.cs:152 tests `string.IsNullOrEmpty(quest.DisplayName)`.
    // The port's `''` made `?? questName` dead code - `'' ?? x` is
    // `''` - so a quest without a header would have offered a BLANK
    // row. 28 of the 265 corpus quests carry no `displayname:`.
    //
    // questName above stays `''` deliberately: C# declares it the same
    // way, but Parser THROWS on a quest with no name, so the default is
    // unreachable and a null there would only add `?? ''` noise to the
    // dozen template literals that print it.
    this.displayName = null;
    this.factionId = 0;
    this.messages = new Map();     // id -> Message
    this.tasks = new Map();        // symbol name -> Task
    this.resources = new Map();    // symbol name -> QuestResource
    this.rolls = rolls;
    this.nowSeconds = nowSeconds;  // () => classic game seconds (machine-injected)
    this.hooks = hooks;            // machine hooks: showPopup/changeReputation/log
    this.actionFactory = actionFactory;   // (line, quest) -> action | null (the machine's registry)
    // Q3-i: Clock's travel arms over the world seam - flag&16's 2.5x
    // cautious ALL-places trip and _2place_'s one-way. null with no
    // world (headless), so the clock's HELD arm still pends loudly.
    this.travelSeconds = () => (this.hooks?.world ? travelTimeSeconds(this) : null);
    this.travelSecondsTo = (place) => (this.hooks?.world ? travelTimeSeconds(this, place, false) : null);

    // Q2 lifecycle state
    this.questComplete = false;
    this.questSuccess = false;
    this.questBreak = false;
    this.questTombstoned = false;
    this.questTombstoneTime = 0;
    this.questStartTime = 0;
    this.smallerDungeonsState = 0;   // AUDIT 28 W4: QuestSmallerDungeonsState.NotSet until Start() stamps it (Quest.cs:64)
    this.ticksToEnd = 0;
    this.activeLogMessages = new Map();      // stepID -> { stepID, messageID, time }
    this.oneTimeDisplayedMessages = new Set();
    // Q4-i macro context (Quest.cs/QuestMCP)
    this.lastResourceReferenced = null;   // pronouns/%vcn read it
    this.lastPlaceReferenced = null;      // %di reads it (the NRE quirk lives there)
    this.externalMCP = null;              // the offer/talk window's second provider (Q4-ii)
    this.currentLogMessageId = -1;        // the journal sets it while rendering (%qdt)
    this.pendingPopups = [];                 // the pendingMessageBoxStack, hook-delivered
    this.pendingClickRearms = [];            // Quest.cs:48 - resources whose click clears after the current task
    this.questors = new Map();               // Quest.cs:47 - symbol name -> QuestorData { symbol, name }
    this.oneTime = false;                    // Quest.OneTime - QuestListsManager stamps it at load (Q2b-ii)
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
    // Quest.cs:879-881 - an incoming Person already flagged questor
    // auto-tracks. Dead until Q3's SetupQuestorNPC mints isQuestor at
    // create for "group Questor" persons (Q2b-VERIFY: the omission
    // was silent and would have starved the questor registry then).
    if (resource.isPerson && resource.isQuestor) this.addQuestor(resource.symbol);
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

  /** GetQuestors (Quest.cs:756-765): the questor SYMBOLS, in Map
   *  order. ActiveQuestor walks these to find the Person a clicked
   *  StaticNPC is the questor for. */
  getQuestors() { return [...this.questors.values()].map((q) => q.symbol); }
  getItem(symbol) { const r = this.getResource(symbol); return r?.isItem ? r : null; }
  getFoe(symbol) { const r = this.getResource(symbol); return r?.isFoe ? r : null; }

  // ---- Q2 lifecycle (Quest.cs:280-600) ----

  start() {
    this.questStartTime = this.nowSeconds?.() ?? 0;
    // AUDIT 28 W4 (Quest.cs:284): the SmallerDungeons setting AS OF the
    // quest's start, frozen in - marker assignments are not relocated
    // when the setting flips, so the dungeon a quest points at keeps
    // the size the quest compiled with.
    this.smallerDungeonsState = smallerDungeonsStateNow();
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
      // `${null}` is the string "null" in JS where string.Format
      // (Quest.cs:459) renders a null argument as EMPTY - so the ?? ''
      // is what keeps this line 1:1 now that displayName can be null.
      console.warn(`[quest] Person ${personSymbol.original} is already a questor for quest ${this.uid} [${this.displayName ?? ''}]`);
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
      // Quest.cs:385 passes propagate=TRUE - the ally/enemy/tree
      // spread, not the flat write (Q2b-VERIFY: the flag was dropped).
      this.hooks?.changeReputation?.(this.factionId, repChange, true);
    }
    // The notebook's finished-quest entry (Quest.cs:388-399, Q4-iv):
    // the ACTIVE log's messages file to the notebook through the
    // machine's hook - resolved here exactly as C# resolves them,
    // and only when the log holds any.
    const logEntries = this.getLogMessages();
    if (logEntries && logEntries.length > 0) {
      const questMessages = [];
      for (const logEntry of logEntries) {
        const message = this.getMessage(logEntry.messageID);
        if (message) questMessages.push(message);
      }
      this.hooks?.addFinishedQuest?.(questMessages);
    }
  }

  /** GetCurrentLogMessageTime (Quest.cs:606-615): the time of the
   *  log entry the journal is rendering, else the quest start. */
  getCurrentLogMessageTime() {
    for (const log of this.activeLogMessages.values()) {
      if (log.messageID === this.currentLogMessageId && log.time != null) return log.time;
    }
    return this.questStartTime;
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
    if (!message) return null;
    // AUDIT 24 (wave 21): Quest.cs:785 reads the tokens HERE, at queue
    // time, and it is that array the boxes carry. The port pushed the
    // Message object and let the host read tokens at POP time, which
    // moved three things: the variant draw (so quest.rolls came out in
    // a different order), the macro expansion (so %qdt, the clicked
    // NPC, lastResourceReferenced and friends answered with whatever
    // the state was when the box finally opened, not when the task
    // said to show it) and the dialog reveal that rides it.
    const tokens = message.getTextTokens(-1, this.rolls);
    // C# returns before queueing (and before recording oncePerQuest)
    // when the message has no tokens (AUDIT quest-P8). Note WHICH
    // tokens: the chosen variant's, expanded - not "some variant has
    // raw tokens", which is what the port asked.
    if (!tokens || tokens.length === 0) return null;
    if (oncePerQuest && this.oneTimeDisplayedMessages.has(id)) return null;
    for (const chunk of chunkMessageTokens(tokens)) this.pendingPopups.push(chunk);
    if (oncePerQuest) this.oneTimeDisplayedMessages.add(id);
    if (immediate) {
      this.questBreak = true;
      this._showPendingTaskMessages();
      return null;
    }
    return this.pendingPopups[this.pendingPopups.length - 1] ?? null;   // Peek
  }

  _showPendingTaskMessages() {
    while (this.pendingPopups.length) {
      const tokens = this.pendingPopups.pop();   // a STACK, as DFU pushes/pops
      // Each pop is a DaggerfallMessageBox.Show(), i.e. a
      // uiManager.PushWindow - so the host must STACK these, newest in
      // front. The double reversal (push 0..n, pop n..0, each landing
      // on top) is what puts chunk 0 of the FIRST-queued message in
      // front of the player.
      this.hooks?.showPopup?.(this, tokens);
    }
  }

  // ---- the save envelope (Q4-iv; Quest.cs:899-1046) ----

  /** GetSaveData: the C# field set. The port's clock is SECONDS (THE
   *  PORT'S CLOCK IS A SCALAR, Ledger A) where C# carries
   *  DaggerfallDateTime objects; the smaller-dungeons setting and the compile version have no port
   *  counterparts and serialize at their defaults (recorded).
   *  Questors flatten the Map to {name, symbol, displayName} rows -
   *  the Dictionary<string, QuestorData> shape in plain data. */
  getSaveData() {
    return {
      uid: this.uid,
      questComplete: this.questComplete,
      questSuccess: this.questSuccess,
      questName: this.questName,
      displayName: this.displayName,
      factionId: this.factionId,
      questStartTime: this.questStartTime,
      questTombstoned: this.questTombstoned,
      questTombstoneTime: this.questTombstoneTime,
      smallerDungeonsState: this.smallerDungeonsState ?? 0,   // AUDIT 28 W4: the frozen state, saved (Quest.cs:912)
      compiledByVersion: '',
      activeLogMessages: [...this.activeLogMessages.values()].map((e) => ({ ...e })),
      messages: [...this.messages.values()].map((m) => m.getSaveData()),
      resources: [...this.resources.values()].map((r) => r.getResourceSaveData()),
      questors: [...this.questors.entries()].map(([name, q]) => ({ name, symbol: symbolToSaveData(q.symbol), displayName: q.name })),
      tasks: [...this.tasks.values()].map((t) => t.getSaveData()),
      oneTimeDisplayedMessages: [...this.oneTimeDisplayedMessages],
    };
  }

  /** RestoreSaveData (Quest.cs:978-1046): C#'s clear-and-reconstruct
   *  order with the resource/task/action ctors riding the machine's
   *  resolvers (C#'s reflection ctor walk). The localized-message
   *  re-restore is localization infra with no port counterpart. NOT
   *  restored, exactly as C# leaves them: currentLogMessageId,
   *  lastResourceReferenced/lastPlaceReferenced, externalMCP - the
   *  journal's %qdt context falls to quest start after a load until
   *  the next log step lands. */
  restoreSaveData(data, resolvers = {}) {
    this.uid = data.uid;
    ensureUidAtLeast(data.uid);
    this.questComplete = data.questComplete;
    this.questSuccess = data.questSuccess;
    this.questName = data.questName;
    this.displayName = data.displayName ?? null;   // an older envelope has no field; C# deserialises to null
    this.factionId = data.factionId;
    this.questStartTime = data.questStartTime;
    this.questTombstoned = data.questTombstoned;
    this.questTombstoneTime = data.questTombstoneTime;
    this.smallerDungeonsState = data.smallerDungeonsState ?? 0;   // AUDIT 28 W4: the frozen state, restored (NotSet on an older envelope)
    this.activeLogMessages.clear();
    for (const logEntry of data.activeLogMessages) {
      this.activeLogMessages.set(logEntry.stepID, { ...logEntry });
    }
    this.messages.clear();
    for (const messageData of data.messages) {
      const message = new Message(this);
      message.restoreSaveData(messageData);
      this.messages.set(message.id, message);
    }
    this.resources.clear();
    for (const resourceData of data.resources) {
      const ResourceCtor = resolvers.resolveResourceType?.(resourceData.type);
      if (!ResourceCtor) throw new Error(`Could not restore resource type ${resourceData.type}`);
      const resource = new ResourceCtor(this);
      resource.restoreResourceSaveData(resourceData);
      this.resources.set(resource.symbol.name, resource);
    }
    this.questors.clear();
    for (const q of data.questors ?? []) {
      this.questors.set(q.name, { symbol: symbolFromSaveData(q.symbol), name: q.displayName });
    }
    this.tasks.clear();
    for (const taskData of data.tasks) {
      const task = new resolvers.Task(this);
      task.restoreSaveData(taskData, resolvers.resolveActionType);
      this.tasks.set(task.symbol.name, task);
    }
    this.oneTimeDisplayedMessages.clear();
    for (const id of data.oneTimeDisplayedMessages ?? []) this.oneTimeDisplayedMessages.add(id);
  }

}
