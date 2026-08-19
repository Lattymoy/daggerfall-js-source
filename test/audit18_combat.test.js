// AUDIT 18, combat-formulas lane. Every pin here was mutation-proven:
// the fix was reverted, the pin observed to FAIL, then restored. The
// mutation is named in the comment above each block.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  careerAttackModifier, enemyEntityGroup, bonusOrPenaltyByEnemyType,
  racialModifiers, handToHandAttackDamage, weaponAttackDamage,
  calculateAttackDamage, ENEMY_GROUPS, SKELETAL_WARRIOR_INDEX,
} from '../src/combat/formulas.js';
import { weaponSkillUsed, WEAPONS } from '../src/characters/weapons.js';
import { SKILLS } from '../src/systems/skills.js';
import { RACES } from '../src/systems/races.js';
import { createWeapon, assignEnemyEquipment, equipmentItems, ARMOR_ENUM, BODY_PARTS } from '../src/combat/enemyEquipment.js';
import {
  createWeaponMachine, machineAttack, machineStep, BOW_NUM_FRAMES,
  LEFT_UNARMED_ANIMS, CLASSIC_UPDATE_INTERVAL, getMeleeWeaponAnimTime,
} from '../src/characters/weaponStates.js';
import { PlayerWeapon, playerAttackOptions, SWING_MODS } from '../src/combat/playerWeapon.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { BsaFile } from '../src/formats/bsaFile.js';
import { ClassFile } from '../src/formats/classFile.js';

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const STATS = { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };

// The corpus half rides ARENA2_PATH: the original data is freeware but
// NOT redistributable, so CI has none. Skip loudly rather than fail.
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2, 'MONSTER.BSA'))
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

// ---------------------------------------------------------------
// 1. DFCareer.GetAttackModifier decodes the two bits EXCLUSIVELY.
// MUTATION: restore
//   `return (flags & bonus ? 1 : 0) - (flags & phobia ? 1 : 0);`
// -> 0x11 reads 0 and the first assertion fails.
// ---------------------------------------------------------------
test('18: both attack-modifier bits on one group is a BONUS, not a wash (DFCareer.cs:817-848)', () => {
  // `if (HasFlags(0x01)) result = Bonus; else if (HasFlags(0x10)) result = Phobia;`
  assert.equal(careerAttackModifier(0x11, ENEMY_GROUPS.Undead), 1);
  assert.equal(careerAttackModifier(0x22, ENEMY_GROUPS.Daedra), 1);
  assert.equal(careerAttackModifier(0x44, ENEMY_GROUPS.Humanoid), 1);
  assert.equal(careerAttackModifier(0x88, ENEMY_GROUPS.Animals), 1);
  // every group at once, bonus winning each time
  assert.deepEqual(
    [ENEMY_GROUPS.Undead, ENEMY_GROUPS.Daedra, ENEMY_GROUPS.Humanoid, ENEMY_GROUPS.Animals]
      .map((g) => careerAttackModifier(0xFF, g)), [1, 1, 1, 1]);
  // and each bit alone is unchanged
  assert.deepEqual([0x01, 0x10, 0x02, 0x20, 0x04, 0x40, 0x08, 0x80].map((f, i) =>
    careerAttackModifier(f, [0, 0, 1, 1, 2, 2, 3, 3][i])), [1, -1, 1, -1, 1, -1, 1, -1]);
  // U20b reaches 0x11 for real: "Bonus to hit: Undead" + "Phobia: Undead"
  assert.equal(bonusOrPenaltyByEnemyType({ attackModifierFlags: 0x11, level: 6 },
    { isPlayer: false, careerIndex: 17, affinity: 'Undead' }), 6);
});

// ---------------------------------------------------------------
// 2. GetEnemyEntityEnemyGroup is a per-careerIndex table, and the
//    Humanoid arm is affinity-keyed. MUTATION: restore
//    `enemyGroupOf(affinity)` as the sole discriminant -> the
//    Slaughterfish/Vampire/Dragonling assertions read 0 and fail.
// ---------------------------------------------------------------
test('18: the enemy-group table is per careerIndex, verbatim (FormulaHelper.cs:2746-2805)', () => {
  const N = ENEMY_GROUPS.None, U = ENEMY_GROUPS.Undead, D = ENEMY_GROUPS.Daedra;
  const H = ENEMY_GROUPS.Humanoid, A = ENEMY_GROUPS.Animals;
  assert.deepEqual(Array.from({ length: 43 }, (_, i) => enemyEntityGroup(i)), [
    A, H, H, A, A, A, A, H, H, H,     //  0 Rat .. 9 Werewolf
    H, A, H, H, H, U, H, U, U, U,     // 10 Nymph .. 19 Mummy
    A, H, H, U, H, D, D, D, U, D,     // 20 GiantScorpion .. 29 DaedraSeducer
    U, D, U, U, A, N, N, N, N, A,     // 30 VampireAncient .. 39 Horse_Invalid
    A, H, H,                          // 40 Dragonling_Alt, 41 Dreugh, 42 Lamia
  ]);
  assert.equal(enemyEntityGroup(43), N, 'the switch default is EnemyGroups.None');
  assert.equal(enemyEntityGroup(undefined), N);
});

test('18: affinity keys ONLY the Humanoid arm - the five careers where the two disagree', () => {
  // FormulaHelper.cs:1008 `if (Affinity == MobileAffinity.Human)`, then
  // :1015/:1022/:1029 `else if (GetEnemyGroup() == Undead/Daedra/Animals)`.
  const foe = (careerIndex) => ({ isPlayer: false, careerIndex, affinity: ENEMY_BASICS[careerIndex].affinity });
  const animals = { attackModifierFlags: 0x08, level: 5 };   // Animals bonus
  const undead = { attackModifierFlags: 0x01, level: 9 };    // Undead bonus
  const humanoid = { attackModifierFlags: 0x04, level: 9 };  // Humanoid bonus
  // the port's old affinity map scored every one of these 0
  assert.deepEqual([11, 34, 40].map((c) => [ENEMY_BASICS[c].affinity, bonusOrPenaltyByEnemyType(animals, foe(c))]),
    [['Water', 5], ['Daylight', 5], ['Daylight', 5]]);            // Slaughterfish, both Dragonlings
  assert.deepEqual([28, 30].map((c) => [ENEMY_BASICS[c].affinity, bonusOrPenaltyByEnemyType(undead, foe(c))]),
    [['Darkness', 9], ['Darkness', 9]]);                          // Vampire, Vampire Ancient
  // THE OVER-CORRECTION GUARD: an Orc's GROUP is Humanoid but its
  // AFFINITY is Darkness, so DFU's ladder gives it nothing. A pin
  // asserting +9 here would enshrine the opposite error.
  assert.equal(ENEMY_BASICS[7].affinity, 'Darkness');
  assert.equal(bonusOrPenaltyByEnemyType(humanoid, foe(7)), 0);
  assert.deepEqual([1, 2, 8, 9, 10, 12, 13, 14, 16, 21, 22, 24, 41, 42].map((c) => bonusOrPenaltyByEnemyType(humanoid, foe(c))),
    new Array(14).fill(0), 'every Humanoid-group monster stays 0 - none has Human affinity');
  // the four atronachs are EnemyGroups.None and take nothing either
  assert.deepEqual([35, 36, 37, 38].map((c) => bonusOrPenaltyByEnemyType(humanoid, foe(c))), [0, 0, 0, 0]);
  // a CLASS enemy is the one Human-affinity target, and does take it
  assert.equal(ENEMY_BASICS[139].affinity, 'Human');
  assert.equal(bonusOrPenaltyByEnemyType(humanoid, { isPlayer: false, isClass: true, careerIndex: 11, affinity: 'Human' }), 9);
});

// ---------------------------------------------------------------
// 3. `target is PlayerEntity` -> the player is assumed humanoid.
// MUTATION: delete the `if (target.isPlayer)` arm (equivalently,
// restore `targetGroup: null` at the enemy->player call sites) ->
// both assertions drop by exactly the attacker's level and fail.
// ---------------------------------------------------------------
test('18: an enemy attacking the PLAYER gets the humanoid modifier (FormulaHelper.cs:1037-1053)', { skip: skipReal }, () => {
  // the attacker's career is the REAL ENEMY028.CFG out of MONSTER.BSA
  const bsa = new BsaFile(new Uint8Array(readFileSync(join(ARENA2, 'MONSTER.BSA'))));
  const cf = new ClassFile();
  cf.load(bsa.getRecordBytes(bsa.getRecordIndex('ENEMY028.CFG')));
  assert.equal(cf.career.name, 'Vampire');
  assert.equal(cf.career.attackModifierFlags, 0x04, 'Humanoid | Bonus');

  const vamp = { isPlayer: false, isClass: false, level: 20, skills: 60, stats: STATS, career: cf.career };
  const player = { isPlayer: true, level: 10, armor: 0, skills: 30, stats: STATS };
  assert.equal(bonusOrPenaltyByEnemyType(vamp, player), 20, 'exactly +attacker.Level');

  // and end to end: a steel longsword, min roll, forced hit.
  // 2 (longsword min) + DamageModifier(50)=0 + steel material 0 = 2, +20.
  const weapon = { templateIndex: WEAPONS.Longsword, material: 1, flags: 0 };
  const opts = { weapon, toHitMod: 1000, rolls: () => 0, dfRand: () => 0 };
  assert.equal(calculateAttackDamage(vamp, player, opts), 22);
  const plain = { ...vamp, career: { ...cf.career, attackModifierFlags: 0x00 } };
  assert.equal(calculateAttackDamage(plain, player, opts), 2);
});

// ---------------------------------------------------------------
// 4. CalculateRacialModifiers, else-if ladder intact.
// MUTATION: delete the `if (attacker.isPlayer)` racial block in
// calculateAttackDamage (and/or make racialModifiers return zeros)
// -> the Redguard/Breton difference reads 0 and fails.
// ---------------------------------------------------------------
test('18: CalculateRacialModifiers, including the two quirks (FormulaHelper.cs:933-962)', () => {
  const bow = { templateIndex: WEAPONS.Long_Bow };
  const sword = { templateIndex: WEAPONS.Longsword };
  const at = (raceId, weapon) => racialModifiers({ raceId, level: 12 }, weapon);
  // DarkElf takes the FIRST arm with any weapon, bow included: Level/4
  assert.deepEqual(at(RACES.DarkElf, sword), { damageMod: 3, toHitMod: 3 });
  assert.deepEqual(at(RACES.DarkElf, bow), { damageMod: 3, toHitMod: 3 });
  // WoodElf: Level/3, but only inside the archery arm
  assert.deepEqual(at(RACES.WoodElf, bow), { damageMod: 4, toHitMod: 4 });
  assert.deepEqual(at(RACES.WoodElf, sword), { damageMod: 0, toHitMod: 0 });
  // Redguard: Level/3 on the ELSE of the archery arm - a Redguard
  // ARCHER enters the archery arm, fails the WoodElf test, and gets
  // nothing. That is DFU's behaviour and it is reproduced, not fixed.
  assert.deepEqual(at(RACES.Redguard, sword), { damageMod: 4, toHitMod: 4 });
  assert.deepEqual(at(RACES.Redguard, bow), { damageMod: 0, toHitMod: 0 });
  assert.deepEqual(at(RACES.Breton, sword), { damageMod: 0, toHitMod: 0 });
  assert.deepEqual(at(RACES.Nord, bow), { damageMod: 0, toHitMod: 0 });
  // `if (weapon != null)` gates the whole method
  assert.deepEqual(at(RACES.DarkElf, null), { damageMod: 0, toHitMod: 0 });

  // end to end through calculateAttackDamage: same weapon, same rolls,
  // level-12 Redguard vs level-12 Breton -> exactly Level/3 more damage
  const foe = { isPlayer: false, careerIndex: 3, affinity: 'Animal', armor: 0, skills: 0, stats: STATS };
  const weapon = { templateIndex: WEAPONS.Longsword, material: 1, flags: 0 };
  const swing = (raceId) => calculateAttackDamage(
    { isPlayer: true, level: 12, raceId, skills: 50, stats: STATS }, foe,
    { weapon, toHitMod: 1000, rolls: () => 0 });
  assert.equal(swing(RACES.Breton), 2);
  assert.equal(swing(RACES.Redguard), 6);
  assert.equal(swing(RACES.Redguard) - swing(RACES.Breton), 4);
});

// ---------------------------------------------------------------
// 5. Hand-to-hand reads LiveStrength, as the weapon path does.
// MUTATION: restore `damageModifier(attacker.stats.strength)` ->
// the two calls become identical and the difference reads 0.
// ---------------------------------------------------------------
test('18: unarmed damage uses LiveStrength (FormulaHelper.cs:786)', () => {
  const base = { isPlayer: true, level: 1, skills: 40, stats: { ...STATS } };
  // the live drain path S18 actually writes: a disease entry carrying
  // an accumulated signed per-stat map (statMods.js liveStat sums it)
  const drained = { ...base, activeEffects: [{ kind: 'disease', statMods: { strength: -20 } }] };
  // skill 40 -> min 5, max 9; roll 0 -> 5. DamageModifier(50) = 0,
  // DamageModifier(30) = floor(-20/5) = -4.
  assert.equal(handToHandAttackDamage(base, null, 0, true, seq(0)), 5);
  assert.equal(handToHandAttackDamage(drained, null, 0, true, seq(0)), 1);
  // the AI arm never applies strength at all, drained or not
  assert.equal(handToHandAttackDamage(drained, null, 0, false, seq(0)), 5);
  // the weapon path already read LiveStrength - the two now agree, and
  // the drain moves both by the same DamageModifier delta
  const bat = { isPlayer: false, careerIndex: 3, affinity: 'Animal' };
  // a claymore at max roll (2 + floor(.999*17) = 18) so the drained
  // number stays clear of the `if (damage < 1) damage = 0` floor
  const claymore = { templateIndex: WEAPONS.Claymore, material: 1, flags: 0 };
  assert.equal(weaponAttackDamage(base, bat, 0, claymore, seq(0.999)), 18);
  assert.equal(weaponAttackDamage(drained, bat, 0, claymore, seq(0.999)), 14);
});

// ---------------------------------------------------------------
// 6. The attack skill comes from the TEMPLATE, never the name.
// MUTATION: restore `WEAPON_SKILL[weapon.name] ?? SKILLS.HandToHand`
// -> the enchanted longsword resolves to HandToHand, misses, and the
// damage assertion reads 0.
// ---------------------------------------------------------------
test('18: GetWeaponSkillUsed switches on TemplateIndex (DaggerfallUnityItem.cs:910-962)', () => {
  const S = SKILLS;
  assert.deepEqual([113, 114, 117, 116, 118, 120, 119, 121, 122, 123, 127, 128, 125, 124, 126, 115, 129, 130]
    .map(weaponSkillUsed), [
    S.ShortBlade, S.ShortBlade, S.ShortBlade, S.ShortBlade,
    S.LongBlade, S.LongBlade, S.LongBlade, S.LongBlade, S.LongBlade, S.LongBlade,
    S.Axe, S.Axe,
    S.BluntWeapon, S.BluntWeapon, S.BluntWeapon, S.BluntWeapon,
    S.Archery, S.Archery,
  ]);
  assert.equal(weaponSkillUsed(WEAPONS.Arrow), null, 'the switch default is Skills.None');
  assert.equal(weaponSkillUsed(undefined), null);
  // the two templates whose itemTemplates.json spelling never matched
  // the old name-keyed table ("Wakizashi" / "Dai-katana")
  assert.equal(weaponSkillUsed(117), S.ShortBlade);
  assert.equal(weaponSkillUsed(123), S.LongBlade);

  // and behaviourally: an ENCHANTED longsword, renamed by
  // createRegularMagicItem, is still scored on Long Blade. Skills are
  // LongBlade 90 / everything else 0, and the hit roll (35) lands
  // between the two clamps - 90-50 = 40 hits, 0-50 clamps to 3 and misses.
  const skills = new Array(35).fill(0);
  skills[SKILLS.LongBlade] = 90;
  const player = { isPlayer: true, level: 1, skills, stats: STATS };
  const foe = { isPlayer: false, careerIndex: 3, affinity: 'Animal', armor: 0, skills: 0, stats: STATS };
  const rolls = () => seq(0, 0.99, 0.35, 0, 0);
  const named = { templateIndex: WEAPONS.Longsword, name: 'Sword of the Dawn', material: 1, flags: 0 };
  assert.equal(calculateAttackDamage(player, foe, { weapon: named, rolls: rolls() }), 2);
  // the control: the SAME swing scored on Hand-to-Hand misses outright
  const unmapped = { templateIndex: 999, name: 'Sword of the Dawn', material: 1, flags: 0 };
  assert.equal(calculateAttackDamage(player, foe, { weapon: unmapped, rolls: rolls() }), 0);
});

// ---------------------------------------------------------------
// 7. No port site mints weapon flag 0x10.
// MUTATION: restore `flags: BLUNT.has(templateIndex) ? 0x00 : 0x10`
// in createWeapon -> the flags assertions fail, and restoring 0x10 on
// the longsword literal takes the skeletal number from 7 to 15.
// ---------------------------------------------------------------
test('18: every generated weapon has flags 0, so the Skeletal halving always applies', () => {
  // DaggerfallUnityItem.SetItem:565 `flags = 0;` - the only other
  // writers are the artifact mask (0x820) and the classic-save import.
  assert.deepEqual([113, 115, 120, 124, 126, 127, 130].map((t) => createWeapon(t, 0).flags), [0, 0, 0, 0, 0, 0, 0]);

  const A = { isPlayer: true, level: 1, skills: 35, stats: STATS };
  const iron = { templateIndex: WEAPONS.Longsword, material: 0, flags: 0 };
  const skel = { isPlayer: false, careerIndex: SKELETAL_WARRIOR_INDEX, affinity: 'Undead' };
  const bat = { isPlayer: false, careerIndex: 3, affinity: 'Animal' };
  // max roll: 2 + floor(.999*15) = 16. Skeletal: /2 = 8, then
  // DamageModifier(50)=0 and iron material -1 -> 7. Not skeletal: 15.
  assert.equal(weaponAttackDamage(A, skel, 0, iron, seq(0.999)), 7);
  assert.equal(weaponAttackDamage(A, bat, 0, iron, seq(0.999)), 15);
  // silver still doubles AFTER the halving (FormulaHelper.cs:747)
  const silver = { templateIndex: WEAPONS.Longsword, material: 2, flags: 0 };
  assert.equal(weaponAttackDamage(A, skel, 0, silver, seq(0.999)), 16);
});

// ---------------------------------------------------------------
// 8. SetEnemyEquipment's loop stops one slot short of Feet.
// MUTATION: delete `if (a.piece === ARMOR_ENUM.Boots) continue;` ->
// armorValues[Feet] reads 55 and the deepEqual fails.
// ---------------------------------------------------------------
test('18: enemy boots never reach UpdateEquippedArmorValues (EnemyEntity.cs:414)', () => {
  // variant 1, class enemy, level 1. Rolls: weapon pick 0 -> Claymore;
  // weapon material 0 -> iron; five armor slots miss (.99 vs chance 75);
  // the BOOTS slot hits (0), rolls plate (.95) of steel (.55).
  const entity = { isClass: true, mobileType: 139, careerIndex: 11, armor: 0 };
  const eq = assignEnemyEquipment(entity, 1, 1, seq(0, 0, 0.99, 0.99, 0.99, 0.99, 0.99, 0, 0.95, 0.55));
  const boots = eq.armorPieces.find((a) => a.piece === ARMOR_ENUM.Boots);
  assert.ok(boots, 'the boots are still ROLLED - AssignEnemyStartingEquipment equips them');
  assert.equal(boots.material, 0x0200 + 1, 'plate steel: materialArmorValue 9, i.e. 100 - 45 = 55 if it counted');
  // Feet stays at the no-armor 100 and clamps to 60 like every other slot
  assert.deepEqual(eq.armorValues, [60, 60, 60, 60, 60, 60, 60]);
  assert.equal(eq.armorValues[BODY_PARTS.Feet], 60);
  // and the corpse still drops them (DFU's Items.AddItem)
  assert.ok(equipmentItems(eq).some((it) => it.group === 'Armor' && it.templateIndex === ARMOR_ENUM.Boots));
});

// ---------------------------------------------------------------
// 9. BowWeaponAnims gives the strike rows 7 frames.
// MUTATION: set BOW_NUM_FRAMES.StrikeDown back to 6 -> the release
// runs [4, 5] and 'done' arrives on the third tick; both fail.
// ---------------------------------------------------------------
test('18: a bow release plays frames 4,5,6 (WeaponBasics.cs BowWeaponAnims row 1)', () => {
  assert.deepEqual(BOW_NUM_FRAMES, { Idle: 1, StrikeUp: 4, StrikeDown: 7 });
  const m = createWeaponMachine(true);
  machineAttack(m, 'StrikeUp');
  for (let i = 0; i < 6; i++) machineStep(m, CLASSIC_UPDATE_INTERVAL, 50);
  assert.equal(m.frame, 3, 'the draw holds at NumFrames-1');
  machineAttack(m, 'StrikeDown');   // ChangeWeaponState keeps the frame for bows
  const frames = [], doneAt = [];
  for (let t = 1; t <= 4; t++) {
    const ev = machineStep(m, CLASSIC_UPDATE_INTERVAL, 50);
    if (ev.includes('done')) doneAt.push(t); else frames.push(m.frame);
  }
  assert.deepEqual(frames, [4, 5, 6]);
  assert.deepEqual(doneAt, [4], "'done' on the fourth release tick, not the third");
});

// ---------------------------------------------------------------
// 10. FPSWeapon's unarmed StrikeLeft special animation.
// MUTATION: delete the `m.isUnarmed && m.state === 'StrikeLeft'` arm
// in machineStep -> the sequence collapses to [1,2,3,4,0] over five
// ticks and all three assertions fail.
// ---------------------------------------------------------------
test('18: the unarmed StrikeLeft plays leftUnarmedAnims (FPSWeapon.cs:71, :500-511)', () => {
  assert.deepEqual([...LEFT_UNARMED_ANIMS], [0, 1, 2, 3, 4, 2, 1, 0]);
  const tick = getMeleeWeaponAnimTime(50);
  const run = (isUnarmed) => {
    const m = createWeaponMachine(false, isUnarmed);
    machineAttack(m, 'StrikeLeft');
    const frames = [], hits = [], done = [];
    for (let t = 1; t <= 12 && m.state !== 'Idle'; t++) {
      const ev = machineStep(m, tick, 50);
      frames.push(m.frame);
      if (ev.includes('hit')) hits.push(t);
      if (ev.includes('done')) done.push(t);
    }
    return { frames, hits, done };
  };
  const bare = run(true);
  assert.deepEqual(bare.frames, [0, 1, 2, 3, 4, 2, 1, 0]);
  assert.deepEqual(bare.done, [8], 'eight ticks - the swing cannot end early');
  assert.deepEqual(bare.hits, [3], 'ONE hit: isDamageFinished latches the second visit to frame 2');
  // an ARMED left strike keeps the generic 5-frame increment
  const armed = run(false);
  assert.deepEqual(armed.frames, [1, 2, 3, 4, 0]);
  assert.deepEqual(armed.done, [5]);
  assert.deepEqual(armed.hits, [2]);
  // the branch is the PLAYER's screen weapon only - an enemy rig's
  // machine is built without the flag and is unaffected
  assert.equal(createWeaponMachine(false).isUnarmed, false);
  // and the flag is READ PER STEP, never frozen: sheathing swaps the
  // rig's weapon between the worn item and null every frame
  const pw = new PlayerWeapon({ weapon: null });
  pw.update(0);
  assert.equal(pw.machine.isUnarmed, true);
  pw.weapon = { templateIndex: WEAPONS.Longsword, material: 0 };
  pw.update(0);
  assert.equal(pw.machine.isUnarmed, false);
});

// ---------------------------------------------------------------
// 11. The player option bag is shared, so the bow fork cannot drift.
// MUTATION: inline the bag back into resolveHit -> playerAttackOptions
// is gone and the import fails; with the bag present but StrikeDown's
// mods dropped, the deepEqual fails.
// ---------------------------------------------------------------
test('18: playerAttackOptions carries the swing mods a bow release also gets', () => {
  // CalculateSwingModifiers keys on the SCREEN WEAPON's state, and a
  // bow release is WeaponStates.StrikeDown - so DFU applies +4 damage
  // and -10 to hit to every shot (WeaponManager.cs:546 enters the same
  // CalculateAttackDamage as a melee swing).
  assert.deepEqual(SWING_MODS.StrikeDown, { damage: 4, toHit: -10 });
  const weapon = { templateIndex: WEAPONS.Short_Bow, material: 0 };
  const rolls = () => 0;
  assert.deepEqual(playerAttackOptions(weapon, 'StrikeDown', 7, rolls),
    { weapon, damageMod: 4, toHitMod: -10, backstabChance: 7, rolls });
  assert.deepEqual(playerAttackOptions(weapon, 'Idle'),
    { weapon, damageMod: 0, toHitMod: 0, backstabChance: 0, rolls: Math.random });
  // through the formula: the bag is worth exactly the swing damage mod
  const player = { isPlayer: true, level: 10, skills: 50, stats: STATS };
  const foe = { isPlayer: false, careerIndex: 3, affinity: 'Animal', armor: 0, skills: 0, stats: STATS };
  const withBag = calculateAttackDamage(player, foe, { ...playerAttackOptions(weapon, 'StrikeDown', 0, () => 0), toHitMod: 1000 });
  const barren = calculateAttackDamage(player, foe, { weapon, toHitMod: 1000, rolls: () => 0 });
  assert.equal(withBag - barren, 4);
});
