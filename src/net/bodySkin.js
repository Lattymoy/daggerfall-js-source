// @ts-check
// PARTY-SKIN (PR B; test-harness/loot-followups/DESIGN-B.md; bible/06-Systems/Online-Arc.md PARTY-SKIN, Professions-Arc.md 5.2):
// ONE SKIN PER BODY, WHOEVER MAY LOOT IT MAY SKIN IT, FIRST COME, JUDGED BY ITS AUTHORITY. The pure half: the constants, the
// wire's projections and the lease judge. scenes/bodySkinHost.js runs it over a pool (the street's and a building's through the
// foe-body block, a dungeon's through the room block).
//
// THE LAW (Travis, 2026-10-19): "bodies can be skinned only once by anyone which I think aligns with your recommendations"; "it should
// follow whatever loot rules are in main, if anyone means anyone then that should follow skinning too - the important piece is that a
// body can only be skinned once"; "whatever the loot rules are on main should be consistent here".
//
// THE SKIN ID is minted ONCE, at the death, by the body's authority (the foe's owner on the street and in a building, the room's host in
// a dungeon) - twelve hex digits from the CSPRNG - and rides the authority's foes frame as a top-level field beside the records it
// describes (the `qf`/`dz`/`bw` pattern): `bs: [[ref, id, s, cid?], ...]`.
//   ref  the body: the record's number (street), 'corpse:<i>' | 'enc:<id>' (a dungeon's)
//   id   the skin id (the harvest's node is body:<the skinner's day>:<id>), '' when s is 3
//   s    0 OPEN, 1 HELD (a lease), 2 SKINNED (final), 3 THE KILLER'S OWN (the body follows the private stamp: an older striker's kill,
//        a quest foe's body, a body outside the room's base - no one else sees a node)
//   cid  the claim id that holds or skinned it (net/roomLoot.js roomClaimId: it names its claimer), s 1 and 2 only
// A CLAIM is a hit to the authority, `sq: [cid, id, op]`: op 1 HOLD (the claim, and its renewals), 2 DONE, 0 RELEASE, 3 UNSKIN. The
// verdict rides the authority's STREAM (idempotent, re-sent on every full frame): a lost frame heals by itself.
//
// THE LEASE. First come on the authority's receipt. A lease is renewed every SKIN_RENEW_MS, lapses SKIN_LEASE_MS after the holder's last
// word and is capped at SKIN_HOLD_MAX_MS from its grant, so an act that slips for ever cannot keep the body; an act abandoned says
// RELEASE and frees it at once. NO HIDE IS ASKED BEFORE THE AUTHORITY HAS MARKED THE BODY SKINNED TO THE ASKER (two-phase: DONE, then the
// stream's word): a claimer that leaves between DONE and the harvest can leave a body skinned for nobody, never skinned twice. A definite
// service refusal says UNSKIN and the body is open again (no hide was granted for it).
import { claimOf, validRoomId } from '../systems/roomLoot.js';

/** The holder's HOLD while its act lives (ms). */
export const SKIN_RENEW_MS = 2000;
/** A lease lapses this long after the holder's last word: the longest clean trace (TRACE_ACT.maxS, 6 s), each side's hit queue holding a refused frame up to 2 s (net/hitPend.js), and a grace. */
export const SKIN_LEASE_MS = 12_000;
/** Every lease ends this long after its grant, renewed or not. */
export const SKIN_HOLD_MAX_MS = 30_000;
/** A claim never granted ends its act after this long. */
export const SKIN_GRANT_WAIT_MS = 4000;
/** A DONE never confirmed ends its act after this long (the body may stay skinned for nobody). */
export const SKIN_DONE_WAIT_MS = 10_000;
/** The authority's answer budget per peer, a second (its own bucket: it never starves the loot claims'). */
export const SKIN_ASKS_PER_S = 4;
/** The most bodies a reader or an authority keeps a skin entry for. */
export const SKIN_KEPT_MAX = 512;
/** What a loser is told (L10N4: counted in the ratchet's map, owed to a localisation slice with the catalog's other rows). */
export const SKIN_TAKEN_TEXT = 'Someone else is skinning that.';
export const SKIN_UNANSWERED_TEXT = 'Nobody answered for the body.';

export const OPEN = 0, HELD = 1, SKINNED = 2, OWNS = 3;
export const OP_RELEASE = 0, OP_HOLD = 1, OP_DONE = 2, OP_UNSKIN = 3;
export const SKIN_ID_RE = /^[0-9a-f]{12}$/;

/** A skin id: twelve hex digits from `rand` (the crypto source's fill). @param {(b: Uint8Array<ArrayBuffer>) => void} rand */
export function bodyId(rand) {
  const b = new Uint8Array(6);
  rand(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * One entry of a foes frame's `bs`, projected - or null (an entry that fails is ignored whole).
 * @param {any} e @param {(ref: any) => boolean} validRef the pool's own ref shape
 * @returns {{ ref: any, id: string, s: number, cid: string|null }|null}
 */
export function validSkinEntry(e, validRef) {
  if (!Array.isArray(e) || e.length < 3 || e.length > 4 || !validRef(e[0])) return null;
  const [ref, id, s, cid] = e;
  if (!Number.isInteger(s) || s < OPEN || s > OWNS) return null;
  if (s === OWNS ? id !== '' : (typeof id !== 'string' || !SKIN_ID_RE.test(id))) return null;
  if (s === HELD || s === SKINNED) { if (!validRoomId(cid)) return null; } else if (cid !== undefined) return null;
  return { ref, id, s, cid: s === HELD || s === SKINNED ? cid : null };
}

/**
 * A claim hit's `sq`, projected against its sender - or null: the claim id must name its sender (no peer claims in another's name),
 * the id twelve hex digits, the op one of the four.
 * @param {any} sq @param {any} from @returns {{ cid: string, id: string, op: number }|null}
 */
export function validSkinClaim(sq, from) {
  if (!Array.isArray(sq) || sq.length !== 3) return null;
  const [cid, id, op] = sq;
  if (!validRoomId(cid) || !claimOf(cid, from) || typeof id !== 'string' || !SKIN_ID_RE.test(id)) return null;
  if (!Number.isInteger(op) || op < OP_RELEASE || op > OP_UNSKIN) return null;
  return { cid, id, op };
}

/** The wire's entry for a body whose authority state is `st`. @param {any} ref @param {string} id @param {SkinState} st */
export function skinEntry(ref, id, st) {
  if (st.s === OWNS) return [ref, '', OWNS];
  return st.s === HELD || st.s === SKINNED ? [ref, id, st.s, st.cid] : [ref, id, st.s];
}

/**
 * @typedef {{ s: number, cid: string|null, until: number, cap: number, last: { cid: string, cap: number }|null, spent: string|null }} SkinState
 *   `until` / `cap` - a lease's lapse and its hard end; `last` - the holder whose lease lapsed (its cap still binds it);
 *   `spent` - a claim whose cap ended it or whose skin was reopened: it may not claim the body again
 */
/** A body just fallen: open, or the killer's own. @param {boolean} own @returns {SkinState} */
export const newSkinState = (own) => ({ s: own ? OWNS : OPEN, cid: null, until: 0, cap: 0, last: null, spent: null });

/** The state with a lapsed lease read as open (a lapse is read lazily, wherever the state is read). @param {SkinState} st @param {number} now @returns {SkinState} */
export function settleSkin(st, now) {
  if (st.s !== HELD || !(now >= st.until || now >= st.cap)) return st;
  const capped = now >= st.cap;
  return { s: OPEN, cid: null, until: 0, cap: 0, last: capped ? null : { cid: /** @type {string} */ (st.cid), cap: st.cap }, spent: capped ? st.cid : st.spent };
}

/**
 * THE JUDGE (pure): a word `op` from claim `cid` on a body in state `st` at `now`. First come: a live lease is its holder's until it
 * lapses, is released or ends at its cap; a skin is final. Answers `{ state, ok }` - `ok` false: refused, nothing changed.
 * @param {SkinState} st @param {string} cid @param {number} op @param {number} now @returns {{ state: SkinState, ok: boolean }}
 */
export function judgeSkin(st, cid, op, now) {
  const cur = settleSkin(st, now);
  const no = { state: cur, ok: false };
  if (cur.s === OWNS) return no;
  if (op === OP_RELEASE) return cur.s === HELD && cur.cid === cid ? { state: { ...cur, s: OPEN, cid: null, until: 0, cap: 0, last: null }, ok: true } : { state: cur, ok: true };
  if (op === OP_UNSKIN) return cur.s === SKINNED && cur.cid === cid ? { state: { s: OPEN, cid: null, until: 0, cap: 0, last: null, spent: cid }, ok: true } : { state: cur, ok: true };
  if (cur.s === SKINNED) return cur.cid === cid && op === OP_DONE ? { state: cur, ok: true } : no;   // a re-said DONE changes nothing
  if (cur.s === HELD && cur.cid !== cid) return no;   // a live lease is its holder's
  if (cur.spent === cid) return no;   // its cap ended it, or its skin was reopened
  const own = cur.s === HELD ? cur : null;
  const capOf = own ? own.cap : cur.last && cur.last.cid === cid ? cur.last.cap : now + SKIN_HOLD_MAX_MS;
  if (now >= capOf) return no;
  if (op === OP_DONE) return { state: { s: SKINNED, cid, until: 0, cap: 0, last: null, spent: cur.spent }, ok: true };
  return { state: { s: HELD, cid, until: Math.min(now + SKIN_LEASE_MS, capOf), cap: capOf, last: null, spent: cur.spent }, ok: true };
}

/**
 * What a player's Skin pop-up says of a body: 'open', 'held' (another's live lease), 'skinned' (by another), 'mine' (my lease, or my
 * skin the authority has not yet said), 'mineSkinned' (skinned to my claim, said).
 * @param {{ s: number, cid: string|null }|null} entry @param {(cid: string) => boolean} isMine @returns {'open'|'held'|'skinned'|'mine'|'mineSkinned'|'pending'}
 */
export function skinView(entry, isMine) {
  if (!entry || entry.s === OWNS) return 'pending';
  if (entry.s === OPEN) return 'open';
  const mine = !!entry.cid && isMine(entry.cid);
  if (entry.s === HELD) return mine ? 'mine' : 'held';
  return mine ? 'mineSkinned' : 'skinned';
}
