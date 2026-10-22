// @ts-check
// OWNER-CLOCK (2026-10-21, the field: players report enemy desync; a player's profile shows boats, peers, horses and grass
// each taking a tenth to a quarter of the main thread, so a slow owner is common): A FOES FRAME SAYS WHEN ITS FOES WERE
// WHERE IT SAYS.
//
// A foe is its owner's to step: the owner streams the foes it stepped, every FOES_MS and whole every FOES_FULL_MS, on its
// own frame cadence (scenes/world.js foesStream), and a reader leads each puppet along the way its last two records show
// (scenes/puppetLead.js, DESYNC-ZERO). The reader measured that way on its OWN arrival clock - so an owner at 3 fps,
// whose frames leave 333 ms apart and land anywhere from a few to a few hundred milliseconds later, read wrong speeds,
// and every hitch on the owner's machine or on the road between stood its foes still and then jumped them. SCALE2b gave a
// pose the time it was said (`ts`, net/wire.js POSE_TS_MOD) for the same reason; this gives a foes frame the time its
// foes were stepped: `tm`, the owner's own clock (ms, performance.now()) at the frame whose step left them where the frame
// says, an integer inside POSE_TS_MOD - the pose time's wrap, one law for both.
//
// THE WIRE. `tm` rides INSIDE the frame's `data`, stamped by the session as the frame leaves (net/online.js sendFoes,
// sendOwnFoes - every lane: a cell's, a world room's host stream, the own lane), in the bytes it sends. The relay reads
// nothing inside a foes frame: it re-serialises `data` whole (server/src/index.js fanOut - a frame that GREW past its
// sent length is junk, and an integer round-trips at its length), its grant strip keeps every top-level field
// (`_grantStripped` answers the frame itself or `{ ...data, f }`), and parseClient asks only that `data` is an object.
// A reader before this one reads named fields and never `tm`. So no relay change and no RELAY_VERSION: an older owner
// sends no `tm`, and its puppets are led as DESYNC-ZERO led them.
//
// THE READER. The session holds the frame's `tm` while the frame is applied (applyingOwnerTm, around onFoes/onOwnFoes),
// and each pool's record door copies it onto the puppet's streamed state beside its feet (`p.tm`) - a record applied
// later, by a build that lands after its frame, carries none.
import { POSE_TS_MOD, poseTsDiff } from './wire.js';

/** The wrap of the owner's clock on the wire (ms): the pose time's (SCALE2b), 4.6 hours. */
export const OWNER_TM_MOD = POSE_TS_MOD;

/** One owner's clock: the moment (ms, the page's performance.now()) its foes were last stepped, as `tm`. */
export function createOwnerClock() {
  let at = null;
  return {
    /** The foes were stepped at `ms` - what a frame built from them now says of them. */
    mark(ms) { if (Number.isFinite(ms)) at = ms; },
    /** The frame's `tm`: the last step's moment inside the wrap, or null when none was ever marked. */
    tm() { return at == null ? null : ((Math.round(at) % OWNER_TM_MOD) + OWNER_TM_MOD) % OWNER_TM_MOD; },
  };
}

/** The page's own - one clock for every pool the page steps (the street's, a building's, a dungeon's), as the tactics
 *  brain keeps one (ai/tacticsClock.js). */
export const ownerClock = createOwnerClock();

/** A frame's `tm` as a reader takes it: an integer inside the wrap, else null (an older owner's frame, or junk). */
export const ownerTmOf = (data) => {
  const tm = data && typeof data === 'object' ? data.tm : undefined;
  return Number.isInteger(tm) && tm >= 0 && tm < OWNER_TM_MOD ? tm : null;
};

/** Seconds from owner time `b` to owner time `a`, across the wrap - positive when `a` is newer. */
export const ownerTmDiffS = (a, b) => poseTsDiff(a, b) / 1000;

/** The text a foes or own frame leaves as: `data` with the owner's `tm` - never put on the caller's frame, which is
 *  the stream's own memory (net/foesQuiet.js reads it) - or without it when the stamp would carry it past `max`, or
 *  null when even that is past it. */
export function stampedFrameText(t, data, tm, max) {
  if (tm != null) {
    const s = JSON.stringify({ t, data: { ...data, tm } });
    if (s.length <= max) return s;
  }
  const s = JSON.stringify({ t, data });
  return s.length <= max ? s : null;
}

let _applying = null;
/** The reader's side: `apply` runs with the frame's `tm` in hand (appliedOwnerTm), and nothing outside it sees one. */
export function applyingOwnerTm(data, apply) {
  const was = _applying;
  _applying = ownerTmOf(data);
  try { return apply(); } finally { _applying = was; }
}
/** The `tm` of the frame being applied now; null outside one - a build that lands after its frame stamps nothing. */
export const appliedOwnerTm = () => _applying;
