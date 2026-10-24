// INSTANCES (2026-10-15, Mac: "You and your party"; bible/11-Multiplayer/Instances.md): THE RELAY'S DOOR, through the
// door a player runs through - a real signed token at the real Room's hello (test/fakeRoom.mjs), the hub a real Room over
// its own fake storage (fakeRooms). An instance room admits its owner, the owner's party (the hub's word, asked by the
// owner's digest) and nobody else; the hub silent is busy; the party pose carries the member's instance; an instance
// room is a world room whose memory is forgotten on its own clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom, fakeRooms } from '../fakeRoom.mjs';
import { instanceOwnerOf, instanceRoomOf, INSTANCE_KIN_KEEP_MS, INSTANCE_DOOR_WORD } from '../../src/net/instanceRoom.js';
import { SOCIAL_ROOM, CLOSE_POLICY, CLOSE_BUSY, INSTANCE_TTL_MS, WORLD_TTL_MS, PARTY_OFFLINE_MS, validPartyPose, wdunRoomKey } from '../../src/net/wire.js';

const refusal = (ws) => ws.sent.find((m) => m.t === 'error')?.m ?? null;
/** The relay's out-of-door work (a re-check's hub ask and its refusal) let run to its end. */
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r)); await new Promise((r) => setTimeout(r, 60)); };   // the hub's answer rides digests (the platform's thread pool): time, not ticks, on a loaded machine
const POSE = { x: 1000, y: 0.3, z: 1000, yaw: 0, pitch: 0, mv: 0 };
/** A hub whose party p1 seats `members` (accounts `acct-<name>`), each record pointing at it. */
function partyHub(world, members, away = {}) {
  const hub = world.room(SOCIAL_ROOM);
  for (const m of members) hub.store.set(`acct:${m}`, { name: m.slice(5), party: 'p1' });
  hub.store.set('party:p1', { id: 'p1', leader: members[0], members, invites: [], away });
  return hub;
}
const welcomed = (ws) => ws.sent.some((m) => m.t === 'welcome');

async function instanceOf(owner, base = 'dungeon:m187853213') {
  return instanceRoomOf(base, { owner: await instanceOwnerOf(owner), epoch: '89abcdef' });
}

test('INSTANCES at the relay: the owner and the owner\'s party come in; a stranger is refused, before anything is written', async () => {
  const world = fakeRooms();
  const hub = world.room(SOCIAL_ROOM);
  hub.store.set('acct:acct-bobby', { name: 'bobby', party: 'p1' });
  hub.store.set('party:p1', { id: 'p1', leader: 'acct-alice', members: ['acct-alice', 'acct-bobby'], invites: [], away: {} });
  hub.store.set('acct:acct-carol', { name: 'carol', party: null });
  const key = await instanceOf('acct-alice');
  const r = world.room(key);
  const alice = r.connect(); await r.hello(alice, 'alice');
  assert.ok(welcomed(alice), 'its owner');
  const bob = r.connect(); await r.hello(bob, 'bobby');
  assert.ok(welcomed(bob), 'a member of the owner\'s party, by the hub\'s word');
  const carol = r.connect(); await r.hello(carol, 'carol');
  assert.equal(refusal(carol), 'private instance');
  assert.equal(carol.closed?.code, CLOSE_POLICY);
  assert.ok(!welcomed(carol));
  assert.ok(!r.sockets.includes(carol), 'gone from the room');
  assert.equal([...r.store.keys()].filter((k) => k.startsWith('secret')).some((k) => k.includes('carol')), false, 'her id\'s secret never planted');
});

test('INSTANCES at the relay: the hub not answering is busy - the page tries again - never a stranger\'s refusal and never a way in', async () => {
  const ROOMS = { idFromName: (n) => n, get: () => ({ fetch: async () => { throw new Error('hub away'); } }) };
  const r = fakeRoom(await instanceOf('acct-alice'), { ROOMS });
  const bob = r.connect(); await r.hello(bob, 'bobby');
  assert.equal(refusal(bob), 'busy');
  assert.equal(bob.closed?.code, CLOSE_BUSY);
  const alice = r.connect(); await r.hello(alice, 'alice');
  assert.ok(welcomed(alice), 'its owner never waits on the hub');
});

test('INSTANCES at the relay: a relay of one room (no hub) admits the owner alone', async () => {
  const r = fakeRoom(await instanceOf('acct-alice', 'interior:m206728581.131590'));
  const bob = r.connect(); await r.hello(bob, 'bobby');
  assert.equal(refusal(bob), 'private instance');
  const alice = r.connect(); await r.hello(alice, 'alice');
  assert.ok(welcomed(alice));
});

test('INSTANCES at the relay: the public room beside it is untouched - anyone comes in', async () => {
  const r = fakeRoom('dungeon:m187853213');
  const carol = r.connect(); await r.hello(carol, 'carol');
  assert.ok(welcomed(carol));
});

test('INSTANCES at the relay: an instance\'s memory is forgotten INSTANCE_TTL_MS after its room drains, a public room\'s WORLD_TTL_MS', async () => {
  let t = 1_000_000;
  const now = () => t;
  for (const [key, ttl] of [[await instanceOf('acct-alice'), INSTANCE_TTL_MS], ['dungeon:m187853213', WORLD_TTL_MS]]) {
    const realNow = Date.now;
    Date.now = now;
    try {
      const r = fakeRoom(key, { now });
      const alice = r.connect(); await r.hello(alice, 'alice');
      await r.drop(alice);
      assert.equal(r.alarm.at, t + ttl, key);
    } finally { Date.now = realNow; }
  }
});

test('INSTANCES on the party pose: inside, the instance ROOM a member stands in rides as `ins` - so a partner is matched by the room itself, never by a pixel two places share; outside, a public room, a bare word or a re-laid room\'s tag: none (the audit)', () => {
  const base = { px: 100, py: 120, in: 1, loc: 'x', h: 10, hm: 10, f: 10, fm: 10, m: 10, mm: 10 };
  const dungeon = 'dungeon:m187853213.i0123456789abcdef.89abcdef', building = 'interior:m206728581.131590.i0123456789abcdef.89abcdef';
  assert.equal(validPartyPose({ ...base, ins: dungeon })?.ins, dungeon);
  assert.equal(validPartyPose({ ...base, in: 2, bk: 131590, ins: building })?.ins, building);
  assert.equal('ins' in validPartyPose({ ...base, in: 0, ins: dungeon }), false, 'outside there is no instance');
  for (const bad of ['0123456789abcdef.89abcdef', 'dungeon:m187853213', 'dungeon:m187853213.m.i0123456789abcdef.89abcdef', 7]) {
    assert.equal('ins' in validPartyPose({ ...base, ins: bad }), false, String(bad));
  }
  assert.equal('ins' in validPartyPose(base), false, 'none said, none kept - every other pose reads as it always did');
});

test('INSTANCES at the relay (the audit): a member let in as the owner\'s party is ASKED AGAIN while it stays - kicked, it is refused out within INSTANCE_KIN_KEEP_MS; never asked more often; the owner is no party guest and never asked', async () => {
  const realNow = Date.now; let at = 5_000_000;
  Date.now = () => at;
  try {
    const world = fakeRooms({ now: () => at });
    const hub = partyHub(world, ['acct-alice', 'acct-bobby']);
    const r = world.room(await instanceOf('acct-alice'));
    const alice = r.connect(); await r.hello(alice, 'alice');
    const bob = r.connect(); await r.hello(bob, 'bobby');
    assert.ok(welcomed(bob));
    assert.equal(bob.att.ip, 1, 'marked: let in as the owner\'s party');
    assert.equal(alice.att.ip, undefined, 'the owner is no party guest');
    await r.pose(bob, POSE); await settle();
    assert.ok(r.sockets.includes(bob), 'of the party still: stays');
    hub.store.set('party:p1', { id: 'p1', leader: 'acct-alice', members: ['acct-alice'], invites: [], away: {} });   // the kick
    hub.store.set('acct:acct-bobby', { name: 'bobby', party: null });
    hub.wake();   // the hub's records as stored now (its kept copies are an awake object's)
    r.room._instanceKin.clear();   // the room's kept yes gone too: what holds the next ask back is the cadence alone
    at += 1000; await r.pose(bob, { ...POSE, x: 1001 }); await settle();
    assert.ok(r.sockets.includes(bob), 'asked at most once INSTANCE_KIN_KEEP_MS - a pose is the room\'s hottest path');
    at += INSTANCE_KIN_KEEP_MS; await r.pose(bob, { ...POSE, x: 1002 }); await settle();
    assert.equal(refusal(bob), INSTANCE_DOOR_WORD);
    assert.equal(bob.closed?.code, CLOSE_POLICY);
    assert.ok(!r.sockets.includes(bob), 'out of the room');
    assert.ok(r.sockets.includes(alice), 'its owner stays');
    at += INSTANCE_KIN_KEEP_MS; await r.pose(alice, POSE); await settle();
    assert.ok(r.sockets.includes(alice), 'and is never asked');
  } finally { Date.now = realNow; }
});

test('INSTANCES at the relay (the audit): a member gone on its own while the hub was asked is not refused after - its leave said once, never twice', async () => {
  const realNow = Date.now; let at = 7_000_000;
  Date.now = () => at;
  try {
    const world = fakeRooms({ now: () => at });
    const hub = partyHub(world, ['acct-alice', 'acct-bobby']);
    const r = world.room(await instanceOf('acct-alice'));
    const alice = r.connect(); await r.hello(alice, 'alice');
    const bob = r.connect(); await r.hello(bob, 'bobby');
    hub.store.set('party:p1', { id: 'p1', leader: 'acct-alice', members: ['acct-alice'], invites: [], away: {} });
    hub.store.set('acct:acct-bobby', { name: 'bobby', party: null });
    hub.wake(); r.room._instanceKin.clear();
    at += INSTANCE_KIN_KEEP_MS;
    const refusals = r.room._metrics.c.refusals;
    await r.pose(bob, POSE);   // the ask goes out...
    await r.drop(bob);         // ...and bob closes his tab before the hub answers
    await settle();
    assert.equal(refusal(bob), null, 'no refusal sent to a socket already gone');
    assert.equal(r.room._metrics.c.refusals, refusals, 'nor counted - the room refused nobody');
    const bobId = bob.att.id;
    assert.equal(alice.sent.filter((m) => m.t === 'leave' && m.id === bobId).length, 1, 'his leave said once');
  } finally { Date.now = realNow; }
});

test('INSTANCES at the relay (the audit): the hub answers by the party AS IT STANDS - an owner whose seat lapsed (PARTY_OFFLINE_MS away, no socket) admits nobody of it; and a no is never kept - a member just invited comes in at once', async () => {
  const realNow = Date.now; const at = 9_000_000;
  Date.now = () => at;
  try {
    const world = fakeRooms({ now: () => at });
    partyHub(world, ['acct-alice', 'acct-bobby'], { 'acct-alice': at - PARTY_OFFLINE_MS - 1 });
    const r = world.room(await instanceOf('acct-alice'));
    const bob = r.connect(); await r.hello(bob, 'bobby');
    assert.equal(refusal(bob), INSTANCE_DOOR_WORD, 'the owner\'s seat lapsed: the party holds no owner');
    const world2 = fakeRooms({ now: () => at });
    const hub2 = partyHub(world2, ['acct-alice']);
    const r2 = world2.room(await instanceOf('acct-alice'));
    const carol = r2.connect(); await r2.hello(carol, 'carol');
    assert.equal(refusal(carol), INSTANCE_DOOR_WORD);
    hub2.store.set('party:p1', { id: 'p1', leader: 'acct-alice', members: ['acct-alice', 'acct-carol'], invites: [], away: {} });   // invited, accepted
    hub2.store.set('acct:acct-carol', { name: 'carol', party: 'p1' });
    hub2.wake();
    const again = r2.connect(); await r2.hello(again, 'carol');
    assert.ok(welcomed(again), 'the room kept no no');
  } finally { Date.now = realNow; }
});

test('INSTANCES at the relay (the audit): a zone hall keeps no instance - its PvP, its locks and the hub\'s reset are its public room\'s - refused to everyone, staff and owner alike', async () => {
  const hall = wdunRoomKey('210,99');
  const key = instanceRoomOf(hall, { owner: await instanceOwnerOf('acct-alice'), epoch: '89abcdef' });
  assert.ok(key, 'the law keys it (the page never asks one)');
  const r = fakeRoom(key);
  const alice = r.connect(); await r.hello(alice, 'alice');
  assert.equal(refusal(alice), INSTANCE_DOOR_WORD, 'its owner');
  const staff = r.connect(); await r.hello(staff, 'mod1', null, { glyphs: ['dev'] });
  assert.equal(refusal(staff), INSTANCE_DOOR_WORD, 'staff');
  const pub = fakeRoom(hall);
  const carol = pub.connect(); await pub.hello(carol, 'carol');
  assert.ok(welcomed(carol), 'its public room is as it was');
});

test('INSTANCES at the relay (the audit): the hello gate is BY ACCOUNT, after the token - junk at the door, or one account\'s storm, never holds it shut for its owner (AUDIT SD II L7 M1\'s, a realm\'s)', async () => {
  const r = fakeRoom(await instanceOf('acct-alice'));
  for (let i = 0; i < 30; i++) { const junk = r.connect(); await r.hello(junk, `junk${i}`, null, { tok: null }); assert.ok(!welcomed(junk)); }
  for (let i = 0; i < 30; i++) { const bob = r.connect(); await r.hello(bob, 'bobby'); }
  const alice = r.connect(); await r.hello(alice, 'alice');
  assert.ok(welcomed(alice), 'its owner comes in through sixty knocks a moment');
  const pub = fakeRoom('dungeon:m187853213');
  for (let i = 0; i < 30; i++) { const junk = pub.connect(); await pub.hello(junk, `junk${i}`, null, { tok: null }); }
  const carol = pub.connect(); await pub.hello(carol, 'carol');
  assert.equal(refusal(carol), 'busy', 'a public room\'s bucket is the room\'s, as it was');
});
