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
