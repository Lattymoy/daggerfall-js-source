// @ts-check
// CARDS6 (2026-10-08, Mac: "#2"; bible/11-Multiplayer/Tavern-Cards.md section 23): A REALM CHARACTER'S STAKES, ON THE
// DEVICE. The service holds a gold table's buy-in (server-account/src/cards.js) and the relay hands back what the seat
// left with (net/cardReceipt.js); this book carries the two between them, keeping each on the device until it is
// settled, as the arena's claims are kept (net/arenaClaims.js):
//
//   STAKE: the buy-in asked of the service as the record's own act (systems/realmSaves.js realmGoldAct - the purse
//     checkpointed, the gold held out of it while asked); its request KEPT first (a lost answer is asked again by the
//     same request id, and the service answers the same stake), and its order kept till the relay sits it.
//   RECEIPT: each cash-out the relay hands over kept (the host tells the relay it is held - `ack`), and CLAIMED as the
//     record's act: the gold the service answers it paid, into the region's account the record was paid into.
//   VOID: a stake the relay never sat (its order past its minute, the sit never sent or never heard) - its order handed
//     to the room it names (`void`), whose receipt gives the whole stake back.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { readCardReceipt } from './cardReceipt.js';
import { ORDER_TTL_S } from './identityToken.js';

/** The device's stakes and receipts not yet settled. */
export const CARD_STAKES_KEY = 'cards6.stakes';
export const CARD_RECEIPTS_KEY = 'cards6.receipts';
/** The most of each the device keeps; the oldest go first past it. */
export const CARD_KEPT_MAX = 32;
/** A stake whose order this many ms old was never sat on is voided back (its order's minute, and some). */
export const CARD_VOID_AFTER_MS = (ORDER_TTL_S + 10) * 1000;
/** The service's answers that end a kept receipt without paying it - it never will. */
export const CARD_CLAIM_DONE = Object.freeze(['cards-not-yours', 'cards-no-stake']);

/** A stake request's id - the service's CARDS_RID_RE: one asked twice is one stake. */
export const mintCardRid = (rand = Math.random) => `card-${Array.from({ length: 20 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(rand() * 36)]).join('')}`;

/**
 * @param {{
 *   door: { stake: (req: any) => Promise<any>, cashout: (req: any) => Promise<any> },
 *   realm: { act: (o: any) => Promise<any> } | null,
 *   wallet: ((region: number) => { gold: () => number, pay: (n: number) => (() => void), bank: (n: number) => void }) | null,
 *   character: () => (string|null), region: () => number,
 *   storage?: { get: (k: string) => any, set: (k: string, v: any) => void } | null,
 *   now?: () => number, rand?: () => number,
 * }} deps
 */
export function createCardStakes({ door, realm, wallet, character, region, storage = null, now = () => Date.now(), rand = Math.random }) {
  const read = (k) => { try { const v = storage?.get(k); return Array.isArray(v) ? v : []; } catch { return []; } };
  const write = (k, v) => { try { storage?.set(k, v.slice(-CARD_KEPT_MAX)); } catch { /* the device keeps nothing: the room still owes */ } };
  let claiming = null;
  const book = {
    /** Whether this character plays for gold online - a realm character's (its gold is its record's). */
    goldOk: () => !!(realm && wallet && character()),
    /** The gold the record can stake at `region`, or null. */
    purse() { try { return realm && wallet ? wallet(region()).gold() : null; } catch { return null; } },
    /**
     * STAKE `amount` for table `table` of room `room` at big blind `bb`: `{ ok, stake, id }` - `stake` the order the sit
     * carries - or `{ ok: false, error }`. A lost answer is `offline`, its request kept to be asked again (`recover`).
     * @param {{room: string, table: number, bb: number, amount: number}} p
     */
    async stake({ room, table, bb, amount }) {
      if (!book.goldOk()) return { ok: false, error: 'cards-realm' };
      const c = character(), reg = region(), rid = mintCardRid(rand);
      write(CARD_STAKES_KEY, [...read(CARD_STAKES_KEY), { rid, room, table, bb, amount, c, reg, at: now() }]);
      const r = await ask({ rid, room, table, bb, amount, c, reg }, true);
      if (r?.ok) return { ok: true, stake: r.data.stake, id: r.data.id };
      if (!r?.unknown) write(CARD_STAKES_KEY, read(CARD_STAKES_KEY).filter((x) => x.rid !== rid));   // refused: nothing held
      return { ok: false, error: r?.error ?? 'offline' };
    },
    /** The relay sat this stake: nothing of it to keep but the receipt to come. */
    seated(id) { write(CARD_STAKES_KEY, read(CARD_STAKES_KEY).filter((x) => x.id !== id)); },
    /** The stakes of room `room` whose orders the relay never sat - each `{ table, order, id }` to be voided there. A lost
     *  answer's request is asked again first (`recover`), so its order can be. */
    voidable(room) {
      const t = now();
      return read(CARD_STAKES_KEY).filter((x) => x.room === room && x.order && t - x.at >= CARD_VOID_AFTER_MS && !(x.voided > t - 60_000)).map((x) => ({ table: x.table, order: x.order, id: x.id }));
    },
    /** A void said for `id` - not said again for a minute. */
    voiding(id) { write(CARD_STAKES_KEY, read(CARD_STAKES_KEY).map((x) => (x.id === id ? { ...x, voided: now() } : x))); },
    /** The kept requests whose answer was lost, asked again (the same request id: the same stake, no gold twice). */
    async recover() {
      for (const x of read(CARD_STAKES_KEY).filter((y) => !y.order && y.c === character())) {
        const r = await ask(x, false);
        if (r && !r.ok && !r.unknown) write(CARD_STAKES_KEY, read(CARD_STAKES_KEY).filter((y) => y.rid !== x.rid));
      }
    },
    /**
     * A cash-out the relay handed over, kept (and its stake let go): the stake's id, for the host's `ack` - or null for
     * anything that is no receipt of this account's stakes.
     * @param {unknown} receipt
     */
    receive(receipt) {
      const c = readCardReceipt(receipt);
      if (!c) return null;
      const kept = read(CARD_RECEIPTS_KEY);
      const stake = read(CARD_STAKES_KEY).find((x) => x.id === c.j);
      if (!kept.some((x) => x.j === c.j)) write(CARD_RECEIPTS_KEY, [...kept, { j: c.j, receipt, c: stake?.c ?? character(), reg: stake?.reg ?? region() }]);
      if (stake) write(CARD_STAKES_KEY, read(CARD_STAKES_KEY).filter((x) => x.id !== c.j));
      return c.j;
    },
    /** Every kept receipt of this character's claimed - the gold the service paid into the record's account at the
     *  region it was staked in. One claim at a time. */
    claim() {
      claiming ??= (async () => {
        try {
          for (const k of read(CARD_RECEIPTS_KEY).filter((x) => x.c === character())) {
            if (!realm || !wallet) break;
            const r = await realm.act({
              needsAnswer: true,
              apply: (/** @type {any} */ a) => { const g = a?.data?.gold; if (!a?.data?.repeat && Number.isSafeInteger(g) && g > 0) wallet(k.reg).bank(g); },
              call: (/** @type {any} */ at) => door.cashout({ character: k.c, realm: at, region: k.reg, receipt: k.receipt }),
            });
            if (r?.ok || CARD_CLAIM_DONE.includes(r?.error) || (r?.error === 'cards-receipt' && r?.why !== 'signature')) write(CARD_RECEIPTS_KEY, read(CARD_RECEIPTS_KEY).filter((x) => x.j !== k.j));
          }
        } finally { claiming = null; }
      })();
      return claiming;
    },
    /** What the device keeps: the stakes not yet settled and the receipts not yet claimed. */
    kept: () => ({ stakes: read(CARD_STAKES_KEY), receipts: read(CARD_RECEIPTS_KEY) }),
  };
  /** The stake asked as the record's act - the purse's gold held out while it is (`reserve`) on a first asking; the kept
   *  request given its order and id when the answer comes. */
  async function ask(x, first) {
    if (!realm || !wallet) return { ok: false, error: 'cards-realm' };
    const r = await realm.act({
      needsAnswer: true,
      ...(first ? { reserve: () => wallet(x.reg).pay(x.amount) } : {}),
      call: (/** @type {any} */ at) => door.stake({ character: x.c, realm: at, region: x.reg, room: x.room, table: x.table, bb: x.bb, amount: x.amount, rid: x.rid }),
    });
    if (r?.ok && r.data?.stake) write(CARD_STAKES_KEY, read(CARD_STAKES_KEY).map((y) => (y.rid === x.rid ? { ...y, order: r.data.stake, id: r.data.id, at: now() } : y)));
    return r;
  }
  return book;
}
