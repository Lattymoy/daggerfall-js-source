// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEA-SEASON (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected" - the sea's
// seasonal boards for the deepest voyage and the legends ended; bible/03-World/Eltheric-Ocean.md SEA-SEASON) - THE
// SEASON'S LAW, both ends'.
//
// A SEASON is the realm's (net/arena/arenaLaw.js arenaSeasonOf - eight weeks of wall time from a Monday, the arena's and
// the Spire's). THE CAPTAIN'S FIGURES for it are kept by the captain's ledger (systems/naval/captainLedger.js, `ether.season`
// - `{ n, deepest, legends }`: the season's number, the deepest leagues past the Veil a voyage went in it, the legends
// sunk or taken in it), the season read off the world's day (`seaSeasonOfDay` - online, the shared clock's). The service
// reads them off a realm character's CLEAN judged checkpoint (server-account/src/seaSeason.js), bounded here: the deepest
// no further than the sea goes (`SEA_DEEPEST_MAX`), the legends no more than the six could have risen since the season
// began (`seaLegendsPossible`).
//
// Pure: the numbers, the reading of a save's figures, and the board's shape.
// ═══════════════════════════════════════════════════════════════════
import { arenaSeasonOf, ARENA_SEASON_EPOCH_S, ARENA_SEASON_S } from '../arena/arenaLaw.js';
import { wallMsForClassicMinutes, ONLINE_MINUTES_PER_MS } from '../wire.js';

/** The captain's ledger's record in a save's modData (systems/naval/captainLedger.js CAPTAIN_SAVE_VENDOR - pinned equal;
 *  the Worker bundles no ledger). */
export const SEA_SEASON_VENDOR = 'Captain';
/** The deepest a voyage can go, leagues past the Veil: the sea's west edge (world/ethericSea.js etherDepthAt at
 *  ETHER_BOX.x0, floored as the ledger keeps it - pinned equal). */
export const SEA_DEEPEST_MAX = 1365;
/** The legends of the Eltheric Ocean (systems/naval/etherShips.js LEGENDS - pinned equal). */
export const SEA_LEGENDS = 6;
/** A legend ended rises again this many of the world's days on (etherShips.js LEGEND_RISE_DAYS - pinned equal)... */
export const SEA_LEGEND_RISE_DAYS = 30;
/** ...which online is this many seconds of wall time (the shared clock's twelve minutes a minute: two hours a day). */
export const SEA_LEGEND_RISE_S = Math.round(SEA_LEGEND_RISE_DAYS * 1440 / ONLINE_MINUTES_PER_MS / 1000);
/** A board's rows each way, and the last season's shown. */
export const SEA_SEASON_ROWS = 10;
export const SEA_SEASON_LAST_ROWS = 3;

/** The season holding a world day (online, the shared clock's: the wall time its first minute falls at). */
export const seaSeasonOfDay = (/** @type {number} */ day) => arenaSeasonOf(Math.floor(wallMsForClassicMinutes(Math.floor(Number(day) || 0) * 1440) / 1000));
/** A season's first second. */
export const seaSeasonStartS = (/** @type {number} */ season) => ARENA_SEASON_EPOCH_S + (Math.max(1, Math.floor(season)) - 1) * ARENA_SEASON_S;
/** The most legends a captain can have ended by `nowS` in its season: each of the six once, and once more each time the
 *  aether has raised her since the season began. */
export const seaLegendsPossible = (/** @type {number} */ nowS) => SEA_LEGENDS * (Math.floor(Math.max(0, nowS - seaSeasonStartS(arenaSeasonOf(nowS))) / SEA_LEGEND_RISE_S) + 1);

/** AUDIT SEA VENTURES B6: a world day on the shared clock, s - the ledger files a day's figures under the season its
 *  first minute fell in (the day the season turns in counts for the old one), so for this long past a turn a save may
 *  still carry the season before's. */
export const SEA_WORLD_DAY_S = Math.round(1440 / ONLINE_MINUTES_PER_MS / 1000);

/**
 * THE SEASON'S FIGURES A SAVE CARRIES, as the service reads them at `nowS`: `{ n, deepest, legends }` - the ledger's
 * `ether.season` - when it is this season's (or, a world day at most past the turn, the season before's - AUDIT SEA
 * VENTURES B6: those voyages counted for neither) and within the law, else null (an older ledger's, another season's, a
 * number no voyage could make).
 * @param {any} save @param {number} nowS
 */
export function seaSeasonFigures(save, nowS) {
  const s = save?.modData?.[SEA_SEASON_VENDOR]?.ether?.season;
  if (!s || typeof s !== 'object') return null;
  const { n, deepest, legends } = s;
  const cur = arenaSeasonOf(nowS), turnS = seaSeasonStartS(cur);
  const before = n === cur - 1 && nowS - turnS < SEA_WORLD_DAY_S;
  if (!Number.isSafeInteger(n) || (n !== cur && !before)) return null;
  if (!Number.isSafeInteger(deepest) || deepest < 0 || deepest > SEA_DEEPEST_MAX) return null;
  if (!Number.isSafeInteger(legends) || legends < 0 || legends > seaLegendsPossible(before ? turnS - 1 : nowS)) return null;
  return { n, deepest, legends };
}

/**
 * The board's answer, as the client reads it: `{ season, ends, deep: [{ name, n }], legends: [{ name, n }], mine: { deep,
 * legends }, last: { deep, legends } }` - `deep` the deepest voyages (n leagues), `legends` the legends ended (n), each at
 * most SEA_SEASON_ROWS; `mine` the asking character's `{ rank, n }` each way or null; `last` the season before's first
 * SEA_SEASON_LAST_ROWS each way. Anything malformed dropped; null for a body that is no board.
 * @param {any} v
 */
export function readSeaSeasonBoard(v) {
  if (!v || typeof v !== 'object' || !Number.isSafeInteger(v.season) || v.season < 1) return null;
  const whole = (/** @type {any} */ n) => (Number.isSafeInteger(n) && n >= 0 ? n : 0);
  const rows = (/** @type {any} */ list, max) => (Array.isArray(list) ? list : []).slice(0, max)
    .filter((r) => r && typeof r.name === 'string' && r.name.length > 0 && r.name.length <= 64)
    .map((r) => ({ name: r.name, n: whole(r.n) }));
  const mine = (/** @type {any} */ m) => (m && Number.isSafeInteger(m.rank) && m.rank >= 1 ? { rank: m.rank, n: whole(m.n) } : null);
  return {
    season: v.season, ends: whole(v.ends),
    deep: rows(v.deep, SEA_SEASON_ROWS), legends: rows(v.legends, SEA_SEASON_ROWS),
    mine: { deep: mine(v.mine?.deep), legends: mine(v.mine?.legends) },
    last: { deep: rows(v.last?.deep, SEA_SEASON_LAST_ROWS), legends: rows(v.last?.legends, SEA_SEASON_LAST_ROWS) },
  };
}
