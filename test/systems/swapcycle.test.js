// SWAP-CYCLE (2026-10-20, Mac: "REPEC BREAKING LEVEL LIMIT ... How far it goes: about level 224 / this is the problem
// lol"; bible/01-Overview/bugs/Field-Bugs-2026-10-20g.md): SKILL-SWAP moved both stored level sums by whatever a swap
// moved the class's sum, a drop as well as a rise - so a trained class skill given up for an untrained one kept its
// training on the level, and its place earned the same levels again. One class cycled through every skill reached level
// 223 where its own lists top out at 31. The stored current sum is now the sum the level stands on: no swap and no raise
// lowers it, a swap moves both sums only by what it takes the class's sum above it, and the ground a swap gives up is the
// class's skills' to make up before the level moves again. Every pin here drives the real producers - chargen,
// skillSwap.js swapSkill, advancement.js raiseSkills' pass.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { buildCustomCareer } from '../../src/systems/customClass.js';
import { SKILLS, levelUpSkillSum } from '../../src/systems/skills.js';
import { raiseSkills, calculatePlayerLevel, SKILL_RAISE_CHECK_INTERVAL } from '../../src/systems/advancement.js';
import { SKILL_SWAP_GOLD, swapSkill, swapInChoices, swapShortfall } from '../../src/systems/skillSwap.js';
import { specGuideModel } from '../../src/ui/growth/specGuide.js';
import { LEVELING_VIRTUE } from '../../src/systems/oblivionLeveling.js';

const S = SKILLS;
const PRIMARY = [S.LongBlade, S.Dodging, S.CriticalStrike];
const MAJOR = [S.Archery, S.Stealth, S.Running];
const MINOR = [S.Climbing, S.Jumping, S.Swimming, S.Medical, S.Etiquette, S.Streetwise];

/** A character as chargen makes it - its class the custom class maker's (customClass.js buildCustomCareer) - online
 *  (Master Skills on: no 95 lock), its sums anchored at creation. */
function made() {
  const p = structuredClone(playerEntity);
  const stats = { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
  createCharacter(p, buildCustomCareer({ name: 'Cycler', hp: 12, skills: [...PRIMARY, ...MAJOR, ...MINOR], stats }), -1, { rolls: () => 0.5 });
  p._online = true; p.items = [];
  p.clock = p.lastSkillCheckTime ?? 0;
  return p;
}
/** Skill `id` raised to `to` by the real pass: its uses at the tally's clamp, the 360-minute gate passed, one point a
 *  pass - every level the sum earns taken on the way (the headless level-up). */
function train(p, id, to) {
  while (p.skills[id] < to) {
    p.skillUses[id] = 20000;
    p.clock += SKILL_RAISE_CHECK_INTERVAL + 1;
    assert.ok(raiseSkills(p, p.clock, () => 0.5).includes(id), `skill ${id} raised from ${p.skills[id]}`);
  }
}
const swap = (p, out, inn) => { p.goldPieces = SKILL_SWAP_GOLD; const r = swapSkill(p, out, inn); assert.equal(r.ok, true, r.text); };
const sums = (p) => ({ starting: p.startingLevelUpSkillSum, current: p.currentLevelUpSkillSum, level: p.level });

test('SWAP-CYCLE THE REPORT: every skill outside the class cycled through a primary place and trained to 100 takes the level no further than the class\'s own lists hold - 31, not 223 (mutants: a drop moving the starting sum; a raise lowering the stored sum)', () => {
  const p = made();
  const start = p.startingLevelUpSkillSum;
  const ceiling = calculatePlayerLevel(start, 600);   // six counted skills at 100: the most the class's sum can be
  assert.equal(ceiling, 31);
  for (const id of [...PRIMARY, ...MAJOR, ...MINOR]) train(p, id, 100);
  assert.equal(p.level, ceiling, 'every class skill at 100: the ceiling, by training alone');
  let swaps = 0;
  for (let fresh = swapInChoices(p).filter((id) => p.skills[id] < 100); fresh.length; fresh = swapInChoices(p).filter((id) => p.skills[id] < 100)) {
    const inn = fresh[0];
    swap(p, p.career.primarySkills[0], inn);
    swaps++;
    train(p, inn, 100);
  }
  assert.equal(swaps, 35 - 12, 'every skill outside the class has had its turn');
  assert.equal(p.level, ceiling, 'the cycle earned no level');
  assert.equal(calculatePlayerLevel(p.startingLevelUpSkillSum, p.currentLevelUpSkillSum), ceiling);
  assert.equal(p.startingLevelUpSkillSum, start, 'nothing brought in above the sum the level stood on');
  assert.equal(p.currentLevelUpSkillSum, 600);
});

test('SWAP-CYCLE THE GROUND: a trained class skill given up for an untrained one leaves both sums and the level where they stand, and the new skill makes the ground up before the level moves again (mutants: a drop moving the starting sum; a raise lowering the stored sum)', () => {
  const p = made();
  const [ls, dodge] = PRIMARY;
  train(p, ls, 100);
  const before = sums(p);
  const inn = S.Mercantile, from = p.skills[inn];
  assert.equal(swapShortfall(p, ls, inn), 100 - from, 'the ground, said before the swap');
  swap(p, ls, inn);
  assert.deepEqual(sums(p), before, 'the level and its progress stand');
  assert.equal(levelUpSkillSum(p), before.current - (100 - from), 'the class\'s sum under the one the level stands on');
  train(p, inn, 100);
  assert.deepEqual(sums(p), before, 'the ground made up: nothing earned');
  train(p, dodge, p.skills[dodge] + 1);
  assert.equal(p.currentLevelUpSkillSum, before.current + 1, 'past it, a point is the level\'s again');
});

test('SWAP-CYCLE UNDONE: a trained skill given up and taken back - a point trained between - leaves both sums exactly as they were (mutant: a raise lowering the stored sum)', () => {
  const p = made();
  const [ls] = PRIMARY;
  train(p, ls, 100);
  const before = sums(p);
  const inn = S.Mercantile;
  swap(p, ls, inn);
  train(p, inn, p.skills[inn] + 1);
  assert.equal(p.currentLevelUpSkillSum, before.current, 'the point made up ground');
  swap(p, inn, ls);
  assert.deepEqual(sums(p), before, 'no ground lost for good, none gained');
});

test('SWAP-CYCLE A TRAINED SKILL BROUGHT IN: it wins back the ground an earlier swap gave up first, and only what takes the class\'s sum above the one the level stands on moves the sums - so it pays no level (mutants: the rise read from the class\'s sum, not the one the level stands on; the form\'s number blind to the earlier ground)', () => {
  const p = made();
  const [ls, dodge] = PRIMARY;
  train(p, ls, 100);
  const before = sums(p);
  swap(p, ls, S.Mercantile);   // ground: 100 less Mercantile's value
  train(p, S.Lockpicking, 60);   // trained outside the class: the class's sum does not move
  assert.deepEqual(sums(p), before);
  assert.equal(swapShortfall(p, S.Mercantile, S.Lockpicking), 100 - 60, 'the form\'s number: the ground the earlier swap left, less what Lockpicking wins back');
  swap(p, S.Mercantile, S.Lockpicking);   // within the ground
  assert.deepEqual(sums(p), before, 'the ground partly won back: nothing moved');
  assert.equal(swapShortfall(p, S.Lockpicking, ls), 0, 'Long Blade back: no ground left');
  swap(p, S.Lockpicking, ls);
  assert.deepEqual(sums(p), before, 'the ground won back whole: nothing moved');
  train(p, S.Mysticism, 100);
  const rise = 100 - p.skills[dodge];
  swap(p, dodge, S.Mysticism);   // above the sum the level stands on
  assert.deepEqual(sums(p), { starting: before.starting + rise, current: before.current + rise, level: before.level }, 'the rise moves both sums: no level paid');
});

test('SWAP-CYCLE CAUGHT UP: points the class\'s skills hold that no raise stored yet (intensive training\'s SetPermanentSkillValue) are the level\'s, not absorbed by the swap (mutant: the swap reading the stored sum alone)', () => {
  const p = made();
  const [, dodge] = PRIMARY;
  train(p, PRIMARY[0], 100);
  const before = sums(p);
  p.skills[dodge] += 4;   // worldModes.js applyIntensive's write: the sum stored at the next raise
  const lowMinor = MINOR.find((id) => levelUpSkillSum({ ...p, career: { ...p.career, minorSkills: p.career.minorSkills.filter((m) => m !== id).concat(S.Mercantile) } }) === levelUpSkillSum(p));
  swap(p, lowMinor, S.Mercantile);   // a minor that is not the highest: the class's sum unmoved
  assert.deepEqual(sums(p), { starting: before.starting, current: before.current + 4, level: before.level });
});

test('SWAP-CYCLE THE FORM\'S NUMBER: the model\'s shortfall is the ground a swap would leave, none where it leaves none, and none on Oblivion\'s bar (the sum levels nothing there) (mutant: the bar\'s lane unread)', () => {
  const p = made();
  const [ls] = PRIMARY;
  train(p, ls, 100);
  const sw = specGuideModel(p).swap;
  assert.equal(sw.shortfall(ls, S.Mercantile), 100 - p.skills[S.Mercantile]);
  train(p, S.Mysticism, 100);
  assert.equal(sw.shortfall(ls, S.Mysticism), 0, 'an equal skill in: no ground');
  p.levelingSystem = LEVELING_VIRTUE;
  assert.equal(specGuideModel(p).swap.shortfall(ls, S.Mercantile), 0);
});
