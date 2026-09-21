// SLAM12 (2026-09-16, AUDIT SLAM over SLAM1..SLAM7): THE CLIENT'S HYGIENE - five findings, each small, each real.
//
// ONE: SLAM2's first retry had a jitter span of exactly ZERO. `_backoff` starts at BACKOFF_MIN_MS, so
// `_backoff - BACKOFF_MIN_MS` was 0 on the first retry and `rand()` was multiplied by nothing. Measured over 200
// sessions dropped in one instant: one distinct return instant. The jitter began on the SECOND retry, and a wave
// collides on the first. The span's floor is now BACKOFF_MIN_MS: round one is uniform over [1 s, 2 s].
//
// TWO: `_backoff` was reset when the socket OPENED - and a full room's CLOSE_BUSY arrives after it opens (the hello
// gate), so the reset undid the hard back-off CLOSE_BUSY had just set: a client against a busy room retried at a
// fixed 2500 ms for ever, and SLAM2's doubling never happened in the one case it was written for. It is reset by the
// WELCOME now - the relay saying yes - for the primary and for each halo.
//
// THREE: a TERMINAL close never forgot its room. 199 stale peers were eased by every tick and counted by poseHzFor
// for the life of the page. A plain drop still keeps them, on purpose: through a one-second blip the crowd stays
// drawn rather than vanishing and re-standing, and the reconnect's welcome merges over it.
//
// FOUR: `lookKey` re-stringified every peer's look every frame - ~64% of the client's per-frame peer work at 199
// dressed peers. A look object is replaced, never mutated, so a WeakMap on it is exactly the key's lifetime.
//
// FIVE: a doll that landed after its key was released - `_evict`, or `destroy()` at the page's hide - kept its GPU
// texture with nothing referencing it. Measured: sync fifty peers, destroy, fifty uploaded, none released.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OnlineSession, BACKOFF_MIN_MS, BACKOFF_MAX_MS } from '../src/net/online.js';
import { CLOSE_BUSY, CLOSE_REPLACED } from '../src/net/wire.js';
import { RemotePlayers, lookKey } from '../src/net/remotePlayers.js';
import { fakeSocketClass } from './fakeSocket.mjs';

const at = (x) => ({ x, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0 });
const look = { race: 'Nord', gender: 'male', faceIndex: 0, items: [{ templateIndex: 3, group: 'Armor', equipSlot: 1 }] };

test('SLAM12: the FIRST retry is spread over a real window - 200 sessions dropped together come back at 200 different instants inside [1 s, 2 s] (mutant: the zero span, SLAM2 as shipped)', () => {
  const instants = new Set(); let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < 200; i++) {
    const { FakeWS, sockets } = fakeSocketClass();
    let seed = i * 7919 + 1; const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'M', id: `mac-${String(i).padStart(4, '0')}`, secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => 1_000_000, rand });
    s.join('town:m1', at(0)); sockets[0].open(); sockets[0].drop(1006);   // opened and dropped: a relay restart, a DO eviction
    const delay = s._retryAt - 1_000_000;
    instants.add(delay); lo = Math.min(lo, delay); hi = Math.max(hi, delay);
  }
  assert.ok(instants.size >= 190, `200 clients, ${instants.size} distinct return instants - not one`);
  assert.ok(lo >= BACKOFF_MIN_MS && hi <= 2 * BACKOFF_MIN_MS, `all inside [${BACKOFF_MIN_MS}, ${2 * BACKOFF_MIN_MS}] (saw ${lo}..${hi})`);
  assert.ok(hi - lo > BACKOFF_MIN_MS / 2, 'and spread over most of the window');
});

test('SLAM12: and a HALO\'s first retry is spread the same way - 200 seam sockets dropped together come back at 200 instants (mutant: the halo close-path span left at zero, which survived every other pin - eight rooms a client, all phase-locked)', () => {
  const instants = new Set(); let lo = Infinity, hi = -Infinity;
  const info = console.info; console.info = () => {};
  try {
    for (let i = 0; i < 200; i++) {
      const { FakeWS, sockets } = fakeSocketClass();
      let seed = i * 104729 + 3; const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      const s = new OnlineSession({ url: 'wss://relay.test', name: 'M', id: `mac-${String(i).padStart(4, '0')}`, secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => 1_000_000, rand });
      s.join('world:3,12', at(0)); sockets[0].open(); sockets[0].receive({ t: 'welcome', id: s.id, peers: [], host: null, world: null });
      s.setHalo(['world:2,12']); const hw = sockets[1]; hw.open();
      hw.drop(1006);   // the halo's socket dropped - the close path at the seam, not the primary's
      const delay = s._halo.get('world:2,12').retryAt - 1_000_000;
      instants.add(delay); lo = Math.min(lo, delay); hi = Math.max(hi, delay);
    }
  } finally { console.info = info; }
  assert.ok(instants.size >= 190, `200 halos, ${instants.size} distinct return instants`);
  assert.ok(lo >= BACKOFF_MIN_MS && hi <= 2 * BACKOFF_MIN_MS, `all inside [${BACKOFF_MIN_MS}, ${2 * BACKOFF_MIN_MS}] (saw ${lo}..${hi})`);
  assert.ok(hi - lo > BACKOFF_MIN_MS / 2, 'and spread over most of the window');
});

test('SLAM12: and the THIRD halo path too - a halo that never opens is dropped past BACKOFF_MAX_MS (AUDIT WORLD6b-iii(b) A7) and its retry is spread (mutant: the tick-path span left at zero, which survived every other pin)', () => {
  const instants = new Set(); let lo = Infinity, hi = -Infinity;
  const info = console.info; console.info = () => {};
  try {
    for (let i = 0; i < 200; i++) {
      const { FakeWS, sockets } = fakeSocketClass();
      let now = 1_000_000;
      let seed = i * 7877 + 11; const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      const s = new OnlineSession({ url: 'wss://relay.test', name: 'M', id: `mac-${String(i).padStart(4, '0')}`, secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now, rand });
      s.join('world:3,12', at(0)); sockets[0].open(); sockets[0].receive({ t: 'welcome', id: s.id, peers: [], host: null, world: null });
      s.setHalo(['world:2,12']);   // minted, never opens
      now += BACKOFF_MAX_MS + 1; s.tick();   // past the longest backoff: dropped and scheduled
      const h = s._halo.get('world:2,12');
      assert.equal(h.ws, null, 'the stuck socket was let go');
      const delay = h.retryAt - now;
      instants.add(delay); lo = Math.min(lo, delay); hi = Math.max(hi, delay);
    }
  } finally { console.info = info; }
  assert.ok(instants.size >= 190, `200 stuck halos, ${instants.size} distinct return instants`);
  assert.ok(lo >= BACKOFF_MIN_MS && hi <= 2 * BACKOFF_MIN_MS, `all inside [${BACKOFF_MIN_MS}, ${2 * BACKOFF_MIN_MS}] (saw ${lo}..${hi})`);
});

test('SLAM12: and the FOURTH - a halo whose socket cannot even be constructed is retried on a spread window (mutant: the constructor-catch span left at zero; SLAM2 claimed this path, SLAM5 fixed it, nothing until now drove it)', () => {
  const instants = new Set(); let lo = Infinity, hi = -Infinity;
  const info = console.info; console.info = () => {};
  try {
    for (let i = 0; i < 200; i++) {
      const { FakeWS, sockets } = fakeSocketClass();
      class Flaky extends FakeWS { constructor(url) { if (url.includes('world:2,12')) throw new Error('no socket for you'); super(url); } }
      let seed = i * 6151 + 5; const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      const s = new OnlineSession({ url: 'wss://relay.test', name: 'M', id: `mac-${String(i).padStart(4, '0')}`, secret: 'secret-of-mac-0001', WebSocketImpl: Flaky, now: () => 1_000_000, rand });
      s.join('world:3,12', at(0)); sockets[0].open(); sockets[0].receive({ t: 'welcome', id: s.id, peers: [], host: null, world: null });
      s.setHalo(['world:2,12']);   // the constructor throws: the catch path schedules the retry
      const h = s._halo.get('world:2,12');
      assert.equal(h.ws, null); assert.equal(h.status, 'closed');
      const delay = h.retryAt - 1_000_000;
      instants.add(delay); lo = Math.min(lo, delay); hi = Math.max(hi, delay);
    }
  } finally { console.info = info; }
  assert.ok(instants.size >= 190, `200 unconstructable halos, ${instants.size} distinct return instants`);
  assert.ok(lo >= BACKOFF_MIN_MS && hi <= 2 * BACKOFF_MIN_MS, `all inside [${BACKOFF_MIN_MS}, ${2 * BACKOFF_MIN_MS}] (saw ${lo}..${hi})`);
});

test('SLAM12: the backoff is reset by the WELCOME, not by the socket opening - a busy room\'s refusals keep DOUBLING (mutant: the reset at onopen, which held a busy-room client at a fixed 2500 ms for ever)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'M', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now, rand: () => 0.5 });
  s.join('town:m1', at(0));
  const delays = [];
  for (let round = 0; round < 4; round++) {
    const ws = sockets.at(-1); ws.open();          // the room OPENS the socket...
    ws.drop(CLOSE_BUSY);                            // ...and refuses the hello: full
    delays.push(s._retryAt - now);                  // what matters is WHEN it comes back
    now = s._retryAt + 1; s.tick();                 // the retry fires and a new socket is minted
  }
  // rand = 0.5 throughout. Round one: CLOSE_BUSY lifts the backoff to BACKOFF_MAX_MS/2, the span is 3000, the delay
  // 1000 + 1500. Every later round: the backoff is at the ceiling (8000), the span 7000, the delay 1000 + 3500. Under
  // the mutant the open reset the backoff to BACKOFF_MIN_MS every round and every delay was the first one: 2500 for ever.
  assert.deepEqual(delays, [2500, 4500, 4500, 4500], 'CLOSE_BUSY: the wait GROWS across refusals, never undone by the open');
  assert.equal(s._backoff, BACKOFF_MAX_MS);
  // and a WELCOME starts the ladder over
  const ws = sockets.at(-1); ws.open();
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null });
  assert.equal(s._backoff, BACKOFF_MIN_MS, 'the relay said yes: back to the first rung');
});

test('SLAM12: a TERMINAL close forgets the room\'s peers; a plain drop keeps them drawn through the blip (mutants: forgotten on every close, which blanks the crowd for every hiccup; never forgotten, which eases 199 ghosts for the life of the page)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'M', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now });
  const info = console.info; console.info = () => {};
  try {
    s.join('town:m1', at(0)); sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: Array.from({ length: 30 }, (_, i) => ({ id: `p-${String(i).padStart(4, '0')}`, name: 'P', look, pose: at(i) })), host: null, world: null });
    assert.equal(s.peers.size, 30);
    sockets[0].drop(1006);
    assert.equal(s.peers.size, 30, 'a plain drop: the crowd stays where it was drawn, the reconnect will merge');
    now = s._retryAt + 1; s.tick(); sockets[1].open();
    sockets[1].receive({ t: 'welcome', id: 'mac-0001', peers: Array.from({ length: 30 }, (_, i) => ({ id: `p-${String(i).padStart(4, '0')}`, name: 'P', look, pose: at(i) })), host: null, world: null });
    assert.equal(s.peers.size, 30);
    sockets[1].drop(CLOSE_REPLACED);
    assert.equal(s.terminal, true);
    assert.equal(s.peers.size, 0, 'a terminal close: no reconnect is coming, and nothing is left to ease');
  } finally { console.info = info; }
});

test('SLAM12: lookKey is memoised on the look OBJECT - the same object is never stringified twice, a different object with the same fields agrees, and a null look still keys (mutant: the memo removed)', () => {
  const a = { ...look, items: [{ ...look.items[0] }] };
  const k1 = lookKey(a);
  const spy = JSON.stringify; let calls = 0; JSON.stringify = (...args) => { calls++; return spy(...args); };
  try {
    for (let i = 0; i < 1000; i++) lookKey(a);
    assert.equal(calls, 0, 'a thousand reads of one look object: not one stringify');
    assert.equal(lookKey(a), k1);
  } finally { JSON.stringify = spy; }
  assert.equal(lookKey({ ...look, items: [{ ...look.items[0] }] }), k1, 'a different object with the same fields is the same key');
  assert.equal(lookKey(null), 'Breton|male|0|[]'); assert.equal(lookKey(undefined), lookKey(null), 'the look-less doll every stranger shares');
});

test('SLAM12: a doll that lands after its key was released frees its texture - destroy() at the page\'s hide orphans nothing (mutant: the early return without the release, fifty textures leaked)', async () => {
  let uploaded = 0, released = 0;
  const rp = new RemotePlayers({
    renderer: { uploadTexture: () => { uploaded++; }, releaseTexture: () => { released++; }, createBillboardBatch: () => ({}), destroyBillboardBatch: () => {} },
    deps: {}, compose: async () => ({ rgba: new Uint8Array(64).fill(255), width: 4, height: 4 }), now: () => 1000,
  });
  const peers = Array.from({ length: 50 }, (_, i) => ({ id: `p${i}`, look: { ...look, faceIndex: i % 9, items: [{ ...look.items[0], templateIndex: i }] }, shown: at(i) }));
  rp.sync(peers);                 // fifty composes queued
  rp.destroy();                   // the page hides before any of them land
  for (let k = 0; k < 400; k++) { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); }
  assert.equal(uploaded, 50, 'every compose still ran to the upload');
  assert.equal(released, 50, 'and every texture that landed after the teardown was released');
  assert.equal(rp._dolls.size, 0);
});
