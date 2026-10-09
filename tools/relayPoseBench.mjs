// PERF-RELAY1 (2026-10-09, Mac: "Yes and audit everything", of PERF-NEXT item 15): THE RELAY'S POSE PATH, MEASURED - what
// one moving pose costs the room it is said in, on the REAL Room (server/src/index.js) over the relay pins' fake object
// (test/fakeRoom.mjs), every hello a real signed token. The sockets COUNT what they are sent and parse nothing (the fake's
// own socket parses every frame it is handed, which would be most of what this measured). One clock, the bench's own
// (Date.now), so every socket's pose gate passes the way a client at its rate passes it.
//
//   node tools/relayPoseBench.mjs                 crowds of 50, 100 and 200 in one map pixel
//   N=200,400 POSES=4000 node tools/relayPoseBench.mjs
//
// It prints, per crowd: microseconds a moving pose (the room's whole handling of the frame: the parse, the meter, the
// fan, the sends to counting sockets) and the frames sent a pose. Node's CPU, relative only - an A/B is two runs of this
// file, the base's and the change's, one after the other.
import { fakeRoom } from '../test/fakeRoom.mjs';
import { PIXEL_UNITS, POSE_HZ_MAX } from '../src/net/wire.js';

const CROWDS = (process.env.N || '50,100,200').split(',').map(Number);
const POSES = Number(process.env.POSES || 3000);
const quiet = () => { console.info = () => {}; console.warn = () => {}; console.log = (...a) => out.push(a.join(' ')); };
const out = [];
const print = (...a) => process.stdout.write(`${a.join(' ')}\n`);

async function crowd(n) {
  const realNow = Date.now;
  let clock = realNow();
  Date.now = () => clock;
  try {
    const px = 13 * 16 + 8, py = 13 * 16 + 8;
    const key = `world:${Math.floor(px / 16)},${Math.floor(py / 16)}`;
    const R = fakeRoom(key, { now: () => clock });
    const at = (i, t) => ({ x: (px + 0.5) * PIXEL_UNITS + Math.cos(i + t) * 900, y: 0, z: (499 - py + 0.5) * PIXEL_UNITS + Math.sin(i + t) * 900, yaw: (i + t) % 3, pitch: 0, mv: 1 });
    const socks = [];
    for (let i = 0; i < n; i++) {
      const ws = R.connect();
      clock += 200;   // past the room's hello gate
      await R.hello(ws, `peer-${String(i).padStart(4, '0')}`, at(i, 0));
      if (ws.closed) throw new Error(`bench: hello ${i} refused (${JSON.stringify(ws.closed)})`);
      socks.push(ws);
    }
    let sent = 0;
    for (const ws of socks) ws.send = () => { sent++; };   // counting, parsing nothing
    const frames = socks.map((_, i) => (t) => JSON.stringify({ t: 'pose', p: at(i, t) }));
    // a round: every socket says one moving pose, the clock a socket's gate interval on
    const round = async (t) => { for (let i = 0; i < n; i++) await R.room.webSocketMessage(socks[i], frames[i](t)); clock += Math.ceil(1000 / POSE_HZ_MAX) + 1; };
    for (let t = 1; t <= 3; t++) await round(t);   // warm
    sent = 0;
    const rounds = Math.max(1, Math.round(POSES / n));
    const t0 = performance.now();
    for (let t = 4; t < 4 + rounds; t++) await round(t);
    const ms = performance.now() - t0;
    const poses = rounds * n;
    return { n, us: (ms * 1000) / poses, sends: sent / poses, poses };
  } finally { Date.now = realNow; }
}

const keep = { info: console.info, warn: console.warn, log: console.log };
quiet();
try {
  print('crowd   us a moving pose   frames sent a pose   (poses timed)');
  for (const n of CROWDS) {
    const r = await crowd(n);
    print(`${String(r.n).padStart(5)}   ${r.us.toFixed(1).padStart(16)}   ${r.sends.toFixed(1).padStart(18)}   (${r.poses})`);
  }
} finally { Object.assign(console, keep); }
