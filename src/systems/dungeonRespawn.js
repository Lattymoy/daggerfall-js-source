// @ts-check
// DUNGEON-RESPAWN (2026-10-08, the owner: "normal dungeons outside the zone 20mins respawn timer (which timer doesnt reset
// when someone was in and left) for everything and the same for elite dungeons 40 mins respawn timer for everything"):
// WORLD8's respawn (net/wire.js respawnDue - a dead foe and an emptied container each come back on their OWN clock, from
// the moment it fell or was emptied, whoever comes and goes) at the dungeon's own pace: a normal dungeon twenty minutes,
// an elite one forty. The zone's halls keep WORLD8's hour (their own reset is the hub's - net/wildLaw.js), and so does a
// Super dungeon. Pure.
import { RESPAWN_MS } from '../net/wire.js';

export const DUNGEON_RESPAWN_MS = 20 * 60_000;
export const ELITE_DUNGEON_RESPAWN_MS = 40 * 60_000;

/** The respawn time of a dungeon: `{ elite, wild, superTier }` its kind. */
export const dungeonRespawnMs = ({ elite = false, wild = false, superTier = false } = {}) =>
  (wild || superTier ? RESPAWN_MS : elite ? ELITE_DUNGEON_RESPAWN_MS : DUNGEON_RESPAWN_MS);

/** Is a stamp (when it fell, when it was emptied - the relay's clock) past the dungeon's respawn time by `nowMs`? False
 *  for no stamp or no clock (offline: nothing respawns, DFU's own), as respawnDue. */
export const dungeonRespawnDue = (stampMs, nowMs, ms) => Number.isFinite(stampMs) && Number.isFinite(nowMs) && nowMs - stampMs >= ms;
