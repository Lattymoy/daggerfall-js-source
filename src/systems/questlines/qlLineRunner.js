// @ts-check
// QL12-QL16 (bible/06-Systems/Questlines-Arc.md section 4): THE LINES, RUN - made by the layer (qlLayer.js) over the
// machine. A line (qlLines.js) whose gate holds is OFFERED; the player TAKES it (takeLine - at a notice board, a giver's
// door or the Quests tab) and its first step's quest starts then; a step that ends well starts the next, a later step
// that ends badly is offered again a day later; the last step's outcome is the line's. It never decides a quest: each
// step is a script on the machine like any other, its objectives a sheet like any other's.
//
// QL-OFFERED (2026-10-25, Lord Rumpkin: "every town I enter there is some courier ramming quest letters into
// my hand ... Random quests like that should be picked up in the tavern, or notice board"; the owner: "No band aids",
// and his decision: A QUESTLINE IS TAKEN, NEVER SENT). QL0 began every line whose gate held, unasked, and its first
// letter came by courier at the next town by day. DFU sends a letter unasked only where the story is already the
// player's (the main quest's, a guild's invitation, a vampire clan's) and puts every other quest behind a questor's
// accept or refuse (DaggerfallQuestOfferWindow, the guild popup's GetQuest - quest/offerFlow.js); so does this now. A
// line not begun is never begun here, a first step that lapses or ends unfinished puts its line back on offer (never
// sent again), and the later steps of a line the player took still come by courier, as DFU's main quest does - at the
// courier's pace (FB1020c LETTER-PACE, re-aimed: no later step's letter while another's is on its way, and an hour
// after the last).
//
// WHAT IT KEEPS (the layer's save, beside the rewards waiting): each line begun - the step it stands at, the outcome
// each step ended on, whether it is done, when its next step may start, and when its last letter came (FB1020c
// LETTER-PACE: the next courier's hour counts from it). A step's quest is found by NAME on the
// machine, never by uid, so a restart (QUEST-RESET - a new copy) or a quest set aside (QUEST-SHELF) is still the step.
//
// THE SERVICE'S PART (decision 8; net/questlineClaims.js). A step the service pays - a witnessed one, a title's, the
// key's - is CLAIMED twice, each claim saying its phase: `open` when it starts (the service writes the opening - the
// line's first is its witness's window), `end` when it ends well (the service looks for its receipt, and pays the title
// or the key). A claim the service could not answer - the network down, the switch shut - or an end it could not witness
// yet - a receipt not claimed - is asked again: a minute apart CLAIM_TRIES times, then every CLAIM_SLOW_MS for as long
// as the page lives, and again at the next start of the page - never given up (AUDIT QUESTLINES SERVICE-2: an open
// dropped after five minutes left a step no deed could witness). An end the service has not witnessed is the step's
// `unseen` in the window: a later deed's receipt witnesses it. The line moves on the client's own quest either way: the
// service pays, it does not gate.
import { QL_LINES, lineById, lineStepOf, lineOpens, opensWords, witnessOf, lineServiceOf, unmetNeeds } from './qlLines.js';
import { QL_SERVICE_LINES, qlStepClaimed } from '../../net/questlineClaims.js';
import { questlinesOn } from './qlLaw.js';
import { t } from '../textManager.js';
import { lootRarityOn } from '../loot/lootRarity.js';
import { getPref } from '../uiPrefs.js';
import { KINGS_GAMBIT_KEY } from '../features.js';
import { modSetting } from '../modSettings.js';
import { revenantHeld } from '../revenant/revenant.js';
import { starfallRuns } from '../../net/starfall/starfallLaw.js';   // STAR8: the Witches' Festival's stars falling

/** AUDIT QUESTLINES ACTS-2, LINES-3, LINES-6: WHAT A STEP'S DEED NEEDS, read where the game reads it - Loot rarity's own
 *  switch (a socket, a reforge refuse 'off' without it), The King's Gambit's (no table offers the game), the sea's
 *  (scenes/world.js navalOn: the Naval Combat row and Come Sail Away's own switch), and the Renown a revenant comes at
 *  (revenant.js revenantHeld - online, below it none rises). STAR8: and the Starfall - the Witches' Festival's own calendar
 *  (net/festivalLaw.js, through starfallLaw.js starfallRuns) at `nowMs`, the runner's clock, exactly as the starfall host
 *  and the relay read it. A step that needs what is
 *  off waits, saying so. */
export const NEED_CHECKS = Object.freeze({
  lootRarity: () => lootRarityOn(),
  kingsGambit: () => !!getPref(KINGS_GAMBIT_KEY),
  naval: () => getPref('naval') !== false && (() => { try { return modSetting('come-sail-away', 'Enabled') !== false; } catch { return false; } })(),
  renown: () => !revenantHeld(),
  starfall: (/** @type {number} */ nowMs) => starfallRuns(nowMs),
});

/** The game seconds a line waits between one step's end and the next step's start - an hour of the character's time,
 *  so the next letter does not arrive in the same breath as the last reward. */
export const STEP_GAP_S = 3600;
/** A later step that ended badly is offered again a day of the character's time later (a first step goes back on
 *  offer - QL-OFFERED). */
export const RETRY_GAP_S = 24 * 3600;
/** A claim the service could not answer is asked again this many real milliseconds later, CLAIM_TRIES times, and then
 *  every CLAIM_SLOW_MS while the page lives. */
export const CLAIM_RETRY_MS = 60_000;
export const CLAIM_TRIES = 5;
export const CLAIM_SLOW_MS = 600_000;

/** A line's record, fresh - `begun` the character's second it was taken; `lettered` the second one of its steps' letters
 *  reached the player (FB1020c LETTER-PACE: the take's own, then each courier's), 0 before any; `aside` its running step's quest set aside by the runner
 *  itself for a need that stopped holding (AUDIT STAR8 S2); `taken` the player's (QL-OFFERED: a record without it is a
 *  save's from before, read once at its load). */
const freshLine = (begun = 0) => ({ step: 0, outcomes: {}, done: false, wait: 0, claims: {}, begun, lettered: 0, aside: false, taken: true });

/** FB1020c LETTER-PACE: whether a step's quest still holds its letter back - running, not set aside (QUEST-SHELF), with a
 *  `give pc <letter> notify` not yet done. GivePc waits for a town, outdoors, by day (GivePc.cs:78-97, quest/actions.js
 *  GivePc), so every letter whose courier ran while the player was elsewhere lands at once, 40 to 500 ticks apart.
 *  QL-OFFERED: a first step's letter is in hand at the take (its start-up's `get item`), so only a later step's courier
 *  is ever read here - and only once it is SENT: its task fired (GivePc holding the letter for a town by day) or its
 *  clock running (the courier on the road). A later step sends its courier where its story does - QLBD03's once the
 *  rite is broken, QLIW02's once a revenant kneels - where every first step's had set out at its start-up, so read
 *  unsent it held every other line's next step for as long as its deed waited. */
export function letterOnItsWay(quest) {
  if (!quest || quest.questComplete || quest.shelvedAt != null) return false;
  for (const task of quest.tasks?.values?.() ?? []) {
    const clock = quest.getClock?.(task.symbol);
    if (!task.triggered && !(clock?.clockEnabled && !clock.clockFinished)) continue;   // not sent yet
    if (task.actions?.some((a) => courierGive(quest, a))) return true;
  }
  return false;
}

/** A courier's letter not yet handed over: a `give pc <Item ... letter> notify` still to do. */
const courierGive = (quest, a) => a.typeName === 'GivePc' && a.textId && !a.isComplete && quest.getItem?.(a.itemSymbol)?.itemName === 'letter';
/** Whether a quest's script has a courier's letter still to hand over, sent or not. */
const hasCourier = (quest) => [...(quest?.tasks?.values?.() ?? [])].some((t) => t.actions?.some((a) => courierGive(quest, a)));

/**
 * @param {{ machine: any, ctx?: any, service?: any, nowMs?: () => number }} deps
 *   `ctx` - level(), online(), nowSeconds() (the character's clock), onHonour({ line, title, key, keys }) (a title or key
 *   the service paid - `keys` the account's Weir Keys after it), outcomeText(quest) (the step's outcome in the player's
 *   words, filed with the step);
 *   `service` - the account service's door (scenes/quest/questlineHost.js): `claim({ line, step, phase, choice })`
 *   answering `{ ok, data: { opened?, witnessed?, title?, key?, keys?, why? } }`, never a throw; null offline
 */
export function createLineRunner({ machine, ctx = {}, service = null, nowMs = () => Date.now() }) {
  /** id -> the line's record */
  let lines = {};
  /** The claims still to ask: `[{ line, step, choice, phase: 'open'|'end', next, tries }]`. Not saved: the records'
   *  `claims` say what was answered, and a page's start asks again what was not. */
  let pending = [];

  /** AUDIT QUESTLINES LINES-21: a load's count - a claim answered after a load belongs to the records before it. */
  let generation = 0;

  const level = () => ctx.level?.() ?? 1;
  const online = () => !!service && !!ctx.online?.();
  const now = () => ctx.nowSeconds?.() ?? 0;
  /** A registered account signed in: never a guest's (AUDIT QUESTLINES LINES-2). */
  const registered = () => !!service && !service.guest?.();
  const need = (n) => { try { return !!NEED_CHECKS[n]?.(nowMs()); } catch { return false; } };
  const probe = { level, online, registered, need, lineDone: (id) => !!lines[id]?.done };

  /** The step's quest on the machine (by name) - running, or scheduled for the next tick - or null. */
  const runningStep = (questName) => {
    for (const q of machine.quests.values()) {
      if (q.questName === questName && !q.questComplete && !q.questTombstoned) return q;
    }
    return machine.questsToInvoke?.find?.((q) => q.questName === questName) ?? null;
  };

  /** A claim to ask: the `open` of every step of a line the service pays (its first is the witness's window - AUDIT
   *  QUESTLINES SERVICE-2), the `end` of a step it pays. */
  function queueClaim(lineId, step, phase, choice = null) {
    if (!service || !(phase === 'open' ? Object.hasOwn(QL_SERVICE_LINES, lineId) : qlStepClaimed(lineId, step))) return null;
    if (pending.some((c) => c.line === lineId && c.step === step && c.phase === phase)) return null;
    const c = { line: lineId, step, choice, phase, next: 0, tries: 0 };
    pending.push(c);
    return c;
  }

  async function ask(c) {
    const gen = generation;
    let a;
    try { a = await service.claim({ line: c.line, step: c.step, phase: c.phase, ...(c.choice ? { choice: c.choice } : {}) }); } catch { a = { ok: false, error: 'offline' }; }
    if (gen !== generation) return;   // LINES-21: a load came between - another character's records now, its own claims asked
    const rec = lines[c.line];
    if (!rec) return;
    const d = a?.ok ? a.data ?? {} : null;
    // answered for good: an open written, an end witnessed, or a step the service pays nothing - and the pay told once.
    // A guest's end, and an end not witnessed yet, are kept and asked again (a guest may register; a later deed's receipt
    // witnesses the step)
    const answered = !!d && (d.why === 'unpaid' || (c.phase === 'open' ? !!d.opened : d.witnessed === true));
    if (answered) {
      pending = pending.filter((x) => x !== c);
      rec.claims[c.step] = d.why === 'unpaid' ? 'refused:unpaid' : c.phase === 'open' ? (rec.claims[c.step] ?? 'opened') : 'witnessed';
      // AUDIT QUESTLINES SERVICE-7 (c): a title the service answers HELD (`titleHeld` - laid by an earlier attempt) is told
      // only for a claim an earlier attempt of which went unanswered: its answer may have carried the title, lost after the
      // commit. An answer that arrived told it then, or another character's line laid it
      const title = d.title ?? (c.lost ? d.titleHeld ?? null : null);
      if (title || d.key || d.keyHeld) ctx.onHonour?.({ line: c.line, title, key: !!d.key, keys: Number.isSafeInteger(d.keys) ? d.keys : null, keyHeld: !!d.keyHeld });
      return;
    }
    // SERVICE-7 (c): no service's answer (offline, a timeout, a 5xx, a body that never came) - it may have committed
    if (!d && !(a?.status >= 400 && a?.status < 500)) c.lost = true;
    if (d && c.phase === 'end') rec.claims[c.step] = d.why === 'guest' ? 'refused:guest' : 'unseen';
    // AUDIT QUESTLINES UI-19: a claim the service REFUSED - its switch shut (`ql-closed`), a claim its law refuses
    // (`ql-body`) - is the step's to say (rows: `refused`), never swallowed; kept on the claim (unsaved), asked again all the
    // same (a shut switch opens), and gone with the claim once answered
    c.refused = !a?.ok && (a?.error === 'ql-closed' || a?.error === 'ql-body') ? a.error : null;
    c.tries++;
    c.next = nowMs() + (c.tries < CLAIM_TRIES ? CLAIM_RETRY_MS : CLAIM_SLOW_MS);
  }

  /**
   * AUDIT STAR8 S2: A RUNNING STEP OUT OF SEASON IS SET ASIDE, FAIL-FREE. A step's needs are read as it starts (startStep),
   * and the Witches' Festival can end under a star step begun inside it: its own clock would run out on a deed no star
   * is left to do. Its quest is set aside as the journal's Abandon sets one aside (machine.js shelveQuest: its clocks
   * stopped, its items kept, no act heard) and the record says the runner did it (`aside`); the need holding again, it is
   * reclaimed (reclaimQuest: its clocks moved on by the time away) and goes on where it stood. Its row waits, saying for
   * what (rows, waitingWords). A quest the player set aside is the player's: never reclaimed here.
   */
  function keepSeason(l, rec, q) {
    if (unmetNeeds(l, rec.step, probe).length) {
      if (q.shelvedAt == null && machine.shelveQuest?.(q.uid)?.ok) rec.aside = true;
      return;
    }
    if (!rec.aside || (q.shelvedAt != null && !machine.reclaimQuest?.(q.uid)?.ok)) return;
    rec.aside = false;
  }

  function startStep(l, rec) {
    const step = l.steps[rec.step];
    if (!step) return;
    // LINES-18: a step's quest already running (a copy kept from before) is the step - its opening asked all the same
    // QL-OFFERED: a first step never reaches here without its quest - look puts its line back on offer first - so what
    // starts here is a later step of a line the player took
    if (runningStep(step.quest)) { if (!rec.claims[rec.step]) queueClaim(l.id, rec.step, 'open'); return; }
    if (unmetNeeds(l, rec.step, probe).length) return;   // ACTS-2, LINES-3, LINES-6: it waits, and the window says on what
    if (!courierMay(now())) return;   // FB1020c LETTER-PACE, re-aimed: a later step's courier waits for the last one
    const q = machine.scheduleQuestByName(step.quest);
    // a script that will not parse (the machine has said why - a place this region lacks) is tried again a day later,
    // never every tick, and the window says it could not begin (LINES-19)
    if (!q) { rec.wait = now() + RETRY_GAP_S; rec.stalled = true; return; }
    rec.stalled = false;
    rec.retry = false;
    queueClaim(l.id, rec.step, 'open');
  }

  /** What a begun line waits on, in words (the window's "Opens ..." line), or null: offline or a guest's page for a line
   *  the service pays, a step's need (ACTS-2, LINES-3, LINES-6), a step that could not begin here (LINES-19). */
  function waitingWords(l, rec) {
    if (rec.done) return null;
    const o = l.opens;
    // UI-7: a line begun continues where it can - never "Opens" again
    if (o.online && !online()) return t('ql.line.continuesOnline', 'Continues online.');
    if (o.account && !registered()) return t('ql.line.continuesAccount', 'Continues with a registered account.');
    if (unmetNeeds(l, rec.step, probe).length) return opensWords({ ...l, opens: {} }, probe, rec.step);
    return rec.stalled ? t('ql.line.stalled', 'Its next step could not begin here: it will be offered again.') : null;
  }

  /** FB1020c LETTER-PACE, re-aimed by QL-OFFERED: a later step's courier may set out when no letter of any line reached
   *  the player within STEP_GAP_S and no begun line's letter is still on its way - GivePc holds a letter until a town by
   *  day, so the letters of every step begun at night, indoors or in the wild landed together. LINES-17 paced the lines'
   *  STARTS; a line begins on the player's word now (takeLine), and only the couriers of the steps after it are paced.
   *  A step set out this look and not yet started (the machine's next tick runs its start-up) holds the rest while its
   *  script has a courier: whether that courier set out is its start-up's to say, and two set out in one breath landed
   *  together. */
  const courierMay = (s) => Object.entries(lines).every(([id, r]) => {
    if (r.lettered > 0 && r.lettered > s - STEP_GAP_S) return false;   // 0: no letter yet, on any clock
    const q = r.done ? null : runningStep(lineById(id)?.steps[r.step]?.quest ?? '');
    return !letterOnItsWay(q) && !(q && machine.questsToInvoke?.includes?.(q) && hasCourier(q));
  });

  /** QL-OFFERED: a line back on offer - its record gone, and with it the claims still to ask for it (the service's
   *  opening is written once whatever is asked again: server-account/src/questlines.js INSERT OR IGNORE). */
  const reoffer = (id) => { delete lines[id]; pending = pending.filter((c) => c.line !== id); };

  /** QL-OFFERED (restore): a save's first step SENT and never delivered - begun by QL0's runner, unasked, its quest
   *  (running, set aside or scheduled) still with nothing in its journal: every first step writes its first entry as its
   *  letter comes (the courier's `give pc <letter> notify`, the Wyrd Sister's or the raven's `get item`). It is let go, as
   *  the retired tutorial is (machine.js removeQuest: tombstoned, nothing filed - it had written nothing); answers
   *  whether there was one. */
  const undelivered = (q) => !q.questComplete && !q.questTombstoned && !(q.getLogMessages?.()?.length > 0);
  const sentUndelivered = (questName) => {
    let found = false;
    for (const q of [...machine.quests.values()]) {
      if (q.questName !== questName || !undelivered(q)) continue;
      found = true;
      machine.removeQuest?.(q);
    }
    const held = machine.questsToInvoke ?? [];
    for (let i = held.length - 1; i >= 0; i--) if (held[i]?.questName === questName && undelivered(held[i])) { held.splice(i, 1); found = true; }
    return found;
  };

  /** QL-OFFERED: a begun line's first step set aside in the journal by the player (QUEST-SHELF; never the runner's own
   *  out-of-season `aside`) - its line is on offer again, and taking it takes the step back. */
  const firstShelved = (l, rec) => {
    if (!rec || rec.done || rec.step !== 0 || rec.aside) return null;
    const q = runningStep(l.steps[0].quest);
    return q?.shelvedAt != null ? q : null;
  };

  const runner = {
    /** Each tick after the machine's: start each begun line's later step that is due, put back on offer a first step
     *  gone, ask the service what is owed. A line not begun is never begun here (QL-OFFERED: takeLine). The switch off,
     *  no line moves (its quests would not be stamped). */
    look() {
      if (!questlinesOn()) return;
      const s = now();
      for (const l of QL_LINES) {
        const rec = lines[l.id];
        if (!rec) continue;
        // QUEST-AUDIT III RESTART-WORDS: a step dropped by the journal's Restart runs again at once (machine.js restartQuest
        // drops the old copy, then starts the new) - the drop's day of waiting and its "could not begin" are let go
        if (rec.stalled && !rec.done && runningStep(l.steps[rec.step]?.quest)) { rec.stalled = false; rec.wait = 0; }
        // QL-OFFERED: a first step with no quest (gone without its end, or a save's line whose first step never began) is
        // its line back on offer - never started again unasked
        if (!rec.done && rec.step === 0 && !runningStep(l.steps[0].quest)) { reoffer(l.id); continue; }
        if (rec.done || rec.wait > s) continue;
        const stepQuest = runningStep(l.steps[rec.step]?.quest);
        if (stepQuest) keepSeason(l, rec, stepQuest);   // AUDIT STAR8 S2: online or not
        if (l.opens.online && !online()) continue;   // an endgame line waits, offline, where it stood
        if (l.opens.account && !registered()) continue;   // LINES-2: and a guest's page, where it stood
        startStep(l, rec);
      }
      const ms = nowMs();
      for (const c of pending) if (c.next <= ms && !c.busy) { c.busy = true; ask(c).finally(() => { c.busy = false; }); }
    },

    /**
     * The layer's ending (a quest's `end quest`): if the quest is a line's step, the line moves - on to the next step
     * for an outcome that is no failure, the same step again a day later for one that is; QL-OFFERED: a first step that
     * fails puts its line back on offer, never sends it again (`reoffered`). `outcome` is the settled one (the sheet's),
     * or null.
     */
    ended(quest, outcome) {
      const at = lineStepOf(quest?.questName);
      if (!at) return null;
      const rec = lines[at.line.id];
      if (!rec || rec.done || rec.step !== at.index) return null;
      const good = outcome ? !outcome.failure : !!quest.questSuccess;
      rec.stalled = false;   // QUEST-AUDIT III RESTART-WORDS: a step that ended began - a restart's drop is not a stall
      if (!good && at.index === 0) { reoffer(at.line.id); return { line: at.line.id, step: 0, moved: false, reoffered: true }; }
      // AUDIT QUESTLINES UI-7: a failed step is the window's to say ("offered again"), not a quiet wait
      if (!good) { rec.wait = now() + RETRY_GAP_S; rec.retry = true; return { line: at.line.id, step: at.index, moved: false }; }
      rec.retry = false;
      rec.outcomes[at.index] = { id: outcome?.id ?? 'done', text: ctx.outcomeText?.(quest) ?? null };
      queueClaim(at.line.id, at.index, 'end', outcome?.id ?? null);
      rec.step++;
      rec.wait = now() + STEP_GAP_S;
      if (rec.step >= at.line.steps.length) rec.done = true;
      return { line: at.line.id, step: at.index, moved: true, done: rec.done };
    },

    /**
     * AUDIT QUESTLINES LINES-7: a quest gone without its end (an error terminated it - the machine removes it, `end quest`
     * never ran): a line's step that was is offered again a day later, never parsed again every tick. QL-OFFERED: a first
     * step's line goes back on offer at the next look - unless the journal's Restart started the step again meanwhile.
     */
    dropped(quest) {
      const at = lineStepOf(quest?.questName);
      const rec = at ? lines[at.line.id] : null;
      if (!rec || rec.done || rec.step !== at.index || quest.questComplete || rec.wait > now()) return;   // ended() has it
      rec.wait = now() + RETRY_GAP_S;
      rec.stalled = true;
    },

    /**
     * QL-OFFERED: THE PLAYER TAKES A LINE - at a notice board, a giver's door or the Quests tab. A line on offer (its
     * gate holds, not begun) begins: its first step's quest starts now - the very quest the offer was read from when one
     * is handed (`quest`, parsed by offerQuest: the letter read is the letter taken), else scheduled by name. A line whose
     * first step the player set aside takes that step back (machine.js reclaimQuest). Answers `{ ok, line, reason? }`:
     * `off` the switch, `unknown`, `begun`, `closed` (its gate), `noplace` (its first step will not parse here - a place
     * this region lacks: nothing is begun, and it stays on offer).
     */
    takeLine(id, { quest = null } = {}) {
      if (!questlinesOn()) return { ok: false, line: id, reason: 'off' };
      const l = lineById(id);
      if (!l) return { ok: false, line: id, reason: 'unknown' };
      const rec = lines[id];
      const shelved = firstShelved(l, rec);
      if (shelved) {
        const r = machine.reclaimQuest?.(shelved.uid);
        return r?.ok ? { ok: true, line: id, reclaimed: true } : { ok: false, line: id, reason: r?.reason ?? 'begun' };
      }
      if (rec) return { ok: false, line: id, reason: 'begun' };
      if (!lineOpens(l, probe)) return { ok: false, line: id, reason: 'closed' };
      const first = l.steps[0].quest;
      // LINES-18: a copy of the first step already running (a party's shared copy) is the step - adopted, never a second
      // started beside it; one set aside comes back with the take
      const copy = runningStep(first);
      if (copy?.shelvedAt != null && !machine.reclaimQuest?.(copy.uid)?.ok) return { ok: false, line: id, reason: 'begun' };
      const read = !copy && quest && String(quest.questName).toUpperCase() === first && !quest.questComplete ? quest : null;
      let q = copy;
      if (read) {
        try { q = machine.startQuestImmediate(read); } catch (e) { console.warn(`[questlines] ${first} could not start (${e?.message ?? e})`); q = null; }
      } else if (!q) q = machine.scheduleQuestByName(first);
      if (!q) return { ok: false, line: id, reason: 'noplace' };
      // FB1020c LETTER-PACE: the take is a letter's moment - the letter is in hand (its start-up's `get item`), and no
      // later step's courier lands in the same breath
      const s = Math.max(1, now());
      lines[id] = { ...freshLine(s), lettered: s };
      queueClaim(id, 0, 'open');
      return { ok: true, line: id };
    },

    /** QL-OFFERED: the first step of a line on offer, PARSED and not started (machine.js parseQuestForLists - its places
     *  and people drawn as a questor's offer draws them), so its letter can be read before it is taken; null for a line
     *  not on offer or a step that will not parse here. DaggerfallQuestOfferWindow's GetQuest, for a line. */
    offerQuest(id) {
      const l = lineById(id);
      if (!l || !questlinesOn() || lines[id] || !lineOpens(l, probe)) return null;
      const source = machine.deps?.getQuestSourceLines?.(l.steps[0].quest);
      return source ? machine.parseQuestForLists?.(source, 0) ?? null : null;
    },

    /** QL-OFFERED: whether the line is on offer now - its gate holds and it is not begun, or its first step was set aside
     *  in the journal. */
    onOffer(id) {
      const l = lineById(id);
      return !!l && questlinesOn() && (lines[id] ? !!firstShelved(l, lines[id]) : lineOpens(l, probe));
    },

    /** QL-OFFERED: the first step the player set aside, when its line is on offer again for it - the quest a take
     *  reclaims (an offer reads its letter, not a new draw's). */
    shelvedFirst: (id) => { const l = lineById(id); return l ? firstShelved(l, lines[id]) : null; },

    /**
     * The window's rows: every line begun or on offer - `{ id, group, title, lead, giver, state, steps, opens, outcome,
     * honour, post }` (`honour` the title the line pays, or null; `post` where else a line not begun is offered -
     * qlLines.js LinePost, the notice board only while online, where the board is the port's own - or null).
     * `state` 'done' | 'running' | 'waiting' (between steps, offline for an endgame line, or - AUDIT STAR8 S2 - its step
     * set aside by the runner until its need holds again) | 'retry' (a later step failed,
     * offered again) | 'shelved' (a later step's quest set aside in the journal) | 'offered' (QL-OFFERED: on offer, its
     * Take up the player's - not begun, or its first step set aside); each step `{ title, state:
     * 'done'|'current'|'next', witnessed: bool (a step the service witnesses), seen: bool (it did), unseen: bool (done,
     * not yet witnessed), outcome, refused: the service's refusal of its claim (UI-19), or null }` - the steps after the current one are named
     * (a line is a story the player can see the shape of), their quests not yet given.
     */
    rows() {
      // QL-OFFERED (UI-Calm's law, a page with nothing to take is never drawn): a line not begun is drawn only while it is
      // on offer - its gate holding (online, the account, the level, the line before, its season, its first step's needs);
      // a locked line is no row. AUDIT QUESTLINES UI-14: one begun shows offline, "Continues online"
      return QL_LINES.filter((l) => lines[l.id] || lineOpens(l, probe)).map((l) => {
        const rec = lines[l.id];
        const stepQuest = rec && !rec.done ? runningStep(l.steps[rec.step]?.quest) : null;
        const shelved = stepQuest?.shelvedAt != null;
        const running = !!stepQuest && !shelved;
        const aside = shelved && !!rec?.aside;   // AUDIT STAR8 S2: set aside by the runner, out of season - it waits
        const offered = !rec || !!firstShelved(l, rec);   // QL-OFFERED
        const steps = l.steps.map((s, i) => {
          // UI-7: the step at the line's place is `current` only while its quest runs - between steps it is still to come
          const state = offered ? 'next' : rec.done || i < rec.step ? 'done' : i === rec.step && (running || shelved) ? 'current' : 'next';
          // `seen` the service witnessed it; `unseen` done, and not witnessed yet (a later deed's receipt witnesses it)
          const said = rec?.claims?.[i];
          // UI-19: `refused` the service's refusal of this step's claim (its error word), while the claim waits
          const refused = pending.find((c) => c.line === l.id && c.step === i && c.refused)?.refused ?? null;
          return { quest: s.quest, title: s.title(), state, witnessed: !!witnessOf(l, i), seen: said === 'witnessed', unseen: state === 'done' && !!witnessOf(l, i) && said !== 'witnessed', outcome: rec?.outcomes?.[i]?.text ?? null, refused };
        });
        // UI-7: a failed step offered again (`retry`), a step's quest set aside in the journal (`shelved`)
        const state = offered ? 'offered' : rec.done ? 'done' : running ? 'running' : shelved && !aside ? 'shelved' : rec.retry ? 'retry' : 'waiting';
        const last = rec?.outcomes?.[l.steps.length - 1] ?? null;
        return {
          id: l.id, group: l.group, title: l.title(), lead: l.lead(), giver: l.giver(), state, steps,
          opens: state === 'waiting' || state === 'retry' ? waitingWords(l, rec) : null,
          outcome: rec?.done ? last?.text ?? null : null,
          honour: lineServiceOf(l)?.title ?? null,
          post: !rec && (l.post !== 'board' || online()) ? l.post ?? null : null,   // a first step set aside is the journal's to take back
        };
      });
    },

    /** FB1020c LETTER-PACE: the layer's letter arm (qlLayer.js reward - GivePc's moment): a line's step handed the player
     *  its letter, and the next line waits STEP_GAP_S from it. */
    lettered(quest) {
      const at = lineStepOf(quest?.questName);
      const rec = at ? lines[at.line.id] : null;
      if (rec && !rec.done && rec.step === at.index) rec.lettered = Math.max(1, now());
    },

    /** The record of a line, for the pins. */
    lineState: (id) => (lines[id] ? structuredClone(lines[id]) : null),

    snapshot: () => structuredClone(lines),
    /** A load: the records back, and every claim the service has not answered asked again (an open never written, an
     *  end never witnessed). QL-OFFERED: a save keeps every line it had begun, where it stood - except a line SENT and
     *  never delivered: its first step's courier letter still held (a save from before QL-OFFERED), its quest is let go
     *  (machine.js removeQuest - nothing filed, it had written nothing) and the line is on offer again. A first step
     *  whose letter came stays the player's; a first step with no quest at all goes back on offer at the next look. */
    restore(data) {
      lines = {};
      pending = [];
      generation++;
      if (!data || typeof data !== 'object') return;
      for (const [id, r] of Object.entries(data)) {
        const l = lineById(id);
        if (!l || !r || typeof r !== 'object') continue;
        if (!r.taken && !r.done && (r.step ?? 0) === 0 && sentUndelivered(l.steps[0].quest)) continue;
        const step = Math.max(0, Math.min(l.steps.length, Number.isSafeInteger(r.step) ? r.step : 0));
        lines[id] = {
          step, done: !!r.done || step >= l.steps.length, wait: Number.isFinite(r.wait) ? r.wait : 0,
          begun: Number.isFinite(r.begun) ? r.begun : 0, lettered: Number.isFinite(r.lettered) ? r.lettered : 0, stalled: !!r.stalled, retry: !!r.retry, aside: !!r.aside,
          taken: true,   // QL-OFFERED: a line kept by a load is the player's - taken, or QL0's delivered
          outcomes: r.outcomes && typeof r.outcomes === 'object' ? structuredClone(r.outcomes) : {},
          claims: r.claims && typeof r.claims === 'object' ? { ...r.claims } : {},
        };
        const rec = lines[id];
        for (let i = 0; i <= Math.min(rec.step, l.steps.length - 1); i++) {
          const ended = i < rec.step;
          const said = rec.claims[i];
          // SERVICE-7 (c): an end the save never heard answered (nothing said, or only its opening) may have been answered
          // and lost - its held title is told when its retry answers it
          if (ended && said !== 'witnessed' && said !== 'refused:unpaid') { const c = queueClaim(id, i, 'end', rec.outcomes[i]?.id ?? null); if (c && (said == null || said === 'opened')) c.lost = true; }
          else if (!ended && !rec.done && !said) queueClaim(id, i, 'open');
        }
      }
    },
  };
  return runner;
}
