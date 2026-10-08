// SCALE4a (2026-10-08, Mac: "Do 1 2 and 3" - of PERF-NEXT's follow-up list, the account service's reads halved): every
// authenticated request resolved its secret in TWO statements one after the other - the session by its hash, then its
// player by id - and the day before YARD-SHED those two were 4.86 and 4.73 million of the database's 17.4 million reads
// (bible/06-Systems/Online-Arc.md YARD-SHED). One statement now (server-account/src/accounts.js resolveSession,
// WHO_SQL): the session's six columns under a prefix beside `p.*`, LEFT JOINed so every exit the two reads had - the idle
// session deleted, the orphan refused, the stale touch - is met in the same order. The old two reads are the oracle.
// tools/mutants/scale4a.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { d1 } from './accountDb.mjs';
import {
  createGuest, openSession, resolveSession, register, closeSession,
  SESSION_COLUMNS, SESSION_IDLE_S, SESSION_TOUCH_S,
} from '../server-account/src/accounts.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const NOW = 1_790_000_000;

/** The database, every statement it is asked recorded by its SQL - a batch's own statements counted where prepared. */
function recorded(db) {
  const asked = [];
  return {
    asked,
    db: {
      _raw: db._raw,
      prepare(sql) { asked.push(sql); return db.prepare(sql); },
      batch: (list) => db.batch(list),
    },
  };
}

/** THE ORACLE: what the two reads answered, from the rows as they stand - the session by its hash, its player by id,
 *  each as `SELECT *` gave it (spread, so a row's prototype is not the question). */
async function twoReads(db, secret) {
  const d = await subtle.digest('SHA-256', new TextEncoder().encode(secret));
  const hash = [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
  const session = db._raw.prepare('SELECT * FROM sessions WHERE secret_hash = ?').get(hash);
  if (!session) return { session: null, player: null };
  const player = db._raw.prepare('SELECT * FROM players WHERE id = ?').get(session.player_id);
  return { session: { ...session }, player: player ? { ...player } : null };
}

const ctx = (db, nowS = NOW) => ({ db, subtle, rand, nowS });
const plain = (who) => (who ? { player: { ...who.player }, session: { ...who.session } } : null);

test('SCALE4a: the session and its player are ONE statement - the same two rows the two reads answered, on a fresh guest, a second device, a registered and a muted account, a stale touch and the bound; a session past the idle bound is deleted, an unknown or malformed secret answers null (mutants: the player read again, a session column left out, the prefix taken by the player)', async () => {
  const base = d1();
  const { db, asked } = recorded(base);
  const guest = await createGuest(ctx(base), { deviceLabel: 'a phone' });
  const phone = await openSession(ctx(base), guest.id, 'a laptop');
  const reg = await createGuest(ctx(base), {});
  assert.equal((await register(ctx(base), reg.id, { handle: 'Nystul', password: 'a good long one' })).handle, 'Nystul');
  const mod = await createGuest(ctx(base), {});
  base._raw.prepare('UPDATE players SET muted_until = ?, muted_by = ?, played_s = ? WHERE id = ?').run(NOW + 600, guest.id, 4242, mod.id);

  for (const [label, secret, nowS] of [
    ['a fresh guest', guest.secret, NOW + 1],
    ['its second device', phone.secret, NOW + 2],
    ['a registered account', reg.secret, NOW + 3],
    ['a muted account with time played', mod.secret, NOW + 4],
    ['a stale session (the touch)', guest.secret, NOW + SESSION_TOUCH_S + 7],
    ['a session at the idle bound', phone.secret, NOW + SESSION_IDLE_S],
  ]) {
    const before = await twoReads(base, secret);
    asked.length = 0;
    const who = await resolveSession(ctx(db, nowS), secret);
    assert.equal(asked.filter((sql) => /^\s*SELECT/i.test(sql)).length, 1, `${label}: one read`);
    assert.deepEqual(plain(who), before, `${label}: the rows the two reads answered`);
    assert.deepEqual(Object.keys(who.session), SESSION_COLUMNS, `${label}: the session's own columns, in the table's order`);
  }
  // the stale touch still writes both rows - one read and one batch of two
  asked.length = 0;
  assert.ok(await resolveSession(ctx(db, NOW + 3 * SESSION_TOUCH_S), reg.secret));
  assert.deepEqual(asked.map((sql) => sql.trim().split(/\s+/)[0]), ['SELECT', 'UPDATE', 'UPDATE']);
  assert.deepEqual({ ...base._raw.prepare('SELECT s.last_seen AS s, p.last_seen AS p FROM sessions s JOIN players p ON p.id = s.player_id WHERE p.id = ?').get(reg.id) },
    { s: NOW + 3 * SESSION_TOUCH_S, p: NOW + 3 * SESSION_TOUCH_S });

  // past the idle bound: refused and DELETED (AUDIT-ACC F9), in the read and the delete alone
  const old = await openSession(ctx(base), guest.id, 'an old phone');
  asked.length = 0;
  assert.equal(await resolveSession(ctx(db, NOW + SESSION_IDLE_S + 1), old.secret), null);
  assert.deepEqual(asked.map((sql) => sql.trim().split(/\s+/)[0]), ['SELECT', 'DELETE']);
  assert.deepEqual((await twoReads(base, old.secret)).session, null, 'the row is gone');

  // unknown and malformed secrets
  asked.length = 0;
  assert.equal(await resolveSession(ctx(db), 'x'.repeat(43)), null);
  assert.equal(asked.length, 1, 'an unknown secret: the one read');
  for (const bad of [null, 42, 'short', 'y'.repeat(129)]) assert.equal(await resolveSession(ctx(db), bad), null);
  assert.equal(asked.length, 1, 'a malformed secret asks nothing');

  // and the doors that read the session still work off it: a sign-out by its id
  const me = await resolveSession(ctx(db, NOW + 5), phone.secret);
  assert.deepEqual(await closeSession(ctx(base), me.session.id), { revoked: 1 });
  assert.equal(await resolveSession(ctx(db, NOW + 6), phone.secret), null);
});

test('SCALE4a: a session whose player is gone is refused as the two reads refused it - and one past the idle bound is still DELETED first, which an inner join would never see (mutants: the join made inner, the orphan admitted)', async () => {
  const base = d1();
  const a = await createGuest(ctx(base), {});
  const b = await createGuest(ctx(base), {});
  // an orphan cannot be made through the cascade (0001's FOREIGN KEY ... ON DELETE CASCADE) - the old code checked for it
  // because "cannot happen" is how a null reaches a caller, and so does this one: made here with the keys off
  base._raw.exec('PRAGMA foreign_keys = OFF');
  base._raw.prepare('DELETE FROM players WHERE id IN (?, ?)').run(a.id, b.id);
  base._raw.exec('PRAGMA foreign_keys = ON');
  const sessions = () => base._raw.prepare('SELECT player_id FROM sessions ORDER BY player_id').all().map((r) => r.player_id);
  assert.deepEqual(sessions(), [a.id, b.id].sort());

  assert.equal((await twoReads(base, a.secret)).player, null, 'the oracle reads an orphan');
  assert.equal(await resolveSession(ctx(base, NOW + 1), a.secret), null, 'an orphan within the bound: refused');
  assert.deepEqual(sessions(), [a.id, b.id].sort(), '...and kept, as the two reads kept it');
  assert.equal(await resolveSession(ctx(base, NOW + SESSION_IDLE_S + 1), b.secret), null, 'an orphan past the bound: refused');
  assert.deepEqual(sessions(), [a.id], '...and deleted, as the two reads deleted it - the idle bound asked before the player');
});

const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();

test('SCALE4a: SESSION_COLUMNS is the sessions table as the migrations leave it, name for name and in order, and the one statement finds both rows by an index - the secret\'s and the player\'s key (mutants: a column left out of the list)', async () => {
  const raw = new DatabaseSync(':memory:');
  for (const f of MIGRATIONS) raw.exec(src(`server-account/migrations/${f}`));
  assert.deepEqual(raw.prepare('PRAGMA table_info(sessions)').all().map((c) => c.name), [...SESSION_COLUMNS]);
  assert.ok(Object.isFrozen(SESSION_COLUMNS));
  // no column of players can be mistaken for the session's: none starts with the prefix
  const players = raw.prepare('PRAGMA table_info(players)').all().map((c) => c.name);
  assert.ok(players.length > 20 && players.every((c) => !c.startsWith('s.')), 'the prefix is the session\'s alone');

  // the statement, as resolveSession asks it, planned by the real schema
  const base = d1();
  const { db, asked } = recorded(base);
  const g = await createGuest(ctx(base), {});
  await resolveSession(ctx(db, NOW + 1), g.secret);
  assert.equal(asked.length, 1);
  const plan = raw.prepare(`EXPLAIN QUERY PLAN ${asked[0]}`).all().map((r) => r.detail).join(' | ');
  assert.match(plan, /SEARCH s USING (COVERING )?INDEX idx_sessions_secret \(secret_hash=\?\)/, plan);
  assert.match(plan, /SEARCH p USING INDEX sqlite_autoindex_players_1 \(id=\?\)/, plan);
  assert.doesNotMatch(plan, /\bSCAN\b/, 'no table walked');
});
