// @ts-check
// ═══════════════════════════════════════════════════════════════════
// RENOWN1 (2026-09-24) — THE RENOWN, AS THE SERVICE KEEPS IT.
//
// Mac: "What if the leveling system was something seperate unique to
// online but compatible" (src/net/renown.js carries the whole of the
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
//   ONE REPORT carries at most RENOWN_XP_REPORT_MAX.
//   ONE ACCOUNT earns at most RENOWN_XP_HOUR_MAX in a clock hour, across
//   every character it has - a second character is not a second
//   allowance. The window is spent by ONE UPDATE that also writes what
//   it credited, read back with RETURNING, so two reports in flight at
//   once each spend what is left and never the same remainder (ACC4's
//   `creditPlay` law, one column over).
//   ONE ACCOUNT holds at most RENOWN_TRACKS_MAX tracks.
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
  renownForXp, RENOWN_XP_MAX, RENOWN_XP_REPORT_MAX, RENOWN_XP_HOUR_MAX, RENOWN_TRACKS_MAX, RENOWN_NAME_MAX, renownRidOf,
} from '../../src/net/renown.js';
import { CHAR_ID_RE } from './service.js';

/** How many of an account's tracks the account card is sent, the most recently earned first. */
export const RENOWN_CARD_TRACKS = 5;

const HOUR_S = 3600;

/** A character id in the shape the saves are filed under (service.js CHAR_ID_RE) - the same id, one door. */
export const renownCharacterOk = (c) => typeof c === 'string' && CHAR_ID_RE.test(c);

/** A character's name as the card keeps it: printable, one line, bounded - or null, and the kept one stands. */
export function renownNameOf(name) {
  if (typeof name !== 'string') return null;
  const n = name.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  return n && n.length <= RENOWN_NAME_MAX ? n : null;
}

const int = (v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);

/** One character's track: `{ xp, level }`, or null when it has none (a character that has earned nothing is level 1). */
export async function renownTrackOf({ db }, playerId, charId) {
  if (!renownCharacterOk(charId)) return null;
  const row = await db.prepare('SELECT xp FROM renown_tracks WHERE player = ?1 AND char_id = ?2').bind(playerId, charId).first();
  if (!row) return null;
  const xp = int(row.xp);
  return { xp, level: renownForXp(xp) };
}

/** The account card's tracks: `[{ character, name, xp, level, updatedAt }]`, the most recently earned first. */
export async function renownTracksOf({ db }, playerId, limit = RENOWN_CARD_TRACKS) {
  const r = await db.prepare('SELECT char_id, name, xp, updated_at FROM renown_tracks WHERE player = ?1 ORDER BY updated_at DESC, char_id LIMIT ?2')
    .bind(playerId, limit).all();
  return (r?.results ?? []).map((t) => ({ character: t.char_id, name: t.name ?? null, xp: int(t.xp), level: renownForXp(int(t.xp)), updatedAt: int(t.updated_at) }));
}

/**
 * A REPORT: `player` (the session's row, never the body's word) says its
 * `character` earned `xp`, under the report id `rid` (null from a client
 * before the audit). Answers `{ character, xp, level, credited, rose,
 * max?, repeat? }` - the track after it, what the track gained (the hour
 * and the cap let through), whether the level rose, `max` once the track
 * holds the cap's total, and `repeat` when this report's id is the one
 * the track last took (it was credited then, and nothing is credited
 * now) - or `{ error }`: 'renown-character' (not a character id),
 * 'renown-xp' (not a whole number from 1 to RENOWN_XP_REPORT_MAX, or a
 * report id out of its shape), 'renown-full' (a new character past
 * RENOWN_TRACKS_MAX).
 *
 * ═══ AUDIT RENOWN1: ONE TRANSACTION ════════════════════════════════
 *
 * This was five statements, each committed alone, with the decisions
 * taken in JS from reads made before the writes - and every seam between
 * them was a finding:
 *   - SEC-1/DATA-1: the window was `renown_hour = ?`, so a report
 *     stamped with the hour BEFORE (a request that arrived at 00:59:59
 *     and whose body came after the boundary) reopened the window the
 *     report before it had just opened - 1,500,000 XP in a minute,
 *     driven through the real worker. The window now only moves
 *     forward, and a late report is charged to the window that is open.
 *   - DATA-3: the track bound was a COUNT, then an INSERT - fifty new
 *     characters reporting at once all fit under 60 (109 tracks).
 *   - DATA-4: the hour was spent, then the track grown - an error
 *     between them spent the hour for nothing; and a report whose answer
 *     was lost was sent again and credited twice.
 *   - DATA-5: what the track could still take, and whether it rose,
 *     were read before the write - two reports near the cap were both
 *     charged in full and both said `rose`.
 *   - DATA-7 (UI-10): a report the hour had spent still made a track of
 *     0 XP, which took one of the 60 places for good.
 * Now ONE `db.batch` - D1 runs a batch as one transaction, and nothing
 * else runs between its statements - whose first statement decides
 * everything in SQL, against the rows as they stand inside it, and says
 * what it decided with RETURNING; the rest carry that decision out.
 */
export async function reportRenownXp({ db, nowS }, player, { character, xp, name = null, rid = null }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('reportRenownXp needs an integer epoch-seconds clock');
  if (!renownCharacterOk(character)) return { error: 'renown-character' };
  if (!Number.isSafeInteger(xp) || xp < 1 || xp > RENOWN_XP_REPORT_MAX) return { error: 'renown-xp' };
  if (rid != null && !renownRidOf(rid)) return { error: 'renown-xp' };
  const id = rid ?? null;
  const hour = Math.floor(nowS / HOUR_S);
  const track = 'SELECT xp FROM renown_tracks WHERE player = ?1 AND char_id = ?2';
  // A REPEAT is a report whose id the track last took; REFUSED a new character past the bound. Either wants nothing.
  const repeat = `(?8 IS NOT NULL AND EXISTS (SELECT 1 FROM renown_tracks WHERE player = ?1 AND char_id = ?2 AND last_rid = ?8))`;
  const refused = `(NOT EXISTS (${track}) AND (SELECT COUNT(*) FROM renown_tracks WHERE player = ?1) >= ?7)`;
  // WHAT THE TRACK CAN STILL TAKE, read inside the transaction: a track near the cap asks the hour only for that
  const want = `CASE WHEN ${repeat} OR ${refused} THEN 0 ELSE MIN(?3, MAX(0, ?4 - COALESCE((${track}), 0))) END`;
  // WHAT THE HOUR HAS LEFT: the open window's remainder, or a whole window for an hour that has not been counted yet.
  // A report stamped with an hour ALREADY PAST (renown_hour > ?6) is charged to the open window, never given its own.
  const room = 'CASE WHEN renown_hour >= ?6 THEN MAX(0, ?5 - renown_hour_xp) ELSE ?5 END';
  const credit = `MIN(${want}, ${room})`;
  const [decided, , , after] = await db.batch([
    // THE DECISION, and THE HOUR SPENT. Every SET reads the row as it WAS (SQL's own rule), so
    // `renown_last_credit` is what this report took out of the window before `renown_hour_xp` moved.
    db.prepare(
      `UPDATE players SET
         renown_last_credit = ${credit},
         renown_hour_xp = CASE WHEN renown_hour >= ?6 THEN renown_hour_xp + ${credit} ELSE ${credit} END,
         renown_hour = MAX(renown_hour, ?6)
       WHERE id = ?1
       RETURNING renown_last_credit AS credit, (${track}) AS before, ${repeat} AS repeat, ${refused} AS refused`,
    ).bind(player.id, character, xp, RENOWN_XP_MAX, RENOWN_XP_HOUR_MAX, hour, RENOWN_TRACKS_MAX, id),
    // A TRACK THAT EXISTS grows by the credit (never past the cap's total) and is the character last played.
    db.prepare(
      `UPDATE renown_tracks SET
         xp = MIN(?3, xp + (SELECT renown_last_credit FROM players WHERE id = ?1)),
         name = COALESCE(?4, name), last_rid = COALESCE(?5, last_rid), updated_at = ?6
       WHERE player = ?1 AND char_id = ?2`,
    ).bind(player.id, character, RENOWN_XP_MAX, renownNameOf(name), id, nowS),
    // A NEW TRACK only with XP to hold, and only under the bound - asked IN the write, as saves.js putCard asks it.
    db.prepare(
      `INSERT INTO renown_tracks (player, char_id, name, xp, last_rid, created_at, updated_at)
       SELECT ?1, ?2, ?3, renown_last_credit, ?4, ?5, ?5 FROM players
       WHERE id = ?1 AND renown_last_credit > 0
         AND NOT EXISTS (SELECT 1 FROM renown_tracks WHERE player = ?1 AND char_id = ?2)
         AND (SELECT COUNT(*) FROM renown_tracks WHERE player = ?1) < ?6`,
    ).bind(player.id, character, renownNameOf(name), id, nowS, RENOWN_TRACKS_MAX),
    db.prepare(track).bind(player.id, character),
  ]);
  const d = decided?.results?.[0];
  if (!d) throw new Error('reportRenownXp: no account row to charge');   // the session named a row that is gone - a 500, never bad data
  if (Number(d.refused) === 1) return { error: 'renown-full' };
  const before = int(d.before);
  const credited = Math.max(0, int(d.credit));
  const total = int(after?.results?.[0]?.xp);
  const level = renownForXp(total);
  // `rose` against the total this report found, inside the same transaction - so two reports never both say so.
  // `max` when the track now holds the cap's total: nothing more is earned, and the client says so rather than
  // reading a credit of nothing as the hour's bound.
  return {
    character, xp: total, level, credited, rose: level > renownForXp(before),
    ...(total >= RENOWN_XP_MAX ? { max: true } : {}),
    ...(Number(d.repeat) === 1 ? { repeat: true } : {}),
  };
}
