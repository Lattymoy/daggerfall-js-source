// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ARENA4 - THE ARENA'S RECORDS, ONLINE.
//
// Mac (2026-10-02): "join a team (red and blue) and climb esclating
// tiers of opponents, or choose to matchmake for a real opponent ...
// Joining a team comes with it's own enhanced UI where you can view your
// ranking and even player leaderboards ... Being a top rank PvE fighter
// comes with it's own title. Being the #1 pvp arena player comes with
// it's own temporary title/glyph". Design: bible/11-Multiplayer/Arena.md
// "7. Online" and "6. Titles and the laurel".
//
// ═══ A ROW IS A RECEIPT ════════════════════════════════════════════
//
// Every result here was refereed by the relay and SIGNED by it
// (src/net/arenaReceipt.js). The claim verifies the signature with the
// relay's public half (the gate's own key, GATE_PUBLIC_KEY) and writes
// ONE row keyed by the bout's id - so a receipt counts once whoever
// carries it, and a bout between two players is one row whichever of
// them claims it first.
//
// ═══ THE CLIMB IS IN ORDER, IN THE WRITE ═══════════════════════════
//
// A ladder WIN is written only where it is the account's next bout:
// the won rows are only ever written in order, so their count IS the
// next bout's key (src/net/arenaLaw.js ladderKey), and the INSERT asks
// exactly that in its own WHERE. Two claims at once cannot both step,
// and no receipt for the Grand Champion lands on an account that has not
// won the thirty-nine bouts under it. A loss is kept whatever its order
// (the record counts it; the climb never reads it).
//
// ═══ EVERYTHING ELSE IS COUNTED ════════════════════════════════════
//
// The ladder an account stands on, a season's rating board, the
// banners' points and the laurel are COUNTED from the rows on each read
// - nothing is a total another row could disagree with. The titles they
// give are derived at the token's mint (titles.js, `arena` on the row):
// `grandchampion` while a Grand Champion row stands, `arenachampion` and
// the laurel while the account is the season's #1 - so the laurel passes
// to whoever takes the top and lapses by itself, with no cron.
// ═══════════════════════════════════════════════════════════════════
import { verifyArenaReceipt } from '../../src/net/arenaReceipt.js';
import {
  arenaSeasonOf, arenaSeasonEndsS, arenaSeasonDay, eloAfter, ARENA_ELO_START, arenaLadderOf, ladderKey, ARENA_BANNERS, ARENA_TEAM_POINTS,
  ARENA_TIERS, ARENA_TIER_BOUTS, ARENA_PAIR_DAY_MAX, ARENA_CHAMPION_MIN_BOUTS, arenaRatingOk, ARENA_ELO_MIN, ARENA_ELO_MAX,
  ARENA_CHAMPION_MIN_FOES, ARENA_PAIR_SEASON_MAX, ARENA_TICKET_RE, arenaNextOf, ARENA_BOUT_ID_RE, ARENA_ATTEMPT_LIFE_S,   // AUDIT ARENA-LADDER
} from '../../src/net/arenaLaw.js';
import { displayName } from './accounts.js';
import { titleWorn, glyphsOf } from './titles.js';
import { renownQuestXp } from '../../src/net/renown.js';   // ARENA4b: a bout's Renown, sized as quests are
import { reportRenownXp, renownTrackOf, renownCharacterOk } from './renownTracks.js';   // ARENA4b: credited through the renown law's own door

/** The service's doors that read a badge (a token's mint, the account's wardrobe, an equip): the arena's honours ride the
 *  row there (two reads - one an index lookup, one kept a minute). AUDIT PRE-MERGE 1003 S8: and on the rows a box's
 *  letters and a board's notes are badged from (withArenaHonoursAll - letters.js, board.js). */
export const ARENA_HONOUR_PATHS = new Set(['/v1/auth/token', '/v1/account', '/v1/account/title', '/v1/account/aura', '/v1/account/insignia', '/v1/patreon/unlink']);
/** A board's rows before the caller's own is pinned under them. */
export const ARENA_BOARD_TOP = 10;
/** The Hall of Champions' names a board carries. */
export const ARENA_HALL_MAX = 20;
/** How long the season's #1 (the laurel) is kept by a Worker before it is counted again, seconds - a token lives five
 *  minutes, so a laurel is at most six behind the board. */
export const ARENA_CHAMPION_CACHE_S = 60;
const GRAND_TIER = ARENA_TIERS - 1;

// ═══ ARENA4b (2026-10-03) - A BOUT'S RENOWN ═══════════════════════════════════════════════════════════════════════════
//
// Arena.md 2: "Purses in gold ... Online, renown too, within the renown law's own hourly cap". A ladder WIN and a rated
// WIN between players pay Renown to the character the claim names, through the renown law's own door
// (renownTracks.js reportRenownXp: the report's bound, the account's hour, the track's cap - a bout the hour has spent
// pays nothing more and is still counted), keyed by the bout's id as the report's `rid`. THE SCALE - a bout is a fight
// sized like a quest, so it pays as one (net/renown.js renownQuestXp: 75 and 30 a level at RENOWN-ACCOUNT's rate, read
// no higher than three levels over the character's Renown - RENOWN3's ceiling, so a high Daggerfall level does not blow
// through it): a ladder bout one quest at its TIER's level (the design table's top level of each tier, 3, 5, ... 21 -
// ARENA_RENOWN_TIER_LEVEL), a tier's champion two, the Grand Champion three (a raid's RENOWN_RAID_QUESTS); a rated win
// between players one quest at the ladder's top quest level, read against the winner's Renown alike. Measured: at Renown
// 30 a tier-1 bout pays 165, a tier-10 bout 705, the Grand Champion 2,115, a rated players' win 975; at Renown 1 every
// bout past the Pit pays 195 and the Grand Champion 585 - the ceiling's whole point. The most a claim asks is far under a
// report's 5,000. A loss, a draw and a bout kept unrated (the pair's day) pay none: two friends trading wins earn
// nothing on each other. ONCE AN ACCOUNT: a bout between players is one row whoever claims it first, so the winner may
// claim second - the right to its Renown is its own row (`arena_renown`, migration 0075 - 0071 before the second merge onto main, 0073 before the third), taken before the credit.

/** A ladder tier's level for its Renown - the design table's top level of each tier (Arena.md 2: 1-3, 3-5, ... 20+). */
export const ARENA_RENOWN_TIER_LEVEL = (tier) => 2 * Math.max(0, Math.min(ARENA_TIERS - 1, Math.trunc(Number(tier) || 0))) + 3;
/** How many quests a bout's win is worth: a ladder bout 1, a tier's champion 2, the Grand Champion 3, a rated players' 1. */
export const ARENA_RENOWN_QUESTS = Object.freeze({ bout: 1, champion: 2, grand: 3, pvp: 1 });
/** The quest level a rated players' win is read at - the ladder's top (net/renown.js RENOWN_QUEST_LEVEL_MAX). */
const ARENA_RENOWN_PVP_LEVEL = 30;
/** Daggerfall's region - where every bout is fought; a war-guild's influence counts its Renown there (SEAT1b). */
export const ARENA_RENOWN_REGION = 17;
/** A won bout's Renown XP at Renown `renown`: `{ kind: 'ladder', tier, step }` or `{ kind: 'pvp' }`. Pure. */
export function arenaRenownXp(bout, renown = 1) {
  if (bout?.kind === 'pvp') return ARENA_RENOWN_QUESTS.pvp * renownQuestXp(ARENA_RENOWN_PVP_LEVEL, renown);
  const q = bout?.step === ARENA_TIER_BOUTS ? (bout.tier === GRAND_TIER ? ARENA_RENOWN_QUESTS.grand : ARENA_RENOWN_QUESTS.champion) : ARENA_RENOWN_QUESTS.bout;
  return q * renownQuestXp(ARENA_RENOWN_TIER_LEVEL(bout?.tier), renown);
}
/**
 * A WON BOUT'S RENOWN, CREDITED ONCE: the bout's row in `arena_renown` taken for this account, then the report - the
 * renown law's answer (`{ character, xp, level, credited, rose, max?, repeat? }`), or null: no character named (a build
 * before ARENA4b), the bout's Renown this account's already, or the track refused (its row given back).
 */
async function arenaRenownFor(ctx, player, boutId, bout, { character = null, name = null } = {}) {
  const { db, nowS } = ctx;
  if (!renownCharacterOk(character)) return null;
  const xp = arenaRenownXp(bout, (await renownTrackOf(ctx, player.id, character))?.level ?? 1);
  if (!(xp > 0)) return null;
  const took = await db.prepare('INSERT OR IGNORE INTO arena_renown (bout, player, char_id, xp, at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(boutId, player.id, character, xp, nowS).run();
  if (!(Number(took?.meta?.changes ?? 0) > 0)) return null;
  const r = await reportRenownXp(ctx, player, { character, xp, name, rid: boutId });
  if (r.error) { await db.prepare('DELETE FROM arena_renown WHERE bout = ?1 AND player = ?2').bind(boutId, player.id).run(); return null; }
  return r;
}

/** The points a ladder win gives its banner: a bout 1, a tier's champion 3, the Grand Champion 10. */
const pvePoints = (tier, step) => (step === ARENA_TIER_BOUTS ? (tier === GRAND_TIER ? ARENA_TEAM_POINTS.grand : ARENA_TEAM_POINTS.champion) : ARENA_TEAM_POINTS.bout);
/** The SQL of the same, over a row's `tier` and `step`. */
const PVE_POINTS_SQL = `CASE WHEN step = ${ARENA_TIER_BOUTS} AND tier = ${GRAND_TIER} THEN ${ARENA_TEAM_POINTS.grand} WHEN step = ${ARENA_TIER_BOUTS} THEN ${ARENA_TEAM_POINTS.champion} ELSE ${ARENA_TEAM_POINTS.bout} END`;

// ── THE ROWS, READ ───────────────────────────────────────────────────────────────────────────
/** The account's ladder bouts won, and its ladder record (wins, losses, by how). */
export async function arenaPveOf({ db }, playerId) {
  const won = (await db.prepare('SELECT tier, step AS bout FROM arena_pve WHERE player = ?1 AND won = 1 AND voided = 0 ORDER BY tier, step').bind(playerId).all()).results ?? [];   // AUDIT ARENA-LADDER: a run a loss broke is out of the climb
  const r = await db.prepare(`SELECT SUM(won) AS wins, SUM(1 - won) AS losses, SUM(CASE WHEN won = 0 AND how = 'yield' THEN 1 ELSE 0 END) AS yields,
      SUM(CASE WHEN won = 0 AND how = 'fall' THEN 1 ELSE 0 END) AS falls, SUM(CASE WHEN won = 0 AND how = 'ringout' THEN 1 ELSE 0 END) AS ringouts
    FROM arena_pve WHERE player = ?1`).bind(playerId).first();
  const n = (v) => Number(v ?? 0) || 0;
  return { won, record: { wins: n(r?.wins), losses: n(r?.losses), yields: n(r?.yields), falls: n(r?.falls), ringouts: n(r?.ringouts) } };
}
/** The account's ladder, in the save ladder's own shape (src/net/arenaLaw.js arenaLadderOf). */
export async function arenaLadderOfAccount(ctx, playerId) {
  const { won, record } = await arenaPveOf(ctx, playerId);
  const L = arenaLadderOf(won, record);
  // AUDIT ARENA-LADDER 2: `paid` - the current tier's bouts ever won, broken runs' too (src/systems/arenaLadder.js): a bout
  // won again after a lost run is told so before it is fought (no purse, no points, no Renown - claimLadder's `repeat`)
  const p = await ctx.db.prepare(`SELECT COUNT(DISTINCT step) AS n FROM arena_pve WHERE player = ?1 AND tier = ?2 AND won = 1 AND step < ${ARENA_TIER_BOUTS}`).bind(playerId, L.tier).first();
  return { ...L, paid: Math.max(L.won ?? 0, Math.min(ARENA_TIER_BOUTS, Number(p?.n ?? 0) || 0)) };
}

/** One side's rows of a season's rated bouts between players, as a CTE - an account per row, its rating after, and
 *  whether it won, lost or drew. */
const SIDES_SQL = `sides AS (
    SELECT a AS p, ra1 AS r, at, rowid AS k, CASE result WHEN 0 THEN 1 ELSE 0 END AS w, CASE result WHEN 1 THEN 1 ELSE 0 END AS l, CASE result WHEN 2 THEN 1 ELSE 0 END AS d, b AS o
      FROM arena_pvp WHERE season = ?1 AND rated = 1 AND a IS NOT NULL
    UNION ALL
    SELECT b, rb1, at, rowid, CASE result WHEN 1 THEN 1 ELSE 0 END, CASE result WHEN 0 THEN 1 ELSE 0 END, CASE result WHEN 2 THEN 1 ELSE 0 END, a
      FROM arena_pvp WHERE season = ?1 AND rated = 1 AND b IS NOT NULL)`;   // AUDIT ARENA-LADDER O2: `o` the opponent (the laurel's distinct foes)
/** The season's board: each account's rating after its last rated bout, its wins, losses and draws, ranked - the rating
 *  first, then wins, then fewer bouts, then the one who got there first. */
const BOARD_SQL = `WITH ${SIDES_SQL},
  last AS (SELECT p, r, at, ROW_NUMBER() OVER (PARTITION BY p ORDER BY at DESC, k DESC) AS rn FROM sides),
  tally AS (SELECT p, SUM(w) AS w, SUM(l) AS l, SUM(d) AS d, COUNT(*) AS n, COUNT(DISTINCT o) AS foes FROM sides GROUP BY p)
  SELECT last.p AS player, last.r AS rating, last.at AS at, tally.w AS wins, tally.l AS losses, tally.d AS draws, tally.n AS bouts, tally.foes AS foes
    FROM last JOIN tally ON tally.p = last.p WHERE last.rn = 1
    ORDER BY last.r DESC, tally.w DESC, tally.n ASC, last.at ASC, last.p ASC`;

/** An account's rating in a season and its tally - the start for one that has fought nobody. */
export async function arenaRatingOf({ db }, playerId, season) {
  const last = await db.prepare(`SELECT CASE WHEN a = ?2 THEN ra1 ELSE rb1 END AS r FROM arena_pvp
     WHERE season = ?1 AND rated = 1 AND (a = ?2 OR b = ?2) ORDER BY at DESC, rowid DESC LIMIT 1`).bind(season, playerId).first();
  const t = await db.prepare(`SELECT SUM(CASE WHEN (a = ?2 AND result = 0) OR (b = ?2 AND result = 1) THEN 1 ELSE 0 END) AS w,
       SUM(CASE WHEN (a = ?2 AND result = 1) OR (b = ?2 AND result = 0) THEN 1 ELSE 0 END) AS l,
       SUM(CASE WHEN result = 2 THEN 1 ELSE 0 END) AS d, COUNT(*) AS n
     FROM arena_pvp WHERE season = ?1 AND rated = 1 AND (a = ?2 OR b = ?2)`).bind(season, playerId).first();
  const n = (v) => Number(v ?? 0) || 0;
  return { rating: last ? arenaRatingOk(Number(last.r)) : ARENA_ELO_START, wins: n(t?.w), losses: n(t?.l), draws: n(t?.d), bouts: n(t?.n) };
}

/** AUDIT ARENA-LADDER O2: may this board row wear the laurel - its rated bouts, against enough different foes. */
export const laurelWorthy = (r) => !!r && Number(r.bouts) >= ARENA_CHAMPION_MIN_BOUTS && Number(r.foes ?? 0) >= ARENA_CHAMPION_MIN_FOES;
/** The board's #1 when it may wear the laurel, or null: the #1 is the board's FIRST row; one short of the bouts or the
 *  foes holds the top and nobody wears the laurel over them. */
export const laurelOfBoard = (rows) => (laurelWorthy(rows?.[0]) ? rows[0].player : null);
/** The season's #1 who may wear the laurel - ARENA_CHAMPION_MIN_BOUTS rated bouts against ARENA_CHAMPION_MIN_FOES
 *  accounts at least - or null. */
export async function arenaChampionOf({ db }, season) {
  const rows = (await db.prepare(`${BOARD_SQL} LIMIT 1`).bind(season).all()).results ?? [];
  return laurelOfBoard(rows);
}
/** One Worker's word of the season's #1, kept ARENA_CHAMPION_CACHE_S. */
let _champ = { season: 0, at: -Infinity, id: null };
/** Tests: the kept #1 forgotten. */
export function _resetArenaCache() { _champ = { season: 0, at: -Infinity, id: null }; }
async function championNow(ctx, nowS) {
  const season = arenaSeasonOf(nowS);
  if (_champ.season === season && nowS - _champ.at < ARENA_CHAMPION_CACHE_S) return _champ.id;
  const id = await arenaChampionOf(ctx, season);
  _champ = { season, at: nowS, id };
  return id;
}

/**
 * THE ARENA'S HONOURS OF AN ACCOUNT, as the token's mint reads them: `grand` - a Grand Champion row stands (a title for
 * good); `champion` - the season's #1 now (the laurel, while it lasts). Never true of a guest (a guest's receipts are
 * not kept).
 * @param {{ db: any }} ctx
 */
export async function arenaHonoursOf(ctx, player, nowS) {
  if (!player?.handle) return { grand: false, champion: false };
  const g = await ctx.db.prepare(`SELECT 1 AS one FROM arena_pve WHERE player = ?1 AND tier = ${GRAND_TIER} AND step = ${ARENA_TIER_BOUTS} AND won = 1 LIMIT 1`).bind(player.id).first();
  const champion = (await championNow(ctx, nowS)) === player.id;
  return { grand: !!g, champion };
}
/** The row with its honours on it - what titles.js reads (`arena`). */
export async function withArenaHonours(ctx, player, nowS) {
  return player ? { ...player, arena: await arenaHonoursOf(ctx, player, nowS) } : player;
}
/** AUDIT PRE-MERGE 1003 S8: MANY ROWS WITH THEIR HONOURS - a box's senders, a board's authors (letters.js, board.js): the
 *  Grand Champions among them in one read a fifty, the season's #1 the Worker's minute-kept one, laid on each row as
 *  arenaHonoursOf lays it (a guest wears neither). Their badges read the rows bare, so a Grand Champion's letter and
 *  notice wore no title and the #1's no laurel. */
export async function withArenaHonoursAll(ctx, rows, nowS) {
  const ids = [...new Set(rows.filter((r) => r?.handle).map((r) => r.id))];
  if (!ids.length) return rows;
  const grands = new Set();
  for (let i = 0; i < ids.length; i += 50) {
    const part = ids.slice(i, i + 50);
    const found = (await ctx.db.prepare(`SELECT DISTINCT player FROM arena_pve WHERE tier = ${GRAND_TIER} AND step = ${ARENA_TIER_BOUTS} AND won = 1
        AND player IN (${part.map((_, k) => `?${k + 1}`).join(', ')})`).bind(...part).all()).results ?? [];
    for (const r of found) grands.add(r.player);
  }
  const champion = await championNow(ctx, nowS);
  return rows.map((r) => (r?.handle ? { ...r, arena: { grand: grands.has(r.id), champion: champion === r.id } } : r));
}

/** The account's banner row, read. */
export async function arenaMemberOf({ db }, playerId) {
  return db.prepare('SELECT banner, season, left_banner, left_season FROM arena_members WHERE player = ?1').bind(playerId).first();
}

// ── THE CLAIM ────────────────────────────────────────────────────────────────────────────────
/**
 * A BOUT'S RECEIPT, CLAIMED. Verified with the relay's public half; a ladder receipt names the claiming account, a
 * players' one names it as one of its two. Answers `{ recorded: true, ... }`, `{ recorded: false, why }` (`claimed` - this
 * bout is kept already; `guest`; `order` - a win that is not the account's next bout; AUDIT PRE-MERGE 1003 S4: `reused` -
 * its id is kept as another bout), or `{ error }` - `no-gate-key`, `receipt` (`why` the rung), `not-yours`; AUDIT
 * PRE-MERGE 1003 S6: `busy` - a players' bout whose two ratings kept moving under it, carried again later.
 * ARENA4b: `fighter` - the character the claim names (`character`, its `name` for the track) - is paid the bout's Renown
 * when the kept bout is the account's win (a ladder win, a rated players' win), once an account: the answer's `renown`.
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto }} ctx
 * @param {any} player the session's account
 * @param {unknown} receipt @param {CryptoKey|null} publicKey
 * @param {{ character?: unknown, name?: unknown }} [fighter]
 */
export async function claimArena(ctx, player, receipt, publicKey, fighter = {}) {
  const { nowS, subtle } = ctx;
  if (!publicKey) return { error: 'no-gate-key' };
  const v = await verifyArenaReceipt(receipt, publicKey, { subtle, nowS });
  if (!v.ok) return { error: 'receipt', why: v.why };
  const c = v.claims;
  if (c.a === 'l' ? c.s !== player.id : !c.f.includes(player.id)) return { error: 'not-yours' };
  if (!player.handle) return { recorded: false, why: 'guest' };
  const season = arenaSeasonOf(c.i);
  const member = await arenaMemberOf(ctx, player.id);
  const r = c.a === 'l' ? await claimLadder(ctx, player, c, season, member?.banner ?? null) : await claimPlayers(ctx, player, c, season);
  // ARENA4b: the bout kept is the caller's win - counted now, or counted before (a players' bout another claimed first)
  const won = c.a === 'l' ? (r.recorded ? r.won : r.why === 'claimed' && c.r === 1) : r.result === 'won' && r.rated === true;
  if (!won || r.repeat) return r;   // AUDIT ARENA-LADDER 2: a step won again pays no Renown
  const renown = await arenaRenownFor(ctx, player, c.z ?? c.j, c.a === 'l' ? { kind: 'ladder', tier: c.q, step: c.u } : { kind: 'pvp' }, fighter);   // AUDIT ARENA-LADDER: a ticketed bout's Renown keyed by its ticket, as its row is
  return renown ? { ...r, renown } : r;
}

/**
 * AUDIT ARENA-LADDER: A LOSS BREAKS THE TIER'S RUN (the owner's call, "Lose the tier's run") - the account's won rows of
 * the tier's three bouts, not yet broken, are `voided`: kept (the record counts them), out of the climb, which goes back
 * to the tier's first bout. A champion beaten stays beaten (its step, 3, is never voided) - AUDIT ARENA-LADDER 2: and a
 * tier whose champion is beaten has no run left to break (a late loss of it, carried after the champion fell, voided the
 * tier's bouts under a live champion row and the climb's count never met its next key again: every win after it refused
 * `order`, for good). The statement, for a batch,
 * set BEFORE the loss row's INSERT and guarded so it breaks the run once, for the first claim of its loss alone: a
 * ticketed loss while its attempt is still open (`ticket`), a loss from a relay before tickets while no row holds its
 * bout's id (`bout`) - a receipt carried twice never breaks a run won again since.
 */
const breakRun = (db, playerId, tier, { ticket = null, bout = null } = {}) => db.prepare(`UPDATE arena_pve SET voided = 1
    WHERE player = ?1 AND tier = ?2 AND step < ${ARENA_TIER_BOUTS} AND won = 1 AND voided = 0
      AND NOT EXISTS (SELECT 1 FROM arena_pve WHERE player = ?1 AND tier = ?2 AND step = ${ARENA_TIER_BOUTS} AND won = 1)
      AND ${ticket ? 'EXISTS (SELECT 1 FROM arena_attempts WHERE id = ?3 AND done = 0)' : 'NOT EXISTS (SELECT 1 FROM arena_pve WHERE bout = ?3)'}`).bind(playerId, tier, ticket ?? bout);
/** The INSERT of a ladder row, keyed `key` (the attempt's ticket, or a relay before tickets' bout id): THE ORDER IS THE
 *  WRITE'S - a win lands only while the account's won rows of the climb number exactly its step's key. */
const ladderRow = (db, key, playerId, season, c, won, banner, nowS) => db.prepare(`INSERT OR IGNORE INTO arena_pve (bout, player, season, tier, step, won, how, banner, at)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
      WHERE ?6 = 0 OR (SELECT COUNT(*) FROM arena_pve WHERE player = ?2 AND won = 1 AND voided = 0) = ?10`)
  .bind(key, playerId, season, c.q, c.u, won ? 1 : 0, c.h, banner, nowS, ladderKey(c.q, c.u));

/** AUDIT ARENA-LADDER 2: is this a step the account won before a lost run broke it - won again, it pays nothing (no
 *  banner points, no Renown): a broken run is never a purse to farm. */
const wonBefore = async (db, playerId, tier, step) => step < ARENA_TIER_BOUTS
  && !!(await db.prepare('SELECT 1 FROM arena_pve WHERE player = ?1 AND tier = ?2 AND step = ?3 AND won = 1 AND voided = 1').bind(playerId, tier, step).first());

async function claimLadder(ctx, player, c, season, banner) {
  const { db, nowS } = ctx;
  const won = c.r === 1;
  const repeat = won && await wonBefore(db, player.id, c.q, c.u);
  if (repeat) banner = null;
  // AUDIT ARENA-LADDER: A TICKETED ATTEMPT (`z`, net/arenaReceipt.js) - its row keyed by the ticket, the account's own
  // and this tier and bout's; a loss breaks the tier's run in the same write, and the attempt is done
  if (c.z !== undefined) {
    const att = await db.prepare('SELECT player, tier, step, room, at, done FROM arena_attempts WHERE id = ?1').bind(c.z).first();
    // AUDIT ARENA-LADDER 2: ONE TICKET, ONE BOUT - the receipt's bout is the room the ticket was asked for, signed within the
    // ticket's life (a second bout in that room comes a keep after the first): a ticket fought again elsewhere, or in its
    // room after the relay forgot the first, keeps nothing
    if (!att || att.player !== player.id || Number(att.tier) !== c.q || Number(att.step) !== c.u || att.room !== c.j || c.i > Number(att.at) + ARENA_ATTEMPT_LIFE_S) return { recorded: false, why: 'reused', ladder: await arenaLadderOfAccount(ctx, player.id) };
    // ...and an attempt already done (claimed, forfeit at a later ask, or its win refused out of order) records nothing more
    const was = await db.prepare('SELECT won FROM arena_pve WHERE bout = ?1').bind(c.z).first();
    if (was) return { recorded: false, why: Number(was.won) === (won ? 1 : 0) ? 'claimed' : 'forfeit', ladder: await arenaLadderOfAccount(ctx, player.id) };
    if (Number(att.done) === 1) return { recorded: false, why: 'order', ladder: await arenaLadderOfAccount(ctx, player.id) };
    const res = await db.batch([
      ...(won ? [] : [breakRun(db, player.id, c.q, { ticket: c.z })]),
      ladderRow(db, c.z, player.id, season, c, won, banner, nowS),
      db.prepare('UPDATE arena_attempts SET done = 1 WHERE id = ?1').bind(c.z),
    ]);
    const recorded = Number(res?.[won ? 0 : 1]?.meta?.changes ?? 0) > 0;
    const ladder = await arenaLadderOfAccount(ctx, player.id);
    if (!recorded) {
      // the attempt's row stands already: this claim's own (claimed before), or the forfeit a later attempt wrote
      const kept = await db.prepare('SELECT won FROM arena_pve WHERE bout = ?1').bind(c.z).first();
      return { recorded: false, why: kept ? (Number(kept.won) === (won ? 1 : 0) ? 'claimed' : 'forfeit') : 'order', ladder };
    }
    return {
      recorded: true, kind: 'ladder', won, tier: c.q, bout: c.u, how: c.h, ladder,
      points: won && banner ? pvePoints(c.q, c.u) : 0, banner, grand: won && c.q === GRAND_TIER && c.u === ARENA_TIER_BOUTS, ...(repeat ? { repeat: true } : {}),
    };
  }
  // a relay before tickets (its receipts carried for their week): keyed by the bout's id, as it was - a loss breaks the
  // run all the same
  const r = won ? await ladderRow(db, c.j, player.id, season, c, won, banner, nowS).run()
    : (await db.batch([breakRun(db, player.id, c.q, { bout: c.j }), ladderRow(db, c.j, player.id, season, c, won, banner, nowS)]))[1];
  const recorded = Number(r?.meta?.changes ?? 0) > 0;
  const ladder = await arenaLadderOfAccount(ctx, player.id);
  if (!recorded) {
    // AUDIT PRE-MERGE 1003 S4: `claimed` ONLY FOR THIS RECEIPT'S OWN ROW - the account's, this tier and step, this result.
    // A ladder room's id is its fighter's own, the relay forgets a finished bout ARENA_KEEP_MS after it and opens a new
    // one under the same id, and the hall lists every live id to anybody: a win receipt reusing a kept loss's id (or
    // anybody's bout) was answered `claimed`, and claimArena paid the receipt's own Renown - out of order, at any tier.
    // Another row under the id is `reused`: nothing kept, nothing paid.
    const kept = await db.prepare('SELECT player, tier, step, won FROM arena_pve WHERE bout = ?1').bind(c.j).first();
    const mine = !!kept && kept.player === player.id && Number(kept.tier) === c.q && Number(kept.step) === c.u && Number(kept.won) === (won ? 1 : 0);
    return { recorded: false, why: mine ? 'claimed' : kept ? 'reused' : 'order', ladder };
  }
  return {
    recorded: true, kind: 'ladder', won, tier: c.q, bout: c.u, how: c.h, ladder,
    points: won && banner ? pvePoints(c.q, c.u) : 0, banner, grand: won && c.q === GRAND_TIER && c.u === ARENA_TIER_BOUTS, ...(repeat ? { repeat: true } : {}),
  };
}

async function claimPlayers(ctx, player, c, season) {
  const { db, nowS } = ctx;
  const [a, b] = c.f;
  const kept = await db.prepare('SELECT * FROM arena_pvp WHERE bout = ?1').bind(c.j).first();
  if (kept) return { recorded: false, why: 'claimed', ...(await pvpAnswer(ctx, player.id, kept)) };
  const rows = (await db.prepare('SELECT id, handle FROM players WHERE id IN (?1, ?2)').bind(a, b).all()).results ?? [];
  const linked = (id) => rows.some((r) => r.id === id && r.handle);
  // both must be registered to be rated (the hall queues no guest; a crafted pair is kept as nothing)
  if (!linked(a) || !linked(b)) return { recorded: false, why: 'guest' };
  // AUDIT PRE-MERGE 1003 S6: THE RATINGS ARE THE WRITE'S - the INSERT lands only while both accounts' ratings still stand
  // as they were read (RATING_NOW_SQL, arenaRatingOf's own read, in its WHERE); another bout of either landing between
  // the read and the write is read again, a bounded number of times. Read, then written blind, two claims of one account
  // at once both rated off the same "before" and one change was lost - a loss raced with a win, erased.
  for (let tries = 0; tries < ARENA_RATE_TRIES; tries++) {
    const ra = await arenaRatingOf(ctx, a, season), rb = await arenaRatingOf(ctx, b, season);
    // THE PAIR'S DAY: past ARENA_PAIR_DAY_MAX rated bouts between the two in a day, a bout is kept and not counted - two
    // friends trading wins cannot climb the board on each other
    const pair = await db.prepare(`SELECT COUNT(*) AS n FROM arena_pvp WHERE rated = 1 AND at > ?3 - 86400
        AND ((a = ?1 AND b = ?2) OR (a = ?2 AND b = ?1))`).bind(a, b, nowS).first();
    // AUDIT ARENA-LADDER O2: AND THE PAIR'S SEASON - past ARENA_PAIR_SEASON_MAX rated bouts between the two this season
    const pairSeason = await db.prepare(`SELECT COUNT(*) AS n FROM arena_pvp WHERE rated = 1 AND season = ?3
        AND ((a = ?1 AND b = ?2) OR (a = ?2 AND b = ?1))`).bind(a, b, season).first();
    const rated = Number(pair?.n ?? 0) < ARENA_PAIR_DAY_MAX && Number(pairSeason?.n ?? 0) < ARENA_PAIR_SEASON_MAX;
    const [na, nb] = rated ? eloAfter(ra.rating, rb.rating, c.r === 0 ? 1 : c.r === 1 ? 0 : 0.5) : [ra.rating, rb.rating];
    const ma = await arenaMemberOf(ctx, a), mb = await arenaMemberOf(ctx, b);
    const ins = await db.prepare(`INSERT OR IGNORE INTO arena_pvp (bout, season, a, b, result, how, ra0, rb0, ra1, rb1, rated, banner_a, banner_b, at)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14
        WHERE ${RATING_NOW_SQL('?3')} = ?7 AND ${RATING_NOW_SQL('?4')} = ?8`)
      .bind(c.j, season, a, b, c.r, c.h, ra.rating, rb.rating, na, nb, rated ? 1 : 0, ma?.banner ?? null, mb?.banner ?? null, nowS).run();
    const row = await db.prepare('SELECT * FROM arena_pvp WHERE bout = ?1').bind(c.j).first();
    if (Number(ins?.meta?.changes ?? 0) > 0) return { recorded: true, kind: 'pvp', ...(await pvpAnswer(ctx, player.id, row)) };
    if (row) return { recorded: false, why: 'claimed', ...(await pvpAnswer(ctx, player.id, row)) };
  }
  return { error: 'busy' };   // the receipt is kept and carried again (net/arenaClaims.js - every error but a receipt's)
}
/** AUDIT ARENA-LADDER 2: how long a done attempt is kept (a week - a receipt's own life), then let go. */
export const ARENA_ATTEMPTS_KEEP_S = 7 * 86400;
/**
 * AUDIT ARENA-LADDER: AN ATTEMPT AT THE ACCOUNT'S NEXT LADDER BOUT - its ticket (16 hex), which the relay opens the bout
 * for and signs into its receipt (`z`). Every attempt still open is FORFEIT first: its loss row written now (`forfeit`),
 * its tier's run broken - so a bout lost and never carried here is lost all the same, and one walked away from is too.
 * The client carries every receipt it holds before it asks (scenes/arenaOnline.js), so a win it fought is counted, not
 * forfeit. `tier`/`bout` must be the account's next (`order` and the ladder otherwise - a device behind the climb).
 * A guest's attempt is minted and forfeit alike, and nothing of it is kept as a row (a guest's bouts are not counted).
 */
export async function arenaAttempt(ctx, player, tier, bout, room) {
  const { db, nowS, rand } = ctx;
  // AUDIT ARENA-LADDER 2: A GUEST CLIMBS NOTHING ONLINE - its bouts are kept as no rows, so its losses broke no run and a
  // guest's climb carried at registration was the wins alone; the ladder online takes a registered account
  if (!player.handle) return { error: 'ladder-needs-account' };
  if (!Number.isInteger(tier) || tier < 0 || tier >= ARENA_TIERS || !Number.isInteger(bout) || bout < 0 || bout > ARENA_TIER_BOUTS) return { error: 'bad-bout' };
  if (typeof room !== 'string' || !ARENA_BOUT_ID_RE.test(room)) return { error: 'bad-bout' };   // AUDIT ARENA-LADDER 2: the room it is for
  // AUDIT ARENA-LADDER 2: the done attempts of a week ago let go - nothing reads them past a receipt's life
  await db.prepare('DELETE FROM arena_attempts WHERE player = ?1 AND done = 1 AND at < ?2').bind(player.id, nowS - ARENA_ATTEMPTS_KEEP_S).run();
  const open = (await db.prepare('SELECT id, tier, step FROM arena_attempts WHERE player = ?1 AND done = 0').bind(player.id).all()).results ?? [];
  if (open.length) {
    const season = arenaSeasonOf(nowS);
    const member = await arenaMemberOf(ctx, player.id);
    const stmts = [];
    for (const a of open) {
      stmts.push(breakRun(db, player.id, Number(a.tier), { ticket: a.id }));
      stmts.push(ladderRow(db, a.id, player.id, season, { q: Number(a.tier), u: Number(a.step), h: 'forfeit' }, false, member?.banner ?? null, nowS));
      stmts.push(db.prepare('UPDATE arena_attempts SET done = 1 WHERE id = ?1').bind(a.id));
    }
    await db.batch(stmts);
  }
  const next = arenaNextOf((await arenaPveOf(ctx, player.id)).won);
  if (!next || next.tier !== tier || next.bout !== bout) return { error: 'order', ladder: await arenaLadderOfAccount(ctx, player.id), forfeits: open.length };
  const b = new Uint8Array(8);
  rand(b);
  const ticket = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  if (!ARENA_TICKET_RE.test(ticket)) return { error: 'busy' };
  // AUDIT ARENA-LADDER 2: one ticket a room (idx_arena_attempts_room) - a room already ticketed is refused
  const ins = await db.prepare('INSERT OR IGNORE INTO arena_attempts (id, player, tier, step, room, at, done) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)').bind(ticket, player.id, tier, bout, room, nowS).run();
  if (!(Number(ins?.meta?.changes ?? 0) > 0)) return { error: 'busy' };
  return { ticket, tier, bout, room, forfeits: open.length };
}

/** AUDIT PRE-MERGE 1003 S6: how many times a players' claim reads the two ratings again when a bout of either landed
 *  between its read and its write. */
export const ARENA_RATE_TRIES = 4;
/** AUDIT PRE-MERGE 1003 S6: an account's season rating NOW as one SQL value - arenaRatingOf's read (its last rated row's
 *  rating, arenaRatingOk's bounds, the start for none), `p` the account's parameter, ?2 the season - for a write to ask
 *  in its own WHERE. */
const RATING_NOW_SQL = (p) => `COALESCE((SELECT CASE WHEN r BETWEEN ${ARENA_ELO_MIN} AND ${ARENA_ELO_MAX} THEN r ELSE ${ARENA_ELO_START} END
    FROM (SELECT CASE WHEN a = ${p} THEN ra1 ELSE rb1 END AS r FROM arena_pvp WHERE season = ?2 AND rated = 1 AND (a = ${p} OR b = ${p})
      ORDER BY at DESC, rowid DESC LIMIT 1)), ${ARENA_ELO_START})`;
/** What a players' bout's claim answers its claimant: their side, the result for them, their rating before and after,
 *  whether it counted, and their season now. */
async function pvpAnswer(ctx, me, row) {
  const side = row.a === me ? 0 : 1;
  const result = row.result === 2 ? 'draw' : row.result === side ? 'won' : 'lost';
  const before = side === 0 ? row.ra0 : row.rb0, after = side === 0 ? row.ra1 : row.rb1;
  return { bout: row.bout, side, result, how: row.how, rating: after, delta: after - before, rated: row.rated === 1, season: row.season, standing: await arenaRatingOf(ctx, me, row.season) };
}

// ── THE BANNERS ──────────────────────────────────────────────────────────────────────────────
/**
 * JOIN OR QUIT A BANNER - `banner` 'red' or 'blue' to join, null to quit. Free; quitting is at once; the OTHER banner
 * is refused until the next season (`season`), the banner quit takes you back at once (systems/arenaLeague.js's law).
 * A guest joins none (`guest`); a second banner while one is worn is `joined`.
 * @param {{ db: any, nowS: number }} ctx
 */
export async function arenaTeam(ctx, player, banner) {
  const { db, nowS } = ctx;
  if (!player?.handle) return { error: 'guest' };
  if (banner !== null && !ARENA_BANNERS.includes(banner)) return { error: 'bad-banner' };
  const season = arenaSeasonOf(nowS);
  const m = await arenaMemberOf(ctx, player.id);
  if (banner === null) {
    if (!m?.banner) return { ok: true, banner: null, repeat: true };
    await db.prepare('UPDATE arena_members SET banner = NULL, left_banner = ?2, left_season = ?3, season = ?3, at = ?4 WHERE player = ?1').bind(player.id, m.banner, season, nowS).run();
    return { ok: true, banner: null, left: m.banner };
  }
  if (m?.banner === banner) return { ok: true, banner, repeat: true };
  if (m?.banner) return { error: 'joined', banner: m.banner };
  if (m?.left_banner && m.left_banner !== banner && Number(m.left_season) >= season) return { error: 'season', left: m.left_banner };
  await db.prepare(`INSERT INTO arena_members (player, banner, season, left_banner, left_season, at) VALUES (?1, ?2, ?3, NULL, NULL, ?4)
      ON CONFLICT (player) DO UPDATE SET banner = ?2, season = ?3, at = ?4`).bind(player.id, banner, season, nowS).run();
  return { ok: true, banner };
}

/** A season's points by banner, counted from the rows: ladder wins by step, rated players' wins two each. */
export async function arenaStandingsOf({ db }, season) {
  const pve = (await db.prepare(`SELECT banner, SUM(${PVE_POINTS_SQL}) AS pts FROM arena_pve WHERE season = ?1 AND won = 1 AND banner IS NOT NULL GROUP BY banner`).bind(season).all()).results ?? [];
  const pvp = (await db.prepare(`SELECT banner, SUM(n) AS n FROM (
      SELECT banner_a AS banner, COUNT(*) AS n FROM arena_pvp WHERE season = ?1 AND rated = 1 AND result = 0 AND banner_a IS NOT NULL GROUP BY banner_a
      UNION ALL SELECT banner_b, COUNT(*) FROM arena_pvp WHERE season = ?1 AND rated = 1 AND result = 1 AND banner_b IS NOT NULL GROUP BY banner_b) GROUP BY banner`).bind(season).all()).results ?? [];
  const out = { red: 0, blue: 0 };
  for (const r of pve) if (r.banner in out) out[r.banner] += Number(r.pts) || 0;
  for (const r of pvp) if (r.banner in out) out[r.banner] += (Number(r.n) || 0) * ARENA_TEAM_POINTS.pvp;
  return out;
}
/** A banner's fighters this season by the points they gave it, ranked. */
async function bannerRoster({ db }, season, banner) {
  return (await db.prepare(`SELECT p AS player, SUM(pts) AS points, SUM(w) AS wins FROM (
      SELECT player AS p, ${PVE_POINTS_SQL} AS pts, 1 AS w FROM arena_pve WHERE season = ?1 AND won = 1 AND banner = ?2
      UNION ALL SELECT a, ${ARENA_TEAM_POINTS.pvp}, 1 FROM arena_pvp WHERE season = ?1 AND rated = 1 AND result = 0 AND banner_a = ?2
      UNION ALL SELECT b, ${ARENA_TEAM_POINTS.pvp}, 1 FROM arena_pvp WHERE season = ?1 AND rated = 1 AND result = 1 AND banner_b = ?2)
    WHERE p IS NOT NULL GROUP BY p ORDER BY points DESC, wins DESC, p ASC`).bind(season, banner).all()).results ?? [];
}

// ── THE RECORDS PAGE (ARENA4b) ───────────────────────────────────────────────────────────────
/** The bouts `me.recent` carries, newest first. */
export const ARENA_RECENT_MAX = 20;
/**
 * ARENA4b: AN ACCOUNT'S BOUTS FOR THE RECORDS PAGE (Arena.md 5: "your bouts: wins, losses, yields, falls, best streak,
 * purses; the last twenty bouts"), from its own rows - the ladder's and the players' - in one shape another stream
 * renders, so it is EXACTLY this: `recent` newest first, at most ARENA_RECENT_MAX, each `{ at, kind: 'pve'|'pvp',
 * tier?, step?, won: true|false|null (null a draw), how, rating?: { before, after }, rated?, opponent?: <player id>,
 * points }` (the opponent's id is named by the board's own `named` before it goes out; a deleted account none) - the
 * points the team law's (a ladder win under a banner by its step, a rated players' win under one two, else 0) - and
 * `record` `{ pveWins, pveLosses, pvpWins, pvpLosses, pvpDraws, best }`, every bout the account has fought (a players'
 * bout kept unrated is still fought), `best` the longest run of wins over both in time order (a loss or a draw ends one).
 */
export async function arenaRecordsOf({ db }, me) {
  const pve = (await db.prepare(`SELECT tier, step, won, how, banner, at, rowid AS k FROM arena_pve WHERE player = ?1 ORDER BY at DESC, rowid DESC LIMIT ?2`)
    .bind(me, ARENA_RECENT_MAX).all()).results ?? [];
  const pvp = (await db.prepare(`SELECT a, b, result, how, ra0, rb0, ra1, rb1, rated, banner_a, banner_b, at, rowid AS k FROM arena_pvp
      WHERE a = ?1 OR b = ?1 ORDER BY at DESC, rowid DESC LIMIT ?2`).bind(me, ARENA_RECENT_MAX).all()).results ?? [];
  const rows = [
    ...pve.map((r) => ({
      at: Number(r.at), src: 0, k: Number(r.k),
      bout: { at: Number(r.at), kind: 'pve', tier: Number(r.tier), step: Number(r.step), won: r.won === 1, how: r.how, points: r.won === 1 && r.banner ? pvePoints(Number(r.tier), Number(r.step)) : 0 },
    })),
    ...pvp.map((r) => {
      const side = r.a === me ? 0 : 1;
      const won = r.result === 2 ? null : r.result === side;
      const rated = r.rated === 1;
      const banner = side === 0 ? r.banner_a : r.banner_b;
      const other = side === 0 ? r.b : r.a;
      return {
        at: Number(r.at), src: 1, k: Number(r.k),
        bout: {
          at: Number(r.at), kind: 'pvp', won, how: r.how,
          rating: { before: Number(side === 0 ? r.ra0 : r.rb0), after: Number(side === 0 ? r.ra1 : r.rb1) }, rated,
          ...(other ? { opponent: other } : {}), points: rated && won === true && banner ? ARENA_TEAM_POINTS.pvp : 0,
        },
      };
    }),
  ].sort((x, y) => y.at - x.at || y.src - x.src || y.k - x.k).slice(0, ARENA_RECENT_MAX);
  const t = await db.prepare(`SELECT
      (SELECT COALESCE(SUM(won), 0) FROM arena_pve WHERE player = ?1) AS pw, (SELECT COALESCE(SUM(1 - won), 0) FROM arena_pve WHERE player = ?1) AS pl,
      (SELECT COALESCE(SUM(CASE WHEN (a = ?1 AND result = 0) OR (b = ?1 AND result = 1) THEN 1 ELSE 0 END), 0) FROM arena_pvp WHERE a = ?1 OR b = ?1) AS vw,
      (SELECT COALESCE(SUM(CASE WHEN (a = ?1 AND result = 1) OR (b = ?1 AND result = 0) THEN 1 ELSE 0 END), 0) FROM arena_pvp WHERE a = ?1 OR b = ?1) AS vl,
      (SELECT COALESCE(SUM(CASE WHEN result = 2 THEN 1 ELSE 0 END), 0) FROM arena_pvp WHERE a = ?1 OR b = ?1) AS vd`).bind(me).first();
  // the best run: every bout in time order (the ladder's first at one second, then each table's own order), a group
  // number that steps at each bout not won - a run of wins is one group's wins
  const best = await db.prepare(`WITH fought AS (
      SELECT at, 0 AS src, rowid AS k, won AS w FROM arena_pve WHERE player = ?1
      UNION ALL SELECT at, 1, rowid, CASE WHEN (a = ?1 AND result = 0) OR (b = ?1 AND result = 1) THEN 1 ELSE 0 END FROM arena_pvp WHERE a = ?1 OR b = ?1),
    runs AS (SELECT w, SUM(1 - w) OVER (ORDER BY at, src, k ROWS UNBOUNDED PRECEDING) AS g FROM fought)
    SELECT COALESCE(MAX(n), 0) AS best FROM (SELECT COUNT(*) AS n FROM runs WHERE w = 1 GROUP BY g)`).bind(me).first();
  const n = (v) => Number(v ?? 0) || 0;
  return {
    recent: rows.map((r) => r.bout),
    record: { pveWins: n(t?.pw), pveLosses: n(t?.pl), pvpWins: n(t?.vw), pvpLosses: n(t?.vl), pvpDraws: n(t?.vd), best: n(best?.best) },
  };
}

// ── THE BOARD ────────────────────────────────────────────────────────────────────────────────
/** Players by id, with the badge each wears now (titles.js, with its arena honours). */
async function namesOf({ db }, ids, env, nowS, honours) {
  const want = [...new Set(ids.filter(Boolean))];
  const out = new Map();
  for (let i = 0; i < want.length; i += 50) {
    const part = want.slice(i, i + 50);
    const rows = (await db.prepare(`SELECT * FROM players WHERE id IN (${part.map((_, k) => `?${k + 1}`).join(', ')})`).bind(...part).all()).results ?? [];
    for (const row of rows) {
      const withH = { ...row, arena: { grand: honours.grands.has(row.id), champion: honours.champion === row.id } };
      out.set(row.id, { name: displayName(row), title: titleWorn(withH, env) ?? null, glyphs: glyphsOf(withH, env, nowS) });
    }
  }
  return out;
}
/** The ranked rows cut to the top and the caller's own pinned under them when it is not among them. */
function topWithMe(rows, me, top = ARENA_BOARD_TOP) {
  rows.forEach((r, i) => { r.rank = i + 1; r.you = r.player === me; });
  const shown = rows.slice(0, top);
  const mine = rows.find((r) => r.you) ?? null;
  return { rows: shown, pinned: mine && !shown.includes(mine) ? mine : null, total: rows.length };
}

/**
 * THE BOARD (`/v1/arena/board`): the season (its number, day and end), the PvP board (the season's ratings, its #1 and
 * whether they wear the laurel), the PvE board (the climb, every account's highest bout won), the fastest Grand
 * Champions, the banners (this season's points, last season's winner - the laurel - and the caller's banner's top ten),
 * the Hall of Champions, and the caller's own (`me`: their ladder, rating, banner and points). Each board a top ten and
 * the caller pinned under it.
 * @param {{ db: any, nowS: number }} ctx
 */
export async function arenaBoardOf(ctx, player, env) {
  const { db, nowS } = ctx;
  const season = arenaSeasonOf(nowS);
  const me = player?.id ?? null;
  // the honours every badge on the board reads: the Grand Champions, and the season's #1
  const grandRows = (await db.prepare(`SELECT player, MIN(at) AS at FROM arena_pve WHERE tier = ${GRAND_TIER} AND step = ${ARENA_TIER_BOUTS} AND won = 1 GROUP BY player ORDER BY at DESC`).all()).results ?? [];
  const pvpAll = (await db.prepare(BOARD_SQL).bind(season).all()).results ?? [];
  const champion = laurelOfBoard(pvpAll);   // AUDIT ARENA-LADDER O2: the one law (bouts and foes)
  const honours = { grands: new Set(grandRows.map((r) => r.player)), champion };
  // the climb: each account's wins in order (the won rows' count is the bout it reached), its record, its first and last
  // AUDIT ARENA-LADDER: the bout reached is the climb's - its won rows a loss did not break (`voided`)
  const pveAll = (await db.prepare(`SELECT player, SUM(CASE WHEN won = 1 AND voided = 0 THEN 1 ELSE 0 END) AS reached, SUM(1 - won) AS losses, MIN(at) AS first, MAX(CASE WHEN won = 1 AND voided = 0 THEN at END) AS last
      FROM arena_pve GROUP BY player HAVING reached > 0 ORDER BY reached DESC, last ASC, player ASC`).all()).results ?? [];
  const fastAll = (await db.prepare(`SELECT g.player AS player, g.at AS at, (SELECT MIN(at) FROM arena_pve f WHERE f.player = g.player) AS first
      FROM (SELECT player, MIN(at) AS at FROM arena_pve WHERE tier = ${GRAND_TIER} AND step = ${ARENA_TIER_BOUTS} AND won = 1 GROUP BY player) g`).all()).results ?? [];
  const fast = fastAll.map((r) => ({ player: r.player, days: Math.max(1, Math.ceil((Number(r.at) - Number(r.first)) / 86400)), at: Number(r.at) }))
    .sort((x, y) => x.days - y.days || x.at - y.at || (x.player < y.player ? -1 : 1));
  const standings = await arenaStandingsOf(ctx, season);
  const last = season > 1 ? await arenaStandingsOf(ctx, season - 1) : { red: 0, blue: 0 };
  const laurel = last.red > last.blue ? 'red' : last.blue > last.red ? 'blue' : null;
  const member = me ? await arenaMemberOf(ctx, me) : null;
  const banner = member?.banner ?? null;
  const rosters = { red: await bannerRoster(ctx, season, 'red'), blue: await bannerRoster(ctx, season, 'blue') };
  const roster = banner ? rosters[banner] : [];
  const counts = (await db.prepare('SELECT banner, COUNT(*) AS n FROM arena_members WHERE banner IS NOT NULL GROUP BY banner').all()).results ?? [];
  const pvp = topWithMe(pvpAll.map((r) => ({ player: r.player, rating: Number(r.rating), wins: Number(r.wins), losses: Number(r.losses), draws: Number(r.draws), bouts: Number(r.bouts) })), me);
  const pve = topWithMe(pveAll.map((r) => ({ player: r.player, reached: Number(r.reached), losses: Number(r.losses), grand: honours.grands.has(r.player) })), me);
  const fastB = topWithMe(fast, me);
  const teams = Object.fromEntries(ARENA_BANNERS.map((b) => [b, topWithMe(rosters[b].map((r) => ({ player: r.player, points: Number(r.points), wins: Number(r.wins), banner: b })), me)]));
  const hall = grandRows.slice(0, ARENA_HALL_MAX).map((r) => ({ player: r.player, at: Number(r.at) }));
  const records = me ? await arenaRecordsOf(ctx, me) : null;   // ARENA4b: the Records page's bouts and tallies
  const ids = [...pvp.rows, pvp.pinned, ...pve.rows, pve.pinned, ...fastB.rows, fastB.pinned, ...teams.red.rows, teams.red.pinned, ...teams.blue.rows, teams.blue.pinned, ...hall, champion ? { player: champion } : null,
    ...(records?.recent ?? []).map((b) => (b.opponent ? { player: b.opponent } : null))].filter(Boolean).map((r) => r.player);
  const names = await namesOf(ctx, ids, env, nowS, honours);
  // an account's id stays the service's: a row says its name, its badge and whether it is the caller's
  const named = (r) => { if (!r) return null; const { player: id, ...rest } = r; return { ...rest, ...(names.get(id) ?? { name: '', title: null, glyphs: [] }) }; };
  const board = (b) => ({ rows: b.rows.map(named), pinned: named(b.pinned), total: b.total });
  const mine = me ? {
    ladder: await arenaLadderOfAccount(ctx, me),
    pvp: await arenaRatingOf(ctx, me, season),
    rank: pvp.rows.concat(pvp.pinned ? [pvp.pinned] : []).find((r) => r.you)?.rank ?? null,
    banner, left: member?.left_banner ?? null, leftSeason: member?.left_season ?? null,
    points: banner ? (roster.find((r) => r.player === me) ? Number(roster.find((r) => r.player === me).points) : 0) : 0,
    grand: honours.grands.has(me), champion: champion === me,
    // ARENA4b: the Records page - the last twenty bouts (an opponent by name and badge, never by id) and the tallies
    recent: records.recent.map((b) => (b.opponent ? { ...b, opponent: names.get(b.opponent) ?? { name: '', title: null, glyphs: [] } } : b)),
    record: records.record,
  } : null;
  return {
    season, day: arenaSeasonDay(nowS), endsAt: arenaSeasonEndsS(season),
    pvp: board(pvp), pve: board(pve), fast: board(fastB),
    champion: champion ? named({ player: champion }) : null,
    team: { standings, last: { season: season - 1, ...last, winner: laurel }, laurel, members: Object.fromEntries(ARENA_BANNERS.map((b) => [b, Number(counts.find((c) => c.banner === b)?.n ?? 0)])), rosters: { red: board(teams.red), blue: board(teams.blue) } },
    hall: hall.map(named),
    me: mine,
  };
}
