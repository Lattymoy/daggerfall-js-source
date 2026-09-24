// @ts-check
// ═══════════════════════════════════════════════════════════════════
// MAIL1 - THE SERVICE'S LETTERS.
//
// Addison Knox: "An in-game mail system where players can send messages
// to offline players (e.g. notes, contracts, invitations)."
//
// What a letter is - its bounds and the characters it may carry - is
// src/net/letterLaw.js, which the client's form reads too. This file is
// who may send one, to whom, and how often; and the three things a
// reader does with their own: list, open, delete.
//
// ═══ REGISTERED, BOTH ENDS ═════════════════════════════════════════
//
// A guest is a DEVICE - an account that a cleared browser loses - so a
// guest can neither be written to (there is no name that stays theirs:
// a guest's name is generated, and a guest who clears their storage is
// somebody else) nor write (a letter must come from someone a reader
// can write back to, and someone a moderator's mute can reach). The
// route's wall refuses a guest before any of this runs; `sendLetter`
// asks again, because a function that trusts its caller's wall is a
// function one refactor away from having none.
//
// ═══ THE THREE WALLS AGAINST A FLOOD ═══════════════════════════════
//
// Registered-only is the first: a sender has a handle a moderator can
// mute, and a mute stops their letters (`muted`) exactly as it stops
// their chat. The rates are the second - LETTERS_SENT_MAX an hour to
// anyone, LETTERS_PAIR_MAX an hour to one reader, spent BEFORE the
// reader is looked up so the lookup cannot be ground either. The box's
// bound is the third, and it refuses the SENDER: a reader's oldest
// letter is never deleted to make room for a stranger's newest.
//
// ═══ A READER'S LETTERS ARE THEIRS ALONE ═══════════════════════════
//
// Every read, mark and delete names the letter AND its reader in the
// one statement (`WHERE id = ? AND to_id = ?`), so a letter id that is
// somebody else's is exactly as absent as one that never existed - the
// same word (`no-letter`) for both, and nothing to learn from which.
// ═══════════════════════════════════════════════════════════════════
import { mintId, accountKind, displayName, isMuted, overRate } from './accounts.js';
import { titleWorn, glyphsOf } from './titles.js';
import { HANDLE_RE } from '../../src/net/handleShape.js';
import {
  letterWords, LETTERS_INBOX_MAX, LETTERS_SENT_MAX, LETTERS_SENT_WINDOW_S, LETTERS_PAIR_MAX, LETTER_ID_RE,
} from '../../src/net/letterLaw.js';

/**
 * SEND ONE. The words checked (letterLaw's one answer), the sender's rate spent, the reader found by handle, the
 * pair's rate spent, and the letter written only while the reader's box has room - in ONE statement, so two letters
 * racing for the last place cannot both land.
 * @param {{db: any, rand: (b: Uint8Array) => void, nowS: number}} ctx
 * @param {any} sender  the session's player row
 * @param {{to?: unknown, subject?: unknown, body?: unknown}} letter
 * @returns {Promise<{ok: true, id: string, to: string} | {error: string}>}
 */
export async function sendLetter({ db, rand, nowS }, sender, { to, subject, body } = {}) {
  if (accountKind(sender) !== 'linked') return { error: 'mail-needs-account' };
  if (isMuted(sender, nowS)) return { error: 'muted' };
  const words = letterWords({ subject, body });
  if ('error' in words) return words;
  const handle = typeof to === 'string' ? to.trim() : '';
  if (!HANDLE_RE.test(handle)) return { error: 'no-reader' };
  // ITS OWN WORD, not the routes' `rate`: that one's sentence says "wait a few minutes", and this window is an hour
  if (await overRate({ db, nowS }, `mail:${sender.id}`, LETTERS_SENT_MAX, LETTERS_SENT_WINDOW_S)) return { error: 'mail-rate' };
  const reader = await db.prepare('SELECT id, handle FROM players WHERE handle_lc = ?').bind(handle.toLowerCase()).first();
  if (!reader) return { error: 'no-reader' };
  if (reader.id === sender.id) return { error: 'to-self' };
  if (await overRate({ db, nowS }, `mail:${sender.id}>${reader.id}`, LETTERS_PAIR_MAX, LETTERS_SENT_WINDOW_S)) return { error: 'mail-rate' };
  const id = mintId(rand);
  const r = await db.prepare(`INSERT INTO letters (id, to_id, from_id, from_name, subject, body, sent_at)
    SELECT ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM letters WHERE to_id = ?) < ?`)
    .bind(id, reader.id, sender.id, displayName(sender), words.subject, words.body, nowS, reader.id, LETTERS_INBOX_MAX).run();
  if (!r?.meta?.changes) return { error: 'inbox-full' };
  return { ok: true, id, to: reader.handle };
}

/** The sender's badge as the service would sign it NOW (titles.js: a title worn only while held, glyphs derived) -
 *  or none, for a sender whose row is gone. */
const badgeOf = (row, env, nowS) => (row ? { title: titleWorn(row, env) ?? null, glyphs: glyphsOf(row, env, nowS) } : { title: null, glyphs: [] });

/**
 * A READER'S BOX, newest first: every letter's head (who, what about, when, whether opened) and the count unopened -
 * never a body, which is what `readLetter` is for. Each sender's badge is read off their row as it stands now, the
 * token's own derivation, so a moderator's letter says so and a title taken away is gone from old letters too.
 * @param {{db: any, nowS: number}} ctx
 * @param {any} reader  the session's player row
 * @param {any} env  the service's config (the developer and moderator lists)
 */
export async function inboxOf({ db, nowS }, reader, env) {
  const { results = [] } = await db.prepare(`SELECT id, from_id, from_name, subject, sent_at, read_at FROM letters
    WHERE to_id = ? ORDER BY sent_at DESC, id DESC LIMIT ?`).bind(reader.id, LETTERS_INBOX_MAX).all();
  const senders = [...new Set(results.map((l) => l.from_id))];
  const rows = new Map();
  if (senders.length) {
    const { results: found = [] } = await db.prepare(`SELECT * FROM players WHERE id IN (${senders.map(() => '?').join(', ')})`)
      .bind(...senders).all();
    for (const p of found) rows.set(p.id, p);
  }
  const letters = results.map((l) => ({
    id: l.id, from: l.from_name, ...badgeOf(rows.get(l.from_id), env, nowS),
    subject: l.subject, sentAt: l.sent_at, read: l.read_at != null,
  }));
  return { letters, unread: letters.filter((l) => !l.read).length, max: LETTERS_INBOX_MAX };
}

/**
 * OPEN ONE of the reader's own: the whole letter, and its first opening stamped (`read_at` written once - reading it
 * again is not news). `no-letter` for an id that is not theirs, whether or not it is anybody's.
 * @param {{db: any, nowS: number}} ctx
 */
export async function readLetter({ db, nowS }, reader, env, id) {
  if (typeof id !== 'string' || !LETTER_ID_RE.test(id)) return { error: 'no-letter' };
  const l = await db.prepare('SELECT id, from_id, from_name, subject, body, sent_at, read_at FROM letters WHERE id = ? AND to_id = ?')
    .bind(id, reader.id).first();
  if (!l) return { error: 'no-letter' };
  if (l.read_at == null) await db.prepare('UPDATE letters SET read_at = ? WHERE id = ? AND to_id = ? AND read_at IS NULL').bind(nowS, id, reader.id).run();
  const row = await db.prepare('SELECT * FROM players WHERE id = ?').bind(l.from_id).first();
  return {
    letter: {
      id: l.id, from: l.from_name, ...badgeOf(row, env, nowS), subject: l.subject, body: l.body,
      sentAt: l.sent_at, readAt: l.read_at ?? nowS,
    },
  };
}

/** THROW ONE AWAY - the reader's own, and only theirs. */
export async function deleteLetter({ db }, reader, id) {
  if (typeof id !== 'string' || !LETTER_ID_RE.test(id)) return { error: 'no-letter' };
  const r = await db.prepare('DELETE FROM letters WHERE id = ? AND to_id = ?').bind(id, reader.id).run();
  return r?.meta?.changes ? { ok: true, id } : { error: 'no-letter' };
}
