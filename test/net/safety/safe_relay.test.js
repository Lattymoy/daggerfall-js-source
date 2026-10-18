// SAFE2, SAFE4, SAFE5, SAFE6 (2026-10-17, bible/11-Multiplayer/Chat-Safety-Arc.md): THE RELAY'S HALF, driven through a
// REAL Room over a REAL Ed25519 key - the stamp on every line it relays, a new voice's pace in a public channel, the
// reviewer's feed, and a ban order taken at both doors it comes in by: a carrier's frame, and the account service's push
// through the Worker (which checks the signature before the hub is woken).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../../server/src/index.js';
import { fakeRoom, fakeRooms } from '../../fakeRoom.mjs';
import { CHAT_WORLD_ROOM, NEW_VOICE_GAP_MS, SAFE_LAW_PATH, CLOSE_POLICY } from '../../../src/net/wire.js';
import { verifyStamp } from '../../../src/net/safety/chatStamp.js';
import { openFeed, FEED_SIG_HEADER } from '../../../src/net/safety/chatFeed.js';
import { mintBanOrder, mintOrder } from '../../../src/net/identityToken.js';

const subtle = globalThis.crypto.subtle;
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);

/** The relay's receipt pair, its private half in the room's env as the deploy puts it (PKCS8, base64). */
async function signingRoom(key, opts) {
  const r = fakeRoom(key, opts);
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  r.env.GATE_SIGNING_KEY = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  return { r, kp };
}

/** Date.now held at `t` for the body of `fn`. */
async function at(t, fn) {
  const real = Date.now;
  Date.now = () => t;
  try { return await fn(); } finally { Date.now = real; }
}

test('SAFE2 EVERY LINE THE RELAY RELAYS IS STAMPED: the line a hearer receives carries `sg`, the relay\'s signature over the tab it is heard on, the speaker\'s verified account, the name, the time and the words - and it verifies with the public half; the same line with a word changed does not (mutants: the stamp left off; the stamp over the wrong tab)', async () => {
  const { r, kp } = await signingRoom(CHAT_WORLD_ROOM);
  const troll = r.connect(); await r.hello(troll, 'trol-0001');
  const bob = r.connect(); await r.hello(bob, 'bobb-0002');
  await r.chat(troll, 'attention seekers, all of them');
  const [line] = ofType(bob, 'chat');
  assert.equal(line.sub, 'acct-trol-0001');
  assert.equal(typeof line.sg, 'string');
  const heard = { tab: 'world', sub: line.sub, name: line.name, at: line.at, text: line.text };
  assert.equal(await verifyStamp(heard, line.sg, kp.publicKey, { subtle }), true);
  assert.equal(await verifyStamp({ ...heard, text: 'attention please' }, line.sg, kp.publicKey, { subtle }), false);
  assert.equal(await verifyStamp({ ...heard, tab: 'trade' }, line.sg, kp.publicKey, { subtle }), false);
  assert.equal(ofType(troll, 'chat')[0].sg, line.sg, 'the speaker\'s own echo carries the same stamp');
});

test('SAFE2 A RELAY WITH NO KEY RELAYS ITS LINES UNSTAMPED, as before - nothing else changes (mutant: a line dropped for want of a key)', async () => {
  const r = fakeRoom(CHAT_WORLD_ROOM);
  const a = r.connect(); await r.hello(a, 'aaaa-0001');
  const b = r.connect(); await r.hello(b, 'bbbb-0002');
  await r.chat(a, 'hello');
  const [line] = ofType(b, 'chat');
  assert.equal(line.text, 'hello');
  assert.equal('sg' in line, false);
});

test('SAFE6 A NEW VOICE\'S PACE: a socket whose token wears the sprout says one public line every NEW_VOICE_GAP_MS - a line too soon is refused to it alone with how long to wait, never fanned and never struck; an older account is not slowed (mutants: the sprout unchecked; the gap measured from the refused line)', async () => {
  const r = fakeRoom(CHAT_WORLD_ROOM);
  const sprout = r.connect(); await r.hello(sprout, 'sprt-0001', null, { glyphs: ['sprout'] });
  const vet = r.connect(); await r.hello(vet, 'vetn-0002', null, { glyphs: ['laurel'], kind: 'linked' });   // a glyph, and not the sprout - and a registered account (AUDIT SAFE RELAY-11: a guest is a new voice too)
  const t0 = 1_900_000_000_000;
  await at(t0, () => r.chat(sprout, 'one'));
  await at(t0 + 1000, () => r.chat(sprout, 'two'));
  assert.deepEqual(ofType(vet, 'chat').map((l) => l.text), ['one']);
  assert.deepEqual(ofType(sprout, 'slowed'), [{ t: 'slowed', ms: NEW_VOICE_GAP_MS - 1000 }]);
  await at(t0 + 2000, () => r.chat(sprout, 'three'));
  assert.equal(ofType(sprout, 'slowed').at(-1).ms, NEW_VOICE_GAP_MS - 2000, 'the gap is from the line said, not the line refused');
  await at(t0 + NEW_VOICE_GAP_MS, () => r.chat(sprout, 'four'));
  assert.deepEqual(ofType(vet, 'chat').map((l) => l.text), ['one', 'four']);
  await at(t0 + 5000, () => r.chat(vet, 'a'));
  await at(t0 + 5100, () => r.chat(vet, 'b'));
  assert.deepEqual(ofType(sprout, 'chat').map((l) => l.text).slice(-2), ['a', 'b'], 'an older account is never slowed');
  assert.equal(ofType(vet, 'slowed').length, 0);
});

test('SAFE6 A PLACE\'S TALK IS NEVER SLOWED - a new voice\'s pace is the public channels\' alone (mutant: the channel test dropped)', async () => {
  const r = fakeRoom('cell:0:0');
  const sprout = r.connect(); await r.hello(sprout, 'sprt-0001', { x: 0, y: 0, z: 0, yaw: 0 }, { glyphs: ['sprout'] });
  const near = r.connect(); await r.hello(near, 'near-0002', { x: 1, y: 0, z: 1, yaw: 0 });
  const t0 = 1_900_000_000_000;
  await at(t0, () => r.chat(sprout, 'one'));
  await at(t0 + 600, () => r.chat(sprout, 'two'));
  assert.deepEqual(ofType(near, 'chat').map((l) => l.text), ['one', 'two']);
  assert.equal(ofType(sprout, 'slowed').length, 0);
});

test('SAFE5 THE REVIEWER\'S FEED: with MOD_FEED_URL set, a public channel\'s lines are posted as one signed batch the service opens with the relay\'s public half - the speaker, the tab, the words; with it unset nothing is kept or sent (mutants: the feed posting unsigned; a line fed with no URL)', async () => {
  const { r, kp } = await signingRoom(CHAT_WORLD_ROOM);
  const posts = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { posts.push({ url, init }); return new Response('{}', { status: 202 }); };
  try {
    const a = r.connect(); await r.hello(a, 'aaaa-0001', null, { kind: 'linked' });   // registered: two lines in a breath, unpaced (AUDIT SAFE RELAY-11)
    const b = r.connect(); await r.hello(b, 'bbbb-0002', null, { kind: 'linked' });
    await r.chat(b, 'before the url');
    assert.equal(r.room._feedQ, undefined, 'no url, nothing kept');
    r.env.MOD_FEED_URL = 'https://accounts.example/v1/mod/feed';
    await r.chat(a, 'one');
    await r.chat(a, 'two');
    assert.equal(await r.room._feedFlush(), true);
    assert.equal(posts.length, 1);
    assert.equal(posts[0].url, 'https://accounts.example/v1/mod/feed');
    const opened = await openFeed(posts[0].init.body, posts[0].init.headers[FEED_SIG_HEADER], kp.publicKey, { subtle, nowMs: Date.now() });
    assert.equal(opened.ok, true);
    assert.deepEqual(opened.batch.lines.map((l) => [l.tab, l.sub, l.text]), [['world', 'acct-aaaa-0001', 'one'], ['world', 'acct-aaaa-0001', 'two']]);
    assert.equal(await r.room._feedFlush(), false, 'an empty batch posts nothing');
  } finally { globalThis.fetch = realFetch; }
});

test('SAFE4 A BAN ORDER CARRIED IN: every socket of the account in the room is told `banned` and closed (AUDIT SAFE RELAY-4: it was only silenced); a ban lifted (0) lets the account back in; a mute order handed to the ban door, or a forged one, is ignored (mutants: the ban never closing; the ban door taking a mute)', async () => {
  const r = fakeRoom(CHAT_WORLD_ROOM);
  const mod = r.connect(); await r.hello(mod, 'modd-0001');
  const troll = r.connect(); await r.hello(troll, 'trol-0002');
  const bob = r.connect(); await r.hello(bob, 'bobb-0003', null, { kind: 'linked' });
  const [c1, c2, c3] = [r.connect(), r.connect(), r.connect()];   // a carrier each: an order frame is on the mute's meter, one a second
  await r.hello(c1, 'carr-0004'); await r.hello(c2, 'carr-0005'); await r.hello(c3, 'carr-0006');
  const kp = await r.signer();
  const nowS = Math.floor(Date.now() / 1000);
  const mute = await mintOrder({ s: 'acct-trol-0002', mu: nowS + 600 }, kp.privateKey, { subtle, nowS });
  await r.room.webSocketMessage(mod, JSON.stringify({ t: 'ban', order: mute }));
  assert.equal(ofType(troll, 'banned').length + ofType(troll, 'muted').length, 0, 'a mute is never a ban');
  const forged = (await mintBanOrder({ s: 'acct-trol-0002', bn: nowS + 86400 }, (await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])).privateKey, { subtle, nowS }));
  await r.room.webSocketMessage(c1, JSON.stringify({ t: 'ban', order: forged }));
  assert.equal(ofType(troll, 'banned').length, 0, 'a forged ban is ignored');
  const ban = await mintBanOrder({ s: 'acct-trol-0002', bn: nowS + 86400 }, kp.privateKey, { subtle, nowS });
  await r.room.webSocketMessage(c2, JSON.stringify({ t: 'ban', order: ban }));
  assert.deepEqual(ofType(troll, 'banned'), [{ t: 'banned', until: nowS + 86400 }]);
  assert.deepEqual(troll.closed, { code: CLOSE_POLICY, reason: 'banned' }, 'and closed - a banned socket says nothing, poses nowhere, hears nothing');
  const lift = await mintBanOrder({ s: 'acct-trol-0002', bn: 0 }, kp.privateKey, { subtle, nowS: nowS + 1 });
  await r.room.webSocketMessage(c3, JSON.stringify({ t: 'ban', order: lift }));
  const back = r.connect(); await r.hello(back, 'trol-0002');
  assert.equal(back.closed, null, 'a ban lifted lets the account back in');
  await r.chat(back, 'back');
  assert.deepEqual(ofType(bob, 'chat').map((l) => l.text), ['back']);
});

test('SAFE4 THE SERVICE\'S DOOR: a signed mute or ban posted to the Worker reaches the hub, which applies it and hands the order itself to its target\'s sockets (`law`) for their own client to carry on; a forged or junk post is refused by the Worker before the hub is woken (mutants: the door unchecked; the order not handed on)', async () => {
  const world = fakeRooms();
  const hub = world.room(CHAT_WORLD_ROOM);
  const troll = hub.connect(); await hub.hello(troll, 'trol-0002');
  const kp = await hub.signer();
  const env = { ROOMS: world.ROOMS, IDENTITY_PUBLIC_KEY: hub.env.IDENTITY_PUBLIC_KEY };
  const nowS = Math.floor(Date.now() / 1000);
  const post = (body) => worker.fetch(new Request(`https://relay.example${SAFE_LAW_PATH}`, { method: 'POST', body: JSON.stringify(body) }), env);

  const lonely = fakeRooms();
  const forged = await mintOrder({ s: 'acct-trol-0002', mu: nowS + 600 }, (await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])).privateKey, { subtle, nowS });
  assert.equal((await worker.fetch(new Request(`https://relay.example${SAFE_LAW_PATH}`, { method: 'POST', body: JSON.stringify({ order: forged }) }), { ROOMS: lonely.ROOMS, IDENTITY_PUBLIC_KEY: hub.env.IDENTITY_PUBLIC_KEY })).status, 403);
  assert.equal(lonely.made.size, 0, 'a forged order wakes no room');
  assert.equal((await post({ order: 'junk' })).status, 403);
  assert.equal((await post({})).status, 400);
  assert.equal((await worker.fetch(new Request(`https://relay.example${SAFE_LAW_PATH}`), env)).status, 405);

  const mute = await mintOrder({ s: 'acct-trol-0002', mu: nowS + 600 }, kp.privateKey, { subtle, nowS });
  const res = await post({ order: mute });
  assert.equal(res.status, 200);
  assert.deepEqual(ofType(troll, 'muted'), [{ t: 'muted', until: nowS + 600 }]);
  assert.deepEqual(ofType(troll, 'law'), [{ t: 'law', order: mute }]);
  const ban = await mintBanOrder({ s: 'acct-trol-0002', bn: nowS + 86400 }, kp.privateKey, { subtle, nowS: nowS + 1 });
  assert.equal((await post({ order: ban })).status, 200);
  assert.deepEqual(ofType(troll, 'banned'), [{ t: 'banned', until: nowS + 86400 }]);
  assert.deepEqual(ofType(troll, 'law').at(-1), { t: 'law', order: ban });
});
