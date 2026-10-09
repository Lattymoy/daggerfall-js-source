// @ts-check
// WAGONS1 (2026-10-09, Mac: "the ability for players to request to sit in the back of the cart and be transported across
// daggerfall"; asked, "Players and companions"): THE SEATS IN THE BACK, ON THE WORLD HOST. systems/wagonSeats.js is
// the law (the seats, the asks, the words); this runs both ends of it for one client:
//
//  - AS A RIDER: another player's wagon with seats lists "Ask to ride" on its plaque (scenes/horseCartPool.js `riders.acts`);
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
// deps = { selfId(), name(id) -> string, now() -> ms, say(text), changed() (my word moved), pool: the cart's pool (peerRide, peerSeat,
//          mySeatCount, mySeatsKnown), pin(feet, yaw) (stand me there, the motor held), unpin(feet) (stand me down beside the
//          wagon), feet() (where my body stands now - WAGONS2 AUDIT), world(p) (a scene point in the world's own frame, metres -
//          FINAL AUDIT: a body moved off its pin, whatever a rebase did), jumpPressed(), travel({x, y}, besideAt, ownerName) ->
//          Promise<boolean> (the party's journey, no fare), canTravel() (outdoors, not busy), prompt: { open, render },
//          drawAt(feet | null) (WAGONS2: where my body is DRAWN while I sit - the seat of a wagon drawn grown, or null) }
// Not a DFU member. Ledger A (WAGONS1).
import { createRideBook, validRideWord, rideWord, RIDE_TEXT, RIDE_ASK_TTL_MS, RIDE_ASK_REACH, companionSeats } from '../systems/wagonSeats.js';
import { WAGON_KINDS } from '../systems/wagonKinds.js';

/** How long a fast travel waits after saying `go`, so the riders' clients hear it before the owner leaves the room. */
export const GO_LEAD_MS = 1200;
/** How long a journey's word stands (ms) - past the far end's loading, for a rider still setting out. */
export const GO_HOLD_MS = 30_000;
/** How long a rider who followed a journey waits at the far end for the owner's wagon to be heard there (ms). */
export const ARRIVE_WAIT_MS = 15_000;
/** How long the owner's wagon may go unheard before a seated rider is stood down (ms) - a word missed, a frame's gap,
 *  is not the owner gone (WAGONS2 AUDIT: one frame without it stood the rider down). */
export const RIDE_LOST_GRACE_MS = 2000;
/** How far beside the wagon a rider stands when they get down (m). */
export const GET_DOWN_STEP = 1.6;
/** WAGONS2 (AUDIT): how far from their seat a rider may be and still be stood down beside the wagon (m) - further, the
 *  body was moved by something else (a load, a respawn, a teleport) and stays where it is. */
export const GET_DOWN_REACH = 6;
/** The plaque rows' ids (the pool hands a press back with one). */
export const RIDE_ROW = Object.freeze({ ask: 'wagon:ride', down: 'wagon:down' });

export function createWagonRiders(deps) {
  const book = createRideBook();
  /** @type {{ owner: string, at: number, seat: number|null, go: number|null, wait?: number, lost?: number|null, following?: boolean, followed?: boolean, pinned?: number[]|null } | null} */
  let ride = null;
  let goSeq = 0, go = null, goAt = 0;   // my journey's word ([x, y, n]) while it is said, and when it was first said
  const declinedUntil = new Map();   // rider -> until (ms): my `pn`
  const seatWords = new Map();   // WAGONS2 (FINAL AUDIT): peer -> the seat their own word says they sit in ({ seated, seat })
  const name = (id) => deps.name?.(id) || 'Someone';
  const me = () => deps.selfId?.() ?? null;

  // ── as a rider
  /** "Ask to ride" pressed on `owner`'s wagon (or "Get down" on the one I sit in). */
  function press(owner, id, distance = 0) {
    if (id === RIDE_ROW.down) { if (ride?.owner === owner) getDown(); return true; }
    if (id !== RIDE_ROW.ask) return false;
    if (!(distance <= RIDE_ASK_REACH)) { deps.say(RIDE_TEXT.tooFar); return true; }   // WAGONS2 (FINAL AUDIT): out of reach, said so
    if (ride?.seat != null) getDown();   // WAGONS2 (AUDIT): seated in one wagon and asking another - down from the first, over its side
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
    deps.drawAt?.(null);   // WAGONS2
    if (was) deps.changed?.();
    if (was?.seat != null) {
      const at = deps.pool.peerSeat(was.owner, was.seat);
      const body = deps.feet?.() ?? null;
      const near = at && (!body || Math.hypot(body[0] - at.feet[0], body[2] - at.feet[2]) <= GET_DOWN_REACH);   // WAGONS2 (AUDIT): a body moved off the seat by something else stays where it is
      deps.unpin?.(near ? [at.feet[0] - Math.sin(at.yaw) * GET_DOWN_STEP, at.feet[1], at.feet[2] - Math.cos(at.yaw) * GET_DOWN_STEP] : null);   // over the side behind them (a seat faces across the bed)
      if (text) deps.say(text);
    }
  }
  /** WAGONS2 (AUDIT): out of the ride where I stand - the host left the outdoors, died or loaded: no seat held, no step
   *  beside the wagon (the body is not on its seat), no line. */
  function leave() {
    const was = ride;
    ride = null;
    deps.drawAt?.(null);
    if (was) deps.changed?.();
  }
  /** The plaque's rows over another player's wagon: ask while it has a seat for me, get down from the one I sit in. */
  function acts(owner, kind, kept) {
    if (kept || !(WAGON_KINDS[kind]?.seats > 0)) return [];
    if (ride?.owner === owner && ride.seat != null) return [{ id: RIDE_ROW.down, label: RIDE_TEXT.getOff }];
    return [{ id: RIDE_ROW.ask, label: RIDE_TEXT.ask }];
  }

  // ── as an owner
  /** Another player's `wr`, heard on their foes frame (null: they said none). */
  function hear(rider, raw) {
    const word = raw == null ? null : validRideWord(raw);
    if (word?.seated) seatWords.set(rider, word); else seatWords.delete(rider);
    const said = book.hear(rider, word, me(), deps.now());
    if (said === 'left') deps.say(RIDE_TEXT.left(name(rider)));
    if (said === 'asked') deps.prompt?.render?.();
  }
  /** A rider gone from the room. */
  const forget = (rider) => { book.drop(rider); seatWords.delete(rider); };
  /** The room's players now (`alive` a Set of ids): a rider of mine who left it gets down with them. */
  function sweep(alive) {
    const journey = go && deps.now() - goAt < GO_HOLD_MS;   // my riders are on the road behind me: their seats wait for them
    if (!journey) for (const [rider] of book.passengers()) if (!alive?.has?.(rider)) { book.drop(rider); deps.say(RIDE_TEXT.left(name(rider))); }
    for (const a of book.asks()) if (!alive?.has?.(a.rider)) book.drop(a.rider);
    for (const peer of [...seatWords.keys()]) if (!alive?.has?.(peer)) seatWords.delete(peer);
  }
  function accept(rider) {
    if (!book.asks().some((a) => a.rider === rider)) { deps.say(RIDE_TEXT.lapsed(name(rider))); return; }   // WAGONS2 (FINAL AUDIT): the ask went before the press
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

  /** WAGONS2 (FINAL AUDIT): a fast travel of mine my wagon does not go on (parked, or a following team left at the
   *  departure) - my riders' seats given up before I leave, so their word stands them down beside it rather than
   *  sending them after a wagon that stayed. True when there were any. */
  function release() {
    if (!book.passengers().length) return false;
    book.fit(0);
    return true;
  }
  /** One frame (after the cart's pool stepped): my riders kept to my seats, my ride kept to its seat. */
  function frame() {
    const now = deps.now();
    // the owner's end - the seats fitted to my wagon's only while it stands here to count them (WAGONS2 AUDIT: on the
    // road, or its model not yet up, it counted none and every rider lost their seat)
    if (deps.pool.mySeatsKnown?.() ?? true) book.fit(deps.pool.mySeatCount());
    if (go && now - goAt > GO_HOLD_MS) go = null;   // the journey said long enough
    book.lapse(now);   // an ask unanswered goes - the rider hears it lapse on their own clock
    for (const [r, until] of [...declinedUntil]) if (until <= now) declinedUntil.delete(r);
    deps.prompt?.render?.();
    // the rider's end
    if (ride?.seat == null) deps.drawAt?.(null);   // WAGONS2: no seat, the body drawn where it stands
    if (!ride) return;
    // the far end's wait runs from the arrival - of the journey THIS ride set out on (FINAL AUDIT: `go` is the owner's
    // last journey's number from the ask on, so any travel of mine re-armed it and held the motor fifteen seconds)
    if (ride.following) { if (deps.traveling?.()) { ride.wait = now + ARRIVE_WAIT_MS; ride.followed = true; } else if (ride.followed) ride.following = ride.followed = false; }
    if (ride.seat != null && !deps.traveling?.() && deps.jumpPressed?.()) { getDown(); return; }   // WAGONS2 (AUDIT): Jump gets me down whatever the owner's word - waiting at a journey's end too
    const r = deps.pool.peerRide(ride.owner);
    if (!r || r.model == null) {
      ride.pinned = null;   // FINAL AUDIT: unpinned this frame - the next pin starts the watch again
      deps.drawAt?.(null);   // WAGONS2 (AUDIT): no wagon heard to draw me in - where my body stands
      ride.lost ??= now;   // WAGONS2 (AUDIT): unheard from here
      if (ride.seat != null) { if (!deps.traveling?.() && !((ride.wait ?? 0) > now) && now - ride.lost >= RIDE_LOST_GRACE_MS) getDown(RIDE_TEXT.ownerGone); }   // on the road, or waiting at its end for the owner's word - or the word a moment missing
      else if (now - ride.at > RIDE_ASK_TTL_MS) { const o = ride.owner; ride = null; deps.changed?.(); deps.say(RIDE_TEXT.noAnswer(name(o))); }
      return;
    }
    ride.lost = null;
    const seats = WAGON_KINDS[r.model]?.seats ?? 0;
    const mine = r.passengers.find((e) => e[0] === me() && e[1] < seats);   // WAGONS2 (AUDIT): a seat the wagon has
    if (ride.seat == null) {
      if (r.declined.includes(me())) { const o = ride.owner; ride = null; deps.changed?.(); deps.say(RIDE_TEXT.declined(name(o))); return; }
      if (!mine) { if (now - ride.at > RIDE_ASK_TTL_MS) { const o = ride.owner; ride = null; deps.changed?.(); deps.say(RIDE_TEXT.noAnswer(name(o))); } return; }
      ride.seat = mine[1];
      deps.changed?.();
      deps.say(RIDE_TEXT.accepted(name(ride.owner)));
    } else if (!mine) { getDown(RIDE_TEXT.gotOff); return; }
    else ride.seat = mine[1];
    // the owner sets out: I go with them (once a journey), landing beside their wagon at the far end
    if (r.go && r.go[2] !== ride.go) {
      ride.go = r.go[2];
      const owner = ride.owner;
      // WAGONS2 (AUDIT): a journey I cannot go on (a foe near, the sun) stands me down here, told - the seat held for a
      // journey never taken held my motor till the far end's wait ran out
      if (!deps.canTravel?.()) { getDown(RIDE_TEXT.leftBehind(name(owner))); return; }
      ride.wait = now + ARRIVE_WAIT_MS;
      ride.following = true; ride.followed = false; ride.pinned = null;   // FINAL AUDIT: this journey's wait, armed while it runs - the journey moves the body, no teleport of its own
      deps.drawAt?.(null);   // the journey re-stands everything: no grown seat of this place drawn at the far end
      const n = ride.go;
      const went = deps.travel({ x: r.go[0], y: r.go[1] }, () => { const w = deps.pool.peerRide(owner)?.wire; return w ? { x: w[0], y: w[1], z: w[2] } : null; }, name(owner));   // beside their wagon, in natives (partyTravelLaw.js besideTargetOf's shape)
      // and one that did not go stands me down where I am, told
      Promise.resolve(went).then((ok) => { if (ok === false && ride?.owner === owner && ride.go === n) { ride.wait = 0; getDown(RIDE_TEXT.leftBehind(name(owner))); } }, () => {});
      return;
    }
    const at = deps.pool.peerSeat(ride.owner, ride.seat);
    // FINAL AUDIT: A BODY MOVED OFF THE SEAT IT WAS PINNED TO - a Recall, a quest's or a staff teleport within the owner's
    // reach - leaves the ride where it stands: the pin each frame undid it (the spell spent, the player back in the
    // wagon). Where it was pinned is kept in the world's own frame (`world` - a rebase of mine moves no body off it)
    const body = deps.world && deps.feet ? deps.feet() : null;
    const here = body ? deps.world(body) : null;
    if (here && ride.pinned && Math.hypot(here[0] - ride.pinned[0], here[2] - ride.pinned[2]) > GET_DOWN_REACH) { leave(); return; }
    if (at) deps.pin(at.feet, at.yaw);
    ride.pinned = at && deps.world ? deps.world(at.feet) : null;
    // WAGONS2: and DRAWN on the seat as the wagon is drawn - under the Overworld, grown with it (pinned on its own seat,
    // the body stood a speck short of the grown bed)
    const drawn = deps.pool.seatDrawn?.(ride.owner, ride.seat) ?? null;
    deps.drawAt?.(drawn && drawn.g > 1 ? drawn.feet : null);
  }

  return {
    press, acts, hear, forget, sweep, accept, decline, asks, announce, release, frame, getDown,
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
    /** WAGONS2: that companion's seat as my wagon is DRAWN (the pool's seatDrawn - grown with it under the Overworld,
     *  `grows` the host's), or null - where the draw stands them; their body stays on the seat itself. */
    companionSeatDrawn(i, riding, grows) {
      const n = deps.pool.mySeatCount();
      const k = companionSeats(n, book.passengers().map((e) => e[1]), i + 1, riding)[i];
      return k >= 0 ? deps.pool.seatDrawn?.('', k, grows) ?? null : null;
    },
    /** WAGONS2: the wagon and seat I sit in (`{ owner, seat }`), or null. */
    seatedIn: () => (ride?.seat != null ? { owner: ride.owner, seat: ride.seat } : null),
    /** WAGONS2 (FINAL AUDIT): whether `peer`'s OWN word says they sit in seat `seat` of `owner`'s wagon ('' mine) - the
     *  consent the pool's glue stands a seated player on (scenes/horseCartPool.js seatGlue): under the Overworld their
     *  drawn pose lags their seat by tens of metres (each pose eased over its own send interval at ten to a hundred
     *  times the pace), so a reach alone refused every seated rider while the wagon moved. */
    sitsIn(peer, owner, seat) { const w = seatWords.get(peer); return !!w && w.seated === (owner === '' ? me() : owner) && w.seat === seat; },
    leave,
    clear() { book.clear(); ride = null; go = null; declinedUntil.clear(); seatWords.clear(); deps.drawAt?.(null); },
  };
}
