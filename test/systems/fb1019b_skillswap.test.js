// SKILL-SWAP (2026-10-19, Discord #suggestions "With the addition of arcane and martial specialisations...", Brother
// Frank, through Mac; asked, Mac: "Paid skill swap"): "I'd very much like it if the team considered adding the ability
// (if it is possible) to either change one of our skills out or allow some of these specializations to work with just the
// one weapon skill" - his class held one weapon skill (Blunt Weapon, mastered at 117), so no martial path could ever
// open. One unmastered class skill is given up for one outside the class, in its group, for SKILL_SWAP_GOLD; the level,
// the values and the masteries stand.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { SKILLS, levelUpSkillSum } from '../../src/systems/skills.js';
import { masterSkill, careerGroupOf } from '../../src/systems/masterSkills.js';
import { martialPossible } from '../../src/systems/martialPaths.js';
import { calculatePlayerLevel } from '../../src/systems/advancement.js';
import { SKILL_SWAP_GOLD, swapOutChoices, swapInChoices, skillSwapRefusal, swapSkill } from '../../src/systems/skillSwap.js';
import { SPEC_RESET_GOLD } from '../../src/systems/arcanePaths.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { specGuideModel, familyLine } from '../../src/ui/growth/specGuide.js';

const { BluntWeapon: BL, LongBlade: LB, Etiquette: ET, Streetwise: ST, Mercantile: ME, Dodging: DO, Lockpicking: LP, Climbing: CL, Medical: MD, Running: RU, Jumping: JU, Swimming: SW, Stealth: SE } = SKILLS;

/** Brother Frank's shape: one weapon skill in the class (Blunt Weapon, major, mastered), the rest of it no weapon. */
function frank({ gold = SKILL_SWAP_GOLD } = {}) {
  const primary = [ET, ST, ME], major = [BL, DO, LP], minor = [CL, MD, RU, JU, SW, SE];
  const p = structuredClone(playerEntity);
  createCharacter(p, { name: 'Monk', hp: 12, primarySkills: primary, majorSkills: major, minorSkills: minor,
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 } }, -1, { rolls: () => 0.5 });
  p.career = { ...p.career, primarySkills: primary, majorSkills: major, minorSkills: minor };
  p._online = true; p.level = 30;
  p.skills = p.skills.map(() => 40);
  p.skills[BL] = 100; assert.equal(masterSkill(p, BL).ok, true);
  p.skills[BL] = 117;
  p.skills[LB] = 6;
  p.startingLevelUpSkillSum = 88; p.currentLevelUpSkillSum = levelUpSkillSum(p);
  p.goldPieces = gold; p.items = [];
  return p;
}

test('SKILL-SWAP the thread\'s case: a class with one weapon skill meets no martial path; Long Blade taken in place of a minor skill opens one - in the minor group, its value kept, the mastery slots as they were (mutants: the group moved, the list not replaced)', () => {
  const p = frank();
  assert.equal(martialPossible(p), false);
  assert.match(familyLine(specGuideModel(p).families.find((f) => f.id === 'martial')), /can't master two weapon skills/);
  const shared = p.career;
  const r = swapSkill(p, SE, LB);
  assert.deepEqual(r, { ok: true, text: 'Long Blade is now one of your minor skills, in place of Stealth.' });
  assert.equal(careerGroupOf(p, LB), 'minor'); assert.equal(careerGroupOf(p, SE), null);
  assert.deepEqual(p.career.minorSkills, [CL, MD, RU, JU, SW, LB], 'in Stealth\'s own place');
  assert.equal(p.skills[LB], 6, 'its value kept'); assert.equal(p.skills[SE], 40);
  assert.equal(martialPossible(p), true, 'Blunt mastered and Long Blade masterable: the paths of the pair open');
  assert.notEqual(p.career, shared, 'the character\'s own copy of the career');
  assert.ok(shared.minorSkills.includes(SE), 'the career it came from untouched');
});

test('SKILL-SWAP the price: exactly SKILL_SWAP_GOLD, half a specialisation\'s reset, paid from the purse; short of it, refused with the price and what is held (mutants: the price unpaid, the gold unchecked)', () => {
  assert.equal(SKILL_SWAP_GOLD, 100_000); assert.equal(SKILL_SWAP_GOLD * 2, SPEC_RESET_GOLD);
  const p = frank({ gold: SKILL_SWAP_GOLD + 7 });
  assert.equal(swapSkill(p, SE, LB).ok, true);
  assert.equal(p.goldPieces, 7);
  const poor = frank({ gold: SKILL_SWAP_GOLD - 1 });
  assert.equal(skillSwapRefusal(poor, SE, LB), 'Changing a class skill costs 100,000 gold. You have 99,999.');
  assert.equal(swapSkill(poor, SE, LB).ok, false);
  assert.ok(poor.career.minorSkills.includes(SE));
});

test('SKILL-SWAP the level does not move: a trained skill brought into the class pays no levels - both sums moved by its rise; an untrained one owes none - both sums stand, the class\'s sum under them by the ground its skills make up (SWAP-CYCLE, test/systems/swapcycle.test.js; mutants: either sum left)', () => {
  for (const [inn, value] of [[LB, 95], [LB, 1]]) {
    const p = frank();
    p.skills[inn] = value;
    const level = calculatePlayerLevel(p.startingLevelUpSkillSum, p.currentLevelUpSkillSum);
    const span = p.currentLevelUpSkillSum - p.startingLevelUpSkillSum, held = p.currentLevelUpSkillSum;
    swapSkill(p, ET, inn);   // a primary - the sum's every point
    if (value === 95) assert.equal(p.currentLevelUpSkillSum, levelUpSkillSum(p), 'a rise: the stored sum is the new class\'s');
    else assert.deepEqual([p.currentLevelUpSkillSum, held - levelUpSkillSum(p)], [held, 40 - 1], 'a drop: the stored sum stands, Etiquette\'s 40 less Long Blade\'s 1 to make up');
    assert.equal(p.currentLevelUpSkillSum - p.startingLevelUpSkillSum, span, `value ${value}: the progress stands`);
    assert.equal(calculatePlayerLevel(p.startingLevelUpSkillSum, p.currentLevelUpSkillSum), level);
  }
});

test('SKILL-SWAP the refusals: a mastered skill stays, a skill outside the class cannot be given up, one inside cannot be taken; the choices say the same (mutants: a mastered skill given up, a class skill taken in)', () => {
  const p = frank();
  assert.equal(skillSwapRefusal(p, BL, LB), 'A mastered skill stays in your class.');
  assert.equal(skillSwapRefusal(p, LB, SE), 'Choose one of your class skills to give up.');
  assert.equal(skillSwapRefusal(p, SE, DO), 'Choose a skill outside your class to take its place.');
  assert.ok(!swapOutChoices(p).includes(BL)); assert.ok(swapOutChoices(p).includes(SE));
  assert.ok(swapInChoices(p).includes(LB)); assert.ok(!swapInChoices(p).includes(DO));
  assert.equal(swapInChoices(p).length, 35 - 12);
});

test('SKILL-SWAP the save keeps the new class, and the Growth page offers the swap with its price (mutants: the model\'s swap dropped)', () => {
  const p = frank();
  swapSkill(p, SE, LB);
  const back = structuredClone(playerEntity);
  restorePlayer(back, JSON.parse(JSON.stringify(snapshotPlayer(p))));
  assert.deepEqual(back.career.minorSkills, p.career.minorSkills);
  assert.equal(back.startingLevelUpSkillSum, p.startingLevelUpSkillSum);
  const m = specGuideModel(frank());
  assert.ok(m.swap.out.includes(SE) && m.swap.in.includes(LB));
  assert.equal(m.swap.group(SE), 'minor');
  assert.equal(m.swap.refusal(SE, LB), null);
});
