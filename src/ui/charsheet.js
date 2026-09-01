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
// major/minor/misc); the portrait slot draws the shared paperdoll
// at DFU's (200,8) origin, refreshed on open like the inventory;
// art-less draws keep the old text page (never trap the motor).
// The level-up screen stays on the text idiom (its retrofit rides
// a later U8 slice).

import { statUp, statDown } from './chargen.js';
import { itemWeight } from '../systems/inventory.js';   // AUDIT 17e F30
import { entityMaxEncumbrance } from '../combat/formulas.js';   // U10
import { STAT_KEYS_ORDER } from '../systems/chargen.js';
import { SKILL_NAMES } from '../systems/skills.js';
import { applyLevelUp, LEVELUP_BONUS_POOL_MIN, LEVELUP_BONUS_POOL_MAX } from '../systems/advancement.js';
import { OGHMA_BONUS_POOL } from '../systems/artifactEffects.js';   // AUDIT 39: the sheet's oghmaBonusPool (:44)
import { drawText, measureText } from './text.js';
import { loadImg, nativeMetrics, drawImg, drawRect, shadowText } from './nativePanel.js';
import { drawScreenDimBackdrop } from './chargenArt.js';
import { drawPaperDoll, refreshPaperDoll, PAPERDOLL_ORIGIN } from './paperDoll.js';
import { maxFatigue, liveStat, FATIGUE_MULTIPLIER } from '../systems/statMods.js';   // U52: the /64 display divisor has a name and one home
import { templateByIndex } from '../systems/itemTemplates.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

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
// U52: EXPORTED. The enhanced sheet shows the same encumbrance the
// classic one draws, and a second reduce over e.items in that module
// would be this comment's own warning happening again one file over.
export const carriedWeight = (e) => (e.items ?? []).reduce((kg, it) => kg + itemWeight(it), 0);

export class LevelUpScreen {
  constructor(entity, rolls = Math.random) {
    audio.playOneShot(SOUND.LevelUp, 1);   // UpdatePlayerValues (:373) - the level-up fanfare
    this.entity = entity;
    // Roll the pool NOW so the screen can show it; the base stats are
    // the floors (statDown returns points only above them).
    //
    // AUDIT 39: the OGHMA arm (UpdatePlayerValues :374-383) - the
    // Infinium's rollout is a FIXED 30 and DFU draws no BonusPool() on
    // that branch at all. The screen rolled 4..6 unconditionally, so
    // the book's thirty points were unspendable and applyLevelUp's
    // oghma arm - the only place that clears the latched flag - was
    // reached by the next GENUINE level-up, which it then ate (no
    // Level++, no health roll).
    this.oghma = !!entity.oghmaLevelUp;
    this.pool = this.oghma ? OGHMA_BONUS_POOL
      : LEVELUP_BONUS_POOL_MIN + Math.floor(rolls() * (LEVELUP_BONUS_POOL_MAX + 1 - LEVELUP_BONUS_POOL_MIN));
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
    else if (action === 'plus') { audio.playOneShot(SOUND.ButtonClick, 1); const r = statUp(this.working[key], this.pool); this.working[key] = r.working; this.pool = r.pool; }   // freeEdit spinner (StatsRollout.cs:255)
    else if (action === 'minus') { audio.playOneShot(SOUND.ButtonClick, 1); const r = statDown(this.working[key], this.base[key], this.pool); this.working[key] = r.working; this.pool = r.pool; }
    else if (action === 'confirm' && this.pool === 0) {
      // applyLevelUp rolls HP; our pre-rolled pool distributes here -
      // the distribute hook writes the hand-built stats.
      applyLevelUp(this.entity, (stats) => Object.assign(stats, this.working), this._rolls, this._rolledPool);
      this.done = true;
    }
  }

  draw(renderer, canvas, font, s) {
    const W = canvas.width, H = canvas.height;
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: W, h: H }, undefined, [0.04, 0.03, 0.02, 0.92]);
    const gold = [0.85, 0.72, 0.35, 1], white = [0.9, 0.9, 0.85, 1], hot = [1, 0.95, 0.6, 1], dim = [0.5, 0.5, 0.45, 1];
    // The oghma arm raises no level, so it has no pendingLevel to show
    // (DFU's sheet prints the level it already has).
    const t = `LEVEL ${this.entity.pendingLevel ?? this.entity.level}!  POOL: ${this.pool}`;
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

/** The four buttons that lead somewhere (:134-204). */
export const NAV_BUTTONS = Object.freeze(['inventory', 'spellbook', 'logbook', 'history']);

/** AUDIT 26 F164 - UpdatePlayerValues' stat colours
 *  (DaggerfallCharacterSheetWindow.cs:414-419), verbatim from
 *  DaggerfallUI.cs:65-66. Below the permanent value is DRAINED, above
 *  it is INCREASED, and equal takes the label's default. */
export const STAT_DRAINED_COLOR = Object.freeze([190 / 255, 85 / 255, 24 / 255, 1]);
export const STAT_INCREASED_COLOR = Object.freeze([178 / 255, 207 / 255, 255 / 255, 1]);

/** What the sheet says when a host cannot open one. NEVER a silent
 *  swallow, and never a word about the port's own gaps - the same rule
 *  the settings screen follows. */
const NO_WINDOW_HERE = Object.freeze({
  inventory: 'Your pack is out of reach here.',
  spellbook: 'Your spellbook is out of reach here.',
  logbook: 'Your logbook is out of reach here.',
  history: 'Your history is out of reach here.',
});

/** The classic read-only sheet (F5). Toggle-closed by the same key
 *  or Escape; keys 1-4 pop the skill groups (interim text panels
 *  over the classic button rects' function). */
export class CharSheet {
  /** U32: the four NAVIGATION buttons finally lead somewhere.
   *
   *  DFU PUSHES those windows onto the UI stack, so the sheet stays
   *  underneath and closing the child returns to it. The port's hosts
   *  each hold ONE activeOverlay slot, so rather than teach four hosts
   *  a stack - and risk them drifting apart, which is exactly what the
   *  FOUR HOSTS rule exists to stop - the sheet OWNS its child and
   *  delegates to it. The host still sees one window; the player gets
   *  DFU's push and pop.
   *
   *  The factories come from the host because only the host knows how
   *  to build each window (a dungeon's inventory can carry a loot
   *  target; a town's cannot). A hook the host does not pass is a
   *  window that host cannot open, and the sheet SAYS SO rather than
   *  eating the click - which is what it did for all four until now. */
  constructor(entity, hooks = {}) {
    this.entity = entity; this.done = false; this.page = 0;
    this.hooks = hooks;
    this.child = null;      // the pushed window, or null
    this.notice = null;     // why a button did nothing, when it could not
    this.isChoiceWindow = true;   // U8a: receive RAW codes through townTalk (digit pages + F5 toggle)
    refreshPaperDoll(entity);     // compose fresh on open, as the inventory does
  }

  /** The pushed window's lifetime: a finished child pops, revealing
   *  the sheet again. Returns true while one is still up. */
  _stepChild() {
    if (this.child?.done) this.child = null;
    return !!this.child;
  }

  /** PushWindow. A missing or refused hook is REPORTED, never
   *  swallowed. */
  _open(which) {
    this.notice = null;
    const w = this.hooks[which]?.();
    if (!w) { this.notice = NO_WINDOW_HERE[which]; return false; }
    this.child = w;
    return true;
  }

  tick(dt) { if (this.child) { this.child.tick?.(dt); this._stepChild(); } }
  wheel(dir) { if (this.child) { this.child.wheel?.(dir); this._stepChild(); return true; } return false; }

  /** U42: the sheet forwarded tick, wheel, input and click to a
   *  pushed window and NOT hover, so every hover-driven behaviour a
   *  child owns was dead on the sheet's route into it - which is the
   *  route THREE of the four hosts take, through charSheetHooks'
   *  `spellbook` button. The host seams test for the method on the
   *  OVERLAY (the sheet), find it missing, and never reach the child
   *  (townTalk.js's `if (!overlay?.hover) return false`). It cost the
   *  spellbook its list highlight and all three of its icon tooltips,
   *  and only on that route, because Backspace makes the window the
   *  overlay itself. The sheet has nothing of its own to hover, so
   *  this is pure forwarding; `true` is what the seams read as
   *  "consumed". */
  hover(vx, vy, e = null) {
    if (!this.child) return false;
    this.child.hover?.(vx, vy, e);
    this._stepChild();
    return true;
  }

  input(action, e = null) {
    // A pushed window owns the keyboard until it closes.
    if (this.child) { this.child.input?.(action, e); this._stepChild(); return; }
    this.notice = null;
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
    if (this.child) {
      if (this.child.clickNative) this.child.clickNative(vx, vy);
      else this.child.click?.(vx, vy);
      this._stepChild();
      return true;
    }
    const R = CHARSHEET_RECTS;
    if (inRect(R.exit, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this.done = true; return true; }
    const skills = [R.primarySkills, R.majorSkills, R.minorSkills, R.miscSkills];
    for (let i = 0; i < skills.length; i++) {
      if (inRect(skills[i], vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this.input(i + 1); return true; }
    }
    // U32: THE FOUR NAVIGATION BUTTONS. These were hit-tested,
    // consumed, and did NOTHING - the reported bug. Each one pushes its
    // window now, and two of them (inventory, spellbook) were built and
    // working the whole time with no caller.
    for (const which of NAV_BUTTONS) {
      if (inRect(R[which], vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._open(which); return true; }
    }
    // The remaining DFU buttons (name/level/gold/health/affiliations)
    // pend their popups; consume the click so it never escapes the
    // window. They still CLICK - every DaggerfallCharacterSheetWindow
    // button assigns ButtonClick (:772-952).
    if (Object.values(R).some((r) => inRect(r, vx, vy))) {
      audio.playOneShot(SOUND.ButtonClick, 1);
      return true;
    }
    return false;
  }

  draw(renderer, canvas, font, s) {
    // A pushed window draws INSTEAD of the sheet - DFU's stack puts it
    // on top, and the sheet's own art would show through a window that
    // does not cover the whole panel otherwise.
    if (this.child) return this.child.draw(renderer, canvas, font, s);
    if (!_art) return this._drawFallback(renderer, canvas, font, s);
    const e = this.entity;
    const m = nativeMetrics(canvas);
    // AUDIT 19 F2: OPAQUE BLACK, not a dim. DaggerfallBaseWindow's
    // constructor sets `parentPanel.BackgroundColor = Color.black`
    // (DaggerfallBaseWindow.cs:40) - ScreenDimColor is used only by the
    // handful of windows that explicitly override it, and this is not one.
    // Drawing a 50% dim here left the letterbox showing the world at half
    // brightness around the panel, which is the SAME defect U21 fixed for
    // the menu, U21b for chargen and U22 for the splash. Fourth, fifth and
    // sixth instance; one shared helper now.
    // AUDIT 24 ui: this window's Setup assigns
    // `ParentPanel.BackgroundColor = ScreenDimColor` (DaggerfallCharacterSheetWindow.cs:105),
    // which is Color.clear - the letterbox is NOT painted.
    drawScreenDimBackdrop(renderer, canvas);
    drawImg(renderer, _art, m, 0, 0);
    // The verbatim label geometry (DaggerfallCharacterSheetWindow)
    const label = (text, x, y, opts) => shadowText(renderer, font, String(text), m, x, y, opts);
    // U32: why a button did nothing, when it could not. Drawn over the
    // sheet's own art, cleared by the next key or click.
    if (this.notice) label(this.notice, 8, 190, { color: [1, 0.5, 0.4, 1] });
    label(e.name ?? '', 41, 4);
    label(e.race ?? 'Breton', 41, 14);
    label(e.career?.name ?? '', 46, 24);
    label(e.level ?? 1, 45, 34);
    label(e.items?.find((it) => it.group === 'Currency')?.stackCount ?? 0, 39, 44);
    label(`${Math.trunc((e.fatigue ?? maxFatigue(e)) / FATIGUE_MULTIPLIER)}/${Math.trunc(maxFatigue(e) / FATIGUE_MULTIPLIER)}`, 57, 54);
    label(`${e.health}/${e.maxHealth}`, 52, 64);
    label(`${Math.trunc(carriedWeight(e))}/${entityMaxEncumbrance(e)}`, 90, 74);   // DaggerfallCharacterSheetWindow.cs:404 reads PlayerEntity.MaxEncumbrance
    // AUDIT 26 F164: UpdatePlayerValues colours each stat label by the
    // live value against the PERMANENT one (:414-419) - drained below,
    // increased above, default when they agree. The port drew all
    // eight at the shadow-text default, so the at-a-glance warning DFU
    // gives after a disease or a drain spell was absent. `stats` IS
    // the permanent map here (statMods.js:31 clamps permanent + mods).
    STAT_KEYS_ORDER.forEach((k, i) => {
      const live = liveStat(e, k);
      const permanent = e.stats?.[k] ?? 0;
      const color = live < permanent ? STAT_DRAINED_COLOR
        : live > permanent ? STAT_INCREASED_COLOR : undefined;
      label(live, 141, 17 + i * 24, { align: 'center', w: 28, color });
    });
    drawPaperDoll(renderer, m, e, PAPERDOLL_ORIGIN[0], PAPERDOLL_ORIGIN[1]);
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
