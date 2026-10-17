// AUDIT 2026-10-01 part five (Mac: "audit this") - FRIENDS-SYNC, the hub's account the signed-in player (relay world142).
// The lane drove the real Room over test/fakeRoom.mjs with PRODUCTION-shaped hellos - the token's subject is the player,
// the hello's `acct` the browser profile's id - where the older hub pins sign each hello for its own account. Five
// findings, each red on the branch as committed:
//   F1 a profile record PLANTED at a player's id under the old law (a player's id is public - every roster carries `sub`)
//      was inherited by that player at their first hello, and merged away from them later by whoever held its secret;
//   F2 a friend the FRIENDS_MAX cut dropped from the union was still renamed onto the player - a one-way friend who saw
//      their presence and whom they could not remove;
//   F3 the reconnect-replace leave (a same-peer-id hello) is no logout - its account is the subject now (unpinned);
//   F5 a client built before world142 refused every picture the hub sent (AUDIT SOC B19) and was told nothing;
//   F6 the merge at its bounds - 129 records over the 128 wall, a request from a friend, my own other device, an online
//      friend's picture - unpinned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom } from '../fakeRoom.mjs';
import { SOCIAL_ROOM, FRIENDS_MAX, PENDING_MAX, parseClient, validSocialFrame } from '../../src/net/wire.js';
import { SocialState } from '../../src/net/social.js';

const rec = (name, o = {}) => ({ name, seen: 1, friends: [], in: [], out: [], invites: [], party: null, ...o });
const stateOf = (ws) => ws.sent.filter((m) => m.t === 'social' && m.k === 'state').at(-1) ?? null;
async function withHub(fn) {
  const r = fakeRoom(SOCIAL_ROOM);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  const tick = (ms = 700) => { clock += ms; };
  const device = async (name, sub, profile, secret = `secret-of-${profile}`, extra = {}) => {
    const ws = r.connect();
    await r.hello(ws, `tab-${profile}`, null, { name, tokenSub: sub, cl: 1, acct: profile, asecret: secret, ...extra });
    tick(); return ws;
  };
  const act = async (ws, o) => { await r.raw(ws, JSON.stringify({ t: 'social', ...o })); tick(); };
  try { await fn({ r, tick, device, act }); } finally { Date.now = realNow; }
}

test('AUDIT FRIENDS-SYNC F1: a profile record planted at a PLAYER\'s id under the old law (sub is public) is neither inherited by that player nor merged away later by its planter (mutant: the merge as committed)', () => withHub(async ({ r, tick, device }) => {
  const V = 'Vx3k9QmZpL2wR8tY4uN6bA1c';
  // the hub as world141 leaves it: Mallory said hello with acct = V and her own secret; her alt befriended "V"
  r.store.set(`acct:${V}`, rec('Mallory', { friends: ['aMalAlt0001'] })); r.store.set(`asecret:${V}`, 'planted-secret-1');
  r.store.set('acct:aMalAlt0001', rec('MalAlt', { friends: [V] })); r.store.set('asecret:aMalAlt0001', 'secret-of-aMalAlt0001');
  // and the victim's real list, under its profile
  r.store.set('acct:aVictim0001', rec('Victim', { friends: ['player-bob'] })); r.store.set('asecret:aVictim0001', 'secret-of-aVictim0001');
  r.store.set('acct:player-bob', rec('Bob', { friends: ['aVictim0001'] }));
  const alt = await device('MalAlt', 'player-alt', 'aMalAlt0001');
  const vic = await device('Victim', V, 'aVictim0001');
  assert.deepEqual(stateOf(vic).friends.map((f) => f.acct), ['player-bob'], 'the planted friend is not the victim\'s');
  assert.ok(!alt.sent.some((m) => m.k === 'presence' && m.acct === V && m.online), 'and the planter\'s alt never hears the victim come online');
  assert.ok(!r.store.get('acct:player-alt').friends.includes(V), 'and the alt\'s own record forgets the planted friendship');
  await r.drop(vic); tick(5000);
  await device('Mallory', 'player-mal', V, 'planted-secret-1');
  assert.deepEqual(r.store.get(`acct:${V}`)?.friends, ['player-bob'], 'the victim keeps its list');
  assert.deepEqual(r.store.get('acct:player-bob').friends, [V], 'and Bob still names the victim, not the planter');
}));

test('AUDIT FRIENDS-SYNC F2: a friend the FRIENDS_MAX cut drops is forgotten both ways - never a one-way friend who sees my presence and whom I cannot remove (mutant: the merge as committed)', () => withHub(async ({ r, tick, device, act }) => {
  const lap = Array.from({ length: 40 }, (_, i) => `pL${String(i).padStart(3, '0')}`), desk = Array.from({ length: 40 }, (_, i) => `pD${String(i).padStart(3, '0')}`);
  r.store.set('acct:aLaptop0001', rec('Mac', { friends: lap })); r.store.set('asecret:aLaptop0001', 'secret-of-aLaptop0001');
  r.store.set('acct:aDesktop001', rec('Mac', { friends: desk })); r.store.set('asecret:aDesktop001', 'secret-of-aDesktop001');
  for (const id of lap) r.store.set(`acct:${id}`, rec(id, { friends: ['aLaptop0001'] }));
  for (const id of desk) r.store.set(`acct:${id}`, rec(id, { friends: ['aDesktop001'] }));
  await r.drop(await device('Mac', 'player-mac', 'aLaptop0001')); tick(5000);
  await device('Mac', 'player-mac', 'aDesktop001');
  const mine = new Set(r.store.get('acct:player-mac').friends);
  assert.equal(mine.size, FRIENDS_MAX);
  for (const id of [...lap, ...desk]) assert.equal(r.store.get(`acct:${id}`).friends.includes('player-mac'), mine.has(id), `${id}: a friendship is both ways or neither`);
}));

test('AUDIT FRIENDS-SYNC F6: the merge at the bounds - 64 friends and 32 requests each way (129 records, over the 128 wall), a request from someone already a friend dropped, my own other device never my friend, and an online friend re-sent its picture (mutants: one batch; the pending filters; self kept; the cap; the friends not told)', () => withHub(async ({ r, tick, device }) => {
  const ids = (p, n) => Array.from({ length: n }, (_, i) => `${p}${String(i).padStart(3, '0')}`);
  const F = ids('pF', FRIENDS_MAX - 1), I = ids('pI', PENDING_MAX), O = ids('pO', PENDING_MAX);
  r.store.set('acct:aLaptop0001', rec('Mac', { friends: [...F, 'aDesktop001'], in: I.map((acct) => ({ acct, at: 1 })), out: O.map((acct) => ({ acct, at: 1 })) }));
  r.store.set('asecret:aLaptop0001', 'secret-of-aLaptop0001');
  r.store.set('acct:aDesktop001', rec('Mac', { friends: ['aLaptop0001', 'pExtra', 'pF000'], in: [{ acct: 'pF001', at: 2 }] })); r.store.set('asecret:aDesktop001', 'secret-of-aDesktop001');
  r.store.set('acct:pExtra', rec('Extra', { friends: ['aDesktop001'] }));
  for (const id of F) r.store.set(`acct:${id}`, rec(id, { friends: ['aLaptop0001', ...(id === 'pF000' ? ['aDesktop001'] : [])], out: id === 'pF001' ? [{ acct: 'aDesktop001', at: 2 }] : [] }));
  for (const id of I) r.store.set(`acct:${id}`, rec(id, { out: [{ acct: 'aLaptop0001', at: 1 }] }));
  for (const id of O) r.store.set(`acct:${id}`, rec(id, { in: [{ acct: 'aLaptop0001', at: 1 }] }));
  const f1 = r.connect(); await r.hello(f1, 'tab-pF002', null, { name: 'pF002', tokenSub: 'pF002', acct: 'pF002', asecret: 'secret-of-pF002' }); tick();   // a friend online
  const lap = await device('Mac', 'player-mac', 'aLaptop0001');
  assert.ok(lap.att.acct === 'player-mac' && stateOf(lap), 'the widest merge lands - the 129 records written in the runtime\'s batches');
  assert.equal(stateOf(f1).friends.map((f) => f.acct).includes('player-mac'), true, 'the online friend\'s picture names the player now');
  await r.drop(lap); tick(5000);
  const desk = await device('Mac', 'player-mac', 'aDesktop001');
  const me = r.store.get('acct:player-mac');
  assert.ok(!me.friends.includes('player-mac') && !me.friends.includes('aDesktop001') && !me.friends.includes('aLaptop0001'), 'my own devices are me, never my friend');
  assert.ok(me.friends.length <= FRIENDS_MAX, 'the cap');
  assert.ok(!me.in.some((e) => me.friends.includes(e.acct)) && !me.out.some((e) => me.friends.includes(e.acct)), 'nobody is both a friend and a request');
  assert.ok(!r.store.get('acct:pF001').out.some((e) => e.acct === 'player-mac'), 'nor on their side');
  assert.equal(stateOf(desk).acct, 'player-mac');
}));

test('AUDIT FRIENDS-SYNC F3: a reconnect (the same peer id, the old socket still listed) is no logout - the replaced socket\'s account is the token\'s subject, not the profile id the hello names (mutant: `b.acct !== m.acct`, which survives every suite on the branch)', () => withHub(async ({ r, tick, device, act }) => {
  const mac = await device('Mac', 'player-mac', 'aLaptop0001'), bob = await device('Bob', 'player-bob', 'aBob0000001');
  await act(mac, { k: 'friend.request', peer: 'tab-aBob0000001' }); await act(bob, { k: 'friend.accept', acct: 'player-mac' });
  await act(mac, { k: 'party.invite', peer: 'tab-aBob0000001' }); const pid = mac.att.party;
  await act(bob, { k: 'party.decline', party: pid });   // a party of one with an invite that is no longer live
  tick(10 * 60_000);
  const before = bob.sent.length;
  const again = r.connect(); await r.hello(again, 'tab-aLaptop0001', null, { name: 'Mac', tokenSub: 'player-mac', acct: 'aLaptop0001', asecret: 'secret-of-aLaptop0001' }); tick();
  assert.ok(!bob.sent.slice(before).some((m) => m.k === 'presence' && m.acct === 'player-mac' && !m.online), 'Bob never hears Mac go offline across a reconnect');
  assert.equal(again.att.party ?? null, pid, 'and the party of one is not deleted by a leave nobody took');
}));

test('AUDIT FRIENDS-SYNC F5: a client built before the fix (no `ps`) is TOLD - its B19 refuses every picture the hub now sends; a client that says `ps` hears no such word', async () => {
  const r = fakeRoom(SOCIAL_ROOM);
  const old = r.connect(); await r.hello(old, 'tab-old', null, { name: 'Mac', tokenSub: 'player-mac', acct: 'aLaptop0001', asecret: 'secret-of-aLaptop0001', cl: 1, ps: undefined });
  // a build before the fix: its host expected the profile id alone
  const s = new SocialState({ acct: 'aLaptop0001' }); const kinds = old.sent.filter((m) => m.t === 'social').map((f) => s.apply(validSocialFrame(f) ?? f));
  assert.equal(s.acct, null, 'the old client\'s picture never lands');
  assert.ok(kinds.includes('error') && /update/.test(s.lastError ?? ''), 'and it is told why, in its chat');
  const nw = r.connect(); await r.hello(nw, 'tab-new', null, { name: 'Bob', tokenSub: 'player-bob', acct: 'aBob0000001', asecret: 'secret-of-aBob0000001', cl: 1, ps: 1 });
  assert.ok(!nw.sent.some((m) => m.k === 'error'), 'a current client hears nothing of it');
  assert.equal(parseClient(JSON.stringify({ t: 'hello', id: 'tab-x', secret: 'secret-of-tab-x', name: 'x', look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, pose: null, acct: 'aX00000001', asecret: 'secretsecret', ps: 2 })).error, 'bad account');
});
