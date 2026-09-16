// WORLD5 (Mac, 2026-09-13: "Let's tackle slice 5 first") - SLICE 5: THE
// SHARED CLOCK AND WEATHER, AND THE QUEST CLOCKS STOOD DOWN. Online the
// world's time is nobody's to keep: it is a FUNCTION OF WALL TIME (the wire's
// own law, one home at both ends), the same on every client with no frame to
// carry it and no host to hand it over; the relay's welcome says its own
// clock so a machine whose clock is off reads the world's through the
// offset. Nothing local moves it: a rest is paced by it (an hour of rest is
// an hour of the world's, five real minutes at TimeScale 12), a fast travel
// takes no world time, the exhaustion collapse and a training session
// fabricate none, ?tod and ?timescale stand down. The day's six-zone weather
// rolls from a seed the day picks, so every client under one date rolls one
// sky. Every quest clock charges nothing while online, and the hours it stood
// down are never charged when it stands up. THE LAW EXECUTES: the wire's
// constants against the calendar's and the ticker's; the relay's welcome and
// the session's offset; the ticker under the shared clock (a read-only source,
// every write refused, the rounds owed between two readings and not one
// minute fabricated from dt); the markers aligned at the online boot; the
// weather's shared roll; the rest session paced by the clock; the quest clock
// stood down; and the hosts by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ONLINE_EPOCH_MS, ONLINE_EPOCH_MINUTES, ONLINE_MINUTES_PER_MS, sharedClassicMinutes, PIXEL_UNITS } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import { RELAY_VERSION } from '../server/src/index.js';
import { OnlineSession } from '../src/net/online.js';
import { CLASSIC_GAME_START_TIME, MINUTES_PER_DAY } from '../src/systems/gameDate.js';
import { CLASSIC_MINUTES_PER_SECOND, worldMinutes, setWorldMinutes, advanceWorldMinutes, setSharedClock, sharedClockOn, alignEntityClocks, resetMagicRoundMarker, tickPlayerMinutes } from '../src/systems/worldTick.js';
import { createPlayerTicker } from '../src/scenes/shared.js';
import { setSharedWeather, sharedWeatherOn, resetWeatherSim, rollClimateWeathersForDay, weatherForClimate, ZONE_CLIMATES, tickWeather, weatherRespawn, currentWeatherEnum } from '../src/systems/weatherSim.js';
import { RestSession, MINUTES_PER_TICK, REST_WAIT_PER_HOUR } from '../src/systems/restSession.js';
import { Clock } from '../src/systems/quest/clock.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const quiet = (fn) => { const info = console.info; console.info = () => {}; try { return fn(); } finally { console.info = info; } };
const tickEntity = () => ({ chargenDone: true, skillUses: new Array(35).fill(0), stats: {}, skills: 30, activeEffects: [], lastSkillCheckTime: 0, fatigue: 3200, health: 50, maxHealth: 50 });
const sinks = () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, restoreFatigue() {}, say() {}, drainFatigue() {} });

test('WORLD5: the wire\'s clock law - the epoch is the classic game start on 2026-09-14T00:00Z, the rate is DFU\'s TimeScale 12, and both are the calendar\'s and the ticker\'s own numbers, at both ends', () => {
  assert.equal(ONLINE_EPOCH_MS, Date.UTC(2026, 8, 14, 0, 0, 0));
  assert.equal(ONLINE_EPOCH_MINUTES, CLASSIC_GAME_START_TIME, 'the world stood at 13:30, 4 Morning Star 3E405 at the epoch');
  assert.equal(ONLINE_MINUTES_PER_MS, CLASSIC_MINUTES_PER_SECOND / 1000, 'one rate, the ticker\'s');
  assert.equal(sharedClassicMinutes(ONLINE_EPOCH_MS), CLASSIC_GAME_START_TIME);
  assert.equal(sharedClassicMinutes(ONLINE_EPOCH_MS + 5000), CLASSIC_GAME_START_TIME + 1, 'a game minute every five real seconds');
  assert.equal(sharedClassicMinutes(ONLINE_EPOCH_MS + 2 * 3600 * 1000), CLASSIC_GAME_START_TIME + MINUTES_PER_DAY, 'a day every two real hours');
  assert.equal(sharedClassicMinutes(ONLINE_EPOCH_MS - 5000), CLASSIC_GAME_START_TIME - 1, 'and a clock before the epoch reads before the start, never wraps');
  for (const k of ['ONLINE_EPOCH_MS', 'ONLINE_EPOCH_MINUTES', 'ONLINE_MINUTES_PER_MS', 'sharedClassicMinutes']) assert.equal(relay[k], { ONLINE_EPOCH_MS, ONLINE_EPOCH_MINUTES, ONLINE_MINUTES_PER_MS, sharedClassicMinutes }[k], `${k} at both ends`);
  assert.equal(RELAY_VERSION, 'world73', 'the relay says which one it is (AUDIT WORLD5 bumped it for the welcome\'s clock; WORLD6a and its audit for the law; WORLD6b for the cell)');
});

test('WORLD5: the relay\'s welcome carries its clock (`now`, ms) in every place room and no channel; the session reads its offset from it, says so, and refuses a clock a year off', async () => {
  const r = fakeRoom('dungeon:m187853213');
  const a = r.connect();
  const before = Date.now();
  await r.hello(a, 'aaaa-0001', at(1, 1));
  const w = a.sent.find((m) => m.t === 'welcome');
  assert.ok(Number.isFinite(w.now) && w.now >= before && w.now <= Date.now(), 'the relay\'s own clock, ms');
  const town = fakeRoom('world:3,12'); const t = town.connect(); await town.hello(t, 'tttt-0001', at(1, 1));
  assert.ok(Number.isFinite(town.sockets[0].sent[0].now), 'a cell too - the clock is the world\'s, not a dungeon\'s');
  const chat = fakeRoom('chat:world'); const c = chat.connect(); await chat.hello(c, 'cccc-0001');
  assert.deepEqual(c.sent[0], { t: 'welcome', id: 'cccc-0001', v: RELAY_VERSION, peers: [] }, 'a channel\'s welcome is what it was, plus the version SLAM13 put on every welcome');
  // the session
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => 1000 });
  const heard = []; s.onClock = (o) => heard.push(o);
  quiet(() => s.join('dungeon:m187853213', at(1, 1))); sockets[0].open();
  quiet(() => sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, now: Date.now() + 5000 }));
  assert.ok(Math.abs(s.clockOffsetMs - 5000) < 100, 'the relay runs five seconds ahead of this machine');
  assert.equal(heard.length, 1); assert.ok(Math.abs(heard[0] - 5000) < 100);
  quiet(() => sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, now: Date.now() + 400 * 24 * 3600 * 1000 }));
  assert.ok(Math.abs(s.clockOffsetMs - 5000) < 100, 'a year off is no clock: the offset stands');
  quiet(() => sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null }));
  assert.equal(heard.length, 1, 'a welcome with no clock says nothing');
});

test('WORLD5: the ticker under the shared clock - worldMinutes reads the source, every write is refused, the tick claims the rounds the clock owes between two readings and fabricates none from dt, and a jump runs the owed rounds and moves nothing', () => {
  let t = 1000;
  try {
    setSharedClock(() => t);
    assert.equal(sharedClockOn(), true);
    assert.equal(worldMinutes(), 1000);
    assert.equal(setWorldMinutes(5), 1000, 'a load\'s clock cannot stand'); assert.equal(worldMinutes(), 1000);
    assert.equal(advanceWorldMinutes(60), 1000, 'a sentence cannot jump it'); assert.equal(worldMinutes(), 1000);
    resetMagicRoundMarker(1000);
    const entity = tickEntity();
    let r = tickPlayerMinutes({ entity, classicMinutes: 0, dt: 5, sinks: sinks(), rolls: () => 0.5 });
    assert.equal(r.rounds, 0, 'the clock has not moved: nothing owed, and five real seconds fabricate no minute');
    assert.equal(r.classicMinutes, 1000);
    t = 1003;
    r = tickPlayerMinutes({ entity, classicMinutes: 0, dt: 0.016, sinks: sinks(), rolls: () => 0.5 });
    assert.equal(r.rounds, 3, 'three minutes passed in the world: three rounds, whatever the frame\'s dt');
    assert.equal(r.classicMinutes, 1003);
    r = tickPlayerMinutes({ entity, classicMinutes: 0, dt: 3000, sinks: sinks(), rolls: () => 0.5 });
    assert.equal(r.rounds, 0, 'a frame of 3000 real seconds owes nothing the clock did not move');
    // the ticker's jump: RaiseTime is refused, the owed rounds run
    const ticker = createPlayerTicker(entity, {});
    t = 1010;
    const j = ticker.advance(480);
    assert.equal(j.rounds, 7, 'the seven minutes the clock moved since the last reading, not the eight hours asked for');
    assert.equal(worldMinutes(), 1010, 'and the clock stands where the world has it');
    assert.equal(ticker.classicMinutes, 1010);
  } finally { setSharedClock(null); }
  assert.equal(sharedClockOn(), false);
  setWorldMinutes(7); assert.equal(worldMinutes(), 7, 'offline the clock is the player\'s own again');
  setWorldMinutes(CLASSIC_GAME_START_TIME);
});

test('WORLD5: the markers aligned at the online boot - the day marker, the broker\'s, every disease\'s day and every poison\'s minute set to the world\'s time, so a save a month behind catches up nothing and one a year ahead reads no negative day', () => {
  const now = CLASSIC_GAME_START_TIME + 40 * MINUTES_PER_DAY + 17;
  const entity = { ...tickEntity(), lastGameMinutes: 12, activeEffects: [{ key: 'Disease-Plague', lastDay: 3 }, { key: 'Poison-Nux', lastMinute: 99 }, { key: 'Spell', rounds: 5 }, null] };
  try {
    setSharedClock(() => now);
    assert.equal(alignEntityClocks(entity, worldMinutes()), true);
    assert.equal(entity.lastGameMinutes, Math.floor(now));
    assert.equal(entity.activeEffects[0].lastDay, Math.floor(now / MINUTES_PER_DAY));
    assert.equal(entity.activeEffects[1].lastMinute, Math.floor(now));
    assert.deepEqual(entity.activeEffects[2], { key: 'Spell', rounds: 5 }, 'an effect with no day or minute marker is untouched');
    const r = tickPlayerMinutes({ entity, classicMinutes: 0, dt: 5, sinks: sinks(), rolls: () => 0.5 });
    assert.equal(r.rounds, 0, 'the first online frame owes nothing');
  } finally { setSharedClock(null); }
  assert.equal(alignEntityClocks(null, 5), false); assert.equal(alignEntityClocks(entity, NaN), false);
  setWorldMinutes(CLASSIC_GAME_START_TIME);
});

test('WORLD5: the shared weather - two clients under one date roll one sky (the day change\'s roll, the boot\'s, a respawn\'s), another date may roll another, and offline the roll is the caller\'s own again', () => {
  const day = (n) => CLASSIC_GAME_START_TIME + n * MINUTES_PER_DAY;
  const arrayOn = (fn) => { resetWeatherSim(); setSharedWeather(true); fn(); return ZONE_CLIMATES.map((c) => weatherForClimate(c)); };
  const a = arrayOn(() => rollClimateWeathersForDay(day(10)));
  const b = arrayOn(() => rollClimateWeathersForDay(day(10), () => 0.999));
  assert.deepEqual(a, b, 'the same date, the same six values, whatever generator the caller handed in');
  const c = arrayOn(() => tickWeather(day(10), ZONE_CLIMATES[1]));
  assert.deepEqual(c, a, 'the boot\'s lazy roll is the same day\'s roll');
  const seen = new Set();
  for (let n = 0; n < 40; n++) seen.add(arrayOn(() => rollClimateWeathersForDay(day(n))).join(','));
  assert.ok(seen.size > 1, 'the days differ from one another');
  // a respawn's re-roll is the day's and the climate's
  resetWeatherSim(); setSharedWeather(true);
  const r1 = (() => { weatherRespawn(day(3), ZONE_CLIMATES[0]); return currentWeatherEnum(); })();
  resetWeatherSim(); setSharedWeather(true);
  const r2 = (() => { weatherRespawn(day(3), ZONE_CLIMATES[0]); return currentWeatherEnum(); })();
  assert.equal(r1, r2);
  // offline: the caller's generator decides, as it always did
  resetWeatherSim();
  assert.equal(sharedWeatherOn(), false, 'the reset forgets the flag');
  rollClimateWeathersForDay(day(10), () => 0.999);
  const off = ZONE_CLIMATES.map((c) => weatherForClimate(c));
  resetWeatherSim(); rollClimateWeathersForDay(day(10), () => 0.001);
  assert.notDeepEqual(off, ZONE_CLIMATES.map((c) => weatherForClimate(c)), 'offline two generators roll two skies');
  resetWeatherSim();
});

test('WORLD5 (RESTX1: on LOITER): a session online is paced by the world\'s clock - no sub-tick until the clock has moved MINUTES_PER_TICK, an hour is sixty of the world\'s minutes, and the window\'s own timer is not consulted; offline the timer law is what it was', () => {
  // RESTX1 (2026-09-15) NARROWED THIS PIN'S SUBJECT, not its law. It was
  // written on a TIMED rest, because when WORLD5 landed every mode rode
  // the shared clock. Mac's call ("for online I want to change the rest
  // mechanic to not use any time") took the REST modes off it: online a
  // rest resolves at once and passes no minutes, since none were ever
  // available to pass. LOITER still rides the clock - passing time is
  // the whole of what loiter is for - so every reading below is still
  // exactly the world's own pacing. The rest half's new law is
  // test/restx1_online_rest.test.js; the OFFLINE half at the foot is
  // still a timed rest, because offline nothing changed at all.
  const deps = (over = {}) => { const d = { minutes: 0, vitals: 0, advanceMinutes(n) { d.minutes += n; }, tickVitals() { d.vitals++; return false; }, enemiesNearby: () => false, fullyHealed: () => false, dead: () => false, ...over }; return d; };
  let clock = 5000;
  const d = deps({ sharedMinutes: () => clock });
  const s = new RestSession('loiter', 3, d);
  assert.equal(s.tick(100), null, 'a hundred real seconds with the clock still: nothing');
  assert.deepEqual([d.minutes, d.vitals, s.totalHours], [0, 0, 0]);
  clock += MINUTES_PER_TICK - 1;
  s.tick(0.016); assert.equal(d.minutes, 0, 'nine minutes: not yet a sub-tick');
  clock += 1;
  s.tick(0.016); assert.equal(d.minutes, MINUTES_PER_TICK, 'ten: one sub-tick, the owed rounds asked of the host');
  clock += 50;
  for (let f = 0; f < 5; f++) s.tick(0.016);   // AUDIT WORLD5 C7: one sub-tick a frame, as the timer's clamped dt gives offline
  assert.deepEqual([d.minutes, d.vitals, s.totalHours], [60, 0, 1], 'sixty of the world\'s minutes: one hour counted (a loiter recovers nothing, which is its own law)');
  clock += 120;
  for (let f = 0; f < 12; f++) s.tick(0.016);
  assert.equal(s.totalHours, 3, 'the clock leapt two hours (the tab was hidden): both counted, a sub-tick a frame');
  // offline: the timer
  const e = deps();
  const off = new RestSession('timed', 2, e);
  const sub = REST_WAIT_PER_HOUR / MINUTES_PER_TICK;   // the timer's sub-tick, real seconds
  off.tick(sub * 5.5); assert.equal(e.minutes, 50, 'five sub-ticks of the timer: not an hour yet');
  off.tick(sub); assert.ok(e.minutes === 60 && off.totalHours === 1, 'the timer\'s hour');
});

test('WORLD5 (superseded by WORLD7): the stand-down is gone - a quest clock charges played time online, the time away forgiven; a quest with no seam charges as ever', () => {
  let now = 100_000, step = Infinity;
  const quest = { rolls: () => 0.5, nowSeconds: () => now, questClockStepMax: () => step, resources: new Map(), getPlace: () => null, travelSecondsTo: () => null };
  const clock = new Clock(quest, 'Clock _c_ 02:00');
  assert.equal(clock.startingTimeInSeconds, 7200);
  clock.startTimer();
  now += 600; clock.tick(quest);
  assert.equal(clock.remainingTimeInSeconds, 6600, 'offline: ten minutes charged');
  step = 1800;
  now += 36_000; clock.tick(quest);
  assert.equal(clock.remainingTimeInSeconds, 4800, 'ten hours away online: one played step charged, the rest forgiven (WORLD7)');
  assert.equal(clock.clockFinished, false);
  now += 60; clock.tick(quest);
  assert.equal(clock.remainingTimeInSeconds, 4740, 'a played minute charges a minute');
  const never = new Clock({ rolls: () => 0.5, nowSeconds: () => now, resources: new Map() }, 'Clock _d_ 01:00');
  never.startTimer(); now += 60; never.tick(never.parentQuest);
  assert.equal(never.remainingTimeInSeconds, 3540, 'a quest with no seam charges as ever');
  assert.equal(rd('src/systems/quest/clock.js').includes('questClocksStoodDown'), false, 'the stand-down word is gone from the clock');
});

test('WORLD5: the hosts by source - the shared clock installed at the boot before anything reads the time, ?tod and ?timescale standing down, the markers aligned and the day rolled when the session starts, the relay\'s offset heard, the trip taking no world time, the jump refused, the rest paced, the quest clocks stood down through the bridge and the parser', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /let _sharedOffsetMs = 0;[^\n]*\n\s*if \(params\.has\('online'\)\) \{ setSharedClock\(\(\) => sharedClassicMinutes\(Date\.now\(\) \+ _sharedOffsetMs\), \(m\) => wallMsForClassicMinutes\(m\) - _sharedOffsetMs\); setSharedWeather\(true\); \}/, 'installed at the boot, the shared weather with it (OL3: the inverse beside the source)');
  assert.match(w, /if \(bootTod != null && !sharedClockOn\(\)\) setWorldMinutes\(/, '?tod stands down');
  assert.match(w, /const timeScaleMult = params\.has\('timescale'\) && !sharedClockOn\(\) \? Number\(params\.get\('timescale'\)\) \/ 12 : 1;/, '?timescale stands down');
  assert.match(w, /online\.onClock = \(offsetMs\) => \{ const was = _sharedOffsetMs; _sharedOffsetMs = offsetMs; if \(Math\.abs\(offsetMs - was\) > 1000\) onlineArrival\(\); \};/, 'the relay\'s clock corrects this machine\'s (AUDIT WORLD5 C2: and a correction is an arrival)');
  assert.match(w, /const onlineArrival = \(\) => \{ alignEntityClocks\(playerEntity, worldMinutes\(\)\); rollClimateWeathersForDay\(worldMinutes\(\)\); refreshSeason\(worldMinutes\(\)\); \};\s*onlineArrival\(\);/, 'the session\'s start: the markers, the day\'s roll, the season');
  assert.match(w, /\{ arriveMinutes: sharedClockOn\(\) \? worldMinutes\(\) : worldMinutes\(\) \+ computed\.minutes,/, 'the trip takes no world time');
  assert.match(w, /if \(!sharedClockOn\(\)\) \{ setSyntheticTimeIncrease\(true\); playerTicker\.advance\(computed\.minutes\); \}/, 'no jump');
  assert.match(w, /if \(clamp > 0 && !sharedClockOn\(\)\) \{ setSyntheticTimeIncrease\(true\); playerTicker\.advance\(clamp\); \}/, 'no arrival clamp');
  assert.match(w, /questClockStepMax: \(\) => \(sharedClockOn\(\) \? PLAYED_STEP_MAX_SECONDS : Infinity\),/, 'the bridge\'s dep (WORLD7: the played step, not the stand-down)');
  const sh = rd('src/scenes/shared.js');
  assert.match(sh, /advance\(minutes\) \{\s*if \(!\(minutes > 0\)\) return null;\s*(?:\/\/[^\n]*\n\s*)*if \(sharedClockOn\(\)\) return this\.tick\(0, undefined, 0\);/, 'RaiseTime under the shared clock runs the owed rounds and fabricates nothing');
  assert.match(sh, /sharedMinutes: \(\) => \(sharedClockOn\(\) \? worldMinutes\(\) : null\),/, 'every host\'s rest deps pace by the clock');
  assert.match(rd('src/scenes/questBridge.js'), /questClockStepMax: \(\) => ctx\.questClockStepMax\?\.\(\) \?\? Infinity,/);
  const m = rd('src/systems/quest/machine.js');
  assert.equal((m.match(/questClockStepMax: \(\) => this\.deps\.questClockStepMax\?\.\(\) \?\? Infinity/g) ?? []).length, 3, 'every door a live quest is born through');
  assert.match(rd('src/systems/quest/parser.js'), /const quest = new Quest\(\{ rolls, actionFactory, nowSeconds, hooks, questClockStepMax \}\);/);
  assert.match(rd('src/systems/quest/clock.js'), /const step = caller\.questClockStepMax\?\.\(\) \?\? Infinity;\s*\n\s*const raw = now - this\._lastWorldTimeSample;\s*\n\s*const difference = Number\.isFinite\(step\) \? Math\.min\(Math\.max\(raw, 0\), step\) : raw;/, 'WORLD7: one played step a frame');
  const wt = rd('src/systems/worldTick.js');
  assert.match(wt, /export const worldMinutes = \(\) => \(_sharedClock \? _sharedClock\(\) : _worldMinutes\);/);
  assert.match(wt, /export function setWorldMinutes\(v\) \{\s*if \(_sharedClock\) return _sharedClock\(\);/);
  assert.match(wt, /export function advanceWorldMinutes\(delta\) \{\s*if \(_sharedClock\) return _sharedClock\(\);/);
  assert.match(rd('server/src/index.js'), /"world":\$\{world \?\? 'null'\},"now":\$\{Date\.now\(\)\}\}`;/, 'the welcome\'s clock (AUDIT WORLD5 C11: stamped as the welcome is built)');
  const arc = rd('bible/06-Systems/Online-Arc.md');
  assert.match(arc, /## WORLD5 \(2026-09-13\)/, 'the record');
});
