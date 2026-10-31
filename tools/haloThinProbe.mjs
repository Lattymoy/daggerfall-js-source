// ═══════════════════════════════════════════════════════════════════
// THE HALO PROBE (HALO-THIN, 2026-10-10). The owner: "For you when you
// are near a player ... Theres 10 position updates every time. Multiply
// it by the times the player is near you and its an insane bottleneck."
//
// A player near a cell's edge holds its own cell's socket and a halo's
// for each neighbour within range (wire.js cellHaloFor) - one at an
// edge, three at a corner. Every pose went down every one of them, and a
// listener holding the same rooms heard each pose once per room. This
// drives the REAL OnlineSession (its own sendPose, its own gates and
// clock) over test/fakeSocket.mjs for a player walking, running and
// riding past a corner and along an edge, and counts:
//
//   sent/s        pose frames the player's sockets carried a second - also
//                 the most copies a second a neighbour holding all the same
//                 rooms can receive (each room fans each to it once)
//   per pose      those copies for each pose it can use - an upper bound:
//                 the relay's far tier may serve it fewer
//
// "before" is every pose to every halo (the host's `haloWhole`, which is
// the old law exactly); "after" is the halo hearing a pose when it is due
// (net/online.js haloPoseDue). The counts are exact.
//
//   node tools/haloThinProbe.mjs
// ═══════════════════════════════════════════════════════════════════
import { OnlineSession, POSE_HZ } from '../src/net/online.js';
import { PIXEL_UNITS, WORLD_CELL } from '../src/net/wire.js';
import { fakeSocketClass } from '../test/fakeSocket.mjs';

const UNITS_PER_M = PIXEL_UNITS / 819.2;
const CELL = WORLD_CELL * PIXEL_UNITS;

/** One run: a player crossing near (cx, cz) - a cell's corner or edge - at `speedMps`, for `seconds`, its frames at
 *  60 a second. `halos` the halo rooms it holds there. */
function run({ halos, start, dir, speedMps, seconds = 60, whole }) {
  const { FakeWS, sockets } = fakeSocketClass();
  let clock = 1_000_000;
  const s = new OnlineSession({
    url: 'wss://relay.test',
    name: 'Mac',
    id: 'mac-0001',
    secret: 'shh-shh-shh-0001',
    WebSocketImpl: FakeWS,
    now: () => clock,
  });
  const pose = { x: start[0], y: 0, z: start[1], yaw: 0, pitch: 0, mv: 1 };
  s.join(`world:${Math.floor(start[0] / CELL)},${Math.floor(start[1] / CELL)}`, pose);
  sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [] });
  s.setHalo(halos);
  for (let i = 1; i < sockets.length; i++) {
    sockets[i].open();
    sockets[i].receive({ t: 'welcome', id: 'mac-0001', peers: [] });
  }
  s.haloWhole = whole;
  for (const ws of sockets) ws.sent.length = 0;
  const step = (speedMps * UNITS_PER_M) / 60;
  for (let f = 0; f < seconds * 60; f++) {
    clock += 1000 / 60;
    pose.x += dir[0] * step;
    pose.z += dir[1] * step;
    s.sendPose({ ...pose });
  }
  const poses = (ws) => ws.sent.filter((t) => t.startsWith('{"t":"pose"')).length;
  const primary = poses(sockets[0]);
  const halo = sockets.slice(1).reduce((a, ws) => a + poses(ws), 0);
  return {
    sent: (primary + halo) / seconds,
    primary: primary / seconds,
    copies: (primary + halo) / seconds,
    perPose: (primary + halo) / Math.max(1, primary),
  };
}

// a corner: the player in cell (1,1) 100 m from both of its low edges, holding the three cells round the corner; an
// edge: 100 m inside cell (1,1)'s west edge, holding the one cell across it - each walking along the edge, so it stays
const corner = {
  halos: ['world:0,1', 'world:1,0', 'world:0,0'],
  start: [CELL + 100 * UNITS_PER_M, CELL + 100 * UNITS_PER_M],
  dir: [0, 1],
};
const edge = { halos: ['world:0,1'], start: [CELL + 100 * UNITS_PER_M, CELL + 5 * PIXEL_UNITS], dir: [0, 1] };

console.log(
  `\nTHE HALO - a player walking past a cell's corner and along its edge (60 s each, its poses at up to ${POSE_HZ} a second)\n`,
);
console.log('place   pace          before: sent/s  copies per pose    after: sent/s  copies per pose');
for (const [name, at] of [
  ['corner', corner],
  ['edge', edge],
]) {
  for (const [pace, mps] of [
    ['walk 4 m/s', 4],
    ['run 8 m/s', 8],
    ['ride 16 m/s', 16],
  ]) {
    const b = run({ ...at, speedMps: mps, whole: true }),
      a = run({ ...at, speedMps: mps, whole: false });
    console.log(
      `${name.padEnd(7)} ${pace.padEnd(12)}  ${b.sent.toFixed(1).padStart(14)}  ${b.perPose.toFixed(2).padStart(15)}  ${a.sent.toFixed(1).padStart(14)}  ${a.perPose.toFixed(2).padStart(15)}`,
    );
  }
}
console.log(
  '\n(copies per pose: what a neighbour holding the same rooms receives for each pose it can use - one is enough)\n',
);
