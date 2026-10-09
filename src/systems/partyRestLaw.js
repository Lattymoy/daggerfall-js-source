// @ts-check
// THE PARTY REST LAW (AUDIT PARTY-REST, 2026-09-23) - the pure half of scenes/world.js's party-rest mechanic,
// lifted out so a pin can RUN it. Every rule here was a closure over world.js's own state, pinned by regexes
// over the source that passed with the feature broken (the audit's third lens ran fourteen mutants through
// every rest suite and thirteen survived). world.js still owns the state and the seams; this file owns the
// arithmetic, and test/auditpartyrest.test.js drives it on a table.
//
// The four laws:
//  - A WIRE STAMP IS READ AGAINST THE SHARED CLOCK. `voteAt`, `restStartedAt` and `readyAt` ride the party pose
//    on net/social.js's `now()` (the relay's clock, offset-corrected at both ends) and are compared as DURATIONS
//    against it. The wire bounds them below at zero and nowhere above, so one client saying `voteAt: 1e300` held
//    every party mate at "Resting vote ongoing." for ever (lens 3, run on the real gate). A stamp from beyond
//    the clock's own slack is no stamp.
//  - A SEATED MEMBER IS PRESENT ONLY WHILE THE HUB SAYS SO. The hub keeps a disconnected member's seat for
//    PARTY_OFFLINE_MS with `online: false` and no pose, and net/social.js carries the LAST pose over a view that
//    has none (a pose frame between two views is newer than the view). The gate counted that ghost among the
//    online, so "gather the party" could never be satisfied for five minutes; indoors, where `nearAccount` is
//    the building key alone, the ghost's stale `rest` was mirrored again after every OK.
//  - A VOTE STANDS WHILE IT IS FRESH. `ready` alone was a bare boolean whose sixty-second expiry ran only on the
//    voter's own frame: a voter whose window was open when the rest started (so no mirror spent the vote), or
//    whose tab was in the background, approved the leader's NEXT rest with a vote cast for the last one. The
//    pose carries `readyAt` now (world95), and a reader counts a vote only while it is younger than the timeout
//    AND cast after the last rest that started here.
//  - A FOLLOWER'S CANCEL IS ITS SENDER'S OWN MARKER. `restCancelAt` was stamped with each follower's own
//    `performance.now()` and compared, on the resting player's side, against ONE high-water mark shared by every
//    sender - so a Stop from a tab younger than the last canceller's was ignored, and a reload of the resting
//    player's tab (the mark back at zero) let a follower's old request end their next rest on its first tick.
//    Compared per sender against the value seen when THIS rest began, the same law `restEnemyAt` already keeps.
import { optionPath } from '../ui/settingsMap.js';   // ORG2: the rest message names the switch where the map puts it

/** PARTY-REST2b, per-request (2026-09-22, "make this 60 seconds"): how long a vote stands - long enough to coordinate
 *  a round, short enough that a stale yes from an earlier attempt cannot approve a later one. Lived in world.js;
 *  here so the wire's reader and the voter's own expiry read ONE number. */
export const PARTY_READY_TIMEOUT_MS = 60_000;

/** How far ahead of the shared clock a stamp may read before it is refused as a stamp - the relay clock's own
 *  offset is read once per link and a machine's clock drifts, so a few seconds of lead is honest and a year is
 *  not. */
export const STAMP_SLACK_MS = 5_000;

/** A pose's timestamp read against the shared clock `now`: the stamp itself while it is finite and no further
 *  ahead of `now` than `slack`, else 0 (which every duration read - `now - stamp` - treats as "long ago"). */
export function stampOf(v, now, slack = STAMP_SLACK_MS) {
  return Number.isFinite(v) && v <= now + slack ? v : 0;
}

/** A seated member who is HERE: the hub has not marked the seat offline, and a pose has arrived for it. The hub's
 *  party view says `online: false` for a seat whose sockets are gone (server/src/index.js `_row`), and a seat
 *  with no pose yet has never said where it stands. */
export function memberPresent(m) {
  return !!m && !!m.p && m.online !== false;
}

/** The most recent `key` stamp over `members`' poses and `mine` (a local -Infinity/NaN reads as none), each
 *  read through stampOf against `now` - the one reduce the gate, the tally and the cooldowns all take. */
export function latestStamp(members, key, mine, now) {
  let latest = Number.isFinite(mine) ? mine : 0;
  for (const m of members) latest = Math.max(latest, stampOf(m?.p?.[key], now));
  return latest;
}

/** Whether a member's vote counts: `ready` said, cast (`readyAt`) within `timeout` of `now`, and cast AFTER
 *  `lastStartedAt` - the last rest that started among the members standing here, which is the rest the vote
 *  approved. A pose from a client that sends no `readyAt` (a world94 client) carries no vote. */
export function voteStands(p, now, lastStartedAt, timeout = PARTY_READY_TIMEOUT_MS) {
  if (!p || p.ready !== true) return false;
  const at = stampOf(p.readyAt, now);
  if (at <= 0) return false;
  if (now - at > timeout) return false;
  return at > (Number.isFinite(lastStartedAt) ? lastStartedAt : 0);
}

/** The cancel markers as they stand when a rest begins: each present member's `restCancelAt`, by account, so a
 *  request already in flight before this rest is never read as one aimed at it. */
export function snapshotCancels(members) {
  const seen = new Map();
  for (const m of members) if (m?.acct) seen.set(m.acct, m.p?.restCancelAt ?? null);
  return seen;
}

/** The member whose pose asks ME (`me`) to stop, with a marker that is NOT the one `seen` holds for that sender
 *  (a sender's own clock, compared with itself alone - never across senders, never against mine). `seen` is
 *  advanced to the marker so one request fires once. Null when nobody asks. */
export function cancelRequestFor(members, me, seen) {
  for (const m of members) {
    const p = m?.p;
    if (!p || p.restCancelFor !== me) continue;
    const at = p.restCancelAt ?? null;
    if (at === null || at === (seen.get(m.acct) ?? null)) continue;
    seen.set(m.acct, at);
    return m;
  }
  return null;
}

/** The identity of the rest a member's pose is broadcasting: their account and the shared-clock moment their
 *  rest started, so a mirror that ended early (the follower healed first, a prevent-rest message, a Stop the
 *  rester did not honour yet) is not opened again for the SAME nap on the next frame. Null for a pose that
 *  carries no `restStartedAt` (an older client), which is mirrored as before. */
export function mirrorKey(row) {
  const at = row?.p?.restStartedAt;
  return Number.isFinite(at) && at > 0 ? `${row.acct}:${at}` : null;
}
/** PARTY-REST29 (2026-09-23, the party-rest fixes of the friendly-spells drop, on this law): THE STAMP THE START
 *  COOLDOWN READS - the latest `restStartedAt` among the members standing here and `mine`, with two stamps that no
 *  longer mean "a rest just happened":
 *  - a MEMBER's stamp their own newer `voteAt` supersedes: a leader whose rest window closed with no rest chosen and
 *    who pressed Rest again has opened a new round, and the old grant must not hold everyone's tally quiet;
 *  - MINE, when the caller passes it as none (-Infinity): my own window closed unrested (world.js
 *    cancelPartyRestStart), so my grant cools nothing down.
 *  The COOLDOWN alone reads this. Whether a vote STANDS still reads latestStamp - every grant, waived or not - so a
 *  vote cast for the round the unrested grant spent never approves the next one. */
export function cooldownStamp(members, mine, now) {
  let latest = Number.isFinite(mine) ? mine : 0;
  for (const m of members) {
    const t = stampOf(m?.p?.restStartedAt, now);
    if (stampOf(m?.p?.voteAt, now) > t) continue;
    latest = Math.max(latest, t);
  }
  return latest;
}

/** REST-OPT (2026-09-27, Discord - Tabitha: "Allow party members to choose not to rest with their party"): a member
 *  who rests ALONE - their pose says `nr` (their own "Rest with my party" switch is off). They are no voter, nobody
 *  the leader must gather, and no rest to mirror: the party's night goes on without them, and theirs is their own. */
export function restsAlone(m) {
  return !!m?.p?.nr;
}

/** REST-OPT (AUDIT C2): whether a party mate's night beside mine is ANOTHER CAMP - they rest (`rs`), and alone (`nr`),
 *  or my own rest is alone (`mineTogether` false). STRANGER-REST's gate keeps such a camp apart as it keeps a
 *  stranger's: two nights side by side each rolled the night's foes, and each for the whole party (world.js partySize
 *  counts every mate near), where one party night rolls once (PARTY-REST1: a follower never rolls). */
export function restsApart(m, mineTogether) {
  return !!m?.p?.rs && (restsAlone(m) || !mineTogether);
}
/** REST-OPT (AUDIT C2): what the rest gate says of such a camp. */
export const REST_APART_TEXT = 'A party member is resting apart from you nearby - rest farther away.';

/** REST-OPT: whether MY rest is the party's - my own switch on (`mineOn`), and the leader's too: a leader who rests
 *  alone leaves the whole party to rest for themselves, since nobody else may open the party's vote (PARTY-REST26).
 *  `party` is the hub's picture ({leader, members}); `iLead` whether its leader is me. */
export function partyRestsTogether(mineOn, party, iLead) {
  if (!mineOn) return false;
  if (!party || iLead) return true;
  const lead = (party.members ?? []).find((m) => m.acct === party.leader);
  return !restsAlone(lead);
}

/** REST-OPT: what a vote (`/ready`) is told while my rest is my own - my switch, or the leader's. */
export function restAloneText(mineOn) {
  return mineOn ? 'Your leader rests on their own, so everyone rests for themselves.'
    : `You rest on your own. Turn on "Rest with my party" (${optionPath('card:peerSprites')}) to rest with them.`;   // ORG2: where the map puts it
}

// AUDIT REST-PARTY (2026-10-03, the party rest under REST5): THE PARTY'S NIGHT, the pure half of world.js's
// carryPartyNight - lifted here as AUDIT PARTY-REST lifted the vote, because REST5 shipped it as a closure pinned only
// by regexes over world.js, and three of its laws were wrong in ways no regex could fail:
//  - IT CARRIED INTO A TAVERN, A TEMPLE AND A GUILD HALL. TAVERN-REST1/GUILD-REST1 (per-request: "every member can rest
//    there as they want") took the party's rest out of all three; the night never asked, and indoors "near" is the
//    building alone, so a member asleep in their rented room slept every party mate anywhere in the house - one with a
//    room spent a night of it, one without slept free.
//  - IT SLEPT A MEMBER BY THE FIRE ROUGH. A carried night read the member's OWN spot, and a fire's reach is 4 m where
//    the party's is 15: a mate at 5 m woke "You slept poorly on the bare ground." in Casual (the default tier, the
//    sleep paid at the rough rate) and in Hard at half the night's healing and stiff, beside a rester who woke full.
//    PARTY-REST4 (per-request: "party member MUST heal their health near the leader") had closed exactly this for the
//    mirror; the night now carries the rester's spot (its stamp says it - restAct.js nightStamp) and a member sleeps
//    the better of it and their own.
//  - IT TOLD THE DEAD THEY SLEPT, and a member out of reach heard nothing (PARTY-REST-FAR1's word, retired with the
//    mirror online, is said again for a mate resting in the same place beyond the party's 15 m).
/** How long a moved night stamp is a night to answer: one older than this when first seen moving is long over. */
export const PARTY_NIGHT_FRESH_MS = 30_000;
/** AUDIT REST II P1: the least time between two moves of ONE member's night stamp that are answered - it holds back a
 *  pose that says a new night every second. AUDIT REST III C1: but never a night MY clock owes me. P1 read an honest
 *  pair of nights as ten real minutes apart at the least, and it is not: a journey, a guild's training, a quest's
 *  RaiseTime or an arrest moves the character's clock, and the next night is due at once (restAct.js nightDue) - a mate
 *  who rested 45 s after the first night, the party just off the road, slept nobody (the mark rose, the move went
 *  unanswered for good). The night interval bounds my nights whatever a pose says, so a night due is answered inside
 *  the gap; a short rest and the far, busy and town words still wait it out. */
export const PARTY_NIGHT_GAP_MS = 60_000;

/** Whether a party mate's night stamp `at` (read through stampOf) is a NEW night to answer: over `high`, the HIGHEST
 *  of their stamps seen so far (AUDIT REST II P1: a stamp that is merely DIFFERENT from the last one, an older one
 *  replayed, is no night; and no stamp stands over an unset mark - `high` undefined, the first sight, is a baseline),
 *  no older than `freshMs`, and `isNight` (a night's mark - an older build's rest-window open is no night: AUDIT REST
 *  F7). `isNight` may be a predicate of the stamp, asked only once the cheap tests pass (AUDIT REST II P5: every
 *  member, every frame). */
export function nightMoved(high, at, now, isNight, freshMs = PARTY_NIGHT_FRESH_MS) {
  return !!at && at > high && now - at <= freshMs && !!(typeof isNight === 'function' ? isNight(at) : isNight);
}

/** AUDIT REST II P1/P2: THE NIGHT WATCH - per member, the HIGH-WATER MARK of their night stamps and the shared-clock
 *  moment a move of it was last answered. Before it, world.js kept the LAST stamp seen and answered any marked stamp
 *  that differed from it inside the freshness window, so nothing limited how often one mate's pose put the party to
 *  sleep: a forged pose (the hub admits two a second, the relay bounds the field only from below) slept every mate in
 *  reach once a second - a night whenever the interval lapsed, a short rest otherwise, a forged bed's mark healing a
 *  Hard character whole on bare ground - and two replayed stamps taking turns did the same; and one honest night was
 *  slept twice when the rester's connection blipped (the hub lists the seat with no pose, the watcher read 0, the
 *  reopened socket sent the same stamp again), as it was by a mate who left, rested alone and rejoined within the
 *  window. Now a stamp is a night only over the mark, a missing pose neither sets nor lowers it, a member's moves are
 *  answered at most once a PARTY_NIGHT_GAP_MS (every answer - a night, a short rest, the far word, the busy word -
 *  one per move answered), and a member who leaves the party is forgotten (`keep`), so their return is a first sight. */
export function createNightWatch({ freshMs = PARTY_NIGHT_FRESH_MS, gapMs = PARTY_NIGHT_GAP_MS } = {}) {
  /** @type {Map<string, { high: number, answered: number }>} */
  const marks = new Map();
  return {
    /** Whether `acct`'s stamp `at` (stampOf, against the shared clock `now`) is a move to answer now. `posed` - a pose
     *  stands for them this frame (the hub's offline seat has none, and says nothing of their nights). `isNight` as
     *  nightMoved's. `due` (AUDIT REST III C1) - whether MY night is due, asked only of a move the gap holds back. */
    moved(acct, posed, at, now, isNight, due = /** @type {boolean | (() => boolean)} */ (false)) {
      if (!posed) return false;
      const rec = marks.get(acct);
      if (!rec) { marks.set(acct, { high: at, answered: -Infinity }); return false; }
      const move = nightMoved(rec.high, at, now, isNight, freshMs) && (now - rec.answered >= gapMs || !!(typeof due === 'function' ? due() : due));
      if (at > rec.high) rec.high = at;
      if (move) rec.answered = now;
      return move;
    },
    /** Forget every member not among `members` (party rows): one who left is a first sight when they come back. */
    keep(members) {
      for (const acct of marks.keys()) {
        let here = false;
        for (const m of members) if (m?.acct === acct) { here = true; break; }
        if (!here) marks.delete(acct);
      }
    },
    clear() { marks.clear(); },
    /** The mark held for `acct` (undefined before the first sight) - for the tests. */
    highOf: (acct) => marks.get(acct)?.high,
  };
}

/** What a moved night asks of me: 'carry' - sleep it with them; 'busy' - too busy, skipped and told; 'town' - I stand
 *  inside town limits outdoors, where the act itself refuses a rest (AUDIT REST II P4: DFU's vagrancy, the act's own
 *  first refusal), skipped and told; 'far' - told they rested a night here beyond the party's reach; null - nothing at
 *  all. Nothing when my rest is my own (`withParty` off), theirs is theirs (`resterAlone`, their `nr`), I stand in a
 *  tavern, temple or guild hall (`exempt` - TAVERN-REST1/GUILD-REST1: every member sleeps for themselves there), or I
 *  am dead. `busy`, then `town`, is asked only of a member who would be carried - restDecision's gate before the
 *  window's CanRest, the act's order. */
export function carriedNightAction({ withParty, resterAlone, exempt, dead, near, here, busy, town }) {
  if (!withParty || resterAlone || exempt || dead) return null;
  if (!near) return here ? 'far' : null;
  if (typeof busy === 'function' ? busy() : busy) return 'busy';
  return (typeof town === 'function' ? town() : town) ? 'town' : 'carry';
}

/** The rest kinds (survival/rest.js REST_KIND), worst to best: a bed and a fire price alike today, a bed ranked above
 *  so the order is total. */
const KIND_RANK = Object.freeze({ rough: 0, camp: 1, bed: 2 });
/** @param {unknown} k */
const rankOf = (k) => (typeof k === 'string' && Object.hasOwn(KIND_RANK, k) ? KIND_RANK[/** @type {'rough'|'camp'|'bed'} */ (k)] : -1);
/** The kind a carried night is slept as: the better of my own spot (`own`) and the rester's (`theirs`, off their
 *  night's stamp) - beside their fire I sleep by it, and at my own fire beside their Bedroll I sleep by mine. An
 *  unknown kind on either side yields to the other; neither known is null (the host's own reading stands). */
export function carriedRestKind(own, theirs) {
  const o = rankOf(own), t = rankOf(theirs);
  if (o < 0) return t < 0 ? null : theirs;
  return t > o ? theirs : own;
}

// CAMP-ROLL (2026-10-04, the player: "In a party, or with other players. Every player spawns their own enemies when
// resting", then "Do it"): ONE ROLL A CAMP. REST5 retired the vote online, and with it the one door that let a single
// real rest run at a time, so a party that walks up to a fire and presses Rest together opened one act each - and each
// act's night rolled its own ambush (world.js runEncounterTick: a rest is always its rester's own roll, AUDIT PSCALE1
// COUNT-1), each hit standing a pack already sized for the whole party (partyExtraFoes). Four sleepers, up to four
// party-sized packs; in a dungeon, one host ask a sleeper (REST-SYNC). A night only went quiet when it was CARRIED,
// and a member who pressed Rest themselves was 'busy', never carried.
//
// Now the act's night is the CAMP'S: the members resting with the party within its reach (world.js nearAccount, 15 m)
// whose acts are open on a night elect ONE roller with no message of its own - each says so on the pose
// (`restStartedAt` with restAct.js's CAMP_MARKS open mark, `rs` while resting), and every client reads the same
// answer: the LOWEST account id among them. The roller's night is DFU's, rolled once at the odds it always had; every
// other member's channel ends in a wait ("Resting with Ada...") that their night's stamp ends - slept as theirs, its
// rolls quiet (encounters.js quietNights) - or their ambush ends (`restEnemyAt` moved: the same foes, the same break),
// or the roller's leaving ends (a `done` mark, `rs` dropped: the next lowest rolls), or CAMP_WAIT_MS ends (my own
// roll, today's behaviour - the fail-open). A member resting alone (`nr`) is a camp of their own, as STRANGER-REST's
// gate already keeps them.

/** How long a member waits on the camp's roller, from the end of their own channel, before rolling their own night. */
export const CAMP_WAIT_MS = 15_000;
/** How old a camp mate's open mark may be and still name a rest in progress: a Bedroll's ten-second channel, the
 *  wait, and slack. */
export const CAMP_OPEN_FRESH_MS = 40_000;

/** A camp mate's pose as the law reads it: their stamp through stampOf, and their enemy break marker (the sender's
 *  own clock - compared only against the value seen before, never against mine). */
const campSnap = (m, now) => ({ at: stampOf(m?.p?.restStartedAt, now), enemy: Number.isFinite(m?.p?.restEnemyAt) ? m.p.restEnemyAt : null });

/** THE CAMP WATCH - one rest window's view of its camp. `open` at the channel's open snapshots every party mate's
 *  stamps (a move is a move SINCE my act began: a mate's night that lands while I hold the channel is mine to sleep);
 *  `verdict` is asked at the channel's end and every frame after; `close` with the window. `kindOf` answers a night
 *  stamp's rest kind or null (restAct.js nightKindOf), `campOf` a stamp's camp mark or null (restAct.js campMarkOf) -
 *  handed in, as the night watch's predicate is.
 *  @param {{ kindOf: (t: number) => string|null, campOf: (t: number) => string|null, waitMs?: number, freshMs?: number }} o */
export function createCampWatch({ kindOf, campOf, waitMs = CAMP_WAIT_MS, freshMs = CAMP_OPEN_FRESH_MS }) {
  /** @type {Map<string, { at: number, enemy: number|null }>|null} */
  let base = null;
  /** @type {number|null} */
  let firstAsk = null;
  return {
    /** My act's channel opened: every mate's stamps as they stand now. @param {any[]} members @param {number} now */
    open(members, now) {
      base = new Map();
      firstAsk = null;
      for (const m of members ?? []) if (m?.acct) base.set(m.acct, campSnap(m, now));
    },
    isOpen: () => base !== null,
    close() { base = null; firstAsk = null; },
    /** Whose night my act's is now: `{ act: 'enemy'|'night'|'wait', acct, name, kind? }`, `{ act: 'roll' }`, or null
     *  with no watch open. `me` my account; `members` the party's other rows (net/social.js others()); `inCamp(m)`
     *  whether a mate stands in my camp (present, the same place, within the party's reach). A mate first seen after
     *  the open is a baseline, never a move. A foe's break outranks a night; a night outranks the wait; the wait ends
     *  at `waitMs` from the first ask.
     *  @param {{ me: string, members: any[], inCamp: (m: any) => boolean, now: number }} q */
    verdict({ me, members, inCamp, now }) {
      if (!base) return null;
      if (firstAsk === null) firstAsk = now;
      let night = null, leader = null;
      for (const m of members ?? []) {
        if (!m?.acct || restsAlone(m) || !inCamp(m)) continue;
        const was = base.get(m.acct);
        const cur = campSnap(m, now);
        if (!was) { base.set(m.acct, cur); continue; }
        if (cur.enemy !== null && cur.enemy !== was.enemy) return { act: 'enemy', acct: m.acct, name: m.name };
        const kind = cur.at > was.at && now - cur.at <= freshMs ? kindOf(cur.at) : null;
        if (kind && !night) night = { act: 'night', acct: m.acct, name: m.name, kind };
        if (m.p?.rs && campOf(cur.at) === 'open' && now - cur.at <= freshMs && m.acct < me && (!leader || m.acct < leader.acct)) leader = m;
      }
      if (night) return night;
      if (now - firstAsk >= waitMs || !leader) return { act: 'roll' };
      return { act: 'wait', acct: leader.acct, name: leader.name };
    },
  };
}

/** CAMP-ROLL: THE PLACEMENT'S PASSES for an ambush a resting roller stands - first `env` (placeFoeEnv's) with its
 *  open-space test refusing any spot inside `min` metres of a camp mate's `feet`, then `env` itself, DFU's own, so a
 *  ground too tight for the camp's band still stands the foe and the camp's odds stay DFU's. No mates, the one pass.
 *  (PlaceFoeFreely asks overlapSphere of its final test point alone.) */
export function campPasses(env, feet, min) {
  if (!feet?.length) return [env];
  return [{ ...env, overlapSphere: (p, r) => !!env.overlapSphere?.(p, r) || !campClear(p, feet, min) }, env];
}

/** CAMP-ROLL: whether a spawn spot `p` ({x, z}) stands at least `min` metres (on the ground plane) from every camp
 *  mate's feet (`[x, y, z]` each) - the band the roller's ambush keeps from its roller, kept from every sleeper it
 *  stands for. */
export function campClear(p, feet, min) {
  const m2 = min * min;
  for (const f of feet ?? []) {
    if (!f) continue;
    const dx = f[0] - p.x, dz = f[2] - p.z;
    if (dx * dx + dz * dz < m2) return false;
  }
  return true;
}
