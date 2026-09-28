// FOUNDER3 (2026-09-27, Mac: "we still need to grant everyone the founder title befire the original cut off date. A
// lot of people are missing it"). Founder was read off `registered_at`, and registering is only the moment a player
// chose a name: a player here as a guest since before the cutoff who registered after it held nothing (Field-Bugs
// 2026-09-26b, report 3). It is read off when the account FIRST PLAYED now - the row's `created_at`, stamped at first
// contact and kept through registration's upgrade in place. The instant (2026-09-25T00:00Z, FOUNDER2's) does not move,
// so nobody who holds it loses it, and it is still registered accounts only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { titlesHeld, titleWorn, equipRefusal, FOUNDER_UNTIL } from '../server-account/src/titles.js';
import { verifyToken, importPublicKeyB64 } from '../src/net/identityToken.js';

const DAY = 24 * 60 * 60;
const CUT = Date.UTC(2026, 8, 25) / 1000;

test('FOUNDER3: an account that first played by the cutoff holds Founder whenever it registered (mutants: registration again; the later stamp; first contact exclusive)', () => {
  const since = { handle: 'Played', created_at: CUT - 3 * DAY, registered_at: CUT + 2 * DAY, title: null };
  assert.deepEqual(titlesHeld(since, {}), ['founder'], 'a guest before the cutoff, registered after it');
  assert.equal(equipRefusal('founder', since, {}), null, 'and it may be worn');
  assert.equal(titleWorn({ ...since, title: 'founder' }, {}), 'founder');
  assert.deepEqual(titlesHeld({ handle: 'Dot', created_at: CUT, registered_at: CUT + DAY }, {}), ['founder'], 'first played in the cutoff second');
  assert.deepEqual(titlesHeld({ handle: 'New', created_at: CUT + 1, registered_at: CUT + 1 }, {}), [], 'first played a second past it: none');
  assert.equal(FOUNDER_UNTIL, CUT, 'the instant did not move');
});

test('FOUNDER3: a row with no birth stamp is judged by its registration, as before (mutants: no birth a founder; the birth alone)', () => {
  assert.deepEqual(titlesHeld({ handle: 'Old', registered_at: 1 }, {}), ['founder']);
  assert.deepEqual(titlesHeld({ handle: 'After', registered_at: CUT + 1 }, {}), []);
  assert.deepEqual(titlesHeld({ handle: 'Odd', created_at: 'x', registered_at: CUT - 1 }, {}), ['founder'], 'a stamp that is not a number is no stamp');
});

test('FOUNDER3: a guest holds none until it registers, and then at once - D1 gives a guest a NULL registered_at, which Math.min reads as 0 (mutant: the registered guard dropped)', () => {
  const guest = { handle: null, created_at: CUT - 3 * DAY, registered_at: null };
  assert.deepEqual(titlesHeld(guest, {}), []);
  assert.equal(equipRefusal('founder', guest, {}), 'not-held');
  assert.deepEqual(titlesHeld({ ...guest, handle: 'Played', registered_at: CUT + 30 * DAY }, {}), ['founder']);
});

// ── THE SERVICE, end to end ─────────────────────────────────────────
// The guest is made and registered through the Worker's own routes on the real clock (past the cutoff since
// 2026-09-25, and only moving away from it); the one thing set by hand is that guest's first contact, before it.

const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(readFileSync(new URL(`../server-account/migrations/${f}`, import.meta.url), 'utf8'));
  return {
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

test('FOUNDER3, end to end: a guest first seen before the cutoff and registered after it wears Founder on its signed token; one first seen after holds none', async () => {
  const { subtle } = globalThis.crypto;
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const call = async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const nowS = Math.floor(Date.now() / 1000);
  assert.ok(nowS > CUT, 'the real clock is past the cutoff, so every registration below lands after it');

  const since = (await call('POST', '/v1/auth/guest', {})).body;
  await env.DB.prepare('UPDATE players SET created_at = ? WHERE id = ?').bind(CUT - 3 * DAY, since.id).run();
  assert.equal((await call('POST', '/v1/auth/register', { handle: 'Played', password: 'a-long-enough-password' }, since.secret)).status, 200);
  const seen = (await call('GET', '/v1/account', undefined, since.secret)).body;
  assert.equal(seen.account.createdAt, CUT - 3 * DAY, 'the upgrade in place kept the first contact');
  assert.ok(seen.account.registeredAt > CUT, 'registered after the cutoff');
  assert.deepEqual(seen.wardrobe.titles, ['founder']);
  assert.equal((await call('POST', '/v1/account/title', { title: 'founder' }, since.secret)).status, 200);
  const got = await call('POST', '/v1/auth/token', { secret: since.secret });
  assert.equal(got.status, 200);
  const r = await verifyToken(got.body.token, pub, { subtle, nowS: Math.floor(Date.now() / 1000) });
  assert.ok(r.ok, r.why);
  assert.equal(r.claims.t, 'founder', 'worn on the token the relay reads');

  const fresh = (await call('POST', '/v1/auth/guest', {})).body;
  assert.equal((await call('POST', '/v1/auth/register', { handle: 'Later', password: 'a-long-enough-password' }, fresh.secret)).status, 200);
  const late = (await call('GET', '/v1/account', undefined, fresh.secret)).body;
  assert.deepEqual(late.wardrobe.titles, [], 'first seen after the cutoff: none');
  assert.equal((await call('POST', '/v1/account/title', { title: 'founder' }, fresh.secret)).status, 403);
});
