// @ts-check
// STAFF-PANEL5-FOLLOW (2026-10-22, design doc "DFO Staff Panel: design", Invisible follow, In game: the staff view, and
// the weak spots "Invisible follow and the in-game view" and "Follow can't learn the target's next room") - THE LAW BOTH
// ENDS RUN FOR THE WHERE NOTE AND FOR FOLLOWING A PLAYER.
//
// THE WHERE NOTE (mob, 05:45Z: "dont we have a note for player postion already?"). It is the party pose
// (net/wire.js validPartyPose), which the hub keeps on the socket for anyone who sends it, party or not. The game now
// sends it outside a party too, at most one a WHERE_NOTE_MOVING_MS while it changes and one a WHERE_NOTE_STILL_MS while
// it does not (mob, 06:00Z: "could we do 1 every 5 second moving and one every 60 not"); a party member keeps its once a
// second. The hub reads it for staff alone: a staff /tp (server/src/staffTeleport.js) and a follow (below). A note older
// than NOTE_STALE_MS is no note - a game that stopped sending, or an old build.
//
// FOLLOWING (mob, 03:09Z: invisible follow for Admins and Moderators; 07:04Z: "Moderators may follow any player
// anywhere, as Admins do, and the audit log is the check"). The account service mints a hidden spectator's token naming
// its target (`fo`, net/identityToken.js) and writes the mint to the audit log (server-account/src/staffFollow.js). The
// spectator's game holds a hub link on that token, and the hub (the bus, `chat:world`) says to it alone, as `fol`:
//   on     {sub}                the follow stands - the relay-checked flag the game's follow camera waits for
//   note   {sub, p, ag}         the target's where note, on the follow's start and whenever its room changes; `ag` its age, s
//   in/out {sub, room, ly?}     a room the spectator stands in saw the target join or leave it (the rooms' own word)
//   gone   {sub}                the target holds no hub link now (offline)
// A room learns that an account is followed only from a spectator standing in it (its token's `fo`), so it costs
// nothing anywhere nobody follows (design doc, Server load: "Costs only while someone follows").
import { isWorldRoom, isCellRoom, validPartyPose } from './wire.js';
import { ID_RE } from './identityToken.js';
import { privateInteriorOf } from './privateInterior.js';

/** The first relay that speaks the follow law (the staff panel's one relay release - integration renumbers it with
 *  RELAY_VERSION). An older relay knows no `hd` or `fo` and would show a spectator, so the game asks this first. */
export const FOLLOW_RELAY_MIN = 247;   // world247 (STAFF-PANEL5: world246 is SEA VENTURES')
/** Does the relay at version `v` follow? */
export const followSupported = (/** @type {unknown} */ v) => Number(/^world(\d+)$/.exec(String(v ?? ''))?.[1]) >= FOLLOW_RELAY_MIN;

/** The fewest ms between two where notes outside a party while the note changes. */
export const WHERE_NOTE_MOVING_MS = 5_000;
/** ...and the most ms between two while it does not (a keepalive, the same note again). */
export const WHERE_NOTE_STILL_MS = 60_000;
/** A note older than this, at the hub, is no note: two keepalives missed and a margin. */
export const NOTE_STALE_MS = 2 * WHERE_NOTE_STILL_MS + 30_000;

/** Whether a where note outside a party is due now: a changed one WHERE_NOTE_MOVING_MS after the last, an unchanged
 *  one WHERE_NOTE_STILL_MS after it. `lastAt` -Infinity before the first.
 *  @param {number} now @param {number} lastAt @param {boolean} changed */
export const whereNoteDue = (now, lastAt, changed) => now - lastAt >= (changed ? WHERE_NOTE_MOVING_MS : WHERE_NOTE_STILL_MS);

/** The room a note names (`rk`, with its layer), or null for one that names none (an old build, a battle).
 *  STAFF-PANEL5-FOLLOW-FIX (finding 2): a private room - a home, a boat's cabin, a caravan - is one, so the follow asks a
 *  token for it and the service writes its `follow-home` row. @param {any} p @returns {{ room: string, ly: number } | null} */
export function noteRoom(p) {
  if (!p || !(isWorldRoom(p.rk) || isCellRoom(p.rk) || privateInteriorOf(p.rk))) return null;
  return { room: p.rk, ly: Number.isInteger(p.ly) && p.ly > 0 ? p.ly : 0 };
}
/** Where a note says its sender stands, as one string - a changed one is a changed room (a door, a dungeon, fast travel,
 *  a teleport, a layer). Outside, the cell (`rk`) or, from a build that names none, the pixel. @param {any} p */
export const noteWhere = (p) => `${p?.in ?? 0}|${p?.rk ?? `${p?.px},${p?.py}`}|${p?.ly ?? 0}|${p?.ins ?? ''}|${p?.in === 2 ? p?.bk ?? '' : ''}`;

/** The frame kinds the hub says to a spectator. */
export const FOLLOW_KINDS = Object.freeze(['on', 'note', 'in', 'out', 'gone']);
/** The internal door a room tells the bus by that a followed account joined or left it. */
export const FOLLOW_INTERNAL_SAY = '/internal/follow/say';
/** The most followers one target may have on the bus, and the most targets followed at once - a staff team's worth. */
export const FOLLOWERS_MAX = 16;
export const FOLLOWED_MAX = 256;

/** A room's word to the bus, checked at the bus's door: `{ sub, k: 'in'|'out', room, ly?, id? }` or null - `id` the
 *  account's socket's id in that room (STAFF-PANEL5-FOLLOW-FIX, finding 1: the name its roster knows it by). @param {any} b */
export function validFollowSay(b) {
  if (!b || typeof b !== 'object' || typeof b.sub !== 'string' || !ID_RE.test(b.sub)) return null;
  if (b.k !== 'in' && b.k !== 'out') return null;
  if (typeof b.room !== 'string' || b.room.length > 128 || !/^[\w:.,#@+-]+$/.test(b.room)) return null;
  return { sub: b.sub, k: b.k, room: b.room, ...(Number.isInteger(b.ly) && b.ly > 0 && b.ly < 64 ? { ly: b.ly } : {}), ...(typeof b.id === 'string' && ID_RE.test(b.id) ? { id: b.id } : {}) };
}

/** A `fol` frame as the game reads it, or null - an unsolicited or malformed one changes nothing. @param {any} m */
export function validFollowOut(m) {
  if (!m || m.t !== 'fol' || !FOLLOW_KINDS.includes(m.k) || typeof m.sub !== 'string' || !ID_RE.test(m.sub)) return null;
  if (m.k === 'on' || m.k === 'gone') return { k: m.k, sub: m.sub };
  if (m.k === 'note') {
    const p = validPartyPose(m.p);
    return p ? { k: 'note', sub: m.sub, p, ag: Number.isSafeInteger(m.ag) && m.ag >= 0 ? m.ag : 0 } : null;
  }
  const said = validFollowSay(m);
  return said && (isWorldRoom(said.room) || isCellRoom(said.room) || privateInteriorOf(said.room)) ? said : null;   // a room a spectator can stand in
}
