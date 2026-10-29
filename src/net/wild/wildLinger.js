// @ts-check
// PVP-LINGER (the owner, 2026-10-29: "keep their body in game if they login in the window of cooldown"): a fighter whose
// last socket closes inside PVP_FLAG.lockMs of a PvP blow given or taken leaves its body standing in the zone, struck by
// the referee's law, until the lock runs out. Its log-in takes the body back. The relay's half is
// server/src/pvpLinger.js. Pure. A departure: DFU has no PvP.
import { PVP_FLAG } from '../../systems/wild/pvpFlag.js';
import { WILD_REF } from './wildRef.js';

/** The longest a body stands after its close (blows on it renew its lock), how often the room says its pose again
 *  (net/wire.js HEARTBEAT_MS - a peer silent four of those is hidden), how often the hub is asked whether it stands in
 *  another room, and the most bodies a room keeps. */
export const PVP_LINGER = Object.freeze({ maxMs: 3 * PVP_FLAG.lockMs, sayMs: 20_000, askMs: 5_000, max: 64 });

/** The end of a fighter's lock at its close `now`, or 0: no body stays (out of the zone, down, or no PvP blow in the
 *  lock). A villain's meter alone keeps nobody: the blow is the lock. */
export function lingerUntil(/** @type {any} */ x, /** @type {number} */ now) {
  if (!x || !x.zone || x.down) return 0;
  const end = Math.max(x.fightAt, x.struckAt) + PVP_FLAG.lockMs;
  return end > now ? end : 0;
}

/** Has a lingering body (`rec`, made at `rec.at`) gone? Its lock run out, its fall signed (WILD_REF.pickMs after it),
 *  out of the zone, or PVP_LINGER.maxMs after its close. */
export function lingerOver(/** @type {{ at: number }} */ rec, /** @type {any} */ x, /** @type {number} */ now) {
  if (!x || !x.zone || now - rec.at >= PVP_LINGER.maxMs) return true;
  if (x.down) return now - x.downAt > WILD_REF.pickMs;
  return now - Math.max(x.fightAt, x.struckAt) >= PVP_FLAG.lockMs;
}
