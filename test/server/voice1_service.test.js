// THE SERVICE'S LAW - the authorizer, the proximity
// policy, the LiveKit credential and the two doors, driven end to end through `handle` with a real Ed25519 pair: a
// forged room, an expired token, an impersonated id, a party not sat in, a rate exceeded - each refused where the plan's
// security row says it must be.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mintToken, MAX_TTL_S, _b64url } from '../../src/net/identityToken.js';
import { VOICE_V, VOICE_TOKEN_TTL_S, VOICE_MINT_PER_MIN, VOICE_PLACE_HZ_MAX, voiceRoomName, VOICE_ROOM_MAX } from '../../src/voice/voiceWire.js';
import { VOICE_PLACE_MS } from '../../src/voice/voiceProximity.js';
import { authorizeVoice } from '../../server-voice/src/roomAuthorizer.js';
import { ProximityPolicy, VOICE_PLACE_STALE_MS, VOICE_ROOM_IDLE_MS } from '../../server-voice/src/proximityPolicy.js';
import { RoomSharder, VOICE_SHARD_IDLE_MS, shardRoomName } from '../../server-voice/src/roomSharder.js';
import { mintLiveKitToken, mintLiveKitAdminToken, readJwtClaims } from '../../server-voice/src/livekitToken.js';
import { handle, _resetForTests, _peekPolicyForTests, _peekSharderForTests, VOICE_SERVICE_VERSION } from '../../server-voice/src/index.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const NOW_S = 1_760_000_000;

async function keys() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const raw = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
  return { priv: kp.privateKey, pub: kp.publicKey, pubB64: _b64url.encode(raw) };
}
const who = (s, extra = {}) => ({ s, n: 'Bran', k: 'guest', ...extra });
const env = (k, extra = {}) => ({ IDENTITY_PUBLIC_KEY: k.pubB64, LIVEKIT_URL: 'wss://voice.test', LIVEKIT_API_KEY: 'devkey', LIVEKIT_API_SECRET: 'devsecret_devsecret_devsecret_devsecret', presenceOf: () => true, ...extra });
const post = (path, body) => new Request(`https://voice.test${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const io = (t = NOW_S * 1000) => ({ now: () => t, subtle, fetch: async () => { throw new Error('no network in this test'); } });

// ─── THE AUTHORIZER ─────────────────────────────────────────────────────────────────────────────────────────────────

test('voice authorizer: the identity is the token\'s verified subject; a bad signature, an expired token, a wrong room, a room not really stood in and a party not sat in are refused with the plan\'s status', async () => {
  const k = await keys(), other = await keys();
  const tok = await mintToken(who('peer_aaaa'), k.priv, { subtle, nowS: NOW_S });
  const ok = await authorizeVoice({ token: tok, channel: 'proximity', room: 'cell:1.2', party: null }, { publicKey: k.pub, subtle, nowS: NOW_S, partyOf: () => null, presenceOf: () => true });
  assert.equal(ok.ok, true); assert.equal(ok.identity, 'peer_aaaa'); assert.equal(ok.name, 'Bran'); assert.equal(ok.room, voiceRoomName('proximity', 'cell:1.2')); assert.equal(ok.canPublish, true);
  assert.equal(ok.ttl, VOICE_TOKEN_TTL_S, 'the credential\'s life, bounded by the token\'s');
  // a room the relay does not see this identity in is refused, same shape as a party not sat in
  assert.deepEqual(await authorizeVoice({ token: tok, channel: 'proximity', room: 'cell:1.2', party: null }, { publicKey: k.pub, subtle, nowS: NOW_S, partyOf: () => null, presenceOf: () => false }), { ok: false, why: 'not-in-room', status: 403 });
  // a caller that forgot to wire presenceOf at all refuses too - fail closed, never skip the check
  assert.deepEqual(await authorizeVoice({ token: tok, channel: 'proximity', room: 'cell:1.2', party: null }, { publicKey: k.pub, subtle, nowS: NOW_S, partyOf: () => null }), { ok: false, why: 'not-in-room', status: 403 });
  // signed by someone else
  const forged = await mintToken(who('peer_aaaa'), other.priv, { subtle, nowS: NOW_S });
  assert.deepEqual(await authorizeVoice({ token: forged, channel: 'proximity', room: 'cell:1.2', party: null }, { publicKey: k.pub, subtle, nowS: NOW_S, partyOf: () => null, presenceOf: () => true }), { ok: false, why: 'bad-token:signature', status: 401 });
  // expired
  const old = await authorizeVoice({ token: tok, channel: 'proximity', room: 'cell:1.2', party: null }, { publicKey: k.pub, subtle, nowS: NOW_S + MAX_TTL_S + 60, partyOf: () => null, presenceOf: () => true });
  assert.equal(old.ok, false); assert.equal(old.status, 401); assert.match(old.why, /^bad-token:/);
  // a token near its end bounds the credential
  const late = await authorizeVoice({ token: tok, channel: 'proximity', room: 'cell:1.2', party: null }, { publicKey: k.pub, subtle, nowS: NOW_S + MAX_TTL_S - 20, partyOf: () => null, presenceOf: () => true });
  assert.equal(late.ok, true); assert.equal(late.ttl, 20);
  // no key: 503, never a guess
  assert.deepEqual(await authorizeVoice({ token: tok, channel: 'proximity', room: 'cell:1.2', party: null }, { publicKey: null, subtle, nowS: NOW_S, partyOf: () => null, presenceOf: () => true }), { ok: false, why: 'no-public-key', status: 503 });
  // a party: the hub's word, not the client's
  const partyAsk = { token: tok, channel: 'party', room: null, party: 'q1abc2def3' };
  assert.deepEqual(await authorizeVoice(partyAsk, { publicKey: k.pub, subtle, nowS: NOW_S, partyOf: () => null }), { ok: false, why: 'not-in-party', status: 403 });
  assert.deepEqual(await authorizeVoice(partyAsk, { publicKey: k.pub, subtle, nowS: NOW_S, partyOf: () => 'q9other999' }), { ok: false, why: 'not-in-party', status: 403 });
  const inParty = await authorizeVoice(partyAsk, { publicKey: k.pub, subtle, nowS: NOW_S, partyOf: async (acct) => (acct === 'peer_aaaa' ? 'q1abc2def3' : null) });
  assert.equal(inParty.ok, true); assert.equal(inParty.room, 'vp_q1abc2def3');
  // muted: may listen, not publish
  const muted = await mintToken(who('peer_aaaa', { mu: NOW_S + 600 }), k.priv, { subtle, nowS: NOW_S });
  assert.equal((await authorizeVoice({ token: muted, channel: 'proximity', room: 'cell:1.2', party: null }, { publicKey: k.pub, subtle, nowS: NOW_S, partyOf: () => null, presenceOf: () => true })).canPublish, false);
});

// ─── THE PROXIMITY POLICY ───────────────────────────────────────────────────────────────────────────────────────────

test('voice policy: hearing is MUTUAL and FRESH - a listener hears a publisher only when each named the other inside the stale window; a leaver is heard by nobody', () => {
  const clock = { t: 0 };
  const p = new ProximityPolicy({ now: () => clock.t });
  assert.equal(VOICE_PLACE_STALE_MS, 6 * VOICE_PLACE_MS);
  p.place('r', 'a', ['b', 'c', 'a']);   // a names itself: ignored
  assert.deepEqual(p.allowFor('r', 'a'), [], 'nobody named a back yet');
  p.place('r', 'b', ['a']);
  assert.deepEqual(p.allowFor('r', 'a'), ['b']); assert.deepEqual(p.allowFor('r', 'b'), ['a']);
  assert.equal(p.mayHear('r', 'b', 'a'), true); assert.equal(p.mayHear('r', 'c', 'a'), false, 'c never spoke');
  p.place('r', 'c', ['a']);
  assert.deepEqual(p.allowFor('r', 'a'), ['b', 'c']);
  // a lies about standing near d: d did not name a, so d hears nothing of a - and a hears nothing of d
  p.place('r', 'd', []); p.place('r', 'a', ['b', 'c', 'd']);
  assert.equal(p.mayHear('r', 'd', 'a'), false); assert.equal(p.mayHear('r', 'a', 'd'), false);
  // b goes quiet: past the stale window, b is heard by nobody and hears nobody
  clock.t = VOICE_PLACE_STALE_MS + 1; p.place('r', 'a', ['b', 'c']); p.place('r', 'c', ['a']);
  assert.deepEqual(p.allowFor('r', 'a'), ['c']); assert.deepEqual(p.allowFor('r', 'b'), []);
  // another room is another world
  p.place('q', 'a', ['c']); p.place('q', 'c', ['a']);
  assert.deepEqual(p.allowFor('q', 'a'), ['c']); assert.deepEqual(p.allowFor('r', 'a'), ['c']);
  p.leave('r', 'c'); assert.deepEqual(p.allowFor('r', 'a'), []);
  assert.deepEqual(p.allowFor('zz', 'a'), []);
  // the sweep
  clock.t += VOICE_ROOM_IDLE_MS + 1;
  assert.ok(p.sweep() >= 3); assert.equal(p.rooms.size, 0);
});

// ─── THE ROOM SHARDER ───────────────────────────────────────────────────────────────────────────────────────────────

test('voice sharder: VOICE_ROOM_MAX seats a shard, the next identity opens shard 1, and a shard assignment sticks until idle', () => {
  const clock = { t: 0 };
  const s = new RoomSharder({ now: () => clock.t });
  for (let i = 0; i < VOICE_ROOM_MAX; i++) assert.equal(s.assign('vx_cell_1', `peer_${i}`), 0, `seat ${i} fits shard 0`);
  assert.equal(s.assign('vx_cell_1', 'peer_overflow'), 1, 'the 17th seat opens a second shard');
  // sticky: re-asking an already-seated identity returns its same shard, not a re-roll
  assert.equal(s.assign('vx_cell_1', 'peer_0'), 0);
  assert.equal(s.assign('vx_cell_1', 'peer_overflow'), 1);
  // shardOf reads without assigning; an unseated identity gets null, not a seat spent on a mere read
  assert.equal(s.shardOf('vx_cell_1', 'peer_0'), 0);
  assert.equal(s.shardOf('vx_cell_1', 'peer_never_seen'), null);
  // another base room is its own world
  assert.equal(s.assign('vx_cell_2', 'peer_0'), 0, 'a different room starts its own shard 0');
  // leave frees the seat for the next cold ask - no idle wait needed
  s.leave('vx_cell_1', 'peer_0');
  assert.equal(s.shardOf('vx_cell_1', 'peer_0'), null);
  assert.equal(s.assign('vx_cell_1', 'peer_0'), 0, 'the freed seat is handed out again at once');
  // idle: shardOf reads it as gone at once, but the O(1) occupancy COUNT still holds the seat until sweep() runs -
  // a bounded overcount (never an undercount) traded for never rescanning the whole room on every arrival
  clock.t = VOICE_SHARD_IDLE_MS + 1;
  assert.equal(s.shardOf('vx_cell_1', 'peer_1'), null, 'idle past the window reads as gone');
  assert.equal(s.assign('vx_cell_1', 'peer_fresh'), 1, 'shard 0 still counts its idle seats until swept - correctly conservative, not a rescan');
  assert.equal(s.sweep() >= 1, true, 'sweep reclaims the idle seats');
  assert.equal(s.assign('vx_cell_1', 'peer_fresh2'), 0, 'after the sweep, shard 0 is free again');
});

test('voice sharder: shardRoomName names shard 0 as the base room itself (old deploys see no name change) and higher shards distinctly', () => {
  assert.equal(shardRoomName('vx_cell_1', 0), 'vx_cell_1');
  assert.equal(shardRoomName('vx_cell_1', 1), 'vx_cell_1_s1');
  assert.equal(shardRoomName('vx_cell_1', 3), 'vx_cell_1_s3');
});

test('voice sharder: sweep drops only the idle seats and the rooms they empty', () => {
  const clock = { t: 0 };
  const s = new RoomSharder({ now: () => clock.t });
  s.assign('vx_cell_1', 'a'); s.assign('vx_cell_1', 'b');
  clock.t = VOICE_SHARD_IDLE_MS + 1;
  s.assign('vx_cell_1', 'c');   // fresh - must survive the sweep
  assert.equal(s.sweep(), 2, 'a and b were idle, c was not');
  assert.equal(s.rooms.get('vx_cell_1').seats.has('c'), true);
  assert.equal(s.rooms.get('vx_cell_1').seats.has('a'), false);
});

test('voice sharder: assign() is O(1) per call regardless of room population - no full-room rescan on each new identity', () => {
  const s = new RoomSharder({ now: () => 0 });
  // warm up (JIT) then time two spans of equal size at very different room populations
  for (let i = 0; i < 2000; i++) s.assign('warm', 'id_' + i);
  const timeSpan = (room, startAt, n) => {
    const t0 = performance.now();
    for (let i = startAt; i < startAt + n; i++) s.assign(room, 'id_' + i);
    return performance.now() - t0;
  };
  const small = timeSpan('vx_cell_small', 0, 2000);
  for (let i = 0; i < 48000; i++) s.assign('vx_cell_big', 'filler_' + i);   // grow this room far past the small one
  const bigAfterGrowth = timeSpan('vx_cell_big', 50000, 2000);
  // an O(n) rescan-per-call design costs dramatically more once the room has 50,000 seats than once it has 2,000 -
  // allow generous headroom (10x) for noise, since this guards against an O(n) REGRESSION, not a tight perf budget
  assert.ok(bigAfterGrowth < small * 10 + 50, `assign() must not slow down with room population (small=${small.toFixed(1)}ms, bigAfterGrowth=${bigAfterGrowth.toFixed(1)}ms)`);
});

test('voice credential: an HS256 JWT LiveKit reads - issuer the key, subject the identity, one room, the microphone alone, no data, no metadata writes; a muted holder may not publish', async () => {
  const tok = await mintLiveKitToken({ apiKey: 'devkey', apiSecret: 'secret', identity: 'peer_aaaa', name: 'Bran', room: 'vx_cell_1', ttlS: 120, nowS: NOW_S }, subtle);
  const [h, , sig] = tok.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url').toString()), { alg: 'HS256', typ: 'JWT' });
  const c = readJwtClaims(tok);
  assert.equal(c.iss, 'devkey'); assert.equal(c.sub, 'peer_aaaa'); assert.equal(c.name, 'Bran'); assert.equal(c.exp, NOW_S + 120); assert.equal(c.nbf, NOW_S - 10);
  assert.deepEqual(c.video, { room: 'vx_cell_1', roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false, canUpdateOwnMetadata: false, canPublishSources: ['microphone'] });
  // the signature verifies with the secret and not another
  const key = await subtle.importKey('raw', new TextEncoder().encode('secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  assert.equal(await subtle.verify('HMAC', key, Buffer.from(sig, 'base64url'), new TextEncoder().encode(tok.split('.').slice(0, 2).join('.'))), true);
  const wrong = await subtle.importKey('raw', new TextEncoder().encode('other'), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  assert.equal(await subtle.verify('HMAC', wrong, Buffer.from(sig, 'base64url'), new TextEncoder().encode(tok.split('.').slice(0, 2).join('.'))), false);
  const quiet = readJwtClaims(await mintLiveKitToken({ apiKey: 'k', apiSecret: 's', identity: 'x', room: 'r', ttlS: 1, nowS: NOW_S, canPublish: false }, subtle));
  assert.equal(quiet.video.canPublish, false); assert.deepEqual(quiet.video.canPublishSources, []);
  const admin = readJwtClaims(await mintLiveKitAdminToken({ apiKey: 'k', apiSecret: 's', room: 'r', nowS: NOW_S }, subtle));
  assert.deepEqual(admin.video, { room: 'r', roomAdmin: true, roomCreate: true }); assert.equal(admin.exp, NOW_S + 60);
  await assert.rejects(() => mintLiveKitToken({ apiKey: '', apiSecret: 's', identity: 'x', room: 'r', ttlS: 1, nowS: NOW_S }, subtle), TypeError);
  await assert.rejects(() => mintLiveKitToken({ apiKey: 'k', apiSecret: 's', identity: 'x', room: 'r', ttlS: 1.5, nowS: NOW_S }, subtle), TypeError);
  assert.equal(readJwtClaims('garbage'), null);
});

// ─── THE DOORS, END TO END ──────────────────────────────────────────────────────────────────────────────────────────

test('voice doors: /health; the token door mints for a verified holder and refuses a bad shape, a forged token, a party not sat in, an unready server; the place door keeps the policy; CORS answered', async () => {
  _resetForTests();
  const k = await keys(); const e = env(k, { partyOf: (acct) => (acct === 'peer_aaaa' ? 'q1abc2def3' : null) });
  const tok = await mintToken(who('peer_aaaa'), k.priv, { subtle, nowS: NOW_S });
  const health = await handle(new Request('https://voice.test/health'), e, io());
  assert.deepEqual(await health.json(), { ok: true, service: 'daggerfall-voice', version: VOICE_SERVICE_VERSION, v: VOICE_V, t: NOW_S * 1000 });
  const pre = await handle(new Request('https://voice.test/v1/voice/token', { method: 'OPTIONS' }), { ...e, CORS_ORIGIN: 'https://game.test' }, io());
  assert.equal(pre.status, 204); assert.equal(pre.headers.get('access-control-allow-origin'), 'https://game.test');
  assert.equal((await handle(new Request('https://voice.test/v1/voice/token'), e, io())).status, 405);
  assert.equal((await handle(new Request('https://voice.test/v1/voice/token', { method: 'POST', body: '{nope' }), e, io())).status, 400);
  assert.equal((await handle(post('/v1/voice/token', { token: tok, room: 'cell:1', channel: 'guild' }), e, io())).status, 400, 'a wrong shape');
  assert.equal((await handle(post('/v1/voice/nope', { token: tok }), e, io())).status, 404);
  // the mint
  const res = await handle(post('/v1/voice/token', { token: tok, room: 'cell:1.2', channel: 'proximity' }), e, io());
  assert.equal(res.status, 200); assert.equal(res.headers.get('cache-control'), 'no-store');
  const a = await res.json();
  assert.equal(a.ok, true); assert.equal(a.v, VOICE_V); assert.equal(a.url, 'wss://voice.test'); assert.equal(a.identity, 'peer_aaaa'); assert.equal(a.room, 'vx_cell_1_2'); assert.equal(a.ttl, VOICE_TOKEN_TTL_S); assert.equal(a.canPublish, true);
  const c = readJwtClaims(a.token); assert.equal(c.sub, 'peer_aaaa'); assert.equal(c.video.room, 'vx_cell_1_2'); assert.equal(c.iss, 'devkey');
  // an impersonation: a body naming another id changes nothing - the subject is the token's
  const imp = await (await handle(post('/v1/voice/token', { token: tok, room: 'cell:1.2', channel: 'proximity', playerId: 'peer_zzzz', identity: 'peer_zzzz' }), e, io())).json();
  assert.equal(imp.identity, 'peer_aaaa');
  // forged
  const other = await keys(); const forged = await mintToken(who('peer_aaaa'), other.priv, { subtle, nowS: NOW_S });
  const f = await handle(post('/v1/voice/token', { token: forged, room: 'cell:1.2', channel: 'proximity' }), e, io());
  assert.equal(f.status, 401); assert.match((await f.json()).error, /^bad-token/);
  // expired
  assert.equal((await handle(post('/v1/voice/token', { token: tok, room: 'cell:1.2', channel: 'proximity' }), e, io((NOW_S + MAX_TTL_S + 60) * 1000))).status, 401);
  // the party
  assert.equal((await handle(post('/v1/voice/token', { token: tok, channel: 'party', party: 'q9other999' }), e, io())).status, 403);
  const pa = await (await handle(post('/v1/voice/token', { token: tok, channel: 'party', party: 'q1abc2def3' }), e, io())).json();
  assert.equal(pa.room, 'vp_q1abc2def3');
  // no media server configured, no public key: 503 both
  assert.equal((await handle(post('/v1/voice/token', { token: tok, room: 'cell:1', channel: 'proximity' }), { ...e, LIVEKIT_URL: '' }, io())).status, 503);
  _resetForTests();
  assert.equal((await handle(post('/v1/voice/token', { token: tok, room: 'cell:1', channel: 'proximity' }), { ...e, IDENTITY_PUBLIC_KEY: '' }, io())).status, 503);
  _resetForTests();
  // the place door: the policy's mutual answer, through the service
  const tokB = await mintToken(who('peer_bbbb'), k.priv, { subtle, nowS: NOW_S });
  let r = await (await handle(post('/v1/voice/place', { token: tok, room: 'cell:1.2', near: ['peer_bbbb'] }), e, io())).json();
  assert.deepEqual(r, { ok: true, v: VOICE_V, allow: [] });
  r = await (await handle(post('/v1/voice/place', { token: tokB, room: 'cell:1.2', near: ['peer_aaaa'] }), e, io())).json();
  assert.deepEqual(r.allow, ['peer_aaaa']);
  r = await (await handle(post('/v1/voice/place', { token: tok, room: 'cell:1.2', near: ['peer_bbbb'] }), e, io())).json();
  assert.deepEqual(r.allow, ['peer_bbbb']);
  // another room's frame does not reach this room's policy
  r = await (await handle(post('/v1/voice/place', { token: tok, room: 'cell:9.9', near: ['peer_bbbb'] }), e, io())).json();
  assert.deepEqual(r.allow, []);
  assert.equal((await handle(post('/v1/voice/place', { token: tok, room: 'cell:1.2', near: ['x'] }), e, io())).status, 400);
  assert.equal((await handle(post('/v1/voice/place', { token: forged, room: 'cell:1.2', near: [] }), e, io())).status, 401);
});

test('voice doors: a token mint creates the SFU room first when an admin door is set - auto_create:false would else refuse the first join', async () => {
  _resetForTests();
  const k = await keys();
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push([new URL(url).pathname, JSON.parse(init.body)]); return { ok: true, json: async () => ({}) }; };
  const e = env(k, { LIVEKIT_ADMIN_URL: 'https://sfu.test' });
  const tok = await mintToken(who('peer_aaaa'), k.priv, { subtle, nowS: NOW_S });
  await handle(post('/v1/voice/token', { token: tok, room: 'cell:1.2', channel: 'proximity' }), e, { ...io(), fetch: fetchImpl });
  assert.deepEqual(calls[0], ['/twirp/livekit.RoomService/CreateRoom', { name: 'vx_cell_1_2', empty_timeout: 300, max_participants: 16 }]);
  // no admin door: no call, and the mint still succeeds (the SFU's own auto_create is then the only net)
  _resetForTests();
  const res = await handle(post('/v1/voice/token', { token: tok, room: 'cell:1.2', channel: 'proximity' }), env(k), io());
  assert.equal(res.status, 200);
});

test('voice rates: VOICE_MINT_PER_MIN mints a minute an identity, VOICE_PLACE_HZ_MAX place frames a second, each 429 past it and open again when the window turns', async () => {
  _resetForTests();
  const k = await keys(); const e = env(k);
  const tok = await mintToken(who('peer_aaaa'), k.priv, { subtle, nowS: NOW_S });
  let t = NOW_S * 1000;
  for (let i = 0; i < VOICE_MINT_PER_MIN; i++) assert.equal((await handle(post('/v1/voice/token', { token: tok, room: 'cell:1', channel: 'proximity' }), e, io(t))).status, 200, `mint ${i}`);
  assert.equal((await handle(post('/v1/voice/token', { token: tok, room: 'cell:1', channel: 'proximity' }), e, io(t))).status, 429);
  const tokB = await mintToken(who('peer_bbbb'), k.priv, { subtle, nowS: NOW_S });
  assert.equal((await handle(post('/v1/voice/token', { token: tokB, room: 'cell:1', channel: 'proximity' }), e, io(t))).status, 200, 'another identity, its own bucket');
  t += 60_000;
  assert.equal((await handle(post('/v1/voice/token', { token: tok, room: 'cell:1', channel: 'proximity' }), e, io(t))).status, 200, 'the window turned');
  for (let i = 0; i < VOICE_PLACE_HZ_MAX; i++) assert.equal((await handle(post('/v1/voice/place', { token: tok, room: 'cell:1', near: [] }), e, io(t))).status, 200);
  assert.equal((await handle(post('/v1/voice/place', { token: tok, room: 'cell:1', near: [] }), e, io(t))).status, 429);
  t += 1000;
  assert.equal((await handle(post('/v1/voice/place', { token: tok, room: 'cell:1', near: [] }), e, io(t))).status, 200);
});

test('voice doors: a room past VOICE_ROOM_MAX overflows to a second SFU room, not a refused 17th join - and mutual hearing stays within its own shard', async () => {
  _resetForTests();
  const k = await keys(); const e = env(k);
  const mint = async (id) => {
    const tok = await mintToken(who(id), k.priv, { subtle, nowS: NOW_S });
    return (await (await handle(post('/v1/voice/token', { token: tok, room: 'cell:1.2', channel: 'proximity' }), e, io())).json());
  };
  const answers = [];
  for (let i = 0; i < VOICE_ROOM_MAX; i++) answers.push(await mint(`peer_${String(i).padStart(4, '0')}`));
  for (const a of answers) assert.equal(a.room, 'vx_cell_1_2', 'the first VOICE_ROOM_MAX seats fill the base room');
  const overflow = await mint('peer_over1');
  assert.equal(overflow.room, 'vx_cell_1_2_s1', 'the 17th joiner is NOT refused - a second physical room opens');
  assert.notEqual(overflow.room, answers[0].room, 'a different shard is a different SFU room the client actually joins');
  // sticky: minting again for an already-seated identity returns it to the SAME shard, not a re-roll
  const again = await mint('peer_0000');
  assert.equal(again.room, 'vx_cell_1_2', 'an already-seated identity stays in its shard on reconnect');
  // the place door keys its mutual-hearing policy off the PHYSICAL room: an overflow peer and a base-room peer,
  // though sharing the same game room key, sit in different SFU rooms and must not be told they can hear each other
  const tokA = await mintToken(who('peer_0000'), k.priv, { subtle, nowS: NOW_S });
  const tokOver = await mintToken(who('peer_over1'), k.priv, { subtle, nowS: NOW_S });
  await handle(post('/v1/voice/place', { token: tokA, room: 'cell:1.2', near: ['peer_over1'] }), e, io());
  const overSide = await (await handle(post('/v1/voice/place', { token: tokOver, room: 'cell:1.2', near: ['peer_0000'] }), e, io())).json();
  assert.deepEqual(overSide.allow, [], 'different shards never become mutually audible even if both name each other');
  // the sharder itself agrees: each identity's seat is in the shard its token actually named
  const sh = _peekSharderForTests();
  assert.equal(sh.shardOf('vx_cell_1_2', 'peer_0000'), 0);
  assert.equal(sh.shardOf('vx_cell_1_2', 'peer_over1'), 1);
});

test('voice doors: a lost neighbour is told to the SFU through the admin door - GetParticipant for its tracks, UpdateSubscriptions off - and a dead admin door costs nothing', async () => {
  _resetForTests();
  const k = await keys();
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body); calls.push([new URL(url).pathname, body, init.headers.authorization?.startsWith('Bearer ') ?? false]);
    if (url.endsWith('GetParticipant')) return { ok: true, json: async () => ({ identity: body.identity, tracks: [{ sid: 'TR_' + body.identity }] }) };
    return { ok: true, json: async () => ({}) };
  };
  const e = env(k, { LIVEKIT_ADMIN_URL: 'https://sfu.test/' });
  const tok = await mintToken(who('peer_aaaa'), k.priv, { subtle, nowS: NOW_S }), tokB = await mintToken(who('peer_bbbb'), k.priv, { subtle, nowS: NOW_S });
  const run = (body) => handle(post('/v1/voice/place', body), e, { ...io(), fetch: fetchImpl });
  await run({ token: tok, room: 'cell:1', near: ['peer_bbbb'] }); await run({ token: tokB, room: 'cell:1', near: ['peer_aaaa'] });
  assert.deepEqual(calls, [], 'nothing lost yet: the SFU is not bothered');
  await run({ token: tok, room: 'cell:1', near: [] });
  assert.deepEqual(calls, [
    ['/twirp/livekit.RoomService/GetParticipant', { room: 'vx_cell_1', identity: 'peer_bbbb' }, true],
    ['/twirp/livekit.RoomService/UpdateSubscriptions', { room: 'vx_cell_1', identity: 'peer_aaaa', track_sids: ['TR_peer_bbbb'], subscribe: false }, true],
  ]);
  // the admin door down: the answer still comes, the policy still holds
  const warn = console.warn; console.warn = () => {};
  try {
    const res = await handle(post('/v1/voice/place', { token: tokB, room: 'cell:1', near: [] }), e, { ...io(), fetch: async () => { throw new Error('down'); } });
    assert.equal(res.status, 200); assert.deepEqual((await res.json()).allow, []);
  } finally { console.warn = warn; }
});

test('voice doors: the place door sweeps the per-isolate policy once an idle window has passed, so a long-lived service does not grow forever', async () => {
  _resetForTests();
  const k = await keys(); const e = env(k);
  const clock = { t: NOW_S * 1000 };
  const ioClock = () => ({ now: () => clock.t, subtle, fetch: async () => { throw new Error('no network in this test'); } });
  // a fresh relay token each step - VOICE_ROOM_IDLE_MS (10 min) outlives a relay token's own default life (5 min),
  // and this test is about the service's room GC, not the relay token's, so each step mints its own current token
  const tokAt = (nowS) => mintToken(who('peer_aaaa'), k.priv, { subtle, nowS });
  // a frames 'cell:1' once, then never again - its room entry sits idle from here on
  await handle(post('/v1/voice/place', { token: await tokAt(Math.floor(clock.t / 1000)), room: 'cell:1', near: [] }), e, ioClock());
  assert.equal(_peekPolicyForTests().rooms.has('vx_cell_1'), true, 'the idle room is held, pre-sweep');
  // short of the idle window: a frame elsewhere must NOT yet have swept it away
  clock.t += VOICE_ROOM_IDLE_MS - 1;
  await handle(post('/v1/voice/place', { token: await tokAt(Math.floor(clock.t / 1000)), room: 'cell:2', near: [] }), e, ioClock());
  assert.equal(_peekPolicyForTests().rooms.has('vx_cell_1'), true, 'not idle long enough to sweep yet');
  // past the idle window: the next place frame (to ANY room) pays the sweep's rent and drops the idle one
  clock.t += 2;
  await handle(post('/v1/voice/place', { token: await tokAt(Math.floor(clock.t / 1000)), room: 'cell:2', near: [] }), e, ioClock());
  assert.equal(_peekPolicyForTests().rooms.has('vx_cell_1'), false, 'the idle room was swept, not merely read as stale');
});

// ─── BY SOURCE ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('voice by source: the service is linted with the tree and holds no secret of its own; the Worker exports a fetch alone; the node door is the same handle', () => {
  const lint = JSON.parse(rd('package.json')).scripts.lint;
  assert.ok(lint.includes('server-voice/src/'), 'npm run lint reaches the voice service');
  const idx = rd('server-voice/src/index.js');
  assert.match(idx, /^export default \{ fetch:/m, 'a module Worker exports handlers');
  assert.doesNotMatch(idx, /devsecret|API_SECRET\s*=\s*'/, 'no secret in the tree - the pair is env');
  assert.match(rd('server-voice/src/node.js'), /import \{ handle \} from '\.\/index\.js'/);
  for (const f of ['index.js', 'roomAuthorizer.js', 'proximityPolicy.js', 'livekitToken.js', 'node.js']) assert.ok(rd(`server-voice/src/${f}`).startsWith('// @ts-check'), `${f} opts in`);
  assert.match(rd('server-voice/wrangler.toml'), /name = "daggerfall-voice"/);
  assert.match(rd('deploy/voice/livekit.yaml'), /auto_create: false/, 'a room is made by a credential, never by a name typed at the server');
  assert.match(rd('deploy/voice/compose.yaml'), /livekit\/livekit-server/);
});
