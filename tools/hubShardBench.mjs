// SCALE5c (2026-10-10; bible/11-Multiplayer/Scale-Arc.md SCALE5c): WHAT THE HUB'S SHARDS COST AND SAVE, MEASURED ON THE
// REAL ROOM over the pins' fake object (test/fakeRoom.mjs) - every hello a signed token through the relay's own door.
//
//   ONE HUB  N players on `chat:world` alone, as every build before SCALE5c: the time and the sends of each hello (its
//            join fanned to everyone there) and of one world line.
//   SHARDED  N players on their shards (net/hubShards.js): the time each shard spends on a hello, the BUS's time on
//            each (a ShardSocket made and greeted - the account's picture, the world's words), the time and the sends
//            of one world line, the bus's half and a shard's half apart, and the batches between them; then
//            PARTY: everyone in a party of four, each saying its party pose once a PARTY_SEND_MS (the steadiest
//            traffic through the bus) - the bus's time a pose and a shard's.
//
//   REGION   N players arriving at one region's channel (SCALE5c part two): the one room, then its four shards.
//
//   node tools/hubShardBench.mjs [ONE_N=2000] [SHARD_N=10000] [REGION_N=2000]
//
// Wall time in this process stands in for an object's CPU: the objects' own calls are timed apart (the doors between
// them are stubbed, each object fed what the other handed it), the token signing and the harness's socket are not
// counted. A model of nothing: the Room's code runs; only the clock, the sockets and the storage are the harness's.
import { performance } from 'node:perf_hooks';
import { fakeRoom } from '../test/fakeRoom.mjs';
import { SOCIAL_ROOM, CHAT_HELLO_HZ_MAX, PARTY_SEND_MS, PARTY_MAX, mintPartyId, chatRegionRoom } from '../src/net/wire.js';
import { shardOf, busOf, HUB_SHARD_ROOMS, REGION_SHARD_ROOMS, REGION_SHARDS, HUB_INTERNAL_UP, HUB_BATCH_MS } from '../src/net/hubShards.js';

const arg = (k, d) => Number(process.argv.find((a) => a.startsWith(`${k}=`))?.split('=')[1] ?? d);
const ONE_N = arg('ONE_N', 2000), SHARD_N = arg('SHARD_N', 10000), REGION_N = arg('REGION_N', 2000);

async function onClock(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  const quiet = { info: console.info, warn: console.warn, log: console.log };
  console.info = console.warn = console.log = () => {};
  try { return await fn({ now: () => clock, tick: (ms) => { clock += ms; } }); } finally { Date.now = realNow; Object.assign(console, quiet); }
}

/** A room whose sockets count their sends and keep nothing (the harness's own parse is not the room's cost). */
function counted(R) {
  const c = { sends: 0, bytes: 0 };
  const connect = R.connect;
  R.connect = () => {
    const ws = connect();
    ws.send = (s) => { if (ws.closed) throw new Error('closed'); c.sends++; c.bytes += s.length; };
    return ws;
  };
  return c;
}
const timed = async (box, fn) => { const t = performance.now(); try { return await fn(); } finally { box.ms += performance.now() - t; } };
/** A name the token's law issues (letters alone - a run of digits can read as something the name filter refuses). */
const name = (i) => `Trav${[...i.toString(26).padStart(4, '0')].map((d) => String.fromCharCode(97 + parseInt(d, 26))).join('')}`;
const hello = async (R, ws, n, extra = {}) => R.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}`, tok: await R.token(`peer-${n}`, { s: `acct-${n}`, n }), ...extra });

async function oneHub(N, key = SOCIAL_ROOM) {
  return onClock(async ({ tick }) => {
    const R = fakeRoom(key);
    const c = counted(R);
    const t = { ms: 0 }, last = { ms: 0, sends: 0 };
    const socks = [];
    for (let i = 0; i < N; i++) {
      const ws = R.connect();
      tick(Math.ceil(1000 / CHAT_HELLO_HZ_MAX) + 1);
      const before = c.sends, b = { ms: 0 };
      await timed(b, () => hello(R, ws, name(i)));
      t.ms += b.ms;
      if (i === N - 1) { last.ms = b.ms; last.sends = c.sends - before; }
      socks.push(ws);
    }
    R.room._flushOwed?.();
    const s0 = c.sends, line = { ms: 0 };
    tick(2000);
    await timed(line, () => R.chat(socks[0], 'hail'));
    return { helloMs: t.ms / N, lastMs: last.ms, lastSends: last.sends, lineMs: line.ms, lineSends: c.sends - s0 };
  });
}

async function sharded(N, busKey = SOCIAL_ROOM) {
  const keys = busKey === SOCIAL_ROOM ? HUB_SHARD_ROOMS : REGION_SHARD_ROOMS.filter((k) => busOf(k) === busKey);
  return onClock(async ({ tick }) => {
    // the shards, each handing its batches to a list (the bus fed them below); the bus, its deliveries to a list
    const ups = [];
    const shardRooms = (key) => ({ idFromName: (n) => n, get: () => ({ fetch: async (req) => { ups.push({ key, body: await req.text() }); return new Response('{"ok":1,"unknown":[]}'); } }) });
    const shards = new Map(keys.map((k) => { const R = fakeRoom(k, { ROOMS: shardRooms(k) }); return [k, { R, c: counted(R), t: { ms: 0 }, socks: [] }]; }));
    // HUB-PULL: the bus never calls a shard - what it seals for each waits in its outbox, taken here as the shard's poll
    // would be answered with it (and run by the shard's own `_hubDownApply`, its JSON read as the poll's answer is)
    const busRooms = { idFromName: (n) => n, get: () => ({ fetch: async () => new Response('{"ok":1}') }) };
    const bus = fakeRoom(busKey, { ROOMS: busRooms });
    const takeDowns = () => { const out = []; for (const [hub, box] of bus.room._outbox) { for (const e of box.l.splice(0)) out.push({ hub, body: e.body }); box.bytes = 0; } return out; };
    const busT = { ms: 0 };
    let hellos = 0;
    const flushUp = async () => {
      for (const s of shards.values()) await timed(s.t, () => s.R.room._hubUpFlush());
      for (const u of ups.splice(0)) await timed(busT, () => bus.room.fetch(new Request(`https://relay.internal${HUB_INTERNAL_UP}`, { method: 'POST', body: u.body })));
    };
    const busDown = { ms: 0 }, shardDown = { ms: 0 };
    const flushDown = async () => {
      await timed(busDown, () => bus.room._downFlush());
      for (const d of takeDowns()) { const s = shards.get(d.hub); await timed(shardDown, () => s.R.room._hubDownApply(JSON.parse(d.body))); }
    };
    // every shard's gate is its own: N hellos arrive at sixteen times the one hub's rate
    const step = Math.ceil(1000 / CHAT_HELLO_HZ_MAX) + 1;
    let flushAt = HUB_BATCH_MS;
    for (let i = 0; i < N; i++) {
      const n = name(i);
      const s = shards.get(shardOf(busKey, `acct-${n}`));
      const ws = s.R.connect();
      tick(step / keys.length);
      flushAt -= step / keys.length;
      await timed(s.t, () => hello(s.R, ws, n));
      s.socks.push(ws);
      hellos++;
      if (flushAt <= 0) { flushAt += HUB_BATCH_MS; await flushUp(); await flushDown(); }
    }
    await flushUp(); await flushDown();
    const shardHelloMs = [...shards.values()].reduce((a, s) => a + s.t.ms, 0) / hellos;
    const busHelloMs = (busT.ms + busDown.ms) / hellos;
    const wave = { busMs: busT.ms + busDown.ms, shardMs: Math.max(...[...shards.values()].map((s) => s.t.ms)) };
    // one world line from a shard's player: its shard hands it up, the bus fans it, every shard delivers it
    tick(2000);
    for (const s of shards.values()) { s.c.sends = 0; s.c.bytes = 0; }
    busT.ms = 0; busDown.ms = 0; shardDown.ms = 0;
    const first = [...shards.values()].find((s) => s.socks.length);
    const lineShard = { ms: 0 };
    await timed(lineShard, () => first.R.chat(first.socks[0], 'hail'));
    await flushUp();
    const downBytes = { n: 0 };
    await timed(busDown, () => bus.room._downFlush());
    const downs = takeDowns();
    for (const d of downs) downBytes.n += d.body.length;
    const perShard = [];
    for (const d of downs) { const s = shards.get(d.hub); const t0 = { ms: 0 }; await timed(t0, () => s.R.room._hubDownApply(JSON.parse(d.body))); perShard.push(t0.ms); }
    const sends = [...shards.values()].reduce((a, s) => a + s.c.sends, 0);
    const lineBusMs = busT.ms + busDown.ms;
    if (busKey !== SOCIAL_ROOM) return { N, shardHelloMs, busHelloMs, wave, lineBusMs, lineShardMaxMs: Math.max(...perShard), lineSends: sends, downBytes: downBytes.n, busSocks: bus.room._vsocks.size };   // a region's channel keeps no party
    // PARTY: parties of four seated on the bus's records, then one PARTY_SEND_MS of every member's party pose
    const P = Math.min(4, PARTY_MAX), groups = Math.floor(N / P);
    for (let g = 0; g < groups; g++) {
      const members = Array.from({ length: P }, (_, j) => `acct-${name(g * P + j)}`);
      const party = { id: mintPartyId(Math.random, Date.now()), leader: members[0], members, invites: [], away: {}, at: Date.now() };
      await bus.room._putParty(party);
      for (const m of members) { const rec = await bus.room._acct(m); await bus.room._putAcct(m, { ...rec, party: party.id }); bus.room._markParty(m, party.id); }
    }
    tick(PARTY_SEND_MS);
    busT.ms = 0; busDown.ms = 0; shardDown.ms = 0;
    const shardPose = { ms: 0 };
    const all = [...shards.values()].flatMap((s) => s.socks.map((ws) => [s, ws]));
    const pose = JSON.stringify({ t: 'party', p: { px: 1000, py: 1000, in: 0, loc: 'Daggerfall', h: 50, hm: 60, f: 40, fm: 40, m: 20, mm: 30, race: 'Breton', gender: 'male', face: 1 } });
    let poseFlush = HUB_BATCH_MS;
    for (const [s, ws] of all) {
      tick(PARTY_SEND_MS / all.length); poseFlush -= PARTY_SEND_MS / all.length;
      await timed(shardPose, () => s.R.raw(ws, pose));
      if (poseFlush <= 0) { poseFlush += HUB_BATCH_MS; await flushUp(); await flushDown(); }
    }
    await flushUp(); await flushDown();
    const partyBusMs = (busT.ms + busDown.ms) / all.length, partyShardMs = (shardPose.ms + shardDown.ms) / all.length;
    return { N, partyBusMs, partyShardMs, partyBusPerSec: busT.ms + busDown.ms, shardHelloMs, busHelloMs, wave, lineBusMs, lineShardMaxMs: Math.max(...perShard), lineSends: sends, downBytes: downBytes.n, busSocks: bus.room._vsocks.size };
  });
}

const f = (x, d = 3) => x.toFixed(d);
const one = await oneHub(ONE_N);
console.log(`ONE HUB: ${ONE_N} players on ${SOCIAL_ROOM}`);
console.log(`  a hello: ${f(one.helloMs)} ms on average; the ${ONE_N}th: ${f(one.lastMs)} ms and ${one.lastSends} sends`);
console.log(`  a world line: ${f(one.lineMs)} ms, ${one.lineSends} sends - all of it one object's`);
for (const N of [ONE_N, SHARD_N]) {
  const s = await sharded(N);
  console.log(`SHARDED: ${N} players on ${HUB_SHARD_ROOMS.length} shards (${Math.round(N / HUB_SHARD_ROOMS.length)} a shard), the bus holding ${s.busSocks} ShardSockets`);
  console.log(`  a hello: ${f(s.shardHelloMs)} ms on its shard, ${f(s.busHelloMs)} ms on the bus`);
  console.log(`  the whole wave: ${f(s.wave.busMs, 0)} ms of the bus's, ${f(s.wave.shardMs, 0)} ms of the busiest shard's`);
  console.log(`  party poses: ${f(s.partyBusMs)} ms on the bus a pose, ${f(s.partyShardMs)} ms on the shards - everyone in a party of four, one PARTY_SEND_MS: ${f(s.partyBusPerSec, 0)} ms of the bus's each second`);
  console.log(`  a world line: ${f(s.lineBusMs)} ms on the bus (${(s.downBytes / 1024).toFixed(1)} KiB to the shards), ${f(s.lineShardMaxMs)} ms on the busiest shard, ${s.lineSends} sends`);
}
const RB = /** @type {string} */ (chatRegionRoom(5));
const oneRegion = await oneHub(REGION_N, RB);
console.log(`ONE REGION: ${REGION_N} players on ${RB}`);
console.log(`  a hello: ${f(oneRegion.helloMs)} ms on average; the ${REGION_N}th: ${f(oneRegion.lastMs)} ms and ${oneRegion.lastSends} sends`);
console.log(`  a region line: ${f(oneRegion.lineMs)} ms, ${oneRegion.lineSends} sends`);
const region = await sharded(REGION_N, RB);
console.log(`REGION SHARDED: ${REGION_N} players on its ${REGION_SHARDS} shards, the bus holding ${region.busSocks} ShardSockets`);
console.log(`  a hello: ${f(region.shardHelloMs)} ms on its shard, ${f(region.busHelloMs)} ms on the bus`);
console.log(`  the whole wave: ${f(region.wave.busMs, 0)} ms of the bus's, ${f(region.wave.shardMs, 0)} ms of the busiest shard's`);
console.log(`  a region line: ${f(region.lineBusMs)} ms on the bus (${(region.downBytes / 1024).toFixed(1)} KiB to the shards), ${f(region.lineShardMaxMs)} ms on the busiest shard, ${region.lineSends} sends`);
