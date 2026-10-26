// @ts-check
// ═══════════════════════════════════════════════════════════════════
// FIRM1 (2026-10-13; bible/06-Systems/Firmament.md) - THIS DEVICE'S FIRMAMENT: the character's tree and purses as the
// account service last said them (server-account/src/firmament.js), and the one change on its way. The law both ends
// read is net/firmament/firmamentLaw.js.
//
// A CHANGE IS THE WHOLE TREE, under its own request id. ASYNC NEVER DROPS: a change asked while another is on its way is
// COALESCED - the newest tree the player confirmed waits behind the one in flight and is asked when it answers, never
// thrown away and never asked beside it. A change whose answer did not come is KEPT (FIRM_KEPT_KEY, by account and
// character) with its id, and asked again with the same id at the next read - the service answers one that landed as its
// `repeat`, never a second charge. A refusal the service gave after it looked (the law's, the purses', a stale tree) lets
// it go and the state is read again.
//
// A READ OR A CHANGE THE SERVICE NEVER ANSWERED IS FOLLOWED BY A READ OF THE BOOK'S OWN (FIRM-RETRY), after
// FIRM_READ_RETRY_MS, the wait doubling to FIRM_READ_RETRY_MAX_MS, until a read is answered. The tree in force
// (systems/firmamentLive.js) comes only from a read, and the world host reads once, at the first Renown. When that read
// failed, only the enhanced HUD's star tile asked again, so on the classic HUD the character played with no stars until
// a Renown rise or the Growth tab. A kept change is asked again by that read.
//
// Pure - the door, the storage, the timer and the ids are handed in - so the pins drive it without a network.
// ═══════════════════════════════════════════════════════════════════

import { unpackTree, packTree, pointsLeft, EMPTY_TREE, FIRM_RESPEC_GOLD } from './firmamentLaw.js';
import { walletReserve } from '../realm/realmGoldLaw.js';   // a refused respec gives back exactly what it took
import { noteAct } from '../../systems/questlines/qlActs.js';   // QL11: the features' acts, heard by the running quests

/** Where this device keeps a change whose answer did not come: { [account|character]: { rid, tree } }. */
export const FIRM_KEPT_KEY = 'firm1.kept';
/** AUDIT QUESTLINES ACTS-5: where this device keeps every star it has seen each character's sky hold:
 *  { [account|character]: key[] } - a star is taken once (createFirmamentBook's `held`). */
export const FIRM_TAKEN_KEY = 'firm1.taken';
/** The refusals that are no word on the change - kept and asked again. AUDIT UICALM-FIRM1 L2 M3: and the Worker's own
 *  account-wide two, given before any route looks (`rate`, `maintenance` - profBook.js RETRY's). */
const UNHEARD = new Set(['offline', 'server', 'no-session', 'firm-rate', 'rate', 'maintenance']);
/** The wait before the book reads again after an unanswered read or change; it doubles on each further failure. */
export const FIRM_READ_RETRY_MS = 15_000;
/** The longest wait between two of the book's own reads while the service does not answer. */
export const FIRM_READ_RETRY_MAX_MS = 120_000;

/** The page's timer for a retry. The timer never holds a Node process open: the pins' books fail reads on purpose. */
function laterOnTimer(fn, ms) {
  const timer = /** @type {any} */ (globalThis.setTimeout(fn, ms));
  timer?.unref?.();
}

/** A change's id (FIRM_RID_RE's shape). */
export function mintFirmRid(rand = (b) => globalThis.crypto.getRandomValues(b)) {
  const b = new Uint8Array(15);
  rand(b);
  return `f${[...b].map((x) => (x % 36).toString(36)).join('')}`;
}

/**
 * THE RESPEC (`respec`): the whole sky back for FIRM_RESPEC_GOLD gold. A realm character's record pays on the service in
 * the respec's own batch (`realm.act`, systems/realmSaves.js realmGoldAct - the purse checkpointed and reserved first, a
 * refusal giving back exactly what it took); with no realm there is no respec ('realm-needed' - online play is the
 * realm's). `wallet()` is the host's: `{ gold, pay, credit?, region? }`. `later(fn, ms)` runs `fn` after `ms`
 * milliseconds - the retry's timer (FIRM-RETRY).
 * @param {{ door: { account?: () => string|null, state: (character: string) => Promise<any>, set: (character: string, tree: string, rid: string) => Promise<any>,
 *   respec?: (character: string, rid: string, realm?: any, region?: number|null) => Promise<any> },
 *   storage?: any, character?: () => string|null, rid?: () => string, realm?: { act: (o: any) => Promise<any> } | null, wallet?: (() => any) | null,
 *   later?: (fn: () => void, ms: number) => void }} o
 */
export function createFirmamentBook({ door, storage = null, character = () => null, rid = () => mintFirmRid(), realm = null, wallet = null, later = laterOnTimer }) {
  const state = {
    /** whether the Firmament is this account's: true, false (shut, a guest, offline) or null not yet asked */
    open: /** @type {boolean|null} */ (null),
    /** the last refusal's word, or null */
    error: /** @type {string|null} */ (null),
    tree: /** @type {{ start: string|null, keys: string[] }} */ ({ start: null, keys: [] }),
    renown: 1, stars: 0, craft: 0,
    /** @type {Record<string, number>} */
    ranks: {},
    refund: { freeBelow: 10, perStar: 10 },
    /** the HTTP status of the last refused read, or null */
    status: /** @type {number|null} */ (null),
    /** a change on its way (its tree), or null */
    sending: /** @type {{ start: string|null, keys: string[] }|null} */ (null),
    character: /** @type {string|null} */ (null),
  };
  const listeners = new Set();
  const tell = () => { for (const fn of listeners) { try { fn(state); } catch { /* a listener is not the book's problem */ } } };
  const slot = () => `${(() => { try { return door.account?.() ?? ''; } catch { return ''; } })()}|${character() ?? ''}`;
  const kept = () => { try { return JSON.parse(storage?.getItem?.(FIRM_KEPT_KEY) ?? '{}') ?? {}; } catch { return {}; } };
  const keep = (entry) => {
    const all = kept();
    if (entry) all[slot()] = entry; else delete all[slot()];
    try { storage?.setItem?.(FIRM_KEPT_KEY, JSON.stringify(all)); } catch { /* storage is a convenience */ }
  };
  // AUDIT QUESTLINES ACTS-5: A STAR IS TAKEN ONCE. `star-taken` (systems/questlines/qlActs.js) counted each star the
  // service held after a change that it did not hold before it - so one star taken, given back (free below Renown 10,
  // firmamentLaw.js refundSilver) and taken again counted every time, and a quest's three stars were one point toggled;
  // and a change whose answer was lost, carried again by `read`, counted none. Now the book remembers every star it has
  // seen this character's sky hold (FIRM_TAKEN_KEY, by account and character - a reload forgets none) and a star counts
  // the first time a change of this book's makes it held - `send`'s answer, or the lost one `read` carries again (the
  // service answers it as its `repeat`; it was counted nowhere). A sky READ is remembered uncounted: its stars were
  // taken before (here, or on another device that counted them). A book that knows nothing of the sky yet (no read
  // answered, a store cleared) learns it uncounted - never a whole sky counted at once.
  const takenMemo = new Map();
  /** The stars this book has seen the character's sky hold, or null for none known. */
  const takenKnown = () => {
    if (takenMemo.has(slot())) return takenMemo.get(slot());
    let v = null;
    try { v = JSON.parse(storage?.getItem?.(FIRM_TAKEN_KEY) ?? '{}')?.[slot()]; } catch { v = null; }
    return Array.isArray(v) ? new Set(v.filter((k) => typeof k === 'string')) : null;
  };
  /** The sky holds `keys` now: each star it never held before is a star taken, said when `count`; all remembered. */
  const held = (/** @type {string[]} */ keys, count = false) => {
    const known = takenKnown();
    const fresh = known ? keys.filter((k) => !known.has(k)) : [];
    if (known && !fresh.length) return;
    const all = new Set([...(known ?? []), ...keys]);
    takenMemo.set(slot(), all);
    try {
      const o = JSON.parse(storage?.getItem?.(FIRM_TAKEN_KEY) ?? '{}') ?? {};
      o[slot()] = [...all];
      storage?.setItem?.(FIRM_TAKEN_KEY, JSON.stringify(o));
    } catch { /* storage is a convenience - the memo holds it for the session */ }
    if (count && fresh.length) noteAct('star-taken', fresh.length);   // QL11: a star taken - each newly held, once
  };
  const apply = (data) => {
    state.tree = unpackTree(data?.tree ?? '');
    state.renown = Number.isSafeInteger(data?.renown) ? data.renown : state.renown;
    state.stars = Number.isSafeInteger(data?.stars) ? data.stars : state.stars;
    state.craft = Number.isSafeInteger(data?.craft) ? data.craft : state.craft;
    if (data?.ranks && typeof data.ranks === 'object') state.ranks = { ...data.ranks };
    if (data?.refund) state.refund = { freeBelow: Number(data.refund.freeBelow) || 10, perStar: Number(data.refund.perStar) || 10 };
    state.open = true;
    state.error = null;
    state.status = null;
  };
  /** @type {{ start: string|null, keys: string[] }|null} */
  let queued = null;
  /** AUDIT UICALM-FIRM1 L2 M1: a respec on its way - no change is taken while it is (one parked behind it was sent after
   *  the player's next change and laid the old plan over the new sign) */
  let respecking = false;

  // FIRM-RETRY: one retry waits at a time. `unanswered` is cleared by any answered read, so a retry that comes due after
  // the window or a Renown rise already read the sky asks nothing.
  let unanswered = false;
  let retryWaiting = false;
  let retryWaitMs = FIRM_READ_RETRY_MS;
  const retryLater = () => {
    unanswered = true;
    if (retryWaiting) return;
    retryWaiting = true;
    const waitMs = retryWaitMs;
    retryWaitMs = Math.min(retryWaitMs * 2, FIRM_READ_RETRY_MAX_MS);
    later(() => {
      retryWaiting = false;
      if (unanswered) book.read().catch(() => {});
    }, waitMs);
  };
  const answered = () => {
    unanswered = false;
    retryWaitMs = FIRM_READ_RETRY_MS;
  };

  async function send(tree) {
    const who = character();
    if (!who) return { ok: false, error: 'firm-character' };
    // AUDIT UICALM-FIRM1 L2 M2: AN ID NAMES ONE TREE - the kept change's id is asked again for that same tree alone; a
    // newer tree is its own request (under the kept id, a kept change that had landed answered it as its repeat)
    const left = kept()[slot()];
    const id = left?.rid && left.tree === packTree(tree) ? left.rid : rid();
    keep({ rid: id, tree: packTree(tree) });
    state.sending = tree;
    tell();
    const r = await door.set(who, packTree(tree), id);
    state.sending = null;
    if (r?.ok) {
      keep(null);
      apply(r.data);
      held(state.tree.keys, true);   // QL11: a star taken - each the service holds now that the sky never held (AUDIT QUESTLINES ACTS-5)
      tell();
      return { ok: true, silver: Number(r.data?.silver) || 0 };
    }
    const error = r?.error ?? 'server';
    state.error = error;
    if (!UNHEARD.has(error)) { keep(null); await book.read(); state.error = error; tell(); }
    else {
      retryLater();   // FIRM-RETRY: the kept change is asked again by that read
      tell();
    }
    return { ok: false, error };
  }

  const book = {
    state,
    /** Told whenever the state moves. */
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** The character's tree and purses, from the service - a change kept from before asked first, with its own id. */
    async read() {
      const who = character();
      if (!who) return false;
      if (state.character !== who) { state.character = who; state.tree = { start: null, keys: [] }; }
      const left = kept()[slot()];
      /** AUDIT UICALM-FIRM1 L2 L4: a kept change the service refused when it looked - the player was told it would be
       *  sent again, so they are told it was not */
      let refused = null;
      if (left?.rid && !state.sending) {
        const r = await door.set(who, left.tree, left.rid);
        if (r?.ok || !UNHEARD.has(r?.error)) keep(null);
        if (r?.ok) held(unpackTree(left.tree).keys, true);   // AUDIT QUESTLINES ACTS-5: the stars the lost answer's change took, counted here - the tree this book asked for
        if (!r?.ok && !UNHEARD.has(r?.error)) refused = r?.error ?? 'server';
      }
      const r = await door.state(who);
      if (r?.ok) held(unpackTree(r.data?.tree ?? '').keys);   // AUDIT QUESTLINES ACTS-5: the sky read (the tree `apply` lays), remembered uncounted
      if (r?.ok) { answered(); apply(r.data); if (refused) state.error = refused; tell(); return true; }
      state.error = r?.error ?? 'server';
      if (UNHEARD.has(state.error)) retryLater();
      else answered();   // the service looked and refused (a shut sky, a 404): asking again changes nothing
      state.status = Number.isSafeInteger(r?.status) ? r.status : null;   // UI-CALM: the window says WHY no stars came (a 404 is a service without the Firmament)
      if (state.error === 'firm-closed' || state.error === 'no-session') state.open = false;
      if (state.error === 'firm-closed') state.tree = { start: null, keys: [] };   // AUDIT UICALM-FIRM1 L2 M4: a shut sky is no sky in force
      tell();
      return false;
    },
    /** THE PLAYER CONFIRMED `tree` - asked now, or after the change in flight (coalesced: the newest wins). */
    async commit(tree) {
      const t = { start: tree?.start ?? null, keys: [...(tree?.keys ?? [])] };
      if (respecking) return { ok: false, error: 'firm-busy' };
      if (state.sending) { queued = t; return { ok: true, queued: true }; }
      let r = await send(t);
      while (queued) { const next = queued; queued = null; r = await send(next); }
      return r;
    },
    /** Whether a respec can be paid now: a sky with something in it, the gold in the wallet, nothing on its way. */
    canRespec() {
      const w = wallet?.();
      return !!state.tree?.start && !state.sending && !!realm && !!w && w.gold() >= FIRM_RESPEC_GOLD && typeof door.respec === 'function';
    },
    /** THE RESPEC: every star and the birthsign back, for FIRM_RESPEC_GOLD gold. */
    async respec() {
      const who = character();
      if (!who) return { ok: false, error: 'firm-character' };
      if (state.sending) return { ok: false, error: 'firm-busy' };
      if (!state.tree?.start) return { ok: false, error: 'firm-respec-empty' };
      const w = wallet?.();
      if (!w || w.gold() < FIRM_RESPEC_GOLD) return { ok: false, error: 'firm-gold' };
      if (typeof door.respec !== 'function') return { ok: false, error: 'server' };
      if (!realm) return { ok: false, error: 'realm-needed' };   // AUDIT UICALM-FIRM1 L2 L1: the gold is a realm record's, paid on the service
      const id = rid();
      const region = Number.isSafeInteger(w.region?.()) ? w.region() : null;
      state.sending = { start: null, keys: [] };
      respecking = true;
      tell();
      let r;
      try {
        r = await realm.act({ reserve: walletReserve(w, FIRM_RESPEC_GOLD).reserve, call: (/** @type {any} */ at) => door.respec(who, id, at, region) });
      } finally { state.sending = null; respecking = false; }
      if (r?.ok) {
        keep(null);   // a change kept from before is over a sky that is gone
        if (r.data?.tree !== undefined) apply(r.data); else await book.read();
        tell();
        return { ok: true };
      }
      state.error = r?.error ?? 'server';
      tell();
      return { ok: false, error: state.error };
    },
    /** What is left in each purse under `tree` (the state's own by default). */
    left(tree = state.tree) { return pointsLeft(tree.keys, state.stars, state.craft); },
    /** The tree the window draws from: the one on its way, else the service's. */
    current() { return state.sending ?? state.tree ?? EMPTY_TREE; },
  };
  return book;
}

// ── the page's book ─────────────────────────────────────────────────
let _book = /** @type {ReturnType<typeof createFirmamentBook>|null} */ (null);
/** The host's word: this page's book (online), or null. The window reads it here, so no door has to carry it. */
export function setFirmamentBook(book) { _book = book ?? null; }
export const firmamentBook = () => _book;
