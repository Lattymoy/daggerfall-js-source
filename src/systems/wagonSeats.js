// @ts-check
// WAGONS1 (2026-10-09, Mac: "an open wagon ... with ... the ability for players to request to sit in the back of the
// cart and be transported across daggerfall"; asked, "Players and companions"): THE SEATS IN THE BACK - THE LAW.
//
// The Open Wagon has four seats in its bed (world/wagonModels.js seatsFor - two a side along its back half, each facing
// across it). They are its OWNER's to give: another player ASKS for one and the owner answers (scenes/wagonRiders.js),
// and the owner's companions take what the players have not while the owner drives (a companion rides only while the
// wagon goes with its owner - the team trailing behind the owner's cart or following them; parked, they step down and
// walk at heel again). Each seat holds one; a player's seat is theirs until they get down, so companions take the free
// ones in order and a player accepted later than they sat down takes a seat a companion gives up.
//
// THE WORD. A rider's own foes frame says what they ask or where they sit (`wr`: `{ a: owner }` asking, `{ s: [owner,
// seat] }` seated); the owner's says who sits where (`hv.ps`: `[[peer, seat], ...]` - systems/horseCartWire.js), the
// owner's alone deciding: a rider is seated only by the owner's word naming them, and sits only while it does. Both
// ride the cell's foes frame, which the relay carries as it is (net/wire.js: no relay change, and no deploy before a
// client), so an older client reading them drops what it does not know and sees a player standing in a wagon's bed.
//
// Pure: no DOM, no renderer, no clock. Not a DFU member. Ledger A (WAGONS1).

/** How long an unanswered ask stands (ms) - DUEL1's ask's (net/duelSession.js DUEL_ASK_TTL_MS). */
export const RIDE_ASK_TTL_MS = 30_000;
/** How long a declined rider waits before asking that owner again (ms) - DUEL1's re-ask's. */
export const RIDE_REASK_MS = 15_000;
/** How far (m) a rider may stand from a wagon to ask for a seat in it - the mod's activation reach and a stride. */
export const RIDE_ASK_REACH = 6;
/** The most seats any wagon has (the wire's bound on a seat index). */
export const MAX_SEATS = 4;
/** A peer id as the wire carries one (net/wire.js's ids: the relay's, short and printable). */
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const validPeerId = (v) => typeof v === 'string' && ID_RE.test(v);

/** The words the rows and the prompts say. */
export const RIDE_TEXT = Object.freeze({
  ask: 'Ask to ride',
  getOff: 'Get down',
  asking: (owner) => `You ask ${owner} for a seat in the back.`,
  asked: (rider) => `${rider} asks to ride in the back of your wagon.`,
  accepted: (owner) => `${owner} waves you up into the back of the wagon.`,
  declined: (owner) => `${owner} has no room for you.`,
  noAnswer: (owner) => `${owner} did not answer.`,
  full: 'There is no seat free in the back.',
  noSeats: 'There is no room to ride in the back of this wagon.',
  seated: (rider) => `${rider} climbs into the back of your wagon.`,
  left: (rider) => `${rider} climbs down from your wagon.`,
  gotOff: 'You climb down from the wagon.',
  ownerGone: 'The wagon you rode in is gone; you climb down.',
  leftBehind: (owner) => `You could not go with ${owner}; you climb down.`,   // WAGONS2 (AUDIT)
});

/** A rider's word (`wr` on their foes frame) through the door, or null. */
export function validRideWord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (raw.a !== undefined) return validPeerId(raw.a) ? { ask: raw.a } : null;
  if (Array.isArray(raw.s) && raw.s.length === 2 && validPeerId(raw.s[0]) && Number.isInteger(raw.s[1]) && raw.s[1] >= 0 && raw.s[1] < MAX_SEATS) return { seated: raw.s[0], seat: raw.s[1] };
  return null;
}
/** A rider's word as their frame says it: asking `owner`, or seated in `owner`'s `seat`, or nothing. */
export const rideWord = (state) => (!state ? null : state.seat != null ? { s: [state.owner, state.seat] } : { a: state.owner });

/** An owner's passengers (`hv.ps`) through the door: at most MAX_SEATS, each seat and each rider once - or null. */
export function validPassengers(raw) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > MAX_SEATS) return null;
  const seats = new Set(), riders = new Set(), out = [];
  for (const e of raw) {
    if (!Array.isArray(e) || e.length !== 2 || !validPeerId(e[0]) || !Number.isInteger(e[1]) || e[1] < 0 || e[1] >= MAX_SEATS) return null;
    if (seats.has(e[1]) || riders.has(e[0])) return null;
    seats.add(e[1]); riders.add(e[0]);
    out.push([e[0], e[1]]);
  }
  return out;
}

/** The seat a newly accepted rider takes: the lowest no player holds (`taken` the players' seats), of `n`; -1 none. */
export function freeWagonSeat(n, taken) {
  const held = new Set(taken);
  for (let k = 0; k < n; k++) if (!held.has(k)) return k;
  return -1;
}

/** Which seat each companion rides in (by their order across every party - the crew's hands, then the sworn): the
 *  seats no player holds, in order; a companion past them walks. `riding` whether the wagon goes with its owner. */
export function companionSeats(n, playerSeats, count, riding) {
  if (!riding || !(n > 0)) return Array.from({ length: count }, () => -1);
  const held = new Set(playerSeats);
  const free = [];
  for (let k = 0; k < n; k++) if (!held.has(k)) free.push(k);
  return Array.from({ length: count }, (_, i) => (i < free.length ? free[i] : -1));
}

/** The owner's book of riders: who asked (and when), who sits where, who was turned away (and until when). Pure state
 *  over `now` handed in. */
export function createRideBook() {
  const asks = new Map();   // rider -> at (ms)
  const seated = new Map();   // rider -> seat
  const declined = new Map();   // rider -> until (ms)
  return {
    /** A rider's word heard this frame (`word` validRideWord's or null); answers what changed: 'asked' (a new ask to
     *  put to the owner), 'left' (a seated rider who no longer says they sit), or null. */
    hear(rider, word, me, now) {
      if (!validPeerId(rider)) return null;
      const asking = word?.ask === me, sitting = word?.seated === me;
      if (seated.has(rider) && !sitting && !asking) { seated.delete(rider); return 'left'; }
      if (asking && !seated.has(rider) && !asks.has(rider) && !((declined.get(rider) ?? 0) > now)) { asks.set(rider, now); return 'asked'; }
      if (!asking) asks.delete(rider);
      return null;
    },
    /** The owner says yes: the rider takes the lowest free seat of `n` (false: none free, or no ask stands). */
    accept(rider, n) {
      if (!asks.has(rider)) return false;
      asks.delete(rider);
      const k = freeWagonSeat(n, [...seated.values()]);
      if (k < 0) return false;
      seated.set(rider, k);
      return true;
    },
    /** The owner says no: the ask goes, and that rider waits RIDE_REASK_MS before asking again. */
    decline(rider, now) { asks.delete(rider); declined.set(rider, now + RIDE_REASK_MS); },
    /** A rider gone from the room, or the wagon no longer one with seats (`n` 0): out of the book. */
    drop(rider) { asks.delete(rider); seated.delete(rider); },
    /** Every seat given up (the owner's wagon gone, or changed for one with fewer seats than are taken). */
    fit(n) { for (const [r, k] of [...seated]) if (k >= n) seated.delete(r); if (!n) asks.clear(); },
    /** Asks older than RIDE_ASK_TTL_MS: dropped, and answered (the riders whose asks lapsed). */
    lapse(now) { const out = []; for (const [r, at] of [...asks]) if (now - at > RIDE_ASK_TTL_MS) { asks.delete(r); out.push(r); } return out; },
    /** The asks standing, oldest first: `{ rider, at }`. */
    asks: () => [...asks.entries()].sort((a, b) => a[1] - b[1]).map(([rider, at]) => ({ rider, at })),
    /** Who sits where - the owner's word (`hv.ps`). */
    passengers: () => [...seated.entries()].map(([r, k]) => [r, k]).sort((a, b) => a[1] - b[1]),
    seatOf: (rider) => seated.get(rider) ?? null,
    clear() { asks.clear(); seated.clear(); declined.clear(); },
  };
}
