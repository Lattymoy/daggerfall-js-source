// AUDIT 58 (combat lane): the six laws this fix wave landed, each
// pinned so the mutation that undoes it is RED.
//
//   1. EnemyAttack.cs:191-194 - "Switch to hand-to-hand if enemy is
//      immune to weapon", the step every foe-vs-foe melee arm skipped.
//   2. ItemHelper.cs:1382-1450 - a foe's equipment goes INTO its
//      ItemEquipTable, which is what DamageEquipment's struck side
//      reads (FormulaHelper.cs:1095, :1113).
//   3. WeaponManager.cs:627-630 - DecreaseHealth and
//      HandleAttackFromSource run AFTER the `damage > 0` fork closes
//      (:615), so a CONNECTING zero-damage swing still enrages.
//   4. FormulaHelper.cs:691-696 - the weapon poison is inflicted with
//      no player gate, and the dose is cleared either way.
//   5. ItemEquipTable.cs:633-635 - the bows' hands READ
//      BowLeftHandWithSwitching.
//   6. FormulaHelper.cs:707/:712-716 - the Ring of Namira payload
//      passes a null sourceItem and drops the PayloadCallbackResults,
//      so the ring is never worn down. (Pinned in artifacts.test.js.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { calculateAttackDamage, dropWeaponIfTargetImmune, chooseEnemyWeapon, damageEquipment } from '../src/combat/formulas.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { equipEnemy, applyDamageToNonPlayer } from '../src/scenes/hostCombat.js';
import { equipTableOf, equipItem, EQUIP_SLOTS } from '../src/systems/equip.js';
import { getItemHands, ITEM_HANDS, createEquipTable, BOW_HAND_TEMPLATES } from '../src/characters/equipTable.js';
import { ITEM_GROUPS } from '../src/characters/equipRules.js';
import { BODY_PARTS } from '../src/systems/armorMaterials.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { playerArrowHitFoe } from '../src/combat/arrowFlight.js';
import { setValue, resetToDefaults } from '../src/systems/settings.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

// ---------------------------------------------------------------
// 1. The metal drop (EnemyAttack.cs:191-194)
// ---------------------------------------------------------------

const GHOST = 18, KNIGHT_CITY_WATCH = 146;
const foeEntity = (mobileType, over = {}) => ({
  isPlayer: false, isClass: mobileType >= 128, mobileType, level: 6,
  basics: ENEMY_BASICS[mobileType], skills: {}, stats: { strength: 50, agility: 50, luck: 50 },
  minMetalToHit: ENEMY_BASICS[mobileType].minMetalToHit,
  minDamage: ENEMY_BASICS[mobileType].minDamage, maxDamage: ENEMY_BASICS[mobileType].maxDamage,
  armorValues: new Array(7).fill(100), items: [], ...over,
});

test('AUDIT 58: the foe-vs-foe metal drop - a weapon the target refuses becomes hand-to-hand, not a permanent zero', () => {
  const ghost = foeEntity(GHOST);
  assert.equal(ghost.minMetalToHit, 2, 'a Ghost refuses anything under Silver');
  const iron = createWeapon(118, 0);   // Broadsword, iron - the city watch is forced to itemLevel 1
  // The step itself: EnemyAttack.cs:193-194's `weapon = null`.
  assert.equal(dropWeaponIfTargetImmune(iron, ghost), null, 'iron against minMetalToHit 2 is dropped');
  // the comparison is `>`, so a material EQUAL to MinMetalToHit stands
  const silver = createWeapon(118, 2);
  assert.equal(silver.material, 2);
  assert.equal(dropWeaponIfTargetImmune(silver, ghost), silver, '...Silver is kept');
  // targetEntity is null for a PLAYER target (EnemyAttack.cs:188-189),
  // and the drop must not fire then.
  assert.equal(dropWeaponIfTargetImmune(iron, null), iron, 'no foe target, no drop (the player arm)');
  assert.equal(dropWeaponIfTargetImmune(null, ghost), null, 'no weapon, nothing to drop');
  // DFU's order: the drop precedes CalculateAttackDamage's own
  // weapon-vs-weaponless swap, and chooseEnemyWeapon(null) stays null.
  assert.equal(chooseEnemyWeapon(dropWeaponIfTargetImmune(iron, ghost), ENEMY_BASICS[KNIGHT_CITY_WATCH]), null);

  // THE REPRODUCTION: a watchman swinging at a Ghost.
  const watch = foeEntity(KNIGHT_CITY_WATCH);
  let kept = 0, dropped = 0;
  for (let i = 0; i < 200; i++) {
    kept += calculateAttackDamage(watch, ghost, { weapon: iron, rolls: () => 0.01 });
    dropped += calculateAttackDamage(watch, ghost, { weapon: dropWeaponIfTargetImmune(iron, ghost), rolls: () => 0.01 });
  }
  assert.equal(kept, 0, 'the material gate (FormulaHelper.cs:576-583) returns 0 forever, and silently for an enemy');
  assert.ok(dropped > 0, 'DFU never reaches that gate foe-vs-foe: the hand-to-hand arm deals real damage');
});

test('AUDIT 58: all three foe-vs-foe MELEE arms run the drop, and no player arm does', () => {
  // MUTANT: unwrap any one of these three and this pin is red.
  assert.match(src('scenes/cityGuards.js'),
    /const fwpn = chooseEnemyWeapon\(dropWeaponIfTargetImmune\(g\.entity\.weapon, _foeTarget\.entity\), ENEMY_BASICS\[GUARD_MOBILE_TYPE\]\);/,
    'the watch fighting a monster');
  assert.match(src('scenes/exteriorFoes.js'),
    /const fwpn = chooseEnemyWeapon\(dropWeaponIfTargetImmune\(f\.entity\.weapon, _foeTarget\.entity\), ENEMY_BASICS\[f\.mobileType\]\);/,
    'the exterior encounter pool');
  assert.match(src('scenes/dungeonContext.js'),
    /const wpn = foeDeps\.chooseEnemyWeapon\(foeDeps\.dropWeaponIfTargetImmune\(f\.entity\.weapon, t\.entity\), ENEMY_BASICS\[f\.mobileType\]\);/,
    'the dungeon host, through its lazy dep bag');
  // The PLAYER arms keep the bare call - MinMetalToHit is a
  // MobileEnemy field and the player has none (EnemyAttack.cs:188-189).
  const dg = src('scenes/dungeonContext.js');
  assert.match(dg, /const wpn = foeDeps\.chooseEnemyWeapon\(f\.entity\.weapon, ENEMY_BASICS\[f\.mobileType\]\);/,
    'the dungeon PLAYER arm is untouched');
  // BowDamage does NOT do it (EnemyAttack.cs:134-148 reads the table
  // and hands it straight on), so no arrow arm may.
  for (const f of ['scenes/dungeonContext.js', 'scenes/exteriorFoes.js']) {
    const s = src(f);
    const arrow = s.slice(s.indexOf('bowAttack: true'));
    assert.ok(!arrow.slice(0, 400).includes('dropWeaponIfTargetImmune'), `${f}: BowDamage has no drop`);
  }
});

// ---------------------------------------------------------------
// 2. The enemy equip table (ItemHelper.cs:1382-1450)
// ---------------------------------------------------------------

/** An Orc (careerIndex 7 -> equipment variant 0) with every roll
 *  taken: Broadsword + Buckler + all six armour pieces. */
const fullyEquippedOrc = () => {
  const saved = Math.random;
  Math.random = () => 0;
  try {
    const e = { isClass: false, mobileType: 7, careerIndex: 7, armor: 15, items: [] };
    equipEnemy(e, 7, 3);
    return e;
  } finally { Math.random = saved; }
};

test('AUDIT 58: a foe WEARS its equipment - the table DamageEquipment reads is filled', () => {
  const e = fullyEquippedOrc();
  const slots = equipTableOf(e);
  // MUTANT: delete the placement loop in equipEnemy and every one of
  // these is null.
  assert.equal(slots[EQUIP_SLOTS.RightHand], e.weapon, 'GetItem(RightHand) IS the blade it swings');
  assert.equal(slots[EQUIP_SLOTS.LeftHand]?.templateIndex, 109, 'the Buckler is in the left hand');
  assert.equal(slots[EQUIP_SLOTS.ChestArmor]?.templateIndex, 102, 'the cuirass on the chest');
  assert.equal(slots[EQUIP_SLOTS.Head]?.templateIndex, 107);
  assert.equal(slots[EQUIP_SLOTS.Feet]?.templateIndex, 108, 'the boots too - EnemyEntity.cs:414 excludes them from the ARMOR pass, not from the table');
  // ...and every worn piece is the SAME record the corpse drops.
  for (const it of [slots[EQUIP_SLOTS.RightHand], slots[EQUIP_SLOTS.LeftHand], slots[EQUIP_SLOTS.ChestArmor]]) {
    assert.ok(e.items.includes(it), 'Items.AddItem takes the instance that was equipped');
    assert.ok((it.maxCondition ?? 0) > 0, 'ItemBuilder mints a condition with the piece');
  }
  // The port's worn MARK is deliberately absent: it is this port's
  // device for the player's list filter, and a marked corpse would
  // hide its own loot from every inventory tab.
  assert.ok(e.items.every((it) => it.equipSlot == null), 'no equipSlot mark on a foe\'s gear');
});

test('AUDIT 58: DamageEquipment\'s struck side finally fires against a foe - shield when covered, else the part\'s armour, and a break takes it off', () => {
  const e = fullyEquippedOrc();
  const slots = equipTableOf(e);
  const player = { isPlayer: true };
  const blade = () => mintCondition({ group: 'Weapons', name: 'Saber', templateIndex: 117, material: 2 });
  const cuirass = slots[EQUIP_SLOTS.ChestArmor];
  const shield = slots[EQUIP_SLOTS.LeftHand];
  const c0 = cuirass.currentCondition, s0 = shield.currentCondition;
  damageEquipment(player, e, 30, blade(), BODY_PARTS.Chest, { rolls: () => 0.99 });
  assert.equal(cuirass.currentCondition, c0 - 3, '(10*30+50)/100 = 3 off the struck part\'s armour');
  assert.equal(shield.currentCondition, s0, 'a Buckler does not cover the chest');
  damageEquipment(player, e, 30, blade(), BODY_PARTS.Hands, { rolls: () => 0.99 });
  assert.equal(shield.currentCondition, s0 - 3, 'GetShieldProtectedBodyParts: a Buckler covers Hands');
  // The break: ItemBreaks unequips through the owner, and
  // UpdateEquippedArmorValues(item, false) gives the part back.
  const chestBefore = e.armorValues[BODY_PARTS.Chest];
  const said = [];
  damageEquipment(player, e, 1e6, blade(), BODY_PARTS.Chest, { rolls: () => 0.99, say: (l) => said.push(l) });
  assert.equal(slots[EQUIP_SLOTS.ChestArmor], null, 'the broken cuirass comes off');
  assert.ok(e.armorValues[BODY_PARTS.Chest] > chestBefore, 'and the foe is easier to hit for it');
  assert.ok(said.some((l) => /Cuirass has broken/.test(l)), 'ItemBreaks pops for any owner (DaggerfallUnityItem.cs:1198-1203)');
});

// ---------------------------------------------------------------
// 3. The connecting zero-damage swing (WeaponManager.cs:627-630)
// ---------------------------------------------------------------

test('AUDIT 58: a zero-damage ARROW that CONNECTED still runs HandleAttackFromSource', () => {
  const foe = {
    entity: {
      // a Ghost's refusal is the deterministic zero: the shaft
      // connected, CalculateAttackDamage returned 0.
      minMetalToHit: 2, armorValues: [0, 0, 0, 0, 0, 0, 0], items: [],
      basics: { bloodIndex: 3 }, isClass: false, maxHealth: 30, health: 30,
      stats: { strength: 50, agility: 50, luck: 50 },
    },
    ai: { feet: [1, 0, 2], yaw: 0 },
  };
  const log = [];
  const dmg = playerArrowHitFoe(
    { weapon: { templateIndex: 130, material: 0, poisonType: -1 }, pos: [0, 0, 0], dir: [0, 0, 1] }, foe, {
      playerEntity: { isPlayer: true, level: 1, skills: 30, skillUses: [], stats: { strength: 50, agility: 50, luck: 50 } },
      playerFeet: [0, 0, 0],
      dealDamage: (f, d) => log.push(['deal', d]),
      onAttackFromPlayer: (f) => log.push(['aggro', f === foe]),
      say: () => {}, rolls: () => 0.5,
    });
  assert.equal(dmg, 0, 'the material refusal is a connecting shot for nothing');
  // MUTANT: put onAttackFromPlayer back inside the `dmg > 0` block and
  // this is red.
  assert.deepEqual(log, [['aggro', true]], 'no damage door, but the aggro pair still runs');
  assert.equal(foe.entity.items.length, 1, 'and the arrow is still recoverable (:146-148)');
});

test('AUDIT 58: every player-attack resolver reaches the door on a zero-damage connect', () => {
  // The dungeon and exterior pools call the lifted member; the watch
  // pool routes through its damage door with no ray (WeaponManager's
  // knockback is inside the damage arm, and weaponKnockbackSpeed(0, w)
  // returns the 15/ratio floor).
  // MUTANT: delete any one of these three lines and this pin is red.
  const dg = src('scenes/dungeonContext.js');
  assert.match(dg, /else if \(snd\) audio\.playOneShot\(snd\.sound, 1\.1\);[\s\S]{0,600}handleAttackFromPlayer\(foe, playerFeet\);\n\s*continue;/,
    'dungeonContext: the zero-damage arm enrages before it continues');
  assert.match(src('scenes/exteriorFoes.js'),
    /parrySounds: !!ENEMY_BASICS\[foe\.mobileType\]\?\.parrySounds[\s\S]{0,600}handleAttackFromPlayer\(foe, playerFeet\);/,
    'exteriorFoes: the same, in its else arm');
  assert.match(src('scenes/cityGuards.js'), /damageGuard\(foe, 0, playerFeet, null\);/,
    'cityGuards: through the damage door, with no knock ray');
  // ...and the pair is a MEMBER now, called from both places in each
  // pool, with the C# line that says why.
  for (const [f, sig] of [['scenes/dungeonContext.js', 'function handleAttackFromPlayer(foe, playerFeet = null) {'],
    ['scenes/exteriorFoes.js', 'function handleAttackFromPlayer(f, playerFeet = null) {']]) {
    const s = src(f);
    assert.ok(s.includes(sig), `${f} carries the lifted member`);
    assert.equal((s.match(/handleAttackFromPlayer\(/g) ?? []).length >= 3, true, `${f}: declared, called by the damage door, called by the zero arm`);
  }
  assert.match(dg, /WeaponManager\.WeaponDamage's damage\n\s+\*\s+fork closes at :615/, 'the law is cited where it lives');
  // THE FOUR HOSTS: the arrow seam is wired wherever there is a pool,
  // and ROAD-G G1 (review) made the WATCH one of them - every host
  // ROUTES by pool now instead of excluding the guards, because
  // cityGuards carries the hostility pair itself (cityGuards.js
  // :543-548) and DFU runs :630 for the shaft as for the swing
  // (DaggerfallMissile.cs:660-688 -> WeaponManager.cs:630).
  assert.match(src('scenes/world.js'), /onAttackFromPlayer: \(f\) => \(cityGuards\.guards\.includes\(f\)\n\s+\? cityGuards\.handleAttackFromPlayer\(f, player\.pos\)\n\s+: exteriorFoes\.handleAttackFromPlayer\(f, player\.pos\)\),/);
  assert.match(src('scenes/worldModes.js'), /onAttackFromPlayer: \(f\) => \(f\._encounter\n\s+\? interiorFoes\?\.handleAttackFromPlayer\(f, player\.pos\)\n\s+: interiorGuards\?\.handleAttackFromPlayer\(f, player\.pos\)\),/);
  assert.match(dg, /onAttackFromPlayer: \(t\) => handleAttackFromPlayer\(t, lastPlayerFeet\),/);
  // ROAD-G G2: the fourth host has a pool with a hostility door now,
  // so the absence this pin used to hold ("no onAttackFromPlayer here -
  // this host mounts the WATCH pool alone") is GONE rather than
  // annotated: its arrow seam runs the same router world.js's does.
  assert.match(src('scenes/exterior.js'), /onAttackFromPlayer: \(f\) => \(cityGuards\.guards\.includes\(f\)\n\s+\? cityGuards\.handleAttackFromPlayer\(f, player\.pos\)\n\s+: exteriorFoes\.handleAttackFromPlayer\(f, player\.pos\)\),/);
  assert.doesNotMatch(src('scenes/exterior.js'), /AUDIT 58: no onAttackFromPlayer here/,
    'the retired sentence is deleted, not annotated');
});

// ---------------------------------------------------------------
// 4. The foe-vs-foe weapon poison (FormulaHelper.cs:691-696)
// ---------------------------------------------------------------

test('AUDIT 58: a poisoned foe blade DOSES the foe it strikes, and spends the dose once', () => {
  const mk = () => ({ ai: { feet: [0, 0, 0], height: 1.8 }, entity: foeEntity(KNIGHT_CITY_WATCH, { health: 40, maxHealth: 40 }) });
  const attacker = mk(), target = mk();
  const weapon = { templateIndex: 118, material: 2, poisonType: 130 };
  const dosed = [];
  const dmg = applyDamageToNonPlayer(attacker, target, {
    weapon, direction: [0, 0, 1], rolls: () => 0.01,
    calculateAttackDamage,
    dealDamage: () => {},
    onInflictPoison: (att, tgt, pt) => dosed.push([tgt === target.entity, pt]),
  });
  // MUTANT: drop `onInflictPoison` from applyDamageToNonPlayer's bag
  // (or from its calculateAttackDamage call) and the dose vanishes
  // while the blade is still spent.
  assert.ok(dmg > 0, 'the blow lands');
  assert.deepEqual(dosed, [[true, 130]], 'InflictPoison(attacker, target, ...) - on the STRUCK foe, not the player');
  assert.equal(weapon.poisonType, -1, 'and the dose is spent, exactly once (FormulaHelper.cs:695)');
});

test('AUDIT 58: all five foe-vs-foe payload sites hand the poison seam their host\'s clock', () => {
  const need = [
    ['scenes/cityGuards.js', 1], ['scenes/exteriorFoes.js', 2], ['scenes/dungeonContext.js', 2],
  ];
  for (const [f, n] of need) {
    const s = src(f);
    const hits = s.match(/onInflictPoison: \(att, tgt, pt\) => inflictPoison\(tgt, pt, false/g) ?? [];
    assert.equal(hits.length >= n, true, `${f}: ${n} foe-vs-foe site(s) inflict on the TARGET`);
  }
  assert.match(src('scenes/hostCombat.js'), /onInflictPoison = null, say = null,/,
    'the shared payload accepts both seams');
  assert.match(src('scenes/hostCombat.js'), /playerReflexes: attacker\.attack\?\.reflexes \?\? null, onInflictPoison, say \}\);/,
    'and forwards them into the formula');
});

// ---------------------------------------------------------------
// 5. The bows' hands (ItemEquipTable.cs:633-635)
// ---------------------------------------------------------------

test('AUDIT 58: GetItemHands READS BowLeftHandWithSwitching - both arms, and the slot follows', () => {
  resetToDefaults();
  assert.deepEqual([...BOW_HAND_TEMPLATES], [129, 130], 'Short_Bow, Long_Bow');
  const bow = { group: ITEM_GROUPS.Weapons, templateIndex: 130 };
  // OFF (the classic default) - unchanged.
  assert.equal(getItemHands(bow), ITEM_HANDS.Both, 'default False: ItemHands.Both, the classic answer');
  // ON - MUTANT: pin the row and this is red.
  assert.equal(getItemHands(bow, { bowLeftHand: true }), ITEM_HANDS.LeftOnly);
  setValue('Enhancements', 'BowLeftHandWithSwitching', true);
  assert.equal(getItemHands(bow), ITEM_HANDS.LeftOnly, 'read live, like hud.arrowCountLabel reads it');
  assert.equal(getItemHands({ group: ITEM_GROUPS.Weapons, templateIndex: 129 }), ITEM_HANDS.LeftOnly, 'the short bow too');
  assert.equal(getItemHands({ group: ITEM_GROUPS.Weapons, templateIndex: 120 }), ITEM_HANDS.Either, 'and nothing else moved');
  // ...so the table puts it where hud.js:361-365 looks for it.
  const t = createEquipTable();
  assert.equal(t.getEquipSlot(bow), EQUIP_SLOTS.LeftHand);
  const entity = { items: [] };
  const longBow = { group: 'Weapons', name: 'Long Bow', templateIndex: 130, material: 0 };
  entity.items.push(longBow);
  equipItem(entity, longBow);
  assert.equal(equipTableOf(entity)[EQUIP_SLOTS.LeftHand], longBow, 'a bow lands in the LEFT hand with the setting on');
  assert.equal(equipTableOf(entity)[EQUIP_SLOTS.RightHand], null, 'and the melee hand is free - the pair the setting exists to enable');
  resetToDefaults();
  const entity2 = { items: [] };
  const longBow2 = { group: 'Weapons', name: 'Long Bow', templateIndex: 130, material: 0 };
  entity2.items.push(longBow2);
  equipItem(entity2, longBow2);
  assert.equal(equipTableOf(entity2)[EQUIP_SLOTS.RightHand], longBow2, 'setting off: the classic two-handed right-hand bow');
});
