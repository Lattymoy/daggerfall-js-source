// AUDIT WORLD5 (Mac, 2026-09-13: "Lets do an audit on this") - four opus
// lenses over WORLD5 (the wire, the relay and what the player is told; the
// weather and the boot; the clock and the ticker; the rest, the travel and
// the quests), each told the live report and made to find it. Fourteen
// findings fixed, the rest recorded. THE FIXES EXECUTE: the dungeon's rest
// arm no longer runs a rested night's rounds twice (C1 - its own claim moved
// the broker's marker past the tick's last reading, and the tick's backstop
// took the reading for a load); a source that steps backwards re-anchors
// rather than freezing every tick (C2); the alignment is a SHIFT of every
// marker the save carries, not a stamp of four (C3 - a save further along
// than the world raised no skill and trained nowhere for real days); a load
// online is an arrival through save.js's one door (C4); the shared roll is
// the day's, stamped at its first minute and its evolution replayed from its
// first hour (C5); the collapse pays its hour once a world hour (C6); a
// covered rest loses the world's time and a leap is taken a sub-tick a frame
// (C7); the sub-tick's span rides to the host (C8); and by source: the
// dungeon arm's span (C8), the sentence refilling nothing (C9), exterior.js's
// stand-down word (C10), the welcome's clock stamped as it is built (C11),
// the pane's copy (C12), the install at the top of the boot (C13), the
// cautious heal offline only (C14).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RELAY_VERSION } from '../server/src/index.js';
import { CLASSIC_GAME_START_TIME, MINUTES_PER_DAY } from '../src/systems/gameDate.js';
import { worldMinutes, setWorldMinutes, setSharedClock, alignEntityClocks, resetMagicRoundMarker, tickPlayerMinutes, claimMagicRounds } from '../src/systems/worldTick.js';
import { setSharedWeather, resetWeatherSim, rollClimateWeathersForDay, weatherForClimate, ZONE_CLIMATES, tickWeather, currentWeatherEnum, weatherJumpStamp, evolveClimateWeathers, setWeatherEvolution, WEATHER_ENUM } from '../src/systems/weatherSim.js';
import { RestSession, MINUTES_PER_TICK } from '../src/systems/restSession.js';
import { exhaustionOutcome } from '../src/systems/rest.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { liveVampirism } from '../src/systems/racialLive.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const tickEntity = () => ({ chargenDone: true, skillUses: new Array(35).fill(0), stats: {}, skills: 30, activeEffects: [], lastSkillCheckTime: 0, fatigue: 3200, health: 50, maxHealth: 50 });
const sinks = () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, restoreFatigue() {}, say() {}, drainFatigue() {} });
const restDeps = (over = {}) => { const d = { minutes: 0, ends: [], vitals: 0, advanceMinutes(n, end) { d.minutes += n; d.ends.push(end); }, tickVitals() { d.vitals++; return false; }, enemiesNearby: () => false, fullyHealed: () => false, dead: () => false, ...over }; return d; };
const offline = () => { setSharedClock(null); resetMagicRoundMarker(); setWorldMinutes(CLASSIC_GAME_START_TIME); };

test('AUDIT WORLD5 C1: the dungeon\'s rest arm claims its own window under the shared clock and the tick does not run it again - the claim moves the tick\'s last reading, so the backstop that takes a reading behind the marker for a load never fires on a rested night', () => {
  let clock = CLASSIC_GAME_START_TIME + 3 * MINUTES_PER_DAY + 100;
  const entity = tickEntity();
  try {
    setSharedClock(() => clock);
    alignEntityClocks(entity, worldMinutes());
    // the rest's sub-tick: ten of the world's minutes passed, the arm claims [start, end) itself (dungeonContext _restAdvance)
    clock += 10.4;
    const end = clock; const start = Math.floor(end) - 10;
    assert.equal(claimMagicRounds(start, end).rounds, 10, 'the arm\'s own claim: the rested ten minutes');
    // the next frame's tick, a moment later
    clock += 0.2;
    const r = tickPlayerMinutes({ entity, classicMinutes: 0, dt: 0.016, sinks: sinks(), rolls: () => 0.5 });
    assert.equal(r.rounds, 0, 'the tick owes nothing the arm already ran - before C1 it re-anchored on its stale reading and ran the ten again');
    clock += 2;
    assert.equal(tickPlayerMinutes({ entity, classicMinutes: 0, dt: 0.016, sinks: sinks(), rolls: () => 0.5 }).rounds, 2, 'and the clock\'s next two minutes are the tick\'s');
  } finally { offline(); }
  const wt = rd('src/systems/worldTick.js');
  assert.match(wt, /if \(_sharedClock && nextFloor > \(_sharedLastTick \?\? -Infinity\)\) _sharedLastTick = nextFloor;/, 'the claim moves the reading, at the broker');
});

test('AUDIT WORLD5 C2: a source that steps BACKWARDS re-anchors the tick\'s reading instead of freezing every tick until the clock catches its old self up; and the world host runs the arrival again when the relay\'s correction moves the clock by more than a second', () => {
  let clock = CLASSIC_GAME_START_TIME + 5 * MINUTES_PER_DAY;
  const entity = tickEntity();
  try {
    setSharedClock(() => clock);
    alignEntityClocks(entity, worldMinutes());
    clock += 3;
    assert.equal(tickPlayerMinutes({ entity, classicMinutes: 0, dt: 0.016, sinks: sinks(), rolls: () => 0.5 }).rounds, 3);
    clock -= 100;   // the machine's clock set back, the relay's offset corrected the other way
    assert.equal(tickPlayerMinutes({ entity, classicMinutes: 0, dt: 0.016, sinks: sinks(), rolls: () => 0.5 }).rounds, 0, 'a step back owes nothing');
    alignEntityClocks(entity, worldMinutes());   // what the world host's onlineArrival does on a correction over a second
    clock += 2;
    assert.equal(tickPlayerMinutes({ entity, classicMinutes: 0, dt: 0.016, sinks: sinks(), rolls: () => 0.5 }).rounds, 2, 'the tick runs from the re-anchored reading - before C2 it froze for the hundred minutes');
  } finally { offline(); }
  assert.match(rd('src/systems/worldTick.js'), /if \(_sharedClock\(\) < classicMinutes\) classicMinutes = _sharedClock\(\);/, 'the re-anchor');
  const w = rd('src/scenes/world.js');
  assert.match(w, /online\.onClock = \(offsetMs\) => \{ const was = _sharedOffsetMs; _sharedOffsetMs = offsetMs; if \(Math\.abs\(offsetMs - was\) > 1000\) onlineArrival\(\); \};/, 'a correction over a second is an arrival');
  assert.match(w, /const onlineArrival = \(\) => \{ alignEntityClocks\(playerEntity, worldMinutes\(\)\); rollClimateWeathersForDay\(worldMinutes\(\)\); refreshSeason\(worldMinutes\(\)\); \};\s*onlineArrival\(\);/, 'the same arrival the session\'s start runs');
});

test('AUDIT WORLD5 C3: the alignment is a SHIFT of every marker the save carries by the distance from the save\'s clock to the world\'s - a room keeps its hours, a loan its week, a summoned item what it had left, a skill check that was due is due now; a "last" marker never lands ahead of now; a zero stays zero; a fresh character moves nothing; a hole in the effects list is not a curse', () => {
  const save = CLASSIC_GAME_START_TIME + 60 * MINUTES_PER_DAY + 500;   // the save's own clock: sixty days in
  const day = (m) => Math.floor(m / MINUTES_PER_DAY);
  const mk = () => ({
    ...tickEntity(), lastGameMinutes: save, lastSkillCheckTime: save - 100, timeOfLastSkillTraining: save - 2000, lastEnemyAlertTime: save - 30,
    timeForThievesGuildLetter: save + 700, timeForDarkBrotherhoodLetter: 0,
    activeEffects: [{ key: 'Disease-Plague', lastDay: day(save) }, { key: 'Poison-Nux', lastMinute: save - 5 }, null, { kind: 'racialOverride', racial: 'vampirism', lastTimeFed: save - 60 }],
    bankAccounts: [{ regionIndex: 0, loanTotal: 500, loanDueDate: save + 5000 }, { regionIndex: 1, loanTotal: 0, loanDueDate: 0 }],
    rentedRooms: [{ expiryMinutes: save + 1200 }],
    items: [{ timeForItemToDisappear: save + 30 }, { timeForItemToDisappear: 0 }],
    guildMemberships: { mortal: { FightersGuild: { guild: 'Fighters', rank: 1, lastRankChange: day(save) - 3 } }, vampire: {} },
  });
  for (const [label, now] of [['a young world, the save far ahead of it', save - 30 * MINUTES_PER_DAY], ['an old world, the save far behind it', save + 375 * MINUTES_PER_DAY + 17]]) {
    const e = mk();
    try {
      setSharedClock(() => now);
      assert.equal(alignEntityClocks(e, worldMinutes()), true, label);
      const d = now - save;
      assert.equal(e.lastGameMinutes, now, label);
      assert.equal(e.lastSkillCheckTime, save - 100 + d, `${label}: the skill check keeps its distance`);
      assert.equal(e.timeOfLastSkillTraining, save - 2000 + d);
      assert.equal(e.lastEnemyAlertTime, save - 30 + d);
      assert.equal(e.timeForThievesGuildLetter, save + 700 + d, 'a letter due in 700 minutes is due in 700 minutes');
      assert.equal(e.timeForDarkBrotherhoodLetter, 0, 'no letter stays no letter');
      assert.equal(e.activeEffects[0].lastDay, day(now), 'the disease ticked today, in the world\'s calendar');
      assert.equal(e.activeEffects[1].lastMinute, save - 5 + d);
      assert.equal(e.activeEffects[3].lastTimeFed, save - 60 + d, 'the vampire fed an hour ago');
      assert.equal(liveVampirism(e).lastTimeFed, save - 60 + d, 'through the accessor, past the hole');
      assert.equal(e.bankAccounts[0].loanDueDate, save + 5000 + d, 'the loan is due when it was due');
      assert.equal(e.bankAccounts[1].loanDueDate, 0, 'no loan, no date');
      assert.equal(e.rentedRooms[0].expiryMinutes, save + 1200 + d, 'the room keeps its twenty hours');
      assert.equal(e.items[0].timeForItemToDisappear, save + 30 + d, 'the summoned item its half hour');
      assert.equal(e.items[1].timeForItemToDisappear, 0, 'an item that never disappears still never does');
      assert.equal(e.guildMemberships.mortal.FightersGuild.lastRankChange, day(now) - 3, 'the rank changed three days ago');
      assert.equal(now - e.lastSkillCheckTime, 100, 'the skill check is a hundred minutes old on the world\'s clock - before C3 an old save in a young world read it as days in the future and raised nothing for real days');
    } finally { offline(); }
  }
  // a "last" marker never lands ahead of now: a save whose last check was ahead of its own day marker
  const e = { ...tickEntity(), lastGameMinutes: save, lastSkillCheckTime: save + 50 };
  try { setSharedClock(() => save + 10); alignEntityClocks(e, worldMinutes()); assert.equal(e.lastSkillCheckTime, save + 10); } finally { offline(); }
  // a fresh character: no day marker to measure from - the "last" markers are stamped to now, the deadlines untouched, zero stays zero
  const fresh = { ...tickEntity(), lastGameMinutes: undefined, lastSkillCheckTime: 0, rentedRooms: [{ expiryMinutes: 99 }] };
  try { setSharedClock(() => save); alignEntityClocks(fresh, worldMinutes()); assert.equal(fresh.lastSkillCheckTime, 0); assert.equal(fresh.rentedRooms[0].expiryMinutes, 99); assert.equal(fresh.lastGameMinutes, save); } finally { offline(); }
  assert.equal(liveVampirism({ activeEffects: [null, { kind: 'racialOverride', racial: 'vampirism' }] })?.racial, 'vampirism', 'the accessor steps over a hole');
});

test('AUDIT WORLD5 C4: a LOAD under the shared clock is an arrival through save.js\'s one door - the restored markers shifted to the world\'s time and the day\'s sky rolled from the shared day, over the clock and the sky the save carried', () => {
  resetWeatherSim();
  const saved = CLASSIC_GAME_START_TIME + 2 * MINUTES_PER_DAY;
  // a date whose shared roll is not sunny for the desert, so the drain is visible
  let now = CLASSIC_GAME_START_TIME + 40 * MINUTES_PER_DAY + 720;
  try {
    setSharedClock(() => now); setSharedWeather(true);
    for (let i = 0; i < 60; i++) { rollClimateWeathersForDay(now); if (weatherForClimate(ZONE_CLIMATES[0]) !== WEATHER_ENUM.sunny) break; now += MINUTES_PER_DAY; }
    resetWeatherSim(); setSharedWeather(true);
    const live = { items: [], stats: {}, skills: 30, activeEffects: [], lastSkillCheckTime: saved - 100, rentedRooms: [{ expiryMinutes: saved + 600 }] };
    const snap = JSON.parse(JSON.stringify(snapshotPlayer(live, { classicMinutes: saved })));
    snap.weather = 'snow';
    const fresh = { items: [], stats: {} };
    const extras = restorePlayer(fresh, snap);
    assert.equal(extras.classicMinutes, saved, 'the save\'s clock rides out as it always did (and the host\'s write of it is refused)');
    assert.equal(fresh.lastGameMinutes, Math.floor(now), 'the day marker is the world\'s, not the save\'s');
    assert.equal(fresh.lastSkillCheckTime, saved - 100 + (Math.floor(now) - saved), 'shifted, with the rest');
    assert.equal(fresh.rentedRooms[0].expiryMinutes, saved + 600 + (Math.floor(now) - saved));
    assert.equal(currentWeatherEnum(), WEATHER_ENUM.snow, 'the saved sky stands until the first exterior frame drains the day\'s array');
    assert.equal(tickWeather(now, ZONE_CLIMATES[0]), true, 'and that frame applies the shared day\'s roll over it');
    assert.equal(currentWeatherEnum(), weatherForClimate(ZONE_CLIMATES[0]));
    assert.notEqual(currentWeatherEnum(), WEATHER_ENUM.snow);
  } finally { offline(); resetWeatherSim(); }
  assert.match(rd('src/systems/save.js'), /resetMagicRoundMarker\(Math\.floor\(snap\.classicMinutes \?\? 0\)\);\s*(?:\/\/[^\n]*\n\s*)*if \(sharedClockOn\(\)\) \{ alignEntityClocks\(entity, worldMinutes\(\)\); rollClimateWeathersForDay\(worldMinutes\(\)\); \}/, 'the one door every host loads through');
});

test('AUDIT WORLD5 C5: the shared roll is THE DAY\'S - stamped at the day\'s first minute, so a joiner\'s drain at noon is a jump and a midnight roll\'s is a front; and the evolution replays from the day\'s first hour, so a client that joined at noon carries the sky the one that stood under it since midnight does', () => {
  const dayStart = CLASSIC_GAME_START_TIME - (CLASSIC_GAME_START_TIME % MINUTES_PER_DAY) + 20 * MINUTES_PER_DAY;
  // the stamp: noon is a jump, midnight a front
  resetWeatherSim(); setSharedWeather(true);
  let now = dayStart + 720;
  for (let i = 0; i < 60 && weatherForClimate(ZONE_CLIMATES[1]) === WEATHER_ENUM.sunny; i++) { now += MINUTES_PER_DAY; rollClimateWeathersForDay(now); }
  const before = weatherJumpStamp();
  assert.equal(tickWeather(now, ZONE_CLIMATES[1]), true);
  assert.equal(weatherJumpStamp(), before + 1, 'a noon roll drained at noon: the sky changed hours ago, the player arrived under it');
  resetWeatherSim(); setSharedWeather(true);
  rollClimateWeathersForDay(now - 720 + 5);
  const b2 = weatherJumpStamp();
  tickWeather(now - 720 + 5, ZONE_CLIMATES[1]);
  assert.equal(weatherJumpStamp(), b2, 'the same day rolled five minutes past midnight and drained then: a front');
  // the replay: one client from midnight hour by hour, another joining at 15:00 - one sky
  const arr = () => ZONE_CLIMATES.map((c) => weatherForClimate(c));
  resetWeatherSim(); setSharedWeather(true); setWeatherEvolution(true);
  rollClimateWeathersForDay(dayStart);
  for (let h = 0; h <= 15; h++) evolveClimateWeathers(dayStart + h * 60 + 7);
  const sinceMidnight = arr();
  resetWeatherSim(); setSharedWeather(true); setWeatherEvolution(true);
  rollClimateWeathersForDay(dayStart + 15 * 60 + 7);
  evolveClimateWeathers(dayStart + 15 * 60 + 7);
  assert.deepEqual(arr(), sinceMidnight, 'the joiner replayed every hour of the day');
  // offline the stamp is the roll's own minute and the evolution re-anchors without rolling, as CLK2 left it
  resetWeatherSim(); setWeatherEvolution(true);
  rollClimateWeathersForDay(dayStart + 15 * 60, () => 0.5);
  const off = arr();
  evolveClimateWeathers(dayStart + 15 * 60);
  assert.deepEqual(arr(), off, 'offline: no replay');
  resetWeatherSim();
  assert.match(rd('src/systems/weatherSim.js'), /_rolledAtMinutes = stampRoll\(nowMinutes\);/g);
  assert.equal((rd('src/systems/weatherSim.js').match(/_rolledAtMinutes = stampRoll\(nowMinutes\);/g) ?? []).length, 2, 'the day roll and the boot\'s lazy roll');
});

test('AUDIT WORLD5 C6: online the collapse\'s hour cannot be charged, so it is not paid twice in one - the fatigue hour every collapse (it stands the player up), the health and the magicka once per WORLD hour; offline every collapse costs its hour and pays in full', () => {
  const P = () => ({ isPlayer: true, level: 5, maxHealth: 50, maxMagicka: 40, fatigue: 0, stats: { strength: 50, endurance: 50, willpower: 50 }, skills: 30, career: {} });
  let clock = CLASSIC_GAME_START_TIME + 7 * MINUTES_PER_DAY + 30;
  const e = P();
  try {
    setSharedClock(() => clock);
    const first = exhaustionOutcome({ entity: e });
    assert.ok(first.kind === 'rest' && first.health > 0 && first.magicka > 0 && first.fatigue > 0, 'the first collapse of the hour pays');
    const again = exhaustionOutcome({ entity: e });
    assert.deepEqual([again.kind, again.health, again.magicka, again.fatigue > 0], ['rest', 0, 0, true], 'the same hour: the fatigue hour and nothing else');
    clock += 60;
    assert.ok(exhaustionOutcome({ entity: e }).health > 0, 'the next world hour pays again');
  } finally { offline(); }
  const o = P();
  assert.ok(exhaustionOutcome({ entity: o }).health > 0 && exhaustionOutcome({ entity: o }).health > 0, 'offline: every collapse, in full');
  assert.deepEqual(exhaustionOutcome({ entity: P(), enemiesNearby: true }).kind, 'death', 'the fatal arms untouched');
});

test('AUDIT WORLD5 C7: a rest COVERED under the shared clock loses the world\'s time it covers, keeping less than one sub-tick, as the timer loses it offline; a leap of the clock (a hidden tab) is taken one sub-tick a FRAME, so every hourly check reads a frame of its own', () => {
  let clock = 8000;
  let covered = false;
  const d = restDeps({ sharedMinutes: () => clock });
  const s = new RestSession('timed', 9, d, -1, () => !covered);
  s.tick(0.016);   // the anchor
  clock += 10; s.tick(0.016);
  assert.equal(d.minutes, 10, 'one sub-tick');
  covered = true;
  clock += 605;
  assert.equal(s.tick(0.016), null, 'covered: nothing');
  covered = false;
  s.tick(0.016);
  assert.equal(d.minutes, 10, 'uncovered: the covered hour is LOST, not banked - before C7 sixty sub-ticks ran in this one frame');
  clock += 5; s.tick(0.016);
  assert.equal(d.minutes, 20, 'the remainder under one sub-tick was kept, as the timer keeps its fraction');
  // the leap: one sub-tick a frame, and the hourly enemy check on its own frame
  let foes = false;
  const d2 = restDeps({ sharedMinutes: () => clock, enemiesNearby: () => foes });
  const s2 = new RestSession('timed', 9, d2);
  s2.tick(0.016);
  clock += 180;   // three hours the tab was hidden
  const frames = [];
  let result = null;
  for (let f = 0; f < 20 && !result; f++) { if (f === 5) foes = true; result = s2.tick(0.016); frames.push(result); }   // a foe wanders in while the first hour resolves
  assert.equal(frames.length, 6, 'six frames, six sub-ticks: the first hour, and its check');
  assert.equal(d2.minutes, 60);
  assert.deepEqual(frames.slice(0, 5), [null, null, null, null, null]);
  assert.equal(result?.enemyBroke, true, 'the first hour\'s check, on its own frame, saw the foe and broke the rest - before C7 all three hours resolved in one frame against one snapshot of the foes');
});

test('AUDIT WORLD5 C8: the sub-tick\'s own span rides to the host - its end, the reading just counted, under the shared clock; null offline - and the dungeon\'s rest arm reads its spawn window and its broker window off it, not off a clock it is refused', () => {
  let clock = 5000.4;
  const d = restDeps({ sharedMinutes: () => clock });
  const s = new RestSession('timed', 2, d);
  s.tick(0.016);
  clock += 10; s.tick(0.016);
  clock += 10; s.tick(0.016);
  assert.deepEqual(d.ends, [5010.4, 5020.4], 'each sub-tick\'s end: the reading, ten apart - two distinct windows');
  const off = restDeps();
  const so = new RestSession('timed', 2, off);
  so.tick(0.13);   // one of the timer's sub-ticks (REST_WAIT_PER_HOUR / MINUTES_PER_TICK real seconds)
  assert.deepEqual(off.ends, [null], 'offline the host reads its own clock');
  assert.match(rd('src/systems/restSession.js'), /this\.deps\.advanceMinutes\(MINUTES_PER_TICK, this\._sharedAt\);/);
  const dc = rd('src/scenes/dungeonContext.js');
  const i = dc.indexOf('const _restAdvance = (n, sharedEnd = null) => {');
  const arm = dc.slice(i, dc.indexOf('\n  };', i));
  assert.ok(i > 0 && arm.length > 200);
  assert.ok(arm.includes('const end = sharedEnd ?? classicMinutesRef.value + n;') && arm.includes('const start = Math.floor(end) - n;'), 'the span from the session');
  assert.ok(arm.includes('const _w = claimMagicRounds(start, end);'), 'the broker window off the same span');
  assert.ok(arm.includes('gameMinutes: start + l + 1,'), 'and the spawner offered each of its ten minutes once');
  assert.match(dc, /advanceMinutes: \(n, sharedEnd\) => _restAdvance\(n, sharedEnd\),/);
});

test('AUDIT WORLD5 by source: the sentence refills nothing online (C9), exterior.js says the stand-down (C10), the welcome\'s clock is stamped as it is built and the relay says which one it is (C11), the pane says the clock (C12), the install is the boot\'s first act (C13), the cautious heal is the trip\'s nights (C14)', () => {
  const af = rd('src/scenes/arrestFlow.js');
  assert.match(af, /playerEntity\.inPrison = false;\s*(?:\/\/[^\n]*\n\s*)*if \(!sharedClockOn\(\)\) fillVitalSigns\(playerEntity\);/, 'C9: the days are the refill\'s price, and online there are none');
  assert.equal((af.match(/if \(!sharedClockOn\(\)\) fillVitalSigns\(playerEntity\);/g) ?? []).length, 1, 'the sentence\'s refill alone is gated');
  assert.ok((af.match(/^\s*fillVitalSigns\(playerEntity\);/gm) ?? []).length >= 2, 'the rescue\'s and the acquittal\'s refills stand - neither costs a day offline either');
  assert.match(rd('src/scenes/exterior.js'), /questClocksStoodDown: \(\) => sharedClockOn\(\),/, 'C10');
  assert.match(rd('server/src/index.js'), /"now":\$\{Date\.now\(\)\}\}`;/, 'C11: not the hello\'s start, four awaits earlier');
  assert.equal(RELAY_VERSION, 'world66', 'C11: the relay bumped (WORLD6a and its audit bumped it again; WORLD6b for the cell)');
  assert.match(rd('src/ui/enhancedMenu.js'), /The clock and the sky are the world\\'s and run on real time: a rest, a trip, a sentence or a lesson takes none of it, and the quest clocks stand still\./, 'C12');
  const w = rd('src/scenes/world.js');
  const install = w.indexOf("if (params.has('online')) { setSharedClock(() => sharedClassicMinutes(Date.now() + _sharedOffsetMs), (m) => wallMsForClassicMinutes(m) - _sharedOffsetMs); setSharedWeather(true); }");
  const boot = w.indexOf('export async function bootWorld(');
  const season = w.indexOf('let season = seasonPin ?? climateSeasonFromMinutes(worldMinutes());');
  assert.ok(boot > 0 && install > boot && season > install, 'C13: installed before the first read of the clock (the season)');
  assert.ok(!w.slice(boot, install).split('\n').some((l) => !l.trim().startsWith('//') && l.includes('worldMinutes()')), 'C13: nothing between the boot\'s door and the install reads the clock');
  assert.match(w, /if \(opts\.speedCautious && !sharedClockOn\(\)\) \{/, 'C14');
  assert.match(rd('bible/06-Systems/Online-Arc.md'), /## AUDIT WORLD5 \(2026-09-13\)/, 'the record');
});
