// VOICE-RELAY-DOOR (bible/11-Multiplayer/Voice-Arc.md, the relay's doors): THE VOICE SERVICE'S TWO QUESTIONS, asked of
// real Rooms over their own fake storage (test/fakeRoom.mjs fakeRooms) through the hello a player runs through - a real
// signed token, its subject (tokenSub) the account the door is asked about. The secret first, then the ask's shape, then the
// object: the place's own or the layer the asker stands in; the hub's bus for the party and the mute, read as every hub
// reading is. A room that does not answer is `unavailable`, never a no (VOICE-REVOKE).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom, fakeRooms } from '../fakeRoom.mjs';
import { routeVoiceDoor, isVoiceDoor, ctEqualStrings, voicePresenceObject } from '../../server/src/voiceDoor.js';
import { VOICE_PRESENCE_PATH, VOICE_PARTY_OF_PATH, VOICE_RELAY_SECRET_HEADER } from '../../src/net/voice/voiceWire.js';
import { SOCIAL_ROOM, PARTY_OFFLINE_MS, layerName } from '../../src/net/wire.js';
import { mintOrder, mintBanOrder } from '../../src/net/identityToken.js';

const SECRET = 's3cret-voice';
const ask = (path, body, { secret = SECRET, method = 'POST' } = {}) => new Request(`https://relay.test${path}`, {
  method, headers: { 'content-type': 'application/json', ...(secret != null ? { [VOICE_RELAY_SECRET_HEADER]: secret } : {}) },
  ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
});
const door = async (env, path, body, o) => { const res = await routeVoiceDoor(ask(path, body, o), env, path); return { status: res.status, body: await res.json() }; };

test('VOICE-RELAY-DOOR the secret: the Worker answers its two paths alone, by POST, and only to the shared secret - unset, missing or wrong refused alike, compared in constant time', async () => {
  assert.equal(isVoiceDoor(VOICE_PRESENCE_PATH), true); assert.equal(isVoiceDoor(VOICE_PARTY_OF_PATH), true);
  assert.equal(isVoiceDoor('/room/world:1,2'), false); assert.equal(isVoiceDoor('/internal/voice/presence/of'), false, 'a room\'s own half is never the Worker\'s');
  const world = fakeRooms();
  const env = { ROOMS: world.ROOMS, VOICE_RELAY_SECRET: SECRET };
  const body = { acct: 'acct-alice', room: 'world:12,34' };
  assert.equal((await door(env, VOICE_PRESENCE_PATH, body)).status, 200);
  const stood = world.made.size;
  assert.equal((await door(env, VOICE_PRESENCE_PATH, body, { method: 'GET' })).status, 405);
  assert.equal((await door({ ROOMS: world.ROOMS }, VOICE_PRESENCE_PATH, body)).status, 403, 'no secret set on the relay: no door, never an open one');
  assert.equal((await door({ ROOMS: world.ROOMS }, VOICE_PRESENCE_PATH, body, { secret: 'undefined' })).status, 403, 'nor one an unset secret\'s spelling opens');
  assert.equal((await door(env, VOICE_PRESENCE_PATH, body, { secret: null })).status, 403);
  for (const wrong of ['s3cret-voicE', 's3cret-voic', 's3cret-voice!', '']) assert.equal((await door(env, VOICE_PARTY_OF_PATH, { acct: 'acct-alice' }, { secret: wrong })).status, 403, wrong);
  assert.deepEqual([ctEqualStrings('abc', 'abc'), ctEqualStrings('', ''), ctEqualStrings('abc', 'abd'), ctEqualStrings('abc', 'ab'), ctEqualStrings('ab', 'abc'), ctEqualStrings('a', 'a\0')], [true, true, false, false, false, false]);
  assert.equal(world.made.size, stood, 'a refused ask reaches no room');
});

test('VOICE-RELAY-DOOR presence: the room the client named, in the relay\'s own key shape, says whether the account is hello\'d into it - and a crowded place\'s layer says it of itself', async () => {
  const world = fakeRooms();
  const env = { ROOMS: world.ROOMS, VOICE_RELAY_SECRET: SECRET };
  const place = world.room('world:12,34');
  await place.hello(place.connect(), 'alice', null, { tokenSub: 'acct-alice' });
  // the place's second layer: an object of its own under `key#2` (the Worker's walk), whose sockets are the place's key
  const layer = fakeRoom('world:12,34', { ROOMS: world.ROOMS });
  world.made.set(layerName('world:12,34', 2), layer);
  await layer.hello(layer.connect(), 'carol', null, { tokenSub: 'acct-carol' });
  const here = async (acct, room, ly) => (await door(env, VOICE_PRESENCE_PATH, { acct, room, ...(ly !== undefined ? { ly } : {}) })).body.here;
  assert.equal(await here('acct-alice', 'world:12,34'), true);
  assert.equal(await here('acct-bobby', 'world:12,34'), false, 'an account nobody hello\'d');
  assert.equal(await here('acct-carol', 'world:12,34', 2), true, 'the layer she stands in');
  assert.equal(await here('acct-carol', 'world:12,34'), false, 'not the place itself - another crowd');
  assert.equal(await here('acct-alice', 'world:12,34', 2), false);
  // the subject is the token's, never the frame's: a hello whose id names alice under bobby's token is bobby's
  await place.hello(place.connect(), 'acct-alice', null, { tokenSub: 'acct-bobby' });
  assert.equal(await here('acct-bobby', 'world:12,34'), true);
  // the object asked: a layer of a room that layers; a gate's court answers for its copies itself
  assert.equal(voicePresenceObject('world:12,34', 3), 'world:12,34#3');
  assert.equal(voicePresenceObject('dungeon:m187853213', 1), 'dungeon:m187853213#1');
  assert.equal(voicePresenceObject('gate:3', 0), 'gate:3');
  assert.equal(voicePresenceObject('gate:3', 1), null);
  // shapes the door refuses before any room is asked
  const before = world.made.size;
  for (const bad of [{ acct: 'acct-alice', room: '../x' }, { acct: 'acct-alice', room: 'world:1,2/x' }, { acct: 'acct-alice', room: 'nocolon' },
    { acct: 'acct-alice', room: 'world:12,34', ly: 8 }, { acct: 'acct-alice', room: 'world:12,34', ly: -1 }, { acct: 'acct-alice', room: 'world:12,34', ly: 1.5 },
    { acct: 'acct-alice', room: 'gate:3', ly: 1 }, { room: 'world:12,34' }, { acct: 'a'.repeat(129), room: 'world:12,34' }]) {
    assert.equal((await door(env, VOICE_PRESENCE_PATH, bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal(world.made.size, before, 'no object stood for a refused shape');
});

test('VOICE-RELAY-DOOR a room that does not answer is `unavailable` (503) - never an exception out of the Worker, and never a "no" the voice service\'s sweep would drop every call on', async () => {
  const throwing = { idFromName: (n) => n, get: () => ({ fetch: async () => { throw Object.assign(new Error('reset'), { retryable: true }); } }) };
  const failing = { idFromName: (n) => n, get: () => ({ fetch: async () => new Response('{}', { status: 503 }) }) };
  const warn = console.warn; console.warn = () => {};
  try {
    for (const ROOMS of [throwing, failing]) {
      const env = { ROOMS, VOICE_RELAY_SECRET: SECRET };
      assert.deepEqual(await door(env, VOICE_PRESENCE_PATH, { acct: 'acct-alice', room: 'world:12,34' }), { status: 503, body: { error: 'unavailable' } });
      assert.deepEqual(await door(env, VOICE_PARTY_OF_PATH, { acct: 'acct-alice' }), { status: 503, body: { error: 'unavailable' } });
    }
  } finally { console.warn = warn; }
});

test('VOICE-RELAY-DOOR party-of: the hub\'s bus answers, as every hub reading does - a lapsed seat walked out, a stale pointer cleared', async () => {
  const world = fakeRooms();
  const env = { ROOMS: world.ROOMS, VOICE_RELAY_SECRET: SECRET };
  const hub = world.room(SOCIAL_ROOM);
  const now = Date.now();
  hub.store.set('acct:acct-alice', { name: 'alice', party: 'q1abc2def3' });
  hub.store.set('acct:acct-bobby', { name: 'bobby', party: 'q1abc2def3' });
  hub.store.set('acct:acct-dave', { name: 'dave', party: 'q9gone0000' });
  hub.store.set('party:q1abc2def3', { id: 'q1abc2def3', leader: 'acct-alice', members: ['acct-alice', 'acct-bobby'], invites: [], away: { 'acct-bobby': now - PARTY_OFFLINE_MS - 1000 } });
  const partyOf = async (acct) => (await door(env, VOICE_PARTY_OF_PATH, { acct })).body.party;
  assert.equal(await partyOf('acct-alice'), 'q1abc2def3');
  assert.equal(await partyOf('acct-bobby'), null, 'away past PARTY_OFFLINE_MS with no socket: the seat lapsed');
  assert.equal(await partyOf('acct-carol'), null, 'no record');
  assert.equal(await partyOf('acct-dave'), null, 'a party gone');
  assert.equal(hub.store.get('acct:acct-dave').party, null, 'and the record\'s pointer cleared, as _myParty clears it');
  assert.deepEqual([...world.made.keys()], [SOCIAL_ROOM], 'the bus alone was asked');
});

test('VOICE-REVOKE party-of says the mute too: off the account\'s sockets on the bus, which every mute order rewrites (the newest order over a token minted before it), else the bus\'s own order for an account with no socket - and the ban the hub holds (VOICE-BAN)', async () => {
  const world = fakeRooms();
  const env = { ROOMS: world.ROOMS, VOICE_RELAY_SECRET: SECRET };
  const hub = world.room(SOCIAL_ROOM);
  const nowS = Math.floor(Date.now() / 1000);
  const standing = async (acct) => (await door(env, VOICE_PARTY_OF_PATH, { acct })).body;
  await hub.hello(hub.connect(), 'erin', null, { tokenSub: 'acct-erin', mu: nowS + 600 });
  await hub.hello(hub.connect(), 'erin2', null, { tokenSub: 'acct-erin' });
  assert.deepEqual(await standing('acct-erin'), { party: null, mu: nowS + 600, bn: 0 }, 'the token\'s mute, the latest of its tabs');
  assert.deepEqual(await standing('acct-carol'), { party: null, mu: 0, bn: 0 }, 'no socket, no order: no mute');
  // a moderator's signed order, carried in: it rewrites a socket's mute, and the bus keeps it for an account away
  const mod = hub.connect(); await hub.hello(mod, 'kestrel', null, { tokenSub: 'acct-kestrel' });
  const kp = await hub.signer();
  const order = (s, mu, i) => mintOrder({ s, mu }, kp.privateKey, { subtle: globalThis.crypto.subtle, nowS: i });
  await hub.raw(mod, JSON.stringify({ t: 'mute', order: await order('acct-erin', 0, nowS) }));
  assert.equal((await standing('acct-erin')).mu, 0, 'lifted: the order over the token');
  const mod2 = hub.connect(); await hub.hello(mod2, 'merlin', null, { tokenSub: 'acct-merlin' });   // a carrier's own MUTE_HZ_MAX
  await hub.raw(mod2, JSON.stringify({ t: 'mute', order: await order('acct-gone', nowS + 900, nowS) }));
  assert.deepEqual(await standing('acct-gone'), { party: null, mu: nowS + 900, bn: 0 }, 'away, the order alone');
  // VOICE-BAN: a ban the hub took (SAFE4's `_bans`) - a carrier's signed order, as the law door's would be - and one that ended
  const mod3 = hub.connect(); await hub.hello(mod3, 'osprey', null, { tokenSub: 'acct-osprey' });
  await hub.raw(mod3, JSON.stringify({ t: 'ban', order: await mintBanOrder({ s: 'acct-exile', bn: nowS + 3600 }, kp.privateKey, { subtle: globalThis.crypto.subtle, nowS }) }));
  assert.deepEqual(await standing('acct-exile'), { party: null, mu: 0, bn: nowS + 3600 }, 'banned: the hub\'s word, beside the party and the mute');
  const mod4 = hub.connect(); await hub.hello(mod4, 'harrier', null, { tokenSub: 'acct-harrier' });
  await hub.raw(mod4, JSON.stringify({ t: 'ban', order: await mintBanOrder({ s: 'acct-pardon', bn: 0 }, kp.privateKey, { subtle: globalThis.crypto.subtle, nowS }) }));
  assert.equal((await standing('acct-pardon')).bn, 0, 'a ban lifted is none');
  assert.deepEqual(await door(env, VOICE_PARTY_OF_PATH, { acct: 'a'.repeat(129) }), { status: 400, body: { error: 'bad ask' } });
});
