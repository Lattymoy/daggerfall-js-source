// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DOOR-TOKEN (FIELD BUGS 2026-10-16b, the Discord: "Friend invisible and
// randomly popping up"; "Partied players popping in and out randomly
// after leaving tombs at graveyard ... also partied players inside tombs
// are invisible for a time") - THE NEXT ROOM'S TOKEN, MINTED AT THE DOOR.
//
// Every place change is a new relay room, and a room's socket asks the
// page's minter for its identity token as it opens (net/online.js
// `_bind`): a token held opens it at once (accountClient.js
// TOKEN_REUSE_MS), anything else is a mint on the wire - seconds for a
// player (FIELD BUGS 29h TOKEN-WAIT), the hello waiting on it, the
// player invisible to the party on both sides of the door. A crypt
// visited longer than the reuse minute paid it on the way in and again
// on the way out (the cell outside is a room the old token already
// opened). So the host says the place change is coming, and the mint
// goes THEN (minter.ahead(room, withinMs), which mints only when the
// token held could not open the next room by the time its socket asks
// - the next room's own mint, gone early):
//
//   entering()  a door is taking me in (worldModes' onPreTransition) -
//               the mint runs while the building or the dungeon builds;
//               the cell I stand in is remembered as the way back out
//   leaving()   a door is taking me out (onDungeonLeave/onInteriorLeave)
//   jumping()   a fast travel, a teleport, a recall, a respawn - every
//               jump's one primitive (world.js _teleportToPixel), the
//               mint running while the destination streams
//   frame()     each online frame: a place change under way (one of the
//               three above, until the next room is joined) asked again
//               against DOOR_SOON_MS, however long its build or stream
//               takes; and the way out approached - inside, back within
//               EXIT_NEAR_M of an exit door after standing EXIT_ARM_M
//               from every one, once a visit (an exit is a click away,
//               with nothing to build behind it, so the walk to the door
//               is the mint's time)
//
// AUDIT (2026-10-16, A2): THE MARGIN IS THE DOOR'S OWN. One margin of
// 20 s at every door (TOKEN_AHEAD_MS) minted whenever the held token
// was 40-60 s old, though the next socket asks within a frame (out) or
// a build (in) and the held token would still have opened it: twice the
// mints at a 40-55 s door gap, half again at 30-60 s; and the walk out
// re-armed on every approach - a fight pacing 10-35 m from a dungeon's
// exit minted 13 times in ten minutes, none before. Now a door asks with
// DOOR_SOON_MS (its socket's ask after the room changes), re-asked every
// frame of the place change so a long build never needs a guessed bound,
// and the walk out with EXIT_WALK_MS, once a visit.
//
// Only online (a session in a room, not terminal, not superseded): an
// offline page mints nothing.
// ═══════════════════════════════════════════════════════════════════
import { isCellRoom } from '../net/wire.js';
import { closestDoorTo } from '../player/enterExit.js';

/** The way out approached: within this of an exit door (m) - two to four seconds of a walk, a run's two, which is most of a
 *  mint on the wire. */
export const EXIT_NEAR_M = 16;
/** And armed again only once the player has stood this far from every exit door (m) - the spawn at a door is no walk to
 *  it, and a player who never leaves the door's side (a shop's counter) is never minted for. */
export const EXIT_ARM_M = 32;
/** AUDIT A2: a room's socket asks for its token this soon after the place change takes it (ms) - a frame, the join's
 *  hold (world.js ROOM_HOLD_MS, 500) and a socket's open. A door's token is minted ahead only when the held one would
 *  not open the next room by then. */
export const DOOR_SOON_MS = 2_000;
/** AUDIT A2: from the exit's approach to the next room's socket asking (ms) - EXIT_NEAR_M at the slowest walk (3.2 m/s, a
 *  Speed 10 body: player/motor.js walkSpeed) is 5 s, then the door's click and DOOR_SOON_MS. */
export const EXIT_WALK_MS = 8_000;
/** AUDIT A2: a place change stands pending - asked again each frame - at most this long (ms): a door whose build was
 *  refused after it asked, or a jump to the room I stand in, lets go. Under TOKEN_REUSE_MS, so a pending door mints once. */
export const DOOR_PENDING_MS = 30_000;

/**
 * @param {object} io
 * @param {() => any} io.minter   the page's identity minter (net/accountClient.js accountTokenMinter)
 * @param {() => any} io.session  the presence session (net/online.js OnlineSession), null offline
 * @param {() => any} [io.modes]  the mode machine (scenes/worldModes.js) - its mode and the live place's exit doors
 * @param {() => any} [io.player] the motor - its `pos`, in the live place's frame
 * @param {() => number} [io.now] the clock (ms)
 */
export function createDoorToken({ minter, session, modes = () => null, player = () => null, now = () => Date.now() }) {
  /** The open-country cell the way out leads back to: the room a door took me in from. */
  let back = /** @type {string|null} */ (null);
  let armed = false;
  /** AUDIT A2: the walk out has minted this visit - it arms no more until a door takes me in (or a jump lands me). */
  let walked = false;
  /** AUDIT A2: a place change under way - `{ from, room, until }`: the room I stood in when it began, the room it leads to
   *  (null when unknown), and when it is let go - until the session stands in another room. */
  let pending = /** @type {{ from: string, room: string|null, until: number } | null} */ (null);
  // a seam read before the host has stood it up (a jump during the boot's own load) is none, never a throw
  const read = (/** @type {() => any} */ f) => { try { return f() ?? null; } catch { return null; } };
  const live = () => {
    const s = read(session);
    return s && s.url && s.room && !s.terminal && !s.superseded ? s : null;
  };
  const ahead = (/** @type {string|null} */ room, /** @type {number} */ withinMs) => {
    if (!live()) return false;
    const m = read(minter);
    return typeof m?.ahead === 'function' ? !!m.ahead(room, withinMs) : false;
  };
  /** A place change begins: asked now, and again each frame until its room is joined (`frame`). */
  const change = (/** @type {string|null} */ room) => {
    const s = live();
    pending = s ? { from: s.room, room, until: now() + DOOR_PENDING_MS } : null;
    return ahead(room, DOOR_SOON_MS);
  };
  /** The nearest exit door of the live place, m - Infinity outside, or with none. */
  const exitDistance = () => {
    const md = read(modes), pos = read(player)?.pos;
    if (!md || !pos) return Infinity;
    const doors = md.mode === 'dungeon' ? md.dungeonCtx?.exitDoors : md.mode === 'interior' ? md.interiorCtx?.doors : null;
    if (!doors?.length) return Infinity;
    const near = closestDoorTo(pos, doors);
    return near ? Math.hypot(near.pos[0] - pos[0], near.pos[1] - pos[1], near.pos[2] - pos[2]) : Infinity;
  };
  return {
    /** A door is taking me in. True when a mint went. */
    entering() {
      const s = live();
      if (!s) return false;
      if (isCellRoom(s.room)) back = s.room;
      armed = false; walked = false;
      return change(null);
    },
    /** A door is taking me out, to the cell I came in from. True when a mint went. */
    leaving() {
      armed = false;
      return change(back);
    },
    /** A jump to another place. True when a mint went. */
    jumping() {
      back = null;
      armed = false; walked = false;
      return change(null);
    },
    /** Each online frame: a place change under way, asked again; or the way out approached. True when a mint went. */
    frame() {
      if (pending) {
        const s = read(session);
        if (now() > pending.until || (s?.room && s.room !== pending.from)) pending = null;   // its room joined (or given up)
        else return ahead(pending.room, DOOR_SOON_MS);
      }
      const d = exitDistance();
      if (!(d < Infinity)) { armed = false; return false; }
      if (d > EXIT_ARM_M) { armed = !walked; return false; }
      if (!armed || d > EXIT_NEAR_M) return false;
      armed = false;
      walked = ahead(back, EXIT_WALK_MS);
      return walked;
    },
    /** The way back out (null when no door took me in). */
    get back() { return back; },
  };
}
