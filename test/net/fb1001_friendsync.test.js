// FIELD BUGS 2026-10-01 part five (FRIENDS-SYNC) - #bug-reports, Shanewerewolf5, "Friend list issues": "My friend list
// is different between devices. On my laptop and desktop." Asked whether to build the merge, Mac: "Build it".
// The hub (server/src/index.js, SOC1) kept a friend list under `acct:<id>`, and `<id>` was the BROWSER
// PROFILE's (net/social.js accountId - minted once per appStorage, carried on the hub hello as `acct`). A laptop and a
// desktop are two profiles, so one signed-in player was two hub accounts with two lists; and two players who shared one
// browser were one account with one list. The verified player - the token's subject, the same on every device - was on
// the very same hello (`_named`, `sub` on the attachment) and ONE-SEAT already keyed the seat by it. Now the list is
// keyed by it too, and the profile pair is a legacy credential whose list is merged in once (ACC1b's "the merge belongs
// at the hub"). The real Room over the fake object (test/fakeRoom.mjs), the client's picture over plain frames.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRoom } from '../fakeRoom.mjs';
import { SOCIAL_ROOM } from '../../src/net/wire.js';
import { SocialState } from '../../src/net/social.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const stateOf = (ws) => ws.sent.filter((m) => m.t === 'social' && m.k === 'state').at(-1) ?? null;
const names = (ws) => (stateOf(ws)?.friends ?? []).map((f) => f.name).sort();

/** The hub on a driven clock; `device(name, sub, profile)` is a tab on a machine whose profile id is `profile`. */
async function withHub(fn) {
  const r = fakeRoom(SOCIAL_ROOM);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  const tick = (ms = 700) => { clock += ms; };
  const act = async (ws, o) => { await r.raw(ws, JSON.stringify({ t: 'social', ...o })); tick(); };
  const device = async (name, sub, profile) => {
    const ws = r.connect();
    await r.hello(ws, `tab-${profile}`, null, { name, tokenSub: sub, cl: 1, acct: profile, asecret: `secret-of-${profile}` });
    tick();
    return ws;
  };
  try { await fn({ r, act, device, tick }); } finally { Date.now = realNow; }
}

test('FRIENDS-SYNC: one player on two devices holds ONE friend list - a friend made on the laptop is on the desktop, under the player\'s id (mutant: the list keyed by the browser profile\'s id - the field bug)', () => withHub(async ({ r, act, device, tick }) => {
  const laptop = await device('Mac', 'player-mac', 'aLaptop0001');
  const bob = await device('Bob', 'player-bob', 'aBob0000001');
  await act(laptop, { k: 'friend.request', peer: 'tab-aBob0000001' });
  await act(bob, { k: 'friend.accept', acct: stateOf(laptop).acct });
  assert.deepEqual(names(laptop), ['Bob']);
  await r.drop(laptop); tick(5000);
  const desktop = await device('Mac', 'player-mac', 'aDesktop001');
  assert.equal(stateOf(desktop).acct, 'player-mac', 'the picture is the signed-in player\'s, not the desktop profile\'s');
  assert.deepEqual(names(desktop), ['Bob'], 'the friend made on the laptop is on the desktop');
  assert.deepEqual(stateOf(bob).friends.map((f) => f.acct), ['player-mac'], 'and Bob holds one Mac, not one per machine');
  assert.equal(r.store.has('acct:aDesktop001'), false, 'no second account minted for the second machine');
}));

test('FRIENDS-SYNC: a second player signed in on the same browser profile does not inherit the first\'s list (mutant: the profile id still the key)', () => withHub(async ({ r, act, device, tick }) => {
  const mac = await device('Mac', 'player-mac', 'aShared0001');
  const bob = await device('Bob', 'player-bob', 'aBob0000001');
  await act(mac, { k: 'friend.request', peer: 'tab-aBob0000001' });
  await act(bob, { k: 'friend.accept', acct: stateOf(mac).acct });
  await r.drop(mac); tick(5000);
  const eve = await device('Eve', 'player-eve', 'aShared0001');
  assert.equal(stateOf(eve).acct, 'player-eve');
  assert.deepEqual(names(eve), [], 'Eve sees her own (empty) list');
}));

test('FRIENDS-SYNC migration: two lists that diverged before the deploy become their UNION, every friend\'s record names the player, and the profile records are retired (mutants: last device wins; a friend left naming the dead profile id; the merge taken on a wrong profile secret)', () => withHub(async ({ r, device }) => {
  // the hub as the old law left it: the laptop profile friends Bob and Erin, the desktop profile Carol and Bob
  const old = (name, friends) => ({ name, seen: 1, friends, in: [], out: [], invites: [], party: null });
  r.store.set('acct:aLaptop0001', old('Mac', ['player-bob', 'player-erin'])); r.store.set('asecret:aLaptop0001', 'secret-of-aLaptop0001');
  r.store.set('acct:aDesktop001', old('Mac', ['player-carol', 'player-bob'])); r.store.set('asecret:aDesktop001', 'secret-of-aDesktop001');
  r.store.set('acct:player-bob', old('Bob', ['aLaptop0001', 'aDesktop001']));
  r.store.set('acct:player-carol', old('Carol', ['aDesktop001']));
  r.store.set('acct:player-erin', old('Erin', ['aLaptop0001']));
  r.store.set('acct:aThief00001', old('Mac', ['player-dave'])); r.store.set('asecret:aThief00001', 'not-what-the-thief-holds');
  const laptop = await device('Mac', 'player-mac', 'aLaptop0001');
  assert.deepEqual(names(laptop), ['Bob', 'Erin']);
  const desktop = await device('Mac', 'player-mac', 'aDesktop001');
  assert.deepEqual(names(desktop), ['Bob', 'Carol', 'Erin'], 'the union, Bob once - and Erin, whom only the laptop knew');
  assert.deepEqual(r.store.get('acct:player-mac').friends.slice().sort(), ['player-bob', 'player-carol', 'player-erin']);
  assert.deepEqual(r.store.get('acct:player-bob').friends, ['player-mac'], 'Bob names the player, once');
  assert.deepEqual(r.store.get('acct:player-carol').friends, ['player-mac']);
  assert.deepEqual(r.store.get('acct:player-erin').friends, ['player-mac']);
  for (const k of ['acct:aLaptop0001', 'asecret:aLaptop0001', 'acct:aDesktop001', 'asecret:aDesktop001']) assert.equal(r.store.has(k), false, `${k} retired`);
  await device('Mac', 'player-mac', 'aThief00001');
  assert.ok(!r.store.get('acct:player-mac').friends.includes('player-dave'), 'a profile whose secret does not match is not merged');
}));

test('FRIENDS-SYNC client: the picture is accepted under the signed-in player\'s id (or the profile\'s, from a relay before the fix) and nobody else\'s; the host expects both (mutants: AUDIT SOC B19 refusing the player\'s id; B19 dropped)', () => {
  const frame = (acct) => ({ t: 'social', k: 'state', acct, name: 'Mac', peers: [], friends: [], in: [], out: [], party: null, invites: [] });
  const s = new SocialState({ acct: ['player-mac', 'aLaptop0001'] });
  assert.equal(s.apply(frame('player-mac')), 'state'); assert.equal(s.acct, 'player-mac');
  assert.equal(new SocialState({ acct: ['player-mac', 'aLaptop0001'] }).apply(frame('aLaptop0001')), 'state', 'an old relay\'s picture still lands');
  assert.equal(new SocialState({ acct: ['player-mac', 'aLaptop0001'] }).apply(frame('player-eve')), null, 'B19 stands: a picture naming another is a relay\'s lie');
  const world = rd('src/scenes/world.js');
  assert.match(world, /new SocialState\(\{ acct: \[storedSession\(appStorage\(\)\)\?\.id, link\.acct\]/, 'socialStart expects the signed-in player\'s id first');
  assert.doesNotMatch(world.slice(world.indexOf('const checkCanceledByFollower'), world.indexOf('const outdoorRestDeps')), /accountId\(\)/, 'a follower\'s Stop names the hub\'s id for me, never the profile\'s');
});
