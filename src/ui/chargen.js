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
import { buildBackstory, repBoxRows } from './chargenArt.js';   // U13
import { RACE_TEMPLATES, FACES_PER_RACE } from '../systems/races.js';   // S3c/U9
import { SKILL_NAMES } from '../systems/skills.js';
import { drawText, measureText } from './text.js';
import { nativeMetrics } from './nativePanel.js';
import { chargenArtLoaded, drawChargenNative, loadFaceSet, chargenHit, raceDescriptionLines, CLASS_LIST_ROWS, PLAYER_REFLEXES, REFLEX_COUNT } from './chargenArt.js';   // U10

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
const STATES = ['name', 'race', 'gender', 'face', 'class', 'biography', 'stats', 'skills', 'reflexes', 'done'];

export class ChargenFlow {
  /** careers: [{ name, career }] x18 (loaded from CLASS*.CFG). */
  constructor(careers, rolls = Math.random) {
    this.careers = careers;
    this.rolls = rolls;
    this.state = 'name';
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
    // AUDIT 17g F5: the description source, so BOTH the click and the
    // keyboard confirm open the same box. Null until the art loads.
    this.describeRace = (race) => raceDescriptionLines(race);
    this.cursor = 0;
    this._rolled = null;
  }

  get career() { return this.careers[this.classIndex].career; }
  get race() { return RACE_TEMPLATES[this.raceIndex]; }

  _enterStats() {
    const { stats, bonusPool } = rollStats(this.career, this.rolls);
    this.rolledStats = { ...stats };
    this.stats = { ...stats };
    this.statPool = bonusPool;
    this.cursor = 0;
  }

  _enterSkills() {
    const { skills, groupPools } = rollSkills(this.career, this.rolls);
    this.rolledSkills = [...skills];
    this.skills = [...skills];
    this.pools = { ...groupPools };
    this.cursor = 0;
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
      if (i < ids.length) return { group, id: ids[i] };
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
    this.biogQuestionIndex = 0;
    this.cursor = 0;
    if (this.biogFor?.(this.classIndex)?.questions?.length) this.state = 'biography';
    else this._leaveBiography();
  }

  _leaveBiography() { this.state = 'stats'; this._enterStats(); }

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

  reroll() {
    if (this.state === 'stats') this._enterStats();
    else if (this.state === 'skills') this._enterSkills();
  }

  /** actions: up/down/plus/minus/confirm/back/reroll/char:<c>/backspace */
  input(action) {
    const s = this.state;
    if (s === 'name') {
      if (action.startsWith('char:') && this.name.length < 16) this.name += action.slice(5);
      else if (action === 'backspace') this.name = this.name.slice(0, -1);
      else if (action === 'confirm' && this.name.length) this.state = 'race';
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
      } else if (action === 'back') this.state = 'name';
      return;
    }
    if (s === 'gender') {
      if (action === 'up' || action === 'down') this.gender = this.gender === 'male' ? 'female' : 'male';
      else if (action === 'confirm') this.state = 'face';
      else if (action === 'back') this.state = 'race';
      return;
    }
    if (s === 'face') {
      if (action === 'up') this.faceIndex = (this.faceIndex + FACES_PER_RACE - 1) % FACES_PER_RACE;
      else if (action === 'down') this.faceIndex = (this.faceIndex + 1) % FACES_PER_RACE;
      else if (action === 'confirm') this.state = 'class';
      else if (action === 'back') this.state = 'gender';
      return;
    }
    if (s === 'class') {
      if (action === 'up') { this.classIndex = (this.classIndex + this.careers.length - 1) % this.careers.length; this._scrollToClass(); }
      else if (action === 'down') { this.classIndex = (this.classIndex + 1) % this.careers.length; this._scrollToClass(); }
      else if (action === 'confirm') this._leaveClass();
      else if (action === 'back') this.state = 'face';
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
      const key = STAT_KEYS_ORDER[this.cursor];
      if (action === 'up') this.cursor = (this.cursor + 7) % 8;
      else if (action === 'down') this.cursor = (this.cursor + 1) % 8;
      else if (action === 'plus') { const r = statUp(this.stats[key], this.statPool); this.stats[key] = r.working; this.statPool = r.pool; }
      else if (action === 'minus') { const r = statDown(this.stats[key], this.rolledStats[key], this.statPool); this.stats[key] = r.working; this.statPool = r.pool; }
      else if (action === 'reroll') this.reroll();
      else if (action === 'confirm' && this.statPool === 0) { this.state = 'skills'; this._enterSkills(); }   // classic requires the pool spent
      else if (action === 'back') this.state = 'class';
      return;
    }
    if (s === 'reflexes') {
      // ReflexPicker: five rows, VeryHigh at the top. Classic has no
      // keyboard path (you click a row), so up/down walk them.
      if (action === 'up') this.reflexes = Math.max(0, this.reflexes - 1);
      else if (action === 'down') this.reflexes = Math.min(REFLEX_COUNT - 1, this.reflexes + 1);
      else if (action === 'confirm') this.state = 'done';
      else if (action === 'back') { this.state = 'skills'; this.cursor = 0; }
      return;
    }
    if (s === 'skills') {
      const total = this.skillRows().reduce((a, [, ids]) => a + ids.length, 0);
      const at = this._skillAt(this.cursor);
      if (action === 'up') this.cursor = (this.cursor + total - 1) % total;
      else if (action === 'down') this.cursor = (this.cursor + 1) % total;
      else if (action === 'plus' && at) { const r = skillUp(this.skills[at.id], this.pools[at.group]); this.skills[at.id] = r.working; this.pools[at.group] = r.pool; }
      else if (action === 'minus' && at) { const r = skillDown(this.skills[at.id], this.rolledSkills[at.id], this.pools[at.group]); this.skills[at.id] = r.working; this.pools[at.group] = r.pool; }
      else if (action === 'reroll') this.reroll();
      else if (action === 'confirm' && this.pools.primary === 0 && this.pools.major === 0 && this.pools.minor === 0) this.state = 'reflexes';
      else if (action === 'back') { this.state = 'stats'; this.cursor = 0; }
      return;
    }
  }

  /** U10: a NATIVE-panel point (the townTalk overlay seam's own
   *  coordinate space) -> the flow state it changes. Returns true
   *  when the click was consumed. `setRace`/`setGender`/
   *  `setCursor` are the direct-set hits classic's windows have and
   *  the keyboard flow reaches by stepping. */
  clickNative(vx, vy) {
    if (!chargenArtLoaded()) return false;
    const hit = chargenHit(this, vx, vy);
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
    if (hit.setGender != null) { this.gender = hit.setGender; return true; }
    if (hit.setCursor != null) { this.cursor = hit.setCursor; return true; }
    if (hit.setClass != null) { this.classIndex = hit.setClass; return true; }
    if (hit.answerBiography != null) return this.answerBiography(hit.answerBiography);
    if (hit.setReflexes != null) { this.reflexes = hit.setReflexes; return true; }
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
        `${i === this.cursor ? '> ' : '  '}${k.slice(0, 3).toUpperCase()}  ${this.stats[k]}`,
        i, i === this.cursor ? hot : white));
      line('+/- assign   R reroll   ENTER when pool 0', 10, dim);
    } else if (this.state === 'skills') {
      title(`SKILLS  P:${this.pools.primary} M:${this.pools.major} m:${this.pools.minor}`);
      let row = 0, idx = 0;
      for (const [group, ids] of this.skillRows()) {
        for (const id of ids) {
          line(`${idx === this.cursor ? '> ' : '  '}${SKILL_NAMES[id]}  ${this.skills[id]}`, row, idx === this.cursor ? hot : white);
          row++; idx++;
        }
        row++;
      }
      line('+/- assign   R reroll   ENTER when pools 0', row, dim);
    }
  }
}
