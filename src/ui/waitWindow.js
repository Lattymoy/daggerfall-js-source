// FORAGE4 - THE WAIT PAGE: Foraging's online wait (scenes/foragingWait.js)
// in the overlay slot. The port's real-time page: the wait's game minutes
// run at WAIT_PER_HOUR real seconds an hour under `tick(dt)` (townTalk.js
// hands every overlay the frame's dt), a row of dots for the wait and no
// input taken - the wait is the cost (offline the hours are gone at once),
// so it takes no Escape and its caption promises none. `interruptWhen` is
// asked every frame and ends the page early when it answers true (a foe
// near - the rest test). `onClosed(finished)` runs ONCE, when the page is
// done. And two members for the wait's queue: `remaining`, and
// `extend(seconds)` - a second `raise time by` joins the one standing.
//
// This page was Climates & Calories' hunt window (SURV6) until the text
// hunt was removed (2026-10-04); its Yes/No and result pages went with it.
import { nativeMetrics } from './native/nativePanel.js';
import { layoutMessageBox, drawMessageBox } from './messageBox.js';
import { noticeFrame, noticeRelease } from './enhanced/enhancedNotice.js';   // ENH-NOTICE3: the page's own parchment, as the enhanced panel

/** The page's dots: this many at the full wait. */
export const BUSY_DOTS = 12;

export class WaitWindow {
  constructor({ busy = 'Time passes...', seconds = 4, onClosed = null, interruptWhen = null } = {}) {
    this.done = false;
    this.seconds = Math.max(0.01, seconds);
    this.busy = busy;
    this._elapsed = 0;
    this._interruptWhen = interruptWhen;
    this._onClosed = onClosed;
  }

  get progress() { return Math.min(1, this._elapsed / this.seconds); }
  /** The page's real seconds still to run. */
  get remaining() { return Math.max(0, this.seconds - this._elapsed); }
  /** A wait joins the one standing - its seconds added to this page's. */
  extend(seconds) { if (!this.done && seconds > 0) this.seconds += seconds; }
  /** The dots: the first at once, the last before the page ends. */
  get dots() { return '.'.repeat(Math.min(BUSY_DOTS, Math.floor(this.progress * BUSY_DOTS) + 1)); }
  /** The slot taken from under the window (a death screen, a transition) ends it early. */
  dispose() { this._end(false); }

  _end(finished) {
    if (this.done) return;
    this.done = true;
    // ENH-NOTICE3: EVERY PANEL AN OWNER RAISES IS RELEASED - and before
    // the close hook, which may raise the next box. This is the one door
    // every way out comes through (the wait's end, a foe near, dispose()
    // when the slot is taken), so the panel leaves with the window.
    noticeRelease(this);
    this._onClosed?.(finished);
  }

  /** The frame's real seconds; the end at the wait's end, or early when `interruptWhen` answers. */
  tick(dt) {
    if (this.done) return;
    if (this._interruptWhen?.()) { this._end(false); return; }   // a foe near ends it, the rest forgiven
    this._elapsed += Math.max(0, dt || 0);
    if (this._elapsed >= this.seconds) this._end(true);
  }

  /** No key is taken: the wait is the cost. */
  input() {}
  /** No click is taken either - swallowed, so it reaches nothing under the page. */
  click() { return true; }
  /** AUDIT HUNT-OUT C1: the pointer's move and its release are the page's too, taken and ignored - the hunt's page had
   *  them, and townTalk answers "not mine" for a window without them, so a look still locked in the frames after the
   *  page opened (the relock grace) was banked under it and turned the camera when the wait ended. */
  hover() {}
  release() {}

  draw(renderer, canvas, font) {
    const m = nativeMetrics(canvas);
    const rows = [{ text: this.busy, center: true }, { text: this.dots, center: true }];
    const sizing = [{ text: this.busy, center: true }, { text: '.'.repeat(BUSY_DOTS), center: true }];
    // THE PAGE IS THE PANEL'S. It is drawn with `drawMessageBox` and no
    // buttons, in the parchment's shape - but it is the PORT'S page, not
    // a DaggerfallUI.MessageBox, and it takes no click and no key. So it
    // rides the same per-frame door the nine classic windows take
    // (ui/restWindow.js, ui/bankWindow.js) with no caption, never "click
    // or press a key" (AUDIT ENH-NOTICE3 B2 - the hint tells the truth).
    // A per-frame door and not noticeHold: this window IS drawn every
    // frame, so the watchdog is the honest guard - a host that drops the
    // overlay without closing it stops drawing, and the panel goes.
    if (noticeFrame(this, rows, { hint: false })) { this._box = null; return; }
    this._box = layoutMessageBox(font, rows, [], { sizingRows: sizing });
    drawMessageBox(renderer, m, font, this._box);
  }
}
