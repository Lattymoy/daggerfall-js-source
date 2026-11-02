// AUDIT ONLINE 3, THE SECOND READ (2026-10-17, the owner: "Pick it up and do your own audit over it") - AUDIT ONLINE 3's
// seven fixes read cold by four lanes against main (bible/06-Systems/Online-Arc.md, AUDIT ONLINE 3, the second read).
// Each finding below was driven through the real OnlineSession over the fake socket, or the real RemotePlayers, before
// it was believed; and the pins AUDIT ONLINE 3's own mutants showed loose are made to fail.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OnlineSession, FALLEN_MAX, steadyClock, steadyNow } from '../../src/net/online.js';
import { RemotePlayers } from '../../src/net/remotePlayers.js';
import { accountTokenMinter, SESSION_KEY, TOKEN_REUSE_MS } from '../../src/net/accountClient.js';
import { fakeSocketClass } from '../fakeSocket.mjs';

const session = (o = {}) => {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, rand: () => 0, ...o });
  return { s, sockets };
};
const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const STILL = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0 };
const helloOf = (ws) => JSON.parse(ws.sent.find((x) => x.startsWith('{"t":"hello"')));

// ── C-1: THE OVERWORLD'S WORD STAYED WITH THE CELL LEFT ─────────────────────────────────────────────────────────

test('AUDIT ONLINE 3 (the second read) C-1: a crossing carries `owOk` and `owGraveOk` both ways - a cell whose relay keeps no graves is never sent `gr` because the cell left kept them', async () => {
  let t = 1e6;
  const { s, sockets } = session({ now: () => t });
  s.join('world:10,10', STILL); const A = sockets[0]; await A.onopen(); A.receive({ t: 'welcome', id: 'mac-0001', peers: [], v: 'world212' });
  s.setHalo(['world:11,10']); const B = sockets[1]; await B.onopen(); B.receive({ t: 'welcome', id: 'mac-0001', peers: [], v: 'world211' });
  assert.deepEqual([s.owOk, s.owGraveOk], [true, true], 'my cell keeps the ledger and its graves');
  assert.deepEqual([s._halo.get('world:11,10').owOk, s._halo.get('world:11,10').owGraveOk], [true, false], 'the halo says for itself');
  s.join('world:11,10', STILL);
  assert.equal(s._ws, B, 'B promoted');
  assert.deepEqual([s.owOk, s.owGraveOk], [true, false], 'the cell crossed into says for itself - a world211 relay closes the socket on `gr`');
  assert.deepEqual([s._halo.get('world:10,10').owOk, s._halo.get('world:10,10').owGraveOk], [true, true], 'and the cell left keeps its own word');
  s.join('world:10,10', STILL);
  assert.equal(s._ws, A, 'and back');
  assert.deepEqual([s.owOk, s.owGraveOk], [true, true]);
});

// ── A7: A GHOST'S RECONNECT SAID IT LIVED ──────────────────────────────────────────────────────────────────────

test('AUDIT ONLINE 3 (the second read) A7: after my death, every hello says it (dd, standing still) - a Wild ghost\'s reconnect never stands me up on my body; a pose said (a rise) and a leave end it', async () => {
  let t = 1e6;
  const { s, sockets } = session({ now: () => t });
  s.join('world:10,10', STILL); await sockets[0].onopen(); sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], v: 'world212' });
  t += 1000; s.sendPose({ ...STILL, x: 5, mv: 1 });
  assert.equal(helloOf(sockets[0]).pose.dd, undefined, 'a living hello');
  assert.equal(s.sendDeath(), true);
  sockets[0].drop(1006);   // the ghost's socket blips (its room is kept while the body lies)
  t += 60_000; s.tick();
  const again = sockets[1];
  assert.ok(again, 'the ghost reconnects');
  await again.onopen();
  const p = helloOf(again).pose;
  assert.deepEqual([p.dd, p.mv, p.x], [1, 0, 5], 'the reconnect\'s hello is the death\'s pose - where I fell, lying');
  // a rise: a pose said ends it
  again.receive({ t: 'welcome', id: 'mac-0001', peers: [], v: 'world212' });
  t += 1000; s.sendPose({ ...STILL, x: 6 });
  again.drop(1006); t += 60_000; s.tick(); await sockets[2].onopen();
  assert.equal(helloOf(sockets[2]).pose.dd, undefined, 'risen: a living hello');
  // a leave ends it too - the next room's hello is a new life's
  sockets[2].receive({ t: 'welcome', id: 'mac-0001', peers: [], v: 'world212' });
  s.sendDeath(); s.leave();
  s.join('world:20,20', STILL); await sockets[3].onopen();
  assert.equal(helloOf(sockets[3]).pose.dd, undefined, 'a new room after the ghost let go: alive');
});

// ── A1/A2: AN INTRODUCTION'S DEATH LAID A SECOND BODY ──────────────────────────────────────────────────────────

const corpses = () => {
  let t = 0; const heard = [];
  const renderer = { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {} };
  const tex = { recordCount: 5, getSize: () => ({ width: 60, height: 20 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 };
  const rp = new RemotePlayers({ renderer, now: () => t, deps: { audio: { playOneShot: (c, v) => heard.push([c, v]) }, getTexture: async () => tex, uploadRecordFrame: () => {} } });
  rp.sync([], (p) => [p.x, p.y, p.z], { eye: [0, 0, 0] });
  return { rp, heard, at: (ms) => { t = ms; } };
};
const LOOK = { class: 'Mage', race: 'Breton', gender: 'female' };

test('AUDIT ONLINE 3 (the second read) A1/A2: an introduction\'s death lays a body only where none of that person\'s lies, and never cries - a death heard as it happens is laid and cried', () => {
  // A1: the ghost's body lies; a leave forgot the session's deaths and the next roster names it again
  const a = corpses();
  a.rp.peerDeath({ id: 'bob', acct: null, look: LOOK }, { x: 3, y: 0, z: 0 }, 'world:1,1');
  assert.equal(a.heard.length, 1, 'heard as it happened: cried');
  a.rp.peerDeath({ id: 'bob', acct: null, look: LOOK }, { x: 3, y: 0, z: 0 }, 'world:1,1', { intro: true });
  assert.equal(a.rp.corpseMarks().length, 1, 'one body - not a second laid over it');
  assert.equal(a.heard.length, 1, 'and no second cry');
  // A2: a party mate's body the party pose laid (PCORPSE3), then its cell's roster names the death - by the account
  const b = corpses();
  b.rp.partyBody('acct-b', 'bob', LOOK, { k: 'world:1,1', x: 3, y: 0, z: 0, at: 1 }, true);
  b.rp.peerDeath({ id: 'bob', acct: 'acct-b', look: LOOK }, { x: 3.2, y: 0, z: 0.1 }, 'world:1,1', { intro: true });
  assert.equal(b.rp.corpseMarks().length, 1, 'the party\'s body is the roster\'s');
  // an introduction where none lies is laid, quietly
  const c = corpses();
  c.rp.peerDeath({ id: 'carl', acct: null, look: LOOK }, { x: 3, y: 0, z: 0 }, 'world:1,1', { intro: true });
  assert.deepEqual([c.rp.corpseMarks().length, c.heard.length], [1, 0], 'a body already lying when I came: laid, its cry cried before');
  // and one of the same person's somewhere else is another body (died, rose, died again)
  c.rp.peerDeath({ id: 'carl', acct: null, look: LOOK }, { x: 40, y: 0, z: 0 }, 'world:1,1', { intro: true });
  assert.equal(c.rp.corpseMarks().length, 2, 'another place, another body');
  // and someone else's body where theirs lies is someone else's
  c.rp.peerDeath({ id: 'dora', acct: null, look: LOOK }, { x: 3, y: 0, z: 0 }, 'world:1,1', { intro: true });
  assert.equal(c.rp.corpseMarks().length, 3, 'two fell on one spot: two bodies');
  // a death heard as it happens is always laid, beside a body of theirs or not
  c.rp.peerDeath({ id: 'carl', acct: null, look: LOOK }, { x: 40, y: 0, z: 0 }, 'world:1,1');
  assert.deepEqual([c.rp.corpseMarks().length, c.heard.length], [4, 1]);
});

// ── A4: AN OLD DEATH FELLED THE LIVING ─────────────────────────────────────────────────────────────────────────

test('AUDIT ONLINE 3 (the second read) A4: an introduction naming a death older than the newest pose heard from that peer (a relay still holding a ghost\'s socket) fells nobody', () => {
  const t = 1e6;
  const { s } = session({ now: () => t });
  const deaths = [];
  s.onPeerDeath = (peer, pose, room, how) => deaths.push([peer.id, pose.ts, !!how?.intro]);
  s._receive(JSON.stringify({ t: 'pose', id: 'bob-0002', p: { ...STILL, x: 9, mv: 1, ts: 34_500 } }), 'world:3,12');
  assert.equal(s.peers.has('bob-0002'), true, 'Bob walks');
  s._receive(JSON.stringify({ t: 'join', id: 'bob-0002', name: 'Bob', look: null, pose: { ...STILL, dd: 1, ts: 4000 } }), 'world:4,12');
  assert.equal(s.peers.has('bob-0002'), true, 'still walking - his death half a minute before his last step is over');
  assert.deepEqual(deaths, [], 'and no second body is laid');
  // a death newer than his last step is his death
  s._receive(JSON.stringify({ t: 'join', id: 'bob-0002', name: 'Bob', look: null, pose: { ...STILL, dd: 1, ts: 34_600 } }), 'world:4,12');
  assert.equal(s.peers.has('bob-0002'), false);
  assert.deepEqual(deaths, [['bob-0002', 34_600, true]]);
});

// ── A5: AN INTRODUCTION FROM BEFORE THE DEATH STOOD THE DEAD ───────────────────────────────────────────────────

test('AUDIT ONLINE 3 (the second read) A5: a roster composed before the death and landing after it stands nobody (F4\'s rule at the introductions\' door); one after it is a rise', () => {
  let t = 1e6;
  const { s } = session({ now: () => t });
  const deaths = [];
  s.onPeerDeath = (peer) => deaths.push(peer.id);
  s._receive(JSON.stringify({ t: 'pose', id: 'bob-0002', p: { ...STILL, mv: 1, ts: 100 } }), 'world:3,12');
  s._receive(JSON.stringify({ t: 'pose', id: 'bob-0002', p: { ...STILL, dd: 1, ts: 200 } }), 'world:3,12');
  assert.deepEqual(deaths, ['bob-0002']);
  t += 300;
  s._receive(JSON.stringify({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'bob-0002', name: 'Bob', look: null, pose: { ...STILL, mv: 1, ts: 150 } }], host: null, now: Date.now(), v: 'world212' }), 'world:4,12');
  assert.equal(s.peers.has('bob-0002'), false, 'the slower room\'s roster, from before he fell, stands nobody on his body');
  s._receive(JSON.stringify({ t: 'join', id: 'bob-0002', name: 'Bob', look: null, pose: { ...STILL, x: 50, ts: 900 } }), 'world:4,12');
  assert.equal(s.peers.has('bob-0002'), true, 'an introduction after the death is a rise');
  assert.deepEqual(deaths, ['bob-0002'], 'one death');
});

// ── THE PINS AUDIT ONLINE 3'S MUTANTS SHOWED LOOSE ─────────────────────────────────────────────────────────────

test('AUDIT ONLINE 3 (the second read) P2: the fallen are remembered to FALLEN_MAX, the oldest forgotten first - the Set\'s `values()` on a Map evicted nothing', () => {
  const { s } = session({ now: () => 1e6 });
  for (let i = 0; i <= FALLEN_MAX; i++) s._receive(JSON.stringify({ t: 'pose', id: `p-${String(i).padStart(4, '0')}`, p: { ...STILL, dd: 1, ts: 10 + i } }), 'world:3,12');
  assert.equal(s._fallen.size, FALLEN_MAX, 'bounded');
  assert.equal(s._fallen.has('p-0000'), false, 'the oldest forgotten');
  assert.equal(s._fallen.has(`p-${String(FALLEN_MAX).padStart(4, '0')}`), true, 'the newest kept');
});

test('AUDIT ONLINE 3 (the second read) P9: a standing peer introduced dead is laid in the look and the name it stood in', () => {
  const { s } = session({ now: () => 1e6 });
  const deaths = [];
  s.onPeerDeath = (peer) => deaths.push([peer.id, peer.name, peer.look?.class ?? null]);
  s._receive(JSON.stringify({ t: 'join', id: 'dan-0004', name: 'Dan', look: { race: 'Nord', gender: 'male', class: 'Warrior' }, pose: { ...STILL, ts: 1 } }), 'world:3,12');
  s._receive(JSON.stringify({ t: 'join', id: 'dan-0004', name: 'Dan', look: { race: 'Nord', gender: 'male', class: 'Warrior' }, pose: { ...STILL, dd: 1, ts: 2 } }), 'world:3,12');
  assert.deepEqual(deaths, [['dan-0004', 'Dan', 'Warrior']]);
});

test('AUDIT ONLINE 3 (the second read): a mint that answers lets its TOKEN_WAIT_MS timer go - one 8 s timer a connection was kept', async () => {
  const live = new Set();
  const realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout;
  globalThis.setTimeout = (fn, ms, ...a) => { const h = realSet(() => { live.delete(h); fn(...a); }, ms); live.add(h); return h; };
  globalThis.clearTimeout = (h) => { live.delete(h); realClear(h); };
  try {
    const { s } = session({ mintToken: async () => 'TOK' });
    const got = await s._mint('world:1,1');
    assert.deepEqual(got, { tok: 'TOK', why: null });
    assert.equal(live.size, 0, 'no timer left behind');
  } finally { globalThis.setTimeout = realSet; globalThis.clearTimeout = realClear; }
});

// ── B-F2-1: THE PAGE'S MINTER STAYED ON THE WALL CLOCK ─────────────────────────────────────────────────────────

test('AUDIT ONLINE 3 (the second read) B-F2-1: the page\'s token minter reads the sessions\' steady clock - a clock set back never holds a dead token fresh (every new room\'s hello refused "token expired", terminal)', async () => {
  assert.match(rd('src/scenes/world.js'), /const identityMinter = accountTokenMinter\(\{[^\n]*\bnow: steadyNow,/, 'the host hands its minter the sessions\' clock');
  // and why: on the steady clock a held token is reused TOKEN_REUSE_MS of real time, never for the length of a step back
  let wall = 1_700_000_000_000, n = 0;
  const store = new Map([[SESSION_KEY, JSON.stringify({ id: 'acct-1', name: 'Mac', kind: 'linked', sessionId: 's-1', secret: 'sekrit-of-mac' })]]);
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const fetch = async () => ({ ok: true, status: 200, json: async () => ({ token: `v1.${'a'.repeat(120)}.${String(++n).padStart(86, 'b')}`, name: 'Mac', kind: 'linked', expiresAt: 1 }) });
  const run = async (now) => {
    const mint = accountTokenMinter({ fetch, storage, now });
    const first = await mint('world:1,1');
    wall -= 3_600_000; now();   // the player fixes a clock an hour fast - and the page's next frame reads the clock
    wall += TOKEN_REUSE_MS + 1000;   // a minute and a second of real time on
    return [first, await mint('world:2,1')];
  };
  const [a1, a2] = await run(steadyClock(() => wall));
  assert.notEqual(a2, a1, 'a fresh token - the held one is past its reuse, whatever the wall says');
  const [b1, b2] = await run(() => wall);
  assert.equal(b2, b1, '(the wall clock reused the dead one - the bug the host\'s clock closes)');
});

// ── P1: THE PAGE'S CLOCK ITSELF ─────────────────────────────────────────────────────────────────────────────────

test('AUDIT ONLINE 3 (the second read) P1: the page\'s own clock (steadyNow, every session\'s default) never steps back - AUDIT ONLINE 3 pinned that a session reads it, never that it is steady', () => {
  const realNow = Date.now;
  let wall = realNow() + 10_000;   // ahead of any reading this process has made
  Date.now = () => wall;
  try {
    const a = steadyNow();
    wall -= 3_600_000;   // the machine's clock set back an hour
    const b = steadyNow();
    assert.ok(b >= a, 'held, never back');
    wall += 1000;
    assert.equal(steadyNow(), b + 1000, 'and walks on from there');
  } finally { Date.now = realNow; }
});
