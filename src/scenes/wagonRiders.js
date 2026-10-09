// @ts-check
// WAGONS1 (2026-10-09, Mac: "the ability for players to request to sit in the back of the cart and be transported across
// daggerfall"; asked, "Players and companions"): THE SEATS IN THE BACK, ON THE WORLD HOST. systems/wagonSeats.js is
// the law (the seats, the asks, the words); this runs both ends of it for one client:
//
//  - AS A RIDER: another player's wagon with seats lists "Ask to ride" on its plaque (scenes/horseCartPool.js rows);
//    the press says `wr: { a: owner }` on my foes frame until the owner answers or RIDE_ASK_TTL_MS passes. The owner's
//    word naming me in its `ps` seats me: from then each frame my feet are that seat's on their wagon as drawn here
//    (the pool's peerSeat - its ease, its hitch, its turn) and my motor holds (`seated()` - the host's holdFrame), and I
//    say `wr: { s: [owner, seat] }`. Jump gets me down, beside the wagon; so does the owner's word no longer naming me,
//    or the owner gone from the room. When the owner sets out on a fast travel with me aboard (their `go`), I go too -
//    the party's own journey (systems/partyTravel.js: no fare - the owner paid - landing beside the owner's wagon at
//    the far end), and sit down again there.
//  - AS AN OWNER: a rider's ask is put to me on the duel's strip (ui/duelPrompt.js - "X asks to ride in the back of your
//    wagon"), Accept seating them in the lowest free seat, Decline turning them away (`pn`, so they hear at once);
//    who sits where is my word's `ps`. A fast travel of mine with riders aboard says `go` first and waits a moment
//    (GO_LEAD_MS) for them to hear it.
//
// deps = { selfId(), name(id) -> string, now() -> ms, say(text), changed() (my word moved), pool: the cart's pool (peerRide, peerSeat, mySeatCount),
//          pin(feet, yaw) (stand me there, the motor held), unpin(feet) (stand me down beside the wagon), jumpPressed(),
//          travel({x, y}, besideAt, ownerName) (the party's journey), canTravel() (outdoors, not busy), prompt: { open, render } }
// Not a DFU member. Ledger A (WAGONS1).
import { createRideBook, validRideWord, rideWord, RIDE_TEXT, RIDE_ASK_TTL_MS, RIDE_ASK_REACH, companionSeats } from '../systems/wagonSeats.js';
import { WAGON_KINDS } from '../systems/wagonKinds.js';

/** How long a fast travel waits after saying `go`, so the riders' clients hear it before the owner leaves the room. */
export const GO_LEAD_MS = 1200;
/** How long a journey's word stands (ms) - past the far end's loading, for a rider still setting out. */
export const GO_HOLD_MS = 30_000;
/** How long a rider who followed a journey waits at the far end for the owner's wagon to be heard there (ms). */
export const ARRIVE_WAIT_MS = 15_000;
/** How far beside the wagon a rider stands when they get down (m). */
export const GET_DOWN_STEP = 1.6;
/** The plaque rows' ids (the pool hands a press back with one). */
export const RIDE_ROW = Object.freeze({ ask: 'wagon:ride', down: 'wagon:down' });

export function createWagonRiders(deps) {
  const book = createRideBook();
  /** @type {{ owner: string, at: number, seat: number|null, go: number|null, wait?: number } | null} */
  let ride = null;
  let goSeq = 0, go = null, goAt = 0;   // my journey's word ([x, y, n]) while it is said, and when it was first said
  const declinedUntil = new Map();   // rider -> until (ms): my `pn`
  const name = (id) => deps.name?.(id) || 'Someone';
  const me = () => deps.selfId?.() ?? null;

  // ── as a rider
  /** "Ask to ride" pressed on `owner`'s wagon (or "Get down" on the one I sit in). */
  function press(owner, id, distance = 0) {
    if (id === RIDE_ROW.down) { if (ride?.owner === owner) getDown(); return true; }
    if (id !== RIDE_ROW.ask) return false;
    if (!(distance <= RIDE_ASK_REACH)) { deps.say(RIDE_TEXT.noSeats); return true; }
    const r = deps.pool.peerRide(owner);
    const seats = WAGON_KINDS[r?.model]?.seats ?? 0;
    if (!seats) { deps.say(RIDE_TEXT.noSeats); return true; }
    if ((r.passengers?.length ?? 0) >= seats) { deps.say(RIDE_TEXT.full); return true; }
    ride = { owner, at: deps.now(), seat: null, go: r.go?.[2] ?? null };
    deps.changed?.();
    deps.say(RIDE_TEXT.asking(name(owner)));
    return true;
  }
  /** Down from the wagon, beside it - or just no longer asking.
   *  @param {string} [text] */
  function getDown(text = RIDE_TEXT.gotOff) {
    const was = ride;
    ride = null;
    if (was) deps.changed?.();
    if (was?.seat != null) {
      const at = deps.pool.peerSeat(was.owner, was.seat);
      deps.unpin?.(at ? [at.feet[0] - Math.sin(at.yaw) * GET_DOWN_STEP, at.feet[1], at.feet[2] - Math.cos(at.yaw) * GET_DOWN_STEP] : null);   // over the side behind them (a seat faces across the bed)
      if (text) deps.say(text);
    }
  }
  /** The plaque's rows over another player's wagon: ask while it has a seat for me, get down from the one I sit in. */
  function rows(owner, kind, kept) {
    if (kept || !(WAGON_KINDS[kind]?.seats > 0)) return [];
    if (ride?.owner === owner && ride.seat != null) return [{ id: RIDE_ROW.down, label: RIDE_TEXT.getOff }];
    return [{ id: RIDE_ROW.ask, label: RIDE_TEXT.ask }];
  }

  // ── as an owner
  /** Another player's `wr`, heard on their foes frame (null: they said none). */
  function hear(rider, raw) {
    const said = book.hear(rider, raw == null ? null : validRideWord(raw), me(), deps.now());
    if (said === 'left') deps.say(RIDE_TEXT.left(name(rider)));
    if (said === 'asked') deps.prompt?.render?.();
  }
  /** A rider gone from the room. */
  const forget = (rider) => book.drop(rider);
  /** The room's players now (`alive` a Set of ids): a rider of mine who left it gets down with them. */
  function sweep(alive) {
    const journey = go && deps.now() - goAt < GO_HOLD_MS;   // my riders are on the road behind me: their seats wait for them
    if (!journey) for (const [rider] of book.passengers()) if (!alive?.has?.(rider)) { book.drop(rider); deps.say(RIDE_TEXT.left(name(rider))); }
    for (const a of book.asks()) if (!alive?.has?.(a.rider)) book.drop(a.rider);
  }
  function accept(rider) {
    if (!book.accept(rider, deps.pool.mySeatCount())) { deps.say(RIDE_TEXT.full); return; }
    deps.say(RIDE_TEXT.seated(name(rider)));
  }
  function decline(rider) { book.decline(rider, deps.now()); declinedUntil.set(rider, deps.now() + 4000); }
  /** The duel strip's list: the asks standing, oldest first. */
  const asks = () => book.asks().map((a) => ({ peer: a.rider, at: a.at }));
  /** A fast travel of mine to `to` - true when riders sit in my wagon and were told (the caller waits GO_LEAD_MS). */
  function announce(to) {
    if (!book.passengers().length) return false;
    go = [to.x | 0, to.y | 0, ++goSeq];
    goAt = deps.now();
    return true;
  }

  /** One frame (after the cart's pool stepped): my riders kept to my seats, my ride kept to its seat. */
  function frame() {
    const now = deps.now();
    // the owner's end
    book.fit(deps.pool.mySeatCount());
    if (go && now - goAt > GO_HOLD_MS) go = null;   // the journey said long enough
    book.lapse(now);   // an ask unanswered goes - the rider hears it lapse on their own clock
    for (const [r, until] of [...declinedUntil]) if (until <= now) declinedUntil.delete(r);
    deps.prompt?.render?.();
    // the rider's end
    if (!ride) return;
    if (deps.traveling?.() && ride.go != null) ride.wait = now + ARRIVE_WAIT_MS;   // the far end's wait runs from the arrival
    const r = deps.pool.peerRide(ride.owner);
    if (!r || r.model == null) {
      if (ride.seat != null) { if (!deps.traveling?.() && !((ride.wait ?? 0) > now)) getDown(RIDE_TEXT.ownerGone); }   // on the road, or waiting at its end for the owner's word
      else if (now - ride.at > RIDE_ASK_TTL_MS) { const o = ride.owner; ride = null; deps.changed?.(); deps.say(RIDE_TEXT.noAnswer(name(o))); }
      return;
    }
    const mine = r.passengers.find((e) => e[0] === me());
    if (ride.seat == null) {
      if (r.declined.includes(me())) { const o = ride.owner; ride = null; deps.changed?.(); deps.say(RIDE_TEXT.declined(name(o))); return; }
      if (!mine) { if (now - ride.at > RIDE_ASK_TTL_MS) { const o = ride.owner; ride = null; deps.changed?.(); deps.say(RIDE_TEXT.noAnswer(name(o))); } return; }
      ride.seat = mine[1];
      deps.changed?.();
      deps.say(RIDE_TEXT.accepted(name(ride.owner)));
    } else if (!mine) { getDown(RIDE_TEXT.gotOff); return; }
    else ride.seat = mine[1];
    if (deps.jumpPressed?.()) { getDown(); return; }
    // the owner sets out: I go with them (once a journey), landing beside their wagon at the far end
    if (r.go && r.go[2] !== ride.go) {
      ride.go = r.go[2];
      ride.wait = now + ARRIVE_WAIT_MS;
      const owner = ride.owner;
      if (deps.canTravel?.()) deps.travel({ x: r.go[0], y: r.go[1] }, () => { const w = deps.pool.peerRide(owner)?.wire; return w ? { x: w[0], y: w[1], z: w[2] } : null; }, name(owner));   // beside their wagon, in natives (partyTravelLaw.js besideTargetOf's shape)
      return;
    }
    const at = deps.pool.peerSeat(ride.owner, ride.seat);
    if (at) deps.pin(at.feet, at.yaw);
  }

  return {
    press, rows, hear, forget, sweep, accept, decline, asks, announce, frame, getDown,
    /** Whether I sit in another's wagon (the host holds my motor). */
    seated: () => ride?.seat != null,
    /** My `wr`, for my foes frame. */
    word: () => (ride ? rideWord(ride) : null),
    /** My word's `ps`, `go` and `pn` (the pool's `riders`). */
    passengers: () => book.passengers(),
    go: () => go,
    declined: () => [...declinedUntil.keys()],
    /** The seats my players hold - the companions take the rest (systems/wagonSeats.js companionSeats). */
    playerSeats: () => book.passengers().map((e) => e[1]),
    /** Where the `i`th of my companions rides, of `n` seats, while my wagon goes with me - or null. */
    companionSeat(i, riding) {
      const n = deps.pool.mySeatCount();
      const k = companionSeats(n, book.passengers().map((e) => e[1]), i + 1, riding)[i];
      return k >= 0 ? deps.pool.mySeat(k) : null;
    },
    /** A journey's word said long enough: quiet again. */
    quietGo() { go = null; },
    clear() { book.clear(); ride = null; go = null; declinedUntil.clear(); },
  };
}
