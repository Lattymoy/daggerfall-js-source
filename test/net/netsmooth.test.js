// NET-SMOOTH (2026-10-04, Mac: "Sometimes other players rubberband, I want to continue to improve performance and
// future proof for larger amounts of players"). Four causes of a peer drawn jumping back or dashing, all on the
// client (src/net/online.js, the NET-SMOOTH block above keptToken and OnlineSession._arrive):
//   1. the snap taken in the scene frame's units for every room not named `world:` - a 0.75 m snap in a siege's battle,
//      a Royal Tourney and an owned interior, whose poses are MapsFile's frame;
//   2. a pose heard twice, through a cell and a halo, with no order between the two copies - an older one landing
//      second was eased toward;
//   3. a hello's pose replayed through a halo (a join, a roster) after the source room had moved the peer on;
//   4. an ease that restarted on every pose over the newest ARRIVAL interval - a backlog's burst cut the corners at
//      up to 4x - and from where the peer was drawn the frame before, freezing it one frame a pose.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OnlineSession, nativePoseRoom, snapUnitsFor, cadenceOf, cushionOf, segmentFor, rateFor, poseAlong,
  SNAP_WORLD_UNITS, SNAP_SCENE_UNITS, CADENCE_SAMPLES, PLAY_RATE_MAX, PLAY_RATE_MIN, FAST_SHARE, PATH_MAX,
  PAUSE_MS, GAP_MIN_MS, GAP_MAX_MS, POSE_HZ, SOURCE_STALE_MIN_MS, SOURCE_LEAD_MIN_MS, SOURCE_LEADS,
} from '../../src/net/online.js';
import { PIXEL_UNITS, WORLD_CELL } from '../../src/net/wire.js';
import { fakeSocketClass } from '../fakeSocket.mjs';

const OWNED = `owned:${'a'.repeat(32)}.${'b'.repeat(16)}:42.9`;
const quiet = (fn) => { const info = console.info; console.info = () => {}; try { return fn(); } finally { console.info = info; } };

/** A session of mine in `room`, Eve in its roster at `x`. */
function single(room, x = 25 * PIXEL_UNITS * 4) {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { now: 1_000_000 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock.now });
  const at = (dx, mv = 1) => ({ x: x + dx, y: 0, z: x, yaw: 0, pitch: 0, mv });
  s.join(room, at(0, 0)); sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'eve-0003', name: 'Eve', look: null, pose: at(0) }], host: null, world: null });
  return { s, ws: sockets[0], clock, at, eve: () => s.peers.get('eve-0003') };
}

/** I stand at my cell's east edge, so I hold it and the next cell east as a halo; Eve is in both rosters. */
function edge() {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { now: 1_000_000 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock.now });
  const cellX = 25, cellZ = 15, U = PIXEL_UNITS;
  const me = { x: (cellX * WORLD_CELL + WORLD_CELL - 1) * U + U / 2, y: 0, z: (cellZ * WORLD_CELL + 8) * U, yaw: 0, pitch: 0, mv: 0 };
  const cellRoom = `world:${cellX},${cellZ}`, haloRoom = `world:${cellX + 1},${cellZ}`;
  s.join(cellRoom, me); sockets[0].open();
  s.setHalo([haloRoom]);
  const halo = sockets.find((w) => w.url.endsWith(haloRoom)); halo.open();
  const at = (dx, mv = 1) => ({ ...me, x: me.x - 1600 + dx, mv });
  for (const w of [sockets[0], halo]) w.receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'eve-0003', name: 'Eve', look: null, pose: at(0, 0) }], host: null, world: null });
  return { s, cell: sockets[0], halo, cellRoom, haloRoom, clock, at, eve: () => s.peers.get('eve-0003') };
}

/** Delivers queued frames as their times come, ticking every 10 ms; reports the drawn x after each tick. */
function player(env) {
  const q = [];
  const drawn = [];
  const tail = new Map();   // a socket is FIFO: no frame overtakes the one before it on the same socket
  return {
    send(w, delay, pose) {
      const at = Math.max(env.clock.now + delay, tail.get(w) ?? 0);
      tail.set(w, at);
      q.push({ at, w, f: { t: 'pose', id: 'eve-0003', p: pose } });
    },
    run(ms, each) {
      for (let t = 10; t <= ms; t += 10) {
        env.clock.now += 10;
        each?.(t);
        q.sort((a, b) => a.at - b.at);
        while (q.length && q[0].at <= env.clock.now) { const { w, f } = q.shift(); w.receive(f); }
        env.s.tick();
        drawn.push(env.eve().shown.x);
      }
      return drawn;
    },
    drawn,
  };
}
const backwards = (xs) => xs.slice(1).filter((x, i) => x < xs[i] - 1e-9).length;
const speeds = (xs) => xs.slice(1).map((x, i) => (x - xs[i]) / 10);

test('NET-SMOOTH 1: the snap is in the units of the room the pose was heard in - MapsFile\'s frame for a world cell, a siege\'s battle, a Royal Tourney and an owned interior; the scene frame\'s elsewhere (mutants: the old `world:` prefix test, which gave a battle and an owned interior a 0.75 m snap; the scene frame\'s snap everywhere)', () => {
  for (const k of ['world:25,15', 'siege:3021:20', 'royal:5023:20', OWNED]) {
    assert.equal(nativePoseRoom(k), true, `${k.slice(0, 16)}: MapsFile's frame (scenes/world.js nativeFrame)`);
    assert.equal(snapUnitsFor(k), SNAP_WORLD_UNITS);
  }
  for (const k of ['town:m1', 'dungeon:5', 'gate:5', 'chat:world', null]) {
    assert.equal(nativePoseRoom(k), false, `${k}: the scene's own frame`);
    assert.equal(snapUnitsFor(k), SNAP_SCENE_UNITS);
  }
  assert.ok(SNAP_SCENE_UNITS / 40 < 1, 'the scene snap read in MapsFile units is under a metre - why it could not stand there');
  // a runner at 10 Hz goes 0.8 m a pose: 32 MapsFile units
  quiet(() => {
    for (const room of ['siege:3021:20', 'royal:5023:20', OWNED, 'world:25,15']) {
      const { ws, at, eve } = single(room);
      ws.receive({ t: 'pose', id: 'eve-0003', p: at(32) });
      assert.equal(eve().shown.x, at(0).x, `${room.slice(0, 16)}: a 0.8 m step is walked, not snapped`);
      ws.receive({ t: 'pose', id: 'eve-0003', p: at(32 + SNAP_WORLD_UNITS + 1) });
      assert.equal(eve().shown.x, at(32 + SNAP_WORLD_UNITS + 1).x, 'and a real teleport still snaps');
    }
    const { ws, at, eve } = single('town:m1', 100);
    ws.receive({ t: 'pose', id: 'eve-0003', p: at(SNAP_SCENE_UNITS + 1) });
    assert.equal(eve().shown.x, at(SNAP_SCENE_UNITS + 1).x, 'a scene room snaps at its own 30 units');
  });
});

test('NET-SMOOTH 2: a peer is heard through ONE room at a time - every copy of its pose comes through the cell AND the halo, the halo\'s 0-150 ms late, and the peer is never drawn walking back (mutant: every room\'s copy moves the peer, which walked Eve backwards dozens of times in this walk)', () => {
  quiet(() => {
    const env = edge();
    const pl = player(env);
    let x = 0, k = 0;
    const r = (n) => ((n * 2654435761) >>> 0) / 4294967296;
    pl.run(6000, (t) => {
      if (t % 100) return;
      x += 20; k++;
      pl.send(env.cell, 40 + 20 * r(k), env.at(x));
      pl.send(env.halo, 40 + 150 * r(k + 7919), env.at(x));
    });
    assert.equal(backwards(pl.drawn), 0, 'never a step back');
    assert.equal(env.eve().src, env.cellRoom, 'the cell, quicker every time, speaks for her');
    assert.ok(Math.max(...speeds(pl.drawn).slice(100)) <= PLAY_RATE_MAX * 0.2 + 1e-9, 'and never faster than twice her pace');
  });
});

test('NET-SMOOTH 2: the source room falling silent or letting the peer go hands the peer to the next room heard - after SOURCE_STALE_MIN_MS of silence, or at once on a leave (mutants: a source kept for ever, so a peer frozen while the halo still hears it; the leave not clearing it)', () => {
  quiet(() => {
    const env = edge();
    env.cell.receive({ t: 'pose', id: 'eve-0003', p: env.at(10) });
    assert.equal(env.eve().src, env.cellRoom);
    env.clock.now += 100; env.halo.receive({ t: 'pose', id: 'eve-0003', p: env.at(20) });
    assert.equal(env.eve().pose.x, env.at(10).x, 'the halo\'s copy moves nothing while the cell is live');
    env.clock.now += SOURCE_STALE_MIN_MS; env.halo.receive({ t: 'pose', id: 'eve-0003', p: env.at(30) });
    assert.equal(env.eve().pose.x, env.at(30).x, 'a cell silent past SOURCE_STALE_MIN_MS no longer speaks: the halo does');
    assert.equal(env.eve().src, env.haloRoom);
    // and a source that lets her go: the cell speaks again, then leaves her
    const env2 = edge();
    env2.cell.receive({ t: 'pose', id: 'eve-0003', p: env2.at(10) });
    env2.clock.now += 100; env2.cell.receive({ t: 'leave', id: 'eve-0003' });
    assert.ok(env2.eve(), 'still known - the halo holds her');
    assert.equal(env2.eve().src, null, 'the cell let her go');
    env2.halo.receive({ t: 'pose', id: 'eve-0003', p: env2.at(20) });
    assert.equal(env2.eve().pose.x, env2.at(20).x, 'so the halo speaks at once');
  });
});

test('NET-SMOOTH 2: a room that is AHEAD takes the peer - one that brought the source\'s pose SOURCE_LEAD_MIN_MS sooner SOURCE_LEADS times running speaks for it from then on, and the hand-over never walks the peer back; a room behind never takes it (mutants: no lead counted, so a slow Durable Object kept the peer late for as long as it lived; a lead counted from a room behind)', () => {
  quiet(() => {
    const env = edge();
    const pl = player(env);
    let x = 0;
    pl.run(4000, (t) => {
      if (t % 100) return;
      x += 20;
      const slow = t > 1000;   // the cell's Durable Object quick at first, then slow
      pl.send(env.cell, slow ? 200 : 40, env.at(x));
      pl.send(env.halo, slow ? 40 : 200, env.at(x));
      if (t === 1000) assert.equal(env.eve().src, env.cellRoom, 'the cell spoke first, and speaks');
    });
    assert.equal(env.eve().src, env.haloRoom, 'the halo, ahead now, speaks');
    assert.equal(backwards(pl.drawn), 0, 'and the hand-over took no step back');
    const lag = (env.at(x).x - env.eve().shown.x) / 0.2;
    assert.ok(lag < 200, `she is drawn on the quick room's time (${lag.toFixed(0)} ms behind)`);
    assert.ok(SOURCE_LEADS >= 2 && SOURCE_LEAD_MIN_MS > 0, 'one lucky copy is not a lead');
    // the halo behind: the cell keeps her
    const env2 = edge();
    const pl2 = player(env2);
    let x2 = 0;
    pl2.run(3000, (t) => {
      if (t % 100) return;
      x2 += 20;
      pl2.send(env2.cell, 40, env2.at(x2));
      pl2.send(env2.halo, 200, env2.at(x2));
    });
    assert.equal(env2.eve().src, env2.cellRoom, 'a room behind never takes her');
    assert.equal(backwards(pl2.drawn), 0);
  });
});

test('NET-SMOOTH 3: an introduction\'s pose - a join through a halo, a halo\'s roster - moves nothing while the source room is live; from the source, or with no live source, it does (mutant: every introduction moves the peer, which threw Eve back to where she said hello)', () => {
  quiet(() => {
    const env = edge();
    env.cell.receive({ t: 'pose', id: 'eve-0003', p: env.at(40) });
    env.clock.now += 100; env.cell.receive({ t: 'pose', id: 'eve-0003', p: env.at(60) });
    // Eve opens a halo of her own: that room is told she joined, with the pose she said hello with
    env.halo.receive({ t: 'join', id: 'eve-0003', name: 'Eve', look: null, pose: env.at(0) });
    assert.equal(env.eve().pose.x, env.at(60).x, 'the join\'s hello pose did not throw her back');
    env.halo.receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'eve-0003', name: 'Eve', look: null, pose: env.at(5) }], host: null, world: null });
    assert.equal(env.eve().pose.x, env.at(60).x, 'nor did the halo\'s roster');
    assert.equal(env.eve().name, 'Eve', 'the introduction itself still lands');
    // from the source room an introduction moves her as ever
    env.cell.receive({ t: 'join', id: 'eve-0003', name: 'Eve', look: null, pose: env.at(70) });
    assert.equal(env.eve().pose.x, env.at(70).x, 'the source room\'s own join moves her');
    // the source silent past its window: the halo's introduction is the newest word there is
    env.clock.now += SOURCE_STALE_MIN_MS + 1;
    env.halo.receive({ t: 'join', id: 'eve-0003', name: 'Eve', look: null, pose: env.at(90) });
    assert.equal(env.eve().pose.x, env.at(90).x, 'with no live source, an introduction moves her');
  });
});

test('NET-SMOOTH 4 law (pure): the cadence is the median of its samples; the cushion is the farthest sample from it, at most the cadence; a segment is the cadence unless its own spacing says the rate changed; the rate keeps one interval and the cushion ahead, within PLAY_RATE_MIN..PLAY_RATE_MAX; a path is walked waypoint to waypoint (mutants: a mean for the median; the cushion unbounded; the faster rate missed; the slower rate dashed, or played on faster; the rate unbounded either way)', () => {
  assert.equal(cadenceOf([]), 1000 / POSE_HZ, 'nothing yet: the ordinary interval');
  assert.equal(cadenceOf([100, 900, 110]), 110, 'one stray interval does not move it');
  assert.equal(cadenceOf([100, 120]), 110);
  assert.equal(CADENCE_SAMPLES, 5);
  assert.equal(cushionOf([], 100), 0, 'no samples, no cushion');
  assert.equal(cushionOf([100, 100, 100], 100), 0, 'a clean line needs none');
  assert.equal(cushionOf([80, 130, 100], 100), 30, 'the farthest - the late pose is what it is for');
  assert.equal(cushionOf([10, 1000, 1000], 100), 100, 'never more than one interval');
  assert.equal(segmentFor(null, 100, true), 100, 'the first move: the cadence');
  assert.equal(segmentFor(GAP_MIN_MS - 1, 1000, true), 1000, 'a bunch says nothing of the rate');
  assert.equal(segmentFor(250, 1000, true), 250, `under 1/${FAST_SHARE} of the cadence: a faster rate, walked at its own spacing`);
  assert.equal(segmentFor(150, 100, true), 100, 'a little late is the cadence');
  assert.equal(segmentFor(1000, 250, true), 500, 'past twice the cadence after a move: half the silence, never more than twice the pace');
  assert.equal(segmentFor(PAUSE_MS, 100, true), GAP_MAX_MS / 2, 'and half of GAP_MAX_MS at most');
  assert.equal(segmentFor(5000, 100, false), 100, 'after standing still the silence is not motion');
  assert.equal(rateFor(100, 0, 100, 100), 1, 'one interval ahead, no cushion: exactly the peer\'s pace');
  assert.equal(rateFor(130, 30, 100, 100), 1, 'one interval and the cushion: exactly');
  assert.equal(rateFor(1000, 0, 100, 100), PLAY_RATE_MAX, 'a backlog: twice the pace, no more');
  assert.equal(rateFor(10, 50, 100, 100), PLAY_RATE_MIN, 'starved: slowed, never stopped by the law');
  assert.equal(rateFor(500, 0, 100, 500), 1, 'a long segment is its own interval');
  assert.equal(rateFor(900, 0, 100, 500), 1, 'and a slower rate\'s segment - half its silence, already up to twice the pace - is never played faster');
  assert.deepEqual([PLAY_RATE_MIN, PLAY_RATE_MAX], [0.75, 2]);
  const a = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 1 }, b = { ...a, x: 10 }, c = { ...a, x: 30 };
  const path = [{ pose: a, c: 100 }, { pose: b, c: 200 }, { pose: c, c: 300 }];
  assert.equal(poseAlong(path, 50).x, 0, 'before the path: its first waypoint');
  assert.equal(poseAlong(path, 150).x, 5);
  assert.equal(poseAlong(path, 250).x, 20, 'between the two it falls between');
  assert.equal(poseAlong(path, 999).x, 30, 'past the end: the last');
  assert.equal(poseAlong([], 0), null);
});

test('NET-SMOOTH 4: a steady stream plays at exactly the peer\'s pace, one interval behind, and the frame a pose lands the peer still moves - the old ease restarted from where the peer was drawn the frame BEFORE, one frozen frame a pose (mutant: the cursor not brought to the arrival\'s instant before the rate is set, so the pace wobbles at every pose)', () => {
  quiet(() => {
    const env = single('world:25,15');
    const pl = player(env);
    let x = 0;
    pl.run(3000, (t) => { if (t % 100 === 0) { x += 20; pl.send(env.ws, 40, env.at(x)); } });
    const v = speeds(pl.drawn).slice(50);
    assert.equal(v.filter((s) => s < 1e-9).length, 0, 'not one frame standing still, the arrival frames included');
    assert.ok(v.every((s) => Math.abs(s - 0.2) < 1e-9), `every frame at her own pace (${Math.min(...v)}..${Math.max(...v)})`);
    assert.equal(env.eve().rate, 1);
  });
});

test('NET-SMOOTH 4: a stall\'s backlog is walked at no more than twice the pace and the peer is not parked between its waypoints, and a pose late inside the cushion does not stop it (mutants: the rate pinned at 1, a backlog never caught up; a jitter line with no cushion, or a cushion of the typical lateness, a stop at the late poses)', () => {
  quiet(() => {
    const env = single('world:25,15');
    const pl = player(env);
    let x = 0, k = 0;
    pl.run(6000, (t) => {
      if (t % 100) return;
      x += 20; k++;
      // a 400 ms stall every 2 s: those poses arrive together when it clears
      const stall = k % 20 < 4 ? (4 - (k % 20)) * 100 : 0;
      pl.send(env.ws, 40 + stall, env.at(x));
    });
    const v = speeds(pl.drawn).slice(100);
    assert.equal(backwards(pl.drawn), 0);
    assert.ok(Math.max(...v) <= PLAY_RATE_MAX * 0.2 + 1e-9, `the backlog walked at ${(Math.max(...v) / 0.2).toFixed(2)}x at most`);
    // and caught up: just before each stall she trails by an interval and a cushion again, not by every stall so far
    const behind = [1990, 3990, 5990].map((t) => (20 * (t / 100 | 0) - (pl.drawn[t / 10 - 1] - env.at(0).x)) / 0.2);
    assert.ok(behind.every((ms) => ms <= 300), `the lag closed between stalls (${behind.map((ms) => ms.toFixed(0)).join(', ')} ms)`);
    // a line that jitters: 0-60 ms on every pose, delivered in order
    const env2 = single('world:25,15');
    const pl2 = player(env2);
    let x2 = 0, k2 = 0, tail = 0;
    pl2.run(6000, (t) => {
      if (t % 100) return;
      x2 += 20; k2++;
      const d = Math.max(40 + Math.round((((k2 * 2654435761) >>> 0) / 4294967296) * 6) * 10, tail - env2.clock.now);
      tail = env2.clock.now + d;
      pl2.send(env2.ws, d, env2.at(x2));
    });
    const v2 = speeds(pl2.drawn).slice(200);
    assert.ok(env2.eve().cadence.length === CADENCE_SAMPLES && cushionOf(env2.eve().cadence, env2.eve().gap) > 0, 'a cushion, measured off the jitter');
    assert.equal(v2.filter((s) => s < 1e-9).length, 0, 'and she walks on it - not a frame standing');
    assert.ok(Math.max(...v2) <= PLAY_RATE_MAX * 0.2 + 1e-9);
  });
});

test('NET-SMOOTH 4: a backlog longer than PATH_MAX lets its oldest waypoints go past the one being walked - the path straightens, the peer\'s time along it is kept, and nothing dashes (mutant: the waypoint being walked let go, a jump)', () => {
  quiet(() => {
    const env = single('world:25,15');
    env.ws.receive({ t: 'pose', id: 'eve-0003', p: env.at(20) });
    env.clock.now += 50; env.s.tick();
    const before = env.eve().shown.x;
    for (let i = 2; i <= PATH_MAX + 6; i++) env.ws.receive({ t: 'pose', id: 'eve-0003', p: { ...env.at(20 * i), z: env.at(0).z + (i % 2 ? 10 : -10) } });   // a zigzag, so a waypoint let go shows
    assert.equal(env.eve().path.length, PATH_MAX, 'held to PATH_MAX');
    assert.equal(env.eve().shown.x, before, 'where she is drawn did not move');
    env.clock.now += 10; env.s.tick();
    assert.ok(env.eve().shown.x - before <= PLAY_RATE_MAX * 0.2 * 10 + 1e-9, 'and her next frame is a step, not a jump');
    assert.ok(env.eve().shown.x > before);
  });
});
