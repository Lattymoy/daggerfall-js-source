// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CARDS10 - ILIAC HAND'S SEASON BOARD, AND THE DECK A RANKED SEAT PLAYS.
//
// bible/11-Multiplayer/Tavern-Cards.md section 6.4, DECIDED: "a ladder.
// Online wins rank a player on a season board, the Arena's way
// (11-Multiplayer/Arena.md), with a title for the top of it." Section 33 (AUDIT CARDS-6 lane D: it said 29, a number two merges stale).
//
// ═══ THE DECK IS VOUCHED FOR (/v1/cards/deck) ═══════════════════════
//
// A deck the client names is a deck the client chose. A ranked seat's
// deck is one the account's realm character HOLDS - every card of it,
// read off the record as its tab last checkpointed it (the tab
// checkpoints first) - and the answer is this service's order on it
// (net/identityToken.js mintDeckOrder: the deck's digest, a minute's
// life), which the relay checks before it seats the deck ranked. Any other
// seat is a friendly one; an offline character plays for nothing here.
//
// ═══ A ROW IS A RECEIPT (/v1/iliac/claim) ═══════════════════════════
//
// The arena players' bouts' law (arena.js claimPlayers), for a card
// game: the relay's signed result (net/iliacReceipt.js i1) is ONE row
// keyed by the game's id, whichever of the two accounts carries it first;
// the Elo the arena's (arenaLaw.js eloAfter), its season the arena's
// (arenaSeasonOf), a pair's day and season capped as the arena's are - so
// two friends trading wins climb at most ARENA_PAIR_SEASON_MAX games' worth a
// season (AUDIT CARDS-6 D4: this said "climb nothing", and five accounts
// losing on purpose inside the caps take the top and the title in two days -
// the arena's law, kept; a guard against it is a design question). A rating
// is written only while both ratings stand as they were read (the INSERT's
// own WHERE), "the rating now" an account's last row WRITTEN (AUDIT CARDS-6
// D1: see RATING_NOW_SQL).
//
// ═══ THE TITLE IS DERIVED (titles.js) ═══════════════════════════════
//
// `iliacchampion` while the account is the season's #1 with enough
// games against enough foes - counted on the rows, kept for every Worker
// in iliac_champions, laid on the row as `iliac` at the doors that read a
// badge (ILIAC_HONOUR_PATHS, the arena's own), and lapsing by itself when
// another takes the top.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
// ═══════════════════════════════════════════════════════════════════
import { verifyIliacReceipt } from '../../src/net/iliacReceipt.js';
import { mintDeckOrder, deckDigest } from '../../src/net/identityToken.js';
import { arenaSeasonOf, arenaSeasonEndsS, arenaSeasonDay, eloAfter, ARENA_ELO_START, ARENA_ELO_MIN, ARENA_ELO_MAX, arenaRatingOk, ARENA_PAIR_DAY_MAX, ARENA_PAIR_SEASON_MAX } from '../../src/net/arenaLaw.js';
import { deckShortOf } from '../../src/net/cardWorthLaw.js';
import { deckValid } from '../../src/net/iliacHand.js';   // the rules' own deck law (iliacHand.js imports cardLaw.js, dice.js and iliacCards.js - the bundle's already)
import { realmActFirst, getRealmBlob, realmSaveTextOf } from './realm.js';
import { boardNamesOf } from './boardNames.js';   // AUDIT CARDS-6 D3: a board's names wear every honour, the arena's too

/** MEASURE (CARDS10): the games and the different foes the season's #1 must have played to wear the title - the
 *  arena's laurel's bounds (arenaLaw.js ARENA_CHAMPION_MIN_BOUTS, ARENA_CHAMPION_MIN_FOES), a card game's own. */
export const ILIAC_CHAMPION_MIN_GAMES = 10;
export const ILIAC_CHAMPION_MIN_FOES = 5;
/** A board's rows before the caller's own is pinned under them. */
export const ILIAC_BOARD_TOP = 10;
/** How long one Worker keeps its word of the season's #1, and how old the stored one may be before it is counted again
 *  (the arena's: arena.js ARENA_CHAMPION_CACHE_S, ARENA_CHAMPION_STORED_S). */
export const ILIAC_CHAMPION_CACHE_S = 60;
export const ILIAC_CHAMPION_STORED_S = 600;
/** The service's clock counts the season's #1 again once the kept word is this old (cron.js, the arena's clock's law:
 *  arena.js ARENA_CHAMPION_CLOCK_S) - so a reader finds it kept, counts nothing and writes nothing. */
export const ILIAC_CHAMPION_CLOCK_S = ILIAC_CHAMPION_STORED_S - 120;
/** How many times a claim reads the two ratings again when a game of either landed between its read and its write. */
export const ILIAC_RATE_TRIES = 4;

// ── THE DECK ORDER ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A RANKED SEAT'S DECK: `{ character, realm, deck }` - the thirty ids the seat will play, every one held by the realm
 * character (`realm` where its record stands). Answers `{ ok, order, digest }` or `{ error }`: 'cards-realm' (not a
 * realm character - an offline one plays friendly), 'cards-closed' (no key to sign with), 'bad-deck' (the law refuses
 * it), 'deck-short' with the card it lacks.
 * @param {any} ctx @param {any} player @param {any} env @param {any} body @param {CryptoKey|null} signingKey
 */
export async function deckOrderOf(ctx, player, env, { character, realm = null, deck } = {}, signingKey = null) {
  const { db, nowS, subtle } = ctx;
  if (!player?.handle) return { error: 'ranked-needs-account' };
  const side = await realmActFirst(db, player.id, character, realm);
  if (side.error) return side;
  if (!side.at) return { error: 'cards-realm' };
  if (!signingKey) return { error: 'cards-closed' };
  if (!Array.isArray(deck) || !deck.every((x) => typeof x === 'string') || deckValid(deck) !== null) return { error: 'bad-deck' };
  const blob = await getRealmBlob(ctx, player.id, side.at.id);
  if (blob.error) return blob;
  let save = null;
  try { save = JSON.parse(await realmSaveTextOf(blob.object)); } catch { save = null; }
  if (!save || typeof save !== 'object' || Array.isArray(save)) return { error: 'no-data' };
  const short = deckShortOf(save, deck);
  if (short) return { error: 'deck-short', card: short };
  const digest = await deckDigest(deck, { subtle });
  return { ok: true, digest, order: await mintDeckOrder({ s: player.id, dh: digest }, signingKey, { subtle, nowS }) };
}

// ── THE GAMES ────────────────────────────────────────────────────────────────────────────────────────────────────

/** One account's rated games of a season, read off its own side of each (an indexed read a side). `p` the account's
 *  parameter, `s` the season's. A row whose two sides are one account is read once, from `a`. */
const MY_GAMES_SQL = (p, s) => `SELECT ra1 AS r, at, rowid AS k, CASE result WHEN 0 THEN 1 ELSE 0 END AS w, CASE result WHEN 1 THEN 1 ELSE 0 END AS l, CASE result WHEN 2 THEN 1 ELSE 0 END AS d
      FROM iliac_games WHERE a = ${p} AND season = ${s} AND rated = 1
    UNION ALL
    SELECT rb1, at, rowid, CASE result WHEN 1 THEN 1 ELSE 0 END, CASE result WHEN 0 THEN 1 ELSE 0 END, CASE result WHEN 2 THEN 1 ELSE 0 END
      FROM iliac_games WHERE b = ${p} AND season = ${s} AND rated = 1 AND a IS NOT ${p}`;
/** An account's season rating NOW as one SQL value, for a write to ask in its own WHERE (`p` the account, ?2 the season).
 *  AUDIT CARDS-6 D1: NOW IS THE LAST ROW WRITTEN - `k`, the rowid, alone. It was the greatest (`at`, rowid), and `at` is
 *  the second a claim's REQUEST began (index.js reads the clock once): a claim begun in second T that lands after one of
 *  the same account begun in T+1 read T+1's row as the rating it moved, passed this guard, and wrote its own row at T -
 *  under the row it chained from, so the account's rating was read off T+1's again and the later-landed game's change
 *  was lost (a loss of 17, gone). The rowid is the order the rows were written in, which this guard already serialises
 *  (every row chains from the one written last), and no row is ever deleted (an account's sides go NULL). */
const RATING_NOW_SQL = (p) => `COALESCE((SELECT CASE WHEN r BETWEEN ${ARENA_ELO_MIN} AND ${ARENA_ELO_MAX} THEN r ELSE ${ARENA_ELO_START} END
    FROM (SELECT r FROM (${MY_GAMES_SQL(p, '?2')}) ORDER BY k DESC LIMIT 1)), ${ARENA_ELO_START})`;
/** AUDIT CARDS-6 D12: A PAIR'S RATED GAMES (`?1` and `?2` its two accounts, `when` the rows' further bound) - its two
 *  seatings, each one lookup on idx_iliac_games_pair. As one `(a = ?1 AND b = ?2) OR (a = ?2 AND b = ?1)` the planner
 *  took the season's index and walked every game of the season (5.5 ms of a claim over 50,000, unanalysed); a game an
 *  account played against itself is one row, counted once. */
const PAIR_SQL = (when) => `SELECT (SELECT COUNT(*) FROM iliac_games WHERE a = ?1 AND b = ?2 AND rated = 1 AND ${when})
    + (SELECT COUNT(*) FROM iliac_games WHERE a = ?2 AND b = ?1 AND ?1 IS NOT ?2 AND rated = 1 AND ${when}) AS n`;
/** Both sides of a season's rated games as rows - an account per row, its rating after, its result, its foe. */
const SIDES_SQL = `sides AS (
    SELECT a AS p, ra1 AS r, at, rowid AS k, CASE result WHEN 0 THEN 1 ELSE 0 END AS w, CASE result WHEN 1 THEN 1 ELSE 0 END AS l, CASE result WHEN 2 THEN 1 ELSE 0 END AS d, b AS o
      FROM iliac_games WHERE season = ?1 AND rated = 1 AND a IS NOT NULL
    UNION ALL
    SELECT b, rb1, at, rowid, CASE result WHEN 1 THEN 1 ELSE 0 END, CASE result WHEN 0 THEN 1 ELSE 0 END, CASE result WHEN 2 THEN 1 ELSE 0 END, a
      FROM iliac_games WHERE season = ?1 AND rated = 1 AND b IS NOT NULL)`;
/** The season's board: each account's rating after its last rated game and its tally, ranked - the rating, then wins,
 *  then fewer games, then the one who got there first. The last game the last WRITTEN (AUDIT CARDS-6 D1, RATING_NOW_SQL). */
const BOARD_SQL = `WITH ${SIDES_SQL},
  last AS (SELECT p, r, at, ROW_NUMBER() OVER (PARTITION BY p ORDER BY k DESC) AS rn FROM sides),
  tally AS (SELECT p, SUM(w) AS w, SUM(l) AS l, SUM(d) AS d, COUNT(*) AS n, COUNT(DISTINCT o) AS foes FROM sides GROUP BY p)
  SELECT last.p AS player, last.r AS rating, last.at AS at, tally.w AS wins, tally.l AS losses, tally.d AS draws, tally.n AS games, tally.foes AS foes
    FROM last JOIN tally ON tally.p = last.p WHERE last.rn = 1
    ORDER BY last.r DESC, tally.w DESC, tally.n ASC, last.at ASC, last.p ASC`;

/** An account's rating in a season and its tally - the start for one that has played nobody. Its rating the last row
 *  written (AUDIT CARDS-6 D1, RATING_NOW_SQL). */
export async function iliacRatingOf({ db }, playerId, season) {
  const t = await db.prepare(`SELECT (SELECT r FROM (${MY_GAMES_SQL('?2', '?1')}) ORDER BY k DESC LIMIT 1) AS last,
       SUM(w) AS w, SUM(l) AS l, SUM(d) AS d, COUNT(*) AS n FROM (${MY_GAMES_SQL('?2', '?1')})`).bind(season, playerId).first();
  const n = (v) => Number(v ?? 0) || 0;
  return { rating: t?.last != null ? arenaRatingOk(Number(t.last)) : ARENA_ELO_START, wins: n(t?.w), losses: n(t?.l), draws: n(t?.d), games: n(t?.n) };
}

/** May this board row wear the title - its rated games, against enough different foes. */
export const iliacTitleWorthy = (r) => !!r && Number(r.games) >= ILIAC_CHAMPION_MIN_GAMES && Number(r.foes ?? 0) >= ILIAC_CHAMPION_MIN_FOES;
/** The board's #1 when they may wear the title, or null - the FIRST row only: one short holds the top and nobody wears it. */
export const iliacChampionOfBoard = (rows) => (iliacTitleWorthy(rows?.[0]) ? rows[0].player : null);
/** The season's #1 who may wear the title, or null. */
export async function iliacChampionOf({ db }, season) {
  const rows = (await db.prepare(`${BOARD_SQL} LIMIT 1`).bind(season).all()).results ?? [];
  return iliacChampionOfBoard(rows);
}
/** One Worker's word of the season's #1, kept ILIAC_CHAMPION_CACHE_S. */
let _champ = { season: 0, at: -Infinity, id: null };
/** Tests: the kept #1 forgotten. */
export function _resetIliacCache() { _champ = { season: 0, at: -Infinity, id: null }; }
/** The board's top counted and kept (iliac_champions), for every Worker. Answers the #1 (or null). */
export async function storeIliacChampion(ctx, season, nowS) {
  const id = await iliacChampionOf(ctx, season);
  await ctx.db.prepare(`INSERT INTO iliac_champions (season, player, at) VALUES (?1, ?2, ?3)
    ON CONFLICT (season) DO UPDATE SET player = excluded.player, at = excluded.at`).bind(season, id, nowS).run();
  _champ = { season, at: nowS, id };
  return id;
}
/** Whether the season has a rated game - a season nobody played counts no board and writes nothing (STORM-SHED 2's
 *  law: a token's mint, an account's read, a board's badges read the kept word, and the board is counted only when a
 *  rated game moved it). */
const seasonPlayed = async ({ db }, season) => !!(await db.prepare('SELECT 1 AS one FROM iliac_games WHERE season = ?1 AND rated = 1 LIMIT 1').bind(season).first());
/** The season's #1 as the service last counted it - counted afresh only where it never was this season or is old, and
 *  only when the season has a rated game at all. */
async function championNow(ctx, nowS) {
  const season = arenaSeasonOf(nowS);
  if (_champ.season === season && nowS - _champ.at < ILIAC_CHAMPION_CACHE_S) return _champ.id;
  const kept = await ctx.db.prepare('SELECT player, at FROM iliac_champions WHERE season = ?1').bind(season).first();
  const id = kept && nowS - Number(kept.at) < ILIAC_CHAMPION_STORED_S ? kept.player ?? null : (await seasonPlayed(ctx, season)) ? await storeIliacChampion(ctx, season, nowS) : null;
  _champ = { season, at: nowS, id };
  return id;
}
/**
 * THE CLOCK'S COUNT (cron.js, every minute): the season's #1 counted before a reader would count it - only once the kept
 * word is ILIAC_CHAMPION_CLOCK_S old, and only when a rated game came since (a kept word no game is newer than is
 * stamped again, never counted - unless it names nobody: AUDIT CARDS-6 D10); a season nobody played writes nothing.
 * Answers how many it counted (0 or 1).
 * @param {{ db: any, nowS: number }} ctx
 */
export async function iliacChampionClock(ctx) {
  const season = arenaSeasonOf(ctx.nowS);
  // ONE question a quiet minute (AUDIT SCALE D7's law): the kept word's age and the season's last rated game together
  const q = await ctx.db.prepare(`SELECT (SELECT at FROM iliac_champions WHERE season = ?1) AS kept,
      (SELECT player FROM iliac_champions WHERE season = ?1) AS player,
      (SELECT MAX(at) FROM iliac_games WHERE season = ?1 AND rated = 1) AS last`).bind(season).first();
  const kept = q?.kept == null ? null : { at: Number(q.kept), player: q.player ?? null };
  if (kept && ctx.nowS - kept.at < ILIAC_CHAMPION_CLOCK_S) return 0;
  const last = { at: q?.last ?? null };
  if (last.at == null) return 0;
  // AUDIT CARDS-6 D10: A KEPT WORD OF NOBODY IS COUNTED AGAIN, NOT STAMPED. The champion's account deleted, its kept word
  // goes NULL (the foreign key's SET NULL), and stamped by its age it stood NULL until some rated game came - an hour of
  // clock runs on, the board named the next #1 and the title's door refused them. A NULL cannot tell that from a top not
  // yet worthy, so a played season whose word is nobody is counted once each ILIAC_CHAMPION_CLOCK_S - one count, not one
  // a minute.
  if (kept && kept.player != null && Number(last.at) < kept.at) {
    await ctx.db.prepare('UPDATE iliac_champions SET at = ?2 WHERE season = ?1').bind(season, ctx.nowS).run();
    return 0;
  }
  await storeIliacChampion(ctx, season, ctx.nowS);
  return 1;
}

/** ILIAC HAND'S HONOURS of an account, as the token's mint reads them: `champion` - the season's #1 now. Never a guest's. */
export async function iliacHonoursOf(ctx, player, nowS) {
  if (!player?.handle) return { champion: false };
  return { champion: (await championNow(ctx, nowS)) === player.id };
}
/** The row with its honours on it - what titles.js reads (`iliac`). */
export async function withIliacHonours(ctx, player, nowS) {
  return player ? { ...player, iliac: await iliacHonoursOf(ctx, player, nowS) } : player;
}

/** What a claim answers its claimant: their seat, the result for them, their rating before and after, whether it
 *  counted, and their season now. */
async function gameAnswer(ctx, me, row) {
  const side = row.a === me ? 0 : 1;
  const result = row.result === 2 ? 'draw' : row.result === side ? 'won' : 'lost';
  const before = side === 0 ? row.ra0 : row.rb0, after = side === 0 ? row.ra1 : row.rb1;
  return { game: row.game, side, result, how: row.how, rating: after, delta: after - before, rated: row.rated === 1, season: row.season, standing: await iliacRatingOf(ctx, me, row.season) };
}

/** AUDIT CARDS-6 D12: MAY THIS RATED GAME MOVE THE BOARD'S TOP? Every rated claim counted the season's whole board
 *  (BOARD_SQL, storeIliacChampion - 268 ms of a claim's 273 over 50,000 games) for a #1 most games cannot touch. A game
 *  between `a` and `b` moves their two rows alone: while the kept #1 is somebody else and both end the game below that
 *  #1's rating now, the board's first row is the same account with the same tally (no account's rating is over the
 *  first row's) - the same #1, the same title. Anything else is counted: no #1 kept (none yet, none worthy, one
 *  deleted), the #1 one of the two, either reaching its rating. A kept word that was already wrong is no worse for the
 *  skip: the minute clock counts it again once it is ILIAC_CHAMPION_CLOCK_S old, a rated game since (iliacChampionClock). */
async function topMayMove(ctx, season, a, b, na, nb) {
  const kept = await ctx.db.prepare('SELECT player FROM iliac_champions WHERE season = ?1').bind(season).first();
  const top = kept?.player ?? null;
  if (!top || top === a || top === b) return true;
  const { rating } = await iliacRatingOf(ctx, top, season);
  return na >= rating || nb >= rating;
}

/**
 * A RANKED GAME'S CLAIM: the relay's receipt (net/iliacReceipt.js) for a game this account played. One row a game,
 * whichever seat carries it first; both accounts must be registered to be rated. Answers `{ recorded, ... }`, a game
 * already kept `{ recorded: false, why: 'claimed', ... }`, a guest's `{ recorded: false, why: 'guest' }` (registering
 * mends it), one whose OTHER seat is no registered account `{ recorded: false, why: 'foe-unregistered' }` (nothing
 * mends it - AUDIT CARDS-6 D11), or `{ error }` ('no-gate-key', 'receipt', 'not-yours', 'busy' - carried again).
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto }} ctx @param {any} player @param {unknown} receipt
 * @param {CryptoKey|null} publicKey the relay's
 */
export async function claimIliac(ctx, player, receipt, publicKey) {
  const { db, nowS, subtle } = ctx;
  if (!publicKey) return { error: 'no-gate-key' };
  const v = await verifyIliacReceipt(receipt, publicKey, { subtle, nowS });
  if (!v.ok) return { error: 'receipt', why: v.why };
  const c = v.claims;
  if (!c.f.includes(player.id)) return { error: 'not-yours' };
  if (!player.handle) return { recorded: false, why: 'guest' };
  const season = arenaSeasonOf(c.i);
  const [a, b] = c.f;
  const kept = await db.prepare('SELECT * FROM iliac_games WHERE game = ?1').bind(c.j).first();
  if (kept) return { recorded: false, why: 'claimed', ...(await gameAnswer(ctx, player.id, kept)) };
  const rows = (await db.prepare('SELECT id, handle FROM players WHERE id IN (?1, ?2)').bind(a, b).all()).results ?? [];
  const linked = (id) => rows.some((r) => r.id === id && r.handle);
  // AUDIT CARDS-6 D11: the claimant is registered (above), so a side unregistered here is the OTHER seat's - an account
  // since deleted (a ranked seat's deck order takes a registered account): `guest` told a registered player to register
  // and kept the receipt a week, offered every five minutes, for a game nothing can rate
  if (!linked(a) || !linked(b)) return { recorded: false, why: 'foe-unregistered' };
  for (let tries = 0; tries < ILIAC_RATE_TRIES; tries++) {
    const ra = await iliacRatingOf(ctx, a, season), rb = await iliacRatingOf(ctx, b, season);
    // THE PAIR'S DAY AND SEASON: past the arena's bounds between the two, a game is kept and not counted. AUDIT CARDS-6
    // D5: the day is the GAMES' - each row's `played`, its receipt's own second, within a day either side of this one's -
    // where `at > now - 86400` read the claims' clock: ten games played in an hour, their receipts held and carried five
    // a day, were all counted. Either side, since a receipt held back is carried after the games that followed it.
    const pair = await db.prepare(PAIR_SQL('played > ?3 - 86400 AND played < ?3 + 86400')).bind(a, b, c.i).first();
    const pairSeason = await db.prepare(PAIR_SQL('season = ?3')).bind(a, b, season).first();
    const rated = Number(pair?.n ?? 0) < ARENA_PAIR_DAY_MAX && Number(pairSeason?.n ?? 0) < ARENA_PAIR_SEASON_MAX;
    const [na, nb] = rated ? eloAfter(ra.rating, rb.rating, c.r === 0 ? 1 : c.r === 1 ? 0 : 0.5) : [ra.rating, rb.rating];
    const ins = await db.prepare(`INSERT OR IGNORE INTO iliac_games (game, season, a, b, result, how, ra0, rb0, ra1, rb1, rated, played, at)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13
        WHERE ${RATING_NOW_SQL('?3')} = ?7 AND ${RATING_NOW_SQL('?4')} = ?8`)
      .bind(c.j, season, a, b, c.r, c.h, ra.rating, rb.rating, na, nb, rated ? 1 : 0, c.i, nowS).run();
    const row = await db.prepare('SELECT * FROM iliac_games WHERE game = ?1').bind(c.j).first();
    if (Number(ins?.meta?.changes ?? 0) > 0) {
      // AUDIT CARDS-6 D12: counted only when this game may move the top (topMayMove)
      if (rated) { try { if (await topMayMove(ctx, season, a, b, na, nb)) await storeIliacChampion(ctx, season, nowS); } catch { /* the game is recorded; the #1 is counted again by its age */ } }
      return { recorded: true, ...(await gameAnswer(ctx, player.id, row)) };
    }
    if (row) return { recorded: false, why: 'claimed', ...(await gameAnswer(ctx, player.id, row)) };
  }
  return { error: 'busy' };
}

// ── THE BOARD ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * THE BOARD (`/v1/iliac/board`): the season (its number, day and end), its ranked rows (a top ten, the caller pinned
 * under them), its #1 and whether they wear the title, and the caller's own standing.
 * @param {{ db: any, nowS: number }} ctx @param {any} player @param {any} env
 */
export async function iliacBoardOf(ctx, player, env) {
  const { db, nowS } = ctx;
  const season = arenaSeasonOf(nowS);
  const me = player?.id ?? null;
  const all = (await db.prepare(BOARD_SQL).bind(season).all()).results ?? [];
  const champion = iliacChampionOfBoard(all);
  const ranked = all.map((r, i) => ({ player: r.player, rating: Number(r.rating), wins: Number(r.wins), losses: Number(r.losses), draws: Number(r.draws), games: Number(r.games), rank: i + 1, you: r.player === me }));
  const shown = ranked.slice(0, ILIAC_BOARD_TOP);
  const mine = ranked.find((r) => r.you) ?? null;
  const pinned = mine && !shown.includes(mine) ? mine : null;
  // AUDIT CARDS-6 D3: the badges every honour's (boardNames.js) - the season's #1 this board counted, the arena's as a
  // letter's are; it laid its own alone, and the arena's #1 here wore neither its title nor its laurel
  const names = await boardNamesOf(ctx, [...shown, pinned].filter(Boolean).map((r) => r.player).concat(champion ? [champion] : []), env, nowS, { iliac: (row) => ({ champion: champion === row.id }) });
  const named = (r) => (r ? { ...r, ...(names.get(r.player) ?? { name: '?', title: null, glyphs: [] }) } : null);
  return {
    ok: true,
    season: { n: season, day: arenaSeasonDay(nowS), ends: arenaSeasonEndsS(season) },   // AUDIT CARDS-6 D6: the season's end (it was handed the clock, and said the year 275760)
    rows: shown.map(named), pinned: named(pinned), total: ranked.length,
    champion: champion ? { player: champion, name: names.get(champion)?.name ?? '?' } : null,
    titleNeeds: { games: ILIAC_CHAMPION_MIN_GAMES, foes: ILIAC_CHAMPION_MIN_FOES },
    me: me ? { ...(await iliacRatingOf(ctx, me, season)), champion: champion === me } : null,
  };
}
/** MANY ROWS WITH ILIAC HAND'S HONOURS - a box's senders, a board's authors (letters.js, board.js, beside the arena's
 *  withArenaHonoursAll): the season's #1 the Worker's minute-kept one, laid on each registered row as `iliac`. */
export async function withIliacHonoursAll(ctx, rows, nowS) {
  if (!rows.some((r) => r?.handle)) return rows;
  const champion = await championNow(ctx, nowS);
  return rows.map((r) => (r?.handle ? { ...r, iliac: { champion: champion === r.id } } : r));
}
