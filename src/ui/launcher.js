// THE LAUNCHER (SETT-slice) - the port's answer to
// DaggerfallUnitySetupGameWizard's Options panel + Daggerfall-
// AdvancedSettingsWindow, the screen that runs before the splash.
//
// WHAT IS 1:1: the settings themselves - names, sections, defaults and
// getter semantics all live in systems/settings.js, which is DFU's
// SettingsManager. This file is only the SURFACE, and the surface is
// OURS by the same Ledger-A split every other screen in this port
// takes: DFU draws Unity panels sized to a desktop window, we draw the
// 320x200 native frame with the shared text helpers.
//
// WHY IT SHOWS SETTINGS IT WILL NOT LET YOU CHANGE. DFU implements
// both sides of every setting it ships, so its wizard can offer them
// all. This port does not - EnhancedCombatAI and AdvancedClimbing have
// one path each, and a browser has no resolution or gamepad to
// configure. A screen that offered those toggles anyway would be
// lying, and hiding them would leave the player unable to discover
// WHY Daggerfall's enhanced AI is missing here. So every setting is
// listed, and the ones that cannot move say so with their reason.
// That is the same doctrine as the port's INTERIM flags: named, never
// silently absent.
//
// Keys (the port's keyed idiom - travelMap.js's shape):
//   Up/Down    move the cursor        Left/Right  change the value
//   [ / ]      previous/next section  R           reset all to defaults
//   Enter      launch the game        Escape      launch the game
import { drawText, measureText } from './text.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import {
  DEFAULTS, tierOf, UNAVAILABLE, effectiveSettings, setValue, saveSettings, resetToDefaults, getBool,
} from '../systems/settings.js';

const PANEL = [0.06, 0.05, 0.04, 0.96];
const TEXT = [0.85, 0.80, 0.65, 1];
const HOT = [1, 0.95, 0.6, 1];
const DIM = [0.42, 0.40, 0.34, 1];
const LIVE_C = [0.72, 0.86, 0.62, 1];
const ROWS = 12;   // rows of settings visible at once

/** Bool-ish values render as a toggle; everything else as its text. */
const isBoolValue = (v) => v === 'True' || v === 'False';

/** The step for a numeric setting - a tenth for the 0..1 volumes, one
 *  otherwise. Enough to be useful without a text-entry field, which
 *  the port has only for gold amounts. */
function stepFor(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return (n <= 1 && String(raw).includes('.')) ? 0.1 : 1;
}

export class LauncherWindow {
  /** deps = { onLaunch() } - the boot flow continues when it fires. */
  constructor(deps = {}) {
    this.deps = deps;
    this.done = false;
    this.isChoiceWindow = true;      // raw codes through the overlay seam
    this.sections = Object.keys(DEFAULTS);
    this.sectionIndex = Math.max(0, this.sections.indexOf('Enhancements'));
    this.cursor = 0;
    this.scroll = 0;
    this.notice = null;
  }

  get section() { return this.sections[this.sectionIndex]; }
  get keys() { return Object.keys(DEFAULTS[this.section] ?? {}); }
  get key() { return this.keys[this.cursor] ?? null; }
  get fullKey() { return `${this.section}/${this.key}`; }

  _clamp() {
    const n = this.keys.length;
    if (this.cursor >= n) this.cursor = Math.max(0, n - 1);
    if (this.cursor < this.scroll) this.scroll = this.cursor;
    if (this.cursor >= this.scroll + ROWS) this.scroll = this.cursor - ROWS + 1;
  }

  /** Left/Right on the highlighted row. A setting the port cannot
   *  honour refuses WITH ITS REASON rather than moving silently. */
  _change(dir) {
    const key = this.key;
    if (!key) return;
    const full = this.fullKey;
    const tier = tierOf(full);
    if (tier === 'unavailable') {
      this.notice = UNAVAILABLE[full] ?? 'not available in this port';
      return;
    }
    const raw = effectiveSettings()[this.section][key];
    if (isBoolValue(raw)) {
      setValue(this.section, key, raw !== 'True');
      audio.playOneShot(SOUND.ButtonClick, 1);
    } else {
      const step = stepFor(raw);
      if (step === null) { this.notice = 'this setting is text - edit it in a later build'; return; }
      const next = Math.round((Number(raw) + dir * step) * 100) / 100;
      setValue(this.section, key, next < 0 ? 0 : next);
      audio.playOneShot(SOUND.ButtonClick, 1);
    }
    saveSettings();
    // AUDIT: turning ShowOptionsAtStart off hides this screen for good
    // - the port has no in-game route to settings (DFU reaches them
    // from DaggerfallPauseOptionsWindow; that is a routed Ledger row).
    // Say so at the moment of the choice rather than leaving the
    // player to discover it by never seeing the launcher again.
    if (full === 'GUI/ShowOptionsAtStart' && !getBool('GUI', 'ShowOptionsAtStart')) {
      this.notice = 'the launcher will not open again - reach it with ?launcher';
      return;
    }
    // a STORED setting changed nothing yet - say so once, here, rather
    // than letting the player wonder later
    if (tier === 'stored') this.notice = 'stored - no consumer in this port yet';
    else this.notice = null;
  }

  input(code, e = null) {
    const ch = (e?.key ?? (typeof code === 'string' && code.startsWith('char:') ? code.slice(5) : ''))
      .toString().toLowerCase();
    if (code === 'Escape' || code === 'Enter' || code === 'confirm' || code === 'back') {
      audio.playOneShot(SOUND.ButtonClick, 1);
      saveSettings();
      this.done = true;
      this.deps.onLaunch?.();
      return;
    }
    if (code === 'ArrowUp' || code === 'up') { this.cursor = Math.max(0, this.cursor - 1); this.notice = null; }
    else if (code === 'ArrowDown' || code === 'down') { this.cursor = Math.min(this.keys.length - 1, this.cursor + 1); this.notice = null; }
    else if (code === 'ArrowLeft' || code === 'left') this._change(-1);
    else if (code === 'ArrowRight' || code === 'right') this._change(+1);
    else if (ch === '[') { this.sectionIndex = (this.sectionIndex + this.sections.length - 1) % this.sections.length; this.cursor = 0; this.scroll = 0; this.notice = null; }
    else if (ch === ']') { this.sectionIndex = (this.sectionIndex + 1) % this.sections.length; this.cursor = 0; this.scroll = 0; this.notice = null; }
    else if (ch === 'r') { resetToDefaults(); this.notice = 'every setting back to DFU defaults'; audio.playOneShot(SOUND.ButtonClick, 1); }
    this._clamp();
  }

  /** The rows the current section shows, with everything the draw (and
   *  a test) needs. Exported shape so the pins can read the screen
   *  without a renderer. */
  rows() {
    this._clamp();
    const values = effectiveSettings()[this.section] ?? {};
    return this.keys.slice(this.scroll, this.scroll + ROWS).map((k, i) => {
      const full = `${this.section}/${k}`;
      const raw = values[k];
      return {
        key: k, value: raw, tier: tierOf(full),
        selected: this.scroll + i === this.cursor,
        changed: raw !== DEFAULTS[this.section][k],
      };
    });
  }

  /** AUDIT: the draw and the hit-test read ONE layout, because the
   *  launcher shipped keyboard-only and trapped every touch device -
   *  a second copy of these coordinates is how that gets rebuilt. All
   *  rects are screen-space at the draw's own scale. */
  layout(canvas, s = 2) {
    const x = 24 * s;
    const headY = 18 * s;
    const hintY = headY + 18 * s;
    const firstRowY = hintY + 16 * s;
    const rowH = 11 * s;
    const rows = this.rows().map((r, i) => ({
      ...r, index: this.scroll + i,
      rect: [x, firstRowY + i * rowH, Math.max(60 * s, canvas.width - x - 12 * s), rowH],
    }));
    // AUDIT: anchored to the CANVAS, not to fixed offsets. The first
    // cut put PLAY at x + 200*s, which on a phone's narrow canvas is
    // off the right edge - the button was drawn where no finger could
    // reach it, so the touch fix "worked" and the screen still
    // trapped. The value column is clamped for the same reason.
    const right = Math.max(x + 120 * s, canvas.width - 12 * s);
    return {
      x, headY, hintY, firstRowY, rowH, rows, right,
      valueRight: right,
      prevSection: [x, hintY - 2 * s, 12 * s, 12 * s],
      nextSection: [x + 16 * s, hintY - 2 * s, 12 * s, 12 * s],
      play: [right - 46 * s, hintY - 2 * s, 46 * s, 12 * s],
      noticeY: firstRowY + (ROWS + 1) * rowH,
    };
  }

  /** A tap/click in screen pixels. Tapping a row SELECTS it; tapping
   *  the row you already have selected CHANGES it (one finger, no
   *  modifier - the phone equivalent of Right); the three buttons do
   *  what their labels say. Returns true when the click was consumed. */
  clickAt(canvas, px, py, s = 2) {
    const L = this.layout(canvas, s);
    const inRect = ([rx, ry, rw, rh]) => px >= rx && py >= ry && px < rx + rw && py < ry + rh;
    if (inRect(L.play)) {
      audio.playOneShot(SOUND.ButtonClick, 1);
      saveSettings();
      this.done = true;
      this.deps.onLaunch?.();
      return true;
    }
    if (inRect(L.prevSection)) { this.sectionIndex = (this.sectionIndex + this.sections.length - 1) % this.sections.length; this.cursor = 0; this.scroll = 0; this.notice = null; return true; }
    if (inRect(L.nextSection)) { this.sectionIndex = (this.sectionIndex + 1) % this.sections.length; this.cursor = 0; this.scroll = 0; this.notice = null; return true; }
    for (const r of L.rows) {
      if (!inRect(r.rect)) continue;
      if (this.cursor === r.index) this._change(+1);
      else { this.cursor = r.index; this.notice = null; }
      return true;
    }
    return false;
  }

  draw(renderer, canvas, font, s = 2) {
    const L = this.layout(canvas, s);
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, PANEL);
    drawText(renderer, font, 'DAGGERFALL - SETTINGS', L.x, L.headY, s, HOT);
    // the three TAPPABLE controls, drawn where clickAt tests for them
    drawText(renderer, font, '<', L.prevSection[0] + 3 * s, L.hintY, s, HOT);
    drawText(renderer, font, '>', L.nextSection[0] + 3 * s, L.hintY, s, HOT);
    drawText(renderer, font, `[ ${this.section} ]`, L.x + 34 * s, L.hintY, s, TEXT);
    drawText(renderer, font, '[ PLAY ]', L.play[0], L.hintY, s, HOT);
    for (const row of L.rows) {
      const colour = row.selected ? HOT : (row.tier === 'unavailable' ? DIM : (row.tier === 'live' ? LIVE_C : TEXT));
      const mark = row.selected ? '>' : ' ';
      const flag = row.tier === 'live' ? '' : (row.tier === 'unavailable' ? '  (unavailable)' : '  (stored)');
      drawText(renderer, font, `${mark} ${row.key}${flag}`, L.x, row.rect[1], s, colour);
      const vx = L.valueRight - measureText(font.fnt, String(row.value)) * s;
      drawText(renderer, font, String(row.value) + (row.changed ? ' *' : ''), vx, row.rect[1], s, colour);
    }
    drawText(renderer, font, 'arrows / tap a row to change   R reset   Enter or PLAY to start',
      L.x, L.noticeY, s, DIM);
    if (this.notice) drawText(renderer, font, this.notice, L.x, L.noticeY + 11 * s, s, HOT);
  }
}
