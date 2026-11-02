// PVP-REF (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and do sieges"; "Continue"): THE MEASUREMENT GATE
// (bible/11-Multiplayer/Seats-Arc.md 6.1: "PVP-REF's slice must run a full room - 40 fighters, 60 spectators and 6
// relay-run guards ... with headless clients, the SLAM probes' way, at or under 60% of every room budget
// (FOES_ROOM_BYTES_PER_S, HIT_ROOM_BYTES_PER_S, the pose fan). If it cannot, siege sizes drop to 8 against 8 and 16
// against 16 until it can").
//
// The real Room on the fake Durable Object (test/fakeRoom.mjs), 106 headless sockets in one siege room for ten seconds
// of the room's clock: every one of them MOVING and posing at the client's own crowded rate (net/online.js poseHzFor -
// 4 a second at 105 peers), each of the 40 fighters striking the man in front of it at the referee's ceiling (four
// blows a second, every one landing and fanned), and casting at the window's (three a five seconds). The six guards are
// SEAT2b's - relay-run, so their poses will be the relay's own fan; here they are six more sockets posing as a fighter
// does, which is what that fan will cost. Every byte the room sends is counted at the socket.
//
// THE BUDGETS, as the relay defines them: FOES_ROOM_BYTES_PER_S is a room's egress for its heaviest stream (a cell's
// foes, fanned) - the siege's own frames (vitality, falls, rises) are that stream's peer here; HIT_ROOM_BYTES_PER_S is
// what one destination may receive of the room's blows a second; and the pose fan's is the bound's own design point
// (SLAM1/SLAM6: 200 standing in one block, every one moving - N x (POSE_FAN_MAX + the rest / POSE_FAR_SHARE) x
// POSE_HZ_MIN = 59,000 sends a second, arithmetic).
//
// MEASURED (2026-10-01, this file): 106 sockets at 4 Hz - 21,293 pose sends a second (36% of the 59,000; 3,407 KiB/s, the
// town's own per-send cost, nothing a siege adds); 160 blows and 24 casts landed a second, fanned as 19,462 siege sends,
// 1,045 KiB/s (26% of FOES_ROOM_BYTES_PER_S's 4,096); the busiest socket 10 KiB/s of siege frames (4% of
// HIT_ROOM_BYTES_PER_S's 256), 50 KiB/s of everything. The sizes stand - 6.4's 20 a side and 4 sellswords - and the fall
// to 8/16 is not taken. What this cannot measure is a deployed object's CPU (AUDIT SLAM FINAL C1's caveat, kept): the
// counts are the room's own sends, observed on the fake, not a Cloudflare isolate's ceiling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siegeRoomKey, SIEGE_UNITS_PER_M, SIEGE_BLOWS_HZ, SIEGE_CASTS } from '../../src/net/siege/siegeRef.js';
import { FOES_ROOM_BYTES_PER_S, HIT_ROOM_BYTES_PER_S, POSE_FAN_MAX, POSE_FAR_SHARE } from '../../src/net/wire.js';
import { poseHzFor, POSE_HZ_MIN } from '../../src/net/online.js';
import { fakeRoom } from '../fakeRoom.mjs';

const M = SIEGE_UNITS_PER_M;
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [{ templateIndex: 123, group: 'Weapons', equipSlot: 19, material: 9 }] };   // PIN MOVED (AUDIT-SEATS): R8 - the weapon in the right hand (EquipSlots.RightHand 19); slot 0 is an amulet's, and a weapon there is held no more
const SHARE = 0.6;
const SECONDS = 10;
/** The pose fan's design point (SLAM1/SLAM6): 200 in one block, all moving, at the crowded floor. */
const SLAM_N = 200;
const POSE_FAN_REF = SLAM_N * (POSE_FAN_MAX + (SLAM_N - 1 - POSE_FAN_MAX) / POSE_FAR_SHARE) * POSE_HZ_MIN;

/** Ten seconds of a full siege room: `fighters` (half a side each, paired across a 2 m line), `spectators` and `guards`. */
async function fullRoom({ fighters = 40, spectators = 60, guards = 6 } = {}) {
  const realNow = Date.now; let clock = 1_800_000_000_000; Date.now = () => clock;
  try {
    const r = fakeRoom(siegeRoomKey(3021, 20), { now: () => clock });
    const n = fighters + spectators + guards;
    const peers = [];
    for (let i = 0; i < n; i++) {
      const id = `peer-${String(i + 1).padStart(4, '0')}`;
      const kind = i < fighters ? 'fighter' : i < fighters + spectators ? 'spectator' : 'guard';
      // fighters in pairs across the line (x 0 and 2 m), each pair its own lane; the rest stand back on the walls
      const lane = kind === 'fighter' ? Math.floor(i / 2) * 3 : (i - fighters) * 2;
      const x0 = kind === 'fighter' ? (i % 2) * 2 : -30 - (kind === 'guard' ? 5 : 0);
      const ws = r.connect();
      const p0 = { x: x0 * M, y: 0, z: lane * M, yaw: 0, pitch: 0, mv: 1 };
      await r.hello(ws, id, p0, { glyphs: ['dev'], lv: 25, look: LOOK });
      clock += 1000 / 10;   // under the room's hello gate
      peers.push({ id, ws, kind, x0, lane });
    }
    for (const p of peers) if (p.kind === 'fighter') await r.raw(p.ws, JSON.stringify({ t: 'siege', k: 'in' }));
    // count at the socket from here: every frame, its bytes, by kind
    const per = new Map();
    const tally = { pose: { n: 0, b: 0 }, siege: { n: 0, b: 0 }, other: { n: 0, b: 0 } };
    for (const p of peers) {
      const mine = { siege: 0, all: 0 };
      per.set(p.id, mine);
      p.ws.send = function (s) {
        if (this.closed) throw new Error('closed');
        const kind = s.startsWith('{"t":"pose"') ? 'pose' : s.startsWith('{"t":"siege"') ? 'siege' : 'other';
        tally[kind].n++; tally[kind].b += s.length;
        mine.all += s.length;
        if (kind === 'siege') mine.siege += s.length;
      };
    }
    const hz = poseHzFor(n - 1);
    const start = clock;
    const poseEvery = 1000 / hz;
    const blowEvery = 1000 / SIEGE_BLOWS_HZ;
    const castEvery = SIEGE_CASTS.windowMs / SIEGE_CASTS.max + 1;
    let landed = 0, cast = 0;
    const lastPose = new Map(), lastBlow = new Map(), lastCast = new Map();
    // a 25 ms tick: each socket acts when its own interval has come, staggered by its index so the room is not one burst
    for (let t = 0; t < SECONDS * 1000; t += 25) {
      clock = start + t;
      for (let k = 0; k < peers.length; k++) {
        const p = peers[k];
        const off = (k * 7) % 25 * 10;
        if (t >= off && t - (lastPose.get(p.id) ?? -Infinity) >= poseEvery) {
          lastPose.set(p.id, t);
          // everyone walks the lane at 4 m/s, turning about every 5 s - always moving, so no keepalive is ever spared the tier
          const z = p.lane + 4 * ((t % 10000) < 5000 ? (t % 5000) / 1000 : (5000 - (t % 5000)) / 1000);
          await r.pose(p.ws, { x: p.x0 * M, y: 0, z: z * M, yaw: (t / 1000) % 3, pitch: 0, mv: 1 });
        }
        if (p.kind !== 'fighter') continue;
        const foe = peers[k ^ 1].id;
        if (t >= off && t - (lastBlow.get(p.id) ?? -Infinity) >= blowEvery) {
          lastBlow.set(p.id, t);
          const before = tally.siege.n;
          await r.raw(p.ws, JSON.stringify({ t: 'siege', k: 'blow', to: foe, w: 123, m: 9, d: 1, r: 0 }));
          if (tally.siege.n > before) landed++;
        }
        if (t >= off && t - (lastCast.get(p.id) ?? -Infinity) >= castEvery) {
          lastCast.set(p.id, t);
          const before = tally.siege.n;
          await r.raw(p.ws, JSON.stringify({ t: 'siege', k: 'cast', to: foe, d: 1 }));
          if (tally.siege.n > before) cast++;
        }
      }
    }
    const s = SECONDS;
    const worst = Math.max(...[...per.values()].map((x) => x.siege)) / s;
    return {
      n, hz, landed: landed / s, cast: cast / s,
      poseSends: tally.pose.n / s, poseBytes: tally.pose.b / s,
      siegeBytes: tally.siege.b / s, siegeSends: tally.siege.n / s,
      worstDest: worst, worstDestAll: Math.max(...[...per.values()].map((x) => x.all)) / s,
      kept: Object.values(r.room._siege.fighters).filter((f) => !f.down).length,
    };
  } finally { Date.now = realNow; }
}

test('PVP-REF THE MEASUREMENT (6.1): a full room - 40 fighters, 60 spectators, 6 guards, all moving at the client\'s crowded rate, every fighter striking at four a second and casting at the window\'s - runs at or under 60% of every room budget: the pose fan against SLAM\'s 200-in-a-block, the siege\'s fanned frames against FOES_ROOM_BYTES_PER_S, the most any one socket receives of them against HIT_ROOM_BYTES_PER_S - so the sizes stand (no fall to 8/16)', async () => {
  const m = await fullRoom();
  const line = `${m.n} sockets at ${m.hz} Hz: ${Math.round(m.poseSends)} pose sends/s (${Math.round(m.poseBytes / 1024)} KiB/s) against ${Math.round(POSE_FAN_REF)}; ${Math.round(m.landed)} blows and ${m.cast.toFixed(1)} casts landed a second, ${Math.round(m.siegeSends)} siege sends/s, ${Math.round(m.siegeBytes / 1024)} KiB/s against ${FOES_ROOM_BYTES_PER_S / 1024} KiB/s; the busiest socket ${Math.round(m.worstDest / 1024)} KiB/s of siege frames against ${HIT_ROOM_BYTES_PER_S / 1024} KiB/s (${Math.round(m.worstDestAll / 1024)} KiB/s of everything)`;
  assert.equal(m.n, 106);
  assert.equal(m.hz, POSE_HZ_MIN, 'the crowded floor');
  assert.ok(m.landed >= 40 * SIEGE_BLOWS_HZ * 0.95, `every fighter landing at the ceiling (${m.landed})`);
  assert.ok(m.cast >= 40 * (SIEGE_CASTS.max / (SIEGE_CASTS.windowMs / 1000)) * 0.9, `and casting at the window's (${m.cast})`);
  assert.equal(m.kept, 40, 'nobody fell: every blow fanned');
  assert.ok(m.poseSends <= SHARE * POSE_FAN_REF, `the pose fan: ${line}`);
  assert.ok(m.siegeBytes <= SHARE * FOES_ROOM_BYTES_PER_S, `the room's siege egress: ${line}`);
  assert.ok(m.worstDest <= SHARE * HIT_ROOM_BYTES_PER_S, `one destination's: ${line}`);
});
