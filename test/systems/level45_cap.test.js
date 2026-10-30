// LEVEL-45 (2026-10-27, mob: "need to always be 45", "not let over leveling waste a player time", "everyone is
// converting", "get rid of it for online", "juidge will need changed to lvl 45"): online the six-skill climb is shared
// out so every start lands on exactly 45 at the top (800), every realm character's level is read again from its skills
// at its join, and online character creation has no biography.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ONLINE_LEVEL_CAP, LEVEL_SUM_TOP, ROLLED_START_MIN, ROLLED_START_AVERAGE, ROLLED_START_MAX, LEGACY_START_MAX, birthSkillOk,
  onlineLevelFor, onlineLevelFraction, onlineLevelConvert, onlineLevelPoints, onlineLevelRawPoints, RAW_PER_POINT_PAST,
} from '../../src/systems/levelClimb.js';
import { calculatePlayerLevel, checkForLevelUp, applyLevelUp } from '../../src/systems/advancement.js';
import { evenHpFloor } from '../../src/systems/levelEven.js';
import { LEVEL_CAP } from '../../src/systems/levelCap.js';
import { crossLeveling } from '../../src/systems/realmCustoms.js';
import { JUDGE_LEVEL_MAX, characterFindings } from '../../server-account/src/judge.js';
import { REALM_LEVEL_CLAIM_MAX, firstSaveRefusal } from '../../server-account/src/realm.js';
import { rollSkills, spendPoolLowest } from '../../src/systems/chargen.js';
import { levelUpSkillSum } from '../../src/systems/skills.js';

test('LEVEL-45: the top is five masteries at 140 and the sixth at 100 - MASTER-THREE\'s sixth slot not counted (LEVEL-TOP, mob: "dont count the 6th mastery") - and the judge, the claim and the cap at the same 45', () => {
  assert.equal(LEVEL_SUM_TOP, 800);
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

test('LEVEL-45: a start of 153 levels exactly as Daggerfall does (the 28 head start kept), and no start climbs a point for nothing', () => {
  for (let sum = 153; sum <= LEVEL_SUM_TOP; sum++) assert.equal(onlineLevelFor(153, sum), Math.min(45, calculatePlayerLevel(153, sum)), `sum ${sum}`);
  for (const start of [133, 144, 154, 169]) {
    let first45 = null;
    for (let sum = start; sum <= LEVEL_SUM_TOP; sum++) if (first45 == null && onlineLevelFor(start, sum) === 45) first45 = sum;
    assert.equal(first45, LEVEL_SUM_TOP, `start ${start}: 45 arrives on the last point`);
  }
  assert.equal(onlineLevelFraction(153, 153 + 15 + 2), (28 + 17) / 15 - 3);
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

test('LEVEL-45 BIRTH-SKILL: a birth is one bounded 3/3/6 creation whose start, current and live sums agree; Legacy alone gets Hearth\'s ceiling; the judge holds a start below the floor', () => {
  assert.deepEqual([ROLLED_START_MAX, LEGACY_START_MAX], [169, 184]);
  const career = { primarySkills: [0, 1, 2], majorSkills: [3, 4, 5], minorSkills: [6, 7, 8, 9, 10, 11] };
  const skills = new Array(35).fill(5);
  for (const id of [0, 1, 2]) skills[id] = 30;
  for (const id of [3, 4, 5]) skills[id] = 20;
  for (const id of [6, 7, 8, 9, 10, 11]) skills[id] = 15;
  const live = levelUpSkillSum({ career, skills });
  assert.ok(live >= ROLLED_START_MIN);
  const born = { level: 1, goldPieces: 100, items: [], career, skills, startingLevelUpSkillSum: live, currentLevelUpSkillSum: live };
  assert.equal(birthSkillOk(born), true);
  assert.equal(firstSaveRefusal(JSON.stringify(born), { origin_id: null }), null);
  assert.equal(birthSkillOk({ ...born, startingLevelUpSkillSum: 0, currentLevelUpSkillSum: 0 }), false, 'start zeroed');
  assert.equal(birthSkillOk({ ...born, skills: new Array(35).fill(0), startingLevelUpSkillSum: live, currentLevelUpSkillSum: live }), false, 'skills zeroed, start forged');
  assert.equal(birthSkillOk({ level: 1, startingLevelUpSkillSum: live, currentLevelUpSkillSum: live }), false, 'career and skills cannot be omitted');
  assert.equal(birthSkillOk({ ...born, career: { ...career, primarySkills: [0, 0, 0] } }), false, 'the twelve career skills are unique');
  const maxed = { ...born, skills: [...skills], startingLevelUpSkillSum: ROLLED_START_MAX, currentLevelUpSkillSum: ROLLED_START_MAX };
  maxed.skills[0] += ROLLED_START_MAX - live;
  assert.equal(birthSkillOk(maxed), true, 'normal ceiling');
  maxed.skills[0] += 1; maxed.startingLevelUpSkillSum += 1; maxed.currentLevelUpSkillSum += 1;
  assert.equal(birthSkillOk(maxed), false, 'normal birth above its ceiling');
  assert.equal(birthSkillOk(maxed, { legacy: true }), true, 'Legacy Hearth ceiling');
  assert.deepEqual(firstSaveRefusal(JSON.stringify(maxed), { origin_id: null, lineage_id: 'line' }), null);
  assert.deepEqual(firstSaveRefusal(JSON.stringify({ ...born, startingLevelUpSkillSum: 0, currentLevelUpSkillSum: 0 }), { origin_id: null }), { error: 'realm-birth' });
  assert.deepEqual(firstSaveRefusal(JSON.stringify({ ...born, skills: new Array(35).fill(0) }), { origin_id: null }), { error: 'realm-birth' });
  assert.deepEqual(characterFindings({ level: 1, startingLevelUpSkillSum: 0 }, null).filter((f) => f.code === 'skill-start'), [{ code: 'skill-start' }]);
  assert.deepEqual(characterFindings({ level: 1, startingLevelUpSkillSum: '0' }, null).filter((f) => f.code === 'skill-start'), [{ code: 'skill-start' }]);
  assert.deepEqual(characterFindings({ level: 1, startingLevelUpSkillSum: ROLLED_START_MIN }, null).filter((f) => f.code === 'skill-start'), []);
});

test('LEVEL-45: online the level-up check reads the shared climb; offline Daggerfall\'s 15 stands, stopped at the cap', () => {
  const e = (online) => ({ _online: online, level: 44, startingLevelUpSkillSum: 133, currentLevelUpSkillSum: 790 });
  const on = e(true);
  assert.equal(checkForLevelUp(on), false, 'online: 44 until the last points');
  const off = e(false);
  assert.equal(checkForLevelUp(off), true, 'offline: past 45 by Daggerfall, 45 owed at the cap');
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
  assert.equal(s.level, 38);
  assert.equal(s.maxHealth, evenHpFloor({ career: s.career, level: 38 }, 100));
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

test('LEVEL-OWED: a level the skills earned is offered at the join, for the window and its points - or given there to attributes already at their maximum ("give the atribuit point")', () => {
  // PIN MOVED: LEVEL-OWED (2026-10-28) - an owed level not flagged waited on a six-hour skill check
  const owed = save({ level: 10, start: 150, current: 500, maxHealth: 400 });
  owed.readyToLevelUp = false; owed.pendingLevel = null;
  assert.equal(onlineLevelConvert(owed), true);
  assert.equal(owed.level, 10, 'with points to place, the level is the window\'s to give');
  assert.equal(owed.readyToLevelUp, true, 'offered at the join');
  assert.equal(owed.pendingLevel, 11);
  assert.equal(owed.maxHealth, 400, 'health is the window\'s roll');
  const earned = onlineLevelFor(150, 500);
  const capped = save({ level: 10, start: 150, current: 500, maxHealth: 400 });
  capped.readyToLevelUp = false;
  capped.stats = Object.fromEntries(['strength', 'intelligence', 'willpower', 'agility', 'endurance', 'personality', 'speed', 'luck'].map((k) => [k, 100]));
  assert.equal(onlineLevelConvert(capped), true);
  assert.equal(capped.level, earned, 'every attribute at its natural maximum: no point to place, the level given ("not to those that are capped out")');
  assert.equal(capped.readyToLevelUp, false);
  assert.equal(capped.maxHealth, evenHpFloor({ career: capped.career, level: earned }, 100), 'health to the even floor there');
  const strong = save({ level: 10, start: 150, current: 500, maxHealth: 9_000 });
  strong.stats = capped.stats;
  onlineLevelConvert(strong);
  assert.equal(strong.maxHealth, 9_000, 'never lowered');
  const flagged = save({ level: 10, start: 150, current: 500, maxHealth: 400 });
  assert.equal(onlineLevelConvert(flagged), false, 'one already offered is left as it is');
  const lucky = save({ level: onlineLevelFor(150, 500), start: 150, current: 500, maxHealth: 9_000 });
  onlineLevelConvert(lucky);
  assert.equal(lucky.maxHealth, 9_000, 'a level that stands keeps its rolls (LEVEL-EVEN)');
});

test('LEVEL-OWED: online a level taken offers the next one owed at once; offline Daggerfall waits for its next skill check', () => {
  const hero = (online) => ({ _online: online, level: 40, startingLevelUpSkillSum: 154, currentLevelUpSkillSum: 800, readyToLevelUp: true, pendingLevel: 41,
    maxHealth: 900, health: 900, career: { hitPointsPerLevel: 30 }, stats: { endurance: 100, strength: 50 } });
  const on = hero(true);
  assert.equal(applyLevelUp(on, () => {}, () => 0.5, 5), true);
  assert.equal(on.level, 41);
  assert.equal(on.readyToLevelUp, true, 'online: 42 offered now');
  assert.equal(on.pendingLevel, 42);
  const off = hero(false);
  applyLevelUp(off, () => {}, () => 0.5, 5);
  assert.equal(off.readyToLevelUp, false, 'offline: DFU\'s RaiseSkills re-offers on its next pass');
});

test('LEVEL-45: the conversion keeps the sum the level stands on (SWAP-CYCLE) and rides LEVEL-ONLINE\'s switch at every join', () => {
  const held = save({ level: 30, start: 150, current: 640 });
  onlineLevelConvert(held);
  assert.equal(held.currentLevelUpSkillSum, 640, 'never below the held sum');
  const crossing = { ...save({ level: 60, start: 200, current: 700 }), levelingSystem: 'virtue', levelProgress: 40, readyToLevelUp: false };
  crossLeveling(crossing);
  assert.equal(crossing.level, 38, 'switched, then converted');
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
  for (const start of [133, 144, 153, 154, 169, 400]) {
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
  assert.deepEqual([onlineLevelFor(ROLLED_START_AVERAGE, 420), avg.max], [19, 15], 'about 15 points a level at the average start');
  const { levelProgress } = await import('../../src/ui/levelUp/levelUpView.js');
  const bar = levelProgress({ _online: true, level: 18, startingLevelUpSkillSum: ROLLED_START_AVERAGE, currentLevelUpSkillSum: 409 }, 'classic');
  assert.deepEqual([bar.now, bar.max], [13, 15], 'the window says points, not a percent');
});

test('LEVEL-TOP: a character maxed under five masteries - five at 200, the sixth counted skill at 100 - is 45, and a sixth mastery adds no level (mob: "i have max skills and im lvl 42?")', () => {
  for (const start of [144, 154, 169]) {
    assert.equal(onlineLevelFor(start, 5 * 140 + 100), 45, `start ${start}`);
    assert.equal(onlineLevelFor(start, 6 * 140), 45, 'the sixth mastery: no level past it');
  }
  const lowered = save({ level: 42, start: ROLLED_START_AVERAGE, current: 800 });
  onlineLevelConvert(lowered);
  assert.equal(lowered.readyToLevelUp, true, 'LEVEL-OWED: the three lost are offered at the join, one window after another');
  const maxed = save({ level: 42, start: ROLLED_START_AVERAGE, current: 800 });
  maxed.stats = Object.fromEntries(['strength', 'intelligence', 'willpower', 'agility', 'endurance', 'personality', 'speed', 'luck'].map((k) => [k, 100]));
  onlineLevelConvert(maxed);
  assert.equal(maxed.level, 45, 'an example character at sum 800 and level 42, its attributes at 100: 45 at the join');
});

test('LEVEL-RAW: the bar reads the skill sheet\'s own points - 1 a counted point to 100, 2.5 past it, so ~38 a level at the masteries ("show raw point to each level")', async () => {
  assert.equal(RAW_PER_POINT_PAST, 2.5, '100 points past 100 climb 40');
  const career = { primarySkills: [0, 1, 2], majorSkills: [3, 4, 5], minorSkills: [6, 7, 8, 9, 10, 11] };
  const hero = (vals, mastered = []) => ({
    isPlayer: true, _online: true, level: 30, career, masteredSkills: mastered,
    skills: Object.fromEntries(vals.map((v, i) => [i, v])),
    startingLevelUpSkillSum: ROLLED_START_AVERAGE, currentLevelUpSkillSum: 600,
  });
  const counted = onlineLevelPoints(ROLLED_START_AVERAGE, 600);
  const low = onlineLevelRawPoints(hero([60, 60, 60, 60, 60, 20, 60, 10, 10, 10, 10, 10]));
  assert.deepEqual(low, counted, 'under 100 a sheet point is a counted point');
  const all = [0, 1, 2, 3, 4, 6];
  const high = onlineLevelRawPoints(hero([150, 150, 150, 150, 150, 20, 150, 10, 10, 10, 10, 10], all));
  assert.deepEqual(high, { now: Math.round(counted.now * 2.5), max: Math.round(counted.max * 2.5) }, 'past 100, 2.5 a point');
  assert.ok(high.max >= 37 && high.max <= 38, `~38 a level at the masteries: ${high.max}`);
  const mixed = onlineLevelRawPoints(hero([150, 150, 150, 60, 60, 20, 60, 10, 10, 10, 10, 10], [0, 1, 2]));
  assert.equal(mixed.max, Math.round(counted.max * 1.75), 'the six counted skills\' mean cost');
  const held = onlineLevelRawPoints(hero([100, 100, 100, 100, 100, 20, 100, 10, 10, 10, 10, 10]));
  assert.equal(held.max, Math.round(counted.max * 2.5), 'six at 100 waiting for their masteries cost the mastery\'s');
  const done = onlineLevelRawPoints(hero([150, 150, 150, 150, 150, 20, 200, 10, 10, 10, 10, 10], all));
  assert.equal(done.max, Math.round(counted.max * 2.5), 'a skill at 200 climbs no more and is not counted');
  const { levelProgress } = await import('../../src/ui/levelUp/levelUpView.js');
  const bar = levelProgress(hero([150, 150, 150, 150, 150, 20, 150, 10, 10, 10, 10, 10], all), 'classic');
  assert.deepEqual([bar.now, bar.max], [high.now, high.max], 'the window reads it');
});
