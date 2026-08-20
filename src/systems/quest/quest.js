// THE QUEST CONTAINER (Q1) - Quest.cs, the structure half: uid,
// names, and the three collections (messages by id, tasks and
// resources by symbol name) with DFU's add/get semantics - duplicate
// message ids and resource symbols THROW, a duplicate task symbol
// MERGES its actions into the existing task. The lifecycle half
// (Update loop, questors, log entries, the tombstone) ships with the
// machine (Q2); Person questor tracking rides the Q3 NPC setup.
//
// `rolls` is the quest's injectable uniform roll (Ledger A engine-
// PRNG rule) - Clock ranges and randompermanent Places draw from it.

let _uid = 0;
/** DaggerfallUnity.NextUID - the global allocator. */
export function nextUid() { return ++_uid; }
/** Test seam. */
export function resetUid() { _uid = 0; }

export class Quest {
  constructor({ rolls = Math.random } = {}) {
    this.uid = nextUid();
    this.questName = '';
    this.displayName = '';
    this.factionId = 0;
    this.messages = new Map();     // id -> Message
    this.tasks = new Map();        // symbol name -> Task
    this.resources = new Map();    // symbol name -> QuestResource
    this.rolls = rolls;
    this.travelSeconds = null;     // Q3: Clock flag&16's 2.5x cautious travel time
  }

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
}
