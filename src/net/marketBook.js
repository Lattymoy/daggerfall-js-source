// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF5 (2026-09-29, Mac: "Continue") - THE MARKET'S BOOK: what the
// Market tab reads and every act it asks (server-account/src/market.js,
// bible/06-Systems/Professions-Arc.md 26).
//
// THE BOARD'S SHAPE (net/noticeBook.js): a minute's cache of every read -
// a refusal too - a slow service showing the last good view, marked stale;
// every act one at a time, given up after the door's fifteen seconds and
// tried again on the words that mean "not yet" (offline, server, the
// account gate's minute spent), and kept through the ones that mean "not
// now" (no session yet, a session let go - AUDIT 30 C1).
//
// THE PROFESSIONS' SHAPE (net/profBook.js): what moves a piece in or out
// of the save is KEPT before it is asked (ASYNC NEVER DROPS) - a piece
// listed (taken out of the pack first, put back on a refusal), a piece
// bought here, a piece cancelled back, a piece collected - and let go on
// the answer BEFORE the piece is minted, so a mint that throws is never a
// second mint; a kept act whose answer was lost is asked again with the
// same id when the tab next settles, and the service's `repeat` answers it.
//
// PROF5b: an auction posted is a listed piece's act (kept, put back on a refusal) with its own route; a bid is an
// order's (its id kept for a press asked again - it moves Marks, and the won piece comes by delivery).
//
// GOLD-MARKET (Professions-Arc 10.8): A GOLD BUY MOVES THE BUYER'S RECORD. A realm character's gold is its record's, so
// a gold listing is bought through the host's realm act (systems/realmSaves.js realmGoldAct): the purse checkpointed,
// the exact cost taken out of it as the service is asked (`reserve` - the service's batch pays the record the same, or
// neither), given back on a refusal. It is KEPT too, as a Drakes buy is: an answer lost ends the realm session (a join
// reads the record), and the tab's next settle asks it again with its id - a sale that landed answered as the repeat
// (its piece minted, nothing paid again), one that did not landed now (the cost paid off the purse on the answer). The
// gold a character's sales hold comes in by the same act (`collectGold`), into the board's bank account as the record's.
// ═══════════════════════════════════════════════════════════════════

import { MARKET_RID_RE } from './marketLaw.js';
import { ASK_AGAIN_NOW, jittered } from './backoff.js';
import { walletReserve } from './realm/realmGoldLaw.js';   // MARKET-AUDIT: a refusal gives back exactly what the payment took   // SCALE1: asks again spread out, and never at once into a minute's refusal

export const MARKET_KEPT_KEY = 'prof5.kept';
export const MARKET_CACHE_MS = 60_000;
/** MEM-AUDIT (2026-10-23): how many reads the cache keeps - one a query (a page, a sort, a filter), each a whole view, and it
 *  was cleared only by an act; past their minute they are the stale answer to a failed read, so the oldest go, not the old. */
export const MARKET_CACHE_KEPT = 256;   // AUDIT MEM-AUDIT U3: a long browse's views (64 dropped a view the player came back to after 70 pages)
export const MARKET_TRIES = 3;
export const MARKET_RETRY_MS = Object.freeze([400, 1500]);
/** How long an order's, a fill's or a withdrawal's id is kept for a press asked again (the lost answer's re-ask). */
export const MARKET_ID_MS = 10 * 60_000;
/** A shut market is asked again this often (AUDIT 30 U11: a shut read hid the tab for the session's life). */
export const MARKET_CLOSED_RECHECK_MS = 300_000;
/** The answers an act is asked again after: the network, the service's own fault, the account gate's minute spent
 *  (AUDIT 30 C1: its 429 comes before any route, so it says nothing about the act). */
const RETRY = Object.freeze(['offline', 'server', 'rate']);
/** AUDIT 30 C1: the answers that say nothing about the act's row - kept, and asked again once there is a session (net/
 *  profBook.js WAIT). Letting them go put a listed piece back in the pack while it stood listed, and lost a purchase. */
const WAIT = Object.freeze(['no-session', 'auth']);
/** The answers that say the market is not this account's now. */
const SHUT = Object.freeze(['market-closed', 'prof-need-account']);
/** AUDIT 30 U9: the answers that say the view a press was made from has moved - the minute's cache is let go. PROF5b: a
 *  bid another overtook; AUDIT 31 B8: a bid that leads already, a bid standing on one's own auction, a bid overtaken as
 *  it was decided - each says the view is older than the auction. */
export const MARKET_MOVED = Object.freeze(['market-gone', 'market-short', 'market-price-moved', 'auction-low', 'auction-leading', 'auction-bid-standing',
  'auction-moved']);
const MOVED = MARKET_MOVED;
/** AUDIT 31 H1: the answers that say a piece taken out of the save is ELSEWHERE on the service - listed, on its way to
 *  the account, standing in a home. The save's piece was a copy (a save restored past the act that moved it): it is
 *  never put back, and a settle takes it out of the save.
 *  MARKET-KEEP (FIELD BUGS 2026-10-01, "also it's bugged"): NEVER `market-not-yours`. A record that names another owner
 *  says nothing of where the piece is: a realm trade moves the piece between the two saves and never the product's
 *  owner (Professions-Arc 18's hand-over is unbuilt), and a shop's shelf, a room's container and a looted body hand a
 *  crafted piece on without the service at all. The piece a player pressed List (or Fill) on was then their only one,
 *  taken out of the pack and never put back - gone, with "not yours to sell". It goes back, as any refusal's. */
export const PIECE_GONE = Object.freeze(['market-listed', 'market-uncollected', 'market-standing']);
/** AUDIT 31 H1: a piece another act of the counting-house holds (this book's kept listing, or the writs' kept fill). */
export const PIECE_KEPT_ERROR = 'piece-kept';

/**
 * INT19 (2026-10-17, the INTEGRITY arc's lane 1 - bible/06-Systems/Integrity-Arc.md section 7): A CRAFTED PIECE HANDED ON
 * THROUGH THE REALM ACT (systems/realmSaves.js realmGoldAct) - listed, auctioned, or filled to a commission. The service
 * takes the piece out of the character's realm record by its provenance (server-account/src/craftedPiece.js), so the save
 * is checkpointed first and held; the piece leaves the save (`piece.take()`) only inside the hold, as the service is first
 * asked (`send(at)`, where the record stands), so no checkpoint carries the pack without it while the record still holds
 * it, and nothing is asked for a piece the save would not give up (AUDIT 31 H8). A refusal puts it back - never one that
 * says the piece is elsewhere (PIECE_GONE, AUDIT 31 H1: the save's was a copy); silence ends the session (a join reads the
 * record: the piece is handed on, or in the pack). Nothing is kept: the record is the truth. It was taken out of the pack
 * alone, the service asked on the products row's word - so a tab that had lost its seat listed a piece the live record held.
 * @param {{ act: (o: any) => Promise<any> }} realm @param {{ item: any, where: string, take: () => boolean, putBack: (item: any, where: string) => void }} piece
 * @param {(at: any) => Promise<any>} send
 */
export async function realmPieceAct(realm, piece, send) {
  let taken = false, asked = false, gone = false;
  return realm.act({
    reserve: () => () => {
      if (!taken || gone) return;
      taken = false;
      try { piece.putBack(piece.item, piece.where); } catch (e) { console.warn('[market] put back', e); }
    },
    call: (/** @type {any} */ at) => {
      if (!asked) { asked = true; taken = !!piece?.take?.(); }
      if (!taken) return Promise.resolve({ ok: false, error: 'piece-held', status: 409 });
      return Promise.resolve(send(at)).then((a) => { if (PIECE_GONE.includes(a?.error)) gone = true; return a; });
    },
  });
}
/** What the Market tab says while a kept act waits for its answer. */
export const MARKET_KEPT_TEXT = 'The counting-house has your order and will settle it when it answers.';

const wait = (ms) => new Promise((res) => setTimeout(res, ms));
/** A request id: `k` and fifteen of [a-z0-9] (MARKET_RID_RE's shape). */
export function mintMarketRid() {
  const b = new Uint8Array(15);
  globalThis.crypto.getRandomValues(b);
  let s = 'k';
  for (const x of b) s += (x % 36).toString(36);
  return s;
}

/**
 * @param {{ door: any, storage?: Storage|null, character: () => (string|null), now?: () => number,
 *   marks?: { set?: (n: number) => void } | null, stores?: { apply?: (s: any) => void } | null,
 *   holds?: ((provenance: string) => boolean) | null, sleep?: (ms: number) => Promise<void>,
 *   realm?: { act: (o: any) => Promise<any>, abandon?: (why: string) => void } | null,
 *   wallet?: ((region: number) => { gold: () => number, pay: (n: number) => ((() => void) | void), credit: (n: number) => void, bank: (n: number) => void }) | null,
 *   goods?: { receive: (item: any) => boolean } | null }} o
 *   `stores` - the professions' book (AUDIT 30 U1: what an answer says of the Stores is its count too); `holds` - AUDIT 31
 *   H1: whether another book keeps an act on a piece (the writs' kept fill), so it is not taken twice; GOLD-MARKET:
 *   `realm` - a realm character's act on its record (systems/realmSaves.js realmGoldAct over the playing session), null
 *   for any other character (no gold trade, and - INT19 - no crafted piece listed or auctioned); `wallet` - the save's gold as it pays at a board's region (the purse, its
 *   letters, then that region's account - realmGoldLaw payFromSave's order; MARKET-AUDIT: answering the undo of exactly what it
 *   took, `credit` the whole cost only where it answers none) and `bank`, gold into that region's account;
 *   MARKET-ANY: `goods.receive(item)` - a piece from a pack, as the service put it into the record, into the save's pack
 *   (false: this game will not hold it - the session is abandoned, and a join reads the record)
 */
export function createMarketBook({ door, storage = null, character, now = () => Date.now(), marks = null, stores = null, holds = null, sleep = wait, realm = null, wallet = null, goods = null }) {
  let _shut = /** @type {number|null} */ (null);
  const state = {
    /** null until the service has answered; false while the market is shut to this account - asked again after
     *  MARKET_CLOSED_RECHECK_MS (AUDIT 30 U11) */
    _open: /** @type {boolean|null} */ (null),
    get open() { return this._open === false && _shut != null && now() - _shut >= MARKET_CLOSED_RECHECK_MS ? null : this._open; },
    set open(v) { this._open = v; _shut = v === false ? now() : null; },
    balance: /** @type {number|null} */ (null),
    /** what is on its way to this account (the service's `road`) */
    road: /** @type {any[]} */ ([]),
    counts: { listings: 0, orders: 0, bids: 0 },
    /** AUDIT SEATS-3 D2: the open listings this account may hold at the board last read from (a Market Hall's town lists
     *  more - the service's seatForts.js listingsCapAt), or null before a service that says it */
    listingsMax: /** @type {number|null} */ (null),
    /** PROF5b: the Marks this account's bids hold (standing, or outbid and not yet back) */
    held: 0,
    /** GOLD-MARKET: the gold this character's sales hold for it, to collect */
    goldHeld: 0,
  };
  const account = () => { try { return door.account?.() ?? null; } catch { return null; } };
  const slot = () => `${account() ?? ''}|${character() ?? ''}`;

  // ─── THE KEPT ACTS ─────────────────────────────────────────────────
  let _memory = null;
  const table = () => {
    if (_memory) return _memory;
    try {
      const v = JSON.parse(storage?.getItem?.(MARKET_KEPT_KEY) ?? 'null');
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch { return {}; }
  };
  const writeTable = (t) => { try { storage?.setItem?.(MARKET_KEPT_KEY, JSON.stringify(t)); _memory = null; } catch { _memory = t; } };
  const KINDS = ['lists', 'buys', 'cancels', 'collects'];
  const keptOf = (key = slot()) => {
    const k = table()[key];
    return Object.fromEntries(KINDS.map((n) => [n, Array.isArray(k?.[n]) ? k[n] : []]));
  };
  const writeKept = (kept, key = slot()) => {
    const t = { ...table() };
    if (KINDS.some((n) => kept[n].length)) t[key] = kept; else delete t[key];
    writeTable(t);
  };
  /** AUDIT 31 B2: every kept act's slot is the one it was pressed in - read once, at the press, never again after an
   *  await (a quick-load between put a piece back into another character, and left the first one's kept to go again). */
  const keep = (kind, entry, key = slot()) => { const k = keptOf(key); k[kind] = [...k[kind].filter((x) => x.rid !== entry.rid), entry]; writeKept(k, key); };
  /** Let a kept act go; whether it was kept here (a repeat answered elsewhere mints nothing). */
  const letGo = (kind, rid, key = slot()) => {
    const k = keptOf(key);
    const had = k[kind].some((x) => x.rid === rid);
    k[kind] = k[kind].filter((x) => x.rid !== rid);
    writeKept(k, key);
    return had;
  };
  /** AUDIT 31 H1: the pieces this book keeps an act on (a kept listing or auction), this slot's. */
  const keptPieces = () => new Set(keptOf().lists.map((l) => l.body?.provenance).filter(Boolean));
  /** AUDIT 31 B1: a kept act needs an account to be kept under - pressed with none, it was kept under no one's slot and
   *  never asked again once one signed in (the piece lost). */
  const signedIn = () => !!account();

  /** One ask, up to MARKET_TRIES times with a wait between; the service's no is final at once. */
  async function ask(fn) {
    let r = null;
    for (let i = 0; i < MARKET_TRIES; i++) {
      if (i > 0) await sleep(jittered(MARKET_RETRY_MS[Math.min(i - 1, MARKET_RETRY_MS.length - 1)]));
      try { r = await fn(); } catch { r = { ok: false, error: 'offline' }; }
      if (r?.ok || !ASK_AGAIN_NOW.includes(r?.error)) return r;   // SCALE1: `rate` goes back kept, to the pump
    }
    return r;
  }
  /** What every answer carries: the balance (the Marks book told too - PROF0 26), the road, the counts, and (AUDIT 30
   *  U1) the Stores counts it moved - one material's `store`, or a read's `stores`, the deliveries it landed. */
  function heard(r) {
    if (SHUT.includes(r?.error)) state.open = false;
    if (MOVED.includes(r?.error)) forget();
    const d = r?.ok ? r.data : null;
    if (!d) return r;
    state.open = true;
    if (Number.isSafeInteger(d.balance)) { state.balance = d.balance; try { marks?.set?.(d.balance); } catch { /* the Marks book's own */ } }
    if (Array.isArray(d.road)) state.road = d.road;
    if (d.counts) state.counts = { listings: d.counts.listings | 0, orders: d.counts.orders | 0, bids: d.counts.bids | 0 };
    if (Number.isSafeInteger(d.listingsMax) && d.listingsMax > 0) state.listingsMax = d.listingsMax;   // AUDIT SEATS-3 D2
    if (Number.isSafeInteger(d.held)) state.held = d.held;
    if (Number.isSafeInteger(d.goldHeld)) state.goldHeld = d.goldHeld;   // GOLD-MARKET
    for (const st of [d.store, ...(Array.isArray(d.stores) ? d.stores : [])]) {
      if (st && typeof st.material === 'string') { try { stores?.apply?.(st); } catch { /* the professions' book's own */ } }
    }
    return r;
  }
  const kept = (r) => RETRY.includes(r?.error) || WAIT.includes(r?.error);

  // ─── THE READS ─────────────────────────────────────────────────────
  const cache = new Map();
  /** AUDIT MEM-AUDIT U3: an entry asked for is the newest - the views a player comes back to stay; the cap takes the
   *  ones long unasked. */
  const touch = (key) => { const e = cache.get(key); if (e) { cache.delete(key); cache.set(key, e); } return e; };
  // MARKET-ANY: and the crafted pieces a "My listings" read names (the service says how each may list)
  const keyOf = (view, q) => [slot(), view, q.region, q.family ?? '', q.tier ?? '', q.material ?? '', (q.materials ?? []).join(','), q.currency ?? 'marks', (q.pieces ?? []).join(','), (q.board ?? []).join(','),
    q.page ?? 0, q.sort ?? '', q.recipes ? `r:${q.recipes.join(',')}` : '', q.quality ?? 0].join('|');   // AUDIT SEATS-3 D2: and the board (its cap); MARKET-AUDIT P2: and the account and character (another's My listings was served a minute); BOARD-SIFT: and the page, its order, a search's recipes (AUDIT BOARD-SIFT: one that names none is no read without one) and the least quality
  const pending = new Map();
  /** AUDIT 30 C6: the acts answered so far - a read begun before an act's answer is overtaken by it, and asked again. */
  let gen = 0;
  /** A view of the market: the minute's cache unless `force`; a failed read shows the last good one, stale. A read an
   *  act's answer overtook tells nothing (its balance is older than the act's) and is read again (AUDIT 30 C6). */
  async function read(view, q, { force = false } = {}) {
    const key = keyOf(view, q);
    const hit = touch(key);
    if (!force && hit && now() - hit.at < MARKET_CACHE_MS) {
      // MARKET-AUDIT P3: the board's own listing cap with it - two boards a minute apart said the other's
      if (Number.isSafeInteger(hit.data?.listingsMax) && hit.data.listingsMax > 0) state.listingsMax = hit.data.listingsMax;
      return { ok: !hit.error, data: hit.data, error: hit.error, stale: hit.stale };
    }
    const g = gen;
    const pk = `${g}|${key}`;
    // MARKET-AUDIT: a read that joins one under way is answered as that one's asker is - an act's answer overtaking it is
    // read again, never `null` (the tab threw on it, and stood blank)
    if (pending.has(pk)) return pending.get(pk).then((out) => out ?? read(view, q, { force: true }));
    const p = (async () => {
      const a = await ask(() => door.read({ character: character(), view, ...q }));
      if (g !== gen) return null;
      const r = heard(a);
      const e = { at: now(), data: r?.ok ? r.data : hit?.data ?? null, error: r?.ok ? null : (r?.error ?? 'server'), stale: !r?.ok && !!hit?.data };
      cache.delete(key); cache.set(key, e);   // MEM-AUDIT (2026-10-23): the newest last - a minute's reads past the cap go oldest first
      if (cache.size > MARKET_CACHE_KEPT) cache.delete(cache.keys().next().value);
      return { ok: !!r?.ok, data: e.data, error: e.error, stale: e.stale };
    })();
    pending.set(pk, p);
    let out;
    try { out = await p; } finally { pending.delete(pk); }
    return out ?? read(view, q, { force: true });
  }
  function forget() { cache.clear(); gen++; }

  // ─── THE ACTS ──────────────────────────────────────────────────────
  let _busy = null, _busyKey = null;
  /** One act at a time: a press of the act under way is that act; AUDIT 30 C5: any other while one is under way (the
   *  opening settle's included) is refused `market-busy` - it was handed the other act's answer, and said done. */
  const once = (key, fn) => {
    if (_busy) return _busyKey === key ? _busy : Promise.resolve({ ok: false, error: 'market-busy' });
    _busyKey = key;
    return (_busy = (async () => { try { return await fn(); } finally { _busy = null; _busyKey = null; } })());
  };
  const ids = new Map();
  /** AUDIT 31 B4: an id is its slot's - another character's press of the same act is never answered as this one's. */
  const idFor = (key) => {
    const k = `${slot()}|${key}`;
    let v = ids.get(k);
    if (v && now() - v.at > MARKET_ID_MS) v = null;
    if (!v) ids.set(k, v = { id: mintMarketRid(), at: now() });
    return v.id;
  };
  const done = (key) => ids.delete(`${slot()}|${key}`);
  const answered = (r) => { if (r?.ok) forget(); return r; };

  /** A kept act asked (or asked again): let go on the answer, the piece minted once after; kept on silence - and (AUDIT 31
   *  B2) kept while the save is another character's than the one it was pressed in: that one's settle mints it. */
  async function keptAct(kind, entry, send, mint, key = slot()) {
    const r = heard(await ask(send));
    if (slot() !== key) return { ok: false, kept: true, error: 'other-character', text: MARKET_KEPT_TEXT };
    if (r?.ok) {
      const had = letGo(kind, entry.rid, key);
      forget();
      if (had && r.data?.piece) { try { mint?.(r.data.piece, kind); } catch (e) { console.warn('[market] mint', e); } }
      return { ok: true, data: r.data };
    }
    if (kept(r)) return { ok: false, kept: true, error: r?.error, text: MARKET_KEPT_TEXT };
    letGo(kind, entry.rid, key);
    return { ok: false, error: r?.error ?? 'server' };
  }

  /** GOLD-MARKET: A GOLD BUY asked through the realm act - `first`, the press: the exact cost out of the purse as it
   *  asks, back on a refusal; a settle's ask again: paid on the answer, and only for a sale this ask made (a repeat's
   *  record paid, and the purse a join loaded is that record's). Let go on the answer, the piece minted once after; kept
   *  on silence, and while the save is another character's. */
  async function goldBuy(entry, mint, key, first) {
    if (!realm || !wallet) return { ok: false, error: 'market-gold-realm' };
    const w = wallet(entry.body.region);
    const cost = entry.body.max;
    const r = heard(await realm.act({
      needsAnswer: true,
      // MARKET-AUDIT: a refusal gives back exactly what the payment took (the purse's coins, a letter's value, the bank's) - the
      // whole cost credited as coins turned a letter of credit and the bank's gold into a purse past carrying
      ...(first ? { reserve: walletReserve(w, cost).reserve } : { apply: (/** @type {any} */ a) => { if (!a?.data?.repeat) w.pay(cost); } }),
      call: (/** @type {any} */ at) => door.buy({ ...entry.body, realm: at }),
    }));
    if (slot() !== key) return { ok: false, kept: true, error: 'other-character', text: MARKET_KEPT_TEXT };
    if (r?.ok) {
      const had = letGo('buys', entry.rid, key);
      forget();
      if (had && r.data?.piece) { try { mint?.(r.data.piece, 'buys'); } catch (e) { console.warn('[market] mint', e); } }
      return { ok: true, data: r.data };
    }
    // kept until the SERVICE says no (an answer with its status): a session lost or busy, or an answer never come, is no
    // word on the sale - letting it go lost a piece a sale that landed paid for
    if (r?.unknown || kept(r) || !Number.isSafeInteger(r?.status)) return { ok: false, kept: true, error: r?.error ?? 'offline', text: MARKET_KEPT_TEXT };
    letGo('buys', entry.rid, key);
    return { ok: false, error: r?.error ?? 'server' };
  }

  /** A piece posted (listed, or PROF5b auctioned) - INT19: through the realm act, out of the record by its provenance
   *  (realmPieceAct). AUDIT 31: never without an account (B1), never a piece another kept act holds (H1). A list kept by
   *  a tab from before INT19 is still asked again by the settle, below, with its own id. */
  async function postPiece(route, body, piece) {
    if (!signedIn()) return { ok: false, error: 'no-session' };
    if (body.provenance && (keptPieces().has(body.provenance) || holds?.(body.provenance))) return { ok: false, error: PIECE_KEPT_ERROR };
    if (!realm) return { ok: false, error: 'realm-needed' };   // INT19: a crafted piece is handed on out of a realm record alone
    if (!piece) return { ok: false, error: 'piece-held' };
    const r = heard(await realmPieceAct(realm, piece, (at) => door[route]({ ...body, realm: at })));
    if (r?.ok) forget();
    return r ?? { ok: false, error: 'server' };
  }

  /**
   * MARKET-ANY: A PIECE FROM THE PACK, LISTED THROUGH THE REALM ACT (systems/realmSaves.js realmGoldAct) - `body` names
   * the piece (`item`, its wire record) and where it stands in the save (`pick`); `good.take()` takes it out of the pack
   * and answers its undo (null: the pack will not give it up). The act checkpoints the save first - the record the
   * service takes the piece out of, the piece at `pick` - and holds; the piece leaves the pack only inside the hold, as
   * the service is first asked, so no checkpoint ever carries the pack without it while the record still holds it, and
   * nothing is asked for a piece the pack would not give up. A refusal puts it back; silence ends the session (a join
   * reads the record: the piece is listed, or in the pack). Nothing is kept: the record is the truth.
   */
  async function postGood(body, good) {
    if (!signedIn()) return { ok: false, error: 'no-session' };
    if (!realm) return { ok: false, error: 'market-gold-realm' };
    let undo = null, asked = false;
    const r = heard(await realm.act({
      reserve: () => () => { const u = undo; undo = null; u?.(); },
      call: (/** @type {any} */ at) => {
        if (!asked) { asked = true; undo = good?.take?.() ?? null; }
        if (!undo) return Promise.resolve({ ok: false, error: 'piece-held', status: 409 });
        return door.list({ ...body, realm: at });
      },
    }));
    if (r?.ok) forget();
    return r ?? { ok: false, error: 'server' };
  }
  /** MARKET-ANY: A PIECE FROM A PACK COLLECTED - bought, or come back - into this character's record by the service and
   *  into the save's pack on its answer (`goods.receive`). The answer IS the piece, so a lost one ends the session
   *  (realmGoldAct's `needsAnswer`): a join reads the record, which holds it or not. A repeat, or a piece this game will
   *  not hold, abandons the session the same way - never a second piece, never a record the tab does not match. */
  async function collectGood(delivery) {
    if (!realm || !goods) return { ok: false, error: 'market-gold-realm' };
    const me = character(), rid = mintMarketRid();
    const r = heard(await realm.act({
      needsAnswer: true,
      apply: (/** @type {any} */ a) => {
        let held = false;
        try { held = !a?.data?.repeat && goods.receive(a?.data?.item ?? null) === true; } catch (e) { console.warn('[market] receive', e); }
        if (!held) realm.abandon?.('unknown');
      },
      call: (/** @type {any} */ at) => door.collect(me, delivery, rid, at),
    }));
    if (r?.ok) forget();
    return r ?? { ok: false, error: 'server' };
  }

  const book = {
    state,
    read,
    cached: (view, q) => touch(keyOf(view, q))?.data ?? null,
    /** MARKET-SPEED: whether a read of this view would be answered by the minute's cache, nothing asked (`read`'s own test) -
     *  the tab draws such a view once, never a "Reading the market..." frame before it. */
    fresh: (view, q) => { const hit = cache.get(keyOf(view, q)); return !!hit && now() - hit.at < MARKET_CACHE_MS; },
    forget,
    /** AUDIT 30 U12: an act under way (the market's own, not the board window's). */
    get busy() { return !!_busy; },
    /** AUDIT 30 U6: a balance another book heard (the Weavers' counter's purchase). */
    told(balance) { if (Number.isSafeInteger(balance)) state.balance = balance; },
    /** Kept acts waiting for an answer. */
    get pending() { const k = keptOf(); return KINDS.reduce((n, kind) => n + k[kind].length, 0); },

    /**
     * LIST a material (`req.kind` 'material') or a piece: the piece taken out of the save first (`take`), kept with the
     * request, put back (`putBack`) if the service refuses it. MARKET-ANY: `req.kind` 'item' - a piece from the pack, for
     * gold, through the realm act (postGood) - `good.take()` its taking, answering the undo.
     * @param {any} req @param {{ item: any, where: string, take: () => boolean, putBack: (item: any, where: string) => void }|null} [piece]
     * @param {{ take: () => ((() => void) | null) }|null} [good]
     */
    list(req, piece = null, good = null) {
      return once(`list|${JSON.stringify(req)}`, async () => {
        const rid = mintMarketRid();
        const body = { character: character(), ...req, rid };
        if (req.kind === 'piece') return postPiece('list', body, piece);
        if (req.kind === 'item') return postGood(body, good);   // MARKET-ANY
        const k = `list|${JSON.stringify(req)}`;
        const r = answered(heard(await ask(() => door.list({ ...body, rid: idFor(k) }))));
        if (r?.ok || !kept(r)) done(k);
        return r;
      });
    },
    /** BUY: a piece bought here minted on the answer (kept before asked); a material into the Stores (`store`).
     *  GOLD-MARKET: `req.currency` 'gold' - a gold listing, bought off this realm character's record at `req.max`, its
     *  exact cost (the price and the courier in gold), which the purse must hold. */
    buy(req, mint) {
      return once(`buy|${req?.listing}|${req?.units}`, async () => {
        if (!signedIn()) return { ok: false, error: 'no-session' };
        const { currency = 'marks', ...ask } = req ?? {};
        const gold = currency === 'gold';
        if (gold && !(realm && wallet)) return { ok: false, error: 'market-gold-realm' };
        if (gold && wallet(ask.region).gold() < ask.max) return { ok: false, error: 'realm-gold' };
        const key = slot();
        // MARKET-AUDIT: a press again of a buy kept unanswered is that buy asked again with its own id - a fresh id bought twice
        const was = keptOf(key).buys.find((b) => b.body?.listing === ask.listing);
        if (was) return was.gold ? goldBuy(was, mint, key, false) : keptAct('buys', was, () => door.buy(was.body), mint, key);
        const rid = mintMarketRid();
        const body = { character: character(), ...ask, rid };
        keep('buys', { rid, body, ...(gold ? { gold: true } : {}) }, key);
        return gold ? goldBuy({ rid, body }, mint, key, true) : keptAct('buys', { rid }, () => door.buy(body), mint, key);
      });
    },
    /** HOME-VENDOR (net/vendorLaw.js): A HOME'S TRADER'S STOCK - `{ ok, data: { vendor, rows } }` - and THE REGION'S
     *  TRADERS - `{ ok, data: { region, rows } }`; read fresh each time (a visitor's look, the board's tab), never cached:
     *  a sale at a stall moves them. A trader's piece is listed through `list` and bought through `buy`, `vendor` in the
     *  request (`{ map, id }`). */
    async vendorStock(vendor) { return heard(await ask(() => door.vendor(vendor))) ?? { ok: false, error: 'server' }; },
    async vendors(region) { return heard(await ask(() => door.vendors(region, character()))) ?? { ok: false, error: 'server' }; },
    /** HOME-VENDOR: A PIECE FROM A PACK COLLECTED AT ONCE - a trader's sale's delivery, or a piece taken back off a trader -
     *  into the record and the pack (collectGood), on the answer that named it, without waiting for a read of the road. */
    collectGood(delivery) { return once(`good|${delivery}`, () => collectGood(delivery)); },
    /** HOME-VENDOR: the Vendor page's read - my traders, their stock, what they sold, the gold it holds. */
    async myVendors() { return heard(await ask(() => door.myVendors(character()))) ?? { ok: false, error: 'server' }; },
    /** MARKET-AUDIT U7: the character the book acts for - a delivery to another of the account's waits for that one. */
    me: () => character(),
    /** GOLD-MARKET: whether this character trades in gold - a realm character's (its gold is its record's). */
    get goldOk() { return !!(realm && wallet); },
    /** INT19: the realm act a crafted piece is handed on through - the writs' book's commission fill asks it too. */
    realm,
    /** GOLD-MARKET: the gold the save can pay at a board of `region` (the purse, its letters, that region's account), or
     *  null for a character that trades in none. */
    purse(region) { try { return realm && wallet ? wallet(region).gold() : null; } catch { return null; } },
    /** GOLD-MARKET: COLLECT the gold this character's sales hold, into the record's account at `region` (the board's) - the
     *  record's own act: the save's account credited with what the service answers it moved. */
    collectGold(region) {
      return once(`gold|${region}`, async () => {
        if (!signedIn()) return { ok: false, error: 'no-session' };
        if (!realm || !wallet) return { ok: false, error: 'market-gold-realm' };
        const me = character();
        const r = heard(await realm.act({
          needsAnswer: true,
          apply: (/** @type {any} */ a) => { if (Number.isSafeInteger(a?.data?.gold) && a.data.gold > 0) wallet(region).bank(a.data.gold); },
          call: (/** @type {any} */ at) => door.gold({ character: me, realm: at, region }),
        }));
        if (r?.ok) { state.goldHeld = 0; forget(); }
        return r;
      });
    },
    /** CANCEL a listing: a piece answered back and minted; a material's units into the Stores. */
    cancel(listing, mint) {
      return once(`cancel|${listing}`, async () => {
        if (!signedIn()) return { ok: false, error: 'no-session' };
        const rid = mintMarketRid();
        const key = slot(), me = character();
        keep('cancels', { rid, listing }, key);
        return keptAct('cancels', { rid }, () => door.cancel(me, listing, rid), mint, key);
      });
    },
    /** COLLECT a piece that has arrived (or come back). */
    collect(delivery, mint) {
      return once(`collect|${delivery}`, async () => {
        if (!signedIn()) return { ok: false, error: 'no-session' };
        const rid = mintMarketRid();
        const key = slot(), me = character();
        keep('collects', { rid, delivery }, key);
        return keptAct('collects', { rid }, () => door.collect(me, delivery, rid), mint, key);
      });
    },
    /** PROF5b: AN AUCTION of a Masterwork - `req` `{ region, provenance, wear, opening, hubs }` - posted as a listed
     *  piece is (out of the save first, kept, put back on a refusal). */
    auction(req, piece) {
      return once(`auction|${JSON.stringify(req)}`, async () => postPiece('auction', { character: character(), ...req, rid: mintMarketRid() }, piece));
    },
    /** PROF5b: A BID - `req` `{ region, auction, amount, hubs }` - its id kept for a press asked again (the lost answer's). */
    bid(req) {
      const k = `bid|${JSON.stringify(req)}`;
      return once(k, async () => { const r = answered(heard(await ask(() => door.bid({ character: character(), ...req, rid: idFor(k) })))); if (!kept(r)) done(k); return r; });
    },
    /** A buy ORDER posted, a FILL, an order WITHDRAWN - each with its id kept for a press asked again. */
    order(req) {
      const k = `order|${JSON.stringify(req)}`;
      return once(k, async () => { const r = answered(heard(await ask(() => door.order({ character: character(), ...req, rid: idFor(k) })))); if (!kept(r)) done(k); return r; });
    },
    fill(req) {
      const k = `fill|${JSON.stringify(req)}`;
      return once(k, async () => { const r = answered(heard(await ask(() => door.fill({ character: character(), ...req, rid: idFor(k) })))); if (!kept(r)) done(k); return r; });
    },
    unorder(order) {
      const k = `unorder|${order}`;
      return once(k, async () => { const r = answered(heard(await ask(() => door.unorder(order, idFor(k))))); if (!kept(r)) done(k); return r; });
    },
    report: (listing) => once(`report|${listing}`, async () => answered(heard(await ask(() => door.report(listing))))),
    remove: (listing) => once(`remove|${listing}`, async () => answered(heard(await ask(() => door.remove(listing))))),

    /**
     * SETTLE: every kept act asked again with its own id (a list whose answer never came, a buy, a cancel, a collect),
     * and every piece on the road that has arrived for this character collected - each minted once.
     * @param {(piece: any, why: string) => void} mint @param {(item: any, where: string) => void} putBack
     * @param {((item: any, where: string) => void)|null} [drop] AUDIT 30 C3: a listed piece out of the save - a kept list
     *   answered here was taken out of a save that may not have been kept since (a crash, a seat handed over)
     */
    settle(mint, putBack, drop = null) {
      const go = () => once('settle', async () => {
        // AUDIT 31 B2: the slot the settle began in, and the character with it - a quick-load mid-settle stops it
        const key = slot(), me = character();
        const here = () => slot() === key;
        const k = keptOf(key);
        let settled = 0;
        for (const l of k.lists) {
          const r = heard(await ask(() => (l.route === 'auction' ? door.auction(l.body) : door.list(l.body))));   // PROF5b: an auction's own route
          if (!here()) break;
          if (r?.ok) { letGo('lists', l.rid, key); try { drop?.(l.item, l.where); } catch (e) { console.warn('[market] drop', e); } settled++; }
          else if (!kept(r)) {
            letGo('lists', l.rid, key);
            // AUDIT 31 H1: a piece the service says is elsewhere was a copy in the save - out of it, never back in
            if (PIECE_GONE.includes(r?.error)) { try { drop?.(l.item, l.where); } catch (e) { console.warn('[market] drop', e); } }
            else { try { putBack(l.item, l.where); } catch (e) { console.warn('[market] put back', e); } }
            settled++;
          }
        }
        // GOLD-MARKET: a kept gold buy asked again through the realm act (paid on the answer, a repeat paid nothing)
        for (const b of k.buys) if (here() && (await (b.gold ? goldBuy(b, mint, key, false) : keptAct('buys', b, () => door.buy(b.body), mint, key))).ok) settled++;
        for (const c of k.cancels) if (here() && (await keptAct('cancels', c, () => door.cancel(me, c.listing, c.rid), mint, key)).ok) settled++;
        for (const c of k.collects) if (here() && (await keptAct('collects', c, () => door.collect(me, c.delivery, c.rid), mint, key)).ok) settled++;
        // MARKET-AUDIT P5: a collect the service refused is said (`refused`, its words) - it was said nowhere
        const refused = [];
        for (const d of state.road.filter((x) => x.kind === 'piece' && x.ready && x.character === me)) {
          if (!here() || keptOf(key).collects.some((c) => c.delivery === d.id)) continue;
          const rid = mintMarketRid();
          keep('collects', { rid, delivery: d.id }, key);
          const r = await keptAct('collects', { rid }, () => door.collect(me, d.id, rid), mint, key);
          if (r.ok) settled++; else if (!r.kept) refused.push(r.error);
        }
        // MARKET-ANY: and every piece from a pack that has arrived for this character, into its record and its pack
        for (const d of state.road.filter((x) => x.kind === 'item' && x.ready && x.character === me)) {
          if (!here()) break;
          const r = await collectGood(d.id);
          if (r.ok) settled++; else refused.push(r.error);
        }
        if (settled) forget();
        return { ok: true, settled, refused };
      });
      // AUDIT 31 B10: a settle asked while another act is under way waits for it, never refused and never asked again
      return _busy && _busyKey !== 'settle' ? _busy.then(go, go) : go();
    },
    /** AUDIT 31 H1: whether this book keeps an act on a piece (the writs' book asks, and the host's pickers). */
    holdsPiece: (provenance) => keptPieces().has(provenance),
    /** The kept acts of this slot (a test's and the tab's "waiting" line). */
    _kept: () => keptOf(),
    /** The rid shape, for a test. */
    ridOk: (r) => MARKET_RID_RE.test(r),
  };
  return book;
}
