// FOUNDER4 (2026-10-04, Mac: "We need to find a way to grant the founder title to everyone before the previous cut off
// date. Since people are still missing their founders title"; asked how, "Link shared characters"). FOUNDER3 reads
// Founder off when an account FIRST PLAYED, its row's first contact - and could not reach a player whose play before the
// cutoff is on ANOTHER row: a guest in one browser who registered in another place (the desktop app is its own origin,
// so its own storage). Migration 0078 links the two through a character both rows hold - its id is minted on the
// player's machine and never told to anyone else - and records the earlier first play as `first_played_at`, which
// `firstPlayed` reads. Here: the law, the migration run over a seeded database (each of its five sources, one hop,
// earlier only, guests too, its helper table gone), and the real Worker on the database it leaves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { titlesHeld, equipRefusal, FOUNDER_UNTIL } from '../server-account/src/titles.js';
import { verifyToken, importPublicKeyB64 } from '../src/net/identityToken.js';
import { ACCEPTED } from '../src/net/legalLaw.js';

const DAY = 24 * 60 * 60;
const CUT = Date.UTC(2026, 8, 25, 12) / 1000;   // FOUNDER5 (PIN MOVED): 00:00Z until the end of the 24th on every clock
const FILE = '0078_founder_links.sql';
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
const sql = (f) => readFileSync(new URL(`../server-account/migrations/${f}`, import.meta.url), 'utf8');
const BEFORE = MIGRATIONS.slice(0, MIGRATIONS.indexOf(FILE));
/** SERPENT1 (PIN MOVED at its merge): the migrations after 0078 - the service end to end serves a database that has them
 *  (its routes read their tables), all but the one under test. */
const AFTER = MIGRATIONS.slice(MIGRATIONS.indexOf(FILE) + 1);

// ── THE LAW ─────────────────────────────────────────────────────────

test('FOUNDER4 the law: a registered account whose first_played_at is by the cutoff holds Founder whenever its own row was first seen; one past it holds none; a stamp that is not a number is no stamp; a guest none until it registers; the instant did not move (mutants: firstPlayed blind to the column)', () => {
  const late = { handle: 'Linked', created_at: CUT + 9 * DAY, registered_at: CUT + 9 * DAY };
  assert.deepEqual(titlesHeld(late, {}), [], 'first seen after the cutoff, nothing linked: none, as FOUNDER3 left it');
  assert.deepEqual(titlesHeld({ ...late, first_played_at: CUT - 4 * DAY }, {}), ['founder'], 'a row it shares a character with first played before the cutoff');
  assert.equal(equipRefusal('founder', { ...late, first_played_at: CUT - 4 * DAY }, {}), null, 'and it may be worn');
  assert.deepEqual(titlesHeld({ ...late, first_played_at: CUT }, {}), ['founder'], 'in the cutoff second');
  assert.deepEqual(titlesHeld({ ...late, first_played_at: CUT + 1 }, {}), [], 'a second past it: none');
  assert.deepEqual(titlesHeld({ ...late, first_played_at: null }, {}), [], 'NULL - nothing linked earlier - changes nothing');
  assert.deepEqual(titlesHeld({ ...late, first_played_at: 'x' }, {}), [], 'a stamp that is not a number is no stamp');
  assert.deepEqual(titlesHeld({ ...late, handle: null, registered_at: null, first_played_at: CUT - 4 * DAY }, {}), [], 'a guest holds none, linked or not');
  assert.deepEqual(titlesHeld({ handle: 'Since', created_at: CUT - DAY, registered_at: CUT + DAY, first_played_at: CUT + 5 * DAY }, {}), ['founder'], 'a later link never takes it from a row that first played in time');
  assert.equal(FOUNDER_UNTIL, CUT, 'the instant FOUNDER5 moved later, so nobody lost it');
});

// ── THE MIGRATION, over a seeded database ───────────────────────────

/** A database at the migration before 0078, rows seeded, then 0078 applied. */
function migrated(seed) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of BEFORE) db.exec(sql(f));
  const player = (id, created, registered = null) => db.prepare(
    'INSERT INTO players (id, guest_name, created_at, last_seen, handle, handle_lc, registered_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, `${id} Guest`, created, created, registered === null ? null : id, registered === null ? null : id.toLowerCase(), registered);
  const holds = {
    save: (p, c) => db.prepare('INSERT INTO saves (player_id, character_id, save_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(p, c, 'QuickSave', CUT + DAY, CUT + DAY),
    renown: (p, c) => db.prepare('INSERT INTO renown_tracks (player, char_id, created_at, updated_at) VALUES (?, ?, ?, ?)').run(p, c, CUT + DAY, CUT + DAY),
    census: (p, c) => db.prepare('INSERT INTO realm_census (player, char_id) VALUES (?, ?)').run(p, c),
    realm: (p, c) => db.prepare('INSERT INTO realm_characters (id, player, name, origin_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(`realm-${p}-${c}`, p, 'Hero', c, CUT + DAY, CUT + DAY),
    pass: (p, c) => db.prepare('INSERT INTO realm_passes (player, granted_by, granted_at, origin_id, spent_at) VALUES (?, ?, ?, ?, ?)').run(p, 'dev', CUT + DAY, c, CUT + DAY),
  };
  seed(player, holds);
  db.exec(sql(FILE));
  const row = (id) => db.prepare('SELECT * FROM players WHERE id = ?').get(id);
  return { db, row };
}

test('FOUNDER4 the migration: an account first seen after the cutoff that shares a character with a guest first seen before it takes that guest\'s first contact - through each of the five records a row holds a character by - and holds Founder; the earliest of several linked rows; nothing for an account with no shared character or none earlier (mutants: a source dropped, the link to itself, the earlier-only test dropped, MIN made MAX)', () => {
  const { row } = migrated((player, h) => {
    for (const [i, how] of ['save', 'renown', 'census', 'realm', 'pass'].entries()) {
      player(`Guest${i}`, CUT - (i + 2) * DAY);   // played as a guest before the cutoff, in one place
      player(`Acct${i}`, CUT + 10 * DAY, CUT + 10 * DAY);   // registered after it, somewhere else
      h[how](`Guest${i}`, `char-${how}-0001`);
      h[how](`Acct${i}`, `char-${how}-0001`);   // the same character, held by both rows the same way
    }
    // the earliest of several: one character on a row from before the cutoff, another on a later row
    player('Old', CUT - 20 * DAY); player('Mid', CUT + 3 * DAY); player('Many', CUT + 12 * DAY, CUT + 12 * DAY);
    h.save('Old', 'char-old-0001'); h.save('Many', 'char-old-0001');
    h.renown('Mid', 'char-mid-0001'); h.renown('Many', 'char-mid-0001');
    // mixed records: a cloud save on the guest, a realm character brought in from it on the account
    player('MixG', CUT - 6 * DAY); player('MixA', CUT + 8 * DAY, CUT + 8 * DAY);
    h.save('MixG', 'char-mix-0001'); h.realm('MixA', 'char-mix-0001');
    // nothing shared
    player('Alone', CUT + 9 * DAY, CUT + 9 * DAY); h.save('Alone', 'char-alone-0001');
    player('Other', CUT - 9 * DAY); h.save('Other', 'char-other-0001');
    // shared only with a row first seen after the cutoff: linked, earlier, and still no Founder
    player('LateG', CUT + 2 * DAY); player('LateA', CUT + 15 * DAY, CUT + 15 * DAY);
    h.census('LateG', 'char-late-0001'); h.census('LateA', 'char-late-0001');
    // a row that first played in time, sharing with a later one: its own is earlier, so nothing is written
    player('First', CUT - 30 * DAY, CUT - 29 * DAY); player('Second', CUT + 4 * DAY, CUT + 4 * DAY);
    h.save('First', 'char-first-0001'); h.save('Second', 'char-first-0001');
  });
  for (const [i, how] of ['save', 'renown', 'census', 'realm', 'pass'].entries()) {
    const a = row(`Acct${i}`);
    assert.equal(a.first_played_at, CUT - (i + 2) * DAY, `linked through ${how}: the guest's first contact`);
    assert.deepEqual(titlesHeld(a, {}), ['founder'], `and Founder (${how})`);
    assert.equal(row(`Guest${i}`).first_played_at, null, 'the guest first played earlier than the account: nothing written on it');
  }
  assert.equal(row('Many').first_played_at, CUT - 20 * DAY, 'the earliest of the rows it shares characters with');
  assert.equal(row('MixA').first_played_at, CUT - 6 * DAY, 'one record on one row, another on the other - still the same character');
  assert.deepEqual(titlesHeld(row('MixA'), {}), ['founder']);
  assert.equal(row('Alone').first_played_at, null, 'no character shared: nothing');
  assert.deepEqual(titlesHeld(row('Alone'), {}), [], 'and no Founder');
  assert.equal(row('LateA').first_played_at, CUT + 2 * DAY, 'linked to a row first seen after the cutoff: the fact recorded');
  assert.deepEqual(titlesHeld(row('LateA'), {}), [], 'and no Founder from it');
  assert.equal(row('First').first_played_at, null, 'its own first contact is the earlier: nothing written');
  assert.equal(row('Second').first_played_at, CUT - 30 * DAY, 'the later row takes the earlier\'s, registration counted as FOUNDER3 counts it');
  assert.deepEqual(titlesHeld(row('First'), {}), ['founder'], 'the row that held it keeps it');
});

test('FOUNDER4 the migration: one hop - a row linked only through a row in between takes nothing from the first; a guest linked to a row from before the cutoff is filled too and holds Founder the moment it registers; a guest\'s own registration counts as its first play (mutants: guests left out)', () => {
  const { row } = migrated((player, h) => {
    player('A', CUT - 10 * DAY); player('B', CUT + 5 * DAY); player('C', CUT + 9 * DAY, CUT + 9 * DAY);
    h.save('A', 'char-ab-0001'); h.save('B', 'char-ab-0001');
    h.save('B', 'char-bc-0001'); h.save('C', 'char-bc-0001');
    player('Early', CUT - 7 * DAY); player('Desk', CUT + 11 * DAY);   // a guest still, in the desktop app
    h.renown('Early', 'char-desk-0001'); h.renown('Desk', 'char-desk-0001');
  });
  assert.equal(row('B').first_played_at, CUT - 10 * DAY, 'B shares a character with A');
  assert.equal(row('C').first_played_at, CUT + 5 * DAY, 'C shares one with B alone: B\'s first contact, never A\'s through it');
  assert.deepEqual(titlesHeld(row('C'), {}), [], 'so no Founder through the chain');
  const desk = row('Desk');
  assert.equal(desk.first_played_at, CUT - 7 * DAY, 'a guest is filled too');
  assert.deepEqual(titlesHeld(desk, {}), [], 'and holds nothing while a guest');
  assert.deepEqual(titlesHeld({ ...desk, handle: 'Desk', registered_at: CUT + 40 * DAY }, {}), ['founder'], 'the moment it registers');
});

test('FOUNDER4 the migration\'s shape: the column added once, the holdings gathered from exactly the five records into a table of their own, indexed both ways, and that table dropped - the database ends with one new column and no new table (mutants: the helper table kept)', () => {
  const text = sql(FILE);
  assert.match(text, /^ALTER TABLE players ADD COLUMN first_played_at INTEGER;$/m);
  const sources = [...text.matchAll(/^\s+SELECT (\w+), (\w+) FROM (\w+)/gm)].map((m) => `${m[3]}.${m[1]}`);
  assert.deepEqual(sources, ['saves.character_id', 'renown_tracks.char_id', 'realm_census.char_id', 'realm_characters.origin_id', 'realm_passes.origin_id'], 'the five records a row holds a character by - an offline id each, never a realm id the service minted');
  const tables = (db) => db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name).sort();
  const before = new DatabaseSync(':memory:');
  for (const f of BEFORE) before.exec(sql(f));
  const { db } = migrated(() => {});
  assert.deepEqual(tables(db), tables(before), 'no table left behind');
  assert.ok(!db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'founder_holdings%'").all().length, 'nor its index');
  assert.ok(db.prepare('PRAGMA table_info(players)').all().some((c) => c.name === 'first_played_at' && c.type === 'INTEGER' && !c.notnull));
  // the newest when it landed; FIELD BUGS 2026-10-04d KNIGHT-HOUSE's 0079 came after it at that branch's merge of main -
  // so the pin is what BEFORE needs: one of the service's migrations, every one before it applied first
  assert.ok(MIGRATIONS.indexOf(FILE) > 0, 'one of the service\'s migrations');
});

// ── THE SERVICE, end to end ─────────────────────────────────────────
// Two guests made through the Worker's own routes on the real clock (past the cutoff), one of them set back before it
// and given a cloud save; the other registered, with a save of the same character; then 0078 applied to the live
// database - as the deploy applies it - and the account asked again.

function d1Before() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of [...BEFORE, ...AFTER]) db.exec(sql(f));
  return {
    _raw: db,
    prepare(q) {
      const stmt = db.prepare(q);
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
      };
      return api;
    },
  };
}

test('FOUNDER4, end to end: an account registered after the cutoff, holding a character a guest from before it held, holds nothing until 0078 runs - then Founder in its wardrobe and on its signed token; an account with a character of its own still none', async () => {
  const { subtle } = globalThis.crypto;
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  const env = { DB: d1Before(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const call = async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const raw = env.DB._raw;
  const save = (player, character) => raw.prepare('INSERT INTO saves (player_id, character_id, save_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(player, character, 'QuickSave', Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000));
  assert.ok(Math.floor(Date.now() / 1000) > CUT, 'the real clock is past the cutoff');

  const browser = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;   // the browser's guest, before the cutoff
  raw.prepare('UPDATE players SET created_at = ? WHERE id = ?').run(CUT - 5 * DAY, browser.id);
  save(browser.id, '3f0c2a9e-1b7d-4c55-9a61-0d2f6e8b7c11');
  const desktop = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;   // the desktop app's, registered there
  assert.equal((await call('POST', '/v1/auth/register', { handle: 'Returning', password: 'a-long-enough-password', ...ACCEPTED }, desktop.secret)).status, 200);
  save(desktop.id, '3f0c2a9e-1b7d-4c55-9a61-0d2f6e8b7c11');
  const stranger = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
  assert.equal((await call('POST', '/v1/auth/register', { handle: 'Newcomer', password: 'a-long-enough-password', ...ACCEPTED }, stranger.secret)).status, 200);
  save(stranger.id, '9a1d7e40-5c2b-4f18-8e33-7b6c0f2a9d54');

  assert.deepEqual((await call('GET', '/v1/account', undefined, desktop.secret)).body.wardrobe.titles, [], 'before the migration: none, as FOUNDER3 left it');

  raw.exec(sql(FILE));
  const seen = (await call('GET', '/v1/account', undefined, desktop.secret)).body;
  assert.deepEqual(seen.wardrobe.titles, ['founder'], 'after it: Founder');
  assert.equal((await call('POST', '/v1/account/title', { title: 'founder' }, desktop.secret)).status, 200, 'and it may be worn');
  const got = await call('POST', '/v1/auth/token', { secret: desktop.secret });
  assert.equal(got.status, 200);
  const r = await verifyToken(got.body.token, pub, { subtle, nowS: Math.floor(Date.now() / 1000) });
  assert.ok(r.ok, r.why);
  assert.equal(r.claims.t, 'founder', 'worn on the token the relay reads');
  assert.deepEqual((await call('GET', '/v1/account', undefined, stranger.secret)).body.wardrobe.titles, [], 'a character of its own alone: none');
  assert.equal((await call('POST', '/v1/account/title', { title: 'founder' }, stranger.secret)).status, 403);
});
