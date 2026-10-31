// @ts-check
// ═══════════════════════════════════════════════════════════════════
// RPT1026-MARKET ARRIVE (private reports 2026-10-26: an axe paid for at a trader in a player's home that came nowhere,
// the gold spent all the same; a bow paid for at another player's house that never came; a trader's amulet that was
// neither delivered nor refunded nor back on the stall; a character that could not be deleted with a purchase still owed to it) - WHAT
// THE MARKET SENDS A CHARACTER REACHES ITS PACK ON ITS OWN.
//
// A piece bought from a pack (a trader's stall, the Market tab's Goods) or come back to its seller (taken off a trader,
// cancelled, run out, removed) is a DELIVERY on the service (server-account/src/market.js market_deliveries), and only a
// collect puts it into the record and the pack (net/marketBook.js collectGood). The press collects its own piece on the
// buy's answer - and when that collect did not land (another act of the record under way, a checkpoint still waiting, an
// answer lost) the stall still said "Bought", and the piece waited. Two doors asked again: the Market tab's settle, which
// collects what a read of the road names, and (VENDOR-LOST) a stall's opening settle, which collected only a buy kept
// unanswered. A player who bought at a home's trader and never opened the Market tab never got the piece: 154 deliveries
// stood uncollected for 102 players, 123 of them past a day (68 bought, 55 come back).
//
// So the game reads the road itself (marketBook.road - the service's settle and the road, nothing else) and settles the
// book (marketBook.settle: every kept act asked again with its own id, and every piece that has arrived for THIS
// character collected - one realm act each, the record moved in the collect's own batch and guarded on the delivery, so a
// delivery is collected once whoever asks: a second collect is the service's `market-gone`, and a lost answer asked again
// with the same id is that collect, landed - COLLECT-LANDED). It does so:
//   - as the character's session stands: ARRIVALS_FIRST_MS after the host is made, once `ready` (the checkpoint's own gate:
//     the character spawned, its save the realm's, no duel - so nothing is collected into a pack the boot has not yet
//     restored, nor over a record a checkpoint never reached);
//   - at a courier's arrival - a piece on the road for this character is asked for when the road says it arrives;
//   - when a press's own collect did not land (`soon`), and as a trader's stall opens (the stall's settle is this sweep).
// A sweep the service did not answer is asked again ARRIVALS_AGAIN_MS on, ARRIVALS_TRIES times in a row at most; a market
// shut to the account is asked no more. The pack says what came (marketArrivedText, marketBackText), each piece once.
// Not a DFU member: Daggerfall has no market between players.
// ═══════════════════════════════════════════════════════════════════

import { t } from '../systems/textManager.js';

/** The first sweep, after the host is made (ms) - and how often a sweep not yet `ready` looks again. */
export const ARRIVALS_FIRST_MS = 15_000;
/** How long after a refusal that means "not yet" (offline, the service's own fault, the record busy) a sweep asks again (ms). */
export const ARRIVALS_AGAIN_MS = 60_000;
/** How soon a press whose own collect did not land is swept for (ms). */
export const ARRIVALS_SOON_MS = 10_000;
/** A courier's piece is asked for this long after the road says it arrives (ms) - the two clocks' slack. */
export const ARRIVALS_LATE_MS = 5_000;
/** The longest one wait for a courier (ms): a long road is read again on the way. */
export const ARRIVALS_WAIT_MAX_MS = 30 * 60_000;
/** How many sweeps in a row may meet "not yet" before the sweep waits to be poked (a service that never answers is not
 *  asked every minute of a session). */
export const ARRIVALS_TRIES = 5;
/** The answers a sweep asks again after: no answer, the service's own fault or its rate, no session yet, the record
 *  held by another act or a checkpoint still waiting (realmSaves.js transact's `busy`, `offline`). */
const NOT_YET = Object.freeze([
  'offline',
  'server',
  'rate',
  'no-session',
  'auth',
  'busy',
  'market-busy',
  'held',
  'market-rate',
]);
/** The answers that say the market is not this account's - asked no more this session. */
const SHUT = Object.freeze(['market-closed', 'prof-need-account']);

/** What the pack says of a purchase that came to it by a settle. */
export const marketArrivedText = (/** @type {string} */ name) =>
  t('market.arrived.bought', 'A purchase has arrived: {name} is in your pack.', { name });
/** ...and of a piece of its own come back off the market (taken off a trader, cancelled, run out, removed). */
export const marketBackText = (/** @type {string} */ name) =>
  t('market.arrived.returned', '{name} has come back from the market and is in your pack.', { name });

const defaultLater = (/** @type {() => void} */ fn, /** @type {number} */ ms) => {
  const h = setTimeout(fn, ms);
  /** @type {any} */ (h)?.unref?.(); // a test's process is never held open by a sweep
  return () => clearTimeout(h);
};

/**
 * THE ARRIVALS' SWEEP over the market book (net/marketBook.js createMarketBook). `settle()` the book's settle with the
 * host's mint, put-back and drop (the Market tab's own); `ready()` whether a sweep may act now (the host's checkpoint
 * gate); `later(fn, ms)` a timer answering its cancel; `now()` the shared clock in ms. Answers `{ start, sweep, soon }` -
 * `start()` the first sweep's clock; `sweep()` one sweep now (the road read, then the settle), answering the settle's
 * `{ ok, settled, refused }`, a sweep under way joined; `soon()` a sweep shortly, its tries counted afresh.
 * @param {{ book: any, settle: () => Promise<any>, ready?: () => boolean, later?: (fn: () => void, ms: number) => (() => void), now?: () => number }} o
 */
export function createMarketArrivals({
  book,
  settle,
  ready = () => true,
  later = defaultLater,
  now = () => Date.now(),
}) {
  /** @type {(() => void) | null} */
  let cancel = null;
  /** @type {Promise<any> | null} */
  let sweeping = null;
  let tries = 0,
    shut = false;
  /** AUDIT RPT1026 D1: a `soon` asked while a sweep is under way - that sweep's road may have been read before the press
   *  that asked it, and its own clock (`after`) cancelled the poke's sweep: the press said the piece "will reach it on its
   *  own" and none came this session. Kept, and swept for once the sweep under way ends (Home.md ASYNC NEVER DROPS). */
  let poked = false;
  const schedule = (/** @type {number} */ ms) => {
    cancel?.();
    cancel = later(tick, Math.max(0, Math.round(ms)));
  };
  const me = () => {
    try {
      return book?.me?.() ?? null;
    } catch {
      return null;
    }
  };
  /** This character's pieces on the road - a crafted piece or a piece from a pack, bought or come back. */
  const mine = () =>
    (book?.state?.road ?? []).filter(
      (/** @type {any} */ x) =>
        (x?.kind === 'item' || x?.kind === 'piece') && x.character != null && x.character === me(),
    );

  /** After a sweep: asked again while "not yet" (bounded), at the next courier's arrival, or not at all - the clock is
   *  this sweep's decision, whatever an earlier one had set (a stall's sweep is no tick of it). */
  function after(/** @type {any} */ road, /** @type {any} */ s) {
    cancel?.();
    cancel = null;
    const words = [road?.ok ? null : road?.error, ...(Array.isArray(s?.refused) ? s.refused : [])];
    if (words.some((w) => SHUT.includes(w))) {
      shut = true;
      return;
    }
    const waiting = mine().filter((x) => x.ready).length > 0; // a piece still here after the settle: not collected yet
    if (
      words.some((w) => NOT_YET.includes(w)) ||
      (s?.ok === false && NOT_YET.includes(s?.error)) ||
      (waiting && road?.ok)
    ) {
      if (++tries <= ARRIVALS_TRIES) {
        schedule(ARRIVALS_AGAIN_MS);
        return;
      }
    } else tries = 0;
    const nowS = now() / 1000;
    // AUDIT RPT1026 D2: a piece this clock has past its arrival and the slack while the service's read, just made, still
    // has it on the road is this clock running ahead of the service's - asked again ARRIVALS_AGAIN_MS on. It was asked
    // every ARRIVALS_LATE_MS for the courier's whole road (an hour ahead, a fifteen-minute courier: 181 reads)
    const due = mine()
      .filter((x) => !x.ready && Number.isFinite(Number(x.arrivesAt)))
      .map((x) => (Number(x.arrivesAt) - nowS) * 1000 + ARRIVALS_LATE_MS)
      .map((ms) => (ms > 0 ? ms : ARRIVALS_AGAIN_MS));
    if (due.length && tries <= ARRIVALS_TRIES)
      schedule(Math.min(ARRIVALS_WAIT_MAX_MS, Math.max(ARRIVALS_LATE_MS, Math.min(...due))));
  }

  /** One sweep: the road read (a book without the door - a test's, an older build's - settles what it holds), then the
   *  settle, which collects what arrived for this character and asks every kept act again. Never throws. */
  function sweep() {
    if (sweeping) return sweeping;
    sweeping = (async () => {
      let road = null,
        s = null;
      try {
        road = typeof book?.road === 'function' ? await book.road() : { ok: true };
        s = await settle();
      } catch (e) {
        console.warn("[market] the arrivals' sweep", /** @type {any} */ (e)?.message ?? e);
        s = { ok: false, error: 'server', settled: 0, refused: [] };
      }
      try {
        after(road, s);
      } catch {
        /* a sweep's clock is no reason to fail its answer */
      }
      if (poked && !shut) schedule(ARRIVALS_SOON_MS); // AUDIT RPT1026 D1: the press's sweep, still owed
      poked = false;
      return s ?? { ok: false, error: 'server', settled: 0, refused: [] };
    })().finally(() => {
      sweeping = null;
    });
    return sweeping;
  }

  function tick() {
    cancel = null;
    if (shut) return;
    let go = false;
    try {
      go = ready() === true;
    } catch {
      go = false;
    }
    if (!go) {
      schedule(ARRIVALS_FIRST_MS);
      return;
    } // the boot, a duel, a page put away: looked at again, nothing asked
    void sweep();
  }

  return {
    start() {
      if (!cancel && !shut) schedule(ARRIVALS_FIRST_MS);
    },
    sweep,
    soon() {
      tries = 0;
      if (sweeping) poked = true;
      if (!shut) schedule(ARRIVALS_SOON_MS);
    }, // AUDIT RPT1026 D1: `poked`
  };
}
