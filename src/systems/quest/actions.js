// THE QUEST ACTIONS (Q2 tranche + Q2b-i state tranche) -
// QuestAction.cs's ActionTemplate base + the actions from
// Actions/*.cs, each 1:1 with its DFU source named. Actions are
// objects with a LIFETIME, not one-shot executions: a template
// registry tests each task line against every action's Pattern
// (QuestMachine GetActionTemplate's brute-force scan) and factories a
// new instance on match; SetComplete stops re-execution until a
// rearm; a trigger condition starts its task, an ALWAYS-ON trigger
// keeps being checked every tick (the primary/secondary law lives in
// task.update).
//
// Q2 shipped the ten world-free actions: StartTask, ClearTask,
// UnsetTask, EndQuest, WhenTask, StartStopTimer, Say, LogMessage,
// RemoveLogMessage, PickOneOf. PickOneOf's UnityEngine.Random draw
// rides the quest's injectable roll (Ledger A; DFU reseeds from
// QuestMachine.InternalSeed, its own System.Random - a per-machine
// stream either way).
//
// Q2b-i shipped the STATE tranche - the 25 actions that ride resource
// state (clicks, kills, injuries, hide/mute/restrain flags), task
// state, world time, and the machine's hook seams: ClickedNpc,
// ClickedItem, KilledFoe, InjuredFoe, LevelCompleted, DailyFrom,
// Prompt, PlaySound, PlayVideo, HideNpc, RestoreNpc, AddFace,
// DropFace, StartQuest, RestrainFoe, AddAsQuestor, DropAsQuestor,
// ItemUsedDo, DialogLink, AddDialog, RumorMill, RemoveFoe,
// LegalRepute, MuteNpc, DestroyNpc. The registry below now mirrors
// DFU's RegisterActionTemplates WHOLE - every un-ported action stands
// as a guard at its C# position, so every corpus line lands exactly
// where DFU's first-match scan sends it. Still queued: the ITEM
// tranche (GivePc/GetItem/Toting/Have/Take/GiveItem/MakePermanent -
// they need Item.cs's DaggerfallUnityItem mint, Q2b-ii) and the WORLD
// tranche (Place/Person/Foe site binding, Q3).
//
// REGEX NOTE: C# alternations reuse group names across alternatives;
// JS cannot. Where a ported action consumes groups, the alternatives
// keep DFU's order with per-alternative names (g.a ?? g.a2 ...) -
// backtracking regexes in .NET and JS both scan positions left to
// right and try alternatives in order, so a single renamed regex
// keeps .NET semantics. Guards strip group names entirely.

import { Symbol as QuestSymbol, symbolToSaveData, symbolFromSaveData } from './symbol.js';
import { parseInt as questParseInt } from './parseUtils.js';
import { staticMessagesTable, soundsTable, placesTable, spellsTable, diseasesTable } from './tables.js';
import { dateFromSeconds } from '../gameDate.js';
import { makeItemPermanent } from './item.js';
import { QUEST_MESSAGES } from './quest.js';
import { customParseInt, isPlayerAtBuildingType, isPlayerAtDungeonType, MARKER_PREFERENCE } from './place.js';
import { getIndividualFactionID, getFactionDataOrThrow } from './person.js';
import { markerScenePosition } from './sceneMount.js';
import { isSongFileDefined, songFileToRecordName } from '../songFiles.js';

/** TalkManager.cs:285-291 - the dialog-link resource types. */
export const QUEST_INFO_RESOURCE_TYPE = Object.freeze({
  NotSet: 0, Location: 1, Person: 2, Thing: 3,
});

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
  // ---- the save envelope (Q4-iv; QuestAction.cs:182-219) ----

  /** The envelope's type identity - explicit per class so a
   *  minifying build cannot rename it. */
  get typeName() { return this.constructor.typeName ?? this.constructor.name; }

  /** The declarative save shape: [[portField, kind, savedName?]] with
   *  kinds 'raw' (JSON-safe copy) and 'sym'/'symArray' (Symbol <->
   *  {original}). Every shipped action's C# GetSaveData/RestoreSaveData
   *  is a pure field copy (spot-verified), so ONE walk implements all
   *  of them; savedName keeps the C# field name where the port's
   *  differs (PlaySound soundId <-> soundIndex). Transient fields C#
   *  leaves out stay out - CreateFoe's in-flight wave, TeleportPc's
   *  resume, GivePc's offer latch all reset on load, verbatim. */
  get saveShape() { return []; }

  getSaveData() {
    const shape = this.saveShape;
    if (!shape.length) return null;
    const data = {};
    for (const [field, kind = 'raw', savedName = field] of shape) {
      const v = this[field];
      if (kind === 'sym') data[savedName] = symbolToSaveData(v);
      else if (kind === 'symArray') data[savedName] = v ? v.map(symbolToSaveData) : null;
      else data[savedName] = (v && typeof v === 'object') ? structuredClone(v) : v;
    }
    return data;
  }

  restoreSaveData(dataIn) {
    if (dataIn == null) return;
    for (const [field, kind = 'raw', savedName = field] of this.saveShape) {
      const v = dataIn[savedName];
      if (kind === 'sym') this[field] = symbolFromSaveData(v);
      else if (kind === 'symArray') this[field] = v ? v.map(symbolFromSaveData) : null;
      else this[field] = (v && typeof v === 'object') ? structuredClone(v) : v;
    }
  }

  /** GetActionSaveData (:195-206). */
  getActionSaveData() {
    return {
      type: this.typeName,
      isComplete: this.isComplete,
      isTriggerCondition: this.isTriggerCondition,
      isAlwaysOnTriggerCondition: this.isAlwaysOnTriggerCondition,
      debugSource: this.debugSource,
      actionSpecific: this.getSaveData(),
    };
  }

  /** RestoreActionSaveData (:211-218). */
  restoreActionSaveData(data) {
    this.isComplete = data.isComplete;
    this.isTriggerCondition = data.isTriggerCondition;
    this.isAlwaysOnTriggerCondition = data.isAlwaysOnTriggerCondition;
    this.debugSource = data.debugSource;
    this.restoreSaveData(data.actionSpecific);
  }
}

/** StartTask.cs: "start task X" / "setvar X". */
export class StartTask extends ActionTemplate {
  static typeName = 'StartTask';
  get saveShape() { return [['taskSymbol', 'sym']]; }
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
  static typeName = 'ClearTask';
  get saveShape() { return [['taskSymbols', 'symArray']]; }
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
  static typeName = 'UnsetTask';
  get saveShape() { return [['taskSymbols', 'symArray']]; }
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
  static typeName = 'EndQuest';
  get saveShape() { return [['textId']]; }
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
  static typeName = 'WhenTask';
  get saveShape() { return [['evaluations']]; }
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
  static typeName = 'StartStopTimer';
  get saveShape() { return [['isStartTimer'], ['targetSymbol', 'sym']]; }
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
  static typeName = 'Say';
  get saveShape() { return [['id']]; }
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
  static typeName = 'LogMessage';
  get saveShape() { return [['messageID'], ['stepID']]; }
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
  static typeName = 'RemoveLogMessage';
  get saveShape() { return [['stepID']]; }
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
  static typeName = 'PickOneOf';
  get saveShape() { return [['taskSymbols', 'symArray']]; }
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

// ---------------------------------------------------------------
// Q2b-i - THE STATE TRANCHE
// ---------------------------------------------------------------

/** ClickedNpc.cs: the click trigger. Once the owning task triggers it
 *  stays true ("another action will need to rearm/unset this task if
 *  another click is required"). The gold form deducts on success or
 *  starts the otherwise-task and refuses. The click is consumed via
 *  ScheduleClickRearm so a second task in the same tick cannot see
 *  it. */
export class ClickedNpc extends ActionTemplate {
  static typeName = 'ClickedNpc';
  get saveShape() { return [['npcSymbol', 'sym'], ['id'], ['goldAmount'], ['taskSymbol', 'sym']]; }
  constructor(parentQuest) { super(parentQuest); this.isTriggerCondition = true; }
  get pattern() {
    return /clicked (?<anNPC>[a-zA-Z0-9_.-]+) and at least (?<goldAmount>\d+) gold otherwise do (?<taskName>[a-zA-Z0-9_.]+)|clicked npc (?<anNPC2>[a-zA-Z0-9_.-]+) say (?<id>\d+)|clicked npc (?<anNPC3>[a-zA-Z0-9_.-]+) say (?<idName>\w+)|clicked npc (?<anNPC4>[a-zA-Z0-9_.-]+)/;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new ClickedNpc(parentQuest);
    action.npcSymbol = new QuestSymbol(g.anNPC ?? g.anNPC2 ?? g.anNPC3 ?? g.anNPC4);
    action.id = questParseInt(g.id ?? '');
    const idName = g.idName;
    if (action.id === 0 && idName) {
      action.id = questParseInt(staticMessagesTable().getValue('id', idName));
    }
    action.goldAmount = questParseInt(g.goldAmount ?? '');
    action.taskSymbol = new QuestSymbol(g.taskName ?? '');
    return action;
  }
  checkTrigger(caller) {
    // Always true once the owning task is triggered
    if (caller.getTriggerValue()) return true;
    const person = this.parentQuest.getPerson(this.npcSymbol);
    if (!person) return false;
    if (person.hasPlayerClicked) {
      if (this.goldAmount > 0 && this.taskSymbol && this.taskSymbol.name) {
        if (this.parentQuest.hooks?.getGold?.() >= this.goldAmount) {
          this.parentQuest.hooks?.deductGold?.(this.goldAmount);
        } else {
          this.parentQuest.startTask(this.taskSymbol);
          return false;
        }
      }
      if (this.id !== 0) this.parentQuest.showMessagePopup(this.id);
      this.parentQuest.scheduleClickRearm(person);
      return true;
    }
    return false;
  }
}

/** ClickedItem.cs: click trigger on a quest Item. The C# ships its
 *  RearmPlayerClick call commented out - no rearm is scheduled; the
 *  PostTick law clears the click anyway. */
export class ClickedItem extends ActionTemplate {
  static typeName = 'ClickedItem';
  get saveShape() { return [['itemSymbol', 'sym'], ['id']]; }
  constructor(parentQuest) { super(parentQuest); this.isTriggerCondition = true; }
  get pattern() {
    return /clicked item (?<anItem>[a-zA-Z0-9_.-]+) say (?<id>\d+)|clicked item (?<anItem2>[a-zA-Z0-9_.-]+) say (?<idName>\w+)|clicked item (?<anItem3>[a-zA-Z0-9_.-]+)/;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new ClickedItem(parentQuest);
    action.itemSymbol = new QuestSymbol(g.anItem ?? g.anItem2 ?? g.anItem3);
    action.id = questParseInt(g.id ?? '');
    if (action.id === 0 && g.idName) {
      action.id = questParseInt(staticMessagesTable().getValue('id', g.idName));
    }
    return action;
  }
  checkTrigger(caller) {
    if (caller.getTriggerValue()) return true;
    const item = this.parentQuest.getItem(this.itemSymbol);
    if (!item) return false;
    if (item.hasPlayerClicked) {
      if (this.id !== 0) this.parentQuest.showMessagePopup(this.id);
      return true;
    }
    return false;
  }
}

/** KilledFoe.cs: fires when the Foe's kill count reaches the target
 *  (a missing count parses 0 and is raised to 1). */
export class KilledFoe extends ActionTemplate {
  static typeName = 'KilledFoe';
  get saveShape() { return [['foeSymbol', 'sym'], ['killsRequired'], ['sayingID']]; }
  constructor(parentQuest) { super(parentQuest); this.isTriggerCondition = true; }
  get pattern() {
    return /killed (?<kills>\d+) (?<aFoe>[a-zA-Z0-9_.-]+) (saying (?<sayingID>\d+))|killed (?<kills2>\d+) (?<aFoe2>[a-zA-Z0-9_.-]+)|killed (?<aFoe3>[a-zA-Z0-9_.-]+)/;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new KilledFoe(parentQuest);
    action.foeSymbol = new QuestSymbol(g.aFoe ?? g.aFoe2 ?? g.aFoe3);
    action.killsRequired = questParseInt(g.kills ?? g.kills2 ?? '');
    action.sayingID = questParseInt(g.sayingID ?? '');
    if (action.killsRequired < 1) action.killsRequired = 1;
    return action;
  }
  checkTrigger(_caller) {
    const foe = this.parentQuest.getFoe(this.foeSymbol);
    if (!foe) return false;
    if (foe.killCount >= this.killsRequired) {
      if (this.sayingID !== 0) this.parentQuest.showMessagePopup(this.sayingID);
      return true;
    }
    return false;
  }
}

/** InjuredFoe.cs: fires on the Foe's injured flag ("will not fire if
 *  Foe dies immediately", e.g. a one-shot). */
export class InjuredFoe extends ActionTemplate {
  static typeName = 'InjuredFoe';
  get saveShape() { return [['foeSymbol', 'sym'], ['textID']]; }
  constructor(parentQuest) { super(parentQuest); this.isTriggerCondition = true; }
  get pattern() {
    return /injured (?<aFoe>[a-zA-Z0-9_.-]+) saying (?<textID>\d+)|injured (?<aFoe2>[a-zA-Z0-9_.-]+)/;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new InjuredFoe(parentQuest);
    action.foeSymbol = new QuestSymbol(g.aFoe ?? g.aFoe2);
    action.textID = questParseInt(g.textID ?? '');
    return action;
  }
  checkTrigger(_caller) {
    const foe = this.parentQuest.getFoe(this.foeSymbol);
    if (!foe) return false;
    if (foe.injuredTrigger) {
      if (this.textID !== 0) this.parentQuest.showMessagePopup(this.textID);
      return true;
    }
    return false;
  }
}

/** LevelCompleted.cs: despite the classic name, DFU implements
 *  "level N completed" as player level >= N. */
export class LevelCompleted extends ActionTemplate {
  static typeName = 'LevelCompleted';
  get saveShape() { return [['minLevelValue']]; }
  constructor(parentQuest) { super(parentQuest); this.isTriggerCondition = true; }
  get pattern() { return /level (?<minLevelValue>\d+) completed/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new LevelCompleted(parentQuest);
    action.minLevelValue = questParseInt(match.groups.minLevelValue);
    return action;
  }
  checkTrigger(_caller) {
    return (this.parentQuest.hooks?.playerLevel?.() ?? 0) >= this.minLevelValue;
  }
}

/** DailyFrom.cs: ALWAYS-ON window trigger over the world clock -
 *  inclusive at both ends, so as a primary trigger it stops its task
 *  outside the window. Hour/minute come off the same calendar as
 *  DFU's WorldTime.Now (the machine's nowSeconds contract). */
export class DailyFrom extends ActionTemplate {
  static typeName = 'DailyFrom';
  get saveShape() { return [['minDailySeconds'], ['maxDailySeconds']]; }
  constructor(parentQuest) {
    super(parentQuest);
    this.isTriggerCondition = true;
    this.isAlwaysOnTriggerCondition = true;
  }
  get pattern() { return /daily from (?<hours1>\d+):(?<minutes1>\d+) to (?<hours2>\d+):(?<minutes2>\d+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new DailyFrom(parentQuest);
    action.minDailySeconds = questParseInt(g.hours1) * 3600 + questParseInt(g.minutes1) * 60;
    action.maxDailySeconds = questParseInt(g.hours2) * 3600 + questParseInt(g.minutes2) * 60;
    return action;
  }
  checkTrigger(_caller) {
    const now = dateFromSeconds(this.parentQuest.nowSeconds?.() ?? 0);
    const currentDailySeconds = now.hour * 3600 + now.minute * 60;
    return currentDailySeconds >= this.minDailySeconds && currentDailySeconds <= this.maxDailySeconds;
  }
}

/** Prompt.cs: a yes/no box over a quest message - Yes starts the yes
 *  task, anything else the no task. The box itself is the machine's
 *  showPrompt hook (Q4 wires the parchment prompt; tests capture);
 *  a missing message shows nothing, and SetComplete runs either
 *  way. */
export class Prompt extends ActionTemplate {
  static typeName = 'Prompt';
  get saveShape() { return [['id'], ['yesTaskSymbol', 'sym'], ['noTaskSymbol', 'sym']]; }
  constructor(parentQuest) { super(parentQuest); this.allowRearm = false; }
  get pattern() {
    return /prompt (?<id>\d+) yes (?<yesTaskName>[a-zA-Z0-9_.]+) no (?<noTaskName>[a-zA-Z0-9_.]+)|prompt (?<idName>\w+) yes (?<yesTaskName2>[a-zA-Z0-9_.]+) no (?<noTaskName2>[a-zA-Z0-9_.]+)/;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const prompt = new Prompt(parentQuest);
    prompt.id = questParseInt(g.id ?? '');
    prompt.yesTaskSymbol = new QuestSymbol(g.yesTaskName ?? g.yesTaskName2);
    prompt.noTaskSymbol = new QuestSymbol(g.noTaskName ?? g.noTaskName2);
    if (prompt.id === 0 && g.idName) {
      prompt.id = questParseInt(staticMessagesTable().getValue('id', g.idName));
    }
    return prompt;
  }
  update(_caller) {
    // QuestMachine.CreateMessagePrompt answers null for a missing
    // message - no box shows, but the action still completes.
    const message = this.parentQuest.getMessage(this.id);
    if (message) {
      this.parentQuest.hooks?.showPrompt?.(this.parentQuest, message, (isYes) => {
        this.parentQuest.startTask(isYes ? this.yesTaskSymbol : this.noTaskSymbol);
      });
    }
    this.setComplete();
  }
}

/** PlaySound.cs: "play sound X every N minutes M times" (count 0 =
 *  forever) / "play sound X N unknown" - a REPEATING action with no
 *  SetComplete; timesPlayed++ rides the interval check while only a
 *  real play (hook answers truthy; C# skips while the audio source is
 *  busy) re-stamps lastTimePlayed. Create resolves the sound through
 *  Quests-Sounds inside the C#'s try/catch - an unknown name answers
 *  null and the line pends. DEPARTURE (recorded): C# also resolves
 *  SoundReader.GetSoundIndex/GetAudioClip at create and nulls on
 *  failure; the port keeps SND resolution host-side behind the
 *  playSound hook, so create succeeds on the table hit alone. */
export class PlaySound extends ActionTemplate {
  static typeName = 'PlaySound';
  get saveShape() { return [['soundName'], ['soundId', 'raw', 'soundIndex'], ['interval'], ['count'], ['unknown'], ['lastTimePlayed']]; }
  constructor(parentQuest) {
    super(parentQuest);
    // AUDIT 24 (the seven-slice sweep): A RESTORED PlaySound WENT NaN.
    // `int timesPlayed;` is a C# FIELD, so it is 0 before anything
    // touches it - and C# is right not to save it (SaveData_v1 carries
    // the other six). The port set it only in createNew and
    // rearmAction, and a restore mints the action through the (Quest)
    // constructor and then walks saveShape - which correctly omits it.
    // So `this.timesPlayed++` ran on undefined, NaN failed
    // `NaN <= count`, and the sound never played again for the rest of
    // the save. Every other action's createNew-only field is either
    // declared here or in its shape; a gate now keeps it that way.
    this.timesPlayed = 0;
  }
  get pattern() {
    return /play sound (?<sound>\w+) every (?<n1>\d+) minutes (?<count>\d+) times|play sound (?<sound2>\w+) (?<n1b>\d+) (?<n2>\d+)/;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new PlaySound(parentQuest);
    try {
      action.soundName = g.sound ?? g.sound2;
      action.interval = questParseInt(g.n1 ?? g.n1b) * 60;
      action.unknown = questParseInt(g.n2 ?? '');
      action.count = questParseInt(g.count ?? '');
      action.lastTimePlayed = parentQuest?.nowSeconds?.() ?? 0;
      action.soundId = soundsTable().getInt('id', action.soundName);
      action.timesPlayed = 0;
    } catch (e) {
      console.warn(`[quest] PlaySound.Create() failed with exception: ${e?.message ?? e}`);
      return null;
    }
    return action;
  }
  update(_caller) {
    const gameSeconds = this.parentQuest.nowSeconds?.() ?? 0;
    if (this.lastTimePlayed + this.interval <= gameSeconds) {
      this.timesPlayed++;
      if (this.count === 0 || (this.count > 0 && this.timesPlayed <= this.count)) {
        if (this.parentQuest.hooks?.playSound?.(this.soundId)) {
          this.lastTimePlayed = gameSeconds;
        }
      }
    }
  }
  rearmAction() {
    super.rearmAction();
    this.timesPlayed = 0;
    this.lastTimePlayed = this.parentQuest?.nowSeconds?.() ?? 0;
  }
}

/** PlayVideo.cs: "play video N" -> "ANIM" + N zero-padded to four +
 *  ".VID"; an empty or five-plus-digit number answers null and the
 *  line pends (the C# try/catch shape). Playback is the machine's
 *  playVideo hook (Q4 UI). */
export class PlayVideo extends ActionTemplate {
  static typeName = 'PlayVideo';
  get saveShape() { return [['videoName']]; }
  get pattern() { return /play video (?<vidNum>\d+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const num = match.groups.vidNum;
    if (!num || num.length > 4) return null;
    const action = new PlayVideo(parentQuest);
    action.videoName = `ANIM${'0'.repeat(4 - num.length)}${num}.VID`;
    return action;
  }
  update(_caller) {
    this.parentQuest.hooks?.playVideo?.(this.videoName);
    this.setComplete();
  }
}

/** PlaySong.cs: "play song <name>" plays ONE song from MIDI.BSA and
 *  completes. The name is a SongFiles member and the gate is C#'s own
 *  `Enum.IsDefined` (:47-52) - an unknown song completes the TEMPLATE
 *  and THROWS. The throw leaves the parse through Task's line loop and
 *  lands in the machine's per-quest catch (ParseQuest's "Parsing quest
 *  FAILED!"), so a quest naming a song that does not exist is DROPPED
 *  WHOLE. That is the loud half of the same choice PlaySound's create
 *  makes quietly one screen up: its lookup sits in a try/catch and a
 *  bad sound name pends the single line. Both are verbatim; the two
 *  actions simply disagree in C#.
 *
 *  `SetComplete()` there really is called on the template rather than
 *  on the action being built (the action does not exist yet on that
 *  path); templates are never updated, so it changes nothing, and it
 *  is kept where C# has it. C#'s `source = source.TrimEnd()` two lines
 *  below is dead - the comment is copied from an action that splits
 *  the source into symbols and this one never reads `source` again -
 *  so it is not transcribed.
 *
 *  DFU hands the enum value to DaggerfallSongPlayer.Play, which turns
 *  it into a filename at the last moment. The port's seam is the
 *  machine's playSong hook and the port's song layer keys on MIDI.BSA
 *  record names throughout, so songFileToRecordName (systems/
 *  songFiles.js = EnumToFilename) does that step here. The SAVED field
 *  is still the enum name, as C#'s SaveData_v1.song is. */
export class PlaySong extends ActionTemplate {
  static typeName = 'PlaySong';
  get saveShape() { return [['songFile', 'raw', 'song']]; }
  get pattern() { return /play song (?<song>[a-zA-Z0-9_-]+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new PlaySong(parentQuest);
    const song = match.groups.song;
    if (!isSongFileDefined(song)) {
      this.setComplete();
      throw new Error(`PlaySong: Song file ${song} is not a known song from MIDI.BSA`);
    }
    action.songFile = song;
    return action;
  }
  update(_caller) {
    this.parentQuest.hooks?.playSong?.(songFileToRecordName(this.songFile));
    this.setComplete();
  }
}

/** HideNpc.cs: raises the Person's hidden flag. A missing Person
 *  returns WITHOUT completing - the action keeps trying. */
export class HideNpc extends ActionTemplate {
  static typeName = 'HideNpc';
  get saveShape() { return [['npcSymbol', 'sym']]; }
  get pattern() { return /hide npc (?<anNPC>[a-zA-Z0-9_.-]+)|hide (?<anNPC2>[a-zA-Z0-9_.-]+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new HideNpc(parentQuest);
    action.npcSymbol = new QuestSymbol(match.groups.anNPC ?? match.groups.anNPC2);
    return action;
  }
  update(_caller) {
    const person = this.parentQuest.getPerson(this.npcSymbol);
    if (!person) return;
    person.isHidden = true;
    this.setComplete();
  }
}

/** RestoreNpc.cs: clears the hidden flag; same keep-trying law as
 *  HideNpc. */
export class RestoreNpc extends ActionTemplate {
  static typeName = 'RestoreNpc';
  get saveShape() { return [['npcSymbol', 'sym']]; }
  get pattern() { return /restore npc (?<anNPC>[a-zA-Z0-9_.-]+)|restore (?<anNPC2>[a-zA-Z0-9_.-]+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new RestoreNpc(parentQuest);
    action.npcSymbol = new QuestSymbol(match.groups.anNPC ?? match.groups.anNPC2);
    return action;
  }
  update(_caller) {
    const person = this.parentQuest.getPerson(this.npcSymbol);
    if (!person) return;
    person.isHidden = false;
    this.setComplete();
  }
}

/** MuteNpc.cs: mutes (SetPlayerClicked then refuses the click), and -
 *  unlike every other flag action - UNMUTES on rearm. A missing
 *  Person completes immediately, in update AND in rearm. */
export class MuteNpc extends ActionTemplate {
  static typeName = 'MuteNpc';
  get saveShape() { return [['npcSymbol', 'sym']]; }
  get pattern() { return /mute npc (?<anNPC>[a-zA-Z0-9_.-]+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new MuteNpc(parentQuest);
    action.npcSymbol = new QuestSymbol(match.groups.anNPC);
    return action;
  }
  update(_caller) {
    const person = this.parentQuest.getPerson(this.npcSymbol);
    if (!person) { this.setComplete(); return; }
    person.isMuted = true;
    this.setComplete();
  }
  rearmAction() {
    super.rearmAction();
    const person = this.parentQuest.getPerson(this.npcSymbol);
    if (!person) { this.setComplete(); return; }
    person.isMuted = false;
  }
}

/** DestroyNpc.cs: marks the Person destroyed - the Tick law then
 *  keeps it hidden while it stands in a scene, and clicks refuse. */
export class DestroyNpc extends ActionTemplate {
  static typeName = 'DestroyNpc';
  get saveShape() { return [['npcSymbol', 'sym']]; }
  get pattern() { return /destroy npc (?<anNPC>[a-zA-Z0-9_.-]+)|destroy (?<anNPC2>[a-zA-Z0-9_.-]+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new DestroyNpc(parentQuest);
    action.npcSymbol = new QuestSymbol(match.groups.anNPC ?? match.groups.anNPC2);
    return action;
  }
  update(_caller) {
    const person = this.parentQuest.getPerson(this.npcSymbol);
    if (!person) { this.setComplete(); return; }
    person.destroyNPC();
    this.setComplete();
  }
}

/** RestrainFoe.cs: raises the restrained flag (the Q3 foe motor
 *  reads it); a missing Foe keeps trying. */
export class RestrainFoe extends ActionTemplate {
  static typeName = 'RestrainFoe';
  get saveShape() { return [['foeSymbol', 'sym']]; }
  get pattern() { return /restrain foe (?<aFoe>[a-zA-Z0-9_.-]+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new RestrainFoe(parentQuest);
    action.foeSymbol = new QuestSymbol(match.groups.aFoe);
    return action;
  }
  update(_caller) {
    const foe = this.parentQuest.getFoe(this.foeSymbol);
    if (!foe) return;
    foe.setRestrained();
    this.setComplete();
  }
}

/** RemoveFoe.cs: hides the Foe (removing ALL spawned instances, per
 *  the SetHidden note); a missing Foe completes then THROWS - the
 *  machine error-terminates the quest. */
export class RemoveFoe extends ActionTemplate {
  static typeName = 'RemoveFoe';
  get saveShape() { return [['foeSymbol', 'sym']]; }
  get pattern() { return /remove foe (?<aFoe>[a-zA-Z0-9_.-]+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new RemoveFoe(parentQuest);
    action.foeSymbol = new QuestSymbol(match.groups.aFoe);
    return action;
  }
  update(_caller) {
    const foe = this.parentQuest.getFoe(this.foeSymbol);
    if (!foe) {
      this.setComplete();
      throw new Error(`Could not find Foe resource symbol ${this.foeSymbol?.name}`);
    }
    foe.isHidden = true;
    this.setComplete();
  }
}

/** AddAsQuestor.cs / DropAsQuestor.cs: the quest's questor registry
 *  (Quest.AddQuestor/DropQuestor carry the laws). */
export class AddAsQuestor extends ActionTemplate {
  static typeName = 'AddAsQuestor';
  get saveShape() { return [['target', 'sym']]; }
  get pattern() { return /add (?<target>[a-zA-Z0-9_.-]+) as questor/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new AddAsQuestor(parentQuest);
    action.target = new QuestSymbol(match.groups.target);
    return action;
  }
  update(_caller) {
    this.parentQuest.addQuestor(this.target);
    this.setComplete();
  }
}

export class DropAsQuestor extends ActionTemplate {
  static typeName = 'DropAsQuestor';
  get saveShape() { return [['target', 'sym']]; }
  get pattern() { return /drop (?<target>[a-zA-Z0-9_.-]+) as questor/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new DropAsQuestor(parentQuest);
    action.target = new QuestSymbol(match.groups.target);
    return action;
  }
  update(_caller) {
    this.parentQuest.dropQuestor(this.target);
    this.setComplete();
  }
}

/** AddFace.cs: puts the Person's (or Foe's) face on the HUD escort
 *  panel via the addFace hook; an optional saying pops IMMEDIATE. */
export class AddFace extends ActionTemplate {
  static typeName = 'AddFace';
  get saveShape() { return [['personSymbol', 'sym'], ['foeSymbol', 'sym'], ['sayingID']]; }
  constructor(parentQuest) { super(parentQuest); this.allowRearm = false; }
  get pattern() {
    return /add (?<anNPC>[a-zA-Z0-9_.-]+) face saying (?<sayingID>\d+)|add (?<anNPC2>[a-zA-Z0-9_.-]+) face|add foe (?<aFoe>[a-zA-Z0-9_.-]+) face saying (?<sayingID2>\d+)|add foe (?<aFoe2>[a-zA-Z0-9_.-]+) face/;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new AddFace(parentQuest);
    action.personSymbol = new QuestSymbol(g.anNPC ?? g.anNPC2 ?? '');
    action.foeSymbol = new QuestSymbol(g.aFoe ?? g.aFoe2 ?? '');
    action.sayingID = questParseInt(g.sayingID ?? g.sayingID2 ?? '');
    return action;
  }
  update(_caller) {
    if (this.sayingID !== 0) this.parentQuest.showMessagePopup(this.sayingID, true);
    if (this.personSymbol && this.personSymbol.name) {
      const person = this.parentQuest.getPerson(this.personSymbol);
      if (person) this.parentQuest.hooks?.addFace?.(person);
    } else if (this.foeSymbol && this.foeSymbol.name) {
      const foe = this.parentQuest.getFoe(this.foeSymbol);
      if (foe) this.parentQuest.hooks?.addFace?.(foe);
    }
    this.setComplete();
  }
}

/** DropFace.cs: removes the face from the HUD escort panel. */
export class DropFace extends ActionTemplate {
  static typeName = 'DropFace';
  get saveShape() { return [['personSymbol', 'sym'], ['foeSymbol', 'sym']]; }
  get pattern() {
    return /drop (?<anNPC>[a-zA-Z0-9_.-]+) face|drop foe (?<aFoe>[a-zA-Z0-9_.-]+) face/;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new DropFace(parentQuest);
    action.personSymbol = new QuestSymbol(g.anNPC ?? '');
    action.foeSymbol = new QuestSymbol(g.aFoe ?? '');
    return action;
  }
  update(_caller) {
    if (this.personSymbol && this.personSymbol.name) {
      const person = this.parentQuest.getPerson(this.personSymbol);
      if (person) this.parentQuest.hooks?.dropFace?.(person);
    } else if (this.foeSymbol && this.foeSymbol.name) {
      const foe = this.parentQuest.getFoe(this.foeSymbol);
      if (foe) this.parentQuest.hooks?.dropFace?.(foe);
    }
    this.setComplete();
  }
}

/** ItemUsedDo.cs: watches a quest Item until the player "uses" it
 *  from the inventory - then says, starts the task, stops watching
 *  and completes. Until then every tick re-raises actionWatching. */
export class ItemUsedDo extends ActionTemplate {
  static typeName = 'ItemUsedDo';
  get saveShape() { return [['itemSymbol', 'sym'], ['taskSymbol', 'sym'], ['textID']]; }
  get pattern() {
    return /(?<anItem>[a-zA-Z0-9_.-]+) used do (?<aTask>[a-zA-Z0-9_.-]+)|(?<anItem2>[a-zA-Z0-9_.-]+) used saying (?<textID>\d+) do (?<aTask2>[a-zA-Z0-9_.-]+)/;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new ItemUsedDo(parentQuest);
    action.itemSymbol = new QuestSymbol(g.anItem ?? g.anItem2);
    action.taskSymbol = new QuestSymbol(g.aTask ?? g.aTask2);
    action.textID = questParseInt(g.textID ?? '');
    return action;
  }
  update(_caller) {
    const item = this.parentQuest.getItem(this.itemSymbol);
    if (!item) return;
    item.actionWatching = true;
    if (item.useClicked) {
      if (this.textID !== 0) this.parentQuest.showMessagePopup(this.textID);
      this.parentQuest.startTask(this.taskSymbol);
      item.actionWatching = false;
      this.setComplete();
    }
  }
}

/** DialogLink.cs: registers dialog links with the talk system - one
 *  call per named resource (by SYMBOL name), then pair links both
 *  ways (by DISPLAY names). QUIRKS kept verbatim: the C# ships
 *  namePlace's assignment commented out, so place pair-links always
 *  carry an empty place name; the person display name pends the Q3
 *  Setup chain and the item name pends the Q2b-ii mint (both '' until
 *  their slices land - in DFU they are live strings). */
export class DialogLink extends ActionTemplate {
  static typeName = 'DialogLink';
  get saveShape() { return [['placeSymbol', 'sym'], ['npcSymbol', 'sym'], ['itemSymbol', 'sym']]; }
  get pattern() {
    return /dialog link for location (?<aSite>\w+) person (?<anNPC>\w+) item (?<anItem>\w+)|dialog link for location (?<aSite2>\w+) person (?<anNPC2>\w+)|dialog link for location (?<aSite3>\w+) item (?<anItem3>\w+)|dialog link for location (?<aSite4>\w+)|dialog link for person (?<anNPC5>\w+) item (?<anItem5>\w+)|dialog link for person (?<anNPC6>\w+)|dialog link for item (?<anItem7>\w+)/;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new DialogLink(parentQuest);
    const site = g.aSite ?? g.aSite2 ?? g.aSite3 ?? g.aSite4;
    const npc = g.anNPC ?? g.anNPC2 ?? g.anNPC5 ?? g.anNPC6;
    const item = g.anItem ?? g.anItem3 ?? g.anItem5 ?? g.anItem7;
    if (site) action.placeSymbol = new QuestSymbol(site);
    if (npc) action.npcSymbol = new QuestSymbol(npc);
    if (item) action.itemSymbol = new QuestSymbol(item);
    return action;
  }
  update(_caller) {
    const T = QUEST_INFO_RESOURCE_TYPE;
    const hooks = this.parentQuest.hooks;
    const uid = this.parentQuest.uid;
    const place = this.parentQuest.getPlace(this.placeSymbol ?? null);
    const person = this.parentQuest.getPerson(this.npcSymbol ?? null);
    const item = this.parentQuest.getItem(this.itemSymbol ?? null);
    let namePlace = '', namePerson = '', nameItem = '';
    // first the solo links for the separated resources (which hides them)
    if (place) {
      // C# leaves namePlace's buildingName assignment commented out
      hooks?.dialogLink?.(uid, place.symbol.name, T.Location);
    }
    if (person) {
      namePerson = person.displayName;
      hooks?.dialogLink?.(uid, person.symbol.name, T.Person);
    }
    if (item) {
      nameItem = item.daggerfallUnityItem?.itemName ?? '';   // Q2b-ii pends the mint
      hooks?.dialogLink?.(uid, item.symbol.name, T.Thing);
    }
    // then the pair links between the resources, both directions
    if (place && person) {
      hooks?.dialogLink?.(uid, namePlace, T.Location, namePerson, T.Person);
      hooks?.dialogLink?.(uid, namePerson, T.Person, namePlace, T.Location);
    }
    if (place && item) {
      hooks?.dialogLink?.(uid, namePlace, T.Location, nameItem, T.Thing);
      hooks?.dialogLink?.(uid, nameItem, T.Thing, namePlace, T.Location);
    }
    if (person && item) {
      hooks?.dialogLink?.(uid, namePerson, T.Person, nameItem, T.Thing);
      hooks?.dialogLink?.(uid, nameItem, T.Thing, namePerson, T.Person);
    }
    this.setComplete();
  }
}

/** AddDialog.cs: re-enables dialog for resources by SYMBOL name (its
 *  alternation order differs from DialogLink's - kept verbatim). */
export class AddDialog extends ActionTemplate {
  static typeName = 'AddDialog';
  get saveShape() { return [['placeSymbol', 'sym'], ['npcSymbol', 'sym'], ['itemSymbol', 'sym']]; }
  get pattern() {
    return /add dialog for location (?<aPlace>\w+) person (?<anNPC>\w+) item (?<anItem>\w+)|add dialog for person (?<anNPC2>\w+) item (?<anItem2>\w+)|add dialog for location (?<aPlace3>\w+) person (?<anNPC3>\w+)|add dialog for location (?<aPlace4>\w+) item (?<anItem4>\w+)|add dialog for location (?<aPlace5>\w+)|add dialog for person (?<anNPC6>\w+)|add dialog for item (?<anItem7>\w+)/;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new AddDialog(parentQuest);
    const place = g.aPlace ?? g.aPlace3 ?? g.aPlace4 ?? g.aPlace5;
    const npc = g.anNPC ?? g.anNPC2 ?? g.anNPC3 ?? g.anNPC6;
    const item = g.anItem ?? g.anItem2 ?? g.anItem4 ?? g.anItem7;
    if (place) action.placeSymbol = new QuestSymbol(place);
    if (npc) action.npcSymbol = new QuestSymbol(npc);
    if (item) action.itemSymbol = new QuestSymbol(item);
    return action;
  }
  update(_caller) {
    const T = QUEST_INFO_RESOURCE_TYPE;
    const hooks = this.parentQuest.hooks;
    const uid = this.parentQuest.uid;
    const place = this.parentQuest.getPlace(this.placeSymbol ?? null);
    const person = this.parentQuest.getPerson(this.npcSymbol ?? null);
    const item = this.parentQuest.getItem(this.itemSymbol ?? null);
    if (place) hooks?.addDialog?.(uid, place.symbol.name, T.Location, false);
    if (person) hooks?.addDialog?.(uid, person.symbol.name, T.Person, false);
    if (item) hooks?.addDialog?.(uid, item.symbol.name, T.Thing, false);
    this.setComplete();
  }
}

/** RumorMill.cs: hands the message to the talk rumor pool - even a
 *  missing message goes through (the hook receives null, as
 *  TalkManager does). */
export class RumorMill extends ActionTemplate {
  static typeName = 'RumorMill';
  get saveShape() { return [['id']]; }
  get pattern() { return /rumor mill (?<id>\d+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new RumorMill(parentQuest);
    action.id = questParseInt(match.groups.id);
    return action;
  }
  update(_caller) {
    const message = this.parentQuest.getMessage(this.id);
    this.parentQuest.hooks?.addQuestRumor?.(this.parentQuest.uid, message);
    this.setComplete();
  }
}

/** LegalRepute.cs: current region's LegalRep += amount then the
 *  clamp - both live with the G2 court system behind the
 *  changeLegalRep hook. ParseInt carries the sign. */
export class LegalRepute extends ActionTemplate {
  static typeName = 'LegalRepute';
  get saveShape() { return [['amount']]; }
  get pattern() { return /legal repute (?<amount>[+-]?\d+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new LegalRepute(parentQuest);
    action.amount = questParseInt(match.groups.amount);
    return action;
  }
  update(_caller) {
    this.parentQuest.hooks?.changeLegalRep?.(this.amount);
    this.setComplete();
  }
}

/** StartQuest.cs: "start quest N N" formats the classic index as
 *  S%07d ("start quest 500 500" -> S0000500) and schedules it through
 *  the machine's data seam (the QuestListsManager stand-in); a
 *  missing quest schedules nothing. The second index is unused, as in
 *  DFU. */
export class StartQuest extends ActionTemplate {
  static typeName = 'StartQuest';
  get saveShape() { return [['questIndex1'], ['questIndex2'], ['questName']]; }
  constructor(parentQuest) { super(parentQuest); this.allowRearm = false; }
  get pattern() { return /start quest (?<questIndex1>\d+) (?<questIndex2>\d+)|start quest (?<questName>\w+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new StartQuest(parentQuest);
    action.questIndex1 = questParseInt(g.questIndex1 ?? '');
    action.questIndex2 = questParseInt(g.questIndex2 ?? '');
    action.questName = g.questName ?? '';
    return action;
  }
  update(_caller) {
    if (!this.questName && this.questIndex1 > 0) {
      this.questName = `S${String(this.questIndex1).padStart(7, '0')}`;
    }
    this.parentQuest.hooks?.startQuest?.(this.questName);
    this.setComplete();
  }
}

// ---------------------------------------------------------------
// Q2b-ii - THE ITEM TRANCHE (the mint lives in item.js; these are
// its consumers, each riding the machine's player-inventory hooks)
// ---------------------------------------------------------------

/** Internal_Strings "youReceiveGoldPieces" (en id 195) - GetItem's
 *  HUD line, %s replaced by the stack amount, as TextManager does. */
export const YOU_RECEIVE_GOLD_PIECES = 'You receive %s gold pieces.';

/** GivePc.cs: the three formats - "give pc anItem" offers the reward
 *  through the QuestComplete box + loot window (and makes the item
 *  PERMANENT - Sx010's cursed item stays keepable); "give pc nothing"
 *  shows QuestComplete without loot; "give pc anItem notify nnnn" /
 *  "... silently" put the item straight in the inventory - but only
 *  in town, outdoors, between 07:00 and 18:00, after a 40..500-tick
 *  random delay (the Ledger A roll; DFU's OnOfferPending event has no
 *  port-side consumer yet - the guild questor UI is Q4). */
export class GivePc extends ActionTemplate {
  static typeName = 'GivePc';
  get saveShape() { return [['itemSymbol', 'sym'], ['textId'], ['isNothing'], ['silently']]; }
  constructor(parentQuest) {
    super(parentQuest);
    this.allowRearm = false;
    this.offerImmediately = false;
    this.waitingForTown = false;
    this.ticksUntilFire = 0;
  }
  get pattern() {
    return /give pc (?<nothing>nothing)|give pc (?<anItem>[a-zA-Z0-9_.]+) notify (?<id>\d+)|give pc (?<anItem2>[a-zA-Z0-9_.]+) (?<silently>silently)|give pc (?<anItem3>[a-zA-Z0-9_.]+)/;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new GivePc(parentQuest);
    action.itemSymbol = new QuestSymbol(g.anItem ?? g.anItem2 ?? g.anItem3 ?? '');
    action.textId = questParseInt(g.id ?? '');
    action.isNothing = !!g.nothing;
    action.silently = !!g.silently;
    return action;
  }
  update(_caller) {
    const minHour = 7, maxHour = 18, minDelay = 40, maxDelay = 500;
    const hooks = this.parentQuest.hooks;

    // The notify/silently forms wait for town, outdoors, and daytime
    if ((this.textId !== 0 || this.silently) && !this.offerImmediately) {
      const now = dateFromSeconds(this.parentQuest.nowSeconds?.() ?? 0);
      if (!hooks?.isPlayerInTown?.() || now.hour < minHour || now.hour > maxHour) {
        this.waitingForTown = true;
        this.ticksUntilFire = 0;
        return;
      }
      if (this.waitingForTown) {
        // Random.Range(minDelay, maxDelay + 1) so messages don't all land at once
        const roll = this.parentQuest.rolls ?? Math.random;
        this.ticksUntilFire = minDelay + Math.floor(roll() * (maxDelay + 1 - minDelay));
        this.waitingForTown = false;
      }
    }
    if (this.ticksUntilFire > 0) { this.ticksUntilFire--; return; }

    if (this.isNothing) {
      this._offerWithQuestComplete(null);
      this.setComplete();
      return;
    }
    const item = this.parentQuest.getItem(this.itemSymbol);
    if (!item) {
      console.warn(`[quest] Could not find Item resource symbol ${this.itemSymbol?.name}`);
      return;
    }
    if (this.textId !== 0) {
      this.parentQuest.hooks?.giveItemToPlayer?.(item.daggerfallUnityItem, true);   // AddPosition.Front
      this.parentQuest.showMessagePopup(this.textId);
    } else if (this.silently) {
      this.parentQuest.hooks?.giveItemToPlayer?.(item.daggerfallUnityItem, true);
    } else {
      this._offerWithQuestComplete(item);
    }
    this.offerImmediately = false;
    this.setComplete();
  }
  /** The guild questor UI calls this at hand-in (Q4). */
  offerImmediatelyNow() {
    this.waitingForTown = false;
    this.ticksUntilFire = 0;
    this.offerImmediately = true;
  }
  _offerWithQuestComplete(item) {
    this.parentQuest.questSuccess = true;
    this.parentQuest.showMessagePopup(QUEST_MESSAGES.QuestComplete);
    if (!item) return;
    // ReleaseQuestItemForReoffer(uid, item, TRUE): the reward stays
    // with the player past quest end - permanent first, then the
    // player-side sweep so the loot window can offer it back.
    makeItemPermanent(item.daggerfallUnityItem);
    this.parentQuest.hooks?.releaseQuestItem?.(this.parentQuest.uid, item);
    // The dropped-loot reward container + its open-on-dismiss wiring
    // is the Q4 window's; the hook receives the freed item.
    this.parentQuest.hooks?.offerReward?.(this.parentQuest, item.daggerfallUnityItem);
  }
}

/** GetItem.cs: gives the quest item (back) to the player - a gold
 *  stack lands as gold with the HUD line, anything else in the
 *  inventory at the front. "get item from" is the same action in DFU
 *  ("appears to behave identically"). */
export class GetItem extends ActionTemplate {
  static typeName = 'GetItem';
  get saveShape() { return [['itemSymbol', 'sym'], ['textId']]; }
  get pattern() {
    return /get item (?<anItem>[a-zA-Z0-9_.]+) saying (?<id>\d+)|get item (?<anItem2>[a-zA-Z0-9_.]+)/;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new GetItem(parentQuest);
    action.itemSymbol = new QuestSymbol(g.anItem ?? g.anItem2);
    action.textId = questParseInt(g.id ?? '');
    return action;
  }
  update(_caller) {
    const item = this.parentQuest.getItem(this.itemSymbol);
    if (!item) {
      console.warn(`[quest] Could not find Item resource symbol ${this.itemSymbol?.name}`);
      return;
    }
    const hooks = this.parentQuest.hooks;
    hooks?.releaseQuestItem?.(this.parentQuest.uid, item);
    const dfItem = item.daggerfallUnityItem;
    if (dfItem && dfItem.group === 'Currency') {
      const amount = dfItem.stackCount ?? 0;
      hooks?.addGold?.(amount);
      hooks?.addHUDText?.(YOU_RECEIVE_GOLD_PIECES.replace('%s', String(amount)));
    } else {
      hooks?.giveItemToPlayer?.(dfItem, true);   // AddPosition.Front
    }
    if (this.textId !== 0) this.parentQuest.showMessagePopup(this.textId);
    this.setComplete();
  }
}

/** TakeItem.cs: releases the quest item from the player (unequip +
 *  remove, the host sweep) - the item just stops being carried. */
export class TakeItem extends ActionTemplate {
  static typeName = 'TakeItem';
  get saveShape() { return [['itemSymbol', 'sym'], ['textId']]; }
  get pattern() {
    return /take (?<anItem>[a-zA-Z0-9_.]+) from pc saying (?<id>\d+)|take (?<anItem2>[a-zA-Z0-9_.]+) from pc/;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new TakeItem(parentQuest);
    action.itemSymbol = new QuestSymbol(g.anItem ?? g.anItem2);
    action.textId = questParseInt(g.id ?? '');
    return action;
  }
  update(_caller) {
    const item = this.parentQuest.getItem(this.itemSymbol);
    if (!item) {
      console.warn(`[quest] Could not find Item resource symbol ${this.itemSymbol?.name}`);
      return;
    }
    this.parentQuest.hooks?.releaseQuestItem?.(this.parentQuest.uid, item);
    if (this.textId !== 0) this.parentQuest.showMessagePopup(this.textId);
    this.setComplete();
  }
}

/** HaveItem.cs: starts the target task while the player carries the
 *  quest item - NO SetComplete on the carry branch, so it keeps
 *  checking (and keeps re-starting) every tick, verbatim. */
export class HaveItem extends ActionTemplate {
  static typeName = 'HaveItem';
  get saveShape() { return [['targetItem', 'sym'], ['targetTask', 'sym']]; }
  get pattern() { return /have (?<targetItem>[a-zA-Z0-9_.-]+) set (?<targetTask>[a-zA-Z0-9_.-]+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new HaveItem(parentQuest);
    action.targetItem = new QuestSymbol(match.groups.targetItem);
    action.targetTask = new QuestSymbol(match.groups.targetTask);
    return action;
  }
  update(_caller) {
    const item = this.parentQuest.getItem(this.targetItem);
    if (!item) {
      this.setComplete();
      throw new Error(`Could not find Item resource symbol ${this.targetItem?.name}`);
    }
    if (this.parentQuest.hooks?.carriesQuestItem?.(item)) {
      this.parentQuest.startTask(this.targetTask);
    }
  }
}

/** TotingItemAndClickedNpc.cs: ClickedNpc plus the carried-item
 *  check; on success the click is consumed, the message pops (id 0
 *  passes through and shows nothing, as C#), and the item releases
 *  for re-offer. */
export class TotingItemAndClickedNpc extends ActionTemplate {
  static typeName = 'TotingItemAndClickedNpc';
  get saveShape() { return [['itemSymbol', 'sym'], ['npcSymbol', 'sym'], ['id']]; }
  constructor(parentQuest) { super(parentQuest); this.isTriggerCondition = true; }
  get pattern() {
    return /toting (?<anItem>[a-zA-Z0-9_.]+) and (?<anNPC>[a-zA-Z0-9_.-]+) clicked saying (?<id>\d+)|toting (?<anItem2>[a-zA-Z0-9_.]+) and (?<anNPC2>[a-zA-Z0-9_.-]+) clicked saying (?<idName>\w+)|toting (?<anItem3>[a-zA-Z0-9_.]+) and (?<anNPC3>[a-zA-Z0-9_.-]+) clicked/;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new TotingItemAndClickedNpc(parentQuest);
    action.itemSymbol = new QuestSymbol(g.anItem ?? g.anItem2 ?? g.anItem3);
    action.npcSymbol = new QuestSymbol(g.anNPC ?? g.anNPC2 ?? g.anNPC3);
    action.id = questParseInt(g.id ?? '');
    if (action.id === 0 && g.idName) {
      action.id = questParseInt(staticMessagesTable().getValue('id', g.idName));
    }
    return action;
  }
  checkTrigger(caller) {
    if (caller.getTriggerValue()) return true;
    const person = this.parentQuest.getPerson(this.npcSymbol);
    if (!person) return false;
    const item = this.parentQuest.getItem(this.itemSymbol);
    if (!item) return false;
    if (person.hasPlayerClicked) {
      if (this.parentQuest.hooks?.carriesQuestItem?.(item)) {
        this.parentQuest.scheduleClickRearm(person);
        this.parentQuest.showMessagePopup(this.id);
        this.parentQuest.hooks?.releaseQuestItem?.(this.parentQuest.uid, item);
        return true;
      }
    }
    return false;
  }
}

/** GiveItem.cs: hands the quest item to a Foe's item queue (cloned
 *  onto instances when Q3 spawns them) or to a generic entity in the
 *  scene - no scene object yet means the non-Foe arm keeps trying,
 *  exactly as C# does for a target not in the world; the entity/
 *  corpse-container halves ride Q3's behaviours. If the player holds
 *  the item it leaves their inventory. */
export class GiveItem extends ActionTemplate {
  static typeName = 'GiveItem';
  get saveShape() { return [['itemSymbol', 'sym'], ['targetSymbol', 'sym']]; }
  get pattern() { return /give item (?<anItem>[a-zA-Z0-9_.]+) to (?<aResource>[a-zA-Z0-9_.]+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new GiveItem(parentQuest);
    action.itemSymbol = new QuestSymbol(match.groups.anItem);
    action.targetSymbol = new QuestSymbol(match.groups.aResource);
    return action;
  }
  update(_caller) {
    const item = this.parentQuest.getItem(this.itemSymbol);
    if (!item) {
      this.setComplete();
      throw new Error(`Could not find Item resource symbol ${this.itemSymbol?.name}`);
    }
    const target = this.parentQuest.getResource(this.targetSymbol);
    if (!target) {
      this.setComplete();
      throw new Error(`Could not find target resource symbol ${this.targetSymbol?.name}`);
    }
    if (target.isFoe) {
      target.queueItem(item.daggerfallUnityItem);
      // Q3 FLAG: a target already standing in the scene dequeues onto
      // its entity immediately (QuestResourceBehaviour.AddItemQueue).
    } else {
      // Target must exist in the world; nothing stands in scenes yet
      if (!target.questResourceBehaviour) return;
      // Q3 FLAG: the live-entity / corpse-loot-container arms.
    }
    const hooks = this.parentQuest.hooks;
    if (hooks?.playerHasItem?.(item.daggerfallUnityItem)) {
      hooks?.removeItemFromPlayer?.(item.daggerfallUnityItem);
    }
    this.setComplete();
  }
}

/** MakePermanent.cs: converts the quest item to a permanent one (the
 *  resource method syncs the virtual item, the current instance, and
 *  every held copy); a missing Item completes then THROWS. */
export class MakePermanent extends ActionTemplate {
  static typeName = 'MakePermanent';
  get saveShape() { return [['target', 'sym']]; }
  get pattern() { return /make (?<target>[a-zA-Z0-9_.-]+) permanent/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new MakePermanent(parentQuest);
    action.target = new QuestSymbol(match.groups.target);
    return action;
  }
  update(_caller) {
    const item = this.parentQuest.getItem(this.target);
    if (!item) {
      this.setComplete();
      throw new Error(`Could not find Item resource symbol ${this.target?.name}`);
    }
    item.makePermanent();
    this.setComplete();
  }
}

// ---------------------------------------------------------------
// Q3-i - THE PLACE TRANCHE (site binding lives in place.js; these
// consume it through the SiteLink machinery and the world seam)
// ---------------------------------------------------------------

/** PlaceNpc.cs: reserve the SiteLink, then pin the Person to the
 *  Place's marker; a destroyed person is a silent complete; an
 *  individual who is supposed to be atHome is an ERROR LOG, not a
 *  throw. Placing also unhides. */
export class PlaceNpc extends ActionTemplate {
  static typeName = 'PlaceNpc';
  get saveShape() { return [['npcSymbol', 'sym'], ['placeSymbol', 'sym'], ['marker']]; }
  get pattern() {
    return /place npc (?<anNPC>[a-zA-Z0-9_.-]+) at (?<aPlace>\w+) marker (?<marker>\d+)|place npc (?<anNPC2>[a-zA-Z0-9_.-]+) at (?<aPlace2>\w+)/;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new PlaceNpc(parentQuest);
    action.npcSymbol = new QuestSymbol(g.anNPC ?? g.anNPC2);
    action.placeSymbol = new QuestSymbol(g.aPlace ?? g.aPlace2);
    action.marker = g.marker != null ? questParseInt(g.marker) : -1;
    return action;
  }
  update(_caller) {
    const hooks = this.parentQuest.hooks;
    if (!hooks?.hasSiteLink?.(this.parentQuest, this.placeSymbol)) {
      hooks?.createSiteLink?.(this.parentQuest, this.placeSymbol);
    }
    const person = this.parentQuest.getPerson(this.npcSymbol);
    if (!person) {
      this.setComplete();
      throw new Error(`Could not find Person resource symbol ${this.npcSymbol?.name}`);
    }
    if (person.isDestroyed) { this.setComplete(); return; }
    const place = this.parentQuest.getPlace(this.placeSymbol);
    if (!place) {
      this.setComplete();
      throw new Error(`Could not find Place resource symbol ${this.placeSymbol?.name}`);
    }
    if (person.isIndividualNPC && person.isIndividualAtHome) {
      console.warn(`[quest] Quest tried to place Person ${person.displayName} [_${person.symbol.name}_] at Place _${place.symbol.name}_ but they are supposed to be atHome`);
      this.setComplete();
      return;
    }
    place.assignQuestResource(person.symbol, this.marker);
    person.setAssignedPlaceSymbol(this.placeSymbol);
    person.isHidden = false;
    hooks?.forceTopicListsUpdate?.();
    this.setComplete();
  }
}

/** PlaceItem.cs: the marker/questmarker/anymarker forms map to
 *  MarkerPreference verbatim. */
export class PlaceItem extends ActionTemplate {
  static typeName = 'PlaceItem';
  get saveShape() { return [['itemSymbol', 'sym'], ['placeSymbol', 'sym'], ['marker'], ['markerPreference']]; }
  get pattern() {
    return /place item (?<anItem>[a-zA-Z0-9_.-]+) at (?<aPlace>[a-zA-Z0-9_.-]+) marker (?<marker>\d+)|place item (?<anItem2>[a-zA-Z0-9_.-]+) at (?<aPlace2>[a-zA-Z0-9_.-]+) questmarker (?<questmarker>\d+)|place item (?<anItem3>[a-zA-Z0-9_.-]+) at (?<aPlace3>[a-zA-Z0-9_.-]+) (?<anymarker>anymarker)|place item (?<anItem4>[a-zA-Z0-9_.-]+) at (?<aPlace4>[a-zA-Z0-9_.-]+)/;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new PlaceItem(parentQuest);
    action.itemSymbol = new QuestSymbol(g.anItem ?? g.anItem2 ?? g.anItem3 ?? g.anItem4);
    action.placeSymbol = new QuestSymbol(g.aPlace ?? g.aPlace2 ?? g.aPlace3 ?? g.aPlace4);
    action.marker = -1;
    action.markerPreference = MARKER_PREFERENCE.Default;
    if (g.marker != null) action.marker = questParseInt(g.marker);
    if (g.questmarker != null) {
      action.marker = questParseInt(g.questmarker);
      action.markerPreference = MARKER_PREFERENCE.UseQuestMarker;
    }
    if (g.anymarker != null) action.markerPreference = MARKER_PREFERENCE.AnyMarker;
    return action;
  }
  update(_caller) {
    const hooks = this.parentQuest.hooks;
    if (!hooks?.hasSiteLink?.(this.parentQuest, this.placeSymbol)) {
      hooks?.createSiteLink?.(this.parentQuest, this.placeSymbol);
    }
    const item = this.parentQuest.getItem(this.itemSymbol);
    if (!item) {
      this.setComplete();
      throw new Error(`Could not find Item resource symbol ${this.itemSymbol?.name}`);
    }
    const place = this.parentQuest.getPlace(this.placeSymbol);
    if (!place) {
      this.setComplete();
      throw new Error(`Could not find Place resource symbol ${this.placeSymbol?.name}`);
    }
    place.assignQuestResource(item.symbol, this.marker, this.markerPreference);
    this.setComplete();
  }
}

/** PlaceFoe.cs. */
export class PlaceFoe extends ActionTemplate {
  static typeName = 'PlaceFoe';
  get saveShape() { return [['foeSymbol', 'sym'], ['placeSymbol', 'sym'], ['marker']]; }
  get pattern() {
    return /place foe (?<aFoe>[a-zA-Z0-9_.-]+) at (?<aPlace>[a-zA-Z0-9_.-]+) marker (?<marker>\d+)|place foe (?<aFoe2>[a-zA-Z0-9_.-]+) at (?<aPlace2>[a-zA-Z0-9_.-]+)/;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new PlaceFoe(parentQuest);
    action.foeSymbol = new QuestSymbol(g.aFoe ?? g.aFoe2);
    action.placeSymbol = new QuestSymbol(g.aPlace ?? g.aPlace2);
    action.marker = g.marker != null ? questParseInt(g.marker) : -1;
    return action;
  }
  update(_caller) {
    const hooks = this.parentQuest.hooks;
    if (!hooks?.hasSiteLink?.(this.parentQuest, this.placeSymbol)) {
      hooks?.createSiteLink?.(this.parentQuest, this.placeSymbol);
    }
    const foe = this.parentQuest.getFoe(this.foeSymbol);
    if (!foe) {
      this.setComplete();
      throw new Error(`Could not find Foe resource symbol ${this.foeSymbol?.name}`);
    }
    const place = this.parentQuest.getPlace(this.placeSymbol);
    if (!place) {
      this.setComplete();
      throw new Error(`Could not find Place resource symbol ${this.placeSymbol?.name}`);
    }
    place.assignQuestResource(foe.symbol, this.marker);
    this.setComplete();
  }
}

/** PcAt.cs: a CONTINUOUS set/clear toggle - never completes. The
 *  place-symbol form asks the Place; the "pc at any TYPE" form goes
 *  through Quests-Places as a placeType, which must be a building
 *  (p1=0) or dungeon (p1=1) row. The saying shows ONCE. */
export class PcAt extends ActionTemplate {
  static typeName = 'PcAt';
  get saveShape() { return [['placeSymbol', 'sym'], ['taskSymbol', 'sym'], ['textId'], ['textShown'], ['p1'], ['p2'], ['p3']]; }
  get pattern() {
    return /pc at (?<aPlace>\w+) set (?<aTask>[a-zA-Z0-9_.]+) saying (?<id>\d+)|pc at (?<aPlace2>\w+) set (?<aTask2>[a-zA-Z0-9_.]+)|pc at (?<aPlace3>\w+) do (?<aTask3>[a-zA-Z0-9_.]+) saying (?<id2>\d+)|pc at (?<aPlace4>\w+) do (?<aTask4>[a-zA-Z0-9_.]+)|pc at any (?<placeType>\w+) set (?<aTask5>[a-zA-Z0-9_.]+) saying (?<id3>\d+)|pc at any (?<placeType2>\w+) set (?<aTask6>[a-zA-Z0-9_.]+)|pc at any (?<placeType3>\w+) do (?<aTask7>[a-zA-Z0-9_.]+) saying (?<id4>\d+)|pc at any (?<placeType4>\w+) do (?<aTask8>[a-zA-Z0-9_.]+)/;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new PcAt(parentQuest);
    const placeType = g.placeType ?? g.placeType2 ?? g.placeType3 ?? g.placeType4;
    if (!placeType) {
      action.placeSymbol = new QuestSymbol(g.aPlace ?? g.aPlace2 ?? g.aPlace3 ?? g.aPlace4);
    } else {
      const table = placesTable();
      if (!table.hasValue(placeType)) throw new Error(`PcAt: Could not find place type name in data table: '${placeType}'`);
      const p1 = customParseInt(table.getValue('p1', placeType));
      if (p1 !== 0 && p1 !== 1) {
        throw new Error('PcAt: This trigger condition can only be used with building types (p1=0) and dungeon types (p1=1) in Quests-Places table.');
      }
      action.p1 = p1;
      action.p2 = customParseInt(table.getValue('p2', placeType));
      action.p3 = customParseInt(table.getValue('p3', placeType));
      action.placeSymbol = null;
    }
    action.taskSymbol = new QuestSymbol(g.aTask ?? g.aTask2 ?? g.aTask3 ?? g.aTask4 ?? g.aTask5 ?? g.aTask6 ?? g.aTask7 ?? g.aTask8);
    action.textId = questParseInt(g.id ?? g.id2 ?? g.id3 ?? g.id4 ?? '');
    action.textShown = false;
    return action;
  }
  update(_caller) {
    let result;
    if (this.placeSymbol !== null) {
      const place = this.parentQuest.getPlace(this.placeSymbol);
      if (!place) return;
      result = place.isPlayerHere();
    } else {
      const world = this.parentQuest.hooks?.world;
      result = this.p1 === 1 ? isPlayerAtDungeonType(world, this.p2) : isPlayerAtBuildingType(world, this.p2, this.p3);
    }
    if (result) {
      if (this.textId !== 0 && !this.textShown) {
        this.parentQuest.showMessagePopup(this.textId);
        this.textShown = true;
      }
      this.parentQuest.startTask(this.taskSymbol);
    } else {
      this.parentQuest.clearTask(this.taskSymbol);
    }
  }
}

/** RevealLocation.cs: discover the Place's location on the travel
 *  map; the readmap form also notes it in the journal. */
export class RevealLocation extends ActionTemplate {
  static typeName = 'RevealLocation';
  get saveShape() { return [['placeSymbol', 'sym'], ['readMap']]; }
  get pattern() { return /reveal (?<aPlace>\w+) (?<readMap>readmap)|reveal (?<aPlace2>\w+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new RevealLocation(parentQuest);
    action.placeSymbol = new QuestSymbol(g.aPlace ?? g.aPlace2);
    action.readMap = !!g.readMap;
    return action;
  }
  update(_caller) {
    const place = this.parentQuest.getPlace(this.placeSymbol);
    if (!place) return;
    const world = this.parentQuest.hooks?.world;
    world?.discoverLocation?.(place.siteDetails?.regionName, place.siteDetails?.locationName);
    if (this.readMap) {
      world?.addNote?.(READ_MAP_NOTE.replace('%map', place.siteDetails?.locationName ?? ''));
    }
    this.setComplete();
  }
}

/** TeleportPc.cs: move the player to the Place (optionally a specific
 *  spawn marker), TWO-PHASE (Q4-iii, the arrival law): the first live
 *  tick starts the site respawn (world.respawnPlayerAtSite - C#'s
 *  GetLocation + RespawnPlayer; false = unresolvable location, retry);
 *  while world.isRespawning() the action idles; the tick AFTER the
 *  respawn completes lands the player on the marker position
 *  (world.setPlayerScenePosition) and completes. RearmAction lowers
 *  resumePending - a rearmed teleport is a NEW instance and must not
 *  land a stale position (C#'s desync note). With no world seam the
 *  action keeps trying, exactly a not-in-scene target. The
 *  save-resume half rides the session restore (recorded, Q4-iv:
 *  resumePending/resumePosition are NOT in C#'s save shape, so a
 *  mid-flight teleport re-runs whole after load). */
export class TeleportPc extends ActionTemplate {
  static typeName = 'TeleportPc';
  get saveShape() { return [['targetPlace', 'sym'], ['targetMarker']]; }
  constructor(parentQuest) {
    super(parentQuest);
    this.resumePending = false;
    this.resumePosition = null;
  }
  get pattern() {
    return /teleport pc to (?<aPlace>[a-zA-Z0-9_.-]+)|transfer pc inside (?<aPlace2>[a-zA-Z0-9_.-]+) marker (?<marker>\d+)/;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new TeleportPc(parentQuest);
    action.targetPlace = new QuestSymbol(g.aPlace ?? g.aPlace2);
    action.targetMarker = g.marker != null ? questParseInt(g.marker) : -1;
    return action;
  }
  rearmAction() {
    super.rearmAction();
    this.resumePending = false;
  }
  update(_caller) {
    const hooks = this.parentQuest.hooks;
    const world = hooks?.world;
    // Do nothing while player respawning
    if (world?.isRespawning?.()) return;
    // Handle resume on the next tick after the respawn completes
    if (this.resumePending) {
      world.setPlayerScenePosition?.(this.resumePosition);
      this.resumePending = false;
      this.setComplete();
      return;
    }
    // AUDIT 24 (the seven-slice sweep): the transport-seam guard used
    // to sit at the TOP of this method, above the SiteLink write - so
    // on a host that has not mounted respawnPlayerAtSite (which is
    // today's port; it is a declared pending) the link was never
    // created at all, where C# writes it every tick regardless of what
    // the transport does. The SiteLink is machine state other actions
    // read; it is not the transport's to withhold.
    if (!hooks?.hasSiteLink?.(this.parentQuest, this.targetPlace)) {
      hooks?.createSiteLink?.(this.parentQuest, this.targetPlace);
    }
    const place = this.parentQuest.getPlace(this.targetPlace);
    if (!place) return;
    // The indexed marker is picked BEFORE the respawn, the [0]
    // fallback AFTER (C#'s order); an unresolvable location returns
    // before any respawn begins.
    //
    // AUDIT 24: `.questSpawnMarkers.length` UNGUARDED, as C# reads it
    // (:102). A site whose marker array is null NREs right here, before
    // any respawn begins; the port's `?? 0` sent it down the
    // usingMarker=false path instead, which respawned the player and
    // THEN threw on the [0] below - a teleport half-done.
    let usingMarker = false;
    let marker = null;
    if (this.targetMarker >= 0 && this.targetMarker < place.siteDetails.questSpawnMarkers.length) {
      marker = place.siteDetails.questSpawnMarkers[this.targetMarker];
      usingMarker = true;
    }
    if (!world?.respawnPlayerAtSite) return;   // no transport - keep trying
    if (!world.respawnPlayerAtSite(place)) return;
    // The usingMarker=false path still positions at spawn marker 0
    // (TeleportPc.cs:120-135) - EVERY plain "teleport pc to" lands on
    // the site's first spawn marker, and a site without one NREs in
    // C# (the quest error-terminates; the natural throw here matches).
    if (!usingMarker) marker = place.siteDetails.questSpawnMarkers[0];
    this.resumePosition = markerScenePosition(marker);
    this.resumePending = true;
  }
}

/** DroppedItemAtPlace.cs: the trigger arms the item's actionWatching,
 *  gates allowDrop on the player being AT the place, and fires when
 *  the player drops it there, saying once. */
export class DroppedItemAtPlace extends ActionTemplate {
  static typeName = 'DroppedItemAtPlace';
  get saveShape() { return [['itemSymbol', 'sym'], ['placeSymbol', 'sym'], ['textId'], ['textShown']]; }
  constructor(parentQuest) {
    super(parentQuest);
    // DroppedItemAtPlace.cs:34-35 - an ALWAYS-ON trigger: first in a
    // task it claims the primary slot and demotes later always-ons to
    // start-only (Q3-i VERIFY: the flag was dropped).
    this.isTriggerCondition = true;
    this.isAlwaysOnTriggerCondition = true;
  }
  get pattern() {
    return /dropped (?<anItem>[a-zA-Z0-9_.-]+) at (?<aPlace>[a-zA-Z0-9_.-]+) saying (?<id>\d+)|dropped (?<anItem2>[a-zA-Z0-9_.-]+) at (?<aPlace2>[a-zA-Z0-9_.-]+)/;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new DroppedItemAtPlace(parentQuest);
    action.itemSymbol = new QuestSymbol(g.anItem ?? g.anItem2);
    action.placeSymbol = new QuestSymbol(g.aPlace ?? g.aPlace2);
    action.textId = questParseInt(g.id ?? '');
    action.textShown = false;
    return action;
  }
  checkTrigger(caller) {
    if (caller.getTriggerValue()) return true;
    const item = this.parentQuest.getItem(this.itemSymbol);
    if (!item) return false;
    const place = this.parentQuest.getPlace(this.placeSymbol);
    if (!place) return false;
    item.actionWatching = true;
    if (place.isPlayerHere()) {
      item.allowDrop = true;
    } else {
      item.allowDrop = false;
      return false;
    }
    if (item.playerDropped) {
      if (this.textId !== 0 && !this.textShown) {
        this.parentQuest.showMessagePopup(this.textId);
        this.textShown = true;
      }
      this.setComplete();
      return true;
    }
    return false;
  }
}

/** ChangeReputeWith.cs (Q3-ii): the player's reputation with the
 *  Person's FACTION moves by the signed amount, through the
 *  PROPAGATING overload (allies/enemies/tree spread - the same
 *  propagate=TRUE law Quest.cs:385 carries). A missing person is a
 *  silent complete. */
export class ChangeReputeWith extends ActionTemplate {
  static typeName = 'ChangeReputeWith';
  get saveShape() { return [['target', 'sym'], ['amount']]; }
  // ChangeReputeWith.cs:33 - the reputation move fires ONCE ever; a
  // task rearm must not repeat it (AUDIT VI)
  constructor(parentQuest) { super(parentQuest); this.allowRearm = false; }
  get pattern() { return /change repute with (?<target>[a-zA-Z0-9_.-]+) by (?<sign>[+-])(?<amount>\d+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new ChangeReputeWith(parentQuest);
    action.target = new QuestSymbol(g.target);
    action.amount = (g.sign === '-' ? -1 : 1) * questParseInt(g.amount);
    return action;
  }
  update(_caller) {
    const person = this.parentQuest.getPerson(this.target);
    if (!person) { this.setComplete(); return; }
    this.parentQuest.hooks?.changeReputation?.(person.factionId, this.amount, true);
    this.setComplete();
  }
}

/** ReputeExceedsDo.cs (Q3-ii): starts the task once the player's
 *  reputation with the Person's faction reaches the bar - checked
 *  every tick until it does (no complete before then). */
export class ReputeExceedsDo extends ActionTemplate {
  static typeName = 'ReputeExceedsDo';
  get saveShape() { return [['npcSymbol', 'sym'], ['taskSymbol', 'sym'], ['minReputation']]; }
  get pattern() { return /repute with (?<npcSymbol>[a-zA-Z0-9_.-]+) exceeds (?<minReputation>\d+) do (?<taskSymbol>[a-zA-Z0-9_.]+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new ReputeExceedsDo(parentQuest);
    action.npcSymbol = new QuestSymbol(g.npcSymbol);
    action.minReputation = questParseInt(g.minReputation);
    action.taskSymbol = new QuestSymbol(g.taskSymbol);
    return action;
  }
  update(_caller) {
    const person = this.parentQuest.getPerson(this.npcSymbol);
    if (!person) return;
    if ((this.parentQuest.hooks?.getReputation?.(person.factionId) ?? 0) < this.minReputation) return;
    this.parentQuest.startTask(this.taskSymbol);
    this.setComplete();
  }
}

/** CreateNpc.cs (Q3-ii): places the person at their generated home
 *  Place (Person.PlaceAtHome); a missing person completes then
 *  THROWS; a person with no home just logs. */
export class CreateNpc extends ActionTemplate {
  static typeName = 'CreateNpc';
  get saveShape() { return [['npcSymbol', 'sym']]; }
  get pattern() { return /create npc (?<anNPC>[a-zA-Z0-9_.-]+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new CreateNpc(parentQuest);
    action.npcSymbol = new QuestSymbol(match.groups.anNPC);
    return action;
  }
  update(_caller) {
    const person = this.parentQuest.getPerson(this.npcSymbol);
    if (!person) {
      this.setComplete();
      throw new Error(`Could not find Person resource symbol ${this.npcSymbol?.name}`);
    }
    person.placeAtHome();
    this.setComplete();
  }
}

/** CreateFoe.cs (Q3-iii) - the tick-driven spawn law. The parse and
 *  the interval/chance/counter/msg-once law are machine state; the
 *  scene halves ride two seam members (contract in machine.js):
 *  world.createFoeGameObjects(foe, count) - GameObjectHelper's mint,
 *  one opaque handle per pending instance, inactive until placed -
 *  and world.tryPlaceFoe(handle) - TryPlacement's dispatch +
 *  PlaceFoeFreely's raycast placement just outside the player's
 *  view, answering true when THIS handle stood (a false is retried
 *  next tick, verbatim). world.raiseOnEncounterEvent rides along.
 *  HEADLESS (or a world without the spawn seam) the update returns
 *  before any progress - the corpus charter. Q4-iii: the exterior-
 *  transition/init-world invalidations land below (the machine's
 *  notifyExteriorTransition/notifyInitWorld fan them out where C#
 *  subscribes each instance in its ctor); the save envelope's
 *  in-flight-wave loss stays Q4-iv's row. */
export class CreateFoe extends ActionTemplate {
  static typeName = 'CreateFoe';
  get saveShape() { return [['foeSymbol', 'sym'], ['lastSpawnTime'], ['spawnInterval'], ['spawnMaxTimes'], ['spawnChance'], ['spawnCounter'], ['isSendAction'], ['msgMessageID']]; }
  constructor(parentQuest) {
    super(parentQuest);
    this.foeSymbol = null;
    this.spawnInterval = 0;      // seconds
    this.spawnMaxTimes = -1;     // -1 = infinite
    this.spawnChance = 0;
    this.msgMessageID = -1;
    this.lastSpawnTime = 0;
    this.spawnCounter = 0;
    this.isSendAction = false;
    // transient scene state (CreateFoe.cs:37-39) - NOT save state:
    // an in-flight wave is lost on save/load, as in DFU
    this.spawnInProgress = false;
    this.pendingFoes = null;
    this.pendingFoesSpawned = 0;
  }

  get pattern() {
    // C# reuses group names across alternates; JS suffixes and coalesces
    return new RegExp(
      'create foe (?<symbol>[a-zA-Z0-9_.-]+) every (?<minutes>\\d+) minutes (?<infinite>indefinitely) with (?<percent>\\d+)% success'
      + '|create foe (?<symbol2>[a-zA-Z0-9_.-]+) every (?<minutes2>\\d+) minutes (?<count>\\d+) times with (?<percent2>\\d+)% success'
      + '|(?<send>send) (?<symbol3>[a-zA-Z0-9_.-]+) every (?<minutes3>\\d+) minutes (?<count2>\\d+) times with (?<percent3>\\d+)% success'
      + '|(?<send2>send) (?<symbol4>[a-zA-Z0-9_.-]+) every (?<minutes4>\\d+) minutes with (?<percent4>\\d+)% success');
  }

  /** InitialiseOnSet (CreateFoe.cs:61-65): a task rearm restarts the
   *  spawn cycle whole. */
  initialiseOnSet() {
    this.lastSpawnTime = 0;
    this.spawnCounter = 0;
  }

  /** PlayerEnterExit_OnTransitionExterior (CreateFoe.cs:366-371):
   *  foes pending placement into a dungeon or building interior are
   *  invalid once the player steps outside. */
  onTransitionExterior() {
    this.pendingFoes = null;
    this.spawnInProgress = false;
  }

  /** StreamingWorld_OnInitWorld (CreateFoe.cs:373-377): a streaming-
   *  world rebuild orphans the loose-object container the same way. */
  onInitWorld() {
    this.pendingFoes = null;
    this.spawnInProgress = false;
  }

  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new CreateFoe(parentQuest);
    action.foeSymbol = new QuestSymbol(g.symbol ?? g.symbol2 ?? g.symbol3 ?? g.symbol4);
    action.spawnInterval = questParseInt(g.minutes ?? g.minutes2 ?? g.minutes3 ?? g.minutes4) * 60;
    const count = g.count ?? g.count2;
    action.spawnMaxTimes = count != null ? questParseInt(count) : 0;
    action.spawnChance = questParseInt(g.percent ?? g.percent2 ?? g.percent3 ?? g.percent4);
    if (g.infinite != null) action.spawnMaxTimes = -1;
    if ((g.send ?? g.send2) != null) {
      action.isSendAction = true;
      // "send" without a count implies infinite
      if (action.spawnMaxTimes === 0) action.spawnMaxTimes = -1;
    }
    // options ride source.Substring(match.Length) - C# slices by the
    // match LENGTH regardless of where the match began, verbatim.
    // AUDIT 24 (the seven-slice sweep): C# walks the WHOLE
    // MatchCollection - `foreach (Match option in options)` reassigns
    // action.msgMessageID on every hit, so a line carrying two `msg`
    // options keeps the LAST. The port had `.exec`, which keeps the
    // first.
    for (const msg of source.slice(match[0].length).matchAll(/msg (?<msgId>\d+)/g)) {
      action.msgMessageID = questParseInt(msg.groups.msgId);
    }
    return action;
  }

  /** CreateFoe.cs:110 - `(uint)UnityEngine.Random.Range(0, spawnInterval)`.
   *  spawnInterval is a uint, and uint has NO implicit conversion to
   *  int, so overload resolution binds Range(FLOAT, float) (inclusive
   *  max), not Range(int, int); the (uint) cast then truncates, which
   *  lands the same 0..n-1 uniform the int overload would have. What
   *  is NOT the same is the DRAW: C# calls Range unconditionally, and
   *  the corpus is full of `every 0 minutes` (S0000008, S0000503,
   *  M0B21Y19, N0B00Y16), so an `n > 0 ?` guard here skipped a draw on
   *  every one of them and slid the quest's whole roll stream. The
   *  draw is unconditional; floor(r * 0) is 0 either way. */
  _range(n) { return Math.floor((this.parentQuest?.rolls ?? Math.random)() * n); }

  update(_caller) {
    const world = this.parentQuest.hooks?.world;
    if (!world?.createFoeGameObjects) return;   // headless / spawn seam absent - the charter

    const gameSeconds = this.parentQuest.nowSeconds?.() ?? 0;
    // First update: backdate the timer a random distance into the
    // interval so the first spawn lands anywhere within one cycle
    // (Range(0, interval) on the quest's injectable rolls - see _range
    // for the overload and the unconditional draw)
    if (this.lastSpawnTime === 0) this.lastSpawnTime = gameSeconds - this._range(this.spawnInterval);

    // Max spawns reached - cleared only by a set/rearm
    if (this.spawnCounter >= this.spawnMaxTimes && this.spawnMaxTimes !== -1) return;

    // The wave finished deploying: count it and end this cycle
    if (this.spawnInProgress && this.pendingFoesSpawned >= this.pendingFoes.length) {
      this.spawnInProgress = false;
      this.spawnCounter++;
      return;
    }

    // A new spawn event - only one can be in flight at a time
    if (gameSeconds >= this.lastSpawnTime + this.spawnInterval && !this.spawnInProgress) {
      // the interval is consumed BEFORE the chance roll - a failed
      // roll still waits out a full cycle
      this.lastSpawnTime = gameSeconds;
      if (this._range(100) >= this.spawnChance) return;   // Dice100.FailedRoll
      const foe = this.parentQuest.getFoe(this.foeSymbol);
      if (!foe) {
        this.setComplete();
        // C# formats the action's own never-assigned Symbol (NREs
        // before the message renders) - the same quirk as
        // CastSpellOnFoe; either way the quest error-terminates
        throw new Error(`create foe could not find Foe with symbol name ${this.symbol?.name}`);
      }
      if (foe.isHidden) return;   // hidden blocks the spawn; the interval is already spent
      this._createPendingFoeSpawn(world, foe);
    }

    // One placement attempt per tick while a wave is pending
    if (this.spawnInProgress) {
      this._tryPlacement(world);
      world.raiseOnEncounterEvent?.();
    }
  }

  /** RestoreSaveData (CreateFoe.cs:412-430): the field walk plus ONE
   *  trailing rule the generic walk cannot express -
   *  `if (lastSpawnTime == 0) lastSpawnTime = now;`. It matters: a
   *  quest saved before CreateFoe's first Update still carries
   *  lastSpawnTime 0, and DFU stamps NOW on load, which permanently
   *  retires Update's random backdate - the first wave then waits a
   *  FULL interval and no draw is taken. Without this the port
   *  backdated after every such load, spawning early and consuming a
   *  roll DFU never spends. AUDIT 24 (the seven-slice sweep). */
  restoreSaveData(dataIn) {
    super.restoreSaveData(dataIn);
    if (dataIn == null) return;
    if (this.lastSpawnTime === 0) this.lastSpawnTime = this.parentQuest?.nowSeconds?.() ?? 0;
  }

  /** CreatePendingFoeSpawn (CreateFoe.cs:166-181). */
  _createPendingFoeSpawn(world, foe) {
    this.pendingFoes = world.createFoeGameObjects(foe, foe.spawnCount) ?? null;
    if (!this.pendingFoes || this.pendingFoes.length !== foe.spawnCount) {
      this.setComplete();
      throw new Error(`create foe attempted to create ${foe.spawnCount}x${foe.foeType} GameObjects and failed.`);
    }
    this.spawnInProgress = true;
    this.pendingFoesSpawned = 0;
  }

  /** TryPlacement (CreateFoe.cs:183-212) minus the physics: the
   *  "send" variant waits for the player inside a location rect; the
   *  dispatch (building/dungeon/exterior/wilderness) and the raycast
   *  ring live host-side behind tryPlaceFoe. The msg fires on the
   *  FIRST placed foe only, oncePerQuest. */
  _tryPlacement(world) {
    if (this.isSendAction && !world.isPlayerInLocationRect?.()) return;
    if (!world.tryPlaceFoe?.(this.pendingFoes[this.pendingFoesSpawned])) return;
    if (this.msgMessageID !== -1) {
      this.parentQuest.showMessagePopup(this.msgMessageID, false, true);
      this.msgMessageID = -1;
    }
    this.pendingFoesSpawned++;
  }
}

/** CastSpellOnFoe.cs (Q3-iii): queues a spell on a Foe resource -
 *  delivery is the behaviour mount's per-instance cursor (Q4). Two
 *  C# QUIRKS KEPT: a Quests-Spells miss LOGS and calls SetComplete
 *  on the TEMPLATE (a no-op - the minted action still queues its
 *  all-default spell, classic id 0); and the missing-foe throw reads
 *  the action's own never-assigned Symbol, so C# NREs before the
 *  format - either way the quest error-terminates. */
export class CastSpellOnFoe extends ActionTemplate {
  static typeName = 'CastSpellOnFoe';
  get saveShape() { return [['spell'], ['foeSymbol', 'sym']]; }
  get pattern() {
    return /cast (?<aSpell>[a-zA-Z0-9'_.-]+) spell on (?<aFoe>[a-zA-Z0-9_.-]+)|cast (?<aCustomSpell>[a-zA-Z0-9_.-]+) custom spell on (?<aFoe2>[a-zA-Z0-9_.-]+)/;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new CastSpellOnFoe(parentQuest);
    action.foeSymbol = new QuestSymbol(g.aFoe ?? g.aFoe2 ?? '');
    action.spell = { classicId: 0, customKey: g.aCustomSpell ?? '' };
    if (!action.spell.customKey) {
      const table = spellsTable();
      if (table.hasValue(g.aSpell)) {
        action.spell.classicId = questParseInt(table.getValue('id', g.aSpell));
      } else {
        console.warn(`[quest] CastSpellOnFoe could not resolve classic spell '${g.aSpell}' in Quests-Spells data table`);
        this.setComplete();   // C#: the TEMPLATE completes, not the action - kept
      }
    }
    return action;
  }
  update(_caller) {
    const foe = this.parentQuest.getFoe(this.foeSymbol);
    if (!foe) {
      this.setComplete();
      throw new Error(`CastSpellOnFoe could not find Foe with symbol name ${this.symbol?.name}`);
    }
    foe.queueSpell(this.spell);
    this.setComplete();
  }
}

// ---- Q3-iv, THE REMAINDER SWEEP: the last six template owners ----

// DFRegion.LocationTypes.None (DFRegion.cs:99) - 0xffff, not -1.
// AUDIT 24 (the seven-slice sweep): no Quests-Places p2 reaches 65535
// (the table tops out at 23, with -1 the 'anywhere' wildcard), so both
// sentinels read the same through the guards - but the value RIDES THE
// SAVE, and a sentinel is only a sentinel if it is the source's.
const LOCATION_TYPE_NONE = 0xffff;

/** WhenPcEntersExits.cs: the exterior-type trigger. C# rides
 *  PlayerGPS's OnEnter/OnExitLocationRect events; the port POLLS the
 *  rect flag each checkTrigger and writes previous/current on ITS
 *  EDGE, which is what the two handlers do.
 *
 *  AUDIT 24 (the seven-slice sweep): the poll used to shift previous
 *  on every observed change of the TYPE VALUE, and record that as
 *  equivalent. It is not. Walk from one town's rect straight into an
 *  adjacent town's rect of the same type and C# raises exit-then-enter
 *  - previous becomes the type, current becomes None, then the other
 *  way round, and an `exits city` fires; the value poll saw city then
 *  city and never moved. The edge is what C# writes on, so the edge is
 *  what the port holds (_wasInRect, seeded at create from the live
 *  flag exactly as PlayerGPS's flag is already true when a quest
 *  starts inside a town - a transient, out of the save shape as it is
 *  out of C#'s).
 *
 *  Only p1=2 rows of Quests-Places are legal exterior types;
 *  'anywhere' carries p2=-1, the wildcard arm. HEADLESS the flag reads
 *  false forever and the trigger stays false - the parse (and the p1
 *  throw) runs whole. */
export class WhenPcEntersExits extends ActionTemplate {
  static typeName = 'WhenPcEntersExits';
  get saveShape() { return [['onEnter'], ['sourceExteriorType'], ['indexExteriorType'], ['currentLocationType'], ['previousLocationType']]; }
  constructor(parentQuest) {
    super(parentQuest);
    this.isTriggerCondition = true;
    this.onEnter = true;
    this.sourceExteriorType = '';
    this.indexExteriorType = -1;
    this.currentLocationType = LOCATION_TYPE_NONE;
    this.previousLocationType = LOCATION_TYPE_NONE;
    // transient - PlayerGPS owns this flag in C#, so it is no more part
    // of the action's SaveData_v1 than it is of the port's saveShape
    this._wasInRect = false;
  }
  get pattern() { return /when pc (?<enters>enters) (?<exteriorType>\w+)|when pc (?<exits>exits) (?<exteriorType2>\w+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const g = match.groups;
    const action = new WhenPcEntersExits(parentQuest);
    if (g.enters != null) action.onEnter = true;
    else if (g.exits != null) action.onEnter = false;
    else throw new Error("WhenPcEntersExits: Syntax is 'when pc enters exteriorType | when pc exits exteriorType");
    action.sourceExteriorType = g.exteriorType ?? g.exteriorType2;
    const table = placesTable();
    if (table.getInt('p1', action.sourceExteriorType) !== 2) {
      throw new Error('WhenPcEntersExits: This trigger condition can only be used with exterior types of p1=2 in Quests-Places table.');
    }
    action.indexExteriorType = table.getInt('p2', action.sourceExteriorType);
    // seed the current type from the player's location at create
    // (WhenPcEntersExits.cs:73-76), and with it the rect flag PlayerGPS
    // is already holding - otherwise the first poll reads a phantom
    // enter edge for a quest that started inside a town
    const world = parentQuest?.hooks?.world;
    const loc = world?.currentLocation?.();
    action._wasInRect = Boolean(world?.isPlayerInLocationRect?.());
    if (action._wasInRect && loc?.loaded) {
      action.currentLocationType = loc.mapTableData.locationType;
    }
    return action;
  }
  /** The two handlers, on the rect flag's edge.
   *  PlayerGPS_OnEnterLocationRect (:157-164): previous takes current,
   *  then current takes the location's type - or None when the
   *  location is not Loaded. PlayerGPS_OnExitLocationRect (:166-170):
   *  previous takes current, current becomes None. */
  _poll() {
    const world = this.parentQuest?.hooks?.world;
    const inRect = Boolean(world?.isPlayerInLocationRect?.());
    if (inRect === this._wasInRect) return;
    this._wasInRect = inRect;
    this.previousLocationType = this.currentLocationType;
    if (!inRect) {
      this.currentLocationType = LOCATION_TYPE_NONE;
      return;
    }
    const loc = world?.currentLocation?.();
    this.currentLocationType = loc?.loaded ? loc.mapTableData.locationType : LOCATION_TYPE_NONE;
  }
  _hasEnteredTarget() {
    if (!this.onEnter || this.currentLocationType === LOCATION_TYPE_NONE) return false;
    if (this.indexExteriorType === -1) return true;   // 'anywhere'
    return this.indexExteriorType === this.currentLocationType;
  }
  _hasExitedTarget() {
    if (this.onEnter || this.previousLocationType === LOCATION_TYPE_NONE) return false;
    if (this.indexExteriorType === -1) return true;
    return this.indexExteriorType === this.previousLocationType;
  }
  checkTrigger(_caller) {
    this._poll();
    return this._hasEnteredTarget() || this._hasExitedTarget();
  }
}

/** WhenNpcIsAvailable.cs: the individual NPC is "available" when the
 *  player clicks them while NO active quest binds a Person of that
 *  faction. The clickMemory holds the SAME click from re-triggering
 *  (identity), and every check claims the machine's faction-listener
 *  slot (TalkManager's Q4 signal). The parse-time individual check
 *  runs only under a world; C#'s throw here is preceded by the
 *  TEMPLATE SetComplete - the same no-op quirk as CastSpellOnFoe. */
export class WhenNpcIsAvailable extends ActionTemplate {
  static typeName = 'WhenNpcIsAvailable';
  get saveShape() { return [['npcName'], ['npcFactionID']]; }
  constructor(parentQuest) {
    super(parentQuest);
    this.isTriggerCondition = true;
    this.isAlwaysOnTriggerCondition = true;
    this.npcName = '';
    this.npcFactionID = -1;
    this.clickMemory = null;
  }
  get pattern() { return /when (?<individualNPCName>[a-zA-Z0-9_.-]+) is available/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new WhenNpcIsAvailable(parentQuest);
    const name = match.groups.individualNPCName;
    const factionID = getIndividualFactionID(name);
    const world = parentQuest?.hooks?.world;
    if (factionID !== -1 && world) {
      // AUDIT 24 systems: Person.GetFactionData THROWS on a missing
      // record (Person.cs:848-856) - the port's `factionData &&` guard
      // let an unknown faction fall straight through and mint the
      // action, where DFU error-terminates the quest at parse. And
      // factionID 0 answers the zero record, whose type is 0, so the
      // `!= Individual` test below fires rather than being skipped.
      const factionData = getFactionDataOrThrow(world, factionID);
      if (factionData.type !== 4) {   // FactionTypes.Individual
        this.setComplete();   // C#: the TEMPLATE completes - kept
        throw new Error(`WhenNpcIsAvailable: NPC ${name} with FactionID ${factionID} is not an individual NPC`);
      }
    }
    action.npcName = name;
    action.npcFactionID = factionID;
    return action;
  }
  checkTrigger(_caller) {
    const hooks = this.parentQuest?.hooks;
    hooks?.addFactionListener?.(this.npcFactionID, this);
    const lastClicked = hooks?.lastNPCClicked?.() ?? null;
    if (!lastClicked) return false;
    // AUDIT 24 (the seven-slice sweep): the spam-click guard was DEAD.
    // C#'s `lastClicked == clickMemory` (WhenNpcIsAvailable.cs:84)
    // compares two StaticNPC REFERENCES, and a scene holds exactly one
    // StaticNPC per NPC - so it reads "the player clicked this same
    // NPC again". The port's hosts build a fresh NPCData object literal
    // at every click (worldModes.js's quest-flat arm and
    // questBridge.clickNpc both do), so `===` could never be true and
    // the guard never fired: re-clicking the same NPC re-triggered the
    // task every time, where DFU makes the player go and click someone
    // else first. The identity compare is IsNPCDataEqual's, the one the
    // machine already uses to match a questor.
    const sameNPC = hooks?.isNPCDataEqual
      ? hooks.isNPCDataEqual(lastClicked, this.clickMemory)
      : lastClicked === this.clickMemory;
    if (this.clickMemory && sameNPC) return false;
    this.clickMemory = null;
    if (lastClicked.factionID !== this.npcFactionID) return false;
    const foundActive = hooks?.activeFactionPersons?.(this.npcFactionID) ?? [];
    if (foundActive.length === 0) {
      this.clickMemory = lastClicked;
      return true;
    }
    return false;
  }
  dispose() {
    super.dispose();
    this.parentQuest?.hooks?.removeFactionListener?.(this.npcFactionID);
  }
}

/** WhenReputeWith.cs: the always-on reputation bar over the
 *  persistent faction store - the record's LIVE rep field, read each
 *  check. An unknown faction (no record) answers false, even at a
 *  bar of 0. The parse-time individual check runs only under a
 *  world; C#'s throw here has NO SetComplete, unlike its sibling. */
export class WhenReputeWith extends ActionTemplate {
  static typeName = 'WhenReputeWith';
  get saveShape() { return [['npcName'], ['npcFactionID'], ['minRepValue']]; }
  constructor(parentQuest) {
    super(parentQuest);
    this.isTriggerCondition = true;
    this.isAlwaysOnTriggerCondition = true;
    this.npcName = '';
    this.npcFactionID = -1;
    this.minRepValue = 0;
  }
  get pattern() { return /when repute with (?<individualNPCName>[a-zA-Z0-9_.-]+) is at least (?<minRepValue>\d+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new WhenReputeWith(parentQuest);
    const name = match.groups.individualNPCName;
    const factionID = getIndividualFactionID(name);
    const world = parentQuest?.hooks?.world;
    if (factionID !== -1 && world) {
      // AUDIT 24 systems: the same throw as WhenNpcIsAvailable above
      // (WhenReputeWith.cs:57 is the identical line).
      const factionData = getFactionDataOrThrow(world, factionID);
      if (factionData.type !== 4) {   // FactionTypes.Individual
        throw new Error(`WhenReputeWith: NPC ${name} with FactionID ${factionID} is not an individual NPC`);
      }
    }
    action.npcName = name;
    action.npcFactionID = factionID;
    action.minRepValue = questParseInt(match.groups.minRepValue);
    return action;
  }
  checkTrigger(_caller) {
    const record = this.parentQuest?.hooks?.world?.getFactionData?.(this.npcFactionID);
    if (!record) return false;
    return record.rep >= this.minRepValue;
  }
}

/** MakePcDiseased.cs: the Quests-Diseases id at parse (a miss
 *  THROWS), CreateDisease + AssignBundle(BypassSavingThrows) through
 *  the makePcDiseased seam at update. The corpus's one "saying N"
 *  tail is NOT in C#'s pattern - the tail is silently dropped and no
 *  popup fires, verbatim. */
export class MakePcDiseased extends ActionTemplate {
  static typeName = 'MakePcDiseased';
  get saveShape() { return [['diseaseType']]; }
  get pattern() { return /make pc ill with (?<aDisease>[a-zA-Z0-9_.']+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const name = match.groups.aDisease;
    const table = diseasesTable();
    if (!table.hasValue(name)) {
      throw new Error(`make pc ill with <aDisease> could not find disease matching '${name}'. See 'Quests-Diseases' table for valid disease names.`);
    }
    const action = new MakePcDiseased(parentQuest);
    action.diseaseType = questParseInt(table.getValue('id', name));
    return action;
  }
  update(_caller) {
    if (this.diseaseType !== -1) {
      this.parentQuest.hooks?.makePcDiseased?.(this.diseaseType);
    }
    this.setComplete();
  }
}

/** CurePcDisease.cs: three arms - vampirism and lycanthropy ride
 *  their own enders, everything else the Quests-Diseases id (a miss
 *  THROWS). C# re-tests the matched text CASE-INSENSITIVELY, so
 *  'cure Vampirism' falls through the third alternate and still
 *  lands on the vampirism arm. */
export class CurePcDisease extends ActionTemplate {
  static typeName = 'CurePcDisease';
  get saveShape() { return [['diseaseType'], ['isCureVampirism'], ['isCureLycanthropy']]; }
  constructor(parentQuest) {
    super(parentQuest);
    this.diseaseType = -1;   // Diseases.None
    this.isCureVampirism = false;
    this.isCureLycanthropy = false;
  }
  get pattern() { return /cure vampirism|cure lycanthropy|cure (?<aDisease>[a-zA-Z0-9_.']+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new CurePcDisease(parentQuest);
    const matched = match[0].toLowerCase();
    if (matched === 'cure vampirism') action.isCureVampirism = true;
    else if (matched === 'cure lycanthropy') action.isCureLycanthropy = true;
    else {
      const name = match.groups.aDisease;
      const table = diseasesTable();
      if (!table.hasValue(name)) {
        throw new Error(`cure <aDisease> could not find disease matching '${name}'. See 'Quests-Diseases' table for valid disease names.`);
      }
      action.diseaseType = questParseInt(table.getValue('id', name));
    }
    return action;
  }
  update(_caller) {
    const hooks = this.parentQuest.hooks;
    if (this.diseaseType !== -1) hooks?.cureDisease?.(this.diseaseType);
    else if (this.isCureVampirism) hooks?.endVampirism?.();
    else if (this.isCureLycanthropy) hooks?.endLycanthropy?.();
    this.setComplete();
  }
}

/** CastSpellDo.cs: starts a task when the player READIES a spell
 *  whose bundle matches EVERY classic effect of the named spell.
 *
 *  AUDIT 24 (the seven-slice sweep): THE LATCH IS THE ACTION'S, NOT
 *  THE HOST'S. The port used to poll world.readiedSpell() each update
 *  and call the readied state "the window" - a recorded equivalence
 *  that is not sound. C# holds `lastReadySpell` as ACTION state, set
 *  by OnNewReadySpell and cleared by OnCastReadySpell, and the two do
 *  not tile the readied state:
 *    - AbortReadySpell (EntityEffectManager.cs:361-365) nulls the
 *      host's readySpell WITHOUT raising OnCastReadySpell, so C#'s
 *      latch SURVIVES an aborted ready and still fires the task; the
 *      poll saw nothing and never fired.
 *    - the action subscribes in its CONSTRUCTOR, so a ready landing
 *      before the task ever runs is latched and fires on the task's
 *      first tick; a ready that has since been aborted is invisible
 *      to a poll.
 *    - a MISMATCH consumes the latch (`lastReadySpell = null`), so C#
 *      evaluates one readied bundle exactly ONCE; the poll re-tested
 *      the same bundle every tick.
 *  So the latch is ported here and the host raises it through the
 *  machine's notifyNewReadySpell/notifyCastReadySpell doors, the same
 *  fan-out CreateFoe's transitions ride.
 *
 *  ONE MORE C# QUIRK KEPT: SetComplete UNSUBSCRIBES both events and
 *  RearmAction never resubscribes - a completed CastSpellDo that is
 *  rearmed is deaf forever (_eventsBound, cleared and never restored),
 *  and the STALE bundle it is still holding re-fires it on the next
 *  tick.
 *
 *  BOTH miss arms carry the template-SetComplete quirk (CastSpellOnFoe's
 *  sibling): the minted action stands with spellID -1 or null effects
 *  and idles forever, never completing - which is also exactly the
 *  HEADLESS stance, since the classic spell records need ARENA2. The
 *  first arm's LOG carries it too: C# formats the unqualified
 *  `spellID`, the TEMPLATE's field, which is never assigned and always
 *  prints -1. */
export class CastSpellDo extends ActionTemplate {
  static typeName = 'CastSpellDo';
  get saveShape() { return [['spellID'], ['classicEffects'], ['taskSymbol', 'sym']]; }
  constructor(parentQuest) {
    super(parentQuest);
    this.spellID = -1;
    this.classicEffects = null;
    this.taskSymbol = null;
    // transient, NOT saved (C#'s SaveData_v1 carries three fields):
    this.lastReadySpell = null;
    this._eventsBound = true;   // the ctor's two += subscriptions
  }
  get pattern() { return /cast (?<aSpell>[a-zA-Z0-9'_.-]+) spell do (?<aTask>[a-zA-Z0-9_.-]+)/; }

  /** PlayerEffectManager_OnNewReadySpell (:127-131). */
  onNewReadySpell(spell) { if (this._eventsBound) this.lastReadySpell = spell ?? null; }

  /** PlayerEffectManager_OnCastReadySpell (:133-137): a CAST clears
   *  the latch "so player can't queue it up before entering location".
   *  An ABORT does not - EntityEffectManager.AbortReadySpell raises
   *  nothing. */
  onCastReadySpell(_spell) { if (this._eventsBound) this.lastReadySpell = null; }

  /** SetComplete (:119-124): completing UNSUBSCRIBES, and the base
   *  RearmAction does not put the handlers back. */
  setComplete() {
    super.setComplete();
    this._eventsBound = false;
  }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new CastSpellDo(parentQuest);
    const sourceSpellName = match.groups.aSpell;
    action.taskSymbol = new QuestSymbol(match.groups.aTask);
    const table = spellsTable();
    if (table.hasValue(sourceSpellName)) {
      action.spellID = questParseInt(table.getValue('id', sourceSpellName));
      const effects = parentQuest?.hooks?.world?.getClassicSpellEffects?.(action.spellID) ?? null;
      if (effects) {
        action.classicEffects = effects;
      } else {
        // C# logs the unqualified `spellID` - the TEMPLATE's field,
        // never assigned, so DFU always prints -1 here
        console.warn(`[quest] CastSpellDo could not find spell matching spellID '${this.spellID}' from spell '${sourceSpellName}'`);
        this.setComplete();   // C#: the TEMPLATE completes - kept
      }
    } else {
      console.warn(`[quest] CastSpellDo could not resolve spell '${sourceSpellName}' in Quests-Spells data table`);
      this.setComplete();   // C#: the TEMPLATE completes - kept
    }
    return action;
  }
  update(_caller) {
    const world = this.parentQuest.hooks?.world;
    // Validate - and note C# clears the latch on the way out of this
    // arm too, so an unresolvable action eats every ready it is handed
    if (this.spellID === -1 || !this.classicEffects?.length || !this.taskSymbol || !this.lastReadySpell) {
      this.lastReadySpell = null;
      return;
    }
    let foundEffects = 0;
    for (const effect of this.classicEffects) {
      if (effect.type === -1) continue;
      foundEffects++;
      if (!world?.spellHasMatchForClassicEffect?.(this.lastReadySpell, effect)) {
        this.lastReadySpell = null;   // one bundle, one evaluation
        return;
      }
    }
    if (foundEffects === 0) {
      this.setComplete();
      return;
    }
    this.parentQuest.startTask(this.taskSymbol);
    this.setComplete();
  }
}

/** CreateNpcAt.cs: a DOCUMENTED no-op - legacy TEMPLATE scripts
 *  "reserve" a site before placing; DFU creates SiteLinks in the
 *  placement actions either way, so this only completes. */
export class CreateNpcAt extends ActionTemplate {
  static typeName = 'CreateNpcAt';
  get saveShape() { return [['placeSymbol', 'sym']]; }
  get pattern() { return /create npc at (?<aPlace>\w+)/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new CreateNpcAt(parentQuest);
    action.placeSymbol = new QuestSymbol(match.groups.aPlace);
    return action;
  }
  update(_caller) { this.setComplete(); }
}

/** Internal_Strings "readMap" (en id 653) - RevealLocation's journal
 *  note, %map replaced by the location name, as TextManager does. */
export const READ_MAP_NOTE = 'Discovered the location of %map after studying a map.';

/** AUDIT quest-P2: the registry is first-match-wins over UNANCHORED
 *  patterns, so the un-ported actions that sit before (or between)
 *  the tranche in DFU's RegisterActionTemplates order need GUARDS at
 *  their positions - without them Say hijacked "clicked npc _x_ say
 *  1011" into an unconditional popup and WhenTask built bogus evals
 *  from "when repute with ..." lines. A guard's createNew answers
 *  null, so the line lands in pendingActionLines (the Q2b queue),
 *  exactly where an unregistered action's line belongs. Q2b-i widened
 *  the guard set to EVERY un-ported action, so the registry mirrors
 *  RegisterActionTemplates whole and every corpus line resolves or
 *  pends exactly where DFU's scan sends it. Patterns are the DFU
 *  originals' match surface, group-free. */
class PendingTrigger extends ActionTemplate {
  constructor(parentQuest, pattern) { super(parentQuest); this._pattern = pattern; }
  get pattern() { return this._pattern; }
  createNew() { return null; }
}

const GUARD_PATTERNS = Object.freeze({
  // Trigger conditions ahead of the tranche
  WhenSkillLevel: /when skill (\w+) is at least (\d+)/,
  WhenAttributeLevel: /when attribute (\w+) is at least (\d+)/,
  Season: /season (fall|summer|spring|winter)/,
  Weather: /weather (sunny|cloudy|overcast|fog|rain|thunder|snow)/,
  Climate: /climate (desert|desert2|mountain|mountainwoods|rainforest|ocean|swamp|subtropical|woodlands|hauntedwoodlands)|climate (base) (desert|mountain|temperate|swamp)/,
  // Default actions
  RunQuest: /run quest (\w+) then ([a-zA-Z0-9_.]+) or ([a-zA-Z0-9_.]+)/,
  CastEffectDo: /cast ([a-zA-Z0-9_.-]+) effect do ([a-zA-Z0-9_.-]+)/,
  WorldUpdate: /worldupdate (location) at (\d+) in region (\d+) variant ([a-zA-Z0-9_.-]+)|worldupdate (locationnew) named (.+) in region (\d+) variant ([a-zA-Z0-9_.-]+)|worldupdate (block) ([a-zA-Z0-9_.-]+) at (\d+) in region (\d+) variant ([a-zA-Z0-9_.-]+)|worldupdate (blockAll) ([a-zA-Z0-9_.-]+) variant ([a-zA-Z0-9_.-]+)|worldupdate (building) ([a-zA-Z0-9_.-]+) (\d+) at (\d+) in region (\d+) variant ([a-zA-Z0-9_.-]+)|worldupdate (buildingAll) ([a-zA-Z0-9_.-]+) (\d+) variant ([a-zA-Z0-9_.-]+)/,
  Enemies: /enemies (makehostile|clear)/,
  ClickedFoe: /clicked foe ([a-zA-Z0-9_.-]+) and at least (\d+) gold otherwise do ([a-zA-Z0-9_.]+)|clicked foe ([a-zA-Z0-9_.-]+) say (\d+)|clicked foe ([a-zA-Z0-9_.-]+) say (\w+)|clicked foe ([a-zA-Z0-9_.-]+)/,
  KillFoe: /kill foe ([a-zA-Z0-9_.-]+)/,
  PayMoney: /pay (\d+) (money|gold) do ([a-zA-Z0-9_.]+) otherwise do ([a-zA-Z0-9_.]+)/,
  JournalNote: /journal note (\d+)/,
  ChangeFoeInfighting: /change foe ([a-zA-Z0-9_.-]+) infighting ([a-zA-Z]+)/,
  ChangeFoeTeam: /change foe ([a-zA-Z0-9_.-]+) team (\d+)|change foe ([a-zA-Z0-9_.-]+) team (\w+)/,
  SetPlayerCrime: /setplayercrime ([a-zA-Z_]+)/,
  SpawnCityGuards: /spawncityguards (immediate)?/,
  UnrestrainFoe: /unrestrain foe ([a-zA-Z0-9_.-]+)/,
  TrainPc: /train pc (\w+)/,
  PromptMulti: /promptmulti (\d+) ([0-9]+)(:[a-zA-Z0-9]+)? ([a-zA-Z0-9_.]+) ([0-9]+)(:[a-zA-Z0-9]+)? ([a-zA-Z0-9_.]+) ([0-9]+)(:[a-zA-Z0-9]+)? ([a-zA-Z0-9_.]+) ([0-9]+)(:[a-zA-Z0-9]+)? ([a-zA-Z0-9_.]+)|promptmulti (\d+) ([0-9]+)(:[a-zA-Z0-9]+)? ([a-zA-Z0-9_.]+) ([0-9]+)(:[a-zA-Z0-9]+)? ([a-zA-Z0-9_.]+) ([0-9]+)(:[a-zA-Z0-9]+)? ([a-zA-Z0-9_.]+)|promptmulti (\d+) ([0-9]+)(:[a-zA-Z0-9]+)? ([a-zA-Z0-9_.]+) ([0-9]+)(:[a-zA-Z0-9]+)? ([a-zA-Z0-9_.]+)/,
});
const guard = (name) => new PendingTrigger(null, GUARD_PATTERNS[name]);

/** The default registry - DFU's RegisterActionTemplates WHOLE
 *  (QuestMachine.cs:345-428), one slot per registered action in the
 *  C# order: the ported action's template, or a guard whose verbatim
 *  pattern pends the line for its future slice (AUDIT quest-P12
 *  adopted the C# order outright; Q2b-i completed the mirror). */
export function defaultActionTemplates() {
  return [
    // Trigger conditions
    new WhenPcEntersExits(null),
    new WhenNpcIsAvailable(null),
    new WhenReputeWith(null),
    guard('WhenSkillLevel'),
    guard('WhenAttributeLevel'),
    new WhenTask(null),
    new ClickedNpc(null),
    new ClickedItem(null),
    new LevelCompleted(null),
    new InjuredFoe(null),
    new KilledFoe(null),
    new TotingItemAndClickedNpc(null),
    new DailyFrom(null),
    new DroppedItemAtPlace(null),
    guard('Season'),
    guard('Weather'),
    guard('Climate'),
    // Default actions
    new EndQuest(null),
    new Prompt(null),
    new Say(null),
    new PlaySound(null),
    new StartTask(null),
    new ClearTask(null),
    new LogMessage(null),
    new PickOneOf(null),
    new RemoveLogMessage(null),
    new PlayVideo(null),
    new PcAt(null),
    new CreateNpcAt(null),
    new CreateNpc(null),
    new PlaceNpc(null),
    new PlaceItem(null),
    new GivePc(null),
    new GiveItem(null),
    new StartStopTimer(null),
    new CreateFoe(null),
    new PlaceFoe(null),
    new HideNpc(null),
    new RestoreNpc(null),
    new AddFace(null),
    new DropFace(null),
    new GetItem(null),
    new StartQuest(null),
    guard('RunQuest'),
    new UnsetTask(null),
    new ChangeReputeWith(null),
    new ReputeExceedsDo(null),
    new RevealLocation(null),
    new RestrainFoe(null),
    new MakePermanent(null),
    new HaveItem(null),
    new AddAsQuestor(null),
    new DropAsQuestor(null),
    new ItemUsedDo(null),
    new TakeItem(null),
    new TeleportPc(null),
    new DialogLink(null),
    new AddDialog(null),
    new RumorMill(null),
    new MakePcDiseased(null),
    new CurePcDisease(null),
    new CastSpellDo(null),
    guard('CastEffectDo'),
    new CastSpellOnFoe(null),
    new RemoveFoe(null),
    new LegalRepute(null),
    new MuteNpc(null),
    new DestroyNpc(null),
    guard('WorldUpdate'),
    guard('Enemies'),
    guard('ClickedFoe'),
    guard('KillFoe'),
    guard('PayMoney'),
    guard('JournalNote'),
    guard('ChangeFoeInfighting'),
    guard('ChangeFoeTeam'),
    new PlaySong(null),
    guard('SetPlayerCrime'),
    guard('SpawnCityGuards'),
    guard('UnrestrainFoe'),
    guard('TrainPc'),
    guard('PromptMulti'),
  ];
}
