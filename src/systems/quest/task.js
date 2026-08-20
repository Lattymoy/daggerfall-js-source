// THE QUEST TASK (Q1) - Task.cs, the parse half. Task types:
// Headless (the startup block, begins triggered, symbol = NextUID),
// Standard ("_sym_ task:"), PersistUntil ("until _sym_ performed:" -
// begins triggered, terminates when the target sets), Variable
// ("variable _sym_"), GlobalVarLink (a header naming a
// Quests-GlobalVars row). The Update() trigger/action loop ships with
// the machine (Q2).
//
// ACTION LINES: DFU resolves each body line against the machine's
// action-template registry and logs "Action not found. Ignoring" for
// the rest. Q1 has no registry yet, so EVERY body line lands in
// `pendingActionLines` - the honest record Q2's registry consumes
// (and the corpus pins count) instead of 10,000 lines of log noise.
// setActionFactory installs the registry when it exists.

import { Symbol as QuestSymbol } from './symbol.js';
import { matchFirst } from './questResource.js';
import { nextUid } from './quest.js';

export const TaskType = Object.freeze({
  Headless: 'headless',
  Standard: 'standard',
  PersistUntil: 'persistUntil',
  Variable: 'variable',
  GlobalVarLink: 'globalVarLink',
});

// C# ReadTaskHeader alternation, in order (Node lacks duplicate named
// groups, so an ordered list with matchFirst's .NET semantics).
const TASK_HEADER = [
  /(?<symbol>[a-zA-Z0-9_.]+) (?<task>task):/,
  /until (?<sym2>[a-zA-Z0-9_.]+) (?<persist>performed:)/,
  /(?<variable>variable) (?<sym3>[a-zA-Z0-9_.]+)/,
];
const GLOBAL_VAR_HEADER = /(?<globalVarName>[a-zA-Z0-9_.]+) (?<symbol>[a-zA-Z0-9_.]+)/;

let _actionFactory = null;
/** Q2 seam: fn(line, parentQuest) -> action object or null. */
export function setActionFactory(fn) { _actionFactory = fn; }

export class Task {
  constructor(parentQuest, lines = null, globalVar = -1) {
    this.parentQuest = parentQuest;
    this.symbol = null;
    this.targetSymbol = null;
    this.triggered = false;
    this.prevTriggered = false;
    this.type = TaskType.Standard;
    this.dropped = false;
    this.globalVarName = '';
    this.globalVarLink = -1;
    this.hasTriggerConditions = false;
    this.actions = [];
    this.pendingActionLines = [];   // Q1: lines awaiting the action registry
    if (lines !== null) this.setTask(lines, globalVar);
  }

  setTask(lines, globalVar = -1) {
    let i = 0;
    if (globalVar !== -1) {
      this._readGlobalVarTaskHeader(lines[i++]);
      this.type = TaskType.GlobalVarLink;
      this.targetSymbol = null;
      this.globalVarLink = globalVar;
      this._readTaskLines(lines, i);
      return;
    }
    if (this._readTaskHeader(lines[i])) {
      i++;
    } else {
      // No header match: the headless startup task, begins triggered
      this.type = TaskType.Headless;
      this.targetSymbol = null;
      this.triggered = true;
      this.symbol = new QuestSymbol(nextUid().toString());
    }
    this._readTaskLines(lines, i);
  }

  start() { this.setTriggerValue(true); }
  clear() { this.setTriggerValue(false); }
  drop() { this.dropped = true; this.setTriggerValue(false); }

  getTriggerValue() {
    // A GlobalVarLink task reads the shared 64-global store (classic
    // SAVEVARS.DAT state) through the machine's hooks.
    const globals = this.parentQuest?.hooks?.globalVars;
    if (this.globalVarLink !== -1 && globals) {
      this.triggered = globals.get(this.globalVarLink) ?? false;
    }
    return this.triggered;
  }

  setTriggerValue(value) {
    const globals = this.parentQuest?.hooks?.globalVars;
    if (this.globalVarLink !== -1 && globals) globals.set(this.globalVarLink, value);
    this.triggered = value;
    if (this.dropped) this.triggered = false;
  }

  /** Q2 - Task.cs Update: the trigger law. The FIRST always-on
   *  trigger is PRIMARY (can start AND stop the task - S0000977's
   *  Daggerfall-city vengeance spawn); later always-on triggers are
   *  SECONDARY (start only - W0C00Y00's dual "when" reward). Ordinary
   *  triggers run only while untriggered. Actions tick when active,
   *  initialising on the untriggered->triggered edge, and a
   *  questBreak bails mid-task. A PersistUntil task checks its target
   *  AFTER at least one tick (the classic Z.CFG start observation)
   *  and REARMS its actions while the target stays unset (S0000011's
   *  Barenziah click clear). */
  update() {
    let ranPrimaryAlwaysOnTrigger = false;
    for (const action of this.actions) {
      if (action.isComplete) continue;

      if ((action.isTriggerCondition && !this.getTriggerValue()) || action.isAlwaysOnTriggerCondition) {
        if (action.isAlwaysOnTriggerCondition && !ranPrimaryAlwaysOnTrigger) {
          this.setTriggerValue(action.checkTrigger(this));
          ranPrimaryAlwaysOnTrigger = true;
        } else if (action.isAlwaysOnTriggerCondition && ranPrimaryAlwaysOnTrigger) {
          if (action.checkTrigger(this)) this.setTriggerValue(true);
        } else {
          this.setTriggerValue(action.checkTrigger(this));
        }
      }

      if (this.getTriggerValue() && !action.isTriggerCondition) {
        if (!this.prevTriggered) action.initialiseOnSet();
        action.update(this);
        if (this.parentQuest.questBreak) return;
      }
    }

    if (this.type === TaskType.PersistUntil) {
      const targetTask = this.parentQuest.getTask(this.targetSymbol);
      if (targetTask?.getTriggerValue()) this.clear();
      else this._rearmActions();
    }

    this.prevTriggered = this.getTriggerValue();
  }

  _rearmActions() {
    for (const action of this.actions) action.rearmAction();
  }

  disposeActions() {
    for (const action of this.actions) action.dispose();
  }

  _readGlobalVarTaskHeader(line) {
    const match = GLOBAL_VAR_HEADER.exec(line);
    if (match) {
      this.globalVarName = match.groups.globalVarName;
      this.symbol = new QuestSymbol(match.groups.symbol);
      return true;
    }
    return false;
  }

  _readTaskHeader(line) {
    const match = matchFirst(line, TASK_HEADER);
    if (!match) return false;
    const g = match.groups;
    if (g.task) {
      this.type = TaskType.Standard;
      this.targetSymbol = null;
      this.symbol = new QuestSymbol(g.symbol);
    } else if (g.persist) {
      // Starts automatically, terminates when target symbol is true
      this.type = TaskType.PersistUntil;
      this.targetSymbol = new QuestSymbol(g.sym2);
      this.triggered = true;
      this.symbol = new QuestSymbol(nextUid().toString());
    } else if (g.variable) {
      this.type = TaskType.Variable;
      this.targetSymbol = null;
      this.triggered = false;
      this.symbol = new QuestSymbol(g.sym3);
    }
    return true;
  }

  _readTaskLines(lines, startLine) {
    for (let i = startLine; i < lines.length; i++) {
      const action = _actionFactory?.(lines[i], this.parentQuest) ?? null;
      if (action) {
        this.actions.push(action);
        if (action.isTriggerCondition) this.hasTriggerConditions = true;
      } else {
        this.pendingActionLines.push(lines[i]);
      }
    }
  }

  /** Quest.AddTask's duplicate-symbol arm merges actions in. */
  copyQuestActions(other) {
    this.actions.push(...other.actions);
    this.pendingActionLines.push(...other.pendingActionLines);
  }
}
