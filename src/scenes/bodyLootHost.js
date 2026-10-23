// OUTDOOR-LOOT (2026-10-17; test-harness/outdoor-loot/DESIGN.md section 3 and 7, DESIGN-REVIEW D-1/D-1a/R-1/R-2): THE FOE-BODY
// BLOCK of the encounter pool (scenes/exteriorFoes.js createExteriorFoes) - the street's and a building's, one pool.
// HOST-SPLIT: the pool WIRES this (`createBodyLoot(handles)`, constructed once) and the block owns the state and the frame; the
// wire it speaks is net/bodyLoot.js, the claimer's half of the law is systems/loot/claimLedger.js.
//
// A PEER'S FOE'S BODY IS ONE LIST, TAKEN BY CLAIMS ITS OWNER JUDGES. The report: "I can still click on an 'Empty' body and
// wipe out loot for a party member". The plaque read "Empty" over a full body (a puppet's contents door answered null), and
// the press asked the owner for the WHOLE pile unseen; a grant more than TAKE_WINDOW_MS late was refused with nothing sent
// back, and the loot was destroyed. Two sides of one body:
//   - THE OWNER'S STATE, minted lazily online (its first foes frame, its own take, a peer's peek/claim/take): the body's
//     PLACES - the shareable pieces in pile order, at most ROOM_BASE_MAX, append-only (a place is never re-used and never
//     un-taken) - their records, minted counts and takes (systems/roomLoot.js roomState); the pieces that never ride (a
//     bound piece, a letter of credit, a piece the projection refuses or no frame holds) are its `own`, shown in its view
//     and never dropped. `f.entity.items` is that state composed IN PLACE (composeRoomView), so everything that reads a
//     body's list reads the room's one list. Its own takes are read by identity against the last compose (listMovesSince)
//     and judged where they stand; a peer's claim is judged on RECEIPT inside applyHit (DESIGN-REVIEW R-1) - first come,
//     the owner's own take first - and answered at once with the verdict and the digest after the judgment. A verdict is
//     FINAL (D-1): it is kept in a ledger that outlives the body, and a re-ask is answered from it (R-2) - wherever its
//     claimer stands (S1-1: the owner's pose list is not the roster; a NEW claim still needs the pose list and the reach).
//     A BODY IS (owner, seq, generation) (S1-2): the peer id outlives a page reload while a new pool numbers its foes from
//     one again, so each pool seeds the generation counter from a random base, a claim frame names the generation of the body
//     it was made on, and the owner judges a NEW claim only against the body it names.
//   - THE READER'S VIEW, per body of a peer: the digest the owner's stream says (`bw`), the records it has fetched by a
//     peek, and the list composed from both less the claims in flight (AUTO-HOLD: and less the pieces it carries). UNBORN
//     (a present place has no record yet) it is no target and names nothing; LEGACY (an older owner: no digest) it names
//     itself alone and its press is the legacy take; UNREADABLE (a newer build's piece) it names itself alone and its press
//     says LOOT_NEWER_TAKE_TEXT; BORN, its press opens the window over the view, and every take - the window's, Take all,
//     the quick door's row and its lot - is read against the last compose and CLAIMED by place, one frame to the owner.
// NEVER UNDER AN OPEN WINDOW (AUDIT WORLD4 C1): a body whose window stands is composed nowhere - the pool's one open slot,
// told by the window's own `opened`/`closed` (ui/inventoryDoor.js, systems/inventorySession.js).
// MIXED BUILDS: an older owner's body is LEGACY (the legacy `take: 1`, whose grant now lands at any lateness inside
// LEGACY_ASK_KEEP_MS - the ask is the claims ledger's); an older taker's `take: 1` at this owner is drawn from the state as
// a bulk claim and answered in today's grant shape (LOOT-DUP: a grant its frame never left is put back; F4: and a `back`).
import { openCorpseLoot, takeCorpseLoot, arrowsOnly, playRareDrop, corpseContents, corpseEntityName } from './corpseMarker.js';
import { addItem, addGoldPieces, isGoldPieces } from '../systems/inventory.js';
import { silverFindAt } from '../systems/silverFinds.js';
import { localizedText } from '../systems/textManager.js';   // DFU's own line for an empty body, in the player's language (corpseMarker.js says it the same way)
import { validLootList, LOOT_LIST_MAX, LOOT_NEWER_TAKE_TEXT } from '../systems/loot/loot.js';
import { peerHanded, notCarried } from '../systems/peerWord.js';
import { roomState, judgeRoomClaim, composeRoomView, listMovesSince, liftPiece, pieceCount, roomClaimId, ROOM_BASE_MAX, ROOM_CLAIMS_MAX, ROOM_TAKEN_TEXT } from '../systems/roomLoot.js';
import { createClaimLedger, LEGACY_ASK_KEEP_MS } from '../systems/loot/claimLedger.js';
import { tokenGate, mintSharedStamp, CELL_FRAME_RECORDS_MAX } from '../net/wire.js';
import {
  BODY_PEEK_REACH, PEEK_RETRY_MS, BODY_ASKS_PER_S, TAKES_PER_S, TAKE_WINDOW_MS, GRANT_BACK_MS, GRANT_FRAME_MAX, GENERATION_SPACE, BAD, HIDDEN,
  digestWord, digestEntry, digestKey, validDigest, validDigestEntry, mergeDigest, placeGone, shareableRecord, readRecord, bodyStateOf, placesLacking,
  validPeek, validClaims, validVerdicts, validRecords, pageOfRecords, peekFrame, claimsFrame, answerFrame, verdictFrame, makeVerdictLedger,
} from '../net/bodyLoot.js';

/** The most bodies of other players' a reader keeps a digest for (the oldest not under a window go first). */
const READERS_MAX = 512;
/** How stale a composed view may be before a read composes it again (ms): what the reader carries decides what it is offered (AUTO-HOLD). */
const VIEW_REFRESH_MS = 500;
/** A verdict frame still "in flight" this long is taken to be gone (a net that tells no fate): the re-ask is answered. */
const FLIGHT_STALE_MS = 3000;
/** S1-2: a fresh base for a pool's generation counter, below GENERATION_SPACE - the CSPRNG's, as the codebase's other minted ids
 *  are (worldModes.js's card table, egClient.js), so it stirs none of the dice a seeded Math.random hands a test or a replay;
 *  Math.random's where the runtime has none. */
function generationBase() {
  let n;
  try { n = globalThis.crypto.getRandomValues(new Uint32Array(1))[0] % GENERATION_SPACE; } catch { n = Math.floor(Math.random() * GENERATION_SPACE); }
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
}

/**
 * @param {object} h  the pool's handles
 * @param {any[]} h.foes                       the pool's records (the live array)
 * @param {any} h.playerEntity                 the player whose hands these are
 * @param {(line: string) => void} [h.say]     the pool's say (null: silent)
 * @param {any} [h.audio]
 * @param {() => any} h.net                    the pool's net (null offline)
 * @param {() => number} h.now                 the net's clock, else Date.now
 * @param {(from: string) => any} h.ownerOf    an owner's record: its budgets and its cell
 * @param {(from: string) => string | null} h.ownerKey   the cell an owner's frames are keyed to
 * @param {(from: string, i: number) => any} h.puppetOf  the standing puppet of an owner's body
 * @param {(i: number) => any} h.ownBody       my own body with this number
 * @param {(id: string) => any} h.peerCandidate  a peer the hunt sees
 * @param {() => number} h.foesSeq             my frame counter now
 * @param {number} h.takeRange                 how far a peer may stand from my foe's body and take from it
 * @param {number} h.leapSlack                 the pose's slack
 */
export function createBodyLoot(h) {
  const { foes, playerEntity, audio, peerCandidate, ownerOf } = h;
  const _now = () => h.now();
  const net = () => h.net();
  const tell = (line) => { h.say?.(line); };

  const stamp = mintSharedStamp();
  let claimN = 0;
  /** THE CLAIMER'S LEDGER: this pool's claims in flight, their verdicts, their lapse and re-ask, the legacy asks. */
  const ledger = createClaimLedger({ entity: playerEntity, say: tell, newId: () => roomClaimId(net()?.selfId?.() ?? 'self', stamp, ++claimN) });
  /** THE OWNER'S VERDICT LEDGER: a claim id -> what was judged; outlives the body. */
  const verdicts = makeVerdictLedger();
  /** My own dead bodies' states, by foe. */
  let owned = new WeakMap();
  /** Other players' bodies as this reader holds them, by `owner:number`. */
  const readers = new Map();
  /** THE ONE OPEN SLOT: the state a window stands over now (the owner's or a reader's), null when none does. */
  let open = null;
  let generation = generationBase(), ownN = 0, legacyN = 0;   // S1-2: a body's generation is its pool's own - never one a reloaded owner's earlier page minted

  const online = () => !!net()?.toWire;
  const bodyPos = (f) => f.corpseMarker?.pos ?? f.ai?.feet ?? null;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const hit = (frame, fate) => net()?.onPeerHit?.(frame, fate);
  const keyOf = (owner, seq) => `${owner}:${seq}`;

  // ═══ THE OWNER'S STATE ═══════════════════════════════════════════════════════════════════════════════════════════════

  /** A piece laid on the body as a new place (or the owner's alone when it never rides, or the places are spent): its place, else -1. */
  function addPlace(st, piece) {
    const rec = st.base.length < ROOM_BASE_MAX ? shareableRecord(piece) : null;
    if (!rec) return -1;
    st.base.push(piece);
    st.full.push(Number.isInteger(piece.stackCount) ? piece.stackCount : null);
    st.records.push(rec);
    return st.base.length - 1;
  }

  /** The state of one of my dead bodies, minted now if it has none (the pile is final once the death chain has run): its places in
   *  pile order, the pieces that never ride kept apart as the owner's own. A list some load replaced is no list composed here: re-minted. */
  function ownState(f) {
    if (!f?.entity) return null;
    let st = owned.get(f);
    if (st && st.items === f.entity.items) return st;
    const items = (f.entity.items ??= []);
    st = { f, bg: ++generation, base: [], full: [], records: [], own: [], rs: roomState({ g: generation, lv: 1, n: 1, tm: 0 }), seen: new Map(), items, dirty: true, granted: null };
    for (const it of items) {
      if (!it) continue;
      if (addPlace(st, it) < 0) st.own.push(it);
    }
    owned.set(f, st);
    composeOwn(st);
    return st;
  }
  /** The list: the places not gone (a drawn-down stack at its count), then the owner's own - in place, so every holder of the array reads it. */
  function composeOwn(st) {
    const { list, seen } = composeRoomView(st.base, st.full, st.rs, st.own, null);
    const items = st.f.entity.items;
    items.length = 0; items.push(...list);
    st.seen = seen; st.dirty = false;
  }
  const presentCount = (st) => { let n = 0; for (let p = 0; p < st.base.length; p++) if (!st.rs.taken.has(p)) n++; return Math.min(255, n); };
  const digestOf = (st) => digestWord(st.bg, st.base.length, st.rs.taken, st.rs.counts);

  /** The owner's own doors since the last compose, read by identity: what it took is JUDGED where it stands (a take another was
   *  granted first goes back out of its pack and is said), what it laid on the body becomes a place of the room's. */
  function settleOwn(st) {
    const items = st.f.entity.items;
    if (items !== st.items) return;
    const { takes, grows, puts } = listMovesSince(st.seen, items, (it) => st.own.includes(it));
    if (st.own.length) { const here = new Set(items); st.own = st.own.filter((it) => here.has(it)); }
    for (const { obj, info, k } of takes) {
      const g = judgeRoomClaim(st.rs, st.base.length, st.full, { id: `own:${st.bg}:${++ownN}`, p: info.p, n: k });
      if (g < k) { liftPiece(playerEntity, obj, k - g); if (!g) tell(ROOM_TAKEN_TEXT); }
    }
    for (const { obj, info, by } of grows) {   // laid onto a stack of the room's: the body's stack is what the room minted, what was laid is a place of its own
      const laid = { ...obj, stackCount: by };
      obj.stackCount = info.n - by; info.n -= by;
      items.push(laid);
      const p = addPlace(st, laid);
      if (p >= 0) st.seen.set(laid, { p, n: by }); else st.own.push(laid);
    }
    for (const obj of puts) {
      const at = items.indexOf(obj);
      const piece = st.base.includes(obj) ? { ...obj } : obj;   // a gone place's object is never a place again
      if (piece !== obj) items[at] = piece;
      const p = addPlace(st, piece);
      if (p >= 0) st.seen.set(piece, { p, n: pieceCount(piece) }); else st.own.push(piece);
    }
  }
  /** One owner frame's work for a body: its own doors read, the list composed again if the room moved under it and no window stands. */
  function ownTick(st) {
    if (st.f.entity.items !== st.items) return;
    settleOwn(st);
    if (st.dirty && open !== st) composeOwn(st);
  }
  /** The window's own `opened`/`closed` over a body of mine. The slot is emptied BEFORE the occupant is told. */
  function ownWindow(st, openWindow) {
    if (typeof openWindow !== 'function') return openWindow;
    return (hooks) => openWindow({
      ...hooks,
      opened: () => { open = st; },
      closed: () => { if (open === st) open = null; ownTick(st); },
    });
  }

  /** Pieces back on the body as NEW places (a legacy grant its frame never left, a legacy `back`): a place is never re-used. */
  function restoreHeld(st, held) {
    for (const piece of held) if (addPlace(st, piece) < 0) st.own.push(piece);
    st.dirty = true;
    if (open !== st) composeOwn(st);
  }

  // ── the owner's words ──
  /** A peek: the records of the places the reader lacks, as many as fit a frame, in the asked order, with the digest. Information only. */
  function ownerPeek(from, data) {
    const f = Number.isInteger(data.i) ? h.ownBody(data.i) : null;
    if (!f || !f.corpse || !f.entity) return false;
    const places = validPeek(data.bp);
    const asker = peerCandidate(from), at = bodyPos(f);
    if (!places || !asker || !at || dist(asker.feet, at) > BODY_PEEK_REACH + 2 * h.leapSlack) return true;   // A1/C7: a peer I do not see, or far, hears nothing
    if (!askBudget(from)) return true;
    const st = ownState(f);
    if (!st) return true;
    ownTick(st);
    const want = places.filter((p) => p < st.base.length && !st.rs.taken.has(p));
    hit(answerFrame(from, data.k ?? net()?.room?.() ?? null, f.seq, digestOf(st), pageOfRecords(want, st.records)));
    return true;
  }
  /** The owner's answer budget: frames, not pieces; over it silence, and the asker asks again (a bucket of its own, never `takes`). */
  function askBudget(from) {
    const o = ownerOf(from);
    const budget = tokenGate(o.asks ?? null, _now(), BODY_ASKS_PER_S);
    o.asks = budget.bucket;
    return budget.pass;
  }

  /** CLAIMS: judged on RECEIPT, in applyHit itself (DESIGN-REVIEW R-1) - never on a frame tick, so a seat whose tab sleeps still
   *  answers - first come, my own takes first. TWO KINDS OF CLAIM, TWO GATES (the slice 1 review):
   *    - a claim I already JUDGED (its id is in my verdict ledger, and it is its sender's) is a re-ask: the judgment is made, and
   *      it is answered again from the ledger (R-2) under my answer budget alone - the claimer in reach or out, the body there or
   *      gone, and in my pose list or not: that list (`peers()`) is not the roster, a claimer who crossed into the next cell is
   *      still in the roster, and `sendHit` tests the roster before the frame leaves (S1-1);
   *    - a NEW claim is judged only for a body I hold, from a peer in my pose list within reach (A1/C7), and only for the body
   *      it NAMES: the frame carries the generation of the body the claim was made on, and a claim of another body that shares
   *      this one's (owner, seq) - my earlier page's, a pool of mine that was reloaded - is silence (S1-2). */
  function ownerClaims(from, data) {
    const claims = validClaims(data.bq, from);
    if (!claims || !Number.isInteger(data.i)) return false;
    const f = h.ownBody(data.i);
    const body = f && f.corpse && f.entity ? f : null;
    const now = _now();
    const rejudged = claims.some((c) => verdicts.get(c.id, now)?.to === from);
    if (!body && !rejudged) return false;   // a claim for a body I never had: not my word
    const asker = peerCandidate(from);
    if (!asker && !rejudged) return true;   // A1/C7: a NEW claim from a peer I do not see is not heard, and costs me nothing
    if (!askBudget(from)) return true;
    const st = body ? ownState(body) : null;
    if (st) ownTick(st);   // my own doors first: a take my window already made came first in wall time and wins (AC7)
    const at = body ? bodyPos(body) : null;
    const reach = !!(st && at && asker && dist(asker.feet, at) <= h.takeRange);
    const named = !!st && data.g === st.bg;   // S1-2: the body this claim was made on is the body I hold

    const out = [];
    for (const c of claims) {
      const known = verdicts.get(c.id, now);
      if (known) {   // a re-ask: the judgment was made - answered, in reach or out, the body there or gone - one frame in flight at a time
        if (known.to === from && !(known.inFlight > 0 && now - known.flightAt < FLIGHT_STALE_MS)) out.push([c.id, known.g]);
        continue;
      }
      if (!st || !reach || !named) continue;   // a brand-new claim is judged only for the body I hold and it names, from a peer in reach (A1/C7, S1-2)
      const g = judgeRoomClaim(st.rs, st.base.length, st.full, { id: c.id, p: c.p, n: c.n });
      verdicts.set(c.id, { to: from, i: body.seq, bg: st.bg, p: c.p, g }, now);
      out.push([c.id, g]);
    }
    if (!out.length) return true;
    if (st) { st.dirty = true; if (open !== st) composeOwn(st); }
    sayVerdicts(from, data.k ?? net()?.room?.() ?? null, data.i, st, out);
    return true;
  }
  /** A verdict frame through the hit queue, with its own fate: it never voids a verdict (D-1) - the fate only counts the frames in flight. */
  function sayVerdicts(to, k, i, st, out) {
    const now = _now();
    const entries = out.map(([id]) => verdicts.get(id, now)).filter(Boolean);
    for (const e of entries) { e.inFlight++; e.flightAt = now; }
    const done = () => { for (const e of entries) if (e.inFlight > 0) e.inFlight--; };
    hit(verdictFrame(to, k, i, st ? digestOf(st) : null, out), { sent: done, dropped: done });
  }

  // ── the legacy take at the owner: an OLDER taker's `take: 1` (and a new taker's at an older owner's own) ──
  /** AUDIT WORLD6b-iii(c): a take at my foe's body - the pile handed over unseen, as much as one frame carries. Here it is drawn from the
   *  state as a bulk claim of every present place at its left count, first come with everyone's. */
  function legacyTake(from, data) {
    // A5: a private quest's foe (CURSE-SYNC: not a world quest's) is the quest owner's alone and never streamed - it answers as a body that does not exist;
    // A1/C7: and a body I do not have, or a live foe, answers NOTHING (an answer for a number invented on the spot
    // was a frame out of me for free)
    const f = h.ownBody(data.i | 0);
    if (!f || !f.corpse) return true;
    // A1/C7: the taker's REACH is the owner's law - the asker must be a peer the hunt sees, standing within the
    // corpse's activation distance (plus the pose's slack) of the body; a peer across the cell, or one I cannot see,
    // takes nothing and hears nothing (its own reach test refused a far body before it ever asked)
    const asker = peerCandidate(from);
    const body = bodyPos(f);
    if (!asker || !body || dist(asker.feet, body) > h.takeRange) return true;
    // AUDIT WORLD6b-iii(c) A2/B3/C4: the asker's own budget - TAKES_PER_S answers a second from one peer, the rest
    // silence (an answer spends MY hit budget, and every take made me spend it until now); a silent refusal above
    // costs the asker nothing - it cost me nothing
    const o = ownerOf(from);
    const budget = tokenGate(o.takes ?? null, _now(), TAKES_PER_S);
    o.takes = budget.bucket;
    if (!budget.pass) return true;
    grantCorpse(f, from, data.k ?? net()?.room?.() ?? null);
    return true;
  }
  /** WORLD6b-iii(c): the owner's answer to a take - as much of the body's places as one hit frame carries (the rest stays, and the next
   *  record still says it holds something), each at its left count; the places are judged taken the moment the frame is accepted. */
  function grantCorpse(f, to, k) {
    const st = ownState(f);
    if (!st) return;
    ownTick(st);

    const present = [];
    for (let p = 0; p < st.base.length; p++) if (!st.rs.taken.has(p)) present.push({ p, left: st.rs.counts.get(p) ?? (Number.isInteger(st.full[p]) ? st.full[p] : 1) });
    let n = present.length;
    while (n > 0) {
      // AUDIT WORLD6b-iii(c) A3/C2: a list past LOOT_LIST_MAX goes in parts (what never rides is not a place: the owner's own)
      if (n > LOOT_LIST_MAX) { n = n >> 1; continue; }
      const grant = present.slice(0, n).map(({ p, left }) => (Number.isInteger(st.full[p]) ? { ...st.records[p], stackCount: left } : st.records[p]));
      const frame = { to, k, i: f.seq, grant, n: h.foesSeq() };   // A7: and the frame counter at the grant, so a record older than it re-opens nothing
      if (JSON.stringify({ t: 'hit', data: frame }).length > GRANT_FRAME_MAX) { n = n >> 1; continue; }   // A4/C10: a part that does not fit a frame is halved
      // LOOT-DUP: THE PLACES ARE RESERVED THE MOMENT THE FRAME IS ACCEPTED, and come back if it never leaves.
      //
      // This used to read `if (onPeerHit(frame)) items.splice(...)` - "emptied of what WENT" - and that boolean is the hit
      // QUEUE's news, not this frame's: a grant merely queued answers FALSE and is usually sent a frame later, so the
      // taker's pack filled while the corpse kept the same list, and the next peer to ask that body was granted the same
      // loot again: duplication, silent, online only. Answering true because some OTHER blow went is the mirror defect.
      //
      // Reserving (not splicing on send) closes the window: while the grant is in flight the places are TAKEN, so a second
      // asker cannot be granted them. `dropped` puts the pieces back as new places - a place is never re-used - so the
      // body holds again exactly what it promised.
      const legacy = `legacy:${to}:${++legacyN}`;
      const held = present.slice(0, n).map(({ p, left }) => {
        judgeRoomClaim(st.rs, st.base.length, st.full, { id: `${legacy}:${p}`, p, n: left });
        return Number.isInteger(st.full[p]) ? { ...st.base[p], stackCount: left } : { ...st.base[p] };
      });
      st.dirty = true;
      if (open !== st) composeOwn(st);
      // AUDIT ONLINE2 F4 (AUDIT SETS M2's other half): and they come back if the taker's build cannot read them - its
      // `back` answers this grant alone, inside GRANT_BACK_MS (a piece from a newer build was refused whole and lost)
      const granted = { to, held, at: _now() };
      st.granted = granted;
      const back = () => { if (st.granted === granted) st.granted = null; restoreHeld(st, held); };
      if (!net()?.onPeerHit) { back(); return; }
      net().onPeerHit(frame, { dropped: back });
      return;
    }
    net()?.onPeerHit?.({ to, k, i: f.seq, grant: [], n: h.foesSeq() });   // nothing on it: the body says so
  }
  function legacyBack(from, data) {
    // AUDIT ONLINE2 F4: THE TAKER COULD NOT READ MY GRANT (a piece from after its build) - the pieces come back to the
    // body, for the grant it answers alone, inside the window; any other `back` is nothing
    const f = foes.find((x) => !x.puppet && x.seq === (data.i | 0));
    const st = f ? owned.get(f) : null;
    const g = st?.granted;
    if (!g || g.to !== from || _now() - g.at > GRANT_BACK_MS) return false;
    st.granted = null;
    restoreHeld(st, g.held);
    return true;
  }

  // ═══ THE READER'S VIEW ═══════════════════════════════════════════════════════════════════════════════════════════════

  const readerOf = (f) => readers.get(keyOf(f.puppet, f.seq)) ?? null;
  const containerOf = (rb) => `${rb.owner}:${rb.seq}#${rb.digest.g}`;
  const stateOf = (rb) => (rb.state ??= bodyStateOf(rb.digest, rb.items));
  const touch = (rb) => { rb.state = null; rb.dirty = true; };

  /** The owner's takes digests off a foes frame (`bw`), each merged into what this reader holds of that body - another generation is another body under the same number: started anew. */
  function hear(from, k, entries) {
    for (const e of entries.slice(0, CELL_FRAME_RECORDS_MAX)) {
      const v = validDigestEntry(e);
      if (!v) continue;
      const key = keyOf(from, v.i);
      let rb = readers.get(key);
      if (rb && rb.digest.g !== v.digest.g) { dropReader(rb); rb = undefined; }
      if (!rb) {
        rb = { owner: from, seq: v.i, k: null, digest: v.digest, items: [], full: [], peekAt: null, view: [], seen: new Map(), dirty: true, state: null, composedAt: -Infinity, laid: new Set() };
        readers.set(key, rb);
        while (readers.size > READERS_MAX) { const old = [...readers.values()].find((x) => x !== open); if (!old) break; dropReader(old); }
      } else if (mergeDigest(rb.digest, v.digest)) touch(rb);
      if (typeof k === 'string') rb.k = k;
    }
  }
  function dropReader(rb) {
    if (readers.get(keyOf(rb.owner, rb.seq)) === rb) readers.delete(keyOf(rb.owner, rb.seq));
    if (open === rb) open = null;
  }

  /** The view: the places not gone, at their drawn-down counts, less the claims in flight, less what this reader carries (AUDIT AUTO-HOLD) - in place. */
  function composeView(rb) {
    const L = rb.digest.l;
    const live = [];
    for (let p = 0; p < L; p++) { const it = rb.items[p]; if (!placeGone(rb.digest, p) && it && it !== BAD && it !== HIDDEN) live.push(it); }
    const shown = new Set(notCarried(live) ?? live);
    const st = { taken: new Set(), counts: new Map(rb.digest.c), stored: [], ids: [], answers: new Map(), claims: new Map() };
    const base = [], full = [];
    for (let p = 0; p < L; p++) {
      const it = rb.items[p];
      const real = it && it !== BAD && it !== HIDDEN;
      base.push(real ? it : { stackCount: 1 });
      full.push(real ? rb.full[p] : null);
      if (placeGone(rb.digest, p) || !real || !shown.has(it)) st.taken.add(p);
    }
    const { list, seen } = composeRoomView(base, full, st, [], ledger.pending(containerOf(rb)));
    rb.view.length = 0; rb.view.push(...list);
    rb.seen = seen; rb.dirty = false; rb.composedAt = _now();
    const f = h.puppetOf(rb.owner, rb.seq);
    if (f && f.entity && f.corpse) f.entity.items = rb.view;
  }

  /** The window's takes since the last compose, CLAIMED: every piece gone from the view is lifted out of the pack and claimed of the
   *  owner by place - one frame per body per settle, a bigger batch in more. What was laid in is the owner's alone to lay: handed back once no window stands.
   *  AUDIT OUTDOOR-LOOT B2: in any state - the view and its `seen` are the last BORN compose's and a claim names its place and the
   *  body's generation, so a body turned unborn or unreadable under an open window still claims what was taken from it (it was
   *  never claimed: a second taker was granted the same piece). `claim` false: a body no longer there - its takes lifted, never granted. */
  function settleReader(rb, claim = true) {
    const { takes, grows, puts } = listMovesSince(rb.seen, rb.view, () => false);
    for (const g of grows) { const laid = { ...g.obj, stackCount: g.by }; g.obj.stackCount -= g.by; g.info.n -= g.by; rb.view.push(laid); rb.laid.add(laid); }
    for (const obj of puts) rb.laid.add(obj);
    if (takes.length && !claim) for (const m of takes) liftPiece(playerEntity, m.obj, m.k);
    else if (takes.length) {
      const now = _now();
      const claims = takes.map(({ obj, info, k }) => ledger.take(containerOf(rb), { p: info.p }, obj, k, { by: rb.owner, owner: rb.owner, seq: rb.seq, k: rb.k, g: rb.digest.g }, now));   // g: the body it is made ON - a re-ask names it still, whatever the view has become
      rb.dirty = true;
      sendClaims(claims);
    }
    if (rb.laid.size && open !== rb) handBack(rb);
  }
  /** Pieces laid into another player's kill are handed back to the pack, never kept in the view and never said. */
  function handBack(rb) {
    for (const piece of rb.laid) {
      const at = rb.view.indexOf(piece);
      if (at < 0) continue;
      rb.view.splice(at, 1);
      if (ledger.open().some((c) => c.item === piece)) continue;   // a piece of a claim of mine, not a put: it is the claim's to give
      if (isGoldPieces(piece)) addGoldPieces(playerEntity, pieceCount(piece));
      else addItem((playerEntity.items ??= []), piece);
    }
    rb.laid.clear();
    rb.dirty = true;
  }
  /** Settle what was moved, then compose again if the room moved under the view and no window stands (never the other way round: a take composed away is lost). */
  function ensureView(rb) {
    if (open === rb || stateOf(rb) !== 'born') return;
    settleReader(rb);
    if (rb.dirty || _now() - rb.composedAt > VIEW_REFRESH_MS) composeView(rb);
  }

  /** The claims, one frame per body per call (more than ROOM_CLAIMS_MAX in more), to the owner, in the owner's cell. A body is the
   *  owner, its number AND its generation (S1-2): a re-ask of a claim made on an earlier body of the same number goes in a frame of
   *  its own, naming that body's generation, never the view's now. */
  function sendClaims(claims) {
    const by = new Map();
    for (const c of claims) { const key = `${c.meta.owner}|${c.meta.seq}|${c.meta.k}|${c.meta.g}`; (by.get(key) ?? by.set(key, []).get(key)).push(c); }
    for (const list of by.values()) {
      const { owner, seq, k, g } = list[0].meta;
      for (let a = 0; a < list.length; a += ROOM_CLAIMS_MAX) hit(claimsFrame(owner, k ?? h.ownerKey(owner), seq, g, list.slice(a, a + ROOM_CLAIMS_MAX)));
    }
  }

  /** A peek answer: the digest and the records of the places the reader lacked, read as this build reads a piece. */
  function readerAnswer(from, data) {
    const rb = readers.get(keyOf(from, data.i | 0));
    if (!rb || rb.peekAt == null) return false;
    const dg = validDigest(data.bw), recs = validRecords(data.br);
    if (!dg || !recs || dg.g !== rb.digest.g) return false;
    mergeDigest(rb.digest, dg);
    for (const [p, rec] of recs) {
      if (p >= rb.digest.l || rb.items[p] !== undefined) continue;
      const piece = readRecord(rec);
      rb.items[p] = piece;
      rb.full[p] = piece !== BAD && piece !== HIDDEN && Number.isInteger(piece.stackCount) ? piece.stackCount : null;
    }
    rb.peekAt = null;
    touch(rb);
    return true;
  }
  /** A verdict: each lands for a claim THIS pool made and the owner it was made to, once; the digest after the judgment recomposes the view in one step. */
  function readerVerdict(from, data) {
    const vs = validVerdicts(data.bv);
    if (!vs) return false;
    let did = false;
    for (const v of vs) {
      const c = ledger.resolve(v.id, v.g, { from, withdrawn: v.withdrawn });
      if (!c) continue;
      did = true;
      const rb = readers.get(keyOf(c.meta.owner, c.meta.seq));
      if (rb) touch(rb);
    }
    if (did && data.bw !== undefined) {
      const rb = readers.get(keyOf(from, data.i | 0)), dg = validDigest(data.bw);
      if (rb && dg && dg.g === rb.digest.g && mergeDigest(rb.digest, dg)) touch(rb);
    }
    if (did) for (const rb of readers.values()) if (rb.dirty) ensureView(rb);
    return did;
  }

  /** Whether this reader may be offered the body at all: the owner's record says it holds something and the view is not UNBORN. */
  function isTarget(f) {
    if (!((f._pup?.o | 0) > 0)) return false;
    const rb = readerOf(f);
    const s = rb ? stateOf(rb) : 'legacy';
    if (s === 'unborn') return false;
    if (s !== 'born') return true;
    ensureView(rb);
    return rb.view.length > 0;
  }
  /** The plaque's word: an older owner's body, and a body this build cannot read, name themselves alone. */
  function named(f, word) {
    const rb = readerOf(f);
    const s = rb ? stateOf(rb) : 'legacy';
    return s === 'legacy' || s === 'unreadable' ? { ...word, unlisted: true } : word;
  }
  /** What a BORN body holds for this reader (the contents door), else null: the name alone is all that is known. */
  function contents(f) {
    const rb = readerOf(f);
    if (!rb || stateOf(rb) !== 'born') return null;
    ensureView(rb);
    if (f.entity.items !== rb.view) f.entity.items = rb.view;
    return corpseContents(f);
  }
  /** LOOT-STACK: a BORN peer's body as a tab - its name and how much it holds for this reader. */
  function pileBody(f) {
    if (!f || f.corpseDisabled || !isTarget(f)) return null;
    const rb = readerOf(f);
    if (!rb || stateOf(rb) !== 'born') return null;
    return { name: corpseEntityName(f.mobileType) ?? 'Body', count: rb.view.length };
  }

  /** The press on a PEER'S body. LEGACY: the owner is asked for the pile (the old law). UNREADABLE: said, nothing opens. UNBORN: not pressable. BORN: the window over the view. */
  function takePuppet(f, say2, openWindow) {
    const rb = readerOf(f);
    const s = rb ? stateOf(rb) : 'legacy';
    if (s === 'unreadable') { say2(LOOT_NEWER_TAKE_TEXT); return 0; }
    if (s === 'unborn') return 0;
    if (s === 'legacy') return askLegacy(f, say2);
    ensureView(rb);
    f.entity.items = rb.view;
    f.corpseDisabled = false;
    const door = typeof openWindow === 'function' ? (hooks) => openWindow({
      ...hooks,
      opened: () => { open = rb; },
      closed: () => {
        if (open === rb) open = null;
        if (readers.get(keyOf(rb.owner, rb.seq)) !== rb) { settleReader(rb, false); handBack(rb); return; }   // a body no longer there: what the window took was never granted; AUDIT OUTDOOR-LOOT B1: what it laid in comes home (it was destroyed)
        settleReader(rb);
        handBack(rb);
        if (stateOf(rb) === 'born') composeView(rb);
      },
    }) : openWindow;
    const r = openCorpseLoot(f, { playerEntity, say: say2, openWindow: door });
    if (readers.get(keyOf(rb.owner, rb.seq)) === rb && open !== rb) ensureView(rb);   // the quick door's row and its lot (and the arrows prelude): claimed at once
    return r;
  }
  /** WORLD6b-iii(c): a puppet's body of an OLDER owner is its owner's pile - the take is ASKED of the owner (a hit frame naming the body)
   *  and the owner's GRANT lands the items here (applyHit's grant arm says the take); nothing is taken on this word. */
  function askLegacy(f, say2) {
    if (!f._pup?.o || f.corpseDisabled) { f.corpseDisabled = true; say2(localizedText('theBodyHasNoTreasure', 'The body has no treasure.')); return 0; }
    const key = keyOf(f.puppet, f.seq);
    if (ledger.askedWithin(key, _now(), TAKE_WINDOW_MS)) return 0;   // AUDIT WORLD6b-iii(c) B8: one ask in flight
    // B1/C1: the ask is latched only when the frame LEFT. LOOT-DUP: and "left" is now this frame's own word - the
    // queue's boolean said false for a queued ask, so the pool asked again every frame until one went out clean.
    hit({ to: f.puppet, k: h.ownerKey(f.puppet), i: f.seq, take: 1 }, { sent: () => { ledger.ask(key, _now()); } });
    return 0;
  }

  /** The grant of an OLDER owner (or this owner's, to an older me), landed: for a body I ASKED for, inside LEGACY_ASK_KEEP_MS, once per ask -
   *  with or without the puppet. */
  function legacyGrant(from, data) {
    // AUDIT WORLD6b-iii(c) B1/C1: a grant lands for a body of THIS owner's that I ASKED for, once - an unasked grant is
    // refused whole (any socket in the cell put items and gold into my pack at will). The ask is the claims ledger's now:
    // it lands at any lateness inside LEGACY_ASK_KEEP_MS, the puppet swept or not (a grant 3.5 s late was refused and
    // destroyed - the owner had already taken the pieces off the body)
    const key = keyOf(from, data.i | 0);
    const f = h.puppetOf(from, data.i | 0);
    const grant = notCarried(peerHanded(validLootList(data.grant)));   // SS3: without a bound piece - one never passes between players; HACKED-GOLD: nor a letter of credit; AUDIT AUTO-HOLD: nor a piece I carry (systems/peerWord.js)
    if (!grant) {
      // AUDIT ONLINE2 F4: one I asked for that this build cannot read - its owner is told (`back`), so the pieces go
      // back to the body rather than to nobody, and the player is told to reload
      if (ledger.landAsk(key, _now(), LEGACY_ASK_KEEP_MS)) { hit({ to: from, k: data.k ?? net()?.room?.() ?? null, i: data.i | 0, back: 1 }); tell(LOOT_NEWER_TAKE_TEXT); }
      return false;
    }
    if (!ledger.landAsk(key, _now(), LEGACY_ASK_KEEP_MS)) return false;   // an unasked grant, or a second for one ask, is refused whole
    const arrows = arrowsOnly(grant);   // AUDIT 625 S7: asked before the take empties it - a body of arrows alone, as my own body's door reads one
    const n = takeCorpseLoot({ entity: { items: grant } }, playerEntity, h.say ?? (() => {}));   // the one take law: arrows whole, gold to the counter, the count said
    if (f) {
      if (n > 0) playRareDrop(audio, f.corpseMarker?.pos ?? f.ai?.feet ?? null, grant);   // B10: the rare-drop chime rings over a peer's body too
      if (n > 0 && !arrows) silverFindAt('corpse', f);   // SILVER-FINDS: a peer's body, its pile handed over - its silver rolled once, as my own body's at its door (AUDIT 625 S7: and, as at its door, none for arrows alone)
      if (f._pup) f._pup.o = 0;
      if (n === 0) { f.corpseDisabled = true; f._closedN = Number.isInteger(data.n) ? data.n : (h.ownerRecord(from)?.n ?? -1); }   // A7: closed as of the owner's frame counter
    }
    return true;
  }

  // ═══ THE FRAME ═══════════════════════════════════════════════════════════════════════════════════════════════════════

  /** One pool frame: my bodies' own doors read, the peers' bodies fetched near, claimed, composed; the claims lapsed and said again. */
  function update(playerFeet) {
    if (!online()) return;
    const now = _now();
    for (const f of foes) {
      if (f.puppet || !f.corpse) continue;
      const st = owned.get(f);
      if (st) ownTick(st);
    }
    for (const rb of [...readers.values()]) {
      const f = h.puppetOf(rb.owner, rb.seq);
      if (!f || !f.corpse) continue;
      const s = stateOf(rb);
      if (s !== 'born') settleReader(rb);   // AUDIT OUTDOOR-LOOT B2: what a window took from a body that turned unborn or unreadable under it
      if (s === 'unborn') {
        const at = bodyPos(f);
        if (at && playerFeet && dist(playerFeet, at) <= BODY_PEEK_REACH && (rb.peekAt == null || now - rb.peekAt >= PEEK_RETRY_MS)) {
          const places = placesLacking(rb.digest, rb.items);
          if (places.length) { rb.peekAt = now; hit(peekFrame(rb.owner, rb.k ?? h.ownerKey(rb.owner), rb.seq, places)); }
        }
      } else if (s === 'born') {
        settleReader(rb);
        if (open !== rb && f.entity.items !== rb.view) f.entity.items = rb.view;   // the puppet may have been built after the last compose
        if (rb.dirty && open !== rb) composeView(rb);
      }
    }
    if (!ledger.size) return;
    const { lapsed, resay } = ledger.due(now);
    for (const c of lapsed) { const rb = readers.get(keyOf(c.meta.owner, c.meta.seq)); if (rb) touch(rb); }   // no verdict in time: the piece reads as back in the body for its taker
    if (resay.length) sendClaims(resay.filter((c) => h.ownerRecord(c.meta.owner) != null));   // and every claim with no verdict is said again, the same ids - AUDIT OUTDOOR-LOOT B3: not to an owner who is not here (the hit queue holds every frame behind a refused one), until his frames come back
  }

  // ═══ THE POOL'S DOORS ═══════════════════════════════════════════════════════════════════════════════════════════════

  /** The hit frames this block speaks - the new keys and the legacy take, back and grant. `undefined`: not a body frame (the pool's blow arms). */
  function applyHit(from, data) {
    if (Array.isArray(data.bp)) return ownerPeek(from, data);
    if (Array.isArray(data.bq)) return ownerClaims(from, data);
    if (Array.isArray(data.bv)) return readerVerdict(from, data);
    if (Array.isArray(data.br)) return readerAnswer(from, data);
    if (data.take === 1) return legacyTake(from, data);
    if (data.back === 1) return legacyBack(from, data);
    if (data.grant !== undefined) return legacyGrant(from, data);
    return undefined;
  }

  /** The press on a body of this pool. A peer's: above. Mine, online: its state minted, the window told to compose nothing under it, the
   *  quick door's take judged at once. Offline: the owner's local list, as ever. */
  function windowFor(f, openWindow) {
    if (!f || f.puppet || !f.corpse || !online()) return openWindow;
    const st = ownState(f);
    if (!st) return openWindow;
    ownTick(st);   // what the window shows is the room's list as it stands
    return ownWindow(st, openWindow);
  }
  function afterTake(f) {
    const st = f && !f.puppet && online() ? owned.get(f) : null;
    if (st && open !== st) ownTick(st);
  }

  /** The record's `o`: the places not gone (the owner's own pieces are not on offer), the state minted if it has none. */
  function placesLeft(f) {
    if (f?.corpseDisabled) return 0;   // DEX5b: a body no one may search (a mod's corpse prefab took its loot) offers no place - and no copy opens
    const st = online() ? ownState(f) : null;
    if (!st) return Math.min(255, peerHanded(f.entity?.items ?? []).length);
    ownTick(st);
    return presentCount(st);
  }
  /** What the record's dedupe key adds: the digest, so a take re-sends the record. */
  const keyFor = (f) => { const st = f.corpse && !f.puppet ? owned.get(f) : null; return st ? digestKey(digestOf(st)) : ''; };
  /** The foes frame's `bw`: the digest of each dead body of mine that rides this frame holding something. */
  function frameDigests(out, srcOf) {
    const bw = [];
    for (const r of out) {
      if (r.d !== 1 || !(r.o > 0)) continue;
      const f = srcOf(r), st = f && !f.puppet ? owned.get(f) : null;
      if (st) bw.push(digestEntry(r.i, digestOf(st)));
    }
    return bw;
  }

  function forgetPuppet(f) {
    const key = keyOf(f.puppet, f.seq);
    if (!h.puppetOf(f.puppet, f.seq)) { const rb = readers.get(key); if (rb) dropReader(rb); }
    if (open && (open.f === f || (open.owner === f.puppet && open.seq === f.seq))) open = null;   // the slot is emptied before anyone is told
  }
  /** A room change: every puppet is the old cell's. What is in flight in a cell this player no longer holds goes with it (D-1: the claimer's own leave keeps
   *  its claim); a cell still held as a halo keeps its claims in the ledger - the verdict lands through it. */
  function clearAll() {
    const n = net();
    const held = (k) => !!n && k != null && (k === n.room?.() || !!n.inRoom?.(k));
    ledger.keep((c) => !held(c.meta.k), _now());
    readers.clear();
    open = null;
  }
  function prune(alive) {
    for (const rb of [...readers.values()]) if (!alive.has(rb.owner)) dropReader(rb);
  }
  /** The pool's teardown (and a quickload's): everything in flight and not lapsed goes with the claimer. */
  function destroy() {
    ledger.keep(() => true, _now());
    ledger.clear();
    readers.clear();
    verdicts.clear();
    owned = new WeakMap();
    open = null;
  }

  return { applyHit, hear, update, takePuppet, windowFor, afterTake, isTarget, named, contents, pileBody, placesLeft, keyFor, frameDigests, forgetPuppet, clearAll, prune, destroy };
}
