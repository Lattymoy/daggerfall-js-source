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
import { readCardReceipt, CARD_RECEIPT_TTL_S } from './cardReceipt.js';
import { ORDER_TTL_S } from './identityToken.js';

/** The device's stakes and receipts not yet settled. */
export const CARD_STAKES_KEY = 'cards6.stakes';
export const CARD_RECEIPTS_KEY = 'cards6.receipts';
/** The most of each the device keeps. AUDIT CARDS-4 C6: past it a sat stake goes first (only a note of where gold is
 *  owed), a receipt never - one the device cannot keep is not acked, and the room keeps owing it. */
export const CARD_KEPT_MAX = 64;
/** AUDIT CARDS-4 C6: how long a stake is kept - the relay voids an order no older (server/src/index.js
 *  HOLDEM_STAKE_VOID_S) and owes a cash-out no longer; past it nothing the device holds can bring it home. */
export const CARD_STAKE_KEEP_MS = CARD_RECEIPT_TTL_S * 1000;
/** A stake whose order this many ms old was never sat on is voided back (its order's minute, and some). */
export const CARD_VOID_AFTER_MS = (ORDER_TTL_S + 10) * 1000;
/** The service's answers that end a kept receipt without paying it - it never will. */
export const CARD_CLAIM_DONE = Object.freeze(['cards-not-yours', 'cards-no-stake']);
/** AUDIT CARDS-4 A4/A5: a receipt the service refused for what it IS (its shape, its sum, no signature) - never payable;
 *  one refused on its signature, its clock or the service's own trouble is kept (a key rotating, a clock behind). */
export const CARD_RECEIPT_DEAD = Object.freeze(['shape', 'version', 'unsigned', 'sig-shape', 'body-shape', 'json', 'claims', 'sum']);
/** AUDIT CARDS-4 C2: the service's own refusals of a stake - asked, and refused: nothing held. Every other word (the
 *  session's own `offline`, `busy`, `held`, a lost answer, the session gone) may never have reached it - kept. */
export const cardStakeRefused = (e) => typeof e === 'string' && (e.startsWith('cards-') || e.startsWith('bad-') || e === 'realm-gold');

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
  /** AUDIT CARDS-4 C6: past the bound, a stake list drops its sat stakes first, oldest first; a receipt list never drops
   *  one kept - the newest is not kept (and so not acked: the room still owes it). */
  const fit = (k, v) => {
    if (v.length <= CARD_KEPT_MAX) return v;
    if (k === CARD_RECEIPTS_KEY) return v.slice(0, CARD_KEPT_MAX);
    const out = [...v];
    while (out.length > CARD_KEPT_MAX) { const i = out.findIndex((x) => x.sat); out.splice(i >= 0 ? i : 0, 1); }
    return out;
  };
  const write = (k, v) => { try { storage?.set(k, fit(k, v)); } catch { /* the device keeps nothing: the room still owes */ } };
  let claiming = null;
  const book = {
    /** Whether this character plays for gold online - a realm character's (its gold is its record's). */
    goldOk: () => !!(realm && wallet && character()),
    /** The gold the record can stake at `region`, or null. */
    purse() { try { return realm && wallet ? wallet(region()).gold() : null; } catch { return null; } },
    /**
     * STAKE `amount` for table `table` of room `room` at big blind `bb`: `{ ok, stake, id }` - `stake` the order the sit
     * carries - or `{ ok: false, error }`. A lost answer is `offline`, its request kept to be asked again (`recover`).
     * `topup`: a seated player's addition (Tavern-Cards section 24) - its order shown in a `topup` word, settled by the
     * room's 'joined' receipt; `place` the words for where it was staked (`elsewhere`).
     * @param {{room: string, table: number, bb: number, amount: number, topup?: boolean, place?: string}} p
     */
    async stake({ room, table, bb, amount, topup = false, place = '' }) {
      if (!book.goldOk()) return { ok: false, error: 'cards-realm' };
      const c = character(), reg = region(), rid = mintCardRid(rand);
      book.prune();
      // AUDIT CARDS-4 C6: a request the device cannot keep is never asked - a lost answer would leave nothing to void it
      if (read(CARD_STAKES_KEY).filter((x) => !x.sat).length >= CARD_KEPT_MAX) return { ok: false, error: 'cards-kept-full' };
      write(CARD_STAKES_KEY, [...read(CARD_STAKES_KEY), { rid, room, table, bb, amount, c, reg, at: now(), ...(topup ? { topup: true } : {}), ...(place ? { place: String(place).slice(0, 80) } : {}) }]);
      if (!read(CARD_STAKES_KEY).some((x) => x.rid === rid)) return { ok: false, error: 'cards-kept-full' };
      const r = await ask({ rid, room, table, bb, amount, c, reg, topup }, true);
      if (r?.ok) return { ok: true, stake: r.data.stake, id: r.data.id };
      if (!r?.unknown) write(CARD_STAKES_KEY, read(CARD_STAKES_KEY).filter((x) => x.rid !== rid));   // refused, or never asked: nothing held
      return { ok: false, error: r?.error ?? 'offline', unknown: !!r?.unknown };   // AUDIT CARDS-4 C7: a lost answer said as one
    },
    /** The relay sat this stake: never voided now, but KEPT (AUDIT CARDS-4 C4) - whose it is and where it was staked
     *  from, for the receipt to come, and where gold is owed (`owed`). */
    seated(id) { write(CARD_STAKES_KEY, read(CARD_STAKES_KEY).map((x) => (x.id === id ? { ...x, sat: true } : x))); },
    /** CARDS6 follow-up (AUDIT CARDS-4 C6): the rooms where a cash-out is still owed this character - each sat stake whose
     *  receipt the device has not heard, `{ room, amount, at }`. Only that room hands it over. */
    owed() { return read(CARD_STAKES_KEY).filter((x) => x.sat && x.c === character()).map((x) => ({ room: x.room, amount: x.amount, at: x.at })); },
    /** CARDS6 follow-up (section 24): this character's gold at card tables in rooms other than `room` - a seat's stake
     *  whose cash-out that room still owes, or a stake never sat that only that room voids back - `{ room, place, amount
     *  }` each. Only there is it handed over. */
    elsewhere(room) { return read(CARD_STAKES_KEY).filter((x) => x.room !== room && x.c === character() && (x.sat || x.order)).map((x) => ({ room: x.room, place: x.place ?? '', amount: x.amount })); },
    /** AUDIT CARDS-4 C6: stakes past what anything can bring home let go (the relay neither voids nor owes them now). */
    prune() {
      const t = now(), kept = read(CARD_STAKES_KEY), left = kept.filter((x) => !(t - x.at > CARD_STAKE_KEEP_MS));
      if (left.length !== kept.length) write(CARD_STAKES_KEY, left);
    },
    /** The stakes of room `room` whose orders the relay never sat - each `{ table, order, id }` to be voided there. A lost
     *  answer's request is asked again first (`recover`), so its order can be. */
    voidable(room) {
      const t = now();
      return read(CARD_STAKES_KEY).filter((x) => x.room === room && x.order && !x.sat && t - x.at >= CARD_VOID_AFTER_MS && !(x.voided > t - 60_000)).map((x) => ({ table: x.table, order: x.order, id: x.id }));
    },
    /** A void said for `id` - not said again for a minute. */
    voiding(id) { write(CARD_STAKES_KEY, read(CARD_STAKES_KEY).map((x) => (x.id === id ? { ...x, voided: now() } : x))); },
    /** The kept requests whose answer was lost, asked again (the same request id: the same stake, no gold twice). */
    async recover() {
      for (const x of read(CARD_STAKES_KEY).filter((y) => !y.order && y.c === character())) {
        const r = await ask(x, false);
        if (r && !r.ok && cardStakeRefused(r.error)) write(CARD_STAKES_KEY, read(CARD_STAKES_KEY).filter((y) => y.rid !== x.rid));   // AUDIT CARDS-4 C2
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
      // AUDIT CARDS-4 C4: whose it is from the stake it settles; one the device never staked is anyone's of the account
      // (`c` null) until the service says whose (claim)
      if (!kept.some((x) => x.j === c.j)) write(CARD_RECEIPTS_KEY, [...kept, { j: c.j, receipt, c: stake?.c ?? null, reg: stake?.reg ?? region() }]);
      // AUDIT CARDS-4 C3: acked only once it is KEPT - a write the storage refused leaves the room owing it
      if (!read(CARD_RECEIPTS_KEY).some((x) => x.j === c.j)) return null;
      if (stake) write(CARD_STAKES_KEY, read(CARD_STAKES_KEY).filter((x) => x.id !== c.j));
      return c.j;
    },
    /** Every kept receipt of this character's claimed - the gold the service paid into the record's account at the
     *  region it was staked in. One claim at a time. */
    claim() {
      // AUDIT CARDS-4 E2: the latch let go in the promise's own `finally`, after it is set - a round with nothing to await
      // ran its `finally` inside the call, before `??=` assigned, and every later claim answered that spent promise
      claiming ??= (async () => {
        {
          const tried = new Set();
          // AUDIT CARDS-4 C8: round again for a receipt heard while the last round ran
          for (let next; realm && wallet && (next = read(CARD_RECEIPTS_KEY).filter((x) => (x.c == null || x.c === character()) && !tried.has(x.j))).length;) {
            for (const k of next) {
              tried.add(k.j);
              const who = k.c ?? character();
              const r = await realm.act({
                needsAnswer: true,
                apply: (/** @type {any} */ a) => { const g = a?.data?.gold; if (!a?.data?.repeat && Number.isSafeInteger(g) && g > 0) wallet(k.reg).bank(g); },
                call: (/** @type {any} */ at) => door.cashout({ character: who, realm: at, receipt: k.receipt }),
              });
              if (r?.ok || CARD_CLAIM_DONE.includes(r?.error) || (r?.error === 'cards-receipt' && CARD_RECEIPT_DEAD.includes(r?.why))) write(CARD_RECEIPTS_KEY, read(CARD_RECEIPTS_KEY).filter((x) => x.j !== k.j));
            }
          }
        }
      })().finally(() => { claiming = null; });
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
      // AUDIT CARDS-4 C1: asked again (a lost answer ended the session, and the join read the record): a stake the service
      // takes NOW leaves the record now - the purse pays it before the act's checkpoint, or that checkpoint wrote the
      // record's gold back over it; a repeat the record had already paid
      ...(first ? { reserve: () => wallet(x.reg).pay(x.amount) } : { apply: (/** @type {any} */ a) => { if (!a?.data?.repeat) wallet(x.reg).pay(x.amount); } }),
      call: (/** @type {any} */ at) => door.stake({ character: x.c, realm: at, region: x.reg, room: x.room, table: x.table, bb: x.bb, amount: x.amount, rid: x.rid, ...(x.topup ? { topup: true } : {}) }),
    });
    if (r?.ok && r.data?.stake) write(CARD_STAKES_KEY, read(CARD_STAKES_KEY).map((y) => (y.rid === x.rid ? { ...y, order: r.data.stake, id: r.data.id, at: now() } : y)));
    return r;
  }
  return book;
}
