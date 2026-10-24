// FORAGE-FIX (2026-09-28): the quest and list patches RUN - each pinned on
// the port's own quest machine and list manager, patched against the
// author's text as shipped (bible/06-Systems/Foraging.md 12). A patch that
// only matched its line would pass forage1_law; these fail unless the
// patched quest does what the author meant, and the unpatched one still
// shows the fault it mends.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyForageFix, FT } from '../../../src/systems/foraging/foragingLaw.js';
import { createForagingItem } from '../../../src/systems/foraging/foragingInstall.js';
import { questActionsExtensionTemplates } from '../../../src/systems/quest/questActionsExtension.js';
import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { QuestListsManager, registerQuestList, _resetQuestLists } from '../../../src/systems/quest/questLists.js';
import { SOCIAL_GROUPS } from '../../../src/formats/factionFile.js';
import { FATIGUE_MULTIPLIER } from '../../../src/systems/statMods.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const QUESTS = join(ROOT, 'vendor/foraging/Quests');
const TABLES = join(ROOT, 'vendor/dfu-quests/Tables');
loadQuestTables(Object.fromEntries(readdirSync(TABLES).map((f) => [f.replace(/\.txt$/, ''), readFileSync(join(TABLES, f), 'utf8')])));

const raw = (name) => readFileSync(join(QUESTS, `${name}.txt`), 'utf8');
const lines = (name, patched) => (patched ? applyForageFix(name, raw(name)) : raw(name)).split(/\r?\n/);

/** A machine over one player: the climate, the clock QAE raises, the pack and the wagon. */
function machine({ climate = 231, patched = true, int = 62, setup = null } = {}) {
  const entity = {
    stats: { intelligence: int, strength: 55, agility: 50, endurance: 50, luck: 45, willpower: 50, personality: 50, speed: 50 },
    items: [], wagonItems: [], fatigue: 105 * FATIGUE_MULTIPLIER, health: 50, maxHealth: 100, magicka: 10, maxMagicka: 50,
    level: 5, gender: 'male', name: 'Tester',
  };
  setup?.(entity);
  const clock = { now: 1000000, raised: [] };
  const m = new QuestMachine({
    nowSeconds: () => clock.now,
    playerEntity: entity,
    raiseTime: (s) => { clock.raised.push(s); clock.now += s; },
    world: { currentClimateIndex: () => climate, playerInside: () => null, currentRegionIndex: () => 17 },
    getQuestSourceLines: (n) => lines(n, patched),
    giveItemToPlayer: (it) => { entity.items.unshift(it); },
    removeItemFromPlayer: (it) => { const i = entity.items.indexOf(it); if (i >= 0) entity.items.splice(i, 1); },
    addGold: () => {}, addHUDText: () => {}, showPopup: () => {},
    releaseQuestItem: () => {}, makeHeldQuestItemsPermanent: () => {},
    getGuild: () => null, regionPriceAdjustment: () => 0,
  });
  for (const t of questActionsExtensionTemplates()) m.registerAction(t);
  return { m, entity, clock };
}
/** Every action that completes, as `task:Type` (and `MakePermanent(target)`), in order. */
function spy(q) {
  const fired = [];
  for (const task of q.tasks.values()) {
    for (const a of task.actions) {
      const up = a.update.bind(a);
      const type = a.constructor.typeName;
      a.update = (c) => {
        const was = a.isComplete;
        const r = up(c);
        if (!was && a.isComplete) fired.push(`${task.symbol?.name}:${type}${type === 'MakePermanent' ? `(${a.target?.name})` : ''}`);
        return r;
      };
    }
  }
  return fired;
}
const quiet = (fn) => {
  const ow = console.warn, ol = console.log;
  console.warn = () => {}; console.log = () => {};
  try { return fn(); } finally { console.warn = ow; console.log = ol; }
};
const yieldTasks = (fired) => [...new Set(fired.filter((f) => /(bounty|scare):/.test(f)).map((f) => f.split(':')[0]))];

test('Q7: the patched Mining quest fires ONE yield task - rich ground in the deserts and the mountains (PIN MOVED, QUEST-AUDIT III CLIMATE-NAMES: Desert2 and Mountain Woods read their own climates now, as its `_rich_` names them), scarce elsewhere; the build fired all four', () => {
  quiet(() => {
    for (const [climate, want] of [[224, 'gemsbounty'], [226, 'gemsbounty'], [225, 'gemsbounty'], [230, 'gemsbounty'], [231, 'gemsscare'], [228, 'gemsscare']]) {
      const { m, entity, clock } = machine({ climate });
      const q = m.scheduleQuest(lines('MiningQuest', true), 0, { rolls: () => 0 });   // pick one of _gems_ _elements_: the gems
      const fired = spy(q);
      for (let i = 0; i < 8; i++) m.tick();
      assert.deepEqual(yieldTasks(fired), [want], `climate ${climate}`);
      assert.deepEqual(clock.raised, [7200], 'two hours, once');
      assert.equal(entity.fatigue, 105 * FATIGUE_MULTIPLIER * 3 / 4, 'a quarter of the maximum, once');
      assert.equal(q.questComplete, true);
    }
    // the build's `or _desert2_` is true on every task where desert2 reads - in the Desert2 climate now (CLIMATE-NAMES: in the
    // Desert under C#'s order, where `climate desert2` bound 224)
    const { m, entity, clock } = machine({ climate: 225, patched: false });
    const q = m.scheduleQuest(lines('MiningQuest', false), 0, { rolls: () => 0 });
    const fired = spy(q);
    for (let i = 0; i < 8; i++) m.tick();
    assert.deepEqual(yieldTasks(fired), ['elementsbounty', 'gemsbounty', 'elementsscare', 'gemsscare'], 'the build: `and` before `or`, all four');
    assert.deepEqual(clock.raised, [7200, 7200, 7200, 7200], 'eight hours');
    assert.equal(entity.fatigue, 1, 'and all the fatigue, to the floor');
  });
});

test('Q9: the patched summer harvest keeps the fifth and sixth plants; the build kept the fourth three times', () => {
  quiet(() => {
    const perms = (patched) => {
      const { m } = machine({ int: 85, patched });   // INT 80+: {2,3,3,4,5,6}; the last draw is six plants
      const q = m.scheduleQuest(lines('ForageSummerPlantsQuest', patched), 0, { rolls: () => 5.5 / 6 });
      const fired = spy(q);
      for (let i = 0; i < 8; i++) m.tick();
      assert.equal(q.questComplete, true);
      return fired.filter((f) => f.includes('MakePermanent')).map((f) => f.match(/\((.*)\)/)[1]);
    };
    assert.deepEqual(perms(true), ['plant1', 'plant2', 'plant3', 'plant4', 'plant5', 'plant6', 'misc']);
    assert.deepEqual(perms(false), ['plant1', 'plant2', 'plant3', 'plant4', 'plant4', 'plant4', 'misc']);
  });
});

test('Q8 + Q11: a patched firewood errand takes its bundles from the pack and the wagon and ends; the build\'s class 20 never found one', () => {
  quiet(() => {
    const run = (patched, pack, wagon) => {
      const { m, entity } = machine({ patched, setup: (e) => {
        for (let i = 0; i < pack; i++) e.items.push(createForagingItem(FT.WoodBundle));
        for (let i = 0; i < wagon; i++) e.wagonItems.push(createForagingItem(FT.WoodBundle));
      } });
      const q = m.parseQuestForLists(lines('FetchWood01', patched), 0, { rolls: () => 0, headless: true });
      m.startQuestImmediate(q);
      const fired = spy(q);
      m.tick(); m.tick();
      [...q.tasks.values()].find((t) => t.symbol?.name === 'questgiverclicked').start();   // the questor clicked
      for (let i = 0; i < 4; i++) m.tick();
      const bundles = (list) => list.filter((it) => it.templateIndex === FT.WoodBundle).length;
      return { complete: q.questComplete, handed: fired.some((f) => f === 'success:PlayerHandsover'), pack: bundles(entity.items), wagon: bundles(entity.wagonItems) };
    };
    assert.deepEqual(run(true, 1, 1), { complete: true, handed: true, pack: 0, wagon: 0 }, 'one from each');
    assert.deepEqual(run(true, 0, 2), { complete: true, handed: true, pack: 0, wagon: 0 }, 'both from the wagon (Q11)');
    assert.deepEqual(run(true, 1, 0), { complete: false, handed: false, pack: 1, wagon: 0 }, 'one short: nothing taken');
    assert.deepEqual(run(false, 2, 0), { complete: false, handed: false, pack: 2, wagon: 0 }, 'the build: never');
  });
});

test('Q13: the patched list files the four errands under Commoners and Nobility; the build\'s Commoner and Noble filed nothing', () => {
  const list = raw('QuestList-ForagingQuests');
  const manager = (text) => {
    _resetQuestLists();
    registerQuestList('ForagingQuests');
    const tables = {
      Classic: readFileSync(join(TABLES, 'QuestList-Classic.txt'), 'utf8'),
      DFU: readFileSync(join(TABLES, 'QuestList-DFU.txt'), 'utf8'),
      ForagingQuests: text,
    };
    return new QuestListsManager({ readListTable: (n) => tables[n] ?? null });
  };
  const fixed = manager(applyForageFix('QuestList-ForagingQuests', list));
  const built = manager(list);
  _resetQuestLists();
  for (const [name, group] of [['FetchWood01', 'Commoners'], ['FetchWood02', 'Commoners'], ['FetchWood03', 'Nobility'], ['FetchWood04', 'Nobility']]) {
    const meta = fixed.findQuestMeta(name);
    assert.equal(meta?.scope, 'social', name);
    assert.equal(meta.group, SOCIAL_GROUPS[group], `${name}: ${group}`);
    assert.equal(built.findQuestMeta(name), null, `${name}: the build's row names no social group`);
  }
  assert.equal(fixed.findQuestMeta('FetchWood02').quest.minReq, 10, 'the rest of the row as the author wrote it');
  assert.deepEqual(fixed.findQuestMeta('ChopWoodQuest'), built.findQuestMeta('ChopWoodQuest'), 'the other rows untouched');
});

test('FORAGE-FIX: a checkout that turned the files to CRLF patches the same as the shipped LF', () => {
  for (const name of ['MiningQuest', 'FetchWood01', 'ForageSummerPlantsQuest']) {
    const lf = raw(name).replace(/\r\n/g, '\n');
    const crlf = lf.replace(/\n/g, '\r\n');
    assert.equal(applyForageFix(name, crlf), applyForageFix(name, lf), name);
  }
  const lf = raw('QuestList-ForagingQuests').replace(/\r\n/g, '\n');
  assert.equal(applyForageFix('QuestList-ForagingQuests', raw('QuestList-ForagingQuests')), applyForageFix('QuestList-ForagingQuests', lf), 'the list ships CRLF');
});
