// TIME1 (2026-10-01, Mac: "people have to wait insanely long, werewolf forms last insanely long" / "I don't want a
// band aid, I want a detailed way we can do this" / "Let's do it. This needs to be perfect"): THE SKY'S OWN CLOCK.
// Design: bible/06-Systems/Online-Time-Arc.md. Online the hour, the date, the season and the moons a player sees read
// the SKY - a function of the relay's clock like WORLD5's, at TimeScale 24 from an aligned switch (a day every real
// hour, midnight on the hour - SKY-SLOW; it was 48) - while the EVENT clock (WORLD5's, TimeScale 12) keeps the
// world's schedules, stock, prices, terms and stamps, and the character's own clock keeps combat and the body. THE LAW
// EXECUTES: the sky's law and its inverse, the switch's continuity and alignment (and a second switch's), the tool, the
// bundles (the relay never reaches the sky), the clock module online and offline, the nightfall words at the sky's
// rate, the weather's season, the rounds' moon through the tick, the raid's local time, the dome's two minutes, the
// professions' season - and the four hosts by source.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SKY_SEGMENTS, skyLawOf, skyClassicMinutes, wallMsForSkyMinutes, skyMinutesPerMsAt, alignedSkySwitches } from '../../src/net/skyLaw.js';
import { sharedClassicMinutes, wallMsForClassicMinutes, ONLINE_MINUTES_PER_MS } from '../../src/net/wire.js';
import { graph } from '../importGraph.mjs';
import { setSharedClock, sharedClockOn, worldMinutes, skyMinutes, ownMinutes, setWorldMinutes, worldNightfallText, tickPlayerMinutes, resetMagicRoundMarker, setOwnMinutes } from '../../src/systems/worldTick.js';
import { skyCalendarOn, skyMinuteOfEvent, setSkyCalendar } from '../../src/systems/skyCalendar.js';
import { SYSTEM_TYPES, birthsIn } from '../../src/systems/weather/weatherMap.js';
import { CLIMATES } from '../../src/formats/mapsFile.js';
import { MINUTES_PER_DAY, dateFromClassicMinutes, seasonValue, isFullMoonFromMinutes, isFullMoonNightFromMinutes } from '../../src/systems/gameDate.js';
import { resetWeatherSim, setSharedWeather, rollClimateWeathersForDay, setClimateWeathers, weatherForClimate, ZONE_CLIMATES } from '../../src/systems/weather/weatherSim.js';
import { createLycanthropyCurse, liveLycanthropy } from '../../src/systems/lycanthropy.js';
import { LYCANTHROPY_TYPES } from '../../src/systems/infection.js';
import { raidMapMarks } from '../../src/ui/eventMapMarks.js';
import { skyState } from '../../src/render/enhancedSky.js';
import { dayDate } from '../../src/net/nodeLaw.js';
import { cutoverLines } from '../../tools/skyCutover.mjs';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const SWITCH = SKY_SEGMENTS[0];
const RATE = SWITCH.minutesPerMs;
const HALF_HOUR = 30 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
/** The first whole hour (UTC) after an instant. */
const nextHour = (ms) => Math.ceil((ms + 1) / HOUR) * HOUR;
const minuteOfDay = (m) => ((m % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
/** The first instant from `t`, stepping `step` ms, at which `pred` holds - within `limit` steps, or the test fails:
 *  a mutant that makes the instant unreachable (a sky at the event clock's rate, say) fails here and never hangs. */
const firstWhere = (t, step, limit, pred, what) => {
  for (let k = 0; k < limit; k++, t += step) if (pred(t)) return t;
  return assert.fail(`no ${what} in ${limit} steps of ${step / 1000} real seconds`);
};
/** The production install, at a fixed relay instant `at.t` (offset 0). */
const installAt = (at) => setSharedClock(() => sharedClassicMinutes(at.t), (m) => wallMsForClassicMinutes(m), { sky: () => skyClassicMinutes(at.t), skyWall: (m) => wallMsForSkyMinutes(m) });

afterEach(() => { setSharedClock(null); resetWeatherSim(); setSharedWeather(false); setWorldMinutes(0); });

test('TIME1 the law: the sky IS the event clock before its first switch, the switch is seamless, and after it the sky runs at TimeScale 24 - a day every real hour', () => {
  assert.equal(SKY_SEGMENTS.length >= 1, true);
  assert.equal(RATE, 24 / 60 / 1000, "SKY-SLOW: TimeScale 24");
  for (let t = SWITCH.fromMs - 7 * 86_400_000; t < SWITCH.fromMs; t += 3_600_007) assert.equal(skyClassicMinutes(t), sharedClassicMinutes(t), 'before the switch the sky is the event clock, to the bit');
  assert.equal(skyClassicMinutes(SWITCH.fromMs - 1), sharedClassicMinutes(SWITCH.fromMs - 1));
  assert.equal(skyClassicMinutes(SWITCH.fromMs), sharedClassicMinutes(SWITCH.fromMs), 'at the switch both read one minute: nothing skips');
  assert.ok(skyClassicMinutes(SWITCH.fromMs) - skyClassicMinutes(SWITCH.fromMs - 1000) < 0.21, 'the second before it the sky moved at the old rate');
  assert.ok(near(skyClassicMinutes(SWITCH.fromMs + HOUR) - skyClassicMinutes(SWITCH.fromMs), MINUTES_PER_DAY), 'a real hour after it, a whole day');
  assert.ok(near(skyClassicMinutes(SWITCH.fromMs + 150_000) - skyClassicMinutes(SWITCH.fromMs), 60), 'an hour every two and a half real minutes');
  let last = -Infinity;
  for (let t = SWITCH.fromMs - 60_000; t < SWITCH.fromMs + 60_000; t += 997) { const m = skyClassicMinutes(t); assert.ok(m > last, 'never backwards'); last = m; }
  assert.equal(skyMinutesPerMsAt(SWITCH.fromMs - 1), ONLINE_MINUTES_PER_MS, "before it, the wire's rate");
  assert.equal(skyMinutesPerMsAt(SWITCH.fromMs), RATE);
  assert.equal(sharedClassicMinutes(SWITCH.fromMs + HALF_HOUR) - sharedClassicMinutes(SWITCH.fromMs), 360, 'and the event clock keeps TimeScale 12 for good: six hours in the same half hour');
});

test('TIME1 the inverse round-trips on both sides of the switch', () => {
  for (const t of [SWITCH.fromMs - 86_400_000, SWITCH.fromMs - 1, SWITCH.fromMs, SWITCH.fromMs + 1, SWITCH.fromMs + 12_345_678, SWITCH.fromMs + 40 * 86_400_000]) {
    assert.ok(Math.abs(wallMsForSkyMinutes(skyClassicMinutes(t)) - t) < 1e-3, `ms ${t}`);
  }
  const m = skyClassicMinutes(SWITCH.fromMs) + 1440 * 7 + 1080;   // a dusk a week of sky on
  assert.ok(near(skyClassicMinutes(wallMsForSkyMinutes(m)), m, 1e-6));
});

test('TIME1 a second switch is as seamless as the first: each segment starts where the one before it stood', () => {
  const second = { fromMs: SWITCH.fromMs + 3 * 86_400_000 + 7 * 60_000, minutesPerMs: 60 / 60 / 1000 };
  const law = skyLawOf([SWITCH, second]);
  const reached = skyClassicMinutes(second.fromMs);   // the first segment, read at the second switch
  assert.ok(near(law.minutesAt(second.fromMs), reached), 'the second starts where the first stood');
  assert.ok(near(law.minutesAt(second.fromMs - 1), skyClassicMinutes(second.fromMs - 1)), 'before it, the first segment exactly');
  assert.ok(near(law.minutesAt(second.fromMs + 60_000) - law.minutesAt(second.fromMs), 60), 'after it, the new rate');
  assert.equal(law.rateAt(second.fromMs), second.minutesPerMs);
  for (const t of [SWITCH.fromMs - 5, SWITCH.fromMs + 99, second.fromMs + 77_777]) assert.ok(Math.abs(law.wallMsAt(law.minutesAt(t)) - t) < 1e-3, 'the inverse, segment by segment');
  assert.equal(skyLawOf([]).minutesAt(SWITCH.fromMs + 1), sharedClassicMinutes(SWITCH.fromMs + 1), 'no segment: the event clock');
});

test('TIME1 aligned: the switch stands at an aligned instant - the sky\'s hour there is the old sky\'s - and after it every midnight falls on the hour UTC, dawn at :15, noon at :30, dusk at :45', () => {
  assert.deepEqual(alignedSkySwitches(RATE, SWITCH.fromMs - 1, { count: 1, withinMs: 2000 }), [SWITCH.fromMs], 'the switch is one of the instants the tool lists');
  assert.equal(minuteOfDay(skyClassicMinutes(SWITCH.fromMs)), minuteOfDay(sharedClassicMinutes(SWITCH.fromMs)));
  assert.equal(SWITCH.fromMs % 1000, 0, 'a whole second');
  let t = nextHour(SWITCH.fromMs);
  for (let k = 0; k < 48; k++, t += HOUR) {   // two days of hours
    assert.ok(near(minuteOfDay(skyClassicMinutes(t)) % MINUTES_PER_DAY, 0, 1e-5) || near(minuteOfDay(skyClassicMinutes(t)), MINUTES_PER_DAY, 1e-5), `midnight at ${new Date(t).toISOString()}`);
    assert.ok(near(minuteOfDay(skyClassicMinutes(t + 900_000)), 360, 1e-5), 'dawn a quarter hour on');
    assert.ok(near(minuteOfDay(skyClassicMinutes(t + HALF_HOUR)), 720, 1e-5), 'noon half an hour on');
    assert.ok(near(minuteOfDay(skyClassicMinutes(t + 2_700_000)), 1080, 1e-5), 'dusk three quarters of an hour on');
  }
  // and the instants recur every two hours in the old sky (the design page lists 01:07:30, 03:07:30, 05:07:30 UTC)
  const day = Date.UTC(2026, 9, 2);
  assert.deepEqual(alignedSkySwitches(RATE, day, { count: 3, withinMs: 6 * 3600 * 1000 }).map((x) => new Date(x).toISOString().slice(11, 19)), ['01:07:30', '03:07:30', '05:07:30']);
});

test('TIME1 the tool: tools/skyCutover.mjs lists the aligned instants, and says when the sky already runs at the rate asked', () => {
  const before = cutoverLines(['--after', new Date(SWITCH.fromMs - 3_600_000).toISOString()]);
  assert.match(before[0], /^TimeScale 24 \(a sky day every 60 real minutes\)/);
  assert.ok(before.some((l) => l.includes(new Date(SWITCH.fromMs).toISOString())), before.join('\n'));
  assert.deepEqual(alignedSkySwitches(RATE, SWITCH.fromMs + 1000), [], 'laid on the sky as it stands, a switch to the rate it already runs at is no switch');
  // AUDIT TIME: a merge that lands a day after the switch - the tool lists where the last row may MOVE, laid on the sky
  // without it, and a row moved there is seamless with midnight on the hour
  const late = cutoverLines(['--after', new Date(SWITCH.fromMs + 86_400_000).toISOString()]);
  assert.match(late[0], /aligned instants for the last row/, late.join('\n'));
  const moved = Date.parse(late[1].trim().split(/\s+/)[0]);
  assert.ok(moved >= SWITCH.fromMs + 86_400_000, late.join('\n'));
  const law = skyLawOf([{ fromMs: moved, minutesPerMs: RATE }]);
  assert.ok(near(law.minutesAt(moved), sharedClassicMinutes(moved)), 'no jump where it moves to');
  assert.ok(near(minuteOfDay(law.minutesAt(nextHour(moved))), 0) || near(minuteOfDay(law.minutesAt(nextHour(moved))), 1440), 'midnight on the hour after it');
  assert.match(cutoverLines(['--after', new Date(SWITCH.fromMs + 86_400_000).toISOString(), '--scale', '60'])[1], /^ {2}\d{4}-/, 'another rate has instants of its own');
  assert.match(cutoverLines(['--after', 'never'])[0], /is not a date/);
  // AUDIT TIME (second round): at ANOTHER rate the last row is REPLACED while it is not live yet - the instants laid on the
  // sky without it, and one taken is seamless there - and only once it is live does a NEW row follow it, laid on the sky
  // with it; a rate the sky already runs at then says so
  assert.match(cutoverLines(['--after', new Date(SWITCH.fromMs - 2 * 86_400_000).toISOString(), '--scale', '12'])[1], /already runs at this rate/);
  const RATE48 = 48 / 60 / 1000;
  const early = cutoverLines(['--after', new Date(SWITCH.fromMs - 3_600_000).toISOString(), '--scale', '48']);
  assert.match(early[0], /to replace the last row/, early.join('\n'));
  const swap = Date.parse(early[1].trim().split(/\s+/)[0]);
  assert.ok(near(skyLawOf([...SKY_SEGMENTS.slice(0, -1), { fromMs: swap, minutesPerMs: RATE48 }]).minutesAt(swap), sharedClassicMinutes(swap)), 'the replacing row: no jump where it starts');
  const later = cutoverLines(['--after', new Date(SWITCH.fromMs + 86_400_000).toISOString(), '--scale', '48']);
  assert.match(later[0], /for a new row/, later.join('\n'));
  const next = Date.parse(later[1].trim().split(/\s+/)[0]);
  assert.ok(next > SWITCH.fromMs && near(skyLawOf([...SKY_SEGMENTS, { fromMs: next, minutesPerMs: RATE48 }]).minutesAt(next), skyClassicMinutes(next)), 'the new row: after the last, no jump where it starts');
});

test('TIME1 the bundles: the relay never reaches the sky (RELAY_VERSION is not moved by it); the account service does, through the professions\' day, and its deploy filter names it', () => {
  assert.ok(!graph('server/src/index.js').includes('src/net/skyLaw.js'), 'the relay bundles no sky');
  assert.ok(graph('server-account/src/index.js').includes('src/net/skyLaw.js'), 'the account service bundles it (nodeLaw.js dayDate)');
  assert.match(rd('.github/workflows/account-deploy.yml'), /- "src\/net\/skyLaw\.js"/);
  assert.doesNotMatch(rd('src/net/wire.js'), /skyLaw|SKY_SEGMENTS/, "the wire's bytes are the relay's: the sky is not in them");
});

test('TIME1 the clock module: offline the sky IS the one clock; online it reads its own source; a shared clock installed with no sky has its sky read the event clock; and the weather\'s calendar switches with it', () => {
  setWorldMinutes(777_777);
  assert.equal(sharedClockOn(), false);
  assert.equal(skyMinutes(), 777_777); assert.equal(worldMinutes(), 777_777); assert.equal(ownMinutes(), 777_777, 'offline: one clock, DFU byte for byte');
  assert.equal(skyCalendarOn(), false);
  assert.equal(skyMinuteOfEvent(123_456), 123_456, 'off, an event minute is its own sky minute');
  const afterSwitch = sharedClassicMinutes(SWITCH.fromMs + 3_600_000);
  assert.equal(skyMinuteOfEvent(afterSwitch), afterSwitch, 'off, even past the switch - offline, or a bare source, has one calendar');
  setSharedClock(() => 1000, null, { sky: () => 4321, skyWall: (m) => m * 10 });
  assert.equal(worldMinutes(), 1000, 'the event clock');
  assert.equal(skyMinutes(), 4321, 'the sky');
  assert.equal(skyCalendarOn(), true);
  setSharedClock(() => 1000);
  assert.equal(skyMinutes(), 1000, 'a bare source: the sky reads the event clock, the one rate WORLD5 had');
  assert.equal(skyCalendarOn(), false);
  setSharedClock(null);
  assert.equal(skyCalendarOn(), false, 'removed with the clock');
  // the weather's calendar is the law's own mapping, offset-free
  const at = { t: SWITCH.fromMs + 5 * 3_600_000 };
  installAt(at);
  const m = sharedClassicMinutes(at.t);
  assert.ok(near(skyMinuteOfEvent(m), skyClassicMinutes(at.t), 1e-6), 'an event minute names one instant, and the sky has one reading there');
  assert.ok(near(skyMinuteOfEvent(m), skyMinutes(), 1e-6));
});

test('TIME1 the nightfall words time the SKY\'s dusk at the sky\'s rate - fifteen real minutes from a sky noon, not the event clock\'s thirty - and say nothing at night or offline', () => {
  const noon = nextHour(SWITCH.fromMs) + HALF_HOUR;   // a sky noon: half an hour past a midnight
  const at = { t: noon };
  installAt(at);
  assert.equal(minuteOfDay(Math.round(skyMinutes())), 720);
  assert.equal(worldNightfallText(), "Online, resting does not move the sun. Night falls in about 15 minutes.", 'six sky hours at TimeScale 24: fifteen real minutes');
  at.t = noon + 15 * 60_000 - 30_000;
  assert.equal(worldNightfallText(), "Online, resting does not move the sun. Night falls in about 1 minute.");
  at.t = noon + 15 * 60_000 + 1000;
  assert.equal(worldNightfallText(), null, 'night: nothing to wait for');
  // a bare source keeps WORLD5's rate (the words a pre-TIME1 install said)
  setSharedClock(() => 9 * MINUTES_PER_DAY + 720);
  assert.equal(worldNightfallText(), "Online, resting does not move the sun. Night falls in about 30 minutes.");
  setSharedClock(null);
  setWorldMinutes(9 * MINUTES_PER_DAY + 720);
  assert.equal(worldNightfallText(), null, 'offline the player rests to dusk');
});

test('TIME1 the weather keeps the event clock\'s pace and wears the sky\'s season: the day\'s roll at an event minute draws the sky\'s season\'s table there', () => {
  // an instant whose sky season is not the event clock's (within thirty real days of the switch)
  const seasonOf = (m) => seasonValue(dateFromClassicMinutes(m));
  const t = firstWhere(SWITCH.fromMs + 3_600_000, 600_000, 30 * 144, (u) => seasonOf(skyClassicMinutes(u)) !== seasonOf(sharedClassicMinutes(u)), 'instant whose sky season is not the event clock\'s');
  const at = { t };
  installAt(at);
  const m = Math.floor(sharedClassicMinutes(t));
  const skySeason = seasonOf(skyMinuteOfEvent(m)), eventSeason = seasonOf(m);
  assert.notEqual(skySeason, eventSeason);
  const weathersOf = (fn) => { resetWeatherSim(); fn(); return ZONE_CLIMATES.map((c) => weatherForClimate(c)); };
  let differed = false;
  for (const r of [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95]) {
    const rolls = () => r;
    const rolled = weathersOf(() => rollClimateWeathersForDay(m, rolls));
    assert.deepEqual(rolled, weathersOf(() => setClimateWeathers(skySeason, rolls)), `the sky's season's table (roll ${r})`);
    if (JSON.stringify(rolled) !== JSON.stringify(weathersOf(() => setClimateWeathers(eventSeason, rolls)))) differed = true;
  }
  assert.ok(differed, 'and some roll tells the two seasons apart - the table is the sky\'s, not the event clock\'s');
});

test('TIME1 the weather map\'s systems live on the event clock and are born to the sky\'s season and hour: a node drawn with the sky up draws to the sky\'s calendar, and a node drawn on one calendar is never served on the other', () => {
  try {
    let found = 0;
    for (const climate of [CLIMATES.Mountain, CLIMATES.Woodlands, CLIMATES.MountainWoods]) {
      const climateAt = () => climate;
      for (const type of ['rain', 'snow', 'overcast', 'cloudy', 'fog']) {
        const nodeMinutes = SYSTEM_TYPES[type].node[1];
        const first = Math.floor(sharedClassicMinutes(SWITCH.fromMs + 3_600_000) / nodeMinutes);
        for (let gt = first; gt < first + 60; gt++) {
          setSkyCalendar(true);
          const sky = birthsIn(type, 3, 3, gt, climateAt).map((b) => b.id).join();
          setSkyCalendar(false);
          const one = birthsIn(type, 3, 3, gt, climateAt).map((b) => b.id).join();   // the SAME lookup: the memo must not serve the sky's
          if (sky !== one) found++;
        }
      }
    }
    assert.ok(found > 0, 'some node keeps a different set of births under the sky\'s calendar than under the event clock\'s');
    // and every system still LIVES on the event clock: a birth's minute is an event minute inside its node
    setSkyCalendar(true);
    const nodeMinutes = SYSTEM_TYPES.rain.node[1], gt = Math.floor(sharedClassicMinutes(SWITCH.fromMs + 3_600_000) / nodeMinutes) + 7;
    for (const b of birthsIn('rain', 3, 3, gt, () => CLIMATES.Woodlands)) assert.ok(b.bornAt >= gt * nodeMinutes && b.bornAt < (gt + 1) * nodeMinutes, 'born at an event minute of its node');
  } finally { setSkyCalendar(false); }
});

test('TIME1 the rounds read the SKY\'s moon through the tick: a werewolf under a full moon in the sky is changed, whatever the event clock\'s date - and a bare source (the event clock\'s date) leaves them be', () => {
  // an instant whose sky shows a full moon UP (TIME2: online the moon forces its night) and whose event clock's date
  // has none, now or a minute on
  const t = firstWhere(SWITCH.fromMs + 60_000, 60_000, 14 * 1440, (u) => isFullMoonNightFromMinutes(skyClassicMinutes(u)) && isFullMoonNightFromMinutes(skyClassicMinutes(u + 15_000))
    && !isFullMoonFromMinutes(sharedClassicMinutes(u)) && !isFullMoonFromMinutes(sharedClassicMinutes(u + 60_000)), 'sky full-moon night over an event date with no full moon');
  const wolf = () => {
    const p = {
      isPlayer: true, level: 5, chargenDone: true, skillUses: new Array(35).fill(0), lastSkillCheckTime: 0, fatigue: 3200,
      stats: { strength: 50, agility: 50, endurance: 50, speed: 50, willpower: 50, intelligence: 50, personality: 50, luck: 50 },
      skills: {}, health: 60, maxHealth: 60, items: [], spells: [], activeEffects: [],
    };
    createLycanthropyCurse(p, LYCANTHROPY_TYPES.Werewolf, { now: 0 });
    return p;
  };
  const sinks = () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, restoreFatigue() {}, say() {}, drainFatigue() {} });
  const run = (install) => {
    const at = { t };
    install(at);
    const p = wolf();
    setOwnMinutes(Math.floor(sharedClassicMinutes(at.t)));
    resetMagicRoundMarker(Math.floor(sharedClassicMinutes(at.t)));
    tickPlayerMinutes({ entity: p, classicMinutes: 0, dt: 0.016, sinks: sinks(), rolls: () => 0.5 });
    at.t += 15_000;   // three event minutes: three rounds on the character's clock
    tickPlayerMinutes({ entity: p, classicMinutes: 0, dt: 0.016, sinks: sinks(), rolls: () => 0.5 });
    setSharedClock(null);
    return liveLycanthropy(p).isTransformed;
  };
  assert.equal(run(installAt), true, 'the sky\'s full moon forces the change');
  assert.equal(run((at) => setSharedClock(() => sharedClassicMinutes(at.t))), false, 'the event clock\'s date is no full moon');
});

test('TIME1 the raids\' map tip says a withdrawal in local time when the host can say one, and the game clock\'s otherwise (offline)', () => {
  const raid = { px: 10, py: 20, locationName: 'Gothway Garden', regionIndex: 17, type: 2, startMinute: 1000, endMinute: 1120, attackAmount: 20, killed: 0, cleansed: false };
  const [game] = raidMapMarks([raid], 1050);
  assert.equal(game.tip.lines.at(-1), 'Withdraws at 18:40', 'offline: the one clock\'s time');
  const [local] = raidMapMarks([raid], 1050, { localTime: (m) => (m === 1120 ? '14:32' : null) });
  assert.equal(local.tip.lines.at(-1), 'Withdraws at 14:32 your time', 'online: this machine\'s time');
  const [none] = raidMapMarks([raid], 1050, { localTime: () => null });
  assert.equal(none.tip.lines.at(-1), 'Withdraws at 18:40', 'no local time to say: the game clock\'s');
});

test('TIME1 the dome dates the moons by the sky and lets the clouds live on the event clock - two minutes where it took one', () => {
  const ev = 900_000, sky = 912_345;
  const two = skyState({ minuteOfDay: 600, classicMinutes: ev, skyMinutes: sky });
  assert.equal(two.minutes, ev, 'VC7a: the clouds\' clock is the event clock\'s');
  assert.deepEqual(two.masser, skyState({ minuteOfDay: 600, classicMinutes: sky }).masser, 'Masser\'s phase is the sky\'s date\'s');
  assert.deepEqual(two.secunda, skyState({ minuteOfDay: 600, classicMinutes: sky }).secunda);
  assert.deepEqual(skyState({ minuteOfDay: 600, classicMinutes: ev }).masser, skyState({ minuteOfDay: 600, classicMinutes: ev, skyMinutes: ev }).masser, 'one minute handed: the one clock for both, as offline');
});

test('TIME1 the professions\' day reads the sky\'s season - one law at both ends, the event clock\'s before the switch', () => {
  const dayOf = (ms) => Math.floor(ms / 86_400_000);
  const after = dayOf(SWITCH.fromMs) + 3;
  assert.deepEqual(dayDate(after), dateFromClassicMinutes(Math.floor(skyClassicMinutes(after * 86_400_000))));
  const before = dayOf(SWITCH.fromMs) - 3;
  assert.deepEqual(dayDate(before), dateFromClassicMinutes(Math.floor(sharedClassicMinutes(before * 86_400_000))), 'before the switch the sky is the event clock');
});

test('TIME1 by source - THE FOUR HOSTS RULE: world.js installs the sky beside the event clock and every host reads the sky for the sky (the frame\'s hour, the seasons, the rounds\' sky, the interior\'s light, the sunlight seam); the sky feed takes two minutes; the wilds\' night is the sky\'s', () => {
  const world = rd('src/scenes/world.js'), exterior = rd('src/scenes/exterior.js'), modes = rd('src/scenes/worldModes.js'), dungeon = rd('src/scenes/dungeonContext.js'), shared = rd('src/scenes/shared.js');
  assert.match(world, /setSharedClock\(\(\) => sharedClassicMinutes\(Date\.now\(\) \+ _sharedOffsetMs\), \(m\) => wallMsForClassicMinutes\(m\) - _sharedOffsetMs, \{ sky: \(\) => skyClassicMinutes\(Date\.now\(\) \+ _sharedOffsetMs\), skyWall: \(m\) => wallMsForSkyMinutes\(m\) - _sharedOffsetMs \}\)/, 'the install: the event clock and the sky, through one offset');
  for (const [name, src] of [['world.js', world], ['exterior.js', exterior]]) {
    assert.match(src, /const minuteNow = \(\) => skyMinutes\(\) % 1440;/, `${name}: the frame's hour`);
    assert.match(src, /let season = seasonPin \?\? climateSeasonFromMinutes\(skyMinutes\(\)\);/, `${name}: the season`);
    assert.match(src, /classicMinutes: playerTicker\.classicMinutes, skyMinutes: skyMinutes\(\),/, `${name}: the sky feed's two minutes`);
  }
  assert.match(modes, /renderer\.setLighting\(new Float32Array\(isNight\(skyMinutes\(\) % 1440\)/, "worldModes.js: the interior's night");
  assert.match(modes, /now: \(\) => Math\.floor\(skyMinutes\(\)\),   \/\/ a VIEW on the one world clock; TIME1/, 'worldModes.js: the sunlight seam');
  assert.match(dungeon, /skyMinutes: sharedClockOn\(\) \? Math\.floor\(skyMinutes\(\)\) : null \}\)/, "dungeonContext.js: the rest's rounds read the sky");
  assert.match(dungeon, /now: \(\) => Math\.floor\(skyMinutes\(\)\),   \/\/ LIVED1: the sunlight seam/, 'dungeonContext.js: the sunlight seam');
  assert.match(shared, /const skyNow = extra\?\.skyMinutes \?\? nowMin;/, 'the feed: the sky\'s minute, or the one clock');
  assert.match(shared, /const dt = lastMin === null \|\| nowMin < lastMin \? 0 : nowMin - lastMin;/, 'the feed walks the event clock: dt, the ease, the wind, the drift');
  assert.match(shared, /minuteOfDay, classicMinutes: skyNow, weather: skyWord/, "the mod's date is the sky's");
  assert.match(world, /skyMinute: \(\) => Math\.floor\(skyMinutes\(\)\),   \/\/ TIME1: the wilds' night/, "the wilds' night");
  assert.match(rd('src/scenes/exteriorFoes.js'), /night = isNight\(\(skyMinute \?\? currentMinute\)\(\)\)/);
  assert.match(rd('src/systems/worldTick.js'), /skyMinutes: _sharedClock \? skyMinutes\(\) : null \}\);/, "the tick's rounds read the sky");
  // AUDIT TIME (second round): the standalone host's camp roll reads the sky ONLINE only - offline its day and night are the
  // minute the catch-up walks, as the lone roll's beside it (a raise across 18:00 rolled the night table for the day's window)
  assert.match(exterior, /rollCampEncounter\(\{\n\s+gameMinutes: _lastEncMinutes \+ l \+ 1, inside: _m !== 'exterior',\n\s+skyMinutes: sharedClockOn\(\) \? Math\.floor\(skyMinutes\(\)\) : null,/, "exterior.js: the camp roll's sky, online only");
});

test('TIME1 AUDIT: the coven\'s re-roll is a STAMP on the event clock - the sky\'s days turning four times as fast re-roll nothing; the event clock\'s next day does; a prince\'s own day is the sky\'s', async () => {
  const { daedraForSummoner, DAEDRA, WITCHES_COVEN_TYPE: COVEN } = await import('../../src/systems/daedraSummoning.js');
  const state = {};
  let k = 0;
  const rolls = () => [0.1, 0.5, 0.9][k++ % 3];
  const first = daedraForSummoner({ factionId: 1, factionType: COVEN, dayOfYear: 280, rerollDay: 250, state, rolls });
  for (const skyDay of [281, 282, 283]) assert.equal(daedraForSummoner({ factionId: 1, factionType: COVEN, dayOfYear: skyDay, rerollDay: 250, state, rolls }), first, `the sky's day ${skyDay}: the same prince`);
  assert.equal(state.daedraSummonDay, 250, 'the saved stamp is the event clock\'s day');
  assert.notEqual(daedraForSummoner({ factionId: 1, factionType: COVEN, dayOfYear: 284, rerollDay: 251, state, rolls }), first, 'the event clock\'s next day re-rolls');
  const offline = {};
  daedraForSummoner({ factionId: 1, factionType: COVEN, dayOfYear: 90, state: offline, rolls });
  assert.equal(offline.daedraSummonDay, 90, 'offline (no rerollDay) DFU\'s one day');
  const prince = DAEDRA.find((d) => d.dayOfYear > 0);
  assert.equal(daedraForSummoner({ factionId: 999, factionType: 0, dayOfYear: prince.dayOfYear, rerollDay: 1 }), prince, 'a prince answers on the sky\'s day');
  assert.match(rd('src/scenes/worldModes.js'), /rerollDay: dayOfYearFromMinutes\(Math\.floor\(worldMinutes\(\)\)\),/);
});
