// FRONTS (2026-10-29, bible/03-World/World-Wide.md FRONTS; the owner: "events are way overdone with their spawning. I
// like players planning routes to farm world events, but we need to reduce or design around this"): the Bay stands its
// events every game day, and past it only the day's two provinces start a gate, raids, stars or an Abyss Dungeon.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { frontLanes, frontStands, frontNextDay, frontDayOfMinute, FRONT_PROVINCES, FRONT_PER_DAY, FRONT_CYCLE_DAYS, FRONT_DAY_MINUTES } from '../../src/net/frontLaw.js';
import { SITE_EVENT_LANES, sharedClassicMinutes, wallMsForClassicMinutes } from '../../src/net/wire.js';
import { isGateDay, gateNumber, gateAt, gateTimes, gateFrontDay, gateLaneOf, gateDayOf, GATE_EVERY_DAYS, GATE_DAY_MINUTES, GATE_OPEN_MINUTE, gateBaseMinute } from '../../src/net/gate/gateLaw.js';
import { heraldOmenDue } from '../../src/net/gate/gateHerald.js';
import { starInWindow, starOk, starTimes, starOfLane, starfallRuns, starFrontDay, STAR_HOUR_MS, STAR_PER_NIGHT } from '../../src/net/starfall/starfallLaw.js';
import { raidDaySlots, raidDayRandom, raidLaneOpen, raidLaneParties, raidLaneStands, RAID_SLOTS_MAX, RAID_DAY_MINUTES, RAID_TARGET_MIN, RAID_TARGET_MAX } from '../../src/net/raid/raidLaw.js';
import { raidsForLane } from '../../src/systems/raidingParties.js';
import { sdDue, sdRise, sdFirst, sdFrontFrom, sdHeldPast, SD_FRONT_HOLLOWS, SD_LANE_SPAN, SD_LIFETIME_MS, SD_COOLDOWN_MS } from '../../src/net/superDungeon/sdLaw.js';
import { frontTimerRows, frontCardLine, frontDayAt, frontDayStartMs } from '../../src/systems/frontWords.js';
import { eventTimerRows, TIMER_GROUPS } from '../../src/systems/eventTimers.js';
import { THEATRE_COUNT } from '../../src/world/worldWide/worldGrid.js';
import { MINUTES_PER_DAY } from '../../src/systems/gameDate.js';

const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);
const DAY_NOW = frontDayAt(NOW);

test('FRONTS THE LAW: two provinces a game day, each once a four-day cycle and never two days running, in the order the cycle shuffles - the schedule pinned (mutants: the salt; one a day; the turn law; a province twice a cycle)', () => {
  assert.deepEqual([...FRONT_PROVINCES], SITE_EVENT_LANES.filter((l) => l > 0), 'the provinces are the site-bound lanes past the Bay');
  assert.equal(FRONT_PER_DAY, 2);
  assert.equal(FRONT_CYCLE_DAYS, 4);
  assert.equal(FRONT_DAY_MINUTES, GATE_DAY_MINUTES);
  assert.equal(FRONT_DAY_MINUTES, MINUTES_PER_DAY, 'pinned equal');
  // the schedule itself, eight days of it
  const got = [];
  for (let d = 20_200; d < 20_208; d++) got.push([...frontLanes(d)]);
  assert.deepEqual(got, [[5, 6], [3, 7], [1, 2], [4, 8], [2, 3], [5, 8], [1, 6], [4, 7]]);
  const last = new Map();
  let longest = 0;
  for (let d = 0; d < 40_000; d++) {
    const f = frontLanes(d);
    assert.equal(f.length, FRONT_PER_DAY, `day ${d}`);
    assert.ok(f[0] < f[1], `day ${d}: two provinces, ascending`);
    for (const l of f) {
      if (last.has(l)) { const gap = d - last.get(l); assert.ok(gap >= 2, `day ${d}: province ${l} stirred two days running`); longest = Math.max(longest, gap); }
      last.set(l, d);
    }
    if (d % FRONT_CYCLE_DAYS === FRONT_CYCLE_DAYS - 1) {
      const seen = [];
      for (let k = d - FRONT_CYCLE_DAYS + 1; k <= d; k++) seen.push(...frontLanes(k));
      assert.deepEqual(seen.sort((a, b) => a - b), [...FRONT_PROVINCES], `cycle ending ${d}: every province once`);
    }
  }
  assert.equal(longest, 2 * FRONT_CYCLE_DAYS - 1, 'a province waits at most seven days (fourteen real hours)');
  assert.deepEqual([...frontLanes(-1)], []);
  assert.deepEqual([...frontLanes(1.5)], []);
});

test('FRONTS who stands: the Bay\'s lane and the open zone\'s every day, a province on its turn alone; the next turn found within two cycles (mutants: the Bay inside the fronts; the next turn one day late)', () => {
  for (let d = DAY_NOW - 10; d < DAY_NOW + 10; d++) {
    assert.equal(frontStands(d, 0), true, 'the Bay every day');
    assert.equal(frontStands(d, 9), true, 'the open zone is outside the fronts (its own law stands nothing)');
    for (const l of FRONT_PROVINCES) {
      assert.equal(frontStands(d, l), frontLanes(d).includes(l));
      const n = frontNextDay(d, l);
      assert.ok(n >= d && n < d + 2 * FRONT_CYCLE_DAYS && frontStands(n, l));
      for (let k = d; k < n; k++) assert.equal(frontStands(k, l), false, 'the first turn from the day on');
    }
    assert.equal(frontNextDay(d, 0), d);
  }
  assert.equal(frontDayOfMinute(3 * FRONT_DAY_MINUTES - 1), 2);
  assert.equal(frontDayOfMinute(3 * FRONT_DAY_MINUTES), 3);
});

test('FRONTS THE GATES: the Bay\'s gate every day as before; a province\'s on the day its gate opens in alone, so a game day opens three - the clock\'s gate and the herald\'s omen its next turn\'s (mutants: the fronts unread; the front read off the gate\'s day)', () => {
  for (let d = DAY_NOW - 20; d < DAY_NOW + 20; d++) {
    assert.equal(isGateDay(gateNumber(d, 0)), d % GATE_EVERY_DAYS === 0, 'the Bay\'s lane untouched');
    for (const l of FRONT_PROVINCES) {
      const n = gateNumber(d, l), opens = frontDayOfMinute(gateBaseMinute(n) + GATE_OPEN_MINUTE);
      assert.equal(gateFrontDay(n), opens);
      assert.equal(isGateDay(n), frontStands(opens, l), `day ${d} lane ${l}`);
    }
  }
  // the gates opening in a game day: the Bay's and the day's two provinces'
  for (let D = DAY_NOW; D < DAY_NOW + 40; D++) {
    const from = D * GATE_DAY_MINUTES, to = from + GATE_DAY_MINUTES, opening = [];
    for (let l = 0; l < 9; l++) for (let d = D - 1; d <= D; d++) {
      const n = gateNumber(d, l), at = gateBaseMinute(n) + GATE_OPEN_MINUTE;
      if (at >= from && at < to && isGateDay(n)) opening.push(l);
    }
    assert.deepEqual(opening.sort((a, b) => a - b), [0, ...frontLanes(D)], `day ${D}`);
  }
  // each lane's clock answers its next gate that stands, and the herald owes nothing on a day that stands none
  for (let ms = NOW; ms < NOW + 2 * 86_400_000; ms += 97_000) {
    for (const l of FRONT_PROVINCES) {
      const g = gateAt(ms, l);
      assert.equal(gateLaneOf(g.day), l);
      assert.ok(isGateDay(g.day));
      const due = heraldOmenDue(ms, -1, l);
      if (due) assert.ok(isGateDay(due.day) && gateLaneOf(due.day) === l);
    }
  }
  assert.ok(gateTimes(gateNumber(gateDayOf(gateAt(NOW, 3).day), 3)).openAt > 0);
});

test('FRONTS THE STARS: a province\'s star lands on its turn alone, the Bay\'s every night of the festival; a star\'s shape (starOk) is what it was, so a receipt already minted reads as before (mutants: the fronts unread; starOk made to read them)', () => {
  let bay = 0, past = 0;
  const night0 = Math.floor(Date.UTC(2026, 9, 21) / STAR_HOUR_MS), nights = 24 * 10;
  for (let n = night0; n < night0 + nights; n++) {
    for (let lane = 0; lane < THEATRE_COUNT; lane++) {
      for (let j = 0; j < STAR_PER_NIGHT; j++) {
        const k = starOfLane(lane, j), day = frontDayOfMinute(sharedClassicMinutes(starTimes(n, k).fallAt));
        assert.equal(starFrontDay(n, k), day);
        const was = starOk(n, k) && starfallRuns(starTimes(n, k).fallAt);
        assert.equal(starInWindow(n, k), was && frontStands(day, lane), `night ${n} star ${k}`);
        if (was && lane > 0 && !frontStands(day, lane)) assert.equal(starOk(n, k), true, 'the shape stands');
        if (starInWindow(n, k)) { if (lane === 0) bay++; else past++; }
      }
    }
  }
  assert.equal(bay, nights * STAR_PER_NIGHT, 'the Bay\'s three every night');
  assert.ok(past === 2 * nights * STAR_PER_NIGHT, `the day's two provinces' three a night past the Bay (${past})`);
});

/** The slots raidLaw drew before the fronts, word for word (net/raid/raidLaw.js raidDaySlots at 5995d0bb9). */
function oldSlots(day, lane) {
  const random = raidDayRandom(day, lane), parties = raidLaneParties(lane), out = new Set();
  if (!raidLaneOpen(lane) || !parties.length) return out;
  const rangeInt = (min, max) => (max <= min ? min : min + Math.floor(random() * (max - min)));
  for (let l = 0; l < RAID_SLOTS_MAX; l++) {
    random(); random();
    const st = day * RAID_DAY_MINUTES + rangeInt(0, 1321);
    const ty = parties[rangeInt(0, parties.length)];
    const tg = rangeInt(RAID_TARGET_MIN, RAID_TARGET_MAX + 1);
    out.add(`${st}.${tg}.${ty}`);
  }
  return out;
}

test('FRONTS THE RAIDS: the relay\'s slots for a province\'s lane none off its turn and the old law\'s on it; the Bay\'s every day; the client rolls a province\'s day on its turn alone (mutants: the relay\'s slots unfronted; the client\'s roll unfronted)', () => {
  const groups = [{ region: 64, area: 1, towns: [{ index: -1000124, px: 2425, py: 270 }, { index: -1000125, px: 2430, py: 271 }] }];
  for (let d = DAY_NOW - 8; d < DAY_NOW + 8; d++) {
    assert.deepEqual([...raidDaySlots(d, 0)], [...oldSlots(d, 0)], 'the Bay\'s slots untouched');
    for (const l of FRONT_PROVINCES) {
      const on = frontStands(d, l);
      assert.equal(raidLaneStands(d, l), on);
      assert.deepEqual([...raidDaySlots(d, l)], on ? [...oldSlots(d, l)] : [], `day ${d} lane ${l}`);
      assert.equal(raidsForLane(d, l, groups).length > 0, on, `the client's day ${d} lane ${l}`);
    }
    assert.equal(raidDaySlots(d, 9).size, 0, 'the open zone none');
  }
});

test('FRONTS THE HOLLOWS: a province\'s rise waits for its turn and, while two stand past the Bay, for one of them to end; the Bay\'s rises as before whatever stands past it (mutants: the turn unread; the cap unread; the cap on the Bay\'s lane; the count of standing Hollows across the Bay\'s)', () => {
  assert.equal(SD_FRONT_HOLLOWS, 2);
  const dayStart = (d) => Math.ceil(wallMsForClassicMinutes(d * FRONT_DAY_MINUTES)) + 1;
  const lane = 3, onDay = frontNextDay(DAY_NOW + 1, lane), offDay = onDay + 1;
  assert.equal(frontStands(offDay, lane), false);
  const rested = (at) => ({ ...sdFirst(at - 1000, lane), next: at - 1 });
  // off its turn: nothing until its next turn's first moment
  const off = dayStart(offDay) + 60_000;
  const want = dayStart(frontNextDay(offDay, lane));
  assert.equal(sdFrontFrom(off, lane), want);
  assert.deepEqual(sdDue(rested(off), off), { act: null, at: want });
  assert.equal(sdRise(rested(off), off, -1, lane), null);
  // on its turn: a rise, unless the provinces' Hollows all stand
  const on = dayStart(onDay) + 60_000;
  assert.equal(sdFrontFrom(on, lane), on);
  assert.deepEqual(sdDue(rested(on), on, 0), { act: 'rise' });
  assert.deepEqual(sdDue(rested(on), on, SD_FRONT_HOLLOWS - 1), { act: 'rise' });
  assert.deepEqual(sdDue(rested(on), on, SD_FRONT_HOLLOWS), { act: null });
  assert.equal(sdRise(rested(on), on, -1, lane, SD_FRONT_HOLLOWS), null);
  const risen = sdRise(rested(on), on, -1, lane, SD_FRONT_HOLLOWS - 1);
  assert.equal(risen.s, lane * SD_LANE_SPAN + 1);
  assert.equal(risen.until, on + SD_LIFETIME_MS);
  // the Bay's lane: every hour, whatever stands past it
  for (let ms = off; ms < off + 86_400_000; ms += 3_600_000) {
    const bay = { ...sdFirst(ms - 1000, 0), next: ms - 1 };
    assert.deepEqual(sdDue(bay, ms, 8), { act: 'rise' });
    assert.ok(sdRise(bay, ms, -1, 0, 8));
  }
  // the count: standing Hollows past the Bay on the other lanes, none of the Bay's
  const stand = (l, at) => ({ s: l * SD_LANE_SPAN + 4, ph: 'risen', r: -1, at, until: at + SD_LIFETIME_MS, next: at + SD_LIFETIME_MS + SD_COOLDOWN_MS });
  const recs = [stand(0, on), stand(1, on), stand(lane, on), stand(5, on - SD_LIFETIME_MS - 1), null];
  assert.equal(sdHeldPast(recs, on, lane), 1, 'lane 1 stands; the Bay\'s, its own and a faded one are not counted');
  assert.equal(sdHeldPast(recs, on, 2), 2);
});

test('FRONTS THE TIMERS AND THE MAP: today\'s two provinces live to the day\'s end, the next two days\' coming, in the world group, only where the host stands the provinces\' events; a place past the Bay says its turn on the map card (mutants: the rows unfronted; the card\'s turn)', () => {
  const rows = frontTimerRows(NOW);
  assert.deepEqual(rows.map((r) => [r.id, r.kind, r.live]), [[`front:${DAY_NOW}`, 'front', true], [`front:${DAY_NOW + 1}`, 'front', false], [`front:${DAY_NOW + 2}`, 'front', false]]);
  assert.equal(rows[0].until, frontDayStartMs(DAY_NOW + 1));
  assert.equal(rows[2].at, frontDayStartMs(DAY_NOW + 2));
  assert.equal(frontDayAt(frontDayStartMs(DAY_NOW + 1) + 1), DAY_NOW + 1);
  assert.match(rows[0].title, /^World events in \S.* and \S/);
  assert.match(rows[1].title, /^Next: /);
  assert.ok(TIMER_GROUPS.find((g) => g.id === 'world').kinds.includes('front'));
  const ids = (src) => eventTimerRows({ now: NOW, ...src }).filter((r) => r.kind === 'front').map((r) => r.id);
  assert.deepEqual(ids({ fronts: true }), rows.map((r) => r.id));
  assert.deepEqual(ids({ fronts: false }), []);
  assert.deepEqual(ids({}), []);
  const when = (ms) => `@${ms}`;
  for (const l of FRONT_PROVINCES) {
    const line = frontCardLine(NOW, l, when);
    assert.equal(line, frontStands(DAY_NOW, l) ? 'World events here now' : `World events here from @${frontDayStartMs(frontNextDay(DAY_NOW, l))}`);
  }
  assert.equal(frontCardLine(NOW, 0, when), null, 'the Bay is no front');
  assert.equal(frontCardLine(NOW, 9, when), null, 'nor the open zone');
});

test('FRONTS the wiring: the law imports nothing; the host hands the Timers and the map their fronts', () => {
  const law = readFileSync(new URL('../../src/net/frontLaw.js', import.meta.url), 'utf8');
  assert.equal([...law.matchAll(/^import /gm)].length, 0, 'the relay\'s graph stays flat');
  const host = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(host, /fronts: !!online\.gateLanesOk && !!socialLink\(\)\?\.gateLanesOk,/);
  assert.match(host, /fronts: \(\) => \(online && _sharedClockHeard && online\.gateLanesOk && socialLink\(\)\?\.gateLanesOk \? battleNowMs\(\) : null\),/);
  assert.match(readFileSync(new URL('../../src/ui/heldMap.js', import.meta.url), 'utf8'), /frontCardLine\(frontNow, theatreOfRegion\(region\)/);
});
