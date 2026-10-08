// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CHAP3a (2026-10-08, Mac: "Keep going with the arc/slices") — MERIT: what
// a member did for its chapter this week, from witnessed acts alone
// (Chapters-Arc 5.1) - its own writ for the chapter (professions.js
// deliverWrit) and a receipt in the chapter's region (npcReceipts.js
// creditReceipt). The law is src/net/npcChapterLaw.js; the record is
// migration 0094_npc_merit. CHAP3b's Turning reads the week's sums.
//
// ONE STATEMENT, IN THE ACT'S OWN BATCH. Every bound is asked by the line's
// own INSERT, so the act and its Merit stand or fall together and no race
// between two of an account's acts writes past one: the member's tenure on
// the Roll (MERIT_TENURE_S since `joined_at`), the character standing, the
// account's one chapter of a guild a week (no line of the guild's in
// another region this week), and the 600 an account a chapter a week - the
// line cut to the room left, none at all where none is. Whole Merit, rounded
// down (a bound number may be read as a REAL: the CAST, never its binding).
// ═══════════════════════════════════════════════════════════════════

import { MERIT_CAP_WEEK, MERIT_TENURE_S, meritWeekOf } from '../../src/net/npcChapterLaw.js';
import { regionChapters } from './npcHalls.js';

/**
 * THE MERIT LINE AN ACT WRITES, for the act's own batch: `{ player, character, faction, region, source, ref, nowS,
 * amountSql, guard, binds }` - the account and its realm character, the chapter (guild faction and region), the source
 * ('writ', 'gate', 'raid'), the act's own id, and the act's Merit as SQL, written only where `guard` holds. `amountSql`
 * and `guard` read `binds` from ?11 on (?1 player, ?2 character, ?3 faction, ?4 region, ?5 week, ?6 source, ?7 ref, ?8
 * now, ?9 the cap, ?10 the tenure).
 * @param {any} db
 * @param {{ player: string, character: string, faction: number, region: number, source: string, ref: string, nowS: number, amountSql: string, guard: string, binds?: unknown[] }} o
 */
export function meritStatement(db, { player, character, faction, region, source, ref, nowS, amountSql, guard, binds = [] }) {
  return db.prepare(`INSERT OR IGNORE INTO npc_chapter_merit (week, faction, region, account, char_id, source, amount, ref, at)
    SELECT ?5, ?3, ?4, ?1, ?2, ?6, got, ?7, ?8 FROM (SELECT CAST(MIN(${amountSql}, ?9 - COALESCE((SELECT SUM(amount) FROM npc_chapter_merit
        WHERE week = ?5 AND account = ?1 AND faction = ?3 AND region = ?4), 0)) AS INTEGER) AS got)
    WHERE got >= 1 AND ${guard}
      AND EXISTS (SELECT 1 FROM npc_roll WHERE char_id = ?2 AND player = ?1 AND faction_id = ?3 AND member = 1 AND joined_at <= ?8 - ?10)
      AND EXISTS (SELECT 1 FROM realm_characters WHERE id = ?2 AND player = ?1 AND dead_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM npc_chapter_merit WHERE week = ?5 AND account = ?1 AND faction = ?3 AND region <> ?4)`)
    .bind(player, character, faction, region, meritWeekOf(nowS), source, ref, nowS, MERIT_CAP_WEEK, MERIT_TENURE_S, ...binds);
}

/** The Merit lines one act of a character's stand under: `[{ f, amount }]`, by guild. */
export async function meritOfAct(/** @type {any} */ db, /** @type {string} */ character, /** @type {string} */ source, /** @type {string} */ ref) {
  const { results = [] } = await db.prepare('SELECT faction AS f, amount FROM npc_chapter_merit WHERE char_id = ?1 AND source = ?2 AND ref = ?3 ORDER BY faction')
    .bind(character, source, ref).all();
  return results.map((/** @type {any} */ r) => ({ f: Number(r.f), amount: Number(r.amount) }));
}

/**
 * THE BOARD'S MERIT for a region and the character reading it: for each guild it is a member of (`members`, its Roll's)
 * keeping a chapter here, `{ faction, merit, max, elsewhere, from }` - the account's Merit in this chapter this week, the
 * cap, whether the account's chapter of the guild this week is another region's (so this one earns it none), and when
 * the character's tenure lets it earn (null once it does).
 * @param {any} db @param {string} player @param {string} character @param {number} region @param {number} nowS @param {number[]} members
 */
export async function meritAsks(db, player, character, region, nowS, members) {
  if (!members.length) return [];
  const chapters = new Set(await regionChapters(db, region, nowS * 1000));
  const here = members.filter((f) => chapters.has(f));
  if (!here.length) return [];
  const { results: rows = [] } = await db.prepare('SELECT faction, region, SUM(amount) AS n FROM npc_chapter_merit WHERE week = ?1 AND account = ?2 GROUP BY faction, region')
    .bind(meritWeekOf(nowS), player).all();
  const { results: since = [] } = await db.prepare('SELECT faction_id, joined_at FROM npc_roll WHERE char_id = ?1 AND player = ?2 AND member = 1')
    .bind(character, player).all();
  return here.map((f) => {
    const mine = rows.filter((/** @type {any} */ r) => Number(r.faction) === f);
    const joined = since.find((/** @type {any} */ r) => Number(r.faction_id) === f)?.joined_at;
    const from = joined == null ? null : Number(joined) + MERIT_TENURE_S;
    return {
      faction: f, merit: Number(mine.find((/** @type {any} */ r) => Number(r.region) === region)?.n ?? 0), max: MERIT_CAP_WEEK,
      elsewhere: mine.some((/** @type {any} */ r) => Number(r.region) !== region), from: from !== null && from > nowS ? from : null,
    };
  });
}
