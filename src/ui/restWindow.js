// The rest window (U7). The classic rest flow in the U-arc's clean
// text-panel idiom (backgrounds FLAGGED pending art-name
// verification, the shared UI note): a selection page (rest for a
// while / rest until healed / loiter), an hours prompt for the timed
// modes, and the running page showing hours passed + live vitals
// while the RestSession (systems/restSession.js) drives the clock.
// The world keeps running under the overlay - foes approach and can
// break the rest, exactly the DFU shape. Escape (or the rest key
// re-routed as 'back') ends a running rest with its finish text;
// the end page is click/key-to-close.

import { drawText, measureText } from './text.js';
import { RestSession, REST_PROMPT, LOITER_PROMPT, LOITER_LIMIT_HOURS, CANNOT_LOITER_LINES } from '../systems/restSession.js';

const PANEL = [0.05, 0.05, 0.09, 0.92];
const TEXT = [0.86, 0.82, 0.68, 1];
const DIM = [0.55, 0.52, 0.45, 1];

export class RestWindow {
  /** deps: the RestSession deps + endLines(textId) -> string[] (the
   *  scene's TEXT.RSC lookup for the finish message). */
  constructor(deps) {
    this.deps = deps;
    this.state = 'selection';   // selection | hours | resting | ended
    this.mode = null;
    this.value = '';
    this.session = null;
    this.endLines = null;
    this.notice = null;         // the cannot-loiter refusal lines
    this.done = false;
    this.isRestWindow = true;   // the scene's tick tag
  }

  input(action) {
    if (this.state === 'ended') {
      this.done = true;
      // AUDIT 23 (entity-1) - DaggerfallRestWindow.cs:729-732: closing
      // the finished popup is THE advancement moment (RaiseSkills).
      this.deps.onRestFinished?.();
      return;
    }
    if (this.state === 'resting') {
      if (action === 'back') this._end(this.session.endEarly());
      return;
    }
    if (this.state === 'selection') {
      if (action === 'back') { this.done = true; return; }
      if (action === 'char:1' || action === 'char:r') { this.state = 'hours'; this.mode = 'timed'; this.value = ''; this.notice = null; }
      else if (action === 'char:2' || action === 'char:h') this._start('full', 0);
      else if (action === 'char:3' || action === 'char:l') { this.state = 'hours'; this.mode = 'loiter'; this.value = ''; this.notice = null; }
      return;
    }
    // hours entry: digits, backspace, confirm
    if (action === 'back') { this.state = 'selection'; this.notice = null; return; }
    if (action === 'backspace') { this.value = this.value.slice(0, -1); return; }
    if (action === 'confirm') {
      // DFU's prompt: an unparseable (empty) entry does nothing; 0 IS
      // accepted - and the session ENDS IMMEDIATELY, passing no world
      // time (restSession's hoursRemaining < 1 pre-check; AUDIT 23
      // corrected the old 'rests one full hour' claim, the same
      // backwards reading AUDIT 18 struck from Ledger B). The 2-digit
      // entry field enforces the 99-hour cap by construction (DFU
      // shows TEXT 26 past 99).
      if (this.value === '') return;
      const hours = Number(this.value);
      if (this.mode === 'loiter' && hours > LOITER_LIMIT_HOURS) { this.notice = CANNOT_LOITER_LINES; this.value = ''; return; }
      this._start(this.mode, hours);
      return;
    }
    const m = /^char:(\d)$/.exec(action);
    if (m && this.value.length < 2) this.value += m[1];
  }

  _start(mode, hours) {
    this.mode = mode;
    this.session = new RestSession(mode, hours, this.deps);
    this.state = 'resting';
  }

  _end(result) {
    this.endLines = result.died ? null : (this.deps.endLines?.(result.textId) ?? null);
    if (result.died || !this.endLines) { this.done = true; return; }   // death: the death screen owns the flow
    this.state = 'ended';
  }

  /** Called from the scene frame while resting (dt = real seconds). */
  tickRest(dt) {
    if (this.state !== 'resting') return;
    const r = this.session.tick(dt);
    if (r) this._end(r);
  }

  draw(renderer, canvas, font, s) {
    let lines;
    if (this.state === 'selection') {
      lines = ['How would you like to rest?', '', '1. Rest for a while', '2. Rest until healed', '3. Loiter', '', 'Esc - never mind'];
    } else if (this.state === 'hours') {
      lines = [(this.mode === 'loiter' ? LOITER_PROMPT : REST_PROMPT) + this.value + '_'];
      if (this.notice) lines = [...this.notice, '', ...lines];
    } else if (this.state === 'resting') {
      const v = this.deps.vitals?.() ?? null;
      lines = [this.mode === 'loiter' ? 'Loitering...' : 'Resting...', `Hours passed: ${this.session.totalHours}`];
      if (v) lines.push(`Health ${v.health}/${v.maxHealth}  Fatigue ${v.fatigue}  Magicka ${v.magicka}`);
      lines.push('', 'Esc - stop');
    } else {
      lines = this.endLines ?? [''];
    }
    const w = Math.max(...lines.map((l) => measureText(font.fnt, l))) * s + 24 * s;
    const lineH = 12 * s;
    const h = lines.length * lineH + 20 * s;
    const x = (canvas.width - w) / 2, y = (canvas.height - h) / 2;
    renderer.drawScreenQuad(null, { x, y, w, h }, undefined, PANEL);
    let ty = y + 12 * s;
    for (const l of lines) {
      drawText(renderer, font, l, x + 12 * s, ty, s, l.startsWith('Esc') ? DIM : TEXT);
      ty += lineH;
    }
  }
}
