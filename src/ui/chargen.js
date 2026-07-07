// Character-creation UI (UI arc, U2b). The flow that retires the
// Warrior-16 default and the lowest-first pool policy: name ->
// gender -> class -> stats -> skills -> done, with the pool
// distribution rules VERBATIM from DFU StatsRollout/SkillsRollout:
//   stats:  + blocked at MaxStatValue (100) or pool 0;
//           - blocked at the ROLLED value (points return to pool)
//   skills: + blocked at group pool 0 (no upper clamp);
//           - blocked at the ROLLED value
// Both screens offer REROLL, exactly the rollout components' own.
// Screens draw as clean text panels on drawScreenQuad; the classic
// background ART is FLAGGED pending art-name verification against
// real ARENA2 (no data in this container - Mac signs off visuals).
// Race/face pend their systems (racial saving flags, paperdoll).

import { rollStats, rollSkills, STAT_KEYS_ORDER } from '../systems/chargen.js';
import { SKILL_NAMES } from '../systems/skills.js';
import { drawText, measureText } from './text.js';

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

const STATES = ['name', 'gender', 'class', 'stats', 'skills', 'done'];

export class ChargenFlow {
  /** careers: [{ name, career }] x18 (loaded from CLASS*.CFG). */
  constructor(careers, rolls = Math.random) {
    this.careers = careers;
    this.rolls = rolls;
    this.state = 'name';
    this.name = '';
    this.gender = 'male';
    this.classIndex = 0;
    this.cursor = 0;
    this._rolled = null;
  }

  get career() { return this.careers[this.classIndex].career; }

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
      else if (action === 'confirm' && this.name.length) this.state = 'gender';
      return;
    }
    if (s === 'gender') {
      if (action === 'up' || action === 'down') this.gender = this.gender === 'male' ? 'female' : 'male';
      else if (action === 'confirm') this.state = 'class';
      else if (action === 'back') this.state = 'name';
      return;
    }
    if (s === 'class') {
      if (action === 'up') this.classIndex = (this.classIndex + this.careers.length - 1) % this.careers.length;
      else if (action === 'down') this.classIndex = (this.classIndex + 1) % this.careers.length;
      else if (action === 'confirm') { this.state = 'stats'; this._enterStats(); }
      else if (action === 'back') this.state = 'gender';
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
    if (s === 'skills') {
      const total = this.skillRows().reduce((a, [, ids]) => a + ids.length, 0);
      const at = this._skillAt(this.cursor);
      if (action === 'up') this.cursor = (this.cursor + total - 1) % total;
      else if (action === 'down') this.cursor = (this.cursor + 1) % total;
      else if (action === 'plus' && at) { const r = skillUp(this.skills[at.id], this.pools[at.group]); this.skills[at.id] = r.working; this.pools[at.group] = r.pool; }
      else if (action === 'minus' && at) { const r = skillDown(this.skills[at.id], this.rolledSkills[at.id], this.pools[at.group]); this.skills[at.id] = r.working; this.pools[at.group] = r.pool; }
      else if (action === 'reroll') this.reroll();
      else if (action === 'confirm' && this.pools.primary === 0 && this.pools.major === 0 && this.pools.minor === 0) this.state = 'done';
      else if (action === 'back') { this.state = 'stats'; this.cursor = 0; }
      return;
    }
  }

  get done() { return this.state === 'done'; }
  result() {
    return { name: this.name, gender: this.gender, careerIndex: this.classIndex, career: this.career, stats: this.stats, skills: this.skills };
  }

  // ---- drawing: clean classic-text panels (art FLAGGED, see head) ----
  draw(renderer, canvas, font, scale) {
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
