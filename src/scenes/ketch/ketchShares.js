// @ts-check
// AUDIT KETCH L2-2, L2-5 (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 9): THE SHARES THE HOLD PAID, ON THIS
// DEVICE. A share the account service pays (net/ketch/ketchClaims.js `paid`) is written to the device's store at once
// (KT_OWED_KEY - its receipt's claims, one a voyage, ship and account) and stays there until the Ketch's spoils pool holds
// it (scenes/spoilsPool.js - its own crash record and spent mark from then on): thrown from the Ketchmaster's chest while
// I stand aboard, else granted to the pack - off the ship, at leaving with the chest unopened, and at the next stand-up
// after a crash or a reload. A share held in memory alone was lost to a reload before the chest (L2-2), and one variable
// held one share, so a second paid in the same flush overwrote the first (L2-5).
//
// The pool's own mark (ONCE A RECEIPT) makes a share given twice one: a crash between the pool taking a share and this
// book letting it go hands it once more, and the pool answers it spent. Pure - the store, the pool and the clocks handed
// in. Not a DFU member. Ledger A (KETCH).
import { ketchSpoilsDay, ketchSpoilsList, KT_SPOILS_TEXT } from '../../systems/ketch/ketchSpoils.js';
import { spoilsLevel, spoilsLock } from '../spoilsPool.js';

/** The device's shares paid and not yet given: `[{ d, o, s, c, l }]` - a receipt's voyage, ship, account, seed, level. */
export const KT_OWED_KEY = 'kt.owed';
/** The most it keeps (a share a voyage, each given as it is paid: a handful at most, with an older one still owed). */
export const KT_SHARES_OWED_MAX = 8;

const owedOk = (e) => !!e && typeof e === 'object' && Number.isSafeInteger(e.d) && typeof e.o === 'string' && typeof e.s === 'string' && Number.isSafeInteger(e.c) && Number.isFinite(e.l);
const same = (a, b) => a.d === b.d && a.o === b.o && a.s === b.s;

/**
 * @param {{
 *   store?: { get: (k: string) => any, set: (k: string, v: any) => void }|null,
 *   pool: { grant: (o: any) => any, spew: (o: any) => boolean },
 *   level: () => number, me: () => (string|null), aboard: () => boolean,
 *   say?: (text: string) => void, changed?: () => void,
 * }} deps `pool` the Ketch's spoils pool; `level` the standing character's; `me` the signed-in account; `aboard` whether I
 *   stand on my ship; `changed` a save asked for once the pack took a share (AUDIT KETCH L3-13)
 */
export function createKetchShares({ store = null, pool, level, me, aboard, say = () => {}, changed = () => {} }) {
  let memory = [];
  /** @returns {Array<{ d: number, o: string, s: string, c: number, l: number }>} */
  function owed() {
    let v;
    try { v = store ? store.get(KT_OWED_KEY) : undefined; } catch { v = undefined; }
    return (Array.isArray(v) ? v : v === undefined || v === null ? memory : []).filter(owedOk);
  }
  const keep = (list) => { memory = list; try { store?.set(KT_OWED_KEY, list); } catch { /* memory holds it */ } };
  const drop = (e) => keep(owed().filter((k) => !same(k, e)));
  const lv = (e) => spoilsLevel(level() ?? 1, e.l);
  const mine = () => { const m = me(); return owed().filter((e) => !m || e.s === m); };
  /** A share into the pack - let go once the pool has it (given, or spent already); a save asked for. */
  function grant(e) {
    return spoilsLock(() => pool.grant({ day: ketchSpoilsDay(e.d, e.o), acct: e.s, roll: () => ketchSpoilsList(e.c, lv(e)), text: KT_SPOILS_TEXT.granted }))
      .then((given) => { drop(e); if (given) changed(); return !!given; })
      .catch((err) => { console.warn('[kt] spoils', err?.message ?? err); return false; });
  }
  return {
    /** The service paid a share (its receipt's claims): kept at once; given now if I stand off the ship. */
    paid(c) {
      const e = { d: c.d, o: c.o, s: c.s, c: c.c, l: c.l };
      if (!owedOk(e)) return false;
      if (!owed().some((k) => same(k, e))) keep([...owed().filter((k) => !same(k, e)), e].slice(-KT_SHARES_OWED_MAX));
      if (!aboard()) void grant(e);
      return true;
    },
    /** The chest pressed: my oldest share thrown from it at `at`, toward `bearing` - else into the pack (no floor to throw
     *  onto). Answers whether there was one. */
    chest(at, bearing) {
      const e = mine()[0];
      if (!e) return false;
      const ok = pool.spew({ day: ketchSpoilsDay(e.d, e.o), seed: e.c, level: lv(e), at, bearing, acct: e.s, roll: () => ketchSpoilsList(e.c, lv(e)) });
      if (ok) { drop(e); say(KT_SPOILS_TEXT.spilled); } else void grant(e);
      return true;
    },
    /** Off the ship, or a stand-up after a crash: every share of mine still owed, into the pack. */
    give() { return Promise.all(mine().map((e) => grant(e))); },
    owed,
  };
}
