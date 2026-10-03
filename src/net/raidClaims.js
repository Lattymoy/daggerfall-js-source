// @ts-check
// RAID4 (2026-09-28, Mac on World Events - Raiding Parties online: "3. We can also add renown and it's own atheric +
// armor sets"): THE RAID RECEIPTS THIS DEVICE CARRIES TO THE ACCOUNT SERVICE, and the towns defended as the cards say
// them. The gate's carrier's twin (net/gateClaims.js), rung for rung. Design: bible/03-World/Raiding-Parties.md,
// "The rewards (RAID4)".
//
// THE RELAY SIGNS, THE ACCOUNT SERVICE COUNTS AND PAYS, THIS FILE CARRIES. A receipt the relay hands this socket at a
// town's cleanse (systems/raidingParties.js raidRelayWord's `rc`, the same one again after a reconnect) is kept on the
// device (RAID_CLAIMS_KEY) WITH THE CHARACTER THAT FOUGHT IT - the service pays that character its Renown - and offered
// to the account service (`/v1/raid/claim` - server-account/src/raids.js claimRaid) at once, and again while it is
// kept, at most every RAID_CLAIM_RETRY_MS. An answer that SETTLES it lets it go: counted (its Renown handed to the page,
// `onRecorded`), counted before, the day's raids already counted, not a receipt the relay signed, no character to pay.
// One that does not keeps it: no session yet, the service without its public half, a guest who may still register,
// the network, and a refusal the SERVICE can mend (its public half not the relay's pair, a clock off - the gate's
// AUDIT WB A5). An expired receipt is let go unasked - expired by the RELAY's clock (AUDIT ONLINE2 F2: the device's
// ran a week ahead and every receipt was let go unasked, its Renown never counted; with no relay clock heard it is kept,
// and the service judges it); an UNSIGNED one (a relay with no key) is never kept.
//
// THE DEVICE IS NOT THE ACCOUNT (AUDIT WB A9's law): only the signed-in account's receipts are offered (`me`).
//
// AUDIT RAID R4 (2026-09-28): A TOWN'S THANKS ARE THE SERVICE'S WORD. They were rolled the moment a receipt came, once
// a receipt and DEVICE - and the relay hands an account's receipt to every socket of it (the hub now to every hello
// for a day), so a second browser or a phone rolled them again. Each kept receipt carries this device's claim id
// (`cid`) and the level and character that fought it; the service writes the (raid, account)'s thanks row for the
// first claim that asks, a guest's too, and answers `spoils: true` to that claim alone - `onSpoils` hears it, and the
// page gives the thanks. A receipt this device has SETTLED is remembered (RAID_SETTLED_KEY), so a hub's hello that
// hands it again asks the service nothing. A hook that throws is kept from the carrier (R8e).
//
// Pure - the call, the store and the clocks are handed in - so the pins drive it without a network.
//
// Not a DFU member. Ledger A (RAID1's row).
import { readRaidReceipt } from './raidReceipt.js';

/** The device's raid receipts not yet settled with the account service: `[{ r, ch, nm, lv, cid }]` - the receipt, the
 *  character that fought it, its name, its level (AUDIT RAID R4: the thanks roll at it), and this device's claim id. */
export const RAID_CLAIMS_KEY = 'raid4.raidClaims';
/** AUDIT RAID R4: the receipts this device has settled with the service - `raid|account` - never claimed again. */
export const RAID_SETTLED_KEY = 'raid4.raidSettled';
export const RAID_SETTLED_MAX = 64;
/** AUDIT RAID R4: a claim id - sixteen hex digits, the service's RAID_CID_RE. */
export const RAID_CID_RE = /^[0-9a-f]{16}$/;
const mintCid = () => { const b = new Uint8Array(8); globalThis.crypto.getRandomValues(b); return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); };
/** A receipt's settled key - its raid and account. */
const settledKeyOf = (c) => `${c.w}|${c.s}`;
/** The most it keeps - a few days of raids; the oldest go first past this. */
export const RAID_CLAIMS_MAX = 24;
/** The least time between two offers of what is kept, ms. */
export const RAID_CLAIM_RETRY_MS = 10 * 60 * 1000;
/** How often a frame asks who is signed in (AUDIT WBX W4's law). */
export const RAID_ME_POLL_MS = 1000;

/** The words. */
export const RAID_CLAIM_TEXT = Object.freeze({
  recorded: (n, xp) => `The town will remember you. Towns defended: ${n}.${xp > 0 ? ` +${xp} Renown XP.` : ''}`,
  guest: 'This town is not on your record yet: only registered accounts keep one. Add a username this week and it counts.',
  dayFull: 'You have been counted for every raid one day allows.',
});

/** The refusals of a receipt the service can mend (the gate's GATE_CLAIM_MENDABLE): kept for the week it carries. */
export const RAID_CLAIM_MENDABLE = Object.freeze(['signature', 'verify-threw', 'future', 'clock']);

/** What the account service's answer does to a kept receipt: 'done' (let it go) or 'keep'. */
export function raidClaimVerdict(answer) {
  if (answer?.ok) return answer.data?.why === 'guest' ? 'keep' : 'done';   // counted, counted before, the day full
  if (answer?.error === 'renown-character') return 'done';   // no character to pay - it never will be
  return answer?.error === 'receipt' && !RAID_CLAIM_MENDABLE.includes(answer.why) ? 'done' : 'keep';
}

/** The towns defended as the account card says them - "3", "None yet" - or null for no record. */
export function raidRecordText(rec) {
  if (!rec || typeof rec !== 'object' || !Number.isSafeInteger(rec.defended) || rec.defended < 0) return null;
  return rec.defended > 0 ? String(rec.defended) : 'None yet';
}

/**
 * @param {{
 *   claim: (receipt: string, character: string, name: string|null, cid: string) => Promise<any>,
 *   store?: { get: (k: string) => any, set: (k: string, v: any) => void }|null,
 *   nowS?: () => (number|null), nowMs?: () => number, say?: (text: string) => void,
 *   onRecorded?: (data: any, entry: { r: string, ch: string, nm: string|null, lv: number, cid: string }) => void,
 *   onSpoils?: (entry: { r: string, ch: string, nm: string|null, lv: number, cid: string }, data: any) => void,
 *   onMarks?: (data: any) => (string|string[]|null),
 *   me?: () => (string|null), cid?: () => string,
 * }} deps `claim` is net/accountClient.js accountRaids' - `{ ok, data }` or `{ ok: false, error, why? }`, never a
 *   throw; `me` the signed-in account's id; `onRecorded` hears each counted receipt's answer (its Renown and order);
 *   `onSpoils` (AUDIT RAID R4) each receipt whose town's thanks the service gave THIS claim; `onMarks` (SILVER-WAYS) the
 *   silver lines a counted claim's answer says (net/marksBook.js claimLines)
 */
export function createRaidClaims({ claim, store = null, nowS = () => Math.floor(Date.now() / 1000), nowMs = () => Date.now(), say = () => {}, onRecorded = () => {}, onSpoils = () => {}, onMarks = () => null, me = () => null, cid = mintCid }) {
  let busy = false, again = false, lastAt = -Infinity;
  let lastMe, meAt = -Infinity;
  const settled = new Set(), guestSaid = new Set();
  let dayFullSaid = false;
  const live = (r) => { const c = typeof r === 'string' ? readRaidReceipt(r) : null; const t = nowS(); return c && c.signed && (t == null || c.e > t) ? c : null; };   // AUDIT ONLINE2 F2: `nowS` the relay's clock, null unheard
  const entry = (e) => (e && typeof e === 'object' && live(e.r) && typeof e.ch === 'string' && e.ch && typeof e.cid === 'string' && RAID_CID_RE.test(e.cid) ? e : null);
  /** AUDIT RAID R4: the device's settled receipts, and one more */
  const settledHere = () => { let v; try { v = store ? store.get(RAID_SETTLED_KEY) : undefined; } catch { v = undefined; } return Array.isArray(v) ? v.filter((k) => typeof k === 'string') : []; };
  const markSettled = (c) => { if (!c) return; const list = settledHere().filter((k) => k !== settledKeyOf(c)); try { store?.set(RAID_SETTLED_KEY, [...list, settledKeyOf(c)].slice(-RAID_SETTLED_MAX)); } catch { /* the session's own set holds it */ } };
  /** R8e: a page's hook that throws is the page's - never the carrier's (it left the receipt unsettled, and the next
   *  offer was answered "claimed") */
  const hear = (fn, ...args) => { try { fn(...args); } catch (e) { console.warn('[raid] claim hook', e?.message ?? e); } };
  let memory = [];
  function kept() {
    let v;
    try { v = store ? store.get(RAID_CLAIMS_KEY) : undefined; } catch { v = undefined; }
    return (Array.isArray(v) ? v : v === undefined ? memory : []).filter((e) => entry(e));
  }
  const keep = (list) => { memory = list; try { store?.set(RAID_CLAIMS_KEY, list); } catch { /* memory holds it */ } };

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
        if (answer?.ok && answer.data?.spoils === true) hear(onSpoils, e, answer.data);   // AUDIT RAID R4: the thanks, this claim's
        if (answer?.ok && answer.data?.recorded === true) {
          recorded++;
          const n = Number.isSafeInteger(answer.data.defended) ? answer.data.defended : null;
          const xp = Number.isSafeInteger(answer.data.renown?.credited) ? answer.data.renown.credited : 0;
          if (n != null) say(RAID_CLAIM_TEXT.recorded(n, xp));
          // SILVER-WAYS: the town's silver, the guild's deed and the contracts that paid - the host's lines for them
          let lines = null;
          try { lines = onMarks(answer.data); } catch (err) { console.warn('[raid] silver lines', err?.message ?? err); }
          for (const line of Array.isArray(lines) ? lines : [lines]) if (typeof line === 'string' && line) say(line);
          hear(onRecorded, answer.data, e);
        } else if (answer?.ok && answer.data?.why === 'guest' && !guestSaid.has(e.r)) {
          guestSaid.add(e.r);
          say(RAID_CLAIM_TEXT.guest);
        } else if (answer?.ok && answer.data?.why === 'day-full' && !dayFullSaid) {
          dayFullSaid = true;
          say(RAID_CLAIM_TEXT.dayFull);
        }
        if (raidClaimVerdict(answer) === 'done') { settled.add(e.r); markSettled(live(e.r)); keep(kept().filter((k) => k.r !== e.r)); }
      }
    } finally { busy = false; }
    if (again) { again = false; void flush(); }
    return recorded;
  }

  return {
    /** A receipt the relay handed this socket, with the character that fought it and its level: kept (one a raid AND
     *  account - the relay re-sends the same one; AUDIT RAID R4: never one this device settled) and offered at once.
     *  Answers whether it is kept. */
    add(r, character, name = null, level = 1) {
      const c = live(r);
      if (!c || settled.has(r) || settledHere().includes(settledKeyOf(c)) || typeof character !== 'string' || !character) return false;
      const list = kept();
      if (!list.some((k) => { const o = readRaidReceipt(k.r); return k.r === r || (o?.w === c.w && o?.s === c.s); })) {
        const lv = Math.max(1, Math.floor(Number(level) || 1));
        keep([...list, { r, ch: character, nm: typeof name === 'string' ? name : null, lv, cid: cid() }].slice(-RAID_CLAIMS_MAX));
      }
      void flush();
      return true;
    },
    /** A frame: what is kept is offered again once RAID_CLAIM_RETRY_MS has passed since the last offer - the first frame
     *  of a session at once, and the first after another account signs in. */
    tick() {
      if (busy) return false;
      const t = nowMs(), due = t - lastAt >= RAID_CLAIM_RETRY_MS;
      if (!due && t - meAt < RAID_ME_POLL_MS) return false;
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
