// AUDIT 24, wave 28: the twelve-slice sweep's combat/entity findings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateSuccessfulHit } from '../src/combat/formulas.js';
import { NUMBER_BODY_PARTS } from '../src/systems/armorMaterials.js';
import { assignStartingGear } from '../src/systems/startingGear.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('audit24 wave28: a fresh character is UNARMOURED at 100, not 0', () => {
  // CalculateArmorToHit (FormulaHelper.cs:1149-1161) reads
  // target.ArmorValues[part] and DFU has no scalar fallback, because
  // every entity carries the array from creation:
  // CharacterDocument.cs:86-88 fills the player's seven parts with 100
  // and PlayerEntity.AssignCharacter copies it wholesale (:853).
  //
  // The port nulled the array in chargen as a lazy-rebuild trick that
  // never fired - updateEquippedArmorValues early-returns for a
  // non-Armor, non-footwear item BEFORE armorValuesOf, and the
  // starting kit is a shirt and pants - and then read the invented
  // `armor: 0` scalar. A hundred points of chance-to-hit, below the
  // 3..97 clamp: enemies essentially could not hit a new character.
  const src = rd('src/systems/chargenSession.js');
  assert.equal((src.match(/playerEntity\.armorValues = new Array\(NUMBER_BODY_PARTS\)\.fill\(100\);/g) ?? []).length, 2,
    'BOTH chargen construction paths - the UI one and the headless one');
  assert.doesNotMatch(src, /playerEntity\.armorValues = null;/);
  assert.equal(NUMBER_BODY_PARTS, 7);

  // and the equip path really does not rebuild it for the starting kit
  const kit = { items: [], equip: null, armorValues: null, stats: { strength: 50, agility: 50, luck: 50 } };
  assignStartingGear(kit, { classIndex: 0 });
  assert.equal(kit.armorValues, null, 'the shirt and pants never reach armorValuesOf - which is why the null was fatal');
});

test('audit24 wave28: the to-hit armour term has NO scalar fallback', () => {
  const A = { skills: 40, stats: { strength: 50, agility: 60, luck: 50 } };
  const base = { skills: 40, stats: { strength: 50, agility: 50, luck: 50 } };
  const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

  // 40 + 100 + 1 - 10 - 50 = 81
  const unarmoured = { ...base, armorValues: new Array(7).fill(100) };
  assert.equal(calculateSuccessfulHit(A, unarmoured, 40, 0, seq(0.99, 0.80)), true);
  assert.equal(calculateSuccessfulHit(A, unarmoured, 40, 0, seq(0.99, 0.81)), false);

  // the same target with only the legacy scalar contributes ZERO -
  // 40 + 0 + 1 - 10 - 50 = -19, clamped to the 3% floor
  const scalarOnly = { ...base, armor: 100 };
  assert.equal(calculateSuccessfulHit(A, scalarOnly, 40, 0, seq(0.99, 0.02)), true);
  assert.equal(calculateSuccessfulHit(A, scalarOnly, 40, 0, seq(0.99, 0.03)), false);
  // scoped to the EXPRESSION, not the file - the comment above it
  // describes the fallback, and a whole-file doesNotMatch would fail
  // on the explanation rather than the code (the wave-23e trap).
  const f = rd('src/combat/formulas.js');
  assert.match(f, /chance \+= target\.armorValues\?\.\[struckBodyPart\] \?\? 0;/);
  assert.doesNotMatch(f, /chance \+= target\.armorValues \? /, 'the invented fallback is gone');
});

test('audit24 wave28: enemies carry the seven-part table, monster and class alike', async () => {
  // EnemyEntity.cs:264-267 and :286-291 fill every part with
  // ArmorValue * 5 for a monster; :409-413 starts a CLASS enemy at 100
  // ("no armor") before its equipment subtracts.
  const { makeEnemyEntity } = await import('../src/characters/enemyEntity.js');
  const { ENEMY_BASICS } = await import('../src/characters/enemyBasics.js');
  const rat = makeEnemyEntity(0, ENEMY_BASICS['0'], null, 1, () => 0);
  assert.equal(rat.armorValues.length, 7);
  assert.ok(rat.armorValues.every((v) => v === rat.armor), 'the scalar is an alias for a uniform array');
  assert.equal(rat.armor, ENEMY_BASICS['0'].armorValue * 5, "ArmorValue * 5, EnemyEntity.cs:266");

  // a CLASS enemy starts at 100 - "no armor" - and its equipment
  // subtracts from there
  const thief = makeEnemyEntity(138, ENEMY_BASICS['138'], { speed: 50, hitPointsPerLevel: 8 }, 1, () => 0);
  assert.ok(thief.isClass);
  assert.ok(thief.armorValues.every((v) => v === 100), 'EnemyEntity.cs:409-413');

  const src = rd('src/characters/enemyEntity.js');
  assert.match(src, /armorValues: new Array\(7\)\.fill\(isClass \? 100 : armor\)/);
});

test('audit24 wave28: MaxMagicka is a LIVE derivation, not a chargen snapshot', async () => {
  // DaggerfallEntity.cs:264 is `get { return GetMaxMagicka(); }` over
  // :484-491's `SpellPoints(stats.LiveIntelligence, career
  // .SpellPointMultiplierValue)`. LiveIntelligence is permanent +
  // effect mods (DaggerfallStats.cs:155-163), so any Fortify/Drain/
  // Transfer Intelligence moves the ceiling on the next read.
  const { defineLiveMaxMagicka } = await import('../src/systems/chargen.js');
  const e = {
    isPlayer: true,
    stats: { intelligence: 50 },
    career: { abilityFlagsAndSpellPointsBitfield: 0x1000 },   // x1.00
    activeEffects: [],
    maxMagicka: 0,
  };
  defineLiveMaxMagicka(e);
  assert.equal(e.maxMagicka, 50);

  e.activeEffects = [{ kind: 'drainAttribute', stat: 'intelligence', magnitude: 20 }];
  assert.equal(e.maxMagicka, 30, 'a Drain Intelligence lowers the ceiling at once');
  e.activeEffects = [{ kind: 'fortifyAttribute', stat: 'intelligence', magnitude: 30 }];
  assert.equal(e.maxMagicka, 80, 'and a Fortify raises it');
  e.activeEffects = [];

  // GetMaxMagicka adds MaxMagickaModifier and floors the result at 0
  e.maxMagickaModifier = -10;
  assert.equal(e.maxMagicka, 40);
  e.maxMagickaModifier = -9999;
  assert.equal(e.maxMagicka, 0, 'floored, DaggerfallEntity.cs:478-479');
  e.maxMagickaModifier = 0;

  // the NON-player arm returns the stored value ("enemies are set by
  // level elsewhere", :487) - and the setter is what stores it
  const enemy = { isPlayer: false, stats: { intelligence: 50 }, career: null, maxMagicka: 0 };
  defineLiveMaxMagicka(enemy);
  enemy.maxMagicka = 77;
  assert.equal(enemy.maxMagicka, 77);

  // Installing twice must be a no-op. On the PLAYER path the guard is
  // invisible - `career` is set, so the getter never reads the stored
  // value and a re-install cannot be observed. It is the enemy path
  // that needs it: a second install re-reads the descriptor, whose
  // `.value` on an accessor is undefined, and would drop the stored
  // ceiling to NaN. Removing the guard survived every player-side pin.
  defineLiveMaxMagicka(enemy);
  assert.equal(enemy.maxMagicka, 77, 'the stored ceiling survives a second install');

  // and chargen installs it
  assert.match(rd('src/systems/chargen.js'), /^  defineLiveMaxMagicka\(playerEntity\);$/m);
});
