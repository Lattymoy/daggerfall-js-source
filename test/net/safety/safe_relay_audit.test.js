// AUDIT SAFE, THE RELAY'S LANE (2026-10-17, bible/11-Multiplayer/Chat-Safety-Arc.md sections 3, 5, 6 and 7): the
// findings the audit's probes proved against the relay's half of the chat safety arc, each pinned here against a REAL
// Room (test/fakeRoom.mjs) and REAL Ed25519 keys - a ban that only silenced (RELAY-4), the ban and the mute sharing one
// row (RELAY-5), an order older than a socket's token (RELAY-6), a ban a wake forgot (RELAY-7), a socket's pace meter
// (RELAY-8), lines signed before their budget (RELAY-9), the law door's cost and its answer (RELAY-10, RELAY-13a), a
// guest never slowed (RELAY-11), the feed's true bound (RELAY-12), the stamp's and the feed's one-byte tags (RELAY-13c),
// the feed's Worker-to-Worker fetch (S1), a line said by a socket closed while it was signed (S3), and the two laws no
// test held (DOC-17: an older order loses; DOC-8: party and guild lines are never slowed). Each test fails on the code
// the audit read (world214 as it stood before these fixes); the mutants are tools/mutants/safe_audit_relay.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../../../server/src/index.js';
import { fakeRoom, fakeRooms } from '../../fakeRoom.mjs';
import { CHAT_WORLD_ROOM, CHAT_TRADE_ROOM, SOCIAL_ROOM, SAFE_LAW_PATH, NEW_VOICE_GAP_MS, CHAT_ROOM_HZ_MAX, CLOSE_POLICY } from '../../../src/net/wire.js';
import { STAMP_V, stampBytes } from '../../../src/net/safety/chatStamp.js';
import { FEED_V, FEED_BATCH, FEED_SIG_HEADER, openFeed } from '../../../src/net/safety/chatFeed.js';
import { mintBanOrder, mintOrder, mintToken } from '../../../src/net/identityToken.js';
import * as H from '../../../src/net/hubShards.js';

const subtle = globalThis.crypto.subtle;
const rd = (p) => readFileSync(new URL('../../../' + p, import.meta.url), 'utf8');
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const heard = (ws) => ofType(ws, 'chat').map((l) => l.text);
const BANNED = { code: CLOSE_POLICY, reason: 'banned' };

/** Date.now held at `t` for the body of `fn`. */
async function at(t, fn) {
  const real = Date.now;
  Date.now = () => t;
  try { return await fn(); } finally { Date.now = real; }
}
/** A carrier per order: an order frame is on the mute's meter, one a second (MUTE_HZ_MAX). */
async function carriers(r, n, tag = 'carr') {
  const out = [];
  for (let i = 0; i < n; i++) { const c = r.connect(); await r.hello(c, `${tag}-${String(i).padStart(4, '0')}`, null, { kind: 'linked' }); out.push(c); }
  return out;
}
/** A token for `id` minted at `nowS` - the harness's own walk only ever goes back, and a token minted AFTER an order is
 *  what the service mints once the order has moved the account's row. */
async function tokenAt(r, id, nowS, k = 'guest') {
  const kp = await r.signer();
  return mintToken({ s: `acct-${id}`, n: id, k }, kp.privateKey, { subtle, nowS });
}
const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn }; console.info = console.warn = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };

test('AUDIT SAFE RELAY-4 + CLIENT-2: A BAN TAKES THE ACCOUNT OUT OF THE ROOM - every socket of it here is told `banned` and closed CLOSE_POLICY \'banned\' (a stranger untouched), and while the ban stands its hello is answered `banned` and closed the same way; a token minted after the ban is let in, and a ban lifted (`bn` 0) refuses nothing (mutants: the ban never closing; no hello refused; a newer token refused; a lifted ban refusing)', async () => {
  const r = fakeRoom(CHAT_TRADE_ROOM);
  const troll = r.connect(); await r.hello(troll, 'trol-0002');
  const tab2 = r.connect(); await r.hello(tab2, 'trol-0012', null, { tokenSub: 'acct-trol-0002' });   // a second socket of the account
  const bob = r.connect(); await r.hello(bob, 'bobb-0003', null, { kind: 'linked' });
  const [c1, c2] = await carriers(r, 2);
  const kp = await r.signer();
  const nowS = Math.floor(Date.now() / 1000);
  const spare = await r.token('trol-0002');   // a token minted before the ban, kept by a modified client
  const ban = await mintBanOrder({ s: 'acct-trol-0002', bn: nowS + 86400 }, kp.privateKey, { subtle, nowS });
  await r.room.webSocketMessage(c1, JSON.stringify({ t: 'ban', order: ban }));
  for (const ws of [troll, tab2]) {
    assert.deepEqual(ws.sent.at(-1), { t: 'banned', until: nowS + 86400 }, 'its last word is the ban');
    assert.deepEqual(ws.closed, BANNED, 'and the room closes it');
  }
  assert.equal(bob.closed, null, 'a stranger stays');
  const back = r.connect(); await r.hello(back, 'trol-0002', null, { tok: spare });
  assert.deepEqual(back.sent, [{ t: 'banned', until: nowS + 86400 }], 'a hello on a token minted before the ban: told, and nothing else');
  assert.deepEqual(back.closed, BANNED);
  const fresh = r.connect(); await r.hello(fresh, 'trol-0002', null, { tok: await tokenAt(r, 'trol-0002', nowS + 2) });
  assert.equal(fresh.closed, null, 'a token minted after the ban is the service\'s word that the account plays again');
  assert.equal(ofType(fresh, 'welcome').length, 1);
  const lift = await mintBanOrder({ s: 'acct-trol-0002', bn: 0 }, kp.privateKey, { subtle, nowS: nowS + 1 });
  await r.room.webSocketMessage(c2, JSON.stringify({ t: 'ban', order: lift }));
  const again = r.connect(); await r.hello(again, 'trol-0022', null, { tokenSub: 'acct-trol-0002' });
  assert.equal(again.closed, null, 'a ban lifted refuses no hello');
  await r.chat(again, 'back');
  assert.deepEqual(heard(bob), ['back']);
});

test('AUDIT SAFE RELAY-4 + CLIENT-2 at the service\'s door: the hub hands each of the target\'s sockets the order FIRST (`law`), then `banned`, then closes it - the client carries the order before the word that sends it away (the hub said `banned` first, and the client left without it); a mute order is handed the same way and closes nothing (mutants: `banned` before `law`; the door\'s closes never reaped)', async () => {
  const world = fakeRooms();
  const hub = world.room(CHAT_WORLD_ROOM);
  const troll = hub.connect(); await hub.hello(troll, 'trol-0002');
  const bob = hub.connect(); await hub.hello(bob, 'bobb-0003', null, { kind: 'linked' });
  const kp = await hub.signer();
  const env = { ROOMS: world.ROOMS, IDENTITY_PUBLIC_KEY: hub.env.IDENTITY_PUBLIC_KEY };
  const nowS = Math.floor(Date.now() / 1000);
  const post = (order) => worker.fetch(new Request(`https://relay.example${SAFE_LAW_PATH}`, { method: 'POST', body: JSON.stringify({ order }) }), env);
  const mute = await mintOrder({ s: 'acct-trol-0002', mu: nowS + 600 }, kp.privateKey, { subtle, nowS });
  assert.equal((await post(mute)).status, 200);
  assert.deepEqual(troll.sent.slice(-2), [{ t: 'law', order: mute }, { t: 'muted', until: nowS + 600 }]);
  assert.equal(troll.closed, null, 'a mute closes nothing');
  const ban = await mintBanOrder({ s: 'acct-trol-0002', bn: nowS + 86400 }, kp.privateKey, { subtle, nowS: nowS + 1 });
  assert.equal((await post(ban)).status, 200);
  assert.deepEqual(troll.sent.slice(-2), [{ t: 'law', order: ban }, { t: 'banned', until: nowS + 86400 }], 'the order, then the word');
  assert.deepEqual(troll.closed, BANNED);
  assert.deepEqual(ofType(bob, 'leave').map((l) => l.id), ['trol-0002'], 'and the room said its leave - the door reaped what it closed');
});

test('AUDIT SAFE RELAY-4 over the SHARDED hub: a ban the bus takes closes its target\'s ShardSocket, and the shard closes the real socket after `law` and `banned`; the target\'s reconnect on its shard, on a token minted before the ban, is refused by the bus the same way (mutants: the bus\'s hello asking no ban)', () => quiet(async () => {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  const W = fakeRooms({ now: () => clock });
  const settle = async () => {
    for (let i = 0; i < 6; i++) {
      for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubUpFlush();
      for (const [k, r] of [...W.made]) if (H.isChannelBus(k)) await r.room._downFlush();
      for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubPoll();
    }
  };
  const bus = W.room(SOCIAL_ROOM);
  try {
    const shardOf = (n) => H.hubOfSubject(`acct-${n}`);
    const link = async (n, extra = {}) => {
      const R = W.room(shardOf(n));
      const ws = R.connect();
      clock += 30;
      await R.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}`, ...extra });
      await settle();
      return ws;
    };
    const A = await link('p0');
    const B = await link('p1', { kind: 'linked' });
    const spare = await W.room(shardOf('p0')).token('peer-p0', { s: 'acct-p0', n: 'p0' });
    const kp = await bus.signer();
    const nowS = Math.floor(clock / 1000);
    const ban = await mintBanOrder({ s: 'acct-p0', bn: nowS + 86400 }, kp.privateKey, { subtle, nowS });
    const res = await worker.fetch(new Request(`https://relay.example${SAFE_LAW_PATH}`, { method: 'POST', body: JSON.stringify({ order: ban }) }), { ROOMS: W.ROOMS, IDENTITY_PUBLIC_KEY: bus.env.IDENTITY_PUBLIC_KEY });
    assert.equal(res.status, 200);
    await settle();
    assert.deepEqual(A.sent.slice(-2), [{ t: 'law', order: ban }, { t: 'banned', until: nowS + 86400 }]);
    assert.deepEqual(A.closed, BANNED, 'the shard closed the real socket');
    assert.equal(B.closed, null);
    const R = W.room(shardOf('p0'));
    const again = R.connect();
    clock += 30;
    await R.hello(again, 'peer-p0', null, { name: 'p0', acct: 'acct-p0', asecret: 'secret-of-acct-p0', tok: spare });
    await settle();
    assert.deepEqual(again.sent.at(-1), { t: 'banned', until: nowS + 86400 }, 'the bus refused the hello its shard handed up');
    assert.deepEqual(again.closed, BANNED);
  } finally {
    Date.now = realNow;
    for (const [, r] of W.made) { clearTimeout(r.room._upT); clearTimeout(r.room._downT); clearTimeout(r.room._hubCountT); clearTimeout(r.room._owedSoon); clearTimeout(r.room._owedLate); clearTimeout(r.room._feedQ?.timer); }
  }
}));

test('AUDIT SAFE RELAY-5: THE BAN IS ITS OWN ORDER - a NEWER unmute never lifts a ban (the hello is still refused), and an unban never lifts a mute that stands (the hello is let in, its line still refused `muted`); MOD1\'s one row held both, so each undid the other (mutants: the ban held in the mutes\' row)', () => at(Date.now(), async () => {
  // the clock held for the whole pin: the hello's token is minted at the clock's second less one, and a wall clock
  // that crossed a second after `nowS` minted it AT the mute's second - no older than the mute, so it rightly wore
  // none, and the pin failed on the second it ran in (deploy 1498, verify / tests 1/4)
  const r = fakeRoom(CHAT_WORLD_ROOM);
  const bob = r.connect(); await r.hello(bob, 'bobb-0003', null, { kind: 'linked' });
  const kp = await r.signer();
  const nowS = Math.floor(Date.now() / 1000);
  const [c1, c2, c3, c4, c5] = await carriers(r, 5);
  // a ban, then a newer unmute: the ban stands
  const t1 = await r.token('trol-0001');
  await r.room.webSocketMessage(c1, JSON.stringify({ t: 'ban', order: await mintBanOrder({ s: 'acct-trol-0001', bn: nowS + 86400 }, kp.privateKey, { subtle, nowS }) }));
  await r.room.webSocketMessage(c2, JSON.stringify({ t: 'mute', order: await mintOrder({ s: 'acct-trol-0001', mu: 0 }, kp.privateKey, { subtle, nowS: nowS + 1 }) }));
  const t1ws = r.connect(); await r.hello(t1ws, 'trol-0001', null, { tok: t1 });
  assert.deepEqual(t1ws.closed, BANNED, 'a newer unmute is no unban');
  // a mute, a ban, an unban: the mute stands
  await r.room.webSocketMessage(c3, JSON.stringify({ t: 'mute', order: await mintOrder({ s: 'acct-trol-0002', mu: nowS + 3600 }, kp.privateKey, { subtle, nowS }) }));
  await r.room.webSocketMessage(c4, JSON.stringify({ t: 'ban', order: await mintBanOrder({ s: 'acct-trol-0002', bn: nowS + 86400 }, kp.privateKey, { subtle, nowS: nowS + 1 }) }));
  await r.room.webSocketMessage(c5, JSON.stringify({ t: 'ban', order: await mintBanOrder({ s: 'acct-trol-0002', bn: 0 }, kp.privateKey, { subtle, nowS: nowS + 2 }) }));
  const t2 = r.connect(); await r.hello(t2, 'trol-0002');   // a token from before the mute: it carries none
  assert.equal(t2.closed, null, 'the unban lets it in');
  await r.chat(t2, 'unbanned and unmuted?');
  assert.deepEqual(ofType(t2, 'muted').at(-1), { t: 'muted', until: nowS + 3600 }, 'the mute it stood under stands');
  assert.deepEqual(heard(bob), []);
}));

test('AUDIT SAFE RELAY-6: AN ORDER OLDER THAN A SOCKET\'S TOKEN LEAVES IT ALONE - an unmute minted before the token that carries a fresh mute, pushed to the hub\'s door or carried in by a client, lifts nothing; a socket whose token is older than the order takes it, as ever (mutants: the token\'s age unread at the door; and in MOD1\'s arm)', async () => {
  const world = fakeRooms();
  const hub = world.room(CHAT_WORLD_ROOM);
  const kp = await hub.signer();
  const nowS = Math.floor(Date.now() / 1000);
  const unmuteOld = await mintOrder({ s: 'acct-trol-0002', mu: 0 }, kp.privateKey, { subtle, nowS: nowS - 40 });   // handed to the target before its reconnect
  const troll = hub.connect(); await hub.hello(troll, 'trol-0002', null, { mu: nowS + 3600, kind: 'linked' });   // its token since: muted
  const bob = hub.connect(); await hub.hello(bob, 'bobb-0003', null, { kind: 'linked' });
  const res = await worker.fetch(new Request(`https://relay.example${SAFE_LAW_PATH}`, { method: 'POST', body: JSON.stringify({ order: unmuteOld }) }), { ROOMS: world.ROOMS, IDENTITY_PUBLIC_KEY: hub.env.IDENTITY_PUBLIC_KEY });
  assert.equal(res.status, 200, 'the hub believes it - it is signed, and in its minute');
  await hub.chat(troll, 'unmuted by an older order?');
  assert.deepEqual(heard(bob), [], 'the door\'s older unmute lifted nothing');
  const [c1] = await carriers(hub, 1);
  const unmuteOlder = await mintOrder({ s: 'acct-trol-0002', mu: 0 }, kp.privateKey, { subtle, nowS: nowS - 30 });
  await hub.room.webSocketMessage(c1, JSON.stringify({ t: 'mute', order: unmuteOlder }));
  await hub.chat(troll, 'and carried in?');
  assert.deepEqual(heard(bob), [], 'nor the one a client carried in (MOD1\'s arm)');
  const [c2] = await carriers(hub, 1, 'cbrr');
  const unmuteNew = await mintOrder({ s: 'acct-trol-0002', mu: 0 }, kp.privateKey, { subtle, nowS: nowS + 1 });
  await hub.room.webSocketMessage(c2, JSON.stringify({ t: 'mute', order: unmuteNew }));
  await at(Date.now() + 1500, () => hub.chat(troll, 'free'));   // past its own chat gate (CHAT_HZ_MAX), which the refused lines spent
  assert.deepEqual(heard(bob), ['free'], 'an order newer than the token is the account\'s word');
});

test('AUDIT SAFE RELAY-7: A HELD BAN SURVIVES A WAKE - kept in the room\'s storage for as long as a token minted before it can still be good, and read back once a wake, so a pre-ban token is refused after the room slept (mutants: the bans never written; never read back)', async () => {
  const r = fakeRoom(CHAT_TRADE_ROOM);
  const kp = await r.signer();
  const nowS = Math.floor(Date.now() / 1000);
  const spare = await r.token('trol-0002');
  const [car] = await carriers(r, 1);
  await r.room.webSocketMessage(car, JSON.stringify({ t: 'ban', order: await mintBanOrder({ s: 'acct-trol-0002', bn: nowS + 86400 }, kp.privateKey, { subtle, nowS }) }));
  assert.deepEqual(r.store.get('bans')?.['acct-trol-0002']?.slice(0, 2), [nowS, nowS + 86400], 'written');
  r.wake();
  const back = r.connect(); await r.hello(back, 'trol-0002', null, { tok: spare });
  assert.deepEqual(back.sent, [{ t: 'banned', until: nowS + 86400 }]);
  assert.deepEqual(back.closed, BANNED, 'the woken room still holds it');
});

test('AUDIT SAFE RELAY-8: A NEW VOICE\'S METER IS THE ACCOUNT\'S - five sockets of one sprout account in a channel say one line a gap between them, and a reconnect does not start a fresh meter (mutants: the meter by socket)', async () => {
  const r = fakeRoom(CHAT_TRADE_ROOM);
  const t0 = 1_900_000_000_000;
  const hearer = r.connect(); await r.hello(hearer, 'hear-0001', null, { kind: 'linked' });
  const socks = [];
  for (let i = 0; i < 5; i++) { const ws = r.connect(); await r.hello(ws, `sprt-000${i}`, null, { glyphs: ['sprout'], kind: 'linked', tokenSub: 'acct-sprout' }); socks.push(ws); }
  for (let i = 0; i < 5; i++) await at(t0 + i * 100, () => r.chat(socks[i], `spam ${i}`));
  assert.deepEqual(heard(hearer), ['spam 0'], 'one line a gap, whichever socket says it');
  assert.deepEqual(ofType(socks[4], 'slowed'), [{ t: 'slowed', ms: NEW_VOICE_GAP_MS - 400 }]);
  await r.drop(socks[0]);
  const again = r.connect(); await r.hello(again, 'sprt-0000', null, { glyphs: ['sprout'], kind: 'linked', tokenSub: 'acct-sprout' });
  await at(t0 + 600, () => r.chat(again, 'reconnected'));
  assert.deepEqual(heard(hearer), ['spam 0'], 'a reconnect is no fresh meter');
  await at(t0 + NEW_VOICE_GAP_MS, () => r.chat(again, 'in its time'));
  assert.deepEqual(heard(hearer), ['spam 0', 'in its time']);
  assert.ok(r.room._paces.size <= 1, 'the meters are the room\'s, by account - and pruned');
});

test('AUDIT SAFE RELAY-9 + RELAY-13b: A LINE IS SIGNED ONCE IT WILL BE FANNED - a channel over its budget signs exactly the lines it says, and a new voice\'s line the room\'s budget dropped never spends its meter (mutants: the stamp before the budget; the meter spent before the budget)', async () => {
  const r = fakeRoom(CHAT_TRADE_ROOM);
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  r.env.GATE_SIGNING_KEY = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  const hearer = r.connect(); await r.hello(hearer, 'hear-0001', null, { kind: 'linked' });
  const talkers = [];
  for (let i = 0; i < CHAT_ROOM_HZ_MAX + 10; i++) { const ws = r.connect(); await r.hello(ws, `talk-${String(i).padStart(4, '0')}`, null, { kind: 'linked' }); talkers.push(ws); }
  const sprout = r.connect(); await r.hello(sprout, 'sprt-0001', null, { glyphs: ['sprout'], kind: 'linked' });
  const realSign = subtle.sign;
  let signs = 0;
  subtle.sign = function (...args) { signs++; return realSign.apply(this, args); };
  const t0 = 1_900_000_000_000;
  try {
    await at(t0, async () => { for (const ws of talkers) await r.chat(ws, 'a'); await r.chat(sprout, 'dropped by the room'); });
  } finally { subtle.sign = realSign; }
  assert.equal(heard(hearer).length, CHAT_ROOM_HZ_MAX, 'the room said its budget');
  assert.equal(signs, CHAT_ROOM_HZ_MAX, 'and signed those lines and no other');
  await at(t0 + 1000, () => r.chat(sprout, 'my first heard line'));
  assert.equal(ofType(sprout, 'slowed').length, 0, 'the dropped line never spent the sprout\'s gap');
  assert.equal(heard(hearer).at(-1), 'my first heard line');
});

test('AUDIT SAFE RELAY-10 + RELAY-13a: THE LAW DOOR - a body past LAW_BODY_MAX is refused unread (413) and wakes nothing; an order costs the Worker ONE verify (its kind read off its claims first) and the hub one more; an order the hub took is not handed it again; and the answer is the hub\'s own `ok` - 409 where it took nothing (mutants: the body unbounded; both kinds verified; replays each waking the hub; the status read for the hub\'s word)', async () => {
  const world = fakeRooms();
  const hub = world.room(CHAT_WORLD_ROOM);
  const troll = hub.connect(); await hub.hello(troll, 'trol-0002');
  const kp = await hub.signer();
  let hubCalls = 0;
  const ROOMS = { idFromName: world.ROOMS.idFromName, get: (id) => ({ fetch: (req) => { hubCalls++; return world.ROOMS.get(id).fetch(req); } }) };
  const env = { ROOMS, IDENTITY_PUBLIC_KEY: hub.env.IDENTITY_PUBLIC_KEY };
  const nowS = Math.floor(Date.now() / 1000);
  const post = (body, e = env) => worker.fetch(new Request(`https://relay.example${SAFE_LAW_PATH}`, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }), e);
  const mute = await mintOrder({ s: 'acct-trol-0002', mu: nowS + 600 }, kp.privateKey, { subtle, nowS });
  const big = await post(JSON.stringify({ order: mute, pad: 'x'.repeat(4096) }));
  assert.equal(big.status, 413);
  assert.equal(hubCalls, 0, 'a body past the bound wakes nothing');
  assert.equal(ofType(troll, 'muted').length, 0);
  const realVerify = subtle.verify;
  let verifies = 0;
  subtle.verify = function (...args) { verifies++; return realVerify.apply(this, args); };
  try {
    const stranger = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const forged = await mintOrder({ s: 'acct-trol-0002', mu: nowS + 600 }, stranger.privateKey, { subtle, nowS });
    assert.equal((await post({ order: forged })).status, 403);
    assert.equal(verifies, 1, 'a forgery costs one verify');
    verifies = 0;
    assert.equal((await post({ order: mute })).status, 200);
    assert.equal(verifies, 2, 'a mute: the Worker\'s one verify and the hub\'s one');
  } finally { subtle.verify = realVerify; }
  assert.equal(hubCalls, 1);
  for (let i = 0; i < 5; i++) assert.equal((await post({ order: mute })).status, 200);
  assert.equal(hubCalls, 1, 'a replay of an order the hub took wakes nothing');
  assert.deepEqual(ofType(troll, 'muted'), [{ t: 'muted', until: nowS + 600 }]);
  // the hub's own word: a Worker whose key the hub does not share verifies an order the hub then refuses
  const other = fakeRooms().room('chat:trade');
  const okp = await other.signer();
  const foreign = await mintOrder({ s: 'acct-trol-0002', mu: nowS + 900 }, okp.privateKey, { subtle, nowS });
  const no = await post({ order: foreign }, { ROOMS, IDENTITY_PUBLIC_KEY: other.env.IDENTITY_PUBLIC_KEY });
  assert.equal(no.status, 409, 'the hub said it took nothing, and the Worker says so');
  assert.deepEqual(await no.json(), { ok: false, error: 'not taken' });
});

test('AUDIT SAFE RELAY-11: A GUEST IS A NEW VOICE - a guest\'s socket (its token\'s `k`) is paced in a public channel though it wears no sprout, and a registered account without the sprout is not (mutants: the guest unmarked; the mark unread)', async () => {
  const r = fakeRoom(CHAT_WORLD_ROOM);
  const guest = r.connect(); await r.hello(guest, 'gues-0001', null, { kind: 'guest' });
  const vet = r.connect(); await r.hello(vet, 'vetn-0002', null, { kind: 'linked' });
  const t0 = 1_900_000_000_000;
  await at(t0, () => r.chat(guest, 'one'));
  await at(t0 + 1000, () => r.chat(guest, 'two'));
  assert.deepEqual(heard(vet), ['one']);
  assert.deepEqual(ofType(guest, 'slowed'), [{ t: 'slowed', ms: NEW_VOICE_GAP_MS - 1000 }]);
  await at(t0 + 2000, () => r.chat(vet, 'a'));
  await at(t0 + 2100, () => r.chat(vet, 'b'));
  assert.deepEqual(heard(guest).slice(-2), ['a', 'b'], 'a registered account is never slowed');
  assert.equal(guest.att.gu, 1);
  assert.equal(vet.att.gu, undefined);
});

test('AUDIT SAFE RELAY-12: A ROOM\'S FEED BATCH IS FEED_BATCH LINES - it posts the moment the FEED_BATCH-th line joins, and the next line starts the next batch; no batch the relay sends holds more (mutant: the post one line late)', async () => {
  const r = fakeRoom(CHAT_WORLD_ROOM);
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  r.env.GATE_SIGNING_KEY = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  r.env.MOD_FEED_URL = 'https://accounts.example/v1/mod/feed';
  const posts = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { posts.push({ url, init }); return new Response('{}', { status: 202 }); };
  try {
    const socks = [];
    for (let i = 0; i < 10; i++) { const ws = r.connect(); await r.hello(ws, `feed-${String(i).padStart(4, '0')}`, null, { kind: 'linked' }); socks.push(ws); }
    const t0 = 1_900_000_000_000;
    for (let k = 0; k < FEED_BATCH + 3; k++) await at(t0 + k * 100, () => r.chat(socks[k % socks.length], `line ${k}`));
    await new Promise((res) => setTimeout(res, 50));
    assert.equal(posts.length, 1, 'one batch went');
    const opened = await openFeed(posts[0].init.body, posts[0].init.headers[FEED_SIG_HEADER], kp.publicKey, { subtle, nowMs: t0 + 5000 });
    assert.equal(opened.ok, true);
    assert.equal(opened.batch.lines.length, FEED_BATCH);
    assert.deepEqual(r.room._feedQ.lines.map((l) => l.text), [`line ${FEED_BATCH}`, `line ${FEED_BATCH + 1}`, `line ${FEED_BATCH + 2}`]);
  } finally { clearTimeout(r.room._feedQ?.timer); globalThis.fetch = realFetch; }
  assert.equal(rd('server/src/index.js').includes('q.lines.shift()'), false, 'the drop that could never run is gone');
});

test('AUDIT SAFE RELAY-13c: THE STAMP\'S AND THE FEED\'S TAGS ARE WORDS OF THEIR OWN - `c1` was the card receipt\'s tag and `f1` the wild receipt\'s, their signed bytes kept apart by one byte; no signed tag in src/net equals either or begins as they do (mutants: the stamp\'s tag back to a receipt\'s; the feed\'s)', () => {
  assert.equal(STAMP_V, 'chat-stamp1');
  assert.equal(FEED_V, 'chat-feed1');
  assert.ok(new TextDecoder().decode(stampBytes({ tab: 'world', sub: 'acct-x', name: 'X', at: 1, text: 'hi' })).startsWith('chat-stamp1\n'));
  const tags = [];
  const files = ['src/net/card/cardReceipt.js', 'src/net/wild/wildReceipt.js', 'src/net/gate/gateReceipt.js', 'src/net/identityToken.js', 'src/net/raid/raidReceipt.js', 'src/net/duel/duelReceipt.js',
    'src/net/arena/arenaReceipt.js', 'src/net/siege/siegeReceipt.js', 'src/net/iliac/iliacReceipt.js', 'src/net/gambit/gambitReceipt.js', 'src/net/serpent/serpentReceipt.js', 'src/net/superDungeon/sdReceipt.js',
    'src/net/eliteGates/egReceipt.js', 'src/net/eliteGates/egCallSig.js', 'src/net/watchReceipt.js', 'src/net/productRecord.js', 'src/net/safety/chatStamp.js', 'src/net/safety/chatFeed.js'];
  for (const f of files) for (const m of rd(f).matchAll(/export const [A-Z_]+_V = '([^']+)'/g)) tags.push(m[1]);
  assert.ok(tags.includes('c1') && tags.includes('f1'), 'the receipts\' tags were read');
  assert.equal(tags.filter((t) => t === STAMP_V).length, 1, 'the stamp\'s tag is its own');
  assert.equal(tags.filter((t) => t === FEED_V).length, 1, 'the feed\'s tag is its own');
  assert.deepEqual(tags.filter((t) => t !== STAMP_V && t !== FEED_V && (t.startsWith('chat-') || STAMP_V.startsWith(t) || FEED_V.startsWith(t))), [], 'and none begins as either');
});

test('AUDIT SAFE RELAY S1: THE FEED POSTS THROUGH THE ACCOUNTS SERVICE BINDING where the Worker has one - a Worker fetching another\'s workers.dev address on one account may be refused (1042) - and the relay\'s wrangler.toml binds the account Worker by its own name (mutants: the binding unread; the binding dropped from the config)', async () => {
  const r = fakeRoom(CHAT_WORLD_ROOM);
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  r.env.GATE_SIGNING_KEY = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  r.env.MOD_FEED_URL = 'https://daggerfall-accounts.example.workers.dev/v1/mod/feed';
  const bound = [];
  r.env.ACCOUNTS = { fetch: async (req) => { bound.push(req); return new Response('{}', { status: 202 }); } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('error code: 1042'); };
  try {
    const a = r.connect(); await r.hello(a, 'aaaa-0001', null, { kind: 'linked' });
    await r.chat(a, 'one');
    assert.equal(await r.room._feedFlush(), true);
  } finally { globalThis.fetch = realFetch; }
  assert.equal(bound.length, 1);
  assert.equal(bound[0].url, 'https://daggerfall-accounts.example.workers.dev/v1/mod/feed');
  assert.equal(bound[0].method, 'POST');
  const opened = await openFeed(new Uint8Array(await bound[0].arrayBuffer()), bound[0].headers.get(FEED_SIG_HEADER), kp.publicKey, { subtle, nowMs: Date.now() });
  assert.deepEqual(opened.batch.lines.map((l) => l.text), ['one']);
  const toml = rd('server/wrangler.toml');
  const name = /^name = "([^"]+)"$/m.exec(rd('server-account/wrangler.toml'))?.[1];
  assert.equal(name, 'daggerfall-accounts');
  assert.match(toml, new RegExp(`^\\[\\[services\\]\\]\\nbinding = "ACCOUNTS"\\nservice = "${name}"$`, 'm'));
});

test('AUDIT SAFE RELAY S3: A LINE WHOSE SPEAKER IS CLOSED WHILE IT IS SIGNED IS SAID TO NOBODY - the sign is the one await between a line\'s budget and its fan, and a ban taken in it closed the speaker (mutant: the speaker unread after the sign)', async () => {
  const r = fakeRoom(CHAT_TRADE_ROOM);
  const troll = r.connect(); await r.hello(troll, 'trol-0002', null, { kind: 'linked' });
  const bob = r.connect(); await r.hello(bob, 'bobb-0003', null, { kind: 'linked' });
  const [car] = await carriers(r, 1);
  const kp = await r.signer();
  const nowS = Math.floor(Date.now() / 1000);
  let release;
  const gate = new Promise((res) => { release = res; });
  r.room._receiptKeyOf = async () => { await gate; return null; };   // the line waits in its sign
  const said = r.chat(troll, 'said while banned');
  await r.room.webSocketMessage(car, JSON.stringify({ t: 'ban', order: await mintBanOrder({ s: 'acct-trol-0002', bn: nowS + 86400 }, kp.privateKey, { subtle, nowS }) }));
  assert.deepEqual(troll.closed, BANNED);
  release();
  await said;
  assert.deepEqual(heard(bob), [], 'the banned speaker\'s line in flight went nowhere');
});

test('AUDIT SAFE DOC-17: AN OLDER ORDER LOSES AT A ROOM, inside its minute - a ban older than the unban the room took bans nothing, and a mute older than the unmute pushed to the hub\'s door mutes nothing (mutants: the newest-wins test dropped)', async () => {
  const r = fakeRoom(CHAT_TRADE_ROOM);
  const kp = await r.signer();
  const nowS = Math.floor(Date.now() / 1000);
  const [c1, c2] = await carriers(r, 2);
  const oldBan = await mintBanOrder({ s: 'acct-trol-0002', bn: nowS + 86400 }, kp.privateKey, { subtle, nowS: nowS - 10 });
  await r.room.webSocketMessage(c1, JSON.stringify({ t: 'ban', order: await mintBanOrder({ s: 'acct-trol-0002', bn: 0 }, kp.privateKey, { subtle, nowS }) }));
  await r.room.webSocketMessage(c2, JSON.stringify({ t: 'ban', order: oldBan }));
  const troll = r.connect(); await r.hello(troll, 'trol-0002', null, { tok: await tokenAt(r, 'trol-0002', nowS - 20) });
  assert.equal(troll.closed, null, 'the older ban, replayed inside its minute, bans nothing');
  const world = fakeRooms();
  const hub = world.room(CHAT_WORLD_ROOM);
  const hk = await hub.signer();
  const t = hub.connect(); await hub.hello(t, 'trol-0004');
  const bob = hub.connect(); await hub.hello(bob, 'bobb-0005', null, { kind: 'linked' });
  const post = async (order) => (await worker.fetch(new Request(`https://relay.example${SAFE_LAW_PATH}`, { method: 'POST', body: JSON.stringify({ order }) }), { ROOMS: world.ROOMS, IDENTITY_PUBLIC_KEY: hub.env.IDENTITY_PUBLIC_KEY })).status;
  assert.equal(await post(await mintOrder({ s: 'acct-trol-0004', mu: 0 }, hk.privateKey, { subtle, nowS })), 200);
  assert.equal(await post(await mintOrder({ s: 'acct-trol-0004', mu: nowS + 600 }, hk.privateKey, { subtle, nowS: nowS - 5 })), 200, 'believed - and older');
  await hub.chat(t, 'still free');
  assert.deepEqual(heard(bob), ['still free']);
});

test('AUDIT SAFE DOC-8: PARTY AND GUILD LINES ARE NEVER SLOWED - a sprout says two guild lines and two party lines a second apart on the hub, and every one is heard (mutants: a new voice\'s pace asked before the party and guild arms)', async () => {
  const r = fakeRoom(SOCIAL_ROOM);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  try {
    const join = async (n, extra = {}) => { const ws = r.connect(); await r.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}`, ...extra }); clock += 10; return ws; };
    const a = await join('a', { glyphs: ['sprout'], gi: 'gaaaaaaaaaa', gt: 'HND', gm: 'm1' });
    const b = await join('b', { kind: 'linked', gi: 'gaaaaaaaaaa', gt: 'HND', gm: 'm2' });
    const say = (ws, text, ch) => r.raw(ws, JSON.stringify({ t: 'chat', text, ch }));
    await say(a, 'guild one', 'guild'); clock += 1000;
    await say(a, 'guild two', 'guild'); clock += 1000;
    await r.raw(a, JSON.stringify({ t: 'social', k: 'party.invite', peer: 'peer-b' })); clock += 600;
    const pid = b.sent.filter((m) => m.t === 'social' && m.k === 'invite').at(-1).party;
    await r.raw(b, JSON.stringify({ t: 'social', k: 'party.accept', party: pid })); clock += 600;
    await say(a, 'party one', 'party'); clock += 1000;
    await say(a, 'party two', 'party');
    assert.deepEqual(ofType(b, 'chat').map((l) => [l.ch, l.text]), [['guild', 'guild one'], ['guild', 'guild two'], ['party', 'party one'], ['party', 'party two']]);
    assert.equal(ofType(a, 'slowed').length, 0);
  } finally { Date.now = realNow; }
});
