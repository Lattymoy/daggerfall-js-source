// MOD1 — THE MODERATOR GLYPH AND /mute, /unmute (2026-09-22).
//
// Mac: "Next up I want a moderator glyph and moderator chat commands",
// and when asked which commands and which glyph: /mute and /unmute, and
// the blue shield.
//
// ═══ WHAT THESE PINS ARE FOR ═══════════════════════════════════════
//
// A MUTE IS AN AUTHORITY, and the build that passes a naive test is the
// one where a client says "I am a moderator, mute Bob" and something
// believes it. So every pin here drives the authority from where it
// really lives: the SERVICE decides who may (a handle in config, read
// now) and signs the result; the RELAY believes only that signature -
// never the socket that carried it, never a field on a frame. A forged
// order, an identity token dressed as an order, an old order replayed
// inside its minute, and a token minted just before the mute are each
// driven through a REAL Room with a REAL Ed25519 key.
//
// AND A MUTE MUST SURVIVE A RECONNECT, which a relay-memory mute cannot:
// the account row is the truth and every later token carries it as `mu`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { register, muteAccount } from '../server-account/src/accounts.js';
import { glyphsOf, isModerator, canModerate, moderatorHandles } from '../server-account/src/titles.js';
import {
  GLYPHS, claimsValid, mintToken, verifyToken, mintOrder, verifyOrder, orderValid, ORDER_TTL_S,
  importPublicKeyB64,
} from '../src/net/identityToken.js';
import { CHAT_WORLD_ROOM, parseClient, subOf, mutedUntilOf, MUTE_HZ_MAX } from '../src/net/wire.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { OnlineSession } from '../src/net/online.js';
import {
  parseModCommand, resolveTarget, runModCommand, mutedText, mutedNotices,
  MUTE_MAX_MIN, MUTE_DEFAULT_MIN, MUTE_USAGE,
} from '../src/net/moderation.js';
import { GLYPH_RGBA, GLYPH_PATH, GLYPH_MARK } from '../src/ui/playerBadge.js';
import { GLYPH_LABEL } from '../src/ui/enhancedAccount.js';
import { REFUSALS, accountRefusalText } from '../src/net/accountClient.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);

const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url))
  .filter((f) => f.endsWith('.sql')).sort();

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
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

const T0 = 1_800_000_000;

// ── THE GRANT ───────────────────────────────────────────────────────

test('MOD1: the moderator shield is a handle in CONFIG - granted by listing it, revoked by taking it off; a guest is never one', () => {
  const env = { MODERATOR_HANDLES: ' Kithlan , mack ' };
  assert.deepEqual([...moderatorHandles(env)], ['kithlan', 'mack'], 'trimmed and case-folded, the developer list\'s own reading');
  const mod = { handle: 'Kithlan', created_at: 0 };
  assert.ok(isModerator(mod, env));
  assert.deepEqual(glyphsOf(mod, env, T0), ['mod']);
  assert.deepEqual(glyphsOf(mod, {}, T0), [], 'off the list, off the name - nothing to clear anywhere');
  assert.equal(isModerator({ handle: null, guest_name: 'Kithlan' }, env), false, 'a guest row is a device, not a person the list can name');
  // A DEVELOPER MAY MODERATE WITHOUT THE SHIELD: the dev mark already says more.
  const dev = { handle: 'Lattymoy', created_at: 0 };
  assert.ok(canModerate(dev, { DEVELOPER_HANDLES: 'Lattymoy' }));
  assert.deepEqual(glyphsOf(dev, { DEVELOPER_HANDLES: 'Lattymoy' }, T0), ['dev'], 'no shield for a developer who is not on the moderator list');
  assert.equal(canModerate({ handle: 'Bob' }, env), false);
  // and the face: every table the badge is drawn from names the shield, in blue
  assert.ok(GLYPHS.includes('mod'));
  assert.deepEqual(GLYPH_RGBA.mod, [0.29, 0.565, 0.886, 1], 'the blue Mac picked');
  assert.ok(GLYPH_PATH.mod && GLYPH_MARK.mod && GLYPH_LABEL.mod === 'Moderator');
});

// ── THE SERVICE ─────────────────────────────────────────────────────

async function rows() {
  const db = d1();
  const add = (id, handle) => db._raw.prepare('INSERT INTO players (id, handle, handle_lc, guest_name, created_at, last_seen) VALUES (?, ?, ?, ?, 1, 1)')
    .run(id, handle, handle?.toLowerCase() ?? null, `Guest ${id}`);
  add('p_mod1', 'Kithlan'); add('p_dev1', 'Lattymoy'); add('p_mod2', 'Other'); add('p_bob1', 'Bob'); add('p_gst1', null);
  const get = (id) => db._raw.prepare('SELECT * FROM players WHERE id = ?').get(id);
  return { db, get, env: { MODERATOR_HANDLES: 'Kithlan,Other', DEVELOPER_HANDLES: 'Lattymoy' } };
}

test('MOD1: a mute writes the ROW - until when, and WHO did it - and an unmute clears both', async () => {
  const { db, get, env } = await rows();
  const r = await muteAccount({ db, nowS: T0 }, get('p_mod1'), env, { target: 'p_gst1', minutes: 30 });
  assert.deepEqual(r, { ok: true, target: 'p_gst1', name: 'Guest p_gst1', until: T0 + 30 * 60 });
  assert.equal(get('p_gst1').muted_until, T0 + 1800);
  assert.equal(get('p_gst1').muted_by, 'p_mod1', 'a moderator\'s power leaves a record of its use');
  // a developer may too
  assert.equal((await muteAccount({ db, nowS: T0 }, get('p_dev1'), env, { target: 'p_bob1', minutes: 5 })).ok, true);
  const off = await muteAccount({ db, nowS: T0 + 60 }, get('p_mod1'), env, { target: 'p_gst1', minutes: 0 });
  assert.deepEqual(off, { ok: true, target: 'p_gst1', name: 'Guest p_gst1', until: 0 });
  assert.equal(get('p_gst1').muted_until, null);
  assert.equal(get('p_gst1').muted_by, null);
});

test('MOD1: the service refuses everybody its own lists do not name, every moderator, a self-mute, and a bound past a week - and writes NOTHING when it does', async () => {
  const { db, get, env } = await rows();
  const bob = get('p_bob1');
  const cases = [
    [bob, 'p_gst1', 30, 'not-moderator'],
    [get('p_mod1'), 'p_mod2', 30, 'protected'],
    [get('p_mod1'), 'p_dev1', 30, 'protected'],
    [get('p_mod1'), 'p_mod1', 30, 'protected'],
    [get('p_mod1'), 'p_nobody', 30, 'no-player'],
    [get('p_mod1'), 'not an id!', 30, 'no-player'],
    [get('p_mod1'), 'p_gst1', -1, 'bad-minutes'],
    [get('p_mod1'), 'p_gst1', 1.5, 'bad-minutes'],
    [get('p_mod1'), 'p_gst1', MUTE_MAX_MIN + 1, 'bad-minutes'],
    [get('p_mod1'), 'p_gst1', '30', 'bad-minutes'],
  ];
  for (const [actor, target, minutes, want] of cases) {
    const r = await muteAccount({ db, nowS: T0 }, actor, env, { target, minutes });
    assert.equal(r.error, want, `${actor.handle} -> ${target} for ${minutes}`);
  }
  assert.equal(get('p_gst1').muted_until, null, 'no refusal half-landed');
  assert.equal((await muteAccount({ db, nowS: T0 }, get('p_mod1'), env, { target: 'p_gst1', minutes: MUTE_MAX_MIN })).ok, true, 'a week exactly is allowed');
  for (const word of ['not-moderator', 'protected', 'no-player', 'bad-minutes']) {
    assert.ok(REFUSALS[word] && accountRefusalText(word) !== REFUSALS.server, `${word} has no sentence a moderator can read`);
  }
});

async function standService(vars = {}) {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pubB64 = Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url');
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*', ...vars };
  const call = async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const account = async (handle) => {
    const guest = (await call('POST', '/v1/auth/guest', {})).body;
    if (handle) await register({ db: env.DB, subtle, rand, nowS: Math.floor(Date.now() / 1000) }, guest.id, { handle, password: 'a-long-enough-password' });
    return guest;
  };
  return { env, call, pubB64, account };
}

test('MOD1: /v1/mod/mute answers a SIGNED order, and the muted player\'s every later token carries the mute - a reconnect does not shed one', async () => {
  const { call, pubB64, account } = await standService({ MODERATOR_HANDLES: 'Kithlan' });
  const mod = await account('Kithlan');
  const troll = await account(null);
  const pub = await importPublicKeyB64(pubB64, { subtle });
  const nowS = Math.floor(Date.now() / 1000);

  const r = await call('POST', '/v1/mod/mute', { target: troll.id, minutes: 30 }, mod.secret);
  assert.equal(r.status, 200);
  assert.ok(r.body.until >= nowS + 30 * 60 - 2 && r.body.until <= nowS + 30 * 60 + 2);
  const order = await verifyOrder(r.body.order, pub, { subtle, nowS });
  assert.ok(order.ok, order.why);
  assert.deepEqual({ o: order.claims.o, s: order.claims.s, mu: order.claims.mu }, { o: 'mute', s: troll.id, mu: r.body.until });

  const tok = await call('POST', '/v1/auth/token', {}, troll.secret);
  assert.equal(tok.body.mutedUntil, r.body.until, 'the client is told too');
  const id = await verifyToken(tok.body.token, pub, { subtle, nowS });
  assert.ok(id.ok, id.why);
  assert.equal(id.claims.mu, r.body.until, 'THE MUTE RIDES THE SIGNATURE - every room reads it at the hello');

  // lifted: the next token is the bytes an unmuted player always minted
  const off = await call('POST', '/v1/mod/mute', { target: troll.id, minutes: 0 }, mod.secret);
  assert.equal(off.body.until, 0);
  const after = await verifyToken((await call('POST', '/v1/auth/token', {}, troll.secret)).body.token, pub, { subtle, nowS });
  assert.equal('mu' in after.claims, false, 'absent, not 0 - an unmuted player mints what they always did');

  // the refusals, with the status each means
  assert.equal((await call('POST', '/v1/mod/mute', { target: mod.id, minutes: 30 }, troll.secret)).status, 403, 'a player who is not a moderator: forbidden, not signed out');
  assert.equal((await call('POST', '/v1/mod/mute', { target: 'p_nobody', minutes: 30 }, mod.secret)).status, 404);
  assert.equal((await call('POST', '/v1/mod/mute', { target: troll.id, minutes: -5 }, mod.secret)).status, 400);
  assert.equal((await call('POST', '/v1/mod/mute', { target: troll.id, minutes: 30 })).status, 401, 'behind the door like every other account route');
});

// ── THE TOKEN LAW ───────────────────────────────────────────────────

test('MOD1: an ORDER can never pass as an IDENTITY, nor an identity as an order - one key signs both, and the claim shapes are what keep them apart', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = T0;
  const order = await mintOrder({ s: 'acct-troll', mu: nowS + 600 }, kp.privateKey, { subtle, nowS });
  const ident = await mintToken({ s: 'acct-troll', n: 'Troll', k: 'guest' }, kp.privateKey, { subtle, nowS });
  assert.equal((await verifyToken(order, kp.publicKey, { subtle, nowS })).why, 'claims', 'an order presented at the door is not a hello');
  assert.equal((await verifyOrder(ident, kp.publicKey, { subtle, nowS })).why, 'claims', 'a hello presented as an order mutes nobody');
  assert.ok((await verifyOrder(order, kp.publicKey, { subtle, nowS })).ok);
  // the order's own shape
  const base = { o: 'mute', s: 'acct-troll', mu: 0, i: nowS, e: nowS + 30 };
  assert.ok(orderValid(base), 'mu 0 is an UNMUTE, and valid');
  assert.equal(orderValid({ ...base, o: 'ban' }), false, 'a kind this build does not know is refused, not guessed at');
  assert.equal(orderValid({ ...base, n: 'Troll' }), false);
  assert.equal(orderValid({ ...base, mu: -1 }), false);
  assert.equal(orderValid({ ...base, e: nowS + ORDER_TTL_S + 1 }), false, 'an order lives a minute and no more');
  assert.equal((await verifyOrder(order, kp.publicKey, { subtle, nowS: nowS + ORDER_TTL_S })).why, 'expired');
  // and the identity's `mu`
  const id = { s: 'acct-troll', n: 'Troll', k: 'guest', i: nowS, e: nowS + 60 };
  assert.ok(claimsValid({ ...id, mu: nowS + 1 }));
  assert.equal(claimsValid({ ...id, mu: nowS }), false, 'a mute that is already over is not a mute, and the minter must not say one is');
  assert.equal(claimsValid({ ...id, mu: '99' }), false);
});

// ── THE RELAY ───────────────────────────────────────────────────────

async function channel() {
  const r = fakeRoom(CHAT_WORLD_ROOM);
  const order = async (sub, mu, nowS = Math.floor(Date.now() / 1000)) => {
    const kp = await r.signer();
    return mintOrder({ s: sub, mu }, kp.privateKey, { subtle, nowS });
  };
  const carry = (ws, o) => r.room.webSocketMessage(ws, JSON.stringify({ t: 'mute', order: o }));
  return { r, order, carry };
}

test('MOD1: a muted token\'s line goes NOWHERE, and only its sender is told why and until when', async () => {
  const { r } = await channel();
  const until = Math.floor(Date.now() / 1000) + 600;
  const troll = r.connect(); await r.hello(troll, 'trol-0001', null, { mu: until });
  const bob = r.connect(); await r.hello(bob, 'bobb-0002');
  await r.chat(troll, 'spam');
  assert.equal(ofType(bob, 'chat').length, 0, 'nobody hears a muted line');
  assert.equal(ofType(troll, 'chat').length, 0, 'not even the sender - there is no receipt for a line that went nowhere');
  assert.deepEqual(ofType(troll, 'muted'), [{ t: 'muted', until }]);
  await r.chat(bob, 'hello');
  assert.deepEqual(ofType(troll, 'chat').map((m) => m.text), ['hello'], 'a muted player still READS chat');
  assert.equal(ofType(bob, 'chat')[0].sub, 'acct-bobb-0002', 'MOD1: a line carries its sender\'s verified account - what /mute names');
});

test('MOD1: an order carried in mutes the target NOW, on every socket it holds here - and the carrier is never asked who they are', async () => {
  const { r, order, carry } = await channel();
  const troll = r.connect(); await r.hello(troll, 'trol-0001');
  const bob = r.connect(); await r.hello(bob, 'bobb-0002');
  await r.chat(troll, 'before');
  assert.equal(ofType(bob, 'chat').length, 1);
  const until = Math.floor(Date.now() / 1000) + 600;
  // BOB carries it - anyone may. The signature is the authority.
  await carry(bob, await order('acct-trol-0001', until));
  assert.deepEqual(ofType(troll, 'muted'), [{ t: 'muted', until }], 'the target hears it at once');
  assert.equal(ofType(bob, 'muted').length, 0, 'nobody else does');
  await r.chat(troll, 'after');
  assert.equal(ofType(bob, 'chat').length, 1, 'and the next line goes nowhere');
});

test('MOD1: a FORGED order, and an identity token dressed as one, mute nobody', async () => {
  const { r, carry } = await channel();
  const troll = r.connect(); await r.hello(troll, 'trol-0001');
  const bob = r.connect(); await r.hello(bob, 'bobb-0002');
  const stranger = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = Math.floor(Date.now() / 1000);
  await carry(bob, await mintOrder({ s: 'acct-trol-0001', mu: nowS + 600 }, stranger.privateKey, { subtle, nowS }));
  await carry(bob, await r.token('trol-0001'));
  await carry(bob, 'v1.not.anything');
  assert.equal(ofType(troll, 'muted').length, 0);
  await r.chat(troll, 'still here');
  assert.equal(ofType(bob, 'chat').length, 1, 'the target still talks');
  assert.deepEqual(parseClient('{"t":"mute"}', { hasHello: true }), { error: 'bad mute' });
  assert.deepEqual(parseClient('{"t":"mute","order":"x"}', { hasHello: false }), { error: 'mute before hello' });
});

test('MOD1: THE NEWEST ORDER WINS - a replayed mute cannot undo the unmute that followed it, and a token minted before an order takes the order\'s word', async () => {
  const { r, order, carry } = await channel();
  const troll = r.connect(); await r.hello(troll, 'trol-0001');
  const bob = r.connect(); await r.hello(bob, 'bobb-0002');
  const nowS = Math.floor(Date.now() / 1000);
  const mute = await order('acct-trol-0001', nowS + 600, nowS - 2);
  const unmute = await order('acct-trol-0001', 0, nowS - 1);
  await carry(bob, mute);
  await new Promise((res) => setTimeout(res, 1100));   // the mute gate's one-a-second, honestly waited out
  await carry(bob, unmute);
  assert.deepEqual(ofType(troll, 'muted').map((m) => m.until), [nowS + 600, 0]);
  await new Promise((res) => setTimeout(res, 1100));
  await carry(bob, mute);   // the replay, inside its minute
  assert.deepEqual(ofType(troll, 'muted').map((m) => m.until), [nowS + 600, 0], 'the older order was ignored');
  await r.chat(troll, 'free');
  assert.equal(ofType(bob, 'chat').length, 1, 'and the target talks');

  // A HELLO WHOSE TOKEN PREDATES THE ROOM'S NEWEST ORDER takes the
  // order's word: a token minted a moment before the mute cannot carry
  // its holder past it.
  const { r: r2, order: order2, carry: carry2 } = await channel();
  const mod = r2.connect(); await r2.hello(mod, 'modd-0003');
  const later = Math.floor(Date.now() / 1000) + 5;   // issued after any token the harness mints now
  await carry2(mod, await order2('acct-late-0004', later + 600, later));
  const late = r2.connect(); await r2.hello(late, 'late-0004');   // its token: unmuted, and older than the order
  await r2.chat(late, 'sneak');
  assert.equal(ofType(mod, 'chat').length, 0, 'the fresh hello was held to the newer order');
  assert.deepEqual(ofType(late, 'muted'), [{ t: 'muted', until: later + 600 }]);
  assert.equal(MUTE_HZ_MAX, 1);
});

// ── THE COMMANDS ────────────────────────────────────────────────────

test('MOD1: /mute and /unmute parse - a name may have a space in it, the minutes are the last word, and a bad bound is said rather than sent', () => {
  assert.deepEqual(parseModCommand('/mute Bob'), { op: 'mute', name: 'Bob', minutes: MUTE_DEFAULT_MIN });
  assert.deepEqual(parseModCommand('/mute Bob 45'), { op: 'mute', name: 'Bob', minutes: 45 });
  assert.deepEqual(parseModCommand('/MUTE  Theod Gwyn 10 '), { op: 'mute', name: 'Theod Gwyn', minutes: 10 }, 'a guest\'s generated name has a space');
  assert.deepEqual(parseModCommand('/mute Theod Gwyn'), { op: 'mute', name: 'Theod Gwyn', minutes: MUTE_DEFAULT_MIN });
  assert.deepEqual(parseModCommand('/unmute Theod Gwyn'), { op: 'unmute', name: 'Theod Gwyn' });
  assert.deepEqual(parseModCommand('/mute'), { error: MUTE_USAGE });
  assert.deepEqual(parseModCommand('/unmute   '), { error: MUTE_USAGE });
  assert.match(parseModCommand('/mute Bob 0').error, /1 to 10080/);
  assert.match(parseModCommand(`/mute Bob ${MUTE_MAX_MIN + 1}`).error, /1 to 10080/);
  assert.deepEqual(parseModCommand(`/mute Bob ${MUTE_MAX_MIN}`), { op: 'mute', name: 'Bob', minutes: MUTE_MAX_MIN });
  for (const not of ['hello', '/muted Bob', '/red hi', 'mute Bob', '/mutes']) assert.equal(parseModCommand(not), null, not);
});

test('MOD1: a name finds ONE account or refuses - two players with one name is never a guess', () => {
  const peers = (...ps) => ({ peers: new Map(ps.map((p, i) => [`id-${i}`, p])) });
  assert.deepEqual(resolveTarget(peers({ name: 'Bob', sub: 'acct-b' }, { name: 'Ann', sub: 'acct-a' }), 'bob'), { sub: 'acct-b', name: 'Bob' }, 'case does not matter');
  assert.deepEqual(resolveTarget(peers({ name: 'Bob', sub: 'acct-b' }, { name: 'Bob', sub: 'acct-b' }), 'Bob'), { sub: 'acct-b', name: 'Bob' }, 'one account on two tabs is one player');
  assert.match(resolveTarget(peers({ name: 'Theod Gwyn', sub: 'acct-1' }, { name: 'Theod Gwyn', sub: 'acct-2' }), 'Theod Gwyn').error, /2 players are called Theod Gwyn/);
  assert.match(resolveTarget(peers({ name: 'Bob', sub: null }), 'Bob').error, /cannot be muted from here yet/, 'a name with no verified account is not muted by guessing');
  assert.match(resolveTarget(peers({ name: 'Bob', sub: 'acct-b' }), 'Nobody').error, /Nobody called Nobody is online/);
  assert.match(resolveTarget(null, 'Bob').error, /Nobody called Bob/);
});

test('MOD1: a command runs end to end - the service asked, the signed order carried into EVERY room held, and the moderator told in words', async () => {
  const session = { peers: new Map([['p1', { name: 'Troll', sub: 'acct-t' }]]) };
  const carried = [];
  const links = [{ sendMuteOrder: (o) => (carried.push(['chat', o]), true) }, { sendMuteOrder: (o) => (carried.push(['place', o]), true) }];
  const asked = [];
  const mute = async (sub, minutes) => { asked.push([sub, minutes]); return { ok: true, data: { name: 'Troll', until: 1, order: 'v1.order.sig' } }; };
  const refusal = accountRefusalText;
  assert.equal(await runModCommand({ op: 'mute', name: 'troll', minutes: 30 }, { session, links, mute, refusal }), 'Troll is muted for 30 minutes.');
  assert.deepEqual(asked, [['acct-t', 30]]);
  assert.deepEqual(carried, [['chat', 'v1.order.sig'], ['place', 'v1.order.sig']], 'into every room this client holds');
  assert.equal(await runModCommand({ op: 'unmute', name: 'Troll' }, { session, links, mute, refusal }), 'Troll can chat again.');
  assert.deepEqual(asked.at(-1), ['acct-t', 0], 'an unmute is minutes 0');
  // a refusal is the service's own sentence
  const no = async () => ({ ok: false, error: 'not-moderator' });
  assert.equal(await runModCommand({ op: 'mute', name: 'Troll', minutes: 5 }, { session, links, mute: no, refusal }), REFUSALS['not-moderator']);
  // a service with no signing key still mutes the ROW, and the line says when it lands
  const unsigned = async () => ({ ok: true, data: { name: 'Troll', until: 1, order: null } });
  assert.equal(await runModCommand({ op: 'mute', name: 'Troll', minutes: 1 }, { session, links, mute: unsigned, refusal }), 'Troll is muted for 1 minute. It takes effect when they next connect.');
  // and nothing is asked for a name nobody holds
  const before = asked.length;
  assert.match(await runModCommand({ op: 'mute', name: 'Ghost', minutes: 5 }, { session, links, mute, refusal }), /Nobody called Ghost/);
  assert.equal(asked.length, before);
});

test('MOD1: the muted player reads it once per event, in minutes rounded UP', () => {
  assert.equal(mutedText(T0 + 1800, T0), 'You are muted for 30 more minutes.');
  assert.equal(mutedText(T0 + 30, T0), 'You are muted for 1 more minute.', 'the last minute is "1", never "0"');
  assert.equal(mutedText(0, T0), 'You can chat again.');
  assert.equal(mutedText(T0 - 1, T0), 'You can chat again.');
  const once = mutedNotices();
  assert.equal(once(T0 + 60, 1000), true);
  assert.equal(once(T0 + 60, 1500), false, 'the same order arriving on a second room at once is said once');
  assert.equal(once(T0 + 60, 3500), true, 'a later try to talk is a new event and is said again');
  assert.equal(once(0, 3600), true, 'a lift is its own event');
});

test('MOD1: the session carries `sub` onto peers and lines, hands a muted frame up once gated, and sends an order at the relay\'s own rate', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let clock = 1_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', presence: false, WebSocketImpl: FakeWS, now: () => clock });
  const heard = []; const muted = [];
  s.onChat = (l) => heard.push(l);
  s.onMuted = (m) => muted.push(m);
  s.join(CHAT_WORLD_ROOM);
  const ws = sockets[0];
  ws.open();
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'bob-0002', name: 'Bob', sub: 'acct-bob' }, { id: 'eve-0003', name: 'Eve', sub: 'not an id!' }], n: 3 });
  assert.equal(s.peers.get('bob-0002').sub, 'acct-bob');
  assert.equal(s.peers.get('eve-0003').sub, null, 'an account id outside the wire\'s law is no account');
  ws.receive({ t: 'chat', id: 'bob-0002', name: 'Bob', text: 'hi', at: 1, sub: 'acct-bob' });
  assert.equal(heard[0].sub, 'acct-bob');
  ws.receive({ t: 'muted', until: 1234 });
  ws.receive({ t: 'muted', until: -1 });
  ws.receive({ t: 'muted' });
  assert.deepEqual(muted, [{ until: 1234 }], 'a malformed muted frame is dropped');
  assert.equal(mutedUntilOf({ until: 0 }), 0);
  assert.equal(subOf({ sub: 'acct-x' }), 'acct-x');
  assert.equal(s.sendMuteOrder('v1.a.b'), true);
  assert.deepEqual(JSON.parse(ws.sent.at(-1)), { t: 'mute', order: 'v1.a.b' });
  assert.equal(s.sendMuteOrder('v1.a.c'), false, 'the relay takes one a second; this refuses the second rather than having it dropped');
  assert.equal(s.sendMuteOrder(''), false);
  assert.equal(s.sendMuteOrder('x'.repeat(1025)), false);
});

test('MOD1: the world host parses the commands before a line is sent, and every room it holds tells the player they are muted', () => {
  const w = src('src/scenes/world.js');
  const at = (re) => { const m = re.exec(w); assert.ok(m, `world.js no longer has ${re}`); return m.index; };
  assert.ok(at(/const mod = parseModCommand\(text\);/) < at(/return chatLinks\.get\(tabId\)\?\.sendChat\(text\) \?\? false;/), 'a /mute typed must never go out as a chat line');
  assert.match(w, /link\.onMuted = onMuted;/, 'every chat link');
  assert.match(w, /online\.onMuted = onMuted;/, 'and the place room\'s own session');
  assert.match(w, /runModCommand\(mod, \{ session: \{ peers \}, links, mute, refusal: accountRefusalText \}\)/);
});
