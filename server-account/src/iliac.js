// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CARDS10 - ILIAC HAND'S SEASON BOARD, AND THE DECK A RANKED SEAT PLAYS.
//
// bible/11-Multiplayer/Tavern-Cards.md section 6.4, DECIDED: "a ladder.
// Online wins rank a player on a season board, the Arena's way
// (11-Multiplayer/Arena.md), with a title for the top of it." Section 29.
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
// two friends trading wins climb nothing. A rating is written only while
// both ratings stand as they were read (the INSERT's own WHERE).
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
import { displayName } from './accounts.js';
import { titleWorn, glyphsOf } from './titles.js';

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
/** An account's season rating NOW as one SQL value, for a write to ask in its own WHERE (`p` the account, ?2 the season). */
const RATING_NOW_SQL = (p) => `COALESCE((SELECT CASE WHEN r BETWEEN ${ARENA_ELO_MIN} AND ${ARENA_ELO_MAX} THEN r ELSE ${ARENA_ELO_START} END
    FROM (SELECT r FROM (${MY_GAMES_SQL(p, '?2')}) ORDER BY at DESC, k DESC LIMIT 1)), ${ARENA_ELO_START})`;
/** Both sides of a season's rated games as rows - an account per row, its rating after, its result, its foe. */
const SIDES_SQL = `sides AS (
    SELECT a AS p, ra1 AS r, at, rowid AS k, CASE result WHEN 0 THEN 1 ELSE 0 END AS w, CASE result WHEN 1 THEN 1 ELSE 0 END AS l, CASE result WHEN 2 THEN 1 ELSE 0 END AS d, b AS o
      FROM iliac_games WHERE season = ?1 AND rated = 1 AND a IS NOT NULL
    UNION ALL
    SELECT b, rb1, at, rowid, CASE result WHEN 1 THEN 1 ELSE 0 END, CASE result WHEN 0 THEN 1 ELSE 0 END, CASE result WHEN 2 THEN 1 ELSE 0 END, a
      FROM iliac_games WHERE season = ?1 AND rated = 1 AND b IS NOT NULL)`;
/** The season's board: each account's rating after its last rated game and its tally, ranked - the rating, then wins,
 *  then fewer games, then the one who got there first. */
const BOARD_SQL = `WITH ${SIDES_SQL},
  last AS (SELECT p, r, at, ROW_NUMBER() OVER (PARTITION BY p ORDER BY at DESC, k DESC) AS rn FROM sides),
  tally AS (SELECT p, SUM(w) AS w, SUM(l) AS l, SUM(d) AS d, COUNT(*) AS n, COUNT(DISTINCT o) AS foes FROM sides GROUP BY p)
  SELECT last.p AS player, last.r AS rating, last.at AS at, tally.w AS wins, tally.l AS losses, tally.d AS draws, tally.n AS games, tally.foes AS foes
    FROM last JOIN tally ON tally.p = last.p WHERE last.rn = 1
    ORDER BY last.r DESC, tally.w DESC, tally.n ASC, last.at ASC, last.p ASC`;

/** An account's rating in a season and its tally - the start for one that has played nobody. */
export async function iliacRatingOf({ db }, playerId, season) {
  const t = await db.prepare(`SELECT (SELECT r FROM (${MY_GAMES_SQL('?2', '?1')}) ORDER BY at DESC, k DESC LIMIT 1) AS last,
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
/** The season's #1 as the service last counted it - counted afresh only where it never was this season or is old. */
async function championNow(ctx, nowS) {
  const season = arenaSeasonOf(nowS);
  if (_champ.season === season && nowS - _champ.at < ILIAC_CHAMPION_CACHE_S) return _champ.id;
  const kept = await ctx.db.prepare('SELECT player, at FROM iliac_champions WHERE season = ?1').bind(season).first();
  const id = kept && nowS - Number(kept.at) < ILIAC_CHAMPION_STORED_S ? kept.player ?? null : await storeIliacChampion(ctx, season, nowS);
  _champ = { season, at: nowS, id };
  return id;
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

/**
 * A RANKED GAME'S CLAIM: the relay's receipt (net/iliacReceipt.js) for a game this account played. One row a game,
 * whichever seat carries it first; both accounts must be registered to be rated. Answers `{ recorded, ... }`, a game
 * already kept `{ recorded: false, why: 'claimed', ... }`, or `{ error }` ('no-gate-key', 'receipt', 'not-yours',
 * 'busy' - carried again).
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
  if (!linked(a) || !linked(b)) return { recorded: false, why: 'guest' };
  for (let tries = 0; tries < ILIAC_RATE_TRIES; tries++) {
    const ra = await iliacRatingOf(ctx, a, season), rb = await iliacRatingOf(ctx, b, season);
    // THE PAIR'S DAY AND SEASON: past the arena's bounds between the two, a game is kept and not counted
    const pair = await db.prepare(`SELECT COUNT(*) AS n FROM iliac_games WHERE rated = 1 AND at > ?3 - 86400
        AND ((a = ?1 AND b = ?2) OR (a = ?2 AND b = ?1))`).bind(a, b, nowS).first();
    const pairSeason = await db.prepare(`SELECT COUNT(*) AS n FROM iliac_games WHERE rated = 1 AND season = ?3
        AND ((a = ?1 AND b = ?2) OR (a = ?2 AND b = ?1))`).bind(a, b, season).first();
    const rated = Number(pair?.n ?? 0) < ARENA_PAIR_DAY_MAX && Number(pairSeason?.n ?? 0) < ARENA_PAIR_SEASON_MAX;
    const [na, nb] = rated ? eloAfter(ra.rating, rb.rating, c.r === 0 ? 1 : c.r === 1 ? 0 : 0.5) : [ra.rating, rb.rating];
    const ins = await db.prepare(`INSERT OR IGNORE INTO iliac_games (game, season, a, b, result, how, ra0, rb0, ra1, rb1, rated, at)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12
        WHERE ${RATING_NOW_SQL('?3')} = ?7 AND ${RATING_NOW_SQL('?4')} = ?8`)
      .bind(c.j, season, a, b, c.r, c.h, ra.rating, rb.rating, na, nb, rated ? 1 : 0, nowS).run();
    const row = await db.prepare('SELECT * FROM iliac_games WHERE game = ?1').bind(c.j).first();
    if (Number(ins?.meta?.changes ?? 0) > 0) {
      if (rated) { try { await storeIliacChampion(ctx, season, nowS); } catch { /* the game is recorded; the #1 is counted again by its age */ } }
      return { recorded: true, ...(await gameAnswer(ctx, player.id, row)) };
    }
    if (row) return { recorded: false, why: 'claimed', ...(await gameAnswer(ctx, player.id, row)) };
  }
  return { error: 'busy' };
}

// ── THE BOARD ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Players by id, with the badge each wears now (titles.js, with the season's #1 laid on). */
async function namesOf({ db }, ids, env, nowS, champion) {
  const want = [...new Set(ids.filter(Boolean))];
  const out = new Map();
  for (let i = 0; i < want.length; i += 50) {
    const part = want.slice(i, i + 50);
    const rows = (await db.prepare(`SELECT * FROM players WHERE id IN (${part.map((_, k) => `?${k + 1}`).join(', ')})`).bind(...part).all()).results ?? [];
    for (const row of rows) {
      const withH = { ...row, iliac: { champion: champion === row.id } };
      out.set(row.id, { name: displayName(row), title: titleWorn(withH, env) ?? null, glyphs: glyphsOf(withH, env, nowS) });
    }
  }
  return out;
}

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
  const names = await namesOf(ctx, [...shown, pinned].filter(Boolean).map((r) => r.player).concat(champion ? [champion] : []), env, nowS, champion);
  const named = (r) => (r ? { ...r, ...(names.get(r.player) ?? { name: '?', title: null, glyphs: [] }) } : null);
  return {
    ok: true,
    season: { n: season, day: arenaSeasonDay(nowS), ends: arenaSeasonEndsS(nowS) },
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
