// EG-H1 RIDE-PLAY (FIELD BUGS 2026-10-23, found beside DECK-POSE): A RIDDEN POSE REACHES THE SCREEN. A pose on an Elite
// Breach's moving piece carries `pl` - the piece and the body's offset from its top (net/wire.js riddenOf) - so a reader
// stands the rider on the piece at its own clock (bible/11-Multiplayer/Elite-Gates.md section 10.8; the session's `rideAt`,
// scenes/eliteGates/egClient.js rideDraw). But the session draws a peer from its play-out (NET-SMOOTH: net/online.js
// poseAlong, lerpPose), and lerpPose carried no `pl`: the drawn pose never had one, `rideAt` was told every ridden peer was
// on no ride, and a rider on a swinging Drift was drawn in world space, 160-550 ms behind it. The pins of EG-H1 called
// `rideAt` by hand on a pose that had one, so nothing read the seam between. Now the play-out carries the ride (rideAlong).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeSocketClass } from '../../fakeSocket.mjs';
import { PIXEL_UNITS, WORLD_CELL, POSE_TS_MOD, validPose } from '../../../src/net/wire.js';
import { OnlineSession, lerpPose, rideAlong } from '../../../src/net/online.js';

const BASE = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0 };

test('EG-H1 RIDE-PLAY THE PLAY-OUT: between two poses on one piece the ride\'s offset is eased as the feet are; onto a piece, onto another or from no ride the newer whole; off a piece none - and the drawn ride is its own copy (mutants: the ride dropped by lerpPose; taken whole on one piece; eased across two pieces)', () => {
  const a = { ...BASE, pl: [4, 0, 0.5, -1] };
  const b = { ...BASE, x: 9, pl: [4, 2, 0.5, 3] };
  assert.deepEqual(lerpPose(a, b, 0.25).pl, [4, 0.5, 0.5, 0], 'a quarter of the way along her top');
  assert.deepEqual(lerpPose(a, { ...b, pl: [5, 2, 0.5, 3] }, 0.25).pl, [5, 2, 0.5, 3], 'another piece: the newer whole');
  assert.deepEqual(lerpPose(BASE, b, 0.25).pl, b.pl, 'onto a piece: the newer whole');
  assert.notEqual(lerpPose(BASE, b, 0.25).pl, b.pl, 'its own copy');
  assert.notEqual(lerpPose(a, b, 1).pl, b.pl, 'its own copy on one piece too');
  assert.equal('pl' in lerpPose(a, BASE, 0.25), false, 'off a piece: none');
  assert.deepEqual(rideAlong(undefined, b.pl, 0.5), b.pl);
  assert.deepEqual(validPose({ ...BASE, pl: [4, 2, 0.5, 3] }).pl, [4, 2, 0.5, 3], 'the door keeps it (EG8)');
});

test('EG-H1 RIDE-PLAY ON THIS SCREEN: a peer riding a piece is handed to `rideAt` with its ride every frame of the play-out, its offset walked evenly between its poses, and the drawn place is the one `rideAt` stood it at - the session\'s own place for the run-in-place law kept apart; a peer off every piece is handed on with none (mutants: the ride dropped by lerpPose; the ridden copy never drawn)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { now: 1_700_000_000_000 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock.now });
  const U = PIXEL_UNITS, me = { x: (25 * WORLD_CELL + 8) * U, y: 0, z: (15 * WORLD_CELL + 8) * U, yaw: 0, pitch: 0, mv: 0 };
  s.join('world:25,15', me); sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'eve-0003', name: 'Eve', look: null, pose: { ...me } }], host: null, world: null });
  const told = [];
  // the breach client's rideDraw in small: a ride stands the drawn place at the piece (here x = 5000 + its offset)
  s.rideAt = (q) => { told.push(Array.isArray(q.pl) ? [...q.pl] : null); if (Array.isArray(q.pl)) q.x = 5000 + q.pl[1]; };
  const q = [];
  const drawn = [];
  for (let t = 10; t <= 1500; t += 10) {
    clock.now += 10;
    if (t % 100 === 0) {
      // she walks her piece's top +x at 2 m/s for a second (the piece's own swing is the reader's clock), then steps off
      const on = t <= 1000;
      const p = { ...me, x: me.x + t, mv: 1, ts: (5_000_000 + t) % POSE_TS_MOD, ...(on ? { pl: [7, Math.round(2 * t) / 1000, 0, 0] } : {}) };
      q.push({ at: clock.now + 50, frame: { t: 'pose', id: 'eve-0003', p } });
    }
    while (q.length && q[0].at <= clock.now) sockets[0].receive(q.shift().frame);
    told.length = 0;
    s.tick();
    const eve = s.peers.get('eve-0003');
    drawn.push({ told: told[0] ?? null, shown: eve.shown.x, own: eve.drawn.x });
  }
  const riding = drawn.slice(30, 90);
  assert.ok(riding.every((f) => f.told && f.told[0] === 7), 'every frame of the ride: rideAt told her piece');
  assert.ok(riding.every((f) => f.shown === 5000 + f.told[1]), 'drawn where rideAt stood her');
  assert.ok(riding.every((f) => f.own !== f.shown), 'the session\'s own place kept apart from the ridden one (RUN-IN-PLACE reads its own)');
  const steps = riding.slice(1).map((f, i) => f.told[1] - riding[i].told[1]).filter((d) => d !== 0);
  assert.ok(steps.length > 40 && steps.every((d) => d > 0 && d < 0.05), `her offset walked evenly along her piece (${steps.length} moving frames, at most ${Math.max(...steps).toFixed(3)} m a frame)`);
  assert.ok(drawn.slice(-20).every((f) => f.told === null && f.shown === f.own), 'off every piece: handed on with no ride, drawn where the session stands her');
});
