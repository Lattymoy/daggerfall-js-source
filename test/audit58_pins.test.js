// AUDIT 58 (the unpinned-laws lane). Every law below already SHIPPED
// correctly - the defect was that nothing in the suite could tell if it
// stopped. Each of these was reproduced as a surviving mutant: the port
// value was changed, the whole suite stayed green, and the value was
// restored. So every assertion here is written against DAGGERFALL
// UNITY'S OWN LITERAL, never against the port's constant - a pin that
// reads the constant it is meant to hold is a tautology, which is
// exactly how three of these arms came to be vacuous.
//
//   1. PlayerEntity.cs:1377-1378 - the reflexes use-scale's DENOMINATOR
//      (`>> 16`). Only positive fixtures existed, so any MORE GENEROUS
//      shift was invisible: `>> 15` doubled every skill's advancement
//      rate with 6000+ tests green.
//   2. DaggerfallSkills.cs:485-547 - GetAdvancementMultiplier, 35 rows,
//      pinned at four cells. CriticalStrike 8 -> 6 and Jumping 5 -> 7
//      both survived.
//   3. LootTables.cs:217-223 - C1/C2/P1/P2 scale by player level, and
//      C3/M1/M2 DO NOT. Every existing call site zeroed the creature and
//      misc cells or passed level 1, where `* level` is the identity.
//   4. LootTables.cs:194 - `Random.Range(MinGold, MaxGold + 1)`. Every
//      gold assertion rolled 0, where the width does not matter.
//   5. FormulaHelper.cs:1512-1519 + :1532 - SavingThrow's mixed-tolerance
//      fold and the 5..95 clamp. Immune alone always crosses the
//      `>= 100 -> return 0` arm, so every existing career fixture was
//      unable to separate +50 from +100.
//   6. FormulaHelper.cs:1131-1132 - the 20% condition-damage floor roll.
//      The drives were 0.99 and 0.1, which agree for every threshold
//      from 11 to 99.
//   7. automapModel.js:48 - AABB_TOLERANCE, the containment skin. Its one
//      test computed its reference answer with the same symbol.
//   8. FormulaHelper.cs:779 - `Random.Range(min, max + 1)` in hand to
//      hand. Every drive was roll 0, where `min` comes back either way.
//   9. FormulaHelper.cs:2042-2043 - ApplyRegionalPriceAdjustment's OWN
//      floor of 1, reachable only when a base of 1 meets a sub-1000
//      region (the repair shop's every cheap item).
//  10. FormulaHelper.cs:1994 - CalculateTradePrice's SELLING branch had
//      no numeric anchor at all, only inequalities.
//  11. PlayerEntity.cs:2235-2242 - NormalizeReputations calls the TWO
//      argument ChangeReputation (PersistentFactionData.cs:390 defaults
//      propagate to false), so the 112-day faction drift does NOT fan
//      out. The one test on that arm ran on a one-record fixture that
//      could not see a walk.
//  12. VampirismEffect.cs:362 - `const int skillModAmount = 30;` (pinned
//      as a literal in vampirism.test.js, beside its twin).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { SKILL_ADVANCEMENT_MULTIPLIER, skillUsesForAdvancement, raiseSkills } from '../src/systems/advancement.js';
import { SKILLS } from '../src/systems/skills.js';
import { createCharacter } from '../src/systems/chargen.js';
import { CLASSIC_GAME_START_TIME as T0 } from '../src/systems/gameDate.js';
import { LOOT_MATRICES, generateRandomLoot } from '../src/systems/loot.js';
import { savingThrow, EFFECT_FLAGS } from '../src/systems/spellcast.js';
import { damageEquipment, handToHandAttackDamage } from '../src/combat/formulas.js';
import { BODY_PARTS } from '../src/systems/armorMaterials.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { buildAutomapModel } from '../src/systems/automapModel.js';
import { calculateCost, calculateTradePrice } from '../src/systems/shopStock.js';
import { calculateItemRepairCost } from '../src/systems/repairService.js';
import { normalizeReputations } from '../src/systems/court.js';
import { createFactionRep, setReputation } from '../src/systems/factionRep.js';
import { dfuFile } from './dfuRoot.mjs';   // PY1: DFU_PATH, then the in-tree sparse clone

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

// ── 1 + 2: advancement ────────────────────────────────────────────────
const career = {
  name: 'W', hitPointsPerLevel: 12, advancementMultiplier: 1.0,
  strength: 60, intelligence: 40, willpower: 45, agility: 55,
  endurance: 60, personality: 40, speed: 50, luck: 50,
  primarySkills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.CriticalStrike],
  majorSkills: [SKILLS.BluntWeapon, SKILLS.Dodging, SKILLS.Jumping],
  minorSkills: [SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Medical],
};

test('AUDIT 58: the reflexes use-scale is pinned from BOTH sides - a tally UNDER the bar never raises', () => {
  // PlayerEntity.cs:1377-1378
  //   int reflexesMod = 0x10000 - (((int)reflexes - 2) << 13);
  //   int calculatedSkillUses = (skillUses[i] * reflexesMod) >> 16;
  // The suite only ever asserted that a SUFFICIENT tally raises, so a
  // more generous denominator (`>> 15`) doubled every entity's effective
  // tally - every skill in the game advancing at half the required use
  // count - with the whole suite green. The negative case is the pin.
  const lb = SKILLS.LongBlade;

  // Average reflexes (2) is mod 0x10000 exactly: calcUses == uses.
  const p = { isPlayer: true, reflexes: 2, items: [] };
  createCharacter(p, career, 16, { rolls: seq(0) });
  const needed = skillUsesForAdvancement(p.skills[lb], SKILL_ADVANCEMENT_MULTIPLIER[lb], 1.0, 1);
  const startLb = p.skills[lb];
  p.skillUses[lb] = needed - 1;
  assert.deepEqual(raiseSkills(p, T0 + 361), [], 'one use short of the bar raises nothing');
  assert.equal(p.skills[lb], startLb, 'and the skill is untouched');
  assert.equal(p.skillUses[lb], needed - 1, 'and the tally is NOT reset by a failed check');
  // exactly on the bar it raises - the two together fix the scale
  p.skillUses[lb] = needed;
  assert.deepEqual(raiseSkills(p, T0 + 722), [lb]);

  // Low reflexes (4) is the SCALE-DOWN arm no fixture exercised:
  // mod = 0x10000 - (2 << 13) = 0xC000, i.e. 0.75x, so the bar moves UP.
  const q = { isPlayer: true, reflexes: 4, items: [] };
  createCharacter(q, career, 16, { rolls: seq(0) });
  assert.equal(0x10000 - ((4 - 2) << 13), 0xC000);
  const need4 = skillUsesForAdvancement(q.skills[lb], SKILL_ADVANCEMENT_MULTIPLIER[lb], 1.0, 1);
  q.skillUses[lb] = need4;
  assert.deepEqual(raiseSkills(q, T0 + 361), [], 'a full tally is only 3/4 of a use at Low reflexes');
  q.skillUses[lb] = Math.ceil(need4 / 0.75);
  assert.deepEqual(raiseSkills(q, T0 + 722), [lb], 'and 4/3 of the tally clears it');
});

// DaggerfallSkills.GetAdvancementMultiplier (DaggerfallSkills.cs:485-547),
// transcribed off the C# switch in DFCareer.Skills order - NOT read back
// from the port's own array, which is the whole point of the pin.
const DFU_ADVANCEMENT_MULTIPLIERS = [
  12,                                  // Medical
  1, 1,                                // Etiquette, Streetwise
  5,                                   // Jumping
  15, 15, 15, 15, 15, 15, 15, 15, 15,  // Orcish..Impish, the nine languages
  2,                                   // Lockpicking
  1,                                   // Mercantile
  2, 2,                                // Pickpocket, Stealth
  1,                                   // Swimming
  2,                                   // Climbing
  1,                                   // Backstabbing
  4,                                   // Dodging
  50,                                  // Running
  1,                                   // Destruction
  2,                                   // Restoration
  1, 1,                                // Illusion, Alteration
  2,                                   // Thaumaturgy
  1,                                   // Mysticism
  2, 2, 2, 2, 2,                       // ShortBlade, LongBlade, HandToHand, Axe, BluntWeapon
  1,                                   // Archery
  8,                                   // CriticalStrike
];

test('AUDIT 58: all 35 advancement multipliers, cell for cell against DaggerfallSkills.cs', () => {
  // Four of 35 cells were asserted, so CriticalStrike 8 -> 6 and
  // Jumping 5 -> 7 each survived the whole suite. A transcription typo
  // in a data table produces loot/advancement that is merely WRONG for
  // ever; only a whole-table pin catches it.
  assert.equal(DFU_ADVANCEMENT_MULTIPLIERS.length, 35);
  assert.deepEqual([...SKILL_ADVANCEMENT_MULTIPLIER], DFU_ADVANCEMENT_MULTIPLIERS);
  // and the two the mutation campaign named, by name rather than index
  assert.equal(SKILL_ADVANCEMENT_MULTIPLIER[SKILLS.CriticalStrike], 8);
  assert.equal(SKILL_ADVANCEMENT_MULTIPLIER[SKILLS.Jumping], 5);
});

const SKILLS_CS = dfuFile('Assets/Scripts/Game/Entities/DaggerfallSkills.cs');
test('AUDIT 58: the advancement multipliers REBUILT from DaggerfallSkills.cs', { skip: !existsSync(SKILLS_CS) && 'DFU checkout absent (DFU_PATH)' }, () => {
  // The audit24_loottables.test.js idiom: regenerate the table from the
  // reference rather than remember it, so the port cannot drift from a
  // DFU nobody re-reads. It skips without a checkout, which is why the
  // literal pin above is unconditional.
  const cs = readFileSync(SKILLS_CS, 'utf8');
  const body = cs.slice(cs.indexOf('public static int GetAdvancementMultiplier'));
  const switchBody = body.slice(0, body.indexOf('default:'));
  const rebuilt = new Map();
  let pending = [];
  for (const line of switchBody.split('\n')) {
    const label = /case\s+DFCareer\.Skills\.(\w+)\s*:/.exec(line);
    if (label) { pending.push(label[1]); continue; }
    const ret = /return\s+(\d+)\s*;/.exec(line);
    if (ret) { for (const name of pending) rebuilt.set(name, Number(ret[1])); pending = []; }
  }
  assert.equal(rebuilt.size, 35, 'the parse must find every case label, or it proves nothing');
  for (const [name, value] of rebuilt) {
    assert.equal(SKILL_ADVANCEMENT_MULTIPLIER[SKILLS[name]], value, `${name} advancement multiplier`);
  }
});

// ── 3 + 4: LootTables ─────────────────────────────────────────────────
test('AUDIT 58: the loot level split - C1/C2/P1/P2 scale, C3/M1/M2 are FLAT', () => {
  // LootTables.cs:217-223 (the released game over DF Chronicles):
  //   RandomIngredient(matrix.C1 * playerEntity.Level, CreatureIngredients1, items);
  //   RandomIngredient(matrix.C2 * playerEntity.Level, CreatureIngredients2, items);
  //   RandomIngredient(matrix.C3,                      CreatureIngredients3, items);
  //   RandomIngredient(matrix.P1 * playerEntity.Level, ...); P2 likewise;
  //   RandomIngredient(matrix.M1, ...); RandomIngredient(matrix.M2, ...);
  // Key K carries every ingredient cell non-zero (C1..M1 = 3, M2 = 2), so
  // at level 5 the SCALED cells sit at 15/15/15/15 while the flat ones
  // stay at 3/3/2. A constant roll of 0.09 (Dice100 sees 9) is above
  // every flat chance and below every scaled one, so the split itself
  // decides the whole outcome - no roll counting, and no cell can move
  // between the arms unnoticed.
  const k5 = generateRandomLoot(LOOT_MATRICES.K, { level: 5, gender: 'male' }, () => 0.09);
  const count = (items, group) => items.filter((i) => i.group === group).length;
  assert.equal(count(k5, 'CreatureIngredients1'), 1, 'C1 scales: 3 * 5 = 15 > 9');
  assert.equal(count(k5, 'CreatureIngredients2'), 1, 'C2 scales');
  assert.equal(count(k5, 'PlantIngredients1'), 1, 'P1 scales');
  assert.equal(count(k5, 'PlantIngredients2'), 1, 'P2 scales');
  assert.equal(count(k5, 'CreatureIngredients3'), 0, 'C3 is FLAT: still 3, and 9 misses');
  assert.equal(count(k5, 'MiscellaneousIngredients1'), 0, 'M1 is FLAT');
  assert.equal(count(k5, 'MiscellaneousIngredients2'), 0, 'M2 is FLAT');
  // the control: at level 1 the scaled cells ARE the flat ones, so the
  // same roll takes nothing at all - which is what makes level 1
  // fixtures blind to this law.
  const k1 = generateRandomLoot(LOOT_MATRICES.K, { level: 1, gender: 'male' }, () => 0.09);
  for (const g of ['CreatureIngredients1', 'CreatureIngredients2', 'PlantIngredients1', 'PlantIngredients2']) {
    assert.equal(count(k1, g), 0, `${g} at level 1 is the unscaled chance`);
  }
});

test('AUDIT 58: loot gold is Range(MinGold, MaxGold + 1) - MaxGold itself is reachable', () => {
  // LootTables.cs:194 `Random.Range(matrix.MinGold, matrix.MaxGold + 1)`
  // - Random.Range(int,int) is max-EXCLUSIVE, so the `+ 1` is what lets
  // a pile ever pay MaxGold. Every existing gold assertion rolled 0,
  // where MinGold comes back whatever the width is; key J is 50..150, so
  // a roll at the top separates 150 (correct) from 149 (no `+ 1`) and
  // from 50 (no spread at all).
  const top = generateRandomLoot(LOOT_MATRICES.J, { level: 1, gender: 'male' }, seq(0.999, 0.99));
  assert.equal(top[0].group, 'Currency');
  assert.equal(top[0].stackCount, 150, 'MaxGold is INCLUSIVE');
  // and the level multiply is outside the roll (`* playerEntity.Level`)
  const top3 = generateRandomLoot(LOOT_MATRICES.J, { level: 3, gender: 'male' }, seq(0.999, 0.99));
  assert.equal(top3[0].stackCount, 450);
});

// ── 5: SavingThrow ────────────────────────────────────────────────────
test('AUDIT 58: SavingThrow\'s mixed-tolerance fold and the 5..95 clamp, with no career data', () => {
  // FormulaHelper.cs:1512-1519 is DFU's own departure from classic -
  // tolerance flags MIX rather than short-circuit. Immune ALONE always
  // reaches the `savingThrow >= 100 -> return 0` arm (:1529-1530), which
  // is why every existing career fixture reads 0 whatever the Immune
  // term is: +50 and +100 are indistinguishable there. The fixtures
  // below force the fold PAST that arm and onto both clamp rails.

  // Immune on Fire + CriticalWeakness on Frost in one spell:
  // 50 + 50 - 50 = 50, + MagicResist 5 = 55, so it still ROLLS.
  const mixed = { stats: { willpower: 50 }, career: { immunityFlags: EFFECT_FLAGS.Fire, criticalWeaknessFlags: EFFECT_FLAGS.Frost } };
  const both = EFFECT_FLAGS.Fire | EFFECT_FLAGS.Frost;
  assert.equal(savingThrow(0, both, mixed, 0, seq(0.55)), 100, 'roll 56 > 55: the save fails whole');
  assert.equal(savingThrow(0, both, mixed, 0, seq(0.39)), 25, 'roll 40: 100 - 5*(55-40)');
  // Resistant is +25, not +30: 50 + 25 + 5 = 80.
  const res = { stats: { willpower: 50 }, career: { resistanceFlags: EFFECT_FLAGS.Fire } };
  assert.equal(savingThrow(0, EFFECT_FLAGS.Fire, res, 0, seq(0.699)), 50, 'roll 70: 100 - 5*(80-70)');
  // LowTolerance is -25, not -50: 50 - 25 + 5 = 30, clear of both rails.
  const low = { stats: { willpower: 50 }, career: { lowToleranceFlags: EFFECT_FLAGS.Fire } };
  assert.equal(savingThrow(0, EFFECT_FLAGS.Fire, low, 0, seq(0.25)), 80, 'roll 26: 100 - 5*(30-26)');
  // CriticalWeakness is -50, not -25: 50 - 50 + 5 = 5.
  const crit = { stats: { willpower: 50 }, career: { criticalWeaknessFlags: EFFECT_FLAGS.Fire } };
  assert.equal(savingThrow(0, EFFECT_FLAGS.Fire, crit, 0, seq(0.03)), 95, 'roll 4: 100 - 5*(5-4)');
  // the two stack, and their sum is what the floor catches:
  // 50 - 50 - 25 = -25, + 0 MagicResist, clamped UP to the floor of 5.
  const floorCase = { stats: { willpower: 0 }, career: { criticalWeaknessFlags: EFFECT_FLAGS.Fire, lowToleranceFlags: EFFECT_FLAGS.Frost } };
  assert.equal(savingThrow(0, both, floorCase, 0, seq(0.03)), 95, 'roll 4 <= the clamped 5: 100 - 5*1');
  // and the ceiling: 50 + 45 modifier = 95, + 5 MagicResist = 100 is
  // clamped DOWN to 95 (Mathf.Clamp(savingThrow, 5, 95), FH:1532), so a
  // roll of 96 still gets through.
  const ceilCase = { stats: { willpower: 50 }, career: {} };
  assert.equal(savingThrow(0, EFFECT_FLAGS.Fire, ceilCase, 45, seq(0.95)), 100, 'roll 96 > the clamped 95');
});

// ── 6: the condition-damage floor roll ────────────────────────────────
test('AUDIT 58: the condition-damage floor roll is exactly 20%', () => {
  // ApplyConditionDamageThroughPhysicalHit (FormulaHelper.cs:1131-1132):
  //   int amount = (10 * damage + 50) / 100;
  //   if ((amount == 0) && Dice100.SuccessRoll(20)) amount = 1;
  // Dice100 is `floor(roll * 100) < chance`, so 19 succeeds and 20 does
  // not. The existing drives (0.99 and 0.1) agree for EVERY threshold
  // from 11 to 99 - the one number the test names in its title was the
  // one number it could not see.
  const dude = () => ({ isPlayer: false, items: [], stats: {} });
  const att = dude(), tgt = dude();
  const w = mintCondition({ group: 'Weapons', name: 'Saber', templateIndex: 117, material: 2 });
  const w0 = w.currentCondition;
  damageEquipment(att, tgt, 4, w, BODY_PARTS.Chest, { rolls: () => 0.195 });
  assert.equal(w.currentCondition, w0 - 1, 'roll 19 is UNDER 20: the amount floors to 1');
  damageEquipment(att, tgt, 4, w, BODY_PARTS.Chest, { rolls: () => 0.205 });
  assert.equal(w.currentCondition, w0 - 1, 'roll 20 is NOT under 20: nothing');
});

// ── 7: the automap containment skin ───────────────────────────────────
test('AUDIT 58: AABB_TOLERANCE is 0.05, and the skin decides which model a probe credits', () => {
  // automapModel.js:48. DFU has no analogue constant - it resolves a
  // reveal by `hit.collider` - so the port's skin has neither a
  // reference anchor nor, until now, a pin: its one test computed its
  // reference answer with the same symbol on both sides, and a tenfold
  // widening to 0.5 left the whole suite green. These offsets are
  // LITERAL, never AABB_TOLERANCE arithmetic.
  const box = buildAutomapModel([{ key: 'k', aabb: [0, 0, 0, 1, 1, 1] }]);
  assert.equal(box.resolveAt([1.04, 0.5, 0.5])?.key, 'k', '0.04 out is inside the skin');
  assert.equal(box.resolveAt([1.06, 0.5, 0.5]), null, '0.06 out is off the model entirely');
  // the skin also decides WHICH model an in-bounds probe credits: at
  // 0.05 this point belongs to the floor slab, at 0.5 the pillar (a
  // tighter box) steals it, and the reveal ray credits a different mesh.
  const room = buildAutomapModel([
    { key: 'floor', aabb: { min: [0, 0, 0], max: [10, 0.2, 10] } },
    { key: 'pillar', aabb: { min: [4.3, 0, 4.3], max: [4.6, 3, 4.6] } },
  ]);
  assert.equal(room.resolveAt([4.15, 0.15, 4.45])?.key, 'floor', 'a wider skin answers pillar');
});

// ── 8: Range(min, max + 1) in hand to hand ────────────────────────────
test('AUDIT 58: hand-to-hand damage rolls Range(min, max + 1) - the top value is reachable', () => {
  // FormulaHelper.cs:779 `Random.Range(minBaseDamage, maxBaseDamage + 1)`.
  // Every drive in the tree was roll 0, where `min` comes back whether
  // the width is `max + 1 - min` or `max - min`, so dropping the `+ 1` -
  // which makes the top damage of every punch in the game unreachable -
  // survived the whole suite. The weapon twin one function down IS
  // driven at 0.999 and IS killed; this is the same idiom's other arm.
  const A = { level: 1, skills: 35, stats: { strength: 75, agility: 50, luck: 50 }, attackModifierFlags: null, isPlayer: true };
  // skill 35: min = floor(35/10) + 1 = 4, max = floor(35/5) + 1 = 8.
  // roll 0.999 -> 4 + floor(0.999 * 5) = 8; the player arm adds the
  // strength modifier floor((75-50)/5) = 5.
  assert.equal(handToHandAttackDamage(A, null, 0, false, seq(0.999)), 8, 'the inclusive maximum');
  assert.equal(handToHandAttackDamage(A, null, 0, true, seq(0.999)), 13);
});

// ── 9 + 10: CalculateCost / CalculateTradePrice ───────────────────────
test('AUDIT 58: ApplyRegionalPriceAdjustment has its OWN floor of 1 (FormulaHelper.cs:2042-2043)', () => {
  // CalculateCost floors the base value at 1 (FH:1892-1893) and THEN
  // divides by the region's adjustment, so a sub-1000 province drives an
  // already-1 cost to 0 and the SECOND floor is the only thing that
  // stops it. Deleting that line left the whole suite green, because no
  // fixture ever combined a base that floors at 1 with an adjustment
  // below the 1000 pivot.
  assert.equal(calculateCost(1, 10, 750), 2, 'trunc(1*750/1000) = 0 -> floors to 1 -> 2*(0+1)');
  assert.equal(calculateCost(1, 10, 999), 2, 'anywhere below the 1000 pivot');
  assert.equal(calculateCost(1, 12, 250), 2, 'PRICE_ADJUSTMENT_MIN, the worst case');
  // and the live wire that reaches it: CalculateItemRepairCost hands
  // CalculateCost a base of exactly 1 for any item worth <= 10 gold
  // (repairService.js:44-46), so without the floor a cheap repair in a
  // cheap province is FREE.
  assert.equal(calculateItemRepairCost(5, 10, 0, 100, { priceAdjustment: 750 }), 2);
});

test('AUDIT 58: CalculateTradePrice\'s SELLING branch, by value (FormulaHelper.cs:1994)', () => {
  //   amount = ((((179 * delta_mercantile) >> 8) + ((51 * delta_personality) >> 8)) * cost) >> 8;
  // The buy branch had a hand-derived anchor; the sell branch had only
  // `sell < buy` and two monotonicity checks, all of which survive a
  // coefficient change. 51 -> 77 moved every sale in the game by 11.6%
  // with the suite green.
  // quality 10 -> merchant level 50; skills 50/50 -> dm = dp = 144:
  // ((179*144)>>8 + (51*144)>>8) * 256 >> 8 = (100 + 28) = 128.
  assert.equal(calculateTradePrice(256, 10, { mercantile: 50, personality: 50 }, true), 128);
  // asymmetric skills separate the two coefficients: dm = 96, dp = 192,
  // ((179*96)>>8 + (51*192)>>8) = 67 + 38 = 105. Mercantile is weighted
  // more than three times Personality, which no inequality can say.
  assert.equal(calculateTradePrice(256, 10, { mercantile: 0, personality: 100 }, true), 105);
});

// ── 11: NormalizeReputations does NOT propagate ───────────────────────
test('AUDIT 58: the 112-day faction drift does NOT fan out (PlayerEntity.cs:2239/:2241)', () => {
  // NormalizeReputations calls `factionData.ChangeReputation(id, 1)` -
  // the TWO-argument overload, and PersistentFactionData.cs:390 declares
  // `bool ChangeReputation(int factionID, int amount, bool propagate = false)`.
  // So the faction half of the drift is a single clamped write, not a
  // walk. Adding `, true` at court.js:192-193 survived the whole suite,
  // because the only fixture on that arm was a ONE-record dict with no
  // hierarchy: a propagating walk over it has nowhere to go. This one is
  // a root with two children, which is exactly what a walk would move -
  // propagateReputationChange gives a `parent === 0` root the FULL
  // amount (factionRep.js:165-174).
  const rec = (id, o) => Object.assign({
    id, parent: 0, type: 0, name: 'f' + id, rep: 0, ally1: 0, ally2: 0, ally3: 0,
    enemy1: 0, enemy2: 0, enemy3: 0, sgroup: 0, ggroup: 0, children: null,
  }, o);
  const dict = new Map([
    [10, rec(10, { children: [100, 200] })],
    [100, rec(100, { parent: 10 })],
    [200, rec(200, { parent: 10 })],
  ]);
  const store = createFactionRep(dict);
  const player = { legalRep: {} };

  setReputation(store, 100, 20);
  normalizeReputations(player, store);
  assert.equal(store.dict.get(100).rep, 19, 'the drifting faction moves one point toward zero');
  assert.equal(store.dict.get(10).rep, 0, 'its ROOT does not move - the call passes no propagate flag');
  assert.equal(store.dict.get(200).rep, 0, 'and neither does its sibling');

  setReputation(store, 100, -20);
  normalizeReputations(player, store);
  assert.equal(store.dict.get(100).rep, -19, 'and the negative side drifts up');
  assert.equal(store.dict.get(10).rep, 0);
  assert.equal(store.dict.get(200).rep, 0);
});
