// @ts-check
// NO-ASKS-AGAIN (FIELD BUGS 2026-10-13e, "Cant complete quest 'the lost child'": "I found the child in the dungeon,
// interacted with it, accidentally said 'no' when it asked me to get it, and now i cant interact with it at all. Tried
// restarting the game, didnt help."): A NO THAT LEADS NOWHERE ASKS AGAIN, ON THE NEXT CLICK. Not a DFU member - a
// departure (Port-Ledger A, NO-ASKS-AGAIN), under the owner's standing rule for a player's soft-lock: "I dont care about
// DFU. We're our own thing now" (bible/01-Overview/bugs/Field-Bugs-2026-09-30b.md).
//
// WHAT IT DEPARTS FROM. K0C00Y05 (The Lost Child): `_S.07_ task: clicked npc _child_` / `prompt 1017 yes _S.09_ no
// _no_`, and `variable _no_`, which nothing reads. Prompt.cs asks once - `allowRearm = false` in its constructor and
// SetComplete at Show, so a clear leaves it complete (QuestAction.cs ActionTemplate.RearmAction); ClickedNpc.cs
// CheckTrigger answers true for a set task ("Another action will need to rearm/unset this task if another click is
// required"); Task.cs Update checks no trigger of a set task. Nothing in the script clears `_S.07_`, so after a No the
// child's click is still the quest's (QuestResourceBehaviour.DoClick answers that a quest took it, so no talk window
// opens) and nothing happens; the three flags are saved (Task.cs SaveData_v1's triggered, QuestAction.cs's isComplete),
// so a restart changes nothing. DFU soft-locks the same way - the port was faithful.
//
// THE LAW, read off the parsed quest's own structures, never its text:
//   - THE NO IS INERT (inertNo): the prompt's `no` names a plain `variable` (TaskType.Variable with no actions - a
//     `_x_ task:` of the same name merges its actions into it, Quest.AddTask's duplicate arm) that nothing else in the
//     quest names: no task's `until _x_ performed:`, no action's symbol (the symbols its save shape keeps, and a
//     `when`'s tasks), no resource of that name (a Clock starts its namesake task). A line the action registry never
//     parsed (Task.pendingActionLines) never runs, so it reads nothing.
//   - THE ASKING IS A CLICK (asksOnAClick): the prompt's own task is a plain `_x_ task:` (never a global's, which every
//     quest shares through SAVEVARS), every trigger of it reads a click (CLICK_TRIGGERS), so it starts again only on the
//     player's next click - a click lives one tick (QuestResource.PostTick) - and nothing in the quest names it, so
//     clearing it moves nothing but itself.
// When such a No has been answered - the No variable set, the prompt complete, its task set - the task is cleared
// (Task.Clear, as a `clear` line clears it: its other actions rearm by their own allowRearm and nothing more), the
// prompt alone is made incomplete again, and the No variable is cleared. The next click asks again; a Yes then runs as a
// first Yes does. A No that DOES something - a task with actions, a variable something reads - is DFU's, untouched.
//
// NOT THE DEMANDS. Thirteen vendored prompts in eleven quests (A0C00Y14, A0C00Y15, K0C00Y03, O0B00Y00, O0B00Y01 three
// times, O0B10Y00, R0C10Y00, R0C10Y01, R0C10Y02, R0C10Y18, R0C11Y19) are a robber's or a guard's "hand it over" under
// `injured _foe_`, with a No as inert as `_no_` (O0B00Y01's three share theirs, which the name count already leaves). There the No is the refusal and the quest goes on by its own road, and the trigger is
// Foe.injuredTrigger, a latch that holds until the foe is stood again (sceneMount.js addQuestFoe's rearmInjured) -
// re-armed, the demand would come back the next tick, every tick, until a Yes gave the courier's goods away. A `when`
// asks again as fast. So the asking must be a click: in the shipped corpus that is The Lost Child alone.
//
// THE NO THAT CLEARS ITS ASKING (QUEST-AUDIT III, the owner: "fix any and all outstanding issues" - the call FIELD BUGS
// 2026-10-13e left him). C0C00Y10 (Holy Orders): the healer's `_S.10_ task: clicked npc _healer_ say 1013` / `prompt
// 1014 yes _S.11_ no _no_`, and `_no_ task: clear _S.10_` - the author meant the healer to ask again, and Prompt.cs's
// allowRearm (false) leaves the prompt complete through the clear: every later click says 1013 and asks nothing, and the
// talisman is never bought. A No task whose every action is a `clear` of the asking task alone (clearingNo), on an
// asking that is a click, is that No: once it has run - the No set, the asking cleared, the prompt complete - the prompt
// is made incomplete again and the No is cleared (its `clear` rearms for a second No). The next click asks again.
//
// TWO DOORS, ONE LAW: Quest.update runs it every tick (the No is answered between ticks), and Quest.restoreSaveData at
// the end of every restore - a save taken after such a No under DFU's law loads asking again, as do a party member's
// copy (receiveSharedQuest, updateSharedQuest) and a reclaimed quest (reclaimQuest), which all restore through it.
import { TaskType } from './task.js';
import { getInnerSymbolName } from './symbol.js';

/** The triggers that read a player's click - ClickedNpc.cs, ClickedItem.cs, ClickedFoe.cs, TotingItemAndClickedNpc.cs,
 *  each a HasPlayerClicked read. */
export const CLICK_TRIGGERS = Object.freeze(['ClickedNpc', 'ClickedItem', 'ClickedFoe', 'TotingItemAndClickedNpc']);

/**
 * Every symbol NAME an action names: the symbols its save shape keeps (the fields the action itself holds - the
 * declarative shape every action's GetSaveData walks), and a `when`'s tasks, the one action that keeps names raw.
 * @param {any} action
 * @returns {string[]}
 */
export function namesOf(action) {
  const names = [];
  for (const [field, kind = 'raw'] of action?.saveShape ?? []) {
    const v = action[field];
    if (kind === 'sym') { if (v?.name) names.push(v.name); }
    else if (kind === 'symArray') { for (const s of v ?? []) if (s?.name) names.push(s.name); }
  }
  if (action?.typeName === 'WhenTask') for (const e of action.evaluations ?? []) names.push(getInnerSymbolName(e.task));
  return names;
}

/**
 * How many times the quest names this task: a resource of that name, a task's `until _x_ performed:`, every action's
 * symbols (namesOf).
 * @param {any} quest
 * @param {string} name
 */
function timesNamed(quest, name) {
  let n = 0;
  for (const r of quest.resources.values()) if (r.symbol?.name === name) n++;
  for (const task of quest.tasks.values()) {
    if (task.type === TaskType.PersistUntil && task.targetSymbol?.name === name) n++;
    for (const action of task.actions) for (const x of namesOf(action)) if (x === name) n++;
  }
  return n;
}

/**
 * The prompt's No task when it is INERT - a plain variable, no actions, named by nothing but this prompt's own `no` -
 * else null.
 * @param {any} quest
 * @param {any} prompt a Prompt action
 */
export function inertNo(quest, prompt) {
  const no = quest.getTask(prompt.noTaskSymbol);
  if (!no || no.type !== TaskType.Variable) return null;
  if (no.actions.length > 0) return null;   // a `_x_ task:` merged into the variable does something
  return timesNamed(quest, no.symbol.name) === 1 ? no : null;   // the prompt's own `no`, and nothing else
}

/**
 * The prompt's No task when its every action is a `clear` of the prompt's own asking task (at least one, none naming
 * anything else) and nothing but the prompt names it - the author's own ask-again (C0C00Y10's `_no_ task: clear
 * _S.10_`) - else null.
 * @param {any} quest
 * @param {any} task the asking task
 * @param {any} prompt a Prompt action
 */
export function clearingNo(quest, task, prompt) {
  const no = quest.getTask(prompt.noTaskSymbol);
  if (!no || no === task || no.type !== TaskType.Standard || no.pendingActionLines?.length) return null;
  if (!no.actions.length || !no.actions.every((/** @type {any} */ a) => a.typeName === 'ClearTask' && a.taskSymbols?.length
    && a.taskSymbols.every((/** @type {any} */ s) => s?.name === task.symbol.name))) return null;
  return timesNamed(quest, no.symbol.name) === 1 ? no : null;
}

/**
 * Does this task ask on a click alone - a plain `_x_ task:`, every trigger of it a click (at least one), and nothing in
 * the quest naming it (but `named` times - the clears of a No that clears its asking, clearingNo)?
 * @param {any} quest
 * @param {any} task
 * @param {number} [named]
 */
export function asksOnAClick(quest, task, named = 0) {
  if (task.type !== TaskType.Standard) return false;   // a `_x_ task:` - a global's is every quest's (SAVEVARS)
  const triggers = task.actions.filter((/** @type {any} */ a) => a.isTriggerCondition);
  if (!triggers.length || !triggers.every((/** @type {any} */ a) => CLICK_TRIGGERS.includes(a.typeName))) return false;
  return timesNamed(quest, task.symbol.name) === named;
}

/** The law's verdict on a prompt, read once per action object (a restore mints new ones): `{ no, clears }` - its No
 *  task, and whether that No clears the asking itself (clearingNo) - or null. */
const verdicts = new WeakMap();
/** @param {any} quest @param {any} task @param {any} prompt */
function lawFor(quest, task, prompt) {
  if (!verdicts.has(prompt)) {
    const inert = asksOnAClick(quest, task) ? inertNo(quest, prompt) : null;
    const clearer = inert ? null : clearingNo(quest, task, prompt);
    // the No's own clears are the only names of the asking it allows
    const clears = clearer && asksOnAClick(quest, task, clearer.actions.reduce((n, /** @type {any} */ a) => n + a.taskSymbols.length, 0)) ? clearer : null;
    verdicts.set(prompt, inert ? { no: inert, clears: false } : clears ? { no: clears, clears: true } : null);
  }
  return verdicts.get(prompt);
}

/**
 * Every prompt of the quest the law re-arms after a No: `{ task, prompt, no }`.
 * @param {any} quest
 */
export function promptsThatAskAgain(quest) {
  const out = [];
  for (const task of quest.tasks.values()) {
    for (const prompt of task.actions) {
      if (prompt.typeName !== 'Prompt') continue;
      const law = lawFor(quest, task, prompt);
      if (law) out.push({ task, prompt, no: law.no, clears: law.clears });
    }
  }
  return out;
}

/**
 * THE LAW: every prompt answered No that leads nowhere - its No variable set, itself complete, its task set - asks
 * again on the next click. Answers how many it re-armed.
 * @param {any} quest
 */
export function askAgain(quest) {
  let asked = 0;
  for (const task of quest.tasks.values()) {
    for (const prompt of task.actions) {
      if (prompt.typeName !== 'Prompt' || !prompt.isComplete) continue;
      // the verdict FIRST: it reads no task's state, and only a task it passes is read after it - never a global's,
      // whose read writes it from the store (Task.GetTriggerValue), which a load must not do (Task.RestoreSaveData's order)
      const law = lawFor(quest, task, prompt);
      if (!law) continue;
      const { no } = law;
      if (law.clears) {
        // the author's own clear has run: the asking listens again, and only the prompt is still spent
        if (!no.getTriggerValue() || task.getTriggerValue()) continue;
        prompt.isComplete = false;
        no.clear();                 // its `clear` rearms (Task.Clear), for a second No
        asked++;
        continue;
      }
      if (!task.getTriggerValue()) continue;
      if (!no.getTriggerValue()) continue;   // not answered No (yet)
      task.clear();                 // its click listens again (Task.Clear - its other actions rearm as a `clear` rearms them)
      prompt.isComplete = false;    // the one action the departure re-arms (Prompt.cs: allowRearm = false)
      no.clear();                   // the No forgotten - nothing reads it
      asked++;
    }
  }
  return asked;
}
