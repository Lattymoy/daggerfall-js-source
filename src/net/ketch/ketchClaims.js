// @ts-check
// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 9): THE TONAL WARDEN'S RECEIPTS THIS DEVICE CARRIES TO THE
// ACCOUNT SERVICE - the Hour's book (net/superDungeon/sdClaims.js) rung for rung, and the hold's week.
//
// THE RELAY SIGNS, THE ACCOUNT SERVICE COUNTS, THIS FILE CARRIES. A receipt the relay hands this page (net/online.js
// `onKetch`'s `rcpt` - the ship's at the Warden's fall and at a hello into her, the hub's at a hello: AUDIT KETCH L1-2) is
// kept on the device (KT_CLAIMS_KEY) with a claim id minted for it once (`cid` - the stars' and the raids' own) and
// offered to the account service (`/v1/ketch/claim` - server-account/src/ketch.js claimKetch) at once, and again while it
// is kept, at most every KT_CLAIM_RETRY_MS. An answer that SETTLES it lets it go: counted, counted before, taken by
// another crew's ship, not a receipt the relay signed. One that does not keeps it: no session yet, the service without
// its public half, the network, a refusal the service can mend.
//
// THE HOLD PAYS THIS DEVICE ONCE: a receipt the service answers with its share (`recorded`, or `claimed` under this
// device's claim id - a retry after a lost answer) is handed to `paid` with its claims, which rolls the spoils off its seed
// (systems/ketch/ketchSpoils.js), and the questline's act is said once (AUDIT KETCH L2-6: a retry's `claimed` paid and
// never said it). Another device's `claimed` pays nothing (AUDIT KETCH L2-1). A receipt answered `taken` throws nothing:
// the account took its week's share with another crew.
//
// THE DEVICE IS NOT THE ACCOUNT: kept one a voyage AND account, and only the signed-in account's offered.
//
// Pure - the call, the store and the clocks are handed in. Not a DFU member. Ledger A (KETCH).
import { readKetchReceipt } from './ketchReceipt.js';
import { noteAct } from '../../systems/questlines/qlActs.js';   // the questline's act: the Warden felled, counted once
import { t } from '../../systems/textManager.js';

/** The device's Ketch receipts not yet settled with the account service: `[{ r, cid, a? }]` - the receipt, its claim id,
 *  and whether its act was said. */
export const KT_CLAIMS_KEY = 'kt.ketchClaims';
/** A claim id - sixteen hex digits, the service's KT_CID_RE. */
export const KT_CID_RE = /^[0-9a-f]{16}$/;
const mintCid = () => { const b = new Uint8Array(8); globalThis.crypto.getRandomValues(b); return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); };
/** The most it keeps for one account and for the device (a voyage every ten hours, each claimed as it is earned: a handful at most). */
export const KT_CLAIMS_MAX = 8;
export const KT_CLAIMS_ALL_MAX = 64;
/** The least time between two offers of what is kept, ms; how often a frame asks who is signed in. */
export const KT_CLAIM_RETRY_MS = 10 * 60 * 1000;
export const KT_ME_POLL_MS = 1000;
/** The refusals of a receipt the service can mend - kept for the receipt's week rather than let go (the gate's). */
export const KT_CLAIM_MENDABLE = Object.freeze(['signature', 'verify-threw', 'future', 'clock']);

/** The words - each read through the text core when it is said (L10N4). */
export const KT_CLAIM_TEXT = Object.freeze({
  recorded: (n) => t('ketch.claim.recorded', 'The Ketchmaster\'s hold pays your share. Voyages sailed: {n}.', { n }),
  get taken() { return t('ketch.claim.taken', 'You have already taken your share of the Ketchmaster\'s hold this voyage, with another crew. She pays no hand twice a voyage.'); },
});

/** What the account service's answer does to a kept receipt: 'done' (let it go) or 'keep'. */
export function ketchClaimVerdict(answer) {
  if (answer?.ok) return answer.data?.guest === true && answer.data?.recorded !== true && answer.data?.why !== 'taken' && answer.data?.why !== 'claimed' ? 'keep' : 'done';
  return answer?.error === 'receipt' && !KT_CLAIM_MENDABLE.includes(answer.why) ? 'done' : answer?.error === 'not-yours' ? 'done' : 'keep';
}
/** The voyages sailed as the account card says them - "3", "None yet" - or null for no record. */
export function ketchRecordText(rec) {
  if (!rec || typeof rec !== 'object' || !Number.isSafeInteger(rec.sailed) || rec.sailed < 0) return null;
  return rec.sailed > 0 ? String(rec.sailed) : t('ketch.claim.none', 'None yet');
}

/**
 * @param {{
 *   claim: (receipt: string, cid: string) => Promise<any>,
 *   store?: { get: (k: string) => any, set: (k: string, v: any) => void }|null,
 *   nowS?: () => (number|null), nowMs?: () => number, say?: (text: string) => void, me?: () => (string|null),
 *   paid?: (claims: any, answer: any) => void, cid?: () => string,
 * }} deps `claim` net/accountClient.js accountKetch's - `{ ok, data }` or `{ ok: false, error, why? }`, never a throw; `nowS`
 *   the relay's clock (null unheard); `me` the signed-in account; `paid` the hold's share answered - its spoils to roll
 */
export function createKetchClaims({ claim, store = null, nowS = () => Math.floor(Date.now() / 1000), nowMs = () => Date.now(), say = () => {}, me = () => null, paid = () => {}, cid = mintCid }) {
  let busy = false, again = false, lastAt = -Infinity;
  let lastMe, meAt = -Infinity;
  const settled = new Set();
  const live = (r) => { const c = typeof r === 'string' ? readKetchReceipt(r) : null; const t = nowS(); return c && c.signed && (t == null || c.e > t) ? c : null; };
  const entry = (e) => (e && typeof e === 'object' && live(e.r) && typeof e.cid === 'string' && KT_CID_RE.test(e.cid) ? e : null);
  let memory = [];
  /** @returns {Array<{ r: string, cid: string, a?: number }>} */
  function kept() {
    let v;
    try { v = store ? store.get(KT_CLAIMS_KEY) : undefined; } catch { v = undefined; }
    return (Array.isArray(v) ? v : v === undefined ? memory : []).filter((e) => entry(e));
  }
  const keep = (list) => { memory = list; try { store?.set(KT_CLAIMS_KEY, list); } catch { /* memory holds it */ } };

  async function flush() {
    if (busy) { again = true; return 0; }
    busy = true;
    lastAt = nowMs();
    let n = 0;
    try {
      const list = kept();
      keep(list);
      const mine = me();
      for (const e of list) {
        const { r } = e, c = live(r);
        if (!mine || c?.s !== mine) continue;
        let answer;
        try { answer = await claim(r, e.cid); } catch { answer = { ok: false, error: 'offline' }; }
        const d = answer?.ok ? answer.data ?? {} : null;
        if (d?.recorded === true) { n++; if (Number.isSafeInteger(d.sailed)) say(KT_CLAIM_TEXT.recorded(d.sailed)); }
        if (d && d.share === true) {
          if (!kept().find((k) => k.r === r)?.a) { keep(kept().map((k) => (k.r === r ? { ...k, a: 1 } : k))); noteAct('warden-felled'); }   // the act once, kept before it is said
          try { paid(c, d); } catch (err) { console.warn('[kt] spoils', err?.message ?? err); }
        } else if (d && d.why === 'taken') say(KT_CLAIM_TEXT.taken);
        if (ketchClaimVerdict(answer) === 'done') { settled.add(r); keep(kept().filter((k) => k.r !== r)); }
      }
    } finally { busy = false; }
    if (again) { again = false; void flush(); }
    return n;
  }
  return {
    /** A receipt the ship handed this socket: kept (one a voyage and account) and offered at once. Answers whether kept. */
    add(r) {
      const c = live(r);
      if (!c || settled.has(r)) return false;
      const list = kept();
      if (!list.some((k) => { const o = readKetchReceipt(k.r); return k.r === r || (o?.d === c.d && o?.s === c.s && o?.o === c.o); })) {
        const theirs = list.filter((k) => readKetchReceipt(k.r)?.s === c.s);
        const drop = theirs.length >= KT_CLAIMS_MAX ? theirs[0] : null;
        keep([...list.filter((k) => k !== drop), { r, cid: cid() }].slice(-KT_CLAIMS_ALL_MAX));
      }
      void flush();
      return true;
    },
    /** A frame: what is kept offered again once KT_CLAIM_RETRY_MS has passed - and the first frame after another account
     *  signs in. */
    tick() {
      if (busy) return false;
      const t = nowMs(), due = t - lastAt >= KT_CLAIM_RETRY_MS;
      if (!due && t - meAt < KT_ME_POLL_MS) return false;
      meAt = t;
      const mine = me(), signedIn = mine !== lastMe;
      lastMe = mine;
      if (!signedIn && !due) return false;
      if (!kept().some((e) => mine && live(e.r)?.s === mine)) { lastAt = nowMs(); return false; }
      void flush();
      return true;
    },
    flush,
    kept,
  };
}
