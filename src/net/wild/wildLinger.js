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

/** PVP-LINGER-RISE (the owner, asked: "So u respawn in town if u get killed and log back in?"): a body killed while its
 *  player was away is kept in its room's storage under this prefix, a week at most and 256 a room, and its player's
 *  next word that it stands in the zone is a death: its screen this long, then the zone's rise in a town. */
export const LINGER_AWAY = Object.freeze({ prefix: 'wildaway:', keepMs: 7 * 24 * 3_600_000, max: 256, downMs: 10_000 });

/** The `down` word for a player slain while away (`rec` `{ at, n }`: when, and its killer's name; `x` its fighter), or
 *  null when kept past LINGER_AWAY.keepMs. A fighter still down lies out the referee's own wait. */
export function lingerAwayWord(/** @type {any} */ rec, /** @type {any} */ x, /** @type {number} */ now) {
  if (!rec || !Number.isFinite(rec.at) || !(now - rec.at < LINGER_AWAY.keepMs)) return null;
  const left = x?.down ? Math.ceil(WILD_REF.riseMs - (now - x.downAt)) : 0;
  return {
    t: 'wref',
    k: 'down',
    ms: Math.min(WILD_REF.riseMs, Math.max(LINGER_AWAY.downMs, left)),
    aw: 1,
    ...(typeof rec.n === 'string' && rec.n ? { n: rec.n } : {}),
  };
}

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
