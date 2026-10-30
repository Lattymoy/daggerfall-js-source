// @ts-check
// LONE-SLEEP (2026-10-26, the owner choosing among AUDIT RELEASE R4's levers - bible/01-Overview/audits/Audit-Release-R4.md
// R4-3, lever 2: "Idle lone cells" - a player with nobody near sends their position only on the heartbeat, so their cells
// can sleep; full rate the moment someone comes near. No visible change to players). bible/11-Multiplayer/Scale-Arc.md
// LONE-SLEEP is the record; test/net/lonesleep.test.js and tools/mutants/lonesleep.json the pins.
//
// A world cell is a Durable Object, billed while it is awake, and a moving player's POSE_HZ poses never let it sleep - nor
// the halo cells beside it (R4-3: ~1.9 cells a player alone past the Bay). A STILL player already says a pose only every
// HEARTBEAT_MS (net/online.js sendPose), and its socket's liveness rides the ping the runtime answers in the object's
// sleep (RELAY-H1). Alone, nobody reads the poses a moving player sends: so while this session is LONE it says its pose
// down its own cell's socket every LONE_POSE_MS alone, moved or not, and none down a halo's - and the moment anyone is
// near it says where it stands at once (`loneWake`) and goes back to POSE_HZ.
//
// LONE is the session's own knowledge (`loneOf`): a presence session in a world cell, its own cell's socket open and
// welcomed by a relay that may hear it so (`loneOk`), NO PEER in any room it holds (its cell's and every halo's - the
// rooms' rosters, joins and poses fill `peers`, so a peer anywhere I could see or be seen is one; the foes stream's own
// test since SCALE2b, `othersHere`, for my cell alone), no referee in any of those cells (`rf` - a duel's bout, a Wild
// zone fighter, a serpent's fight: the relay judges those poses), not standing in the open zone (`_wildZone` - its
// referee steps every pose it hears, refereeStep, and reads a minute's walk as a jump; the cell says `rf` only at the
// pose after the zone word), no referee the host says may stand in a halo (`haloWhole`), and outside a fight's hold
// (LONE_HOLD_MS after a grant's mint or a pose whose fight counters moved). A hidden staff socket is never counted - the
// hidden law has no side channel (the owner, through the coordinator, 2026-10-26): a staff follow of a lone mover hears a
// pose each LONE_POSE_MS, the accepted cost.
//
// THE RELAY IS UNCHANGED. Every reader of a pose there was read (Scale-Arc LONE-SLEEP's table): none needs a lone
// player's pose oftener than LONE_POSE_MS, and the ones that judge a WORD by where its sender stands (a grant's cell and
// pixel, a raid's, a rite's, a star's, a serpent's site, the Hour's door, the Wild zone's word) are handed my pose first
// (`loneAhead`). An older client (always POSE_HZ) is read as ever. The readers read are this release's, so a session goes
// quiet only to a relay that welcomed it as LONE_RELAY_MIN or later (`loneOk`, the version the welcome already says): an
// older one hears POSE_HZ as it always has. No frame and no relay row moved.
//
// ALONE IS ONE NOTION (`aloneOf`, the merge with main's HIBERNATE, world263 there): a presence session in a world cell, a
// building or an ordinary dungeon, nobody else in its own room or any it holds (`othersHere`, `peers`), no referee (the
// host's `haloWhole`, a cell's `rf` on any socket). Alone, HIBERNATE says no STANDING pose at all - not even the
// heartbeat - and LONE-SLEEP, in a world cell and on more conditions (`loneNow`: the open zone, a fight's hold, the
// relay's version, its own socket welcomed), says a MOVING one each LONE_POSE_MS and none down a halo.
import { isCellRoom, isWorldRoom, WORLD_WIDE_RELAY_MIN } from './wire.js';

/** The first relay whose pose readers were read for a lone session's quiet - this release's own number (net/wire.js
 *  WORLD_WIDE_RELAY_MIN: world260 on the branch, world269 at its second merge with main), every reader unchanged by
 *  LONE-SLEEP; a merge's renumber moves it with the release's. */
export const LONE_RELAY_MIN = WORLD_WIDE_RELAY_MIN;
/** May a session go quiet to the relay at version `v`? @param {unknown} v */
export const loneSupported = (v) =>
  Number(/^world(\d+)$/.exec(typeof v === 'string' ? v : '')?.[1] ?? 0) >= LONE_RELAY_MIN;

/** The longest a lone session goes without a pose down its own cell's socket, ms. What bounds it (Scale-Arc LONE-SLEEP):
 *  under PEER_TIMEOUT_MS (80 s - a hidden staff spectator holds the lone player as a peer, and its silence law hides one
 *  quiet that long), and a whole part of the Watch's WATCH_TICK_MS (120 s - SEAT1b ticks a moving account on a pose that
 *  finds its last tick 120 s old, so 60 s poses tick it every 120 s as POSE_HZ did; 90 s would every 180). The runtime
 *  sleeps an object some ten seconds after its last event, so a cell hearing one pose a minute is awake ~1/6 of it. */
export const LONE_POSE_MS = 60_000;
/** After a grant's MINT is asked or a pose's fight counters move, ms: POSE_HZ, whoever is near. The relay's reaction
 *  feed (server/src/staffFeeds.js, REACTION_FEED_URL is set) times a natural encounter from its mint, reading the moves
 *  and turns of the first REACT_FIRST_MS (3 s) off the poses that follow it - so the hold outlasts that, and the poses
 *  it reads are the ones POSE_HZ would say. Inside the wake the mint already made (~10 s), so it costs the bill nothing. */
export const LONE_HOLD_MS = 5_000;
/** The frames said down a cell's socket with no pose ahead of them: the runtime's ping, the hello (it carries one), a
 *  pose, a lease. Every other frame is a word, and a word may be judged by where I stand. */
export const LONE_QUIET_RE = /^\{"t":"(?:ping|hello|pose|lease)"/;
/** A grant's mint as sendGrant says it (net/grantLaw.js validGrantAsk projects `k` first): foes about to stand. */
export const LONE_MINT_RE = /^\{"t":"grant","k":"mint"/;
/** The pose's fight counters (scenes/world.js's pose): the weapon drawn, a swing, a cast, an arrow, a blow landed and one
 *  taken - each a first the reaction feed times, so a change is said at once and holds the session awake. */
export const LONE_FIGHT_KEYS = Object.freeze(['wd', 'an', 'cn', 'ar', 'hk', 'hu']);

/** What sendPose does with a pose (`loneStep`): HOLD it; say it down my cell's socket alone (SAY - the lone interval); or
 *  say it as ever (GO - POSE_HZ when it moved, the heartbeat when it did not, each halo when it is due). */
export const LONE_HOLD = 'hold',
  LONE_SAY = 'lone',
  LONE_GO = 'go';

/**
 * HIBERNATE and LONE-SLEEP: is a session ALONE? Pure - nobody else in its own room (`others`) or any it holds (`peers`:
 * every room's roster, join and pose fill it - a peer in a halo still hears my heartbeat), no referee (`refereed`), in a
 * world cell, a building or an ordinary dungeon (a boss room, a battle, a channel never).
 * @param {{ refereed: boolean, others: number, peers: number, room: unknown }} s
 */
export function aloneNow(s) {
  return !s.refereed && s.others === 0 && s.peers === 0 && (isCellRoom(s.room) || isWorldRoom(s.room));
}
/** The session's own `aloneNow` (net/online.js OnlineSession - read, never written): refereed while the host says a
 *  referee may stand in a halo (`haloWhole`) or a cell said `rf` on my own socket or any halo's. @param {any} s */
export function aloneOf(s) {
  let refereed = !!s.haloWhole || !!(s._ws && s._rfOn.get(s._ws));
  if (!refereed)
    for (const h of s._halo.values())
      if (h.ws && s._rfOn.get(h.ws)) {
        refereed = true;
        break;
      }
  return aloneNow({ refereed, others: s.othersHere, peers: s.peers.size, room: s.room });
}

/**
 * Is a session lone? Pure: alone (`aloneNow`), welcomed by a relay at LONE_RELAY_MIN, a presence session in a world cell
 * whose own socket is open and welcomed, not standing in the open zone, outside a fight's hold.
 * @param {{ alone: boolean, ok: boolean, presence: boolean, room: unknown, open: boolean, zone: boolean, now: number, holdUntil: number }} s
 */
export function loneNow(s) {
  return !!s.alone && !!s.ok && !!s.presence && isCellRoom(s.room) && s.open && !s.zone && s.now >= s.holdUntil;
}

/** Did a fight counter move between two poses (the last said to sendPose and this one)? @param {any} last @param {any} pose */
export const fightMoved = (last, pose) =>
  !!last && !!pose && LONE_FIGHT_KEYS.some((k) => (last[k] | 0) !== (pose[k] | 0));

/** The session's own `loneNow` (net/online.js OnlineSession - read, never written). @param {any} s @param {number} now */
export function loneOf(s, now) {
  return loneNow({
    alone: aloneOf(s),
    ok: !!s.loneOk,
    presence: s.presence,
    room: s.room,
    open: s.status === 'open' && !!s._ws && s._welcomed.has(s._ws),
    zone: s._wildZone === 1,
    now,
    holdUntil: s._loneHold ?? -Infinity,
  });
}

/**
 * What sendPose does with `pose` now: its fight hold read off the pose before it, then the lone law. Keeps `_loneWas`
 * (lone at the last pose), which a wake and a word's pose read.
 * @param {any} s @param {any} pose @param {number} now @returns {string}
 */
export function loneStep(s, pose, now) {
  if (fightMoved(s._pose, pose)) s._loneHold = now + LONE_HOLD_MS;
  const lone = loneOf(s, now);
  s._loneWas = lone;
  if (!lone) return LONE_GO;
  return now - s._lastSentAt >= LONE_POSE_MS ? LONE_SAY : LONE_HOLD;
}

/** THE WAKE: a frame read (a join, a welcome's roster, a stranger's pose, a referee's word) that ended a lone session's
 *  quiet - my pose at once, as sendPose says one at POSE_HZ (down my cell's socket, and each halo it is due to: a halo
 *  that heard me a heartbeat ago or more always is), so whoever came near sees where I stand one round trip after their
 *  hello. Asked after every frame; nothing while I was not lone, nor while I lie dead (the pose would stand me up).
 *  @param {any} s */
export function loneWake(s) {
  if (s._loneWas && s._pose && !s._dead && !loneOf(s, s._now())) s.sendPose(s._pose);
}

/**
 * A WORD CARRIES MY POSE AHEAD OF IT. A cell's socket (my own or a halo's) is handed back with its `send` wrapped, as
 * LEASE1's `_leased` wraps a lease room's: a frame that is not LONE_QUIET_RE's said while lone goes behind my pose
 * when the socket's last is not where I stand - the relay judges the word by that pose. A grant's mint starts the fight
 * hold. Anything else goes as it came.
 * @param {any} s the session @param {any} ws @param {unknown} room
 */
export function loneAhead(s, ws, room) {
  if (!ws || !isCellRoom(room) || typeof ws.send !== 'function') return ws;
  const send = ws.send.bind(ws);
  ws.send = (/** @type {any} */ frame) => {
    if (typeof frame === 'string' && !LONE_QUIET_RE.test(frame)) {
      if (s._loneWas && s._welcomed.has(ws)) poseAhead(s, ws, send);
      if (LONE_MINT_RE.test(frame)) s._loneHold = s._now() + LONE_HOLD_MS;
    }
    return send(frame);
  };
  return ws;
}

/** My pose down `ws` (through its own `send`) unless the socket's last pose stands where I do. @param {any} s @param {any} ws @param {(f: string) => void} send */
function poseAhead(s, ws, send) {
  const pose = s._pose;
  if (!pose || s._dead) return;
  const mine = ws === s._ws,
    last = mine ? s._lastSent : s._haloPosed.get(ws);
  if (last && last.x === pose.x && last.z === pose.z && (last.mv | 0) === (pose.mv | 0)) return;
  const pl = s.poseRide?.() ?? null,
    ab = s.poseAboard?.() ?? null,
    now = s._now();
  const out = { ...pose, ...(pl ? { pl } : {}), ...(ab ? { ab } : {}), ts: s._stampTs() };
  try {
    send(JSON.stringify({ t: 'pose', p: out }));
  } catch {
    return;
  }
  s.stats.sent++;
  if (mine) {
    s._lastSent = { ...pose };
    s._lastSentAt = now;
    s.stats.poses++;
  } else s._haloPosed.set(ws, { x: out.x, z: out.z, mv: out.mv | 0, at: now });
}
