// AUDIT 58 (the unpinned-laws lane, second file). Every law below
// already SHIPS correctly - each was reproduced as a SURVIVING mutant:
// the port's value or operator was changed, the whole suite stayed
// green, and the change was reverted. So the defect is never the code,
// it is that nothing in the suite could tell if the code stopped being
// right.
//
// Every assertion here is written against DAGGERFALL UNITY'S OWN
// LITERAL, never against the port's constant - the exact tautology
// that made four of these arms vacuous in the first place
// (`SCALED_OCEAN_ELEVATION / MAX_TERRAIN_HEIGHT` as an expectation
// moves with the thing it claims to hold).
//
//   1. DefaultTerrainSampler.cs:25-31 - the four scale constants. Every
//      expectation in terrain/farring/overworldmap/distantland is
//      RECOMPUTED from them, so 3.4 -> 3.0 (the sea floor) and 1539 ->
//      1500 both survived the whole suite.
//   2. FormulaHelper.cs:52 + :1309/:1322 - specialInfectionChance 0.6,
//      only ever driven at 0.5 / 1.5 / 50, which agree for every value
//      in [0.5, 1.5); and IsImmuneToDisease's PENDING half, whose one
//      assertion runs on a player the test itself proves has no
//      pending marker.
//   3. MobilePersonMotor.cs:35-36 - tileDowngradeChance 0.20 and
//      randomChangeChance 0.025. Neither symbol appears anywhere under
//      test/; the one motor fixture feeds 0.9 to both.
//   4. FormulaHelper.cs:2317-2318 - the two magnitude averages are C#
//      INTEGER divisions. Every fixture used an even (low + high),
//      where truncation and round-half-up agree.
//   5. Five strict/non-strict comparisons whose equality point no
//      fixture ever reaches: Automap.cs:1121-1123, Dice100.cs:16
//      (SuccessRoll) and :21 (FailedRoll), VerticalScrollBar.cs:145-149,
//      PlayerEntity.cs:1367. Each is pinned here from BOTH sides.
//   6. ItemHelper.cs:593-598 - the 10000 -> 5 book alias, pinned on the
//      filename and the title and on NEITHER end of the price path.
//   7. FormulaHelper.cs:566 - `noWeaponAverage > weaponAverage` is
//      STRICT, and no fixture ever made the two averages equal.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, DEFAULT_TERRAIN_SCALE,
  BASE_HEIGHT_SCALE, SCALED_OCEAN_ELEVATION, SCALED_BEACH_ELEVATION,
} from '../src/world/terrainSampler.js';
import { SPECIAL_INFECTION_CHANCE, onMonsterHit, inflictDisease } from '../src/systems/diseases.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { INFECTION, startInfection, runInfections, setInfectionHost } from '../src/systems/infection.js';
import { CityNavigation } from '../src/world/cityNavigation.js';
import { MobilePerson, TILE_DOWNGRADE_CHANCE, RANDOM_CHANGE_CHANCE } from '../src/characters/mobilePerson.js';
import { effectCost } from '../src/systems/spellcost.js';
import {
  enterDungeonAutomap, resetAutomapStore, buildRevealIndex, automapRevealTick, HIT_DISTANCE_AGREEMENT,
} from '../src/systems/automap.js';
import { savingThrow, EFFECT_FLAGS } from '../src/systems/spellcast.js';
import { ClimbingState, climbingChance } from '../src/player/climbing.js';
import { scrollBarClick } from '../src/ui/verticalScrollBar.js';
import { raiseSkills, skillUsesForAdvancement, SKILL_RAISE_CHECK_INTERVAL } from '../src/systems/advancement.js';
import { SKILLS } from '../src/systems/skills.js';
import { createCharacter } from '../src/systems/chargen.js';
import { CLASSIC_GAME_START_TIME as T0 } from '../src/systems/gameDate.js';
import {
  clearBookPrices, setBookPrice, bookFilePrice, bookValue, createBook, getBookFileName, bookTitle,
} from '../src/systems/books.js';
import { chooseEnemyWeapon } from '../src/combat/formulas.js';
import { createWeapon, WEAPONS_ENUM } from '../src/combat/enemyEquipment.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

// ── 1. THE TERRAIN SAMPLER'S SCALE CONSTANTS ─────────────────────────

test('audit58 pins2: DefaultTerrainSampler\'s scale constants against DFU\'s literals', () => {
  // DefaultTerrainSampler.cs:25-31, typed out rather than derived. The
  // suite's four existing users of SCALED_OCEAN_ELEVATION all compute
  // their expectation FROM it (terrain.test.js:163, farring.test.js:28,
  // overworldmap.test.js:95, distantland.test.js:93), so the sea floor
  // could move to any value at all and every one of them stayed green.
  assert.equal(BASE_HEIGHT_SCALE, 8, 'baseHeightScale = 8f (:25)');
  assert.equal(MAX_TERRAIN_HEIGHT, 1539, 'maxTerrainHeight = 1539f (:31)');
  assert.equal(HEIGHTMAP_DIMENSION, 129, 'TerrainSampler.defaultHeightmapDimension = 129 (:96)');
  assert.equal(DEFAULT_TERRAIN_SCALE, 1.5, 'TerrainHelper.defaultTerrainScale = 1.5f (:42)');
  // `3.4f * baseHeightScale` and `5.0f * baseHeightScale` (:28-29).
  // Both products are EXACT in IEEE754 - multiplying by a power of two
  // only moves the exponent - so these are equalities, not epsilons.
  assert.equal(SCALED_OCEAN_ELEVATION, 27.2, 'scaledOceanElevation = 3.4 * 8 (:28)');
  assert.equal(SCALED_BEACH_ELEVATION, 40, 'scaledBeachElevation = 5.0 * 8 (:29)');
  // The sea floor is the value every ocean sample is CLAMPED to
  // (:115-116) and then normalized by maxTerrainHeight (:120), so it
  // is also the exact height every water pixel reports.
  assert.equal(SCALED_OCEAN_ELEVATION / MAX_TERRAIN_HEIGHT, 27.2 / 1539);
});

// ── 2. specialInfectionChance AND THE PENDING IMMUNITY TERM ──────────

const DISEASED = (level = 5) => ({
  isPlayer: true, level, career: {}, health: 40, maxHealth: 40, magicka: 30, fatigue: 6400,
  stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
});

test('audit58 pins2: specialInfectionChance is 0.6 AT the boundary, and it is inclusive', () => {
  // FormulaHelper.cs:52 `public static float specialInfectionChance =
  // 0.6f;` compared as `random = Random.Range(0f, 100f); if (random <=
  // specialInfectionChance && ...)` at :1309 (Werewolf), :1322
  // (Wereboar) and the Vampire arm. The suite drove 0.5%, 1.5% and 50%
  // only, and all three keep their branch for every chance in
  // [0.5, 1.5) - so 0.6 -> 0.5 and 0.6 -> 1.4 were equally invisible.
  assert.equal(SPECIAL_INFECTION_CHANCE, 0.6, 'FormulaHelper.cs:52');
  // 0.006 * 100 is exactly 0.6 in IEEE754, so this really is the
  // boundary and not a value near it.
  assert.equal(0.006 * 100, 0.6);
  const at = DISEASED();
  onMonsterHit({ careerIndex: MOBILE_TYPES.Werewolf }, at, 4, { rolls: seq(0.006), currentDay: 3 });
  assert.equal(at.activeEffects[0].infection, INFECTION.Werewolf, 'random == chance INFECTS - the compare is <=');
  const over = DISEASED();
  onMonsterHit({ careerIndex: MOBILE_TYPES.Wereboar }, over, 4, { rolls: seq(0.0061), currentDay: 3 });
  assert.deepEqual(over.activeEffects ?? [], [], '0.61% is over the chance - the roll is consumed and nothing takes');
  // The vampire arm carries the same constant AND the seam to the
  // `random <= 2.0` plague fallback below it, so the boundary decides
  // between stage-one vampirism and a common disease.
  const v = DISEASED();
  onMonsterHit({ careerIndex: MOBILE_TYPES.Vampire }, v, 4, { rolls: seq(0.006, 0.99, 0), currentDay: 3, regionIndex: 17 });
  assert.equal(v.activeEffects[0].infection, INFECTION.Vampirism, 'at the chance the vampire turns you');
});

test('audit58 pins2: IsImmuneToDisease reads the PENDING marker, not only the live override', () => {
  // diseases.js:232 `if (target.racialOverride || target.racialOverridePending)`.
  // The suite's one immunity assertion (lycanthropy.test.js) runs
  // AFTER the turn consumed the marker and asserts
  // `racialOverridePending === undefined` two lines above it, so the
  // right-hand disjunct had no test at all and deleting it was
  // invisible. This is the state the deploy leaves behind: the curse
  // is irreversible but worldTick's round has not minted it yet.
  setInfectionHost(null);
  const p = DISEASED();
  startInfection(p, INFECTION.Werewolf, { day: 0 });
  assert.equal(runInfections(p, 1).kind, 'dream');
  assert.equal(runInfections(p, 4).kind, 'deploy');
  assert.ok(p.racialOverridePending, 'the marker is pending');
  assert.equal(p.racialOverride, undefined, 'and the override is NOT live yet - only the right disjunct can answer');
  assert.equal(inflictDisease(p, [1], { rolls: () => 0.99 }), null, 'IsImmuneToDisease, on the pending half');
  // ...and the control, so the null above is the immunity and not a
  // gate somewhere else in InflictDisease refusing this fixture.
  assert.equal(inflictDisease(DISEASED(), [1], { rolls: () => 0.99 })?.kind, 'disease');
  setInfectionHost(null);
});

// ── 3. MobilePersonMotor's TWO BEHAVIOUR PROBABILITIES ───────────────

// A 1-block city built so the seek at nav cell (35,31) has exactly ONE
// strictly-best neighbour, which makes the downgrade branch's outcome
// deterministic rather than a coin flip between two equal bests:
//   current (35,31) road 15 | East (36,31) dirt 6 (the DOWNGRADE)
//   North   (35,32) grass 12 (the one best) | South (35,30) carved to 0
function motorTown() {
  const nav = new CityNavigation(1, 1);
  const autoMap = new Uint8Array(64 * 64);
  autoMap[(63 - 30) * 64 + 35] = 0x01;   // the automap carve zeroes (35,30)
  nav.setBlockData(0, 0, autoMap, (tx, ty) => {
    if (tx === 9 && ty === 8) return 1;    // dirt -> weight 6
    if (tx === 8 && ty === 7) return 2;    // grass -> weight 12
    if (tx === 8) return 46;               // the road column -> weight 15
    return 2;
  });
  return nav;
}

// The constructor's own `Math.floor(rand() * 4)` eats the first value,
// so 0.5 sets the initial facing to East (2) before the seek runs.
function seekOnce(...rands) {
  const nav = motorTown();
  const person = new MobilePerson(nav, {
    archive: 385, frameCount: () => 4, groundY: () => 0, rand: seq(0.5, ...rands),
  });
  person.place(35, 31);
  person.update(1 / 60, [0, 0, 0]);
  return { dir: person.dir, tx: person.tx, ty: person.ty };
}

test('audit58 pins2: MobilePersonMotor\'s two probabilities, driven across both thresholds', () => {
  // MobilePersonMotor.cs:35-36, as literals. Neither symbol nor either
  // number appeared anywhere under test/ before this file.
  assert.equal(TILE_DOWNGRADE_CHANCE, 0.20, 'tileDowngradeChance = 0.20f (:35)');
  assert.equal(RANDOM_CHANGE_CHANCE, 0.025, 'randomChangeChance = 0.025f (:36)');

  // The downgrade-leave (:340 `targetWeight < currentWeight &&
  // Random.Range(0f, 1f) > tileDowngradeChance`). 0.19 does NOT clear
  // 0.20, so the walker marches on into the dirt; 0.21 does, so the
  // best-neighbour scan runs and pulls it north onto the grass.
  assert.deepEqual(seekOnce(0.9, 0.19), { dir: 2, tx: 36, ty: 31 }, '0.19 keeps the downgrade course');
  assert.deepEqual(seekOnce(0.9, 0.21), { dir: 0, tx: 35, ty: 32 }, '0.21 runs the best-neighbour scan');

  // The shuffle (:322 `Random.Range(0f, 1f) < randomChangeChance` ->
  // targetWeight = 0 -> the random-direction arm at :325-334). 0.02 is
  // under 0.025 and 0.03 is over it; the second value below is the
  // direction draw in the shuffled case and the downgrade roll in the
  // unshuffled one, and both land on a different tile.
  assert.deepEqual(seekOnce(0.02, 0.0), { dir: 0, tx: 35, ty: 32 }, '0.02 shuffles - the random direction wins');
  assert.deepEqual(seekOnce(0.03, 0.19), { dir: 2, tx: 36, ty: 31 }, '0.03 does not shuffle');
});

// ── 4. CalculateEffectCosts' TWO MAGNITUDE AVERAGES ──────────────────

test('audit58 pins2: CalculateEffectCosts TRUNCATES both magnitude averages', () => {
  // FormulaHelper.cs:2317-2318 are C# int divisions:
  //   int magnitudeBase = (MagnitudeBaseMax + MagnitudeBaseMin) / 2;
  //   int magnitudePlus = (MagnitudePlusMax + MagnitudePlusMin) / 2;
  // Every magnitude fixture in the suite used an even (low + high),
  // where truncation and round-half-up agree, so the rounding of BOTH
  // averages was free to move. An ODD-width range separates them:
  // DamageHealth (4,0) prices magnitude at costs(20, 28).
  const odd = {
    type: 4, subType: 0,
    magnitudeBaseLow: 5, magnitudeBaseHigh: 16,     // (5+16)/2 = 10, NOT 11
    magnitudeLevelBase: 1, magnitudeLevelHigh: 4,   // (1+4)/2  = 2,  NOT 3
    magnitudePerLevel: 1,
  };
  assert.equal(effectCost(odd, () => 50).gold, 20 * 10 + 28 * 2, '256 - round-half-up would say 276 / 284 / 304');
  // and the spell-point conversion off that gold (:2339, `* (110 -
  // skillValue) / 400`, also an int division)
  assert.equal(effectCost(odd, () => 50).sp, Math.trunc(256 * (110 - 50) / 400));
});

// ── 5. FIVE STRICT/NON-STRICT BOUNDARIES, EACH FROM BOTH SIDES ───────

test('audit58 pins2: the three-ray agreement excludes its own boundary (Automap.cs:1121-1123)', () => {
  // `Math.Abs(a.distance - b.distance) < 0.01f` - a disagreement of
  // EXACTLY 0.01 fails the test and reveals nothing. The suite drove
  // 0.02 and 0.009 and never 0.01 itself, so `< 0.01` and `<= 0.01`
  // were indistinguishable. The stub answers 0 at the main ray's
  // origin and `skew` at both protection origins, so the pairwise
  // difference IS `skew` exactly - no float slop between the fixture
  // and the law it drives.
  resetAutomapStore();
  try {
    const model = buildRevealIndex([{ key: 'hall', aabb: [-100, -100, -100, 100, 100, 100] }]);
    const collider = (skew) => ({
      raycastHit(o) {
        const atMainOrigin = o[0] === 0 && o[1] === 0 && o[2] === 0;
        return { dist: atMainOrigin ? 0 : skew, key: 'hall', normal: null };
      },
    });
    assert.equal(HIT_DISTANCE_AGREEMENT - 0, HIT_DISTANCE_AGREEMENT, 'the fixture\'s difference is the constant itself');
    const at = enterDungeonAutomap('audit58/at', 0);
    automapRevealTick(at, { eye: [0, 0, 0], fwd: [0, 0, 1], collider: collider(0.01), model });
    assert.equal(at.revealed.size, 0, 'a disagreement of exactly 0.01 reveals NOTHING (the compare is strict)');
    const under = enterDungeonAutomap('audit58/under', 0);
    automapRevealTick(under, { eye: [0, 0, 0], fwd: [0, 0, 1], collider: collider(0.009), model });
    assert.equal(under.revealed.has('hall'), true, '0.009 agrees and reveals');
  } finally { resetAutomapStore(); }
});

test('audit58 pins2: Dice100.SuccessRoll and FailedRoll at roll == chance', () => {
  // Dice100.cs:16 `Random.Range(0, 100) < chanceSuccess` - a roll
  // EQUAL to the chance is a FAILURE. Elemental resistance goes
  // through it at FormulaHelper.cs:1451, and the suite only ever fed
  // 0.99 against a chance of 100, where < and <= agree.
  const resistant = () => ({
    stats: { willpower: 50, luck: 50 }, skills: [], career: {},
    activeEffects: [{ kind: 'elementalResistance', element: 0, chance: 30 }],
  });
  assert.equal(Math.floor(0.30 * 100), 30, 'the drive really lands ON 30');
  assert.equal(savingThrow(0, EFFECT_FLAGS.Fire, resistant(), 0, seq(0.30, 0.99)), 100,
    'roll 30 vs chance 30 does NOT resist - SuccessRoll is strict');
  assert.equal(savingThrow(0, EFFECT_FLAGS.Fire, resistant(), 0, seq(0.295, 0.99)), 0,
    'roll 29 vs chance 30 resists the effect WHOLE');

  // Dice100.cs:21 `Random.Range(0, 100) >= chanceSuccess` - the mirror:
  // a roll EQUAL to the chance is a FAILED climb. ClimbingMotor.cs:835.
  // The chance is DFU's own: trunc(lerp(30, 100, 40 * .01) +
  // lerp(0, 10, 50 * .01)) = trunc(58 + 5) = 63 (FormulaHelper.cs:299-315).
  const chance = 63;
  assert.equal(climbingChance(30, 40, 50, {}), chance, 'CalculateClimbingChance, hand-derived');
  const climber = (roll) => new ClimbingState({
    tally: () => {}, inputs: () => ({ climbing: 40, luck: 50 }), rolls: () => roll, waterForgiven: () => false,
  });
  assert.equal(climber(chance / 100).skillCheck(30), false, 'roll 63 vs chance 63 FAILS - FailedRoll is non-strict');
  assert.equal(climber((chance - 1) / 100).skillCheck(30), true, 'roll 62 holds the wall');
});

test('audit58 pins2: a scroll-bar click exactly on thumbRect.yMax is inside the thumb', () => {
  // VerticalScrollBar.cs:145-149 - `else if (clickPosition.y >
  // thumbRect.yMax) ScrollIndex += displayUnits;`. The suite clicked
  // one pixel either side of the thumb and never on its edge.
  const span = { y: 10, h: 20 };                       // yMin 10, yMax 30
  assert.equal(scrollBarClick(30, span, 10, 30, 9), 10, 'exactly yMax does NOT page down');
  assert.equal(scrollBarClick(31, span, 10, 30, 9), 19, 'one past yMax pages down by displayUnits');
  // and the yMin arm is strict the other way (`clickPosition.y <
  // thumbRect.yMin`), so its own edge holds too
  assert.equal(scrollBarClick(10, span, 10, 30, 9), 10, 'exactly yMin does NOT page up');
  assert.equal(scrollBarClick(9, span, 10, 30, 9), 1, 'one above yMin pages up');
});

test('audit58 pins2: the skill-raise gate is <= 360, so 360 exactly is still too soon', () => {
  // PlayerEntity.cs:1367 `if ((now.ToClassicDaggerfallTime() -
  // timeOfLastSkillIncreaseCheck) <= 360) return;`. The suite probed
  // T0+100 and T0+361 and never T0+360, which is the only delta that
  // separates `<= 360` from `< 360`.
  assert.equal(SKILL_RAISE_CHECK_INTERVAL, 360, 'the literal 360 (:1367)');
  const career = {
    name: 'W', hitPointsPerLevel: 12, advancementMultiplier: 1.0,
    strength: 60, intelligence: 40, willpower: 45, agility: 55,
    endurance: 60, personality: 40, speed: 50, luck: 50,
    primarySkills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.CriticalStrike],
    majorSkills: [SKILLS.BluntWeapon, SKILLS.Dodging, SKILLS.Jumping],
    minorSkills: [SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Medical],
  };
  const p = { isPlayer: true, reflexes: 2, items: [] };
  createCharacter(p, career, 16, { rolls: seq(0) });
  const lb = SKILLS.LongBlade;
  p.skillUses[lb] = skillUsesForAdvancement(p.skills[lb], 2, 1.0, 1);
  assert.deepEqual(raiseSkills(p, T0 + 360), [], 'a delta of exactly 360 returns before the loop');
  assert.equal(p.lastSkillCheckTime, T0, 'and the anchor did not move, so the next check measures from T0');
  assert.deepEqual(raiseSkills(p, T0 + 361), [lb], '361 clears the gate');
});

// ── 6. THE BOOKS 10000 -> 5 ALIAS, ON ALL FOUR READERS ───────────────

test('audit58 pins2: the 10000 -> 5 book alias reaches the PRICE, not only the filename', () => {
  // ItemHelper.cs:593-598 maps id 10000 back to 5 ("Ark'ay The God")
  // for legacy saves, and ItemBuilder.CreateBook (:237-251) prices the
  // book from the file that alias opened - `value = bookFile.Price`.
  // The suite pinned the alias on getBookFileName and bookTitle and on
  // NEITHER end of the price path, so dropping it from bookFilePrice
  // answered null, and every legacy copy of the book minted at the
  // Books template's 2500 instead of its 300..800 file roll.
  clearBookPrices();
  try {
    setBookPrice(5, 437);
    assert.equal(getBookFileName(10000), 'BOK00005.TXT', 'the filename reader (already pinned)');
    assert.equal(bookTitle(10000), bookTitle(5), 'the title reader (already pinned)');
    assert.equal(bookFilePrice(10000), 437, 'the READ side of the price path');
    assert.equal(bookValue(10000), 437, '...so the minted value is the FILE price, not the 2500 template');
    assert.equal(createBook(10000).value, bookValue(5), 'and CreateBook carries it through');
    assert.equal(createBook(10000).message, 10000, 'the ITEM keeps its own id - the alias is the file\'s');
    clearBookPrices();
    // the WRITE side: a host warming the registry under the legacy id
    // must land on key 5, or the read side would never find it
    setBookPrice(10000, 612);
    assert.equal(bookFilePrice(5), 612, 'the WRITE side of the price path');
  } finally { clearBookPrices(); }
});

// ── 7. chooseEnemyWeapon's TIE-BREAK ─────────────────────────────────

test('audit58 pins2: an EQUAL average keeps the weapon (FormulaHelper.cs:566 is strict)', () => {
  // `if (noWeaponAverage > weaponAverage) weapon = null;` - strict, so
  // a tie keeps the weapon and everything that rides on it (the weapon
  // skill, the material modifier, the equipment damage, the weapon
  // sounds). The suite's fixtures straddled the tie without landing on
  // it, and the tie is LIVE: EnemyBasics.cs gives the Orc Sergeant
  // (ID 12) MinDamage 5 / MaxDamage 15 -> avg 10, and its variant-1
  // roll hands it a Claymore, 2-18 -> avg 10.
  const claymore = createWeapon(WEAPONS_ENUM.Claymore, 0);
  const orcSergeant = { minDamage: 5, maxDamage: 15 };
  assert.equal(chooseEnemyWeapon(claymore, orcSergeant), claymore, 'a TIE keeps the weapon');
  // one point of hand-to-hand more and the strict compare flips
  assert.equal(chooseEnemyWeapon(claymore, { minDamage: 5, maxDamage: 17 }), null, 'avg 11 > 10 drops to hand-to-hand');
  assert.equal(chooseEnemyWeapon(claymore, { minDamage: 5, maxDamage: 13 }), claymore, 'avg 9 < 10 keeps it');
});
