// DEX4b (2026-10-20, Mac: "I want to implement this as our next mod 1:1") - DAGGERFALL ENEMY EXPANSION'S COMBAT HOOKS.
// The FormulaHelper overrides its Start registers and its OnLootSpawned handler's forced gender
// (systems/enemyExpansion/dexCombat.js): OnMonsterHit as a chain over DFU's nine arms (systems/diseases.js) and four of
// its own that ready its spells; the Skeletal Warrior's rule for a row it says is skeletal (combat/formulas.js
// isSkeletalTarget); its fifty's groups and languages; a row's forced gender over the unit's roll
// (characters/mobile/mobileUnit.js). Each pinned against the C#'s own law, and each with a mutation it must fail under
// (tools/mutants/dex4b.json).
import '../../modsOff.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDexMonsterHit, createDexCombatDoors, DEX_HIT_SPELLS } from '../../../src/systems/enemyExpansion/dexCombat.js';
import { onMonsterHit, runMonsterHitArm, CLASSIC_HIT_ARM, MONSTER_HIT_ARMS } from '../../../src/systems/diseases.js';
import {
  weaponAttackDamage, isSkeletalTarget, enemyEntityGroup, enemyLanguageSkill, ENEMY_GROUPS, SKELETAL_WARRIOR_INDEX,
  registerFormulaOverride, registerSkeletalTarget, registerEnemyGroup, registerEnemyLanguage, _resetFormulaDoors,
} from '../../../src/combat/formulas.js';
import { MobileUnit, registerForcedGender, _resetForcedGenders } from '../../../src/characters/mobile/mobileUnit.js';
import { srand, getSeed } from '../../../src/formats/dfRandom.js';
import { installEnemyExpansion, _resetEnemyExpansion, dexRead } from '../../../src/systems/enemyExpansion/dexInstall.js';
import { MOBILE_TYPES } from '../../../src/characters/mobile/mobileTypes.js';
import { SKILLS } from '../../../src/systems/skills.js';
import { WEAPONS } from '../../../src/characters/weapons.js';
import { clearCustomEnemies } from '../../../src/characters/enemy/customEnemies.js';
import { _resetMintRowEditors } from '../../../src/characters/enemy/enemyEntity.js';
import { _resetFoeGhosts } from '../../../src/characters/enemy/foeLook.js';
import { _resetExtraQuestRows } from '../../../src/systems/quest/tables.js';
import { _resetEncounterTableSelectors } from '../../../src/characters/encounterTableDoor.js';
import { _resetPlayerGps } from '../../../src/world/playerGps.js';
import { _resetSpellRecordsAssets } from '../../../src/systems/spell/standardSpells.js';
import { _resetEnemySpellbooks } from '../../../src/systems/enemySpells.js';
import { enemyGroupOf, entityFlags, getNearbyObjects, NEARBY } from '../../../src/systems/nearbyObjects.js';   // AUDIT DEX C3
import { applySpell } from '../../../src/systems/effects.js';
import { buildCustomSpell, blankEffectSettings } from '../../../src/systems/spell/spellMaker.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CS = readFileSync(join(ROOT, 'vendor/daggerfall-enemy-expansion/Scripts/BestiaryMod.cs'), 'utf8');
const silent = () => {};
const reset = () => {
  _resetFormulaDoors(); _resetForcedGenders(); _resetSpellRecordsAssets(); _resetEnemySpellbooks(); _resetEncounterTableSelectors(); _resetPlayerGps();
  _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); _resetFoeGhosts(); _resetExtraQuestRows();
};
const P = (level = 5) => ({
  isPlayer: true, level, career: {}, health: 40, maxHealth: 40, magicka: 30, fatigue: 6400, activeEffects: [],
  stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
});
/** A scripted die (its first value, then its tail for ever), and everything an arm can touch written down - the arm's
 *  transcript. The scripts fire each arm's own law: 0.001 lands every chance (a disease's Dice100, a bite's 0.6%),
 *  0.03 lands a 5% and misses a 2%, and the tail picks the disease off its list (0.5: list B's second, C's sixth). */
const script = ([first, tail]) => { let n = 0; return () => (n++ === 0 ? first : tail); };
function transcript(run, die) {
  const log = [];
  const r = script(die);
  const target = P();
  run(target, {
    rolls: () => { const v = r(); log.push(['roll', v.toFixed(6)]); return v; },
    currentDay: 10, regionIndex: 3,
    sinks: { drainFatigue: (n) => log.push(['fatigue', n]) },
    onContract: (d) => log.push(['disease', d]),
    readySpell: (i) => log.push(['ready', i]),
  });
  log.push(['target', JSON.stringify(target)]);
  return JSON.stringify(log);
}
const armOf = (arm, seed) => transcript((t, deps) => runMonsterHitArm(arm, { careerIndex: -1, mobileType: -1 }, t, 7, deps), seed);
/** The arm a run took, read off its transcript (the seeds chosen so every arm's differs). */
const SEEDS = [[0.001, 0.5], [0.03, 0.5], [0.001, 0.99], [0.03, 0.02]];
function armTaken(run) {
  const got = SEEDS.map((s) => transcript(run, s)).join('|');
  const hits = [];
  for (let a = 0; a <= MONSTER_HIT_ARMS; a++) if (SEEDS.map((s) => armOf(a, s)).join('|') === got) hits.push(a);
  return hits;
}

test('DEX4b the arms are told apart: over the seeds, no two of DFU\'s nine (and the default) leave the same transcript', () => {
  const seen = new Set();
  for (let a = 0; a <= MONSTER_HIT_ARMS; a++) seen.add(SEEDS.map((s) => armOf(a, s)).join('|'));
  assert.equal(seen.size, MONSTER_HIT_ARMS + 1);
});

test('DEX4b OnMonsterHit without a mod is DFU\'s switch by career; the arms are numbered as the mod\'s OnHit column numbers them, in the C#\'s chain order', (t) => {
  t.after(reset);
  const want = { Rat: 1, GiantBat: 2, Spider: 3, GiantScorpion: 3, Werewolf: 4, Nymph: 5, Lamia: 5, Wereboar: 6, Zombie: 7, Mummy: 8, Vampire: 9, VampireAncient: 9 };
  assert.deepEqual(Object.fromEntries(Object.entries(CLASSIC_HIT_ARM).map(([id, a]) => [Object.keys(MOBILE_TYPES).find((k) => MOBILE_TYPES[k] === Number(id)), a])), want);
  // the C#'s chain: the classic ids each `customEffect == k` arm names, in order (BestiaryMod.cs:1477-1561)
  const chain = [...CS.matchAll(/if\s*\((attacker\.MobileEnemy\.ID[\s\S]*?)customEffect == (\d)\)/g)];
  const fromCs = {};
  for (const [, cond, k] of chain) for (const [, name] of cond.matchAll(/MonsterCareers\.(\w+)/g)) fromCs[name] = Number(k);
  assert.equal(chain.length, 9, 'nine arms in the chain');
  assert.deepEqual(fromCs, want);
  for (const [name, arm] of Object.entries(want)) assert.deepEqual(armTaken((tg, deps) => onMonsterHit({ careerIndex: MOBILE_TYPES[name], mobileType: MOBILE_TYPES[name] }, tg, 7, deps)), [arm], name);
  assert.deepEqual(armTaken((tg, deps) => onMonsterHit({ careerIndex: 271, mobileType: 271 }, tg, 7, deps)), [0], 'a mod\'s monster: DFU\'s default, nothing');
});

test('DEX4b the mod\'s chain: the first arm whose classic monster is the attacker or whose number is its OnHit - so a GiantBat whose row names 1 takes the Rat\'s, and a Rat whose row names 3 stays the Rat - and 10-13 ready its spells', () => {
  const props = new Map([[MOBILE_TYPES.GiantBat, { onHitEffect: 1 }], [MOBILE_TYPES.Rat, { onHitEffect: 3 }], [300, { onHitEffect: 7 }], [301, { onHitEffect: 0 }], [302, { onHitEffect: 14 }],
    ...[10, 11, 12, 13].map((k) => [300 + k, { onHitEffect: k }])]);
  const hit = createDexMonsterHit((id) => props.get(id) ?? null);
  const at = (id) => ({ careerIndex: id, mobileType: id });
  assert.deepEqual(armTaken((tg, deps) => hit(at(MOBILE_TYPES.GiantBat), tg, 7, deps)), [1]);
  assert.deepEqual(armTaken((tg, deps) => hit(at(MOBILE_TYPES.Rat), tg, 7, deps)), [1]);
  assert.deepEqual(armTaken((tg, deps) => hit(at(MOBILE_TYPES.Spider), tg, 7, deps)), [3], 'no props: the classic arm');
  assert.deepEqual(armTaken((tg, deps) => hit(at(300), tg, 7, deps)), [7]);
  assert.deepEqual(armTaken((tg, deps) => hit(at(301), tg, 7, deps)), [0]);
  assert.deepEqual(armTaken((tg, deps) => hit(at(302), tg, 7, deps)), [0], 'an effect past 13: nothing');
  for (const k of [10, 11, 12, 13]) {
    const ready = [];
    hit(at(300 + k), P(), 7, { rolls: () => { throw new Error('no roll'); }, readySpell: (i) => ready.push(i) });
    assert.deepEqual(ready, [DEX_HIT_SPELLS.get(k)], `effect ${k}`);
  }
  assert.deepEqual([...DEX_HIT_SPELLS], [[10, 500], [11, 23], [12, 501], [13, 502]]);
  const ids = Object.fromEntries([...readFileSync(join(ROOT, 'vendor/daggerfall-enemy-expansion/Scripts/BestiaryEnemySpells.cs'), 'utf8').matchAll(/const int (\w+) = (\d+);/g)].map(([, n, v]) => [n, Number(v)]));
  const cases = [...CS.matchAll(/case (1\d):\s*SetSpellReady\(BestiaryEnemySpells\.(\w+)\);/g)].map(([, k, n]) => [Number(k), ids[n]]);
  assert.deepEqual(cases, [...DEX_HIT_SPELLS], 'the C#\'s own switch over BestiaryEnemySpells');
});

test('DEX4b OnMonsterHit asks a mod\'s override first and runs nothing of DFU\'s beside it', (t) => {
  t.after(reset);
  const seen = [];
  registerFormulaOverride('onMonsterHit', (a, tg, d, deps) => seen.push([a.careerIndex, d, typeof deps.readySpell]));
  const ready = [];
  onMonsterHit({ careerIndex: MOBILE_TYPES.Spider, mobileType: MOBILE_TYPES.Spider }, P(), 4, { readySpell: (i) => ready.push(i) });
  assert.deepEqual(seen, [[MOBILE_TYPES.Spider, 4, 'function']]);
  assert.deepEqual(ready, [], 'DFU\'s spider arm not run');
});

test('DEX4b the Skeletal Warrior\'s rule: a row the mod says is skeletal halves a blunt weapon and doubles silver, in the stock formula; DFU\'s own career stands', (t) => {
  t.after(reset);
  const A = { level: 1, skills: 35, stats: { strength: 75, agility: 50, luck: 50 }, attackModifierFlags: null, isPlayer: true };
  const mace = { templateIndex: WEAPONS.Mace, material: 2, flags: 0 }, steel = { templateIndex: WEAPONS.Mace, material: 1, flags: 0 };
  const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
  const soldier = { isPlayer: false, careerIndex: 266, mobileType: 266, affinity: 'Undead' };
  const plain = weaponAttackDamage(A, soldier, 0, steel, seq(0.999));
  assert.equal(isSkeletalTarget(soldier), false);
  assert.equal(isSkeletalTarget({ careerIndex: SKELETAL_WARRIOR_INDEX }), true);
  const barbarian = { isPlayer: false, careerIndex: 15, mobileType: 143 };
  assert.equal(isSkeletalTarget(barbarian), true, 'DFU\'s test is the career (FormulaHelper.cs:740): the Barbarian rides the Skeletal Warrior\'s');
  registerSkeletalTarget((tg) => tg.mobileType === 266);
  assert.equal(isSkeletalTarget(soldier), true);
  assert.equal(isSkeletalTarget(barbarian), false, 'AUDIT DEX C2: a mod\'s word replaces DFU\'s test - its override asks the ID');
  reset();
  registerSkeletalTarget(() => null);
  assert.equal(isSkeletalTarget(barbarian), true, 'a door that answers null leaves DFU\'s');
  reset();
  registerSkeletalTarget(createDexCombatDoors(new Map(), (id) => (id === 266 ? { isSkeletal: true } : null)).skeletal);
  assert.deepEqual([soldier, barbarian, { careerIndex: SKELETAL_WARRIOR_INDEX, mobileType: SKELETAL_WARRIOR_INDEX }].map(isSkeletalTarget), [true, false, true], 'the mod\'s test (:1593-1601): its Skeletal row, the Skeletal Warrior by its ID, and no Barbarian');
  assert.equal(weaponAttackDamage(A, soldier, 0, mace, seq(0.999)), 17, 'roll 12 -> /2 6 -> silver x2 12 -> +5 Str: the Skeletal Warrior\'s 17');
  assert.equal(plain - weaponAttackDamage(A, soldier, 0, steel, seq(0.999)), 6, 'a blunt steel mace\'s roll of 12 halved');
  assert.throws(() => registerSkeletalTarget(1), /function/);
});

test('DEX4b the groups and languages: the fifty\'s from their rows - a group of None and a language of None the mod\'s answer too - and DFU\'s switch for every other', (t) => {
  t.after(reset);
  assert.equal(enemyEntityGroup(256), ENEMY_GROUPS.None, 'DFU: a career past the switch is None');
  assert.equal(enemyLanguageSkill({ isClass: true, careerIndex: 384, mobileType: 384 }), SKILLS.Etiquette, 'DFU: a class is Etiquette');
  const enemies = new Map([[256, { props: { group: 'Humanoid', language: 'Orcish' } }], [283, { props: { group: 'None', language: 'Spriggan' } }], [384, { props: { group: 'None', language: 'None' } }], [390, { props: { group: 7, language: 99 } }], [391, { props: { group: 'None', language: 'Medical' } }]]);
  const doors = createDexCombatDoors(enemies, () => null);
  registerEnemyGroup(doors.group); registerEnemyLanguage(doors.language);
  assert.equal(enemyEntityGroup(256), ENEMY_GROUPS.Humanoid);
  assert.equal(enemyEntityGroup(283), ENEMY_GROUPS.None);
  assert.equal(enemyEntityGroup(390), 7, 'a number no name took, as parsed');
  assert.equal(enemyEntityGroup(SKELETAL_WARRIOR_INDEX), ENEMY_GROUPS.Undead, 'a classic career: DFU\'s switch');
  assert.equal(enemyLanguageSkill({ isClass: false, careerIndex: 256, mobileType: 256 }), SKILLS.Orcish);
  assert.equal(enemyLanguageSkill({ isClass: true, careerIndex: 384, mobileType: 384 }), -1, 'the row\'s None over DFU\'s Etiquette');
  assert.equal(enemyLanguageSkill({ isClass: true, careerIndex: 391, mobileType: 391 }), SKILLS.Medical, 'a skill of 0 is the row\'s answer too');
  assert.equal(enemyLanguageSkill({ isClass: false, careerIndex: 1, mobileType: 1 }), SKILLS.Impish, 'the Imp: DFU\'s');
  assert.throws(() => registerEnemyGroup(null), /function/); assert.throws(() => registerEnemyLanguage(null), /function/);
});

test('AUDIT DEX C3 one group for every reader: Detect, Dispel and Pacify ask EnemyEntity.GetEnemyGroup through the door a mod answers (PlayerGPS.cs:788, PacifyEffect.cs:132) - the mod\'s Blood Spider is an animal to a Pacify Animal and a Detect\'s scan, its Goblin a humanoid, its Wisp of no group; not loaded, they are DFU\'s None', (t) => {
  t.after(reset);
  const foe = (mobileType) => ({ stats: { luck: 50, willpower: 50 }, skills: [], activeEffects: [], level: 1, health: 20, maxHealth: 20, mobileType });
  const pacifyAnimal = (target) => applySpell(buildCustomSpell({ slots: [{ type: 33, subType: 0, settings: { ...blankEffectSettings(), chanceBase: 100, chanceMod: 0 } }], rangeType: 1 }), 1, target, {}, (() => { let i = 0; return () => (i++ === 0 ? 0 : 0.99); })(), null, {});
  installEnemyExpansion({ on: false, log: silent });
  assert.equal(enemyGroupOf(271), NEARBY.None, 'not loaded: a career past DFU\'s switch is None');
  assert.equal(pacifyAnimal(foe(271)).pacify, undefined);
  reset();
  installEnemyExpansion({ on: true, log: silent });
  assert.equal(enemyEntityGroup(271), ENEMY_GROUPS.Animals, 'the door: the mod\'s row');
  assert.equal(enemyGroupOf(271), NEARBY.Animal, 'and the scan\'s group reads the same door');
  assert.equal(entityFlags({ mobileType: 256 }), NEARBY.Enemy | NEARBY.Humanoid, 'GetEntityFlags: the Goblin an enemy and a humanoid');
  assert.equal(entityFlags({ mobileType: 283 }), NEARBY.Enemy, 'the Wisp, whose row names None, takes no group bit');
  const scan = [{ flags: entityFlags({ mobileType: 271 }), distance: 3, active: true }, { flags: entityFlags({ mobileType: 256 }), distance: 3, active: true }];
  assert.equal(getNearbyObjects(scan, NEARBY.Enemy | NEARBY.Animal).length, 1, 'a Detect of animals (and Dispel\'s sweep over the same scan) finds the spider alone');
  assert.equal(pacifyAnimal(foe(271)).pacify, true, 'Pacify Animal calms it');
  assert.equal(pacifyAnimal(foe(256)).pacify, undefined, 'and not the Goblin');
  assert.equal(enemyGroupOf(128), NEARBY.Animal, 'a class still rides its colliding career (F080), the mod or not');
});

test('AUDIT DEX C6 a rider\'s spell is readied from the merged standard list in both hosts - the mod\'s 500-503 among SPELLS.STD\'s', () => {
  const read = (f) => readFileSync(join(ROOT, f), 'utf8');
  const dc = read('src/scenes/dungeonContext.js'), xf = read('src/scenes/exteriorFoes.js');
  assert.match(dc, /readySpell: \(index\) => \{[^\n]*\n\s*const sp = spellsByIndex\?\.get\(index\);\n\s*if \(sp\) castEnemySpell\(f, sp, true\);/, 'the dungeon: the spell by its index, cast free (SetReadySpell(spell, true))');
  assert.match(dc, /const \{ spellsByIndex \} = await loadMagicRegistries\(fetchBytes\);/, 'and its map the registries\' - the one fold over SPELLS.STD and every mod\'s records');
  assert.match(xf, /readySpell: \(index\) => \{[^\n]*\n\s*const sp = spellsByIndex\?\.\(\)\?\.get\(index\);\n\s*if \(sp\) castSpellFrom\(f, sp, playerFeet, true\);/, 'the street\'s pool the same');
  const shared = read('src/scenes/shared.js');
  assert.match(shared, /const byIndex = standardSpellsByIndex\(await fetch\('SPELLS\.STD'\)\);/, 'the registries\' map is the merged fold (DEX4a)');
});

test('DEX4b the forced gender: after the unit\'s roll, never instead of it - the DFRandom draw is spent as it was, and the row\'s gender stands over the roll, a given gender and a monster\'s unspecified', (t) => {
  t.after(reset);
  const human = { affinity: 'Human' };
  srand(1234); const rolled = MobileUnit.resolveGender('unspecified', human, 384); const after = getSeed();
  registerForcedGender((id) => (id === 384 ? 'male' : id === 392 ? 'female' : null));
  srand(1234);
  assert.equal(MobileUnit.resolveGender('unspecified', human, 384), 'male');
  assert.equal(getSeed(), after, 'the roll still drawn');
  srand(1234);
  assert.equal(MobileUnit.resolveGender('unspecified', human, 391), rolled, 'no word: the roll');
  assert.equal(MobileUnit.resolveGender('male', human, 392), 'female', 'over a given gender');
  assert.equal(MobileUnit.resolveGender('unspecified', { affinity: 'Animal' }, 392), 'female', 'over a monster\'s unspecified');
  assert.throws(() => registerForcedGender('x'), /function/);
});

test('DEX4b the install: loaded, the Blood Spider readies its Blood Leech, the Lizard Man a spider\'s touch, the Nymph drains fatigue; the Skeletal Soldier takes the rule; the Goblin is Humanoid and speaks Orcish; the Druid is male - and not loaded, none of it', (t) => {
  t.after(reset);
  installEnemyExpansion({ on: false, log: silent });
  const ready = [];
  onMonsterHit({ careerIndex: 271, mobileType: 271 }, P(), 3, { readySpell: (i) => ready.push(i), rolls: () => 0.5 });
  assert.deepEqual(ready, []);
  assert.equal(isSkeletalTarget({ careerIndex: 266, mobileType: 266 }), false);
  assert.equal(isSkeletalTarget({ careerIndex: 15, mobileType: 143 }), true, 'DFU\'s Barbarian, its career the Skeletal Warrior\'s');
  assert.equal(enemyEntityGroup(256), ENEMY_GROUPS.None);
  assert.equal(MobileUnit.resolveGender('female', { affinity: 'Human' }, 384), 'female');
  reset();
  installEnemyExpansion({ on: true, log: silent });
  const read = dexRead({ log: silent });
  onMonsterHit({ careerIndex: 271, mobileType: 271 }, P(), 3, { readySpell: (i) => ready.push(i), rolls: () => 0.5 });
  onMonsterHit({ careerIndex: 258, mobileType: 258 }, P(), 3, { readySpell: (i) => ready.push(i), rolls: () => 0.5 });
  assert.deepEqual(ready, [500, 66]);
  const fat = [];
  onMonsterHit({ careerIndex: 268, mobileType: 268 }, P(), 3, { sinks: { drainFatigue: (n) => fat.push(n) }, rolls: () => 0.5 });
  assert.deepEqual(fat, [3 * 2 * 64], 'the Nymph\'s row names 5: FatigueDamage');
  assert.equal(isSkeletalTarget({ careerIndex: 266, mobileType: 266 }), true);
  assert.equal(isSkeletalTarget({ careerIndex: 265, mobileType: 265 }), false);
  assert.equal(isSkeletalTarget({ careerIndex: 15, mobileType: 143 }), false, 'AUDIT DEX C2: and the mod\'s, none');
  assert.equal(enemyEntityGroup(256), ENEMY_GROUPS.Humanoid);
  assert.equal(enemyEntityGroup(271), ENEMY_GROUPS.Animals);
  assert.equal(enemyLanguageSkill({ isClass: false, careerIndex: 256, mobileType: 256 }), SKILLS.Orcish);
  assert.equal(enemyLanguageSkill({ isClass: true, careerIndex: 384, mobileType: 384 }), SKILLS.Streetwise);
  assert.equal(MobileUnit.resolveGender('female', { affinity: 'Human' }, 384), 'male');
  assert.equal(MobileUnit.resolveGender('male', { affinity: 'Human' }, 392), 'female');
  // every forced row draws one picture for both genders, so the forced gender moves the voice alone
  for (const [id, e] of read.enemies) if (e.props.forcedGender !== 'Unspecified') assert.equal(e.row.maleTexture, e.row.femaleTexture, `${id}`);
});
