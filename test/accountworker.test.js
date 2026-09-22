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
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
// AUDIT-ACC F2: these come from their own homes now, because the
// entrypoint may export ONLY `default` - workerd reads every other
// named export as an entrypoint and refuses to start over a constant.
import { ACCOUNT_VERSION, MAX_BODY_BYTES } from '../server-account/src/service.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import {
  createGuest, openSession, resolveSession, closeSession, closeAllSessions,
  devicesOf, accountView, displayName, accountKind, hashSecret, mintId, handleRefusal, LOGIN_MAX,
  SESSION_IDLE_S, ACCOUNT_MAX,
} from '../server-account/src/accounts.js';
import { guestName, GUEST_BANKS, pick, isGuestShaped, isHandleShaped } from '../server-account/src/guestName.js';
// AUDIT-ACC F7 enumerates the WHOLE name space, so it needs the bank data
// itself rather than a few draws from it.
import banks from '../src/characters/nameGen.json' with { type: 'json' };
import {
  hashPassword, verifyPassword, needsRehash, parseStored, passwordRefusal,
  mintRecoveryCode, canonicalCode, codeForHashing, timingSafeEqual, PBKDF2_ITERS, CODE_ALPHABET,
} from '../server-account/src/password.js';
import { verifyToken, importPublicKeyB64, ID_RE, nameIsIssuable, TOKEN_V } from '../src/net/identityToken.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const NOW = 1_758_400_000;

/** A D1-shaped face over node:sqlite. D1's surface is
 *  `prepare().bind().first()/run()/all()`, and this is that surface and
 *  nothing more - a fake that offered more than D1 does would let a
 *  query pass here and fail in production. */
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url))
  .filter((f) => f.endsWith('.sql')).sort();

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  // EVERY migration, in order, walked - so a migration added later is
  // under test without anybody remembering to list it here.
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
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
  // 0001 IS IDEMPOTENT BY CONSTRUCTION - every statement IF NOT EXISTS.
  assert.doesNotThrow(() => db._raw.exec(src('server-account/migrations/0001_accounts.sql')));
  // ...AND 0002 IS NOT, because SQLite has no `ALTER TABLE ... ADD
  // COLUMN IF NOT EXISTS`. That is a fact about SQLite rather than a
  // choice, and it is the reason migrations are applied by hand once
  // each rather than on every deploy - pinned so the claim in the file
  // and the behaviour cannot part.
  assert.throws(() => db._raw.exec(src('server-account/migrations/0002_passwords.sql')), /duplicate column/i);
  assert.match(src('server-account/migrations/0001_accounts.sql'), /THAT IS NOT TRUE OF EVERY MIGRATION/);

  const tables = db._raw.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((r) => r.name);
  // ACC2 added `saves` as ITS OWN TABLE and its own migration - which
  // is exactly what 0001's header said would happen ("No saves, no
  // provider links; those are ACC1c and ACC2, and each arrives as its
  // own migration rather than as a column somebody added here later").
  // A provider link is still not here.
  assert.deepEqual(tables, ['players', 'rate_limits', 'saves', 'sessions']);
  // ACC1b IS IDENTITY ALONE, and the PLAYERS row still is: the save
  // arrived beside it, never inside it.
  const cols = db._raw.prepare('PRAGMA table_info(players)').all().map((c) => c.name);
  // ACC3 added exactly ONE - `title`, the title a player WEARS, which
  // is the only part of a wardrobe that is a choice. Every GRANT is
  // derived (server-account/src/titles.js): founder from a cutoff over
  // `registered_at`, the sprout from `created_at`, developer from the
  // service's own config. None of those is a column, and this row is
  // the pin that says so.
  assert.deepEqual(cols.sort(), ['created_at', 'email', 'guest_name', 'handle', 'handle_lc', 'id',
    'last_seen', 'muted_until', 'password', 'recovery_hash', 'registered_at', 'title']);
  assert.ok(!cols.some((c) => /founder|developer|sprout|glyph|grant/i.test(c)), `a grant became a column: ${cols}`);
  // SAVES AND PROVIDER LINKS ARE STILL NOT HERE. They arrive as their
  // own migrations rather than as columns somebody added to this one.
  assert.ok(!cols.some((c) => /save|slot|provider|blob|r2/i.test(c)), `ACC2's columns arrived early: ${cols}`);
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

test('ACC1b: TWO DEVICES AT ONCE - Fight Life\'s fix, carried over rather than re-learned', async () => {
  // One secret per player, rotated on sign-in, made two devices
  // mutually exclusive: a desktop sign-in silently 401'd the phone on
  // every write, and Mac found it by playing. FIGHT LIFE ALREADY FIXED
  // THAT, with a sessions table, and this is that fix rather than an
  // independent escape from it (AUDIT-ACC F6 - the record used to imply
  // the bug was still live over there). What the pin adds is that the
  // property is DRIVEN here rather than inherited on trust: two
  // sessions are opened and both are used.
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

test('AUDIT-ACC F13: a credential is never accepted from a URL', async () => {
  // `/v1/account` read `?secret=`, excused as "read-only, and a slice
  // that makes it do more must move it". That answers the wrong risk:
  // the hazard is not mutation, it is that a URL is written into
  // Cloudflare's request logs, into a Referer header, and into browser
  // history. Read-only or not, the session secret was in all three.
  const { call } = await stand();
  const guest = (await call('POST', '/v1/auth/guest', {})).body;

  // THE OLD SPELLING MUST NOT WORK. A route that still honours it has
  // not been fixed, it has merely grown a second door.
  const viaUrl = await call('GET', `/v1/account?secret=${encodeURIComponent(guest.secret)}`);
  assert.equal(viaUrl.status, 401, 'the query string still authenticates');
  assert.deepEqual(viaUrl.body, { error: 'auth' });

  // ...and the header does.
  const viaHeader = await call('GET', '/v1/account', undefined, guest.secret);
  assert.equal(viaHeader.status, 200);
  assert.equal(viaHeader.body.account.id, guest.id);

  // THE HEADER WINS WHEN BOTH ARE PRESENT, so two sources can never
  // disagree about who is calling.
  const both = await call('POST', '/v1/auth/token', { secret: 'nonsense' }, guest.secret);
  assert.equal(both.status, 200, 'a body secret overrode the header');

  // AND THE PREFLIGHT ALLOWS IT. A header the browser is never told it
  // may send is a header no browser will send.
  const pre = await call('OPTIONS', '/v1/account');
  assert.match(pre.headers.get('access-control-allow-headers') ?? '', /authorization/i,
    'the CORS preflight does not allow the header the credential now rides in');
});

test('AUDIT-ACC F12: a credential is not a licence to hammer, and the refusal is 429', async () => {
  // Only the OPEN routes were bounded, per address, on the door.
  // Everything behind a session was unbounded, so one valid secret
  // could mint Ed25519 signatures and spend D1 as fast as the network
  // allowed. A limit that stops strangers and not members is a limit on
  // the wrong axis.
  const { call } = await stand();
  const guest = (await call('POST', '/v1/auth/guest', {})).body;

  let sawRate = 0;
  for (let i = 0; i < ACCOUNT_MAX + 5; i++) {
    const r = await call('POST', '/v1/auth/token', { secret: guest.secret });
    if (r.status === 429) { sawRate = i; break; }
  }
  assert.ok(sawRate > 0, `${ACCOUNT_MAX + 5} authenticated calls went through unbounded`);

  // 429 AND NOT 401. Telling a rate-limited player their credentials
  // are wrong sends them to reset a password that was never the
  // problem - Fight Life's own note beside the same check.
  const over = await call('POST', '/v1/auth/token', { secret: guest.secret });
  assert.equal(over.status, 429);
  assert.equal(over.body.error, 'rate');

  // ...and the bound is generous enough that ordinary play never meets
  // it: a client mints one token per connection.
  assert.ok(ACCOUNT_MAX >= 60, 'the ceiling is low enough to trip on normal play, which is an outage rather than a defence');

  // A DIFFERENT ACCOUNT IS UNAFFECTED - the bucket is per account, not
  // global, so one noisy client cannot lock everybody else out.
  const other = (await call('POST', '/v1/auth/guest', {})).body;
  assert.equal((await call('POST', '/v1/auth/token', { secret: other.secret })).status, 200,
    'one account over its limit stopped another account working');
});

test('AUDIT-ACC F9: an idle session is DEAD, and the row is deleted rather than refused', async () => {
  // `SESSION_IDLE_S` was declared, documented as the bound "before a
  // sweep may take it", and used by NOTHING. There was no sweep, so a
  // session never expired and an abandoned credential - a shared
  // machine, an old phone, a leaked backup - worked forever.
  //
  // Fight Life enforces it on the auth path rather than in a scheduled
  // job, which needs no cron that can silently stop running. That shape
  // is what was carried over, and this drives it.
  const db = d1();
  const made = await createGuest(ctx(db), { deviceLabel: 'an old phone' });
  assert.ok(await resolveSession(ctx(db), made.secret), 'a fresh session did not resolve');

  // THE BOUNDARY IS CHECKED FROM BOTH SIDES, on SEPARATE sessions - an
  // off-by-one here signs everybody out. They have to be separate
  // because a resolve that SUCCEEDS touches `last_seen`, so asking the
  // same session twice measures the touch rather than the bound. (The
  // first cut of this pin did exactly that and read as a bug in the
  // code; it was a bug in the pin, and the touch was doing its job.)
  const atBound = await openSession(ctx(db), made.id, 'a laptop');
  assert.ok(await resolveSession({ db, subtle, rand, nowS: NOW + SESSION_IDLE_S }, atBound.secret),
    'a session exactly at the bound was killed early');

  // ...and one second past it is gone.
  const past = { db, subtle, rand, nowS: NOW + SESSION_IDLE_S + 1 };
  assert.equal(await resolveSession(past, made.secret), null, 'an idle session still resolved');

  // THE ROW IS GONE, not merely refused: a dead credential stops
  // existing rather than being rejected forever. The laptop's session
  // survives, because it was used inside the window.
  const left = db._raw.prepare('SELECT id FROM sessions').all().map((r) => r.id);
  assert.deepEqual(left, [atBound.sessionId], 'the idle session was refused but left in the table');
});

test('AUDIT-ACC F10: a failed freshness write does not fail the request it rode in on', async () => {
  // The two `last_seen` touches were unguarded, so a D1 hiccup on a
  // cosmetic write turned an AUTHORISED request into a 500. By the time
  // those run the caller is already authenticated and a stale last_seen
  // is cosmetic - Fight Life says exactly this at its own touch.
  const db = d1();
  const made = await createGuest(ctx(db), {});

  // a database that answers reads and refuses every UPDATE
  const brittle = {
    _raw: db._raw,
    prepare(sql) {
      if (/^\s*UPDATE/i.test(sql)) {
        return { bind() { return this; }, async run() { throw new Error('D1_ERROR: storage is having a day'); } };
      }
      return db.prepare(sql);
    },
  };
  const who = await resolveSession({ db: brittle, subtle, rand, nowS: NOW + 60 }, made.secret);
  assert.ok(who, 'a failed cosmetic write threw away a valid session');
  assert.equal(who.player.id, made.id);
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

test('AUDIT-ACC F7: EVERY name the bank can spell is one the wire can carry', () => {
  // THE GENERATOR COULD SPELL A NAME THAT DID NOT FIT. `NAME_MAX` is 24
  // and the longest combination in the bank is 25 - `Kelkemmelian
  // Larethbinder` and three siblings - so `createGuest` threw and
  // /v1/auth/guest answered 500 for roughly one guest in 43,000. The
  // comment at that throw said it "should never fire". Nobody had
  // multiplied the bank out and compared it to the bound.
  //
  // THE SPACE IS FINITE, SO IT IS ENUMERATED RATHER THAN SAMPLED. A
  // sample of a few hundred draws would miss four names in 173,330
  // essentially always, which is exactly how this survived ACC1b's own
  // "eighteenth draw" pin.
  const combos = [];
  for (const bank of GUEST_BANKS) {
    const sets = banks[bank].sets;
    for (const a of sets[0].parts) for (const b of sets[1].parts) {
      const first = a + b;
      for (const c of sets[4].parts) for (const d of sets[5].parts) combos.push(`${first} ${c + d}`);
    }
  }
  assert.ok(combos.length > 100_000, `only ${combos.length} names - the bank shrank and this pin is no longer exhaustive`);

  // The hazard is REAL and it is MEASURED. If a future NAME_MAX or a
  // changed nameGen.json makes this empty, the rejection in guestName
  // is dead code and should go - so the pin says which it expects.
  const tooLong = combos.filter((n) => !nameIsIssuable(n));
  assert.ok(tooLong.every((n) => n.length > 24), `a name failed for a reason other than length: ${tooLong.find((n) => n.length <= 24)}`);
  assert.ok(tooLong.includes('Kelkemmelian Larethbinder'), 'the name this finding is about is no longer generable - re-read the bank before deleting the rejection');

  // ...and the rejection must stay overwhelmingly likely to terminate.
  assert.ok(tooLong.length / combos.length < 0.01,
    `${tooLong.length} of ${combos.length} names are unusable - at that rate the bounded re-draw is no longer safe`);

  // EVERY name is guest-SHAPED, which is the law the whole
  // handle-disjointness argument rests on, asked over the whole space
  // rather than over a sample.
  assert.deepEqual(combos.filter((n) => !isGuestShaped(n)), []);
});

test('AUDIT-ACC F7: the draw that used to 500 now yields a name, and an account', async () => {
  // DETERMINISTIC, not probabilistic. `pick(n, rand)` returns the byte
  // modulo n, so a scripted sequence of bytes selects exact indices -
  // this is the draw that produced `Kelkemmelian Larethbinder`, and
  // before the fix it threw.
  const scripted = (seq) => { let k = 0; return (b) => { b[0] = seq[k++] ?? 0; }; };
  const HIGH_ELF = GUEST_BANKS.indexOf('HighElf');
  assert.ok(HIGH_ELF >= 0, 'the bank this finding came from is gone');

  // the raw draw still spells the unusable name...
  const raw = `${banks.HighElf.sets[0].parts[5]}${banks.HighElf.sets[1].parts[1]} `
    + `${banks.HighElf.sets[4].parts[11]}${banks.HighElf.sets[5].parts[8]}`;
  assert.equal(raw, 'Kelkemmelian Larethbinder');
  assert.ok(!nameIsIssuable(raw), 'the name that caused this finding now fits - the pin above says what to do');

  // ...and the generator refuses to hand it out.
  const name = guestName(scripted([5, 1, 11, 8]), 'HighElf');
  assert.ok(nameIsIssuable(name), `guestName returned a name the token cannot carry: ${name}`);
  assert.notEqual(name, raw);

  // AND THE SERVICE ANSWERS. The first byte is eaten by mintId, so the
  // bank index sits second - without it this drives a different draw
  // entirely and proves nothing, which cost this audit a wrong result
  // once already.
  const db = d1();
  const made = await createGuest(
    { db, subtle, rand: scripted([0, HIGH_ELF, 5, 1, 11, 8]), nowS: NOW }, {},
  );
  assert.ok(made.id, 'the draw that used to 500 still cannot make an account');
  assert.ok(nameIsIssuable(made.name));
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
  // AUDIT-ACC F13: a GET presents its credential in the
  // `Authorization` header, never in the URL - a query string is
  // written into Cloudflare's logs, into a Referer and into history.
  const call = async (method, path, body, bearer = null) => {
    const req = new Request(`https://accounts.invalid${path}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      },
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
  for (const [m, p, b, bearer] of [
    ['POST', '/v1/auth/token', { secret: 'nope' }],
    ['POST', '/v1/auth/session', { secret: 'nope' }],
    ['POST', '/v1/auth/logout', { secret: 'nope' }],
    ['GET', '/v1/account', undefined, 'nope'],
  ]) {
    const r = await call(m, p, b, bearer);
    assert.equal(r.status, 401, `${m} ${p}`);
    assert.deepEqual(r.body, { error: 'auth' }, 'a refusal says that it failed, never why');
  }
  // ...and with the real one, the account comes back with its devices
  const acct = await call('GET', '/v1/account', undefined, guest.secret);
  assert.equal(acct.status, 200);
  assert.equal(acct.body.account.id, guest.id);
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
  const authed = await call('GET', '/v1/auth/token', undefined, second.body.secret);
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

  // ACC1-CI RE-AIMED THIS. ACC1b kept the D1 binding COMMENTED OUT,
  // because a binding naming a database nobody had created fails the
  // deploy in a way that reads like a code error - and at the time
  // creating it was a person's job that might never happen.
  //
  // The deploy creates the database itself now, so the binding is live
  // and the thing worth holding moved: THE ID IS STILL NOT COMMITTED.
  // The remaining hazard is the opposite one - somebody pasting a real
  // id in and quietly making this repo specific to one Cloudflare
  // account. test/accountdeploy.test.js owns the rest of the seam.
  assert.match(toml, /^\[\[d1_databases\]\]/m, 'the binding is commented out again - the Worker would deploy with no database');
  const id = /^database_id\s*=\s*"([^"]+)"/m.exec(toml);
  assert.ok(id, 'the binding no longer declares a database_id');
  assert.doesNotMatch(id[1], /^[0-9a-f-]{32,}$/i, 'a real D1 id is committed - Cloudflare owns it, and the deploy resolves it');
});

test('ACC1-CI: the service hands back its own public key, openly and without a credential', async () => {
  // THE PAIR IS MINTED WHERE NO PERSON IS WATCHING, so a public key the
  // service could not hand back would be a verifying key nobody can
  // read - and the only way to get one would be to re-mint, which
  // invalidates every token already issued.
  //
  // It is answered BEFORE any credential on purpose: a public key can
  // verify and cannot mint. Anyone may check a token this service
  // signed; nobody may sign one.
  const env = { DB: d1(), ACCOUNT_VERSION: 'test1', IDENTITY_PUBLIC_KEY: 'a-public-key' };
  const get = (p, e) => worker.fetch(new Request(`https://x.invalid${p}`), e ?? env);

  const r = await get('/v1/pubkey');
  assert.equal(r.status, 200, 'the public key needs a credential, which defeats the point of publishing it');
  assert.deepEqual(await r.json(), { alg: TOKEN_V, key: 'a-public-key' });

  // THE ALGORITHM RIDES WITH IT, and it is the token's own version
  // prefix rather than a second name for the same thing - ACC1a's law:
  // the version IS the algorithm, so a reader cannot be told one thing
  // by the key and another by the token.
  assert.equal(TOKEN_V, 'v1');

  // A SERVICE WITH NO PAIR SAYS SO, rather than answering with an empty
  // key that a relay would import and then fail every verify against.
  const bare = await get('/v1/pubkey', { DB: d1(), ACCOUNT_VERSION: 'test1' });
  assert.equal(bare.status, 503);
  assert.deepEqual(await bare.json(), { error: 'no-signing-key' });

  // ...and it is a GET. The POST-only ladder the other open routes go
  // through would 405 this one.
  const posted = await worker.fetch(new Request('https://x.invalid/v1/pubkey', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  }), env);
  assert.equal(posted.status, 200, 'the public key is behind the POST-only open-route ladder');
});

// ── ACC1c: USERNAME, PASSWORD, AND THE ONE WAY BACK IN ──────────────
//
// Mac (2026-09-21): "I want email completely optional. Username and
// Password will be the main thing for the account", and "Yes" to a
// recovery code when asked what a player does who forgets one.

test('ACC1c: the stored password is self-describing, so its cost can be raised without logging anybody out', async () => {
  const stored = await hashPassword('correct horse battery', { subtle, rand });
  const parsed = parseStored(stored);
  assert.equal(parsed.alg, 'pbkdf2-sha256');
  assert.equal(parsed.iters, PBKDF2_ITERS);
  assert.equal(parsed.salt.length, 16, 'a per-account salt, not a pepper');
  assert.ok(PBKDF2_ITERS >= 210_000, 'below OWASP\'s current figure for this pairing');

  assert.equal(await verifyPassword('correct horse battery', stored, { subtle }), true);
  assert.equal(await verifyPassword('correct horse batterz', stored, { subtle }), false);

  // A ROW WRITTEN AT AN OLDER COST STILL VERIFIES, and is flagged for
  // rewriting. A bare hash column cannot be upgraded without logging
  // everybody out, which is the whole reason the string carries its own
  // parameters.
  const old = await hashPassword('correct horse battery', { subtle, rand }, 10_000);
  assert.equal(await verifyPassword('correct horse battery', old, { subtle }), true);
  assert.equal(needsRehash(old), true);
  assert.equal(needsRehash(stored), false);

  // two accounts with the SAME password do not share a hash
  const a = await hashPassword('hunter2hunter2', { subtle, rand });
  const b = await hashPassword('hunter2hunter2', { subtle, rand });
  assert.notEqual(a, b, 'the salt is not per-account');

  // a row nobody can parse is a refusal, never a throw - and never a pass
  for (const junk of [null, undefined, '', 'x', '$$$$', 'md5$1$a$b', `pbkdf2-sha256$1$${'a'.repeat(24)}$x`]) {
    assert.equal(parseStored(junk), null, `${String(junk)} parsed`);
    assert.equal(await verifyPassword('anything', junk, { subtle }), false);
  }

  // NFKC FIRST: the same password typed on two keyboards is the same
  // password, and two byte strings to a KDF.
  const composed = 'caféphrase';          // é as one code point
  const decomposed = 'caféphrase';       // e + combining acute
  assert.notEqual(composed, decomposed);
  const h = await hashPassword(composed, { subtle, rand });
  assert.equal(await verifyPassword(decomposed, h, { subtle }), true, 'a decomposed accent locked its owner out');

  // length in CODE POINTS, because that is what a person counts
  assert.equal(passwordRefusal('short'), 'short');
  assert.equal(passwordRefusal('12345678'), null);
  assert.equal(passwordRefusal('\u{1F600}'.repeat(8)), null, 'eight emoji is eight characters');
  assert.equal(passwordRefusal('x'.repeat(1000)), 'long');
  assert.equal(passwordRefusal(null), 'shape');
  // ...and no composition rules: "must contain a symbol" buys
  // `Password1!` a hundred million times over
  assert.equal(passwordRefusal('all lower case letters'), null);
});

test('ACC1c: THE RECOVERY CODE ROUND-TRIPS - the bug that would have locked people out', async () => {
  // The first cut folded Q to 0 and U to V on input. Q IS IN THE
  // ALPHABET, so a minted code carrying one canonicalised to a
  // different string than the one that was hashed - the very first code
  // this file ever printed, 7GEPQ-47BS9-AYK70-QMWYW, could not have
  // been used. This is the pin that would have caught it, and it is
  // driven over enough draws to be sure rather than lucky.
  for (let i = 0; i < 2000; i++) {
    const code = mintRecoveryCode(rand);
    assert.equal(canonicalCode(code), code.replace(/-/g, ''),
      `a minted code does not survive being read back: ${code}`);
  }
  const code = mintRecoveryCode(rand);
  assert.match(code, /^[0-9A-Z]{5}-[0-9A-Z]{5}-[0-9A-Z]{5}-[0-9A-Z]{5}$/);
  assert.ok(!CODE_ALPHABET.includes('U'), 'U is excluded from the alphabet, not folded onto V');
  for (const c of code.replace(/-/g, '')) assert.ok(CODE_ALPHABET.includes(c));

  // A PERSON WROTE THIS DOWN AND IS TYPING IT BACK. Lower case, spaces
  // instead of dashes, a scrawled O for a zero and an l for a one - all
  // of it is the same code, because refusing somebody their own account
  // over a serif is not a security property.
  const canon = canonicalCode(code);
  assert.equal(canonicalCode(code.toLowerCase()), canon);
  assert.equal(canonicalCode(code.replace(/-/g, ' ')), canon);
  assert.equal(canonicalCode(`  ${code}  `), canon);
  assert.equal(canonicalCode('O11I2-34567-89ABC-DEFGH'), '011123456789ABCDEFGH');
  // ...and something that is not a code at all is null rather than a guess
  for (const bad of [null, 42, '', 'TOOSHORT', `${code}EXTRA`, 'UUUUU-UUUUU-UUUUU-UUUUU']) {
    assert.equal(canonicalCode(bad), null, `${String(bad)} was read as a code`);
  }
  assert.equal(new Set([...Array(200)].map(() => mintRecoveryCode(rand))).size, 200, 'codes repeat');
});

test('ACC1c: registering is an UPGRADE IN PLACE, and the code is shown exactly once', async () => {
  const { call } = await stand();
  const guest = (await call('POST', '/v1/auth/guest', {})).body;

  const reg = await call('POST', '/v1/auth/register', { secret: guest.secret, handle: 'Nystul', password: 'a good long one' });
  assert.equal(reg.status, 200);
  assert.match(reg.body.recoveryCode, /^[0-9A-Z]{5}(-[0-9A-Z]{5}){3}$/);

  // THE SAME ACCOUNT. Not a new row - the id a player already had, and
  // the friends and saves that will hang off it, are untouched.
  const acct = (await call('GET', '/v1/account', undefined, guest.secret)).body;
  assert.equal(acct.account.id, guest.id, 'registering minted a new account');
  assert.equal(acct.account.name, 'Nystul');
  assert.equal(acct.account.kind, 'linked');
  assert.equal(acct.account.guestName, guest.name, 'the name the world gave them is still on the row');

  // ...and the token says so, which is how the wall at the saves will
  // ever be able to tell
  const tok = (await call('POST', '/v1/auth/token', { secret: guest.secret })).body;
  assert.equal(tok.name, 'Nystul');
  assert.equal(tok.kind, 'linked');

  // THE CODE IS NEVER READABLE AGAIN - not from the account, not from
  // anywhere. It is a credential, not a hint.
  assert.ok(!JSON.stringify(acct).includes(reg.body.recoveryCode));
  assert.ok(!/recovery/i.test(JSON.stringify(acct)), `the account view mentions recovery: ${JSON.stringify(acct)}`);

  // registering twice is refused, and so is a taken name
  assert.equal((await call('POST', '/v1/auth/register', { secret: guest.secret, handle: 'Other', password: 'a good long one' })).body.error, 'already-registered');
  const second = (await call('POST', '/v1/auth/guest', {})).body;
  const taken = await call('POST', '/v1/auth/register', { secret: second.secret, handle: 'NYSTUL', password: 'a good long one' });
  assert.equal(taken.body.error, 'handle-taken', 'casing smuggled a duplicate past the index');
  assert.equal((await call('POST', '/v1/auth/register', { secret: second.secret, handle: 'Ok', password: 'a good long one' })).body.error, 'handle-shape');
  assert.equal((await call('POST', '/v1/auth/register', { secret: second.secret, handle: 'Fine', password: 'short' })).body.error, 'password-short');
});

test('ACC1c: logging in costs the same for a handle nobody holds as for a wrong password', async () => {
  const { call } = await stand();
  const guest = (await call('POST', '/v1/auth/guest', {})).body;
  await call('POST', '/v1/auth/register', { secret: guest.secret, handle: 'Medora', password: 'a good long one' });

  const ok = await call('POST', '/v1/auth/login', { handle: 'MEDORA', password: 'a good long one', label: 'phone' });
  assert.equal(ok.status, 200, 'the handle is case-insensitive to log in with, as it is to take');
  assert.equal(ok.body.id, guest.id);
  assert.ok(ok.body.secret, 'logging in is how a SECOND device gets a credential');
  assert.equal((await call('POST', '/v1/auth/token', { secret: ok.body.secret })).status, 200);
  // ...and the first device is untouched: a login is not a rotation
  assert.equal((await call('POST', '/v1/auth/token', { secret: guest.secret })).status, 200);

  // A REFUSAL NAMES NO CAUSE. The same word for both, so the form
  // cannot be asked which names exist.
  const noUser = await call('POST', '/v1/auth/login', { handle: 'NobodyAtAll', password: 'a good long one' });
  const noPass = await call('POST', '/v1/auth/login', { handle: 'Medora', password: 'the wrong one entirely' });
  assert.equal(noUser.status, 401);
  assert.deepEqual(noUser.body, noPass.body, 'the two refusals are distinguishable');

  // ...AND NEITHER DOES THE CLOCK. Without this the form is a username
  // oracle: an attacker learns which names exist by timing, which is
  // "do not confirm the account exists" undone by a stopwatch. The
  // margin is generous because a shared CI box is noisy; what it
  // catches is the shape that MATTERS - a missing user skipping the
  // derivation entirely, which is a whole order of magnitude.
  const time = async (body) => {
    const t0 = performance.now();
    for (let i = 0; i < 3; i++) await call('POST', '/v1/auth/login', body);
    return performance.now() - t0;
  };
  const tNoUser = await time({ handle: 'StillNobody', password: 'a good long one' });
  const tNoPass = await time({ handle: 'Medora', password: 'still wrong' });
  const ratio = Math.max(tNoUser, tNoPass) / Math.max(1, Math.min(tNoUser, tNoPass));
  assert.ok(ratio < 4, `a handle nobody holds costs ${tNoUser.toFixed(0)}ms against ${tNoPass.toFixed(0)}ms - the derivation is being skipped`);
});

test('ACC1c: the recovery code sets a new password, mints a NEW code, and signs every device out', async () => {
  const { call } = await stand();
  const guest = (await call('POST', '/v1/auth/guest', {})).body;
  const reg = await call('POST', '/v1/auth/register', { secret: guest.secret, handle: 'Kithlan', password: 'the old one here' });
  const other = (await call('POST', '/v1/auth/login', { handle: 'Kithlan', password: 'the old one here' })).body;

  const back = await call('POST', '/v1/auth/recover', {
    handle: 'kithlan', code: reg.body.recoveryCode.toLowerCase(), password: 'the new one here',
  });
  assert.equal(back.status, 200);
  assert.equal(back.body.id, guest.id);

  // A NEW CODE, because a player who spends their only way in and is
  // left with none has simply had the same cliff moved one step away.
  assert.ok(back.body.recoveryCode);
  assert.notEqual(back.body.recoveryCode, reg.body.recoveryCode);

  // EVERY OTHER DEVICE IS SIGNED OUT - the reason somebody is standing
  // here may be that another person has their password.
  assert.equal((await call('POST', '/v1/auth/token', { secret: guest.secret })).status, 401);
  assert.equal((await call('POST', '/v1/auth/token', { secret: other.secret })).status, 401);
  assert.equal((await call('POST', '/v1/auth/token', { secret: back.body.secret })).status, 200, 'the device that recovered was signed out too');

  // the old password is gone, the new one works, the old code is spent
  assert.equal((await call('POST', '/v1/auth/login', { handle: 'Kithlan', password: 'the old one here' })).status, 401);
  assert.equal((await call('POST', '/v1/auth/login', { handle: 'Kithlan', password: 'the new one here' })).status, 200);
  const reused = await call('POST', '/v1/auth/recover', { handle: 'Kithlan', code: reg.body.recoveryCode, password: 'another one here' });
  assert.equal(reused.status, 401, 'a spent recovery code still worked');

  // and a code for a handle nobody holds is refused the same way
  assert.equal((await call('POST', '/v1/auth/recover', { handle: 'Nobody', code: reg.body.recoveryCode, password: 'another one here' })).body.error, 'bad-code');
});

test('ACC1c: guessing is throttled, per handle and per address', async () => {
  const { call } = await stand();
  const guest = (await call('POST', '/v1/auth/guest', {})).body;
  await call('POST', '/v1/auth/register', { secret: guest.secret, handle: 'Barenziah', password: 'a good long one' });

  let sawRate = false;
  for (let i = 0; i < LOGIN_MAX + 4; i++) {
    const r = await call('POST', '/v1/auth/login', { handle: 'Barenziah', password: `wrong ${i}` });
    if (r.status === 429) { sawRate = true; break; }
  }
  assert.ok(sawRate, `${LOGIN_MAX} wrong passwords in a window did not slow anybody down`);
  // ...and the CORRECT password is refused too while the window holds,
  // which is the point: a throttle a right answer walks through is not
  // a throttle.
  assert.equal((await call('POST', '/v1/auth/login', { handle: 'Barenziah', password: 'a good long one' })).status, 429);
  assert.ok(LOGIN_MAX >= 5 && LOGIN_MAX <= 20, 'a bound a fat-fingered player trips, or one an attacker does not');

  // A SUCCESSFUL LOGIN FORGIVES THE KEY, so somebody who mistyped twice
  // and then got it right is not still on a countdown.
  const fresh = await stand();
  const g2 = (await fresh.call('POST', '/v1/auth/guest', {})).body;
  await fresh.call('POST', '/v1/auth/register', { secret: g2.secret, handle: 'Clavicus', password: 'a good long one' });
  for (let i = 0; i < 3; i++) await fresh.call('POST', '/v1/auth/login', { handle: 'Clavicus', password: 'nope' });
  assert.equal((await fresh.call('POST', '/v1/auth/login', { handle: 'Clavicus', password: 'a good long one' })).status, 200);
  for (let i = 0; i < LOGIN_MAX - 1; i++) {
    assert.notEqual((await fresh.call('POST', '/v1/auth/login', { handle: 'Clavicus', password: 'nope' })).status, 429,
      'the counter was not forgiven by the correct login');
  }
});

test('ACC1c: a password is changed with the OLD one, and email is COMPLETELY optional', async () => {
  const { call } = await stand();
  const guest = (await call('POST', '/v1/auth/guest', {})).body;
  await call('POST', '/v1/auth/register', { secret: guest.secret, handle: 'Sheogorath', password: 'the first one' });
  const phone = (await call('POST', '/v1/auth/login', { handle: 'Sheogorath', password: 'the first one' })).body;

  // A STOLEN DEVICE SHOULD NOT BE ABLE TO LOCK ITS OWNER OUT, so the
  // old password is required even from inside a live session.
  assert.equal((await call('POST', '/v1/account/password', { secret: guest.secret, oldPassword: 'wrong', password: 'the second one' })).status, 401);
  assert.equal((await call('POST', '/v1/account/password', { secret: guest.secret, oldPassword: 'the first one', password: 'short' })).body.error, 'password-short');
  assert.equal((await call('POST', '/v1/account/password', { secret: guest.secret, oldPassword: 'the first one', password: 'the second one' })).status, 200);

  // every OTHER device out; this one stays, because the person who just
  // proved the old password is the owner
  assert.equal((await call('POST', '/v1/auth/token', { secret: guest.secret })).status, 200);
  assert.equal((await call('POST', '/v1/auth/token', { secret: phone.secret })).status, 401);

  // EMAIL IS OPTIONAL AND MEANS IT: the account has worked through all
  // of the above without one, and setting one changes nothing about
  // what it can do.
  const before = (await call('GET', '/v1/account', undefined, guest.secret)).body;
  assert.ok(!('email' in before.account), 'an address a player never gave is being shipped back to them');
  assert.equal((await call('POST', '/v1/account/email', { secret: guest.secret, email: 'someone@example.com' })).status, 200);
  assert.equal((await call('POST', '/v1/account/email', { secret: guest.secret, email: 'not an address' })).body.error, 'email');
  assert.equal((await call('POST', '/v1/account/email', { secret: guest.secret, email: null })).status, 200, 'an address cannot be taken off again');
  // nothing is gated behind it
  assert.equal((await call('POST', '/v1/auth/token', { secret: guest.secret })).status, 200);
});

test('ACC1c: no credential of any kind is stored in the clear, or shipped back', async () => {
  const { call, env } = await stand();
  const guest = (await call('POST', '/v1/auth/guest', {})).body;
  const reg = await call('POST', '/v1/auth/register', { secret: guest.secret, handle: 'Uriel', password: 'a memorable phrase' });

  const dump = JSON.stringify(env.DB._raw.prepare('SELECT * FROM players').all());
  assert.ok(!dump.includes('a memorable phrase'), 'the password is in the database');
  assert.ok(!dump.includes(reg.body.recoveryCode), 'the recovery code is in the database');
  assert.ok(!dump.includes(canonicalCode(reg.body.recoveryCode)), 'the recovery code is in the database, canonicalised');
  // ...and what IS there is the self-describing hash, for both
  const row = env.DB._raw.prepare('SELECT * FROM players WHERE id = ?').get(guest.id);
  for (const col of ['password', 'recovery_hash']) {
    assert.ok(parseStored(row[col]), `${col} is not a hash this service wrote`);
  }
  assert.notEqual(row.password, row.recovery_hash);

  const view = JSON.stringify((await call('GET', '/v1/account', undefined, guest.secret)).body);
  for (const leak of ['a memorable phrase', reg.body.recoveryCode, row.password, row.recovery_hash]) {
    assert.ok(!view.includes(leak), `the account view ships ${leak.slice(0, 20)}`);
  }
});

// ═══════════════════════════════════════════════════════════════════
// AUDIT-PW (2026-09-22, Mac: "Can you read those") - THE ADVERSARIAL
// READ server-account/src/password.js had never had. AUDIT-ACC named
// it as unexamined twice and never came back to it.
// ═══════════════════════════════════════════════════════════════════

test('AUDIT-PW P1: nothing may hash an EMPTY credential, because the empty hash is a skeleton key', async () => {
  // THE SHAPE. `codeForHashing` has TWO CONTRACTS - at the mint a null
  // is impossible, at the check a null is the ordinary answer to a typo
  // - and nothing enforced the first. `normalise` answers '' for a
  // null, so a minted code that failed to canonicalise hashed the EMPTY
  // STRING into `recovery_hash`; and `recover` compares `canon ?? ''`
  // against that row, so ANY string that is not a code at all would
  // then open the account.
  //
  // IT HAS HAPPENED ONCE. password.js's own note records the Q fold
  // doing exactly this to `7GEPQ-47BS9-AYK70-QMWYW`, and the only thing
  // that caught it was a test over minted codes - nothing in the code
  // refused to store the result.
  assert.equal(codeForHashing('NOT-A-VALID-CODE!!'), null, 'the check arm still answers null for a non-code');
  await assert.rejects(() => hashPassword(codeForHashing('NOT-A-VALID-CODE!!'), { subtle, rand }),
    /empty credential/, 'a null walked into the hasher');
  for (const empty of [null, undefined, '', '\u0000'.slice(0, 0)]) {
    await assert.rejects(() => hashPassword(empty, { subtle, rand }), /empty credential/, `${String(empty)} was hashed`);
  }
  // ...and nothing legitimate is refused: a password cannot reach the
  // hasher empty (passwordRefusal's floor is 8 and it runs first at all
  // three call sites) and a minted code is twenty characters.
  const ok = await hashPassword('correct horse battery', { subtle, rand }, 10_000);
  assert.equal(await verifyPassword('correct horse battery', ok, { subtle }), true);
  assert.equal(await verifyPassword('', ok, { subtle }), false, 'an empty guess opened a real row');

  // THE HOLE, DRIVEN END TO END against what the service would have
  // stored: the empty hash plus the check arm's own `canon ?? ''`.
  const skeleton = await hashPassword('placeholder', { subtle, rand }, 10_000);
  assert.equal(await verifyPassword(codeForHashing('total garbage') ?? '', skeleton, { subtle }), false,
    'a row hashed from a real credential is not opened by a non-code');
});

test('AUDIT-PW P2: the constant-time compare fails CLOSED', async () => {
  // It coerced anything that was not a Uint8Array to an EMPTY one, so
  // two lengths of 0 XOR'd to 0, the loop never ran, and the one
  // primitive in this service whose whole job is to say NO said yes.
  // Nothing reaches it that way today - verifyPassword is its only
  // caller and always hands it two real derivations - which is exactly
  // why it could sit there unnoticed.
  for (const [a, b] of [[null, null], [undefined, undefined], [undefined, {}], [{}, {}],
    [[1, 2, 3], [1, 2, 3]], ['ab', 'ab'], [new Uint8Array([1]), null], [null, new Uint8Array([1])]]) {
    assert.equal(timingSafeEqual(a, b), false, `${JSON.stringify(a)} vs ${JSON.stringify(b)} compared EQUAL`);
  }
  // ...and it still does its actual job.
  assert.equal(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])), true);
  assert.equal(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4])), false);
  assert.equal(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3])), false, 'a prefix is not a match');
  // ...AND THE ONE THE CAMPAIGN FOUND THIS PIN COULD NOT SEE. The loop
  // reads `x[i % x.length]` so that a byte is read on every iteration
  // whichever array is shorter - which means a short array that REPEATS
  // into a longer one matches it byte for byte, and the length XOR that
  // seeds `diff` is the only thing that says no. A prefix dies without
  // it; a repeat does not.
  assert.equal(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 1, 2])), false,
    'a repeating short array matched a longer one - the length is not in the compare');
  assert.equal(timingSafeEqual(new Uint8Array([7]), new Uint8Array([7, 7, 7])), false);
  assert.equal(timingSafeEqual(new Uint8Array(0), new Uint8Array(0)), true, 'two real empty arrays ARE equal');
});

test('AUDIT-PW P3: every code the minter can draw survives its own canonicalisation', async () => {
  // THE PIN THAT WAS ALREADY THE ONLY GUARD on P1, kept and widened -
  // P1 puts a refusal in the code, and this says the refusal can never
  // legitimately fire. The Q fold is the recorded case: it made a
  // MINTED code canonicalise to a different string than the one that
  // was hashed.
  for (let i = 0; i < 2000; i++) {
    const code = mintRecoveryCode(rand);
    const canon = canonicalCode(code);
    assert.equal(canon, code.replace(/-/g, ''), `a minted code did not survive canonicalisation: ${code}`);
    assert.equal(codeForHashing(code), canon);
  }
  // ...and the folding is Crockford's and ONLY Crockford's: a letter
  // the alphabet CONTAINS must never be folded to something else.
  for (const c of CODE_ALPHABET) {
    const grid = `${c}${'0'.repeat(19)}`;
    assert.equal(canonicalCode(grid), grid, `${c} is in the alphabet and the canonicaliser changed it`);
  }
});
