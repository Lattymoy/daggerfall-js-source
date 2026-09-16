// SLAM2 (2026-09-16, Mac: Daggerfall's 30th, a streamer's server slam): THE RETRY IS JITTERED.
//
// A room admits HELLO_HZ_MAX hellos a second and refuses the rest with CLOSE_BUSY. That is correct. What was not is
// that every client refused in the same instant then waited the SAME `_backoff` and came back in the same instant -
// so a wave stayed a wave, re-colliding at 1s, 2s, 4s, 8s, and each collision spent the room's hello budget on
// frames it had to refuse instead of on players it could have admitted. A stream saying "everyone go here now" is
// precisely a phase-locked wave.
//
// WHAT THIS FILE DOES NOT CLAIM. The obvious pin - drive 300 real sessions at the real Room and watch the wave
// drain faster - CANNOT BE WRITTEN against `test/fakeRoom.mjs`, and finding that out is worth more than the pin
// would have been: the fake Durable Object does not model the runtime's INPUT GATING, so 300 concurrent hellos all
// read the same `hellos` bucket before any write lands and every one of them is admitted. The gate looks like it
// does nothing, which is an artefact of the fake and not the truth about production. So what is pinned here is the
// CLIENT's own arithmetic, which is the part this slice actually changed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OnlineSession, BACKOFF_MIN_MS, BACKOFF_MAX_MS } from '../src/net/online.js';
import { CLOSE_BUSY } from '../src/net/wire.js';
import { fakeSocketClass } from './fakeSocket.mjs';
import { readFileSync } from 'node:fs';

const pose = () => ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0 });

/** One client that joins a room and is refused as a full room refuses it. `rand` is the jitter's source. */
function refused(rand, { now = () => 1000 } = {}) {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now, rand });
  s.join('town:m9', pose());
  sockets[0].open();
  sockets[0].drop(CLOSE_BUSY, 'busy');
  return s;
}

test('SLAM2: a refused client comes back INSIDE its window, never at the end of it - and never sooner than the floor (mutant: now + backoff, which is what put every client back on the wire in the same instant)', () => {
  const early = refused(() => 0);
  const late = refused(() => 1);
  assert.equal(early._retryAt, 1000 + BACKOFF_MIN_MS, 'the floor: a jittered retry is never an instant one');
  assert.ok(late._retryAt > early._retryAt, 'and the far end of the window is later than the near end');
  // the window is the backoff CLOSE_BUSY set, which is a hard one - a full room is not retried in a second
  assert.ok(late._retryAt - 1000 >= BACKOFF_MAX_MS / 2, 'a busy room still backs off hard');
  for (const r of [0.25, 0.5, 0.75]) {
    const s = refused(() => r);
    assert.ok(s._retryAt > early._retryAt && s._retryAt < late._retryAt, `${r} lands inside the window`);
  }
});

test('SLAM2: A WAVE STOPS BEING A WAVE - three hundred clients refused in the SAME instant come back spread across the window, where before they came back together (mutant: the un-jittered retry, which puts all three hundred in one millisecond)', () => {
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const N = 300;
  const when = [];
  for (let i = 0; i < N; i++) when.push(refused(rnd)._retryAt - 1000);
  const distinct = new Set(when.map((w) => Math.round(w / 100))).size;   // 100ms buckets: how many moments is the wave spread over?
  assert.ok(distinct >= 20, `the wave is spread over ${distinct} distinct moments, not massed into a few`);
  // the worst single moment holds a small fraction of the crowd, not the crowd
  const counts = new Map();
  for (const w of when) { const b = Math.round(w / 100); counts.set(b, (counts.get(b) ?? 0) + 1); }
  const worst = Math.max(...counts.values());
  assert.ok(worst < N / 8, `the busiest 100ms holds ${worst} of ${N} - a wave would put all ${N} there`);
  // every one of them is still inside the law's bounds
  assert.ok(Math.min(...when) >= BACKOFF_MIN_MS && Math.max(...when) <= BACKOFF_MAX_MS, 'and none escaped the window');
  // THE CONTRAST, run through the same door: no jitter is one moment for everybody
  const lock = [];
  for (let i = 0; i < N; i++) lock.push(refused(() => 1)._retryAt - 1000);
  assert.equal(new Set(lock).size, 1, 'the premise: without a spread every client returns in the very same millisecond');
});

test('SLAM2: the backoff still DOUBLES, so a relay that is genuinely down is not hammered - the jitter spreads the window, it does not shrink it (mutant: a fixed window, which is a retry storm against an outage)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now: () => now, rand: () => 1 });
  s.join('town:m9', pose());
  const seen = [];
  for (let i = 0; i < 5; i++) {
    const ws = sockets[sockets.length - 1];
    // NOT opened: a socket that never reaches the relay. `onopen` resets the backoff to the floor (it is reset on the
    // socket opening, not on the welcome landing), so opening here would reset the very thing under test.
    ws.drop(1006, 'gone');
    seen.push(s._retryAt - now);
    now = s._retryAt;
    s.tick();
  }
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1], `window ${i} is no shorter than the last (${seen.join(', ')})`);
  assert.ok(seen.at(-1) >= BACKOFF_MAX_MS / 2, 'and it reaches the ceiling');
});

test('SLAM2: the jitter is INJECTED like the clock, so nothing in the port reaches for Math.random behind a test\'s back (mutant: Math.random inline, which makes the wave law unpinnable)', () => {
  const src = readFileSync(new URL('../src/net/online.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  assert.match(src, /rand = Math\.random/, 'the default is the real one, named at the door');
  assert.match(src, /this\._rand = rand;/);
  // the retry arithmetic reaches for the INJECTED source and never the global - the two other Math.random uses in
  // this module mint the tab's id and its secret, which are nobody's business to seed
  // the DECLARATION, not the first call site - slicing from `indexOf` landed in `_open`'s call and read the wrong
  // function entirely, which is the boundary trap AUDIT INV2 paid for once already
  const decl = /_scheduleRetry\(\)\s*\{/.exec(src);
  assert.ok(decl, 'the retry has a body to read');
  const retry = src.slice(decl.index, decl.index + 400);
  assert.match(retry, /this\._rand\(\)/, 'the retry uses the injected jitter');
  assert.doesNotMatch(retry, /Math\.random/, 'and never the global directly');
  for (const m of src.matchAll(/Math\.random/g)) {
    const line = src.slice(src.lastIndexOf('\n', m.index) + 1, src.indexOf('\n', m.index));
    assert.ok(/rand = Math\.random|toString\(36\)/.test(line), `an unexpected Math.random: ${line.trim().slice(0, 80)}`);
  }
});
