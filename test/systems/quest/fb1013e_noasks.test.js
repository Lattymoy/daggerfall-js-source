// NO-ASKS-AGAIN (FIELD BUGS 2026-10-13e, "Cant complete quest 'the lost child'": "I found the child in the dungeon,
// interacted with it, accidentally said 'no' when it asked me to get it, and now i cant interact with it at all. Tried
// restarting the game, didnt help." - NPC Carolayne Copperton).
//
// K0C00Y05's `_S.07_ task: clicked npc _child_` / `prompt 1017 yes _S.09_ no _no_`, and `variable _no_` that nothing
// reads: DFU asks once (Prompt.cs allowRearm = false), a set task's click trigger is never read again (ClickedNpc.cs,
// Task.cs Update), nothing clears `_S.07_`, and the flags are saved - DFU's own soft-lock, ported faithfully. The
// departure (systems/quest/noAsksAgain.js, Port-Ledger A): a No that leads nowhere asks again, on the next click.
//
// Every fixture from its producer (TEST THE SHAPE THE PRODUCER MINTS): the vendored scripts whole through the real parser
// and machine, over a crafted world their Places and People resolve in (the shape of test/systems/quest/questplaces.test.js's); every
// click through the scene's own door (QuestResourceBehaviour.doClick), every answer through the box's own callback (the
// machine's showPrompt hook), an injury through the behaviour's own update over an enemy, a save through the machine's
// own envelope and restore.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { QuestResourceBehaviour } from '../../../src/systems/quest/resourceBehaviour.js';
import { mapPixelToWorldCoord } from '../../../src/formats/mapsFile.js';
import { inertNo, asksOnAClick, promptsThatAskAgain, CLICK_TRIGGERS } from '../../../src/systems/quest/noAsksAgain.js';

const ROOT = new URL('../../../', import.meta.url);
const rd = (p) => readFileSync(new URL(p, ROOT), 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(new URL('vendor/dfu-quests/Tables/', ROOT))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = rd(`vendor/dfu-quests/Tables/${f}`);
  loadQuestTables(sources);
}
const script = (name) => rd(`vendor/dfu-quests/Quests/${name}.txt`).split(/\r?\n/);

// ---- one region: two towns (the player's and another) and two dungeons, MapsFile/BlocksFile-shaped ----

const flat = (record) => ({ textureArchive: 199, textureRecord: record, xPos: 40, yPos: 8, zPos: 60 });
const building = (buildingType, factionId = 0, nameSeed = 777) => ({ buildingType, factionId, nameSeed, locationId: 0, sector: 0, quality: 9 });
const FACTIONS = new Map([
  [41, { id: 41, type: 2, name: 'The Fighters Guild', race: -1 }],
  [242, { id: 242, type: 2, name: 'Nobles', race: -1 }],
  [510, { id: 510, type: 2, name: 'The Merchants', race: -1 }],
  [514, { id: 514, type: 2, name: 'Children', race: -1 }],
  [201, { id: 201, type: 15, name: 'People of Testshire', race: -1 }],
  [867, { id: 867, type: 14, name: 'Court of Testshire', race: -1 }],
]);
/** Each town's one block: two taverns, six houses, a Fighters Guild hall, two general stores, a palace - each with a
 *  spawn and an item marker. */
const BLOCK_BUILDINGS = [15, 15, 18, 17, 17, 18, 18, 11, 9, 9, 16].map((t) => building(t, t === 11 ? 41 : 0));
const RMB = {
  position: 5000,
  rmbBlock: {
    fldHeader: { buildingDataList: BLOCK_BUILDINGS, otherNames: null },
    subRecords: BLOCK_BUILDINGS.map(() => ({ interior: { blockFlatObjectRecords: [flat(11), flat(18)] } })),
  },
};
/** The directory's named buildings (houses are not named), in the block's order. */
const DIRECTORY = [building(15, 0, 701), building(15, 0, 702), building(11, 41, 703), building(9, 0, 704), building(9, 0, 705), building(16, 0, 706)];
const RDB = {
  position: 9000,
  rdbBlock: { objectRootList: [{ rdbObjects: [11, 18, 11].map((record, i) => ({ type: 3, position: 100 + i * 8, xPos: 10 + i, yPos: 4, zPos: 20 + i, resources: { flatResource: { textureArchive: 199, textureRecord: record } } })) }] },
};
const location = (locationIndex, name, mapId, locationType, dungeonType) => {
  const town = dungeonType < 0, at = mapPixelToWorldCoord(100 + locationIndex, 100);
  return {
    loaded: true, regionIndex: 0, regionName: 'Testshire', name, locationIndex, hasDungeon: !town,
    mapTableData: { mapId, locationType, dungeonType },
    exterior: {
      buildings: town ? DIRECTORY : [],
      recordElement: { header: { x: at.x, y: at.y } },
      exteriorData: { locationId: 0x400 + locationIndex, width: town ? 1 : 0, height: town ? 1 : 0, blockNames: town ? ['TESTAA00.RMB'] : [] },
    },
    dungeon: town ? null : { blocks: [{ x: 0, z: 0, blockName: 'TESTDA00.RDB' }] },
  };
};
const LOCATIONS = [location(0, 'Bigtown', 111, 0, -1), location(1, 'Smallville', 222, 2, -1), location(2, 'Darkhole', 333, 7, 1), location(3, 'Deephole', 444, 7, 2)];
const REGION = { name: 'Testshire', locationCount: LOCATIONS.length, mapTable: LOCATIONS.map((l) => ({ ...l.mapTableData })) };
const WORLD = {
  maps: {
    regionCount: 1, getRegion: () => REGION, getLocation: (r, l) => LOCATIONS[l] ?? null,
    getLocationByName: (rn, ln) => LOCATIONS.find((l) => l.name === ln) ?? null,
    getRmbBlockName: () => 'TESTAA00.RMB', readLocationIdFast: (r, l) => LOCATIONS[l].exterior.exteriorData.locationId, getClimateIndex: () => 231,
  },
  getBlock: (n) => ({ 'TESTAA00.RMB': RMB, 'TESTDA00.RDB': RDB })[n] ?? null,
  currentLocation: () => LOCATIONS[0], currentRegionIndex: () => 0, currentLocationIndex: () => 0, currentRegionName: () => 'Testshire',
  isPlayerInLocationRect: () => true, playerInside: () => null, isHouseOwned: () => false, playerPixel: () => ({ x: 100, y: 100 }),
  buildingNameOpts: () => ({}), discoverLocation() {},
  getFactionData: (id) => FACTIONS.get(id) ?? null, findFactionsOfType: (t) => [...FACTIONS.values()].filter((f) => f.type === t),
  currentRegionPeople: () => 201, currentRegionCourt: () => 867, currentRegionFaction: () => 201, currentRegionRace: () => 3,
};

/** A machine over the world whose hooks record what the player sees: the boxes asked (and their answers), the popups,
 *  the faces, the standing changed. */
function machine(lines) {
  const seen = { prompts: [], popups: [], faces: [], rep: [] };
  const m = new QuestMachine({
    nowSeconds: () => 0, world: WORLD, getQuestSourceLines: () => lines,
    showPrompt: (q, message, respond) => seen.prompts.push({ id: message.id, respond }),
    showPopup: (q, tokens) => seen.popups.push(tokens.map((t) => t.text ?? '').join('|')),
    addFace: (r) => seen.faces.push(r.symbol.name),
    getReputation: () => 0, changeReputation: (f, n) => seen.rep.push(n), giveItemToPlayer() {},
  });
  m.seen = seen;
  return m;
}
/** The quest scheduled and started; its draws off one seeded die (Park-Miller), so a run is the same run every time. */
function start(name, seed, lines = script(name)) {
  const m = machine(lines);
  let s = seed;
  const q = m.scheduleQuest(lines, 0, { rolls: () => { s = (s * 16807) % 2147483647; return s / 2147483647; } });
  m.tick(); m.tick();
  assert.equal(m.quests.get(q.uid), q, `${name} is running`);
  return { m, q };
}
const ticks = (m, n = 3) => { for (let i = 0; i < n; i++) m.tick(); };
/** A click on a quest Person as the scene's object takes it: its behaviour's DoClick. */
function clicker(m, q, name) {
  const b = new QuestResourceBehaviour(m);
  b.assignResource(q.getResource({ name }));
  assert.equal(b.cacheTarget(), true);
  return () => { assert.equal(b.doClick(), true, 'the quest takes the click (no talk window)'); m.tick(); };
}
/** The box on screen answered, as its button does, then the quest runs on. */
function answer(m, yes) {
  const box = m.seen.prompts.at(-1);
  assert.ok(box && !box.answered, 'a box is up');
  m.tick();   // the box stays up a moment - the quest ticks under it
  box.answered = true;
  box.respond(yes);
  ticks(m);
}
const task = (q, name) => q.getTask({ name });
const promptOf = (q, owner) => task(q, owner).actions.find((a) => a.typeName === 'Prompt');
/** The quest's whole state as its tasks hold it: each task's set and each action's complete (the start-up block by its
 *  place - its symbol is the allocator's next number). */
const state = (q) => [...q.tasks.values()].map((t) => [t.type === 'headless' ? '(start-up)' : t.symbol.name, t.getTriggerValue(), t.actions.map((a) => a.isComplete)]);

test('NO-ASKS-AGAIN: The Lost Child asks again after a No - the next click (and only a click) shows "Do you take _child_?" again, as often as it is refused; a Yes then runs as a first Yes does, and is final (mutants: the asking task left set, the prompt left complete, the No left set, re-armed before the answer, no tick door)', () => {
  // the control: a first-time Yes
  const yes = start('K0C00Y05', 1);
  assert.ok(yes.q.getResource({ name: 'child' }).isHidden === false && task(yes.q, 'S.01').getTriggerValue(), 'the child stands in the dungeon (`_S.01_`, `place npc _child_ at _mondung_`)');
  const clickYes = clicker(yes.m, yes.q, 'child');
  clickYes();
  assert.deepEqual(yes.m.seen.prompts.map((p) => p.id), [1017]);
  const popupsBefore = yes.m.seen.popups.length;
  answer(yes.m, true);

  // the report: a No, then the child clicked again and again
  const { m, q } = start('K0C00Y05', 1);
  const click = clicker(m, q, 'child');
  click();
  assert.deepEqual(m.seen.prompts.map((p) => p.id), [1017], 'the click asks');
  answer(m, false);
  assert.equal(task(q, 'S.07').getTriggerValue(), false, 'the asking task listens again');
  assert.equal(promptOf(q, 'S.07').isComplete, false, 'the prompt is armed again');
  assert.equal(task(q, 'no').getTriggerValue(), false, 'the No is forgotten');
  ticks(m, 5);
  assert.equal(m.seen.prompts.length, 1, 'nothing asks without a click');
  click();
  assert.deepEqual(m.seen.prompts.map((p) => p.id), [1017, 1017], 'the next click asks again');
  answer(m, false);
  click();
  assert.deepEqual(m.seen.prompts.map((p) => p.id), [1017, 1017, 1017], 'and again, after a second No');
  const popupsBeforeYes = m.seen.popups.length;
  answer(m, true);

  assert.equal(task(q, 'S.09').getTriggerValue(), true, 'Yes: `_S.09_`');
  assert.equal(q.getResource({ name: 'child' }).isHidden, true, '`hide npc _child_`');
  assert.deepEqual(m.seen.faces, ['child'], '`add _child_ face`, once');
  assert.deepEqual(m.seen.popups.slice(popupsBeforeYes), yes.m.seen.popups.slice(popupsBefore), '`say 1015`, the same words');
  assert.deepEqual(state(q), state(yes.q), 'every task and action as a first-time Yes leaves them');
  click();
  ticks(m, 5);
  assert.equal(m.seen.prompts.length, 3, 'a Yes is final: the child is the player\'s, and a click asks nothing more');
  assert.deepEqual(m.seen.faces, ['child']);
});

test('NO-ASKS-AGAIN: a save taken after the No under DFU\'s law - the asking task set, the prompt complete, `_no_` set - loads asking again, before any tick reads it, and its next click asks; Yes goes on (mutants: no repair at restore)', () => {
  const { m, q } = start('K0C00Y05', 1);
  clicker(m, q, 'child')();
  m.seen.prompts.at(-1).respond(false);   // answered, and saved before the quest ticks again
  const env = JSON.parse(JSON.stringify(m.getSaveData()));
  const saved = env.quests.find((d) => d.uid === q.uid);
  const savedTask = (n) => saved.tasks.find((t) => t.symbol.original === `_${n}_`);
  assert.equal(savedTask('S.07').triggered, true, 'the stuck save: the asking task set');
  assert.equal(savedTask('S.07').actions.find((a) => a.type === 'Prompt').isComplete, true, 'the prompt complete');
  assert.equal(savedTask('no').triggered, true, '`_no_` set');

  const m2 = machine(script('K0C00Y05'));
  m2.restoreSaveData(env);
  const q2 = m2.getQuest(q.uid);
  assert.ok(q2, 'the quest loads');
  assert.equal(task(q2, 'S.07').getTriggerValue(), false, 'loaded: the asking task listens again');
  assert.equal(promptOf(q2, 'S.07').isComplete, false, 'loaded: the prompt armed');
  assert.equal(task(q2, 'no').getTriggerValue(), false, 'loaded: the No forgotten');
  m2.tick();
  assert.equal(m2.seen.prompts.length, 0);
  clicker(m2, q2, 'child')();
  assert.deepEqual(m2.seen.prompts.map((p) => p.id), [1017], 'the first click after the load asks');
  answer(m2, true);
  assert.equal(task(q2, 'S.09').getTriggerValue(), true);
  assert.equal(q2.getResource({ name: 'child' }).isHidden, true);
});

test('NO-ASKS-AGAIN: a No that does something is DFU\'s - M0B00Y16\'s villager, refused, says "You are truly heartless", costs 10, and never asks again (`_no_ task:` has actions, and `when _success_ and _no_` reads it); K0C00Y03\'s guard asks "hand it over" once though his injury latch holds - a demand is not a click (mutants: the asking read as anything but a click)', () => {
  const villager = start('M0B00Y16', 11);
  assert.equal(task(villager.q, 'victim').getTriggerValue(), true, 'the villager is the giant\'s captive (`_victim_`)');
  assert.equal(inertNo(villager.q, promptOf(villager.q, 'S.10')), null);
  const click = clicker(villager.m, villager.q, 'villager');
  click();
  assert.deepEqual(villager.m.seen.prompts.map((p) => p.id), [1040]);
  const popups = villager.m.seen.popups.length;
  answer(villager.m, false);
  assert.equal(task(villager.q, 'no').getTriggerValue(), true, 'the refusal stands');
  assert.equal(villager.m.seen.popups.length, popups + 1, '`say 1043`');
  assert.deepEqual(villager.m.seen.rep, [-10], '`change repute with _villager_ by -10`');
  click();
  ticks(villager.m, 5);
  assert.equal(villager.m.seen.prompts.length, 1, 'never asked again - DFU\'s law');
  assert.equal(task(villager.q, 'S.10').getTriggerValue(), true);

  const demand = start('K0C00Y03', 1);
  const guard = demand.q.getResource({ name: 'guard' });
  const blow = new QuestResourceBehaviour(demand.m, { enemy: { currentHealth: 30, maxHealth: 40, setCurrentHealth() {} } });
  blow.assignResource(guard);
  assert.equal(blow.cacheTarget(), true);
  blow.update();   // hurt: the behaviour raises the foe's injury latch
  assert.equal(guard.injuredTrigger, true);
  demand.m.tick();
  assert.deepEqual(demand.m.seen.prompts.map((p) => p.id), [1015], '"Hand it over and you can get out of here, okay?"');
  assert.ok(inertNo(demand.q, promptOf(demand.q, 'S.05')), 'its No is as inert as the Lost Child\'s');
  answer(demand.m, false);
  ticks(demand.m, 10);
  assert.equal(guard.injuredTrigger, true, 'the latch holds until the guard is stood again');
  assert.equal(demand.m.seen.prompts.length, 1, 'asked once: the refusal stands and the courier keeps the goods');
  assert.equal(task(demand.q, 'deed').getTriggerValue(), false);
});

test('NO-ASKS-AGAIN: the law\'s guards on The Lost Child\'s own script - a `_no_ task:` that merges an action into the variable, a task that reads the asking task, and the asking task linked to a global each leave DFU\'s law (mutants: the action check, the asking task\'s readers, a global\'s task cleared)', () => {
  // `_no_ task:` after `variable _no_` merges into it (Quest.AddTask's duplicate arm): the No now says 1016
  const merged = start('K0C00Y05', 1, [...script('K0C00Y05'), '', '_no_ task:', '\tsay 1016']);
  assert.equal(task(merged.q, 'no').type, 'variable');
  assert.deepEqual(task(merged.q, 'no').actions.map((a) => a.typeName), ['Say']);
  assert.equal(inertNo(merged.q, promptOf(merged.q, 'S.07')), null, 'a No that does something');
  const click = clicker(merged.m, merged.q, 'child');
  click();
  answer(merged.m, false);
  click();
  assert.equal(merged.m.seen.prompts.length, 1, 'asked once');
  assert.equal(task(merged.q, 'no').getTriggerValue(), true);

  // a task that reads `_S.07_`: clearing it would stop that task and run its say again on the next click
  const read = start('K0C00Y05', 1, [...script('K0C00Y05'), '', '_heard_ task:', '\twhen _S.07_', '\tsay 1016']);
  assert.ok(inertNo(read.q, promptOf(read.q, 'S.07')), 'the No is still inert');
  assert.equal(asksOnAClick(read.q, task(read.q, 'S.07')), false, 'but the asking task is read');
  const click2 = clicker(read.m, read.q, 'child');
  click2();
  answer(read.m, false);
  click2();
  assert.equal(read.m.seen.prompts.length, 1, 'asked once');
  assert.equal(task(read.q, 'heard').getTriggerValue(), true, '`_heard_` stands');

  // the asking task linked to a global (`Unused1 _S.07_`, Quests-GlobalVars' 5 - S0000002's `ElysannaSatisfied _S.06_`
  // shape): every quest shares it through SAVEVARS, so clearing it is no quest's own business
  const linked = start('K0C00Y05', 1, script('K0C00Y05').map((l) => (l === '_S.07_ task:' ? 'Unused1 _S.07_' : l)));
  assert.equal(task(linked.q, 'S.07').type, 'globalVarLink');
  assert.equal(asksOnAClick(linked.q, task(linked.q, 'S.07')), false);
  const click3 = clicker(linked.m, linked.q, 'child');
  click3();
  assert.deepEqual(linked.m.seen.prompts.map((p) => p.id), [1017]);
  answer(linked.m, false);
  click3();
  assert.equal(linked.m.seen.prompts.length, 1, 'asked once');
  assert.equal(linked.m.globalVars.get(5), true, 'the global stands');
});

test('NO-ASKS-AGAIN, QUEST-AUDIT III: C0C00Y10\'s healer - whose `_no_ task:` clears the asking itself - asks "buy the root?" again on the next click after a No, as often as it is refused; a Yes then goes on to the sale; a save after the No under DFU\'s law loads asking again (mutants: the clearing No read as inert, the prompt left complete, the No left set)', () => {
  for (const seed of [7, 11]) {
    const { m, q } = start('C0C00Y10', seed);
    answer(m, true);   // the questor's offer, taken
    const click = clicker(m, q, 'healer');
    click();
    assert.deepEqual(m.seen.prompts.map((p) => p.id), [1011, 1014], 'the healer asks');
    answer(m, false);
    assert.equal(promptOf(q, 'S.10').isComplete, false, 'the prompt is armed again');
    assert.equal(task(q, 'no').getTriggerValue(), false, 'the No is cleared, its `clear` ready for a second');
    ticks(m, 5);
    assert.equal(m.seen.prompts.length, 2, 'nothing asks without a click');
    click();
    assert.deepEqual(m.seen.prompts.map((p) => p.id), [1011, 1014, 1014], 'the next click asks again');
    answer(m, false);
    click();
    assert.equal(m.seen.prompts.length, 4, 'and again');
    answer(m, true);
    assert.equal(task(q, 'S.11').getTriggerValue(), true, 'a Yes: on to the sale (`_S.11_`)');
    // a save taken after a No under DFU's law - `_no_` set, its `clear` run (the asking cleared), the prompt complete -
    // loads asking again, before any tick
    const old = start('C0C00Y10', seed);
    answer(old.m, true);
    clicker(old.m, old.q, 'healer')();
    task(old.q, 'S.10').clear();
    task(old.q, 'no').setTriggerValue(true);
    promptOf(old.q, 'S.10').isComplete = true;
    const back = machine(script('C0C00Y10'));
    back.restoreSaveData(JSON.parse(JSON.stringify(old.m.getSaveData())));
    const q2 = back.getQuest(old.q.uid);
    assert.equal(promptOf(q2, 'S.10').isComplete, false, 'armed at the load');
    assert.equal(task(q2, 'no').getTriggerValue(), false);
  }
});

test('NO-ASKS-AGAIN: the corpus, read off every vendored quest by the law itself - the inert Nos, the prompts asked on a click, and the one the law re-arms (mutants: the reader check, the action check, the click check, the asking task\'s readers)', () => {
  const m = new QuestMachine({ nowSeconds: () => 0, getQuestSourceLines: (n) => script(n) });
  const inert = [], onAClick = [], law = [];
  const names = readdirSync(new URL('vendor/dfu-quests/Quests/', ROOT)).filter((f) => f.endsWith('.txt')).map((f) => f.slice(0, -4)).sort();
  for (const name of names) {
    const q = m.parseQuestShape(name);   // the script's own shape, no world (SHARE-COPY's headless parse)
    assert.ok(q, `${name} parses`);
    for (const t of q.tasks.values()) {
      for (const a of t.actions) {
        if (a.typeName !== 'Prompt') continue;
        if (inertNo(q, a)) inert.push(`${name} ${t.symbol.original} no ${a.noTaskSymbol.original}`);
        if (asksOnAClick(q, t)) onAClick.push(`${name} ${t.symbol.original}`);
      }
    }
    for (const e of promptsThatAskAgain(q)) law.push(`${name} ${e.task.symbol.original} no ${e.no.symbol.original}`);
  }
  // A plain variable named by nothing but its prompt. Left out, with the reason each is DFU's: L0B50Y11's `_no_` (read
  // by `when _S.17_ and _no_`), 40C00Y00's `_S.18_` and O0B00Y01's `_no_` (each the No of three prompts).
  assert.deepEqual(inert, [
    'A0C00Y14 _S.16_ no _no_',
    'A0C00Y15 _S.16_ no _no_',
    'K0C00Y03 _S.05_ no _no_',
    'K0C00Y05 _S.07_ no _no_',
    'O0B00Y00 _greklith_ no _S.06_',
    'O0B10Y00 _greklith_ no _S.06_',
    'R0C10Y00 _S.08_ no _no_',
    'R0C10Y01 _S.06_ no _no_',
    'R0C10Y02 _S.10_ no _no_',
    'R0C10Y18 _S.11_ no _no_',
    'R0C11Y19 _S.10_ no _no_',
  ]);
  // A prompt whose every trigger is a click, its task named by nothing - left out, as named: C0C00Y10's `_S.10_` (its
  // `_no_ task:` clears it), M0B00Y16's `_S.10_` (`when ... and not _S.10_`), and every prompt under `injured` or `when`.
  assert.deepEqual(CLICK_TRIGGERS, ['ClickedNpc', 'ClickedItem', 'ClickedFoe', 'TotingItemAndClickedNpc']);
  assert.deepEqual(onAClick, [
    '$CUREWER _S.00_', '$CUREWER _S.08_', '80C0XY00 _rulerclicked_', 'C0B00Y02 _bribe_', 'C0B3XY09 _S.01_',
    'K0C00Y00 _S.07_', 'K0C00Y05 _S.07_', 'K0C30Y03 _S.04_', 'M0B11Y18 _S.15_', 'M0B11Y18 _S.16_', 'N0B00Y09 _S.07_',
    'P0B10L08 _daedclicked_', 'R0C20Y22 _S.08_', 'R0C4XY23 _clickoblivion_', 'R0C60Y24 _vampclicked_',
    'S0000008 _meetladyb_', 'S0000010 _S.05_', 'S0000012 _S.00_', 'S0000017 _S.06_', '__DEMO08 _S.10_',
  ]);
  // Both: the one prompt in the shipped corpus whose No leads nowhere and whose asking is a click - and (PIN MOVED,
  // QUEST-AUDIT III: the owner's call taken) C0C00Y10's healer, whose No is a `clear` of the asking alone (clearingNo).
  assert.deepEqual(law, ['C0C00Y10 _S.10_ no _no_', 'K0C00Y05 _S.07_ no _no_']);
  assert.deepEqual(promptsThatAskAgain(m.parseQuestShape('C0C00Y10')).map((e) => e.clears), [true], 'the healer\'s is the No that clears its asking');
});
