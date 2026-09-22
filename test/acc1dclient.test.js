// ACC1d — THE CLIENT HALF OF THE TOKEN SEAM.
//
// test/identitytoken.test.js holds the module and the RELAY's side of
// this slice: a token spent once, a hello with none admitted unvouched,
// a token that does not verify refused, the TTL ceiling read from
// config. This file holds the three steps in front of that, because a
// relay that verifies perfectly is worth nothing if no client ever
// sends one:
//
//   1. net/accountClient.js  accountTokenMinter - a session on this
//      device becomes a token, or `null`, and NEVER a throw.
//   2. net/online.js         the minter's answer becomes the hello's
//      `tok`, one per connection, bounded and swallowed.
//   3. net/wire.js           the field's SHAPE, which is all a sync,
//      pure parser may ever check.
//
// AND THE HOSTS, because a seam nothing calls is a seam that does not
// exist: scenes/world.js builds ONE minter and hands it to the presence
// session and to every channel link.
//
// THE FAKE SERVICE ANSWERS THE REAL SERVICE'S SHAPE. `/v1/auth/token`
// answers `{ token, name, kind, expiresAt }` - asserted against
// server-account/src/index.js's own source below rather than trusted,
// which is AUDIT-ACC 3's rule: a stub that agrees with itself proves
// nothing.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { OnlineSession, TOKEN_WAIT_MS } from '../src/net/online.js';
import { parseClient, rosterFor } from '../src/net/wire.js';
import { ChatLog } from '../src/net/chat.js';
import { RELAY_GRAPH } from './relayversion.test.js';
import { accountTokenMinter, mintIdentity, SESSION_KEY, DEFAULT_ACCOUNT_SERVICE } from '../src/net/accountClient.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

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

/** A fetch that records every call and answers with one scripted step. */
function fakeFetch(answer) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init, headers: init.headers, body: init.body ? JSON.parse(init.body) : null });
    const step = typeof answer === 'function' ? answer(calls.length) : answer;
    if (step.throws) throw new Error('network down');
    return { ok: (step.status ?? 200) < 400, status: step.status ?? 200, json: async () => step.body };
  };
  return { fetch, calls };
}

const SESSION = { id: 'acct-1', name: 'Mac', kind: 'linked', sessionId: 's-1', secret: 'sekrit-of-mac' };
/** A token of the SHAPE identityToken.js mints - three base64url parts under a version. */
const TOKEN = `v1.${'a'.repeat(120)}.${'b'.repeat(86)}`;

function fakeSocketClass() {
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; this.closed = null; sockets.push(this); }
    send(s) { this.sent.push(JSON.parse(s)); }
    close(code, reason) { this.closed = { code, reason }; }
    open() { this.onopen?.(); }
    receive(o) { this.onmessage?.({ data: typeof o === 'string' ? o : JSON.stringify(o) }); }
    drop(code = 1006) { this.onclose?.({ code, reason: '' }); }
  }
  return { FakeWS, sockets };
}

/** `onopen` is async now, so the hello leaves on a later microtask. Nothing
 *  here uses a timer, so draining the queue is enough. */
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

const session = (over = {}) => new OnlineSession({
  url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'shh-shh-shh-0001',
  WebSocketImpl: over.WS, now: () => 1_700_000_000_000, ...over,
});

// ── 1. THE MINTER ───────────────────────────────────────────────────

test('ACC1d: the minter asks the REAL route, with the secret in the header and nowhere else', async () => {
  const st = fakeStorage(SESSION);
  const { fetch, calls } = fakeFetch({ body: { token: TOKEN, name: 'Mac', kind: 'linked', expiresAt: 1 } });
  const tok = await accountTokenMinter({ fetch, storage: st })();
  assert.equal(tok, TOKEN);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${DEFAULT_ACCOUNT_SERVICE}/v1/auth/token`);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].headers.authorization, `Bearer ${SESSION.secret}`);
  // AUDIT-ACC F13: a credential in a URL is a credential in the request
  // log, the Referer and the history. The client side does not reopen
  // that door, and the BODY carries none either.
  assert.doesNotMatch(calls[0].url, /sekrit/);
  assert.deepEqual(calls[0].body, {});
  // DERIVED, not remembered: the service really serves this route and
  // really answers a `token` key.
  const svc = rd('server-account/src/index.js');
  assert.match(svc, /path === '\/v1\/auth\/token' && request\.method === 'POST'/, 'the route the minter posts to');
  assert.match(svc, /return json\(\{\s*\n\s*token,/, 'and the key it reads back (ACC3 put the wardrobe beside it, so the answer is spread over lines now)');
  assert.match(rd('src/net/accountClient.js'), /call\(io, '\/v1\/auth\/token'/, 'spelled once, in the ladder');
  assert.equal(typeof mintIdentity, 'function', 'the route has a name, so no call site spells a path');
});

test('ACC1d: NO SESSION ON THIS DEVICE IS NOT AN ERROR - null, and the service is never called at all', async () => {
  const { fetch, calls } = fakeFetch({ body: { token: TOKEN } });
  assert.equal(await accountTokenMinter({ fetch, storage: fakeStorage() })(), null, 'a signed-out player');
  // A SESSION SHAPED WRONG IS NO SESSION EITHER - storedSession's law,
  // reached through the minter rather than restated.
  assert.equal(await accountTokenMinter({ fetch, storage: fakeStorage({ id: 'x', secret: '' }) })(), null, 'a secret-less row');
  const broken = fakeStorage(); broken._map.set(SESSION_KEY, '{not json');
  assert.equal(await accountTokenMinter({ fetch, storage: broken })(), null, 'a store full of rubbish');
  assert.equal(calls.length, 0, 'no round trip is spent asking on behalf of nobody');
});

test('ACC1d: the minter NEVER throws and NEVER returns a non-token, whatever the service does', async () => {
  const st = () => fakeStorage(SESSION);
  const arms = [
    [{ throws: true }, 'the network is down'],
    [{ status: 503, body: { error: 'no-signing-key' } }, 'a service with no signing pair'],
    [{ status: 429, body: { error: 'rate' } }, 'a rate limit'],
    [{ status: 500, body: null }, 'an unreadable 500'],
    [{ body: null }, 'a 200 with no body at all'],
    [{ body: {} }, 'a 200 with no token key'],
    [{ body: { token: 42 } }, 'a token that is not a string'],
    [{ body: { token: null } }, 'a null token'],
  ];
  for (const [answer, why] of arms) {
    const { fetch } = fakeFetch(answer);
    assert.equal(await accountTokenMinter({ fetch, storage: st() })(), null, why);
  }
});

test('ACC1d: `auth` forgets the session; every OTHER refusal keeps it (mutant: a 503 signing the player out, which makes an outage permanent)', async () => {
  const dead = fakeStorage(SESSION);
  const a = fakeFetch({ status: 401, body: { error: 'auth' } });
  assert.equal(await accountTokenMinter({ fetch: a.fetch, storage: dead })(), null);
  assert.equal(dead.getItem(SESSION_KEY), null, 'a secret the service has stopped honouring is not a session');
  for (const answer of [{ status: 503, body: { error: 'no-signing-key' } }, { status: 429, body: { error: 'rate' } }, { throws: true }]) {
    const kept = fakeStorage(SESSION);
    const f = fakeFetch(answer);
    assert.equal(await accountTokenMinter({ fetch: f.fetch, storage: kept })(), null);
    assert.ok(kept.getItem(SESSION_KEY), `a service having a bad minute does not sign anyone out (${JSON.stringify(answer)})`);
  }
});

test('ACC1d: the minter HOLDS NOTHING - two calls are two round trips, because the relay spends a token once', async () => {
  const st = fakeStorage(SESSION);
  const { fetch, calls } = fakeFetch((n) => ({ body: { token: `v1.${'a'.repeat(n + 3)}.bbbb` } }));
  const mint = accountTokenMinter({ fetch, storage: st });
  const one = await mint(); const two = await mint();
  assert.notEqual(one, two, 'a fresh token, never the last one again');
  assert.equal(calls.length, 2, 'the second call really went to the service');
});

// ── 2. THE SESSION ──────────────────────────────────────────────────

test('ACC1d: the hello WAITS for the token and carries it; a session with no minter sends the frame every build before this one sent', async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let release;
  const gate = new Promise((r) => { release = r; });
  const s = session({ WS: FakeWS, mintToken: () => gate });
  s.join('world:0,0');
  sockets[0].open();
  await settle();
  assert.equal(sockets[0].sent.length, 0, 'NOTHING leaves before the token is in hand - a hello sent first could not carry one');
  release(TOKEN);
  await settle();
  assert.equal(sockets[0].sent.length, 1);
  assert.equal(sockets[0].sent[0].t, 'hello');
  assert.equal(sockets[0].sent[0].tok, TOKEN);

  const { FakeWS: WS2, sockets: s2 } = fakeSocketClass();
  const plain = session({ WS: WS2 });
  plain.join('world:0,0');
  s2[0].open();
  await settle();
  assert.equal(s2[0].sent.length, 1, 'no minter, no wait');
  assert.equal('tok' in s2[0].sent[0], false, 'the KEY is absent, not `tok: null` - wire.js refuses a null one, which is right');
});

test('ACC1d: a minter that throws, or answers null, costs a name and never the connection', async () => {
  for (const mintToken of [() => { throw new Error('no'); }, async () => { throw new Error('no'); }, async () => null]) {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = session({ WS: FakeWS, mintToken });
    s.join('world:0,0');
    sockets[0].open();
    await settle();
    assert.equal(sockets[0].sent.length, 1, 'the hello still goes');
    assert.equal('tok' in sockets[0].sent[0], false);
    assert.equal(s.status, 'open', 'and the session is connected');
  }
});

test('ACC1d: TOKEN_WAIT_MS is the WHOLE budget - an account service that never answers costs a moment, not the connection', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = session({ WS: FakeWS, mintToken: () => new Promise(() => {}) });
    s.join('world:0,0');
    sockets[0].open();
    await settle();
    assert.equal(sockets[0].sent.length, 0, 'still waiting');
    mock.timers.tick(TOKEN_WAIT_MS - 1);
    await settle();
    assert.equal(sockets[0].sent.length, 0, 'still inside the budget');
    mock.timers.tick(1);
    await settle();
    assert.equal(sockets[0].sent.length, 1, 'past it, the hello goes anyway');
    assert.equal('tok' in sockets[0].sent[0], false);
  } finally { mock.timers.reset(); }
  assert.ok(TOKEN_WAIT_MS > 0 && TOKEN_WAIT_MS <= 5000, 'a budget a player would not notice as a hang');
});

test('ACC1d: ONE TOKEN PER CONNECTION - every socket mints its own (mutant: minted once and reused, which the relay refuses the second time)', async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let n = 0;
  const s = session({ WS: FakeWS, mintToken: async () => `v1.${'a'.repeat(++n + 3)}.bbbb` });
  s.join('world:0,0');
  sockets[0].open();
  await settle();
  s.join('town:m1234');
  sockets[1].open();
  await settle();
  assert.equal(n, 2, 'a mint per socket, not per session');
  assert.notEqual(sockets[0].sent[0].tok, sockets[1].sent[0].tok);
});

test('ACC1d: a token that lands after its socket was replaced is DROPPED, never sent down a dead wire', async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let release;
  const gate = new Promise((r) => { release = r; });
  let first = true;
  const s = session({ WS: FakeWS, mintToken: () => (first ? (first = false, gate) : Promise.resolve(TOKEN)) });
  s.join('world:0,0');
  sockets[0].open();
  await settle();
  s.join('town:m1234');          // the first socket is closed and replaced while its mint is in flight
  release(TOKEN);
  await settle();
  assert.equal(sockets[0].sent.length, 0, 'the abandoned socket says nothing');
  assert.ok(sockets[0].closed, 'and it really was closed');
});

// ── 3. THE WIRE ─────────────────────────────────────────────────────

const LOOK = { race: 'Nord', gender: 'male', faceIndex: 2, items: [] };
const hello = (over = {}) => parseClient(JSON.stringify({ t: 'hello', id: 'mac-0001', secret: 'shh-shh-shh-0001', name: 'Mac', look: LOOK, ...over }));

test('ACC1d: the wire checks the token\'s SHAPE and nothing else - kept, absent, or an ERROR, never a quiet drop', () => {
  assert.equal(hello({ tok: TOKEN }).tok, TOKEN, 'a well-shaped one rides through');
  const none = hello();
  assert.equal(none.t, 'hello', 'a hello with no token is still a hello');
  assert.equal('tok' in none, false, 'no token: the key is not invented');
  assert.equal(none.error, undefined);
  for (const bad of ['', 'v1', 'v1.aaa', 'v1.aaa.bbb.ccc', 'v1.aa a.bbb', 'v1.aaa+bbb.ccc', `v1.${'a'.repeat(513)}.bbb`, `v1.aaa.${'b'.repeat(129)}`, `${'v'.repeat(9)}.aaa.bbb`]) {
    assert.equal(hello({ tok: bad }).error, 'bad token', `a malformed token is an error: ${JSON.stringify(bad.slice(0, 20))}`);
  }
  for (const bad of [null, 0, 1, true, {}, [], ['v1.a.b']]) {
    assert.equal(hello({ tok: bad }).error, 'bad token', `a ${typeof bad} is not a token`);
  }
  // THE PARSER IS SYNC AND PURE AND STAYS THAT WAY: it may not verify,
  // because verifying needs WebCrypto and a key, and a `await` here
  // would put the whole wire on a promise.
  const wire = rd('src/net/wire.js');
  assert.doesNotMatch(wire, /verifyToken|importPublicKeyB64/, 'the wire never verifies - that is the relay\'s, and it is async');
  assert.doesNotMatch(wire, /'v1'|"v1"/, 'and it never spells a version: identityToken.js is the one home for that');
});

// ── 4. THE HOSTS ────────────────────────────────────────────────────

test('ACC1d: the host builds ONE minter and hands it to the presence session AND every channel link (mutant: a seam nothing calls)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /import \{ accountTokenMinter, storedSession \} from '\.\.\/net\/accountClient\.js'/);
  // NAME-ADOPT: and every answer's identity flows back onto the live
  // sessions - the half of this seam that was missing, which is why a
  // player saw their character's name while everybody else saw the handle.
  assert.match(w, /const identityMinter = accountTokenMinter\(\{ fetch: \(u, i\) => globalThis\.fetch\(u, i\), storage: appStorage\(\), onIssued: adoptIssued \}\)/);
  assert.match(w, /online = new OnlineSession\(\{[\s\S]*?mintToken: identityMinter,[\s\S]*?\}\);/, 'the presence session');
  assert.match(w, /link\.mintToken = identityMinter;/, 'and every channel link - the hub is where a name is READ');
  assert.equal((w.match(/accountTokenMinter\(/g) ?? []).length, 1, 'ONE minter: two would be two reads of the store per connect and no benefit');
  // THE APP's store, never the TAB's: an account is the player's, and a
  // second tab is the same person. The peer id is the other way round
  // (TABS1) and that difference is deliberate.
  assert.match(w, /import \{ appStorage \} from '\.\.\/systems\/appStorage\.js'/);
  assert.doesNotMatch(rd('src/net/online.js'), /accountClient|fetch\(/, 'the session does not know the account service exists');
});

// ── 5. THE VERDICT IS GONE, AND ACC1g IS WHY ────────────────────────
//
// ACC1d carried `v` - the relay's verdict on a name - from the join,
// the roster and every chat line all the way to the peer and the log,
// and three pins held every door on that road open. It was worth
// holding while a name could be VERIFIED or TYPED.
//
// Mac closed the typed one: "You shouldnt be able to just type a name
// and enter anymore.... this is what the account system is for." The
// relay refuses a hello it cannot verify, so every name in every room
// is a verified name and `v` said the same thing about all of them -
// a field carrying no information. It leaves on the same deploy the
// gate costs, because a wire change costs a drop and this deploy is
// already paying for one.
//
// SO THE PINS BELOW ARE THE INVERSE: nothing on the road may carry it,
// and a relay that sends one anyway must not put it back on a peer.

test('ACC1g: no door between the relay and the client carries a verdict any more - not the roster, not the peer, not a chat line (mutants: `v` back on the roster row; a peer keeping one a stale relay sent; the log keeping one on a line)', () => {
  // THE ROSTER. `rosterFor` is the relay's own function (one home, both
  // ends), and a row is an id, a name, a look and a pose.
  const out = rosterFor([{ id: 'a-0001', name: 'Nystul', look: LOOK, pose: null, v: true }], 'mac-0001');
  assert.deepEqual(Object.keys(out[0]).sort(), ['id', 'look', 'name', 'pose'],
    'the roster row grew a field back');

  // THE PEER. A relay still sending `v` - an older one, or a forgery -
  // must not put it back on a peer, because a client that keeps a field
  // the wire no longer defines is a client trusting a stranger's word
  // about itself.
  const { FakeWS, sockets } = fakeSocketClass();
  const s = session({ WS: FakeWS });
  s.join('world:0,0');
  sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', host: 'mac-0001', peers: [
    { id: 'a-0001', name: 'Nystul', look: LOOK, pose: null, v: true },
  ] });
  assert.equal(s.peers.get('a-0001').v, undefined, 'a peer kept a verdict off the wire');
  sockets[0].receive({ t: 'join', id: 'c-0003', name: 'Julianos', look: LOOK, v: true });
  assert.equal(s.peers.get('c-0003').v, undefined);

  // THE CHAT LINE, and the LOG the panel draws from.
  const { FakeWS: FW2, sockets: s2 } = fakeSocketClass();
  const c = session({ WS: FW2, presence: false });
  const heard = [];
  c.onChat = (line) => heard.push(line);
  c.join('chan:world');
  s2[0].open();
  s2[0].receive({ t: 'welcome', id: 'mac-0001', host: 'mac-0001', peers: [] });
  s2[0].receive({ t: 'chat', id: 'a-0001', name: 'Nystul', text: 'hail', at: 1, v: true });
  assert.equal(heard[0].v, undefined, 'a chat line kept a verdict off the wire');
  const log = new ChatLog({ now: () => 1 });
  const tab = log.tabs[0].id;
  assert.equal(log.push(tab, { ...heard[0], v: true }).v, undefined, 'the log kept one it was handed');
});

// ── 6. THE NOTE AND THE CODE ────────────────────────────────────────

test('ACC1d: identityToken.js is IN the relay bundle now, so its own note may no longer say the refusal is unbuilt (DEPLOY-PROSE, two-directional)', () => {
  // DERIVED FROM THE BUNDLE WALK, not from a date or a flag: the same
  // graph SLAM8 hashes the relay with answers "is this file shipped to
  // the relay yet?", so this pin cannot go stale by nobody remembering.
  const inBundle = RELAY_GRAPH.includes('src/net/identityToken.js');
  const note = rd('src/net/identityToken.js');
  if (inBundle) {
    // The sentences ACC1a wrote WHILE the refusal was unbuilt. Each was
    // true the day it was typed and is a lie the moment the relay
    // imports this file - which is DEPLOY-PROSE exactly: a sentence
    // typed BESIDE a fact rather than derived from it, going stale on a
    // day nobody was looking at it.
    for (const stale of [
      'NOTHING HERE ENFORCES EITHER YET',
      'which does not import this file yet',
      'not in the relay bundle yet',
    ]) assert.ok(!note.includes(stale), `the note still says "${stale}" while the relay imports it`);
    assert.match(note, /ACC1d BUILT BOTH/, 'and it says which slice built it');
    // AND IT STILL STATES THE BOUND. "Spent once" without "per room" is
    // the comment claiming a shut window that bible ACC1d D4 refused to
    // claim.
    assert.match(note, /PER ROOM/, 'the refusal is per room and the note says so');
  } else {
    assert.ok(note.includes('NOTHING HERE ENFORCES EITHER YET'),
      'outside the bundle, a note claiming the refusal is built would be the same lie the other way round');
  }
  // THE CONTROL, HARD5-3's: the membership test is only worth anything
  // if the walk really spells paths this way.
  assert.ok(RELAY_GRAPH.includes('src/net/wire.js'), 'the walk spells paths the way this pin does');
});
