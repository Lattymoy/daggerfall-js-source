// FOUNDATION F2 (bible/03-World/Foundation-Arc.md): THE REGIONS' CLOCK AND THEIR PROSPERITY (net/regionClockLaw.js,
// server-account/src/regionClock.js) - residency derived each tick, the rotation's bound, a rule that steps a day at a
// time and reads the same caught up as stepped, the shift that falls either side to nothing, and the service's tick
// over a Bay region and a province's. Pins mutation-checked (tools/mutants/foundation.json).
import '../chargenDom.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REGION_CLOCK_REGIONS, REGION_CLOCK_TURN, REGION_CLOCK_MAX_LAG, REGION_HALF_DAYS, REGION_IMPULSE_MAX, REGION_TERM_MAX, REGION_TERM_HALF,
  regionClockDue, halvedToward0, regionProsperityStep, regionProsperityStepTo, regionProsperityAt, regionTermOf,
} from '../../src/net/regionClockLaw.js';
import { townProsperity } from '../../src/net/townEconLaw.js';
import { standService, T0 } from '../accountDb.mjs';
import { MINUTE_JOBS, runCron, CRON_MINUTE } from '../../server-account/src/cron.js';
import { tickRegionClock, regionsProsperity } from '../../server-account/src/regionClock.js';
import { _resetTownEconForTests } from '../../server-account/src/townEcon.js';

const rng = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

test('F2 the clock: every region 0..70, the resident stepped every tick, the rotation two more, and none ever more than its round behind - the proposal\'s bound of 45 kept (mutants: the rotation unturned, the resident unstepped)', () => {
  assert.equal(REGION_CLOCK_REGIONS, 71);
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

test('F2 the service: the clock starts at nothing, ticks once a UTC day off the towns\' acts the day before - a Bay region and Skyrim\'s stepped, the rest at nothing - reads each off its own tick, answers it with the shares, and falls back when nobody walks (mutants: the acts\' day, the kept regions)', async () => {
  let now = T0;
  const s = await standService({ PROFESSIONS_OPEN: 'on' });
  const raw = s.env.DB._raw, db = s.env.DB;
  const day = () => Math.floor(now / 86_400);
  assert.match(String(MINUTE_JOBS.find(([n]) => n === 'town-shares')?.[1]), /tickRegionClock\(ctx\.db, ctx\.nowS\)/, 'ticked with the shares');
  assert.equal(await tickRegionClock(db, now), 0, 'started');
  assert.equal(raw.prepare('SELECT tick FROM region_clock_meta WHERE id = 1').get().tick, day(), 'started today; a region with no row at nothing');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM region_clock').get().n, 0);
  raw.prepare('INSERT INTO town_econ_towns (map, px, py, region, location, at) VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)').run(3_000_207, 207, 212, 17, 5, now, 9_000_001, 1500, -400, 64, -1_000_001, now);
  raw.prepare('INSERT INTO town_econ_days (map, day, src, n) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)').run(3_000_207, day(), 'watch', 30, 3_000_207, day(), 'trade', 10, 9_000_001, day(), 'raid', 1);
  now += 86_400;
  assert.ok(await tickRegionClock(db, now) >= 2);
  assert.equal(await tickRegionClock(db, now), 0, 'once a day');
  const v = new Map((await regionsProsperity(db, now)));
  const expect = (acts) => regionProsperityStep(0, day(), acts);
  assert.deepEqual([v.get(17), v.get(64), v.size], [expect(30 + 4 * 10), expect(20), 2], 'the Bay\'s Daggerfall and a town in Skyrim, weighed as TOWN-ECON weighs them');
  _resetTownEconForTests();
  await runCron(s.env, { cron: CRON_MINUTE, nowS: now + 400 });
  const g = await s.guest();
  const body = (await s.call('/v1/towns/econ', {}, g.secret)).body;
  assert.deepEqual(body.regions, [[17, v.get(17)], [64, v.get(64)]]);
  now += 86_400 * 40;
  await tickRegionClock(db, now);
  assert.deepEqual(await regionsProsperity(db, now), [], 'forty days unwalked: back to nothing');
});
