// FORAGE1-FORAGE2 - FORAGING 1.7 (Harbinger451), THE TOOLS, THE FOODS, THE QUESTS (2026-09-28, Mac: "Your lead").
// bible/06-Systems/Foraging.md is the record. The pins hold src/systems/foraging/foragingInstall.js and
// src/systems/quest/questActionsExtension.js to the mod: a tool used where its checks pass gives its yield, its box,
// its quest and its wear; a tool at its last point breaks with DFU's popup and the mod's line and is gone; a check
// that fails speaks its line and gives nothing; the switch off makes every tool inert; the foods; the console
// command (refused online); Quest Actions Extension's four actions as Foraging's quests use them (Q11 mended); every
// Foraging quest, patched, parses on the port's machine with no line left unread but DFU's own ignored one; and the
// hosts' wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  useForagingTool, eatForagingFood, foragingToolsCommand, setForagingHost, createForagingItem, installForaging,
  _resetForagingInstall, _setForagingRandomForTests, foragingOn,
} from '../../src/systems/foraging/foragingInstall.js';
import { FT, FORAGING_REFUSALS, FORAGING_COMMAND, fishTemplate } from '../../src/systems/foraging/foragingLaw.js';
import { RaiseTime, ReducePlayerFatigue, PlayerPossesses, PlayerHandsover, questActionsExtensionTemplates, lengthOrStackCount } from '../../src/systems/quest/questActionsExtension.js';
import { applyForageFix } from '../../src/systems/foraging/foragingLaw.js';
import { itemUseHandler, registerItemUseHandler } from '../../src/systems/item/itemTemplates.js';
import { fletch } from '../../src/systems/fletching.js';   // FLETCH: the Wood Bundle's one Use
import { registerPresenter } from '../../src/systems/notify.js';
import { setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';
import { survivalOn } from '../../src/systems/survival/switch.js';
import { QuestMachine } from '../../src/systems/quest/machine.js';
import { loadQuestTables } from '../../src/systems/quest/tables.js';
import { registeredQuestLists } from '../../src/systems/quest/questLists.js';
import { CLIMATES, LOCATION_TYPES } from '../../src/formats/mapsFile.js';
import { FATIGUE_MULTIPLIER } from '../../src/systems/statMods.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const QUESTS = join(ROOT, 'vendor/foraging/Quests');

/** HUD lines and popups, as the one door hands them to a host. */
const heard = [];
registerPresenter({ hudText: (line) => { heard.push(line); return true; }, priority: 99 });

const OPEN = Object.freeze({
  inside: false, insideDungeon: false, insideCastle: false, locationType: LOCATION_TYPES.None, inLocationRect: false,
  hour: 12, climate: CLIMATES.Woodlands, region: 17, enemiesNear: false, carriedWeight: 10, maxEncumbrance: 100,
  swimming: false, exteriorWater: 'None',
});
function player(stats = {}) {
  return {
    stats: { intelligence: 62, strength: 55, agility: 50, endurance: 50, luck: 45, ...stats },
    items: [], wagonItems: [], fatigue: 40 * FATIGUE_MULTIPLIER, health: 20, maxHealth: 100, magicka: 5, maxMagicka: 50,
  };
}
function host(world = OPEN, month = 9, entity = null) {
  const started = [];
  setForagingHost({ world: () => world, monthValue: () => month, entity: () => entity, startQuest: (n) => { started.push(n); return true; } });
  return started;
}
/** The draws, in order, each the index wanted of a list of that length. */
const draws = (...pairs) => { let i = 0; return () => { const [k, n] = pairs[i++] ?? [0, 1]; return (k + 0.5) / n; }; };

test('FORAGE2: the Wood-Axe in the Woodlands at noon - two bundles, its line in the box, ChopWoodQuest, one point of wear', () => {
  _resetModSettings(); heard.length = 0;
  const e = player();
  const started = host();
  _setForagingRandomForTests(draws([3, 5]));   // average 58: {0,0,1,2,3}[3] = 2
  const axe = createForagingItem(FT.WoodAxe);
  const pack = [axe];
  const r = useForagingTool(axe, pack, { entity: e });
  assert.deepEqual(r, { kind: 'foraging', text: 'You were able to chop and gather two Wood Bundles!' });
  assert.deepEqual(e.items.map((i) => i.templateIndex), [FT.WoodBundle, FT.WoodBundle], 'into the pack, not the collection used from');
  assert.equal(e.items[0].group, 'UselessItems2');
  assert.deepEqual(started, ['ChopWoodQuest']);
  assert.equal(axe.currentCondition, 49);
  assert.deepEqual(pack, [axe]);
  assert.deepEqual(heard, []);
  _setForagingRandomForTests(null);
});

test('FORAGE2: a failing check speaks its line on the HUD and nothing else happens; no host is "inside"', () => {
  _resetModSettings(); heard.length = 0;
  const e = player();
  const started = host({ ...OPEN, hour: 20 });
  const sickle = createForagingItem(FT.Sickle);
  const r = useForagingTool(sickle, [sickle], { entity: e });
  assert.equal(r.refused, true);
  assert.deepEqual(heard, [FORAGING_REFUSALS[FT.Sickle].daylight]);
  assert.deepEqual(started, []);
  assert.equal(sickle.currentCondition, 50, 'no wear on a refusal');
  setForagingHost(null); heard.length = 0;
  useForagingTool(sickle, [sickle], { entity: e });
  assert.deepEqual(heard, [FORAGING_REFUSALS[FT.Sickle].inside]);
});

test('FORAGE2: at its last point the tool still works, then DFU\'s popup and the mod\'s line, and it is gone', () => {
  _resetModSettings(); heard.length = 0;
  const e = player();
  const started = host();
  const pick = createForagingItem(FT.PickAxe);
  pick.currentCondition = 1;
  const pack = [pick];
  const r = useForagingTool(pick, pack, { entity: e });
  assert.equal(r.text, null, 'the Pick-Axe shows no box');
  assert.deepEqual(started, ['MiningQuestWeaker'], '(62 + 50) / 2 = 56');
  assert.deepEqual(heard, ['Pick-Axe has broken.', 'Your Pick-Axe broke.']);
  assert.deepEqual(pack, []);
  heard.length = 0;
  setForagingHost({ world: () => OPEN, monthValue: () => 9, entity: () => e, startQuest: () => false });
  const lost = createForagingItem(FT.PickAxe);
  useForagingTool(lost, [lost], { entity: e });
  assert.equal(lost.currentCondition, 50, 'no quest found: DFU\'s StartQuest(null) throws before the wear');
  assert.deepEqual(heard, []);
});

test('FORAGE2: the Sickle by climate and month, the Spade in a cemetery by night, the net in water', () => {
  _resetModSettings(); heard.length = 0;
  const e = player();
  let started = host({ ...OPEN, climate: CLIMATES.Woodlands }, 3);
  useForagingTool(createForagingItem(FT.Sickle), [], { entity: e });
  assert.deepEqual(started, ['ForageSummerPlantsQuest'], 'Rain\'s Hand');
  started = host({ ...OPEN, hour: 2, locationType: LOCATION_TYPES.Graveyard, inLocationRect: true });
  useForagingTool(createForagingItem(FT.Spade), [], { entity: e });
  assert.deepEqual(started, ['GraveRobbingQuestWeaker'], '(62 + 50) / 2 = 56, never the Cheb\'s family');
  started = host({ ...OPEN, exteriorWater: 'WaterWalking' });
  _setForagingRandomForTests(draws([5, 6]));
  const r = useForagingTool(createForagingItem(FT.FishingNet), [], { entity: e });
  assert.equal(r.text, 'You cast your Fishing Net and catch two Fish!', '(62 + 50) / 2 = 56: {0,0,1,1,2,2}[5]');
  assert.deepEqual(e.items.map((i) => i.templateIndex), [fishTemplate(survivalOn()), fishTemplate(survivalOn())]);
  assert.deepEqual(started, ['FishingQuest']);
  _setForagingRandomForTests(null);
});

test('FORAGE2: the Basket in the woods in Frostfall - block D, two Mushrooms, ForageFoodQuest', () => {
  _resetModSettings(); heard.length = 0;
  const e = player();
  const started = host(OPEN, 9);
  _setForagingRandomForTests(draws([3, 6], [1, 5]));
  const r = useForagingTool(createForagingItem(FT.Basket), [], { entity: e });
  assert.equal(r.text, 'You manage to pick two Mushrooms!');
  assert.deepEqual(e.items.map((i) => i.templateIndex), [FT.Mushroom, FT.Mushroom]);
  assert.deepEqual(started, ['ForageFoodQuest']);
  _setForagingRandomForTests(null);
});

test('FORAGE2: the foods - fatigue in points, health or magicka, one eaten, a HUD line', () => {
  _resetModSettings(); heard.length = 0;
  const e = player();
  const egg = createForagingItem(FT.Egg);
  const mush = createForagingItem(FT.Mushroom);
  const pack = [egg, mush];
  eatForagingFood(egg, pack, { entity: e });
  assert.equal(e.fatigue, (40 + 15) * FATIGUE_MULTIPLIER);
  assert.equal(e.health, 30);
  eatForagingFood(mush, pack, { entity: e });
  assert.equal(e.magicka, 15);
  assert.equal(e.fatigue, (40 + 15 + 5) * FATIGUE_MULTIPLIER);
  assert.deepEqual(pack, []);
  assert.deepEqual(heard, ['You eat an Egg and feel better for it!', 'You eat a Mushroom and feel better for it!']);
  const two = createForagingItem(FT.Apple); two.stackCount = 2;
  const shelf = [two];
  eatForagingFood(two, shelf, { entity: e });
  assert.deepEqual(shelf, [], 'RemoveItem(this): the item whole, as DFU - never one off a stack');
  const full = player(); full.fatigue = (55 + 50) * FATIGUE_MULTIPLIER; full.health = 99;
  eatForagingFood(createForagingItem(FT.Fish), [], { entity: full });
  assert.equal(full.fatigue, (55 + 50) * FATIGUE_MULTIPLIER, 'never past the maximum');
  assert.equal(full.health, 100);
});

test('FORAGE1: the switch off - every tool and food inert, its Use not offered, its quest list not offered', () => {
  _resetModSettings();
  installForaging({ fetchBytes: async () => new Uint8Array() });
  assert.ok(registeredQuestLists().includes('ForagingQuests'));
  assert.equal(itemUseHandler(FT.WoodAxe).usable(), true);
  setModSetting('foraging', 'Enabled', false);
  assert.equal(foragingOn(), false);
  assert.equal(itemUseHandler(FT.WoodAxe).usable(), false);
  assert.equal(itemUseHandler(FT.Apple).usable(), false);
  assert.equal(useForagingTool(createForagingItem(FT.WoodAxe), [], { entity: player() }), null);
  assert.equal(eatForagingFood(createForagingItem(FT.Apple), [], { entity: player() }), null);
  assert.ok(!registeredQuestLists().includes('ForagingQuests'));
  _resetModSettings();
  for (const t of [1600, 1601, 1602, 1603, 1606, 1607, 1605, 1608, 1609, 1610, 1611]) assert.equal(typeof itemUseHandler(t), 'function', `${t}`);
  assert.equal(itemUseHandler(FT.WoodBundle), fletch, 'the Wood Bundle has no UseItem of the mod\'s - PIN MOVED (FLETCH, 2026-10-11): its one Use is the fletching\'s, the port\'s own (systems/fletching.js)');
  _resetForagingInstall();
});

test('FORAGE1: Foraging_Tools - the six tools offline, refused online', () => {
  const e = player();
  host(OPEN, 9, e);
  assert.equal(foragingToolsCommand(), FORAGING_COMMAND.answer);
  assert.deepEqual(e.items.map((i) => i.templateIndex), [1600, 1601, 1602, 1603, 1606, 1607]);
  const was = globalThis.location;
  globalThis.location = { search: '?online=1' };
  try { assert.equal(foragingToolsCommand(), 'Foraging Tools are not given online.'); } finally { globalThis.location = was; }
  assert.equal(e.items.length, 6);
  setModSetting('foraging', 'Enabled', false);
  assert.equal(foragingToolsCommand(), 'Command FORAGING_TOOLS not found.', 'switched off: no command at all, as DFU');
  assert.equal(e.items.length, 6);
  _resetModSettings();
});

// ---- Quest Actions Extension ------------------------------------------------

const questWith = (entity, clock = { now: 0, raised: [] }) => ({
  hooks: { playerEntity: () => entity, nowSeconds: () => clock.now, raiseTime: (s) => clock.raised.push(s) },
  popups: [], showMessagePopup(id) { this.popups.push(id); },
});
const bundle = () => createForagingItem(FT.WoodBundle);

test('QAE: raise time by H:MM is a bare advance; "to H:MM" alone never parses (the missing |), nor "by ... saying" (its saying unread); 0:00 is refused', () => {
  const clock = { now: 0, raised: [] };
  const q = questWith(player(), clock);
  const t = new RaiseTime(null);
  const a = t.createNew('\traise time by 1:30', q);
  a.update(null);
  assert.deepEqual(clock.raised, [5400]);
  assert.equal(a.isComplete, true);
  assert.equal(t.createNew('raise time to 18:00', q), null);
  const saying = t.createNew('raise time by 2:00 saying 1013', q);
  assert.equal(saying.hours, 2);
  assert.equal(saying.sayingID, 0, 'the glued second alternative is the only "saying" after a "by": this line is the bare "by"');
  assert.equal(t.createNew('raise time by 0:00', q), null, 'CreateNew: nothing to raise, no action');
});

test('QAE: reduce player fatigue by N takes N percent of the maximum, never below 1', () => {
  const e = player();
  const q = questWith(e);
  const a = new ReducePlayerFatigue(null).createNew('reduce player fatigue by 20', q);
  a.update(null);
  assert.equal(e.fatigue, Math.trunc(40 * 64 - (55 + 50) * 64 * 20 / 100));
  const b = new ReducePlayerFatigue(null).createNew('reduce player fatigue by 25', q);
  for (let i = 0; i < 4; i++) { b.isComplete = false; b.update(null); }
  assert.equal(e.fatigue, 1, 'the floor of 1');
  const over = player(); over.fatigue = 200 * FATIGUE_MULTIPLIER;   // a maximum that fell under the current (a lost buff)
  new ReducePlayerFatigue(null).createNew('reduce player fatigue on 1', questWith(over)).update(null);
  assert.equal(over.fatigue, (55 + 50) * FATIGUE_MULTIPLIER, 'CurrentFatigue\'s setter: never above the maximum');
});

test('QAE: player possesses counts pack and wagon, no quest items; handsover takes the pack first, then the wagon (Q11)', () => {
  const e = player();
  const q = questWith(e);
  const has = new PlayerPossesses(null).createNew('player possesses 2 items class 9 subclass 1604', q);
  assert.equal(has.checkTrigger(null), false);
  e.items.push(bundle());
  const quest = bundle(); quest.questItem = true; e.items.push(quest);
  assert.equal(has.checkTrigger(null), false, 'a quest item never counts');
  e.wagonItems.push(bundle());
  assert.equal(has.checkTrigger(null), true, 'one in the pack and one in the wagon');
  const give = new PlayerHandsover(null).createNew('player handsover 2 items class 9 subclass 1604', q);
  give.update(null);
  assert.equal(give.isComplete, true);
  assert.deepEqual(e.items, [quest], 'the pack\'s bundle taken, the quest item left');
  assert.deepEqual(e.wagonItems, [], 'Q11: the wagon\'s own bundle taken - QAE searched the pack twice');
  const short = new PlayerHandsover(null).createNew('player handsover 2 items class 9 subclass 1604', q);
  e.items.push(bundle());
  short.update(null);
  assert.equal(short.isComplete, false, 'nothing taken unless all are held');
  assert.equal(e.items.length, 2);
  assert.equal(lengthOrStackCount([{ stackCount: 3 }, {}, { timeForItemToDisappear: 9 }]), 4, 'a stack its size, a summoned item nothing');
  assert.equal(new PlayerPossesses(null).createNew('player possesses 2 items class 20 subclass 1604', q).checkTrigger(null), false,
    'the build\'s class 20 (Q8) never finds a group-9 bundle');
});

test('FORAGE1: every Foraging quest, patched, parses on the port\'s machine - only DFU\'s own ignored line left unread', () => {
  const T = join(ROOT, 'vendor/dfu-quests/Tables');
  loadQuestTables(Object.fromEntries(readdirSync(T).map((f) => [f.replace(/\.txt$/, ''), readFileSync(join(T, f), 'utf8')])));
  const m = new QuestMachine({ nowSeconds: () => 0 });
  for (const t of questActionsExtensionTemplates()) m.registerAction(t);
  const names = readdirSync(QUESTS).filter((f) => !f.startsWith('QuestList')).map((f) => f.replace(/\.txt$/, ''));
  assert.equal(names.length, 22);
  const unread = new Set();
  const ow = console.warn; console.warn = () => {};
  try {
    for (const name of names) {
      const q = m.parseQuestForLists(applyForageFix(name, readFileSync(join(QUESTS, `${name}.txt`), 'utf8')).split(/\r?\n/), 0, { rolls: () => 0 });
      assert.ok(q, name);
      for (const task of q.tasks.values()) for (const line of task.pendingActionLines ?? []) unread.add(line.trim().replace(/_\w+_/, '_x_'));
      const qae = [...q.tasks.values()].flatMap((t) => t.actions).filter((a) => a instanceof RaiseTime || a instanceof ReducePlayerFatigue || a instanceof PlayerPossesses || a instanceof PlayerHandsover);
      if (/^(Chop|Forage|Mining|GraveRobbing)/.test(name)) assert.ok(qae.length > 0, `${name} says QAE's actions`);
    }
  } finally { console.warn = ow; }
  assert.deepEqual([...unread], ['update-quest-item _x_ Leveled'], 'the one line DFU drops');
});

test('FORAGE1: the wiring - boot installs it, both exterior hosts register QAE\'s actions and answer the checks, the loader patches', () => {
  const shared = rd('src/scenes/shared.js');
  assert.match(shared, /installForaging\(\);[^\n]*\n\s*installWarmAshesShips\(\);/, 'at boot, before any quest bridge');
  for (const p of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = rd(p);
    assert.match(s, /for \(const t of questActionsExtensionTemplates\(\)\) questBridge\.machine\.registerAction\(t\);/, p);
    assert.match(s, /setForagingHost\(\{/, p);
    assert.match(s, /player\.onExteriorWaterMethod = _surf\.water;/, `${p}: the three-valued water`);
  }
  assert.match(rd('src/scenes/worldModes.js'), /player\.onExteriorWaterMethod = 'None';/);
  const loader = rd('src/scenes/quest/questData.js');
  assert.match(loader, /vendor\/foraging\/Quests\/\*\.txt/);
  assert.match(loader, /if \(path\.includes\('\/vendor\/foraging\/'\)\) \{\n\s*try \{ patched = applyForageFix\(name, text\); \} catch/, 'a failed patch warns and loads the shipped text');
  assert.match(loader, /if \(name\.startsWith\('QuestList-'\)\) tables\.set\(name, patched\);/, 'Q13: the list is patched too');
  assert.match(rd('src/scenes/world.js'), /enemiesNear: exterior \? \(duelEnemyNear\(\) \|\| areEnemiesNearby\(/, 'DUEL1: a duel is an enemy near');
});

test('FORAGE1: a General Store and a Pawn Shop shelve the tools by DFU\'s own custom-item loop, and not while the switch is off', async () => {
  const { stockShopShelf } = await import('../../src/systems/shopStock.js');
  const { BUILDING_TYPES } = await import('../../src/world/buildingNames.js');
  const { customItemsForGroup } = await import('../../src/systems/item/itemTemplates.js');
  _resetModSettings();
  assert.deepEqual(customItemsForGroup('UselessItems2'), [1600, 1601, 1602, 1603, 1604, 1605, 1606, 1607, 1608, 1609, 1610, 1611]);
  const foraging = (shelf) => shelf.map((i) => i.templateIndex).filter((t) => t >= 1600 && t <= 1611).sort((a, b) => a - b);
  // every stock roll passes (Random.Range(0, 100) = 0): rarity against the shop's quality decides
  const general = foraging(stockShopShelf({ buildingType: BUILDING_TYPES.GeneralStore, quality: 20 }, player(), { rolls: () => 0 }));
  assert.deepEqual(general, [1600, 1601, 1602, 1603, 1604, 1606, 1607, 1610, 1611], 'the tools and the bundle (rarity 10), the Mushroom and the Egg (5) - never the fish or the fruit (100)');
  assert.deepEqual(foraging(stockShopShelf({ buildingType: BUILDING_TYPES.PawnShop, quality: 9 }, player(), { rolls: () => 0 })), [1610, 1611], 'a shop of quality 9 shelves no tool');
  setModSetting('foraging', 'Enabled', false);
  assert.deepEqual(customItemsForGroup('UselessItems2'), []);
  assert.deepEqual(foraging(stockShopShelf({ buildingType: BUILDING_TYPES.GeneralStore, quality: 20 }, player(), { rolls: () => 0 })), []);
  _resetModSettings();
});

test('FORAGE1: a tool pressed from the hotbar that its checks refuse flashes the refusal, never gold - the HUD line is the tool\'s own', async () => {
  const HB = await import('../../src/systems/quickslots.js');
  _resetModSettings(); heard.length = 0;
  const prev = itemUseHandler(FT.Sickle);
  registerItemUseHandler(FT.Sickle, Object.assign((item, collection, ctx) => useForagingTool(item, collection, ctx), { usable: () => foragingOn() }));
  const e = player();
  const sickle = createForagingItem(FT.Sickle);
  e.items.push(sickle);
  e.isPlayer = true; e.activeEffects = []; e.spells = [];
  const said = [];
  const doors = { quickUse: () => { HB.useQuickslot('c1', { entity: e, items: e.items, say: (l) => said.push(l) }); return true; } };
  try {
    HB.clearQuickslots();
    HB.setHotbarSlot(0, HB.hotbarEntryForItem(sickle));
    host({ ...OPEN, hour: 20 });
    assert.equal(HB.hotbarPress(0, { entity: e, doors, say: (l) => said.push(l) }).kind, 'refused');
    assert.deepEqual(heard, [FORAGING_REFUSALS[FT.Sickle].daylight]);
    assert.deepEqual(said, [], 'no "You cannot use" over the tool\'s own line');
    heard.length = 0;
    const started = host();
    assert.equal(HB.hotbarPress(0, { entity: e, doors, say: (l) => said.push(l) }).kind, 'used', 'in daylight it works');
    assert.equal(started.length, 1);
  } finally { HB.clearQuickslots(); registerItemUseHandler(FT.Sickle, prev); }
});
