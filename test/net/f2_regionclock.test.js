// FOUNDATION F2 (bible/03-World/Foundation-Arc.md): THE REGIONS' CLOCK AND THEIR PROSPERITY (net/regionClockLaw.js,
// server-account/src/regionClock.js) - residency derived each tick, the rotation's bound, a rule that steps a day at a
// time and reads the same caught up as stepped, the shift that falls either side to nothing, and the service's tick
// over a Bay region and a province's. Pins mutation-checked (tools/mutants/foundation.json).
import '../chargenDom.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REGION_CLOCK_REGIONS, REGION_CLOCK_TURN, REGION_CLOCK_MAX_LAG, REGION_HALF_DAYS, REGION_IMPULSE_MAX, REGION_TERM_MAX, REGION_TERM_HALF,
  regionClockDue, halvedToward0, regionProsperityStep, regionProsperityStepTo, regionProsperityAt, regionTermOf, REGION_ACTS_SETTLE_DAYS,
} from '../../src/net/regionClockLaw.js';
import { WATCH_RECEIPT_TTL_S } from '../../src/net/watchReceipt.js';
import { PATRON_RECKON_HOURS } from '../../src/net/patronLaw.js';
import { REGION_NAMES } from '../../src/formats/mapsTables.js';
import { townProsperity } from '../../src/net/townEconLaw.js';
import { standService, T0 } from '../accountDb.mjs';
import { MINUTE_JOBS, runCron, CRON_MINUTE } from '../../server-account/src/cron.js';
import { tickRegionClock, regionsProsperity } from '../../server-account/src/regionClock.js';
import { _resetTownEconForTests } from '../../server-account/src/townEcon.js';
import { createTownEconHost } from '../../src/scenes/townEconHost.js';
import { townKeyOf, townDayOf } from '../../src/net/townEconLaw.js';

const rng = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

test('F2 the clock: every region 0..70, the resident stepped every tick, the rotation two more, and none ever more than its round behind - the proposal\'s bound of 45 kept (mutants: the rotation unturned, the resident unstepped)', () => {
  assert.equal(REGION_CLOCK_REGIONS, REGION_NAMES.length, 'every region the world names: the Bay\'s 62 and the provinces\' (AUDIT FOUNDATION C5)');
  assert.equal(REGION_CLOCK_MAX_LAG, Math.ceil(71 / REGION_CLOCK_TURN));
  assert.ok(REGION_CLOCK_MAX_LAG <= 45);
  assert.deepEqual(regionClockDue([64, 17, 99, -1], 70), { due: [0, 17, 64, 70], cursor: 1 }, 'the resident, then the rotation round the end; no region past 70');
  const seen = new Array(71).fill(0), r = rng(7);
  let cursor = 0, worst = 0;
  for (let t = 1; t <= 400; t++) {
    const resident = Array.from({ length: 3 }, () => Math.floor(r() * 71));
    const turn = regionClockDue(resident, cursor);
    cursor = turn.cursor;
    for (const g of resident) assert.ok(turn.due.includes(g), 'a resident region steps');
    for (const g of turn.due) seen[g] = t;
    worst = Math.max(worst, ...seen.map((s) => t - s));
  }
  assert.ok(worst < REGION_CLOCK_MAX_LAG, `the worst lag ${worst}`);
});

test('F2 the rule: a catch-up of n days IS n steps - stepped a day at a time, in two pieces or at once, the same integer; with nothing added the closed form; the shift falls to nothing either side (mutants: the floor shift, the half-life\'s phase, the closed form\'s count)', () => {
  assert.deepEqual([halvedToward0(1, 1), halvedToward0(-1, 1), halvedToward0(-7, 1), halvedToward0(7, 2)], [0, 0, -3, 1]);
  const r = rng(11);
  for (let trial = 0; trial < 50; trial++) {
    const from = Math.floor(r() * 900), to = from + 1 + Math.floor(r() * 60), mid = from + Math.floor((to - from) / 2);
    const acts = new Map(Array.from({ length: to - from }, (_, i) => [from + 1 + i, r() < 0.4 ? Math.floor(r() * 3000) : 0]));
    const of = (t) => acts.get(t) ?? 0;
    let daily = Math.floor(r() * 9000);
    const v0 = daily;
    for (let t = from + 1; t <= to; t++) daily = regionProsperityStep(daily, t, of(t));
    assert.equal(regionProsperityStepTo(v0, from, to, of), daily);
    assert.equal(regionProsperityStepTo(regionProsperityStepTo(v0, from, mid, of), mid, to, of), daily);
    assert.equal(regionProsperityStepTo(v0, from, to, () => 0), regionProsperityAt(v0, from, to), 'nothing added: the closed form');
  }
  assert.equal(regionProsperityAt(4096, 3, 3 + REGION_HALF_DAYS), 2048, 'halved once a half-life');
  assert.equal(regionProsperityAt(4096, 4, 7), 4096, 'within one, no half');
  assert.equal(regionProsperityStep(0, 1, 99999), REGION_IMPULSE_MAX, 'a day adds at most its most');
});

test('F2 the term: a region\'s prosperity adds 0 to REGION_TERM_MAX to its towns\', half at REGION_TERM_HALF - nothing read, nothing added, every town\'s Prosperity as before (mutants: the term unadded)', () => {
  assert.deepEqual([regionTermOf(0), regionTermOf(-5), regionTermOf(NaN), regionTermOf(REGION_TERM_HALF), regionTermOf(1e12)], [0, 0, 0, REGION_TERM_MAX / 2, REGION_TERM_MAX - 1]);
  const town = { key: 4242, type: 0, day: 20400 };
  assert.equal(townProsperity({ ...town, regional: 0 }), townProsperity(town));
  assert.equal(townProsperity({ ...town, regional: REGION_TERM_HALF }) - townProsperity(town), REGION_TERM_MAX / 2);
});

test('F2 the service: the clock starts at nothing and ticks once a UTC day off the acts of the day REGION_ACTS_SETTLE_DAYS back - a day whole, so an act counted late on its own day still counts - a Bay region and Skyrim\'s stepped, the rest at nothing; read off its own tick, answered with the shares, back to nothing unwalked (mutants: the acts\' day, the kept regions, the settle unread)', async () => {
  let now = T0;
  const s = await standService({ PROFESSIONS_OPEN: 'on' });
  const raw = s.env.DB._raw, db = s.env.DB;
  const day = () => Math.floor(now / 86_400);
  assert.match(String(MINUTE_JOBS.find(([n]) => n === 'town-shares')?.[1]), /keepTownShares\(ctx\.db, ctx\.nowS\)\) \+ \(await tickRegionClock\(ctx\.db, ctx\.nowS\)/, 'ticked with the shares, after them');
  assert.ok(REGION_ACTS_SETTLE_DAYS * 86_400 >= WATCH_RECEIPT_TTL_S + 86_400 && REGION_ACTS_SETTLE_DAYS * 24 >= PATRON_RECKON_HOURS + 24, 'a day read once its late acts are in');
  assert.equal(await tickRegionClock(db, now), 0, 'started');
  assert.equal(raw.prepare('SELECT tick FROM region_clock_meta WHERE id = 1').get().tick, day(), 'started today; a region with no row at nothing');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM region_clock').get().n, 0);
  const D = day();
  raw.prepare('INSERT INTO town_econ_towns (map, px, py, region, location, at) VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)').run(3_000_207, 207, 212, 17, 5, now, 9_000_001, 1500, -400, 64, -1_000_001, now);
  raw.prepare('INSERT INTO town_econ_days (map, day, src, n) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)').run(3_000_207, D, 'watch', 30, 3_000_207, D, 'trade', 10, 9_000_001, D, 'raid', 1);
  now += 86_400;
  assert.equal(await tickRegionClock(db, now), 0, 'the day not whole yet');
  raw.prepare('INSERT INTO town_econ_days (map, day, src, n) VALUES (?, ?, ?, ?)').run(3_000_207, D, 'sea', 5);   // a dealing claimed late, on its own day
  now += 2 * 86_400;
  assert.equal(await tickRegionClock(db, now), 2);
  assert.equal(await tickRegionClock(db, now), 0, 'once a day');
  const v = new Map((await regionsProsperity(db, now)));
  const expect = (acts) => regionProsperityStep(0, day(), acts);
  assert.deepEqual([v.get(17), v.get(64), v.size], [expect(30 + 4 * 10 + 2 * 5), expect(20), 2], 'the Bay\'s Daggerfall and a town in Skyrim, weighed as TOWN-ECON weighs them, the late dealing in');
  _resetTownEconForTests();
  await runCron(s.env, { cron: CRON_MINUTE, nowS: now + 400 });
  const g = await s.guest();
  const body = (await s.call('/v1/towns/econ', {}, g.secret)).body;
  assert.deepEqual(body.regions, [[17, v.get(17)], [64, v.get(64)]]);
  now += 86_400 * 40;
  await tickRegionClock(db, now);
  assert.deepEqual(await regionsProsperity(db, now), [], 'forty days unwalked: back to nothing');
});

test('F2 the service\'s tick is one write: a write that fails loses no day and is asked again; a catch-up of ten days over thirty regions is five statements (mutants: the tick taken first, the day marked before the write)', async () => {
  let now = T0;
  const s = await standService({ PROFESSIONS_OPEN: 'on' });
  const raw = s.env.DB._raw, real = s.env.DB;
  let statements = 0, failNext = false;
  const db = { prepare: (q) => { statements++; return real.prepare(q); }, batch: async (l) => { if (failNext) { failNext = false; throw new Error('D1_ERROR: network (modelled)'); } return real.batch(l); } };
  await tickRegionClock(db, now);
  const D = Math.floor(now / 86_400);
  for (let r = 0; r < 30; r++) {
    raw.prepare('INSERT INTO town_econ_towns (map, px, py, region, location, at) VALUES (?, ?, ?, ?, ?, ?)').run(5_000_000 + r, 100 + r, 100, r, r, now);
    for (let d = 0; d < 8; d++) raw.prepare('INSERT INTO town_econ_days (map, day, src, n) VALUES (?, ?, ?, ?)').run(5_000_000 + r, D + d, 'watch', 10 + r);
  }
  now += 10 * 86_400;
  failNext = true;
  await assert.rejects(tickRegionClock(db, now), /network/);
  assert.equal(raw.prepare('SELECT tick FROM region_clock_meta WHERE id = 1').get().tick, D, 'the tick not taken');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM region_clock').get().n, 0, 'nor a row written');
  statements = 0;
  assert.equal(await tickRegionClock(db, now), 30, 'asked again, every region with acts stepped');
  assert.ok(statements <= 5, `${statements} statements`);
  assert.equal(raw.prepare('SELECT tick FROM region_clock_meta WHERE id = 1').get().tick, D + 10);
});

test('F2 two runners at once: the second reads the rows the first wrote, and its write is refused whole - no day\'s acts added twice; a runner refused across midnight is not marked, and ticks its day at its next ask (AUDIT FOUNDATION II C2/C4; mutants: the guard unread, the refused marked)', async () => {
  let now = T0;
  const s = await standService({ PROFESSIONS_OPEN: 'on' });
  const raw = s.env.DB._raw, real = s.env.DB;
  const rows = () => raw.prepare('SELECT region, v, tick FROM region_clock ORDER BY region').all().map((r) => ({ ...r }));
  const meta = () => raw.prepare('SELECT tick FROM region_clock_meta WHERE id = 1').get().tick;
  /** a database whose read of the rows lets `other` run first */
  const racing = (other) => ({ prepare: (q) => (q.startsWith('SELECT region, v, tick FROM region_clock') ? { all: async () => { await other(); return real.prepare(q).all(); } } : real.prepare(q)), batch: (l) => real.batch(l) });
  await tickRegionClock(real, now);
  const D = Math.floor(now / 86_400);
  raw.prepare('INSERT INTO town_econ_towns (map, px, py, region, location, at) VALUES (?, ?, ?, ?, ?, ?)').run(3_000_207, 207, 212, 17, 5, now);
  for (const d of [D, D + 1]) raw.prepare('INSERT INTO town_econ_days (map, day, src, n) VALUES (?, ?, ?, ?)').run(3_000_207, d, 'watch', 30);
  now += 4 * 86_400;
  let first = null;
  assert.equal(await tickRegionClock(racing(async () => { assert.equal(await tickRegionClock(real, now), 1); first = rows(); }), now), 0, 'the second refused');
  assert.deepEqual(rows(), first, 'the first\'s rows stand');
  assert.equal(first[0].v, regionProsperityStepTo(0, D + 2, D + 4, () => 30), 'each day\'s acts added once');
  // across midnight: the first ticks the day before while the second reads, and the second's day waits for its next ask
  now += 2 * 86_400;
  _resetTownEconForTests();
  assert.equal(await tickRegionClock(racing(async () => { await tickRegionClock(real, now - 86_400); }), now), 0);
  assert.equal(meta(), D + 5, 'the first took the day before');
  await tickRegionClock(real, now);
  assert.equal(meta(), D + 6, 'asked again, its day ticked');
});

test('F2 the client: the book reads each region\'s prosperity with the shares, a bad pair dropped, and a town\'s Prosperity carries its region\'s term - a town of another region not (AUDIT FOUNDATION II C3; mutants: the regions unkept, the term unpassed, the host unwired)', async () => {
  const town = (px, py) => ((3 << 20) | (py * 1000 + px)) >>> 0;
  const RIP = town(212, 151), OTHER = town(300, 151);
  const towns = new Map([[RIP, { name: 'Ripmarket', px: 212, py: 151, region: 17, type: 0, location: 5 }], [OTHER, { name: 'Elsewhere', px: 300, py: 151, region: 18, type: 0, location: 6 }]]);
  const door = { me: () => 'acct-1', econ: async () => ({ ok: true, data: { towns: [], regions: [[17, REGION_TERM_HALF], [18, 'x'], [71, 900], [-1, 5]] } }), witness: async () => ({ ok: true, data: {} }), watch: async () => ({ ok: true, data: {} }) };
  const clock = 1_800_000_000_000, m = new Map();
  const host = createTownEconHost({ online: () => true, townOf: (id) => towns.get(id), seatAt: () => null, seats: () => null, raidedAt: () => false, nowMs: () => clock,
    locAt: () => null, door, storage: { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) } });
  host.prosperityOf(RIP);
  for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0));
  const day = townDayOf(clock);
  assert.deepEqual([host.book.regionalOf(17), host.book.regionalOf(18), host.book.regionalOf(71)], [REGION_TERM_HALF, 0, 0]);
  assert.equal(host.prosperityOf(RIP) - townProsperity({ key: townKeyOf(212, 151), type: 0, day }), REGION_TERM_MAX / 2);
  assert.equal(host.prosperityOf(OTHER), townProsperity({ key: townKeyOf(300, 151), type: 0, day }), 'region 18 read nothing');
});
