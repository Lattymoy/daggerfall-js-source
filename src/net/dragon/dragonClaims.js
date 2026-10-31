// @ts-check
// DRAGON4 (bible/11-Multiplayer/Dwarven-Dragon.md section 8): THE DRAGON RECEIPTS THIS DEVICE CARRIES TO THE ACCOUNT SERVICE -
// the serpent's carrier (net/serpent/serpentClaims.js), rung for rung, on its own keys and its own route. A receipt the cell
// (or the hub, at a hello) hands this socket is kept with the character that fought, its level and this device's claim id
// (`cid`, the hoard's key), and offered to `/v1/dragon/claim` (server-account/src/dragons.js claimDragon) at once and again
// every DRAGON_CLAIM_RETRY_MS while kept. An answer that settles it lets it go; one that does not keeps it. The service
// says when the hoard is THIS claim's (`spoils`) and when the kill tamed a dragon (`tamed`, told at every answer while its
// row stands, so a lost one is told again). Pure - the call, the store and the clocks are handed in. Ledger A (DRAGON).
import { t } from '../../systems/textManager.js'; // AUDIT DRAGON: the card's row in the player's language
import { readDragonReceipt } from './dragonReceipt.js';
import { DRAGON_CLAIM_TEXT } from '../../systems/dragon/dragonWords.js';
import { noteAct } from '../../systems/questlines/qlActs.js';

/** The device's receipts not yet settled: `[{ r, ch, nm, lv, cid }]`; those settled - `watch|place|account` (DRAGON-EACH) - never claimed again. */
export const DRAGON_CLAIMS_KEY = 'dragon4.claims';
export const DRAGON_SETTLED_KEY = 'dragon4.settled';
export const DRAGON_SETTLED_MAX = 32;
export const DRAGON_CLAIMS_MAX = 24;
/** A claim id - sixteen hex digits, the service's DRAGON_CID_RE. */
export const DRAGON_CID_RE = /^[0-9a-f]{16}$/;
/** The least time between two offers of what is kept, and how often a frame asks who is signed in (ms). */
export const DRAGON_CLAIM_RETRY_MS = 10 * 60 * 1000;
export const DRAGON_ME_POLL_MS = 1000;
/** The refusals of a receipt the service can mend (the serpent's SERPENT_CLAIM_MENDABLE): kept for the week it carries. */
export const DRAGON_CLAIM_MENDABLE = Object.freeze(['signature', 'verify-threw', 'future', 'clock']);
const mintCid = () => {
  const b = new Uint8Array(8);
  globalThis.crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
};
const settledKeyOf = (c) => (c.p === undefined ? `${c.q}|${c.s}` : `${c.q}|${c.p}|${c.s}`); // DRAGON-EACH: one a dragon; a receipt from before it, one a watch

/** What the service's answer does to a kept receipt: 'done' (let it go) or 'keep'. */
export function dragonClaimVerdict(answer) {
  if (answer?.ok) return answer.data?.why === 'guest' ? 'keep' : 'done';
  if (answer?.error === 'renown-character') return 'done'; // no character to keep it for - it never will be
  return answer?.error === 'receipt' && !DRAGON_CLAIM_MENDABLE.includes(answer.why) ? 'done' : 'keep';
}

/**
 * @param {{ claim: (receipt: string, character: string, name: string|null, cid: string) => Promise<any>,
 *   store?: { get: (k: string) => any, set: (k: string, v: any) => void }|null, nowS?: () => (number|null), nowMs?: () => number,
 *   say?: (text: string) => void, onSpoils?: (entry: any, data: any) => (void|Promise<any>), onTamed?: (tame: any, entry: any) => void,
 *   me?: () => (string|null), cid?: () => string }} deps `claim` net/accountClient.js accountDragons' - `{ ok, data }` or
 *   `{ ok: false, error, why? }`, never a throw
 */
export function createDragonClaims({
  claim,
  store = null,
  nowS = () => Math.floor(Date.now() / 1000),
  nowMs = () => Date.now(),
  say = () => {},
  onSpoils = () => {},
  onTamed = () => {},
  me = () => null,
  cid = mintCid,
}) {
  let busy = false,
    again = false,
    lastAt = -Infinity,
    lastMe,
    meAt = -Infinity,
    memory = [];
  const settled = new Set(),
    guestSaid = new Set(),
    tamedSaid = new Set();
  const live = (r) => {
    const c = typeof r === 'string' ? readDragonReceipt(r) : null;
    const t = nowS();
    return c && c.signed && (t == null || c.e > t) ? c : null;
  };
  const entry = (e) =>
    e &&
    typeof e === 'object' &&
    live(e.r) &&
    typeof e.ch === 'string' &&
    e.ch &&
    typeof e.cid === 'string' &&
    DRAGON_CID_RE.test(e.cid)
      ? e
      : null;
  const read = (k) => {
    try {
      return store ? store.get(k) : undefined;
    } catch {
      return undefined;
    }
  };
  const settledHere = () => {
    const v = read(DRAGON_SETTLED_KEY);
    return Array.isArray(v) ? v.filter((k) => typeof k === 'string') : [];
  };
  const markSettled = (c) => {
    if (!c) return;
    const list = settledHere().filter((k) => k !== settledKeyOf(c));
    try {
      store?.set(DRAGON_SETTLED_KEY, [...list, settledKeyOf(c)].slice(-DRAGON_SETTLED_MAX));
    } catch {
      /* the session's own set holds it */
    }
  };
  const kept = () => {
    const v = read(DRAGON_CLAIMS_KEY);
    return (Array.isArray(v) ? v : v === undefined ? memory : []).filter((e) => entry(e));
  };
  const keep = (list) => {
    memory = list;
    try {
      store?.set(DRAGON_CLAIMS_KEY, list);
    } catch {
      /* memory holds it */
    }
  };
  /** A hook that throws is the page's, never the carrier's; the hoard's grant is awaited, and one that fails keeps its receipt. */
  const hear = (fn, ...args) => {
    try {
      fn(...args);
    } catch (e) {
      console.warn('[dragon] claim hook', e?.message ?? e);
    }
  };
  const granted = async (fn, ...args) => {
    try {
      await fn(...args);
      return true;
    } catch (e) {
      console.warn('[dragon] claim hook', e?.message ?? e);
      return false;
    }
  };

  async function flush() {
    if (busy) {
      again = true;
      return 0;
    }
    busy = true;
    lastAt = nowMs();
    let recorded = 0;
    try {
      const list = kept();
      keep(list);
      const mine = me();
      for (const e of list) {
        if (!mine || live(e.r)?.s !== mine) continue;
        let answer;
        try {
          answer = await claim(e.r, e.ch, e.nm ?? null, e.cid);
        } catch {
          answer = { ok: false, error: 'offline' };
        }
        const given = answer?.ok && answer.data?.spoils === true ? await granted(onSpoils, e, answer.data) : true;
        const tame = answer?.ok ? answer.data?.tamed : null;
        if (tame && typeof tame.id === 'string' && !tamedSaid.has(tame.id)) {
          tamedSaid.add(tame.id);
          say(DRAGON_CLAIM_TEXT.tamed());
          hear(onTamed, tame, e);
        }
        if (answer?.ok && answer.data?.recorded === true) {
          recorded++;
          noteAct('dragon-slain');
          if (Number.isSafeInteger(answer.data.slain)) say(DRAGON_CLAIM_TEXT.recorded(answer.data.slain));
        } else if (answer?.ok && answer.data?.why === 'guest' && !guestSaid.has(e.r)) {
          guestSaid.add(e.r);
          say(DRAGON_CLAIM_TEXT.guest());
        }
        if (given && dragonClaimVerdict(answer) === 'done') {
          settled.add(e.r);
          markSettled(live(e.r));
          keep(kept().filter((k) => k.r !== e.r));
        }
      }
    } finally {
      busy = false;
    }
    if (again) {
      again = false;
      void flush();
    }
    return recorded;
  }

  return {
    /** A receipt the relay handed this socket, with the character that fought it and its level: kept (one a dragon AND
     *  account; never one this device settled) and offered at once. Answers whether it is kept. */
    add(r, character, name = null, level = 1) {
      const c = live(r);
      if (
        !c ||
        settled.has(r) ||
        settledHere().includes(settledKeyOf(c)) ||
        typeof character !== 'string' ||
        !character
      )
        return false;
      const list = kept();
      if (
        !list.some((k) => {
          const o = readDragonReceipt(k.r);
          return k.r === r || (o?.q === c.q && o?.p === c.p && o?.s === c.s);
        })
      ) {
        keep(
          [
            ...list,
            {
              r,
              ch: character,
              nm: typeof name === 'string' ? name : null,
              lv: Math.max(1, Math.floor(Number(level) || 1)),
              cid: cid(),
            },
          ].slice(-DRAGON_CLAIMS_MAX),
        );
      }
      void flush();
      return true;
    },
    /** A frame: what is kept is offered again in its time, and at once when another account signs in. */
    tick() {
      if (busy) return false;
      const t = nowMs(),
        due = t - lastAt >= DRAGON_CLAIM_RETRY_MS;
      if (!due && t - meAt < DRAGON_ME_POLL_MS) return false;
      meAt = t;
      const mine = me(),
        signedIn = mine !== lastMe;
      lastMe = mine;
      if (!signedIn && !due) return false;
      if (!kept().some((e) => mine && live(e.r)?.s === mine)) {
        lastAt = nowMs();
        return false;
      }
      void flush();
      return true;
    },
    flush,
    kept,
  };
}
/** AUDIT DRAGON: the dragons slain as the account card's row says it (the serpent's serpentRecordText): a count, none yet, or
 *  null for a service from before it. @param {any} rec */
export function dragonRecordText(rec) {
  if (!rec || typeof rec !== 'object' || !Number.isSafeInteger(rec.slain) || rec.slain < 0) return null;
  return rec.slain > 0 ? String(rec.slain) : t('dragon.card.none', 'None yet');
}
