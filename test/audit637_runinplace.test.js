// AUDIT 637 (2026-10-06, Mac: "Audit this"), the RUN-IN-PLACE lens: PR #637's drawn-pose hold (net/online.js `tick`)
// and the far tier's play-out it laid bare (`_arriveTimed`), audited. bible/01-Overview/Audit-637.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { PIXEL_UNITS, WORLD_CELL, POSE_TS_MOD } from '../src/net/wire.js';
import { OnlineSession, SHOWN_MOVE_HOLD_MS, SNAP_WORLD_UNITS, GAP_MAX_MS, PAUSE_MS } from '../src/net/online.js';

const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };

const CX = 25, CZ = 15, U = PIXEL_UNITS;
const ME = { x: (CX * WORLD_CELL + 8) * U, y: 0, z: (CZ * WORLD_CELL + 8) * U, yaw: 0, pitch: 0, mv: 0 };
/** Eve's pose `d` = [dx, dy, dz] from where she stands, moving or not, with her send time when `ts` is given. */
const eveAt = (d = [0, 0, 0], mv = 1, ts = null) => ({ ...ME, x: ME.x + 400 + d[0], y: ME.y + d[1], z: ME.z + d[2], mv, ...(ts != null ? { ts: ts % POSE_TS_MOD } : {}) });

/** Mac in a world cell on a fake clock, with `peers` in his welcome. `frame()` is one 10 ms frame: the frames due on his
 *  socket delivered (in order, `delay` ms after they were said - one socket's frames are ordered), then his tick; it
 *  answers what he drew of Eve. */
function mac({ peers = [] } = {}) {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { now: 1_700_000_000_000 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock.now });
  s.join(`world:${CX},${CZ}`, ME); sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers, host: null, world: null });
  const q = [];
  let tail = 0;
  const hear = (frame, delay = 40) => { const at = Math.max(clock.now + delay, tail); tail = at; q.push({ at, frame }); };
  const frame = () => {
    clock.now += 10;
    while (q.length && q[0].at <= clock.now) sockets[0].receive(q.shift().frame);
    s.tick();
    const e = s.peers.get('eve-0003')?.shown;
    return e ? { x: e.x, y: e.y, z: e.z, mv: e.mv } : null;
  };
  return { s, hear, frame, frames: (n) => Array.from({ length: n }, frame), eve: () => s.peers.get('eve-0003') };
}
/** Eve speaking to `m`: a pose every `every` ms of her own time, `step` on each, `mv` on all; `timed` stamps her send
 *  time; `walk(ms, { send })` runs her side frame by frame and answers what Mac drew. `jitter` is added to the line's
 *  40 ms, pose by pose, round the list. */
function speaker(m, { every = 100, step = [20, 0, 0], mv = 1, timed = true, jitter = [0], from = [0, 0, 0] } = {}) {
  let t = 0, due = every, k = 0;
  const d = [...from];
  return {
    walk(ms, { send = () => true } = {}) {
      const out = [];
      for (let i = 0; i < ms; i += 10) {
        t += 10;
        if (t >= due) {
          due += every;
          if (mv) for (let a = 0; a < 3; a++) d[a] += step[a];
          if (send(t)) m.hear({ t: 'pose', id: 'eve-0003', p: eveAt(d, mv, timed ? 5_000_000 + t : null) }, 40 + jitter[k++ % jitter.length]);
        }
        out.push(m.frame());
      }
      return out;
    },
    teleport(dx) { d[0] += dx; },
    get t() { return t; },
  };
}
const still = (f, i, d) => i > 0 && f.x === d[i - 1].x && f.y === d[i - 1].y && f.z === d[i - 1].z;
/** Frames drawn in place (the drawn place unchanged from the frame before) while reading moving: running in place. */
const inPlace = (d) => d.filter((f, i) => still(f, i, d) && f.mv).length;
const HOLD_FRAMES = SHOWN_MOVE_HOLD_MS / 10;

// ─── C1: the clock starts at the first frame the law draws a peer ────────────────────────────────────────────────

test('AUDIT 637 C1: a peer drawn first at its INTRODUCTION\'s pose and never heard again - the welcome\'s roster, a join, a stranger\'s first pose, running or walking, timed or not - stands within the hold: the clock starts at the first frame the law draws it, whoever wrote its drawn pose first (it ran in place for the whole PEER_TIMEOUT_MS: `_peer` writes `shown`, and the hold measured from a step it never saw) (mutants: the place compared with `shown` again; the drawn place never recorded)', () => quiet(() => {
  const intros = [
    ['the welcome\'s roster, running, timed', (pose) => mac({ peers: [{ id: 'eve-0003', name: 'Eve', look: null, pose }] }), eveAt([0, 0, 0], 2, 5_000_000)],
    ['the welcome\'s roster, walking, untimed', (pose) => mac({ peers: [{ id: 'eve-0003', name: 'Eve', look: null, pose }] }), eveAt([0, 0, 0], 1)],
    ['a join, walking, timed', (pose) => { const m = mac(); m.hear({ t: 'join', id: 'eve-0003', name: 'Eve', look: null, pose }, 0); return m; }, eveAt([0, 0, 0], 1, 5_000_000)],
    ['a stranger\'s first pose, running, timed', (pose) => { const m = mac(); m.hear({ t: 'pose', id: 'eve-0003', p: pose }, 0); return m; }, eveAt([0, 0, 0], 2, 5_000_000)],
  ];
  for (const [what, open, pose] of intros) {
    const m = open(pose);
    const d = m.frames(150).filter(Boolean);
    assert.ok(d.length >= 140, `${what}: drawn`);
    assert.ok(inPlace(d) <= HOLD_FRAMES, `${what}: drawn in place reading moving ${inPlace(d)} frames - at most the hold's ${HOLD_FRAMES}`);
    assert.ok(d.slice(-100).every((f) => f.mv === 0), `${what}: and standing for the rest of the silence`);
  }
}));

test('AUDIT 637 C1: a peer introduced with NO pose and posed later is drawn from its first pose, its first frame a step (mutants: the first frame read off a drawn place that is not there)', () => quiet(() => {
  const m = mac({ peers: [{ id: 'eve-0003', name: 'Eve', look: null, pose: null }] });
  assert.deepEqual(m.frames(10), Array(10).fill(null), 'nothing drawn before a pose');
  const eve = speaker(m);
  const d = eve.walk(2000).slice(40);
  assert.equal(inPlace(d), 0, 'then walking, never drawn in place');
  assert.ok(d.every((f) => f.mv === 1), 'and read moving');
}));

// ─── C4: a snap is a step ────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT 637 C4: a peer that SNAPS after standing - a teleport, a pose past the snap - reads its new pose\'s own `mv` on the first frame drawn there: the snap moved the drawn place, and a snap writing `shown` itself no longer hides that (mutants: the place compared with `shown` again)', () => quiet(() => {
  const m = mac({ peers: [{ id: 'eve-0003', name: 'Eve', look: null, pose: eveAt([0, 0, 0], 0, 5_000_000) }] });
  const eve = speaker(m);
  eve.walk(1500);
  const quiet1 = eve.walk(1000, { send: () => false });
  assert.ok(quiet1.slice(-30).every((f) => f.mv === 0), 'her silence stood her');
  eve.teleport(2 * SNAP_WORLD_UNITS);
  const after = eve.walk(600);
  const there = after.findIndex((f) => f.x > quiet1.at(-1).x + SNAP_WORLD_UNITS);
  assert.ok(there >= 0, 'snapped to the new place');
  assert.ok(after.slice(there).every((f) => f.mv === 1), `and read moving from the first frame there (${after.slice(there).filter((f) => !f.mv).length} frames standing)`);
}));

// ─── C3: the pins the hold was missing ───────────────────────────────────────────────────────────────────────────

test('AUDIT 637 C3: a RUNNER (`mv` 2) whose poses stop stands within the hold, and reads running until then - the report\'s own case (mutants: only a walker stood)', () => quiet(() => {
  const m = mac({ peers: [{ id: 'eve-0003', name: 'Eve', look: null, pose: eveAt([0, 0, 0], 0, 5_000_000) }] });
  const eve = speaker(m, { mv: 2, step: [40, 0, 0] });
  const run = eve.walk(2000).slice(40);
  assert.ok(run.every((f) => f.mv === 2), 'read running while she runs');
  const gone = eve.walk(2000, { send: () => false });
  assert.ok(inPlace(gone) <= HOLD_FRAMES, `drawn in place reading running ${inPlace(gone)} frames - at most the hold's ${HOLD_FRAMES}`);
  assert.ok(gone.slice(-100).every((f) => f.mv === 0), 'then standing');
}));

test('AUDIT 637 C3: the drawn PLACE is all three coordinates - a peer walking along z alone, or climbing along y alone, walks; a steady walk is never stood (mutants: z not read; y not read)', () => quiet(() => {
  for (const [what, step] of [['along z', [0, 0, 20]], ['up y', [0, 5, 0]]]) {
    const m = mac({ peers: [{ id: 'eve-0003', name: 'Eve', look: null, pose: eveAt([0, 0, 0], 0, 5_000_000) }] });
    const d = speaker(m, { step }).walk(3000).slice(40);
    assert.equal(inPlace(d), 0, `${what}: never drawn in place`);
    assert.ok(d.every((f) => f.mv === 1), `${what}: and never read standing (${d.filter((f) => !f.mv).length} frames)`);
  }
}));

test('AUDIT 637 C3: THE EDGE IS THE SENDER\'S - a body stands on the frame SHOWN_MOVE_HOLD_MS after the last frame its drawn place moved, never one sooner and never one later (world.js: moving while now < moved + ONLINE_MOVE_HOLD_MS) (mutants: the edge one frame late; the hold halved at its use)', () => quiet(() => {
  for (const timed of [true, false]) {
    const m = mac({ peers: [{ id: 'eve-0003', name: 'Eve', look: null, pose: eveAt([0, 0, 0], 0, timed ? 5_000_000 : null) }] });
    const eve = speaker(m, { timed });
    eve.walk(2000);
    const d = eve.walk(1500, { send: () => false });
    let last = -1;
    for (let i = 1; i < d.length; i++) if (!still(d[i], i, d)) last = i;
    const stood = d.findIndex((f) => f.mv === 0);
    assert.ok(last >= 0 && stood > last, `${timed ? 'timed' : 'untimed'}: walked to the end, then stood`);
    assert.equal(stood - last, HOLD_FRAMES, `${timed ? 'timed' : 'untimed'}: stood ${(stood - last) * 10} ms after the last step - the hold is ${SHOWN_MOVE_HOLD_MS}`);
  }
}));

// ─── C2: a far peer from a slow sender walks ─────────────────────────────────────────────────────────────────────

/** A far listener hearing a 10 fps sender in a crowd: its gate rounds 250 ms up to 300 (three frames), and the far
 *  tier passes one in four - a pose every 1,200 ms of her time, 240 units on (5 m/s), on a line of 40-70 ms. */
const farSlow = () => {
  const m = mac({ peers: [{ id: 'eve-0003', name: 'Eve', look: null, pose: eveAt([0, 0, 0], 0, 5_000_000) }] });
  return { m, eve: speaker(m, { every: 1200, step: [240, 0, 0], jitter: [0, 17, 5, 29, 11] }) };
};

test('AUDIT 637 C2: a FAR peer from a SLOW sender walks - its poses come 1,200 ms apart (the far tier\'s one in four, each rounded up to the sender\'s frames), and it is drawn walking the whole way: never standing, never read standing, its stride never started over (it stood 350-570 ms at every pose: counted as GAP_MAX_MS, a second of each interval was walked and the rest stood, and RUN-IN-PLACE read every stand as a stop) (mutants: the timed interval clamped at GAP_MAX_MS again; a moving peer\'s own interval not walked whole)', () => quiet(() => {
  const { m, eve } = farSlow();
  eve.walk(10_000);
  assert.equal(m.eve().gap, 1200, 'the cadence is her own interval, not GAP_MAX_MS');
  const d = eve.walk(24_000);
  assert.ok(d.every((f) => f.mv === 1), `never read standing (${d.filter((f) => !f.mv).length} frames of ${d.length})`);
  assert.ok(inPlace(d) <= 2, `and drawn in place on ${inPlace(d)} frames`);
}));

test('AUDIT 637 C2: A MOVING PEER\'S SILENCE IS STILL NOT WALKED - past GAP_MAX_MS, or past its own interval where that is longer, the excess is stood at the last waypoint and the step walked over the longer of the two; a regular interval is walked whole (mutants: every moving interval walked whole; the timed interval clamped; the own interval not walked whole)', () => quiet(() => {
  /** the newest waypoint's segment once the pose that ends it lands: [its length, whether a copy of the last place stands before it] */
  const seg = (p) => { const a = p.path.at(-1), b = p.path.at(-2), c = p.path.at(-3); return [a.c - b.c, !!c && b.pose.x === c.pose.x && b.pose.z === c.pose.z]; };
  // a near peer (100 ms) whose sender hitches 1.5 s: a second walked, the rest stood
  {
    const m = mac({ peers: [{ id: 'eve-0003', name: 'Eve', look: null, pose: eveAt([0, 0, 0], 0, 5_000_000) }] });
    const eve = speaker(m);
    eve.walk(2000);
    eve.walk(1500, { send: () => false });
    eve.walk(200);
    assert.deepEqual(seg(m.eve()), [GAP_MAX_MS, true], 'a near peer\'s hitch: the step walked over GAP_MAX_MS, the rest stood');
  }
  // the far peer: its regular 1,200 walked whole; a pose lost (2,400, past PAUSE_MS - no rate) stands the excess
  {
    const { m, eve } = farSlow();
    eve.walk(10_000);
    eve.walk(1200);
    assert.deepEqual(seg(m.eve()), [1200, false], 'a far peer\'s regular interval: walked whole');
    let k = 0;
    eve.walk(2500, { send: () => k++ > 0 });
    assert.ok(2400 > PAUSE_MS && m.eve().gap === 1200, 'the lost pose\'s silence is no rate');
    assert.deepEqual(seg(m.eve()), [1200, true], 'and past its own interval the excess is stood, the step walked over its interval');
  }
}));

test('AUDIT 637 C1/C2: one home - the hold reads the place the law itself last drew, and a timed interval is the sender\'s own (the arrival interval keeps its clamp)', () => {
  const src = readFileSync(new URL('../src/net/online.js', import.meta.url), 'utf8');
  assert.match(src, /const was = p\.drawn, s = poseAlong\(p\.path, p\.cur\);/);
  assert.match(src, /p\.shown = p\.drawn = s;/);
  assert.equal(src.match(/\bp\.drawn\b(?!At)/g).length, 2, 'and nothing else writes or reads it');
  assert.match(src, /\(p\.cadence \?\?= \[\]\)\.push\(Math\.min\(GAP_MAX_MS, since\)\);/, 'NET-SMOOTH\'s arrival interval: clamped, the line\'s jitter is in it');
});
