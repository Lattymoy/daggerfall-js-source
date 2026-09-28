// BALANCE1 (2026-09-27, Mac: "I want to adjust fatigue drain and durability drain. Just needs some balancing. Currently
// things drain a little too fast"). Measured first: the port's own fatigue losses are DFU's to the unit (a full bar at
// STR/END 50 walks 48.5 real minutes and runs 6.1), while the default game's WEAR runs through the combat overhaul
// (PCAAO, on by default and online) at ~2.8x DFU's on a weapon per landed hit and ~15x on armour. Two scales, each
// applied where the cost is charged and nowhere else: exertion costs a quarter less, a blow wears gear 40% less.
// DFU's own constants and formulas stay verbatim and stay pinned where they always were; this file pins the scales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './modsOff.js';
import { FATIGUE_LOSS, FATIGUE_DRAIN_SCALE } from '../src/systems/statMods.js';
import { SWING_WEAPON_FATIGUE_LOSS, SWING_FATIGUE_COST } from '../src/scenes/hostCombat.js';
import { tickPlayerMinutes, CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { CONDITION_WEAR_SCALE, blowWear, _wearScaleForTests } from '../src/systems/equip.js';
import { damageEquipment } from '../src/combat/formulas.js';
import { pcaaoApplyConditionDamageThroughWeaponDamage, pcaaoApplyConditionDamageThroughUnarmedDamage } from '../src/combat/pcaao.js';
import { BODY_PARTS } from '../src/systems/armorMaterials.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { strokeFatigueCost } from '../src/world/deepWaterSwim.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('BALANCE1: the two scales, and DFU\'s own numbers untouched beneath them', () => {
  assert.equal(FATIGUE_DRAIN_SCALE, 0.75, 'exertion costs a quarter less');
  assert.equal(CONDITION_WEAR_SCALE, 0.6, 'a blow wears gear 40% less');
  // DFU's losses stay DFU's (PlayerEntity.cs:109-113, WeaponManager.cs:72): the scale is applied where they are charged
  assert.deepEqual({ ...FATIGUE_LOSS }, { Default: 11, Climbing: 22, Running: 88, Swimming: 44, Jumping: 11 });
  assert.equal(SWING_WEAPON_FATIGUE_LOSS, 11);
  assert.equal(SWING_FATIGUE_COST, Math.trunc(11 * 0.75), 'a swing charges 8');
});

test('BALANCE1: what a full bar is worth now - STR/END 50, 6400 raw: walking 66.7 real minutes (DFU 48.5), running 8.1 (DFU 6.1)', () => {
  const minute = (activity) => {
    let n = 0;
    tickPlayerMinutes({
      entity: { level: 1, health: 50, maxHealth: 50, fatigue: 6400, magicka: 0, stats: {}, skills: new Array(35).fill(30), skillUses: [], items: [], activeEffects: [] },
      classicMinutes: 59.99, dt: 0.05, activity, fatigueMultiplier: 1, rolls: () => 0.5,
      sinks: { drainFatigue: (d) => { n += d; } },
    });
    return n;
  };
  const walk = minute({}), run = minute({ running: true }), jump = minute({ jumped: true }) - walk;
  assert.deepEqual([walk, run, jump], [8, 66, 8], 'a walking minute, a running minute, a jump');
  const realMinutes = (perMinute) => 6400 / perMinute / CLASSIC_MINUTES_PER_SECOND / 60;
  assert.equal(realMinutes(walk).toFixed(1), '66.7');
  assert.equal(realMinutes(run).toFixed(1), '8.1');
  assert.equal(realMinutes(FATIGUE_LOSS.Default).toFixed(1), '48.5', 'DFU\'s walk, for the record');
  assert.equal(realMinutes(FATIGUE_LOSS.Running).toFixed(1), '6.1', 'DFU\'s run');
});

test('BALANCE1: the fatigue scale is on EXERTION alone - the minute\'s band, a jump, a swing, Roleplay Realism\'s overload and its riding charge; never a spell\'s, a poison\'s, a disease\'s, training\'s, survival\'s or the deep\'s swim stroke (mutants: a band charged unscaled; the scale spread to fatigue damage)', () => {
  const tick = rd('src/systems/worldTick.js');
  assert.match(tick, /sinks\.drainFatigue\?\.\(Math\.trunc\(FATIGUE_LOSS\.Jumping \* fatigueMultiplier \* FATIGUE_DRAIN_SCALE\)\);/);
  assert.match(tick, /if \(!entity\.isResting\) sinks\.drainFatigue\?\.\(Math\.trunc\(loss \* fatigueMultiplier \* FATIGUE_DRAIN_SCALE\)\);/);
  for (const [f, fn] of [['dungeonContext', 'drainFatigue'], ['world', 'drainExteriorFatigue'], ['exterior', 'drainExteriorFatigue'], ['worldModes', 'drainInteriorFatigue']]) {
    const s = rd(`src/scenes/${f}.js`);
    assert.equal((s.match(new RegExp(`${fn}\\(SWING_FATIGUE_COST\\)`, 'g')) ?? []).length, 2, `${f}: the melee arm and the bow arm charge the scaled swing`);
    assert.doesNotMatch(s, /\(SWING_WEAPON_FATIGUE_LOSS\)/, `${f}: nothing charges DFU's raw swing`);
  }
  assert.match(rd('src/systems/rrInstall.js'), /const owed = cost \* FATIGUE_DRAIN_SCALE \+ \(entity\._rrFatigueCarry \?\? 0\);/, 'the overload, its fraction carried (rr1_realism drives it)');
  // the pre-merge audit (0927b F1): Enhanced Riding's charge is exertion too - 165 was left whole and on neither list
  assert.match(rd('src/systems/rrRidingHost.js'), /- Math\.trunc\(FATIGUE_LOSS\.Default \* RR_RIDING\.chargeFatigueMultiplier \* FATIGUE_DRAIN_SCALE\)\);/);
  for (const f of ['src/systems/effects.js', 'src/systems/poisons.js', 'src/systems/diseases.js', 'src/systems/guildServiceActions.js', 'src/systems/quest/actions.js', 'src/systems/survival/needs.js', 'src/world/deepWaterSwim.js']) {
    assert.doesNotMatch(rd(f), /FATIGUE_DRAIN_SCALE/, `${f}: not exertion, not scaled`);
  }
  assert.equal(strokeFatigueCost(6400), 160, 'the swim stroke is a burst bought on purpose, at the mod\'s price');
});

test('BALANCE1: a blow\'s wear is the scale\'s EXACTLY on average - the fraction rolled, a whole amount rolls nothing, nothing never wears (mutants: the fraction floored or rounded; the roll inverted; a roll drawn for a whole amount)', () => {
  const at = (r) => () => r;
  assert.equal(blowWear(1, at(0.59)), 1, 'a 1-point wear costs 1 on 60% of blows...');
  assert.equal(blowWear(1, at(0.6)), 0, '...and nothing on the rest');
  assert.equal(blowWear(2, at(0.19)), 2);
  assert.equal(blowWear(2, at(0.2)), 1);
  let drawn = 0;
  assert.equal(blowWear(5, () => { drawn++; return 0; }), 3, 'five points of wear are three');
  assert.equal(drawn, 0, 'and a whole amount draws no roll');
  assert.equal(blowWear(0, () => { drawn++; return 0; }), 0);
  assert.equal(drawn, 0, 'no wear, no roll');
  for (const amount of [1, 2, 3, 7, 12]) {
    let sum = 0;
    for (let i = 0; i < 1000; i++) sum += blowWear(amount, at((i + 0.5) / 1000));
    assert.equal(sum / 1000, Math.round(amount * CONDITION_WEAR_SCALE * 1000) / 1000, `${amount}: the average is the scale's`);
  }
  // the parity seam: at 1, the amount is DFU's and no roll is drawn, so a scripted DFU roll sequence stays DFU's
  _wearScaleForTests(1);
  try {
    assert.equal(blowWear(1, () => { drawn++; return 0.99; }), 1);
    assert.equal(drawn, 0);
  } finally { _wearScaleForTests(); }
  assert.equal(blowWear(5, at(0)), 3, 'and the port\'s scale is back');
});

test('BALANCE1: every blow\'s wear path takes the scale - DFU\'s DamageEquipment, the combat overhaul\'s weapon, armour and fist arms, Roleplay Realism\'s armour x5, and a duel\'s blade; an enchantment\'s charge does not (mutants: a path left unscaled)', () => {
  // DFU's own path: (10 x 30 + 50) / 100 = 3 on the blade (the target wears nothing), 1.8 on the scale
  const saber = mintCondition({ group: 'Weapons', name: 'Saber', templateIndex: 117, material: 2 });
  const s0 = saber.currentCondition;
  damageEquipment({ isPlayer: false, items: [], stats: {} }, { isPlayer: false, items: [], stats: {} }, 30, saber, BODY_PARTS.Chest, { rolls: () => 0.99 });
  assert.equal(s0 - saber.currentCondition, 1, 'DFU\'s 3, at 0.6 with the fraction rolled away');
  const saber2 = mintCondition({ group: 'Weapons', name: 'Saber', templateIndex: 117, material: 2 });
  damageEquipment({ isPlayer: false, items: [], stats: {} }, { isPlayer: false, items: [], stats: {} }, 30, saber2, BODY_PARTS.Chest, { rolls: () => 0.5 });
  assert.equal(saber2.currentCondition, s0 - 2, '...and rolled up');

  // the overhaul (on by default): a piece takes the damage doubled, a fist's the damage - each on the scale
  const mods = { fadingEnchantedItems: false };
  const piece = { group: 'Armor', templateIndex: 102, material: 0x200, maxCondition: 1000, currentCondition: 1000, name: 'Cuirass' };
  pcaaoApplyConditionDamageThroughWeaponDamage(piece, { isPlayer: false }, 10, false, false, false, 0, mods, () => 0.99, null);
  assert.equal(piece.currentCondition, 1000 - 12, 'the mod\'s 20 on a piece is 12');
  pcaaoApplyConditionDamageThroughUnarmedDamage(piece, { isPlayer: false }, 10, mods, null, () => 0.99);
  assert.equal(piece.currentCondition, 988 - 6, 'a fist\'s 10 is 6');
  const blade = { group: 'Weapons', templateIndex: 120, material: 1, flags: 0, maxCondition: 1000, currentCondition: 1000, name: 'Longsword' };
  pcaaoApplyConditionDamageThroughWeaponDamage(blade, { isPlayer: false }, 25, false, false, false, 0, mods, () => 0.99, null);
  assert.equal(blade.currentCondition, 1000 - 3, 'the mod\'s 10 x 25 / 50 = 5 on a blade is 3');
  // A FRACTION IS ROLLED ON THE ROLLS THE OVERHAUL IS HANDED (the pre-merge audit 0927b: every case above is whole, so
  // no roll was drawn and the hand-through went unread): a piece's 22 is 13.2, a fist's 11 is 6.6
  // (Math.random answers the OTHER way meanwhile, so a roll taken anywhere but the handed stream reads wrong, not lucky)
  const piece2 = { group: 'Armor', templateIndex: 102, material: 0x200, maxCondition: 1000, currentCondition: 1000, name: 'Cuirass' };
  const random = Math.random;
  try {
    Math.random = () => 0.999;
    pcaaoApplyConditionDamageThroughWeaponDamage(piece2, { isPlayer: false }, 11, false, false, false, 0, mods, () => 0.1, null);
    assert.equal(piece2.currentCondition, 1000 - 14, '13.2, the roll under 0.2: 14');
    Math.random = () => 0;
    pcaaoApplyConditionDamageThroughWeaponDamage(piece2, { isPlayer: false }, 11, false, false, false, 0, mods, () => 0.9, null);
    assert.equal(piece2.currentCondition, 986 - 13, '...over it: 13');
    Math.random = () => 0.999;
    pcaaoApplyConditionDamageThroughUnarmedDamage(piece2, { isPlayer: false }, 11, mods, null, () => 0.5);
    assert.equal(piece2.currentCondition, 973 - 7, 'a fist\'s 6.6, the roll under 0.6: 7');
    Math.random = () => 0;
    pcaaoApplyConditionDamageThroughUnarmedDamage(piece2, { isPlayer: false }, 11, mods, null, () => 0.7);
    assert.equal(piece2.currentCondition, 966 - 6, '...over it: 6');
  } finally { Math.random = random; }

  // the other two, where they are charged
  assert.match(rd('src/combat/pcaao.js'), /lowerCondition\(item, blowWear\(amount, rolls\), owner, say, removeFrom\);/, 'the overhaul\'s one wear sink');
  assert.match(rd('src/systems/rrInstall.js'), /\(it, amount\) => lowerCondition\(it, blowWear\(amount, rolls\), owner, say\)/, 'Roleplay Realism\'s armour x5');
  assert.match(rd('src/scenes/world.js'), /if \(amount > 0\) lowerCondition\(sent\.weapon, blowWear\(amount\), playerEntity,/, 'a duel\'s blade');
  assert.match(rd('src/combat/formulas.js'), /lowerCondition\(item, blowWear\(amount, rolls\), owner, say\);/, 'DFU\'s');
  // NOT a blow: an enchantment's use charges its item's condition by its own cost
  assert.doesNotMatch(rd('src/systems/enchantments.js'), /blowWear/);
  assert.match(rd('src/systems/enchantments.js'), /const broke = lowerCondition\(item, amount, entity, ctx\?\.say\);/);
});
