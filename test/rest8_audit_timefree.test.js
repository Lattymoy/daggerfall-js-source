// REST8 (2026-10-03, bible/06-Systems/Rest-Arc.md section 8; Mac's OPEN 12, option A): AUDIT TIMEFREE's pins, restored
// with the reading they audit (test/audit_timefree.test.js, DELETED by QCLOCK-WORLD; bible/01-Overview/Audit-Timefree.md).
// Every vendored clock was read by hand against the reading, the main quest's whole, and each misreading found is pinned
// here over the real script: the closings that never closed (T1), the letters and arrivals a conditional `when` froze
// (T2), the endings a sequenced beat froze and the "at once" clocks (T3), the item a closing hands over and the reward
// that outranks it (T4), the limit taken after the reward (T5), Brisienna's month (T6), and the main quest's thirty
// deadlines. Re-aimed for REST8, where a deadline is no longer frozen: a deadline online runs on QCLOCK-WORLD's played
// time and fires as DFU's (T7's frozen guard retired with the freeze - a deadline armed at nothing fires at once, online
// as offline), a delay still lands on the short wait. The classifications are AUDIT TIMEFREE's, every one but REST8 R1's
// two (the end alone read for the reward too: K0C00Y02's gold and S0000502's tower are deadlines); under REST8 a
// deadline misread as a delay fires its end two minutes in, so these pins are the edge's guard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { clockIsDeadline, ONLINE_CLOSINGS, ONLINE_DELAY_SECONDS, PLAYED_STEP_MAX_SECONDS } from '../src/systems/quest/clock.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = rd(join('vendor/dfu-quests/Tables', f));
  loadQuestTables(sources);
}
/** A parse over the hosts' clock seams: the character's clock, the session's raises, the played step online. */
const parse = (name, online = false, now = { s: 0, raised: 0 }) => {
  const lines = rd(`vendor/dfu-quests/Quests/${name}.txt`).split(/\r?\n/);
  return new QuestMachine({
    nowSeconds: () => now.s, raisedSeconds: () => now.raised ?? 0, questClockStepMax: () => (online ? PLAYED_STEP_MAX_SECONDS : Infinity),
    showPopup() {}, getQuestSourceLines: () => lines, sharedClock: () => online,
  }).parseQuestShape(name);
};
const kind = (q, n) => {
  const c = q.resources.get(n);
  assert.ok(c?.isClock, `${q.questName} has the clock ${n}`);
  return c.isDeadline ? 'deadline' : 'delay';
};
const DAY_S = 86400;

test('REST8 / AUDIT TIMEFREE T1: a clock its starter starts AFTER settling the quest - the reward handed over, the next quest begun, a deadline already lost - is the script closing it, a delay; read as a deadline it would close only after its days played (mutants: the closing rule dropped, the starter read whole)', () => {
  assert.equal(kind(parse('M0B40Y05'), 'end'), 'delay', '`give pc _gold_`, then `start timer _end_` (00:00), then `end quest`');
  assert.equal(kind(parse('_BRISIEN'), 'oneday'), 'delay', 'a day after meeting her (whose `start task` starts the main quest) or after her fortnight ran out');
  assert.equal(kind(parse('S0000007'), 'delay'), 'delay', 'the main quest: `start quest 12 12`, then the close');
  assert.equal(kind(parse('S0000988'), 'delay'), 'delay');
  assert.equal(kind(parse('A0C01Y06'), 'S.13'), 'delay', '`give pc nothing`, a day, the close');
  // ...and what is NOT a closing
  assert.equal(kind(parse('S0000500'), 'escapetime'), 'deadline', 'the traitor scene pays only `when` the contact is met too - the starter\'s own deeds settle nothing, and the escape is a real limit');
  assert.equal(kind(parse('A0C41Y18'), 'S.10'), 'deadline', 'the start-up block\'s `give pc nothing` starts no closing: the finger and the gold are kept their 1001 days');
});

test('REST8 / AUDIT TIMEFREE T1: the closing after a failure the reading cannot see is a delay by hand, and reads as a deadline without the table; the two that close `when` the failure and the clock both stand read as delays on their own (mutants: the table emptied)', () => {
  assert.deepEqual(Object.entries(ONLINE_CLOSINGS).map(([q, c]) => `${q}:${c.join(',')}`).sort(), ['R0C11Y03:2ndparton']);
  assert.equal(kind(parse('N0B20Y02'), 'S.09'), 'delay', '`when _S.07_ and _S.09_` - the revenge week closes the failed quest');
  assert.equal(kind(parse('N0B10Y03'), 'S.10'), 'delay', '`when _S.10_ and _S.07_` - the unguarded hall\'s hour closes it');
  for (const [quest, clocks] of Object.entries(ONLINE_CLOSINGS)) {
    const q = parse(quest);
    for (const c of clocks) {
      assert.equal(clockIsDeadline(q, q.resources.get(c)), true, `${quest}:${c} reads as a deadline - why it is in the table`);
      assert.equal(kind(q, c), 'delay', `${quest}:${c}, by hand`);
    }
  }
});

test('REST8 / AUDIT TIMEFREE T1/T5: online, before the quest is a success a task-started deadline runs on played time; once it is a SUCCESS it closes on the short wait; one started after it - a new limit - and one the start-up block started stay deadlines on played time; the mark rides the save (mutants: the run-time half dropped, the after-success mark ignored, the mark not saved)', () => {
  const now = { s: 1000, raised: 0 };
  const q = parse('S0000009', true, now);
  const close = q.resources.get('S.14');
  close.startTimer();   // the contact clicked...
  assert.equal(close.isDeadline, true, '...the reward not yet paid');
  now.s += 5 * DAY_S; now.raised += 5 * DAY_S;
  close.tick(q);
  assert.deepEqual([close.clockFinished, close.remainingTimeInSeconds], [false, 2 * DAY_S], 'not a success yet: a deadline - five days rested spend none of its two');
  for (let k = 0; k < 4; k++) { now.s += PLAYED_STEP_MAX_SECONDS; close.tick(q); }
  assert.equal(close.remainingTimeInSeconds, 2 * DAY_S - 4 * PLAYED_STEP_MAX_SECONDS, '...and two hours played spend two hours');
  q.questSuccess = true;   // ...and S.01 pays on the same click
  assert.equal(close.isDeadline, false);
  assert.equal(close.waitsShort, true);
  now.s += ONLINE_DELAY_SECONDS;
  close.tick(q);
  assert.equal(close.clockFinished, true, 'the quest closes on the short wait');

  const raid = parse('M0B11Y18', true, now);
  raid.questSuccess = true;   // the raid paid (S.18)...
  const hunt = raid.resources.get('gettraitor');
  hunt.startTimer();   // ...then the traitor's hunt taken (S.23)
  assert.equal(hunt.startedAfterSuccess, true);
  assert.equal(hunt.isDeadline, true, 'a new limit, taken after the reward: a deadline, not a close');
  now.s += ONLINE_DELAY_SECONDS + 60; hunt.tick(raid);
  assert.deepEqual([hunt.clockFinished, hunt.remainingTimeInSeconds], [false, 30 * DAY_S - ONLINE_DELAY_SECONDS - 60], 'past the short wait, the hunt keeps its thirty days, played');
  const saved = hunt.getSaveData();
  assert.equal(saved.startedAfterSuccess, true);
  const again = parse('M0B11Y18', true, now);
  again.questSuccess = true;
  const restored = again.resources.get('gettraitor');
  restored.restoreSaveData(saved);
  assert.equal(restored.isDeadline, true, 'a load keeps it a limit');
  restored.restoreSaveData({ ...saved, startedAfterSuccess: undefined });
  assert.equal(restored.startedAfterSuccess, false, 'a save from before the mark reads false');

  const finger = parse('A0C41Y18', true, now);
  finger.questSuccess = true;
  assert.equal(kind(finger, 'S.10'), 'deadline', 'the start-up block\'s 1001 days stay a deadline through the success');
});

test('REST8 / AUDIT TIMEFREE T2: what an end DOES costs a standing, not what a later conditional `when` may; a reward a "not yet" reader pays is its own, not a chain\'s (mutants: the lowering read whole, the not-reward read whole)', () => {
  assert.equal(kind(parse('K0C00Y05'), 'S.04'), 'delay', 'the letter after a few hours - only `when _S.09_ and _S.04_` (a misstep) costs the knight');
  assert.equal(kind(parse('M0B11Y18'), 'S.02'), 'delay', 'the traitor arrives - `when _S.18_ and not _S.02_` only says "not yet"');
  assert.equal(kind(parse('_BRISIEN'), 'pcfailed'), 'deadline', 'her fortnight lowers her own standing - still a deadline');
});

test('REST8 / AUDIT TIMEFREE T3: `end quest` is a loss only when the end ALONE sets it off - the engine\'s own reading of the `when`; a clock declared at an explicit zero with no travel arm is "at once", never a deadline (mutants: the `alone` reading dropped, the at-once rule dropped)', () => {
  assert.equal(kind(parse('S0000016'), 'delay'), 'delay', 'the main quest\'s endings: `when _S.01_ and _S.02_ and _delay_` - a beat after the story, not a loss');
  assert.equal(kind(parse('S0000011'), 'S.01'), 'delay', 'Chapter 6 laid out after six days, `when _S.01_ and not _S.04_`');
  assert.equal(kind(parse('S0000500'), 'firsttimer'), 'deadline', '`when _firsttimer_ and not _S.03_` fires on the time-out alone: a loss');
  const favour = parse('S0000106');
  assert.equal(favour.resources.get('delay').declaredAtOnce, true, '`Clock _delay_ 00:00`');
  assert.equal(kind(favour, 'delay'), 'delay', 'the start-up favour lands at once');
  assert.equal(favour.resources.get('delay').getSaveData().declaredAtOnce, true, 'AUDIT REST-PARTY D3: and the mark rides the save (the round trip: test/auditrestparty_quests.test.js)');
  const travel = parse('S0000010').resources.get('itemindung');
  assert.equal(travel.declaredAtOnce, false, '`00:00 0 flag 17 range 0 2` is a trip, not "at once"');
  assert.equal(travel.isDeadline, true);
});

test('REST8 / AUDIT TIMEFREE T4: a quest item handed over is progress (S0000002\'s letter43 after three to seven days, the main quest\'s next page); a reward a "not run out" reader settles outranks it (mutants: GetItem not progress, the settling reader outranked)', () => {
  assert.equal(kind(parse('S0000002'), 'S.15'), 'delay');
  assert.equal(kind(parse('O0B00Y11'), 'S.01'), 'deadline', 'the heist pays only `when ... not _S.01_` - its end, which hands the haul back as the posse comes, is the loss of that pay');
});

test('REST8 / AUDIT TIMEFREE T6: Brisienna\'s month is a deadline by hand (a reminder and her fortnight - the deadline\'s first half); S0000011\'s letter of the same shape is the main quest\'s next page and stays a delay (mutants: remindpc out of the table)', () => {
  const b = parse('_BRISIEN');
  assert.equal(clockIsDeadline(b, b.resources.get('remindpc')), false, 'the reading alone calls it a delay');
  assert.equal(kind(b, 'remindpc'), 'deadline');
  assert.equal(kind(b, 'invitepc'), 'delay', 'the invitation still comes');
  assert.equal(kind(parse('S0000011'), 'S.11'), 'delay', 'letter40 comes');
});

test('REST8 / AUDIT TIMEFREE: the main quest\'s deadlines, every one read by hand - each a lost limit, a trip, a lifetime or a long-stop, and each run on played time online; the list moves only on purpose (mutants: the reading inverted, remindpc out of the table, the progress read whole)', () => {
  const main = [];
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Quests')).sort()) {
    if (!/^(S0000|_BRISIEN)/.test(f)) continue;
    const q = parse(f.replace('.txt', ''));
    for (const r of q?.resources.values() ?? []) if (r.isClock && r.isDeadline) main.push(`${q.questName}:${r.symbol.name}`);
  }
  assert.deepEqual(main, [
    'S0000002:1stparton', 'S0000003:2shedungent', 'S0000004:2ndgo', 'S0000005:2shedungent', 'S0000006:queston',
    'S0000007:2mondung', 'S0000007:2ndparton', 'S0000008:oneyear', 'S0000009:S.14', 'S0000010:itemindung',
    'S0000011:S.18', 'S0000012:S.07', 'S0000013:2myndung', 'S0000100:S.02', 'S0000101:S.02', 'S0000102:S.02',
    'S0000103:S.02', 'S0000104:S.02', 'S0000500:firsttimer', 'S0000500:executiondelay', 'S0000500:escapetime',
    'S0000501:patsy', 'S0000501:time2', 'S0000502:S.03', 'S0000502:towertime', 'S0000503:S.02', 'S0000503:S.10',
    'S0000503:S.21', 'S0000503:S.31', '_BRISIEN:remindpc', '_BRISIEN:pcfailed',
  ], 'AUDIT TIMEFREE\'s thirty, and REST8 R1\'s tower');
  for (const id of main) {
    const [quest, clock] = id.split(':');
    assert.equal(parse(quest, true).resources.get(clock).waitsShort, false, `${id}: online, no short wait`);
  }
});

test('REST8 (AUDIT TIMEFREE T7 retired with the freeze): a deadline armed at nothing - a travel clock whose places cannot be found answers 0, DFU\'s own sum - fires on its first tick, online as offline; TIMEFREE\'s frozen deadline never fired (mutants: the deadline cut too)', () => {
  const now = { s: 1000, raised: 0 };
  for (const online of [true, false]) {
    const q = parse('A0C01Y03', online, now);
    const limit = q.resources.get('S.01');
    limit.startTimer();
    limit.remainingTimeInSeconds = 0;   // armed at nothing
    limit.tick(q);
    assert.equal(limit.clockFinished, true, `${online ? 'online' : 'offline'}: DFU's first-tick end`);
  }
});

// ═══ AUDIT TIMEFREE II (2026-10-02, Mac: "One more audit") - the real machine, ticked: what a player meets ═══
// The scripts' map placements (`place npc`, `create npc at`) want a loaded world; headless they throw and abort the
// quest's update, so the machine here reads each script without those lines - every clock, task and `when` is the
// script's own. REST8: online the hosts' played step and the session's raises, as world.js hands them; the sky held at
// noon, so a letter (which waits for the sky's morning, as QCLOCK-WORLD has it) is never held by the fixture's hour.
const machineFor = (online, now, given = []) => new QuestMachine({
  nowSeconds: () => now.s, raisedSeconds: () => now.raised ?? 0, skySeconds: () => 100 * DAY_S + 12 * 3600,
  sharedClock: () => online(), questClockStepMax: () => (online() ? PLAYED_STEP_MAX_SECONDS : Infinity),
  getQuestSourceLines: (n) => rd(`vendor/dfu-quests/Quests/${n}.txt`).split(/\r?\n/).filter((l) => !/^\s*(place npc|create npc at)/.test(l)),
  showPopup() {}, isPlayerInTown: () => true, giveItemToPlayer: (it) => given.push(it),
});

test('REST8 / AUDIT TIMEFREE II: Brisienna online, ticked - the invitation within half an hour of play; her month a deadline on played time: sixty days rested spend none of it, its thirty days played bring "you are late" and start her fortnight; meeting her closes the quest within the short wait (mutants: remindpc out of the table, the closing rule dropped, the deadline cut too)', async () => {
  const { Symbol: QS } = await import('../src/systems/quest/symbol.js');
  const now = { s: 1e6, raised: 0 };
  const given = [];
  const m = machineFor(() => true, now, given);
  const q = m.startQuestByName('_BRISIEN');
  const step = (secs, n, { rest = false } = {}) => { for (let i = 0; i < n; i++) { now.s += secs; if (rest) now.raised += secs; m.tick(); } };
  step(60, 30);
  assert.equal(q.resources.get('invitepc').clockFinished, true, 'the invitation, inside the half hour');
  assert.equal(given.length, 1, 'letter1 in hand');
  const month = q.resources.get('remindpc');
  assert.equal(month.clockEnabled, true, 'her month begun');
  const begun = month.remainingTimeInSeconds;
  step(1800, 48 * 60, { rest: true });
  assert.equal(month.remainingTimeInSeconds, begun, 'sixty days rested: none of her month spent');
  assert.equal(month.clockFinished, false, '...and no "you are late"');
  assert.ok(month.remainingTimeInSeconds > 29 * DAY_S, 'none of the month spent by the rest (the half hour played before it, at most)');
  assert.equal(q.resources.get('pcfailed').clockEnabled, false, 'her fortnight not begun');
  step(1800, Math.ceil(month.remainingTimeInSeconds / 1800) - 1);
  assert.equal(month.clockFinished, false, 'a step short of thirty days played: still her month');
  step(1800, 48);
  assert.equal(month.clockFinished, true, 'thirty days played: the month is out');
  assert.equal(given.length, 2, 'letter2 - "you are late"');
  assert.equal(q.resources.get('pcfailed').clockEnabled, true, 'and her fortnight runs, on played time');
  assert.ok(q.resources.get('pcfailed').remainingTimeInSeconds > 13 * DAY_S, '...not cut to the short wait');
  q.startTask(new QS('_meetladyb_'));
  step(60, 40);
  assert.equal(q.questComplete, true, 'met, then closed on the short wait');
});

test('REST8 / AUDIT TIMEFREE II: K\'avar\'s letter online lands on the short wait and his first timer stands; offline the same half hour lands nothing - DFU\'s 31-93 days (mutants: the wait never cut, the cut offline)', () => {
  const run = (online) => {
    const now = { s: 1e6, raised: 0 };
    const m = machineFor(() => online, now);
    const q = m.startQuestByName('S0000500');
    for (let i = 0; i < 30; i++) { now.s += 60; m.tick(); }
    return q;
  };
  const on = run(true);
  assert.equal(on.resources.get('S.00').clockFinished, true, 'online: the letter');
  const off = run(false);
  assert.equal(off.resources.get('S.00').clockFinished, false, 'offline: still weeks off');
});

test('REST8 / AUDIT TIMEFREE II: a character who plays online then offline - online the deadline is charged the hours played and no rest, and offline it resumes where it stood, charged the raw gap (mutants: the deadline cut too, the cut offline)', () => {
  let online = true;
  const now = { s: 1e6, raised: 0 };
  const m = machineFor(() => online, now);
  const q = m.startQuestByName('A0C01Y03');
  const limit = q.resources.get('S.01');
  if (!limit.clockEnabled) limit.startTimer();
  m.tick();
  const before = limit.remainingTimeInSeconds;
  for (let i = 0; i < 100; i++) { now.s += 1800; m.tick(); }   // fifty game hours played online
  assert.equal(limit.remainingTimeInSeconds, before - 100 * 1800, 'online: the fifty hours played');
  now.s += 10 * DAY_S; now.raised += 10 * DAY_S; m.tick();   // a ten-day rest
  assert.equal(limit.remainingTimeInSeconds, before - 100 * 1800, '...and a rest nothing (QCLOCK-WORLD)');
  online = false;
  now.s += 3600; m.tick();
  assert.equal(limit.remainingTimeInSeconds, before - 100 * 1800 - 3600, 'offline: the hour since, raw');
});

test('REST8 R1: the end ALONE is read for the reward too (AUDIT TIMEFREE T3\'s own reading) - K0C00Y02\'s gold ("you only have =2mondung_ days") and S0000502\'s tower ("my master will wait inside for =towertime_ days") are deadlines; read whole, each was a delay and online the quest ended unpaid two minutes in; ticked online, the tower keeps its month on played time (mutants: the progress read whole)', async () => {
  const { Symbol: QS } = await import('../src/systems/quest/symbol.js');
  assert.equal(kind(parse('K0C00Y02'), '2mondung'), 'deadline', '`when _2mondung_ and not _mggold_` ends it unpaid; the pay needs a brick returned first');
  assert.equal(kind(parse('S0000502'), 'towertime'), 'deadline', '`when _towertime_ and not _goout_` ends it; the reward needs the item found with him');
  // the tower ticked: the atronach's invitation (S.01 starts the month), then forty minutes of play. Headless, the
  // script's map placements (npcs, foes, items) are read out, as above
  const now = { s: 1e6, raised: 0 };
  const m = new QuestMachine({
    nowSeconds: () => now.s, raisedSeconds: () => now.raised, skySeconds: () => 100 * DAY_S + 12 * 3600, sharedClock: () => true,
    questClockStepMax: () => PLAYED_STEP_MAX_SECONDS, showPopup() {}, isPlayerInTown: () => true, giveItemToPlayer() {},
    getQuestSourceLines: (n) => rd(`vendor/dfu-quests/Quests/${n}.txt`).split(/\r?\n/).filter((l) => !/^\s*(place npc|create npc at|place foe|place item)/.test(l)),
  });
  const q = m.startQuestByName('S0000502');
  m.tick();
  q.startTask(new QS('_S.01_'));
  for (let i = 0; i < 40; i++) { now.s += 60; m.tick(); }
  const tower = q.resources.get('towertime');
  assert.equal(tower.clockEnabled, true, 'his month begun');
  assert.deepEqual([q.questComplete, tower.clockFinished], [false, false], 'forty minutes on, the quest stands (read whole, it had ended at twenty-four)');
  assert.ok(tower.remainingTimeInSeconds > tower.startingTimeInSeconds - 3600, '...its month on played time, the forty minutes spent');
  assert.equal(tower.expandMacro(5), String(Math.ceil(tower.startingTimeInSeconds / DAY_S)), '"will wait inside for 32 days" - a deadline\'s number');
});
