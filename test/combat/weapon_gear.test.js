// WEAPON-GEAR (2026-10-27, as the owner asked): online, each point of gear on a weapon
// skill adds 0.44% to its blow from the first point, added to MARTIAL2's climb (GEAR-ADDS, as the owner asked); the fists are their own, and nothing
// of it reaches a player, a refereed fight, a mentor or the beast.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, WEAPON_MATERIALS } from '../../src/characters/weapons.js';
import { pcaaoWeaponAttackDamage, pcaaoModules } from '../../src/combat/pcaao.js';
import {
  weaponPastPct, weaponGearPct, weaponMasteryBlow, WEAPON_GEAR_PER_POINT, WEAPON_GEAR_PCT_MOST, _resetWeaponMasteryForTests,
} from '../../src/systems/weaponMastery.js';
import { BLOW_TOPS } from '../../src/systems/powerCeiling.js';
import { masteryBlowTop } from '../../tools/powerCeiling.mjs';
import { SKILLS, skillValue } from '../../src/systems/skills.js';

const ALL_ON = { Enabled: true, equipmentDamageEnhanced: false, fadingEnchantedItems: false, fixedStrengthDamageModifier: true, armorHitFormulaRedone: true, criticalStrikesIncreaseDamage: true, conditionBasedEffectiveness: false, softMaterialRequirements: true };
const M = pcaaoModules((k) => ALL_ON[k], () => undefined);
const skillsOf = (v) => Object.fromEntries(Array.from({ length: 35 }, (_, i) => [i, v]));
const foe = { isPlayer: false, careerIndex: 0, level: 5, health: 100, maxHealth: 100 };
const low = { ...foe, health: 10 };
/** A player trained to `trained` in every skill (Long Blade, Axe and Archery mastered), `gear` more on each weapon skill. */
const player = (trained, gear = 0) => ({
  isPlayer: true, _online: true, level: 45, raceId: 1, skills: skillsOf(trained),
  stats: { strength: 100, intelligence: 50, willpower: 50, agility: 100, endurance: 100, personality: 50, speed: 100, luck: 50 },
  masteredSkills: [SKILLS.Archery, SKILLS.LongBlade, SKILLS.Axe], career: { weaponArmorShieldsBitfield: 0 },
  _mods: { skills: { [SKILLS.LongBlade]: gear, [SKILLS.Archery]: gear, [SKILLS.Axe]: gear, [SKILLS.ShortBlade]: gear, [SKILLS.HandToHand]: gear } },
});
const daedric = (templateIndex) => ({ group: 'Weapons', templateIndex, material: WEAPON_MATERIALS.Daedric, flags: 0, maxCondition: 100, currentCondition: 100 });
const ON = { online: true };
const online = (fn) => {
  const loc = globalThis.location;
  globalThis.location = { search: '?online' };
  _resetWeaponMasteryForTests();
  try { return fn(); } finally { globalThis.location = loc; _resetWeaponMasteryForTests(); }
};

const near = (a, b, why) => assert.ok(Math.abs(a - b) < 1e-9, `${why}: ${a} against ${b}`);

test('WEAPON-GEAR: 0.44% a point of gear from the first point - the sheet of 872 (trained 200, 672 on it) x4.36, counted to 320', () => {
  assert.equal(WEAPON_GEAR_PER_POINT, 0.44);
  assert.equal(skillValue(player(200, 672), SKILLS.LongBlade), 140 + 672, 'the gear on the skill counts');
  near(weaponGearPct(player(200, 672), SKILLS.LongBlade, ON), 295.68, 'the top kit');
  near(weaponGearPct(player(50, 50), SKILLS.LongBlade, ON), 22, 'a low weapon player gains from the first point');
  near(weaponGearPct(player(100, 100), SKILLS.LongBlade, ON), 44, 'below 200 live');
  assert.equal(weaponGearPct(player(200), SKILLS.LongBlade, ON), 0, 'no gear: none');
  assert.equal(weaponGearPct(player(100, 5000), SKILLS.LongBlade, ON), WEAPON_GEAR_PCT_MOST, 'counted to the most');
  assert.equal(BLOW_TOPS.mastery, masteryBlowTop(), 'the ceiling\'s mastery top is the climb\'s most and the gear\'s');
  assert.equal(BLOW_TOPS.mastery, 400);
});

test('WEAPON-GEAR: every weapon family adds its climb and its gear - the sword, the axe, the bow, the dagger; never the fists', () => {
  const sword = daedric(WEAPONS.Longsword), axe = daedric(WEAPONS.War_Axe), bow = daedric(WEAPONS.Long_Bow), dagger = daedric(WEAPONS.Dagger);
  const geared = player(200, 672), trained = player(200), both = player(200, 100);
  for (const w of [sword, bow]) near(weaponPastPct(w, geared, foe, ON), 335.68, `${w.templateIndex}: the climb's 40 and the gear's`);
  near(weaponPastPct(dagger, geared, foe, ON), 295.68, 'the dagger\'s climb is its pace, its gear its blow');
  near(weaponPastPct(axe, geared, foe, ON), 295.68, 'the axe at full health: its climb pays nothing there, its gear does');
  near(weaponPastPct(axe, geared, low, ON), 375.68, 'the axe\'s finish and its gear');
  assert.equal(weaponPastPct(sword, trained, foe, ON), 40, 'no gear: MARTIAL2\'s climb, as it was');
  assert.equal(weaponPastPct(axe, trained, low, ON), 80, 'the axe\'s finish, as it was');
  near(weaponPastPct(sword, both, foe, ON), 84, '100 of gear on a trained 200 adds, never the greater');
  assert.equal(weaponPastPct(null, geared, foe, ON), 0, 'the fists read their skill in their roll already');
});

test('WEAPON-GEAR: only my blow online at a foe - offline, a mentor, the beast, a peer and a player target take nothing', () => {
  const sword = daedric(WEAPONS.Longsword);
  assert.equal(weaponGearPct(player(100, 672), SKILLS.LongBlade, { online: false }), 0, 'offline is Daggerfall\'s');
  assert.equal(weaponGearPct({ ...player(100, 672), _mentor: {} }, SKILLS.LongBlade, ON), 0);
  assert.equal(weaponGearPct({ ...player(100, 672), isInBeastForm: true }, SKILLS.LongBlade, ON), 0);
  assert.equal(weaponGearPct({ ...player(100, 672), peer: true }, SKILLS.LongBlade, ON), 0);
  online(() => {
    assert.equal(weaponMasteryBlow(sword, 100, player(200, 672), foe), 435, 'x4.36, the fraction carried');
    assert.equal(weaponMasteryBlow(sword, 100, player(200, 672), { isPlayer: true }), 100, 'a player takes the blow as struck');
    assert.equal(weaponMasteryBlow(sword, 100, player(100), foe), 100, 'skill 100, no gear: as struck');
  });
});

test('WEAPON-GEAR: through the real core - a Daedric Longsword at the same roll strikes x3.96 for 672 gear against none', () => online(() => {
  const sword = daedric(WEAPONS.Longsword);
  const at = (p) => pcaaoWeaponAttackDamage(p, foe, 0, 0, sword, () => 0.5, M);
  const bare = at(player(100)), geared = at(player(100, 672));
  assert.ok(bare > 0);
  assert.ok(Math.abs(geared - bare * 3.9568) <= 1, `${geared} against ${bare}`);
}));
