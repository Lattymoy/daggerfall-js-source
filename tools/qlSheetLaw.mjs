#!/usr/bin/env node
// QL1 (bible/06-Systems/Questlines-Arc.md section 2.5): THE SHEET'S LAW - every way a sheet can lie about its script,
// answered in a writer's words. Moved out of the game (systems/questlines/qlSheets.js holds the sheets the game reads):
// the game never runs it, and its messages are the tools' and the pins', never a player's (the L10N4 ratchet's reason).
// Read by tools/qlCheck.mjs, tools/qlSheetDraft.mjs and test/systems/questlines/ql1_sheets.test.js.
import { BINDING_KINDS, bindingSymbols, symName } from '../src/systems/questlines/qlLaw.js';
import { PAY_NAMES } from '../src/systems/questlines/qlSheets.js';
import { payProfileOf, goldFactor } from '../src/systems/questlines/qlRewards.js';
import { factionsTable } from '../src/systems/quest/tables.js';
import { WEAPONS_ENUM, ARMOR_ENUM } from '../src/combat/enemyEquipment.js';
import { ITEM_GROUPS } from '../src/systems/loot/loot.js';
import { templateByIndex, setItemFields, isAmmunition } from '../src/systems/item/itemTemplates.js';
import { wearableItem } from '../src/systems/equip.js';

const ID = /^[a-z][a-zA-Z0-9-]{0,31}$/;
const isText = (s) => typeof s === 'string' && s.trim().length > 0 && s.length <= 160;

/**
 * AUDIT QUESTLINES REWARD-5: the bases a named piece may name, by kind - the item templates the reward's roll makes (qlRewards.js
 * rollRewardChoice through gateSpoils.js spoilsBase): a weapon of ItemBuilder.CreateRandomWeapon's eighteen (never an arrow),
 * a piece of CreateRandomArmor's eleven, a jewel of the Jewellery group a slot takes (never the Wand), each by its
 * template's name ("Katana", "Helm", "Amulet"). A mod's registered custom template is no base: the roll draws it only
 * while that mod is on.
 */
export const NAMED_BASES = Object.freeze({
  weapon: Object.freeze(Object.values(WEAPONS_ENUM).filter((i) => !isAmmunition(setItemFields({ group: 'Weapons', templateIndex: i }))).map((i) => templateByIndex(i)?.name).filter(Boolean)),
  armor: Object.freeze(Object.values(ARMOR_ENUM).map((i) => templateByIndex(i)?.name).filter(Boolean)),
  jewel: Object.freeze(ITEM_GROUPS.Jewellery.filter((i) => wearableItem(setItemFields({ group: 'Jewellery', templateIndex: i }))).map((i) => templateByIndex(i)?.name).filter(Boolean)),
});

/** A binding's own shape: one known kind, its value of the kind's type. */
function bindingShape(b, where, out) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) { out.push(`${where}: not a binding`); return; }
  const keys = Object.keys(b).filter((k) => k !== 'n');
  if (keys.length !== 1 || !BINDING_KINDS.includes(keys[0])) { out.push(`${where}: names ${keys.join(', ') || 'nothing'} - one of ${BINDING_KINDS.join(', ')}`); return; }
  const [k] = keys, v = b[k];
  if (k === 'all' || k === 'any') {
    if (!Array.isArray(v) || !v.length) out.push(`${where}.${k}: an empty list`);
    else v.forEach((x, i) => bindingShape(x, `${where}.${k}[${i}]`, out));
  } else if (k === 'not') bindingShape(v, `${where}.not`, out);
  else if (k === 'started' || k === 'ended' || k === 'success') { if (v !== true) out.push(`${where}.${k}: must be true`); }
  else if (k === 'step' || k === 'global') { if (!Number.isSafeInteger(v) || v < 0) out.push(`${where}.${k}: not a whole number`); }
  else if (k === 'choice') { if (!v || typeof v.branch !== 'string' || typeof v.is !== 'string') out.push(`${where}.choice: { branch, is }`); }
  else if (typeof v !== 'string' || !v) out.push(`${where}.${k}: not a symbol`);
  if (b.n != null && (!Number.isSafeInteger(b.n) || b.n < 1)) out.push(`${where}.n: not a count`);
}

/**
 * Every problem with `sheet` - its shape alone, or (`quest`, `lines`) against the parsed quest and its script's lines as
 * well. An empty list is a sheet that ships.
 * @param {any} sheet
 * @param {{ quest?: any, lines?: string[] }} [against]
 * @returns {string[]}
 */
export function sheetProblems(sheet, { quest = null, lines = null } = {}) {
  const out = [];
  const name = String(sheet?.quest ?? '?');
  const at = (s) => `${name} ${s}`;
  if (!sheet || typeof sheet.quest !== 'string' || !sheet.quest) return ['a sheet names no quest'];
  if (sheet.tier != null && (!Number.isSafeInteger(sheet.tier) || sheet.tier < 1 || sheet.tier > 4)) out.push(at('tier: 1 to 4'));
  const objectives = Array.isArray(sheet.objectives) ? sheet.objectives : [];
  if (!objectives.length) out.push(at('has no objective'));
  const ids = new Set();
  for (const [i, o] of objectives.entries()) {
    const w = `objectives[${i}]`;
    if (!ID.test(o?.id ?? '')) out.push(at(`${w}: id "${o?.id}"`));
    else if (ids.has(o.id)) out.push(at(`${w}: id "${o.id}" twice`));
    ids.add(o?.id);
    if (!isText(o?.text)) out.push(at(`${w}: no text`));
    if (o?.open != null) bindingShape(o.open, at(`${w}.open`), out);
    if (o?.done == null) out.push(at(`${w}: no done`)); else bindingShape(o.done, at(`${w}.done`), out);
    if (o?.fail != null) bindingShape(o.fail, at(`${w}.fail`), out);
    if (o?.group != null && !ID.test(o.group)) out.push(at(`${w}.group: "${o.group}"`));
    if (o?.any != null && !ID.test(o.any)) out.push(at(`${w}.any: "${o.any}"`));
  }
  const branchIds = new Set();
  for (const [i, b] of (sheet.branches ?? []).entries()) {
    const w = `branches[${i}]`;
    if (!ID.test(b?.id ?? '') || branchIds.has(b.id)) out.push(at(`${w}: id "${b?.id}"`));
    branchIds.add(b?.id);
    if (!isText(b?.text)) out.push(at(`${w}: no text`));
    const choices = Array.isArray(b?.choices) ? b.choices : [];
    if (choices.length < 2 || choices.length > 4) out.push(at(`${w}: ${choices.length} choices - two to four`));
    const cids = new Set();
    for (const [j, c] of choices.entries()) {
      if (!ID.test(c?.id ?? '') || cids.has(c.id)) out.push(at(`${w}.choices[${j}]: id "${c?.id}"`));
      cids.add(c?.id);
      if (!isText(c?.text)) out.push(at(`${w}.choices[${j}]: no text`));
      if (typeof c?.sets !== 'string' || !c.sets) out.push(at(`${w}.choices[${j}]: sets no task`));
    }
  }
  const outcomes = Array.isArray(sheet.outcomes) ? sheet.outcomes : [];
  if (!outcomes.length) out.push(at('has no outcome'));
  const oids = new Set();
  for (const [i, o] of outcomes.entries()) {
    const w = `outcomes[${i}]`;
    if (!ID.test(o?.id ?? '') || oids.has(o.id)) out.push(at(`${w}: id "${o?.id}"`));
    oids.add(o?.id);
    if (!isText(o?.text)) out.push(at(`${w}: no text`));
    if (o?.on == null) out.push(at(`${w}: no on`)); else bindingShape(o.on, at(`${w}.on`), out);
    if (!PAY_NAMES.includes(o?.pay)) out.push(at(`${w}.pay: "${o?.pay}" - one of ${PAY_NAMES.join(', ')}`));
    if (o?.standing != null) {
      if (typeof o.standing !== 'object' || Array.isArray(o.standing)) out.push(at(`${w}.standing: not a map`));
      else for (const [f, v] of Object.entries(o.standing)) if (!Number.isSafeInteger(v) || v === 0 || Math.abs(v) > 10) out.push(at(`${w}.standing.${f}: a whole number, -10 to 10, not 0`));
    }
    if (o?.legal != null && (!Number.isSafeInteger(o.legal) || Math.abs(o.legal) > 10)) out.push(at(`${w}.legal: -10 to 10`));
    // QL3 (section 5.2): an outcome's NAMED PIECE - one of its three cards carries a name of its own: a questline's
    // ending alone (a flagship quest of DFU's keeps the ladder's names), an outcome that pays gear, a kind the choice deals
    if (o?.named != null) {
      const n = o.named;
      if (!n || typeof n !== 'object' || typeof n.name !== 'string' || !/^[A-Z][A-Za-z' -]{2,39}$/.test(n.name)) out.push(at(`${w}.named.name: a name, 3-40 letters, capitalised`));
      if (!['weapon', 'armor', 'jewel'].includes(n?.kind)) out.push(at(`${w}.named.kind: weapon, armor or jewel`));
      // AUDIT QUESTLINES REWARD-5: the piece the name is - a helm's name on a helm, never on whatever the roll drew
      else if (!NAMED_BASES[n.kind].includes(n?.base)) out.push(at(`${w}.named.base: "${n?.base}" - a ${n.kind} base the reward's roll makes: ${NAMED_BASES[n.kind].join(', ')}`));
      if (o.failure || ['betrayal', 'own', 'none'].includes(o.pay)) out.push(at(`${w}.named: an outcome that pays no gear names no piece`));
      if (!/^QL[A-Z]{2}\d{2}$/.test(String(sheet.quest ?? ''))) out.push(at(`${w}.named: a questline's outcome alone`));
    }
  }
  // AUDIT QUESTLINES LAW-1: the SUCCESS FALLBACK - what a success no outcome's own binding holds for settles to (qlLaw.js
  // fallbackOutcome: the sheet's `success`, else its `done`). Never a guess: it names an outcome the sheet has, no failure,
  // no betrayal, and no choice the player never made (the script half reads a task an ask or a prompt sets)
  if (sheet.success != null) {
    const o = typeof sheet.success === 'string' ? outcomes.find((x) => x?.id === sheet.success) : null;
    if (!o) out.push(at(`success: "${sheet.success}" names no outcome of the sheet`));
  }
  const fb = successFallback(sheet);
  if (fb) {
    if (fb.failure) out.push(at(`success: "${fb.id}" is a failure - a success never settles to one`));
    if (fb.pay === 'betrayal') out.push(at(`success: "${fb.id}" pays a betrayal - a success no row named never betrayed anyone`));
    if (hasChoice(fb.on)) out.push(at(`success: "${fb.id}" is bound to a choice - a success no row named made none`));
  }
  // choice bindings name branches the sheet has
  const walk = (b, w) => {
    if (!b || typeof b !== 'object') return;
    if (b.choice && (!branchIds.has(b.choice.branch) || !(sheet.branches ?? []).find((x) => x.id === b.choice.branch)?.choices?.some((c) => c.id === b.choice.is))) out.push(at(`${w}: names no branch choice ${b.choice.branch}/${b.choice.is}`));
    for (const k of ['all', 'any']) if (Array.isArray(b[k])) b[k].forEach((x) => walk(x, w));
    if (b.not) walk(b.not, w);
  };
  for (const [i, o] of objectives.entries()) for (const k of ['open', 'done', 'fail']) walk(o?.[k], `objectives[${i}].${k}`);
  for (const [i, o] of outcomes.entries()) walk(o?.on, `outcomes[${i}].on`);
  if (quest) out.push(...scriptProblems(sheet, quest, lines).map(at));
  return out;
}

/** The script half: every symbol bound names a resource or task of its kind; every step bound is one the script logs;
 *  every task a choice sets or an outcome waits on can be set by something in the script. */
function scriptProblems(sheet, quest, lines) {
  const out = [];
  const kindOk = { task: (n) => quest.tasks?.has?.(n), item: (n) => !!quest.resources?.get?.(n)?.isItem, clock: (n) => !!quest.resources?.get?.(n)?.isClock, clockDone: (n) => !!quest.resources?.get?.(n)?.isClock, foeDead: (n) => !!quest.resources?.get?.(n)?.isFoe };
  const bindings = [];
  for (const [i, o] of (sheet.objectives ?? []).entries()) for (const k of ['open', 'done', 'fail']) if (o?.[k]) bindings.push([`objectives[${i}].${k}`, o[k]]);
  for (const [i, o] of (sheet.outcomes ?? []).entries()) if (o?.on) bindings.push([`outcomes[${i}].on`, o.on]);
  for (const [w, b] of bindings) for (const s of bindingSymbols(b)) if (!kindOk[s.kind]?.(s.name)) out.push(`${w}: the script has no ${s.kind === 'task' ? 'task' : s.kind === 'foeDead' ? 'foe' : s.kind === 'clockDone' ? 'clock' : s.kind} "${s.name}"`);
  const steps = new Set();
  for (const l of lines ?? []) { const m = /\blog\s+\d+\s+step\s+(\d+)/i.exec(l); if (m) steps.add(Number(m[1])); }
  const stepsIn = (b, w) => {
    if (!b || typeof b !== 'object') return;
    if (b.step != null && lines && !steps.has(b.step)) out.push(`${w}: the script logs no step ${b.step}`);
    for (const k of ['all', 'any']) if (Array.isArray(b[k])) b[k].forEach((x) => stepsIn(x, w));
    if (b.not) stepsIn(b.not, w);
  };
  for (const [w, b] of bindings) stepsIn(b, w);
  for (const [i, o] of (sheet.objectives ?? []).entries()) {
    if (o?.mark && !quest.resources?.has?.(symName(o.mark))) out.push(`objectives[${i}].mark: the script has no resource "${symName(o.mark)}"`);
  }
  for (const [i, b] of (sheet.branches ?? []).entries()) {
    for (const [j, c] of (b?.choices ?? []).entries()) {
      const n = symName(c?.sets);
      if (!quest.tasks?.has?.(n)) out.push(`branches[${i}].choices[${j}]: the script has no task "${n}"`);
      else if (lines && !settable(quest, n, lines)) out.push(`branches[${i}].choices[${j}]: nothing in the script can set "${n}"`);
    }
  }
  for (const [w, b] of bindings) {
    for (const s of bindingSymbols(b)) {
      if (s.kind === 'task' && quest.tasks?.has?.(s.name) && lines && !settable(quest, s.name, lines)) out.push(`${w}: nothing in the script can set "${s.name}"`);
    }
  }
  const outcomeIds = new Set((sheet.outcomes ?? []).map((o) => o?.id));
  const actions = [...(quest.tasks?.values?.() ?? [])].flatMap((t) => t.actions.map((a) => ({ task: t, a })));
  // AUDIT QUESTLINES BRANCH-10: a script's `outcome _x_` names an outcome its sheet has - an unknown one latches a name no
  // row answers (qlActions.js QlOutcome), and the quest ends with no outcome at all: no standing, no gear, no line filed
  for (const { a } of actions) if (a.typeName === 'QlOutcome' && !outcomeIds.has(a.outcomeSymbol?.name)) out.push(`the script says "outcome _${a.outcomeSymbol?.name}_" - the sheet has no such outcome`);
  // AUDIT QUESTLINES REWARD-12: a standing names one of Quests-Factions' INDIVIDUAL rows (p2 -1, its id in p3) - a row of
  // p2 0 and above is an occupation or a group (`Noble`, `Questor`), whose p3 is no faction's id
  for (const [i, o] of (sheet.outcomes ?? []).entries()) {
    for (const f of Object.keys(o?.standing ?? {})) if (!individualFaction(f)) out.push(`outcomes[${i}].standing.${f}: no individual faction of Quests-Factions.txt (a p2 -1 row)`);
  }
  // AUDIT QUESTLINES REWARD-6 / LAW-3: an outcome that pays gear sits where the quest can be paid - the layer offers its
  // piece only to a quest paid or a success (qlLayer.js ending), which a script makes by `give pc`, `ql paid` or `train
  // pc`. None anywhere in the script, or (unless its start-up pays) none in the task the outcome waits on that ENDS the
  // quest: the sheet promises gear it cannot pay
  const pays = payersOf(quest);
  const startPays = pays.some((t) => t.type === 'headless');
  for (const [i, o] of (sheet.outcomes ?? []).entries()) {
    if (!o || o.failure || !payProfileOf(o).gear) continue;
    if (!pays.length) { out.push(`outcomes[${i}]: pays "${o.pay}" (gear) - nothing in the script pays (give pc, ql paid, train pc): "own" or "none"`); continue; }
    if (startPays) continue;
    for (const sym of positiveSymbols(o.on)) {
      const t = sym.kind === 'task' ? quest.tasks?.get?.(sym.name) : null;
      if (t && t.actions.some((a) => a.typeName === 'EndQuest') && !pays.includes(t)) out.push(`outcomes[${i}]: pays "${o.pay}" (gear) on "_${sym.name}_", which ends the quest unpaid: "own" or "none"`);
    }
  }
  // AUDIT QUESTLINES LAW-1: a quest that can end a success no row holds for names the outcome such a success settles to
  const chosen = choiceTasks(quest);
  const fb = successFallback(sheet);
  if (!fb && lines && canSucceedUnnamed(sheet, quest, lines)) out.push('success: the quest can end a success no outcome holds for, and the sheet names no success fallback (`success`, or an outcome `done`)');
  if (fb && positiveSymbols(fb.on).some((x) => x.kind === 'task' && chosen.has(x.name))) out.push(`success: "${fb.id}" waits on a task a choice sets - a success no row named made no choice`);
  return out;
}

/**
 * Whether anything in the script can set task `name`: a task with a trigger of its own (`when`, `clicked`, `killed`,
 * `toting` ...), a global-variable link, or a name another line of the script says - `start task`, `setvar`, a prompt's
 * yes or no, `pick one of`, a `do` arm, `run quest`. A task only its own header names is dead, and a sheet bound to it
 * would wait forever.
 */
export function settable(quest, name, lines) {
  const task = quest.tasks?.get?.(name);
  if (!task) return false;
  if (task.hasTriggerConditions || task.globalVarLink !== -1 || task.type === 'headless' || task.type === 'persistUntil') return true;
  const sym = new RegExp(`(^|[^A-Za-z0-9_.])_${name.replace(/\./g, '\\.')}_($|[^A-Za-z0-9_.])`);
  const header = new RegExp(`^\\s*(_${name.replace(/\./g, '\\.')}_\\s+task:|variable\\s+_${name.replace(/\./g, '\\.')}_\\s*$)`);
  let inQbn = false;
  for (const l of lines) {
    if (/^\s*QBN:/i.test(l)) { inQbn = true; continue; }
    if (!inQbn || header.test(l) || READS_ONLY.test(l)) continue;
    if (sym.test(l)) return true;
  }
  return false;
}
/** A line that names a task only to READ it (a trigger's `when`, a persist-until header) or to clear it - never a set. */
const READS_ONLY = /^\s*(when\b|until\b|clear\b|unset\b|drop\b)/i;

/** The sheet's success fallback (qlLaw.js fallbackOutcome): the outcome its `success` names, else its `done`. */
export const successFallback = (sheet) => (sheet?.outcomes ?? []).find((o) => o?.id === (sheet?.success ?? 'done')) ?? null;

/** The symbols a binding needs SET (none read under a `not`). */
function positiveSymbols(b, neg = false, out = []) {
  if (!b || typeof b !== 'object') return out;
  for (const [k, v] of Object.entries(b)) {
    if ((k === 'all' || k === 'any') && Array.isArray(v)) v.forEach((x) => positiveSymbols(x, neg, out));
    else if (k === 'not') positiveSymbols(v, !neg, out);
    else if (!neg && k !== 'n') out.push(k === 'choice' ? { kind: 'choice', name: null, choice: v } : { kind: k, name: typeof v === 'string' ? symName(v) : null });
  }
  return out;
}
/** Whether a binding needs a choice taken (a `choice`, not under a `not`). */
const hasChoice = (b) => positiveSymbols(b).some((x) => x.kind === 'choice');

/** The tasks a player's choice sets: every `ask`'s (QL4), `prompt`'s and `promptmulti`'s. */
export function choiceTasks(quest) {
  const out = new Set();
  for (const t of quest?.tasks?.values?.() ?? []) for (const a of t.actions) {
    if (a.typeName === 'QlAsk') for (const x of a.choiceTasks) out.add(x.name);
    if (a.typeName === 'Prompt') for (const x of [a.yesTaskSymbol, a.noTaskSymbol]) if (x) out.add(x.name);
    if (a.typeName === 'PromptMulti') for (const x of [a.opt1TaskSymbol, a.opt2TaskSymbol, a.opt3TaskSymbol, a.opt4TaskSymbol]) if (x) out.add(x.name);
  }
  return out;
}

/** The tasks that can make the quest paid or a success: a `give pc` (not a letter's - qlLayer.js reward), `ql paid`, `train pc`. */
function payersOf(quest) {
  return [...(quest?.tasks?.values?.() ?? [])].filter((t) => t.actions.some((a) => (a.typeName === 'GivePc' && (a.isNothing || quest.resources?.get?.(a.itemSymbol?.name)?.itemName !== 'letter')) || a.typeName === 'QlPaid' || a.typeName === 'TrainPc'));
}

/** An individual faction row of Quests-Factions.txt (p2 -1): its id, or null. */
function individualFaction(name) {
  const table = factionsTable();
  if (!table.hasValue(name) || Number.parseInt(table.getValue('p2', name), 10) !== -1) return null;
  const id = Number.parseInt(table.getValue('p3', name), 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Whether the quest can END A SUCCESS NO OUTCOME'S ROW IS SURE TO HOLD FOR - the case the success fallback is for (M0B11Y18:
 * the Queen pays at `_S.18_`, which no row names - a loyal player whose hunt ran out ended a success no row held, and was
 * filed as the traitor's man). Sure is a row that waits on one task that STAYS set: one a choice sets, or one no line
 * clears or unsets whose `when`, if it has one, needs only tasks that stay (a task a `when` sets stops holding when its
 * condition does - 40C00Y00's `_S.06_` unsets what it waits on). A task that makes the quest a success (GivePc's QuestComplete arm - `give pc nothing`, or an
 * item given without `notify` or `silently` - `ql paid`, `train pc`) is covered when it is downstream (`downstreamOf`)
 * of such a row's task, or of a task that says its outcome (`outcome _x_`). The start-up is covered by nothing. Every
 * quest the flagship hand-in (QL4's `ask`) gives two rows is covered.
 */
export function canSucceedUnnamed(sheet, quest, lines) {
  const chosen = choiceTasks(quest);
  const memo = new Map();
  const stays = (name) => {
    if (memo.has(name)) return memo.get(name);
    memo.set(name, false);   // a cycle stays nowhere
    const task = quest.tasks?.get?.(name);
    const sym = new RegExp(`(^|[^A-Za-z0-9_.])_${name.replace(/\./g, '\\.')}_($|[^A-Za-z0-9_.])`);
    const when = task?.actions.find((a) => a.typeName === 'WhenTask');
    const s = !!task && (chosen.has(name) || (!(lines ?? []).some((l) => /^\s*(clear|unset)\b/i.test(l) && sym.test(l))
      && (!when || when.evaluations.every((e) => (e.op === 'when' || e.op === 'and') && stays(symName(e.task))))));
    memo.set(name, s);
    return s;
  };
  const roots = new Set();
  for (const o of sheet?.outcomes ?? []) {
    const keys = Object.keys(o?.on ?? {}).filter((k) => k !== 'n');
    if (!o?.failure && keys.length === 1 && keys[0] === 'task' && stays(symName(o.on.task))) roots.add(symName(o.on.task));
  }
  // a task that says its outcome (`outcome _x_`, one of the sheet's) latches it there - no fallback is read after it
  const ids = new Set((sheet?.outcomes ?? []).filter((o) => !o?.failure).map((o) => o.id));
  for (const t of quest.tasks?.values?.() ?? []) if (t.actions.some((a) => a.typeName === 'QlOutcome' && ids.has(a.outcomeSymbol?.name))) roots.add(t.symbol?.name);
  const covered = downstreamOf(quest, lines, roots);
  for (const t of quest.tasks?.values?.() ?? []) {
    const succeeds = t.actions.some((a) => (a.typeName === 'GivePc' && (a.isNothing || (!a.textId && !a.silently))) || a.typeName === 'QlPaid' || a.typeName === 'TrainPc');
    if (succeeds && (t.type === 'headless' || !covered(t.symbol?.name))) return true;
  }
  return false;
}

/**
 * Which tasks can only be set once one of `roots` is: a root itself; a task whose `when` (no `or` in it) needs such a
 * task set; or a task with no trigger of its own every line setting which stands in such a task. The start-up is
 * downstream of nothing. A predicate on a task's inner name.
 */
export function downstreamOf(quest, lines, roots) {
  const holders = taskHolders(lines);
  const memo = new Map();
  const down = (name) => {
    if (memo.has(name)) return memo.get(name);
    memo.set(name, false);   // a cycle is downstream of nothing
    let d = roots.has(name);
    const task = quest.tasks?.get?.(name);
    if (!d && task) {
      const when = task.actions.find((a) => a.typeName === 'WhenTask');
      if (when && !when.evaluations.some((e) => /^or/.test(e.op))) d = when.evaluations.some((e) => (e.op === 'when' || e.op === 'and') && down(symName(e.task)));
      else if (!task.hasTriggerConditions && task.type !== 'headless') {
        const by = holders.get(name) ?? [];
        d = by.length > 0 && by.every((h) => h !== '' && h !== name && down(h));
      }
    }
    memo.set(name, d);
    return d;
  };
  return down;
}

/** Each task the QBN's lines SET (any line naming it but its header and a read - settable's reading), by the tasks whose
 *  lines do it: name -> [holder] ('' the start-up). */
function taskHolders(lines) {
  const out = new Map();
  let inQbn = false, cur = '';
  for (const l of lines ?? []) {
    if (/^\s*QBN:/i.test(l)) { inQbn = true; continue; }
    if (!inQbn || /^\s*--/.test(l) || /^\s*(Item|Person|Place|Clock|Foe)\s/.test(l)) continue;
    const head = /^\s*(?:_([A-Za-z0-9.]+)_\s+task:|variable\s+_([A-Za-z0-9.]+)_\s*$|until\s+_([A-Za-z0-9.]+)_\s+performed:|[A-Za-z]\w*\s+_([A-Za-z0-9.]+)_\s*$)/.exec(l);
    if (head) { cur = head[1] ?? head[2] ?? head[3] ?? head[4]; continue; }
    if (READS_ONLY.test(l)) continue;
    for (const m of l.matchAll(/(?:^|[^A-Za-z0-9_.])_([A-Za-z0-9.]+)_(?=$|[^A-Za-z0-9_.])/g)) {
      if (!out.has(m[1])) out.set(m[1], []);
      out.get(m[1]).push(cur);
    }
  }
  return out;
}

/**
 * AUDIT QUESTLINES BRANCH-5 / REWARD-4: WHAT AN OUTCOME GIVES THE PLAYER - not its pay's name. Whether it ends the quest a
 * failure; what the script hands over on its path (the tasks its binding waits on - a choice's, the task it sets - and
 * those they set going: gold by a `give pc` of a gold Item, times the pay's factor, or another item, or what `get item`
 * hands over; nothing where nothing is given, whatever the factor); whether it offers gear and a rung up; the standing
 * and legal standing the sheet moves; and the script's own `change repute` and `legal repute` on that path. Two answers
 * of one ask that give the same are no branch.
 */
export function outcomeEffect(outcome, quest, sheet = null) {
  const sets = (c) => symName((sheet?.branches ?? []).find((b) => b.id === c?.branch)?.choices?.find((x) => x.id === c?.is)?.sets);
  const path = pathTasks(quest, positiveSymbols(outcome?.on).map((x) => (x.kind === 'task' ? x.name : x.kind === 'choice' ? sets(x.choice) : null)).filter(Boolean));
  const acts = [...path].flatMap((n) => quest.tasks?.get?.(n)?.actions ?? []);
  // `give pc` is the reward (its gold scaled by the outcome - qlRewards.js scaleGold); `get item` hands over as well (R0C11Y28's vampire pays so)
  const given = acts.filter((a) => (a.typeName === 'GivePc' && !a.isNothing) || a.typeName === 'GetItem').map((a) => [a.typeName, quest.resources?.get?.(a.itemSymbol?.name)])
    .filter(([, r]) => r && r.itemName !== 'letter').map(([k, r]) => (k === 'GivePc' ? (r.isGold ? `gold x${goldFactor(outcome)}` : 'item') : r.isGold ? 'gold' : 'got item')).sort();
  const repute = acts.filter((a) => a.typeName === 'ChangeReputeWith').map((a) => `${a.target?.name}${a.amount}`).sort();
  const legal = acts.filter((a) => a.typeName === 'LegalRepute').reduce((n, a) => n + (a.amount | 0), outcome?.legal ?? 0);
  const p = payProfileOf(outcome);
  return JSON.stringify([!!outcome?.failure, given, !outcome?.failure && p.gear, p.step, Object.entries(outcome?.standing ?? {}).sort(), legal, repute]);
}

/** The tasks set going from `names`: each, every task whose `when` reads one of them set, and every `start task` they say. */
function pathTasks(quest, names) {
  const seen = new Set(names);
  const queue = [...names];
  const tasks = [...(quest?.tasks?.values?.() ?? [])];
  while (queue.length) {
    const n = queue.shift();
    const add = (x) => { if (x && !seen.has(x)) { seen.add(x); queue.push(x); } };
    for (const t of tasks) {
      const when = t.actions.find((a) => a.typeName === 'WhenTask');
      if (when?.evaluations.some((e) => !/not/i.test(e.op) && symName(e.task) === n)) add(t.symbol?.name);
    }
    for (const a of quest.tasks?.get?.(n)?.actions ?? []) if (a.typeName === 'StartTask') add(a.taskSymbol?.name);
  }
  return seen;
}

/** The outcome each choice of each branch reaches: `[{ branch, choice, outcome }]` - the first whose binding needs that
 *  choice (its `choice`, or a task downstream of the task it sets), or null. */
export function branchOutcomes(sheet, quest, lines) {
  const out = [];
  for (const b of sheet?.branches ?? []) {
    for (const c of b?.choices ?? []) {
      const down = downstreamOf(quest, lines, new Set([symName(c?.sets)]));
      const o = (sheet.outcomes ?? []).find((x) => positiveSymbols(x?.on).some((s) => (s.kind === 'choice' && s.choice?.branch === b.id && s.choice?.is === c.id) || (s.kind === 'task' && down(s.name))));
      out.push({ branch: b.id, choice: c.id, sets: symName(c?.sets), outcome: o ?? null });
    }
  }
  return out;
}

/**
 * THE FLAGSHIP'S BRANCH (section 3), by what it gives: a branch the script asks (QL4's `ask`) - its answers reach
 * outcomes (an answer no outcome waits on, the sheet's success fallback) that give pairwise differently, at least two of
 * them; a branch the script decides (a `prompt` of DFU's) - the sheet's ends that are no failure give at least two
 * different things. Answers why not, or null.
 */
export function flagshipProblem(sheet, quest, lines) {
  if (!(sheet?.branches ?? []).length) return 'no branch';
  const asked = new Set();
  for (const t of quest?.tasks?.values?.() ?? []) for (const a of t.actions) if (a.typeName === 'QlAsk') for (const x of a.choiceTasks) asked.add(x.name);
  const reached = branchOutcomes(sheet, quest, lines);
  const askBranches = [...new Set(reached.filter((r) => asked.has(r.sets)).map((r) => r.branch))];
  if (askBranches.length) {
    for (const b of askBranches) {
      // an answer no outcome waits on leaves the quest to end as it would unasked - its success fallback
      const effects = reached.filter((r) => r.branch === b).map((r) => ({ ...r, outcome: r.outcome ?? successFallback(sheet) })).filter((r) => r.outcome).map((r) => [r.choice, r.outcome.id, outcomeEffect(r.outcome, quest, sheet)]);
      if (effects.length < 2) return `the ask "${b}": ${effects.length} of its answers reach an outcome`;
      for (let i = 0; i < effects.length; i++) for (let j = i + 1; j < effects.length; j++) if (effects[i][2] === effects[j][2]) return `the ask "${b}": "${effects[i][0]}" (${effects[i][1]}) and "${effects[j][0]}" (${effects[j][1]}) give the player the same - ${effects[i][2]}`;
    }
    return null;
  }
  const ends = (sheet.outcomes ?? []).filter((o) => !o.failure);
  if (ends.length < 2) return 'one outcome - a branch that ends it the same way is no branch';
  if (new Set(ends.map((o) => outcomeEffect(o, quest, sheet))).size < 2) return 'its outcomes give the player alike';
  return null;
}
