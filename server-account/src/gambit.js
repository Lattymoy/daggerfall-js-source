// @ts-check
// ═══════════════════════════════════════════════════════════════════
// KG6 - THE KING'S GAMBIT'S SEASON BOARD, AND ITS GRANDMASTER.
//
// bible/11-Multiplayer/Kings-Gambit.md section 10.7, DECIDED: "a season
// board the Arena's way, its Elo and its caps, whose #1 over 10 games
// against 5 foes (Iliac Hand's champion's floor) wears GRANDMASTER - the
// mod's highest tier's name." Section 19.
//
// Iliac Hand's board's twin (iliac.js), for a game with no deck to vouch
// for: a game between two accounts at the relay's King's Gambit table is
// rated - the relay signs its result (net/gambit/gambitReceipt.js g1) and either
// seat carries it here. ONE row keyed by the game's id, whichever account
// carries it first; the arena's Elo (arenaLaw.js eloAfter) and season
// (arenaSeasonOf); a pair's day and season capped as the arena's are; a
// rating written only while both ratings stand as they were read (the
// INSERT's own WHERE), "the rating now" an account's last row written.
// No draw: a game nobody won is no contest, and no receipt.
//
// THE TITLE IS DERIVED (titles.js): `grandmaster` while the account is
// the season's #1 with GAMBIT_CHAMPION_MIN_GAMES rated games against
// GAMBIT_CHAMPION_MIN_FOES foes - counted on the rows, kept for every
// Worker in gambit_champions, laid on the row as `gambit` at the doors
// that read a badge, lapsing by itself when another takes the top.
//
// Not a DFU member: Daggerfall Unity has no such game - the mod does. Ledger A row (THE KING'S GAMBIT).
// ═══════════════════════════════════════════════════════════════════
import { verifyGambitReceipt } from '../../src/net/gambit/gambitReceipt.js';
import { arenaSeasonOf, arenaSeasonEndsS, arenaSeasonDay, eloAfter, ARENA_ELO_START, ARENA_ELO_MIN, ARENA_ELO_MAX, arenaRatingOk, ARENA_PAIR_DAY_MAX, ARENA_PAIR_SEASON_MAX } from '../../src/net/arena/arenaLaw.js';
import { boardNamesOf } from './boardNames.js';

/** 10.7: the games and the different foes the season's #1 must have played to wear GRANDMASTER - Iliac Hand's
 *  champion's floor (iliac.js ILIAC_CHAMPION_MIN_GAMES, ILIAC_CHAMPION_MIN_FOES). */
export const GAMBIT_CHAMPION_MIN_GAMES = 10;
export const GAMBIT_CHAMPION_MIN_FOES = 5;
/** A board's rows before the caller's own is pinned under them. */
export const GAMBIT_BOARD_TOP = 10;
/** How long one Worker keeps its word of the season's #1, how old the stored one may be before it is counted again, and
 *  when the service's clock counts it (Iliac Hand's, the arena's). */
export const GAMBIT_CHAMPION_CACHE_S = 60;
export const GAMBIT_CHAMPION_STORED_S = 600;
export const GAMBIT_CHAMPION_CLOCK_S = GAMBIT_CHAMPION_STORED_S - 120;
/** How many times a claim reads the two ratings again when a game of either landed between its read and its write. */
export const GAMBIT_RATE_TRIES = 4;

// ── THE GAMES ────────────────────────────────────────────────────────────────────────────────────────────────────

/** One account's rated games of a season, read off its own side of each (`p` the account's parameter, `s` the season's);
 *  a row whose two sides are one account read once, from `a`. */
const MY_GAMES_SQL = (p, s) => `SELECT ra1 AS r, at, rowid AS k, CASE result WHEN 0 THEN 1 ELSE 0 END AS w, CASE result WHEN 1 THEN 1 ELSE 0 END AS l
      FROM gambit_games WHERE a = ${p} AND season = ${s} AND rated = 1
    UNION ALL
    SELECT rb1, at, rowid, CASE result WHEN 1 THEN 1 ELSE 0 END, CASE result WHEN 0 THEN 1 ELSE 0 END
      FROM gambit_games WHERE b = ${p} AND season = ${s} AND rated = 1 AND a IS NOT ${p}`;
/** An account's season rating NOW as one SQL value - its last row WRITTEN (the rowid: Iliac Hand's AUDIT CARDS-6 D1). */
const RATING_NOW_SQL = (p) => `COALESCE((SELECT CASE WHEN r BETWEEN ${ARENA_ELO_MIN} AND ${ARENA_ELO_MAX} THEN r ELSE ${ARENA_ELO_START} END
    FROM (SELECT r FROM (${MY_GAMES_SQL(p, '?2')}) ORDER BY k DESC LIMIT 1)), ${ARENA_ELO_START})`;
/** A pair's rated games (`?1`, `?2` its two accounts, `when` the rows' further bound), each seating one indexed lookup. */
const PAIR_SQL = (when) => `SELECT (SELECT COUNT(*) FROM gambit_games WHERE a = ?1 AND b = ?2 AND rated = 1 AND ${when})
    + (SELECT COUNT(*) FROM gambit_games WHERE a = ?2 AND b = ?1 AND ?1 IS NOT ?2 AND rated = 1 AND ${when}) AS n`;
/** Both sides of a season's rated games as rows - an account per row, its rating after, its result, its foe. */
const SIDES_SQL = `sides AS (
    SELECT a AS p, ra1 AS r, at, rowid AS k, CASE result WHEN 0 THEN 1 ELSE 0 END AS w, CASE result WHEN 1 THEN 1 ELSE 0 END AS l, b AS o
      FROM gambit_games WHERE season = ?1 AND rated = 1 AND a IS NOT NULL
    UNION ALL
    SELECT b, rb1, at, rowid, CASE result WHEN 1 THEN 1 ELSE 0 END, CASE result WHEN 0 THEN 1 ELSE 0 END, a
      FROM gambit_games WHERE season = ?1 AND rated = 1 AND b IS NOT NULL)`;
/** The season's board: each account's rating after its last rated game and its tally, ranked - the rating, then wins,
 *  then fewer games, then the one who got there first. */
const BOARD_SQL = `WITH ${SIDES_SQL},
  last AS (SELECT p, r, at, ROW_NUMBER() OVER (PARTITION BY p ORDER BY k DESC) AS rn FROM sides),
  tally AS (SELECT p, SUM(w) AS w, SUM(l) AS l, COUNT(*) AS n, COUNT(DISTINCT o) AS foes FROM sides GROUP BY p)
  SELECT last.p AS player, last.r AS rating, last.at AS at, tally.w AS wins, tally.l AS losses, tally.n AS games, tally.foes AS foes
    FROM last JOIN tally ON tally.p = last.p WHERE last.rn = 1
    ORDER BY last.r DESC, tally.w DESC, tally.n ASC, last.at ASC, last.p ASC`;

/** An account's rating in a season and its tally - the start for one that has played nobody. */
export async function gambitRatingOf({ db }, playerId, season) {
  const t = await db.prepare(`SELECT (SELECT r FROM (${MY_GAMES_SQL('?2', '?1')}) ORDER BY k DESC LIMIT 1) AS last,
       SUM(w) AS w, SUM(l) AS l, COUNT(*) AS n FROM (${MY_GAMES_SQL('?2', '?1')})`).bind(season, playerId).first();
  const n = (v) => Number(v ?? 0) || 0;
  return { rating: t?.last != null ? arenaRatingOk(Number(t.last)) : ARENA_ELO_START, wins: n(t?.w), losses: n(t?.l), games: n(t?.n) };
}

/** May this board row wear GRANDMASTER - its rated games, against enough different foes. */
export const gambitTitleWorthy = (r) => !!r && Number(r.games) >= GAMBIT_CHAMPION_MIN_GAMES && Number(r.foes ?? 0) >= GAMBIT_CHAMPION_MIN_FOES;
/** The board's #1 when they may wear the title, or null - the FIRST row only: one short holds the top and nobody wears it. */
export const gambitChampionOfBoard = (rows) => (gambitTitleWorthy(rows?.[0]) ? rows[0].player : null);
/** The season's #1 who may wear the title, or null. */
export async function gambitChampionOf({ db }, season) {
  const rows = (await db.prepare(`${BOARD_SQL} LIMIT 1`).bind(season).all()).results ?? [];
  return gambitChampionOfBoard(rows);
}
/** One Worker's word of the season's #1, kept GAMBIT_CHAMPION_CACHE_S. */
let _champ = { season: 0, at: -Infinity, id: null };
/** Tests: the kept #1 forgotten. */
export function _resetGambitCache() { _champ = { season: 0, at: -Infinity, id: null }; }
/** The board's top counted and kept (gambit_champions), for every Worker. Answers the #1 (or null). */
export async function storeGambitChampion(ctx, season, nowS) {
  const id = await gambitChampionOf(ctx, season);
  await ctx.db.prepare(`INSERT INTO gambit_champions (season, player, at) VALUES (?1, ?2, ?3)
    ON CONFLICT (season) DO UPDATE SET player = excluded.player, at = excluded.at`).bind(season, id, nowS).run();
  _champ = { season, at: nowS, id };
  return id;
}
/** Whether the season has a rated game - a season nobody played counts no board and writes nothing. */
const seasonPlayed = async ({ db }, season) => !!(await playedRead(db, season).first());
/** The season's #1 as the service last counted it - counted afresh only where it never was this season or is old, and
 *  only when the season has a rated game at all. */
async function championNow(ctx, nowS) {
  const season = arenaSeasonOf(nowS);
  if (_champ.season === season && nowS - _champ.at < GAMBIT_CHAMPION_CACHE_S) return _champ.id;
  const kept = await championKeptRead(ctx.db, season).first();
  const stale = !(kept && nowS - Number(kept.at) < GAMBIT_CHAMPION_STORED_S);
  return championFrom(ctx, nowS, season, kept, stale && await seasonPlayed(ctx, season));
}
/** SIGN-BATCH: the kept #1's row, as a statement; and whether the season has a rated game, as one. */
const championKeptRead = (/** @type {any} */ db, /** @type {number} */ season) => db.prepare('SELECT player, at FROM gambit_champions WHERE season = ?1').bind(season);
const playedRead = (/** @type {any} */ db, /** @type {number} */ season) => db.prepare('SELECT 1 AS one FROM gambit_games WHERE season = ?1 AND rated = 1 LIMIT 1').bind(season);
/** The season's #1 from its kept row - counted again and stored where it is none or stale and the season was played -
 *  and kept by this Worker. */
async function championFrom(/** @type {any} */ ctx, /** @type {number} */ nowS, /** @type {number} */ season, /** @type {any} */ kept, /** @type {boolean} */ played) {
  const id = kept && nowS - Number(kept.at) < GAMBIT_CHAMPION_STORED_S ? kept.player ?? null : played ? await storeGambitChampion(ctx, season, nowS) : null;
  _champ = { season, at: nowS, id };
  return id;
}
/** SIGN-BATCH (2026-10-16; arena.js arenaHonoursPlan says why): the season's #1's reads - its kept row and whether the
 *  season was played, where this Worker kept none - and its honours from theirs, as gambitHonoursOf answers them. */
export function gambitHonoursPlan(/** @type {any} */ ctx, /** @type {any} */ player, /** @type {number} */ nowS) {
  if (!player?.handle) return { reads: [], from: async () => ({ champion: false }) };
  const season = arenaSeasonOf(nowS);
  const cached = _champ.season === season && nowS - _champ.at < GAMBIT_CHAMPION_CACHE_S;
  const keptId = cached ? _champ.id : null;   // PRIMARY-TRIPS audit: the #1 kept when the plan was made - read after the batch, another request's count of a new season could stand in its place
  return {
    reads: cached ? [] : [championKeptRead(ctx.db, season), playedRead(ctx.db, season)],
    from: async (/** @type {any[]} */ res) => ({ champion: (cached ? keptId : await championFrom(ctx, nowS, season, res[0]?.results?.[0] ?? null, !!res[1]?.results?.[0])) === player.id }),
  };
}
/**
 * THE CLOCK'S COUNT (cron.js, every minute): the season's #1 counted before a reader would count it - only once the kept
 * word is GAMBIT_CHAMPION_CLOCK_S old, and only when a rated game came since (a kept word nobody is counted again, as
 * Iliac Hand's AUDIT CARDS-6 D10 found); a season nobody played writes nothing. Answers how many it counted (0 or 1).
 * @param {{ db: any, nowS: number }} ctx
 */
export async function gambitChampionClock(ctx) {
  const season = arenaSeasonOf(ctx.nowS);
  const q = await ctx.db.prepare(`SELECT (SELECT at FROM gambit_champions WHERE season = ?1) AS kept,
      (SELECT player FROM gambit_champions WHERE season = ?1) AS player,
      (SELECT MAX(at) FROM gambit_games WHERE season = ?1 AND rated = 1) AS last`).bind(season).first();
  const kept = q?.kept == null ? null : { at: Number(q.kept), player: q.player ?? null };
  if (kept && ctx.nowS - kept.at < GAMBIT_CHAMPION_CLOCK_S) return 0;
  if (q?.last == null) return 0;
  if (kept && kept.player != null && Number(q.last) < kept.at) {
    await ctx.db.prepare('UPDATE gambit_champions SET at = ?2 WHERE season = ?1').bind(season, ctx.nowS).run();
    return 0;
  }
  await storeGambitChampion(ctx, season, ctx.nowS);
  return 1;
}

/** THE KING'S GAMBIT'S HONOURS of an account, as the token's mint reads them: `champion` - the season's #1 now. Never a
 *  guest's. */
export async function gambitHonoursOf(ctx, player, nowS) {
  if (!player?.handle) return { champion: false };
  return { champion: (await championNow(ctx, nowS)) === player.id };
}
/** The row with its honours on it - what titles.js reads (`gambit`). */
export async function withGambitHonours(ctx, player, nowS) {
  return player ? { ...player, gambit: await gambitHonoursOf(ctx, player, nowS) } : player;
}
/** MANY ROWS WITH THE KING'S GAMBIT'S HONOURS - a box's senders, a board's authors (beside Iliac Hand's). */
export async function withGambitHonoursAll(ctx, rows, nowS) {
  if (!rows.some((r) => r?.handle)) return rows;
  const champion = await championNow(ctx, nowS);
  return rows.map((r) => (r?.handle ? { ...r, gambit: { champion: champion === r.id } } : r));
}

/** What a claim answers its claimant: their seat, the result for them, their rating before and after, whether it
 *  counted, and their season now. */
async function gameAnswer(ctx, me, row) {
  const side = row.a === me ? 0 : 1;
  const result = row.result === side ? 'won' : 'lost';
  const before = side === 0 ? row.ra0 : row.rb0, after = side === 0 ? row.ra1 : row.rb1;
  return { game: row.game, side, result, how: row.how, rating: after, delta: after - before, rated: row.rated === 1, season: row.season, standing: await gambitRatingOf(ctx, me, row.season) };
}
/** May this rated game move the board's top (Iliac Hand's AUDIT CARDS-6 D12): only when no #1 is kept, the #1 is one
 *  of the two, or either reaches its rating. */
async function topMayMove(ctx, season, a, b, na, nb) {
  const kept = await ctx.db.prepare('SELECT player FROM gambit_champions WHERE season = ?1').bind(season).first();
  const top = kept?.player ?? null;
  if (!top || top === a || top === b) return true;
  const { rating } = await gambitRatingOf(ctx, top, season);
  return na >= rating || nb >= rating;
}

/**
 * A RATED GAME'S CLAIM (`/v1/gambit/claim`): the relay's receipt (net/gambit/gambitReceipt.js) for a game this account played.
 * One row a game, whichever seat carries it first; both accounts must be registered to be rated. Answers
 * `{ recorded, ... }`, a game already kept `{ recorded: false, why: 'claimed', ... }`, a guest's `{ recorded: false,
 * why: 'guest' }`, one whose other seat is no registered account `{ recorded: false, why: 'foe-unregistered' }`, or
 * `{ error }` ('no-gate-key', 'receipt', 'not-yours', 'busy').
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto }} ctx @param {any} player @param {unknown} receipt
 * @param {CryptoKey|null} publicKey the relay's
 */
export async function claimGambit(ctx, player, receipt, publicKey) {
  const { db, nowS, subtle } = ctx;
  if (!publicKey) return { error: 'no-gate-key' };
  const v = await verifyGambitReceipt(receipt, publicKey, { subtle, nowS });
  if (!v.ok) return { error: 'receipt', why: v.why };
  const c = v.claims;
  if (!c.f.includes(player.id)) return { error: 'not-yours' };
  if (!player.handle) return { recorded: false, why: 'guest' };
  const season = arenaSeasonOf(c.i);
  const [a, b] = c.f;
  const kept = await db.prepare('SELECT * FROM gambit_games WHERE game = ?1').bind(c.j).first();
  if (kept) return { recorded: false, why: 'claimed', ...(await gameAnswer(ctx, player.id, kept)) };
  const rows = (await db.prepare('SELECT id, handle FROM players WHERE id IN (?1, ?2)').bind(a, b).all()).results ?? [];
  const linked = (id) => rows.some((r) => r.id === id && r.handle);
  if (!linked(a) || !linked(b)) return { recorded: false, why: 'foe-unregistered' };
  for (let tries = 0; tries < GAMBIT_RATE_TRIES; tries++) {
    const ra = await gambitRatingOf(ctx, a, season), rb = await gambitRatingOf(ctx, b, season);
    // THE PAIR'S DAY AND SEASON: past the arena's bounds between the two, a game is kept and not counted - the day the
    // games' own (each row's `played`, its receipt's second), either side of this one's
    const pair = await db.prepare(PAIR_SQL('played > ?3 - 86400 AND played < ?3 + 86400')).bind(a, b, c.i).first();
    const pairSeason = await db.prepare(PAIR_SQL('season = ?3')).bind(a, b, season).first();
    const dayFull = Number(pair?.n ?? 0) >= ARENA_PAIR_DAY_MAX, seasonFull = Number(pairSeason?.n ?? 0) >= ARENA_PAIR_SEASON_MAX;
    const rated = !dayFull && !seasonFull;
    const [na, nb] = rated ? eloAfter(ra.rating, rb.rating, c.r === 0 ? 1 : 0) : [ra.rating, rb.rating];
    const ins = await db.prepare(`INSERT OR IGNORE INTO gambit_games (game, season, a, b, result, how, ra0, rb0, ra1, rb1, rated, played, at)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13
        WHERE ${RATING_NOW_SQL('?3')} = ?7 AND ${RATING_NOW_SQL('?4')} = ?8`)
      .bind(c.j, season, a, b, c.r, c.h, ra.rating, rb.rating, na, nb, rated ? 1 : 0, c.i, nowS).run();
    const row = await db.prepare('SELECT * FROM gambit_games WHERE game = ?1').bind(c.j).first();
    if (Number(ins?.meta?.changes ?? 0) > 0) {
      if (rated) { try { if (await topMayMove(ctx, season, a, b, na, nb)) await storeGambitChampion(ctx, season, nowS); } catch { /* the game is recorded; the #1 is counted again by its age */ } }
      // AUDIT KG II D11: a game kept and not counted says which cap held it - the pair's day, or its season
      return { recorded: true, ...(await gameAnswer(ctx, player.id, row)), ...(rated ? {} : { cap: seasonFull ? 'season' : 'day' }) };
    }
    if (row) return { recorded: false, why: 'claimed', ...(await gameAnswer(ctx, player.id, row)) };
  }
  return { error: 'busy' };
}

// ── THE BOARD ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * THE BOARD (`/v1/gambit/board`): the season (its number, day and end), its ranked rows (a top ten, the caller pinned
 * under them), its #1 and whether they wear GRANDMASTER, what the title needs, and the caller's own standing.
 * @param {{ db: any, nowS: number }} ctx @param {any} player @param {any} env
 */
export async function gambitBoardOf(ctx, player, env) {
  const { db, nowS } = ctx;
  const season = arenaSeasonOf(nowS);
  const me = player?.id ?? null;
  const all = (await db.prepare(BOARD_SQL).bind(season).all()).results ?? [];
  const champion = gambitChampionOfBoard(all);
  const ranked = all.map((r, i) => ({ player: r.player, rating: Number(r.rating), wins: Number(r.wins), losses: Number(r.losses), games: Number(r.games), rank: i + 1, you: r.player === me }));
  const shown = ranked.slice(0, GAMBIT_BOARD_TOP);
  const mine = ranked.find((r) => r.you) ?? null;
  const pinned = mine && !shown.includes(mine) ? mine : null;
  const names = await boardNamesOf(ctx, [...shown, pinned].filter(Boolean).map((r) => r.player).concat(champion ? [champion] : []), env, nowS, { gambit: (row) => ({ champion: champion === row.id }) });
  const named = (r) => (r ? { ...r, ...(names.get(r.player) ?? { name: '?', title: null, glyphs: [] }) } : null);
  return {
    ok: true,
    season: { n: season, day: arenaSeasonDay(nowS), ends: arenaSeasonEndsS(season) },
    rows: shown.map(named), pinned: named(pinned), total: ranked.length,
    champion: champion ? { player: champion, name: names.get(champion)?.name ?? '?' } : null,
    titleNeeds: { games: GAMBIT_CHAMPION_MIN_GAMES, foes: GAMBIT_CHAMPION_MIN_FOES },
    me: me ? { ...(await gambitRatingOf(ctx, me, season)), champion: champion === me } : null,
  };
}
