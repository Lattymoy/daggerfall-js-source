// @ts-check
// AUDIT FOES FOE2 (2026-09-15, Mac relaying players: "during online play,
// certain enemies cant be damaged"): A BLOW THE WIRE REFUSED MUST NOT BE LOST.
//
// This is AUDIT WORLD3 A3's law for the acts (`_actPend`, scenes/world.js)
// applied to the blow - and the blow needed it MORE. An act is a state, so a
// lost one is a door that reads wrong until someone touches it again; a hit is
// a DELTA and the striker applies nothing locally. A joiner's damageFoe hands
// the blow to the owner and RETURNS, so a refused frame is not a late blow, it
// is a blow that never happened, and the enemy simply does not take damage.
//
// `sendHit` refuses on five conditions and both sinks threw the answer away.
// The commonest is the rate gate, and it is NOT random: one swing emits one
// frame PER FOE IN REACH, in pool order, against HIT_HZ_MAX (10/s). Measured, a
// Speed-100 character among six foes offers 26 blows a second and lands 44 on
// the first two while the last three take two apiece - the same physical
// enemies starve every swing, which is the report in one line.
//
// TWO BOUNDS, because a held blow that can never be sent is the live-lock AUDIT
// WORLD4 A1 paid for: at most `max` held, and nothing older than `ms` - a blow
// from two seconds ago is a fight that has moved on, and a long reconnect must
// not resurrect it. A blow minted in another room names an index or an owner
// that means nothing here, so a room change empties the queue.
//
// ORDER IS KEPT: a new blow goes BEHIND whatever is already waiting, so the
// queue drains oldest-first and one foe cannot overtake another.
//
// LOOT-DUP (2026-09-15, AUDIT ONCRASH1's own finding): AND EVERY FRAME LEARNS
// ITS OWN FATE. The boolean this door returns is the QUEUE's news, not the
// caller's frame's: with anything already waiting it answers `flush`, which is
// true when some OTHER blow went, and a frame that is merely QUEUED answers
// false although it usually leaves a frame later. Two callers read it as their
// own frame's answer, and one of them empties a corpse with it
// (exteriorFoes.js grantCorpse):
//
//   - queued, then delivered  -> answered false, so the owner kept the items
//     AND the taker received them. The next peer to ask that body is granted
//     the same loot again. ITEM DUPLICATION, silent, online only.
//   - queued behind a blow that went -> answered true, then evicted by `max`,
//     aged past `ms`, or wiped by a room change. The items left the corpse and
//     arrived nowhere.
//
// So a caller may hand in a FATE - `{ sent, dropped }` - and exactly one of the
// two is called exactly once, whenever that frame's story actually ends. The
// return value is unchanged for the callers that only want a hint. A caller
// holding something irreversible (a corpse's items) RESERVES it when the frame
// is accepted and puts it back on `dropped`, which is the only order in which
// no second asker can be granted what is already in flight.

/**
 * @param {object} io
 * @param {(hit:object) => boolean} io.send   the session's sendHit - true when it really went
 * @param {() => string|null} io.room         the room a blow would be struck in now
 * @param {() => number} io.now               a monotonic clock, ms
 * @param {number} [io.max]                   the most blows held at once
 * @param {number} [io.ms]                    the oldest a held blow may be
 * @param {(line:string) => void} [io.warn]
 */
export function makeHitPend({ send, room, now, max = 64, ms = 2000, warn = (l) => console.warn(l) }) {
  const pend = [];
  let dropSaid = false;
  /** LOOT-DUP: one frame's story ends exactly once. A fate that throws is the CALLER's problem, never the queue's. */
  const settle = (e, ok) => {
    const fn = ok ? e.fate?.sent : e.fate?.dropped;
    e.fate = null;
    if (!fn) return;
    try { fn(); } catch (err) { warn(`[online] a blow's ${ok ? 'send' : 'drop'} handler threw: ${err?.message ?? err}`); }
  };
  const wipe = () => { while (pend.length) settle(pend.shift(), false); };
  const push = (r, hit, at, fate) => {
    if (pend.length >= max) {
      settle(pend.shift(), false);
      if (!dropSaid) { dropSaid = true; warn(`[online] more blows than the wire will carry - the oldest go (${max} held, ${ms} ms)`); }
    }
    pend.push({ room: r, hit, at, fate });
  };
  /** Every blow still waiting, oldest first, while the gate keeps letting them out. */
  const flush = (at = now()) => {
    if (!pend.length) return false;
    const r = room();
    if (r == null || pend[0].room !== r) { wipe(); return false; }            // another room's blows name nothing here
    while (pend.length && at - pend[0].at > ms) settle(pend.shift(), false);  // the fight moved on
    let went = false;
    while (pend.length) {
      if (!send(pend[0].hit)) break;   // the gate is spent, or the socket is away - the rest wait for a later frame
      settle(pend.shift(), true); went = true;
    }
    return went;
  };
  /** The one door both pools' blows go out of (WORLD2's dungeon puppet, WORLD6b's cell owner). */
  const sendOrHold = (hit, fate = null) => {
    const e = { fate };
    if (!hit || typeof hit !== 'object' || Array.isArray(hit)) { settle(e, false); return false; }
    const r = room();
    if (r == null) { wipe(); settle(e, false); return false; }
    const at = now();
    if (pend.length && pend[0].room !== r) wipe();
    if (pend.length) { push(r, hit, at, fate); return flush(at); }   // behind what is already waiting
    if (send(hit)) { settle(e, true); return true; }
    push(r, hit, at, fate);
    return false;
  };
  /** LOOT-DUP: the pool going away is every held frame's end - the reservations come back rather than vanishing. */
  const clear = () => wipe();
  return { send: sendOrHold, flush, clear, get held() { return pend.length; } };
}
