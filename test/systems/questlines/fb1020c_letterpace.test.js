// FB1020c LETTER-PACE (FIELD BUGS 2026-10-20c, the Discord: "assaulted w notes/quests" - "With the recent update ive
// received 4 different notes from townsfolk asking me to do things while in a town for 5 minutes"). Every questline
// opens with a courier's letter (`give pc <letter> notify`), and GivePc holds a letter until the player stands in a
// town, outdoors, by day (GivePc.cs:78-97) - then hands each over 40 to 500 ticks after the town is reached, so they
// "don't all arrive at once". The runner paced the lines' STARTS an hour apart (AUDIT QUESTLINES LINES-17), but every
// line it began at night (online the sky's night is half of every real hour), indoors or in the wild held its letter,
// and they all landed within a minute at the next town by day. LETTER-PACE made a line begin only when no begun line's
// first letter was still on its way, and an hour after the last letter arrived. PIN MOVED (QL-OFFERED,
// 2026-10-25, Lord Rumpkin: "every town I enter there is some courier ramming quest letters into my hand"; the owner: a
// questline is TAKEN, never SENT): no line begins unasked, and a first step's letter is in hand from the take - only a
// LATER step of a line the player took comes by courier, so the pace is the couriers': a later step sets out only when
// no begun line's letter is still on its way, and an hour after the last letter (the take's own among them) -
// qlLineRunner.js courierMay, letterOnItsWay, lettered; the layer's letter arm, qlLayer.js reward. The bridge below is
// the real one - the machine, the layer, the runner, GivePc - on the online clocks; the runner's own cases run over a
// fake machine holding the real scripts' quests.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createQuestBridge } from '../../../src/scenes/quest/questBridge.js';
import { createLineRunner, letterOnItsWay, STEP_GAP_S } from '../../../src/systems/questlines/qlLineRunner.js';
import { QL_LINES, lineStepOf } from '../../../src/systems/questlines/qlLines.js';
import { QUESTLINES_PREF, questlinesOn } from '../../../src/systems/questlines/qlLaw.js';
import { LOOT_RARITY_KEY } from '../../../src/systems/loot/lootRarity.js';
import { KINGS_GAMBIT_KEY } from '../../../src/systems/features.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { questSource, loadTables, packMachine, parsedQuest } from '../../qlSources.mjs';
import { starfallRuns } from '../../../src/net/starfall/starfallLaw.js';   // the run's wall clock held out of the festival

loadTables();
for (const k of [QUESTLINES_PREF, LOOT_RARITY_KEY, KINGS_GAMBIT_KEY, 'naval']) setPref(k, true);

/** The letter a step's quest hands over by courier: its `give pc <letter> notify` actions. */
const letterGives = (quest) => [...quest.tasks.values()].flatMap((t) => t.actions)
  .filter((a) => a.typeName === 'GivePc' && a.textId && quest.getItem(a.itemSymbol)?.itemName === 'letter');
/** QL-OFFERED: whether a step's start-up starts a task at once (`start task`) that puts a letter in hand (`get item`). */
const handedAtStart = (quest) => {
  const startup = [...quest.tasks.values()].find((t) => t.type === 'headless');
  const started = (startup?.actions ?? []).filter((a) => a.typeName === 'StartTask').map((a) => quest.getTask?.(a.taskSymbol));
  return started.some((t) => t?.actions?.some((a) => a.typeName === 'GetItem' && quest.getItem(a.itemSymbol)?.itemName === 'letter'));
};
/** A courier SENT as its script sends it: its clock started (`start timer _courier_`), or - a task with no clock of its
 *  own - its task fired (`start task`). */
const sendCourier = (quest) => {
  for (const task of quest.tasks.values()) {
    if (!task.actions.some((a) => letterGives(quest).includes(a))) continue;
    const clock = quest.getClock(task.symbol);
    if (clock) clock.startTimer(); else task.start();
  }
};
/** The start-up's `start timer` lines run, as the machine's first tick runs them (a fake machine's quests are parsed, never
 *  ticked). */
const startUp = (quest) => {
  const task = [...quest.tasks.values()].find((t) => t.type === 'headless');
  for (const a of task?.actions ?? []) if (a.typeName === 'StartStopTimer') a.update(task);
};
/** The later steps whose courier brings a letter (QL-OFFERED: the only couriers a line has). */
const LATER_COURIERS = ['QLBD02', 'QLBD03', 'QLBD05', 'QLCH03', 'QLWR03', 'QLWR04', 'QLHR02', 'QLSK02', 'QLSK03', 'QLSK04', 'QLOC03',
  'QLTF02', 'QLTF03', 'QLTF04', 'QLIS02', 'QLIS03', 'QLIW02'];

test('FB1020c LETTER-PACE (PIN MOVED, QL-OFFERED): no line\'s first step is sent - its start-up puts its letter in hand (`start task`, `get item`), so nothing of it is ever on its way; a later step\'s courier hands its letter over as `give pc <Item ... letter> notify`, on its way while held, not once given or set aside (mutants: textId, isComplete, the item\'s kind, the shelf)', () => {
  const machine = packMachine();
  // The Thirteenth of Frostfall opens IN PERSON - a Wyrd Sister hands her letter as she is met (QLTF01 `get item
  // _letter_`), or Morwen's raven its note once a star is held: neither at the start-up, neither by courier
  const IN_PERSON = new Set(['thirteenthFrostfall']);
  assert.equal(QL_LINES.length, 15);
  const couriers = [];
  for (const l of QL_LINES) {
    const { quest } = parsedQuest(l.steps[0].quest, machine);
    assert.equal(letterGives(quest).length, 0, `${l.steps[0].quest}: taken, never sent - no courier's letter`);
    assert.equal(letterOnItsWay(quest), false, `${l.steps[0].quest}: nothing on its way`);
    assert.equal(handedAtStart(quest), !IN_PERSON.has(l.id), `${l.steps[0].quest}: its letter in hand from the start-up`);
    for (const s of l.steps.slice(1)) {
      const later = parsedQuest(s.quest, machine).quest;
      if (letterGives(later).length) couriers.push([s.quest, later]);
    }
  }
  assert.deepEqual(couriers.map(([n]) => n), LATER_COURIERS, 'the couriers a line has: its later steps\'');
  for (const [name, quest] of couriers) {
    const gives = letterGives(quest);
    assert.equal(gives.length, 1, `${name}: one letter`);
    assert.equal(letterOnItsWay(quest), false, `${name}: a courier not sent yet is on no one's way (QLBD03's waits on the rite)`);
    sendCourier(quest);
    assert.equal(letterOnItsWay(quest), true, `${name}: sent, on its way until given`);
    quest.shelvedAt = 5;
    assert.equal(letterOnItsWay(quest), false, `${name}: set aside (QUEST-SHELF), it waits on no one`);
    quest.shelvedAt = null;
    gives[0].setComplete();
    assert.equal(letterOnItsWay(quest), false, `${name}: given`);
  }
  // a step whose only GivePc left is pay (`give pc _gold_`) holds no letter back
  const { quest } = parsedQuest('QLBD02', machine);
  for (const g of letterGives(quest)) g.setComplete();
  assert.ok([...quest.tasks.values()].flatMap((t) => t.actions).some((a) => a.typeName === 'GivePc' && !a.isComplete), 'its purse still to pay');
  assert.equal(letterOnItsWay(quest), false, 'the purse is no letter');
  assert.equal(letterOnItsWay(null), false);
});

/** A day the Witches' Festival is not running (net/starfall/starfallLaw.js starfallRuns). */
const OUT_OF_FESTIVAL_MS = Date.UTC(2026, 6, 1);

/** A quest's own dice, the same every run: mulberry32 seeded by an FNV-1a of its name. */
function seededRolls(name) {
  let a = 2166136261;
  for (const ch of String(name)) a = Math.imul(a ^ ch.charCodeAt(0), 16777619);
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The runner over a fake machine whose quests are the real scripts' (parsed headless), level 30 - online with a
 *  registered account's service where asked (the endgame lines' gate). `atSecond(...ids)`: each line taken, its first
 *  step ended well and its hour waited - a later step's courier is what is left to pace. */
function runnerOf({ online = false } = {}) {
  const pack = packMachine();
  let uid = 1;
  const machine = {
    quests: new Map(), questsToInvoke: [],
    scheduleQuestByName(name) { const q = parsedQuest(name, pack).quest; q.uid = uid++; machine.questsToInvoke.push(q); return q; },
    tick() { for (const q of machine.questsToInvoke.splice(0)) { machine.quests.set(q.uid, q); startUp(q); } },
  };
  const clock = { s: 400 * 86400 };
  const service = online ? { account: () => 'acct', guest: () => false, claim: async () => ({ ok: true, data: { opened: true } }) } : null;
  const runner = createLineRunner({ machine, service, ctx: { level: () => 30, online: () => online, nowSeconds: () => clock.s } });
  const step = () => { runner.look(); machine.tick(); };
  const named = (name) => [...machine.quests.values()].find((q) => q.questName === name && !q.questComplete) ?? null;
  const atSecond = (...ids) => {
    for (const id of ids) assert.equal(runner.takeLine(id).ok, true, id);
    step();
    for (const id of ids) {
      const q = named(QL_LINES.find((l) => l.id === id).steps[0].quest);
      q.questComplete = true;
      runner.ended(q, { id: 'done', failure: false });
    }
    clock.s += STEP_GAP_S;
  };
  return { runner, machine, clock, step, named, atSecond };
}

test('FB1020c LETTER-PACE (PIN MOVED, QL-OFFERED), the runner: a later step\'s letter still on its way holds every other line\'s next step however long it waits; given, the next sets out an hour after it - never an hour after the start (mutants: the wait unread; the hour from the letter; the arm\'s step guard; the step read)', () => {
  const { runner, clock, step, named, atSecond } = runnerOf({ online: true });
  atSecond('hourThatWasNot', 'introSea');
  step();
  const out = () => ['QLHR02', 'QLIS02'].filter((n) => named(n));
  assert.deepEqual(out(), ['QLHR02'], 'one courier on the first look');
  clock.s += 3 * STEP_GAP_S;   // three hours with its letter held (night, a dungeon, a shop)
  step();
  assert.deepEqual(out(), ['QLHR02'], 'no second while the first one\'s letter waits');
  const q = named('QLHR02');
  for (const g of letterGives(q)) g.setComplete();   // GivePc hands it over...
  runner.lettered(q);   // ...and the layer's letter arm tells the runner (qlLayer.js reward)
  assert.equal(runner.lineState('hourThatWasNot').lettered, clock.s);
  step();
  assert.deepEqual(out(), ['QLHR02'], 'not in the same breath as the letter');
  clock.s += STEP_GAP_S - 1;
  step();
  assert.deepEqual(out(), ['QLHR02'], 'nor within its hour');
  clock.s += 1;
  step();
  assert.deepEqual(out(), ['QLHR02', 'QLIS02'], 'an hour after the letter: the next courier');
});

test('FB1020c LETTER-PACE (PIN MOVED, QL-OFFERED), the runner: the take is a letter\'s moment - no courier sets out within its hour; a later step set aside in the journal (QUEST-SHELF) holds no other line back (mutants: the take\'s letter unstamped; the shelf read as held)', () => {
  const { runner, clock, step, named, atSecond } = runnerOf({ online: true });
  atSecond('hourThatWasNot');
  clock.s -= 1;
  runner.takeLine('introSea');   // taken a breath before the Prior's next step is due
  assert.equal(runner.lineState('introSea').lettered, clock.s, 'its letter in hand at the take');
  clock.s += 1;
  step();
  assert.equal(named('QLHR02'), null, 'no courier in the take\'s breath');
  clock.s += STEP_GAP_S;
  step();
  assert.ok(named('QLHR02'), 'an hour on');
  named('QLHR02').shelvedAt = clock.s;
  const sea = named('QLIS01');
  sea.questComplete = true;
  runner.ended(sea, { id: 'sailed', failure: false });
  clock.s += STEP_GAP_S;
  step();
  assert.ok(named('QLIS02'), 'the set-aside letter holds no one');
});

test('FB1020c LETTER-PACE, the runner: the save keeps when the last letter came - a load inside its hour starts no later step, an hour on it starts; an older save without it loads as no letter yet (mutants: restore drops `lettered`)', () => {
  const { runner, clock, step, named } = runnerOf();
  runner.restore({ introTables: { step: 1, outcomes: {}, done: false, wait: 0, claims: {}, begun: 1, lettered: clock.s - 60 } });
  assert.equal(runner.lineState('introTables').lettered, clock.s - 60, 'restored');
  assert.equal(runner.snapshot().introTables.lettered, clock.s - 60, 'and saved again');
  step();
  assert.equal(named('QLIT02'), null, 'inside the letter\'s hour: nothing starts');
  clock.s += STEP_GAP_S;
  step();
  assert.ok(named('QLIT02'), 'an hour on');
  runner.restore({ introTables: { step: 1, outcomes: {}, done: false, wait: 0, claims: {}, begun: 1 } });
  assert.equal(runner.lineState('introTables').lettered, 0, 'a save from before LETTER-PACE');
});

/** The real bridge as the game ticks it, online: a registered account (every line's gate), the short wait
 *  (ONLINE_DELAY_SECONDS), level 20. One tick a real second - the character's clock 12 s (TimeScale 12), the sky's 24 s
 *  (SKY_SEGMENTS, TimeScale 24) - from the sky's 01:00, the player in a town throughout. Answers each line's courier
 *  letter, in order: { quest, s } on the character's clock - and the bridge, and what reached the pack. QL-OFFERED:
 *  `lines`, the line runner's records a save brings (restored before the first tick, as a load restores them). */
function play(ticks, { lines = null } = {}) {
  const st = { s: 400 * 86400, sky: 400 * 86400 + 3600, letters: [], pack: [] };
  let bridge = null;
  const service = { account: () => 'acct', guest: () => false, claim: async () => ({ ok: true, data: { opened: true } }) };
  const warn = console.warn, realNow = Date.now;
  console.warn = () => {};
  // the wall clock the runner reads (qlLineRunner.js nowMs - the bridge hands it none) held out of the Witches' Festival
  // (2026-07-01: starfallRuns false): on a festival day The Thirteenth of Frostfall opens among the lines, in person and
  // with no courier's letter, and this run's count was the calendar's (star8_frostfall.test.js holds that line)
  Date.now = () => OUT_OF_FESTIVAL_MS;
  try {
    bridge = createQuestBridge({
      data: { readListTable: () => null, getQuestSourceLines: (n) => questSource(n, questlinesOn()) },
      classicSeconds: () => st.s, skySeconds: () => st.sky, worldSeconds: () => st.s, sharedClock: () => true,
      isPlayerInTown: () => true, questlineService: service,
      playerEntity: { name: 'Hero', level: 20, gender: 'female', career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills: new Array(35).fill(30), items: [] },
      giveItemToPlayer: (item) => { st.pack.push(item); }, offerReward: () => {},
      // the courier's word (GivePc's notify box), once a step's quest
      showPopup: (q) => { if (lineStepOf(q?.questName) && !st.letters.some((l) => l.quest === q.questName)) st.letters.push({ quest: q.questName, s: st.s }); },
      // the world's own part of `place npc` (no building to stand them in here), as ql12_lines' bridge does it; and each
      // quest's own dice (`rolls`, the machine's seam - GivePc's 40 to 500 ticks), seeded by its name: on Math.random the
      // letters a day holds ran from three to six, and the count below was a coin's
      onQuestStarted: (q) => {
        q.rolls = seededRolls(q.questName);
        for (const task of q.tasks.values()) for (const a of task.actions) if (a.typeName === 'PlaceNpc') a.isComplete = true;
      },
    });
    if (lines) bridge.questlines.runner.restore(lines);
    for (let i = 0; i < ticks; i++) { st.s += 12; st.sky += 24; bridge.tick(0.1); }
  } finally { console.warn = warn; Date.now = realNow; }
  return { letters: st.letters, bridge, pack: st.pack };
}

/** A save's line, taken, standing at a later step - the steps before it ended well, its next not yet begun. */
const standingAt = (step) => ({ step, outcomes: Object.fromEntries([...Array(step).keys()].map((i) => [i, { id: 'done', text: null }])), done: false, wait: 0, claims: {}, begun: 1, lettered: 0, taken: true });

test('FB1020c x QL-OFFERED, the real bridge online - THE REPORT\'S OWN LAW: a character in a town through the sky\'s night and eight hours of its day, every line\'s gate holding, is sent no questline letter at all - each line is on offer, none begun (mutants: look begins a line)', () => {
  const { letters, bridge } = play(900 + 2400);
  assert.deepEqual(letters, [], 'no courier, in a town, by day, all day');
  const rows = bridge.questLog().lines;
  assert.deepEqual(rows.filter((r) => r.state !== 'offered').map((r) => r.id), [], 'none begun');
  assert.ok(rows.length >= 10, `every line its gate opens is on offer: ${rows.map((r) => r.id).join(', ')}`);
});

test('FB1020c LETTER-PACE (PIN MOVED, QL-OFFERED), the real bridge online: the later steps of the lines the player took, set out while the town\'s letters wait (the sky\'s night), never land in one breath at dawn - an hour of the character\'s clock and more between any two questline letters - and they still come, one after another (mutants: the wait unread; the hour from the letter; the layer\'s arm; textId; isComplete)', () => {
  assert.equal(starfallRuns(OUT_OF_FESTIVAL_MS), false, 'the run\'s day is out of the Witches\' Festival');
  // five lines taken and standing at a step whose courier sets out at its start-up: the Doors (QLBD05 - QLBD02's coven
  // is a dungeon this bridge has no world to place), the Hour (QLHR02), the Ketch (QLSK02), the Coil (QLOC03), the sea
  // (QLIS02)
  const lines = { burningDoors: standingAt(4), hourThatWasNot: standingAt(1), skyKetch: standingAt(1), oldCoil: standingAt(2), introSea: standingAt(1) };
  const { letters } = play(900 + 2400, { lines });   // six sky hours to dawn, then 2,400 real seconds of day (eight hours of the character's)
  const gaps = letters.slice(1).map((l, i) => l.s - letters[i].s);
  assert.ok(letters.length >= 4, `the lines still begin: ${letters.map((l) => l.quest).join(', ')}`);
  assert.ok(gaps.every((g) => g >= STEP_GAP_S), `an hour apart on the character's clock: ${gaps.join(', ')}`);
});
