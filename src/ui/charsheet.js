// Character sheet + level-up (UI arc, U3). The level-up screen
// retires the headless auto-apply: DFU sets readyToLevelUp and the
// char sheet applies - here the screen shows the pending level and
// hands the 4..6 pool to the SAME verbatim stat clamps chargen uses
// (statUp/statDown: max 100 / pool 0 / floor at the pre-level
// value). The sheet itself is the classic read-only page (name,
// class, level, HP/MP, stats, skills by group) in classic text; the
// classic INFO background ART is FLAGGED pending art-name
// verification against real ARENA2.

import { statUp, statDown } from './chargen.js';
import { STAT_KEYS_ORDER } from '../systems/chargen.js';
import { SKILL_NAMES } from '../systems/skills.js';
import { applyLevelUp, LEVELUP_BONUS_POOL_MIN, LEVELUP_BONUS_POOL_MAX } from '../systems/advancement.js';
import { drawText, measureText } from './text.js';

export class LevelUpScreen {
  constructor(entity, rolls = Math.random) {
    this.entity = entity;
    // Roll the pool NOW so the screen can show it; the base stats are
    // the floors (statDown returns points only above them).
    this.pool = LEVELUP_BONUS_POOL_MIN + Math.floor(rolls() * (LEVELUP_BONUS_POOL_MAX + 1 - LEVELUP_BONUS_POOL_MIN));
    this._rolledPool = this.pool;
    this.base = { ...entity.stats };
    this.working = { ...entity.stats };
    this.cursor = 0;
    this.done = false;
    this._rolls = rolls;
  }

  input(action) {
    const key = STAT_KEYS_ORDER[this.cursor];
    if (action === 'up') this.cursor = (this.cursor + 7) % 8;
    else if (action === 'down') this.cursor = (this.cursor + 1) % 8;
    else if (action === 'plus') { const r = statUp(this.working[key], this.pool); this.working[key] = r.working; this.pool = r.pool; }
    else if (action === 'minus') { const r = statDown(this.working[key], this.base[key], this.pool); this.working[key] = r.working; this.pool = r.pool; }
    else if (action === 'confirm' && this.pool === 0) {
      // applyLevelUp rolls HP; our pre-rolled pool distributes here -
      // the distribute hook writes the hand-built stats.
      applyLevelUp(this.entity, (stats) => Object.assign(stats, this.working), this._rolls);
      this.done = true;
    }
  }

  draw(renderer, canvas, font, s) {
    const W = canvas.width, H = canvas.height;
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: W, h: H }, undefined, [0.04, 0.03, 0.02, 0.92]);
    const gold = [0.85, 0.72, 0.35, 1], white = [0.9, 0.9, 0.85, 1], hot = [1, 0.95, 0.6, 1], dim = [0.5, 0.5, 0.45, 1];
    const t = `LEVEL ${this.entity.pendingLevel}!  POOL: ${this.pool}`;
    drawText(renderer, font, t, (W - measureText(font.fnt, t) * s) / 2, 24 * s, s, gold);
    STAT_KEYS_ORDER.forEach((k, i) => drawText(renderer, font,
      `${i === this.cursor ? '> ' : '  '}${k.slice(0, 3).toUpperCase()}  ${this.working[k]}`,
      40 * s, (56 + i * 12) * s, s, i === this.cursor ? hot : white));
    drawText(renderer, font, '+/- assign   ENTER when pool 0', 40 * s, (56 + 10 * 12) * s, s, dim);
  }
}

/** The classic read-only sheet (F5). Toggle-closed by the same key
 *  or Escape. */
export class CharSheet {
  constructor(entity) { this.entity = entity; this.done = false; }
  input(action) { if (action === 'confirm' || action === 'back' || action === 'sheet') this.done = true; }
  draw(renderer, canvas, font, s) {
    const e = this.entity, W = canvas.width, H = canvas.height;
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: W, h: H }, undefined, [0.04, 0.03, 0.02, 0.92]);
    const gold = [0.85, 0.72, 0.35, 1], white = [0.9, 0.9, 0.85, 1], dim = [0.6, 0.6, 0.55, 1];
    drawText(renderer, font, `${e.name ?? '?'}  ${e.career?.name ?? ''}  LVL ${e.level}`, 20 * s, 16 * s, s, gold);
    drawText(renderer, font, `HP ${e.health}/${e.maxHealth}   MP ${e.magicka}/${e.maxMagicka}`, 20 * s, 30 * s, s, white);
    STAT_KEYS_ORDER.forEach((k, i) => drawText(renderer, font,
      `${k.slice(0, 3).toUpperCase()} ${e.stats[k]}`, 20 * s, (48 + i * 10) * s, s, white));
    // skills by career group, values live
    const groups = [['P', e.career?.primarySkills ?? []], ['M', e.career?.majorSkills ?? []], ['m', e.career?.minorSkills ?? []]];
    let row = 0;
    for (const [tag, ids] of groups) {
      for (const id of ids) {
        drawText(renderer, font, `${tag} ${SKILL_NAMES[id]} ${e.skills?.[id] ?? ''}`, 100 * s, (48 + row * 10) * s, s, dim);
        row++;
      }
    }
  }
}
