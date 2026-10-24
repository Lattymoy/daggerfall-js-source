// @ts-check
// OUTDOOR-LOOT (2026-10-17, test-harness/outdoor-loot/DESIGN.md 6.3, DESIGN-REVIEW D-1/D-1a/R-2): THE CLAIMER'S LEDGER - the
// half of PARTY-LOOT's claim law that a take of a shared piece leaves in the TAKER'S hands, free of any transport, so a
// peer's foe's body (net/bodyLoot.js, scenes/bodyLootHost.js) and a building's cupboard use one.
//
// A TAKE OF A SHARED PIECE IS A CLAIM (systems/roomLoot.js): the window, Take all, the quick door's row and its lot all
// move the piece into the pack, and the container's one authority says who has it, first come. Until its verdict the
// piece is LIFTED back out of the taker's hands (liftPiece - the record, the stack it merged into, the bag, the purse)
// and the claim stands in this ledger; the grant gives it (givePiece, never a piece the taker carries), a refusal says
// ROOM_TAKEN_TEXT unless a sibling claim of the taker's on that place was granted, and nothing else moves a piece.
//   - A claim with no verdict inside ROOM_CLAIM_TIMEOUT_MS LAPSES: its piece reads as back in the container for its
//     taker (`pending` no longer counts it), and the claim stands - a verdict that comes later still lands.
//   - A claim is SAID AGAIN, with the same id, until it is answered (`due`): the authority answers a claim it already
//     judged from its own ledger, so a verdict that was lost on the wire (a dead link, a socket mid-reconnect) is
//     recovered by the re-ask and never judged twice (DESIGN-REVIEW R-2).
//   - A claim is GIVEN UP past CLAIM_KEEP_MS: nothing lands after it, and nothing dupes.
//   - D-1: PARTY-LOOT's own rule, replicated - "whatever the current dungeon logic is doing on main": a claim still in
//     flight and NOT lapsed when its CLAIMER'S OWN teardown comes (`keep`) goes with the claimer - its lifted piece is
//     given - and is RESOLVED in the ledger, so a verdict that comes later lands nothing more. A lapsed claim does not.
//     The authority's verdict is final: there is no void for a verdict that never left.
// THE LEGACY ASK: an older owner answers a take (`take: 1`) with a grant of its whole pile at a time of its own choosing.
// The ask is latched here by body, counted, and a grant lands for an ask outstanding at any lateness inside
// LEGACY_ASK_KEEP_MS - with the puppet or without it (a room change, a swept owner).
// Pure but for the player's hands. Not a DFU member: Daggerfall has one player.
import { liftPiece, givePiece, ROOM_CLAIM_TIMEOUT_MS, ROOM_TAKEN_TEXT, ROOM_CLAIMS_MAX } from '../roomLoot.js';

/** How long a claim waits for its verdict: any verdict inside it lands, past it the claim is given up. */
export const CLAIM_KEEP_MS = 300_000;
/** A claim with no verdict is said again after this, then twice as long, up to CLAIM_RESEND_MAX_MS. */
export const CLAIM_RESEND_MS = 1000;
export const CLAIM_RESEND_MAX_MS = 8000;
/** How long a legacy grant may be late: the claim's own bound. */
export const LEGACY_ASK_KEEP_MS = CLAIM_KEEP_MS;
/** The most claims (open, or answered and kept to refuse a duplicate verdict) the ledger holds - the oldest answered go first. */
export const CLAIMS_KEPT_MAX = 512;
/** The most bodies a legacy ask is latched for. */
const ASKS_KEPT_MAX = 256;

/**
 * @typedef {object} Claim
 * @property {string} id         the claim's own id (<claimer>:<stamp>:<n> - roomClaimId): unique, and names its claimer
 * @property {string} container  the container, in the caller's terms (a body: owner, number and generation)
 * @property {number} [p]        a base place of the container,
 * @property {string} [sp]       or a stored piece's id
 * @property {number} n          the count claimed
 * @property {any} item          the piece the taker lifted (what the grant gives back)
 * @property {number} give       how many of it the lift found - nought for a piece used straight off the container
 * @property {number} at         when it was made, on the caller's clock
 * @property {boolean} lapsed    no verdict inside the timeout: back in the container's view
 * @property {boolean} done      answered, or kept - landed once, whatever comes after
 * @property {number} wait       the gap before the next re-ask
 * @property {number} nextAt     when the next re-ask is due
 * @property {string} [by]       the one peer whose verdict lands it (the container's authority)
 * @property {any} meta          whatever the transport needs to say it again (the owner, the cell, the number)
 */

/**
 * @param {object} io
 * @param {any} io.entity                 the player whose hands these are (the pack, the bag, the purse)
 * @param {(line: string) => void} [io.say]  the loser's line
 * @param {() => string} io.newId         a fresh claim id
 * @param {number} [io.keepMs] @param {number} [io.lapseMs] @param {number} [io.resendMs] @param {number} [io.resendMax]
 */
export function createClaimLedger({ entity, say = () => {}, newId, keepMs = CLAIM_KEEP_MS, lapseMs = ROOM_CLAIM_TIMEOUT_MS, resendMs = CLAIM_RESEND_MS, resendMax = CLAIM_RESEND_MAX_MS }) {
  /** @type {Map<string, Claim>} */
  const claims = new Map();
  /** The places a claim of this player's was granted on (`container|place`): a sibling's refusal is then no news. */
  const won = new Set();
  /** The legacy ask latch: a body's key -> the times the take frames left, oldest first. @type {Map<string, number[]>} */
  const asks = new Map();

  const placeKey = (/** @type {Claim} */ c) => `${c.container}|${c.p ?? c.sp}`;
  const tell = (/** @type {string} */ line) => { try { say?.(line); } catch { /* a line that cannot be said is not the claim's */ } };

  /** A take of `n` of `item` off a container: lifted out of the taker's hands now, stood as a claim until its verdict. */
  function take(/** @type {string} */ container, /** @type {{ p?: number, sp?: string }} */ ref, /** @type {any} */ item, /** @type {number} */ n, /** @type {{ by?: string, [k: string]: any }} */ meta, /** @type {number} */ now) {
    const give = liftPiece(entity, item, n);
    const { by, ...rest } = meta ?? {};
    /** @type {Claim} */
    const c = { id: newId(), container, ...(ref.p !== undefined ? { p: ref.p } : { sp: ref.sp }), n, item, give, at: now, lapsed: false, done: false, wait: resendMs, nextAt: now + resendMs, ...(by !== undefined ? { by } : {}), meta: rest };
    claims.set(c.id, c);
    trim();
    return c;
  }

  /** The claims in flight on a container, as `composeRoomView` reads its `pending`: a base place's count, a stored
   *  piece's - read as taken in the taker's own view until the verdict (a lapsed claim no longer is). */
  function pending(/** @type {string} */ container) {
    /** @type {Map<number, number>} */ const places = new Map();
    /** @type {Map<string, number>} */ const stored = new Map();
    for (const c of claims.values()) {
      if (c.container !== container || c.done || c.lapsed) continue;
      if (c.p !== undefined) places.set(c.p, (places.get(c.p) ?? 0) + c.n);
      else if (c.sp !== undefined) stored.set(c.sp, (stored.get(c.sp) ?? 0) + c.n);
    }
    return { places, stored, puts: /** @type {any[]} */ ([]) };
  }

  /** A verdict on a claim of this player's: the piece comes to the pack on a grant (no more than came out of it), a
   *  refusal is said unless a sibling claim on that place was granted, a withdrawn one lapses quietly. `from`, when the
   *  claim names its authority, must be it. Answers the claim, or null for one this ledger never made, has answered
   *  already (a duplicate lands nothing: AUDIT WORLD6b-iii(c) B8) or was named by anyone but its authority. */
  function resolve(/** @type {string} */ id, /** @type {number} */ g, /** @type {{ from?: string, withdrawn?: boolean }} */ { from, withdrawn = false } = {}) {
    const c = claims.get(id);
    if (!c || c.done) return null;
    if (from !== undefined && c.by !== undefined && c.by !== from) return null;
    c.done = true;
    const key = placeKey(c);
    if (g > 0) {
      givePiece(entity, c.item, Math.min(g, c.give));
      won.add(key);
      while (won.size > ROOM_CLAIMS_MAX * 4) won.delete(/** @type {string} */ (won.values().next().value));
    } else if (!withdrawn && !won.has(key)) tell(ROOM_TAKEN_TEXT);
    return c;
  }

  /** The clock's work: the claims that have just lapsed (their piece is back in their container's view), the claims
   *  to say again (the same ids, `wait` doubling), and the claims given up past the keep. */
  function due(/** @type {number} */ now) {
    /** @type {Claim[]} */ const lapsed = [], resay = [], expired = [];
    for (const c of [...claims.values()]) {
      if (now - c.at > keepMs) { claims.delete(c.id); if (!c.done) expired.push(c); continue; }
      if (c.done) continue;
      if (!c.lapsed && now - c.at >= lapseMs) { c.lapsed = true; lapsed.push(c); }
      if (now >= c.nextAt) { c.wait = Math.min(resendMax, c.wait * 2); c.nextAt = now + c.wait; resay.push(c); }
    }
    return { lapsed, resay, expired };
  }

  /** D-1/D-1a: THE CLAIMER'S OWN TEARDOWN - every claim still in flight and not lapsed (and `which`, when given, names)
   *  goes with its claimer: its lifted piece is given, and the claim is resolved here, so a verdict that comes later lands
   *  nothing more. A claim older than the timeout is lapsed whether or not the clock's work (`due`) has marked it yet - a
   *  tab asleep for a minute ticks nothing. Answers the claims kept. */
  function keep(/** @type {(c: Claim) => boolean} */ which = () => true, /** @type {number | null} */ now = null) {
    /** @type {Claim[]} */ const kept = [];
    for (const c of claims.values()) {
      if (c.done || c.lapsed || (now !== null && now - c.at >= lapseMs) || !which(c)) continue;
      c.done = true;
      givePiece(entity, c.item, c.give);
      kept.push(c);
    }
    return kept;
  }

  /** The claims not yet answered on a container, or on any. */
  function open(/** @type {string | null} */ container = null) {
    return [...claims.values()].filter((c) => !c.done && (container === null || c.container === container));
  }
  const get = (/** @type {string} */ id) => claims.get(id) ?? null;

  /** The answered claims are kept (to refuse a duplicate verdict) to a bound; the oldest of them go first. */
  function trim() {
    if (claims.size <= CLAIMS_KEPT_MAX) return;
    for (const c of [...claims.values()]) {
      if (claims.size <= CLAIMS_KEPT_MAX) break;
      if (c.done) claims.delete(c.id);
    }
  }

  // ---- the legacy ask -----------------------------------------------------------------------------------------------
  /** A take frame left for `key` (a body): latched, counted. */
  function ask(/** @type {string} */ key, /** @type {number} */ now) {
    const list = asks.get(key) ?? [];
    list.push(now);
    asks.delete(key);
    asks.set(key, list);
    while (asks.size > ASKS_KEPT_MAX) asks.delete(/** @type {string} */ (asks.keys().next().value));
  }
  /** Whether a take for `key` left inside the last `windowMs` (AUDIT WORLD6b-iii(c) B8: one ask in flight). */
  function askedWithin(/** @type {string} */ key, /** @type {number} */ now, /** @type {number} */ windowMs) {
    const list = asks.get(key);
    return !!list && list.some((t) => now - t <= windowMs);
  }
  /** A grant for `key` arrived: spends the oldest ask still inside LEGACY_ASK_KEEP_MS and answers whether there was one -
   *  at any lateness inside it, and once per ask (a second grant for one ask is refused). */
  function landAsk(/** @type {string} */ key, /** @type {number} */ now, keepFor = LEGACY_ASK_KEEP_MS) {
    const list = asks.get(key);
    if (!list) return false;
    while (list.length && now - list[0] > keepFor) list.shift();
    const had = list.length > 0;
    if (had) list.shift();
    if (!list.length) asks.delete(key);
    return had;
  }

  /** Everything forgotten - the pool is going away (after `keep` has said what goes with it). */
  function clear() { claims.clear(); won.clear(); asks.clear(); }

  return { take, pending, resolve, due, keep, open, get, ask, askedWithin, landAsk, clear, get size() { return claims.size; } };
}
