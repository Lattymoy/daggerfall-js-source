// REST8 (2026-10-03, bible/06-Systems/Rest-Arc.md section 8; Mac's OPEN 12, option A): QUEST WAITS ONLINE -
// TIMEFREE's DELAY HALF, restored on QCLOCK-WORLD's clock. TIMEFREE (2026-10-02, test/timefree.test.js, DELETED by
// QCLOCK-WORLD) read every clock off its script as a deadline or a delay, froze the deadlines and cut the delays; this
// is its file, re-aimed: the reading, the hand table and the split come back (the split moved by REST8 R1's two
// deadlines, K0C00Y02's gold and S0000502's tower, test/rest8_audit_timefree.test.js); the freeze assertions become "runs
// on played time" (QCLOCK-WORLD's chargeSeconds - the lived step, never a raise - and DFU's end); a delay still lands on
// the short wait; the day count reads "a few" for a delay alone; the journal walk skips delays alone. The crime-guild
// letters and the curse arms take the short wait too. Out, as QCLOCK-WORLD has them: the bounties lapse and a letter
// waits for the sky's morning. Offline, DFU's clock whole. The real scripts, parsed. The audit's own pins are
// test/rest8_audit_timefree.test.js.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { GivePc } from '../src/systems/quest/actions.js';
import {
  clockCounts, clockIsDeadline, ONLINE_DELAY_SECONDS, ONLINE_DEADLINES, PLAYED_STEP_MAX_SECONDS, questWaitsShort,
} from '../src/systems/quest/clock.js';
import { handleStartingCrimeGuildQuests, setCrimeGuildQuestHost, CRIME_GUILD_LETTER_DELAY_MINUTES, CRIME_GUILD_LETTER_ONLINE_MINUTES } from '../src/systems/crimeGuilds.js';
import { racialArmIdle, setRacialQuestHost, ONLINE_RACIAL_INTERVAL_MINUTES, CURE_QUEST_INTERVAL_MINUTES, VAMPIRE_INITIAL_QUEST, VAMPIRISM_CURE_QUEST } from '../src/systems/racialQuests.js';
import { runCalendarArms, setSharedClock, DAY_ARMS } from '../src/systems/worldTick.js';

afterEach(() => { setSharedClock(null); });

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = rd(join('vendor/dfu-quests/Tables', f));
  loadQuestTables(sources);
}
/** A parse over the hosts' clock seams: the character's clock, the session's raises, and the played step online (the
 *  hosts' questClockStepMax - PLAYED_STEP_MAX_SECONDS under the shared clock, no bound offline). */
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

test('REST8 (TIMEFREE\'s reading): a clock whose end loses the quest, costs a standing or shuts a reward waiting on it is a deadline; a letter, a page, a meeting, a reward after a wait is a delay (mutants: the reading inverted, a standing not counted, the not-reward arm dropped, the progress read whole)', () => {
  const brisienna = parse('_BRISIEN');
  assert.equal(kind(brisienna, 'invitepc'), 'delay', 'her invitation comes - WORLD1 froze it and the main quest never began');
  assert.equal(kind(brisienna, 'pcfailed'), 'deadline', 'her fortnight: -15 with her and the main quest stopped');
  assert.equal(kind(parse('A0C01Y03'), 'S.01'), 'deadline', 'ninety days, then `end quest`');
  const kavar = parse('S0000500');
  assert.equal(kind(kavar, 'S.00'), 'delay', 'Lord K\'avar\'s letter (31-93 days)');
  assert.equal(kind(kavar, 'firsttimer'), 'deadline', '`when _firsttimer_ and not _S.03_`: a rumour, and the quest lost');
  assert.equal(kind(parse('K0C00Y02'), '2mondung'), 'deadline', 'REST8 R1: "you only have =2mondung_ days" - a trip, not two months: `when _2mondung_ and not _mggold_` ends it unpaid (TIMEFREE read it a delay; online it ended two minutes in)');
  assert.equal(kind(parse('A0C00Y16'), 'delay'), 'delay', 'the gold after the wait');
  assert.equal(kind(parse('A0C00Y00'), 'traveltime'), 'deadline', 'the travel-time limit');
  assert.equal(kind(parse('O0B00Y11'), 'S.01'), 'deadline', 'the heist is paid only `when ... not _S.01_` - its end shuts the reward');
  assert.equal(kind(parse('S0000008'), 'brisiennafirstletter'), 'delay');
  assert.equal(kind(parse('_TUTOR__'), 'page1'), 'delay', 'the tutorial\'s pages');
  assert.equal(kind(parse('N0B20Y02'), 'S.12'), 'delay', 'the trance ends (`hide npc`)');
});

test('REST8 (TIMEFREE\'s table): the penalties the reading cannot see are deadlines by hand - the cure quests\' hunters, the monster\'s escape, the mark leaving, Brisienna\'s month (AUDIT TIMEFREE T6), the scholar and the guard who leave (AUDIT REST-PARTY D2); read as delays they would come two minutes in; B0B81Y02\'s artifact hunt is the one the reading calls a deadline, in the table for the run-time half (AUDIT REST-PARTY D1) (mutants: the table emptied, an entry dropped)', () => {
  assert.deepEqual(Object.keys(ONLINE_DEADLINES).sort(), ['$CUREVAM', '$CUREWER', 'B0B81Y02', 'K0C30Y03', 'M0B11Y18', 'N0B00Y17', 'U0C00Y00', '_BRISIEN']);
  // AUDIT REST-PARTY D1: read a deadline already; its entry keeps it one through the knight's reward (isDeadline's
  // closing on a success skips the table - test/auditrestparty_quests.test.js ticks it)
  const READ_AS_DEADLINES = ['B0B81Y02:S.30'];
  for (const [quest, clocks] of Object.entries(ONLINE_DEADLINES)) {
    const q = parse(quest);
    for (const c of clocks) {
      const id = `${quest}:${c}`, runTime = READ_AS_DEADLINES.includes(id);
      assert.equal(clockIsDeadline(q, q.resources.get(c)), runTime, runTime ? `${id} reads as a deadline - in the table for the run-time half` : `${id} reads as a delay - why it is in the table`);
      assert.equal(kind(q, c), 'deadline', `${id}, by hand`);
    }
  }
});

test('REST8 (TIMEFREE\'s split): every vendored clock is read, and the split stands where AUDIT TIMEFREE left it but for REST8 R1\'s two and AUDIT REST-PARTY D2\'s two - a script or rule change that moves it is seen (mutants: the reading inverted, the progress read whole, a D2 entry dropped)', () => {
  let deadlines = 0, delays = 0;
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Quests')).sort()) {
    if (!f.endsWith('.txt')) continue;
    let q = null;
    try { q = parse(f.replace('.txt', '')); } catch { continue; }
    for (const r of q?.resources.values() ?? []) if (r.isClock) { if (r.isDeadline) deadlines++; else delays++; }
  }
  assert.deepEqual({ deadlines, delays }, { deadlines: 266, delays: 133 });   // AUDIT TIMEFREE: 279/120 before T1-T6, 262/137 after; REST8 R1: K0C00Y02's gold, S0000502's tower (264/135); AUDIT REST-PARTY D2: N0B00Y17's scholar, K0C30Y03's guard (B0B81Y02's hunt, D1, was a deadline already)
});

test('REST8: online a DEADLINE runs on played time - a rest spends none of it, the hours played spend it one step a frame, and it runs out and fires as DFU\'s; a DELAY lands on the short wait; offline both are DFU\'s raw gap (mutants: the deadline cut too, the wait never cut, the cut offline)', () => {
  const now = { s: 1000, raised: 0 };
  const on = parse('A0C01Y03', true, now);
  const limit = on.resources.get('S.01');
  limit.startTimer();
  assert.equal(limit.waitsShort, false, 'a deadline takes no short wait');
  now.s += 200 * DAY_S; now.raised += 200 * DAY_S;   // two hundred days rested
  limit.tick(on);
  assert.equal(limit.clockFinished, false, 'online: a rest of two hundred days spends none of the ninety (QCLOCK-WORLD)');
  assert.equal(limit.remainingTimeInSeconds, 90 * DAY_S, '...not cut to the short wait either');
  assert.equal(limit.liveRemainingSeconds(on), 90 * DAY_S);
  now.s += 5 * DAY_S; limit.tick(on);
  assert.equal(limit.remainingTimeInSeconds, 90 * DAY_S - PLAYED_STEP_MAX_SECONDS, 'five days away in one gap: one played step (WORLD7)');
  for (let k = 0; k < 90 * 48 - 2; k++) { now.s += PLAYED_STEP_MAX_SECONDS; limit.tick(on); }
  assert.deepEqual([limit.clockFinished, limit.remainingTimeInSeconds], [false, PLAYED_STEP_MAX_SECONDS], 'a step short of ninety days played: still running');
  now.s += 600;
  assert.equal(limit.liveRemainingSeconds(on), PLAYED_STEP_MAX_SECONDS - 600, 'the journal reads what the next tick charges');
  now.s += PLAYED_STEP_MAX_SECONDS; limit.tick(on);
  assert.equal(limit.clockFinished, true, 'ninety days played: the deadline is out');
  assert.equal(on.getTask(limit.symbol).triggered, true, '...and its task - the loss - fires, as DFU\'s');

  const off = parse('A0C01Y03', false, now);
  const offLimit = off.resources.get('S.01');
  offLimit.startTimer();
  assert.equal(offLimit.waitsShort, false, 'offline nothing takes the short wait');
  now.s += 91 * DAY_S; now.raised += 91 * DAY_S;
  offLimit.tick(off);
  assert.equal(offLimit.clockFinished, true, 'offline: DFU\'s ninety days, a rest spending them');

  const kavar = parse('S0000500', true, now);
  const letter = kavar.resources.get('S.00');
  letter.startTimer();
  assert.equal(letter.waitsShort, true);
  now.s += 600;
  assert.equal(letter.liveRemainingSeconds(kavar), ONLINE_DELAY_SECONDS - 600, 'the journal reads the cut before the first tick makes it (QT-LIVE1\'s one arithmetic)');
  now.s += ONLINE_DELAY_SECONDS - 60 - 600;
  letter.tick(kavar);
  assert.equal(letter.clockFinished, false, 'a minute short of the wait');
  assert.equal(letter.remainingTimeInSeconds, 60, 'cut once to the short wait, then charged as any clock');
  assert.equal(letter.liveRemainingSeconds(kavar), 60);
  now.s += 60;
  letter.tick(kavar);
  assert.equal(letter.clockFinished, true, 'the letter lands on the short wait, not 31 days on');
  assert.equal(ONLINE_DELAY_SECONDS, 24 * 60, 'twenty-four minutes of the character\'s clock - about two real minutes of play at 12:1');

  const rested = parse('S0000500', true, now).resources.get('S.00');
  rested.startTimer();
  now.s += 3 * DAY_S; now.raised += 3 * DAY_S; rested.tick(rested.parentQuest);
  assert.deepEqual([rested.clockFinished, rested.remainingTimeInSeconds], [false, ONLINE_DELAY_SECONDS], 'a rest spends none of the short wait either - it is played, as every clock online');

  const offLetter = parse('S0000500', false, now).resources.get('S.00');
  offLetter.startTimer();
  const full = offLetter.remainingTimeInSeconds;
  now.s += ONLINE_DELAY_SECONDS; offLetter.tick(offLetter.parentQuest);
  assert.equal(offLetter.remainingTimeInSeconds, full - ONLINE_DELAY_SECONDS, 'offline the letter keeps its weeks');
  assert.ok(full >= 31 * DAY_S);
});

test('REST8: every vendored clock, ticked online past the short wait - all 133 delays have landed and not one of the 266 deadlines is cut (AUDIT REST-PARTY D2\'s two among them), each charged the time played and no more; offline none is cut (the edge: a deadline read as a delay would fire its end two minutes in) (mutants: the deadline cut too, the wait never cut)', () => {
  const PLAY = ONLINE_DELAY_SECONDS + 60;   // twenty-five minutes, inside one played step
  const tally = { deadlines: 0, delays: 0, offline: 0 };
  const wrong = [];
  const warn = console.warn;
  console.warn = () => {};   // (DEAD-CLOCK's leftovers say they have no task to start)
  try {
    for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Quests')).sort()) {
      if (!f.endsWith('.txt')) continue;
      const name = f.replace('.txt', '');
      for (const online of [true, false]) {
        const now = { s: 1_000_000, raised: 0 };
        let q = null;
        try { q = parse(name, online, now); } catch { continue; }
        if (!q) continue;
        const clocks = [...q.resources.values()].filter((r) => r.isClock);
        const before = new Map();
        for (const c of clocks) {
          c.startTimer();
          // a travel clock headless has no trip to measure and is held (AUDIT quest-P15); a world's is a day at least
          if (!c.clockEnabled && c.travelTimePending) { c.travelTimePending = false; c.startingTimeInSeconds = c.remainingTimeInSeconds = DAY_S; c.startTimer(); }
          before.set(c, c.remainingTimeInSeconds);
        }
        now.s += PLAY;
        for (const c of clocks) {
          const id = `${name}:${c.symbol.name}`, b = before.get(c), deadline = c.isDeadline;
          assert.equal(c.clockEnabled, true, `${id} runs`);
          c.tick(q);
          if (online && !deadline) {
            tally.delays++;
            if (!c.clockFinished) wrong.push(`${id}: a delay still waiting after the short wait`);
          } else {
            tally[online ? 'deadlines' : 'offline']++;
            const want = Math.max(0, b - PLAY);
            if (c.remainingTimeInSeconds !== want || c.clockFinished !== (b <= PLAY)) wrong.push(`${id}: ${online ? 'a deadline online' : 'offline'} ${b} -> ${c.remainingTimeInSeconds}`);
          }
        }
      }
    }
  } finally { console.warn = warn; }
  assert.deepEqual(wrong, []);
  assert.deepEqual(tally, { deadlines: 266, delays: 133, offline: 399 }, 'the whole corpus, both lanes');
});

test('REST8: online a DELAY\'s day count reads "a few" - "come back in a few days" - and a DEADLINE keeps its number, online and off (mutants: the count kept for a delay, "a few" for a deadline)', () => {
  const on = parse('A0C01Y03', true);
  const off = parse('A0C01Y03', false);
  assert.equal(on.resources.get('S.01').expandMacro(5), '90', 'online: "you have 90 days" - the days it runs in play');
  assert.equal(off.resources.get('S.01').expandMacro(5), '90');
  assert.equal(parse('S0000500', true).resources.get('S.00').expandMacro(5), 'a few', 'online: the letter "in a few days"');
  assert.match(parse('S0000500', false).resources.get('S.00').expandMacro(5), /^(3[1-9]|[4-8]\d|9[0-4])$/, 'offline: its weeks');
  assert.equal(questWaitsShort(on), true);
  assert.equal(questWaitsShort(off), false);
});

test('REST8: the journal walk skips a DELAY online and keeps a DEADLINE\'s "Time remains" - the rail, the lens and the herald read it in played time; offline every running clock counts (mutants: the walk reads delays, TIMEFREE\'s walk back - every clock skipped online)', () => {
  const src = rd('src/scenes/questBridge.js');
  const body = src.slice(src.indexOf('    questLog() {'), src.indexOf('\n    },', src.indexOf('    questLog() {')) + 6);
  assert.ok(body.includes('if (r.waitsShort) continue;'), 'the slice really is the walk');
  const questLog = new Function('machine', 'notebook', 'clockCounts', `const o = { ${body} }; return o.questLog();`);
  const walk = (online, { deadline = true } = {}) => {
    const now = { s: 1_000_000, raised: 0 };
    const q = parse('S0000500', online, now);
    q.getLogMessages = () => [{ stepID: 0, messageID: 1010, time: 0 }];
    q.getMessage = (id) => ({ id });
    q.resources.get('S.00').startTimer();   // the letter: a delay
    if (deadline) q.resources.get('firsttimer').startTimer();   // the rumour's limit: a deadline
    return { row: questLog({ quests: new Map([[1, q]]) }, null, clockCounts).active[0], q };
  };
  const on = walk(true);
  assert.deepEqual(on.row.clocks.map((c) => c.name), ['firsttimer'], 'online: the deadline alone');
  assert.equal(on.row.clockSeconds, on.q.resources.get('firsttimer').remainingTimeInSeconds, '"Time remains": the deadline\'s, whole');
  const off = walk(false);
  assert.deepEqual(off.row.clocks.map((c) => c.name).sort(), ['S.00', 'firsttimer'], 'offline: both, DFU\'s journal');
  assert.equal(walk(true, { deadline: false }).row.clockSeconds, null, 'online, a delay alone: no time left to show');
  assert.ok(walk(false, { deadline: false }).row.clockSeconds >= 31 * DAY_S, 'offline: its weeks');
});

test('REST8: OUT of the short wait, as QCLOCK-WORLD has them - online a quest letter still waits for the sky\'s morning, and a taken bounty still lapses and shows its time (mutants: TIMEFREE\'s any-hour letter back)', () => {
  const sky = { s: 0 };
  const q = { nowSeconds: () => 0, skySeconds: () => sky.s, hooks: { skySeconds: () => sky.s, nowSeconds: () => 0, isPlayerInTown: () => true, sharedClock: () => true, onOfferPending() {} }, rolls: () => 0, getPlace: () => null, showMessagePopup() {} };
  const give = new GivePc(q); give.textId = 1;
  sky.s = 100 * DAY_S + 23 * 3600;
  give.update();
  assert.equal(give.waitingForTown, true, 'online, the sky\'s night: the letter waits');
  sky.s = 100 * DAY_S + 10 * 3600;
  give.update();
  assert.equal(give.waitingForTown, false, '...and the sky\'s morning lets it through');
  assert.match(rd('src/systems/quest/actions.js'), /if \(!hooks\?\.isPlayerInTown\?\.\(\) \|\| now\.hour < minHour \|\| now\.hour > maxHour\) \{/);
  const bounty = rd('src/scenes/bountyHost.js');
  assert.match(bounty, /for \(const gone of lapseBounties\(ledger, now\)\) \{/, 'a bounty lapses online');
  assert.match(bounty, /clockSeconds: bountyMinutesLeft\(h, now\) \* 60,/, 'and shows its time left');
});

test('REST8 (TIMEFREE\'s): online a crime guild\'s letter is due the short wait after the tally reached it; offline three days (mutants: online kept at three days, the tick not saying it is online)', () => {
  const started = [];
  const prev = setCrimeGuildQuestHost({ startQuest: (n) => started.push(n) });
  try {
    const stamp = 5000 + CRIME_GUILD_LETTER_DELAY_MINUTES;   // the tally reached its mark at minute 5000
    const entity = () => ({ thievesGuildRequirementTally: 10, timeForThievesGuildLetter: stamp, darkBrotherhoodRequirementTally: 0, timeForDarkBrotherhoodLetter: 0 });
    assert.deepEqual(handleStartingCrimeGuildQuests(entity(), { nowClassicMinutes: 5000 + CRIME_GUILD_LETTER_ONLINE_MINUTES - 1, online: true }), []);
    assert.equal(handleStartingCrimeGuildQuests(entity(), { nowClassicMinutes: 5000 + CRIME_GUILD_LETTER_ONLINE_MINUTES + 1, online: true }).length, 1, 'online: the short wait');
    assert.deepEqual(handleStartingCrimeGuildQuests(entity(), { nowClassicMinutes: 5000 + CRIME_GUILD_LETTER_ONLINE_MINUTES + 1 }), [], 'offline: not yet');
    assert.equal(handleStartingCrimeGuildQuests(entity(), { nowClassicMinutes: stamp + 1 }).length, 1, 'offline: three days on');
    assert.equal(CRIME_GUILD_LETTER_ONLINE_MINUTES, 24);
  } finally { setCrimeGuildQuestHost(prev); }
  assert.match(rd('src/systems/worldTick.js'), /handleStartingCrimeGuildQuests\(entity, \{ nowClassicMinutes: next, inside, online: sharedClockOn\(\) \}\);/, 'the tick says it is online');
});

test('REST8 (TIMEFREE\'s): online the curse\'s quests roll on the short wait, each arm only while it has nothing running, one at a time; offline the 38 and 84 days (mutants: the idle check dropped, both arms on online, the short-wait arm off)', () => {
  const live = [];
  const prev = setRacialQuestHost({ activeQuestNames: () => live });
  try {
    assert.equal(racialArmIdle(false), true);
    assert.equal(racialArmIdle(true), true);
    live.push('P0B00L04');
    assert.equal(racialArmIdle(false), false, 'a clan quest running: no second');
    assert.equal(racialArmIdle(true), true, '...the cure arm is its own');
    live.push('$CUREVAM');
    assert.equal(racialArmIdle(true), false);
  } finally { setRacialQuestHost(prev); }
  assert.equal(racialArmIdle(false), false, 'no host, no arm');
  assert.equal(ONLINE_RACIAL_INTERVAL_MINUTES, 24);

  // the arms themselves, walked: a vampire, every roll a hit, a night's walk of minutes (the first marks)
  const walk = (online, from, span) => {
    const running = [], started = [];
    const host = { startQuest: (n) => { started.push(n); running.push(n); }, activeQuestNames: () => running.slice(), findQuests: () => [] };
    const prevHost = setRacialQuestHost(host);
    setSharedClock(online ? () => from : null);
    try {
      const entity = { racialOverride: { racial: 'vampirism', ended: false, hasStartedInitialVampireQuest: false, clan: 150 }, level: 5 };
      runCalendarArms(entity, from, from + span, { rolls: () => 0, arms: DAY_ARMS.own });
      return started;
    } finally { setRacialQuestHost(prevHost); setSharedClock(null); }
  };
  const base = 24 * 1001;   // on no 38- or 84-day mark
  assert.deepEqual(walk(true, base, 480), [VAMPIRE_INITIAL_QUEST, VAMPIRISM_CURE_QUEST], 'online: a night\'s walk starts each arm once, at the first short-wait mark, and stacks nothing');
  assert.deepEqual(walk(false, base, 480), [], 'offline: nothing between the marks');
  assert.deepEqual(walk(false, CURE_QUEST_INTERVAL_MINUTES, 1), [VAMPIRISM_CURE_QUEST], 'offline: the 84-day cure mark, DFU\'s');
  assert.deepEqual(walk(true, CURE_QUEST_INTERVAL_MINUTES * 2, 1), [VAMPIRE_INITIAL_QUEST, VAMPIRISM_CURE_QUEST],
    'online: on an 84-day mark too only the short-wait arm rolls - DFU\'s cure arm, on, would roll first and unchecked');
  assert.deepEqual(walk(true, base + 1, 23), [], 'online: the minutes between two short-wait marks roll nothing');

  const tick = rd('src/systems/worldTick.js');
  assert.match(tick, /if \(ownArms && !shortWaits\) startRacialOverrideQuest\(entity, false, \{ rolls \}\);/);
  assert.match(tick, /if \(ownArms && !shortWaits && i % CURE_QUEST_INTERVAL_MINUTES === 0\) \{/);
  assert.match(tick, /if \(ownArms && shortWaits && i % ONLINE_RACIAL_INTERVAL_MINUTES === 0\) \{\n\s+if \(racialArmIdle\(false\)\) startRacialOverrideQuest\(entity, false, \{ rolls \}\);\n\s+if \(racialArmIdle\(true\)\) startRacialOverrideQuest\(entity, true, \{ rolls \}\);/);
  assert.match(rd('src/scenes/world.js'), /activeQuestNames: \(\) => \[\.\.\.questBridge\.machine\.quests\.values\(\)\]\.filter\(\(q\) => !q\.questComplete && !q\.questTombstoned\)\.map\(\(q\) => q\.questName\),/, 'the world host answers its live quests');
});
