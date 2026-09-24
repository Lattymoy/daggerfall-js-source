// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ADV1 (2026-09-24) — THE ADVENTURING LEVEL, AS THE SERVICE KEEPS IT.
//
// Mac: "What if the leveling system was something seperate unique to
// online but compatible" (src/net/advLevel.js carries the whole of the
// law and Mac's answers; this file is where the track is kept).
//
// ONE TRACK A CHARACTER (migration 0009), keyed by the id the
// character's own save carries, so a track follows its character and
// never rides in the save.
//
// ═══ WHOSE WORD, AND WHAT BOUNDS IT ════════════════════════════════
//
// A report says "this character earned N" and nothing can check a kill,
// so the bounds are the service's:
//
//   ONE REPORT carries at most ADV_XP_REPORT_MAX.
//   ONE ACCOUNT earns at most ADV_XP_HOUR_MAX in a clock hour, across
//   every character it has - a second character is not a second
//   allowance. The window is spent by ONE UPDATE that also writes what
//   it credited, read back with RETURNING, so two reports in flight at
//   once each spend what is left and never the same remainder (ACC4's
//   `creditPlay` law, one column over).
//   ONE ACCOUNT holds at most ADV_TRACKS_MAX tracks.
//
// A report the hour has already spent is credited 0 and answered, not
// refused: the fighting happened, it simply earns nothing more this
// hour, and the client says so rather than retrying.
//
// THE LEVEL IS NEVER STORED. It is derived from the total by the curve
// both ends share, here and at the token's mint alike, so a level over
// somebody's head and the total on their card cannot disagree.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════

import {
  advLevelForXp, ADV_XP_MAX, ADV_XP_REPORT_MAX, ADV_XP_HOUR_MAX, ADV_TRACKS_MAX, ADV_NAME_MAX,
} from '../../src/net/advLevel.js';
import { CHAR_ID_RE } from './service.js';

/** How many of an account's tracks the account card is sent, the most recently earned first. */
export const ADV_CARD_TRACKS = 5;

const HOUR_S = 3600;

/** A character id in the shape the saves are filed under (service.js CHAR_ID_RE) - the same id, one door. */
export const advCharacterOk = (c) => typeof c === 'string' && CHAR_ID_RE.test(c);

/** A character's name as the card keeps it: printable, one line, bounded - or null, and the kept one stands. */
export function advNameOf(name) {
  if (typeof name !== 'string') return null;
  const n = name.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  return n && n.length <= ADV_NAME_MAX ? n : null;
}

const int = (v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);

/** One character's track: `{ xp, level }`, or null when it has none (a character that has earned nothing is level 1). */
export async function advTrackOf({ db }, playerId, charId) {
  if (!advCharacterOk(charId)) return null;
  const row = await db.prepare('SELECT xp FROM adv_tracks WHERE player = ?1 AND char_id = ?2').bind(playerId, charId).first();
  if (!row) return null;
  const xp = int(row.xp);
  return { xp, level: advLevelForXp(xp) };
}

/** The account card's tracks: `[{ character, name, xp, level, updatedAt }]`, the most recently earned first. */
export async function advTracksOf({ db }, playerId, limit = ADV_CARD_TRACKS) {
  const r = await db.prepare('SELECT char_id, name, xp, updated_at FROM adv_tracks WHERE player = ?1 ORDER BY updated_at DESC, char_id LIMIT ?2')
    .bind(playerId, limit).all();
  return (r?.results ?? []).map((t) => ({ character: t.char_id, name: t.name ?? null, xp: int(t.xp), level: advLevelForXp(int(t.xp)), updatedAt: int(t.updated_at) }));
}

/**
 * A REPORT: `player` (the session's row, never the body's word) says its
 * `character` earned `xp`. Answers `{ character, xp, level, credited,
 * rose, max? }` - the track after it, what the track gained (the hour and
 * the cap let through), whether the level rose, and `max` once the track
 * holds the cap's total - or `{ error }`: 'adv-character' (not a character id),
 * 'adv-xp' (not a whole number from 1 to ADV_XP_REPORT_MAX), 'adv-full'
 * (a new character past ADV_TRACKS_MAX).
 */
export async function reportAdvXp({ db, nowS }, player, { character, xp, name = null }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('reportAdvXp needs an integer epoch-seconds clock');
  if (!advCharacterOk(character)) return { error: 'adv-character' };
  if (!Number.isSafeInteger(xp) || xp < 1 || xp > ADV_XP_REPORT_MAX) return { error: 'adv-xp' };
  const known = await db.prepare('SELECT xp FROM adv_tracks WHERE player = ?1 AND char_id = ?2').bind(player.id, character).first();
  if (!known) {
    const n = await db.prepare('SELECT COUNT(*) AS n FROM adv_tracks WHERE player = ?1').bind(player.id).first();
    if (int(n?.n) >= ADV_TRACKS_MAX) return { error: 'adv-full' };
  }
  const before = known ? int(known.xp) : 0;
  // A TRACK AT THE CAP EARNS NOTHING MORE, and spends none of the hour on it - it is only the character last played.
  if (before >= ADV_XP_MAX) {
    await db.prepare('UPDATE adv_tracks SET name = COALESCE(?3, name), updated_at = ?4 WHERE player = ?1 AND char_id = ?2')
      .bind(player.id, character, advNameOf(name), nowS).run();
    return { character, xp: before, level: advLevelForXp(before), credited: 0, rose: false, max: true };
  }
  // A TRACK NEAR THE CAP asks the hour only for what it can still take, so the hour is never spent on XP no track keeps
  const want = Math.min(xp, ADV_XP_MAX - before);
  // THE HOUR, SPENT IN ONE STATEMENT. Every SET reads the row as it WAS
  // (SQL's own rule), so `adv_last_credit` is what this report took out
  // of the window before `adv_hour_xp` moved - and SQLite runs one
  // UPDATE at a time, so a second report reads the window this one left.
  const hour = Math.floor(nowS / HOUR_S);
  const spent = await db.prepare(
    `UPDATE players SET
       adv_last_credit = CASE WHEN adv_hour = ?2 THEN MIN(?3, MAX(0, ?4 - adv_hour_xp)) ELSE MIN(?3, ?4) END,
       adv_hour_xp = CASE WHEN adv_hour = ?2 THEN MIN(?4, adv_hour_xp + ?3) ELSE MIN(?4, ?3) END,
       adv_hour = ?2
     WHERE id = ?1
     RETURNING adv_last_credit AS credit`,
  ).bind(player.id, hour, want, ADV_XP_HOUR_MAX).first();
  const credited = Math.max(0, int(spent?.credit));
  // THE TRACK, made or grown in one statement, and never past the cap's total.
  const row = await db.prepare(
    `INSERT INTO adv_tracks (player, char_id, name, xp, created_at, updated_at)
     VALUES (?1, ?2, ?3, MIN(?4, ?5), ?6, ?6)
     ON CONFLICT (player, char_id) DO UPDATE SET
       xp = MIN(?5, adv_tracks.xp + excluded.xp),
       name = COALESCE(excluded.name, adv_tracks.name),
       updated_at = excluded.updated_at
     RETURNING xp`,
  ).bind(player.id, character, advNameOf(name), credited, ADV_XP_MAX, nowS).first();
  const total = int(row?.xp);
  const level = advLevelForXp(total);
  // `rose` against the total this report found: two reports racing may both say so, and each only mints an order.
  // `max` when the track now holds the cap's total: nothing more is earned, and the client says so rather than
  // reading a credit of nothing as the hour's bound.
  return { character, xp: total, level, credited, rose: level > advLevelForXp(before), ...(total >= ADV_XP_MAX ? { max: true } : {}) };
}
