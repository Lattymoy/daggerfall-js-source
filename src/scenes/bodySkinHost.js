// PARTY-SKIN (PR B; test-harness/loot-followups/DESIGN-B.md; net/bodySkin.js says the law whole): THE LOCK - ONE SKIN PER BODY, with both
// halves of it over a pool's bodies, one module for the street and a building (the foe-body block, scenes/bodyLootHost.js) and a dungeon
// (the room block, scenes/roomLootHost.js):
//   - THE AUTHORITY'S JUDGE: the id minted at the death, the claims judged on RECEIPT (first come), the lease lapsed, the entries a foes
//     frame carries (`bs`) and the key that re-sends a record when its skin state moves;
//   - THE READER'S VIEW: the entries heard, and the claimer's own drive of its claims (HOLD, renewed; DONE, said again; RELEASE; UNSKIN)
//     against the verdict the stream gives back.
// A body is addressed as (scope, ref): `scope` null for a body I am the authority of, else the stream I hear it on (the owner's id on the
// street; the room, whoever hosts it, in a dungeon); `ref` the pool's own name for the body. The pool hands the module its doors:
//   now()            the pool's clock (ms)         selfId()        my peer id
//   send(scope, ref, sq)   a claim to the body's authority (a hit)   say(line)
//   isLocal(scope)   whether I am the authority of the bodies of `scope` (the street: scope null; a dungeon: while I hold the room's seat)
//   eligible(from, ref)    the pool's own law for a NEW claim (the street's reach, A1/C7)
//   audience()       whether anyone could hear my stream (alone, no frame is built)      exists(ref)   the body is still here
//   validRef(ref)    the ref's shape on the wire    speaker()   the host whose frames the room's entries are (a dungeon's seat can move)
//   changed(ref)     a body's state moved - the pool re-sends its record (the street keys it: keyFor)
import { mintSharedStamp, tokenGate } from '../net/wire.js';
import { roomClaimId } from '../systems/roomLoot.js';
import { CLAIM_RESEND_MS, CLAIM_RESEND_MAX_MS } from '../systems/loot/claimLedger.js';
import {
  OPEN, HELD, SKINNED, OWNS, OP_RELEASE, OP_HOLD, OP_DONE, OP_UNSKIN, SKIN_RENEW_MS, SKIN_LEASE_MS, SKIN_HOLD_MAX_MS, SKIN_GRANT_WAIT_MS, SKIN_DONE_WAIT_MS,
  SKIN_ASKS_PER_S, SKIN_KEPT_MAX, SKIN_TAKEN_TEXT, SKIN_UNANSWERED_TEXT, bodyId, validSkinEntry, validSkinClaim, skinEntry, judgeSkin, settleSkin, newSkinState, skinView,
} from '../net/bodySkin.js';

/** @param {any} h the pool's doors (above) */
export function createBodySkins(h) {
  let stamp = null;   // this module's mark on its claim ids, minted at the first claim - never at construction (a seeded roll must not be moved by a lock nobody has used)
  let claimN = 0;
  const rand = h.rand ?? ((b) => { globalThis.crypto.getRandomValues(b); });
  const key = (ref) => String(ref);
  const addr = (scope, ref) => `${scope ?? ''}|${key(ref)}`;
  /** THE AUTHORITY'S BODIES: ref key -> { ref, id, st, said }. */
  let auth = new Map();
  /** The last blow a peer struck on a body of mine: ref key -> { from, sk } (the kill door reads whose it was). */
  const blows = new Map();
  /** THE READER'S: scope -> { speaker, entries: ref key -> { ref, id, s, cid } }. */
  const readers = new Map();
  /** MY CLAIMS under way, by claim id; and every claim id I ever made (bounded), by body the last. */
  const claims = new Map();
  const mine = new Set();
  const lastClaim = new Map();
  const buckets = new Map();
  let sweptAt = -Infinity;

  /** Whether I am the authority of the bodies of `scope` (the street: mine, scope null; a dungeon: while I hold the room's seat). */
  const isLocal = (scope) => (h.isLocal ? h.isLocal(scope) : scope == null);
  const bound = (m, max = SKIN_KEPT_MAX) => { while (m.size > max) m.delete(m.keys().next().value); };

  // ═══ THE AUTHORITY ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

  /** A body fell: its id minted - once, here - and its state open; or the killer's own (a quest foe's body, a body the room's base does not
   *  cover, a kill an older striker made - the blow that killed it carried no `sk`). `killer` - the peer whose blow killed it, else null. */
  function mint(ref, { own = false, killer = null } = {}) {
    const k = key(ref);
    const b = blows.get(k);
    blows.delete(k);
    const owns = own || (typeof killer === 'string' && !(b && b.from === killer && b.sk));
    auth.set(k, { ref, id: owns ? '' : bodyId(rand), st: newSkinState(owns), said: false });
    bound(auth);
    h.changed?.(ref);
  }
  /** A peer's blow on one of my foes: whether it carried the new build's mark (`sk: 1`). */
  function noteBlow(ref, from, data) {
    blows.set(key(ref), { from, sk: data?.sk === 1 });
    bound(blows, 64);
  }
  /** A body's state now (a lapsed lease read as open - and kept so, which moves its record's key). */
  function stateOf(a) {
    const now = h.now();
    const st = settleSkin(a.st, now);
    if (st !== a.st) { a.st = st; a.said = false; h.changed?.(a.ref); }
    return a.st;
  }
  const budget = (from) => {
    const g = tokenGate(buckets.get(from) ?? null, h.now(), SKIN_ASKS_PER_S);
    buckets.set(from, g.bucket);
    bound(buckets, 128);
    return g.pass;
  };
  /** A claim hit at the authority, judged now: true when judged (the stream carries the answer), false for nothing. `ref` the body it names. */
  function applyHit(from, data, ref) {
    const c = validSkinClaim(data.sq, from);
    const a = c ? auth.get(key(ref)) : null;
    if (!c || !a || a.id !== c.id || a.st.s === OWNS) return false;
    if (!budget(from)) return false;
    const cur = stateOf(a);
    const holds = cur.cid === c.cid && (cur.s === HELD || cur.s === SKINNED);
    if (!holds && (c.op === OP_HOLD || c.op === OP_DONE) && !h.eligible(from, ref)) return false;   // a NEW claim is the pool's law (the street: reach)
    judge(a, c.cid, c.op);
    return true;
  }
  function judge(a, cid, op) {
    const r = judgeSkin(a.st, cid, op, h.now());
    if (r.state !== a.st) { a.st = r.state; a.said = false; h.changed?.(a.ref); }
    return r.ok;
  }
  /** What the record's dedupe key adds: a change of state re-sends the record, and with it the entry. */
  function keyFor(ref) {
    const a = auth.get(key(ref));
    if (!a) return '';
    const st = stateOf(a);
    return `|sk${st.s}${st.cid ?? ''}`;
  }
  /** The entry as it would ride, for sizing a frame (marks nothing). */
  function peek(ref) {
    const a = auth.get(key(ref));
    return a ? skinEntry(a.ref, a.id, stateOf(a)) : null;
  }
  /** The foes frame's `bs` for the bodies of these records: each dead body of mine that has an entry. */
  function frameEntries(refs) {
    const out = [];
    for (const ref of refs) {
      const a = auth.get(key(ref));
      if (!a) continue;
      const st = stateOf(a);
      out.push(skinEntry(a.ref, a.id, st));
      if (st.s === SKINNED) a.said = true;   // the authority's own skin may be harvested only once a frame carrying it has been BUILT
    }
    return out;
  }
  function forget(ref) { auth.delete(key(ref)); blows.delete(key(ref)); }
  /** THE SEAT CHANGES HANDS TO ME (a dungeon): the entries I heard are the room's, and I judge from them now. A lease the last host held
   *  is read as held from now - it lapses SKIN_LEASE_MS on unless its holder, whose renewals reach me now, says so again. */
  function takeSeat(scope = 'room') {
    const now = h.now();
    const heard = readers.get(scope);
    auth = new Map();
    for (const e of heard?.entries.values() ?? []) {
      const st = e.s === OWNS ? newSkinState(true)
        : { ...newSkinState(false), s: e.s, cid: e.cid, until: e.s === HELD ? now + SKIN_LEASE_MS : 0, cap: e.s === HELD ? now + SKIN_HOLD_MAX_MS : 0 };
      auth.set(key(e.ref), { ref: e.ref, id: e.id, st, said: true });
    }
    readers.delete(scope);
  }

  // ═══ THE READER ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

  /** A stream's entries, heard: each projected (a failing entry is ignored whole), the newest frame's word standing. */
  function hear(scope, entries, speaker = null) {
    let sc = readers.get(scope);
    if (!sc) readers.set(scope, sc = { speaker, entries: new Map() });
    sc.speaker = speaker;
    for (const raw of entries.slice(0, SKIN_KEPT_MAX)) {
      const v = validSkinEntry(raw, h.validRef);
      if (!v) continue;
      sc.entries.delete(key(v.ref));
      sc.entries.set(key(v.ref), v);
    }
    bound(sc.entries);
  }
  const forgetEntry = (scope, ref) => { readers.get(scope)?.entries.delete(key(ref)); };
  const pruneScope = (scope) => { readers.delete(scope); };
  const clearAll = () => { readers.clear(); };

  // ═══ THE BODY AS A PLAYER SEES IT ═════════════════════════════════════════════════════════════════════════════════════════════

  /** The entry for a body now: mine as its authority's state, else as heard; null when nothing is known. */
  function entryOf(scope, ref) {
    if (isLocal(scope)) {
      const a = auth.get(key(ref));
      if (!a) return null;
      const st = stateOf(a);
      return { ref, id: a.id, s: st.s, cid: st.cid, local: a };
    }
    return readers.get(scope)?.entries.get(key(ref)) ?? null;
  }
  /** What Hunting asks of a body: null - the private stamp rules it (offline, an authority that speaks no skin law, the killer's own, a body
   *  the law does not cover); false - no node (the authority speaks the law and has said nothing of this body); else the body's handle. */
  function skinOf(scope, ref) {
    if (!h.online()) return null;
    const local = isLocal(scope);
    if (!local && !readers.has(scope)) return null;
    const e = entryOf(scope, ref);
    if (!e) return local ? null : false;
    if (e.s === OWNS) return null;
    return handle(scope, ref, e.id);
  }
  function view(scope, ref) {
    const e = entryOf(scope, ref);
    if (!e) return 'pending';
    if (!isLocal(scope) && h.speaker && (e.s === OPEN || e.s === HELD) && readers.get(scope)?.speaker !== h.speaker()) return 'pending';   // the seat moved to a build that has not said it
    const v = skinView(e, (cid) => mine.has(cid));
    return v === 'mineSkinned' && e.local && !(e.local.said || !h.audience()) ? 'mine' : v;
  }
  function handle(scope, ref, id) {
    return {
      id,
      view: () => view(scope, ref),
      mineSkinned: () => view(scope, ref) === 'mineSkinned',
      claim: (c) => claim(scope, ref, id, c),
      refused: (error) => refused(scope, ref, error),
    };
  }

  // ═══ MY CLAIMS ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

  /** The act starts: a claim made at once and a HOLD said in the same frame. `alive()` - the act lives; `ended()` - it holds at its end;
   *  `onLost()` - stop it. */
  function claim(scope, ref, id, { alive, ended, onLost }) {
    const cid = roomClaimId(h.selfId() ?? 'self', stamp ??= mintSharedStamp(), ++claimN);
    const c = { cid, scope, ref, id, alive, ended, onLost, startedAt: h.now(), grantedAt: 0, nextSay: 0, doneAt: 0, doneN: 0 };
    mine.add(cid); bound(mine, 256);
    claims.set(cid, c);
    lastClaim.set(addr(scope, ref), c); bound(lastClaim, 64);
    say(c, OP_HOLD);
    c.nextSay = h.now() + SKIN_RENEW_MS;
    return cid;
  }
  /** One word of a claim: judged here when I am the body's authority, else a hit to it. */
  function say(c, op) {
    if (isLocal(c.scope)) { const a = auth.get(key(c.ref)); if (a && a.id === c.id) judge(a, c.cid, op); return; }
    h.send(c.scope, c.ref, [c.cid, c.id, op]);
  }
  /** A harvest the service refused outright wrote no row: the body is open again (a refusal that is no word - 'node-taken', 'lapsed' - leaves it). */
  function refused(scope, ref, error) {
    if (error == null || error === 'node-taken' || error === 'lapsed') return;
    const c = lastClaim.get(addr(scope, ref));
    const e = c ? entryOf(scope, ref) : null;
    if (c && e && e.s === SKINNED && e.cid === c.cid) say(c, OP_UNSKIN);
  }
  function lost(c, text) {
    claims.delete(c.cid);
    if (text !== 'taken') say(c, OP_RELEASE);   // another's lease is not mine to release
    try { c.onLost?.(); } catch (e) { console.warn('[skin] a claim\'s end', e); }
    if (text) h.say?.(text === 'taken' ? SKIN_TAKEN_TEXT : SKIN_UNANSWERED_TEXT);
  }

  // ═══ THE FRAME ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

  /** One pool frame: the lapsed leases read (so an open body reaches the stream at the lapse, not at the next claim), the bodies gone forgotten,
   *  and every claim of mine driven against the verdict. */
  function update() {
    const now = h.now();
    for (const a of auth.values()) stateOf(a);
    if (now - sweptAt >= 1000) {
      sweptAt = now;
      for (const a of [...auth.values()]) if (h.exists && !h.exists(a.ref)) auth.delete(key(a.ref));
    }
    for (const c of [...claims.values()]) {
      if (!claims.has(c.cid)) continue;
      const e = entryOf(c.scope, c.ref);
      const skinnedMine = !!e && e.s === SKINNED && e.cid === c.cid;
      if (skinnedMine && !(e.local && !e.local.said && h.audience())) { claims.delete(c.cid); continue; }   // the authority's word: done (its own skin, once its frame is built)
      if (!c.alive() && !skinnedMine) { claims.delete(c.cid); say(c, OP_RELEASE); continue; }   // an act abandoned frees the body at once
      if (e && (e.s === HELD || e.s === SKINNED) && e.cid !== c.cid) { lost(c, 'taken'); continue; }
      if (e && e.s === OWNS) { lost(c, null); continue; }
      if (e && (e.s === HELD || e.s === SKINNED) && e.cid === c.cid && !c.grantedAt) c.grantedAt = now;
      if (c.grantedAt && now - c.grantedAt >= SKIN_HOLD_MAX_MS) { lost(c, null); continue; }   // the lease's cap, as the authority holds it
      if (c.ended()) {
        if (!c.doneAt) { c.doneAt = now; c.nextSay = now; }
        if (now - c.doneAt >= SKIN_DONE_WAIT_MS) { lost(c, 'unanswered'); continue; }
        if (now >= c.nextSay) { say(c, OP_DONE); c.nextSay = now + Math.min(CLAIM_RESEND_MS * 2 ** c.doneN, CLAIM_RESEND_MAX_MS); c.doneN++; }
      } else {
        if (!c.grantedAt && now - c.startedAt >= SKIN_GRANT_WAIT_MS) { lost(c, 'unanswered'); continue; }
        if (now >= c.nextSay) { say(c, OP_HOLD); c.nextSay = now + SKIN_RENEW_MS; }
      }
    }
  }

  return { mint, noteBlow, applyHit, keyFor, peek, frameEntries, forget, takeSeat, hear, forgetEntry, pruneScope, clearAll, skinOf, update, stateOf, size: () => auth.size };
}
