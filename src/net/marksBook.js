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
// Pure - the door, the store and the ids are handed in - so the pins drive
// it without a network.
// ═══════════════════════════════════════════════════════════════════
import { MARKS_BANK, MARKS_COMBAT, MARKS_MOVE_MAX, marksAmountOk, marksText, exchangeGold } from './marksLaw.js';
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

/** The words. */
export const MARKS_TEXT = Object.freeze({
  struck: (n, balance) => `${marksText(n)} struck to your account. You hold ${marksText(balance)}.`,
  // WB12a; WB13b: the record's own line says it is recorded; SILVER: the currency's name; SILVER-WAYS: the day's cap is
  // the gates' and the raids' together
  capped: `No silver for this breach. The counting-houses strike ${marksText(MARKS_COMBAT.perDay)} a day for breaches closed and towns defended.`,
  cappedRaid: `No silver for this town. The counting-houses strike ${marksText(MARKS_COMBAT.perDay)} a day for breaches closed and towns defended.`,
  /** SILVER-WAYS: a guild deed this claim completed - three of the guild's accounts on one raid or gate. */
  deed: (n, guild) => `A deed for ${guild?.name ?? 'your guild'}: three of its members stood together. ${marksText(n)} struck to its treasury.`,
  /** SILVER-WAYS: a guild contract's pay for a town defended. */
  contract: (pay, guild) => `${guild?.name ?? 'A guild'} pays you ${marksText(pay)} under its contract.`,
  sold: (marks, gold) => `The Bank buys ${marksText(marks)} for ${gold.toLocaleString('en-US')} gold, paid into your account here.`,
  kept: 'The Bank has your silver and will pay when the counting-house answers.',
  settled: (marks, gold) => `The Bank has finished counting: ${marksText(marks)} bought for ${gold.toLocaleString('en-US')} gold, paid into your account.`,
  movedIn: (marks) => `${marksText(marks)} put in.`,
  movedOut: (marks) => `${marksText(marks)} taken out.`,
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
 * }} deps `character` the character this device plays now (a kept sale pays only it); `sleep` the wait between a
 *   press's asks (SCALE1 - the pins pass their own)
 */
export function createMarksBook({ door, store = null, character = () => null, rid = () => mintMarksRid(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
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
     *  SILVER-WAYS: `kind` the claim's - a raid's capped line names the town. */
    strikeLine(marks, kind = 'gate') {
      if (!marks || typeof marks !== 'object') return null;
      if (Number.isSafeInteger(marks.balance)) this.set(marks.balance);
      // SILVER-WAYS: the day's combat silver as the strike answered it - the Bank's card reads it
      if (Number.isSafeInteger(marks.combat?.earned)) state.today = { ...(state.today ?? {}), combat: marks.combat.earned, combatMax: marks.combat.max };
      if (marks.struck > 0) return MARKS_TEXT.struck(marks.struck, marks.balance);
      return marks.why === 'cap' ? (kind === 'raid' ? MARKS_TEXT.cappedRaid : MARKS_TEXT.capped) : null;
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
