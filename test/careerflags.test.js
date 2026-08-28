// CF1 - THE LAST TWO INERT CAREER FLAGS GET THEIR READERS.
// "Expertise In" (FormulaHelper.CalculateProficiencyModifiers,
// :908-931 - S23 shipped only the FORBIDDEN half of the proficiency
// bitfield) and Acute Hearing (DaggerfallEnemy.Start :53-71 - the
// enemy audio range multiplier). With these the CAREER FLAGS ledger
// row's inert list is EMPTY.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { proficiencyModifiers } from '../src/combat/formulas.js';
import { acuteHearingMultiplier, ATTRACT_RADIUS } from '../src/characters/enemySounds.js';
import { playEnemyClip, tickEnemySound } from '../src/scenes/hostCombat.js';
import { PROFICIENCY_BITS, SPECIAL_ABILITY_BITS } from '../src/systems/specialAdvantages.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, 'src', p), 'utf8');

// the port packs the EXPERT set at bits 16..21 of the career's
// weaponArmorShieldsBitfield (the chargen writer's layout)
const expert = (bit) => ({ career: { weaponArmorShieldsBitfield: bit << 16 } });
const DAGGER = { group: 'Weapons', templateIndex: 113 };     // ShortBlades
const KATANA = { group: 'Weapons', templateIndex: 123 };     // LongBlades (Dai-Katana)

// ---------------------------------------------------------------
// 1. EXPERTISE IN (CalculateProficiencyModifiers, verbatim)
// ---------------------------------------------------------------

test('CF1 expertise: an expert weapon grants damage level/3 + 1 and to-hit level', () => {
  const a = { ...expert(PROFICIENCY_BITS.shortBlade), level: 12 };
  assert.deepEqual(proficiencyModifiers(a, DAGGER), { damageMod: 5, toHitMod: 12 });
  assert.deepEqual(proficiencyModifiers({ ...a, level: 7 }, DAGGER), { damageMod: 3, toHitMod: 7 },
    'the /3 truncates (:920)');
  assert.deepEqual(proficiencyModifiers(a, KATANA), { damageMod: 0, toHitMod: 0 },
    'a long blade is not a short-blade expertise');
  assert.deepEqual(proficiencyModifiers({ level: 12 }, DAGGER), { damageMod: 0, toHitMod: 0 },
    'no career, no bonus');
});

test("CF1 expertise: the weaponless arm reads HandToHand - DFU's own classic departure, kept", () => {
  const a = { ...expert(PROFICIENCY_BITS.handToHand), level: 9 };
  assert.deepEqual(proficiencyModifiers(a, null), { damageMod: 4, toHitMod: 9 },
    '"Hand-to-hand proficiency is not applied in classic" - and the code applies it (:924-928)');
  assert.deepEqual(proficiencyModifiers({ ...expert(PROFICIENCY_BITS.shortBlade), level: 9 }, null),
    { damageMod: 0, toHitMod: 0 }, 'the weaponless arm reads ONLY the HandToHand bit');
});

test('CF1 expertise: the -1 quirk - an unlisted weapon template masks every expert bit', () => {
  // GetWeaponSkillUsed's default returns (int)Skills.None = -1
  // (:938), and -1 & anything is anything - the same quirk the
  // FORBIDDEN test has ridden since S23, now on the expert side too.
  const a = { ...expert(PROFICIENCY_BITS.missileWeapon), level: 6 };
  assert.deepEqual(proficiencyModifiers(a, { group: 'Weapons', templateIndex: 999 }),
    { damageMod: 3, toHitMod: 6 }, 'any expert career is "expert" in an unlisted weapon');
});

test('CF1 expertise: wired into the attack ladder in DFU\'s slot - player only, BEFORE racial', () => {
  const s = src('combat/formulas.js');
  const i = s.indexOf('if (attacker.isPlayer) {');
  const block = s.slice(i, s.indexOf('chanceToHitMod += backstabChance;', i));
  assert.ok(i > 0 && block.includes('proficiencyModifiers(attacker, weapon)'),
    'the proficiency mods ride the attacker == player block (:594-613)');
  assert.ok(block.indexOf('proficiencyModifiers') < block.indexOf('racialModifiers'),
    'proficiency before racial, FormulaHelper.cs:602-609');
  assert.equal(/FLAGGED: CalculateProficiencyModifiers pends/.test(s), false, 'the flag sentence is gone');
});

// ---------------------------------------------------------------
// 2. ACUTE HEARING (DaggerfallEnemy.Start :53-71)
// ---------------------------------------------------------------

test('CF1 hearing: x1.25 with the career bit, x1.5 with the unported enchantment\'s flag, x1 without', () => {
  assert.equal(acuteHearingMultiplier(null), 1);
  assert.equal(acuteHearingMultiplier({ career: {} }), 1);
  const hearer = { career: { abilityFlagsAndSpellPointsBitfield: SPECIAL_ABILITY_BITS.acuteHearing } };
  assert.equal(acuteHearingMultiplier(hearer), 1.25);
  assert.equal(acuteHearingMultiplier({ ...hearer, improvedAcuteHearing: true }), 1.5,
    'ImprovedAcuteHearing waits on the enchantment arc - the routed gap, not this reader');
});

test('CF1 hearing: the multiplier reaches the ONE clip seam\'s maxDistance', () => {
  const calls = [];
  const audio = { play3d: (clip, pos, vol, opts) => calls.push(opts) };
  playEnemyClip(audio, { clip: 42, volume: 1 }, [0, 0, 0], 1.25);
  assert.equal(calls[0].maxDistance, ATTRACT_RADIUS * 1.25);
  playEnemyClip(audio, { clip: 42, volume: 1 }, [0, 0, 0]);
  assert.equal(calls[1].maxDistance, ATTRACT_RADIUS, 'the default hears at the plain radius');
  // and tickEnemySound forwards it to the same seam
  const source = { tick: () => ({ clip: 7, volume: 1 }) };
  tickEnemySound(source, [0, 0, 0], [1, 0, 0], 0.016, { audio, hearing: 1.25 });
  assert.equal(calls[2].maxDistance, ATTRACT_RADIUS * 1.25);
});

test('CF1 hearing: all three enemy pools pass the player\'s multiplier at BOTH plays', () => {
  for (const h of ['scenes/cityGuards.js', 'scenes/dungeonContext.js', 'scenes/exteriorFoes.js']) {
    const s = src(h);
    assert.match(s, /hearing: acuteHearingMultiplier\(playerEntity\)/, `${h}'s bark tick carries it`);
    assert.match(s, /\.sounds\.attack\(\), (?:g|f)\.ai\.feet, acuteHearingMultiplier\(playerEntity\)\)/,
      `${h}'s attack sound carries it`);
  }
});
