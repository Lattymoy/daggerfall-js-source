// DEX1 (2026-10-19, Mac: "I want to implement this as our next mod 1:1") - DAGGERFALL ENEMY EXPANSION: THE ENEMY
// REGISTRY. BestiaryMod.Start's reading (systems/enemyExpansion/dexTables.js) of the shipped tables, and what the install
// (dexInstall.js) makes of it in the port: the fifty enemies in the table, their careers resolving, DFU's entity type
// and career index for an id past MobileTypes, the classic rows edited in DFU's order over Meaner Monsters', the names,
// the quest foes added only where the Foes table lacks the name - each pinned against the C#'s own law, and each with a
// mutation it must fail under.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEX_TABLE_TEXT } from '../../../src/systems/enemyExpansion/dexTableText.js';
import {
  classicCareers, readCareerTable, readEnemyTables, careerFromSpec, newCareer, setTolerance, setAttackModifier, parseEnum,
  newMobileEnemy, isMonsterId, classicCareerName, MOBILE_TEAMS, ENEMY_GROUPS,
} from '../../../src/systems/enemyExpansion/dexTables.js';
import { installEnemyExpansion, _resetEnemyExpansion, dexProperties, dexEnemyIds, dexRead, dexClassicRow } from '../../../src/systems/enemyExpansion/dexInstall.js';
import { ENEMY_BASICS, VANILLA_ENEMY_BASICS, enemyEntityType, enemyCareerIndex, enemyDisplayName, isClassicEnemyId, enemyLevelOf } from '../../../src/characters/enemy/enemyBasics.js';
import { customCareerTemplate, clearCustomEnemies } from '../../../src/characters/enemy/customEnemies.js';
import { makeEnemyEntity, loadEnemyCareer, _resetMintRowEditors } from '../../../src/characters/enemy/enemyEntity.js';
import { careerTolerance } from '../../../src/systems/spellcast.js';
import { careerAttackModifier } from '../../../src/combat/formulas.js';
import { applyMeanerMonsters, MEANER_MONSTERS_EDIT } from '../../../src/characters/meanerMonsters.js';
import { meanerMonstersRow as pcaaoMeanerMonstersRow, meanerMonstersOn } from '../../../src/combat/pcaaoMeanerMonsters.js';
import { KG_ROSTER, makeUnit } from '../../../src/net/kingsGambit.js';
import { loadQuestTables, foesTable, addIntoQuestTables, _resetExtraQuestRows } from '../../../src/systems/quest/tables.js';
import { adaptBlowClass } from '../../../src/systems/revenant/revenantFeud.js';   // AUDIT DEX A2
import { MOBILE_TYPES } from '../../../src/characters/mobile/mobileTypes.js';
import { DEX_ENEMY_NAME_TEXT } from '../../../src/systems/enemyExpansion/dexNames.js';   // AUDIT DEX A6
import { getLocalizedEnemyName, parseStringTableCsv, patchLocaleTable, setLocale, clearLocaleTables } from '../../../src/systems/textManager.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ARENA2 = process.env.ARENA2_PATH;
const arenaBytes = (name) => {
  const p = [name, name.toUpperCase(), name.toLowerCase()].map((n) => join(ARENA2, n)).find((p) => existsSync(p));
  if (!p) throw new Error(`${name} not in ARENA2`);
  return new Uint8Array(readFileSync(p));
};
const silent = () => {};
const files = (ext) => Object.entries(DEX_TABLE_TEXT).filter(([n]) => n.endsWith(ext)).map(([n, t]) => [n.replace(/\.csv$/, ''), t]);
const readAll = (liveRow = (id) => ENEMY_BASICS[id]) => {
  const careers = classicCareers();
  for (const [n, t] of files('.cdb.csv')) readCareerTable(t, careers, n, silent);
  return { careers, ...readEnemyTables(files('.mdb.csv'), careers, { liveRow, isClassic: isClassicEnemyId, log: silent }) };
};

test('DEX1 the reading: forty-three careers of the mod\'s own beside DFU\'s 62, fifty enemies, eighteen classic edits - and no line refused', () => {
  const log = [];
  const careers = classicCareers();
  for (const [n, t] of files('.cdb.csv')) readCareerTable(t, careers, n, (l, m) => log.push(`${l} ${m}`));
  assert.equal(careers.size, 43 + 18 + 1 + 43, 'MonsterCareers 0-42, ClassCareers 0-17, Guard, and the mod\'s 43');
  const read = readEnemyTables(files('.mdb.csv'), careers, { liveRow: (id) => ENEMY_BASICS[id], isClassic: isClassicEnemyId, log: (l, m) => log.push(`${l} ${m}`) });
  assert.deepEqual(log, [], 'the shipped tables read clean - every line the C# reads, read');
  assert.deepEqual([...read.enemies.keys()], [...Array.from({ length: 15 }, (_, i) => 384 + i), ...Array.from({ length: 35 }, (_, i) => 256 + i)], 'ClassBase first, as GetDBAssets walks the manifest');
  assert.deepEqual([...read.classic.keys()].sort((a, b) => a - b), [2, 4, 5, 6, 9, 14, 17, 25, 26, 34, 35, 36, 37, 38, 41, 42, 140, 143]);
  // the raw spellbooks: every MonsterBase/ClassBase Spellbook cell that starts with a digit or a bracket, named after its id
  const raw = [];
  for (const [, text] of files('.mdb.csv')) {
    const lines = text.split('\r\n').filter(Boolean);
    const at = lines[0].split(',').indexOf('Spellbook');
    if (at < 0) continue;
    for (const l of lines.slice(1)) { const cells = l.match(/("[^"]*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '')); if (/^[\d[{]/.test(cells[at] ?? '')) raw.push([cells[0], cells[at].split(',').map(Number)]); }
  }
  assert.ok(raw.length >= 7, 'the cells are read');
  assert.deepEqual([...read.spellbooks], raw, 'the raw spellbooks, named after their ids');
  assert.deepEqual(read.spellbooks.get('261'), [35], 'the Medusa\'s');
});

test('DEX1 a new enemy\'s row is MonsterBase\'s line over a new MobileEnemy - every column, and the C#\'s defaults only where it gives them', () => {
  const { enemies } = readAll();
  const goblin = enemies.get(256);
  assert.deepEqual(goblin.props, { name: 'Goblin', career: 'Goblin', group: 'Humanoid', language: 'Orcish', spellbookTable: null, onHitEffect: 0,
    forcedGender: 'Unspecified', isTransparent: false, isSkeletal: false, hasRangedAttack: false, hasNoSpellAnimations: false, equipmentTable: null });
  const g = goblin.row;
  assert.equal(g.level, 2); assert.equal(g.behaviour, 'General'); assert.equal(g.affinity, 'Darkness'); assert.equal(g.team, 'Orcs');
  assert.deepEqual([g.maleTexture, g.femaleTexture, g.corpseTexture], [1600, 1600, { archive: 1600, record: 20 }]);
  assert.deepEqual(g.primaryAttackAnimFrames, [0, 1, 2, 3, -1, 3, 4]);
  assert.deepEqual([g.minDamage, g.maxDamage, g.minHealth, g.maxHealth, g.armorValue, g.weight], [1, 6, 11, 20, 2, 200]);
  assert.deepEqual([g.canOpenDoors, g.lootTableKey, g.moveSound, g.barkSound, g.attackSound, g.parrySounds], [true, 'A', 204, 314, 138, true]);
  assert.equal(g.minMetalToHit, 0, 'no MinMetalToHit cell: the struct\'s zero - Iron, not the classic rows\' None');
  assert.equal(g.hasRangedAttack1, false); assert.equal(g.hasRangedAttack2, false);
  // the Homunculus casts: HasRangedAttack1 from CastsMagic, NoSpellAnims keeps HasSpellAnimation off, the default frames
  const h = enemies.get(257);
  assert.deepEqual([h.row.castsMagic, h.row.hasRangedAttack1, h.row.hasRangedAttack2, h.row.hasSpellAnimation, h.row.spellAnimFrames], [true, true, false, undefined, [0, 1, 2, 3, 3]]);
  assert.equal(h.row.minMetalToHit, 4, 'Dwarven');
  assert.equal(h.props.spellbookTable, '257');
  // the Hell Hound's glow, float.Parse's floats, alpha the fourth
  const hh = enemies.get(264).row.glowColor;
  assert.deepEqual(hh, { r: Math.fround(12.15), g: Math.fround(11.95), b: Math.fround(2.2), a: Math.fround(0.05) });
  // the Skeletal Soldier: Skeletal is Undead with isSkeletal; NoBlood is BloodIndex 2
  const sk = enemies.get(266);
  assert.equal(sk.row.affinity, 'Undead'); assert.equal(sk.props.isSkeletal, true); assert.equal(sk.row.bloodIndex, 2);
  // the Minotaur's second attack: its frames, its chance from the cell (35); the Iron Golem's third at its cell (35)
  assert.equal(enemies.get(269).row.chanceForAttack2, 35);
  assert.equal(enemies.get(270).row.chanceForAttack3, 35);
});

test('DEX1 a new class\'s row: the human sounds by the C#\'s own hand - 243 to move, and the attack default written to the BARK (the slip kept)', () => {
  const { enemies } = readAll();
  const druid = enemies.get(384);
  assert.equal(druid.row.moveSound, 243);
  assert.equal(druid.row.barkSound, 245, 'BarkSound 244, then the AttackSound arm writes 245 over it (:1200)');
  assert.equal(druid.row.attackSound, 0, 'AttackSound stays the struct\'s zero');
  assert.equal(druid.row.level, 0, 'a class is levelled by the player - no Level default for a non-monster id');
  assert.deepEqual(druid.props.forcedGender, 'Male');
  assert.equal(druid.props.spellbookTable, 'Class');
  assert.equal(druid.props.equipmentTable, 'Mage');
  // the Bounty Hunter's ranged: no CastsMagic, HasRangedAttack TRUE -> the ranged frames' default and HasRangedAttack1
  const bh = enemies.get(390).row;
  assert.deepEqual([bh.hasRangedAttack1, bh.hasRangedAttack2, bh.rangedAttackAnimFrames], [true, false, [3, 2, 0, 0, 0, -1, 1, 1, 2, 3]]);
  // the riders' corpses, male and female
  assert.deepEqual([enemies.get(386).row.corpseTexture, enemies.get(386).row.femaleCorpseTexture], [{ archive: 1500, record: 20 }, { archive: 1530, record: 20 }]);
});

test('DEX1 a classic line edits the row as it finds it, and keeps every field it does not name', () => {
  const { classic } = readAll();
  const bear = classic.get(4).row;
  assert.deepEqual([bear.maleTexture, bear.femaleTexture], [457, 457], 'ClassicMonsterReplacement: the smooth bear');
  assert.deepEqual([bear.minDamage, bear.maxDamage, bear.minDamage2, bear.maxDamage2, bear.minDamage3, bear.maxDamage3], [1, 12, 0, 0, 0, 0]);
  assert.equal(bear.minHealth, ENEMY_BASICS[4].minHealth, 'no MinHealth cell: the row\'s own');
  assert.equal(classic.get(2).row.team, 'Nymphs', 'the Spriggan joins the Nymphs');
  const barbarian = classic.get(143);
  assert.deepEqual([barbarian.row.maleTexture, barbarian.row.femaleTexture], [1507, 1508]);
  assert.equal(barbarian.props.hasRangedAttack, true, 'InitializeDefaultClassicCustomProperties: a barbarian starts ranged (HasClassicRangedAttack)');
  assert.equal(barbarian.row.hasRangedAttack1, true);
});

test('DEX1 the careers: a new one is a new DFCareer, its tolerances and attack modifiers read back through the port\'s own readers', () => {
  const careers = classicCareers();
  for (const [n, t] of files('.cdb.csv')) readCareerTable(t, careers, n, silent);
  const troll = careerFromSpec(careers.get('Troll'));
  assert.deepEqual([troll.hitPointsPerLevel, troll.strength, troll.endurance, troll.luck], [15, 80, 90, 50]);
  const tol = (c, f) => careerTolerance(c, { Paralysis: 1, Magic: 2, Poison: 4, Fire: 8, Frost: 16, Shock: 32 }[f]);
  assert.deepEqual(['Magic', 'Fire', 'Frost', 'Shock', 'Poison', 'Paralysis'].map((f) => tol(troll, f)), ['Resistant', 'CriticalWeakness', 'Resistant', 'Resistant', 'LowTolerance', 'Normal']);
  const golem = careerFromSpec(careers.get('IronGolem'));
  assert.equal(careerAttackModifier(golem.attackModifierFlags, ENEMY_GROUPS.Humanoid), 1, 'HumanoidAttackModifier Bonus');
  assert.equal(careerAttackModifier(golem.attackModifierFlags, ENEMY_GROUPS.Undead), 0);
  assert.deepEqual(['Magic', 'Shock', 'Poison', 'Paralysis'].map((f) => tol(golem, f)), ['LowTolerance', 'Immune', 'Immune', 'Immune']);
  // the setters clear what was there: a Resistant bit made Immune is no longer Resistant (GetTolerance reads Resistant first)
  const c = newCareer('x');
  setTolerance(c, 'Fire', 'Resistant'); setTolerance(c, 'Fire', 'Immune');
  assert.equal(tol(c, 'Fire'), 'Immune');
  setAttackModifier(c, 'Daedra', 'Phobia'); assert.equal(careerAttackModifier(c.attackModifierFlags, ENEMY_GROUPS.Daedra), -1);
  setAttackModifier(c, 'Daedra', 'Normal'); assert.equal(c.attackModifierFlags, 0);
  // a classic name is a reference to the classic career (careerFromSpec copies it), never a new one
  assert.deepEqual(careers.get('GiantBat').base, { kind: 'monster', index: 3 });
  assert.deepEqual(careers.get('Guard').base, { kind: 'class', index: 18 });
});

test('AUDIT DEX A10 a replacement career is written in place as its line reads: a throw keeps what it wrote before it, a cell past a short line throws (IndexOutOfRange) - and a new career is added only at its line\'s end', () => {
  const run = (text) => { const careers = classicCareers(), log = []; readCareerTable(text, careers, 'X', (l, m) => log.push(m)); return { careers, log }; };
  const applied = (spec) => { const c = newCareer(spec.name); for (const e of spec.edits) e(c); return c; };
  const a = run('Name,Strength,Fire\nRat,99,Bogus');
  assert.equal(applied(a.careers.get('Rat')).strength, 99, 'Strength written (:435-438) before Fire\'s Enum.Parse threw (:530-533)');
  assert.match(a.log[0], /Error while parsing X:2/);
  const b = run('Name,Luck,Speed,Strength\nRat,40');
  assert.equal(b.careers.get('Rat').edits.length, 0, 'tokens[Strength] past the line threw before Luck was read: nothing written');
  assert.match(b.log[0], /Error while parsing X:2: Index was outside the bounds of the array\./);
  const c = run('Name,HitPointsPerLevel,Strength,Intelligence,Willpower,Agility,Endurance,Personality,Speed,Luck,Fire\nNewOne,5,5,5,5,5,5,5,5,5,Bogus');
  assert.equal(c.careers.has('NewOne'), false, 'a new career that threw is never added');
});

test('DEX1 Enum.Parse as the mod calls it: a name, any case only where it asks, a number, else the line goes', () => {
  assert.equal(parseEnum(MOBILE_TEAMS, 'orcs', { ignoreCase: true }), 'Orcs');
  assert.throws(() => parseEnum(MOBILE_TEAMS, 'orcs'), /not found/);
  assert.equal(parseEnum(MOBILE_TEAMS, ' 7 '), 'Orcs');
  assert.equal(parseEnum(MOBILE_TEAMS, '99'), 99, 'an undefined number parses');
  assert.equal(isMonsterId(290), true); assert.equal(isMonsterId(384), false); assert.equal(isMonsterId(512), true);
  assert.equal(classicCareerName(146), 'Guard'); assert.equal(classicCareerName(141), 'Archer'); assert.equal(classicCareerName(23), 'Wraith');
  assert.equal(newMobileEnemy(300).minMetalToHit, 0);
});

test('DEX1 the install: the fifty in the table, a career each, DFU\'s entity type and career index, their names - and the classic edits only while loaded', (t) => {
  t.after(() => { _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); _resetExtraQuestRows(); });
  const bearBefore = structuredClone(ENEMY_BASICS[4]);
  const r = installEnemyExpansion({ on: false, log: silent });
  assert.deepEqual(r, { loaded: false, mudex: false, enemies: 50 }, 'off: no MUDEX either (it depends on the mod)');
  assert.equal(ENEMY_BASICS[256].maleTexture, 1600, 'the Goblin stands in the table, loaded or not');
  assert.deepEqual(ENEMY_BASICS[4], bearBefore, 'not loaded: no classic row is the mod\'s');
  assert.equal(dexProperties(4), null, 'nor its props');
  assert.equal(enemyEntityType(256), 'monster'); assert.equal(enemyEntityType(384), 'class');
  assert.equal(enemyEntityType(300), null, 'no career, no enemy (EntityTypes.None)');
  assert.equal(enemyCareerIndex(384), 384, 'a custom enemy\'s careerIndex is its id'); assert.equal(enemyCareerIndex(141), 13);
  assert.equal(enemyDisplayName(256), 'Goblin'); assert.equal(enemyDisplayName(275), 'Vengeful King Lysandus');
  assert.equal(customCareerTemplate(258).name, 'Lizardman');
  assert.equal(dexEnemyIds().length, 50);
});

test('AUDIT DEX A6 the fifty names in the player\'s language: each is the mod\'s own English under English, the language\'s draft under another, and the game\'s own English (the Foes table\'s keys, enemyDisplayName) is untouched; a classic id and an id no mod names keep DFU\'s answer', (t) => {
  t.after(() => { setLocale('en'); clearLocaleTables('de'); _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); _resetExtraQuestRows(); });
  installEnemyExpansion({ on: false, log: silent });
  const ids = dexEnemyIds();
  assert.deepEqual(Object.keys(DEX_ENEMY_NAME_TEXT).map(Number), ids, 'one translatable name for each of the fifty, and none for an id the mod does not add');
  for (const id of ids) {
    assert.equal(DEX_ENEMY_NAME_TEXT[id](), enemyDisplayName(id), `${id}: the catalog's English is the mod's Name column`);
    assert.equal(getLocalizedEnemyName(id, 'fallback'), enemyDisplayName(id), `${id}: under English the HUD reads the mod's own`);
  }
  patchLocaleTable('de', 'Port_Strings', parseStringTableCsv(readFileSync(join(ROOT, 'locales/de/Port_Strings.csv'), 'utf8')));
  setLocale('de');
  assert.equal(getLocalizedEnemyName(258, 'fallback'), 'Echsenmensch', 'the Lizard Man in German');
  assert.equal(getLocalizedEnemyName(275, 'fallback'), 'Rachsüchtiger König Lysandus');
  assert.equal(enemyDisplayName(258), 'Lizard Man', 'the game\'s own English stays (the quest Foes table is keyed by it)');
  assert.equal(getLocalizedEnemyName(4, 'Grizzly Bear'), 'Grizzly Bear', 'a classic id reads DFU\'s enemyNames list, as before (no pack: the fallback)');
  assert.equal(getLocalizedEnemyName(300, 'fallback'), 'fallback', 'an id no mod names: the fallback');
  _resetEnemyExpansion();
  assert.equal(getLocalizedEnemyName(258, 'Lizard Man'), 'Lizard Man', 'the door goes with the mod\'s registrations');
});

test('AUDIT DEX A5 the reading\'s reachable arms: a caster that shoots keeps both ranged attacks (the Necromancer Assassin), a classic class that starts with a ranged attack keeps it under the mod (the Monk); A2 a blow\'s class asks the class bit', (t) => {
  t.after(() => { _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); _resetExtraQuestRows(); });
  installEnemyExpansion({ on: true, log: silent });
  const r394 = ENEMY_BASICS[394];
  assert.deepEqual([r394.castsMagic, r394.hasRangedAttack1, r394.hasRangedAttack2, r394.hasSpellAnimation], [true, true, true, true], 'casts and shoots (:964-994): both ranged attacks, its spell frames');
  assert.equal(ENEMY_BASICS[MOBILE_TYPES.Monk].hasRangedAttack1, true, 'HasClassicRangedAttack (:2138-2160) names the Monk');
  for (const n of ['Battlemage', 'Nightblade', 'Bard', 'Burglar', 'Rogue', 'Acrobat', 'Thief', 'Assassin', 'Monk', 'Archer', 'Ranger', 'Barbarian', 'Warrior', 'Knight']) {
    assert.equal(ENEMY_BASICS[MOBILE_TYPES[n]].hasRangedAttack1, true, `${n} keeps its ranged attack`);
  }
  for (const n of ['Mage', 'Spellsword', 'Healer', 'Sorcerer']) assert.equal(ENEMY_BASICS[MOBILE_TYPES[n]].hasRangedAttack2 ?? false, false, `${n}: no bow`);
  assert.deepEqual([7, 256, 290, 384, 394].map((mobileType) => adaptBlowClass({ mobileType }, null, 'melee')), ['other', 'other', 'other', 'h2h', 'h2h'], 'a monster\'s body, the mod\'s too, is no person\'s hands; a class\'s are');
  assert.equal(adaptBlowClass({ isPlayer: true }, null, 'melee'), 'h2h');
});

test('AUDIT DEX A5 the hosts\' arms by SetupDemoEnemy\'s entity type: a dungeon\'s marker foe takes the monster arm or the class arm, the street\'s mint and its knockback read the same - a mod\'s monster (256-290) is no class, its class (384-398) no monster', () => {
  const dc = readFileSync(join(ROOT, 'src/scenes/dungeonContext.js'), 'utf8'), xf = readFileSync(join(ROOT, 'src/scenes/exteriorFoes.js'), 'utf8');
  assert.equal(dc.split("if (foeDeps && enemyEntityType(e.mobileType) === 'class' && basics.maleTexture) {").length, 2, 'the dungeon\'s class arm');
  assert.equal(dc.split("if (foeDeps && enemyEntityType(e.mobileType) === 'monster' && basics.maleTexture) {").length, 2, 'the dungeon\'s monster arm');
  assert.match(xf, /const isClass = enemyEntityType\(mobileType\) === 'class', career = loadEnemyCareer\(mobileType, fetchBytes\);/, 'the street\'s mint');
  assert.match(xf, /const isClass = enemyEntityType\(f\.mobileType\) === 'class';/, 'the street\'s knockback weight');
});

test('DEX1 loaded: the classic rows written in the table, and at a foe\'s mint - Meaner Monsters standing aside beside it, its author\'s form of it for this mod being MUDEX (MUDEX1, mudex1.test.js)', (t) => {
  t.after(() => { _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); });
  const before = structuredClone(ENEMY_BASICS[9]);
  installEnemyExpansion({ on: true, meaner: false, log: silent });   // the mod's own lines alone: no MUDEX
  assert.deepEqual([ENEMY_BASICS[4].maleTexture, ENEMY_BASICS[143].maleTexture, ENEMY_BASICS[140].femaleTexture], [457, 1507, 1520]);
  assert.equal(ENEMY_BASICS[9].maxDamage, 16, 'the werewolf as the mod restats it');
  assert.equal(ENEMY_BASICS[9].maxHealth, before.maxHealth, 'a field the line leaves is the row\'s');
  // Meaner Monsters writes the werewolf too (MM1), and the two disagree; beside the mod its rows stand aside, switch on or
  // not (MUDEX1: Meaner Monsters' own Init asks the player to swap it for MUDEX here, and the port makes the swap)
  assert.ok(MEANER_MONSTERS_EDIT[9]?.maxDamage !== undefined && MEANER_MONSTERS_EDIT[9].maxDamage !== 16, 'the two mods disagree on the werewolf\'s damage');
  const wolf = makeEnemyEntity(9, ENEMY_BASICS[9], null, 1, () => 0.5);
  assert.equal(wolf.basics.maxDamage, 16, 'the mod\'s');
  assert.equal(applyMeanerMonsters(9, ENEMY_BASICS[9]), ENEMY_BASICS[9], 'Meaner Monsters\' own rows stand aside beside the mod');
  assert.equal(pcaaoMeanerMonstersRow(9, ENEMY_BASICS[9], meanerMonstersOn(() => true, () => true)), ENEMY_BASICS[9], '...and so does the overhaul\'s edit of them, both switches on');
  assert.equal(wolf.basics.maxHealth, ENEMY_BASICS[9].maxHealth, 'the table\'s row where the mod names nothing');
  assert.equal(dexProperties(143).hasRangedAttack, true);
  // the table's line is the read's own (the relay's bounds are held to dexClassicRow), and the vanilla rows never move
  assert.deepEqual(ENEMY_BASICS[9], dexClassicRow(9, VANILLA_ENEMY_BASICS[9]), 'the row written is the line over the vanilla row');
  assert.deepEqual(VANILLA_ENEMY_BASICS[9], before, 'VANILLA_ENEMY_BASICS: DFU\'s row, whatever the mod wrote');
  assert.ok(Object.isFrozen(VANILLA_ENEMY_BASICS[9]) && !('256' in VANILLA_ENEMY_BASICS), 'frozen, and no mod\'s row joins it');
  // King's Gambit's roster is the vanilla rows' (Kings-Gambit.md, one roster for every client and the relay) - a unit
  // made after the mod's Start is the unit made before it, the Dragonling 34 among them (the mod gives it 146 health)
  for (const u of KG_ROSTER) assert.deepEqual(makeUnit(u.id, { ranged: u.ranged }), u, `the gambit's ${u.name} unmoved`);
  assert.ok(ENEMY_BASICS[34].maxHealth !== VANILLA_ENEMY_BASICS[34].maxHealth && KG_ROSTER.some((u) => u.id === 34));
});

test('DEX1 a mod\'s monster and a mod\'s class are built on DFU\'s two arms (EnemyEntity.SetEnemyCareer :251-274)', async (t) => {
  t.after(() => { _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); });
  installEnemyExpansion({ on: true, meaner: false, log: silent });   // the mod's own rows: MUDEX restats the Goblin
  const fetchBytes = async () => { throw new Error('a new career reads no file'); };
  const goblinCareer = await loadEnemyCareer(256, fetchBytes);
  assert.equal(goblinCareer.name, 'Goblin');
  assert.equal(await loadEnemyCareer(256, fetchBytes), goblinCareer, 'one career object per career, as DFU registers one DFCareer for every enemy that names it');
  assert.equal(await loadEnemyCareer(258, fetchBytes), await loadEnemyCareer(259, fetchBytes), 'the Lizard Man and the Lizard Warrior share Lizardman');
  const g = makeEnemyEntity(256, ENEMY_BASICS[256], goblinCareer, 7, () => 0);
  assert.equal(g.isClass, false); assert.equal(g.level, 2, 'a monster: the row\'s level'); assert.equal(g.maxHealth, 11, 'Range(min, max + 1) at its floor');
  assert.equal(g.careerIndex, 256); assert.deepEqual(g.armorValues, new Array(7).fill(10), 'ArmorValue x 5');
  const druidCareer = await loadEnemyCareer(384, fetchBytes);
  const d = makeEnemyEntity(384, ENEMY_BASICS[384], druidCareer, 7, () => 0);
  assert.equal(d.isClass, true); assert.equal(d.level, 7, 'a class: the player\'s level - no watchman\'s bonus'); assert.equal(d.maxHealth, 10 + 7, 'RollEnemyClassMaxHealth at its floor');
  assert.equal(d.careerIndex, 384); assert.equal(d.name, 'Druid');
  assert.deepEqual([enemyLevelOf(256, 7), enemyLevelOf(384, 7)], [g.level, d.level], 'a road\'s trouble levels them as the mint does (enemyBasics.js enemyLevelOf) - the Goblin its row\'s, by the bit: read as `>= 128` it was a person at the party\'s');
});

test('DEX1 with ARENA2: a career borrowed from Daggerfall is the player\'s own, copied - the Bat is a Giant Bat, the Guard CLASS18', { skip: !ARENA2 }, async (t) => {
  t.after(() => { _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); });
  installEnemyExpansion({ on: true, log: silent });
  const fetchBytes = async (name) => arenaBytes(name);
  const bat = await loadEnemyCareer(260, fetchBytes);
  const classicBat = await loadEnemyCareer(3, fetchBytes);
  assert.deepEqual(bat, classicBat, 'the classic career, field for field');
  assert.notEqual(bat, classicBat, 'and a copy: a mod\'s edit to it would never reach a classic bat');
  const guard = await loadEnemyCareer(385, fetchBytes);
  assert.equal(guard.name.trim().length > 0, true);
  assert.deepEqual(guard, await loadEnemyCareer(146, fetchBytes));
});

test('DEX1 the quest foes: the new names as id, name - and only where the Foes table lacks the name, asked when the rows land (the Nymph is Daggerfall\'s)', (t) => {
  t.after(() => { _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); _resetExtraQuestRows(); });
  installEnemyExpansion({ on: true, log: silent });
  loadQuestTables({ 'Quests-Foes': readFileSync(join(ROOT, 'vendor/dfu-quests/Tables/Quests-Foes.txt'), 'utf8') });
  const foes = foesTable();
  assert.equal(foes.getValue('id', 'Goblin'), '256');
  assert.equal(foes.getValue('id', 'Vengeful_King_Lysandus'), '275');
  assert.equal(foes.getValue('id', 'Nymph'), '10', 'the classic Nymph keeps its name');
  assert.equal(foes.columns[foes.primaryColumnIndex].values.filter((v) => v === 'Nymph').length, 1, 'and the mod\'s Nymph line was never added');
  // the keyed form: a key the table already has is not added, one it lacks is (a mutant: drop the check and the Nymph doubles)
  addIntoQuestTables({ foes: [{ line: '999, Nymph', unlessKey: 'Nymph' }, { line: '998, Brand_New', unlessKey: 'Brand_New' }] });
  assert.equal(foes.getValue('id', 'Nymph'), '10');
  assert.equal(foes.getValue('id', 'Brand_New'), '998');
});

test('DEX1 the read is idempotent: one read, one install', (t) => {
  t.after(() => { _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); });
  installEnemyExpansion({ on: true, meaner: false, log: silent });
  assert.equal(dexRead(), dexRead());
  assert.deepEqual(installEnemyExpansion({ on: false, log: silent }), { loaded: true, mudex: false, enemies: 50 }, 'a second call answers the first load');
});
