import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RestSession, REST_TEXT, MINUTES_PER_TICK, REST_WAIT_PER_HOUR, LOITER_WAIT_PER_HOUR } from '../src/systems/restSession.js';
import { RestWindow, restClockLine } from '../src/ui/restWindow.js';
import { CLASSIC_GAME_START_TIME } from '../src/systems/gameDate.js';

// ═══ RESTX2: ONLINE, A REST PACES ON THE WINDOW'S OWN TIMER ═════════
//
// Mac, 2026-09-17 ("BetterResting"): monsters should still be able to
// interrupt an online wait, and the hours-remaining counter should
// visibly tick down rather than jump straight to its answer.
//
// RESTX1 made an online REST resolve in one frame (no minutes, no
// encounter roll, no countdown) and left LOITER pacing off the shared
// world clock (five real minutes an hour). Both special cases are
// gone: ONE LAW, the timer offline always used, in every mode, online
// or off. What these pins hold: the pace is the offline pace; every
// sub-tick spends `advanceMinutes` online too, so a foe can break the
// rest; the host is handed the session's own sim-minute as the span's
// end (seeded from the shared clock once, ten a sub-tick); the quest
// tick alone stays offline-only; the free lane's full-health guard on
// the Medical tally (AUDIT RESTX F1) is retired with the lane; and the
// shared clock is never read for pacing again.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** The session's host deps, counting everything a rest can spend. */
const deps = (over = {}) => {
  const d = {
    minutes: 0, quests: 0, hours: 0, ends: [],
    advanceMinutes(n, end) { d.minutes += n; d.ends.push(end); },
    tickQuests() { d.quests++; },
    tickVitals() { d.hours++; return false; },
    enemiesNearby: () => false, fullyHealed: () => false, dead: () => false,
    ...over,
  };
  return d;
};
const ONLINE = () => 8000;
const OFFLINE = () => null;
const SUB = REST_WAIT_PER_HOUR / MINUTES_PER_TICK;   // the timer's sub-tick, real seconds (waitTimePerHour / minutesPerTick, DFU's own quirk - see the session's header)
const HOUR = SUB * 6 + 1e-6;   // six sub-ticks: one rested hour of real time (0.45 s), nudged past float carry

test('RESTX2: a TIMED rest online paces on the timer - one frame is not eight hours, an hour is six sub-ticks of real time, and the counter can be watched', () => {
  const d = deps({ sharedMinutes: ONLINE });
  const s = new RestSession('timed', 8, d);
  for (let f = 0; f < 5; f++) assert.equal(s.tick(1 / 60), null, 'five frames is not eight hours (RESTX1 resolved the lot in ONE)');
  assert.equal(d.hours, 0, 'not one hour yet');
  assert.equal(d.minutes, MINUTES_PER_TICK, 'one sub-tick of real time, as the timer always gave offline');
  assert.equal(s.hoursRemaining, 8);
  s.tick(HOUR);
  assert.equal(d.hours, 1, 'six sub-ticks of real time later: the first hour paid');
  assert.equal(s.hoursRemaining, 7, 'and the counter moved one, where the player can see it');
  let r = null;
  for (let h = 0; h < 7 && !r; h++) r = s.tick(HOUR);
  assert.equal(r?.textId, REST_TEXT.wakeUp, 'seven more: "You wake up."');
  assert.equal(d.hours, 8);
  assert.equal(d.minutes, 480, 'every minute of the eight hours was spent through advanceMinutes - RESTX1 spent none');
  assert.equal(d.quests, 0, 'the quest tick alone stays off the online path');
});

test('RESTX2: the host is handed the session\'s own sim-minute as each sub-tick\'s end - seeded from the shared clock at the first sub-tick, ten a sub-tick from there, and the live clock is never re-read', () => {
  let clock = 8000.7;
  const d = deps({ sharedMinutes: () => clock });
  const s = new RestSession('timed', 2, d);
  s.tick(SUB);
  clock += 500;   // the world moved on (or a hidden tab leapt)
  s.tick(SUB); s.tick(SUB);
  assert.deepEqual(d.ends, [8010, 8020, 8030], 'floored seed plus ten per sub-tick: three distinct windows for three distinct rolls, and the 500-minute leap is not in them');
  const off = deps({ sharedMinutes: OFFLINE });
  const so = new RestSession('timed', 2, off);
  so.tick(SUB);
  assert.deepEqual(off.ends, [null], 'offline the end is null and the host reads its own clock');
});

test('RESTX2: a foe that wanders in BREAKS an online rest on the hour it arrives - the thing RESTX1 made impossible', () => {
  let foes = false;
  const d = deps({ sharedMinutes: ONLINE, tickVitals() { d.hours++; foes = d.hours >= 3; return false; }, enemiesNearby: () => foes });
  const s = new RestSession('timed', 9, d);
  let r = null, hours = 0;
  while (!r && hours < 20) { r = s.tick(HOUR); hours++; }
  assert.equal(r?.enemyBroke, true, 'the foe that arrived on the third hour broke the rest');
  assert.equal(hours, 4, 'seen on the FOURTH hour\'s check - the check runs before the vitals, so the hour the foe arrived in was paid first');
  assert.equal(d.hours, 3, 'and the remaining hours were not paid');
});

test('RESTX2: LOITER online paces on LOITER_WAIT_PER_HOUR, not the shared clock - the clock leaping is not a sub-tick, the timer is', () => {
  let clock = 8000;
  const d = deps({ sharedMinutes: () => clock });
  const s = new RestSession('loiter', 2, d);
  clock += 600;
  assert.equal(s.tick(0.001), null);
  assert.equal(d.minutes, 0, 'ten hours of the world\'s clock: nothing - WORLD5\'s pacing is retired');
  const lsub = LOITER_WAIT_PER_HOUR / MINUTES_PER_TICK;
  let r = null, n = 0;
  while (!r && n < 30) { r = s.tick(lsub); n++; }
  assert.equal(r?.textId, REST_TEXT.loiterDone);
  assert.equal(n, 12, 'two hours of loiter is twelve of the loiter timer\'s sub-ticks');
  assert.equal(d.minutes, 120);
  assert.equal(s.totalHours, 2);
});

test('RESTX2: AUDIT RESTX F1 is retired with the free lane - a timed rest at full health pays every hour online, because every hour costs its real seconds again', () => {
  const run = (online, healed) => {
    let paid = 0;
    const d = deps({ sharedMinutes: online ? ONLINE : OFFLINE, tickVitals() { paid++; return false; }, fullyHealed: () => healed });
    const s = new RestSession('timed', 9, d);
    let r = null;
    for (let f = 0; f < 40 && !r; f++) r = s.tick(HOUR);
    return paid;
  };
  assert.equal(run(true, true), 9, 'ONLINE and whole: nine hours asked for, nine paid - DFU\'s unconditional tally, and the 74 real seconds are the rate limit it relies on');
  assert.equal(run(true, false), 9);
  assert.equal(run(false, true), 9, 'offline as ever');
  // `full` is the mode with its own guard, untouched: whole at the top of tick(), it pays nothing and never did
  const dFull = deps({ sharedMinutes: ONLINE, fullyHealed: () => true });
  assert.equal(new RestSession('full', 0, dFull).tick(1 / 60)?.textId, REST_TEXT.healed);
  assert.equal(dFull.hours, 0);
});

test('RESTX2: OFFLINE is untouched - the timer paces, the minutes pass, and the quest machine rides the sub-tick', () => {
  const d = deps({ sharedMinutes: OFFLINE });
  const s = new RestSession('timed', 8, d);
  for (let f = 0; f < 5; f++) assert.equal(s.tick(1 / 60), null);
  assert.equal(d.minutes, MINUTES_PER_TICK);
  assert.ok(d.quests >= 1, 'offline the quest machine still rides the rested minutes');
  // the QUEST tick is the one thing gated on the lane: cross-player state ticks against no locally simulated minute
  const on = deps({ sharedMinutes: ONLINE });
  const so = new RestSession('timed', 8, on);
  so.tick(HOUR);
  assert.equal(on.quests, 0);
  assert.equal(on.minutes, 60);
});

test('RESTX2: the rest WINDOW\'s counter ticks down online at the offline rate, and its clock line says the world\'s time without the pace that is no longer true', () => {
  const winDeps = (over = {}) => ({ advanceMinutes() {}, tickVitals: () => false, fullyHealed: () => false, enemiesNearby: () => false, dead: () => false, endLines: (id) => [`text:${id}`], ...over });
  const w = new RestWindow(winDeps({ sharedMinutes: () => CLASSIC_GAME_START_TIME + 95 }));
  w.input('char:1'); w.input('char:4'); w.input('confirm');
  assert.equal(w.status().hours, 4);
  w.tick(HOUR);
  assert.equal(w.status().hours, 3, 'one rested hour of real time later the counter reads three - RESTX1 read zero on the first frame');
  assert.equal(w.status().worldMinutes, CLASSIC_GAME_START_TIME + 95, 'the world\'s minutes still ride the status while the shared clock stands');
  assert.equal(restClockLine(CLASSIC_GAME_START_TIME + 95), 'World time 15:05 - resting does not move it');
});

test('RESTX2 by source: the free lane and the shared-clock lane are gone from the session; the four hosts hand the sub-tick\'s end to their encounter roll', () => {
  const src = read('src/systems/restSession.js');
  for (const gone of ['_free()', 'FREE_REST_HOUR_CAP', '_sharedAt', '_freeHours', '_holdShared', '_sharedTaken']) {
    assert.ok(!src.includes(gone), `${gone} is retired with the lane it served`);
  }
  assert.match(src, /_takeSubTick\(\) \{\s*\n(?:\s*\/\/[^\n]*\n)*\s*if \(this\._timer < this\._subTickEvery\) return false;\s*\n\s*this\._timer -= this\._subTickEvery;\s*\n\s*return true;\s*\n\s*\}/, 'ONE pacing law: the timer, and nothing else is consulted');
  assert.match(src, /_accrue\(dt\) \{\s*\n\s*this\._timer \+= dt;\s*\n\s*\}/, 'every mode banks the frame');
  const loop = src.slice(src.indexOf('while (this._takeSubTick()) {'), src.indexOf('this._minutesOfHour += MINUTES_PER_TICK;'));
  assert.match(loop, /const online = Number\.isFinite\(this\.deps\.sharedMinutes\?\.\(\)\);/);
  assert.match(loop, /if \(this\._onlineSimMinutes == null\) this\._onlineSimMinutes = Math\.floor\(this\.deps\.sharedMinutes\(\)\);\s*\n\s*this\._onlineSimMinutes \+= MINUTES_PER_TICK;/, 'seeded once, ten a sub-tick');
  assert.match(loop, /this\.deps\.advanceMinutes\(MINUTES_PER_TICK, online \? this\._onlineSimMinutes : null\);/, 'the ONE place time is spent, in every lane');
  assert.match(loop, /if \(!online\) this\.deps\.tickQuests\?\.\(\);/, 'the quest tick alone is gated');
  assert.match(src, /if \(this\.mode === 'timed'\) \{\s*\n(?:\s*\/\/[^\n]*\n)*\s*this\.deps\.tickVitals\(\);/, 'F1\'s guard is gone: the tally is unconditional');
  // THE FOUR HOSTS: the two exterior hosts read the end the session hands them; the dungeon already did
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const h = read(host);
    assert.match(h, /function runEncounterTick\(playerFeet, simMinutesEnd = null\) \{/, `${host}: the roll takes the rest's minute`);
    assert.match(h, /const now = simMinutesEnd \?\? Math\.floor\(playerTicker\.classicMinutes\);/, `${host}: ...as its now, when handed one`);
    assert.match(h, /advanceMinutes: \(n, sharedEnd\) => \{ playerTicker\.advance\(n\); runEncounterTick\([^)]*, sharedEnd\); \}/, `${host}: the rest deps hand it over`);
  }
  assert.match(read('src/scenes/dungeonContext.js'), /advanceMinutes: \(n, sharedEnd\) => _restAdvance\(n, sharedEnd\),/, 'the dungeon\'s arm, unchanged');
  assert.match(read('src/scenes/worldModes.js'), /advanceMinutes: \(n\) => \{ interiorTicker\.advance\(n\); host\.encounterTick\?\.\(\); \},/, 'the interior\'s arm rolls nothing inside a building and is unchanged (audit62)');
});
