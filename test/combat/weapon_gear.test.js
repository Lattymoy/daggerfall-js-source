// WEAPON-GEAR (2026-10-27, mob: "Bow and weapon fix", "Those are needed for pve"): online, a weapon's blow is also worth
// its LIVE skill - the trained climb and every point of gear on it - over 200, the greater of that and MARTIAL2's climb,
// so a weapon skill's gear pays in damage as Hand-to-Hand's always has; below 200 nothing changes, the fists are their
// own, and nothing of it reaches a player, a refereed fight, a mentor or the beast.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, WEAPON_MATERIALS } from '../../src/characters/weapons.js';
import { pcaaoWeaponAttackDamage, pcaaoModules } from '../../src/combat/pcaao.js';
import {
  weaponPastPct, weaponGearPct, weaponMasteryBlow, WEAPON_GEAR_DIVISOR, WEAPON_GEAR_SKILL_MOST, _resetWeaponMasteryForTests,
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

test('WEAPON-GEAR: the live skill over 200 - x4.36 at 872, nothing at or below 200, counted to 1,000 (x5)', () => {
  assert.equal(WEAPON_GEAR_DIVISOR, 200);
  const geared = player(100, 772);
  assert.equal(skillValue(geared, SKILLS.LongBlade), 872, 'the gear on the skill counts');
  assert.ok(Math.abs(weaponGearPct(geared, SKILLS.LongBlade, ON) - 336) < 1e-9);
  assert.equal(weaponGearPct(player(100, 100), SKILLS.LongBlade, ON), 0, '200: x1');
  assert.equal(weaponGearPct(player(100, 80), SKILLS.LongBlade, ON), 0, 'below 200: none');
  assert.equal(weaponGearPct(player(100, 5000), SKILLS.LongBlade, ON), (WEAPON_GEAR_SKILL_MOST / WEAPON_GEAR_DIVISOR - 1) * 100, 'counted to the most');
  assert.equal(BLOW_TOPS.mastery, masteryBlowTop(), 'the ceiling\'s mastery top is the most counted');
  assert.equal(BLOW_TOPS.mastery, 400);
});

test('WEAPON-GEAR: every weapon family takes the greater of its climb and its gear - the sword, the axe, the bow, the dagger; never the fists', () => {
  const sword = daedric(WEAPONS.Longsword), axe = daedric(WEAPONS.War_Axe), bow = daedric(WEAPONS.Long_Bow), dagger = daedric(WEAPONS.Dagger);
  const geared = player(100, 772), trained = player(200), both = player(200, 140);
  for (const w of [sword, bow, dagger]) assert.ok(Math.abs(weaponPastPct(w, geared, foe, ON) - 336) < 1e-9, `${w.templateIndex}: the gear's x4.36`);
  assert.ok(Math.abs(weaponPastPct(axe, geared, foe, ON) - 336) < 1e-9, 'the axe at full health: its climb pays nothing there, its gear does');
  assert.equal(weaponPastPct(sword, trained, foe, ON), 40, 'no gear: MARTIAL2\'s climb, as it was');
  assert.equal(weaponPastPct(axe, trained, low, ON), 80, 'the axe\'s finish, as it was');
  assert.equal(weaponPastPct(axe, both, low, ON), 80, 'live 280 is x1.4 - the finish\'s x1.8 is more');
  assert.ok(Math.abs(weaponPastPct(sword, both, foe, ON) - 40) < 1e-9, 'live 280 is x1.4, the climb\'s own');
  assert.equal(weaponPastPct(null, geared, foe, ON), 0, 'the fists read their skill in their roll already');
});

test('WEAPON-GEAR: only my blow online at a foe - offline, a mentor, the beast, a peer and a player target take nothing', () => {
  const sword = daedric(WEAPONS.Longsword);
  assert.equal(weaponGearPct(player(100, 772), SKILLS.LongBlade, { online: false }), 0, 'offline is Daggerfall\'s');
  assert.equal(weaponGearPct({ ...player(100, 772), _mentor: {} }, SKILLS.LongBlade, ON), 0);
  assert.equal(weaponGearPct({ ...player(100, 772), isInBeastForm: true }, SKILLS.LongBlade, ON), 0);
  assert.equal(weaponGearPct({ ...player(100, 772), peer: true }, SKILLS.LongBlade, ON), 0);
  online(() => {
    assert.equal(weaponMasteryBlow(sword, 100, player(100, 772), foe), 436, 'x4.36');
    assert.equal(weaponMasteryBlow(sword, 100, player(100, 772), { isPlayer: true }), 100, 'a player takes the blow as struck');
    assert.equal(weaponMasteryBlow(sword, 100, player(100, 100), foe), 100, 'skill 200 with gear: as struck');
  });
});

test('WEAPON-GEAR: through the real core - a Daedric Longsword at the same roll strikes x4.36 for skill 872 against no gear', () => online(() => {
  const sword = daedric(WEAPONS.Longsword);
  const at = (p) => pcaaoWeaponAttackDamage(p, foe, 0, 0, sword, () => 0.5, M);
  const bare = at(player(100)), geared = at(player(100, 772));
  assert.ok(bare > 0);
  assert.ok(Math.abs(geared - bare * 4.36) <= 1, `${geared} against ${bare}`);
}));
