// SLAM14 (2026-09-16, AUDIT SLAM FINAL): THE FINAL LENS'S CLIENT FINDINGS - lens B's "ready with one clause", the
// clause and its neighbours paid.
//
// B1 `heardIn` was stamped ONCE, on the pose that stood a stranger, so a peer first heard through my own cell and
// since heard only through a halo was asked for down the cell's socket, where the relay no longer holds it. It
// follows the poses now.
//
// B2 (= lens C's C4) A RECONNECT'S WELCOME BLANKED THE ROOM. The roster names the nearest ROSTER_MAX, and the welcome
// handler `_unmember`ed everyone it did not name - measured, 135 of 199 - to be re-stood a round trip later by their
// next pose. A welcome says who is NEAR, not who is HERE: the unnamed are kept and stamped `unconfirmed` for that
// room; a pose or join there confirms; one silent past PEER_TIMEOUT_MS goes, the moment the silence law would have
// hidden it anyway. Nobody present blinks; a peer that left while I was away is pruned.
//
// B3 A REMEMBERED LOOK WAS NEVER REFRESHED. SLAM9 stands a re-met peer in the look it wore, told, and the comment said
// "a peer that changes its gear re-hellos" - nothing re-hellos on a gear change; a look rides the hello alone. A
// peer stood from memory is `recall`: told (drawn dressed, its bodies stood), and asked for once more so the relay's
// join brings the look it holds now.
//
// B6 `lookKey(null)` recomputed its string on every call; one constant.
//
// And two of lens C's unpinned survivors: the HALO welcome resets the halo's backoff (SLAM12 pinned the primary's
// alone), and the late-landing doll's texture is released with the ARCHIVE and the RECORD (`dollFor`'s then).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OnlineSession, PEER_TIMEOUT_MS, BACKOFF_MIN_MS, BACKOFF_MAX_MS } from '../src/net/online.js';
import { WHO_HZ_MAX, WHO_RETRY_MS, RELAY_VERSION, CLOSE_BUSY } from '../src/net/wire.js';
import { RemotePlayers, lookKey, PEER_ARCHIVE } from '../src/net/remotePlayers.js';
import { fakeSocketClass } from './fakeSocket.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const at = (x, z = 0) => ({ x, y: 0, z, yaw: 0, pitch: 0, mv: 0 });
const look = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
const whos = (ws) => ws.sent.filter((f) => typeof f === 'string' && f.startsWith('{"t":"who"')).map((f) => JSON.parse(f).id);
const ids = (p, n) => Array.from({ length: n }, (_, i) => `${p}-${String(i).padStart(4, '0')}`);

function session(room, peers, clock) {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock.now, rand: () => 0.5 });
  s.join(room, at(0)); const ws = sockets[0]; ws.open();
  ws.receive({ t: 'welcome', id: 'mac-0001', v: RELAY_VERSION, peers: peers.map((id, i) => ({ id, name: `K${i}`, look, pose: at(i) })), host: null, world: null });
  return { s, ws, sockets };
}
const quiet = (fn) => { const info = console.info; console.info = () => {}; try { return fn(); } finally { console.info = info; } };

test('SLAM14 B2: a welcome that does not name a peer KEEPS it, unconfirmed - nobody present blinks on a reconnect (mutant: the pre-SLAM14 `_unmember`, which dropped 135 of 199 on every blip)', () => quiet(() => {
  const clock = { now: 1_000_000 };
  const { s, ws } = session('town:m1', ids('kn', 64), clock);
  const rest = ids('st', 135);
  for (const id of rest) ws.receive({ t: 'pose', id, p: at(1) });
  for (const [i, id] of rest.entries()) ws.receive({ t: 'join', id, name: `R${i}`, look, pose: at(1) });
  assert.equal(s.peers.size, 199);
  clock.now += 3000;
  // THE BLIP: the socket drops and the reconnect's welcome names the nearest 64
  ws.drop(1006); clock.now += BACKOFF_MAX_MS; s.tick();
  const ws2 = s._ws; ws2.open();
  ws2.receive({ t: 'welcome', id: 'mac-0001', v: RELAY_VERSION, peers: ids('kn', 64).map((id, i) => ({ id, name: `K${i}`, look, pose: at(i) })), host: null, world: null });
  assert.equal(s.peers.size, 199, 'everyone still stands - the welcome is who is NEAR, not who is HERE');
  assert.equal(s.drawable().length, 199, 'and everyone is still drawn: no blink');
  assert.equal([...s.peers.values()].filter((p) => p.unconfirmed).length, 135, 'the 135 the roster did not name are unconfirmed for this room');
  assert.deepEqual(Object.keys(s.peers.get('st-0007').unconfirmed), ['town:m1']);
  assert.equal(s.peers.get('st-0007').told, true, 'still told - still dressed, its bodies still stood');
  // a pose from one confirms it; a join confirms another; a leave answers for a third
  clock.now += 500;
  ws2.receive({ t: 'pose', id: 'st-0007', p: at(2) }); assert.equal(s.peers.get('st-0007').unconfirmed, null, 'a pose in this room confirms');
  ws2.receive({ t: 'join', id: 'st-0008', name: 'R8', look, pose: at(2) }); assert.equal(s.peers.get('st-0008').unconfirmed, null, 'a join confirms');
  ws2.receive({ t: 'leave', id: 'st-0009' }); assert.equal(s.peers.has('st-0009'), false, 'a leave takes at once');
  // the rest, silent: gone when the silence law hides them, not before
  clock.now = s.peers.get('st-0010').seenAt + PEER_TIMEOUT_MS; s.tick();
  assert.equal(s.peers.size, 198, 'at the timeout nobody is dropped - the silence law is `>`, and so is this');
  assert.equal(s.visible(s.peers.get('st-0010')), true, 'still visible, exactly as long as the silence law shows it');
  clock.now += 1; s.tick();
  assert.equal(s.peers.size, 64 + 2, 'past it, the 132 that never spoke again are gone; the two confirmed stay');
  assert.ok(s.peers.has('st-0007') && s.peers.has('st-0008'));
}));

test('SLAM14 B2: unconfirmed is PER ROOM - a peer named by my cell\'s roster and unnamed by a halo\'s stays in the cell, and leaves the halo alone; a pose through the halo confirms it there (mutant: one flag for all rooms)', () => quiet(() => {
  const clock = { now: 1_000_000 };
  const { s, ws, sockets } = session('world:3,12', ['ann-0004'], clock);
  s.setHalo(['world:2,12']); const hw = sockets[1]; hw.open();
  hw.receive({ t: 'welcome', id: 'mac-0001', v: RELAY_VERSION, peers: [{ id: 'ann-0004', name: 'Ann', look, pose: at(1) }, { id: 'eve-0003', name: 'Eve', look, pose: at(1) }], host: null, world: null });
  assert.deepEqual([...s._rooms.get('world:2,12')].sort(), ['ann-0004', 'eve-0003']);
  hw.receive({ t: 'welcome', id: 'mac-0001', v: RELAY_VERSION, peers: [{ id: 'eve-0003', name: 'Eve', look, pose: at(1) }], host: null, world: null });
  assert.deepEqual(Object.keys(s.peers.get('ann-0004').unconfirmed), ['world:2,12'], 'unconfirmed in the halo alone');
  clock.now += PEER_TIMEOUT_MS + 1; ws.receive({ t: 'pose', id: 'ann-0004', p: at(5) }); s.tick();
  assert.equal(s.peers.has('ann-0004'), true, 'heard in my cell: kept');
  assert.deepEqual(Object.keys(s.peers.get('ann-0004').unconfirmed), ['world:2,12'], 'but a pose in my cell says nothing about the halo');
  hw.receive({ t: 'pose', id: 'ann-0004', p: at(5) });
  assert.equal(s.peers.get('ann-0004').unconfirmed, null, 'a pose through the halo confirms her there');
  // silent everywhere past the timeout, unconfirmed in one room: gone from THAT room, kept while my cell holds her
  hw.receive({ t: 'welcome', id: 'mac-0001', v: RELAY_VERSION, peers: [], host: null, world: null });
  clock.now += PEER_TIMEOUT_MS + 1; s.tick();
  assert.equal(s._rooms.get('world:2,12').has('ann-0004'), false, 'out of the halo\'s roster');
  assert.equal(s.peers.has('ann-0004'), true, 'still my cell\'s peer (held there, silence law aside)');
}));

test('SLAM14 B3: a peer stood from MEMORY is told and RECALLED - drawn in the look it wore, asked for once more, and the relay\'s answer refreshes the look (mutants: recall never set; the ask guard refusing every told peer; `_refresh` not clearing it)', () => quiet(() => {
  const clock = { now: 1_000_000 };
  const { s, ws } = session('town:m1', [], clock);
  ws.receive({ t: 'join', id: 'zed-0001', name: 'Zed', look: { ...look, faceIndex: 3 }, pose: at(1) });
  ws.receive({ t: 'leave', id: 'zed-0001' });
  assert.equal(s.peers.has('zed-0001'), false);
  clock.now += 1000;
  ws.receive({ t: 'pose', id: 'zed-0001', p: at(2) });   // back, from memory
  const z = s.peers.get('zed-0001');
  assert.equal(z.told, true, 'told: dressed and stood at once'); assert.equal(z.look.faceIndex, 3, 'in the face it wore');
  assert.equal(z.recall, true, 'and marked to be asked once more');
  s.tick(); assert.deepEqual(whos(ws), ['zed-0001'], 'asked, though told');
  s.tick(); assert.deepEqual(whos(ws), ['zed-0001'], 'once - inside WHO_RETRY_MS it is not asked again');
  ws.receive({ t: 'join', id: 'zed-0001', name: 'Zed', look: { ...look, faceIndex: 5 }, pose: at(2) });   // the relay's answer: new gear
  assert.equal(z.look.faceIndex, 5, 'the look it holds NOW'); assert.equal(z.recall, false, 'the recall is spent');
  clock.now += WHO_RETRY_MS + 1; s.tick();
  assert.deepEqual(whos(ws), ['zed-0001'], 'and never asked again');
  assert.doesNotMatch(rd('src/net/online.js'), /changes its gear re-hellos/, 'the false line is gone: nothing re-hellos on a gear change');
}));

test('SLAM14 B1: `heardIn` follows the poses - a stranger first heard in my cell and since heard through a halo is asked for down the HALO\'s socket (mutant: stamped once, on the first pose, so the ask went to a room that no longer held it)', () => quiet(() => {
  const clock = { now: 1_000_000 };
  const { s, ws, sockets } = session('world:3,12', [], clock);
  s.setHalo(['world:2,12']); const hw = sockets[1]; hw.open();
  hw.receive({ t: 'welcome', id: 'mac-0001', v: RELAY_VERSION, peers: [], host: null, world: null });
  ws.receive({ t: 'pose', id: 'str-0001', p: at(1) });
  assert.equal(s.peers.get('str-0001').heardIn, 'world:3,12');
  hw.receive({ t: 'pose', id: 'str-0001', p: at(2) });   // walked over the seam: heard through the halo now
  assert.equal(s.peers.get('str-0001').heardIn, 'world:2,12', 'the latest pose\'s room');
  s.tick();
  assert.deepEqual(whos(hw), ['str-0001'], 'asked down the halo\'s socket'); assert.deepEqual(whos(ws), [], 'not my cell\'s');
}));

test('SLAM14 (lens C survivor): the HALO\'s welcome resets the halo\'s backoff, as SLAM12 made the primary\'s (mutant: the halo reset dropped - a halo against a busy room stayed at the top rung after it was let in)', () => quiet(() => {
  const clock = { now: 1_000_000 };
  const { s, sockets } = session('world:3,12', [], clock);
  s.setHalo(['world:2,12']);
  // driven up the ladder: CLOSE_BUSY thrice
  for (let k = 0; k < 3; k++) { const hw = sockets.at(-1); hw.open(); hw.drop(CLOSE_BUSY, 'busy'); clock.now += BACKOFF_MAX_MS + 1; s.tick(); }
  const h = s._halo.get('world:2,12');
  assert.ok(h.backoff > BACKOFF_MIN_MS, `up the ladder (${h.backoff})`);
  const hw = sockets.at(-1); hw.open();
  assert.ok(s._halo.get('world:2,12').backoff > BACKOFF_MIN_MS, 'opening alone does not reset it (SLAM12: CLOSE_BUSY arrives after open)');
  hw.receive({ t: 'welcome', id: 'mac-0001', v: RELAY_VERSION, peers: [], host: null, world: null });
  assert.equal(s._halo.get('world:2,12').backoff, BACKOFF_MIN_MS, 'the relay said yes: back to the first rung');
}));

test('SLAM14 B6 + (lens C survivor): `lookKey(null)` is one constant, and a doll landing after its key was released gives its texture back to the ARCHIVE by its RECORD (mutants: the release with no arguments; the release dropped)', async () => {
  assert.equal(lookKey(null), lookKey(undefined)); assert.equal(lookKey(null), lookKey(0));
  assert.equal(lookKey(null), lookKey({ race: 'Breton', gender: 'male', faceIndex: 0, items: [] }), 'the look-less peer wears the default');
  assert.match(rd('src/net/remotePlayers.js'), /const NULL_LOOK_KEY = _computeLookKey\(null\);/, 'computed once');
  const released = [];
  let resolveCompose;
  const rp = new RemotePlayers({
    renderer: { uploadTexture: () => {}, releaseTexture: (...a) => released.push(a), createBillboardBatch: () => ({}), destroyBillboardBatch: () => {} },
    deps: {}, compose: () => new Promise((res) => { resolveCompose = res; }), now: () => 1000,
  });
  const p = rp.dollFor(look);
  assert.ok(p && typeof p.then === 'function', 'composing');
  await new Promise((r) => setTimeout(r, 0));   // the queue reaches `_compose`, which is now waiting on us
  assert.equal(typeof resolveCompose, 'function', 'composing, really');
  rp.destroy();   // the page hid before the doll landed
  resolveCompose({ rgba: new Uint8Array(64).fill(255), width: 4, height: 4 });
  await p; await new Promise((r) => setTimeout(r, 0));
  assert.equal(released.length, 1, 'the orphan is released');
  assert.equal(released[0][0], PEER_ARCHIVE, 'to the peer archive');
  assert.equal(typeof released[0][1], 'string', 'by its record');
});
