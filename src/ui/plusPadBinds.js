// PADPLUS10 (2026-09-26): THE CONTROLLER BINDINGS WINDOW - Enhanced Plus only.
//
// The player: "add the possibility to bind your controller buttons in a separate menu, Enhanced Plus UI only. Holding
// d-pad left should also be the mount/cart/foot selection (T) ... make the left and right stick sensitivity
// adjustable ... change between grab, info, etc. mode by holding d-pad up - hold, the mode changes, release; hold
// again, the next mode."
//
// One stone window over the pause menu, opened from the Enhanced Plus card (ui/enhancedMenu.js). Three parts:
//   1. BUTTONS - an action per row and the pad button it is on. Click the row (mouse, or the pad cursor and A),
//      press any face button, shoulder, trigger, stick click, View or Menu: that is the binding. A button another
//      row holds is SWAPPED, never doubled, so no action is ever left on two things or silently lost. The rows are
//      the ordinary bindings store (the secondary dict and the joystick-UI dict), so the classic Controls grid shows
//      the same answer. The d-pad is set in part 2; LB/RB are the crossbar's while it is in force.
//   2. D-PAD - every direction has a TAP and a HOLD (ui/plusPad.js plusDpadMap). Defaults: up = swap hands / next
//      interaction mode, down = map / travel map, left = quest log / transport, right = rest / -.
//   3. STICKS - the left and right stick's sensitivity (ui/plusPad.js plusStickSens).
// Everything here is buttons (no sliders, no drop-downs), so the pad's own cursor and d-pad jumps can drive all of it.
import {
  setBinding, getBinding, clearBinding, getJoystickUIBinding, setJoystickUIBinding, addRemovedSecondaryAction, isPadCode, saveKeyBinds,
} from '../systems/inputActions.js';
import { bindings } from './input.js';
import {
  resetPlusPadLayout, crossbarInForce, CROSSBAR_HOLD, DPAD_CODES, DPAD_CHOICES, dpadChoiceWord, plusDpadMap, setPlusDpad, resetPlusDpad,
  plusStickSens, setPlusStickSens, STICK_SENS_MIN, STICK_SENS_MAX, setPlusBindCapture, setPlusBindsOpen,
} from './plusPad.js';
import { hdGlyphSvg, hdGlyphName } from './padGlyphsHD.js';
import { padFamily } from './padGlyphs.js';
import { PIXEL_STACK } from './pixelifyFive.js';

/** The rebindable rows. `sec` is the secondary-dict action, `ui` the joystick-UI action; a row with both keeps them
 *  on one button (B: the pack in the world, Back in a window). `keep` rows cannot be left unbound. */
export const PLUS_BIND_ROWS = Object.freeze([
  { id: 'activate', label: 'Activate · Select', ui: 'LeftClick', keep: true },
  { id: 'attack', label: 'Attack', ui: 'RightClick', keep: true },
  { id: 'inventory', label: 'Inventory · Back', sec: 'Inventory', ui: 'Back', keep: true },
  { id: 'jump', label: 'Jump', sec: 'Jump' },
  { id: 'weapon', label: 'Draw / sheathe', sec: 'ReadyWeapon' },
  { id: 'spellbook', label: 'Spellbook', sec: 'CastSpell' },
  { id: 'recast', label: 'Recast spell', sec: 'RecastSpell' },
  { id: 'pause', label: 'Pause', sec: 'Escape', keep: true },
  { id: 'run', label: 'Run', sec: 'Run' },
  { id: 'crouch', label: 'Crouch', sec: 'Crouch' },
  { id: 'transport', label: 'Transport', sec: 'Transport' },
  { id: 'charsheet', label: 'Character sheet', sec: 'CharacterSheet' },
]);

/** The pad button a row is on, or null. */
export function rowCode(store, row) {
  if (row.ui) return getJoystickUIBinding(store, row.ui);
  const c = getBinding(store, row.sec, false);
  return c && isPadCode(c) ? c : null;
}

/** Can a captured code be bound here: a button (not the d-pad, not a stick's lean), or a trigger. LB/RB only while
 *  the crossbar is not holding them. Answers null when it can, else the reason in words. */
export function bindRefusal(code, { crossbar = crossbarInForce() } = {}) {
  if (typeof code !== 'string') return 'not a controller button';
  if (code === 'JoystickAxis9Button0' || code === 'JoystickAxis10Button0') return null;   // LT, RT
  if (Object.values(DPAD_CODES).includes(code)) return 'the d-pad is set below, under D-pad';
  if (/^JoystickAxis\d+Button[01]$/.test(code)) return 'a stick is not a button';
  if (!/^JoystickButton\d+$/.test(code)) return 'not a controller button';
  if (crossbar && CROSSBAR_HOLD.includes(code)) return 'LB and RB hold the crossbar (turn it off on the Plus card to use them)';
  return null;
}

function writeRow(store, row, code) {
  if (row.sec) {
    if (code) setBinding(store, code, row.sec, false);
    else { clearBinding(store, row.sec, false); addRemovedSecondaryAction(store, row.sec); }   // cleared stays cleared - no autofill
  }
  if (row.ui && code) setJoystickUIBinding(store, code, row.ui);
}

/**
 * Put `row` on `code`. The row that held `code` gets this row's old button (a SWAP), or is cleared when this row
 * had none - and a `keep` row is never cleared: then the bind is refused. Answers { ok, swapped?, reason? }.
 */
export function bindPlusRow(store, rowId, code, { save = saveKeyBinds } = {}) {
  const row = PLUS_BIND_ROWS.find((r) => r.id === rowId);
  if (!row || !store) return { ok: false, reason: 'no such row' };
  const old = rowCode(store, row);
  if (old === code) return { ok: true };
  const other = PLUS_BIND_ROWS.find((r) => r !== row && rowCode(store, r) === code) ?? null;
  if (other && !old && other.keep) return { ok: false, reason: `${other.label} needs that button - give it another first` };
  if (other) writeRow(store, other, old);
  // an action outside these rows on that button (the player's own grid binding) gives it up, as a grid bind would
  writeRow(store, row, code);
  store.rev = (store.rev ?? 0) + 1;
  try { save(store); } catch { /* the bind stands for this session */ }
  return { ok: true, swapped: other ? other.label : null };
}

/** Clear a row (not a `keep` row). */
export function clearPlusRow(store, rowId, { save = saveKeyBinds } = {}) {
  const row = PLUS_BIND_ROWS.find((r) => r.id === rowId);
  if (!row || row.keep || !store) return false;
  writeRow(store, row, null);
  store.rev = (store.rev ?? 0) + 1;
  try { save(store); } catch { /* ignore */ }
  return true;
}

/** The layout at a glance for the Plus card's legend: what is on each button now. */
export function plusPadLegend(store) {
  const out = [[['StickL'], 'Move'], [['StickR'], 'Look']];
  if (store) for (const row of PLUS_BIND_ROWS) { const c = rowCode(store, row); if (c) out.push([[c], row.label]); }
  out.push([CROSSBAR_HOLD.slice(), 'Hold: crossbar']);
  const dp = plusDpadMap();
  for (const [dir, code] of Object.entries(DPAD_CODES)) {
    const { tap, hold } = dp[dir];
    const words = [tap ? dpadChoiceWord(tap) : null, hold ? `hold: ${dpadChoiceWord(hold)}` : null].filter(Boolean).join(' · ');
    if (words) out.push([[code], words]);
  }
  return out;
}

// ── the window ──────────────────────────────────────────────────────

const HOST_ID = 'enhanced-padbinds';   // `enhanced-` - the poller counts it as a window (gamepadInput.js domWindowUp)
const CSS = `
.pbind { position: fixed; inset: 0; z-index: 39; display: flex; align-items: center; justify-content: center; padding: 12px;
  background: rgba(0,0,0,0.45); font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none; color: #e6dec6; }
.pbind > .card { width: min(640px, 96vw); max-height: 92vh; overflow: auto; margin: 0; padding: 14px 16px 12px;
  border: 2px solid #7d7460; background: #15181e; display: flex; flex-direction: column; gap: 10px; }
.pbind h2 { margin: 0; text-align: center; font-size: 18px; font-weight: normal; color: #efe8d6; letter-spacing: 0.06em; }
.pbind h3 { margin: 4px 0 0; font-size: 12px; font-weight: normal; letter-spacing: 0.14em; text-transform: uppercase; color: #c08a3e; }
.pbind .pb-note { margin: 0; font-size: 12px; color: #a89f88; min-height: 1.2em; text-align: center; }
.pbind .pb-note.warn { color: #f3cf86; }
.pbind .pb-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 10px; }
@media (max-width: 560px) { .pbind .pb-grid { grid-template-columns: minmax(0, 1fr); } }
.pbind .pb-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.pbind .pb-row > .pb-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.pbind .act { font: inherit; font-size: 13px; padding: 4px 8px; min-height: 30px; cursor: pointer; color: #e6dec6;
  background: #262a31; border: 2px solid #5a5446; }
.pbind .pb-key { display: inline-flex; align-items: center; gap: 6px; min-width: 112px; justify-content: flex-start; }
.pbind .pb-key img { width: 22px; height: 22px; flex: 0 0 auto; }
.pbind .pb-key.armed { border-color: #f3cf86; color: #f3cf86; }
.pbind .pb-x { min-width: 30px; padding: 4px 6px; }
.pbind .pb-dir { display: grid; grid-template-columns: 70px minmax(0, 1fr) minmax(0, 1fr); gap: 4px 8px; align-items: center; }
.pbind .pb-dir > .pb-label { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.pbind .pb-dir > .pb-label img { width: 22px; height: 22px; }
.pbind .pb-pick { display: flex; align-items: center; gap: 4px; min-width: 0; }
.pbind .pb-pick > span { flex: 1 1 auto; min-width: 0; text-align: center; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pbind .pb-pick .act { min-width: 30px; padding: 2px 6px; }
.pbind .pb-head { font-size: 11px; color: #a89f88; text-align: center; letter-spacing: 0.1em; text-transform: uppercase; }
.pbind .pb-stick { display: grid; grid-template-columns: minmax(0, 1fr) auto 64px auto; gap: 6px; align-items: center; }
.pbind .pb-stick > .pb-val { text-align: center; font-size: 15px; color: #f3cf86; }
.pbind .pb-stick small { display: block; font-size: 11px; color: #a89f88; }
.pbind .pb-foot { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
`;

let host = null, armedRow = null, note = '', noteWarn = false, onKeyDown = null, onKeyUp = null, releaseCode = null, releaseTimer = null, armTimer = null;

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const btn = (cls, text, on) => { const b = el('button', `act ${cls ?? ''}`.trim(), text); b.type = 'button'; b.onclick = (e) => { e.stopPropagation(); on(); }; return b; };
const glyph = (code, size = 36) => { const im = el('img'); im.src = hdGlyphSvg(padFamily() ?? 'xbox', code, { size }) ?? ''; im.alt = hdGlyphName(padFamily() ?? 'xbox', code) ?? code; return im; };

export const plusPadBindsOpenNow = () => !!host;

export function openPlusPadBinds() {
  if (host || typeof document === 'undefined') return;
  if (!document.getElementById('pbind-style')) { const st = el('style'); st.id = 'pbind-style'; st.textContent = CSS; document.head.append(st); }
  host = el('div', 'pbind');
  host.id = HOST_ID;
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-label', 'Controller bindings');
  host.addEventListener('mousedown', (e) => { if (e.target === host) closePlusPadBinds(); });
  document.body.append(host);
  setPlusBindsOpen(true);
  onKeyDown = (e) => {
    const code = e.code || e.key;
    if (armedRow) {
      if (code === 'Escape' && !isPadCode(code)) { e.preventDefault(); e.stopImmediatePropagation(); disarm('Cancelled.'); return; }
      if (!isPadCode(code)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (/^JoystickAxis(1|2|3|4|5)Button[01]$/.test(code)) return;   // a stick leaning while you reach for a button
      const why = bindRefusal(code);
      if (why) { note = `That one cannot be bound here: ${why}.`; noteWarn = true; render(); return; }
      const row = armedRow;
      const r = bindPlusRow(bindings(), row, code);
      holdUntilRelease(code);
      armedRow = null;
      clearTimeout(armTimer);
      note = r.ok ? (r.swapped ? `Bound. ${r.swapped} took the old button.` : 'Bound.') : `Not bound: ${r.reason}.`;
      noteWarn = !r.ok;
      render();
      return;
    }
    if (releaseCode && isPadCode(code)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (code === 'Escape' || e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closePlusPadBinds(); }
  };
  onKeyUp = (e) => {
    if (releaseCode && (e.code || e.key) === releaseCode) { e.stopImmediatePropagation(); endHold(); }
  };
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);
  note = 'Choose a row, then press the controller button for it.'; noteWarn = false;
  render();
}

export function closePlusPadBinds() {
  if (!host) return;
  armedRow = null; clearTimeout(armTimer);
  endHold();
  document.removeEventListener('keydown', onKeyDown, true);
  document.removeEventListener('keyup', onKeyUp, true);
  host.remove(); host = null;
  setPlusBindsOpen(false);
  setPlusBindCapture(false);
  try { globalThis.dispatchEvent?.(new globalThis.Event('plus-padbinds-closed')); } catch { /* ignore */ }
}

function arm(rowId) {
  armedRow = rowId;
  setPlusBindCapture(true);
  clearTimeout(armTimer);
  armTimer = setTimeout(() => { if (armedRow) disarm('No button pressed.'); }, 8000);
  note = 'Press a controller button now (Escape on the keyboard cancels).'; noteWarn = false;
  render();
}
function disarm(msg) {
  armedRow = null; clearTimeout(armTimer);
  if (!releaseCode) setPlusBindCapture(false);
  note = msg; noteWarn = false;
  render();
}
/** The button just bound is still under the thumb: it stays only its own code until it is let go, so the B that was
 *  bound is not also read as Back a frame later and closes the window. */
function holdUntilRelease(code) {
  releaseCode = code;
  setPlusBindCapture(true);
  clearTimeout(releaseTimer);
  releaseTimer = setTimeout(endHold, 1500);
}
function endHold() {
  releaseCode = null; clearTimeout(releaseTimer);
  if (!armedRow) setPlusBindCapture(false);
}

function render() {
  if (!host) return;
  const store = bindings();
  const card = el('div', 'card');
  card.append(el('h2', null, 'Controller bindings'));
  card.append(Object.assign(el('p', `pb-note${noteWarn ? ' warn' : ''}`, note), { role: 'status' }));
  // 1. buttons
  card.append(el('h3', null, 'Buttons'));
  const grid = el('div', 'pb-grid');
  for (const row of PLUS_BIND_ROWS) {
    const r = el('div', 'pb-row');
    r.append(el('span', 'pb-label', row.label));
    const code = rowCode(store, row);
    const armed = armedRow === row.id;
    const k = btn(`pb-key${armed ? ' armed' : ''}`, '', () => (armed ? disarm('Cancelled.') : arm(row.id)));
    if (armed) k.textContent = 'Press a button…';
    else if (code) { k.append(glyph(code), el('span', null, hdGlyphName(padFamily() ?? 'xbox', code) ?? code)); }
    else k.textContent = '— (unbound)';
    k.title = `Bind ${row.label}`;
    r.append(k);
    if (!row.keep) {
      const x = btn('pb-x', '\u2715', () => { clearPlusRow(store, row.id); note = `${row.label} unbound.`; noteWarn = false; render(); });
      x.title = `Unbind ${row.label}`;
      x.disabled = !code;
      r.append(x);
    }
    grid.append(r);
  }
  card.append(grid);
  // 2. d-pad
  card.append(el('h3', null, 'D-pad (with the crossbar on)'));
  const dirs = el('div', 'pb-dir');
  dirs.append(el('span'), el('span', 'pb-head', 'Tap'), el('span', 'pb-head', 'Hold'));
  const dp = plusDpadMap();
  const words = { up: 'Up', down: 'Down', left: 'Left', right: 'Right' };
  for (const [dir, code] of Object.entries(DPAD_CODES)) {
    const lab = el('span', 'pb-label');
    lab.append(glyph(code), el('span', null, words[dir]));
    dirs.append(lab, picker(dir, 'tap', dp[dir].tap), picker(dir, 'hold', dp[dir].hold));
  }
  card.append(dirs);
  // 3. sticks
  card.append(el('h3', null, 'Sticks'));
  card.append(stickRow('left', 'Left stick', 'Movement lean and menu cursor speed'));
  card.append(stickRow('right', 'Right stick', 'Look speed and menu scrolling'));
  // foot
  const foot = el('div', 'pb-foot');
  foot.append(btn('', 'Reset to Plus defaults', () => {
    resetPlusPadLayout(store); resetPlusDpad(); setPlusStickSens('left', 1); setPlusStickSens('right', 1);
    note = 'The Enhanced Plus layout is back.'; noteWarn = false; render();
  }));
  foot.append(btn('primary', 'Close', closePlusPadBinds));
  card.append(foot);
  host.replaceChildren(card);
}

function picker(dir, which, now) {
  const wrap = el('div', 'pb-pick');
  const at = Math.max(0, DPAD_CHOICES.findIndex(([v]) => v === (now ?? null)));
  const step = (d) => { const next = DPAD_CHOICES[(at + d + DPAD_CHOICES.length) % DPAD_CHOICES.length][0]; setPlusDpad(dir, which, next); render(); };
  const prev = btn('', '\u2039', () => step(-1)); prev.title = 'Previous';
  const next = btn('', '\u203a', () => step(1)); next.title = 'Next';
  wrap.append(prev, el('span', null, dpadChoiceWord(now)), next);
  return wrap;
}

function stickRow(side, label, hint) {
  const r = el('div', 'pb-stick');
  const lab = el('span', null, label);
  lab.append(el('small', null, hint));
  const v = plusStickSens(side);
  const set = (x) => { setPlusStickSens(side, Math.round(x * 4) / 4); render(); };
  const minus = btn('', '\u2212', () => set(v - 0.25)); minus.disabled = v <= STICK_SENS_MIN;
  const plus = btn('', '+', () => set(v + 0.25)); plus.disabled = v >= STICK_SENS_MAX;
  r.append(lab, minus, el('span', 'pb-val', `${v.toFixed(2)}\u00d7`), plus);
  return r;
}
