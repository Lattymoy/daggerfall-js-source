// WORLD7 (Mac, 2026-09-14: "quests dont seem to work in online. I brought a newly created and saved character over and
// the journal is empty"): THE QUEST CLOCKS RUN ONLINE, CHARGING PLAYED TIME. WORLD5 stood every quest clock down
// online (Mac, WORLD1: "time limits on quest ... naturally disabled while online"), and a Daggerfall clock is a DELAY
// as often as a limit: Brisienna's letter waits on a 7-14 day clock (the journal's first entry is removed at the
// door of Privateer's Hold and the letter restarts it), the tutorial's pages on clocks of minutes, every "come back in
// three days" on one - so online the letter never came, the journal stayed empty and the main quest never began.
// Now a clock charges the frame's world time and never more than one PLAYED STEP (PLAYED_STEP_MAX_SECONDS, thirty
// world minutes - two and a half real minutes under the shared clock's twelve-to-one; no bound offline, where a rest
// or a trip charges its whole span, DFU's own); a gap past the step is time away and is forgiven. Delays progress; a
// limit still stands, in hours played; none expires while away. CreateFoe's spawn interval (OL3) charges the same
// way. The word rides the same chain the stand-down did: the hosts -> the bridge -> the machine's three doors and
// the parser -> the Quest -> every Clock and CreateFoe.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Clock, PLAYED_STEP_MAX_SECONDS } from '../src/systems/quest/clock.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('WORLD7: the Clock - online a frame charges its world time up to one played step and a gap past it is forgiven; a limit finishes while playing and starts its task; a resume charges at most one step; offline a gap charges whole', () => {
  assert.equal(PLAYED_STEP_MAX_SECONDS, 30 * 60, 'thirty world minutes: two and a half real minutes online, past any frame');
  let now = 100_000, step = PLAYED_STEP_MAX_SECONDS, started = 0;
  const quest = { rolls: () => 0.5, nowSeconds: () => now, questClockStepMax: () => step, resources: new Map(), getPlace: () => null, travelSecondsTo: () => null, getTask: (sym) => ((sym.original ?? sym.name) === '_c_' || sym.name === '_c_' || sym.name === 'c' ? { start: () => started++ } : null) };
  const clock = new Clock(quest, 'Clock _c_ 01:00');
  clock.startTimer();
  assert.equal(clock.remainingTimeInSeconds, 3600);
  now += 5; clock.tick(quest); assert.equal(clock.remainingTimeInSeconds, 3595, 'a frame charges its seconds');
  now += 1800; clock.tick(quest); assert.equal(clock.remainingTimeInSeconds, 1795, 'a gap of exactly one step charges the step');
  now += 24 * 3600; clock.tick(quest);
  assert.equal(clock.remainingTimeInSeconds, 0); assert.equal(clock.clockFinished, true, 'a day away: one step charged, and five seconds short of the hour that finished it');
  assert.equal(started, 1, 'the same-named task started');
  // the delay: a 14-day letter arrives after 14 days PLAYED, whatever the gaps between sessions
  const letter = new Clock(quest, 'Clock _invitepc_ 14.00:00');
  letter.startTimer();
  const dayS = 24 * 3600;
  for (let d = 0; d < 14; d++) { now += 7 * dayS; letter.tick(quest); for (let m = 0; m < dayS / 600; m++) { now += 600; letter.tick(quest); } }
  assert.equal(letter.remainingTimeInSeconds, 0); assert.equal(letter.clockFinished, true, 'fourteen played days later, with a week away between each: the letter came');
  // a resume: the saved sample is far behind the world - one step charged, no more
  const back = new Clock(quest, 'Clock _r_ 02:00'); back.startTimer();
  back.restoreSaveData({ ...back.getSaveData(), lastWorldTimeSample: now - 30 * dayS });
  back.tick(quest); assert.equal(back.remainingTimeInSeconds, 7200 - 1800, 'a month since the save: one step');
  // offline: no bound
  step = Infinity;
  const off = new Clock(quest, 'Clock _o_ 02:00'); off.startTimer();
  now += 5000; off.tick(quest); assert.equal(off.remainingTimeInSeconds, 2200, 'a rest\'s span charges whole, DFU\'s own');
  const none = new Clock({ rolls: () => 0.5, nowSeconds: () => now, resources: new Map(), getTask: () => null }, 'Clock _n_ 01:00'); none.startTimer();
  now += 5000; none.tick(none.parentQuest); assert.equal(none.clockFinished, true, 'a quest with no seam charges as ever');
});

test('WORLD7: the machine - a scheduled quest\'s clock runs under the played step through the quest (the chain executed): five days away between two frames charges one step, half an hour played finishes the hour and starts the timer\'s task', () => {
  const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(join(VENDOR, 'Tables', f), 'utf8').replace(/^\uFEFF/, '');
  loadQuestTables(sources);
  const clock = { t: 100000 }; const step = PLAYED_STEP_MAX_SECONDS;
  const popups = [];
  const m = new QuestMachine({ nowSeconds: () => clock.t, world: { currentRegionIndex: () => 0 }, questClockStepMax: () => step, showPopup: (w) => popups.push(w) });
  const q = m.scheduleQuest(['Quest: __QC', 'QRC:', 'Message:  1011', ' the letter', '', 'QBN:', 'Clock _wait_ 01:00', '', '_wait_ task:', ' say 1011', '', 'variable _go_', 'until _go_ performed:', ' start timer _wait_'], 0, { rolls: () => 0.4 });
  const task = [...q.tasks.values()].find((t) => (t.symbol?.name ?? t.symbol?.original) === '_wait_' || t.symbol?.original === '_wait_');
  assert.ok(task, 'the timer\'s task'); assert.equal(task.triggered, false);
  m.tick();
  const c = [...q.resources.values()].find((r) => r instanceof Clock);
  assert.ok(c?.clockEnabled, 'the timer runs'); assert.equal(c.remainingTimeInSeconds, 3600);
  clock.t += 5 * 24 * 3600; m.tick();
  assert.equal(c.remainingTimeInSeconds, 1800, 'five days away in one gap: one step charged'); assert.equal(task.triggered, false);
  for (let i = 0; i < 6; i++) { clock.t += 300; m.tick(); }
  assert.equal(c.clockFinished, true, 'half an hour played: the hour ran out'); assert.equal(task.triggered, true, 'and the task started');
});

test('WORLD7: the chain by source - the hosts hand the played step under the shared clock and no bound offline, the bridge and the machine\'s three doors and the parser carry it, the Quest keeps it, the Clock and CreateFoe read it; the stand-down word is gone', () => {
  for (const p of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = rd(p);
    assert.match(s, /questClockStepMax: \(\) => \(sharedClockOn\(\) \? PLAYED_STEP_MAX_SECONDS : Infinity\),/, p);
    assert.match(s, /import \{ PLAYED_STEP_MAX_SECONDS \} from '\.\.\/systems\/quest\/clock\.js';/, `${p}: one home for the step`);
  }
  assert.match(rd('src/scenes/questBridge.js'), /questClockStepMax: \(\) => ctx\.questClockStepMax\?\.\(\) \?\? Infinity,/);
  assert.equal((rd('src/systems/quest/machine.js').match(/questClockStepMax: \(\) => this\.deps\.questClockStepMax\?\.\(\) \?\? Infinity/g) ?? []).length, 3);
  assert.match(rd('src/systems/quest/parser.js'), /const quest = new Quest\(\{ rolls, actionFactory, nowSeconds, hooks, questClockStepMax \}\);/);
  assert.match(rd('src/systems/quest/quest.js'), /this\.questClockStepMax = questClockStepMax;/);
  assert.match(rd('src/systems/quest/clock.js'), /const step = caller\.questClockStepMax\?\.\(\) \?\? Infinity;\s*\n\s*const raw = now - this\._lastWorldTimeSample;\s*\n\s*const difference = Number\.isFinite\(step\) \? Math\.min\(Math\.max\(raw, 0\), step\) : raw;/);
  assert.match(rd('src/systems/quest/actions.js'), /const step = this\.parentQuest\.questClockStepMax\?\.\(\) \?\? Infinity;/);
  for (const p of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/questBridge.js', 'src/systems/quest/machine.js', 'src/systems/quest/parser.js', 'src/systems/quest/quest.js', 'src/systems/quest/clock.js', 'src/systems/quest/actions.js']) assert.equal(rd(p).includes('questClocksStoodDown'), false, `${p}: the stand-down word is gone`);
});
