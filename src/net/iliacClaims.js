// @ts-check
// CARDS10 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 29): THE RANKED GAMES' RECEIPTS THIS DEVICE CARRIES
// TO THE ACCOUNT SERVICE - the arena's carrier's law (net/arenaClaims.js) for Iliac Hand's signature (net/iliacReceipt.js).
//
// THE RELAY SIGNS, THE ACCOUNT SERVICE COUNTS, THIS FILE CARRIES. A receipt the relay hands this socket at a ranked
// game's end is kept on the device (ILIAC_CLAIMS_KEY), one a game, and offered to `/v1/iliac/claim`
// (server-account/src/iliac.js claimIliac) at once and again while kept, at most every ILIAC_CLAIM_RETRY_MS. An answer
// that SETTLES it lets it go: counted, counted before (the other seat carried it first - one row a game), not a receipt
// the relay signed. One that does not keeps it: no session yet, the service without the relay's key, a guest who may
// still register, the network, a refusal the service can mend (its key, a clock). An unsigned receipt is never kept and
// an expired one is let go unasked. Only the signed-in account's receipts are offered (it is among the two, `f`).
//
// Pure - the call, the store and the clocks are handed in - so the pins drive it without a network.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { readIliacReceipt } from './iliacReceipt.js';
import { ARENA_CLAIM_MENDABLE } from './arenaClaims.js';

/** The device's receipts not yet settled with the account service. */
export const ILIAC_CLAIMS_KEY = 'cards10.iliacClaims';
/** The most it keeps; the oldest go first past this. */
export const ILIAC_CLAIMS_MAX = 32;
/** The least time between two offers of what is kept, ms (the arena's). */
export const ILIAC_CLAIM_RETRY_MS = 5 * 60 * 1000;

/** What the service's answer does to a kept receipt: 'done' (let it go) or 'keep' - the arena's verdict. */
export function iliacClaimVerdict(answer) {
  if (answer?.ok) return answer.data?.why === 'guest' ? 'keep' : 'done';
  return answer?.error === 'receipt' && !ARENA_CLAIM_MENDABLE.includes(answer.why) ? 'done' : 'keep';
}

/**
 * @param {{
 *   claim: (receipt: string) => Promise<any>,
 *   store?: { get: (k: string) => any, set: (k: string, v: any) => void }|null,
 *   nowS?: () => (number|null), nowMs?: () => number, me?: () => (string|null),
 *   onCounted?: (data: any) => void, onGuest?: () => void,
 * }} deps `claim` is net/accountClient.js accountIliac's - `{ ok, data }` or `{ ok: false, error, why? }`; `onCounted`
 *   told each answer that recorded a game (its result, its rating); `onGuest` once a receipt a guest carried
 */
export function createIliacClaims({ claim, store = null, nowS = () => Math.floor(Date.now() / 1000), nowMs = () => Date.now(), me = () => null, onCounted = () => {}, onGuest = () => {} }) {
  let running = null, again = false, lastAt = -Infinity, lastMe;
  const settled = new Set(), guestSaid = new Set();
  const live = (r) => { const c = typeof r === 'string' ? readIliacReceipt(r) : null; const t = nowS(); return c && c.signed && (t == null || c.e > t) ? c : null; };
  const mineOf = (c, id) => !!c && !!id && c.f.includes(id);
  let memory = [];
  function kept() {
    let v;
    try { v = store ? store.get(ILIAC_CLAIMS_KEY) : undefined; } catch { v = undefined; }
    return (Array.isArray(v) ? v : v === undefined ? memory : []).filter((r) => live(r));
  }
  const keep = (list) => { memory = list; try { store?.set(ILIAC_CLAIMS_KEY, list); } catch { /* memory holds it */ } };
  function flush() {
    if (running) { again = true; return running; }
    running = run().finally(() => { running = null; if (again) { again = false; void flush(); } });
    return running;
  }
  async function run() {
    lastAt = nowMs();
    let recorded = 0;
    const list = kept();
    keep(list);
    const id = me();
    for (const r of list) {
      if (!mineOf(live(r), id)) continue;
      let answer;
      try { answer = await claim(r); } catch { answer = { ok: false, error: 'offline' }; }
      if (answer?.ok && answer.data?.recorded === true) { recorded++; onCounted(answer.data); }
      else if (answer?.ok && answer.data?.why === 'guest' && !guestSaid.has(r)) { guestSaid.add(r); onGuest(); }
      if (iliacClaimVerdict(answer) === 'done') { settled.add(r); keep(kept().filter((k) => k !== r)); }
    }
    return recorded;
  }
  return {
    /** A receipt the relay handed this socket: kept (one a game - the relay hands it to every socket of the account) and
     *  offered at once. Answers whether it is kept. */
    add(r) {
      const c = live(r);
      if (!c || settled.has(r)) return false;
      const list = kept();
      if (!list.some((k) => k === r || readIliacReceipt(k)?.j === c.j)) keep([...list, r].slice(-ILIAC_CLAIMS_MAX));
      void flush();
      return true;
    },
    /** A frame: what is kept is offered again once ILIAC_CLAIM_RETRY_MS has passed, and at once when another account
     *  signs in. */
    tick() {
      if (running) return false;
      const t = nowMs(), due = t - lastAt >= ILIAC_CLAIM_RETRY_MS;
      const id = me(), signedIn = id !== lastMe;
      lastMe = id;
      if (!signedIn && !due) return false;
      if (!kept().some((r) => mineOf(live(r), id))) { lastAt = t; return false; }
      void flush();
      return true;
    },
    flush,
    kept,
  };
}
