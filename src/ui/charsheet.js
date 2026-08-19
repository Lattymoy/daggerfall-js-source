// Character sheet + level-up (UI arc, U3; U8a NATIVE ART). The
// level-up screen retires the headless auto-apply: DFU sets
// readyToLevelUp and the char sheet applies - here the screen shows
// the pending level and hands the 4..6 pool to the SAME verbatim
// stat clamps chargen uses (statUp/statDown: max 100 / pool 0 /
// floor at the pre-level value).
//
// U8a: the sheet is the FIRST native-art window - INFO00I0.IMG on
// the 320x200 panel with DFU's verbatim label geometry
// (DaggerfallCharacterSheetWindow): name (41,4) race (41,14) class
// (46,24) level (45,34) gold (39,44) fatigue (57,54) health (52,64)
// encumbrance (90,74); the 8 stats centered in 28-wide panels at
// (141, 17 + i*24). The window's fourteen Buttons (:134-204) are
// answered by click(): exit (50,179,39,19) closes, the four skill
// rects (11, 106/116/126/136, 115x8) toggle the same pages keys 1-4
// do, and every other DFU button rect is consumed so the click can
// never fall through to the host's pointer-lock request.
// Fatigue displays /64 (FatigueMultiplier);
// encumbrance = carried template weight (+ gold at 0.0025/piece) /
// floor(Str*1.5) (FormulaHelper.MaxEncumbrance). The classic skill
// BUTTON popups ride keys 1-4 as interim text panels (primary/
// major/minor/misc); the PORTRAIT pends chargen faces (FLAGGED);
// art-less draws keep the old text page (never trap the motor).
// The level-up screen stays on the text idiom (its retrofit rides
// a later U8 slice).

import { statUp, statDown } from './chargen.js';
import { itemWeight } from '../systems/inventory.js';   // AUDIT 17e F30
import { maxEncumbrance } from '../combat/formulas.js';   // U10
import { STAT_KEYS_ORDER } from '../systems/chargen.js';
import { SKILL_NAMES } from '../systems/skills.js';
import { applyLevelUp, LEVELUP_BONUS_POOL_MIN, LEVELUP_BONUS_POOL_MAX } from '../systems/advancement.js';
import { drawText, measureText } from './text.js';
import { loadImg, nativeMetrics, drawImg, drawRect, shadowText, SCREEN_DIM } from './nativePanel.js';
import { maxFatigue, liveStat } from '../systems/statMods.js';
import { templateByIndex } from '../systems/itemTemplates.js';

// U8a: the module-level art cache - hosts preload once at boot; a
// failed load leaves the text fallback in charge.
let _art = null;
export async function preloadCharSheetArt(deps) {
  if (_art) return;
  try { _art = await loadImg(deps, 'INFO00I0.IMG'); }
  catch { console.warn('[charsheet] INFO00I0.IMG unavailable; the text sheet stands in'); }
}
export const charSheetArtLoaded = () => !!_art;

// AUDIT 17e F30 / ONE DFU MEMBER, ONE EXPORT: this re-implemented
// carried weight from the raw template baseWeight, ignoring the
// MATERIAL weight rule that systems/inventory.js already ports
// verbatim (ItemBuilder.CalculateWeightForMaterial + the Erisceres
// leather formula) - so a daedric warhammer weighed its iron base.
// AUDIT 17f: gold used to be the one term with a second constant
// here (DaggerfallBankManager.goldPieceWeightInKg, 0.0025) because
// the port's gold stack carried no template index. It carries
// Currency.Gold_pieces (276) now, whose baseWeight IS 0.0025, so
// itemWeight serves it like every other stack.
const carriedWeight = (e) => (e.items ?? []).reduce((kg, it) => kg + itemWeight(it), 0);

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

// DaggerfallCharacterSheetWindow.cs:134-204 - the window's clickable
// Button rects, verbatim, in NativePanel virtual pixels.
export const CHARSHEET_RECTS = Object.freeze({
  name: [4, 3, 132, 8],
  level: [4, 33, 132, 8],
  gold: [4, 43, 132, 8],
  health: [4, 63, 128, 8],
  affiliations: [3, 84, 130, 8],
  primarySkills: [11, 106, 115, 8],
  majorSkills: [11, 116, 115, 8],
  minorSkills: [11, 126, 115, 8],
  miscSkills: [11, 136, 115, 8],
  inventory: [3, 151, 65, 12],
  spellbook: [69, 151, 65, 12],
  logbook: [3, 165, 65, 12],
  history: [69, 165, 65, 12],
  exit: [50, 179, 39, 19],
});
const inRect = ([rx, ry, rw, rh], x, y) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;

/** The classic read-only sheet (F5). Toggle-closed by the same key
 *  or Escape; keys 1-4 pop the skill groups (interim text panels
 *  over the classic button rects' function). */
export class CharSheet {
  constructor(entity) {
    this.entity = entity; this.done = false; this.page = 0;
    this.isChoiceWindow = true;   // U8a: receive RAW codes through townTalk (digit pages + F5 toggle)
  }
  input(action) {
    // Both vocabularies: input.js actions (dungeon routing) and raw
    // codes (the exterior hosts' overlay seam).
    const pages = { 1: 1, 2: 2, 3: 3, 4: 4, Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4 };
    const p = pages[action];
    if (p) { this.page = this.page === p ? 0 : p; return; }
    if (this.page && (action === 'back' || action === 'Escape')) { this.page = 0; return; }
    if (action === 'confirm' || action === 'back' || action === 'sheet'
      || action === 'Enter' || action === 'Escape' || action === 'F5' || action === 'KeyE') this.done = true;
  }

  /** AUDIT 18: the sheet had no click() at all, so its drawn EXIT
   *  button was inert and the pointerdown fell through to the host's
   *  requestLook. Every DFU button rect is answered or consumed. */
  click(vx, vy) {
    const R = CHARSHEET_RECTS;
    if (inRect(R.exit, vx, vy)) { this.done = true; return true; }
    const skills = [R.primarySkills, R.majorSkills, R.minorSkills, R.miscSkills];
    for (let i = 0; i < skills.length; i++) {
      if (inRect(skills[i], vx, vy)) { this.input(i + 1); return true; }
    }
    // The remaining DFU buttons (name/level/gold/health/affiliations,
    // inventory/spellbook/logbook/history) pend their popups; consume
    // the click so it never escapes the window.
    return Object.values(R).some((r) => inRect(r, vx, vy));
  }

  draw(renderer, canvas, font, s) {
    if (!_art) return this._drawFallback(renderer, canvas, font, s);
    const e = this.entity;
    const m = nativeMetrics(canvas);
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, SCREEN_DIM);
    drawImg(renderer, _art, m, 0, 0);
    // The verbatim label geometry (DaggerfallCharacterSheetWindow)
    const label = (text, x, y, opts) => shadowText(renderer, font, String(text), m, x, y, opts);
    label(e.name ?? '', 41, 4);
    label(e.race ?? 'Breton', 41, 14);
    label(e.career?.name ?? '', 46, 24);
    label(e.level ?? 1, 45, 34);
    label(e.items?.find((it) => it.group === 'Currency')?.stackCount ?? 0, 39, 44);
    label(`${Math.trunc((e.fatigue ?? maxFatigue(e)) / 64)}/${Math.trunc(maxFatigue(e) / 64)}`, 57, 54);
    label(`${e.health}/${e.maxHealth}`, 52, 64);
    label(`${Math.trunc(carriedWeight(e))}/${maxEncumbrance(liveStat(e, 'strength'))}`, 90, 74);   // U10: the FormulaHelper home
    STAT_KEYS_ORDER.forEach((k, i) =>
      label(liveStat(e, k), 141, 17 + i * 24, { align: 'center', w: 28 }));
    // portrait (200,8) pends chargen faces - the art's frame shows
    if (this.page) this._drawSkillPage(renderer, font, m);
    return undefined;
  }

  _drawSkillPage(renderer, font, m) {
    const e = this.entity;
    const names = ['Primary', 'Major', 'Minor', 'Miscellaneous'];
    const career = [e.career?.primarySkills ?? [], e.career?.majorSkills ?? [], e.career?.minorSkills ?? []];
    const inCareer = new Set(career.flat());
    const ids = this.page <= 3 ? career[this.page - 1]
      : Object.keys(SKILL_NAMES).map(Number).filter((id) => !inCareer.has(id));
    drawRect(renderer, m, 8, 100, 130, Math.min(96, ids.length * 9 + 14), [0.05, 0.05, 0.09, 0.95]);
    shadowText(renderer, font, `${names[this.page - 1]} skills`, m, 12, 103);
    ids.slice(0, 9).forEach((id, i) =>
      shadowText(renderer, font, `${SKILL_NAMES[id]} ${e.skills?.[id] ?? 0}%`, m, 12, 113 + i * 9, { color: [0.9, 0.9, 0.85, 1] }));
  }

  _drawFallback(renderer, canvas, font, s) {
    const e = this.entity, W = canvas.width, H = canvas.height;
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: W, h: H }, undefined, [0.04, 0.03, 0.02, 0.92]);
    const gold = [0.85, 0.72, 0.35, 1], white = [0.9, 0.9, 0.85, 1], dim = [0.6, 0.6, 0.55, 1];
    drawText(renderer, font, `${e.name ?? '?'}  ${e.career?.name ?? ''}  LVL ${e.level}`, 20 * s, 16 * s, s, gold);
    drawText(renderer, font, `HP ${e.health}/${e.maxHealth}   MP ${e.magicka}/${e.maxMagicka}`, 20 * s, 30 * s, s, white);
    STAT_KEYS_ORDER.forEach((k, i) => drawText(renderer, font,
      `${k.slice(0, 3).toUpperCase()} ${e.stats[k]}`, 20 * s, (48 + i * 10) * s, s, white));
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
