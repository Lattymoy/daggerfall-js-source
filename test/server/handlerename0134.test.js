// HANDLE-RENAME (2026-10-19, Mac: "Change the name PROSTITUTE_STRANGLER to SanguinePanguine. This is an account").
// Migration 0134 renames the one account - its handle, how it signs in, and the rows that keep its name as it was - and
// leaves the moderation record as it was. Driven over the real worker and the real migrations: the account's row is the
// live one's (a handle issued before NAME-WORDS, which the service now refuses), its letters are sent through the
// service's own route, then the migration is applied again as the deploy applies it, once.
// NAME-WORDS (the same day, "Not sure how the filter didnt catch this" - then "Yes" to adding both words): net/nameFilter.js
// reads `prostitute` and `strangler` ANYWHERE, so the handle is refused at entry and the words starred in a line.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService } from '../accountDb.mjs';
import { checkName } from '../../src/net/nameFilter.js';
import { sanitizeChat } from '../../src/net/wire.js';
import { ACCEPTED } from '../../src/net/legalLaw.js';

const MIGRATION = readFileSync(new URL('../../server-account/migrations/0134_handle_rename.sql', import.meta.url), 'utf8');
const OLD = 'PROSTITUTE_STRANGLER', NEW = 'SanguinePanguine';

async function stand() {
  const s = await standService();
  const raw = s.env.DB._raw;
  // the row as the live database holds it: the handle issued before the filter read its words, and the renown track it
  // was written with
  const old = await s.registered('Placeholder', { renown: 2 });
  raw.prepare('UPDATE players SET handle = ?, handle_lc = ? WHERE id = ?').run(OLD, OLD.toLowerCase(), old.id);
  raw.prepare('UPDATE renown_tracks SET name = ? WHERE player = ?').run(OLD, old.id);
  const friend = await s.registered('Bystander', { renown: 2 });
  assert.equal((await s.call('/v1/mail/send', { to: 'Bystander', subject: 'Hello', body: 'A letter.' }, old.secret)).status, 200);
  assert.equal((await s.call('/v1/mail/send', { to: OLD, subject: 'Hi', body: 'Back.' }, friend.secret)).status, 200);
  // a case the moderators hold, a line the account said kept under the name it said it under
  raw.prepare(`INSERT INTO mod_cases (id, target, source, status, opened_at, updated_at, ai_state, discord_state) VALUES ('c1', ?, 'report', 'open', 1, 1, 'off', 'off')`).run(old.id);
  raw.prepare(`INSERT INTO mod_case_lines (case_id, at, sub, name, tab, text) VALUES ('c1', 1, ?, ?, 'local', 'words')`).run(old.id, OLD);
  const login = (handle) => s.call('/v1/auth/login', { handle, password: 'a good long one' });
  return { ...s, raw, old, friend, login };
}

test('HANDLE-RENAME 0134: the account signs in as SanguinePanguine with its password and is called it; its letters and its renown track are written the new name; the moderation record, the other account and its rows are as they were (mutants: a snapshot left out; the handle_lc left)', async () => {
  const s = await stand();
  s.raw.exec(MIGRATION);
  const me = s.raw.prepare('SELECT handle, handle_lc FROM players WHERE id = ?').get(s.old.id);
  assert.deepEqual({ ...me }, { handle: NEW, handle_lc: NEW.toLowerCase() });
  assert.equal((await s.login(OLD)).status, 401, 'the old name signs nobody in');
  const r = await s.login(NEW.toUpperCase());
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.id, r.body.name], [s.old.id, NEW]);
  assert.deepEqual(s.raw.prepare('SELECT from_id, from_name FROM letters ORDER BY from_name').all().map((l) => [l.from_id, l.from_name]),
    [[s.friend.id, 'Bystander'], [s.old.id, NEW]]);
  assert.deepEqual(s.raw.prepare('SELECT player, name FROM renown_tracks ORDER BY name').all().map((t) => [t.player, t.name]),
    [[s.friend.id, 'Bystander'], [s.old.id, NEW]]);
  assert.equal(s.raw.prepare('SELECT name FROM mod_case_lines').get().name, OLD, 'the record keeps what was said, as it was said');
  assert.equal(s.raw.prepare('SELECT handle FROM players WHERE id = ?').get(s.friend.id).handle, 'Bystander');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'handle_rename'").get().n, 0, 'its working table is gone');
});

test('HANDLE-RENAME 0134: where SanguinePanguine is another account\'s, nothing is written - not the handle, not a snapshot - and the migration still applies (mutants: the guard dropped from a snapshot)', async () => {
  const s = await stand();
  const other = await s.registered(NEW);
  s.raw.exec(MIGRATION);
  assert.deepEqual([s.raw.prepare('SELECT handle FROM players WHERE id = ?').get(s.old.id).handle, s.raw.prepare('SELECT handle FROM players WHERE id = ?').get(other.id).handle], [OLD, NEW]);
  assert.deepEqual(s.raw.prepare('SELECT from_name FROM letters ORDER BY from_name').all().map((l) => l.from_name), ['Bystander', OLD]);
  assert.equal(s.raw.prepare('SELECT name FROM renown_tracks WHERE player = ?').get(s.old.id).name, OLD);
  assert.equal((await s.login(OLD)).status, 200);
});

test('NAME-WORDS: the report\'s handle is refused at entry, naming the word; either word is caught glued to another or padded; a line stars them; SanguinePanguine and Stranglehold pass (mutants: either word left out)', async () => {
  const s = await stand();
  const g = await s.guest();
  const reg = await s.call('/v1/auth/register', { handle: OLD, password: 'a good long one', ...ACCEPTED }, g.secret);
  assert.deepEqual([reg.status >= 400, reg.body?.error], [true, 'handle-refused']);
  assert.deepEqual([checkName(OLD).ok, checkName(OLD).word], [false, 'prostitute']);
  assert.deepEqual([checkName('xXStranglerXx').ok, checkName('xXStranglerXx').word], [false, 'strangler']);
  assert.equal(sanitizeChat('a prostitute and a strangler'), 'a ********** and a *********');
  assert.deepEqual([NEW, 'Stranglehold'].map((n) => checkName(n).ok), [true, true]);
});
