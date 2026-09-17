// ORL1 (2026-09-17): THE VIRTUE LEVEL-UP SCREEN - OblivionRemaster-
// LikeLeveling's own level-up window (player.lua:245-622), on the
// port's canvas.
//
// ── WHY THIS IS A TEXT SCREEN AND NOT A NATIVE WINDOW ─────────────
// THE NATIVE-WINDOW RULE (bible/Home.md) says every drawn element of
// a native window - rect, font, colour, scale, alignment - must cite
// its DFU source before it ships, and that an element whose value is
// unknown does not draw. This window HAS no DFU source: it is a
// Morrowind mod's window, and its geometry is OpenMW's MWUI flex
// boxes over Morrowind's own textures (`icons/k/attribute_*.dds`, the
// gold coin, the nine-slice bordered button). Daggerfall ships none of
// that art, so there is no value to look up and nothing to cite.
//
// The rule's answer to "the DFU value is unknown" is that the element
// does not draw. So this screen draws NO native art and claims no DFU
// geometry: it is the same TEXT IDIOM ui/charsheet.js's LevelUpScreen
// already ships in ("The level-up screen stays on the text idiom",
// charsheet.js:26) - a dimmed full screen and drawText rows. What it
// reproduces faithfully is the mod's LAW, which is what the mod
// registry asks of a vendored port; the mod's LOOK is Morrowind's and
// stays there.
//
// ── WHAT IT IS NOT ────────────────────────────────────────────────
// It is not the Oghma Infinium's rollout. That artefact is
// Daggerfall's own (DFU's OghmaInfiniumEffect: thirty points, no
// Level++, no health), its law is DFU's, and thirty points cannot be
// spent under the mod's "at most three attributes, at most five each"
// rule anyway. ui/charSheetDoor.js keeps the Oghma on the port's own
// rollout in both lanes; this window is the mod's LEVEL-UP alone.
//
// ── THE ONE HOME ──────────────────────────────────────────────────
// a11's law (test/advancementui.test.js) is that the Level++ and the
// health roll live in ONE place and never in a window. They do here
// too: this screen owns the cursor and the keys, and
// systems/oblivionLeveling.js's commitVirtueLevelUp owns the change.
// Nothing below writes entity.level, entity.maxHealth or entity.stats.

import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { STAT_KEYS_ORDER } from '../systems/chargen.js';
import { drawText, measureText } from './text.js';
import { nativeMetrics, NATIVE_W } from './nativePanel.js';
import {
  levelingSettings, virtuePurse, canRaiseAttribute, canLowerAttribute,
  attributeOffset, commitVirtueLevelUp, virtueSpendPlan, LEVELUP_TOTAL,
} from '../systems/oblivionLeveling.js';

/** l10n/en.yaml:34 remaining_points_error, the author's own words. */
export const REMAINING_POINTS_ERROR = 'You must distribute all your points to continue.';
/** THE WAY OUT, which the mod's own line does not name. A player can
 *  spend into a corner: points left, and every PLUS refused because the
 *  rows they opened are full or at 100 and no new row may open. A MINUS
 *  is always legal there (the port's no-wall pin walks every reachable
 *  state and proves it), so the window says so rather than repeating an
 *  instruction the buttons have stopped honouring. The author's string
 *  above is untouched; this is the port's own sentence beneath it. */
export const TAKE_ONE_BACK_HINT = 'Take a point back with - and place it elsewhere.';
/** l10n/en.yaml:35-36 choose_attributes_label / remaining_points_label. */
export const chooseAttributesLabel = (count) => `Choose ${count} Attributes to increase`;
export const REMAINING_POINTS_LABEL = 'Virtues left';

/** The mod prints Morrowind's `sAttributeStrength` GMSTs; Daggerfall's
 *  own attribute names are the port's stat keys, and the sheet already
 *  prints them as three-letter heads (charsheet.js:144). This screen
 *  has the room for the whole word. */
const label = (k) => k.charAt(0).toUpperCase() + k.slice(1);

/** WHERE THE WINDOW'S PARTS SIT, in the 320x200 native units every host's
 *  pointer seam speaks. ONE table, read by the draw AND by the hit test:
 *  the question screen shipped with those two written separately and they
 *  disagreed on every canvas that was not exactly 16:10.
 *
 *  THE PRESSES ARE THEIR OWN BUTTONS rather than the +/- inside a row's
 *  text, because FONT0003 is PROPORTIONAL: `rowText` pads its label to
 *  twelve CHARACTERS, so those markers land on a different pixel in every
 *  row and no fixed rect could cover them. Three labelled zones below the
 *  list act on the SELECTED row, which is exactly what the keyboard's +/-
 *  and ENTER already do - one set of rules, not two.
 */
export const ROW_TOP = 56;             // the first attribute row
export const ROW_PITCH = 12;
export const ROW_X = 40, STAT_ROW_W = 230;
export const PRESS_Y = ROW_TOP + 8 * ROW_PITCH + 4;
export const PRESS_H = 10;
export const MINUS_X = 40, PLUS_X = 80, OK_X = 120;
export const PRESS_W = 32, OK_PRESS_W = 44;

/** What a native-coordinate point falls on: `{ row }`, or
 *  `{ press: 'minus' | 'plus' | 'ok' }`, or null. */
export function levelUpHitNative(vx, vy) {
  if (vy >= PRESS_Y && vy < PRESS_Y + PRESS_H) {
    if (vx >= MINUS_X && vx < MINUS_X + PRESS_W) return { press: 'minus' };
    if (vx >= PLUS_X && vx < PLUS_X + PRESS_W) return { press: 'plus' };
    if (vx >= OK_X && vx < OK_X + OK_PRESS_W) return { press: 'ok' };
    return null;
  }
  if (vy < ROW_TOP || vy >= ROW_TOP + 8 * ROW_PITCH) return null;
  if (vx < ROW_X || vx >= ROW_X + STAT_ROW_W) return null;
  return { row: Math.floor((vy - ROW_TOP) / ROW_PITCH) };
}

export class VirtueLevelUpScreen {
  constructor(entity, { settings = null, rolls = Math.random } = {}) {
    audio.playOneShot(SOUND.LevelUp, 1);   // the mod streams MW_Triumph.mp3 here; the port's own level-up fanfare stands in its place
    this.entity = entity;
    this.s = settings ?? levelingSettings();
    this._rolls = rolls;
    // player.lua:638-677 calculateAttributepoints, run at the window's
    // own registration - so the purse is already clamped to what this
    // character can actually spend before a single key is pressed.
    this.purse = virtuePurse(entity.stats, this.s);
    /** What the level-up was worth before a single key was pressed -
     *  the font-less escape re-plans against it. */
    this.fullPurse = this.purse;
    this.deltas = Object.fromEntries(STAT_KEYS_ORDER.map((k) => [k, 0]));
    this.cursor = 0;
    this.done = false;
    this.refused = false;
    /** The host's font-less escape and the door both ask by duck type
     *  rather than by `instanceof`, which keeps scenes/ from importing
     *  a UI class for a type test. */
    this.isVirtueLevelUp = true;
  }

  /** player.lua:286-295 increaseAttribute - the plus button's whole
   *  body, guarded by the predicate that HIDES it (:599-603). */
  raise(key) {
    if (!canRaiseAttribute(key, this.entity.stats, this.deltas, this.purse, this.s)) return false;
    this.deltas[key] += 1;
    this.purse -= attributeOffset(key, this.s);
    this.refused = false;
    return true;
  }

  /** player.lua:297-306 decreaseAttribute. */
  lower(key) {
    if (!canLowerAttribute(key, this.deltas)) return false;
    this.deltas[key] -= 1;
    this.purse += attributeOffset(key, this.s);
    this.refused = false;
    return true;
  }

  /** player.lua:532-552 validateLevelUp: the OK button refuses while
   *  the purse is unspent and says so, and commits when it is zero. */
  confirm() {
    if (this.purse !== 0) { this.refused = true; return false; }
    const ok = commitVirtueLevelUp(this.entity, this.deltas, this.purse, this.s, this._rolls);
    if (ok) this.done = true;
    return ok;
  }

  // The same action vocabulary LevelUpScreen answers (charsheet.js:106),
  // so every host's existing overlay route drives this screen unchanged
  // - including 'char:-', which is the only hyphen a typed-character
  // branch can produce (ui/input.js:338 - the typed-character branch,
  // whose class carries a literal trailing hyphen).
  input(action) {
    const key = STAT_KEYS_ORDER[this.cursor];
    if (action === 'up') this.cursor = (this.cursor + 7) % 8;
    else if (action === 'down') this.cursor = (this.cursor + 1) % 8;
    else if (action === 'plus') { if (this.raise(key)) audio.playOneShot(SOUND.ButtonClick, 1); }
    else if (action === 'minus' || action === 'char:-') { if (this.lower(key)) audio.playOneShot(SOUND.ButtonClick, 1); }
    else if (action === 'confirm') this.confirm();
  }

  /**
   * THE FONT-LESS ESCAPE (dungeonContext.js's drawOverlay). A level-up
   * that cannot draw must not silently eat the purse, and it must not
   * spend it past the mod's own caps either - so it runs the law
   * module's own headless policy over this window's live deltas, and
   * then closes through the same `confirm` a player would press.
   */
  spendRemainingHeadless() {
    // It plans from SCRATCH rather than finishing what is on screen: a
    // player can spend their way into a corner no legal move gets out
    // of - that is what the minus button is for - and a screen nobody
    // can see has nobody to press it. The full purse is reachable by
    // construction, so starting over always lands on zero.
    const { cost, plan } = virtueSpendPlan(this.entity.stats, this.s, this.fullPurse);
    this.deltas = plan;
    this.purse = this.fullPurse - cost;
    return this.confirm();
  }

  /**
   * ONE ROW, AS WORDS - and the mod's own "HIDE the button, do not grey
   * it" law (player.lua:599-616) with it. In the text idiom the marker
   * IS the button, so a button the predicate refuses is a space.
   *
   * It is a function rather than four lines inside `draw` because a law
   * that only exists inside a draw is a law nothing can fail: the pins
   * lens showed that replacing both markers with unconditional '+' and
   * '-' passed the whole suite, shipping a window that offers presses
   * it will not honour.
   */
  rowMarkers(key) {
    return {
      minus: canLowerAttribute(key, this.deltas),
      plus: canRaiseAttribute(key, this.entity.stats, this.deltas, this.purse, this.s),
    };
  }

  /** IN A CORNER: points left, and no row will take another. The minus
   *  button is always legal there (the no-wall pin walks every reachable
   *  state and proves it), so the window names it instead of repeating
   *  an instruction its plus buttons have stopped honouring.
   *
   *  It is a predicate rather than four lines inside `draw` for the same
   *  reason `rowMarkers` is: a law inside a draw is a law nothing can
   *  fail, and `if (true)` here survived the whole campaign. */
  cornered() {
    return this.purse > 0 && !STAT_KEYS_ORDER.some((k) => this.rowMarkers(k).plus);
  }

  rowText(key, selected = false) {
    const d = this.deltas[key] ?? 0;
    const { minus, plus } = this.rowMarkers(key);
    const cost = attributeOffset(key, this.s);
    // THIRTEEN, not twelve: 'Intelligence' is exactly twelve characters,
    // so a twelve-wide column ran the name into a three-digit value and
    // printed `Intelligence100` (ORL1's deep audit).
    return `${selected ? '>' : ' '} ${label(key).padEnd(13)}${String(this.entity.stats[key] + d).padStart(3)}`
      + `   ${minus ? '-' : ' '} ${d > 0 ? `+${d}` : ' 0'} ${plus ? '+' : ' '}${cost > 1 ? `   (${cost} per point)` : ''}`;
  }

  /**
   * THE POINTER SEAM (U10's law: the hosts hand NATIVE 320x200 coords).
   *
   * In the classic skin this window stands in for the native sheet's
   * rollout, which is clickable - so without this a player levelling a
   * virtue character by mouse could open the window and never close it,
   * and on a touch screen there was no way in at all. (ORL1's deep audit;
   * the question screen had the same hole and the first review fixed it
   * there.)
   */
  click(vx, vy) {
    if (this.done) return false;
    const hit = levelUpHitNative(vx, vy);
    if (!hit) return false;
    if (hit.row != null) { this.cursor = hit.row; return true; }
    const key = STAT_KEYS_ORDER[this.cursor];
    if (hit.press === 'ok') this.confirm();
    else if (hit.press === 'plus' && this.raise(key)) audio.playOneShot(SOUND.ButtonClick, 1);
    else if (hit.press === 'minus' && this.lower(key)) audio.playOneShot(SOUND.ButtonClick, 1);
    return true;
  }

  /** ...and the cursor follows the pointer, as the sheet's rows do. */
  hover(vx, vy) {
    if (this.done) return;
    const hit = levelUpHitNative(vx, vy);
    if (hit?.row != null) this.cursor = hit.row;
  }

  /** Painted where the hit test looks: `nativeMetrics` is the idiom every
   *  clickable native window uses, and it is right in both hosts - the
   *  dungeon host hands a virtual 320*s canvas with the letterbox already
   *  on the renderer, and nativeMetrics of that returns ox = oy = 0. */
  draw(renderer, canvas, font) {
    const m = nativeMetrics(canvas);
    const s = m.s;
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height },
      undefined, [0.04, 0.03, 0.02, 0.92]);
    const gold = [0.85, 0.72, 0.35, 1], white = [0.9, 0.9, 0.85, 1];
    const hot = [1, 0.95, 0.6, 1], dim = [0.5, 0.5, 0.45, 1], red = [0.85, 0.35, 0.25, 1];
    const at = (text, x, y, colour) =>
      drawText(renderer, font, text, m.ox + x * s, m.oy + y * s, s, colour);
    const centre = (text, y, colour) =>
      at(text, (NATIVE_W - measureText(font.fnt, text)) / 2, y, colour);

    centre(`LEVEL ${this.entity.pendingLevel ?? this.entity.level}!`, 16, gold);
    centre(chooseAttributesLabel(this.s.maxUpdatableAttribute), 28, white);
    centre(`${REMAINING_POINTS_LABEL}: ${this.purse}`, 40, gold);

    STAT_KEYS_ORDER.forEach((k, i) => {
      at(this.rowText(k, i === this.cursor), ROW_X, ROW_TOP + i * ROW_PITCH,
        i === this.cursor ? hot : white);
    });

    // The three presses, at the rects `levelUpHitNative` reads - and the
    // mod's HIDE-DO-NOT-GREY law is the row's own markers, above, so
    // these are dimmed rather than hidden: they are the window's furniture
    // and a button that vanishes under the pointer is worse than one that
    // says no.
    const key = STAT_KEYS_ORDER[this.cursor];
    const mk = this.rowMarkers(key);
    at('[ - ]', MINUS_X, PRESS_Y, mk.minus ? white : dim);
    at('[ + ]', PLUS_X, PRESS_Y, mk.plus ? white : dim);
    at('[ OK ]', OK_X, PRESS_Y, this.purse === 0 ? hot : dim);
    // The bar the whole system is measured against, so a player can
    // see what carried over into the level they are starting.
    at(`bar ${this.entity.levelProgress ?? 0}/${LEVELUP_TOTAL}`
      + `${(this.entity.levelRollUp ?? 0) > 0 ? `  (+${this.entity.levelRollUp} carried)` : ''}`,
    ROW_X, PRESS_Y + 12, dim);
    if (this.refused) {
      centre(REMAINING_POINTS_ERROR, PRESS_Y + 24, red);
      // ...and if nothing can be RAISED, name the control that still works
      if (this.cornered()) centre(TAKE_ONE_BACK_HINT, PRESS_Y + 34, white);
    }
  }
}
