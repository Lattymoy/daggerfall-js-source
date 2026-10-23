// @ts-check
// QL12-QL16 (bible/06-Systems/Questlines-Arc.md section 4): THE LINES, RUN - made by the layer (qlLayer.js) over the
// machine. A line (qlLines.js) opens when its gate holds; its first step's quest starts; a step that ends well starts
// the next, a step that ends badly is offered again a day later; the last step's outcome is the line's. It never
// decides a quest: each step is a script on the machine like any other, its objectives a sheet like any other's.
//
// WHAT IT KEEPS (the layer's save, beside the rewards waiting): each line begun - the step it stands at, the outcome
// each step ended on, whether it is done, when its next step may start, and when its last letter came (FB1020c
// LETTER-PACE: the next line's hour counts from it). A step's quest is found by NAME on the
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
import { QL_LINES, lineById, lineStepOf, lineOpens, opensWords, witnessOf, lineServiceOf, unmetNeeds, eventHolds } from './qlLines.js';
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
/** A step that ended badly is offered again a day of the character's time later. */
export const RETRY_GAP_S = 24 * 3600;
/** A claim the service could not answer is asked again this many real milliseconds later, CLAIM_TRIES times, and then
 *  every CLAIM_SLOW_MS while the page lives. */
export const CLAIM_RETRY_MS = 60_000;
export const CLAIM_TRIES = 5;
export const CLAIM_SLOW_MS = 600_000;

/** A line's record, fresh - `begun` the character's second it began (AUDIT QUESTLINES LINES-17: one new line an hour);
 *  `lettered` the second one of its steps' letters reached the player (FB1020c LETTER-PACE), 0 before any; `aside` its
 *  running step's quest set aside by the runner itself for a need that stopped holding (AUDIT STAR8 S2). */
const freshLine = (begun = 0) => ({ step: 0, outcomes: {}, done: false, wait: 0, claims: {}, begun, lettered: 0, aside: false });

/** FB1020c LETTER-PACE: whether a step's quest still holds its letter back - running, not set aside (QUEST-SHELF), with a
 *  `give pc <letter> notify` not yet done. GivePc waits for a town, outdoors, by day (GivePc.cs:78-97, quest/actions.js
 *  GivePc), so every letter whose courier ran while the player was elsewhere lands at once, 40 to 500 ticks apart. */
export function letterOnItsWay(quest) {
  if (!quest || quest.questComplete || quest.shelvedAt != null) return false;
  for (const task of quest.tasks?.values?.() ?? []) {
    for (const a of task?.actions ?? []) {
      if (a.typeName === 'GivePc' && a.textId && !a.isComplete && quest.getItem?.(a.itemSymbol)?.itemName === 'letter') return true;
    }
  }
  return false;
}

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
    if (runningStep(step.quest)) { if (!rec.claims[rec.step]) queueClaim(l.id, rec.step, 'open'); return; }
    if (unmetNeeds(l, rec.step, probe).length) return;   // ACTS-2, LINES-3, LINES-6: it waits, and the window says on what
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

  /** LINES-17: a line may begin when no other began within STEP_GAP_S - a character's first page with a dozen lines open
   *  gets their letters an hour apart, never in one breath. FB1020c LETTER-PACE: and when no letter of a line reached the
   *  player within it, and no begun line's first letter is still on its way - the pace was the starts', and the letters
   *  of every line begun at night, indoors or in the wild landed together at the next town by day. */
  const mayBegin = (s) => Object.entries(lines).every(([id, r]) => !(r.begun > s - STEP_GAP_S) && !(r.lettered > s - STEP_GAP_S)
    && !(r.step === 0 && !r.done && letterOnItsWay(runningStep(lineById(id)?.steps[0]?.quest ?? ''))));

  const runner = {
    /** Each tick after the machine's: open what may open, start each line's step that is due, ask the service what is
     *  owed. The switch off, no line moves (its quests would not be stamped). */
    look() {
      if (!questlinesOn()) return;
      const s = now();
      for (const l of QL_LINES) {
        let rec = lines[l.id];
        if (!rec) {
          if (!lineOpens(l, probe) || !mayBegin(s)) continue;
          rec = lines[l.id] = freshLine(Math.max(1, s));
        }
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
     * for an outcome that is no failure, the same step again a day later for one that is. `outcome` is the settled one
     * (the sheet's), or null.
     */
    ended(quest, outcome) {
      const at = lineStepOf(quest?.questName);
      if (!at) return null;
      const rec = lines[at.line.id];
      if (!rec || rec.done || rec.step !== at.index) return null;
      const good = outcome ? !outcome.failure : !!quest.questSuccess;
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
     * never ran): a line's step that was is offered again a day later, never parsed again every tick.
     */
    dropped(quest) {
      const at = lineStepOf(quest?.questName);
      const rec = at ? lines[at.line.id] : null;
      if (!rec || rec.done || rec.step !== at.index || quest.questComplete || rec.wait > now()) return;   // ended() has it
      rec.wait = now() + RETRY_GAP_S;
      rec.stalled = true;
    },

    /**
     * The window's rows: every line, begun or not - `{ id, group, title, lead, giver, state, steps, opens, outcome, honour }`
     * (`honour` the title the line pays, or null).
     * `state` 'done' | 'running' | 'waiting' (between steps, offline for an endgame line, or - AUDIT STAR8 S2 - its step
     * set aside by the runner until its need holds again) | 'retry' (a step failed,
     * offered again) | 'shelved' (its step's quest set aside in the journal) | 'locked'; each step `{ title, state:
     * 'done'|'current'|'next', witnessed: bool (a step the service witnesses), seen: bool (it did), unseen: bool (done,
     * not yet witnessed), outcome, refused: the service's refusal of its claim (UI-19), or null }` - the steps after the current one are named
     * (a line is a story the player can see the shape of), their quests not yet given.
     */
    rows() {
      // AUDIT QUESTLINES UI-14 (decision 1): offline, a line that can only begin online is not drawn - one begun shows,
      // "Continues online". STAR8 (UI-Calm's law): nor a seasonal line not begun outside its event - one begun shows, and
      // says what it waits for
      return QL_LINES.filter((l) => lines[l.id] || ((!l.opens.online || online()) && eventHolds(l, probe))).map((l) => {
        const rec = lines[l.id];
        const stepQuest = rec && !rec.done ? runningStep(l.steps[rec.step]?.quest) : null;
        const shelved = stepQuest?.shelvedAt != null;
        const running = !!stepQuest && !shelved;
        const aside = shelved && !!rec?.aside;   // AUDIT STAR8 S2: set aside by the runner, out of season - it waits
        const steps = l.steps.map((s, i) => {
          // UI-7: the step at the line's place is `current` only while its quest runs - between steps it is still to come
          const state = !rec ? 'next' : rec.done || i < rec.step ? 'done' : i === rec.step && (running || shelved) ? 'current' : 'next';
          // `seen` the service witnessed it; `unseen` done, and not witnessed yet (a later deed's receipt witnesses it)
          const said = rec?.claims?.[i];
          // UI-19: `refused` the service's refusal of this step's claim (its error word), while the claim waits
          const refused = pending.find((c) => c.line === l.id && c.step === i && c.refused)?.refused ?? null;
          return { quest: s.quest, title: s.title(), state, witnessed: !!witnessOf(l, i), seen: said === 'witnessed', unseen: state === 'done' && !!witnessOf(l, i) && said !== 'witnessed', outcome: rec?.outcomes?.[i]?.text ?? null, refused };
        });
        // UI-7: a failed step offered again (`retry`), a step's quest set aside in the journal (`shelved`)
        const state = !rec ? 'locked' : rec.done ? 'done' : running ? 'running' : shelved && !aside ? 'shelved' : rec.retry ? 'retry' : 'waiting';
        const last = rec?.outcomes?.[l.steps.length - 1] ?? null;
        return {
          id: l.id, group: l.group, title: l.title(), lead: l.lead(), giver: l.giver(), state, steps,
          opens: !rec ? opensWords(l, probe) : state === 'waiting' || state === 'retry' ? waitingWords(l, rec) : null,
          outcome: rec?.done ? last?.text ?? null : null,
          honour: lineServiceOf(l)?.title ?? null,
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
     *  end never witnessed). */
    restore(data) {
      lines = {};
      pending = [];
      generation++;
      if (!data || typeof data !== 'object') return;
      for (const [id, r] of Object.entries(data)) {
        const l = lineById(id);
        if (!l || !r || typeof r !== 'object') continue;
        const step = Math.max(0, Math.min(l.steps.length, Number.isSafeInteger(r.step) ? r.step : 0));
        lines[id] = {
          step, done: !!r.done || step >= l.steps.length, wait: Number.isFinite(r.wait) ? r.wait : 0,
          begun: Number.isFinite(r.begun) ? r.begun : 0, lettered: Number.isFinite(r.lettered) ? r.lettered : 0, stalled: !!r.stalled, retry: !!r.retry, aside: !!r.aside,
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
