// START2 (2026-10-24, bible/06-Systems/Alternate-Starts-Arc.md section 7; the owner: "Each new region will each have
// their own unique starting quest/dungeon within that region", the draft's page "Where does your story begin?") - THE
// START-CHOICE PAGE, the last question of making a character: where they wake - the Iliac Bay's Privateer's Hold or a
// province past the Bay (systems/starts/starts.js STARTS) - their race's homeland chosen for them first.
//
// THE CHARGEN DOOR'S QUESTION, as the leveling and the lineage questions are (systems/chargenSession.js
// withLevelingChoice: a stage of the one overlay, answered once, the answer riding the result as `startKey`), and
// with their screen's contract (ui/levelingChoice.js LevelingChoiceScreen): one answer through `answer` (the
// fire-once latch), `defaultId` for a question torn down unanswered, the overlay's action names and the raw codes, the
// pointer in native 320x200 units, both faces. Eight answers do not stand as that screen's tiles, so this one is a
// list and the chosen start's story beside it (the Plus face: ui/enhanced/enhancedStartChoice.js) - the classic face
// draws text over a dim, as that screen does, for the same reason (the NATIVE-WINDOW RULE: Daggerfall never asked
// this, so no native art is claimed).
//
// A start the host cannot stand is SHUT, shown with why (`open` - a province's while the land past the Bay is off),
// as a shut leveling system is: the cursor never rests on it and no key or press picks it.

import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { drawText, measureText } from './text.js';
import { nativeMetrics, NATIVE_W } from './native/nativePanel.js';
import { isEnhanced } from '../systems/uiSkin.js';
import { drawStartChoiceFace, releaseStartChoiceFace } from './enhanced/enhancedStartChoice.js';
import { STARTS, homelandStart } from '../systems/starts/starts.js';
import { t } from '../systems/textManager.js';

/** Each start's words on the page: its title, where its story begins, and the story. */
const WORDS = Object.freeze({
  IliacBay: () => ({
    title: t('start.IliacBay.title', 'The Iliac Bay'),
    where: t('start.IliacBay.where', "Privateer's Hold"),
    body: t(
      'start.IliacBay.body',
      "Your ship to Daggerfall goes down in a storm, and you wake in a pirates' cave on the coast. The Emperor's sealed orders were lost in the wreck. The tide may have carried them in.",
    ),
  }),
  Skyrim: () => ({
    title: t('start.Skyrim.title', 'Skyrim'),
    where: t('start.Skyrim.where', 'A haunted hall near Solitude'),
    body: t(
      'start.Skyrim.body',
      "The Emperor's courier sheltered from a blizzard in an old hall near Solitude, where the dead do not rest. He carried your sealed orders, and he never came out. You go in after him.",
    ),
  }),
  Morrowind: () => ({
    title: t('start.Morrowind.title', 'Morrowind'),
    where: t('start.Morrowind.where', 'A dig near Mournhold'),
    body: t(
      'start.Morrowind.body',
      "Diggers near Mournhold broke through into old Dwemer halls and fled what they found. The Emperor's courier went down after them with your sealed orders. Neither came back up.",
    ),
  }),
  Imperial: () => ({
    title: t('start.Imperial.title', 'The Imperial Province'),
    where: t('start.Imperial.where', 'An old prison near the Imperial City'),
    body: t(
      'start.Imperial.body',
      "The Blades test the Emperor's agents before they trust them. Your sealed orders lie at the heart of a disused prison near the Imperial City. Bring them out, and you have passed.",
    ),
  }),
  BlackMarsh: () => ({
    title: t('start.BlackMarsh.title', 'Black Marsh'),
    where: t('start.BlackMarsh.where', "A smugglers' ruin near Helstrom"),
    body: t(
      'start.BlackMarsh.body',
      "Smugglers seized the Emperor's courier on the road from Helstrom and carried his satchel into a ruin in the marsh. Your sealed orders are in it.",
    ),
  }),
  Elsweyr: () => ({
    title: t('start.Elsweyr.title', 'Elsweyr'),
    where: t('start.Elsweyr.where', "A bandits' hold near Torval"),
    body: t(
      'start.Elsweyr.body',
      "Bandits took a caravan of Dwemer brass bound for Sentinel, and the Emperor's courier who rode with it. Your sealed orders are somewhere in their hold.",
    ),
  }),
  Valenwood: () => ({
    title: t('start.Valenwood.title', 'Valenwood'),
    where: t('start.Valenwood.where', 'A cave under the roots near Falinesti'),
    body: t(
      'start.Valenwood.body',
      'A wounded Blades courier crawled into a cave near Falinesti to hide from the men hunting her. She carried your sealed orders. Find her.',
    ),
  }),
  Sumurset: () => ({
    title: t('start.Sumurset.title', 'Sumurset Isle'),
    where: t('start.Sumurset.where', "A sorcerer's hall near Alinor"),
    body: t(
      'start.Sumurset.body',
      "A scholar of the Mantella was to hand you the Emperor's sealed orders. She was found dead in the hall near Alinor where she kept her notes, and the orders are still inside.",
    ),
  }),
});
/** A start's words, in the player's language. */
export const startWords = (start) => WORDS[start.key]();

/** The classic face's words above and below the list; the Plus face's (ui/enhanced/enhancedStartChoice.js). */
export const START_CHOICE_TEXT = Object.freeze({
  get title() {
    return t('start.page.titleClassic', 'WHERE DOES YOUR STORY BEGIN?');
  },
  get lead() {
    return t(
      'start.page.lead',
      "Choose where this character wakes. Wherever it is, the Emperor's orders send you to Daggerfall, and the main story begins when you get there.",
    );
  },
  get eyebrow() {
    return t('start.page.eyebrow', 'A new character');
  },
  get heading() {
    return t('start.page.title', 'Where does your story begin?');
  },
  get pick() {
    return t('start.page.pick', 'Begin here');
  },
  get homeland() {
    return t('start.page.homeland', 'Your homeland');
  },
  get shut() {
    return t('start.page.shut', 'The land past the Bay is off');
  },
  hint: (n) => t('start.page.hint', 'Click one, or up/down and Enter, or press 1 to {n}', { n }),
});

/** Where the list sits, in the native 320x200 units the hosts' pointer seam speaks - ONE table, read by the draw and by
 *  the hit test (ui/levelingChoice.js's law). */
export const START_ROW_TOP = 46;
export const START_ROW_H = 11;
export const START_X0 = 16,
  START_X1 = 304;
/** The lead's lines at most, over the list. */
export const START_LEAD_LINES = 3;
/** The chosen start under the list: its first line (where its story begins), a line's height, the width. */
export const START_BODY_TOP = START_ROW_TOP + STARTS.length * START_ROW_H + 6;
export const START_BODY_LINE_H = 9;
export const START_BODY_W = 280;
/** The story's lines at most (its where-line above them): the hint's row at 190 below. */
export const START_BODY_LINES = 4;

/** The row a native point falls on, or -1. */
export function startRowAt(vx, vy, n = STARTS.length) {
  if (vx < START_X0 || vx > START_X1 || vy < START_ROW_TOP) return -1;
  const i = Math.floor((vy - START_ROW_TOP) / START_ROW_H);
  return i < n ? i : -1;
}

/** `text` broken into lines of at most `width` native units (`measure` the font's), at spaces. */
export function wrapToWidth(text, width, measure) {
  const out = [];
  let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > width) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

export class StartChoiceScreen {
  /**
   * @param {(key: string) => void} onAnswer
   * @param {{ race?: ?string, open?: (start: any) => boolean, why?: (start: any) => ?string }} [opts] the new character's
   *   race (systems/races.js key) - its homeland's start chosen first; `open` - whether the host can stand a start (the
   *   Bay's always); `why` - the host's word for a start it shuts (AUDIT STARTS W2: the open zone online), else the page's
   */
  constructor(onAnswer, { race = null, open = () => true, why = () => null } = {}) {
    this._onAnswer = onAnswer;
    /** Read ONCE, when the question is built (ui/levelingChoice.js's law: the words never change under the player). */
    const home = homelandStart(race);
    this.options = Object.freeze(
      STARTS.map((start) => {
        const shut = start !== STARTS[0] && !open(start);
        return Object.freeze({
          id: start.key,
          start,
          ...startWords(start),
          homeland: start === home,
          locked: shut,
          lockNote: shut ? (why(start) ?? START_CHOICE_TEXT.shut) : null,
        });
      }),
    );
    /** The page's own words, which the Plus face reads off the screen. */
    this.text = START_CHOICE_TEXT;
    this._fired = false;
    this._faced = false; // the Plus face drew last frame - its rows take the pointer (ui/levelingChoice.js's LEGACY-POINTER)
    this._shown = -1; // AUDIT STARTS U3: the start whose story a face last drew - the one a press may answer for
    const at = this.options.findIndex((o) => o.homeland && !o.locked);
    this.cursor = at >= 0 ? at : this.defaultIndex;
    this.done = false;
    /** The hosts route by action name for this screen, as for the leveling question. */
    this.isLevelingChoice = true;
  }

  /** The answer, once, however many doors call it. */
  answer(id) {
    if (this._fired) return false;
    this._fired = true;
    this.done = true;
    releaseStartChoiceFace(this);
    this._onAnswer?.(id);
    return true;
  }

  /** The first open start - the Bay's, which is never shut. */
  get defaultIndex() {
    const i = this.options.findIndex((o) => !o.locked);
    return i < 0 ? 0 : i;
  }
  /** What a question torn down unanswered answers: the start the cursor rests on (the homeland's, unless moved). */
  get defaultId() {
    return (
      this.options[this.cursor] && !this.options[this.cursor].locked
        ? this.options[this.cursor]
        : this.options[this.defaultIndex]
    ).id;
  }

  /** Pick start `i` and answer - refused for a shut one. The keys, the canvas click and the Plus face's rows all come here. */
  pickIndex(i, sound = true) {
    if (this._fired) return false;
    const opt = this.options[i];
    if (!opt || opt.locked) return false;
    this.cursor = i;
    if (sound) audio.playOneShot(SOUND.ButtonClick, 1);
    return this.answer(opt.id);
  }

  /**
   * AUDIT STARTS U3 - A POINTER'S PRESS ON A ROW, the canvas's and the Plus face's: it answers only for the start whose
   * story the page has drawn. A press on any other selects it, and the next frame tells its story; a second press,
   * Begin here or Enter answers. A phone's tap is its hover and its press in one gesture, before any frame - it had
   * answered for a start whose story the player never saw. A mouse's hover draws the story first, so its click answers.
   */
  pressIndex(i) {
    if (this._fired) return false;
    if (i === this._shown) return this.pickIndex(i);
    const was = this.cursor;
    this.hoverIndex(i);
    if (this.cursor !== was) audio.playOneShot(SOUND.ButtonClick, 1);
    return false;
  }

  /** The highlight follows the pointer onto an open start. */
  hoverIndex(i) {
    if (this._fired) return;
    if (this.options[i] && !this.options[i].locked) this.cursor = i;
  }

  /** Both vocabularies (ui/levelingChoice.js ACTIONS): the overlay's action names and the raw codes - digits 1 to 8. */
  static ACTIONS = Object.freeze({
    up: 'up',
    ArrowUp: 'up',
    down: 'down',
    ArrowDown: 'down',
    confirm: 'confirm',
    Enter: 'confirm',
    NumpadEnter: 'confirm',
    KeyE: 'confirm',
    ...Object.fromEntries(
      STARTS.flatMap((_, i) => [
        [`char:${i + 1}`, i],
        [`Digit${i + 1}`, i],
        [`Numpad${i + 1}`, i],
      ]),
    ),
  });

  input(action) {
    if (this._fired) return;
    const move = StartChoiceScreen.ACTIONS[action];
    if (typeof move === 'number') {
      this.pickIndex(move, false);
      return;
    }
    if (move === 'confirm') {
      this.pickIndex(this.cursor, false);
      return;
    }
    if (move !== 'up' && move !== 'down') return; // every other key is inert: the page has no way out but an answer
    const n = this.options.length,
      step = move === 'up' ? n - 1 : 1;
    let next = this.cursor;
    for (let k = 0; k < n; k++) {
      next = (next + step) % n;
      if (!this.options[next].locked) break;
    }
    if (next !== this.cursor) {
      this.cursor = next;
      audio.playOneShot(SOUND.ButtonClick, 1);
    }
  }

  /** THE CANVAS FACE'S POINTER (native units): a press on a row picks it - and answers once its story is up (U3). */
  click(vx, vy) {
    if (this._fired || this._faced) return false;
    const i = startRowAt(vx, vy, this.options.length);
    return i >= 0 ? this.pressIndex(i) : false;
  }
  hover(vx, vy) {
    if (this._fired || this._faced) return;
    const i = startRowAt(vx, vy, this.options.length);
    if (i >= 0) this.hoverIndex(i);
  }

  /** The Plus face on the Enhanced Plus skin; else the classic face - the list, then the chosen start's story - painted
   *  where the hit test looks (nativeMetrics, ui/levelingChoice.js's law). */
  draw(renderer, canvas, font) {
    this._faced = false;
    if (!this._fired && isEnhanced() && typeof document !== 'undefined' && drawStartChoiceFace(this)) {
      this._faced = true;
      this._shown = this.cursor;
      return;
    }
    const m = nativeMetrics(canvas);
    const s = m.s;
    renderer.drawScreenQuad(
      null,
      { x: 0, y: 0, w: canvas.width, h: canvas.height },
      undefined,
      [0.04, 0.03, 0.02, 0.94],
    );
    const gold = [0.85, 0.72, 0.35, 1],
      white = [0.9, 0.9, 0.85, 1],
      hot = [1, 0.95, 0.6, 1],
      dim = [0.5, 0.5, 0.45, 1];
    const at = (text, x, y, colour) => drawText(renderer, font, text, m.ox + x * s, m.oy + y * s, s, colour);
    const measure = (text) => measureText(font.fnt, text);
    const centre = (text, y, colour) => at(text, (NATIVE_W - measure(text)) / 2, y, colour);
    centre(START_CHOICE_TEXT.title, 6, gold);
    wrapToWidth(START_CHOICE_TEXT.lead, START_BODY_W, measure)
      .slice(0, START_LEAD_LINES)
      .forEach((line, k) => centre(line, 17 + k * 9, dim));
    this.options.forEach((opt, i) => {
      const on = i === this.cursor;
      const tag = opt.locked ? ` - ${opt.lockNote}` : opt.homeland ? ` (${START_CHOICE_TEXT.homeland})` : '';
      at(
        `${on ? '>' : ' '} ${i + 1}. ${opt.title}${tag}`,
        START_X0,
        START_ROW_TOP + i * START_ROW_H,
        opt.locked ? dim : on ? hot : white,
      );
    });
    // the chosen start: where its story begins, then the story
    const chosen = this.options[this.cursor],
      x = (NATIVE_W - START_BODY_W) / 2;
    if (chosen) at(chosen.where, x, START_BODY_TOP, gold);
    wrapToWidth(chosen?.body ?? '', START_BODY_W, measure)
      .slice(0, START_BODY_LINES)
      .forEach((line, k) => at(line, x, START_BODY_TOP + (k + 1) * START_BODY_LINE_H, white));
    centre(START_CHOICE_TEXT.hint(this.options.length), 190, dim);
    this._shown = this.cursor;
  }
}
