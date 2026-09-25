// @ts-check
// WB5b (2026-09-25, Mac, Option B: the relay "issues a signed kill record the account service honours"): THE RECEIPTS
// THIS DEVICE CARRIES TO THE ACCOUNT SERVICE, and the gates closed as the cards say them. Design:
// bible/11-Multiplayer/World-Bosses.md section 6.
//
// THE RELAY SIGNS, THE ACCOUNT SERVICE COUNTS, THIS FILE CARRIES. A receipt the relay hands this socket
// (net/gateLink.js `onReceipt` - the same one again after a reconnect, and from the hub) is kept on the device
// (GATE_CLAIMS_KEY) and offered to the account service (`/v1/gate/claim` - server-account/src/accounts.js claimGate)
// at once, and again while it is kept, at most every GATE_CLAIM_RETRY_MS. An answer that SETTLES it lets it go:
// counted, counted before (another device, a lost answer), not a receipt the relay signed, another account's. One
// that does not keeps it: no session yet, the service without its public half, a guest who may still register (its
// id survives the registering), the network. A receipt carries a week (net/gateReceipt.js RECEIPT_TTL_S) and an
// expired one is let go unasked; an UNSIGNED one (a relay with no key) is never kept - the service could only
// decline it.
//
// Pure - the call, the store and the clocks are handed in - so the pins drive it without a network.
//
// Not a DFU member. Ledger A (WB).
import { readReceipt } from './gateReceipt.js';

/** The device's receipts not yet settled with the account service. */
export const GATE_CLAIMS_KEY = 'wb5.gateClaims';
/** The most it keeps - two weeks of gates, a week past a receipt's life; the oldest go first past this. */
export const GATE_CLAIMS_MAX = 14;
/** The least time between two offers of what is kept, ms. */
export const GATE_CLAIM_RETRY_MS = 10 * 60 * 1000;

/** The words. */
export const GATE_CLAIM_TEXT = Object.freeze({
  recorded: (n) => `The gate is closed in your name. Gates closed: ${n}.`,
  guest: 'This gate is not on your record yet: only registered accounts keep one. Add a username this week and it counts.',
});

/** What the account service's answer does to a kept receipt: 'done' (let it go) or 'keep'. */
export function gateClaimVerdict(answer) {
  if (answer?.ok) return answer.data?.why === 'guest' ? 'keep' : 'done';   // counted, or counted before
  return answer?.error === 'receipt' || answer?.error === 'not-yours' ? 'done' : 'keep';
}

/** The gates closed as the account card says them - "3", "None yet" - or null for no record (a service from before
 *  it, or no answer). */
export function gateRecordText(rec) {
  if (!rec || typeof rec !== 'object' || !Number.isSafeInteger(rec.closed) || rec.closed < 0) return null;
  return rec.closed > 0 ? String(rec.closed) : 'None yet';
}

/**
 * @param {{
 *   claim: (receipt: string) => Promise<any>,
 *   store?: { get: (k: string) => any, set: (k: string, v: any) => void }|null,
 *   nowS?: () => number, nowMs?: () => number, say?: (text: string) => void, onClosed?: (closed: number) => void,
 * }} deps `claim` is net/accountClient.js accountGates' - `{ ok, data }` or `{ ok: false, error }`, never a throw
 */
export function createGateClaims({ claim, store = null, nowS = () => Math.floor(Date.now() / 1000), nowMs = () => Date.now(), say = () => {}, onClosed = () => {} }) {
  /** an offer under way; a receipt that came in during it (offered as soon as it ends); the last offer's time */
  let busy = false, again = false, lastAt = -Infinity;
  /** the receipts settled this session (a re-send is not asked again), and the ones whose guest line was said */
  const settled = new Set(), guestSaid = new Set();
  const live = (r) => { const c = typeof r === 'string' ? readReceipt(r) : null; return c && c.signed && c.e > nowS() ? c : null; };
  function kept() {
    let v = null;
    try { v = store?.get(GATE_CLAIMS_KEY) ?? null; } catch { v = null; }
    return (Array.isArray(v) ? v : []).filter((r) => live(r));
  }
  const keep = (list) => { try { store?.set(GATE_CLAIMS_KEY, list); } catch { /* the next receipt tries again */ } };

  async function flush() {
    if (busy) { again = true; return 0; }
    busy = true;
    lastAt = nowMs();
    let recorded = 0;
    try {
      const list = kept();
      keep(list);   // the expired go unasked
      for (const r of list) {
        let answer;
        try { answer = await claim(r); } catch { answer = { ok: false, error: 'offline' }; }
        if (answer?.ok && answer.data?.recorded === true) {
          recorded++;
          const n = Number.isSafeInteger(answer.data.closed) ? answer.data.closed : null;
          if (n != null) { onClosed(n); say(GATE_CLAIM_TEXT.recorded(n)); }
        } else if (answer?.ok && answer.data?.why === 'guest' && !guestSaid.has(r)) {
          guestSaid.add(r);
          say(GATE_CLAIM_TEXT.guest);
        }
        if (gateClaimVerdict(answer) === 'done') { settled.add(r); keep(kept().filter((k) => k !== r)); }
      }
    } finally { busy = false; }
    if (again) { again = false; void flush(); }
    return recorded;
  }

  return {
    /** A receipt the relay handed this socket: kept (one a day - the relay re-sends the same one) and offered at once.
     *  Answers whether it is kept. */
    add(r) {
      const c = live(r);
      if (!c || settled.has(r)) return false;
      const list = kept();
      if (!list.some((k) => k === r || readReceipt(k)?.d === c.d)) keep([...list, r].slice(-GATE_CLAIMS_MAX));
      void flush();
      return true;
    },
    /** A frame: what is kept is offered again once GATE_CLAIM_RETRY_MS has passed since the last offer - the first
     *  frame of a session at once. */
    tick() {
      if (busy || nowMs() - lastAt < GATE_CLAIM_RETRY_MS) return false;
      if (!kept().length) { lastAt = nowMs(); return false; }
      void flush();
      return true;
    },
    flush,
    /** What is kept, for the tests and the stats. */
    kept,
  };
}
