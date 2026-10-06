// ORL1 (2026-09-17, Mac: "On new game, I want the player to receive a
// notification on which leveling system they would like to use") - THE
// LEVELING CHOICE, the last screen of making a character.
//
// ── WHY IT IS A SCREEN AND NOT A CHARGEN STAGE ────────────────────
// The wizard's stages are DFU's WizardStages, in both skins
// (ui/chargen.js's STATES, ui/enhancedChargen.js's STAGE_RAIL), and a
// port-invented stage in that list would be a stage with no DFU line
// behind it - in two lists that have to be kept in step. So this is
// not a stage: it is a screen the chargen DOOR puts up after the
// wizard has finished and before the character reaches the world, and
// it lives in ONE place (systems/chargenSession.js's
// createChargenWindow) so that all three chargen hosts get it without
// knowing it exists.
//
// ── WHY THE TEXT IDIOM ────────────────────────────────────────────
// THE NATIVE-WINDOW RULE, same answer as ui/virtueLevelUp.js's: there
// is no DFU window to cite geometry from, because Daggerfall never
// asked this question, and the rule's own answer to an element whose
// value is unknown is that the element does not draw. So nothing here
// claims any, and no native art is loaded at all. The
// port's parchment box (ui/messageBox.js) would be the right frame for
// a question Daggerfall DID ask - but it needs SPOP.RCI, and a screen
// that stands between a finished character and the game must not be
// able to fail to draw. Text over a dim, in both skins.
//
// ── THE MODAL CONTRACT ────────────────────────────────────────────
// `answer` fires ONCE (the `_fired` latch), for the same reason
// createChargenWindow's own onDone does: AUDIT 17f found that law
// broken there by a key repeat inside one frame.

import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { drawText, measureText } from './text.js';
import { nativeMetrics, NATIVE_W } from './nativePanel.js';
import {
  LEVELUP_BONUS_POOL_MIN, LEVELUP_BONUS_POOL_MAX, LEVELUP_SKILL_SUM_PER_LEVEL,
} from '../systems/advancement.js';
import {
  LEVELING_CLASSIC, LEVELING_VIRTUE, levelingSettings, LEVELUP_TOTAL,
} from '../systems/oblivionLeveling.js';
import { isEnhanced } from '../systems/uiSkin.js';   // LEVEL-PLUS: the Enhanced Plus face
import { drawLevelingFace, releaseLevelingFace } from './enhancedLevelingChoice.js';

/** LEVEL-ONLINE: why Daggerfall's option is shut on the online page (oblivionLeveling.js newCharacterLevelingSystem). */
export const LEVELING_OFFLINE_ONLY_NOTE = 'Offline characters only';

/**
 * The two answers, in the order they are offered. Daggerfall's own is
 * FIRST and is what a player who presses Enter without reading gets -
 * the port's own law is the default, and the mod is the opt-in.
 *
 * IT IS A FUNCTION, NOT A FROZEN TABLE, because the mod's purse and its
 * bar are SETTINGS: `attributePoints` is a slider from 0 to 60 and the
 * Mods pane exposes it. A literal "twelve virtues" here would lie to
 * any player who had moved it - and this is the one screen a character
 * cannot come back to, so it is the worst screen in the game to lie on.
 * (ORL1's adversarial review; the answer is read once, when the
 * question is built.)
 */
export function levelingOptions(s = null, { online = false } = {}) {
  const set = s ?? levelingSettings();
  // LEVEL-ONLINE: online, Daggerfall's leveling is shown but SHUT - a new online character levels Oblivion's way
  // (the law is newCharacterLevelingSystem at finishChargen; this is only the screen saying so before it happens).
  const shut = { locked: true, lockNote: LEVELING_OFFLINE_ONLY_NOTE };
  const open = { locked: false, lockNote: null };
  const purse = set.attributePoints;
  const virtues = purse === 1 ? '1 virtue' : `${purse} virtues`;
  return Object.freeze([
    Object.freeze({
      id: LEVELING_CLASSIC,
      title: 'Daggerfall',
      ...(online ? shut : open),
      lines: Object.freeze([
        'Level with your skills, as Daggerfall does.',
        'Primary, major and minor skills make a sum;',
        `every ${LEVELUP_SKILL_SUM_PER_LEVEL} points of it is a level.`,
        `Each level rolls ${LEVELUP_BONUS_POOL_MIN} to ${LEVELUP_BONUS_POOL_MAX} attribute points.`,
      ]),
    }),
    Object.freeze({
      id: LEVELING_VIRTUE,
      title: 'Oblivion Remastered',
      ...open,
      lines: Object.freeze([
        'Level with a bar, as Oblivion Remastered.',
        'Every skill you raise fills it, your best',
        `fastest. At ${LEVELUP_TOTAL} you level; the rest rolls`,
        purse > 0
          ? `over. Each level hands you ${virtues},`
          : 'over. You have set the purse to nothing,',
        purse > 0
          ? `to spend on at most ${set.maxUpdatableAttribute} attributes.`
          : 'so levelling raises only your health.',
      ]),
    }),
  ]);
}

/** The ids, in the order the screen offers them - what a caller wants
 *  when it is asking about the ANSWERS rather than drawing the words. */
export const LEVELING_OPTION_IDS = Object.freeze([LEVELING_CLASSIC, LEVELING_VIRTUE]);

/** WHERE THE TWO ANSWERS SIT, in the 320x200 native units the hosts'
 *  pointer seam speaks (ui/chargen.js's `clickNative`, townTalk's own
 *  route). ONE table, read by the draw AND by the hit test, because a
 *  screen whose picture and whose click target are written twice is a
 *  screen that will one day disagree with itself. */
export const CHOICE_TOP = 44;          // the first option's title row
export const CHOICE_PITCH = 70;        // one option's whole block, plus the gap
export const CHOICE_TITLE_H = 12;      // the title row's own height
export const CHOICE_LINE_H = 10;       // one body line
export const CHOICE_X0 = 16, CHOICE_X1 = 304;

/** How tall one option's block is - TITLE PLUS ITS LINES, which is what
 *  the draw paints and therefore what a click on it must cover. It was a
 *  literal 52 while the Oblivion option painted 62, so its last line sat
 *  outside its own hit box (ORL1's deep audit). Derived here, once, so
 *  the picture and the target cannot drift apart again. */
export const choiceHeight = (opt) =>
  CHOICE_TITLE_H + (opt?.lines?.length ?? 0) * CHOICE_LINE_H;

/** Where one option's block starts, in native units. */
export const choiceTop = (i) => CHOICE_TOP + i * CHOICE_PITCH;

/** The option a native-coordinate point falls on, or -1. `options` is the
 *  live list, because the blocks are as tall as their own text; `tops`
 *  where each block starts (LEGACY-CHOICE: a stacked screen's own), the
 *  fixed pitch's by default. */
export function choiceAtNative(vx, vy, options = [], tops = null) {
  if (vx < CHOICE_X0 || vx > CHOICE_X1) return -1;
  for (let i = 0; i < options.length; i++) {
    const top = tops ? tops[i] : choiceTop(i);
    if (vy >= top && vy < top + choiceHeight(options[i])) return i;
  }
  return -1;
}

/** LEGACY-CHOICE: the gap between two stacked blocks - three answers and the footer within the 200 (the footer its 10). */
export const CHOICE_STACK_GAP = 3;
/** LEGACY-CHOICE: WHERE EACH BLOCK STARTS ON A STACKED SCREEN - each under the last by its own height and the gap, so
 *  three answers fit the 200 the fixed pitch spends on two - and, one past the last, where the footer stands. The
 *  draw and the hit test read this one table, as they read the fixed pitch's. */
export function stackedTops(options = []) {
  const tops = [CHOICE_TOP];
  for (let i = 0; i < options.length; i++) tops.push(tops[i] + choiceHeight(options[i]) + CHOICE_STACK_GAP);
  return tops;
}
/** The keys a screen of `n` answers names ('1 or 2', '1, 2 or 3'). */
export const choiceKeysWord = (n) => (n <= 1 ? '1' : `${Array.from({ length: n - 1 }, (_, i) => i + 1).join(', ')} or ${n}`);

/** The classic face's three lines above the options. */
export const LEVELING_SCREEN_TEXT = Object.freeze({ title: 'HOW WILL YOU GROW?', lines: Object.freeze(['Choose how this character will level.', 'It cannot be changed later.']) });

export class LevelingChoiceScreen {
  /** @param {(id: string) => void} onAnswer */
  /** LEGACY2: `options`, `text` and the Plus face's `faceText` / `faceTags` let another one-time question of a new
   *  character (ui/legacyModelChoice.js, Project Legacy's model) wear this same screen - its cursor, its one answer,
   *  its keys and clicks, and both faces - rather than a copy of it. Without them it is the leveling question. */
  constructor(onAnswer, { settings = null, online = false, options = null, text = null, faceText = null, faceTags = null, stacked = false } = {}) {
    this._onAnswer = onAnswer;
    /** Read ONCE, when the question is built - a player cannot move a
     *  slider while this screen is up, and re-reading per frame would
     *  make the words change under them. */
    this.options = options ?? levelingOptions(settings, { online });
    /** LEGACY-CHOICE: a stacked screen's own block tops (stackedTops), one past the last its footer's; null keeps the
     *  fixed pitch (the leveling question's two). */
    this.tops = stacked ? stackedTops(this.options) : null;
    this.text = text ?? LEVELING_SCREEN_TEXT;
    this.faceText = faceText;
    this.faceTags = faceTags;
    this._fired = false;
    this.cursor = this.defaultIndex;   // LEVEL-ONLINE: never parked on a shut option
    this.done = false;
    /** The hosts route by action name, not raw key codes, for this
     *  screen - it wants up/down/confirm and nothing typed. */
    this.isLevelingChoice = true;
  }

  /** The answer, once, however many doors call it (the other half of
   *  the law bible/Home.md states for a host slot's occupant). */
  answer(id) {
    if (this._fired) return false;
    this._fired = true;
    this.done = true;
    releaseLevelingFace(this);   // LEVEL-PLUS: the face goes with the question
    this._onAnswer?.(id);
    return true;
  }

  /** LEVEL-ONLINE: the first option that is open - where the cursor starts, and what a torn-down question answers. */
  get defaultIndex() {
    const i = this.options.findIndex((o) => !o.locked);
    return i < 0 ? 0 : i;
  }
  get defaultId() { return this.options[this.defaultIndex].id; }

  /** LEVEL-ONLINE: pick option `i` and answer - refused for a shut option. The one door the keys, the canvas click
   *  and the Plus face's buttons all go through. */
  pickIndex(i, sound = true) {   // a pointer's pick clicks; a key's answers quietly, as it always has
    if (this._fired) return false;
    const opt = this.options[i];
    if (!opt || opt.locked) return false;
    this.cursor = i;
    if (sound) audio.playOneShot(SOUND.ButtonClick, 1);
    return this.answer(opt.id);
  }

  /** The highlight follows the pointer onto an open option (the canvas hover and the Plus face's). */
  hoverIndex(i) {
    if (this._fired) return;
    if (this.options[i] && !this.options[i].locked) this.cursor = i;
  }

  /** BOTH VOCABULARIES, as ui/charsheet.js's ROLLOUT_ACTIONS answers
   *  both - the overlayAction names a host hands a non-choice window,
   *  and the raw `e.code` a caller that drives the window directly
   *  sends. This screen sits at the END of the chargen window, whose
   *  earlier stage IS a choice window taking raw codes, so a caller
   *  walking the whole wizard with codes must not fall off a cliff at
   *  the last screen (test/audit17f.test.js's walk does exactly that). */
  static ACTIONS = Object.freeze({
    // LEGACY-CHOICE: each way its own - with two options either moves between them, with three they are a direction
    up: 'up', ArrowUp: 'up', down: 'down', ArrowDown: 'down',
    confirm: 'confirm', Enter: 'confirm', NumpadEnter: 'confirm', KeyE: 'confirm',
    'char:1': 'one', Digit1: 'one', Numpad1: 'one',
    'char:2': 'two', Digit2: 'two', Numpad2: 'two',
    'char:3': 'three', Digit3: 'three', Numpad3: 'three',   // LEGACY-CHOICE: the third answer online
  });

  input(action) {
    if (this._fired) return;
    const move = LevelingChoiceScreen.ACTIONS[action];
    switch (move) {
      case 'up':
      case 'down': {
        // LEVEL-ONLINE: the move skips a shut option (with one open option, the cursor stays on it)
        const n = this.options.length, step = move === 'up' ? n - 1 : 1;
        let next = this.cursor;
        for (let k = 0; k < n; k++) {
          next = (next + step) % n;
          if (!this.options[next].locked) break;
        }
        if (next !== this.cursor) { this.cursor = next; audio.playOneShot(SOUND.ButtonClick, 1); }
        break;
      }
      case 'one': this.pickIndex(0, false); break;
      case 'two': this.pickIndex(1, false); break;
      case 'three': this.pickIndex(2, false); break;   // a screen of two has no third: refused as no option
      case 'confirm': this.pickIndex(this.cursor, false); break;
      default: break;   // every other key is inert: this screen has no way out but an answer
    }
  }

  /**
   * THE POINTER SEAM (U10's law: the hosts hand NATIVE 320x200 coords).
   *
   * The classic wizard is completable with the mouse alone and has been
   * since U8b - `tools/chargenClickProbe.mjs` is the pin - so a screen
   * the door puts in FRONT of its OK must be clickable too. Without
   * this a player who never touched the keyboard reached the question
   * and could go no further: the wizard was finished, `done` never came
   * true, and `finishChargen` never ran. (ORL1's adversarial review.)
   *
   * A click on an option picks it AND answers, which is the one-press
   * behaviour every other picker in the wizard has.
   */
  click(vx, vy) {
    if (this._fired) return false;
    const i = choiceAtNative(vx, vy, this.options, this.tops);
    if (i < 0) return false;
    return this.pickIndex(i);
  }

  /** ...and the highlight follows the pointer, as the wizard's lists do. */
  hover(vx, vy) {
    if (this._fired) return;
    const i = choiceAtNative(vx, vy, this.options, this.tops);
    if (i >= 0) this.hoverIndex(i);
  }

  /** Where block `i` starts on this screen - its stacked top, else the fixed pitch's (`i` one past the last: the foot). */
  topOf(i) { return this.tops ? this.tops[i] : choiceTop(i); }

  /**
   * THE PICTURE IS PAINTED WHERE THE HIT TEST LOOKS, which it was not.
   *
   * This drew at `32 * s` from the CANVAS ORIGIN while `choiceAtNative`
   * read letterboxed 320x200 native units, so through townTalk - the
   * pointer route world.js and exterior.js both use - the two were an
   * (ox, oy) apart. Measured over each painted option: on 1366x768 a
   * click on the Oblivion option selected DAGGERFALL over 27% of its
   * area, on 1024x768 29%, on 1512x982 21%, and on 800x600 59% - where a
   * click on the Daggerfall option landed on it 3% of the time. The
   * wrong leveling system, chosen
   * silently, on the one screen a character can never come back to.
   * tools/chargenClickProbe.mjs runs at 1400x900 and clicked a point
   * inside the overlap, so it could not see it. (ORL1's deep audit.)
   *
   * `nativeMetrics(canvas)` is the idiom every other clickable native
   * window uses, and it is right in BOTH hosts: dungeonContext hands a
   * virtual 320*s canvas with the letterbox already on the renderer, and
   * nativeMetrics of that returns ox = oy = 0.
   */
  draw(renderer, canvas, font) {
    // LEVEL-PLUS: on the Enhanced Plus skin the question wears the Plus window (ui/enhancedLevelingChoice.js); the
    // canvas below is the classic skin's, and the fallback for a host with no document.
    if (!this._fired && isEnhanced() && typeof document !== 'undefined' && drawLevelingFace(this)) return;
    const m = nativeMetrics(canvas);
    const s = m.s;
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height },
      undefined, [0.04, 0.03, 0.02, 0.94]);
    const gold = [0.85, 0.72, 0.35, 1], white = [0.9, 0.9, 0.85, 1];
    const hot = [1, 0.95, 0.6, 1], dim = [0.5, 0.5, 0.45, 1];
    const at = (text, x, y, colour) =>
      drawText(renderer, font, text, m.ox + x * s, m.oy + y * s, s, colour);
    // centred in the GAME AREA, not on the canvas - the two are the same
    // thing only at exactly 16:10.
    const centre = (text, y, colour) =>
      at(text, (NATIVE_W - measureText(font.fnt, text)) / 2, y, colour);

    centre(this.text.title, 12, gold);
    centre(this.text.lines[0], 24, dim);
    centre(this.text.lines[1], 34, dim);

    this.options.forEach((opt, i) => {
      const on = i === this.cursor;
      let y = this.topOf(i);                   // the same table the hit test reads
      at(`${on ? '>' : ' '} ${i + 1}. ${opt.title}${opt.locked ? ` - ${opt.lockNote}` : ''}`, 20, y, opt.locked ? dim : on ? hot : white);   // LEVEL-ONLINE: a shut option says why
      y += CHOICE_TITLE_H;
      for (const line of opt.lines) {
        at(`   ${line}`, 20, y, on ? white : dim);
        y += CHOICE_LINE_H;
      }
    });

    const foot = this.topOf(this.options.length) + 2;
    centre(`click one, or up/down and ENTER, or press ${choiceKeysWord(this.options.length)}`, foot, dim);
  }
}
