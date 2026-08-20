// THE QUEST ACTIONS (Q2, first tranche) - QuestAction.cs's
// ActionTemplate base + the ten world-free actions from Actions/*.cs,
// each 1:1 with its DFU source named. Actions are objects with a
// LIFETIME, not one-shot executions: a template registry tests each
// task line against every action's Pattern (QuestMachine
// GetActionTemplate's brute-force scan) and factories a new instance
// on match; SetComplete stops re-execution until a rearm; a trigger
// condition starts its task, an ALWAYS-ON trigger keeps being checked
// every tick (the primary/secondary law lives in task.update).
//
// The tranche: StartTask, ClearTask, UnsetTask, EndQuest, WhenTask,
// StartStopTimer, Say, LogMessage, RemoveLogMessage, PickOneOf.
// PickOneOf's UnityEngine.Random draw rides the quest's injectable
// roll (Ledger A; DFU reseeds from QuestMachine.InternalSeed, which
// is its own System.Random - a per-machine stream either way). The
// remaining 73 actions land in coverage-ordered slices: world/click/
// item/foe actions with their Q3 bindings, UI actions (Prompt) at Q4.

import { Symbol as QuestSymbol } from './symbol.js';
import { parseInt as questParseInt } from './parseUtils.js';
import { staticMessagesTable } from './tables.js';

export class ActionTemplate {
  constructor(parentQuest) {
    this.parentQuest = parentQuest;
    this.isComplete = false;
    this.isTriggerCondition = false;
    this.isAlwaysOnTriggerCondition = false;
    this.debugSource = '';
    this.allowRearm = true;
  }

  /** The Regex the registry tests lines against; set by subclass. */
  get pattern() { return null; }

  test(source) { return this.pattern.exec(source); }

  initialiseOnSet() {}
  update(_caller) {}
  checkTrigger(_caller) { return false; }
  setComplete() { this.isComplete = true; }
  rearmAction() { if (this.isComplete && this.allowRearm) this.isComplete = false; }
  dispose() {}
}

/** StartTask.cs: "start task X" / "setvar X". */
export class StartTask extends ActionTemplate {
  get pattern() { return /start task (?<taskName>[a-zA-Z0-9_.]+)|setvar (?<setvarName>[a-zA-Z0-9_.]+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new StartTask(parentQuest);
    action.taskSymbol = new QuestSymbol(match.groups.taskName ?? match.groups.setvarName);
    return action;
  }
  update(_caller) {
    this.parentQuest.startTask(this.taskSymbol);
    this.setComplete();
  }
}

/** ClearTask.cs: "clear A B C..." - every named task un-triggers. */
export class ClearTask extends ActionTemplate {
  get pattern() { return /clear [a-zA-Z0-9_.]+/; }
  createNew(source, parentQuest) {
    if (!this.test(source)) return null;
    const action = new ClearTask(parentQuest);
    action.taskSymbols = source.trimEnd().split(/\s+/).slice(1).map((t) => new QuestSymbol(t));
    return action;
  }
  update(_caller) {
    this.setComplete();
    for (const s of this.taskSymbols) this.parentQuest.getTask(s)?.clear();
  }
}

/** UnsetTask.cs: "unset A B..." - permanently DROPS the tasks. */
export class UnsetTask extends ActionTemplate {
  get pattern() { return /unset [a-zA-Z0-9_.]+/; }
  createNew(source, parentQuest) {
    if (!this.test(source)) return null;
    const action = new UnsetTask(parentQuest);
    action.taskSymbols = source.trimEnd().split(/\s+/).slice(1).map((t) => new QuestSymbol(t));
    return action;
  }
  update(_caller) {
    this.setComplete();
    for (const s of this.taskSymbols) this.parentQuest.getTask(s)?.drop();
  }
}

/** EndQuest.cs: "end quest [saying N]" - questBreak + the two-tick end. */
export class EndQuest extends ActionTemplate {
  constructor(parentQuest) { super(parentQuest); this.allowRearm = false; }
  get pattern() { return /end quest saying (?<id>\d+)|end quest/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new EndQuest(parentQuest);
    action.textId = questParseInt(match.groups?.id ?? '');
    return action;
  }
  update(_caller) {
    if (this.textId !== 0) this.parentQuest.showMessagePopup(this.textId);
    this.parentQuest.questBreak = true;
    this.parentQuest.endQuest();
    this.setComplete();
  }
}

/** WhenTask.cs: the when/and/or (not) trigger over task states -
 *  always-on, evaluated left to right with DFU's exact
 *  short-circuits. An unknown task name reads FALSE, loudly. */
export class WhenTask extends ActionTemplate {
  constructor(parentQuest) {
    super(parentQuest);
    this.isTriggerCondition = true;
    this.isAlwaysOnTriggerCondition = true;
    this.evaluations = [];
  }
  get pattern() { return /when not (?<notName>[a-zA-Z0-9_.]+)|when (?<taskName>[a-zA-Z0-9_.]+)/; }
  createNew(source, parentQuest) {
    const FULL = /when not (?<n1>[a-zA-Z0-9_.]+)|when (?<n2>[a-zA-Z0-9_.]+)|and not (?<n3>[a-zA-Z0-9_.]+)|and (?<n4>[a-zA-Z0-9_.]+)|or not (?<n5>[a-zA-Z0-9_.]+)|or (?<n6>[a-zA-Z0-9_.]+)/g;
    const matches = [...source.matchAll(FULL)];
    if (!matches.length) return null;
    const condition = new WhenTask(parentQuest);
    for (const m of matches) {
      const g = m.groups;
      const task = g.n1 ?? g.n2 ?? g.n3 ?? g.n4 ?? g.n5 ?? g.n6;
      const v = m[0];
      let op;
      if (v.includes('when not')) op = 'whenNot';
      else if (v.includes('and not')) op = 'andNot';
      else if (v.includes('or not')) op = 'orNot';
      else if (v.includes('when')) op = 'when';
      else if (v.includes('and')) op = 'and';
      else if (v.includes('or')) op = 'or';
      else throw new Error('Operator not found in WhenTask condition.');
      condition.evaluations.push({ op, task });
    }
    return condition;
  }
  checkTrigger(_caller) { return this._checkEvals(); }
  _isTaskSet(symbol) {
    const task = this.parentQuest.getTask(symbol);
    if (!task) { console.warn(`[quest] Task/Variable not found '${symbol.name}'`); return false; }
    return task.getTriggerValue();
  }
  _checkEvals() {
    if (!this.evaluations.length) throw new Error('WhenTask condition has no evaluations.');
    let left = false, right = false;
    for (let i = 0; i < this.evaluations.length; i++) {
      const { op, task } = this.evaluations[i];
      const symbol = new QuestSymbol(task);
      right = (op === 'when' || op === 'and' || op === 'or')
        ? this._isTaskSet(symbol)
        : !this._isTaskSet(symbol);
      switch (op) {
        case 'when': case 'whenNot':
          if (this.evaluations.length === 1 && !right) return false;
          break;
        case 'and': case 'andNot':
          if (!left || !right) {
            if (i < this.evaluations.length - 1) right = false;
            else return false;
          } else {
            right = true;
          }
          if (right === true && i < this.evaluations.length - 1) {
            const next = this.evaluations[i + 1].op;
            if (next === 'or' || next === 'orNot') return true;
          }
          break;
        case 'or': case 'orNot':
          if (!left && !right) {
            if (i < this.evaluations.length - 1) right = false;
            else return false;
          } else {
            right = true;
          }
          break;
        default:
          return false;
      }
      left = right;
    }
    return true;
  }
}

/** StartStopTimer.cs: "start timer _x_" / "stop timer _x_". */
export class StartStopTimer extends ActionTemplate {
  get pattern() { return /(?<start>start) timer (?<symbol>[a-zA-Z0-9_.-]+)|stop timer (?<sym2>[a-zA-Z0-9_.-]+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new StartStopTimer(parentQuest);
    action.targetSymbol = new QuestSymbol(match.groups.symbol ?? match.groups.sym2);
    action.isStartTimer = !!match.groups.start;
    return action;
  }
  update(_caller) {
    const targetClock = this.parentQuest.getClock(this.targetSymbol);
    if (!targetClock) {
      console.warn(`[quest] start timer was unable to find clock symbol ${this.targetSymbol.name}`);
      return;
    }
    if (this.isStartTimer) targetClock.startTimer();
    else targetClock.stopTimer();
    this.setComplete();
  }
}

/** Say.cs: "say N" / "say Name" - an IMMEDIATE oncePerQuest popup. */
export class Say extends ActionTemplate {
  constructor(parentQuest) { super(parentQuest); this.allowRearm = false; }
  get pattern() { return /say (?<id>\d+)|say (?<idName>\w+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new Say(parentQuest);
    action.id = questParseInt(match.groups.id ?? '');
    const idName = match.groups.idName;
    if (action.id === 0 && idName) {
      action.id = questParseInt(staticMessagesTable().getValue('id', idName));
    }
    return action;
  }
  update(_caller) {
    this.parentQuest.showMessagePopup(this.id, true);
    this.setComplete();
  }
}

/** LogMessage.cs: "log N [step] M" - sets the journal step. */
export class LogMessage extends ActionTemplate {
  get pattern() { return /log (?<id>\d+)( step)? (?<step>\d+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new LogMessage(parentQuest);
    action.messageID = questParseInt(match.groups.id);
    action.stepID = questParseInt(match.groups.step);
    return action;
  }
  update(_caller) {
    this.parentQuest.addLogStep(this.stepID, this.messageID);
    this.setComplete();
  }
}

/** RemoveLogMessage.cs: "remove log step N". */
export class RemoveLogMessage extends ActionTemplate {
  get pattern() { return /remove log step (?<step>\d+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new RemoveLogMessage(parentQuest);
    action.stepID = questParseInt(match.groups.step);
    return action;
  }
  update(_caller) {
    this.parentQuest.removeLogStep(this.stepID);
    this.setComplete();
  }
}

/** PickOneOf.cs: "pick one of _a_ _b_ ..." - starts one at random. */
export class PickOneOf extends ActionTemplate {
  get pattern() { return /pick one of [a-zA-Z0-9_.]+/; }
  createNew(source, parentQuest) {
    if (!this.test(source)) return null;
    const splits = source.trim().split(/\s+/);
    if (splits.length < 4) return null;
    const symbols = splits.slice(3).filter((s) => s).map((s) => new QuestSymbol(s));
    if (!symbols.length) return null;
    const action = new PickOneOf(parentQuest);
    action.taskSymbols = symbols;
    return action;
  }
  update(_caller) {
    const roll = this.parentQuest.rolls ?? Math.random;
    const selected = this.taskSymbols[Math.floor(roll() * this.taskSymbols.length)];
    const task = this.parentQuest.getTask(selected);
    if (task) task.start();
    else console.warn(`[quest] PickOneOf could not find task ${selected?.name}`);
    this.setComplete();
  }
}

/** AUDIT quest-P2: the registry is first-match-wins over UNANCHORED
 *  patterns, so the un-ported actions that sit before (or between)
 *  the tranche in DFU's RegisterActionTemplates order need GUARDS at
 *  their positions - without them Say hijacked "clicked npc _x_ say
 *  1011" into an unconditional popup and WhenTask built bogus evals
 *  from "when repute with ..." lines. A guard's createNew answers
 *  null, so the line lands in pendingActionLines (the Q2b queue),
 *  exactly where an unregistered action's line belongs. Patterns are
 *  the DFU originals' match surface, group-free. */
class PendingTrigger extends ActionTemplate {
  constructor(parentQuest, pattern) { super(parentQuest); this._pattern = pattern; }
  get pattern() { return this._pattern; }
  createNew() { return null; }
}

const GUARD_PATTERNS = Object.freeze({
  WhenPcEntersExits: /when pc (enters|exits) \w+/,
  WhenNpcIsAvailable: /when [a-zA-Z0-9_.-]+ is available/,
  WhenReputeWith: /when repute with [a-zA-Z0-9_.-]+ is at least \d+/,
  WhenSkillLevel: /when skill \w+ is at least \d+/,
  WhenAttributeLevel: /when attribute \w+ is at least \d+/,
  ClickedNpc: /clicked [a-zA-Z0-9_.-]+ and at least \d+ gold otherwise do [a-zA-Z0-9_.]+|clicked npc [a-zA-Z0-9_.-]+/,
  ClickedItem: /clicked item [a-zA-Z0-9_.-]+/,
});
const guard = (name) => new PendingTrigger(null, GUARD_PATTERNS[name]);

/** The default registry, instances in DFU's RegisterActionTemplates
 *  RELATIVE order (QuestMachine.cs:339-391) with guards standing in
 *  for the not-yet-ported actions whose lines the tranche would
 *  otherwise claim (AUDIT quest-P12 adopted the C# order outright). */
export function defaultActionTemplates() {
  return [
    guard('WhenPcEntersExits'),
    guard('WhenNpcIsAvailable'),
    guard('WhenReputeWith'),
    guard('WhenSkillLevel'),
    guard('WhenAttributeLevel'),
    new WhenTask(null),
    guard('ClickedNpc'),
    guard('ClickedItem'),
    new EndQuest(null),
    new Say(null),
    new StartTask(null),
    new ClearTask(null),
    new LogMessage(null),
    new PickOneOf(null),
    new RemoveLogMessage(null),
    new StartStopTimer(null),
    new UnsetTask(null),
  ];
}
