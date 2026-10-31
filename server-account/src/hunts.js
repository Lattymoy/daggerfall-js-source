// @ts-check
// HUNTERS-MARK and MARKS-OF-MASTERY (2026-10-27; a player, handed on by the owner: "Add more horizontal progression
// please!"; bible/06-Systems/Bounty-Boards.md section 12) - THE HUNT'S LEDGER, as the service keeps it, and the titles
// read off what it witnessed. The law is both ends' (src/net/huntLaw.js); the table migrations/0181_hunt_ledger.sql's.
// A CLEAR IS THE CLIENT'S WORD. The world runs on the player's machine and nothing here saw the beasts fall, so a clear
// is BOUNDED, as Renown's report is (renownTracks.js): a bounty's own shape, its day inside the event clock's window, its
// level within reach of the level the realm trusts, one row a character a notice (or a mark's week), and the account's
// UTC day under HUNT_CLEARS_DAY_MAX. Named, not closed: a modified client can report the day's ceiling, no more.
import { accountKind, overRate } from './accounts.js';
import { developerHandles } from './titles.js'; // WYRM-RIDER: a developer's tame is never a First
import { renownCharacterOk } from './renownTracks.js';
import { creditHunt } from './seatInfluence.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { seatRegionOk, seatWeekStartMs } from '../../src/net/townSeatLaw.js';
import { PROF_XP_MAX } from '../../src/net/professionLaw.js';
import {
  huntClearOf,
  huntTierFits,
  huntWeekAt,
  masteryMarksOf,
  HUNT_CLEARS_DAY_MAX,
  HUNT_RUNGS,
  HUNT_MARK_RUNG,
  HUNT_TITLES,
} from '../../src/net/huntLaw.js';

/** Reports an account may make to the ledger an hour - a hunter's, never a script's (HUNT-LEAN: the read counts none). */
export const HUNT_OPS_HOUR = 240;
/** The refusals' statuses (index.js answers the rest 400). */
export const HUNT_STATUS = Object.freeze({
  'hunt-need-account': 403,
  'hunt-rate': 429,
  'hunt-rung': 409,
  'hunt-tier': 409,
  'hunt-late': 409,
  'hunt-early': 409,
});
/** The board clears a character needs before the week's named mark is posted to it (huntLaw.js HUNT_MARK_RUNG). */
const MARK_CLEARS = HUNT_RUNGS[HUNT_MARK_RUNG].at;
const int = (v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);

/** A character's hunt and its account's, as the board and the Standing page show them. */
async function huntStateOf(db, playerId, character, nowS) {
  const week = `m.${huntWeekAt(nowS * 1000)}`;
  const [mine, regions, acct] = await db.batch([
    db
      .prepare(
        `SELECT COALESCE(SUM(kind = 'board'), 0) AS clears, COALESCE(SUM(kind = 'mark'), 0) AS marks,
      COALESCE(MAX(kind = 'mark' AND key = ?3), 0) AS done FROM hunt_clears WHERE player = ?1 AND char_id = ?2`,
      )
      .bind(playerId, character, week),
    db
      .prepare(
        `SELECT region, COUNT(*) AS n FROM hunt_clears WHERE player = ?1 AND char_id = ?2 AND kind = 'board' AND region IS NOT NULL
      GROUP BY region`,
      )
      .bind(playerId, character),
    db
      .prepare(
        `SELECT COALESCE(SUM(kind = 'board'), 0) AS clears, COALESCE(SUM(kind = 'mark'), 0) AS marks, COALESCE(SUM(day = ?2), 0) AS today
      FROM hunt_clears WHERE player = ?1`,
      )
      .bind(playerId, utcDay(nowS)),
  ]);
  const m = mine?.results?.[0] ?? {};
  const a = acct?.results?.[0] ?? {};
  return {
    clears: int(m.clears),
    marks: int(m.marks),
    markDone: int(m.done) === 1,
    regions: Object.fromEntries((regions?.results ?? []).map((r) => [int(r.region), int(r.n)])),
    // AUDIT HORIZONTAL F3: and the service's UTC day, so a book holds a day-full report until this day has turned
    account: {
      clears: int(a.clears),
      marks: int(a.marks),
      today: int(a.today),
      max: HUNT_CLEARS_DAY_MAX,
      day: utcDay(nowS),
    },
  };
}

/**
 * /v1/hunt/state - `{ character }`: `{ ok, clears, marks, markDone, regions, account }` - the character's board clears,
 * its named marks and whether this week's is cleared, its clears by the boards' region, and the account's. Or `{ error }`:
 * 'hunt-need-account', 'hunt-character'.
 * HUNT-LEAN (2026-10-29, bible/11-Multiplayer/Scale-Arc.md HUNT-LEAN): a read that writes nothing - no rate window, the
 * primary's write on every page's poll - so a D1 replica serves it (service.js REPLICA_ROUTES).
 * @param {{ db: any, nowS: number }} ctx @param {any} player @param {any} _env @param {any} body
 */
export async function huntState(ctx, player, _env, body) {
  if (accountKind(player) !== 'linked') return { error: 'hunt-need-account' };
  if (!renownCharacterOk(body?.character)) return { error: 'hunt-character' };
  return { ok: true, ...(await huntStateOf(ctx.db, player.id, body.character, ctx.nowS)) };
}

/**
 * /v1/hunt/clear - `{ character, id, region? }`: a paid bounty reported (asked of the account's seat - progress.js
 * PROGRESS_ROUTES). Recorded once - `{ ok, recorded: true, influence?, ...state }` - or answered, never refused, when it
 * earns nothing more: `repeat` (this character's already), `why: 'day-full'` (the account's day). Or `{ error }`:
 * 'hunt-id' (no bounty's shape, or a region out of law), 'hunt-late', 'hunt-early' (outside the clock's window),
 * 'hunt-tier' (past the level the realm trusts), 'hunt-rung' (a named mark before its rung), and the state's own.
 * @param {{ db: any, nowS: number }} ctx @param {any} player @param {any} env @param {any} body
 */
export async function huntClear(ctx, player, env, body) {
  if (accountKind(player) !== 'linked') return { error: 'hunt-need-account' };
  const { db, nowS } = ctx;
  const character = body?.character;
  if (!renownCharacterOk(character)) return { error: 'hunt-character' };
  const c = huntClearOf(body?.id, nowS * 1000);
  if ('why' in c) return { error: `hunt-${c.why}` };
  const region = body?.region ?? null;
  if (region !== null && !seatRegionOk(region)) return { error: 'hunt-id' };
  if (await overRate(ctx, `hunt:${player.id}`, HUNT_OPS_HOUR, 3600)) return { error: 'hunt-rate' };
  const seen = await db
    .prepare('SELECT level_seen AS lv FROM realm_characters WHERE id = ?1 AND player = ?2')
    .bind(character, player.id)
    .first();
  if (!huntTierFits(c.level, seen?.lv == null ? null : int(seen.lv))) return { error: 'hunt-tier' };
  const day = utcDay(nowS);
  // AUDIT HORIZONTAL F10: a mark's rung is the board clears recorded before its week ended - last week's mark is a
  // Stalker's of last week, never a character's that became one since (a board clear's end: none, every row counts)
  const until = c.kind === 'mark' ? seatWeekStartMs(/** @type {number} */ (c.week) + 1) / 1000 : nowS + 1;
  // THE DECISION, in the write: the account's day under its ceiling, a mark only from its rung - the row once a key
  const [ins] = await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO hunt_clears (player, char_id, kind, key, id, tier, region, day, at)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
      WHERE (SELECT COUNT(*) FROM hunt_clears WHERE player = ?1 AND day = ?8) < ?10
        AND (?3 <> 'mark' OR (SELECT COUNT(*) FROM hunt_clears WHERE player = ?1 AND char_id = ?2 AND kind = 'board' AND at < ?12) >= ?11)
      RETURNING key`,
      )
      .bind(
        player.id,
        character,
        c.kind,
        c.key,
        c.id,
        c.tier,
        region,
        day,
        nowS,
        HUNT_CLEARS_DAY_MAX,
        MARK_CLEARS,
        until,
      ),
  ]);
  const recorded = (ins?.results?.length ?? 0) > 0;
  let why = null;
  if (!recorded) {
    const had = await db
      .prepare(
        `SELECT EXISTS (SELECT 1 FROM hunt_clears WHERE player = ?1 AND char_id = ?2 AND kind = ?3 AND key = ?4) AS had,
      (SELECT COUNT(*) FROM hunt_clears WHERE player = ?1 AND char_id = ?2 AND kind = 'board' AND at < ?5) AS board`,
      )
      .bind(player.id, character, c.kind, c.key, until)
      .first();
    if (int(had?.had) === 1) why = 'repeat';
    else if (c.kind === 'mark' && int(had?.board) < MARK_CLEARS) return { error: 'hunt-rung' };
    else why = 'day-full';
  }
  // HUNTERS-MARK (Seats-Arc 4.2): a recorded clear is a seat's influence in its board's region - answered, never refused
  const influence =
    recorded && region !== null
      ? await creditHunt(ctx, player, env, { character, region, ref: `${character}:${c.key}` })
      : null;
  return {
    ok: true,
    recorded,
    ...(why ? { why } : {}),
    ...(why === 'repeat' ? { repeat: true } : {}),
    ...(influence ? { influence } : {}),
    ...(await huntStateOf(db, player.id, character, nowS)),
  };
}

// ─── MARKS-OF-MASTERY: THE TITLES, DERIVED ───────────────────────────

/** The most clears a hunt title asks (huntLaw.js HUNT_TITLES' last): a count stops there, as the titles do. */
const CLEARS_READ = HUNT_TITLES[HUNT_TITLES.length - 1][1];
/** WYRM-RIDER: an account's tamed brass and Aetherbright dragons (dragon_mounts, dragons.js's draw; look 1 the
 *  Aetherbright) and whether it holds the earliest tame of each (by its time, then its id) - a developer's never counted
 *  (as the owner asked; `devs` the parameter holding titles.js developerHandles as a JSON list). */
const FIRST_OF = (
  /** @type {string} */ look,
  /** @type {string} */ devs,
) => `(SELECT d.account FROM dragon_mounts d JOIN players p ON p.id = d.account
  WHERE ${look} AND LOWER(COALESCE(p.handle, '')) NOT IN (SELECT value FROM json_each(${devs})) ORDER BY d.at, d.id LIMIT 1)`;
const DRAGON_COUNTS_SQL = (
  /** @type {string} */ id,
  /** @type {string} */ devs,
) => `(SELECT COUNT(*) FROM dragon_mounts WHERE account = ${id} AND look <> 1) AS dragons,
  (SELECT COUNT(*) FROM dragon_mounts WHERE account = ${id} AND look = 1) AS aethers,
  (${FIRST_OF('d.look <> 1', devs)} = ${id}) AS firstTame, (${FIRST_OF('d.look = 1', devs)} = ${id}) AS firstAether`;
/** The developers' handles, as the statements bind them. */
const devsJson = (/** @type {any} */ env) => JSON.stringify([...developerHandles(env)]);
/** An account's counts the titles are read off (`?1` the account, `?2` a Master's XP, `?3` CLEARS_READ): its board clears,
 *  the serpents it helped slay (serpents.js, the relay's receipts), and each profession a living realm character of it
 *  holds at Master. AUDIT HORIZONTAL (lane F): the clears read stops at the top title's count - a mint, a wardrobe and a
 *  board row read as many rows at a year's clears as at a week's; and a Master is a realm character alive, never a track
 *  no realm row stands for (craftWrits.js ranksOf's join). */
const MASTERY_SQL = `SELECT
  (SELECT COUNT(*) FROM (SELECT 1 FROM hunt_clears WHERE player = ?1 AND kind = 'board' LIMIT ?3)) AS clears,
  (SELECT COUNT(*) FROM serpent_kills WHERE account = ?1) AS serpents,
  (SELECT GROUP_CONCAT(profession, ' ') FROM prof_tracks t WHERE t.player = ?1 AND t.xp >= ?2
    AND EXISTS (SELECT 1 FROM realm_characters r WHERE r.id = t.char_id AND r.player = ?1 AND r.dead_at IS NULL)) AS masters,
  ${DRAGON_COUNTS_SQL('?1', '?4')}`;
const countsOfRow = (/** @type {any} */ r) => ({
  clears: int(r?.clears),
  serpents: int(r?.serpents),
  masters: String(r?.masters ?? '')
    .split(' ')
    .filter(Boolean),
  dragons: int(r?.dragons),
  aethers: int(r?.aethers),
  firstTame: int(r?.firstTame) === 1,
  firstAether: int(r?.firstAether) === 1,
});
/** The counts an account's Marks of Mastery are read off - `{ clears, serpents, masters }`, one statement. */
export async function masteryCountsRead(
  /** @type {any} */ db,
  /** @type {string} */ playerId,
  /** @type {any} */ env = null,
) {
  return countsOfRow(await db.prepare(MASTERY_SQL).bind(playerId, PROF_XP_MAX, CLEARS_READ, devsJson(env)).first());
}
/** The Marks of Mastery an account holds (huntLaw.js MASTERY_MARKS), off its rows - one statement. */
export async function masteryMarksRead(
  /** @type {any} */ db,
  /** @type {string} */ playerId,
  /** @type {any} */ env = null,
) {
  return masteryMarksOf(await masteryCountsRead(db, playerId, env));
}
/** The row with its Marks of Mastery laid on it (`masteryMarks`, titles.js titlesHeld), for this request alone - a
 *  registered account's alone: a guest's clears and tracks earn it nothing. */
export async function withMasteryMarks(
  /** @type {any} */ ctx,
  /** @type {any} */ player,
  /** @type {any} */ env = ctx?.env,
) {
  if (!(typeof player?.handle === 'string' && player.handle)) return player;
  return { ...player, masteryMarks: await masteryMarksRead(ctx.db, player.id, env) };
}
/** The same counts for many accounts (a board's rows, a letter's senders), by id, in one batch - at most fifty ids a
 *  call; the clears read stops at CLEARS_READ an account, as masteryCountsRead's does. */
export async function masteryCountsAll(
  /** @type {any} */ ctx,
  /** @type {string[]} */ ids,
  /** @type {any} */ env = ctx?.env,
) {
  if (!ids.length) return new Map();
  const list = (/** @type {number} */ from) => ids.map((_, k) => `?${k + from}`).join(', ');
  const [h, s, m, d] = await ctx.db.batch([
    ctx.db
      .prepare(
        `WITH v(id) AS (VALUES ${ids.map((_, k) => `(?${k + 2})`).join(', ')}) SELECT v.id AS id,
      (SELECT COUNT(*) FROM (SELECT 1 FROM hunt_clears h WHERE h.player = v.id AND h.kind = 'board' LIMIT ?1)) AS n FROM v`,
      )
      .bind(CLEARS_READ, ...ids),
    ctx.db
      .prepare(`SELECT account AS id, COUNT(*) AS n FROM serpent_kills WHERE account IN (${list(1)}) GROUP BY account`)
      .bind(...ids),
    ctx.db
      .prepare(
        `SELECT t.player AS id, GROUP_CONCAT(t.profession, ' ') AS p FROM prof_tracks t WHERE t.xp >= ?1 AND t.player IN (${list(2)})
      AND EXISTS (SELECT 1 FROM realm_characters r WHERE r.id = t.char_id AND r.player = t.player AND r.dead_at IS NULL) GROUP BY t.player`,
      )
      .bind(PROF_XP_MAX, ...ids),
    ctx.db
      .prepare(
        `WITH v(id) AS (VALUES ${ids.map((_, k) => `(?${k + 1})`).join(', ')}) SELECT v.id AS id, ${DRAGON_COUNTS_SQL('v.id', `?${ids.length + 1}`)} FROM v`,
      )
      .bind(...ids, devsJson(env)), // WYRM-RIDER
  ]);
  const by = (/** @type {any} */ res, /** @type {string} */ col) =>
    new Map((res?.results ?? []).map((/** @type {any} */ r) => [r.id, r[col]]));
  const [hs, ss, ms] = [by(h, 'n'), by(s, 'n'), by(m, 'p')];
  const ds = new Map((d?.results ?? []).map((/** @type {any} */ r) => [r.id, r]));
  return new Map(
    ids.map((id) => [
      id,
      countsOfRow({ clears: hs.get(id), serpents: ss.get(id), masters: ms.get(id), ...ds.get(id) }),
    ]),
  );
}
/** The same marks for a board's rows (boardNames.js) and a letter's or a note's senders (letters.js, board.js). */
export async function withMasteryMarksAll(
  /** @type {any} */ ctx,
  /** @type {any[]} */ rows,
  /** @type {any} */ env = ctx?.env,
) {
  const ids = rows.filter((r) => typeof r?.handle === 'string' && r.handle).map((r) => r.id);
  if (!ids.length) return rows;
  const counts = await masteryCountsAll(ctx, ids, env);
  return rows.map((r) => (counts.has(r.id) ? { ...r, masteryMarks: masteryMarksOf(counts.get(r.id)) } : r));
}
