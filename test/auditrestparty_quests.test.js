// AUDIT REST-PARTY, the quest lens (2026-10-03; bible/06-Systems/Rest-Arc.md section 8, REST8 as built): online a
// quest clock that is a DELAY is cut once to the short wait (ONLINE_DELAY_SECONDS of the character's clock) and lands;
// a DEADLINE runs on played world time. The edge is a deadline read as a delay - its end, a loss, two minutes in - and
// the audit found three more of it and a reading that changed across a save:
//  D1 B0B81Y02's `_S.30_`: the map read in the lich's lair starts 180 days to find the artifact (`end quest`); the
//     knight's `give pc nothing` makes the quest a success without ending it, and the run-time half (Clock isDeadline)
//     read that success as the quest closing - the hunt ended two minutes after the knight's word. In the hand table now.
//  D2 N0B00Y17's `_time2_` ("I'll expect you back here within =time2_ days. Please be prompt." - its end hides the
//     scholar) and K0C30Y03's `_S.13_` (the guard and his lead leave town a day or two on): deadlines by hand.
//  D3 the "at once" mark (AUDIT TIMEFREE T3) was not saved: a restored clock is built bare, so S0000106's start-up
//     favour read as a deadline after a load. Saved now, and an older save recomputes it from what it kept.
//  D4 nothing held the hand table out of the run-time half; a mutant dropping that exemption lived.
// The real scripts, through the real machine, ticked. Mutation-proven: tools/mutants/auditrestparty_quests.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { Symbol as QS } from '../src/systems/quest/symbol.js';
import { Clock, clockIsDeadline, ONLINE_DEADLINES, ONLINE_DELAY_SECONDS, PLAYED_STEP_MAX_SECONDS } from '../src/systems/quest/clock.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = rd(join('vendor/dfu-quests/Tables', f));
  loadQuestTables(sources);
}
const DAY_S = 86400;
const QUESTS = readdirSync(join(ROOT, 'vendor/dfu-quests/Quests')).filter((f) => f.endsWith('.txt')).sort().map((f) => f.replace('.txt', ''));
const quiet = (fn) => {   // (DEAD-CLOCK's leftovers and the held travel arms say so on the console)
  const warn = console.warn;
  console.warn = () => {};
  try { return fn(); } finally { console.warn = warn; }
};

/** The machine over the hosts' clock seams, as world.js hands them: the character's clock, the session's raises, the
 *  played step online; the sky held at noon. Headless, the script's map placements (npcs, foes, items) are read out -
 *  they want a loaded world - and every clock, task and `when` is the script's own. */
const machineFor = (online, now) => new QuestMachine({
  nowSeconds: () => now.s, raisedSeconds: () => now.raised, skySeconds: () => 100 * DAY_S + 12 * 3600, sharedClock: () => online,
  questClockStepMax: () => (online ? PLAYED_STEP_MAX_SECONDS : Infinity), showPopup() {}, isPlayerInTown: () => true, giveItemToPlayer() {},
  getQuestSourceLines: (n) => rd(`vendor/dfu-quests/Quests/${n}.txt`).split(/\r?\n/).filter((l) => !/^\s*(place npc|create npc at|place foe|place item|reveal)/.test(l)),
});
/** A parse alone (the script's shape), over the same seams. */
const parse = (name, online = false, now = { s: 0, raised: 0 }) => machineFor(online, now).parseQuestShape(name);
/** A travel clock headless has no trip to measure and is held (AUDIT quest-P15); a world measures it at the parse - a
 *  day at least. Two days here, as the world would have set it. */
const armTravel = (c, seconds = 2 * DAY_S) => {
  if (c.travelTimePending) { c.travelTimePending = false; c.startingTimeInSeconds = c.remainingTimeInSeconds = seconds; }
};

test('AUDIT REST-PARTY D1: B0B81Y02 online, ticked - the map read before the knight is told and after it, the artifact hunt keeps its 180 days through his `give pc nothing`: an hour and a day of play past the short wait the quest still runs; offline the same (mutants: the entry dropped, the exemption dropped)', () => {
  const run = (online, readFirst) => quiet(() => {
    const now = { s: 1e6, raised: 0 };
    const m = machineFor(online, now);
    const q = m.startQuestByName('B0B81Y02');
    const step = (secs, n) => { for (let i = 0; i < n; i++) { now.s += secs; m.tick(); } };
    step(60, 2);
    q.startTask(new QS('_S.01_'));   // the lich killed - its `_map_ used do _readmap_` armed
    step(60, 2);
    if (readFirst) q.startTask(new QS('_readmap_'));   // the map read in the lair: `start timer _S.30_`
    step(60, 2);
    q.startTask(new QS('_S.02_'));   // back to the knight: `when _S.02_ and _S.01_` - give pc nothing, the success
    step(60, 2);
    if (!readFirst) q.startTask(new QS('_readmap_'));
    step(60, 2);
    const hunt = q.resources.get('S.30');
    const at = { success: q.questSuccess, enabled: hunt.clockEnabled, deadline: hunt.isDeadline, waitsShort: hunt.waitsShort, start: hunt.startingTimeInSeconds };
    step(60, 60);   // an hour of the character's clock - five real minutes of play, the short wait twice over
    const hour = { complete: q.questComplete, finished: hunt.clockFinished, remaining: hunt.remainingTimeInSeconds };
    step(PLAYED_STEP_MAX_SECONDS, 48);   // and a day played
    return { at, hour, day: { complete: q.questComplete, finished: hunt.clockFinished, remaining: hunt.remainingTimeInSeconds } };
  });
  assert.ok(2 * ONLINE_DELAY_SECONDS < 3600, 'the hour is the short wait twice over');
  for (const online of [true, false]) {
    for (const readFirst of [true, false]) {
      const lane = `${online ? 'online' : 'offline'}, the map read ${readFirst ? 'before' : 'after'} the knight`;
      const r = run(online, readFirst);
      assert.deepEqual(r.at, { success: true, enabled: true, deadline: true, waitsShort: false, start: 180 * DAY_S + 13 * 3600 + 20 * 60 }, `${lane}: the knight's success, and the hunt a deadline through it`);
      assert.deepEqual([r.hour.complete, r.hour.finished], [false, false], `${lane}: an hour on, the quest stands (it had ended at twenty-four minutes)`);
      assert.ok(r.hour.remaining > 180 * DAY_S, `${lane}: ...its days on played time, an hour spent`);
      assert.deepEqual([r.day.complete, r.day.finished], [false, false], `${lane}: a day played on, still the hunt`);
      assert.ok(r.day.remaining > 179 * DAY_S, `${lane}: ...a day of its 180 spent, no more`);
    }
  }
});

test('AUDIT REST-PARTY D2: N0B00Y17\'s "within =time2_ days. Please be prompt." and K0C30Y03\'s guard online, ticked - sent off, the scholar and the guard are still there an hour past the short wait, the count a number of days; their days played, the end fires as DFU\'s; offline the same (mutants: either entry dropped)', () => {
  const run = (name, clockName, starter, online) => quiet(() => {
    const now = { s: 1e6, raised: 0 };
    const m = machineFor(online, now);
    const q = m.startQuestByName(name, 0, { rolls: () => 0.5 });
    const clock = q.resources.get(clockName);
    armTravel(clock);
    const step = (secs, n) => { for (let i = 0; i < n; i++) { now.s += secs; m.tick(); } };
    step(60, 2);
    q.startTask(new QS(starter));
    step(60, 2);
    const at = { enabled: clock.clockEnabled, deadline: clock.isDeadline, waitsShort: clock.waitsShort, days: clock.expandMacro(5) };
    const wanted = Math.ceil(clock.startingTimeInSeconds / DAY_S), before = clock.remainingTimeInSeconds;
    step(60, 60);
    const hour = { finished: clock.clockFinished, fired: !!q.getTask(clock.symbol)?.triggered, remaining: clock.remainingTimeInSeconds };
    step(PLAYED_STEP_MAX_SECONDS, Math.ceil(clock.remainingTimeInSeconds / PLAYED_STEP_MAX_SECONDS) + 1);
    return { at, wanted, start: clock.startingTimeInSeconds, before, hour, end: { finished: clock.clockFinished, fired: !!q.getTask(clock.symbol)?.triggered } };
  });
  const cases = [
    ['N0B00Y17', 'time2', '_S.10_', 'the scholar\'s list taken ("I\'ll expect you back here within =time2_ days"): `_time2_` hides him, and the reward he holds'],
    ['K0C30Y03', 'S.13', '_S.07_', 'the banker asked: a day or two on `_S.13_` hides the guard, and the lead he holds'],
  ];
  for (const [name, clockName, starter, why] of cases) {
    for (const online of [true, false]) {
      const lane = `${name}:${clockName} ${online ? 'online' : 'offline'} - ${why}`;
      const r = run(name, clockName, starter, online);
      assert.deepEqual(r.at, { enabled: true, deadline: true, waitsShort: false, days: String(r.wanted) }, `${lane}: a deadline, its days a number`);
      assert.ok(r.start > DAY_S, `${lane}: a day and more`);
      assert.deepEqual([r.hour.finished, r.hour.fired], [false, false], `${lane}: an hour on, still there (read as a delay, gone at twenty-four minutes)`);
      assert.equal(r.hour.remaining, r.before - 3600, `${lane}: the hour played spent, and no more`);
      assert.deepEqual([r.end.finished, r.end.fired], [true, true], `${lane}: its days played, the end fires`);
    }
  }
});

test('AUDIT REST-PARTY D3: a save round trip over every vendored clock - each reads the same after it, deadline or delay, the script\'s reading and the "at once" mark; S0000106\'s start-up favour stays at once; a save from before the mark recomputes it the same; the mark is the save\'s word where the recompute cannot tell (mutants: the mark not saved, not restored, the old-save default dropped, the travel arm forgotten)', () => {
  const trip = ({ strip }) => quiet(() => {
    const now = { s: 1e6, raised: 0 };
    const wrong = [];
    let clocks = 0, atOnce = 0, saved = 0;
    for (const name of QUESTS) {
      const m = machineFor(true, now);
      let q = null;
      try { q = m.parseQuestShape(name); } catch { continue; }
      if (!q) continue;
      const before = new Map();
      for (const r of q.resources.values()) if (r.isClock) before.set(r.symbol.name, [r.isDeadline, clockIsDeadline(q, r), r.declaredAtOnce]);
      m.quests.set(q.uid, q);
      const data = JSON.parse(JSON.stringify(m.getSaveData()));   // as a save writes it
      for (const quest of data.quests) {
        for (const res of quest.resources) {
          if (res.type !== 'Clock') continue;
          if (res.resourceSpecific.declaredAtOnce === true) saved++;
          if (strip) delete res.resourceSpecific.declaredAtOnce;   // a save from before the mark
        }
      }
      const m2 = machineFor(true, now);
      m2.restoreSaveData(data);
      const q2 = [...m2.quests.values()][0];
      assert.ok(q2, `${name} restores`);
      for (const r of q2.resources.values()) {
        if (!r.isClock) continue;
        clocks++;
        const after = [r.isDeadline, clockIsDeadline(q2, r), r.declaredAtOnce];
        if (after[2]) atOnce++;
        if (JSON.stringify(after) !== JSON.stringify(before.get(r.symbol.name))) wrong.push(`${name}:${r.symbol.name} ${JSON.stringify(before.get(r.symbol.name))} -> ${JSON.stringify(after)}`);
      }
      if (name === 'S0000106') {
        const favour = q2.resources.get('delay');
        assert.deepEqual([favour.declaredAtOnce, favour.isDeadline], [true, false], `S0000106's \`Clock _delay_ 00:00\`, restored${strip ? ' from an older save' : ''}: at once, a delay (a deadline before D3)`);
      }
    }
    return { clocks, atOnce, saved, wrong };
  });
  for (const strip of [false, true]) {
    const r = trip({ strip });
    assert.deepEqual(r.wrong, [], strip ? 'an older save: every clock reads the same' : 'every clock reads the same');
    assert.deepEqual([r.clocks, r.atOnce, r.saved], [399, 7, 7], 'the whole corpus, its seven "at once" clocks among it - each saved as one');
  }

  // the save carries the mark, and on a restore it is the save's word: a two-value range drawn at zero (`00:00 01:00`)
  // is no "at once", and a save from before the mark cannot tell it from one - why the mark is saved. No script has one.
  const stub = { rolls: () => 0 };
  const drawn = new Clock(stub, 'Clock _drawn_ 00:00 01:00');
  assert.deepEqual([drawn.startingTimeInSeconds, drawn.declaredAtOnce], [0, false], 'drawn at zero: a range, not "at once"');
  assert.equal(drawn.getSaveData().declaredAtOnce, false);
  const back = new Clock(stub);
  back.restoreSaveData(drawn.getSaveData());
  assert.equal(back.declaredAtOnce, false, 'restored: the save\'s word');
  back.restoreSaveData({ ...drawn.getSaveData(), declaredAtOnce: undefined });
  assert.equal(back.declaredAtOnce, true, 'an older save: the recompute reads the zero as "at once" - the one case it cannot tell');
  const once = new Clock(stub, 'Clock _once_ 00:00');
  assert.equal(once.getSaveData().declaredAtOnce, true, 'the save carries the mark');
  const travel = new Clock(stub, 'Clock _trip_ 00:00 0 flag 17 range 0 2');
  back.restoreSaveData({ ...travel.getSaveData(), declaredAtOnce: undefined });
  assert.deepEqual([travel.declaredAtOnce, back.declaredAtOnce], [false, false], 'an older save\'s travel clock, armed at nothing: a trip, not "at once"');
});

test('AUDIT REST-PARTY D4: every hand-table deadline started before the quest\'s success stays a deadline through it, online - the table is never the run-time half\'s closing; ticked past the short wait it is still running (mutants: the exemption dropped, an entry dropped)', () => {
  const rows = [];
  quiet(() => {
    for (const [name, clocks] of Object.entries(ONLINE_DEADLINES)) {
      for (const c of clocks) {
        const now = { s: 1e6, raised: 0 };
        const q = parse(name, true, now);
        const clock = q.resources.get(c);
        armTravel(clock);
        clock.startTimer();   // started before the success...
        q.questSuccess = true;   // ...and then the quest a success
        const at = [clock.startedAfterSuccess, clock.isDeadline, clock.waitsShort];
        now.s += ONLINE_DELAY_SECONDS + 60;
        clock.tick(q);
        rows.push([`${name}:${c}`, ...at, clock.clockFinished, clock.remainingTimeInSeconds === clock.startingTimeInSeconds - ONLINE_DELAY_SECONDS - 60]);
      }
    }
  });
  assert.deepEqual(rows.map((r) => r[0]).sort(), ['$CUREVAM:huntstart', '$CUREWER:huntstart', 'B0B81Y02:S.30', 'K0C30Y03:S.13', 'M0B11Y18:S.05', 'N0B00Y17:time2', 'U0C00Y00:escapetime', '_BRISIEN:remindpc']);
  for (const [id, after, deadline, waitsShort, finished, charged] of rows) {
    assert.deepEqual({ after, deadline, waitsShort, finished, charged }, { after: false, deadline: true, waitsShort: false, finished: false, charged: true }, `${id}: a deadline through the success, the time played charged and no more`);
  }
});
