// @ts-check
// PARTY-TRAVEL (2026-09-25, Mac: "Implementing a prompt for online to travel to party leader and the option for party
// members to ready up and travel together"): THE PARTY'S JOURNEY, AS A SESSION - what the leader's round and a member's
// answer keep between frames, over the law (systems/partyTravelLaw.js, whose header carries the design) and the host's
// seams. scenes/world.js owns the seams - the picture (net/social.js), who is gathered (the rest law's own near), the
// fare (the travel map's own popup, headless), the refusals (the map door's rungs), the prompt (ui/yesNoBox.js, either
// skin), the journey (fastTravelTo, landing beside the leader) - and this owns the order they are asked in, so a pin
// RUNS a leader and a member against each other through the wire's own law, with fakes for everything that draws or
// moves (test/partytravel.test.js). AUDIT PARTY-REST's lesson, taken before the fact: the rest mechanic's session lived
// as closures in world.js and its pins were regexes that passed with the feature broken.
//
// ONE SESSION PER CLIENT, both roles in it: the leader's arm reads its own round (`trip`), the member's arm reads the
// leader's seat. A member who takes the lead mid-round drops the member's state as the leader's arm starts reading.
import { PARTY_READY_TIMEOUT_MS, memberPresent } from './partyRestLaw.js';
import {
  tripBits, tripOptionsOf, tripRoundOf, tripTally, tripSetsOut, tripCountText, leaderTripOf, besideTargetOf,
  leaderJourneyed, fareText, leaderOfferRows, tripAskRows, PARTY_TRAVEL_TEXT, TRIP_FOLLOW_MS,
} from './partyTravelLaw.js';

/** The session's cadence: a handful of reads four times a second - never a frame's work. */
export const PARTY_TRIP_TICK_MS = 250;
/** How long the leader waits for the pose that says "we set out" to leave before setting out anyway. */
export const PARTY_TRIP_GO_MS = 3000;
/** After a No at the travel map's own offer, the map opens without asking for this long. */
export const LEADER_MAP_QUIET_MS = 60_000;
/** AUDIT PARTY-TRAVEL: how long the leader's pixel must hold still before the unasked offer is made. A journey's jump is
 *  only known once it ENDS: a Travel Options walk at its default 60x on a horse crosses a pixel a second or faster, so
 *  its party poses (one a second at most, PARTY_SEND_MS) jump two pixels at a time - and every such jump was offered, a
 *  box or a chat line a second for as long as the leader rode. A fast travel's arrival holds still at once. */
export const LEADER_SETTLE_MS = 5000;

/** AUDIT PARTY-TRAVEL: where in the ring beside the leader I try first (partyTravelLaw besideLandingOf's `first`) - my
 *  place among the party's members who are not its leader, in seat order: the hub's order, the same on every client,
 *  so no two followers of one leader start from the same spot. */
export function followerSeatOf(party, me) {
  let seat = 0;
  for (const m of party?.members ?? []) {
    if (m.acct === party.leader) continue;
    if (m.acct === me) return seat;
    seat++;
  }
  return 0;
}

/**
 * The session over `host`'s seams:
 *   social()            the picture (net/social.js SocialState: party, acct, leads(), now() - the shared clock)
 *   gathered()          the OTHER members gathered with me (world.js nearPartyMembers - memberPresent and near)
 *   nearLeader(row)     whether I stand gathered with the leader's seat row (world.js nearAccount)
 *   here()              my travel pixel {x, y};  outdoors()  in the open air;  alive()  on my feet
 *   busy()              a window holds this host's slot - a prompt waits, a departure waits
 *   moving()            a journey, a load or a teleport is moving me (world.js worldMoveBusy), or a Travel Options walk
 *   refusal()           the map door's refusals in words, or null (world.js partyTravelRefusal)
 *   fare(to, opts)      {opts, computed, afford, unwell} - the map's own popup, priced headless
 *   canAfford(computed) the popup's two-sided gold gate over a fare already priced
 *   myToggles()         the popup's three toggles as my own map last left them
 *   feet()              where I stand, {x, z} in metres in a frame no origin shift moves;  radius  the gather radius
 *   placeName(to, fb)   a place's name for the lines
 *   prompt(rows, yes, no) -> handle   a Yes/No box shown;  closePrompt(handle)  taken down unanswered, no arm run
 *   say(text)           a line in the chat;  mid(text)  the HUD's centred label
 *   travel(pick, opts, computed) -> Promise<boolean>   the map's fast travel (a pick may carry besideAt / besideText /
 *                       besideSeat)
 *   openMap()           the travel map, after a No at its own offer
 *   clock()             a monotonic clock, ms (performance.now);  relayOk()  the hub carries the round's fields
 *   poseDirty()         compose my party pose again on the next frame
 */
export function createPartyTravel(host) {
  /** @type {any} */ let trip = null;   // leader: my round - {at, x, y, o, name, pick, opts, computed, origin, go, goSent, started, arrived, heard}
  /** @type {number|null} */ let vote = null;   // member: the round (`at`) I am ready for - `tr` on my pose
  /** @type {number|null} */ let decline = null;   // member: the round I stay behind from - `td` on my pose
  /** @type {number|null} */ let asked = null;   // member: the round I was asked about - once
  /** @type {number|null} */ let told = null;   // member: the round I was told of while busy - once
  /** @type {number|null} */ let near = null;   // member: the round I last read OPEN while gathered - the departure reads this, never the leader's pose mid-journey
  /** @type {{x: number, z: number}|null} */ let nearFrom = null;   // member: where I stood when I last read the leader gathered with me - `near` holds while I stay within the radius of it
  /** @type {any} */ let follow = null;   // member: {at, x, y, o, acct, name, since} - the journey I follow once the leader set out
  /** @type {{x: number, y: number}|null} */ let stay = null;   // member: where I chose to stay behind from - not offered again
  /** @type {{x: number, y: number}|null} */ let bound = null;   // member: where my last journey to the leader went - their arrival there is not offered to me
  /** @type {any} */ let prompt = null;   // the box standing for the journey
  /** @type {number|string|null} */ let promptFor = null;   // what it asks: a round's `at`, or 'leader'
  /** @type {{acct: string, px: number, py: number}|null} */ let leaderSeen = null;   // member: the leader's pixel last read
  let offerDue = false;   // member: a first sight or a journey of the leader's waits to be offered, once their pixel holds still
  let settledAt = -Infinity;   // member: when the leader's pixel last changed (host.clock)
  let mapQuietUntil = -Infinity;   // member: the map's own offer rests after a No
  let mapPending = false;   // member: a No at the map's offer opens the map once the box has left the slot
  let tickAt = -Infinity;

  const social = () => host.social();
  /** The leader's seat row, as I (a member) see it - null while I lead or sit in no party. No list is made. */
  const leaderRow = () => {
    const s = social(), party = s?.party;
    if (!party || party.leader === s.acct) return null;
    return party.members.find((m) => m.acct === party.leader) ?? null;
  };
  const roundOf = (lead) => (lead && memberPresent(lead) ? tripRoundOf(lead.p, social().now()) : null);
  const leaderTrip = () => leaderTripOf({ party: social()?.party ?? null, me: social()?.acct ?? null, leader: leaderRow(), outdoors: host.outdoors(), here: host.here() });

  /** The journey's box - `about` names what it asks, so a round that ends takes its own box and never another's. */
  function showPrompt(rows, about, onYes, onNo = null) {
    closePrompt();
    let handle = null;
    const answered = () => { if (prompt === handle) { prompt = null; promptFor = null; } };
    handle = host.prompt(rows, () => { answered(); onYes?.(); }, () => { answered(); onNo?.(); });
    prompt = handle; promptFor = about;
  }
  function closePrompt() {
    const h = prompt;
    prompt = null; promptFor = null;
    if (h) host.closePrompt(h);
  }

  /** A MEMBER'S JOURNEY TO THE LEADER: the map door's refusals and the gold gate first, in words; then the map's fast
   *  travel to their pixel, landing beside them when their pose - read after the build, since they may walk on while
   *  it loads - puts them in that pixel's open air. True when it set out. */
  function journey(to, opts, leadAcct, leadName, fallback = '') {
    const refusal = host.refusal();
    if (refusal) { host.say(refusal); return false; }
    const fare = host.fare(to, opts);
    if (!fare.afford) { host.say(fareText(fare.computed, false)); return false; }
    const name = host.placeName(to, fallback);
    const pick = {
      pixel: { x: to.x, y: to.y }, name,
      besideAt: () => { const row = social()?.party?.members.find((m) => m.acct === leadAcct); return row && memberPresent(row) ? besideTargetOf(row.p, to.x, to.y) : null; },
      besideText: `You join ${leadName || 'your leader'} at ${name}.`,
      besideSeat: followerSeatOf(social()?.party, social()?.acct),   // AUDIT PARTY-TRAVEL: a spot of my own beside them
    };
    bound = { x: to.x, y: to.y };
    host.travel(pick, fare.opts, fare.computed);
    return true;
  }

  /** THE OFFER TO TRAVEL TO THE LEADER: the box naming them, their place and my fare (my own map's toggles - my way
   *  of travelling). True when asked; otherwise the refusal in words. Yes reads the leader AGAIN - they may have walked
   *  on while the box stood - and goes to where they are then. `fromMap`: a No opens the map, which rests from asking. */
  function offerLeader({ fromMap = false } = {}) {
    const trip0 = leaderTrip();
    if ('refuse' in trip0) return trip0.refuse;
    if (host.busy()) return PARTY_TRAVEL_TEXT.busy;   // the box takes the host's one slot - never from under another window
    const refusal = host.refusal();
    if (refusal) return refusal;
    const fare = host.fare(trip0, host.myToggles());
    if (!fare.afford) return fareText(fare.computed, false);
    showPrompt(leaderOfferRows(trip0, host.placeName(trip0, trip0.loc), fareText(fare.computed), fare.unwell), 'leader', () => {
      const now = leaderTrip();
      if ('refuse' in now) { host.say(now.refuse); return; }
      journey(now, host.myToggles(), now.acct, now.name, now.loc);
    }, fromMap ? () => { mapQuietUntil = host.clock() + LEADER_MAP_QUIET_MS; mapPending = true; } : null);
    return true;
  }

  /** THE LEADER'S BEGIN WITH THE PARTY GATHERED - a PROPOSAL, not a departure. True when a round opened (the map's
   *  journey waits on it); false and the journey is the map's own, alone, as always: no party, not its leader, a hub
   *  from before PARTY_TRAVEL_RELAY_MIN (the round's fields would reach nobody), a WALKED trip (Travel Options' - the
   *  party rides it together on its own feet, and no teleport can arrive beside anyone), a trip to where I stand,
   *  nobody gathered. The leader's Begin is the leader's yes; the fare is taken when the party sets out. */
  function propose(pick, opts, computed) {
    const s = social();
    if (!s?.party || !s.leads() || !host.relayOk() || !pick?.pixel || opts?.playerControlled) return false;
    const here = host.here();
    if (pick.pixel.x === here.x && pick.pixel.y === here.y) return false;
    const gathered = host.gathered();
    if (!gathered.length) return false;
    trip = {
      at: Math.round(s.now()), x: pick.pixel.x, y: pick.pixel.y, o: tripBits(opts), name: pick.name || host.placeName(pick.pixel),
      pick, opts, computed, origin: host.feet(), go: null, goSent: false, started: false, arrived: false, heard: new Set(),
    };
    const count = tripCountText(tripTally(gathered, trip.at));
    host.say(`You ask the party to travel to ${trip.name}. (${count})`);
    host.mid(`Waiting for the party to ready up (${count}).`);
    host.poseDirty();
    return true;
  }
  /** A refusal and the journey called off, said once - the door's `off` (a journey or a load moving me) is both. */
  const offWith = (why) => (why === PARTY_TRAVEL_TEXT.off ? why : `${why} ${PARTY_TRAVEL_TEXT.off}`);
  function cancel(text) {
    if (!trip) return;
    trip = null;
    if (text) host.say(text);
  }

  /** THE LEADER'S SIDE: off when I go inside or fall, walk out of where I asked (PARTY-REST16's radius), or it lapses
   *  unanswered; each answer said once, by name (the leader sees who is ready); when nobody gathered is still waiting
   *  the party sets out (`go` on my pose) and, once that pose has left - or PARTY_TRIP_GO_MS - my own journey is the
   *  popup's, as I chose it. The round stays on my pose TRIP_FOLLOW_MS after, for the followers, and until I have
   *  arrived; one that never left (or that the door refused as it began) takes its round with it, so nobody follows me
   *  where I did not go. */
  function leaderTick() {
    const t = trip;
    if (!t) return;
    const s = social();
    if (!s.leads()) { trip = null; return; }   // the lead passed: the round was the old leader's
    const now = s.now();
    if (t.go == null) {
      if (!host.outdoors() || !host.alive()) { cancel(PARTY_TRAVEL_TEXT.off); return; }
      const f = host.feet();
      if (Math.hypot(f.x - t.origin.x, f.z - t.origin.z) > host.radius) { cancel(PARTY_TRAVEL_TEXT.moved); return; }
      if (now - t.at > PARTY_READY_TIMEOUT_MS) { cancel(PARTY_TRAVEL_TEXT.late); return; }
      const tally = tripTally(host.gathered(), t.at);
      for (const n of tally.ready) if (!t.heard.has(`r:${n}`)) { t.heard.add(`r:${n}`); host.say(`${n} is ready to travel. (${tripCountText(tally)})`); }
      for (const n of tally.declined) if (!t.heard.has(`d:${n}`)) { t.heard.add(`d:${n}`); host.say(`${n} stays behind.`); }
      if (!tripSetsOut(tally) || host.busy()) return;   // a window of mine up: the party sets out when it closes
      const refusal = host.refusal() ?? (host.canAfford(t.computed) ? null : fareText(t.computed, false));
      if (refusal) { cancel(offWith(refusal)); return; }
      t.go = Math.max(t.at, Math.round(now));
      host.poseDirty();
      host.say(tally.ready.length ? `The party sets out for ${t.name}.` : `Nobody else is coming - you set out for ${t.name} alone.`);
      return;
    }
    if (!t.started) {
      if (!t.goSent && now - t.go < PARTY_TRIP_GO_MS) return;
      // AUDIT PARTY-TRAVEL: the door's refusals asked AGAIN as the journey begins - between `go` and here (a pose's
      // leaving, up to PARTY_TRIP_GO_MS) the leader may have stepped through a door, and fastTravelTo asks none of them:
      // a leader inside a building was flown off the map from its floor. A refused start takes the round with it, so
      // no follower goes where the leader did not (followTick's "did not set out").
      const why = !host.outdoors() || !host.alive() ? PARTY_TRAVEL_TEXT.off : host.refusal();
      if (why) { trip = null; host.poseDirty(); host.say(offWith(why)); return; }
      t.started = true;
      Promise.resolve(host.travel(t.pick, t.opts, t.computed)).then((went) => {
        if (went) { t.arrived = true; return; }
        if (trip === t) trip = null;
        host.say(PARTY_TRAVEL_TEXT.off);
      });
      return;
    }
    // AUDIT PARTY-TRAVEL: and not before my own journey has ARRIVED - a follower who sees me mid-journey without the
    // round reads a leader who did not set out (followTick), so a build slower than TRIP_FOLLOW_MS (a big city, a slow
    // machine) sent the whole party home with "did not set out" while I was still on the road.
    if (t.arrived && now - t.go > TRIP_FOLLOW_MS) trip = null;
  }

  /** MY ANSWER TO THE LEADER'S ROUND `at`: Yes is ready - the map door's refusals and the gold gate asked first, and one
   *  that refuses is staying behind, with its reason, so the leader is never held by a member who cannot come; No
   *  stays behind. */
  function answer(at, yes) {
    const round = roundOf(leaderRow());
    if (!round || round.at !== at || round.go != null) { host.say(PARTY_TRAVEL_TEXT.off); return; }
    const dest = host.placeName(round);
    let why = null;
    if (yes) {
      why = host.refusal();
      if (!why) { const fare = host.fare(round, tripOptionsOf(round.o)); if (!fare.afford) why = fareText(fare.computed, false); }
    }
    if (yes && !why) {
      vote = at; decline = null; stay = null;
      host.say(`You are ready to travel to ${dest}.`);
    } else {
      decline = at; vote = null; stay = { x: round.x, y: round.y };
      host.say(why ? `${why} ${PARTY_TRAVEL_TEXT.stay}` : PARTY_TRAVEL_TEXT.stay);
    }
    host.poseDirty();
  }

  /** THE MEMBER'S SIDE: the leader's round off their pose (fresh, from a seat that is here); asked once per round while
   *  I stand gathered with them (or told, while a window of mine is up); a vote or a box for a round that ended goes
   *  with it; and when the round sets out, a member who said yes and stood gathered at its last open reading FOLLOWS. */
  function memberTick(lead) {
    if (follow) { followTick(lead); return; }
    const round = roundOf(lead);
    if (promptFor != null && promptFor !== 'leader' && promptFor !== round?.at) { closePrompt(); host.say(PARTY_TRAVEL_TEXT.called); }
    if (!round) {
      if (vote != null) host.say(PARTY_TRAVEL_TEXT.called);
      vote = null; decline = null; near = null;
      return;
    }
    if (vote != null && vote !== round.at) vote = null;   // a vote names its round
    if (decline != null && decline !== round.at) decline = null;
    const dest = host.placeName(round);
    if (round.go == null) {
      // AUDIT PARTY-TRAVEL: GATHERED IS LOST BY WALKING AWAY, not by the leader's body going. The leader's journey begins a
      // moment after the pose saying "we set out" leaves on the HUB link, and their body leaves my scene on the WORLD link
      // - two sockets, no order between them - so the last open reading could find no body beside me and turn a member
      // who said yes and never moved into one "too far from the leader". While the round is open the leader stands within
      // the radius of where they asked (the leader's own rung), so a member who stays within the radius of where they were
      // last read gathered is gathered still.
      const f = host.feet();
      if (host.nearLeader(lead)) { near = round.at; nearFrom = f; }
      else if (near !== round.at || !nearFrom || Math.hypot(f.x - nearFrom.x, f.z - nearFrom.z) > host.radius) near = null;
      if (near === null || asked === round.at || vote === round.at || decline === round.at || !host.alive()) return;
      if (host.busy()) {
        if (told !== round.at) { told = round.at; host.say(`${lead.name || 'The leader'} wants the party to travel to ${dest}. Type /travel to come along.`); }
        return;
      }
      asked = round.at;
      const fare = host.fare(round, tripOptionsOf(round.o));
      const at = round.at;
      showPrompt(tripAskRows(lead.name, dest, fareText(fare.computed, fare.afford), fare.unwell), at, () => answer(at, true), () => answer(at, false));
      return;
    }
    // the round has set out: a box still asking for it asks nothing now
    if (promptFor === round.at) { closePrompt(); host.say(`The party set out for ${dest} without you.`); }
    if (vote !== round.at) return;   // not coming: nothing to follow
    vote = null;
    host.poseDirty();
    if (near !== round.at) { host.say(PARTY_TRAVEL_TEXT.lost); return; }
    follow = { at: round.at, x: round.x, y: round.y, o: round.o, acct: lead.acct, name: lead.name, since: host.clock() };
    host.say(`The party sets out for ${dest} - you follow ${lead.name || 'the leader'}.`);
  }

  /** A FOLLOWER WAITS FOR THE LEADER TO ARRIVE, then goes: beside them once their pose stands in the destination's
   *  open air, to its door once it says they went inside there, and to the place anyway after TRIP_FOLLOW_MS (their
   *  seat gone quiet mid-journey). Never from under a window of mine - and a member who keeps one open twice that long
   *  is left behind, told how to follow. A leader who is here, not there, and no longer carries the round did not set
   *  out: nobody follows. */
  function followTick(lead) {
    const f = follow;
    const p = lead && lead.acct === f.acct && memberPresent(lead) ? lead.p : null;
    const there = !!p && p.px === f.x && p.py === f.y;
    if (p && !there && p.tv?.at !== f.at) { follow = null; host.say(`${f.name || 'The leader'} did not set out. ${PARTY_TRAVEL_TEXT.off}`); return; }
    const waited = host.clock() - f.since;
    if (host.busy()) {
      if (waited >= 2 * TRIP_FOLLOW_MS) { follow = null; offerDue = false; host.say(`The party went on without you. Type /leader to travel to ${f.name || 'your leader'}.`); }   // AUDIT PARTY-TRAVEL: the line names /leader - their journey is not offered twice
      return;
    }
    const arrived = !!besideTargetOf(p, f.x, f.y) || (there && p.in !== 0);
    if (!arrived && waited < TRIP_FOLLOW_MS) return;
    follow = null;
    journey({ x: f.x, y: f.y }, tripOptionsOf(f.o), f.acct, f.name);
  }

  /** THE UNASKED OFFER: when I first see my leader (I joined, or the lead passed) and whenever their pixel jumps as a
   *  journey moves it, a member elsewhere is offered the journey to them - once per place by construction, since only
   *  a first sight or a jump makes an offer due and each is spent once - the box when I am free to take it, a line
   *  naming `/leader` when I am not. AUDIT PARTY-TRAVEL: made once the leader's pixel has held still LEADER_SETTLE_MS
   *  (a ride that jumps pixel after pixel is one journey, offered where it ends), and kept due while I follow them or
   *  a journey of my own is moving me (a jump seen while I loaded was lost). Not to where I stand, nor where I am
   *  already bound, nor the place I chose to stay behind from. */
  function watch(lead) {
    if (!lead || !memberPresent(lead)) return;
    const p = lead.p;
    const now = host.clock();
    if (!leaderSeen || leaderSeen.acct !== lead.acct) {
      leaderSeen = { acct: lead.acct, px: p.px, py: p.py };
      offerDue = true; settledAt = now;
    } else if (p.px !== leaderSeen.px || p.py !== leaderSeen.py) {
      if (leaderJourneyed(leaderSeen, p)) offerDue = true;
      leaderSeen.px = p.px; leaderSeen.py = p.py; settledAt = now;   // any step restarts the stillness
    }
    if (!offerDue || now - settledAt < LEADER_SETTLE_MS || follow || host.moving()) return;
    offerDue = false;
    const here = host.here();
    if (bound && here.x === bound.x && here.y === bound.y) bound = null;   // arrived where I was bound
    if (p.px === here.x && p.py === here.y) return;
    if (stay && stay.x === p.px && stay.y === p.py) return;
    if (bound && bound.x === p.px && bound.y === p.py) return;   // I am on my way there already
    if (host.busy() || offerLeader() !== true) host.say(`${lead.name || 'Your leader'} is at ${host.placeName({ x: p.px, y: p.py }, p.loc)}. Type /leader to travel to them.`);
  }

  /** Out of the party: every round, answer, box and journey of it goes, and a new party is offered afresh. */
  function reset() {
    if (prompt) closePrompt();
    if (follow) host.say(PARTY_TRAVEL_TEXT.off);
    trip = null; vote = null; decline = null; near = null; nearFrom = null; follow = null; stay = null; bound = null; leaderSeen = null;
    offerDue = false;
  }

  return {
    /** Every frame, throttled to PARTY_TRIP_TICK_MS - the leader's round, the member's answer and journey, the leader
     *  watched; the map a No at its offer asked for opens once the box has left the slot. */
    tick() {
      if (mapPending && !host.busy()) { mapPending = false; host.openMap(); }
      const s = social();
      if (!s) return;
      const now = host.clock();
      if (now - tickAt < PARTY_TRIP_TICK_MS) return;
      tickAt = now;
      if (!s.party) { reset(); return; }
      leaderTick();
      const lead = leaderRow();
      memberTick(lead);
      watch(lead);
    },
    propose,
    /** The map's own offer (the standing option): a member away from the leader who opens the travel map is asked
     *  first - No opens the map, and it asks no more for LEADER_MAP_QUIET_MS. True when the offer took the press. */
    mapOffer() {
      const s = social();
      if (!s?.party || s.leads() || host.clock() < mapQuietUntil) return false;
      return offerLeader({ fromMap: true }) === true;
    },
    /** The chat's two: `/leader` offers the journey to the leader; `/travel` answers the leader's round (ready; ready
     *  already, staying behind) or, from the leader, calls it off. The line to say, or null when the act says its own. */
    command(name) {
      const s = social();
      if (!s?.party) return PARTY_TRAVEL_TEXT.noParty;
      if (name === 'leader') { const r = offerLeader(); return r === true ? null : r; }
      if (s.leads()) {
        if (trip && trip.go == null) { trip = null; host.poseDirty(); return 'You call off the journey.'; }
        return 'Choose a destination on the travel map - the party gathered with you is asked to come along.';
      }
      const lead = leaderRow();
      const round = roundOf(lead);
      if (!round || round.go != null) return 'There is no journey to ready up for. /leader travels to your leader.';
      if (!host.nearLeader(lead)) return `Gather with ${lead.name || 'the leader'} to travel with the party.`;
      if (promptFor === round.at) closePrompt();
      asked = round.at;
      answer(round.at, vote !== round.at);
      return null;
    },
    /** My party pose's share (net/wire.js validPartyPose): the round I lead, my answer to the leader's - each omitted
     *  when there is none. */
    poseFields() {
      return {
        ...(trip && social()?.leads?.() ? { tv: { x: trip.x, y: trip.y, o: trip.o, at: trip.at, go: trip.go } } : {}),
        ...(vote != null ? { tr: vote } : {}),
        ...(decline != null ? { td: decline } : {}),
      };
    },
    /** A pose left for the hub: once one saying "we set out" has, the leader's own journey may begin. */
    sent(pose) { if (trip && pose?.tv?.go != null) trip.goSent = true; },
    reset,
    /** What the session holds, for its pins. */
    get state() { return { trip, vote, decline, follow, near, asked, promptFor, mapPending, stay }; },
  };
}
