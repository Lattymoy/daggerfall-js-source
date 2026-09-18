// SURV6 - THE HUNT WINDOW: the event's three pages in the overlay
// slot. ASK - the mod's Yes/No box (a ServiceFlowWindow's one box, so
// Y/N, Escape and the buttons are DFU's own); BUSY - the port's real-
// time page, the search's game minutes running at HUNT_WAIT_PER_HOUR
// real seconds an hour under `tick(dt)` (townTalk.js hands every
// overlay the frame's dt), a row of dots for the wait and no input
// taken - the hunter is committed; RESULT - the outcome's lines and
// the gains in a click-anywhere box. The host's `onSearched` runs
// ONCE, at the turn from busy to result: it rolls the outcome, applies
// it and returns the rows. `onClosed(searched)` runs once, when the
// window is done - the beast stands there, not under the box.
import { ServiceFlowWindow } from './guildServiceWindows.js';
import { nativeMetrics } from './nativePanel.js';
import { layoutMessageBox, drawMessageBox } from './messageBox.js';

export const HUNT_PHASE = Object.freeze({ Ask: 'ask', Busy: 'busy', Result: 'result' });
/** The busy page's dots: this many at the full wait. */
export const BUSY_DOTS = 12;

export class HuntWindow {
  constructor({ prompt = [], busy = 'You search...', seconds = 4, onSearched = null, onClosed = null } = {}) {
    this.done = false;
    this.isChoiceWindow = true;   // townTalk routes the raw key code (Y / N / Escape) to a choice window
    this.phase = HUNT_PHASE.Ask;
    this.seconds = Math.max(0.01, seconds);
    this.busy = busy;
    this.rows = null;
    this._elapsed = 0;
    this._onSearched = onSearched;
    this._onClosed = onClosed;
    this._flow = new ServiceFlowWindow([{
      rows: prompt.map((text) => ({ text, center: true })),
      buttons: 'YesNo',
      onYes: () => { this._begin(); return null; },
      onNo: () => { this._end(false); return null; },
    }], { onClose: () => { if (this.phase === HUNT_PHASE.Ask) this._end(false); } });
  }

  get progress() { return Math.min(1, this._elapsed / this.seconds); }

  _begin() { if (this.phase !== HUNT_PHASE.Ask) return; this.phase = HUNT_PHASE.Busy; this._elapsed = 0; }

  _end(searched) {
    if (this.done) return;
    this.done = true;
    this._onClosed?.(searched);
  }

  /** The frame's real seconds; the turn to the result at the wait's end. */
  tick(dt) {
    if (this.phase !== HUNT_PHASE.Busy) return;
    this._elapsed += Math.max(0, dt || 0);
    if (this._elapsed < this.seconds) return;
    this.phase = HUNT_PHASE.Result;
    const rows = this._onSearched?.() ?? [];
    this.rows = rows.length ? rows : ['Nothing came of it.'];
    this._flow = new ServiceFlowWindow([{ rows: this.rows.map((text) => ({ text, center: true })) }], { onClose: () => this._end(true) });
  }

  input(code, e = null) {
    if (this.phase === HUNT_PHASE.Busy) return;
    this._flow.input(code, e);
  }

  click(vx, vy) {
    if (this.phase === HUNT_PHASE.Busy) return true;
    return this._flow.click(vx, vy);
  }
  hover(vx, vy, e = null) { if (this.phase !== HUNT_PHASE.Busy) this._flow.hover?.(vx, vy, e); }
  release() { if (this.phase !== HUNT_PHASE.Busy) this._flow.release?.(); }

  draw(renderer, canvas, font) {
    if (this.phase !== HUNT_PHASE.Busy) { this._flow.draw(renderer, canvas, font); return; }
    const m = nativeMetrics(canvas);
    const dots = '.'.repeat(Math.max(1, Math.round(this.progress * BUSY_DOTS)));
    const rows = [{ text: this.busy, center: true }, { text: dots, center: true }];
    const sizing = [{ text: this.busy, center: true }, { text: '.'.repeat(BUSY_DOTS), center: true }];
    this._box = layoutMessageBox(font, rows, [], { sizingRows: sizing });
    drawMessageBox(renderer, m, font, this._box);
  }
}
