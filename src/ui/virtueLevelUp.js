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
import {
  levelingSettings, virtuePurse, canRaiseAttribute, canLowerAttribute,
  attributeOffset, commitVirtueLevelUp, virtueSpendPlan, LEVELUP_TOTAL,
} from '../systems/oblivionLeveling.js';

/** l10n/en.yaml:34 remaining_points_error, the author's own words. */
export const REMAINING_POINTS_ERROR = 'You must distribute all your points to continue.';
/** l10n/en.yaml:35-36 choose_attributes_label / remaining_points_label. */
export const chooseAttributesLabel = (count) => `Choose ${count} Attributes to increase`;
export const REMAINING_POINTS_LABEL = 'Virtues left';

/** The mod prints Morrowind's `sAttributeStrength` GMSTs; Daggerfall's
 *  own attribute names are the port's stat keys, and the sheet already
 *  prints them as three-letter heads (charsheet.js:144). This screen
 *  has the room for the whole word. */
const label = (k) => k.charAt(0).toUpperCase() + k.slice(1);

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
  // branch can produce (ui/input.js:232).
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

  rowText(key, selected = false) {
    const d = this.deltas[key] ?? 0;
    const { minus, plus } = this.rowMarkers(key);
    const cost = attributeOffset(key, this.s);
    return `${selected ? '>' : ' '} ${label(key).padEnd(12)}${String(this.entity.stats[key] + d).padStart(3)}`
      + `   ${minus ? '-' : ' '} ${d > 0 ? `+${d}` : ' 0'} ${plus ? '+' : ' '}${cost > 1 ? `   (${cost} per point)` : ''}`;
  }

  draw(renderer, canvas, font, s) {
    const W = canvas.width, H = canvas.height;
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: W, h: H }, undefined, [0.04, 0.03, 0.02, 0.92]);
    const gold = [0.85, 0.72, 0.35, 1], white = [0.9, 0.9, 0.85, 1];
    const hot = [1, 0.95, 0.6, 1], dim = [0.5, 0.5, 0.45, 1], red = [0.85, 0.35, 0.25, 1];
    const centre = (text, y, colour) =>
      drawText(renderer, font, text, (W - measureText(font.fnt, text) * s) / 2, y * s, s, colour);

    centre(`LEVEL ${this.entity.pendingLevel ?? this.entity.level}!`, 16, gold);
    centre(chooseAttributesLabel(this.s.maxUpdatableAttribute), 28, white);
    centre(`${REMAINING_POINTS_LABEL}: ${this.purse}`, 40, gold);

    STAT_KEYS_ORDER.forEach((k, i) => {
      drawText(renderer, font, this.rowText(k, i === this.cursor), 40 * s, (56 + i * 12) * s, s,
        i === this.cursor ? hot : white);
    });

    const y = 56 + 8 * 12;
    drawText(renderer, font, '+/- assign   ENTER when none are left', 40 * s, (y + 4) * s, s, dim);
    // The bar the whole system is measured against, so a player can
    // see what carried over into the level they are starting.
    drawText(renderer, font, `bar ${this.entity.levelProgress ?? 0}/${LEVELUP_TOTAL}`
      + `${(this.entity.levelRollUp ?? 0) > 0 ? `  (+${this.entity.levelRollUp} carried)` : ''}`,
    40 * s, (y + 16) * s, s, dim);
    if (this.refused) centre(REMAINING_POINTS_ERROR, y + 30, red);
  }
}
