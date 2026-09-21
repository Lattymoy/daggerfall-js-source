// ACC1b - THE ACCOUNT SERVICE (2026-09-21, Mac: "cloud storage and
// account creation needed for accessing online mode" / "Im not
// rotating. Lets do this").
//
// THE SQL IS THE REAL SQL. These pins apply
// `server-account/migrations/0001_accounts.sql` to a real SQLite
// (node:sqlite) through a D1-shaped adapter and run the service's own
// statements against it. D1 IS SQLite, so the schema, the UNIQUE index
// and the foreign key are the ones that will be live - a hand-rolled
// fake would have proved only that the fake agreed with itself, and
// would have been green with a typo'd index.
//
// WHAT IT STILL DOES NOT PROVE, written down rather than implied: there
// is no network here, no Cloudflare, and no D1 rate or size limit. It
// proves the law and the SQL, not the deployment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker, { ACCOUNT_VERSION, MAX_BODY_BYTES, _resetKeyForTests } from '../server-account/src/index.js';
import {
  createGuest, openSession, resolveSession, closeSession, closeAllSessions,
  devicesOf, accountView, displayName, accountKind, hashSecret, mintId, handleRefusal,
} from '../server-account/src/accounts.js';
import { guestName, GUEST_BANKS, pick, isGuestShaped, isHandleShaped } from '../server-account/src/guestName.js';
import { verifyToken, importPublicKeyB64, ID_RE, nameIsIssuable } from '../src/net/identityToken.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const NOW = 1_758_400_000;

/** A D1-shaped face over node:sqlite. D1's surface is
 *  `prepare().bind().first()/run()/all()`, and this is that surface and
 *  nothing more - a fake that offered more than D1 does would let a
 *  query pass here and fail in production. */
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(src('server-account/migrations/0001_accounts.sql'));
  return {
    _raw: db,
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
const ctx = (db) => ({ db, subtle, rand, nowS: NOW });

test('ACC1b: the migration is the real schema, and applying it twice changes nothing', () => {
  const db = d1();
  // IDEMPOTENT BY CONSTRUCTION - every statement IF NOT EXISTS - so the
  // deploy can run every migration every time and nobody has to
  // remember which ones landed.
  assert.doesNotThrow(() => db._raw.exec(src('server-account/migrations/0001_accounts.sql')));
  const tables = db._raw.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((r) => r.name);
  assert.deepEqual(tables, ['players', 'sessions']);
  // ACC1b IS IDENTITY ALONE. Saves and provider links arrive as their
  // own migrations rather than as columns somebody added here.
  const cols = db._raw.prepare('PRAGMA table_info(players)').all().map((c) => c.name);
  assert.deepEqual(cols.sort(), ['created_at', 'guest_name', 'handle', 'handle_lc', 'id', 'last_seen', 'muted_until']);
});

test('ACC1b: a guest is a REAL ROW from first contact, and its secret is never stored', async () => {
  const db = d1();
  const made = await createGuest(ctx(db), { deviceLabel: 'a desktop' });
  assert.match(made.id, ID_RE, 'the id is the shape SOC1 and the token both agree on');
  assert.equal(made.kind, 'guest');
  assert.ok(made.secret.length >= 32);
  assert.match(made.sessionId, ID_RE);

  // THE RAW SECRET IS NOWHERE IN THE DATABASE. A copy of these tables
  // is not a copy of anybody's credentials - held by looking for the
  // string across every column of both tables rather than by trusting
  // the INSERT.
  const dump = JSON.stringify([
    db._raw.prepare('SELECT * FROM players').all(),
    db._raw.prepare('SELECT * FROM sessions').all(),
  ]);
  assert.ok(!dump.includes(made.secret), 'the raw secret is in the database');
  assert.ok(dump.includes(await hashSecret(made.secret, { subtle })), 'and its hash is what the table keeps');
});

test('ACC1b: TWO DEVICES AT ONCE - the bug Fight Life paid for, not ported', async () => {
  // One secret per player, rotated on sign-in, made two devices
  // mutually exclusive: a desktop sign-in silently 401'd the phone on
  // every write, and Mac found it by playing. A SESSION is the
  // credential here, so this is a property rather than a hope.
  const db = d1();
  const first = await createGuest(ctx(db), { deviceLabel: 'desktop' });
  const second = await openSession(ctx(db), first.id, 'phone');

  for (const s of [first.secret, second.secret]) {
    const who = await resolveSession(ctx(db), s);
    assert.ok(who, 'a device that was admitted stopped working');
    assert.equal(who.player.id, first.id, 'two devices, ONE player');
  }
  assert.notEqual(first.secret, second.secret);
  assert.equal((await devicesOf(ctx(db), first.id)).length, 2);

  // SIGNING OUT IS THIS DEVICE. Every account system a player has used
  // behaves this way; a laptop has never dropped somebody's phone.
  const me = await resolveSession(ctx(db), first.secret);
  assert.deepEqual(await closeSession(ctx(db), me.session.id), { revoked: 1 });
  assert.equal(await resolveSession(ctx(db), first.secret), null, 'this device was not signed out');
  assert.ok(await resolveSession(ctx(db), second.secret), 'the OTHER device was signed out too');

  // ...and "everywhere" is the separate, explicit act.
  assert.deepEqual(await closeAllSessions(ctx(db), first.id), { revoked: 1 });
  assert.equal(await resolveSession(ctx(db), second.secret), null);
});

test('ACC1b: a secret resolves in ONE lookup, and a bad one is null rather than a throw', async () => {
  const db = d1();
  const made = await createGuest(ctx(db));
  // The caller has not proved a player id yet, so the id cannot be part
  // of the question - the secret alone finds the session, off the
  // UNIQUE index the migration declares.
  const idx = db._raw.prepare("SELECT sql FROM sqlite_master WHERE name='idx_sessions_secret'").get();
  assert.match(idx.sql, /UNIQUE/, 'the hot path is no longer one indexed lookup');

  for (const bad of [null, undefined, 0, {}, [], '', 'short', 'x'.repeat(200), made.secret + 'a']) {
    assert.equal(await resolveSession(ctx(db), bad), null, `${String(bad)} resolved to a session`);
  }
  // a session whose player is gone is not a session - the cascade
  // should make it unreachable, and it is checked anyway
  db._raw.exec('PRAGMA foreign_keys = ON');
  db._raw.prepare('DELETE FROM players WHERE id = ?').run(made.id);
  assert.equal(await resolveSession(ctx(db), made.secret), null);
  assert.equal(db._raw.prepare('SELECT COUNT(*) c FROM sessions').get().c, 0, 'the cascade left the session behind');
});

test('ACC1b: A GUEST NAME AND A HANDLE CANNOT COLLIDE, and it is structural', async () => {
  // Mac: "definitely a random name". The guarantee is the SHAPE - a
  // generated name carries exactly one space and a handle carries none
  // - so no lookup is needed to keep them apart and none can race a
  // rename. The alternative, checking each generated name against the
  // handle table, answers "not taken YET".
  for (let i = 0; i < 200; i++) {
    const n = guestName(rand);
    assert.ok(isGuestShaped(n), `${n} is not the guest shape`);
    assert.ok(!isHandleShaped(n), `${n} could have been chosen as a handle`);
    assert.ok(nameIsIssuable(n), `${n} cannot ride a token`);
  }
  assert.ok(isHandleShaped('Nystul'));
  assert.ok(!isGuestShaped('Nystul'));
  assert.ok(GUEST_BANKS.length >= 5, 'the banks are the game\'s own and there are several');
  // the names come from DAGGERFALL'S OWN BANK - the same file the
  // chargen wizard and every townsperson draw from
  assert.match(src('server-account/src/guestName.js'), /characters\/nameGen\.json/);

  // THE BANK'S OWN ALPHABET, DERIVED - because the first cut of this
  // law spelled the guest shape as `[A-Za-z]+ [A-Za-z]+` and its own
  // pin caught `Akh'ar Arabi` on the eighteenth draw. DFU's banks carry
  // apostrophes and hyphens. Enumerating an alphabet is how a rule
  // comes to disagree with the data it is about, so the law rests on
  // the SPACE alone now - and what this asks is the thing that would
  // actually break it.
  const banks = JSON.parse(src('src/characters/nameGen.json'));
  const chars = new Set();
  for (const b of Object.values(banks)) for (const set of b.sets ?? []) for (const part of set.parts ?? []) {
    for (const c of part) chars.add(c);
  }
  assert.ok(chars.size > 40, 'the bank went empty');
  const whitespace = [...chars].filter((c) => /\s/.test(c));
  assert.deepEqual(whitespace, [], 'a bank part carries whitespace - a guest name would have two spaces and the law breaks');
  // every character the banks hold can ride a token, whatever it is
  for (const c of chars) assert.ok(nameIsIssuable(`Ab${c}cd Efgh`), `the banks carry ${JSON.stringify(c)}, which the wire refuses`);

  // and the draw is unbiased: rejection sampling over whole bytes, so
  // the tail above the last whole multiple is thrown away rather than
  // folded back onto the low indices
  // THE REJECTION IS REAL, asked the one way that cannot be faked: for
  // n=3 the last whole multiple inside a byte is 255, so the value 255
  // must be THROWN AWAY and redrawn. A generator that only ever offers
  // it can therefore never answer - where plain `% 3` would hand back 0
  // and never notice. (The distribution alone cannot see this: over
  // exactly 255 accepted draws both spellings come out 85/85/85, which
  // is how the biased version survived the first campaign.)
  assert.throws(() => pick(3, (b) => { b[0] = 255; }), /unbiased/,
    'the value above the last whole multiple was folded back onto index 0');
  // ...and a value inside the range is used as it stands
  assert.equal(pick(3, (b) => { b[0] = 7; }), 1);
  assert.equal(pick(10, (b) => { b[0] = 249; }), 9);
  assert.throws(() => pick(10, (b) => { b[0] = 250; }), /unbiased/, '250 is in the tail for n=10');
  assert.throws(() => pick(0, rand), RangeError);
  assert.equal(pick(1, () => { throw new Error('a single choice needs no randomness'); }), 0);
});

test('ACC1b: handle_lc is UNIQUE, which is the gap in the schema this was lifted from', async () => {
  // Fight Life's `handle` is a bare TEXT column with no constraint -
  // defensible for a display name beside a ladder rating, and not
  // defensible where the name IS the identity: two players called
  // Nystul is the same defect as forging one, only slower.
  const db = d1();
  const a = await createGuest(ctx(db));
  const b = await createGuest(ctx(db));
  const take = (id, h) => db._raw.prepare('UPDATE players SET handle = ?, handle_lc = ? WHERE id = ?')
    .run(h, h.toLowerCase(), id);
  take(a.id, 'Nystul');
  assert.throws(() => take(b.id, 'NYSTUL'), /UNIQUE|constraint/i, 'casing smuggled a duplicate past the index');
  assert.throws(() => take(b.id, 'Nystul'), /UNIQUE|constraint/i);
  take(b.id, 'Medora');   // ...and a different one is fine

  // THE DISPLAYED NAME IS DERIVED, in one place, so the service and the
  // token can never disagree about what somebody is called.
  const row = db._raw.prepare('SELECT * FROM players WHERE id = ?').get(a.id);
  assert.equal(displayName(row), 'Nystul');
  assert.equal(accountKind(row), 'linked', 'a handle is what makes an account linked');
  const guest = db._raw.prepare('SELECT * FROM players WHERE id = ?').get((await createGuest(ctx(db))).id);
  assert.equal(displayName(guest), guest.guest_name);
  assert.equal(accountKind(guest), 'guest');

  // every guest keeps a handle_lc of NULL, and the partial index lets
  // as many of them coexist as there are players
  assert.equal(db._raw.prepare('SELECT COUNT(*) c FROM players WHERE handle_lc IS NULL').get().c, 1);
});

test('ACC1b: a handle is refused at ENTRY, by shape and by the port\'s own filter', async () => {
  assert.equal(handleRefusal('Nystul'), null);
  assert.equal(handleRefusal('Ser-Kithlan'), null);
  for (const bad of ['Theod Gwyn', ' Nystul', 'Nystul ', 'ab', '', 'x'.repeat(40), 42, null, '1Nystul']) {
    assert.ok(handleRefusal(bad), `${String(bad)} was allowed as a handle`);
  }
  // NAME-F2's law: refuse at entry rather than repair at exit, so the
  // token never has to carry a name the wire would have replaced.
  assert.match(src('server-account/src/accounts.js'), /nameIsIssuable/);
});

test('ACC1b: nothing a client is told carries a credential', async () => {
  const db = d1();
  const made = await createGuest(ctx(db), { deviceLabel: 'desktop' });
  const who = await resolveSession(ctx(db), made.secret);
  const view = JSON.stringify({
    account: accountView(who.player, NOW),
    devices: await devicesOf(ctx(db), made.id),
  });
  assert.ok(!view.includes(made.secret), 'the view carries the raw secret');
  assert.ok(!view.includes(who.session.secret_hash), 'the view carries a secret HASH - a credential\'s shadow ships for no reason');
  assert.ok(!/secret/i.test(view), `a field named like a credential: ${view}`);
  // ...and a device label is shown but never trusted: it is the
  // player's own words, truncated
  const long = await openSession(ctx(db), made.id, 'x'.repeat(500));
  const rows = await devicesOf(ctx(db), made.id);
  assert.ok(rows.some((r) => r.label?.length === 64), 'a label was stored unbounded');
  assert.ok(long.secret);
});

// ── THE WORKER, end to end ──────────────────────────────────────────

async function stand() {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pubB64 = Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url');
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: 'https://daggerfalljs.dev' };
  const call = async (method, path, body) => {
    const req = new Request(`https://accounts.invalid${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const res = await worker.fetch(req, env);
    return { status: res.status, headers: res.headers, body: await res.json().catch(() => null) };
  };
  return { env, call, pubB64 };
}

test('ACC1b: the Worker mints a guest, then a token the RELAY\'s public key verifies', async () => {
  const { call, pubB64 } = await stand();
  const health = await call('GET', '/v1/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.v, 'test1', '/health names the deploy, as the relay\'s does');
  assert.equal(health.headers.get('access-control-allow-origin'), 'https://daggerfalljs.dev');

  const guest = (await call('POST', '/v1/auth/guest', { label: 'desktop' })).body;
  assert.match(guest.id, ID_RE);
  assert.ok(isGuestShaped(guest.name));

  const got = await call('POST', '/v1/auth/token', { secret: guest.secret });
  assert.equal(got.status, 200);
  assert.equal(got.body.name, guest.name);
  assert.equal(got.body.kind, 'guest');

  // THE SEAM: the relay holds the PUBLIC half and nothing else, and
  // that is enough. Driven with the real key the tool would print.
  const pub = await importPublicKeyB64(pubB64, { subtle });
  const v = await verifyToken(got.body.token, pub, { subtle, nowS: Math.floor(Date.now() / 1000) });
  assert.equal(v.ok, true, v.why);
  assert.equal(v.claims.s, guest.id);
  assert.equal(v.claims.n, guest.name, 'the relay is told the name the SERVICE holds, not one a client wrote');
  assert.equal(v.claims.k, 'guest');

  // AND THE CLIENT CANNOT PUT A NAME IN IT. This is the whole point of
  // the token - the hole it closes is that the hello carries a name the
  // client wrote - so a request that ASKS for one is driven, and the
  // token still carries the account's own. A signed lie is worse than
  // an unsigned one, because the relay would believe it.
  const asked = await call('POST', '/v1/auth/token', { secret: guest.secret, name: 'Mac', kind: 'linked', s: 'somebody-else' });
  const forged = await verifyToken(asked.body.token, pub, { subtle, nowS: Math.floor(Date.now() / 1000) });
  assert.equal(forged.ok, true, forged.why);
  assert.equal(forged.claims.n, guest.name, 'a name in the request body reached the token');
  assert.equal(forged.claims.k, 'guest', 'a kind in the request body reached the token');
  assert.equal(forged.claims.s, guest.id, 'a subject in the request body reached the token');
});

test('ACC1b: every route needs a secret, and a bad one is 401 and nothing else', async () => {
  const { call } = await stand();
  const guest = (await call('POST', '/v1/auth/guest', {})).body;
  for (const [m, p, b] of [
    ['POST', '/v1/auth/token', { secret: 'nope' }],
    ['POST', '/v1/auth/session', { secret: 'nope' }],
    ['POST', '/v1/auth/logout', { secret: 'nope' }],
    ['GET', '/v1/account?secret=nope', undefined],
  ]) {
    const r = await call(m, p, b);
    assert.equal(r.status, 401, `${m} ${p}`);
    assert.deepEqual(r.body, { error: 'auth' }, 'a refusal says that it failed, never why');
  }
  // ...and with the real one, the account comes back with its devices
  const acct = await call('GET', `/v1/account?secret=${encodeURIComponent(guest.secret)}`);
  assert.equal(acct.status, 200);
  assert.equal(acct.body.account.playerId, guest.id);
  assert.equal(acct.body.devices.length, 1);

  // a second device, admitted by the first
  const second = await call('POST', '/v1/auth/session', { secret: guest.secret, label: 'phone' });
  assert.equal(second.status, 200);
  assert.equal((await call('POST', '/v1/auth/token', { secret: second.body.secret })).status, 200,
    'the second device could not get a token');

  // logging out of one leaves the other
  await call('POST', '/v1/auth/logout', { secret: guest.secret });
  assert.equal((await call('POST', '/v1/auth/token', { secret: guest.secret })).status, 401);
  assert.equal((await call('POST', '/v1/auth/token', { secret: second.body.secret })).status, 200);

  // A PATH NOBODY SERVES IS A 404, answered BEFORE the credential is
  // looked at. The first cut checked auth first, so every unknown path
  // answered 401 to a caller with no secret - a shade harder to
  // enumerate, and a lie that costs an afternoon the first time
  // somebody typos a route. The paths are in this repo; they are not
  // the secret.
  assert.equal((await call('GET', '/v1/nope')).status, 404);
  assert.equal((await call('POST', '/v1/nope', {})).status, 404);
  // ...and a path it DOES serve, reached with a method it does not, is
  // a different answer again
  const wrongMethod = await call('GET', '/v1/auth/logout');
  assert.equal(wrongMethod.status, 401, 'auth still comes first on a route that exists');
  // the SECOND device's secret, because the first was signed out two
  // lines up - a revoked credential answers 401 whatever the method
  const authed = await call('GET', `/v1/auth/token?secret=${encodeURIComponent(second.body.secret)}`);
  assert.equal(authed.status, 405, 'a real route with the wrong method is a 405, not a 404');
});

test('ACC1b: the Worker refuses a body it will not read, BEFORE it parses one', async () => {
  const { call, env } = await stand();
  const huge = { secret: 'x'.repeat(MAX_BODY_BYTES * 2) };
  const r = await call('POST', '/v1/auth/guest', huge);
  assert.equal(r.status, 400);
  assert.deepEqual(r.body, { error: 'body' });
  assert.ok(MAX_BODY_BYTES <= 16 * 1024, 'this service has no request that is a novel');

  // a body that is not an object is not a request either
  for (const bad of ['"a string"', '[1,2]', '42', 'null', '{oops']) {
    const res = await worker.fetch(new Request('https://x.invalid/v1/auth/guest', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: bad,
    }), env);
    assert.equal(res.status, 400, `${bad} was read as a request`);
  }
  // and no database is a 503 that says so, not a 500 that does not
  const none = await worker.fetch(new Request('https://x.invalid/v1/auth/guest', { method: 'POST', body: '{}' }), { ...env, DB: null });
  assert.equal(none.status, 503);
});

test('ACC1b: THE PRIVATE KEY IS A SECRET, and the committed config proves it', async () => {
  // The same law test/relaydeploy.test.js holds for the Cloudflare API
  // token: a credential belongs in `wrangler secret put` and never in a
  // file this repo carries. Held by LOOKING at the file rather than by
  // remembering.
  const toml = src('server-account/wrangler.toml');
  assert.doesNotMatch(toml, /IDENTITY_PRIVATE_KEY\s*=/, 'a private key is assigned in a committed file');
  assert.doesNotMatch(toml, /MC4CAQ|BEGIN [A-Z ]*PRIVATE KEY/, 'a PKCS8 key is pasted into the config');
  assert.match(toml, /wrangler secret put/, 'the config no longer says where the key goes instead');
  // the tool that mints it writes nothing to disk
  const tool = src('tools/mintIdentityKeys.mjs');
  assert.doesNotMatch(tool, /writeFile|appendFile|createWriteStream/, 'the key tool writes a key to disk');

  // a service with no key still hands out accounts - it just cannot
  // vouch for them, and it says so rather than minting something the
  // relay will refuse
  _resetKeyForTests();
  const env = { DB: d1(), ACCOUNT_VERSION: 'test1' };
  const mk = async (p, b) => worker.fetch(new Request(`https://x.invalid${p}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b),
  }), env);
  const guest = await (await mk('/v1/auth/guest', {})).json();
  assert.ok(guest.id, 'an account could not be made without a signing key');
  const tok = await mk('/v1/auth/token', { secret: guest.secret });
  assert.equal(tok.status, 503);
  assert.deepEqual(await tok.json(), { error: 'no-signing-key' });
});

test('ACC1b: the service names its own deploy, and the version is in step', async () => {
  // RELAY_VERSION's discipline, for the same reason: a wrangler exit
  // code of 0 over an unchanged Worker is a green deploy that did not
  // happen, so /health has to answer something that moves.
  const toml = src('server-account/wrangler.toml');
  const inToml = /ACCOUNT_VERSION\s*=\s*"([^"]+)"/.exec(toml);
  assert.ok(inToml, 'the config no longer carries a version for /health to answer');
  assert.equal(inToml[1], ACCOUNT_VERSION, 'src/index.js and wrangler.toml name different deploys');

  // AND THE D1 BINDING IS COMMENTED UNTIL THE DATABASE EXISTS - a
  // binding naming a database nobody created fails the deploy in a way
  // that reads like a code error.
  assert.match(toml, /#\s*\[\[d1_databases\]\]/, 'the binding is live; the database id must be real');
  assert.doesNotMatch(toml, /^\s*\[\[d1_databases\]\]/m);
  assert.match(toml, /PUT-THE-ID-FROM-STEP-1-HERE/);
});
