// @ts-check
// SD9b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 11): THE HOUR'S RECEIPTS THIS
// DEVICE CARRIES TO THE ACCOUNT SERVICE, and the Hours broken as the cards say them - the gate's book (net/gateClaims.js)
// rung for rung, without its rite or its embers.
//
// THE RELAY SIGNS, THE ACCOUNT SERVICE COUNTS, THIS FILE CARRIES. A receipt the relay hands this socket (net/online.js
// `onSdReceipt` - at the fall in the realm, again at a late `in`, and from the hub at a hello) is kept on the device
// (SD_CLAIMS_KEY) and offered to the account service (`/v1/sd/claim` - server-account/src/sds.js claimSd) at once, and
// again while it is kept, at most every SD_CLAIM_RETRY_MS. An answer that SETTLES it lets it go: counted, counted before
// (another device, a lost answer), not a receipt the relay signed. One that does not keeps it: no session yet, the
// service without its public half, a guest who may still register, the network - and a refusal the SERVICE can mend
// (the gate's AUDIT WB A5: its key not the relay's pair, a clock off). An expired one - by the RELAY's clock - is let go
// unasked; an UNSIGNED one (a relay with no key) is never kept - the service could only decline it.
//
// THE DEVICE IS NOT THE ACCOUNT (the gate's AUDIT WB A9): kept one a Hollow AND account, and only the signed-in
// account's offered. A store that refuses writes keeps the list in this session's memory (AUDIT WB A6).
//
// Pure - the call, the store and the clocks are handed in. Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { readSdReceipt } from './sdReceipt.js';

/** The device's Hour receipts not yet settled with the account service. */
export const SD_CLAIMS_KEY = 'sd9.sdClaims';
/** The most it keeps for one account - a week of Hollows at the fastest (a kill at the rise, the collapse and the rest: a
 *  Hollow about every two hours, 84 a week); its oldest go first. AUDIT SD II (L5 F6): it was 8 for the whole device,
 *  "a week holds a few" - a guest that broke nine Hours inside its week lost the first before it registered, and a
 *  shared device's other accounts pushed one account's out. And the most for every account the device holds. */
export const SD_CLAIMS_MAX = 96;
export const SD_CLAIMS_ALL_MAX = 256;
/** The least time between two offers of what is kept, ms (the gate's). */
export const SD_CLAIM_RETRY_MS = 10 * 60 * 1000;
/** How often a frame asks who is signed in (the gate's AUDIT WBX W4). */
export const SD_ME_POLL_MS = 1000;

/** The words. */
export const SD_CLAIM_TEXT = Object.freeze({
  recorded: (n) => `The Hour is broken. Hours broken: ${n}.`,
  title: 'The Hour names you Hourbreaker.',
  aura: 'The Turning Hour turns about you.',
  guest: 'Hour not recorded. Add a username within a week to keep it.',
});

/** The refusals of a receipt the service can mend - kept for the receipt's week rather than let go (the gate's). */
export const SD_CLAIM_MENDABLE = Object.freeze(['signature', 'verify-threw', 'future', 'clock']);

/** What the account service's answer does to a kept receipt: 'done' (let it go) or 'keep'. */
export function sdClaimVerdict(answer) {
  if (answer?.ok) return answer.data?.why === 'guest' ? 'keep' : 'done';   // counted, or counted before
  return answer?.error === 'receipt' && !SD_CLAIM_MENDABLE.includes(answer.why) ? 'done' : 'keep';
}

/** The Hours broken as the account card says them - "3", "None yet" - or null for no record. */
export function sdRecordText(rec) {
  if (!rec || typeof rec !== 'object' || !Number.isSafeInteger(rec.broken) || rec.broken < 0) return null;
  return rec.broken > 0 ? String(rec.broken) : 'None yet';
}

/**
 * @param {{
 *   claim: (receipt: string) => Promise<any>,
 *   store?: { get: (k: string) => any, set: (k: string, v: any) => void }|null,
 *   nowS?: () => (number|null), nowMs?: () => number, say?: (text: string) => void, onBroken?: (broken: number) => void,
 *   me?: () => (string|null),
 * }} deps `claim` is net/accountClient.js accountSds' - `{ ok, data }` or `{ ok: false, error, why? }`, never a throw;
 *   `nowS` the relay's clock (null unheard); `me` the signed-in account's id, null for none
 */
export function createSdClaims({ claim, store = null, nowS = () => Math.floor(Date.now() / 1000), nowMs = () => Date.now(), say = () => {}, onBroken = () => {}, me = () => null }) {
  let busy = false, again = false, lastAt = -Infinity;
  let lastMe, meAt = -Infinity;
  const settled = new Set(), guestSaid = new Set();
  const live = (r) => { const c = typeof r === 'string' ? readSdReceipt(r) : null; const t = nowS(); return c && c.signed && (t == null || c.e > t) ? c : null; };
  let memory = [];
  function kept() {
    let v;
    try { v = store ? store.get(SD_CLAIMS_KEY) : undefined; } catch { v = undefined; }
    return (Array.isArray(v) ? v : v === undefined ? memory : []).filter((r) => live(r));
  }
  const keep = (list) => { memory = list; try { store?.set(SD_CLAIMS_KEY, list); } catch { /* memory holds it */ } };

  async function flush() {
    if (busy) { again = true; return 0; }
    busy = true;
    lastAt = nowMs();
    let recorded = 0;
    try {
      const list = kept();
      keep(list);   // the expired go unasked
      const mine = me();
      for (const r of list) {
        if (!mine || live(r)?.s !== mine) continue;   // another account's waits for its own sign-in
        let answer;
        try { answer = await claim(r); } catch { answer = { ok: false, error: 'offline' }; }
        if (answer?.ok && answer.data?.recorded === true) {
          recorded++;
          const n = Number.isSafeInteger(answer.data.broken) ? answer.data.broken : null;
          if (n != null) { onBroken(n); say(SD_CLAIM_TEXT.recorded(n)); }
          if (answer.data.title === true) say(SD_CLAIM_TEXT.title);
          if (answer.data.aura === true) say(SD_CLAIM_TEXT.aura);
        } else if (answer?.ok && answer.data?.why === 'guest' && !guestSaid.has(r)) {
          guestSaid.add(r);
          say(SD_CLAIM_TEXT.guest);
        }
        if (sdClaimVerdict(answer) === 'done') { settled.add(r); keep(kept().filter((k) => k !== r)); }
      }
    } finally { busy = false; }
    if (again) { again = false; void flush(); }
    return recorded;
  }

  return {
    /** A receipt the relay handed this socket: kept (one a Hollow and account - the relay re-sends the same one) and
     *  offered at once. Answers whether it is kept. */
    add(r) {
      const c = live(r);
      if (!c || settled.has(r)) return false;
      const list = kept();
      if (!list.some((k) => { const o = readSdReceipt(k); return k === r || (o?.d === c.d && o?.s === c.s); })) {
        const theirs = list.filter((k) => readSdReceipt(k)?.s === c.s);
        const drop = theirs.length >= SD_CLAIMS_MAX ? theirs[0] : null;   // the account's own oldest, never another's
        keep([...list.filter((k) => k !== drop), r].slice(-SD_CLAIMS_ALL_MAX));
      }
      void flush();
      return true;
    },
    /** A frame: what is kept is offered again once SD_CLAIM_RETRY_MS has passed since the last offer - the first frame of
     *  a session at once, and the first after another account signs in. */
    tick() {
      if (busy) return false;
      const t = nowMs(), due = t - lastAt >= SD_CLAIM_RETRY_MS;
      if (!due && t - meAt < SD_ME_POLL_MS) return false;
      meAt = t;
      const mine = me(), signedIn = mine !== lastMe;
      lastMe = mine;
      if (!signedIn && !due) return false;
      if (!kept().some((r) => mine && live(r)?.s === mine)) { lastAt = nowMs(); return false; }
      void flush();
      return true;
    },
    flush,
    /** What is kept, for the tests and the stats. */
    kept,
  };
}
