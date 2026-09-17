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
import { LEVELING_CLASSIC, LEVELING_VIRTUE } from '../systems/oblivionLeveling.js';

/** The two answers, in the order they are offered. Daggerfall's own is
 *  FIRST and is what a player who presses Enter without reading gets -
 *  the port's own law is the default, and the mod is the opt-in. */
export const LEVELING_OPTIONS = Object.freeze([
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
      'raise fills it - your best skills fill it fastest - and at a',
      'hundred you level, with anything over carried into the next.',
      'Each level hands you twelve virtues to spend where you choose.',
    ]),
  }),
]);

export class LevelingChoiceScreen {
  /** @param {(id: string) => void} onAnswer */
  constructor(onAnswer) {
    this._onAnswer = onAnswer;
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
        this.cursor = (this.cursor + 1) % LEVELING_OPTIONS.length;
        audio.playOneShot(SOUND.ButtonClick, 1);
        break;
      case 'one': this.answer(LEVELING_OPTIONS[0].id); break;
      case 'two': this.answer(LEVELING_OPTIONS[1].id); break;
      case 'confirm': this.answer(LEVELING_OPTIONS[this.cursor].id); break;
      default: break;   // every other key is inert: this screen has no way out but an answer
    }
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

    let y = 44;
    LEVELING_OPTIONS.forEach((opt, i) => {
      const on = i === this.cursor;
      drawText(renderer, font, `${on ? '>' : ' '} ${i + 1}. ${opt.title}`, 32 * s, y * s, s, on ? hot : white);
      y += 12;
      for (const line of opt.lines) {
        drawText(renderer, font, `     ${line}`, 32 * s, y * s, s, on ? white : dim);
        y += 10;
      }
      y += 8;
    });

    centre('up/down to choose, 1 or 2 to pick, ENTER to confirm', y + 4, dim);
  }
}
