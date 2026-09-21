// ACC1e — THE ACCOUNT SCREEN, PINNED WHERE IT THINKS.
//
// node cannot draw the card, and test/enhancedChargen.test.js already
// settled what that means for this project: pin the part that does
// arithmetic and measure the drawn surface in a real browser. Every
// way a player can lose an account is arithmetic - a stage, a pair of
// passwords, a refusal, a second press - so all of it is here.
//
// THE FAKE SERVICE ANSWERS THE REAL SERVICE'S SHAPES, taken from
// server-account/src/index.js and accounts.js rather than imagined:
// `{ id, name, kind, sessionId, secret }` from guest and login,
// `{ recoveryCode, handle }` from register, `{ account, devices }`
// from /v1/account, and `{ error: '<word>' }` with a status on every
// refusal. A stub that agrees with itself proves nothing, so the
// shapes are asserted against the service's own source too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { AccountFlow, STAGES, FIELDS, FIELD_SPEC, LOCAL_REFUSALS } from '../src/ui/accountFlow.js';
import {
  SESSION_KEY, PASSWORD_MIN_LEN, PASSWORD_MAX_LEN, HANDLE_MAX_LEN,
  accountRefusalText, REFUSALS, DEFAULT_ACCOUNT_SERVICE,
} from '../src/net/accountClient.js';
import { HANDLE_RE } from '../src/net/handleShape.js';
import { PASSWORD_MIN, PASSWORD_MAX } from '../server-account/src/password.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** Storage that behaves like appStorage: strings in, strings out. */
function fakeStorage(seed = null) {
  const m = new Map();
  if (seed) m.set(SESSION_KEY, JSON.stringify(seed));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  };
}

/** A fetch that records every call and answers from a script. */
function fakeFetch(script) {
  const calls = [];
  const fetch = async (url, init) => {
    const path = url.replace(DEFAULT_ACCOUNT_SERVICE, '').replace(/^https?:\/\/[^/]+/, '');
    calls.push({ url, path, init, body: init.body ? JSON.parse(init.body) : null, headers: init.headers });
    const step = script[path];
    const answer = typeof step === 'function' ? step(calls.length) : step;
    if (!answer) throw new Error(`the fake service has no answer for ${path}`);
    if (answer.throws) throw new Error('network down');
    return {
      ok: answer.status ? answer.status < 400 : true,
      status: answer.status ?? 200,
      json: async () => answer.body,
    };
  };
  return { fetch, calls };
}

const GUEST = { id: 'acct-aaaaaaaaaaaa', name: 'Mithriil Stormaire', kind: 'guest', sessionId: 's1', secret: 'sec-one' };
const LOGGED = { id: 'acct-aaaaaaaaaaaa', name: 'Nystul', kind: 'linked', sessionId: 's2', secret: 'sec-two' };
const VIEW = { account: { id: 'acct-aaaaaaaaaaaa', name: 'Nystul', kind: 'linked', handle: 'Nystul', guestName: 'Mithriil Stormaire' }, devices: [] };

const flowWith = (script, seed = null) => {
  const { fetch, calls } = fakeFetch(script);
  const storage = fakeStorage(seed);
  const flow = AccountFlow({ io: { fetch }, storage });
  return { flow, calls, storage };
};

// ── THE SHAPE OF THE THING ──────────────────────────────────────────

test('ACC1e: every stage the flow can reach is a stage the renderer knows, and every field has a spec', () => {
  // The renderer walks FIELDS and FIELD_SPEC; a stage that asks for a
  // field with no spec is a field that draws as nothing.
  for (const [stage, fields] of Object.entries(FIELDS)) {
    assert.ok(STAGES.includes(stage), `${stage} asks for fields and is not a stage`);
    for (const f of fields) assert.ok(FIELD_SPEC[f], `${stage} asks for '${f}' and no spec describes it`);
  }
  // ...and a password field is never drawn in the clear.
  for (const k of ['password', 'confirm', 'oldPassword']) assert.equal(FIELD_SPEC[k].secret, true, `${k} must be typed masked`);
  // The recovery CODE is deliberately NOT masked: it is typed off a
  // piece of paper, and masking it makes a 20-character transcription
  // a guessing game.
  assert.equal(FIELD_SPEC.code.secret, false);
});

test('ACC1e: the field caps agree with the bounds the SERVICE enforces, derived from its own source', () => {
  // A field that accepts what the far end refuses is a refusal the
  // player meets after pressing rather than before.
  assert.equal(PASSWORD_MIN_LEN, PASSWORD_MIN, 'the client and the service disagree about a password floor');
  assert.equal(PASSWORD_MAX_LEN, PASSWORD_MAX, 'the client and the service disagree about a password ceiling');
  // The handle cap is the one the shared regex actually allows: a
  // leading letter plus 2..23 more.
  assert.ok(HANDLE_RE.test('a'.repeat(HANDLE_MAX_LEN)), 'the handle cap is longer than the law allows');
  assert.ok(!HANDLE_RE.test('a'.repeat(HANDLE_MAX_LEN + 1)), 'the handle cap is shorter than the law allows');
  assert.equal(FIELD_SPEC.handle.max, HANDLE_MAX_LEN);
  assert.equal(FIELD_SPEC.password.max, PASSWORD_MAX_LEN);
});

test('ACC1e: every refusal word the SERVICE can emit has a sentence here - walked from its source, not listed', () => {
  // The service's refusals are `{ error: 'word' }` / `return { error:
  // 'word' }`. Walked so a word added there without a sentence here
  // reddens, rather than reaching a player as `handle-frobnicated`.
  const text = ['server-account/src/accounts.js', 'server-account/src/index.js', 'server-account/src/password.js']
    .map((p) => src(p)).join('\n');
  const words = new Set();
  for (const m of text.matchAll(/error:\s*'([a-z-]+)'/g)) words.add(m[1]);
  for (const m of text.matchAll(/no\('([a-z-]+)'/g)) words.add(m[1]);
  // The two the service COMPOSES rather than spells: `handle-${r}` and
  // `password-${r}`. The suffixes are derived from what each refusal
  // FUNCTION actually returns, not from a list written here - the first
  // cut listed four suffixes for both and invented `handle-short` and
  // `handle-long`, which `handleRefusal` has never returned. A pin that
  // demands sentences for refusals that cannot happen is a pin that
  // teaches you to add dead entries until it goes quiet.
  const suffixesOf = (file, fn) => {
    const body = src(file).split(`export function ${fn}`)[1] ?? '';
    return [...body.slice(0, body.indexOf('\n}')).matchAll(/return '([a-z-]+)'/g)].map((m) => m[1]);
  };
  const handleSuffixes = suffixesOf('server-account/src/accounts.js', 'handleRefusal');
  const passwordSuffixes = suffixesOf('server-account/src/password.js', 'passwordRefusal');
  assert.ok(handleSuffixes.length && passwordSuffixes.length, 'the suffix walk found nothing - it has stopped seeing its subject');
  for (const sfx of handleSuffixes) words.add(`handle-${sfx}`);
  for (const sfx of passwordSuffixes) words.add(`password-${sfx}`);
  assert.ok(words.size >= 10, `the walk found only ${words.size} refusal words - it has stopped seeing its subject`);
  const missing = [...words].filter((w) => !(w in REFUSALS));
  assert.deepEqual(missing, [], 'the service can refuse with a word this screen has no sentence for');
  // ...and an unknown word is still a sentence, never the raw word.
  assert.equal(accountRefusalText('handle-frobnicated'), REFUSALS.server);
  assert.ok(!accountRefusalText('handle-frobnicated').includes('frobnicated'));
});

// ── THE CREDENTIAL ──────────────────────────────────────────────────

test('ACC1e/F13: the session secret rides the Authorization header and is NEVER in a URL', async () => {
  const { flow, calls } = flowWith({
    '/v1/account': { body: VIEW },
    '/v1/account/password': { body: { ok: true } },
  }, LOGGED);
  await flow.start();
  flow.go('password');
  flow.set('oldPassword', 'oldpassword1');
  flow.set('password', 'newpassword1');
  flow.set('confirm', 'newpassword1');
  await flow.submit();

  assert.ok(calls.length >= 2);
  for (const c of calls) {
    assert.doesNotMatch(c.url, /secret=/, 'a credential reached a URL - AUDIT-ACC F13 shut that door');
    assert.doesNotMatch(c.url, new RegExp(LOGGED.secret), 'the secret itself is in the URL');
    assert.equal(c.headers.authorization, `Bearer ${LOGGED.secret}`, 'the credential must ride the header');
    if (c.body) assert.ok(!('secret' in c.body), 'the body carries a credential the header already carries');
  }
  // ...and the source has no query-string door to reach at all.
  //
  // COMMENTS STRIPPED FIRST, and the first cut of this line did not:
  // it fired on accountClient.js's OWN NOTE, which quotes `?secret=`
  // while explaining why that door is shut. The comment describing the
  // law tripped the check for the law - the same shape as ACC1-CI's
  // sentinel survivor and the F8 gate's first cut, twice in one day.
  const live = src('src/net/accountClient.js')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[ \t])\/\/[^\n]*/gm, '$1');
  assert.match(src('src/net/accountClient.js'), /\?secret=/, 'the control is gone: the note that explains the shut door no longer quotes it');
  assert.doesNotMatch(live, /[?&]secret=/, 'the client can spell a secret into a URL');
});

test('ACC1e: the recovery code is NEVER written to storage', async () => {
  const { flow, storage } = flowWith({
    '/v1/auth/guest': { body: GUEST },
    '/v1/auth/register': { body: { recoveryCode: '7GEPQ-47BS9-AYK70-QMWYW', handle: 'Nystul' } },
  });
  await flow.start();
  flow.go('register');
  flow.set('handle', 'Nystul');
  flow.set('password', 'correcthorse');
  flow.set('confirm', 'correcthorse');
  await flow.submit();

  assert.equal(flow.stage, 'code');
  assert.equal(flow.recoveryCode, '7GEPQ-47BS9-AYK70-QMWYW');
  const dump = [...storage._map.values()].join('|');
  assert.ok(!dump.includes('7GEPQ'), 'the code readable once was written where a stolen device reads first');
});

// ── THE STAGES ──────────────────────────────────────────────────────

test('ACC1e: a device with no session lands on `out` WITHOUT a single request', async () => {
  const { flow, calls } = flowWith({});
  await flow.start();
  assert.equal(flow.stage, 'out');
  assert.deepEqual(calls, [], 'the menu asked the network before it could open');
});

test('ACC1e: registering is an UPGRADE IN PLACE - a guest row is opened, then filled in', async () => {
  const { flow, calls, storage } = flowWith({
    '/v1/auth/guest': { body: GUEST },
    '/v1/auth/register': { body: { recoveryCode: 'CODE1-CODE2', handle: 'Nystul' } },
  });
  await flow.start();
  flow.go('register');
  flow.set('handle', 'Nystul');
  flow.set('password', 'correcthorse');
  flow.set('confirm', 'correcthorse');
  await flow.submit();

  assert.deepEqual(calls.map((c) => c.path), ['/v1/auth/guest', '/v1/auth/register']);
  // the upgrade is authorised by the session the guest call just made
  assert.equal(calls[1].headers.authorization, `Bearer ${GUEST.secret}`);
  assert.equal(JSON.parse(storage.getItem(SESSION_KEY)).secret, GUEST.secret);
  assert.equal(flow.stage, 'code');
});

test('ACC1e: a device that ALREADY has a guest session upgrades it rather than opening a second', async () => {
  const { flow, calls } = flowWith({
    '/v1/account': { body: VIEW },
    '/v1/auth/register': { body: { recoveryCode: 'CODE1-CODE2', handle: 'Nystul' } },
  }, GUEST);
  await flow.start();
  flow.go('register');
  flow.set('handle', 'Nystul');
  flow.set('password', 'correcthorse');
  flow.set('confirm', 'correcthorse');
  await flow.submit();
  assert.deepEqual(calls.map((c) => c.path), ['/v1/account', '/v1/auth/register'],
    'a second guest row was opened for a device that already had one');
});

test('ACC1e: ONE PRESS IS ONE ACCOUNT - a second submission mid-flight opens no second guest row', async () => {
  let release;
  const held = new Promise((r) => { release = r; });
  const { fetch, calls } = fakeFetch({
    '/v1/auth/guest': { body: GUEST },
    '/v1/auth/register': { body: { recoveryCode: 'CODE1-CODE2', handle: 'Nystul' } },
  });
  // hold the FIRST call open, so the second press lands while it runs
  const slow = async (url, init) => { if (url.includes('/guest')) await held; return fetch(url, init); };
  const flow = AccountFlow({ io: { fetch: slow }, storage: fakeStorage() });
  await flow.start();
  flow.go('register');
  flow.set('handle', 'Nystul');
  flow.set('password', 'correcthorse');
  flow.set('confirm', 'correcthorse');

  const first = flow.submit();
  const second = flow.submit();          // the double press
  release();
  await Promise.all([first, second]);

  const guests = calls.filter((c) => c.path === '/v1/auth/guest');
  assert.equal(guests.length, 1, 'a double press opened a second guest row that nothing will ever adopt');
});

test('ACC1e: a register that FAILS after the guest row was opened keeps the session, so a retry upgrades it', async () => {
  let attempt = 0;
  const { flow, calls, storage } = flowWith({
    '/v1/auth/guest': { body: GUEST },
    '/v1/auth/register': () => (++attempt === 1
      ? { status: 400, body: { error: 'handle-taken' } }
      : { body: { recoveryCode: 'CODE1-CODE2', handle: 'Nystul2' } }),
  });
  await flow.start();
  flow.go('register');
  flow.set('handle', 'Nystul');
  flow.set('password', 'correcthorse');
  flow.set('confirm', 'correcthorse');
  await flow.submit();

  assert.equal(flow.stage, 'register', 'a taken handle must leave the player on the form');
  assert.equal(flow.error, REFUSALS['handle-taken']);
  assert.equal(JSON.parse(storage.getItem(SESSION_KEY)).secret, GUEST.secret, 'the guest row was stranded');
  // what was typed SURVIVES a refusal - retyping three fields to fix one is the bug
  assert.equal(flow.values.password, 'correcthorse');

  flow.set('handle', 'Nystul2');
  await flow.submit();
  assert.equal(flow.stage, 'code');
  assert.equal(calls.filter((c) => c.path === '/v1/auth/guest').length, 1, 'the retry opened a second guest row');
});

test('ACC1e: the checks the SERVICE cannot make happen before the request, not after it', async () => {
  const cases = [
    { set: { handle: 'Nystul', password: 'correcthorse', confirm: 'correcthors' }, why: LOCAL_REFUSALS['confirm-mismatch'] },
    { set: { handle: 'has space', password: 'correcthorse', confirm: 'correcthorse' }, why: LOCAL_REFUSALS['handle-shape'] },
    { set: { handle: '1abc', password: 'correcthorse', confirm: 'correcthorse' }, why: LOCAL_REFUSALS['handle-shape'] },
    { set: { handle: 'Nystul', password: 'short', confirm: 'short' }, why: LOCAL_REFUSALS['password-short'] },
    { set: { handle: '', password: 'correcthorse', confirm: 'correcthorse' }, why: LOCAL_REFUSALS['handle-empty'] },
  ];
  for (const c of cases) {
    const { flow, calls } = flowWith({});
    await flow.start();
    flow.go('register');
    for (const [k, val] of Object.entries(c.set)) flow.set(k, val);
    await flow.submit();
    assert.equal(flow.error, c.why, `wrong sentence for ${JSON.stringify(c.set)}`);
    assert.equal(flow.stage, 'register');
    assert.deepEqual(calls, [], `a round trip was spent learning something this side already knew: ${c.why}`);
  }
});

test('ACC1e: signing in keeps the session and shows the account', async () => {
  const { flow, calls, storage } = flowWith({
    '/v1/auth/login': { body: LOGGED },
    '/v1/account': { body: VIEW },
  });
  await flow.start();
  flow.go('login');
  flow.set('handle', 'Nystul');
  flow.set('password', 'correcthorse');
  await flow.submit();
  assert.equal(flow.stage, 'in');
  assert.equal(flow.account.handle, 'Nystul');
  assert.equal(JSON.parse(storage.getItem(SESSION_KEY)).secret, LOGGED.secret);
  assert.deepEqual(calls.map((c) => c.path), ['/v1/auth/login', '/v1/account']);
});

test('ACC1e: `bad-login` says the same vague thing the service does - no enumeration handed back', async () => {
  const { flow } = flowWith({ '/v1/auth/login': { status: 401, body: { error: 'bad-login' } } });
  await flow.start();
  flow.go('login');
  flow.set('handle', 'Nystul');
  flow.set('password', 'wrongpassword');
  await flow.submit();
  assert.equal(flow.stage, 'login');
  assert.equal(flow.error, REFUSALS['bad-login']);
  // the sentence must not tell a stranger WHICH half was wrong
  assert.doesNotMatch(flow.error, /no such (user|account)|unknown user|not registered/i);
});

test('ACC1e: a dead credential signs the device out; a BLIP does not', async () => {
  // `auth` - the service says the secret is not honoured. Forget it.
  {
    const { flow, storage } = flowWith({ '/v1/account': { status: 401, body: { error: 'auth' } } }, LOGGED);
    await flow.start();
    assert.equal(flow.stage, 'out');
    assert.equal(storage.getItem(SESSION_KEY), null, 'a refused credential was kept');
    assert.equal(flow.error, REFUSALS.auth);
  }
  // `offline` - says nothing about the credential. Keeping it is the
  // difference between a bad second and a player signed out by a blip.
  {
    const { flow, storage } = flowWith({ '/v1/account': { throws: true } }, LOGGED);
    await flow.start();
    assert.equal(flow.stage, 'in', 'a network blip signed the player out');
    assert.ok(storage.getItem(SESSION_KEY), 'a working session was thrown away over a network blip');
    assert.equal(flow.error, REFUSALS.offline);
  }
});

test('ACC1e: recovery mints a NEW code, keeps the fresh session, and lands on the stage that shows it once', async () => {
  const { flow, storage } = flowWith({
    '/v1/auth/recover': { body: { id: LOGGED.id, name: 'Nystul', recoveryCode: 'NEWC1-NEWC2', sessionId: 's9', secret: 'sec-nine' } },
    '/v1/account': { body: VIEW },
  });
  await flow.start();
  flow.go('recover');
  flow.set('handle', 'Nystul');
  flow.set('code', 'OLDC1-OLDC2');
  flow.set('password', 'brandnewpassword');
  flow.set('confirm', 'brandnewpassword');
  await flow.submit();
  assert.equal(flow.stage, 'code');
  assert.equal(flow.recoveryCode, 'NEWC1-NEWC2', 'spending a code must hand back another');
  assert.equal(JSON.parse(storage.getItem(SESSION_KEY)).secret, 'sec-nine',
    'recovery signs every device out, so the fresh session it returns is the only way this device stays in');
});

test('ACC1e: the code stage is left only by acknowledging it, and the code is gone afterwards', async () => {
  const { flow } = flowWith({
    '/v1/auth/guest': { body: GUEST },
    '/v1/auth/register': { body: { recoveryCode: 'CODE1-CODE2', handle: 'Nystul' } },
    '/v1/account': { body: VIEW },
  });
  await flow.start();
  flow.go('register');
  flow.set('handle', 'Nystul');
  flow.set('password', 'correcthorse');
  flow.set('confirm', 'correcthorse');
  await flow.submit();
  assert.equal(flow.recoveryCode, 'CODE1-CODE2');
  await flow.acknowledgeCode();
  assert.equal(flow.stage, 'in');
  assert.equal(flow.recoveryCode, null, 'the code outlived the one stage that may show it');
});

test('ACC1e: changing a password needs the old one, and says that other devices were signed out', async () => {
  const { flow, calls } = flowWith({
    '/v1/account': { body: VIEW },
    '/v1/account/password': { body: { ok: true } },
  }, LOGGED);
  await flow.start();
  flow.go('password');
  flow.set('oldPassword', 'correcthorse');
  flow.set('password', 'brandnewpassword');
  flow.set('confirm', 'brandnewpassword');
  await flow.submit();
  assert.equal(flow.stage, 'in');
  assert.match(flow.note, /other device/i);
  const body = calls.find((c) => c.path === '/v1/account/password').body;
  assert.equal(body.oldPassword, 'correcthorse', 'the old password is what stops a stolen phone locking its owner out');
});

test('ACC1e: signing out forgets the session even when the service cannot be reached', async () => {
  const { flow, storage } = flowWith({ '/v1/account': { body: VIEW }, '/v1/auth/logout': { throws: true } }, LOGGED);
  await flow.start();
  assert.equal(flow.stage, 'in');
  await flow.signOut();
  assert.equal(flow.stage, 'out');
  assert.equal(storage.getItem(SESSION_KEY), null,
    'a player trying to leave a device was left signed in on it because a Worker was down');
});

test('ACC1e: a password never survives a stage change', async () => {
  const { flow } = flowWith({});
  await flow.start();
  flow.go('register');
  flow.set('password', 'correcthorse');
  flow.set('confirm', 'correcthorse');
  flow.go('login');
  assert.deepEqual(flow.values, {}, 'a password was left in the flow after the stage that asked for it');
});

test('ACC1e: a keystroke clears the refusal under the field, so no stale sentence sits under a corrected one', async () => {
  const { flow } = flowWith({});
  await flow.start();
  flow.go('register');
  flow.set('handle', 'has space');
  flow.set('password', 'correcthorse');
  flow.set('confirm', 'correcthorse');
  await flow.submit();
  assert.equal(flow.error, LOCAL_REFUSALS['handle-shape']);
  flow.set('handle', 'Nystul');
  assert.equal(flow.error, '', 'the reason stayed under a field the player had already fixed');
});

test('ACC1e: a password is sent EXACTLY as typed - leading and trailing spaces are characters, not noise', async () => {
  // The handle IS trimmed (a trailing space there is a slip, and the
  // service would refuse the shape anyway). A PASSWORD is not: those
  // spaces may be deliberate, the service hashes the bytes it is given,
  // and trimming on this side is a login that works from this client
  // and fails from every other one - including this client after
  // somebody deletes the trim.
  //
  // This pin exists because the mutation campaign found the law stated
  // in a comment above `pw()` and asked by nothing: ACC1e-6 replaced
  // that line with a trimming one and every test stayed green.
  const PASSWORD = '  correct horse  ';
  const { flow, calls } = flowWith({
    '/v1/auth/guest': { body: GUEST },
    '/v1/auth/register': { body: { recoveryCode: 'CODE1-CODE2', handle: 'Nystul' } },
  });
  await flow.start();
  flow.go('register');
  flow.set('handle', '  Nystul  ');
  flow.set('password', PASSWORD);
  flow.set('confirm', PASSWORD);
  await flow.submit();

  const sent = calls.find((c) => c.path === '/v1/auth/register').body;
  assert.equal(sent.password, PASSWORD, 'the password was changed between the box and the wire');
  assert.equal(sent.handle, 'Nystul', 'the handle was NOT trimmed, and the service refuses a shape with spaces');

  // ...and the two boxes are compared untrimmed too, or a password with
  // a trailing space would match a confirm without one.
  const { flow: f2 } = flowWith({});
  await f2.start();
  f2.go('register');
  f2.set('handle', 'Nystul');
  f2.set('password', 'correcthorse ');
  f2.set('confirm', 'correcthorse');
  await f2.submit();
  assert.equal(f2.error, LOCAL_REFUSALS['confirm-mismatch'], 'two passwords differing only in a space were called the same');
});
