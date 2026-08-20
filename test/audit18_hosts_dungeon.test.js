// AUDIT 18, hosts-dungeon lane: pins for the scene-host parity fixes.
//
// HONESTY NOTE on pin shape. src/scenes/dungeonContext.js is a ~2000
// line async scene builder that needs a GL renderer, a collider and a
// laid-out dungeon before a single line of its combat code runs, and
// it has zero execution coverage in this suite. Every law that COULD
// be lifted out of it was lifted into src/scenes/hostCombat.js and is
// pinned BEHAVIOURALLY here; src/scenes/cityGuards.js is driven for
// real through the same faked-seam harness test/cityguards.test.js
// uses. What remains - the call sites inside dungeonContext's frame
// loop - is pinned by SOURCE SWEEP over the host files, which is what
// this repo already does for host-gap defects. Those are labelled.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  WEAPON_SKILL_BY_TEMPLATE, weaponSkillUsed, attackSkillOf, isBowWeapon,
  hasBowAttack, equipEnemy, SWING_WEAPON_FATIGUE_LOSS, tallySwingSkills,
  backstabChanceOf, zeroDamageHitSound,
  PARRY_1, CORPSE_ACTIVATION_DISTANCE,
} from '../src/scenes/hostCombat.js';
import { SKILLS, WEAPON_SKILL } from '../src/systems/skills.js';
import { ENEMY_GROUPS, bonusOrPenaltyByEnemyType } from '../src/combat/formulas.js';
import { tickPlayerMinutes } from '../src/systems/worldTick.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { makeEnemyEntity, loadMonsterCareer } from '../src/characters/enemyEntity.js';
import { swingSoundFor, SOUND } from '../src/systems/soundClips.js';
import { readSpellsStd } from '../src/formats/spellsStd.js';
import { createCityGuards } from '../src/scenes/cityGuards.js';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

const HOSTS = ['dungeonContext.js', 'cityGuards.js', 'townTalk.js', 'arrestFlow.js', 'hostCombat.js'];
const hostSrc = (n) => readFileSync(new URL(`../src/scenes/${n}`, import.meta.url), 'utf8');
const allHosts = () => HOSTS.map((n) => [n, hostSrc(n)]);

// ---------------------------------------------------------------
// 1. The attack skill is a property of the TEMPLATE, not the NAME
//    (DaggerfallUnityItem.cs:910-962).
// ---------------------------------------------------------------

test('audit18: weaponSkillUsed is GetWeaponSkillUsed/GetWeaponSkillIDAsShort, verbatim by template', () => {
  // ItemEnums.cs Weapons 113..130, mapped through ProficiencyFlags.
  assert.deepEqual(WEAPON_SKILL_BY_TEMPLATE, {
    113: SKILLS.ShortBlade, 114: SKILLS.ShortBlade, 115: SKILLS.BluntWeapon,
    116: SKILLS.ShortBlade, 117: SKILLS.ShortBlade, 118: SKILLS.LongBlade,
    119: SKILLS.LongBlade, 120: SKILLS.LongBlade, 121: SKILLS.LongBlade,
    122: SKILLS.LongBlade, 123: SKILLS.LongBlade, 124: SKILLS.BluntWeapon,
    125: SKILLS.BluntWeapon, 126: SKILLS.BluntWeapon, 127: SKILLS.Axe,
    128: SKILLS.Axe, 129: SKILLS.Archery, 130: SKILLS.Archery,
  });
  assert.equal(weaponSkillUsed(131), null, 'Arrow is not a weapon skill (Skills.None)');
  assert.equal(weaponSkillUsed(undefined), null);
});

test('audit18: an ENCHANTED (renamed) weapon keeps its own skill - the name lookup lost it', () => {
  // createRegularMagicItem overwrites `name` with the magic-item name,
  // so every by-name read fell through to Hand-to-Hand: the player
  // trained the wrong skill and rolled to hit on the wrong skill for
  // the rest of the game.
  const enchantedLongsword = { name: 'Wabbajack', templateIndex: 120, material: 4 };
  assert.equal(attackSkillOf(enchantedLongsword), SKILLS.LongBlade);
  assert.equal(WEAPON_SKILL[enchantedLongsword.name] ?? SKILLS.HandToHand, SKILLS.HandToHand,
    'the old by-name read really does answer Hand-to-Hand here');

  const enchantedBow = { name: 'Auriel’s Bow', templateIndex: 130 };
  assert.equal(isBowWeapon(enchantedBow), true, 'a renamed Long Bow is still a bow');
  assert.equal(WEAPON_SKILL[enchantedBow.name] === SKILLS.Archery, false,
    'the old by-name bow test dropped it to a melee swing');

  // And the two template spellings the port's name table never had.
  assert.equal(attackSkillOf({ name: 'Wakizashi', templateIndex: 117 }), SKILLS.ShortBlade);
  assert.equal(attackSkillOf({ name: 'Dai-katana', templateIndex: 123 }), SKILLS.LongBlade);
  assert.equal(attackSkillOf(null), SKILLS.HandToHand, 'bare hands');
});

test('audit18 sweep: no host reads the attack skill by display name any more', () => {
  for (const [name, src] of allHosts()) {
    assert.equal(/WEAPON_SKILL\s*\[/.test(src), false, `${name} still keys the attack skill by name`);
  }
});

// ---------------------------------------------------------------
// 2. hasBowAttack comes from the MobileEnemy FLAGS (EnemyMotor.cs:131-137)
// ---------------------------------------------------------------

test('audit18: hasBowAttack is the EnemyMotor flag predicate, with zero inventory involvement', () => {
  assert.equal(hasBowAttack({ hasRangedAttack1: true, castsMagic: false }), true);
  assert.equal(hasBowAttack({ hasRangedAttack1: true, castsMagic: true }), false, 'ranged1 + magic = spells only');
  assert.equal(hasBowAttack({ hasRangedAttack1: true, castsMagic: true, hasRangedAttack2: true }), true, 'the Nightblade case');
  assert.equal(hasBowAttack({ hasRangedAttack1: false, hasRangedAttack2: true }), false);
  assert.equal(hasBowAttack({}), false);
  assert.equal(hasBowAttack(undefined), false);
});

test('audit18: fifteen real mobiles CAN fire a bow, and none of them owns one', async () => {
  // The defect: rangedAttack was minted as `!!entity.weapon &&
  // WEAPON_SKILL[entity.weapon.name] === Archery`, but
  // AssignEnemyStartingEquipment never rolls a bow - so the predicate
  // was false for every enemy in the game and no foe could ever shoot.
  const archers = Object.entries(ENEMY_BASICS).filter(([, b]) => hasBowAttack(b)).map(([k]) => Number(k));
  assert.equal(archers.length, 15, 'the flag table says fifteen');
  assert.ok(archers.every((t) => t >= 128), 'all fifteen are class enemies; no monster has a bow attack');
  assert.deepEqual(archers, [130, 131, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145]);

  if (skipReal) return;
  // and the equipment roll for one of them really does not produce a bow
  const fb = async (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { ClassFile } = await import('../src/formats/classFile.js');
  const cf = new ClassFile();
  cf.load(await fb('CLASS02.CFG'));   // Archer = mobileType 130 -> careerIndex 2
  let sawBow = false;
  for (let i = 0; i < 200; i++) {
    const e = makeEnemyEntity(130, ENEMY_BASICS[130], cf.career, 6);
    e.items = [];
    equipEnemy(e, 130, 6);
    if (e.weapon && isBowWeapon(e.weapon)) sawBow = true;
  }
  assert.equal(sawBow, false, 'the Archer never rolls a bow - the old predicate could not fire');
});

test('audit18 sweep: both dungeon spawn branches mint rangedAttack from the flags', () => {
  const src = hostSrc('dungeonContext.js');
  const hits = src.match(/attack\.rangedAttack = hasBowAttack\(basics\);/g) ?? [];
  assert.equal(hits.length, 2, 'the class branch AND the monster branch');
  assert.equal(/rangedAttack\s*=\s*!!entity\.weapon/.test(src), false, 'the equipment-derived mint is gone');
});

// ---------------------------------------------------------------
// 3. Equipment-using MONSTERS get SetEnemyEquipment (EnemyEntity.cs:330-347)
// ---------------------------------------------------------------

test('audit18: the five equipment-using monsters are equipped', { skip: skipReal }, async () => {
  const fb = async (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  for (const mt of [7, 8, 12, 21, 24]) {   // Orc, Centaur, OrcSergeant, OrcShaman, OrcWarlord
    const basics = ENEMY_BASICS[mt];
    const career = await loadMonsterCareer(mt, fb);
    const e = makeEnemyEntity(mt, basics, career, 3);
    e.items = [];
    const eq = equipEnemy(e, mt, 3);
    assert.ok(eq, `monster ${mt} takes the equipment chain`);
    assert.ok(e.weapon, `monster ${mt} carries a right-hand weapon`);
    assert.ok(Array.isArray(e.armorValues) && e.armorValues.length === 7, `monster ${mt} has armor values`);
    assert.ok(e.items.length > 0, `monster ${mt}'s equipment reaches its corpse loot`);
  }
  // ... and a monster OUTSIDE the table still gets nothing.
  const rat = makeEnemyEntity(3, ENEMY_BASICS[3], await loadMonsterCareer(3, fb), 3);
  rat.items = [];
  assert.equal(equipEnemy(rat, 3, 3), null, 'a Rat is not on the equipment table');
  assert.equal(rat.weapon ?? null, null);
});

test('audit18 sweep: all three spawn sites run the one shared equip chain', () => {
  const dungeon = hostSrc('dungeonContext.js');
  const guards = hostSrc('cityGuards.js');
  assert.equal((dungeon.match(/\bequipEnemy\(/g) ?? []).length, 2, 'class + monster branch');
  assert.equal((guards.match(/\bequipEnemy\(/g) ?? []).length, 1, 'the city watch');
  for (const [name, src] of allHosts()) {
    if (name === 'hostCombat.js') continue;   // the one shared home
    assert.equal(/assignEnemyEquipment\(/.test(src), false, `${name} keeps a private copy of the equip chain`);
  }
});

// ---------------------------------------------------------------
// 4. WeaponManager.cs:419-436 - the swing's fatigue and its tallies
// ---------------------------------------------------------------

test('audit18: swingWeaponFatigueLoss is 11 and tallySwingSkills counts CriticalStrike too', () => {
  assert.equal(SWING_WEAPON_FATIGUE_LOSS, 11, 'WeaponManager.cs:72');
  const player = { skillUses: new Array(35).fill(0) };
  tallySwingSkills(player, { name: 'Whatever', templateIndex: 127 });   // Battle Axe
  assert.equal(player.skillUses[SKILLS.Axe], 1, 'the weapon skill');
  assert.equal(player.skillUses[SKILLS.CriticalStrike], 1, 'CriticalStrike, tallied nowhere in the port before');
  tallySwingSkills(player, null);   // bare hands
  assert.equal(player.skillUses[SKILLS.HandToHand], 1);
  assert.equal(player.skillUses[SKILLS.CriticalStrike], 2);
  assert.equal(player.skillUses[SKILLS.Axe], 1, 'a fist swing does not train the axe');
});

// ---------------------------------------------------------------
// 5. CalculateBackstabChance tallies Backstabbing (FormulaHelper.cs:975-990)
// ---------------------------------------------------------------

test('audit18: the backstab chance IS the tally site', () => {
  const player = { skillUses: new Array(35).fill(0), skills: new Array(35).fill(0) };
  player.skills[SKILLS.Backstabbing] = 44;
  assert.equal(backstabChanceOf(player, false), 0);
  assert.equal(player.skillUses[SKILLS.Backstabbing], 0, 'a front-facing swing tallies nothing');
  assert.equal(backstabChanceOf(player, true), 44, 'the chance is the live skill');
  assert.equal(player.skillUses[SKILLS.Backstabbing], 1, 'every back-facing swing counts a use');
  backstabChanceOf(player, true);
  assert.equal(player.skillUses[SKILLS.Backstabbing], 2);
});

// ---------------------------------------------------------------
// 6. GetBonusOrPenaltyByEnemyType's PlayerEntity arm (FormulaHelper.cs:1037-1053)
// ---------------------------------------------------------------

test('audit18: the player is the Humanoid group, and no host can kill the modifier', () => {
  // REWRITTEN AT THE AUDIT 18 MERGE. This pin used to assert that each host
  // passed `targetGroup: PLAYER_TARGET_GROUP` by hand. The combat domain then
  // made calculateAttackDamage derive the group from the TARGET ENTITY,
  // verbatim to GetBonusOrPenaltyByEnemyType (FormulaHelper.cs:1037-1052), so
  // the parameter - and the constant - are gone. The BEHAVIOUR is what
  // mattered, so it is pinned directly now instead of through source text.
  const foe = {
    level: 10,
    attackModifierFlags: 0x04,       // DFCareer humanoid BONUS bit
    stats: { strength: 50, agility: 50, luck: 50 }, skills: 40,
  };
  const player = { isPlayer: true, stats: { strength: 50, agility: 50, luck: 50 }, skills: 40 };
  assert.equal(bonusOrPenaltyByEnemyType(foe, player), 10,
    'DFU assumes the player is humanoid (:1048), so a humanoid-bonus attacker adds its level');
  // A phobia attacker subtracts it, and a flagless one scores nothing.
  assert.equal(bonusOrPenaltyByEnemyType({ ...foe, attackModifierFlags: 0x40 }, player), -10);
  assert.equal(bonusOrPenaltyByEnemyType({ ...foe, attackModifierFlags: 0 }, player), 0);
  // And no host may reintroduce an explicit group - the key is ignored now,
  // so passing one is a lie about where the value comes from.
  for (const [name, src] of allHosts()) {
    if (name === 'hostCombat.js') continue;   // names the retired constant in a comment
    assert.equal(/targetGroup:/.test(src), false,
      `${name} passes targetGroup, which calculateAttackDamage no longer reads`);
  }
});

test('audit18 sweep: the player arrow recovers the swing mods and the backstab it dropped', () => {
  const src = hostSrc('dungeonContext.js');
  // The window is generous on purpose: an AUDIT 18 merge note sits inside
  // this call, and a tight slice made the pin fail on a COMMENT rather than
  // on the arguments it exists to hold.
  const shot = src.slice(src.indexOf('SWING_MODS[playerWeapon.machine.state]'), src.indexOf('SWING_MODS[playerWeapon.machine.state]') + 1200);
  assert.ok(/damageMod: _swing\.damage, toHitMod: _swing\.toHit/.test(shot));
  assert.ok(/backstabChance: backstabChanceOf\(playerEntity, _back\)/.test(shot));
});

// ---------------------------------------------------------------
// 7. WeaponManager.cs:609-615 - the ZERO-damage connected swing
// ---------------------------------------------------------------

test('audit18: a zero-damage hit is a swing or a PARRY sound, never the wall pair', () => {
  const weapon = { name: 'Longsword', templateIndex: 120 };
  // no ParrySounds -> the weapon's own swing sound, at the player
  assert.deepEqual(zeroDamageHitSound({ weapon, parrySounds: false, roll: 0.5 }),
    { sound: swingSoundFor(weapon), at: 'player' });
  // ParrySounds -> Parry1 + Range(0,9), at the ENEMY
  assert.equal(PARRY_1, 428, 'SoundClips.Parry1');
  assert.deepEqual(zeroDamageHitSound({ weapon, parrySounds: true, roll: 0 }), { sound: 428, at: 'enemy' });
  assert.deepEqual(zeroDamageHitSound({ weapon, parrySounds: true, roll: 0.999 }), { sound: 436, at: 'enemy' });
  // strikingWeapon == null short-circuits the parry arm entirely
  assert.deepEqual(zeroDamageHitSound({ weapon: null, parrySounds: true, roll: 0.9 }),
    { sound: swingSoundFor(null), at: 'player' });
  // The old code played WeaponManager.cs:483's WALL pair - the ARMED
  // arm was always Parry6 and the barehanded arm always Hit2, both as
  // a flat 2D one-shot. Neither can come out of this branch now:
  // barehanded goes to the swing sound, and the armed no-parry case
  // goes to the weapon's swing sound.
  for (const roll of [0, 0.3, 0.6, 0.99]) {
    assert.notEqual(zeroDamageHitSound({ weapon: null, parrySounds: true, roll }).sound, SOUND.Hit2);
    assert.notEqual(zeroDamageHitSound({ weapon: null, parrySounds: false, roll }).sound, SOUND.Hit2);
    assert.notEqual(zeroDamageHitSound({ weapon, parrySounds: false, roll }).sound, SOUND.Parry6);
    // the parry arm plays at the ENEMY's position, not flat at the player
    assert.equal(zeroDamageHitSound({ weapon, parrySounds: true, roll }).at, 'enemy');
  }
});

test('audit18 sweep: no host plays the wall pair on a connected swing', () => {
  for (const [name, src] of allHosts()) {
    assert.equal(/SOUND\.Parry6\s*:\s*SOUND\.Hit2/.test(src), false, `${name} still plays the wall pair`);
  }
  assert.ok(/zeroDamageHitSound\(/.test(hostSrc('dungeonContext.js')));
  assert.ok(/zeroDamageHitSound\(/.test(hostSrc('cityGuards.js')));
});

// ---------------------------------------------------------------
// 8. PlayerActivate.cs:85 - CorpseActivationDistance
// ---------------------------------------------------------------

test('audit18: corpses reach 150 * GlobalScale, not the 128-unit default', () => {
  assert.equal(CORPSE_ACTIVATION_DISTANCE, 3.75);
  for (const n of ['dungeonContext.js', 'cityGuards.js']) {
    assert.ok(/distance: CORPSE_ACTIVATION_DISTANCE/.test(hostSrc(n)), `${n} corpse targets carry the reach`);
  }
});

// ---------------------------------------------------------------
// 9. cityGuards, driven for real
// ---------------------------------------------------------------

function makeDeps(rand, playerEntity, audio = null) {
  return {
    renderer: { createBillboardBatch: () => ({}), textures: new Map(), destroyBillboardBatch: () => {} },
    collider: { heightAt: () => 0, raycast: () => Infinity },
    fetchBytes: async (name) => new Uint8Array(readFileSync(join(ARENA2, name))),
    getTexture: async () => ({
      getFrameCount: () => 4,
      getSize: () => ({ width: 64, height: 100 }),
      getScale: () => ({ width: 0, height: 0 }),
    }),
    uploadRecordFrame: () => {},
    currentMinute: () => 523530,   // AUDIT 23 (hosts-3): required now
    playerEntity,
    audio,
    onPlayerHurt: () => {},
    rand,
  };
}
const makePlayer = () => ({
  level: 6, reflexes: 2, gender: 'female',
  skills: new Array(35).fill(50), skillUses: new Array(35).fill(0),
  stats: { strength: 50, agility: 50, luck: 50 },
  fatigue: 1000, health: 100,
});

test('guards audit18: the watch spawns EQUIPPED, and its loot rolls the PLAYER gender', { skip: skipReal }, async () => {
  const player = makePlayer();
  const g = createCityGuards(makeDeps(() => 0.9, player));
  await g.spawnCityGuards(true, {
    playerFeet: [0, 0, 0], playerFwd: [0, 0, 1],
    pool: [{ pos: [5, 0, 5], fwdYaw: 0, guard: true, disable: () => {} }],
  });
  const e = g.guards[0].entity;
  assert.ok(e.weapon, 'SetEnemyEquipment ran');
  assert.ok(Array.isArray(e.armorValues) && e.armorValues.length === 7);
  assert.ok(e.items.length > 0, 'the equipment is on the corpse');
  // the loot call must not hard-code a gender any more
  assert.equal(/gender: 'male'/.test(hostSrc('cityGuards.js')), false);
  assert.ok(/gender: playerEntity\.gender/.test(hostSrc('cityGuards.js')));
});

test('guards audit18: a swing costs 11 fatigue and tallies the weapon skill AND CriticalStrike', { skip: skipReal }, async () => {
  const player = makePlayer();
  const g = createCityGuards(makeDeps(() => 0.5, player));
  await g.spawnCityGuards(true, {
    playerFeet: [0, 0, 0], playerFwd: [0, 0, 1],
    pool: [{ pos: [0, 0, 1], fwdYaw: 0, guard: true, disable: () => {} }],
  });
  const pw = new PlayerWeapon();
  pw.weapon = { name: 'Some Enchanted Blade', templateIndex: 120, material: 0, flags: 0x10, minDamage: 3, maxDamage: 12 };
  const before = player.fatigue;
  const hit = g.resolvePlayerHit(pw, [0, 1.7, 0], [0, 0, 1], [0, 0, 0], () => true, null);
  assert.equal(player.fatigue, before - 11, 'DecreaseFatigue(swingWeaponFatigueLoss) is unconditional');
  assert.ok(hit, 'the guard is inside reach, in view and in LOS');
  assert.equal(player.skillUses[SKILLS.LongBlade], 1, 'the TEMPLATE skill, not Hand-to-Hand');
  assert.equal(player.skillUses[SKILLS.HandToHand], 0);
  assert.equal(player.skillUses[SKILLS.CriticalStrike], 1);
});

test('guards audit18: the melee in-view gate REJECTS when no camera is supplied', { skip: skipReal }, async () => {
  const player = makePlayer();
  const g = createCityGuards(makeDeps(() => 0.5, player));
  await g.spawnCityGuards(true, {
    playerFeet: [0, 0, 0], playerFwd: [0, 0, 1],
    pool: [{ pos: [0, 0, 1], fwdYaw: 0, guard: true, disable: () => {} }],
  });
  const pw = new PlayerWeapon();
  pw.weapon = { name: 'Longsword', templateIndex: 120, material: 0, flags: 0x10, minDamage: 3, maxDamage: 12 };
  // WeaponManager.cs:951-955 applies IsPositionInCameraView
  // unconditionally - no projection cannot mean "accept".
  assert.equal(g.resolvePlayerHit(pw, [0, 1.7, 0], [0, 0, 1], [0, 0, 0], null, null), false);
  // once a host has handed one over, the assault-carry swing reuses it
  g.resolvePlayerHit(pw, [0, 1.7, 0], [0, 0, 1], [0, 0, 0], () => true, null);
  assert.equal(g.resolvePlayerHit(pw, [0, 1.7, 0], [0, 0, 1], [0, 0, 0], null, null), true);
});

test('guards audit18: a back-facing guard raises the backstab chance and tallies Backstabbing', { skip: skipReal }, async () => {
  const player = makePlayer();
  const g = createCityGuards(makeDeps(() => 0.5, player));
  await g.spawnCityGuards(true, {
    playerFeet: [0, 0, 0], playerFwd: [0, 0, 1],
    pool: [{ pos: [0, 0, 1], fwdYaw: 0, guard: true, disable: () => {} }],
  });
  // The guard spawns facing yaw 0 (+Z) with the player at the origin
  // behind it - IsBackFacing is true from the player's eye.
  const pw = new PlayerWeapon();
  pw.weapon = { name: 'Longsword', templateIndex: 120, material: 0, flags: 0x10, minDamage: 3, maxDamage: 12 };
  g.resolvePlayerHit(pw, [0, 1.7, 0], [0, 0, 1], [0, 0, 0], () => true, null);
  assert.equal(player.skillUses[SKILLS.Backstabbing], 1,
    'the hard-zeroed backstab argument tallied nothing and rolled nothing');
});

test('guards audit18: a zero-damage swing against a guard makes a noise', { skip: skipReal }, async () => {
  const player = makePlayer();
  const played = [];
  const audio = { playOneShot: (s) => played.push(['flat', s]), play3d: (s) => played.push(['3d', s]) };
  const g = createCityGuards(makeDeps(() => 0.5, player, audio));
  await g.spawnCityGuards(true, {
    playerFeet: [0, 0, 0], playerFwd: [0, 0, 1],
    pool: [{ pos: [0, 0, 1], fwdYaw: 0, guard: true, disable: () => {} }],
  });
  // material-too-low is CalculateAttackDamage's deterministic zero
  g.guards[0].entity.minMetalToHit = 9;
  const pw = new PlayerWeapon();
  pw.weapon = { name: 'Longsword', templateIndex: 120, material: 0, flags: 0x10, minDamage: 3, maxDamage: 12 };
  played.length = 0;
  const hit = g.resolvePlayerHit(pw, [0, 1.7, 0], [0, 0, 1], [0, 0, 0], () => true, null);
  assert.ok(hit, 'the swing connected');
  assert.ok(!g.guards[0].dead, 'and dealt nothing');
  // MERGE NOTE (AUDIT 18): this pin was written while ENEMY_BASICS still
  // had no parrySounds column, and asserted DFU's FIRST arm. The enemies
  // domain then landed the column, and EnemyBasics.cs:2197-2210 gives
  // Knight_CityWatch (146) ParrySounds = true - so the guard takes the
  // SECOND arm, which is the correct DFU behaviour and what the merged
  // tree now does. WeaponManager.cs:609-614 -> EnemySounds.PlayParrySound
  // (EnemySounds.cs:134-140) = Parry1 + Random.Range(0, 9), AT THE ENEMY.
  assert.equal(played.length, 1, 'the exterior host played NOTHING at all on a zero-damage swing');
  const [where, clip] = played[0];
  assert.equal(where, '3d', 'a parrying enemy takes the sound at ITS position, not the player\'s');
  assert.ok(clip >= PARRY_1 && clip <= PARRY_1 + 8,
    `expected one of Parry1..Parry9 (${PARRY_1}..${PARRY_1 + 8}), got ${clip}`);
});

test('guards audit18: the weapon-poison seam reaches InflictPoison', { skip: skipReal }, () => {
  // The roll happens at spawn (rollEnemyWeaponPoison inside equipEnemy)
  // but the exterior damage call dropped onInflictPoison, so a
  // poisoned guard weapon could never infect anyone.
  const src = hostSrc('cityGuards.js');
  const call = src.slice(src.indexOf('calculateAttackDamage(g.entity, playerEntity'));
  assert.ok(/onInflictPoison: \(att, tgt, pt\) => inflictPoison\(playerEntity, pt, false/.test(call.slice(0, 500)));
});

// ---------------------------------------------------------------
// 10. SPELLS.STD duplicate indices keep the FIRST record
//     (EntityEffectBroker.cs:743-754)
// ---------------------------------------------------------------

test('audit18: the dungeon spell map keeps the FIRST duplicate, as DFU does', { skip: skipReal }, () => {
  const spells = readSpellsStd(new Uint8Array(readFileSync(join(ARENA2, 'SPELLS.STD'))));
  const first = new Map(), last = new Map();
  for (const sp of spells) { if (!first.has(sp.index)) first.set(sp.index, sp); last.set(sp.index, sp); }
  const differing = [...first.keys()].filter((k) => first.get(k) !== last.get(k));
  assert.ok(differing.length > 0, 'real SPELLS.STD really does carry duplicate indices');
  // the canonical case DFU comments on
  assert.equal(first.get(58).spellName ?? first.get(58).name, 'Holy Word');
  assert.equal(last.get(58).spellName ?? last.get(58).name, 'Holy Touch');
  assert.notEqual(first.get(58).rangeType, last.get(58).rangeType, 'and they behave differently');
  // the host must build the first-wins map
  assert.ok(/if \(!_byIndex\.has\(sp\.index\)\) _byIndex\.set\(sp\.index, sp\);/.test(hostSrc('dungeonContext.js')));
  assert.equal(/new Map\(readSpellsStd\(/.test(hostSrc('dungeonContext.js')), false, 'the last-wins fold is gone');
});

test('audit18 sweep: SPELLS.STD and MAGIC.DEF no longer share one catch', () => {
  const src = hostSrc('dungeonContext.js');
  const i = src.indexOf('readSpellsStd(await fetchBytes(\'SPELLS.STD\')');
  const j = src.indexOf('setMagicItemTemplates(readMagicDef');
  assert.ok(i > 0 && j > i);
  assert.ok(src.slice(i, j).includes('} catch {'), 'a bad MAGIC.DEF must not null the spell table');
});

// ---------------------------------------------------------------
// 11. Remaining dungeonContext call sites (SOURCE SWEEP - see the
//     honesty note at the top of this file)
// ---------------------------------------------------------------

test('audit18 sweep: enemy cast cost is priced off the PLAYER skills', () => {
  // EntityEffectManager.cs:322-327 + :148 (UsePlayerCharacterSkillsFor
  // EnemyMagicCost defaults true) -> CalculateEffectCosts reads
  // GameManager.PlayerEntity.Skills for a null caster.
  // X3: the cast EXECUTOR moved to the shared enemyCasting.js - the
  // law lives there now, and the dungeon binds it through foeDeps.
  const src = readFileSync(new URL('../src/characters/enemyCasting.js', import.meta.url), 'utf8');
  assert.ok(/const cost = calculateCastCost\(spell, playerEntity\)\.sp;/.test(src));
  assert.equal(/calculateCastCost\(spell, f\.entity\)/.test(src), false);
  const dc = hostSrc('dungeonContext.js');
  assert.ok(dc.includes('castEnemySpell: castShared'), 'the dungeon rides the ONE executor');
});

test('audit18 sweep: enemy loot rolls the PLAYER gender at both dungeon spawn sites', () => {
  const src = hostSrc('dungeonContext.js');
  assert.equal((src.match(/gender: D\.playerEntity\.gender/g) ?? []).length, 2);
  assert.equal(/generateItems\([^)]*gender: e\.gender/.test(src), false);
});

test('audit18 sweep: the swing fatigue and the tally arm are wired into the dungeon rig', () => {
  const src = hostSrc('dungeonContext.js');
  assert.equal((src.match(/drainFatigue\(SWING_WEAPON_FATIGUE_LOSS\)/g) ?? []).length, 2,
    'the melee swing and the bow release');
  assert.equal((src.match(/tallySwingSkills\(playerEntity, playerWeapon\.weapon\)/g) ?? []).length, 2);
  assert.ok(/const hitEnemy = resolvePlayerHit\(/.test(src), 'the tally arm needs hitEnemy');
});

test('audit18 sweep: the Athleticism fatigue multiplier is applied and truncated AFTER the multiply', () => {
  const src = hostSrc('dungeonContext.js');
  assert.ok(/hasSpecialAbility\(playerEntity\.career, SPECIAL_ABILITY\.Athleticism\) \? 0\.9 : 1\.0/.test(src));
  // AUDIT 23 (C6): the jump drain moved INTO tickPlayerMinutes
  // (PlayerEntity.cs:425-430 is the entity update); the host now only
  // forwards the motor's frame edge on the activity.
  assert.ok(/_activity\.jumped = jumped;/.test(src), 'the host forwards the jump edge');
  // The PER-MINUTE loss moved to systems/worldTick.js at AUDIT 18 so every
  // host runs it. That made it testable for the first time, so it is pinned
  // BEHAVIOURALLY here rather than by grepping the host it used to live in.
  assert.ok(/fatigueMultiplier: fatigueLossMultiplier\(\)/.test(src),
    'the host must still hand its multiplier to the shared tick');
  const runTick = (mult, activity) => {
    let drained = 0;
    const entity = { chargenDone: true, skillUses: new Array(35).fill(0), stats: {}, skills: 30, activeEffects: [], lastSkillCheckTime: 0 };
    tickPlayerMinutes({
      entity, classicMinutes: 0, dt: 5.1, activity, fatigueMultiplier: mult, rolls: () => 0.5,
      sinks: { drainFatigue: (n) => { drained += n; }, hurt() {}, heal() {}, drainMagicka() {}, restoreFatigue() {}, restoreMagicka() {}, say() {} },
    });
    return drained;
  };
  assert.equal(runTick(1.0, { running: false, swimming: false }), 11, 'Default');
  assert.equal(runTick(0.9, { running: false, swimming: false }), 9, 'Default with Athleticism');
  assert.equal(runTick(1.0, { running: true, swimming: false }), 88, 'Running');
  assert.equal(runTick(0.9, { running: true, swimming: false }), 79, 'Running with Athleticism');
  // AUDIT 23 (C6): the jump edge drains its own 11 x multiplier in the
  // SAME tick (PlayerEntity.cs:427), on top of the minute's band.
  assert.equal(runTick(1.0, { running: false, swimming: false, jumped: true }), 22, 'jump + minute');
  assert.equal(runTick(0.9, { running: false, swimming: false, jumped: true }), 18, 'jump truncates after its multiply too');
  // PlayerEntity.cs:405 casts to int AFTER the multiply: 11 -> 9, 88 -> 79, 44 -> 39
  assert.equal(Math.trunc(11 * 0.9), 9);
  assert.equal(Math.trunc(88 * 0.9), 79);
  assert.equal(Math.trunc(44 * 0.9), 39);
});

test('audit18: the three retired flags are DELETED, not rewritten', () => {
  const src = hostSrc('dungeonContext.js');
  // :786-791 - the record-cost interim, the rangeType note, the spellbook note
  assert.equal(/Cost = the record's classic cost field/.test(src), false);
  assert.equal(/Range types beyond 2\/4 \(missile\) are/.test(src), false);
  assert.equal(/the spellbook UI pends/.test(src), false);
  // and they were false: all three features are live below them
  assert.ok(/calculateCastCost\(sp, playerEntity\)/.test(src), 'the cost really is computed');
  // M3: the range arms live in the ONE engine (scenes/hostMagic.js).
  const engineSrc = hostSrc('hostMagic.js');
  assert.ok(/sp\.rangeType === 1/.test(engineSrc) && /sp\.rangeType === 3/.test(engineSrc), 'rangeTypes 1 and 3 really are handled');
  assert.ok(/ready: \(sp\) =>/.test(src), 'the spellbook really does ready a spell');
  // the truncated "INTERIM (loud): the" sentence with no predicate
  assert.equal(/INTERIM \(loud\): the\n/.test(src), false);
  // the WORLD-state-is-FLAGGED quicksave note, false since collectWorld shipped
  assert.equal(/WORLD state \(foes, piles,/.test(src), false);
  assert.ok(/world: collectWorld\(\)/.test(src));
});
