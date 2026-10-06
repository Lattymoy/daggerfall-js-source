// FIELD BUGS 2026-10-06b / AUDIT 637 (Mac: "theres a lot of player desync online, including players appearing to run in
// place"): THE PLAY-OUT PROBE - how another player's body is drawn while their poses arrive late, or stop, or come
// sparse. bible/01-Overview/Field-Bugs-2026-10-06b.md, bible/01-Overview/Audit-637.md (AUDIT 637 D13: the record's
// tables came from a harness in a session's scratch, and nothing in the tree could make them again).
//
// Two REAL OnlineSessions on one fake clock, over fake sockets: Eve, the sender, walks at 5 m/s and says her poses through
// the real sendPose gate and stamp at her own frame rate (her `mv` the world host's law: moving while a frame moved
// within the hold); a small relay forwards them - every one, or as the far tier does, one in POSE_FAR_SHARE by turn and a
// standing pose whole once a KEEPALIVE_FAN_MS - to Mac, `40 ms + jitter` later and in order, as one socket's frames are;
// Mac ticks at 60 fps and the probe reads what he draws of her each frame:
//   in place   frames drawn where the frame before drew her, reading moving - running on the spot
//   longest    the longest such run
//   restarts   frames that read moving after one that read standing - a walk cycle started over
//   lag        how far behind her true place she is drawn, on average
// The sender never stands still here unless the row says so, so every restart is the play-out's, not hers.
//
// Run:  node tools/playoutProbe.mjs            (TREE=<dir> plays another worktree's net/online.js - a before)
//   SECONDS=30   each row's length
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const ROOT = process.env.TREE || fileURLToPath(new URL('..', import.meta.url));
const at = (p) => pathToFileURL(join(ROOT, p)).href;
const { OnlineSession, poseHzFor } = await import(at('src/net/online.js'));
const { PIXEL_UNITS, WORLD_CELL, POSE_FAR_SHARE, KEEPALIVE_FAN_MS, poseChanged } = await import(at('src/net/wire.js'));
const { fakeSocketClass } = await import(at('test/fakeSocket.mjs'));
const SECONDS = Number(process.env.SECONDS || 30);

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** One row: Eve to Mac for SECONDS, the first 3 s (the cadence settling) not counted. */
function row({ crowd = 0, far = false, jitter = 0, hitchEveryMs = 0, hitchMs = 0, timed = true, sendFps = 60, frameJit = 0, seed = 7 }) {
  const info = console.info, warn = console.warn;
  console.info = () => {}; console.warn = () => {};
  try {
    const R = rng(seed);
    const U = PIXEL_UNITS, cx = 25, cz = 15;
    const base = { x: (cx * WORLD_CELL + 8) * U, y: 0, z: (cz * WORLD_CELL + 8) * U, yaw: 0, pitch: 0, mv: 0 };
    const clock = { now: 1_700_000_000_000 };
    const E = fakeSocketClass();
    const eve = new OnlineSession({ url: 'wss://relay.test', name: 'Eve', id: 'eve-0003', secret: 'secret-of-eve-0003', WebSocketImpl: E.FakeWS, now: () => clock.now });
    eve.join(`world:${cx},${cz}`, base); E.sockets[0].open();
    const roster = [{ id: 'mac-0001', name: 'Mac', look: null, pose: { ...base } }];
    for (let i = 0; i < crowd; i++) roster.push({ id: `dum-${String(i).padStart(4, '0')}`, name: 'D', look: null, pose: { ...base, x: base.x + 50 + i } });   // her crowd: poseHzFor
    E.sockets[0].receive({ t: 'welcome', id: 'eve-0003', peers: roster, host: null, world: null });
    const M = fakeSocketClass();
    const mac = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: M.FakeWS, now: () => clock.now });
    mac.join(`world:${cx},${cz}`, base); M.sockets[0].open();
    M.sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'eve-0003', name: 'Eve', look: null, pose: { ...base, x: base.x + 400 } }], host: null, world: null });
    let relayPose = null, turn = 0, kept = 0, tail = 0, sentIdx = E.sockets[0].sent.length;
    const q = [];
    let x = base.x + 400, movingUntil = -Infinity, lastX = null, lastFrame = clock.now;
    const t0 = clock.now, end = t0 + SECONDS * 1000, recvDt = 1000 / 60;
    let nextSend = t0, nextRecv = t0 + recvDt / 3, hitchUntil = -Infinity, nextHitch = hitchEveryMs ? t0 + hitchEveryMs : Infinity;
    const drawn = [];
    while (clock.now < end) {
      const tn = Math.min(nextSend, nextRecv, q.length ? q[0].at : Infinity);
      clock.now = tn;
      if (tn === nextSend) {
        nextSend += (1000 / sendFps) * (1 + frameJit * (2 * R() - 1));
        if (clock.now >= nextHitch) { hitchUntil = clock.now + hitchMs; nextHitch += hitchEveryMs; }
        if (clock.now >= hitchUntil) {   // her frame ran: she walks (her motor's dt clamped at 100 ms, as a frame's is)
          x += (200 * Math.min(clock.now - lastFrame, 100)) / 1000;
          lastFrame = clock.now;
          if (lastX !== null && x !== lastX) movingUntil = clock.now + 250;
          lastX = x;
          eve.sendPose({ ...base, x, mv: clock.now < movingUntil ? 1 : 0 });
          const sent = E.sockets[0].sent;
          for (; sentIdx < sent.length; sentIdx++) {
            const m = JSON.parse(sent[sentIdx]);
            if (m.t !== 'pose') continue;
            const p = m.p;
            if (!timed) delete p.ts;   // an older relay's untimed poses: NET-SMOOTH's play-out
            const still = !!relayPose && (!poseChanged(relayPose, p) || ((relayPose.mv | 0) !== 0 && (p.mv | 0) === 0)) && clock.now - kept >= KEEPALIVE_FAN_MS;
            turn = (turn + 1) & 0xffff;
            if (still) kept = clock.now;
            relayPose = p;
            if (far && !still && turn % POSE_FAR_SHARE !== 0) continue;   // the far tier: one in POSE_FAR_SHARE
            const atMs = Math.max(clock.now + 40 + R() * jitter, tail); tail = atMs;
            q.push({ at: atMs, frame: { t: 'pose', id: 'eve-0003', p } });
          }
        } else lastFrame = clock.now;   // her loop did not run: nothing moved, nothing said
      }
      while (q.length && q[0].at <= clock.now) M.sockets[0].receive(q.shift().frame);
      if (tn === nextRecv) {
        nextRecv += recvDt;
        mac.tick();
        const e = mac.peers.get('eve-0003');
        if (clock.now - t0 > 3000 && e?.shown) drawn.push({ x: e.shown.x, mv: e.shown.mv, lag: (x - e.shown.x) / 0.2 });
      }
    }
    let inPlace = 0, runN = 0, longest = 0, restarts = 0, lag = 0;
    for (let i = 1; i < drawn.length; i++) {
      if (drawn[i].x === drawn[i - 1].x && drawn[i].mv) { inPlace++; runN++; longest = Math.max(longest, runN); } else runN = 0;
      if (!drawn[i - 1].mv && drawn[i].mv) restarts++;
      lag += drawn[i].lag;
    }
    return { frames: drawn.length, inPlace, longestMs: Math.round(longest * recvDt), restarts, lagMs: Math.round(lag / Math.max(1, drawn.length - 1)), hz: poseHzFor(crowd + 1) };
  } finally { console.info = info; console.warn = warn; }
}

const ROWS = [
  ['RUN-IN-PLACE: the near tier (10 Hz)', [
    ['steady 60 fps', {}],
    ['a tab in the background 3 s of every 10', { hitchEveryMs: 10_000, hitchMs: 3000 }],
    ['a 250 ms hitch every 2 s', { hitchEveryMs: 2000, hitchMs: 250 }],
    ['a 120 ms frame every 0.7 s', { hitchEveryMs: 700, hitchMs: 120 }],
  ]],
  ['AUDIT 637 C2: the far tier (a crowd of 60: 4 Hz, one in four)', [
    ['60 fps', { crowd: 60, far: true }],
    ['20 fps', { crowd: 60, far: true, sendFps: 20 }],
    ['15 fps', { crowd: 60, far: true, sendFps: 15 }],
    ['12 fps', { crowd: 60, far: true, sendFps: 12.1 }],
    ['10 fps', { crowd: 60, far: true, sendFps: 10 }],
    ['15 fps, +-30% a frame', { crowd: 60, far: true, sendFps: 15, frameJit: 0.3 }],
    ['10 fps, +-30% a frame', { crowd: 60, far: true, sendFps: 10, frameJit: 0.3 }],
  ]],
];
let measured = 0;
for (const [title, rows] of ROWS) {
  console.log(`\n${title} - the line 40-70 ms, ${SECONDS} s a row, timed and untimed; in place / longest / restarts / lag`);
  for (const [label, o] of rows) {
    const t = row({ jitter: 30, ...o }), u = row({ jitter: 30, ...o, timed: false });
    measured += t.frames + u.frames;
    const cell = (r) => `${String(r.inPlace).padStart(5)} ${String(r.longestMs).padStart(5)} ms ${String(r.restarts).padStart(4)} ${String(r.lagMs).padStart(5)} ms`;
    console.log(`${label.padEnd(44)} timed ${cell(t)}   untimed ${cell(u)}`);
  }
}
if (!(measured > 0)) throw new Error('playoutProbe: no frame was drawn');
