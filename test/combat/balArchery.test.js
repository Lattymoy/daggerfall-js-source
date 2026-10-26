// BAL-ARCHERY: the bow's span, its two-handed strength term, and the shaft's speed.
// The sustained comparison is measured on the live clocks. The 80-90% and 70-80%
// bands are recorded here; they are not a second damage multiplier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, WEAPON_MATERIALS, weaponMinDamage, weaponMaxDamage, weaponMaterialModifier } from '../../src/characters/weapons.js';
import { weaponAttackDamage, damageModifier } from '../../src/combat/formulas.js';
import {
  pcaaoWeaponAttackDamage, pcaaoDamageModifier, pcaaoModules, pcaaoBackstabDamage, pcaaoAttackDamage,
  pcaaoPercentageReductionCalculationWithWeapon, pcaaoArmorMaterialIdentifier,
} from '../../src/combat/pcaao.js';
import { ARROW_FLIGHT_SPEED, MISSILE_SPEED } from '../../src/systems/spellcast.js';
import { getBowCooldownTime, CLASSIC_UPDATE_INTERVAL, swingFrameSeconds, swingHeft, swingHandling } from '../../src/characters/weaponStates.js';
import { PlayerWeapon, SWING_MODS } from '../../src/combat/playerWeapon.js';
import { WEAPON_TYPES } from '../../src/combat/fpsWeapon.js';
import { EQUIP_SLOTS } from '../../src/systems/equip.js';
import { getItemHands, ITEM_HANDS } from '../../src/characters/equipTable.js';
import { setValue } from '../../src/systems/settings/settings.js';
import { weaponPastPct, weaponMasteryBlow, _resetWeaponMasteryForTests } from '../../src/systems/weaponMastery.js';
import { SKILLS } from '../../src/systems/skills.js';
import { createThunderlock } from '../../src/systems/thunderlock.js';
import { GUN_COOLDOWN_SECONDS, GUN_FEEL, PISTOLET_FEEL, thunderlockReloadSeconds } from '../../src/combat/gun/gunFeel.js';
import { liveStat } from '../../src/systems/statMods.js';
import { doItemEnchantmentPayloads, PAYLOAD, ENCHANTMENT_TYPES, POTENT_VS_DAMAGE } from '../../src/systems/enchantments.js';
import { affixWeaponDamage } from '../../src/systems/loot/lootRarity.js';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import { RRI_WEAPON_MIN_DAMAGE, RRI_WEAPON_MAX_DAMAGE } from '../../src/systems/roleplayRealismItems/rriRealism.js';

const ALL_ON = { Enabled: true, equipmentDamageEnhanced: false, fadingEnchantedItems: false, fixedStrengthDamageModifier: true, armorHitFormulaRedone: true, criticalStrikesIncreaseDamage: true, conditionBasedEffectiveness: false, softMaterialRequirements: true };
const M = pcaaoModules((k) => ALL_ON[k], () => undefined);
const STR = 75;
const SPD = 70;
const stats = { strength: STR, intelligence: 50, willpower: 50, agility: 70, endurance: 70, personality: 50, speed: SPD, luck: 50 };
const skillsOf = (v) => Object.fromEntries(Array.from({ length: 35 }, (_, i) => [i, v]));
const foe = { isPlayer: false, careerIndex: 0, level: 5 };
const player = (skill) => ({
  isPlayer: true, _online: true, level: 10, raceId: 1, stats: { ...stats }, skills: skillsOf(skill),
  masteredSkills: [SKILLS.Archery, SKILLS.LongBlade], career: { weaponArmorShieldsBitfield: 0 },
});
const daedric = (templateIndex) => ({ group: 'Weapons', templateIndex, material: WEAPON_MATERIALS.Daedric, flags: 0, maxCondition: 100, currentCondition: 100 });
const bow = () => daedric(WEAPONS.Long_Bow);
const blade = () => daedric(WEAPONS.Longsword);
const gun = () => createThunderlock({ material: WEAPON_MATERIALS.Daedric });

const mean = (attacker, target, weapon, swing) => {
  const n = weaponMaxDamage(weapon.templateIndex) - weaponMinDamage(weapon.templateIndex) + 1;
  let s = 0;
  for (let i = 0; i < n; i++) s += pcaaoWeaponAttackDamage(attacker, target, swing, 0, weapon, () => (i + 0.5) / n, M);
  return s / n;
};
// The law this change replaced, reconstructed so the comparison is the same faces: FormulaHelper's span, strength once.
const meanBefore = (attacker, weapon, swing) => {
  const min = weaponMinDamage(weapon.templateIndex) - 1;
  const max = weaponMaxDamage(weapon.templateIndex) - 1;
  const n = max - min + 1;
  const str = pcaaoDamageModifier(attacker.stats.strength);
  let s = 0;
  for (let i = 0; i < n; i++) s += (min + i) + swing + str + weaponMaterialModifier(weapon.material);
  return s / n;
};

const CLICK = ['StrikeUp', 'StrikeLeft', 'StrikeRight', 'StrikeDownLeft', 'StrikeDown', 'StrikeDownRight'];
const clickSwing = CLICK.reduce((n, k) => n + SWING_MODS[k].damage, 0) / CLICK.length;

function hitGap(weapon, speed, { animCtx = null, bowDrawback = false } = {}) {
  const pw = new PlayerWeapon({ weapon, liveSpeed: speed });
  if (animCtx) pw.animCtx = animCtx;
  const dt = 1 / 60;
  pw.update(dt);
  const hits = [];
  let t = dt;
  while (t < 20 && hits.length < 4) {
    pw.gesture(0, 0, true, dt, 1000, { bowDrawback, swingMode: 2, rolls: () => 0 });
    if (pw.update(dt).includes('hit')) hits.push(t + dt);
    t += dt;
  }
  assert.ok(hits.length >= 3, `three hits, saw ${hits.length} on ${weapon.templateIndex}`);
  const gaps = hits.slice(1).map((h, i) => h - hits[i]);
  return gaps.reduce((a, b) => a + b, 0) / gaps.length;
}

test('BAL-ARCHERY: both bows are +1 at each end, and nothing else in the span moved', () => {
  assert.deepEqual([weaponMinDamage(WEAPONS.Short_Bow), weaponMaxDamage(WEAPONS.Short_Bow)], [5, 17]);
  assert.deepEqual([weaponMinDamage(WEAPONS.Long_Bow), weaponMaxDamage(WEAPONS.Long_Bow)], [5, 19]);
  assert.deepEqual([weaponMinDamage(WEAPONS.Longsword), weaponMaxDamage(WEAPONS.Longsword)], [2, 16]);
  assert.deepEqual([weaponMinDamage(WEAPONS.Claymore), weaponMaxDamage(WEAPONS.Claymore)], [2, 18]);
  assert.equal(weaponMinDamage(gun().templateIndex), 7);
  assert.equal(weaponMaxDamage(gun().templateIndex), 26);
  assert.equal(RRI_WEAPON_MIN_DAMAGE[WEAPONS.Long_Bow], 5);
  assert.equal(RRI_WEAPON_MAX_DAMAGE[WEAPONS.Short_Bow], 17);
  assert.equal(RRI_WEAPON_MAX_DAMAGE[WEAPONS.Long_Bow], 19);
  assert.equal(RRI_WEAPON_MIN_DAMAGE[WEAPONS.Mace], 4, 'the mace stayed on the mod\'s row');
});

test('BAL-ARCHERY: a bow takes the two-handed strength term, in either hand; the stock core still adds it once', () => {
  const p = player(100);
  assert.equal(pcaaoDamageModifier(STR), 2);
  assert.equal(pcaaoWeaponAttackDamage(p, foe, 0, 0, { ...bow(), material: 1 }, () => 0, M), 5 + 4, 'min 5 plus the doubled term');
  const clay = pcaaoWeaponAttackDamage(p, foe, 0, 0, { ...daedric(WEAPONS.Claymore), material: 1 }, () => 0, M);
  assert.equal(clay, 2 + 4, 'a claymore was already doubled, and is not doubled again');
  setValue('Enhancements', 'BowLeftHandWithSwitching', true);
  try {
    assert.equal(getItemHands(bow()), ITEM_HANDS.LeftOnly);
    assert.equal(pcaaoWeaponAttackDamage(p, foe, 0, 0, { ...bow(), material: 1 }, () => 0, M), 5 + 4, 'a left-hand bow still doubles');
  } finally {
    setValue('Enhancements', 'BowLeftHandWithSwitching', false);
  }
  const stock = weaponAttackDamage(p, foe, 0, { ...bow(), material: 1 }, () => 0);
  assert.equal(stock, 5 + damageModifier(STR), 'overhaul off: every weapon, a bow included, adds strength once');
  const tl = pcaaoWeaponAttackDamage(p, foe, 0, 0, { ...gun(), material: 1 }, () => 0, M);
  assert.equal(tl, 7 + 4, 'the Thunderlock was already two-handed and is not doubled a second time');
});

test('BAL-ARCHERY: a shaft is 35% faster; a spell and a gun orb stay on MISSILE_SPEED; the bow clock is the one it was', () => {
  assert.equal(MISSILE_SPEED, 25);
  assert.equal(ARROW_FLIGHT_SPEED, MISSILE_SPEED * 1.35);
  assert.equal(getBowCooldownTime(50), (10 * (100 - 50) + 800) / 980);
  assert.equal(getBowCooldownTime(SPD), (10 * (100 - SPD) + 800) / 980);
  assert.equal(CLASSIC_UPDATE_INTERVAL, 0.0625);
  assert.equal(GUN_FEEL.reloadMs, 1700);
  assert.equal(GUN_COOLDOWN_SECONDS, 1.7);
});

test('BAL-ARCHERY: mastery is +1% of the blow per effective point past 100, and never against a player', () => {
  const loc = globalThis.location;
  globalThis.location = { search: '?online' };
  try {
    _resetWeaponMasteryForTests();
    const bowW = bow();
    assert.equal(weaponPastPct(bowW, player(100), foe), 0);
    assert.equal(weaponPastPct(blade(), player(100), foe), 0);
    assert.equal(weaponPastPct(bowW, player(200), foe), 40);
    assert.equal(weaponPastPct(blade(), player(200), foe), 40);
    assert.equal(weaponMasteryBlow(bowW, 100, player(200), foe), 140);
    assert.equal(weaponMasteryBlow(bowW, 100, player(200), { isPlayer: true }), 100, 'a player target takes the blow as struck');
    assert.equal(weaponMasteryBlow(bowW, 100, player(200), { ...foe, warded: true }), 100);
  } finally {
    globalThis.location = loc;
    _resetWeaponMasteryForTests();
  }
});

test('BAL-ARCHERY: a backstab, a damage affix and Potent Vs land on a bow the same way they land on a longsword', () => {
  assert.equal(pcaaoBackstabDamage(20, 50, () => 0), 60);
  assert.equal(pcaaoBackstabDamage(26, 50, () => 0), 78);
  _resetForTests();
  setPref('lootRarity', true);
  try {
    const mark = (w) => affixWeaponDamage({ ...w, affixes: [{ id: 'damage', value: 20 }] }, 10);
    assert.equal(mark(bow()), 12);
    assert.equal(mark(blade()), 12);
    assert.equal(affixWeaponDamage(bow(), 10), 10, 'no affix, no change');
  } finally { _resetForTests(); }
  const undead = { mobileType: 15 };
  const ench = (w) => doItemEnchantmentPayloads(PAYLOAD.Strikes, { ...w, enchantments: [{ type: ENCHANTMENT_TYPES.PotentVs, param: 0 }] }, { target: undead, damage: 10 });
  assert.equal(ench(bow()), 10 + POTENT_VS_DAMAGE);
  assert.equal(ench(blade()), 10 + POTENT_VS_DAMAGE);
  assert.equal(doItemEnchantmentPayloads(PAYLOAD.Strikes, { ...bow(), enchantments: [{ type: ENCHANTMENT_TYPES.PotentVs, param: 0 }] }, { target: foe, damage: 10 }), 10, 'a foe of another affinity takes none of it');
});

test('BAL-ARCHERY: a Thunderlock reloads from live Speed, and the pump already running keeps its span', () => {
  const hundredths = (x) => Math.round(x * 100) / 100;
  assert.deepEqual([50, 75, 100, 150].map((s) => hundredths(thunderlockReloadSeconds(s))), [1.7, 1.53, 1.36, 1.02]);
  assert.equal(thunderlockReloadSeconds(200), 1);
  assert.equal(thunderlockReloadSeconds(50), GUN_COOLDOWN_SECONDS);
  assert.ok(thunderlockReloadSeconds(0) > GUN_COOLDOWN_SECONDS);
  assert.equal(PISTOLET_FEEL.reloadMs, 1400);
  const fortified = { stats: { speed: 50 }, activeEffects: [{ kind: 'fortifyAttribute', stat: 'speed', magnitude: 25 }] };
  assert.equal(liveStat(fortified, 'speed'), 75);
  const tuned = new PlayerWeapon({ weapon: gun(), liveSpeed: () => liveStat(fortified, 'speed') });
  tuned.update(1 / 60);
  assert.equal(hundredths(tuned.machine.cooldown), 1.53, 'the machine reads effective Speed');
  const pw = new PlayerWeapon({ weapon: gun(), liveSpeed: 50 });
  const dt = 1 / 60;
  pw.update(dt);
  let span = null;
  for (let i = 0; i < 400 && span == null; i++) {
    pw.gesture(0, 0, true, dt, 1000, { swingMode: 2, rolls: () => 0 });
    if (pw.update(dt).includes('done')) span = pw.machine.cooldownUntil - pw.machine.now;
  }
  assert.equal(hundredths(span), 1.7);
  const until = pw.machine.cooldownUntil;
  pw.liveSpeed = 150;
  pw.update(dt);
  assert.equal(pw.machine.cooldownUntil, until, 'the pump and the fire gate share the span committed at the shot');
  assert.equal(hundredths(pw.machine.cooldown), 1.02, 'the next shot takes the new Speed');
  assert.equal(pw.gesture(0, 0, true, dt, 1000, { swingMode: 2, rolls: () => 0 }), null);
  const bowPw = new PlayerWeapon({ weapon: bow(), liveSpeed: 150 });
  bowPw.update(dt);
  assert.equal(bowPw.machine.cooldown, null, 'a bow still cools by getBowCooldownTime');
});

test('BAL-ARCHERY: sustained damage of a Daedric Long Bow, a Daedric Longsword and a Daedric Thunderlock', () => {
  const p = player(100);
  const b = bow(), s = blade(), g = gun();
  const bowHit = mean(p, foe, b, SWING_MODS.StrikeDown.damage);
  const bladeHit = mean(p, foe, s, clickSwing);
  const gunHit = mean(p, foe, g, clickSwing);
  const beforeHit = meanBefore(p, b, SWING_MODS.StrikeDown.damage);
  const entity = { stats, equip: { slots: { [EQUIP_SLOTS.RightHand]: s } } };
  const animCtx = () => ({ entity, weaponType: WEAPON_TYPES.LongBlade, usingRightHand: true });
  const bowGap = hitGap(b, SPD);
  const bladeGap = hitGap(s, SPD, { animCtx });
  const gunGap = hitGap(g, SPD);
  const heft = swingHeft(4.5, STR);
  const frame = swingFrameSeconds(SPD, { heft, handling: swingHandling(WEAPON_TYPES.LongBlade, false) });
  const plate = { group: 'Armor', templateIndex: 103, material: 0x209, maxCondition: 100, currentCondition: 100 };
  const plateId = pcaaoArmorMaterialIdentifier(plate);
  const cut = (d) => pcaaoPercentageReductionCalculationWithWeapon(plate, plateId, STR, d, false, 1, false, 0, M);
  const frames = (gap) => Math.round(gap * 60);
  assert.equal(bowHit, 26);
  assert.equal(beforeHit, 23);
  assert.equal(bladeHit, 17);
  assert.equal(gunHit, 26.5);
  assert.equal(frames(bowGap), 96, 'seven bow ticks plus the cooldown, at 60 fps');
  assert.equal(frames(bladeGap), 55);
  assert.equal(frames(gunGap), 124, 'seven gun frames plus Speed 70\'s reload');
  assert.equal(clickSwing, 0);
  assert.ok(Math.abs(bowGap - (7 * CLASSIC_UPDATE_INTERVAL + getBowCooldownTime(SPD))) < 0.05);
  assert.ok(Math.abs(bladeGap - 5 * frame) < 0.05, `blade gap ${bladeGap} frame ${frame}`);
  const bowDps = bowHit / bowGap, bladeDps = bladeHit / bladeGap, beforeDps = beforeHit / bowGap;
  assert.ok(Math.abs(bowDps / bladeDps - 0.876) < 0.002, `PvE ${(bowDps / bladeDps).toFixed(3)} — target 0.80-0.90`);
  assert.ok(Math.abs(beforeDps / bladeDps - 0.775) < 0.002, 'the same clocks, the span and the strength term as they were');
  assert.equal(cut(bowHit), 9);
  assert.equal(cut(bladeHit), 6);
  const pvp = (cut(bowHit) / bowGap) / (cut(bladeHit) / bladeGap);
  assert.ok(Math.abs(pvp - 0.859) < 0.002, `PvP vs Daedric plate ${(pvp).toFixed(3)} — target 0.70-0.80, not met: no PvP multiplier was added`);
  assert.equal(mean({ ...p, stats: { ...stats, strength: 50 } }, foe, b, SWING_MODS.StrikeDown.damage), 22);
  assert.equal(mean({ ...p, stats: { ...stats, strength: 100 } }, foe, b, SWING_MODS.StrikeDown.damage), 32);
  assert.equal(frames(hitGap(b, 50)), 108);
  assert.equal(frames(hitGap(b, 100)), 77);
  const notes = { hit: false, critical: false, backstab: false };
  const critBow = pcaaoAttackDamage(p, foe, { weapon: b, damageMod: SWING_MODS.StrikeDown.damage, backstabChance: 100, rolls: () => 0, modules: M, notes });
  const bladeNotes = { hit: false, critical: false, backstab: false };
  const critBlade = pcaaoAttackDamage(p, foe, { weapon: s, damageMod: clickSwing, backstabChance: 100, rolls: () => 0, modules: M, notes: bladeNotes });
  assert.equal(notes.critical && notes.backstab && bladeNotes.critical && bladeNotes.backstab, true);
  assert.equal(critBow, 137);
  assert.equal(critBlade, 72);
  const loc = globalThis.location;
  globalThis.location = { search: '?online' };
  try {
    _resetWeaponMasteryForTests();
    const hard = mean(player(200), foe, b, SWING_MODS.StrikeDown.damage);
    const sword = mean(player(200), foe, s, clickSwing);
    assert.ok(Math.abs(hard / bowHit - 1.4) < 0.02, `mastery ${hard}`);
    assert.ok(Math.abs((hard / bowGap) / (sword / bladeGap) - bowDps / bladeDps) < 0.02, 'skill 200 scales both, so the ratio holds');
  } finally {
    globalThis.location = loc;
    _resetWeaponMasteryForTests();
  }
});
