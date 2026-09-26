// PADPLUS1 (2026-09-25): THE CONTROLLER, MADE FOR ENHANCED PLUS.
//
// The report: "chrome detects it as 360xbox controller which is fine but i jump with r1 open the spellbook with l2
// and all that i cant even use the crossbar ... controller prompts are needed in the enhanced UI plus like r1 and l1
// for changing tabs ... (toggle run on left stick too is needed) make it intuitive ... ENHANCED PLUS UI only".
//
// Everything here answers only while systems/uiSkin.js isEnhancedPlus() does; plain Enhanced and Classic run the
// PAD1 layer exactly as before. The poller (ui/gamepadInput.js) asks this module; nothing here reads the Gamepad API.
//
//   1. THE LAYOUT (PLUS_PAD_LAYOUT). PAD1's rows put jump on RB, the spellbook on LT and a second swing on Y. Plus
//      moves them to where an action-RPG thumb expects them, ONCE, and only rows that still hold PAD1's own
//      default - a pad button the player bound themselves is never touched. It is written into the ordinary
//      secondary dict, so the controls grid shows it and can rebind every row of it.
//   2. THE CROSSBAR BUS. The hotbar (ui/enhancedHotbar.js) owns the picture and the slots; the poller owns the
//      buttons. They meet here, through a registered object, so neither imports the other.
//   3. THE MENUS. The pad cursor clicks the DOM windows (the old cursor clicked the CANVAS under them, so no
//      enhanced window ever heard it), LB/RB turn tabs, the d-pad jumps between buttons, the right stick scrolls.
//   4. THE PROMPT BAR - the pad's own glyphs (padGlyphsHD.js) for what the buttons do right now.
import {
  DEFAULT_SECONDARY_BINDINGS, setBinding, dropBinding, getBinding, getJoystickUIBinding, setJoystickUIBinding,
  addRemovedSecondaryAction, isPadCode, saveKeyBinds,
} from '../systems/inputActions.js';
import { isEnhancedPlus } from '../systems/uiSkin.js';
import { getPref, setPref } from '../systems/uiPrefs.js';
import { hdGlyphSvg, hdGlyphName } from './padGlyphsHD.js';

/** Is the Plus controller layer in force - never throws (a node harness has no location). */
export function plusPadActive() {
  try { return isEnhancedPlus(); } catch { return false; }
}

// ── 1. THE LAYOUT ───────────────────────────────────────────────────

/** Bumped when the layout below changes, so the one-time move runs again for rows still on the old default. */
export const PLUS_PAD_LAYOUT_VERSION = 1;

/** The Plus rows, secondary dict. LB and RB are left FREE: holding one is the crossbar. RT is the attack through the
 *  joystick-UI RightClick (the drag-swing arm), so it holds no secondary row of its own. */
export const PLUS_PAD_LAYOUT = Object.freeze([
  ['JoystickButton3', 'Jump'],               // Y
  ['JoystickButton2', 'ReadyWeapon'],        // X - draw / sheathe
  ['JoystickButton1', 'Inventory'],          // B - in the world; in a window B is Back
  ['JoystickButton6', 'CastSpell'],          // View - the spellbook
  ['JoystickButton7', 'Escape'],             // Menu - pause
  ['JoystickButton8', 'Run'],                // L3 - toggled by the poller (plusToggleRun)
  ['JoystickButton9', 'Crouch'],             // R3
  ['JoystickAxis9Button0', 'RecastSpell'],   // LT - cast the last spell again
  ['JoystickAxis7Button0', 'QuickUse1'],     // d-pad: the diamond / crossbar-left's d-pad, as PAD1
  ['JoystickAxis7Button1', 'QuickUse2'],
  ['JoystickAxis6Button1', 'QuickSpell'],
  ['JoystickAxis6Button0', 'QuickOffHand'],
]);
/** The joystick-UI dict under Plus: A clicks, RT attacks (Mouse1, and the swing's drag), B is Back. MiddleClick
 *  (autorun) is parked on a button a standard pad never reports, because the autofill puts an EMPTY UI action back
 *  on its DFU default (X) at the next load, and X is Ready Weapon now. */
export const PLUS_PAD_UI = Object.freeze([
  ['JoystickButton0', 'LeftClick'], ['JoystickAxis10Button0', 'RightClick'], ['JoystickButton19', 'MiddleClick'], ['JoystickButton1', 'Back'],
]);
const PAD1_UI = Object.freeze({ LeftClick: 'JoystickButton0', RightClick: 'JoystickButton3', MiddleClick: 'JoystickButton2', Back: 'JoystickButton1' });

/**
 * Move a bindings store to the Plus layout. Without `force` only PAD1's untouched defaults move - a row the player
 * set themselves stands, and a Plus row whose button the player already spent is skipped. With `force` (the "Reset
 * controller layout" button) every Plus row is written. Answers the rows it changed.
 */
export function applyPlusPadLayout(store, { force = false } = {}) {
  const changed = [];
  if (!store?.secondary) return changed;
  // let go of PAD1's own rows where they still stand
  for (const [code, action] of DEFAULT_SECONDARY_BINDINGS) {
    if (store.secondary.get(code) === action) { dropBinding(store, code, action, false); changed.push(`${action} off ${code}`); }
  }
  if (force) {
    for (const [, action] of PLUS_PAD_LAYOUT) {
      const had = getBinding(store, action, false);
      if (had && isPadCode(had)) dropBinding(store, had, action, false);
    }
  }
  for (const [code, action] of PLUS_PAD_LAYOUT) {
    if (!force) {
      if (store.secondary.has(code)) continue;                      // the player's own row on that button
      const mine = getBinding(store, action, false);
      if (mine && isPadCode(mine)) continue;                        // the player gave this action a button already
    }
    setBinding(store, code, action, false);
    changed.push(`${action} on ${code}`);
  }
  // the swing lives on RT through the UI dict: its PAD1 secondary must not be autofilled back
  if (store.secondary.get('JoystickAxis10Button0') === 'SwingWeapon') dropBinding(store, 'JoystickAxis10Button0', 'SwingWeapon', false);
  if (!getBinding(store, 'SwingWeapon', false)) addRemovedSecondaryAction(store, 'SwingWeapon');
  for (const [code, ui] of PLUS_PAD_UI) {
    const now = getJoystickUIBinding(store, ui);
    if (force || now == null || now === PAD1_UI[ui]) { if (now !== code) { setJoystickUIBinding(store, code, ui); changed.push(`${ui} on ${code}`); } }
  }
  store.rev = (store.rev ?? 0) + 1;
  return changed;
}

/** The one-time move, stamped on the prefs shelf. Answers true when it wrote. */
export function ensurePlusPadLayout(store, { save = saveKeyBinds } = {}) {
  if ((Number(getPref('plusPadLayout')) || 0) >= PLUS_PAD_LAYOUT_VERSION) return false;
  const changed = applyPlusPadLayout(store);
  setPref('plusPadLayout', PLUS_PAD_LAYOUT_VERSION);
  if (changed.length) { console.info(`[plusPad] controller layout: ${changed.join(', ')}`); try { save(store); } catch { /* the move stands for this session */ } }
  return true;
}

/** The Overhauls card's button: every Plus row, now. */
export function resetPlusPadLayout(store, { save = saveKeyBinds } = {}) {
  const changed = applyPlusPadLayout(store, { force: true });
  setPref('plusPadLayout', PLUS_PAD_LAYOUT_VERSION);
  try { save(store); } catch { /* ignore */ }
  return changed;
}

// ── prefs ───────────────────────────────────────────────────────────
/** 'auto' (a pad is connected), 'on' or 'off'. */
export const plusCrossbarMode = () => { const v = getPref('plusCrossbar'); return v === 'on' || v === 'off' ? v : 'auto'; };
export const plusToggleRun = () => getPref('plusToggleRun') !== false;

// ── 2. THE CROSSBAR ─────────────────────────────────────────────────

export const CROSSBAR_SIZE = 16;
export const CROSSBAR_SET = 8;
/** Pad code -> position in a set. The d-pad's four keep PAD1's order (up, down, left, right = the hotbar's slots
 *  1-4), so a d-pad press with no bumper held still presses what the left set's d-pad shows. */
export const CROSSBAR_POS = Object.freeze({
  JoystickAxis7Button0: 0, JoystickAxis7Button1: 1, JoystickAxis6Button1: 2, JoystickAxis6Button0: 3,
  JoystickButton3: 4, JoystickButton1: 5, JoystickButton0: 6, JoystickButton2: 7,
});
export const CROSSBAR_CODES = Object.freeze(Object.keys(CROSSBAR_POS));
/** The code that presses slot i of the crossbar (without its bumper). */
export const crossbarCodeOf = (i) => CROSSBAR_CODES.find((c) => CROSSBAR_POS[c] === i % CROSSBAR_SET) ?? null;
export const crossbarSlot = (set, code) => (CROSSBAR_POS[code] === undefined ? -1 : set * CROSSBAR_SET + CROSSBAR_POS[code]);
export const CROSSBAR_HOLD = Object.freeze(['JoystickButton4', 'JoystickButton5']);   // LB, RB
/** PADPLUS3: THE D-PAD ALONE, while the crossbar is in force. It pressed the left set's d-pad slots (the diamond's
 *  four actions reach hotbar slots 1-4), so a slot fired with no bumper held - the report: "activates the input on
 *  the crossbar without L1 being held". The crossbar is LB/RB + a button, only; the bare d-pad is four things a pad
 *  had no button for. */
export const PLUS_DPAD_ACTIONS = Object.freeze({
  JoystickAxis7Button0: 'SwitchHand',       // up: swap hands
  JoystickAxis7Button1: 'AutoMap',          // down: map
  JoystickAxis6Button1: 'LogBook',          // left: quest log
  JoystickAxis6Button0: 'Rest',             // right: rest (PADPLUS8 - was the character sheet)
});

// ── PADPLUS10: THE D-PAD'S TAP AND HOLD, AND THE PLAYER'S OWN ────────
//
// PADPLUS9 gave d-pad down two meanings (tap = map, hold = travel map). The player asked for the same on the other
// directions - hold LEFT for the Transport picker (T: foot / horse / cart / ship), hold UP to step to the next
// interaction mode (Steal > Grab > Info > Talk, the F1-F4 modes; every hold is one step, released to choose) - and
// to set them themselves in the Controller bindings window (ui/plusPadBinds.js). So every direction has a TAP and a
// HOLD, kept on the prefs shelf as `plusDpad`. A direction with a hold fires its tap on the RELEASE (a hold may
// still become the other thing); one with no hold fires on the press, as the bare d-pad always did.

/** The pad codes of the four directions, in the windows' order. */
export const DPAD_CODES = Object.freeze({ up: 'JoystickAxis7Button0', down: 'JoystickAxis7Button1', left: 'JoystickAxis6Button1', right: 'JoystickAxis6Button0' });
/** 'NextMode' is no registry action: it presses the key of the mode after the current one (NextInteractionMode). */
export const NEXT_MODE = 'NextMode';
export const PLUS_DPAD_DEFAULTS = Object.freeze({
  up: Object.freeze({ tap: 'SwitchHand', hold: NEXT_MODE }),
  down: Object.freeze({ tap: 'AutoMap', hold: 'TravelMap' }),
  left: Object.freeze({ tap: 'LogBook', hold: 'Transport' }),
  right: Object.freeze({ tap: 'Rest', hold: null }),
});
/** What a d-pad slot may hold - the words the bindings window shows. null is "nothing". */
export const DPAD_CHOICES = Object.freeze([
  [null, '\u2014'], ['SwitchHand', 'Swap hands'], [NEXT_MODE, 'Next mode (Steal/Grab/Info/Talk)'], ['AutoMap', 'Map'],
  ['TravelMap', 'Travel map'], ['LogBook', 'Quest log'], ['Transport', 'Transport'], ['Rest', 'Rest'],
  ['CharacterSheet', 'Character sheet'], ['CastSpell', 'Spellbook'], ['RecastSpell', 'Recast spell'], ['Inventory', 'Inventory'],
  ['StealMode', 'Steal mode'], ['GrabMode', 'Grab mode'], ['InfoMode', 'Info mode'], ['TalkMode', 'Talk mode'],
  ['Jump', 'Jump'], ['Crouch', 'Crouch'], ['ReadyWeapon', 'Draw / sheathe'],
]);
export const dpadChoiceWord = (a) => DPAD_CHOICES.find(([v]) => v === (a ?? null))?.[1] ?? String(a);
const DPAD_ACTION_OK = new Set(DPAD_CHOICES.map(([v]) => v));
/** The player's d-pad, whole: every direction's { tap, hold }, the defaults under anything unset or unknown. */
export function plusDpadMap() {
  let stored = null;
  try { stored = getPref('plusDpad'); } catch { stored = null; }
  const out = {};
  for (const [dir, def] of Object.entries(PLUS_DPAD_DEFAULTS)) {
    const mine = stored && typeof stored === 'object' ? stored[dir] : null;
    const pick = (k) => (mine && Object.hasOwn(mine, k) && DPAD_ACTION_OK.has(mine[k] ?? null) ? (mine[k] ?? null) : def[k]);
    out[dir] = { tap: pick('tap'), hold: pick('hold') };
  }
  return out;
}
/** The same, keyed by pad code (the poller's view). */
export function plusDpadByCode() {
  const m = plusDpadMap(), out = {};
  for (const [dir, code] of Object.entries(DPAD_CODES)) out[code] = m[dir];
  return out;
}
export function setPlusDpad(dir, which, action) {
  if (!Object.hasOwn(PLUS_DPAD_DEFAULTS, dir) || (which !== 'tap' && which !== 'hold') || !DPAD_ACTION_OK.has(action ?? null)) return false;
  const m = plusDpadMap();
  m[dir] = { ...m[dir], [which]: action ?? null };
  return setPref('plusDpad', m);
}
export const resetPlusDpad = () => setPref('plusDpad', null);

// ── PADPLUS10: THE STICKS' SENSITIVITY ──────────────────────────────
// Two multipliers on the Plus shelf, over DFU's own JoystickLook/CursorSensitivity (which stay the Controls pane's):
// the LEFT stick's scales how far it must lean for a full walk/run and how fast it moves the menu cursor; the
// RIGHT stick's scales the look and the menu scroll.
export const STICK_SENS_MIN = 0.25, STICK_SENS_MAX = 2.5;
const clampSens = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.min(STICK_SENS_MAX, Math.max(STICK_SENS_MIN, n)) : 1; };
export const plusStickSens = (side) => { try { return clampSens(getPref(side === 'right' ? 'plusStickRight' : 'plusStickLeft')); } catch { return 1; } };
export const setPlusStickSens = (side, v) => setPref(side === 'right' ? 'plusStickRight' : 'plusStickLeft', clampSens(v));
/** Lean a stick further: the vector scaled by k, its length held to 1 (a full lean stays a full lean). */
export function scaleStick(x, y, k) {
  if (k === 1) return [x, y];
  let sx = x * k, sy = y * k;
  const m = Math.hypot(sx, sy);
  if (m > 1) { sx /= m; sy /= m; }
  return [sx, sy];
}

// ── PADPLUS10: THE BINDINGS WINDOW'S CAPTURE ────────────────────────
// While the window waits for a button, the poller lets every pad press through as its own code (no Back, no click,
// no menu jump), so B or A can be bound like any other.
let _bindCapture = false;
export const plusBindCapturing = () => _bindCapture;
export function setPlusBindCapture(on) { _bindCapture = !!on; }
let _bindsOpen = false;
export const plusBindsOpen = () => _bindsOpen;
export function setPlusBindsOpen(on) { _bindsOpen = !!on; }

/** PADPLUS5: THE QUICK ACT - X over an item in the pack wears it, takes it off, lights it or uses it. The pack
 *  registers { act(target) -> bool, available() -> bool }; the poller presses it, the prompt bar asks if it is up. */
let _quick = null;
export function registerQuickAct(api) { _quick = api ?? null; }
export const quickActApi = () => _quick;

/** PADPLUS6: the d-pad while the quick-loot plaque lists something - up/down move the highlight (the mouse wheel's
 *  job), right takes everything, left opens the container (their registry actions, pressed by their own keys). */
export const LOOT_DPAD = Object.freeze({
  JoystickAxis7Button0: 'up', JoystickAxis7Button1: 'down',
  JoystickAxis6Button0: 'QuickLootAll', JoystickAxis6Button1: 'QuickLootOpen',
});
/** The prompt rows while looting. */
export function lootPrompts({ take = 'JoystickButton0' } = {}) {
  return [[['JoystickAxis7Button0', 'JoystickAxis7Button1'], 'Choose'], [[take], 'Take'],
    [['JoystickAxis6Button0'], 'Take all'], [['JoystickAxis6Button1'], 'Open']];
}

let _xb = null;
/** The hotbar registers { inForce(), press(slot), setActive(set|null) }. */
export function registerCrossbar(api) { _xb = api ?? null; }
export const crossbarApi = () => _xb;
export function crossbarInForce() { try { return !!_xb?.inForce?.(); } catch { return false; } }

// ── 3. THE MENUS ────────────────────────────────────────────────────

const doc = () => globalThis.document ?? null;
const visible = (n) => !!n && n.isConnected !== false && typeof n.getClientRects === 'function' && n.getClientRects().length > 0
  && (globalThis.getComputedStyle?.(n)?.visibility ?? 'visible') !== 'hidden';

/** The tab strips a bumper turns, first match wins: the pack's and the shop's category tabs, the pause window's
 *  tabs, any ARIA tablist, then the menu's section rail. `on` reads which one is lit. */
export const TAB_GROUPS = Object.freeze([
  ['.packtabs', '.packtab'],
  ['.px-tabs', 'button'],
  ['[role="tablist"]', '[role="tab"]'],
  ['nav.rail', '.railbtn'],
]);
const isOn = (b) => b.classList?.contains('on') || b.getAttribute?.('aria-selected') === 'true' || b.getAttribute?.('aria-pressed') === 'true';

/** The visible tab strip, as its buttons, or null. */
export function activeTabStrip(d = doc()) {
  if (!d?.querySelectorAll) return null;
  for (const [strip, tab] of TAB_GROUPS) {
    for (const s of d.querySelectorAll(strip)) {
      if (!visible(s)) continue;
      const tabs = [...s.querySelectorAll(tab)].filter((b) => visible(b) && !b.disabled);
      if (tabs.length > 1) return tabs;
    }
  }
  return null;
}
/** Turn the strip one tab (dir -1 / +1). Answers the tab clicked, or null. */
export function cycleTab(dir, d = doc()) {
  const tabs = activeTabStrip(d);
  if (!tabs) return null;
  const at = Math.max(0, tabs.findIndex(isOn));
  const next = tabs[(at + dir + tabs.length) % tabs.length];
  next?.click?.();
  return next ?? null;
}

const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="option"], [role="menuitem"], [role="checkbox"], [role="switch"], [tabindex]:not([tabindex="-1"]), .itemrow, .hb-slot, .px-qrow';
/** The control a point is over (the element itself or its interactive ancestor), or null. */
export function interactiveAt(x, y, d = doc()) {
  const n = d?.elementFromPoint?.(x, y);
  return n?.closest?.(INTERACTIVE) ?? null;
}

/**
 * THE D-PAD IN A WINDOW: the nearest control in a direction from the cursor. Every visible, uncovered control is a
 * candidate; one behind the direction is out; the score is the distance along the direction plus twice the drift
 * across it - the usual spatial-navigation weighting, so "down" prefers the button straight below over a nearer one
 * off to the side. Answers the new cursor point (the control's centre) or null.
 */
export function spatialStep(from, dir, d = doc()) {
  if (!d?.querySelectorAll || !from) return null;
  const [vx, vy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir] ?? [0, 0];
  if (!vx && !vy) return null;
  const here = interactiveAt(from[0], from[1], d);
  let best = null, bestScore = Infinity;
  for (const n of d.querySelectorAll(INTERACTIVE)) {
    if (n === here || n.disabled || !visible(n) || n.closest?.('.hud, .hb:not(.dropping)')) continue;
    const r = n.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > (globalThis.innerWidth ?? 1e9) || cy > (globalThis.innerHeight ?? 1e9)) continue;
    const top = d.elementFromPoint?.(cx, cy);
    if (top && top !== n && !n.contains(top)) continue;              // covered by something else
    const dx = cx - from[0], dy = cy - from[1];
    const along = dx * vx + dy * vy;
    if (along <= 4) continue;
    const across = Math.abs(dx * vy - dy * vx);
    const score = along + across * 2;
    if (score < bestScore) { bestScore = score; best = [cx, cy]; }
  }
  return best;
}

/** THE RIGHT STICK IN A WINDOW: scroll the nearest scrollable box under the point. Answers whether anything moved. */
export function scrollAt(x, y, dy, d = doc()) {
  let n = d?.elementFromPoint?.(x, y) ?? null;
  while (n && n !== d.documentElement) {
    const cs = globalThis.getComputedStyle?.(n);
    if (cs && /(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) {
      const was = n.scrollTop;
      n.scrollTop += dy;
      return n.scrollTop !== was;
    }
    n = n.parentElement;
  }
  return false;
}

/**
 * THE CURSOR'S CLICKS, ON THE PAGE. `target(x, y)` is the DOM element under the cursor when it is not the game canvas
 * (a DOM window) - the poller dispatches there; over the canvas (a classic window) it keeps its canvas dispatch.
 */
export function domTargetAt(x, y, canvas, d = doc()) {
  const n = d?.elementFromPoint?.(x, y) ?? null;
  if (!n || n === canvas || n === d.body || n === d.documentElement) return null;
  return n;
}

/** The pointer and mouse events a real click raises, dispatched at `el`. `phase` is 'down', 'up' or 'move'. */
export function domPointer(el, phase, { x, y, button = 0, makeEvent }) {
  if (!el?.dispatchEvent) return;
  const buttons = phase === 'up' ? 0 : button === 0 ? 1 : button === 2 ? 2 : 4;
  const init = { clientX: x, clientY: y, button, buttons, pointerType: 'mouse', pointerId: 1, isPrimary: true, bubbles: true, cancelable: true, composed: true, view: globalThis.window };
  const fire = (type) => { try { el.dispatchEvent(makeEvent(type, init)); } catch { /* a harness without the ctor */ } };
  if (phase === 'move') { fire('pointermove'); fire('mousemove'); return; }
  if (phase === 'down') {
    fire('pointerdown'); fire('mousedown');
    if (button === 0) el.closest?.('input, select, textarea, [tabindex], button')?.focus?.({ preventScroll: true });
    return;
  }
  fire('pointerup'); fire('mouseup');
  if (button === 0) fire('click');
  else if (button === 2) fire('contextmenu');
}

/** The enter/leave/over/out a real mouse raises when it crosses from `from` to `to` - the pack's hover card listens
 *  for mouseenter on a row, and a synthetic move alone never raises one. */
export function domHoverChange(from, to, { x, y, makeEvent }) {
  if (from === to) return;
  const init = { clientX: x, clientY: y, pointerType: 'mouse', pointerId: 1, isPrimary: true, cancelable: true, view: globalThis.window };
  const fire = (el, type, bubbles) => { try { el.dispatchEvent(makeEvent(type, { ...init, bubbles })); } catch { /* ignore */ } };
  const chain = (n) => { const out = []; for (let c = n; c && c.nodeType === 1; c = c.parentElement) out.push(c); return out; };
  const a = chain(from), b = chain(to);
  if (from?.isConnected) { fire(from, 'pointerout', true); fire(from, 'mouseout', true); }
  for (const n of a) if (!b.includes(n) && n.isConnected) { fire(n, 'pointerleave', false); fire(n, 'mouseleave', false); }
  if (to) { fire(to, 'pointerover', true); fire(to, 'mouseover', true); }
  for (const n of b.reverse()) if (!a.includes(n)) { fire(n, 'pointerenter', false); fire(n, 'mouseenter', false); }
}

// ── 4. THE PROMPT BAR ───────────────────────────────────────────────

const PROMPT_ID = 'plus-pad-prompts';
const PROMPT_CSS = `
#${PROMPT_ID} { position: fixed; left: 50%; bottom: calc(10px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%);
  z-index: 39; display: none; gap: 14px; align-items: center; padding: 6px 14px; pointer-events: none;
  background: linear-gradient(180deg, rgba(34,31,26,0.94), rgba(14,13,11,0.94));
  border: 2px solid; border-color: #b08a4a #5c4526 #3a2c18 #8a6c3c; box-shadow: 0 0 0 1px #000, 0 6px 18px rgba(0,0,0,0.55);
  font: 13px/1 var(--pixel-font, "Pixelify Sans", ui-monospace, monospace); letter-spacing: 0.06em; color: #ece3c8;
  text-shadow: 1px 1px 0 #000; white-space: nowrap; }
#${PROMPT_ID}.on { display: flex; }
#${PROMPT_ID} .pp { display: inline-flex; align-items: center; gap: 5px; }
#${PROMPT_ID} .pp img { width: 22px; height: 22px; display: block; }
#${PROMPT_ID} .pp img + img { margin-left: -2px; }
.plus-pad-hover { outline: 2px solid #e8c374 !important; outline-offset: 1px; box-shadow: 0 0 0 4px rgba(232,195,116,0.25) !important; }
@media (max-width: 640px) { #${PROMPT_ID} { gap: 9px; padding: 5px 9px; font-size: 11px; } #${PROMPT_ID} .pp img { width: 18px; height: 18px; } }
`;
let promptEl = null, promptSig = '';
function promptNode() {
  const d = doc();
  if (!d?.body) return null;
  if (promptEl?.isConnected) return promptEl;
  if (!d.getElementById(`${PROMPT_ID}-style`)) {
    const st = d.createElement('style'); st.id = `${PROMPT_ID}-style`; st.textContent = PROMPT_CSS; d.head.append(st);
  }
  promptEl = d.createElement('div');
  promptEl.id = PROMPT_ID;
  promptEl.setAttribute('aria-hidden', 'true');
  d.body.append(promptEl);
  return promptEl;
}
/** The prompts for a window up under a live pad: [codes[], words] pairs. Pure, for the pin. */
export function windowPrompts({ tabs = false, quick = false, uiBack = 'JoystickButton1', uiClick = 'JoystickButton0' } = {}) {
  const rows = [[[uiClick], 'Select']];
  if (quick) rows.push([['JoystickButton2'], 'Equip / Use']);   // PADPLUS5
  rows.push([['JoystickButton3'], 'Options'], [[uiBack], 'Back']);
  if (tabs) rows.push([['JoystickButton4', 'JoystickButton5'], 'Tabs']);
  rows.push([['Dpad'], 'Jump to'], [['StickR'], 'Scroll']);
  return rows;
}
/** Paint (or hide) the bar. `rows` null hides it. */
export function showPrompts(rows, family = 'xbox') {
  const sig = rows ? `${family}|${rows.map(([c, w]) => `${c.join('+')}:${w}`).join('|')}` : '';
  if (sig === promptSig) return;
  promptSig = sig;
  const n = promptNode();
  if (!n) return;
  n.textContent = '';
  n.classList.toggle('on', !!rows);
  for (const [codes, words] of rows ?? []) {
    const p = d_el('span', 'pp');
    for (const c of codes) {
      const img = d_el('img');
      img.alt = hdGlyphName(family, c);
      img.src = hdGlyphSvg(family, c, { size: 44 }) ?? '';
      p.append(img);
    }
    p.append(d_el('span', null, words));
    n.append(p);
  }
}
function d_el(tag, cls, text) { const e = doc().createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

/** The hovered control wears a ring, since a synthetic pointer never lights :hover. */
let hoverEl = null;
export function markHover(el) {
  if (hoverEl === el) return;
  hoverEl?.classList?.remove('plus-pad-hover');
  hoverEl = el ?? null;
  hoverEl?.classList?.add('plus-pad-hover');
}
