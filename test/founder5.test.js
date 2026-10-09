// FOUNDER5 (2026-10-07, Mac: "Can we grant every account before sept 25th the founder title. Ive tried this multiple
// times and its never worked"; asked how, "Time zone + name list"). FOUNDER2 to FOUNDER4 each held Founder for an
// account the service could PROVE first played by 2026-09-25T00:00Z, and two kinds of player stayed outside it:
//   - THE CLOCK. 00:00Z on the 25th is 8pm on the 24th in New York and 5pm in Los Angeles - a player who first played
//     that evening played before the 25th on their own clock. The instant is now the end of the 24th on the last clock
//     to reach the 25th (UTC-12): 2026-09-25T12:00:00Z. Later only, so nobody who held it loses it.
//   - NO RECORD. A player whose play before it the service never recorded (a guest's storage cleared, a character never
//     saved to the cloud) cannot be proven by any rule. FOUNDER_HANDLES names them: a list in config, the developers'
//     law - case-folded, a registered account's alone, and it only adds.
// And then, "I want to do this without my input": FOUNDER4's link (0078) ran once, so a character carried onto a new
// account after its deploy linked nothing until a person re-ran it. server-account/src/founderLink.js writes the same
// fact as a character ARRIVES - a cloud save's new slot, a customs - with nobody's hand on it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { titlesHeld, titleWorn, equipRefusal, wardrobeOf, founderHandles, isNamedFounder, FOUNDER_UNTIL } from '../server-account/src/titles.js';
import { verifyToken, importPublicKeyB64 } from '../src/net/identityToken.js';
import { ACCEPTED } from '../src/net/legalLaw.js';
import { LINK_SQL } from '../server-account/src/founderLink.js';

const HOUR = 60 * 60;
const DAY = 24 * HOUR;
const OLD_CUT = Date.UTC(2026, 8, 25) / 1000;   // FOUNDER2's instant, 00:00Z
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ── THE CLOCK ───────────────────────────────────────────────────────

test('FOUNDER5 the clock: the cutoff is the end of 24 September at UTC-12, 2026-09-25T12:00:00Z - an account first played on the evening of the 24th in the Americas holds Founder, one a second past the new instant none (mutants: the old instant; an open end; exclusive)', () => {
  assert.equal(new Date(FOUNDER_UNTIL * 1000).toISOString(), '2026-09-25T12:00:00.000Z');
  assert.equal(FOUNDER_UNTIL, OLD_CUT + 12 * HOUR, 'twelve hours past FOUNDER2\'s 00:00Z, never earlier');
  // 9pm EDT on 24 September is 01:00Z on the 25th; 11pm PDT is 06:00Z; 11:59pm in Honolulu (UTC-10) is 09:59Z.
  for (const [where, at] of [['New York, 9pm', OLD_CUT + HOUR], ['Los Angeles, 11pm', OLD_CUT + 6 * HOUR], ['Honolulu, 11:59pm', OLD_CUT + 10 * HOUR - 60]]) {
    const row = { handle: 'Evening', created_at: at, registered_at: at };
    assert.deepEqual(titlesHeld(row, {}), ['founder'], `${where} on the 24th: before the 25th on their own clock`);
    assert.equal(equipRefusal('founder', row, {}), null, 'and it may be worn');
  }
  assert.deepEqual(titlesHeld({ handle: 'Dot', created_at: FOUNDER_UNTIL, registered_at: FOUNDER_UNTIL }, {}), ['founder'], 'the cutoff second is inside');
  assert.deepEqual(titlesHeld({ handle: 'Next', created_at: FOUNDER_UNTIL + 1, registered_at: FOUNDER_UNTIL + 1 }, {}), [], 'a second past it: the 25th everywhere, none');
  assert.deepEqual(titlesHeld({ handle: 'Later', created_at: OLD_CUT + 3 * DAY, registered_at: OLD_CUT + 3 * DAY }, {}), [], 'days after: none');
  assert.deepEqual(titlesHeld({ handle: 'Played', created_at: OLD_CUT + 2 * HOUR, registered_at: OLD_CUT + 9 * DAY }, {}), ['founder'], 'FOUNDER3\'s first play, on the evening of the 24th');
  assert.deepEqual(titlesHeld({ handle: 'Linked', created_at: OLD_CUT + 9 * DAY, registered_at: OLD_CUT + 9 * DAY, first_played_at: OLD_CUT + 2 * HOUR }, {}), ['founder'], 'FOUNDER4\'s linked first play, too');
  assert.deepEqual(titlesHeld({ handle: null, created_at: OLD_CUT + HOUR, registered_at: null }, {}), [], 'a guest still holds none');
});

// ── THE NAMES ───────────────────────────────────────────────────────

test('FOUNDER5 the names: a handle in FOUNDER_HANDLES holds Founder whenever it first played, case-folded and spaced as the other lists; a guest none; unlisted, the date decides (mutants: the list ignored; the list grants guests)', () => {
  const env = { FOUNDER_HANDLES: ' Wanderer , lateone' };
  assert.deepEqual([...founderHandles(env)], ['wanderer', 'lateone'], 'one reading of a comma list, as DEVELOPER_HANDLES');
  const late = { handle: 'wanderer', created_at: OLD_CUT + 20 * DAY, registered_at: OLD_CUT + 20 * DAY, title: null };
  assert.deepEqual(titlesHeld(late, {}), [], 'no record of play before the 25th: none by the date');
  assert.deepEqual(titlesHeld(late, env), ['founder'], 'named: held');
  assert.deepEqual(titlesHeld({ ...late, handle: 'WANDERER' }, env), ['founder'], 'case-folded');
  assert.deepEqual(titlesHeld({ ...late, handle: 'LateOne' }, env), ['founder']);
  assert.equal(equipRefusal('founder', late, env), null, 'and it may be worn');
  assert.equal(titleWorn({ ...late, title: 'founder' }, env), 'founder');
  assert.equal(titleWorn({ ...late, title: 'founder' }, {}), undefined, 'off the list, it is not worn on the next token');
  assert.deepEqual(titlesHeld({ ...late, handle: 'Wanderer2' }, env), [], 'the handle exactly');
  assert.deepEqual(titlesHeld({ ...late, handle: null, registered_at: null }, env), [], 'a guest has no handle to name');
  assert.equal(isNamedFounder({ handle: '' }, { FOUNDER_HANDLES: ',' }), false, 'an empty handle is nobody');
  assert.deepEqual(titlesHeld({ handle: 'Early', created_at: 1, registered_at: 1 }, env), ['founder'], 'a founder by the date holds it unlisted');
  assert.deepEqual(titlesHeld({ handle: 'wanderer', created_at: 1, registered_at: 1 }, env), ['founder'], 'held once, never twice, by the date and the name both');
  assert.deepEqual(titlesHeld(late, { ...env, DEVELOPER_HANDLES: 'wanderer' }), ['founder', 'developer'], 'founder first, in its place among the titles');
  assert.deepEqual(wardrobeOf(late, env, OLD_CUT + 21 * DAY).titles, ['founder'], 'the account card shows it');
});

test('FOUNDER5 the config: FOUNDER_HANDLES is a var in wrangler.toml beside the developers\' and moderators\' lists; the version moved to acct92 (CRAFT2-CRAFT5 on to acct93 since, SD9b\'s acct94 after it, and SCALE4a-c\'s acct95 after that)', () => {
  const toml = src('server-account/wrangler.toml');
  assert.match(toml, /^FOUNDER_HANDLES = "[^"]*"$/m);
  assert.match(toml, /^ACCOUNT_VERSION = "acct101"$/m);
  assert.match(src('server-account/src/service.js'), /export const ACCOUNT_VERSION = 'acct101';/);   // PIN MOVED: INT1-INT6's acct100 (the INTEGRITY arc's lane 1, migration 0096 - renumbered past CARDS9 and CARDS10's acct99 at the merge) last; before it CRAFT2-CRAFT5's acct93, then SD9b's acct94 (the Super Dungeons arc's merges of main), then SCALE4a-c's acct95 (acct94 on its branch, renumbered past SD9b at the merge)
});

// ── THE SERVICE, end to end ─────────────────────────────────────────

const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    _raw: db,
    // D1's batch: every statement in one transaction, all or none (customs writes in one)
    async batch(stmts) {
      db.exec('BEGIN');
      try { const out = []; for (const st of stmts) out.push(await st.run()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    prepare(sql) {
      const stmt = db.prepare(sql);
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

test('FOUNDER5, end to end: an account first seen on the evening of the 24th in the Americas, and one named in FOUNDER_HANDLES, each wear Founder on the signed token; one neither holds none', async () => {
  const { subtle } = globalThis.crypto;
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*', FOUNDER_HANDLES: 'Wanderer' };
  const call = async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  assert.ok(Math.floor(Date.now() / 1000) > FOUNDER_UNTIL, 'the real clock is past the cutoff, so every registration below lands after it');
  const signedTitle = async (secret) => {
    const got = await call('POST', '/v1/auth/token', { secret });
    assert.equal(got.status, 200);
    const r = await verifyToken(got.body.token, pub, { subtle, nowS: Math.floor(Date.now() / 1000) });
    assert.ok(r.ok, r.why);
    return r.claims.t;
  };
  const account = async (handle, firstSeen = null) => {
    const g = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
    if (firstSeen !== null) await env.DB.prepare('UPDATE players SET created_at = ? WHERE id = ?').bind(firstSeen, g.id).run();
    assert.equal((await call('POST', '/v1/auth/register', { handle, password: 'a-long-enough-password', ...ACCEPTED }, g.secret)).status, 200);
    return g.secret;
  };

  const evening = await account('Evening', OLD_CUT + 2 * HOUR);   // 10pm in New York on the 24th
  assert.deepEqual((await call('GET', '/v1/account', undefined, evening)).body.wardrobe.titles, ['founder']);
  assert.equal((await call('POST', '/v1/account/title', { title: 'founder' }, evening)).status, 200);
  assert.equal(await signedTitle(evening), 'founder', 'worn on the token the relay reads');

  const named = await account('wanderer');   // first seen today, named in the config
  assert.deepEqual((await call('GET', '/v1/account', undefined, named)).body.wardrobe.titles, ['founder']);
  assert.equal((await call('POST', '/v1/account/title', { title: 'founder' }, named)).status, 200);
  assert.equal(await signedTitle(named), 'founder');

  const neither = await account('Newcomer');
  assert.deepEqual((await call('GET', '/v1/account', undefined, neither)).body.wardrobe.titles, [], 'first seen after the cutoff, not named: none');
  assert.equal((await call('POST', '/v1/account/title', { title: 'founder' }, neither)).status, 403);
});

// ── THE LINK, KEPT LIVE ─────────────────────────────────────────────

test('FOUNDER5 the live link: the statement asks the four holdings 0078 asks that can be asked by character (renown_tracks left out, read whole by character), one hop, earlier only; 0087 indexes saves and realm characters by character', () => {
  const sources = [...LINK_SQL.matchAll(/SELECT (\w+) FROM (\w+) WHERE (\w+) = \?2/g)].map((m) => `${m[2]}.${m[3]}`);
  assert.deepEqual(sources, ['realm_census.char_id', 'saves.character_id', 'realm_characters.origin_id', 'realm_passes.origin_id']);
  assert.doesNotMatch(LINK_SQL, /renown_tracks/);
  assert.doesNotMatch(LINK_SQL, /o\.first_played_at/, 'one hop: another row\'s own link is never followed');
  const migration = src('server-account/migrations/0087_founder_live.sql');
  assert.match(migration, /^CREATE INDEX IF NOT EXISTS idx_saves_character ON saves \(character_id\);$/m);
  assert.match(migration, /^CREATE INDEX IF NOT EXISTS idx_realm_characters_origin ON realm_characters \(origin_id\) WHERE origin_id IS NOT NULL;$/m);
  const db = new DatabaseSync(':memory:');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  const plan = (q) => db.prepare(`EXPLAIN QUERY PLAN ${q}`).all().map((r) => r.detail).join(' | ');
  assert.match(plan("SELECT player_id FROM saves WHERE character_id = 'x'"), /idx_saves_character/, 'a save asked by character reads the index');
  assert.match(plan("SELECT player FROM realm_characters WHERE origin_id = 'x'"), /idx_realm_characters_origin/);
});

async function stand() {
  const { subtle } = globalThis.crypto;
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const call = async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const raw = env.DB._raw;
  const guest = async (firstSeen) => {
    const g = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
    raw.prepare('UPDATE players SET created_at = ? WHERE id = ?').run(firstSeen, g.id);
    return g;
  };
  const account = async (handle) => {
    const g = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
    assert.equal((await call('POST', '/v1/auth/register', { handle, password: 'a-long-enough-password', ...ACCEPTED }, g.secret)).status, 200);
    return g;
  };
  const titles = async (who) => (await call('GET', '/v1/account', undefined, who.secret)).body.wardrobe.titles;
  const card = (who, char, name = 'QuickSave') => call('PUT', `/v1/saves/${char}/${name}`, { characterName: 'Hero', gameTime: 1, realTime: 1, saveVersion: 1 }, who.secret);
  return { call, raw, guest, account, titles, card };
}

test('FOUNDER5 the live link, a cloud save: an account registered long after the cutoff that backs up a character a guest from before it played holds Founder at once - no migration, no list; a character no earlier row holds links nothing; a later row never moves it', async () => {
  const s = await stand();
  const CHAR = '3f0c2a9e-1b7d-4c55-9a61-0d2f6e8b7c11';
  const old = await s.guest(OLD_CUT - 5 * DAY);   // the browser's guest, before the cutoff - on the realm's census
  s.raw.prepare('INSERT INTO realm_census (player, char_id) VALUES (?, ?)').run(old.id, CHAR);
  const back = await s.account('Returning');   // registered today, in the desktop app
  assert.deepEqual(await s.titles(back), [], 'before the character arrives: none');
  assert.equal((await s.card(back, CHAR)).status, 200);
  assert.deepEqual(await s.titles(back), ['founder'], 'its first cloud save: Founder');
  const row = s.raw.prepare('SELECT first_played_at FROM players WHERE id = ?').get(back.id);
  assert.equal(row.first_played_at, OLD_CUT - 5 * DAY, 'the guest\'s first contact, recorded');

  const lone = await s.account('Newcomer');
  assert.equal((await s.card(lone, '9a1d7e40-5c2b-4f18-8e33-7b6c0f2a9d54')).status, 200);
  assert.deepEqual(await s.titles(lone), [], 'a character of its own alone: none');
  assert.equal(s.raw.prepare('SELECT first_played_at FROM players WHERE id = ?').get(lone.id).first_played_at, null);

  const late = await s.guest(OLD_CUT + 30 * DAY);   // a row after the cutoff holding the same character changes nothing
  s.raw.prepare('INSERT INTO realm_census (player, char_id) VALUES (?, ?)').run(late.id, 'c0ffee00-1111-2222-3333-444455556666');
  const third = await s.account('Third');
  assert.equal((await s.card(third, 'c0ffee00-1111-2222-3333-444455556666')).status, 200);
  assert.deepEqual(await s.titles(third), [], 'linked to a row first seen after the cutoff: none');
  assert.equal(s.raw.prepare('SELECT first_played_at FROM players WHERE id = ?').get(third.id).first_played_at, null, 'and nothing written: a link to a LATER first play records nothing');
});

test('FOUNDER5 the live link, a customs: an account that brings in, on its pass, a character a guest from before the cutoff played holds Founder at once', async () => {
  const s = await stand();
  const CHAR = 'offline-early-hero-01';
  const old = await s.guest(OLD_CUT - 9 * DAY);
  s.raw.prepare('INSERT INTO realm_census (player, char_id) VALUES (?, ?)').run(old.id, CHAR);
  const back = await s.account('Customs');
  s.raw.prepare('INSERT INTO realm_passes (player, granted_by, granted_at) VALUES (?, ?, ?)').run(back.id, 'dev', OLD_CUT + DAY);
  assert.deepEqual(await s.titles(back), []);
  const came = await s.call('POST', '/v1/realm/customs', { origin: CHAR, name: 'Hero' }, back.secret);
  assert.equal(came.status, 200, JSON.stringify(came.body));
  assert.deepEqual(await s.titles(back), ['founder'], 'brought in: Founder');
});
