// @ts-check
// THE PARTY TRAVEL LAW (PARTY-TRAVEL, 2026-09-25, Mac: "Implementing a prompt for online to travel to party leader and
// the option for party members to ready up and travel together") - the pure half of scenes/world.js's party journey,
// written as a law from the first line so its pins RUN it (AUDIT PARTY-REST's lesson: the rest mechanic's rules were
// closures over world.js pinned by regexes, and thirteen of fourteen mutants survived them).
//
// Two arms, both online-only (the party is the hub's; offline there is none):
//  - TO THE LEADER. A member away from the leader - on another map pixel - is offered the journey to where the leader
//    stands: a prompt when they join the party or the leader has travelled on, the same prompt when they open the travel
//    map, and `/leader` in the chat. It is the travel map's own FAST travel (ui/travelPopUp.js prices it - the fare, the
//    two-sided gold check, the guild's blessing, the Travel Options scale - and online it takes no world time, WORLD5),
//    to the leader's pixel; in the open air it lands BESIDE the leader (their feet ride the leader's party pose, `wx`,
//    `wy`, `wz`), inside a dungeon or a building at that place's own door (the map's DirectionFromStartMarker arrival).
//  - TOGETHER. The leader's fast travel with party members GATHERED (the rest law's own "near": the same place and,
//    outdoors, within PARTY_REST_RADIUS) is a PROPOSAL, not a departure - it rides the leader's own party pose (`tv`,
//    PARTY-REST's channel: the pose the hub already fans), each gathered member is asked Yes or No, and their answer
//    rides THEIR pose (`tr` ready, `td` stays behind) naming the round it answers. When nobody gathered is still
//    waiting the leader sets out (`tv.go`), and every member who said yes follows: once the leader's pose says they
//    have ARRIVED (the destination pixel, their feet in its open air) the member travels and lands beside them - so
//    the party arrives together.
//
// The laws, and which of PARTY-REST's they reuse (systems/partyRestLaw.js - ONE clock, one presence, one freshness):
//  - A ROUND IS ITS STAMP. The proposal's `at` is read through stampOf against the shared clock (a stamp from beyond
//    its slack is no stamp - one client cannot hold a party in a round for ever), and a round stands while it is fresh:
//    PARTY_READY_TIMEOUT_MS unanswered, TRIP_FOLLOW_MS once it has set out.
//  - A VOTE NAMES ITS ROUND. `tr`/`td` carry the `at` they answer, so a vote cast for one round can never approve the
//    next (PARTY-REST's stale-vote class - PARTY-REST9, AUDIT PARTY-REST's voteStands - closed by identity, not by age).
//  - A SEATED MEMBER IS PRESENT ONLY WHILE THE HUB SAYS SO (memberPresent): an offline seat's carried pose is nobody
//    gathered, and no leader who is not here is travelled to.
//  - A LANDING IS NEVER TAKEN FROM A POSE THAT CONTRADICTS ITSELF: the leader's feet are used only when they fall in
//    the pixel the pose names AND the journey paid for.
import { PARTY_READY_TIMEOUT_MS, stampOf, memberPresent } from './partyRestLaw.js';
import { worldCoordToMapPixel } from '../formats/mapsFile.js';

/** The three toggles a trip is priced by (ui/travelPopUp.js speedCautious / sleepModeInn / travelShip), as the
 *  proposal's small `o` on the wire - the leader's choice, which each member's own fare is priced with. */
export const TRIP_CAUTIOUS = 1;
export const TRIP_INN = 2;
export const TRIP_SHIP = 4;

/** The popup's three toggles as the wire's `o`. */
export function tripBits(opts) {
  return (opts?.speedCautious ? TRIP_CAUTIOUS : 0) | (opts?.sleepModeInn ? TRIP_INN : 0) | (opts?.travelShip ? TRIP_SHIP : 0);
}

/** The wire's `o` back to the popup's three toggles (anything but an integer reads as none set). */
export function tripOptionsOf(bits) {
  const b = Number.isInteger(bits) ? bits : 0;
  return { speedCautious: (b & TRIP_CAUTIOUS) !== 0, sleepModeInn: (b & TRIP_INN) !== 0, travelShip: (b & TRIP_SHIP) !== 0 };
}

/** How long a round that has SET OUT stands on the leader's pose: a follower reads `go` off it and then waits for the
 *  leader's arrival (the leader's own build, a pose or two), and one who has not seen the arrival by then travels to
 *  the place anyway. */
export const TRIP_FOLLOW_MS = 30_000;

/** The leader's proposal read against the shared clock `now`: `{x, y, o, at, go}` while it stands - unanswered for
 *  `timeout` (PARTY_READY_TIMEOUT_MS: a vote stands while it is fresh), set out for TRIP_FOLLOW_MS - else null. `go`
 *  is null while the round is open; a `go` before its own `at` is no departure. */
export function tripRoundOf(p, now, timeout = PARTY_READY_TIMEOUT_MS) {
  const tv = p?.tv;
  if (!tv || typeof tv !== 'object') return null;
  const at = stampOf(tv.at, now);
  if (at <= 0) return null;
  const go = tv.go == null ? 0 : stampOf(tv.go, now);
  if (go > 0 && go >= at) return now - go > TRIP_FOLLOW_MS ? null : { x: tv.x, y: tv.y, o: tv.o, at, go };
  return now - at > timeout ? null : { x: tv.x, y: tv.y, o: tv.o, at, go: null };
}

/** A gathered member's answer to round `at`: 'ready' when their pose's `tr` names it, 'declined' when `td` does, else
 *  'waiting' - a vote for any other round is no answer to this one. */
export function tripAnswerOf(p, at) {
  if (!p || !(at > 0)) return 'waiting';
  if (p.tr === at) return 'ready';
  if (p.td === at) return 'declined';
  return 'waiting';
}

/** Round `at`'s tally over the members GATHERED with the leader (the host hands the rest law's own near list), by
 *  name in seat order - an offline seat is nobody here. */
export function tripTally(gathered, at) {
  /** @type {{ ready: string[], declined: string[], waiting: string[] }} */
  const out = { ready: [], declined: [], waiting: [] };
  for (const m of gathered ?? []) {
    if (!memberPresent(m)) continue;
    out[tripAnswerOf(m.p, at)].push(m.name || 'A party member');
  }
  return out;
}

/** Whether the round sets out: nobody gathered is still waiting - each one is ready or has chosen to stay behind. The
 *  leader's own Begin was the leader's yes. */
export const tripSetsOut = (tally) => !!tally && tally.waiting.length === 0;

/** The count as the travelling group reads it: the leader and the ready over the leader and everyone still asked (a
 *  member who stays behind is out of both). */
export function tripCountText(tally) {
  return `${tally.ready.length + 1}/${tally.ready.length + tally.waiting.length + 1} ready`;
}

/** The words the leader's arm and the member's arm say - one home, so the chat, the prompt and the pins read alike. */
export const PARTY_TRAVEL_TEXT = Object.freeze({
  noParty: 'You are not in a party.',
  leading: 'You lead the party - the others travel to you.',
  offline: 'Your party leader is not online.',
  unseen: 'Your party leader has not been seen yet.',
  inside: 'Step outside to travel to your party leader.',
  here: 'You are already where your party leader is.',
  called: 'The leader called off the journey.',
  off: 'The journey is off.',
  late: 'The party was not ready in time. The journey is off.',
  moved: 'Travel vote canceled - moved too far from where it started.',
  stay: 'You stay behind.',
  lost: 'You were too far from the leader to travel with the party.',
  busy: 'Close the open window first.',
});

/** Where a member's journey to the leader goes, or why there is none: `{refuse}` in words, or `{x, y, inside, loc,
 *  name, acct}` - the leader's pixel, 'dungeon'/'building'/null for where in it they stand, the place's name as their
 *  pose says it, their name and their account. `leader` is the leader's seat row; `outdoors` whether I stand in the
 *  open air (fast travel is the map's, and the map opens outdoors only); `here` my own pixel. */
export function leaderTripOf({ party = null, me = null, leader = null, outdoors = false, here = null } = {}) {
  if (!party) return { refuse: PARTY_TRAVEL_TEXT.noParty };
  if (party.leader === me) return { refuse: PARTY_TRAVEL_TEXT.leading };
  if (!leader || leader.online === false) return { refuse: PARTY_TRAVEL_TEXT.offline };
  if (!memberPresent(leader)) return { refuse: PARTY_TRAVEL_TEXT.unseen };
  if (!outdoors) return { refuse: PARTY_TRAVEL_TEXT.inside };
  const p = leader.p;
  if (here && p.px === here.x && p.py === here.y) return { refuse: PARTY_TRAVEL_TEXT.here };
  return { x: p.px, y: p.py, inside: p.in === 1 ? 'dungeon' : p.in === 2 ? 'building' : null, loc: p.loc || '', name: leader.name || 'your leader', acct: leader.acct };
}

/** The leader's feet in natives (`{x, y, z}`: MapsFile's X and Z, the height with the floating origin's shift shed -
 *  the world pose's own frame) when their pose puts them in the OPEN AIR of pixel (x, y) and those feet fall inside
 *  that pixel. Null otherwise - the arrival is then the place's own. */
export function besideTargetOf(p, x, y) {
  if (!p || p.in !== 0 || p.px !== x || p.py !== y) return null;
  if (!Number.isFinite(p.wx) || !Number.isFinite(p.wy) || !Number.isFinite(p.wz)) return null;
  const at = worldCoordToMapPixel(p.wx, p.wz);
  if (at.x !== x || at.y !== y) return null;
  return { x: p.wx, y: p.wy, z: p.wz };
}

/** How far beside the leader a follower stands (scene metres), how much room beyond that spot the way to it must have
 *  (a body's reach), and how far its floor may sit from the leader's own before it is another level (a ledge, a roof,
 *  the ground under a leader who is swimming or flying). */
export const BESIDE_STEP = 1.5;
export const BESIDE_REACH = 0.5;
export const BESIDE_LEVEL = 1;
/** The spots tried, in order: either side, then ahead and behind (the pose carries no facing, so "either side" is the
 *  map's east and west), then the four between them - all BESIDE_STEP from the leader. AUDIT PARTY-TRAVEL: eight, not
 *  four, so a whole party (PARTY_MAX 8: the leader and seven) that follows one leader lands on seven different spots. */
const BESIDE_DIAG = BESIDE_STEP / Math.SQRT2;
export const BESIDE_OFFSETS = Object.freeze([[BESIDE_STEP, 0], [-BESIDE_STEP, 0], [0, BESIDE_STEP], [0, -BESIDE_STEP],
  [BESIDE_DIAG, BESIDE_DIAG], [-BESIDE_DIAG, -BESIDE_DIAG], [-BESIDE_DIAG, BESIDE_DIAG], [BESIDE_DIAG, -BESIDE_DIAG]].map((o) => Object.freeze(o)));

/** Where a follower lands beside the leader's feet `at` (the scene frame): the first offset whose way from the leader
 *  is clear at the chest and whose floor is the leader's own level, facing the leader; else the leader's own spot, on
 *  its floor; null when even that floor is not the leader's level - the arrival is then the place's own. `probe` is the
 *  host's collider: `clear(from, dir, dist)` whether nothing stands in the way, `floor(pos)` the floor under a spot.
 *  AUDIT PARTY-TRAVEL: `first` is where in the ring the search STARTS - the follower's own seat (partyTravel.js
 *  followerSeatOf) - so the members who follow one leader each try a spot of their own first; every client went to the
 *  east side, and a party that set out together arrived standing inside one another. */
export function besideLandingOf(at, probe, first = 0, offsets = BESIDE_OFFSETS) {
  const n = offsets.length;
  const start = Number.isInteger(first) && first > 0 ? first % n : 0;
  for (let i = 0; i < n; i++) {
    const [dx, dz] = offsets[(start + i) % n];
    const d = Math.hypot(dx, dz);
    if (!(d > 0) || !probe.clear(at, [dx / d, 0, dz / d], d + BESIDE_REACH)) continue;
    const f = probe.floor([at[0] + dx, at[1], at[2] + dz]);
    if (!f || !(Math.abs(f[1] - at[1]) <= BESIDE_LEVEL)) continue;
    return { pos: f, yaw: Math.atan2(-dx, -dz) };
  }
  const own = probe.floor([at[0], at[1], at[2]]);
  return own && Math.abs(own[1] - at[1]) <= BESIDE_LEVEL ? { pos: own, yaw: null } : null;
}

/** Whether the leader's pixel moved as a journey moves it - more than one pixel in one step; walking crosses them one
 *  at a time. `was` and `now` are `{px, py}`. */
export function leaderJourneyed(was, now) {
  if (!was || !now) return false;
  return Math.max(Math.abs(now.px - was.px), Math.abs(now.py - was.py)) > 1;
}

/** The fare row a prompt shows - the popup's own two numbers, the whole trip and what of it must be coin. */
export function fareText(computed, afford = true) {
  const total = Math.max(0, Math.round(computed?.totalCost ?? 0));
  if (!afford) return `You cannot afford the journey (${total} gold).`;
  return total > 0 ? `The journey costs ${total} gold.` : 'The journey costs nothing.';
}

/** The rows of the offer to travel to the leader (a Yes/No box, ui/yesNoBox.js, either skin). */
export function leaderOfferRows(trip, dest, fare, unwell = false) {
  const rows = [`Travel to ${trip.name}${dest ? ` at ${dest}` : ''}?`];
  if (trip.inside === 'dungeon') rows.push(`${trip.name} is inside ${trip.loc || 'a dungeon'} - you will arrive at its door.`);
  else if (trip.inside === 'building') rows.push(`${trip.name} is indoors - you will arrive outside.`);
  rows.push(fare);
  if (unwell) rows.push('You are diseased or poisoned.');
  return rows;
}

/** The rows of the leader's call to a gathered member. */
export function tripAskRows(leaderName, dest, fare, unwell = false) {
  const rows = [`${leaderName || 'The leader'} wants the party to travel to ${dest || 'a new place'}.`, fare];
  if (unwell) rows.push('You are diseased or poisoned.');
  rows.push('Travel with the party?');
  return rows;
}
