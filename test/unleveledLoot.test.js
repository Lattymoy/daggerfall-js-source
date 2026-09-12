// UL1 (2026-09-12) - UNLEVELED LOOT 1.1.2 (Ralzar), THE MOD, 1:1.
// Mac: "Heres the next mod unleveled loot. Again 1:1"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  UNLEVELED_MATERIAL_NAMES, rangeInt, rangeFloat, _state, _resetUnleveledLoot, setUnleveledLootWorld, _worldReader,
  matSwitchList, orcishDrops, daedricDrops, unleveledLootPreTransition, unleveledLootExteriorTransition,
  dungeonQuality, shopLevel, randomHighTier, randomMat, shopMat, materialSwitch, wpnMatSelector, armMatSelector,
  unleveledRandomMaterial, unleveledRandomArmorMaterial, unleveledGoldLootPiles, addDaedric, addOrcish, unlevelDroppedLoot,
  installUnleveledLoot, uninstallUnleveledLoot,
} from '../src/systems/unleveledLoot.js';
import { randomMaterial, randomArmorMaterial } from '../src/combat/enemyEquipment.js';
import { formulaOverride } from '../src/combat/formulas.js';
import { raiseEnemyDeath, registerEnemyDeathHandler } from '../src/scenes/corpseMarker.js';
import { MOD_SETTINGS, setModSetting, modSetting, _resetModSettings, isChoiceKey } from '../src/systems/modSettings.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { makeEnemyEntity } from '../src/characters/enemyEntity.js';
import { goldStack } from '../src/systems/inventory.js';
import { CREDITS } from '../src/ui/credits.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const fixed = (v) => () => v;
const seq = (...vs) => { let i = 0; return () => vs[i++ % vs.length]; };
const IDENTITY = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const world = (o = {}) => setUnleveledLootWorld({
  playerEntity: () => ({ level: o.level ?? 5, stats: { luck: o.luck ?? 50 }, gender: 'male', raceId: 1 }),
  insideOpenShop: () => !!o.shop, buildingQuality: () => o.quality ?? 0, insideDungeon: () => !!o.dungeon,
  regionIndex: () => o.region ?? 17, locationDungeonType: () => o.dungeonType ?? 255,
});
const saved = _worldReader();
const career = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50, attackModifierFlags: 0 });

test('UL1: Unity\'s Random.Range as the C# uses it - the int form max-exclusive (a max at or under min answers min), the float form float32 and inclusive', () => {
  assert.equal(rangeInt(0, 92, fixed(0)), 0); assert.equal(rangeInt(0, 92, fixed(0.999999)), 91); assert.equal(rangeInt(113, 131, fixed(0.999999)), 130);
  assert.equal(rangeInt(1, 1, fixed(0.7)), 1, 'Range(1, luckMod + 1) with luckMod 0');
  assert.equal(rangeFloat(0.3, 0.75, fixed(0)), Math.fround(0.3)); assert.equal(rangeFloat(0.3, 0.75, fixed(1)), Math.fround(Math.fround(0.3) + Math.fround(Math.fround(0.75) - Math.fround(0.3))));
});

test('UL1: the tables - dungeonQuality by DungeonType, ShopLevel by quality, RandomHighTier by its thresholds, MaterialSwitch through the ten keys', () => {
  assert.deepEqual([7, 16, 4, 14, 8, 15, 0, 1, 9, 10, 13].map((d) => dungeonQuality(d, 30)), [21, 21, 18, 18, 15, 15, 12, 12, 10, 10, 5]);
  assert.equal(dungeonQuality(2, 9), 9); assert.equal(dungeonQuality(3, 40), 15); assert.equal(dungeonQuality(11, 15), 15, 'HumanStronghold/Prison/RuinedCastle: min(level, 15)');
  assert.equal(dungeonQuality(255, 20), 0); assert.equal(dungeonQuality(-1, 20), 0); assert.equal(dungeonQuality(5, 20), 0, 'a Mine: 0');
  assert.deepEqual([0, 4, 5, 8, 9, 12, 13, 16, 17].map((q) => shopLevel(q)), [1, 1, 2, 2, 3, 3, 4, 4, 5]);
  // RandomHighTier: Range(0, 201) -> 200 daedric, 193-199 orcish, 181-192 ebony, 101-180 adamantium, else mithril
  const at = (n) => randomHighTier(fixed((n + 0.5) / 201));
  assert.equal(at(200), 9); assert.equal(at(199), 8); assert.equal(at(193), 8); assert.equal(at(192), 7); assert.equal(at(181), 7); assert.equal(at(180), 6); assert.equal(at(101), 6); assert.equal(at(100), 5); assert.equal(at(0), 5);
  assert.equal(materialSwitch(3, IDENTITY), 3); assert.equal(materialSwitch(3, [0, 1, 2, 9, 4, 5, 6, 7, 8, 9]), 9, 'Elven set to drop as Daedric');
  _resetModSettings();
  assert.deepEqual(matSwitchList(), IDENTITY, 'the ten keys default to themselves');
  assert.equal(orcishDrops(), true); assert.equal(daedricDrops(), true);
  setModSetting('unleveledLoot', 'Orcish', 1);
  assert.equal(orcishDrops(), false, 'Orcish switched away: no orcish drops'); assert.deepEqual(matSwitchList()[8], 1);
  _resetModSettings();
});

test('UL1: the transitions - region and the location\'s DungeonType at every OnPreTransition, dungeon cleared on the BUILDING exit alone (a dungeon exit leaves it, bug for bug), both 0 until the first door', () => {
  _resetUnleveledLoot();
  assert.deepEqual(_state(), { luckMod: 0, matRoll: 0, region: 0, dungeon: 0 }, 'a game loaded anywhere reads Alik\'r and a Crypt until a transition');
  world({ region: 26, dungeonType: 1 });
  unleveledLootPreTransition();
  assert.equal(_state().region, 26); assert.equal(_state().dungeon, 1);
  unleveledLootExteriorTransition();
  assert.equal(_state().dungeon, -1, 'OnTransitionExterior');
  unleveledLootPreTransition();
  assert.equal(_state().dungeon, 1, 'the dungeon exit\'s OnPreTransition re-reads the dungeon\'s own type - and no OnTransitionExterior follows it in the C#');
  const wm = rd('src/scenes/worldModes.js');
  assert.equal((wm.match(/unleveledLootPreTransition\(\);/g) || []).length, 5, 'TransitionInterior, TransitionExterior, TransitionDungeonInterior, TransitionDungeonExterior, the teleport');
  assert.equal((wm.match(/unleveledLootExteriorTransition\(\);/g) || []).length, 1, 'OnTransitionExterior once - tryExit');
  const exitDungeon = wm.slice(wm.indexOf('function exitDungeonNow() {'), wm.indexOf('function exitDungeonNow() {') + 600);
  assert.match(exitDungeon, /unleveledLootPreTransition\(\);/); assert.doesNotMatch(exitDungeon, /unleveledLootExteriorTransition/);
  _resetUnleveledLoot();
});

test('UL1: RandomMat - the wilderness takes Range(10, 20) off the roll, a dungeon its quality less 15; luck\'s double rolls a lift or Orsinium\'s/an Orc Stronghold\'s orcish; the ladder 90/83/75/35', () => {
  _resetUnleveledLoot();
  // the wilderness, luck 50 (luckMod 5): matRoll = Range(0,92) + 5; then - Range(10,20); Dice100(10) then the ladder
  world({ luck: 50 });
  // rolls: Range(0,92)=91 (0.999), Range(10,20)=10 (0), Dice100(10) fails (0.99) -> matRoll 86 -> Elven
  assert.equal(unleveledRandomMaterial(seq(0.999, 0, 0.99), IDENTITY), 3);
  // same but Dice100(10) succeeds (0.05): not Orsinium -> matRoll += 20 -> 106 > 90 -> Dice100(15) fails (0.99) -> Dwarven
  assert.equal(unleveledRandomMaterial(seq(0.999, 0, 0.05, 0.99), IDENTITY), 4);
  // ...succeeds (0.01) -> RandomHighTier with Range(0,201) at 0.999 -> 200 -> Daedric
  assert.equal(unleveledRandomMaterial(seq(0.999, 0, 0.05, 0.01, 0.999), IDENTITY), 9);
  // Orsinium: Dice100(10) succeeds and Dice100(5) succeeds -> Orcish outright
  world({ luck: 50, region: 26, dungeonType: 255 }); unleveledLootPreTransition();
  assert.equal(unleveledRandomMaterial(seq(0.5, 0, 0.05, 0.01), IDENTITY), 8);
  assert.equal(unleveledRandomMaterial(seq(0.5, 0, 0.05, 0.01), [0, 1, 2, 3, 4, 5, 6, 7, 0, 9]), 0, '...and the switch still applies to it (WpnMatSelector wraps RandomMat)');
  // an Orc Stronghold remembered from the last door, outdoors: the same arm
  world({ luck: 50, region: 17, dungeonType: 1 }); unleveledLootPreTransition();
  assert.equal(unleveledRandomMaterial(seq(0.5, 0, 0.05, 0.01), IDENTITY), 8);
  // the low end: Range(0,92)=0 + 5 - 19 = -14, no lift -> Iron; luck 0 -> luckMod 0, Dice100(0) never
  world({ luck: 50, region: 17, dungeonType: 255 }); unleveledLootPreTransition();
  assert.equal(unleveledRandomMaterial(seq(0, 0.999, 0.99), IDENTITY), 0);
  assert.equal(unleveledRandomMaterial(seq(0.5, 0.5, 0.5), IDENTITY), 1, '46 + 5 - 15 = 36 > 35: Steel');
  // inside a Coven (quality 21): matRoll - 15 + 21
  world({ luck: 50, dungeon: true, dungeonType: 7 }); unleveledLootPreTransition();
  assert.equal(unleveledRandomMaterial(seq(0.9, 0.99), IDENTITY), 4, '82 + 5 - 15 + 21 = 93 > 90, Dice100(15) fails: Dwarven');
  _resetUnleveledLoot();
});

test('UL1: ShopMat - the shelf\'s level lifts the roll (-35 + level*8), Orsinium over 70 may stock orcish, the ladder 99/97/94/88/80/70 and under 10; ArmMatSelector - Range(1, 91) + luck, the shop\'s quality x6 or the dungeon\'s, plate over 80 of the SAME matRoll, chain over 50', () => {
  _resetUnleveledLoot();
  world({ luck: 50, shop: true, quality: 17, region: 17 });   // level 5: matRoll - 35 + 40
  assert.equal(unleveledRandomMaterial(seq(0.999), IDENTITY), 7, '91 + 5 + 5 = 101 > 99: Ebony');
  assert.equal(unleveledRandomMaterial(seq(0.5), IDENTITY), 1, '46 + 5 + 5 = 56: Steel (the default)');
  assert.equal(unleveledRandomMaterial(seq(0), IDENTITY), 1, '0 + 5 + 5 = 10 - not under 10: Steel');
  world({ luck: 0, shop: true, quality: 1, region: 17 });   // level 1: -35 + 8
  assert.equal(unleveledRandomMaterial(seq(0.3), IDENTITY), 0, '27 - 27 = 0 < 10: Iron');
  world({ luck: 50, shop: true, quality: 17, region: 26 });
  assert.equal(unleveledRandomMaterial(seq(0.9, 0.999), IDENTITY), 8, 'Orsinium, matRoll 92 > 70, Range(0,90)=89 + 5 > 90: Orcish');
  assert.equal(unleveledRandomMaterial(seq(0.9, 0.1), IDENTITY), 4, '...the orcish roll failed (9 + 5): 92 > 88 and not over 94: Dwarven');
  // ArmMatSelector
  world({ luck: 50, shop: true, quality: 10, region: 17 });
  // rolls: Range(0,92) (unused by the armour ladder but drawn), Range(1,91)
  assert.equal(unleveledRandomArmorMaterial(seq(0.5, 0), IDENTITY), 0x0100, '1 + 5 + 60 = 66 > 50: chain');
  assert.equal(unleveledRandomArmorMaterial(seq(0.5, 0.3, 0.5), IDENTITY), 0x0200 + 1, '28 + 5 + 60 = 93 > 80: plate of ShopMat over the shared roll (46+5 -35 +24 = 40: Steel)');
  world({ luck: 0, region: 17 });
  assert.equal(unleveledRandomArmorMaterial(seq(0.5, 0.2), IDENTITY), 0, '19 + 0 + 0: leather');
  world({ luck: 50, dungeon: true, dungeonType: 7 }); unleveledLootPreTransition();
  assert.equal(unleveledRandomArmorMaterial(seq(0.5, 0.3), IDENTITY), 0x0100, '28 + 5 + 21 = 54: chain in a Coven');
  _resetUnleveledLoot();
});

test('UL1: the corpse - a Daedra Lord\'s roll over 70 drops daedric (a weapon over 50, the Seducer always), an Orc Warlord\'s over 80 orcish; the armour drop is 1.1.2\'s - a NEW piece over CreateRandomArmor\'s template, its condition from the RANDOM piece\'s max (bug for bug); every gold stack divided by the level, floored at 1, times Range(1, luck\'s tenth + 1)', () => {
  _resetUnleveledLoot();
  world({ luck: 50, level: 10 });
  const lord = makeEnemyEntity(31, ENEMY_BASICS[31], career(), 10, fixed(0.5));
  lord.items = [goldStack(250)];
  // rolls: Range(0,101)=100 (>70), Range(0,100)=99 (>50: a weapon), Range(113,131)=113 (a dagger), rangeFloat(0.3,0.75)=0.3, gold: Range(1,6)=1
  unlevelDroppedLoot(lord, { rolls: seq(0.999, 0.999, 0, 0, 0) });
  assert.equal(lord.items.length, 2);
  const dagger = lord.items[1];
  assert.equal(dagger.group, 'Weapons'); assert.equal(dagger.templateIndex, 113); assert.equal(dagger.material, 9, 'daedric');
  assert.equal(dagger.currentCondition, Math.trunc(Math.fround(Math.fround(0.3) * dagger.maxCondition)), '30% of its own max');
  assert.equal(lord.items[0].stackCount, 25, '250 / level 10, x Range(1, 6) = 1');
  // the armour arm: Range(0,100)=0 (not > 50) -> CreateRandomArmor: piece Range(0,11)=0, then the registry's RandomArmorMaterial (the mod's own): Range(0,92), Range(1,91)... then rangeFloat
  const lord2 = makeEnemyEntity(31, ENEMY_BASICS[31], career(), 10, fixed(0.5));
  lord2.items = [goldStack(7)];
  installUnleveledLoot({ read: (k) => (k === 'Enabled' ? true : k === 'Orcish' ? 8 : k === 'Daedric' ? 9 : UNLEVELED_MATERIAL_NAMES.indexOf(k)) });
  unlevelDroppedLoot(lord2, { rolls: seq(0.999, 0, 0, 0.5, 0.2, 0.999, 0.999), r: (k) => (k === 'Enabled' ? true : k === 'Orcish' ? 8 : k === 'Daedric' ? 9 : UNLEVELED_MATERIAL_NAMES.indexOf(k)) });
  uninstallUnleveledLoot();
  const armor = lord2.items[1];
  assert.equal(armor.group, 'Armor'); assert.equal(armor.material, 521, 'daedric plate'); assert.equal(armor.variant, 0);
  assert.ok(armor.maxCondition > 0, 'ApplyArmorSettings\' SetItemPropertiesByMaterial: a daedric max');
  assert.ok(armor.currentCondition < armor.maxCondition * 0.75, `the condition came from the LEATHER random piece's smaller max, not the daedric one's (${armor.currentCondition} of ${armor.maxCondition})`);
  assert.equal(lord2.items[0].stackCount, 1 * 5, '7 / 10 -> 0 -> 1, x Range(1, 6) at 0.999 = 5');
  // the Seducer always drops a weapon; a Daedroth needs over 80
  const seducer = makeEnemyEntity(29, ENEMY_BASICS[29], career(), 10, fixed(0.5)); seducer.items = [];
  unlevelDroppedLoot(seducer, { rolls: seq(0.76, 0, 0.5, 0.5) });
  assert.equal(seducer.items.length, 1); assert.equal(seducer.items[0].group, 'Weapons');
  const daedroth = makeEnemyEntity(27, ENEMY_BASICS[27], career(), 10, fixed(0.5)); daedroth.items = [];
  unlevelDroppedLoot(daedroth, { rolls: seq(0.80) });
  assert.equal(daedroth.items.length, 0, '80 + 0 is not over 80');
  // orcs: the Warlord over 80, orcish (8 / 520); a rat drops nothing
  const warlord = makeEnemyEntity(24, ENEMY_BASICS[24], career(), 10, fixed(0.5)); warlord.items = [];
  unlevelDroppedLoot(warlord, { rolls: seq(0.999, 0.999, 0.5, 0.5) });
  assert.equal(warlord.items[0].material, 8);
  const rat = makeEnemyEntity(0, ENEMY_BASICS[0], career(), 10, fixed(0.5)); rat.items = [goldStack(3)];
  unlevelDroppedLoot(rat, { rolls: seq(0.999) });
  assert.equal(rat.items.length, 1); assert.equal(rat.items[0].stackCount, 5, '3 / 10 -> 1, x 5');
  // daedricDrops off: the Lord keeps his gold division and drops nothing
  const lord3 = makeEnemyEntity(31, ENEMY_BASICS[31], career(), 10, fixed(0.5)); lord3.items = [goldStack(100)];
  unlevelDroppedLoot(lord3, { rolls: seq(0.999, 0), r: (k) => (k === 'Daedric' ? 5 : k === 'Orcish' ? 8 : 0) });
  assert.equal(lord3.items.length, 1); assert.equal(lord3.items[0].stackCount, 50, '100 / 10, x Range(1, 6) at 0.999 = 5 - the first roll is the gold\'s, no daedric roll was drawn');
  _resetUnleveledLoot();
});

test('UL1: ModifyFoundLootItems is DEAD in DFU 1.1.1 - registered, read by nothing; the function itself worn books and divided gold (mutant: a port member that consults it)', () => {
  world({ luck: 50, level: 4 });
  const items = [{ group: 'Books', templateIndex: 277, maxCondition: 100, currentCondition: 100 }, goldStack(10), { group: 'Books', templateIndex: 277, artifact: true, maxCondition: 100, currentCondition: 100 }];
  assert.equal(unleveledGoldLootPiles(items, { rolls: fixed(0), level: 4, luck: 50 }), 1, 'one book changed (the artifact skipped)');
  assert.equal(items[0].currentCondition, Math.trunc(Math.fround(100 * Math.fround(0.2)))); assert.equal(items[1].stackCount, 2); assert.equal(items[2].currentCondition, 100);
  installUnleveledLoot({ read: (k) => (k === 'Enabled' ? true : UNLEVELED_MATERIAL_NAMES.indexOf(k)) });
  assert.ok(formulaOverride('modifyFoundLootItems'), 'registered, as Awake does');
  uninstallUnleveledLoot();
  for (const f of ['src/combat/formulas.js', 'src/systems/loot.js', 'src/scenes/droppedLoot.js', 'src/scenes/dungeonContext.js']) {
    assert.doesNotMatch(rd(f), /modifyFoundLootItems/, `${f}: nothing consults the dead hook`);
  }
});

test('UL1: the registry - installed, the two rolls answer the mod\'s when Enabled and DFU\'s when not; OnEnemyDeath raised at the three kills; the seams (choice keys on the pane, the credit, the vendor, the boot order, the world reader)', () => {
  _resetUnleveledLoot(); uninstallUnleveledLoot();
  world({ luck: 50 });
  const stock = randomMaterial(1, fixed(0.5));
  let on = false;
  installUnleveledLoot({ read: (k) => (k === 'Enabled' ? on : UNLEVELED_MATERIAL_NAMES.indexOf(k)) });
  assert.equal(randomMaterial(1, fixed(0.5)), stock, 'off: DFU\'s roll');
  on = true;
  assert.equal(randomMaterial(1, seq(0.5, 0.5, 0.5)), 1, 'on: the mod\'s (46 + 5 - 15 = 36: Steel), the level ignored');
  assert.equal(randomMaterial(30, seq(0.5, 0.5, 0.5)), 1);
  assert.equal(randomArmorMaterial(1, seq(0.5, 0)), 0, 'on: 1 + 5 = 6: leather');
  // the death handler through the seam
  const lord = makeEnemyEntity(31, ENEMY_BASICS[31], career(), 10, fixed(0.5)); lord.items = [goldStack(100)];
  raiseEnemyDeath(lord, { rolls: seq(0, 0) });
  assert.equal(lord.items[0].stackCount, 20, '100 / level 5, x Range(1,6) at 0 = 1');
  on = false;
  const lord2 = makeEnemyEntity(31, ENEMY_BASICS[31], career(), 10, fixed(0.5)); lord2.items = [goldStack(100)];
  raiseEnemyDeath(lord2, { rolls: seq(0, 0) });
  assert.equal(lord2.items[0].stackCount, 100, 'off: untouched');
  uninstallUnleveledLoot();
  assert.equal(formulaOverride('randomMaterial'), null);
  let seen = 0; registerEnemyDeathHandler('t', () => { seen++; }); raiseEnemyDeath({ items: [] }); registerEnemyDeathHandler('t', null); raiseEnemyDeath({ items: [] });
  assert.equal(seen, 1);
  for (const f of ['src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js', 'src/scenes/dungeonContext.js']) assert.match(rd(f), /raiseEnemyDeath\(\w+\.entity\);/, `${f}: the kill raises OnEnemyDeath`);
  assert.match(rd('src/combat/enemyEquipment.js'), /formulaOverride\('randomMaterial'\)\?\.\(playerLevel, rolls\)/); assert.match(rd('src/combat/enemyEquipment.js'), /formulaOverride\('randomArmorMaterial'\)\?\.\(playerLevel, rolls\)/);
  // the pane
  const m = MOD_SETTINGS.unleveledLoot;
  assert.equal(m.author, 'Ralzar'); assert.deepEqual(Object.keys(m.keys), ['Enabled', ...UNLEVELED_MATERIAL_NAMES]); assert.equal(m.keys.Enabled.default, false);
  const shipped = JSON.parse(rd('vendor/unleveledLoot/modsettings.json').replace(/,(\s*[}\]])/g, '$1')).Sections[0];
  assert.equal(shipped.Name, 'MaterialSwitching');
  for (const k of shipped.Keys) {
    const def = m.keys[k.Name];
    assert.ok(isChoiceKey(def), `${k.Name} is a MultipleChoiceKey`); assert.deepEqual([...def.options], k.Options); assert.equal(def.default, k.Value); assert.equal(def.description, k.Description);
  }
  _resetModSettings();
  setModSetting('unleveledLoot', 'Steel', 42); assert.equal(modSetting('unleveledLoot', 'Steel'), 9, 'a choice clamps to its options');
  setModSetting('unleveledLoot', 'Steel', -3); assert.equal(modSetting('unleveledLoot', 'Steel'), 0);
  _resetModSettings();
  assert.match(rd('src/ui/enhancedMenu.js'), /if \(isChoiceKey\(def\)\) \{/, 'the pane steps the choice keys by name');
  assert.ok(Object.keys(MOD_SETTINGS).indexOf('pcaao') < Object.keys(MOD_SETTINGS).indexOf('unleveledLoot'), 'listed after the overhaul, as its manifest orders it');
  const credit = CREDITS.mods.find((c) => c.title === 'Unleveled Loot');
  assert.ok(credit); assert.equal(credit.version, '1.1.2'); assert.deepEqual([...credit.vendor], ['unleveledLoot']);
  const manifest = JSON.parse(rd('vendor/unleveledLoot/UnleveledLoot.dfmod.json'));
  assert.equal(manifest.ModVersion, '1.1.2'); assert.deepEqual(manifest.Dependencies.map((d) => d.Name), ['roleplayrealism', 'roleplayrealism-items']);
  assert.match(rd('vendor/unleveledLoot/README.md'), /Ralzar/); assert.match(rd('vendor/unleveledLoot/README.md'), /MIT/);
  const wt = rd('src/systems/worldTick.js');
  assert.ok(wt.indexOf('installPcaao();') < wt.indexOf('installUnleveledLoot();'), 'installed last');
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /setUnleveledLootWorld\(\{/); assert.match(wm, /insideOpenShop: \(\) => mode === 'interior' && !!interiorBuilding\?\.insideOpenShop,/); assert.match(wm, /locationDungeonType: \(\) => host\.currentLocation\?\.\(\)\?\.mapTableData\?\.dungeonType \?\? 255,/);
  for (const h of ['world', 'exterior']) assert.match(rd(`src/scenes/${h}.js`), /currentRegionIndex: \(\) =>/, `${h}: hands the machine the region`);
  setUnleveledLootWorld(saved);
});
