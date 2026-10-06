// @ts-check
// SERPENT1 (2026-10-04, Mac: "a large scale sea serpent in the ocean"): THE SERPENT RECEIPTS THIS DEVICE CARRIES TO THE
// ACCOUNT SERVICE, and the serpents slain as the cards say them. The raids' carrier (net/raidClaims.js), rung for rung,
// on its own key and its own route. Design: bible/11-Multiplayer/Sea-Serpent.md section 8.
//
// THE RELAY SIGNS, THE ACCOUNT SERVICE COUNTS AND PAYS, THIS FILE CARRIES. A receipt the serpent's cell hands this socket
// at the kill (or again at the next `in` while it keeps the fight) is kept on the device (SERPENT_CLAIMS_KEY) WITH THE
// CHARACTER THAT FOUGHT IT, its level and this device's claim id (`cid` - the hoard's key), and offered to the account
// service (`/v1/serpent/claim` - server-account/src/serpents.js claimSerpent) at once, and again while it is kept, at most
// every SERPENT_CLAIM_RETRY_MS. An answer that SETTLES it lets it go: counted, counted before, not a receipt the relay
// signed, no character to pay. One that does not keeps it: no session yet, the service without its public half, a guest
// who may still register, the network, a refusal the service can mend. An expired receipt (by the relay's clock) is let
// go unasked; an UNSIGNED one is never kept. Only the signed-in account's receipts are offered (AUDIT WB A9's law).
//
// THE HOARD IS THE SERVICE'S WORD (the raids' AUDIT RAID R4): the service writes the (day, account)'s hoard row for the
// first claim that asks, a guest's too, and answers `spoils: true` to that claim alone - `onSpoils` hears it, and the
// page rolls the hoard (systems/serpentSpoils.js). A receipt this device SETTLED is remembered (SERPENT_SETTLED_KEY).
//
// Pure - the call, the store and the clocks are handed in. Not a DFU member. Ledger A (SERPENT1).
import { readSerpentReceipt } from './serpentReceipt.js';
import { serpentBossById } from './serpentLaw.js';

/** The device's serpent receipts not yet settled with the account service: `[{ r, ch, nm, lv, cid }]` - the receipt, the
 *  character that fought it, its name, its level (the hoard rolls at it), and this device's claim id. */
export const SERPENT_CLAIMS_KEY = 'serpent1.claims';
/** The receipts this device has settled with the service - `day|account` - never claimed again. */
export const SERPENT_SETTLED_KEY = 'serpent1.settled';
export const SERPENT_SETTLED_MAX = 32;
/** A claim id - sixteen hex digits, the service's SERPENT_CID_RE. */
export const SERPENT_CID_RE = /^[0-9a-f]{16}$/;
const mintCid = () => { const b = new Uint8Array(8); globalThis.crypto.getRandomValues(b); return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); };
/** A receipt's settled key - its day and account. */
const settledKeyOf = (c) => `${c.d}|${c.s}`;
/** The most it keeps; the oldest go first past this. AUDIT SERPENT D3: fewer than the spoils pool remembers spent
 *  (scenes/spoilsPool.js SPOILS_SPENT_MAX, 32 - pinned below it), so a guest's receipts, offered again and again, never
 *  outlive the pool's memory that their hoard was given. */
export const SERPENT_CLAIMS_MAX = 24;
/** The least time between two offers of what is kept, ms. */
export const SERPENT_CLAIM_RETRY_MS = 10 * 60 * 1000;
/** How often a frame asks who is signed in (AUDIT WBX W4's law). */
export const SERPENT_ME_POLL_MS = 1000;

/** The words. */
export const SERPENT_CLAIM_TEXT = Object.freeze({
  recorded: (n, xp, boss) => `The Bay will remember ${boss.name}'s fall. Serpents slain: ${n}.${xp > 0 ? ` +${xp} Renown XP.` : ''}`,   // AUDIT SERPENT B11: the table's name
  guest: 'This serpent is not on your record yet: only registered accounts keep one. Add a username this week and it counts.',
});

/** The refusals of a receipt the service can mend (the gate's GATE_CLAIM_MENDABLE): kept for the week it carries. */
export const SERPENT_CLAIM_MENDABLE = Object.freeze(['signature', 'verify-threw', 'future', 'clock']);

/** What the account service's answer does to a kept receipt: 'done' (let it go) or 'keep'. */
export function serpentClaimVerdict(answer) {
  if (answer?.ok) return answer.data?.why === 'guest' ? 'keep' : 'done';   // counted, counted before
  if (answer?.error === 'renown-character') return 'done';   // no character to pay - it never will be
  return answer?.error === 'receipt' && !SERPENT_CLAIM_MENDABLE.includes(answer.why) ? 'done' : 'keep';
}

/** The serpents slain as the account card says them - "3", "None yet" - or null for no record. */
export function serpentRecordText(rec) {
  if (!rec || typeof rec !== 'object' || !Number.isSafeInteger(rec.slain) || rec.slain < 0) return null;
  return rec.slain > 0 ? String(rec.slain) : 'None yet';
}

/**
 * @param {{
 *   claim: (receipt: string, character: string, name: string|null, cid: string) => Promise<any>,
 *   store?: { get: (k: string) => any, set: (k: string, v: any) => void }|null,
 *   nowS?: () => (number|null), nowMs?: () => number, say?: (text: string) => void,
 *   onRecorded?: (data: any, entry: { r: string, ch: string, nm: string|null, lv: number, cid: string }) => void,
 *   onSpoils?: (entry: { r: string, ch: string, nm: string|null, lv: number, cid: string }, data: any) => (void|Promise<any>),
 *   onMarks?: (data: any) => (string|string[]|null),
 *   me?: () => (string|null), cid?: () => string,
 * }} deps `claim` is net/accountClient.js accountSerpents' - `{ ok, data }` or `{ ok: false, error, why? }`, never a
 *   throw; `me` the signed-in account's id; `onRecorded` hears each counted receipt's answer (its Renown and order);
 *   `onSpoils` each receipt whose hoard the service gave THIS claim - awaited, its receipt settled only once it is given;
 *   `onMarks` (SERPENT-SET) each counted receipt's silver, the lines it answers said as the raids' are
 */
export function createSerpentClaims({ claim, store = null, nowS = () => Math.floor(Date.now() / 1000), nowMs = () => Date.now(), say = () => {}, onRecorded = () => {}, onSpoils = () => {}, onMarks = () => null, me = () => null, cid = mintCid }) {
  let busy = false, again = false, lastAt = -Infinity;
  let lastMe, meAt = -Infinity;
  const settled = new Set(), guestSaid = new Set();
  const live = (r) => { const c = typeof r === 'string' ? readSerpentReceipt(r) : null; const t = nowS(); return c && c.signed && (t == null || c.e > t) ? c : null; };   // AUDIT ONLINE2 F2: `nowS` the relay's clock, null unheard
  const entry = (e) => (e && typeof e === 'object' && live(e.r) && typeof e.ch === 'string' && e.ch && typeof e.cid === 'string' && SERPENT_CID_RE.test(e.cid) ? e : null);
  /** The device's settled receipts, and one more */
  const settledHere = () => { let v; try { v = store ? store.get(SERPENT_SETTLED_KEY) : undefined; } catch { v = undefined; } return Array.isArray(v) ? v.filter((k) => typeof k === 'string') : []; };
  const markSettled = (c) => { if (!c) return; const list = settledHere().filter((k) => k !== settledKeyOf(c)); try { store?.set(SERPENT_SETTLED_KEY, [...list, settledKeyOf(c)].slice(-SERPENT_SETTLED_MAX)); } catch { /* the session's own set holds it */ } };
  /** R8e: a page's hook that throws is the page's - never the carrier's (it left the receipt unsettled, and the next
   *  offer was answered "claimed") */
  const hear = (fn, ...args) => { try { fn(...args); } catch (e) { console.warn('[serpent] claim hook', e?.message ?? e); } };
  /** AUDIT SERPENT D6: the hoard's grant AWAITED - one that fails (thrown or rejected) leaves its receipt unsettled, so the
   *  next offer asks again and the service gives this claim its hoard again (the pool's spent mark keeps it once). */
  const granted = async (fn, ...args) => { try { await fn(...args); return true; } catch (e) { console.warn('[serpent] claim hook', e?.message ?? e); return false; } };
  let memory = [];
  function kept() {
    let v;
    try { v = store ? store.get(SERPENT_CLAIMS_KEY) : undefined; } catch { v = undefined; }
    return (Array.isArray(v) ? v : v === undefined ? memory : []).filter((e) => entry(e));
  }
  const keep = (list) => { memory = list; try { store?.set(SERPENT_CLAIMS_KEY, list); } catch { /* memory holds it */ } };

  async function flush() {
    if (busy) { again = true; return 0; }
    busy = true;
    lastAt = nowMs();
    let recorded = 0;
    try {
      const list = kept();
      keep(list);   // the expired go unasked
      const mine = me();
      for (const e of list) {
        if (!mine || live(e.r)?.s !== mine) continue;   // another account's waits for its own sign-in
        let answer;
        try { answer = await claim(e.r, e.ch, e.nm ?? null, e.cid); } catch { answer = { ok: false, error: 'offline' }; }
        const given = answer?.ok && answer.data?.spoils === true ? await granted(onSpoils, e, answer.data) : true;   // the hoard, this claim's
        if (answer?.ok && answer.data?.recorded === true) {
          recorded++;
          const n = Number.isSafeInteger(answer.data.slain) ? answer.data.slain : null;
          const xp = Number.isSafeInteger(answer.data.renown?.credited) ? answer.data.renown.credited : 0;
          if (n != null) say(SERPENT_CLAIM_TEXT.recorded(n, xp, serpentBossById(live(e.r)?.b)));
          // SERPENT-SET: the serpent's silver - the host's lines for it (the raids' own door)
          let lines = null;
          try { lines = onMarks(answer.data); } catch (err) { console.warn('[serpent] silver lines', err?.message ?? err); }
          for (const line of Array.isArray(lines) ? lines : [lines]) if (typeof line === 'string' && line) say(line);
          hear(onRecorded, answer.data, e);
        } else if (answer?.ok && answer.data?.why === 'guest' && !guestSaid.has(e.r)) {
          guestSaid.add(e.r);
          say(SERPENT_CLAIM_TEXT.guest);
        }
        if (given && serpentClaimVerdict(answer) === 'done') { settled.add(e.r); markSettled(live(e.r)); keep(kept().filter((k) => k.r !== e.r)); }
      }
    } finally { busy = false; }
    if (again) { again = false; void flush(); }
    return recorded;
  }

  return {
    /** A receipt the relay handed this socket, with the character that fought it and its level: kept (one a serpent AND
     *  account - the cell re-sends the same one; never one this device settled) and offered at once. Answers whether it
     *  is kept. */
    add(r, character, name = null, level = 1) {
      const c = live(r);
      if (!c || settled.has(r) || settledHere().includes(settledKeyOf(c)) || typeof character !== 'string' || !character) return false;
      const list = kept();
      if (!list.some((k) => { const o = readSerpentReceipt(k.r); return k.r === r || (o?.d === c.d && o?.s === c.s); })) {
        const lv = Math.max(1, Math.floor(Number(level) || 1));
        keep([...list, { r, ch: character, nm: typeof name === 'string' ? name : null, lv, cid: cid() }].slice(-SERPENT_CLAIMS_MAX));
      }
      void flush();
      return true;
    },
    /** A frame: what is kept is offered again once SERPENT_CLAIM_RETRY_MS has passed since the last offer - the first frame
     *  of a session at once, and the first after another account signs in. */
    tick() {
      if (busy) return false;
      const t = nowMs(), due = t - lastAt >= SERPENT_CLAIM_RETRY_MS;
      if (!due && t - meAt < SERPENT_ME_POLL_MS) return false;
      meAt = t;
      const mine = me(), signedIn = mine !== lastMe;
      lastMe = mine;
      if (!signedIn && !due) return false;
      if (!kept().some((e) => mine && live(e.r)?.s === mine)) { lastAt = nowMs(); return false; }
      void flush();
      return true;
    },
    flush,
    /** What is kept, for the tests and the stats. */
    kept,
  };
}
