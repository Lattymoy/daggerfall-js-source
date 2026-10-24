// @ts-check
// SKILL-SWAP (2026-10-19, Discord #suggestions "With the addition of arcane and martial specialisations...", Brother
// Frank, through Mac: "I'd very much like it if the team considered adding the ability (if it is possible) to either change
// one of our skills out or allow some of these specializations to work with just the one weapon skill"; asked, Mac: "Paid
// skill swap") - A CLASS SKILL GIVEN UP FOR ONE OUTSIDE THE CLASS, FOR GOLD. A career's primary, major and minor lists are
// set at creation (formats/classFile.js, chargen) and nothing changed them after: a class holding one weapon skill could
// never master two, so no martial path would ever open for it (martialPaths.js martialPossible), however long it played.
//
// THE SWAP. One class skill the character has NOT mastered leaves its group, and one miscellaneous skill takes its place
// in that same group - primary for primary, major for major, minor for minor - so the 2/2/1 masteries (masterSkills.js)
// and every slot already spent stand as they were. A mastered skill is never given up (a mastery is permanent, and a
// held path is two of them). The skills' values do not move. The career is the character's own copy from here (the save
// keeps the career whole - save.js), its name and every other term unchanged.
//
// THE LEVEL DOES NOT MOVE, AND A SKILL'S TRAINING LEAVES WITH IT (SWAP-CYCLE, 2026-10-20). The level is the classic
// sum's (advancement.js calculatePlayerLevel over the stored starting and current sums, skills.js levelUpSkillSum - the
// class's skills alone), and the stored current sum is the sum the level stands on: the highest the class's sum has
// reached, which no swap lowers (advancement.js raiseSkills keeps it there too). A swap that lowers the class's sum (a
// trained skill out, a less trained one in) leaves both stored sums where they stand - the level and its progress stand,
// and the class's skills make the ground up before the next level comes any closer. A swap that takes the class's sum
// above the one the level stands on (a trained miscellaneous skill brought in) moves both sums by the rise above it, so it
// pays no levels; the ground an earlier swap gave up is won back first, so a swap undone is no swap at all. The swap had
// moved both sums by whatever it moved the class's sum, a drop as well as a rise: each trained skill given up for an
// untrained one kept its training on the level and freed its place to earn the same levels again, and one class cycled
// through every one of the 35 skills reached level 223 where its own lists top out at 31. Now no sequence of swaps takes
// the level past what the class's lists could hold - DFU's ceiling.
//
// THE PRICE is one flat SKILL_SWAP_GOLD a swap, paid as SPEC-RESET's is (specReset.js resetGold and court.js
// payUndoable: the coins, else the letters of credit, and online the Empire's account) - the save's own, so the purse
// and the career move in one save. Half a specialisation's reset: a smaller thing undone.
//
// Not a DFU member: Daggerfall's classes are fixed once made. Ledger A (SKILL-SWAP).

import { SKILLS, SKILL_NAMES, levelUpSkillSum } from './skills.js';
import { careerGroupOf, isMasteredSkill } from './masterSkills.js';
import { resetGold } from './specReset.js';   // SPEC-RESET's purse: coins, letters and online the Empire's account
import { payUndoable } from './court.js';
import { accountOfSave, REALM_EMPIRE_ACCOUNT } from '../net/realm/realmGoldLaw.js';
import { t } from './textManager.js';

/** SKILL-SWAP: what one swap costs. */
export const SKILL_SWAP_GOLD = 100_000;
const LIST = Object.freeze({ primary: 'primarySkills', major: 'majorSkills', minor: 'minorSkills' });
const ALL = Object.freeze([...new Set(Object.values(SKILLS))].filter((id) => Number.isInteger(id) && id >= 0 && id < SKILL_NAMES.length).sort((a, b) => a - b));

/** The class skills this character may give up: in a career group and not mastered, primary first. */
export function swapOutChoices(entity) {
  const c = entity?.career;
  return [...(c?.primarySkills ?? []), ...(c?.majorSkills ?? []), ...(c?.minorSkills ?? [])].filter((id) => !isMasteredSkill(entity, id));
}
/** The skills that may take a place in the class: every one outside it. */
export const swapInChoices = (entity) => (entity?.career ? ALL.filter((id) => careerGroupOf(entity, id) == null) : []);

/** Why giving up `out` for `inn` cannot be done now, or null when it can. */
export function skillSwapRefusal(entity, out, inn) {
  if (!entity?.career) return t('skillswap.refuse.career', 'You have no class to change.');
  if (!careerGroupOf(entity, out)) return t('skillswap.refuse.out', 'Choose one of your class skills to give up.');
  if (isMasteredSkill(entity, out)) return t('skillswap.refuse.mastered', 'A mastered skill stays in your class.');
  if (!swapInChoices(entity).includes(inn)) return t('skillswap.refuse.in', 'Choose a skill outside your class to take its place.');
  const have = resetGold(entity);
  if (have >= SKILL_SWAP_GOLD) return null;
  const words = { gold: SKILL_SWAP_GOLD, have };
  return entity._online === true
    ? t('skillswap.refuse.gold', 'Changing a class skill costs {gold, number} gold. You have {have, number}.', words)
    : t('skillswap.refuse.goldOffline', 'Changing a class skill costs {gold, number} gold, paid in coins or letters of credit. You have {have, number}.', words);
}

/** The group a swap puts `inn` in: `out`'s. */
export const swapGroupOf = (entity, out) => careerGroupOf(entity, out);
/** The group's word in a sentence - the Growth page's own (ui/growth/specGuide.js groupWord's keys). */
const groupWord = (g) => (g === 'primary' ? t('growth.spec.group.primary', 'primary') : g === 'major' ? t('growth.spec.group.major', 'major') : t('growth.spec.group.minor', 'minor'));

/** The career with `inn` in `out`'s place in its group - a copy, the entity's own untouched; the original when `out` is in
 *  no group. AUDIT SUGGESTIONS-1019 L5-4: marked `swapped`, so the family's record keeps it whole for an heir as it keeps a
 *  custom class (legacy/family.js careerFields) - it is no longer the class file its index names. */
export function swappedCareer(entity, out, inn) {
  const group = careerGroupOf(entity, out);
  if (!group) return entity?.career ?? null;
  const key = LIST[group];
  return { ...entity.career, [key]: entity.career[key].map((id) => (id === out ? inn : id)), swapped: true };
}
/** AUDIT SUGGESTIONS-1019 L5-1: whether one swap of `out` for `inn` lets `possible` (a family's law - martialPaths.js
 *  martialPossible, arcanePaths.js pathPossible) answer yes, the masteries and their slots as they stand. */
export const swapOpens = (entity, out, inn, possible) => !!entity?.career && possible({ ...entity, career: swappedCareer(entity, out, inn) });

/** SWAP-CYCLE: the sum the level stands on - the stored current sum, caught up with the class's own where a raise has not
 *  stored it yet (a point trained by other means is the level's; the next raise's SetCurrentLevelUpSkillSum stores it). */
function heldSum(entity) {
  const sum = levelUpSkillSum(entity), held = entity.currentLevelUpSkillSum;
  return held >= sum ? held : sum;
}
/** SWAP-CYCLE: the points the class's sum would sit under the sum the level stands on once `out` is given up for `inn` -
 *  what its skills make up before the next level comes any closer; 0 when it would sit under none. */
export const swapShortfall = (entity, out, inn) => (entity?.career
  ? Math.max(0, heldSum(entity) - levelUpSkillSum({ ...entity, career: swappedCareer(entity, out, inn) })) : 0);

/** Swap them: pay SKILL_SWAP_GOLD, put `inn` in `out`'s place in its group on the character's own copy of the career,
 *  and move both level sums by what the swap takes the class's sum above the one the level stands on - nothing for a
 *  swap that lowers it (SWAP-CYCLE). Returns { ok, text }. */
export function swapSkill(entity, out, inn) {
  const why = skillSwapRefusal(entity, out, inn);
  if (why) return { ok: false, text: why };
  const group = careerGroupOf(entity, out);
  const held = heldSum(entity);
  payUndoable(entity, SKILL_SWAP_GOLD, entity._online === true ? accountOfSave(entity, REALM_EMPIRE_ACCOUNT) : null);
  entity.career = swappedCareer(entity, out, inn);
  const rise = Math.max(0, levelUpSkillSum(entity) - held);
  entity.startingLevelUpSkillSum = (entity.startingLevelUpSkillSum ?? 0) + rise;
  entity.currentLevelUpSkillSum = held + rise;
  return { ok: true, text: t('skillswap.done', '{inn} is now one of your {group} skills, in place of {out}.', { inn: SKILL_NAMES[inn], out: SKILL_NAMES[out], group: groupWord(group) }) };
}
