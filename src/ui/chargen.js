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
import { damageModifier, maxEncumbrance, magicResist, toHitModifier, hitPointsModifier, healingRateModifier } from '../combat/formulas.js';   // U10: the derived block
import { tagEffect, biographySkillBonuses, digestRepChanges } from '../systems/biography.js';   // S3e
import { fullName, getNameBank, GENDERS } from '../characters/nameHelper.js';   // U15
import { srand } from '../formats/dfRandom.js';   // AUDIT 17j F1: the name screen's reseed
import { buildBackstory, repBoxRows, bonusPointsRows } from './chargenArt.js';   // U13 / U16
import { RACE_TEMPLATES, FACES_PER_RACE } from '../systems/races.js';   // S3c/U9
import { SKILL_NAMES } from '../systems/skills.js';
import { drawText, measureText } from './text.js';
import { nativeMetrics } from './nativePanel.js';
import { chargenArtLoaded, drawChargenNative, loadFaceSet, chargenHit, raceDescriptionLines, classDescriptionLines, DOUBLE_CLICK_DELAY_MS, CLASS_LIST_ROWS, PLAYER_REFLEXES, REFLEX_COUNT } from './chargenArt.js';   // U10 / U17

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
// SelectBiographyMethod, BiographyQuestions, SelectName...). FLAGGED:
// the port's overall ORDER already differs from DFU's (we ask the name
// first and the face early); moving the whole wizard onto the classic
// sequence is its own slice. What matters for the effects is the
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
const STATES = ['race', 'gender', 'class', 'biography', 'name', 'face', 'stats', 'skills', 'reflexes', 'summary', 'done'];

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
    // AUDIT 17g F5: the description source, so BOTH the click and the
    // keyboard confirm open the same box. Null until the art loads.
    this.describeRace = (race) => raceDescriptionLines(race);
    // U17: the same shape for the CLASS description box, so the pins
    // can drive it without the art the way the race box's can.
    this.describeClass = (i) => classDescriptionLines(i);
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

  get career() { return this.careers[this.classIndex].career; }
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
    if (!force && this.rolledStats && this._statsClassIndex === this.classIndex) { this.statCursor = 0; return; }
    const { stats, bonusPool } = rollStats(this.career, this.rolls);
    this.rolledStats = { ...stats };
    this.stats = { ...stats };
    this.statPool = bonusPool;
    this._statsClassIndex = this.classIndex;
    this.statCursor = 0;
  }

  _enterSkills(force = false) {
    if (!force && this.rolledSkills && this._skillsClassIndex === this.classIndex) { this.skillCursor = 0; return; }
    const { skills, groupPools } = rollSkills(this.career, this.rolls);
    this.rolledSkills = [...skills];
    this.skills = [...skills];
    this.pools = { ...groupPools };
    this._skillsClassIndex = this.classIndex;
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
    const n = this.careers.length;
    const max = Math.max(0, n - rows);
    if (this.classIndex < this.classScroll) this.classScroll = this.classIndex;
    else if (this.classIndex >= this.classScroll + rows) this.classScroll = this.classIndex - rows + 1;
    this.classScroll = Math.max(0, Math.min(max, this.classScroll));
  }

  /** S3e: the class choice leads into the biography when its file
   *  loaded, and straight to the stats roll when it did not. */
  _leaveClass() {
    if (this.biogFor?.(this.classIndex)?.questions?.length) this._enterBiography();
    else this._leaveBiography();   // U15: -> name, the classic next screen
  }

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
    this.biogQuestionIndex = 0;
    this.cursor = 0;
    this.biographyEffects = [];
    this.backStory = [];
    this.repChanges = null;
    this.biogRepBox = null;
    this.state = 'biography';
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

  /** AUDIT 17j F3: the name screen's cancel. DFU sends it to
   *  SetChooseBioWindow, which on its way forward CONSTRUCTS a fresh
   *  CreateCharBiography over a fresh BiogFile - so the questions
   *  restart and the answers so far are DISCARDED. That discard is
   *  load-bearing here and not cosmetic: answerBiography appends to
   *  biographyEffects, so re-answering without it would apply every
   *  effect twice. With no question set for this class there is no
   *  screen to go back to, and the cancel is inert. */
  _enterBiographyBack() {
    if (!this.biogFor?.(this.classIndex)?.questions?.length) return;
    this._enterBiography();
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
    else {
      // U13: the last answer composes the BACKSTORY and pops the
      // reputation box (CreateCharBiography.cs:143-152) - a
      // ClickAnywhereToClose message box on TEXT.RSC 35, whose %r1..%r5
      // are DigestRepChanges' per-group totals.
      const b = this.biogFor(this.classIndex);
      this.backStory = buildBackstory?.(b.backstoryId, this.biographyEffects) ?? [];
      this.repChanges = digestRepChanges(this.biographyEffects);
      this.biogRepBox = repBoxRows?.(this.repChanges) ?? null;
      if (!this.biogRepBox?.length) this._leaveBiography();
    }
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
      else if (action === 'confirm') this.state = 'class';
      else if (action === 'back') this.state = 'race';
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
        if (action === 'confirm') { this.classConfirm = null; this._leaveClass(); }
        else if (action === 'back') this.classConfirm = null;
        return;
      }
      if (action === 'up') { this.classIndex = (this.classIndex + this.careers.length - 1) % this.careers.length; this._scrollToClass(); }
      else if (action === 'down') { this.classIndex = (this.classIndex + 1) % this.careers.length; this._scrollToClass(); }
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
      return;
    }
    if (s === 'stats') {
      if (action === 'up') this.statCursor = (this.statCursor + 7) % 8;
      else if (action === 'down') this.statCursor = (this.statCursor + 1) % 8;
      else if (action === 'plus') this.spendStat(1);
      else if (action === 'minus') this.spendStat(-1);
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
      else if (action === 'minus') this.spendSkill(-1);
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
   *  drops the selection and returns to the list. */
  useClass() {
    this.classConfirm = this.describeClass?.(this.classIndex) ?? null;
    if (!this.classConfirm) this._leaveClass();   // no description available: the pick stands
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
      this.gender = hit.setGender;
      this.state = 'class';
      return true;
    }
    if (hit.setStatCursor != null) { this.statCursor = hit.setStatCursor; return true; }
    if (hit.setSkillCursor != null) { this.skillCursor = hit.setSkillCursor; this._syncSkillSel(); return true; }
    if (hit.setClass != null) { this.classIndex = hit.setClass; return true; }
    if (hit.confirmClass) { this.classConfirm = null; this._leaveClass(); return true; }
    if (hit.cancelClass) { this.classConfirm = null; return true; }
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
    return { name: this.name, gender: this.gender, race: this.race.key, raceId: this.race.id, faceIndex: this.faceIndex, careerIndex: this.classIndex, career: this.career, stats: this.stats, skills: this.skills, biographyEffects: this.biographyEffects, reflexes: this.reflexes, backStory: this.backStory };
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
      this.careers.forEach((c, i) => line((i === this.classIndex ? '> ' : '  ') + c.name, i, i === this.classIndex ? hot : white));
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
