// @ts-check
// ═════════════════════════════════════════════════════════════════════
// GUILD1e (2026-09-30, Mac: "Finish the seats") - A GUILD'S OWN BOARD:
// its notes, its members' alone.
//
// Seats-Arc 8.2: "the hall carries the guild Stores chest and a private
// guild board (the board's Guilds tab, members only)"; PROF0 10.1's
// Guilds tab: "a guild's own notes, members only". What a note is - its
// words, its days - is src/net/boardLaw.js (noteWords, no button), which
// the client's window reads too; this file is who may do what with one.
//
// ═══ A MEMBER READS; A MEMBER PINS; A KEEPER TAKES DOWN ═════════════
//
// Every act names the character it is done as (guilds.js guildActorOf -
// a guild is a character's), and that character's guild is the board's.
// Any member reads and pins; an author takes down their own, and the
// Officers and the guildmaster anyone's (hallLaw.js HALL_POWERS.notes).
// The Notice Board's switch (BOARD_OPEN) and its mute stand here as on a
// town's board: this is a tab of that board.
//
// ═══ ONE STATEMENT DECIDES ═══════════════════════════════════════════
//
// A member's live notes on the guild's board are bounded
// (GUILD_NOTES_LIVE_MAX) inside the INSERT that writes one, and that
// INSERT also asks that the author is still a member of the guild - so a
// member removed between the read and the write pins nothing. (author,
// rid) makes a pin asked twice one note.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═════════════════════════════════════════════════════════════════════
import { mintId, isMuted, overRate } from './accounts.js';
import { guildActorOf } from './guilds.js';
import { boardOpenFor } from './board.js';
import { heraldryOfRow } from './halls.js';
import { maskText } from '../../src/net/nameFilter.js';   // TEXT-F1: a guild note kept before the filter, starred as it is read
import { HALL_POWERS, hallMay } from '../../src/net/hallLaw.js';
import {
  GUILD_NOTES_LIVE_MAX, GUILD_NOTES_SHOWN, NOTE_DAY_S, NOTES_PINNED_MAX, BOARD_OPS_MAX, BOARD_WINDOW_S, NOTE_ID_RE,
  BOARD_RID_RE, guildNoteWords,
} from '../../src/net/boardLaw.js';

/** The actor: the board open to this account, and the character a member of a guild - or the word that refuses. */
async function memberOf(db, player, env, character) {
  if (!boardOpenFor(player, env)) return { error: 'board-closed' };
  const a = await guildActorOf(db, player, character);
  if ('error' in a) return { error: a.error === 'guild-character' ? 'no-guild' : a.error };
  return a;
}

/** A member's live notes on their guild's board. */
async function liveCount(db, guildId, author, nowS) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM guild_notes WHERE guild_id = ? AND author = ? AND expires_at > ?').bind(guildId, author, nowS).first();
  return Number(r?.n ?? 0);
}

/** A note as a member sees it: never its account, only the member who pinned it. */
const noteView = (n, me) => ({
  id: n.id, from: n.author_name, subject: maskText(n.subject), body: maskText(n.body), at: n.at, expiresAt: n.expires_at,   // TEXT-F1
  mine: n.author === me.player,
});

/** A guild's expired notes, gone - `limit` at once, answering how many went. SCALE4b (2026-10-08): the service's clock's
 *  (server-account/src/cron.js, each hour), never a read's - the board's read swept first, a write on every look at a
 *  guild's board; nothing it answers waits on it, its notes are read `expires_at > now`. */
export async function sweepGuildNotes(db, nowS, limit = 200) {
  const r = await db.prepare('DELETE FROM guild_notes WHERE id IN (SELECT id FROM guild_notes WHERE expires_at <= ? LIMIT ?)').bind(nowS, limit).run();
  return Number(r?.meta?.changes ?? 0);
}

/**
 * THE GUILD'S BOARD, as this member sees it: the guild (its name, tag and heraldry), its live notes newest first - a
 * muted author's left out but for its author - and the reader's standing: may they pin, how many they have up, and
 * whether they take down others' notes.
 * @param {{db: any, nowS: number}} ctx
 */
export async function readGuildBoard({ db, nowS }, player, env, { character } = {}) {
  const a = await memberOf(db, player, env, character);
  if ('error' in a) return a;
  const { me } = a;
  const g = await db.prepare('SELECT id, name, tag, heraldry FROM guilds WHERE id = ?').bind(me.guild_id).first();
  if (!g) return { error: 'no-guild' };
  const { results: notes = [] } = await db.prepare(`SELECT n.* FROM guild_notes n JOIN players p ON p.id = n.author
    WHERE n.guild_id = ?1 AND n.expires_at > ?2 AND (COALESCE(p.muted_until, 0) <= ?2 OR n.author = ?3)
    ORDER BY n.at DESC, n.id DESC LIMIT ?4`).bind(me.guild_id, nowS, player.id, GUILD_NOTES_SHOWN).all();
  return {
    guild: { id: g.id, name: g.name, tag: g.tag, heraldry: heraldryOfRow(g.heraldry) },
    notes: notes.map((n) => noteView(n, me)),
    me: {
      canPin: !isMuted(player, nowS), live: await liveCount(db, me.guild_id, player.id, nowS), max: GUILD_NOTES_LIVE_MAX,
      keeper: hallMay(me.rank, 'notes'),
    },
  };
}

/**
 * PIN A NOTE on the guild's board: its words (boardLaw guildNoteWords), the member's hour spent, and the row written
 * only while the member has room (GUILD_NOTES_LIVE_MAX) AND is still in the guild - in ONE statement. A pin asked
 * again with the same `rid` answers the note it made (`repeat`).
 * @param {{db: any, rand: (b: Uint8Array) => void, nowS: number}} ctx
 */
export async function pinGuildNote({ db, rand, nowS }, player, env, { character, subject, body, days, rid } = {}) {
  const a = await memberOf(db, player, env, character);
  if ('error' in a) return a;
  const { me } = a;
  if (isMuted(player, nowS)) return { error: 'muted' };
  if (typeof rid !== 'string' || !BOARD_RID_RE.test(rid)) return { error: 'board-rid' };
  const prior = await db.prepare('SELECT * FROM guild_notes WHERE author = ? AND rid = ?').bind(player.id, rid).first();
  if (prior) return prior.guild_id === me.guild_id ? { ok: true, repeat: true, note: noteView(prior, me) } : { error: 'board-rid' };
  const words = guildNoteWords({ subject, body, days });
  if ('error' in words) return words;
  if (await overRate({ db, nowS }, `guild-board-pin:${player.id}`, NOTES_PINNED_MAX, BOARD_WINDOW_S)) return { error: 'board-rate' };
  const id = mintId(rand);
  let r;
  try {
    r = await db.prepare(`INSERT INTO guild_notes (id, guild_id, author, char_id, author_name, subject, body, at, expires_at, rid)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10
      WHERE EXISTS (SELECT 1 FROM guild_members WHERE player = ?3 AND char_id = ?4 AND guild_id = ?2)
        AND (SELECT COUNT(*) FROM guild_notes WHERE guild_id = ?2 AND author = ?3 AND expires_at > ?8) < ?11`)
      .bind(id, me.guild_id, player.id, character, me.name, words.subject, words.body, nowS, nowS + words.days * NOTE_DAY_S, rid, GUILD_NOTES_LIVE_MAX).run();
  } catch (e) {
    // (author, rid) taken by a twin that raced this one - answered below as the note it made; anything else is ours
    if (!/UNIQUE/i.test(String(/** @type {any} */ (e)?.message ?? e))) throw e;
    r = null;
  }
  if (!r?.meta?.changes) {
    const again = await db.prepare('SELECT * FROM guild_notes WHERE author = ? AND rid = ?').bind(player.id, rid).first();
    if (again) return { ok: true, repeat: true, note: noteView(again, me) };
    const still = await db.prepare('SELECT 1 FROM guild_members WHERE player = ? AND char_id = ? AND guild_id = ?').bind(player.id, character, me.guild_id).first();
    return { error: still ? 'notes-full' : 'no-guild' };
  }
  const note = await db.prepare('SELECT * FROM guild_notes WHERE id = ?').bind(id).first();
  return { ok: true, note: noteView(note, me), live: await liveCount(db, me.guild_id, player.id, nowS) };
}

/**
 * TAKE A NOTE DOWN from the guild's board: the author's own, or - an Officer's or the guildmaster's - any member's. The
 * DELETE itself asks the rank, so a keeper demoted between the read and the write takes down only their own.
 * `no-note` for an id that is not on this guild's board or not this member's to take.
 */
export async function takeDownGuildNote({ db, nowS }, player, env, { character, id } = {}) {
  const a = await memberOf(db, player, env, character);
  if ('error' in a) return a;
  const { me } = a;
  if (typeof id !== 'string' || !NOTE_ID_RE.test(id)) return { error: 'no-note' };
  if (await overRate({ db, nowS }, `board-ops:${player.id}`, BOARD_OPS_MAX, BOARD_WINDOW_S)) return { error: 'board-ops-rate' };
  const r = await db.prepare(`DELETE FROM guild_notes WHERE id = ?1 AND guild_id = ?2
    AND (author = ?3 OR EXISTS (SELECT 1 FROM guild_members WHERE rowid = ?4 AND guild_id = ?2 AND rank IN (${HALL_POWERS.notes.join(', ')})))`)
    .bind(id, me.guild_id, player.id, me.rid).run();
  if (!r?.meta?.changes) return { error: 'no-note' };
  return { ok: true, id, live: await liveCount(db, me.guild_id, player.id, nowS) };
}
