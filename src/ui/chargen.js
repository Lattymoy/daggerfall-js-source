// Character-creation UI (UI arc, U2b). The flow that retires the
// Warrior-16 default and the lowest-first pool policy: name ->
// gender -> class -> stats -> skills -> done, with the pool
// distribution rules VERBATIM from DFU StatsRollout/SkillsRollout:
//   stats:  + blocked at MaxStatValue (100) or pool 0;
//           - blocked at the ROLLED value (points return to pool)
//   skills: + blocked at group pool 0 (no upper clamp);
//           - blocked at the ROLLED value
// Both screens offer REROLL, exactly the rollout components' own.
// U10: the screens draw as the REAL classic windows (ui/chargenArt.js
// over the U8a native panel) - the clean-text panels below are the
// art-less fallback now, not the plan - the note this file carried
// about unverified art names shipped out with them.

import { rollStats, rollSkills, STAT_KEYS_ORDER, spellPoints, spellPointMultiplier } from '../systems/chargen.js';
import { QUESTION_COUNT, NO_CLASS_INDEX, displayQuestion, pickQuestionIndices, answerWeightIndex, resolveClassIndex } from '../systems/classQuestions.js';   // U18
import { HP_MIN, HP_MAX, HP_DEFAULT, DIFFICULTY_MIN, DIFFICULTY_MAX, FREE_EDIT_MIN, FREE_EDIT_MAX, STAT_DEFAULT, difficultyPoints, availableSkills, buildCustomCareer, classAffinityIndex, repClick, repPointsToDistribute, HELP_TOPICS } from '../systems/customClass.js';   // U20a
import { damageModifier, maxEncumbrance, magicResist, toHitModifier, hitPointsModifier, healingRateModifier } from '../combat/formulas.js';   // U10: the derived block
import { tagEffect, biographySkillBonuses, digestRepChanges } from '../systems/biography.js';   // S3e
import { fullName, getNameBank, GENDERS } from '../characters/nameHelper.js';   // U15
import { srand } from '../formats/dfRandom.js';   // AUDIT 17j F1: the name screen's reseed
import { buildBackstory, repBoxRows, bonusPointsRows } from './chargenArt.js';   // U13 / U16
import { RACE_TEMPLATES, FACES_PER_RACE } from '../systems/races.js';   // S3c/U9
import { SKILL_NAMES } from '../systems/skills.js';
import { drawText, measureText } from './text.js';
import { nativeMetrics } from './nativePanel.js';
import { chargenArtLoaded, drawChargenNative, loadFaceSet, chargenHit, raceDescriptionLines, classDescriptionLines, textRecordLines, DOUBLE_CLICK_DELAY_MS, CLASS_LIST_ROWS, PLAYER_REFLEXES, REFLEX_COUNT, QUESTION_ROW_H, QSCROLL_H, QSCROLL_TEXT_OFFSET, QSCROLL_FRAMES } from './chargenArt.js';   // U10 / U17 / U18 / U20a

export const MAX_STAT_VALUE = 100;   // FormulaHelper.MaxStatValue

// ---- the verbatim pool rules (pure, tested) ----
export function statUp(working, pool) {
  if (working === MAX_STAT_VALUE || pool === 0) return { working, pool };
  return { working: working + 1, pool: pool - 1 };
}
export function statDown(working, rolled, pool) {
  if (working === rolled || working === 0) return { working, pool };   // minWorkingValue 0 is the freeEdit floor
  return { working: working - 1, pool: pool + 1 };
}
export function skillUp(working, pool) {
  if (pool === 0) return { working, pool };
  return { working: working + 1, pool: pool - 1 };
}
export function skillDown(working, rolled, pool) {
  if (working === rolled) return { working, pool };
  return { working: working - 1, pool: pool + 1 };
}

// S3c/U9: RACE and FACE join the flow between gender and class -
// classic asks race first. (The Breton-male-face-0 hardcode this
// retired, and U10's blind face index, are both gone.)
// S3e: BIOGRAPHY sits immediately after the class choice, which is
// where DFU's wizard puts it (WizardStages: ...SelectClassFromList,
// SelectBiographyMethod, BiographyQuestions, SelectName...). (The
// order flag this note carried retired with U15 - the whole wizard
// runs the classic sequence now; the stale sentence deleted at U18.) What matters for the effects is the
// RELATIVE position - biography before the bonus-skill screen, so its
// bonuses show while the player distributes.
// U13: REFLEXES closes the flow, where DFU's wizard also puts it
// (SelectReflexes sits after AddBonusSkills, before the Summary).
// U15: THE CLASSIC WIZARD ORDER. DFU's StartNewGameWizard runs
// SelectRace, SelectGender, SelectClass*, BiographyQuestions,
// SelectName, SelectFace, AddBonusStats, AddBonusSkills,
// SelectReflexes (DaggerfallStartNewGameWizard.cs, WizardStages:63-79). The port asked the NAME first
// and the face early, which was flagged from S3c on and was finally
// forced by the random-name button: CreateCharNameSelect DISABLES it
// without a race template (:112-119), so the name screen cannot come
// before the race and still be classic.
// U18: SelectClassMethod and GenerateClass join between gender and
// the list - the wizard's enum has always named them (:67-68), the
// port just went straight to SelectClassFromList. classQuestions is
// only reachable through the method screen, exactly as GenerateClass
// is only reachable through ChooseClassGen_OnClose's ChoseGenerate arm.
// U19: SelectBiographyMethod joins between the class choice and the
// questions - the LAST stage the enum named that the port skipped.
// Every class-accept arm goes to SetChooseBioWindow (:344/:365/:401),
// and the name screen's cancel returns THERE (:483-493), not to the
// questions the port had collapsed it onto.
// U20a: CustomClassBuilder joins behind the list's Custom row - with
// it, every stage in the enum exists.
const STATES = ['race', 'gender', 'classMethod', 'classQuestions', 'class', 'customClass', 'bioMethod', 'biography', 'name', 'face', 'stats', 'skills', 'reflexes', 'summary', 'done'];

/** AUDIT 17j F5: the port capped the typed name at 16. DFU's name
 *  box is a plain TextBox and CreateCharNameSelect never sets
 *  MaxCharacters, so it keeps the class default of 31
 *  (TextBox.cs:26). Sixteen cut real names short - and the RANDOM
 *  button, which assigns rather than types, could already mint a
 *  name the player was then unable to retype. */
export const NAME_MAX_CHARACTERS = 31;

export class ChargenFlow {
  /** careers: [{ name, career }] x18 (loaded from CLASS*.CFG). */
  constructor(careers, rolls = Math.random) {
    this.careers = careers;
    this.rolls = rolls;
    this.state = 'race';
    this.name = '';
    this.gender = 'male';
    this.raceIndex = 0;      // RACE_TEMPLATES order (Breton first)
    this.faceIndex = 0;      // 0..9 within the race/gender FACE CIF
    this.classIndex = 0;
    this.classScroll = 0;      // AUDIT 17g F6: the list's own scroll index
    // S3e: the biography screen's state. biogFor is the question-set
    // source (the host loads BIOG<class>T0.TXT); null until it does,
    // and the screen is skipped rather than blocking the flow.
    this.biogFor = null;
    this.biogQuestionIndex = 0;
    this.biographyEffects = [];
    // U13: PlayerReflexes.Average is the picker's own starting value
    // (ReflexPicker.cs:98), and the two consumers - the melee timer
    // and the monster multi-attack gate - were already reading it.
    this.reflexes = PLAYER_REFLEXES.Average;
    this.backStory = [];        // U13: the composed biography prose
    this.repChanges = null;     // and the per-group totals it changed
    this.biogRepBox = null;     // the open reputation box, if any
    this.raceConfirm = null;   // U11: the open race-description box, if any
    this.classConfirm = null;  // U17: and the open CLASS-description box
    this._lastClassClick = null;   // the ListBox double-click clock
    // U18: the class-METHOD screen (CreateCharChooseClassGen). Classic
    // has no keyboard here - two mouse buttons - so the cursor is the
    // port's up/down seam over them: 0 = choose from a list (the top
    // button), 1 = answer questions (the bottom one).
    this.methodCursor = 0;
    // U19: the biography-METHOD screen (CreateCharChooseBio) - 0 =
    // have the history generated (the top button), 1 = answer the
    // questions (the bottom one).
    this.bioMethodCursor = 0;
    // U20a: the custom-class BUILDER. custom is the screen's working
    // state (null until entered); customCareer survives it - the
    // built DFCareer the career getter serves once the builder exits.
    this.custom = null;
    this.customCareer = null;
    this.customReps = null;   // [commoners, merchants, scholars, nobility, underworld]
    this.isCustom = false;
    // U18: the class QUESTIONS screen (CreateCharClassQuestions).
    // questionLibrary (the 40 parsed TEXT.RSC 9000 questions) and
    // classesData (CLASSES.DAT's bytes) are attached by
    // createChargenFlow - THE ONE CONSTRUCTION SEAM - and null until
    // it does; without either, the questions arm falls to the list.
    this.questionLibrary = null;
    this.classesData = null;
    this.qIndices = null;      // the ten picked library indices
    this.qAnswered = 0;        // questionsAnswered
    this.qWeights = [0, 0, 0]; // [warrior, rogue, mage] (:66)
    this.qClassIndex = NO_CLASS_INDEX;
    this.qConfirm = null;      // the open class-description Yes/No box
    this.qDisplay = null;      // displayQuestion() of the question on screen
    this.qLabelY = QSCROLL_TEXT_OFFSET;   // questionLabel.Position.y within the scroll
    this.qScrollFrame = 0;     // which SCRL frame the parchment shows
    // AUDIT 17g F5: the description source, so BOTH the click and the
    // keyboard confirm open the same box. Null until the art loads.
    this.describeRace = (race) => raceDescriptionLines(race);
    // U17: the same shape for the CLASS description box, so the pins
    // can drive it without the art the way the race box's can.
    this.describeClass = (i) => classDescriptionLines(i);
    // U20a: and a bare TEXT.RSC record source for the builder's
    // refusal boxes (301/300/302/306 + the rep window's 303).
    this.describeText = (id) => textRecordLines(id);
    this.cursor = 0;          // the BIOGRAPHY screen's answer cursor
    // U16: StatsRollout and SkillsRollout are two INDEPENDENT DFU
    // components with a selection each. One shared cursor was fine
    // while they were separate screens; the summary draws both at
    // once, and a click on a skill would have moved the stat spinner.
    this.statCursor = 0;
    this.skillCursor = 0;
    // U17: SkillsRollout carries THREE LeftRightSpinners, one per
    // group, each with its OWN selected skill and its own remaining
    // pool (SkillsRollout.cs:44-46, 240-262, 356-372). The port drew a
    // single spinner on one shared row, so two of the three pools were
    // invisible until the cursor happened to walk into them. The flat
    // skillCursor stays as the keyboard's walk over all nine rows -
    // classic has no keyboard here at all - and moving it keeps the
    // group selection underneath it in step.
    this.skillSel = { primary: 0, major: 0, minor: 0 };
    this._rolled = null;
    // AUDIT 17j F1/F4: DFU's `new System.Random().Next()` is an
    // ENGINE PRNG draw (Ledger A), so it rides Math.random here, and
    // the range is System.Random.Next()'s [0, int.MaxValue).
    this.seedRandom = () => Math.floor(Math.random() * 0x7fffffff);
    // the race and gender the name box was last filled under - null
    // until the first push, because DFU's first assignment cannot clear
    this._nameRaceId = null;
    this._nameGender = null;
    // U16: the open "you must distribute your bonus points" box.
    this.summaryPoolBox = null;
  }

  /** U20a: a finished custom class OVERRIDES the list - classIndex
   *  then holds the AFFINITY index (the biography quiz's), exactly as
   *  DFU's characterDocument carries career + classIndex separately.
   *  NULL while the CUSTOM ROW is merely highlighted: that row has no
   *  career behind it (DFU's selectedClass is null there, :74), and
   *  the raw index read THREW - the live probe caught it the moment
   *  the arrow walk landed on the row. */
  get career() { return this.customCareer ?? this.careers[this.classIndex]?.career ?? null; }
  get race() { return RACE_TEMPLATES[this.raceIndex]; }

  /** AUDIT 17j F7: these REROLLED on every entry, so walking back a
   *  screen and forward again threw away the roll AND everything the
   *  player had spent from the pool. DFU keeps both.
   *
   *  SetAddBonusStatsWindow (:227-246) constructs the window once and
   *  calls Reroll() then; on every later push it rerolls only `if
   *  (createCharAddBonusStatsWindow.DFClass != characterDocument.
   *  career)`. SetAddBonusSkillsWindow (:249-259) passes
   *  `!skillsNeedReroll` as isRestored, and CreateCharAddBonusSkills.
   *  SetCharacterDocument (:59-74) then RESTORES the document's
   *  starting and working skills rather than rolling; skillsNeedReroll
   *  is raised only by SetChooseBioWindow, which the flow reaches
   *  exactly when a class has just been chosen.
   *
   *  Both rules reduce to the same one: reroll when the CLASS changed,
   *  otherwise restore. `force` is the explicit Reroll button, which
   *  rerolls regardless. */
  _enterStats(force = false) {
    // U20a: the memo keys on the CAREER, not its index. DFU compares
    // `createCharAddBonusStatsWindow.DFClass != characterDocument.career`
    // (:238) - an object comparison. Keying on classIndex was
    // equivalent while every class came from the list, but a CUSTOM
    // class carries the AFFINITY index, so a custom whose affinity
    // matched the previously rolled class restored that class's roll
    // instead of rolling for the new career.
    if (!force && this.rolledStats && this._statsCareer === this.career) { this.statCursor = 0; return; }
    const { stats, bonusPool } = rollStats(this.career, this.rolls);
    this.rolledStats = { ...stats };
    this.stats = { ...stats };
    this.statPool = bonusPool;
    this._statsCareer = this.career;
    this.statCursor = 0;
  }

  _enterSkills(force = false) {
    if (!force && this.rolledSkills && this._skillsCareer === this.career) { this.skillCursor = 0; return; }
    const { skills, groupPools } = rollSkills(this.career, this.rolls);
    this.rolledSkills = [...skills];
    this.skills = [...skills];
    this.pools = { ...groupPools };
    this._skillsCareer = this.career;
    this.skillCursor = 0;
    this.skillSel = { primary: 0, major: 0, minor: 0 };   // SelectPrimarySkill(0) and its two siblings
  }

  /** The three skill-screen rows in career order: [groupName, ids[]]. */
  skillRows() {
    const c = this.career;
    return [
      ['primary', c.primarySkills],
      ['major', c.majorSkills],
      ['minor', c.minorSkills],
    ];
  }

  _skillAt(cursor) {
    let i = cursor;
    for (const [group, ids] of this.skillRows()) {
      if (i < ids.length) return { group, id: ids[i], indexInGroup: i };
      i -= ids.length;
    }
    return null;
  }

  /** U10: the seven derived values CHAR02I0's right column shows
   *  (CreateCharAddBonusStats.cs:94-100), each through the
   *  FormulaHelper home. Signed modifiers print with their sign, as
   *  DFU's labels do. */
  derived() {
    if (!this.stats) return null;
    const st = this.stats;
    const sign = (n) => (n >= 0 ? `+${n}` : String(n));
    const mult = spellPointMultiplier(this.career.abilityFlagsAndSpellPointsBitfield ?? 0x1000);
    return {
      damage: sign(damageModifier(st.strength)),
      encumbrance: String(maxEncumbrance(st.strength)),
      spellPoints: String(spellPoints(st.intelligence, mult)),
      magicResist: String(magicResist(st.willpower)),
      toHit: sign(toHitModifier(st.agility)),
      hitPoints: sign(hitPointsModifier(st.endurance)),
      healingRate: sign(healingRateModifier(st.endurance)),
    };
  }

  /** AUDIT 17g F6: ListBox scrolls MINIMALLY on a selection move -
   *  SelectPrevious only pulls the window up when the selection falls
   *  above it, SelectNext only pushes it down when the selection falls
   *  below (ListBox.cs:709-730). The port recomputed a CENTRED window
   *  at draw time, so the whole list jumped on every arrow and the
   *  selection never sat anywhere but the middle. */
  _scrollToClass(rows = CLASS_LIST_ROWS) {
    const n = this.classRowCount();
    const max = Math.max(0, n - rows);
    if (this.classIndex < this.classScroll) this.classScroll = this.classIndex;
    else if (this.classIndex >= this.classScroll + rows) this.classScroll = this.classIndex - rows + 1;
    this.classScroll = Math.max(0, Math.min(max, this.classScroll));
  }

  /** U20a: the list's LAST row is Custom (CreateCharClassSelect
   *  :66-67 appends it after the eighteen CLASS*.CFG rows). */
  classRowCount() { return this.careers.length + 1; }
  classRowName(i) { return this.careers[i]?.name ?? 'Custom'; }

  /** S3e / U19: the class choice leads into the biography METHOD
   *  screen when its question file loaded (every accept arm calls
   *  SetChooseBioWindow), and straight to the name when it did not
   *  (never trap - DFU would throw on the missing file). */
  _leaveClass() {
    if (this.biogFor?.(this.classIndex)?.questions?.length) this._enterBioMethod();
    else this._leaveBiography();   // U15: -> name, the classic next screen
  }

  /** U18: GenderSelectWindow_OnClose's accept arm goes to
   *  SetChooseClassGenWindow (DaggerfallStartNewGameWizard.cs:305-316),
   *  not straight to the list. The window is CONSTRUCTED fresh on
   *  every arrival (:142-148 has no null guard, unlike the reused
   *  windows), so the cursor resets. */
  _enterClassMethod() {
    this.methodCursor = 0;
    this.state = 'classMethod';
  }

  /** U18: SetClassQuestionsWindow (:150-156) - also constructed fresh
   *  every time, so re-entry rolls NEW questions and zeroed weights.
   *  Without the library or CLASSES.DAT the screen cannot resolve a
   *  class; DFU throws, the port logs loudly and falls to the list
   *  (the crash-class doctrine). */
  _enterClassQuestions() {
    if (!this.questionLibrary?.length || !this.classesData) {
      console.warn('[chargen] TEXT.RSC 9000 / CLASSES.DAT unavailable; the questions path falls to the class list');
      this.state = 'class';
      return;
    }
    this.qIndices = pickQuestionIndices(this.questionLibrary.length, this.rolls);
    this.qAnswered = 0;
    this.qWeights = [0, 0, 0];
    this.qClassIndex = NO_CLASS_INDEX;
    this.qConfirm = null;
    this._displayClassQuestion();
    this.state = 'classQuestions';
  }

  /** DisplayQuestion (:255-289): the question on screen, the scroll
   *  rewound to frame 0 and the label back at the top offset. */
  _displayClassQuestion() {
    this.qDisplay = displayQuestion(this.questionLibrary[this.qIndices[this.qAnswered]]);
    this.qLabelY = QSCROLL_TEXT_OFFSET;
    this.qScrollFrame = 0;
  }

  /** The scroll law (NativePanel_OnMouseScrollDown/Up :432-450 and the
   *  click-scroll in Update :189-204, one pixel per step): scrolling
   *  down is allowed while the label's bottom hangs below the text
   *  window, up while its top has been pushed above the offset. The
   *  parchment frame advances WITH the text, wrapping over all 16. */
  scrollQuestion(dir) {
    const labelH = (this.qDisplay?.lines.length ?? 0) * QUESTION_ROW_H;
    if (dir > 0 && this.qLabelY + labelH > QSCROLL_H - QSCROLL_TEXT_OFFSET) {
      this.qScrollFrame = (this.qScrollFrame + 1) % QSCROLL_FRAMES;
      this.qLabelY -= 1;
    } else if (dir < 0 && this.qLabelY < QSCROLL_TEXT_OFFSET) {
      this.qScrollFrame = this.qScrollFrame - 1 < 0 ? QSCROLL_FRAMES - 1 : this.qScrollFrame - 1;
      this.qLabelY += 1;
    }
  }

  /** AnswerAndPlayAnim (:310-354), minus the FLC constellation anims
   *  (FLAGGED - the port has no FLIC decoder yet, so the next question
   *  shows immediately where DFU waits for the CEL to finish; the
   *  palette brightening itself is live, see constellationBlues).
   *  choice: 0 a, 1 b, 2 c. */
  answerClassQuestion(choice) {
    if (this.state !== 'classQuestions' || this.qConfirm || this.qAnswered === QUESTION_COUNT) return false;
    const weightIndex = answerWeightIndex(this.qIndices[this.qAnswered], choice);
    this.qWeights[weightIndex]++;
    if (this.qAnswered === QUESTION_COUNT - 1) {   // final question answered
      const idx = resolveClassIndex(this.classesData, this.qWeights);
      if (idx === null) {
        // DFU throws "could not find a results match" - corrupt file
        console.warn('[chargen] CLASSES.DAT results walk found no match', this.qWeights);
        this.qClassIndex = NO_CLASS_INDEX;
      } else this.qClassIndex = idx;
    }
    this.qAnswered++;
    if (this.qAnswered === QUESTION_COUNT) this._endClassQuestions();
    else this._displayClassQuestion();
    return true;
  }

  /** EndQuestions (:400-413): the background and scroll blank and the
   *  class's DESCRIPTION opens in a Yes/No box on TEXT.RSC 2100 +
   *  index - the same describeClass source the list's pick uses. A
   *  failed results walk, or artless describeClass, closes the screen
   *  the way its box would. */
  _endClassQuestions() {
    if (this.qClassIndex === NO_CLASS_INDEX) { this.state = 'class'; return; }
    this.qConfirm = this.describeClass?.(this.qClassIndex) ?? null;
    if (!this.qConfirm) this._acceptQuestionClass();   // no description available: the pick stands
  }

  /** ConfirmDialog Yes (:424-430) + the wizard's OnClose accept arm
   *  (:330-350): the generated index becomes the character's class -
   *  the careers array is CLASS00..17.CFG in file order, which is
   *  exactly the "CLASS" + classIndex + ".CFG" load - and the flow
   *  moves to the biography, as SetChooseBioWindow does. */
  _acceptQuestionClass() {
    this.qConfirm = null;
    this.classIndex = this.qClassIndex;
    this._scrollToClass();
    this._acceptStandardClass();
  }

  /** ConfirmDialog No: classIndex = noClassIndex, both windows close,
   *  and the wizard's OnClose falls to SetClassSelectWindow. */
  _cancelQuestionClass() {
    this.qConfirm = null;
    this.qClassIndex = NO_CLASS_INDEX;
    this.state = 'class';
  }

  /** U20a: accepting a STANDARD class replaces the career, exactly as
   *  ClassSelectWindow_OnClose's else arm does (:363-364) - the
   *  document's career becomes the list's class, so the getter serves
   *  it again.
   *
   *  What it does NOT do is clear `isCustom` or the reputations,
   *  BECAUSE DFU NEVER DOES. `isCustom` is assigned in exactly one
   *  place in the whole codebase - `= true` on the Custom row
   *  (:358) - and the five reputation fields only in the builder's
   *  own accept arm (:385-389). So opening the builder, cancelling
   *  out of it, and then picking a standard class leaves a document
   *  that still says CUSTOM: ItemHelper.cs:1310 gives it the custom
   *  starting kit, and StartGameBehaviour.cs:804-809 routes it
   *  through the custom spell rule (a Mage picked that way gets the
   *  SPELLSWORD set, not the Mage set). Ported bug-for-bug and
   *  recorded in the Ledger; the earlier draft "tidied" it and was
   *  wrong to. */
  _acceptStandardClass() {
    this.customCareer = null;
    this._leaveClass();
  }

  /** U20a: SetCustomClassWindow (:170-176) - constructed FRESH every
   *  time, like the other one-shot windows: HP at the default, no
   *  skills chosen, every attribute at the DaggerfallStats default 50
   *  with an untouched zero pool (the freeEdit ledger), reps flat. */
  _enterCustomClass() {
    this.custom = {
      className: '',
      hp: HP_DEFAULT,
      skills: Array(12).fill(null),   // 0-2 primary, 3-5 major, 6-11 minor
      stats: Object.fromEntries(STAT_KEYS_ORDER.map((k) => [k, STAT_DEFAULT])),
      statPool: 0,
      statCursor: 0,
      reps: { merchants: 0, peasants: 0, scholars: 0, nobility: 0, underworld: 0 },
      sub: null,        // null | 'skillPick' | 'help' | 'rep'
      pickSlot: null,   // which of the twelve buttons opened the picker
      pickCursor: 0,
      pickScroll: 0,
      box: null,        // the open refusal/help box's rows (ClickAnywhereToClose)
    };
    this.state = 'customClass';
  }

  /** The builder's difficulty tally - U20b's advantage/disadvantage
   *  adjustments join here when that window ships. */
  customDifficulty() { return difficultyPoints(this.custom?.hp ?? HP_DEFAULT); }

  /** The freeEdit spinner (StatsRollout.cs:231-276): value clamped to
   *  10..75, the POOL free to go negative - it is a zero-sum ledger,
   *  and the exit gate is what demands the balance. */
  customSpendStat(delta) {
    const c = this.custom;
    const key = STAT_KEYS_ORDER[c.statCursor];
    if (delta > 0 && c.stats[key] < FREE_EDIT_MAX) { c.stats[key]++; c.statPool--; }
    else if (delta < 0 && c.stats[key] > FREE_EDIT_MIN) { c.stats[key]--; c.statPool++; }
  }

  /** HitPointsUp/DownButton (:346-364): 4..30, one per click. */
  customHp(delta) {
    const c = this.custom;
    c.hp = Math.max(HP_MIN, Math.min(HP_MAX, c.hp + delta));
  }

  /** skillButton_OnMouseClick (:283-293): the picker lists every
   *  skill NOT already on a button, alphabetical. */
  customOpenSkillPick(slot) {
    const c = this.custom;
    c.sub = 'skillPick';
    c.pickSlot = slot;
    c.pickItems = availableSkills(c.skills);
    c.pickCursor = 0;
    c.pickScroll = 0;
  }

  /** SkillPicker_OnItemPicked (:295-344): the pick lands on the slot,
   *  the replaced skill returns to the pool (the list re-sorts on the
   *  next open - availableSkills derives it). */
  customPickSkill(index) {
    const c = this.custom;
    const id = c.pickItems?.[index];
    if (id == null) return;
    c.skills[c.pickSlot] = id;
    c.sub = null;
  }

  /** ExitButton_OnMouseClick (:414-460) - the four refusal gates in
   *  DFU's order, each a ClickAnywhereToClose box: no name (301), a
   *  skill unset (300), an unbalanced stat pool (302), the dagger in
   *  the red (306). Passing them builds the career and follows the
   *  wizard's accept arm (:374-401): the name onto the career, the
   *  AFFINITY index onto classIndex for the biography quiz, the reps
   *  onto the document, and SetChooseBioWindow. */
  customExit() {
    const c = this.custom;
    const box = (id) => { c.box = this.describeText?.(id) ?? [{ text: `TEXT.RSC ${id}`, center: true }]; };
    if (!c.className.length) { box(301); return; }
    if (c.skills.some((s) => s == null)) { box(300); return; }
    if (c.statPool !== 0) { box(302); return; }
    const dp = this.customDifficulty();
    if (dp < DIFFICULTY_MIN || dp > DIFFICULTY_MAX) { box(306); return; }
    this.customCareer = buildCustomCareer({ name: c.className, hp: c.hp, skills: c.skills, stats: c.stats });
    this.classIndex = classAffinityIndex(c.skills, this.careers);
    this._scrollToClass();
    // document.reputation* in sGroupReputations order: commoners (the
    // window's PEASANTS column), merchants, scholars, nobility,
    // underworld (PlayerEntity.AssignCharacter :844-848)
    this.customReps = [c.reps.peasants, c.reps.merchants, c.reps.scholars, c.reps.nobility, c.reps.underworld];
    this._leaveClass();
  }

  /** The reputation window's own exit gate (:186-198): the balance
   *  must be zero (TEXT.RSC 303) or the window stays. */
  customRepExit() {
    const c = this.custom;
    // the gate reads the WINDOW'S field, not a fresh sum - see the
    // customRep arm for why that difference is load-bearing
    if ((c.repPoints ?? 0) !== 0) { c.box = this.describeText?.(303) ?? [{ text: 'TEXT.RSC 303', center: true }]; return; }
    c.sub = null;
  }

  /** U20a follow-up: a DaggerfallListPickerWindow raises OnItemPicked
   *  from `listBox.OnUseSelectedItem` (:84,136-148) - the DOUBLE-click
   *  door, exactly as the class list's picker does (U17). The
   *  extracted picker carried the geometry but not the gesture law,
   *  so the builder's skill and help pickers committed on a SINGLE
   *  click. One click selects; two pick. */
  clickPickRow(idx, now) {
    const c = this.custom;
    if (!c) return false;
    const wasDouble = c._lastPickClick != null && (now - c._lastPickClick) < DOUBLE_CLICK_DELAY_MS;
    c.pickCursor = idx;
    this._scrollPick(c.sub === 'help' ? HELP_TOPICS.length : (c.pickItems?.length ?? 0));
    c._lastPickClick = now;
    if (!wasDouble) return true;
    c._lastPickClick = null;
    this.usePickRow(idx);
    return true;
  }

  /** The picker's OnItemPicked handlers (:295-344 for skills,
   *  :376-384 for help): the skill lands on the slot that opened the
   *  picker; a help topic closes the picker and shows its TEXT.RSC
   *  record as a ClickAnywhereToClose box. */
  usePickRow(idx) {
    const c = this.custom;
    if (c.sub === 'skillPick') this.customPickSkill(idx);
    else if (c.sub === 'help') {
      const t = HELP_TOPICS[idx];
      if (t) { c.sub = null; c.box = this.describeText?.(t[1]) ?? [{ text: `TEXT.RSC ${t[1]}`, center: true }]; }
    }
  }

  /** The pick list's minimal scroll (the ListBox law the class list
   *  already carries). */
  _scrollPick(n = this.custom?.pickItems?.length ?? 0) {
    const c = this.custom;
    const rows = CLASS_LIST_ROWS;
    const max = Math.max(0, n - rows);
    if (c.pickCursor < c.pickScroll) c.pickScroll = c.pickCursor;
    else if (c.pickCursor >= c.pickScroll + rows) c.pickScroll = c.pickCursor - rows + 1;
    c.pickScroll = Math.max(0, Math.min(max, c.pickScroll));
  }

  /** The three constellations' palette blues - 8 at rest, +24 per
   *  answer on that path (rogueBlue/mageBlue/warriorBlue start 8,
   *  constellationBrightnessIncrement = 24, :48-58,336-350), written
   *  to palette indices 192/160/128 by the draw. Same order as
   *  qWeights: [warrior, rogue, mage]. */
  constellationBlues() { return this.qWeights.map((w) => 8 + 24 * w); }

  /** U16 / THE ONE CONSTRUCTION SEAM: every path into the biography
   *  screen resets it here. DFU never REUSES that window - both
   *  SetBiographyWindow and SetChooseBioWindow `new` a fresh
   *  CreateCharBiography over a fresh BiogFile every time - so every
   *  arrival starts from no answers. AUDIT 17j F3 put the reset on the
   *  NAME screen's cancel, which was the only arrival that existed
   *  then; the summary's RESTART button is a second one, and it would
   *  have walked back through the questions with the previous run's
   *  effects still in the list, applying every one of them twice. */
  _enterBiography() {
    this._resetBiography();
    this.state = 'biography';
  }

  /** U19: the reset half, shared with the AUTO path - both arms of
   *  SetChooseBioWindow construct over a fresh BiogFile. */
  _resetBiography() {
    this.biogQuestionIndex = 0;
    this.cursor = 0;
    this.biographyEffects = [];
    this.backStory = [];
    this.repChanges = null;
    this.biogRepBox = null;
  }

  /** U19: SetChooseBioWindow (DaggerfallStartNewGameWizard.cs:178-186)
   *  - every class-accept arm lands here, and the window is
   *  CONSTRUCTED fresh each time (:180), so the cursor resets. (Its
   *  other side effect, skillsNeedReroll = true, reduces to the
   *  port's reroll-when-the-class-changed rule - the 17j F7 read.) */
  _enterBioMethod() {
    this.bioMethodCursor = 0;
    this.state = 'bioMethod';
  }

  /** U19: the GENERATE arm (CreateCharChooseBioWindow_OnClose
   *  :427-452): a fresh BiogFile, every question answered at
   *  rand.Next(0, answers.Count) - `new System.Random(...)` is an
   *  engine PRNG (Ledger A), so it rides the flow's injectable rolls -
   *  each answer's effects added exactly as AddEffect does, then
   *  DigestRepChanges and the ClickAnywhereToClose reputation box.
   *  The box shows over THIS screen (the message box is pushed over
   *  createCharChooseBioWindow, :444), and closing it goes to the
   *  name screen (ReputationBox_OnClose :464-467). */
  _autoBiography() {
    const b = this.biogFor?.(this.classIndex);
    if (!b?.questions?.length) { this._leaveBiography(); return; }
    this._resetBiography();
    for (let i = 0; i < b.questions.length; i++) {
      const answers = b.questions[i].answers;
      const index = Math.floor(this.rolls() * answers.length);   // rand.Next(0, Count)
      for (const e of answers[index].effects) this.biographyEffects.push(tagEffect(e, i));
    }
    this._finishBiography();   // no box rows (artless) -> straight to the name
  }

  /** U13 / U19: the biography's closing tail, shared by the LAST
   *  manual answer and the auto path - the backstory composes, the
   *  per-group totals digest, and the TEXT.RSC 35 box pops; without
   *  box rows the screen simply ends. */
  _finishBiography() {
    const b = this.biogFor(this.classIndex);
    this.backStory = buildBackstory?.(b.backstoryId, this.biographyEffects) ?? [];
    this.repChanges = digestRepChanges(this.biographyEffects);
    this.biogRepBox = repBoxRows?.(this.repChanges) ?? null;
    if (!this.biogRepBox?.length) this._leaveBiography();
  }

  _leaveBiography() { this._enterName(); }

  /** AUDIT 17j F1: SetNameSelectWindow pushes the name window, whose
   *  OnPush runs ShowRandomButton - and ShowRandomButton RESEEDS the
   *  shared DFRandom stream from a fresh System.Random
   *  (CreateCharNameSelect.cs:123-126, "better than starting with a
   *  seed of 0 every time"). The port never did, and DFRandom is a
   *  global whose last srand at chargen is the dungeon's locationId,
   *  so the RANDOM button handed every character of a given race and
   *  gender the SAME name on every boot. seedRandom is injectable for
   *  the pins, the Ledger A engine-PRNG rule.
   *
   *  F4: SetNameSelectWindow also re-assigns RaceTemplate and Gender,
   *  and both setters EMPTY the textbox when the value changed
   *  (:142-161) - so walking back, picking a different race, and
   *  coming forward gives you a blank box, not the old name. The
   *  first assignment never clears: SetRaceTemplate is guarded on the
   *  previous template being non-null. */
  _enterName() {
    if (this._nameRaceId != null && this._nameRaceId !== this.race.id) this.name = '';
    if (this._nameGender != null && this._nameGender !== this.gender) this.name = '';
    this._nameRaceId = this.race.id;
    this._nameGender = this.gender;
    srand(this.seedRandom());
    this.state = 'name';
  }

  /** AUDIT 17j F2: ClassSelectWindow_OnClose's cancel arm. DFU also
   *  calls createCharRaceSelectWindow.Reset() here, which nulls the
   *  SELECTED race (:85-90) so the map reopens with its prompt and no
   *  province chosen. The port's race screen has no unselected state -
   *  raceIndex is always valid because the keyboard cursor and the
   *  description panel both read it - so that half is not
   *  represented; the open description box is what there is to clear. */
  _enterRace() {
    this.raceConfirm = null;
    this.state = 'race';
  }

  /** AUDIT 17j F3 / U19: the name screen's cancel. DFU sends it to
   *  SetChooseBioWindow - the METHOD screen now that U19 exists,
   *  where the port had collapsed it onto the questions. Either arm
   *  forward CONSTRUCTS over a fresh BiogFile, so the answers so far
   *  are DISCARDED there - load-bearing, not cosmetic:
   *  answerBiography appends to biographyEffects, so re-answering
   *  without the reset would apply every effect twice. With no
   *  question set for this class there is no screen to go back to,
   *  and the cancel is inert. */
  _enterBiographyBack() {
    if (!this.biogFor?.(this.classIndex)?.questions?.length) return;
    this._enterBioMethod();
  }

  /** The per-skill biography bonus the SKILLS screen displays. */
  skillBonuses() { return this.biographyEffects.length ? biographySkillBonuses(this.biographyEffects) : null; }

  /** The question on screen, or null when the set is exhausted. */
  biogQuestion() {
    const b = this.biogFor?.(this.classIndex);
    return b?.questions?.[this.biogQuestionIndex] ?? null;
  }

  /** AnswerButton_OnMouseClick (CreateCharBiography.cs:118-152): an
   *  index past this question's answers is INERT, the chosen answer's
   *  effects are tagged with the question index, and the last question
   *  ends the screen. */
  answerBiography(answerIndex) {
    const q = this.biogQuestion();
    if (!q) return false;
    const a = q.answers[answerIndex];
    if (!a) return false;   // "not an answer for this question"
    for (const e of a.effects) this.biographyEffects.push(tagEffect(e, this.biogQuestionIndex));
    const total = this.biogFor(this.classIndex).questions.length;
    if (this.biogQuestionIndex < total - 1) { this.biogQuestionIndex++; this.cursor = 0; }
    // U13: the last answer composes the BACKSTORY and pops the
    // reputation box (CreateCharBiography.cs:143-152) - a
    // ClickAnywhereToClose message box on TEXT.RSC 35, whose %r1..%r5
    // are DigestRepChanges' per-group totals. U19 shares the tail
    // with the auto path.
    else this._finishBiography();
    return true;
  }

  /** U16 / ONE DFU MEMBER, ONE EXPORT: the two rollouts' spend. The
   *  stats and skills SCREENS reach it from their keyboard arms and
   *  the SUMMARY from its spinners, which is a third caller and the
   *  reason it stopped being written inline. */
  spendStat(delta) {
    const key = STAT_KEYS_ORDER[this.statCursor];
    const r = delta > 0
      ? statUp(this.stats[key], this.statPool)
      : statDown(this.stats[key], this.rolledStats[key], this.statPool);
    this.stats[key] = r.working;
    this.statPool = r.pool;
  }

  /** The flat keyboard cursor and the three group selections are two
   *  views of one thing: moving the cursor onto a row IS selecting
   *  that row within its group (SelectPrimarySkill and its two
   *  siblings). */
  _syncSkillSel() {
    const at = this._skillAt(this.skillCursor);
    if (at) this.skillSel[at.group] = at.indexInGroup;
  }

  /** The skill a group's OWN spinner is sitting on. */
  _skillInGroup(group) {
    for (const [g, ids] of this.skillRows()) {
      if (g === group) return ids[this.skillSel[group]] ?? null;
    }
    return null;
  }

  spendSkill(delta, group = null) {
    const at = group
      ? { group, id: this._skillInGroup(group) }
      : this._skillAt(this.skillCursor);
    if (!at?.id && at?.id !== 0) return;
    const r = delta > 0
      ? skillUp(this.skills[at.id], this.pools[at.group])
      : skillDown(this.skills[at.id], this.rolledSkills[at.id], this.pools[at.group]);
    this.skills[at.id] = r.working;
    this.pools[at.group] = r.pool;
  }

  /** U16: SetSummaryWindow assigns CharacterDocument on EVERY push,
   *  and that setter is SetCharacterSheet (:119-136), which zeroes all
   *  four pools - `statsRollout.BonusPool = 0` and the three
   *  skill bonus-point counters. Verbatim, including the quirk it
   *  carries: un-spend a point ON the summary, back out to the reflex
   *  screen and come forward again, and the pool is zeroed while the
   *  lowered value stands, so the point is gone. DFU does exactly that
   *  - the setter runs before every PushWindow. Zeroing here is also
   *  what makes the pools well-defined for a flow that reached the
   *  summary without ever opening the skills screen. */
  _enterSummary() {
    // SetStats calls SelectStat(0) (StatsRollout.cs:190), so arriving
    // here puts the stat selection back on Strength - the spinner does
    // not stay where the stats screen left it.
    this.statCursor = 0;
    this.skillCursor = 0;
    this.statPool = 0;
    this.pools = { primary: 0, major: 0, minor: 0 };
    this.summaryPoolBox = null;
    this.state = 'summary';
  }

  /** U16: OkButton_OnMouseClick (CreateCharSummary.cs:174-189). The
   *  gate is FOUR pools, not one - the stat bonus pool and all three
   *  skill bonus pools - because the summary lets you take points back
   *  DOWN off any of them. Unspent points pop TEXT.RSC 14 as a
   *  ClickAnywhereToClose box rather than closing the window. */
  confirmSummary() {
    if (this.statPool > 0 || this.pools.primary > 0 || this.pools.major > 0 || this.pools.minor > 0) {
      this.summaryPoolBox = bonusPointsRows?.() ?? [''];
      return;
    }
    this.state = 'done';
  }

  /** RestartButton_OnMouseClick (:170-174) - PopWindow then OnRestart,
   *  which the wizard answers with SetRaceSelectWindow (:555-558). It
   *  is a SOFT restart: the document survives, so a player who picks
   *  the same class again keeps the stats they rolled (the F7 rule).
   *  The biography is the one thing that must not survive, and
   *  _enterBiography is where that is handled for every arrival. */
  restartSummary() {
    this.summaryPoolBox = null;
    this._enterRace();
  }

  /** The screens' own Reroll button - it forces, where re-entry does not. */
  reroll() {
    if (this.state === 'stats') this._enterStats(true);
    else if (this.state === 'skills') this._enterSkills(true);
  }

  /** actions: up/down/plus/minus/confirm/back/reroll/char:<c>/backspace */
  input(action) {
    const s = this.state;
    if (s === 'name') {
      if (action.startsWith('char:') && this.name.length < NAME_MAX_CHARACTERS) this.name += action.slice(5);
      else if (action === 'backspace') this.name = this.name.slice(0, -1);
      // AcceptName (CreateCharNameSelect.cs:137-140): an EMPTY name
      // does not close the window, so OK and Return are both inert.
      else if (action === 'confirm' && this.name.length) this.state = 'face';
      // AUDIT 17j F3: this screen had NO cancel at all - the one
      // screen in the wizard you could not back out of. DFU's
      // NameSelectWindow_OnClose sends a cancel to SetChooseBioWindow
      // (:483-493); the port collapses chooseBio into the biography
      // questions, so that is where back lands.
      else if (action === 'back') this._enterBiographyBack();
      return;
    }
    if (s === 'race') {
      // U11: the confirm box is MODAL - it eats the map's keys, and
      // its own confirm/back are Yes and No.
      if (this.raceConfirm) {
        if (action === 'confirm') { this.raceConfirm = null; this.state = 'gender'; }
        else if (action === 'back') this.raceConfirm = null;
        return;
      }
      if (action === 'up') this.raceIndex = (this.raceIndex + RACE_TEMPLATES.length - 1) % RACE_TEMPLATES.length;
      else if (action === 'down') this.raceIndex = (this.raceIndex + 1) % RACE_TEMPLATES.length;
      else if (action === 'confirm') {
        // AUDIT 17g F5: a keyboard confirm walked straight past the
        // race DESCRIPTION box a click opens, so a keyboard player
        // never saw it and a tapping one always did. DFU has no
        // keyboard path here at all - the map click IS the selection -
        // so routing both through the same confirm is the closer read.
        const rows = this.describeRace?.(this.race) ?? null;
        if (rows?.length) this.raceConfirm = rows;
        else this.state = 'gender';
      } else if (action === 'back') return;   // race is the FIRST screen now
      return;
    }
    if (s === 'gender') {
      if (action === 'up' || action === 'down') this.gender = this.gender === 'male' ? 'female' : 'male';
      // U18: the accept arm is SetChooseClassGenWindow (:305-316) -
      // the method screen sits between gender and the list.
      else if (action === 'confirm') this._enterClassMethod();
      else if (action === 'back') this.state = 'race';
      return;
    }
    if (s === 'classMethod') {
      // CreateCharChooseClassGen: two buttons, ChooseClass_OnMouseClick
      // just closes, ChooseGenerate_OnMouseClick raises ChoseGenerate
      // first (:63-72); the wizard's OnClose has NO cancelled arm
      // (:318-328) - ANY close that is not "generate" goes to the class
      // list, Escape included, so back lands there too.
      if (action === 'up' || action === 'down') this.methodCursor = this.methodCursor === 0 ? 1 : 0;
      else if (action === 'confirm') {
        if (this.methodCursor === 1) this._enterClassQuestions();
        else this.state = 'class';
      } else if (action === 'back') this.state = 'class';
      return;
    }
    if (s === 'classQuestions') {
      // the description box is MODAL, its confirm and back Yes and No
      if (this.qConfirm) {
        if (action === 'confirm') this._acceptQuestionClass();
        else if (action === 'back') this._cancelQuestionClass();
        return;
      }
      // the A, B and C keys answer (Update :176-181); they arrive
      // through the overlay table as typed characters
      if (action === 'char:a' || action === 'char:A') this.answerClassQuestion(0);
      else if (action === 'char:b' || action === 'char:B') this.answerClassQuestion(1);
      else if (action === 'char:c' || action === 'char:C') this.answerClassQuestion(2);
      // the mouse wheel's scroll (GetUIScrollMovement), on the arrows
      // for the keyboard seam
      else if (action === 'down') this.scrollQuestion(1);
      else if (action === 'up') this.scrollQuestion(-1);
      // Escape cancels the popup with classIndex still noClassIndex,
      // and the wizard's OnClose falls to SetClassSelectWindow
      else if (action === 'back') this.state = 'class';
      return;
    }
    if (s === 'face') {
      if (action === 'up') this.faceIndex = (this.faceIndex + FACES_PER_RACE - 1) % FACES_PER_RACE;
      else if (action === 'down') this.faceIndex = (this.faceIndex + 1) % FACES_PER_RACE;
      else if (action === 'confirm') { this.state = 'stats'; this._enterStats(); }
      else if (action === 'back') this._enterName();   // FaceSelectWindow_OnClose (:496-508) - and re-entry reseeds + clears, as DFU's push does
      return;
    }
    if (s === 'class') {
      // U17: the description box is MODAL over the list, like the race
      // screen's - its own confirm and back are Yes and No.
      if (this.classConfirm) {
        if (action === 'confirm') { this.classConfirm = null; this._acceptStandardClass(); }
        else if (action === 'back') this.classConfirm = null;
        return;
      }
      // U20a: ListBox.SelectPrevious/SelectNext CLAMP (ListBox.cs
      // :709-740 - both guard `if (selectedIndex > 0)` /
      // `< listItems.Count - 1`). The port wrapped with a modulo, so
      // the list ran off its own ends onto the far one; the FacePicker
      // wrap the face screen uses is that component's OWN law
      // (FacePicker.cs:116-127), not this one's.
      if (action === 'up') { this.classIndex = Math.max(0, this.classIndex - 1); this._scrollToClass(); }
      else if (action === 'down') { this.classIndex = Math.min(this.classRowCount() - 1, this.classIndex + 1); this._scrollToClass(); }
      // ListBox.cs:296-297 - Return USES the selected item, the same
      // door the double click goes through.
      else if (action === 'confirm') this.useClass();
      // AUDIT 17j F2: this went to GENDER, which is the screen before
      // it. DFU does not step back one - ClassSelectWindow_OnClose's
      // cancel arm calls SetRaceSelectWindow (:353-370), skipping the
      // gender screen entirely. The U15 pin asserted the bug: I wrote
      // it from the STATES order rather than from DFU's handler table.
      else if (action === 'back') this._enterRace();
      return;
    }
    if (s === 'customClass') {
      const c = this.custom;
      // any open box is ClickAnywhereToClose and MODAL
      if (c.box) { c.box = null; return; }
      if (c.sub === 'skillPick') {
        const n = c.pickItems.length;
        // the same ListBox CLAMP as the class list
        if (action === 'up') { c.pickCursor = Math.max(0, c.pickCursor - 1); this._scrollPick(); }
        else if (action === 'down') { c.pickCursor = Math.min(n - 1, c.pickCursor + 1); this._scrollPick(); }
        // Return goes through the SAME door as the double click
        // (ListBox.cs:296-297 -> UseSelectedItem)
        else if (action === 'confirm') this.usePickRow(c.pickCursor);
        else if (action === 'back') c.sub = null;   // the picker is a cancellable popup
        return;
      }
      if (c.sub === 'help') {
        const n = HELP_TOPICS.length;
        if (action === 'up') { c.pickCursor = Math.max(0, c.pickCursor - 1); this._scrollPick(n); }
        else if (action === 'down') { c.pickCursor = Math.min(n - 1, c.pickCursor + 1); this._scrollPick(n); }
        // HelpPicker_OnItemPicked closes the picker, then the topic
        // shows as a ClickAnywhereToClose box (:377-384) - the same
        // UseSelectedItem door
        else if (action === 'confirm') this.usePickRow(c.pickCursor);
        else if (action === 'back') c.sub = null;
        return;
      }
      if (c.sub === 'rep') {
        // clicks own the bars. Return stands in for the exit BUTTON,
        // which is gated on the balance; ESCAPE is the popup's own
        // cancel (DaggerfallPopupWindow.cs:28,72 - allowCancel is
        // true and this window never clears it), and that closes
        // UNCONDITIONALLY. The values persist either way: UpdateRep
        // writes straight into the builder as you click, and the
        // builder's own exit gates never re-check the balance - so
        // classic really does let you leave it unspent this way.
        if (action === 'confirm') this.customRepExit();
        else if (action === 'back') { c.box = null; c.sub = null; }
        return;
      }
      // the main screen: the name box always has focus (a TextBox, so
      // the 31-char default cap), the stat block spends freeEdit,
      // Return attempts the gated exit, Escape cancels to the list
      // (the wizard's cancel arm :403-406).
      if (action.startsWith('char:') && c.className.length < NAME_MAX_CHARACTERS) c.className += action.slice(5);
      else if (action === 'backspace') c.className = c.className.slice(0, -1);
      else if (action === 'up') c.statCursor = (c.statCursor + 7) % 8;
      else if (action === 'down') c.statCursor = (c.statCursor + 1) % 8;
      else if (action === 'plus') this.customSpendStat(1);
      else if (action === 'minus') this.customSpendStat(-1);
      else if (action === 'confirm') this.customExit();
      else if (action === 'back') this.state = 'class';
      return;
    }
    if (s === 'bioMethod') {
      // U19: the reputation box the GENERATE arm pops is MODAL over
      // this screen (the wizard pushes it over createCharChooseBioWindow,
      // :444) and closes on any key, then the name screen follows
      if (this.biogRepBox) { this.biogRepBox = null; this._leaveBiography(); return; }
      if (action === 'up' || action === 'down') this.bioMethodCursor = this.bioMethodCursor === 0 ? 1 : 0;
      else if (action === 'confirm') {
        if (this.bioMethodCursor === 1) this._enterBiography();
        else this._autoBiography();
      }
      // the cancel arm (:458-461) - SetClassSelectWindow
      else if (action === 'back') this.state = 'class';
      return;
    }
    if (s === 'biography') {
      // the ten answer buttons are digits 1-0 on the keyboard; the
      // flow's own cursor walks them for the probe and the phone
      const q = this.biogQuestion();
      if (!q && !this.biogRepBox) { this._leaveBiography(); return; }
      // the reputation box is MODAL and closes on any key
      // (ClickAnywhereToClose), then the screen ends
      if (this.biogRepBox) { this.biogRepBox = null; this._leaveBiography(); return; }
      if (action === 'up') this.cursor = (this.cursor + q.answers.length - 1) % q.answers.length;
      else if (action === 'down') this.cursor = (this.cursor + 1) % q.answers.length;
      else if (action === 'confirm') this.answerBiography(this.cursor);
      // U19: CreateCharBiographyWindow_OnClose's cancel arm (:477-480)
      // returns to SetChooseBioWindow - the method screen
      else if (action === 'back') this._enterBioMethod();
      return;
    }
    if (s === 'stats') {
      if (action === 'up') this.statCursor = (this.statCursor + 7) % 8;
      else if (action === 'down') this.statCursor = (this.statCursor + 1) % 8;
      else if (action === 'plus') this.spendStat(1);
      // AUDIT 17k follow-up: 'minus' was UNREACHABLE from a keyboard.
      // overlayAction tests the typed-character class FIRST and the
      // hyphen is a literal inside it (input.js:18), so the '-' key
      // always arrives as 'char:-' - a point could be spent and never
      // taken back except by clicking the spinner. '+' and '=' were
      // never affected (neither is a typed character here).
      else if (action === 'minus' || action === 'char:-') this.spendStat(-1);
      else if (action === 'reroll') this.reroll();
      else if (action === 'confirm' && this.statPool === 0) { this.state = 'skills'; this._enterSkills(); }   // classic requires the pool spent
      else if (action === 'back') this.state = 'face';
      return;
    }
    if (s === 'reflexes') {
      // ReflexPicker: five rows, VeryHigh at the top. Classic has no
      // keyboard path (you click a row), so up/down walk them.
      if (action === 'up') this.reflexes = Math.max(0, this.reflexes - 1);
      else if (action === 'down') this.reflexes = Math.min(REFLEX_COUNT - 1, this.reflexes + 1);
      else if (action === 'confirm') this._enterSummary();   // U16: SetSummaryWindow (:551-558)
      else if (action === 'back') { this.state = 'skills'; this.skillCursor = 0; }
      return;
    }
    if (s === 'summary') {
      // U16: CHAR04I0 composites the stats, skills, face and reflex
      // components on one screen with the name box, so nearly every
      // control is live here. The port edits ONE flow object, which is
      // why it needs no equivalent of SummaryWindow_OnClose's cancel
      // arm copying skills, stats, bonus points and faceIndex back to
      // the windows behind it (:571-583) - there is nothing to copy
      // back to.
      if (this.summaryPoolBox) { this.summaryPoolBox = null; return; }   // ClickAnywhereToClose
      if (action.startsWith('char:') && this.name.length < NAME_MAX_CHARACTERS) this.name += action.slice(5);
      else if (action === 'backspace') this.name = this.name.slice(0, -1);
      else if (action === 'confirm') this.confirmSummary();
      else if (action === 'back') { this.state = 'reflexes'; }
      return;
    }
    if (s === 'skills') {
      const total = this.skillRows().reduce((a, [, ids]) => a + ids.length, 0);
      if (action === 'up') { this.skillCursor = (this.skillCursor + total - 1) % total; this._syncSkillSel(); }
      else if (action === 'down') { this.skillCursor = (this.skillCursor + 1) % total; this._syncSkillSel(); }
      else if (action === 'plus') this.spendSkill(1);
      else if (action === 'minus' || action === 'char:-') this.spendSkill(-1);   // the same unreachable-minus fix
      else if (action === 'reroll') this.reroll();
      else if (action === 'confirm' && this.pools.primary === 0 && this.pools.major === 0 && this.pools.minor === 0) this.state = 'reflexes';
      else if (action === 'back') { this.state = 'stats'; this.statCursor = 0; }
      return;
    }
  }

  /** U10: a NATIVE-panel point (the townTalk overlay seam's own
   *  coordinate space) -> the flow state it changes. Returns true
   *  when the click was consumed. `setRace`/`setGender`/
   *  `setCursor` are the direct-set hits classic's windows have and
   *  the keyboard flow reaches by stepping. */
  clickNative(vx, vy, now = null) {
    // the ART gate is about the DRAW, not the geometry: without it the
    // screens fall back to text panels whose layout does not match the
    // native rects, so a click would hit a button that is not there.
    if (!chargenArtLoaded()) return false;
    const hit = chargenHit(this, vx, vy);
    // U17: the class LIST is a ListBox, and a ListBox's single click
    // only SELECTS - MouseClick sets selectedIndex and raises
    // OnSelectItem (ListBox.cs:500-504). It takes a DOUBLE click to
    // USE the row (:507-512 -> OnUseSelectedItem -> OnItemPicked), or
    // Return (:296-297). The port picked on a single click and then
    // demanded a keyboard confirm the picker has no button for, so on
    // a phone the class screen was a dead end.
    if (hit?.setClass != null) return this.clickClassRow(hit.setClass, now ?? this._now());
    return this.applyHit(hit);
  }

  _now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }

  /** ListBox.MouseClick then MouseDoubleClick. The double-click test is
   *  on TIME ALONE (BaseScreenComponent.cs:691) - the second click need
   *  not land on the same row, because MouseClick has already moved
   *  the selection to it by the time MouseDoubleClick reads it. */
  clickClassRow(idx, now) {
    const wasDouble = this._lastClassClick != null && (now - this._lastClassClick) < DOUBLE_CLICK_DELAY_MS;
    this.classIndex = idx;
    this._lastClassClick = now;
    if (wasDouble) { this._lastClassClick = null; this.useClass(); }
    return true;
  }

  /** DaggerfallClassSelectWindow_OnItemPicked (:70-96): picking a class
   *  does not close the picker, it opens the class's DESCRIPTION in a
   *  Yes/No box on TEXT.RSC 2100 + index. Yes closes both windows, No
   *  drops the selection and returns to the list. U20a: the CUSTOM
   *  row closes STRAIGHT to the builder - no description, no drums
   *  (the :72-77 arm). */
  useClass() {
    if (this.classIndex === this.careers.length) {
      // :356-359 - the flag is raised HERE, at the row pick, before
      // the builder is even constructed (and is never lowered again)
      this.isCustom = true;
      this._enterCustomClass();
      return;
    }
    this.classConfirm = this.describeClass?.(this.classIndex) ?? null;
    if (!this.classConfirm) this._acceptStandardClass();   // no description available: the pick stands
  }

  /** U14: the pure apply step - a hit from chargenHit -> the state it
   *  changes. Split out from clickNative so the pointer path is
   *  testable without art, the way chargenHit already is. */
  applyHit(hit) {
    if (!hit) return false;
    if (typeof hit === 'string') { this.input(hit); return true; }
    if (hit.setRace != null) {
      this.raceIndex = RACE_TEMPLATES.findIndex((r) => r.key === hit.setRace);
      // U11: the province click OPENS the confirm box (Yes accepts,
      // No returns to the map) rather than accepting outright.
      this.raceConfirm = hit.describe?.length ? hit.describe : null;
      return true;
    }
    if (hit.cancelRace) { this.raceConfirm = null; return true; }
    if (hit.setGender != null) {
      // U14: the Male/Female BUTTON sets the gender AND closes the
      // window (CreateCharGenderSelect.cs:59-71 - both handlers end in
      // CloseWindow). The port made the click a selection and demanded
      // a separate confirm, which classic has no button for.
      // U18: the close lands on the method screen (:305-316).
      this.gender = hit.setGender;
      this._enterClassMethod();
      return true;
    }
    if (hit.setStatCursor != null) { this.statCursor = hit.setStatCursor; return true; }
    if (hit.setSkillCursor != null) { this.skillCursor = hit.setSkillCursor; this._syncSkillSel(); return true; }
    if (hit.setClass != null) { this.classIndex = hit.setClass; return true; }
    if (hit.confirmClass) { this.classConfirm = null; this._acceptStandardClass(); return true; }
    if (hit.cancelClass) { this.classConfirm = null; return true; }
    // U18: the method screen's two buttons - the click sets AND closes,
    // as both DFU handlers end in CloseWindow (:63-72).
    if (hit.classMethod != null) {
      if (hit.classMethod === 'questions') this._enterClassQuestions();
      else this.state = 'class';
      return true;
    }
    if (hit.answerClass != null) return this.answerClassQuestion(hit.answerClass);
    if (hit.qScroll != null) { this.scrollQuestion(hit.qScroll); return true; }
    if (hit.confirmQClass) { this._acceptQuestionClass(); return true; }
    if (hit.cancelQClass) { this._cancelQuestionClass(); return true; }
    // U20a: the custom-class builder's controls.
    if (hit.customSkill != null) { this.customOpenSkillPick(hit.customSkill); return true; }
    if (hit.customHp != null) { this.customHp(hit.customHp); return true; }
    if (hit.customHelp) {
      const c = this.custom;
      c.sub = 'help'; c.pickCursor = 0; c.pickScroll = 0;
      return true;
    }
    if (hit.customAdvantage || hit.customDisadvantage) {
      // FLAGGED to U20b: CreateCharSpecialAdvantageWindow. The click
      // answers loudly rather than dying silently.
      console.warn('[chargen] special advantages/disadvantages pend U20b');
      return true;
    }
    if (hit.customRep) {
      // ReputationButton_OnMouseClick NEWS the window each time, and
      // its `pointsToDistribute` is a field initialised to 0 -
      // UpdatePointsToDistribute only runs on a BAR CLICK. So a
      // re-opened window reads 0 until you touch a bar, and its exit
      // gate reads that stale 0: classic really does let you leave an
      // unbalanced ledger this way. Ported verbatim as a field.
      this.custom.sub = 'rep';
      this.custom.repPoints = 0;
      return true;
    }
    if (hit.customExit) { this.customExit(); return true; }
    if (hit.pickRow != null) return this.clickPickRow(hit.pickRow, hit.now ?? this._now());
    if (hit.pickStep != null) {
      const c = this.custom;
      const n = c.sub === 'help' ? HELP_TOPICS.length : (c.pickItems?.length ?? 0);
      // the picker's arrows are the ListBox's own SelectPrevious /
      // SelectNext, which CLAMP (ListBox.cs:709-740) - not a wrap
      c.pickCursor = Math.max(0, Math.min(n - 1, c.pickCursor + hit.pickStep));
      this._scrollPick(n);
      return true;
    }
    if (hit.repClick) {
      const r = repClick(hit.repClick[0], hit.repClick[1]);
      if (r) {
        this.custom.reps[r.group] = r.value;
        this.custom.repPoints = repPointsToDistribute(this.custom.reps);   // UpdatePointsToDistribute
      }
      return true;
    }
    if (hit.repExit) { this.customRepExit(); return true; }
    if (hit.customStatCursor != null) { this.custom.statCursor = hit.customStatCursor; return true; }
    if (hit.customStatStep != null) { this.customSpendStat(hit.customStatStep); return true; }
    if (hit.customBox) { this.custom.box = null; return true; }
    // U19: the bio-method buttons - both DFU handlers end in
    // CloseWindow (:65-73), so the click chooses AND closes.
    if (hit.bioMethod != null) {
      if (hit.bioMethod === 'questions') this._enterBiography();
      else this._autoBiography();
      return true;
    }
    if (hit.answerBiography != null) return this.answerBiography(hit.answerBiography);
    if (hit.setReflexes != null) { this.reflexes = hit.setReflexes; return true; }
    if (hit.restart) { this.restartSummary(); return true; }
    // U16: the summary's FacePicker keeps its PREVIOUS/NEXT buttons,
    // but 'up'/'down' belong to the face SCREEN's state arm - the
    // summary has no such arm, so the step is explicit.
    if (hit.statStep != null) { this.spendStat(hit.statStep); return true; }
    if (hit.skillStep != null) { this.spendSkill(hit.skillStep, hit.group ?? null); return true; }
    if (hit.faceStep != null) {
      this.faceIndex = (this.faceIndex + FACES_PER_RACE + hit.faceStep) % FACES_PER_RACE;
      return true;
    }
    if (hit.randomName) {
      // U15: NameHelper.FullName over the race's bank
      // (CreateCharNameSelect.cs:166-171). The classic wizard order
      // means the race and gender are both already chosen.
      this.name = fullName(getNameBank(this.race.key), this.gender === 'female' ? GENDERS.Female : GENDERS.Male);
      return true;
    }
    return false;
  }

  get done() { return this.state === 'done'; }
  result() {
    return { name: this.name, gender: this.gender, race: this.race.key, raceId: this.race.id, faceIndex: this.faceIndex, careerIndex: this.classIndex, career: this.career, stats: this.stats, skills: this.skills, biographyEffects: this.biographyEffects, reflexes: this.reflexes, backStory: this.backStory,
      // U20a: the custom document halves - isCustom drives the
      // starting kit + the Spellsword spell rule, customReps the
      // sGroupReputations seed (PlayerEntity.AssignCharacter :844-848)
      isCustom: this.isCustom, customReps: this.customReps };
  }

  // ---- drawing ----
  // U10: the REAL classic screens when the art is up (ui/chargenArt.js
  // over the U8a native panel); the clean-text panels below stay as
  // the art-less fallback, exactly as every other native window keeps
  // its text path.
  draw(renderer, canvas, font, scale) {
    if (chargenArtLoaded()) {
      const m = nativeMetrics(canvas);
      // the FACE CIF follows the identity being chosen
      if (this.state === 'face') loadFaceSet(this.race.key, this.gender);
      if (drawChargenNative(renderer, m, font, this)) return;
    }
    const s = scale, W = canvas.width, H = canvas.height;
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: W, h: H }, undefined, [0.04, 0.03, 0.02, 0.92]);
    const gold = [0.85, 0.72, 0.35, 1], white = [0.9, 0.9, 0.85, 1], dim = [0.5, 0.5, 0.45, 1], hot = [1, 0.95, 0.6, 1];
    const title = (t) => drawText(renderer, font, t, (W - measureText(font.fnt, t) * s) / 2, 24 * s, s, gold);
    const line = (t, row, color) => drawText(renderer, font, t, 40 * s, (56 + row * 12) * s, s, color);
    if (this.state === 'name') {
      title('WHAT IS YOUR NAME?');
      line(this.name + '_', 1, white);
      line('type, ENTER to continue', 3, dim);
    } else if (this.state === 'gender') {
      title('GENDER');
      line((this.gender === 'male' ? '> ' : '  ') + 'Male', 1, this.gender === 'male' ? hot : white);
      line((this.gender === 'female' ? '> ' : '  ') + 'Female', 2, this.gender === 'female' ? hot : white);
    } else if (this.state === 'race') {
      title('CHOOSE YOUR RACE');
      RACE_TEMPLATES.forEach((r, i) => line((i === this.raceIndex ? '> ' : '  ') + r.name, i, i === this.raceIndex ? hot : white));
    } else if (this.state === 'face') {
      title('CHOOSE YOUR FACE');
      line(`${this.race.name} ${this.gender}`, 0, white);
      line(`face ${this.faceIndex + 1} of ${FACES_PER_RACE}`, 2, hot);
      line('up/down to cycle, ENTER to continue', 4, dim);
      line('(the portrait draws with the chargen art slice)', 6, dim);
    } else if (this.state === 'class') {
      title('CHOOSE YOUR CLASS');
      for (let i = 0; i < this.classRowCount(); i++) {
        line((i === this.classIndex ? '> ' : '  ') + this.classRowName(i), i, i === this.classIndex ? hot : white);
      }
    } else if (this.state === 'classMethod') {
      title('CHOOSE YOUR CLASS METHOD');
      line((this.methodCursor === 0 ? '> ' : '  ') + 'Select from a list', 1, this.methodCursor === 0 ? hot : white);
      line((this.methodCursor === 1 ? '> ' : '  ') + 'Answer questions', 2, this.methodCursor === 1 ? hot : white);
    } else if (this.state === 'customClass' && this.custom) {
      const c = this.custom;
      title('CUSTOM CLASS');
      if (c.box) c.box.slice(0, 10).forEach((r, i) => line(r.text ?? r, i, white));
      else if (c.sub === 'skillPick') {
        c.pickItems.slice(c.pickScroll, c.pickScroll + 12).forEach((id, i) => {
          const at = c.pickScroll + i;
          line((at === c.pickCursor ? '> ' : '  ') + SKILL_NAMES[id], i, at === c.pickCursor ? hot : white);
        });
      } else if (c.sub === 'help') {
        HELP_TOPICS.forEach(([label], i) => line((i === c.pickCursor ? '> ' : '  ') + label, i, i === c.pickCursor ? hot : white));
      } else if (c.sub === 'rep') {
        Object.entries(c.reps).forEach(([g, v], i) => line(`${g}: ${v}`, i, white));
        line(`to distribute: ${-Object.values(c.reps).reduce((a, b) => a + b, 0)}`, 6, dim);
      } else {
        line(`Name: ${c.className}_`, 0, white);
        line(`HP/level: ${c.hp}  difficulty: ${this.customDifficulty()}`, 1, white);
        line(`Skills set: ${c.skills.filter((v) => v != null).length}/12`, 2, white);
        line(`Stat pool: ${c.statPool}`, 3, white);
        line('ENTER exit (gated), ESC cancel', 5, dim);
      }
    } else if (this.state === 'bioMethod') {
      title('CHOOSE YOUR HISTORY METHOD');
      if (this.biogRepBox) {
        this.biogRepBox.slice(0, 10).forEach((r, i) => line(r.text ?? r, i, white));
        line('any key to continue', 11, dim);
      } else {
        line((this.bioMethodCursor === 0 ? '> ' : '  ') + 'Have your history generated', 1, this.bioMethodCursor === 0 ? hot : white);
        line((this.bioMethodCursor === 1 ? '> ' : '  ') + 'Answer questions', 2, this.bioMethodCursor === 1 ? hot : white);
      }
    } else if (this.state === 'classQuestions') {
      title(`QUESTION ${Math.min(this.qAnswered + 1, 10)} OF 10`);
      if (this.qConfirm) {
        this.qConfirm.slice(0, 12).forEach((r, i) => line(r.text ?? r, i, white));
        line('ENTER yes, ESC no', 13, dim);
      } else if (this.qDisplay) {
        this.qDisplay.lines.slice(0, 14).forEach((t, i) => line(t.trim(), i, white));
        line('A / B / C to answer', 15, dim);
      }
    } else if (this.state === 'stats') {
      title(`DISTRIBUTE  POOL: ${this.statPool}`);
      STAT_KEYS_ORDER.forEach((k, i) => line(
        `${i === this.statCursor ? '> ' : '  '}${k.slice(0, 3).toUpperCase()}  ${this.stats[k]}`,
        i, i === this.statCursor ? hot : white));
      line('+/- assign   R reroll   ENTER when pool 0', 10, dim);
    } else if (this.state === 'skills') {
      title(`SKILLS  P:${this.pools.primary} M:${this.pools.major} m:${this.pools.minor}`);
      let row = 0, idx = 0;
      for (const [group, ids] of this.skillRows()) {
        for (const id of ids) {
          line(`${idx === this.skillCursor ? '> ' : '  '}${SKILL_NAMES[id]}  ${this.skills[id]}`, row, idx === this.skillCursor ? hot : white);
          row++; idx++;
        }
        row++;
      }
      line('+/- assign   R reroll   ENTER when pools 0', row, dim);
    }
  }
}
