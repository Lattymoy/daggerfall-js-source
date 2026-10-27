// LEVEL-45 (2026-10-27, mob: "need to always be 45", "not let over leveling waste a player time", "everyone is
// converting", "get rid of it for online", "juidge will need changed to lvl 45"): online the six-skill climb is shared
// out so every start lands on exactly 45 at the top (840), every realm character's level is read again from its skills
// at its join, and online character creation has no biography.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ONLINE_LEVEL_CAP, LEVEL_SUM_TOP, ROLLED_START_MIN, ROLLED_START_AVERAGE,
  onlineLevelFor, onlineLevelFraction, onlineLevelConvert, onlineLevelPoints,
} from '../../src/systems/levelClimb.js';
import { calculatePlayerLevel, checkForLevelUp } from '../../src/systems/advancement.js';
import { evenHpFloor } from '../../src/systems/levelEven.js';
import { LEVEL_CAP } from '../../src/systems/levelCap.js';
import { crossLeveling } from '../../src/systems/realmCustoms.js';
import { JUDGE_LEVEL_MAX, characterFindings } from '../../server-account/src/judge.js';
import { REALM_LEVEL_CLAIM_MAX } from '../../server-account/src/realm.js';
import { rollSkills, spendPoolLowest } from '../../src/systems/chargen.js';
import { levelUpSkillSum } from '../../src/systems/skills.js';

test('LEVEL-45: the top is the six counted skills mastered at 140 (MASTER-THREE\'s 3 / 2 / 1), and the judge, the claim and the cap at the same 45', () => {
  assert.equal(LEVEL_SUM_TOP, 840);
  assert.equal(ONLINE_LEVEL_CAP, LEVEL_CAP, 'the one cap (levelCap.js)');
  assert.equal(ONLINE_LEVEL_CAP, 45);
  assert.equal(JUDGE_LEVEL_MAX, ONLINE_LEVEL_CAP, 'the judge reads the cap');
  assert.equal(REALM_LEVEL_CLAIM_MAX, ONLINE_LEVEL_CAP, 'the claim reads the cap');
  assert.deepEqual(characterFindings({ level: 45 }, null).filter((f) => f.code === 'level'), []);
  assert.deepEqual(characterFindings({ level: 46 }, null).filter((f) => f.code === 'level'), [{ code: 'level' }]);
});

test('LEVEL-45: every start from 100 to 700 reaches exactly 45 at the top and never before it, level 1 at creation', () => {
  for (let start = 100; start <= 700; start++) {
    assert.equal(onlineLevelFor(start, start), 1, `start ${start}: level 1 at creation`);
    assert.equal(onlineLevelFor(start, LEVEL_SUM_TOP), 45, `start ${start}: 45 at the top`);
    assert.equal(onlineLevelFor(start, LEVEL_SUM_TOP - 1) <= 45, true);
    assert.equal(onlineLevelFor(start, LEVEL_SUM_TOP + 50), 45, 'never past the cap');
    let last = 1;
    for (let sum = start; sum <= LEVEL_SUM_TOP; sum++) {
      const lv = onlineLevelFor(start, sum);
      assert.ok(lv >= last && lv <= last + 1, `start ${start}, sum ${sum}: one level at a time`);
      last = lv;
    }
  }
});

test('LEVEL-45: a start of 193 levels exactly as Daggerfall does (the 28 head start kept), and no start climbs a point for nothing', () => {
  for (let sum = 193; sum <= LEVEL_SUM_TOP; sum++) assert.equal(onlineLevelFor(193, sum), Math.min(45, calculatePlayerLevel(193, sum)), `sum ${sum}`);
  for (const start of [133, 144, 154, 169]) {
    let first45 = null;
    for (let sum = start; sum <= LEVEL_SUM_TOP; sum++) if (first45 == null && onlineLevelFor(start, sum) === 45) first45 = sum;
    assert.equal(first45, LEVEL_SUM_TOP, `start ${start}: 45 arrives on the last point`);
  }
  assert.equal(onlineLevelFraction(193, 193 + 15 + 2), (28 + 17) / 15 - 3);
  assert.equal(onlineLevelFraction(144, LEVEL_SUM_TOP), 1, 'full at the cap');
});

test('LEVEL-45: the creation\'s starts - 144 the least any roll gives, 154 the average (pools spent lowest-first)', () => {
  assert.equal(ROLLED_START_MIN, 144);
  const career = { primarySkills: [0, 1, 2], majorSkills: [3, 4, 5], minorSkills: [6, 7, 8, 9, 10, 11] };
  let i = 0;
  const seq = () => ((i = (i * 1103515245 + 12345) % 2147483648) / 2147483648);
  let n = 0, total = 0, low = Infinity;
  for (let k = 0; k < 20_000; k++) {
    const { skills, groupPools } = rollSkills(career, seq);
    spendPoolLowest(skills, career.primarySkills, groupPools.primary);
    spendPoolLowest(skills, career.majorSkills, groupPools.major);
    spendPoolLowest(skills, career.minorSkills, groupPools.minor);
    const s = levelUpSkillSum({ career, skills });
    n++; total += s; low = Math.min(low, s);
  }
  assert.ok(low >= ROLLED_START_MIN);
  assert.equal(Math.round(total / n), ROLLED_START_AVERAGE);
});

test('LEVEL-45: online the level-up check reads the shared climb; offline Daggerfall\'s 15 stands, stopped at the cap', () => {
  const e = (online) => ({ _online: online, level: 44, startingLevelUpSkillSum: 133, currentLevelUpSkillSum: 830 });
  const on = e(true);
  assert.equal(checkForLevelUp(on), false, 'online: 44 until the last points');
  const off = e(false);
  assert.equal(checkForLevelUp(off), true, 'offline: 48 by Daggerfall, 45 owed at the cap');
  assert.equal(off.pendingLevel, 45);
  const early = { _online: true, level: 1, startingLevelUpSkillSum: 150, currentLevelUpSkillSum: 150 + 30 };
  assert.equal(checkForLevelUp(early), true);
  assert.equal(early.pendingLevel, 2);
});

/** A realm save of a 30-a-level class at `level`, its six counted skills summing to about `sum`. */
const save = ({ level, start, current, maxHealth = 5_000, health = maxHealth, end = 100 }) => ({
  level, startingLevelUpSkillSum: start, currentLevelUpSkillSum: current, maxHealth, health,
  readyToLevelUp: true, pendingLevel: level + 1,
  career: { hitPointsPerLevel: 30, primarySkills: [0, 1, 2], majorSkills: [3, 4, 5], minorSkills: [6, 7, 8, 9, 10, 11] },
  skills: new Array(35).fill(5), stats: { endurance: end },
});

test('LEVEL-45: the conversion - an Oblivion crossover (start no roll gives) takes the average roll and the level its skills earn, its health the even floor there', () => {
  const s = save({ level: 60, start: 700 + 28 - 15 * 60, current: 700 });   // LEVEL-ONLINE-2's anchor: -172
  assert.equal(onlineLevelConvert(s), true);
  assert.equal(s.startingLevelUpSkillSum, ROLLED_START_AVERAGE);
  assert.equal(s.level, onlineLevelFor(ROLLED_START_AVERAGE, 700));
  assert.equal(s.level, 36);
  assert.equal(s.maxHealth, evenHpFloor({ career: s.career, level: 36 }, 100));
  assert.equal(s.health, s.maxHealth);
  assert.equal(s.readyToLevelUp, false);
  assert.equal(s.pendingLevel, null);
  assert.equal(onlineLevelConvert(s), false, 'run again, nothing moves');
});

test('LEVEL-45: the conversion - a level 113 with every counted skill maxed comes to 45; one its skills put below its level comes down to them', () => {
  const top = save({ level: 113, start: 150, current: LEVEL_SUM_TOP });
  onlineLevelConvert(top);
  assert.equal(top.level, 45);
  assert.equal(top.startingLevelUpSkillSum, 150, 'a real start is kept');
  const mid = save({ level: 40, start: 150, current: 500 });
  onlineLevelConvert(mid);
  assert.equal(mid.level, onlineLevelFor(150, 500));
});

test('LEVEL-45: the conversion never gives a level - one earned and not taken stays owed for the level-up screen, its health untouched', () => {
  const owed = save({ level: 10, start: 150, current: 500, maxHealth: 400 });
  assert.equal(onlineLevelConvert(owed), false);
  assert.equal(owed.level, 10);
  assert.equal(owed.readyToLevelUp, true);
  assert.equal(owed.maxHealth, 400);
  const lucky = save({ level: onlineLevelFor(150, 500), start: 150, current: 500, maxHealth: 9_000 });
  onlineLevelConvert(lucky);
  assert.equal(lucky.maxHealth, 9_000, 'a level that stands keeps its rolls (LEVEL-EVEN)');
});

test('LEVEL-45: the conversion keeps the sum the level stands on (SWAP-CYCLE) and rides LEVEL-ONLINE\'s switch at every join', () => {
  const held = save({ level: 30, start: 150, current: 640 });
  onlineLevelConvert(held);
  assert.equal(held.currentLevelUpSkillSum, 640, 'never below the held sum');
  const crossing = { ...save({ level: 60, start: 200, current: 700 }), levelingSystem: 'virtue', levelProgress: 40, readyToLevelUp: false };
  crossLeveling(crossing);
  assert.equal(crossing.level, 36, 'switched, then converted');
  const classic = save({ level: 113, start: 150, current: LEVEL_SUM_TOP });
  assert.equal(crossLeveling(classic), false, 'no switch said for a Daggerfall character');
  assert.equal(classic.level, 45, 'but converted all the same');
});

test('LEVEL-45: online character creation has no biography - the class goes straight to the name, and the name\'s back stays there', async () => {
  const { ChargenFlow } = await import('../../src/ui/chargen.js');
  const career = { name: 'Mage', hitPointsPerLevel: 8, advancementMultiplier: 1, strength: 40, intelligence: 60, willpower: 72, agility: 48, endurance: 52, personality: 55, speed: 48, luck: 57, primarySkills: [0, 1, 2], majorSkills: [3, 4, 5], minorSkills: [6, 7, 8, 9, 10, 11] };
  const biog = { backstoryId: 0, questions: [{ text: ['Q1', ''], answers: [{ text: 'a', effects: ['A0'] }] }] };
  const make = (off) => { const f = new ChargenFlow([{ name: 'Mage', career }], () => 0); f.biogFor = () => biog; f.biographyOff = off; f.state = 'class'; f.input('confirm'); return f; };
  assert.equal(make(false).state, 'bioMethod', 'offline: Daggerfall\'s biography');
  const on = make(true);
  assert.equal(on.state, 'name', 'online: none');
  on._enterBiographyBack();
  assert.equal(on.state, 'name');
  assert.deepEqual(on.biographyEffects, []);
});

test('LEVEL-45: online a raise is priced at the level the skills earned - leaving every level owed no longer trains at level 1\'s price; offline DFU\'s taken level', async () => {
  const { raisePriceLevel, skillAdvanceProgress } = await import('../../src/systems/advancement.js');
  const career = { advancementMultiplier: 1, primarySkills: [0, 1, 2], majorSkills: [3, 4, 5], minorSkills: [6, 7, 8, 9, 10, 11] };
  const skills = new Array(35).fill(5);
  [0, 1, 2].forEach((i) => { skills[i] = 90; });
  [3, 4, 5].forEach((i) => { skills[i] = 80; });
  skills[6] = 70;
  const held = (online) => ({ _online: online, isPlayer: true, level: 1, career, skills: [...skills], skillUses: new Array(35).fill(0), reflexes: 2, startingLevelUpSkillSum: 150, currentLevelUpSkillSum: 0 });
  const on = held(true), off = held(false);
  const earned = onlineLevelFor(150, levelUpSkillSum(on));
  assert.ok(earned > 20);
  assert.equal(raisePriceLevel(on), earned, 'online: the earned level');
  assert.equal(raisePriceLevel(off), 1, 'offline: the level taken');
  assert.ok(skillAdvanceProgress(on, 0).need > 2 * skillAdvanceProgress(off, 0).need, 'the held level pays the earned price');
  assert.equal(raisePriceLevel({ ...on, level: 44 }), 44, 'never below the level taken');
});

test('LEVEL-BAR: online the level bar reads skill points - each level\'s span is the points between its start and the next, they add to the whole climb, and the bar is full at the cap (mob: "800/45")', async () => {
  for (const start of [133, 144, 154, 169, 193, 400]) {
    const room = LEVEL_SUM_TOP - start;
    let total = 0;
    for (let sum = start; sum <= LEVEL_SUM_TOP; sum++) {
      const { now, max } = onlineLevelPoints(start, sum);
      const lv = onlineLevelFor(start, sum);
      if (lv < 45) {
        assert.ok(now >= 0 && now < max, `start ${start}, sum ${sum}: ${now}/${max}`);
        if (now === 0 && sum > start) assert.equal(onlineLevelFor(start, sum - 1), lv - 1, 'a level begins where the bar empties');
      } else assert.equal(now, max, 'full at the cap');
    }
    for (let lv = 1; lv < 45; lv++) {
      let sum = start; while (onlineLevelFor(start, sum) < lv) sum++;
      total += onlineLevelPoints(start, sum).max;
    }
    assert.equal(total, room, `start ${start}: the spans add to the climb`);
  }
  const avg = onlineLevelPoints(ROLLED_START_AVERAGE, 420);
  assert.deepEqual([onlineLevelFor(ROLLED_START_AVERAGE, 420), avg.max], [18, 16], 'about 16 points a level at the average start');
  const { levelProgress } = await import('../../src/ui/levelUp/levelUpView.js');
  const bar = levelProgress({ _online: true, level: 17, startingLevelUpSkillSum: ROLLED_START_AVERAGE, currentLevelUpSkillSum: 409 }, 'classic');
  assert.deepEqual([bar.now, bar.max], [14, 16], 'the window says points, not a percent');
});
