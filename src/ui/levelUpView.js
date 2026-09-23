// ═══════════════════════════════════════════════════════════════════
// LV1 — THE ASCENSION: what the enhanced level-up window KNOWS.
//
// Mac, 2026-09-18: "We're going to be working on the next enhanced UI
// window... Our gold standard is a replication of the skyrim level up
// UI in our own constellation vision."
//
// ── WHAT WAS THERE BEFORE ─────────────────────────────────────────
// Nothing of the enhanced skin. `ui/charSheetDoor.js` has forked on
// the skin for every screen since U52 EXCEPT this one: a level-up in
// the enhanced skin mounted `ui/charsheet.js`'s LevelUpScreen - eight
// rows of drawText over a 92% dim, on the canvas, in FONT0003 - and
// `ui/enhancedCharSheet.js`'s own header said so in as many words
// ("THE LEVEL-UP SCREEN stays classic... Not this door's business").
// That sentence is retired by this slice, where it stood, per
// bible/Home.md's RETIRING A FLAG DELETES THE SENTENCE.
//
// ── WHY A CONSTELLATION, AND WHY IT IS NOT SKYRIM'S ───────────────
// Skyrim's level-up screen is a sky: your skills are stars, and the
// moment you gain a level the camera is already pointed at them. The
// INTERACTION MODEL is what src/tools/enhancedUI.js says the port
// borrows - one thing at a time, targets big enough for a thumb,
// four directions and a confirm - and that model is exactly right for
// a screen whose whole job is "choose one of eight".
//
// What is NOT borrowed is the information architecture, for the same
// reason that file gives: Skyrim advances ONE of three pools, and
// Daggerfall hands you a POOL of four to six points to spread over
// EIGHT attributes (FormulaHelper.BonusPool; thirty from the Oghma
// Infinium; a priced purse under the vendored Oblivion-Remastered
// mod). A screen that offered "Magicka / Health / Stamina" would be a
// picture of another game's law.
//
// So the sky is ours: the eight attributes are one asterism - a
// figure whose stars are the things this character is made of, drawn
// on the SAME dithered night the enhanced menu already stands on
// (ui/pixelGround.js, procedural, no game data). Spending a point
// LIGHTS a star. That is the whole vision, and it is Daggerfall's own
// arithmetic underneath it.
//
// ── THE LAW IS NOT HERE, AND THAT IS THE POINT ────────────────────
// a11's law (test/advancementui.test.js): the Level++ and the health
// roll live in ONE place and never in a window. This file writes
// NOTHING - not entity.level, not entity.stats, not a pool. It is a
// READING of a live rollout screen, and every act goes back through
// that screen's own `input`:
//
//   classic / oghma  ui/charsheet.js LevelUpScreen  (statUp/statDown,
//                    applyLevelUp with the pre-rolled pool)
//   virtue           ui/virtueLevelUp.js VirtueLevelUpScreen
//                    (canRaiseAttribute ... commitVirtueLevelUp)
//
// Both are already headless state machines whose only canvas-bound
// part is `draw`, so the enhanced window is a SECOND FACE on the same
// object rather than a third rollout. That matters beyond tidiness:
// the hosts read `.done` off the screen, the dungeon's font-less
// escape reads `.isVirtueLevelUp` and `spendRemainingHeadless`, and
// the mod's three-attribute cap, its +5 ceiling and Luck's price are
// all questions only its own module can answer. A window that asked
// them itself would be the ONE DFU MEMBER, ONE EXPORT violation with
// a player's stat sheet on the other end of it.
//
// ── ASK THE LAW, NEVER RESTATE IT ─────────────────────────────────
// `canRaise` on the classic lane is not `pool > 0 && value < 100`.
// It is `statUp(value, pool)` ASKED whether it moved. The two agree
// today; a restatement is a copy that stops agreeing the day
// MAX_STAT_VALUE or the freeEdit floor moves, and the copy that draws
// the button is the one a player believes.
// ═══════════════════════════════════════════════════════════════════

import { STAT_KEYS_ORDER } from '../systems/chargen.js';
import { statUp, statDown, MAX_STAT_VALUE } from './chargen.js';
import { MUST_DISTRIBUTE_BONUS_POINTS } from './charsheet.js';
import { REMAINING_POINTS_ERROR, REMAINING_POINTS_LABEL, TAKE_ONE_BACK_HINT } from './virtueLevelUp.js';
import { attributeOffset, canRaiseAttribute, canLowerAttribute, LEVELUP_TOTAL, levelingSettings } from '../systems/oblivionLeveling.js';   // ASCEND-ANYTIME: a mod-law view still needs the mod's own prices to draw a row
import { LEVELUP_SKILL_SUM_PER_LEVEL, skillRecentlyIncreased } from '../systems/advancement.js';
import { SKILL_NAMES, skillValue } from '../systems/skills.js';
import { sheetModel } from './enhancedCharSheet.js';

/** The three shapes a level-up can wear. They are not three laws -
 *  oghma is the classic screen with `oghma` latched (AUDIT 39: a FIXED
 *  thirty, no Level++, no health roll) - but they are three different
 *  sentences to say to a player, and the window says the right one. */
export const LANE_CLASSIC = 'classic';
export const LANE_OGHMA = 'oghma';
export const LANE_VIRTUE = 'virtue';

/** DUCK-TYPED, like every other seam that asks about these two screens
 *  (scenes/dungeonContext.js's font-less escape reads `isVirtueLevelUp`
 *  for the same reason): a `instanceof` here would drag two UI classes
 *  into every caller's import graph for a type test. */
export function levelUpLane(screen) {
  if (!screen) return LANE_CLASSIC;
  if (screen.isVirtueLevelUp) return LANE_VIRTUE;
  return screen.oghma ? LANE_OGHMA : LANE_CLASSIC;
}

/** The eight, as a player reads them. The classic sheet prints
 *  three-letter heads because a 320x200 panel has no room; this window
 *  has the room for the whole word, the same call ui/virtueLevelUp.js
 *  made. */
export const attributeLabel = (k) => (k ? k.charAt(0).toUpperCase() + k.slice(1) : '');

/**
 * WHAT EACH ATTRIBUTE DOES, in one line, and every line names a
 * formula this port actually runs. The window has a description slot
 * (Skyrim's is under the skill ribbon) and the temptation is to fill
 * it with atmosphere; a sentence a player acts on has to be TRUE of
 * the code, so each of these is annotated with where it is true.
 *
 * Nothing here is a DFU string: TEXT.RSC records 0..7 are the
 * attribute descriptions the CLASSIC sheet pops (AUDIT 58,
 * ui/charsheet.js's statDescriptionTextId), and they are game data.
 * `ui/charSheetDoor.js` promises the enhanced skin "reads no ARENA2 at
 * all" and this window is behind that promise, so these are the port's
 * own words - as ui/settingsCopy.js's are.
 */
export const ATTRIBUTE_BLURB = Object.freeze({
  // combat/formulas.js:80-82 damageModifier = floor((strength - 50) / 5),
  // which calculateAttackDamage adds to every landed blow;
  // entityMaxEncumbrance over liveStat strength is the pack's ceiling.
  //
  // LV1's AUDIT CORRECTED THE SECOND CLAUSE. It read "what you can
  // carry before you stagger", and nothing in this port charges for
  // encumbrance - MAC-E established that DFU does not either ("neither
  // PlayerSpeedChanger.cs nor PlayerEntity.cs mentions encumbrance at
  // all; DFU draws the figure and never charges for it"). A window
  // that promises a penalty the game does not apply is teaching a
  // player to spend a point on nothing.
  strength: 'Adds to every blow you land, and to the weight your pack will hold.',
  // systems/chargen.js:211 - spellPoints(intelligence, multiplier) is the whole magicka pool.
  intelligence: 'Sets your pool of spell points, by your class\'s own multiplier.',
  // systems/spellcast.js:158 - `saving += magicResist(liveStat(target,
  // 'willpower'))`, the CONSUMER of DFU's MagicResist. The first cut
  // cited systems/quest/questMacros.js:543, which only PRINTS the same
  // figure for %mr, and a display is not evidence that a number does
  // anything (LV1's audit).
  willpower: 'Hardens you against magic: a tenth of it goes into every saving throw.',
  // combat/formulas.js:306-307 statsToHit = floor((your luck - theirs) / 10)
  // + floor((your agility - theirs) / 10), read INSIDE the hit roll.
  //
  // LV1's AUDIT CORRECTED THIS ONE TOO. It described `toHitModifier`
  // (:118, floor(agility/10) - 5), which is the CHARACTER SHEET's
  // display modifier - ui/chargen.js:450 and the quest macros are its
  // only readers - so "a tenth of it, less five, rides on every swing"
  // named a number that rides nothing.
  agility: 'Rides every swing: a tenth of the gap between your agility and your foe\'s.',
  // systems/chargen.js hitPointsPerLevelUp reads hitPointsModifier = floor(endurance / 10) - 5.
  endurance: 'Rolls into the health you gain at every level from here on.',
  // combat/formulas.js:828 - merchant reaction takes personality / 5; systems/court.js:435 takes it again.
  personality: 'Warms merchants, judges and anyone else weighing what you are worth.',
  // player/motor.js:470 walkSpeed(stats.speed) is how fast you move;
  // combat/weaponRig.js:386 reads liveStat speed for the swing.
  speed: 'Quickens your weapon and closes the ground between you and a fight.',
  // combat/formulas.js:306-307 again - the same term agility rides -
  // and systems/unleveledLoot.js:95, where the vendored ladder rolls
  // rarity against the player's luck, which is where a player actually
  // notices it.
  luck: 'Rides every swing beside agility - and tilts what the dead and the dungeons are carrying.',
});

/**
 * THE ASTERISM. Eight stars in a 100 x 62 box, and the lines between
 * them - port-authored art, the way ui/pixelGround.js's sky is.
 *
 * WHY AUTHORED AND NOT A RING: eight points on a circle is a dial, and
 * a dial says the eight are interchangeable stations of one wheel. An
 * asterism says they are a FIGURE - which is what a character is - and
 * it is the shape the eye reads as a constellation without being told.
 *
 * The coordinates are a picture, so they are pinned as a picture: the
 * tests hold every star inside the box, every edge on two real stars,
 * and the figure CONNECTED (no star floating off the drawing), because
 * a star with no line to it is a star a player reads as disabled.
 */
export const STAR_FIGURE = Object.freeze({
  box: Object.freeze({ w: 100, h: 62 }),
  stars: Object.freeze({
    strength: Object.freeze({ x: 10, y: 35 }),
    intelligence: Object.freeze({ x: 20, y: 16 }),
    willpower: Object.freeze({ x: 36, y: 31 }),
    agility: Object.freeze({ x: 52, y: 11 }),
    endurance: Object.freeze({ x: 27, y: 54 }),
    personality: Object.freeze({ x: 84, y: 15 }),
    speed: Object.freeze({ x: 92, y: 37 }),
    luck: Object.freeze({ x: 64, y: 51 }),
  }),
  edges: Object.freeze([
    Object.freeze(['strength', 'intelligence']),
    Object.freeze(['intelligence', 'agility']),
    Object.freeze(['agility', 'personality']),
    Object.freeze(['personality', 'speed']),
    Object.freeze(['speed', 'luck']),
    Object.freeze(['luck', 'endurance']),
    Object.freeze(['endurance', 'strength']),
    Object.freeze(['intelligence', 'willpower']),
    Object.freeze(['willpower', 'luck']),
  ]),
});

/**
 * HOW FAR APART TWO STARS MUST BE, and why the number is in the code
 * rather than in someone's eye.
 *
 * The figure is normalized and STRETCHED to whatever the stage is, so
 * the gaps shrink with the window. The first authored figure had pairs
 * fourteen units apart, which is fine at 1400x900 and is two
 * overlapping buttons on a phone - tools/levelUpProbe.mjs caught it at
 * 390x844 and again at 800x600, and a star drawn under another star is
 * a point spent on the wrong attribute.
 *
 * So the layout carries its own floor: no pair may be closer than this
 * in BOTH axes, and test/enhancedLevelUp.test.js walks all
 * twenty-eight pairs against it. The value is what a 56px-wide,
 * 44px-tall target needs at the narrowest width the window supports
 * (a 374px figure: 100 units over 374px is 3.74px a unit, so 15 units
 * is 56px), which is also why the names come off the stars under
 * 720px - a name makes the box as wide as the word.
 */
export const STAR_MIN_APART_X = 15;
export const STAR_MIN_APART_Y = 18;

/** Every pair that is too close in BOTH axes to be drawn as two
 *  separate targets. Empty is the only passing answer. */
export function crowdedStarPairs(fig = STAR_FIGURE) {
  const keys = Object.keys(fig.stars);
  const bad = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = fig.stars[keys[i]], b = fig.stars[keys[j]];
      if (Math.abs(a.x - b.x) < STAR_MIN_APART_X && Math.abs(a.y - b.y) < STAR_MIN_APART_Y) bad.push([keys[i], keys[j]]);
    }
  }
  return bad;
}

/**
 * THE EIGHT ROWS, read off whichever screen is live.
 *
 * `canRaise`/`canLower` are the LAW'S OWN ANSWER in both lanes - the
 * mod's predicates on one side, statUp/statDown asked whether they
 * moved on the other. The window draws a control only where the answer
 * is yes, which is the mod's own HIDE-DO-NOT-GREY rule
 * (player.lua:599-616) and, on the classic lane, the only honest way to
 * draw a button whose refusal is silent.
 */
/**
 * ASCEND-ANYTIME - THE SCREEN FOR A PLAYER WHO IS NOT LEVELLING.
 *
 * The Ascension was built as the answer to an EVENT: a level is owed,
 * here are your points, spend them. That made it a screen a player
 * sees for ten seconds a level and can never look at again - and it is
 * the only place in this port that draws a character as a figure in
 * the sky rather than a column of numbers.
 *
 * This is that same window with nothing to spend. It is a VIEW, and
 * the word is load-bearing: it writes NOTHING. No level, no stats, no
 * bonus pool - in particular not `pendingBonusPool`, because a view
 * that rolled one would hand a player a free re-roll of the next
 * level's 4-6 just for looking at their own stars.
 *
 * It is a plain object rather than a class because every reader here
 * already takes a duck: `pool`/`base`/`working` is the classic
 * rollout's shape and `purse`/`deltas`/`s` is the mod's, so the rows,
 * the bar and the crown all answer without a branch of their own. The
 * two pools are zero, which is what makes every star refuse - `statUp`
 * and `canRaiseAttribute` both stop at an empty pool, so nothing here
 * restates "you may not raise this".
 *
 * `confirm` closes it and does nothing else, which is why `canAscend`
 * is true from the first frame: there is nothing to finish.
 */
export function viewOnlyScreen(entity, virtue = false) {
  const e = entity ?? {};
  const stats = { ...(e.stats ?? {}) };
  return {
    /** What the crown reads to promise no level, and the window to ask
     *  its own question instead of "choose what rises". */
    viewOnly: true,
    entity: e,
    cursor: 0,
    done: false,
    // THE CLASSIC SHAPE, with an empty pool.
    pool: 0,
    base: stats,
    working: { ...stats },
    // ...and THE MOD'S, for a character who levels by its law. The
    // prices are real (a row still draws its cost) and the purse is
    // empty, which is the whole of the refusal.
    isVirtueLevelUp: virtue,
    purse: 0,
    deltas: Object.fromEntries(STAT_KEYS_ORDER.map((k) => [k, 0])),
    s: virtue ? levelingSettings() : null,
    /** Never the all-max branch: that is a thing a LEVEL-UP says about
     *  points it cannot place, and this one has none to place. */
    allMax: () => false,
    input(action) { if (action === 'confirm') this.done = true; },
  };
}

export function rolloutRows(screen) {
  if (!screen) return [];
  const virtue = levelUpLane(screen) === LANE_VIRTUE;
  return STAT_KEYS_ORDER.map((key, index) => {
    if (virtue) {
      const stats = screen.entity?.stats ?? {};
      const base = stats[key] ?? 0;
      const delta = screen.deltas?.[key] ?? 0;
      return {
        key, index, label: attributeLabel(key),
        base, value: base + delta, delta,
        cost: attributeOffset(key, screen.s),
        canRaise: canRaiseAttribute(key, stats, screen.deltas ?? {}, screen.purse ?? 0, screen.s),
        canLower: canLowerAttribute(key, screen.deltas ?? {}),
      };
    }
    const base = screen.base?.[key] ?? 0;
    const value = screen.working?.[key] ?? base;
    const pool = screen.pool ?? 0;
    return {
      key, index, label: attributeLabel(key),
      base, value, delta: value - base,
      cost: 1,
      canRaise: statUp(value, pool).working !== value,
      canLower: statDown(value, base, pool).working !== value,
    };
  });
}

/** What is left to spend, in whichever currency this lane counts in. */
export const rolloutPool = (screen) =>
  (levelUpLane(screen) === LANE_VIRTUE ? (screen?.purse ?? 0) : (screen?.pool ?? 0));

/** ...and what that currency is CALLED. The mod's own label for its
 *  side (l10n/en.yaml:36, through ui/virtueLevelUp.js), and the port's
 *  for Daggerfall's - "bonus points" is what CheckIfDoneLeveling's own
 *  refusal calls them (Internal_Strings.csv:110). */
export const poolLabel = (screen) =>
  (levelUpLane(screen) === LANE_VIRTUE ? REMAINING_POINTS_LABEL : 'Bonus points left');

/**
 * THE OK BUTTON'S GATE - and BOTH of CheckIfDoneLeveling's terms.
 *
 * `if (statsRollout.BonusPool > 0 && !PlayerEntity.Stats.IsAllMax())`
 * (DaggerfallCharacterSheetWindow.cs:437-443). The first cut of this
 * window carried the first term alone, which is a WALL: at 100 across
 * the board `statUp` refuses every press, so the pool can never reach
 * zero, and a window whose only exit tests for zero can never be left.
 * A character can also arrive with LESS ROOM THAN POOL - seven maxed
 * attributes and one at 98 against a roll of six - and the last points
 * are just as stuck. The Oghma Infinium's thirty make it likelier
 * still, on exactly the late character who would read one.
 *
 * DFU's answer is to let them out and VOID what has nowhere to go, and
 * the port's classic sheet has carried that since AUDIT 44
 * (`_workingAllMax`). `ui/charsheet.js`'s LevelUpScreen did NOT - the
 * screen the enhanced skin mounted until this slice - so this is a
 * hole closed in both faces at once, from ui/chargen.js's one home.
 *
 * THE MOD'S LANE NEEDS NO SUCH ARM and must not get one: `virtuePurse`
 * clamps the purse to what a legal spend can actually pay for (ORL1's
 * own fix for its own wall), so an all-max virtue character is minted
 * a purse of nothing and this reads zero by the first term.
 */
export const canAscend = (screen) => !!screen && (rolloutPool(screen) === 0 || allMaxed(screen));

/** DaggerfallStats.IsAllMax, asked of whichever screen is live - the
 *  classic rollout answers it from ui/chargen.js's one home, and the
 *  mod's window does not answer it at all (it has no such branch, and
 *  its purse is clamped instead). */
export const allMaxed = (screen) => typeof screen?.allMax === 'function' && screen.allMax();

/** ...and what the window SAYS on that branch, because a plate reading
 *  "5 bonus points left" over an enabled button is a screen that looks
 *  broken. The port's own words: DFU shows nothing here at all. */
export const ALL_MAX_LINE = 'Every attribute is at its maximum. What is left has nowhere to go.';

/** The refusal each lane already ships, so the window quotes rather
 *  than invents. */
export const refusalText = (screen) =>
  (levelUpLane(screen) === LANE_VIRTUE ? REMAINING_POINTS_ERROR : MUST_DISTRIBUTE_BONUS_POINTS);

/** IN A CORNER: points left and no star will take another. Only the
 *  mod's priced purse can reach that state (ui/virtueLevelUp.js's
 *  `cornered`), and its answer - take one back - is the same here. */
export function corneredHint(screen) {
  if (!screen || rolloutPool(screen) <= 0) return null;
  if (rolloutRows(screen).some((r) => r.canRaise)) return null;
  // ALL-MAX IS NOT A CORNER, and the first cut told a maxed classic
  // character to "take a point back and place it elsewhere" - an
  // instruction with no elsewhere in it, on a window that would not
  // have let them out either way. There the truth is the other line
  // and the button is open (LV1's audit).
  return allMaxed(screen) ? ALL_MAX_LINE : TAKE_ONE_BACK_HINT;
}

/**
 * THE ONE DOOR EVERY PRESS GOES THROUGH.
 *
 * Both screens select with a `cursor` over STAT_KEYS_ORDER and act on
 * the selection, so a click on a star is "select, then press" - the
 * same two moves the keyboard makes, in the same order, through the
 * same `input`. Going around it to `raise(key)` would skip the click
 * sound on one lane and the refusal latch on the other, and would put
 * a second set of rules in the window (ORL1's hover incident is what
 * two sets of rules cost: every mouse press acted on Luck).
 *
 * Returns whether anything moved, so the view can stay silent when a
 * press was refused rather than repainting a screen that did not
 * change.
 */
export function pressAt(screen, key, action) {
  const index = STAT_KEYS_ORDER.indexOf(key);
  if (!screen || index < 0) return false;
  const before = rolloutPool(screen);
  screen.cursor = index;
  screen.input(action);
  return rolloutPool(screen) !== before;
}

export const focusAt = (screen, key) => {
  const index = STAT_KEYS_ORDER.indexOf(key);
  if (!screen || index < 0) return false;
  screen.cursor = index;
  return true;
};
export const raiseAt = (screen, key) => pressAt(screen, key, 'plus');
export const lowerAt = (screen, key) => pressAt(screen, key, 'minus');

/** The key the screen's own cursor is on - the window's focus IS the
 *  screen's, so the keyboard and the pointer can never disagree about
 *  which star a press lands on. */
export const focusedKey = (screen) => STAT_KEYS_ORDER[screen?.cursor ?? 0] ?? STAT_KEYS_ORDER[0];

/** Confirm through the screen's own door, and report whether it took.
 *  A refusal is not an error: the screen latches it (`refused`) and the
 *  window prints `refusalText` under the plate. */
export function ascend(screen) {
  if (!screen) return false;
  screen.input('confirm');
  return !!screen.done;
}

/**
 * THE CROWN - name, level and race, which is Skyrim's top rail and
 * happens to be exactly the three things Daggerfall's own sheet leads
 * with (DaggerfallCharacterSheetWindow.cs:134-204's name/level rects).
 *
 * THE OGHMA ARM PROMISES NO LEVEL. applyLevelUp's oghma branch takes
 * no Level++ and no health roll (AUDIT 39), and `pendingLevel` is
 * null on that path - so a window that printed "Level 4 -> 5" over the
 * book would be lying about the one thing it is for. `to` equals
 * `from` there and the view says the book's name instead.
 */
export function levelUpCrown(entity, screen) {
  const e = entity ?? {};
  const lane = levelUpLane(screen);
  const from = e.level ?? 1;
  // ASCEND-ANYTIME: a VIEW promises no level, for the same reason the
  // Oghma arm does not - `to` is what the crown draws an arrow to, and
  // an arrow to a level that is not coming is the one lie this window
  // must not tell.
  const viewOnly = !!screen?.viewOnly;
  return {
    name: e.name ?? 'Adventurer',
    race: e.race ?? '',
    career: e.career?.name ?? '',
    lane,
    viewOnly,
    from,
    to: (viewOnly || lane === LANE_OGHMA) ? from : (e.pendingLevel ?? from + 1),
  };
}

/**
 * THE BAR UNDER THE LEVEL, which is the one number this screen can
 * show that no other screen in the port shows: how far the NEXT level
 * already is.
 *
 * Classic: PlayerEntity's own sum, through calculatePlayerLevel's
 * arithmetic - `(current - starting + 28)` is the numerator and
 * LEVELUP_SKILL_SUM_PER_LEVEL divides it, so the remainder is how far
 * into the level you stand. The divisor is IMPORTED, not typed: ORL1's
 * deep audit made that a rule, because a screen that quotes a law by
 * copying its number goes stale the day the law moves.
 *
 * Virtue: the mod's bar, out of LEVELUP_TOTAL, with what rolled over
 * (rollOverLevelProgress) named beside it.
 */
export function levelProgress(entity, screen) {
  const e = entity ?? {};
  if (levelUpLane(screen) === LANE_VIRTUE) {
    return {
      now: Math.max(0, Math.min(LEVELUP_TOTAL, e.levelProgress ?? 0)),
      max: LEVELUP_TOTAL,
      carried: e.levelRollUp ?? 0,
      label: 'Toward the next',
    };
  }
  const span = (e.currentLevelUpSkillSum ?? 0) - (e.startingLevelUpSkillSum ?? 0) + 28;
  const per = LEVELUP_SKILL_SUM_PER_LEVEL;
  return {
    now: ((span % per) + per) % per,
    max: per,
    carried: 0,
    label: 'Skill sum toward the next',
  };
}

/**
 * WHICH PART A SKILL PLAYS IN THE SUM THAT LEVELS YOU.
 *
 * PlayerEntity.SetCurrentLevelUpSkillSum, which systems/advancement.js
 * ports as `levelUpSkillSum`, is:
 *
 *     sum(primary) + sum(major) - lowest major + highest minor
 *
 * A player is never told this. It is the single most consequential
 * rule in Daggerfall's advancement and the classic sheet's four skill
 * pages do not hint at it - so the ribbon says it per skill, in the
 * one moment a player is looking directly at the consequence.
 *
 * THIS IS A SECOND READING OF ONE LAW, which the bible forbids being
 * left unpinned: test/enhancedLevelUp.test.js reconstructs
 * levelUpSkillSum from these roles alone and holds it against the
 * function itself, over generated careers. If the roles ever drift
 * from the sum, that pin fails rather than a player being taught the
 * wrong rule.
 */
export const ROLE_COUNTS = 'counts';        // every point of it is in the sum
export const ROLE_DROPPED = 'dropped';      // the lowest major, subtracted back out
export const ROLE_BEST = 'best';            // the highest minor, the only one that counts
export const ROLE_IDLE = 'idle';            // a minor that is not the best, or a misc skill

export const ROLE_NOTE = Object.freeze({
  [ROLE_COUNTS]: 'Every point counts toward your next level.',
  [ROLE_DROPPED]: 'Your weakest major - dropped from the sum until another falls behind it.',
  [ROLE_BEST]: 'Your best minor - the only minor the sum counts.',
  [ROLE_IDLE]: 'Does not count toward your next level.',
});

export function levelSumRoles(entity) {
  const e = entity ?? {};
  const c = e.career ?? {};
  // THE RAW ARRAY, deliberately - `levelUpSkillSum` reads
  // `entity.skills[id]` and nothing else, so the lowest major and the
  // highest minor have to be decided on the same numbers or the roles
  // would describe a sum the game does not compute. The ribbon prints
  // the LIVE value beside them, which is the sheet's own read.
  const value = (id) => (Array.isArray(e.skills) ? (e.skills[id] ?? 0) : 0);
  const roles = new Map();
  for (const id of c.primarySkills ?? []) roles.set(id, ROLE_COUNTS);
  const majors = [...(c.majorSkills ?? [])];
  for (const id of majors) roles.set(id, ROLE_COUNTS);
  // `- min(major)`: DFU subtracts the lowest major's whole value back
  // out, and on a tie the FIRST one at that value is the one the walk
  // held (advancement.js's `v < lowestMajor` keeps the earliest).
  if (majors.length) {
    let lowest = majors[0];
    for (const id of majors) if (value(id) < value(lowest)) lowest = id;
    roles.set(lowest, ROLE_DROPPED);
  }
  const minors = [...(c.minorSkills ?? [])];
  for (const id of minors) roles.set(id, ROLE_IDLE);
  // `+ max(minor)`: the same tie rule read the other way - `v >
  // highestMinor` keeps the earliest of equals.
  if (minors.length) {
    let best = minors[0];
    for (const id of minors) if (value(id) > value(best)) best = id;
    roles.set(best, ROLE_BEST);
  }
  return roles;
}

/**
 * THE RIBBON: Skyrim's row of skills, carrying Daggerfall's answer to
 * the question a player actually has at a level-up - WHICH OF MY
 * SKILLS DID THIS?
 *
 * `skillRecentlyIncreased` is DFU's own uint[2] mask
 * (PlayerEntity.SetSkillRecentlyIncreased, set between the raise and
 * the sum - advancement.js's raiseSkills), and it is cleared only by a
 * non-levelling close of the sheet. So at this moment it is exactly
 * the set of skills that earned the level, which is what leads the
 * ribbon.
 *
 * It can legitimately be EMPTY - the Oghma Infinium levels nothing,
 * and a save restored between the raise and the sheet carries no mask
 * - so the ribbon never depends on it: the career's own twelve are
 * always there behind the risen ones. A ribbon that could come back
 * empty would be a strip of nothing on the screen a player opens once
 * a level.
 */
export function riseRibbon(entity) {
  const e = entity ?? {};
  const c = e.career ?? {};
  const roles = levelSumRoles(e);
  const groups = new Map();
  for (const id of c.primarySkills ?? []) groups.set(id, 'Primary');
  for (const id of c.majorSkills ?? []) groups.set(id, 'Major');
  for (const id of c.minorSkills ?? []) groups.set(id, 'Minor');
  const ids = [...groups.keys()];
  // ...plus any MISCELLANEOUS skill that just rose. It is not in the
  // sum and the ribbon says so, but "Climbing rose and it did nothing
  // for your level" is a true and useful thing to learn, and a ribbon
  // that hid the skill a player had just been told about would read as
  // a bug.
  for (let id = 0; id < SKILL_NAMES.length; id++) {
    if (!groups.has(id) && skillRecentlyIncreased(e, id)) ids.push(id);
  }
  const rows = ids.map((id) => ({
    id,
    name: SKILL_NAMES[id] ?? '',
    // AUDIT 65 CV-1's read, the one sheetModel makes: GetLiveSkillValue,
    // so a lycanthrope's +30 shows here exactly as it shows there.
    value: skillValue(e, id),
    group: groups.get(id) ?? 'Miscellaneous',
    role: roles.get(id) ?? ROLE_IDLE,
    note: ROLE_NOTE[roles.get(id) ?? ROLE_IDLE],
    risen: !!skillRecentlyIncreased(e, id),
  }));
  // RISEN FIRST, then the career's own order. A sort that only ever
  // moved the risen ones keeps the rest where the sheet puts them, so
  // the ribbon is not a different list every visit.
  return rows.map((r, i) => ({ r, i }))
    .sort((a, b) => (Number(b.r.risen) - Number(a.r.risen)) || (a.i - b.i))
    .map(({ r }) => r);
}

/** The three bars along the foot, in the enhanced skin's own order and
 *  colours (the pause window's Stats page, ui/enhancedMenu.js's
 *  statsCharacter) - and out of the same `sheetModel`, so the sheet and
 *  this screen cannot disagree about a number. Fatigue is already
 *  divided by the /64 display multiplier there. */
export function levelUpVitals(entity) {
  const m = sheetModel(entity ?? {});
  return [
    { key: 'health', label: 'Health', now: m.health.now, max: m.health.max, fill: 'blood' },
    { key: 'fatigue', label: 'Fatigue', now: m.fatigue.now, max: m.fatigue.max, fill: '' },
    { key: 'magicka', label: 'Magicka', now: m.magicka.now, max: m.magicka.max, fill: 'verdigris' },
  ];
}

/** A star's brightness is its VALUE, against the same ceiling every
 *  rollout clamps to - so the figure a player sees is the character
 *  they have, and a maxed attribute is visibly a maxed attribute. */
export const starBrightness = (value) => Math.max(0, Math.min(1, (value ?? 0) / MAX_STAT_VALUE));

/**
 * WHAT MOVES UNDER A PRESS - the reading the window repaints from.
 *
 * SPLIT FROM `levelUpModel` BY LV1's AUDIT. The window painted the
 * whole model on every keystroke, which meant `riseRibbon` walking the
 * skills and `sheetModel` rebuilding gold, encumbrance, every skill
 * and the class specials eight times a second at the keyboard's repeat
 * rate - for two fields the repaint does not even read, because the
 * ribbon and the vitals are built ONCE at mount and nothing in a
 * level-up moves them.
 */
export function levelUpFrame(entity, screen, refused = false) {
  return {
    lane: levelUpLane(screen),
    crown: levelUpCrown(entity, screen),
    progress: levelProgress(entity, screen),
    pool: rolloutPool(screen),
    poolLabel: poolLabel(screen),
    rows: rolloutRows(screen),
    focus: focusedKey(screen),
    canAscend: canAscend(screen),
    // BOTH LATCHES. The mod's screen keeps `refused` itself
    // (player.lua:532-552); the classic rollout has no latch at all -
    // `input('confirm')` with a pool left simply does nothing - so the
    // window carries that half and hands it in. Without this arm the
    // enhanced skin's OK button would refuse a classic level-up in
    // total silence, which is the defect ui/enhancedChunk.js's whole
    // header is about.
    refusal: (refused || screen?.refused) ? refusalText(screen) : null,
    cornered: corneredHint(screen),
  };
}

/** THE WHOLE WINDOW, as data - the frame plus the two bands that are
 *  read once at mount. Pure, so the pins can drive every state this
 *  screen can be in without a DOM. */
export function levelUpModel(entity, screen, refused = false) {
  return {
    ...levelUpFrame(entity, screen, refused),
    ribbon: riseRibbon(entity),
    vitals: levelUpVitals(entity),
  };
}
