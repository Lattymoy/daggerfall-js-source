// @ts-check
// ═════════════════════════════════════════════════════════════════════
// NOTICE1 (2026-09-28) - THE NOTICE BOARD'S SERVICE: a town's notes, who
// may pin one, and the server's notices.
//
// Mac: "The new notice board should be a physical object that houses
// quests, the player auction house, etc" (bible/06-Systems/
// Professions-Arc.md 10, PROF0). What a note is - its words, its days,
// its button, every bound - is src/net/boardLaw.js, which the client's
// window reads too; this file is who may do what with one.
//
// ═══ READING IS FOR EVERYONE THE SWITCH LETS IN; PINNING IS REGISTERED ═
//
// A guest reads a board as anyone does. A guest cannot pin: a note must
// come from someone a reader can write back to and a moderator's mute can
// reach - MAIL1's law for a letter (letters.js), a note being a letter
// pinned up. A mute stops a pin, and HIDES the author's notes while it
// stands: a flood muted is a flood gone from every board at once.
//
// ═══ ONE STATEMENT DECIDES ═══════════════════════════════════════════
//
// An account's live notes are bounded (NOTES_LIVE_MAX) inside the INSERT
// that writes one, so two pins racing for the last place cannot both
// land (GUILD1's and MARKS1's law). (author, rid) makes a pin asked twice
// - its answer lost - one note: the service answers the note it made.
//
// ═══ REPORTS, AND WHO DECIDES ════════════════════════════════════════
//
// Any registered reader may report a note once; the reporter stops
// seeing it at once, and NOTE_REPORTS_HIDE reporters - each neither
// muted nor a sprout (AUDIT 28 N3) - hide it from everyone but its
// author until a moderator either removes it (the row goes) or restores
// it (reports no longer hide it). Its author still sees it, marked, and
// may take it down (AUDIT 28 N2: hidden from them too, it held one of
// their places for up to a week with nothing to take down). Moderators - MODERATOR_HANDLES
// and DEVELOPER_HANDLES, titles.js canModerate - see hidden notes, with
// their count, and may remove any note. The developers post the server's
// notices (the red seal), on every board.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═════════════════════════════════════════════════════════════════════
import { mintId, accountKind, displayName, isMuted, overRate } from './accounts.js';
import { isDeveloper, canModerate, titleWorn, glyphsShown, SPROUT_S } from './titles.js';
import { withArenaHonoursAll } from './arena.js';   // AUDIT PRE-MERGE 1003 S8: the arena's honours on an author's badge
import { guildActorOf } from './guilds.js';
import { heraldryOfRow } from './halls.js';   // GUILD1e: a recruitment note's guild's banner
import { guildMay } from '../../src/net/guildLaw.js';
import {
  NOTES_LIVE_MAX, NOTE_DAY_S, BOARD_NOTES_SHOWN, BOARD_NOTICES_SHOWN, NOTES_PINNED_MAX, BOARD_OPS_MAX, BOARD_WINDOW_S,
  NOTE_REPORTS_HIDE, NOTE_ID_RE, BOARD_RID_RE, boardSwitchOf, boardKeyOk, noteWords, noticeWords,
} from '../../src/net/boardLaw.js';

/** Whether the board is open to this account: the switch, and at `dev` the developers alone. */
export function boardOpenFor(player, env) {
  const s = boardSwitchOf(env?.BOARD_OPEN);
  return s === 'on' || (s === 'dev' && isDeveloper(player, env));
}

/** The author's badge as the service would sign it NOW (letters.js's rule): a title worn only while held. */
const badgeOf = (row, env, nowS) => (row ? { title: titleWorn(row, env) ?? null, glyphs: glyphsShown(row, env, nowS) } : { title: null, glyphs: [] });

/** The expired rows, gone - on the board's own reads, a bounded sweep (PROF0 20: "notes deleted on expiry"). */
async function sweep(db, nowS) {
  await db.prepare('DELETE FROM board_notes WHERE id IN (SELECT id FROM board_notes WHERE expires_at <= ? LIMIT 200)').bind(nowS).run();
  await db.prepare('DELETE FROM board_notices WHERE id IN (SELECT id FROM board_notices WHERE expires_at <= ? LIMIT 50)').bind(nowS).run();
}

/** Whether a recruitment note still recruits: its guild stands, and the author's character is still in it at a rank
 *  that may invite (AUDIT 28 N4 - NOTE_ROW's join). */
const recruits = (n) => !!n.guild_name && n.author_rank != null && guildMay(Number(n.author_rank), 'invite');

/** A note as a reader sees it. `mod` adds what a moderator needs to decide; the author's own note says when reports
 *  have hidden it from everyone else. */
function noteView(n, row, env, nowS, { mine = false, mod = false, reports = 0 } = {}) {
  const guildOk = recruits(n);
  return {
    id: n.id, from: n.author_name, ...badgeOf(row, env, nowS), subject: n.subject, body: n.body,
    // a recruitment note whose guild is gone - or whose author can no longer invite to it - keeps its words and loses
    // its button and its seal (0026_board.sql)
    button: n.button === 'guild' && !guildOk ? null : (n.button ?? null),
    // GUILD1e: and its banner - the Guilds tab hangs a recruitment note as its guild's poster (PROF0 10.1)
    ...(guildOk ? { guild: { name: n.guild_name, tag: n.guild_tag, heraldry: heraldryOfRow(n.guild_heraldry) } } : {}),
    at: n.at, expiresAt: n.expires_at, mine,
    ...(mod ? { hidden: n.hidden === 1, restored: n.hidden === 2, reports } : mine && n.hidden === 1 ? { hidden: true } : {}),
  };
}

/**
 * A TOWN'S BOARD, as this reader sees it: the server's notices and the players' notes, newest first - a muted author's
 * and a note the reader reported left out, and a note hidden by reports left out unless the reader moderates. With
 * the reader's own standing: may they pin, how many notes they have up, and whether they moderate.
 * @param {{db: any, nowS: number}} ctx
 * @param {any} reader the session's player row
 * @param {any} env
 * @param {unknown} map the town's map id
 */
export async function readBoard({ db, nowS }, reader, env, map) {
  if (!boardOpenFor(reader, env)) return { error: 'board-closed' };
  const mapId = Number(map);
  if (!boardKeyOk(mapId)) return { error: 'bad-board' };
  await sweep(db, nowS);
  const mod = canModerate(reader, env);
  // the author's own notes always (AUDIT 28 N2: muted or hidden, they still hold the author's places)
  const { results: notes = [] } = await db.prepare(`SELECT n.*, g.name AS guild_name, g.tag AS guild_tag, g.heraldry AS guild_heraldry, gm.rank AS author_rank,
      (SELECT COUNT(*) FROM board_reports r WHERE r.note_id = n.id) AS reports
    FROM board_notes n JOIN players p ON p.id = n.author LEFT JOIN guilds g ON g.id = n.guild_id
      LEFT JOIN guild_members gm ON gm.player = n.author AND gm.char_id = n.char_id AND gm.guild_id = n.guild_id
    WHERE n.map_id = ?1 AND n.expires_at > ?2
      AND (COALESCE(p.muted_until, 0) <= ?2 OR ?3 = 1 OR n.author = ?4)
      AND (n.hidden <> 1 OR ?3 = 1 OR n.author = ?4)
      AND NOT EXISTS (SELECT 1 FROM board_reports r WHERE r.note_id = n.id AND r.reporter = ?4)
    ORDER BY n.at DESC, n.id DESC LIMIT ?5`)
    .bind(mapId, nowS, mod ? 1 : 0, reader.id, BOARD_NOTES_SHOWN).all();
  const { results: notices = [] } = await db.prepare('SELECT * FROM board_notices WHERE expires_at > ? ORDER BY at DESC, id DESC LIMIT ?')
    .bind(nowS, BOARD_NOTICES_SHOWN).all();
  const authors = [...new Set(notes.map((n) => n.author))];
  const rows = new Map();
  if (authors.length) {
    const { results: found = [] } = await db.prepare(`SELECT * FROM players WHERE id IN (${authors.map(() => '?').join(', ')})`).bind(...authors).all();
    for (const p of await withArenaHonoursAll({ db }, found, nowS)) rows.set(p.id, p);   // AUDIT PRE-MERGE 1003 S8: the Grand Champion's title, the #1's laurel
  }
  const live = await liveCount(db, reader.id, nowS);
  return {
    map: mapId,
    notices: notices.map((x) => ({ id: x.id, from: x.author_name, subject: x.subject, body: x.body, at: x.at, expiresAt: x.expires_at })),
    notes: notes.map((n) => noteView(n, rows.get(n.author), env, nowS, { mine: n.author === reader.id, mod, reports: Number(n.reports ?? 0) })),
    me: {
      canPin: accountKind(reader) === 'linked' && !isMuted(reader, nowS),
      muted: isMuted(reader, nowS),
      live, max: NOTES_LIVE_MAX, moderator: mod, developer: isDeveloper(reader, env),
    },
  };
}

/** A note's row with its guild's name and tag and its author's rank in it now (a recruitment note's), for every answer
 *  that shows one. */
const NOTE_ROW = `SELECT n.*, g.name AS guild_name, g.tag AS guild_tag, g.heraldry AS guild_heraldry, gm.rank AS author_rank FROM board_notes n
  LEFT JOIN guilds g ON g.id = n.guild_id LEFT JOIN guild_members gm ON gm.player = n.author AND gm.char_id = n.char_id AND gm.guild_id = n.guild_id`;

/** An account's live notes, on every board. */
async function liveCount(db, author, nowS) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM board_notes WHERE author = ? AND expires_at > ?').bind(author, nowS).first();
  return Number(r?.n ?? 0);
}

/** The shared wall every write walks through first: registered, the switch, not muted. */
function gate(player, env, nowS) {
  if (accountKind(player) !== 'linked') return { error: 'board-need-account' };
  if (!boardOpenFor(player, env)) return { error: 'board-closed' };
  if (isMuted(player, nowS)) return { error: 'muted' };
  return null;
}

/**
 * PIN A NOTE to a town's board: its words (boardLaw noteWords - MAIL1's letter law), its days and its one button, the
 * author's hour spent, and the row written only while the author has room (NOTES_LIVE_MAX) - in ONE statement. A pin
 * asked again with the same `rid` answers the note it made (`repeat`), never a second one. A recruitment note names
 * the guild of the author's `character`, and only a rank that may invite (GUILD_POWERS.invite) pins one - the reader's
 * answer is a letter asking for exactly that invitation.
 * @param {{db: any, rand: (b: Uint8Array) => void, nowS: number}} ctx
 */
export async function pinNote({ db, rand, nowS }, author, env, { map, subject, body, days, button, rid, character } = {}) {
  const shut = gate(author, env, nowS);
  if (shut) return shut;
  const mapId = Number(map);
  if (!boardKeyOk(mapId)) return { error: 'bad-board' };
  if (typeof rid !== 'string' || !BOARD_RID_RE.test(rid)) return { error: 'board-rid' };
  const prior = await db.prepare(`${NOTE_ROW} WHERE n.author = ? AND n.rid = ?`).bind(author.id, rid).first();
  if (prior) return { ok: true, repeat: true, note: noteView(prior, author, env, nowS, { mine: true }) };
  const words = noteWords({ subject, body, days, button });
  if ('error' in words) return words;
  let guildId = null;
  if (words.button === 'guild') {
    const a = await guildActorOf(db, author, character);
    if ('error' in a) return { error: a.error === 'no-guild' || a.error === 'guild-character' ? 'note-no-guild' : a.error };
    if (!guildMay(a.me.rank, 'invite')) return { error: 'guild-rank' };
    guildId = a.me.guild_id;
  }
  if (await overRate({ db, nowS }, `board-pin:${author.id}`, NOTES_PINNED_MAX, BOARD_WINDOW_S)) return { error: 'board-rate' };
  const id = mintId(rand);
  const expires = nowS + words.days * NOTE_DAY_S;
  let r;
  try {
    r = await db.prepare(`INSERT INTO board_notes (id, map_id, author, author_name, subject, body, button, guild_id, char_id, at, expires_at, rid)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM board_notes WHERE author = ? AND expires_at > ?) < ?`)
      .bind(id, mapId, author.id, displayName(author), words.subject, words.body, words.button, guildId, guildId ? character : null, nowS, expires, rid, author.id, nowS, NOTES_LIVE_MAX).run();
  } catch (e) {
    // (author, rid) taken by a twin that raced this one - answered below as the note it made. AUDIT 28 N8: that clash
    // ALONE; anything else is the service's fault (500), which the client asks again with the same id - never
    // `notes-full`, which it believes and gives up on
    if (!/UNIQUE/i.test(String(/** @type {any} */ (e)?.message ?? e))) throw e;
    r = null;
  }
  if (!r?.meta?.changes) {
    const again = await db.prepare(`${NOTE_ROW} WHERE n.author = ? AND n.rid = ?`).bind(author.id, rid).first();
    if (again) return { ok: true, repeat: true, note: noteView(again, author, env, nowS, { mine: true }) };
    return { error: 'notes-full' };
  }
  const note = await db.prepare(`${NOTE_ROW} WHERE n.id = ?`).bind(id).first();
  return { ok: true, note: noteView(note, author, env, nowS, { mine: true }), live: await liveCount(db, author.id, nowS) };
}

/** TAKE ONE'S OWN NOTE DOWN. `no-note` for an id that is not the author's, whether or not it is anybody's. */
export async function takeDownNote({ db, nowS }, author, env, id) {
  if (accountKind(author) !== 'linked') return { error: 'board-need-account' };
  if (typeof id !== 'string' || !NOTE_ID_RE.test(id)) return { error: 'no-note' };
  if (await overRate({ db, nowS }, `board-ops:${author.id}`, BOARD_OPS_MAX, BOARD_WINDOW_S)) return { error: 'board-ops-rate' };
  const r = await db.prepare('DELETE FROM board_notes WHERE id = ? AND author = ?').bind(id, author.id).run();
  if (!r?.meta?.changes) return { error: 'no-note' };
  return { ok: true, id, live: await liveCount(db, author.id, nowS) };
}

/**
 * REPORT A NOTE: once a reader, never one's own. The reporter stops seeing it at once; the NOTE_REPORTS_HIDE'th
 * reporter that COUNTS hides it from everyone - in one statement, which reads the count the INSERT just made - unless
 * a moderator has restored it. AUDIT 28 N3: a report counts only from an account neither muted nor a sprout (titles.js
 * SPROUT_S) at the time of the count.
 */
export async function reportNote({ db, nowS }, reader, env, id) {
  const shut = gate(reader, env, nowS);
  if (shut && shut.error !== 'muted') return shut;   // a muted reader may still report what they are shown
  if (typeof id !== 'string' || !NOTE_ID_RE.test(id)) return { error: 'no-note' };
  if (await overRate({ db, nowS }, `board-ops:${reader.id}`, BOARD_OPS_MAX, BOARD_WINDOW_S)) return { error: 'board-ops-rate' };
  const note = await db.prepare('SELECT author FROM board_notes WHERE id = ? AND expires_at > ?').bind(id, nowS).first();
  if (!note) return { error: 'no-note' };
  if (note.author === reader.id) return { error: 'own-note' };
  await db.prepare('INSERT OR IGNORE INTO board_reports (note_id, reporter, at) VALUES (?, ?, ?)').bind(id, reader.id, nowS).run();
  await db.prepare(`UPDATE board_notes SET hidden = 1 WHERE id = ?1 AND hidden = 0
    AND (SELECT COUNT(*) FROM board_reports r JOIN players p ON p.id = r.reporter
      WHERE r.note_id = ?1 AND COALESCE(p.muted_until, 0) <= ?2 AND p.created_at <= ?2 - ?4) >= ?3`).bind(id, nowS, NOTE_REPORTS_HIDE, SPROUT_S).run();
  return { ok: true, id };
}

/** A MODERATOR'S WORD on a note: `remove` (the row goes, its reports with it) or `restore` (reports no longer hide it). */
export async function moderateNote({ db }, mod, env, id, act) {
  if (!canModerate(mod, env)) return { error: 'not-moderator' };
  if (typeof id !== 'string' || !NOTE_ID_RE.test(id)) return { error: 'no-note' };
  const r = act === 'remove'
    ? await db.prepare('DELETE FROM board_notes WHERE id = ?').bind(id).run()
    : act === 'restore'
      ? await db.prepare('UPDATE board_notes SET hidden = 2 WHERE id = ?').bind(id).run()
      : null;
  if (!r) return { error: 'bad-act' };
  if (!r.meta?.changes) return { error: 'no-note' };
  return { ok: true, id, act };
}

/** THE SERVER'S WORD (a developer's): a notice on every board, for 1 to NOTICE_DAYS_MAX days. AUDIT 28 N7: with its own
 *  request id, as a pin - a notice posted again because its answer was lost is the notice it made (`repeat`). */
export async function postNotice({ db, rand, nowS }, dev, env, { subject, body, days, rid } = {}) {
  if (!isDeveloper(dev, env)) return { error: 'not-developer' };
  if (typeof rid !== 'string' || !BOARD_RID_RE.test(rid)) return { error: 'board-rid' };
  const words = noticeWords({ subject, body, days });
  if ('error' in words) return words;
  const id = mintId(rand);
  // one statement decides: (author, rid) is written once - a notice asked again is answered the one it made
  const r = await db.prepare('INSERT OR IGNORE INTO board_notices (id, subject, body, author, author_name, at, expires_at, rid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, words.subject, words.body, dev.id, displayName(dev), nowS, nowS + words.days * NOTE_DAY_S, rid).run();
  if (!r?.meta?.changes) {
    const made = await db.prepare('SELECT id FROM board_notices WHERE author = ? AND rid = ?').bind(dev.id, rid).first();
    return made ? { ok: true, repeat: true, id: made.id } : { error: 'server' };
  }
  return { ok: true, id };
}
/** Take a server notice down (a developer's). */
export async function removeNotice({ db }, dev, env, id) {
  if (!isDeveloper(dev, env)) return { error: 'not-developer' };
  if (typeof id !== 'string' || !NOTE_ID_RE.test(id)) return { error: 'no-notice' };
  const r = await db.prepare('DELETE FROM board_notices WHERE id = ?').bind(id).run();
  return r?.meta?.changes ? { ok: true, id } : { error: 'no-notice' };
}
