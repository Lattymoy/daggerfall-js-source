// SCALE5b (2026-10-10; bible/11-Multiplayer/Scale-Arc.md SCALE5b): WHAT THE SECOND WIRE SAVES, MEASURED ON THE REAL
// ROOM over the pins' fake object (test/fakeRoom.mjs) - every hello a signed token, every pose through the relay's own
// door. Two scenes, each run on the first wire (no socket offers `w2`) and on the second (every socket does):
//
//   CELL  N players in one cell's block, every one moving at the client's pose rate for SECONDS: the sends and the bytes
//         the room's fan made, and the batch frames.
//   HUB   N players arriving at a region's channel at the hub's own gate (CHAT_HELLO_HZ_MAX): the join and leave sends
//         the room made to everyone already there.
//
//   node tools/wire2Bench.mjs [CELL_N=120] [HUB_N=600] [SECONDS=5]
//
// A model of nothing: the Room's code runs; only the clock, the sockets and the storage are the harness's. The sends
// are `ws.send` calls the room made (what the runtime charges a Durable Object for), the bytes their lengths.
import { fakeRoom } from '../test/fakeRoom.mjs';
import {
  PIXEL_UNITS,
  POSE_HZ_MAX,
  POSE_BATCH_MS,
  ROSTER_BATCH_MS,
  CHAT_HELLO_HZ_MAX,
  chatRegionRoom,
} from '../src/net/wire.js';

const arg = (k, d) => Number(process.argv.find((a) => a.startsWith(`${k}=`))?.split('=')[1] ?? d);
const CELL_N = arg('CELL_N', 120),
  HUB_N = arg('HUB_N', 600),
  SECONDS = arg('SECONDS', 5);

/** A seeded roll (mulberry32). */
function roll(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Counts every send the room makes to a socket, and its bytes. */
function counted(R) {
  const c = { sends: 0, bytes: 0, batches: 0 };
  const connect = R.connect;
  R.connect = () => {
    const ws = connect();
    const send = ws.send.bind(ws);
    ws.send = (s) => {
      c.sends++;
      c.bytes += s.length;
      if (s.startsWith('{"t":"poses"') || s.startsWith('{"t":"fb"')) c.batches++;
      return send(s);
    };
    return ws;
  };
  return c;
}

async function onClock(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  const quiet = { info: console.info, warn: console.warn, log: console.log };
  console.info = console.warn = console.log = () => {};
  try {
    return await fn({
      now: () => clock,
      tick: (ms) => {
        clock += ms;
      },
    });
  } finally {
    Date.now = realNow;
    Object.assign(console, quiet);
  }
}

async function cellScene(w2) {
  return onClock(async ({ now, tick }) => {
    const BX = 13 * 16 + 8,
      BY = 13 * 16 + 8;
    const R = fakeRoom(`world:${Math.floor(BX / 16)},${Math.floor(BY / 16)}`, { now });
    const c = counted(R);
    const rnd = roll(7);
    const at = (i, k) => ({
      x: (BX + ((i * 37) % 100) / 100 + k * 0.002) * PIXEL_UNITS,
      y: 0,
      z: (499 - BY + ((i * 53) % 100) / 100) * PIXEL_UNITS,
      yaw: rnd() * 6 - 3,
      pitch: 0,
      mv: 1,
      ts: (k * 100) % 60000,
    });
    const socks = [];
    for (let i = 0; i < CELL_N; i++) {
      const ws = R.connect();
      tick(120);
      await R.hello(ws, `p-${String(i).padStart(4, '0')}`, at(i, 0), w2 ? { w2: 1 } : {});
      socks.push(ws);
    }
    R.room._flushOwed();
    for (const ws of socks) ws.sent.length = 0;
    const base = { ...c };
    const step = 1000 / POSE_HZ_MAX;
    let flushAt = now() + POSE_BATCH_MS;
    for (let k = 1; k <= SECONDS * POSE_HZ_MAX; k++) {
      for (let i = 0; i < socks.length; i++) {
        tick(step / socks.length);
        await R.pose(socks[i], at(i, k));
        if (now() >= flushAt) {
          R.room._flushOwed();
          flushAt += POSE_BATCH_MS;
        }
        socks[i].sent.length = 0;
      }
    }
    R.room._flushOwed();
    return { sends: c.sends - base.sends, bytes: c.bytes - base.bytes, batches: c.batches - base.batches };
  });
}

async function hubScene(w2) {
  return onClock(async ({ now, tick }) => {
    const R = fakeRoom(chatRegionRoom(5), { now });
    const c = counted(R);
    const socks = [];
    let flushAt = now() + ROSTER_BATCH_MS;
    for (let i = 0; i < HUB_N; i++) {
      const ws = R.connect();
      tick(Math.ceil(1000 / CHAT_HELLO_HZ_MAX) + 1);
      await R.hello(ws, `h-${String(i).padStart(4, '0')}`, null, w2 ? { w2: 1 } : {});
      socks.push(ws);
      if (now() >= flushAt) {
        R.room._flushOwed();
        flushAt += ROSTER_BATCH_MS;
      }
      for (const s of socks) s.sent.length = 0;
    }
    R.room._flushOwed();
    return { sends: c.sends, bytes: c.bytes, batches: c.batches };
  });
}

const fmt = (n) => n.toLocaleString('en-US');
const cell1 = await cellScene(false),
  cell2 = await cellScene(true);
const hub1 = await hubScene(false),
  hub2 = await hubScene(true);
console.log(`CELL: ${CELL_N} players moving in one block for ${SECONDS} s at ${POSE_HZ_MAX} Hz`);
console.log(
  `  first wire:  ${fmt(cell1.sends)} sends, ${fmt(cell1.bytes)} bytes (${fmt(Math.round(cell1.sends / SECONDS))} sends/s, ${(cell1.bytes / SECONDS / 1e6).toFixed(2)} MB/s)`,
);
console.log(
  `  second wire: ${fmt(cell2.sends)} sends, ${fmt(cell2.bytes)} bytes (${fmt(Math.round(cell2.sends / SECONDS))} sends/s, ${(cell2.bytes / SECONDS / 1e6).toFixed(2)} MB/s), ${fmt(cell2.batches)} batches`,
);
console.log(
  `  sends x${(cell1.sends / cell2.sends).toFixed(1)} fewer, bytes x${(cell1.bytes / cell2.bytes).toFixed(2)} fewer`,
);
console.log(`HUB: ${HUB_N} players arriving at a channel at its gate (${CHAT_HELLO_HZ_MAX}/s)`);
console.log(`  first wire:  ${fmt(hub1.sends)} sends, ${fmt(hub1.bytes)} bytes`);
console.log(`  second wire: ${fmt(hub2.sends)} sends, ${fmt(hub2.bytes)} bytes, ${fmt(hub2.batches)} batches`);
console.log(`  sends x${(hub1.sends / hub2.sends).toFixed(1)} fewer`);
