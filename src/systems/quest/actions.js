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

import { Symbol as QuestSymbol } from './symbol.js';
import { parseInt as questParseInt } from './parseUtils.js';
import { staticMessagesTable, soundsTable } from './tables.js';
import { dateFromSeconds } from '../gameDate.js';

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

/** HideNpc.cs: raises the Person's hidden flag. A missing Person
 *  returns WITHOUT completing - the action keeps trying. */
export class HideNpc extends ActionTemplate {
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
  WhenPcEntersExits: /when pc (enters) (\w+)|when pc (exits) (\w+)/,
  WhenNpcIsAvailable: /when ([a-zA-Z0-9_.-]+) is available/,
  WhenReputeWith: /when repute with ([a-zA-Z0-9_.-]+) is at least (\d+)/,
  WhenSkillLevel: /when skill (\w+) is at least (\d+)/,
  WhenAttributeLevel: /when attribute (\w+) is at least (\d+)/,
  TotingItemAndClickedNpc: /toting ([a-zA-Z0-9_.]+) and ([a-zA-Z0-9_.-]+) clicked saying (\d+)|toting ([a-zA-Z0-9_.]+) and ([a-zA-Z0-9_.-]+) clicked saying (\w+)|toting ([a-zA-Z0-9_.]+) and ([a-zA-Z0-9_.-]+) clicked/,
  DroppedItemAtPlace: /dropped ([a-zA-Z0-9_.-]+) at ([a-zA-Z0-9_.-]+) saying (\d+)|dropped ([a-zA-Z0-9_.-]+) at ([a-zA-Z0-9_.-]+)/,
  Season: /season (fall|summer|spring|winter)/,
  Weather: /weather (sunny|cloudy|overcast|fog|rain|thunder|snow)/,
  Climate: /climate (desert|desert2|mountain|mountainwoods|rainforest|ocean|swamp|subtropical|woodlands|hauntedwoodlands)|climate (base) (desert|mountain|temperate|swamp)/,
  // Default actions
  PcAt: /pc at (\w+) set ([a-zA-Z0-9_.]+) saying (\d+)|pc at (\w+) set ([a-zA-Z0-9_.]+)|pc at (\w+) do ([a-zA-Z0-9_.]+) saying (\d+)|pc at (\w+) do ([a-zA-Z0-9_.]+)|pc at any (\w+) set ([a-zA-Z0-9_.]+) saying (\d+)|pc at any (\w+) set ([a-zA-Z0-9_.]+)|pc at any (\w+) do ([a-zA-Z0-9_.]+) saying (\d+)|pc at any (\w+) do ([a-zA-Z0-9_.]+)/,
  CreateNpcAt: /create npc at (\w+)/,
  CreateNpc: /create npc ([a-zA-Z0-9_.-]+)/,
  PlaceNpc: /place npc ([a-zA-Z0-9_.-]+) at (\w+) marker (\d+)|place npc ([a-zA-Z0-9_.-]+) at (\w+)/,
  PlaceItem: /place item ([a-zA-Z0-9_.-]+) at ([a-zA-Z0-9_.-]+) marker (\d+)|place item ([a-zA-Z0-9_.-]+) at ([a-zA-Z0-9_.-]+) questmarker (\d+)|place item ([a-zA-Z0-9_.-]+) at ([a-zA-Z0-9_.-]+) (anymarker)|place item ([a-zA-Z0-9_.-]+) at ([a-zA-Z0-9_.-]+)/,
  GivePc: /give pc (nothing)|give pc ([a-zA-Z0-9_.]+) notify (\d+)|give pc ([a-zA-Z0-9_.]+) (silently)|give pc ([a-zA-Z0-9_.]+)/,
  GiveItem: /give item ([a-zA-Z0-9_.]+) to ([a-zA-Z0-9_.]+)/,
  CreateFoe: /create foe ([a-zA-Z0-9_.-]+) every (\d+) minutes (indefinitely) with (\d+)% success|create foe ([a-zA-Z0-9_.-]+) every (\d+) minutes (\d+) times with (\d+)% success|(send) ([a-zA-Z0-9_.-]+) every (\d+) minutes (\d+) times with (\d+)% success|(send) ([a-zA-Z0-9_.-]+) every (\d+) minutes with (\d+)% success/,
  PlaceFoe: /place foe ([a-zA-Z0-9_.-]+) at ([a-zA-Z0-9_.-]+) marker (\d+)|place foe ([a-zA-Z0-9_.-]+) at ([a-zA-Z0-9_.-]+)/,
  GetItem: /get item ([a-zA-Z0-9_.]+) saying (\d+)|get item ([a-zA-Z0-9_.]+)/,
  RunQuest: /run quest (\w+) then ([a-zA-Z0-9_.]+) or ([a-zA-Z0-9_.]+)/,
  ChangeReputeWith: /change repute with ([a-zA-Z0-9_.-]+) by ([+-])(\d+)/,
  ReputeExceedsDo: /repute with ([a-zA-Z0-9_.-]+) exceeds (\d+) do ([a-zA-Z0-9_.]+)/,
  RevealLocation: /reveal (\w+) (readmap)|reveal (\w+)/,
  MakePermanent: /make ([a-zA-Z0-9_.-]+) permanent/,
  HaveItem: /have ([a-zA-Z0-9_.-]+) set ([a-zA-Z0-9_.-]+)/,
  TakeItem: /take ([a-zA-Z0-9_.]+) from pc saying (\d+)|take ([a-zA-Z0-9_.]+) from pc/,
  TeleportPc: /teleport pc to ([a-zA-Z0-9_.-]+)|transfer pc inside ([a-zA-Z0-9_.-]+) marker (\d+)/,
  MakePcDiseased: /make pc ill with ([a-zA-Z0-9_.']+)/,
  CurePcDisease: /cure vampirism|cure lycanthropy|cure ([a-zA-Z0-9_.']+)/,
  CastSpellDo: /cast ([a-zA-Z0-9'_.-]+) spell do ([a-zA-Z0-9_.-]+)/,
  CastEffectDo: /cast ([a-zA-Z0-9_.-]+) effect do ([a-zA-Z0-9_.-]+)/,
  CastSpellOnFoe: /cast ([a-zA-Z0-9'_.-]+) spell on ([a-zA-Z0-9_.-]+)|cast ([a-zA-Z0-9_.-]+) custom spell on ([a-zA-Z0-9_.-]+)/,
  WorldUpdate: /worldupdate (location) at (\d+) in region (\d+) variant ([a-zA-Z0-9_.-]+)|worldupdate (locationnew) named (.+) in region (\d+) variant ([a-zA-Z0-9_.-]+)|worldupdate (block) ([a-zA-Z0-9_.-]+) at (\d+) in region (\d+) variant ([a-zA-Z0-9_.-]+)|worldupdate (blockAll) ([a-zA-Z0-9_.-]+) variant ([a-zA-Z0-9_.-]+)|worldupdate (building) ([a-zA-Z0-9_.-]+) (\d+) at (\d+) in region (\d+) variant ([a-zA-Z0-9_.-]+)|worldupdate (buildingAll) ([a-zA-Z0-9_.-]+) (\d+) variant ([a-zA-Z0-9_.-]+)/,
  Enemies: /enemies (makehostile|clear)/,
  ClickedFoe: /clicked foe ([a-zA-Z0-9_.-]+) and at least (\d+) gold otherwise do ([a-zA-Z0-9_.]+)|clicked foe ([a-zA-Z0-9_.-]+) say (\d+)|clicked foe ([a-zA-Z0-9_.-]+) say (\w+)|clicked foe ([a-zA-Z0-9_.-]+)/,
  KillFoe: /kill foe ([a-zA-Z0-9_.-]+)/,
  PayMoney: /pay (\d+) (money|gold) do ([a-zA-Z0-9_.]+) otherwise do ([a-zA-Z0-9_.]+)/,
  JournalNote: /journal note (\d+)/,
  ChangeFoeInfighting: /change foe ([a-zA-Z0-9_.-]+) infighting ([a-zA-Z]+)/,
  ChangeFoeTeam: /change foe ([a-zA-Z0-9_.-]+) team (\d+)|change foe ([a-zA-Z0-9_.-]+) team (\w+)/,
  PlaySong: /play song ([a-zA-Z0-9_-]+)/,
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
    guard('WhenPcEntersExits'),
    guard('WhenNpcIsAvailable'),
    guard('WhenReputeWith'),
    guard('WhenSkillLevel'),
    guard('WhenAttributeLevel'),
    new WhenTask(null),
    new ClickedNpc(null),
    new ClickedItem(null),
    new LevelCompleted(null),
    new InjuredFoe(null),
    new KilledFoe(null),
    guard('TotingItemAndClickedNpc'),
    new DailyFrom(null),
    guard('DroppedItemAtPlace'),
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
    guard('PcAt'),
    guard('CreateNpcAt'),
    guard('CreateNpc'),
    guard('PlaceNpc'),
    guard('PlaceItem'),
    guard('GivePc'),
    guard('GiveItem'),
    new StartStopTimer(null),
    guard('CreateFoe'),
    guard('PlaceFoe'),
    new HideNpc(null),
    new RestoreNpc(null),
    new AddFace(null),
    new DropFace(null),
    guard('GetItem'),
    new StartQuest(null),
    guard('RunQuest'),
    new UnsetTask(null),
    guard('ChangeReputeWith'),
    guard('ReputeExceedsDo'),
    guard('RevealLocation'),
    new RestrainFoe(null),
    guard('MakePermanent'),
    guard('HaveItem'),
    new AddAsQuestor(null),
    new DropAsQuestor(null),
    new ItemUsedDo(null),
    guard('TakeItem'),
    guard('TeleportPc'),
    new DialogLink(null),
    new AddDialog(null),
    new RumorMill(null),
    guard('MakePcDiseased'),
    guard('CurePcDisease'),
    guard('CastSpellDo'),
    guard('CastEffectDo'),
    guard('CastSpellOnFoe'),
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
    guard('PlaySong'),
    guard('SetPlayerCrime'),
    guard('SpawnCityGuards'),
    guard('UnrestrainFoe'),
    guard('TrainPc'),
    guard('PromptMulti'),
  ];
}
