// SLAM3 (2026-09-16, Mac: Daggerfall's 30th, a streamer's server slam): HOW OFTEN TO SPEAK IN A CROWD.
//
// SLAM1 bounded WHO hears a pose. This bounds HOW OFTEN one is said - the last of the three terms in a room's cost
// (senders x POSE_FAN_MAX x rate) still fixed, and the only one a client can lower without asking anybody.
//
// At 200 players in one room: 64,000 pose sends a second at 10 Hz, 25,600 at the crowded rate, against the 398,000
// an unbounded room wants. (AUDIT SLAM: this header first said 60,952 and carried CPU percentages. 60,952 was wrong
// - it matches no formula and contradicted SLAM1's own record - and the percentages counted the harness's parsing
// as relay work. These counts are arithmetic, N x min(N-1, FAN) x rate; nothing here was observed on a real relay.)
//
// THE EASE HAD TO MOVE WITH IT, and this is the half that would have been easy to miss. The receiver eased every
// peer over an assumed 1/POSE_HZ. That assumption was ALREADY wrong for anyone on a slow line or a throttled tab -
// the ease finished early and the peer stood still until its next pose, the stutter AUDIT MWBODY A8 names for the
// yaw - and slowing a crowded sender would have made it wrong for everybody at once. A peer is eased over the
// interval it is actually keeping now, so it walks rather than hops.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OnlineSession, POSE_HZ, POSE_HZ_MIN, POSE_CROWD, GAP_MIN_MS, GAP_MAX_MS, poseHzFor } from '../src/net/online.js';
import { POSE_FAN_MAX } from '../src/net/wire.js';
import { fakeSocketClass } from './fakeSocket.mjs';

const pose = (x, z = 0) => ({ x, y: 0, z, yaw: 0, pitch: 0, mv: 1 });

function open({ now }) {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now });
  s.join('town:m9', pose(0));
  sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', host: 'mac-0001', peers: [] });
  return { s, ws: sockets[0] };
}

test('SLAM3: AN ORDINARY ROOM IS UNTOUCHED - the Bay is two or three people and must not pay for an event it is not having (mutant: the curve applied from the first peer, which slows every normal session in the port)', () => {
  for (const n of [0, 1, 2, 5, 12, POSE_CROWD - 1, POSE_CROWD]) {
    assert.equal(poseHzFor(n), POSE_HZ, `${n} peers is not a crowd`);
  }
  assert.ok(POSE_CROWD > 8, 'the threshold is above any ordinary party');
});

test('SLAM3: past the crowd the rate comes DOWN and the product stays roughly flat - twice the crowd, half the rate, floored (mutants: no floor, so a big room stops moving; no ceiling on the fall; the rate rising with the crowd)', () => {
  assert.ok(poseHzFor(POSE_CROWD + 1) <= POSE_HZ);
  assert.equal(poseHzFor(POSE_CROWD * 2), POSE_HZ / 2, 'twice the crowd, half the rate');
  // never below the floor, however big it gets
  for (const n of [96, 200, 256, 4096]) assert.equal(poseHzFor(n), Math.max(POSE_HZ_MIN, poseHzFor(n)), `${n} respects the floor`);
  assert.equal(poseHzFor(100000), POSE_HZ_MIN, 'and it lands ON the floor rather than at zero');
  assert.ok(POSE_HZ_MIN >= 3, 'a walk below this reads as a series of hops however well it is eased');
  // monotonic: a bigger crowd is never spoken to MORE often
  let last = Infinity;
  for (let n = 1; n <= 300; n++) { const hz = poseHzFor(n); assert.ok(hz <= last, `rate rose at ${n}`); last = hz; }
  // and the room's whole cost is bounded by the three terms together
  assert.ok(256 * POSE_FAN_MAX * poseHzFor(256) < 256 * 255 * POSE_HZ / 5, 'a full room costs a small fraction of what it did');
});

test('SLAM3: sendPose really keeps the crowded interval - a session among two hundred speaks at the floor, not at POSE_HZ (mutant: the constant left in the guard, which is the whole slice undone)', () => {
  let now = 100000;
  const { s, ws } = open({ now: () => now });
  // alone: the ordinary rate
  assert.equal(s.sendPose(pose(1)), true);
  now += 1000 / POSE_HZ;
  assert.equal(s.sendPose(pose(2)), true, 'one interval later, at the ordinary rate');
  // now a crowd arrives
  ws.receive({ t: 'welcome', id: 'mac-0001', host: 'mac-0001', peers: Array.from({ length: 200 }, (_, i) => ({ id: `p${String(i).padStart(4, '0')}`, name: 'x', look: {}, pose: pose(i) })) });
  assert.ok(s.peers.size >= 200);
  const crowded = 1000 / poseHzFor(s.peers.size);
  now += 1000 / POSE_HZ;
  assert.equal(s.sendPose(pose(3)), false, 'the ordinary interval is no longer enough in a crowd');
  now += crowded - 1000 / POSE_HZ;
  assert.equal(s.sendPose(pose(4)), true, 'the crowded interval is');
});

test('SLAM3: a peer is eased over the interval IT keeps, so a slow sender walks instead of hopping (mutant: the assumed 1/POSE_HZ, which parks every crowded peer on its target between poses)', () => {
  let now = 100000;
  const { s, ws } = open({ now: () => now });
  ws.receive({ t: 'welcome', id: 'mac-0001', host: 'mac-0001', peers: [{ id: 'bob-0001', name: 'Bob', look: {}, pose: pose(0) }] });
  // Bob speaks at 4 Hz - 250ms between poses. The first interval is walked out with ticks, so he is really AT 10
  // when the second arrives; without that the ease would still be running from where he started and the midpoint
  // of this test would be arithmetic about the wrong pair.
  ws.receive({ t: 'pose', id: 'bob-0001', p: pose(10) });
  now += 250;
  s.tick();
  ws.receive({ t: 'pose', id: 'bob-0001', p: pose(20) });
  const p = s.peers.get('bob-0001');
  assert.equal(p.gap, 250, 'the interval he is actually keeping');
  // half way through HIS interval, he is half way there - not parked at the target
  now += 125;
  s.tick();
  assert.ok(p.shown.x > 12 && p.shown.x < 18, `mid-ease at ${p.shown.x}, not parked`);
  now += 125;
  s.tick();
  assert.ok(p.shown.x >= 19.9, 'and arrives at the end of his own interval');
});

test('SLAM3: the measured interval is bounded both ways, and a peer with no interval yet falls back to the default (mutants: an unbounded gap, so one late frame makes a peer crawl for ever; a zero gap, which snaps)', () => {
  let now = 100000;
  const { s, ws } = open({ now: () => now });
  ws.receive({ t: 'welcome', id: 'mac-0001', host: 'mac-0001', peers: [{ id: 'bob-0001', name: 'Bob', look: {}, pose: pose(0) }] });
  const p = s.peers.get('bob-0001');
  assert.equal(p.gap, undefined, 'nothing measured yet');
  s.tick();
  assert.ok(p.shown, 'and it still eases, on the default');
  // a burst: two poses in the same instant must not make the gap zero
  ws.receive({ t: 'pose', id: 'bob-0001', p: pose(1) });
  ws.receive({ t: 'pose', id: 'bob-0001', p: pose(2) });
  assert.ok(p.gap >= GAP_MIN_MS, `a burst floors at ${GAP_MIN_MS}, got ${p.gap}`);
  // a long silence must not make the next move crawl
  now += 60000;
  ws.receive({ t: 'pose', id: 'bob-0001', p: pose(3) });
  assert.equal(p.gap, GAP_MAX_MS, 'a silence ceilings at the bound, not a minute');
});
