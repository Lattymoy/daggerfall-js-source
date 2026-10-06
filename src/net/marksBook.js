// @ts-check
// ═══════════════════════════════════════════════════════════════════
// MARKS1 (2026-09-28) — THIS DEVICE'S MARKS: the balance as the account
// service last said it, the Bank's sale carried to its end, and a guild's
// Marks moved. The service keeps every Mark (server-account/src/marks.js);
// this is what a client may do with them, and the law is
// src/net/marksLaw.js.
//
// ASYNC NEVER DROPS. A sale burns Marks on the service and pays gold into
// the save; the two can part only if the answer is lost. So every act
// carries its own request id, and a sale whose answer did not come is
// KEPT (MARKS_PENDING_KEY) - asked again with the same id, which the
// service answers with the sale it already made (`repeat`), never a
// second one - until it settles, this session or the next the same
// character plays. The gold is paid then, into the account at the bank
// the sale was made at: a sale lost is never gold lost, and never gold
// twice.
//
// AUDIT 28 (M1, M2, M7, M8, M9). ONE ASK AT A TIME: a sale and its settle
// share one promise, so two bank visits while the answer is slow ask once
// and pay once (two settles in flight each paid the same sale). A KEPT SALE
// IS ITS ACCOUNT'S: it carries the account id and is asked again only
// under it - another account's session would have made a fresh sale from
// its own balance - and it is let go only on a refusal the service gives
// AFTER it looked for the sale's line (the service answers a line it
// finds before the switch): short, capped, a bad amount, its hour spent,
// an id another act took, the switch. No session, a session refused, a
// guest: the line may be there, so the sale waits. Each (account,
// character) keeps its own, so one waiting sale shuts no other's Bank. A
// guild move keeps its id until an answer comes, so a press after a lost
// answer is the same move, never a second.
//
// SILVER-FINDS (2026-10-05): A LOOT FIND - the device rolled it
// (systems/silverFinds.js), the service strikes what its own dice say
// under the day's count. Each find carries its own id too, asked again
// with it while the network or the service falters; one never answered
// is OWED - asked first, with the same id, by the next find the same
// account asks - so a lost answer is the line it made, never a second,
// and a find the asks never reached is not lost to a dropped line. A
// harvest's find rides the harvest's own answer (`findLine`).
// AUDIT 625 (S3, S4): an owed find is KEPT (MARKS_OWED_KEY), as a sale
// is - a reload asks it again - and stays owed through every answer that
// says nothing about it (the switch shut, a guest, no session or a
// refused one, the network); only a refusal of the find itself lets it
// go. And it is ITS ACCOUNT'S, as a kept sale is: the door sends it under
// that account's session or not at all.
//
// Pure - the door, the store and the ids are handed in - so the pins drive
// it without a network.
// ═══════════════════════════════════════════════════════════════════
import { MARKS_BANK, MARKS_COMBAT, MARKS_MOVE_MAX, marksAmountOk, marksText, exchangeGold, FIND_KINDS, utcDay, MARKS_RID_RE } from './marksLaw.js';
import { accountRefusalText } from './accountClient.js';
import { jittered } from './backoff.js';   // SCALE1: a press's asks spread out

/** The sales whose answers did not come, kept to be asked again - { [account|character]: sale }. */
export const MARKS_PENDING_KEY = 'marks1.pendingSale';
/** AUDIT 28 M2: the refusals the service gives only after it looked for the sale's line and found none - nothing was
 *  burnt, nothing is owed, and the kept sale may go (the switch among them: the service answers a line it finds before
 *  it asks the switch). Every other answer (the network, the service's fault, no session, a refused session, a guest)
 *  says nothing about the line, and the sale is kept. */
export const MARKS_FINAL = Object.freeze(['bad-marks', 'marks-short', 'marks-bank-cap', 'marks-rate', 'marks-rid', 'marks-closed']);
/** How many times one press asks before the sale is left to settle later. */
export const MARKS_TRIES = 3;
/** SCALE1: the waits between a press's asks (ms, jittered - net/backoff.js). They were asked back to back: a service
 *  that stumbled was asked three times in the same instant by every tab it failed. */
export const MARKS_RETRY_MS = Object.freeze([400, 1500]);
/** The answers a sale is asked again after (the service did not say no): the network, the service's own fault. */
const RETRY = Object.freeze(['offline', 'server']);
/** SILVER-FINDS: where a find was found, as its line says it - a loot find's kind (marksLaw.js FIND_KINDS), or a
 *  harvest's (`gather`). */
export const FIND_WORDS = Object.freeze({ corpse: 'on the body', pile: 'among the treasure', search: 'tucked in with the find', gather: 'while gathering' });
/** SILVER-FINDS: the finds a book keeps owed at most - asks never answered, asked again by the next find; past it a
 *  find is let go (the service's day bounds what they could strike: marksLaw.js MARKS_FAUCETS.find). */
export const FINDS_OWED_MAX = 20;
/** AUDIT 625 S3: the finds owed, KEPT beside the Bank's kept sale - `[{ rid, kind, account }]` - so a reload, or a tab
 *  closed before the next find, never loses one; read back under its own law (an id the service reads, a kind of
 *  FIND_KINDS, an account), FINDS_OWED_MAX at most. One device's list: a second tab's book writes over the first's. */
export const MARKS_OWED_KEY = 'marks1.owedFinds';
/** AUDIT 625 S3: the answers that say nothing struck and nothing refused for good - the network, the service's own
 *  fault, no session here (or another account's: S4), a session the service refused. A find answered so stays owed,
 *  and the rest wait owed unasked behind it. The switch shut and a guest (`marks-need-account`, `marks-closed`) keep
 *  theirs owed too, and read the book closed. */
const FIND_KEPT = Object.freeze(['offline', 'server', 'no-session', 'auth']);
const owedFind = (/** @type {any} */ f) => !!f && typeof f === 'object' && typeof f.rid === 'string' && MARKS_RID_RE.test(f.rid)
  && FIND_KINDS.includes(f.kind) && typeof f.account === 'string' && f.account.length > 0;

/** The words. */
export const MARKS_TEXT = Object.freeze({
  struck: (n, balance) => `${marksText(n)} struck to your account. You hold ${marksText(balance)}.`,
  // WB12a; WB13b: the record's own line says it is recorded; SILVER: the currency's name; SILVER-WAYS: the day's cap is
  // the gates' and the raids' together - SERPENT-SET: and the serpents'
  capped: `No silver for this breach. The counting-houses strike ${marksText(MARKS_COMBAT.perDay)} a day for breaches closed, towns defended and serpents slain.`,
  cappedRaid: `No silver for this town. The counting-houses strike ${marksText(MARKS_COMBAT.perDay)} a day for breaches closed, towns defended and serpents slain.`,
  cappedSerpent: `No silver for this serpent. The counting-houses strike ${marksText(MARKS_COMBAT.perDay)} a day for breaches closed, towns defended and serpents slain.`,
  /** SILVER-WAYS: a guild deed this claim completed - three of the guild's accounts on one raid or gate. */
  deed: (n, guild) => `A deed for ${guild?.name ?? 'your guild'}: three of its members stood together. ${marksText(n)} struck to its treasury.`,
  /** SILVER-WAYS: a guild contract's pay for a town defended. */
  contract: (pay, guild) => `${guild?.name ?? 'A guild'} pays you ${marksText(pay)} under its contract.`,
  sold: (marks, gold) => `The Bank buys ${marksText(marks)} for ${gold.toLocaleString('en-US')} gold, paid into your account here.`,
  kept: 'The Bank has your silver and will pay when the counting-house answers.',
  settled: (marks, gold) => `The Bank has finished counting: ${marksText(marks)} bought for ${gold.toLocaleString('en-US')} gold, paid into your account.`,
  movedIn: (marks) => `${marksText(marks)} put in.`,
  movedOut: (marks) => `${marksText(marks)} taken out.`,
  /** SILVER-FINDS: a find struck - a loot find's or a harvest's (`kind`, FIND_WORDS) - and the balance after it. */
  found: (n, balance, kind) => `You find ${marksText(n)} ${FIND_WORDS[kind] ?? FIND_WORDS.pile}.${Number.isSafeInteger(balance) ? ` You hold ${marksText(balance)}.` : ''}`,
});

/** A request id: `m` and fifteen of base 36, from the handed-in randomness (crypto's by default). */
export function mintMarksRid(rand = (b) => globalThis.crypto.getRandomValues(b)) {
  const b = new Uint8Array(15);
  rand(b);
  return `m${[...b].map((x) => (x % 36).toString(36)).join('')}`;
}

/**
 * @param {{
 *   door: ReturnType<typeof import('./accountClient.js').accountMarks>,
 *   store?: { get: (k: string) => any, set: (k: string, v: any) => void }|null,
 *   character?: () => (string|null),
 *   rid?: () => string,
 *   sleep?: (ms: number) => Promise<void>,
 *   nowMs?: () => number,
 * }} deps `character` the character this device plays now (a kept sale pays only it); `sleep` the wait between a
 *   press's asks (SCALE1 - the pins pass their own); `nowMs` the clock the day's finds are counted by (SILVER-FINDS -
 *   the host's shared one)
 */
export function createMarksBook({ door, store = null, character = () => null, rid = () => mintMarksRid(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)), nowMs = () => Date.now() }) {
  const state = { balance: /** @type {number|null} */ (null), today: /** @type {any} */ (null), open: /** @type {boolean|null} */ (null) };
  const account = () => { try { return door.account?.() ?? null; } catch { return null; } };
  /** The table as the store holds it - a store that refused a write is read from memory, and only then (AUDIT 28 M1:
   *  a store that merely reads empty is another tab's settle, not a lost write). */
  let _memory = null;
  const table = () => {
    if (_memory) return _memory;
    let v = null;
    try { v = store?.get(MARKS_PENDING_KEY) ?? null; } catch { v = null; }
    if (!v || typeof v !== 'object') return {};
    if (typeof v.rid === 'string') return { [`${v.account ?? ''}|${v.character ?? ''}`]: v };   // one sale, as MARKS1 kept it
    return v;
  };
  const writeTable = (t) => {
    _peekAt = -Infinity;   // what the face shows follows every write at once
    const out = Object.keys(t).length ? t : null;
    try { store?.set(MARKS_PENDING_KEY, out); _memory = null; } catch { _memory = { ...t }; }
  };
  const slot = () => `${account() ?? ''}|${character() ?? ''}`;
  const kept = () => table()[slot()] ?? null;
  /** AUDIT 28 H8: the Bank's face asks `pending` every frame - the store read (and parsed) at most once a second for it;
   *  a sale and a settle read it fresh. */
  let _peek = null, _peekAt = -Infinity;
  const keptSoon = () => {
    const now = Date.now();
    if (now - _peekAt >= 1000) { _peek = kept(); _peekAt = now; }
    return _peek;
  };
  const keep = (sale, key = slot()) => { const t = { ...table() }; if (sale) t[key] = sale; else delete t[key]; writeTable(t); };
  /** The one ask in flight - a sale or a settle (AUDIT 28 M1). */
  let busy = null;
  const once = (fn) => { if (busy) return null; busy = Promise.resolve().then(fn).finally(() => { busy = null; }); return busy; };

  const noteAnswer = (data) => {
    if (Number.isSafeInteger(data?.balance)) state.balance = data.balance;
    if (Number.isSafeInteger(data?.exchangedToday)) state.today = { ...(state.today ?? {}), exchanged: data.exchangedToday };   // AUDIT 28 M9
  };
  /** Guild moves whose answers did not come, by what they move - a press after a lost answer is the same move. */
  const moving = new Map();
  /** SILVER-FINDS: the finds whose asks were never answered (the network, the service's own fault) - `{ rid, kind,
   *  account }`, asked again with the same id by the next find that account asks; FINDS_OWED_MAX at most. AUDIT 625 S3:
   *  and every one an answer left owed (FIND_KEPT, the switch, a guest) - read from the store at the book's making,
   *  written back as a find settles. A store that refuses a write leaves them owed in memory. */
  const owed = (() => {
    let v = null;
    try { v = store?.get(MARKS_OWED_KEY) ?? null; } catch { v = null; }
    return Array.isArray(v) ? v.filter(owedFind).slice(-FINDS_OWED_MAX).map(({ rid: r, kind, account: a }) => ({ rid: r, kind, account: a })) : [];
  })();
  const keepOwed = () => {
    if (!store) return;
    try { store.set(MARKS_OWED_KEY, owed.length ? owed.map(({ rid: r, kind, account: a }) => ({ rid: r, kind, account: a })) : null); } catch { /* refused: owed in memory */ }
  };
  /** SILVER-FINDS: the account and the UTC day (the book's clock) the service said that account's finds were met - none
   *  is asked again until the day turns (another account signed in asks its own). */
  let findsMet = /** @type {{ account: string, day: number }|null} */ (null);

  /** Asks one act until the service answers it (or says no), at most MARKS_TRIES times. */
  async function ask(fn) {
    let r = null;
    for (let i = 0; i < MARKS_TRIES; i++) {
      if (i > 0) await sleep(jittered(MARKS_RETRY_MS[Math.min(i - 1, MARKS_RETRY_MS.length - 1)]));   // SCALE1
      try { r = await fn(); } catch { r = { ok: false, error: 'offline' }; }
      if (r?.ok || !RETRY.includes(r?.error)) return r;
    }
    return r;
  }

  return {
    state,
    /** The balance and today's counts, from the service; a closed currency or a guest reads `open` false. */
    async refresh() {
      const r = await ask(() => door.balance());
      if (r?.ok) { state.open = true; state.balance = r.data.balance; state.today = r.data.today ?? null; }
      else if (r?.error === 'marks-closed' || r?.error === 'marks-need-account') { state.open = false; state.balance = null; }
      return r;
    },
    /** The balance a gate's strike or an account card answered. */
    set(balance) { if (Number.isSafeInteger(balance)) { state.balance = balance; state.open = true; } },
    /** The line a gate claim's `marks` says, or null for none (a service from before it, or Marks not this account's).
     *  SILVER-WAYS: `kind` the claim's - a raid's capped line names the town; SERPENT-SET: a serpent's, the serpent. */
    strikeLine(marks, kind = 'gate') {
      if (!marks || typeof marks !== 'object') return null;
      if (Number.isSafeInteger(marks.balance)) this.set(marks.balance);
      // SILVER-WAYS: the day's combat silver as the strike answered it - the Bank's card reads it
      if (Number.isSafeInteger(marks.combat?.earned)) state.today = { ...(state.today ?? {}), combat: marks.combat.earned, combatMax: marks.combat.max };
      if (marks.struck > 0) return MARKS_TEXT.struck(marks.struck, marks.balance);
      return marks.why === 'cap' ? (kind === 'raid' ? MARKS_TEXT.cappedRaid : kind === 'serpent' ? MARKS_TEXT.cappedSerpent : MARKS_TEXT.capped) : null;
    },
    /** SILVER-WAYS: every silver line a counted claim's answer says - its strike (strikeLine), the guild deed it
     *  completed, the contracts that paid it - in that order; none for a service from before them. */
    claimLines(data, kind = 'gate') {
      if (!data || typeof data !== 'object') return [];
      const out = [];
      const strike = this.strikeLine(data.marks, kind);
      if (strike) out.push(strike);
      if (data.deed && Number.isSafeInteger(data.deed.struck) && data.deed.struck > 0) out.push(MARKS_TEXT.deed(data.deed.struck, data.deed.guild));
      for (const c of Array.isArray(data.contracts) ? data.contracts : []) {
        if (c && Number.isSafeInteger(c.pay) && c.pay > 0) out.push(MARKS_TEXT.contract(c.pay, c.guild));
      }
      return out;
    },
    /** SILVER-FINDS: a find's line - a loot find's (`kind` its FIND_KINDS) or a harvest's (`gather`: the answer's
     *  `marks`) - or null where it struck none (the day's met, a purse at its most); the balance and the day's count
     *  kept either way. */
    findLine(found, kind = 'gather') {
      if (!found || typeof found !== 'object') return null;
      if (Number.isSafeInteger(found.balance)) this.set(found.balance);
      const day = found.today;
      if (Number.isSafeInteger(day?.found)) {
        state.today = { ...(state.today ?? {}), ...(kind === 'gather' ? { gathered: day.found, gatherMax: day.max } : { found: day.found, findMax: day.max }) };
      }
      return Number.isSafeInteger(found.struck) && found.struck > 0 ? MARKS_TEXT.found(found.struck, found.balance, kind) : null;
    },
    /**
     * SILVER-FINDS: A LOOT FIND ASKED (systems/silverFinds.js rolled it) - the service strikes what its own dice say,
     * under the day's count (server-account/src/marks.js findMarks). Its own request id, asked again with it while the
     * network or the service falters (MARKS_TRIES); one never answered is OWED, asked first by this account's next find
     * - and once one goes unanswered the rest wait owed, unasked, so a dropped line costs a find one ask's tries.
     * Answers every find this ask settled, the owed first - `{ kind, found, line }`, `found` the service's answer and
     * `line` its words (null where it struck none) - and none where Marks are not this account's (no session, a guest,
     * the switch shut) or its day's finds are met.
     * AUDIT 625: S3 - an answer that says nothing of the find (FIND_KEPT; the switch, a guest - the book then closed)
     * leaves it OWED, and the rest owed unasked behind it, every one kept in the store; only a refusal of the find
     * itself lets it go (an id the service cannot read, a kind of none, its hour spent - the rest then wait owed). S4 -
     * each asked under ITS account (the door refuses another's session). S1 - `marks-young`, an account not yet a week
     * registered: its finds are none of its own - none owed - and its day is met.
     * @param {string} kind @returns {Promise<Array<{ kind: string, found: any, line: string|null }>>}
     */
    async find(kind) {
      const me = account();
      if (!me || !FIND_KINDS.includes(kind) || state.open === false) return [];
      const day = utcDay(Math.floor(nowMs() / 1000));
      if (findsMet?.account === me && findsMet.day === day) return [];
      const asks = [];
      for (let i = owed.length - 1; i >= 0; i--) if (owed[i].account === me) asks.unshift(...owed.splice(i, 1));
      asks.push({ rid: rid(), kind, account: me });
      const out = [];
      // why the rest wait owed, unasked: an ask nothing answered (the network, the session), the switch, its hour spent -
      // one find's tries, never twenty's; or `young`, and none of them is owed at all
      let held = null;
      const owe = (/** @type {any} */ f) => { if (owed.length < FINDS_OWED_MAX) owed.push(f); };
      for (const f of asks) {
        if (held) { if (held !== 'marks-young') owe(f); continue; }
        const r = await ask(() => door.find(f.kind, f.rid, f.account));
        const error = r?.ok ? null : (r?.error ?? 'offline');
        if (!error) {
          const found = r.data ?? {};
          if (Number.isSafeInteger(found.today?.found) && found.today.found >= found.today.max) findsMet = { account: me, day };
          out.push({ kind: f.kind, found, line: this.findLine(found, f.kind) });
        } else if (error === 'marks-young') {
          findsMet = { account: me, day };   // AUDIT 625 S1: none of its finds struck today - none asked again until the day turns
          held = error;
        } else if (error === 'marks-need-account' || error === 'marks-closed') {
          state.open = false; state.balance = null;   // not this account's: refresh's own reading, and nothing asked again
          owe(f); held = error;   // AUDIT 625 S3: this find and the rest owed, asked when silver is this account's again
        } else if (FIND_KEPT.includes(error)) {
          owe(f); held = error;   // never answered: owed
        } else if (error === 'marks-rate') {
          held = error;   // its hour spent: this find let go (MARKS_FINAL's law), the rest wait owed for the next hour
        }   // an id the service cannot read, a kind of none, a word this build does not know: this find let go
      }
      keepOwed();
      return out;
    },

    /**
     * SELL `marks` TO THE BANK: burnt on the service, then `credit(gold, where)` - the host's, into the account at this
     * bank. A sale not answered is kept, with `where`, and paid when it settles.
     * @returns {Promise<{ ok: boolean, text: string, gold?: number }>}
     */
    async sell(marks, credit, where = null) {
      if (!marksAmountOk(marks, MARKS_BANK.perDay)) return { ok: false, text: accountRefusalText('bad-marks') };
      if (!account()) return { ok: false, text: accountRefusalText('no-session') };
      const run = once(async () => {
        if (kept()) return { ok: false, text: MARKS_TEXT.kept };   // this account's and character's last sale must settle first
        const key = slot();
        const sale = { rid: rid(), marks, account: account(), character: character(), where };
        keep(sale, key);
        const r = await ask(() => door.exchange(marks, sale.rid));
        if (r?.ok) {
          keep(null, key);
          noteAnswer(r.data);
          const gold = Number.isSafeInteger(r.data?.gold) ? r.data.gold : exchangeGold(marks);
          credit(gold, where);
          return { ok: true, gold, text: MARKS_TEXT.sold(marks, gold) };
        }
        if (!MARKS_FINAL.includes(r?.error)) return { ok: false, text: MARKS_TEXT.kept };   // the line may be there: kept
        keep(null, key);   // the service looked and said no: nothing burnt, nothing owed
        return { ok: false, text: accountRefusalText(r?.error) };
      });
      return run ?? { ok: false, text: MARKS_TEXT.kept };   // one ask at a time - the one in flight answers
    },
    /** A kept sale, asked again - under the account that made it, and paid to `credit` only while the character that
     *  made it plays. Answers the line, or null. */
    async settle(credit) {
      const run = once(async () => {
        const key = slot();
        const sale = kept();
        if (!sale) return null;
        if (typeof sale.rid !== 'string' || !Number.isSafeInteger(sale.marks)) { keep(null, key); return null; }
        // (another account's sale, or another character's, is never found here: the kept table is keyed by the account
        // signed in and the character playing - their gold waits for them)
        const r = await ask(() => door.exchange(sale.marks, sale.rid));
        if (r?.ok) {
          keep(null, key);
          noteAnswer(r.data);
          const gold = Number.isSafeInteger(r.data?.gold) ? r.data.gold : exchangeGold(sale.marks);
          credit(gold, sale.where ?? null);
          return MARKS_TEXT.settled(sale.marks, gold);
        }
        if (MARKS_FINAL.includes(r?.error)) keep(null, key);
        return null;
      });
      return run ?? null;   // the ask in flight settles it
    },
    /** Whether a sale of this account's and character's waits to settle (or one is being asked). */
    get pending() { return !!busy || !!keptSoon(); },

    /** A guild's Marks treasury: in (any member) or out (the guildmaster's), from and to this account's balance. The
     *  request id is kept until an answer comes (AUDIT 28 M8). */
    async moveGuild(characterId, marks, out = false) {
      if (!marksAmountOk(marks, MARKS_MOVE_MAX)) return { ok: false, text: accountRefusalText('bad-marks') };
      const key = `${account() ?? ''}|${characterId}|${out ? 'out' : 'in'}|${marks}`;
      let m = moving.get(key);
      if (m?.promise) return m.promise;
      if (!m) moving.set(key, m = { id: rid(), promise: null });
      const id = m.id;
      m.promise = (async () => {
        const r = await ask(() => (out ? door.guildWithdraw(characterId, marks, id) : door.guildDeposit(characterId, marks, id)));
        m.promise = null;
        if (!RETRY.includes(r?.error)) moving.delete(key);   // answered - a lost answer keeps the id for the next press
        if (r?.ok) { noteAnswer(r.data); return { ok: true, guildMarks: r.data.guildMarks, text: out ? MARKS_TEXT.movedOut(marks) : MARKS_TEXT.movedIn(marks) }; }
        return { ok: false, error: r?.error ?? 'server', text: accountRefusalText(r?.error) };
      })();
      return m.promise;
    },
  };
}
