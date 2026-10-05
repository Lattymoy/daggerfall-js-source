// RENOWN-LOOT (2026-10-05, Mac: "Instead of a flat loot increase, lets also tie it to renoun level"; asked, Mac chose
// "Half → all → half again", "The roller's own" Renown, and offline "Keep this PR's numbers"): LOOT-EASE's buff, grown
// with the roller's Renown in the sigils' five stages - half at Renown 1, all at Renown 20, half again at Renown 40;
// offline LOOT-EASE's whole. bible/06-Systems/Loot-Arc.md section 20; systems/renownLoot.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { RENOWN_LOOT_QUARTERS, RENOWN_LOOT_OFFLINE_QUARTERS, renownLootQuarters, lootEased } from '../src/systems/renownLoot.js';
import { setSigilOnline, setSigilRenown, renownSigilStage } from '../src/systems/sigil.js';
import { spawnEnemyLoot, plainFoeLootKeep } from '../src/scenes/hostCombat.js';
import { rollCorpseKit, plainFoeRarityWeights, PLAIN_FOE_RARITY_WEIGHTS, PLAIN_FOE_RARITY_WEIGHTS_BEFORE } from '../src/systems/foeLootCap.js';
import {
  installHealingSupply, healingSupplyChances, HEALING_RECIPE_KEY, MAGICKA_RECIPE_KEY,
  HEALING_ENEMY_CHANCE, HEALING_PILE_CHANCE, MAGICKA_ENEMY_CHANCE, MAGICKA_PILE_CHANCE,
} from '../src/systems/healingSupply.js';
import { installRestItemLoot, restLootChances, REST_FOE_CHANCES, REST_PILE_CHANCES, REST_ITEM } from '../src/systems/restItems.js';
import { addEnemyLootExtras, addPileLootExtras } from '../src/systems/loot.js';
import { goldStack, isGoldPieces } from '../src/systems/inventory.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { enemyLootSpawned } from '../src/characters/enemyEntity.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { rarityOf } from '../src/systems/lootRarity.js';
import { setPref, _resetForTests as _resetPrefsForTests } from '../src/systems/uiPrefs.js';

installHealingSupply();   // the hosts' order (scenes/shared.js)
installRestItemLoot();
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** The page's word, as scenes/world.js gives it: online or not, and the Renown it knows (null: not yet). */
const page = (online, renown = null) => { setSigilOnline(online); setSigilRenown(renown); };
const offline = () => page(false);
const at = (v) => () => v;
const potions = (items, key) => items.filter((it) => it.group === 'UselessItems1' && it.potionRecipeKey === key).length;
const jars = (items) => items.filter((it) => it.templateIndex === REST_ITEM.EmberJar).length;

// ─── THE STAGE ───────────────────────────────────────────────────────

test('RENOWN-LOOT the stage: offline LOOT-EASE\'s buff whole; online the roller\'s Renown in the sigils\' own five stages - half, three quarters, all, five quarters, half again - and the first while the page does not know it yet (mutants: offline staged; the unknown Renown given more; a stage table off by one)', () => {
  try {
    assert.deepEqual([...RENOWN_LOOT_QUARTERS], [2, 3, 4, 5, 6]);
    assert.equal(RENOWN_LOOT_OFFLINE_QUARTERS, 4);
    for (const r of [null, 1, 20, 50]) assert.equal(renownLootQuarters({ online: false, renown: r }), 4, `offline, Renown ${r}: LOOT-EASE's whole`);
    assert.equal(renownLootQuarters({ online: true, renown: null }), 2, 'online, not yet known: the first stage');
    const want = { 1: 2, 9: 2, 10: 3, 19: 3, 20: 4, 29: 4, 30: 5, 39: 5, 40: 6, 50: 6 };
    for (const [r, q] of Object.entries(want)) assert.equal(renownLootQuarters({ online: true, renown: Number(r) }), q, `Renown ${r}`);
    for (let r = 1; r <= 50; r++) assert.equal(renownLootQuarters({ online: true, renown: r }), RENOWN_LOOT_QUARTERS[renownSigilStage(r)], `Renown ${r}: the sigils' own stage`);
    // the page's door - scenes/world.js's setSigilOnline / setSigilRenown - is what a roll reads
    offline(); assert.equal(renownLootQuarters(), 4);
    page(true); assert.equal(renownLootQuarters(), 2);
    page(true, 33); assert.equal(renownLootQuarters(), 5);
    page(false, 33); assert.equal(renownLootQuarters(), 4, 'a page that leaves its seat is offline again');
  } finally { offline(); }
});

test('RENOWN-LOOT the table Mac chose: each knob moves the same share of LOOT-EASE\'s own step - the keep, every tier of the plain ladder, the healing and Restore Power chances, the rest supplies (online from none) - and offline and at Renown 20 they ARE LOOT-EASE\'s numbers (mutants: a before moved; the step\'s share; the settling dropped)', () => {
  //                  quarters: keep    blue at 0  healing  Restore Power  a foe's Ember Jar
  const rows = [[2, 0.625, 45, 8, 3, 1.5], [3, 0.6875, 47.5, 9, 4.5, 2.25], [4, 0.75, 50, 10, 6, 3], [5, 0.8125, 52.5, 11, 7.5, 3.75], [6, 0.875, 55, 12, 9, 4.5]];
  for (const [q, keep, blue, healing, magicka, jar] of rows) {
    assert.equal(plainFoeLootKeep(q), keep, `${q}: the keep`);
    assert.equal(plainFoeRarityWeights(q).magic.base, blue, `${q}: blue at level 0, per mille`);
    assert.equal(healingSupplyChances(q).enemy.healing, healing, `${q}: a foe's healing potion`);
    assert.equal(healingSupplyChances(q).enemy.magicka, magicka, `${q}: a foe's Restore Power`);
    assert.equal(new Map(restLootChances(REST_FOE_CHANCES, q)).get(REST_ITEM.EmberJar), jar, `${q}: a foe's Ember Jar`);
  }
  // the piles and the ladder's other tiers move alike
  assert.deepEqual(healingSupplyChances(2).pile, { healing: 15, magicka: 5 });
  assert.deepEqual(healingSupplyChances(6).pile, { healing: 21, magicka: 15 });
  assert.deepEqual(plainFoeRarityWeights(6), { magic: { base: 55, perTier: 5.5, cap: 210 }, rare: { base: 7, perTier: 1.4, cap: 44.5 }, legendary: { base: 0.175, perTier: 0.0875, cap: 3.5 } });
  assert.deepEqual(plainFoeRarityWeights(2).magic, { base: 45, perTier: 4.5, cap: 170 }, 'from FOE-CAP\'s first numbers');
  assert.equal(plainFoeRarityWeights(5).rare.perTier, 1.3, 'settled: a quarter of 0.4 past 1.2 is 1.3, never 1.2999999999999998');
  assert.equal(lootEased(0.8, 1.2, 3), 1.1);
  assert.deepEqual(PLAIN_FOE_RARITY_WEIGHTS_BEFORE.magic, { base: 40, perTier: 4, cap: 150 });
  // four quarters: LOOT-EASE's own numbers, the very tables
  assert.equal(plainFoeRarityWeights(4), PLAIN_FOE_RARITY_WEIGHTS);
  assert.equal(restLootChances(REST_PILE_CHANCES, 4), REST_PILE_CHANCES);
  assert.deepEqual(healingSupplyChances(4), { enemy: { healing: HEALING_ENEMY_CHANCE, magicka: MAGICKA_ENEMY_CHANCE }, pile: { healing: HEALING_PILE_CHANCE, magicka: MAGICKA_PILE_CHANCE } });
  assert.equal(plainFoeRarityWeights(6), plainFoeRarityWeights(6), 'one frozen ladder a share');
  assert.ok(Object.isFrozen(plainFoeRarityWeights(2)) && Object.isFrozen(plainFoeRarityWeights(2).magic));
});

// ─── THE ROLLS ───────────────────────────────────────────────────────

test('RENOWN-LOOT the keep, through the real spawn: a plain foe\'s pieces kept on their coin at the roller\'s Renown - a coin of 0.65 keeps at Renown 10 and not at 1, 0.7 at 20 and not at 10, 0.85 at 40 and not at 30; offline three in four; online before the Renown is known, Renown 1\'s (mutants: the keep never read at the Renown; the stage read wrong)', () => {
  _resetPrefsForTests(); setPref('lootRarity', false);
  const player = { level: 5, gender: 'female', stats: { luck: 50 }, activeEffects: [] };
  const basics = { ...ENEMY_BASICS[7], lootTableKey: 'F', mapChance: 100 };   // the Orc: a table, a kit, a sure map
  /** The pieces the body holds as the spawn's loot event fires - after the keep, before the cap. */
  const kept = (coin) => {
    const e = { items: [], level: 5, careerIndex: 7, isClass: false, stats: { strength: 50, speed: 50 }, skills: 30 };
    const real = Math.random; Math.random = at(0);   // the table's own stream: every chance lands
    let atSpawn = null;
    const off = enemyLootSpawned.add(({ items }) => { atSpawn = items.slice(); });
    try { spawnEnemyLoot(e, 7, basics, player, { rolls: at(coin) }); } finally { Math.random = real; off(); }
    return atSpawn.filter((it) => !isGoldPieces(it)).length;
  };
  try {
    for (const [renown, coin, keeps] of [[1, 0.65, false], [10, 0.65, true], [10, 0.7, false], [20, 0.7, true], [30, 0.85, false], [40, 0.85, true]]) {
      page(true, renown);
      assert.equal(kept(coin) > 0, keeps, `Renown ${renown}, a coin of ${coin}: ${keeps ? 'kept' : 'gold alone'}`);
    }
    page(true, null);
    assert.equal(kept(0.65), 0, 'online, the Renown not known yet: Renown 1\'s');
    offline();
    assert.ok(kept(0.7) > 0, 'offline: three in four, as LOOT-EASE left it');
    assert.equal(kept(0.8), 0);
  } finally { offline(); _resetPrefsForTests(); }
});

test('RENOWN-LOOT the kit at death: a plain foe\'s worn piece rolls the plain ladder at the Renown of the page its death is rolled on - at level 8 a roll of 0.085 is blue at Renown 20 and white at Renown 1, 0.095 blue at Renown 40 alone (mutants: the kit\'s ladder never read at the Renown)', () => {
  _resetPrefsForTests(); setPref('lootRarity', true);
  const body = () => {
    const sword = createWeapon(120, 1);
    return { e: { mobileType: 144, level: 8, lootCap: 3, items: [goldStack(4), sword], equip: { slots: [sword] } }, sword };
  };
  const tierAt = (renown, roll) => { page(true, renown); const b = body(); rollCorpseKit(b.e, { rolls: at(roll) }); return rarityOf(b.sword); };
  try {
    // tier 8's Magic threshold, per mille: 45 + 8 x 4.5 = 81 at Renown 1, 90 at Renown 20, 99 at Renown 40
    assert.equal(tierAt(1, 0.085), 'common');
    assert.equal(tierAt(20, 0.085), 'magic');
    assert.equal(tierAt(20, 0.095), 'common');
    assert.equal(tierAt(40, 0.095), 'magic');
    offline();
    const b = body(); rollCorpseKit(b.e, { rolls: at(0.085) });
    assert.equal(rarityOf(b.sword), 'magic', 'offline: LOOT-EASE\'s ladder (90 at tier 8)');
  } finally { offline(); _resetPrefsForTests(); }
});

test('RENOWN-LOOT the supplies, through the real hooks: a looting foe\'s healing potion, its Restore Power and its Ember Jar, and a deep pile\'s, at the roller\'s Renown - each item still drawing its one roll at every stage, so no other draw moves (mutants: a hook read at LOOT-EASE\'s whole; a supply\'s step from the wrong before)', () => {
  const foe = (roll, renown) => { page(true, renown); return addEnemyLootExtras([], { lootTableKey: 'B', mapChance: 0 }, at(roll)); };
  const pile = (roll, renown) => { page(true, renown); return addPileLootExtras([], 'J', at(roll), { online: false }); };
  try {
    // a foe's healing potion: 8 in 100 at Renown 1, 10 at Renown 20
    assert.equal(potions(foe(0.085, 1), HEALING_RECIPE_KEY), 0);
    assert.equal(potions(foe(0.085, 20), HEALING_RECIPE_KEY), 1);
    // its Restore Power: 6 at Renown 20, 9 at Renown 40
    assert.equal(potions(foe(0.085, 20), MAGICKA_RECIPE_KEY), 0);
    assert.equal(potions(foe(0.085, 40), MAGICKA_RECIPE_KEY), 1);
    // its Ember Jar: 3 at Renown 20, 4.5 at Renown 40; 1.5 at Renown 1
    assert.equal(jars(foe(0.04, 20)), 0);
    assert.equal(jars(foe(0.04, 40)), 1);
    assert.equal(jars(foe(0.02, 1)), 0);
    assert.equal(jars(foe(0.02, 20)), 1);
    // a deep pile's healing potion: 15 at Renown 1, 18 at Renown 20, 21 at Renown 40
    assert.equal(potions(pile(0.16, 1), HEALING_RECIPE_KEY), 0);
    assert.equal(potions(pile(0.16, 20), HEALING_RECIPE_KEY), 1);
    assert.equal(potions(pile(0.2, 20), HEALING_RECIPE_KEY), 0);
    assert.equal(potions(pile(0.2, 40), HEALING_RECIPE_KEY), 1);
    // a deep pile's Ember Jar: 6 at Renown 20, 9 at Renown 40
    assert.equal(jars(pile(0.07, 20)), 0);
    assert.equal(jars(pile(0.07, 40)), 1);
    // every stage draws as many rolls as every other
    const draws = (renown, run) => { let n = 0; page(true, renown); run(() => { n++; return 0.5; }); return n; };
    const foeDraws = (r) => draws(r, (rolls) => addEnemyLootExtras([], { lootTableKey: 'B', mapChance: 0 }, rolls));
    const pileDraws = (r) => draws(r, (rolls) => addPileLootExtras([], 'J', rolls, { online: false }));
    assert.equal(foeDraws(1), foeDraws(40));
    assert.equal(pileDraws(1), pileDraws(40));
    // offline: LOOT-EASE's whole
    offline();
    assert.equal(potions(addEnemyLootExtras([], { lootTableKey: 'B', mapChance: 0 }, at(0.095)), HEALING_RECIPE_KEY), 1, 'offline: 10 in 100');
  } finally { offline(); }
});

// ─── THE HOSTS ───────────────────────────────────────────────────────

test('RENOWN-LOOT the four hosts: no host holds a LOOT-EASE knob of its own - every one is read inside the shared rolls, at the page\'s door, which world.js sets as it learns its Renown; the offline town page never goes online (mutants: a host rolling its own keep)', () => {
  for (const f of ['src/scenes/exterior.js', 'src/scenes/world.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.doesNotMatch(rd(f), /PLAIN_FOE_RARITY_WEIGHTS|HEALING_ENEMY_CHANCE|HEALING_PILE_CHANCE|MAGICKA_(ENEMY|PILE)_CHANCE|REST_(FOE|PILE)_CHANCES|plainFoeLootKeep|renownLootQuarters/, `${f}: no knob of its own`);
  }
  const w = rd('src/scenes/world.js');
  assert.match(w, /setSigilOnline\(params\.has\('online'\)\);/, 'online from the page\'s own word, before any list is minted');
  assert.match(w, /setSigilRenown\(level\);/, 'and the Renown as it is adopted');
  assert.doesNotMatch(rd('src/scenes/exterior.js'), /setSigilOnline/, 'the offline town page: LOOT-EASE\'s whole');
});
