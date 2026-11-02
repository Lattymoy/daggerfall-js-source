// FOES-FIRST (2026-10-21; bible/11-Multiplayer/Scale-Arc.md FOES-FIRST): THE FULL FRAMES FIRST ON A ROOM'S FOES BUDGET.
// The live relay's `world` rooms dropped 2.8% of their foes frames in ten hours (double14, 482k of 17.0M), every one to
// `_foesFan`'s room budget, and the readers tallied 285k grants never heard in nine: one bucket for every frame let the
// deltas hold it below what a full frame's fan costs, so the full frames - the sweep, the grants, the sites sprung, the
// handovers - were the ones lost. A delta now stops at FOES_FULL_RESERVE; a frame that goes first (a full one, once a
// second a sender; a sender unheard FOES_UNHEARD_MS) may borrow as far below empty (wire.js floorGate). And the blows a
// destination's funnels drop are counted (HIT-DROPS), with the full frames the budget dropped, on the metrics point's
// blobs. Held here over the real Room on the pins' fake object; tools/foesFirstBench.mjs measures it;
// tools/mutants/fb1021_foesfirst.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fakeRoom } from '../fakeRoom.mjs';
import { RoomMetrics } from '../../server/src/relayScale.js';
import * as relay from '../../server/src/relay.js';
import { floorGate, byteGate, foesFrameFull, foesFrameHandsOn, FOES_FULL_RESERVE, FOES_FIRST_MS, FOES_UNHEARD_MS, FOES_ROOM_BYTES_PER_S, FOES_FULL_MS, FOES_STALE_MS, PIXEL_UNITS, RELAY_VERSION } from '../../src/net/wire.js';
import { scene, SCENES } from '../../tools/foesFirstBench.mjs';

const RATE = FOES_ROOM_BYTES_PER_S;
const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };
/** A seeded roll (mulberry32) - every story replays. */
function roll(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
async function onClock(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try { return await quiet(() => fn({ now: () => clock, tick: (ms) => { clock += ms; } })); } finally { Date.now = realNow; }
}

test('FOES-FIRST the law: floorGate is byteGate\'s bucket spent to a floor - at 0 byteGate\'s own unborrowed law over random buckets and costs, a positive floor held back, a negative one a debt bounded by it, the refill capped at the rate; a frame is FULL when it says `full` 1 or carries the dungeon host\'s layout count; the reserve a quarter of the budget, a full frame first once a second, a sender unheard four seconds first, one law at both ends (mutants: the floor unread; the refill uncapped; the layout count unread; a truthy `full`; the constants moved)', () => {
  const rnd = roll(5);
  for (let k = 0; k < 400; k++) {
    const rate = 1000 + Math.floor(rnd() * 1e6), bytes = (rnd() - 0.3) * rate, now = 1000 + Math.floor(rnd() * 2000), cost = Math.floor(rnd() * rate * 1.5);
    assert.deepEqual(floorGate({ bytes, at: 1000 }, now, cost, rate, 0), byteGate({ bytes, at: 1000 }, now, cost, rate), `at 0, byteGate's own (${bytes}, ${cost}, ${rate})`);
  }
  assert.deepEqual(floorGate(null, 5, 10, 4000, 0), { bucket: { bytes: 3990, at: 5 }, pass: true }, 'a bucket never asked stands full');
  assert.deepEqual(floorGate({ bytes: 1000, at: 0 }, 0, 600, 4000, 400), { bucket: { bytes: 400, at: 0 }, pass: true }, 'a reserve: spent down to it');
  assert.deepEqual(floorGate({ bytes: 999, at: 0 }, 0, 600, 4000, 400), { bucket: { bytes: 999, at: 0 }, pass: false }, 'and no further - nothing spent');
  assert.deepEqual(floorGate({ bytes: 100, at: 0 }, 0, 600, 4000, -500), { bucket: { bytes: -500, at: 0 }, pass: true }, 'a debt: borrowed down to the floor');
  assert.deepEqual(floorGate({ bytes: 99, at: 0 }, 0, 600, 4000, -500), { bucket: { bytes: 99, at: 0 }, pass: false }, 'and no further');
  assert.deepEqual(floorGate({ bytes: -2000, at: 0 }, 250, 0, 4000, 0), { bucket: { bytes: -1000, at: 250 }, pass: false }, 'a debt repaid at the rate');
  assert.deepEqual(floorGate({ bytes: 3000, at: 0 }, 1000, 0, 4000, 0).bucket.bytes, 4000, 'the refill capped at a second of the rate');
  for (const [data, full] of [[{ full: 1 }, true], [{ lc: 0 }, true], [{ lc: 12, f: [] }, true], [{ full: 0 }, false], [{}, false], [{ full: '1' }, false], [{ full: true }, false], [{ lc: 1.5 }, false], [{ lc: '3' }, false], [null, false], [undefined, false]]) {
    assert.equal(foesFrameFull(data), full, `full: ${JSON.stringify(data)}`);
  }
  assert.deepEqual([FOES_FULL_RESERVE, FOES_FIRST_MS, FOES_UNHEARD_MS], [RATE / 4, FOES_FULL_MS / 2, FOES_STALE_MS - FOES_FULL_MS]);
  assert.deepEqual([FOES_FULL_RESERVE, FOES_FIRST_MS, FOES_UNHEARD_MS], [1024 * 1024, 1000, 4000]);
  for (const k of ['floorGate', 'foesFrameFull', 'FOES_FULL_RESERVE', 'FOES_FIRST_MS', 'FOES_UNHEARD_MS']) assert.equal(relay[k], { floorGate, foesFrameFull, FOES_FULL_RESERVE, FOES_FIRST_MS, FOES_UNHEARD_MS }[k], `${k} at both ends`);
  assert.ok(RELAY_VERSION);
});

test('FOES-FIRST the fan over the real Room: every frame reaches exactly the listeners the law names and leaves the bucket where floorGate leaves it - a full frame first once each FOES_FIRST_MS a sender (its floor minus the reserve), a sender unheard FOES_UNHEARD_MS first whatever it says, every other frame stopped at plus the reserve; a frame its floor cannot afford for one listener walks nobody; the full frames and their drops counted (mutants: one floor for all; the first frame\'s floor at 0; the cadence unread; the unheard sender a delta; the heard clock unstamped; the turn stamped on a delta; the walk before the budget; the full frames uncounted)', async () => {
  await onClock(async ({ now, tick }) => {
    const R = fakeRoom('world:3,12', { now });
    const socks = [];
    for (let i = 0; i < 10; i++) { const ws = R.connect(); tick(150); await R.hello(ws, `ff-${String(i).padStart(4, '0')}`, at(1, 1)); socks.push(ws); }
    const rnd = roll(23);
    const heardAt = new Map(), firstAt = new Map();   // the oracle's own clocks, from what it saw go out
    const seen = { firstFull: [0, 0], cadenceFull: [0, 0], unheard: [0, 0], delta: [0, 0] };
    const c0 = { ...R.room._metrics.c };
    let fulls = 0, fullDrops = 0, drops = 0;
    const low = [], mid = [];
    let from = socks[0];
    let held = 0;
    for (let round = 0; round < 600; round++) {
      tick(100 + Math.floor(rnd() * 500));
      for (const ws of socks) ws.sent.length = 0;
      R.room._foesHolds = null;   // PIN MOVED (FOES-HOLD): a first frame refused is held for its turn - each round from an empty hold, the turns test/net/fb1021b_foeshold.test.js's
      if (rnd() < 0.6) from = socks[Math.floor(rnd() * socks.length)];   // else the last sender again - a full frame inside its cadence
      const pick = rnd();
      const data = { n: round, ...(pick < 0.35 ? { full: 1 } : pick < 0.45 ? { lc: 4 } : { full: 0 }), f: Array.from({ length: 1 + Math.floor(rnd() * 6) }, (_, i) => ({ i, x: 1, y: 0, z: 1, h: 10 })) };
      const frame = JSON.stringify({ t: 'foes', data });
      const a = R.room._attach(from);
      const per = frame.length + a.id.length + 8, want = per * (socks.length - 1);
      const full = pick < 0.45;
      const t = now();
      const cadence = full && t - (firstAt.get(from) ?? -Infinity) >= FOES_FIRST_MS;
      const unheard = t - (heardAt.get(from) ?? -Infinity) >= FOES_UNHEARD_MS;
      const first = cadence || unheard;
      const cls = cadence ? 'firstFull' : unheard ? 'unheard' : full ? 'cadenceFull' : 'delta';
      const floor = first ? -FOES_FULL_RESERVE : FOES_FULL_RESERVE;
      const levels = [0, per / 2, per, (per + want) / 2, want - 1, want, want * 2, -per, want * 3, RATE / 2];   // the bucket about this frame's floor: below one listener's worth, between, enough
      const over = levels[Math.floor(rnd() * levels.length)];
      const bytes = floor + over;
      R.room._roomFoes = { bytes, at: t };
      const law = floorGate({ bytes, at: t }, t, want, RATE, floor);
      let walked = 0;
      const all = R.room._all.bind(R.room);
      R.room._all = () => { walked++; return all(); };
      await R.raw(from, frame);
      R.room._all = all;
      const got = socks.filter((o) => ofType(o, 'foes').length > 0);
      assert.deepEqual(got, law.pass ? socks.filter((o) => o !== from) : [], `round ${round} (${cls}, bucket ${over} over its floor, a listener ${per}, all ${want})`);
      assert.deepEqual(R.room._roomFoes, law.bucket, `round ${round}: the bucket`);
      seen[cls][law.pass ? 0 : 1]++;
      if (full) fulls++;
      if (!law.pass && first) held++;   // FOES-HOLD: held for its turn
      else if (!law.pass) { drops++; if (full) fullDrops++; }
      if (law.pass) heardAt.set(from, t);
      if (first && full) firstAt.set(from, t);   // FOES-HOLD: a first frame's turn spent when it is taken - sent, or held
      (over < per ? low : over < want ? mid : []).push(walked);
    }
    for (const [cls, [passed, dropped]] of Object.entries(seen)) assert.ok(passed >= 10 && dropped >= 10, `${cls}: both answers (${passed} went, ${dropped} dropped)`);
    const c = R.room._metrics.c;
    assert.equal(c.fulls - c0.fulls, fulls, 'every full frame counted, the layout count\'s too');
    assert.equal(c.fullDrops - c0.fullDrops, fullDrops, 'each full frame dropped counted apart');
    assert.equal(c.drops - c0.drops, drops, 'and every drop, as SCALE5b counts them');
    assert.equal(c.held - c0.held, held, 'a first frame refused held, never dropped (FOES-HOLD)');
    assert.ok(Math.max(...low) < Math.min(...mid), `a frame its floor cannot afford for one listener walks nobody (${JSON.stringify([...new Set(low)])} against ${JSON.stringify([...new Set(mid)])})`);
  });
});

test('FOES-FIRST a lane\'s clocks are its own: a world room\'s host spends its full frame\'s turn on the foes lane (its layout count) and still goes first with the own lane\'s - each lane its own bucket and its own two clocks; inside the cadence a full own frame is a delta, dropped at the reserve and counted a full frame\'s drop; inside it, with room above the reserve, a full own frame goes as a delta and spends no turn; FOES_FIRST_MS after its last turn, first again (mutants: the lanes\' clocks shared; the full drops uncounted; the cadence\'s boundary exclusive; a turn spent by a full frame that went as a delta)', async () => {
  await onClock(async ({ now, tick }) => {
    const R = fakeRoom('dungeon:m187853213', { now });
    const h = R.connect(), j1 = R.connect(), j2 = R.connect();
    await R.hello(h, 'host-0001', at(1, 1)); tick(50); await R.hello(j1, 'join-0002', at(1, 1)); tick(50); await R.hello(j2, 'join-0003', at(1, 1));
    tick(1000);
    const f = [{ i: 0, x: 1, y: 0, z: 1, h: 10 }];
    await R.raw(h, JSON.stringify({ t: 'foes', data: { n: 1, lc: 1, f } }));
    assert.equal(ofType(j1, 'foes').length, 1, 'the host\'s full frame (its layout count)');
    const spent = () => ({ bytes: FOES_FULL_RESERVE - 1, at: now() });   // below any delta's floor
    const own = (n) => JSON.stringify({ t: 'own', data: { n, full: 1, f } });
    tick(200);
    R.room._roomOwn = spent();
    await R.raw(h, own(1));
    assert.equal(ofType(j1, 'own').length, 1, 'the own lane\'s first full frame goes first - the foes lane\'s turn is not its own');
    assert.ok(R.room._roomOwn.bytes < FOES_FULL_RESERVE && R.room._roomOwn.bytes >= -FOES_FULL_RESERVE, 'spending the reserve');
    const d0 = R.room._metrics.c.fullDrops;
    tick(200);
    R.room._roomOwn = spent();
    await R.raw(h, own(2));
    assert.equal(ofType(j1, 'own').length, 1, 'inside the cadence, heard: a delta to the budget - dropped at the reserve');
    assert.equal(R.room._metrics.c.fullDrops - d0, 1, 'counted a full frame\'s drop');
    tick(200);
    R.room._roomOwn = { bytes: RATE, at: now() };
    await R.raw(h, own(3));
    assert.equal(ofType(j1, 'own').at(-1).data.n, 3, 'inside the cadence with room above the reserve it goes, as a delta - and spends no turn');
    tick(FOES_FIRST_MS - 400);
    R.room._roomOwn = spent();
    await R.raw(h, own(4));
    assert.equal(ofType(j1, 'own').at(-1).data.n, 4, 'FOES_FIRST_MS after its last turn, to the millisecond: first again');
    assert.equal(ofType(j2, 'own').at(-1).data.n, 4);
  });
});

test('FOES-FIRST A FULL FAN PAST THE RESERVE: into a room the deltas hold at the reserve it goes (the old law dropped any fan the bucket did not hold whole), and the debt it leaves is the reserve\'s at most - on a nearly spent bucket the same fan is dropped whole, the bucket left out of debt, never borrowed to its own cost (mutants: the full frame borrowing its whole cost; the debt unbounded)', async () => {
  await onClock(async ({ now, tick }) => {
    const R = fakeRoom('world:3,12', { now });
    const socks = [];
    for (let i = 0; i < 20; i++) { const ws = R.connect(); tick(100); await R.hello(ws, `bf-${String(i).padStart(4, '0')}`, at(1, 1)); socks.push(ws); }
    const big = (n) => JSON.stringify({ t: 'foes', data: { n, full: 1, f: [{ i: 0, x: 1, y: 0, z: 1, h: 10 }], pad: 'p'.repeat(60_000) } });
    const per = big(1).length + 'bf-0000'.length + 8, fan = per * (socks.length - 1);
    assert.ok(fan > FOES_FULL_RESERVE + 100 && fan < 2 * FOES_FULL_RESERVE, `a fan past the reserve, inside twice it (${fan})`);
    tick(1000);
    R.room._roomFoes = { bytes: FOES_FULL_RESERVE, at: now() };   // the deltas' floor: where a crowd of them holds it
    await R.raw(socks[0], big(1));
    assert.equal(socks.slice(1).filter((s) => ofType(s, 'foes').length === 1).length, 19, 'the full frame goes');
    assert.equal(R.room._roomFoes.bytes, FOES_FULL_RESERVE - fan, 'spending the reserve and borrowing past it');
    assert.ok(R.room._roomFoes.bytes >= -FOES_FULL_RESERVE);
    tick(FOES_FIRST_MS + 100);
    R.room._roomFoes = { bytes: 100, at: now() };   // nearly spent, not in debt
    await R.raw(socks[0], big(2));
    assert.equal(socks.slice(1).filter((s) => ofType(s, 'foes').length > 1).length, 0, 'past the reserve below empty: not sent');
    assert.deepEqual(R.room._roomFoes, { bytes: 100, at: now() }, 'nothing spent, no debt');
    assert.equal(R.room._foesHoldOf('foes').entries.length, 1, 'PIN MOVED (FOES-HOLD): held for its turn, never borrowed to its own cost');
  });
});

test('FOES-FIRST A CROWDED ROOM, measured (tools/foesFirstBench.mjs over the real Room): 30 owners in a cell of 60, the deltas past the budget - every full frame heard, two seconds apart, nobody unheard past FOES_STALE_MS; one socket saying `full` on 16 KiB frames twelve times a second buys one first a second and takes no full frame\'s place; a 40-owner star whose full frames alone are more than the budget prunes no owner (mutants: the reserve unheld; the cadence unread; the unheard sender a delta)', async () => {
  const by = (name) => SCENES.find((s) => s.name === name);
  const crowded = await scene(by('crowded'), 20);
  assert.equal(crowded.full, 100, `every full frame heard (${JSON.stringify(crowded)})`);
  assert.ok(crowded.delta > 5 && crowded.delta < 50, 'the deltas past the budget, some of them heard');
  assert.ok(crowded.gapMax < FOES_FULL_MS / 1000 + 0.25, 'its full frames apart as they were sent');
  assert.equal(crowded.stale, 0);
  const flood = await scene(by('flood'), 20);
  assert.equal(flood.full, 100, `the honest full frames all heard beside a flood (${JSON.stringify(flood)})`);
  assert.ok(flood.flood < 15, 'the flood buys its one a second, and little past it');
  const star = await scene(by('star80'), 20);
  assert.equal(star.stale, 0, `no owner unheard past its readers' patience (${JSON.stringify(star)})`);
  assert.ok(star.unheardMax * 1000 < FOES_STALE_MS, 'the longest silence inside FOES_STALE_MS');
  assert.ok(star.full > 10, 'and the full frames still the ones first');
});

test('FOES-FIRST HIT-DROPS: a blow a destination\'s funnel drops - its frames a second or its bytes - is counted, a blow to nobody is junk and no drop, a blow forwarded no drop; the window\'s point says the blows dropped, the full frames dropped and the full frames asked as blob3 to 5, decimal, the twenty doubles as they were (mutants: the frame funnel\'s drop uncounted; the byte funnel\'s drop uncounted; a blob dropped; the blobs\' order; the counts unreset)', async () => {
  await onClock(async ({ now, tick }) => {
    const R = fakeRoom('world:3,12', { now });
    const points = [];
    R.room.env.METRICS = { writeDataPoint: (p) => points.push(p) };
    const a = R.connect(), b = R.connect();
    await R.hello(a, 'aaaa-0001', at(1, 1)); tick(50); await R.hello(b, 'bbbb-0002', at(1, 1));
    const hitTo = (to) => JSON.stringify({ t: 'hit', data: { to, i: 1, dmg: 1, kind: 'melee' } });
    const c = R.room._metrics.c;
    tick(1000);
    await R.raw(a, hitTo('bbbb-0002'));
    assert.equal(ofType(b, 'hit').length, 1, 'a blow lands');
    assert.equal(c.hitDrops, 0, 'and is no drop');
    tick(200);
    await R.raw(a, hitTo('zzzz-0009'));
    assert.equal(c.hitDrops, 0, 'a blow to nobody is junk, never a drop');
    assert.equal(a.meters.junk, 1);
    tick(200);
    R.room._meterOf(b).hbucket = { tokens: 0, at: now() };
    await R.raw(a, hitTo('bbbb-0002'));
    assert.equal(ofType(b, 'hit').length, 1, 'over the destination\'s frames a second: dropped');
    assert.equal(c.hitDrops, 1, 'counted');
    tick(200);
    R.room._meterOf(b).hbytes = { bytes: 10, at: now() };
    await R.raw(a, hitTo('bbbb-0002'));
    assert.equal(ofType(b, 'hit').length, 1, 'over the destination\'s bytes: dropped');
    assert.equal(c.hitDrops, 2, 'counted');
    tick(1000);
    await R.raw(a, hitTo('bbbb-0002'));
    assert.equal(ofType(b, 'hit').length, 2, 'refilled: forwarded');
    assert.equal(c.hitDrops, 2);
    tick(200);
    await R.raw(a, JSON.stringify({ t: 'foes', data: { n: 1, full: 1, f: [{ i: 0 }] } }));
    R.room._metricsTick(true);
    assert.equal(points.length, 1);
    assert.deepEqual(points[0].blobs.slice(0, 5), ['world', String(RELAY_VERSION), '2', '0', '1'], 'blob3 the blows dropped, blob4 the full frames dropped, blob5 the full frames asked');   // PIN MOVED (FOES-HOLD): blob6 on are the hold's (test/net/fb1021b_foeshold.test.js)
    assert.equal(points[0].doubles.length, 20, 'the doubles as they were');
    assert.equal(R.room._metrics.c.hitDrops, 0, 'a new window counts from nothing');
  });
  // the law alone: the blobs in their order, beside the doubles SCALE5b wrote
  const m = new RoomMetrics(0);
  Object.assign(m.c, { frames: 1, full: 3, drops: 4, peak: 9, foes: 5, hits: 6, chats: 7, owed: 8, batches: 2, hitDrops: 11, fullDrops: 12, fulls: 13 });
  const got = [];
  m.flush({ writeDataPoint: (p) => got.push(p) }, 'world', 7, 'w', 1, true);
  assert.deepEqual(got[0].blobs.slice(0, 5), ['world', 'w', '11', '12', '13']);
  assert.deepEqual(got[0].doubles.slice(12), [3, 4, 9, 5, 6, 7, 8, 2]);
  assert.deepEqual([m.c.hitDrops, m.c.fullDrops, m.c.fulls], [0, 0, 0], 'reset with the window');
});

test('AUDIT FOES-FIRST F1 A HANDOVER GOES FIRST: a cell\'s handover batch (world/foeHandover.js - `full` 0, its records naming an heir) is no delta to the budget - it goes first, once each FOES_FIRST_MS a sender, into a room the deltas hold at the reserve, where the deltas stop (a crowded cell\'s handovers were heard 29.2% under FOES-FIRST and a star\'s 1.7% - and the owner had let the foes go) (mutants: AUDIT-FF-F1-handover-a-delta; AUDIT-FF-F1-handover-unbounded; AUDIT-FF-F1-handover-turn-unstamped)', async () => {
  await onClock(async ({ now, tick }) => {
    const R = fakeRoom('world:3,12', { now });
    const socks = [];
    for (let i = 0; i < 12; i++) { const ws = R.connect(); tick(100); await R.hello(ws, `ho-${String(i).padStart(4, '0')}`, at(1, 1)); socks.push(ws); }
    const rec = (i, e) => ({ i, x: 1, y: 0, z: 1, h: 10, ...(e ? { e, it: [] } : {}) });
    const frame = (n, hands) => JSON.stringify({ t: 'foes', data: { n, k: 'world:3,12', full: 0, f: [rec(0, hands ? 'ho-0011' : null), rec(1, hands ? 'ho-0011' : null)] } });
    assert.equal(foesFrameHandsOn(JSON.parse(frame(1, true)).data), true);
    assert.equal(foesFrameHandsOn(JSON.parse(frame(1, false)).data), false);
    assert.equal(foesFrameHandsOn({ f: [{ i: 0, e: '' }] }), false, 'an empty heir hands nothing on');
    assert.equal(foesFrameFull(JSON.parse(frame(1, true)).data), false, 'a handover batch says `full` 0');
    const heard = () => socks.slice(1).filter((s) => ofType(s, 'foes').length > 0).length;
    const clear = () => { for (const s of socks) s.sent.length = 0; };
    R.room._roomFoes = { bytes: RATE, at: now() };
    await R.raw(socks[0], frame(1, false));   // heard: no sender here is first for being unheard
    assert.equal(heard(), 11);
    tick(300); clear();
    R.room._roomFoes = { bytes: FOES_FULL_RESERVE, at: now() };   // where a crowd's deltas hold it
    await R.raw(socks[0], frame(2, false));
    assert.equal(heard(), 0, 'a delta stops at the reserve');
    R.room._roomFoes = { bytes: FOES_FULL_RESERVE, at: now() };
    await R.raw(socks[0], frame(3, true));
    assert.equal(heard(), 11, 'the handover goes first');
    assert.ok(R.room._roomFoes.bytes < FOES_FULL_RESERVE, 'spending below the reserve');
    tick(FOES_FIRST_MS / 2); clear();
    R.room._roomFoes = { bytes: FOES_FULL_RESERVE, at: now() };
    await R.raw(socks[0], frame(4, true));
    assert.equal(heard(), 0, 'a second inside FOES_FIRST_MS asks the reserve\'s floor, as a delta does');
    assert.equal(R.room._foesHoldOf('foes').entries.length, 1, 'PIN MOVED (FOES-HOLD): and is held for its turn - a handover is never dropped for the budget');
    tick(FOES_FIRST_MS); clear();
    R.room._roomFoes = { bytes: FOES_FULL_RESERVE, at: now() };
    await R.raw(socks[0], frame(5, true));
    assert.equal(heard(), 11, 'and its next turn comes');
    assert.deepEqual(ofType(socks[1], 'foes').map((m) => m.data.n), [4, 5], 'the held batch first, in its sender\'s order');
    const bench = await scene(SCENES.find((s) => s.name === 'hands'), 20);
    assert.equal(bench.hands, 100, `a crowded cell's handovers all heard (${bench.hands}%)`);
  });
});

test('AUDIT FOES-FIRST F2 A FRAME CHARGED IS HEARD: the lane\'s clocks are stamped once the fan is charged, before the frame is re-serialised - a full frame that grows (`1e20` out as twenty-one digits) is junk, but it spent its turn and its sender is heard, so its next full frame inside FOES_FIRST_MS and its deltas stop at the reserve (stamped after the send, every frame of such a sender went first, past both bounds) (mutants: AUDIT-FF-F2-stamped-after-the-send)', async () => {
  await onClock(async ({ now, tick }) => {
    const R = fakeRoom('world:3,12', { now });
    const socks = [];
    for (let i = 0; i < 12; i++) { const ws = R.connect(); tick(100); await R.hello(ws, `jk-${String(i).padStart(4, '0')}`, at(1, 1)); socks.push(ws); }
    const heard = () => socks.slice(1).filter((s) => ofType(s, 'foes').length > 0).length;
    const clear = () => { for (const s of socks) s.sent.length = 0; };
    const grows = (n) => `{"t":"foes","data":{"n":${n},"full":1,"f":[{"i":0,"x":1e20,"y":0,"z":1,"h":10}]}}`;
    const honest = (n, full) => JSON.stringify({ t: 'foes', data: { n, full, f: [{ i: 0, x: 1, y: 0, z: 1, h: 10 }] } });
    tick(1000);
    R.room._roomFoes = { bytes: FOES_FULL_RESERVE, at: now() };
    const strikes = R.room._meterOf(socks[0]).junk ?? 0;
    await R.raw(socks[0], grows(1));
    assert.equal(heard(), 0, 'junk goes to nobody');
    assert.ok(R.room._roomFoes.bytes < FOES_FULL_RESERVE, 'but its fan was charged, going first');
    assert.equal(R.room._meterOf(socks[0]).junk ?? 0, strikes + 1, 'and struck as junk');
    tick(FOES_FIRST_MS / 4); clear();
    R.room._roomFoes = { bytes: FOES_FULL_RESERVE, at: now() };
    await R.raw(socks[0], honest(2, 1));
    assert.equal(heard(), 0, 'its turn is spent: the next full frame inside FOES_FIRST_MS stops at the reserve');
    R.room._roomFoes = { bytes: FOES_FULL_RESERVE, at: now() };
    await R.raw(socks[0], honest(3, 0));
    assert.equal(heard(), 0, 'and it is heard: a delta stops at the reserve too');
    tick(FOES_FIRST_MS); clear();
    R.room._roomFoes = { bytes: FOES_FULL_RESERVE, at: now() };
    await R.raw(socks[0], honest(4, 1));
    assert.equal(heard(), 11, 'its next turn comes');
  });
});
