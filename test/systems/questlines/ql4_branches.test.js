// QL4 (bible/06-Systems/Questlines-Arc.md sections 2.3 and 3): A FLAGSHIP QUEST'S BRANCH, RUN. M0B50Y09 (the Fighters
// Guild's gargoyle) carries the hand-in branch (tools/qlPatchKit.mjs): with the switch on, the questor asks how the
// player takes their pay, and the two answers end it differently - the fee as agreed, or the fee waived for the Guild's
// name (its standing, its outcome, no gold, the choice of gear still). With the switch off the script is DFU's: no
// question, the fee paid. Driven through the real bridge over the pack as the game reads it (test/qlSources.mjs).
// AUDIT QUESTLINES: every patched branch's ways run to their ends here too - what each answer gives (the knights' gold,
// DFU's own box kept where it pays nothing, the story said where the box was the story), the kit that cuts a hand-in
// (tools/qlPatchKit.mjs), and the sheets' ends the lanes found settling wrong (LAW-1, LAW-7, LAW-8, LAW-9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createQuestBridge } from '../../../src/scenes/quest/questBridge.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { QUESTLINES_PREF, questlinesOn } from '../../../src/systems/questlines/qlLaw.js';
import { questSource, loadTables, ROOT } from '../../qlSources.mjs';
import { QlAsk } from '../../../src/systems/questlines/qlActions.js';
import { QL_PATCHES } from '../../../src/systems/questlines/qlPatches.js';
import { sheetFor } from '../../../src/systems/questlines/qlSheets.js';
import { holds } from '../../../src/systems/questlines/qlLaw.js';
import { handinPatches, ASK_ROW, CHOICE_CHARS } from '../../../tools/qlPatchKit.mjs';

loadTables();
const FIGHTERS_GUILD = 41;   // Quests-Factions.txt The_Fighters_Guild

function run({ on, answer }) {
  setPref(QUESTLINES_PREF, on);
  const asked = [], rep = [], rewards = [], offers = [], popups = [];
  const skills = new Array(35).fill(30);
  const bridge = createQuestBridge({
    data: {
      readListTable: (name) => { try { return readFileSync(join(ROOT, 'vendor/dfu-quests/Tables', `QuestList-${name}.txt`), 'utf8'); } catch { return null; } },
      getQuestSourceLines: (n) => questSource(n, questlinesOn()),   // the pack's read: the branch while the switch is on
    },
    classicSeconds: () => 0,
    playerEntity: { name: 'Hero', level: 12, gender: 'female', career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills },
    showChoice: (q, message, choices, respond) => asked.push({ message, choices, respond }),
    changeReputation: (fid, amount) => rep.push([fid, amount]),
    offerReward: (_q, item) => rewards.push(item),
    onQuestlineOffer: (o) => offers.push(o),
    showPopup: (_q, tokens) => popups.push(tokens.map((t) => t.text).join(' ')),
  });
  const quest = bridge.machine.startQuestByName('M0B50Y09', FIGHTERS_GUILD);   // the Guild's own quest, as its questor gives it
  // the world's part of the script - the gargoyle stood in its dungeon's markers - is no part of this pin: with no world
  // there is no dungeon to stand it in, so its placing is done by hand and every other line runs as written
  for (const task of quest.tasks.values()) for (const a of task.actions) if (a.typeName === 'PlaceFoe') a.isComplete = true;
  quest.getTask({ name: 'S.01' }).start();      // the gargoyle is dead
  quest.getTask({ name: 'qgclicked' }).start(); // the questor clicked
  bridge.machine.tick();
  if (answer != null) { assert.equal(asked.length, 1, 'asked once'); asked[0].respond(answer); }
  for (let i = 0; i < 4; i++) bridge.machine.tick();
  // the reward's timer (`start timer _end_`) ends it: run it out
  quest.getClock({ name: 'end' })?.endTimer?.();
  quest.getTask({ name: 'end' })?.start();
  for (let i = 0; i < 6; i++) bridge.machine.tick();
  return { quest, asked, rep, rewards, offers, popups };
}

test('QL4 the branch, switch off: DFU\'s gargoyle - no question, the fee paid, no outcome, no standing added', () => {
  const r = run({ on: false, answer: null });
  assert.equal(r.asked.length, 0, 'never asked');
  assert.equal(r.quest.ql, null, 'DFU\'s quest');
  assert.equal(r.rewards.length, 1, 'the fee');
  assert.equal(r.quest.tasks.has('qlask'), false, 'the script as shipped');
  assert.deepEqual(r.rep, [[FIGHTERS_GUILD, 5]], 'DFU\'s +5 for a quest done, and nothing else');
});

test('QL4 the branch, the fee: asked in the quest\'s own words, the fee paid, the outcome its own, the choice of gear made', () => {
  const r = run({ on: true, answer: 0 });
  assert.equal(r.asked[0].message.id, 1900);
  assert.deepEqual(r.asked[0].choices.map((c) => c.id), [1901, 1902]);
  assert.equal(r.rewards.length, 1, 'the fee, through RW1\'s door');
  assert.ok(r.popups.some((p) => /fee of/.test(p)), 'the script\'s own QuestComplete box over its fee');
  assert.equal(r.quest.ql.choices.payment, 'keep');
  assert.equal(r.quest.ql.outcome, 'fee');
  assert.deepEqual(r.rep, [[FIGHTERS_GUILD, 5]], 'DFU\'s +5 alone - the fee moves no standing');
  assert.equal(r.offers.length, 1);
});

test('QL4 the branch, waived: no gold, the Guild\'s standing raised by the outcome, and the choice of gear still made', () => {
  const r = run({ on: true, answer: 1 });
  assert.equal(r.rewards.length, 0, 'no fee');
  assert.equal(r.quest.ql.choices.payment, 'alt');
  assert.equal(r.quest.ql.outcome, 'waived');
  assert.ok(r.quest.questComplete && r.quest.questSuccess, 'ended a success - `ql paid`');
  assert.ok(!r.popups.some((p) => /fee of/.test(p)), 'and quietly: no QuestComplete box paying a fee the player waived');
  assert.deepEqual(r.rep.sort(), [[FIGHTERS_GUILD, 5], [FIGHTERS_GUILD, 5]].sort(), 'DFU\'s +5 and the outcome\'s +5');
  assert.equal(r.offers.length, 1, 'the questlines pay their choice of gear either way');
  assert.equal(r.offers[0].outcome, 'waived');
});

// ---- every way, run: a bridge that records what the player got, the world's placing done by hand (no world in node)
function rig({ on = true } = {}) {
  setPref(QUESTLINES_PREF, on);
  const rec = { asked: [], rep: [], legal: [], rewards: [], offers: [], popups: [] };
  let now = 1000;
  const bridge = createQuestBridge({
    data: {
      readListTable: (name) => { try { return readFileSync(join(ROOT, 'vendor/dfu-quests/Tables', `QuestList-${name}.txt`), 'utf8'); } catch { return null; } },
      getQuestSourceLines: (n) => questSource(n, questlinesOn()),
    },
    classicSeconds: () => now, nowSeconds: () => now, worldSeconds: () => now,
    playerEntity: { name: 'Hero', level: 12, gender: 'female', career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills: new Array(35).fill(30) },
    carriesQuestItem: () => true, showPrompt: (_q, _m, respond) => respond(true),
    showChoice: (_q, message, choices, respond) => rec.asked.push({ message, choices, respond }),
    changeReputation: (fid, amount) => rec.rep.push([fid, amount]), changeLegalRep: (n) => rec.legal.push(n),
    offerReward: (_q, item) => rec.rewards.push(item), onQuestlineOffer: (o) => rec.offers.push(o),
    showPopup: (_q, tokens) => rec.popups.push(tokens.map((t) => t.text).join(' ').replace(/\s+/g, ' ')),
  });
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { now += 60; bridge.machine.tick(); bridge.questlines.look(); } };
  return { bridge, rec, tick };
}
const WORLD = ['PlaceFoe', 'PlaceNpc', 'CreateNpcAt', 'CreateFoe', 'PlaceItem', 'CreateNpc'];
/** `name` started, its ask forced as its own condition would, answered `choice`, and run to its end (the clocks its answer
 *  starts run out). */
function answer(name, choice, before = () => {}) {
  const { bridge, rec, tick } = rig();
  const quest = bridge.machine.startQuestByName(name, FIGHTERS_GUILD);
  for (const t of quest.tasks.values()) for (const a of t.actions) if (WORLD.includes(a.typeName)) a.isComplete = true;
  tick(3);
  before(quest);
  const running = new Set([...quest.resources.values()].filter((r) => r.isClock && r.clockEnabled && !r.clockFinished).map((r) => r.symbol.name));
  for (const t of quest.tasks.values()) {
    if (!t.actions.some((a) => a instanceof QlAsk)) continue;
    for (const a of t.actions) if (a.isTriggerCondition || a.isAlwaysOnTriggerCondition) a.isComplete = true;
    t.start();
  }
  tick(1);
  assert.equal(rec.asked.length, 1, `${name}: asked once`);
  rec.asked[0].respond(choice);
  tick(6);
  for (let r = 0; r < 3; r++) {
    for (const c of quest.resources.values()) {
      if (!c.isClock || !c.clockEnabled || c.clockFinished || running.has(c.symbol.name)) continue;
      c.remainingTimeInSeconds = 0; c._triggerTask(quest); c.clockEnabled = false; c.clockFinished = true;
    }
    tick(6);
  }
  return { quest, rec };
}
const gold = (rec) => rec.rewards.filter((i) => /gold/i.test(i?.shortName ?? i?.name ?? '')).map((i) => i.stackCount);

test('QL4 BRANCH-4 M0B50Y09: the fee waived keeps DFU\'s map - the second answer has its own copy of the task that reads the reward (mutants: the reader not copied; the copy reading the reward task still)', () => {
  const drawMap = (quest) => { quest.getTask({ name: 'map' }).start(); quest.getTask({ name: 'nomap' }).clear(); };
  for (const [choice, task] of [[0, 'S.06'], [1, 'qlaltS06']]) {
    const { quest, rec } = answer('M0B50Y09', choice, drawMap);
    const t = quest.getTask({ name: task });
    assert.ok(t?.getTriggerValue(), `${task} ran`);
    assert.ok(t.actions.find((a) => a.typeName === 'RevealLocation')?.isComplete, 'the second dungeon revealed');
    assert.ok(rec.popups.some((p) => /map to .* will sweeten/.test(p)), 'and DFU\'s 1080 said');
  }
});

test('QL4 BRANCH-5 / REWARD-4 the knights\' hand-ins: "take it" gives the gold it offers - DFU\'s formula, the outcome\'s factor - and the refusal none, with DFU\'s own QuestComplete box on both ways where DFU pays nothing (mutants: the keep\'s `give pc nothing` restored; the refusal\'s `ql paid` restored)', () => {
  for (const name of ['B0B40Y09', 'B0B40Y08', 'B0B60Y12', 'B0B80Y17']) {
    const keep = answer(name, 0), alt = answer(name, 1);
    assert.equal(keep.quest.ql.choices[Object.keys(keep.quest.ql.choices)[0]], 'keep');
    assert.equal(gold(keep.rec).length, 1, `${name}: the purse is gold`);
    assert.ok(gold(keep.rec)[0] > 1, `${name}: of DFU's formula`);
    assert.deepEqual(gold(alt.rec), [], `${name}: the refusal takes nothing`);
    for (const r of [keep, alt]) assert.ok(r.quest.questSuccess && r.rec.popups.length === 1, `${name}: a success, DFU's own box said once`);
    assert.equal(keep.rec.popups[0], alt.rec.popups[0], `${name}: the same box either way - it pays nothing`);
    assert.equal(keep.rec.offers.length + alt.rec.offers.length, 2, 'the choice of gear both ways');
  }
});

test('QL4 BRANCH-6 a refusal whose DFU box was the story says the story in its own words (19xx), in the quest\'s voice (mutants: a refusal\'s `say 1903` dropped)', () => {
  for (const [name, words] of [['L0A01L00', /full member of the Dark Brotherhood/], ['P0A01L00', /Welcome to the family/], ['B0B70Y14', /duped by a rogue mage/], ['A0C01Y03', /Kindness! Of course/], ['B0B70Y16', /dragonslayer/], ['B0B50Y11', /A well it shall be/]]) {
    const { quest, rec } = answer(name, 1);
    assert.ok(quest.questSuccess, `${name}: a success`);
    assert.ok(rec.popups.some((p) => words.test(p)), `${name}: ${words} said - ${JSON.stringify(rec.popups)}`);
  }
});

test('QL4 BRANCH-13 the ways that end as the sheet says: A0C01Y13\'s magistrate a success (`ql paid`), the legal standing its sheet gives; K0C01Y10\'s scroll burned and P0B01L02\'s relic kept the questor\'s failures, said so (mutants: A0C01Y13\'s `ql paid` dropped; `burned` or `kept` a success)', () => {
  const lawful = answer('A0C01Y13', 1);
  assert.ok(lawful.quest.questSuccess, 'the lover is home - a success');
  assert.equal(lawful.quest.ql.outcome, 'lawful');
  assert.deepEqual(lawful.rec.legal, [5]);
  for (const [name, id] of [['K0C01Y10', 'burned'], ['P0B01L02', 'kept']]) {
    const r = answer(name, 1);
    assert.equal(r.quest.questSuccess, false, `${name}: DFU's failure`);
    assert.equal(r.quest.ql.outcome, id);
    assert.equal(sheetFor(name).outcomes.find((o) => o.id === id).failure, true, `${name}: and the sheet says so`);
    assert.equal(r.rec.offers.length, 0);
  }
});

test('QL4 BRANCH-4/6/8/15 the hand-in kit: refuses a quest already branched (unless --replace) and a reward another task reads (unless --readers copy), wraps the question a row of ASK_ROW, refuses a long answer, keeps DFU\'s `give pc nothing` on the refusal - and cuts M0B50Y09\'s filed branch exactly (mutants: the guard on the script\'s text; the readers unread; the question one row; the refusal always `ql paid`)', () => {
  const words = { ask: 'The merchant\'s purse is light for a gargoyle, %pcf. How will you take your pay?', keep: 'The fee, as agreed.', alt: 'Waive it for the Guild\'s name.' };
  assert.throws(() => handinPatches('M0B50Y09', '_victory_', words), /already carries a questlines branch/);
  assert.throws(() => handinPatches('M0B50Y09', '_victory_', words, { replace: true }), /_victory_ is read by _S\.06_ \("when _map_ and _victory_"\)/);
  const cut = handinPatches('M0B50Y09', '_victory_', words, { replace: true, readers: 'copy' });
  assert.deepEqual(cut, QL_PATCHES.get('M0B50Y09').map((p) => ({ ...p })), 'the filed branch is the kit\'s');
  assert.match(cut[2].new, /_qlaltS06_ task:\n\twhen _map_ and _qlalt_\n\treveal _newdung_ readmap\n\tsay 1080/);
  const rows = /Message: {2}1900\n((?:<ce> [^\n]+\n)+)/.exec(cut[1].new)[1].trim().split('\n');
  assert.ok(rows.length > 1 && rows.every((r) => r.length - 5 <= ASK_ROW), `wrapped: ${JSON.stringify(rows)}`);
  assert.throws(() => handinPatches('M0B50Y09', '_victory_', { ...words, alt: 'x'.repeat(CHOICE_CHARS + 1) }, { replace: true, readers: 'copy' }), /over 30 characters/);
  const knight = handinPatches('B0B40Y08', '_success_', { ask: 'Q?', keep: 'Keep', alt: 'Alt' }, { replace: true });
  assert.match(knight[2].new, /_qlaltpath_ task:\n\twhen _qlalt_\n\tgive pc nothing\n/);
});

/** The rows of `name`'s sheet that hold as it ends, and what it settled. */
function settle(name, drive) {
  const { bridge, rec, tick } = rig();
  const quest = bridge.machine.startQuestByName(name, 0);
  for (const t of quest.tasks.values()) for (const a of t.actions) if (!a.isTriggerCondition) { const up = a.update.bind(a); a.update = (c) => { try { up(c); } catch { a.setComplete(); } }; }
  const sheet = sheetFor(name);
  let held = null;
  const ending = bridge.questlines.ending.bind(bridge.questlines);
  bridge.questlines.ending = (q) => { held ??= sheet.outcomes.filter((o) => holds(q, o.on, { ending: true })).map((o) => o.id); return ending(q); };
  drive(quest, tick, bridge);
  return { quest, rec, held, history: bridge.questlines.history() };
}

test('QL1 LAW-1 M0B11Y18: the letter to the Queen, her hunt taken and run out of days - the Queen\'s man (`outrun`, her +2, the gear), never the traitor\'s (mutants: the row dropped - the fallback guessed)', () => {
  const r = settle('M0B11Y18', (q, tick) => {
    const once = (task, type) => { const a = q.getTask({ name: task }).actions.find((x) => x.typeName === type); a.checkTrigger = () => { a.checkTrigger = () => false; return true; }; };
    tick(2);
    q.resources.get('S.02').remainingTimeInSeconds = 0; tick(2);   // the traitor leaves for his fortress
    once('S.16', 'TotingItemAndClickedNpc'); tick(4);                // the letter to the Queen: her gold (_S.18_)
    q.resources.get('gettraitor').remainingTimeInSeconds = 0; tick(6);   // her hunt taken; the traitor not caught in time
  });
  assert.ok(r.quest.questSuccess);
  assert.deepEqual(r.quest.ql.choices, { letter: 'queen', hunt: 'hunt' });
  assert.deepEqual(r.held, ['outrun', 'failed'], 'its own row holds - no fallback read');
  assert.equal(r.quest.ql.outcome, 'outrun');
  assert.deepEqual(r.rec.rep.filter(([f]) => f === 380), [[380, 2]], 'Queen Akorithi +2');
  assert.equal(r.rec.offers.length, 1);
});

test('QL1 LAW-9 M0B40Y05: the spriggan killed and never reported - DFU\'s failure, filed as one; the ladder strikes nothing (mutants: `slain` bound to the kill again)', () => {
  const r = settle('M0B40Y05', (q, tick) => {
    tick(2);
    q.resources.get('monster').killCount = 1; tick(2);
    const c = q.resources.get('2dung'); c.clockEnabled = false; c.clockFinished = true; q.getTask({ name: '2dung' }).start(); tick(4);
  });
  assert.equal(r.quest.questSuccess, false);
  assert.equal(r.quest.ql.outcome, 'failed');
  assert.deepEqual(r.history, {});
});

test('QL1 LAW-7 40C00Y00: Nocturnal\'s Key paid, `_bonk_` ends it - `done` holds at its own end, not by the yield (mutants: `done` bound to `_S.06_` again, which unsets what it waits on)', () => {
  const r = settle('40C00Y00', (q, tick) => {
    tick(2);
    q.resources.get('monster').killCount = 1; tick(2);
    const click = q.getTask({ name: 'S.04' }).actions.find((a) => a.typeName === 'ClickedNpc');
    click.checkTrigger = () => true; tick(1); click.checkTrigger = () => false; tick(3);
    q.resources.get('bonk').remainingTimeInSeconds = 0; tick(4);
  });
  assert.deepEqual(r.held, ['done', 'failed']);
  assert.equal(r.quest.ql.outcome, 'done');
});

test('QL1 LAW-8 $CUREWER: cured at the temple before the hunt came - `healed`, no failure (mutants: the row dropped)', () => {
  const r = settle('$CUREWER', (q, tick, bridge) => {
    tick(2);
    q.getTask({ name: 'readletter' }).start(); tick(2);
    for (const x of [...bridge.machine.quests.values()]) if (x.questName === '$CUREWER' && !x.questTombstoned) bridge.machine.tombstoneQuest(x, { ended: true });
  });
  assert.equal(r.quest.ql.outcome, 'healed');
  assert.equal(sheetFor('$CUREWER').outcomes.find((o) => o.id === 'healed').failure, undefined);
});

