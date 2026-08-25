// Character-creation UI (UI arc, U2b). The flow that retires the
// Warrior-16 default and the lowest-first pool policy: name ->
// gender -> class -> stats -> skills -> done, with the pool
// distribution rules VERBATIM from DFU StatsRollout/SkillsRollout:
//   stats:  + blocked at MaxStatValue (100) or pool 0;
//           - blocked at the ROLLED value (points return to pool)
//   skills: + blocked at group pool 0 (no upper clamp);
//           - blocked at the ROLLED value
// The STATS screen offers REROLL, exactly the rollout component's own
// button; the SKILLS screen has no such control in classic (AUDIT 18 -
// CreateCharAddBonusSkills.Setup adds only OK).
// U10: the screens draw as the REAL classic windows (ui/chargenArt.js
// over the U8a native panel) - the clean-text panels below are the
// art-less fallback now, not the plan - the note this file carried
// about unverified art names shipped out with them.

import { rollStats, rollSkills, STAT_KEYS_ORDER, spellPoints, spellPointMultiplier } from '../systems/chargen.js';
import { QUESTION_COUNT, NO_CLASS_INDEX, displayQuestion, pickQuestionIndices, answerWeightIndex, resolveClassIndex } from '../systems/classQuestions.js';   // U18

// F2 / THE NEVER-UNFINISHABLE GATE. An answer locks the questions
// screen while its constellation plays, so a host that never ticked
// the flow - or a CEL that stalled - would make a character
// UNCREATABLE. Both the tick and the next answer release the lock
// past this deadline, so the worst case degrades to the pre-F2
// instant advance rather than a dead screen.
const QANIM_STUCK_MIN_MS = 2000;
const QANIM_STUCK_PAD_MS = 1000;
import { ADVANTAGE_KEYS, DISADVANTAGE_KEYS, ONLY_ONE_KEYS, MAX_ITEMS, secondaryListFor, advDisAdjustment, cannotAdd, totalAdjust, parseCareerData } from '../systems/specialAdvantages.js';   // U20b
import { HP_MIN, HP_MAX, HP_DEFAULT, DIFFICULTY_MIN, DIFFICULTY_MAX, FREE_EDIT_MIN, FREE_EDIT_MAX, STAT_DEFAULT, difficultyPoints, availableSkills, buildCustomCareer, classAffinityIndex, repClick, repPointsToDistribute, HELP_TOPICS } from '../systems/customClass.js';   // U20a
import { damageModifier, maxEncumbrance, magicResist, toHitModifier, hitPointsModifier, healingRateModifier } from '../combat/formulas.js';   // U10: the derived block
import { tagEffect, biographySkillBonuses, digestRepChanges } from '../systems/biography.js';   // S3e
import { fullName, getNameBank, GENDERS } from '../characters/nameHelper.js';   // U15
import { srand } from '../formats/dfRandom.js';   // AUDIT 17j F1: the name screen's reseed
import { buildBackstory, repBoxRows, bonusPointsRows } from './chargenArt.js';   // U13 / U16
import { RACE_TEMPLATES, FACES_PER_RACE } from '../systems/races.js';   // S3c/U9
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { SKILL_NAMES } from '../systems/skills.js';
import { drawText, measureText } from './text.js';
import { nativeMetrics } from './nativePanel.js';
import { chargenArtLoaded, drawChargenNative, loadFaceSet, chargenHit, raceDescriptionLines, classDescriptionLines, textRecordLines, DOUBLE_CLICK_DELAY_MS, CLASS_LIST_ROWS, ADV_PICKER_ITEM_COUNT, PLAYER_REFLEXES, REFLEX_COUNT, QUESTION_ROW_H, QSCROLL_H, QSCROLL_TEXT_OFFSET, QSCROLL_FRAMES, startConstellationAnim, tickConstellationAnim, stopConstellationAnim } from './chargenArt.js';   // U10 / U17 / U18 / U20a

// AUDIT 24 (wave 24): FormulaHelper.MaxStatValue, one home.
import { MAX_STAT_VALUE } from '../systems/statMods.js';

export { MAX_STAT_VALUE };

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

/** AUDIT 18: what `new ClassFile(files[0]).Career` yields - a DISTINCT
 *  DFCareer object carrying identical values, re-read from the same
 *  CLASSnn.CFG. A ClassFile's career is flat scalars plus the three
 *  skill arrays (verified against all eighteen real CFGs), so a spread
 *  with the arrays copied is the whole of it. */
export function freshCareer(career) {
  if (!career) return null;
  return {
    ...career,
    primarySkills: [...career.primarySkills],
    majorSkills: [...career.majorSkills],
    minorSkills: [...career.minorSkills],
  };
}

export class ChargenFlow {
  /** careers: [{ name, career }] x18 (loaded from CLASS*.CFG). */
  constructor(careers, rolls = Math.random) {
    this.careers = careers;
    this.rolls = rolls;
    this.state = 'race';
    this.name = '';
    this.gender = 'male';
    this.raceIndex = 0;      // RACE_TEMPLATES order (Breton first)
    this.faceIndex = 0;      // characterDocument.faceIndex - 0..9 within the race/gender FACE CIF
    // AUDIT 18: the FACE SCREEN's own picker value, which DFU keeps
    // separately from the document. SetFaceSelectWindow calls
    // SetFaceTextures on EVERY push (DaggerfallStartNewGameWizard.cs:213-224)
    // and CreateCharFaceSelect.SetFaceTextures (:65-69) is verbatim
    // `facePicker.FaceIndex = 0;` first - so re-entering the screen
    // always shows face 0 - while the CANCEL arm (:502-507) writes
    // nothing back, so the previously accepted face survives an Escape.
    this.facePick = 0;
    // AUDIT 17m: DFU carries these as TWO members and the port had
    // collapsed them into one. `characterDocument.classIndex` is the
    // DOCUMENT's class - written at DaggerfallStartNewGameWizard.cs:343
    // (the questions path), :364 (a list pick) and :382 (a custom
    // class's biography AFFINITY). `listBox.SelectedIndex` is the class
    // picker's own highlighted row, which the wizard NEVER writes and
    // which survives because SetClassSelectWindow (:158-167) REUSES the
    // window. One field doing both jobs meant a finished custom class
    // moved the list's selection onto the affinity row.
    this.classIndex = 0;       // characterDocument.classIndex
    this.classListIndex = 0;   // CreateCharClassSelect's listBox.SelectedIndex
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
    // AUDIT 18: the QUESTIONS path's career. CreateCharClassQuestions_
    // OnClose (:335-343) constructs `new ClassFile(files[0])` and takes
    // its `.Career` on EVERY trip, and ClassFile.Load assigns a fresh
    // `new DFCareer(cfg)` (API/ClassFile.cs:184). DFCareer has no
    // operator== and no Equals override, so SetAddBonusStatsWindow's
    // `DFClass != characterDocument.career` (:238) is a REFERENCE
    // comparison and fires - the stats reroll. The list path is
    // genuinely different: CreateCharClassSelect builds its classList
    // once inside Setup, so re-picking a row hands back the SAME
    // object and does NOT reroll.
    this._questionCareer = null;
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
    // F2: the constellation an answer started (DFU's animPlaying), its
    // release deadline, and the blues the CHART is painted with -
    // written at the animation's END, never at the answer, which is
    // CEL_OnAnimEnd's law.
    this.qAnimIndex = -1;
    this.qAnimDeadline = 0;   // WALL clock: the gate against a host that never ticks at all
    this.qAnimBudget = 0;     // TICKED seconds: the clock the animation itself runs on
    this.qPaintBlues = null;
    /** The CEL seam, injectable exactly as describeClass is, so the
     *  headless suite drives an animation with no renderer. */
    this.constellationAnim = {
      start: startConstellationAnim, tick: tickConstellationAnim, stop: stopConstellationAnim,
    };
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
    // The biography's two text sources, injectable on the same terms
    // and for the same reason: the defaults read chargenArt's
    // _art.textRsc, which only the CLASSIC art load fills, so a host
    // that draws no classic art got an empty backstory and no
    // reputation box - and _finishBiography reads a missing box as
    // "nothing to show" and walks past it. Same shape as the three
    // above; the defaults are unchanged.
    this.buildBackstory = (backstoryId, effects) => buildBackstory(backstoryId, effects);
    this.repBoxRows = (changed) => repBoxRows(changed);
    // The summary's unspent-points refusal, on the same terms - the
    // fifth and last of the flow's TEXT.RSC readers, and the one that
    // gates the OK button. Its default's own fallback is [''], so
    // without a source the box opens EMPTY: a refusal with no reason
    // in it, which reads as a dead button.
    this.bonusPointsRows = () => bonusPointsRows();
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
    // U16 / AUDIT 18: the open "you must distribute your bonus points"
    // box. It belongs to THREE windows, not one - CreateCharAddBonusStats
    // .cs:187-200, CreateCharAddBonusSkills.cs:120-135 and
    // CreateCharSummary.cs:174-189 all pop TEXT.RSC 14 rather than
    // closing when a pool is unspent.
    this.poolBox = null;
    // AUDIT 18: DaggerfallStartNewGameWizard.cs:56 - `bool
    // skillsNeedReroll;`. RAISED by SetChooseBioWindow (:184) and
    // LOWERED only on AddBonusSkillsWindow_OnClose's accept arm
    // (:530); SetAddBonusSkillsWindow passes `!skillsNeedReroll` as
    // isRestored (:256).
    this.skillsNeedReroll = false;
    // AUDIT 18: the stats screen's SAVE ROLL snapshot (rollSaved +
    // savedRolledStats/savedWorkingStats/savedBonusPool,
    // CreateCharAddBonusStats.cs:47-50). Null = rollSaved false, so
    // LOAD ROLL is inert until a save has happened.
    this._savedRoll = null;
  }

  /** U20a: a finished custom class OVERRIDES the careers array -
   *  classIndex then holds the AFFINITY index (the biography quiz's),
   *  exactly as DFU's characterDocument carries career + classIndex
   *  separately.
   *
   *  AUDIT 17m: classIndex is the DOCUMENT's index, so it never names
   *  the Custom ROW - highlighting that row moves classListIndex and
   *  leaves this alone. The `?.` stays as the guard it always was (a
   *  document index with no career behind it must read null, not
   *  throw), but the case it was WRITTEN for - the arrow walk landing
   *  on the Custom row and the raw read throwing, which the live probe
   *  caught - can no longer reach it. */
  get career() { return this.customCareer ?? this._questionCareer ?? this.careers[this.classIndex]?.career ?? null; }
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
   *  starting and working skills rather than rolling.
   *
   *  AUDIT 18: the two rules are NOT the same rule, and collapsing the
   *  skills one onto "the class changed" was the defect - see
   *  _enterSkills. `force` is the stats screen's explicit Reroll
   *  button (:167-170), which rerolls regardless. */
  _enterStats(force = false) {
    // U20a: the memo keys on the CAREER, not its index. DFU compares
    // `createCharAddBonusStatsWindow.DFClass != characterDocument.career`
    // (:238) - an object comparison. Keying on classIndex was
    // equivalent while every class came from the list, but a CUSTOM
    // class carries the AFFINITY index, so a custom whose affinity
    // matched the previously rolled class restored that class's roll
    // instead of rolling for the new career.
    // AUDIT 18: the RESTORE arm moves nothing. DFU's spinner selection
    // is written by StatsRollout.SelectStat, which runs only from
    // SetStats (StatsRollout.cs:190) - and a push that does not reroll
    // never calls it, so the spinner stays on the stat the player left
    // it on. The port zeroed it here and on the skills screen's cancel.
    if (!force && this.rolledStats && this._statsCareer === this.career) return;
    audio.playOneShot(SOUND.DiceRoll, 1);   // StatsRollout.Reroll (:180) - entry roll and the Reroll button alike
    const { stats, bonusPool } = rollStats(this.career, this.rolls);
    this.rolledStats = { ...stats };
    this.stats = { ...stats };
    this.statPool = bonusPool;
    this._statsCareer = this.career;
    this.statCursor = 0;   // Reroll -> SetStats -> SelectStat(0)
  }

  /** AUDIT 18: THE FLAG, NOT A MEMO. DFU gates this window on
   *  `skillsNeedReroll` alone (:256 passes `!skillsNeedReroll` as
   *  isRestored), and that flag is raised by SetChooseBioWindow - which
   *  FIVE arms reach (:344 questions accept, :365 list accept, :401
   *  custom accept, :479 biography cancel, :492 name cancel), two of
   *  them cancels with no class change at all. The port had collapsed
   *  it onto "the career object changed", so walking back from the
   *  skills screen and forward again RESTORED the roll and everything
   *  spent from the three pools where DFU rerolls all nine values and
   *  refunds all three pools (SkillsRollout.Reroll :111-146). */
  _enterSkills(force = false) {
    if (!force && !this.skillsNeedReroll && this.rolledSkills) return;
    // SkillsRollout is constructed ONCE (CreateCharAddBonusSkills.
    // Setup's IsSetup gate), and SelectPrimarySkill(0) with its two
    // siblings run in SetupControls (:245/:253/:261) and NOWHERE else -
    // Reroll leaves all three group selections where they were.
    const first = !this.rolledSkills;
    const { skills, groupPools } = rollSkills(this.career, this.rolls);
    this.rolledSkills = [...skills];
    this.skills = [...skills];
    this.pools = { ...groupPools };
    if (first) { this.skillCursor = 0; this.skillSel = { primary: 0, major: 0, minor: 0 }; }
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
    if (this.classListIndex < this.classScroll) this.classScroll = this.classListIndex;
    else if (this.classListIndex >= this.classScroll + rows) this.classScroll = this.classListIndex - rows + 1;
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
    // AUDIT 18: the no-BIOG fallthrough stands in for the same
    // SetChooseBioWindow push (:344/:365/:401), so it raises
    // skillsNeedReroll too - inert on the real corpus, where all
    // eighteen classes have a BIOG file, but it is DFU's fifth arm.
    this.skillsNeedReroll = true;
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
    this._stopQuestionAnim();   // F2: re-entry news the window - no stale animation end lands on it
    this.qPaintBlues = null;    // AUDIT 17k F1: a fresh run draws the PRISTINE chart
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

  /** One usable scroll step: a whole text row. scrollQuestion is the
   *  1px law (frame wrap included); a discrete input event - wheel
   *  notch, arrow key, margin click - has no held-button repeat here,
   *  so it steps a row or the scroll reads as dead. */
  scrollQuestionRow(dir) {
    for (let i = 0; i < QUESTION_ROW_H; i++) this.scrollQuestion(dir);
  }

  /** The mouse wheel (NativePanel_OnMouseScrollUp/Down): the question
   *  scroll is the one chargen surface with overflow to scroll. */
  wheel(dir) {
    if (this.done || !dir) return;
    if (this.state === 'classQuestions' && !this.qConfirm) this.scrollQuestionRow(dir);
  }

  /** F2: drop an in-flight constellation WITHOUT running its end body
   *  (re-entry and every exit arm). Idempotent, safe with no art. */
  _stopQuestionAnim() {
    if (this.qAnimIndex >= 0) this.constellationAnim.stop();
    this.qAnimIndex = -1;
  }

  /** CEL_OnAnimEnd (:496-513): the animation's texture clears,
   *  animPlaying falls, the chart REPAINTS with the brightened slots,
   *  and either EndQuestions runs or the next question shows. With no
   *  CEL to wait out this runs inline from the answer, which is the
   *  behaviour this screen had before F2. */
  _celAnimEnd() {
    this._stopQuestionAnim();
    this.qPaintBlues = this.constellationBlues();
    if (this.qAnswered === QUESTION_COUNT) this._endClassQuestions();
    else this._displayClassQuestion();
  }

  /** F2: the overlay clock. Every host that mounts chargen reaches
   *  this through its own `tick?.(dt)` seam (the four-hosts rule);
   *  the flow times nothing else, so it returns at once when no
   *  constellation is playing. */
  tick(dt) {
    if (this.qAnimIndex < 0) return;
    // The screen moved on underneath a playing animation: drop it.
    if (this.state !== 'classQuestions' || this.qConfirm) { this._stopQuestionAnim(); return; }
    if (!this.constellationAnim.tick(dt)) { this._celAnimEnd(); return; }
    // AUDIT F2-C1: spend the budget in TICKED time, not wall time. A
    // hidden tab freezes requestAnimationFrame - the animation stops
    // advancing while the wall clock runs on - so a wall-clock
    // watchdog here would kill a perfectly healthy constellation on
    // the first resumed frame. The wall-clock deadline stays on the
    // INPUT path, where it guards a host that never ticks at all.
    this.qAnimBudget -= (dt > 0 ? dt : 0);
    if (this.qAnimBudget <= 0) {
      console.warn('[chargen] constellation animation overran its budget; releasing the screen');
      this._celAnimEnd();
    }
  }

  /** AnswerAndPlayAnim (:310-354) whole, constellations included:
   *  the weight lands and the class resolves SYNCHRONOUSLY, then the
   *  answered constellation lights and the NEXT QUESTION WAITS IT OUT
   *  (DFU's animPlaying lock). choice: 0 a, 1 b, 2 c. */
  answerClassQuestion(choice) {
    if (this.state !== 'classQuestions' || this.qConfirm || this.qAnswered === QUESTION_COUNT) return false;
    // Input is LOCKED while a constellation plays - but only until the
    // deadline, or a host that never ticks would make the character
    // un-creatable (see the QANIM_STUCK constants).
    if (this.qAnimIndex >= 0) {
      if (this._now() < this.qAnimDeadline) return false;
      console.warn('[chargen] constellation animation overran; releasing the questions screen');
      this._celAnimEnd();
      if (this.qConfirm || this.qAnswered === QUESTION_COUNT || this.state !== 'classQuestions') return false;
    }
    const weightIndex = answerWeightIndex(this.qIndices[this.qAnswered], choice);
    this.qWeights[weightIndex]++;   // the constellation's blue increment IS this
    if (this.qAnswered === QUESTION_COUNT - 1) {   // final question answered
      const idx = resolveClassIndex(this.classesData, this.qWeights);
      if (idx === null) {
        // DFU throws "could not find a results match" - corrupt file
        console.warn('[chargen] CLASSES.DAT results walk found no match', this.qWeights);
        this.qClassIndex = NO_CLASS_INDEX;
      } else this.qClassIndex = idx;
    }
    this.qAnswered++;
    const secs = this.constellationAnim.start(weightIndex);   // 0 = no art, no CEL
    audio.playOneShot(SOUND.Ignite, 1);   // AnswerAndPlayAnim (:353) - the brazier lights with the answer
    if (secs > 0) {
      this.qAnimIndex = weightIndex;
      const budgetMs = Math.max(QANIM_STUCK_MIN_MS, secs * 2000) + QANIM_STUCK_PAD_MS;
      this.qAnimDeadline = this._now() + budgetMs;
      this.qAnimBudget = budgetMs / 1000;
    } else {
      this._celAnimEnd();   // nothing to wait out: the end body, at once
    }
    return true;
  }

  /** EndQuestions (:400-413): the background and scroll blank and the
   *  class's DESCRIPTION opens in a Yes/No box on TEXT.RSC 2100 +
   *  index - the same describeClass source the list's pick uses. A
   *  failed results walk, or artless describeClass, closes the screen
   *  the way its box would. */
  _endClassQuestions() {
    this._stopQuestionAnim();   // F2: every way out of the screen drops the animation
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
    this._stopQuestionAnim();   // F2: every way out of the screen drops the animation
    this.qConfirm = null;
    // AUDIT 17m: the DOCUMENT only (:343). This used to scroll the
    // class LIST to the generated class as well, which DFU does not
    // do - CreateCharClassQuestions_OnClose never touches the picker.
    this._adoptCareer(this.qClassIndex, freshCareer(this.careers[this.qClassIndex]?.career));
  }

  /** ConfirmDialog No: classIndex = noClassIndex, both windows close,
   *  and the wizard's OnClose falls to SetClassSelectWindow. */
  _cancelQuestionClass() {
    this._stopQuestionAnim();   // F2: every way out of the screen drops the animation
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
   *  SPELLSWORD set, not the Mage set). Ported bug-for-bug; the
   *  earlier draft "tidied" it and was wrong to.
   *
   *  AUDIT 18: this used to claim the quirk was "recorded in the
   *  Ledger". It is not - Port-Ledger.md section B has no chargen row
   *  of any kind, and its own preamble says a departure not on that
   *  page does not exist. The citation is deleted rather than kept
   *  false; adding the row is a Ledger edit, routed to that owner. */
  _acceptStandardClass() {
    // AUDIT 17m: the LIST's row becomes the DOCUMENT's class here and
    // ONLY here, exactly as :364 copies SelectedClassIndex across. The
    // two were one field before, so this assignment was implicit.
    this._adoptCareer(this.classListIndex);
  }

  /** The shared tail of both accept arms: the document takes a
   *  standard career (so the `career` getter falls back through the
   *  careers array) and the wizard moves to the biography. */
  _adoptCareer(classIndex, career = null) {
    this.classIndex = classIndex;
    this.customCareer = null;
    this._questionCareer = career;
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
      // U20b: the two windows' pick lists. DFU hands EACH window the
      // other's list as `otherList` so CannotAddAdvantage can see
      // across both (:554-586).
      advantages: [],
      disadvantages: [],
      advantageAdjust: 0,
      disadvantageAdjust: 0,
      pickList: null,      // U20b: the open primary/secondary picker's keys
      pickPrimary: null,   // the primary awaiting its secondary
      sub: null,        // null | 'skillPick' | 'help' | 'rep' | 'advantage' | 'disadvantage'
      pickSlot: null,   // which of the twelve buttons opened the picker
      pickCursor: 0,
      pickScroll: 0,
      box: null,        // the open refusal/help box's rows (ClickAnywhereToClose)
    };
    this.state = 'customClass';
  }

  /** The builder's difficulty tally - U20b's advantage/disadvantage
   *  adjustments join here when that window ships. */
  customDifficulty() {
    // U20b: the two adjust terms are REAL now. They were pinned at 0
    // for the whole of U20a, so every custom class advanced at its
    // HP-only rate no matter what it took on.
    return difficultyPoints(this.custom?.hp ?? HP_DEFAULT,
      this.custom?.advantageAdjust ?? 0, this.custom?.disadvantageAdjust ?? 0);
  }

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
    this.customCareer = buildCustomCareer({ name: c.className, hp: c.hp, skills: c.skills, stats: c.stats, points: dp });
    // U20b: ParseCareerData for BOTH windows, after every gate has
    // passed and immediately before the close (:460-470). The picks
    // fold onto the career the builder just minted - tolerances,
    // proficiencies, the magery multiplier, the ability bits.
    parseCareerData(this.customCareer, [...c.advantages, ...c.disadvantages]);
    // AUDIT 17m: the affinity lands on the DOCUMENT (:382) and NOWHERE
    // else. It used to be written onto the one field that was also the
    // picker's selection, and then scrolled to - so a player who built
    // a custom class and pressed Escape off the biography method found
    // the list highlighting a STANDARD class, and confirming there ran
    // _acceptStandardClass and threw the built career away. DFU reuses
    // the class window (:158-167) with its listBox untouched, so the
    // Custom row is still selected and confirming re-opens the builder.
    this.classIndex = classAffinityIndex(c.skills, this.careers);
    // document.reputation* in sGroupReputations order: commoners (the
    // window's PEASANTS column), merchants, scholars, nobility,
    // underworld (PlayerEntity.AssignCharacter :844-848)
    this.customReps = [c.reps.peasants, c.reps.merchants, c.reps.scholars, c.reps.nobility, c.reps.underworld];
    this._leaveClass();
  }

  // ---- U20b: the special advantages / disadvantages window ----

  /** The builder's two buttons (:246-253). Each opens ONE window over
   *  the builder; `sub` names which list is being edited. */
  _openSpecialAdv(which) {
    const c = this.custom;
    c.sub = which;                 // 'advantage' | 'disadvantage'
    c.pickList = null;
    c.pickPrimary = null;
    c.pickCursor = 0;
    c.pickScroll = 0;
  }

  /** The list the open window is editing, and the OTHER one -
   *  CannotAddAdvantage reads both (:556-559). */
  _advList(which = this.custom.sub) { return which === 'advantage' ? this.custom.advantages : this.custom.disadvantages; }
  _advOther(which = this.custom.sub) { return which === 'advantage' ? this.custom.disadvantages : this.custom.advantages; }

  /** AddAdvantageButton_OnMouseClick (:295-310): silently does nothing
   *  at seven items - no message, no sound beyond the button's own. */
  advAdd() {
    const c = this.custom;
    if (this._advList().length >= MAX_ITEMS) return;
    c.pickList = c.sub === 'advantage' ? ADVANTAGE_KEYS : DISADVANTAGE_KEYS;
    c.pickPrimary = null;
    c.pickCursor = 0;
    c.pickScroll = 0;
  }

  /** PrimaryPicker_OnItemPicked (:312-421) then
   *  SecondaryPicker_OnItemPicked (:423-437), folded onto the one
   *  picker seam the port uses. */
  advPick(index) {
    const c = this.custom;
    const key = c.pickList?.[index];
    if (key == null) return;
    if (c.pickPrimary == null) {
      // the ONLY-ONE limit is checked BEFORE the secondary window
      // opens, and DFU simply returns - the window closes with
      // nothing added (:340-346, :390-392)
      if (ONLY_ONE_KEYS.includes(key) && this._advList().some((s) => s.primary === key)) {
        c.pickList = null;
        return;
      }
      const secondary = secondaryListFor(key);
      if (!secondary) {
        const item = { primary: key, secondary: '', difficulty: advDisAdjustment(key, '') };
        c.pickList = null;
        if (cannotAdd(item, this._advList(), this._advOther())) return;
        this._advList().push(item);
        this._advUpdateAdjust();
        return;
      }
      c.pickPrimary = key;
      c.pickList = secondary;
      c.pickCursor = 0;
      c.pickScroll = 0;
      return;
    }
    // the secondary arm
    const primary = c.pickPrimary;
    const item = { primary, secondary: key, difficulty: advDisAdjustment(primary, key) };
    c.pickList = null;
    c.pickPrimary = null;
    if (cannotAdd(item, this._advList(), this._advOther())) return;
    this._advList().push(item);
    this._advUpdateAdjust();
  }

  /** SecondaryPicker_OnCancel (:439-442). DFU pushes the half-built
   *  item onto the list BEFORE opening the secondary window and pops
   *  it on cancel; the port never pushes it, so cancelling is simply
   *  dropping the pending primary - the same end state without the
   *  transient half-item a redraw could catch. */
  advCancelPick() {
    const c = this.custom;
    c.pickList = null;
    c.pickPrimary = null;
  }

  /** AdvantageLabel_OnMouseClick (:436-460): a click on a row REMOVES
   *  that item, and removing an Increased Magery restores the spell
   *  point multiplier to its default. */
  advRemove(index) {
    const c = this.custom;
    const list = this._advList();
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);
    this._advUpdateAdjust();
  }

  /** UpdateDifficultyAdjustment (:534-552) - the window writes its own
   *  total onto the BUILDER, which is what the dagger reads. */
  _advUpdateAdjust() {
    const c = this.custom;
    if (c.sub === 'advantage') c.advantageAdjust = totalAdjust(c.advantages);
    else c.disadvantageAdjust = totalAdjust(c.disadvantages);
  }

  /** ExitButton_OnMouseClick (:462-465) - CloseWindow, nothing gated. */
  advExit() {
    const c = this.custom;
    c.sub = null;
    c.pickList = null;
    c.pickPrimary = null;
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
  /** However many rows the OPEN picker has. Three windows share this
   *  one component now (the skill buttons, the help topics and U20b's
   *  primary/secondary lists), and a per-site count is exactly how the
   *  arrows and the click path drift apart. */
  _pickCount() {
    const c = this.custom;
    if (!c) return 0;
    if (c.pickList) return c.pickList.length;        // U20b
    if (c.sub === 'help') return HELP_TOPICS.length;
    return c.pickItems?.length ?? 0;
  }

  clickPickRow(idx, now) {
    const c = this.custom;
    if (!c) return false;
    const wasDouble = c._lastPickClick != null && (now - c._lastPickClick) < DOUBLE_CLICK_DELAY_MS;
    c.pickCursor = idx;
    this._scrollPick(this._pickCount());
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
    if (c.pickList) this.advPick(idx);   // U20b: primary then secondary
    else if (c.sub === 'skillPick') this.customPickSkill(idx);
    else if (c.sub === 'help') {
      const t = HELP_TOPICS[idx];
      if (t) { c.sub = null; c.box = this.describeText?.(t[1]) ?? [{ text: `TEXT.RSC ${t[1]}`, center: true }]; }
    }
  }

  /** AUDIT 18: however many rows the OPEN picker DISPLAYS. Both
   *  advantage pickers are constructed `new DaggerfallListPickerWindow(
   *  uiManager, this, DaggerfallUI.SmallFont, advPickerItemCount)`
   *  (CreateCharSpecialAdvantageWindow.cs:270, :273), and
   *  advPickerItemCount is 12 (:46). The builder's SKILL and HELP
   *  pickers pass neither font nor row count (CreateCharCustomClass.cs
   *  :283, :368), so they keep ListBox's own default of 9 (ListBox.cs
   *  :36). The port scrolled all three at 9 and drew all three at 9,
   *  which put a scrollbar on an 11-item list DFU shows whole. */
  _pickRows() {
    return this.custom?.pickList ? ADV_PICKER_ITEM_COUNT : CLASS_LIST_ROWS;
  }

  /** The pick list's minimal scroll (the ListBox law the class list
   *  already carries). */
  _scrollPick(n = this.custom?.pickItems?.length ?? 0) {
    const c = this.custom;
    const rows = this._pickRows();
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
   *  CONSTRUCTED fresh each time (:180), so the cursor resets.
   *
   *  AUDIT 18: its other side effect is `skillsNeedReroll = true`
   *  (:184), which does NOT reduce to a class change - the biography
   *  screen's cancel (:479) and the name screen's cancel (:492) reach
   *  this push with the class untouched, and DFU rerolls the skills
   *  for both. */
  _enterBioMethod() {
    this.skillsNeedReroll = true;
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
    this.backStory = this.buildBackstory?.(b.backstoryId, this.biographyEffects) ?? [];
    this.repChanges = digestRepChanges(this.biographyEffects);
    this.biogRepBox = this.repBoxRows?.(this.repChanges) ?? null;
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

  /** AUDIT 18: SetFaceSelectWindow (:213-224) calls SetFaceTextures
   *  OUTSIDE the null-guarded construction block, and that method's
   *  first statement is `facePicker.FaceIndex = 0` - so BOTH arrivals
   *  (NameSelectWindow_OnClose's accept :487 and AddBonusStatsWindow_
   *  OnClose's CANCEL :517) put the picker back on face 0. The port had
   *  no _enterFace at all and kept whatever the last visit chose. */
  _enterFace() {
    this.facePick = 0;
    this.state = 'face';
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
    // The `statsRollout.StartingStats = ...` setter is SetStats
    // (StatsRollout.cs:54-57), which ends in SelectStat(0), so arriving
    // here puts the stat selection back on Strength. The SKILLS
    // selections are NOT reset: SetCharacterSheet only assigns
    // SetSkills, and SelectPrimarySkill and its siblings live in
    // SkillsRollout.SetupControls alone.
    this.statCursor = 0;
    this.statPool = 0;
    this.pools = { primary: 0, major: 0, minor: 0 };
    this.poolBox = null;
    // AUDIT 18: the name box and the reflex picker are the summary's
    // OWN controls, re-seeded from the document by the same setter
    // (`this.textBox.Text = characterDocument.name` :122 and
    // `this.reflexPicker.PlayerReflexes = characterDocument.reflexes`
    // :135). SummaryWindow_OnClose's CANCEL arm (:567-577) copies back
    // only startingSkills, workingSkills, startingStats, workingStats,
    // the three bonus-point counters and faceIndex - name and reflexes
    // are absent from that list, so backing out of the summary REVERTS
    // both. Only GetUpdatedCharacterDocument (:138-148), the OK arm,
    // writes them.
    this.sumName = this.name;
    this.sumReflexes = this.reflexes;
    this.state = 'summary';
  }

  /** U16: OkButton_OnMouseClick (CreateCharSummary.cs:174-189). The
   *  gate is FOUR pools, not one - the stat bonus pool and all three
   *  skill bonus pools - because the summary lets you take points back
   *  DOWN off any of them. Unspent points pop TEXT.RSC 14 as a
   *  ClickAnywhereToClose box rather than closing the window. */
  confirmSummary() {
    if (this.statPool > 0 || this.pools.primary > 0 || this.pools.major > 0 || this.pools.minor > 0) {
      this.poolBox = this.bonusPointsRows?.() ?? [''];
      return;
    }
    // GetUpdatedCharacterDocument (:138-148): the OK arm is where the
    // summary's two own controls reach the document.
    this.name = this.sumName;
    this.reflexes = this.sumReflexes;
    this.state = 'done';
  }

  /** RestartButton_OnMouseClick (:170-174) - PopWindow then OnRestart,
   *  which the wizard answers with SetRaceSelectWindow (:555-558). It
   *  is a SOFT restart: the document survives, so a player who picks
   *  the same class again keeps the stats they rolled (the F7 rule).
   *  The biography is the one thing that must not survive, and
   *  _enterBiography is where that is handled for every arrival. */
  restartSummary() {
    this.poolBox = null;
    this._enterRace();
  }

  /** The STATS screen's Reroll button (CreateCharAddBonusStats.cs:112-113
   *  -> :167-170) - it forces, where re-entry does not.
   *
   *  AUDIT 18: there is no such button on the SKILLS screen and no key
   *  bound to one. CreateCharAddBonusSkills.Setup (:76-99) adds exactly
   *  one control, OK at (263,172,39,22), and SkillsRollout.SetupControls
   *  (:179-260) adds only the nine labels, their select buttons and the
   *  three LeftRightSpinners. The port's 'r' key on that screen rerolled
   *  all nine skills and refunded all three pools - an invented control,
   *  and the exact opposite of the reroll DFU DOES have there
   *  (skillsNeedReroll on re-entry). */
  reroll() {
    if (this.state === 'stats') this._enterStats(true);
  }

  /** AUDIT 18: SaveRoll_OnMouseClick (CreateCharAddBonusStats.cs:172-178)
   *  - the rolled stats, the working stats and the bonus pool are
   *  COPIED into the window's three saved fields and rollSaved goes
   *  true. Neither button existed in the port at all. */
  saveRoll() {
    if (!this.rolledStats) return;
    this._savedRoll = { rolled: { ...this.rolledStats }, working: { ...this.stats }, pool: this.statPool };
  }

  /** LoadRoll_OnMouseClick (:180-186): INERT until a save has happened,
   *  and otherwise statsRollout.SetStats(saved...) - which ends in
   *  SelectStat(0) (StatsRollout.cs:183-191), so the spinner returns to
   *  Strength. */
  loadRoll() {
    const r = this._savedRoll;
    if (!r) return;
    this.rolledStats = { ...r.rolled };
    this.stats = { ...r.working };
    this.statPool = r.pool;
    this.statCursor = 0;
  }

  /** actions: up/down/plus/minus/confirm/back/reroll/char:<c>/backspace */
  input(action) {
    const s = this.state;
    if (s === 'name') {
      if (action.startsWith('char:') && this.name.length < NAME_MAX_CHARACTERS) this.name += action.slice(5);
      else if (action === 'backspace') this.name = this.name.slice(0, -1);
      // AcceptName (CreateCharNameSelect.cs:137-140): an EMPTY name
      // does not close the window, so OK and Return are both inert.
      else if (action === 'confirm' && this.name.length) this._enterFace();
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
        // ButtonKeyboardEvent (DaggerfallMessageBox.cs:496) clicks for
        // keys exactly as the mouse path does (messageBoxHit).
        if (action === 'confirm') { audio.playOneShot(SOUND.ButtonClick, 1); this.raceConfirm = null; this.state = 'gender'; }
        else if (action === 'back') { audio.playOneShot(SOUND.ButtonClick, 1); this.raceConfirm = null; }
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
        this._playRaceClip();
        const rows = this.describeRace?.(this.race) ?? null;
        if (rows?.length) this.raceConfirm = rows;
        else this.state = 'gender';
      } else if (action === 'back') {
        // U-cancel (AUDIT 23 ui-chargen-4): backing out of the FIRST
        // screen cancels the whole wizard - RaceSelectWindow_OnClose's
        // Cancelled arm nulls the race template and re-pushes nothing
        // (DaggerfallStartNewGameWizard.cs:299-302), unwinding the UI
        // stack to the start screen. The flow only FLAGS it; the host
        // owns the unwind (its front door differs per host).
        this.cancelled = true;
        return;
      }
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
        // ButtonKeyboardEvent (DaggerfallMessageBox.cs:496), as the other boxes
        if (action === 'confirm') { audio.playOneShot(SOUND.ButtonClick, 1); this._acceptQuestionClass(); }
        else if (action === 'back') { audio.playOneShot(SOUND.ButtonClick, 1); this._cancelQuestionClass(); }
        return;
      }
      // the A, B and C keys answer (Update :176-181); they arrive
      // through the overlay table as typed characters
      if (action === 'char:a' || action === 'char:A') this.answerClassQuestion(0);
      else if (action === 'char:b' || action === 'char:B') this.answerClassQuestion(1);
      else if (action === 'char:c' || action === 'char:C') this.answerClassQuestion(2);
      // the mouse wheel's scroll (GetUIScrollMovement), on the arrows
      // for the keyboard seam - a row per press (see scrollQuestionRow)
      else if (action === 'down') this.scrollQuestionRow(1);
      else if (action === 'up') this.scrollQuestionRow(-1);
      // Escape cancels the popup with classIndex still noClassIndex,
      // and the wizard's OnClose falls to SetClassSelectWindow
      else if (action === 'back') { this._stopQuestionAnim(); this.state = 'class'; }
      return;
    }
    if (s === 'face') {
      if (action === 'up') this.facePick = (this.facePick + FACES_PER_RACE - 1) % FACES_PER_RACE;
      else if (action === 'down') this.facePick = (this.facePick + 1) % FACES_PER_RACE;
      // FaceSelectWindow_OnClose's accept arm (:496-501) is the ONE
      // place the picker's value reaches the document.
      else if (action === 'confirm') { this.faceIndex = this.facePick; this.state = 'stats'; this._enterStats(); }
      else if (action === 'back') this._enterName();   // the cancel arm (:502-507) writes nothing - and re-entry reseeds + clears, as DFU's push does
      return;
    }
    if (s === 'class') {
      // U17: the description box is MODAL over the list, like the race
      // screen's - its own confirm and back are Yes and No.
      if (this.classConfirm) {
        // ButtonKeyboardEvent (DaggerfallMessageBox.cs:496), as the race box
        if (action === 'confirm') { audio.playOneShot(SOUND.ButtonClick, 1); this.classConfirm = null; this._acceptStandardClass(); }
        else if (action === 'back') { audio.playOneShot(SOUND.ButtonClick, 1); this.classConfirm = null; }
        return;
      }
      // U20a: ListBox.SelectPrevious/SelectNext CLAMP (ListBox.cs
      // :709-740 - both guard `if (selectedIndex > 0)` /
      // `< listItems.Count - 1`). The port wrapped with a modulo, so
      // the list ran off its own ends onto the far one; the FacePicker
      // wrap the face screen uses is that component's OWN law
      // (FacePicker.cs:116-127), not this one's.
      if (action === 'up') { this.classListIndex = Math.max(0, this.classListIndex - 1); this._scrollToClass(); }
      else if (action === 'down') { this.classListIndex = Math.min(this.classRowCount() - 1, this.classListIndex + 1); this._scrollToClass(); }
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
      if (c.sub === 'advantage' || c.sub === 'disadvantage') {
        // U20b. The two pickers are DaggerfallListPickerWindows pushed
        // OVER the window, so they take the keys while open; Escape is
        // SecondaryPicker_OnCancel (:439-442) on the secondary and the
        // primary picker's own cancel otherwise.
        if (c.pickList) {
          const n = this._pickCount();
          if (action === 'up') { c.pickCursor = Math.max(0, c.pickCursor - 1); this._scrollPick(n); }
          else if (action === 'down') { c.pickCursor = Math.min(n - 1, c.pickCursor + 1); this._scrollPick(n); }
          else if (action === 'confirm') this.usePickRow(c.pickCursor);
          else if (action === 'back') this.advCancelPick();
          return;
        }
        // the window itself: Return is the ADD button, Escape the exit
        if (action === 'confirm') this.advAdd();
        else if (action === 'back') this.advExit();
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
      // the 31-char default cap), Return attempts the gated exit,
      // Escape cancels to the list (the wizard's cancel arm :403-406).
      //
      // AUDIT 17m: there is NO keyboard stat control here. DFU's stat
      // steps are UpDownSpinner *Button* handlers (StatsRollout.cs
      // :231-256, :259-281) - mouse only, nothing binds them to a key -
      // while the name TextBox holds focus with no character filter
      // (CreateCharCustomClass.cs:156-158). The port had a 'plus' arm
      // that spent a point, and a 'minus' arm that was DEAD: the shared
      // overlay table (ui/input.js:18) matches '-' inside its char
      // class first, so '-' arrives as 'char:-' and types a hyphen into
      // the class name, exactly as DFU's unfiltered TextBox does. The
      // pair was therefore asymmetric - a keyboard could spend from the
      // freeEdit pool and never refund it. The pool moves by CLICK, as
      // DFU's does. RESIDUAL, small and deliberate: DFU would type a
      // literal '+' into the name where the port's table has already
      // spent that key on 'plus' for the stats and skills screens (no
      // text box there), so '+' is inert here rather than typed.
      if (action.startsWith('char:') && c.className.length < NAME_MAX_CHARACTERS) c.className += action.slice(5);
      else if (action === 'backspace') c.className = c.className.slice(0, -1);
      else if (action === 'up') c.statCursor = (c.statCursor + 7) % 8;
      else if (action === 'down') c.statCursor = (c.statCursor + 1) % 8;
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
      // AUDIT 18: the TEXT.RSC 14 box is ClickAnywhereToClose and
      // MODAL over the window (CreateCharAddBonusStats.cs:189-194).
      if (this.poolBox) { this.poolBox = null; return; }
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
      // AUDIT 18: OkButton_OnMouseClick (:187-200) does not SWALLOW the
      // click when the pool is unspent - it pops TEXT.RSC 14
      // (strYouMustDistributeYourBonusPoints, :33) as a
      // ClickAnywhereToClose message box. The port's guarded no-op left
      // the live OK button doing nothing at all.
      else if (action === 'confirm') {
        if (this.statPool > 0) this.poolBox = bonusPointsRows?.() ?? [''];
        else { this.state = 'skills'; this._enterSkills(); }
      } else if (action === 'back') this._enterFace();
      return;
    }
    if (s === 'reflexes') {
      // ReflexPicker: five rows, VeryHigh at the top. Classic has no
      // keyboard path (you click a row), so up/down walk them.
      if (action === 'up') this.reflexes = Math.max(0, this.reflexes - 1);
      else if (action === 'down') this.reflexes = Math.min(REFLEX_COUNT - 1, this.reflexes + 1);
      else if (action === 'confirm') this._enterSummary();   // U16: SetSummaryWindow (:551-558)
      else if (action === 'back') this.state = 'skills';   // AUDIT 23 (ui-chargen-1): the spinner cursor survives, as SkillsRollout's restore does
      return;
    }
    if (s === 'summary') {
      // U16: CHAR04I0 composites the stats, skills, face and reflex
      // components on one screen with the name box, so nearly every
      // control is live here. The four things SummaryWindow_OnClose's
      // cancel arm copies BACK to the windows behind it (:567-577) -
      // skills, stats, bonus points and faceIndex - need no equivalent
      // here, because the port edits ONE flow object. AUDIT 18: what
      // DOES need one is the pair that arm OMITS. See _enterSummary.
      if (this.poolBox) { this.poolBox = null; return; }   // ClickAnywhereToClose
      if (action.startsWith('char:') && this.sumName.length < NAME_MAX_CHARACTERS) this.sumName += action.slice(5);
      else if (action === 'backspace') this.sumName = this.sumName.slice(0, -1);
      else if (action === 'confirm') this.confirmSummary();
      else if (action === 'back') { this.state = 'reflexes'; }
      return;
    }
    if (s === 'skills') {
      if (this.poolBox) { this.poolBox = null; return; }   // ClickAnywhereToClose (CreateCharAddBonusSkills.cs:126-130)
      const total = this.skillRows().reduce((a, [, ids]) => a + ids.length, 0);
      if (action === 'up') { this.skillCursor = (this.skillCursor + total - 1) % total; this._syncSkillSel(); }
      else if (action === 'down') { this.skillCursor = (this.skillCursor + 1) % total; this._syncSkillSel(); }
      else if (action === 'plus') this.spendSkill(1);
      else if (action === 'minus' || action === 'char:-') this.spendSkill(-1);   // the same unreachable-minus fix
      // AUDIT 18: the same TEXT.RSC 14 box as the stats screen
      // (:120-135), and the accept arm is the ONE place DFU lowers
      // skillsNeedReroll (:525-530).
      else if (action === 'confirm') {
        if (this.pools.primary > 0 || this.pools.major > 0 || this.pools.minor > 0) this.poolBox = bonusPointsRows?.() ?? [''];
        else { this.skillsNeedReroll = false; this.state = 'reflexes'; }
      } else if (action === 'back') this.state = 'stats';
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
    this.classListIndex = idx;   // MouseClick moves the LIST's selection
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
    if (this.classListIndex === this.careers.length) {
      // :356-359 - the flag is raised HERE, at the row pick, before
      // the builder is even constructed (and is never lowered again)
      this.isCustom = true;
      this._enterCustomClass();
      return;
    }
    audio.playOneShot(SOUND.SelectClassDrums, 1);   // CreateCharClassSelect (:93-94) - the pick opens the confirm under drums
    this.classConfirm = this.describeClass?.(this.classListIndex) ?? null;
    if (!this.classConfirm) this._acceptStandardClass();   // no description available: the pick stands
  }

  /** U14: the pure apply step - a hit from chargenHit -> the state it
   *  changes. Split out from clickNative so the pointer path is
   *  testable without art, the way chargenHit already is. */
  /** CreateCharRaceSelect (:115) plays RaceTemplate.ClipID - a BSA
   *  sound id resolved through SndFile.GetRecordIndex, the verbatim
   *  path ("From high in the Wrothgarian mountains..."). */
  _playRaceClip() {
    const idx = audio.snd?.getRecordIndex(RACE_TEMPLATES[this.raceIndex]?.clipId) ?? -1;
    if (idx >= 0) audio.playOneShot(idx, 1);
  }

  applyHit(hit) {
    if (!hit) return false;
    if (typeof hit === 'string') { this.input(hit); return true; }
    if (hit.setRace != null) {
      this.raceIndex = RACE_TEMPLATES.findIndex((r) => r.key === hit.setRace);
      this._playRaceClip();
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
    if (hit.saveRoll) { this.saveRoll(); return true; }
    if (hit.loadRoll) { this.loadRoll(); return true; }
    if (hit.setStatCursor != null) { this.statCursor = hit.setStatCursor; return true; }
    if (hit.setSkillCursor != null) { this.skillCursor = hit.setSkillCursor; this._syncSkillSel(); return true; }
    if (hit.setClass != null) { this.classListIndex = hit.setClass; return true; }
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
    if (hit.qScroll != null) { this.scrollQuestionRow(hit.qScroll); return true; }
    if (hit.confirmQClass) { this._acceptQuestionClass(); return true; }
    if (hit.cancelQClass) { this._cancelQuestionClass(); return true; }
    // U20a: the custom-class builder's controls. Every builder BUTTON
    // clicks: CreateCharCustomClass ClickSounds (:227-264, :408), the
    // special advantage window (:257-260), the reputation window
    // (:121, :180) and the freeEdit StatsRollout spinners (:228, :255,
    // :279) all assign SoundClips.ButtonClick.
    if (hit.customSkill != null || hit.customHp != null || hit.customHelp
      || hit.customAdvantage || hit.customDisadvantage || hit.advAdd || hit.advExit
      || hit.advRemove != null || hit.customRep || hit.customExit || hit.repExit
      || hit.customStatCursor != null || hit.customStatStep != null) {
      audio.playOneShot(SOUND.ButtonClick, 1);
    }
    if (hit.customSkill != null) { this.customOpenSkillPick(hit.customSkill); return true; }
    if (hit.customHp != null) { this.customHp(hit.customHp); return true; }
    if (hit.customHelp) {
      const c = this.custom;
      c.sub = 'help'; c.pickCursor = 0; c.pickScroll = 0;
      return true;
    }
    if (hit.customAdvantage) { this._openSpecialAdv('advantage'); return true; }
    if (hit.customDisadvantage) { this._openSpecialAdv('disadvantage'); return true; }
    if (hit.advAdd) { this.advAdd(); return true; }
    if (hit.advExit) { this.advExit(); return true; }
    if (hit.advRemove != null) { this.advRemove(hit.advRemove); return true; }
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
      const n = this._pickCount();
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
    // AUDIT 18: two ReflexPickers, two values - the reflex SCREEN's
    // (CreateCharReflexSelect, whose accept arm writes the document at
    // :543) and the SUMMARY's own (:135/:147), which the cancel arm
    // does not copy back.
    if (hit.setReflexes != null) {
      if (this.state === 'summary') this.sumReflexes = hit.setReflexes;
      else this.reflexes = hit.setReflexes;
      return true;
    }
    if (hit.restart) { this.restartSummary(); return true; }
    // U16: the summary's FacePicker keeps its PREVIOUS/NEXT buttons,
    // but 'up'/'down' belong to the face SCREEN's state arm - the
    // summary has no such arm, so the step is explicit.
    if (hit.statStep != null) { this.spendStat(hit.statStep); return true; }
    if (hit.skillStep != null) { this.spendSkill(hit.skillStep, hit.group ?? null); return true; }
    if (hit.faceStep != null) {
      // AUDIT 18: the SUMMARY's FacePicker is seeded from the document
      // (CreateCharSummary.SetCharacterSheet :132) and its cancel arm
      // copies FaceIndex straight BACK (:575), so a summary face edit
      // legitimately writes the document. The face SCREEN's picker is
      // its own value until OK commits it.
      if (this.state === 'face') this.facePick = (this.facePick + FACES_PER_RACE + hit.faceStep) % FACES_PER_RACE;
      else this.faceIndex = (this.faceIndex + FACES_PER_RACE + hit.faceStep) % FACES_PER_RACE;
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
      isCustom: this.isCustom, customReps: this.customReps,
      // S25: FACTION.TXT travels on the RESULT so finishChargen can
      // build the reputation store without any host unpacking it.
      factionDict: this.factionDict };
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
      line(`face ${this.facePick + 1} of ${FACES_PER_RACE}`, 2, hot);
      line('up/down to cycle, ENTER to continue', 4, dim);
      line('(the portrait draws with the chargen art slice)', 6, dim);
    } else if (this.state === 'class') {
      title('CHOOSE YOUR CLASS');
      for (let i = 0; i < this.classRowCount(); i++) {
        line((i === this.classListIndex ? '> ' : '  ') + this.classRowName(i), i, i === this.classListIndex ? hot : white);
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
      line('+/- assign   ENTER when pools 0', row, dim);
    }
  }
}
