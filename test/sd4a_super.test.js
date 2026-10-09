// SD4a (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 5): THE SUPER DUNGEON'S
// DIFFICULTY (world/sdDungeon.js) - the port's hardest. A Hollow is a Super dungeon by its location's word
// (systems/dungeonTier.js), read once by the dungeon host: three foes at every enemy marker as an Elite's, each x4
// health and x2.5 damage, its random foes rolled at the encounter tables' top band and a class foe built at the band's
// level, six elite foes among them (each the Elite Dungeon's stack read the Super's way), loot +50% drop and quality on
// bodies and piles, and no fire of its own - the Hour is cold.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SUPER_HEALTH_SCALE, SUPER_DAMAGE_SCALE, SUPER_FOE_LEVEL_MIN, SUPER_ELITE_FOES, SUPER_LOOT_DROP_MULT, SUPER_LOOT_QUALITY_MULT,
  SUPER_LOOT_OPTS, superFoeLevel, scaleSuperFoe,
} from '../src/world/sdDungeon.js';
import { ELITE_FOE_MULTIPLIER, ELITE_HEALTH_SCALE, ELITE_DAMAGE_SCALE, ELITE_LOOT_DROP_MULT, ELITE_LOOT_QUALITY_MULT } from '../src/world/spawnedDungeons.js';
import {
  promoteEliteFoe, pickDungeonElites, ELITE_FOE_SUPER_DUNGEON_HEALTH_MULT, ELITE_FOE_SUPER_DUNGEON_DAMAGE_MULT,
  ELITE_FOE_ELITE_DUNGEON_HEALTH_MULT, ELITE_FOE_ELITE_DUNGEON_DAMAGE_MULT, ELITE_FOE_HEALTH_MULT, ELITE_FOE_DAMAGE_MULT,
} from '../src/systems/eliteFoes.js';
import { chooseRandomEnemyType, alternateRandomEnemyType, collectDungeonEnemies, expandEliteEnemies, makeSlotRng } from '../src/characters/dungeonEnemies.js';
import { ENCOUNTER_TABLES } from '../src/characters/encounterTables.js';
import { srand } from '../src/formats/dfRandom.js';
import { dungeonFirePlan } from '../src/world/dungeonFires.js';
import { dungeonTier } from '../src/systems/dungeonTier.js';
import { applyChampion } from '../src/systems/champions.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DC = read('src/scenes/dungeonContext.js');
/** A function of the dungeon host's, by its own text (`  function name(` to its closing brace at the same depth). */
const fnSrc = (name) => {
  const at = DC.indexOf(`\n  function ${name}(`);
  assert.ok(at > 0, `the host declares ${name}`);
  return DC.slice(at + 1, DC.indexOf('\n  }\n', at) + 4);
};
/** The host's applyEliteScaling and eliteLootOpts, run over the real laws. */
function hostScale() {
  const body = `${fnSrc('eliteLootOpts')}\n${fnSrc('applyEliteScaling')}\nreturn { eliteLootOpts, applyEliteScaling };`;
  return new Function('promoteEliteFoe', 'scaleSuperFoe', 'applyChampion', 'SUPER_LOOT_OPTS', 'ELITE_LOOT_DROP_MULT', 'ELITE_LOOT_QUALITY_MULT', 'ELITE_HEALTH_SCALE', 'ELITE_DAMAGE_SCALE', '_wildDungeon', '_wildRing', 'wildLootOpts', body)(
    promoteEliteFoe, scaleSuperFoe, applyChampion, SUPER_LOOT_OPTS, ELITE_LOOT_DROP_MULT, ELITE_LOOT_QUALITY_MULT, ELITE_HEALTH_SCALE, ELITE_DAMAGE_SCALE, false, 0, (o) => o);   // WILD1: a dungeon out of the open zone
}
const foe = (over = {}) => ({ maxHealth: 60, health: 60, level: 10, mobileType: 20, team: 'Monster', ...over });

test('SD4a the numbers: x4 health and x2.5 damage, at least level 24, six elites, +50% loot - the Elite\'s x2/x2, +20%, three at a marker beside them (mutants: the band floor lost; the scale the Elite\'s)', () => {
  assert.deepEqual([SUPER_HEALTH_SCALE, SUPER_DAMAGE_SCALE, SUPER_FOE_LEVEL_MIN, SUPER_ELITE_FOES, SUPER_LOOT_DROP_MULT, SUPER_LOOT_QUALITY_MULT], [4, 2.5, 24, 6, 1.5, 1.5]);
  assert.deepEqual([ELITE_FOE_MULTIPLIER, ELITE_HEALTH_SCALE, ELITE_DAMAGE_SCALE], [3, 2, 2], 'the Elite\'s, which a Super dungeon\'s expansion is');
  assert.deepEqual(SUPER_LOOT_OPTS, { lootDropMult: 1.5, lootQualityMult: 1.5 });
  assert.ok(Object.isFrozen(SUPER_LOOT_OPTS));
  assert.equal(superFoeLevel(1), 24);
  assert.equal(superFoeLevel(23.9), 24);
  assert.equal(superFoeLevel(31), 31, 'a stronger player\'s own');
  assert.equal(superFoeLevel(undefined), 24);
  assert.equal(superFoeLevel(NaN), 24);
  const e = scaleSuperFoe(foe({ healthMult: 1.5 }));
  assert.deepEqual({ maxHealth: e.maxHealth, health: e.health, healthMult: e.healthMult, damageScale: e.damageScale, elite: e.elite }, { maxHealth: 240, health: 240, healthMult: 6, damageScale: 2.5, elite: true });
  assert.equal(scaleSuperFoe(null), null);
  assert.equal(scaleSuperFoe(foe({ maxHealth: 0 })).maxHealth, 4, 'never a body of nothing');
});

test('SD4a the band: at 24 every random foe is drawn from the table\'s top six rows on both of ChooseRandomEnemyType\'s arms - at 18 it is not; the alternate arm\'s power is full (mutants: the band floor lost)', () => {
  for (const [t, table] of ENCOUNTER_TABLES.entries()) {
    const top = new Set(table.slice(14));
    srand(1000 + t);
    for (let i = 0; i < 400; i++) assert.ok(top.has(chooseRandomEnemyType(table, superFoeLevel(1))), `table ${t}`);
  }
  const low = ENCOUNTER_TABLES[0];
  srand(7);
  let under = 0;
  for (let i = 0; i < 400; i++) if (!low.slice(14).includes(chooseRandomEnemyType(low, 18))) under++;
  assert.ok(under > 0, 'past the band\'s edge, a plain dungeon\'s roll reaches lower rows');
  const rng = makeSlotRng(99);
  for (let i = 0; i < 200; i++) assert.ok(new Set(low.slice(16)).has(alternateRandomEnemyType(low, 24, rng)), 'the alternate arm at full power');
});

test('SD4a the list: a Super dungeon\'s layout rolled at the band, three at every marker, each record saying so, six elites picked the same on every client (mutants: two at a marker; the pick\'s count lost)', () => {
  const markers = Array.from({ length: 12 }, (_, i) => ({ record: 15, x: i * 4, y: 0, z: 0, rawY: 0, flags: 1 + (i % 6), actionByte: 0, soundIndex: 0, loadID: i }));
  const blocks = [{ markers, waterLevel: 10000, originX: 0, originZ: 0 }];
  const layout = collectDungeonEnemies(blocks, { locationId: 4242, dungeonType: 0, playerLevel: superFoeLevel(1), alternate: false });
  assert.equal(layout.length, 12);
  const top = new Set(ENCOUNTER_TABLES[0].slice(14));
  assert.ok(layout.every((e) => top.has(e.mobileType)), 'the top band');
  const list = expandEliteEnemies(layout, { copies: ELITE_FOE_MULTIPLIER });
  for (const e of list) e.superTier = true;
  assert.equal(list.length, 36, 'three at every marker');
  assert.ok(list.every((e) => e.elite === true && e.superTier === true));
  const twin = expandEliteEnemies(layout, { copies: ELITE_FOE_MULTIPLIER });
  assert.equal(pickDungeonElites(list, 4242, { elite: true, count: SUPER_ELITE_FOES }), 6);
  assert.equal(pickDungeonElites(twin, 4242, { elite: true, count: SUPER_ELITE_FOES }), 6);
  assert.deepEqual(list.map((e) => !!e.eliteFoe), twin.map((e) => !!e.eliteFoe), 'every client marks the same records');
  // fewer foes than six: all that may stand; never a passive one or an ally; a count of nothing, none
  const few = [foe({ mobileType: 20 }), foe({ mobileType: 20, reaction: 'passive' }), foe({ mobileType: 20, allied: true }), foe({ mobileType: 20 })];
  assert.equal(pickDungeonElites(few, 1, { count: SUPER_ELITE_FOES }), 2);
  assert.deepEqual(few.map((e) => !!e.eliteFoe), [true, false, false, true]);
  assert.equal(pickDungeonElites([foe(), foe()], 1, { count: 0 }), 0);
});

test('SD4a the elites: a Super dungeon\'s elite is the Elite Dungeon\'s stack read the Super\'s way - its health the dungeon\'s and the elite\'s added (x9), its damage the dungeon\'s and the elite\'s extra (x4.5) - and a Super\'s word wins over the Elite mark its records also carry (mutants: the Elite Dungeon\'s stack in a Super)', () => {
  assert.deepEqual([ELITE_FOE_SUPER_DUNGEON_HEALTH_MULT, ELITE_FOE_SUPER_DUNGEON_DAMAGE_MULT], [SUPER_HEALTH_SCALE + ELITE_FOE_HEALTH_MULT, SUPER_DAMAGE_SCALE + (ELITE_FOE_DAMAGE_MULT - 1)]);
  assert.deepEqual([ELITE_FOE_ELITE_DUNGEON_HEALTH_MULT, ELITE_FOE_ELITE_DUNGEON_DAMAGE_MULT], [ELITE_HEALTH_SCALE + ELITE_FOE_HEALTH_MULT, ELITE_DAMAGE_SCALE + (ELITE_FOE_DAMAGE_MULT - 1)], 'the Elite\'s own, read the same way');
  const s = foe();
  assert.ok(promoteEliteFoe(s, { eliteDungeon: true, superDungeon: true, checkLevel: false }));
  assert.deepEqual([s.maxHealth, s.damageScale], [540, 4.5]);
  const el = foe();
  promoteEliteFoe(el, { eliteDungeon: true, checkLevel: false });
  assert.deepEqual([el.maxHealth, el.damageScale], [420, 4]);
  const plain = foe();
  promoteEliteFoe(plain);
  assert.deepEqual([plain.maxHealth, plain.damageScale], [300, 3]);
  const pup = foe({ damageScale: 1 });
  promoteEliteFoe(pup, { own: false, superDungeon: true });
  assert.deepEqual([pup.maxHealth, pup.damageScale], [60, 4.5], 'a puppet: its owner\'s maximum, the Super\'s blows');
});

test('SD4a the host\'s scale and loot, run: a Super record x4 / x2.5 with the Elite mark, its elite x9 / x4.5, its body +50% - an Elite record and a plain one as they were (mutants: the Super\'s scale lost; the Elite\'s doubling in a Super; the loot the Elite\'s)', () => {
  const { eliteLootOpts, applyEliteScaling } = hostScale();
  const sup = foe();
  applyEliteScaling(sup, { elite: true, superTier: true });
  assert.deepEqual([sup.maxHealth, sup.damageScale, sup.elite, sup.healthMult], [240, 2.5, true, 4]);
  const supElite = foe();
  applyEliteScaling(supElite, { elite: true, superTier: true, eliteFoe: true });
  assert.deepEqual([supElite.maxHealth, supElite.damageScale, supElite.eliteFoe, supElite.elite], [540, 4.5, true, true]);
  const refused = foe({ team: 'PlayerAlly' });
  applyEliteScaling(refused, { elite: true, superTier: true, eliteFoe: true });
  assert.deepEqual([refused.maxHealth, refused.damageScale, !!refused.eliteFoe], [240, 2.5, false], 'a refused promotion falls through to the Super\'s scale');
  const el = foe();
  applyEliteScaling(el, { elite: true });
  assert.deepEqual([el.maxHealth, el.damageScale], [120, 2], 'an Elite dungeon\'s as it was');
  const pl = foe();
  applyEliteScaling(pl, {});
  assert.deepEqual([pl.maxHealth, pl.damageScale], [60, undefined], 'a plain one untouched');
  assert.equal(eliteLootOpts({ elite: true, superTier: true }), SUPER_LOOT_OPTS);
  assert.deepEqual(eliteLootOpts({ elite: true }), { lootDropMult: 1.2, lootQualityMult: 1.2 });
  assert.deepEqual(eliteLootOpts({}), {});
});

test('SD4a no fire of its own: the fire plan for a Super dungeon is empty and casts no ray - the Hour is cold (mutants: the fires lit)', () => {
  const probe = { floor: () => { throw new Error('no ray in a cold dungeon'); }, room: () => true };
  assert.deepEqual(dungeonFirePlan({ blocks: [{ name: 'N0000001.RDB', layout: { markers: [] }, originX: 0, originZ: 0 }], probe, cold: true }), { fires: [], doorFire: null, candidates: 0, valid: 0 });
  assert.throws(() => dungeonFirePlan({ blocks: [{ name: 'N0000001.RDB', layout: { markers: [{ record: 10, x: 0, y: 0, z: 0 }] }, originX: 0, originZ: 0 }], probe }), /no ray/, 'without the word it asks');
});

test('SD4a the host by source: the tier read once by its one law before the fires; the fires cold; the layout and the rest rolled at the band and a class foe built at it; the Elite\'s expansion; each record marked; six elites; the piles +50% (mutants: the tier read as the Elite\'s; the rest at the player\'s level; the class foe at the player\'s level; the piles the Elite\'s)', () => {
  assert.match(DC, /\n {2}const _superTier = dungeonTier\(dfLocation\) === 'super';\n/);
  assert.equal(dungeonTier({ hasDungeon: true, superTier: true, elite: false }), 'super');
  const tier = DC.indexOf('const _superTier = ');
  const fires = DC.indexOf('  const firePlan = isGateArena(dfLocation)');
  assert.ok(tier > 0 && fires > tier, 'read before the fires');
  assert.match(DC.slice(fires, fires + 1200), /\n {4}cold: _superTier(?: \|\| _sdRealm)?,[^\n]*\n {2}\}\);/);   // SD5a (PIN MOVED): and the Shattered Hour's
  assert.match(DC, /playerLevel: _superTier \? superFoeLevel\(effectiveLevel\(playerEntity\)\) : effectiveLevel\(playerEntity\),[^\n]*SOFTCAP2: a mentor's dungeon/, 'the layout\'s roll');
  assert.match(DC, /playerLevel: _superTier \? superFoeLevel\(effectiveLevel\(playerEntity\)\) : effectiveLevel\(playerEntity\),[^\n]*SOFTCAP2: mentor mode/, 'the rest\'s roll');
  assert.match(DC, /D\.makeEnemyEntity\(e\.mobileType, basics, cf\.career, e\.level \?\? \(_superTier \? superFoeLevel\(effectiveLevel\(D\.playerEntity\)\) : effectiveLevel\(D\.playerEntity\)\)\);/, 'a class foe at the band (a revenant\'s or a bout\'s own level first)');
  assert.match(DC, /const enemies = dfLocation\?\.elite \|\| _superTier[^\n]*\n {4}\? expandEliteEnemies\(_layoutEnemies, \{\n {6}copies: ELITE_FOE_MULTIPLIER,/);
  assert.match(DC, /\n {2}if \(_superTier\) for \(const e of enemies\) e\.superTier = true;/);
  assert.ok(DC.indexOf('if (_superTier) for (const e of enemies) e.superTier = true;') < DC.indexOf('if (elitesAllowed({ onlinePage: isOnlinePage()'), 'marked before the pick and every build');
  assert.match(DC, /pickDungeonElites\(enemies, [^\n]*\{ elite: !!dfLocation\?\.elite, count: _superTier \? SUPER_ELITE_FOES : null \}\);/);
  assert.match(DC, /generateLootItems\(lootKey, [^\n]*, undefined, _superTier \? \{ itemChanceScale: SUPER_LOOT_DROP_MULT \} : elite \? \{ itemChanceScale: ELITE_LOOT_DROP_MULT \} : \{\}\);/);
  assert.match(DC, /qualityMult: _superTier \? SUPER_LOOT_QUALITY_MULT : elite \? ELITE_LOOT_QUALITY_MULT : 1,/);
  assert.match(read('bible/11-Multiplayer/Super-Dungeons.md'), /### SD4a - shipped 2026-10-07/);
});
