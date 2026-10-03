// TIME3 (2026-10-01, Mac: "people have to wait insanely long" / "I don't want a band aid, I want a detailed way we can
// do this" / "This needs to be perfect"): QUESTS ON TWO CLOCKS. Design: bible/06-Systems/Online-Time-Arc.md 6.3.
// Online a quest's countdowns - a Clock, a wave's and a sound's interval, a guard's watch, a tombstone - run on the
// CHARACTER's own clock (LIVED1), which a rest, a loiter or a journey spends as in DFU: a three-day wait is a 72-hour
// rest. Its hour, date and season are the SKY's (TIME1). Its journal's dates are stamped on the EVENT clock and read
// on the sky's calendar. The time a character LIVES with the world is charged one played step at most (WORLD7: time
// away forgiven); the time they RAISE is charged whole. A party member's copy runs on its holder's clock; an online
// save from before TIME3 moves its countdowns onto the character's clock once. THE LAW EXECUTES, end to end where a
// rig reaches, and by source for the four hosts.
// QCLOCK-WORLD (2026-10-02, Mac: "go back to the quest timer tied to the online world clock"; asked, "Shared world
// clock"): online the time RAISED is charged NOTHING - a rest, a loiter, a journey spend no quest days - and only the
// time lived with the world is, one played step at most: played time on the world's clock, WORLD7's law. Offline DFU's
// own. The tests below that drove a clock with a rest drive it with lived play now, and say what a rest no longer does.
import './modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  setSharedClock, worldMinutes, ownMinutes, setOwnMinutes, advanceOwnMinutes, raisedMinutes, alignEntityClocks, resetMagicRoundMarker,
} from '../src/systems/worldTick.js';
import { createPlayerTicker } from '../src/scenes/shared.js';
import { Clock, PLAYED_STEP_MAX_SECONDS } from '../src/systems/quest/clock.js';
import { Quest } from '../src/systems/quest/quest.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { DailyFrom, GivePc, SeasonCondition, PlaySound } from '../src/systems/quest/actions.js';
import { RaiseTime } from '../src/systems/quest/questActionsExtension.js';
import { getMacroValue, getContextValue } from '../src/systems/quest/questMacros.js';
import {
  QUEST_OWN_SECOND_KEYS, QUEST_WORLD_SECOND_KEYS, raisedSince, shiftQuestStamps, markOwnClock, questBlockOnOwnClock, questDataOnThisClock,
} from '../src/systems/quest/questStamps.js';
import { offlineCopyOf, onlineCopyOf } from '../src/systems/offlineCopy.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { RestSession, REST_WAIT_PER_HOUR, MINUTES_PER_TICK } from '../src/systems/restSession.js';
import { setSkyCalendar, skySecondsOfEvent } from '../src/systems/skyCalendar.js';
import { SKY_SEGMENTS, skyClassicMinutes } from '../src/net/skyLaw.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { dateFromSeconds, dateString, seasonValue, SEASON_NAMES } from '../src/systems/gameDate.js';
import { createRegionConditions } from '../src/systems/regionConditions.js';
import { RACES } from '../src/systems/races.js';

afterEach(() => { setSharedClock(null); setSkyCalendar(false); });

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const D = 1440, DAY_S = 86400, HOUR_S = 3600;
const player = () => ({
  isPlayer: true, name: 'P', raceId: RACES.Breton, level: 5, health: 60, maxHealth: 60, magicka: 10, maxMagicka: 10, fatigue: 6000,
  stats: { strength: 50, endurance: 50, willpower: 50, agility: 50, luck: 50, intelligence: 50, personality: 50, speed: 50 },
  skills: 30, skillUses: [], items: [], career: {}, activeEffects: [], factionRep: null, regionConditions: createRegionConditions(),
});
/** A quest's clock seams over a mutable rig: the character's clock, the session's raises, the played step. */
const questAt = (c) => ({ rolls: () => 0.5, nowSeconds: () => c.own, raisedSeconds: () => c.raised, questClockStepMax: () => c.step, resources: new Map(), getPlace: () => null, travelSecondsTo: () => null, getTask: () => null });
let tablesLoaded = false;
const tables = () => {
  if (tablesLoaded) return;
  const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(join(VENDOR, 'Tables', f), 'utf8').replace(/^﻿/, '');
  loadQuestTables(sources);
  tablesLoaded = true;
};
/** "Come back in three days": a Clock started at once, its task the return. */
const WAIT_3_DAYS = ['Quest: __QW', 'QRC:', 'Message:  1011', ' come back', '', 'QBN:', 'Clock _wait_ 3.00:00', '', '_wait_ task:', ' say 1011', '', 'variable _go_', 'until _go_ performed:', ' start timer _wait_'];
const clockOf = (q) => [...q.resources.values()].find((r) => r instanceof Clock);
const taskOf = (q, name) => [...q.tasks.values()].find((t) => t.symbol?.original === name || t.symbol?.name === name);

test('TIME3 the session\'s raises: counted as they are raised - a RaiseTime, and the ticker\'s advance through the tick - never by a load or a lived frame; a new session counts from nought, and offline there is none', () => {
  const t = { clock: 900_000 };
  setSharedClock(() => t.clock);
  setOwnMinutes(400_000);
  assert.equal(raisedMinutes(), 0, 'a session starts at nought');
  advanceOwnMinutes(60);
  assert.equal(raisedMinutes(), 60, 'a RaiseTime is counted');
  advanceOwnMinutes(-30); advanceOwnMinutes(Infinity); advanceOwnMinutes('soon');
  assert.equal(raisedMinutes(), 60, 'a step back, an Infinity and a word are no raise');
  setOwnMinutes(ownMinutes() + 5000);
  assert.equal(raisedMinutes(), 60, 'a load moves the clock and raises nothing');
  const e = player();
  e.lastGameMinutes = Math.floor(ownMinutes());
  alignEntityClocks(e, t.clock);
  resetMagicRoundMarker(Math.floor(ownMinutes()));
  const ticker = createPlayerTicker(e);
  ticker.advance(90);
  assert.equal(raisedMinutes(), 150, 'the ticker\'s advance - a rest\'s sub-tick, a journey - through the tick\'s raiseMinutes');
  t.clock += 30; ticker.tick(1 / 60);
  assert.equal(raisedMinutes(), 150, 'a lived frame raises nothing');
  setSharedClock(null);
  assert.equal(raisedMinutes(), 0, 'offline: one clock, no raise to tell apart');
  advanceOwnMinutes(60);
  assert.equal(raisedMinutes(), 0);
  setSharedClock(() => t.clock);
  assert.equal(raisedMinutes(), 0, 'a new session counts from nought');
  assert.equal(raisedSince(500, 200), 300);
  assert.equal(raisedSince(100, 200), 0, 'a count that went back is a new session: nothing raised');
  assert.equal(raisedSince(null, 200), 0);
  assert.equal(raisedSince(500, null), 0, 'a sample with no count beside it: nothing known raised');
});

test('QCLOCK-WORLD the Clock online: the time RAISED since its sample is charged NOTHING and the time lived one played step at most - a 72-hour rest spends none of a three-day wait, three days played spend it; a restore is a resume; offline DFU\'s raw gap', () => {
  const c = { own: 1_000_000, raised: 0, step: PLAYED_STEP_MAX_SECONDS };
  const q = questAt(c);
  const days3 = 3 * DAY_S;
  const wait = new Clock(q, 'Clock _w_ 3.00:00'); wait.startTimer();
  assert.equal(wait.remainingTimeInSeconds, days3);
  for (let k = 0; k < 72 * 6; k++) { c.own += 600; c.raised += 600; wait.tick(q); }
  assert.deepEqual([wait.remainingTimeInSeconds, wait.clockFinished], [days3, false], 'seventy-two hours rested, a quest tick on every sub-tick: none of the three days spent');
  for (let k = 0; k < 72 * 6 - 1; k++) { c.own += 600; wait.tick(q); }
  assert.equal(wait.clockFinished, false, 'ten minutes short of three days played: still waiting');
  c.own += 600; wait.tick(q);
  assert.equal(wait.clockFinished, true, 'three days played with the world: the wait is over');
  const live = new Clock(q, 'Clock _l_ 3.00:00'); live.startTimer();
  c.own += 5 * DAY_S; live.tick(q);
  assert.equal(live.remainingTimeInSeconds, days3 - PLAYED_STEP_MAX_SECONDS, 'five days lived away in one gap (a hidden tab): one step, WORLD7\'s forgiveness');
  const both = new Clock(q, 'Clock _b_ 3.00:00'); both.startTimer();
  c.own += 8 * HOUR_S + HOUR_S; c.raised += 8 * HOUR_S; both.tick(q);
  assert.equal(both.remainingTimeInSeconds, days3 - PLAYED_STEP_MAX_SECONDS, 'an eight-hour rest and an hour away in one gap: the rest nothing, the hour one step');
  const near = new Clock(q, 'Clock _n_ 3.00:00'); near.startTimer();
  c.own += 8 * HOUR_S + 600; c.raised += 8 * HOUR_S; near.tick(q);
  assert.equal(near.remainingTimeInSeconds, days3 - 600, 'an eight-hour rest and ten minutes played in one gap: the ten minutes, to the second');
  const over = new Clock(q, 'Clock _x_ 3.00:00'); over.startTimer();
  c.own += 100; c.raised += 5000; over.tick(q);
  assert.equal(over.remainingTimeInSeconds, days3, 'a raise past what the clock moved: nothing, never a negative charge');
  const back = new Clock(q, 'Clock _r_ 3.00:00'); back.startTimer();
  c.raised += 50 * HOUR_S;   // raised before the restore (another timeline, a partner's): never counted across it
  back.restoreSaveData({ ...back.getSaveData(), lastWorldTimeSample: c.own - 5 * DAY_S });
  back.tick(q);
  assert.equal(back.remainingTimeInSeconds, days3 - PLAYED_STEP_MAX_SECONDS, 'a restored clock\'s first gap is a resume: one step for the time behind it');
  c.own += 10 * HOUR_S; c.raised += 10 * HOUR_S; back.tick(q);
  assert.equal(back.remainingTimeInSeconds, days3 - PLAYED_STEP_MAX_SECONDS, '...and the next rest spends nothing');
  // AUDIT TIME: the count is sampled at the restore - a raise after it and before its first tick (a load, then a rest)
  // is a raise, not lived time: nothing
  const early = new Clock(q, 'Clock _e_ 3.00:00'); early.startTimer();
  early.restoreSaveData(early.getSaveData());
  c.own += DAY_S; c.raised += DAY_S; early.tick(q);
  assert.equal(early.remainingTimeInSeconds, days3, 'a day rested after the restore: nothing off');
  // ...and the raises BEFORE it are no part of the gap after it: a rest before the save, then ten minutes played
  const late = new Clock(q, 'Clock _s_ 3.00:00'); late.startTimer();
  c.own += 50 * HOUR_S; c.raised += 50 * HOUR_S;
  late.restoreSaveData({ ...late.getSaveData(), lastWorldTimeSample: c.own });
  c.own += 600; late.tick(q);
  assert.equal(late.remainingTimeInSeconds, days3 - 600, 'a rest before the restore takes nothing off the ten minutes played after it');
  const fresh = new Clock(q, 'Clock _f_ 3.00:00'); fresh.startTimer();
  c.raised = 0; c.own += 4 * HOUR_S; fresh.tick(q);
  assert.equal(fresh.remainingTimeInSeconds, days3 - PLAYED_STEP_MAX_SECONDS, 'a count that went back (a new session) is a resume too');
  const read = new Clock(q, 'Clock _v_ 3.00:00'); read.startTimer();
  c.own += 7200; c.raised += 7200;
  assert.equal(read.liveRemainingSeconds(q), days3, 'the journal reads a raise as the next tick charges it - nothing (QT-LIVE1\'s one arithmetic)');
  c.own += 600;
  assert.equal(read.liveRemainingSeconds(q), days3 - 600, '...and ten minutes played as ten');
  read.tick(q);
  assert.equal(read.remainingTimeInSeconds, days3 - 600);
  c.step = Infinity;
  const off = new Clock(q, 'Clock _o_ 3.00:00'); off.startTimer();
  c.own += 2 * DAY_S; c.raised += DAY_S; off.tick(q);
  assert.equal(off.remainingTimeInSeconds, DAY_S, 'offline: the raw gap, whatever was lived or raised - DFU\'s own, a rest spending its days');
});

test('TIME3 the Clock samples WHOLE seconds, as DFU\'s WorldTime.Now.ToSeconds() - an hour of fractional frames charges an hour (the gap cut to whole seconds at every tick dropped up to a third of it)', () => {
  for (const step of [PLAYED_STEP_MAX_SECONDS, Infinity]) {
    for (const per of [1.2, 1.4, 1.7]) {   // ten quest ticks a real second at TimeScale 12, through frame jitter
      const c = { own: 1_000_000.37, raised: 0, step };
      const q = questAt(c);
      const h = new Clock(q, 'Clock _h_ 01:00'); h.startTimer();
      let ticks = 0;
      while (!h.clockFinished && ticks < 10_000) { c.own += per; h.tick(q); ticks++; }
      const spent = ticks * per;
      assert.ok(spent >= 3600 - 1 && spent <= 3600 + per + 1, `an hour on the clock is an hour of the character's time, ${per}s a tick (${spent.toFixed(1)}s)`);
    }
  }
});

test('QCLOCK-WORLD CreateFoe\'s interval: a rest spends none of it (no wave), an hour played spends it (the next wave), a lived time away past one step is forgiven (WORLD7) - the interval runs on the character\'s clock as it moves with the world', () => {
  tables();
  const rig = () => {
    const world = { currentRegionIndex: () => 0, isPlayerInLocationRect: () => true, created: [], placed: [], createFoeGameObjects: (foe, count) => { world.created.push(count); return Array.from({ length: count }, (_, i) => ({ i })); }, tryPlaceFoe: (h) => { world.placed.push(h); return true; }, raiseOnEncounterEvent() {} };
    const clock = { t: 100000, raised: 0 };
    const m = new QuestMachine({ nowSeconds: () => clock.t, raisedSeconds: () => clock.raised, world, questClockStepMax: () => PLAYED_STEP_MAX_SECONDS, showPopup() {} });
    m.scheduleQuest(['Quest: __QF', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Foe _rat_ is 2 Giant_rat', '', ' send _rat_ every 60 minutes 9 times with 100% success'], 0, { rolls: () => 0.4 });
    m.tick();
    let guard = 0;
    while (world.created.length === 0 && guard++ < 200) { clock.t += 60; m.tick(); }
    assert.equal(world.created.length, 1, 'the first wave');
    m.tick(); m.tick(); m.tick();   // placed, and counted
    return { world, clock, m };
  };
  { const { world, clock, m } = rig();
    clock.t += 2 * HOUR_S; clock.raised += 2 * HOUR_S; m.tick();
    assert.equal(world.created.length, 1, 'two hours rested: none of the hour\'s interval spent - no wave');
    for (let k = 0; k < 60 && world.created.length < 2; k++) { clock.t += 60; m.tick(); }
    assert.equal(world.created.length, 2, 'an hour played: the interval spent - the next wave');
  }
  { const { world, clock, m } = rig();
    clock.t += 2 * HOUR_S; m.tick();
    assert.equal(world.created.length, 1, 'two hours away (lived, a hidden tab): one step charged, the interval not yet');
  }
  const src = rd('src/systems/quest/actions.js');
  assert.match(src, /const raisedNow = this\.parentQuest\.raisedSeconds\?\.\(\) \?\? null;/, 'the wave reads the session\'s raises');
  assert.match(src, /this\._lastRaised = raisedNow;/, 'and samples them every tick');
});

test('TIME3 a quest reads three clocks: an hour, a day\'s light, a season and a date on the SKY; a sound\'s interval and a guard\'s watch on the CHARACTER\'s; its start, its steps and its tombstone stamped where they belong', () => {
  const sky = { s: 0 }, own = { s: 0 }, world = { s: 0 };
  const played = [], raised = [];
  const hooks = { skySeconds: () => sky.s, nowSeconds: () => own.s, isPlayerInTown: () => true, playSound: (id) => { played.push(id); return true; }, raiseTime: (s) => raised.push(s), sharedClock: () => false, onOfferPending() {} };
  const q = { nowSeconds: () => own.s, skySeconds: () => sky.s, worldSeconds: () => world.s, hooks, rolls: () => 0, getPlace: () => null, showMessagePopup() {} };
  const at = (day, h, m = 0) => day * DAY_S + h * HOUR_S + m * 60;
  // DailyFrom: the sky's hour
  const daily = new DailyFrom(q); daily.minDailySeconds = 12 * HOUR_S; daily.maxDailySeconds = 13 * HOUR_S;
  sky.s = at(100, 12, 10); own.s = at(100, 3);
  assert.equal(daily.checkTrigger(), true, 'the sky at 12:10 opens a "daily from 12:00 to 13:00", whatever the character\'s hour');
  sky.s = at(100, 3); own.s = at(100, 12, 10);
  assert.equal(daily.checkTrigger(), false, 'the character\'s noon does not');
  // GivePc's notice waits for the sky's day
  const give = new GivePc(q); give.textId = 1;
  sky.s = at(100, 23); own.s = at(100, 12);
  give.update();
  assert.equal(give.waitingForTown, true, 'the sky\'s night holds the notice, whatever the character\'s noon');
  sky.s = at(100, 10); own.s = at(100, 23);
  give.update();
  assert.equal(give.waitingForTown, false, 'the sky\'s morning lets it through');
  // the season trigger: the sky's season (day 355 of the calendar is winter, day 170 summer)
  sky.s = at(355, 12); own.s = at(170, 12);
  assert.deepEqual([SEASON_NAMES[seasonValue(dateFromSeconds(sky.s))], SEASON_NAMES[seasonValue(dateFromSeconds(own.s))]], ['Winter', 'Summer'], 'the fixture');
  const wantWinter = new SeasonCondition(q); wantWinter.season = 'winter';
  const wantSummer = new SeasonCondition(q); wantSummer.season = 'summer';
  assert.equal(wantWinter.checkTrigger(), true, 'a winter sky is winter, whatever the character\'s calendar');
  assert.equal(wantSummer.checkTrigger(), false);
  // QAE's "raise time until 06:00": the sky's time of day
  const until = new RaiseTime(q); until.hoursTo = 6; until.minutesTo = 0;
  sky.s = at(100, 22); own.s = at(100, 5);
  until.update();
  assert.deepEqual(raised, [8 * HOUR_S], 'eight hours to the sky\'s six o\'clock (the character\'s five would have been one)');
  // the date/time block: the sky's
  sky.s = at(100, 14, 7); own.s = at(100, 2, 3);
  assert.equal(getMacroValue('%hour', null, hooks), '14');
  assert.equal(getMacroValue('%min', null, hooks), '7');
  // PlaySound: an interval on the character's clock
  const sound = new PlaySound(q); sound.interval = 600; sound.count = 0; sound.soundId = 7; sound.lastTimePlayed = own.s;
  sky.s += 4 * HOUR_S; sound.update();
  assert.deepEqual(played, [], 'the sky moving plays nothing');
  own.s += 600; sound.update();
  assert.deepEqual(played, [7], 'ten minutes of the character\'s time plays it');
  // the stamps: a start and a step on the event clock, a tombstone on the character's
  own.s = 1_000_000; world.s = 7_000_000;
  const quest = new Quest({ nowSeconds: () => own.s, skySeconds: () => sky.s, worldSeconds: () => world.s });
  quest.start();
  quest.addLogStep(1, 1011);
  quest.tombstone();
  assert.deepEqual([quest.questStartTime, quest.activeLogMessages.get(1).time, quest.questTombstoneTime], [7_000_000, 7_000_000, 1_000_000], 'the journal\'s dates are the event clock\'s; the tombstone\'s week is the character\'s');
  assert.equal(quest.getSaveData().ownSecondsAt, 1_000_000, 'and the envelope says which clock its countdowns stand on');
  const bare = new Quest({ nowSeconds: () => 42 });
  assert.deepEqual([bare.skySeconds(), bare.worldSeconds(), bare.raisedSeconds], [42, 42, null], 'a quest with one clock reads it for all three (offline, headless)');
});

test('TIME3 AUDIT: GUARD-ONLINE\'s watch is a countdown on the CHARACTER\'s clock - the sky turning moves nothing, ten minutes of their own time opens it', () => {
  const own = { s: 1_000_000 }, sky = { s: 4_000_000 };
  const q = { questName: 'N0B10Y03', nowSeconds: () => own.s, skySeconds: () => sky.s, hooks: { sharedClock: () => true }, getPlace: () => ({ isPlayerHere: () => true }) };
  const watch = new DailyFrom(q); watch.minDailySeconds = 0; watch.maxDailySeconds = 3 * HOUR_S;
  assert.equal(watch.checkTrigger(), false, 'the arrival: the watch begins, shut');
  assert.equal(watch.guardAnchor, 1_000_000, 'anchored on the character\'s clock');
  sky.s += 4 * HOUR_S;
  assert.equal(watch.checkTrigger(), false, 'four hours of the sky: still shut - the watch is not the sky\'s');
  own.s += 10 * 60;
  assert.equal(watch.checkTrigger(), true, 'ten minutes of their own time: open');
});

test('TIME3 the journal\'s date: a step stamped on the event clock is read on the sky\'s calendar - the date the player saw when it was logged; offline the stamp\'s own', () => {
  const T = SKY_SEGMENTS[0].fromMs + 3 * DAY_S * 1000 + 12_345;
  const eventS = Math.floor(sharedClassicMinutes(T) * 60);
  const quest = new Quest({ nowSeconds: () => 1, worldSeconds: () => eventS });
  quest.start();
  setSkyCalendar(true);
  const skyS = skySecondsOfEvent(eventS);
  assert.ok(Math.abs(skyS - skyClassicMinutes(T) * 60) <= 1, 'the sky\'s second at the instant of the stamp');
  assert.notEqual(dateString(dateFromSeconds(skyS)), dateString(dateFromSeconds(eventS)), 'a date the event clock does not show');
  assert.equal(getContextValue('%qdt', quest, {}), dateString(dateFromSeconds(skyS)), '%qdt reads the sky\'s calendar');
  setSkyCalendar(false);
  assert.equal(skySecondsOfEvent(eventS), eventS, 'off, the stamp itself - untouched');
  assert.equal(getContextValue('%qdt', quest, {}), dateString(dateFromSeconds(eventS)));
});

test('TIME3 the machine hands every quest its four clocks at every door - a scheduled quest, a parse for the lists, a restore, a party member\'s copy - and its hooks the sky; a machine given one clock reads it for all', () => {
  tables();
  const deps = { nowSeconds: () => 1001, skySeconds: () => 2002, worldSeconds: () => 3003, raisedSeconds: () => 4004, questClockStepMax: () => 5, world: { currentRegionIndex: () => 0 } };
  const four = (q) => [q.nowSeconds(), q.skySeconds(), q.worldSeconds(), q.raisedSeconds()];
  const m = new QuestMachine(deps);
  const a = m.scheduleQuest(WAIT_3_DAYS, 0, { rolls: () => 0.4 });
  const b = m.parseQuestForLists(WAIT_3_DAYS, 0, { rolls: () => 0.4 });
  assert.deepEqual(four(a), [1001, 2002, 3003, 4004], 'scheduleQuest');
  assert.deepEqual(four(b), [1001, 2002, 3003, 4004], 'parseQuestForLists');
  m.tick();
  const saved = JSON.parse(JSON.stringify(m.getSaveData()));
  const m2 = new QuestMachine(deps);
  m2.restoreSaveData(saved);
  assert.deepEqual(four([...m2.quests.values()][0]), [1001, 2002, 3003, 4004], 'restoreSaveData');
  const shared = m2.receiveSharedQuest(m.getShareableQuestData(a.uid));
  assert.deepEqual(four(shared), [1001, 2002, 3003, 4004], 'receiveSharedQuest');
  const hooks = m._buildHooks();
  assert.deepEqual([hooks.skySeconds(), hooks.nowSeconds()], [2002, 1001], 'the hooks: the sky for the date block, the character\'s clock beside it');
  const one = new QuestMachine({ nowSeconds: () => 7 });
  const o = one.parseQuestForLists(WAIT_3_DAYS, 0, { rolls: () => 0.4 });
  assert.deepEqual(four(o), [7, 7, 7, null], 'offline or headless: the one clock, and no raise');
  assert.equal(one._buildHooks().skySeconds(), 7);
});

test('TIME3 a party member\'s copy runs on its holder\'s clock: its countdowns move from the sender\'s own clock to the receiver\'s by the distance; the journal\'s dates stay (the event clock the party shares); a copy from before TIME3 moves from the event clock', () => {
  const data = {
    questName: 'Q', questStartTime: 5000, questTombstoneTime: 0, ownSecondsAt: 1_000_000,
    activeLogMessages: [{ stepID: 1, messageID: 2, time: 5100 }],
    resources: [{ clock: { lastWorldTimeSample: 999_400 } }],
    tasks: [{ actions: [{ actionSpecific: { lastTimePlayed: 999_000, lastSpawnTime: 0, guardAnchor: 998_000 } }] }],
  };
  const keep = JSON.stringify(data);
  const got = questDataOnThisClock(data, 3_000_000.6, 7777);
  assert.equal(JSON.stringify(data), keep, 'a copy: the envelope is untouched');
  const a = got.tasks[0].actions[0].actionSpecific;
  assert.deepEqual([got.resources[0].clock.lastWorldTimeSample, a.lastTimePlayed, a.lastSpawnTime, a.guardAnchor, got.questTombstoneTime], [2_999_400, 2_999_000, 0, 2_998_000, 0], 'the countdowns by the distance between the two characters\' clocks - a zero stays "never"');
  assert.deepEqual([got.questStartTime, got.activeLogMessages[0].time], [5000, 5100], 'the journal\'s dates are the party\'s, unmoved');
  assert.equal(got.ownSecondsAt, 3_000_000, 'marked: on this character\'s clock, in whole seconds');
  const old = JSON.parse(keep); delete old.ownSecondsAt; old.resources[0].clock.lastWorldTimeSample = 7000;
  assert.equal(questDataOnThisClock(old, 3_000_000, 7777).resources[0].clock.lastWorldTimeSample, 7000 + 3_000_000 - 7777, 'a sender from before TIME3 stamped the event clock: moved from there');
  assert.deepEqual(QUEST_OWN_SECOND_KEYS, ['lastWorldTimeSample', 'lastTimePlayed', 'lastSpawnTime', 'guardAnchor', 'questTombstoneTime']);
  assert.deepEqual(QUEST_WORLD_SECOND_KEYS, ['questStartTime']);
});

test('QCLOCK-WORLD a party\'s copies, end to end: the receiver\'s play spends the receiver\'s days and not the sender\'s, and a rest spends neither; a resync keeps each holder\'s running clock; a clock run out on one copy has run out for the party', () => {
  tables();
  const S = { own: 2_000_000, raised: 0 }, R = { own: 9_000_000, raised: 0 };
  const machine = (c) => new QuestMachine({ nowSeconds: () => c.own, raisedSeconds: () => c.raised, worldSeconds: () => 5_000_000, questClockStepMax: () => PLAYED_STEP_MAX_SECONDS, world: { currentRegionIndex: () => 0 }, showPopup() {} });
  const sm = machine(S), rm = machine(R);
  const sq = sm.scheduleQuest(WAIT_3_DAYS, 0, { rolls: () => 0.4 });
  sm.tick();
  assert.equal(clockOf(sq).remainingTimeInSeconds, 3 * DAY_S);
  sm.markQuestShared(sq.questName);
  const rq = rm.receiveSharedQuest(sm.getShareableQuestData(sq.uid));
  rm.tick();
  assert.equal(clockOf(rq).remainingTimeInSeconds, 3 * DAY_S, 'received on a clock seven million seconds away: nothing charged for the distance');
  // the receiver plays a day: their copy, not the sender's
  for (let k = 0; k < 24 * 6; k++) { R.own += 600; rm.tick(); }
  sm.tick();
  assert.equal(clockOf(rq).remainingTimeInSeconds, 2 * DAY_S, 'the receiver\'s day of play: their copy\'s day');
  assert.equal(clockOf(sq).remainingTimeInSeconds, 3 * DAY_S, 'the sender\'s copy untouched');
  // the receiver rests three hours more, its quests not yet ticked, and a resync from the sender lands first
  const rClock = () => clockOf(rm.sharedCandidateNamed(sq.questName));
  R.own += 3 * HOUR_S; R.raised += 3 * HOUR_S;   // a rest
  R.own += 600;   // and ten minutes played, its quests not yet ticked
  rm.updateSharedQuest(sq.questName, sm.getShareableQuestData(sq.uid));
  assert.equal(rClock().remainingTimeInSeconds, 2 * DAY_S, 'a resync keeps this holder\'s running clock - the days are theirs');
  rm.tick();
  assert.equal(rClock().remainingTimeInSeconds, 2 * DAY_S - 600, 'and its samples: the ten minutes played before it charge ten, the three hours rested nothing, and nothing for the sender\'s clock');
  // a clock this copy does not run takes the envelope's state - moved onto this character's clock
  rClock().clockEnabled = false;
  rm.updateSharedQuest(sq.questName, sm.getShareableQuestData(sq.uid));
  assert.equal(rClock().remainingTimeInSeconds, 3 * DAY_S, 'the sender\'s running clock, as it stands on their copy');
  R.own += 600; rm.tick();
  assert.equal(rClock().remainingTimeInSeconds, 3 * DAY_S - 600, 'ten minutes lived here charge ten - not a step for the seven million seconds between the two clocks');
  // the sender plays the three days: their clock runs out, and the resync carries it
  for (let k = 0; k < 72 * 6; k++) { S.own += 600; sm.tick(); }
  assert.equal(clockOf(sq).clockFinished, true);
  assert.equal(taskOf(sq, '_wait_').triggered, true, 'the sender\'s wait is over');
  rm.updateSharedQuest(sq.questName, sm.getShareableQuestData(sq.uid));
  const after = rm.sharedCandidateNamed(sq.questName);
  assert.equal(clockOf(after).clockFinished, true, 'a clock run out on one copy has run out for the party');
  assert.equal(taskOf(after, '_wait_').triggered, true, 'and the task it fired rides the resync');
});

test('TIME3 AUDIT: a resync from a partner behind keeps what this copy has done - a clock run out stays run out with its task fired, and a wave\'s interval stays this holder\'s', () => {
  tables();
  const S = { own: 2_000_000, raised: 0 }, R = { own: 9_000_000, raised: 0 };
  const machine = (c) => new QuestMachine({ nowSeconds: () => c.own, raisedSeconds: () => c.raised, worldSeconds: () => 5_000_000, questClockStepMax: () => PLAYED_STEP_MAX_SECONDS, world: { currentRegionIndex: () => 0 }, showPopup() {} });
  const sm = machine(S), rm = machine(R);
  const sq = sm.scheduleQuest(WAIT_3_DAYS, 0, { rolls: () => 0.4 });
  sm.tick(); sm.markQuestShared(sq.questName);
  rm.receiveSharedQuest(sm.getShareableQuestData(sq.uid)); rm.tick();
  for (let k = 0; k < 72 * 6; k++) { R.own += 600; rm.tick(); }   // QCLOCK-WORLD: three days played (a rest would spend none)
  const mine = () => rm.sharedCandidateNamed(sq.questName);
  assert.equal(clockOf(mine()).clockFinished, true);
  assert.equal(taskOf(mine(), '_wait_').triggered, true);
  rm.updateSharedQuest(sq.questName, sm.getShareableQuestData(sq.uid));   // the sender, three days still to wait
  assert.equal(clockOf(mine()).clockFinished, true, 'run out here, it stays run out');
  assert.equal(clockOf(mine()).clockEnabled, false);
  assert.equal(taskOf(mine(), '_wait_').triggered, true, 'and its task stays fired');
  // a wave's interval: this holder's timing survives a resync
  const wm = (c, world) => new QuestMachine({ nowSeconds: () => c.own, raisedSeconds: () => c.raised, worldSeconds: () => 5_000_000, questClockStepMax: () => PLAYED_STEP_MAX_SECONDS, world, showPopup() {} });
  const world = () => { const w = { currentRegionIndex: () => 0, isPlayerInLocationRect: () => true, created: [], createFoeGameObjects: (foe, n) => { w.created.push(n); return Array.from({ length: n }, (_, i) => ({ i })); }, tryPlaceFoe: () => true, raiseOnEncounterEvent() {} }; return w; };
  const A = { own: 100_000, raised: 0 }, B = { own: 700_000, raised: 0 }, aw = world(), bw = world();
  const am = wm(A, aw), bm = wm(B, bw);
  const SRC = ['Quest: __QV', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Foe _rat_ is 2 Giant_rat', '', ' send _rat_ every 240 minutes 9 times with 100% success'];
  const aq = am.scheduleQuest(SRC, 0, { rolls: () => 0.99 }); am.tick(); am.markQuestShared(aq.questName);
  const bq = bm.receiveSharedQuest(am.getShareableQuestData(aq.uid)); bm.tick();
  const wave = (q) => [...q.tasks.values()].flatMap((t) => t.actions).find((x) => x.typeName === 'CreateFoe');
  const before = wave(bq).lastSpawnTime;
  for (let k = 0; k < 18; k++) { B.own += 600; bm.tick(); }   // three hours played toward B's wave
  bm.updateSharedQuest(aq.questName, am.getShareableQuestData(aq.uid));
  const after = wave(bm.sharedCandidateNamed(aq.questName));
  assert.equal(after.lastSpawnTime, before, 'the wave\'s last is this holder\'s - the resync did not restart it');
  for (let k = 0; k < 6; k++) { B.own += 600; bm.tick(); }
  assert.ok(bw.created.length >= 1, 'and the fourth hour played brings the wave');
});

test('TIME3 AUDIT (second round): a resync that keeps a run-out clock keeps its task\'s edge and its wave\'s count - "3 times" stays three in this holder\'s world', () => {
  tables();
  const world = () => { const w = { currentRegionIndex: () => 0, isPlayerInLocationRect: () => true, created: [], createFoeGameObjects: (foe, n) => { w.created.push(n); return Array.from({ length: n }, (_, i) => ({ i })); }, tryPlaceFoe: () => true, raiseOnEncounterEvent() {} }; return w; };
  const wm = (c, w) => new QuestMachine({ nowSeconds: () => c.own, raisedSeconds: () => c.raised, worldSeconds: () => 5_000_000, questClockStepMax: () => PLAYED_STEP_MAX_SECONDS, world: w, showPopup() {} });
  const SRC = ['Quest: __QZ', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Foe _rat_ is 2 Giant_rat', 'Clock _c_ 01:00', '', '_c_ task:', ' create foe _rat_ every 30 minutes 3 times with 100% success', '', 'variable _go_', 'until _go_ performed:', ' start timer _c_'];
  const A = { own: 100_000, raised: 0 }, B = { own: 700_000, raised: 0 }, aw = world(), bw = world();
  const am = wm(A, aw), bm = wm(B, bw);
  const aq = am.scheduleQuest(SRC, 0, { rolls: () => 0.99 }); am.tick(); am.markQuestShared(aq.questName);
  bm.receiveSharedQuest(am.getShareableQuestData(aq.uid)); bm.tick();
  const rest = (n) => { for (let k = 0; k < n; k++) { B.own += 600; B.raised += 600; bm.tick(); } };
  const play = (n) => { for (let k = 0; k < n; k++) { B.own += 600; bm.tick(); } };
  rest(6 * 4);
  assert.equal(bw.created.length, 0, 'QCLOCK-WORLD: four hours rested spend none of the hour - no wave');
  play(6 * 4);
  assert.equal(bw.created.length, 3, 'four hours played: the clock out, its three waves');
  bm.updateSharedQuest(aq.questName, am.getShareableQuestData(aq.uid));   // the partner, still counting their hour
  const q = bm.sharedCandidateNamed(aq.questName), task = taskOf(q, '_c_');
  assert.deepEqual([task.triggered, task.prevTriggered], [true, true], 'the task fired, and its edge already taken');
  play(6 * 4);
  assert.equal(bw.created.length, 3, 'four more hours: no wave past the three');
});

test('TIME3 saves: an online save from before TIME3 has its countdowns moved onto the character\'s clock once, at the load; a TIME3 save and an offline one load as they stand; the doors between the lanes move only a TIME3 envelope\'s journal dates', () => {
  const own = 50 * D, world = 230 * D;
  const block = () => ({ machine: { quests: [{ questName: 'Q', questStartTime: world * 60 - 600, questTombstoneTime: 0, activeLogMessages: [{ stepID: 0, messageID: 1, time: world * 60 - 300 }], resources: [{ clock: { lastWorldTimeSample: world * 60 } }], tasks: [{ actions: [{ actionSpecific: { lastTimePlayed: world * 60 - 30, lastSpawnTime: 0 } }] }] }] } });
  const pre = { classicMinutes: own, worldMinutes: world, quest: block() };
  const keep = JSON.stringify(pre);
  const moved = questBlockOnOwnClock(pre).machine.quests[0];
  assert.equal(JSON.stringify(pre), keep, 'the snap is untouched');
  assert.deepEqual([moved.resources[0].clock.lastWorldTimeSample, moved.tasks[0].actions[0].actionSpecific.lastTimePlayed, moved.tasks[0].actions[0].actionSpecific.lastSpawnTime, moved.questTombstoneTime], [own * 60, own * 60 - 30, 0, 0], 'the countdowns onto the character\'s clock by the distance at the save - three days stay three days');
  assert.deepEqual([moved.questStartTime, moved.activeLogMessages[0].time], [world * 60 - 600, world * 60 - 300], 'the journal\'s dates stay the world\'s');
  assert.equal(moved.ownSecondsAt, own * 60, 'and marked, so no load moves them twice');
  assert.equal(questBlockOnOwnClock({ ...pre, quest: { machine: { quests: [moved] } } }).machine.quests[0].resources[0].clock.lastWorldTimeSample, own * 60, 'a TIME3 envelope loads as it stands');
  const offline = { classicMinutes: own, quest: block() };
  assert.equal(questBlockOnOwnClock(offline), offline.quest, 'an offline envelope: one clock, nothing to move');
  // end to end: the load hands the hosts the moved block
  setSharedClock(() => world + 5);
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(player(), { classicMinutes: own, quest: block() })));
  snap.worldMinutes = world;
  const extras = restorePlayer(player(), snap);
  assert.equal(extras.quest.machine.quests[0].resources[0].clock.lastWorldTimeSample, own * 60, 'restorePlayer: the countdowns on the character\'s clock');
  setSharedClock(null);
  // COPY TO OFFLINE, a TIME3 envelope: the journal's dates onto the one clock, the countdowns stay
  const t3 = { classicMinutes: own, worldMinutes: world, quest: { machine: { quests: [{ questName: 'Q', ownSecondsAt: own * 60 - 17, questStartTime: world * 60 - 600, questTombstoneTime: own * 60 - 5, activeLogMessages: [{ stepID: 0, messageID: 1, time: world * 60 - 300 }], resources: [{ clock: { lastWorldTimeSample: own * 60 - 60 } }] }] } } };
  const off = offlineCopyOf(t3).quest.machine.quests[0];
  assert.deepEqual([off.questStartTime, off.activeLogMessages[0].time], [own * 60 - 600, own * 60 - 300], 'the journal\'s dates move to the one clock');
  assert.deepEqual([off.resources[0].clock.lastWorldTimeSample, off.questTombstoneTime, off.ownSecondsAt], [own * 60 - 60, own * 60 - 5, own * 60 - 17], 'the countdowns were the character\'s already, and its mark stands');
  const legacy = offlineCopyOf({ ...pre, quest: block() }).quest.machine.quests[0];
  assert.deepEqual([legacy.resources[0].clock.lastWorldTimeSample, legacy.ownSecondsAt], [own * 60, own * 60], 'an envelope from before TIME3 moves whole, as LIVED1 moved it, and is marked');
  // BRING ONLINE: the journal's dates onto the world's, the countdowns stay, marked
  const on = onlineCopyOf({ classicMinutes: own, quest: { machine: { quests: [{ questName: 'Q', questStartTime: own * 60 - 600, questTombstoneTime: 0, activeLogMessages: [], resources: [{ clock: { lastWorldTimeSample: own * 60 - 60 } }] }] } } }, world);
  const oq = on.quest.machine.quests[0];
  assert.deepEqual([oq.questStartTime, oq.resources[0].clock.lastWorldTimeSample, oq.ownSecondsAt], [world * 60 - 600, own * 60 - 60, own * 60], 'the start onto the world\'s clock, the countdown unmoved, marked');
  assert.equal(questBlockOnOwnClock(on).machine.quests[0].resources[0].clock.lastWorldTimeSample, own * 60 - 60, 'so its first load online moves nothing again');
  // the walk itself
  const tree = { a: { lastSpawnTime: 10, questStartTime: 20, activeLogMessages: [{ time: 30 }, { time: 0 }] } };
  shiftQuestStamps(tree, 5, { own: true });
  assert.deepEqual([tree.a.lastSpawnTime, tree.a.questStartTime, tree.a.activeLogMessages[0].time], [15, 20, 30], 'own: the countdowns alone');
  shiftQuestStamps(tree, 5, { world: true });
  assert.deepEqual([tree.a.lastSpawnTime, tree.a.questStartTime, tree.a.activeLogMessages[0].time, tree.a.activeLogMessages[1].time], [15, 25, 35, 0], 'world: the journal\'s alone - zero stays never');
  assert.equal(markOwnClock({ x: { questName: 'Q', questStartTime: 1 } }, 99).x.ownSecondsAt, 99);
});

test('QCLOCK-WORLD the rest, end to end online: a quest ticks on every sub-tick, and a 72-hour rest - about half a minute - spends none of a three-day wait; its task does not fire', () => {
  tables();
  const t = { clock: 900_000 };
  setSharedClock(() => t.clock);
  setOwnMinutes(400_000);
  const m = new QuestMachine({ nowSeconds: () => ownMinutes() * 60, raisedSeconds: () => raisedMinutes() * 60, worldSeconds: () => worldMinutes() * 60, questClockStepMax: () => PLAYED_STEP_MAX_SECONDS, world: { currentRegionIndex: () => 0 }, showPopup() {} });
  const q = m.scheduleQuest(WAIT_3_DAYS, 0, { rolls: () => 0.4 });
  m.tick();
  assert.equal(clockOf(q).remainingTimeInSeconds, 3 * DAY_S);
  const deps = { sharedMinutes: () => worldMinutes(), advanceMinutes: (n) => advanceOwnMinutes(n), tickQuests: () => m.tick(), tickVitals: () => false, enemiesNearby: () => false, fullyHealed: () => false, dead: () => false };
  // a rested hour is six sub-ticks of real time (the session's own pace: REST_WAIT_PER_HOUR over MINUTES_PER_TICK)
  const HOUR_REAL = (REST_WAIT_PER_HOUR / MINUTES_PER_TICK) * 6;
  let realSeconds = 0, hours = 0;
  for (let day = 0; day < 3; day++) {
    const s = new RestSession('timed', 24, deps);
    for (let h = 0; h < 24; h++) {
      s.tick(HOUR_REAL + 1e-9); realSeconds += HOUR_REAL; hours++;
    }
  }
  assert.equal(raisedMinutes(), 3 * D, 'seventy-two hours raised');
  assert.equal(clockOf(q).remainingTimeInSeconds, 3 * DAY_S, 'and none of the three days spent');
  assert.equal(clockOf(q).clockFinished, false, 'the wait stands');
  assert.equal(taskOf(q, '_wait_').triggered, false, 'and its task has not fired');
  assert.ok(Math.abs(realSeconds - 32.4) < 1e-6, `about half a minute of real time (${realSeconds.toFixed(1)} s)`);
});

test('TIME3 by source - THE FOUR HOSTS RULE: world.js and exterior.js hand the machine the character\'s clock, the sky, the event clock and the raises; the dungeon\'s rest and collapse raise through the counted call; every host\'s rest deps tick the quests, and the session no longer stands them down online; the bridge carries the four and the lens rereads on either hour', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = rd(host);
    assert.match(s, /classicSeconds: \(\) => playerTicker\.ownMinutes \* 60,/, `${host}: the quest's clock is the character's`);
    assert.match(s, /skySeconds: \(\) => skyMinutes\(\) \* 60,/, `${host}: the sky`);
    assert.match(s, /worldSeconds: \(\) => playerTicker\.classicMinutes \* 60,/, `${host}: the event clock`);
    assert.match(s, /raisedSeconds: \(\) => raisedMinutes\(\) \* 60,/, `${host}: the raises`);
    assert.match(s, /tickQuests: \(\) => questBridge\?\.machine\?\.tick\?\.\(\),/, `${host}: the rest ticks the quests`);
  }
  const dungeon = rd('src/scenes/dungeonContext.js');
  assert.match(dungeon, /const start = Math\.floor\(end\) - n;\s*\n\s*advanceOwnMinutes\(n\);/, 'the dungeon\'s rest: a counted raise');
  assert.match(dungeon, /advanceOwnMinutes\(60\);   \/\/ RaiseTime\(1 hour\)/, 'the dungeon\'s collapse: a counted raise');
  assert.match(dungeon, /tickQuests: \(\) => opts\.questBridge\?\.machine\?\.tick\?\.\(\),/, 'and its rest ticks the world host\'s quests');
  assert.equal(/classicMinutesRef\.value \+= /.test(dungeon), false, 'no raise bypasses the count');
  assert.match(rd('src/scenes/worldModes.js'), /tickQuests: \(\) => questBridge\?\.machine\?\.tick\?\.\(\),/, 'worldModes\' rest too');
  const session = rd('src/systems/restSession.js');
  assert.match(session, /\n\s*this\.deps\.tickQuests\?\.\(\);/);
  assert.equal(/sharedMinutes\?\.\(\)\)\) this\.deps\.tickQuests/.test(session), false, 'RESTX2\'s online stand-down is gone');
  const bridge = rd('src/scenes/questBridge.js');
  for (const k of ['skySeconds', 'worldSeconds', 'raisedSeconds']) assert.match(bridge, new RegExp(`${k}: \\(\\) => ctx\\.${k}\\?\\.\\(\\) \\?\\? null,`), `the bridge carries ${k}`);
  assert.match(bridge, /const hour = `\$\{Math\.floor\(\(ctx\.classicSeconds\?\.\(\) \?\? 0\) \/ 3600\)\}\|\$\{Math\.floor\(\(ctx\.skySeconds\?\.\(\) \?\? 0\) \/ 3600\)\}`;/, 'the lens rereads on either clock\'s hour');
  assert.match(rd('src/systems/save.js'), /quest: questBlockOnOwnClock\(snap\) \?\? null,/, 'the load moves a pre-TIME3 online save\'s countdowns');
});
