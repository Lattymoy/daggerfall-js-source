// RUN-IN-PLACE (2026-10-06, Mac: "I think the newly integrated spell effects are causing issues and theres a lot of player
// desync online, including players appearing to run in place"): A BODY WALKS WHILE IT IS DRAWN WALKING. Every on-foot
// renderer - the Morrowind bodies, the class sprites, the Eye Of The Beholder walkers, the beasts - and the peers'
// footsteps take their stride off the drawn pose's `mv` (net/peerClimb.js peerMoving), and the play-out (OnlineSession
// tick) stands a peer at the end of its path whenever the next pose is late, with the last pose's `mv` still on it. A
// sender's hitch, a tab put in the background, a reconnect, a stall on the line: the body ran and stepped in place - for
// as long as PEER_TIMEOUT_MS (80 s) when the poses stopped for good. AUDIT DISC7 B3 stood a RIDER whose poses stopped
// (a frozen gallop clopped in place); nobody on foot had that law. Now the drawn pose reads standing once the drawn place
// has not moved for SHOWN_MOVE_HOLD_MS - the sender's own hold (ONLINE_MOVE_HOLD_MS), so a gap shorter than it never
// restarts a stride - and the first drawn step after it walks again. Both play-outs: SCALE2b's timed and NET-SMOOTH's
// untimed fallback (an older relay strips the send time).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { PIXEL_UNITS, WORLD_CELL, POSE_TS_MOD } from '../src/net/wire.js';
import { OnlineSession, SHOWN_MOVE_HOLD_MS, PEER_TIMEOUT_MS } from '../src/net/online.js';

const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };

/** Mac watching Eve: a real session over a fake socket on a fake clock, ticked every 10 ms (a frame), Eve's poses
 *  reaching him `delay` ms after they were said, in order (one socket's frames are). `walk(ms, opts)` runs Eve's side: a
 *  pose every 100 ms (POSE_HZ) moving her +x at 5 m/s, `send(t)` saying whether she speaks at `t` (her own time), and
 *  answers what Mac drew each frame. `timed` false strips the send time (NET-SMOOTH's fallback). */
function watch({ timed = true, delay = 40 } = {}) {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { now: 1_700_000_000_000 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock.now });
  const cellX = 25, cellZ = 15, U = PIXEL_UNITS;
  const me = { x: (cellX * WORLD_CELL + 8) * U, y: 0, z: (cellZ * WORLD_CELL + 8) * U, yaw: 0, pitch: 0, mv: 0 };
  s.join(`world:${cellX},${cellZ}`, me); sockets[0].open();
  let x = me.x + 400, t = 0, tail = 0;
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'eve-0003', name: 'Eve', look: null, pose: { ...me, x } }], host: null, world: null });
  const q = [];
  const walk = (ms, { send = () => true, mv = 1 } = {}) => {
    const drawn = [];
    for (let k = 0; k < ms; k += 10) {
      clock.now += 10; t += 10;
      if (t % 100 === 0) {
        if (mv) x += 20;   // 5 m/s at 40 units a metre
        if (send(t)) {
          const p = { ...me, x, mv, ...(timed ? { ts: (5_000_000 + t) % POSE_TS_MOD } : {}) };
          const at = Math.max(clock.now + delay, tail); tail = at;
          q.push({ at, frame: { t: 'pose', id: 'eve-0003', p } });
        }
      }
      while (q.length && q[0].at <= clock.now) sockets[0].receive(q.shift().frame);
      s.tick();
      const e = s.peers.get('eve-0003').shown;
      drawn.push({ x: e.x, mv: e.mv });
    }
    return drawn;
  };
  return { walk, s, clock };
}
/** Frames drawn in place (the drawn x unchanged from the frame before) while reading moving: running in place. */
const inPlace = (d) => d.filter((f, i) => i > 0 && f.x === d[i - 1].x && f.mv).length;
const holdFrames = Math.ceil(SHOWN_MOVE_HOLD_MS / 10) + 1;

/** A peer whose poses STOP while it walks - a tab put in the background - stands where it was last drawn. */
function stopsWhileWalking(timed) {
  const w = watch({ timed });
  const steady = w.walk(2000).slice(40);
  assert.equal(inPlace(steady), 0, 'walking steadily, never drawn in place');
  assert.ok(steady.every((f) => f.mv === 1), 'and always read moving');
  // she stops speaking - her tab in the background - with her last pose a moving one
  const gone = w.walk(3000, { send: () => false });
  const stood = gone.findIndex((f, i) => i > 0 && f.x === gone[i - 1].x);
  assert.ok(stood > 0, 'the drawn body comes to the end of what was said and stands');
  assert.ok(inPlace(gone) <= holdFrames, `drawn in place reading moving for ${inPlace(gone)} frames - at most the hold's ${holdFrames} (it was all ${gone.length - stood} of them)`);
  assert.ok(gone.slice(-100).every((f) => f.mv === 0), 'and reading standing for the rest of her silence');
  // she comes back and walks on: the body walks again
  const back = w.walk(1500);
  const step = back.findIndex((f, i) => i > 0 && f.x !== back[i - 1].x);
  assert.ok(step > 0, 'drawn walking again');
  assert.equal(back[step].mv, 1, 'and the first drawn step reads moving');
  assert.equal(inPlace(back.slice(step)), 0, 'with nothing drawn in place after it');
}
/** A gap shorter than the hold keeps the stride. */
function shortGapKeepsStride(timed) {
  const w = watch({ timed });
  w.walk(1000);
  // her frame hitches once a second: the pose that falls in it is never said (her loop was not running)
  const d = w.walk(4000, { send: (t) => t % 1000 !== 500 });
  assert.ok(d.some((f, i) => i > 0 && f.x === d[i - 1].x), 'the hitch stands the drawn body a moment');
  assert.ok(d.every((f) => f.mv === 1), 'and it is never read standing for it');
}
const STOPS = 'a peer whose poses STOP while it walks - a tab put in the background - stands where it was last drawn: its drawn pose reads moving for no longer than SHOWN_MOVE_HOLD_MS after the drawn place stopped, and standing for the rest; the first drawn step after it walks again (mutants: the stand removed; the hold ten times as long; the first step not read as one)';
const GAP = 'a gap shorter than the hold keeps the stride - a pose lost to the sender\'s hitch once a second stands the drawn body a moment and never reads it standing, so no walk cycle starts over (ONLINE-MVFLICKER1); a steady walk is never stood at all (mutants: the hold at nothing; a coordinate the walk moves in not read)';

test(`RUN-IN-PLACE timed (SCALE2b): ${STOPS}`, () => quiet(() => stopsWhileWalking(true)));
test(`RUN-IN-PLACE untimed (NET-SMOOTH): ${STOPS}`, () => quiet(() => stopsWhileWalking(false)));
test(`RUN-IN-PLACE timed (SCALE2b): ${GAP}`, () => quiet(() => shortGapKeepsStride(true)));
test(`RUN-IN-PLACE untimed (NET-SMOOTH): ${GAP}`, () => quiet(() => shortGapKeepsStride(false)));

test('RUN-IN-PLACE: one home - the drawn pose the play-out makes is the one every on-foot body and the footsteps stride off (peerMoving reads its `mv`), and the hold is the sender\'s own; a body standing in its peer\'s silence is still drawn until PEER_TIMEOUT_MS, as before', () => {
  const src = readFileSync(new URL('../src/net/online.js', import.meta.url), 'utf8');
  assert.match(src, /const was = p\.drawn, s = poseAlong\(p\.path, p\.cur\);/, 'the drawn pose is made in tick (AUDIT 637 C1: against the place the law last drew)');
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /const ONLINE_MOVE_HOLD_MS = SHOWN_MOVE_HOLD_MS;/, 'the sender\'s hold IS the watcher\'s - one literal, net/online.js (AUDIT 637 D7)');
  const climb = readFileSync(new URL('../src/net/peerClimb.js', import.meta.url), 'utf8');
  assert.match(climb, /export const peerMoving = \(shown\) => !!shown\?\.mv && !peerClimbing\(shown\);/, 'a body strides off the drawn pose\'s mv');
  assert.ok(PEER_TIMEOUT_MS > SHOWN_MOVE_HOLD_MS * 100);
});
