// SLAM8 (2026-09-16, AUDIT SLAM over SLAM1..SLAM7): THE FAN'S TWO BLIND SPOTS, both of them SLAM6's.
//
// ONE: A KEEPALIVE MUST NEVER BE TIERED, AND IT WAS.
//
//   HEARTBEAT_MS (5000) x POSE_FAR_SHARE (4) = 20000 = PEER_TIMEOUT_MS, TO THE MILLISECOND. Margin zero.
//
// A standing player sends nothing but the heartbeat (net/online.js sendPose). SLAM6's far tier served one pose in
// POSE_FAR_SHARE, so a listener past the bound heard a standing peer every 20 s - which is the exact instant the
// silence law hides it (AUDIT ONLINE B3/B11/B14). Two hundred people standing still to listen to somebody IS what
// an event is, and every one of them watched the rest of the crowd blink out and back at the 20-second boundary;
// one late or lost heartbeat hid a peer for a full twenty seconds.
//
// Nobody noticed because the pin written to cover it (slam6.test.js) asserted
// `(POSE_FAR_SHARE * 1000) / POSE_HZ_MIN < PEER_TIMEOUT_MS` - POSE_HZ_MIN is the rate of a peer that is MOVING. It
// reduces to 1000 < 20000 and could not fail. Mutating HEARTBEAT_MS to 9000, which hides every standing far peer
// PERMANENTLY, passed all 7,897 tests.
//
// The root cause is a category error: the tier is a bandwidth saving for MOTION, and a keepalive is the one frame
// whose entire job is to be heard. A pose nobody has to ease is also the cheapest frame in the room - at 200
// standing, 200 x 199 / 5 s = 7,960 sends a second beside the 59,000 the moving case already pays.
//
// TWO: `turn` COUNTED POSES RECEIVED, NOT POSES RELAYED. `_meter` writes its patch back whether or not the rate
// gate passed, so the far tier's rotation advanced on refused frames while the fan only served passed ones. Any
// drop pattern sharing a factor with POSE_FAR_SHARE pins the served slice to one parity; at exactly twice the gate
// the bucket settles into pass/fail alternation and two of the four slices are never served again - SLAM1's
// erasure, back, for that sender. The port's own client cannot reach that rate. A modified one can.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poseChanged, POSE_FAR_SHARE, POSE_FAN_MAX, POSE_HZ_MAX } from '../src/net/wire.js';
import { HEARTBEAT_MS, PEER_TIMEOUT_MS, POSE_HZ, poseChanged as sessionPoseChanged } from '../src/net/online.js';
import * as relay from '../server/src/relay.js';
import { fakeRoom } from './fakeRoom.mjs';

const at = (x, z) => ({ x, y: 0, z, yaw: 0, pitch: 0, mv: 0 });
const posesIn = (ws) => ws.sent.filter((m) => m.t === 'pose').length;

/** A room of `n` standing in a line, the first at one end so its nearest run is unambiguous. */
async function crowd(n, key = 'town:m9') {
  const r = fakeRoom(key);
  const ws = [];
  for (let i = 0; i < n; i++) {
    const s = r.connect();
    await r.hello(s, `p${String(i).padStart(4, '0')}`, at(i * 2, 0));
    ws.push(s);
    await new Promise((res) => setTimeout(res, 110));   // the room's own admission rate
  }
  for (const s of ws) s.sent.length = 0;
  return { r, ws };
}

test('SLAM8: a KEEPALIVE reaches every listener in range, tier or no tier - the whole crowd hears a player who is standing still (mutant: the keepalive tiered, as SLAM6 shipped it, which hides every standing peer past the bound at exactly PEER_TIMEOUT_MS)', async () => {
  const n = POSE_FAN_MAX + 28;
  const { r, ws } = await crowd(n);
  const still = at(0, 0);
  // the same pose, as sendPose really repeats it - and AT THE HEARTBEAT, as sendPose really spaces it (SLAM13 put a
  // floor of KEEPALIVE_FAN_MS under the whole fan, so a keepalive burst is tiered like motion; see slam13.test.js)
  const realNow = Date.now; let clock = realNow(); Date.now = () => clock;
  try { for (let k = 0; k < POSE_FAR_SHARE; k++) { clock += HEARTBEAT_MS; await r.pose(ws[0], still); } } finally { Date.now = realNow; }
  const each = ws.slice(1).map(posesIn);
  assert.equal(each.filter((c) => c > 0).length, n - 1, 'every listener in the room heard the standing sender');
  assert.equal(Math.min(...each), POSE_FAR_SHARE, 'and heard EVERY heartbeat, not one in POSE_FAR_SHARE of them');
  assert.equal(Math.max(...each), POSE_FAR_SHARE);
});

test('SLAM8: and a MOVING sender is still tiered - the saving SLAM6 bought is not handed back (mutant: the keepalive test always true, which is the unbounded fan again)', async () => {
  const n = POSE_FAN_MAX + 28;
  const { r, ws } = await crowd(n);
  for (let k = 0; k < POSE_FAR_SHARE; k++) await r.pose(ws[0], at(k * 3 + 1, 0));
  const each = ws.slice(1).map(posesIn);
  const total = each.reduce((a, b) => a + b, 0);
  assert.ok(total < POSE_FAR_SHARE * (n - 1), `a moving sender is bounded: ${total} sends, not the unbounded ${POSE_FAR_SHARE * (n - 1)}`);
  assert.equal(Math.min(...each), 1, 'the far tier still hears exactly one pose per rotation');
  assert.equal(Math.max(...each), POSE_FAR_SHARE, 'and the near run still hears every one');
  // a DRIFT under the epsilon is a keepalive too - a hand resting on a mouse must not re-tier the heartbeat
  for (const s of ws) s.sent.length = 0;
  const lastMoved = (POSE_FAR_SHARE - 1) * 3 + 1;   // where the loop above left the sender
  await r.pose(ws[0], at(lastMoved + 0.004, 0.004));
  assert.equal(ws.slice(1).filter((s) => posesIn(s) > 0).length, n - 1, 'a sub-epsilon drift is still standing still');
});

test('SLAM8: the silence law is what makes this a law, and one lost heartbeat must not hide a peer - the standing margin is real and is asserted on the STANDING rate (mutants: HEARTBEAT_MS 5000 -> 9000, which survived the whole suite before this; PEER_TIMEOUT_MS cut to 5000)', () => {
  assert.equal(relay.poseChanged, poseChanged, 'one home, both ends - the client decides "I did not move" and the relay must agree');
  assert.equal(sessionPoseChanged, poseChanged, 'and the session re-exports that same one');
  // THE TRAP, written down (SLAM13 reworded it - the line used to ASSERT the hazard's presence, so a smaller share that
  // removed the hazard would have failed the pin): a tiered keepalive is heard once in POSE_FAR_SHARE heartbeats,
  // which at these numbers is PEER_TIMEOUT_MS to the millisecond - the whole reason a keepalive is fanned untiered.
  // The pin is that the untiered fan comes at least once a heartbeat, so a standing peer is heard at every one.
  assert.ok(relay.KEEPALIVE_FAN_MS <= HEARTBEAT_MS, `a keepalive is heard whole at least every heartbeat (floor ${relay.KEEPALIVE_FAN_MS} <= ${HEARTBEAT_MS})`);
  // THE MARGIN, on the rate a standing peer really keeps: heard at least three times before it could be hidden, so
  // neither one nor two lost heartbeats can erase somebody from a room they are standing in
  assert.ok(PEER_TIMEOUT_MS / HEARTBEAT_MS >= 3, `a standing peer is heard ${PEER_TIMEOUT_MS / HEARTBEAT_MS}x before the silence law could hide it`);
  assert.ok(HEARTBEAT_MS < PEER_TIMEOUT_MS);
  assert.ok(POSE_HZ > 0 && POSE_FAR_SHARE >= 1);
});

test('SLAM8: `turn` counts the poses the room RELAYED, never the ones it merely received - so a sender the gate is refusing still rotates through every far slice (mutant: turn back in the ordinary patch, where a pass/fail alternation starves half the far tier for ever)', async () => {
  const { r, ws } = await crowd(3);
  const sock = ws[0];
  // drive `_meter` directly, which is the only way to hold the clock still: fakeRoom's `now` is not threaded into Room
  let relayed = 0;
  const N = POSE_HZ_MAX + 12;
  for (let i = 1; i <= N; i++) {
    const a = r.room._attach(sock);
    const got = r.room._meter(sock, a, 500_000, { pose: at(i, 0) }, { turn: ((a.turn | 0) + 1) & 0xffff });
    if (got) relayed++;
  }
  const after = r.room._attach(sock);
  assert.ok(relayed > 0 && relayed < N, `the gate let ${relayed} of ${N} through - some were refused, which is the case under test`);
  assert.equal(after.turn, relayed, 'turn advanced once per RELAYED pose and not once per frame received');
  assert.equal(after.pose.x, N, 'while the ordinary patch still keeps the latest pose, refused or not (that half must not change)');
});
