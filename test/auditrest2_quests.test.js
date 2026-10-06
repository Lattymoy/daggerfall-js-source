// AUDIT REST II, the quest clocks (2026-10-03; bible/06-Systems/Rest-Arc.md section 8, Online-Time-Arc.md 6.3d,
// 01-Overview/Audit-Timefree.md). THE RULE, decided: a quest clock the quest's own text presents to the player as a
// TIME LIMIT - a window to act, to return, to fetch something before it is lost - is a DEADLINE, kept at its days of
// played time online; a clock that only makes the player WAIT is a delay (the short wait). Offline, DFU's clock whole.
//  Q1 R0C11Y03 "The Heartless Daedra": AUDIT TIMEFREE T1's closings table held `_2ndparton_` as a closing after a
//     failure - it is the time to come back for the reward after the heart is DELIVERED; cut to the short wait, the
//     quest failed (-30, unpaid) two minutes after a correct delivery. The entry, and the table, are gone.
//  Q2 S0000011's chapter ("Time is of the essence") and O0B00Y12's drop ("as soon as possible") are deadlines by hand;
//     the corpus swept once for the same shape, every verdict pinned.
//  Q3 bounties held under the never-lapse build (TIMEFREE) all lapsed on the first tick after the update: a ledger
//     version mark, and the rows of an older ledger re-stamped once, online.
//  Q4 no text says a deadline "stays frozen" online - REST8 has no freeze.
//  Q5 the cites into quest/actions.js name the lines they mean.
// The real scripts through the real machine, ticked. Mutation-proven: tools/mutants/auditrest2_quests.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { resolveAnchor, maskAnchors } from '../tools/citeAnchor.mjs';   // CITE-ANCHOR: a cite names its line by a quote
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { Symbol as QS } from '../src/systems/quest/symbol.js';
import * as clockModule from '../src/systems/quest/clock.js';
import {
  newBountyLedger, readBountyLedger, restampNeverLapsed, BOUNTY_LEDGER_VERSION, BOUNTY_LIFETIME_MINUTES, bountySites, boardPostings,
} from '../src/systems/bountyBoard.js';
import { createBountyHost } from '../src/scenes/bountyHost.js';
import { setSharedClock } from '../src/systems/worldTick.js';

const { clockIsDeadline, ONLINE_DEADLINES, ONLINE_DELAY_SECONDS, PLAYED_STEP_MAX_SECONDS } = clockModule;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = rd(join('vendor/dfu-quests/Tables', f));
  loadQuestTables(sources);
}
const DAY_S = 86400;
const quiet = (fn) => {   // (DEAD-CLOCK's leftovers and the held travel arms say so on the console)
  const warn = console.warn;
  console.warn = () => {};
  try { return fn(); } finally { console.warn = warn; }
};

/** The machine over the hosts' clock seams, as world.js hands them (test/auditrestparty_quests.test.js's harness): the
 *  character's clock, the session's raises, the played step online, the sky held at noon. Headless, the script's map
 *  placements are read out - they want a loaded world - and every clock, task and `when` is the script's own. */
const machineFor = (online, now, hooks = {}) => new QuestMachine({
  nowSeconds: () => now.s, raisedSeconds: () => now.raised, skySeconds: () => 100 * DAY_S + 12 * 3600, sharedClock: () => online,
  questClockStepMax: () => (online ? PLAYED_STEP_MAX_SECONDS : Infinity), showPopup() {}, isPlayerInTown: () => true, giveItemToPlayer() {},
  getQuestSourceLines: (n) => rd(`vendor/dfu-quests/Quests/${n}.txt`).split(/\r?\n/).filter((l) => !/^\s*(place npc|create npc at|place foe|place item|reveal)/.test(l)),
  ...hooks,
});
/** A parse alone (the script's shape), over the same seams. */
const parse = (name, online = false, now = { s: 0, raised: 0 }) => machineFor(online, now).parseQuestShape(name);
/** A travel clock headless has no trip to measure and is held (AUDIT quest-P15); a world measures it - a day at least.
 *  Two days here, as the world would have set it, and started if its starter already asked. */
const armTravel = (c, seconds = 2 * DAY_S) => {
  if (!c.travelTimePending) return;
  c.travelTimePending = false;
  c.startingTimeInSeconds = c.remainingTimeInSeconds = seconds;
};

test('AUDIT REST II Q1: R0C11Y03 "The Heartless Daedra" online, ticked - the heart delivered to the chemist, an hour of play past the short wait the quest still stands and `_2ndparton_` counts its days; back to the questgiver, the reward is paid and nothing lost; back too late - its days played - -30 and the quest ended unpaid, as DFU\'s; offline the same (mutants: the closing by hand back - rest8_audit_timefree.json\'s record, the table\'s one entry restated; AUDIT REST III F12: the table itself is gone, so no mutant can put it back)', () => {
  const run = (online, { late }) => quiet(() => {
    const now = { s: 1e6, raised: 0 };
    const repute = [];
    const m = machineFor(online, now, { changeReputation: (_faction, amount) => repute.push(amount) });
    const q = m.startQuestByName('R0C11Y03', 0, { rolls: () => 0.5 });
    const ret = q.resources.get('2ndparton');
    armTravel(ret);
    const step = (secs, n) => { for (let i = 0; i < n; i++) { now.s += secs; m.tick(); } };
    step(60, 2);
    q.startTask(new QS('_npcclicked_'));   // the heart handed to the chemist ("Hurry back to _questgiver_ now")
    step(60, 2);
    const at = { enabled: ret.clockEnabled, deadline: ret.isDeadline, waitsShort: ret.waitsShort, days: ret.expandMacro(5), reading: clockIsDeadline(q, ret) };
    const before = ret.remainingTimeInSeconds;
    step(60, 60);   // an hour of the character's clock - five real minutes of play, the short wait twice over
    const hour = { complete: q.questComplete, fired: !!q.getTask(ret.symbol)?.triggered, remaining: ret.remainingTimeInSeconds, before };
    if (late) step(PLAYED_STEP_MAX_SECONDS, Math.ceil(ret.remainingTimeInSeconds / PLAYED_STEP_MAX_SECONDS) + 1);
    else {
      q.resources.get('questgiver').hasPlayerClicked = true;   // `_S.06_`: back at the questgiver
      step(60, 4);
    }
    return { at, hour, end: { complete: q.questComplete || q.ticksToEnd > 0, success: q.questSuccess, fired: !!q.getTask(ret.symbol)?.triggered, repute } };
  });
  for (const online of [true, false]) {
    const lane = online ? 'online' : 'offline';
    const paid = run(online, { late: false });
    assert.deepEqual(paid.at, { enabled: true, deadline: true, waitsShort: false, days: '2', reading: true }, `${lane}: delivered - the return is a deadline, its count a number of days`);
    assert.deepEqual([paid.hour.complete, paid.hour.fired], [false, false], `${lane}: an hour after the delivery the quest stands (it had failed at twenty-four minutes)`);
    assert.equal(paid.hour.remaining, paid.hour.before - 3600, `${lane}: ...the hour played spent, and no more`);
    assert.deepEqual(paid.end, { complete: true, success: true, fired: false, repute: [-20] }, `${lane}: returned in time - "here is the =reward_ gold", the daedra's -20 alone, never the questgiver's -30`);
    const late = run(online, { late: true });
    assert.deepEqual(late.end, { complete: true, success: false, fired: true, repute: [-20, -30] }, `${lane}: returned too late - its days played, -30 and the quest ended unpaid, as DFU's`);
  }
});

test('AUDIT REST II Q1: AUDIT TIMEFREE\'s closings table is retired with its one entry - the reading calls R0C11Y03\'s `_2ndparton_` a deadline (and its `_1stparton_`, as before), and every one of the 399 clocks is what the reading or the deadline table says, nothing else (mutants: the closing by hand back)', () => {
  assert.equal('ONLINE_CLOSINGS' in clockModule, false, 'no closings table');
  const q = parse('R0C11Y03', true);
  assert.deepEqual([clockIsDeadline(q, q.resources.get('2ndparton')), q.resources.get('2ndparton').isDeadline], [true, true]);
  assert.deepEqual([clockIsDeadline(q, q.resources.get('1stparton')), q.resources.get('1stparton').isDeadline], [true, true], '"If it is not in my friend _chemist_\'s hands in =1stparton_ days" - a deadline, as it was');
  // every clock is what its reading or the deadline table says - nothing else moves a clock to a delay
  const moved = [];
  quiet(() => {
    for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Quests')).sort()) {
      if (!f.endsWith('.txt')) continue;
      const name = f.replace('.txt', '');
      let p = null;
      try { p = parse(name, true); } catch { continue; }
      for (const r of p?.resources.values() ?? []) {
        if (!r.isClock) continue;
        const atOnce = r.declaredAtOnce && !/^_2.*_$/.test(r.symbol.original);
        const want = (ONLINE_DEADLINES[name] ?? []).includes(r.symbol.name) || (!atOnce && clockIsDeadline(p, r));
        if (r.isDeadline !== want) moved.push(`${name}:${r.symbol.name}`);
      }
    }
  });
  assert.deepEqual(moved, []);
});

test('AUDIT REST II Q2: S0000011 "Barenziah\'s Book" online, ticked - "Time is of the essence. I\'m sure Gortwog will not wait long.": an hour after `yes` the chapter is still in Orsinium and the count is the days the text gives; its six days played, the Necromancers steal it, as DFU\'s; clicked first, it never moves; offline the same (mutants: the chapter out of the table)', () => {
  const run = (online, { click }) => quiet(() => {
    const now = { s: 1e6, raised: 0 };
    const m = machineFor(online, now);
    const q = m.startQuestByName('S0000011');
    const step = (secs, n) => { for (let i = 0; i < n; i++) { now.s += secs; m.tick(); } };
    step(60, 2);
    q.startTask(new QS('yes'));   // Chapter6 laid in Orsinium, `start timer _S.01_`
    step(60, 2);
    const c = q.resources.get('S.01');
    const stolen = () => !!q.getTask(new QS('_S.03_'))?.triggered;
    const at = { enabled: c.clockEnabled, deadline: c.isDeadline, waitsShort: c.waitsShort, days: c.expandMacro(5), reading: clockIsDeadline(q, c) };
    const before = c.remainingTimeInSeconds;
    step(60, 60);
    const hour = { stolen: stolen(), remaining: c.remainingTimeInSeconds, before };
    if (click) q.startTask(new QS('_S.04_'));   // the chapter clicked in Orsinium: `stop timer _S.01_`
    step(PLAYED_STEP_MAX_SECONDS, Math.ceil(c.remainingTimeInSeconds / PLAYED_STEP_MAX_SECONDS) + 2);
    return { at, hour, end: { stolen: stolen(), finished: c.clockFinished } };
  });
  for (const online of [true, false]) {
    const lane = online ? 'online' : 'offline';
    const r = run(online, { click: false });
    assert.deepEqual(r.at, { enabled: true, deadline: true, waitsShort: false, days: '7', reading: false }, `${lane}: a deadline by hand (the reading, T3's, calls it a delay), its count the days`);
    assert.equal(r.hour.stolen, false, `${lane}: an hour on, the chapter is still in Orsinium (read as a delay, stolen at twenty-four minutes)`);
    assert.equal(r.hour.remaining, r.hour.before - 3600, `${lane}: ...the hour played spent, and no more`);
    assert.deepEqual(r.end, { stolen: true, finished: true }, `${lane}: its six days played, "The Necromancers have stolen it" - DFU's`);
    assert.deepEqual(run(online, { click: true }).end, { stolen: false, finished: false }, `${lane}: found in time, it stays found`);
  }
});

test('AUDIT REST II Q2: O0B00Y12 "Drugs Delivery" online, ticked - "It needs to be in ___contact1_ as soon as possible. _contact1_ will meet you there": an hour on the contact still waits and no note has come; the clock\'s days played, the contact leaves and the note comes, as DFU\'s; offline the same (mutants: the drop out of the table)', () => {
  const run = (online) => quiet(() => {
    const now = { s: 1e6, raised: 0 };
    const m = machineFor(online, now);
    const q = m.startQuestByName('O0B00Y12', 0, { rolls: () => 0.5 });
    const step = (secs, n) => { for (let i = 0; i < n; i++) { now.s += secs; m.tick(); } };
    step(60, 2);
    const c = q.resources.get('S.01');
    const gone = () => !!q.getTask(c.symbol)?.triggered;
    const at = { enabled: c.clockEnabled, deadline: c.isDeadline, waitsShort: c.waitsShort, reading: clockIsDeadline(q, c) };
    const before = c.remainingTimeInSeconds;
    step(60, 60);
    const hour = { gone: gone(), remaining: c.remainingTimeInSeconds, before, start: c.startingTimeInSeconds };
    step(PLAYED_STEP_MAX_SECONDS, Math.ceil(c.remainingTimeInSeconds / PLAYED_STEP_MAX_SECONDS) + 2);
    return { at, hour, end: { gone: gone(), finished: c.clockFinished } };
  });
  for (const online of [true, false]) {
    const lane = online ? 'online' : 'offline';
    const r = run(online);
    assert.deepEqual(r.at, { enabled: true, deadline: true, waitsShort: false, reading: false }, `${lane}: a deadline by hand`);
    assert.ok(r.hour.start > DAY_S, `${lane}: a day and more`);
    assert.equal(r.hour.gone, false, `${lane}: an hour on, the contact still waits (read as a delay, gone at twenty-four minutes)`);
    assert.equal(r.hour.remaining, r.hour.before - 3600, `${lane}: ...the hour played spent, and no more`);
    assert.deepEqual(r.end, { gone: true, finished: true }, `${lane}: its days played, "The heat got too intense for me to wait around" - DFU's`);
  }
});

/** AUDIT REST II Q2's sweep: every clock the reading leaves a delay whose end moves, hides, kills, sends or closes
 *  something and whose wait the short wait cuts (more than ONLINE_DELAY_SECONDS declared, or a trip), read against
 *  the quest's own text by THE RULE - and the three it makes deadlines. Its verdicts, by hand. */
const SWEPT = {
  // deadlines - the text sets a time limit, and the end loses what it limits
  'R0C11Y03:2ndparton': 'deadline',   // "if you're not back in =2ndparton_ days, %g may forget you even left" (Q1)
  'S0000011:S.01': 'deadline',        // "Time is of the essence. I'm sure Gortwog will not wait long."
  'O0B00Y12:S.01': 'deadline',        // "It needs to be in ___contact1_ as soon as possible."
  'K0C00Y07:2ransom': 'deadline',     // AUDIT REST III D2: "The ransom must be paid in =2ransom_ days or they will kill _victim_" (a dead clock: its words)
  'B0B71Y03:finddaughter': 'deadline', // AUDIT REST III D2: "within =finddaughter_ days and I will tell you" (a dead clock: its words)
  // delays - a wait the text asks for, an arrival, a letter
  'A0C00Y10:S.00': 'delay',           // "Meet me at _inn_ in six hours" - the duel's hour (its window, `_S.01_`, a deadline)
  'A0C00Y10:S.02': 'delay',           // the challenger leaves to prepare ("I must prepare")
  'M0B11Y18:S.02': 'delay',           // the traitor "had already fled to his fortress" - the story's (T2)
  'M0B11Y18:S.03': 'delay',           // "_questgiver_ had to leave town quickly" - the note (35 minutes)
  'M0B21Y19:S.03': 'delay',           // the daughter's letter of thanks
  'S0000002:S.00': 'delay',           // Castellian arrives at his fort
  'S0000004:S.01': 'delay',           // the wedding news after the reward
  'S0000004:letterdelay': 'delay',
  'S0000008:brisiennafirstletter': 'delay',
  'S0000008:underkingletter': 'delay',
  'S0000010:S.04': 'delay',           // letter14, the agent placed
  'S0000012:2palace': 'delay',        // "In =2palace_ days %g is due to be at _palace_" - an arrival (the window, `_S.07_`, a deadline)
  'S0000013:S.04': 'delay',           // the queen's letter that offers the quest
  'S0000500:S.00': 'delay',           // K'avar's letters
  'S0000501:S.00': 'delay',
  'S0000502:S.00': 'delay',
  'S0000503:S.00': 'delay',           // the raven: "No time! No time!" - the letter itself; the month, `_S.02_`, a deadline
  'S0000503:keytime': 'delay',        // "I will need, say, =keytime_ days to take care of this business"
  '_BRISIEN:invitepc': 'delay',
  // delays - the story's own beat, no limit in the text (the limit it names is another clock, a deadline)
  'C0B00Y01:S.04': 'delay',           // the contact murdered; "in no more than =queston_ days" is `_queston_`'s
  'C0B00Y01:S.14': 'delay',           // the priest gone ("If _priest_ needs assistance, I will send for you")
  'R0C11Y26:1stparton': 'delay',      // the Ripper reaches the scholar first: "The Ripper had a meeting with _contact_ before I got there"
  'R0C11Y26:2ndparton': 'delay',
  'R0C11Y26:S.03': 'delay',           // "_hooker_'s admirer apparently came calling before I did"
  'R0C11Y28:1stparton': 'delay',      // "I got to _bookstore_ too late" - the Slayer's quest is written for it
  'R0C11Y28:2ndparton': 'delay',
  'N0B20Y02:S.12': 'delay',           // the trance ends
  'K0C0XY01:S.06': 'delay',           // the rescued mercenary walks home ("I know my way home from here")
  'K0C30Y03:S.27': 'delay',           // the map and the letter handed over
  'S0000006:S.04': 'delay',           // Greklith's beasts after the robe
  '40C00Y00:S.22': 'delay',           // Nocturnal's daedra after a betrayal - a punishment, no limit named
  'S0000100:S.01': 'delay', 'S0000101:S.01': 'delay', 'S0000102:S.01': 'delay', 'S0000103:S.01': 'delay', 'S0000104:S.01': 'delay',   // the assassins' line re-armed
  // delays - closings (AUDIT TIMEFREE T1)
  '40C00Y00:bonk': 'delay', 'A0C01Y06:S.13': 'delay', 'R0C10Y01:delay': 'delay', 'S0000002:S.15': 'delay', 'S0000007:delay': 'delay',
  'S0000502:outgoing': 'delay', 'S0000988:delay': 'delay', '_BRISIEN:oneday': 'delay',
};

test('AUDIT REST II Q2: the corpus swept once for the shape - a delay whose end moves, hides, kills, sends or closes something, where the text sets a time limit - every verdict pinned online (mutants: the chapter out of the table, the drop out of the table, the closing by hand back; AUDIT REST III D2: the ransom and the daughter out of it)', () => {
  const got = {};
  quiet(() => {
    for (const id of Object.keys(SWEPT)) {
      const [name, clock] = id.split(':');
      const q = parse(name, true);
      const c = q.resources.get(clock);
      assert.ok(c?.isClock, `${id} is a clock`);
      got[id] = c.isDeadline ? 'deadline' : 'delay';
      if (got[id] === 'delay') assert.equal(c.waitsShort, true, `${id}: online, the short wait`);
    }
  });
  assert.deepEqual(got, SWEPT);
});

// ═══ Q3 - the bounties held through the never-lapse build ═══
const TOWN = { px: 300, py: 200, name: 'Daggerfall' };
const allLand = () => true;
/** A posting on `day` (the board's own, for a level-5 hunter). */
const postingOn = (day) => boardPostings({ day, ...TOWN, level: 5, sites: bountySites(TOWN.px, TOWN.py, allLand) })[0];
/** The host, headless, on `now` (world minutes). */
const hostOn = (clock) => {
  const said = [];
  const host = createBountyHost({
    now: () => clock.m, level: () => 5, entity: () => ({ goldPieces: 0, items: [] }), townName: () => TOWN.name, siteOk: allLand,
    playerPixel: () => null, canStand: () => false, standPack: () => null, say: (l) => said.push(l), showNotice: () => true, openBoardWindow: () => {},
  });
  return { host, said };
};

test('AUDIT REST II Q3: the bounty ledger carries a version mark - a new ledger and a saved one have it; a record from before it reads as the old version; its held rows re-stamped once to now, kills kept, and never again (mutants: the mark not read, the re-stamp skipped, re-stamped every time)', () => {
  assert.equal(BOUNTY_LEDGER_VERSION, 2);
  assert.equal(newBountyLedger().v, BOUNTY_LEDGER_VERSION, 'a new ledger is this build\'s');
  const now = 900 * 1440 + 60;
  const old = { held: [{ id: `${899}.300.200.0.5`, takenAt: now - 3 * 1440, killed: 2 }, { id: `${900}.300.200.1.5`, takenAt: now - 60, killed: 0 }], paid: [], dropped: [] };
  const l = readBountyLedger(JSON.parse(JSON.stringify(old)));
  assert.equal(l.v, 1, 'no mark: written by a build before it');
  assert.deepEqual(restampNeverLapsed(l, now).map((h) => h.id), old.held.map((h) => h.id), 'every held row');
  assert.deepEqual(l.held.map((h) => [h.takenAt, h.killed]), [[now, 2], [now, 0]], 'each runs from now, its kills kept');
  assert.equal(l.v, BOUNTY_LEDGER_VERSION);
  assert.deepEqual(restampNeverLapsed(l, now + 5000), [], 'once');
  assert.equal(l.held[0].takenAt, now);
  const back = readBountyLedger(JSON.parse(JSON.stringify(l)));
  assert.equal(back.v, BOUNTY_LEDGER_VERSION, 'the mark rides the save');
  back.held[0].takenAt = now - 3 * 1440;
  assert.deepEqual(restampNeverLapsed(back, now), [], 'a ledger this build wrote is never re-stamped');
  assert.equal(back.held[0].takenAt, now - 3 * 1440);
});

test('AUDIT REST II Q3: the host - a ledger the never-lapse build wrote, held three days, loaded and played ONLINE keeps its bounty and its kills on the first tick and lapses a day on; the save carries the mark; OFFLINE it lapses as it always did and the mark waits for the first online tick (mutants: the re-stamp offline too, the re-stamp skipped, the host not asking)', () => {
  const day = 900;
  const p = postingOn(day - 3);
  const now = day * 1440 + 60;
  const rec = { held: [{ id: p.id, takenAt: now - 3 * 1440, killed: 2 }], paid: [], dropped: [], paidIds: [] };   // TIMEFREE's save: no mark
  try {
    const clock = { m: now };
    setSharedClock(() => clock.m);
    const on = hostOn(clock);
    on.host._reset(JSON.parse(JSON.stringify(rec)));
    on.host.tick(1);
    assert.deepEqual(on.host._ledger().held.map((h) => [h.id, h.takenAt, h.killed]), [[p.id, now, 2]], 'online: held, from now, its kills kept');
    assert.equal(on.host.held()[0].left, BOUNTY_LIFETIME_MINUTES, '...a full day to run');
    assert.equal(on.said.some((l) => /lapsed/.test(l)), false, 'nothing lapsed');
    assert.equal(JSON.parse(JSON.stringify(on.host._ledger())).v, BOUNTY_LEDGER_VERSION, 'the save carries the mark');
    clock.m += BOUNTY_LIFETIME_MINUTES;
    on.host.tick(1);
    assert.deepEqual(on.host._ledger().held, [], 'a day on, it lapses - QCLOCK-WORLD\'s rule');
    assert.ok(on.said.some((l) => /lapsed/.test(l)));
    // a ledger this build wrote is not re-stamped: held three days online, it lapses
    const mine = hostOn({ m: now });
    mine.host._reset({ ...JSON.parse(JSON.stringify(rec)), v: BOUNTY_LEDGER_VERSION });
    mine.host.tick(1);
    assert.deepEqual(mine.host._ledger().held, [], 'marked: no second re-stamp');
  } finally { setSharedClock(null); }
  const off = hostOn({ m: now });
  off.host._reset(JSON.parse(JSON.stringify(rec)));
  off.host.tick(1);
  assert.deepEqual(off.host._ledger().held, [], 'offline: untouched - it lapses');
  assert.equal(off.host._ledger().v, 1, '...and the mark waits for the first online tick');
});

test('AUDIT REST II Q4/Q5: no text says a deadline stays frozen online (REST8 has no freeze: it stays a deadline, on played time); the cites into quest/actions.js name their lines - getClassicSpellEffects and the template\'s setComplete, the ready-spell doors, CreateFoe\'s spawn (mutants: a cite put back)', () => {
  for (const f of ['src/systems/quest/clock.js', 'test/fb1003_bodyguard.test.js']) assert.doesNotMatch(rd(f), /stays? frozen/, `${f}: no "stays frozen"`);
  const raw = rd('src/systems/quest/actions.js'), actions = raw.split('\n');
  const at = (n) => actions[n - 1] ?? '';
  // CITE-ANCHOR: each cite names its line by a quote; the pin reads the line the quote names
  const line = (q, after) => resolveAnchor(maskAnchors(raw), actions, q, after ?? null).line ?? 0;
  const A = String.raw`"([^"]+)"(?:\.\."([^"]+)")?`;
  const cites = [
    ['bible/06-Systems/Quest-Arc.md', new RegExp(String.raw`\`actions\.js:${A}\`\/\`actions\.js:${A}\``)],
    ['test/questguards.test.js', new RegExp(String.raw`actions\.js:${A}\/actions\.js:${A}\) and the task can never fire`)],
    ['test/qx1_exterior_host.test.js', new RegExp(String.raw`actions\.js:${A}\/actions\.js:${A} - no effects`)],
    ['src/scenes/exterior.js', new RegExp(String.raw`actions\.js:${A}\/actions\.js:${A}\)`)],
  ];
  for (const [f, re] of cites) {
    const m = re.exec(rd(f));
    assert.ok(m, `${f} cites the pair`);
    assert.match(at(line(m[1], m[2])), /getClassicSpellEffects/, `${f}: "${m[1]}" is the effects lookup`);
    assert.match(at(line(m[3], m[4])), /this\.setComplete\(\);\s+\/\/ C#: the TEMPLATE completes/, `${f}: "${m[3]}" is the template's complete`);
  }
  for (const [f, re] of [['src/scenes/exterior.js', new RegExp(String.raw`\/\/ actions\.js:${A}\)\. This host`)], ['test/qx1_exterior_host.test.js', new RegExp(String.raw`\(actions\.js:${A} - C# subscribes`)]]) {
    const m = re.exec(rd(f));
    assert.ok(m, `${f} cites the doors`);
    assert.match(at(line(m[1], m[2])), /notifyNewReadySpell\/notifyCastReadySpell doors/, `${f}: "${m[1]}" is the ready-spell doors`);
  }
  // the range CreateFoe's spawn is placed in, named by its first line: CreatePendingFoeSpawn, which calls
  // CreateFoeGameObjects and, when they fail, completes and throws - as first written (1af82c5672). The shifts since had
  // carried the range's start onto the close of the tick above it, and this pin held that close; CITE-ANCHOR re-aimed
  // the cite. In encounters.js's comment the method's head may be named at its first line (the brace rule's nudge).
  const m = new RegExp(String.raw`systems\/quest\/actions\.js:${A} here\.`).exec(rd('src/systems/encounters.js'));
  assert.ok(m, 'encounters.js cites CreateFoe\'s range');
  const open = line(m[1], m[2]);
  assert.match(at(open), /_createPendingFoeSpawn\(world, foe\) \{|this\.pendingFoes = world\.createFoeGameObjects\(/, 'encounters.js: the range opens on CreatePendingFoeSpawn, which calls CreateFoeGameObjects');
  const thrown = actions.findIndex((l, i) => i >= open && /create foe attempted to create/.test(l)) + 1;
  assert.ok(thrown > open && thrown - open <= 10, '...and the range runs to its throw');
  assert.match(at(thrown - 1), /this\.setComplete\(\);/, '...which follows its complete');
});
