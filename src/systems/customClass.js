// U20a: the CUSTOM-CLASS BUILDER's laws - CreateCharCustomClass +
// CreateCharReputationWindow (MIT, Daggerfall Workshop), pure. The
// window itself draws in ui/chargenArt.js; everything a test can pin
// without art lives here.

import { SKILL_NAMES, SKILL_COUNT, MAGIC_SKILLS } from './skills.js';   // DFCareer.MagicSkills lives there

// CreateCharCustomClass.cs:29-34
export const HP_MIN = 4;                  // minHpPerLevel
export const HP_MAX = 30;                 // maxHpPerLevel
export const HP_DEFAULT = 8;              // defaultHpPerLevel
export const DIFFICULTY_MIN = -12;        // minDifficultyPoints
export const DIFFICULTY_MAX = 40;         // maxDifficultyPoints

// StatsRollout.cs:234,260 - the freeEdit clamp band, and
// DaggerfallStats.cs:28 - every attribute starts at the default 50.
export const FREE_EDIT_MIN = 10;
export const FREE_EDIT_MAX = 75;
export const STAT_DEFAULT = 50;

/** UpdateDifficulty's point tally (:481-495): +1 per HP above the
 *  default, -2 per HP below, plus the advantage/disadvantage
 *  adjustments (U20b - 0 until that window ships). */
export function difficultyPoints(hp, advantageAdjust = 0, disadvantageAdjust = 0) {
  const base = hp >= HP_DEFAULT ? hp - HP_DEFAULT : -(2 * (HP_DEFAULT - hp));
  return base + advantageAdjust + disadvantageAdjust;
}

/** The advancement-multiplier law (:498):
 *  0.3 + 2.7 * (points + 12) / 52. */
export function advancementMultiplier(points) {
  return 0.3 + (2.7 * (points + 12)) / 52;
}

/** The difficulty dagger's Y (:500-511): up from 115 toward 46 for
 *  positive points, down toward 186 for negative - C#'s (int) casts
 *  truncate. The dagger is CUST08I0 (24x9) at x 220. */
export function daggerY(points) {
  if (points >= 0) return Math.max(46, Math.trunc(115 - 37 * (points / 40)));
  return Math.min(186, Math.trunc(115 + 41 * (-points / 12)));
}

/** CG1 - AnimateDagger (CreateCharCustomClass.cs:515-531) as data.
 *  Every UpdateDifficulty ends by spawning a trail panel AT the
 *  dagger's (already-moved) position at full alpha, fading
 *  `255 * timeLeft / 1s` and removed at zero - so a spot the dagger
 *  leaves within a second keeps a fading ghost there, and rapid
 *  changes leave a chain of them. A trail under the dagger's CURRENT
 *  position is an identical sprite over an identical sprite -
 *  invisible - which is why detecting the y CHANGE at draw time is
 *  observationally DFU's spawn-on-every-UpdateDifficulty. */
export const DAGGER_TRAIL_LINGER_S = 1.0;   // daggerTrailLingerTime (:35)

/** Advance the trail set for this frame's dagger position. `state` is
 *  the caller's bag ({} to start); `now` in seconds, any monotonic
 *  clock. Returns the live trails as draw entries { y, alpha 0..1 },
 *  oldest first (Components.Add order - later trails draw on top). */
export function tickDaggerTrails(state, y, now) {
  state.trails ??= [];
  if (state.lastY == null) state.lastY = y;
  if (y !== state.lastY) {
    state.trails.push({ y, born: now });
    state.lastY = y;
  }
  for (let i = state.trails.length - 1; i >= 0; i--) {
    if (now - state.trails[i].born >= DAGGER_TRAIL_LINGER_S) state.trails.splice(i, 1);
  }
  return state.trails.map((t) => ({ y: t.y, alpha: 1 - (now - t.born) / DAGGER_TRAIL_LINGER_S }));
}

/** The skill list the pickers draw from: all 35 display names,
 *  alphabetical "a la classic" (:196-199), MINUS the ones already
 *  assigned - SkillPicker_OnItemPicked removes the pick from the
 *  list and returns the replaced skill to it, so no slot can ever
 *  duplicate another. */
export function availableSkills(assigned) {
  const taken = new Set(assigned.filter((s) => s != null));
  const out = [];
  for (let id = 0; id < SKILL_COUNT; id++) if (!taken.has(id)) out.push(id);
  out.sort((a, b) => SKILL_NAMES[a].localeCompare(SKILL_NAMES[b]));
  return out;
}

/** A fresh DFCareer carries NOTHING but the HP default and the x0.50
 *  spell-point multiplier (:161-165); every flag field is the C#
 *  default 0. The port stores the multiplier the way its readers do -
 *  Times_0_50 = 20 encoded in the bitfield's 0x1C00 band (20 << 8). */
/** U20b: `points` is the FULL difficulty tally - HP plus the two
 *  special-advantage adjusts - because UpdateDifficulty recomputes
 *  createdClass.AdvancementMultiplier from it on every change
 *  (CreateCharCustomClass.cs:477-498), so by exit time the multiplier
 *  already carries them. It defaults to the HP-only tally, which is
 *  what the value was for the whole of U20a. */
export function buildCustomCareer({ name, hp, skills, stats, points = null }) {
  return {
    resistanceFlags: 0, immunityFlags: 0, lowToleranceFlags: 0,
    criticalWeaknessFlags: 0,
    abilityFlagsAndSpellPointsBitfield: 20 << 8,   // SpellPointMultipliers.Times_0_50
    rapidHealing: 0, regeneration: 0, unknown1: 0,
    spellAbsorptionFlags: 0, attackModifierFlags: 0,
    forbiddenMaterialsFlags: 0, weaponArmorShieldsBitfield: 0,
    primarySkills: skills.slice(0, 3),
    majorSkills: skills.slice(3, 6),
    minorSkills: skills.slice(6, 12),
    name,
    hitPointsPerLevel: hp,
    advancementMultiplier: advancementMultiplier(points ?? difficultyPoints(hp)),
    // the wizard copies the builder's WORKING stats onto the career's
    // base attributes (DaggerfallStartNewGameWizard.cs:392-399)
    strength: stats.strength, intelligence: stats.intelligence,
    willpower: stats.willpower, agility: stats.agility,
    endurance: stats.endurance, personality: stats.personality,
    speed: stats.speed, luck: stats.luck,
  };
}

/** BiogFile.GetClassAffinityIndex (:519-558): the custom class's
 *  twelve skills scored against each standard class's twelve; the
 *  HIGHEST count wins, strictly-greater so ties keep the first. This
 *  picks the biography quiz (BIOG<affinity>T0). */
export function classAffinityIndex(customSkills, careers) {
  let highestAffinity = 0;
  let selectedIndex = 0;
  for (let i = 0; i < careers.length; i++) {
    const c = careers[i].career ?? careers[i];
    const classSkills = new Set([...c.primarySkills, ...c.majorSkills, ...c.minorSkills]);
    let affinity = 0;
    for (const s of customSkills) if (classSkills.has(s)) affinity++;
    if (affinity > highestAffinity) { highestAffinity = affinity; selectedIndex = i; }
  }
  return selectedIndex;
}



/** SetStartingSpells' custom arm (StartGameBehaviour.cs:809-823): a
 *  custom class with at least one MAGIC skill among its primaries or
 *  majors uses the SPELLSWORD starting set (index 1); none otherwise. */
export function customSpellSetIndex(career) {
  const six = [...career.primarySkills, ...career.majorSkills];
  return six.some((s) => MAGIC_SKILLS.includes(s)) ? 1 : null;
}

/** The help picker's topics -> TEXT.RSC ids (:176-185, the
 *  localization keys' English strings, in DFU's insertion order). */
export const HELP_TOPICS = Object.freeze([
  ['Attributes', 2402], ['Class Name', 2401], ['General', 2400],
  ['Reputations', 2406], ['Skill Advancement', 2407], ['Skills', 2403],
  ['Special Advantages', 2404], ['Special Disadvantages', 2405],
]);

// ---- CreateCharReputationWindow (CUST03I0) ----

// :36-41 - the bar geometry and its own colours (DFU literals).
export const REP_BAR_TOP = 24, REP_BAR_BOTTOM = 128, REP_BAR_MIDDLE = 76;
export const REP_GREEN = [0.388, 0.549, 0.223, 1];
export const REP_RED = [0.580, 0.031, 0, 1];
export const REP_EXIT = Object.freeze([129, 165, 33, 14]);   // exitButtonRect
export const REP_GROUPS = Object.freeze(['merchants', 'peasants', 'scholars', 'nobility', 'underworld']);

/** RoundNearestBarHeight (:243-259): 5px steps with the verbatim
 *  quirk - a remainder of exactly 4 rounds UP, 1..3 round DOWN -
 *  capped at the bar's 50px. */
export function roundNearestBarHeight(number) {
  const ret = number % 5 > 3 ? 5 * Math.trunc((number + 4) / 5) : 5 * Math.trunc(number / 5);
  return ret > 50 ? 50 : ret;
}

/** RepPanel_OnMouseClick (:255-281 + UpdateRep): a click inside the
 *  bar band picks the column by x threshold (>=134 underworld, >=101
 *  nobility, >=68 scholars, >=35 peasants, else merchants) and sets
 *  that group's rep to +-(height/5), sign by which side of the middle
 *  the click fell. Returns null outside the band. */
export function repClick(x, y) {
  if (y < REP_BAR_TOP || y > REP_BAR_BOTTOM) return null;
  const group = x >= 134 ? 'underworld' : x >= 101 ? 'nobility' : x >= 68 ? 'scholars' : x >= 35 ? 'peasants' : 'merchants';
  // UpdateRep computes repVal from the rounded height on EVERY click:
  // a click exactly on the middle line matches neither of its two
  // strict ifs, so no bar changes - but repVal is still sign 1 * 0 / 5
  // = ZERO, and that is what the group is set to. (DFU's own quirk
  // rides along: the previously drawn bar stays on screen beside the
  // new 0 label. The port derives its bars FROM the value, so it
  // cannot show that stale bar - a documented visual departure; the
  // value, which is what the character carries, is verbatim.)
  const nearestHeight = roundNearestBarHeight(Math.trunc(Math.abs(REP_BAR_MIDDLE - y)));
  const sign = y < REP_BAR_MIDDLE ? 1 : -1;
  // `|| 0`: -1 * 0 is JS's negative zero, which C#'s short cannot hold
  return { group, value: sign * (nearestHeight / 5) || 0 };
}

/** UpdatePointsToDistribute (:283-287): the ledger the exit gate
 *  reads - the NEGATED sum, zero when balanced. */
export function repPointsToDistribute(reps) {
  // `|| 0` normalizes JS's NEGATIVE ZERO: DFU's ledger is a C# short,
  // where -(short)0 is 0, and -0 leaks into deepEqual comparisons and
  // any Object.is-based check the save layer might make.
  return -REP_GROUPS.reduce((a, g) => a + (reps[g] ?? 0), 0) || 0;
}
