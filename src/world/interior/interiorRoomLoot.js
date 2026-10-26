// OUTDOOR-LOOT, SLICE 2 (2026-10-17, test-harness/outdoor-loot/DESIGN.md section 4, DESIGN-REVIEW R-1, R-3, R-5, D-1, D-1a):
// A BUILDING'S CUPBOARD IS ONE LIST FOR EVERYONE IN THE BUILDING, AND EVERY TAKE OF IT IS A CLAIM THE BUILDING'S SEAT JUDGES.
//
// WHY. WORLD6a made a building a world room and a stranger's cupboard the room's from its first open - and the room's word
// was the container's WHOLE LIST, landed over the reader's by whoever wrote last (interiorShared.js applyInteriorLoot: only the
// reader's own open window was spared). So a close from a window opened before another player's take brought the piece back
// for everyone (a dupe), a close from one opened before a put erased the put (a loss), and two first-opens in one breath each
// rolled their own stock and kept a piece of a roll that was never the room's. LOOT-BULK (#970) made one stale close resurrect
// or erase a whole cupboard; CONTAINER-PEEK (#970) put the resurrected list on every plaque.
//
// THE LAW is PARTY-LOOT's (systems/roomLoot.js, the dungeon's block scenes/roomLootHost.js) with the seat for its host:
// - THE BASE IS CARRIED. A cupboard's stock is `stockHouseContainer` for the player who opened it first - no client can compute
//   it - so the first opener's roll is MINTED ONCE (`b`, with the day `g` as its generation and the SHARED clock for its
//   instant, R-3) and its records travel once. Two first-opens in one breath are two mints: the earlier by the shared clock wins
//   everywhere, then the lower signature, and the loser's window shows its own roll until it closes (AUDIT WORLD4 C1) with its
//   takes refused, lifted back and said. From then on the room's word is TAKES, merged, never a list (roomLoot.js mergeRoomWord).
// - ONE AUTHORITY. The building room's seat - the relay's host, `host.roomHost()`, the socket longest in the room - judges
//   every claim and put, first come (judgeRoomClaim), and says its verdicts ON RECEIPT, in the act handler's own path (R-1:
//   a hidden tab runs no animation frame while its socket still delivers messages, and a building's seat has no stale-seat
//   fallback as the dungeon's host has). The frame may say again; it is never the only sayer. The loser hears ROOM_TAKEN_TEXT.
// - A TAKE IS A CLAIM BY EVERY DOOR. The window, Take all and Stash all move pieces in and out of the container's list; the
//   frame's settle reads that by object identity against what the list held when it was composed (listMovesSince), and anyone
//   but the seat LIFTS the piece out of its pack until the verdict (systems/loot/claimLedger.js): a claim with no verdict in
//   ROOM_CLAIM_TIMEOUT_MS comes back to the claimer's LIST, a verdict that comes later still lands it, and a claim is said
//   again (the same ids) until it is answered - a bulk take is consecutive words of ROOM_CLAIMS_MAX, and the seat answers the
//   claims it hears in words of ROOM_ANSWERS_KEPT verdicts, so none is pushed out of a word (the dungeon's recorded loss).
// - D-1/D-1a: A CLAIM IN FLIGHT AND NOT LAPSED WHEN ITS CLAIMER LEAVES THE BUILDING is kept by the claimer (`leave`): the
//   dungeon's own teardown rule, replicated; the seat's verdict is final, and a limit is main's own (a claim the seat never
//   heard or refused leaves a copy).
// - THE VIEW IS COMPOSED IN PLACE (composeRoomView) - never under this player's open window (C1) - and is the container's
//   `items`, so the plaque (CONTAINER-PEEK) lists the room's one list. An UNBORN cupboard (no state here, no list of its own)
//   is a name alone: the scene cache's list and an opener's roll before its Yes are held aside, no one's word.
// - SHELVES STAY ON WORLD6a'S WHOLE-LIST LAW (DESIGN 4.7, F-1): a purchase is a trade, not a take.
//
// MIXED BUILDS (DESIGN 4.8). A new word carries `d` (the day, equal to `g`) and no `r`, so an older build's landing rule reads
// no list and marks the cupboard unreadable (AUDIT SETS M2). An older build's whole list `{ k, r, d }` is a BIRTH when the room
// has none here (terms { g: d, lv: 1, n: 1, tm: -1 }: no mint beats them) and otherwise that peer's DIFF against its own previous
// word (roomLoot.js legacyDelta) - a take judged as a claim, a put landed as one, an untouched word no change, a first word or the
// memory's only a baseline.
//
// Pure but for the player's hands (liftPiece, givePiece through the claim ledger). Not a DFU member: Daggerfall has one player.
import {
  baseSignature, claimOf, claimWord, composeRoomView, isRoomWord, judgeRoomClaim, legacyCounts, legacyDelta, legacySig, liftPiece, givePiece,
  listMovesSince, mergeRoomWord, pieceCount, roomClaimId, roomClaimOrder, roomState, roomWord, roomTermsBeat, sameRoomTerms, validRoomWord,
  ROOM_ANSWERS_KEPT, ROOM_CLAIM_TIMEOUT_MS, ROOM_CLAIMS_MAX, ROOM_PUT_RESAY_MS, ROOM_TAKEN_TEXT,
} from '../../systems/roomLoot.js';
import { createClaimLedger, CLAIM_KEEP_MS } from '../../systems/loot/claimLedger.js';
import { validLootList, LOOT_LIST_MAX } from '../../systems/loot/loot.js';
import { markRoomCarried } from '../../systems/loot/roomCarriedList.js';
import { neverPeerHanded, peerHanded } from '../../systems/peerWord.js';
import { clearStolen, STOLEN_MARK } from '../../systems/stolenGoods.js';

const clone = (v) => JSON.parse(JSON.stringify(v));
/** How many times a minter says its birth again while no seat answers (every ROOM_PUT_RESAY_MS): a room whose seat can never
 *  answer - an older build holds it - is not flooded for as long as its minter stands in the building. A claim has its own
 *  bound (systems/loot/claimLedger.js CLAIM_KEEP_MS), a put is the dungeon's (said until answered). */
const BIRTH_SAYS_MAX = 40;
/** AUDIT OUTDOOR-LOOT C1: how long an honest earlier birth can still reach a seat after its own mint - its minter says it again
 *  every ROOM_PUT_RESAY_MS, BIRTH_SAYS_MAX times. A lost tie-break gives back what the seat took from, and laid in, the roll
 *  that lost only inside it: past it the birth is a late or a forged one, and the seat's pack is never its to rewrite. Read at
 *  use: roomLoot.js's constants are not yet bound while the import cycle through it loads this module. */
const birthCrossMs = () => BIRTH_SAYS_MAX * ROOM_PUT_RESAY_MS;
/** A piece no peer may be handed (a bound piece, a letter of credit - systems/peerWord.js) never lands as a put. */
const admit = (it) => !neverPeerHanded(it);
/** A mint's identity: its day, level, count and the base's signature - the base of a carried container is one client's roll. */
const mintOf = (st) => `${st.terms.g}|${st.terms.lv}|${st.terms.n ?? 1}|${st.terms.h}`;

/**
 * @param {object} net  the host's wiring, read at the use (a getter never read at construction):
 *   selfId() this client's peer id (null offline: the module is inert); seat() the relay's host; now() the local monotonic
 *   clock; wallNow() the SHARED clock in ms (the relay's - WORLD5), null with none; send(data) the act path (world.js actSend,
 *   through the pending set that heals a refused act); say(text) the mid-screen line; claimed() the memory is due now;
 *   entity() the player (the hands the ledger lifts from and gives to); carried() the ledger keys of the pieces the player
 *   already carries (AUTO-HOLD)
 * @param {any} bag  WORLD6a's bag (interiorShared.js mintInteriorShared): the key, the stamp, the said-once sets
 */
export function createInteriorRoomLoot(net, bag) {
  /** canon -> { canon, st, roll, composed, win, keeping, birthAt, birthSays, legacy, took, gave, local, spoke } */
  const cups = new Map();
  /** put id -> { canon, mint, put, item, saidAt, refused } - this player's puts the seat has not answered, and the refused ones waiting to go home */
  const puts = new Map();
  let claimN = 0;
  let wasSeat = false;
  const entity = net.entity();
  const ledger = createClaimLedger({ entity, say: (t) => net.say(t), newId: () => roomClaimId(net.selfId() ?? 'self', bag.stamp, ++claimN) });

  const live = () => net.selfId() != null;
  /** Whether this client judges: it holds the relay's seat - or no other holds it that it knows of (no welcome yet, a socket
   *  dead; WORLD2's own rule for the dungeon: the authority is self unless a live other host is known), so a take is never
   *  left waiting on a seat that is not there. */
  const isSeat = () => { const s = net.seat(); return s == null || s === net.selfId(); };
  /** Whose word the room's state is: the memory's (no sender - the seat publishes it) and the SEAT's. A birth is anyone's, a claim and a put their claimer's own. */
  const hostWord = (from) => from == null || (net.seat() != null && from === net.seat());
  /** R-3: the SHARED clock - the relay's, the same on every client - never Date.now() or performance.now(), which are this machine's own. */
  const wall = () => net.wallNow() ?? 0;
  const targetOf = (ctx, canon) => (ctx?.containers ?? [])[Number(canon.split(':')[1])] ?? null;
  const cupOf = (canon) => {
    let c = cups.get(canon);
    if (!c) { c = { canon, st: null, roll: null, composed: null, win: null, keeping: null, birthAt: null, birthSays: 0, legacy: new Map(), took: [], gave: [], local: false, spoke: false }; cups.set(canon, c); }
    return c;
  };

  // ── the view ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** AUTO-HOLD: the places (and stored pieces) whose piece this reader already CARRIES are read as taken in its view - it is
   *  never offered a second, which is a copy the ledger would lock with the original; everyone else's list has them. */
  function hidden(cup) {
    const places = new Map(), stored = new Map();
    const carried = net.carried?.();
    if (typeof carried?.keyOf !== 'function') return { places, stored };
    const keys = new Set(carried.keys ?? []);
    cup.st.base.items.forEach((it, i) => { const k = carried.keyOf(it); if (k && keys.has(k) && !cup.st.taken.has(i)) places.set(i, cup.st.base.full[i] ?? 1); });
    cup.st.stored.forEach((it, i) => { const k = carried.keyOf(it); if (k && keys.has(k)) stored.set(cup.st.ids[i], pieceCount(it)); });
    return { places, stored };
  }
  /** This player's claims in flight and puts the seat has not landed, as composeRoomView reads its `pending`. */
  function pendingOf(cup) {
    const p = ledger.pending(cup.canon);
    const h = hidden(cup);
    for (const [i, n] of h.places) p.places.set(i, (p.places.get(i) ?? 0) + n);
    for (const [id, n] of h.stored) p.stored.set(id, (p.stored.get(id) ?? 0) + n);
    for (const pu of puts.values()) if (pu.canon === cup.canon && !pu.refused && pu.mint === mintOf(cup.st)) p.puts.push({ it: pu.item, id: pu.put.id });
    return p;
  }
  /** THE LIST, composed IN PLACE into the container's `items` (a window already bound to the array keeps its rows) - never
   *  under this player's open window (AUDIT WORLD4 C1: yours until you close it). A put the seat refused, or that lost its
   *  mint, goes home to the pack only now that nothing stands open on the container. */
  function compose(ctx, cup) {
    const t = targetOf(ctx, cup.canon);
    if (!t || !cup.st?.base || cup.win) return false;
    for (const [id, p] of [...puts]) if (p.canon === cup.canon && p.refused) { puts.delete(id); givePiece(entity, p.item, pieceCount(p.item)); }
    const { list, seen } = composeRoomView(cup.st.base.items, cup.st.base.full, cup.st, [], pendingOf(cup));
    if (Array.isArray(t.items)) { t.items.length = 0; t.items.push(...list); } else t.items = list;
    markRoomCarried(t.items);   // GOLD-WIRE: a gold drop into it stops at the most one stack rides the room's word in
    t.stockedDate = Math.max(Number.isFinite(t.stockedDate) ? t.stockedDate : 0, cup.st.terms.g);   // the day it was stocked, which only moves forward (AUDIT WORLD6a A3)
    cup.composed = { list: t.items, seen, base: cup.st.base };
    return true;
  }

  // ── what is said ────────────────────────────────────────────────────────────────────────────────────────────────────
  /** A new word carries the day `d` (equal to `g`) for an older build's day check - and no `r`, so it reads no list there (DESIGN 4.8). */
  const dayOf = (rec, st) => ({ ...rec, d: st.terms.g });
  /** The stored pieces a peer may be handed, with their ids: no bound piece, no letter (SS3, HACKED-GOLD), no theft's mark (STOLEN-GOODS S3). */
  function storedOf(cup) {
    const kept = cup.st.stored.map((it, i) => [it, cup.st.ids[i]]).filter(([it]) => admit(it));
    return { s: kept.map(([it]) => clearStolen({ ...it })), si: kept.map(([, id]) => id) };
  }
  /** The seat's word: terms, takes, stored pieces - and `base` the carried base's records (the birth's, and the memory's);
   *  `verdicts` in words of ROOM_ANSWERS_KEPT, so the answers to a Take all of more are consecutive words and none is pushed out. */
  function stateRecords(cup, { base = false, verdicts = [] } = {}) {
    const word = (y) => dayOf(roomWord(cup.canon, cup.st, cup.st.base.h, storedOf(cup), null, y, base ? cup.st.base.records : null), cup.st);
    if (!verdicts.length) return [word([])];
    const out = [];
    for (let i = 0; i < verdicts.length; i += ROOM_ANSWERS_KEPT) out.push(word(verdicts.slice(i, i + ROOM_ANSWERS_KEPT)));
    return out;
  }
  /** A claimer's words: its claims and puts in flight on THIS mint, consecutive words of ROOM_CLAIMS_MAX - never the room's state. */
  function claimRecords(cup) {
    const mint = mintOf(cup.st);
    const q = [], a = [];
    for (const c of ledger.open(cup.canon)) if (c.meta.mint === mint) q.push({ id: c.id, ...(c.p !== undefined ? { p: c.p } : { sp: c.sp }), n: c.n, tm: c.meta.tm });
    for (const p of puts.values()) if (p.canon === cup.canon && !p.refused && p.mint === mint) a.push({ id: p.put.id, it: p.put.it, tm: p.put.tm });
    const out = [];
    for (let i = 0; i < Math.max(q.length, a.length); i += ROOM_CLAIMS_MAX) {
      out.push(dayOf(claimWord(cup.canon, cup.st, cup.st.base.h, q.slice(i, i + ROOM_CLAIMS_MAX), a.slice(i, i + ROOM_CLAIMS_MAX), null), cup.st));
    }
    return out;
  }
  /** The cupboard's word as this client would say it now: the seat's state; a claimer's claims and puts in flight; and a
   *  minter's birth, said again until the seat's word is heard for it. */
  function wordsOf(cup, { verdicts = [], base = false } = {}) {
    if (!cup.st?.base || cup.local) return [];
    if (isSeat()) return stateRecords(cup, { base, verdicts });
    const out = claimRecords(cup);
    if (cup.birthAt != null) out.unshift(...stateRecords(cup, { base: true }));
    return out;
  }
  /** Say it - one act frame to a word, so each is its own to lose and to say again. The first word about a cupboard makes it
   *  the room's here (AUDIT WORLD4 D5: the memory goes out now). */
  function say(cup, opts) {
    const recs = wordsOf(cup, opts);
    if (!recs.length || !bag.locationKey) return false;
    if (!cup.spoke) { cup.spoke = true; bag.seen.add(cup.canon); net.claimed?.(); }
    let ok = true;
    for (const rec of recs) ok = !!net.send({ k: bag.locationKey, l: [rec] }) && ok;
    return ok;
  }

  // ── the seat judges ─────────────────────────────────────────────────────────────────────────────────────────────────
  /** A verdict on one of THIS player's claims or puts: the piece comes to its pack on a grant, a refusal is said, a refused
   *  put waits to go home (never from under an open window). */
  function resolveMine(id, g) {
    const p = puts.get(id);
    if (p) { if (g) { puts.delete(id); const cup = cups.get(p.canon); if (cup) gaveIn(cup, p.item, p.mint, id); } else p.refused = true; return; }
    ledger.resolve(id, g);
  }
  /** THE SEAT GRANTS: every claim and put the state holds unanswered, in the order they reached it (or, at a seat's change,
   *  roomClaimOrder's), judged first come; `reanswer` the claims it already answered and is asked again (a lost verdict is
   *  recovered by the claimer's re-ask, never judged twice). Answers every verdict, to be said. */
  function judge(ctx, cup, order = null, reanswer = []) {
    const st = cup.st;
    const claims = [...st.claims.values()];
    if (order) claims.sort(order);
    const now = wall();
    const verdicts = claims.map((cl) => [cl.id, judgeRoomClaim(st, st.base.items.length, st.base.full, !('it' in cl) && Number.isFinite(cl.tm) && now - cl.tm >= CLAIM_KEEP_MS / 2 ? { ...cl, stale: true } : cl, admit)]);   // AUDIT OUTDOOR-LOOT D5: a take claim old enough that its claimer may have given it up (CLAIM_KEEP_MS) is refused - granted, its piece left the room for nobody
    for (const id of reanswer) if (st.answers.has(id) && !verdicts.some(([v]) => v === id)) verdicts.push([id, /** @type {number} */ (st.answers.get(id))]);
    for (const [id, g] of verdicts) resolveMine(id, g);
    compose(ctx, cup);
    return verdicts;
  }

  // ── a word lands ────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The pieces of a word a peer may hand us, aligned: no bound piece, no letter, no theft's mark (SS3, HACKED-GOLD, STOLEN-GOODS S3). */
  const landed = (list) => peerHanded(list).map((it) => clearStolen(it));
  function unreadable(cup) { bag.seen.add(cup.canon); bag.unreadable.add(cup.canon); return 0; }
  /** The state's mint changed. `lost`: it was a LOST tie-break (the other first-open of the day won) - this client's claims on it
   *  are refused (the piece lifted stays out) and so are the seat's own takes from it, lifted back out of its pack (a piece of a
   *  roll that never was the room's). Else a NEW DAY's stock replaced it (a restock): what was taken stays taken, and a claim in
   *  flight at the turn of the day is let go quietly. A put on the old mint goes home with the next compose either way. */
  function dropOld(cup, lost, was = null) {
    const mint = mintOf(cup.st);
    for (const c of ledger.open(cup.canon)) if (c.meta.mint !== mint) ledger.resolve(c.id, 0, { withdrawn: !lost });
    for (const p of puts.values()) if (p.canon === cup.canon && p.mint !== mint) p.refused = true;
    if (lost) {
      let said = false;
      const now = net.now(), cross = birthCrossMs();
      for (const t of cup.took) if (t.mint !== mint && now - t.at <= cross) { liftPiece(entity, t.obj, t.k); said = true; }
      for (const g of cup.gave) if (g.mint !== mint && now - g.at <= cross && was?.ids?.includes(g.id)) givePiece(entity, g.item, pieceCount(g.item));   // AUDIT OUTDOOR-LOOT C3: a put the losing roll still stored goes home - the roll that won never held it (one another took from it meanwhile is that taker's)
      if (said) net.say(ROOM_TAKEN_TEXT);
    }
    cup.took = cup.took.filter((t) => t.mint === mint);
    cup.gave = cup.gave.filter((g) => g.mint === mint);
    cup.birthAt = null;   // the birth this client was saying is not the room's
  }

  /** Answers 1 when the word was the room's about this cupboard, else 0 (a word refused whole, or one about nothing here). */
  function land(ctx, rec, from, today) {
    const canon = rec.k;
    if (!targetOf(ctx, canon)) return 0;
    const cup = cupOf(canon);
    // AUDIT WORLD6a A2/B2: the day is projected like the list - a generation that is no whole number, or past tomorrow, refuses the word WHOLE
    // (not unreadable: M2's word is for a list this build cannot READ); the day only moves forward (A3: roomTermsBeat's newer generation wins)
    if (rec.g !== undefined && !(Number.isSafeInteger(rec.g) && rec.g >= 0 && (today == null || rec.g <= today + 1))) return 0;
    if (isRoomWord(rec)) return landWord(ctx, cup, rec, from);
    if (rec.g !== undefined) return 0;
    return landLegacy(ctx, cup, rec, from, today);
  }
  function landWord(ctx, cup, rec, from) {
    const w = validRoomWord(rec);
    if (!w) return unreadable(cup);   // a piece from a newer game, a base with no signature: AUDIT SETS M2
    if (w.b) {
      w.b = landed(w.b);
      if (baseSignature(w.b) !== w.h) return unreadable(cup);   // a base this build reads differently, or a hostile one: never landed as a list
    }
    const fromHost = hostWord(from);
    // WHO SAYS WHAT: the state - the takes, the stored pieces, the verdicts - is the SEAT's word (and the memory's); a birth is
    // anyone's; a claim and a put are their claimer's own, in their claimer's name (claimOf)
    if (!fromHost) { w.x = []; w.c = []; w.y = []; w.s = null; w.si = null; }
    w.q = from == null ? [] : w.q.filter((cl) => claimOf(cl.id, from));
    w.a = from == null ? [] : w.a.filter((p) => claimOf(p.id, from)).map((p) => (p.it ? { ...p, it: clearStolen(p.it) } : p));   // a put of nothing is refused at the verdict
    if (w.s) { const keep = w.s.map((it) => admit(it)); w.si = w.si.filter((_, i) => keep[i]); w.s = landed(w.s); }
    const mine = isSeat();
    const before = cup.st;
    if (!before && !w.b) return 0;   // terms with no base: UNBORN here until the base arrives
    const reanswer = mine && before ? [...w.q, ...w.a].map((c) => c.id).filter((id) => before.answers.has(id)) : [];
    const { state, answered } = mergeRoomWord(before, w);
    const adopted = state !== before;
    cup.st = state;
    if (adopted) { cup.local = false; dropOld(cup, before?.terms.g === state.terms.g, before); }
    if (!adopted && before && !(sameRoomTerms(w, state.terms) && w.h === state.terms.h)) {
      // another mint that loses: its claims are on a base that is gone (heard as stale); the seat refuses them now - and a
      // competing BIRTH is answered with the base that won, so its minter (who may have missed the seat's) converges on it
      if (mine) {
        const verdicts = w.q.length || w.a.length ? judge(ctx, cup) : [];
        if (verdicts.length || w.b) say(cup, { verdicts, base: !!w.b });
      }
      return 1;
    }
    bag.unreadable.delete(cup.canon);
    bag.seen.add(cup.canon);
    if (fromHost && from != null && cup.birthAt != null) cup.birthAt = null;   // the seat's word is heard for this birth
    for (const [id, g] of answered) resolveMine(id, g);
    let verdicts = [];
    if (mine && (state.claims.size || reanswer.length)) verdicts = judge(ctx, cup, null, reanswer);
    else compose(ctx, cup);
    // R-1: the seat's verdicts leave ON RECEIPT, here, in the act handler's own path - and a birth the seat adopted is its state now
    const birth = !!w.b && !fromHost;   // a minter keeps saying its birth until the seat's word is heard for it: answered every time, with the base that stands
    if (mine && (verdicts.length || birth)) say(cup, { verdicts, base: birth });
    return 1;
  }

  // An older build's whole list: the birth, or that peer's diff against its own previous word (DESIGN 4.8)
  function landLegacy(ctx, cup, rec, from, today) {
    if (!Number.isFinite(rec.d) || rec.d < 0 || (today != null && rec.d > today + 1)) return 0;
    const list = validLootList(rec.r);
    if (!list) return unreadable(cup);
    const items = landed(list);
    const who = from ?? 'memory';
    if (cup.st && cup.st.terms.g > Math.floor(rec.d)) return 1;   // A3: yesterday's word never beats today's
    if (!cup.st || cup.st.terms.g < Math.floor(rec.d)) {   // no state for that day: the BIRTH - its terms no mint beats, its list the carried base
      const w = { g: Math.floor(rec.d), lv: 1, n: 1, tm: -1, h: baseSignature(items), b: clone(items), x: [], c: [], s: null, si: null, q: [], a: [], y: [] };
      const was = cup.st;
      cup.st = mergeRoomWord(was, w).state;
      cup.local = false; cup.legacy = new Map();
      if (was) dropOld(cup, false);
      bag.unreadable.delete(cup.canon); bag.seen.add(cup.canon);
      cup.legacy.set(who, legacyCounts(items));
      compose(ctx, cup);
      return 1;
    }
    bag.unreadable.delete(cup.canon); bag.seen.add(cup.canon);
    const prev = cup.legacy.get(who) ?? null;
    const delta = legacyDelta(prev, items);
    cup.legacy.set(who, delta.counts);
    if (from == null || !prev || !isSeat()) return 1;   // the memory's and a peer's first word are baselines; the seat's next word carries the change
    const st = cup.st;
    const judged = (cl) => judgeRoomClaim(st, st.base.items.length, st.base.full, cl, admit);
    for (const { sig, n } of delta.takes) {
      let left = n;
      st.base.items.forEach((it, i) => {
        if (left <= 0 || st.taken.has(i) || legacySig(it) !== sig) return;
        const g = judged({ id: `legacy:${from}:${++claimN}`, p: i, n: Math.min(left, st.counts.get(i) ?? st.base.full[i] ?? 1) });
        left -= g;
      });
      st.stored.map((it, i) => [it, st.ids[i]]).forEach(([it, id]) => {
        if (left <= 0 || legacySig(it) !== sig) return;
        left -= judged({ id: `legacy:${from}:${++claimN}`, sp: id, n: Math.min(left, pieceCount(it)) });
      });
    }
    for (const { n, it } of delta.puts) judged({ id: `legacy:${from}:${++claimN}`, it: Number.isInteger(it.stackCount) ? { ...it, stackCount: n } : { ...it }, tm: wall() });
    compose(ctx, cup);
    say(cup);
    return 1;
  }

  // ── what a window did ───────────────────────────────────────────────────────────────────────────────────────────────
  /** THE TAKES AND THE PUTS a container's list shows since it was composed, read by object identity (listMovesSince). Answers
   *  whether anything moved. Runs every frame - under an open window too, so a Take all is claimed as it is made and only the
   *  compose waits (C1). */
  function settle(ctx, cup) {
    const t = targetOf(ctx, cup.canon);
    if (!cup.st?.base || !cup.composed || !t || cup.composed.list !== t.items) return false;
    const { takes, grows, puts: laid } = listMovesSince(cup.composed.seen, t.items, () => false);
    for (const tk of takes) takeOne(cup, tk);
    for (const g of grows) putOne(cup, g.obj, g.by, false);   // laid onto one of the room's stacks: its own entry stands
    for (const obj of laid) putOne(cup, obj, pieceCount(obj), true);
    return takes.length > 0 || grows.length > 0 || laid.length > 0;
  }
  /** WHAT A TAKE PUT IN THE HANDS, to lift on a refusal and give on a grant: the shown record itself when it moved whole, else
   *  the half a split minted off it - marked as the window marked it (a stranger's cupboard: stolenGoods.js takenFromKeeping).
   *  The record left in the cupboard is never marked, and a stolen piece stacks only with stolen kin, so a refused split lifted
   *  nothing (the taker kept the pieces) or lifted an honest stack of its kind in place of the marked half. */
  const takenAs = (cup, obj) => (cup.keeping?.has(obj) && ![entity.items, entity.bagItems].some((l) => Array.isArray(l) && l.includes(obj)) ? { ...obj, [STOLEN_MARK]: true } : obj);
  /** `k` of a shared piece taken. A base that is gone (the other mint won) refuses it: lifted back out of the pack and said.
   *  The seat judges its own where it stands; anyone else lifts the piece and claims it, and has it on the grant alone. */
  function takeOne(cup, { obj: shown, info, k }) {
    const st = cup.st, obj = takenAs(cup, shown);
    if (cup.composed.base !== st.base) { liftPiece(entity, obj, k); net.say(ROOM_TAKEN_TEXT); return; }
    const ref = info.p !== undefined ? { p: info.p } : { sp: info.sp };
    if (isSeat()) {
      const g = judgeRoomClaim(st, st.base.items.length, st.base.full, { id: roomClaimId(net.selfId() ?? 'self', bag.stamp, ++claimN), ...ref, n: k, tm: wall() }, admit);
      if (g < k) { liftPiece(entity, obj, k - g); if (!g) net.say(ROOM_TAKEN_TEXT); }
      if (g > 0) { cup.took.push({ obj, k: g, mint: mintOf(st), at: net.now() }); if (cup.took.length > LOOT_LIST_MAX) cup.took.shift(); }
      return;
    }
    const c = ledger.take(cup.canon, ref, obj, k, { mint: mintOf(st), tm: wall() }, net.now());
    st.claims.set(c.id, { id: c.id, ...ref, n: k, tm: c.meta.tm });   // heard here too: a seat that comes to this client judges it with the rest
  }
  /** AUDIT OUTDOOR-LOOT C3: a put the room stored on this mint (the seat's own, or one it granted this client) - given home if the mint
   *  loses its tie-break (dropOld), as `took` is lifted. */
  function gaveIn(cup, item, mint, id) {
    cup.gave.push({ item, mint, id, at: net.now() });
    if (cup.gave.length > LOOT_LIST_MAX) cup.gave.shift();
  }
  /** A piece laid in the container (`n` of it): the seat lands it where it stands, anyone else says it to the seat, again until answered. */
  function putOne(cup, obj, n, laid) {
    const st = cup.st;
    const piece = n === pieceCount(obj) ? obj : { ...obj, stackCount: n };
    const put = { id: roomClaimId(net.selfId() ?? 'self', bag.stamp, ++claimN), it: clearStolen(clone(piece)), tm: wall() };
    if (laid) cup.composed.seen.set(obj, { sp: put.id, n: pieceCount(obj) });   // the piece is the container's now, and a take of it is read as one
    if (cup.composed.base !== st.base || !admit(obj)) { puts.set(put.id, { canon: cup.canon, mint: mintOf(st), put, item: piece, saidAt: net.now(), at: net.now(), refused: true }); return; }   // a mint that is gone, a piece no peer may be handed: back to the pack
    if (isSeat()) {
      if (!judgeRoomClaim(st, st.base.items.length, st.base.full, { ...put, it: put.it }, admit)) puts.set(put.id, { canon: cup.canon, mint: mintOf(st), put, item: piece, saidAt: net.now(), at: net.now(), refused: true });
      else gaveIn(cup, piece, mintOf(st), put.id);
      return;
    }
    puts.set(put.id, { canon: cup.canon, mint: mintOf(st), put, item: piece, saidAt: net.now(), at: net.now(), refused: false });
    st.claims.set(put.id, put);
  }

  /** THE BIRTH: the held roll MINTED as the room's - terms { g: today, lv: 1, n: 1, tm: the shared clock }, its records the carried
   *  base - composed into the container and said. Nothing is minted where the room already has this day's state; a roll past
   *  the cap stays its opener's own (AUDIT WORLD4 A2/B2/D1: said once, out loud). A birth by anyone but the seat is said
   *  again until the seat's word is heard for it. */
  function mint(ctx, cup) {
    const roll = cup.roll;
    const t = targetOf(ctx, cup.canon);
    cup.roll = null;
    if (!roll || !t) return false;
    if (cup.st && cup.st.terms.g >= roll.today) return false;
    const own = () => { cup.local = true; t.items = roll.items; t.stockedDate = roll.today; return true; };
    if (roll.items.length > LOOT_LIST_MAX) {
      if (!bag.tooBig.has(cup.canon)) { bag.tooBig.add(cup.canon); console.warn(`[loot] ${cup.canon} holds ${roll.items.length} items, more than the room can carry (${LOOT_LIST_MAX}); it stays yours alone`); }
      return own();
    }
    const records = peerHanded(roll.items).map((it) => clearStolen({ ...it }));
    const one = validLootList(clone(records));
    if (!one || one.length !== records.length) return own();
    const base = landed(one);
    const was = cup.st;
    cup.st = mergeRoomWord(was, { g: roll.today, lv: 1, n: 1, tm: wall(), h: baseSignature(base), b: base, x: [], c: [], s: null, si: null, q: [], a: [], y: [] }).state;
    cup.local = false;
    bag.unreadable.delete(cup.canon); bag.seen.add(cup.canon);
    if (was) dropOld(cup, false);   // a restock: the new day's stock replaces yesterday's
    cup.birthAt = net.now(); cup.birthSays = 0;   // said again until a seat's word is heard for it (a seat is not heard - the frame says it again only for a client that is none)
    compose(ctx, cup);
    say(cup, { base: true });
    return true;
  }

  // ── the doors ───────────────────────────────────────────────────────────────────────────────────────────────────────
  return {
    live,
    /** The arm rolled a stranger's cupboard: HELD, never written to the container - the roll is no one's word until its Yes
     *  (AUDIT WORLD6a A5: "No claims nothing"). Answers false offline: the arm writes it as it always did. */
    roll(ctx, canon, items, today) {
      if (!live() || !targetOf(ctx, canon)) return false;
      const cup = cupOf(canon);
      cup.roll = { items, today };
      if (!items.length) mint(ctx, cup);   // a roll of nothing is the room's at once: the arm does nothing (DFU: "If no contents, do nothing"), asks no Yes, and the empty cupboard stands for the day - a press never re-rolls it
      return true;
    },
    /** Yes: the held roll is MINTED as the room's. */
    birth(ctx, canon) { const cup = cups.get(canon); return !!cup?.roll && live() && mint(ctx, cup); },
    /** A window stands open on the container: nothing is composed under it, and its takes are claimed as they are made. */
    open(canon, win, keeping = null) { const cup = cupOf(canon); cup.win = win; cup.keeping = keeping instanceof Set ? keeping : null; bag.openKey = canon; bag.openWin = win; },   // `keeping`: a stranger's cupboard's theft keeping (stolenGoods.js) - what a take of it marked
    /** A cupboard no word has made the room's here and that holds no list of its own: its plaque is a name. */
    unborn(canon) { return !cups.get(canon)?.st; },
    land: (ctx, rec, { from = null, today = null } = {}) => land(ctx, rec, from, today),
    /** The mount: the scene cache's list of a stranger's cupboard - or whatever the context was built with - is not the
     *  room's word. Set aside (the cupboard is unborn here until the room speaks or this client's own birth); a cupboard
     *  the room has spoken for is recomposed over whatever the cache laid. */
    aside(ctx) {
      if (!live()) return;   // offline the cache's list IS the player's own cupboard
      (ctx?.containers ?? []).forEach((t, i) => {
        const cup = cups.get(`container:${i}`);
        if (cup?.st?.base) { compose(ctx, cup); return; }
        if (t && Array.isArray(t.items) && !cup?.local) { t.items = null; t.stockedDate = 0; }
      });
    },
    /** What this client would say of the cupboard now: the seat's state with the base (the memory's word, and the heal of a
     *  word the act budget refused - world.js re-reads the module's CURRENT word); a claimer's claims and puts in flight. */
    records(ctx, canon) {
      const cup = cups.get(canon);
      if (!cup?.st?.base || cup.local || !live()) return [];
      return isSeat() ? stateRecords(cup, { base: true }) : wordsOf(cup);
    },
    /** The frame: the seat's change, a window's close, the claims' lapse and re-ask, a put's and a birth's re-say. The seat's
     *  verdicts do NOT wait for it (R-1) - this only says again. */
    frame(ctx, now, open) {
      if (!live()) return;
      const nowSeat = isSeat();
      if (nowSeat && !wasSeat) for (const cup of cups.values()) if (cup.st?.claims.size && cup.st.base) say(cup, { verdicts: judge(ctx, cup, roomClaimOrder) });   // the last seat's unanswered claims, in one order whoever takes the seat
      wasSeat = nowSeat;
      const due = new Set();
      for (const cup of cups.values()) {
        if (cup.win && (!open(cup.win) || cup.win.done)) {
          // AUDIT WORLD6a A3: gone means gone from the STACK, not from the slot - a window laid over this one leaves it open
          if (bag.openWin === cup.win) { bag.openKey = null; bag.openWin = null; }
          cup.win = null;
          if (cup.st?.base) { if (settle(ctx, cup)) due.add(cup); compose(ctx, cup); }
          cup.keeping = null;   // the window's keeping read its last takes in that settle
        } else if (cup.st?.base && settle(ctx, cup)) due.add(cup);
      }
      const { lapsed, resay, expired } = ledger.due(now);
      for (const c of expired) cups.get(c.container)?.st?.claims.delete(c.id);   // given up: a seat that comes to this client must not judge it, and the room lose the piece to a claimer who let it go
      for (const c of lapsed) { const cup = cups.get(c.container); if (cup?.st?.base) compose(ctx, cup); }   // the piece comes back to the claimer's LIST, not its pack
      for (const c of resay) { const cup = cups.get(c.container); if (cup) due.add(cup); }
      if (!nowSeat) {
        for (const p of puts.values()) if (!p.refused && now - p.saidAt >= ROOM_PUT_RESAY_MS) { p.saidAt = now; const cup = cups.get(p.canon); if (cup) due.add(cup); }
        for (const cup of cups.values()) if (cup.birthAt != null && cup.birthSays < BIRTH_SAYS_MAX && now - cup.birthAt >= ROOM_PUT_RESAY_MS) { cup.birthAt = now; cup.birthSays++; due.add(cup); }
      }
      for (const cup of due) say(cup);
    },
    /** D-1/D-1a: THE CLAIMER'S OWN TEARDOWN. A take made this frame is claimed and said first; then every claim in flight and
     *  not lapsed goes with its claimer - the dungeon's own rule: the seat's verdict is final, and the piece is given. */
    leave(ctx) {
      if (!live()) return;
      for (const cup of cups.values()) if (cup.st?.base && settle(ctx, cup)) say(cup);
      const now = net.now();
      ledger.keep(() => true, now);
      // AUDIT OUTDOOR-LOOT C2: a put the seat refused, or never answered in ROOM_CLAIM_TIMEOUT_MS of saying it again (an older seat
      // judges nothing; a dead one before the relay's handover), goes home with its putter - it was in no list but the putter's
      for (const [id, p] of [...puts]) if (p.refused || now - p.at >= ROOM_CLAIM_TIMEOUT_MS) { puts.delete(id); givePiece(entity, p.item, pieceCount(p.item)); }
    },
    /** Tests only. */
    cups, puts, ledger,
  };
}
