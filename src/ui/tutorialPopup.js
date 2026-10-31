// TUT1 (2026-10-11): THE TUTORIAL POPUP - a page of systems/tutorialCatalogue.js on the live host's slot, the first
// time the player reaches the system it explains.
//
// THE DOOR IS THE MESSAGE BOX'S. A tutorial page is a DaggerfallUI.MessageBox in every way that matters: it is
// modal, it lies over whatever the player just opened, and a click or any key puts it away. So it is an ActionTextBox
// offered through systems/notify.js's ladder (mountWindow, pushed) - the one door every host already presents, on both
// skins (the enhanced notice panel, the classic parchment). No host is handed a new seam, and the four hosts are the
// four presenters notify already knows.
//
// THE PAGE IS READ WHEN IT IS DISMISSED, NOT WHEN IT IS RAISED. A box can be REPLACED before anyone reads it - the
// window the player opened mounts a frame later, or its lazy chunk lands and the host's showOverlay disposes whatever
// held the slot. A replaced box (dispose) goes back to the front of the line and is offered again; only the box's own
// close (`onClose`, which a replacement never runs) marks the page read. A box no host takes waits and is offered
// again. So a page is never lost to a race and never marked read unseen.
//
// ONE AT A TIME, A BEAT LATE. The first use of a system is usually a window opening; the page is offered a beat after
// the trigger (SHOW_DELAY_MS) so that window holds the slot first and the page is pushed OVER it, never under it.
// While one page stands, the next waits for its close.
//
// IT IS READ, NOT SWATTED (AUDIT TUT1). Hosts hand every keydown to the top window, auto-repeats included, and a click
// to it whatever it is: a page that pops while W is held, or as the attack button goes down, was gone the next frame -
// and marked read. A page takes no input until it has stood on screen INPUT_GRACE_MS AND a fresh press has come since
// (a key going down, not repeating; a click; a tap; a pad's button - the pad and the touch layer press real keys).
//
// IT IS NEVER LOST (AUDIT TUT1). A host can drop a window from its slot by hand without disposing it (the dungeon's
// pack crossing to the sheet writes the slot direct, and its stack swaps the top in place), so a page could vanish with
// neither its close nor its replacement told - and the line waited on it for the rest of the session. While a page
// stands, a watchdog asks the hosts whether any still holds it (systems/notify.js windowHeld); twice no, and it is
// offered again. A page merely COVERED (a message pushed over it) is still held, and waits.
//
// IT WAITS FOR THE WORLD. Never while the pause window stands, and never while the loading screen does - a scene's
// page (a gate's court, a dungeon) is asked for at the door and offered once the far side is up.
//
// THE WELCOME TOUR is one box of several pages (addNext, DaggerfallMessageBox.AddNextMessageBox): each dismissal
// turns the page, and the last closes it and marks every page of it read.

import { ActionTextBox } from './actionText.js';
import { mountWindow, windowHeld } from '../systems/notify.js';
import {
  tutorialById,
  tutorialDue,
  tutorialRows,
  markTutorialsSeen,
  setTutorialHandler,
  TUTORIAL_TOUR,
} from '../systems/tutorials.js';
import { bindings } from './input.js';
import { codeForAction } from '../systems/inputActions.js';
import { buttonText } from '../systems/controlsConfig.js';
import { pauseFlowShowing } from './pauseDoor.js'; // a page waits while the menu stands
import { loadingHeld } from './loadingScreen.js'; // ...and while the loading screen does

/** The beat between the trigger and the offer. */
export const SHOW_DELAY_MS = 350;
/** A door that is a scene's change (a gate's fire, a rift, the arena's floor) holds its page this long, so it is read on
 *  the far side and not over the step through. */
export const SCENE_CHANGE_TUTORIAL_MS = 4000;
/** How long a page no host would take waits before it is offered again, and how many times. */
export const RETRY_MS = 1500;
export const MAX_RETRIES = 40;
/** AUDIT TUT1: how long a page stands before a press can put it away, and how often the watchdog asks after it. */
export const INPUT_GRACE_MS = 400;
export const WATCH_MS = 1000;
/** The caption under the enhanced panel. */
export const TUTORIAL_HINT = 'click or press any key';

export const TUTORIAL_STYLE_ID = 'dfo-tutorial-style';
const TUTORIAL_CSS = `
.notice-row.tut-title { color: rgb(243,239,44); font-size: 17px; letter-spacing: 0.08em; text-transform: uppercase;
  text-shadow: 2px 2px 0 rgb(93,77,12); }
`;

/** TUT1 audit: a key as it is printed on the keyboard. The Controls page speaks DFU's own names ("A1" for the 1 key,
 *  "BCKSPC", "KPADDIVIDE"), which a player reading a tutorial should not have to decode; everything else is its name. */
const KEY_WORDS = Object.freeze({
  Backspace: 'BACKSPACE',
  Escape: 'ESC',
  Enter: 'ENTER',
  Space: 'SPACE',
  Tab: 'TAB',
  Backquote: '`',
  Quote: "'",
  Semicolon: ';',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  BracketLeft: '[',
  BracketRight: ']',
  ShiftLeft: 'SHIFT',
  ShiftRight: 'RIGHT SHIFT',
  ControlLeft: 'CTRL',
  ControlRight: 'RIGHT CTRL',
  AltLeft: 'ALT',
  AltRight: 'RIGHT ALT',
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  PageUp: 'PAGE UP',
  PageDown: 'PAGE DOWN',
  Home: 'HOME',
  End: 'END',
  Insert: 'INSERT',
  Delete: 'DELETE',
  NumpadAdd: 'NUMPAD +',
  NumpadSubtract: 'NUMPAD -',
  NumpadMultiply: 'NUMPAD *',
  NumpadDivide: 'NUMPAD /',
  NumpadEnter: 'NUMPAD ENTER',
  NumpadDecimal: 'NUMPAD .',
  Mouse3: 'MOUSE BACK',
  Mouse4: 'MOUSE FORWARD',
});
export function keyWord(code) {
  if (KEY_WORDS[code]) return KEY_WORDS[code];
  const m = /^(?:Key([A-Z])|Digit(\d)|Numpad(\d)|(F\d{1,2}))$/.exec(code);
  if (m) return m[1] ?? m[2] ?? (m[3] != null ? `NUMPAD ${m[3]}` : m[4]);
  return buttonText(code, true); // the mouse's clicks, a combo, anything else: the Controls page's own words
}

/** The key bound to an action now, as a player reads it off the keyboard; null when nothing a keyboard has is bound. */
export function boundKeyName(action, store = null) {
  try {
    const code = codeForAction(store ?? bindings(), action);
    if (!code || /^Joystick/.test(code)) return null;
    return keyWord(code);
  } catch {
    return null;
  }
}

// AUDIT TUT1: THE LAST FRESH PRESS - a key going down (not a repeat), a click, a tap; the pad and the touch layer press
// real keys. Watched once, on the window, before anything else hears it.
let lastPressAt = -Infinity;
let pressWatched = false;
function watchPresses() {
  const w = deps.win();
  if (pressWatched || !w?.addEventListener) return;
  pressWatched = true;
  const note = (e) => {
    if (!e?.repeat) lastPressAt = deps.now();
  };
  for (const type of ['keydown', 'pointerdown', 'mousedown']) w.addEventListener(type, note, true);
}

/** A page's box: an ActionTextBox that tells its owner when it is REPLACED rather than read, and takes no input until
 *  it has been seen (AUDIT TUT1 - see the header). */
export class TutorialBox extends ActionTextBox {
  constructor(rows, { onClose = null, onReplaced = null } = {}) {
    super(rows, { onClose, noticeHint: TUTORIAL_HINT });
    this.onReplaced = typeof onReplaced === 'function' ? onReplaced : null;
    this.tutorial = true;
    this.shownAt = null; // the clock at its first draw
  }
  /** The host drew it: from now it is on screen. */
  markShown() {
    if (this.shownAt == null) this.shownAt = deps.now();
  }
  draw(...args) {
    this.markShown();
    return super.draw(...args);
  }
  /** Seen long enough, and a fresh press since the grace ran out (where presses are watched) - a key pressed as the
   *  page appeared and held through the grace is still that key, and its repeats are not a reading. The window's
   *  capture listener notes a press before any host hands it to the box, so the press that reads is its own proof. */
  ready() {
    if (this.shownAt == null || deps.now() - this.shownAt < INPUT_GRACE_MS) return false;
    return !pressWatched || lastPressAt >= this.shownAt + INPUT_GRACE_MS;
  }
  click() {
    if (this.ready()) this.input();
    return true;
  } // a click it is not ready for is still its own - never the world's
  dispose() {
    const cb = this.onReplaced;
    this.onReplaced = null;
    super.dispose();
    if (cb && !this.done) cb();
  }
  input() {
    if (!this.ready()) return;
    const before = this.lines;
    super.input();
    if (this.lines !== before && !this.done) this.shownAt = deps.now(); // a tour's next page is a new page to read
    if (this.done) this.onReplaced = null; // read: a later dispose is the host tidying a closed box, not a replacement
  }
}

// ── THE LINE ───────────────────────────────────────────────────
// Each entry is { ids: [...], forced, at } - one page, or a tour's pages in one box; `at` is the clock time before which
// it is not offered.
const line = [];
let current = null; // { entry, box } while a box stands
let timer = null;
let retries = 0;
let deps = {
  mount: (win) => mountWindow(win, { push: true }),
  setTimeout: (fn, ms) => {
    const t = globalThis.setTimeout(fn, ms);
    /** @type {any} */ (t)?.unref?.();
    return t;
  },
  now: () => Date.now(),
  clearTimeout: (t) => globalThis.clearTimeout(t),
  keyName: (action) => boundKeyName(action),
  doc: () => globalThis.document ?? null,
  win: () => (typeof globalThis.addEventListener === 'function' ? globalThis : null),
  held: () => pauseFlowShowing() || loadingHeld(), // the menu or the loading screen is up: a page waits for it
  isHeld: (win) => windowHeld(win), // does any host still hold this window (null: none can say)
};
let watchTimer = null;
let watchMisses = 0;

const queued = (id) => line.some((e) => e.ids.includes(id)) || !!current?.entry.ids.includes(id);

function ensureStyle() {
  const d = deps.doc();
  if (!d?.createElement || d.getElementById?.(TUTORIAL_STYLE_ID)) return;
  const st = d.createElement('style');
  st.id = TUTORIAL_STYLE_ID;
  st.textContent = TUTORIAL_CSS;
  (d.head ?? d.body)?.append?.(st);
}

let timerAt = Infinity; // when the standing timer fires
function schedule(ms) {
  const at = deps.now() + ms;
  if (timer != null) {
    if (at >= timerAt) return;
    deps.clearTimeout(timer); // an earlier offer is owed than the one waiting
  }
  timerAt = at;
  timer = deps.setTimeout(() => {
    timer = null;
    timerAt = Infinity;
    offer();
  }, ms);
}

function rowsOf(entry) {
  const pages = entry.ids.map(tutorialById).filter(Boolean);
  return pages.map((t, i) => tutorialRows(t, { keyName: deps.keyName, page: i + 1, pages: pages.length }));
}

/** Offer the line's first entry to the live host. */
function offer() {
  if (current || !line.length) return;
  const now = deps.now();
  const i = line.findIndex((e) => e.at <= now);
  if (i < 0) {
    schedule(Math.max(0, Math.min(...line.map((e) => e.at)) - now));
    return;
  }
  if (i > 0) line.unshift(...line.splice(i, 1)); // a page that is due goes before one still held back
  if (deps.held()) {
    schedule(RETRY_MS);
    return;
  } // the menu stands: the page waits for it, and costs no retry
  const entry = line[0];
  // a page read meanwhile (another tab, the menu's Mark all read) or the popups turned off: it does not show
  entry.ids = entry.ids.filter((id) => entry.forced || tutorialDue(id));
  if (!entry.ids.length) {
    line.shift();
    offer();
    return;
  }
  const [first, ...rest] = rowsOf(entry);
  const box = new TutorialBox(first, {
    onClose: () => {
      if (current?.box === box) current = null;
      markTutorialsSeen(entry.ids);
      retries = 0;
      schedule(SHOW_DELAY_MS);
    },
    onReplaced: () => {
      if (current?.box === box) current = null;
      line.unshift(entry);
      schedule(RETRY_MS);
    },
  });
  for (const rows of rest) box.addNext(rows);
  ensureStyle();
  line.shift();
  current = { entry, box };
  let taken = false;
  try {
    taken = !!deps.mount(box);
  } catch (e) {
    console.warn('[tutorial] a host refused the page', e);
  }
  if (taken) {
    watchPresses();
    watch();
    return;
  }
  // no host would take it (none presenting yet, or a slot that does not push): it waits its turn again
  current = null;
  box.onReplaced = null;
  line.unshift(entry);
  if (++retries <= MAX_RETRIES) schedule(RETRY_MS);
}

/** AUDIT TUT1: THE WATCHDOG - while a page stands, ask the hosts whether one still holds it. Twice no, and it is treated
 *  as replaced (its dispose re-queues it). A host that cannot say (none offers `holds`) is believed. */
function watch() {
  if (watchTimer != null) return;
  watchTimer = deps.setTimeout(() => {
    watchTimer = null;
    const box = current?.box;
    if (!box || box.done) {
      watchMisses = 0;
      return;
    }
    if (deps.isHeld(box) === false) {
      if (++watchMisses >= 2) {
        watchMisses = 0;
        box.dispose();
        return;
      }
    } else watchMisses = 0;
    watch();
  }, WATCH_MS);
}

/**
 * THE TRIGGER: the player has just reached system `id`. The page pops if the popups are on and it has never been
 * read; otherwise nothing. Safe from anywhere, any number of times. Answers whether a page was queued.
 */
export function tutorialFirstUse(id, { after = 0 } = {}) {
  if (!tutorialDue(id) || queued(id)) return false;
  const wait = Math.max(SHOW_DELAY_MS, Number.isFinite(after) ? after : 0);
  line.push({ ids: [id], forced: false, at: deps.now() + wait });
  schedule(wait);
  return true;
}

// THE REGISTRATION: every seam's `noteFirstUse` (systems/tutorials.js) lands here once a host has loaded this module.
// No unregister: the hosts live as long as the page (notify's presenters say the same of townTalk's).
setTutorialHandler(tutorialFirstUse);

/** The welcome tour, for a new character: the tour's unread pages in one box. Answers whether it was queued. */
export function startTutorialTour() {
  const ids = TUTORIAL_TOUR.filter((id) => tutorialDue(id) && !queued(id));
  if (!ids.length) return false;
  line.unshift({ ids, forced: false, at: deps.now() + SHOW_DELAY_MS }); // the tour goes first: it is the beginning
  schedule(SHOW_DELAY_MS);
  return true;
}

/** Show a page now whether or not it was read (a "show me in game" door). */
export function showTutorialNow(id) {
  if (!tutorialById(id) || queued(id)) return false;
  line.push({ ids: [id], forced: true, at: deps.now() + SHOW_DELAY_MS });
  schedule(SHOW_DELAY_MS);
  return true;
}

/** The line as it stands, for a probe or a test: the ids waiting, and the ids on screen. */
export const tutorialLine = () => ({
  waiting: line.map((e) => [...e.ids]),
  showing: current ? [...current.entry.ids] : null,
});

/** Drop everything waiting (the popups turned off, a new game). A box on screen stays until it is put away. */
export function clearTutorialLine() {
  line.length = 0;
  if (timer != null) {
    deps.clearTimeout(timer);
    timer = null;
  }
  if (watchTimer != null) {
    deps.clearTimeout(watchTimer);
    watchTimer = null;
  }
  timerAt = Infinity;
  retries = 0;
  watchMisses = 0;
}

/** Tests: swap the seams, and start from nothing. */
export function _setTutorialDepsForTests(over = {}) {
  clearTutorialLine();
  current = null;
  pressWatched = false;
  lastPressAt = -Infinity;
  deps = { ...deps, ...over };
}
