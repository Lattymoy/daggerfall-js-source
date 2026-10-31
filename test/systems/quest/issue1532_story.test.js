// #1532: a randomly local NPC home can exhaust the town's free sites. A failed
// child parse must remain recoverable without starting the main story twice.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { loadTables, rmbBlock, town, worldOf } from '../../fb1004dTowns.mjs';

loadTables();
const source = (name) => readFileSync(new URL(`../../../vendor/dfu-quests/Quests/${name}.txt`, import.meta.url), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
const script = (name, body) => [`Quest: ${name}`, 'QRC:', 'Message: 1011', ' Test', '', 'QBN:', ...body];
const quiet = (fn) => {
  const warn = console.warn;
  console.warn = () => {};
  try { return fn(); } finally { console.warn = warn; }
};

function homes() {
  const { House1, GuildHall } = BUILDING_TYPES;
  const buildings = [{ type: House1 }, { type: GuildHall, faction: 40 }];
  const locations = ['Daggerfall', 'Neighbour'].map((name, locationIndex) => {
    const loc = town({ name, locationIndex, mapId: 100 + locationIndex, grid: [`T${locationIndex}.RMB`] });
    loc.exterior.buildings = buildings.map((b) => ({ buildingType: b.type, factionId: b.faction ?? 0 }));
    return loc;
  });
  const blocks = new Map(locations.map((loc, i) => [`T${i}.RMB`, rmbBlock(`T${i}.RMB`, buildings)]));
  const world = worldOf({ locations, blocks, current: locations[0] });
  // Other players' online homes are unavailable to quest placement.
  world.isPlayerHome = (mapId) => mapId === 100;
  return { world, locations };
}

test('#1532: an unspecified NPC home can use a remote town after its random local choice is full', () => {
  const { world } = homes();
  for (let start = 1; start <= 16; start++) {
    const m = new QuestMachine({ nowSeconds: () => 0, world });
    let seed = start;
    const rolls = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
    const q = quiet(() => m.scheduleQuest(script('__HOME', ['Person _wereBrother_ face 13 faction The_Mages_Guild male']), 0, { rolls }));
    const p = q.getPerson({ name: 'wereBrother' });
    assert.equal(q.getPlace(p.homePlaceSymbol).siteDetails.mapId, 101);
  }
});

test('#1532: an explicitly local home still cannot move into another town or a player home', () => {
  const { world } = homes();
  const m = new QuestMachine({ nowSeconds: () => 0, world });
  assert.throws(() => m.scheduleQuest(script('__HOME', ['Person _wereBrother_ faction The_Mages_Guild local']), 0, { rolls: () => 0.25 }), /Could not find local site/);
});

test('#1532: a free local home still wins its random local draw; no free town still fails honestly', () => {
  const { world } = homes();
  world.isPlayerHome = () => false;
  const seen = new Set();
  for (let start = 1; start <= 16; start++) {
    const m = new QuestMachine({ nowSeconds: () => 0, world });
    let seed = start;
    const rolls = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
    const q = m.scheduleQuest(script('__HOME', ['Person _wereBrother_ faction The_Mages_Guild male']), 0, { rolls });
    seen.add(q.getPlace(q.getPerson({ name: 'wereBrother' }).homePlaceSymbol).siteDetails.mapId);
  }
  assert.ok(seen.has(100), 'a valid local draw is not moved away');
  world.isPlayerHome = () => true;
  const m = new QuestMachine({ nowSeconds: () => 0, world });
  assert.throws(() => quiet(() => m.scheduleQuest(script('__HOME', ['Person _wereBrother_ faction The_Mages_Guild']), 0, { rolls: () => 0.25 })), /Could not find local site|Search failed/);
});

const parentSource = script('S0000999', ['start quest 7 7']);
function failedStart() {
  let available = false;
  const m = new QuestMachine({
    nowSeconds: () => 0,
    getQuestSourceLines: (name) => {
      if (name !== 'S0000007') { try { return source(name); } catch { return null; } }
      // Its real main-story shape is needed by the existing recovery door.
      return available ? source(name) : script(name, ['Place _bad_ permanent not_a_site']);
    },
  });
  const parent = m.scheduleQuest(parentSource, 0, { headless: true });
  quiet(() => m.tick());
  available = true;
  return { m, parent };
}

test('#1532: a child that failed to parse appears at the existing story recovery door and survives a reload', () => {
  const { m, parent } = failedStart();
  assert.equal([...parent.tasks.values()].flatMap((t) => t.actions).find((a) => a.typeName === 'StartQuest').isComplete, true);
  assert.equal(m.storyStarted.has('S0000007'), false, 'no quest actually began');
  assert.ok(m.storyAgainQuests().includes('S0000007'), 'the player can recover the failed start');
  const save = structuredClone(m.getSaveData());
  const loaded = new QuestMachine(m.deps);
  loaded.restoreSaveData(save);
  assert.ok(loaded.storyAgainQuests().includes('S0000007'));
  const before = loaded.getSaveData().quests;
  const recovered = loaded.startStoryAgain('S0000007');
  assert.equal(recovered.ok, true);
  assert.equal(recovered.quest.questName, 'S0000007');
  assert.equal(loaded.storyAgainRefusal('S0000007'), 'running');
  assert.deepEqual(loaded.getSaveData().quests.find((q) => q.questName === 'S0000999'), before[0], 'parent progress never resets');
});

test('#1532: older saves with a consumed backbone start and no child record are recoverable too', () => {
  const { m } = failedStart();
  const save = structuredClone(m.getSaveData());
  save.storyStarted = [];
  save.storyEnded = [];
  const loaded = new QuestMachine(m.deps);
  loaded.restoreSaveData(save);
  assert.ok(loaded.storyAgainQuests().includes('S0000007'));
});

test('#1532: migration never infers failure from an incomplete legacy history or a child that really began', () => {
  const { m } = failedStart();
  for (const state of ['legacy', 'began', 'scheduled', 'unspent']) {
    const save = structuredClone(m.getSaveData());
    save.storyStarted = state === 'began' ? ['S0000007'] : [];
    save.storyEnded = [];
    if (state === 'legacy') delete save.storyStarted;
    if (state === 'scheduled') save.toInvoke = [m.parseQuestForLists(source('S0000007'), 0, { headless: true }).getSaveData()];
    if (state === 'unspent') for (const t of save.quests[0].tasks) for (const a of t.actions) a.isComplete = false;
    const loaded = new QuestMachine(m.deps);
    loaded.restoreSaveData(save);
    assert.equal(loaded.storyEnded.has('S0000007'), false, state);
  }
});

test('#1532: two backbones cannot schedule the same story child twice, including before the invoke tick', () => {
  const m = new QuestMachine({ nowSeconds: () => 0, getQuestSourceLines: source });
  const start = m._buildHooks().startQuest;
  const a = start('S0000007');
  const b = start('s0000007');
  assert.equal(b, a);
  assert.equal(m.questsToInvoke.length, 1);
  m.tick();
  assert.equal(start('S0000007'), a);
  assert.equal(m.questsToInvoke.length, 0);
});

test('#1532: ended story steps are not replayed by another backbone, while guild children remain repeatable', () => {
  const m = new QuestMachine({ nowSeconds: () => 0, getQuestSourceLines: source });
  m.storyStarted.add('S0000007');
  m.storyEnded.add('S0000007');
  const start = m._buildHooks().startQuest;
  assert.equal(start('S0000007'), null);
  assert.equal(m.questsToInvoke.length, 0);
  const first = start('S0000500');
  const second = start('S0000500');
  assert.ok(first && second && first !== second);
  assert.equal(m.questsToInvoke.length, 2);
});
