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
//
// LIVED1 (2026-09-29, Mac: "We need a better system for time online instead of a band aid fix") re-aims the pins
// whose laws it retired, each in its own place: the claim is the character's and moves no world reading (C1), an
// arrival moves nothing of the character's (C3, C4), the collapse pays its hour in full (C6), the session hands its
// minutes alone (C7, C8), the sentence refills in both lanes (C9), the pane says the character's own time (C12), the
// cautious heal is the trip's nights online too (C14). What each held and still holds is kept beside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { relayVersionAtLeast } from '../relayVersion.mjs';
import { CLASSIC_GAME_START_TIME, MINUTES_PER_DAY } from '../../src/systems/gameDate.js';
import { worldMinutes, setWorldMinutes, setSharedClock, alignEntityClocks, resetMagicRoundMarker, tickPlayerMinutes, claimMagicRounds, ownMinutes, setOwnMinutes, advanceOwnMinutes } from '../../src/systems/worldTick.js';
import { setSharedWeather, resetWeatherSim, rollClimateWeathersForDay, weatherForClimate, ZONE_CLIMATES, tickWeather, currentWeatherEnum, weatherJumpStamp, evolveClimateWeathers, setWeatherEvolution, WEATHER_ENUM, setWeatherMapLaw } from '../../src/systems/weather/weatherSim.js';
import { RestSession, MINUTES_PER_TICK, REST_WAIT_PER_HOUR, LOITER_WAIT_PER_HOUR } from '../../src/systems/rest/restSession.js';
import { exhaustionOutcome } from '../../src/systems/rest/rest.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { liveVampirism } from '../../src/systems/racialLive.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const tickEntity = () => ({ chargenDone: true, skillUses: new Array(35).fill(0), stats: {}, skills: 30, activeEffects: [], lastSkillCheckTime: 0, fatigue: 3200, health: 50, maxHealth: 50 });
const sinks = () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, restoreFatigue() {}, say() {}, drainFatigue() {} });
const restDeps = (over = {}) => { const d = { minutes: 0, ends: [], vitals: 0, advanceMinutes(n, end) { d.minutes += n; d.ends.push(end); }, tickVitals() { d.vitals++; return false; }, enemiesNearby: () => false, fullyHealed: () => false, dead: () => false, ...over }; return d; };
const offline = () => { setSharedClock(null); resetMagicRoundMarker(); setWorldMinutes(CLASSIC_GAME_START_TIME); };

test('AUDIT WORLD5 C1 (LIVED1: the claim is the character\'s): the dungeon\'s rest arm claims its own window on the character\'s clock and the tick does not run it again - and no claim moves the world\'s reading, which is the world\'s', () => {
  let clock = CLASSIC_GAME_START_TIME + 3 * MINUTES_PER_DAY + 100;
  const entity = tickEntity();
  try {
    setSharedClock(() => clock);
    setOwnMinutes(clock); entity.lastGameMinutes = Math.floor(clock);
    alignEntityClocks(entity, worldMinutes());
    resetMagicRoundMarker(Math.floor(ownMinutes()));
    // the rest's sub-tick (dungeonContext _restAdvance): the character's clock takes ten minutes, the arm claims them
    const start = Math.floor(ownMinutes()); advanceOwnMinutes(10); const end = ownMinutes();
    assert.equal(claimMagicRounds(start, end).rounds, 10, 'the arm\'s own claim: the rested ten minutes');
    // the next frame's tick, a moment later
    clock += 0.2;
    const r = tickPlayerMinutes({ entity, classicMinutes: 0, dt: 0.016, sinks: sinks(), rolls: () => 0.5 });
    assert.equal(r.rounds, 0, 'the tick owes nothing the arm already ran');
    clock += 2;
    assert.equal(tickPlayerMinutes({ entity, classicMinutes: 0, dt: 0.016, sinks: sinks(), rolls: () => 0.5 }).rounds, 2, 'and the world\'s next two minutes are the character\'s two');
  } finally { offline(); }
  const wt = rd('src/systems/worldTick.js');
  assert.doesNotMatch(wt, /_sharedLastTick = nextFloor/, 'the broker counts the character\'s minutes and moves no world reading');
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
  assert.match(rd('src/systems/worldTick.js'), /if \(reading < worldFrom\) worldFrom = reading;/, 'the re-anchor');
  const w = rd('src/scenes/world.js');
  // LIVED1: the arrival re-anchors the world's reading and moves nothing of the character's, so a correction needs no shift of its own
  assert.match(w, /online\.onClock = \(offsetMs\) => \{ const was = _sharedOffsetMs; _sharedOffsetMs = offsetMs; (?:_sharedClockHeard = true; )?if \(Math\.abs\(offsetMs - was\) > 1000\) onlineArrival\(\); (?:hearSharedClock\(\); )?\};/, 'a correction over a second is an arrival');
  // TIME1: the arrival's season is the SKY's; the markers and the weather's roll stay the event clock's
  assert.match(w, /const onlineArrival = \(\) => \{ alignEntityClocks\(playerEntity, worldMinutes\(\)\); rollClimateWeathersForDay\(worldMinutes\(\)\); refreshSeason\(skyMinutes\(\)\); \};[^\n]*\s*onlineArrival\(\);/, 'the same arrival the session\'s start runs');
});

test('AUDIT WORLD5 C3 (LIVED1: an arrival moves nothing of the character\'s): every marker a save carries is on the character\'s own clock, which stood while they were away - so a room keeps its hours, a loan its week, a summoned item what it had left and a skill check that was due is due, by the markers standing where they were; a young world or an old one alike; a fresh character starts its day marker at its own clock', () => {
  const save = CLASSIC_GAME_START_TIME + 60 * MINUTES_PER_DAY + 500;   // the save's own clock: sixty days in
  const day = (m) => Math.floor(m / MINUTES_PER_DAY);
  const mk = () => ({
    ...tickEntity(), lastGameMinutes: save, lastSkillCheckTime: save - 100, timeOfLastSkillTraining: save - 2000, lastEnemyAlertTime: save - 30,
    timeForThievesGuildLetter: save + 700, timeForDarkBrotherhoodLetter: 0,
    activeEffects: [{ key: 'Disease-Plague', lastDay: day(save) }, { key: 'Poison-Nux', lastMinute: save - 5 }, null, { kind: 'racialOverride', racial: 'vampirism', lastTimeFed: save - 60 }],
    bankAccounts: [{ regionIndex: 0, loanTotal: 500, loanDueDate: save + 5000 }, { regionIndex: 1, loanTotal: 0, loanDueDate: 0 }],
    rentedRooms: [{ expiryMinutes: save + 1200 }],
    items: [{ timeForItemToDisappear: save + 30 }, { timeForItemToDisappear: 0 }],
    // MAC-BUG3: a REPAIR JOB is a deadline like the loan and the room - on the character's clock, it is simply in tune
    otherItems: [
      { name: 'Steel Cuirass', currentCondition: 1843, maxCondition: 6144, repairData: { buildingKey: 4242, timeStarted: save - 200, repairTime: 4 * MINUTES_PER_DAY } },
      { name: 'not in repair', repairData: { buildingKey: 0, timeStarted: 0, repairTime: 0 } },
    ],
    wagonItems: [{ timeForItemToDisappear: save + 90 }],
    guildMemberships: { mortal: { FightersGuild: { guild: 'Fighters', rank: 1, lastRankChange: day(save) - 3 } }, vampire: {} },
  });
  for (const [label, now] of [['a young world, the save far ahead of it', save - 30 * MINUTES_PER_DAY], ['an old world, the save far behind it', save + 375 * MINUTES_PER_DAY + 17]]) {
    const e = mk();
    const before = JSON.parse(JSON.stringify(e));
    try {
      setSharedClock(() => now);
      setOwnMinutes(save);   // the load restores the character's clock (save.js)
      assert.equal(alignEntityClocks(e, worldMinutes(), { worldLeft: save }), true, label);
      assert.deepEqual(JSON.parse(JSON.stringify(e)), before, `${label}: nothing of the character's moved - every marker, every collection`);
      assert.equal(ownMinutes(), save, `${label}: the character's clock stands where the save left it`);
      assert.equal(e.rentedRooms[0].expiryMinutes - ownMinutes(), 1200, 'the room keeps its twenty hours');
      assert.equal(e.bankAccounts[0].loanDueDate - ownMinutes(), 5000, 'the loan is due when it was due');
      assert.equal((e.otherItems[0].repairData.timeStarted + e.otherItems[0].repairData.repairTime) - ownMinutes(), 4 * MINUTES_PER_DAY - 200, 'the armour at the smith keeps its place in the queue');
      assert.equal(ownMinutes() - e.lastSkillCheckTime, 100, 'the skill check is a hundred minutes old on the character\'s clock, a young world or an old');
      assert.equal(day(ownMinutes()) - e.guildMemberships.mortal.FightersGuild.lastRankChange, 3, 'the rank changed three of the character\'s days ago');
    } finally { offline(); }
  }
  // a fresh character: no day marker - it starts at the character's own clock, and nothing else is touched
  const fresh = { ...tickEntity(), lastGameMinutes: undefined, lastSkillCheckTime: 0, rentedRooms: [{ expiryMinutes: 99 }] };
  try { setSharedClock(() => save); alignEntityClocks(fresh, worldMinutes()); assert.equal(fresh.lastSkillCheckTime, 0); assert.equal(fresh.rentedRooms[0].expiryMinutes, 99); assert.equal(fresh.lastGameMinutes, save); } finally { offline(); }
  assert.equal(liveVampirism({ activeEffects: [null, { kind: 'racialOverride', racial: 'vampirism' }] })?.racial, 'vampirism', 'the accessor steps over a hole');
  assert.doesNotMatch(rd('src/systems/worldTick.js'), /function (?:spanShifts|carryOwnEffectClocks)\(/, 'the shift and its walk are gone - no list of markers to forget');
});

test('AUDIT WORLD5 C4 (LIVED1): a LOAD under the shared clock is an arrival through save.js\'s one door - the character\'s clock restored from the save and nothing of theirs shifted, and the day\'s sky rolled from the shared day over the sky the save carried', () => {
  resetWeatherSim(); setWeatherMapLaw(false);   // WEATHER3b: the day-roll machine's pin - on the map's lane the map is the sky and this machine stands down (weather3b pins that)
  const saved = CLASSIC_GAME_START_TIME + 2 * MINUTES_PER_DAY;
  // a date whose shared roll is not sunny for the desert, so the drain is visible
  let now = CLASSIC_GAME_START_TIME + 40 * MINUTES_PER_DAY + 720;
  try {
    setSharedClock(() => now); setSharedWeather(true);
    for (let i = 0; i < 60; i++) { rollClimateWeathersForDay(now); if (weatherForClimate(ZONE_CLIMATES[0]) !== WEATHER_ENUM.sunny) break; now += MINUTES_PER_DAY; }
    resetWeatherSim(); setWeatherMapLaw(false); setSharedWeather(true);
    const live = { items: [], stats: {}, skills: 30, activeEffects: [], lastSkillCheckTime: saved - 100, rentedRooms: [{ expiryMinutes: saved + 600 }] };
    const snap = JSON.parse(JSON.stringify(snapshotPlayer(live, { classicMinutes: saved })));
    snap.weather = 'snow';
    const fresh = { items: [], stats: {} };
    const extras = restorePlayer(fresh, snap);
    assert.equal(extras.classicMinutes, saved, 'the save\'s clock rides out as it always did (and the host\'s write of it is refused)');
    assert.equal(ownMinutes(), saved, 'LIVED1: the save\'s clock is the character\'s own, restored as it stood');
    assert.equal(snap.worldMinutes, Math.floor(now), 'and an online save carries the world\'s minute it left at beside it');
    assert.equal(fresh.lastGameMinutes, saved, 'the day marker is the character\'s, not the world\'s');
    assert.equal(fresh.lastSkillCheckTime, saved - 100, 'not shifted: the character\'s clock stood while they were away');
    assert.equal(fresh.rentedRooms[0].expiryMinutes, saved + 600, 'the room keeps its ten hours of the character\'s time');
    assert.equal(currentWeatherEnum(), WEATHER_ENUM.snow, 'the saved sky stands until the first exterior frame drains the day\'s array');
    assert.equal(tickWeather(now, ZONE_CLIMATES[0]), true, 'and that frame applies the shared day\'s roll over it');
    assert.equal(currentWeatherEnum(), weatherForClimate(ZONE_CLIMATES[0]));
    assert.notEqual(currentWeatherEnum(), WEATHER_ENUM.snow);
  } finally { offline(); resetWeatherSim(); setWeatherMapLaw(false); }
  assert.match(rd('src/systems/save/save.js'), /resetMagicRoundMarker\(Math\.floor\(snap\.classicMinutes \?\? 0\)\);\s*(?:\/\/[^\n]*\n\s*)*if \(sharedClockOn\(\)\) \{\s*(?:\/\/[^\n]*\n\s*)*const own = Math\.floor\(snap\.classicMinutes \?\? 0\), at = worldMinutes\(\);\s*(?:\/\/[^\n]*\n\s*)*const left = [^\n]*\n\s*setOwnMinutes\(own\);\s*if \(!Number\.isFinite\(snap\.worldMinutes\)\) clampMarkersAheadOf\(entity, own\);[^\n]*\n\s*alignEntityClocks\(entity, at\);\s*rollClimateWeathersForDay\(Math\.floor\(at\)\);/, 'the one door every host loads through (AUDIT LIVED1b F1: at the unfloored reading; P4: its absence paid once the relay\'s clock is heard)');
});

test('AUDIT WORLD5 C5: the shared roll is THE DAY\'S - stamped at the day\'s first minute, so a joiner\'s drain at noon is a jump and a midnight roll\'s is a front; and the evolution replays from the day\'s first hour, so a client that joined at noon carries the sky the one that stood under it since midnight does', () => {
  const dayStart = CLASSIC_GAME_START_TIME - (CLASSIC_GAME_START_TIME % MINUTES_PER_DAY) + 20 * MINUTES_PER_DAY;
  // the stamp: noon is a jump, midnight a front
  resetWeatherSim(); setWeatherMapLaw(false); setSharedWeather(true);   // WEATHER3b: the day-roll machine's pin - on the map's lane the map is the sky and this machine stands down (weather3b pins that)
  let now = dayStart + 720;
  for (let i = 0; i < 60 && weatherForClimate(ZONE_CLIMATES[1]) === WEATHER_ENUM.sunny; i++) { now += MINUTES_PER_DAY; rollClimateWeathersForDay(now); }
  const before = weatherJumpStamp();
  assert.equal(tickWeather(now, ZONE_CLIMATES[1]), true);
  assert.equal(weatherJumpStamp(), before + 1, 'a noon roll drained at noon: the sky changed hours ago, the player arrived under it');
  resetWeatherSim(); setWeatherMapLaw(false); setSharedWeather(true);
  rollClimateWeathersForDay(now - 720 + 5);
  const b2 = weatherJumpStamp();
  tickWeather(now - 720 + 5, ZONE_CLIMATES[1]);
  assert.equal(weatherJumpStamp(), b2, 'the same day rolled five minutes past midnight and drained then: a front');
  // the replay: one client from midnight hour by hour, another joining at 15:00 - one sky
  const arr = () => ZONE_CLIMATES.map((c) => weatherForClimate(c));
  resetWeatherSim(); setWeatherMapLaw(false); setSharedWeather(true); setWeatherEvolution(true);
  rollClimateWeathersForDay(dayStart);
  for (let h = 0; h <= 15; h++) evolveClimateWeathers(dayStart + h * 60 + 7);
  const sinceMidnight = arr();
  resetWeatherSim(); setWeatherMapLaw(false); setSharedWeather(true); setWeatherEvolution(true);
  rollClimateWeathersForDay(dayStart + 15 * 60 + 7);
  evolveClimateWeathers(dayStart + 15 * 60 + 7);
  assert.deepEqual(arr(), sinceMidnight, 'the joiner replayed every hour of the day');
  // offline the stamp is the roll's own minute and the evolution re-anchors without rolling, as CLK2 left it
  resetWeatherSim(); setWeatherMapLaw(false); setWeatherEvolution(true);
  rollClimateWeathersForDay(dayStart + 15 * 60, () => 0.5);
  const off = arr();
  evolveClimateWeathers(dayStart + 15 * 60);
  assert.deepEqual(arr(), off, 'offline: no replay');
  resetWeatherSim(); setWeatherMapLaw(false);
  assert.match(rd('src/systems/weather/weatherSim.js'), /_rolledAtMinutes = stampRoll\(nowMinutes\);/g);
  assert.equal((rd('src/systems/weather/weatherSim.js').match(/_rolledAtMinutes = stampRoll\(nowMinutes\);/g) ?? []).length, 2, 'the day roll and the boot\'s lazy roll');
});

test('AUDIT WORLD5 C6 (LIVED1): every collapse costs its hour and pays it in full, online as offline - the host\'s RaiseTime moves the character\'s own clock, so the hour is charged; the fatal arms untouched', () => {
  const P = () => ({ isPlayer: true, level: 5, maxHealth: 50, maxMagicka: 40, fatigue: 0, stats: { strength: 50, endurance: 50, willpower: 50 }, skills: 30, career: {} });
  const clock = CLASSIC_GAME_START_TIME + 7 * MINUTES_PER_DAY + 30;
  const e = P();
  try {
    setSharedClock(() => clock);
    const first = exhaustionOutcome({ entity: e });
    assert.ok(first.kind === 'rest' && first.health > 0 && first.magicka > 0 && first.fatigue > 0, 'a collapse pays');
    const again = exhaustionOutcome({ entity: e });
    assert.deepEqual([again.kind, again.health, again.magicka], [first.kind, first.health, first.magicka], 'the same world hour: the second collapse pays in full too - its hour is the character\'s, charged');
  } finally { offline(); }
  const o = P();
  assert.ok(exhaustionOutcome({ entity: o }).health > 0 && exhaustionOutcome({ entity: o }).health > 0, 'offline: every collapse, in full');
  // PIN MOVED (FIELD BUGS 2026-10-13e SPENT-ASHORE): the foes-about arm is no longer DFU's death but a tenth of the
  // health - still no hour paid there, which is what this line holds
  assert.deepEqual(exhaustionOutcome({ entity: P(), enemiesNearby: true }).kind, 'spent', 'the foes-about arm untouched by the hour');
  assert.doesNotMatch(rd('src/systems/rest/rest.js'), /lastExhaustionHour/, 'no once-a-world-hour gate');
});
test('AUDIT WORLD5 C7 (RESTX2: on the timer, every mode): a session COVERED loses the real time it covers, keeping less than one sub-tick, and a leap of the shared clock (a hidden tab) is NOT a leap of the session - the timer alone paces it, so every hourly check reads a frame of its own by construction', () => {
  // C7 was written on the shared clock (one sub-tick a FRAME across a
  // leap); RESTX1 narrowed it to loiter; RESTX2 (2026-09-17) retired
  // the shared-clock pacing whole - test/systems/rest/restx2_online_rest.test.js.
  // What C7 held and still holds: a covered frame banks nothing, the
  // remainder under one sub-tick is kept, and a foe wandering in is
  // seen on the hour it arrives.
  let clock = 8000;
  let covered = false;
  const d = restDeps({ sharedMinutes: () => clock });
  const s = new RestSession('loiter', 9, d, -1, () => !covered);
  const sub = LOITER_WAIT_PER_HOUR / MINUTES_PER_TICK;
  s.tick(sub);
  assert.equal(d.minutes, 10, 'one sub-tick');
  covered = true;
  clock += 605;
  assert.equal(s.tick(sub * 60), null, 'covered: nothing - sixty sub-ticks of real time under a cover bank nothing');
  covered = false;
  s.tick(0.001);
  assert.equal(d.minutes, 10, 'uncovered: the covered hour is LOST, not banked');
  s.tick(sub);
  assert.equal(d.minutes, 20, 'the remainder under one sub-tick was kept, as the timer keeps its fraction');
  assert.deepEqual(d.ends, [undefined, undefined], 'LIVED1: the session hands the host its minutes alone - the host\'s clock is the character\'s, and the world\'s 605-minute leap is not in them');
  // the hidden tab: the clock leapt three hours; the session owes nothing for it
  let foes = false;
  const d2 = restDeps({ sharedMinutes: () => clock, enemiesNearby: () => foes });
  const s2 = new RestSession('loiter', 9, d2);
  clock += 180;
  assert.equal(s2.tick(0.016), null);
  assert.equal(d2.minutes, 0, 'three hours of the world\'s clock: not one sub-tick of the session');
  let result = null, frames = 0;
  for (let f = 0; f < 40 && !result; f++) { if (f === 3) foes = true; result = s2.tick(sub); frames++; }
  assert.equal(frames, 6, 'six sub-ticks of the timer: the first hour, and its check');
  assert.equal(d2.minutes, 60);
  assert.equal(result?.enemyBroke, true, 'the first hour\'s check saw the foe and broke the rest');
});

test('AUDIT WORLD5 C8 (LIVED1): the sub-tick\'s minutes ride to the host alone, online as offline, and the dungeon\'s rest arm reads its spawn window and its broker window off the character\'s own clock, which it moves', () => {
  const clock = 5000.4;
  const d = restDeps({ sharedMinutes: () => clock });
  const s = new RestSession('timed', 2, d);
  const sub = REST_WAIT_PER_HOUR / MINUTES_PER_TICK;
  s.tick(sub); s.tick(sub);
  assert.deepEqual([d.minutes, d.ends], [20, [undefined, undefined]], 'two sub-ticks, ten minutes each, no session counter handed over');
  const off = restDeps();
  const so = new RestSession('timed', 2, off);
  so.tick(sub);
  assert.deepEqual([off.minutes, off.ends], [10, [undefined]], 'offline the same');
  assert.match(rd('src/systems/rest/restSession.js'), /this\.deps\.advanceMinutes\(MINUTES_PER_TICK\);/);
  const dc = rd('src/scenes/dungeonContext.js');
  const i = dc.indexOf('const _restAdvance = (n) => {');
  const arm = dc.slice(i, dc.indexOf('\n  };', i));
  assert.ok(i > 0 && arm.length > 200);
  assert.ok(arm.includes('const end = classicMinutesRef.value + n;') && arm.includes('const start = Math.floor(end) - n;') && arm.includes('advanceOwnMinutes(n);'), 'the span off the character\'s clock, which the arm moves (TIME3: a raise, counted)');
  assert.ok(arm.includes('const _w = claimMagicRounds(start, end);'), 'the broker window off the same span');
  assert.ok(arm.includes('gameMinutes: start + l + 1,'), 'and the spawner offered each of its ten minutes once');
  assert.match(dc, /advanceMinutes: \(n\) => _restAdvance\(n\),/);
  assert.match(dc, /const classicMinutesRef = \{\s*get value\(\) \{ return ownMinutes\(\); \},\s*set value\(v\) \{ setOwnMinutes\(v\); \},\s*\};/, 'the dungeon\'s one clock view is the character\'s');
});
test('AUDIT WORLD5 by source: the sentence refills in both lanes (C9; LIVED1: its days are served on the prisoner\'s own clock), exterior.js says the stand-down (C10), the welcome\'s clock is stamped as it is built and the relay says which one it is (C11), the pane says the clock (C12), the install is the boot\'s first act (C13), the cautious heal is the trip\'s nights (C14)', () => {
  const af = rd('src/scenes/arrestFlow.js');
  assert.match(af, /playerEntity\.inPrison = false;\s*(?:\/\/[^\n]*\n\s*)*fillVitalSigns\(playerEntity\);/, 'C9 (LIVED1): the days are the refill\'s price, and online they are served on the prisoner\'s own clock');
  assert.doesNotMatch(af, /sharedClockOn/, 'the sentence is gated on nothing - it is served in both lanes');
  assert.ok((af.match(/^\s*fillVitalSigns\(playerEntity\);/gm) ?? []).length >= 3, 'the sentence\'s, the rescue\'s and the acquittal\'s refills');
  assert.match(af, /advanceDays = \(days\) => advanceOwnMinutes\(days \* MINUTES_PER_DAY\),/, 'the days are the prisoner\'s own');
  assert.match(rd('src/scenes/exterior.js'), /questClockStepMax: \(\) => \(sharedClockOn\(\) \? PLAYED_STEP_MAX_SECONDS : Infinity\),/, 'C10 (WORLD7\'s word: the same as world.js\'s)');
  // SRV-N appended `v` after it, so the stamp is no longer the last field.
  // What C11 is about is unchanged and is what is matched: Date.now() is
  // CALLED where the welcome is built, not read from a variable set when
  // the hello began - four storage awaits earlier, every millisecond of
  // which the client carried as the relay's clock.
  assert.match(rd('server/src/index.js'), /"now":\$\{Date\.now\(\)\},"v":/, 'C11: not the hello\'s start, four awaits earlier');
  assert.ok(relayVersionAtLeast(66), 'C11: the relay bumped, and has not gone backwards since (SRV-N: asked monotonically - five pins used to retype one moving number)');
  // DISC25-D: the last clause ("the quest clocks stand still") had been false since WORLD7 - they count played time
  assert.match(rd('src/ui/enhanced/enhancedMenu.js'), /The world\\u2019s clock and sky run on real time\. Resting, travel, jail and training don\\u2019t move them, so a quest waiting for a time of day waits for the world\\u2019s, and a lycanthrope\\u2019s full moon lasts one night\. Your character also has their own clock\. It runs while you play and stops while you are logged off\. Resting, travel, jail and training use it\./, 'C12 (LIVED1: and the character\'s own time; AUDIT LIVED1b U8: logged off, not away; TIME2: the full moon\'s night)');
  const w = rd('src/scenes/world.js');
  const install = w.indexOf("if (params.has('online')) { setSharedClock(() => sharedClassicMinutes(Date.now() + _sharedOffsetMs), (m) => wallMsForClassicMinutes(m) - _sharedOffsetMs, { sky: () => skyClassicMinutes(Date.now() + _sharedOffsetMs), skyWall: (m) => wallMsForSkyMinutes(m) - _sharedOffsetMs }); setSharedWeather(true); }");   // TIME1: and the sky beside it
  const boot = w.indexOf('export async function bootWorld(');
  const season = w.indexOf('let season = seasonPin ?? climateSeasonFromMinutes(skyMinutes());');   // TIME1: the sky's season
  assert.ok(boot > 0 && install > boot && season > install, 'C13: installed before the first read of the clock (the season)');
  assert.ok(!w.slice(boot, install).split('\n').some((l) => !l.trim().startsWith('//') && l.includes('worldMinutes()')), 'C13: nothing between the boot\'s door and the install reads the clock');
  assert.match(w, /if \(opts\.speedCautious\) \{/, 'C14 (LIVED1): the heal is the trip\'s nights, and online they are the character\'s own');
  assert.match(w, /setSyntheticTimeIncrease\(true\); playerTicker\.advance\(computed\.minutes\);/, 'and the trip\'s days are advanced online too');
  assert.match(rd('bible/06-Systems/Online-Arc.md'), /## AUDIT WORLD5 \(2026-09-13\)/, 'the record');
});
