// @ts-check
// QL1 (2026-10-19, the owner: "modernize the questing system to be more in line with the mainline games"): THE
// QUESTLINES' LAW - the switch, the stamp a quest carries for life, and the reading of a quest's objective sheet over
// the state its machine holds. Design: bible/06-Systems/Questlines-Arc.md (decisions 1, 2, 6, 7; section 2).
//
// ONE MACHINE, A LAYER OVER IT (decision 2). Nothing here runs a quest: the machine is DFU's (systems/quest/machine.js)
// and never learns of this file. A sheet NAMES state the machine already keeps - a task set, an item carried, a clock
// running, a journal step written, a foe's kills - and an objective shows only once that state opens it (decision 6:
// an objective tells the truth; the Quest Guide's PX4 law kept in its reason, changed in its letter - Port-Ledger A).
//
// THE STAMP (decision 1). A quest is stamped when it STARTS (machine.js startQuestImmediate asks deps.questlinesStamp)
// and keeps the stamp for life in its own save (quest.js `ql`): a quest begun with the switch off is DFU's to its end,
// one begun with it on is the layer's to its end, whatever the switch says later - oblivionLeveling.js's law, decided
// at birth and never on load. Online the lane forces the switch on (features.js row `questlines`, online: true).
//
// LATCHED (section 2.2). What the layer has once seen stays seen: an objective done, a choice taken, an outcome reached
// are written into the quest's `ql` state, so a task a script clears again (M0B00Y06's `_clearclick_`) never un-does
// an objective, and the save carries what the player has already been told.
import { getPref } from '../uiPrefs.js';
import { getInnerSymbolName } from '../quest/symbol.js';
import { QL_STAMP, freshState } from './qlState.js';

export { QL_STAMP, freshState, readState, writeState } from './qlState.js';

/** The Features row's prefs key (systems/features.js, `questlines`). */
export const QUESTLINES_PREF = 'questlines';

/** Whether a quest starting now is the layer's: the player's switch offline, forced on online (the lane's read). */
export const questlinesOn = () => !!getPref(QUESTLINES_PREF);

/** What `deps.questlinesStamp` answers at a start: a fresh state while the switch is on, else null (DFU's quest). */
export const startStamp = (on = questlinesOn()) => (on ? freshState() : null);

/** Whether the quest is the layer's. */
export const isStamped = (quest) => quest?.ql?.stamp === QL_STAMP;

// ---- the bindings (section 2.2) ----

/** The kinds a binding may name. Each reads the machine's own state; none is the layer's but `act` and `choice`, which
 *  the layer writes from what it heard (QL11) and what the player chose (QL4). */
/** A quest that has ended - or is ending: its `end quest` ran (quest.js endQuest's two-tick grace, `ticksToEnd`, is set
 *  before the layer's questEnding hears it, and `questComplete` only after), so an `ended` outcome settles at the end
 *  it names, not two ticks too late. A quest a system tombstones is complete already. */
export const isEnding = (quest) => !!quest?.questComplete || (quest?.ticksToEnd ?? 0) > 0;

/** An outcome bound to the end alone - a sheet's "ended any other way" row. */
const isCatchAll = (o) => !!o?.on && Object.keys(o.on).length === 1 && o.on.ended === true;

export const BINDING_KINDS = Object.freeze(['started', 'ended', 'success', 'task', 'item', 'clock', 'clockDone', 'step', 'global', 'foeDead', 'act', 'choice', 'all', 'any', 'not']);

/** A sheet may spell a symbol as the script does (`_S.02_`) or by its inner name (`S.02`) - the machine keys on the inner
 *  one (symbol.js getInnerSymbolName). */
export const symName = (s) => getInnerSymbolName(String(s ?? ''));
const resource = (quest, name, kind) => {
  const r = quest?.resources?.get?.(symName(name));
  return r && r[kind] ? r : null;
};

/**
 * Whether binding `b` holds for `quest` now. `probe.carries(itemResource)` answers whether the player carries a quest
 * item (the bridge's ctx.carriesQuestItem); an absent probe reads every item as not carried. An unknown binding is
 * false - a sheet's typo can never open an objective (and sheetProblems refuses it before it ships).
 * @param {any} quest @param {any} b @param {{ carries?: (r: any) => boolean, ending?: boolean }} [probe] ending: the quest's
 * end is being told now (observe's `ending`)
 * @returns {boolean}
 */
export function holds(quest, b, probe = {}) {
  if (!quest || !b || typeof b !== 'object') return false;
  if (Array.isArray(b.all)) return b.all.length > 0 && b.all.every((x) => holds(quest, x, probe));
  if (Array.isArray(b.any)) return b.any.some((x) => holds(quest, x, probe));
  if (b.not) return !holds(quest, b.not, probe);
  if (b.started === true) return true;
  if (b.ended === true) return isEnding(quest) || !!probe.ending;
  if (b.success === true) return !!quest.questSuccess;
  if (b.task != null) return !!quest.tasks?.get?.(symName(b.task))?.getTriggerValue?.();
  if (b.item != null) { const r = resource(quest, b.item, 'isItem'); return !!r && !!probe.carries?.(r); }
  if (b.clock != null) { const r = resource(quest, b.clock, 'isClock'); return !!r && !!r.clockEnabled && !r.clockFinished; }
  if (b.clockDone != null) { const r = resource(quest, b.clockDone, 'isClock'); return !!r && !!r.clockFinished; }
  if (b.step != null) return [...(quest.activeLogMessages?.values?.() ?? [])].some((e) => e?.stepID === b.step);
  if (b.global != null) return !!quest.hooks?.globalVars?.get?.(b.global);
  if (b.foeDead != null) { const f = resource(quest, b.foeDead, 'isFoe'); return !!f && (f.killCount | 0) >= Math.max(1, f.spawnCount | 0); }
  if (b.act != null) return (quest.ql?.acts?.[b.act] ?? 0) >= Math.max(1, b.n | 0);
  if (b.choice && typeof b.choice === 'object') return quest.ql?.choices?.[b.choice.branch] === b.choice.is;
  return false;
}

/** Every symbol a binding names, as `{ kind, name }` - what sheetProblems checks against the script. */
export function bindingSymbols(b, out = []) {
  if (!b || typeof b !== 'object') return out;
  for (const k of ['all', 'any']) if (Array.isArray(b[k])) for (const x of b[k]) bindingSymbols(x, out);
  if (b.not) bindingSymbols(b.not, out);
  for (const k of ['task', 'item', 'clock', 'clockDone', 'foeDead']) if (b[k] != null) out.push({ kind: k, name: symName(b[k]) });
  return out;
}

// ---- reading a quest through its sheet ----

/** The open binding a sheet omits: an objective with no `open` is open from the start. */
const ALWAYS = Object.freeze({ started: true });

/** FIELD BUGS 2026-10-25i HEART-TAKEN (AUDIT FB1025i B4): A MENDED BINDING READS ITS OBJECTIVE AFRESH, ONCE. An objective
 *  whose binding was mended names the mend (`reread`); a state that has not taken it - a save, or a party copy, from a
 *  build before the mend - holds that objective's latch from the OLD binding (Q0C4XY04's heart, struck on a look at the
 *  body's row), so its latch does not stand until the state takes the mend (observe), which forgets it: the mended
 *  binding decides from there. */
const unmended = (st, o) => !!o?.reread && !(st?.reread ?? []).includes(o.reread);
const latched = (st, list, o) => !!list?.includes(o.id) && !unmended(st, o);

/**
 * The objectives as the player is to see them now: `[{ id, text, state, optional, group, any, mark }]` in the sheet's
 * order, each `state` one of 'hidden' (its state has not opened it), 'open', 'done' or 'failed'. Done and failed read
 * the latch as well as the state now, so a cleared task never un-does one - nor hides one the player was shown. `text` is the sheet's English (the window
 * localizes it - qlText).
 * @param {any} quest @param {any} sheet @param {{ carries?: (r: any) => boolean }} [probe]
 */
export function readObjectives(quest, sheet, probe = {}) {
  const st = quest?.ql ?? null;
  return (sheet?.objectives ?? []).map((o) => {
    const done = latched(st, st?.done, o) || holds(quest, o.done, probe);
    const failed = !done && (latched(st, st?.failed, o) || (!!o.fail && holds(quest, o.fail, probe)));
    const open = done || failed || latched(st, st?.opened, o) || holds(quest, o.open ?? ALWAYS, probe);
    return {
      id: o.id, text: o.text, state: done ? 'done' : failed ? 'failed' : open ? 'open' : 'hidden',
      optional: !!o.optional, group: o.group ?? null, any: o.any ?? null, mark: o.mark ? symName(o.mark) : null,
    };
  });
}

/** The first outcome whose binding holds now, in the sheet's order, or null. */
export function outcomeNow(quest, sheet, probe = {}) {
  for (const o of sheet?.outcomes ?? []) if (holds(quest, o.on, probe)) return o;
  return null;
}

/** The outcome a quest that ended with none latched reads as: on a success, the sheet's own success fallback - its
 *  `success` (an outcome's id) or else its `done` - and never a guess (AUDIT QUESTLINES LAW-1: "the first non-failure
 *  outcome" filed a loyal M0B11Y18 as `betrayed`; the sheet law requires every sheet that can succeed to name it);
 *  on a failure, `failed` by name, else the first failure / null. */
export function fallbackOutcome(quest, sheet) {
  const list = sheet?.outcomes ?? [];
  if (quest?.questSuccess) return list.find((o) => o.id === (sheet?.success ?? 'done') && !o.failure) ?? null;
  return list.find((o) => o.id === 'failed') ?? list.find((o) => o.failure) ?? null;
}

/**
 * THE LATCH: what the layer has now seen, written into the quest's state - objectives opened, done and failed, a branch's choice
 * (the first choice task of each branch that holds), and (`settle`) the outcome. Answers what moved this look:
 * `{ done: [ids], failed: [ids], chose: [{ branch, choice }], outcome: id|null }`, so the herald can tell it. An
 * unstamped quest is never written.
 * @param {any} quest @param {any} sheet @param {{ carries?: (r: any) => boolean }} [probe0]
 * @param {{ settle?: boolean, ending?: boolean }} [opts] settle: latch the outcome now (the reward's moment, the quest's end)
 */
export function observe(quest, sheet, probe0 = {}, { settle = false, ending = false } = {}) {
  // `ending`: the caller is the quest's end itself (the layer's questEnding - an `end quest`, or a system's tombstone)
  const probe = ending ? { ...probe0, ending: true } : probe0;
  const moved = { done: [], failed: [], chose: [], outcome: null };
  const st = isStamped(quest) ? quest.ql : null;
  if (!st || !sheet) return moved;
  // HEART-TAKEN (AUDIT FB1025i B4): a mend this state has not taken - its objectives' latches forgotten, the mend taken
  st.reread ??= [];
  const mends = new Set();
  for (const o of sheet.objectives ?? []) {
    if (!unmended(st, o)) continue;
    mends.add(o.reread);
    for (const k of ['done', 'opened', 'failed']) st[k] = (st[k] ?? []).filter((x) => x !== o.id);
  }
  for (const m of mends) st.reread.push(m);
  for (const b of sheet.branches ?? []) {
    if (st.choices[b.id]) continue;
    const c = (b.choices ?? []).find((x) => holds(quest, { task: x.sets }, probe));
    if (c) { st.choices[b.id] = c.id; moved.chose.push({ branch: b.id, choice: c.id }); }
  }
  for (const o of sheet.objectives ?? []) {
    if (!st.opened.includes(o.id) && holds(quest, o.open ?? ALWAYS, probe)) st.opened.push(o.id);   // shown once, shown for good
    if (st.done.includes(o.id)) continue;
    if (holds(quest, o.done, probe)) {
      st.done.push(o.id);
      st.failed = st.failed.filter((x) => x !== o.id);
      moved.done.push(o.id);
    } else if (o.fail && !st.failed.includes(o.id) && holds(quest, o.fail, probe)) {
      st.failed.push(o.id);
      moved.failed.push(o.id);
    }
  }
  if (settle && !st.outcome) {
    let o = outcomeNow(quest, sheet, probe);
    // the catch-all failure row (`on: { ended: true }` - "ended any other way") yields to DFU's own word that the quest
    // succeeded (its GivePc): a success whose own row's binding missed is the sheet's success fallback, never a failure
    if (o?.failure && quest.questSuccess && isCatchAll(o)) o = fallbackOutcome(quest, sheet) ?? o;
    if (!o && (ending || isEnding(quest))) o = fallbackOutcome(quest, sheet);
    if (o) { st.outcome = o.id; moved.outcome = o.id; }
  }
  return moved;
}

/** The quest's outcome record, or null: the latched id's row in the sheet. */
export const outcomeOf = (quest, sheet) => (quest?.ql?.outcome ? (sheet?.outcomes ?? []).find((o) => o.id === quest.ql.outcome) ?? null : null);

// ---- the tier (section 5.1) ----

/** A guild or order rank's tier: 0-1 one, 2-3 two, 4-5 three, 6 and above four. */
export const rankTier = (rank) => (rank >= 6 ? 4 : rank >= 4 ? 3 : rank >= 2 ? 2 : 1);
/** A reputation-gated row's tier, by its band (QuestList minReq 10 and above is a reputation - questLists.js). */
export const reputationTier = (rep) => (rep >= 60 ? 4 : rep >= 40 ? 3 : rep >= 20 ? 2 : 1);
/** A quest offered by level (a social quest, the main quest): its band. */
export const levelTier = (level) => (level >= 21 ? 4 : level >= 14 ? 3 : level >= 7 ? 2 : 1);

/**
 * A quest's tier at its start (section 5.1). A sheet's own `tier` first (a questline's quest says where it stands in its
 * line). Then its list row's minReq (QuestList-Classic.txt's key): from 10 it is a reputation, by its band; under 10 it is
 * a guild's or order's RANK - but a social group's (`social`: Commoners, Merchants, Nobility; questLists.js) under-10 is
 * the player's LEVEL, so a social quest reads the player's level band, as DFU's own gold for it does. No row (the main
 * quest, a summoning, a cure, a script's child): the level band.
 * @param {{ minReq?: number|null, level?: number, social?: boolean, sheetTier?: number|null }} facts
 */
export function questTierOf({ minReq = null, level = 1, social = false, sheetTier = null } = {}) {
  if (Number.isSafeInteger(sheetTier) && sheetTier >= 1 && sheetTier <= 4) return sheetTier;
  if (Number.isSafeInteger(minReq) && minReq >= 10) return reputationTier(minReq);
  if (Number.isSafeInteger(minReq) && minReq >= 0 && !social) return rankTier(minReq);
  return levelTier(Math.max(1, level | 0));
}
