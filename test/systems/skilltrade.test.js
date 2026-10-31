// SKILL-TRADE (2026-10-30, Discord #feature-feedback "Pls allow us to swap class skills from other catagories (Primary,
// Major, Minor)", Spat, through Mac; price asked, Mac: "100,000"): "Its a lil annoying that I need to swap a misc skill
// in and then shuffle the 2 skills around." Two unmastered class skills of different groups change places for one
// SKILL_SWAP_GOLD; the values, the masteries and the level stand (SWAP-CYCLE's law, test/systems/swapcycle.test.js).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { SKILLS, levelUpSkillSum } from '../../src/systems/skills.js';
import { masterSkill, masterySlots, isMasteredSkill } from '../../src/systems/masterSkills.js';
import { calculatePlayerLevel, checkForLevelUp } from '../../src/systems/advancement.js';
import { onlineLevelFor, LEVEL_SUM_TOP } from '../../src/systems/levelClimb.js';
import { SKILL_SWAP_GOLD, swapTradeChoices, skillSwapRefusal, swapSkill, startAfterRise } from '../../src/systems/skillSwap.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';

const { Destruction: DE, Alteration: AL, Illusion: IL, Restoration: RE, Mysticism: MY, Thaumaturgy: TH, Climbing: CL, Medical: MD, Running: RU, Jumping: JU, Swimming: SW, Stealth: SE, LongBlade: LB } = SKILLS;

/** Spat's shape: a mage whose Destruction is primary and Restoration major, every skill at 40. */
function spat({ gold = SKILL_SWAP_GOLD, mastered = [] } = {}) {
  const primary = [DE, AL, IL], major = [RE, MY, TH], minor = [CL, MD, RU, JU, SW, SE];
  const p = structuredClone(playerEntity);
  createCharacter(p, { name: 'Mage', hp: 8, primarySkills: primary, majorSkills: major, minorSkills: minor,
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 } }, -1, { rolls: () => 0.5 });
  p.career = { ...p.career, primarySkills: primary, majorSkills: major, minorSkills: minor };
  p._online = true; p.level = 20;
  p.skills = p.skills.map(() => 40);
  for (const s of mastered) { p.skills[s] = 100; assert.equal(masterSkill(p, s).ok, true); }
  p.startingLevelUpSkillSum = 88; p.currentLevelUpSkillSum = levelUpSkillSum(p);
  p.goldPieces = gold; p.items = [];
  return p;
}

test('SKILL-TRADE the thread\'s case: Destruction (primary) and Restoration (major) change places, each in the other\'s own place, for one SKILL_SWAP_GOLD - the values and the slots as they were (mutants: the other group not given `out`; the trade dearer)', () => {
  const p = spat({ gold: SKILL_SWAP_GOLD + 3 });
  const shared = p.career;
  const r = swapSkill(p, DE, RE);
  assert.deepEqual(r, { ok: true, text: 'Restoration is now one of your primary skills, and Destruction one of your major skills.' });
  assert.deepEqual([p.career.primarySkills, p.career.majorSkills, p.career.minorSkills], [[RE, AL, IL], [DE, MY, TH], [CL, MD, RU, JU, SW, SE]]);
  assert.equal(p.career.swapped, true, 'the heir keeps it (legacy/family.js careerFields)');
  assert.deepEqual([p.skills[DE], p.skills[RE]], [40, 40]);
  assert.equal(p.goldPieces, 3);
  assert.deepEqual(shared.primarySkills, [DE, AL, IL], 'the career it came from untouched');
  assert.deepEqual([masterySlots(p, 'primary').used, masterySlots(p, 'major').used], [0, 0]);
});

test('SKILL-TRADE the choices: another group\'s unmastered class skills, never `out`\'s own group, never a mastered one, none for a skill outside the class; the refusals say why (mutants: the same group offered; a mastered skill moved)', () => {
  const p = spat({ mastered: [MY] });
  assert.deepEqual(swapTradeChoices(p, DE), [RE, TH, CL, MD, RU, JU, SW, SE]);
  assert.deepEqual(swapTradeChoices(p, SE), [DE, AL, IL, RE, TH]);
  assert.deepEqual(swapTradeChoices(p, LB), [], 'a miscellaneous skill has no group to trade from');
  assert.equal(skillSwapRefusal(p, DE, AL), 'Choose a skill outside your class, or one from another group, to take its place.');
  assert.equal(skillSwapRefusal(p, DE, MY), 'A mastered skill stays in its group.');
  assert.equal(skillSwapRefusal(p, MY, DE), 'A mastered skill stays in your class.');
  assert.equal(skillSwapRefusal(p, DE, RE), null);
  assert.equal(swapSkill(p, DE, MY).ok, false);
  assert.ok(isMasteredSkill(p, MY) && p.career.majorSkills.includes(MY), 'nothing moved');
});

test('SKILL-TRADE the level stands: a trained minor skill traded into the primaries moves the sums by its rise - offline both, online the start so the climb\'s share stands (AUDIT SKILL-TRADE A2: online a start moved as much paid levels) - and a trade that lowers the sum moves neither (SWAP-CYCLE; mutants: either sum left; the online start moved as offline\'s)', () => {
  for (const online of [false, true]) {
    const rise = spat();
    rise._online = online;
    rise.skills[CL] = 90; rise.skills[MD] = 90;   // the highest minor stays 90 when Climbing leaves
    rise.currentLevelUpSkillSum = levelUpSkillSum(rise);
    const lane = online ? onlineLevelFor : calculatePlayerLevel;
    const level = lane(rise.startingLevelUpSkillSum, rise.currentLevelUpSkillSum), span = rise.currentLevelUpSkillSum - rise.startingLevelUpSkillSum;
    rise.level = level;
    swapSkill(rise, DE, CL);
    assert.equal(rise.currentLevelUpSkillSum, levelUpSkillSum(rise), 'the stored sum the new class\'s');
    if (!online) assert.equal(rise.currentLevelUpSkillSum - rise.startingLevelUpSkillSum, span);
    assert.equal(lane(rise.startingLevelUpSkillSum, rise.currentLevelUpSkillSum), level, `online ${online}`);
    assert.equal(checkForLevelUp(rise), false, `online ${online}: no level owed`);
  }
  const drop = spat();
  drop.skills[SE] = 10; drop.skills[CL] = 90;
  drop.currentLevelUpSkillSum = levelUpSkillSum(drop);
  const held = drop.currentLevelUpSkillSum, start = drop.startingLevelUpSkillSum;
  swapSkill(drop, DE, SE);   // a primary at 40 for a minor at 10
  assert.deepEqual([drop.startingLevelUpSkillSum, drop.currentLevelUpSkillSum, held - levelUpSkillSum(drop)], [start, held, 30]);
});

test('SKILL-TRADE the save keeps both groups', () => {
  const p = spat();
  swapSkill(p, SE, IL);
  const back = structuredClone(playerEntity);
  restorePlayer(back, JSON.parse(JSON.stringify(snapshotPlayer(p))));
  assert.deepEqual([back.career.primarySkills, back.career.minorSkills], [[DE, AL, SE], [CL, MD, RU, JU, SW, IL]]);
});

test('AUDIT SKILL-TRADE A2 THE ONLINE START: a rise keeps the online level on every start, held sum and rise - the float\'s edge walked back (start 153, held 230, a rise of 7 fell to level 6 from 7); offline the start moves by the rise (mutants: the online start moved as offline\'s; the edge unwalked)', () => {
  assert.equal(startAfterRise({ startingLevelUpSkillSum: 153, _online: false }, 230, 237), 160);
  assert.equal(onlineLevelFor(startAfterRise({ startingLevelUpSkillSum: 153, _online: true }, 230, 237), 237), onlineLevelFor(153, 230));
  for (let s = 140; s <= 320; s += 3) for (let h = s; h < LEVEL_SUM_TOP; h += 2) for (const d of [1, 7, 40]) {
    if (h + d >= LEVEL_SUM_TOP) continue;
    assert.equal(onlineLevelFor(startAfterRise({ startingLevelUpSkillSum: s, _online: true }, h, h + d), h + d), onlineLevelFor(s, h), `start ${s}, held ${h}, rise ${d}`);
  }
});

test('AUDIT SKILL-TRADE C9 THE REFUSALS\' ORDER: a mastered skill given up is said before a pick, and a pick before the price - a player short of gold is told the pick is wrong, not the price (mutants: the gold asked first; the mastered skill asked after the pick)', () => {
  const poor = spat({ gold: 0, mastered: [MY] });
  assert.equal(skillSwapRefusal(poor, DE, AL), 'Choose a skill outside your class, or one from another group, to take its place.');
  assert.equal(skillSwapRefusal(poor, MY, TH), 'A mastered skill stays in your class.');
  assert.match(skillSwapRefusal(poor, DE, RE), /^Changing a class skill costs 100,000 gold/);
});
