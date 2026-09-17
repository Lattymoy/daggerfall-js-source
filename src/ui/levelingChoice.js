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
import {
  LEVELING_CLASSIC, LEVELING_VIRTUE, levelingSettings, LEVELUP_TOTAL,
} from '../systems/oblivionLeveling.js';

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
export function levelingOptions(s = null) {
  const set = s ?? levelingSettings();
  const purse = set.attributePoints;
  const virtues = purse === 1 ? '1 virtue' : `${purse} virtues`;
  return Object.freeze([
    Object.freeze({
      id: LEVELING_CLASSIC,
      title: 'Daggerfall',
      lines: Object.freeze([
        'Level with your skills, as Daggerfall does. Your primary,',
        'major and minor skills are weighed into one sum, and every',
        'fifteen points of it is a level. Each level rolls you four to',
        'six points to spread across your attributes.',
      ]),
    }),
    Object.freeze({
      id: LEVELING_VIRTUE,
      title: 'Oblivion Remastered',
      lines: Object.freeze([
        'Level with a bar, as Oblivion Remastered does. Every skill you',
        'raise fills it - your best skills fill it fastest - and at',
        `${LEVELUP_TOTAL} you level, with anything over carried into the next.`,
        purse > 0
          ? `Each level hands you ${virtues} to spend across at most`
          : 'Each level hands you no virtues at all, as you have set it,',
        purse > 0
          ? `${set.maxUpdatableAttribute} of your attributes.`
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
export const CHOICE_PITCH = 60;        // title + four lines + the gap
export const CHOICE_HEIGHT = 52;       // what a click on that option covers
export const CHOICE_X0 = 16, CHOICE_X1 = 304;

/** The option a native-coordinate point falls on, or -1. */
export function choiceAtNative(vx, vy, count = 2) {
  if (vx < CHOICE_X0 || vx > CHOICE_X1) return -1;
  for (let i = 0; i < count; i++) {
    const top = CHOICE_TOP + i * CHOICE_PITCH;
    if (vy >= top && vy < top + CHOICE_HEIGHT) return i;
  }
  return -1;
}

export class LevelingChoiceScreen {
  /** @param {(id: string) => void} onAnswer */
  constructor(onAnswer, { settings = null } = {}) {
    this._onAnswer = onAnswer;
    /** Read ONCE, when the question is built - a player cannot move a
     *  slider while this screen is up, and re-reading per frame would
     *  make the words change under them. */
    this.options = levelingOptions(settings);
    this._fired = false;
    this.cursor = 0;
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
    this._onAnswer?.(id);
    return true;
  }

  /** BOTH VOCABULARIES, as ui/charsheet.js's ROLLOUT_ACTIONS answers
   *  both - the overlayAction names a host hands a non-choice window,
   *  and the raw `e.code` a caller that drives the window directly
   *  sends. This screen sits at the END of the chargen window, whose
   *  earlier stage IS a choice window taking raw codes, so a caller
   *  walking the whole wizard with codes must not fall off a cliff at
   *  the last screen (test/audit17f.test.js's walk does exactly that). */
  static ACTIONS = Object.freeze({
    up: 'up', ArrowUp: 'up', down: 'up', ArrowDown: 'up',   // two options: either direction moves between them
    confirm: 'confirm', Enter: 'confirm', NumpadEnter: 'confirm', KeyE: 'confirm',
    'char:1': 'one', Digit1: 'one', Numpad1: 'one',
    'char:2': 'two', Digit2: 'two', Numpad2: 'two',
  });

  input(action) {
    if (this._fired) return;
    switch (LevelingChoiceScreen.ACTIONS[action]) {
      case 'up':
        this.cursor = (this.cursor + 1) % this.options.length;
        audio.playOneShot(SOUND.ButtonClick, 1);
        break;
      case 'one': this.answer(this.options[0].id); break;
      case 'two': this.answer(this.options[1].id); break;
      case 'confirm': this.answer(this.options[this.cursor].id); break;
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
    const i = choiceAtNative(vx, vy, this.options.length);
    if (i < 0) return false;
    this.cursor = i;
    audio.playOneShot(SOUND.ButtonClick, 1);
    return this.answer(this.options[i].id);
  }

  /** ...and the highlight follows the pointer, as the wizard's lists do. */
  hover(vx, vy) {
    if (this._fired) return;
    const i = choiceAtNative(vx, vy, this.options.length);
    if (i >= 0) this.cursor = i;
  }

  draw(renderer, canvas, font, s) {
    const W = canvas.width, H = canvas.height;
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: W, h: H }, undefined, [0.04, 0.03, 0.02, 0.94]);
    const gold = [0.85, 0.72, 0.35, 1], white = [0.9, 0.9, 0.85, 1];
    const hot = [1, 0.95, 0.6, 1], dim = [0.5, 0.5, 0.45, 1];
    const centre = (text, y, colour) =>
      drawText(renderer, font, text, (W - measureText(font.fnt, text) * s) / 2, y * s, s, colour);

    centre('HOW WILL YOU GROW?', 14, gold);
    centre('Choose the leveling system for this character. It cannot be changed later.', 26, dim);

    this.options.forEach((opt, i) => {
      const on = i === this.cursor;
      let y = CHOICE_TOP + i * CHOICE_PITCH;   // the same table the hit test reads
      drawText(renderer, font, `${on ? '>' : ' '} ${i + 1}. ${opt.title}`, 32 * s, y * s, s, on ? hot : white);
      y += 12;
      for (const line of opt.lines) {
        drawText(renderer, font, `     ${line}`, 32 * s, y * s, s, on ? white : dim);
        y += 10;
      }
    });

    const foot = CHOICE_TOP + this.options.length * CHOICE_PITCH + 4;
    centre('click one, or up/down and ENTER, or press 1 or 2', foot, dim);
  }
}
